/**
 * Tests for multiplayerLobbyService — focusing on the 2026-04-09 fix:
 * contentSelection must be included in the mp:lobby:start payload so
 * guest instances receive the definitive content selection at game-start time.
 *
 * These tests use a mock transport to intercept messages without any
 * networking, Steam, or browser globals required.
 *
 * Phase 6 (2026-04-11): createLobby and joinLobby are now async.
 * The webBackend calls fetch() internally; tests mock global.fetch with a
 * response that returns a minimal { lobbyId, lobbyCode } so the async
 * path resolves without a running Fastify server.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MultiplayerMessage, MultiplayerMessageType, MultiplayerTransport } from './multiplayerTransport';
import type { LobbyContentSelection } from '../data/multiplayerTypes';

// ---------------------------------------------------------------------------
// Mock fetch so webBackend doesn't need a real Fastify server
// ---------------------------------------------------------------------------

const mockFetchResponse = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);

// Global fetch mock — returns a plausible createLobby / joinLobby response
vi.stubGlobal('fetch', vi.fn((url: string) => {
  // POST /mp/lobbies -> createLobby result
  if (url.includes('/mp/lobbies') && !url.includes('/join') && !url.includes('/code')) {
    return mockFetchResponse({ lobbyId: 'test_lobby_id', lobbyCode: 'TSTCOD', joinToken: 'tok_test' });
  }
  // POST /mp/lobbies/:id/join -> joinLobbyById result
  if (url.includes('/join')) {
    return mockFetchResponse({ lobbyId: 'test_lobby_id', lobbyCode: 'TSTCOD', joinToken: 'tok_test' });
  }
  // GET /mp/lobbies/code/:code -> resolveByCode result
  if (url.includes('/code/')) {
    return mockFetchResponse({ lobbyId: 'test_lobby_id' });
  }
  // GET /mp/lobbies -> listPublicLobbies
  return mockFetchResponse({ lobbies: [] });
}));

// ---------------------------------------------------------------------------
// Mock transport factory
// ---------------------------------------------------------------------------

type MessageHandler = (msg: MultiplayerMessage) => void;

function createMockTransport(): MultiplayerTransport & {
  sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }>;
  simulateReceive(type: MultiplayerMessageType, payload: Record<string, unknown>): void;
} {
  const sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }> = [];
  const handlers = new Map<string, MessageHandler[]>();

  return {
    sent,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getState: vi.fn(() => 'connected' as const),
    isConnected: vi.fn(() => true),
    send(type: MultiplayerMessageType, payload: Record<string, unknown>) {
      sent.push({ type, payload });
    },
    on(type: string, callback: MessageHandler) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(callback);
      return () => {
        const list = handlers.get(type);
        if (list) {
          const idx = list.indexOf(callback);
          if (idx >= 0) list.splice(idx, 1);
        }
      };
    },
    simulateReceive(type: MultiplayerMessageType, payload: Record<string, unknown>) {
      const list = handlers.get(type);
      if (list) {
        const msg: MultiplayerMessage = { type, payload, timestamp: Date.now(), senderId: 'remote' };
        list.forEach(cb => cb(msg));
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Module-level mock for multiplayerTransport
// ---------------------------------------------------------------------------

let mockTransport: ReturnType<typeof createMockTransport>;

vi.mock('./multiplayerTransport', () => {
  return {
    getMultiplayerTransport: vi.fn(() => mockTransport),
    destroyMultiplayerTransport: vi.fn(),
    createLocalTransportPair: vi.fn(() => [createMockTransport(), createMockTransport()]),
    LocalMultiplayerTransport: class {},
  };
});

// Also mock platformService so hasSteam doesn't try to call Tauri
vi.mock('./platformService', () => ({
  hasSteam: false,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const {
  createLobby,
  joinLobby,
  setContentSelection,
  setReady,
  startGame,
  onGameStart,
  getCurrentLobby,
} = await import('./multiplayerLobbyService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeHostLobby(contentSelection?: LobbyContentSelection) {
  const lobby = await createLobby('host_player', 'Host', 'race');
  // Add a second player directly so allReady() can pass
  lobby.players.push({ id: 'guest_player', displayName: 'Guest', isHost: false, isReady: true });
  lobby.players[0].isReady = true; // mark host ready too
  if (contentSelection) {
    setContentSelection(contentSelection);
  }
  return lobby;
}

// ---------------------------------------------------------------------------
// Tests — Fix 1: contentSelection in mp:lobby:start
// ---------------------------------------------------------------------------

describe('startGame() — includes contentSelection in mp:lobby:start payload', () => {
  beforeEach(() => {
    mockTransport = createMockTransport();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset module state by leaving the lobby
    // (leaveLobby imports destroyMultiplayerTransport which is mocked)
    vi.restoreAllMocks();
  });

  it('sends contentSelection in mp:lobby:start when a study deck is selected', async () => {
    const selection: LobbyContentSelection = {
      type: 'study',
      deckId: 'world_war_ii',
      deckName: 'World War II',
    };

    await makeHostLobby(selection);
    startGame();

    const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(startMsg).toBeDefined();
    expect(startMsg!.payload.contentSelection).toBeDefined();

    const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
    expect(cs.type).toBe('study');
    expect(cs.deckId).toBe('world_war_ii');
    expect(cs.deckName).toBe('World War II');
  });

  it('sends contentSelection in mp:lobby:start when a custom_deck is selected', async () => {
    const selection: LobbyContentSelection = {
      type: 'custom_deck',
      customDeckId: 'my_anki_deck',
      deckName: 'My Anki Deck',
    };

    await makeHostLobby(selection);
    startGame();

    const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(startMsg).toBeDefined();
    const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
    expect(cs.type).toBe('custom_deck');
    expect(cs.customDeckId).toBe('my_anki_deck');
  });

  it('sends contentSelection in mp:lobby:start when trivia domains are selected', async () => {
    const selection: LobbyContentSelection = {
      type: 'trivia',
      domains: ['history', 'science'],
    };

    await makeHostLobby(selection);
    startGame();

    const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(startMsg).toBeDefined();
    const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
    expect(cs.type).toBe('trivia');
    expect(cs.domains).toEqual(['history', 'science']);
  });

  it('sends mp:lobby:start without contentSelection key when none is set', async () => {
    // No contentSelection configured
    await makeHostLobby();
    startGame();

    const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(startMsg).toBeDefined();
    // contentSelection should be absent or undefined (not a broken value)
    expect(startMsg!.payload.contentSelection).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — Fix 1: handler applies contentSelection before onGameStart fires
// ---------------------------------------------------------------------------

describe('mp:lobby:start handler — assigns contentSelection before onGameStart', () => {
  beforeEach(() => {
    mockTransport = createMockTransport();
    vi.clearAllMocks();
  });

  it('applies contentSelection from payload before onGameStart fires on guest', async () => {
    // Simulate a guest joining (not host) — isHost() will be false
    await joinLobby('ABCDEF', 'guest_player', 'Guest');

    const selection: LobbyContentSelection = {
      type: 'study',
      deckId: 'ap_biology',
      deckName: 'AP Biology',
    };

    let lobbyAtStart: ReturnType<typeof getCurrentLobby> = null;
    onGameStart((_seed, lobby) => {
      lobbyAtStart = { ...lobby };
    });

    // Simulate host sending mp:lobby:start with contentSelection
    mockTransport.simulateReceive('mp:lobby:start', {
      seed: 12345,
      contentSelection: selection as unknown as Record<string, unknown>,
    });

    expect(lobbyAtStart).not.toBeNull();
    expect(lobbyAtStart!.contentSelection).toBeDefined();
    expect(lobbyAtStart!.contentSelection!.type).toBe('study');
    expect((lobbyAtStart!.contentSelection as Extract<LobbyContentSelection, { type: 'study' }>).deckId).toBe('ap_biology');
  });

  it('preserves existing contentSelection when payload omits it', async () => {
    await joinLobby('ABCDEF', 'guest_player', 'Guest');

    let lobbyAtStart: ReturnType<typeof getCurrentLobby> = null;
    onGameStart((_seed, lobby) => {
      lobbyAtStart = { ...lobby };
    });

    // Receive a start with no contentSelection — existing state should be preserved
    mockTransport.simulateReceive('mp:lobby:start', { seed: 99999 });

    expect(lobbyAtStart).not.toBeNull();
    // contentSelection was never set, so it should remain undefined
    expect(lobbyAtStart!.contentSelection).toBeUndefined();
  });

  it('seed is correctly applied from the start payload', async () => {
    await joinLobby('ABCDEF', 'guest_player', 'Guest');

    let receivedSeed = 0;
    onGameStart((seed) => { receivedSeed = seed; });

    mockTransport.simulateReceive('mp:lobby:start', { seed: 7654321 });

    expect(receivedSeed).toBe(7654321);
  });
});

// ---------------------------------------------------------------------------
// Additional exports from the same module (already loaded above)
// ---------------------------------------------------------------------------

const {
  setVisibility,
  setPassword,
  setMaxPlayers,
  leaveLobby,
  listPublicLobbies,
  joinLobbyById,
  isBroadcastMode,
} = await import('./multiplayerLobbyService');

// ---------------------------------------------------------------------------
// Helpers for Phase 10 tests
// ---------------------------------------------------------------------------

/** Re-assign mockTransport before each test so mocks start clean. */
function resetMockTransport() {
  mockTransport = createMockTransport();
  vi.clearAllMocks();
}

