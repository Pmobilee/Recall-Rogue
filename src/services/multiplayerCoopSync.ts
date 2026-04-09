/**
 * Co-op turn synchronization for Recall Rogue.
 *
 * In co-op mode, players share an enemy fight but each has their own HP.
 * Turn flow:
 *   1. Each player ends their turn locally (encounterBridge.handleEndTurn)
 *   2. encounterBridge sends `mp:coop:turn_end` and awaits consensus
 *   3. Once every player has signaled, BOTH clients run the enemy phase locally
 *      against their own enemy copy (deterministic via shared seed + enemyVariance fork)
 *   4. After the enemy applies damage to the local player, each client broadcasts
 *      its current HP via `mp:coop:partner_state` so the other player's HUD updates
 *
 * This module is intentionally tiny and stateless beyond the turn-end barrier.
 * It does NOT try to be host-authoritative for combat — each client runs its
 * own enemy locally. Determinism comes from the shared run seed.
 */

import { getMultiplayerTransport } from './multiplayerTransport';
import { getCurrentLobby, onLobbyUpdate } from './multiplayerLobbyService';

// ── Debug flag ────────────────────────────────────────────────────────────────

/** Set to true locally to enable verbose coop sync tracing. */
const DEBUG_COOP = false;

function coopLog(msg: string, ...args: unknown[]): void {
  if (DEBUG_COOP) console.log(`[coopSync] ${msg}`, ...args);
}

// ── State ────────────────────────────────────────────────────────────────────

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

