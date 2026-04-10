/**
 * Regression tests for runSaveService — CRITICAL-2 (2026-04-10).
 *
 * Root cause: `serializeRunState` used `...run` which spread Set/Map fields
 * as `{}` into the JSON (JSON.stringify silently drops Set/Map contents).
 * On `deserializeRunState`, those came back as plain objects, causing
 * `.has()` / `.get()` TypeErrors after resume.
 *
 * These tests exercise the full JSON round-trip through the save service and
 * verify that every Set/Map-typed field on RunState is a proper instance after
 * deserialization, so that `.has()` and `.get()` work without throwing.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunState } from './runManager';

// ---------------------------------------------------------------------------
// Mock heavy game-code dependencies so the test can run in a Node environment
// without needing the full Svelte + Phaser stack.
// ---------------------------------------------------------------------------

vi.mock('./storageBackend', () => {
  let store: Record<string, string> = {};
  return {
    getBackend: () => ({
      readSync: (key: string) => store[key] ?? null,
      write: (key: string, val: string) => { store[key] = val; },
      remove: (key: string) => { delete store[key]; },
      flush: async () => {},
      init: async () => {},
    }),
  };
});

vi.mock('./ascension', () => ({
  getAscensionModifiers: (_level: number) => ({
    playerMaxHpOverride: null,
    starterDeckSizeOverride: null,
    startingApOverride: null,
    extraDamageScaling: 1,
    extraEnemyDamage: 0,
    healingDisabled: false,
    curseChance: 0,
    shopPriceMult: 1,
    rewardMult: 1,
    eliteFrequency: 0,
  }),
}));

vi.mock('./seededRng', () => ({
  serializeRunRngState: () => ({ seed: 12345, forks: {} }),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are set up.
// ---------------------------------------------------------------------------

import { saveActiveRun, loadActiveRun } from './runSaveService';
import { InRunFactTracker } from './inRunFactTracker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal valid RunState with all Set/Map fields populated.
 * Only includes fields needed to exercise the serialize/deserialize path.
 */
function makeRunState(overrides?: Partial<RunState>): RunState {
  const base: RunState = {
    isActive: true,
    primaryDomain: 'history',
    secondaryDomain: 'science',
    selectedArchetype: 'balanced',
    starterDeckSize: 15,
    startingAp: 3,
    primaryDomainRunNumber: 1,
    earlyBoostActive: true,
    floor: {
      currentFloor: 2,
      maxFloor: 10,
      rooms: [],
      currentRoom: 0,
      bossDefeated: false,
    } as unknown as RunState['floor'],
    playerHp: 80,
    playerMaxHp: 100,
    currency: 50,
    cardsEarned: 3,
    factsAnswered: 10,
    factsCorrect: 8,
    correctAnswers: 8,
    bestCombo: 3,
    newFactsLearned: 2,
    factsMastered: 1,
    encountersWon: 2,
    encountersTotal: 3,
    elitesDefeated: 0,
    miniBossesDefeated: 0,
    bossesDefeated: 0,
    defeatedEnemyIds: ['slime_basic'],
    currentEncounterWrongAnswers: 1,
    bounties: [],
    canary: { answers: [], isValid: true } as unknown as RunState['canary'],
    startedAt: Date.now(),
    // The critical Set fields — populated with real values to prove round-trip
    firstChargeFreeFactIds: new Set(['fact-1']),
    attemptedFactIds: new Set(['fact-1', 'fact-2']),
    cursedFactIds: new Set(['fact-3']),
    consumedRewardFactIds: new Set(['fact-5']),
    factsAnsweredCorrectly: new Set(['fact-1']),
    factsAnsweredIncorrectly: new Set(['fact-2']),
    offeredRelicIds: new Set(['relic-a']),
    // The in-memory-only fields — populated with real values to prove they
    // are NOT persisted (not spread into JSON as `{}`)
    reviewStateSnapshot: new Map([
      ['fact-1', { cardState: 'review', stability: 5.0, tier: '2a' }],
    ]),
    firstTimeFactIds: new Set(['fact-new-1', 'fact-new-2']),
    tierAdvancedFactIds: new Set(['fact-1']),
    masteredThisRunFactIds: new Set(['fact-1']),
    // Other required fields
    runAccuracyBonusApplied: false,
    endlessEnemyDamageMultiplier: 1,
    ascensionLevel: 0,
    ascensionModifiers: {
      playerMaxHpOverride: null,
      starterDeckSizeOverride: null,
      startingApOverride: null,
      extraDamageScaling: 1,
      extraEnemyDamage: 0,
      healingDisabled: false,
      curseChance: 0,
      shopPriceMult: 1,
      rewardMult: 1,
      eliteFrequency: 0,
    } as unknown as RunState['ascensionModifiers'],
    retreatRewardLocked: false,
    runRelics: [],
    firstMiniBossRelicAwarded: false,
    relicPityCounter: 0,
    phoenixFeatherUsed: false,
    domainAccuracy: {},
    cardsUpgraded: 0,
    cardsRemovedAtShop: 0,
    haggleAttempts: 0,
    haggleSuccesses: 0,
    questionsAnswered: 10,
    questionsCorrect: 8,
    novelQuestionsAnswered: 5,
    novelQuestionsCorrect: 4,
    runSeed: 99999,
    globalTurnCounter: 5,
    soulJarCharges: 0,
    factVariantLevel: { 'fact-1': 2 },
    poolRewardScale: 1,
    includeOutsideDueReviews: false,
    totalDamageDealt: 120,
    perfectEncountersCount: 1,
  };
  return { ...base, ...overrides };
}

