import Phaser from 'phaser'
import { isTurboMode } from '../../utils/turboMode'
import { getDeviceTier } from '../../services/deviceTierService'
import { EnemySpriteSystem } from '../systems/EnemySpriteSystem'
import { CombatAtmosphereSystem } from '../systems/CombatAtmosphereSystem'
import { DepthLightingSystem } from '../systems/DepthLightingSystem'
import { getAtmosphereConfig, type AtmosphereConfig } from '../../data/roomAtmosphere'
import { StatusEffectVisualSystem } from '../systems/StatusEffectVisualSystem'
import { WeaponAnimationSystem } from '../systems/WeaponAnimationSystem'
import { ScreenShakeSystem } from '../systems/ScreenShakeSystem'
import type { AnimArchetype } from '../../data/enemyAnimations'
import { getRandomCombatBg, getCombatBgForEnemy } from '../../data/backgroundManifest'
import { ENEMY_TEMPLATES } from '../../data/enemies'
import { BASE_WIDTH, LANDSCAPE_BASE_WIDTH } from '../../data/layout'
import { get } from 'svelte/store'
import { layoutMode, type LayoutMode } from '../../stores/layoutStore'
import { getChainAtmosphereModifiers, getChainColor } from '../../services/chainVisuals'

/** Shared font stack for all Phaser text objects in CombatScene. */
const GAME_FONT = '"Lora", "Georgia", serif'

/** Layout constants for first-person combat display zone (top ~58% of viewport). */
const DISPLAY_ZONE_HEIGHT_PCT = 0.58
const ENEMY_X_PCT = 0.50
const ENEMY_HP_Y_PCT = 0.12
const FLOOR_COUNTER_Y = 16
const INTENT_ICON_OFFSET_Y = -40
const RELIC_TRAY_Y_PCT = 0.92
const FLOOR_LINE_PCT = 0.73
const ENEMY_Y_OFFSET_RATIO = 0.25

/**
 * Landscape layout constants — Option D layout.
 * Enemy panel occupies the right 30% of the viewport.
 * Center stage (left 70%) is reserved for quiz/VFX (AR-76).
 * Card hand strip occupies the bottom 25-30%.
 */
const LANDSCAPE = {
  ENEMY_PANEL_X_START: 0.70,  // Kept for reference; enemy now centers by default
  ENEMY_X_PCT: 0.50,          // Enemy CENTERED in arena by default (spec: center, slides right on quiz)
  ENEMY_Y_PCT: 0.45,          // Vertically centered in arena
  ENEMY_HP_Y_PCT: 0.155,      // HP bar below enemy name (name at ~6.5vh, bar at ~15.5vh)
  PLAYER_HP_BAR_X_PCT: 0.68,  // Left edge (unused — player HP now in Svelte stats bar)
  PLAYER_HP_BAR_TOP: 0.20,
  PLAYER_HP_BAR_BOTTOM: 0.80,
  FLOOR_COUNTER_X: 0.72,
  FLOOR_COUNTER_Y: 0.05,
  RELIC_TRAY_X: 0.02,         // Top-left of arena
  RELIC_TRAY_Y: 0.05,
  CHAIN_COUNTER_X: 0.35,
  CHAIN_COUNTER_Y: 0.05,
} as const

/** Enemy HP bar dimensions. */
const ENEMY_HP_BAR_W = 160
const ENEMY_HP_BAR_H = 12

/** Player HP bar dimensions (vertical, right side). */
const PLAYER_HP_BAR_WIDTH = 16
const PLAYER_HP_BAR_X_OFFSET = 24
const PLAYER_HP_BAR_TOP_PCT = 0.56
const PLAYER_HP_BAR_BOTTOM_PCT = 0.88
const USE_OVERLAY_PLAYER_HUD = true

/** Enemy first-person sprite sizes by enemy tier (portrait, scaled by scaleFactor). */
const ENEMY_SIZE_COMMON = 300
const ENEMY_SIZE_ELITE = 340
const ENEMY_SIZE_BOSS = 400

/**
 * Enemy display sizes for LANDSCAPE mode, in absolute game units (NOT multiplied by scaleFactor).
 * The right 30% panel is 384px at 1280 game width. Enemy must fit comfortably within it.
 * These are raw pixel values used directly without scaleFactor multiplication.
 */
const LANDSCAPE_ENEMY_SIZE_COMMON = 300
const LANDSCAPE_ENEMY_SIZE_ELITE = 360
const LANDSCAPE_ENEMY_SIZE_BOSS = 420

/** Color constants. */
const COLOR_HP_RED = 0xe74c3c
const COLOR_HP_BLUE = 0x38bdf8
const COLOR_HP_YELLOW = 0xf1c40f
const COLOR_BAR_BG = 0x333333
const COLOR_COMMON = 0x6b7280
const COLOR_ELITE = 0xd4af37
const COLOR_BOSS = 0xdc2626

/** Map enemy category to placeholder color. */
function categoryColor(category: 'common' | 'elite' | 'mini_boss' | 'boss'): number {
  switch (category) {
    case 'elite': return COLOR_ELITE
    case 'mini_boss': return COLOR_ELITE  // Mini-bosses share elite coloring
    case 'boss': return COLOR_BOSS
    default: return COLOR_COMMON
  }
}

/**
 * Get the enemy display size for the given category and layout mode.
 * In portrait: returns pixel units that will be multiplied by scaleFactor (w/BASE_WIDTH).
 * In landscape: returns absolute game units that must NOT be multiplied by scaleFactor,
 * since the enemy panel is ~384px at 1280 game width and portrait sizes are design for 390px viewport.
 */
function enemyDisplaySize(category: 'common' | 'elite' | 'mini_boss' | 'boss', layoutMode: LayoutMode = 'portrait'): number {
  if (layoutMode === 'landscape') {
    if (category === 'boss') return LANDSCAPE_ENEMY_SIZE_BOSS
    if (category === 'elite' || category === 'mini_boss') return LANDSCAPE_ENEMY_SIZE_ELITE
    return LANDSCAPE_ENEMY_SIZE_COMMON
  }
  if (category === 'boss') return ENEMY_SIZE_BOSS
  if (category === 'elite' || category === 'mini_boss') return ENEMY_SIZE_ELITE
  return ENEMY_SIZE_COMMON
}

/** Get player HP bar fill color based on ratio. */
function playerHpColor(ratio: number): number {
  if (ratio > 0.5) return COLOR_HP_BLUE
  if (ratio > 0.25) return COLOR_HP_YELLOW
  return COLOR_HP_RED
}

function colorToCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function enemyTextureKey(enemyId: string, state: 'idle' | 'hit' | 'death'): string {
  return `enemy-${enemyId}-${state}`
}

function hasTexture(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key)
}

function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
  } catch {
    return false
  }
}

/**
 * CombatScene — Phaser scene rendering the top 55% combat display zone.
 * Displays enemy sprite, HP bars, intent telegraph, floor counter, and relics.
 * The bottom 45% (card hand / answers) is handled by Svelte overlay (CR-04).
 */
