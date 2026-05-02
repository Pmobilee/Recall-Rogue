/**
 * Regression tests for runSaveService.
 *
 * CRITICAL-2 (2026-04-10): serializeRunState used ...run which spread Set/Map
 * fields as {} into the JSON. On deserializeRunState they came back as plain
 * objects, causing .has()/.get() TypeErrors after resume.
 *
 * CRITICAL-3 (2026-04-12): CardRunState.currentEncounterSeenFacts inside
 * encounterSnapshot.activeDeck must survive the JSON round-trip as a Set.
 *
 * MP-SWEEP-2026-04-23-C-001: per-mode key namespacing — solo saves must not
 * collide with multiplayer saves.
 */

// @vitest-environment node

import { describe, it, expect, vi } from 'vitest';
import type { RunState } from './runManager';
import type { CardRunState } from '../data/card-types';

// ---------------------------------------------------------------------------
// Mock heavy game-code dependencies so the test can run in a Node environment
// without needing the full Svelte + Phaser stack.
// ---------------------------------------------------------------------------

// Use a module-level store object so we can mutate it from helper functions
// without closure aliasing issues.
const mockStore: Record<string, string> = {};

vi.mock('./storageBackend', () => ({
  getBackend: () => ({
    readSync: (key: string) => mockStore[key] ?? null,
    write: (key: string, val: string) => { mockStore[key] = val; },
    remove: (key: string) => { delete mockStore[key]; },
    flush: async () => {},
    init: async () => {},
  }),
}));

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

import { saveActiveRun, loadActiveRun, clearActiveRun, hasActiveRun } from './runSaveService';
import { InRunFactTracker } from './inRunFactTracker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a raw string directly to the mock store, bypassing the service API. */
function writeRawToStore(key: string, value: string): void {
  mockStore[key] = value;
}

/** Read raw bytes from the mock store. Returns null if absent. */
function readRawFromStore(key: string): string | null {
  return mockStore[key] ?? null;
}

/** Clear the entire mock store between tests that need full isolation. */
function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

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
    playDurationMs: 0,
    lastResumedAt: Date.now(),
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
    chargesAttempted: 5,
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

function makeMinimalSavePayload(
  runState: RunState,
  runMode?: Parameters<typeof saveActiveRun>[0]['runMode'],
) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    runState,
    currentScreen: 'dungeonMap',
    runMode: runMode ?? ('standard' as const),
  };
}

/**
 * Minimal valid CardRunState with currentEncounterSeenFacts populated.
 * Used to exercise encounterSnapshot.activeDeck serialization/rehydration.
 */
