import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'

/** Layout constants for first-person combat display zone (top ~58% of viewport). */
const DISPLAY_ZONE_HEIGHT_PCT = 0.58
const ENEMY_Y_PCT = 0.35
const ENEMY_X_PCT = 0.50
const PLAYER_HP_Y_PCT = 0.88
const ENEMY_HP_Y_PCT = 0.12
const FLOOR_COUNTER_Y = 16
const INTENT_ICON_OFFSET_Y = -40
const RELIC_TRAY_Y_PCT = 0.92

/** Enemy HP bar dimensions. */
const ENEMY_HP_BAR_W = 160
const ENEMY_HP_BAR_H = 12

/** Player HP bar dimensions. */
const PLAYER_HP_BAR_W = 140
const PLAYER_HP_BAR_H = 16
const PLAYER_HP_X = 12

/** Enemy first-person sprite sizes by enemy tier. */
const ENEMY_SIZE_COMMON = 200
const ENEMY_SIZE_ELITE = 250
const ENEMY_SIZE_BOSS = 300

/** Color constants. */
const COLOR_HP_RED = 0xe74c3c
const COLOR_HP_GREEN = 0x2ecc71
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

function enemyDisplaySize(category: 'common' | 'elite' | 'mini_boss' | 'boss'): number {
  if (category === 'boss') return ENEMY_SIZE_BOSS
  if (category === 'elite' || category === 'mini_boss') return ENEMY_SIZE_ELITE
  return ENEMY_SIZE_COMMON
}

