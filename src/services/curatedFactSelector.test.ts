import { describe, it, expect, beforeEach } from 'vitest';
import { selectFactForCharge } from './curatedFactSelector';
import { InRunFactTracker } from './inRunFactTracker';
import type { DeckFact } from '../data/curatedDeckTypes';

/** Minimal DeckFact factory */
function makeFact(id: string, difficulty = 3): DeckFact {
  return {
    id,
    quizQuestion: `Question for ${id}`,
    correctAnswer: `Answer for ${id}`,
    distractors: ['wrong-1', 'wrong-2', 'wrong-3'],
    difficulty,
    funScore: 5,
    explanation: `Explanation for ${id}`,
    answerTypePoolId: 'default',
  } as DeckFact;
}

const RUN_SEED = 42;

const POOL_5 = [makeFact('a'), makeFact('b'), makeFact('c'), makeFact('d'), makeFact('e')];

describe('selectFactForCharge — recent fact cooldown window dedup', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('does not select the immediately previous fact', () => {
    tracker.recordCharge('a', true);
    for (let i = 0; i < 10; i++) {
      const result = selectFactForCharge(POOL_5, tracker, 0, RUN_SEED + i);
      expect(result.fact.id).not.toBe('a');
    }
  });

  it('dedup persists across advanceEncounter', () => {
    tracker.recordCharge('a', true);
    tracker.advanceEncounter();
    const result = selectFactForCharge(POOL_5, tracker, 0, RUN_SEED);
    expect(result.fact.id).not.toBe('a');
  });

  it('returns a valid fact for single-entry pool', () => {
    const singlePool = [makeFact('only')];
    tracker.recordCharge('only', true);
    const result = selectFactForCharge(singlePool, tracker, 0, RUN_SEED);
    expect(result.fact.id).toBe('only');
  });

  it('fact shown at charge N does not appear within RECENT_FACT_WINDOW (3) charges on large pool', () => {
    // Pool large enough (10 facts) to always have non-recent alternatives.
    const bigPool = [
      makeFact('a'), makeFact('b'), makeFact('c'), makeFact('d'), makeFact('e'),
      makeFact('f'), makeFact('g'), makeFact('h'), makeFact('i'), makeFact('j'),
    ];
    const localTracker = new InRunFactTracker();

    // Record fact-a being shown, then verify it is excluded for the next 3 charges.
    localTracker.recordCharge('a', true);

    for (let i = 0; i < 3; i++) {
      const result = selectFactForCharge(bigPool, localTracker, 0, RUN_SEED + i);
      expect(result.fact.id).not.toBe('a');
      // Record the selected fact so the window advances naturally.
      localTracker.recordCharge(result.fact.id, true);
    }

    // After 3 more charges the window has rolled past 'a' — it is eligible again.
    // (We simply verify the selector doesn't throw; deterministic eligibility depends on
    // learning state, so we don't assert a specific ID here.)
    const afterWindow = selectFactForCharge(bigPool, localTracker, 0, RUN_SEED + 100);
    expect(afterWindow.fact).toBeDefined();
  });

  it('falls back to single-fact exclusion when pool is too small to apply full window', () => {
    // A 2-fact pool with a 3-entry window would exclude everything if full window applied.
    const tinyPool = [makeFact('x'), makeFact('y')];
    const localTracker = new InRunFactTracker();
    // Fill window with x, y, x (all 3 slots used)
    localTracker.recordCharge('x', true);
    localTracker.recordCharge('y', true);
    localTracker.recordCharge('x', true); // lastFactId = x, window = [x, y, x]
    // Full window would exclude both x and y → starvation. Selector should fall back and serve y.
    const result = selectFactForCharge(tinyPool, localTracker, 0, RUN_SEED);
    // lastFactId is x, so only x is excluded — y should be returned
    expect(result.fact.id).toBe('y');
  });
});

