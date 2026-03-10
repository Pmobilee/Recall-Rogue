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

/** Returns the player-facing tier display name (never exposes 2a/2b). */
export function getTierDisplayName(tier: CardTier | 'unseen'): string {
  if (tier === '1') return 'Learning';
  if (tier === '2a' || tier === '2b') return 'Proven';
  if (tier === '3') return 'Mastered';
  if (tier === 'unseen') return 'Unseen';
  return 'Unknown';
}

/** Returns the display tier class for visual styling (bronze/silver/gold). */
export function getDisplayTier(tier: CardTier): 'bronze' | 'silver' | 'gold' {
  if (tier === '1') return 'bronze';
  if (tier === '2a' || tier === '2b') return 'silver';
  if (tier === '3') return 'gold';
  return 'bronze';
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

