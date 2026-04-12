/**
 * Steam achievement wiring invariant tests.
 *
 * These tests verify, at the source level, that every achievement ID defined
 * in steamAchievements.ts is referenced somewhere in gameFlowController.ts.
 * This catches achievements that were added to the Steamworks dashboard and
 * the definitions file but never wired into the game's trigger logic.
 *
 * Pattern: same source-invariant approach as gameFlowController.termination.test.ts
 * (which verified run-termination routing). We parse the source as a string and
 * check for literal ID references rather than trying to import and invoke the
 * private checkCumulativeAchievements() function, which would require mocking the
 * entire Svelte/Phaser/store stack.
 */

// @vitest-environment node

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { STEAM_ACHIEVEMENTS } from '../../src/data/steamAchievements';

const CONTROLLER_PATH = path.resolve(__dirname, 'gameFlowController.ts');
const ACHIEVEMENTS_PATH = path.resolve(__dirname, '../data/steamAchievements.ts');

describe('Steam achievement wiring — source-level invariant', () => {
  let controllerSource: string;
  let achievementsSource: string;

  beforeEach(() => {
    controllerSource = fs.readFileSync(CONTROLLER_PATH, 'utf-8');
    achievementsSource = fs.readFileSync(ACHIEVEMENTS_PATH, 'utf-8');
  });

  it('all achievement IDs from steamAchievements.ts appear in gameFlowController.ts', () => {
    const missing: string[] = [];

    for (const achievement of STEAM_ACHIEVEMENTS) {
      // Check that the literal string ID appears somewhere in the controller source.
      // The typical pattern is tryUnlock('ID') or tryUnlock("ID").
      if (!controllerSource.includes(`'${achievement.id}'`) && !controllerSource.includes(`"${achievement.id}"`)) {
        missing.push(achievement.id);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `The following achievement IDs are defined in steamAchievements.ts but ` +
        `are NOT referenced in gameFlowController.ts:\n` +
        missing.map(id => `  - ${id}`).join('\n') +
        `\n\nEach achievement must be wired to a tryUnlock() call in gameFlowController.ts.`
      );
    }
  });

  it('STEAM_ACHIEVEMENTS contains exactly 24 entries', () => {
    // If this count changes, the source-invariant test above needs review.
    // Update this number when new achievements are intentionally added.
    expect(STEAM_ACHIEVEMENTS).toHaveLength(24);
  });

  it('steamAchievements.ts exports STEAM_ACHIEVEMENTS as a non-empty array', () => {
    expect(Array.isArray(STEAM_ACHIEVEMENTS)).toBe(true);
    expect(STEAM_ACHIEVEMENTS.length).toBeGreaterThan(0);
  });

  it('all achievement definitions have non-empty id, name, and description', () => {
    for (const ach of STEAM_ACHIEVEMENTS) {
      expect(typeof ach.id, `id must be a string (achievement: ${ach.id})`).toBe('string');
      expect(ach.id.length, `id must be non-empty`).toBeGreaterThan(0);
      expect(typeof ach.name, `name must be a string for ${ach.id}`).toBe('string');
      expect(ach.name.length, `name must be non-empty for ${ach.id}`).toBeGreaterThan(0);
      expect(typeof ach.description, `description must be a string for ${ach.id}`).toBe('string');
      expect(ach.description.length, `description must be non-empty for ${ach.id}`).toBeGreaterThan(0);
    }
  });

  it('achievement IDs are unique — no duplicates in the definitions', () => {
    const ids = STEAM_ACHIEVEMENTS.map(a => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('gameFlowController.ts imports unlockAchievement from steamService', () => {
    expect(controllerSource).toContain("from './steamService'");
    expect(controllerSource).toContain('unlockAchievement');
  });

  it('gameFlowController.ts defines a tryUnlock wrapper', () => {
    expect(controllerSource).toContain('function tryUnlock(');
    expect(controllerSource).toContain('void unlockAchievement(id)');
  });

  it('cumulative achievements use checkCumulativeAchievements helper', () => {
    expect(controllerSource).toContain('function checkCumulativeAchievements(');
    expect(controllerSource).toContain('checkCumulativeAchievements()');
  });

  // ── Spot-check individual trigger conditions ──────────────────────────────

  it("FACTS_100 trigger reads save.stats.totalQuizCorrect", () => {
    // Verify the condition is data-driven from the right field
    expect(controllerSource).toContain('totalQuizCorrect');
    expect(controllerSource).toContain("tryUnlock('FACTS_100')");
  });

  it("MASTERY_FIRST trigger reads save.stats.lifetimeFactsMastered", () => {
    expect(controllerSource).toContain('lifetimeFactsMastered');
    expect(controllerSource).toContain("tryUnlock('MASTERY_FIRST')");
  });

  it("STREAK_7 trigger reads save.longestStreak", () => {
    expect(controllerSource).toContain('longestStreak');
    expect(controllerSource).toContain("tryUnlock('STREAK_7')");
  });

  it("DECK_EXPLORER trigger reads save.runHistory", () => {
    expect(controllerSource).toContain('runHistory');
    expect(controllerSource).toContain("tryUnlock('DECK_EXPLORER')");
  });

  it("DECK_EXPLORER checks 5 unique deckIds", () => {
    // Verify the threshold of 5 is in the source
    const deckExplorerRegion = (() => {
      const idx = controllerSource.indexOf("tryUnlock('DECK_EXPLORER')");
      // grab a reasonable window around the trigger
      return controllerSource.slice(Math.max(0, idx - 300), idx + 50);
    })();
    expect(deckExplorerRegion).toContain('5');
  });
});
