/**
 * LAN Discovery Service — HTTP-based scanner for Recall Rogue LAN servers.
 *
 * Probes hosts in the local subnet via GET /mp/discover.
 * Works on both Tauri and web platforms.
 *
 * The /mp/discover endpoint returns:
 *   { game: "recall-rogue", version: "...", hostName: "...", port: N }
 *
 * Only responses where `game === "recall-rogue"` are accepted.
 *
 * # Scan Strategy (M3)
 *
 * Probing all 254 hosts in a /24 takes 50+ parallel fetches and may exhaust
 * browser socket pools. The optimised strategy is:
 *
 * Default scan (fullScan: false):
 *   1. Quick probe to `.1` (gateway heuristic) at 300ms.
 *      If it responds, short-circuit immediately.
 *   2. Otherwise, probe a compact set: .2..32, .100..110, .200..210, .254
 *      (≤55 IPs per subnet, well within browser socket limits).
 *
 * Full scan (fullScan: true):
 *   Probe all 254 hosts (.1–.254) directly — no separate gateway step.
 *   Use for background polling where latency is less critical.
 *
 * TODO: Consider Tauri mDNS/Bonjour via `mdns-sd` or `zeroconf` Rust crate for
 * O(1) zero-config discovery once Tauri plugin support is confirmed.
 */

import { rrLog as _log } from './rrLog';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default LAN server port. Matches DEFAULT_PORT in lan.rs. */
export const LAN_DEFAULT_PORT = 19738;

/** Maximum concurrent probe fetch requests per batch pass. */
const PROBE_BATCH_SIZE = 50;

/** Per-probe timeout default in milliseconds. */
const DEFAULT_PROBE_TIMEOUT_MS = 400;

/** Timeout for the quick gateway probe (M3 step 1). */
const GATEWAY_PROBE_TIMEOUT_MS = 300;

/**
 * Subnets to fall back to when Tauri's `getLocalIps` is unavailable
 * (web builds, non-Tauri contexts). Covers the most common home/office
 * router ranges.
 */
const FALLBACK_SUBNETS = ['192.168.0', '192.168.1', '10.0.0', '10.0.1'];

// ── M-023: Steam build gate ───────────────────────────────────────────────────

/**
 * Returns true when we are in a Steam release build where LAN scanning is
 * not a supported path (no explicit ?lan=1 opt-in). Mirrors the logic in
 * lanServerService._isSteamBuild().
 */
function _isSteamBuild(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  if (!(w.__TAURI_INTERNALS__ || w.__TAURI__)) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('mp') || params.has('lan')) return false;
  return true;
}

/**
 * M-023: True when LAN scanning should be suppressed (Steam release without ?lan=1).
 * Set at module-load time — mirrors LAN_DISABLED_IN_STEAM in lanServerService.
 */
const LAN_DISABLED_IN_STEAM = _isSteamBuild();

/**
 * M3: Compact host-octet ranges for the default (non-fullScan) second pass.
 *
 * Starts at .2 — .1 is covered by the separate gateway quick probe.
 * Covers ≤54 IPs per subnet after the gateway probe (total ≤55 with .1).
 */
const COMPACT_RANGES: ReadonlyArray<[number, number]> = [
  [2, 32],    // DHCP pool start — most home routers hand out .2–.32
  [100, 110], // Common static reservation band
  [200, 210], // Alternate static band
  [254, 254], // Gateway alternate (common on ISP-provided routers)
];

// ── Types ──────────────────────────────────────────────────────────────────────

/** A Recall Rogue LAN server found during a subnet scan. */
export interface DiscoveredLanServer {
  /** IPv4 address of the server. */
  ip: string;
  /** Port the server is listening on. */
  port: number;
  /** Human-readable host name set by the hosting player, if provided. */
  hostName?: string;
  /** Server version string, if provided. */
  version?: string;
}

