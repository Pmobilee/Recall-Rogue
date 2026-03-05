// src/game/systems/ImpactSystem.ts

import { BlockType } from '../../data/types'
import type { ScreenShakeSystem, ShakeTier } from './ScreenShakeSystem'
import type { ParticleSystem } from './ParticleSystem'

/** Hit state classification for progressive damage feedback */
export type HitState = 'graze' | 'normal' | 'heavy' | 'critical'

/**
 * Full impact profile per block type.
 * Controls the intensity and character of per-hit feedback.
 */
export interface ImpactProfile {
  /** Base screen shake tier for the first hit */
  baseTier: ShakeTier
  /** Tier to escalate to on heavy/final hits */
  escalatedTier: ShakeTier
  /** Color of the block hit flash (hex) */
  flashColor: number
  /** Duration of the block hit flash in ms */
  flashDuration: number
  /** Impact feel type (used for future audio mapping) */
  impactType: 'crumble' | 'spark' | 'ring' | 'thud' | 'hiss'
  /** Flash alpha override per hit state (0.0–1.0) */
  flashAlphaByState: Record<HitState, number>
  /** Whether secondary particles emit on hit ≥ 2 or on final hit */
  emitSecondaryOnHeavy: boolean
}

const IMPACT_PROFILES: Partial<Record<BlockType, ImpactProfile>> = {
  [BlockType.Dirt]: {
    baseTier: 'micro', escalatedTier: 'micro',
    flashColor: 0xddcc99, flashDuration: 60,
    impactType: 'crumble',
    flashAlphaByState: { graze: 0.3, normal: 0.5, heavy: 0.7, critical: 0.9 },
    emitSecondaryOnHeavy: false,
  },
  [BlockType.SoftRock]: {
    baseTier: 'micro', escalatedTier: 'micro',
    flashColor: 0xccbbaa, flashDuration: 70,
    impactType: 'crumble',
    flashAlphaByState: { graze: 0.3, normal: 0.5, heavy: 0.7, critical: 0.9 },
    emitSecondaryOnHeavy: false,
  },
  [BlockType.Stone]: {
    baseTier: 'micro', escalatedTier: 'medium',
    flashColor: 0xdddddd, flashDuration: 80,
    impactType: 'spark',
    flashAlphaByState: { graze: 0.25, normal: 0.5, heavy: 0.75, critical: 1.0 },
    emitSecondaryOnHeavy: true,
  },
  [BlockType.HardRock]: {
    baseTier: 'medium', escalatedTier: 'heavy',
    flashColor: 0xaaaaaa, flashDuration: 100,
    impactType: 'thud',
    flashAlphaByState: { graze: 0.3, normal: 0.55, heavy: 0.8, critical: 1.0 },
    emitSecondaryOnHeavy: true,
  },
  [BlockType.MineralNode]: {
    baseTier: 'micro', escalatedTier: 'medium',
    flashColor: 0x4ecca3, flashDuration: 100,
    impactType: 'ring',
    flashAlphaByState: { graze: 0.3, normal: 0.55, heavy: 0.75, critical: 1.0 },
    emitSecondaryOnHeavy: true,
  },
  [BlockType.ArtifactNode]: {
    baseTier: 'micro', escalatedTier: 'medium',
    flashColor: 0xff99aa, flashDuration: 120,
    impactType: 'ring',
    flashAlphaByState: { graze: 0.3, normal: 0.6, heavy: 0.8, critical: 1.0 },
    emitSecondaryOnHeavy: true,
  },
  [BlockType.LavaBlock]: {
    baseTier: 'medium', escalatedTier: 'heavy',
    flashColor: 0xff4400, flashDuration: 150,
    impactType: 'hiss',
    flashAlphaByState: { graze: 0.4, normal: 0.65, heavy: 0.85, critical: 1.0 },
    emitSecondaryOnHeavy: true,
  },
  [BlockType.GasPocket]: {
    baseTier: 'micro', escalatedTier: 'medium',
    flashColor: 0x88cc66, flashDuration: 100,
    impactType: 'hiss',
    flashAlphaByState: { graze: 0.25, normal: 0.45, heavy: 0.65, critical: 0.85 },
    emitSecondaryOnHeavy: false,
  },
  [BlockType.FossilNode]: {
    baseTier: 'micro', escalatedTier: 'micro',
    flashColor: 0xddcc99, flashDuration: 80,
    impactType: 'crumble',
    flashAlphaByState: { graze: 0.3, normal: 0.5, heavy: 0.7, critical: 0.9 },
    emitSecondaryOnHeavy: false,
  },
  [BlockType.RelicShrine]: {
    baseTier: 'micro', escalatedTier: 'medium',
    flashColor: 0xcc88ff, flashDuration: 120,
    impactType: 'ring',
    flashAlphaByState: { graze: 0.3, normal: 0.55, heavy: 0.75, critical: 1.0 },
    emitSecondaryOnHeavy: true,
  },
}

