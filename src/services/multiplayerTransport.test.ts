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
    setActiveLobby: vi.fn(),
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

// ── C4: SteamP2PTransport — outbound pre-connect buffer ──────────────────────
//
// Tests the _preSendBuffer fix: send() calls during state==='connecting' must be
// buffered and flushed after acceptP2PSession resolves.

import { SteamP2PTransport } from './multiplayerTransport';

// Mock steamNetworkingService at module level — Vitest hoists vi.mock() calls.
vi.mock('./steamNetworkingService', async () => {
  return {
    acceptP2PSession: vi.fn(),
    sendP2PMessage: vi.fn(),
    startMessagePollLoop: vi.fn(),
    leaveSteamLobby: vi.fn(),
    getLobbyMembers: vi.fn(),
    // BUG1/BUG5: New imports — must be present in mock or transport module fails to import.
    getSessionError: vi.fn().mockResolvedValue(null),
    getP2PConnectionState: vi.fn().mockResolvedValue('state=None'),
  };
});

// Typed accessor so tests can control mock behavior
async function getSteamMocks() {
  const mod = await import('./steamNetworkingService');
  return {
    acceptP2PSession: mod.acceptP2PSession as ReturnType<typeof vi.fn>,
    sendP2PMessage: mod.sendP2PMessage as ReturnType<typeof vi.fn>,
    startMessagePollLoop: mod.startMessagePollLoop as ReturnType<typeof vi.fn>,
    leaveSteamLobby: mod.leaveSteamLobby as ReturnType<typeof vi.fn>,
    getSessionError: (mod as any).getSessionError as ReturnType<typeof vi.fn>,
    getP2PConnectionState: (mod as any).getP2PConnectionState as ReturnType<typeof vi.fn>,
  };
}

