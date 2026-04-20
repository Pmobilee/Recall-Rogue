/**
 * Unit tests for lanConfigService.ts
 *
 * Uses vitest's localStorage mock — no DOM/browser required.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLanServerUrl,
  getLanServerUrls,
  isLanMode,
  setLanServerUrl,
  validatePrivateNetworkAddress,
} from './lanConfigService';

// ── localStorage stub ─────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear the store before each test for isolation.
  Object.keys(store).forEach(k => delete store[k]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('lanConfigService', () => {
  describe('isLanMode()', () => {
    it('returns false when nothing is stored', () => {
      expect(isLanMode()).toBe(false);
    });

    it('returns true after setLanServerUrl()', () => {
      setLanServerUrl('192.168.1.5', 19738);
      expect(isLanMode()).toBe(true);
    });

    it('returns false after clearLanServerUrl()', () => {
      setLanServerUrl('192.168.1.5', 19738);
      clearLanServerUrl();
      expect(isLanMode()).toBe(false);
    });
  });

  describe('setLanServerUrl() / getLanServerUrls()', () => {
    it('builds correct wsUrl and apiUrl from host + port', () => {
      setLanServerUrl('192.168.1.5', 19738);
      const config = getLanServerUrls();
      expect(config).not.toBeNull();
      expect(config!.wsUrl).toBe('ws://192.168.1.5:19738/mp/ws');
      expect(config!.apiUrl).toBe('http://192.168.1.5:19738');
    });

    it('strips http:// scheme from host if provided', () => {
      setLanServerUrl('http://192.168.1.5', 19738);
      const config = getLanServerUrls();
      expect(config!.wsUrl).toBe('ws://192.168.1.5:19738/mp/ws');
      expect(config!.apiUrl).toBe('http://192.168.1.5:19738');
    });

    it('strips https:// scheme from host if provided', () => {
      setLanServerUrl('https://192.168.1.5', 19738);
      const config = getLanServerUrls();
      expect(config!.wsUrl).toBe('ws://192.168.1.5:19738/mp/ws');
      expect(config!.apiUrl).toBe('http://192.168.1.5:19738');
    });

    it('strips trailing slash from host', () => {
      setLanServerUrl('10.0.0.1/', 3000);
      const config = getLanServerUrls();
      expect(config!.wsUrl).toBe('ws://10.0.0.1:3000/mp/ws');
    });

    it('overwrites a previous config on re-set', () => {
      setLanServerUrl('192.168.1.5', 19738);
      setLanServerUrl('10.0.0.2', 3000);
      const config = getLanServerUrls();
      expect(config!.apiUrl).toBe('http://10.0.0.2:3000');
    });

    it('M21: throws when a public IPv4 address is provided', () => {
      expect(() => setLanServerUrl('8.8.8.8', 19738)).toThrow();
    });

    it('M21: throws when a public IPv6 address is provided', () => {
      expect(() => setLanServerUrl('2001:db8::1', 19738)).toThrow();
    });

    it('M21: accepts RFC1918 10.x.x.x range', () => {
      expect(() => setLanServerUrl('10.42.0.5', 19738)).not.toThrow();
    });

    it('M21: accepts RFC1918 172.16.x.x range', () => {
      expect(() => setLanServerUrl('172.20.1.5', 19738)).not.toThrow();
    });

    it('M21: accepts link-local 169.254.x.x', () => {
      expect(() => setLanServerUrl('169.254.0.1', 19738)).not.toThrow();
    });

    it('M21: accepts loopback 127.0.0.1', () => {
      expect(() => setLanServerUrl('127.0.0.1', 19738)).not.toThrow();
    });
  });

  describe('getLanServerUrls()', () => {
    it('returns null when nothing is stored', () => {
      expect(getLanServerUrls()).toBeNull();
    });

    it('returns null and clears corrupt storage entries', () => {
      store['rr-lan-server'] = '{invalid json';
      expect(getLanServerUrls()).toBeNull();
      // The corrupt entry should have been cleared.
      expect(store['rr-lan-server']).toBeUndefined();
    });

    it('returns null for stored objects missing required fields', () => {
      store['rr-lan-server'] = JSON.stringify({ wsUrl: 'ws://foo', /* no apiUrl */ });
      expect(getLanServerUrls()).toBeNull();
    });
  });

  describe('clearLanServerUrl()', () => {
    it('is a no-op when nothing is stored', () => {
      expect(() => clearLanServerUrl()).not.toThrow();
      expect(isLanMode()).toBe(false);
    });

    it('removes the stored config', () => {
      setLanServerUrl('192.168.1.5', 19738);
      clearLanServerUrl();
      expect(getLanServerUrls()).toBeNull();
    });
  });
});

