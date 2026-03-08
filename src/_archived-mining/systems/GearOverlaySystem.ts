// src/game/systems/GearOverlaySystem.ts
// Phase 29: Character Animation System — DD-V2-248
// Phase 57.1: Dirt tint, backpack bulge, pickaxe upgrade tween

import Phaser from 'phaser'
import { BALANCE } from '../../data/balance'

/** Maximum pickaxe tier index (0–4). */
const MAX_PICKAXE_TIER = 4

/** Pixel offset of the pickaxe icon relative to the miner's feet anchor. */
const PICK_OFFSET_X =  10   // px right of center (right shoulder)
const PICK_OFFSET_Y = -28   // px above feet anchor (shoulder height)

/** Pixel offset of the companion badge (bottom-left corner of character). */
const BADGE_OFFSET_X = -12  // px left of center
const BADGE_OFFSET_Y = -10  // px above feet anchor (knee height)

/** Pixel offset of the backpack indicator (bottom-right). */
const BACKPACK_OFFSET_X = 14
const BACKPACK_OFFSET_Y = -16

/** Display size of the pickaxe tier icon in game pixels. */
const PICK_DISPLAY = 16

/** Display size of the companion badge in game pixels. */
const BADGE_DISPLAY = 12

/** Relic glow pulse cycle duration in ms. */
const GLOW_PULSE_PERIOD_MS = 1200

/** Dirt overlay color. */
const DIRT_COLOR = 0x5a3e1b

/**
 * Renders gear overlays on top of the miner sprite:
 *   1. Pickaxe tier icon (right shoulder)
 *   2. Relic glow aura (full-body colored ring)
 *   3. Companion badge (lower-left corner)
 *   4. Dirt tint overlay (Phase 57.1)
 *   5. Backpack fill indicator (Phase 57.1)
 *
 * All overlays are parented to the character's world position and must be
 * updated every frame via update().
 *
 * Performance: overlays share draw calls with the character when possible.
 * The glow aura uses alpha tweening via Phaser's update loop (no separate
 * tween objects — just Math.sin() on this.time.now).
 */
export class GearOverlaySystem {
  private scene: Phaser.Scene
  private pickSprite: Phaser.GameObjects.Image | null = null
  private glowSprite: Phaser.GameObjects.Image | null = null
  private badgeSprite: Phaser.GameObjects.Image | null = null

  /** Dirt overlay Graphics — a semi-transparent brown rectangle. */
  private dirtGraphics: Phaser.GameObjects.Graphics | null = null
  /** Current dirt alpha level (0 = clean). */
  private dirtAlpha = 0
  /** Blocks mined counter for dirt calculation. */
  private blocksMined = 0

  /** Backpack fill indicator Graphics. */
  private backpackGraphics: Phaser.GameObjects.Graphics | null = null
  /** Current backpack fill fraction (0–1). */
  private backpackFill = 0
  /** Active backpack bob tween (for 100% full). */
  private backpackBobTween: Phaser.Tweens.Tween | null = null

  /** Current pickaxe tier (0–4). */
  private pickTier = 0

  /** Currently active relic rarity, or null if no relic is equipped. */
  private relicRarity: string | null = null

  /** Currently active companion ID, or null if no companion is equipped. */
  private companionId: string | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Creates the overlay sprites. Call once after MineScene.create() finishes.
   * The sprites are initially invisible.
   */
  init(): void {
    // Pickaxe tier icon
    if (this.scene.textures.exists('overlay_pick_t0')) {
      this.pickSprite = this.scene.add.image(0, 0, 'overlay_pick_t0')
      this.pickSprite.setDisplaySize(PICK_DISPLAY, PICK_DISPLAY)
      this.pickSprite.setDepth(11)
      this.pickSprite.setVisible(false)
    }

    // Relic glow aura — starts hidden until a relic is equipped
    if (this.scene.textures.exists('overlay_relic_common')) {
      this.glowSprite = this.scene.add.image(0, 0, 'overlay_relic_common')
      this.glowSprite.setDepth(9)    // BELOW player sprite so glow bleeds outward
      this.glowSprite.setVisible(false)
      this.glowSprite.setAlpha(0)
    }

    // Companion badge
    if (this.scene.textures.exists('overlay_companion_badge')) {
      this.badgeSprite = this.scene.add.image(0, 0, 'overlay_companion_badge')
      this.badgeSprite.setDisplaySize(BADGE_DISPLAY, BADGE_DISPLAY)
      this.badgeSprite.setDepth(11)
      this.badgeSprite.setVisible(false)
    }

    // Dirt tint overlay (Phase 57.1)
    this.dirtGraphics = this.scene.add.graphics()
    this.dirtGraphics.setDepth(10) // Above player sprite but below pickaxe
    this.dirtGraphics.setVisible(false)

    // Backpack fill indicator (Phase 57.1)
    this.backpackGraphics = this.scene.add.graphics()
    this.backpackGraphics.setDepth(11)
    this.backpackGraphics.setVisible(false)
  }

