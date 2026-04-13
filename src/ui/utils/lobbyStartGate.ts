/**
 * lobbyStartGate.ts
 *
 * Pure predicate for whether the host may start a multiplayer lobby game.
 * Extracted from MultiplayerLobby.svelte so it can be unit-tested without
 * mounting a Svelte component.
 *
 * Rules (AND):
 *  1. The local player IS the host.
 *  2. At least 2 players are present.
 *  3. All players have marked themselves ready.
 *  4. Content has been selected (lobby.contentSelection is not null/undefined).
 */

import type { LobbyState } from '../../data/multiplayerTypes'

/**
 * Returns true when the host is allowed to press "Start Game".
 *
 * @param lobby   - Current lobby state (from multiplayerLobbyService).
 * @param amHost  - Whether the local player is the lobby host.
 */
export function canStartLobby(lobby: Pick<LobbyState, 'players' | 'contentSelection'>, amHost: boolean): boolean {
  if (!amHost) return false
  if (lobby.players.length < 2) return false
  if (!lobby.players.every(p => p.isReady)) return false
  if (!lobby.contentSelection) return false
  return true
}

/**
 * Returns a label for the Start button reflecting the current gate state.
 *
 * @param lobby   - Current lobby state.
 * @param amHost  - Whether the local player is the lobby host.
 */
export function startButtonLabel(lobby: Pick<LobbyState, 'players' | 'contentSelection'>, amHost: boolean): string {
  if (!amHost) return 'Waiting for host...'
  if (!lobby.contentSelection) return 'Choose Content First'
  if (!lobby.players.every(p => p.isReady)) return 'Waiting for players...'
  return 'Start Game'
}
