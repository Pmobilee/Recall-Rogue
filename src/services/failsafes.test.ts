/**
 * Failsafe watchdog tests — Class A (hand/deck/AP) and Class B (enemy state).
 *
 * Tests simulate stuck states at the service boundary and assert that watchdogs
 * detect + log the condition and (for Class A) trigger repair within the expected
 * window.
 *
 * The full interactive repair path (patchTurnState, coop resnapshot) is integration-
 * only — these unit tests cover the detection and validation logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initFailsafeWatchdogs,
  destroyFailsafeWatchdogs,
  validateEnemyState,
  validateCoopHpUpdate,
  monitorDeltaBucketSize,
  handleCoopReconcileFailure,
  handleCoopBarrierCancel,
  notifyCardCommitted,
  notifyCardResolved,
} from './failsafeWatchdogs';
import { rrLog } from './rrLog';

// ─── Mock rrLog to capture log calls ────────────────────────────────────────────

vi.mock('./rrLog', () => ({
  rrLog: vi.fn(),
}));

// ─── Mock circular deps ──────────────────────────────────────────────────────────

vi.mock('./encounterBridge', () => ({
  activeTurnState: { subscribe: vi.fn(), set: vi.fn() },
  patchTurnState: vi.fn().mockReturnValue(true),
  getCombatScene: vi.fn().mockReturnValue(null),
  coopWaitingForPartner: { set: vi.fn() },
  getActiveDeckCards: vi.fn().mockReturnValue([]),
}));

vi.mock('./runStateStore', () => ({
  activeRunState: { subscribe: vi.fn() },
}));

vi.mock('./multiplayerCoopSync', () => ({
  requestCoopEnemyStateRetry: vi.fn(),
}));

vi.mock('./cardAudioManager', () => ({
  playCardAudio: vi.fn(),
}));

// ─── Helper ──────────────────────────────────────────────────────────────────────

function mockRrLog(): ReturnType<typeof vi.fn> {
  return vi.mocked(rrLog);
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────────

describe('initFailsafeWatchdogs / destroyFailsafeWatchdogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    destroyFailsafeWatchdogs();
    vi.useRealTimers();
  });

  it('emits init log on start', () => {
    initFailsafeWatchdogs();
    expect(mockRrLog()).toHaveBeenCalledWith('watchdog:hand', 'init — encounter watchdogs started');
  });

  it('emits destroy log on stop', () => {
    initFailsafeWatchdogs();
    vi.clearAllMocks();
    destroyFailsafeWatchdogs();
    expect(mockRrLog()).toHaveBeenCalledWith('watchdog:hand', 'destroy — encounter watchdogs stopped');
  });

  it('safe to call destroyFailsafeWatchdogs when not started', () => {
    expect(() => destroyFailsafeWatchdogs()).not.toThrow();
  });

  it('safe to call initFailsafeWatchdogs multiple times (idempotent)', () => {
    initFailsafeWatchdogs();
    initFailsafeWatchdogs();
    expect(mockRrLog()).toHaveBeenCalledWith('watchdog:hand', 'init — encounter watchdogs started');
  });
});

// ─── Class A: Card committed stage ───────────────────────────────────────────────

describe('notifyCardCommitted / notifyCardResolved (Class A: cardPlay watchdog)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    destroyFailsafeWatchdogs();
    vi.useRealTimers();
  });

  it('logs committed event with cardId', () => {
    notifyCardCommitted('card-strike-001');
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:cardPlay',
      'card committed — quiz open',
      { cardId: 'card-strike-001' },
    );
  });

  it('logs resolved event with outcome', () => {
    notifyCardCommitted('card-block-002');
    vi.clearAllMocks();
    notifyCardResolved('card-block-002', 'correct');
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:cardPlay',
      'card resolved',
      expect.objectContaining({ cardId: 'card-block-002', outcome: 'correct' }),
    );
  });

  it('notifyCardResolved is safe to call when no card is committed', () => {
    expect(() => notifyCardResolved('card-999', 'wrong')).not.toThrow();
  });
});

// ─── Class B: Enemy state validation ─────────────────────────────────────────────

describe('validateEnemyState (Class B: enemy validation)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs a warning when enemy is null', () => {
    validateEnemyState(null);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:enemy',
      'INVALID — enemy is null or non-object at encounter start',
      expect.anything(),
    );
  });

  it('clamps NaN currentHP to maxHP', () => {
    const enemy = { currentHP: NaN, maxHP: 100, template: { id: 'goblin', intentPool: [{}] } };
    validateEnemyState(enemy);
    expect(enemy.currentHP).toBe(100);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:enemy',
      'INVALID — currentHP is NaN, clamping to maxHP',
      expect.objectContaining({ id: 'goblin' }),
    );
  });

  it('clamps negative currentHP to 0', () => {
    const enemy = { currentHP: -5, maxHP: 50, template: { id: 'goblin', intentPool: [{}] } };
    validateEnemyState(enemy);
    expect(enemy.currentHP).toBe(0);
  });

  it('clamps currentHP above maxHP', () => {
    const enemy = { currentHP: 200, maxHP: 100, template: { id: 'goblin', intentPool: [{}] } };
    validateEnemyState(enemy);
    expect(enemy.currentHP).toBe(100);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:enemy',
      'WARN — currentHP exceeds maxHP, clamping',
      expect.anything(),
    );
  });

  it('clamps zero/negative maxHP to 1', () => {
    const enemy = { currentHP: 0, maxHP: 0, template: { id: 'goblin', intentPool: [{}] } };
    validateEnemyState(enemy);
    expect(enemy.maxHP).toBe(1);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:enemy',
      'INVALID — maxHP is invalid, clamping to 1',
      expect.anything(),
    );
  });

  it('warns when intent pool is empty', () => {
    const enemy = { currentHP: 50, maxHP: 100, template: { id: 'goblin', intentPool: [] } };
    validateEnemyState(enemy);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:enemy',
      'WARN — intent pool is empty or missing',
      expect.objectContaining({ id: 'goblin' }),
    );
  });

  it('passes a valid enemy without clamping', () => {
    const enemy = { currentHP: 80, maxHP: 100, template: { id: 'goblin', intentPool: [{ type: 'attack', value: 10 }] } };
    validateEnemyState(enemy);
    expect(enemy.currentHP).toBe(80);
    expect(enemy.maxHP).toBe(100);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:enemy',
      'validated',
      expect.objectContaining({ id: 'goblin', currentHP: 80, maxHP: 100 }),
    );
  });
});

// ─── Class C: Coop HP clamping ───────────────────────────────────────────────────

describe('validateCoopHpUpdate (Class C: coop HP validation)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes valid HP through unchanged', () => {
    const result = validateCoopHpUpdate(80, 100, 100);
    expect(result).toEqual({ currentHP: 80, maxHP: 100 });
  });

  it('clamps currentHP above maxHP', () => {
    const result = validateCoopHpUpdate(120, 100, 100);
    expect(result.currentHP).toBe(100);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:coop',
      'clamp — currentHP > maxHP',
      expect.anything(),
    );
  });

  it('clamps negative currentHP to 0', () => {
    const result = validateCoopHpUpdate(-10, 100, 100);
    expect(result.currentHP).toBe(0);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:coop',
      'clamp — currentHP < 0',
      expect.anything(),
    );
  });

  it('handles NaN currentHP by falling back to localMaxHP', () => {
    const result = validateCoopHpUpdate(NaN, 100, 100);
    expect(result.currentHP).toBe(100);
  });

  it('uses localMaxHP as cap when wire maxHP is 0', () => {
    const result = validateCoopHpUpdate(50, 0, 100);
    expect(result.maxHP).toBe(100);
  });
});

// ─── Class C: Delta bucket monitoring ────────────────────────────────────────────

describe('monitorDeltaBucketSize (Class C: M-047 regression watchdog)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not log when bucket size equals player count', () => {
    monitorDeltaBucketSize(3, 2, 2);
    expect(mockRrLog()).not.toHaveBeenCalled();
  });

  it('logs overflow when bucket size exceeds player count', () => {
    monitorDeltaBucketSize(3, 3, 2);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:coop',
      'delta bucket overflow — M-047 regression suspected',
      expect.objectContaining({ turnNumber: 3, bucketSize: 3, playerCount: 2, excess: 1 }),
    );
  });

  it('logs very large buckets even if within player count', () => {
    // 8 < MAX_DELTA_BUCKET_SIZE (8) — should not fire "very large" log.
    monitorDeltaBucketSize(1, 8, 10);
    expect(mockRrLog()).not.toHaveBeenCalled();
  });

  it('logs very large buckets above MAX_DELTA_BUCKET_SIZE', () => {
    monitorDeltaBucketSize(1, 9, 10);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:coop',
      'delta bucket very large — possible runaway accumulation',
      expect.objectContaining({ bucketSize: 9 }),
    );
  });
});

// ─── Class C: Coop reconcile failure ─────────────────────────────────────────────

describe('handleCoopReconcileFailure (Class C: reconcile watchdog)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs failure with attempt count', () => {
    handleCoopReconcileFailure(2);
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:reconcile',
      'FAILED — both reconcile attempts timed out, using local enemy state',
      expect.objectContaining({ attempt: 2 }),
    );
  });

  it('does not throw', () => {
    expect(() => handleCoopReconcileFailure(1)).not.toThrow();
  });
});

// ─── Class C: Coop barrier cancel ────────────────────────────────────────────────

describe('handleCoopBarrierCancel (Class C: barrier watchdog)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs barrier cancellation with reason=timeout', () => {
    handleCoopBarrierCancel('timeout');
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:barrier',
      'barrier cancelled — reason=timeout',
      expect.objectContaining({ reason: 'timeout' }),
    );
  });

  it('logs barrier cancellation with reason=partner_left', () => {
    handleCoopBarrierCancel('partner_left');
    expect(mockRrLog()).toHaveBeenCalledWith(
      'watchdog:barrier',
      'barrier cancelled — reason=partner_left',
      expect.objectContaining({ reason: 'partner_left' }),
    );
  });

  it('does not throw', () => {
    expect(() => handleCoopBarrierCancel('local_cancel')).not.toThrow();
  });
});

// ─── Lifecycle: init resets scene-null state ─────────────────────────────────────

describe('initFailsafeWatchdogs resets all state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    destroyFailsafeWatchdogs();
    vi.useRealTimers();
  });

  it('emits init log and does not throw', () => {
    expect(() => initFailsafeWatchdogs()).not.toThrow();
    expect(mockRrLog()).toHaveBeenCalledWith('watchdog:hand', 'init — encounter watchdogs started');
  });
});
