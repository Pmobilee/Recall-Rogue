/**
 * Co-op turn synchronization for Recall Rogue.
 *
 * In co-op mode, players fight ONE shared enemy (host-authoritative HP).
 * Turn flow:
 *   1. At encounter start: host broadcasts initial enemy snapshot; non-host awaits it.
 *   2. Each player plays cards locally against their local enemy copy (optimistic).
 *   3. Each player ends their turn: sends `mp:coop:turn_end_with_delta` (delta = what they did
 *      to the enemy this turn) and awaits consensus.
 *   4. Once every player has signaled, HOST merges all deltas -> produces authoritative
 *      enemy state -> broadcasts `mp:coop:enemy_state`.
 *   5. Non-host awaits `mp:coop:enemy_state` and overwrites local enemy state.
 *   6. BOTH clients run the enemy phase locally against their own player HP (full damage, no split).
 *   7. After the enemy phase, each client broadcasts its HP via `mp:coop:partner_state`.
 *
 * Canary is DISABLED in coop -- enemy damage multiplier is always 1.0x.
 * See encounterBridge.ts for the canary gate.
 *
 * H18 Solo-survivor rule:
 * When one player's HP reaches 0 mid-encounter, the encounter ends immediately
 * for ALL co-op players and BOTH receive a loss. There is no solo-survivor path.
 * Enforcement: call handleCoopPlayerDeath(playerId) from
 * encounterBridge.applyDamageToLocalPlayer when HP <= 0 in coop mode.
 * TODO(H18-wiring): call handleCoopPlayerDeath from
 *   encounterBridge.ts applyDamageToLocalPlayer (or equivalent death-check site)
 *   when run.multiplayerMode === 'coop' && newHp <= 0. The exact hook point is
 *   inside the handleEndTurn beat-2 section where player HP is committed after
 *   the enemy phase.
 */

import { getMultiplayerTransport } from './multiplayerTransport';
import { getCurrentLobby, onLobbyUpdate } from './multiplayerLobbyService';
import type { SharedEnemySnapshot, EnemyTurnDelta, RaceProgress } from '../data/multiplayerTypes';
import { rrLog } from './rrLog';

// -- Debug flag ---------------------------------------------------------------

/** Set to true locally to enable verbose coop sync tracing via console. */
const DEBUG_COOP = false;

function coopLog(msg: string, ...args: unknown[]): void {
  if (DEBUG_COOP) console.log(`[coopSync] ${msg}`, ...args);
}

// -- Constants ----------------------------------------------------------------

/** Hard timeout for turn-end barriers (ms). After this, the barrier resolves 'cancelled'. */
const BARRIER_TIMEOUT_MS = 45_000;

/**
 * Interval at which co-op sync checks for a stale partner heartbeat (ms).
 * A partner is declared unresponsive if no mp:coop:partner_state is received
 * from them for PARTNER_UNRESPONSIVE_TIMEOUT_MS.
 */
const PARTNER_HEARTBEAT_POLL_MS = 5_000;

/**
 * Maximum time to wait between mp:coop:partner_state messages before declaring
 * a partner unresponsive (ms). Fires onPartnerUnresponsive callbacks.
 */
const PARTNER_UNRESPONSIVE_TIMEOUT_MS = 90_000;

// -- State --------------------------------------------------------------------

/** Players who have signaled "turn ended" for the current barrier. */
let _turnEndSignals: Set<string> = new Set();

/** Local player's stable ID, captured at init. */
let _localPlayerId: string = '';

/** Resolver for the current pending barrier promise (null if none in flight). */
let _pendingBarrierResolve: ((result: 'completed' | 'cancelled') => void) | null = null;

/**
 * Number of players in the lobby when the barrier was started.
 * Used to detect partner-leave mid-barrier.
 */
let _barrierExpectedPlayerCount: number = 0;

/** Handle returned by the barrier's hard-timeout setTimeout. */
let _barrierTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

/** Cleanup for transport listener. Null when not active. */
let _cleanupListener: (() => void) | null = null;

