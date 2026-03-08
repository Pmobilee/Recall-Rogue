import type { Fact, ReviewState } from '../data/types';
import type { Card, FactDomain } from '../data/card-types';
import { factsDB } from './factsDB';
import { createCard, resetCardIdCounter } from './cardFactory';
import { resolveDomain } from './domainResolver';
import { DEFAULT_POOL_SIZE, POOL_PRIMARY_PCT, POOL_SECONDARY_PCT, POOL_REVIEW_PCT } from '../data/balance';
import { isDue } from './sm2';

/** Maps a FactDomain back to the top-level category string used in factsDB. */
const DOMAIN_TO_CATEGORY: Record<FactDomain, string[]> = {
  science:    ['Natural Sciences'],
  history:    ['History'],
  geography:  ['Geography'],
  language:   ['Language'],
  math:       ['Natural Sciences'],   // Math facts are filed under Natural Sciences currently
  arts:       ['Culture'],
  medicine:   ['Life Sciences'],
  technology: ['Technology'],
};

/**
 * Shuffles an array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Builds the initial card pool for a run.
 *
 * Composition:
 *   - 40% from the primary domain
 *   - 30% from the secondary domain
 *   - 30% from the SM-2 review queue (due or near-due cards across all domains)
 *
 * If a domain doesn't have enough facts to fill its allocation, the shortfall
 * is redistributed to the review pool, then to the other domain, then filled
 * with random facts as a last resort.
 *
 * @param primaryDomain - The player's chosen primary knowledge domain.
 * @param secondaryDomain - The player's chosen secondary knowledge domain.
 * @param allReviewStates - All of the player's SM-2 review states.
 * @param options.poolSize - Target pool size (default 120).
 * @returns A shuffled array of Card objects ready for deck construction.
 */
export function buildRunPool(
  primaryDomain: FactDomain,
  secondaryDomain: FactDomain,
  allReviewStates: ReviewState[],
  options?: { poolSize?: number },
): Card[] {
  const poolSize = options?.poolSize ?? DEFAULT_POOL_SIZE;
  resetCardIdCounter();

  const primaryTarget = Math.round(poolSize * POOL_PRIMARY_PCT);
  const secondaryTarget = Math.round(poolSize * POOL_SECONDARY_PCT);
  const reviewTarget = poolSize - primaryTarget - secondaryTarget;

  // Build a review state lookup by factId
  const stateByFactId = new Map<string, ReviewState>();
  for (const rs of allReviewStates) {
    stateByFactId.set(rs.factId, rs);
  }

  // Helper: get facts for a domain
  function getFactsForDomain(domain: FactDomain, limit: number): Fact[] {
    const categories = DOMAIN_TO_CATEGORY[domain] ?? [];
    return factsDB.getByCategory(categories, limit);
  }

  // Helper: convert facts to cards
  function factsToCards(facts: Fact[]): Card[] {
    return facts.map(f => createCard(f, stateByFactId.get(f.id)));
  }

  // 1. Primary domain cards
  const primaryFacts = getFactsForDomain(primaryDomain, primaryTarget);
  const primaryCards = factsToCards(primaryFacts);
  const usedFactIds = new Set(primaryFacts.map(f => f.id));

  // 2. Secondary domain cards (exclude already-used facts)
  const secondaryFacts = getFactsForDomain(secondaryDomain, secondaryTarget + 20)
    .filter(f => !usedFactIds.has(f.id))
    .slice(0, secondaryTarget);
  const secondaryCards = factsToCards(secondaryFacts);
  for (const f of secondaryFacts) usedFactIds.add(f.id);

  // 3. Review queue cards (due or near-due, any domain, excluding already-used)
  const reviewCandidates = allReviewStates
    .filter(rs => !usedFactIds.has(rs.factId))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt) // most overdue first
    .slice(0, reviewTarget + 20);

  const reviewCards: Card[] = [];
  for (const rs of reviewCandidates) {
    if (reviewCards.length >= reviewTarget) break;
    const fact = factsDB.getById(rs.factId);
    if (fact && !usedFactIds.has(fact.id)) {
      reviewCards.push(createCard(fact, rs));
      usedFactIds.add(fact.id);
    }
  }

  // 4. Combine and check for shortfall
  let pool = [...primaryCards, ...secondaryCards, ...reviewCards];

  // If under target, fill with random facts not already in pool
  if (pool.length < poolSize) {
    const shortage = poolSize - pool.length;
    const fillerFacts = factsDB.getRandom(shortage + 20)
      .filter(f => !usedFactIds.has(f.id))
      .slice(0, shortage);
    pool.push(...factsToCards(fillerFacts));
  }

  // Trim to exact pool size (in case of rounding overshoot)
  pool = pool.slice(0, poolSize);

  return shuffle(pool);
}
