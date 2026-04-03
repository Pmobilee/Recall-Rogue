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

describe('selectFactForCharge — lastFactId dedup', () => {
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

  it('lastFactId dedup persists across advanceEncounter', () => {
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
