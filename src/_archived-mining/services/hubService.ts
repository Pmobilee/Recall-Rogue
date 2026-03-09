import { get } from 'svelte/store'
import { playerSave, persistPlayer } from '../ui/stores/playerData'
import { getDefaultHubStack } from '../data/hubFloors'

/**
 * Checks if a floor can be unlocked based on current save state.
 *
 * @param floorId - The ID of the floor to check.
 * @returns An object with `allowed` indicating if unlock is possible, and an optional `reason`.
 */
export function canUnlockFloor(floorId: string): { allowed: boolean; reason?: string } {
  const save = get(playerSave)
  if (!save) return { allowed: false, reason: 'No save' }

  const floor = getDefaultHubStack().floors.find(f => f.id === floorId)
  if (!floor || !floor.unlockRequirements) return { allowed: false, reason: 'No floor or requirements' }

  if (save.hubState.unlockedFloorIds.includes(floorId)) return { allowed: false, reason: 'Already unlocked' }

  const req = floor.unlockRequirements
  if (req.prerequisiteFloorIds) {
    for (const prereqId of req.prerequisiteFloorIds) {
      if (!save.hubState.unlockedFloorIds.includes(prereqId)) {
        return { allowed: false, reason: `Requires ${prereqId} unlocked first` }
      }
    }
  }
  if (req.divesCompleted && save.stats.totalDivesCompleted < req.divesCompleted) return { allowed: false, reason: `Need ${req.divesCompleted} dives` }
  if (req.factsLearned && save.learnedFacts.length < req.factsLearned) return { allowed: false, reason: `Need ${req.factsLearned} facts` }
  if (req.factsMastered) {
    const mastered = save.reviewStates.filter(rs => rs.repetitions >= 6).length
    if (mastered < req.factsMastered) return { allowed: false, reason: `Need ${req.factsMastered} mastered facts` }
  }
  if (req.deepestLayer && save.stats.deepestLayerReached < req.deepestLayer) return { allowed: false, reason: `Need layer ${req.deepestLayer}` }
  if (req.dustCost && save.minerals.dust < req.dustCost) return { allowed: false, reason: `Need ${req.dustCost} dust` }

  return { allowed: true }
}

/**
 * Unlocks a hub floor, spending dust if required.
 *
 * @param floorId - The ID of the floor to unlock.
 * @returns `true` on success, `false` if requirements are not met.
 */
export function unlockFloor(floorId: string): boolean {
  const check = canUnlockFloor(floorId)
  if (!check.allowed) return false

  const floor = getDefaultHubStack().floors.find(f => f.id === floorId)
  if (!floor) return false

  playerSave.update(s => {
    if (!s) return s
    const dustCost = floor.unlockRequirements?.dustCost ?? 0
    return {
      ...s,
      minerals: {
        ...s.minerals,
        dust: Math.max(0, s.minerals.dust - dustCost),
      },
      hubState: {
        ...s.hubState,
        unlockedFloorIds: [...s.hubState.unlockedFloorIds, floorId],
        floorTiers: { ...s.hubState.floorTiers, [floorId]: 0 },
      },
    }
  })

  persistPlayer()
  return true
}

/**
 * Returns the next locked floor (the one directly above the highest unlocked floor in the stack).
 *
 * @returns The next locked HubFloor, or null if all floors are unlocked.
 */
export function getNextLockedFloor() {
  const save = get(playerSave)
  if (!save) return null

  const stack = getDefaultHubStack()
  const unlockedIds = save.hubState.unlockedFloorIds

  for (const floor of stack.floors) {
    if (!unlockedIds.includes(floor.id)) {
      return floor
    }
  }
  return null
}
