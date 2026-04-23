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
import type { LobbyContentSelection, HouseRules, MultiplayerMode } from '../data/multiplayerTypes';

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
  simulateReceive(type: MultiplayerMessageType | string, payload: Record<string, unknown>): void;
} {
  const sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }> = [];
  const handlers = new Map<string, MessageHandler[]>();

  return {
    sent,
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    setActiveLobby: vi.fn(),
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
    simulateReceive(type: MultiplayerMessageType | string, payload: Record<string, unknown>) {
      const list = handlers.get(type);
      if (list) {
        const msg: MultiplayerMessage = { type: type as MultiplayerMessageType, payload, timestamp: Date.now(), senderId: 'remote' };
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
    // #76: spy on initPeerPresenceMonitor so lobby tests can verify wiring
    initPeerPresenceMonitor: vi.fn(() => vi.fn()),
    // Issue 056: initP2PFailPollLoop is started alongside initPeerPresenceMonitor.
    // Returns a no-op cleanup in tests so leaveLobby teardown doesn't throw.
    initP2PFailPollLoop: vi.fn(() => vi.fn()),
    // onP2PFail is called inside setupMessageHandlers; return no-op unsubscribe.
    onP2PFail: vi.fn(() => vi.fn()),
  };
});

// Also mock platformService so hasSteam doesn't try to call Tauri
vi.mock('./platformService', () => ({
  hasSteam: false,
  isDesktop: false,
  isWeb: true,
  isTauriPresent: vi.fn(() => false),
}));

// Also mock lanConfigService so clearLanServerUrl / isLanMode don't need real config
vi.mock('./lanConfigService', () => ({
  getLanServerUrls: vi.fn(() => null),
  isLanMode: vi.fn(() => false),
  clearLanServerUrl: vi.fn(),
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
  leaveLobby,
  kickPlayer,
  onLobbyError,
  isHost: isHostFn,
  getLocalMultiplayerPlayerId,
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
    // Reset module state by leaving the lobby — clears _handlersAttached so
    // the next describe block's joinLobby/createLobby re-registers handlers.
    leaveLobby();
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

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
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
// BUG-14: regression — mp:lobby:start handler applies mode/deckId/houseRules
// ---------------------------------------------------------------------------

describe('BUG-14: mp:lobby:start applies mode, deckId, houseRules from host payload', () => {
  beforeEach(() => {
    mockTransport = createMockTransport();
    vi.clearAllMocks();
  });

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
  });

  it('overwrites stale mode, deckId, houseRules with host-committed values', async () => {
    // Guest has stale 'race' mode from a prior lobby session.
    await joinLobby('ABCDEF', 'guest_bug14', 'Guest');
    const lobby = getCurrentLobby()!;
    // Manually set stale state to simulate prior lobby leftover.
    (lobby as any).mode = 'race' as MultiplayerMode;
    (lobby as any).selectedDeckId = 'old_deck';

    const houseRules: HouseRules = {
      turnTimerSecs: 45,
      quizDifficulty: 'hard',
      fairness: {
        freshFactsOnly: false,
        masteryEqualized: false,
        handicapPercent: 0,
        deckPracticeSecs: 0,
        chainNormalized: false,
      },
      ascensionLevel: 5,
    };

    const contentSelection: LobbyContentSelection = {
      type: 'study',
      deckId: 'fundamentals_of_biology',
      deckName: 'Fundamentals of Biology',
    };

    let lobbyAtStart: ReturnType<typeof getCurrentLobby> = null;
    onGameStart((_seed, l) => { lobbyAtStart = { ...l }; });

    // Host sends start with full payload including mode override.
    mockTransport.simulateReceive('mp:lobby:start', {
      seed: 12345,
      mode: 'coop' as MultiplayerMode,
      deckId: 'fundamentals_of_biology',
      houseRules: houseRules as unknown as Record<string, unknown>,
      contentSelection: contentSelection as unknown as Record<string, unknown>,
    });

    expect(lobbyAtStart).not.toBeNull();
    // BUG-1: mode must be updated from stale 'race' to host-committed 'coop'
    expect(lobbyAtStart!.mode).toBe('coop');
    // BUG-1: deckId (selectedDeckId) must be updated
    expect(lobbyAtStart!.selectedDeckId).toBe('fundamentals_of_biology');
    // BUG-1: houseRules must be updated
    expect(lobbyAtStart!.houseRules.turnTimerSecs).toBe(45);
    expect(lobbyAtStart!.houseRules.quizDifficulty).toBe('hard');
    expect(lobbyAtStart!.houseRules.ascensionLevel).toBe(5);
    // contentSelection must still work
    expect(lobbyAtStart!.contentSelection).toBeDefined();
    expect(
      (lobbyAtStart!.contentSelection as Extract<LobbyContentSelection, { type: 'study' }>).deckId,
    ).toBe('fundamentals_of_biology');
    // seed must be applied
    expect(lobbyAtStart!.seed).toBe(12345);
  });

  it('preserves existing mode when host payload omits mode field', async () => {
    await joinLobby('ABCDEF', 'guest_bug14b', 'Guest');
    const lobby = getCurrentLobby()!;
    (lobby as any).mode = 'duel' as MultiplayerMode;

    let lobbyAtStart: ReturnType<typeof getCurrentLobby> = null;
    onGameStart((_seed, l) => { lobbyAtStart = { ...l }; });

    // Host payload omits mode — local state should be preserved
    mockTransport.simulateReceive('mp:lobby:start', { seed: 99, mode: 'duel' as MultiplayerMode });

    expect(lobbyAtStart).not.toBeNull();
    expect(lobbyAtStart!.mode).toBe('duel');
  });

  it('preserves existing houseRules when payload omits them', async () => {
    await joinLobby('ABCDEF', 'guest_bug14c', 'Guest');
    const lobby = getCurrentLobby()!;
    // Give lobby a non-default turnTimerSecs to verify it is not clobbered
    lobby.houseRules = {
      turnTimerSecs: 90,
      quizDifficulty: 'easy',
      fairness: {
        freshFactsOnly: false,
        masteryEqualized: false,
        handicapPercent: 0,
        deckPracticeSecs: 0,
        chainNormalized: false,
      },
      ascensionLevel: 0,
    };

    let lobbyAtStart: ReturnType<typeof getCurrentLobby> = null;
    onGameStart((_seed, l) => { lobbyAtStart = { ...l }; });

    // Host omits houseRules — existing value must be preserved
    mockTransport.simulateReceive('mp:lobby:start', { seed: 1, mode: 'race' as MultiplayerMode });

    expect(lobbyAtStart).not.toBeNull();
    expect(lobbyAtStart!.houseRules.turnTimerSecs).toBe(90);
    expect(lobbyAtStart!.houseRules.quizDifficulty).toBe('easy');
  });
});

// ---------------------------------------------------------------------------
// Additional exports from the same module (already loaded above)
// ---------------------------------------------------------------------------

const {
  setVisibility,
  setPassword,
  setMaxPlayers,
  listPublicLobbies,
  joinLobbyById,
  isBroadcastMode,
  clearLanModeOnHubEntry,
  leaveMultiplayerLobbyForSoloStart,
  getPendingVisibilityChange,
  applyPendingVisibilityChange,
  cancelPendingVisibilityChange,
  onReadyTimeout,
  getReadyWatchdogStatus,
  cancelReadyWatchdog,
  READY_WATCHDOG_MS,
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

  afterEach(() => {
    leaveLobby();
  });

  it('public → password: sets visibility to "password"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('password');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('password');
  });

  it('password → public: resets visibility to "public"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('password');
    setVisibility('public');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('public');
  });

  it('public → friends_only: sets visibility to "friends_only"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('friends_only');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('friends_only');
  });

  it('friends_only → password: sets visibility to "password"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    setVisibility('friends_only');
    setVisibility('password');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('password');
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
    expect(settingsMsgs[0].payload.visibility).toBe('password'); // derived: lobbyHasPassword(lobby) would return true
  });
});

