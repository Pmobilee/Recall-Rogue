/**
 * Builds run pools from study presets or "general" (all-domain) mode.
 *
 * Unlike runPoolBuilder which uses a primary+secondary domain split,
 * this builder distributes facts proportionally across any number
 * of selected domains with optional subcategory filtering.
 */

import type { Fact, ReviewState } from '../data/types';
import type { Card, CardType, FactDomain, CanonicalFactDomain } from '../data/card-types';
import { CANONICAL_FACT_DOMAINS, normalizeFactDomain } from '../data/card-types';
import { factsDB } from './factsDB';
import { createCard, resetCardIdCounter } from './cardFactory';
import { DEFAULT_POOL_SIZE } from '../data/balance';
import { MECHANICS_BY_TYPE, type MechanicDefinition } from '../data/mechanics';
import { assignTypesToCards } from './cardTypeAllocator';
import { shuffled } from './randomUtils';
import { funScoreWeight } from './funnessBoost';
import { factMatchesDomainSelection, factMatchesPresetSelection } from './presetSelectionService';

/** Maps domain IDs to the category strings used in the facts DB. */
const DOMAIN_TO_CATEGORY: Record<string, string[]> = {
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
};

/**
 * Domains included by "All Topics" (core general-knowledge only).
 * Extra packs like language/vocab and geography packs are excluded.
 */
const GENERAL_MODE_DOMAINS: CanonicalFactDomain[] = CANONICAL_FACT_DOMAINS.filter(
  (d) => d !== 'language' && d !== 'geography' && d !== 'geography_drill',
);

// ── Recent-fact deduplication ─────────────────────────────────────

const RECENT_FACTS_KEY = 'recall-rogue-recent-facts';
const MAX_RECENT_RUNS = 2;

/** Get fact IDs from the last N runs (same logic as runPoolBuilder). */
function getRecentFactIds(): Set<string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RECENT_FACTS_KEY) : null;
    if (!raw) return new Set();
    const runs: string[][] = JSON.parse(raw);
    return new Set(runs.flat());
  } catch { return new Set(); }
}

// ── Stratified difficulty sampling ───────────────────────────────

/**
 * Stratified sampling by difficulty.
 * Targets: easy (1-2) ~30%, medium (3) ~45%, hard (4-5) ~25%.
 * Shortfalls backfill from medium first, then any remaining bucket.
 */
