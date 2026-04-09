/**
 * Tests for multiplayerLobbyService — focusing on the 2026-04-09 fix:
 * contentSelection must be included in the mp:lobby:start payload so
 * guest instances receive the definitive content selection at game-start time.
 *
 * These tests use a mock transport to intercept messages without any
 * networking, Steam, or browser globals required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MultiplayerMessage, MultiplayerMessageType, MultiplayerTransport } from './multiplayerTransport';
import type { LobbyContentSelection } from '../data/multiplayerTypes';

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

function makeHostLobby(contentSelection?: LobbyContentSelection) {
  const lobby = createLobby('host_player', 'Host', 'race');
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

  it('sends contentSelection in mp:lobby:start when a study deck is selected', () => {
    const selection: LobbyContentSelection = {
      type: 'study',
      deckId: 'world_war_ii',
      deckName: 'World War II',
    };

    makeHostLobby(selection);
    startGame();

    const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(startMsg).toBeDefined();
    expect(startMsg!.payload.contentSelection).toBeDefined();

    const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
    expect(cs.type).toBe('study');
    expect(cs.deckId).toBe('world_war_ii');
    expect(cs.deckName).toBe('World War II');
  });

  it('sends contentSelection in mp:lobby:start when a custom_deck is selected', () => {
    const selection: LobbyContentSelection = {
      type: 'custom_deck',
      customDeckId: 'my_anki_deck',
      deckName: 'My Anki Deck',
    };

    makeHostLobby(selection);
    startGame();

    const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(startMsg).toBeDefined();
    const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
    expect(cs.type).toBe('custom_deck');
    expect(cs.customDeckId).toBe('my_anki_deck');
  });

  it('sends contentSelection in mp:lobby:start when trivia domains are selected', () => {
    const selection: LobbyContentSelection = {
      type: 'trivia',
      domains: ['history', 'science'],
    };

    makeHostLobby(selection);
    startGame();

    const startMsg = mockTransport.sent.find(m => m.type === 'mp:lobby:start');
    expect(startMsg).toBeDefined();
    const cs = startMsg!.payload.contentSelection as Record<string, unknown>;
    expect(cs.type).toBe('trivia');
    expect(cs.domains).toEqual(['history', 'science']);
  });

  it('sends mp:lobby:start without contentSelection key when none is set', () => {
    // No contentSelection configured
    makeHostLobby();
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

  it('applies contentSelection from payload before onGameStart fires on guest', () => {
    // Simulate a guest joining (not host) — isHost() will be false
    joinLobby('ABCDEF', 'guest_player', 'Guest');

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

  it('preserves existing contentSelection when payload omits it', () => {
    joinLobby('ABCDEF', 'guest_player', 'Guest');

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

  it('seed is correctly applied from the start payload', () => {
    joinLobby('ABCDEF', 'guest_player', 'Guest');

    let receivedSeed = 0;
    onGameStart((seed) => { receivedSeed = seed; });

    mockTransport.simulateReceive('mp:lobby:start', { seed: 7654321 });

    expect(receivedSeed).toBe(7654321);
  });
});
