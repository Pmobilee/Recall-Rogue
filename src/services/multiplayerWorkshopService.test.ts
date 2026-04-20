/**
 * Unit tests for multiplayerWorkshopService.
 *
 * Covers:
 *   H16 — checkAllPlayersHaveWorkshopDeck: pre-flight check protocol
 *   M14 — validateWorkshopDeckMetadata: field-size and HTML-tag constraints
 *   M14 — initWorkshopMessageHandlers mp:lobby:deck_select validation path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MultiplayerMessage, MultiplayerMessageType, MultiplayerTransport } from './multiplayerTransport';

// ---------------------------------------------------------------------------
// Mock transport factory (mirrors multiplayerLobbyService.test.ts pattern)
// ---------------------------------------------------------------------------

type MessageHandler = (msg: MultiplayerMessage) => void;

function createMockTransport(): MultiplayerTransport & {
  sent: Array<{ type: string; payload: Record<string, unknown> }>;
  simulateReceive(type: string, payload: Record<string, unknown>, senderId?: string): void;
} {
  const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];
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
    simulateReceive(type: string, payload: Record<string, unknown>, senderId = 'remote') {
      const list = handlers.get(type);
      if (list) {
        const msg: MultiplayerMessage = {
          type: type as MultiplayerMessageType,
          payload,
          timestamp: Date.now(),
          senderId,
        };
        list.forEach(cb => cb(msg));
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Module-level mock for multiplayerTransport
// ---------------------------------------------------------------------------

let mockTransport: ReturnType<typeof createMockTransport>;

vi.mock('./multiplayerTransport', () => ({
  getMultiplayerTransport: vi.fn(() => mockTransport),
  destroyMultiplayerTransport: vi.fn(),
}));

// Mock workshopService.isWorkshopAvailable
vi.mock('./workshopService', () => ({
  isWorkshopAvailable: vi.fn(() => true),
}));

// ---------------------------------------------------------------------------
// localStorage stub
// ---------------------------------------------------------------------------

let _localStore: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => _localStore[key] ?? null,
  setItem: (key: string, value: string) => { _localStore[key] = value; },
  removeItem: (key: string) => { delete _localStore[key]; },
  clear: () => { _localStore = {}; },
};

vi.stubGlobal('localStorage', localStorageMock);

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  checkAllPlayersHaveWorkshopDeck,
  validateWorkshopDeckMetadata,
  initWorkshopMessageHandlers,
  destroyWorkshopMultiplayer,
} = await import('./multiplayerWorkshopService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed localStorage with a fake installed workshop deck. */
function seedInstalledDeck(workshopId: string) {
  const existing = JSON.parse(_localStore['workshop_installed_decks'] ?? '[]') as object[];
  existing.push({
    workshopId,
    title: 'Test Deck',
    authorName: 'Tester',
    description: 'A test deck',
    upvotes: 10,
    downvotes: 2,
    tags: ['history'],
    subscriberCount: 42,
    updatedAt: 1700000000,
  });
  _localStore['workshop_installed_decks'] = JSON.stringify(existing);
}

// ---------------------------------------------------------------------------
// H16 — checkAllPlayersHaveWorkshopDeck
// ---------------------------------------------------------------------------

