/**
 * wowFactorService — resolves the "wow factor" text for a fact that was
 * successfully answered in the quiz.
 *
 * Extracted from CardCombatOverlay.svelte to make the lookup a pure function
 * that is independently testable without a Svelte runtime.
 *
 * Source files: src/services/wowFactorService.ts
 *
 * ## Why this exists (Issue 8)
 * The old call-site read `card.__studyFactId` — a mutable property patched onto
 * the card object at quiz-build time. In study mode the quizzed fact is chosen
 * dynamically (not from `card.factId`) and the assignment happens inside
 * `getStudyModeQuiz`. If the player commits a second card's quiz before the
 * first card's correct-answer handler runs, `__studyFactId` can be stale.
 *
 * The fix: `committedQuizData` captures the actual fact ID (`factId` field) at
 * commit time. This service accepts that authoritative ID instead of reading
 * off the mutable card property.
 */

import { factsDB } from './factsDB';
import { getCuratedDeckFact } from '../data/curatedDeckStore';
import type { DeckMode } from '../data/studyPreset';

/**
 * Minimal RunState shape required by this service.
 * We use a structural type to avoid importing the full RunState.
 */
export interface WowFactorRunContext {
  deckMode?: DeckMode;
  factSourceDeckMap?: Record<string, string>;
}

/**
 * Resolve the wow-factor text for a fact that was displayed to the player.
 *
 * @param answeredFactId - The fact ID from `committedQuizData.factId` (the
 *   authoritative, committed quiz). Never read off the mutable card object.
 * @param cardTier - The card's tier string. Only tier-1 cards show wow factor.
 * @param runContext - Minimal run state (deckMode + factSourceDeckMap). Pass
 *   the active RunState; only the fields above are read.
 * @returns The wow-factor/explanation string, or null if unavailable.
 */
export function resolveWowFactorText(
  answeredFactId: string | null | undefined,
  cardTier: string,
  runContext: WowFactorRunContext | null | undefined,
): string | null {
  // Only tier-1 cards show wow factor.
  if (cardTier !== '1') return null;
  if (!answeredFactId) return null;

  const deckMode = runContext?.deckMode;

  if (deckMode?.type === 'study') {
    // Study mode: look up the curated deck fact for wowFactor / explanation.
    if (deckMode.deckId) {
      const deckFact = getCuratedDeckFact(deckMode.deckId, answeredFactId);
      // DeckFact does not officially carry wowFactor (not in curatedDeckTypes.ts),
      // but some curated facts include it as a runtime-only field. Fall back to
      // explanation, which is always present.
      return (deckFact as unknown as Record<string, unknown>)?.wowFactor as string | null
        ?? deckFact?.explanation
        ?? null;
    }
    return null;
  }

  if (deckMode?.type === 'custom_deck') {
    // Custom deck: resolve the source deck for this fact using factSourceDeckMap,
    // then look up the fact.
    const factSourceDeckMap = runContext?.factSourceDeckMap;
    const sourceDeckId = factSourceDeckMap?.[answeredFactId];
    if (sourceDeckId) {
      const deckFact = getCuratedDeckFact(sourceDeckId, answeredFactId);
      return (deckFact as unknown as Record<string, unknown>)?.wowFactor as string | null
        ?? deckFact?.explanation
        ?? null;
    }
    // Fallback: try each item's deck in order (slower, but safe).
    for (const item of deckMode.items) {
      const deckFact = getCuratedDeckFact(item.deckId, answeredFactId);
      if (deckFact) {
        return (deckFact as unknown as Record<string, unknown>)?.wowFactor as string | null
          ?? deckFact?.explanation
          ?? null;
      }
    }
    return null;
  }

  if (deckMode?.type === 'study-multi') {
    // Multi-source mode: curated deck facts resolve the same way as custom_deck.
    // Trivia-domain facts resolve from factsDB (handled by the guard at top).
    const factSourceDeckMap = runContext?.factSourceDeckMap;
    const sourceDeckId = factSourceDeckMap?.[answeredFactId];
    if (sourceDeckId) {
      const deckFact = getCuratedDeckFact(sourceDeckId, answeredFactId);
      return (deckFact as unknown as Record<string, unknown>)?.wowFactor as string | null
        ?? deckFact?.explanation
        ?? null;
    }
    // Fallback: try each deck entry in order.
    for (const entry of deckMode.decks) {
      const deckFact = getCuratedDeckFact(entry.deckId, answeredFactId);
      if (deckFact) {
        return (deckFact as unknown as Record<string, unknown>)?.wowFactor as string | null
          ?? deckFact?.explanation
          ?? null;
      }
    }
    // May be a trivia-domain fact — fall through to factsDB below.
  }

  // Trivia / general mode: look up in the facts DB.
  if (!factsDB.isReady()) return null;
  const fact = factsDB.getById(answeredFactId);
  return fact?.wowFactor ?? null;
}
