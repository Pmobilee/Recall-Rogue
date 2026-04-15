/**
 * Unit tests for lanServerService.
 *
 * These tests verify the non-Tauri (web/mobile) behavior: every function
 * must return safe defaults without throwing when `isDesktop` is false.
 *
 * Tauri-specific behavior (the actual IPC commands) is exercised via
 * integration tests in the Tauri E2E suite — not here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Module mocking ────────────────────────────────────────────────────────────

// Mock platformService before importing the service under test.
// Default: web platform (isDesktop = false).
vi.mock('./platformService', () => ({
  platform: 'web',
  isDesktop: false,
  isMobile: false,
  isWeb: true,
  hasSteam: false,
}));

// After mocking, import the service.
import {
  startLanServer,
  stopLanServer,
  getLanServerStatus,
  getLocalIps,
} from './lanServerService';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Non-Tauri platform behavior ───────────────────────────────────────────────

describe('lanServerService — non-Tauri platform (isDesktop = false)', () => {
  describe('startLanServer', () => {
    it('returns null without calling Tauri', async () => {
      const result = await startLanServer();
      expect(result).toBeNull();
    });

    it('returns null even when a port argument is supplied', async () => {
      const result = await startLanServer(19738);
      expect(result).toBeNull();
    });
  });

  describe('stopLanServer', () => {
    it('resolves without throwing', async () => {
      await expect(stopLanServer()).resolves.toBeUndefined();
    });
  });

  describe('getLanServerStatus', () => {
    it('returns { running: false, port: null }', async () => {
      const status = await getLanServerStatus();
      expect(status).toEqual({ running: false, port: null });
    });
  });

  describe('getLocalIps', () => {
    it('returns an empty array', async () => {
      const ips = await getLocalIps();
      expect(ips).toEqual([]);
    });
  });
});