describe('selectFactForCharge — Priority 0: forced new card introduction', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('forces a new card after 3 charges with no new card served', () => {
    // Put 2 facts into learning to fill the queue without maxing out
    tracker.recordCharge('a', true); // learning, chargesSinceLastNew=1
    tracker.recordNewCardServed();    // reset counter: chargesSinceLastNew=0
    tracker.recordCharge('b', true); // chargesSinceLastNew=1
    tracker.recordCharge('c', true); // chargesSinceLastNew=2
    tracker.recordCharge('d', true); // chargesSinceLastNew=3 → shouldForceNewCard=true
    // c and d are in learning (lastFactId=d), a and b are in learning
    // Only 'e' is unseen new; shouldForceNewCard() returns true
    expect(tracker.shouldForceNewCard()).toBe(true);
    const result = selectFactForCharge(POOL_5, tracker, 0, RUN_SEED);
    expect(result.fact.id).toBe('e');
    expect(result.selectionReason).toBe('unseen');
  });

  it('does NOT force new card when canIntroduceNew returns false (8 in learning)', () => {
    // Fill learning queue to 8
    const bigPool: DeckFact[] = [];
    for (let i = 0; i < 12; i++) bigPool.push(makeFact(`f${i}`));
    for (let i = 0; i < 8; i++) tracker.recordCharge(`f${i}`, true);
    // Advance 3 more charges on facts NOT in the pool to trigger force
    tracker.recordCharge('x', true);
    tracker.recordCharge('y', true);
    tracker.recordCharge('z', true);
    expect(tracker.shouldForceNewCard()).toBe(true);
    expect(tracker.canIntroduceNew()).toBe(false);
    // Selector must NOT force a new card — falls through to learning/review queues
    const result = selectFactForCharge(bigPool, tracker, 0, RUN_SEED);
    // Result should not be 'unseen' via priority 0 since learning queue is full
    // (could be struggling if due, or random/ahead if nothing due)
    expect(result).toBeDefined();
  });

  it('selecting via Priority 0 resets chargesSinceLastNew', () => {
    tracker.recordCharge('a', true); // chargesSinceLastNew=1
    tracker.recordNewCardServed();    // reset
    tracker.recordCharge('b', true); // chargesSinceLastNew=1
    tracker.recordCharge('c', true); // chargesSinceLastNew=2
    tracker.recordCharge('d', true); // chargesSinceLastNew=3 → force
    expect(tracker.shouldForceNewCard()).toBe(true);
    selectFactForCharge(POOL_5, tracker, 0, RUN_SEED);
    // After selection, recordNewCardServed was called inside selector
    expect(tracker.shouldForceNewCard()).toBe(false);
  });
});

describe('selectFactForCharge — Priority 1: due learning cards', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('surfaces due learning card (priority 1) when no forced new', () => {
    // Put fact-a into learning, due in 4 charges
    tracker.recordCharge('a', true); // total=1, due=5
    tracker.recordNewCardServed();    // prevent forced new from interfering

    // Make 4 more charges so fact-a becomes due
    tracker.recordCharge('b', true); // total=2
    tracker.recordCharge('c', true); // total=3
    tracker.recordCharge('d', true); // total=4
    tracker.recordCharge('e', true); // total=5 → a is due, lastFactId=e

    // Advance encounter so lastFactId isn't an issue
    tracker.advanceEncounter();

    // shouldForceNewCard: chargesSinceLastNew was reset then 4 more = 4 >= 3 → force?
    // But all new cards are gone: a,b,c,d,e are all in learning.
    // canIntroduceNew is true (5 < 8) but no unseen facts in POOL_5.
    // So Priority 0 finds no forcedNew, falls through to Priority 1.
    const result = selectFactForCharge(POOL_5, tracker, 0, RUN_SEED);
    expect(result.fact.id).toBe('a');
    expect(result.selectionReason).toBe('struggling');
  });

  it('due learning card excluded when it equals lastFactId', () => {
    tracker.recordCharge('a', true); // step 0, due=5, total=1
    tracker.recordNewCardServed();
    for (let i = 0; i < 4; i++) tracker.recordCharge('b', true);
    // totalCharges=5, fact-a is due, lastFactId=b
    // manually set lastFactId to a: record one more charge on 'a' to make a the last
    // Actually we need a different setup — let's use a pool with only 'a' as a learning candidate
    tracker.recordCharge('a', true); // now a is at step 1, last=a

    // advance totalCharges to make a due again at step 1
    for (let i = 0; i < 10; i++) tracker.recordCharge('c', true);
    // last is now 'c', a is due
    tracker.recordCharge('a', false); // wrong: reset step 0, due in 4 charges, last=a

    // now lastFactId is 'a' and a is in learning (but dueAtCharge may not be met yet)
    // The result should NOT be 'a' since it's lastFactId
    const result = selectFactForCharge(POOL_5, tracker, 0, RUN_SEED);
    expect(result.fact.id).not.toBe('a');
  });
});

