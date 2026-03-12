import type { CardType, FactDomain } from '../../data/card-types'

export const DOMAIN_ICON_PATHS: Record<FactDomain, string> = {
  general_knowledge: '/assets/sprites/icons/icon_science.webp',
  natural_sciences: '/assets/sprites/icons/icon_science.webp',
  space_astronomy: '/assets/sprites/icons/icon_science.webp',
  history: '/assets/sprites/icons/icon_history.webp',
  geography: '/assets/sprites/icons/icon_geography.webp',
  geography_drill: '/assets/sprites/icons/icon_geography.webp',
  language: '/assets/sprites/icons/icon_language.webp',
  mythology_folklore: '/assets/sprites/icons/icon_arts.webp',
  animals_wildlife: '/assets/sprites/icons/icon_medicine.webp',
  human_body_health: '/assets/sprites/icons/icon_medicine.webp',
  food_cuisine: '/assets/sprites/icons/icon_arts.webp',
  art_architecture: '/assets/sprites/icons/icon_arts.webp',
  // Legacy aliases.
  science: '/assets/sprites/icons/icon_science.webp',
  math: '/assets/sprites/icons/icon_math.webp',
  arts: '/assets/sprites/icons/icon_arts.webp',
  medicine: '/assets/sprites/icons/icon_medicine.webp',
  technology: '/assets/sprites/icons/icon_technology.webp',
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
