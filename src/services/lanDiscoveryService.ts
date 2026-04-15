/**
 * LAN Discovery Service — HTTP-based scanner for Recall Rogue LAN servers.
 *
 * Probes every host in one or more /24 subnets via GET /mp/discover.
 * Works on both Tauri and web platforms.
 *
 * The /mp/discover endpoint returns:
 *   { game: "recall-rogue", version: "...", hostName: "...", port: N }
 *
 * Only responses where `game === "recall-rogue"` are accepted.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default LAN server port. Matches LAN_DEFAULT_PORT in lan-server.ts. */
export const LAN_DEFAULT_PORT = 19738;

/** Maximum concurrent probe fetch requests per batch pass. */
const PROBE_BATCH_SIZE = 50;

/** Per-probe timeout default in milliseconds. */
const DEFAULT_PROBE_TIMEOUT_MS = 400;

/**
 * Subnets to fall back to when Tauri's `getLocalIps` is unavailable
 * (web builds, non-Tauri contexts). Covers the most common home/office
 * router ranges.
 */
const FALLBACK_SUBNETS = ['192.168.0', '192.168.1', '10.0.0', '10.0.1'];

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
 * Extract the /24 subnet prefix from an IPv4 address.
 * e.g. `"192.168.1.42"` → `"192.168.1"`
 */
function toSubnetPrefix(ip: string): string {
  const parts = ip.split('.');
  return parts.slice(0, 3).join('.');
}

/**
 * Resolve the list of /24 subnet prefixes to scan.
 *
 * Priority:
 * 1. Caller-supplied `subnets` option (used as-is).
 * 2. Subnets derived from `getLocalIps()` on Tauri desktop.
 * 3. Hardcoded FALLBACK_SUBNETS for web/mobile builds.
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
      // Deduplicate subnet prefixes derived from each local IP.
      const prefixSet = new Set<string>(ips.map(toSubnetPrefix));
      return Array.from(prefixSet);
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
 * Probes each host in the /24 address space of the detected local subnets.
 * Hosts `.0` (network address) and `.255` (broadcast) are skipped.
 * Probes run in batches of 50 to avoid exhausting browser socket limits.
 *
 * @param opts.timeout  - Per-IP probe timeout in ms (default: 400).
 * @param opts.port     - Port to probe on each host (default: `LAN_DEFAULT_PORT`).
 * @param opts.subnets  - Explicit /24 prefixes to scan, e.g. `['192.168.1']`.
 *                        When omitted, subnets are derived from local IP addresses
 *                        via `getLocalIps()` (Tauri) or hardcoded fallback list.
 * @returns Discovered servers sorted ascending by IP address string.
 */
export async function scanLanForServers(opts?: {
  timeout?: number;
  port?: number;
  subnets?: string[];
}): Promise<DiscoveredLanServer[]> {
  const timeout = opts?.timeout ?? DEFAULT_PROBE_TIMEOUT_MS;
  const port = opts?.port ?? LAN_DEFAULT_PORT;
  const subnets = await resolveSubnets(opts?.subnets);

  // Build one probe task per host across all subnets.
  const tasks: Array<() => Promise<DiscoveredLanServer | null>> = [];

  for (const prefix of subnets) {
    // .1 through .254 — skip .0 (network) and .255 (broadcast)
    for (let octet = 1; octet <= 254; octet++) {
      const ip = `${prefix}.${octet}`;
      tasks.push(() => probeLanServer(ip, port, timeout));
    }
  }

  const raw = await runInBatches(tasks, PROBE_BATCH_SIZE);

  // Filter nulls, sort by IP (lexicographic on the string — adequate for /24 ranges).
  const found = raw.filter((r): r is DiscoveredLanServer => r !== null);
  found.sort((a, b) => a.ip.localeCompare(b.ip));

  return found;
}
