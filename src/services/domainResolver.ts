import type { Fact } from '../data/types';
import type { FactDomain, CardType } from '../data/card-types';
import { pickWeightedType } from './cardTypeAllocator';

/** Top-level category string → FactDomain mapping */
const CATEGORY_TO_DOMAIN: Record<string, FactDomain> = {
  // Canonical snake_case (current DB format)
  'language': 'language',
  'general_knowledge': 'general_knowledge',
  'natural_sciences': 'natural_sciences',
  'space_astronomy': 'space_astronomy',
  'geography': 'geography',
  'history': 'history',
  'mythology_folklore': 'mythology_folklore',
  'animals_wildlife': 'animals_wildlife',
  'human_body_health': 'human_body_health',
  'food_cuisine': 'food_cuisine',
  'art_architecture': 'art_architecture',
  // Title Case (legacy facts)
  'Language': 'language',
  'General Knowledge': 'general_knowledge',
  'Natural Sciences': 'natural_sciences',
  'Space & Astronomy': 'space_astronomy',
  'Geography': 'geography',
  'History': 'history',
  'Mythology & Folklore': 'mythology_folklore',
  'Animals & Wildlife': 'animals_wildlife',
  'Human Body & Health': 'human_body_health',
  'Food & World Cuisine': 'food_cuisine',
  'Art & Architecture': 'art_architecture',
  // Legacy compatibility
  'Life Sciences': 'human_body_health',
  'Technology': 'general_knowledge',
  'Culture': 'art_architecture',
  'Mathematics': 'general_knowledge',
  'Math': 'general_knowledge',
  'Science': 'natural_sciences',
  'Arts': 'art_architecture',
  'Medicine': 'human_body_health',
  'Health': 'human_body_health',
};

const DEFAULT_DOMAIN: FactDomain = 'general_knowledge';
const FACT_DOMAIN_CACHE = new Map<string, FactDomain>();

/** Geography subcategories that belong to the dedicated drill domain. */
const GEOGRAPHY_DRILL_SUBS = new Set([
  'capitals_countries',
  'countries_capitals',
  'major_capitals',
  'south_american_capitals',
  'central_american_capitals',
  'african_capitals',
])

/**
 * Resolves a Fact's knowledge domain from its category hierarchy.
 *
 * Checks `fact.category[0]` (primary top-level category), then `fact.categoryL1`,
 * then falls back to `general_knowledge`.
 *
 * @param fact - The fact to resolve a domain for.
 * @returns The resolved FactDomain.
 */
export function resolveDomain(fact: Fact): FactDomain {
  const cacheKey = fact.id
  if (cacheKey) {
    const cached = FACT_DOMAIN_CACHE.get(cacheKey)
    if (cached) return cached
  }

  let resolved = DEFAULT_DOMAIN

  // categoryL1 is the authoritative domain field — check it first.
  // The legacy category[] array often has subcategory strings (e.g. "language_vocab")
  // that don't map to a domain, causing 17k+ facts to mis-resolve.
  if (fact.categoryL1 && CATEGORY_TO_DOMAIN[fact.categoryL1]) {
    resolved = CATEGORY_TO_DOMAIN[fact.categoryL1]
  } else {
    const primary = fact.category[0]
    if (primary && CATEGORY_TO_DOMAIN[primary]) {
      resolved = CATEGORY_TO_DOMAIN[primary]
    } else {
      for (const cat of fact.category) {
        if (CATEGORY_TO_DOMAIN[cat]) {
          resolved = CATEGORY_TO_DOMAIN[cat]
          break
        }
      }
    }
  }


  // Route geography drill subcategories (capitals, flags) to dedicated domain
  if (resolved === 'geography') {
    const sub = fact.categoryL2 ?? fact.category[1] ?? ''
    if (GEOGRAPHY_DRILL_SUBS.has(sub)) {
      resolved = 'geography_drill'
    }
  }

  if (cacheKey) {
    FACT_DOMAIN_CACHE.set(cacheKey, resolved)
  }

  return resolved;
}

/**
 * Legacy helper retained for compatibility.
 * Card type is no longer derived from domain; we return a deterministic weighted type.
 */
export function resolveCardType(domain: FactDomain): CardType {
  return pickWeightedType(`domain:${domain}`);
}
