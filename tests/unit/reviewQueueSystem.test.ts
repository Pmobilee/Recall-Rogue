import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetReviewQueue,
  addToReviewQueue,
  getReviewQueueLength,
  isReviewQueueFact,
  clearReviewQueueFact,
  getTopReviewFacts,
} from '../../src/services/reviewQueueSystem';

describe('reviewQueueSystem', () => {
  beforeEach(() => {
    resetReviewQueue();
  });

  // --- resetReviewQueue tests ---

  describe('resetReviewQueue', () => {
    it('clears all entries', () => {
      addToReviewQueue('fact-1');
      addToReviewQueue('fact-2');
      addToReviewQueue('fact-3');
      expect(getReviewQueueLength()).toBe(3);

      resetReviewQueue();

      expect(getReviewQueueLength()).toBe(0);
    });
  });

  // --- addToReviewQueue tests ---

  describe('addToReviewQueue', () => {
    it('adds a factId to the queue', () => {
      addToReviewQueue('fact-a');
      expect(isReviewQueueFact('fact-a')).toBe(true);
    });

    it('no duplicate factIds: adding same ID twice keeps length at 1', () => {
      addToReviewQueue('fact-dup');
      addToReviewQueue('fact-dup');
      expect(getReviewQueueLength()).toBe(1);
    });
  });

  // --- getReviewQueueLength tests ---

  describe('getReviewQueueLength', () => {
    it('returns correct count after multiple unique additions', () => {
      addToReviewQueue('fact-1');
      addToReviewQueue('fact-2');
      addToReviewQueue('fact-3');
      expect(getReviewQueueLength()).toBe(3);
    });

    it('returns 0 on a fresh queue', () => {
      expect(getReviewQueueLength()).toBe(0);
    });
  });

  // --- isReviewQueueFact tests ---

  describe('isReviewQueueFact', () => {
    it('returns true for a factId that is present', () => {
      addToReviewQueue('fact-present');
      expect(isReviewQueueFact('fact-present')).toBe(true);
    });

    it('returns false for a factId that is absent', () => {
      expect(isReviewQueueFact('fact-absent')).toBe(false);
    });
  });

  // --- clearReviewQueueFact tests ---

  describe('clearReviewQueueFact', () => {
    it('returns true when factId is present and removes it', () => {
      addToReviewQueue('fact-to-clear');
      const result = clearReviewQueueFact('fact-to-clear');
      expect(result).toBe(true);
    });

    it('returns false when factId is not present', () => {
      const result = clearReviewQueueFact('fact-not-present');
      expect(result).toBe(false);
    });

    it('after clear, isReviewQueueFact returns false for that factId', () => {
      addToReviewQueue('fact-cleared');
      clearReviewQueueFact('fact-cleared');
      expect(isReviewQueueFact('fact-cleared')).toBe(false);
    });

    it('after clear, queue length decrements by 1', () => {
      addToReviewQueue('fact-x');
      addToReviewQueue('fact-y');
      clearReviewQueueFact('fact-x');
      expect(getReviewQueueLength()).toBe(1);
    });
  });

  // --- getTopReviewFacts tests ---

  describe('getTopReviewFacts', () => {
    it('returns at most n items when queue has more than n', () => {
      addToReviewQueue('fact-1');
      addToReviewQueue('fact-2');
      addToReviewQueue('fact-3');
      addToReviewQueue('fact-4');
      addToReviewQueue('fact-5');
      const top = getTopReviewFacts(3);
      expect(top.length).toBe(3);
    });

    it('returns all items when queue has fewer than n', () => {
      addToReviewQueue('fact-1');
      addToReviewQueue('fact-2');
      const top = getTopReviewFacts(3);
      expect(top.length).toBe(2);
      expect(top).toContain('fact-1');
      expect(top).toContain('fact-2');
    });

    it('returns items in insertion order (oldest first)', () => {
      addToReviewQueue('fact-first');
      addToReviewQueue('fact-second');
      addToReviewQueue('fact-third');
      const top = getTopReviewFacts(3);
      expect(top[0]).toBe('fact-first');
      expect(top[1]).toBe('fact-second');
      expect(top[2]).toBe('fact-third');
    });
  });

  // --- reset after adding items ---

  describe('reset after adding items', () => {
    it('clears everything: length is 0 and items are no longer present', () => {
      addToReviewQueue('fact-alpha');
      addToReviewQueue('fact-beta');
      addToReviewQueue('fact-gamma');

      resetReviewQueue();

      expect(getReviewQueueLength()).toBe(0);
      expect(isReviewQueueFact('fact-alpha')).toBe(false);
      expect(isReviewQueueFact('fact-beta')).toBe(false);
      expect(isReviewQueueFact('fact-gamma')).toBe(false);
    });
  });
});
