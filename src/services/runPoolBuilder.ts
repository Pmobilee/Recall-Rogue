import type { Fact, ReviewState } from '../data/types';
import type { Card, CardType, FactDomain } from '../data/card-types';
import { normalizeFactDomain } from '../data/card-types';
import { factsDB } from './factsDB';
import { createCard, resetCardIdCounter } from './cardFactory';
import { DEFAULT_POOL_SIZE, POOL_PRIMARY_PCT, POOL_SECONDARY_PCT, POOL_SUBCATEGORY_MAX_PCT } from '../data/balance';
import { MECHANICS_BY_TYPE, type MechanicDefinition } from '../data/mechanics';
import { NUM_CHAIN_TYPES } from '../data/chainTypes';
import { assignTypesToCards } from './cardTypeAllocator';
import { shuffled } from './randomUtils';
import { getRunRng, isRunRngActive, seededShuffled } from './seededRng';
import type { DifficultyDistribution } from './difficultyCalibration';
import { funScoreWeight } from './funnessBoost';

const DOMAIN_TO_CATEGORY: Record<FactDomain, string[]> = {
  general_knowledge: ['General Knowledge', 'Technology', 'Mathematics', 'Math'],
  natural_sciences: ['Natural Sciences', 'Science'],
  space_astronomy: ['Space & Astronomy'],
  history: ['History'],
  geography: ['Geography'],
  geography_drill: ['Geography'],
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

// ── Fact question quality filter ─────────────────────────────────

/**
 * Returns true if the fact has a valid quiz question (either a direct
 * quizQuestion or at least one variant with a question). Facts without
 * any question must never enter the run pool.
 */
function factHasQuestion(fact: Fact): boolean {
  const hasQuizQuestion =
    !!fact.quizQuestion &&
    fact.quizQuestion.trim().length > 0 &&
    fact.quizQuestion !== 'undefined';
  const hasVariantQuestions =
    Array.isArray(fact.variants) &&
    fact.variants.length > 0 &&
    fact.variants.some((v) => v.question && v.question.trim().length > 0);
  return hasQuizQuestion || hasVariantQuestions;
}

const FALLBACK_DOMAIN_ORDER: FactDomain[] = [
  'general_knowledge',
  'natural_sciences',
  'history',
  'geography',
  'language',
];

/** Weighted shuffle: items with higher weights are more likely to appear earlier. */
function weightedShuffle<T extends { _weight: number }>(items: T[], count: number): T[] {
  const result: T[] = [];
  const pool = [...items];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, item) => sum + item._weight, 0);
    const rng = isRunRngActive() ? getRunRng('rewards') : null;
    let roll = (rng ? rng.next() : Math.random()) * totalWeight;
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
function stratifiedSample(facts: Fact[], target: number, distribution?: DifficultyDistribution, funnessBoostFactor?: number): Fact[] {
  const recentIds = getRecentFactIds();
  // Partition each bucket: non-recent (shuffled) first, then recent (shuffled) — so slicing prefers fresh facts
  const boostFactor = funnessBoostFactor ?? 0;
  const funnessWeightedShuffle = (arr: Fact[]): Fact[] => {
    if (boostFactor <= 0) return shuffled(arr);
    // Weighted shuffle: higher funScore facts are more likely to appear earlier
    const weighted = arr.map(f => ({ fact: f, _w: funScoreWeight(f.funScore ?? 5, boostFactor) }));
    const result: Fact[] = [];
    const pool = [...weighted];
    while (pool.length > 0) {
      const totalW = pool.reduce((sum, item) => sum + item._w, 0);
      const rng = isRunRngActive() ? getRunRng('rewards') : null;
      let roll = (rng ? rng.next() : Math.random()) * totalW;
      let picked = 0;
      for (let j = 0; j < pool.length; j++) {
        roll -= pool[j]._w;
        if (roll <= 0) { picked = j; break; }
      }
      result.push(pool.splice(picked, 1)[0].fact);
    }
    return result;
  };
  const deprioritize = (arr: Fact[]) => {
    const fresh = funnessWeightedShuffle(arr.filter(f => !recentIds.has(f.id)));
    const recent = funnessWeightedShuffle(arr.filter(f => recentIds.has(f.id)));
    return [...fresh, ...recent];
  };
  const easy = deprioritize(facts.filter(f => (f.difficulty ?? 3) <= 2));
  const medium = deprioritize(facts.filter(f => (f.difficulty ?? 3) === 3));
  const hard = deprioritize(facts.filter(f => (f.difficulty ?? 3) >= 4));

  const dist = distribution ?? { easyPct: 0.30, mediumPct: 0.45, hardPct: 0.25 };
  const easyTarget = Math.round(target * dist.easyPct);
  const hardTarget = Math.round(target * dist.hardPct);
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
  const s = isRunRngActive() ? seededShuffled(getRunRng('rewards'), items) : shuffled(items);
  return s.slice(0, Math.max(0, count));
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

  // Weight basic mechanics (strike, block) at 60% of their type pool
  const BASIC_MECHANICS: Record<string, string> = {
    attack: 'strike',
    shield: 'block',
  };
  const basicId = BASIC_MECHANICS[cardType];
  let selected: MechanicDefinition;

  const rng = isRunRngActive() ? getRunRng('cardtype') : null;
  const rand = () => rng ? rng.next() : Math.random();

  if (basicId && rand() < 0.6) {
    // 60% chance to pick the basic mechanic for attack/shield
    const basic = source.find(m => m.id === basicId);
    selected = basic ?? source[Math.floor(rand() * source.length)];
  } else {
    // 40% chance for any mechanic (including basic)
    selected = source[Math.floor(rand() * source.length)];
  }

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

/**
 * Assigns a chainType (0-5) to each card via even distribution.
 * Cards are shuffled first so chain types are randomly distributed.
 */
function assignChainTypes(cards: Card[]): void {
  // Shuffle indices to randomize which cards get which chain type
  const indices = cards.map((_, i) => i);
  const shuffledIndices = isRunRngActive()
    ? seededShuffled(getRunRng('chain'), indices)
    : shuffled(indices);

  for (let i = 0; i < shuffledIndices.length; i++) {
    cards[shuffledIndices[i]].chainType = i % NUM_CHAIN_TYPES;
  }
}

export function buildRunPool(
  primaryDomain: FactDomain,
  secondaryDomain: FactDomain,
  allReviewStates: ReviewState[],
  options?: {
    poolSize?: number
    probeRunNumber?: number
    probeDomain?: FactDomain
    subscriberCategoryFilters?: Record<string, string[]>
    primaryDistribution?: DifficultyDistribution
    secondaryDistribution?: DifficultyDistribution
    funnessBoostFactor?: number
  },
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

  function factSubcategory(fact: Fact): string {
    const second = fact.category[1]?.trim();
    if (second) return second;
    const l2 = fact.categoryL2?.trim();
    if (l2) return l2;
    return 'General';
  }

  function normalizeSubcategoryLabel(value: string): string {
    return value.trim().toLowerCase();
  }

  function applySubscriberSubcategoryFilter(domain: FactDomain, facts: Fact[]): Fact[] {
    const filters = options?.subscriberCategoryFilters;
    if (!filters) return facts;
    const key = normalizeFactDomain(domain);
    const enabled = filters[key];
    if (!Array.isArray(enabled) || enabled.length === 0) return facts;
    const allowed = new Set(enabled.map(normalizeSubcategoryLabel));
    const filtered = facts.filter((fact) => allowed.has(normalizeSubcategoryLabel(factSubcategory(fact))));
    // Fallback to the unfiltered domain set if the filter became too strict.
    return filtered.length > 0 ? filtered : facts;
  }

  function collectDomainFacts(domain: FactDomain, limit: number, excludedFactIds: Set<string>, distribution?: DifficultyDistribution): Fact[] {
    const normalized = normalizeDomain(domain);
    const categories = DOMAIN_TO_CATEGORY[normalized] ?? DOMAIN_TO_CATEGORY.general_knowledge;
    const selected: Fact[] = [];
    const addedIds = new Set<string>();

    const pushUnique = (fact: Fact) => {
      if (excludedFactIds.has(fact.id) || addedIds.has(fact.id)) return;
      selected.push(fact);
      addedIds.add(fact.id);
    };

    const categoryFactsRaw = factsDB.getByCategory(categories, limit * 3)
      .filter(f => !excludedFactIds.has(f.id))
      .filter(factHasQuestion);
    const categoryFacts = applySubscriberSubcategoryFilter(normalized, categoryFactsRaw);

    // --- Subcategory-balanced sampling ---
    // Group facts by subcategory
    const subcatGroups = new Map<string, Fact[]>();
    for (const fact of categoryFacts) {
      const subcat = normalizeSubcategoryLabel(factSubcategory(fact));
      const group = subcatGroups.get(subcat) ?? [];
      group.push(fact);
      subcatGroups.set(subcat, group);
    }

    const subcatKeys = [...subcatGroups.keys()];
    if (subcatKeys.length <= 1) {
      // Only one subcategory — no balancing needed, use normal stratified sample
      const stratified = stratifiedSample(categoryFacts, limit, distribution, options?.funnessBoostFactor);
      for (const fact of stratified) pushUnique(fact);
    } else {
      // Cap each subcategory at POOL_SUBCATEGORY_MAX_PCT of the limit
      const maxPerSubcat = Math.max(1, Math.ceil(limit * POOL_SUBCATEGORY_MAX_PCT));

      // First pass: take up to maxPerSubcat from each subcategory (stratified within each)
      const remainingFacts: Fact[] = [];
      for (const key of (isRunRngActive() ? seededShuffled(getRunRng('rewards'), subcatKeys) : shuffled(subcatKeys))) {
        const group = subcatGroups.get(key)!;
        const stratified = stratifiedSample(group, maxPerSubcat, distribution, options?.funnessBoostFactor);
        for (const fact of stratified) pushUnique(fact);
        // Collect unused facts for backfill
        for (const fact of group) {
          if (!addedIds.has(fact.id) && !excludedFactIds.has(fact.id)) {
            remainingFacts.push(fact);
          }
        }
      }

      // Second pass: backfill from remaining facts if we haven't reached limit
      if (selected.length < limit) {
        const backfill = stratifiedSample(remainingFacts.filter(f => !addedIds.has(f.id)), limit - selected.length, distribution, options?.funnessBoostFactor);
        for (const fact of backfill) pushUnique(fact);
      }
    }

    if (selected.length >= limit) return selected.slice(0, limit);

    const fallbackDomains = FALLBACK_DOMAIN_ORDER
      .filter((candidate) => candidate !== normalized);

    for (const fallbackDomain of fallbackDomains) {
      const needed = limit - selected.length;
      if (needed <= 0) break;
      const fallbackCategories = DOMAIN_TO_CATEGORY[fallbackDomain] ?? [];
      const fallbackFacts = applySubscriberSubcategoryFilter(
        fallbackDomain,
        factsDB.getByCategory(fallbackCategories, needed + 30).filter(factHasQuestion),
      );
      for (const fact of fallbackFacts) {
        if (selected.length >= limit) break;
        pushUnique(fact);
      }
    }

    return selected.slice(0, limit);
  }

  function factsToCards(facts: Fact[]): Card[] {
    return facts.map((fact) => createCard(fact, stateByFactId.get(fact.id)));
  }

  const primaryFacts = collectDomainFacts(primaryDomain, primaryTarget, new Set<string>(), options?.primaryDistribution);
  const usedFactIds = new Set(primaryFacts.map((fact) => fact.id));
  const primaryCards = factsToCards(primaryFacts);

  const secondaryFacts = collectDomainFacts(secondaryDomain, secondaryTarget, usedFactIds, options?.secondaryDistribution)
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
    if (!factHasQuestion(fact)) continue;
    reviewCards.push(createCard(fact, state));
    usedFactIds.add(fact.id);
  }

  let pool = [...primaryCards, ...secondaryCards, ...reviewCards];

  if (pool.length < poolSize) {
    const shortage = poolSize - pool.length;
    const fillerFacts = factsDB.getRandom(shortage + 20)
      .filter((fact) => !usedFactIds.has(fact.id))
      .filter(factHasQuestion)
      .slice(0, shortage);
    pool.push(...factsToCards(fillerFacts));
  }

  pool = pool.slice(0, poolSize);
  pool = pool.filter((card) => card.tier !== '3');
  pool = assignTypesToCards(pool);
  pool = applyMechanics(pool);

  // === Fact-to-Card Binding (AR-70) ===
  // Bind each card's fact permanently for the run duration.
  // The card's factId is already set from createCard() — store it as boundFactId.
  for (const card of pool) {
    card.boundFactId = card.factId;
  }

  // === Chain Type Assignment (AR-70) ===
  // Assign one of 6 chain types evenly across the pool.
  assignChainTypes(pool);

  if (options?.probeRunNumber === 1) {
    const probeDomain = options.probeDomain ?? primaryDomain;
    const probe = buildProbeOrdering(pool, probeDomain);
    const probeIds = new Set(probe.map((card) => card.id));
    const remaining = isRunRngActive()
      ? seededShuffled(getRunRng('rewards'), pool.filter((card) => !probeIds.has(card.id)))
      : shuffled(pool.filter((card) => !probeIds.has(card.id)));
    return [...probe, ...remaining];
  }

  if (isRunRngActive()) {
    return seededShuffled(getRunRng('rewards'), pool);
  }
  return shuffled(pool);
}

// Exported for unit testing only — not part of the public API.
export { stratifiedSample as _stratifiedSample_forTest };
