import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'
import { EnemySpriteSystem } from '../systems/EnemySpriteSystem'
import type { AnimArchetype } from '../../data/enemyAnimations'
import { getRandomCombatBg } from '../../data/backgroundManifest'

/** Layout constants for first-person combat display zone (top ~58% of viewport). */
const DISPLAY_ZONE_HEIGHT_PCT = 0.58
const ENEMY_X_PCT = 0.50
const ENEMY_HP_Y_PCT = 0.12
const FLOOR_COUNTER_Y = 16
const INTENT_ICON_OFFSET_Y = -40
const RELIC_TRAY_Y_PCT = 0.92
const FLOOR_LINE_PCT = 0.80

/** Enemy HP bar dimensions. */
const ENEMY_HP_BAR_W = 160
const ENEMY_HP_BAR_H = 12

/** Player HP bar dimensions (vertical, right side). */
const PLAYER_HP_BAR_WIDTH = 16
const PLAYER_HP_BAR_X_OFFSET = 24
const PLAYER_HP_BAR_TOP_PCT = 0.35
const PLAYER_HP_BAR_BOTTOM_PCT = 0.82

/** Enemy first-person sprite sizes by enemy tier. */
const ENEMY_SIZE_COMMON = 300
const ENEMY_SIZE_ELITE = 340
const ENEMY_SIZE_BOSS = 400

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
  private enemySpriteSystem!: EnemySpriteSystem
  private combatBackground!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  private enemyNameText!: Phaser.GameObjects.Text
  private enemyHpBarBg!: Phaser.GameObjects.Graphics
  private enemyHpBarFill!: Phaser.GameObjects.Graphics
  private enemyHpText!: Phaser.GameObjects.Text
  private playerHpBarBg!: Phaser.GameObjects.Graphics
  private playerHpBarFill!: Phaser.GameObjects.Graphics
  private playerHpText!: Phaser.GameObjects.Text
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
  private currentEnemyId = 'cave_bat'
  private currentEnemyCategory: 'common' | 'elite' | 'mini_boss' | 'boss' = 'common'
  private reduceMotion = false
  private effectScale = 1
  private flashTween: Phaser.Tweens.Tween | null = null
  private vignetteGfx!: Phaser.GameObjects.Graphics
  private edgeGlowTop!: Phaser.GameObjects.Rectangle
  private edgeGlowLeft!: Phaser.GameObjects.Rectangle
  private edgeGlowRight!: Phaser.GameObjects.Rectangle
  private edgeGlowTween: Phaser.Tweens.Tween | null = null
  private currentBgKey: string = ''

  // ── Stored layout values ─────────────────────────────────
  private displayH = 0

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
      fontFamily: 'monospace', fontSize: '12px', color: '#cccccc',
    }).setOrigin(0.5, 0.5)

    this.load.on('progress', (value: number) => {
      loadBarFill.displayWidth = 200 * value
    })
    this.load.on('complete', () => {
      loadBarBg.destroy()
      loadBarFill.destroy()
      loadText.destroy()
    })

    const suffix = getDeviceTier() === 'low-end' ? '_1x.webp' : '.webp'
    const enemySprite = (name: string) => `assets/sprites/enemies/${name}${suffix}`

    this.load.image('bg-combat', 'assets/backgrounds/combat/bg_combat_dungeon.webp')
    this.load.image('enemy-cave_bat-idle', enemySprite('cave_bat_idle'))
    this.load.image('enemy-crystal_golem-idle', enemySprite('crystal_golem_idle'))
    this.load.image('enemy-the_excavator-idle', enemySprite('the_excavator_idle'))
  }

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

    // ── Permanent vignette (dark edge fade) ──────────────
    this.vignetteGfx = this.add.graphics().setDepth(1)
    const vigSteps = 48
    const vigInsetX = w * 0.12
    const vigInsetY = h * 0.12
    for (let i = 0; i < vigSteps; i++) {
      const t = i / vigSteps
      const alpha = 0.5 * Math.pow(1 - t, 3.5)
      const offsetX = vigInsetX * t
      const offsetY = vigInsetY * t
      this.vignetteGfx.fillStyle(0x000000, alpha)
      // Top edge
      this.vignetteGfx.fillRect(0, offsetY, w, (vigInsetY - offsetY) / vigSteps + 1)
      // Bottom edge
      this.vignetteGfx.fillRect(0, h - offsetY - (vigInsetY - offsetY) / vigSteps - 1, w, (vigInsetY - offsetY) / vigSteps + 1)
      // Left edge
      this.vignetteGfx.fillRect(offsetX, 0, (vigInsetX - offsetX) / vigSteps + 1, h)
      // Right edge
      this.vignetteGfx.fillRect(w - offsetX - (vigInsetX - offsetX) / vigSteps - 1, 0, (vigInsetX - offsetX) / vigSteps + 1, h)
    }

    // ── Edge glow rectangles (event-driven) ──────────────
    const glowThickness = 140
    this.edgeGlowTop = this.add.rectangle(w / 2, glowThickness / 2, w, glowThickness, 0xff0000, 0).setDepth(2)
    this.edgeGlowLeft = this.add.rectangle(glowThickness / 2, h / 2, glowThickness, h, 0xff0000, 0).setDepth(2)
    this.edgeGlowRight = this.add.rectangle(w - glowThickness / 2, h / 2, glowThickness, h, 0xff0000, 0).setDepth(2)

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
    this.enemyHpBarBg = this.add.graphics().setDepth(10)
    this.enemyHpBarBg.fillStyle(COLOR_BAR_BG, 1)
    this.enemyHpBarBg.fillRoundedRect(
      w / 2 - ENEMY_HP_BAR_W / 2, enemyHpY - ENEMY_HP_BAR_H / 2,
      ENEMY_HP_BAR_W, ENEMY_HP_BAR_H, 6
    )

    this.enemyHpBarFill = this.add.graphics().setDepth(11)
    this.enemyHpBarFill.fillStyle(COLOR_HP_RED, 1)
    this.enemyHpBarFill.fillRoundedRect(
      w / 2 - ENEMY_HP_BAR_W / 2, enemyHpY - ENEMY_HP_BAR_H / 2,
      ENEMY_HP_BAR_W, ENEMY_HP_BAR_H, 6
    )

    this.enemyHpText = this.add.text(w / 2, enemyHpY, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5)

    // ── Enemy block bar (overlays HP bar when enemy has block) ──
    this.enemyBlockBarFill = this.add.graphics().setDepth(12)

    this.enemyBlockIcon = this.add.text(
      w / 2 - ENEMY_HP_BAR_W / 2 - 20, enemyHpY,
      '🛡️', { fontSize: '14px' }
    ).setOrigin(0.5, 0.5).setDepth(12).setVisible(false)

    this.enemyBlockText = this.add.text(
      w / 2 - ENEMY_HP_BAR_W / 2 - 20, enemyHpY + 12,
      '', { fontFamily: 'monospace', fontSize: '10px', color: '#3498db' }
    ).setOrigin(0.5, 0.5).setDepth(12).setVisible(false)

    // ── Enemy sprite system ─────────────────────────────
    const floorY = this.displayH * FLOOR_LINE_PCT
    const baseEnemySize = enemyDisplaySize('common')
    const enemyY = floorY - baseEnemySize / 2
    this.currentEnemyY = enemyY
    this.enemySpriteSystem = new EnemySpriteSystem(this)

    this.enemyNameText = this.add.text(w * ENEMY_X_PCT, enemyY + baseEnemySize / 2 + 12, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(7)
    this.enemyNameText.setVisible(false)

    // ── Player HP bar (vertical, right side) ─────────────────
    const barX = w - PLAYER_HP_BAR_X_OFFSET
    const barTop = h * PLAYER_HP_BAR_TOP_PCT
    const barBottom = h * PLAYER_HP_BAR_BOTTOM_PCT
    this.playerBarMaxH = barBottom - barTop

    this.playerHpBarBg = this.add.graphics().setDepth(8)
    this.playerHpBarBg.fillStyle(COLOR_BAR_BG, 1)
    this.playerHpBarBg.fillRoundedRect(
      barX - PLAYER_HP_BAR_WIDTH / 2, barTop,
      PLAYER_HP_BAR_WIDTH, this.playerBarMaxH, 8
    )

    this.playerHpBarFill = this.add.graphics().setDepth(8)
    this.playerHpBarFill.fillStyle(COLOR_HP_GREEN, 1)
    this.playerHpBarFill.fillRoundedRect(
      barX - PLAYER_HP_BAR_WIDTH / 2, barTop,
      PLAYER_HP_BAR_WIDTH, this.playerBarMaxH, 8
    )

    this.playerHpText = this.add.text(barX, barBottom + 14, `${this.currentPlayerHP}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(8)

    // ── Player block icon (above HP bar) ────────────────────
    this.playerBlockIcon = this.add.text(barX, barTop - 16, '\u{1F6E1}\u{FE0F}', {
      fontSize: '16px',
    }).setOrigin(0.5, 0.5).setVisible(false).setDepth(12)

    this.playerBlockText = this.add.text(barX, barTop - 16, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5).setVisible(false).setDepth(13)

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
    animArchetype?: AnimArchetype,
  ): void {
    if (!this.sceneReady) return
    this.currentEnemyHP = hp
    this.currentEnemyMaxHP = maxHP
    this.currentEnemyId = enemyId ?? this.currentEnemyId
    this.currentEnemyCategory = category
    const size = enemyDisplaySize(category)
    const enemyX = this.scale.width * ENEMY_X_PCT
    const floorY = this.displayH * FLOOR_LINE_PCT
    const enemyY = floorY - size / 2
    this.currentEnemyY = enemyY

    // Setup enemy sprite/placeholder via EnemySpriteSystem
    const texture = enemyTextureKey(this.currentEnemyId, 'idle')
    const hasSprite = hasTexture(this, texture)

    if (hasSprite) {
      this.enemySpriteSystem.setSprite(texture, size, enemyX, enemyY, category)
    } else {
      this.enemySpriteSystem.setPlaceholder(categoryColor(category), size, enemyX, enemyY, category)
    }

    // Apply animation archetype config
    this.enemySpriteSystem.setAnimConfig(animArchetype)

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

  /** Update player block display. */
  updatePlayerBlock(block: number, animate = true): void {
    if (!this.sceneReady) return
    this.currentPlayerBlock = block
    this.refreshPlayerBlock(animate && !this.reduceMotion)
    // Re-color HP bar based on block state
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

  /** Dynamically load and display a random combat background for the given floor. */
  setBackground(floor: number, isBoss: boolean): void {
    if (!this.sceneReady) return

    const bgPath = getRandomCombatBg(floor, isBoss)
    // Strip leading slash for Phaser's asset loader
    const cleanPath = bgPath.startsWith('/') ? bgPath.slice(1) : bgPath
    const bgKey = `bg-combat-${cleanPath.split('/').pop()?.replace('.webp', '') ?? 'default'}`

    // If same texture already loaded, skip
    if (bgKey === this.currentBgKey) return

    // If texture already exists in cache, just swap
    if (hasTexture(this, bgKey)) {
      this._swapBackground(bgKey)
      return
    }

    // Load new texture dynamically
    this.load.image(bgKey, cleanPath)
    this.load.once('complete', () => {
      this._swapBackground(bgKey)
    })
    this.load.start()
  }

  private _swapBackground(bgKey: string): void {
    this.currentBgKey = bgKey
    const w = this.scale.width
    const h = this.scale.height
    if (this.combatBackground instanceof Phaser.GameObjects.Image) {
      this.combatBackground.setTexture(bgKey)
      this.combatBackground.setDisplaySize(w, h)
    } else {
      // Replace rectangle fallback with proper image
      this.combatBackground.destroy()
      this.combatBackground = this.add.image(w / 2, h / 2, bgKey)
        .setDisplaySize(w, h)
        .setDepth(0)
    }
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

  /** Play player damage flash (red tint across display zone). */
  playPlayerDamageFlash(): void {
    if (this.reduceMotion) return
    this.pulseFlash(COLOR_HP_RED, 0.15, 110)
    this.pulseEdgeGlow(COLOR_HP_RED, 0.35, 300)
    this.cameras.main.shake(180, 0.006 * this.effectScale, true)
  }

  /** Play heal effect (green particles rising near player HP bar). */
  playHealEffect(): void {
    if (this.reduceMotion) return
    const barX = this.scale.width - PLAYER_HP_BAR_X_OFFSET
    const barMidY = this.displayH * (PLAYER_HP_BAR_TOP_PCT + PLAYER_HP_BAR_BOTTOM_PCT) / 2
    this.burstParticles(12, barX, barMidY, COLOR_HP_GREEN)
    this.pulseEdgeGlow(COLOR_HP_GREEN, 0.25, 270)
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
    this.pulseEdgeGlow(0xFFD700, 0.3, 300)
  }

  playPlayerAttackAnimation(): void {
    if (this.reduceMotion) return
    const container = this.enemySpriteSystem.getContainer()
    this.tweens.add({
      targets: container,
      y: container.y - 8,
      duration: 110,
      yoyo: true,
      ease: 'Sine.easeOut',
    })
  }

  playPlayerCastAnimation(): void {
    if (this.reduceMotion) return
    this.playScreenFlash(0.12)
    this.pulseEdgeGlow(COLOR_HP_GREEN, 0.25, 270)
    this.burstParticles(14, this.scale.width / 2, this.displayH * 0.44, 0x8be4ff)
  }

  playPlayerBlockAnimation(): void {
    if (this.reduceMotion) return
    this.playScreenFlash(0.1)
    this.pulseEdgeGlow(0x3498db, 0.3, 270)
    this.burstParticles(10, this.scale.width / 2, this.displayH * 0.47, 0x8fbfff)
  }

  /** Play blue flash when player block absorbs all incoming damage. */
  playBlockAbsorbFlash(): void {
    if (this.reduceMotion) return
    this.pulseEdgeGlow(0x3498db, 0.25, 330)
    this.cameras.main.shake(100, 0.003 * this.effectScale, true)
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
    this.cameras.main.shake(250, 0.007 * this.effectScale, true)
  }

  /** Play enemy defend animation — shimmering blue shield effect. */
  playEnemyDefendAnimation(): void {
    if (this.reduceMotion) return
    const enemyX = this.scale.width * ENEMY_X_PCT
    const enemyY = this.currentEnemyY
    const size = enemyDisplaySize(this.currentEnemyCategory)
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
    const enemyX = this.scale.width * ENEMY_X_PCT
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
    const enemyX = this.scale.width * ENEMY_X_PCT
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
    this.cameras.main.shake(80, 0.002 * this.effectScale, true)
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
    this.cameras.main.shake(100, 0.002 * this.effectScale, true)
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
        this.cameras.main.shake(80, 0.003 * this.effectScale, true)
      })
    }
    this.pulseEdgeGlow(0xe74c3c, 0.4, 450)
    this.time.delayedCall(360, () => {
      this.cameras.main.shake(180, 0.006 * this.effectScale, true)
    })
  }

  // ═════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════

  private playEncounterEntry(): void {
    this.entryFadeRect.setAlpha(1)

    const isBoss = this.currentEnemyCategory === 'boss'
    const fadeDuration = isBoss ? 560 : 380

    // Delegate sprite entry animation to EnemySpriteSystem
    this.enemySpriteSystem.playEntry(isBoss)

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

  /** Flash colored glow at screen edges for combat feedback. */
  private pulseEdgeGlow(color: number, peakAlpha: number, durationMs: number): void {
    if (this.reduceMotion) return
    if (this.edgeGlowTween) {
      this.edgeGlowTween.stop()
      this.edgeGlowTween = null
    }
    const rects = [this.edgeGlowTop, this.edgeGlowLeft, this.edgeGlowRight]
    for (const r of rects) {
      r.setFillStyle(color, 1)
      r.setAlpha(0)
    }
    this.edgeGlowTween = this.tweens.add({
      targets: rects,
      alpha: peakAlpha,
      duration: Math.max(40, Math.round(durationMs * 0.65)),
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        for (const r of rects) r.setAlpha(0)
        this.edgeGlowTween = null
      },
    })
  }

  /** Refresh enemy HP bar fill width and text. */
  private refreshEnemyHpBar(animate: boolean): void {
    const ratio = this.currentEnemyMaxHP > 0
      ? this.currentEnemyHP / this.currentEnemyMaxHP
      : 0
    const targetW = Math.max(1, ratio * ENEMY_HP_BAR_W)
    const color = this.currentEnemyBlock > 0 ? 0x3498db : COLOR_HP_RED
    const w = this.scale.width
    const enemyHpY = this.displayH * ENEMY_HP_Y_PCT

    // Redraw the fill bar with the new width
    this.enemyHpBarFill.clear()
    this.enemyHpBarFill.fillStyle(color, 1)
    this.enemyHpBarFill.fillRoundedRect(
      w / 2 - ENEMY_HP_BAR_W / 2, enemyHpY - ENEMY_HP_BAR_H / 2,
      targetW, ENEMY_HP_BAR_H, 6
    )

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
      const w = this.scale.width
      const enemyHpY = this.displayH * ENEMY_HP_Y_PCT

      // Redraw the block bar
      this.enemyBlockBarFill.clear()
      this.enemyBlockBarFill.fillStyle(0x3498db, 0.6)
      this.enemyBlockBarFill.fillRoundedRect(
        w / 2 - ENEMY_HP_BAR_W / 2, enemyHpY - ENEMY_HP_BAR_H / 2,
        targetW, ENEMY_HP_BAR_H, 6
      )
    } else {
      this.enemyBlockBarFill.clear()
    }
  }

  /** Refresh player HP bar fill height, color, and text. */
  private refreshPlayerHpBar(animate: boolean): void {
    const ratio = this.currentPlayerMaxHP > 0
      ? this.currentPlayerHP / this.currentPlayerMaxHP
      : 0
    const targetH = Math.max(1, ratio * this.playerBarMaxH)
    const color = this.currentPlayerBlock > 0 ? 0x3498db : playerHpColor(ratio)
    const w = this.scale.width
    const h = this.scale.height
    const barX = w - PLAYER_HP_BAR_X_OFFSET
    const barTop = h * PLAYER_HP_BAR_TOP_PCT
    const barBottom = h * PLAYER_HP_BAR_BOTTOM_PCT

    // Redraw the fill bar with the new height (grows from bottom)
    this.playerHpBarFill.clear()
    this.playerHpBarFill.fillStyle(color, 1)
    this.playerHpBarFill.fillRoundedRect(
      barX - PLAYER_HP_BAR_WIDTH / 2, barBottom - targetH,
      PLAYER_HP_BAR_WIDTH, targetH, 8
    )

    this.playerHpText.setText(`${this.currentPlayerHP}`)
  }

  /** Refresh player block icon and text visibility. */
  private refreshPlayerBlock(animate: boolean): void {
    const hasBlock = this.currentPlayerBlock > 0
    this.playerBlockIcon.setVisible(hasBlock)
    this.playerBlockText.setVisible(hasBlock)
    if (hasBlock) {
      this.playerBlockText.setText(`${this.currentPlayerBlock}`)
    }
  }

  /** Cleanup on shutdown/sleep — stop tweens, reset positions. */
  private onShutdown(): void {
    this.tweens.killAll()
    this.flashTween = null
    this.enemySpriteSystem?.destroy()
  }

  /** Re-sync display on wake/resume. */
  private onWake(): void {
    this.reduceMotion = isReduceMotionEnabled()
    this.refreshEnemyHpBar(false)
    this.refreshPlayerHpBar(false)
  }
}