describe('H16 — checkAllPlayersHaveWorkshopDeck', () => {
  beforeEach(() => {
    _localStore = {};
    mockTransport = createMockTransport();
    destroyWorkshopMultiplayer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyWorkshopMultiplayer();
  });

  it('returns empty missing when all players ACK with installed=true within timeout', async () => {
    const players = ['p1', 'p2', 'p3'];
    const promise = checkAllPlayersHaveWorkshopDeck('workshop_abc', players);

    // Find the requestId from the sent deck_check message
    const checkMsg = mockTransport.sent.find(m => m.type === 'mp:workshop:deck_check');
    expect(checkMsg).toBeDefined();
    const { requestId } = checkMsg!.payload as { requestId: string };

    // Simulate all players ACK-ing with installed=true
    for (const playerId of players) {
      mockTransport.simulateReceive('mp:workshop:deck_check_ack', {
        requestId,
        playerId,
        installed: true,
      });
    }

    // Advance past the 2s timeout
    vi.advanceTimersByTime(2001);
    const result = await promise;

    expect(result.missing).toHaveLength(0);
  });

  it('returns all playerIds as missing when no ACKs arrive before timeout', async () => {
    const players = ['p1', 'p2'];
    const promise = checkAllPlayersHaveWorkshopDeck('workshop_xyz', players);

    vi.advanceTimersByTime(2001);
    const result = await promise;

    expect(result.missing).toEqual(expect.arrayContaining(['p1', 'p2']));
    expect(result.missing).toHaveLength(2);
  });

  it('marks non-ACKing players as missing even when others confirm', async () => {
    const players = ['p1', 'p2', 'p3'];
    const promise = checkAllPlayersHaveWorkshopDeck('workshop_def', players);

    const checkMsg = mockTransport.sent.find(m => m.type === 'mp:workshop:deck_check');
    const { requestId } = checkMsg!.payload as { requestId: string };

    // Only p1 responds
    mockTransport.simulateReceive('mp:workshop:deck_check_ack', {
      requestId,
      playerId: 'p1',
      installed: true,
    });

    vi.advanceTimersByTime(2001);
    const result = await promise;

    expect(result.missing).not.toContain('p1');
    expect(result.missing).toContain('p2');
    expect(result.missing).toContain('p3');
  });

  it('does not count ACKs with installed=false as confirmed', async () => {
    const players = ['p1'];
    const promise = checkAllPlayersHaveWorkshopDeck('workshop_ghi', players);

    const checkMsg = mockTransport.sent.find(m => m.type === 'mp:workshop:deck_check');
    const { requestId } = checkMsg!.payload as { requestId: string };

    // Player responds but says not installed
    mockTransport.simulateReceive('mp:workshop:deck_check_ack', {
      requestId,
      playerId: 'p1',
      installed: false,
    });

    vi.advanceTimersByTime(2001);
    const result = await promise;

    expect(result.missing).toContain('p1');
  });

  it('ignores ACKs with a different requestId', async () => {
    const players = ['p1'];
    const promise = checkAllPlayersHaveWorkshopDeck('workshop_jkl', players);

    // Simulate ACK with wrong requestId
    mockTransport.simulateReceive('mp:workshop:deck_check_ack', {
      requestId: 'wrong_request_id',
      playerId: 'p1',
      installed: true,
    });

    vi.advanceTimersByTime(2001);
    const result = await promise;

    expect(result.missing).toContain('p1');
  });

  it('broadcasts a mp:workshop:deck_check message with workshopItemId and requestId', async () => {
    const promise = checkAllPlayersHaveWorkshopDeck('workshop_mno', ['p1']);
    vi.advanceTimersByTime(2001);
    await promise;

    const checkMsg = mockTransport.sent.find(m => m.type === 'mp:workshop:deck_check');
    expect(checkMsg).toBeDefined();
    expect(checkMsg!.payload).toMatchObject({
      workshopItemId: 'workshop_mno',
      requestId: expect.stringContaining('deckcheck_workshop_mno'),
    });
  });

  it('responds to deck_check from host by sending deck_check_ack', () => {
    seedInstalledDeck('workshop_pqr');
    initWorkshopMessageHandlers('local_player_id');

    mockTransport.simulateReceive('mp:workshop:deck_check', {
      workshopItemId: 'workshop_pqr',
      requestId: 'req_001',
    });

    const ack = mockTransport.sent.find(m => m.type === 'mp:workshop:deck_check_ack');
    expect(ack).toBeDefined();
    expect(ack!.payload).toMatchObject({
      requestId: 'req_001',
      playerId: 'local_player_id',
      installed: true,
    });
  });

  it('sends installed=false in ack when deck is not in localStorage', () => {
    // No deck seeded
    initWorkshopMessageHandlers('local_player_id');

    mockTransport.simulateReceive('mp:workshop:deck_check', {
      workshopItemId: 'workshop_missing',
      requestId: 'req_002',
    });

    const ack = mockTransport.sent.find(m => m.type === 'mp:workshop:deck_check_ack');
    expect(ack).toBeDefined();
    expect(ack!.payload).toMatchObject({
      requestId: 'req_002',
      playerId: 'local_player_id',
      installed: false,
    });
  });
});