  /**
   * Update overlay positions and alpha each frame.
   * Call from MineScene.update() after drawPlayer() has moved the sprite.
   *
   * @param worldX - The miner sprite's world X (feet anchor)
   * @param worldY - The miner sprite's world Y (feet anchor)
   * @param nowMs  - Current game time in ms (from scene.time.now)
   */
  update(worldX: number, worldY: number, nowMs: number): void {
    if (this.pickSprite?.visible) {
      this.pickSprite.setPosition(worldX + PICK_OFFSET_X, worldY + PICK_OFFSET_Y)
    }

    if (this.glowSprite?.visible) {
      // Pulse glow alpha between 0.25 and 0.55
      const pulse = 0.4 + 0.15 * Math.sin((nowMs / GLOW_PULSE_PERIOD_MS) * Math.PI * 2)
      this.glowSprite.setAlpha(pulse)
      // Glow is centered on the character torso (not feet)
      this.glowSprite.setPosition(worldX, worldY - 24)
    }

    if (this.badgeSprite?.visible) {
      this.badgeSprite.setPosition(worldX + BADGE_OFFSET_X, worldY + BADGE_OFFSET_Y)
    }

    // Dirt tint overlay (Phase 57.1)
    if (this.dirtGraphics && this.dirtAlpha > 0) {
      this.dirtGraphics.setVisible(true)
      this.dirtGraphics.clear()
      this.dirtGraphics.fillStyle(DIRT_COLOR, this.dirtAlpha)
      // Draw a rectangle covering the miner body (approx 24x40 centered on torso)
      this.dirtGraphics.fillRect(worldX - 12, worldY - 40, 24, 40)
    } else if (this.dirtGraphics) {
      this.dirtGraphics.setVisible(false)
    }

    // Backpack fill indicator (Phase 57.1)
    if (this.backpackGraphics && this.backpackFill > 0) {
      this.backpackGraphics.setVisible(true)
      this.backpackGraphics.clear()
      const color = this.backpackFill >= 1.0
        ? 0xff3333   // red at 100%
        : this.backpackFill >= 0.8
          ? 0xff8800  // orange at 80-99%
          : 0x44cc44  // green below 80%
      this.backpackGraphics.fillStyle(color, 0.85)
      this.backpackGraphics.fillRoundedRect(
        worldX + BACKPACK_OFFSET_X - 4,
        worldY + BACKPACK_OFFSET_Y - 4,
        8, 8, 2
      )
    } else if (this.backpackGraphics) {
      this.backpackGraphics.setVisible(false)
    }
  }

  // -------------------------------------------------------------------------
  // State setters — call from MineScene when game state changes
  // -------------------------------------------------------------------------

  /**
   * Update the pickaxe tier overlay. Tier 0 hides the overlay (basic pick has no icon).
   *
   * @param tier - Pickaxe tier index 0–4
   */
  setPickaxeTier(tier: number): void {
    const oldTier = this.pickTier
    this.pickTier = Math.min(Math.max(tier, 0), MAX_PICKAXE_TIER)
    if (!this.pickSprite) return

    if (this.pickTier === 0) {
      this.pickSprite.setVisible(false)
      return
    }

    const key = `overlay_pick_t${this.pickTier}`
    if (this.scene.textures.exists(key)) {
      this.pickSprite.setTexture(key)
      this.pickSprite.setVisible(true)
    }

    // Phase 57.1.3: Scale-up tween when pickaxe is upgraded during a dive
    if (this.pickTier > oldTier && oldTier > 0 && this.pickSprite.visible) {
      this.scene.tweens.add({
        targets: this.pickSprite,
        scaleX: 1.4,
        scaleY: 1.4,
        duration: 200,
        ease: 'Back.Out',
        yoyo: true,
        onComplete: () => {
          if (this.pickSprite) {
            this.pickSprite.setScale(1)
          }
        },
      })
    }
  }

