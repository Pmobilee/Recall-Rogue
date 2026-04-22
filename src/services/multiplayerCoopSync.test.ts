/**
 * Tests for multiplayerCoopSync — covers the turn-end barrier, cancel flow,
 * PartnerState score/accuracy fields, barrier timeout, transport disconnect,
 * hasPendingBarrier getter, handleCoopPlayerDeath, onPartnerUnresponsive,
 * and partnerStateToRaceProgressShape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  /** Override connected state for disconnect tests */
  _connected: boolean;
};

function createMockTransport(): MockTransport {
  const sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }> = [];
  const capturedListeners = new Map<string, MessageHandler[]>();

  const t = {
    sent,
    capturedListeners,
    _connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    setActiveLobby: vi.fn(),
    getState: vi.fn(),
    isConnected: vi.fn(),
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
  } as MockTransport;

  // Dynamic mocks reading current _connected value
  t.getState = vi.fn(() => (t._connected ? 'connected' : 'disconnected') as 'connected' | 'disconnected');
  t.isConnected = vi.fn(() => t._connected);

  return t;
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
  awaitCoopTurnEndWithDelta,
  cancelCoopTurnEnd,
  isLocalTurnEndPending,
  hasPendingBarrier,
  broadcastPartnerState,
  broadcastSharedEnemyState,
  onSharedEnemyState,
  handleCoopPlayerDeath,
  onPartnerUnresponsive,
  markPartnerUnresponsive,
  partnerStateToRaceProgressShape,
} from './multiplayerCoopSync';
import type { PartnerState } from './multiplayerCoopSync';
import type { SharedEnemySnapshot } from '../data/multiplayerTypes';

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
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('multiplayerCoopSync — awaitCoopTurnEnd', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
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

    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });

    const result = await awaitCoopTurnEnd();
    expect(result).toBe('completed');
  });

  it('resolves completed when partner signals after local calls awaitCoopTurnEnd', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
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
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
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
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    cancelCoopTurnEnd();

    const result = await promise;
    expect(result).toBe('completed');
  });
});

describe('multiplayerCoopSync — broadcastPartnerState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
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
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
  });

  it('removes partner signal when mp:coop:turn_end_cancel arrives from remote', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    mockTransport.simulateReceive('mp:coop:turn_end_cancel', { playerId: 'bob' });

    let resolved = false;
    const promise = awaitCoopTurnEnd().then(r => { resolved = true; return r; });

    // With fake timers, flush only microtasks — do not use setTimeout directly.
    vi.advanceTimersByTime(0);
    await Promise.resolve();
    expect(resolved).toBe(false);

    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    const result = await promise;
    expect(result).toBe('completed');
  });
});

describe('multiplayerCoopSync — partner leave cancels barrier', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
  });

  it('auto-resolves cancelled when partner leaves lobby mid-barrier', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    expect(isLocalTurnEndPending()).toBe(true);

    const reducedLobby = makeLobby(['alice']);
    mockLobbyUpdateCb?.({ ...reducedLobby });

    const result = await promise;
    expect(result).toBe('cancelled');
    expect(isLocalTurnEndPending()).toBe(false);
  });
});

describe('multiplayerCoopSync — hasPendingBarrier', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
  });

  it('returns false before any barrier starts', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');
    expect(hasPendingBarrier()).toBe(false);
  });

  it('returns true while a barrier is in flight', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    awaitCoopTurnEnd();
    expect(hasPendingBarrier()).toBe(true);
  });

  it('returns false after barrier resolves completed', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    await promise;

    expect(hasPendingBarrier()).toBe(false);
  });

  it('returns false after barrier is cancelled', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    cancelCoopTurnEnd();
    await promise;

    expect(hasPendingBarrier()).toBe(false);
  });
});