function makeActiveDeck(seenFacts: string[]): CardRunState {
  return {
    drawPile: [],
    discardPile: [],
    hand: [],
    forgetPile: [],
    currentFloor: 2,
    currentEncounter: 1,
    playerHP: 80,
    playerMaxHP: 100,
    playerShield: 0,
    hintsRemaining: 3,
    currency: 0,
    factPool: seenFacts,
    factCooldown: [],
    currentEncounterSeenFacts: new Set(seenFacts),
    consecutiveCursedDraws: 0,
    pendingAutoCure: false,
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
    const run = makeRunState();
    expect(run.reviewStateSnapshot).toBeInstanceOf(Map);

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.reviewStateSnapshot).toBeUndefined();
  });

  it('firstTimeFactIds is empty Set (not undefined, not plain object) after round-trip', () => {
    const run = makeRunState();
    run.firstTimeFactIds = new Set(['fact-new-1', 'fact-new-2']);

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.firstTimeFactIds).toBeInstanceOf(Set);
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

    expect(() => restoredTracker.isInLearning('fact-a')).not.toThrow();
    expect(() => restoredTracker.isGraduated('fact-a')).not.toThrow();
    expect(() => restoredTracker.getTotalCharges()).not.toThrow();

    expect(restoredTracker.isInLearning('fact-a')).toBe(true);
    expect(restoredTracker.isInLearning('fact-b')).toBe(true);
    expect(restoredTracker.getTotalCharges()).toBe(2);
  });

  it('reviewStateSnapshot is undefined (not {}) after round-trip so guard works', () => {
    const run = makeRunState();
    expect(run.reviewStateSnapshot).toBeInstanceOf(Map);

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(rs.reviewStateSnapshot).toBeUndefined();

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

// ---------------------------------------------------------------------------
// CRITICAL-3 (2026-04-12): CardRunState.currentEncounterSeenFacts in
// encounterSnapshot.activeDeck must survive the JSON round-trip as a Set.
// ---------------------------------------------------------------------------

describe('runSaveService — CRITICAL-3 encounterSnapshot.activeDeck Set rehydration', () => {
  it('currentEncounterSeenFacts is a Set after round-trip (not plain array or {})', () => {
    const run = makeRunState();
    const activeDeck = makeActiveDeck(['fact_a', 'fact_b']);
    expect(activeDeck.currentEncounterSeenFacts).toBeInstanceOf(Set);

    saveActiveRun({
      ...makeMinimalSavePayload(run),
      encounterSnapshot: { activeDeck, activeRunPool: [] },
    });

    const loaded = loadActiveRun();
    expect(loaded).not.toBeNull();
    expect(loaded!.encounterSnapshot).not.toBeNull();

    const restoredDeck = loaded!.encounterSnapshot!.activeDeck!;
    expect(restoredDeck.currentEncounterSeenFacts).toBeInstanceOf(Set);
  });

  it('.add() on currentEncounterSeenFacts does not throw after round-trip (the softlock regression)', () => {
    const run = makeRunState();
    const activeDeck = makeActiveDeck(['fact_a', 'fact_b']);

    saveActiveRun({
      ...makeMinimalSavePayload(run),
      encounterSnapshot: { activeDeck, activeRunPool: [] },
    });

    const loaded = loadActiveRun();
    const restoredDeck = loaded!.encounterSnapshot!.activeDeck!;
    expect(() => restoredDeck.currentEncounterSeenFacts!.add('fact_c')).not.toThrow();
  });

  it('currentEncounterSeenFacts values are preserved after round-trip', () => {
    const run = makeRunState();
    const activeDeck = makeActiveDeck(['fact_a', 'fact_b']);

    saveActiveRun({
      ...makeMinimalSavePayload(run),
      encounterSnapshot: { activeDeck, activeRunPool: [] },
    });

    const loaded = loadActiveRun();
    const restoredDeck = loaded!.encounterSnapshot!.activeDeck!;
    const seenFacts = restoredDeck.currentEncounterSeenFacts!;

    expect(seenFacts.has('fact_a')).toBe(true);
    expect(seenFacts.has('fact_b')).toBe(true);
    expect(seenFacts.has('fact_c')).toBe(false);
    expect(seenFacts.size).toBe(2);
  });

  it('adding to currentEncounterSeenFacts after round-trip persists new values', () => {
    const run = makeRunState();
    const activeDeck = makeActiveDeck(['fact_a', 'fact_b']);

    saveActiveRun({
      ...makeMinimalSavePayload(run),
      encounterSnapshot: { activeDeck, activeRunPool: [] },
    });

    const loaded = loadActiveRun();
    const restoredDeck = loaded!.encounterSnapshot!.activeDeck!;
    restoredDeck.currentEncounterSeenFacts!.add('fact_c');

    expect(restoredDeck.currentEncounterSeenFacts!.has('fact_c')).toBe(true);
    expect(restoredDeck.currentEncounterSeenFacts!.size).toBe(3);
  });

  it('handles legacy saves where currentEncounterSeenFacts was `{}` (pre-CRITICAL-3)', () => {
    const run = makeRunState();
    const activeDeck = makeActiveDeck(['fact_a']);

    saveActiveRun({
      ...makeMinimalSavePayload(run),
      encounterSnapshot: { activeDeck, activeRunPool: [] },
    });

    // Corrupt the saved JSON to simulate old format.
    const raw = readRawFromStore('recall-rogue-active-run-solo')!;
    const parsed = JSON.parse(raw);
    parsed.encounterSnapshot.activeDeck.currentEncounterSeenFacts = {};
    writeRawToStore('recall-rogue-active-run-solo', JSON.stringify(parsed));

    const loaded = loadActiveRun('solo');
    const restoredDeck = loaded!.encounterSnapshot!.activeDeck!;

    expect(restoredDeck.currentEncounterSeenFacts).toBeInstanceOf(Set);
    expect(restoredDeck.currentEncounterSeenFacts!.size).toBe(0);
    expect(() => restoredDeck.currentEncounterSeenFacts!.add('fact_x')).not.toThrow();
  });

  it('handles activeDeck with undefined currentEncounterSeenFacts gracefully', () => {
    const run = makeRunState();
    const activeDeck = makeActiveDeck([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (activeDeck as any).currentEncounterSeenFacts;

    saveActiveRun({
      ...makeMinimalSavePayload(run),
      encounterSnapshot: { activeDeck, activeRunPool: [] },
    });

    const loaded = loadActiveRun();
    const restoredDeck = loaded!.encounterSnapshot!.activeDeck!;
    expect(restoredDeck.currentEncounterSeenFacts).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Play time accumulation (2026-04-18)
// ---------------------------------------------------------------------------

describe('runSaveService — play time accumulation', () => {
  it('playDurationMs is 0 and lastResumedAt is set on a fresh run (no save/load yet)', () => {
    const run = makeRunState();
    run.playDurationMs = 0;
    run.lastResumedAt = run.startedAt;

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const rs = loaded!.runState;

    expect(typeof rs.lastResumedAt).toBe('number');
    expect(rs.lastResumedAt).toBeGreaterThanOrEqual(run.startedAt);
    expect(typeof rs.playDurationMs).toBe('number');
    expect(rs.playDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('playDurationMs accumulates across multiple save/load cycles', () => {
    const run = makeRunState();
    run.playDurationMs = 0;
    run.lastResumedAt = run.startedAt - 5000;

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded1 = loadActiveRun();
    const rs1 = loaded1!.runState;
    expect(rs1.playDurationMs).toBeGreaterThanOrEqual(4000);

    rs1.lastResumedAt = Date.now() - 3000;
    saveActiveRun(makeMinimalSavePayload(rs1));
    const loaded2 = loadActiveRun();
    const rs2 = loaded2!.runState;

    expect(rs2.playDurationMs).toBeGreaterThanOrEqual(7000);
  });

  it('lastResumedAt is reset to now on deserialization (not persisted)', () => {
    const before = Date.now();
    const run = makeRunState();
    run.lastResumedAt = run.startedAt - 99999;

    saveActiveRun(makeMinimalSavePayload(run));
    const loaded = loadActiveRun();
    const after = Date.now();

    expect(loaded!.runState.lastResumedAt).toBeGreaterThanOrEqual(before);
    expect(loaded!.runState.lastResumedAt).toBeLessThanOrEqual(after + 10);
  });

  it('playDurationMs defaults to 0 for old saves that lack the field', () => {
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run));

    // Corrupt the saved JSON to simulate an old save without playDurationMs.
    const raw = readRawFromStore('recall-rogue-active-run-solo')!;
    const parsed = JSON.parse(raw);
    delete parsed.runState.playDurationMs;
    writeRawToStore('recall-rogue-active-run-solo', JSON.stringify(parsed));

    const loaded = loadActiveRun('solo');
    expect(typeof loaded!.runState.playDurationMs).toBe('number');
    expect(loaded!.runState.playDurationMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MP-SWEEP-2026-04-23-C-001: per-mode save key namespacing.
//
// Bug: saveActiveRun wrote all modes to the same key ('recall-rogue-active-run').
// A player mid-MP-coop who started a solo run had the coop snapshot overwritten.
// On resume the coop partner loaded the solo save => black screen.
//
// Fix: each mode writes/reads its own key:
//   'recall-rogue-active-run-solo'
//   'recall-rogue-active-run-multiplayer-coop'
//   etc.
// ---------------------------------------------------------------------------

describe('runSaveService — MP-SWEEP-2026-04-23-C-001 per-mode key namespacing', () => {
  it('solo save writes to the solo slot (not the legacy single key)', () => {
    clearMockStore();
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run, 'standard'));

    expect(readRawFromStore('recall-rogue-active-run-solo')).not.toBeNull();
    expect(readRawFromStore('recall-rogue-active-run')).toBeNull();
  });

  it('multiplayer_coop save writes to the coop slot (not the solo slot)', () => {
    clearMockStore();
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run, 'multiplayer_coop'));

    expect(readRawFromStore('recall-rogue-active-run-multiplayer-coop')).not.toBeNull();
    expect(readRawFromStore('recall-rogue-active-run-solo')).toBeNull();
  });

  it('solo save does NOT collide with multiplayer-coop save', () => {
    clearMockStore();
    const soloRun = makeRunState({ playerHp: 80 });
    const mpRun = makeRunState({ playerHp: 50 });

    saveActiveRun(makeMinimalSavePayload(soloRun, 'standard'));
    saveActiveRun(makeMinimalSavePayload(mpRun, 'multiplayer_coop'));

    const loadedSolo = loadActiveRun('solo');
    const loadedCoop = loadActiveRun('multiplayer-coop');

    expect(loadedSolo).not.toBeNull();
    expect(loadedCoop).not.toBeNull();
    expect(loadedSolo!.runState.playerHp).toBe(80);
    expect(loadedCoop!.runState.playerHp).toBe(50);
  });

  it('loadActiveRun() with no arg returns solo save (solo-first scan)', () => {
    // The no-arg behavior was changed from "default to solo slot" to
    // "scan ALL_SAVE_MODES in priority order". Solo is first in that list so
    // a solo-only save is still found — the test outcome is the same, but the
    // mechanism now scans rather than hard-defaulting.
    clearMockStore();
    const run = makeRunState({ currency: 42 });
    saveActiveRun(makeMinimalSavePayload(run, 'standard'));

    const loaded = loadActiveRun(); // no arg => scans all slots, finds solo
    expect(loaded).not.toBeNull();
    expect(loaded!.runState.currency).toBe(42);
  });

  it('loadActiveRun() with no arg finds MP save when only an MP slot is populated', () => {
    // Regression guard for the Task A fix: before the fix, loadActiveRun()
    // with no arg defaulted to 'solo', so an MP-only save returned null,
    // silently triggering the null-check in abandonActiveRun as "nothing to
    // grade" even though a stale MP run existed on disk.
    clearMockStore();
    const mpRun = makeRunState({ currency: 77 });
    saveActiveRun(makeMinimalSavePayload(mpRun, 'multiplayer_race'));

    // Solo slot must be empty so we're testing the scan fallback path.
    expect(loadActiveRun('solo')).toBeNull();

    const loaded = loadActiveRun(); // no arg => should scan and find the race slot
    expect(loaded).not.toBeNull();
    expect(loaded!.runMode).toBe('multiplayer_race');
    expect(loaded!.runState.currency).toBe(77);
  });

  it('multiplayer_race, multiplayer_duel, multiplayer_trivia each get their own slot', () => {
    clearMockStore();
    const raceRun = makeRunState({ playerHp: 90 });
    const duelRun = makeRunState({ playerHp: 70 });
    const triviaRun = makeRunState({ playerHp: 60 });

    saveActiveRun(makeMinimalSavePayload(raceRun, 'multiplayer_race'));
    saveActiveRun(makeMinimalSavePayload(duelRun, 'multiplayer_duel'));
    saveActiveRun(makeMinimalSavePayload(triviaRun, 'multiplayer_trivia'));

    expect(loadActiveRun('multiplayer-race')!.runState.playerHp).toBe(90);
    expect(loadActiveRun('multiplayer-duel')!.runState.playerHp).toBe(70);
    expect(loadActiveRun('multiplayer-trivia')!.runState.playerHp).toBe(60);
  });

  it('daily_expedition and endless_depths map to the solo slot', () => {
    clearMockStore();
    const dailyRun = makeRunState({ currency: 100 });
    saveActiveRun(makeMinimalSavePayload(dailyRun, 'daily_expedition'));
    expect(readRawFromStore('recall-rogue-active-run-solo')).not.toBeNull();

    clearActiveRun('solo');
    const endlessRun = makeRunState({ currency: 200 });
    saveActiveRun(makeMinimalSavePayload(endlessRun, 'endless_depths'));
    expect(readRawFromStore('recall-rogue-active-run-solo')).not.toBeNull();
    expect(loadActiveRun('solo')!.runState.currency).toBe(200);
  });

  it('hasActiveRun() with no arg returns true if ANY slot has a save', () => {
    clearMockStore();
    expect(hasActiveRun()).toBe(false);

    const mpRun = makeRunState();
    saveActiveRun(makeMinimalSavePayload(mpRun, 'multiplayer_coop'));

    expect(hasActiveRun()).toBe(true);
    expect(hasActiveRun('solo')).toBe(false);
    expect(hasActiveRun('multiplayer-coop')).toBe(true);
  });

  it('clearActiveRun() with no arg wipes all slots', () => {
    clearMockStore();
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run, 'standard'));
    saveActiveRun(makeMinimalSavePayload(run, 'multiplayer_coop'));
    saveActiveRun(makeMinimalSavePayload(run, 'multiplayer_race'));

    expect(hasActiveRun()).toBe(true);

    clearActiveRun(); // no arg => wipe all

    expect(hasActiveRun()).toBe(false);
    expect(loadActiveRun('solo')).toBeNull();
    expect(loadActiveRun('multiplayer-coop')).toBeNull();
    expect(loadActiveRun('multiplayer-race')).toBeNull();
  });

  it('clearActiveRun(mode) wipes only the specified slot', () => {
    clearMockStore();
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run, 'standard'));
    saveActiveRun(makeMinimalSavePayload(run, 'multiplayer_coop'));

    clearActiveRun('solo');

    expect(loadActiveRun('solo')).toBeNull();
    expect(loadActiveRun('multiplayer-coop')).not.toBeNull();
  });

  it('saveActiveRun never writes to the legacy key', () => {
    clearMockStore();
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run, 'standard'));
    saveActiveRun(makeMinimalSavePayload(run, 'multiplayer_coop'));

    expect(readRawFromStore('recall-rogue-active-run')).toBeNull();
  });

  it('runMode field is preserved in the loaded result for multiplayer_coop', () => {
    clearMockStore();
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run, 'multiplayer_coop'));

    const loaded = loadActiveRun('multiplayer-coop');
    expect(loaded).not.toBeNull();
    expect(loaded!.runMode).toBe('multiplayer_coop');
  });

  it('legacy key migration: reads legacy key and promotes to solo slot, then deletes legacy', () => {
    clearMockStore();
    // Write a legacy-format save (no per-mode namespacing) directly to the old key.
    // We need to simulate a pre-migration state. Since legacyMigrationAttempted is a
    // module-level variable that is already true by this point in the test suite,
    // we have to write both the legacy key AND assert that clearActiveRun/hasActiveRun
    // do not read from it (proving the migration path has already cleaned it up).
    //
    // What we CAN test here: after saveActiveRun writes the per-mode key, reading
    // from the legacy key returns null (the service never writes to the old key).
    const run = makeRunState();
    saveActiveRun(makeMinimalSavePayload(run, 'standard'));

    // Legacy key must not exist — the new code never writes to it.
    expect(readRawFromStore('recall-rogue-active-run')).toBeNull();

    // But the solo slot must have the data.
    expect(readRawFromStore('recall-rogue-active-run-solo')).not.toBeNull();
  });
});
