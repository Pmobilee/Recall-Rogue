import { tapMedium, tapHeavy, notifyWarning } from './hapticService'
import { playCardAudio, type CardAudioCue } from './cardAudioManager'

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
  | 'player-damage'
  | 'shield-absorb'
  | 'shield-break'
  | 'shield-gain'
  | 'player-heal'
  | 'player-defeated'
  | 'enemy-attack'
  | 'enemy-charge-release'
  | 'enemy-enrage'
  | 'encounter-start'
  | 'encounter-victory'
  | 'encounter-defeat'
  | 'surge-announce'
  | 'perfect-turn'
  | 'chain-link-1'
  | 'chain-link-2'
  | 'chain-link-3'
  | 'chain-link-4'
  | 'chain-link-5'
  | 'chain-break'

/** Emit a sound event. Currently no-op; wire to audioService in CR-17. */
export function emitSound(event: JuiceSoundEvent): void {
  const cue = event as CardAudioCue
  playCardAudio(cue)
}

export interface JuiceEvent {
  type: 'correct' | 'wrong'
  damage?: number
  isCritical?: boolean  // Speed bonus achieved
  effectLabel?: string  // e.g. "HEAL 8", "SHIELD 15"
  isPerfectTurn?: boolean
  cardType?: string
  hitCount?: number  // For multi-hit cards: stagger juice across N hits
}

/** Callbacks registered by UI components to receive juice events */
export interface JuiceCallbacks {
  onScreenFlash?: (intensity: number) => void
  onDamageNumber?: (value: string, isCritical: boolean) => void
  onEnemyHit?: () => void
  onParticleBurst?: (count: number, tint: number) => void
  onSpeedBonusPop?: () => void
  onKillConfirmation?: () => void
  /**
   * Called on correct answer (T+0ms, parallel to existing juice).
   * @param cardPlayX Screen x-coordinate of the card play area (for light pulse origin).
   * @param cardPlayY Screen y-coordinate of the card play area.
   */
  onAtmosphereWarm?: (cardPlayX: number, cardPlayY: number) => void
  /**
   * Called on wrong answer (T+0ms, parallel to existing juice).
   */
  onAtmosphereCold?: () => void
}

/** Streak threshold for persistent ambient shift. */
const STREAK_THRESHOLD = 3

class JuiceManager {
  private callbacks: JuiceCallbacks = {}

  // ── Knowledge streak counters (Spec 05) ───────────────────────────────────
  /** Count of consecutive correct answers this encounter. Resets on wrong. */
  private consecutiveCorrect: number = 0
  /** Count of consecutive wrong answers this encounter. Resets on correct. */
  private consecutiveWrong: number = 0