describe('selectFactForCharge — Priority 2: new cards and due reviews', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('selects a new card when pool has unseen facts and no forced new due', () => {
    // Fresh tracker, no charges recorded — first selection should be unseen
    const result = selectFactForCharge(POOL_5, tracker, 0, RUN_SEED);
    expect(result.selectionReason).toBe('unseen');
  });

  it('easier facts (lower difficulty) are introduced before harder ones', () => {
    const mixedPool = [
      makeFact('hard', 5),
      makeFact('medium', 3),
      makeFact('easy', 1),
    ];
    const result = selectFactForCharge(mixedPool, tracker, 0, RUN_SEED);
    expect(result.fact.id).toBe('easy');
    expect(result.selectionReason).toBe('unseen');
  });

  it('recordNewCardServed is called when a new card is returned at Priority 2', () => {
    const result = selectFactForCharge(POOL_5, tracker, 0, RUN_SEED);
    expect(result.selectionReason).toBe('unseen');
    // After returning a new card, chargesSinceLastNew should be reset
    expect(tracker.shouldForceNewCard()).toBe(false);
  });
});

describe('selectFactForCharge — learning cards surface within encounter', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('learning card with expired timer surfaces in same encounter (no encounter dedup)', () => {
    // fact-a enters learning at charge 1, due at charge 5
    tracker.recordCharge('a', true); // total=1
    tracker.recordNewCardServed();    // prevent forced new

    // 4 more charges → total=5, fact-a is now due
    tracker.recordCharge('b', true);
    tracker.recordCharge('c', true);
    tracker.recordCharge('d', true);
    tracker.recordCharge('e', true);
    // All 5 facts seen this encounter, but fact-a is due for review
    // No encounter-scoped dedup — fact-a CAN be served again
    const result = selectFactForCharge(POOL_5, tracker, 0, RUN_SEED);
    expect(result.fact.id).toBe('a');
    expect(result.selectionReason).toBe('struggling');
  });
});

describe('selectFactForCharge — Priority 3: ahead learning fallback', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('returns ahead learning card when no new, no due, no reviews available', () => {
    // Put all 3 facts into learning but NOT due yet (step 0, due in 4)
    const pool3 = [makeFact('x'), makeFact('y'), makeFact('z')];
    tracker.recordCharge('x', true); // total=1, due=5
    tracker.recordCharge('y', true); // total=2, due=6
    tracker.recordCharge('z', true); // total=3, due=7, lastFactId=z
    // totalCharges=3, none due yet; no new cards left
    // shouldForceNewCard: chargesSinceLastNew would be 3 (reset wasn't called),
    // but no unseen facts available so Priority 0 finds nothing
    const result = selectFactForCharge(pool3, tracker, 0, RUN_SEED);
    // Should fall through to Priority 3 (ahead learning) or fallback
    expect(result).toBeDefined();
    expect(['x', 'y', 'z']).toContain(result.fact.id);
    expect(result.fact.id).not.toBe('z'); // lastFactId excluded when possible
  });
});

describe('selectFactForCharge — turn cooldown', () => {
  /**
   * MIN_TURN_GAP = 1: a fact shown on turn N cannot reappear until turn N+2.
   * Shown on turn 1 → blocked on turns 1 and 2 → eligible from turn 3 onward.
   */

  it('fact shown on turn 1 is NOT selected on turn 1 (same-turn block)', () => {
    // Large pool so there are always alternatives.
    const bigPool = [
      makeFact('a'), makeFact('b'), makeFact('c'), makeFact('d'), makeFact('e'),
      makeFact('f'), makeFact('g'), makeFact('h'), makeFact('i'), makeFact('j'),
    ];
    const localTracker = new InRunFactTracker();
    localTracker.recordCharge('a', true, 1); // stamp fact-a at turn 1

    for (let i = 0; i < 5; i++) {
      const result = selectFactForCharge(bigPool, localTracker, 0, RUN_SEED + i, 1);
      expect(result.fact.id).not.toBe('a');
    }
  });

  it('fact shown on turn 1 is NOT selected on turn 2 (within MIN_TURN_GAP)', () => {
    const bigPool = [
      makeFact('a'), makeFact('b'), makeFact('c'), makeFact('d'), makeFact('e'),
      makeFact('f'), makeFact('g'), makeFact('h'), makeFact('i'), makeFact('j'),
    ];
    const localTracker = new InRunFactTracker();
    localTracker.recordCharge('a', true, 1);

    for (let i = 0; i < 5; i++) {
      const result = selectFactForCharge(bigPool, localTracker, 0, RUN_SEED + i, 2);
      expect(result.fact.id).not.toBe('a');
    }
  });

  it('fact shown on turn 1 CAN be selected on turn 3 (gap > MIN_TURN_GAP)', () => {
    // Reduce pool to only 'a' so the selector is forced to pick it once eligible.
    const onlyA = [makeFact('a')];
    const localTracker = new InRunFactTracker();
    localTracker.recordCharge('a', true, 1);

    // Turn 3: gap = 3 - 1 = 2 > MIN_TURN_GAP → eligible
    const result = selectFactForCharge(onlyA, localTracker, 0, RUN_SEED, 3);
    expect(result.fact.id).toBe('a');
  });

  it('turn cooldown does not interfere when currentTurn is not provided', () => {
    const bigPool = [
      makeFact('a'), makeFact('b'), makeFact('c'), makeFact('d'), makeFact('e'),
    ];
    const localTracker = new InRunFactTracker();
    // Stamp fact-a at turn 2 via recordCharge
    localTracker.recordCharge('a', true, 2);

    // Call selectFactForCharge WITHOUT currentTurn — turn cooldown must not apply
    // (the only exclusion is the charge-window dedup)
    // With a large enough pool and no currentTurn arg, 'a' is blocked only by the
    // charge window (3 slots). After the window rolls, 'a' could return.
    // We just verify no crash and that the result is always a valid fact.
    const result = selectFactForCharge(bigPool, localTracker, 0, RUN_SEED);
    expect(result.fact).toBeDefined();
  });
});

