// === Review Queue System (AR-261) ===
// Per-encounter list of factIds from wrong Charge answers.
// Specific cards (Recall) and relics (Scholar's Crown) reference it.

let _queue: string[] = [];

/**
 * Clears the review queue to an empty array.
 * Called at the beginning of each encounter.
 */
export function resetReviewQueue(): void {
  _queue = [];
}

/**
 * Adds a factId to the review queue if it is not already present.
 * Preserves insertion order; duplicates are silently ignored.
 *
 * @param factId - The fact identifier to enqueue for later review.
 */
export function addToReviewQueue(factId: string): void {
  if (!_queue.includes(factId)) {
    _queue.push(factId);
  }
}

/**
 * Checks whether a factId is currently in the review queue.
 *
 * @param factId - The fact identifier to look up.
 * @returns true if the factId is queued, false otherwise.
 */
export function isReviewQueueFact(factId: string): boolean {
  return _queue.includes(factId);
}

/**
 * Removes a factId from the review queue if present.
 *
 * @param factId - The fact identifier to remove.
 * @returns true if the factId was in the queue and was removed; false if it was not present.
 */
export function clearReviewQueueFact(factId: string): boolean {
  const index = _queue.indexOf(factId);
  if (index === -1) return false;
  _queue.splice(index, 1);
  return true;
}

/**
 * Returns the first n factIds from the queue (oldest wrong answers first).
 * If the queue has fewer than n items, all items are returned.
 *
 * @param n - Maximum number of factIds to return.
 * @returns A shallow copy of the first n queue entries.
 */
export function getTopReviewFacts(n: number): string[] {
  return _queue.slice(0, n);
}

/**
 * Returns the current number of factIds in the review queue.
 */
export function getReviewQueueLength(): number {
  return _queue.length;
}
