import type { Fact, ReviewState } from '../data/types';
import type { Card, CardType, FactDomain } from '../data/card-types';
import { factsDB } from './factsDB';
import { createCard, resetCardIdCounter } from './cardFactory';
import { DEFAULT_POOL_SIZE, POOL_PRIMARY_PCT, POOL_SECONDARY_PCT } from '../data/balance';
import { MECHANICS_BY_TYPE, type MechanicDefinition } from '../data/mechanics';
import { assignTypesToCards } from './cardTypeAllocator';

const DOMAIN_TO_CATEGORY: Record<FactDomain, string[]> = {
  general_knowledge: ['General Knowledge', 'Technology', 'Mathematics', 'Math'],
  natural_sciences: ['Natural Sciences', 'Science'],
  space_astronomy: ['Space & Astronomy'],
  history: ['History'],
  geography: ['Geography'],
  language: ['Language'],
  mythology_folklore: ['Mythology & Folklore'],
  animals_wildlife: ['Animals & Wildlife'],
  human_body_health: ['Human Body & Health', 'Life Sciences', 'Medicine', 'Health'],
  food_cuisine: ['Food & World Cuisine'],
  art_architecture: ['Art & Architecture', 'Culture', 'Arts'],
  // Legacy IDs kept for save compatibility.
  science: ['Natural Sciences', 'Science'],
  math: ['General Knowledge', 'Mathematics', 'Math'],
  arts: ['Art & Architecture', 'Culture', 'Arts'],
  medicine: ['Human Body & Health', 'Life Sciences', 'Medicine', 'Health'],
  technology: ['General Knowledge', 'Technology'],
};

const FALLBACK_DOMAIN_ORDER: FactDomain[] = [
  'general_knowledge',
  'natural_sciences',
  'history',
  'geography',
  'language',
];

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Weighted shuffle: items with higher weights are more likely to appear earlier. */
function weightedShuffle<T extends { _weight: number }>(items: T[], count: number): T[] {
  const result: T[] = [];
  const pool = [...items];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, item) => sum + item._weight, 0);
    let roll = Math.random() * totalWeight;
    let picked = 0;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j]._weight;
      if (roll <= 0) { picked = j; break; }
    }
    result.push(pool.splice(picked, 1)[0]);
  }
  return result;
}

const RECENT_FACTS_KEY = 'recall-rogue-recent-facts';
const MAX_RECENT_RUNS = 2;

/** Get fact IDs from the last N runs */
function getRecentFactIds(): Set<string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RECENT_FACTS_KEY) : null;
    if (!raw) return new Set();
    const runs: string[][] = JSON.parse(raw);
    return new Set(runs.flat());
  } catch { return new Set(); }
}

/** Record fact IDs from the completed run */
export function recordRunFacts(factIds: string[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(RECENT_FACTS_KEY);
    const runs: string[][] = raw ? JSON.parse(raw) : [];
    runs.unshift(factIds);
    while (runs.length > MAX_RECENT_RUNS) runs.pop();
    localStorage.setItem(RECENT_FACTS_KEY, JSON.stringify(runs));
  } catch { /* localStorage unavailable */ }
}

/**
 * Stratified sampling by difficulty.
 * Targets: easy (1-2) ~30%, medium (3) ~45%, hard (4-5) ~25%.
 * Shortfalls backfill from medium first, then any remaining bucket.
 */
function stratifiedSample(facts: Fact[], target: number): Fact[] {
  const recentIds = getRecentFactIds();
  // Partition each bucket: non-recent (shuffled) first, then recent (shuffled) — so slicing prefers fresh facts
  const deprioritize = (arr: Fact[]) => {
    const fresh = shuffle(arr.filter(f => !recentIds.has(f.id)));
    const recent = shuffle(arr.filter(f => recentIds.has(f.id)));
    return [...fresh, ...recent];
  };
  const easy = deprioritize(facts.filter(f => (f.difficulty ?? 3) <= 2));
  const medium = deprioritize(facts.filter(f => (f.difficulty ?? 3) === 3));
  const hard = deprioritize(facts.filter(f => (f.difficulty ?? 3) >= 4));

  const easyTarget = Math.round(target * 0.30);
  const hardTarget = Math.round(target * 0.25);
  const mediumTarget = target - easyTarget - hardTarget;

  const selected: Fact[] = [];
  const addedIds = new Set<string>();

  const take = (source: Fact[], count: number) => {
    let taken = 0;
    for (const f of source) {
      if (taken >= count) break;
      if (addedIds.has(f.id)) continue;
      selected.push(f);
      addedIds.add(f.id);
      taken++;
    }
    return taken;
  };

  // Take from each bucket
  take(easy, easyTarget);
  take(medium, mediumTarget);
  take(hard, hardTarget);

  // Backfill shortfalls: prefer medium, then easy, then hard
  const remaining = target - selected.length;
  if (remaining > 0) {
    take(medium, remaining);
    take(easy, remaining);
    take(hard, remaining);
  }

  return selected.slice(0, target);
}

function pickRandomSubset<T>(items: T[], count: number): T[] {
  return shuffle([...items]).slice(0, Math.max(0, count));
}

