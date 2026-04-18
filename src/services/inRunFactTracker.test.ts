import { describe, it, expect, beforeEach } from 'vitest';
import { InRunFactTracker, type InRunFactTrackerSnapshot } from './inRunFactTracker';

describe('InRunFactTracker — learning step delays', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('new card correct → enters learning step 0, due in 4 charges', () => {
    tracker.recordCharge('fact-a', true);
    // totalCharges = 1, dueAtCharge should be 1 + 4 = 5
    // fact-a is in learning, not due yet (5 > 1)
    expect(tracker.isInLearning('fact-a')).toBe(true);
    const due = tracker.getDueLearningCards();
    expect(due).not.toContain('fact-a');
  });

  it('learning step 0 card becomes due after 4 more charges', () => {
    tracker.recordCharge('fact-a', true); // totalCharges=1, dueAtCharge=5
    // 4 more charges on other facts to advance totalCharges to 5
    tracker.recordCharge('fact-b', true); // 2
    tracker.recordCharge('fact-c', true); // 3
    tracker.recordCharge('fact-d', true); // 4
    // totalCharges=4, dueAtCharge=5 → still not due
    expect(tracker.getDueLearningCards()).not.toContain('fact-a');
    tracker.recordCharge('fact-e', true); // 5
    // totalCharges=5 >= dueAtCharge=5 → now due
    expect(tracker.getDueLearningCards()).toContain('fact-a');
  });

  it('learning step 1 card becomes due after 10 more charges (step 0→1 advance)', () => {
    // Advance fact-a to learning step 1
    tracker.recordCharge('fact-a', true); // step 0, dueAtCharge=5, totalCharges=1
    // Make fact-a due
    for (let i = 0; i < 4; i++) tracker.recordCharge('fact-b', true); // totalCharges=5
    // Advance fact-a from step 0 to step 1
    tracker.recordCharge('fact-a', true); // totalCharges=6, step 1, dueAtCharge=6+10=16
    expect(tracker.isInLearning('fact-a')).toBe(true);
    expect(tracker.getDueLearningCards()).not.toContain('fact-a');
    // Advance 10 more charges (totalCharges needs to reach 16)
    for (let i = 0; i < 10; i++) tracker.recordCharge('fact-c', true);
    // totalCharges=16 >= dueAtCharge=16 → due
    expect(tracker.getDueLearningCards()).toContain('fact-a');
  });

  it('graduated card has review cooldown of 15 charges', () => {
    // Graduate fact-a: step 0 correct, step 1 correct
    tracker.recordCharge('fact-a', true); // step 0, dueAtCharge=5, total=1
    for (let i = 0; i < 4; i++) tracker.recordCharge('fact-b', true); // total=5
    tracker.recordCharge('fact-a', true); // step 1, dueAtCharge=16, total=6
    for (let i = 0; i < 10; i++) tracker.recordCharge('fact-c', true); // total=16
    tracker.recordCharge('fact-a', true); // graduates, dueAtCharge=17+15=32, total=17
    expect(tracker.isGraduated('fact-a')).toBe(true);
    expect(tracker.isGraduatedAndDue('fact-a')).toBe(false);
    // 15 more charges
    for (let i = 0; i < 15; i++) tracker.recordCharge('fact-d', true); // total=32
    expect(tracker.isGraduatedAndDue('fact-a')).toBe(true);
  });

  it('wrong answer resets to step 0 with due in 4 charges', () => {
    // First get fact-a to step 1
    tracker.recordCharge('fact-a', true); // step 0, due=5, total=1
    for (let i = 0; i < 4; i++) tracker.recordCharge('fact-b', true); // total=5
    tracker.recordCharge('fact-a', true); // step 1, due=16, total=6

    // Now wrong answer — resets to step 0
    tracker.recordCharge('fact-a', false); // due = 7+4=11? total=7
    // due in 4 charges from now: 7+4=11
    expect(tracker.isInLearning('fact-a')).toBe(true);
    for (let i = 0; i < 3; i++) tracker.recordCharge('fact-c', true); // total=10
    expect(tracker.getDueLearningCards()).not.toContain('fact-a');
    tracker.recordCharge('fact-c', true); // total=11
    expect(tracker.getDueLearningCards()).toContain('fact-a');
  });
});

