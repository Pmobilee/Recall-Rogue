import { get } from 'svelte/store';
import { playerSave } from '../ui/stores/playerData';
import { getDeckFactIds, getSubDeckFactIds } from '../data/deckFactIndex';
import { getAllDecks } from '../data/deckRegistry';
import type { ReviewState } from '../data/types';

/** Mastery threshold: stability >= 21 days (3 weeks). */
const MASTERY_STABILITY_DAYS = 21;

/** Progress summary for a deck. */
export interface DeckProgress {
  deckId: string;
  totalFacts: number;
  factsEncountered: number;
  factsMastered: number;
  averageStability: number;
  progressPercent: number;
}

/** Progress summary for a sub-deck. */
export interface SubDeckProgress {
  subDeckId: string;
  parentDeckId: string;
  totalFacts: number;
  factsEncountered: number;
  factsMastered: number;
  progressPercent: number;
}

/** Compute progress for a deck based on global FSRS state. */
export function getDeckProgress(deckId: string): DeckProgress {
  const factIds = getDeckFactIds(deckId);
  return computeProgress(deckId, factIds);
}

/** Compute progress for a specific sub-deck. */
export function getSubDeckProgress(deckId: string, subDeckId: string): SubDeckProgress {
  const factIds = getSubDeckFactIds(deckId, subDeckId);
  const progress = computeProgress(deckId, factIds);
  return {
    subDeckId,
    parentDeckId: deckId,
    totalFacts: progress.totalFacts,
    factsEncountered: progress.factsEncountered,
    factsMastered: progress.factsMastered,
    progressPercent: progress.progressPercent,
  };
}

/** Compute progress for all registered decks. */
export function getAllDeckProgress(): Map<string, DeckProgress> {
  const result = new Map<string, DeckProgress>();
  for (const deck of getAllDecks()) {
    result.set(deck.id, getDeckProgress(deck.id));
  }
  return result;
}

function computeProgress(deckId: string, factIds: string[]): DeckProgress {
  const save = get(playerSave);
  const reviewStates: ReviewState[] = save?.reviewStates ?? [];
  const reviewMap = new Map<string, ReviewState>();
  for (const rs of reviewStates) {
    reviewMap.set(rs.factId, rs);
  }

  let encountered = 0;
  let mastered = 0;
  let totalStability = 0;

  for (const fid of factIds) {
    const rs = reviewMap.get(fid);
    if (rs) {
      encountered++;
      const stability = rs.stability ?? 0;
      totalStability += stability;
      if (stability >= MASTERY_STABILITY_DAYS) {
        mastered++;
      }
    }
  }

  const total = factIds.length;
  return {
    deckId,
    totalFacts: total,
    factsEncountered: encountered,
    factsMastered: mastered,
    averageStability: encountered > 0 ? totalStability / encountered : 0,
    progressPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
  };
}
