import type { FactDomain } from '../data/card-types'
import { normalizeFactDomain } from '../data/card-types'
import { factsDB } from './factsDB'
import { resolveDomain } from './domainResolver'

export interface DomainSubcategoryInfo {
  name: string
  count: number
}

function getFactSubcategory(fact: { category: string[]; categoryL2?: string }): string {
  const second = fact.category[1]?.trim()
  if (second) return second
  const l2 = fact.categoryL2?.trim()
  if (l2) return l2
  return 'General'
}

/**
 * Returns sub-categories available for a domain, sorted by fact count desc.
 * If the facts DB is not ready yet, returns an empty array.
 */
export function getDomainSubcategories(domain: FactDomain): DomainSubcategoryInfo[] {
  if (!factsDB.isReady()) return []
  const canonical = normalizeFactDomain(domain)
  const counts = new Map<string, number>()
  for (const fact of factsDB.getAll()) {
    if (normalizeFactDomain(resolveDomain(fact)) !== canonical) continue
    const key = getFactSubcategory(fact)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
}