/** Cleanup for the lobby-update listener used for partner-leave detection. */
let _cleanupLobbyListener: (() => void) | null = null;

/** Latest known partner HP/maxHP/block, keyed by playerId. */
let _partnerStates: Record<string, PartnerState> = {};

/**
 * Set of callbacks subscribed to partner state changes.
 * Multi-subscriber pattern so multiple callers can coexist without overwriting each other.
 */
const _partnerStateSubs = new Set<(states: Readonly<Record<string, PartnerState>>) => void>();

/**
 * Set of callbacks subscribed to shared enemy state broadcasts.
 * Multi-subscriber pattern mirroring _partnerStateSubs.
 */
const _sharedEnemySubs = new Set<(snapshot: SharedEnemySnapshot) => void>();

/**
 * Set of callbacks subscribed to real-time enemy HP updates (per-card-play, co-op only).
 * Lightweight complement to the full SharedEnemySnapshot turn-end reconcile.
 */
const _enemyHpSubs = new Set<(currentHP: number, maxHP: number) => void>();

/**
 * Deltas collected during the current turn-end barrier.
 * Keyed by playerId. Cleared when awaitCoopTurnEndWithDelta is called (new turn).
 */
let _collectedDeltas: Map<string, EnemyTurnDelta> = new Map();

/**
 * Timestamp (Date.now()) of the last received mp:coop:partner_state per player.
 * Used by the AFK heartbeat detector (H19/M5).
 * Keyed by playerId (excluding self).
 */
let _lastPartnerHeartbeat: Map<string, number> = new Map();

/**
 * Set of callbacks subscribed to partner-unresponsive events (H19/M5).
 * Each callback receives the unresponsive partner's playerId.
 */
const _partnerUnresponsiveSubs = new Set<(playerId: string) => void>();

/** Handle for the AFK heartbeat poll interval. */
let _heartbeatPollHandle: ReturnType<typeof setInterval> | null = null;

export interface PartnerState {
  playerId: string;
  hp: number;
  maxHp: number;
  block: number;
  /** Current run score for this player, updated at turn-end. */
  score?: number;
  /** Current answer accuracy (0-1) for this player, updated at turn-end. */
  accuracy?: number;
}

// -- Lifecycle ----------------------------------------------------------------

/**
 * Activate co-op sync for the current run. Subscribes to all coop transport messages.
 */
