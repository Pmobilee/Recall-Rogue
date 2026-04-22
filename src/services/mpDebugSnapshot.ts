/**
 * mpDebugSnapshot.ts — clipboard-ready MP debug dump (MP-STEAM-AUDIT-2026-04-22-M-024)
 *
 * Player-facing bug reports for multiplayer arrive without `__rrMpDebug()` output —
 * the dev-console snapshot exists (mpDebugState.ts:114) but Steam users do not
 * open devtools. This module exposes:
 *
 *   - `formatMpDebugSnapshot(state)` — pure, deterministic formatter (testable)
 *   - `copyMpDebugSnapshotToClipboard()` — runtime helper a UI button can call
 *
 * UI WIRING (handed to ui-agent):
 * In the multiplayer lobby panel (when `mpLobbyActive`), add a small button:
 *
 *   ```svelte
 *   <button class="btn-debug-snapshot" onclick={async () => {
 *     const { copyMpDebugSnapshotToClipboard } = await import('../../services/mpDebugSnapshot');
 *     const ok = await copyMpDebugSnapshotToClipboard();
 *     toast(ok ? 'MP debug snapshot copied' : 'Copy failed — open devtools');
 *   }}>Copy MP Debug Snapshot</button>
 *   ```
 *
 * The button should be visible whenever a multiplayer lobby exists OR when the
 * player is in an active multiplayer run. Place near the "Leave Lobby" button
 * so it's reachable from any MP-related screen.
 *
 * Scoping note: this file lives in src/services/ rather than src/ui/ so that
 * unit tests can import it without pulling Svelte runtime — matches the pattern
 * used by mpDebugState.ts itself.
 */

// Reuses the existing __rrMpState shape from mpDebugState.ts. Kept as a
// structural type so this module stays self-contained for testing.
export interface MpDebugSnapshotInput {
  lobby: unknown;
  transport: unknown;
  steam: unknown;
  lan: unknown;
  updatedAt: string;
  recentMessages?: Array<{ type: string; payload?: unknown; timestamp?: number; senderId?: string }>;
}

/**
 * Format an MP debug state into a self-contained markdown block suitable for
 * pasting into a Discord / Steam Forum / GitHub bug report. Includes a header
 * with timestamp + build version (when available) and a fenced JSON dump.
 *
 * Pure function — no side effects, no DOM access — safe to unit-test.
 */
export function formatMpDebugSnapshot(
  state: MpDebugSnapshotInput | null | undefined,
  buildVersion?: string,
): string {
  const ts = new Date().toISOString();
  const version = buildVersion ?? 'unknown';
  if (!state) {
    return [
      '## Recall Rogue — MP debug snapshot',
      `- Captured: ${ts}`,
      `- Build:    ${version}`,
      '',
      '_No MP state — `window.__rrMpState` is undefined. The player is likely',
      'not in a multiplayer lobby, or the MP debug instrumentation never initialized._',
    ].join('\n');
  }

  // Truncate recentMessages to last 20 to keep the paste manageable.
  const trimmed: MpDebugSnapshotInput = {
    ...state,
    recentMessages: Array.isArray(state.recentMessages)
      ? state.recentMessages.slice(-20)
      : undefined,
  };

  let json: string;
  try {
    json = JSON.stringify(trimmed, null, 2);
  } catch (e) {
    json = `// JSON.stringify failed: ${String(e)}\n${String(trimmed)}`;
  }

  return [
    '## Recall Rogue — MP debug snapshot',
    `- Captured: ${ts}`,
    `- Build:    ${version}`,
    `- State at: ${state.updatedAt}`,
    '',
    '```json',
    json,
    '```',
  ].join('\n');
}

/**
 * Read the live MP state from `window.__rrMpState` and copy a formatted
 * snapshot to the clipboard. Returns `true` on success, `false` if either the
 * MP state is missing OR the Clipboard API is unavailable / denied.
 *
 * The UI caller is responsible for surfacing success/failure to the player
 * (toast, button label flash, etc.).
 */
export async function copyMpDebugSnapshotToClipboard(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Read the global state set by mpDebugState.ts. Cast through unknown to keep
  // this module independent of the publishMpState write path.
  const state = (window as unknown as { __rrMpState?: MpDebugSnapshotInput }).__rrMpState ?? null;

  // Try to surface the running app version when present (Tauri / Vite both
  // expose it as an env at build time).
  const buildVersion = (() => {
    try {
      // Vite injects import.meta.env.VITE_APP_VERSION when the .env defines it.
      // Fall back to APP_VERSION if a global was set.
      const viteVer = (import.meta as { env?: Record<string, string> }).env?.VITE_APP_VERSION;
      if (viteVer) return viteVer;
      const winVer = (window as unknown as { __APP_VERSION__?: string }).__APP_VERSION__;
      return winVer;
    } catch {
      return undefined;
    }
  })();

  const text = formatMpDebugSnapshot(state, buildVersion);

  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    // eslint-disable-next-line no-console
    console.info('[mpDebugSnapshot] copied snapshot to clipboard', { bytes: text.length });
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[mpDebugSnapshot] clipboard write failed:', e);
    return false;
  }
}