describe('InRunFactTracker — new card guarantee', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('chargesSinceLastNew starts at 0 (shouldForceNewCard false)', () => {
    expect(tracker.shouldForceNewCard()).toBe(false);
  });

  it('shouldForceNewCard becomes true after 3 charges', () => {
    tracker.recordCharge('fact-a', true);
    expect(tracker.shouldForceNewCard()).toBe(false);
    tracker.recordCharge('fact-b', true);
    expect(tracker.shouldForceNewCard()).toBe(false);
    tracker.recordCharge('fact-c', true);
    expect(tracker.shouldForceNewCard()).toBe(true);
  });

  it('recordNewCardServed resets counter — shouldForceNewCard back to false', () => {
    tracker.recordCharge('fact-a', true);
    tracker.recordCharge('fact-b', true);
    tracker.recordCharge('fact-c', true);
    expect(tracker.shouldForceNewCard()).toBe(true);

    tracker.recordNewCardServed();
    expect(tracker.shouldForceNewCard()).toBe(false);
  });

  it('counter increments again after reset — fires again at 3 more charges', () => {
    // First cycle
    tracker.recordCharge('fact-a', true);
    tracker.recordCharge('fact-b', true);
    tracker.recordCharge('fact-c', true);
    tracker.recordNewCardServed();

    // Second cycle
    tracker.recordCharge('fact-d', true);
    expect(tracker.shouldForceNewCard()).toBe(false);
    tracker.recordCharge('fact-e', true);
    expect(tracker.shouldForceNewCard()).toBe(false);
    tracker.recordCharge('fact-f', true);
    expect(tracker.shouldForceNewCard()).toBe(true);
  });
});

describe('InRunFactTracker — recent fact window dedup', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('getLastFactId returns null initially', () => {
    expect(tracker.getLastFactId()).toBeNull();
  });

  it('getLastFactId returns the most recently recorded charge', () => {
    tracker.recordCharge('fact-a', true);
    expect(tracker.getLastFactId()).toBe('fact-a');
    tracker.recordCharge('fact-b', false);
    expect(tracker.getLastFactId()).toBe('fact-b');
  });

  it('getRecentFactIds starts empty', () => {
    expect(tracker.getRecentFactIds()).toEqual([]);
  });

  it('getRecentFactIds grows up to RECENT_FACT_WINDOW (3) and then rolls', () => {
    tracker.recordCharge('a', true);
    expect(tracker.getRecentFactIds()).toEqual(['a']);

    tracker.recordCharge('b', true);
    expect(tracker.getRecentFactIds()).toEqual(['a', 'b']);

    tracker.recordCharge('c', true);
    expect(tracker.getRecentFactIds()).toEqual(['a', 'b', 'c']);

    // Window is full — oldest entry ('a') should drop when 'd' is recorded
    tracker.recordCharge('d', true);
    expect(tracker.getRecentFactIds()).toEqual(['b', 'c', 'd']);
  });

  it('getLastFactId is always the last element of getRecentFactIds', () => {
    tracker.recordCharge('x', true);
    tracker.recordCharge('y', true);
    const recent = tracker.getRecentFactIds();
    expect(tracker.getLastFactId()).toBe(recent[recent.length - 1]);
  });

  it('advanceEncounter increments currentEncounter', () => {
    expect(tracker.getCurrentEncounter()).toBe(1);
    tracker.advanceEncounter();
    expect(tracker.getCurrentEncounter()).toBe(2);
  });

  it('recentFactIds persists across advanceEncounter', () => {
    tracker.recordCharge('fact-a', true);
    tracker.advanceEncounter();
    expect(tracker.getLastFactId()).toBe('fact-a');
    expect(tracker.getRecentFactIds()).toContain('fact-a');
  });

  it('learning card CAN become due within same encounter (no encounter-scoped dedup)', () => {
    // fact-a enters learning, due in 4 charges
    tracker.recordCharge('fact-a', true); // total=1, due=5

    // Advance 4 more charges on other facts
    tracker.recordCharge('fact-b', true); // total=2
    tracker.recordCharge('fact-c', true); // total=3
    tracker.recordCharge('fact-d', true); // total=4
    tracker.recordCharge('fact-e', true); // total=5 → fact-a is due

    // fact-a is due and NOT excluded by any encounter-scoped filter
    expect(tracker.getDueLearningCards()).toContain('fact-a');
  });
});

describe('InRunFactTracker — state machine transitions', () => {
  let tracker: InRunFactTracker;

  beforeEach(() => {
    tracker = new InRunFactTracker();
  });

  it('new → learning → graduated full path', () => {
    // New
    expect(tracker.isInLearning('a')).toBe(false);
    expect(tracker.isGraduated('a')).toBe(false);

    // Step 0
    tracker.recordCharge('a', true); // total=1, due=5
    expect(tracker.isInLearning('a')).toBe(true);
    expect(tracker.isGraduated('a')).toBe(false);

    // Make due
    for (let i = 0; i < 4; i++) tracker.recordCharge('x', true);
    tracker.recordCharge('a', true); // step 1, total=6, due=16
    expect(tracker.isInLearning('a')).toBe(true);

    // Make due again
    for (let i = 0; i < 10; i++) tracker.recordCharge('x', true);
    tracker.recordCharge('a', true); // graduates, total=17
    expect(tracker.isInLearning('a')).toBe(false);
    expect(tracker.isGraduated('a')).toBe(true);
  });

  it('canIntroduceNew returns false when 8 cards are in learning', () => {
    for (let i = 0; i < 8; i++) {
      tracker.recordCharge(`fact-${i}`, true);
    }
    expect(tracker.canIntroduceNew()).toBe(false);
  });

  it('canIntroduceNew returns true when learning queue is below 8', () => {
    for (let i = 0; i < 7; i++) {
      tracker.recordCharge(`fact-${i}`, true);
    }
    expect(tracker.canIntroduceNew()).toBe(true);
  });
});