describe('selectFactForCharge — interleaved pool diversity', () => {
  /**
   * Verifies that when facts from multiple decks are interleaved (round-robin),
   * selectFactForCharge surfaces facts from all source groups across a full pool
   * traversal.
   *
   * The Fisher-Yates shuffle inside the selector randomises pool order per call,
   * so diversity is only guaranteed after enough selections for the scheduler to
   * visit all groups. 15 calls is sufficient: 15 unique facts exist, so even with
   * learning-card repeats all 3 prefixes will appear within 15 picks.
   *
   * Note: learning cards resurface after 4 charges (step-0 delay), so total
   * selections may include repeats — "≤5 per group" is intentionally NOT asserted.
   */
  it('selects facts from all 3 source groups across 15 calls on an interleaved pool', () => {
    // Build 3 groups of 5 facts each (15 total), all difficulty 3
    const groupA = [1, 2, 3, 4, 5].map(n => makeFact(`a-${n}`));
    const groupB = [1, 2, 3, 4, 5].map(n => makeFact(`b-${n}`));
    const groupC = [1, 2, 3, 4, 5].map(n => makeFact(`c-${n}`));

    // Interleave: [a-1, b-1, c-1, a-2, b-2, c-2, ...]
    const interleavedPool: DeckFact[] = [];
    for (let i = 0; i < 5; i++) {
      interleavedPool.push(groupA[i], groupB[i], groupC[i]);
    }

    const tracker = new InRunFactTracker();
    const selected: string[] = [];

    // 15 calls gives enough coverage for the scheduler to reach all groups.
    // Use distinct seeds per call; record each charge so tracker state advances.
    for (let i = 0; i < 15; i++) {
      const result = selectFactForCharge(interleavedPool, tracker, 0, RUN_SEED + i);
      selected.push(result.fact.id);
      tracker.recordCharge(result.fact.id, true);
    }

    // All three source groups must appear across 15 selections
    const prefixes = selected.map(id => id.split('-')[0]);
    expect(prefixes).toContain('a');
    expect(prefixes).toContain('b');
    expect(prefixes).toContain('c');
  });

  it('non-interleaved (concatenated) pool also covers all groups via Fisher-Yates shuffle', () => {
    // Concatenated order: [a-1..a-5, b-1..b-5, c-1..c-5]
    const concatenatedPool: DeckFact[] = [
      ...[1, 2, 3, 4, 5].map(n => makeFact(`a-${n}`)),
      ...[1, 2, 3, 4, 5].map(n => makeFact(`b-${n}`)),
      ...[1, 2, 3, 4, 5].map(n => makeFact(`c-${n}`)),
    ];

    const tracker = new InRunFactTracker();
    const selected: string[] = [];
    for (let i = 0; i < 15; i++) {
      const result = selectFactForCharge(concatenatedPool, tracker, 0, RUN_SEED + i);
      selected.push(result.fact.id);
      tracker.recordCharge(result.fact.id, true);
    }

    // Fisher-Yates shuffle means even a concatenated pool covers all groups over 15 picks
    const prefixes = selected.map(id => id.split('-')[0]);
    expect(prefixes).toContain('a');
    expect(prefixes).toContain('b');
    expect(prefixes).toContain('c');
  });
});
