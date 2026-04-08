import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfusionMatrix } from '../../src/services/confusionMatrix';
import type { ConfusionEntry } from '../../src/services/confusionMatrix';

/**
 * ConfusionMatrix — serialization, lookup, and increment tests.
 *
 * Covers: create, recordConfusion, getConfusionsFor, getReverseConfusionsFor,
 * getConfusionScore, toJSON/fromJSON round-trips, empty matrix, and invalid data.
 */
describe('ConfusionMatrix', () => {
  // ── Basic creation ────────────────────────────────────────────────

  describe('new ConfusionMatrix()', () => {
    it('starts empty (size = 0)', () => {
      const matrix = new ConfusionMatrix();
      expect(matrix.size).toBe(0);
    });

    it('getConfusionsFor returns empty array for unknown fact', () => {
      const matrix = new ConfusionMatrix();
      expect(matrix.getConfusionsFor('fact_x')).toEqual([]);
    });

    it('getReverseConfusionsFor returns empty array for unknown fact', () => {
      const matrix = new ConfusionMatrix();
      expect(matrix.getReverseConfusionsFor('fact_x')).toEqual([]);
    });

    it('getConfusionScore returns 0 for unknown pair', () => {
      const matrix = new ConfusionMatrix();
      expect(matrix.getConfusionScore('fact_a', 'fact_b')).toBe(0);
    });
  });

  // ── recordConfusion ───────────────────────────────────────────────

  describe('recordConfusion', () => {
    it('creates an entry with count=1 on first call', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      expect(matrix.size).toBe(1);
      const entries = matrix.getConfusionsFor('fact_a');
      expect(entries).toHaveLength(1);
      expect(entries[0].targetFactId).toBe('fact_a');
      expect(entries[0].confusedFactId).toBe('fact_b');
      expect(entries[0].count).toBe(1);
    });

    it('increments count when the same pair is recorded again', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_a', 'fact_b');
      const entries = matrix.getConfusionsFor('fact_a');
      expect(entries[0].count).toBe(3);
      // Still only one entry (not three)
      expect(matrix.size).toBe(1);
    });

    it('treats (A→B) and (B→A) as distinct entries', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_b', 'fact_a');
      expect(matrix.size).toBe(2);
    });

    it('updates lastOccurred on each increment', () => {
      const matrix = new ConfusionMatrix();

      vi.useFakeTimers();
      vi.setSystemTime(1000);
      matrix.recordConfusion('fact_a', 'fact_b');
      const firstTime = matrix.getConfusionsFor('fact_a')[0].lastOccurred;

      vi.setSystemTime(5000);
      matrix.recordConfusion('fact_a', 'fact_b');
      const secondTime = matrix.getConfusionsFor('fact_a')[0].lastOccurred;

      expect(secondTime).toBeGreaterThan(firstTime);
      vi.useRealTimers();
    });

    it('allows multiple distinct confused facts for the same target', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_a', 'fact_c');
      matrix.recordConfusion('fact_a', 'fact_d');
      expect(matrix.size).toBe(3);
      expect(matrix.getConfusionsFor('fact_a')).toHaveLength(3);
    });
  });

  // ── getConfusionsFor ──────────────────────────────────────────────

  describe('getConfusionsFor', () => {
    it('returns only entries where targetFactId matches', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_z', 'fact_a'); // different target
      const forA = matrix.getConfusionsFor('fact_a');
      expect(forA).toHaveLength(1);
      expect(forA[0].confusedFactId).toBe('fact_b');
    });

    it('returns all confusions for a target with multiple wrong picks', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('target', 'wrong_1');
      matrix.recordConfusion('target', 'wrong_2');
      matrix.recordConfusion('target', 'wrong_3');
      const confusions = matrix.getConfusionsFor('target');
      const confusedIds = confusions.map(e => e.confusedFactId).sort();
      expect(confusedIds).toEqual(['wrong_1', 'wrong_2', 'wrong_3']);
    });
  });

  // ── getReverseConfusionsFor ───────────────────────────────────────

  describe('getReverseConfusionsFor', () => {
    it('returns entries where confusedFactId matches (reverse lookup)', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_c', 'fact_b');
      // fact_b was picked wrongly for both fact_a and fact_c
      const reverse = matrix.getReverseConfusionsFor('fact_b');
      expect(reverse).toHaveLength(2);
      const targets = reverse.map(e => e.targetFactId).sort();
      expect(targets).toEqual(['fact_a', 'fact_c']);
    });

    it('does not include entries where the fact is the target', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_a', 'fact_c');
      // fact_a is target, not confused — reverse lookup should be empty
      expect(matrix.getReverseConfusionsFor('fact_a')).toHaveLength(0);
    });
  });

  // ── getConfusionScore ─────────────────────────────────────────────

  describe('getConfusionScore', () => {
    it('returns 0 for an unknown pair', () => {
      const matrix = new ConfusionMatrix();
      expect(matrix.getConfusionScore('x', 'y')).toBe(0);
    });

    it('returns forward count for one-directional confusion', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_a', 'fact_b');
      expect(matrix.getConfusionScore('fact_a', 'fact_b')).toBe(2);
    });

    it('sums forward and reverse counts for bidirectional confusion', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b'); // count: 1
      matrix.recordConfusion('fact_a', 'fact_b'); // count: 2
      matrix.recordConfusion('fact_b', 'fact_a'); // count: 1 in reverse
      // score = forward(2) + reverse(1) = 3
      expect(matrix.getConfusionScore('fact_a', 'fact_b')).toBe(3);
      // Symmetric
      expect(matrix.getConfusionScore('fact_b', 'fact_a')).toBe(3);
    });
  });

  // ── toJSON / fromJSON round-trip ──────────────────────────────────

  describe('toJSON / fromJSON round-trip', () => {
    it('empty matrix serializes to an empty array and deserializes cleanly', () => {
      const matrix = new ConfusionMatrix();
      const json = matrix.toJSON();
      expect(json).toEqual([]);

      const restored = ConfusionMatrix.fromJSON(json);
      expect(restored.size).toBe(0);
    });

    it('preserves all fields across a round-trip', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_a', 'fact_b'); // count becomes 2
      matrix.recordConfusion('fact_c', 'fact_d');

      const json = matrix.toJSON();
      const restored = ConfusionMatrix.fromJSON(json);

      expect(restored.size).toBe(2);

      const forA = restored.getConfusionsFor('fact_a');
      expect(forA).toHaveLength(1);
      expect(forA[0].count).toBe(2);
      expect(forA[0].confusedFactId).toBe('fact_b');

      const forC = restored.getConfusionsFor('fact_c');
      expect(forC).toHaveLength(1);
      expect(forC[0].count).toBe(1);
      expect(forC[0].confusedFactId).toBe('fact_d');
    });

    it('restored matrix supports further recordConfusion calls', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');

      const restored = ConfusionMatrix.fromJSON(matrix.toJSON());
      restored.recordConfusion('fact_a', 'fact_b'); // should increment
      expect(restored.getConfusionsFor('fact_a')[0].count).toBe(2);
    });

    it('restored matrix supports bidirectional lookups', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      matrix.recordConfusion('fact_c', 'fact_b');

      const restored = ConfusionMatrix.fromJSON(matrix.toJSON());
      const reverse = restored.getReverseConfusionsFor('fact_b');
      expect(reverse).toHaveLength(2);
    });

    it('toJSON returns an array of ConfusionEntry objects (not Map internals)', () => {
      const matrix = new ConfusionMatrix();
      matrix.recordConfusion('fact_a', 'fact_b');
      const json = matrix.toJSON();
      expect(Array.isArray(json)).toBe(true);
      expect(json[0]).toMatchObject({
        targetFactId: 'fact_a',
        confusedFactId: 'fact_b',
        count: 1,
      });
      expect(typeof json[0].lastOccurred).toBe('number');
    });
  });

  // ── fromJSON defensive handling ───────────────────────────────────

  describe('fromJSON — defensive handling of bad input', () => {
    it('returns empty matrix for non-array input', () => {
      // @ts-expect-error intentional bad input
      const matrix = ConfusionMatrix.fromJSON(null);
      expect(matrix.size).toBe(0);
    });

    it('skips entries missing required fields', () => {
      const badData = [
        { targetFactId: 'fact_a', count: 1, lastOccurred: Date.now() }, // missing confusedFactId
        { confusedFactId: 'fact_b', count: 1, lastOccurred: Date.now() }, // missing targetFactId
        { targetFactId: 'fact_c', confusedFactId: 'fact_d', count: 1, lastOccurred: Date.now() }, // valid
      ] as ConfusionEntry[];

      const matrix = ConfusionMatrix.fromJSON(badData);
      expect(matrix.size).toBe(1);
    });

    it('skips entries where count is not a number', () => {
      const badData = [
        { targetFactId: 'fact_a', confusedFactId: 'fact_b', count: 'lots' as unknown as number, lastOccurred: Date.now() },
      ];
      // @ts-expect-error intentional bad input
      const matrix = ConfusionMatrix.fromJSON(badData);
      expect(matrix.size).toBe(0);
    });
  });
});
