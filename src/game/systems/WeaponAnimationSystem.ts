import Phaser from 'phaser'
import { isTurboMode } from '../../utils/turboMode'

/** Depth layer for weapon sprites — above most VFX but below screen flash. */
const WEAPON_DEPTH = 996

/** Base viewport width used for scaling calculations. */
const BASE_WIDTH = 390

function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
  } catch {
    return false
  }
}

/**
 * WeaponAnimationSystem manages sword slash, tome cast, and shield raise animations
 * for the combat scene. Sprites are loaded once and reused across plays.
 *
 * All sprites start at alpha=0 (hidden at rest). They fade in at the start of each
 * animation and fade back to alpha=0 when done. A gradient overlay at the bottom
 * of the display zone softens the edge where sprites emerge.
 */
export class WeaponAnimationSystem {
  private scene: Phaser.Scene

  // Sword: dynamic canvas texture for perspective effect
  private swordCanvas: Phaser.Textures.CanvasTexture | null = null
  private swordImage: Phaser.GameObjects.Image | null = null
  private swordBaseScale = 0

  // Arm + Tome sprites in a container
  private armTomeContainer: Phaser.GameObjects.Container | null = null
  private armSprite: Phaser.GameObjects.Image | null = null
  private tomeSprite: Phaser.GameObjects.Image | null = null
  private tomeGlow: Phaser.GameObjects.Image | null = null

  // Shield sprite
  private shieldSprite: Phaser.GameObjects.Image | null = null

  /** Height of the visible combat zone (above the Svelte overlay). */
  private displayH = 0

  /** Bitmap masks for bottom-fade on tome and shield sprites. */
  private tomeMaskImage: Phaser.GameObjects.Image | null = null
  private shieldMaskImage: Phaser.GameObjects.Image | null = null

