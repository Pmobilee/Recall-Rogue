/**
 * Pipe JavaScript diagnostic lines into the same file logger that captures the
 * Rust `println!` / `eprintln!` stream (`~/Library/Logs/Recall Rogue/debug.log`
 * on macOS, `%LocalAppData%/Recall Rogue/debug.log` on Windows).
 *
 * Why: Steam-launched macOS apps drop stdout to /dev/null and JS console output
 * never lands anywhere the player can read. Without this bridge, multiplayer
 * diagnostics were only visible if devtools were open — which they aren't in
 * release builds. This helper gets called from every hot-path in the lobby /
 * transport / UI layer, so the full forensic timeline of a multiplayer session
 * ends up in one file.
 */

let _tauriAvailable: boolean | null = null;
function isTauri(): boolean {
  if (_tauriAvailable !== null) return _tauriAvailable;
  _tauriAvailable = typeof window !== 'undefined' &&
    !!((window as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }).__TAURI_INTERNALS__ ||
       (window as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }).__TAURI__);
  return _tauriAvailable;
}

/**
 * Emit a diagnostic line to both the browser console (visible via devtools
 * when enabled) AND the Rust debug.log file (always visible, even in the
 * packaged Steam build).
 *
 * The Rust-side write uses a fire-and-forget Tauri invoke — a lost log line
 * never blocks or throws on the caller's hot path.
 *
 * @param tag   Short identifier for the subsystem emitting the log, e.g. "mp:lobby".
 * @param msg   Human-readable message.
 * @param data  Optional structured data; serialized to JSON and appended.
 */
export function rrLog(tag: string, msg: string, data?: unknown): void {
  let payload = msg;
  if (data !== undefined) {
    try {
      payload = `${msg} ${JSON.stringify(data)}`;
    } catch {
      payload = `${msg} [unserializable data]`;
    }
  }
  // Console first — zero overhead in Node/dev, useful if devtools are on.
  console.log(`[${tag}] ${payload}`);
  if (!isTauri()) return;
  void (async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('rr_log', { tag, line: payload });
    } catch {
      // Swallow — log bridge failure must never crash the caller.
    }
  })();
}
