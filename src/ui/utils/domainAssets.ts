import type { CardType, FactDomain } from '../../data/card-types'

export const DOMAIN_ICON_PATHS: Record<FactDomain, string> = {
  general_knowledge: '/assets/sprites/icons/icon_domain_general_knowledge.png',
  natural_sciences: '/assets/sprites/icons/icon_domain_natural_sciences.png',
  space_astronomy: '/assets/sprites/icons/icon_domain_space_astronomy.png',
  history: '/assets/sprites/icons/icon_domain_history.png',
  geography: '/assets/sprites/icons/icon_domain_geography.png',
  geography_drill: '/assets/sprites/icons/icon_domain_geography_drill.png',
  language: '/assets/sprites/icons/icon_domain_language.png',
  mythology_folklore: '/assets/sprites/icons/icon_domain_mythology_folklore.png',
  animals_wildlife: '/assets/sprites/icons/icon_domain_animals_wildlife.png',
  human_body_health: '/assets/sprites/icons/icon_domain_human_body_health.png',
  food_cuisine: '/assets/sprites/icons/icon_domain_food_cuisine.png',
  art_architecture: '/assets/sprites/icons/icon_domain_art_architecture.png',
  social_sciences: '/assets/sprites/icons/icon_domain_social_sciences.png',
  sports_entertainment: '/assets/sprites/icons/icon_domain_sports_entertainment.png',
  mathematics: '/assets/sprites/icons/icon_domain_mathematics.png',
  games: '/assets/sprites/icons/icon_domain_sports_entertainment.png',  // Fallback until dedicated games icon is created
  // Legacy aliases — mapped to closest domain-specific icon.
  science: '/assets/sprites/icons/icon_domain_natural_sciences.png',
  math: '/assets/sprites/icons/icon_domain_mathematics.png',
  arts: '/assets/sprites/icons/icon_domain_art_architecture.png',
  medicine: '/assets/sprites/icons/icon_domain_human_body_health.png',
  technology: '/assets/sprites/icons/icon_domain_general_knowledge.png',
}

export function getDomainIconPath(domain: FactDomain): string {
  return DOMAIN_ICON_PATHS[domain]
}

export function getCardFramePath(type: CardType): string {
  return `/assets/sprites/cards/frame_${type}.webp`
}

export function getDoorSpritePath(type: 'combat' | 'mystery' | 'rest' | 'treasure' | 'shop'): string {
  return `/assets/sprites/doors/door_${type}.webp`
}