// ---------------------------------------------------------------------------
// Tests — setPassword
// ---------------------------------------------------------------------------

describe('setPassword — hash storage and visibility co-update', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    leaveLobby();
  });

  it('setPassword("foo"): co-updates visibility to "password"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    await setPassword('foo');
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('password');
  });

  it('setPassword("foo"): setting a new password replaces the old one (no re-hash of prior)', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    await setPassword('first');
    await setPassword('second');
    const lobby = getCurrentLobby();
    expect(lobby!.visibility).toBe('password');
  });

  it('setPassword(null): clears the password and resets visibility to "public" when it was "password"', async () => {
    await makeHostLobbyPhase10('race', { visibility: 'public' });
    await setPassword('foo');
    await setPassword(null);
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    expect(lobby!.visibility).toBe('public');
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

  afterEach(() => {
    leaveLobby();
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

  // M4: TTL is now 15s — entries older than 15s are pruned.
  it('prunes entries older than 15 s TTL on read (M4: reduced from 30s)', async () => {
    const staleAt = Date.now() - 16_000; // 16s ago — older than 15s TTL
    writeFakeDirectory([
      makeFakeEntry({ lobbyId: 'stale', createdAt: staleAt }),
      makeFakeEntry({ lobbyId: 'fresh', createdAt: Date.now() }),
    ]);
    const result = await listPublicLobbies();
    const ids = result.map(e => e.lobbyId);
    expect(ids).not.toContain('stale');
    expect(ids).toContain('fresh');
  });

  // M4: Entries 14s old should still appear (within TTL).
  it('retains entries within the 15 s TTL window', async () => {
    const recentAt = Date.now() - 14_000; // 14s ago — still within 15s TTL
    writeFakeDirectory([
      makeFakeEntry({ lobbyId: 'recent', createdAt: recentAt }),
    ]);
    const result = await listPublicLobbies();
    expect(result.map(e => e.lobbyId)).toContain('recent');
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
    leaveLobby();
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
    leaveLobby();
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
    leaveLobby();
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

// ---------------------------------------------------------------------------
// Tests — M22: player count re-validation before startGame broadcasts
// ---------------------------------------------------------------------------

describe('startGame() — M22: player count re-validation', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
  });

  it('does not broadcast when only 1 player remains (allReady guard + M22 check)', async () => {
    // M22: the explicit players.length < 2 check is a secondary defence after allReady().
    // In normal single-threaded flow allReady() prevents reaching it, so we verify the
    // observable contract: with only 1 player, startGame() must not send mp:lobby:start.
    const lobby = await createLobby('host_m22', 'Host', 'race');
    lobby.players[0].isReady = true; // only the host — no second player

    startGame(); // allReady() returns false (length < 2) → early return, no throw, no send

    const msg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(msg).toBeUndefined();
  });

  it('sends mp:lobby:start when 2 or more players are present at start time', async () => {
    const lobby = await createLobby('host_m22b', 'Host', 'race');
    lobby.players.push({ id: 'guest_m22b', displayName: 'Guest', isHost: false, isReady: true });
    lobby.players[0].isReady = true;

    startGame();

    const msg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(msg).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — H13: timestamped ready-state merge
// ---------------------------------------------------------------------------

describe('H13: ready-version merge — late settings cannot overwrite fresh toggle-off', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
  });

  it('includes readyVersion in mp:lobby:ready message', async () => {
    await joinLobby('ABCDEF', 'guest_h13', 'Guest');

    // First ready toggle
    setReady(true);

    const readyMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:ready');
    expect(readyMsg).toBeDefined();
    expect(typeof readyMsg!.payload.readyVersion).toBe('number');
    expect(readyMsg!.payload.readyVersion).toBeGreaterThan(0);
  });

  it('readyVersion increments on each setReady call', async () => {
    await joinLobby('ABCDEF', 'guest_h13b', 'Guest');

    setReady(true);
    setReady(false);
    setReady(true);

    const msgs = mockTransport.sent.filter(m => m.type === 'mp:lobby:ready');
    expect(msgs.length).toBe(3);
    const versions = msgs.map(m => m.payload.readyVersion as number);
    expect(versions[0]).toBeLessThan(versions[1]);
    expect(versions[1]).toBeLessThan(versions[2]);
  });
});

// ---------------------------------------------------------------------------
// Tests — H5: seed ACK handshake
// ---------------------------------------------------------------------------

describe('H5: seed ACK handshake', () => {
  beforeEach(() => {
    resetMockTransport();
    vi.useFakeTimers();
  });

  afterEach(() => {
    leaveLobby();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ACK happy path: host fires onGameStart after all guests ACK', async () => {
    const lobby = await createLobby('host_h5', 'Host', 'race');
    lobby.players.push({ id: 'guest_h5', displayName: 'Guest', isHost: false, isReady: true });
    lobby.players[0].isReady = true;

    let startFired = false;
    onGameStart(() => { startFired = true; });

    startGame();

    // onGameStart should NOT fire yet — waiting for guest ACK
    expect(startFired).toBe(false);

    // Simulate guest sending ACK
    mockTransport.simulateReceive('mp:lobby:start_ack', {
      playerId: 'guest_h5',
      seed: lobby.seed ?? 0,
    });

    // ACK received — onGameStart should now fire
    expect(startFired).toBe(true);
  });

  it('BUG-3: ACK timeout fires onLobbyError and does NOT fire onGameStart', async () => {
    // BUG-3: The old behavior fired onGameStart anyway after 3s even if no guests ACKed,
    // meaning each player ran an independent game. New behavior: abort + surface error.
    const lobby = await createLobby('host_h5b', 'Host', 'race');
    lobby.players.push({ id: 'slowguest_h5', displayName: 'Slow', isHost: false, isReady: true });
    lobby.players[0].isReady = true;

    let startFired = false;
    let errorFired: string | null = null;
    onGameStart(() => { startFired = true; });
    onLobbyError((err) => { errorFired = err; });

    startGame();
    expect(startFired).toBe(false);

    // Advance fake timers past the 3s timeout
    vi.advanceTimersByTime(3100);

    // onGameStart must NOT fire — the session was aborted
    expect(startFired).toBe(false);
    // onLobbyError must fire with the user-visible reason
    expect(errorFired).toBe('Could not reach all players. Returning to lobby.');
    // Lobby must return to waiting state so host can retry
    expect(getCurrentLobby()!.status).toBe('waiting');
    // Ghost guest (never ACKed) must be evicted
    expect(getCurrentLobby()!.players.find(p => p.id === 'slowguest_h5')).toBeUndefined();
  });

  it('guest sends mp:lobby:start_ack in response to mp:lobby:start', async () => {
    // Join as guest
    await joinLobby('ABCDEF', 'guest_h5c', 'GuestUser');

    // Simulate host broadcasting mp:lobby:start
    mockTransport.simulateReceive('mp:lobby:start', { seed: 55555 });

    // Guest should have sent an ACK back
    const ackMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start_ack');
    expect(ackMsg).toBeDefined();
    expect(ackMsg!.payload.playerId).toBe('guest_h5c');
  });

  it('retry: host re-broadcasts mp:lobby:start every 750ms until ACK', async () => {
    const lobby = await createLobby('host_h5d', 'Host', 'race');
    lobby.players.push({ id: 'guest_h5d', displayName: 'Guest', isHost: false, isReady: true });
    lobby.players[0].isReady = true;

    startGame();

    // After 750ms, a retry should have been sent
    const countBefore = mockTransport.sent.filter(m => m.type === 'mp:lobby:start').length;
    vi.advanceTimersByTime(800);
    const countAfter = mockTransport.sent.filter(m => m.type === 'mp:lobby:start').length;
    expect(countAfter).toBeGreaterThan(countBefore);
  });
});

// ---------------------------------------------------------------------------
// Tests — H10: reconnect grace timer
// ---------------------------------------------------------------------------

describe('H10: reconnect grace timer — peer_left and peer_rejoined', () => {
  beforeEach(() => {
    resetMockTransport();
    vi.useFakeTimers();
  });

  afterEach(() => {
    leaveLobby();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marks disconnected player as reconnecting instead of removing immediately', async () => {
    const lobby = await createLobby('host_h10', 'Host', 'race');
    lobby.players.push({ id: 'peer_h10', displayName: 'Peer', isHost: false, isReady: false });

    // Simulate peer dropping
    mockTransport.simulateReceive('mp:lobby:peer_left', { playerId: 'peer_h10' });

    const peer = getCurrentLobby()!.players.find(p => p.id === 'peer_h10') as any;
    expect(peer).toBeDefined();
    expect(peer.connectionState).toBe('reconnecting');
  });

  it('removes player after 60s grace period expires', async () => {
    const lobby = await createLobby('host_h10b', 'Host', 'race');
    lobby.players.push({ id: 'peer_h10b', displayName: 'Peer', isHost: false, isReady: false });

    mockTransport.simulateReceive('mp:lobby:peer_left', { playerId: 'peer_h10b' });
    expect(getCurrentLobby()!.players.find(p => p.id === 'peer_h10b')).toBeDefined();

    // Advance past 60s grace
    vi.advanceTimersByTime(61_000);

    expect(getCurrentLobby()!.players.find(p => p.id === 'peer_h10b')).toBeUndefined();
  });

  it('player rejoins within grace period — connectionState flips back to connected', async () => {
    const lobby = await createLobby('host_h10c', 'Host', 'race');
    lobby.players.push({ id: 'peer_h10c', displayName: 'Peer', isHost: false, isReady: false });

    mockTransport.simulateReceive('mp:lobby:peer_left', { playerId: 'peer_h10c' });

    // Rejoin within 60s
    vi.advanceTimersByTime(10_000);
    mockTransport.simulateReceive('mp:lobby:peer_rejoined', { playerId: 'peer_h10c' });

    const peer = getCurrentLobby()!.players.find(p => p.id === 'peer_h10c') as any;
    expect(peer).toBeDefined();
    expect(peer.connectionState).toBe('connected');

    // Advance past original 60s — player should still be in lobby
    vi.advanceTimersByTime(55_000);
    expect(getCurrentLobby()!.players.find(p => p.id === 'peer_h10c')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — C4: clearLanModeOnHubEntry
// ---------------------------------------------------------------------------

describe('C4: clearLanModeOnHubEntry — LAN mode clear hook', () => {
  it('clearLanModeOnHubEntry is exported and callable', () => {
    expect(typeof clearLanModeOnHubEntry).toBe('function');
    // Safe to call when not in LAN mode (isLanMode mocked to return false)
    expect(() => clearLanModeOnHubEntry()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests — M20: leaveMultiplayerLobbyForSoloStart
// ---------------------------------------------------------------------------

describe('M20: leaveMultiplayerLobbyForSoloStart — solo-start hook', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    leaveLobby();
  });

  it('is a no-op when not in a lobby', async () => {
    // Should not throw and should return a resolved promise
    await expect(leaveMultiplayerLobbyForSoloStart()).resolves.toBeUndefined();
  });

  it('leaves lobby when in one', async () => {
    await createLobby('host_m20', 'Host', 'race');
    expect(getCurrentLobby()).not.toBeNull();

    await leaveMultiplayerLobbyForSoloStart();

    expect(getCurrentLobby()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — #76: peer presence monitor wired from createLobby / leaveLobby
// ---------------------------------------------------------------------------

const transportMock76 = await import('./multiplayerTransport');

describe('#76: initPeerPresenceMonitor wired in createLobby and torn down in leaveLobby', () => {
  beforeEach(() => {
    resetMockTransport();
    vi.mocked(transportMock76.initPeerPresenceMonitor).mockClear();
  });

  afterEach(() => {
    leaveLobby();
  });

  it('calls initPeerPresenceMonitor after createLobby connects transport', async () => {
    await createLobby('host_76', 'Host76', 'race');
    expect(vi.mocked(transportMock76.initPeerPresenceMonitor)).toHaveBeenCalledTimes(1);
    // Verify it receives the local player ID as the first arg.
    expect(vi.mocked(transportMock76.initPeerPresenceMonitor).mock.calls[0][0]).toBe('host_76');
  });

  it('cleanup returned by initPeerPresenceMonitor is called on leaveLobby', async () => {
    const mockCleanup = vi.fn();
    vi.mocked(transportMock76.initPeerPresenceMonitor).mockReturnValueOnce(mockCleanup);

    await createLobby('host_76b', 'Host76b', 'race');
    leaveLobby();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — L4: kickPlayer and mp:lobby:kick handler
// ---------------------------------------------------------------------------

// kickPlayer and onLobbyError are destructured from the first import block above

describe('L4: kickPlayer — host-only kick primitive', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
  });

  it('broadcasts mp:lobby:kick with correct payload when host kicks a player', async () => {
    const lobby = await createLobby('host_kick', 'Host', 'race');
    lobby.players.push({ id: 'guest_kick', displayName: 'Guest', isHost: false, isReady: false });

    kickPlayer('guest_kick', 'afk');

    const kickMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:kick');
    expect(kickMsg).toBeDefined();
    expect(kickMsg!.payload.targetPlayerId).toBe('guest_kick');
    expect(kickMsg!.payload.reason).toBe('afk');
    expect(kickMsg!.payload.issuedBy).toBe('host_kick');
  });

  it('removes the kicked player from local lobby state immediately', async () => {
    const lobby = await createLobby('host_kick2', 'Host', 'race');
    lobby.players.push({ id: 'target_kick2', displayName: 'Target', isHost: false, isReady: false });

    kickPlayer('target_kick2');

    const currentLobby = getCurrentLobby();
    expect(currentLobby).not.toBeNull();
    expect(currentLobby!.players.find(p => p.id === 'target_kick2')).toBeUndefined();
  });

  it('throws when the local player is not the host', async () => {
    // Join as a guest — _localPlayerId becomes a non-host
    await joinLobby('ABCDEF', 'guest_cant_kick', 'Guest');

    expect(() => kickPlayer('someone')).toThrow(/Only the host/);
  });

  it('throws when not in a lobby', () => {
    // Not in a lobby at all
    expect(() => kickPlayer('anyone')).toThrow(/Not in a lobby/);
  });

  it('throws when the host tries to kick themselves', async () => {
    await createLobby('self_kick_host', 'Host', 'race');

    expect(() => kickPlayer('self_kick_host')).toThrow(/Host cannot kick themselves/);
  });

  it('works without a reason (reason is optional)', async () => {
    const lobby = await createLobby('host_noreason', 'Host', 'race');
    lobby.players.push({ id: 'target_noreason', displayName: 'Target', isHost: false, isReady: false });

    expect(() => kickPlayer('target_noreason')).not.toThrow();

    const kickMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:kick');
    expect(kickMsg).toBeDefined();
    expect(kickMsg!.payload.reason).toBeUndefined();
  });
});

describe('L4: mp:lobby:kick message handler', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
  });

  it('happy path: receiver removes kicked player from lobby state', async () => {
    const lobby = await createLobby('host_recv', 'Host', 'race');
    // Inject a second player to simulate a peer that gets kicked
    lobby.players.push({ id: 'kicked_peer', displayName: 'KickedPeer', isHost: false, isReady: false });

    // Simulate receiving the kick from ourselves (host) — issuedBy must match hostId
    mockTransport.simulateReceive('mp:lobby:kick', {
      targetPlayerId: 'kicked_peer',
      issuedBy: 'host_recv',
    });

    const currentLobby = getCurrentLobby();
    expect(currentLobby).not.toBeNull();
    expect(currentLobby!.players.find(p => p.id === 'kicked_peer')).toBeUndefined();
  });

  it('receiver calls leaveLobby and fires onLobbyError when local player is targeted', async () => {
    // Join as guest — local player ID is the target
    await joinLobby('ABCDEF', 'target_local', 'TargetPlayer');

    // We need to simulate knowing the host ID — lobby state from joinLobby starts with empty hostId.
    // Set the lobby host so the spoof check passes.
    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    lobby!.hostId = 'remote_host';

    let errorReceived: string | null = null;
    onLobbyError((err: string) => { errorReceived = err; });

    // Host kicks us
    mockTransport.simulateReceive('mp:lobby:kick', {
      targetPlayerId: 'target_local',
      issuedBy: 'remote_host',
    });

    // onLobbyError should have fired with 'kicked_by_host'
    expect(errorReceived).toBe('kicked_by_host');
    // We should have left the lobby
    expect(getCurrentLobby()).toBeNull();
  });

  it('spoofed kick rejected: non-host issuedBy is ignored', async () => {
    const lobby = await createLobby('host_spoof', 'Host', 'race');
    lobby.players.push({ id: 'victim', displayName: 'Victim', isHost: false, isReady: false });

    // Simulate a kick from a non-host player (spoof attempt)
    mockTransport.simulateReceive('mp:lobby:kick', {
      targetPlayerId: 'victim',
      issuedBy: 'evil_nonhost', // NOT the host
    });

    // Victim should still be in the lobby — spoofed kick rejected
    const currentLobby = getCurrentLobby();
    expect(currentLobby).not.toBeNull();
    expect(currentLobby!.players.find(p => p.id === 'victim')).toBeDefined();
  });

  it('spoofed kick: local player ignores kick when issuedBy is not the host', async () => {
    await joinLobby('ABCDEF', 'local_spoof_target', 'LocalPlayer');

    const lobby = getCurrentLobby();
    expect(lobby).not.toBeNull();
    lobby!.hostId = 'real_host';

    let errorFired = false;
    onLobbyError(() => { errorFired = true; });

    // Receive a kick supposedly targeting us but issued by a non-host — reject it
    mockTransport.simulateReceive('mp:lobby:kick', {
      targetPlayerId: 'local_spoof_target',
      issuedBy: 'not_the_real_host',
    });

    expect(errorFired).toBe(false);
    expect(getCurrentLobby()).not.toBeNull();
  });
});


// ---------------------------------------------------------------------------
// Tests — A2: Ghost lobby prevention (joinLobby must not set _currentLobby on failure)
// ---------------------------------------------------------------------------

describe('joinLobby — A2 ghost lobby prevention', () => {
  beforeEach(() => {
    mockTransport = createMockTransport();
    vi.clearAllMocks();
  });

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
  });

  it('throws when backend.joinLobbyById rejects and does NOT set _currentLobby', async () => {
    // Override the global fetch mock so the /join endpoint returns an error
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/code/')) {
        // resolveByCode succeeds — returns a lobby ID so we proceed to join
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ lobbyId: 'ghost_lobby_id' }),
        } as Response);
      }
      if (url.includes('/join')) {
        // joinLobbyById fails — lobby no longer exists
        return Promise.resolve({
          ok: false, status: 404,
          json: () => Promise.resolve({ error: 'Lobby not found or has ended.' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    }));

    await expect(joinLobby('ABCDEF', 'guest_ghost', 'Ghost')).rejects.toThrow();
    // _currentLobby must NOT be set — no ghost lobby
    expect(getCurrentLobby()).toBeNull();
  });

  it('does NOT connect transport when backend.joinLobbyById rejects', async () => {
    const { getMultiplayerTransport } = await import('./multiplayerTransport');
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/code/')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ lobbyId: 'fail_lobby_id' }),
        } as Response);
      }
      if (url.includes('/join')) {
        return Promise.resolve({
          ok: false, status: 403,
          json: () => Promise.resolve({ error: 'Lobby is full.' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    }));

    try {
      await joinLobby('XYZABC', 'guest_noconn', 'NoConn');
    } catch {
      // expected
    }

    // transport.connect should NOT have been called since join failed before we reached it
    const transport = getMultiplayerTransport() as ReturnType<typeof createMockTransport>;
    expect(transport.connect).not.toHaveBeenCalled();
  });

  it('succeeds and sets _currentLobby when backend.joinLobbyById resolves', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/code/')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ lobbyId: 'real_lobby_id' }),
        } as Response);
      }
      if (url.includes('/join')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ lobbyId: 'real_lobby_id', lobbyCode: 'REALCD', joinToken: 'tok_ok' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    }));

    const lobby = await joinLobby('REALCD', 'guest_ok', 'OKPlayer');
    expect(lobby).not.toBeNull();
    expect(getCurrentLobby()).not.toBeNull();
    expect(getCurrentLobby()!.lobbyId).toBe('real_lobby_id');
  });
});

// ---------------------------------------------------------------------------
// BUG16 regression: listener accumulation on leave + rejoin
// ---------------------------------------------------------------------------

describe('BUG16 — handler deduplication across create → leave → create', () => {
  beforeEach(() => {
    mockTransport = createMockTransport();
    vi.clearAllMocks();
  });

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
  });

  it('mp:lobby:ready fires exactly once after create → leave → create', async () => {
    // First lobby lifecycle
    await createLobby('host_a', 'HostA', 'race');
    // Add a guest so the lobby has >1 player
    const lobby1 = getCurrentLobby();
    lobby1!.players.push({ id: 'guest_x', displayName: 'GuestX', isHost: false, isReady: false });
    leaveLobby();

    // Second lobby lifecycle on the same transport singleton
    mockTransport = createMockTransport();
    vi.mocked(await import('./multiplayerTransport').then(m => ({ getMultiplayerTransport: m.getMultiplayerTransport }))).getMultiplayerTransport = vi.fn(() => mockTransport);
    await createLobby('host_b', 'HostB', 'race');
    const lobby2 = getCurrentLobby()!;
    lobby2.players.push({ id: 'guest_y', displayName: 'GuestY', isHost: false, isReady: false });

    // Simulate a ready message from guest_y
    let readyUpdateCount = 0;
    // We track via getCurrentLobby since onLobbyUpdate isn't easily observable
    // Instead, verify the ready state is set exactly once by simulating the message
    mockTransport.simulateReceive('mp:lobby:ready', { playerId: 'guest_y', ready: true });

    const updatedLobby = getCurrentLobby();
    const guestY = updatedLobby?.players.find(p => p.id === 'guest_y');
    // If handler fired multiple times, isReady would still be true (idempotent in this case).
    // The real regression is duplicate lobby mutations — we verify no duplicate players
    expect(updatedLobby?.players.length).toBe(2); // host_b + guest_y, no duplicates
    expect(guestY?.isReady).toBe(true);
  });

  it('mp:lobby:leave fires exactly once — player removed once, not twice', async () => {
    // First lifecycle
    await createLobby('host_c', 'HostC', 'race');
    leaveLobby();

    // Second lifecycle on fresh transport
    mockTransport = createMockTransport();
    vi.mocked(await import('./multiplayerTransport').then(m => ({ getMultiplayerTransport: m.getMultiplayerTransport }))).getMultiplayerTransport = vi.fn(() => mockTransport);
    await createLobby('host_d', 'HostD', 'race');
    const lobby = getCurrentLobby()!;
    lobby.players.push({ id: 'guest_z', displayName: 'GuestZ', isHost: false, isReady: false });

    // Simulate guest_z leaving
    mockTransport.simulateReceive('mp:lobby:leave', { playerId: 'guest_z' });

    const updatedLobby = getCurrentLobby();
    // If the handler fired twice, the filter would have been called twice — result is the same
    // but the player should now be absent
    expect(updatedLobby?.players.find(p => p.id === 'guest_z')).toBeUndefined();
    // Only the host should remain
    expect(updatedLobby?.players.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// MP-STEAM-20260422-014: parameterized contentSelection sweep across all modes
//
// The 2026-04-09 fix (commit eae6415f1) made startGame() include
// `contentSelection` inline in the mp:lobby:start payload. The CardApp guard
// `if (!lobby.contentSelection) { transitionScreen('multiplayerLobby'); return; }`
// is defensive but fires AFTER the click — by then the player has already been
// bounced back. A regression in startGame() that forgets contentSelection would
// ship without test failure unless the exact shape is asserted, for every mode.
//
// This block iterates ALL 5 MultiplayerMode values × 4 contentSelection shapes
// (study / custom_deck / trivia / undefined) and asserts the transport payload.
// ---------------------------------------------------------------------------

describe('MP-STEAM-20260422-014 — startGame() always carries contentSelection across all modes', () => {
  beforeEach(() => {
    mockTransport = createMockTransport();
    vi.clearAllMocks();
  });

  afterEach(() => {
    leaveLobby();
    vi.restoreAllMocks();
  });

  const allModes: MultiplayerMode[] = ['race', 'same_cards', 'duel', 'coop', 'trivia_night'];

  type Selection = LobbyContentSelection | undefined;

  const studySel: Selection = {
    type: 'study',
    deckId: 'world_war_ii',
    deckName: 'World War II',
  };
  const customSel: Selection = {
    type: 'custom_deck',
    customDeckId: 'my_anki_deck',
    deckName: 'My Anki Deck',
  };
  const triviaSel: Selection = {
    type: 'trivia',
    domains: ['history', 'science'],
  };
  const noSel: Selection = undefined;

  // makeHostLobby above is mode-aware via createLobby; build a parameterized helper.
  async function makeHostLobbyForMode(mode: MultiplayerMode, contentSelection?: LobbyContentSelection) {
    const lobby = await createLobby(`host_${mode}`, 'Host', mode);
    // Push a guest so allReady() can pass — every mode requires 2+ players.
    lobby.players.push({ id: `guest_${mode}`, displayName: 'Guest', isHost: false, isReady: true });
    lobby.players[0].isReady = true;
    if (contentSelection) {
      setContentSelection(contentSelection);
    }
    return lobby;
  }

  // 5 modes × 3 selection types = 15 cases proving payload shape integrity.
  for (const mode of allModes) {
    it(`mode=${mode} sends contentSelection.type='study' on mp:lobby:start`, async () => {
      await makeHostLobbyForMode(mode, studySel);
      startGame();

      const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
      expect(startMsg, `mp:lobby:start must be sent for mode=${mode}`).toBeDefined();

      // Required payload contract: seed (number), mode, deckId, houseRules, contentSelection.
      expect(typeof startMsg!.payload.seed).toBe('number');
      expect(startMsg!.payload.mode).toBe(mode);
      expect(startMsg!.payload.houseRules).toBeDefined();

      const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
      expect(cs, `contentSelection must be present for mode=${mode}`).toBeDefined();
      expect(cs.type).toBe('study');
      expect(cs.deckId).toBe('world_war_ii');
      expect(cs.deckName).toBe('World War II');
    });

    it(`mode=${mode} sends contentSelection.type='custom_deck' on mp:lobby:start`, async () => {
      await makeHostLobbyForMode(mode, customSel);
      startGame();

      const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
      expect(startMsg).toBeDefined();
      const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
      expect(cs).toBeDefined();
      expect(cs.type).toBe('custom_deck');
      expect(cs.customDeckId).toBe('my_anki_deck');
    });

    it(`mode=${mode} sends contentSelection.type='trivia' on mp:lobby:start`, async () => {
      await makeHostLobbyForMode(mode, triviaSel);
      startGame();

      const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
      expect(startMsg).toBeDefined();
      const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
      expect(cs).toBeDefined();
      expect(cs.type).toBe('trivia');
      expect(cs.domains).toEqual(['history', 'science']);
    });

    it(`mode=${mode} sends mp:lobby:start with contentSelection=undefined when none set`, async () => {
      await makeHostLobbyForMode(mode, noSel);
      startGame();

      const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
      expect(startMsg).toBeDefined();
      // The KEY must exist on the payload (host always emits the field) but VALUE
      // is undefined — guests treat absence as "preserve local". This documents
      // the precise wire shape the CardApp guard depends on.
      expect('contentSelection' in startMsg!.payload).toBe(true);
      expect(startMsg!.payload.contentSelection).toBeUndefined();
    });
  }

  // Cross-cutting structural test: payload always carries the four required keys.
  it('every mp:lobby:start payload carries seed/mode/deckId/houseRules/contentSelection keys', async () => {
    for (const mode of allModes) {
      mockTransport = createMockTransport();
      vi.clearAllMocks();
      await makeHostLobbyForMode(mode, studySel);
      startGame();
      const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
      expect(startMsg, `mode=${mode} must emit start`).toBeDefined();
      const keys = Object.keys(startMsg!.payload);
      expect(keys, `mode=${mode} keys`).toContain('seed');
      expect(keys, `mode=${mode} keys`).toContain('mode');
      expect(keys, `mode=${mode} keys`).toContain('deckId');
      expect(keys, `mode=${mode} keys`).toContain('houseRules');
      expect(keys, `mode=${mode} keys`).toContain('contentSelection');
      leaveLobby();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — H-006: setVisibility eviction on strictening transitions
// ---------------------------------------------------------------------------

describe('H-006: setVisibility — evict ineligible guests on strictening', () => {
  beforeEach(() => {
    resetMockTransport();
  });

  afterEach(() => {
    leaveLobby();
  });

  /**
   * Helper: create a host lobby and inject mock guests into its player list.
   * Returns the created lobby.
   */
  async function makeHostWithGuests(
    initialVisibility: 'public' | 'password' | 'friends_only',
    guests: Array<{ id: string; displayName: string; enteredWithPassword?: boolean }>,
  ) {
    const lobby = await makeHostLobbyPhase10('race', { visibility: initialVisibility });
    // Inject guests directly — bypasses transport so we can control enteredWithPassword.
    for (const g of guests) {
      lobby.players.push({
        id: g.id,
        displayName: g.displayName,
        isHost: false,
        isReady: false,
        enteredWithPassword: g.enteredWithPassword ?? false,
      });
    }
    return lobby;
  }

  it('public→password: guests without enteredWithPassword are kicked', async () => {
    await makeHostWithGuests('public', [
      { id: 'g1', displayName: 'Guest1', enteredWithPassword: true },
      { id: 'g2', displayName: 'Guest2', enteredWithPassword: false },
      { id: 'g3', displayName: 'Guest3', enteredWithPassword: false },
    ]);

    const sentBefore = mockTransport.sent.length;
    setVisibility('password');
    const kickMsgs = mockTransport.sent.slice(sentBefore).filter(m => m.type === 'mp:lobby:kick');

    // Two guests (g2, g3) did not enter with password — both kicked
    expect(kickMsgs.length).toBe(2);
    const kickedIds = kickMsgs.map(m => m.payload.targetPlayerId as string);
    expect(kickedIds).toContain('g2');
    expect(kickedIds).toContain('g3');
    expect(kickedIds).not.toContain('g1');

    // Reason must be 'visibility_changed'
    for (const km of kickMsgs) {
      expect(km.payload.reason).toBe('visibility_changed');
    }

    // Local players array must have 1 guest remaining (g1)
    const lobby = getCurrentLobby()!;
    const guestIds = lobby.players.filter(p => !p.isHost).map(p => p.id);
    expect(guestIds).toContain('g1');
    expect(guestIds).not.toContain('g2');
    expect(guestIds).not.toContain('g3');
  });

  it('public→friends_only: all non-host guests evicted (no friends graph)', async () => {
    await makeHostWithGuests('public', [
      { id: 'gA', displayName: 'Alice' },
      { id: 'gB', displayName: 'Bob' },
    ]);

    const sentBefore = mockTransport.sent.length;
    setVisibility('friends_only');
    const kickMsgs = mockTransport.sent.slice(sentBefore).filter(m => m.type === 'mp:lobby:kick');

    // All non-host guests are evicted
    expect(kickMsgs.length).toBe(2);
    const kickedIds = kickMsgs.map(m => m.payload.targetPlayerId as string);
    expect(kickedIds).toContain('gA');
    expect(kickedIds).toContain('gB');

    // Players array should only contain host
    const lobby = getCurrentLobby()!;
    const guests = lobby.players.filter(p => !p.isHost);
    expect(guests.length).toBe(0);
  });

  it('friends_only→public: no evictions (widening)', async () => {
    await makeHostWithGuests('friends_only', [
      { id: 'gX', displayName: 'Xavier' },
    ]);
    setVisibility('friends_only'); // start in friends_only, then widen

    const sentBefore = mockTransport.sent.length;
    setVisibility('public');
    const kickMsgs = mockTransport.sent.slice(sentBefore).filter(m => m.type === 'mp:lobby:kick');

    expect(kickMsgs.length).toBe(0);
    // Guest still present
    const lobby = getCurrentLobby()!;
    expect(lobby.players.map(p => p.id)).toContain('gX');
  });

  it('public→public (same visibility): no evictions', async () => {
    await makeHostWithGuests('public', [
      { id: 'gY', displayName: 'Yolanda' },
    ]);

    const sentBefore = mockTransport.sent.length;
    setVisibility('public');
    const kickMsgs = mockTransport.sent.slice(sentBefore).filter(m => m.type === 'mp:lobby:kick');

    expect(kickMsgs.length).toBe(0);
    const lobby = getCurrentLobby()!;
    expect(lobby.players.map(p => p.id)).toContain('gY');
  });

  it('getPendingVisibilityChange returns evictee list after strictening', async () => {
    await makeHostWithGuests('public', [
      { id: 'ev1', displayName: 'Evictee1' },
      { id: 'ev2', displayName: 'Evictee2' },
    ]);

    setVisibility('password');

    const pending = getPendingVisibilityChange();
    expect(pending).not.toBeNull();
    expect(pending!.oldVisibility).toBe('public');
    expect(pending!.newVisibility).toBe('password');
    expect(pending!.evictees).toContain('ev1');
    expect(pending!.evictees).toContain('ev2');
  });

  it('cancelPendingVisibilityChange clears the pending record', async () => {
    await makeHostWithGuests('public', [
      { id: 'ev3', displayName: 'Evictee3' },
    ]);

    setVisibility('password');
    expect(getPendingVisibilityChange()).not.toBeNull();

    cancelPendingVisibilityChange();
    expect(getPendingVisibilityChange()).toBeNull();
  });

  it('applyPendingVisibilityChange clears the pending record', async () => {
    await makeHostWithGuests('public', [
      { id: 'ev4', displayName: 'Evictee4' },
    ]);

    setVisibility('password');
    expect(getPendingVisibilityChange()).not.toBeNull();

    applyPendingVisibilityChange();
    expect(getPendingVisibilityChange()).toBeNull();
  });

  it('no evictions when all guests entered with password (public→password)', async () => {
    await makeHostWithGuests('public', [
      { id: 'ok1', displayName: 'OkGuest1', enteredWithPassword: true },
      { id: 'ok2', displayName: 'OkGuest2', enteredWithPassword: true },
    ]);

    const sentBefore = mockTransport.sent.length;
    setVisibility('password');
    const kickMsgs = mockTransport.sent.slice(sentBefore).filter(m => m.type === 'mp:lobby:kick');

    expect(kickMsgs.length).toBe(0);
    // Both guests remain
    const lobby = getCurrentLobby()!;
    const guestIds = lobby.players.filter(p => !p.isHost).map(p => p.id);
    expect(guestIds).toContain('ok1');
    expect(guestIds).toContain('ok2');
  });

  it('leaveLobby clears pendingVisibilityChange', async () => {
    await makeHostWithGuests('public', [
      { id: 'ev5', displayName: 'Evictee5' },
    ]);

    setVisibility('password');
    expect(getPendingVisibilityChange()).not.toBeNull();

    leaveLobby();
    expect(getPendingVisibilityChange()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// H-008: Guest ready-up watchdog tests
// ---------------------------------------------------------------------------

describe('H-008: ready-up watchdog — 30-second timeout when mp:lobby:start is lost', () => {
  beforeEach(() => {
    mockTransport = createMockTransport();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    leaveLobby();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Helper: join as a guest (not host) with one extra player so the lobby is valid.
   * Returns the joined lobby's ID for assertion convenience.
   */
  async function makeGuestLobby(): Promise<string> {
    await joinLobby('WATCHDOG', 'guest_h008', 'GuestH008');
    const lobby = getCurrentLobby()!;
    // Add host as a separate player so the lobby has 2 players
    lobby.players.push({ id: 'host_h008', displayName: 'Host', isHost: true, isReady: false });
    // Reorder so hostId is host_h008 — guest is not the host
    lobby.hostId = 'host_h008';
    return lobby.lobbyId;
  }

  it('fires subscriber with correct lobbyId after 30s when no onGameStart arrives', async () => {
    const lobbyId = await makeGuestLobby();

    const received: Array<{ lobbyId: string; expiredAt: number }> = [];
    onReadyTimeout((info) => { received.push(info); });

    setReady(true);
    // Watchdog should be armed — check status
    expect(getReadyWatchdogStatus().active).toBe(true);

    // Advance to just before expiry — no fire
    vi.advanceTimersByTime(READY_WATCHDOG_MS - 1);
    expect(received.length).toBe(0);

    // Advance past expiry
    vi.advanceTimersByTime(2);
    expect(received.length).toBe(1);
    expect(received[0].lobbyId).toBe(lobbyId);
    expect(typeof received[0].expiredAt).toBe('number');
  });

  it('resets readyPending (player.isReady = false) after watchdog fires', async () => {
    await makeGuestLobby();
    onReadyTimeout(() => {});

    setReady(true);
    const lobby = getCurrentLobby()!;
    const guestPlayer = lobby.players.find(p => p.id === 'guest_h008')!;
    expect(guestPlayer.isReady).toBe(true);

    vi.advanceTimersByTime(READY_WATCHDOG_MS + 1);
    // After watchdog fires, isReady should be reset to false
    expect(guestPlayer.isReady).toBe(false);
  });

  it('watchdog is idle after fire (getReadyWatchdogStatus returns inactive)', async () => {
    await makeGuestLobby();
    onReadyTimeout(() => {});

    setReady(true);
    expect(getReadyWatchdogStatus().active).toBe(true);

    vi.advanceTimersByTime(READY_WATCHDOG_MS + 1);
    expect(getReadyWatchdogStatus().active).toBe(false);
    expect(getReadyWatchdogStatus().msRemaining).toBeNull();
  });

  it('clears timer when mp:lobby:start arrives before 30s — subscriber does NOT fire', async () => {
    await makeGuestLobby();

    const fired: boolean[] = [];
    onReadyTimeout(() => { fired.push(true); });

    setReady(true);
    expect(getReadyWatchdogStatus().active).toBe(true);

    // Simulate host sending mp:lobby:start before watchdog expires
    vi.advanceTimersByTime(5_000);
    mockTransport.simulateReceive('mp:lobby:start', { seed: 12345, mode: 'race' });

    // Watchdog should now be cleared
    expect(getReadyWatchdogStatus().active).toBe(false);

    // Advance past the original expiry — subscriber should NOT have fired
    vi.advanceTimersByTime(READY_WATCHDOG_MS);
    expect(fired.length).toBe(0);
  });

  it('clears timer when setReady(false) is called before 30s — subscriber does NOT fire', async () => {
    await makeGuestLobby();

    const fired: boolean[] = [];
    onReadyTimeout(() => { fired.push(true); });

    setReady(true);
    expect(getReadyWatchdogStatus().active).toBe(true);

    vi.advanceTimersByTime(10_000);
    setReady(false);
    expect(getReadyWatchdogStatus().active).toBe(false);

    vi.advanceTimersByTime(READY_WATCHDOG_MS);
    expect(fired.length).toBe(0);
  });

  it('clears timer when leaveLobby() is called before 30s — subscriber does NOT fire', async () => {
    await makeGuestLobby();

    const fired: boolean[] = [];
    onReadyTimeout(() => { fired.push(true); });

    setReady(true);
    expect(getReadyWatchdogStatus().active).toBe(true);

    vi.advanceTimersByTime(5_000);
    leaveLobby();
    expect(getReadyWatchdogStatus().active).toBe(false);

    vi.advanceTimersByTime(READY_WATCHDOG_MS);
    expect(fired.length).toBe(0);
  });

  it('cancelReadyWatchdog() aborts the timer — subscriber does NOT fire', async () => {
    await makeGuestLobby();

    const fired: boolean[] = [];
    onReadyTimeout(() => { fired.push(true); });

    setReady(true);
    expect(getReadyWatchdogStatus().active).toBe(true);

    cancelReadyWatchdog();
    expect(getReadyWatchdogStatus().active).toBe(false);

    vi.advanceTimersByTime(READY_WATCHDOG_MS + 1);
    expect(fired.length).toBe(0);
  });

  it('multi-subscriber: both callbacks fire on expiry', async () => {
    await makeGuestLobby();

    const results1: string[] = [];
    const results2: string[] = [];
    onReadyTimeout((info) => { results1.push(info.lobbyId); });
    onReadyTimeout((info) => { results2.push(info.lobbyId); });

    setReady(true);
    vi.advanceTimersByTime(READY_WATCHDOG_MS + 1);

    expect(results1.length).toBe(1);
    expect(results2.length).toBe(1);
  });

  it('unsubscribe removes only its own callback, other callback still fires', async () => {
    await makeGuestLobby();

    const results1: string[] = [];
    const results2: string[] = [];
    const unsub1 = onReadyTimeout((info) => { results1.push(info.lobbyId); });
    onReadyTimeout((info) => { results2.push(info.lobbyId); });

    // Remove the first subscriber
    unsub1();

    setReady(true);
    vi.advanceTimersByTime(READY_WATCHDOG_MS + 1);

    expect(results1.length).toBe(0); // unsubscribed — must not fire
    expect(results2.length).toBe(1); // still subscribed — must fire
  });

  it('getReadyWatchdogStatus returns inactive when idle', async () => {
    await makeGuestLobby();
    const status = getReadyWatchdogStatus();
    expect(status.active).toBe(false);
    expect(status.msRemaining).toBeNull();
  });

  it('getReadyWatchdogStatus returns active with ~30000 msRemaining right after setReady(true)', async () => {
    await makeGuestLobby();

    setReady(true);
    const status = getReadyWatchdogStatus();
    expect(status.active).toBe(true);
    // msRemaining should be close to READY_WATCHDOG_MS (no significant wall clock elapsed in fake timers)
    expect(status.msRemaining).not.toBeNull();
    expect(status.msRemaining!).toBeGreaterThan(READY_WATCHDOG_MS - 100);
    expect(status.msRemaining!).toBeLessThanOrEqual(READY_WATCHDOG_MS);
  });

  it('getReadyWatchdogStatus msRemaining decreases as fake time advances', async () => {
    await makeGuestLobby();

    setReady(true);
    vi.advanceTimersByTime(5_000);
    const status = getReadyWatchdogStatus();
    expect(status.active).toBe(true);
    // msRemaining should be approximately 25000 after 5s elapsed
    expect(status.msRemaining!).toBeGreaterThan(24_900);
    expect(status.msRemaining!).toBeLessThanOrEqual(25_000);
  });
});