describe('multiplayerCoopSync — C3 barrier timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
  });

  it('resolves cancelled after 45s hard timeout (awaitCoopTurnEnd)', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    expect(hasPendingBarrier()).toBe(true);

    vi.advanceTimersByTime(45_000);
    const result = await promise;

    expect(result).toBe('cancelled');
    expect(hasPendingBarrier()).toBe(false);
  });

  it('resolves cancelled after 45s hard timeout (awaitCoopTurnEndWithDelta)', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const delta = { playerId: 'alice', damageDealt: 5, blockDealt: 0, statusEffectsAdded: [] };
    const promise = awaitCoopTurnEndWithDelta(delta);
    expect(hasPendingBarrier()).toBe(true);

    vi.advanceTimersByTime(45_000);
    const result = await promise;

    expect(result).toBe('cancelled');
    expect(hasPendingBarrier()).toBe(false);
  });

  it('does not timeout if barrier resolves before 45s', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    const result = await promise;

    // Advance past would-have-been timeout — should not cause any extra effects
    vi.advanceTimersByTime(50_000);

    expect(result).toBe('completed');
    expect(hasPendingBarrier()).toBe(false);
  });
});

describe('multiplayerCoopSync — C3 transport disconnect cancels barrier', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
  });

  it('resolves cancelled when transport disconnects while barrier is in flight', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    expect(hasPendingBarrier()).toBe(true);

    // Simulate transport going offline
    mockTransport._connected = false;

    // Advance past the 2s disconnect-check window
    vi.advanceTimersByTime(2_500);
    const result = await promise;

    expect(result).toBe('cancelled');
  });

  it('does not cancel when transport stays connected', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    // Transport stays connected
    vi.advanceTimersByTime(2_500);
    // Barrier still pending (partner hasn't signaled)
    expect(hasPendingBarrier()).toBe(true);

    // Partner signals → complete
    mockTransport.simulateReceive('mp:coop:turn_end', { playerId: 'bob' });
    const result = await promise;
    expect(result).toBe('completed');
  });
});

describe('multiplayerCoopSync — H18 handleCoopPlayerDeath', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
  });

  it('broadcasts mp:coop:player_died with the dying player ID', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    handleCoopPlayerDeath('alice');

    const msg = mockTransport.sent.find(m => m.type === 'mp:coop:player_died');
    expect(msg).toBeDefined();
    expect(msg?.payload.playerId).toBe('alice');
  });

  it('cancels an in-flight barrier when a player dies', async () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const promise = awaitCoopTurnEnd();
    expect(hasPendingBarrier()).toBe(true);

    handleCoopPlayerDeath('alice');
    const result = await promise;

    expect(result).toBe('cancelled');
    expect(hasPendingBarrier()).toBe(false);
  });

  it('does not throw when called with no barrier in flight', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    expect(() => handleCoopPlayerDeath('alice')).not.toThrow();
    const msg = mockTransport.sent.find(m => m.type === 'mp:coop:player_died');
    expect(msg).toBeDefined();
  });
});

describe('multiplayerCoopSync — H19/M5 onPartnerUnresponsive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
  });

  it('markPartnerUnresponsive fires all registered callbacks', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const fired: string[] = [];
    const unsub = onPartnerUnresponsive(id => fired.push(id));

    markPartnerUnresponsive('bob');

    expect(fired).toEqual(['bob']);
    unsub();
  });

  it('multiple callbacks all fire for markPartnerUnresponsive', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const results1: string[] = [];
    const results2: string[] = [];
    const unsub1 = onPartnerUnresponsive(id => results1.push(id));
    const unsub2 = onPartnerUnresponsive(id => results2.push(id));

    markPartnerUnresponsive('bob');

    expect(results1).toEqual(['bob']);
    expect(results2).toEqual(['bob']);

    unsub1();
    unsub2();
  });

  it('unsubscribed callback does not fire', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const fired: string[] = [];
    const unsub = onPartnerUnresponsive(id => fired.push(id));
    unsub();

    markPartnerUnresponsive('bob');
    expect(fired).toHaveLength(0);
  });

  it('heartbeat poll fires onPartnerUnresponsive after 90s absence', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const fired: string[] = [];
    const unsub = onPartnerUnresponsive(id => fired.push(id));

    // Bob sends one heartbeat to register in the tracker
    mockTransport.simulateReceive('mp:coop:partner_state', {
      playerId: 'bob',
      hp: 80,
      maxHp: 100,
      block: 0,
    });

    // Advance 90s + 1 poll interval — should detect absence
    vi.advanceTimersByTime(90_000 + 5_000);

    expect(fired).toContain('bob');

    unsub();
  });

  it('heartbeat poll does not fire if partner sends regular states', () => {
    mockLobby = makeLobby(['alice', 'bob']);
    initCoopSync('alice');

    const fired: string[] = [];
    const unsub = onPartnerUnresponsive(id => fired.push(id));

    // Bob heartbeats every 30s — never 90s quiet
    mockTransport.simulateReceive('mp:coop:partner_state', {
      playerId: 'bob', hp: 80, maxHp: 100, block: 0,
    });
    vi.advanceTimersByTime(30_000);
    mockTransport.simulateReceive('mp:coop:partner_state', {
      playerId: 'bob', hp: 70, maxHp: 100, block: 5,
    });
    vi.advanceTimersByTime(30_000);
    mockTransport.simulateReceive('mp:coop:partner_state', {
      playerId: 'bob', hp: 60, maxHp: 100, block: 0,
    });
    vi.advanceTimersByTime(30_000);
    vi.advanceTimersByTime(5_000); // one extra poll

    expect(fired).toHaveLength(0);

    unsub();
  });
});