/** Get player HP bar fill color based on ratio. */
function playerHpColor(ratio: number): number {
  if (ratio > 0.5) return COLOR_HP_GREEN
  if (ratio > 0.25) return COLOR_HP_YELLOW
  return COLOR_HP_RED
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
  private enemySprite!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image
  private combatBackground!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  private enemyNameText!: Phaser.GameObjects.Text
  private enemyHpBarBg!: Phaser.GameObjects.Rectangle
  private enemyHpBarFill!: Phaser.GameObjects.Rectangle
  private enemyHpText!: Phaser.GameObjects.Text
  private playerHpBarBg!: Phaser.GameObjects.Rectangle
  private playerHpBarFill!: Phaser.GameObjects.Rectangle
  private playerHpText!: Phaser.GameObjects.Text
  private intentText!: Phaser.GameObjects.Text
  private floorCounterText!: Phaser.GameObjects.Text
  private relicContainer!: Phaser.GameObjects.Container
  private flashRect!: Phaser.GameObjects.Rectangle
  private entryFadeRect!: Phaser.GameObjects.Rectangle
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter
  private enemyPlaceholderBorder!: Phaser.GameObjects.Rectangle | null
  private enemyPlaceholderIcon!: Phaser.GameObjects.Text | null
  private enemyBlockBarFill!: Phaser.GameObjects.Rectangle
  private enemyBlockIcon!: Phaser.GameObjects.Text
  private enemyBlockText!: Phaser.GameObjects.Text
  private sceneReady = false

  // ── State ────────────────────────────────────────────────
  private currentEnemyHP = 0
  private currentEnemyMaxHP = 0
  private currentEnemyBlock = 0
  private currentPlayerHP = 80
  private currentPlayerMaxHP = 80
  private currentFloor = 1
  private currentEncounter = 1
  private totalEncounters = 3
  private currentEnemyId = 'cave_bat'
  private currentEnemyCategory: 'common' | 'elite' | 'mini_boss' | 'boss' = 'common'
  private reduceMotion = false
  private effectScale = 1
  private flashTween: Phaser.Tweens.Tween | null = null

  // ── Stored layout values ─────────────────────────────────
  private displayH = 0

  // ═════════════════════════════════════════════════════════
  // Lifecycle
  // ═════════════════════════════════════════════════════════

  /** Create all game objects for the combat display zone. */
  create(): void {
    this.reduceMotion = isReduceMotionEnabled()
    this.effectScale = getDeviceTier() === 'low-end' ? 0.65 : 1
    const w = this.scale.width
    const h = this.scale.height
    this.displayH = h * DISPLAY_ZONE_HEIGHT_PCT

    // ── Combat background ─────────────────────────────────
    if (hasTexture(this, 'bg-combat')) {
      this.combatBackground = this.add.image(w / 2, h / 2, 'bg-combat')
        .setDisplaySize(w, h)
        .setDepth(0)
    } else {
      this.combatBackground = this.add.rectangle(w / 2, h / 2, w, h, 0x0d1117)
    }

    // ── Floor counter (top-left) ──────────────────────────
    this.floorCounterText = this.add.text(12, FLOOR_COUNTER_Y, this.floorLabel(), {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#cccccc',
    })
    this.floorCounterText.setVisible(false)

    // ── Enemy intent ──────────────────────────────────────
    const enemyHpY = this.displayH * ENEMY_HP_Y_PCT
    this.intentText = this.add.text(w / 2, enemyHpY + INTENT_ICON_OFFSET_Y, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff9999',
      align: 'center',
    }).setOrigin(0.5, 1)
    this.intentText.setVisible(false)

    // ── Enemy HP bar ──────────────────────────────────────
    this.enemyHpBarBg = this.add.rectangle(
      w / 2, enemyHpY,
      ENEMY_HP_BAR_W, ENEMY_HP_BAR_H,
      COLOR_BAR_BG,
    ).setOrigin(0.5, 0.5)

    this.enemyHpBarFill = this.add.rectangle(
      w / 2 - ENEMY_HP_BAR_W / 2, enemyHpY,
      ENEMY_HP_BAR_W, ENEMY_HP_BAR_H,
      COLOR_HP_RED,
    ).setOrigin(0, 0.5)

    this.enemyHpText = this.add.text(w / 2, enemyHpY, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5)

    // ── Enemy block bar (overlays HP bar when enemy has block) ──
    this.enemyBlockBarFill = this.add.rectangle(
      w / 2 - ENEMY_HP_BAR_W / 2, enemyHpY,
      0, ENEMY_HP_BAR_H,
      0x3498db, 0.6
    ).setOrigin(0, 0.5).setDepth(12)

    this.enemyBlockIcon = this.add.text(
      w / 2 - ENEMY_HP_BAR_W / 2 - 20, enemyHpY,
      '🛡️', { fontSize: '14px' }
    ).setOrigin(0.5, 0.5).setDepth(12).setVisible(false)

    this.enemyBlockText = this.add.text(
      w / 2 - ENEMY_HP_BAR_W / 2 - 20, enemyHpY + 12,
      '', { fontFamily: 'monospace', fontSize: '10px', color: '#3498db' }
    ).setOrigin(0.5, 0.5).setDepth(12).setVisible(false)

    // ── Enemy sprite placeholder ──────────────────────────
    const enemyY = this.displayH * ENEMY_Y_PCT
    const baseEnemySize = enemyDisplaySize('common')
    this.enemySprite = this.add.rectangle(
      w * ENEMY_X_PCT, enemyY,
      baseEnemySize, baseEnemySize,
      COLOR_COMMON,
    ).setOrigin(0.5, 0.5).setDepth(5)

    // Border outline for placeholder
    this.enemyPlaceholderBorder = this.add.rectangle(
      w * ENEMY_X_PCT, enemyY,
      baseEnemySize + 10, baseEnemySize + 10,
    ).setOrigin(0.5, 0.5).setStrokeStyle(2, 0xaaaaaa).setFillStyle(0x000000, 0)
      .setDepth(4)

    // "?" silhouette indicator
    this.enemyPlaceholderIcon = this.add.text(w * ENEMY_X_PCT, enemyY, '?', {
      fontFamily: 'monospace',
      fontSize: '46px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0.6).setDepth(6)

    this.enemyNameText = this.add.text(w * ENEMY_X_PCT, enemyY + baseEnemySize / 2 + 12, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(7)
    this.enemyNameText.setVisible(false)

    // ── Player HP bar ─────────────────────────────────────
    const playerHpY = this.displayH * PLAYER_HP_Y_PCT
    this.playerHpBarBg = this.add.rectangle(
      PLAYER_HP_X + PLAYER_HP_BAR_W / 2, playerHpY,
      PLAYER_HP_BAR_W, PLAYER_HP_BAR_H,
      COLOR_BAR_BG,
    ).setOrigin(0.5, 0.5)

    this.playerHpBarFill = this.add.rectangle(
      PLAYER_HP_X, playerHpY,
      PLAYER_HP_BAR_W, PLAYER_HP_BAR_H,
      COLOR_HP_GREEN,
    ).setOrigin(0, 0.5)

    this.playerHpText = this.add.text(PLAYER_HP_X + PLAYER_HP_BAR_W / 2, playerHpY, `${this.currentPlayerHP} / ${this.currentPlayerMaxHP}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5)

    // ── Relic tray container ──────────────────────────────
    this.relicContainer = this.add.container(PLAYER_HP_X + PLAYER_HP_BAR_W / 2, this.displayH * RELIC_TRAY_Y_PCT)

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

    // ── Scene lifecycle events ────────────────────────────
    this.events.on('shutdown', this.onShutdown, this)
    this.events.on('sleep', this.onShutdown, this)
    this.events.on('wake', this.onWake, this)

    this.sceneReady = true
  }

  // ═════════════════════════════════════════════════════════
  // Public API — called by GameManager / bridge
  // ═════════════════════════════════════════════════════════

  /** Set the enemy display data. */
  setEnemy(
    name: string,
    category: 'common' | 'elite' | 'mini_boss' | 'boss',
    hp: number,
    maxHP: number,
    enemyId?: string,
  ): void {
    if (!this.sceneReady) return
    this.currentEnemyHP = hp
    this.currentEnemyMaxHP = maxHP
    this.currentEnemyId = enemyId ?? this.currentEnemyId
    this.currentEnemyCategory = category
    const size = enemyDisplaySize(category)
    const enemyX = this.scale.width * ENEMY_X_PCT
    const enemyY = this.displayH * ENEMY_Y_PCT

    // Reset enemy sprite for new encounter
    const texture = enemyTextureKey(this.currentEnemyId, 'idle')
    const hasSprite = hasTexture(this, texture)

    if (hasSprite) {
      if (!('setTexture' in this.enemySprite)) {
        this.enemySprite.destroy()
        this.enemySprite = this.add.image(enemyX, enemyY, texture)
          .setDisplaySize(size, size)
          .setDepth(5)
      } else {
        ;(this.enemySprite as Phaser.GameObjects.Image).setTexture(texture)
        ;(this.enemySprite as Phaser.GameObjects.Image).setDisplaySize(size, size)
      }
    } else if ('setTexture' in this.enemySprite) {
      this.enemySprite.destroy()
      this.enemySprite = this.add.rectangle(
        enemyX,
        enemyY,
        size,
        size,
        categoryColor(category),
      ).setDepth(5)
    } else {
      this.enemySprite.setSize(size, size)
    }

    if ('setFillStyle' in this.enemySprite) {
      this.enemySprite.setFillStyle(categoryColor(category))
    }

    // Show/hide placeholder border and icon based on whether real sprite exists
    const borderColor = category === 'boss' ? 0xff4444 : category === 'elite' ? 0xffd700 : 0xaaaaaa
    if (this.enemyPlaceholderBorder) {
      this.enemyPlaceholderBorder.setVisible(!hasSprite)
      this.enemyPlaceholderBorder.setStrokeStyle(2, borderColor)
      this.enemyPlaceholderBorder.setSize(size + 10, size + 10)
      this.enemyPlaceholderBorder.setPosition(enemyX, enemyY)
    }
    if (this.enemyPlaceholderIcon) {
      this.enemyPlaceholderIcon.setVisible(!hasSprite)
      this.enemyPlaceholderIcon.setPosition(enemyX, enemyY)
    }

    this.enemySprite.setAlpha(1)
    this.enemySprite.setScale(1)
    this.enemySprite.setPosition(enemyX, enemyY)

    this.enemyNameText.setText(name)
    this.enemyNameText.setPosition(enemyX, enemyY + size / 2 + 12)
    this.refreshEnemyHpBar(false)
    this.playEncounterEntry()
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
    const spacing = 36
    const startX = -((relics.length - 1) * spacing) / 2
    relics.forEach((relic, i) => {
      const bg = this.add.rectangle(startX + i * spacing, 0, 28, 28, 0x444466, 0.8)
      const txt = this.add.text(startX + i * spacing, 0, relic.label.charAt(0).toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ccccff',
        align: 'center',
      }).setOrigin(0.5, 0.5)
      this.relicContainer.add([bg, txt])
    })
  }

  /** Play enemy hit reaction (flash white, slight knockback). */
  playEnemyHitReaction(): void {
    const hitTexture = enemyTextureKey(this.currentEnemyId, 'hit')
    const idleTexture = enemyTextureKey(this.currentEnemyId, 'idle')

    if ('setTexture' in this.enemySprite && hasTexture(this, hitTexture)) {
      ;(this.enemySprite as Phaser.GameObjects.Image).setTexture(hitTexture)
      this.time.delayedCall(160, () => {
        if (hasTexture(this, idleTexture) && 'setTexture' in this.enemySprite) {
          ;(this.enemySprite as Phaser.GameObjects.Image).setTexture(idleTexture)
        }
      })
    } else if ('setFillStyle' in this.enemySprite) {
      this.enemySprite.setFillStyle(0xffffff)
      this.time.delayedCall(110, () => {
        if ('setFillStyle' in this.enemySprite) {
          this.enemySprite.setFillStyle(categoryColor(this.currentEnemyCategory))
        }
      })
    }

    const origScaleX = this.enemySprite.scaleX
    const origScaleY = this.enemySprite.scaleY
    if (this.reduceMotion) return
    this.cameras.main.shake(100, 0.0025 * this.effectScale, true)
    this.tweens.add({
      targets: this.enemySprite,
      scaleX: origScaleX * 1.08,
      scaleY: origScaleY * 1.08,
      duration: 95,
      yoyo: true,
      ease: 'Sine.easeInOut',
    })
  }

  /** Alias used by newer encounter bridge hooks. */
  playEnemyHitAnimation(): void {
    this.playEnemyHitReaction()
  }

  /** Play enemy attack animation (lunge toward player). */
  playEnemyAttackAnimation(): void {
    if (this.reduceMotion) return
    const startY = this.displayH * ENEMY_Y_PCT
    const startScale = this.enemySprite.scaleX
    this.tweens.add({
      targets: this.enemySprite,
      y: startY + 18,
      scaleX: startScale * 1.12,
      scaleY: startScale * 1.12,
      duration: 140,
      yoyo: true,
      ease: 'Power2',
    })
    this.cameras.main.shake(130, 0.0034 * this.effectScale, true)
  }

  /** Play enemy death animation (fade out + scale down). Returns promise resolving on completion. */
  playEnemyDeathAnimation(): Promise<void> {
    const deathTexture = enemyTextureKey(this.currentEnemyId, 'death')
    if ('setTexture' in this.enemySprite && hasTexture(this, deathTexture)) {
      ;(this.enemySprite as Phaser.GameObjects.Image).setTexture(deathTexture)
    }
    if (this.reduceMotion) {
      this.enemySprite.setAlpha(0)
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: this.enemySprite,
        alpha: 0,
        scaleX: 0.15,
        scaleY: 0.15,
        y: this.enemySprite.y + 24,
        duration: 520,
        ease: 'Power2',
        onComplete: () => resolve(),
      })
    })
  }

  /** Play player damage flash (red tint across display zone). */
  playPlayerDamageFlash(): void {
    if (this.reduceMotion) return

    this.pulseFlash(COLOR_HP_RED, 0.15, 110)
    this.cameras.main.shake(150, 0.004 * this.effectScale, true)
  }

  /** Play heal effect (green particles rising near player HP bar). */
  playHealEffect(): void {
    if (this.reduceMotion) return

    const playerHpY = this.displayH * PLAYER_HP_Y_PCT
    this.burstParticles(12, this.scale.width / 2, playerHpY, COLOR_HP_GREEN)
  }

  /** Flash the display zone white. */
  playScreenFlash(intensity: number = 0.3): void {
    if (this.reduceMotion) return
    this.pulseFlash(0xFFFFFF, intensity, 150)
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
  }

  playPlayerAttackAnimation(): void {
    if (this.reduceMotion) return
    this.tweens.add({
      targets: this.enemySprite,
      y: this.enemySprite.y - 8,
      duration: 110,
      yoyo: true,
      ease: 'Sine.easeOut',
    })
  }

  playPlayerCastAnimation(): void {
    if (this.reduceMotion) return
    this.playScreenFlash(0.12)
    this.burstParticles(14, this.scale.width / 2, this.displayH * 0.44, 0x8be4ff)
  }

  playPlayerBlockAnimation(): void {
    if (this.reduceMotion) return
    this.playScreenFlash(0.1)
    this.burstParticles(10, this.scale.width / 2, this.displayH * 0.47, 0x8fbfff)
  }

  playPlayerVictoryAnimation(): void {
    if (this.reduceMotion) return
    this.tweens.add({
      targets: this.enemySprite,
      alpha: 0.2,
      duration: 140,
      yoyo: true,
    })
  }

  playPlayerDefeatAnimation(): void {
    if (this.reduceMotion) return
    this.playPlayerDamageFlash()
    this.cameras.main.shake(200, 0.005 * this.effectScale, true)
  }

  // ═════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════

  private playEncounterEntry(): void {
    this.entryFadeRect.setAlpha(1)

    const isBoss = this.currentEnemyCategory === 'boss'
    const startScale = isBoss ? 0.76 : 0.86
    const fadeDuration = isBoss ? 560 : 380

    this.enemySprite.setAlpha(this.reduceMotion ? 1 : 0.16)
    this.enemySprite.setScale(this.reduceMotion ? 1 : startScale)

    if (!this.reduceMotion) {
      this.tweens.add({
        targets: this.enemySprite,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: fadeDuration,
        ease: isBoss ? 'Back.Out' : 'Quad.Out',
      })
    }

    this.tweens.add({
      targets: this.entryFadeRect,
      alpha: 0,
      duration: fadeDuration,
      ease: 'Sine.easeOut',
    })

    if (isBoss && !this.reduceMotion) {
      this.cameras.main.shake(180, 0.0035 * this.effectScale, true)
      const cam = this.cameras.main
      const baseZoom = cam.zoom
      this.tweens.add({
        targets: cam,
        zoom: baseZoom * 1.045,
        duration: 190,
        yoyo: true,
        ease: 'Sine.easeInOut',
      })
    }
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

  /** Refresh enemy HP bar fill width and text. */
  private refreshEnemyHpBar(animate: boolean): void {
    const ratio = this.currentEnemyMaxHP > 0
      ? this.currentEnemyHP / this.currentEnemyMaxHP
      : 0
    const targetW = Math.max(1, ratio * ENEMY_HP_BAR_W)

    if (animate) {
      this.tweens.add({
        targets: this.enemyHpBarFill,
        displayWidth: targetW,
        duration: 300,
        ease: 'Power2',
      })
    } else {
      this.enemyHpBarFill.displayWidth = targetW
    }

    // Color HP bar based on block presence
    if (this.currentEnemyBlock > 0) {
      this.enemyHpBarFill.setFillStyle(0x3498db)
    } else {
      this.enemyHpBarFill.setFillStyle(COLOR_HP_RED)
    }

    this.enemyHpText.setText(`${this.currentEnemyHP} / ${this.currentEnemyMaxHP}`)
  }

  /** Refresh enemy block bar overlay and indicators. */
  private refreshEnemyBlockBar(animate: boolean): void {
    const hasBlock = this.currentEnemyBlock > 0

    this.enemyBlockIcon.setVisible(hasBlock)
    this.enemyBlockText.setVisible(hasBlock)

    if (hasBlock) {
      this.enemyBlockText.setText(`${this.currentEnemyBlock}`)
      const blockRatio = Math.min(1, this.currentEnemyBlock / this.currentEnemyMaxHP)
      const targetW = Math.max(1, blockRatio * ENEMY_HP_BAR_W)

      if (animate) {
        this.tweens.add({
          targets: this.enemyBlockBarFill,
          displayWidth: targetW,
          duration: 300,
          ease: 'Power2',
        })
      } else {
        this.enemyBlockBarFill.displayWidth = targetW
      }

      // Tint HP bar blue when block is active
      this.enemyHpBarFill.setFillStyle(0x3498db)
    } else {
      this.enemyBlockBarFill.displayWidth = 0
      // Restore HP bar to red
      this.enemyHpBarFill.setFillStyle(COLOR_HP_RED)
    }
  }

  /** Refresh player HP bar fill width, color, and text. */
  private refreshPlayerHpBar(animate: boolean): void {
    const ratio = this.currentPlayerMaxHP > 0
      ? this.currentPlayerHP / this.currentPlayerMaxHP
      : 0
    const targetW = Math.max(1, ratio * PLAYER_HP_BAR_W)
    const color = playerHpColor(ratio)

    this.playerHpBarFill.setFillStyle(color)

    if (animate) {
      this.tweens.add({
        targets: this.playerHpBarFill,
        displayWidth: targetW,
        duration: 400,
        ease: 'Power2',
      })
    } else {
      this.playerHpBarFill.displayWidth = targetW
    }

    this.playerHpText.setText(`${this.currentPlayerHP} / ${this.currentPlayerMaxHP}`)
  }

  /** Cleanup on shutdown/sleep — stop tweens, reset positions. */
  private onShutdown(): void {
    this.tweens.killAll()
    this.flashTween = null
  }

  /** Re-sync display on wake/resume. */
  private onWake(): void {
    this.reduceMotion = isReduceMotionEnabled()
    this.refreshEnemyHpBar(false)
    this.refreshPlayerHpBar(false)
  }
}
