/** A single confusion entry: player chose confusedFactId when targetFactId was correct. */
export interface ConfusionEntry {
  targetFactId: string;
  confusedFactId: string;
  count: number;
  lastOccurred: number;  // Unix timestamp ms
}

/**
 * Confusion Matrix: tracks which facts the player confuses with each other.
 * Persists across runs in player save.
 *
 * Entry count is capped at MAX_ENTRIES to prevent unbounded save file growth
 * over months of play. Pruning removes stale low-count entries first.
 */
export class ConfusionMatrix {
  private entries: Map<string, ConfusionEntry> = new Map();  // key = "target|confused"

  /** Maximum number of confusion pairs stored. Prevents save bloat over long play sessions. */
  private static readonly MAX_ENTRIES = 5000;

  /** 90 days in ms — entries older than this are considered stale during pruning. */
  private static readonly STALE_AGE_MS = 90 * 24 * 60 * 60 * 1000;

  private static key(target: string, confused: string): string {
    return `${target}|${confused}`;
  }

  /** Record a confusion: player chose wrongFactId when correctFactId was the answer. */
  recordConfusion(targetFactId: string, confusedFactId: string): void {
    const k = ConfusionMatrix.key(targetFactId, confusedFactId);
    const existing = this.entries.get(k);
    if (existing) {
      existing.count++;
      existing.lastOccurred = Date.now();
    } else {
      this.entries.set(k, {
        targetFactId,
        confusedFactId,
        count: 1,
        lastOccurred: Date.now(),
      });
      // Prune after inserting a new entry if we've exceeded the cap
      if (this.entries.size > ConfusionMatrix.MAX_ENTRIES) {
        this.pruneOldestOrStalest();
      }
    }
  }

  /**
   * Remove one entry to bring the map back within MAX_ENTRIES.
   * Preference order:
   *   1. Lowest count among entries older than 90 days (stale and rarely confused)
   *   2. If none qualify, the entry with the oldest lastOccurred timestamp
   */
  private pruneOldestOrStalest(): void {
    const staleThreshold = Date.now() - ConfusionMatrix.STALE_AGE_MS;

    let bestStaleKey: string | null = null;
    let bestStaleCount = Infinity;

    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.entries) {
      // Track the absolute oldest regardless
      if (entry.lastOccurred < oldestTimestamp) {
        oldestTimestamp = entry.lastOccurred;
        oldestKey = key;
      }
      // Track the lowest-count stale entry
      if (entry.lastOccurred < staleThreshold) {
        if (entry.count < bestStaleCount) {
          bestStaleCount = entry.count;
          bestStaleKey = key;
        }
      }
    }

    const keyToRemove = bestStaleKey ?? oldestKey;
    if (keyToRemove !== null) {
      this.entries.delete(keyToRemove);
    }
  }

  /** Get all confusions where targetFactId was the correct answer. */
  getConfusionsFor(targetFactId: string): ConfusionEntry[] {
    const result: ConfusionEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.targetFactId === targetFactId) {
        result.push(entry);
      }
    }
    return result;
  }

  /** Get reverse confusions: times THIS fact was chosen wrongly for OTHER facts. */
  getReverseConfusionsFor(factId: string): ConfusionEntry[] {
    const result: ConfusionEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.confusedFactId === factId) {
        result.push(entry);
      }
    }
    return result;
  }

  /** Get the confusion score between two specific facts (0 if never confused). */
  getConfusionScore(factA: string, factB: string): number {
    const forward = this.entries.get(ConfusionMatrix.key(factA, factB));
    const reverse = this.entries.get(ConfusionMatrix.key(factB, factA));
    return (forward?.count ?? 0) + (reverse?.count ?? 0);
  }

  /** Serialize for player save persistence. */
  toJSON(): ConfusionEntry[] {
    return Array.from(this.entries.values());
  }

  /** Restore from player save data. */
  static fromJSON(data: ConfusionEntry[]): ConfusionMatrix {
    const matrix = new ConfusionMatrix();
    if (!Array.isArray(data)) return matrix;
    for (const entry of data) {
      if (entry.targetFactId && entry.confusedFactId && typeof entry.count === 'number') {
        const k = ConfusionMatrix.key(entry.targetFactId, entry.confusedFactId);
        matrix.entries.set(k, { ...entry });
      }
    }
    return matrix;
  }

  /** Get total number of confusion entries. */
  get size(): number {
    return this.entries.size;
  }
}
