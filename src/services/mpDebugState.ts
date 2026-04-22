/**
 * mpDebugState — shared window state publisher for MpDebugOverlay.
 *
 * Owns the shape of `window.__rrMpState`. Any service layer that wants to
 * expose multiplayer diagnostics writes here. The Svelte overlay reads it on a
 * 1 s polling interval.
 *
 * Usage:
 *   import { setMpDebugState } from './mpDebugState'
 *   setMpDebugState({ lobby: { id: '...', mode: 'race', playerCount: 2 } })
 *
 * The overlay (`MpDebugOverlay.svelte`) reads `window.__rrMpState` directly.
 * This module is the authoritative writer — nothing else should assign
 * `window.__rrMpState` directly.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MpDebugLobbyState {
  id: string;
  code: string | undefined;
  mode: string;
  deckSelectionMode: string | undefined;
  playerCount: number;
  contentSelectionType: string | null;
  contentDecksLength: number | null;
}

export interface MpDebugTransportState {
  state: string;
  peerId: string;
  preConnectBufferSize: number;
  lastSendResult: string | null;
  lastError: string | null;
}

export interface MpDebugSteamState {
  localSteamId: string | null;
  localPlayerId: string;
  p2pConnectionState: string | null;
  /** BUG6: Latest session state from periodic poll (same value as p2pConnectionState, exposed separately for overlay queries). */
  sessionState?: string | null;
}

export interface MpDebugLanState {
  boundUrl: string | null;
  lastProbeResult: string | null;
  lastError: string | null;
}

/**
 * Full shape of `window.__rrMpState`.
 * All fields are optional so the overlay degrades gracefully when
 * the service layer hasn't published yet.
 */
export interface MpDebugState {
  lobby: MpDebugLobbyState | null;
  transport: MpDebugTransportState | null;
  steam: MpDebugSteamState | null;
  lan: MpDebugLanState | null;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

// ── Window augmentation ───────────────────────────────────────────────────────

declare global {
  interface Window {
    __rrMpState?: MpDebugState;
  }
}

// ── Writer API ────────────────────────────────────────────────────────────────

/**
 * Merge a partial state update into `window.__rrMpState`.
 *
 * Safe to call from any service. Performs a shallow merge so callers can
 * update one section without clobbering the rest.
 */
export function setMpDebugState(partial: Partial<Omit<MpDebugState, 'updatedAt'>>): void {
  if (typeof window === 'undefined') return;
  window.__rrMpState = {
    lobby: null,
    transport: null,
    steam: null,
    lan: null,
    ...window.__rrMpState,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Read the current `window.__rrMpState`, returning a safe default when absent.
 */
export function getMpDebugState(): MpDebugState {
  if (typeof window === 'undefined') {
    return { lobby: null, transport: null, steam: null, lan: null, updatedAt: '–' };
  }
  return window.__rrMpState ?? {
    lobby: null,
    transport: null,
    steam: null,
    lan: null,
    updatedAt: '–',
  };
}

// BUG20: Console dump helper — type window.__rrMpDebug() in devtools for a
// one-shot snapshot of the full multiplayer debug state.
if (typeof window !== 'undefined') {
  (window as any).__rrMpDebug = () => {
    const state = (window as any).__rrMpState;
    // eslint-disable-next-line no-console
    console.log('[rrMpDebug]', JSON.stringify(state, null, 2));
    return state;
  };
}