export function initCoopSync(localPlayerId: string): void {
  destroyCoopSync();
  _localPlayerId = localPlayerId;
  _turnEndSignals = new Set();
  _partnerStates = {};
  _collectedDeltas = new Map();
  _lastPartnerHeartbeat = new Map();

  rrLog('mp:coop', 'initCoopSync', { localPlayerId });

  const transport = getMultiplayerTransport();

  // Legacy turn_end barrier signals (kept alive -- internal to the barrier)
  const offTurnEnd = transport.on('mp:coop:turn_end', (msg) => {
    const { playerId } = msg.payload as { playerId: string };
    if (!playerId) return;
    coopLog('received turn_end from %s', playerId);
    _turnEndSignals.add(playerId);
    _maybeReleaseBarrier();
  });

  // New delta-carrying turn_end signal
  const offTurnEndWithDelta = transport.on('mp:coop:turn_end_with_delta', (msg) => {
    const payload = msg.payload as { playerId: string; delta: EnemyTurnDelta };
    if (!payload?.playerId) return;
    coopLog('received turn_end_with_delta from %s, damage=%d', payload.playerId, payload.delta?.damageDealt);
    _turnEndSignals.add(payload.playerId);
    if (payload.delta) {
      _collectedDeltas.set(payload.playerId, { ...payload.delta, playerId: payload.playerId });
    }
    _maybeReleaseBarrier();
  });

  const offTurnEndCancel = transport.on('mp:coop:turn_end_cancel', (msg) => {
    const { playerId } = msg.payload as { playerId: string };
    if (!playerId) return;
    coopLog('received turn_end_cancel from %s', playerId);
    // Remote player cancelled their turn-end signal -- remove them from the set.
    // The barrier will not release until they re-signal.
    _turnEndSignals.delete(playerId);
    _collectedDeltas.delete(playerId);
  });

  const offPartner = transport.on('mp:coop:partner_state', (msg) => {
    const state = msg.payload as unknown as PartnerState;
    coopLog('received partner_state from %s', state?.playerId);
    if (!state?.playerId || state.playerId === _localPlayerId) return;
    _partnerStates[state.playerId] = state;
    // Update heartbeat timestamp for AFK detection (H19/M5).
    _lastPartnerHeartbeat.set(state.playerId, Date.now());
    coopLog('firing partner state callbacks (%d subscribers)', _partnerStateSubs.size);
    const snapshot = { ..._partnerStates };
    for (const cb of _partnerStateSubs) {
      cb(snapshot);
    }
  });

  // Shared enemy state broadcast from host
  const offEnemyState = transport.on('mp:coop:enemy_state', (msg) => {
    const snapshot = msg.payload as unknown as SharedEnemySnapshot;
    rrLog('mp:coop', 'recv enemy_state', { hp: snapshot?.currentHP, maxHP: snapshot?.maxHP, subs: _sharedEnemySubs.size });
    if (!snapshot?.currentHP === undefined || !snapshot?.maxHP === undefined) return;
    for (const cb of _sharedEnemySubs) {
      cb(snapshot);
    }
  });

  // Real-time enemy HP update -- lightweight per-card-play broadcast from the active partner.
  const offEnemyHpUpdate = transport.on('mp:coop:enemy_hp_update', (msg) => {
    const { currentHP, maxHP } = msg.payload as { currentHP: number; maxHP: number };
    rrLog('mp:coop', 'recv enemy_hp_update', { hp: currentHP, maxHP, subs: _enemyHpSubs.size });
    if (typeof currentHP !== 'number' || typeof maxHP !== 'number') return;
    for (const cb of _enemyHpSubs) {
      cb(currentHP, maxHP);
    }
  });

  _cleanupListener = () => {
    offTurnEnd();
    offTurnEndWithDelta();
    offTurnEndCancel();
    offPartner();
    offEnemyState();
    offEnemyHpUpdate();
  };

  // Start AFK heartbeat poll (H19/M5).
  _heartbeatPollHandle = setInterval(_checkPartnerHeartbeats, PARTNER_HEARTBEAT_POLL_MS);
}

/** Tear down co-op sync. Safe to call multiple times. */
export function destroyCoopSync(): void {
  if (_cleanupListener) {
    _cleanupListener();
    _cleanupListener = null;
  }
  if (_cleanupLobbyListener) {
    _cleanupLobbyListener();
    _cleanupLobbyListener = null;
  }
  _clearBarrierTimeout();
  if (_pendingBarrierResolve) {
    // Release any in-flight barrier so callers don't hang on teardown.
    _pendingBarrierResolve('completed');
    _pendingBarrierResolve = null;
  }
  if (_heartbeatPollHandle !== null) {
    clearInterval(_heartbeatPollHandle);
    _heartbeatPollHandle = null;
  }
  _turnEndSignals = new Set();
  _localPlayerId = '';
  _partnerStates = {};
  _collectedDeltas = new Map();
  _lastPartnerHeartbeat = new Map();
  _barrierExpectedPlayerCount = 0;
  // NOTE: _partnerStateSubs, _sharedEnemySubs, _enemyHpSubs, and
  // _partnerUnresponsiveSubs are NOT cleared here --
  // consumer-owned subscriptions have their own lifetime (callers hold the returned unsub).
}

// -- Public API ---------------------------------------------------------------

/**
 * Signal "I have ended my turn" to all players, then await consensus.
 *
 * Resolves 'completed' when every player in the lobby has signaled.
 * Resolves 'cancelled' if:
 *   - The local player calls cancelCoopTurnEnd() before consensus.
 *   - A partner leaves the lobby while we are waiting (prevents stranding).
 *   - The transport disconnects while a barrier is in flight.
 *   - The 45-second hard timeout elapses with no consensus.
 *
 * If no lobby exists or only the local player is connected, resolves immediately.
 */
