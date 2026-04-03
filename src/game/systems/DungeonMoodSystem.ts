import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'
import { isTurboMode } from '../../utils/turboMode'

/**
 * Reads the reduce-motion preference from localStorage.
 * Mirrors the same pattern used in CombatAtmosphereSystem and CombatScene.
 */
function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
  } catch {
    return false
  }
}

/**
 * Input signals that drive the mood calculation each frame.
 * All inputs are normalized to [0, 1] unless noted.
 */
export interface MoodInputs {
  /** 0.0 = dead, 1.0 = full HP. Low HP → high mood (desperate). */
  playerHpRatio: number
  /** Current active chain length (0 = no chain). Chains lower mood. */
  chainLength: number
  /** Consecutive correct answers this encounter. Streaks lower mood. */
  consecutiveCorrect: number
  /** 0.0–1.0 normalized threat from the enemy (HP ratio + intent damage). */
  enemyThreatLevel: number
  /** Raw floor number (1–15+). Deeper floors slightly raise mood. */
  floorDepth: number
}

/**
 * Modifier values computed from the current mood.
 * Applied by CombatScene to each relevant visual subsystem.
 *
 * Naming convention: multipliers > 1 increase the effect, < 1 decrease it.
 * The mood system sets a BASELINE; chain/knowledge transients stack on top.
 */
export interface MoodModifiers {
  /**
   * Multiplied against base vignette intensity.
   * Range: 0.8 (calm) to 1.4 (desperate).
   */
  vignetteMultiplier: number
  /**
   * Shift in color temperature.
   * Range: -1.0 (warm) to +1.0 (cold). Applied at 0.05 scale per unit = ±0.05 RGB channel.
   */
  colorTempShift: number
  /**
   * Multiplied against base particle emission rate (lower frequency = more particles).
   * Range: 0.8 (calm, fewer particles) to 1.5 (desperate, more particles).
   */
  particleRateMultiplier: number
  /**
   * Particle velocity jitter multiplier.
   * Range: 1.0 (calm, normal velocity) to 1.5 (desperate, 50% more chaotic).
   * Flagship tier only.
   */
  particleChaosMultiplier: number
  /**
   * Multiplier on point light flicker speed.
   * Range: 1.0 (calm) to 1.8 (desperate, faster flicker).
   */
  lightFlickerMultiplier: number
  /**
   * Multiplied against base fog density.
   * Range: 0.9 (calm) to 1.3 (desperate).
   */
  fogDensityMultiplier: number
  /**
   * Additional desaturation on top of the knowledge-reactive saturation offset.
   * Range: 0.0 (calm, no desaturation) to 0.15 (desperate, −15% saturation).
   */
  desaturationAmount: number
}

/**
 * A transient modifier pushed by specs 01/03/05 that stacks on top of the
 * mood baseline for a limited duration.
 */
interface TransientModifier {
  /** Partial override — unset keys pass through the baseline unchanged. */
  mod: Partial<MoodModifiers>
  /** Absolute Phaser scene time (ms) at which this transient expires. */
  expiresAt: number
}

/**
 * DungeonMoodSystem — Spec 09
 *
 * A persistent 0.0–1.0 mood value (calm → desperate) driven by real-time
 * game signals. The value smooth-interpolates toward its target over ~2.5
 * seconds so transitions never feel jarring.
 *
 * Modifiers are output to CombatScene each frame via {@link getModifiers}.
 * CombatScene applies those modifiers to DepthLightingSystem,
 * CombatAtmosphereSystem, and the camera color matrix.
 *
 * Other immersion specs (01, 03, 05) can call {@link applyTransientModifier}
 * to layer time-limited spikes on top of the mood baseline.
 *
 * Device-tier gating:
 * - Low-end:  vignetteMultiplier + colorTempShift + desaturationAmount only
 * - Mid:      + particleRateMultiplier + lightFlickerMultiplier + fogDensityMultiplier
 * - Flagship: + particleChaosMultiplier (all modifiers active)
 *
 * Reduce-motion gating:
 * - Motion modifiers suppressed: particleRateMultiplier, particleChaosMultiplier, lightFlickerMultiplier
 * - Non-motion modifiers kept: vignetteMultiplier, colorTempShift, fogDensityMultiplier, desaturationAmount
 */