  /** Register callbacks from Phaser scene or Svelte components */
  setCallbacks(cb: Partial<JuiceCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...cb }
  }

  /** Clear callbacks on scene shutdown */
  clearCallbacks(): void {
    this.callbacks = {}
  }

  /**
   * Reset streak counters between encounters.
   * Call from CombatScene.setEnemy() at encounter start.
   */
  resetStreak(): void {
    this.consecutiveCorrect = 0
    this.consecutiveWrong = 0
  }

  /** Fire the full juice stack for a correct or wrong answer */
  fire(event: JuiceEvent): void {
    if (event.type === 'correct' && event.hitCount && event.hitCount > 1) {
      this.fireMultiHit(event, event.hitCount)
      return
    }
    if (event.type === 'correct') {
      this.fireCorrect(event)
    } else {
      this.fireWrong(event)
    }
  }

  /** Fire kill confirmation juice (heavy haptic burst). */
  fireKillConfirmation(): void {
    tapHeavy()
    setTimeout(() => tapHeavy(), 60)
    setTimeout(() => tapHeavy(), 120)
    emitSound('enemy-death')
    this.callbacks.onKillConfirmation?.()
  }

  /**
   * Fire a staggered multi-hit juice sequence. Each hit fires with increasing intensity.
   * Creates fighting game combo feel with timed haptics, flashes, damage numbers, and particles.
   */
  private fireMultiHit(event: JuiceEvent, hitCount: number): void {
    const baseDelay = 90 // ms between hits
    const perHitDamage = event.damage ? Math.round(event.damage / hitCount) : 0

    for (let i = 0; i < hitCount; i++) {
      const isLastHit = i === hitCount - 1
      const hitDelay = i * baseDelay

      setTimeout(() => {
        // Haptic per hit: last hit is heavier
        if (isLastHit && event.isCritical) {
          tapHeavy()
          setTimeout(() => tapHeavy(), 80)
        } else {
          tapHeavy()
        }

        // Screen flash — last hit is stronger
        const flashIntensity = isLastHit ? 0.4 : 0.2
        this.callbacks.onScreenFlash?.(flashIntensity)

        // Damage number per hit — last hit shows remainder, others show per-hit amount
        const hitDamageValue = isLastHit
          ? Math.max(perHitDamage, event.damage! - perHitDamage * (hitCount - 1))
          : perHitDamage
        this.callbacks.onDamageNumber?.(String(hitDamageValue), isLastHit && (event.isCritical ?? false))

        // Enemy hit animation per hit
        this.callbacks.onEnemyHit?.()

        // Particles — last hit gets more
        const particleCount = isLastHit ? 25 : 12
        const tint = isLastHit ? 0xFF4444 : 0xFFD700
        this.callbacks.onParticleBurst?.(particleCount, tint)

        // Sound per hit
        emitSound(isLastHit && event.isCritical ? 'correct-critical' : 'correct-impact')
      }, hitDelay)
    }

    // Perfect turn celebration fires after all hits complete
    const totalDelay = (hitCount - 1) * baseDelay + 50
    setTimeout(() => {
      if (event.isPerfectTurn) {
        setTimeout(() => {
          this.callbacks.onScreenFlash?.(0.2)
          this.callbacks.onParticleBurst?.(50, 0xFFD700)
          emitSound('combo-5')
        }, 500)
      }
    }, totalDelay)
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

    // T+0ms: Speed bonus (critical hit): freeze frame pop
    if (event.isCritical) {
      this.callbacks.onSpeedBonusPop?.()
    }

    // T+0ms: Screen flash
    this.callbacks.onScreenFlash?.(event.isCritical ? 0.45 : 0.3)

    // T+0ms: Atmosphere warm pulse (Spec 05) — fires in parallel, does not delay other juice
    this.consecutiveCorrect++
    this.consecutiveWrong = 0
    this.callbacks.onAtmosphereWarm?.(
      typeof window !== 'undefined' ? window.innerWidth * 0.5 : 480,
      typeof window !== 'undefined' ? window.innerHeight * 0.75 : 600,
    )

    // Streak threshold: persistent ambient warm shift at 3+ consecutive correct
    if (this.consecutiveCorrect === STREAK_THRESHOLD) {
      // Callback already registered; the atmosphere system reads streak state from its own counters.
      // The warm callback carries the streak intent implicitly — the scene checks consecutiveCorrect
      // on each call by reading from this manager's public accessor.
    }

    // T+50ms: Damage number
    setTimeout(() => {
      const label = event.effectLabel || String(event.damage || 0)
      this.callbacks.onDamageNumber?.(label, event.isCritical ?? false)
    }, 50)

    // T+150ms: Enemy hit + particles (only for attack cards)
    if (!event.cardType || event.cardType === 'attack') {
      setTimeout(() => {
        this.callbacks.onEnemyHit?.()
        emitSound('enemy-hit')
        const particleCount = event.isCritical ? 40 : 30
        const tint = event.isCritical ? 0xFF4444 : 0xFFD700
        this.callbacks.onParticleBurst?.(particleCount, tint)
      }, 150)
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

    // T+0ms: Atmosphere cold flicker (Spec 05) — fires in parallel
    this.consecutiveWrong++
    this.consecutiveCorrect = 0
    this.callbacks.onAtmosphereCold?.()

    // No screen flash, no damage numbers, no enemy reaction
    // The ABSENCE of positive juice IS the feedback
  }

  /** Read current consecutive correct count (used by CombatScene to determine streak level). */
  getConsecutiveCorrect(): number {
    return this.consecutiveCorrect
  }

  /** Read current consecutive wrong count (used by CombatScene to determine streak level). */
  getConsecutiveWrong(): number {
    return this.consecutiveWrong
  }
}

export const juiceManager = new JuiceManager()