  /**
   * Create a new WeaponAnimationSystem.
   * @param scene The Phaser scene to render into
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Load weapon assets. Must be called in scene preload().
   */
  public preloadAssets(): void {
    console.log('[WeaponAnim] preloadAssets called')
    // Force-remove any stale cached textures (webp→png migration)
    const keys = ['weapon-sword', 'weapon-arm', 'weapon-tome', 'weapon-shield'] as const
    for (const key of keys) {
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key)
      }
    }
    this.scene.load.image('weapon-sword', 'assets/sprites/weapons/sword.png')
    this.scene.load.image('weapon-arm', 'assets/sprites/weapons/arm.png')
    this.scene.load.image('weapon-tome', 'assets/sprites/weapons/tome.png')
    this.scene.load.image('weapon-shield', 'assets/sprites/weapons/shield.png')
    console.log('[WeaponAnim] 4 weapon textures queued for load')
  }

  /**
   * Create sprite objects. Must be called in scene create() after preload completes.
   * @param displayH Height of the visible combat zone (above the Svelte overlay)
   */
  public createSprites(displayH: number): void {
    this.displayH = displayH
    const w = this.scene.scale.width
    const scale = w / BASE_WIDTH
    const hasSword = this.scene.textures.exists('weapon-sword')
    const hasArm = this.scene.textures.exists('weapon-arm')
    const hasTome = this.scene.textures.exists('weapon-tome')
    const hasShield = this.scene.textures.exists('weapon-shield')
    console.log('[WeaponAnim] createSprites — displayH:', displayH, 'w:', w, 'scale:', scale)
    console.log('[WeaponAnim] textures loaded:', { hasSword, hasArm, hasTome, hasShield })

    // ── Sword: perspective canvas ────────────────────────────
    // We'll draw the sword onto a CanvasTexture with per-row width taper
    // to simulate 3D perspective (handle wider/closer, tip narrower/farther).
    // Canvas size matches the desired display size.
    const swordDisplayW = Math.round(250 * scale)  // wide enough for tapered handle
    const swordDisplayH = Math.round(500 * scale)  // display height of the sword

    // Remove stale canvas if it exists from a previous scene cycle
    if (this.scene.textures.exists('weapon-sword-canvas')) {
      this.scene.textures.remove('weapon-sword-canvas')
    }
    this.swordCanvas = this.scene.textures.createCanvas('weapon-sword-canvas', swordDisplayW, swordDisplayH)!
    this.swordBaseScale = scale

    // Draw the sword flat initially (no perspective)
    this.redrawSwordPerspective(0)

    this.swordImage = this.scene.add.image(-999, -999, 'weapon-sword-canvas')
      .setAlpha(0)
      .setDepth(WEAPON_DEPTH)
      .setOrigin(0.5, 1.0) // pivot at handle (bottom)

    // ── Arm + Tome container ──────────────────────────────
    // arm.webp is 1136x973, tome.webp is 1300x929
    // Large first-person feel: ~350px wide at base 390 width
    const armTargetW = 350 * scale
    const armNativeW = 1136
    const armScale = armTargetW / armNativeW

    const tomeNativeW = 1300
    const tomeScale = armTargetW / tomeNativeW

    // Rest position: well below displayH, alpha=0 so fully invisible
    this.armTomeContainer = this.scene.add.container(w * 0.75, displayH + 250 * scale)
      .setDepth(WEAPON_DEPTH)
      .setAlpha(0)  // HIDDEN at rest

    // Arm at the bottom of the container (sleeve/hand extending downward)
    this.armSprite = this.scene.add.image(0, 40 * scale, 'weapon-arm').setScale(armScale)
    // Tome above the arm (held by the hand), with glow behind it
    this.tomeGlow = this.scene.add.image(0, -60 * scale, 'weapon-tome')
      .setScale(tomeScale * 1.08)
      .setAlpha(0)
    this.tomeSprite = this.scene.add.image(0, -60 * scale, 'weapon-tome').setScale(tomeScale)

    // Order: glow behind tome, tome on top of arm
    this.armTomeContainer.add([this.armSprite, this.tomeGlow, this.tomeSprite])

    // ── Shield sprite ─────────────────────────────────────
    // shield.png is 1400x1897 — large first-person feel: ~280px wide at base 390 width
    const shieldTargetW = 280 * scale
    const shieldNativeW = 1400
    const shieldScale = shieldTargetW / shieldNativeW

    // Rest position: well below displayH, alpha=0 so fully invisible
    this.shieldSprite = this.scene.add.image(w * 0.25, displayH + 300 * scale, 'weapon-shield')
      .setScale(shieldScale)
      .setAlpha(0)  // HIDDEN at rest
      .setDepth(WEAPON_DEPTH)

    // ── Bottom-fade bitmap masks ──────────────────────────
    // Create gradient textures where the bottom 10% fades from white→black.
    // When used as a BitmapMask, white=visible, black=hidden.
    // This makes the bottom of the arm/shield sprites smoothly fade to transparent.
    this.applyBottomFadeMask(this.armTomeContainer, 'weapon-fade-tome', armTargetW * 1.5, 600 * scale)
    this.applyBottomFadeMask(this.shieldSprite, 'weapon-fade-shield', shieldTargetW * 1.5, 600 * scale)
  }

  /**
   * Redraw the sword canvas texture with perspective taper and 3D edge depth.
   * @param amount 0 = flat (no perspective), 1 = full perspective (handle wide, tip narrow)
   */
  private redrawSwordPerspective(amount: number): void {
    if (!this.swordCanvas) return
    const canvas = this.swordCanvas
    const ctx = canvas.getContext()
    const cw = canvas.width
    const ch = canvas.height

    ctx.clearRect(0, 0, cw, ch)

    const srcTexture = this.scene.textures.get('weapon-sword')
    if (!srcTexture || srcTexture.key === '__MISSING') return
    const srcImg = srcTexture.getSourceImage() as HTMLImageElement | HTMLCanvasElement
    const srcW = srcImg.width
    const srcH = srcImg.height

    // ═══════════════════════════════════════════════════════════
    // Minecraft-style forward chop perspective.
    //
    // The tip of the blade goes INTO THE SCREEN (forward, away from viewer).
    // This is simulated by compressing the VERTICAL spacing of the tip rows
    // while keeping the handle rows at full spacing. The blade appears to
    // shorten as the tip recedes into depth. A dark bar at the top simulates
    // the blade's edge now visible from above.
    //
    // NOT a width taper — the blade face stays roughly the same width
    // because we're still looking at the front face, just at a forward angle.
    // ═══════════════════════════════════════════════════════════

    const slices = 60

    // Map source row t (0=tip, 1=handle) to destination Y position.
    // At amount=0: linear (flat, no perspective).
    // At amount=1: tip rows are packed together near the top, handle rows
    // have full spacing. The blade looks shorter because the tip has receded.
    const getDestY = (t: number): number => {
      // Power curve: exponent > 1 compresses the tip (small t → even smaller)
      // while giving the handle (large t) full spacing — correct foreshortening
      const perspT = Math.pow(t, 2.5)
      const mappedT = t + (perspT - t) * amount

      // The rendered sword also gets shorter overall as the tip goes into depth.
      // At amount=1, the total rendered height is ~55% of full height.
      const totalH = ch * (1 - amount * 0.45)
      // Anchor at the bottom (handle stays put), compress from top
      const handleY = ch
      return handleY - totalH + mappedT * totalH
    }

    // Slight width variation: handle a bit wider (closer), tip a bit narrower (farther)
    // Keep it subtle — the main 3D sell is the vertical compression
    const getSliceW = (t: number): number => {
      const flat = 0.55
      const persp = 0.42 + t * 0.2  // tip: 0.42, handle: 0.62
      return (flat + (persp - flat) * amount) * cw
    }

    // ── Blade with vertical foreshortening (clean, no edge artifacts) ──
    for (let i = 0; i < slices; i++) {
      const t = i / (slices - 1)  // 0=tip, 1=handle

      const sliceW = getSliceW(t)
      const srcY = Math.floor((i / slices) * srcH)
      const srcSliceH = Math.ceil(srcH / slices) + 1

      const destY0 = getDestY(i / slices)
      const destY1 = getDestY((i + 1) / slices)
      const destSliceH = Math.max(1, Math.ceil(destY1 - destY0))

      const destX = (cw - sliceW) / 2
      ctx.drawImage(srcImg, 0, srcY, srcW, srcSliceH, destX, destY0, sliceW, destSliceH)
    }

    canvas.refresh()
  }

  /** Create a gradient texture and apply it as a BitmapMask to a game object.
   * The mask is fully white (visible) for the top 90% and fades to black (hidden) at the bottom 10%. */
  private applyBottomFadeMask(
    target: Phaser.GameObjects.Container | Phaser.GameObjects.Image,
    textureKey: string,
    maskW: number,
    maskH: number,
  ): void {
    // Create a canvas texture for the gradient mask
    const canvasTexture = this.scene.textures.createCanvas(textureKey, Math.ceil(maskW), Math.ceil(maskH))
    if (!canvasTexture) return
    const ctx = canvasTexture.getContext()

    // Top 90%: fully white (visible)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, maskW, maskH * 0.9)

    // Bottom 10%: gradient from white to black (visible to hidden)
    const gradientTop = maskH * 0.9
    const gradientH = maskH * 0.1
    const gradient = ctx.createLinearGradient(0, gradientTop, 0, maskH)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(1, '#000000')
    ctx.fillStyle = gradient
    ctx.fillRect(0, gradientTop, maskW, gradientH)

    canvasTexture.refresh()

    // Create an image from this texture — the mask image must track the target's position
    // We'll position it in the animation methods instead
    const maskImage = this.scene.add.image(0, 0, textureKey)
      .setOrigin(0.5, 0.5)
      .setVisible(false) // mask images don't need to be visible

    target.setMask(new Phaser.Display.Masks.BitmapMask(this.scene, maskImage))

    // Store references for positioning updates and cleanup
    if (textureKey.includes('tome')) {
      this.tomeMaskImage = maskImage
    } else {
      this.shieldMaskImage = maskImage
    }
  }

  /**
   * Pseudo-3D Minecraft-style sword slash with perspective taper.
   * The sword starts flat (facing the viewer), then rotates while the perspective
   * increases — the handle stays wide/close while the tip narrows/recedes.
   */
  public playSwordSlash(enemyX: number, enemyY: number): Promise<void> {
    console.log('[WeaponAnim] Sword slash fired at', enemyX, enemyY)
    if (isReduceMotionEnabled() || isTurboMode()) return Promise.resolve()
    if (!this.swordImage || !this.swordCanvas) return Promise.resolve()

    return new Promise<void>(resolve => {
      const scene = this.scene
      const w = scene.scale.width
      const scale = w / BASE_WIDTH
      const sword = this.swordImage!

      // Handle position: right side of the combat zone
      const handleX = w * 0.7
      const handleY = this.displayH * 0.88

      // Start: upright, flat (no perspective), facing the viewer
      sword
        .setPosition(handleX, handleY)
        .setAngle(0)
        .setScale(1)  // canvas is already at display size
        .setAlpha(0)
        .setOrigin(0.5, 1.0)

      // Draw flat sword initially
      this.redrawSwordPerspective(0)
      sword.setTexture('weapon-sword-canvas')

      // Fade in quickly
      scene.tweens.add({ targets: sword, alpha: 1, duration: 40 })

      // Animate a custom "perspective" property from 0 to 1
      const animState = { perspective: 0, rotation: 0, yOffset: 0 }

      // ── SLASH TWEEN (250ms) ──
      scene.tweens.add({
        targets: animState,
        perspective: 1,    // 0 → 1: flat → full forward foreshortening
        rotation: -25,     // slight forward tilt (not too sideways — the 3D is in the perspective)
        yOffset: 20,       // subtle push down (the tip going forward is the main motion)
        duration: 250,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          // Redraw the sword canvas with current perspective amount
          this.redrawSwordPerspective(animState.perspective)
          sword.setTexture('weapon-sword-canvas')

          // Apply rotation and position
          sword.setAngle(animState.rotation)
          sword.setY(handleY + animState.yOffset * scale)
        },
        onComplete: () => {
          // ── IMPACT ──
          scene.cameras.main.shake(90, 0.004, true)

          // ── FADE OUT (150ms) ──
          scene.tweens.add({
            targets: sword,
            alpha: 0,
            duration: 150,
            ease: 'Sine.easeIn',
            onComplete: () => {
              sword.setPosition(-999, -999).setAlpha(0).setAngle(0)
              this.redrawSwordPerspective(0)
              resolve()
            },
          })
        },
      })
    })
  }

  /**
   * Play the tome cast animation with a colored glow burst.
   * The arm+tome rises from lower-right, glows, then drops back down.
   * Sprite starts and ends at alpha=0 — fades in at rise start, fades out during drop.
   * @param glowColor Phaser tint color number for the glow and particles
   * @returns Promise that resolves when the animation completes
   */
  public playTomeCast(glowColor: number): Promise<void> {
    console.log('[WeaponAnim] Tome cast fired, color:', glowColor.toString(16))
    if (isReduceMotionEnabled() || isTurboMode()) return Promise.resolve()
    if (!this.armTomeContainer || !this.tomeSprite || !this.tomeGlow) return Promise.resolve()

    return new Promise<void>(resolve => {
      const scene = this.scene
      const w = scene.scale.width
      const scale = w / BASE_WIDTH

      const container = this.armTomeContainer!
      const tomeGlow = this.tomeGlow!

      // First-person arm raise: slides vertically only
      // Start: well below displayH, alpha=0 (hidden)
      const startX = w * 0.75
      const startY = this.displayH + 250 * scale

      // Peak: tome rises into visible area, arm remains mostly below edge
      const peakX = w * 0.75
      const peakY = this.displayH * 0.55

      container.setPosition(startX, startY).setAlpha(0)
      tomeGlow.setAlpha(0).setTint(glowColor)

      // Sync the bitmap mask to follow the container
      if (this.tomeMaskImage) {
        this.tomeMaskImage.setPosition(startX, startY)
      }

      // Quick fade in at the very start of the rise
      scene.tweens.add({
        targets: container,
        alpha: 1,
        duration: 80,
      })

      const tomeMask = this.tomeMaskImage

      // Phase 1: Rise straight up (~250ms), Back.easeOut for natural arm-raise weight
      scene.tweens.add({
        targets: container,
        x: peakX,
        y: peakY,
        duration: 250,
        ease: 'Back.easeOut',
        onUpdate: () => { if (tomeMask) tomeMask.setPosition(container.x, container.y) },
        onComplete: () => {
          // ── Glow burst at peak ────────────────────────────
          scene.tweens.add({
            targets: tomeGlow,
            alpha: 0.7,
            scaleX: tomeGlow.scaleX * 1.15,
            scaleY: tomeGlow.scaleY * 1.15,
            duration: 80,
            yoyo: true,
            onComplete: () => {
              tomeGlow.setAlpha(0)
            },
          })

          // Radial pulse ring
          this.spawnRadialPulse(peakX, peakY, glowColor, scale)

          // Burst particles upward from the tome
          this.spawnTomeParticles(peakX, peakY - 20 * scale, glowColor, scale)

          // Hold at peak, then drop back down
          scene.time.delayedCall(200, () => {
            // Phase 2: Drop back down (~200ms), fades out as it slides back below screen edge
            scene.tweens.add({
              targets: container,
              x: startX,
              y: startY,
              alpha: 0,
              duration: 200,
              ease: 'Sine.easeIn',
              onUpdate: () => { if (tomeMask) tomeMask.setPosition(container.x, container.y) },
              onComplete: () => {
                container.setPosition(startX, startY).setAlpha(0)
                if (tomeMask) tomeMask.setPosition(startX, startY)
                resolve()
              },
            })
          })
        },
      })
    })
  }

  /**
   * Play shield raise animation — shield rises from bottom-left with a protective pulse.
   * Sprite starts and ends at alpha=0 — fades in at rise start, fades out during drop.
   * @returns Promise that resolves when animation completes
   */
  public playShieldRaise(): Promise<void> {
    console.log('[WeaponAnim] Shield raise fired')
    if (isReduceMotionEnabled() || isTurboMode()) return Promise.resolve()
    if (!this.shieldSprite) return Promise.resolve()

    return new Promise<void>(resolve => {
      const scene = this.scene
      const w = scene.scale.width
      const scale = w / BASE_WIDTH

      const shield = this.shieldSprite!

      // First-person shield raise: slides vertically only
      // Start: well below displayH, alpha=0 (hidden)
      const startX = w * 0.25
      const startY = this.displayH + 300 * scale

      // Peak: shield rises into visible area, grip/hand remains mostly below edge
      const peakX = w * 0.25
      const peakY = this.displayH * 0.55

      shield.setPosition(startX, startY).setAlpha(0)

      // Sync the bitmap mask to follow the shield
      if (this.shieldMaskImage) {
        this.shieldMaskImage.setPosition(startX, startY)
      }

      // Quick fade in at the very start of the rise
      scene.tweens.add({
        targets: shield,
        alpha: 1,
        duration: 80,
      })

      const shieldMask = this.shieldMaskImage

      // Phase 1: Rise straight up (200ms, Back.easeOut for satisfying "thunk")
      scene.tweens.add({
        targets: shield,
        x: peakX,
        y: peakY,
        duration: 200,
        ease: 'Back.easeOut',
        onUpdate: () => { if (shieldMask) shieldMask.setPosition(shield.x, shield.y) },
        onComplete: () => {
          // Brief white flash: tint white for 60ms then clear
          shield.setTint(0xffffff)
          scene.time.delayedCall(60, () => {
            shield.clearTint()
          })

          // Radial blue pulse ring
          this.spawnRadialPulse(peakX, peakY, 0x3498db, scale)

          // Blue-white particle burst from shield center
          this.spawnTomeParticles(peakX, peakY, 0x8fbfff, scale)

          // Camera shake — lighter than sword, more of a "clank" feel
          scene.cameras.main.shake(60, 0.002, true)

          // Hold at peak (180ms), then drop back down with fade out
          scene.time.delayedCall(180, () => {
            // Phase 2: Drop back down (200ms), fades out as it slides back below screen edge
            scene.tweens.add({
              targets: shield,
              x: startX,
              y: startY,
              alpha: 0,
              duration: 200,
              ease: 'Sine.easeIn',
              onUpdate: () => { if (shieldMask) shieldMask.setPosition(shield.x, shield.y) },
              onComplete: () => {
                shield.setPosition(startX, startY).setAlpha(0)
                if (shieldMask) shieldMask.setPosition(startX, startY)
                resolve()
              },
            })
          })
        },
      })
    })
  }

  /** Spawn a radial pulse ring that expands from a point and fades. */
  private spawnRadialPulse(x: number, y: number, color: number, scale: number): void {
    const gfx = this.scene.add.graphics().setDepth(WEAPON_DEPTH + 1)
    gfx.lineStyle(2, color, 0.8)
    gfx.strokeCircle(0, 0, 10)
    gfx.setPosition(x, y)

    this.scene.tweens.add({
      targets: gfx,
      scaleX: 4 * scale,
      scaleY: 4 * scale,
      alpha: 0,
      duration: 250,
      ease: 'Sine.easeOut',
      onComplete: () => gfx.destroy(),
    })
  }

  /** Spawn small particle rectangles that burst upward from the tome. */
  private spawnTomeParticles(x: number, y: number, color: number, scale: number): void {
    const count = 12
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8
      const speed = (40 + Math.random() * 40) * scale
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed

      const size = (4 + Math.random() * 6) * scale
      const rect = this.scene.add.rectangle(x, y, size, size, color, 0.9)
        .setDepth(WEAPON_DEPTH + 1)

      this.scene.tweens.add({
        targets: rect,
        x: x + vx * 0.5,
        y: y + vy * 0.5,
        alpha: 0,
        duration: 300 + Math.random() * 150,
        ease: 'Quad.easeOut',
        onComplete: () => rect.destroy(),
      })
    }
  }

  /**
   * Clean up all weapon sprites and resources.
   */
  public destroy(): void {
    this.swordImage?.destroy()
    this.swordImage = null
    if (this.scene.textures.exists('weapon-sword-canvas')) {
      this.scene.textures.remove('weapon-sword-canvas')
    }
    this.swordCanvas = null
    this.armSprite?.destroy()
    this.armSprite = null
    this.tomeSprite?.destroy()
    this.tomeSprite = null
    this.tomeGlow?.destroy()
    this.tomeGlow = null
    this.armTomeContainer?.destroy()
    this.armTomeContainer = null
    this.shieldSprite?.destroy()
    this.shieldSprite = null
    this.tomeMaskImage?.destroy()
    this.tomeMaskImage = null
    this.shieldMaskImage?.destroy()
    this.shieldMaskImage = null
    // Clean up mask canvas textures
    if (this.scene.textures.exists('weapon-fade-tome')) this.scene.textures.remove('weapon-fade-tome')
    if (this.scene.textures.exists('weapon-fade-shield')) this.scene.textures.remove('weapon-fade-shield')
  }
}