export function awaitCoopTurnEnd(): Promise<'completed' | 'cancelled'> {
  const lobby = getCurrentLobby();
  const players = lobby?.players ?? [];

  // Solo or no lobby -> no barrier needed.
  if (players.length <= 1 || !_localPlayerId) {
    return Promise.resolve('completed');
  }

  // Mark self and broadcast.
  _turnEndSignals.add(_localPlayerId);
  _barrierExpectedPlayerCount = players.length;
  const transport = getMultiplayerTransport();
  coopLog('broadcastin turn_end, localId=%s', _localPlayerId);
  transport.send('mp:coop:turn_end', { playerId: _localPlayerId });

  // If we already have everyone (e.g. partner finished first), resolve fast.
  if (_allPlayersSignaled()) {
    _turnEndSignals = new Set();
    return Promise.resolve('completed');
  }

  // Otherwise wait for the barrier with a 45s hard timeout.
  return new Promise<'completed' | 'cancelled'>((resolve) => {
    _pendingBarrierResolve = (result: 'completed' | 'cancelled') => {
      _pendingBarrierResolve = null;
      _clearBarrierTimeout();
      _turnEndSignals = new Set();
      _barrierExpectedPlayerCount = 0;
      if (_cleanupLobbyListener) {
        _cleanupLobbyListener();
        _cleanupLobbyListener = null;
      }
      coopLog('barrier resolved: %s', result);
      resolve(result);
    };

    // 45s hard timeout -- partner may be hung, crashed, or the transport silently dropped.
    _barrierTimeoutHandle = setTimeout(() => {
      if (_pendingBarrierResolve) {
        coopLog('barrier timeout -- partner unresponsive');
        console.warn('[coopSync] barrier timeout -- partner unresponsive; resolving cancelled');
        _pendingBarrierResolve('cancelled');
      }
    }, BARRIER_TIMEOUT_MS);

    // Watch for partner leaving the lobby mid-barrier.
    _cleanupLobbyListener = onLobbyUpdate((updatedLobby) => {
      if (!_pendingBarrierResolve) return;
      if (updatedLobby.players.length < _barrierExpectedPlayerCount) {
        coopLog('partner left lobby mid-barrier (%d->%d), cancelling', _barrierExpectedPlayerCount, updatedLobby.players.length);
        _pendingBarrierResolve('cancelled');
      }
    });

    // Watch for transport disconnect while barrier is in flight.
    _scheduleDisconnectCheck();
  });
}

/**
 * Signal "I have ended my turn" and attach a damage delta payload, then await consensus.
 * Replaces awaitCoopTurnEnd() in the coop enemy-sync flow.
 *
 * At consensus, the host can call getCollectedDeltas() to retrieve all player deltas.
 * Non-host should then call awaitCoopEnemyReconcile() to get the merged state.
 *
 * Resolves 'completed' when every player has signaled.
 * Resolves 'cancelled' if a partner leaves mid-barrier, the transport disconnects,
 * or the 45-second hard timeout elapses.
 *
 * The delta accumulator is cleared at the START of this call (fresh per turn).
 */