  /**
   * Update the relic glow overlay.
   * Pass null to hide the glow (no relics equipped).
   *
   * @param rarity - The rarity of the highest-tier equipped relic, or null
   */
  setRelicGlow(rarity: string | null): void {
    this.relicRarity = rarity
    if (!this.glowSprite) return

    if (!rarity) {
      this.glowSprite.setVisible(false)
      return
    }

    const key = `overlay_relic_${rarity}`
    if (this.scene.textures.exists(key)) {
      this.glowSprite.setTexture(key)
      this.glowSprite.setVisible(true)
      this.glowSprite.setDisplaySize(36, 52)  // slightly wider than character for glow bleed
    }
  }

  /**
   * Update the companion badge overlay.
   * Pass null to hide the badge.
   *
   * @param companionId - The companion's ID string, or null
   */
  setCompanionBadge(companionId: string | null): void {
    this.companionId = companionId
    if (!this.badgeSprite) return

    if (!companionId) {
      this.badgeSprite.setVisible(false)
      return
    }

    // Use companion-specific badge sprite if available, else generic
    const key = `companion_badge_${companionId}`
    const fallbackKey = 'overlay_companion_badge'
    const useKey = this.scene.textures.exists(key) ? key : fallbackKey

    if (this.scene.textures.exists(useKey)) {
      this.badgeSprite.setTexture(useKey)
      this.badgeSprite.setVisible(true)
    }
  }

  /**
   * Flash the companion badge (used by MineScene.companionFlash indicator).
   * Briefly scales the badge up and returns to normal.
   */
  flashCompanionBadge(): void {
    if (!this.badgeSprite?.visible) return
    this.scene.tweens.add({
      targets: this.badgeSprite,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 120,
      ease: 'Back.Out',
      yoyo: true,
    })
  }

  // -------------------------------------------------------------------------
  // Phase 57.1 — Dirt tint system
  // -------------------------------------------------------------------------

  /**
   * Increment the blocks-mined counter and recalculate dirt tint alpha.
   * Call once per block broken.
   */
  incrementBlocksMined(): void {
    this.blocksMined++
    if (this.blocksMined >= BALANCE.DIRT_TINT_THRESHOLD_3) {
      this.dirtAlpha = 0.28
    } else if (this.blocksMined >= BALANCE.DIRT_TINT_THRESHOLD_2) {
      this.dirtAlpha = 0.18
    } else if (this.blocksMined >= BALANCE.DIRT_TINT_THRESHOLD_1) {
      this.dirtAlpha = 0.08
    } else {
      this.dirtAlpha = 0
    }
  }

  /**
   * Reset the dirt tint to clean state. Call when surfacing or starting a new dive.
   */
  resetDirtTint(): void {
    this.blocksMined = 0
    this.dirtAlpha = 0
    if (this.dirtGraphics) {
      this.dirtGraphics.clear()
      this.dirtGraphics.setVisible(false)
    }
  }

  // -------------------------------------------------------------------------
  // Phase 57.1.2 — Backpack fill indicator
  // -------------------------------------------------------------------------

  /**
   * Update the backpack fill indicator.
   *
   * @param fillPercent - Fraction from 0.0 (empty) to 1.0 (full)
   */
  updateBackpackFill(fillPercent: number): void {
    this.backpackFill = Math.max(0, Math.min(1, fillPercent))

    // Start or stop bob animation at 100%
    if (this.backpackFill >= 1.0 && !this.backpackBobTween && this.backpackGraphics) {
      this.backpackBobTween = this.scene.tweens.add({
        targets: this.backpackGraphics,
        scaleX: { from: 1.0, to: 1.3 },
        scaleY: { from: 1.0, to: 1.3 },
        duration: 600,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      })
    } else if (this.backpackFill < 1.0 && this.backpackBobTween) {
      this.backpackBobTween.stop()
      this.backpackBobTween = null
      if (this.backpackGraphics) {
        this.backpackGraphics.setScale(1)
      }
    }
  }

  /**
   * Destroy all overlay sprites. Call from MineScene.handleShutdown().
   */
  destroy(): void {
    this.pickSprite?.destroy()
    this.glowSprite?.destroy()
    this.badgeSprite?.destroy()
    this.dirtGraphics?.destroy()
    this.backpackGraphics?.destroy()
    if (this.backpackBobTween) {
      this.backpackBobTween.stop()
      this.backpackBobTween = null
    }
    this.pickSprite = null
    this.glowSprite = null
    this.badgeSprite = null
    this.dirtGraphics = null
    this.backpackGraphics = null
  }
}
