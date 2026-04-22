/**
 * LAN Server Service — Tauri command wrappers for the embedded LAN server.
 *
 * Wraps Tauri IPC commands for starting/stopping the native embedded server
 * that hosts LAN multiplayer sessions. All functions are safe to call on
 * non-Tauri platforms (web, mobile) — they return null/false/empty gracefully.
 *
 * The Rust backend exposes four commands:
 *   lan_start_server   — start the embedded Fastify-equivalent LAN relay
 *   lan_stop_server    — stop it
 *   lan_server_status  — query running state
 *   lan_get_local_ips  — enumerate non-loopback IPv4 addresses
 */

// ── Imports ──────────────────────────────────────────────────────────────────────
import { setMpDebugState } from './mpDebugState';
import { rrLog } from './rrLog';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Returned by `startLanServer` on success. */
export interface LanStartResult {
  /** Actual port the server is bound to. */
  port: number;
  /** Routable local addresses the server is reachable on (never 0.0.0.0). */
  localIps: string[];
  /**
   * M1: The actual URL other players should use to connect, e.g.
   * `"http://192.168.1.42:19738"`. Derived from the first routable NIC.
   * Falls back to `"http://127.0.0.1:<port>"` when no LAN NIC is found.
   */
  lanServerUrl: string;
  /**
   * M1: Set to `"local-only"` when the server fell back to 127.0.0.1 because
   * no routable network interface was available. When present, the UI should
   * warn the player that remote peers cannot connect.
   * Absent (undefined) for normal LAN binds.
   */
  warning?: 'local-only' | string;
  /**
   * Extra — macOS: Short hint to show when LAN binds on macOS so players know to check
   * System Settings → Privacy & Security → Local Network if guests cannot connect.
   * Only populated on macOS builds. Display as a dismissible toast.
   */
  macosPermissionHint?: string;
}

/** Returned by `getLanServerStatus`. */
export interface LanServerStatus {
  /** Whether the embedded LAN server is currently running. */
  running: boolean;
  /** Port the server is bound to, or null if not running. */
  port: number | null;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if we are currently running inside a Tauri runtime.
 *
 * Uses a live check against window globals rather than the module-load-time
 * `isDesktop` snapshot from platformService. This avoids the packaging race
 * where `__TAURI_INTERNALS__` is injected after the ESM bundle evaluates and
 * the snapshot stays stale-false for the session (see docs/gotchas.md
 * 2026-04-20 "Tauri v2 platform detection: module-load IIFE snapshot stale").
 *
 * Mirrors the identical pattern in `steamNetworkingService.ts:68-72`.
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

/**
 * M-023: Returns true when we are inside a Steam release build where LAN mode is
 * NOT explicitly opted in (i.e. no ?lan=1 URL param). In this context, LAN server
 * start/stop/scan functions are compile-out no-ops — LAN multiplayer is not a
 * supported path in the Steam release unless the user explicitly forces it via
 * the ?lan=1 flag.
 *
 * Conditions (mirrors pickBackend() logic in multiplayerLobbyService):
 *   isTauriRuntime() && no ?mp broadcast flag && no ?lan=1 explicit opt-in
 */
function _isSteamBuild(): boolean {
  if (!isTauriRuntime()) return false;
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  // ?mp = broadcast dev mode — not a Steam release context
  if (params.has('mp')) return false;
  // ?lan=1 = explicit LAN opt-in for Steam-build testing — allow LAN in this case
  if (params.has('lan')) return false;
  return true;
}

/**
 * M-023: True when LAN server features should be gated (Steam release build without
 * explicit ?lan=1 opt-in). Set once when the module loads.
 */
const LAN_DISABLED_IN_STEAM = _isSteamBuild();

// ── Internal Tauri IPC helper ──────────────────────────────────────────────────

/**
 * Thin wrapper around Tauri `invoke` that:
 *  - Dynamically imports `@tauri-apps/api/core` (safe in non-Tauri builds)
 *  - Returns `null` and logs a warning on any failure
 *  - Short-circuits on non-Tauri platforms via a live runtime check
 *
 * Uses a live `isTauriRuntime()` check rather than the module-load-time
 * `isDesktop` constant so packaged Steam builds (where the Tauri global may
 * land after the bundle evaluates) are handled correctly.
 *
 * @param cmd  Tauri command name (snake_case, matches Rust side).
 * @param args Optional args. Tauri v2 auto-translates camelCase keys to
 *             snake_case before Rust dispatch — pass camelCase from JS.
 */
async function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  const isTauri = isTauriRuntime();
  if (!isTauri) {
    console.warn(`[LanServer] invoke '${cmd}' skipped — isTauriRuntime()=false (not a Tauri build or globals not yet injected)`);
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`[LanServer] invoke '${cmd}' failed:`, e);
    return null;
  }
}