/** Raw shape of a valid /mp/discover response body. */
interface DiscoverResponse {
  game: string;
  version?: string;
  hostName?: string;
  port?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * M2: Extract the subnet prefix from an IP address, with IPv6 awareness.
 *
 * IPv4:  `"192.168.1.42"` → `"192.168.1"`  (first three octets)
 * IPv6 link-local (fe80::/10): returns `null` — skip probing (address space too large).
 * IPv6 ULA (fc00::/7):  returns the /64 prefix (first 4 hextets).
 * IPv6 other / malformed: returns `null`.
 * Empty string: returns `null`.
 */
export function toSubnetPrefix(ip: string): string | null {
  if (!ip) return null;

  // IPv6 — detected by presence of ':'
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    // Link-local: fe80::/10 — skip (too many addresses, link-local is non-routable anyway)
    if (lower.startsWith('fe80')) return null;
    // ULA: fc00::/7 — includes fc00:: and fd00:: prefixes
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      // Return the /64 prefix: first 4 hextets
      const hextets = lower.split(':');
      if (hextets.length < 4) return null;
      return hextets.slice(0, 4).join(':');
    }
    // Any other IPv6 (global unicast, etc.) — don't probe
    return null;
  }

  // IPv4 — split on '.' and take first three octets
  const parts = ip.split('.');
  if (parts.length < 3) return null;
  return parts.slice(0, 3).join('.');
}

/**
 * Resolve the list of subnet prefixes to scan.
 *
 * Priority:
 * 1. Caller-supplied `subnets` option (used as-is).
 * 2. Subnets derived from `getLocalIps()` on Tauri desktop.
 * 3. Hardcoded FALLBACK_SUBNETS for web/mobile builds.
 *
 * M2: IPv6 link-local addresses from `getLocalIps()` are silently skipped.
 *     IPv6 ULA addresses yield /64 prefixes.
 */
async function resolveSubnets(callerSubnets?: string[]): Promise<string[]> {
  if (callerSubnets && callerSubnets.length > 0) {
    return callerSubnets;
  }

  // Attempt to load Tauri-backed local IP enumeration.
  // Dynamic import is intentional — keeps this file safe for non-Tauri builds.
  try {
    const { getLocalIps } = await import('./lanServerService');
    const ips = await getLocalIps();
    if (ips.length > 0) {
      // Deduplicate subnet prefixes derived from each local IP (M2: null = skip).
      const prefixSet = new Set<string>(
        ips.map(toSubnetPrefix).filter((p): p is string => p !== null),
      );
      if (prefixSet.size > 0) return Array.from(prefixSet);
    }
  } catch {
    // getLocalIps not available (non-Tauri build) — fall through to defaults.
  }

  return FALLBACK_SUBNETS;
}

/**
 * Run an array of async tasks in batches of `batchSize` at a time.
 * Waits for each batch to fully settle (all fulfilled OR rejected)
 * before starting the next batch.
 */
async function runInBatches<T>(
  tasks: Array<() => Promise<T>>,
  batchSize: number,
): Promise<Array<Awaited<T> | null>> {
  const results: Array<Awaited<T> | null> = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn => fn()));
    for (const outcome of settled) {
      results.push(outcome.status === 'fulfilled' ? outcome.value : null);
    }
  }

  return results;
}

/**
 * M3: Build the compact set of host octets to probe for a given prefix.
 *
 * For fullScan: all octets 1..254 (exhaustive /24 sweep).
 * For compact (default): COMPACT_RANGES, starting at 2 (.1 is covered by the
 * gateway quick probe that runs before this step).
 */
function buildOctetList(fullScan: boolean): number[] {
  if (fullScan) {
    // Full /24 — used by background refresh path (no gateway pre-probe)
    return Array.from({ length: 254 }, (_, i) => i + 1);
  }
  const octets: number[] = [];
  for (const [start, end] of COMPACT_RANGES) {
    for (let n = start; n <= end; n++) {
      if (!octets.includes(n)) octets.push(n);
    }
  }
  return octets;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Probe a single host for a Recall Rogue LAN server.
 *
 * Makes a GET request to `http://<host>:<port>/mp/discover` with an
 * `AbortController`-backed timeout. The response body must contain
 * `{ game: "recall-rogue" }` for the server to be accepted.
 *
 * @param host    - IPv4 address or hostname to probe.
 * @param port    - Port to probe (default: `LAN_DEFAULT_PORT`).
 * @param timeout - Per-probe timeout in ms (default: 400).
 * @returns Server info if a valid Recall Rogue server was found, `null` otherwise.
 */
export async function probeLanServer(
  host: string,
  port: number = LAN_DEFAULT_PORT,
  timeout: number = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<DiscoveredLanServer | null> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `http://${host}:${port}/mp/discover`;
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const body = await response.json() as DiscoverResponse;

    // Only accept genuine Recall Rogue servers.
    if (body.game !== 'recall-rogue') return null;

    return {
      ip: host,
      port: body.port ?? port,
      hostName: body.hostName,
      version: body.version,
    };
  } catch {
    // Network error, timeout (AbortError), JSON parse error — all map to "not found".
    return null;
  } finally {
    clearTimeout(timerId);
  }
}

