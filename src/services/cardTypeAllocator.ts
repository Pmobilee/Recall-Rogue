import type { Card, CardType } from '../data/card-types'

export const CARD_TYPE_DISTRIBUTION: Array<{ type: CardType; weight: number }> = [
  { type: 'attack', weight: 0.30 },
  { type: 'shield', weight: 0.25 },
  { type: 'heal', weight: 0.15 },
  { type: 'buff', weight: 0.10 },
  { type: 'debuff', weight: 0.08 },
  { type: 'utility', weight: 0.07 },
  { type: 'regen', weight: 0.03 },
  { type: 'wild', weight: 0.05 },
]

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function sum(weights: Array<{ weight: number }>): number {
  return weights.reduce((total, entry) => total + entry.weight, 0)
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function buildTargetCounts(total: number): Map<CardType, number> {
  const targets = new Map<CardType, number>()
  let assigned = 0

  for (const entry of CARD_TYPE_DISTRIBUTION) {
    const count = Math.floor(entry.weight * total)
    targets.set(entry.type, count)
    assigned += count
  }

  const remainder = Math.max(0, total - assigned)
  const byFraction = [...CARD_TYPE_DISTRIBUTION]
    .map((entry) => ({
      type: entry.type,
      fraction: entry.weight * total - Math.floor(entry.weight * total),
    }))
    .sort((a, b) => b.fraction - a.fraction)

  for (let i = 0; i < remainder; i += 1) {
    const bucket = byFraction[i % byFraction.length]
    targets.set(bucket.type, (targets.get(bucket.type) ?? 0) + 1)
  }

  return targets
}

/**
 * Assigns combat card types from the global weighted distribution.
 * Domain is intentionally ignored to keep learning topic and combat role decoupled.
 */
export function assignTypesToCards(cards: Card[]): Card[] {
  if (cards.length === 0) return cards

  const targets = buildTargetCounts(cards.length)
  const shuffled = shuffle([...cards])
  const assigned: Card[] = []

  for (const [type, count] of targets.entries()) {
    for (let i = 0; i < count; i += 1) {
      const card = shuffled.pop()
      if (!card) break
      assigned.push({ ...card, cardType: type })
    }
  }

  while (shuffled.length > 0) {
    const card = shuffled.pop()
    if (!card) break
    assigned.push({ ...card, cardType: pickWeightedType() })
  }

  return shuffle(assigned)
}

export function pickWeightedType(seed?: string): CardType {
  const roll = seed
    ? (hashString(seed) / 0xffffffff) * sum(CARD_TYPE_DISTRIBUTION)
    : Math.random() * sum(CARD_TYPE_DISTRIBUTION)

  let cursor = roll
  for (const entry of CARD_TYPE_DISTRIBUTION) {
    cursor -= entry.weight
    if (cursor <= 0) return entry.type
  }

  return 'attack'
}

/**
 * Deterministic fallback for systems that need a type for a fact outside a built run pool.
 */
export function deriveCardTypeForFactId(factId: string): CardType {
  return pickWeightedType(factId)
}
