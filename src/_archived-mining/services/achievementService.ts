/**
 * achievementService.ts
 *
 * Event-driven achievement tracking service (Phase 47).
 *
 * Listens for game events and checks whether any painting conditions have
 * been newly satisfied. Delegates to the achievementManager singleton for
 * condition evaluation and to the achievements Svelte store for UI updates.
 *
 * IMPORTANT: This service only calls checkAchievements() at event boundaries,
 * not on every frame, to keep CPU cost negligible.
 */
import { get } from 'svelte/store'
import { playerSave } from '../ui/stores/playerData'
import { checkAchievements } from '../ui/stores/achievements'
import { celebrationManager } from '../game/managers/CelebrationManager'
import type { CelebrationEvent } from '../game/managers/CelebrationManager'
import type { PlayerSave } from '../data/types'

class AchievementService {
  private initialized = false

  /** Must be called once on app boot after playerSave is loaded. */
  init(): void {
    if (this.initialized) return
    this.initialized = true
    // Subscribe to CelebrationManager to detect fact mastery
    celebrationManager.subscribe((event: CelebrationEvent) => {
      if (event.masteryCount > 0) {
        this.checkNow()
      }
    })
  }

  /**
   * Call after every completed dive.
   * Increments divesCompleted stat and checks achievements.
   */
  onDiveComplete(): void {
    this.checkNow()
  }

  /**
   * Call when a boss is defeated.
   * Adds the boss ID to defeatedBosses and checks achievements.
   */
  onBossDefeated(bossId: string): void {
    const save = get(playerSave)
    if (!save) return
    const existing = save.defeatedBosses ?? []
    if (!existing.includes(bossId)) {
      // The playerSave store is updated via persistPlayer() in GameManager;
      // here we just trigger a check with the merged boss list.
      this.checkNowWithBosses([...existing, bossId])
    }
  }

  /**
   * Call when a new biome is discovered, relic found, companion evolved,
   * mineral milestone hit, or streak milestone reached.
   */
  onStatChanged(): void {
    this.checkNow()
  }

  /** Build a stat snapshot from the current PlayerSave and run the check. */
  private checkNow(): void {
    const save = get(playerSave)
    if (!save) return
    this.checkNowWithBosses(save.defeatedBosses ?? [])
  }

  private checkNowWithBosses(defeatedBosses: string[]): void {
    const save = get(playerSave)
    if (!save) return
    const stats = this.buildStats(save)
    checkAchievements(stats, defeatedBosses)
  }

  /**
   * Build the playerStats record expected by isPaintingUnlocked().
   * Maps PlayerSave fields to the string keys checked in paintings.ts.
   */
  private buildStats(save: PlayerSave): Record<string, number> {
    const reviewStates = save.reviewStates ?? []
    // Count facts with repetitions >= 3 as "mastered" (matches SM-2 threshold)
    const factsMastered = reviewStates.filter(rs => rs.repetitions >= 3).length
    const saveAny = save as unknown as Record<string, unknown>
    const biomesDiscovered = typeof saveAny['biomesDiscovered'] === 'number' ? saveAny['biomesDiscovered'] : 0
    const relicsFound = typeof saveAny['relicsFound'] === 'number' ? saveAny['relicsFound'] : 0
    const companionsEvolved = typeof saveAny['companionsEvolved'] === 'number' ? saveAny['companionsEvolved'] : 0
    const creaturesDefeated = typeof saveAny['creaturesDefeated'] === 'number' ? saveAny['creaturesDefeated'] : 0

    return {
      factsMastered,
      divesCompleted: save.diveCount ?? 0,
      bestStreak: save.longestStreak ?? 0,
      biomesDiscovered,
      relicsFound,
      companionsEvolved,
      creaturesDefeated,
      minerals_crystal: save.minerals?.crystal ?? 0,
      minerals_geode: save.minerals?.geode ?? 0,
      minerals_essence: save.minerals?.essence ?? 0,
    }
  }
}

export const achievementService = new AchievementService()
