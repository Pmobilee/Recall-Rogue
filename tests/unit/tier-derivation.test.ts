import { describe, it, expect } from 'vitest';
import {
  getCardTier,
  getTierDisplayName,
  getDisplayTier,
  qualifiesForMasteryTrial,
} from '../../src/services/tierDerivation';

/**
 * Tier Derivation — extended regression suite.
 *
 * The canonical short suite lives in tierDerivation.test.ts.
 * This file adds: undefined/new-fact handling, downgrade simulation,
 * display helpers, and exact threshold edge cases.
 */
describe('tier-derivation (extended)', () => {
  // ── Tier 1: Learning ──────────────────────────────────────────────

  describe('Tier 1 — Learning', () => {
    it('returns tier 1 for a brand-new fact (undefined state)', () => {
      expect(getCardTier(undefined)).toBe('1');
    });

    it('returns tier 1 for empty object (all fields default to 0/false)', () => {
      expect(getCardTier({})).toBe('1');
    });

    it('returns tier 1 when stability < 2 regardless of consecutiveCorrect', () => {
      expect(getCardTier({ stability: 0, consecutiveCorrect: 10, passedMasteryTrial: true })).toBe('1');
      expect(getCardTier({ stability: 1.99, consecutiveCorrect: 5, passedMasteryTrial: true })).toBe('1');
    });

    it('returns tier 1 when consecutiveCorrect < 2 regardless of stability', () => {
      expect(getCardTier({ stability: 100, consecutiveCorrect: 1, passedMasteryTrial: true })).toBe('1');
      expect(getCardTier({ stability: 100, consecutiveCorrect: 0, passedMasteryTrial: true })).toBe('1');
    });
  });

  // ── Tier 1 → 2a transition ────────────────────────────────────────

  describe('Tier 1 → 2a transition', () => {
    it('returns 2a at exact threshold: stability=2, consecutiveCorrect=2', () => {
      expect(getCardTier({ stability: 2, consecutiveCorrect: 2 })).toBe('2a');
    });

    it('returns 1 just below stability threshold: stability=1.99, consecutiveCorrect=2', () => {
      expect(getCardTier({ stability: 1.99, consecutiveCorrect: 2 })).toBe('1');
    });

    it('returns 1 just below consecutiveCorrect threshold: stability=2, consecutiveCorrect=1', () => {
      expect(getCardTier({ stability: 2, consecutiveCorrect: 1 })).toBe('1');
    });

    it('returns 2a when stability > 2 and consecutiveCorrect = 2 (below 2b)', () => {
      expect(getCardTier({ stability: 4.99, consecutiveCorrect: 2 })).toBe('2a');
    });
  });

  // ── Tier 2a → 2b transition ───────────────────────────────────────

  describe('Tier 2a → 2b transition', () => {
    it('returns 2b at exact threshold: stability=5, consecutiveCorrect=3', () => {
      expect(getCardTier({ stability: 5, consecutiveCorrect: 3 })).toBe('2b');
    });

    it('returns 2a just below stability threshold: stability=4.99, consecutiveCorrect=3', () => {
      expect(getCardTier({ stability: 4.99, consecutiveCorrect: 3 })).toBe('2a');
    });

    it('returns 2a just below consecutiveCorrect threshold: stability=5, consecutiveCorrect=2', () => {
      expect(getCardTier({ stability: 5, consecutiveCorrect: 2 })).toBe('2a');
    });
  });

  // ── Tier 2b → 3 transition ────────────────────────────────────────

  describe('Tier 2b → 3 transition', () => {
    it('stays at 2b without passedMasteryTrial even when all numeric thresholds met', () => {
      expect(getCardTier({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: false })).toBe('2b');
    });

    it('returns 3 at exact threshold with passedMasteryTrial=true', () => {
      expect(getCardTier({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: true })).toBe('3');
    });

    it('stays at 2b when stability < 10 even with passedMasteryTrial=true', () => {
      expect(getCardTier({ stability: 9.99, consecutiveCorrect: 4, passedMasteryTrial: true })).toBe('2b');
    });

    it('stays at 2b when consecutiveCorrect < 4 even with passedMasteryTrial=true', () => {
      expect(getCardTier({ stability: 10, consecutiveCorrect: 3, passedMasteryTrial: true })).toBe('2b');
    });

    it('returns 3 with stability far above threshold', () => {
      expect(getCardTier({ stability: 50, consecutiveCorrect: 10, passedMasteryTrial: true })).toBe('3');
    });
  });

  // ── Downgrade on wrong answer (consecutive reset) ─────────────────

  describe('Downgrade simulation — consecutiveCorrect reset to 0 on wrong answer', () => {
    it('fact at tier 2a drops back to tier 1 after wrong answer resets consecutiveCorrect', () => {
      // Before wrong answer: was 2a
      expect(getCardTier({ stability: 3, consecutiveCorrect: 2 })).toBe('2a');
      // After wrong answer: consecutiveCorrect resets to 0
      expect(getCardTier({ stability: 3, consecutiveCorrect: 0 })).toBe('1');
    });

    it('fact at tier 2b drops to tier 1 after wrong answer resets consecutiveCorrect', () => {
      expect(getCardTier({ stability: 7, consecutiveCorrect: 3 })).toBe('2b');
      expect(getCardTier({ stability: 7, consecutiveCorrect: 0 })).toBe('1');
    });

    it('fact at tier 3 drops to tier 1 after wrong answer resets consecutiveCorrect', () => {
      // passedMasteryTrial stays true, but consecutiveCorrect gone
      expect(getCardTier({ stability: 15, consecutiveCorrect: 0, passedMasteryTrial: true })).toBe('1');
    });
  });

  // ── Mastery trial eligibility ─────────────────────────────────────

  describe('qualifiesForMasteryTrial', () => {
    it('returns true only for a 2b fact at exactly the Tier 3 numeric threshold', () => {
      expect(qualifiesForMasteryTrial({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: false })).toBe(true);
    });

    it('returns false when stability is just below threshold', () => {
      expect(qualifiesForMasteryTrial({ stability: 9.99, consecutiveCorrect: 4, passedMasteryTrial: false })).toBe(false);
    });

    it('returns false when passedMasteryTrial is already true', () => {
      expect(qualifiesForMasteryTrial({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: true })).toBe(false);
    });

    it('returns false for a Tier 1 fact (below 2b)', () => {
      expect(qualifiesForMasteryTrial({ stability: 1, consecutiveCorrect: 1, passedMasteryTrial: false })).toBe(false);
    });

    it('returns false for undefined state (new fact)', () => {
      expect(qualifiesForMasteryTrial(undefined)).toBe(false);
    });
  });

  // ── Display helpers ───────────────────────────────────────────────

  describe('getTierDisplayName', () => {
    it('returns "Learning" for tier 1', () => {
      expect(getTierDisplayName('1')).toBe('Learning');
    });

    it('returns "Proven" for tier 2a', () => {
      expect(getTierDisplayName('2a')).toBe('Proven');
    });

    it('returns "Proven" for tier 2b (2a/2b share the same player-facing label)', () => {
      expect(getTierDisplayName('2b')).toBe('Proven');
    });

    it('returns "Mastered" for tier 3', () => {
      expect(getTierDisplayName('3')).toBe('Mastered');
    });

    it('returns "Unseen" for the unseen sentinel', () => {
      expect(getTierDisplayName('unseen')).toBe('Unseen');
    });
  });

  describe('getDisplayTier', () => {
    it('maps tier 1 → bronze', () => {
      expect(getDisplayTier('1')).toBe('bronze');
    });

    it('maps tier 2a → silver', () => {
      expect(getDisplayTier('2a')).toBe('silver');
    });

    it('maps tier 2b → silver (2a and 2b share the visual tier)', () => {
      expect(getDisplayTier('2b')).toBe('silver');
    });

    it('maps tier 3 → gold', () => {
      expect(getDisplayTier('3')).toBe('gold');
    });
  });
});
