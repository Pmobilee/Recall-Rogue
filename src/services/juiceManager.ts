import { tapMedium, tapHeavy, notifyWarning } from './hapticService'

/** Sound event types for future audio integration */
export type JuiceSoundEvent =
  | 'correct-impact'
  | 'correct-critical'
  | 'wrong-fizzle'
  | 'card-draw'
  | 'enemy-hit'
  | 'enemy-death'
  | 'turn-chime'
  | 'combo-3'
  | 'combo-5'

/** Emit a sound event. Currently no-op; wire to audioService in CR-17. */
export function emitSound(event: JuiceSoundEvent): void {
  if (import.meta.env.DEV) {
    console.debug(`[juice:sound] ${event}`)
  }
}

export interface JuiceEvent {
  type: 'correct' | 'wrong'
  damage?: number
  isCritical?: boolean  // Speed bonus achieved
  comboCount: number
  effectLabel?: string  // e.g. "HEAL 8", "SHIELD 15"
  isPerfectTurn?: boolean
}

/** Callbacks registered by UI components to receive juice events */
export interface JuiceCallbacks {
  onScreenFlash?: (intensity: number) => void
  onDamageNumber?: (value: string, isCritical: boolean) => void
  onEnemyHit?: () => void
  onParticleBurst?: (count: number, tint: number) => void
  onComboMilestone?: (count: number) => void
}

class JuiceManager {
  private callbacks: JuiceCallbacks = {}

  /** Register callbacks from Phaser scene or Svelte components */
  setCallbacks(cb: Partial<JuiceCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...cb }
  }

  /** Clear callbacks on scene shutdown */
  clearCallbacks(): void {
    this.callbacks = {}
  }

  /** Fire the full juice stack for a correct or wrong answer */
  fire(event: JuiceEvent): void {
    if (event.type === 'correct') {
      this.fireCorrect(event)
    } else {
      this.fireWrong(event)
    }
  }

  private fireCorrect(event: JuiceEvent): void {
    // T+0ms: Haptic
    if (event.isCritical) {
      tapHeavy()
      setTimeout(() => tapHeavy(), 80)
      emitSound('correct-critical')
    } else {
      tapHeavy()
      emitSound('correct-impact')
    }

    // T+0ms: Screen flash
    this.callbacks.onScreenFlash?.(event.isCritical ? 0.45 : 0.3)

    // T+50ms: Damage number
    setTimeout(() => {
      const label = event.effectLabel || String(event.damage || 0)
      this.callbacks.onDamageNumber?.(label, event.isCritical ?? false)
    }, 50)

    // T+150ms: Enemy hit + particles
    setTimeout(() => {
      this.callbacks.onEnemyHit?.()
      emitSound('enemy-hit')
      const particleCount = event.isCritical ? 40 : 30
      const tint = event.isCritical ? 0xFF4444 : 0xFFD700
      this.callbacks.onParticleBurst?.(particleCount, tint)
    }, 150)

    // Combo milestones
    if (event.comboCount >= 3) {
      emitSound(event.comboCount >= 5 ? 'combo-5' : 'combo-3')
      tapMedium()
      this.callbacks.onComboMilestone?.(event.comboCount)
    }

    // Perfect turn (5 combo)
    if (event.comboCount >= 5) {
      tapHeavy()
      setTimeout(() => tapHeavy(), 80)
      setTimeout(() => tapHeavy(), 160)
    }

    // Perfect turn celebration (all cards correct this turn)
    if (event.isPerfectTurn) {
      setTimeout(() => {
        this.callbacks.onScreenFlash?.(0.2)
        this.callbacks.onParticleBurst?.(50, 0xFFD700)
        emitSound('combo-5')
      }, 500)
    }
  }

  private fireWrong(_event: JuiceEvent): void {
    // Muted feedback only
    notifyWarning()
    emitSound('wrong-fizzle')
    // No screen flash, no damage numbers, no enemy reaction
    // The ABSENCE of positive juice IS the feedback
  }
}

export const juiceManager = new JuiceManager()
