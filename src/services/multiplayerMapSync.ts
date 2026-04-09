/**
 * Map node consensus for multiplayer modes that share a map (co-op, same cards, race).
 *
 * In co-op especially, both players must agree on the next room before either
 * actually transitions. Each click broadcasts an `mp:map:node_pick` message;
 * when every connected player has picked the SAME node, a callback fires that
 * commits the selection locally on each client.
 *
 * Picking a different node before consensus simply replaces the previous pick.
 * Resetting (e.g. after a room is committed) clears all picks for the next round.
 *
 * No Phaser, no DOM, no Svelte imports. Pure TypeScript so it can be unit tested.
 */

import { getMultiplayerTransport } from './multiplayerTransport';
import { getCurrentLobby } from './multiplayerLobbyService';

// ── State ────────────────────────────────────────────────────────────────────

/** Map of playerId → currently picked nodeId (null if not yet picked). */
let _picks: Record<string, string | null> = {};

/** Local player's stable ID, captured at init. */
let _localPlayerId: string = '';

/** Callback fired when all players have picked the same node. */
let _onConsensus: ((nodeId: string) => void) | null = null;

/** Callback fired whenever picks change so the UI can re-render badges. */
let _onPicksChanged: ((picks: Readonly<Record<string, string | null>>) => void) | null = null;

/** Cleanup function for the transport listener. Null when not active. */
let _cleanupListener: (() => void) | null = null;

// ── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Activate map node consensus for the current run. Subscribes to incoming
 * `mp:map:node_pick` messages and seeds the picks map from the lobby roster.
 *
 * @param localPlayerId - This client's stable player ID.
 */
export function initMapNodeSync(localPlayerId: string): void {
  destroyMapNodeSync();
  _localPlayerId = localPlayerId;
  _picks = {};

  const lobby = getCurrentLobby();
  if (lobby) {
    for (const p of lobby.players) {
      _picks[p.id] = null;
    }
  } else {
    _picks[localPlayerId] = null;
  }

  const transport = getMultiplayerTransport();
  _cleanupListener = transport.on('mp:map:node_pick', (msg) => {
    const { playerId, nodeId } = msg.payload as { playerId: string; nodeId: string | null };
    if (!playerId) return;
    _picks[playerId] = nodeId ?? null;
    _notifyPicksChanged();
    _checkConsensus();
  });
}

/** Tear down the consensus subscription. Safe to call multiple times. */
export function destroyMapNodeSync(): void {
  if (_cleanupListener) {
    _cleanupListener();
    _cleanupListener = null;
  }
  _picks = {};
  _localPlayerId = '';
  // NOTE: Do NOT null _onConsensus / _onPicksChanged here. Those are
  // long-lived UI subscriptions owned by the consumer (CardApp), set up
  // once at component mount via onMapNodeConsensus / onMapNodePicksChanged,
  // and MUST persist across re-init cycles — initMapNodeSync() calls
  // destroyMapNodeSync() at its start on every run/encounter boundary.
  // Subscribers clear themselves via the unsubscribe functions returned
  // from those registration APIs when the consumer unmounts.
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Local player picks a node. Broadcasts the pick to peers and re-evaluates
 * consensus. Pass `null` to clear this player's pick (e.g. on cancel).
 */
export function pickMapNode(nodeId: string | null): void {
  if (!_localPlayerId) return;
  _picks[_localPlayerId] = nodeId;
  _notifyPicksChanged();

  const transport = getMultiplayerTransport();
  transport.send('mp:map:node_pick', {
    playerId: _localPlayerId,
    nodeId,
  });

  _checkConsensus();
}

/**
 * Reset all picks for the next selection round. Called after a node has been
 * committed (e.g. after the room transition completes) so the UI clears badges.
 */
export function resetMapNodePicks(): void {
  for (const id of Object.keys(_picks)) {
    _picks[id] = null;
  }
  _notifyPicksChanged();
}

/** Snapshot of current picks (frozen, safe to pass to UI). */
export function getMapNodePicks(): Readonly<Record<string, string | null>> {
  return { ..._picks };
}

/**
 * Subscribe to consensus events. The callback fires once when all players in
 * the picks map have selected the SAME nodeId (and at least one player exists).
 */
export function onMapNodeConsensus(cb: (nodeId: string) => void): () => void {
  _onConsensus = cb;
  return () => { _onConsensus = null; };
}

/** Subscribe to pick changes so the UI can re-render badges immediately. */
export function onMapNodePicksChanged(
  cb: (picks: Readonly<Record<string, string | null>>) => void,
): () => void {
  _onPicksChanged = cb;
  return () => { _onPicksChanged = null; };
}

// ── Internal ─────────────────────────────────────────────────────────────────

function _notifyPicksChanged(): void {
  _onPicksChanged?.({ ..._picks });
}

function _checkConsensus(): void {
  const ids = Object.keys(_picks);
  if (ids.length === 0) return;
  const first = _picks[ids[0]];
  if (!first) return;
  for (let i = 1; i < ids.length; i++) {
    if (_picks[ids[i]] !== first) return;
  }
  // Consensus reached.
  _onConsensus?.(first);
}