describe('multiplayerCoopSync — M17 partnerStateToRaceProgressShape', () => {
  it('maps hp → playerHp, maxHp → playerMaxHp, block → playerBlock', () => {
    const state: PartnerState = {
      playerId: 'bob',
      hp: 45,
      maxHp: 80,
      block: 12,
    };
    const shape = partnerStateToRaceProgressShape(state);

    expect(shape.playerId).toBe('bob');
    expect(shape.playerHp).toBe(45);
    expect(shape.playerMaxHp).toBe(80);
    expect(shape.playerBlock).toBe(12);
  });

  it('maps score and accuracy when present', () => {
    const state: PartnerState = {
      playerId: 'bob',
      hp: 45,
      maxHp: 80,
      block: 0,
      score: 2400,
      accuracy: 0.9,
    };
    const shape = partnerStateToRaceProgressShape(state);

    expect(shape.score).toBe(2400);
    expect(shape.accuracy).toBe(0.9);
  });

  it('defaults score and accuracy to 0 when absent', () => {
    const state: PartnerState = {
      playerId: 'carol',
      hp: 100,
      maxHp: 100,
      block: 5,
    };
    const shape = partnerStateToRaceProgressShape(state);

    expect(shape.score).toBe(0);
    expect(shape.accuracy).toBe(0);
  });

  it('does not set floor, encountersWon, isFinished, result (caller fills these)', () => {
    const state: PartnerState = {
      playerId: 'bob',
      hp: 60,
      maxHp: 100,
      block: 0,
    };
    const shape = partnerStateToRaceProgressShape(state);

    expect('floor' in shape).toBe(false);
    expect('encountersWon' in shape).toBe(false);
    expect('isFinished' in shape).toBe(false);
    expect('result' in shape).toBe(false);
  });
});
// ---------------------------------------------------------------------------
// Regression test: subscribe-after-send race (MP-STEAM-20260422-001/002/004)
// ---------------------------------------------------------------------------

