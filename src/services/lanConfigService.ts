/**
 * LAN server URL configuration service.
 *
 * Allows players (or developers) to point the game at a local Fastify MP
 * server running on the same LAN segment.  The chosen URL is persisted in
 * localStorage so it survives page reloads without requiring a build-time
 * env variable.
 *
 * When LAN mode is active:
 *   - multiplayerTransport.ts routes createTransport() → WebSocketTransport
 *     (skipping Steam P2P even on a Tauri/Steam build).
 *   - multiplayerLobbyService.ts routes pickBackend() → webBackend and
 *     getWebApiBaseUrl() → the stored apiUrl (skipping VITE_MP_API_URL).
 *
 * This service has zero dependencies on other game services so it can be
 * imported by any layer without creating circular-dependency risk.
 */

/** localStorage key used to persist the LAN server config. */
const STORAGE_KEY = 'rr-lan-server';

// ── Types ─────────────────────────────────────────────────────────────────────

/** URLs for a LAN-hosted Fastify MP server. */
export interface LanServerConfig {
  /** WebSocket endpoint, e.g. `ws://192.168.1.5:19738/mp/ws`. */
  wsUrl: string;
  /** REST API base URL, e.g. `http://192.168.1.5:19738`. */
  apiUrl: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** True when localStorage is available (server-side / Node test guard). */
function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

/** Build a LanServerConfig from host + port without any trailing slashes. */
function buildConfig(host: string, port: number): LanServerConfig {
  // Normalise host: strip any accidental trailing slash or scheme so callers
  // can pass either `192.168.1.5` or `http://192.168.1.5`.
  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return {
    wsUrl: `ws://${cleanHost}:${port}/mp/ws`,
    apiUrl: `http://${cleanHost}:${port}`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persist a LAN server URL derived from the given host and port.
 *
 * After calling this, `isLanMode()` returns true and both transport and lobby
 * service will route traffic to the specified server on next connection.
 *
 * @param host - IP address or hostname of the LAN server (no scheme needed).
 * @param port - Port the Fastify MP server is listening on.
 */
export function setLanServerUrl(host: string, port: number): void {
  if (!hasStorage()) return;
  const config = buildConfig(host, port);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Return the currently configured LAN server URLs, or null when not in LAN mode.
 *
 * Reads and parses localStorage on every call — intentionally lightweight so
 * callers can invoke this from connection hot-paths without caching concerns.
 */
export function getLanServerUrls(): LanServerConfig | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LanServerConfig;
    // Validate the shape minimally — both fields must be non-empty strings.
    if (typeof parsed.wsUrl !== 'string' || typeof parsed.apiUrl !== 'string') return null;
    if (!parsed.wsUrl || !parsed.apiUrl) return null;
    return parsed;
  } catch {
    // Corrupt entry — silently clear it so we don't get stuck.
    clearLanServerUrl();
    return null;
  }
}

/**
 * Remove the LAN server config from localStorage, reverting to normal mode.
 *
 * After calling this, `isLanMode()` returns false and the transport/lobby
 * service will use their default URL resolution logic (env vars, Steam, etc.).
 */
export function clearLanServerUrl(): void {
  if (!hasStorage()) return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * True when a LAN server URL is currently stored and will be used for the
 * next multiplayer connection.
 */
export function isLanMode(): boolean {
  return getLanServerUrls() !== null;
}
