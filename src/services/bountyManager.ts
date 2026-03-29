import type { FactDomain } from '../data/card-types'

export type BountyCondition =
  | { type: 'domain_correct'; domain: FactDomain; count: number }
  | { type: 'flawless_encounters'; count: number }
  | { type: 'reach_floor'; floor: number }
  | { type: 'speed_answers'; count: number; maxTimeMs: number }
  | { type: 'perfect_turn'; count: number }
  | { type: 'total_correct'; count: number }
  | { type: 'combo_reach'; combo: number }

export interface BountyTemplate {
  id: string
  name: string
  description: string
  rewardLabel: string
  condition: BountyCondition
}

export interface ActiveBounty {
  id: string
  name: string
  description: string
  rewardLabel: string
  condition: BountyCondition
  progress: number
  target: number
  completed: boolean
}

export type BountyEvent =
  | { type: 'card_correct'; domain: FactDomain; responseTimeMs?: number }
  | { type: 'encounter_won'; flawless: boolean }
  | { type: 'floor_reached'; floor: number }
  | { type: 'perfect_turn' }
  | { type: 'combo_reached'; combo: number }

const BOUNTY_TEMPLATES: BountyTemplate[] = [
  {
    id: 'science_surge',
    name: 'Science Surge',
    description: 'Answer 5 Science cards correctly',
    rewardLabel: '+1 reward card',
    condition: { type: 'domain_correct', domain: 'science', count: 5 },
  },
  {
    id: 'history_hunter',
    name: 'History Hunter',
    description: 'Answer 5 History cards correctly',
    rewardLabel: '+1 reward card',
    condition: { type: 'domain_correct', domain: 'history', count: 5 },
  },
  {
    id: 'flawless_three',
    name: 'Flawless Descent',
    description: 'Win 3 encounters without wrong answers',
    rewardLabel: '+50% grey matter',
    condition: { type: 'flawless_encounters', count: 3 },
  },
  {
    id: 'floor_six',
    name: 'Deep Delve',
    description: 'Reach Floor 6',
    rewardLabel: '+50% grey matter',
    condition: { type: 'reach_floor', floor: 6 },
  },
  {
    id: 'speed_ten',
    name: 'Speed Caster',
    description: 'Answer 10 cards under 3s',
    rewardLabel: 'Card upgrade token',
    condition: { type: 'speed_answers', count: 10, maxTimeMs: 3000 },
  },
  {
    id: 'perfect_turn',
    name: 'Perfect Form',
    description: 'Perform 1 perfect turn (3/3)',
    rewardLabel: 'Cosmetic frame',
    condition: { type: 'perfect_turn', count: 1 },
  },
  {
    id: 'knowledge_twenty',
    name: 'Knowledge Seeker',
    description: 'Get 20 correct answers',
    rewardLabel: '+30% grey matter',
    condition: { type: 'total_correct', count: 20 },
  },
  {
    id: 'combo_four',
    name: 'Combo Master',
    description: 'Reach combo x4',
    rewardLabel: 'Card upgrade token',
    condition: { type: 'combo_reach', combo: 4 },
  },
]

function getTarget(condition: BountyCondition): number {
  switch (condition.type) {
    case 'domain_correct': return condition.count
    case 'flawless_encounters': return condition.count
    case 'reach_floor': return condition.floor
    case 'speed_answers': return condition.count
    case 'perfect_turn': return condition.count
    case 'total_correct': return condition.count
    case 'combo_reach': return condition.combo
  }
}

function matchesRunDomains(template: BountyTemplate, domains: Set<FactDomain>): boolean {
  if (template.condition.type !== 'domain_correct') return true
  return domains.has(template.condition.domain)
}

function shuffle<T>(values: T[]): T[] {
  const arr = [...values]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function selectRunBounties(
  primaryDomain: FactDomain,
  secondaryDomain: FactDomain,
  count = 2,
): ActiveBounty[] {
  const domains = new Set<FactDomain>([primaryDomain, secondaryDomain])
  const eligible = BOUNTY_TEMPLATES.filter((template) => matchesRunDomains(template, domains))
  const picked = shuffle(eligible).slice(0, Math.max(1, Math.min(count, eligible.length)))

  return picked.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    rewardLabel: template.rewardLabel,
    condition: template.condition,
    progress: 0,
    target: getTarget(template.condition),
    completed: false,
  }))
}

function nextProgress(bounty: ActiveBounty, event: BountyEvent): number {
  const condition = bounty.condition

  if (condition.type === 'domain_correct') {
    if (event.type === 'card_correct' && event.domain === condition.domain) return bounty.progress + 1
    return bounty.progress
  }

  if (condition.type === 'flawless_encounters') {
    if (event.type === 'encounter_won' && event.flawless) return bounty.progress + 1
    return bounty.progress
  }

  if (condition.type === 'reach_floor') {
    if (event.type === 'floor_reached') return Math.max(bounty.progress, event.floor)
    return bounty.progress
  }

  if (condition.type === 'speed_answers') {
    if (event.type === 'card_correct' && typeof event.responseTimeMs === 'number' && event.responseTimeMs <= condition.maxTimeMs) {
      return bounty.progress + 1
    }
    return bounty.progress
  }

  if (condition.type === 'perfect_turn') {
    if (event.type === 'perfect_turn') return bounty.progress + 1
    return bounty.progress
  }

  if (condition.type === 'total_correct') {
    if (event.type === 'card_correct') return bounty.progress + 1
    return bounty.progress
  }

  if (condition.type === 'combo_reach') {
    if (event.type === 'combo_reached') return Math.max(bounty.progress, event.combo)
    return bounty.progress
  }

  return bounty.progress
}

export function updateBounties(active: ActiveBounty[], event: BountyEvent): ActiveBounty[] {
  return active.map((bounty) => {
    if (bounty.completed) return bounty
    const progress = nextProgress(bounty, event)
    const completed = progress >= bounty.target
    return {
      ...bounty,
      progress,
      completed,
    }
  })
}

export function completedBounties(active: ActiveBounty[]): ActiveBounty[] {
  return active.filter((bounty) => bounty.completed)
}
