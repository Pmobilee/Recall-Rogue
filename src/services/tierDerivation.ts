import type { CardTier } from '../data/card-types';

export interface TierStateLike {
  stability?: number;
  consecutiveCorrect?: number;
  passedMasteryTrial?: boolean;
}

function normalizeState(state: TierStateLike | undefined): Required<TierStateLike> {
  return {
    stability: state?.stability ?? 0,
    consecutiveCorrect: state?.consecutiveCorrect ?? 0,
    passedMasteryTrial: state?.passedMasteryTrial ?? false,
  };
}

export function getCardTier(state: TierStateLike | undefined): CardTier {
  const normalized = normalizeState(state);
  if (normalized.stability >= 30 && normalized.consecutiveCorrect >= 7 && normalized.passedMasteryTrial) return '3';
  if (normalized.stability >= 15 && normalized.consecutiveCorrect >= 5) return '2b';
  if (normalized.stability >= 5 && normalized.consecutiveCorrect >= 3) return '2a';
  return '1';
}

export function qualifiesForMasteryTrial(state: TierStateLike | undefined): boolean {
  const normalized = normalizeState(state);
  return (
    getCardTier(normalized) === '2b' &&
    normalized.stability >= 30 &&
    normalized.consecutiveCorrect >= 7 &&
    !normalized.passedMasteryTrial
  );
}