function makeMinimalSavePayload(runState: RunState) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    runState,
    currentScreen: 'dungeonMap',
    runMode: 'standard' as const,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runSaveService — CRITICAL-2 Set/Map rehydration after save/load', () => {
  it('all Set fields are proper Set instances after round-trip (not plain objects)', () => {
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();

    expect(loaded).not.toBeNull();
    const rs = loaded!.runState;

    // Every field must be a Set, not a plain object `{}`
    expect(rs.consumedRewardFactIds).toBeInstanceOf(Set);
    expect(rs.factsAnsweredCorrectly).toBeInstanceOf(Set);
    expect(rs.factsAnsweredIncorrectly).toBeInstanceOf(Set);
    expect(rs.firstChargeFreeFactIds).toBeInstanceOf(Set);
    expect(rs.offeredRelicIds).toBeInstanceOf(Set);
    expect(rs.cursedFactIds).toBeInstanceOf(Set);
    expect(rs.attemptedFactIds).toBeInstanceOf(Set);
    expect(rs.firstTimeFactIds).toBeInstanceOf(Set);
    expect(rs.tierAdvancedFactIds).toBeInstanceOf(Set);
    expect(rs.masteredThisRunFactIds).toBeInstanceOf(Set);
  });

  it('.has() works on all Set fields after round-trip (not "has is not a function")', () => {
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    // These should not throw — they would throw "has is not a function" if
    // the field came back as a plain `{}` from the buggy `...run` spread.
    expect(() => rs.consumedRewardFactIds.has('fact-5')).not.toThrow();
    expect(() => rs.factsAnsweredCorrectly.has('fact-1')).not.toThrow();
    expect(() => rs.factsAnsweredIncorrectly.has('fact-2')).not.toThrow();
    expect(() => rs.firstChargeFreeFactIds.has('fact-1')).not.toThrow();
    expect(() => rs.offeredRelicIds.has('relic-a')).not.toThrow();
    expect(() => rs.cursedFactIds.has('fact-3')).not.toThrow();
    expect(() => rs.attemptedFactIds.has('fact-1')).not.toThrow();
    expect(() => rs.firstTimeFactIds!.has('anything')).not.toThrow();
    expect(() => rs.tierAdvancedFactIds!.has('anything')).not.toThrow();
    expect(() => rs.masteredThisRunFactIds!.has('anything')).not.toThrow();
  });

  it('Set field values are correctly preserved after round-trip', () => {
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.consumedRewardFactIds.has('fact-5')).toBe(true);
    expect(rs.consumedRewardFactIds.has('fact-99')).toBe(false);

    expect(rs.factsAnsweredCorrectly.has('fact-1')).toBe(true);
    expect(rs.factsAnsweredIncorrectly.has('fact-2')).toBe(true);
    expect(rs.firstChargeFreeFactIds.has('fact-1')).toBe(true);
    expect(rs.offeredRelicIds.has('relic-a')).toBe(true);
    expect(rs.cursedFactIds.has('fact-3')).toBe(true);
    expect(rs.attemptedFactIds.has('fact-1')).toBe(true);
    expect(rs.attemptedFactIds.has('fact-2')).toBe(true);
  });

  it('reviewStateSnapshot is undefined after round-trip (in-memory only, not persisted)', () => {
    // reviewStateSnapshot is a Map that is built at startRun() from FSRS state.
    // It must NOT be persisted — if it were spread as `{}`, code calling
    // .has() on it after resume would get "has is not a function".
    // The correct behavior is to leave it undefined after resume so the
    // guards in recordCardPlay() catch it cleanly.
    const run = makeRunState();
    // reviewStateSnapshot is set in makeRunState (non-undefined Map)
    expect(run.reviewStateSnapshot).toBeInstanceOf(Map);

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.reviewStateSnapshot).toBeUndefined();
  });

  it('firstTimeFactIds is empty Set (not undefined, not plain object) after round-trip', () => {
    // firstTimeFactIds should reset to an empty Set on resume — the run is
    // continuing, and firstTimeFactIds accumulates from this point forward.
    const run = makeRunState();
    // set to non-empty
    run.firstTimeFactIds = new Set(['fact-new-1', 'fact-new-2']);

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.firstTimeFactIds).toBeInstanceOf(Set);
    // Reset to empty on resume (not persisted)
    expect(rs.firstTimeFactIds!.size).toBe(0);
  });

  it('tierAdvancedFactIds is empty Set after round-trip', () => {
    const run = makeRunState();
    run.tierAdvancedFactIds = new Set(['fact-1']);

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.tierAdvancedFactIds).toBeInstanceOf(Set);
    expect(rs.tierAdvancedFactIds!.size).toBe(0);
  });

  it('masteredThisRunFactIds is empty Set after round-trip', () => {
    const run = makeRunState();
    run.masteredThisRunFactIds = new Set(['fact-1']);

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.masteredThisRunFactIds).toBeInstanceOf(Set);
    expect(rs.masteredThisRunFactIds!.size).toBe(0);
  });

  it('inRunFactTracker round-trips correctly (class instance with Map fields)', () => {
    const tracker = new InRunFactTracker();
    tracker.recordCharge('fact-a', true);
    tracker.recordCharge('fact-b', false);
    tracker.recordResult('fact-a', true, 1200, 1, undefined);

    const run = makeRunState({ inRunFactTracker: tracker });
    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.inRunFactTracker).toBeInstanceOf(InRunFactTracker);
    const restoredTracker = rs.inRunFactTracker!;

    // Should be fully functional — not a plain object
    expect(() => restoredTracker.isInLearning('fact-a')).not.toThrow();
    expect(() => restoredTracker.isGraduated('fact-a')).not.toThrow();
    expect(() => restoredTracker.getTotalCharges()).not.toThrow();

    expect(restoredTracker.isInLearning('fact-a')).toBe(true);
    expect(restoredTracker.isInLearning('fact-b')).toBe(true);
    expect(restoredTracker.getTotalCharges()).toBe(2);
  });

  it('reviewStateSnapshot is undefined (not {}) after round-trip so guard works', () => {
    // CRITICAL-2 regression: the buggy code spread `...run` which emitted
    // reviewStateSnapshot as `{}` in JSON (JSON.stringify drops Map contents).
    // After deserialization, `{}.has` is undefined and calling it would throw
    // 'has is not a function'. The fix: exclude reviewStateSnapshot from the
    // spread and always restore it as undefined on resume.
    const run = makeRunState();
    expect(run.reviewStateSnapshot).toBeInstanceOf(Map); // non-undefined before save

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    // After resume: must be undefined (never a plain {})
    // If it were {}, the line below would throw 'has is not a function'
    expect(rs.reviewStateSnapshot).toBeUndefined();

    // Safe because undefined — same guard that recordCardPlay uses:
    const result = rs.reviewStateSnapshot !== undefined
      ? rs.reviewStateSnapshot.has('any-fact')
      : false;
    expect(result).toBe(false);
  });
});

describe('runSaveService — round-trip preserves scalar fields', () => {
  it('globalTurnCounter, soulJarCharges, factVariantLevel are preserved', () => {
    const run = makeRunState();
    run.globalTurnCounter = 17;
    run.soulJarCharges = 3;
    run.factVariantLevel = { 'fact-1': 2, 'fact-2': 5 };

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.globalTurnCounter).toBe(17);
    expect(rs.soulJarCharges).toBe(3);
    expect(rs.factVariantLevel['fact-1']).toBe(2);
    expect(rs.factVariantLevel['fact-2']).toBe(5);
  });

  it('retreatRewardLocked is preserved', () => {
    const run = makeRunState();
    run.retreatRewardLocked = true;

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();

    expect(loaded!.runState.retreatRewardLocked).toBe(true);
  });
});
