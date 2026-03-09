import type { Fact, ReviewState } from '../data/types';
import type { Card, CardType, FactDomain } from '../data/card-types';
import { factsDB } from './factsDB';
import { createCard, resetCardIdCounter } from './cardFactory';
import { DEFAULT_POOL_SIZE, POOL_PRIMARY_PCT, POOL_SECONDARY_PCT } from '../data/balance';
import { MECHANICS_BY_TYPE, type MechanicDefinition } from '../data/mechanics';

const DOMAIN_TO_CATEGORY: Record<FactDomain, string[]> = {
  science: ['Natural Sciences'],
  history: ['History'],
  geography: ['Geography'],
  language: ['Language'],
  math: ['Natural Sciences'],
  arts: ['Culture'],
  medicine: ['Life Sciences'],
  technology: ['Technology'],
};

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickMechanic(
  cardType: CardType,
  mechanicCounts: Map<string, number>,
): MechanicDefinition {
  const pool = MECHANICS_BY_TYPE[cardType];
  const eligible = pool.filter((mechanic) => {
    if (mechanic.maxPerPool <= 0) return true;
    return (mechanicCounts.get(mechanic.id) ?? 0) < mechanic.maxPerPool;
  });

  const source = eligible.length > 0 ? eligible : pool;
  const selected = source[Math.floor(Math.random() * source.length)];
  mechanicCounts.set(selected.id, (mechanicCounts.get(selected.id) ?? 0) + 1);
  return selected;
}

function applyMechanics(cards: Card[]): Card[] {
  const mechanicCounts = new Map<string, number>();
  return cards.map((card) => {
    const mechanic = pickMechanic(card.cardType, mechanicCounts);
    return {
      ...card,
      mechanicId: mechanic.id,
      mechanicName: mechanic.name,
      apCost: mechanic.apCost,
      baseEffectValue: mechanic.baseValue,
      originalBaseEffectValue: mechanic.baseValue,
    };
  });
}

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

  const stateByFactId = new Map<string, ReviewState>();
  for (const state of allReviewStates) stateByFactId.set(state.factId, state);

  function getFactsForDomain(domain: FactDomain, limit: number): Fact[] {
    return factsDB.getByCategory(DOMAIN_TO_CATEGORY[domain] ?? [], limit);
  }

  function factsToCards(facts: Fact[]): Card[] {
    return facts.map((fact) => createCard(fact, stateByFactId.get(fact.id)));
  }

  const primaryFacts = getFactsForDomain(primaryDomain, primaryTarget);
  const usedFactIds = new Set(primaryFacts.map((fact) => fact.id));
  const primaryCards = factsToCards(primaryFacts);

  const secondaryFacts = getFactsForDomain(secondaryDomain, secondaryTarget + 20)
    .filter((fact) => !usedFactIds.has(fact.id))
    .slice(0, secondaryTarget);
  for (const fact of secondaryFacts) usedFactIds.add(fact.id);
  const secondaryCards = factsToCards(secondaryFacts);

  const reviewCandidates = allReviewStates
    .filter((state) => !usedFactIds.has(state.factId))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, reviewTarget + 20);

  const reviewCards: Card[] = [];
  for (const state of reviewCandidates) {
    if (reviewCards.length >= reviewTarget) break;
    const fact = factsDB.getById(state.factId);
    if (!fact || usedFactIds.has(fact.id)) continue;
    reviewCards.push(createCard(fact, state));
    usedFactIds.add(fact.id);
  }

  let pool = [...primaryCards, ...secondaryCards, ...reviewCards];

  if (pool.length < poolSize) {
    const shortage = poolSize - pool.length;
    const fillerFacts = factsDB.getRandom(shortage + 20)
      .filter((fact) => !usedFactIds.has(fact.id))
      .slice(0, shortage);
    pool.push(...factsToCards(fillerFacts));
  }

  pool = pool.slice(0, poolSize);
  pool = pool.filter((card) => card.tier !== '3');
  pool = applyMechanics(pool);

  return shuffle(pool);
}
