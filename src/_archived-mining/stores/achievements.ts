/**
 * achievements.ts
 *
 * Svelte store layer over AchievementManager (Phase 47).
 * Provides reactive access to gallery state for Svelte components.
 */
import { writable, get } from 'svelte/store'
import { achievementManager } from '../../game/managers/AchievementManager'
import type { Painting } from '../../data/paintings'
import type { PaintingUnlock } from '../../game/managers/AchievementManager'

/** All paintings with their unlock status — updates when a reveal fires. */
export const allPaintings = writable<(Painting & { unlocked: boolean })[]>([])

/** Queue of paintings waiting for their reveal animation. */
export const pendingReveal = writable<PaintingUnlock | null>(null)

/** Completion stats: { unlocked, total, percentage } */
export const completionStats = writable({ unlocked: 0, total: 20, percentage: 0 })

/** True if the reveal overlay is currently animating. */
export const isRevealing = writable(false)

/** Initialise the store from saved data. Call once on app boot after PlayerSave loads. */
export function initAchievements(unlockedIds: string[]): void {
  achievementManager.init(unlockedIds)
  allPaintings.set(achievementManager.getAllPaintings())
  completionStats.set(achievementManager.getCompletionStats())
}

/**
 * Check achievements against current player stats.
 * Called after every dive completion, boss defeat, and save migration.
 * Returns newly unlocked paintings so callers can queue celebrations.
 */
export function checkAchievements(
  playerStats: Record<string, number>,
  defeatedBosses: string[],
): PaintingUnlock[] {
  const newUnlocks = achievementManager.checkPaintings(playerStats, defeatedBosses)
  if (newUnlocks.length > 0) {
    allPaintings.set(achievementManager.getAllPaintings())
    completionStats.set(achievementManager.getCompletionStats())
    // Start reveal queue
    drainRevealQueue()
  }
  return newUnlocks
}

/** Pop the next pending reveal for the overlay to consume. */
export function drainRevealQueue(): void {
  if (get(isRevealing)) return
  const next = achievementManager.getNextReveal()
  if (next) {
    isRevealing.set(true)
    pendingReveal.set(next)
  }
}

/** Called by PaintRevealOverlay when its animation completes. */
export function markRevealComplete(): void {
  isRevealing.set(false)
  pendingReveal.set(null)
  allPaintings.set(achievementManager.getAllPaintings())
  completionStats.set(achievementManager.getCompletionStats())
  // Chain next reveal if queued
  drainRevealQueue()
}

/** Get IDs of all unlocked paintings for save persistence. */
export function getUnlockedPaintingIds(): string[] {
  return achievementManager.getUnlockedIds()
}
