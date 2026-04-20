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

// ── Types ──────────────────────────────────────────────────────────────────────

/** Returned by `startLanServer` on success. */
export interface LanStartResult {
  /** Actual port the server is bound to. */
  port: number;
  /** All non-loopback IPv4 addresses on this machine. */
  localIps: string[];
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
 * Returns the port the server is bound to and all local IPv4 addresses
 * the server is reachable on. Other players on the same LAN can connect
 * to any of those IPs on the returned port.
 *
 * Returns null on non-Tauri platforms. Safe to call from any context.
 *
 * A 10-second timeout is applied — if `lan_start_server` does not return
 * within that window (e.g. port bind failure causes a tokio task hang),
 * null is returned and the caller's existing error path fires.
 *
 * @param port - Port to bind on (default chosen by Rust backend, typically 19738)
 */
export async function startLanServer(port?: number): Promise<LanStartResult | null> {
  const args: Record<string, unknown> = {};
  if (port !== undefined) args['port'] = port;

  const invokePromise = tauriInvoke<LanStartResult>('lan_start_server', args);
  const timeoutPromise = new Promise<null>(resolve =>
    setTimeout(() => resolve(null), LAN_START_TIMEOUT_MS),
  );

  const result = await Promise.race([invokePromise, timeoutPromise]);
  if (result === null) {
    console.warn('[LanServer] startLanServer timed out or returned null — isTauriRuntime():', isTauriRuntime());
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
  await tauriInvoke<void>('lan_stop_server');
}

/**
 * Get the current LAN server status.
 *
 * Returns `{ running: false, port: null }` on non-Tauri platforms.
 */
export async function getLanServerStatus(): Promise<LanServerStatus> {
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
