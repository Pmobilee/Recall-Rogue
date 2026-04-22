/**
 * Tests for multiplayerMapSync — covering pick/consensus flow and the
 * 2026-04-09 regression: destroyMapNodeSync() must NOT null the UI
 * subscription callbacks (_onConsensus / _onPicksChanged) because
 * initMapNodeSync() calls destroyMapNodeSync() internally, wiping callbacks
 * that were registered by the consumer before the run started.
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
    setActiveLobby: vi.fn(),
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
// Mutable lobby fixture — tests can override per-case
// ---------------------------------------------------------------------------

let mockLobby: LobbyState | null = null;
let mockTransport: MockTransport = createMockTransport();

vi.mock('./multiplayerTransport', () => ({
  getMultiplayerTransport: vi.fn(() => mockTransport),
  destroyMultiplayerTransport: vi.fn(),
  createLocalTransportPair: vi.fn(() => [createMockTransport(), createMockTransport()]),
  LocalMultiplayerTransport: class {},
}));

vi.mock('./multiplayerLobbyService', () => ({
  getCurrentLobby: vi.fn(() => mockLobby),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are set up
// ---------------------------------------------------------------------------

const {
  initMapNodeSync,
  destroyMapNodeSync,
  pickMapNode,
  resetMapNodePicks,
  onMapNodeConsensus,
  onMapNodePicksChanged,
} = await import('./multiplayerMapSync');

// Also grab the mocked getMultiplayerTransport so we can re-point it per test
const { getMultiplayerTransport } = await import('./multiplayerTransport');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLobby(playerIds: string[]): LobbyState {
  return {
    id: 'lobby_test',
    code: 'ABC123',
    hostId: playerIds[0],
    mode: 'coop',
    players: playerIds.map((id, i) => ({
      id,
      displayName: `Player ${i + 1}`,
      isHost: i === 0,
      isReady: true,
    })),
    settings: { deckSelectionMode: 'host_picks' },
  } as unknown as LobbyState;
}

// ---------------------------------------------------------------------------
// Setup — reset run-level state between tests, re-wire transport mock
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockTransport = createMockTransport();
  vi.mocked(getMultiplayerTransport).mockReturnValue(mockTransport);
  mockLobby = null;
  // Clear run-level state. Note: this intentionally does NOT wipe UI subscriptions
  // (the regression is that it used to).
  destroyMapNodeSync();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('multiplayerMapSync — pick and consensus', () => {

  it('pickMapNode fires onMapNodePicksChanged with the local pick', () => {
    mockLobby = makeLobby(['playerA']);
    const picksCb = vi.fn();
    onMapNodePicksChanged(picksCb);

    initMapNodeSync('playerA');
    pickMapNode('node_1');

    expect(picksCb).toHaveBeenCalled();
    const lastArg = picksCb.mock.calls[picksCb.mock.calls.length - 1][0] as Record<string, string | null>;
    expect(lastArg).toMatchObject({ playerA: 'node_1' });
  });

  it('single-player lobby reaches consensus immediately after pick', () => {
    mockLobby = makeLobby(['playerA']);
    const consensusCb = vi.fn();
    onMapNodeConsensus(consensusCb);

    initMapNodeSync('playerA');
    pickMapNode('node_1');

    expect(consensusCb).toHaveBeenCalledTimes(1);
    expect(consensusCb).toHaveBeenCalledWith('node_1');
  });

  it('two-player consensus: both pick same node → callback fires once', () => {
    mockLobby = makeLobby(['playerA', 'playerB']);
    const consensusCb = vi.fn();
    onMapNodeConsensus(consensusCb);

    initMapNodeSync('playerA');

    // Local pick — consensus not yet met (playerB hasn't picked)
    pickMapNode('node_1');
    expect(consensusCb).not.toHaveBeenCalled();

    // Simulate remote pick from playerB via transport listener
    mockTransport.simulateReceive('mp:map:node_pick', { playerId: 'playerB', nodeId: 'node_1' });

    expect(consensusCb).toHaveBeenCalledTimes(1);
    expect(consensusCb).toHaveBeenCalledWith('node_1');
  });

  it('two-player different picks: no consensus', () => {
    mockLobby = makeLobby(['playerA', 'playerB']);
    const consensusCb = vi.fn();
    onMapNodeConsensus(consensusCb);

    initMapNodeSync('playerA');
    pickMapNode('node_1');

    // playerB picks a different node — no consensus
    mockTransport.simulateReceive('mp:map:node_pick', { playerId: 'playerB', nodeId: 'node_2' });

    expect(consensusCb).not.toHaveBeenCalled();
  });

  it('re-init preserves UI subscriptions (REGRESSION: destroyMapNodeSync must not null callbacks)', () => {
    // This is the exact scenario that was broken:
    // 1. CardApp registers callbacks at component mount (before init)
    // 2. The game-start handler calls initMapNodeSync() which calls destroyMapNodeSync() first
    // 3. Bug: destroyMapNodeSync nulled callbacks → silent no-op after init
    // 4. Fix: callbacks survive across re-init cycles
    mockLobby = makeLobby(['playerA']);

    // Step 1: Register UI subscriptions BEFORE init (CardApp component mount order)
    const picksCb = vi.fn();
    const consensusCb = vi.fn();
    onMapNodePicksChanged(picksCb);
    onMapNodeConsensus(consensusCb);

    // Step 2: Init fires (which calls destroyMapNodeSync internally)
    initMapNodeSync('playerA');

    // Step 3: Player picks a node
    pickMapNode('node_1');

    // Step 4: Both callbacks must have been called — were silently dropped before the fix
    expect(picksCb).toHaveBeenCalled();
    const picksArg = picksCb.mock.calls[picksCb.mock.calls.length - 1][0] as Record<string, string | null>;
    expect(picksArg).toMatchObject({ playerA: 'node_1' });

    expect(consensusCb).toHaveBeenCalledTimes(1);
    expect(consensusCb).toHaveBeenCalledWith('node_1');
  });

  it('explicit unsubscribe works: callback not called after unsub', () => {
    mockLobby = makeLobby(['playerA']);
    const picksCb = vi.fn();
    const unsub = onMapNodePicksChanged(picksCb);

    initMapNodeSync('playerA');
    unsub(); // consumer unmounts — clears the subscription
    pickMapNode('node_1');

    expect(picksCb).not.toHaveBeenCalled();
  });

  it('resetMapNodePicks clears all picks and fires picks-changed', () => {
    mockLobby = makeLobby(['playerA']);
    const picksCb = vi.fn();
    onMapNodePicksChanged(picksCb);

    initMapNodeSync('playerA');
    pickMapNode('node_1');
    picksCb.mockClear();

    resetMapNodePicks();

    expect(picksCb).toHaveBeenCalled();
    const resetArg = picksCb.mock.calls[0][0] as Record<string, string | null>;
    // All values should be null after reset
    for (const val of Object.values(resetArg)) {
      expect(val).toBeNull();
    }
  });

});