export function awaitCoopTurnEndWithDelta(delta: EnemyTurnDelta): Promise<'completed' | 'cancelled'> {
  const lobby = getCurrentLobby();
  const players = lobby?.players ?? [];

  // Clear previous turn's deltas for a fresh collection
  _collectedDeltas = new Map();

  // Solo or no lobby -> no barrier needed.
  if (players.length <= 1 || !_localPlayerId) {
    // Store own delta even for solo (host merge path reads it)
    _collectedDeltas.set(_localPlayerId, { ...delta, playerId: _localPlayerId });
    return Promise.resolve('completed');
  }

  // Mark self, store own delta, and broadcast.
  _turnEndSignals.add(_localPlayerId);
  _collectedDeltas.set(_localPlayerId, { ...delta, playerId: _localPlayerId });
  _barrierExpectedPlayerCount = players.length;
  const transport = getMultiplayerTransport();
  coopLog('broadcasting turn_end_with_delta, localId=%s, damage=%d', _localPlayerId, delta.damageDealt);
  transport.send('mp:coop:turn_end_with_delta', {
    playerId: _localPlayerId,
    delta: delta as unknown as Record<string, unknown>,
  });

  // If we already have everyone (e.g. partner finished first), resolve fast.
  if (_allPlayersSignaled()) {
    _turnEndSignals = new Set();
    return Promise.resolve('completed');
  }

  // Otherwise wait for the barrier with a 45s hard timeout.
  return new Promise<'completed' | 'cancelled'>((resolve) => {
    _pendingBarrierResolve = (result: 'completed' | 'cancelled') => {
      _pendingBarrierResolve = null;
      _clearBarrierTimeout();
      _turnEndSignals = new Set();
      _barrierExpectedPlayerCount = 0;
      if (_cleanupLobbyListener) {
        _cleanupLobbyListener();
        _cleanupLobbyListener = null;
      }
      coopLog('delta barrier resolved: %s', result);
      resolve(result);
    };

    // 45s hard timeout.
    _barrierTimeoutHandle = setTimeout(() => {
      if (_pendingBarrierResolve) {
        coopLog('barrier timeout -- partner unresponsive');
        console.warn('[coopSync] delta barrier timeout -- partner unresponsive; resolving cancelled');
        _pendingBarrierResolve('cancelled');
      }
    }, BARRIER_TIMEOUT_MS);

    _cleanupLobbyListener = onLobbyUpdate((updatedLobby) => {
      if (!_pendingBarrierResolve) return;
      if (updatedLobby.players.length < _barrierExpectedPlayerCount) {
        coopLog('partner left lobby mid-delta-barrier, cancelling');
        _pendingBarrierResolve('cancelled');
      }
    });

    // Watch for transport disconnect while barrier is in flight.
    _scheduleDisconnectCheck();
  });
}

/**
 * Returns the deltas accumulated during the most recent awaitCoopTurnEndWithDelta() call.
 * Sorted by playerId for deterministic merge order.
 * Host calls this after the barrier completes to merge deltas.
 */
export function getCollectedDeltas(): EnemyTurnDelta[] {
  return [..._collectedDeltas.values()].sort((a, b) => a.playerId.localeCompare(b.playerId));
}

/**
 * Cancel a pending turn-end signal. Removes local signal, broadcasts cancellation,
 * and resolves the in-flight awaitCoopTurnEnd() / awaitCoopTurnEndWithDelta()
 * promise with 'cancelled' so the caller can restore turn control to the player.
 *
 * No-op if no barrier is in flight or no local player is set.
 */
export function cancelCoopTurnEnd(): void {
  if (!_localPlayerId) return;
  _turnEndSignals.delete(_localPlayerId);
  _collectedDeltas.delete(_localPlayerId);
  const transport = getMultiplayerTransport();
  transport.send('mp:coop:turn_end_cancel', { playerId: _localPlayerId });
  if (_pendingBarrierResolve) {
    const resolve = _pendingBarrierResolve;
    _pendingBarrierResolve = null;
    resolve('cancelled');
  }
}

/**
 * Alias for cancelCoopTurnEnd(). Provided for callers using the
 * Issue 9 end-turn cancel flow naming convention.
 *
 * Removes the local player from the turn-end barrier, broadcasts
 * mp:coop:turn_end_cancel, and resolves the pending barrier promise
 * with 'cancelled'. No-op if no barrier is in flight.
 *
 * @see cancelCoopTurnEnd for full implementation details
 */
export function sendTurnEndCancel(): void {
  cancelCoopTurnEnd();
}

/**
 * Returns true if the local player has signaled turn-end and is waiting for consensus.
 * Use this to guard UI state (e.g. show "Cancel" button while waiting).
 */
export function isLocalTurnEndPending(): boolean {
  return _pendingBarrierResolve !== null;
}

/**
 * Returns true if a turn-end barrier promise is currently in flight.
 * Exposed primarily for test assertions and diagnostic UI.
 */
export function hasPendingBarrier(): boolean {
  return _pendingBarrierResolve !== null;
}

