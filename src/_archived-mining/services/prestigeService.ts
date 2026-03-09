/**
 * Prestige service — eligibility checks, bonus computation, and reset application.
 * DD-V2-050: voluntary SM-2 reset for permanent passive bonuses.
 */
import { get } from 'svelte/store'
import { playerSave, persistPlayer } from '../ui/stores/playerData'
import { getCumulativePrestigeBonus, PRESTIGE_LEVELS } from '../data/prestigeConfig'
import type { PlayerSave } from '../data/types'
import { isMastered } from './sm2'
import { analyticsService } from './analyticsService'

/** Maximum prestige level a player can reach. */
export const PRESTIGE_MAX_LEVEL = 10

/**
 * Returns true when the player has mastered every fact in their reviewStates.
 * "Mastered" means isMastered() returns true for all tracked facts.
 * If the player has fewer than 50 mastered facts total, they cannot prestige
 * regardless (guard against accidental prestige on tiny saves).
 *
 * @param save - The player save to evaluate.
 */
export function isEligibleForPrestige(save: PlayerSave): boolean {
  if ((save.prestigeLevel ?? 0) >= PRESTIGE_MAX_LEVEL) return false
  if (save.reviewStates.length < 50) return false
  return save.reviewStates.every(rs => isMastered(rs))
}

/**
 * Returns true when every tracked fact in the save is mastered.
 * Also gates on a minimum of 50 facts to avoid false positives on new saves.
 *
 * @param save - The player save to evaluate.
 */
export function isOmniscient(save: PlayerSave): boolean {
  if (!save || save.reviewStates.length < 50) return false
  return save.reviewStates.every(rs => isMastered(rs))
}

/**
 * Returns the active cumulative prestige bonus for the current save.
 *
 * @param save - The player save to compute bonus for.
 */
export function getActivePrestigeBonus(save: PlayerSave) {
  return getCumulativePrestigeBonus(save.prestigeLevel ?? 0)
}

/**
 * Applies a prestige reset. MUST only be called after explicit player confirmation.
 * - Increments prestigeLevel
 * - Resets all reviewStates to repetitions=0, interval=0, nextReviewAt=0
 * - Accumulates lifetimeMasteredFacts from current mastered count
 * - Unlocks title from PrestigeLevel config
 * - Does NOT reset: minerals, cosmetics, companions, dome upgrades, achievements
 *
 * @param save - The current player save.
 * @returns A new PlayerSave with prestige applied.
 * @throws Error if attempting to prestige beyond PRESTIGE_MAX_LEVEL.
 */
export function applyPrestige(save: PlayerSave): PlayerSave {
  const newLevel = (save.prestigeLevel ?? 0) + 1
  if (newLevel > PRESTIGE_MAX_LEVEL) {
    throw new Error('Cannot prestige beyond level ' + PRESTIGE_MAX_LEVEL)
  }

  const masteredCount = save.reviewStates.filter(rs => isMastered(rs)).length
  const config = PRESTIGE_LEVELS.find(p => p.level === newLevel)
  const newTitle = config?.bonus.unlocksTitleId

  const resetReviewStates = save.reviewStates.map(rs => ({
    ...rs,
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewAt: 0,
    lastReviewAt: rs.lastReviewAt, // preserve history timestamp
    quality: 0,
  }))

  const updatedTitles = newTitle && !save.titles.includes(newTitle)
    ? [...save.titles, newTitle]
    : save.titles

  analyticsService.track({
    name: 'prestige_triggered',
    properties: {
      new_level: newLevel,
      lifetime_mastered: (save.lifetimeMasteredFacts ?? 0) + masteredCount,
    },
  })

  return {
    ...save,
    prestigeLevel: newLevel,
    prestigedAt: [...(save.prestigedAt ?? []), Date.now()],
    lifetimeMasteredFacts: (save.lifetimeMasteredFacts ?? 0) + masteredCount,
    reviewStates: resetReviewStates,
    titles: updatedTitles,
  }
}