function stratifiedSample(facts: Fact[], target: number, funnessBoostFactor?: number): Fact[] {
  const recentIds = getRecentFactIds();

  const boostFactor = funnessBoostFactor ?? 0;
  const funnessWeightedShuffle = (arr: Fact[]): Fact[] => {
    if (boostFactor <= 0) return shuffled(arr);
    const weighted = arr.map(f => ({ fact: f, _w: funScoreWeight(f.funScore ?? 5, boostFactor) }));
    const result: Fact[] = [];
    const pool = [...weighted];
    while (pool.length > 0) {
      const totalW = pool.reduce((sum, item) => sum + item._w, 0);
      let roll = Math.random() * totalW;
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
    const fresh = funnessWeightedShuffle(arr.filter((f) => !recentIds.has(f.id)));
    const recent = funnessWeightedShuffle(arr.filter((f) => recentIds.has(f.id)));
    return [...fresh, ...recent];
  };

  const easy = deprioritize(facts.filter((f) => (f.difficulty ?? 3) <= 2));
  const medium = deprioritize(facts.filter((f) => (f.difficulty ?? 3) === 3));
  const hard = deprioritize(facts.filter((f) => (f.difficulty ?? 3) >= 4));

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

// ── Weighted shuffle for review selection ────────────────────────

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

// ── Mechanic assignment ──────────────────────────────────────────

/** Pick a mechanic for the given card type, respecting maxPerPool limits. */
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

/** Assign mechanics to all cards in the pool. */
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

// ── Subcategory filtering ────────────────────────────────────────

/** Extract the subcategory from a fact (category[1] or categoryL2). */
function factSubcategory(fact: Fact): string {
  const second = fact.category[1]?.trim();
  if (second) return second;
  const l2 = fact.categoryL2?.trim();
  if (l2) return l2;
  return 'General';
}

/** Normalize a subcategory label for comparison. */
function normalizeSubcategoryLabel(value: string): string {
  return value.trim().toLowerCase();
}

/** Filter facts by a single domain key and its selected subcategory tokens. */
function applyDomainSelectionFilter(
  facts: Fact[],
  domainKey: string,
  subcategories: string[],
): Fact[] {
  return facts.filter((fact) => factMatchesDomainSelection(fact, domainKey, subcategories));
}

/**
 * Apply external category filters (e.g. subscriber filters, now free for all).
 * Falls back to the unfiltered set if filtering yields zero results.
 */
function applyCategoryFilters(
  domain: string,
  facts: Fact[],
  categoryFilters?: Record<string, string[]>,
): Fact[] {
  if (!categoryFilters) return facts;
  const key = normalizeFactDomain(domain as FactDomain);
  const enabled = categoryFilters[key];
  if (!Array.isArray(enabled) || enabled.length === 0) return facts;
  const allowed = new Set(enabled.map(normalizeSubcategoryLabel));
  return facts.filter((f) => allowed.has(normalizeSubcategoryLabel(factSubcategory(f))));
}

// ── Main pool builder ────────────────────────────────────────────

/**
 * Build a run pool from a study preset's multi-domain selections.
 * For 'general' mode, all non-language domains are included proportionally.
 *
 * Algorithm:
 * 1. Collect content facts (70% of pool) distributed proportionally across domains
 * 2. Add review facts (30% of pool) via weighted shuffle by due date
 * 3. Backfill with random facts if pool is below target
 * 4. Filter tier 3 (mastered passive) cards
 * 5. Assign card types and mechanics
 *
 * @param domainSelections - Map of domain ID → subcategory filters (empty array = all).
 * @param allReviewStates - All review states for the player.
 * @param options - Optional pool size and category filters.
 * @returns Shuffled array of Cards ready for a run.
 */
export function buildPresetRunPool(
  domainSelections: Record<string, string[]>,
  allReviewStates: ReviewState[],
  options?: {
    poolSize?: number;
    categoryFilters?: Record<string, string[]>;
    funnessBoostFactor?: number;
    includeOutsideDueReviews?: boolean;
  },
): Card[] {
  const poolSize = options?.poolSize ?? DEFAULT_POOL_SIZE;
  resetCardIdCounter();

  const contentTarget = Math.round(poolSize * 0.70);
  const reviewTarget = poolSize - contentTarget;

  const stateByFactId = new Map<string, ReviewState>();
  for (const state of allReviewStates) stateByFactId.set(state.factId, state);

  // ── Step 1: Collect facts per domain ──

  const domains = Object.keys(domainSelections);
  const domainFacts: Map<string, Fact[]> = new Map();

  for (const domain of domains) {
    const isLanguageDomain = domain.startsWith('language:');
    let facts: Fact[] = [];

    if (isLanguageDomain) {
      const languageCode = String(domain.slice('language:'.length)).trim().toLowerCase();
      facts = factsDB.getAll().filter((fact) => String(fact.language || '').trim().toLowerCase() === languageCode);
    } else {
      const normalized = normalizeFactDomain(domain as FactDomain);
      const categories = DOMAIN_TO_CATEGORY[normalized] ?? DOMAIN_TO_CATEGORY.general_knowledge;
      facts = factsDB.getByCategory(categories, contentTarget * 3);
      facts = applyCategoryFilters(normalized, facts, options?.categoryFilters);
    }

    // Apply preset subcategory/token filter for this domain key.
    facts = applyDomainSelectionFilter(facts, domain, domainSelections[domain] ?? []);

    domainFacts.set(domain, facts);
  }

  // ── Step 2: Distribute content target proportionally ──

  const totalAvailable = [...domainFacts.values()].reduce((sum, f) => sum + f.length, 0);
  const usedFactIds = new Set<string>();
  const contentCards: Card[] = [];

  for (const domain of domains) {
    const facts = domainFacts.get(domain) ?? [];
    if (facts.length === 0) continue;

    // Proportional allocation based on available fact count
    const proportion = totalAvailable > 0 ? facts.length / totalAvailable : 1 / domains.length;
    const allocation = Math.round(contentTarget * proportion);

    // Filter out already-used facts
    const available = facts.filter((f) => !usedFactIds.has(f.id));
    const sampled = stratifiedSample(available, allocation, options?.funnessBoostFactor);

    for (const fact of sampled) {
      if (usedFactIds.has(fact.id)) continue;
      usedFactIds.add(fact.id);
      contentCards.push(createCard(fact, stateByFactId.get(fact.id)));
    }
  }

  // ── Step 3: Build review pool (30%) ──

  const now = Date.now();
  const DAY_MS = 86_400_000;
  const WEEK_MS = 7 * DAY_MS;

  const reviewCandidates = allReviewStates.filter((state) => {
    if (usedFactIds.has(state.factId)) return false;
    const fact = factsDB.getById(state.factId);
    if (!fact) return false;
    return factMatchesPresetSelection(fact, domainSelections);
  });

  const includeOutsideDueReviews = options?.includeOutsideDueReviews ?? false;
  const outsideDueCandidates = includeOutsideDueReviews
    ? allReviewStates.filter((state) => {
      if (usedFactIds.has(state.factId)) return false;
      if (state.nextReviewAt > now) return false;
      const fact = factsDB.getById(state.factId);
      if (!fact) return false;
      return !factMatchesPresetSelection(fact, domainSelections);
    })
    : [];

  const weightedReviews = [...reviewCandidates, ...outsideDueCandidates].map((r) => ({
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

  // ── Step 4: Combine and fill ──

  let pool = [...contentCards, ...reviewCards];

  if (pool.length < poolSize) {
    const shortage = poolSize - pool.length;
    const fillerCandidates = factsDB
      .getAll()
      .filter((fact) => !usedFactIds.has(fact.id))
      .filter((fact) => factMatchesPresetSelection(fact, domainSelections));
    const fillerFacts = stratifiedSample(fillerCandidates, shortage, options?.funnessBoostFactor);
    for (const fact of fillerFacts) {
      if (usedFactIds.has(fact.id)) continue;
      pool.push(createCard(fact, stateByFactId.get(fact.id)));
      usedFactIds.add(fact.id);
      if (pool.length >= poolSize) break;
    }
  }

  pool = pool.slice(0, poolSize);

  // ── Step 5: Filter mastered passive cards ──

  pool = pool.filter((card) => card.tier !== '3');

  // ── Step 6: Assign types and mechanics ──

  pool = assignTypesToCards(pool);
  pool = applyMechanics(pool);

  return shuffled(pool);
}

/**
 * Build a run pool for "General Knowledge" mode (core domains only).
 * Each domain is included with no subcategory filter (empty array = all).
 *
 * @param allReviewStates - All review states for the player.
 * @param options - Optional pool size and category filters.
 * @returns Shuffled array of Cards ready for a run.
 */
export function buildGeneralRunPool(
  allReviewStates: ReviewState[],
  options?: {
    poolSize?: number;
    categoryFilters?: Record<string, string[]>;
    funnessBoostFactor?: number;
    includeOutsideDueReviews?: boolean;
  },
): Card[] {
  const domainSelections: Record<string, string[]> = {};
  for (const domain of GENERAL_MODE_DOMAINS) {
    domainSelections[domain] = [];
  }
  return buildPresetRunPool(domainSelections, allReviewStates, options);
}

/**
 * Build a run pool for a single language mode (e.g. language:ja).
 */
export function buildLanguageRunPool(
  languageCode: string,
  allReviewStates: ReviewState[],
  options?: {
    poolSize?: number;
    categoryFilters?: Record<string, string[]>;
    funnessBoostFactor?: number;
    includeOutsideDueReviews?: boolean;
  },
): Card[] {
  const normalizedCode = String(languageCode || '').trim().toLowerCase();
  if (!normalizedCode) return [];
  const domainSelections: Record<string, string[]> = {
    [`language:${normalizedCode}`]: [],
  };
  return buildPresetRunPool(domainSelections, allReviewStates, options);
}