const DEFAULT_PROFILE: ImpactProfile = {
  baseTier: 'micro', escalatedTier: 'medium',
  flashColor: 0xffffff, flashDuration: 80,
  impactType: 'spark',
  flashAlphaByState: { graze: 0.25, normal: 0.5, heavy: 0.7, critical: 0.9 },
  emitSecondaryOnHeavy: false,
}

/**
 * Coordinates all per-hit mining feedback: screen shake, block flash,
 * climactic break effects, and haptic feedback.
 *
 * Each block type has a unique impact profile that escalates with
 * successive hits on the same block. The final breaking hit is always
 * more intense than preceding hits.
 *
 * Phase 30: Integrated with ScreenShakeSystem (Perlin noise) and
 * ParticleSystem (secondary particles), with progressive hit state feedback.
 */
export class ImpactSystem {
  private scene: Phaser.Scene
  private shakeSystem: ScreenShakeSystem | null
  private particleSystem: ParticleSystem | null

  constructor(
    scene: Phaser.Scene,
    shakeSystem?: ScreenShakeSystem,
    particleSystem?: ParticleSystem
  ) {
    this.scene = scene
    this.shakeSystem = shakeSystem ?? null
    this.particleSystem = particleSystem ?? null
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------

  /**
   * Trigger all impact feedback for a single block hit.
   *
   * @param blockType     - The block being hit
   * @param hitNumber     - Which hit this is (1 = first, 2 = second, etc.)
   * @param isFinalHit    - True if this hit will destroy the block
   * @param blockPx       - Block world X (pixel center)
   * @param blockPy       - Block world Y (pixel center)
   * @param tileX         - Block grid X (for flash tile tracking)
   * @param tileY         - Block grid Y (for flash tile tracking)
   * @param pickaxeTier   - Current pickaxe tier index (0-3); higher = flashier
   * @param flashTiles    - Reference to MineScene.flashTiles Map to register flash
   */
  triggerHit(
    blockType: BlockType,
    hitNumber: number,
    isFinalHit: boolean,
    blockPx: number,
    blockPy: number,
    tileX: number,
    tileY: number,
    pickaxeTier: number,
    flashTiles: Map<string, number>
  ): void {
    const profile = IMPACT_PROFILES[blockType] ?? DEFAULT_PROFILE
    const hitState = this.resolveHitState(hitNumber, isFinalHit, blockType)

    // 1. Block flash
    flashTiles.set(`${tileX},${tileY}`, this.scene.time.now)

    // 2. Screen shake — use ScreenShakeSystem if available, otherwise Phaser built-in
    const tier = this.resolveShakeTier(blockType, hitNumber, isFinalHit, pickaxeTier)
    if (this.shakeSystem) {
      this.shakeSystem.trigger(tier)
    } else {
      this._legacyShake(profile, hitNumber, isFinalHit, pickaxeTier)
    }

    // 3. Secondary particles on hit #2+ or final hit for eligible block types
    if (this.particleSystem && profile.emitSecondaryOnHeavy) {
      if (hitNumber >= 2 || isFinalHit) {
        this.particleSystem.emitSecondary({ blockType, hitState }, blockPx, blockPy)
      }
    }

    // 4. Climactic break effects (final hit only)
    if (isFinalHit) {
      this.playBreakClimax(blockType, blockPx, blockPy, pickaxeTier, profile)
    }

    // 5. Haptic (Capacitor — mobile only, no-op on web)
    this.triggerHaptic(isFinalHit, hitState)
  }

  /**
   * Resolves the hit state based on hit number, max hardness context, and final hit status.
   *
   * @param hitNumber  - Current hit number (1-based)
   * @param isFinalHit - Whether this is the destroying hit
   * @param _blockType  - The block type (reserved for future per-type overrides)
   * @returns The classified hit state
   */
  resolveHitState(hitNumber: number, isFinalHit: boolean, _blockType: BlockType): HitState {
    if (isFinalHit) return 'critical'
    if (hitNumber >= 4) return 'heavy'
    if (hitNumber >= 2) return 'normal'
    return 'graze'
  }

  /**
   * Resolves the appropriate ScreenShakeSystem tier for a block hit.
   *
   * Context-based rules:
   *  - Final hits always escalate to the block's escalated tier
   *  - Pickaxe tier 3 bumps everything up one tier
   *  - Otherwise: first hit uses base tier; subsequent hits use escalated tier
   *
   * @param blockType   - The block being hit
   * @param hitNumber   - Which hit this is (1-based)
   * @param isFinalHit  - Whether this is the destroying hit
   * @param pickaxeTier - Current pickaxe tier (0-3)
   * @returns The resolved shake tier
   */
  resolveShakeTier(
    blockType: BlockType,
    hitNumber: number,
    isFinalHit: boolean,
    pickaxeTier: number
  ): ShakeTier {
    const profile = IMPACT_PROFILES[blockType] ?? DEFAULT_PROFILE

    let tier: ShakeTier
    if (isFinalHit) {
      tier = profile.escalatedTier
    } else if (hitNumber >= 2) {
      tier = profile.escalatedTier
    } else {
      tier = profile.baseTier
    }

    // Pickaxe tier 3 bumps up to heavy regardless
    if (pickaxeTier >= 3 && isFinalHit) {
      tier = 'heavy'
    }

    return tier
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /**
   * Legacy fallback camera shake using Phaser's built-in shake effect.
   * Used when no ScreenShakeSystem is provided.
   *
   * @param profile    - Impact profile
   * @param hitNumber  - Hit number (1-based)
   * @param isFinalHit - Whether this is the final hit
   * @param pickaxeTier - Current pickaxe tier
   */
  private _legacyShake(
    profile: ImpactProfile,
    hitNumber: number,
    isFinalHit: boolean,
    pickaxeTier: number
  ): void {
    const tierAmplitudes: Record<ShakeTier, number> = { micro: 1.5, medium: 4, heavy: 8 }
    const baseTierAmp = tierAmplitudes[profile.baseTier]
    const escalated = tierAmplitudes[profile.escalatedTier]
    const shakeAmt = (hitNumber > 1 || isFinalHit ? escalated : baseTierAmp)
      * (1 + pickaxeTier * 0.25)
      * (isFinalHit ? 1.5 : 1.0)
    const clampedMag = Math.min(shakeAmt, 8)
    const duration = isFinalHit ? 180 : 100
    this.scene.cameras.main.shake(duration, clampedMag / 1000)
  }

  /**
   * Extra visual flourishes for the block-breaking final hit.
   *
   * @param _blockType   - Block type (reserved for future color matching)
   * @param _px          - World X center
   * @param _py          - World Y center
   * @param pickaxeTier  - Current pickaxe tier
   * @param _profile     - Impact profile
   */
  private playBreakClimax(
    _blockType: BlockType,
    _px: number,
    _py: number,
    pickaxeTier: number,
    _profile: ImpactProfile
  ): void {
    // Brief camera flash
    this.scene.cameras.main.flash(120, 255, 255, 255, false)

    // Higher tier pickaxes add a brief radial zoom-pulse
    if (pickaxeTier >= 2) {
      const originalZoom = this.scene.cameras.main.zoom
      this.scene.tweens.add({
        targets: this.scene.cameras.main,
        zoom: originalZoom * 1.02,
        duration: 60,
        ease: 'Quad.Out',
        yoyo: true,
        onComplete: () => {
          this.scene.cameras.main.setZoom(originalZoom)
        },
      })
    }
  }

  /**
   * Trigger Capacitor haptic feedback via global Capacitor bridge.
   * Silently no-ops when Capacitor is not available (web builds).
   *
   * @param isFinalHit - Whether this is the block-destroying hit
   * @param hitState   - Classified hit state for haptic intensity mapping
   */
  private triggerHaptic(isFinalHit: boolean, hitState: HitState): void {
    try {
      const cap = (globalThis as Record<string, unknown>).Capacitor as
        | { isNativePlatform?: () => boolean; Plugins?: { Haptics?: { impact: (opts: { style: string }) => Promise<void> } } }
        | undefined
      if (!cap?.isNativePlatform?.()) return
      const haptics = cap?.Plugins?.Haptics
      if (haptics) {
        const style = (isFinalHit || hitState === 'critical')
          ? 'Medium'
          : hitState === 'heavy'
            ? 'Light'
            : 'Light'
        haptics.impact({ style }).catch(() => {})
      }
    } catch {
      // Intentionally silent — haptics are enhancement only
    }
  }
}