describe('C4: SteamP2PTransport outbound pre-connect buffer', () => {
  beforeEach(async () => {
    const m = await getSteamMocks();
    m.acceptP2PSession.mockReset();
    m.sendP2PMessage.mockReset();
    m.startMessagePollLoop.mockReset();
    m.leaveSteamLobby.mockReset();
    if (m.getSessionError) m.getSessionError.mockReset?.();
    if (m.getP2PConnectionState) m.getP2PConnectionState.mockReset?.();
    // Default: accept resolves with true (bool), sendP2PMessage resolves with true, poll loop is a no-op
    // BUG1: sendP2PMessage now returns Promise<boolean>; true = success.
    m.sendP2PMessage.mockResolvedValue(true);
    m.startMessagePollLoop.mockReturnValue(() => {});
    if (m.getSessionError) m.getSessionError.mockResolvedValue(null);
    if (m.getP2PConnectionState) m.getP2PConnectionState.mockResolvedValue('state=None');
  });

  it('buffers send() calls while state is connecting, flushes after accept resolves', async () => {
    const m = await getSteamMocks();
    // PASS1-BUG-9 update: accept must resolve to true for transport to reach 'connected'.
    // resolveAccept now takes a boolean so the test mirrors the Rust Result<bool> contract.
    let resolveAccept!: (ok: boolean) => void;
    m.acceptP2PSession.mockReturnValue(new Promise<boolean>((res) => { resolveAccept = res; }));

    const transport = new SteamP2PTransport();
    transport.connect('peer_steam_id', 'local_steam_id');

    // State is now 'connecting' — send should buffer, not call sendP2PMessage
    transport.send('mp:ping', { from: 'local_steam_id' });
    transport.send('mp:pong', { to: 'peer_steam_id' });

    expect(m.sendP2PMessage).not.toHaveBeenCalled();

    // Now resolve the accept (true → connected) — the .then() handler should flush _preSendBuffer
    resolveAccept(true);
    // Let the microtask queue drain
    await Promise.resolve();
    await Promise.resolve();

    expect(m.sendP2PMessage).toHaveBeenCalledTimes(2);
    // Verify payloads contain the buffered message types
    const calls = m.sendP2PMessage.mock.calls;
    const parsedFirst = JSON.parse(calls[0][1] as string);
    const parsedSecond = JSON.parse(calls[1][1] as string);
    expect(parsedFirst.type).toBe('mp:ping');
    expect(parsedSecond.type).toBe('mp:pong');
  });

  it('a single send() while connecting buffers one message', async () => {
    const m = await getSteamMocks();
    // PASS1-BUG-9 update: accept must resolve to true for connected.
    let resolveAccept!: (ok: boolean) => void;
    m.acceptP2PSession.mockReturnValue(new Promise<boolean>((res) => { resolveAccept = res; }));

    const transport = new SteamP2PTransport();
    transport.connect('peer_steam_id', 'local_steam_id');

    transport.send('mp:lobby:ready', { playerId: 'local_steam_id' });
    expect(m.sendP2PMessage).not.toHaveBeenCalled();

    resolveAccept(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(m.sendP2PMessage).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(m.sendP2PMessage.mock.calls[0][1] as string);
    expect(parsed.type).toBe('mp:lobby:ready');
  });

  it('send() while state is error logs a warning and does not buffer', async () => {
    const m = await getSteamMocks();
    // Make accept fail immediately
    m.acceptP2PSession.mockRejectedValue(new Error('steam reject'));

    // rrLog uses console.log, not console.warn — spy on log to capture transport messages
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const transport = new SteamP2PTransport();
    transport.connect('peer_steam_id', 'local_steam_id');

    // Drain the microtask queue so .catch() fires and sets state='error'
    await Promise.resolve();
    await Promise.resolve();

    expect(transport.getState()).toBe('error');

    transport.send('mp:ping', {});
    expect(m.sendP2PMessage).not.toHaveBeenCalled();
    // A log must have been emitted with the message type
    const logCalls = logSpy.mock.calls.flat().join(' ');
    expect(logCalls).toContain('mp:ping');

    logSpy.mockRestore();
  });

  it('MP-STEAM-20260422-071: buffer cap raised to 256, evicts oldest non-protected on overflow', async () => {
    const m = await getSteamMocks();
    // PASS1-BUG-9 update: accept must resolve to true for transport to reach 'connected'.
    let resolveAccept!: (ok: boolean) => void;
    m.acceptP2PSession.mockReturnValue(new Promise<boolean>((res) => { resolveAccept = res; }));

    // rrLog uses console.log — spy on log to capture overflow message
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const transport = new SteamP2PTransport();
    transport.connect('peer_steam_id', 'local_steam_id');

    // Queue 257 messages — first is 'mp:ping' (the one that should be evicted at cap=256).
    // None of these are protected (mp:lobby:settings/start/join/start_ack), so the
    // _enqueueWithProtection helper picks the OLDEST (the mp:ping) for eviction.
    transport.send('mp:ping', { seq: 0 }); // oldest non-protected — evicted at cap
    for (let i = 1; i <= 256; i++) {
      transport.send('mp:pong', { seq: i });
    }

    // Overflow log must have fired with the new label "evicted oldest non-critical"
    const logCalls = logSpy.mock.calls.flat().join(' ');
    expect(logCalls).toContain('overflow');
    expect(logCalls).toContain('evicted oldest non-critical');

    // Flush
    resolveAccept(true);
    await Promise.resolve();
    await Promise.resolve();

    // Exactly 256 sends should have been flushed (the 257th buffered, the 1st evicted)
    expect(m.sendP2PMessage).toHaveBeenCalledTimes(256);
    // All flushed messages should be 'mp:pong', not 'mp:ping' (which was evicted)
    for (const call of m.sendP2PMessage.mock.calls) {
      const parsed = JSON.parse(call[1] as string);
      expect(parsed.type).toBe('mp:pong');
    }

    logSpy.mockRestore();
  });

  it('MP-STEAM-20260422-071: protected types (mp:lobby:settings) are NEVER evicted at overflow', async () => {
    const m = await getSteamMocks();
    let resolveAccept!: (ok: boolean) => void;
    m.acceptP2PSession.mockReturnValue(new Promise<boolean>((res) => { resolveAccept = res; }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const transport = new SteamP2PTransport();
    transport.connect('peer_steam_id', 'local_steam_id');

    // Queue mp:lobby:settings as the FIRST message (would have been evicted under
    // the old FIFO policy). Then fill the buffer past cap with mp:pong.
    transport.send('mp:lobby:settings', { critical: true, seq: 0 });
    for (let i = 1; i <= 256; i++) {
      transport.send('mp:pong', { seq: i });
    }

    resolveAccept(true);
    await Promise.resolve();
    await Promise.resolve();

    // The first mp:lobby:settings must be flushed even after overflow.
    const flushedTypes = m.sendP2PMessage.mock.calls.map(call => JSON.parse(call[1] as string).type);
    expect(flushedTypes).toContain('mp:lobby:settings');

    logSpy.mockRestore();
  });

  it('disconnect() clears both _preAcceptBuffer and _preSendBuffer', async () => {
    const m = await getSteamMocks();
    let resolveAccept!: (ok: boolean) => void;
    m.acceptP2PSession.mockReturnValue(new Promise<boolean>((res) => { resolveAccept = res; }));

    const transport = new SteamP2PTransport();
    transport.connect('peer_steam_id', 'local_steam_id');

    // Queue an outbound message before disconnect
    transport.send('mp:ping', {});

    // Disconnect before accept resolves
    transport.disconnect();

    expect(transport.getState()).toBe('disconnected');

    // Now resolve the accept — the .then() guard checks state !== 'connecting' so it returns early
    resolveAccept(true);
    await Promise.resolve();
    await Promise.resolve();

    // Nothing should have been sent — buffer was cleared on disconnect
    expect(m.sendP2PMessage).not.toHaveBeenCalled();
  });

  it('connect failure (.catch) clears _preSendBuffer and logs the count', async () => {
    const m = await getSteamMocks();
    m.acceptP2PSession.mockRejectedValue(new Error('steam reject'));

    // rrLog uses console.log — spy on log to capture the drop-count message
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const transport = new SteamP2PTransport();
    transport.connect('peer_steam_id', 'local_steam_id');

    // Send 3 messages during connecting
    transport.send('mp:ping', {});
    transport.send('mp:pong', {});
    transport.send('mp:lobby:ready', {});

    // Let .catch() fire
    await Promise.resolve();
    await Promise.resolve();

    expect(transport.getState()).toBe('error');
    expect(m.sendP2PMessage).not.toHaveBeenCalled();

    // Log should mention how many pending sends were dropped
    const logCalls = logSpy.mock.calls.flat().join(' ');
    expect(logCalls).toContain('3');
    expect(logCalls).toContain('preSendBuffer');

    logSpy.mockRestore();
  });
});
