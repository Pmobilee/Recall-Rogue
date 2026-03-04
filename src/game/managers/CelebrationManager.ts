import { BALANCE } from '../../data/balance'
import type { PlayerSave } from '../../data/types'

/** Celebration tier determines the visual intensity of the event. */
export type CelebrationTier = 'glow' | 'mini' | 'banner' | 'medium' | 'major' | 'fullscreen'

export interface CelebrationEvent {
  tier: CelebrationTier
  /** Dust awarded immediately on celebration trigger. */
  dustBonus: number
  /** Title string to unlock, or null. */
  title: string | null
  /** Key into gaiaDialogue to play. */
  gaiaKey: string
  /** The mastery count that triggered this event (for GAIA interpolation). */
  masteryCount: number
  /** The fact statement of the newly mastered fact. */
  factStatement: string
  /** Category of the mastered fact (for category-completion check). */
  category: string
}

/** Callback types expected by consumers (Svelte components). */
export type OnCelebrationCallback = (event: CelebrationEvent) => void

/**
 * CelebrationManager queues and dispatches mastery celebration events.
 * All code paths that trigger mastery (StudyManager answer grading) must
 * call notifyMastery() on this manager.
 */
export class CelebrationManager {
  private queue: CelebrationEvent[] = []
  private busy = false
  private listeners: OnCelebrationCallback[] = []

  constructor(private getSave: () => PlayerSave) {}

  /**
   * Called by StudyManager whenever a fact crosses the mastery threshold.
   * Matches against BALANCE.MASTERY_CELEBRATION_THRESHOLDS to find the
   * appropriate celebration tier.
   */
  notifyMastery(masteryCount: number, factStatement: string, category: string): void {
    const threshold = (BALANCE.MASTERY_CELEBRATION_THRESHOLDS as readonly { count: number; tier: string; dustBonus: number; title: string | null; gaiaKey: string }[]).find(t => t.count === masteryCount)
    if (!threshold) {
      // Counts 2-9 that are not milestone triggers still get a glow
      if (masteryCount >= 2 && masteryCount <= 9) {
        this.enqueue({
          tier: 'glow',
          dustBonus: 5,
          title: null,
          gaiaKey: 'masteryN',
          masteryCount,
          factStatement,
          category,
        })
      }
      return
    }

    this.enqueue({
      tier: threshold.tier as CelebrationTier,
      dustBonus: threshold.dustBonus,
      title: threshold.title,
      gaiaKey: threshold.gaiaKey,
      masteryCount,
      factStatement,
      category,
    })
  }

  /**
   * Called when a Knowledge Tree category reaches 100% mastery.
   * Per DD-V2-123: major full-screen celebration, unique badge, challenge mode unlock.
   */
  notifyCategoryComplete(categoryName: string): void {
    this.enqueue({
      tier: 'fullscreen',
      dustBonus: 750,
      title: null,
      gaiaKey: 'categoryComplete',
      masteryCount: -1,
      factStatement: '',
      category: categoryName,
    })
  }

  /** Register a Svelte component callback to receive events. */
  subscribe(cb: OnCelebrationCallback): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb)
    }
  }

  /** Called by the component when the celebration animation finishes. */
  markComplete(): void {
    this.busy = false
    this.drain()
  }

  private enqueue(event: CelebrationEvent): void {
    this.queue.push(event)
    this.drain()
  }

  private drain(): void {
    if (this.busy || this.queue.length === 0) return
    this.busy = true
    const next = this.queue.shift()!
    this.listeners.forEach(l => l(next))
  }
}