export class DungeonMoodSystem {
  /** Current smooth mood value (updated via exponential lerp each frame). */
  private currentMood: number = 0.5
  /** Target mood computed from current MoodInputs. */
  private targetMood: number = 0.5
  /** Whether the system is currently running. */
  private active = false
  /** Current cached modifiers (recalculated when mood changes meaningfully). */
  private currentModifiers: MoodModifiers = DungeonMoodSystem.neutralModifiers()
  /** Pending transient modifiers from specs 01/03/05. */
  private transients: TransientModifier[] = []
  /** Phaser scene reference (for scene.time.now in transient expiry checks). */
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Start the mood system at the beginning of an encounter.
   * Resets to 0.5 (neutral) so every encounter starts from a clean baseline.
   */
  start(): void {
    this.currentMood = 0.5
    this.targetMood = 0.5
    this.transients = []
    this.currentModifiers = DungeonMoodSystem.neutralModifiers()
    this.active = true
  }

  /**
   * Stop the mood system at encounter end / scene shutdown.
   * Resets internal state so no stale values leak into the next encounter.
   */
  stop(): void {
    this.active = false
    this.currentMood = 0.5
    this.targetMood = 0.5
    this.transients = []
    this.currentModifiers = DungeonMoodSystem.neutralModifiers()
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  /**
   * Per-frame update. Call from CombatScene.update().
   *
   * Computes new target mood from inputs, lerps currentMood toward it,
   * and refreshes the cached modifier values.
   *
   * @param deltaMs Milliseconds since last frame (Phaser delta).
   * @param inputs  Current game state signals.
   */
  update(deltaMs: number, inputs: MoodInputs): void {
    if (!this.active) return

    this.targetMood = this.computeTargetMood(inputs)

    // Exponential lerp: ~0.998^16 ≈ 0.031 change per 60fps frame.
    // Reaching 95% of target takes ~149 frames ≈ 2490ms. Gives the desired 2-3s feel.
    const alpha = 1.0 - Math.pow(0.998, deltaMs)
    this.currentMood += (this.targetMood - this.currentMood) * alpha

    this.currentModifiers = this.getMergedModifiers()
  }

  // ── Input-driven mood computation ──────────────────────────────────────────

  /**
   * Compute the target mood value from current game-state signals.
   *
   * Weights (sum of magnitudes = 1.0):
   * - Low HP:         +0.40 (dominant signal — near death = desperate)
   * - Chain length:   −0.20 (active chain = triumphant)
   * - Correct streak: −0.15 (winning = calm)
   * - Enemy threat:   +0.15 (dangerous enemy = tense)
   * - Floor depth:    +0.10 (deeper = slightly more desperate)
   *
   * Base offset 0.5: neutral HP with no chain/threat → 0.5 (not calm, not desperate).
   * Player must have chain + streak to push below 0.4 (calm);
   * must be low HP + high threat to push above 0.8 (desperate).
   */
  private computeTargetMood(inputs: MoodInputs): number {
    const hpSignal    = (1.0 - inputs.playerHpRatio) * 0.40
    const chainSignal = Math.min(inputs.chainLength / 8, 1.0) * -0.20
    const streakSignal = Math.min(inputs.consecutiveCorrect / 5, 1.0) * -0.15
    const threatSignal = inputs.enemyThreatLevel * 0.15
    const depthSignal  = Math.min((inputs.floorDepth - 1) / 14, 1.0) * 0.10

    const raw = 0.5 + hpSignal + chainSignal + streakSignal + threatSignal + depthSignal
    return Math.max(0.0, Math.min(1.0, raw))
  }

  // ── Modifier computation ───────────────────────────────────────────────────

  /**
   * Get current mood modifiers with transients merged on top.
   * Gated by device tier and reduce-motion preference.
   *
   * The returned object is safe to hold a reference to — a new object is
   * created each frame so callers need not deep-copy it.
   */
  getModifiers(): MoodModifiers {
    return this.currentModifiers
  }

  /**
   * Compute modifiers from current mood value.
   * All outputs are linear interpolations between calm and desperate endpoints.
   */
  private computeModifiers(mood: number): MoodModifiers {
    return {
      vignetteMultiplier:      lerp(0.8, 1.4, mood),   // 0.8 calm → 1.4 desperate
      colorTempShift:          lerp(-1.0, 1.0, mood),  // warm calm → cold desperate
      particleRateMultiplier:  lerp(0.8, 1.5, mood),   // fewer calm → more desperate
      particleChaosMultiplier: lerp(1.0, 1.5, mood),   // 1.0 calm → 1.5 desperate
      lightFlickerMultiplier:  lerp(1.0, 1.8, mood),   // 1.0 calm → 1.8 desperate
      fogDensityMultiplier:    lerp(0.9, 1.3, mood),   // 0.9 calm → 1.3 desperate
      desaturationAmount:      lerp(0.0, 0.15, mood),  // 0 calm → 0.15 desperate
    }
  }

  /**
   * Merge base mood modifiers with all active transient modifiers.
   * Expired transients are purged. Applies device-tier and reduce-motion gating.
   */
  private getMergedModifiers(): MoodModifiers {
    const base = this.computeModifiers(this.currentMood)
    const now = this.scene.time.now

    // Purge expired transients
    this.transients = this.transients.filter(t => t.expiresAt > now)

    // Stack transients on top of base
    for (const t of this.transients) {
      if (t.mod.particleRateMultiplier !== undefined) {
        base.particleRateMultiplier *= t.mod.particleRateMultiplier
      }
      if (t.mod.particleChaosMultiplier !== undefined) {
        base.particleChaosMultiplier *= t.mod.particleChaosMultiplier
      }
      if (t.mod.lightFlickerMultiplier !== undefined) {
        base.lightFlickerMultiplier *= t.mod.lightFlickerMultiplier
      }
      if (t.mod.fogDensityMultiplier !== undefined) {
        base.fogDensityMultiplier *= t.mod.fogDensityMultiplier
      }
      if (t.mod.vignetteMultiplier !== undefined) {
        base.vignetteMultiplier *= t.mod.vignetteMultiplier
      }
      if (t.mod.colorTempShift !== undefined) {
        base.colorTempShift += t.mod.colorTempShift
      }
      if (t.mod.desaturationAmount !== undefined) {
        base.desaturationAmount += t.mod.desaturationAmount
      }
    }

    // Device-tier gating — suppress expensive modifiers on lower tiers
    const tier = getDeviceTier()
    const reduceMotion = isReduceMotionEnabled()

    if (tier === 'low-end') {
      // Low-end: only cheap uniform operations (vignette, color, desaturation)
      base.particleRateMultiplier = 1.0
      base.particleChaosMultiplier = 1.0
      base.lightFlickerMultiplier = 1.0
      base.fogDensityMultiplier = 1.0
    } else if (tier === 'mid') {
      // Mid: add particle rate, flicker, fog — but NOT chaos
      base.particleChaosMultiplier = 1.0
    }
    // Flagship: all modifiers active

    // Reduce-motion gating — suppress motion-based modifiers
    if (reduceMotion) {
      base.particleRateMultiplier = 1.0
      base.particleChaosMultiplier = 1.0
      base.lightFlickerMultiplier = 1.0
      // vignette, colorTempShift, fogDensity, desaturation are kept (color/brightness, not motion)
    }

    return base
  }

  // ── Transient modifier API (for specs 01, 03, 05) ──────────────────────────

  /**
   * Apply a short-lived modifier on top of the mood baseline.
   * Used by specs 01/03/05 for event-driven spikes (turn transitions,
   * chain escalation, correct-answer bursts).
   *
   * Multiplier fields (particleRateMultiplier, vignetteMultiplier, etc.)
   * stack multiplicatively on top of the base. Additive fields (colorTempShift,
   * desaturationAmount) stack additively.
   *
   * Example (Spec 01 turn transition):
   * ```
   * dungeonMood.applyTransientModifier({ vignetteMultiplier: 1.3 }, 300)
   * ```
   * At high mood (base vignette 1.4), this peaks at 1.4 × 1.3 = 1.82 for 300ms.
   *
   * @param mod        Partial modifier values to overlay.
   * @param durationMs How long to hold the modifier (ms).
   */
  applyTransientModifier(mod: Partial<MoodModifiers>, durationMs: number): void {
    if (!this.active) return
    this.transients.push({
      mod,
      expiresAt: this.scene.time.now + durationMs,
    })
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /** Current smooth mood value (0.0 calm → 1.0 desperate). */
  getMood(): number { return this.currentMood }

  /** Whether the system is active (started and not stopped). */
  isActive(): boolean { return this.active }

  // ── Static helpers ─────────────────────────────────────────────────────────

  /** Return a neutral (0.5 mood) modifier set. Used as a reset baseline. */
  private static neutralModifiers(): MoodModifiers {
    return {
      vignetteMultiplier:      lerp(0.8, 1.4, 0.5),
      colorTempShift:          0.0,
      particleRateMultiplier:  lerp(0.8, 1.5, 0.5),
      particleChaosMultiplier: lerp(1.0, 1.5, 0.5),
      lightFlickerMultiplier:  lerp(1.0, 1.8, 0.5),
      fogDensityMultiplier:    lerp(0.9, 1.3, 0.5),
      desaturationAmount:      lerp(0.0, 0.15, 0.5),
    }
  }
}

/** Linear interpolation helper. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
