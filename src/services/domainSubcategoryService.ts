import type { FactDomain, CanonicalFactDomain } from '../data/card-types'
import { normalizeFactDomain } from '../data/card-types'
import { getSubcategoryLabel } from '../data/subcategoryTaxonomy'
import { factsDB } from './factsDB'
import { resolveDomain } from './domainResolver'

export interface DomainSubcategoryInfo {
  id: string
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

/** Module-level cache — survives across component re-renders. */
const _cache = new Map<string, DomainSubcategoryInfo[]>()

/**
 * Returns sub-categories available for a domain, sorted by fact count desc.
 * Results are memoized at the module level so the full scan only runs once per domain.
 */
export function getDomainSubcategories(domain: FactDomain): DomainSubcategoryInfo[] {
  if (!factsDB.isReady()) return []
  const canonical = normalizeFactDomain(domain)
  const cached = _cache.get(canonical)
  if (cached) return cached

  const counts = new Map<string, number>()
  for (const fact of factsDB.getAll()) {
    if (normalizeFactDomain(resolveDomain(fact)) !== canonical) continue
    const key = getFactSubcategory(fact)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const result = [...counts.entries()]
    .map(([id, count]) => ({
      id,
      name: getSubcategoryLabel(canonical as CanonicalFactDomain, id),
      count,
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
  _cache.set(canonical, result)
  return result
}
