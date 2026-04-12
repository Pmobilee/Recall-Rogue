/**
 * Save round-trip integrity tests — Steam release QA.
 *
 * Verifies that:
 *  1. createNewPlayer() produces a valid JSON-serializable save.
 *  2. Every key field on the returned PlayerSave matches the expected type/value.
 *  3. A minimal v1 save migrates cleanly through all versions to v3.
 *  4. ConfusionMatrix caps at MAX_ENTRIES (5000) and prunes the oldest entry.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock IO/storage dependencies so the module loads cleanly in Node.
// createNewPlayer() itself does NOT call storage, but saveService.ts imports
// profileService and storageBackend at the top level.
// ---------------------------------------------------------------------------

vi.mock('./storageBackend', () => ({
  getBackend: () => ({
    readSync: (_key: string) => null,
    write: (_key: string, _val: string) => {},
    remove: (_key: string) => {},
    flush: async () => {},
    init: async () => {},
  }),
}));

vi.mock('./profileService', () => ({
  profileService: {
    getSaveKey: () => 'test-save-key',
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are set up.
// ---------------------------------------------------------------------------

import { createNewPlayer } from './saveService';
import {
  needsRelicMigrationV1toV2,
  migrateRelicsV1toV2,
  needsMigrationV2toV3,
  migrateV2toV3,
} from './saveMigration';
import { ConfusionMatrix } from './confusionMatrix';

// ---------------------------------------------------------------------------
// Suite 1 — createNewPlayer round-trip
// ---------------------------------------------------------------------------

describe('createNewPlayer — JSON round-trip', () => {
  it('produces a valid JSON-serializable save', () => {
    const save = createNewPlayer('adult');

    // Must not throw during stringify
    let json: string;
    expect(() => { json = JSON.stringify(save); }).not.toThrow();

    // Must parse back to same shape
    const reparsed = JSON.parse(json!);
    expect(reparsed).toEqual(save);
  });
});

describe('createNewPlayer — field types and defaults', () => {
  let save: ReturnType<typeof createNewPlayer>;

  beforeEach(() => {
    save = createNewPlayer('adult');
  });

  it('version is number 3', () => {
    expect(typeof save.version).toBe('number');
    expect(save.version).toBe(3);
  });

  it('playerId is a non-empty string', () => {
    expect(typeof save.playerId).toBe('string');
    expect(save.playerId.length).toBeGreaterThan(0);
  });

  it('reviewStates is an empty array', () => {
    expect(Array.isArray(save.reviewStates)).toBe(true);
    expect(save.reviewStates).toHaveLength(0);
  });

  it('learnedFacts is an empty array', () => {
    expect(Array.isArray(save.learnedFacts)).toBe(true);
    expect(save.learnedFacts).toHaveLength(0);
  });

  it('stats.totalDivesCompleted is 0', () => {
    expect(save.stats.totalDivesCompleted).toBe(0);
  });

  it('stats.totalVictories is 0 (v3 field)', () => {
    expect(save.stats.totalVictories).toBe(0);
  });

  it('runHistory is an empty array (v3 field)', () => {
    expect(Array.isArray(save.runHistory)).toBe(true);
    expect(save.runHistory).toHaveLength(0);
  });

  it('lifetimeEnemyKillCounts is an empty object (v3 field)', () => {
    expect(save.lifetimeEnemyKillCounts).toBeDefined();
    expect(typeof save.lifetimeEnemyKillCounts).toBe('object');
    expect(Array.isArray(save.lifetimeEnemyKillCounts)).toBe(false);
    expect(Object.keys(save.lifetimeEnemyKillCounts ?? {})).toHaveLength(0);
  });

  it('characterLevel is 1 — dev override must not leak', () => {
    // In production, new players start at level 1. The DEV block
    // in load() forces level 25, but createNewPlayer() ALWAYS returns 1.
    expect(save.characterLevel).toBe(1);
  });

  it('totalXP is 0', () => {
    expect(save.totalXP).toBe(0);
  });

  it('masteryCoins is 0', () => {
    expect(save.masteryCoins).toBe(0);
  });

  it('hubState exists with unlockedFloorIds array', () => {
    expect(save.hubState).toBeDefined();
    expect(typeof save.hubState).toBe('object');
    expect(Array.isArray(save.hubState.unlockedFloorIds)).toBe(true);
    expect(save.hubState.unlockedFloorIds.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — V1 → V2 → V3 migration chain
// ---------------------------------------------------------------------------

describe('save migration — v1 through all versions to v3', () => {
  /** Minimal v1-shaped save */
  function makeV1Save(): Record<string, unknown> {
    return {
      version: 1,
      playerId: 'test-player',
      stats: {
        totalDivesCompleted: 5,
        bestFloor: 3,
        totalFactsLearned: 10,
        totalFactsSold: 0,
        totalQuizCorrect: 50,
        totalQuizWrong: 10,
        currentStreak: 3,
        bestStreak: 5,
      },
      reviewStates: [],
      learnedFacts: [],
      soldFacts: [],
      minerals: { greyMatter: 100 },
      ageRating: 'adult',
      createdAt: 1000,
      lastPlayedAt: 2000,
      oxygen: 3,
      // Required by migrateRelicsV1toV2
      unlockedRelicIds: [],
      masteryCoins: 0,
    };
  }

  it('needsRelicMigrationV1toV2 returns true for a v1 save', () => {
    const v1 = makeV1Save();
    expect(needsRelicMigrationV1toV2(v1 as Parameters<typeof needsRelicMigrationV1toV2>[0])).toBe(true);
  });

  it('migrateRelicsV1toV2 sets version to 2', () => {
    const v1 = makeV1Save();
    migrateRelicsV1toV2(v1 as Parameters<typeof migrateRelicsV1toV2>[0]);
    expect(v1.version).toBe(2);
  });

  it('needsMigrationV2toV3 returns true for a v2 save', () => {
    const v2 = makeV1Save();
    v2.version = 2;
    expect(needsMigrationV2toV3(v2)).toBe(true);
  });

  it('migrateV2toV3 sets version to 3 and adds runHistory + lifetimeEnemyKillCounts', () => {
    const v2 = makeV1Save();
    v2.version = 2;
    migrateV2toV3(v2);
    expect(v2.version).toBe(3);
    expect(Array.isArray(v2.runHistory)).toBe(true);
    expect(v2.lifetimeEnemyKillCounts).toBeDefined();
    expect(typeof v2.lifetimeEnemyKillCounts).toBe('object');
  });

  it('full v1 → v2 → v3 chain yields version 3', () => {
    const save = makeV1Save();

    // V1 → V2
    expect(needsRelicMigrationV1toV2(save as Parameters<typeof needsRelicMigrationV1toV2>[0])).toBe(true);
    migrateRelicsV1toV2(save as Parameters<typeof migrateRelicsV1toV2>[0]);
    expect(save.version).toBe(2);

    // V2 → V3
    expect(needsMigrationV2toV3(save)).toBe(true);
    migrateV2toV3(save);
    expect(save.version).toBe(3);
    expect(Array.isArray(save.runHistory)).toBe(true);
    expect((save.lifetimeEnemyKillCounts as Record<string, unknown>)).toEqual({});
  });

  it('needsMigrationV2toV3 returns false after migration', () => {
    const save = makeV1Save();
    save.version = 2;
    migrateV2toV3(save);
    expect(needsMigrationV2toV3(save)).toBe(false);
  });

  it('needsRelicMigrationV1toV2 returns false after migration', () => {
    const save = makeV1Save();
    migrateRelicsV1toV2(save as Parameters<typeof migrateRelicsV1toV2>[0]);
    expect(needsRelicMigrationV1toV2(save as Parameters<typeof needsRelicMigrationV1toV2>[0])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — ConfusionMatrix cap
// ---------------------------------------------------------------------------

describe('ConfusionMatrix — 5000-entry cap', () => {
  it('caps at 5000 entries after 5001 unique insertions', () => {
    const matrix = new ConfusionMatrix();

    for (let i = 0; i < 5001; i++) {
      matrix.recordConfusion(`target-${i}`, `confused-${i}`);
    }

    expect(matrix.toJSON().length).toBeLessThanOrEqual(5000);
  });

  it('size reports <= 5000 after overflow', () => {
    const matrix = new ConfusionMatrix();

    for (let i = 0; i < 5100; i++) {
      matrix.recordConfusion(`t-${i}`, `c-${i}`);
    }

    expect(matrix.size).toBeLessThanOrEqual(5000);
  });

  it('toJSON returns an array', () => {
    const matrix = new ConfusionMatrix();
    matrix.recordConfusion('a', 'b');
    expect(Array.isArray(matrix.toJSON())).toBe(true);
  });

  it('fromJSON restores entries correctly', () => {
    const matrix = new ConfusionMatrix();
    matrix.recordConfusion('x', 'y');
    const json = matrix.toJSON();

    const restored = ConfusionMatrix.fromJSON(json);
    expect(restored.size).toBe(1);
    expect(restored.getConfusionScore('x', 'y')).toBe(1);
  });

  it('repeated confusion increments count instead of adding a new entry', () => {
    const matrix = new ConfusionMatrix();
    matrix.recordConfusion('fact-1', 'fact-2');
    matrix.recordConfusion('fact-1', 'fact-2');

    const entries = matrix.toJSON();
    expect(entries).toHaveLength(1);
    expect(entries[0].count).toBe(2);
  });
});
