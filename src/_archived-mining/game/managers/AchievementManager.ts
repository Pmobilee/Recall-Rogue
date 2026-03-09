import { PAINTINGS, isPaintingUnlocked, type Painting } from '../../data/paintings'

/** Achievement event types */
export type AchievementEvent = 'fact_mastered' | 'dive_completed' | 'streak_updated' | 'boss_defeated' | 'companion_evolved' | 'relic_found' | 'biome_discovered' | 'mineral_collected'

/** Newly unlocked painting */
export interface PaintingUnlock {
  painting: Painting
  unlockedAt: string
}

class AchievementManager {
  private unlockedPaintings: Set<string> = new Set()
  private pendingReveals: PaintingUnlock[] = []

  /** Initialize with previously unlocked paintings */
  init(unlockedIds: string[]): void {
    this.unlockedPaintings = new Set(unlockedIds)
  }

  /** Check all paintings against current stats; return newly unlocked ones */
  checkPaintings(playerStats: Record<string, number>, defeatedBosses: string[]): PaintingUnlock[] {
    const newUnlocks: PaintingUnlock[] = []

    for (const painting of PAINTINGS) {
      if (this.unlockedPaintings.has(painting.id)) continue
      if (isPaintingUnlocked(painting, playerStats, defeatedBosses)) {
        this.unlockedPaintings.add(painting.id)
        const unlock: PaintingUnlock = { painting, unlockedAt: new Date().toISOString() }
        newUnlocks.push(unlock)
        this.pendingReveals.push(unlock)
      }
    }

    return newUnlocks
  }

  /** Get the next painting to reveal (FIFO queue) */
  getNextReveal(): PaintingUnlock | null {
    return this.pendingReveals.shift() ?? null
  }

  /** Check if there are pending reveals */
  hasPendingReveals(): boolean {
    return this.pendingReveals.length > 0
  }

  /** Get all unlocked paintings */
  getUnlockedPaintings(): Painting[] {
    return PAINTINGS.filter(p => this.unlockedPaintings.has(p.id))
  }

  /** Get all paintings (for gallery display, locked ones show silhouette) */
  getAllPaintings(): (Painting & { unlocked: boolean })[] {
    return PAINTINGS.map(p => ({ ...p, unlocked: this.unlockedPaintings.has(p.id) }))
  }

  /** Get completion stats */
  getCompletionStats(): { unlocked: number; total: number; percentage: number } {
    const unlocked = this.unlockedPaintings.size
    const total = PAINTINGS.length
    return { unlocked, total, percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0 }
  }

  /** Get unlocked painting IDs for save persistence */
  getUnlockedIds(): string[] {
    return [...this.unlockedPaintings]
  }
}

export const achievementManager = new AchievementManager()