/**
 * Broadcast this player's current HP/maxHP/block/score/accuracy so peers' HUDs can update.
 * Call after damage is applied at end of turn.
 */
export function broadcastPartnerState(state: { hp: number; maxHp: number; block: number; score?: number; accuracy?: number }): void {
  if (!_localPlayerId) {
    coopLog('broadcastPartnerState called before initCoopSync -- dropped');
    return;
  }
  coopLog('broadcastPartnerState hp=%d maxHp=%d block=%d', state.hp, state.maxHp, state.block);
  const transport = getMultiplayerTransport();
  transport.send('mp:coop:partner_state', {
    playerId: _localPlayerId,
    hp: state.hp,
    maxHp: state.maxHp,
    block: state.block,
    ...(state.score !== undefined ? { score: state.score } : {}),
    ...(state.accuracy !== undefined ? { accuracy: state.accuracy } : {}),
  });
}

/**
 * Broadcast the authoritative shared enemy state (host-only in practice).
 * Sends mp:coop:enemy_state with the snapshot payload.
 * All subscribed non-host clients receive it via onSharedEnemyState.
 */
export function broadcastSharedEnemyState(snapshot: SharedEnemySnapshot): void {
  if (!_localPlayerId) {
    rrLog('mp:coop', 'broadcastSharedEnemyState dropped — coop sync not initialised');
    return;
  }
  rrLog('mp:coop', 'send enemy_state', { hp: snapshot.currentHP, maxHP: snapshot.maxHP });
  const transport = getMultiplayerTransport();
  transport.send('mp:coop:enemy_state', snapshot as unknown as Record<string, unknown>);
}

/**
 * Broadcast a real-time lightweight enemy HP update to all peers.
 * Call after each card play so the partner's scene reflects damage in real time
 * without waiting for the full turn-end reconcile.
 *
 * Sends mp:coop:enemy_hp_update -- parsed by onEnemyHpUpdate subscribers.
 */
export function broadcastEnemyHpUpdate(currentHP: number, maxHP: number): void {
  if (!_localPlayerId) {
    rrLog('mp:coop', 'broadcastEnemyHpUpdate dropped — coop sync not initialised');
    return;
  }
  rrLog('mp:coop', 'send enemy_hp_update', { hp: currentHP, maxHP });
  const transport = getMultiplayerTransport();
  transport.send('mp:coop:enemy_hp_update', { currentHP, maxHP });
}

/**
 * Subscribe to real-time enemy HP updates from the partner.
 * Returns an unsubscribe function the caller must invoke on cleanup.
 *
 * Fires for every mp:coop:enemy_hp_update -- use to update the local scene's
 * enemy HP display without waiting for turn-end reconciliation.
 */
export function onEnemyHpUpdate(
  cb: (currentHP: number, maxHP: number) => void,
): () => void {
  _enemyHpSubs.add(cb);
  coopLog('onEnemyHpUpdate subscribed, total=%d', _enemyHpSubs.size);
  return () => {
    _enemyHpSubs.delete(cb);
    coopLog('onEnemyHpUpdate unsubscribed, total=%d', _enemyHpSubs.size);
  };
}

/**
 * Subscribe to shared enemy state broadcasts from the host.
 * Returns an unsubscribe function the caller must invoke on cleanup.
 *
 * The callback fires whenever mp:coop:enemy_state is received --
 * both at encounter start (initial anchor) and after each turn reconcile.
 */
export function onSharedEnemyState(
  cb: (snapshot: SharedEnemySnapshot) => void,
): () => void {
  _sharedEnemySubs.add(cb);
  coopLog('onSharedEnemyState subscribed, total=%d', _sharedEnemySubs.size);
  return () => {
    _sharedEnemySubs.delete(cb);
    coopLog('onSharedEnemyState unsubscribed, total=%d', _sharedEnemySubs.size);
  };
}

/**
 * Returns a Promise that resolves with the next mp:coop:enemy_state snapshot received.
 * Non-host clients use this to wait for the host's authoritative merged state after barriers.
 *
 * The Promise resolves on the NEXT message -- it does NOT use a cached value.
 * If the lobby becomes empty (partner left), the Promise never resolves -- the caller
 * should guard with the barrier cancel path instead.
 */