/**
 * Scan the local network for Recall Rogue LAN servers.
 *
 * M3 scan strategy:
 *
 * Default (fullScan: false):
 *   Step 1 — Quick probe to `.1` per subnet (gateway heuristic, 300ms timeout).
 *             If a valid server responds, return immediately.
 *   Step 2 — Compact scan: octets 2–32, 100–110, 200–210, 254 (≤54 IPs/subnet).
 *
 * Full scan (fullScan: true):
 *   Probe all 254 hosts (.1–.254) directly. No separate gateway step.
 *   Use for background refresh polling where latency is not critical.
 *
 * @param opts.timeout   - Per-IP probe timeout in ms (default: 400).
 * @param opts.port      - Port to probe on each host (default: `LAN_DEFAULT_PORT`).
 * @param opts.subnets   - Explicit subnet prefixes to scan, e.g. `['192.168.1']`.
 *                         When omitted, subnets are derived from local IPs (Tauri)
 *                         or from FALLBACK_SUBNETS (web builds).
 * @param opts.fullScan  - When true, probe all 254 hosts in each /24. Default false.
 * @returns Discovered servers sorted ascending by IP address string.
 */
export async function scanLanForServers(opts?: {
  timeout?: number;
  port?: number;
  subnets?: string[];
  fullScan?: boolean;
}): Promise<DiscoveredLanServer[]> {
  // M-023: Suppress LAN scanning in Steam release builds (no ?lan=1 opt-in).
  if (LAN_DISABLED_IN_STEAM) {
    _log('mp:lan', 'LAN disabled in Steam build — scanLanForServers is a no-op');
    return [];
  }
  const timeout = opts?.timeout ?? DEFAULT_PROBE_TIMEOUT_MS;
  const port = opts?.port ?? LAN_DEFAULT_PORT;
  const fullScan = opts?.fullScan ?? false;
  const subnets = await resolveSubnets(opts?.subnets);

  if (fullScan) {
    // M3 full-scan path: probe all 254 hosts directly (no separate gateway step).
    const octetList = buildOctetList(true);
    const tasks: Array<() => Promise<DiscoveredLanServer | null>> = [];
    for (const prefix of subnets) {
      for (const octet of octetList) {
        tasks.push(() => probeLanServer(`${prefix}.${octet}`, port, timeout));
      }
    }
    const raw = await runInBatches(tasks, PROBE_BATCH_SIZE);
    const found = raw.filter((r): r is DiscoveredLanServer => r !== null);
    found.sort((a, b) => a.ip.localeCompare(b.ip));
    return found;
  }

  // M3 default path:

  // Step 1: Quick probe — gateway (.1) per subnet at shorter timeout.
  // If any subnet's gateway responds with a valid server, short-circuit.
  const quickHits = await Promise.all(
    subnets.map(prefix => probeLanServer(`${prefix}.1`, port, GATEWAY_PROBE_TIMEOUT_MS)),
  );
  const quickFound = quickHits.filter((r): r is DiscoveredLanServer => r !== null);
  if (quickFound.length > 0) {
    quickFound.sort((a, b) => a.ip.localeCompare(b.ip));
    return quickFound;
  }

  // Step 2: Compact scan (octets 2–32, 100–110, 200–210, 254).
  // .1 was already probed above; COMPACT_RANGES starts at 2 to avoid redundancy.
  const octetList = buildOctetList(false);
  const tasks: Array<() => Promise<DiscoveredLanServer | null>> = [];
  for (const prefix of subnets) {
    for (const octet of octetList) {
      tasks.push(() => probeLanServer(`${prefix}.${octet}`, port, timeout));
    }
  }

  const raw = await runInBatches(tasks, PROBE_BATCH_SIZE);
  const found = raw.filter((r): r is DiscoveredLanServer => r !== null);
  found.sort((a, b) => a.ip.localeCompare(b.ip));
  return found;
}
