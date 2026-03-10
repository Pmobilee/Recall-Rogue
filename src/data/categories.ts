/** Top-level fact categories used by legacy category-based systems. */
export const CATEGORIES = [
  'General Knowledge',
  'Natural Sciences',
  'Space & Astronomy',
  'Geography',
  'History',
  'Mythology & Folklore',
  'Animals & Wildlife',
  'Human Body & Health',
  'Food & World Cuisine',
  'Art & Architecture',
  'Language',
] as const

/** Human-readable content domain, based on top-level category labels. */
export type FactDomain = typeof CATEGORIES[number]

export function isFactDomain(value: unknown): value is FactDomain {
  return typeof value === 'string' && CATEGORIES.includes(value as FactDomain)
}
