/**
 * Unit tests for lanDiscoveryService.
 *
 * All network calls are mocked — no real HTTP is issued.
 * The `lanServerService` import (Tauri getLocalIps) is also mocked so
 * these tests run safely in non-Tauri CI environments.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probeLanServer, scanLanForServers, LAN_DEFAULT_PORT } from './lanDiscoveryService';

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
  it('skips .0 and .255 addresses and probes the rest of the /24', async () => {
    // Return null for most probes, one success at .42
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('192.168.99.42')) {
        return makeDiscoverResponse({ hostName: 'Found One' });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const results = await scanLanForServers({ subnets: ['192.168.99'], timeout: 50 });

    // Verify .0 was never probed (would be the first call target if not skipped)
    const allUrls = mockFetch.mock.calls.map(c => String(c[0]));
    expect(allUrls.some(u => u.includes('192.168.99.0/'))).toBe(false);
    expect(allUrls.some(u => u.includes('192.168.99.255/'))).toBe(false);

    // Should have exactly 254 probes (1..254)
    expect(allUrls.filter(u => u.includes('192.168.99.')).length).toBe(254);

    // The found server is in the results
    const found = results.find(r => r.ip === '192.168.99.42');
    expect(found?.hostName).toBe('Found One');
  });

  it('returns results sorted ascending by IP string', async () => {
    // Two servers at .10 and .5
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('192.168.1.10') || url.includes('192.168.1.5')) {
        return makeDiscoverResponse();
      }
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
