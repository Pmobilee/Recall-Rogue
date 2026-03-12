import type { CardTier, FactDomain } from '../data/card-types'
import { getAllDomainMetadata } from '../data/domainMetadata'
import { normalizeFactDomain } from '../data/card-types'
import type { Fact, ReviewState } from '../data/types'
import { resolveDomain } from './domainResolver'
import { getCardTier } from './tierDerivation'

export type LibraryTierFilter = 'all' | CardTier | 'unseen'
export type LibrarySortBy = 'name' | 'tier' | 'accuracy' | 'lastReview'

export interface LibraryDomainSummary {
  domain: FactDomain
  totalFacts: number
  encounteredFacts: number
  tier1Count: number
  tier2aCount: number
  tier2bCount: number
  tier3Count: number
  completionPercent: number
  masteryPercent: number
}

export interface LibraryFactEntry {
  fact: Fact
  state: ReviewState | null
  tier: CardTier | 'unseen'
  accuracy: number
}

const TIER_ORDER: Record<LibraryFactEntry['tier'], number> = {
  unseen: 0,
  '1': 1,
  '2a': 2,
  '2b': 3,
  '3': 4,
}

function toAccuracy(state: ReviewState | null): number {
  if (!state) return 0
  const attempts = state.totalAttempts ?? 0
  if (attempts <= 0) return 0
  return Math.round(((state.totalCorrect ?? 0) / attempts) * 100)
}

function toEntry(fact: Fact, state: ReviewState | null): LibraryFactEntry {
  return {
    fact,
    state,
    tier: state ? getCardTier(state) : 'unseen',
    accuracy: toAccuracy(state),
  }
}

export function buildDomainSummaries(facts: Fact[], reviewStates: ReviewState[]): LibraryDomainSummary[] {
  const stateByFact = new Map(reviewStates.map((state) => [state.factId, state]))

  const domainMap = new Map<FactDomain, {
    totalFacts: number
    encounteredFacts: number
    tier1Count: number
    tier2aCount: number
    tier2bCount: number
    tier3Count: number
  }>()
  for (const domain of getAllDomainMetadata()) {
    domainMap.set(domain.id, {
      totalFacts: 0,
      encounteredFacts: 0,
      tier1Count: 0,
      tier2aCount: 0,
      tier2bCount: 0,
      tier3Count: 0,
    })
  }

  for (const fact of facts) {
    const domain = normalizeFactDomain(resolveDomain(fact))
    const summary = domainMap.get(domain)
    if (!summary) continue

    summary.totalFacts += 1
    const state = stateByFact.get(fact.id) ?? null
    if (!state) continue

    summary.encounteredFacts += 1
    const tier = getCardTier(state)
    if (tier === '1') summary.tier1Count += 1
    else if (tier === '2a') summary.tier2aCount += 1
    else if (tier === '2b') summary.tier2bCount += 1
    else if (tier === '3') summary.tier3Count += 1
  }

  const summaries: LibraryDomainSummary[] = []
  for (const [domain, stats] of domainMap.entries()) {
    summaries.push({
      domain,
      totalFacts: stats.totalFacts,
      encounteredFacts: stats.encounteredFacts,
      tier1Count: stats.tier1Count,
      tier2aCount: stats.tier2aCount,
      tier2bCount: stats.tier2bCount,
      tier3Count: stats.tier3Count,
      completionPercent: Math.round((stats.tier3Count / Math.max(1, stats.totalFacts)) * 100),
      masteryPercent: stats.encounteredFacts > 0
        ? Math.round(((stats.tier2aCount + stats.tier2bCount + stats.tier3Count) / stats.encounteredFacts) * 100)
        : 0,
    })
  }

  const domainOrder = new Map<string, number>(getAllDomainMetadata().map((domain, index) => [domain.id, index]))
  return summaries.sort((a, b) => (domainOrder.get(a.domain) ?? 999) - (domainOrder.get(b.domain) ?? 999))
}

export function buildDomainEntries(
  domain: FactDomain,
  facts: Fact[],
  reviewStates: ReviewState[],
  filter: LibraryTierFilter = 'all',
  sortBy: LibrarySortBy = 'tier',
  subcategory?: string,
): LibraryFactEntry[] {
  const stateByFact = new Map(reviewStates.map((state) => [state.factId, state]))
  const normalizedDomain = normalizeFactDomain(domain)
  const entries: LibraryFactEntry[] = []

  for (const fact of facts) {
    if (normalizeFactDomain(resolveDomain(fact)) !== normalizedDomain) continue
    if (subcategory !== undefined) {
      const factSubcategory = fact.categoryL2?.trim() || fact.category[1]?.trim() || 'General'
      if (factSubcategory !== subcategory) continue
    }
    const entry = toEntry(fact, stateByFact.get(fact.id) ?? null)
    if (filter !== 'all' && entry.tier !== filter) continue
    entries.push(entry)
  }

  entries.sort((a, b) => {
    if (sortBy === 'name') return a.fact.statement.localeCompare(b.fact.statement)
    if (sortBy === 'accuracy') return b.accuracy - a.accuracy
    if (sortBy === 'lastReview') return (b.state?.lastReview ?? 0) - (a.state?.lastReview ?? 0)
    return TIER_ORDER[b.tier] - TIER_ORDER[a.tier]
  })

  return entries
}