function buildProbeOrdering(cards: Card[], domain: FactDomain): Card[] {
  const domainCards = cards.filter((card) => card.domain === domain);
  if (domainCards.length === 0) return [];

  const easy: Card[] = [];
  const medium: Card[] = [];
  const hard: Card[] = [];

  for (const card of domainCards) {
    const fact = factsDB.getById(card.factId);
    const difficulty = fact?.difficulty ?? 3;
    if (difficulty <= 2) easy.push(card);
    else if (difficulty >= 4) hard.push(card);
    else medium.push(card);
  }

  const probe = [
    ...pickRandomSubset(easy, 3),
    ...pickRandomSubset(medium, 3),
    ...pickRandomSubset(hard, 3),
  ];

  const used = new Set(probe.map((card) => card.id));
  const wildcardCandidates = domainCards.filter((card) => !used.has(card.id));
  const wildcard = pickRandomSubset(wildcardCandidates, 1);
  return [...probe, ...wildcard].slice(0, 10);
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
  options?: { poolSize?: number; probeRunNumber?: number; probeDomain?: FactDomain },
): Card[] {
  const poolSize = options?.poolSize ?? DEFAULT_POOL_SIZE;
  resetCardIdCounter();

  const primaryTarget = Math.round(poolSize * POOL_PRIMARY_PCT);
  const secondaryTarget = Math.round(poolSize * POOL_SECONDARY_PCT);
  const reviewTarget = poolSize - primaryTarget - secondaryTarget;

  const stateByFactId = new Map<string, ReviewState>();
  for (const state of allReviewStates) stateByFactId.set(state.factId, state);

  function normalizeDomain(domain: FactDomain): FactDomain {
    if (DOMAIN_TO_CATEGORY[domain]) return domain;
    return 'general_knowledge';
  }

  function collectDomainFacts(domain: FactDomain, limit: number, excludedFactIds: Set<string>): Fact[] {
    const normalized = normalizeDomain(domain);
    const categories = DOMAIN_TO_CATEGORY[normalized] ?? DOMAIN_TO_CATEGORY.general_knowledge;
    const selected: Fact[] = [];
    const addedIds = new Set<string>();

    const pushUnique = (fact: Fact) => {
      if (excludedFactIds.has(fact.id) || addedIds.has(fact.id)) return;
      selected.push(fact);
      addedIds.add(fact.id);
    };

    const categoryFacts = factsDB.getByCategory(categories, limit * 3)
      .filter(f => !excludedFactIds.has(f.id));
    const stratified = stratifiedSample(categoryFacts, limit);
    for (const fact of stratified) {
      pushUnique(fact);
    }

    if (selected.length >= limit) return selected.slice(0, limit);

    const fallbackDomains = FALLBACK_DOMAIN_ORDER
      .filter((candidate) => candidate !== normalized)
      .map((candidate) => DOMAIN_TO_CATEGORY[candidate] ?? []);

    for (const fallbackCategories of fallbackDomains) {
      const needed = limit - selected.length;
      if (needed <= 0) break;
      for (const fact of factsDB.getByCategory(fallbackCategories, needed + 30)) {
        if (selected.length >= limit) break;
        pushUnique(fact);
      }
    }

    return selected.slice(0, limit);
  }

  function factsToCards(facts: Fact[]): Card[] {
    return facts.map((fact) => createCard(fact, stateByFactId.get(fact.id)));
  }

  const primaryFacts = collectDomainFacts(primaryDomain, primaryTarget, new Set<string>());
  const usedFactIds = new Set(primaryFacts.map((fact) => fact.id));
  const primaryCards = factsToCards(primaryFacts);

  const secondaryFacts = collectDomainFacts(secondaryDomain, secondaryTarget, usedFactIds)
    .slice(0, secondaryTarget);
  for (const fact of secondaryFacts) usedFactIds.add(fact.id);
  const secondaryCards = factsToCards(secondaryFacts);

  const now = Date.now();
  const DAY_MS = 86_400_000;
  const WEEK_MS = 7 * DAY_MS;

  const reviewCandidatesRaw = allReviewStates
    .filter((state) => !usedFactIds.has(state.factId));

  const weightedReviews = reviewCandidatesRaw.map(r => ({
    ...r,
    _weight: r.nextReviewAt <= now ? 3.0
      : r.nextReviewAt <= now + DAY_MS ? 2.0
      : r.nextReviewAt <= now + WEEK_MS ? 1.0
      : 0.3,
  }));
  const selectedReviews = weightedShuffle(weightedReviews, reviewTarget + 20);

  const reviewCards: Card[] = [];
  for (const state of selectedReviews) {
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
  pool = assignTypesToCards(pool);
  pool = applyMechanics(pool);

  if (options?.probeRunNumber === 1) {
    const probeDomain = options.probeDomain ?? primaryDomain;
    const probe = buildProbeOrdering(pool, probeDomain);
    const probeIds = new Set(probe.map((card) => card.id));
    const remaining = shuffle(pool.filter((card) => !probeIds.has(card.id)));
    return [...probe, ...remaining];
  }

  return shuffle(pool);
}

// Exported for unit testing only — not part of the public API.
export { stratifiedSample as _stratifiedSample_forTest };
