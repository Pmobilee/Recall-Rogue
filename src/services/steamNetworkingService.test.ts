/**
 * Tests for steamNetworkingService — M23 typed IPC contract.
 *
 * Verifies that:
 *  1. `SteamCommandArgs` covers all known Tauri commands with correct key shapes.
 *  2. `invokeSteam()` short-circuits to null on non-Tauri platforms (no Tauri globals).
 *  3. Refactored call sites (createSteamLobby, setLobbyData, sendP2PMessage, etc.)
 *     compile and pass the expected args through without runtime errors.
 *
 * All tests run in a non-Tauri environment (no `window.__TAURI_INTERNALS__`),
 * so `invokeSteam()` always returns null — we're testing the typed contract and
 * the platform-guard short-circuit path, not the actual Steamworks IPC.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SteamCommandArgs, SteamCommandReturn } from './steamNetworkingService';
import {
  invokeSteam,
  createSteamLobby,
  joinSteamLobby,
  leaveSteamLobby,
  setLobbyData,
  getLobbyData,
  getLobbyMembers,
  sendP2PMessage,
  acceptP2PSession,
  requestSteamLobbyList,
  getLobbyMemberCount,
  runSteamCallbacks,
} from './steamNetworkingService';

// ── Platform guard: ensure Tauri globals are absent in test environment ───────

beforeEach(() => {
  // Make absolutely sure the Tauri runtime check returns false.
  // These globals must not exist in the Vitest environment (they don't by default,
  // but being explicit prevents environment drift from breaking these tests).
  if (typeof window !== 'undefined') {
    delete (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI__;
  }
});

// ── M23: SteamCommandArgs type coverage ──────────────────────────────────────

describe('M23: SteamCommandArgs interface', () => {
  it('steam_create_lobby has lobbyType and maxMembers', () => {
    // TypeScript compile check — if the types are wrong this won't compile.
    const args: SteamCommandArgs['steam_create_lobby'] = {
      lobbyType: 'public',
      maxMembers: 4,
    };
    expect(args.lobbyType).toBe('public');
    expect(args.maxMembers).toBe(4);
  });

  it('steam_join_lobby has lobbyId', () => {
    const args: SteamCommandArgs['steam_join_lobby'] = { lobbyId: 'lobby_123' };
    expect(args.lobbyId).toBe('lobby_123');
  });

  it('steam_set_lobby_data has lobbyId, key, value', () => {
    const args: SteamCommandArgs['steam_set_lobby_data'] = {
      lobbyId: 'lobby_123',
      key: 'mode',
      value: 'race',
    };
    expect(args.key).toBe('mode');
  });

  it('steam_send_p2p_message has steamId, data, optional channel', () => {
    const required: SteamCommandArgs['steam_send_p2p_message'] = {
      steamId: '76561198000000001',
      data: '{"type":"mp:ping","payload":{}}',
    };
    const withChannel: SteamCommandArgs['steam_send_p2p_message'] = {
      ...required,
      channel: 1,
    };
    expect(required.channel).toBeUndefined();
    expect(withChannel.channel).toBe(1);
  });

  it('steam_request_lobby_list has no required args (Record<string, never>)', () => {
    // An empty object satisfies Record<string, never> — this must compile.
    const args: SteamCommandArgs['steam_request_lobby_list'] = {};
    expect(args).toEqual({});
  });

  it('all commands appear as keys in SteamCommandArgs', () => {
    // Structural test — ensures the interface has entries for all known commands.
    const knownCommands: Array<keyof SteamCommandArgs> = [
      'steam_create_lobby',
      'steam_join_lobby',
      'steam_leave_lobby',
      'steam_set_lobby_data',
      'steam_get_lobby_data',
      'steam_get_lobby_members',
      'steam_send_p2p_message',
      'steam_accept_p2p_session',
      'steam_request_lobby_list',
      'steam_get_lobby_member_count',
      'steam_force_leave_active_lobby',
      'steam_check_lobby_membership',
      'steam_get_pending_lobby_id',
      'steam_get_pending_join_lobby_id',
      'steam_get_lobby_list_result',
      'steam_read_p2p_messages',
      'steam_run_callbacks',
    ];
    // If any key doesn't exist in SteamCommandArgs, the array literal above
    // would fail to compile. This runtime assertion is a belt-and-suspenders check.
    expect(knownCommands.length).toBeGreaterThan(0);
  });
});

// ── M23: SteamCommandReturn type coverage ────────────────────────────────────

describe('M23: SteamCommandReturn interface', () => {
  it('return types are declared for all command keys', () => {
    const returnTypeKeys: Array<keyof SteamCommandReturn> = [
      'steam_create_lobby',
      'steam_join_lobby',
      'steam_leave_lobby',
      'steam_set_lobby_data',
      'steam_get_lobby_data',
      'steam_get_lobby_members',
      'steam_send_p2p_message',
      'steam_accept_p2p_session',
      'steam_request_lobby_list',
      'steam_get_lobby_member_count',
      'steam_force_leave_active_lobby',
      'steam_check_lobby_membership',
      'steam_get_pending_lobby_id',
      'steam_get_pending_join_lobby_id',
      'steam_get_lobby_list_result',
      'steam_read_p2p_messages',
      'steam_run_callbacks',
    ];
    // Compile check — if SteamCommandReturn doesn't have all these keys, it won't compile.
    expect(returnTypeKeys.length).toBeGreaterThan(0);
  });
});

// ── M23: invokeSteam platform-guard short-circuit ─────────────────────────────

describe('M23: invokeSteam() platform guard', () => {
  it('returns null when not running in Tauri (no window globals)', async () => {
    // invokeSteam should short-circuit before any import('@tauri-apps/api/core') call.
    const result = await invokeSteam('steam_create_lobby', { lobbyType: 'public', maxMembers: 4 });
    expect(result).toBeNull();
  });

  it('returns null for a no-args command when not in Tauri', async () => {
    const result = await invokeSteam('steam_request_lobby_list');
    expect(result).toBeNull();
  });
});

// ── M23: Public API functions use invokeSteam internally ─────────────────────

describe('M23: public API functions short-circuit on non-Tauri platform', () => {
  it('createSteamLobby returns null', async () => {
    expect(await createSteamLobby('public', 4)).toBeNull();
  });

  it('joinSteamLobby returns null on non-Tauri platform', async () => {
    // A3: joinSteamLobby now returns string | null (lobby ID or null) instead of boolean.
    // On non-Tauri platforms it returns null (short-circuit, same as other Steam functions).
    expect(await joinSteamLobby('lobby_123')).toBeNull();
  });

  it('leaveSteamLobby resolves without error', async () => {
    await expect(leaveSteamLobby('lobby_123')).resolves.toBeUndefined();
  });

  it('setLobbyData resolves without error', async () => {
    await expect(setLobbyData('lobby_123', 'mode', 'race')).resolves.toBeUndefined();
  });

  it('getLobbyData returns null', async () => {
    expect(await getLobbyData('lobby_123', 'mode')).toBeNull();
  });

  it('getLobbyMembers returns empty array', async () => {
    expect(await getLobbyMembers('lobby_123')).toEqual([]);
  });

  it('sendP2PMessage resolves to false on non-Tauri platform', async () => {
    // BUG1 fix: sendP2PMessage now returns Promise<boolean>; non-Tauri returns false.
    expect(await sendP2PMessage('76561198000000001', '{"type":"mp:ping"}')).toBe(false);
  });

  it('acceptP2PSession resolves to false on non-Tauri platform', async () => {
    // BUG3 fix: acceptP2PSession now returns Promise<boolean>; non-Tauri returns false.
    expect(await acceptP2PSession('76561198000000001')).toBe(false);
  });

  it('requestSteamLobbyList returns false', async () => {
    expect(await requestSteamLobbyList()).toBe(false);
  });

  it('getLobbyMemberCount returns 0', async () => {
    expect(await getLobbyMemberCount('lobby_123')).toBe(0);
  });

  it('runSteamCallbacks resolves without error', async () => {
    await expect(runSteamCallbacks()).resolves.toBeUndefined();
  });
});
