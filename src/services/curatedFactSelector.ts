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
 * Anki-style three-priority fact selection for curated deck charges.
 *
 * Priorities, served in order:
 * 1. Due learning cards — cards in the learning state whose timer has expired.
 *    These are time-critical (like Anki's learning queue) and always served first.
 * 2. Intersperser of due graduated reviews + new cards — proportional mixing
 *    (Anki Intersperser). New cards only introduced when learning queue is below
 *    MAX_LEARNING (8). Due reviews take the remaining share proportionally.
 * 3. Ahead learning — cards in learning whose timer has NOT yet expired, served
 *    only when nothing else is available (rare edge case at small pool sizes).
 * Fallback: any card except the immediately previous fact (prevents all repetition).
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

  // === PRIORITY 1: Due learning cards (Anki: learning cards are time-critical) ===
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
    if (fact.id === lastFactId) continue;

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

  // Shuffle new cards so we don't always introduce in file order
  // (Anki: "Random" new card gather order is the default)
  for (let i = newCards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
  }

  // Anki Intersperser: proportional mixing
  if (dueReviews.length > 0 && newCards.length > 0) {
    const reviewProb = dueReviews.length / (dueReviews.length + newCards.length);
    if (rand() < reviewProb) {
      return { fact: dueReviews[Math.floor(rand() * dueReviews.length)], selectionReason: 'moderate' };
    } else {
      return { fact: newCards[Math.floor(rand() * newCards.length)], selectionReason: 'unseen' };
    }
  }

  if (dueReviews.length > 0) {
    return { fact: dueReviews[Math.floor(rand() * dueReviews.length)], selectionReason: 'moderate' };
  }

  if (newCards.length > 0) {
    return { fact: newCards[Math.floor(rand() * newCards.length)], selectionReason: 'unseen' };
  }

  // === PRIORITY 3: Ahead learning (not yet due, but nothing else available) ===
  const aheadLearning = factPool.filter(f =>
    f.id !== lastFactId && tracker.isInLearning(f.id) && !tracker.getDueLearningCards().includes(f.id)
  );

  if (aheadLearning.length > 0) {
    return { fact: aheadLearning[Math.floor(rand() * aheadLearning.length)], selectionReason: 'struggling' };
  }

  // === FALLBACK: anything except last fact ===
  const any = factPool.filter(f => f.id !== lastFactId);
  return {
    fact: any.length > 0 ? any[Math.floor(rand() * any.length)] : factPool[0],
    selectionReason: 'random',
  };
}
