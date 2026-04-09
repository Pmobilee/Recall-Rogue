import type { AgeRating } from './types'
import type { CanonicalFactDomain, FactDomain } from './card-types'
import { normalizeFactDomain } from './card-types'

export interface DomainMetadata {
  id: CanonicalFactDomain
  displayName: string
  shortName: string
  colorTint: string
  icon: string
  description: string
  ageDefault: AgeRating
  comingSoon?: boolean
}

export const DOMAIN_METADATA: Record<CanonicalFactDomain, DomainMetadata> = {
  general_knowledge: {
    id: 'general_knowledge',
    displayName: 'General Knowledge',
    shortName: 'General',
    colorTint: '#6B7280',
    icon: '🧠',
    description: 'Notable records, firsts, inventions, and broad world facts.',
    ageDefault: 'kid',
  },
  natural_sciences: {
    id: 'natural_sciences',
    displayName: 'Natural Sciences',
    shortName: 'Science',
    colorTint: '#10B981',
    icon: '🧪',
    description: 'Chemistry, physics, Earth science, and scientific principles.',
    ageDefault: 'teen',
  },
  space_astronomy: {
    id: 'space_astronomy',
    displayName: 'Space & Astronomy',
    shortName: 'Space',
    colorTint: '#6366F1',
    icon: '🌌',
    description: 'Planets, stars, missions, and cosmic discoveries.',
    ageDefault: 'kid',
  },
  geography: {
    id: 'geography',
    displayName: 'General Geography',
    shortName: 'General Geography',
    colorTint: '#F59E0B',
    icon: '🗺️',
    description: 'Regional geography, landforms, climate, and world facts.',
    ageDefault: 'kid',
  },
  geography_drill: {
    id: 'geography_drill',
    displayName: 'Capitals & Flags',
    shortName: 'Capitals & Flags',
    colorTint: '#D97706',
    icon: '🏳️',
    description: 'Learn every capital city and flag in the world.',
    ageDefault: 'kid',
  },
  history: {
    id: 'history',
    displayName: 'History',
    shortName: 'History',
    colorTint: '#0EA5E9',
    icon: '🏺',
    description: 'Events, civilizations, timelines, and historical figures.',
    ageDefault: 'teen',
  },
  mythology_folklore: {
    id: 'mythology_folklore',
    displayName: 'Mythology & Folklore',
    shortName: 'Myth',
    colorTint: '#8B5CF6',
    icon: '🐉',
    description: 'Myths, deities, creatures, and cultural storytelling traditions.',
    ageDefault: 'teen',
  },
  animals_wildlife: {
    id: 'animals_wildlife',
    displayName: 'Animals & Wildlife',
    shortName: 'Animals',
    colorTint: '#22C55E',
    icon: '🦉',
    description: 'Species, habitats, behavior, and conservation.',
    ageDefault: 'kid',
  },
  human_body_health: {
    id: 'human_body_health',
    displayName: 'Human Body & Health',
    shortName: 'Health',
    colorTint: '#14B8A6',
    icon: '🫀',
    description: 'Anatomy, physiology, medicine, and health literacy.',
    ageDefault: 'teen',
  },
  food_cuisine: {
    id: 'food_cuisine',
    displayName: 'Food & World Cuisine',
    shortName: 'Cuisine',
    colorTint: '#F97316',
    icon: '🍜',
    description: 'Dishes, ingredients, food culture, and culinary science.',
    ageDefault: 'kid',
  },
  art_architecture: {
    id: 'art_architecture',
    displayName: 'Art & Architecture',
    shortName: 'Art',
    colorTint: '#EC4899',
    icon: '🎨',
    description: 'Art movements, famous works, styles, and structures.',
    ageDefault: 'kid',
  },
  social_sciences: {
    id: 'social_sciences',
    displayName: 'Social Sciences',
    shortName: 'Social Sci',
    colorTint: '#7C3AED',
    icon: '📊',
    description: 'Psychology, economics, sociology, and behavioral sciences.',
    ageDefault: 'teen',
  },
  language: {
    id: 'language',
    displayName: 'Language',
    shortName: 'Language',
    colorTint: '#34D399',
    icon: '🗣️',
    description: 'Vocabulary, reading, listening, and language acquisition.',
    ageDefault: 'kid',
  },
  mathematics: {
    id: 'mathematics',
    displayName: 'Mathematics',
    shortName: 'Math',
    colorTint: '#3B82F6',    // Blue
    icon: '🔢',
    description: 'Arithmetic, mental math, algebra, and mathematical reasoning.',
    ageDefault: 'kid',
  },
}

export function getDomainMetadata(domain: FactDomain): DomainMetadata {
  return DOMAIN_METADATA[normalizeFactDomain(domain)] ?? DOMAIN_METADATA['general_knowledge']
}

export function getAllDomainMetadata(): DomainMetadata[] {
  return Object.values(DOMAIN_METADATA)
}

/**
 * Returns knowledge domains for trivia dungeon and general aggregation.
 * Excludes 'language' (Study Temple only), 'geography_drill' (specialized drill),
 * and 'mathematics' (procedural — has its own tab, not a fact-database domain).
 */
export function getKnowledgeDomains(): CanonicalFactDomain[] {
  return getAllDomainMetadata()
    .filter((domain) => domain.id !== 'language' && domain.id !== 'geography_drill' && domain.id !== 'mathematics')
    .map((domain) => domain.id)
}

export function getDomainCSSClass(domain: FactDomain): string {
  return `domain-${normalizeFactDomain(domain)}`
}
