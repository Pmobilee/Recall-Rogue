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
      setLanServerUrl('https://mygameserver.local', 8080);
      const config = getLanServerUrls();
      expect(config!.wsUrl).toBe('ws://mygameserver.local:8080/mp/ws');
      expect(config!.apiUrl).toBe('http://mygameserver.local:8080');
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
