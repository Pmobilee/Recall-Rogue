import Phaser from 'phaser'

/** Layout constants for the combat display zone (top 55% of viewport). */
const DISPLAY_ZONE_HEIGHT_PCT = 0.55
const ENEMY_Y_PCT = 0.20
const PLAYER_Y_PCT = 0.40
const PLAYER_X_PCT = 0.25
const ENEMY_X_PCT = 0.75
const PLAYER_HP_Y_PCT = 0.48
const ENEMY_HP_Y_PCT = 0.12
const FLOOR_COUNTER_Y = 16
const INTENT_ICON_OFFSET_Y = -40
const RELIC_TRAY_Y_PCT = 0.52

/** Enemy HP bar dimensions. */
const ENEMY_HP_BAR_W = 160
const ENEMY_HP_BAR_H = 12

/** Player HP bar dimensions. */
const PLAYER_HP_BAR_W = 200
const PLAYER_HP_BAR_H = 16

/** Enemy placeholder size. */
const ENEMY_SIZE = 80
const PLAYER_SIZE = 96

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
  private playerSprite!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image
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
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter
  private enemyPlaceholderBorder!: Phaser.GameObjects.Rectangle | null
  private enemyPlaceholderIcon!: Phaser.GameObjects.Text | null

  // ── State ────────────────────────────────────────────────
  private currentEnemyHP = 0
  private currentEnemyMaxHP = 0
  private currentPlayerHP = 80
  private currentPlayerMaxHP = 80
  private currentFloor = 1
  private currentEncounter = 1
  private totalEncounters = 3
  private currentEnemyId = 'cave_bat'
  private reduceMotion = false

  // ── Stored layout values ─────────────────────────────────
  private displayH = 0

  // ═════════════════════════════════════════════════════════
  // Lifecycle
  // ═════════════════════════════════════════════════════════

  /** Create all game objects for the combat display zone. */
  create(): void {
    this.reduceMotion = isReduceMotionEnabled()
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

    // ── Enemy intent ──────────────────────────────────────
    const enemyHpY = this.displayH * ENEMY_HP_Y_PCT
    this.intentText = this.add.text(w / 2, enemyHpY + INTENT_ICON_OFFSET_Y, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff9999',
      align: 'center',
    }).setOrigin(0.5, 1)

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

    // ── Enemy sprite placeholder ──────────────────────────
    const enemyY = this.displayH * ENEMY_Y_PCT
    this.enemySprite = this.add.rectangle(
      w * ENEMY_X_PCT, enemyY,
      ENEMY_SIZE, ENEMY_SIZE,
      COLOR_COMMON,
    ).setOrigin(0.5, 0.5)

    // Border outline for placeholder
    this.enemyPlaceholderBorder = this.add.rectangle(
      w * ENEMY_X_PCT, enemyY,
      ENEMY_SIZE + 4, ENEMY_SIZE + 4,
    ).setOrigin(0.5, 0.5).setStrokeStyle(2, 0xaaaaaa).setFillStyle(0x000000, 0)

    // "?" silhouette indicator
    this.enemyPlaceholderIcon = this.add.text(w * ENEMY_X_PCT, enemyY, '?', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0.6)

    this.enemyNameText = this.add.text(w * ENEMY_X_PCT, enemyY + ENEMY_SIZE / 2 + 8, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0)

    // ── Player sprite placeholder ─────────────────────────
    const playerY = this.displayH * PLAYER_Y_PCT
    if (hasTexture(this, 'player-idle')) {
      this.playerSprite = this.add.image(w * PLAYER_X_PCT, playerY, 'player-idle')
        .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
        .setDepth(5)
    } else {
      this.playerSprite = this.add.rectangle(w * PLAYER_X_PCT, playerY, PLAYER_SIZE, PLAYER_SIZE, 0x5b7ea4)
    }

    // ── Player HP bar ─────────────────────────────────────
    const playerHpY = this.displayH * PLAYER_HP_Y_PCT
    this.playerHpBarBg = this.add.rectangle(
      w / 2, playerHpY,
      PLAYER_HP_BAR_W, PLAYER_HP_BAR_H,
      COLOR_BAR_BG,
    ).setOrigin(0.5, 0.5)

    this.playerHpBarFill = this.add.rectangle(
      w / 2 - PLAYER_HP_BAR_W / 2, playerHpY,
      PLAYER_HP_BAR_W, PLAYER_HP_BAR_H,
      COLOR_HP_GREEN,
    ).setOrigin(0, 0.5)

    this.playerHpText = this.add.text(w / 2, playerHpY, `${this.currentPlayerHP} / ${this.currentPlayerMaxHP}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5)

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
      maxParticles: 50,
    })
    this.particles.setDepth(998)

    // ── Scene lifecycle events ────────────────────────────
    this.events.on('shutdown', this.onShutdown, this)
    this.events.on('sleep', this.onShutdown, this)
    this.events.on('wake', this.onWake, this)
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
    this.currentEnemyHP = hp
    this.currentEnemyMaxHP = maxHP
    this.currentEnemyId = enemyId ?? this.currentEnemyId

    // Reset enemy sprite for new encounter
    const texture = enemyTextureKey(this.currentEnemyId, 'idle')
    const hasSprite = hasTexture(this, texture)

    if (hasSprite) {
      if (!('setTexture' in this.enemySprite)) {
        this.enemySprite.destroy()
        this.enemySprite = this.add.image(this.scale.width * ENEMY_X_PCT, this.displayH * ENEMY_Y_PCT, texture)
          .setDisplaySize(ENEMY_SIZE + 26, ENEMY_SIZE + 26)
      } else {
        ;(this.enemySprite as Phaser.GameObjects.Image).setTexture(texture)
      }
    } else if ('setTexture' in this.enemySprite) {
      this.enemySprite.destroy()
      this.enemySprite = this.add.rectangle(
        this.scale.width * ENEMY_X_PCT,
        this.displayH * ENEMY_Y_PCT,
        ENEMY_SIZE,
        ENEMY_SIZE,
        categoryColor(category),
      )
    }

    if ('setFillStyle' in this.enemySprite) {
      this.enemySprite.setFillStyle(categoryColor(category))
    }

    // Show/hide placeholder border and icon based on whether real sprite exists
    const borderColor = category === 'boss' ? 0xff4444 : category === 'elite' ? 0xffd700 : 0xaaaaaa
    if (this.enemyPlaceholderBorder) {
      this.enemyPlaceholderBorder.setVisible(!hasSprite)
      this.enemyPlaceholderBorder.setStrokeStyle(2, borderColor)
      this.enemyPlaceholderBorder.setPosition(this.scale.width * ENEMY_X_PCT, this.displayH * ENEMY_Y_PCT)
    }
    if (this.enemyPlaceholderIcon) {
      this.enemyPlaceholderIcon.setVisible(!hasSprite)
      this.enemyPlaceholderIcon.setPosition(this.scale.width * ENEMY_X_PCT, this.displayH * ENEMY_Y_PCT)
    }

    this.enemySprite.setAlpha(1)
    this.enemySprite.setScale(1)
    this.enemySprite.setPosition(this.scale.width * ENEMY_X_PCT, this.displayH * ENEMY_Y_PCT)

    this.enemyNameText.setText(name)
    this.refreshEnemyHpBar(false)
  }

  /** Update enemy HP (optionally animate the bar). */
  updateEnemyHP(hp: number, animate = true): void {
    this.currentEnemyHP = Phaser.Math.Clamp(hp, 0, this.currentEnemyMaxHP)
    this.refreshEnemyHpBar(animate && !this.reduceMotion)
  }

  /** Update enemy intent telegraph. */
  setEnemyIntent(telegraph: string, value?: number): void {
    const label = value !== undefined ? `${telegraph} ${value}` : telegraph
    this.intentText.setText(label)
  }

  /** Update player HP (optionally animate the bar). */
  updatePlayerHP(hp: number, maxHP: number, animate = true): void {
    this.currentPlayerHP = Phaser.Math.Clamp(hp, 0, maxHP)
    this.currentPlayerMaxHP = maxHP
    this.refreshPlayerHpBar(animate && !this.reduceMotion)
  }

  /** Set floor and encounter counters. */
  setFloorInfo(floor: number, encounter: number, totalEncounters: number): void {
    this.currentFloor = floor
    this.currentEncounter = encounter
    this.totalEncounters = totalEncounters
    this.floorCounterText.setText(this.floorLabel())
  }

  /** Set passive relics to display in the relic tray. */
  setRelics(relics: Array<{ domain: string; label: string }>): void {
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
          this.enemySprite.setFillStyle(COLOR_COMMON)
        }
      })
    }

    const origX = this.scale.width * ENEMY_X_PCT
    if (this.reduceMotion) return
    this.tweens.add({
      targets: this.enemySprite,
      x: origX - 5,
      duration: 75,
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
    this.tweens.add({
      targets: this.enemySprite,
      y: startY + 30,
      duration: 150,
      yoyo: true,
      ease: 'Power2',
    })
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
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 500,
        ease: 'Power2',
        onComplete: () => resolve(),
      })
    })
  }

  /** Play player damage flash (red tint across display zone). */
  playPlayerDamageFlash(): void {
    if ('setTexture' in this.playerSprite && hasTexture(this, 'player-hit')) {
      ;(this.playerSprite as Phaser.GameObjects.Image).setTexture('player-hit')
      this.time.delayedCall(220, () => this.setPlayerPose('player-idle'))
    }

    if (this.reduceMotion) return

    const flash = this.add.rectangle(
      this.scale.width / 2, this.displayH / 2,
      this.scale.width, this.displayH,
      COLOR_HP_RED, 0,
    )
    this.tweens.add({
      targets: flash,
      alpha: 0.15,
      duration: 50,
      yoyo: true,
      hold: 0,
      onComplete: () => flash.destroy(),
    })
  }

  /** Play heal effect (green particles rising near player HP bar). */
  playHealEffect(): void {
    this.setPlayerPose('player-heal')
    this.time.delayedCall(260, () => this.setPlayerPose('player-idle'))

    if (this.reduceMotion) return

    const playerHpY = this.displayH * PLAYER_HP_Y_PCT
    const cx = this.scale.width / 2
    for (let i = 0; i < 8; i++) {
      const px = cx + Phaser.Math.Between(-60, 60)
      const py = playerHpY + Phaser.Math.Between(-4, 4)
      const particle = this.add.rectangle(px, py, 4, 4, COLOR_HP_GREEN)
      this.tweens.add({
        targets: particle,
        y: py - Phaser.Math.Between(20, 40),
        alpha: 0,
        duration: 200 + Phaser.Math.Between(0, 100),
        ease: 'Sine.easeOut',
        onComplete: () => particle.destroy(),
      })
    }
  }

  /** Flash the display zone white. */
  playScreenFlash(intensity: number = 0.3): void {
    if (this.reduceMotion) return
    this.flashRect.setAlpha(intensity)
    this.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: 150,
      ease: 'Power2'
    })
  }

  /** Burst particles at a position. */
  burstParticles(count: number, x: number, y: number, tint: number = 0xFFD700): void {
    if (!this.particles || this.reduceMotion) return
    this.particles.setParticleTint(tint)
    this.particles.explode(count, x, y)
  }

  /** Play a gold-tinted screen flash for perfect turn celebration. */
  playGoldFlash(): void {
    this.flashRect.setFillStyle(0xFFD700, 0.2)
    this.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.flashRect.setFillStyle(0xFFFFFF, 0)
      }
    })
  }

  playPlayerAttackAnimation(): void {
    this.setPlayerPose('player-attack')
    this.time.delayedCall(240, () => this.setPlayerPose('player-idle'))
  }

  playPlayerCastAnimation(): void {
    this.setPlayerPose('player-heal')
    this.time.delayedCall(240, () => this.setPlayerPose('player-idle'))
  }

  playPlayerBlockAnimation(): void {
    this.setPlayerPose('player-shield')
    this.time.delayedCall(240, () => this.setPlayerPose('player-idle'))
  }

  playPlayerVictoryAnimation(): void {
    this.setPlayerPose('player-victory')
  }

  playPlayerDefeatAnimation(): void {
    this.setPlayerPose('player-death')
  }

  // ═════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════

  private setPlayerPose(textureKey: string): void {
    if ('setTexture' in this.playerSprite && hasTexture(this, textureKey)) {
      ;(this.playerSprite as Phaser.GameObjects.Image).setTexture(textureKey)
    }
  }

  /** Build floor counter label. */
  private floorLabel(): string {
    return `Floor ${this.currentFloor} \u2014 Encounter ${this.currentEncounter}/${this.totalEncounters}`
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

    this.enemyHpText.setText(`${this.currentEnemyHP} / ${this.currentEnemyMaxHP}`)
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
  }

  /** Re-sync display on wake/resume. */
  private onWake(): void {
    this.reduceMotion = isReduceMotionEnabled()
    this.refreshEnemyHpBar(false)
    this.refreshPlayerHpBar(false)
    this.floorCounterText.setText(this.floorLabel())
  }
}