export function awaitCoopEnemyReconcile(): Promise<SharedEnemySnapshot> {
  coopLog('awaitCoopEnemyReconcile: waiting for next mp:coop:enemy_state');
  return new Promise<SharedEnemySnapshot>((resolve) => {
    const unsub = onSharedEnemyState((snapshot) => {
      unsub(); // one-shot
      coopLog('awaitCoopEnemyReconcile: received, hp=%d/%d', snapshot.currentHP, snapshot.maxHP);
      resolve(snapshot);
    });
  });
}

/** Snapshot of all known partner states (excluding self). */
export function getPartnerStates(): Readonly<Record<string, PartnerState>> {
  return { ..._partnerStates };
}

/**
 * Subscribe to partner state changes.
 * Returns an unsubscribe function the caller must invoke on cleanup.
 */
export function onPartnerStateUpdate(
  cb: (states: Readonly<Record<string, PartnerState>>) => void,
): () => void {
  _partnerStateSubs.add(cb);
  coopLog('onPartnerStateUpdate subscribed, total=%d', _partnerStateSubs.size);
  return () => {
    _partnerStateSubs.delete(cb);
    coopLog('onPartnerStateUpdate unsubscribed, total=%d', _partnerStateSubs.size);
  };
}

// -- H18 -- Co-op player death ------------------------------------------------

/**
 * Handle a co-op player death. When any player's HP reaches 0 in a co-op encounter:
 *   (a) Broadcasts mp:coop:player_died to all peers so they see the event.
 *   (b) Resolves any in-flight turn-end barrier with 'cancelled' immediately.
 *   (c) The encounter-end signal is implicit: the caller (encounterBridge) must
 *       handle the 'cancelled' result from the barrier and route to the loss screen.
 *       Both players receive a loss -- there is no solo-survivor path in co-op.
 *
 * TODO(H18-wiring): call this from encounterBridge.ts at the death-check site
 *   (applyDamageToLocalPlayer or the beat-2 HP commit inside handleEndTurn)
 *   when run.multiplayerMode === 'coop' && newHp <= 0.
 *
 * @param playerId  The ID of the player who died.
 */
export function handleCoopPlayerDeath(playerId: string): void {
  if (!_localPlayerId) {
    coopLog('handleCoopPlayerDeath called before initCoopSync -- dropped');
    return;
  }
  coopLog('handleCoopPlayerDeath: playerId=%s', playerId);
  const transport = getMultiplayerTransport();
  transport.send('mp:coop:player_died', { playerId });

  // Abort any pending barrier so the encounter-end path can proceed without delay.
  if (_pendingBarrierResolve) {
    coopLog('handleCoopPlayerDeath: cancelling in-flight barrier');
    _pendingBarrierResolve('cancelled');
  }
}

// -- H19/M5 -- AFK / unresponsive partner -------------------------------------

/**
 * Register a callback that fires when a known partner has not sent a
 * mp:coop:partner_state heartbeat for 90 seconds.
 *
 * The callback receives the unresponsive partner's playerId. The caller
 * decides what to do (show a warning, auto-resolve, etc.). This primitive
 * does NOT kick the partner.
 *
 * Returns an unsubscribe function the caller must invoke on cleanup.
 */
export function onPartnerUnresponsive(cb: (playerId: string) => void): () => void {
  _partnerUnresponsiveSubs.add(cb);
  coopLog('onPartnerUnresponsive subscribed, total=%d', _partnerUnresponsiveSubs.size);
  return () => {
    _partnerUnresponsiveSubs.delete(cb);
    coopLog('onPartnerUnresponsive unsubscribed, total=%d', _partnerUnresponsiveSubs.size);
  };
}

/**
 * Mark a partner as unresponsive immediately (e.g. the lobby service received
 * a disconnect event for them). Fires onPartnerUnresponsive subscribers.
 *
 * Does NOT kick or remove the player -- upstream decides what action to take.
 */