export class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' })
  }

  // ── Game objects (created once, reused) ──────────────────
  private enemySpriteSystem!: EnemySpriteSystem
  private combatBackground!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  private enemyNameText!: Phaser.GameObjects.Text
  private enemyHpBarBg!: Phaser.GameObjects.Graphics
  private enemyHpBarFill!: Phaser.GameObjects.Graphics
  private enemyHpText!: Phaser.GameObjects.Text
  private playerHpBarBg!: Phaser.GameObjects.Graphics
  private playerHpBarFill!: Phaser.GameObjects.Graphics
  private playerHpCurrentText!: Phaser.GameObjects.Text
  private playerHpSlashText!: Phaser.GameObjects.Text
  private playerHpMaxText!: Phaser.GameObjects.Text
  private intentText!: Phaser.GameObjects.Text
  private floorCounterText!: Phaser.GameObjects.Text
  private relicContainer!: Phaser.GameObjects.Container
  private flashRect!: Phaser.GameObjects.Rectangle
  private entryFadeRect!: Phaser.GameObjects.Rectangle
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter
  private enemyBlockBarFill!: Phaser.GameObjects.Graphics
  private enemyBlockIcon!: Phaser.GameObjects.Text
  private enemyBlockText!: Phaser.GameObjects.Text
  private sceneReady = false

  // ── Player block display ───────────────────────────────
  private currentPlayerBlock = 0
  private playerBlockIcon!: Phaser.GameObjects.Text
  private playerBlockText!: Phaser.GameObjects.Text
  private playerBarMaxH = 0
  private currentEnemyY = 0

  // ── State ────────────────────────────────────────────────
  private currentEnemyHP = 0
  private currentEnemyMaxHP = 0
  private currentEnemyBlock = 0
  private currentPlayerHP = 80
  private currentPlayerMaxHP = 80
  private currentFloor = 1
  private currentEncounter = 1
  private totalEncounters = 3
  private currentEnemyId = 'page_flutter'
  private currentEnemyCategory: 'common' | 'elite' | 'mini_boss' | 'boss' = 'common'
  private reduceMotion = false
  private effectScale = 1
  private flashTween: Phaser.Tweens.Tween | null = null
  private vignetteGfx!: Phaser.GameObjects.Graphics
  private edgeGlowTop!: Phaser.GameObjects.Graphics
  private edgeGlowLeft!: Phaser.GameObjects.Graphics
  private edgeGlowRight!: Phaser.GameObjects.Graphics
  private edgeGlowThickness = 0
  private edgeGlowTween: Phaser.Tweens.Tween | null = null
  private currentBgKey: string = ''

  // ── HP bar enhancement effects ───────────────────────────
  private criticalPulseRect!: Phaser.GameObjects.Rectangle
  private criticalPulseTween: Phaser.Tweens.Tween | null = null
  private damagePreviewGfx!: Phaser.GameObjects.Graphics
  private previousPlayerHpRatio = 1

  // ── Near-death tension overlay ────────────────────────────
  private nearDeathVignette!: Phaser.GameObjects.Graphics
  private nearDeathPulseTween: Phaser.Tweens.Tween | null = null
  private isNearDeathActive = false

  // ── Turn transition overlay ──────────────────────────
  /** Transient darkening rectangle created by playTurnTransitionToEnemy(); released by playTurnTransitionToPlayer(). */
  private _turnOverlay: Phaser.GameObjects.Rectangle | null = null

  // ── Charge telegraph ──────────────────────────────────
  private chargeParticleTimer: Phaser.Time.TimerEvent | null = null
  private chargeGlowCircle: Phaser.GameObjects.Arc | null = null
  private chargeGlowTween: Phaser.Tweens.Tween | null = null
  private isCharging = false

  // ── VFX systems ────────────────────────────────────
  private atmosphereSystem!: CombatAtmosphereSystem
  private depthLightingSystem!: DepthLightingSystem
  private statusEffectVisuals!: StatusEffectVisualSystem
  private weaponAnimations!: WeaponAnimationSystem
  public screenShake!: ScreenShakeSystem

  // ── Chain combo visual state (Spec 03) ────────────
  /** Active vignette pulse tween for chain 5+ escalation. */
  private chainVignetteTween: Phaser.Tweens.Tween | null = null
  /** Overlay rect for slow alpha oscillation during chain 5+. */
  private chainVignetteOverlay: Phaser.GameObjects.Rectangle | null = null
  /** Additive color tint overlay rect for chain 5+ color wash. */
  private chainTintOverlay: Phaser.GameObjects.Rectangle | null = null
  /** Tracks the last chain count so per-card shake tier is available mid-turn. */
  private currentChainCount: number = 0

  // ── Atmosphere color grading ──────────────────────
  private _colorMatrixFx: Phaser.FX.ColorMatrix | null = null
  private atmosphereConfig: AtmosphereConfig | null = null

  // ── Stored layout values ─────────────────────────────────
  private displayH = 0
  private scaleFactor: number = 1
  private currentLayoutMode: LayoutMode = 'portrait'

  // ── Quiz slide state ──────────────────────────────────────
  /** When non-null, overrides LANDSCAPE.ENEMY_X_PCT for HP bar rendering during quiz slide. */
  private quizEnemyXOverride: number | null = null
  /** When non-null, overrides the HP bar width/height scale during quiz slide (0.55 when active). */
  private quizEnemyScaleOverride: number | null = null

  // ═════════════════════════════════════════════════════════
  // Layout change handler (AR-71)
  // ═════════════════════════════════════════════════════════

  /** Called by Phaser scale manager when the game canvas resizes (e.g., browser window drag). */
  private onScaleResize(): void {
    if (this.sceneReady) {
      // Recompute scale factor and display zone for new canvas dimensions
      this.scaleFactor = this.scale.width / BASE_WIDTH
      this.displayH = this.scale.height * DISPLAY_ZONE_HEIGHT_PCT
      this.repositionAll()
      // Resize chain overlays to fill the new viewport
      const w = this.scale.width
      const h = this.scale.height
      this.chainVignetteOverlay?.setPosition(w / 2, h / 2).setSize(w, h)
      this.chainTintOverlay?.setPosition(w / 2, h / 2).setSize(w, h)
    }
  }

  /**
   * Called by CardGameManager when the layout mode changes (portrait ↔ landscape).
   * Stores the mode and repositions all scene objects accordingly.
   */
  handleLayoutChange(mode: LayoutMode): void {
    this.currentLayoutMode = mode
    if (this.sceneReady) {
      this.repositionAll()
    }
  }

  /**
   * Slide enemy group right when quiz activates, back to center when done.
   * Only runs in landscape mode. Called by CardCombatOverlay via getCombatScene().
   * @param active - true = quiz opened (slide right), false = quiz closed (slide back)
   */
  slideEnemyForQuiz(active: boolean): void {
    if (this.currentLayoutMode !== 'landscape') return
    if (!this.sceneReady) return
    const gameW = this.scale.width
    const gameH = this.scale.height
    const defaultX = gameW * LANDSCAPE.ENEMY_X_PCT
    // Quiz panel occupies left ~58%; enemy fits in right 42% centered around 79%
    const targetX = active ? gameW * 0.79 : defaultX
    // Scale enemy down to 0.55x so it fits within the right 40% without clipping
    const targetScale = active ? 0.55 : 1.0

    // Initialize the override to the current X if not already set
    if (this.quizEnemyXOverride === null) {
      this.quizEnemyXOverride = defaultX
    }

    const container = this.enemySpriteSystem?.getContainer()
    const currentScale = container?.scaleX ?? 1.0

    // Use a proxy object to drive all positions and scale via a single onUpdate callback
    const proxy = { x: this.quizEnemyXOverride, scale: currentScale }
    const scaledW = Math.round(ENEMY_HP_BAR_W * this.scaleFactor)
    const scaledH = Math.round(ENEMY_HP_BAR_H * this.scaleFactor)
    const hpY = gameH * LANDSCAPE.ENEMY_HP_Y_PCT
    // Base enemy size before quiz scale — use displayHeight at scale=1 or fall back to fixed value
    const baseEnemySize = container ? (container.displayHeight / currentScale) : 0
    const blockIconOffsetX = scaledW / 2 + Math.round(20 * this.scaleFactor)
    const intentY = hpY + Math.round(INTENT_ICON_OFFSET_Y * this.scaleFactor)

    this.tweens.killTweensOf(proxy)
    this.tweens.add({
      targets: proxy,
      x: targetX,
      scale: targetScale,
      duration: 200,
      ease: 'Power2',
      onUpdate: () => {
        const x = proxy.x
        const s = proxy.scale
        this.quizEnemyXOverride = x
        this.quizEnemyScaleOverride = s

        // Move and scale enemy sprite container
        if (container) {
          container.setPosition(x, gameH * LANDSCAPE.ENEMY_Y_PCT)
          container.setScale(s)
          // Update the sprite system's base position so idle animations don't reset
          this.enemySpriteSystem?.updateBasePosition(x, gameH * LANDSCAPE.ENEMY_Y_PCT)
        }

        // Name text: below the scaled sprite
        const scaledHalfHeight = (baseEnemySize * s) / 2
        const nameOffsetY = gameH * LANDSCAPE.ENEMY_Y_PCT + scaledHalfHeight + Math.round(12 * this.scaleFactor)
        this.enemyNameText.setPosition(x, nameOffsetY)

        // Move intent text
        this.intentText.setPosition(x, intentY)

        // Move HP text
        this.enemyHpText.setPosition(x, hpY)

        // Redraw HP bar background scaled proportionally with the enemy
        const barW = Math.round(scaledW * s)
        const barH = Math.round(scaledH * s)
        this.enemyHpBarBg.clear()
        this.enemyHpBarBg.fillStyle(0x1a1a2e, 1)
        this.enemyHpBarBg.fillRoundedRect(
          x - barW / 2, hpY - barH / 2,
          barW, barH, 6
        )
        this.enemyHpBarBg.setData('drawnBounds', { x: x - barW / 2, y: hpY - barH / 2, w: barW, h: barH })

        // Redraw HP bar fill at new position (uses quizEnemyScaleOverride internally)
        this.refreshEnemyHpBar(false)

        // Move block indicators
        this.enemyBlockIcon.setPosition(x - blockIconOffsetX, hpY)
        this.enemyBlockText.setPosition(x - blockIconOffsetX + Math.round(10 * this.scaleFactor), hpY + Math.round(12 * this.scaleFactor))
      },
      onComplete: () => {
        if (!active) {
          // Reset overrides and scale so normal repositionAll works correctly
          this.quizEnemyXOverride = null
          this.quizEnemyScaleOverride = null
          container?.setScale(1.0)
          // Restore base position to default so idle animations anchor correctly
          this.enemySpriteSystem?.updateBasePosition(defaultX, gameH * LANDSCAPE.ENEMY_Y_PCT)
        } else {
          // Ensure the final slid position sticks for idle animations
          this.enemySpriteSystem?.updateBasePosition(targetX, gameH * LANDSCAPE.ENEMY_Y_PCT)
        }
        // Final refresh to settle everything
        this.refreshEnemyHpBar(false)
        this.refreshEnemyBlockBar(false)
      },
    })
  }

  /**
   * Reposition all game objects based on the current layout mode.
   * Portrait: uses original portrait constants (pixel-identical to pre-AR-73).
   * Landscape: uses LANDSCAPE constants (Option D — enemy panel right 30%).
   */
  private repositionAll(): void {
    const w = this.scale.width
    const h = this.scale.height
    const isLandscape = this.currentLayoutMode === 'landscape'

    // ── Enemy position ──────────────────────────────────────
    // Landscape: use absolute game units (not scaled by scaleFactor) since the right-30% panel
    // is ~384px at 1280 game width, whereas portrait sizes were designed for a 390px viewport.
    const size = isLandscape
      ? enemyDisplaySize(this.currentEnemyCategory, 'landscape')
      : Math.round(enemyDisplaySize(this.currentEnemyCategory) * this.scaleFactor)
    let enemyX: number
    let enemyY: number

    if (isLandscape) {
      // Respect quiz slide override when active (slideEnemyForQuiz sets this)
      enemyX = this.quizEnemyXOverride ?? w * LANDSCAPE.ENEMY_X_PCT
      enemyY = h * LANDSCAPE.ENEMY_Y_PCT
    } else {
      enemyX = w * ENEMY_X_PCT
      const floorY = this.displayH * FLOOR_LINE_PCT
      enemyY = floorY - size / 2 + size * ENEMY_Y_OFFSET_RATIO
    }
    this.currentEnemyY = enemyY

    // Move enemy sprite container and scale proportionally to viewport
    const container = this.enemySpriteSystem.getContainer()
    container.setPosition(enemyX, enemyY)
    if (isLandscape) {
      // Landscape sprites use fixed pixel sizes designed for 1280px base — scale to current canvas
      const landscapeScale = this.quizEnemyScaleOverride ?? (w / LANDSCAPE_BASE_WIDTH)
      container.setScale(landscapeScale)
    }

    // Update enemy name text position
    this.enemyNameText.setPosition(enemyX, enemyY + size / 2 + Math.round(12 * this.scaleFactor))

    // ── Enemy HP bar ────────────────────────────────────────
    const scaledEnemyHpBarW = Math.round(ENEMY_HP_BAR_W * this.scaleFactor)
    const scaledEnemyHpBarH = Math.round(ENEMY_HP_BAR_H * this.scaleFactor)
    let enemyHpBarCenterX: number
    let enemyHpY: number

    if (isLandscape) {
      // Respect quiz slide override when active (mirrors enemy sprite position)
      enemyHpBarCenterX = this.quizEnemyXOverride ?? w * LANDSCAPE.ENEMY_X_PCT
      enemyHpY = h * LANDSCAPE.ENEMY_HP_Y_PCT
    } else {
      enemyHpBarCenterX = w / 2
      enemyHpY = this.displayH * ENEMY_HP_Y_PCT
    }

    this.enemyHpBarBg.clear()
    this.enemyHpBarBg.fillStyle(COLOR_BAR_BG, 1)
    this.enemyHpBarBg.fillRoundedRect(
      enemyHpBarCenterX - scaledEnemyHpBarW / 2, enemyHpY - scaledEnemyHpBarH / 2,
      scaledEnemyHpBarW, scaledEnemyHpBarH, 6
    )
    this.enemyHpBarBg.setData('drawnBounds', { x: enemyHpBarCenterX - scaledEnemyHpBarW / 2, y: enemyHpY - scaledEnemyHpBarH / 2, w: scaledEnemyHpBarW, h: scaledEnemyHpBarH })
    this.enemyHpText.setPosition(enemyHpBarCenterX, enemyHpY)
    this.enemyBlockIcon.setPosition(
      enemyHpBarCenterX - scaledEnemyHpBarW / 2 - Math.round(20 * this.scaleFactor), enemyHpY
    )
    this.enemyBlockText.setPosition(
      enemyHpBarCenterX - scaledEnemyHpBarW / 2 - Math.round(20 * this.scaleFactor),
      enemyHpY + Math.round(12 * this.scaleFactor)
    )
    this.intentText.setPosition(
      enemyHpBarCenterX,
      enemyHpY + Math.round(INTENT_ICON_OFFSET_Y * this.scaleFactor)
    )

    // Refresh HP bar fill to match new position
    this.refreshEnemyHpBar(false)
    this.refreshEnemyBlockBar(false)

    // ── Player HP bar ───────────────────────────────────────
    let barX: number
    let barTop: number
    let barBottom: number

    if (isLandscape) {
      barX = w * LANDSCAPE.PLAYER_HP_BAR_X_PCT
      barTop = h * LANDSCAPE.PLAYER_HP_BAR_TOP
      barBottom = h * LANDSCAPE.PLAYER_HP_BAR_BOTTOM
    } else {
      const scaledPlayerHpBarXOffset = Math.round(PLAYER_HP_BAR_X_OFFSET * this.scaleFactor)
      barX = w - scaledPlayerHpBarXOffset
      barTop = h * PLAYER_HP_BAR_TOP_PCT
      barBottom = h * PLAYER_HP_BAR_BOTTOM_PCT
    }
    this.playerBarMaxH = barBottom - barTop

    const scaledPlayerHpBarWidth = Math.round(PLAYER_HP_BAR_WIDTH * this.scaleFactor)
    this.playerHpBarBg.clear()
    this.playerHpBarBg.fillStyle(COLOR_BAR_BG, 1)
    this.playerHpBarBg.fillRoundedRect(
      barX - scaledPlayerHpBarWidth / 2, barTop,
      scaledPlayerHpBarWidth, this.playerBarMaxH, 8
    )
    this.playerHpBarBg.setData('drawnBounds', { x: barX - scaledPlayerHpBarWidth / 2, y: barTop, w: scaledPlayerHpBarWidth, h: this.playerBarMaxH })
    this.playerHpCurrentText.setPosition(barX, barTop - Math.round(22 * this.scaleFactor))
    this.playerHpSlashText.setPosition(barX, barTop - Math.round(12 * this.scaleFactor))
    this.playerHpMaxText.setPosition(barX, barTop - Math.round(2 * this.scaleFactor))
    this.criticalPulseRect.setPosition(barX, (barTop + barBottom) / 2)
    this.playerBlockIcon.setPosition(
      barX - Math.round(52 * this.scaleFactor), barTop - Math.round(15 * this.scaleFactor)
    )
    this.playerBlockText.setPosition(
      barX - Math.round(42 * this.scaleFactor), barTop - Math.round(15 * this.scaleFactor)
    )
    this.refreshPlayerHpBar(false)

    // ── Floor counter ───────────────────────────────────────
    if (isLandscape) {
      this.floorCounterText.setPosition(
        w * LANDSCAPE.FLOOR_COUNTER_X,
        h * LANDSCAPE.FLOOR_COUNTER_Y
      )
    } else {
      this.floorCounterText.setPosition(12, Math.round(FLOOR_COUNTER_Y * this.scaleFactor))
    }

    // ── Relic tray ──────────────────────────────────────────
    if (isLandscape) {
      this.relicContainer.setPosition(w * LANDSCAPE.RELIC_TRAY_X, h * LANDSCAPE.RELIC_TRAY_Y)
    } else {
      this.relicContainer.setPosition(w / 2, this.displayH * RELIC_TRAY_Y_PCT)
    }

    // ── Vignette graphics — redraw for new dimensions ───────
    this.vignetteGfx.clear()
    if (isLandscape) {
      // In landscape, vignette covers full viewport — lighter on sides since enemy panel is right 30%
      const sideVignetteW = Math.round(w * 0.15)
      const topVignetteH = Math.round(h * 0.12)
      this.vignetteGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.4, 0, 0.4, 0)
      this.vignetteGfx.fillRect(0, 0, sideVignetteW, h)
      this.vignetteGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08, 0.08, 0, 0)
      this.vignetteGfx.fillRect(0, 0, w, topVignetteH)
    } else {
      // Portrait vignette — original values
      const sideVignetteW = Math.round(w * 0.24)
      const topVignetteH = Math.round(h * 0.16)
      this.vignetteGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.52, 0, 0.52, 0)
      this.vignetteGfx.fillRect(0, 0, sideVignetteW, h)
      this.vignetteGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.52, 0, 0.52)
      this.vignetteGfx.fillRect(w - sideVignetteW, 0, sideVignetteW, h)
      this.vignetteGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08, 0.08, 0, 0)
      this.vignetteGfx.fillRect(0, 0, w, topVignetteH)
    }

    // ── Status effects — update enemy position ──────────────
    this.statusEffectVisuals?.setEnemyPosition(enemyX, enemyY)

    // ── Flash / fade rects — cover full viewport in both modes ──
    this.flashRect.setPosition(w / 2, h / 2)
    this.flashRect.setSize(w, h)
    this.entryFadeRect.setPosition(w / 2, h / 2)
    this.entryFadeRect.setSize(w, h)

    // ── Combat background — recentre and resize to always fill full viewport ──
    if (this.combatBackground) {
      if (this.combatBackground instanceof Phaser.GameObjects.Image) {
        const tex = this.textures.get(this.combatBackground.texture.key).getSourceImage()
        const imgW = (tex as HTMLImageElement).naturalWidth || (tex as HTMLCanvasElement).width || w
        const imgH = (tex as HTMLImageElement).naturalHeight || (tex as HTMLCanvasElement).height || h
        const scale = Math.max(w / imgW, h / imgH)
        this.combatBackground.setPosition(w / 2, h / 2)
        this.combatBackground.setDisplaySize(imgW * scale, imgH * scale)
      } else {
        // Rectangle fallback — resize to cover full canvas
        ;(this.combatBackground as Phaser.GameObjects.Rectangle).setPosition(w / 2, h / 2)
        ;(this.combatBackground as Phaser.GameObjects.Rectangle).setSize(w, h)
      }
    }
  }

  // ═════════════════════════════════════════════════════════
  // Lifecycle
  // ═════════════════════════════════════════════════════════

  /** Preload combat assets (background + enemy sprites). */
  preload(): void {
    const pw = this.scale.width
    const ph = this.scale.height
    const loadBarBg = this.add.rectangle(pw / 2, ph / 2, 200, 16, 0x333333)
    const loadBarFill = this.add.rectangle(pw / 2 - 100, ph / 2, 0, 16, 0xf1c40f).setOrigin(0, 0.5)
    const loadText = this.add.text(pw / 2, ph / 2 - 24, 'Loading...', {
      fontFamily: GAME_FONT, fontSize: '12px', color: '#cccccc',
    }).setOrigin(0.5, 0.5)

    this.load.on('progress', (value: number) => {
      loadBarFill.displayWidth = 200 * value
    })
    this.load.on('complete', () => {
      loadBarBg.destroy()
      loadBarFill.destroy()
      loadText.destroy()
    })
    // Suppress file-not-found errors for missing enemy sprites — game shows colored placeholder instead.
    // BUT log weapon texture failures so we can debug them.
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key.startsWith('weapon-')) {
        console.error('[CombatScene] WEAPON TEXTURE LOAD FAILED:', file.key, file.url)
      }
      // intentionally silent for enemy sprites — they fall back to colored rectangle placeholder
    })

    const suffix = getDeviceTier() === 'low-end' ? '_1x.webp' : '.webp'

    // Preload all enemy idle sprites and depth maps
    // Depth maps are only loaded for enemies that have sprite files (not placeholders).
    // Missing depth maps are silently skipped — the depth effect gracefully degrades.
    for (const enemy of ENEMY_TEMPLATES) {
      const key = `enemy-${enemy.id}-idle`
      if (!this.textures.exists(key)) {
        this.load.image(key, `assets/sprites/enemies/${enemy.id}_idle${suffix}`)
      }
    }
    // Depth maps are loaded on-demand per encounter (not upfront) to avoid
    // console spam from enemies that don't have sprite/depth files.

    // ── Weapon animation system ──────────────────────────
    this.weaponAnimations = new WeaponAnimationSystem(this)
    this.weaponAnimations.preloadAssets()
  }

  /** Create all game objects for the combat display zone. */
  create(): void {
    this.reduceMotion = isReduceMotionEnabled()
    this.effectScale = getDeviceTier() === 'low-end' ? 0.65 : 1
    const w = this.scale.width
    const h = this.scale.height
    this.scaleFactor = w / BASE_WIDTH
    this.displayH = h * DISPLAY_ZONE_HEIGHT_PCT

    // ── Combat background ─────────────────────────────────
    // Initial dark background — real bg loaded per-encounter via setBackground()
    this.combatBackground = this.add.rectangle(w / 2, h / 2, w, h, 0x0d1117)

    // ── Permanent vignette (smooth edge fade) ────────────
    this.vignetteGfx = this.add.graphics().setDepth(1)
    const sideVignetteW = Math.round(w * 0.24)
    const topVignetteH = Math.round(h * 0.16)
    this.vignetteGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.52, 0, 0.52, 0)
    this.vignetteGfx.fillRect(0, 0, sideVignetteW, h)
    this.vignetteGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.52, 0, 0.52)
    this.vignetteGfx.fillRect(w - sideVignetteW, 0, sideVignetteW, h)
    this.vignetteGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08, 0.08, 0, 0)
    this.vignetteGfx.fillRect(0, 0, w, topVignetteH)

    // ── Near-death tension vignette (hidden by default) ──
    this.nearDeathVignette = this.add.graphics().setDepth(3).setAlpha(0)
    const ndSteps = 32
    for (let i = 0; i < ndSteps; i++) {
      const t = i / ndSteps
      const alpha = 0.35 * Math.pow(1 - t, 2.5)
      const ox = w * 0.15 * t
      const oy = h * 0.15 * t
      this.nearDeathVignette.fillStyle(0xff0000, alpha)
      this.nearDeathVignette.fillRect(0, oy, w, (h * 0.15 - oy) / ndSteps + 1)
      this.nearDeathVignette.fillRect(0, h - oy - (h * 0.15 - oy) / ndSteps - 1, w, (h * 0.15 - oy) / ndSteps + 1)
      this.nearDeathVignette.fillRect(ox, 0, (w * 0.15 - ox) / ndSteps + 1, h)
      this.nearDeathVignette.fillRect(w - ox - (w * 0.15 - ox) / ndSteps - 1, 0, (w * 0.15 - ox) / ndSteps + 1, h)
    }

    // ── Edge glow graphics (event-driven, gradient-filled) ──────────────
    this.edgeGlowThickness = Math.round(h * 0.05)
    this.edgeGlowTop = this.add.graphics().setDepth(2).setAlpha(0)
    this.edgeGlowLeft = this.add.graphics().setDepth(2).setAlpha(0)
    this.edgeGlowRight = this.add.graphics().setDepth(2).setAlpha(0)

    // ── Floor counter (top-left) ──────────────────────────
    this.floorCounterText = this.add.text(12, Math.round(FLOOR_COUNTER_Y * this.scaleFactor), this.floorLabel(), {
      fontFamily: GAME_FONT,
      fontSize: `${Math.round(13 * this.scaleFactor)}px`,
      color: '#cccccc',
    })
    this.floorCounterText.setVisible(false)

    // ── Enemy intent ──────────────────────────────────────
    const enemyHpY = this.displayH * ENEMY_HP_Y_PCT
    this.intentText = this.add.text(w / 2, enemyHpY + Math.round(INTENT_ICON_OFFSET_Y * this.scaleFactor), '', {
      fontFamily: GAME_FONT,
      fontSize: `${Math.round(16 * this.scaleFactor)}px`,
      color: '#ff9999',
      align: 'center',
    }).setOrigin(0.5, 1)
    this.intentText.setVisible(false)

    // ── Enemy HP bar ──────────────────────────────────────
    const scaledEnemyHpBarW = Math.round(ENEMY_HP_BAR_W * this.scaleFactor)
    const scaledEnemyHpBarH = Math.round(ENEMY_HP_BAR_H * this.scaleFactor)
    this.enemyHpBarBg = this.add.graphics().setDepth(10)
    this.enemyHpBarBg.fillStyle(COLOR_BAR_BG, 1)
    this.enemyHpBarBg.fillRoundedRect(
      w / 2 - scaledEnemyHpBarW / 2, enemyHpY - scaledEnemyHpBarH / 2,
      scaledEnemyHpBarW, scaledEnemyHpBarH, 6
    )
    this.enemyHpBarBg.setData('drawnBounds', { x: w / 2 - scaledEnemyHpBarW / 2, y: enemyHpY - scaledEnemyHpBarH / 2, w: scaledEnemyHpBarW, h: scaledEnemyHpBarH })

    this.enemyHpBarFill = this.add.graphics().setDepth(11)
    this.enemyHpBarFill.fillStyle(COLOR_HP_RED, 1)
    this.enemyHpBarFill.fillRoundedRect(
      w / 2 - scaledEnemyHpBarW / 2, enemyHpY - scaledEnemyHpBarH / 2,
      scaledEnemyHpBarW, scaledEnemyHpBarH, 6
    )
    this.enemyHpBarFill.setData('drawnBounds', { x: w / 2 - scaledEnemyHpBarW / 2, y: enemyHpY - scaledEnemyHpBarH / 2, w: scaledEnemyHpBarW, h: scaledEnemyHpBarH })

    this.enemyHpText = this.add.text(w / 2, enemyHpY, '', {
      fontFamily: GAME_FONT,
      fontSize: `${Math.round(10 * this.scaleFactor)}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 1,
      align: 'center',
      fixedWidth: Math.round(ENEMY_HP_BAR_W * this.scaleFactor),
    }).setOrigin(0.5, 0.5).setDepth(13)

    // ── Damage preview ghost bar (enemy HP) ────────────────
    this.damagePreviewGfx = this.add.graphics().setDepth(11)

    // ── Enemy block bar (overlays HP bar when enemy has block) ──
    this.enemyBlockBarFill = this.add.graphics().setDepth(12)

    this.enemyBlockIcon = this.add.text(
      w / 2 - scaledEnemyHpBarW / 2 - Math.round(20 * this.scaleFactor), enemyHpY,
      '🛡️', { fontSize: `${Math.round(14 * this.scaleFactor)}px` }
    ).setOrigin(0.5, 0.5).setDepth(12).setVisible(false)

    this.enemyBlockText = this.add.text(
      w / 2 - scaledEnemyHpBarW / 2 - Math.round(20 * this.scaleFactor), enemyHpY + Math.round(12 * this.scaleFactor),
      '', { fontFamily: GAME_FONT, fontSize: `${Math.round(10 * this.scaleFactor)}px`, color: '#3498db' }
    ).setOrigin(0.5, 0.5).setDepth(12).setVisible(false)

    // ── Enemy sprite system ─────────────────────────────
    const floorY = this.displayH * FLOOR_LINE_PCT
    const baseEnemySize = Math.round(enemyDisplaySize('common') * this.scaleFactor)
    const enemyY = floorY - baseEnemySize / 2 + baseEnemySize * ENEMY_Y_OFFSET_RATIO
    this.currentEnemyY = enemyY
    this.enemySpriteSystem = new EnemySpriteSystem(this)

    this.enemyNameText = this.add.text(w * ENEMY_X_PCT, enemyY + baseEnemySize / 2 + Math.round(12 * this.scaleFactor), '', {
      fontFamily: GAME_FONT,
      fontSize: `${Math.round(14 * this.scaleFactor)}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 1,
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(7)
    this.enemyNameText.setVisible(false)

    // ── Player HP bar (vertical, right side) ─────────────────
    const scaledPlayerHpBarWidth = Math.round(PLAYER_HP_BAR_WIDTH * this.scaleFactor)
    const scaledPlayerHpBarXOffset = Math.round(PLAYER_HP_BAR_X_OFFSET * this.scaleFactor)
    const barX = w - scaledPlayerHpBarXOffset
    const barTop = h * PLAYER_HP_BAR_TOP_PCT
    const barBottom = h * PLAYER_HP_BAR_BOTTOM_PCT
    this.playerBarMaxH = barBottom - barTop

    this.playerHpBarBg = this.add.graphics().setDepth(8)
    this.playerHpBarBg.fillStyle(COLOR_BAR_BG, 1)
    this.playerHpBarBg.fillRoundedRect(
      barX - scaledPlayerHpBarWidth / 2, barTop,
      scaledPlayerHpBarWidth, this.playerBarMaxH, 8
    )
    this.playerHpBarBg.setData('drawnBounds', { x: barX - scaledPlayerHpBarWidth / 2, y: barTop, w: scaledPlayerHpBarWidth, h: this.playerBarMaxH })

    this.playerHpBarFill = this.add.graphics().setDepth(8)
    this.playerHpBarFill.fillStyle(COLOR_HP_BLUE, 1)
    this.playerHpBarFill.fillRoundedRect(
      barX - scaledPlayerHpBarWidth / 2, barTop,
      scaledPlayerHpBarWidth, this.playerBarMaxH, 8
    )
    this.playerHpBarFill.setData('drawnBounds', { x: barX - scaledPlayerHpBarWidth / 2, y: barTop, w: scaledPlayerHpBarWidth, h: this.playerBarMaxH })

    const initialHpRatio = this.currentPlayerMaxHP > 0 ? this.currentPlayerHP / this.currentPlayerMaxHP : 0
    const hpColorCss = colorToCssHex(playerHpColor(initialHpRatio))
    this.playerHpCurrentText = this.add.text(barX, barTop - Math.round(22 * this.scaleFactor), `${this.currentPlayerHP}`, {
      fontFamily: GAME_FONT,
      fontSize: `${Math.round(11 * this.scaleFactor)}px`,
      color: hpColorCss,
      stroke: '#000000',
      strokeThickness: 1,
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(8)

    this.playerHpSlashText = this.add.text(barX, barTop - Math.round(12 * this.scaleFactor), '/', {
      fontFamily: GAME_FONT,
      fontSize: `${Math.round(11 * this.scaleFactor)}px`,
      color: hpColorCss,
      stroke: '#000000',
      strokeThickness: 1,
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(8)

    this.playerHpMaxText = this.add.text(barX, barTop - Math.round(2 * this.scaleFactor), `${this.currentPlayerMaxHP}`, {
      fontFamily: GAME_FONT,
      fontSize: `${Math.round(11 * this.scaleFactor)}px`,
      color: hpColorCss,
      stroke: '#000000',
      strokeThickness: 1,
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(8)

    // ── Critical health pulse overlay (behind player HP bar) ──
    this.criticalPulseRect = this.add.rectangle(
      barX, (barTop + barBottom) / 2,
      scaledPlayerHpBarWidth + Math.round(12 * this.scaleFactor), this.playerBarMaxH + Math.round(12 * this.scaleFactor),
      COLOR_HP_RED, 0
    ).setDepth(7).setVisible(false)

    // ── Player block icon (above HP bar) ────────────────────
    this.playerBlockIcon = this.add.text(barX - Math.round(52 * this.scaleFactor), barTop - Math.round(15 * this.scaleFactor), '\u{1F6E1}\u{FE0F}', {
      fontSize: `${Math.round(16 * this.scaleFactor)}px`,
    }).setOrigin(0.5, 0.5).setVisible(false).setDepth(12)

    this.playerBlockText = this.add.text(barX - Math.round(42 * this.scaleFactor), barTop - Math.round(15 * this.scaleFactor), '', {
      fontFamily: GAME_FONT,
      fontSize: `${Math.round(11 * this.scaleFactor)}px`,
      color: '#7dd3fc',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0, 0.5).setVisible(false).setDepth(13)

    if (USE_OVERLAY_PLAYER_HUD) {
      this.playerHpBarBg.setVisible(false)
      this.playerHpBarFill.setVisible(false)
      this.playerHpCurrentText.setVisible(false)
      this.playerHpSlashText.setVisible(false)
      this.playerHpMaxText.setVisible(false)
      this.playerBlockIcon.setVisible(false)
      this.playerBlockText.setVisible(false)
      this.criticalPulseRect.setVisible(false)
    }

    // ── Relic tray container ──────────────────────────────
    this.relicContainer = this.add.container(w / 2, this.displayH * RELIC_TRAY_Y_PCT)

    // ── Screen flash overlay (full display zone, max depth) ─
    this.flashRect = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.height * DISPLAY_ZONE_HEIGHT_PCT / 2,
      this.cameras.main.width,
      this.cameras.main.height * DISPLAY_ZONE_HEIGHT_PCT,
      0xFFFFFF, 0
    )
    this.flashRect.setDepth(999)

    // ── Encounter entry fade overlay ──────────────────────
    this.entryFadeRect = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.height * DISPLAY_ZONE_HEIGHT_PCT / 2,
      this.cameras.main.width,
      this.cameras.main.height * DISPLAY_ZONE_HEIGHT_PCT,
      0x000000,
      0,
    )
    this.entryFadeRect.setDepth(995)

    // ── Particle emitter (procedural texture) ───────────
    const gfx = this.make.graphics({ x: 0, y: 0 })
    gfx.fillStyle(0xFFFFFF)
    gfx.fillRect(0, 0, 4, 4)
    gfx.generateTexture('particle', 4, 4)
    gfx.destroy()

    this.particles = this.add.particles(0, 0, 'particle', {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 300,
      gravityY: 50,
      emitting: false,
      maxParticles: Math.max(20, Math.round(50 * this.effectScale)),
    })
    this.particles.setDepth(998)

    // ── Screen shake system ─────────────────────────
    this.screenShake = new ScreenShakeSystem(this)

    // ── Combat atmosphere system ────────────────────
    this.atmosphereSystem = new CombatAtmosphereSystem(this)

    // ── Depth-based background lighting ───────────
    this.depthLightingSystem = new DepthLightingSystem(this)

    // ── Status effect visual system ─────────────────
    this.statusEffectVisuals = new StatusEffectVisualSystem(this)

    // ── Weapon animation system ──────────────────────────────
    this.weaponAnimations.createSprites(this.displayH)

    // ── Scene lifecycle events ────────────────────────────
    this.events.on('shutdown', this.onShutdown, this)
    this.events.on('sleep', this.onShutdown, this)
    this.events.on('wake', this.onWake, this)

    // Fix: Reposition all elements when browser window is resized within the same layout mode.
    // Without this, Phaser's RESIZE scale mode updates the canvas dimensions but
    // positioned elements (HP bar, sprites, text) stay at stale pixel coordinates.
    this.scale.on('resize', this.onScaleResize, this)

    // Fix 1 (AR-97): Sync layout mode on scene create — the scene may have been
    // sleeping when the layout changed, so CardGameManager's handleLayoutChange
    // broadcast was missed. Read the store directly to catch up.
    const initialMode = get(layoutMode)
    if (initialMode !== this.currentLayoutMode) {
      this.currentLayoutMode = initialMode
      this.repositionAll()
    }

    this.sceneReady = true
  }

  // ═════════════════════════════════════════════════════════
  // Frame update
  // ═════════════════════════════════════════════════════════

  /** Called every frame by Phaser. Drives per-frame systems. */
  update(time: number, delta: number): void {
    this.screenShake?.update(delta)
    this.depthLightingSystem?.update(time)
  }

  // ═════════════════════════════════════════════════════════
  // Public API — called by GameManager / bridge
  // ═════════════════════════════════════════════════════════

  /** Get the current enemy X position based on layout mode. */
  private getEnemyX(): number {
    if (this.currentLayoutMode === 'landscape') {
      return this.scale.width * LANDSCAPE.ENEMY_X_PCT
    }
    return this.scale.width * ENEMY_X_PCT
  }

  /** Get the current enemy Y position for a given display size based on layout mode. */
  private getEnemyY(size: number): number {
    if (this.currentLayoutMode === 'landscape') {
      return this.scale.height * LANDSCAPE.ENEMY_Y_PCT
    }
    const floorY = this.displayH * FLOOR_LINE_PCT
    return floorY - size / 2 + size * ENEMY_Y_OFFSET_RATIO
  }

  /** Set the enemy display data. */
  setEnemy(
    name: string,
    category: 'common' | 'elite' | 'mini_boss' | 'boss',
    hp: number,
    maxHP: number,
    enemyId?: string,
    animArchetype?: AnimArchetype,
  ): void {
    if (!this.sceneReady) return
    this.currentEnemyHP = hp
    this.currentEnemyMaxHP = maxHP
    if (hp <= 0 || maxHP <= 0) {
      console.error('[CombatScene] setEnemy called with invalid HP:', { hp, maxHP, name, enemyId })
    }
    this.currentEnemyId = enemyId ?? this.currentEnemyId
    this.currentEnemyCategory = category
    // Landscape: use absolute game units (not scaled by scaleFactor)
    const size = this.currentLayoutMode === 'landscape'
      ? enemyDisplaySize(category, 'landscape')
      : Math.round(enemyDisplaySize(category) * this.scaleFactor)
    const enemyX = this.getEnemyX()
    const enemyY = this.getEnemyY(size)
    this.currentEnemyY = enemyY

    // Clear status effects from previous encounter
    this.statusEffectVisuals?.clearAll()

    // Setup enemy sprite/placeholder via EnemySpriteSystem
    const texture = enemyTextureKey(this.currentEnemyId, 'idle')
    const hasSprite = hasTexture(this, texture)

    if (hasSprite) {
      this.enemySpriteSystem.setSprite(texture, size, enemyX, enemyY, category)
    } else {
      this.enemySpriteSystem.setPlaceholder(categoryColor(category), size, enemyX, enemyY, category)
    }

    // Apply animation archetype config
    this.enemySpriteSystem.setAnimConfig(animArchetype, this.currentEnemyId)

    this.enemyNameText.setText(name)
    this.enemyNameText.setPosition(enemyX, enemyY + size / 2 + Math.round(12 * this.scaleFactor))
    this.refreshEnemyHpBar(false)
    this.playEncounterEntry()

    // Start atmosphere effects
    this.atmosphereSystem.start(this.currentFloor, this.currentEnemyCategory === 'boss')
    this.atmosphereSystem.setEnemyPosition(enemyX)

    // Apply atmosphere visual effects (tinting, AO, color grading)
    const atmConfig = this.atmosphereSystem.getConfig() ?? getAtmosphereConfig(this.currentFloor)
    this.atmosphereConfig = atmConfig
    // Sprite tinting and AO disabled until Light2D (AR-219) adds point lights.
    // Without light sources, multiplicative tint + AO just darkens everything.
    this.applyColorGrading(atmConfig)

    // Apply depth-based lighting parameters from the atmosphere config
    this.depthLightingSystem.setEnemyContext(this.currentEnemyId, this.currentFloor)
    this.depthLightingSystem.applyAtmosphere(atmConfig)
  }

  /** Update enemy HP (optionally animate the bar). */
  updateEnemyHP(hp: number, animate = true): void {
    if (!this.sceneReady) return
    this.currentEnemyHP = Phaser.Math.Clamp(hp, 0, this.currentEnemyMaxHP)
    this.refreshEnemyHpBar(animate && !this.reduceMotion)
  }

  /** Update enemy block display (called by encounterBridge). */
  updateEnemyBlock(block: number, animate = true): void {
    if (!this.sceneReady) return
    this.currentEnemyBlock = block
    this.refreshEnemyBlockBar(animate && !this.reduceMotion)
  }

  /** Update enemy intent telegraph. */
  setEnemyIntent(telegraph: string, value?: number): void {
    if (!this.sceneReady) return
  }

  /** Update player HP (optionally animate the bar). */
  updatePlayerHP(hp: number, maxHP: number, animate = true): void {
    if (!this.sceneReady) return
    this.currentPlayerHP = Phaser.Math.Clamp(hp, 0, maxHP)
    this.currentPlayerMaxHP = maxHP
    this.refreshPlayerHpBar(animate && !this.reduceMotion)
  }

  /** Update player block display. */
  updatePlayerBlock(block: number, animate = true): void {
    if (!this.sceneReady) return
    this.currentPlayerBlock = block
    this.refreshPlayerBlock(animate && !this.reduceMotion)
    // Re-color HP bar based on block state
    this.refreshPlayerHpBar(animate && !this.reduceMotion)
  }

  /** Set enemy enrage visual state on enemy sprite. */
  setEnemyEnraged(enraged: boolean): void {
    if (!this.sceneReady) return
    this.enemySpriteSystem.setEnraged(enraged)
  }

  /** Show or hide charge attack telegraph on enemy. */
  setChargeTelegraph(charging: boolean): void {
    if (!this.sceneReady || charging === this.isCharging) return
    this.isCharging = charging

    if (charging && !this.reduceMotion) {
      const enemyX = this.getEnemyX()
      const enemyY = this.currentEnemyY

      // Growing energy glow circle behind enemy
      this.chargeGlowCircle = this.add.circle(enemyX, enemyY, 20, 0xff8800, 0.15)
        .setDepth(4)

      this.chargeGlowTween = this.tweens.add({
        targets: this.chargeGlowCircle,
        radius: 80,
        alpha: 0.35,
        duration: 1500,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          if (this.chargeGlowCircle) {
            // Redraw circle at new radius by scaling
            const progress = this.chargeGlowTween?.progress ?? 0
            const scale = 1 + progress * 3
            this.chargeGlowCircle.setScale(scale)
          }
        },
      })

      // Ensure charge particle texture
      if (!this.textures.exists('charge_particle')) {
        const gfx = this.make.graphics({ x: 0, y: 0 })
        gfx.fillStyle(0xffffff)
        gfx.fillRect(0, 0, 3, 3)
        gfx.generateTexture('charge_particle', 3, 3)
        gfx.destroy()
      }

      // Particle accumulation around enemy
      this.chargeParticleTimer = this.time.addEvent({
        delay: 200,
        loop: true,
        callback: () => {
          if (!this.isCharging) return
          const angle = Math.random() * Math.PI * 2
          const dist = 60 + Math.random() * 40
          const px = enemyX + Math.cos(angle) * dist
          const py = enemyY + Math.sin(angle) * dist

          const emitter = this.add.particles(px, py, 'charge_particle', {
            speed: { min: 30, max: 60 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: [0xff8800, 0xffaa00, 0xff6600],
            lifespan: 600,
            emitting: false,
          })
          emitter.setDepth(998)
          emitter.explode(Math.max(1, Math.round(3 * this.effectScale)), 0, 0)
          this.time.delayedCall(700, () => emitter.destroy())
        },
      })

      // Slight camera pull-back
      const cam = this.cameras.main
      this.tweens.add({
        targets: cam,
        zoom: cam.zoom * 0.97,
        duration: 1200,
        ease: 'Sine.easeOut',
      })
    } else {
      // Clear charge telegraph
      if (this.chargeGlowTween) {
        this.chargeGlowTween.destroy()
        this.chargeGlowTween = null
      }
      if (this.chargeGlowCircle) {
        this.chargeGlowCircle.destroy()
        this.chargeGlowCircle = null
      }
      if (this.chargeParticleTimer) {
        this.chargeParticleTimer.destroy()
        this.chargeParticleTimer = null
      }

      // Restore camera zoom
      const cam = this.cameras.main
      this.tweens.add({
        targets: cam,
        zoom: 1,
        duration: 200,
        ease: 'Sine.easeOut',
      })
    }
  }

  /** Set floor and encounter counters. */
  setFloorInfo(floor: number, encounter: number, totalEncounters: number): void {
    if (!this.sceneReady) return
    this.currentFloor = floor
    this.currentEncounter = encounter
    this.totalEncounters = totalEncounters
  }

  /** Set passive relics to display in the relic tray. */
  setRelics(relics: Array<{ domain: string; label: string }>): void {
    if (!this.sceneReady) return
    this.relicContainer.removeAll(true)
    // Relics are displayed by the DOM InRunTopBar — no Phaser rendering needed
  }

  /**
   * Returns the appropriate background texture key for the current layout mode.
   * In landscape mode, checks for a `_landscape`-suffixed variant first.
   * Falls back to the portrait key if no landscape variant is loaded.
   *
   * @param bgKey The base background texture key (portrait variant)
   * @returns The landscape key if available in landscape mode, otherwise the base key
   */
  private getBackgroundKey(bgKey: string): string {
    if (this.currentLayoutMode === 'landscape') {
      const landscapeKey = `${bgKey}_landscape`
      if (this.textures.exists(landscapeKey)) return landscapeKey
    }
    return bgKey
  }

  /**
   * Dynamically load and display a combat background.
   * When `enemyId` is provided, attempts to load the per-enemy background
   * (`/assets/backgrounds/combat/enemies/{enemyId}/{orientation}.webp`).
   * Falls back to the legacy segment-based pool if the enemy-specific texture
   * fails to load (404 or missing file).
   *
   * @param floor The current floor number
   * @param isBoss Whether this is a boss encounter
   * @param enemyId Optional enemy template ID for per-enemy background art
   */
  setBackground(floor: number, isBoss: boolean, enemyId?: string): Promise<void> {
    if (!this.sceneReady) return Promise.resolve()

    if (enemyId) {
      // Per-enemy background — orientation already baked into the path returned by
      // getCombatBgForEnemy, so skip the _landscape variant gymnastics entirely.
      const bgPath = getCombatBgForEnemy(enemyId)
      const cleanPath = bgPath.startsWith('/') ? bgPath.slice(1) : bgPath
      // Include enemy ID in the key so textures from different enemies never collide.
      const orientation = cleanPath.includes('/portrait.') ? 'portrait' : 'landscape'
      const bgKey = `bg-enemy-${enemyId}-${orientation}`

      if (bgKey === this.currentBgKey) return Promise.resolve()
      if (hasTexture(this, bgKey)) {
        this._swapBackground(bgKey)
        return Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        this.load.image(bgKey, cleanPath)
        this.depthLightingSystem.queueDepthMapLoad(enemyId, bgKey)
        this.load.once('complete', () => {
          if (hasTexture(this, bgKey)) {
            this._swapBackground(bgKey)
            resolve()
          } else {
            // Enemy-specific asset not found — fall back to legacy segment pool
            this._loadLegacyBackground(floor, isBoss).then(resolve)
          }
        })
        this.load.start()
      })
    } else {
      // No enemy ID — use the legacy segment-based background pool
      return this._loadLegacyBackground(floor, isBoss)
    }
  }

  /** Load a background from the legacy segment pools (non-enemy-specific). */
  private _loadLegacyBackground(floor: number, isBoss: boolean): Promise<void> {
    const bgPath = getRandomCombatBg(floor, isBoss)
    const cleanPath = bgPath.startsWith('/') ? bgPath.slice(1) : bgPath
    const bgKey = `bg-combat-${cleanPath.split('/').pop()?.replace('.webp', '') ?? 'default'}`

    // In landscape mode, attempt to load the _landscape variant alongside the portrait.
    // getBackgroundKey() will select whichever is available at swap time.
    const landscapeKey = `${bgKey}_landscape`
    const landscapePath = cleanPath.replace('.webp', '_landscape.webp')

    const resolvedKey = this.getBackgroundKey(bgKey)
    if (resolvedKey === this.currentBgKey) return Promise.resolve()

    if (hasTexture(this, resolvedKey)) {
      this._swapBackground(resolvedKey)
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      this.load.image(bgKey, cleanPath)
      if (this.currentLayoutMode === 'landscape') {
        this.load.image(landscapeKey, landscapePath)
      }
      this.load.once('complete', () => {
        this._swapBackground(this.getBackgroundKey(bgKey))
        resolve()
      })
      this.load.start()
    })
  }

  private _swapBackground(bgKey: string): void {
    this.currentBgKey = bgKey
    const w = this.scale.width
    const h = this.scale.height

    // Cover-scale: image fills entire viewport without gaps (may crop edges).
    // Scale up by 1% extra to guarantee full coverage — prevents sub-pixel
    // gaps from PostFX FBO rounding, breathing displacement, or resize timing.
    const tex = this.textures.get(bgKey).getSourceImage()
    const imgW = (tex as HTMLImageElement).naturalWidth || (tex as HTMLCanvasElement).width || w
    const imgH = (tex as HTMLImageElement).naturalHeight || (tex as HTMLCanvasElement).height || h
    const scale = Math.max(w / imgW, h / imgH) * 1.01
    const dispW = imgW * scale
    const dispH = imgH * scale

    if (this.combatBackground instanceof Phaser.GameObjects.Image) {
      this.combatBackground.setTexture(bgKey)
      // Always reset position and size to ensure the image fills the full canvas height
      this.combatBackground.setPosition(w / 2, h / 2)
      this.combatBackground.setDisplaySize(dispW, dispH)
    } else {
      // Replace rectangle fallback with proper image
      this.combatBackground.destroy()
      this.combatBackground = this.add.image(w / 2, h / 2, bgKey)
        .setDisplaySize(dispW, dispH)
        .setDepth(0)
    }

    // Attach depth-based lighting shader to the background
    if (this.combatBackground instanceof Phaser.GameObjects.Image) {
      this.depthLightingSystem.attachToBackground(this.combatBackground)
    }
  }

  /**
   * Apply camera color grading (saturation + brightness) based on atmosphere config.
   * @param config The atmosphere config for the current room
   */
  private applyColorGrading(config: AtmosphereConfig): void {
    if (getDeviceTier() === 'low-end') return

    // Remove previous color matrix
    if (this._colorMatrixFx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.cameras.main.postFX.remove(this._colorMatrixFx as any)
      this._colorMatrixFx = null
    }

    const fx = this.cameras.main.postFX.addColorMatrix()
    fx.saturate(config.cameraColorMatrix.saturation)
    fx.brightness(config.cameraColorMatrix.brightness)
    if (config.cameraColorMatrix.hueRotate) {
      fx.hue(config.cameraColorMatrix.hueRotate)
    }
    this._colorMatrixFx = fx
  }

  /** Play enemy hit reaction (flash white, slight knockback). */
  playEnemyHitReaction(): void {
    this.enemySpriteSystem.playHit()
  }

  /** Alias used by newer encounter bridge hooks. */
  playEnemyHitAnimation(): void {
    this.playEnemyHitReaction()
  }

  /** Play enemy attack animation (lunge toward player). */
  playEnemyAttackAnimation(): void {
    this.enemySpriteSystem.playAttack()
  }

  /** Play enemy death animation (fade out + scale down). Returns promise resolving on completion. */
  playEnemyDeathAnimation(): Promise<void> {
    return this.enemySpriteSystem.playDeath()
  }

  /** Play kill confirmation punch — hard impact at the moment of the killing blow. */
  playKillConfirmation(): Promise<void> {
    if (this.reduceMotion || isTurboMode()) return Promise.resolve()

    return new Promise<void>((resolve) => {
      // Hard white flash (highest intensity)
      this.pulseFlash(0xFFFFFF, 0.55, 100)

      // Strong camera shake
      this.screenShake.trigger('heavy')

      // Brief camera zoom punch
      const cam = this.cameras.main
      const baseZoom = cam.zoom
      this.tweens.add({
        targets: cam,
        zoom: baseZoom * 1.05,
        duration: 60,
        yoyo: true,
        ease: 'Sine.easeOut',
      })

      // Gold edge glow
      this.pulseEdgeGlow(0xFFD700, 0.4, 250)

      // Resolve after the punch settles (80ms)
      this.time.delayedCall(80, resolve)
    })
  }

  /** Play player damage flash (red tint across display zone). */
  playPlayerDamageFlash(): void {
    if (this.reduceMotion) return
    this.pulseFlash(COLOR_HP_RED, 0.15, 110)
    this.pulseEdgeGlow(COLOR_HP_RED, 0.35, 300)
    this.screenShake.trigger('medium')
  }

  /** Play heal effect (green particles rising near player HP bar). */
  playHealEffect(): void {
    if (this.reduceMotion) return
    const w = this.scale.width
    const h = this.scale.height
    let barX: number
    let barTop: number
    let barBottom: number
    if (this.currentLayoutMode === 'landscape') {
      barX = w * LANDSCAPE.PLAYER_HP_BAR_X_PCT
      barTop = h * LANDSCAPE.PLAYER_HP_BAR_TOP
      barBottom = h * LANDSCAPE.PLAYER_HP_BAR_BOTTOM
    } else {
      barX = w - Math.round(PLAYER_HP_BAR_X_OFFSET * this.scaleFactor)
      barTop = h * PLAYER_HP_BAR_TOP_PCT
      barBottom = h * PLAYER_HP_BAR_BOTTOM_PCT
    }
    const barMidY = (barTop + barBottom) / 2
    this.burstParticles(12, barX, barMidY, COLOR_HP_BLUE)
    this.pulseEdgeGlow(COLOR_HP_BLUE, 0.25, 270)
  }

  /** Flash the display zone white. */
  playScreenFlash(intensity: number = 0.3): void {
    if (this.reduceMotion) return
    this.pulseFlash(0xFFFFFF, intensity, 150)
  }

  /** Play speed bonus pop effect — blue-white flash + camera zoom punch + "FAST!" text. */
  playSpeedBonusPop(): void {
    if (this.reduceMotion) return

    // Blue-white flash (distinct from normal white flash)
    this.pulseFlash(0xAADDFF, 0.5, 120)

    // Brief camera zoom punch (freeze-frame feel without pausing game time)
    const cam = this.cameras.main
    const baseZoom = cam.zoom
    this.tweens.add({
      targets: cam,
      zoom: baseZoom * 1.03,
      duration: 50,
      yoyo: true,
      ease: 'Sine.easeOut',
    })

    // "FAST!" text pop
    const fastText = this.add.text(
      this.scale.width / 2,
      this.displayH * 0.35,
      'FAST!',
      {
        fontFamily: GAME_FONT,
        fontSize: '28px',
        color: '#AADDFF',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
      }
    ).setOrigin(0.5, 0.5).setDepth(997).setAlpha(0)

    // Slam in (fast scale up), hold briefly, fade out with upward motion
    this.tweens.add({
      targets: fastText,
      alpha: 1,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 80,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: fastText,
          alpha: 0,
          scaleX: 1,
          scaleY: 1,
          y: fastText.y - 30,
          duration: 400,
          ease: 'Sine.easeIn',
          delay: 150,
          onComplete: () => fastText.destroy(),
        })
      },
    })
  }

  /** Burst particles at a position. */
  burstParticles(count: number, x: number, y: number, tint: number = 0xFFD700): void {
    if (!this.particles || this.reduceMotion) return
    const scaledCount = Math.max(1, Math.round(count * this.effectScale))
    this.particles.setParticleTint(tint)
    this.particles.explode(scaledCount, x, y)
  }

  /** Play a gold-tinted screen flash for perfect turn celebration. */
  playGoldFlash(): void {
    this.pulseFlash(0xFFD700, 0.2, 200)
    this.pulseEdgeGlow(0xFFD700, 0.3, 300)
  }

  /**
   * Visual beat at end of player turn — transient vignette darken + enemy sprite pulse + particle spike.
   * Fires during the existing 1s delay in encounterBridge.handleEndTurn(); adds no wall-clock time.
   * No-op when reduceMotion or isTurboMode() are active.
   */
  playTurnTransitionToEnemy(): void {
    if (this.reduceMotion || isTurboMode()) return

    // Transient darkening overlay at depth 2 (above vignetteGfx at depth 1, below enemy at depth 5).
    // Do NOT mutate vignetteGfx — it is redrawn on resize and must stay at alpha 1.
    const w = this.scale.width
    const h = this.scale.height
    this._turnOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0).setDepth(2)
    this.tweens.add({
      targets: this._turnOverlay,
      alpha: 0.12,
      duration: 250,
      ease: 'Sine.easeIn',
    })

    // Enemy awakening pulse — subtle scale bump signals impending attack
    const container = this.enemySpriteSystem.getContainer()
    this.tweens.add({
      targets: container,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 200,
      yoyo: true,
      ease: 'Sine.easeInOut',
    })

    // Particle spike — briefly double front emitter rate for atmosphere tension
    this.atmosphereSystem.spikeParticleRate(400)
  }

  /**
   * Visual beat at start of player turn — release the vignette overlay and emit a warm flash.
   * Also dispatches the rr:player-turn-start DOM event so CardHand.svelte can animate cards in.
   * Always releases the overlay even when reduceMotion/turboMode are active.
   */
  playTurnTransitionToPlayer(): void {
    // Always clean up the overlay regardless of reduceMotion — it may have been created before
    // the player toggled reduce-motion, and leaving it on screen would be a visual bug.
    if (this._turnOverlay) {
      this.tweens.add({
        targets: this._turnOverlay,
        alpha: 0,
        duration: 200,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this._turnOverlay?.destroy()
          this._turnOverlay = null
        },
      })
    }

    // DOM event for card hand CSS animation (listened to by CardHand.svelte)
    if (!this.reduceMotion && !isTurboMode()) {
      window.dispatchEvent(new CustomEvent('rr:player-turn-start'))
    }

    if (this.reduceMotion || isTurboMode()) return

    // Warm flash — signals return of player agency
    this.pulseFlash(0xFFEEAA, 0.06, 200)
  }

  /**
   * Play sword slash attack animation.
   * @param onImpact Optional callback fired at the sword contact frame (T+250ms).
   *   Used by encounterBridge to defer enemy hit reaction until the visual apex,
   *   so the enemy recoils exactly when the blade reaches its furthest point.
   */
  playPlayerAttackAnimation(onImpact?: () => void): void {
    if (this.reduceMotion) return
    const enemyX = this.getEnemyX()
    const enemyY = this.currentEnemyY
    // Sword slash aimed at the enemy — enemy hit reaction deferred to onImpact
    // at T+250ms (contact frame) rather than firing at T+0.
    // The old 110ms bob tween is removed — EnemySpriteSystem.playHit() handles
    // knockback with richer elastic spring-back when onImpact fires.
    this.weaponAnimations.playSwordSlash(enemyX, enemyY, () => {
      onImpact?.()
      // Impact sparks at enemy position on contact frame (warm yellow for sword)
      this.burstParticles(5, enemyX, enemyY, 0xFFFF88)
    })
  }

  /**
   * Play tome cast animation.
   * @param cardType Card type string used to determine glow color
   * @param onImpact Optional callback fired at the glow burst peak (T+330ms).
   *   Used by encounterBridge to defer enemy hit reaction until the visual impact
   *   frame rather than firing at T+0.
   */
  playPlayerCastAnimation(cardType?: string, onImpact?: () => void): void {
    if (this.reduceMotion) return
    // Determine glow color from card type
    let glowColor = 0x3498db // default blue
    if (cardType === 'buff') glowColor = 0xf39c12
    else if (cardType === 'debuff') glowColor = 0x9b59b6
    else if (cardType === 'utility') glowColor = 0x2ecc71
    const enemyX = this.getEnemyX()
    const enemyY = this.currentEnemyY
    // Screen flash and particles
    this.playScreenFlash(0.12)
    this.pulseEdgeGlow(glowColor, 0.25, 270)
    this.burstParticles(14, this.scale.width / 2, this.displayH * 0.44, glowColor)
    // Tome animation — enemy hit reaction deferred to onImpact at glow burst peak (T+330ms)
    this.weaponAnimations.playTomeCast(glowColor, () => {
      onImpact?.()
      // Impact sparks at enemy position on contact frame (chain-colored for tome)
      this.burstParticles(5, enemyX, enemyY, glowColor)
    })
  }

  playPlayerBlockAnimation(): void {
    if (this.reduceMotion) return
    this.playScreenFlash(0.1)
    this.pulseEdgeGlow(0x3498db, 0.3, 270)
    this.burstParticles(10, this.scale.width / 2, this.displayH * 0.47, 0x8fbfff)
    // Shield raise from bottom-left
    this.weaponAnimations.playShieldRaise()
  }

  /** Play blue flash when player block absorbs all incoming damage. */
  playBlockAbsorbFlash(): void {
    if (this.reduceMotion) return
    this.pulseEdgeGlow(0x3498db, 0.25, 330)
    this.screenShake.trigger('micro')
  }

  /** Play a blue edge flash signalling a block event (block gained or absorb). */
  playBlockFlash(): void {
    if (this.reduceMotion) return
    this.pulseEdgeGlow(0x3498db, 0.25, 250)
  }

  playPlayerVictoryAnimation(): void {
    if (this.reduceMotion) return
    const container = this.enemySpriteSystem.getContainer()
    this.tweens.add({
      targets: container,
      alpha: 0.2,
      duration: 140,
      yoyo: true,
    })
  }

  playPlayerDefeatAnimation(): void {
    if (this.reduceMotion) return
    this.playPlayerDamageFlash()
    this.pulseEdgeGlow(COLOR_HP_RED, 0.5, 450)
    this.screenShake.trigger('heavy')
  }

  /** Play enemy defend animation — shimmering blue shield effect. */
  playEnemyDefendAnimation(): void {
    if (this.reduceMotion) return
    const enemyX = this.getEnemyX()
    const enemyY = this.currentEnemyY
    const size = this.currentLayoutMode === 'landscape'
      ? enemyDisplaySize(this.currentEnemyCategory, 'landscape')
      : Math.round(enemyDisplaySize(this.currentEnemyCategory) * this.scaleFactor)
    const shieldRect = this.add.rectangle(enemyX, enemyY, size, size, 0x3498db, 0).setDepth(3)
    this.tweens.add({
      targets: shieldRect,
      alpha: 0.4,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 200,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => { shieldRect.destroy() },
    })
    this.burstParticles(16, enemyX, enemyY, 0x3498db)
    this.pulseEdgeGlow(0x3498db, 0.2, 375)
  }

  /** Play enemy heal animation — green healing energy rising upward. */
  playEnemyHealAnimation(): void {
    if (this.reduceMotion) return
    const enemyX = this.getEnemyX()
    const enemyY = this.currentEnemyY
    const sprite = this.enemySpriteSystem.getContainer()
    const origTintTop = sprite.list.length > 0
      ? (sprite.list[0] as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle)
      : null
    if (origTintTop && 'setTint' in origTintTop) {
      (origTintTop as Phaser.GameObjects.Image).setTint(0x44ff88)
      this.time.delayedCall(200, () => {
        if (origTintTop && 'clearTint' in origTintTop) {
          (origTintTop as Phaser.GameObjects.Image).clearTint()
        }
      })
    }
    this.tweens.add({
      targets: sprite,
      scaleX: sprite.scaleX * 1.05,
      scaleY: sprite.scaleY * 1.05,
      duration: 200,
      yoyo: true,
      ease: 'Sine.easeOut',
    })
    if (this.particles) {
      this.particles.setParticleTint(0x2ecc71)
      this.particles.setParticleGravity(0, -80)
      this.particles.explode(Math.max(1, Math.round(20 * this.effectScale)), enemyX, enemyY)
      this.time.delayedCall(350, () => {
        if (this.particles) this.particles.setParticleGravity(0, 50)
      })
    }
    this.pulseEdgeGlow(0x2ecc71, 0.2, 375)
    this.pulseFlash(0x2ecc71, 0.08, 150)
  }

  /** Play enemy buff animation — golden power surge. */
  playEnemyBuffAnimation(): void {
    if (this.reduceMotion) return
    const enemyX = this.getEnemyX()
    const enemyY = this.currentEnemyY
    const sprite = this.enemySpriteSystem.getContainer()
    this.tweens.add({
      targets: sprite,
      scaleX: sprite.scaleX * 1.1,
      scaleY: sprite.scaleY * 1.1,
      duration: 250,
      yoyo: true,
      ease: 'Power2',
    })
    const firstChild = sprite.list[0] as Phaser.GameObjects.Image | undefined
    if (firstChild && 'setTint' in firstChild) {
      firstChild.setTint(0xffd700)
      this.time.delayedCall(250, () => {
        if (firstChild && 'clearTint' in firstChild) firstChild.clearTint()
      })
    }
    this.burstParticles(18, enemyX, enemyY, 0xFFD700)
    this.pulseEdgeGlow(0xFFD700, 0.25, 300)
    this.screenShake.trigger('micro')
  }

  /** Play enemy debuff animation — sinister purple energy targeting the player. */
  playEnemyDebuffAnimation(): void {
    if (this.reduceMotion) return
    const sprite = this.enemySpriteSystem.getContainer()
    const startY = sprite.y
    this.tweens.add({
      targets: sprite,
      y: startY + 12,
      duration: 150,
      yoyo: true,
      ease: 'Power2',
    })
    this.pulseFlash(0x9b59b6, 0.12, 180)
    this.burstParticles(14, this.scale.width / 2, this.displayH * 0.85, 0x9b59b6)
    this.pulseEdgeGlow(0x9b59b6, 0.3, 330)
    this.screenShake.trigger('micro')
  }

  /** Play enemy multi-attack animation — three rapid lunges. */
  playEnemyMultiAttackAnimation(): void {
    if (this.reduceMotion) return
    const startY = this.currentEnemyY
    const sprite = this.enemySpriteSystem.getContainer()
    const startScale = sprite.scaleX
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 120, () => {
        this.tweens.add({
          targets: sprite,
          y: startY + 14,
          scaleX: startScale * 1.08,
          scaleY: startScale * 1.08,
          duration: 60,
          yoyo: true,
          ease: 'Power2',
        })
        this.screenShake.trigger('micro')
      })
    }
    this.pulseEdgeGlow(0xe74c3c, 0.4, 450)
    this.time.delayedCall(360, () => {
      this.screenShake.trigger('medium')
    })
  }

  /**
   * Show damage preview on enemy HP bar (ghost bar showing predicted damage).
   * Call when a card is selected to show how much damage it would deal.
   */
  showDamagePreview(predictedDamage: number): void {
    if (!this.sceneReady || this.reduceMotion) return

    const ratio = this.currentEnemyMaxHP > 0
      ? this.currentEnemyHP / this.currentEnemyMaxHP
      : 0
    const damageRatio = this.currentEnemyMaxHP > 0
      ? predictedDamage / this.currentEnemyMaxHP
      : 0

    const scaledW = Math.round(ENEMY_HP_BAR_W * this.scaleFactor)
    const scaledH = Math.round(ENEMY_HP_BAR_H * this.scaleFactor)
    const currentW = Math.max(1, ratio * scaledW)
    const damageW = Math.min(currentW, damageRatio * scaledW)
    const w = this.scale.width
    const h = this.scale.height
    const hpBarCenterX = this.currentLayoutMode === 'landscape'
      ? w * LANDSCAPE.ENEMY_X_PCT
      : w / 2
    const enemyHpY = this.currentLayoutMode === 'landscape'
      ? h * LANDSCAPE.ENEMY_HP_Y_PCT
      : this.displayH * ENEMY_HP_Y_PCT
    const startX = hpBarCenterX - scaledW / 2 + currentW - damageW

    this.damagePreviewGfx.clear()
    this.damagePreviewGfx.fillStyle(0xaa3333, 0.3)
    this.damagePreviewGfx.fillRoundedRect(
      startX, enemyHpY - scaledH / 2,
      damageW, scaledH, 6
    )
    this.damagePreviewGfx.setData('drawnBounds', { x: startX, y: enemyHpY - scaledH / 2, w: damageW, h: scaledH })
  }

  /** Hide damage preview on enemy HP bar. */
  hideDamagePreview(): void {
    if (!this.sceneReady) return
    this.damagePreviewGfx.clear()
    this.damagePreviewGfx.setData('drawnBounds', null)
  }

  /**
   * Play overkill HP bar shatter effect if damage greatly exceeded remaining HP.
   * Called when enemy dies with significant overkill (>50% of remaining HP as damage).
   */
  playOverkillShatter(overkillDamage: number, attackColor?: number): void {
    if (this.reduceMotion) return
    if (overkillDamage <= 0) return

    const w = this.scale.width
    const h = this.scale.height
    const hpBarCenterX = this.currentLayoutMode === 'landscape'
      ? w * LANDSCAPE.ENEMY_X_PCT
      : w / 2
    const enemyHpY = this.currentLayoutMode === 'landscape'
      ? h * LANDSCAPE.ENEMY_HP_Y_PCT
      : this.displayH * ENEMY_HP_Y_PCT
    const scaledW = Math.round(ENEMY_HP_BAR_W * this.scaleFactor)
    const scaledH = Math.round(ENEMY_HP_BAR_H * this.scaleFactor)
    const barLeft = hpBarCenterX - scaledW / 2
    const color = attackColor ?? 0xe74c3c

    // Create 6 fragments
    const fragmentCount = 6
    for (let i = 0; i < fragmentCount; i++) {
      const fragW = scaledW / fragmentCount + Math.random() * 4
      const fragH = scaledH + Math.random() * 4
      const fragX = barLeft + (scaledW / fragmentCount) * i
      const fragY = enemyHpY

      const frag = this.add.rectangle(fragX, fragY, fragW, fragH, color, 0.8)
        .setDepth(13)

      const velX = (Math.random() - 0.5) * 200
      const velY = (Math.random() - 0.7) * 150

      this.tweens.add({
        targets: frag,
        x: frag.x + velX * 0.4,
        y: frag.y + velY * 0.4 + 30,
        angle: (Math.random() - 0.5) * 180,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 400,
        ease: 'Power2',
        onComplete: () => frag.destroy(),
      })
    }

    // Hide the actual HP bar
    this.enemyHpBarFill.clear()
    this.enemyHpBarBg.setAlpha(0.3)
  }

  // ═════════════════════════════════════════════════════════
  // Public near-death overlay
  // ═════════════════════════════════════════════════════════

  /** Toggle near-death red vignette overlay on the Phaser canvas. */
  setNearDeath(active: boolean): void {
    if (!this.vignetteGfx) return
    if (active) {
      this.vignetteGfx.clear()
      const w = this.scale.width
      const h = this.scale.height
      // Draw a radial vignette: red semi-transparent edges
      this.vignetteGfx.fillStyle(0xaa0000, 0.0)
      this.vignetteGfx.fillRect(0, 0, w, h)
      // Edge strips for vignette effect
      this.vignetteGfx.fillStyle(0x880000, 0.15)
      this.vignetteGfx.fillRect(0, 0, w, 30)      // top
      this.vignetteGfx.fillRect(0, h - 30, w, 30)  // bottom
      this.vignetteGfx.fillRect(0, 0, 30, h)       // left
      this.vignetteGfx.fillRect(w - 30, 0, 30, h)  // right
      this.vignetteGfx.setVisible(true)
      this.vignetteGfx.setDepth(999)
      this.vignetteGfx.setAlpha(1)
    } else {
      this.vignetteGfx.setVisible(false)
    }
  }


  // ═════════════════════════════════════════════════════════
  // Chain combo visual escalation (Spec 03)
  // ═════════════════════════════════════════════════════════

  /**
   * Called whenever the active chain count changes (after each card play).
   * Coordinates particles, point lights, vignette pulse, tint overlay, and
   * depth breathing based on chain threshold modifiers.
   *
   * Pass chainCount=0 or call {@link onChainBroken} to clear all effects.
   *
   * @param chainCount Current chain length from TurnState.chainLength
   * @param chainType  Current chain type index, or undefined if no chain active
   */
  public onChainUpdated(chainCount: number, chainType: number | undefined): void {
    // Headless sim: skip all chain visuals to prevent side effects
    if (isTurboMode()) return

    this.currentChainCount = chainCount
    const modifiers = getChainAtmosphereModifiers(chainCount, chainType)

    // ── Reduce-motion fast path: light changes only, skip all tweens/particles ──
    if (this.reduceMotion) {
      if (modifiers && chainType !== undefined) {
        const chainHex = parseInt(getChainColor(chainType).slice(1), 16)
        this.depthLightingSystem.setChainLightOverride(
          chainHex, modifiers.lightIntensityMultiplier, modifiers.lightColorBlend, 1.0,
        )
      } else {
        this.depthLightingSystem.clearChainLightOverride(0)
      }
      return
    }

    // ── Particles ──────────────────────────────────────────────────────────────
    if (modifiers) {
      this.atmosphereSystem.applyChainModifiers(modifiers.particleFrequencyMultiplier)
    } else {
      this.atmosphereSystem.clearChainModifiers()
    }

    // ── Point lights ────────────────────────────────────────────────────────────
    if (modifiers && chainType !== undefined) {
      const chainHex = parseInt(getChainColor(chainType).slice(1), 16)
      // Chain 7+: faster flicker emphasises urgency
      const flickerMult = chainCount >= 7 ? 2.0 : 1.0
      this.depthLightingSystem.setChainLightOverride(
        chainHex,
        modifiers.lightIntensityMultiplier,
        modifiers.lightColorBlend,
        flickerMult,
      )
      this.depthLightingSystem.setChainBreathing(modifiers.depthPulse)
    } else {
      this.depthLightingSystem.clearChainLightOverride(500)
      this.depthLightingSystem.setChainBreathing(false)
    }

    // ── Vignette pulse ──────────────────────────────────────────────────────────
    if (modifiers && modifiers.vignettePulseAmplitude > 0) {
      if (!this.chainVignetteOverlay) {
        const w = this.scale.width
        const h = this.scale.height
        this.chainVignetteOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0).setDepth(2)
      }
      if (this.chainVignetteTween) { this.chainVignetteTween.destroy() }
      this.chainVignetteTween = this.tweens.add({
        targets: this.chainVignetteOverlay,
        alpha: { from: 0, to: modifiers.vignettePulseAmplitude },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else {
      this.chainVignetteTween?.destroy()
      this.chainVignetteTween = null
      if (this.chainVignetteOverlay) {
        this.tweens.add({
          targets: this.chainVignetteOverlay,
          alpha: 0,
          duration: 300,
          onComplete: () => { this.chainVignetteOverlay?.destroy(); this.chainVignetteOverlay = null },
        })
      }
    }

    // ── Tint overlay ─────────────────────────────────────────────────────────
    if (modifiers && modifiers.tintOverlayAlpha > 0 && chainType !== undefined) {
      const chainHex = parseInt(getChainColor(chainType).slice(1), 16)
      if (!this.chainTintOverlay) {
        const w = this.scale.width
        const h = this.scale.height
        this.chainTintOverlay = this.add
          .rectangle(w / 2, h / 2, w, h, chainHex, 0)
          .setDepth(2)
          .setBlendMode(Phaser.BlendModes.ADD)
      } else {
        this.chainTintOverlay.setFillStyle(chainHex, 0)
      }
      this.tweens.add({
        targets: this.chainTintOverlay,
        alpha: modifiers.tintOverlayAlpha,
        duration: 300,
      })
    } else if (this.chainTintOverlay) {
      this.tweens.add({
        targets: this.chainTintOverlay,
        alpha: 0,
        duration: 300,
        onComplete: () => { this.chainTintOverlay?.destroy(); this.chainTintOverlay = null },
      })
    }
  }

  /**
   * Called when the player's chain breaks or is resolved.
   * Resets all chain visual effects over 500ms.
   */
  public onChainBroken(): void {
    this.onChainUpdated(0, undefined)
  }

  // ═════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════

  /** Activate or deactivate near-death tension overlay. */
  private setNearDeathTension(active: boolean): void {
    if (active === this.isNearDeathActive) return
    this.isNearDeathActive = active

    if (active && !this.reduceMotion) {
      // Fade in the red vignette
      this.tweens.add({
        targets: this.nearDeathVignette,
        alpha: 1,
        duration: 500,
        ease: 'Sine.easeIn',
      })
      // Start pulsing heartbeat glow at edges with smooth gradient updates
      const pulseProxy = { t: 0.08 }
      this.nearDeathPulseTween = this.tweens.add({
        targets: pulseProxy,
        t: 0.25,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.drawEdgeGlowGradients(0xff0000, pulseProxy.t)
        },
      })
    } else {
      // Fade out
      this.tweens.add({
        targets: this.nearDeathVignette,
        alpha: 0,
        duration: 300,
        ease: 'Sine.easeOut',
      })
      if (this.nearDeathPulseTween) {
        this.nearDeathPulseTween.destroy()
        this.nearDeathPulseTween = null
        this.drawEdgeGlowGradients(0xff0000, 0)
      }
    }
  }

  private playEncounterEntry(): void {
    this.entryFadeRect.setAlpha(1)

    const isBoss = this.currentEnemyCategory === 'boss'
    const fadeDuration = isBoss ? 560 : 380

    // Signal Svelte overlay to start HUD pop-in sequence
    window.dispatchEvent(new Event('rr:combat-entry'))

    // Delay enemy sprite entry so it appears AFTER HUD elements pop in.
    // playEntranceReveal replaces the legacy playEntry pop-in with a cinematic
    // shadow-to-light reveal (800ms commons, 1200ms bosses). The boss camera
    // zoom and heavy shake are handled inside playEntranceReveal itself.
    this.time.delayedCall(1800, () => {
      this.enemySpriteSystem.playEntranceReveal(isBoss)
      this.depthLightingSystem.animateLightsIn(isBoss ? 1200 : 800)
    })

    this.tweens.add({
      targets: this.entryFadeRect,
      alpha: 0,
      duration: fadeDuration,
      ease: 'Sine.easeOut',
    })
  }

  /** Build floor counter label. */
  private floorLabel(): string {
    return `Floor ${this.currentFloor} \u2014 Encounter ${this.currentEncounter}/${this.totalEncounters}`
  }

  private pulseFlash(color: number, peakAlpha: number, durationMs: number): void {
    if (this.flashTween) {
      this.flashTween.stop()
      this.flashTween = null
    }
    this.flashRect.setFillStyle(color, peakAlpha)
    this.flashRect.setAlpha(0)
    this.flashTween = this.tweens.add({
      targets: this.flashRect,
      alpha: peakAlpha,
      duration: Math.max(40, Math.round(durationMs * 0.4)),
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.flashRect.setAlpha(0)
        this.flashRect.setFillStyle(0xFFFFFF, 0)
        this.flashTween = null
      },
    })
  }

  /** Redraw edge glow graphics with gradient fill for the given color and alpha intensity. */
  private drawEdgeGlowGradients(color: number, baseAlpha: number = 1): void {
    const w = this.scale.width
    const h = this.displayH
    const t = this.edgeGlowThickness

    // Top edge: gradient fades from top (opaque) to bottom (transparent)
    this.edgeGlowTop.clear()
    this.edgeGlowTop.fillGradientStyle(color, color, color, color, baseAlpha, baseAlpha, 0, 0)
    this.edgeGlowTop.fillRect(0, 0, w, t)

    // Left edge: gradient fades from left (opaque) to right (transparent)
    this.edgeGlowLeft.clear()
    this.edgeGlowLeft.fillGradientStyle(color, color, color, color, baseAlpha, 0, baseAlpha, 0)
    this.edgeGlowLeft.fillRect(0, 0, t, h)

    // Right edge: gradient fades from right (opaque) to left (transparent)
    this.edgeGlowRight.clear()
    this.edgeGlowRight.fillGradientStyle(color, color, color, color, 0, baseAlpha, 0, baseAlpha)
    this.edgeGlowRight.fillRect(w - t, 0, t, h)
  }

  /** Flash colored glow at screen edges for combat feedback. */
  private pulseEdgeGlow(color: number, peakAlpha: number, durationMs: number): void {
    if (this.reduceMotion) return
    if (this.edgeGlowTween) {
      this.edgeGlowTween.stop()
      this.edgeGlowTween = null
    }
    const gfxArr = [this.edgeGlowTop, this.edgeGlowLeft, this.edgeGlowRight]
    this.drawEdgeGlowGradients(color)
    for (const g of gfxArr) g.setAlpha(0)

    const softPeak = peakAlpha * 0.6
    this.edgeGlowTween = this.tweens.add({
      targets: gfxArr,
      alpha: softPeak,
      duration: durationMs,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        for (const g of gfxArr) g.setAlpha(0)
        this.edgeGlowTween = null
      },
    })
  }

  /** Get the HP bar center X and Y based on current layout mode. */
  private getEnemyHpBarCenter(): { x: number; y: number } {
    const w = this.scale.width
    const h = this.scale.height
    if (this.currentLayoutMode === 'landscape') {
      const x = this.quizEnemyXOverride ?? w * LANDSCAPE.ENEMY_X_PCT
      return { x, y: h * LANDSCAPE.ENEMY_HP_Y_PCT }
    }
    return { x: w / 2, y: this.displayH * ENEMY_HP_Y_PCT }
  }

  /** Refresh enemy HP bar fill width and text. */
  private refreshEnemyHpBar(animate: boolean): void {
    const ratio = this.currentEnemyMaxHP > 0
      ? this.currentEnemyHP / this.currentEnemyMaxHP
      : 0
    // During the quiz slide tween the enemy is scaled down; shrink the HP bar to match.
    const barScale = this.quizEnemyScaleOverride ?? 1.0
    const scaledW = Math.round(ENEMY_HP_BAR_W * this.scaleFactor * barScale)
    const scaledH = Math.round(ENEMY_HP_BAR_H * this.scaleFactor * barScale)
    const targetW = Math.max(1, ratio * scaledW)
    const baseColor = this.currentEnemyCategory === 'boss' ? COLOR_BOSS
      : this.currentEnemyCategory === 'elite' || this.currentEnemyCategory === 'mini_boss' ? COLOR_ELITE
      : COLOR_HP_RED
    const color = this.currentEnemyBlock > 0 ? 0x3498db : baseColor
    const { x: hpCenterX, y: enemyHpY } = this.getEnemyHpBarCenter()
    const x = hpCenterX - scaledW / 2
    const y = enemyHpY - scaledH / 2
    const radius = 6

    // Redraw the fill bar with the new width
    this.enemyHpBarFill.clear()
    // Black border (slightly larger than the bar)
    this.enemyHpBarFill.fillStyle(0x000000, 1)
    this.enemyHpBarFill.fillRoundedRect(x - 2, y - 2, scaledW + 4, scaledH + 4, radius)
    // Main HP fill
    this.enemyHpBarFill.fillStyle(color, 1)
    this.enemyHpBarFill.fillRoundedRect(x, y, targetW, scaledH, radius)
    // Top highlight (3D bevel)
    this.enemyHpBarFill.fillStyle(0xffffff, 0.2)
    this.enemyHpBarFill.fillRect(x + 2, y + 1, Math.max(0, targetW - 4), 2)
    // Bottom shadow (3D bevel)
    this.enemyHpBarFill.fillStyle(0x000000, 0.3)
    this.enemyHpBarFill.fillRect(x + 2, y + scaledH - 3, Math.max(0, targetW - 4), 2)
    this.enemyHpBarFill.setData('drawnBounds', { x, y, w: scaledW, h: scaledH })

    const blockPrefix = this.currentEnemyBlock > 0 ? `(${this.currentEnemyBlock}) ` : ''
    this.enemyHpText.setText(`${blockPrefix}${this.currentEnemyHP} / ${this.currentEnemyMaxHP}`)
  }

  /** Refresh enemy block bar overlay and indicators. */
  private refreshEnemyBlockBar(animate: boolean): void {
    const hasBlock = this.currentEnemyBlock > 0

    // Block count is now shown inline in the HP bar text; hide the separate icon/text
    this.enemyBlockIcon.setVisible(false)
    this.enemyBlockText.setVisible(false)

    // Refresh HP text to include/remove the block prefix
    const blockPrefix = hasBlock ? `(${this.currentEnemyBlock}) ` : ''
    this.enemyHpText.setText(`${blockPrefix}${this.currentEnemyHP} / ${this.currentEnemyMaxHP}`)

    if (hasBlock) {
      const blockRatio = Math.min(1, this.currentEnemyBlock / this.currentEnemyMaxHP)
      const scaledW = Math.round(ENEMY_HP_BAR_W * this.scaleFactor)
      const scaledH = Math.round(ENEMY_HP_BAR_H * this.scaleFactor)
      const targetW = Math.max(1, blockRatio * scaledW)
      const { x: hpCenterX, y: enemyHpY } = this.getEnemyHpBarCenter()

      // Redraw the block bar
      this.enemyBlockBarFill.clear()
      this.enemyBlockBarFill.fillStyle(0x3498db, 0.6)
      this.enemyBlockBarFill.fillRoundedRect(
        hpCenterX - scaledW / 2, enemyHpY - scaledH / 2,
        targetW, scaledH, 6
      )
      this.enemyBlockBarFill.setData('drawnBounds', { x: hpCenterX - scaledW / 2, y: enemyHpY - scaledH / 2, w: targetW, h: scaledH })
    } else {
      this.enemyBlockBarFill.clear()
      this.enemyBlockBarFill.setData('drawnBounds', null)
    }
  }

  /** Refresh player HP bar fill height, color, and text. */
  private refreshPlayerHpBar(animate: boolean): void {
    const ratio = this.currentPlayerMaxHP > 0
      ? this.currentPlayerHP / this.currentPlayerMaxHP
      : 0
    const targetH = Math.max(1, ratio * this.playerBarMaxH)
    const color = playerHpColor(ratio)
    const colorCss = colorToCssHex(color)
    const w = this.scale.width
    const h = this.scale.height
    let barX: number
    let barTop: number
    let barBottom: number
    if (this.currentLayoutMode === 'landscape') {
      barX = w * LANDSCAPE.PLAYER_HP_BAR_X_PCT
      barTop = h * LANDSCAPE.PLAYER_HP_BAR_TOP
      barBottom = h * LANDSCAPE.PLAYER_HP_BAR_BOTTOM
    } else {
      barX = w - Math.round(PLAYER_HP_BAR_X_OFFSET * this.scaleFactor)
      barTop = h * PLAYER_HP_BAR_TOP_PCT
      barBottom = h * PLAYER_HP_BAR_BOTTOM_PCT
    }
    const scaledBarW = Math.round(PLAYER_HP_BAR_WIDTH * this.scaleFactor)

    const previousRatio = this.previousPlayerHpRatio
    this.previousPlayerHpRatio = ratio
    const nearDeath = ratio > 0 && ratio < 0.25

    if (USE_OVERLAY_PLAYER_HUD) {
      this.setNearDeathTension(nearDeath)
      return
    }

    // ── Heal overshoot bounce ───────────────────────────────
    if (animate && ratio > previousRatio && !this.reduceMotion) {
      const overshootH = Math.min(this.playerBarMaxH, targetH * 1.05)

      // Draw overshoot first
      this.playerHpBarFill.clear()
      this.playerHpBarFill.fillStyle(COLOR_HP_BLUE, 1)
      this.playerHpBarFill.fillRoundedRect(
        barX - scaledBarW / 2, barBottom - overshootH,
        scaledBarW, overshootH, 8
      )
      this.playerHpBarFill.setData('drawnBounds', { x: barX - scaledBarW / 2, y: barBottom - overshootH, w: scaledBarW, h: overshootH })

      // Brief green flash at edges
      this.pulseEdgeGlow(COLOR_HP_BLUE, 0.15, 200)

      // After 100ms, redraw at correct height
      this.time.delayedCall(100, () => {
        this.playerHpBarFill.clear()
        this.playerHpBarFill.fillStyle(color, 1)
        this.playerHpBarFill.fillRoundedRect(
          barX - scaledBarW / 2, barBottom - targetH,
          scaledBarW, targetH, 8
        )
        this.playerHpBarFill.setData('drawnBounds', { x: barX - scaledBarW / 2, y: barBottom - targetH, w: scaledBarW, h: targetH })
      })

      this.setPlayerHpLabel(colorCss)
      return // Skip normal redraw below since we handled it
    }

    // ── Critical health pulse ────────────────────────────────
    const isCritical = ratio > 0 && ratio < 0.25
    if (isCritical && !this.reduceMotion && !this.criticalPulseTween) {
      this.criticalPulseRect.setVisible(true)
      this.criticalPulseTween = this.tweens.add({
        targets: this.criticalPulseRect,
        alpha: { from: 0.1, to: 0.3 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else if (!isCritical && this.criticalPulseTween) {
      this.criticalPulseTween.destroy()
      this.criticalPulseTween = null
      this.criticalPulseRect.setVisible(false)
      this.criticalPulseRect.setAlpha(0)
    }

    // Redraw the fill bar with the new height (grows from bottom)
    this.playerHpBarFill.clear()
    this.playerHpBarFill.fillStyle(color, 1)
    this.playerHpBarFill.fillRoundedRect(
      barX - scaledBarW / 2, barBottom - targetH,
      scaledBarW, targetH, 8
    )
    this.playerHpBarFill.setData('drawnBounds', { x: barX - scaledBarW / 2, y: barBottom - targetH, w: scaledBarW, h: targetH })

    this.setPlayerHpLabel(colorCss)

    // Activate/deactivate near-death tension
    this.setNearDeathTension(nearDeath)
  }

  /** Refresh player block icon and text visibility. */
  private refreshPlayerBlock(animate: boolean): void {
    if (USE_OVERLAY_PLAYER_HUD) {
      this.playerBlockIcon.setVisible(false)
      this.playerBlockText.setVisible(false)
      return
    }
    const hasBlock = this.currentPlayerBlock > 0
    this.playerBlockIcon.setVisible(hasBlock)
    this.playerBlockText.setVisible(hasBlock)
    if (hasBlock) {
      this.playerBlockText.setText(`${this.currentPlayerBlock}`)
    }
  }

  private setPlayerHpLabel(colorCss: string): void {
    if (USE_OVERLAY_PLAYER_HUD) return
    this.playerHpCurrentText.setText(`${this.currentPlayerHP}`)
    this.playerHpCurrentText.setColor(colorCss)
    this.playerHpSlashText.setColor(colorCss)
    this.playerHpMaxText.setText(`${this.currentPlayerMaxHP}`)
    this.playerHpMaxText.setColor(colorCss)
  }

  /** Update status effect visuals on enemy. */
  updateStatusEffects(effects: Array<{ type: string }>): void {
    if (!this.sceneReady) return
    const enemyX = this.getEnemyX()
    this.statusEffectVisuals.setEnemyPosition(enemyX, this.currentEnemyY)
    this.statusEffectVisuals.updateEffects(effects)
  }

  /** Clear all status effect visuals. */
  clearStatusEffects(): void {
    if (!this.sceneReady) return
    this.statusEffectVisuals.clearAll()
  }

  /** Cleanup on shutdown/sleep — stop tweens, reset positions. */
  private onShutdown(): void {
    this.screenShake?.stop()
    this.tweens.killAll()
    this.flashTween = null
    if (this.criticalPulseTween) {
      this.criticalPulseTween.destroy()
      this.criticalPulseTween = null
    }
    if (this.nearDeathPulseTween) {
      this.nearDeathPulseTween.destroy()
      this.nearDeathPulseTween = null
    }
    this.isNearDeathActive = false
    if (this.chargeParticleTimer) {
      this.chargeParticleTimer.destroy()
      this.chargeParticleTimer = null
    }
    if (this.chargeGlowTween) {
      this.chargeGlowTween.destroy()
      this.chargeGlowTween = null
    }
    if (this.chargeGlowCircle) {
      this.chargeGlowCircle.destroy()
      this.chargeGlowCircle = null
    }
    this.isCharging = false
    // Chain combo overlays
    this.chainVignetteTween?.destroy()
    this.chainVignetteTween = null
    if (this.chainVignetteOverlay) { this.chainVignetteOverlay.destroy(); this.chainVignetteOverlay = null }
    if (this.chainTintOverlay) { this.chainTintOverlay.destroy(); this.chainTintOverlay = null }
    this.currentChainCount = 0
    if (this._turnOverlay) {
      this._turnOverlay.destroy()
      this._turnOverlay = null
    }
    this.enemySpriteSystem?.destroy()
    this.atmosphereSystem?.stop()
    this.depthLightingSystem?.stop()
    this.statusEffectVisuals?.destroy()
    this.weaponAnimations?.destroy()
    this.scale.off('resize', this.onScaleResize, this)
    const cam = this.cameras.main
    cam.zoom = 1.0
    cam.scrollX = 0
    cam.scrollY = 0
  }

  /** Re-sync display on wake/resume. */
  private onWake(): void {
    this.reduceMotion = isReduceMotionEnabled()
    // Reset camera state in case shutdown/sleep left stale offsets
    const cam = this.cameras.main
    cam.zoom = 1.0
    cam.scrollX = 0
    cam.scrollY = 0

    // Fix 1 (AR-97): Re-check layout mode on every wake — the scene may have
    // been sleeping when CardGameManager broadcast a layout change.
    const currentMode = get(layoutMode)
    if (currentMode !== this.currentLayoutMode) {
      this.currentLayoutMode = currentMode
      this.repositionAll()
    }

    // Recreate weapon sprites destroyed by onShutdown — base PNG textures survive preload
    this.weaponAnimations.createSprites(this.displayH)

    this.previousPlayerHpRatio = this.currentPlayerMaxHP > 0
      ? this.currentPlayerHP / this.currentPlayerMaxHP
      : 1
    this.refreshEnemyHpBar(false)
    this.refreshPlayerHpBar(false)
  }
}
