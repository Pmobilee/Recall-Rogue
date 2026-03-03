// src/game/systems/ImpactSystem.ts

import { BlockType } from '../../data/types'

/**
 * Impact profile per block type.
 * Controls the intensity and character of per-hit feedback.
 */
interface ImpactProfile {
  /** Base screen shake magnitude (pixels) for the first hit */
  baseShake: number
  /** Shake magnitude added per successive hit (escalation) */
  escalationShake: number
  /** Color of the block hit flash (hex) */
  flashColor: number
  /** Duration of the block hit flash in ms */
  flashDuration: number
  /** Impact feel type */
  impactType: 'crumble' | 'spark' | 'ring' | 'thud' | 'hiss'
  /** Shake duration in ms */
  shakeDuration: number
}

const IMPACT_PROFILES: Partial<Record<BlockType, ImpactProfile>> = {
  [BlockType.Dirt]: {
    baseShake: 1, escalationShake: 0.5,
    flashColor: 0xddcc99, flashDuration: 60,
    impactType: 'crumble', shakeDuration: 80,
  },
  [BlockType.SoftRock]: {
    baseShake: 1.5, escalationShake: 0.5,
    flashColor: 0xccbbaa, flashDuration: 70,
    impactType: 'crumble', shakeDuration: 90,
  },
  [BlockType.Stone]: {
    baseShake: 2, escalationShake: 1,
    flashColor: 0xdddddd, flashDuration: 80,
    impactType: 'spark', shakeDuration: 100,
  },
  [BlockType.HardRock]: {
    baseShake: 3, escalationShake: 1.5,
    flashColor: 0xaaaaaa, flashDuration: 100,
    impactType: 'thud', shakeDuration: 120,
  },
  [BlockType.MineralNode]: {
    baseShake: 2, escalationShake: 1,
    flashColor: 0x4ecca3, flashDuration: 100,
    impactType: 'ring', shakeDuration: 100,
  },
  [BlockType.ArtifactNode]: {
    baseShake: 2.5, escalationShake: 1,
    flashColor: 0xff99aa, flashDuration: 120,
    impactType: 'ring', shakeDuration: 110,
  },
  [BlockType.LavaBlock]: {
    baseShake: 3, escalationShake: 0.5,
    flashColor: 0xff4400, flashDuration: 150,
    impactType: 'hiss', shakeDuration: 140,
  },
  [BlockType.GasPocket]: {
    baseShake: 1.5, escalationShake: 0.3,
    flashColor: 0x88cc66, flashDuration: 100,
    impactType: 'hiss', shakeDuration: 100,
  },
}

const DEFAULT_PROFILE: ImpactProfile = {
  baseShake: 1.5, escalationShake: 0.5,
  flashColor: 0xffffff, flashDuration: 80,
  impactType: 'spark', shakeDuration: 100,
}

/**
 * Coordinates all per-hit mining feedback: screen shake, block flash,
 * climactic break effects, and haptic feedback.
 *
 * Each block type has a unique impact profile that escalates with
 * successive hits on the same block. The final breaking hit is always
 * more intense than preceding hits.
 */
export class ImpactSystem {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

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

    // 1. Block flash
    flashTiles.set(`${tileX},${tileY}`, this.scene.time.now)

    // 2. Screen shake — escalates with each hit, pickaxe tier adds bonus
    const shakeAmt = (profile.baseShake + profile.escalationShake * (hitNumber - 1))
      * (1 + pickaxeTier * 0.25)
      * (isFinalHit ? 2.0 : 1.0)
    this.triggerShake(shakeAmt, profile.shakeDuration * (isFinalHit ? 1.5 : 1.0))

    // 3. Climactic break effects (final hit only)
    if (isFinalHit) {
      this.playBreakClimax(blockType, blockPx, blockPy, pickaxeTier)
    }

    // 4. Haptic (Capacitor — mobile only, no-op on web)
    this.triggerHaptic(isFinalHit)
  }

  /**
   * Camera shake using Phaser's built-in shake effect.
   * @param magnitude - Shake intensity in pixels
   * @param duration  - Shake duration in ms
   */
  private triggerShake(magnitude: number, duration: number): void {
    // Clamp shake to avoid nauseating values (max 8px)
    const clampedMag = Math.min(magnitude, 8)
    this.scene.cameras.main.shake(duration, clampedMag / 1000)
  }

  /**
   * Extra visual flourishes for the block-breaking final hit.
   */
  private playBreakClimax(
    _blockType: BlockType,
    _px: number,
    _py: number,
    pickaxeTier: number
  ): void {
    // Brief camera flash (white for rock, color-matched for special blocks)
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
   */
  private triggerHaptic(isFinalHit: boolean): void {
    try {
      // Access Capacitor plugins via globalThis to avoid Rollup import resolution
      const cap = (globalThis as Record<string, unknown>).Capacitor as
        | { Plugins?: { Haptics?: { impact: (opts: { style: string }) => void } } }
        | undefined
      const haptics = cap?.Plugins?.Haptics
      if (haptics) {
        haptics.impact({ style: isFinalHit ? 'Medium' : 'Light' })
      }
    } catch {
      // Intentionally silent — haptics are enhancement only
    }
  }
}