export function markPartnerUnresponsive(playerId: string): void {
  coopLog('markPartnerUnresponsive: playerId=%s', playerId);
  for (const cb of _partnerUnresponsiveSubs) {
    cb(playerId);
  }
}

// -- M17 -- Bridge partner state into HUD-ready shape -------------------------

/**
 * Map a PartnerState (transport layer) into the subset of RaceProgress that
 * the MultiplayerHUD consumes for the partner's status display.
 *
 * Maps:
 *   state.hp       -> playerHp
 *   state.maxHp    -> playerMaxHp
 *   state.block    -> playerBlock
 *   state.score    -> score (0 if absent)
 *   state.accuracy -> accuracy (0 if absent)
 *   state.playerId -> playerId
 *
 * The remaining RaceProgress fields (floor, encountersWon, isFinished,
 * result) are NOT present in PartnerState and must be filled in by the caller
 * (typically from CardApp.svelte's race progress tracking state).
 *
 * HUD wire-up is handled by the UI wave -- this function is the transport->UI bridge
 * primitive that shapes the data correctly.
 */
export function partnerStateToRaceProgressShape(state: PartnerState): Partial<RaceProgress> {
  return {
    playerId: state.playerId,
    playerHp: state.hp,
    playerMaxHp: state.maxHp,
    playerBlock: state.block,
    score: state.score ?? 0,
    accuracy: state.accuracy ?? 0,
  };
}

// -- Internal -----------------------------------------------------------------

function _maybeReleaseBarrier(): void {
  if (!_pendingBarrierResolve) return;
  if (_allPlayersSignaled()) {
    _pendingBarrierResolve('completed');
  }
}

function _allPlayersSignaled(): boolean {
  const lobby = getCurrentLobby();
  const players = lobby?.players ?? [];
  if (players.length === 0) return true;
  for (const p of players) {
    if (!_turnEndSignals.has(p.id)) return false;
  }
  return true;
}

function _clearBarrierTimeout(): void {
  if (_barrierTimeoutHandle !== null) {
    clearTimeout(_barrierTimeoutHandle);
    _barrierTimeoutHandle = null;
  }
}

/**
 * Poll the transport state once after a short delay to detect a silent disconnect.
 * The transport interface has no onDisconnect event hook, so we use a poll check.
 * If the transport is not connected while a barrier is in flight, cancel the barrier.
 *
 * We schedule a single check 2s after a barrier starts (fast enough to catch most
 * hard-disconnect cases without thrashing). The 45s timeout is the final backstop.
 */
function _scheduleDisconnectCheck(): void {
  setTimeout(() => {
    if (!_pendingBarrierResolve) return; // already resolved
    const transport = getMultiplayerTransport();
    if (!transport.isConnected()) {
      coopLog('transport disconnected while barrier in flight -- cancelling');
      console.warn('[coopSync] transport disconnected mid-barrier; resolving cancelled');
      _pendingBarrierResolve('cancelled');
    }
  }, 2_000);
}

/**
 * Heartbeat poll (H19/M5). Called every PARTNER_HEARTBEAT_POLL_MS.
 * Checks each known partner's last heartbeat. If any partner has not sent
 * a mp:coop:partner_state for PARTNER_UNRESPONSIVE_TIMEOUT_MS, fires callbacks.
 */
function _checkPartnerHeartbeats(): void {
  if (_partnerUnresponsiveSubs.size === 0) return; // no subscribers -- skip
  const now = Date.now();
  for (const [playerId, lastSeen] of _lastPartnerHeartbeat) {
    if (now - lastSeen >= PARTNER_UNRESPONSIVE_TIMEOUT_MS) {
      coopLog('partner %s heartbeat absent for %dms -- firing unresponsive callbacks', playerId, now - lastSeen);
      for (const cb of _partnerUnresponsiveSubs) {
        cb(playerId);
      }
      // Reset timestamp to avoid re-firing every poll while still unresponsive.
      // Upstream should decide whether to kick or keep waiting.
      _lastPartnerHeartbeat.set(playerId, now);
    }
  }
}