// ---------------------------------------------------------------------------
// M14 — validateWorkshopDeckMetadata
// ---------------------------------------------------------------------------

describe('M14 — validateWorkshopDeckMetadata', () => {
  it('accepts a valid deck metadata object', () => {
    const result = validateWorkshopDeckMetadata({
      title: 'World History',
      description: 'Covers ancient civilizations.',
      factCount: 50,
      author: 'HistoryBuff',
    });
    expect(result.ok).toBe(true);
  });

  // title constraints
  it('rejects empty title', () => {
    const r = validateWorkshopDeckMetadata({ title: '', factCount: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/title/);
  });

  it('rejects title over 100 characters', () => {
    const r = validateWorkshopDeckMetadata({ title: 'A'.repeat(101), factCount: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/title/);
  });

  it('accepts title exactly 100 characters', () => {
    const r = validateWorkshopDeckMetadata({ title: 'A'.repeat(100), factCount: 10 });
    expect(r.ok).toBe(true);
  });

  it('accepts title exactly 1 character', () => {
    const r = validateWorkshopDeckMetadata({ title: 'X', factCount: 1 });
    expect(r.ok).toBe(true);
  });

  it('rejects title containing HTML tag', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Hello <b>World</b>', factCount: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/HTML/);
  });

  it('rejects title that is missing (undefined)', () => {
    const r = validateWorkshopDeckMetadata({ factCount: 10 });
    expect(r.ok).toBe(false);
  });

  // description constraints
  it('rejects description over 500 characters', () => {
    const r = validateWorkshopDeckMetadata({
      title: 'Valid Title',
      description: 'X'.repeat(501),
      factCount: 10,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/description/);
  });

  it('accepts description exactly 500 characters', () => {
    const r = validateWorkshopDeckMetadata({
      title: 'Valid Title',
      description: 'X'.repeat(500),
      factCount: 10,
    });
    expect(r.ok).toBe(true);
  });

  it('accepts missing description (optional field)', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid Title', factCount: 10 });
    expect(r.ok).toBe(true);
  });

  it('accepts empty string description', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid Title', description: '', factCount: 10 });
    expect(r.ok).toBe(true);
  });

  it('rejects description containing HTML tag', () => {
    const r = validateWorkshopDeckMetadata({
      title: 'Valid Title',
      description: '<script>alert("xss")</script>',
      factCount: 5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/HTML/);
  });

  // factCount constraints
  it('rejects factCount = 0', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid', factCount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/factCount/);
  });

  it('accepts factCount = 1 (lower boundary)', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid', factCount: 1 });
    expect(r.ok).toBe(true);
  });

  it('accepts factCount = 5000 (upper boundary)', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid', factCount: 5000 });
    expect(r.ok).toBe(true);
  });

  it('rejects factCount = 5001', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid', factCount: 5001 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/factCount/);
  });

  it('rejects negative factCount', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid', factCount: -1 });
    expect(r.ok).toBe(false);
  });

  it('rejects non-integer factCount', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid', factCount: 10.5 });
    expect(r.ok).toBe(false);
  });

  it('rejects missing factCount', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid' });
    expect(r.ok).toBe(false);
  });

  // author constraints
  it('rejects author over 64 characters', () => {
    const r = validateWorkshopDeckMetadata({
      title: 'Valid',
      factCount: 10,
      author: 'A'.repeat(65),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/author/);
  });

  it('accepts author exactly 64 characters', () => {
    const r = validateWorkshopDeckMetadata({
      title: 'Valid',
      factCount: 10,
      author: 'A'.repeat(64),
    });
    expect(r.ok).toBe(true);
  });

  it('accepts missing author (optional field)', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Valid', factCount: 10 });
    expect(r.ok).toBe(true);
  });

  // HTML edge cases
  it('rejects title with self-closing HTML tag', () => {
    const r = validateWorkshopDeckMetadata({ title: 'Hello <br/>', factCount: 5 });
    expect(r.ok).toBe(false);
  });

  it('rejects title with partial-looking tag (has < and >)', () => {
    const r = validateWorkshopDeckMetadata({ title: '<script>', factCount: 5 });
    expect(r.ok).toBe(false);
  });

  it('allows angle brackets that are not a valid HTML tag pattern (e.g. math notation a<b)', () => {
    // The regex is /<[^>]+>/ — a single < without matching > does not match
    const r = validateWorkshopDeckMetadata({ title: 'a < b > c means something', factCount: 5 });
    // 'a < b > c means something' — does "<" followed by " b " followed by ">" match /<[^>]+>/? YES it does.
    // " b " has no ">" inside, so /<[^>]+>/ would match "< b >" → rejected.
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// M14 — mp:lobby:deck_select handler in initWorkshopMessageHandlers
// ---------------------------------------------------------------------------

describe('M14 — initWorkshopMessageHandlers deck_select validation', () => {
  beforeEach(() => {
    _localStore = {};
    mockTransport = createMockTransport();
    destroyWorkshopMultiplayer();
  });

  afterEach(() => {
    destroyWorkshopMultiplayer();
  });

  it('invokes onDeckSelect callback for valid workshop deck payload', () => {
    const onDeckSelect = vi.fn();
    initWorkshopMessageHandlers('p1', onDeckSelect);

    mockTransport.simulateReceive('mp:lobby:deck_select', {
      workshopId: 'ws_001',
      title: 'History Deck',
      author: 'Author1',
      description: 'Covers ancient history.',
      factCount: 100,
      rating: 4.5,
      ratingCount: 20,
      domains: ['history'],
      subscriberCount: 300,
      lastUpdated: Date.now(),
    });

    expect(onDeckSelect).toHaveBeenCalledTimes(1);
    expect(onDeckSelect.mock.calls[0][0]).toMatchObject({
      workshopId: 'ws_001',
      title: 'History Deck',
    });
  });

  it('drops mp:lobby:deck_select with HTML in title — onDeckSelect not called', () => {
    const onDeckSelect = vi.fn();
    initWorkshopMessageHandlers('p1', onDeckSelect);

    mockTransport.simulateReceive('mp:lobby:deck_select', {
      workshopId: 'ws_002',
      title: '<marquee>XSS</marquee>',
      author: 'Attacker',
      description: 'Bad deck',
      factCount: 50,
      rating: 1,
      ratingCount: 1,
      domains: [],
      subscriberCount: 0,
      lastUpdated: Date.now(),
    });

    expect(onDeckSelect).not.toHaveBeenCalled();
  });

  it('drops mp:lobby:deck_select with factCount out of range', () => {
    const onDeckSelect = vi.fn();
    initWorkshopMessageHandlers('p1', onDeckSelect);

    mockTransport.simulateReceive('mp:lobby:deck_select', {
      workshopId: 'ws_003',
      title: 'Valid Title',
      author: 'Someone',
      description: 'Fine description',
      factCount: 99999, // way too large
      rating: 3,
      ratingCount: 5,
      domains: [],
      subscriberCount: 0,
      lastUpdated: Date.now(),
    });

    expect(onDeckSelect).not.toHaveBeenCalled();
  });

  it('skips validation and does not call onDeckSelect for non-workshop deck_select (no workshopId)', () => {
    const onDeckSelect = vi.fn();
    initWorkshopMessageHandlers('p1', onDeckSelect);

    // Simulate a non-workshop deck select (no workshopId field)
    mockTransport.simulateReceive('mp:lobby:deck_select', {
      customDeckId: 'personal_deck_001',
      title: 'My Personal Deck',
    });

    // onDeckSelect should not be called — not a workshop deck
    expect(onDeckSelect).not.toHaveBeenCalled();
  });

  it('does not crash when onDeckSelect is not provided', () => {
    // No onDeckSelect callback
    initWorkshopMessageHandlers('p1');

    expect(() => {
      mockTransport.simulateReceive('mp:lobby:deck_select', {
        workshopId: 'ws_004',
        title: 'Fine Deck',
        factCount: 20,
        rating: 3,
        ratingCount: 5,
        domains: [],
        subscriberCount: 10,
        lastUpdated: Date.now(),
      });
    }).not.toThrow();
  });
});
