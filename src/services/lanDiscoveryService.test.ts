/**
 * Unit tests for lanDiscoveryService.
 *
 * All network calls are mocked — no real HTTP is issued.
 * The `lanServerService` import (Tauri getLocalIps) is also mocked so
 * these tests run safely in non-Tauri CI environments.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probeLanServer, scanLanForServers, toSubnetPrefix, LAN_DEFAULT_PORT } from './lanDiscoveryService';

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Helper: build a mock successful discover response ─────────────────────────

function makeDiscoverResponse(overrides: Record<string, unknown> = {}): Response {
  const body = JSON.stringify({
    game: 'recall-rogue',
    version: '0.1.0',
    hostName: 'Test Host',
    port: LAN_DEFAULT_PORT,
    ...overrides,
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Extract the host IP from a discover URL like "http://192.168.1.5:19738/mp/discover" */
function extractIpFromUrl(url: string): string {
  const match = url.match(/http:\/\/([^:]+):/);
  return match ? match[1] : '';
}

// ── toSubnetPrefix (M2) ───────────────────────────────────────────────────────

describe('toSubnetPrefix (M2 — IPv6 awareness)', () => {
  // IPv4 — existing behaviour preserved

  it('extracts /24 prefix from a standard IPv4 address', () => {
    expect(toSubnetPrefix('192.168.1.42')).toBe('192.168.1');
  });

  it('works for 10.x.x.x addresses', () => {
    expect(toSubnetPrefix('10.0.0.1')).toBe('10.0.0');
  });

  it('returns null for empty string', () => {
    expect(toSubnetPrefix('')).toBeNull();
  });

  it('returns null for malformed IPv4 (too few parts)', () => {
    expect(toSubnetPrefix('192.168')).toBeNull();
  });

  // IPv6 link-local — skip

  it('returns null for IPv6 link-local (fe80::/10)', () => {
    expect(toSubnetPrefix('fe80::1')).toBeNull();
    expect(toSubnetPrefix('FE80::cafe:dead')).toBeNull();
  });

  it('returns null for fe80:: expanded addresses', () => {
    expect(toSubnetPrefix('fe80:0000:0000:0000:0202:b3ff:fe1e:8329')).toBeNull();
  });

  // IPv6 ULA — return /64 prefix

  it('returns /64 prefix for IPv6 ULA fd::/8', () => {
    const prefix = toSubnetPrefix('fd12:3456:789a:0001::1');
    expect(prefix).toBe('fd12:3456:789a:0001');
  });

  it('returns /64 prefix for IPv6 ULA fc::/8', () => {
    const prefix = toSubnetPrefix('fc00:0:0:1::1');
    expect(prefix).toBe('fc00:0:0:1');
  });

  // IPv6 other — reject

  it('returns null for global unicast IPv6', () => {
    expect(toSubnetPrefix('2001:db8::1')).toBeNull();
  });

  it('returns null for ::1 (loopback — not a scannable subnet)', () => {
    expect(toSubnetPrefix('::1')).toBeNull();
  });
});

// ── probeLanServer ────────────────────────────────────────────────────────────

describe('probeLanServer', () => {
  it('returns server info when the endpoint responds with game: "recall-rogue"', async () => {
    mockFetch.mockResolvedValueOnce(makeDiscoverResponse());

    const result = await probeLanServer('192.168.1.10', LAN_DEFAULT_PORT, 500);

    expect(result).not.toBeNull();
    expect(result?.ip).toBe('192.168.1.10');
    expect(result?.port).toBe(LAN_DEFAULT_PORT);
    expect(result?.hostName).toBe('Test Host');
    expect(result?.version).toBe('0.1.0');
  });

  it('uses LAN_DEFAULT_PORT when no port is provided', async () => {
    mockFetch.mockResolvedValueOnce(makeDiscoverResponse());

    await probeLanServer('10.0.0.5');

    const calledUrl = (mockFetch.mock.calls[0] as [string, RequestInit?])[0];
    expect(calledUrl).toContain(`:${LAN_DEFAULT_PORT}/`);
  });

  it('returns null when the response has a non-recall-rogue game field', async () => {
    mockFetch.mockResolvedValueOnce(makeDiscoverResponse({ game: 'other-game' }));

    const result = await probeLanServer('192.168.1.11');
    expect(result).toBeNull();
  });

  it('returns null when the HTTP response is not 2xx', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const result = await probeLanServer('192.168.1.12');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await probeLanServer('192.168.1.13');
    expect(result).toBeNull();
  });

  it('returns null on AbortError (timeout)', async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 10),
      ),
    );

    const result = await probeLanServer('192.168.1.14', LAN_DEFAULT_PORT, 5);
    expect(result).toBeNull();
  });

  it('falls back to the probed port when the response body omits port', async () => {
    const body = JSON.stringify({ game: 'recall-rogue', hostName: 'No Port' });
    mockFetch.mockResolvedValueOnce(
      new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await probeLanServer('192.168.1.20', 9999);
    expect(result?.port).toBe(9999);
  });

  it('uses a custom port when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeDiscoverResponse({ port: 12345 }));

    const result = await probeLanServer('10.0.0.1', 12345);
    expect(result?.port).toBe(12345);

    const calledUrl = (mockFetch.mock.calls[0] as [string, RequestInit?])[0];
    expect(calledUrl).toContain(':12345/');
  });
});