// ── validatePrivateNetworkAddress (M21) ───────────────────────────────────────

describe('validatePrivateNetworkAddress', () => {
  // ── IPv4 — accept ──────────────────────────────────────────────────────────

  it('accepts 127.0.0.1 (loopback)', () => {
    expect(validatePrivateNetworkAddress('127.0.0.1').ok).toBe(true);
  });

  it('accepts 127.x.x.x range', () => {
    expect(validatePrivateNetworkAddress('127.200.0.1').ok).toBe(true);
  });

  it('accepts 10.x.x.x (RFC1918 Class A)', () => {
    expect(validatePrivateNetworkAddress('10.0.0.1').ok).toBe(true);
    expect(validatePrivateNetworkAddress('10.255.255.255').ok).toBe(true);
  });

  it('accepts 172.16.x.x through 172.31.x.x (RFC1918 Class B)', () => {
    expect(validatePrivateNetworkAddress('172.16.0.1').ok).toBe(true);
    expect(validatePrivateNetworkAddress('172.31.255.255').ok).toBe(true);
  });

  it('accepts 192.168.x.x (RFC1918 Class C)', () => {
    expect(validatePrivateNetworkAddress('192.168.0.1').ok).toBe(true);
    expect(validatePrivateNetworkAddress('192.168.255.255').ok).toBe(true);
  });

  it('accepts 169.254.x.x (link-local APIPA)', () => {
    expect(validatePrivateNetworkAddress('169.254.0.1').ok).toBe(true);
    expect(validatePrivateNetworkAddress('169.254.99.1').ok).toBe(true);
  });

  // ── IPv4 — reject ──────────────────────────────────────────────────────────

  it('rejects a public IPv4 address', () => {
    const result = validatePrivateNetworkAddress('8.8.8.8');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/private-network/);
  });

  it('rejects 172.15.x.x (just below RFC1918 range)', () => {
    expect(validatePrivateNetworkAddress('172.15.0.1').ok).toBe(false);
  });

  it('rejects 172.32.x.x (just above RFC1918 range)', () => {
    expect(validatePrivateNetworkAddress('172.32.0.1').ok).toBe(false);
  });

  it('rejects malformed IPv4 (too few octets)', () => {
    const result = validatePrivateNetworkAddress('192.168.1');
    expect(result.ok).toBe(false);
  });

  it('rejects malformed IPv4 (non-numeric)', () => {
    const result = validatePrivateNetworkAddress('not.an.ip.addr');
    expect(result.ok).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validatePrivateNetworkAddress('').ok).toBe(false);
  });

  // ── IPv6 — accept ──────────────────────────────────────────────────────────

  it('accepts ::1 (IPv6 loopback)', () => {
    expect(validatePrivateNetworkAddress('::1').ok).toBe(true);
  });

  it('accepts fe80::1 (IPv6 link-local)', () => {
    expect(validatePrivateNetworkAddress('fe80::1').ok).toBe(true);
  });

  it('accepts fd00::1 (IPv6 ULA fd prefix)', () => {
    expect(validatePrivateNetworkAddress('fd00::1').ok).toBe(true);
  });

  it('accepts fc00::1 (IPv6 ULA fc prefix)', () => {
    expect(validatePrivateNetworkAddress('fc00::1').ok).toBe(true);
  });

  // ── IPv6 — reject ──────────────────────────────────────────────────────────

  it('rejects a public IPv6 address (2001:db8:: documentation range)', () => {
    const result = validatePrivateNetworkAddress('2001:db8::1');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/private-network/);
  });

  it('rejects a global unicast IPv6 address', () => {
    expect(validatePrivateNetworkAddress('2600:1f18::1').ok).toBe(false);
  });
});