describe('multiplayerCoopSync — initial state request-on-subscribe (001/002/004)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    destroyCoopSync();
    mockTransport = createMockTransport();
    mockLobby = null;
    mockLobbyUpdateCb = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyCoopSync();
  });

  it('guest sends mp:coop:request_initial_state after initCoopSync when lobby has 2+ players', () => {
    mockLobby = makeLobby(['host', 'guest']);
    initCoopSync('guest'); // not host

    const req = mockTransport.sent.find(m => m.type === 'mp:coop:request_initial_state');
    expect(req).toBeDefined();
    expect(req?.payload.playerId).toBe('guest');
  });

  it('host does NOT send mp:coop:request_initial_state (only guests request)', () => {
    mockLobby = makeLobby(['host', 'guest']);
    initCoopSync('host');

    const req = mockTransport.sent.find(m => m.type === 'mp:coop:request_initial_state');
    expect(req).toBeUndefined();
  });

  it('guest subscribes AFTER host broadcasts → guest sends request → host replies → guest callback fires', async () => {
    // Set up host-side state
    mockLobby = makeLobby(['host', 'guest']);
    initCoopSync('host');

    const snapshot: SharedEnemySnapshot = {
      currentHP: 42,
      maxHP: 100,
      block: 5,
      phase: 1,
      nextIntent: { type: 'attack', value: 8, telegraph: 'Attacks for 8' } as any,
      statusEffects: [],
    };

    // Host broadcasts initial state (buffers _lastBroadcastSnapshot)
    broadcastSharedEnemyState(snapshot);

    // Tear down host side and set up guest side with the same transport
    // (in real usage they are separate processes; here we simulate message flow)
    destroyCoopSync();

    mockLobby = makeLobby(['host', 'guest']);
    const receivedSnapshots: SharedEnemySnapshot[] = [];
    
    // Subscribe to enemy state BEFORE initCoopSync to simulate the real
    // caller (encounterBridge) wiring up before game messages arrive.
    const unsub = onSharedEnemyState(s => receivedSnapshots.push(s));

    // Guest inits — registers all handlers, then sends request_initial_state.
    initCoopSync('guest');

    // Guest should have sent the request.
    const req = mockTransport.sent.find(m => m.type === 'mp:coop:request_initial_state');
    expect(req).toBeDefined();

    // Simulate the host re-broadcasting in response (the host handler fires this).
    // In production the host's transport.on handler would call broadcastSharedEnemyState;
    // here we simulate the resulting mp:coop:enemy_state arriving at the guest.
    mockTransport.simulateReceive('mp:coop:enemy_state', snapshot as unknown as Record<string, unknown>);

    await Promise.resolve(); // flush microtasks

    expect(receivedSnapshots).toHaveLength(1);
    expect(receivedSnapshots[0].currentHP).toBe(42);
    expect(receivedSnapshots[0].maxHP).toBe(100);

    unsub();
  });

  it('guest retries request if no enemy_state arrives within timeout', async () => {
    mockLobby = makeLobby(['host', 'guest']);
    initCoopSync('guest');

    const requests = mockTransport.sent.filter(m => m.type === 'mp:coop:request_initial_state');
    expect(requests).toHaveLength(1);

    // Advance past the 2000ms retry timeout without receiving enemy_state
    vi.advanceTimersByTime(2_100);
    await Promise.resolve();

    const requestsAfterRetry = mockTransport.sent.filter(m => m.type === 'mp:coop:request_initial_state');
    expect(requestsAfterRetry.length).toBeGreaterThan(1);
  });

  it('guest stops retrying after receiving enemy_state', async () => {
    mockLobby = makeLobby(['host', 'guest']);
    initCoopSync('guest');

    const snapshot: SharedEnemySnapshot = {
      currentHP: 50,
      maxHP: 100,
      block: 0,
      phase: 1,
      nextIntent: { type: 'attack', value: 5, telegraph: 'Attacks for 5' } as any,
      statusEffects: [],
    };

    // Enemy state arrives — should cancel the retry
    mockTransport.simulateReceive('mp:coop:enemy_state', snapshot as unknown as Record<string, unknown>);

    const countAfterReceive = mockTransport.sent.filter(m => m.type === 'mp:coop:request_initial_state').length;

    // Advance well past the retry window
    vi.advanceTimersByTime(10_000);
    await Promise.resolve();

    const countAfterDelay = mockTransport.sent.filter(m => m.type === 'mp:coop:request_initial_state').length;
    // No additional requests should have been sent after the state arrived
    expect(countAfterDelay).toBe(countAfterReceive);
  });

  it('enemy_state guard rejects malformed snapshot (fix 003)', () => {
    mockLobby = makeLobby(['host', 'guest']);
    initCoopSync('guest');

    const received: unknown[] = [];
    const unsub = onSharedEnemyState(s => received.push(s));

    // Malformed — currentHP is missing (null/undefined), should be filtered
    mockTransport.simulateReceive('mp:coop:enemy_state', { maxHP: 100, block: 0 } as Record<string, unknown>);

    expect(received).toHaveLength(0); // guard rejected the malformed payload

    // Valid snapshot should pass
    const validSnapshot: SharedEnemySnapshot = {
      currentHP: 30,
      maxHP: 100,
      block: 0,
      phase: 1,
      nextIntent: { type: 'defend', value: 0, telegraph: 'Defends' } as any,
      statusEffects: [],
    };
    mockTransport.simulateReceive('mp:coop:enemy_state', validSnapshot as unknown as Record<string, unknown>);
    expect(received).toHaveLength(1);

    unsub();
  });
});