describe('InRunFactTracker — JSON round-trip', () => {
  it('preserves all internal state across JSON.stringify/parse', () => {
    const tracker = new InRunFactTracker();
    tracker.recordCharge('fact-a', true);   // fact-a → learning step 0
    tracker.recordCharge('fact-b', true);   // fact-b → learning step 0
    tracker.recordCharge('fact-a', false);  // fact-a → learning step 0 (reset)
    tracker.recordResult('fact-a', false, 1500, 1, 'fact-b');
    tracker.recordTemplateUsed('forward');
    tracker.recordTemplateUsed('reverse');
    tracker.advanceEncounter();
    tracker.recordNewCardServed();

    // Round-trip through JSON — toJSON is auto-invoked by JSON.stringify.
    const json = JSON.stringify(tracker);
    const parsed = JSON.parse(json) as InRunFactTrackerSnapshot;
    const restored = InRunFactTracker.fromJSON(parsed);

    expect(restored.getTotalCharges()).toBe(tracker.getTotalCharges());
    // recentFactIds window: charges were fact-a, fact-b, fact-a → window = ['fact-a', 'fact-b', 'fact-a']
    // lastFactId should be the last element of that window
    expect(restored.getLastFactId()).toBe('fact-a');
    expect(restored.getRecentFactIds()).toEqual(['fact-a', 'fact-b', 'fact-a']);
    expect(restored.isInLearning('fact-a')).toBe(true);
    expect(restored.isInLearning('fact-b')).toBe(true);
    expect(restored.getRecentTemplateIds()).toEqual(['forward', 'reverse']);
    expect(restored.getCurrentEncounter()).toBe(2);

    const factAState = restored.getState('fact-a');
    expect(factAState).toBeDefined();
    expect(factAState!.wrongCount).toBe(1);
    expect(factAState!.confusedWith).toContain('fact-b');
  });

  it('continues to function correctly after restore', () => {
    const tracker = new InRunFactTracker();
    tracker.recordCharge('fact-a', true);
    tracker.recordCharge('fact-b', true);

    const restored = InRunFactTracker.fromJSON(JSON.parse(JSON.stringify(tracker)));

    // Should still respond to mutating calls and update its state.
    restored.recordCharge('fact-c', true);
    expect(restored.isInLearning('fact-c')).toBe(true);
    expect(restored.getTotalCharges()).toBe(3);
  });

  it('fromJSON(undefined) returns a fresh empty tracker', () => {
    const tracker = InRunFactTracker.fromJSON(undefined);
    expect(tracker.getTotalCharges()).toBe(0);
    expect(tracker.getLastFactId()).toBeNull();
    expect(tracker.getRecentFactIds()).toEqual([]);
    expect(tracker.getCurrentEncounter()).toBe(1);
    expect(tracker.getRecentTemplateIds()).toEqual([]);
    expect(tracker.canIntroduceNew()).toBe(true);
  });

  it('fromJSON tolerates malformed snapshots without throwing', () => {
    // Cast through unknown to bypass the typed signature for the bad-input case.
    const tracker = InRunFactTracker.fromJSON({} as unknown as InRunFactTrackerSnapshot);
    expect(tracker.getTotalCharges()).toBe(0);
    expect(tracker.getLastFactId()).toBeNull();
    expect(tracker.getRecentFactIds()).toEqual([]);
    expect(tracker.getCurrentEncounter()).toBe(1);
  });

  it('migrates old save with lastFactId (no recentFactIds) to a single-entry window', () => {
    // Simulate a snapshot from before the window was introduced.
    const oldSnapshot: InRunFactTrackerSnapshot = {
      states: [],
      learningCards: [],
      graduatedCards: [],
      lastFactId: 'fact-z',
      // recentFactIds intentionally absent
      totalCharges: 5,
      currentEncounter: 1,
      recentTemplateIds: [],
      chargeCount: 5,
      chargesSinceLastNew: 2,
    };
    const tracker = InRunFactTracker.fromJSON(oldSnapshot);
    expect(tracker.getLastFactId()).toBe('fact-z');
    expect(tracker.getRecentFactIds()).toEqual(['fact-z']);
    expect(tracker.getTotalCharges()).toBe(5);
  });
});