/**
 * Create a host lobby and return it.
 * Uses unique player IDs per call so module-level _localPlayerId is always
 * the host of the most-recently-created lobby.
 */
async function makeHostLobbyPhase10(
  mode: 'race' | 'duel' | 'coop' | 'trivia_night' | 'same_cards' = 'race',
  opts?: { visibility?: 'public' | 'password' | 'friends_only'; password?: string; maxPlayers?: number },
) {
  const id = `host_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  return createLobby(id, 'Host', mode, opts);
}

// ---------------------------------------------------------------------------
// Tests — setVisibility transitions
// ---------------------------------------------------------------------------

describe('setVisibility — lobby privacy transitions', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  it('public → password: sets hasPassword to true and visibility to "password"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('password');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('password');
    expect(lobby!.hasPassword).toBe(true);
  });

  it('password → public: resets hasPassword to false and visibility to "public"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('password');
    setVisibility('public');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('public');
    expect(lobby!.hasPassword).toBe(false);
  });

  it('public → friends_only: does not touch hasPassword (stays false)', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('friends_only');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('friends_only');
    expect(lobby!.hasPassword).toBe(false);
  });

  it('friends_only → password: sets hasPassword to true', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('friends_only');
    setVisibility('password');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('password');
    expect(lobby!.hasPassword).toBe(true);
  });

  it('setVisibility is a no-op for non-host players', async () => {
    // Join as guest — _localPlayerId becomes the guest
    await joinLobby('ABCDEF', 'guest_np', 'Guest');
    const before = getCurrentLobby();
    const beforeVisibility = before?.visibility;
    setVisibility('password');
    const after = getCurrentLobby();
    // Non-host: should not have changed visibility
    expect(after?.visibility).toBe(beforeVisibility);
  });

  it('setVisibility broadcasts settings (sends mp:lobby:settings message)', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    const sentBefore = mockTransport.sent.length;
    setVisibility('password');
    const settingsMsgs = mockTransport.sent.slice(sentBefore).filter(m => m.type === 'mp:lobby:settings');
    expect(settingsMsgs.length).toBeGreaterThan(0);
    expect(settingsMsgs[0].payload.visibility).toBe('password');
    expect(settingsMsgs[0].payload.hasPassword).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — setPassword
// ---------------------------------------------------------------------------

describe('setPassword — hash storage and visibility co-update', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  it('setPassword("foo"): co-updates visibility to "password" and hasPassword to true', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    await setPassword('foo');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('password');
    expect(lobby!.hasPassword).toBe(true);
  });

  it('setPassword("foo"): setting a new password replaces the old one (no re-hash of prior)', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    await setPassword('first');
    await setPassword('second');
    const lobby = getCurrentLobby();
    expect(lobby!.visibility).toBe('password');
    expect(lobby!.hasPassword).toBe(true);
  });

  it('setPassword(null): clears the password and resets visibility to "public" when it was "password"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    await setPassword('foo');
    await setPassword(null);
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('public');
    expect(lobby!.hasPassword).toBe(false);
  });

  it('setPassword(null): does not change visibility when it was not "password"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('friends_only');
    await setPassword(null);
    const lobby = getCurrentLobby();
    expect(lobby!.visibility).toBe('friends_only');
  });

  it('setPassword is a no-op for non-host players', async () => {
    await joinLobby('ABCDEF', 'guest_sp', 'Guest');
    const before = getCurrentLobby()?.visibility;
    await setPassword('foo');
    expect(getCurrentLobby()?.visibility).toBe(before);
  });

  it('setPassword broadcasts settings after change', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    const sentBefore = mockTransport.sent.length;
    await setPassword('bar');
    const settingsMsgs = mockTransport.sent.slice(sentBefore).filter(m => m.type === 'mp:lobby:settings');
    expect(settingsMsgs.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — setMaxPlayers clamping
// ---------------------------------------------------------------------------

describe('setMaxPlayers — clamps to mode bounds', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  it('clamps below MODE_MIN_PLAYERS to the min (race min=2)', async () => {
    await makeHostLobbyPhase10('race');
    setMaxPlayers(1); // below min of 2
    expect(getCurrentLobby()!.maxPlayers).toBe(2);
  });

  it('clamps above MODE_MAX_PLAYERS to the max (race max=4)', async () => {
    await makeHostLobbyPhase10('race');
    setMaxPlayers(99);
    expect(getCurrentLobby()!.maxPlayers).toBe(4);
  });

  it('passes through valid values within the mode range', async () => {
    await makeHostLobbyPhase10('race');
    setMaxPlayers(3);
    expect(getCurrentLobby()!.maxPlayers).toBe(3);
  });

  it('trivia_night allows up to 8 players', async () => {
    await makeHostLobbyPhase10('trivia_night');
    setMaxPlayers(8);
    expect(getCurrentLobby()!.maxPlayers).toBe(8);
  });

  it('duel/coop are always 2 (clamp makes it a no-op for values outside 2)', async () => {
    await makeHostLobbyPhase10('duel');
    setMaxPlayers(4); // above duel max of 2 → clamps to 2
    expect(getCurrentLobby()!.maxPlayers).toBe(2);
    setMaxPlayers(1); // below duel min of 2 → clamps to 2
    expect(getCurrentLobby()!.maxPlayers).toBe(2);
  });

  it('setMaxPlayers is a no-op for non-host players', async () => {
    await joinLobby('ABCDEF', 'guest_mp', 'Guest');
    const before = getCurrentLobby()?.maxPlayers;
    setMaxPlayers(1);
    expect(getCurrentLobby()?.maxPlayers).toBe(before);
  });

  it('setMaxPlayers broadcasts settings on change', async () => {
    await makeHostLobbyPhase10('race');
    const sentBefore = mockTransport.sent.length;
    setMaxPlayers(3);
    const settingsMsgs = mockTransport.sent.slice(sentBefore).filter(m => m.type === 'mp:lobby:settings');
    expect(settingsMsgs.length).toBeGreaterThan(0);
    expect(settingsMsgs[0].payload.maxPlayers).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests — listPublicLobbies (broadcastBackend via localStorage)
// ---------------------------------------------------------------------------

describe('listPublicLobbies — broadcastBackend (localStorage)', () => {
  const BC_KEY = 'rr-mp:directory';

  // Write a fake directory entry directly so we don't rely on createLobby
  function writeFakeDirectory(entries: object[]) {
    localStorage.setItem(BC_KEY, JSON.stringify(entries));
  }

  function makeFakeEntry(overrides: Partial<{
    lobbyId: string;
    hostName: string;
    mode: string;
    currentPlayers: number;
    maxPlayers: number;
    visibility: string;
    createdAt: number;
    source: string;
  }> = {}) {
    return {
      lobbyId: `fake_${Math.random().toString(36).slice(2, 8)}`,
      hostName: 'Host',
      mode: 'race',
      currentPlayers: 1,
      maxPlayers: 4,
      visibility: 'public',
      createdAt: Date.now(),
      source: 'broadcast',
      ...overrides,
    };
  }

  beforeEach(() => {
    resetMockTransport();
    localStorage.clear();
    // Simulate ?mp URL param so isBroadcastMode() returns true
    Object.defineProperty(window, 'location', {
      value: { search: '?mp', href: 'http://localhost:5173?mp' },
      writable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
  });

  it('returns only entries matching mode filter', async () => {
    writeFakeDirectory([
      makeFakeEntry({ mode: 'race', lobbyId: 'race1' }),
      makeFakeEntry({ mode: 'duel', lobbyId: 'duel1' }),
      makeFakeEntry({ mode: 'race', lobbyId: 'race2' }),
    ]);
    const result = await listPublicLobbies({ mode: 'race' });
    expect(result.every(e => e.mode === 'race')).toBe(true);
    expect(result.length).toBe(2);
  });

  it('excludes friends_only entries regardless of filter', async () => {
    writeFakeDirectory([
      makeFakeEntry({ visibility: 'public' }),
      makeFakeEntry({ visibility: 'friends_only' }),
      makeFakeEntry({ visibility: 'password' }),
    ]);
    const result = await listPublicLobbies();
    expect(result.every(e => e.visibility !== 'friends_only')).toBe(true);
    expect(result.length).toBe(2);
  });

  it('fullness=open filter excludes lobbies where currentPlayers >= maxPlayers', async () => {
    writeFakeDirectory([
      makeFakeEntry({ lobbyId: 'open1', currentPlayers: 2, maxPlayers: 4 }),
      makeFakeEntry({ lobbyId: 'full1', currentPlayers: 4, maxPlayers: 4 }),
      makeFakeEntry({ lobbyId: 'open2', currentPlayers: 1, maxPlayers: 2 }),
    ]);
    const result = await listPublicLobbies({ fullness: 'open' });
    const ids = result.map(e => e.lobbyId);
    expect(ids).toContain('open1');
    expect(ids).toContain('open2');
    expect(ids).not.toContain('full1');
  });

  it('returns empty list when localStorage is empty', async () => {
    const result = await listPublicLobbies();
    expect(result).toEqual([]);
  });

  it('prunes entries older than 30 s TTL on read', async () => {
    const staleAt = Date.now() - 31_000;
    writeFakeDirectory([
      makeFakeEntry({ lobbyId: 'stale', createdAt: staleAt }),
      makeFakeEntry({ lobbyId: 'fresh', createdAt: Date.now() }),
    ]);
    const result = await listPublicLobbies();
    const ids = result.map(e => e.lobbyId);
    expect(ids).not.toContain('stale');
    expect(ids).toContain('fresh');
  });
});

// ---------------------------------------------------------------------------
// Tests — listPublicLobbies (webBackend via fetch)
// ---------------------------------------------------------------------------

describe('listPublicLobbies — webBackend (fetch)', () => {
  const mockFetch = vi.mocked(global.fetch);

  beforeEach(() => {
    resetMockTransport();
    // Ensure no ?mp param → webBackend is selected (not broadcastBackend)
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
  });

  it('GETs /mp/lobbies and returns the lobbies array', async () => {
    const fakeLobbies = [
      { lobbyId: 'web-1', hostName: 'Alice', mode: 'race', currentPlayers: 2, maxPlayers: 4, visibility: 'public', createdAt: Date.now(), source: 'web' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ lobbies: fakeLobbies }),
    } as Response);

    const result = await listPublicLobbies();
    expect(result.length).toBe(1);
    expect(result[0].lobbyId).toBe('web-1');
    expect(result[0].source).toBe('web');
  });

  it('includes mode filter as query param in the GET request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ lobbies: [] }),
    } as Response);

    await listPublicLobbies({ mode: 'race' });

    // The fetch call URL should include mode=race
    const calledUrl = mockFetch.mock.calls.at(-1)?.[0] as string;
    expect(calledUrl).toContain('mode=race');
  });

  it('includes fullness filter as query param when specified', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ lobbies: [] }),
    } as Response);

    await listPublicLobbies({ fullness: 'open' });

    const calledUrl = mockFetch.mock.calls.at(-1)?.[0] as string;
    expect(calledUrl).toContain('fullness=open');
  });

  it('returns empty array when fetch fails (non-ok response)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    } as Response);

    const result = await listPublicLobbies();
    expect(result).toEqual([]);
  });

  it('tags all returned entries with source: "web"', async () => {
    const fakeLobbies = [
      { lobbyId: 'x', hostName: 'B', mode: 'duel', currentPlayers: 1, maxPlayers: 2, visibility: 'public', createdAt: Date.now(), source: 'steam' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ lobbies: fakeLobbies }),
    } as Response);

    const result = await listPublicLobbies();
    // webBackend always stamps source: 'web' regardless of what the server returns
    expect(result[0].source).toBe('web');
  });
});

// ---------------------------------------------------------------------------
// Tests — joinLobbyById error paths (webBackend)
// ---------------------------------------------------------------------------

describe('joinLobbyById — webBackend error paths', () => {
  const mockFetch = vi.mocked(global.fetch);

  beforeEach(() => {
    resetMockTransport();
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
  });

  it('throws a useful error when the server returns 403 (wrong password)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ error: 'Wrong password' }),
    } as Response);

    await expect(
      joinLobbyById('some-lobby-id', 'player-2', 'Bob', 'wrongpassword'),
    ).rejects.toThrow(/403/);
  });

  it('throws when the server returns 409 (lobby full)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: () => Promise.resolve({ error: 'Lobby is full' }),
    } as Response);

    await expect(
      joinLobbyById('some-lobby-id', 'player-3', 'Carol'),
    ).rejects.toThrow(/409/);
  });

  it('throws when the server returns 404 (lobby not found)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Lobby not found' }),
    } as Response);

    await expect(
      joinLobbyById('nonexistent-lobby', 'player-2', 'Bob'),
    ).rejects.toThrow(/404/);
  });
});

// ---------------------------------------------------------------------------
// Tests — joinLobby rejects unknown codes (Bug 2 fix, 2026-04-20)
// ---------------------------------------------------------------------------

describe('joinLobby — rejects unknown codes when not in broadcast mode', () => {
  const mockFetch = vi.mocked(global.fetch);

  beforeEach(() => {
    resetMockTransport();
    // No ?mp param → webBackend is selected, resolveByCode makes a fetch call
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
  });

  it('throws "Lobby not found" when resolveByCode returns null (unknown code)', async () => {
    // Simulate /mp/lobbies/code/:code returning 404 → resolveByCode returns null
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({}),
    } as Response);

    await expect(
      joinLobby('ZZZZZZ', 'player-1', 'Alice'),
    ).rejects.toThrow('Lobby not found');
  });

  it('does NOT throw when resolveByCode returns null in broadcast mode (code IS the channel)', async () => {
    // In broadcast mode, resolveByCode intentionally returns null —
    // the lobbyCode is used directly as the BroadcastChannel key.
    Object.defineProperty(window, 'location', {
      value: { search: '?mp', href: 'http://localhost:5173?mp' },
      writable: true,
    });

    // broadcastBackend.resolveByCode always returns null — no fetch needed.
    // joinLobby should proceed without throwing.
    const lobby = await joinLobby('ABCDEF', 'player-bc', 'BroadcastPlayer');
    expect(lobby).not.toBeNull();
    expect(lobby.lobbyCode).toBe('ABCDEF');
  });

  it('throws "Lobby not found" when the server returns 200 with no lobbyId', async () => {
    // resolveByCode gets a 200 but the body has no lobbyId → returns null
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}), // no lobbyId field
    } as Response);

    await expect(
      joinLobby('AABBCC', 'player-2', 'Bob'),
    ).rejects.toThrow('Lobby not found');
  });

  it('joinLobbyById 404 produces user-friendly error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'lobby not found' }),
    } as Response);

    await expect(
      joinLobbyById('dead-lobby', 'p1', 'Player'),
    ).rejects.toThrow('Lobby not found or has ended.');
  });
});

// ---------------------------------------------------------------------------
// Tests — backend pick logic
// ---------------------------------------------------------------------------

describe('pickBackend — backend selection logic', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
  });

  it('selects webBackend (fetch) when hasSteam=false and no ?mp param', async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockClear();

    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });

    // listPublicLobbies with no args → should call fetch (webBackend)
    await listPublicLobbies();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/mp/lobbies'),
    );
  });

  it('selects broadcastBackend (localStorage) when hasSteam=false and ?mp param present', async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockClear();
    localStorage.clear();

    Object.defineProperty(window, 'location', {
      value: { search: '?mp', href: 'http://localhost:5173?mp' },
      writable: true,
    });

    // listPublicLobbies → should use localStorage, NOT fetch
    await listPublicLobbies();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('isBroadcastMode() returns true when ?mp is in the URL', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?mp', href: 'http://localhost:5173?mp' },
      writable: true,
    });
    expect(isBroadcastMode()).toBe(true);
  });

  it('isBroadcastMode() returns false when ?mp is absent', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost:5173' },
      writable: true,
    });
    expect(isBroadcastMode()).toBe(false);
  });
});
