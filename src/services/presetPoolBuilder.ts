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
import { getUnlockedMechanics } from './characterLevel';
import { selectRunChainTypes } from '../data/chainTypes';
import { assignTypesToCards } from './cardTypeAllocator';
import { shuffled } from './randomUtils';
import { getRunRng, isRunRngActive, seededShuffled } from './seededRng';
import { funScoreWeight } from './funnessBoost';
import { factMatchesDomainSelection, factMatchesPresetSelection } from './presetSelectionService';
import type { ChainDistribution } from './chainDistribution';

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
  (d) => d !== 'language' && d !== 'geography' && d !== 'geography_drill' && d !== 'mathematics',
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
    if (boostFactor <= 0) return isRunRngActive() ? seededShuffled(getRunRng('rewards'), arr) : shuffled(arr);
    const weighted = arr.map(f => ({ fact: f, _w: funScoreWeight(f.funScore ?? 5, boostFactor) }));
    const result: Fact[] = [];
    const pool = [...weighted];
    while (pool.length > 0) {
      const totalW = pool.reduce((sum, item) => sum + item._w, 0);
      let roll = (isRunRngActive() ? getRunRng('rewards').next() : Math.random()) * totalW;
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
    let roll = (isRunRngActive() ? getRunRng('rewards').next() : Math.random()) * totalWeight;
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

/** Pick a mechanic for the given card type, respecting maxPerPool limits and unlock gating. */
function pickMechanic(
  cardType: CardType,
  mechanicCounts: Map<string, number>,
  unlockedMechanicIds?: Set<string>,
): MechanicDefinition {
  const rawPool = MECHANICS_BY_TYPE[cardType];
  // Apply unlock filter — if no unlocked set provided, use full pool (backward compat)
  const pool = unlockedMechanicIds
    ? rawPool.filter(m => unlockedMechanicIds.has(m.id))
    : rawPool;
  // Fall back to full type pool if the filtered pool is empty (guards against
  // misconfigured unlock tables leaving a card type with zero eligible mechanics)
  const effectivePool = pool.length > 0 ? pool : rawPool;

  const eligible = effectivePool.filter((mechanic) => {
    if (mechanic.maxPerPool <= 0) return true;
    return (mechanicCounts.get(mechanic.id) ?? 0) < mechanic.maxPerPool;
  });

  const source = eligible.length > 0 ? eligible : effectivePool;
  const rng = isRunRngActive() ? getRunRng('cardtype') : null;
  const selected = source[Math.floor((rng ? rng.next() : Math.random()) * source.length)];
  mechanicCounts.set(selected.id, (mechanicCounts.get(selected.id) ?? 0) + 1);
  return selected;
}

/** Assign mechanics to all cards in the pool. */
function applyMechanics(cards: Card[], unlockedMechanicIds?: Set<string>): Card[] {
  const mechanicCounts = new Map<string, number>();
  return cards.map((card) => {
    const mechanic = pickMechanic(card.cardType, mechanicCounts, unlockedMechanicIds);
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

/**
 * Returns true if the fact is suitable for the trivia/dungeon run pool.
 * Language and vocabulary facts belong exclusively to the Study Temple
 * curated deck system and must never appear in Trivia Dungeon runs.
 *
 * A fact is excluded when:
 *   - fact.categoryL1 === 'language'  (canonical language domain fact)
 *   - fact.type === 'vocabulary'       (vocabulary card regardless of domain)
 *   - fact.type === 'grammar'          (grammar card — also language-specific)
 *   - fact.type === 'phrase'           (phrase card — also language-specific)
 */
function factIsTrivia(fact: Fact): boolean {
  if (fact.categoryL1 === 'language') return false;
  if (fact.type === 'vocabulary' || fact.type === 'grammar' || fact.type === 'phrase') return false;
  return true;
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
 * 6. Assign chain types: proportional by distribution group sizes if chainDistribution
 *    provided, else round-robin seeded shuffle
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
    /** Character level for mechanic unlock gating. Defaults to 0 (all existing mechanics). */
    characterLevel?: number;
    /**
     * Pre-computed topic-to-chain distribution from chainDistribution.ts.
     * When provided (Study Temple / curated deck runs), each card's chainType is
     * assigned proportionally based on the distribution's group sizes, preserving
     * the relative weighting of each chain's topic groups without requiring factId
     * overlap between the curated deck JSON and the factsDB pool.
     * Falls back to round-robin when absent (trivia runs).
     */
    chainDistribution?: ChainDistribution;
    /**
     * When true, language/grammar/vocabulary facts are allowed in the run pool
     * even when non-language domains are also present.
     *
     * Set this when the caller explicitly mixes language decks with knowledge
     * decks (e.g. a custom deck containing both a Japanese vocab deck and a
     * World History deck). Leaving it false/undefined preserves the legacy
     * trivia-run behaviour where language facts are always excluded from
     * non-language domain runs.
     */
    allowLanguageFacts?: boolean;
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
      // Exclude vocabulary/language facts from trivia pool — they live in Study Temple curated
      // decks. Exception: allowLanguageFacts=true means the caller has explicitly mixed language
      // deck items with knowledge items (e.g. a custom deck), so the filter must be skipped.
      if (!options?.allowLanguageFacts) {
        facts = facts.filter(factIsTrivia);
      }
    }

    // Remove facts without a valid question before any further processing.
    facts = facts.filter(factHasQuestion);

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

  // isTriviaRun: true when at least one non-language domain is present AND we have NOT
  // been told to allow language facts. When allowLanguageFacts is set, the caller has
  // explicitly mixed domains — language facts are valid in both content and reviews.
  const isTriviaRun = !options?.allowLanguageFacts && domains.some((d) => !d.startsWith('language:'));

  const now = Date.now();
  const DAY_MS = 86_400_000;
  const WEEK_MS = 7 * DAY_MS;

  const reviewCandidates = allReviewStates.filter((state) => {
    if (usedFactIds.has(state.factId)) return false;
    const fact = factsDB.getById(state.factId);
    if (!fact) return false;
    if (!factHasQuestion(fact)) return false;
    // Exclude language/vocabulary facts from trivia run review pool.
    if (isTriviaRun && !factIsTrivia(fact)) return false;
    return factMatchesPresetSelection(fact, domainSelections);
  });

  const includeOutsideDueReviews = options?.includeOutsideDueReviews ?? false;
  const outsideDueCandidates = includeOutsideDueReviews
    ? allReviewStates.filter((state) => {
      if (usedFactIds.has(state.factId)) return false;
      if (state.nextReviewAt > now) return false;
      const fact = factsDB.getById(state.factId);
      if (!fact) return false;
      if (!factHasQuestion(fact)) return false;
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
      .filter((fact) => !isTriviaRun || factIsTrivia(fact))
      .filter((fact) => factMatchesPresetSelection(fact, domainSelections))
      .filter(factHasQuestion);
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
  const unlockedMechanicIds = getUnlockedMechanics(options?.characterLevel ?? 0);
  pool = applyMechanics(pool, unlockedMechanicIds);

  // ── Step 7: Assign chain types ──
  // Using 3 types instead of 6 increases chain frequency from ~15% to ~50% of hands.
  //
  // When a chainDistribution is provided (Study Temple curated runs), we use
  // PROPORTIONAL assignment based on how many facts each chain's topic groups contain.
  // We CANNOT use factToChain.get(card.factId) because the pool cards come from
  // factsDB (SQLite integer IDs) while the distribution was built from the curated
  // deck JSON (string IDs like "ww_anc_pyramid_giza_height") — zero ID overlap.
  // Instead, the proportion of cards each chain receives mirrors the proportion of
  // facts in its topic groups, preserving the intended weighting across the run.
  const chainRng = isRunRngActive() ? getRunRng('chainSelect') : null;
  const chainSeed = chainRng ? chainRng.getState() : Math.floor(Math.random() * 0xFFFFFFFF);
  const runChainTypes = selectRunChainTypes(chainSeed);

  const chainDistribution = options?.chainDistribution;
  if (chainDistribution) {
    // Build proportional weights from distribution group sizes.
    // E.g., chain 0 covers 39 facts, chain 2 covers 81, chain 4 covers 75 →
    // assign pool cards in those proportions so deck sub-topic weighting is preserved.
    const chainWeights: { chainType: number; weight: number }[] = [];
    for (let i = 0; i < chainDistribution.runChainTypes.length; i++) {
      const chainType = chainDistribution.runChainTypes[i];
      const groups = chainDistribution.assignments[i];
      const totalFacts = groups.reduce((sum, g) => sum + g.factIds.length, 0);
      chainWeights.push({ chainType, weight: totalFacts });
    }

    const totalWeight = chainWeights.reduce((s, cw) => s + cw.weight, 0);

    if (totalWeight === 0 || chainWeights.length === 0) {
      // Edge case: distribution exists but all groups are empty — equal distribution fallback.
      for (let i = 0; i < pool.length; i++) {
        pool[i].chainType = chainDistribution.runChainTypes[i % chainDistribution.runChainTypes.length];
      }
    } else {
      // Shuffle pool indices first for randomness within each proportional bucket.
      const shuffledIndices = isRunRngActive()
        ? seededShuffled(getRunRng('chain'), [...pool.keys()])
        : shuffled([...pool.keys()]);

      // Build expanded chain slot array matching proportions, then trim/pad to exact pool size.
      const chainSlots: number[] = [];
      for (const cw of chainWeights) {
        const count = Math.round((cw.weight / totalWeight) * pool.length);
        for (let j = 0; j < count; j++) {
          chainSlots.push(cw.chainType);
        }
      }
      // Pad any rounding shortfall using round-robin over the chain types.
      while (chainSlots.length < pool.length) {
        chainSlots.push(chainWeights[chainSlots.length % chainWeights.length].chainType);
      }
      chainSlots.length = pool.length;

      for (let i = 0; i < shuffledIndices.length; i++) {
        pool[shuffledIndices[i]].chainType = chainSlots[i];
      }
    }
  } else {
    // Fallback: round-robin seeded shuffle for trivia/general runs without distribution.
    const chainIndices = pool.map((_, i) => i);
    const shuffledChainIndices = isRunRngActive()
      ? seededShuffled(getRunRng('chain'), chainIndices)
      : shuffled(chainIndices);
    for (let i = 0; i < shuffledChainIndices.length; i++) {
      pool[shuffledChainIndices[i]].chainType = runChainTypes[i % runChainTypes.length];
    }
  }

  return isRunRngActive() ? seededShuffled(getRunRng('rewards'), pool) : shuffled(pool);
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
    /**
     * Pre-computed topic-to-chain distribution. Forwarded to buildPresetRunPool.
     * Used when a knowledge curated deck run has a chain distribution computed at run start.
     */
    chainDistribution?: ChainDistribution;
    /**
     * When true, language/grammar/vocabulary facts are allowed in the pool alongside
     * non-language domain facts. Forwarded to buildPresetRunPool. See that function's
     * allowLanguageFacts option for full semantics.
     */
    allowLanguageFacts?: boolean;
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
 * Accepts chainDistribution so Study Temple vocabulary runs receive
 * the same proportional chain-type assignment as knowledge deck runs.
 */
export function buildLanguageRunPool(
  languageCode: string,
  allReviewStates: ReviewState[],
  options?: {
    poolSize?: number;
    categoryFilters?: Record<string, string[]>;
    funnessBoostFactor?: number;
    includeOutsideDueReviews?: boolean;
    /**
     * Pre-computed topic-to-chain distribution. Forwarded to buildPresetRunPool.
     * Used when a language curated deck run has a chain distribution computed at run start.
     */
    chainDistribution?: ChainDistribution;
  },
): Card[] {
  const normalizedCode = String(languageCode || '').trim().toLowerCase();
  if (!normalizedCode) return [];
  const domainSelections: Record<string, string[]> = {
    [`language:${normalizedCode}`]: [],
  };
  return buildPresetRunPool(domainSelections, allReviewStates, options);
}
