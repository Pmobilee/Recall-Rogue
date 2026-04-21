/**
 * Tests for multiplayerTransport.ts
 *
 * Covers:
 * - H10: MultiplayerMessageType union includes peer_left, peer_rejoined, start_ack,
 *        workshop deck_check / deck_check_ack (previously required `as MultiplayerMessageType` casts)
 * - H10: initPeerPresenceMonitor emits mp:lobby:peer_left after PEER_PONG_TIMEOUT_MS
 * - H10: initPeerPresenceMonitor sends mp:ping on interval
 * - H10: initPeerPresenceMonitor auto-responds to mp:ping with mp:pong
 * - H10: cleanup function cancels the interval and clears state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  MultiplayerMessageType,
  MultiplayerMessage,
  MultiplayerTransport,
} from './multiplayerTransport';
import { initPeerPresenceMonitor } from './multiplayerTransport';

// ── Helper: minimal mock transport ───────────────────────────────────────────

type MessageHandler = (msg: MultiplayerMessage) => void;

function createMockTransport(): MultiplayerTransport & {
  sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }>;
  simulateReceive(type: string, payload: Record<string, unknown>, senderId?: string): void;
} {
  const sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }> = [];
  const handlers = new Map<string, MessageHandler[]>();

  return {
    sent,
    connect: vi.fn(),
    send(type: MultiplayerMessageType, payload: Record<string, unknown>) {
      sent.push({ type, payload });
      // Echo back to any listeners on this type (for ping → pong tests)
      const list = handlers.get(type);
      if (list) list.forEach(cb => cb({ type, payload, timestamp: Date.now(), senderId: '__transport__' }));
    },
    on(type: string, callback: MessageHandler): () => void {
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
    disconnect: vi.fn(),
    getState: vi.fn(() => 'connected' as const),
    isConnected: vi.fn(() => true),
    simulateReceive(type: string, payload: Record<string, unknown>, senderId = 'remote_peer') {
      const msg: MultiplayerMessage = {
        type: type as MultiplayerMessageType,
        payload,
        timestamp: Date.now(),
        senderId,
      };
      const list = handlers.get(type);
      if (list) list.forEach(cb => cb(msg));
    },
  };
}

// ── H10: message type union completeness ─────────────────────────────────────

describe('H10: MultiplayerMessageType union', () => {
  it('includes mp:lobby:peer_left without type cast', () => {
    // If this compiles, the type is in the union
    const t: MultiplayerMessageType = 'mp:lobby:peer_left';
    expect(t).toBe('mp:lobby:peer_left');
  });

  it('includes mp:lobby:peer_rejoined without type cast', () => {
    const t: MultiplayerMessageType = 'mp:lobby:peer_rejoined';
    expect(t).toBe('mp:lobby:peer_rejoined');
  });

  it('includes mp:lobby:start_ack without type cast', () => {
    const t: MultiplayerMessageType = 'mp:lobby:start_ack';
    expect(t).toBe('mp:lobby:start_ack');
  });

  it('includes mp:workshop:deck_check without type cast', () => {
    const t: MultiplayerMessageType = 'mp:workshop:deck_check';
    expect(t).toBe('mp:workshop:deck_check');
  });

  it('includes mp:workshop:deck_check_ack without type cast', () => {
    const t: MultiplayerMessageType = 'mp:workshop:deck_check_ack';
    expect(t).toBe('mp:workshop:deck_check_ack');
  });
});

// ── H10: initPeerPresenceMonitor ──────────────────────────────────────────────

describe('H10: initPeerPresenceMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends mp:ping on each interval tick', () => {
    const transport = createMockTransport();
    const cleanup = initPeerPresenceMonitor(
      'local_player',
      () => ['peer_A'],
      transport,
    );

    // Advance past one ping interval (15s)
    vi.advanceTimersByTime(15_001);

    const pings = transport.sent.filter(m => m.type === 'mp:ping');
    expect(pings.length).toBeGreaterThanOrEqual(1);
    expect(pings[0].payload).toMatchObject({ from: 'local_player' });

    cleanup();
  });

  it('emits mp:lobby:peer_left if peer has not ponged within timeout', () => {
    const transport = createMockTransport();
    const cleanup = initPeerPresenceMonitor(
      'local_player',
      () => ['peer_ghost'],
      transport,
    );

    // Advance well past the 30s pong timeout.
    // The interval fires at 15s (gap=15s < 30s threshold) and at 30s (gap=30s, exactly
    // equal to PEER_PONG_TIMEOUT_MS). Since the check is strict (>), we advance to 45s
    // so the third tick fires with gap=45s > 30s, guaranteeing the threshold is crossed.
    vi.advanceTimersByTime(46_000);

    const peerLeft = transport.sent.filter(
      m => m.type === 'mp:lobby:peer_left',
    );
    expect(peerLeft.length).toBeGreaterThanOrEqual(1);
    expect(peerLeft[0].payload).toMatchObject({ playerId: 'peer_ghost' });

    cleanup();
  });

  it('does NOT emit peer_left if peer responds with mp:pong within timeout', () => {
    const transport = createMockTransport();
    const cleanup = initPeerPresenceMonitor(
      'local_player',
      () => ['peer_alive'],
      transport,
    );

    // Advance 15s to first ping
    vi.advanceTimersByTime(15_001);

    // Peer responds with pong
    transport.simulateReceive('mp:pong', {}, 'peer_alive');

    // Advance another 20s (total 35s but peer ponged at 15s, so only 20s stale)
    vi.advanceTimersByTime(20_000);

    const peerLeft = transport.sent.filter(
      m => m.type === 'mp:lobby:peer_left',
    );
    expect(peerLeft).toHaveLength(0);

    cleanup();
  });

  it('auto-responds to incoming mp:ping with mp:pong', () => {
    const transport = createMockTransport();
    const cleanup = initPeerPresenceMonitor(
      'local_player',
      () => [],
      transport,
    );

    // Simulate receiving a ping from a remote peer
    transport.simulateReceive('mp:ping', { from: 'remote_peer' }, 'remote_peer');

    const pongs = transport.sent.filter(m => m.type === 'mp:pong');
    expect(pongs.length).toBeGreaterThanOrEqual(1);

    cleanup();
  });

  it('cleanup cancels the ping interval — no more pings after cleanup', () => {
    const transport = createMockTransport();
    const cleanup = initPeerPresenceMonitor(
      'local_player',
      () => ['peer_A'],
      transport,
    );

    vi.advanceTimersByTime(15_001);
    const pingsBeforeCleanup = transport.sent.filter(m => m.type === 'mp:ping').length;

    cleanup();
    transport.sent.length = 0; // reset

    vi.advanceTimersByTime(30_001);
    const pingsAfterCleanup = transport.sent.filter(m => m.type === 'mp:ping').length;
    expect(pingsAfterCleanup).toBe(0);
  });
});

// ── #75: double-init guard ────────────────────────────────────────────────────

describe('#75: initPeerPresenceMonitor — double-init guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tears down first monitor when initPeerPresenceMonitor is called a second time', () => {
    const transport1 = createMockTransport();
    const cleanup1 = initPeerPresenceMonitor('p1', () => ['peer_A'], transport1);

    // Advance to first ping so we know the first monitor is active.
    vi.advanceTimersByTime(15_001);
    const pingsAfterFirst = transport1.sent.filter(m => m.type === 'mp:ping').length;
    expect(pingsAfterFirst).toBeGreaterThanOrEqual(1);

    // Init a second monitor — this should tear down the first.
    const transport2 = createMockTransport();
    const cleanup2 = initPeerPresenceMonitor('p2', () => ['peer_B'], transport2);

    // Clear the first transport's sent list.
    transport1.sent.length = 0;

    // Advance another interval — only the second monitor should ping.
    vi.advanceTimersByTime(15_001);

    // First transport should receive NO new pings (its interval was cancelled).
    const pingsFromFirst = transport1.sent.filter(m => m.type === 'mp:ping').length;
    expect(pingsFromFirst).toBe(0);

    // Second transport should have received pings.
    const pingsFromSecond = transport2.sent.filter(m => m.type === 'mp:ping').length;
    expect(pingsFromSecond).toBeGreaterThanOrEqual(1);

    cleanup1(); // safe to call even after double-init superseded it
    cleanup2();
  });
});

// ── L4: Kick message types in MultiplayerMessageType union ───────────────────

import type { KickPayload, VoteKickStartPayload, VoteKickVotePayload } from './multiplayerTransport';

describe('L4: kick message types in MultiplayerMessageType union', () => {
  it('includes mp:lobby:kick without type cast', () => {
    const t: MultiplayerMessageType = 'mp:lobby:kick';
    expect(t).toBe('mp:lobby:kick');
  });

  it('includes mp:lobby:vote_kick_start without type cast', () => {
    const t: MultiplayerMessageType = 'mp:lobby:vote_kick_start';
    expect(t).toBe('mp:lobby:vote_kick_start');
  });

  it('includes mp:lobby:vote_kick_vote without type cast', () => {
    const t: MultiplayerMessageType = 'mp:lobby:vote_kick_vote';
    expect(t).toBe('mp:lobby:vote_kick_vote');
  });
});

describe('L4: KickPayload interface shape', () => {
  it('KickPayload has required fields targetPlayerId and issuedBy', () => {
    const payload: KickPayload = {
      targetPlayerId: 'player_abc',
      issuedBy: 'host_xyz',
    };
    expect(payload.targetPlayerId).toBe('player_abc');
    expect(payload.issuedBy).toBe('host_xyz');
    expect(payload.reason).toBeUndefined();
  });

  it('KickPayload accepts an optional reason', () => {
    const payload: KickPayload = {
      targetPlayerId: 'player_abc',
      issuedBy: 'host_xyz',
      reason: 'afk',
    };
    expect(payload.reason).toBe('afk');
  });

  it('VoteKickStartPayload has targetPlayerId and initiatedBy', () => {
    const payload: VoteKickStartPayload = {
      targetPlayerId: 'player_abc',
      initiatedBy: 'player_def',
    };
    expect(payload.targetPlayerId).toBe('player_abc');
    expect(payload.initiatedBy).toBe('player_def');
  });

  it('VoteKickVotePayload has targetPlayerId, vote, and voterId', () => {
    const payload: VoteKickVotePayload = {
      targetPlayerId: 'player_abc',
      vote: 'yes',
      voterId: 'voter_ghi',
    };
    expect(payload.vote).toBe('yes');
    expect(payload.voterId).toBe('voter_ghi');
  });
});
