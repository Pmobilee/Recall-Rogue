import { writable, derived, type Readable } from 'svelte/store'

export interface OmniscientStatus {
  isOmniscient: boolean
  totalFacts: number
  masteredFacts: number
  masteryPercentage: number
  title: string
  unlockedFeatures: string[]
}

/** Current omniscient status */
export const omniscientStatus = writable<OmniscientStatus>({
  isOmniscient: false,
  totalFacts: 0,
  masteredFacts: 0,
  masteryPercentage: 0,
  title: '',
  unlockedFeatures: []
})

/** Whether the Golden Dome visual should be active */
export const goldenDomeActive: Readable<boolean> = derived(
  omniscientStatus,
  $status => $status.isOmniscient
)

/** Mastery threshold for Omniscient status */
const OMNISCIENT_THRESHOLD = 0.95  // 95% of all facts mastered

/**
 * Check and update Omniscient status.
 * DD-V2-161: Omniscient = mastered 95% of all available facts.
 */
export function checkOmniscientStatus(totalFacts: number, masteredFacts: number): OmniscientStatus {
  const masteryPercentage = totalFacts > 0 ? masteredFacts / totalFacts : 0
  const isOmniscient = masteryPercentage >= OMNISCIENT_THRESHOLD

  const unlockedFeatures: string[] = []
  let title = ''

  if (isOmniscient) {
    title = 'The Omniscient'
    unlockedFeatures.push('golden_dome', 'ugc_pipeline', 'gaia_peer_mode', 'omniscient_title')
  } else if (masteryPercentage >= 0.75) {
    title = 'Grand Scholar'
    unlockedFeatures.push('gaia_peer_mode')
  } else if (masteryPercentage >= 0.50) {
    title = 'Knowledge Seeker'
  }

  const status: OmniscientStatus = {
    isOmniscient,
    totalFacts,
    masteredFacts,
    masteryPercentage,
    title,
    unlockedFeatures
  }

  omniscientStatus.set(status)
  return status
}