/** Milliseconds before `startLanServer` gives up waiting for the Rust command. */
const LAN_START_TIMEOUT_MS = 10_000;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the embedded LAN server (Tauri desktop only).
 *
 * M1: Returns `lanServerUrl` — the actual URL derived from the first routable NIC,
 * not 0.0.0.0. When `warning === "local-only"` the server is only reachable on this
 * machine (no LAN NIC found) and the UI should inform the player.
 *
 * Returns null on non-Tauri platforms. Safe to call from any context.
 *
 * A 10-second timeout is applied — if `lan_start_server` does not return
 * within that window (e.g. port bind failure causes a tokio task hang),
 * null is returned and the caller's existing error path fires.
 *
 * @param port - Port to bind on (default chosen by Rust backend, typically 19738)
 */
/**
 * B1: Internal invoke that throws with the real Rust error string rather than
 * returning null. Used only by startLanServer so bind failures (port in use,
 * permission denied) reach the UI instead of collapsing to a generic message.
 */
async function tauriInvokeOrThrow<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error('LAN server requires the desktop app (Tauri runtime not detected).');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function startLanServer(port?: number): Promise<LanStartResult | null> {
  if (!isTauriRuntime()) return null;
  // M-023: LAN server is disabled in Steam builds unless explicitly opted in via ?lan=1.
  if (LAN_DISABLED_IN_STEAM) {
    rrLog('mp:lan', 'LAN disabled in Steam build', { fn: 'startLanServer' });
    return null;
  }
  const args: Record<string, unknown> = {};
  if (port !== undefined) args['port'] = port;

  // B1: Use a throwing invoke so bind errors (port in use, permission denied)
  // propagate up to the caller instead of collapsing to null. The Promise.race
  // timeout guard is preserved — a hang still surfaces as a rejection.
  const invokePromise = tauriInvokeOrThrow<LanStartResult>('lan_start_server', args);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('LAN server start timed out after 10 seconds')), LAN_START_TIMEOUT_MS),
  );

  const result = await Promise.race([invokePromise, timeoutPromise]);
  // BUG19: Publish LAN running state to the debug overlay as soon as the server starts.
  setMpDebugState({
    lan: {
      boundUrl: result.lanServerUrl ?? null,
      lastProbeResult: null,
      lastError: result.warning === 'local-only' ? 'local-only: no routable NIC found' : null,
    },
  });
  if (result.warning === 'local-only') {
    console.warn('[LanServer] Server bound to localhost only — remote players cannot connect. lanServerUrl:', result.lanServerUrl);
  }
  // Extra: On macOS, inject the Local Network permission hint so the UI can show it.
  // The Rust side already logs this to debug.log; this makes it actionable in the UI.
  // Note: we detect macOS via navigator.platform (userAgent fallback). This hint is
  // informational-only; false positives on non-macOS are harmless.
  if (typeof navigator !== 'undefined' && /Mac|darwin/i.test(navigator.platform || navigator.userAgent)) {
    result.macosPermissionHint =
      "LAN server running. If friends can't connect, check System Settings → Privacy & Security → Local Network and make sure Recall Rogue is allowed.";
  }
  return result;
}

/**
 * Stop the embedded LAN server.
 *
 * No-op on non-Tauri platforms. Safe to call even if the server
 * was never started — the Rust backend ignores stop-when-idle.
 */
export async function stopLanServer(): Promise<void> {
  if (LAN_DISABLED_IN_STEAM) {
    rrLog('mp:lan', 'LAN disabled in Steam build', { fn: 'stopLanServer' });
    return;
  }
  await tauriInvoke<void>('lan_stop_server');
  // BUG19: Clear LAN state from the debug overlay.
  setMpDebugState({ lan: null });
}

/**
 * Get the current LAN server status.
 *
 * Returns `{ running: false, port: null }` on non-Tauri platforms.
 */
export async function getLanServerStatus(): Promise<LanServerStatus> {
  if (LAN_DISABLED_IN_STEAM) {
    rrLog('mp:lan', 'LAN disabled in Steam build', { fn: 'getLanServerStatus' });
    return { running: false, port: null };
  }
  const result = await tauriInvoke<LanServerStatus>('lan_server_status');
  return result ?? { running: false, port: null };
}

/**
 * Get all non-loopback IPv4 addresses on this machine.
 *
 * Used by the LAN discovery scanner to determine which /24 subnets
 * to probe. Returns an empty array on web/mobile (no Tauri IPC).
 *
 * Example return: `['192.168.1.42', '10.0.0.5']`
 */
export async function getLocalIps(): Promise<string[]> {
  const result = await tauriInvoke<string[]>('lan_get_local_ips');
  return result ?? [];
}