// ── scanLanForServers ─────────────────────────────────────────────────────────

describe('scanLanForServers', () => {
  it('M3: short-circuits when gateway (.1) responds', async () => {
    let fetchCount = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      fetchCount++;
      const ip = extractIpFromUrl(String(input));
      if (ip === '192.168.99.1') return makeDiscoverResponse({ hostName: 'Gateway Found' });
      throw new Error('refused');
    });

    const results = await scanLanForServers({ subnets: ['192.168.99'], timeout: 50 });

    // Should have stopped after finding the gateway — exactly 1 probe (the .1 quick probe)
    expect(fetchCount).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0].hostName).toBe('Gateway Found');
    expect(results[0].ip).toBe('192.168.99.1');
  });

  it('M3: falls back to compact scan when gateway misses', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const ip = extractIpFromUrl(String(input));
      // .25 is within the compact range [2, 32]
      if (ip === '192.168.55.25') return makeDiscoverResponse({ hostName: 'Found In Compact' });
      throw new Error('refused');
    });

    const results = await scanLanForServers({ subnets: ['192.168.55'], timeout: 50 });

    expect(results).toHaveLength(1);
    expect(results[0].ip).toBe('192.168.55.25');
    expect(results[0].hostName).toBe('Found In Compact');
  });

  it('M3: fullScan probes all 254 hosts (1..254) with no separate gateway step', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const ip = extractIpFromUrl(String(input));
      if (ip === '192.168.99.42') return makeDiscoverResponse({ hostName: 'Found One' });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const results = await scanLanForServers({ subnets: ['192.168.99'], timeout: 50, fullScan: true });

    const allIps = mockFetch.mock.calls.map(c => extractIpFromUrl(String(c[0])));

    // Exactly 254 probes — .1 through .254, no .0 or .255
    expect(allIps).not.toContain('192.168.99.0');
    expect(allIps).not.toContain('192.168.99.255');
    const subnetIps = allIps.filter(ip => ip.startsWith('192.168.99.'));
    expect(subnetIps.length).toBe(254);

    const found = results.find(r => r.ip === '192.168.99.42');
    expect(found?.hostName).toBe('Found One');
  });

  it('M3: compact scan does not re-probe .1 (already covered by quick probe)', async () => {
    // Quick probe will fail on .1 (throw), compact scan should start at .2
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      throw new Error('refused');
    });

    await scanLanForServers({ subnets: ['10.0.0'], timeout: 20 });

    const allIps = mockFetch.mock.calls.map(c => extractIpFromUrl(String(c[0])));

    // .1 should appear exactly once (the gateway quick probe), not twice
    const dotOneProbes = allIps.filter(ip => ip === '10.0.0.1');
    expect(dotOneProbes.length).toBe(1);
  });

  it('returns results sorted ascending by IP string', async () => {
    // Two servers at .10 and .5 — both within the compact range [2, 32]
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const ip = extractIpFromUrl(String(input));
      if (ip === '192.168.1.10' || ip === '192.168.1.5') return makeDiscoverResponse();
      throw new Error('refused');
    });

    const results = await scanLanForServers({ subnets: ['192.168.1'], timeout: 50 });
    const ips = results.map(r => r.ip);
    const sorted = [...ips].sort((a, b) => a.localeCompare(b));
    expect(ips).toEqual(sorted);
  });

  it('returns an empty array when no servers are found', async () => {
    mockFetch.mockRejectedValue(new Error('refused'));

    const results = await scanLanForServers({ subnets: ['10.10.10'], timeout: 20 });
    expect(results).toHaveLength(0);
  });

  it('accepts a custom port option', async () => {
    mockFetch.mockRejectedValue(new Error('refused'));

    await scanLanForServers({ subnets: ['192.168.2'], port: 55000, timeout: 20 });

    const allUrls = mockFetch.mock.calls.map(c => String(c[0]));
    expect(allUrls.every(u => u.includes(':55000/'))).toBe(true);
  });
});
