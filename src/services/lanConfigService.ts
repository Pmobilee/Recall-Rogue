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

/** Result of `validatePrivateNetworkAddress`. */
export type AddressValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

// ── Private-network validation (M21) ─────────────────────────────────────────

/**
 * Validate that `ip` is a private-network address acceptable as a LAN server host.
 *
 * Accepted ranges:
 *   IPv4:
 *     127.0.0.0/8    — loopback (localhost dev)
 *     10.0.0.0/8     — RFC1918 Class A private
 *     172.16.0.0/12  — RFC1918 Class B private (172.16–172.31)
 *     192.168.0.0/16 — RFC1918 Class C private
 *     169.254.0.0/16 — link-local (APIPA / Zeroconf)
 *   IPv6:
 *     ::1            — loopback
 *     fe80::/10      — link-local
 *     fc00::/7       — ULA (fc00:: and fd00:: prefixes)
 *
 * Rejected:
 *   - Public IPv4 addresses
 *   - Global unicast IPv6 addresses
 *   - Malformed input
 *
 * The function does NOT validate the port — port validation is the caller's
 * responsibility (1–65535 range).
 */
export function validatePrivateNetworkAddress(ip: string): AddressValidationResult {
  if (!ip || typeof ip !== 'string') {
    return { ok: false, reason: 'IP address must be a non-empty string' };
  }

  const cleaned = ip.trim();
  if (!cleaned) {
    return { ok: false, reason: 'IP address must not be blank' };
  }

  // ── IPv6 ──────────────────────────────────────────────────────────────────

  if (cleaned.includes(':')) {
    const lower = cleaned.toLowerCase();

    // ::1 — IPv6 loopback
    if (lower === '::1') return { ok: true };

    // fe80::/10 — link-local (first hextet fe80..febf)
    const firstHextet = parseInt(lower.split(':')[0] || 'ffff', 16);
    if (!isNaN(firstHextet) && firstHextet >= 0xfe80 && firstHextet <= 0xfebf) {
      return { ok: true };
    }

    // fc00::/7 — ULA (fc00:: through fdff::)
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      return { ok: true };
    }

    return {
      ok: false,
      reason: 'LAN server IP must be a private-network address (use 192.168.x.x, 10.x.x.x, 172.16-31.x.x, or IPv6 ULA/link-local)',
    };
  }

  // ── IPv4 ──────────────────────────────────────────────────────────────────

  const parts = cleaned.split('.');
  if (parts.length !== 4) {
    return { ok: false, reason: `Malformed IPv4 address: "${cleaned}"` };
  }

  const octets = parts.map(p => parseInt(p, 10));
  if (octets.some(o => isNaN(o) || o < 0 || o > 255)) {
    return { ok: false, reason: `Malformed IPv4 address: "${cleaned}"` };
  }

  const [a, b] = octets;

  // 127.x.x.x — loopback
  if (a === 127) return { ok: true };

  // 10.x.x.x — RFC1918 Class A
  if (a === 10) return { ok: true };

  // 172.16.x.x – 172.31.x.x — RFC1918 Class B
  if (a === 172 && b >= 16 && b <= 31) return { ok: true };

  // 192.168.x.x — RFC1918 Class C
  if (a === 192 && b === 168) return { ok: true };

  // 169.254.x.x — link-local (APIPA)
  if (a === 169 && b === 254) return { ok: true };

  return {
    ok: false,
    reason: 'LAN server IP must be a private-network address (use 192.168.x.x, 10.x.x.x, 172.16-31.x.x, or 169.254.x.x)',
  };
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
 * M21: Validates that `host` is a private-network address before storing.
 * Throws if a public IP is provided so callers surface the error promptly.
 *
 * After calling this, `isLanMode()` returns true and both transport and lobby
 * service will route traffic to the specified server on next connection.
 *
 * @param host - IP address or hostname of the LAN server (no scheme needed).
 * @param port - Port the Fastify MP server is listening on.
 * @throws Error if `host` is not a private-network address.
 */
export function setLanServerUrl(host: string, port: number): void {
  if (!hasStorage()) return;

  // M21: Strip scheme for validation (caller may pass "http://192.168.1.5").
  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const validation = validatePrivateNetworkAddress(cleanHost);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

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
