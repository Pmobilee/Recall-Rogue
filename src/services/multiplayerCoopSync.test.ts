/**
 * Tests for multiplayerCoopSync — covers the turn-end barrier, cancel flow,
 * and PartnerState score/accuracy fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MultiplayerMessage, MultiplayerMessageType, MultiplayerTransport } from './multiplayerTransport';
import type { LobbyState } from '../data/multiplayerTypes';

// ---------------------------------------------------------------------------
// Mock transport factory
// ---------------------------------------------------------------------------

type MessageHandler = (msg: MultiplayerMessage) => void;

type MockTransport = MultiplayerTransport & {
  sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }>;
  simulateReceive(type: MultiplayerMessageType, payload: Record<string, unknown>): void;
  capturedListeners: Map<string, MessageHandler[]>;
};

function createMockTransport(): MockTransport {
  const sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }> = [];
  const capturedListeners = new Map<string, MessageHandler[]>();

  return {
    sent,
    capturedListeners,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getState: vi.fn(() => 'connected' as const),
    isConnected: vi.fn(() => true),
    send(type: MultiplayerMessageType, payload: Record<string, unknown>) {
      sent.push({ type, payload });
    },
    on(type: string, callback: MessageHandler) {
      if (!capturedListeners.has(type)) capturedListeners.set(type, []);
      capturedListeners.get(type)!.push(callback);
      return () => {
        const list = capturedListeners.get(type);
        if (list) {
          const idx = list.indexOf(callback);
          if (idx >= 0) list.splice(idx, 1);
        }
      };
    },
    simulateReceive(type: MultiplayerMessageType, payload: Record<string, unknown>) {
      const list = capturedListeners.get(type);
      if (list) {
        const msg: MultiplayerMessage = { type, payload, timestamp: Date.now(), senderId: 'remote' };
        list.forEach(cb => cb(msg));
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Mutable lobby fixture
// ---------------------------------------------------------------------------

let mockLobby: LobbyState | null = null;
let mockTransport: MockTransport = createMockTransport();

vi.mock('./multiplayerTransport', () => ({
  getMultiplayerTransport: vi.fn(() => mockTransport),
  destroyMultiplayerTransport: vi.fn(),
}));

let mockLobbyUpdateCb: ((lobby: LobbyState) => void) | null = null;

vi.mock('./multiplayerLobbyService', () => ({
  getCurrentLobby: vi.fn(() => mockLobby),
  // onLobbyUpdate: capture the callback so tests can fire partner-leave events.
  // Returns a no-op unsub function.
  onLobbyUpdate: vi.fn((cb: (lobby: LobbyState) => void) => {
    mockLobbyUpdateCb = cb;
    return () => { mockLobbyUpdateCb = null; };
  }),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import {
  initCoopSync,
  destroyCoopSync,
  awaitCoopTurnEnd,
  cancelCoopTurnEnd,
  isLocalTurnEndPending,
  broadcastPartnerState,
} from './multiplayerCoopSync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLobby(playerIds: string[]): LobbyState {
  return {
    lobbyId: 'test-lobby',
    hostId: playerIds[0],
    mode: 'coop',
    deckSelectionMode: 'host_picks',
    houseRules: {} as any,
    players: playerIds.map((id, i) => ({
      id,
      displayName: `Player ${i + 1}`,
      isHost: i === 0,
      isReady: true,
    })),
    maxPlayers: 4,
    isRanked: false,
    status: 'in_game',
    visibility: 'public',
    hasPassword: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('multiplayerCoopSync — awaitCoopTurnEnd', () => {
  beforeEach(() => {
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  it('resolves completed immediately when solo (1 player lobby)', async () => {
    mockLobby = makeLobby(['alice']);
    initCoopSync('alice');

    const result = await awaitCoopTurnEnd();
    expect(result).toBe('completed');
  });

  it('resolves completed when partner signals first, then local signals', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    // Simulate partner already signaled before we call awaitCoopTurnEnd
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });

    const result = await awaitCoopTurnEnd();
    expect(result).toBe('completed');
  });

  it('resolves completed when partner signals after local calls awaitCoopTurnEnd', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();

    // Partner signals after local barrier is waiting
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });

    const result = await promise;
    expect(result).toBe('completed');
  });

  it('broadcasts mp:coop:turn_end with local player ID', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    await promise;

    const turnEndMsg = mockTransport.sent.find(m => m.type === 'mp:coop:turn_end');
    expect(turnEndMsg?.payload.playerId).toBe('alice');
  });
});

describe('multiplayerCoopSync — cancelCoopTurnEnd', () => {
  beforeEach(() => {
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  it('resolves cancelled when cancel is called before partner signals', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    expect(isLocalTurnEndPending()).toBe(true);

    cancelCoopTurnEnd();
    const result = await promise;

    expect(result).toBe('cancelled');
  });

  it('isLocalTurnEndPending is false after cancel', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    cancelCoopTurnEnd();
    await promise;

    expect(isLocalTurnEndPending()).toBe(false);
  });

  it('broadcasts mp:coop:turn_end_cancel on cancel', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    cancelCoopTurnEnd();
    await promise;

    const cancelMsg = mockTransport.sent.find(m => m.type === 'mp:coop:turn_end_cancel');
    expect(cancelMsg?.payload.playerId).toBe('alice');
  });

  it('resolves completed (not cancelled) when partner signals before cancel (race)', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();

    // Partner signals — barrier releases first
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });

    // Cancel fires after barrier already resolved
    cancelCoopTurnEnd();

    const result = await promise;
    // The barrier resolved 'completed' before cancel could take effect
    expect(result).toBe('completed');
  });
});

describe('multiplayerCoopSync — broadcastPartnerState', () => {
  beforeEach(() => {
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  it('includes score and accuracy in the broadcast payload', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    broadcastPartnerState({ hp: 50, maxHp: 80, block: 5, score: 1500, accuracy: 0.75 });

    const msg = mockTransport.sent.find(m => m.type === 'mp:coop:partner_state');
    expect(msg).toBeDefined();
    expect(msg?.payload.score).toBe(1500);
    expect(msg?.payload.accuracy).toBe(0.75);
    expect(msg?.payload.hp).toBe(50);
    expect(msg?.payload.block).toBe(5);
  });

  it('omits score/accuracy from payload when not provided', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    broadcastPartnerState({ hp: 50, maxHp: 80, block: 5 });

    const msg = mockTransport.sent.find(m => m.type === 'mp:coop:partner_state');
    expect(msg).toBeDefined();
    expect('score' in (msg?.payload ?? {})).toBe(false);
    expect('accuracy' in (msg?.payload ?? {})).toBe(false);
  });
});

describe('multiplayerCoopSync — remote cancel', () => {
  beforeEach(() => {
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  it('removes partner signal when mp:coop:turn_end_cancel arrives from remote', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    // Partner signals, then cancels
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    mockTransport.simulateReceive('mp:coop:turn_end_cancel', { playerId: 'bob' });

    // Now start local barrier — partner cancelled so we should NOT resolve yet
    let resolved = false;
    const promise = awaitCoopTurnEnd().then(r => { resolved = true; return r; });

    // Give a tick for any microtask resolution
    await new Promise(r => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // Partner re-signals → should complete now
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    const result = await promise;
    expect(result).toBe('completed');
  });
});

describe('multiplayerCoopSync — partner leave cancels barrier', () => {
  beforeEach(() => {
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  it('auto-resolves cancelled when partner leaves lobby mid-barrier', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    expect(isLocalTurnEndPending()).toBe(true);

    // Simulate bob leaving the lobby — lobby now has only alice
    const reducedLobby = makeLobby(['alice']);
    mockLobbyUpdateCb?.({ ...reducedLobby });

    const result = await promise;
    expect(result).toBe('cancelled');
    expect(isLocalTurnEndPending()).toBe(false);
  });
});
