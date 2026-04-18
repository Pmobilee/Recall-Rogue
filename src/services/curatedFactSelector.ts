import type { DeckFact } from '../data/curatedDeckTypes';
import type { InRunFactTracker } from './inRunFactTracker';

export interface FactSelectionResult {
  fact: DeckFact;
  selectionReason: 'struggling' | 'unseen' | 'moderate' | 'known' | 'random';
}

/**
 * Seeded random — deterministic given the same seed.
 * Uses a simple xorshift32 for speed.
 */
function seededRandom(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

/**
 * Anki-style four-priority fact selection for curated deck charges.
 *
 * Priorities, served in order:
 * 0. Forced new card introduction — every NEW_CARD_INTERVAL (3) charges without a new
 *    card being served, a new card is force-introduced if one is available and the
 *    learning queue permits it (canIntroduceNew). This prevents learning/review cards
 *    from starving new card introduction.
 * 1. Due learning cards — cards in the learning state whose timer has expired.
 *    These are time-critical (like Anki's learning queue) and always served first
 *    unless a forced new card introduction is triggered.
 * 2. Intersperser of due graduated reviews + new cards — proportional mixing
 *    (Anki Intersperser). New cards only introduced when learning queue is below
 *    MAX_LEARNING (8). Due reviews take the remaining share proportionally.
 * 3. Ahead learning — cards in learning whose timer has NOT yet expired, served
 *    only when nothing else is available (rare edge case at small pool sizes).
 * Fallback: any card not in the recent-fact cooldown window.
 *
 * **Dedup rule:** A rolling window of RECENT_FACT_WINDOW (3) fact IDs is maintained.
 * Any fact in this window is excluded from selection (unless the pool is smaller than
 * the window + 1, in which case only the immediately previous fact is excluded to
 * prevent starvation). Priority 1 (due learning cards) retains the single-fact
 * lastFactId exclusion — step delays ([4, 10] charges) already provide adequate spacing
 * for learning cards, and blocking a time-critical card from serving could delay its review.
 *
 * @param factPool - Chain theme subset (knowledge decks) or full pool (vocabulary decks)
 * @param tracker - In-run fact tracker (Anki learning step state machine)
 * @param cardMasteryLevel - Current card slot mastery (0-5) — reserved for future use
 * @param runSeed - Deterministic seed for random selection
 * @returns Selected fact and reason
 */
export function selectFactForCharge(
  factPool: DeckFact[],
  tracker: InRunFactTracker,
  cardMasteryLevel: number,
  runSeed: number,
): FactSelectionResult {
  const rand = seededRandom(runSeed + tracker.getTotalCharges() + tracker.getAndIncrementChargeCount());
  const lastFactId = tracker.getLastFactId();
  const recentFactIds = new Set(tracker.getRecentFactIds());

  // For pools smaller than the window + 1, fall back to single-fact exclusion to prevent starvation.
  // Example: a 3-fact pool with a 3-entry window would exclude all facts if one was just shown.
  const useFullWindow = factPool.length > recentFactIds.size + 1;
  const shouldExclude = useFullWindow
    ? (factId: string) => recentFactIds.has(factId)
    : (factId: string) => factId === lastFactId;

  // === PRIORITY 0: Forced new card introduction (Anki-style even spacing) ===
  // Every NEW_CARD_INTERVAL charges, introduce a new card if available.
  // This prevents learning/review cards from starving new card introduction.
  if (tracker.shouldForceNewCard() && tracker.canIntroduceNew()) {
    const forcedNew = factPool.filter(f =>
      !shouldExclude(f.id) &&
      !tracker.isInLearning(f.id) &&
      !tracker.isGraduated(f.id)
    );
    // Fisher-Yates shuffle for true randomization, then stable sort by difficulty.
    // Avoids the rand()-0.5 tiebreaker bias that favors earlier (larger-deck) elements
    // in custom deck runs where the fact pool is built by concatenation.
    for (let i = forcedNew.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [forcedNew[i], forcedNew[j]] = [forcedNew[j], forcedNew[i]];
    }
    forcedNew.sort((a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3));
    if (forcedNew.length > 0) {
      tracker.recordNewCardServed();
      return { fact: forcedNew[0], selectionReason: 'unseen' };
    }
  }

  // === PRIORITY 1: Due learning cards (Anki: learning cards are time-critical) ===
  // Use single-fact exclusion (lastFactId only) for due learning cards — step delays
  // ([4, 10] charges) already provide adequate spacing, and blocking a time-critical
  // card from serving could delay an important review.
  const dueLearning = tracker.getDueLearningCards()
    .filter(id => id !== lastFactId)
    .map(id => factPool.find(f => f.id === id))
    .filter((f): f is DeckFact => f !== undefined);

  if (dueLearning.length > 0) {
    return {
      fact: dueLearning[Math.floor(rand() * dueLearning.length)],
      selectionReason: 'struggling',
    };
  }

  // === PRIORITY 2: Main queue — Intersperser of due reviews + new cards ===
  const dueReviews: DeckFact[] = [];
  const newCards: DeckFact[] = [];

  for (const fact of factPool) {
    if (shouldExclude(fact.id)) continue;

    if (tracker.isGraduated(fact.id)) {
      // Only include if due for review
      if (tracker.isGraduatedAndDue(fact.id)) {
        dueReviews.push(fact);
      }
    } else if (tracker.isInLearning(fact.id)) {
      // In learning but not due — skip (handled in priority 1 when due)
    } else {
      // NEW card — only include if we can accept more learning cards
      if (tracker.canIntroduceNew()) {
        newCards.push(fact);
      }
    }
  }

  // Fisher-Yates shuffle first, then stable sort by difficulty (ascending).
  // Easier facts are introduced first, matching the DECKBUILDER spec:
  // "At mastery 0, the system prefers to select easier facts."
  // Fisher-Yates before sort avoids the rand()-0.5 tiebreaker bias that
  // favors earlier (larger-deck) elements in interleaved custom deck runs.
  for (let i = newCards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
  }
  newCards.sort((a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3));

  // Anki Intersperser: proportional mixing
  if (dueReviews.length > 0 && newCards.length > 0) {
    const reviewProb = dueReviews.length / (dueReviews.length + newCards.length);
    if (rand() < reviewProb) {
      return { fact: dueReviews[Math.floor(rand() * dueReviews.length)], selectionReason: 'moderate' };
    } else {
      tracker.recordNewCardServed();
      return { fact: newCards[0], selectionReason: 'unseen' };
    }
  }

  if (dueReviews.length > 0) {
    return { fact: dueReviews[Math.floor(rand() * dueReviews.length)], selectionReason: 'moderate' };
  }

  if (newCards.length > 0) {
    tracker.recordNewCardServed();
    return { fact: newCards[0], selectionReason: 'unseen' };
  }

  // === PRIORITY 3: Ahead learning (not yet due, but nothing else available) ===
  const aheadLearning = factPool.filter(f =>
    !shouldExclude(f.id) && tracker.isInLearning(f.id) && !tracker.getDueLearningCards().includes(f.id)
  );

  if (aheadLearning.length > 0) {
    return { fact: aheadLearning[Math.floor(rand() * aheadLearning.length)], selectionReason: 'struggling' };
  }

  // === FALLBACK: anything not in the recent-fact cooldown window ===
  const any = factPool.filter(f => !shouldExclude(f.id));
  return {
    fact: any.length > 0 ? any[Math.floor(rand() * any.length)] : factPool[0],
    selectionReason: 'random',
  };
}
