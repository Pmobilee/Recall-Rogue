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
import { getCurrentLobby } from './multiplayerLobbyService';

// ── State ────────────────────────────────────────────────────────────────────

/** Players who have signaled "turn ended" for the current barrier. */
let _turnEndSignals: Set<string> = new Set();

/** Local player's stable ID, captured at init. */
let _localPlayerId: string = '';

/** Resolver for the current pending barrier promise (null if none in flight). */
let _pendingBarrierResolve: ((result: 'completed' | 'cancelled') => void) | null = null;

/** Cleanup for transport listener. Null when not active. */
let _cleanupListener: (() => void) | null = null;

/** Latest known partner HP/maxHP/block, keyed by playerId. */
let _partnerStates: Record<string, PartnerState> = {};

/** Callback fired when partner state arrives (UI hooks here). */
let _onPartnerStateChange: ((states: Readonly<Record<string, PartnerState>>) => void) | null = null;

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

  const transport = getMultiplayerTransport();
  const offTurnEnd = transport.on('mp:coop:turn_end', (msg) => {
    const { playerId } = msg.payload as { playerId: string };
    if (!playerId) return;
    _turnEndSignals.add(playerId);
    _maybeReleaseBarrier();
  });
  const offTurnEndCancel = transport.on('mp:coop:turn_end_cancel', (msg) => {
    const { playerId } = msg.payload as { playerId: string };
    if (!playerId) return;
    // Remote player cancelled their turn-end signal — remove them from the set.
    // The barrier will not release until they re-signal.
    _turnEndSignals.delete(playerId);
  });
  const offPartner = transport.on('mp:coop:partner_state', (msg) => {
    const state = msg.payload as unknown as PartnerState;
    if (!state?.playerId || state.playerId === _localPlayerId) return;
    _partnerStates[state.playerId] = state;
    _onPartnerStateChange?.({ ..._partnerStates });
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
  if (_pendingBarrierResolve) {
    // Release any in-flight barrier so callers don't hang on teardown.
    _pendingBarrierResolve('completed');
    _pendingBarrierResolve = null;
  }
  _turnEndSignals = new Set();
  _localPlayerId = '';
  _partnerStates = {};
  _onPartnerStateChange = null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Signal "I have ended my turn" to all players, then await consensus.
 * Resolves `'completed'` when every player in the lobby has signaled (or after `timeoutMs`).
 * Resolves `'cancelled'` if the local player calls `cancelCoopTurnEnd()` before consensus.
 *
 * If no lobby exists or only the local player is connected, resolves immediately.
 */
export function awaitCoopTurnEnd(timeoutMs = 30_000): Promise<'completed' | 'cancelled'> {
  const lobby = getCurrentLobby();
  const players = lobby?.players ?? [];

  // Solo or no lobby → no barrier needed.
  if (players.length <= 1 || !_localPlayerId) {
    return Promise.resolve('completed');
  }

  // Mark self and broadcast.
  _turnEndSignals.add(_localPlayerId);
  const transport = getMultiplayerTransport();
  transport.send('mp:coop:turn_end', { playerId: _localPlayerId });

  // If we already have everyone (e.g. partner finished first), resolve fast.
  if (_allPlayersSignaled()) {
    _turnEndSignals = new Set();
    return Promise.resolve('completed');
  }

  // Otherwise wait for the barrier with a safety timeout.
  return new Promise<'completed' | 'cancelled'>((resolve) => {
    const timer = setTimeout(() => {
      console.warn('[multiplayerCoopSync] Turn-end barrier timeout — proceeding anyway');
      _pendingBarrierResolve = null;
      _turnEndSignals = new Set();
      resolve('completed');
    }, timeoutMs);
    _pendingBarrierResolve = (result: 'completed' | 'cancelled') => {
      clearTimeout(timer);
      _pendingBarrierResolve = null;
      _turnEndSignals = new Set();
      resolve(result);
    };
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
  if (!_localPlayerId) return;
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

/** Subscribe to partner state changes. Returns an unsubscribe function. */
export function onPartnerStateUpdate(
  cb: (states: Readonly<Record<string, PartnerState>>) => void,
): () => void {
  _onPartnerStateChange = cb;
  return () => { _onPartnerStateChange = null; };
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