export interface PartnerState {
  playerId: string;
  hp: number;
  maxHp: number;
  block: number;
  /** Current run score for this player, updated at turn-end. */
  score?: number;
  /** Current answer accuracy (0–1) for this player, updated at turn-end. */
  accuracy?: number;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Activate co-op sync for the current run. Subscribes to `mp:coop:turn_end`,
 * `mp:coop:turn_end_cancel`, and `mp:coop:partner_state` messages.
 */
export function initCoopSync(localPlayerId: string): void {
  destroyCoopSync();
  _localPlayerId = localPlayerId;
  _turnEndSignals = new Set();
  _partnerStates = {};

  coopLog('initCoopSync, localPlayerId=%s', localPlayerId);

  const transport = getMultiplayerTransport();
  const offTurnEnd = transport.on('mp:coop:turn_end', (msg) => {
    const { playerId } = msg.payload as { playerId: string };
    if (!playerId) return;
    coopLog('received turn_end from %s', playerId);
    _turnEndSignals.add(playerId);
    _maybeReleaseBarrier();
  });
  const offTurnEndCancel = transport.on('mp:coop:turn_end_cancel', (msg) => {
    const { playerId } = msg.payload as { playerId: string };
    if (!playerId) return;
    coopLog('received turn_end_cancel from %s', playerId);
    // Remote player cancelled their turn-end signal — remove them from the set.
    // The barrier will not release until they re-signal.
    _turnEndSignals.delete(playerId);
  });
  const offPartner = transport.on('mp:coop:partner_state', (msg) => {
    const state = msg.payload as unknown as PartnerState;
    coopLog('received partner_state from %s', state?.playerId);
    if (!state?.playerId || state.playerId === _localPlayerId) return;
    _partnerStates[state.playerId] = state;
    coopLog('firing partner state callbacks (%d subscribers)', _partnerStateSubs.size);
    const snapshot = { ..._partnerStates };
    for (const cb of _partnerStateSubs) {
      cb(snapshot);
    }
  });
  _cleanupListener = () => {
    offTurnEnd();
    offTurnEndCancel();
    offPartner();
  };
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
  if (_pendingBarrierResolve) {
    // Release any in-flight barrier so callers don't hang on teardown.
    _pendingBarrierResolve('completed');
    _pendingBarrierResolve = null;
  }
  _turnEndSignals = new Set();
  _localPlayerId = '';
  _partnerStates = {};
  _barrierExpectedPlayerCount = 0;
  // NOTE: _partnerStateSubs is NOT cleared here — consumer-owned subscriptions
  // have their own lifetime (callers hold the returned unsub function).
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Signal "I have ended my turn" to all players, then await consensus.
 *
 * Resolves `'completed'` when every player in the lobby has signaled.
 * Resolves `'cancelled'` if:
 *   - The local player calls `cancelCoopTurnEnd()` before consensus.
 *   - A partner leaves the lobby while we are waiting (prevents stranding).
 *
 * There is NO safety timeout — the barrier waits indefinitely for the partner.
 * If the partner disconnects, the lobby-leave event auto-cancels the barrier.
 *
 * If no lobby exists or only the local player is connected, resolves immediately.
 */
export function awaitCoopTurnEnd(): Promise<'completed' | 'cancelled'> {
  const lobby = getCurrentLobby();
  const players = lobby?.players ?? [];

  // Solo or no lobby → no barrier needed.
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

  // Otherwise wait for the barrier — no timeout; we rely on partner-leave event.
  return new Promise<'completed' | 'cancelled'>((resolve) => {
    _pendingBarrierResolve = (result: 'completed' | 'cancelled') => {
      _pendingBarrierResolve = null;
      _turnEndSignals = new Set();
      _barrierExpectedPlayerCount = 0;
      if (_cleanupLobbyListener) {
        _cleanupLobbyListener();
        _cleanupLobbyListener = null;
      }
      coopLog('barrier resolved: %s', result);
      resolve(result);
    };

    // Watch for partner leaving the lobby mid-barrier. If the lobby now has
    // fewer players than when the barrier started, cancel so the local player
    // isn't stranded waiting for a partner who will never signal.
    _cleanupLobbyListener = onLobbyUpdate((updatedLobby) => {
      if (!_pendingBarrierResolve) return;
      if (updatedLobby.players.length < _barrierExpectedPlayerCount) {
        coopLog('partner left lobby mid-barrier (%d→%d), cancelling', _barrierExpectedPlayerCount, updatedLobby.players.length);
        _pendingBarrierResolve('cancelled');
      }
    });
  });
}

/**
 * Cancel a pending turn-end signal. Removes local signal, broadcasts cancellation,
 * and resolves the in-flight `awaitCoopTurnEnd()` promise with `'cancelled'` so
 * the caller can restore turn control to the player.
 *
 * No-op if no barrier is in flight or no local player is set.
 */
export function cancelCoopTurnEnd(): void {
  if (!_localPlayerId) return;
  _turnEndSignals.delete(_localPlayerId);
  const transport = getMultiplayerTransport();
  transport.send('mp:coop:turn_end_cancel', { playerId: _localPlayerId });
  if (_pendingBarrierResolve) {
    const resolve = _pendingBarrierResolve;
    _pendingBarrierResolve = null;
    resolve('cancelled');
  }
}

/**
 * Returns true if the local player has signaled turn-end and is waiting for consensus.
 * Use this to guard UI state (e.g. show "Cancel" button while waiting).
 */
export function isLocalTurnEndPending(): boolean {
  return _pendingBarrierResolve !== null;
}

/**
 * Broadcast this player's current HP/maxHP/block/score/accuracy so peers' HUDs can update.
 * Call after damage is applied at end of turn.
 */
export function broadcastPartnerState(state: { hp: number; maxHp: number; block: number; score?: number; accuracy?: number }): void {
  if (!_localPlayerId) {
    coopLog('broadcastPartnerState called before initCoopSync — dropped');
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

/** Snapshot of all known partner states (excluding self). */
export function getPartnerStates(): Readonly<Record<string, PartnerState>> {
  return { ..._partnerStates };
}

/**
 * Subscribe to partner state changes.
 * Returns an unsubscribe function the caller must invoke on cleanup.
 *
 * Multi-subscriber: multiple callers can coexist; each gets an independent
 * unsubscribe without affecting other subscribers.
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

// ── Internal ─────────────────────────────────────────────────────────────────

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
