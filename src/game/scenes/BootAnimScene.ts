import Phaser from 'phaser'
import type { LayoutMode } from '../../stores/layoutStore'

/**
 * BootAnimScene — Cinematic boot/splash for Recall Rogue.
 *
 * ~5.6s animation:
 *   Part 1 (0–4.8s): Stars + logo deblur, glow, title sweep, studio tag, fireflies
 *   Transition (4.8–5.6s): Logo/title/studio disintegrate, campsite fades in
 *
 * The Phaser game is created with `transparent: true` so the WebGL canvas
 * composites over the Svelte HubScreen behind it.
 *
 * Emits:
 *   'boot-anim-show-blurred' — hub should appear blurred behind canvas
 *   'boot-anim-deblur' — hub should begin unblurring
 *   'boot-anim-complete' — animation done, hide Phaser
 */
export default class BootAnimScene extends Phaser.Scene {
  private activeEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []
  private sceneSprites: Phaser.GameObjects.GameObject[] = []
  private starSprites: Phaser.GameObjects.Arc[] = []
  private coverScale = 1
  private currentLayoutMode: LayoutMode = 'portrait'

  // The visible content (logo+title+studio) spans Y=631..1326 in the 1024×1835 image.
  // Group center = (631+1326)/2 = 978.5, image center = 917.5.
  // In landscape, shift all images down by this delta so the group is screen-centered.
  private static readonly LANDSCAPE_GROUP_OFFSET = 978.5 - 917.5  // 61

  constructor() {
    super({ key: 'BootAnimScene' })
  }

  handleLayoutChange(mode: LayoutMode): void {
    this.currentLayoutMode = mode
  }

  private calcLogoScale(viewW: number, viewH: number): number {
    if (this.currentLayoutMode === 'landscape') {
      return Math.min(viewW / 1024, viewH / 1835) * 1.1
    }
    return Math.max(viewW / 1024, viewH / 1835)
  }

  preload(): void {
    const base = '/assets/boot/'
    this.load.image('boot_logo', base + 'logo.png')
    this.load.image('boot_logo_blur_medium', base + 'logo_blur_medium.png')
    this.load.image('boot_logo_blur_heavy', base + 'logo_blur_heavy.png')
    this.load.image('boot_recallrogue', base + 'recallrogue.png')
    this.load.image('boot_recallrogue_blur_medium', base + 'recallrogue_blur_medium.png')
    this.load.image('boot_recallrogue_blur_heavy', base + 'recallrogue_blur_heavy.png')
    this.load.image('boot_bramblegategames', base + 'bramblegategames.png')
    this.load.image('boot_bramblegategames_blur_medium', base + 'bramblegategames_blur_medium.png')
    this.load.image('boot_bramblegategames_blur_heavy', base + 'bramblegategames_blur_heavy.png')
  }

  create(): void {
    // Part 1 needs a black background for the starfield.
    // We use a full-screen black rectangle instead of camera bg color,
    // so the canvas stays transparent (WebGL clear = alpha 0) the entire time.
    // This lets the campsite show through in Part 2 without any camera color reset.

    const cx = this.cameras.main.centerX
    const cy = this.cameras.main.centerY
    const viewW = this.scale.width
    const viewH = this.scale.height
    // Detect layout mode from Phaser canvas dimensions since the
    // layoutMode store subscription skips its first emit
    this.currentLayoutMode = viewW > viewH ? 'landscape' : 'portrait'
    this.coverScale = this.calcLogoScale(viewW, viewH)

    // Part 1 background — black rect instead of camera bg, so canvas stays transparent
    const part1Bg = this.add.rectangle(
      this.cameras.main.centerX, this.cameras.main.centerY,
      this.scale.width * 2, this.scale.height * 2, 0x000000,
    ).setDepth(0).setAlpha(1)
    this.sceneSprites.push(part1Bg)

    // Particle texture
    const gfx = this.make.graphics({ x: 0, y: 0 })
    gfx.fillStyle(0xffffff)
    gfx.fillCircle(4, 4, 4)
    gfx.generateTexture('boot_particle', 8, 8)
    gfx.destroy()

    // Smooth filtering
    const bootKeys = [
      'boot_logo', 'boot_logo_blur_medium', 'boot_logo_blur_heavy',
      'boot_recallrogue', 'boot_recallrogue_blur_medium', 'boot_recallrogue_blur_heavy',
      'boot_bramblegategames', 'boot_bramblegategames_blur_medium', 'boot_bramblegategames_blur_heavy',
    ]
    for (const key of bootKeys) {
      const tex = this.textures.get(key)
      if (tex) tex.setFilter(Phaser.Textures.FilterMode.LINEAR)
    }

    // Tap-to-speed-up
    this.input.once('pointerdown', () => {
      this.tweens.timeScale = 3
      this.time.timeScale = 3
      for (const emitter of this.activeEmitters) {
        if (emitter?.active) emitter.timeScale = 3
      }
    })

    this.playPartOne(cx, cy)
  }

  // ═══ Part 1: Logo in the Sky (0–4.8s) ═══════════════════════════════════════

  private playPartOne(cx: number, cy: number): void {
    this.spawnStars()
    this.logoDeblur(cx, cy)
    this.time.delayedCall(1000, () => this.logoGlow(cx, cy))
    this.time.delayedCall(1600, () => this.titleSweep(cx, cy))
    this.time.delayedCall(2800, () => this.studioReveal(cx, cy))
    this.time.delayedCall(3600, () => this.startFireflies())
    this.time.delayedCall(4800, () => this.transition(cx, cy))
  }

  private spawnStars(): void {
    const W = this.scale.width
    const H = this.scale.height
    for (let i = 0; i < 40; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(10, W - 10),
        Phaser.Math.Between(10, H - 10),
        Math.random() < 0.2 ? 2 : 1,
        Math.random() < 0.3 ? 0xFFFAE0 : 0xFFFFFF,
      ).setAlpha(Math.random() * 0.3 + 0.1).setDepth(1)
      this.sceneSprites.push(star)
      this.starSprites.push(star)
      this.tweens.add({
        targets: star,
        alpha: { from: 0.1 + Math.random() * 0.15, to: 0.5 + Math.random() * 0.35 },
        duration: Phaser.Math.Between(1000, 3000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
      })
    }
  }

  private logoDeblur(cx: number, cy: number): void {
    const s = this.coverScale
    const logoY = this.getLogoY(cy)
    const heavy = this.add.image(cx, logoY, 'boot_logo_blur_heavy').setScale(s).setDepth(100).setAlpha(0)
    const medium = this.add.image(cx, logoY, 'boot_logo_blur_medium').setScale(s).setDepth(100).setAlpha(0)
    const sharp = this.add.image(cx, logoY, 'boot_logo').setScale(s).setDepth(100).setAlpha(0)
    this.sceneSprites.push(heavy, medium, sharp)
    this.tweens.add({ targets: heavy, alpha: 1, duration: 800 })
    this.time.delayedCall(400, () => {
      this.tweens.add({ targets: heavy, alpha: 0, duration: 300 })
      this.tweens.add({ targets: medium, alpha: 1, duration: 300 })
    })
    this.time.delayedCall(700, () => {
      this.tweens.add({ targets: medium, alpha: 0, duration: 300 })
      this.tweens.add({ targets: sharp, alpha: 1, duration: 300 })
    })
  }

  private logoGlow(cx: number, cy: number): void {
    const logoY = this.getLogoY(cy)
    const glow = this.add.image(cx, logoY, 'boot_logo')
      .setScale(this.coverScale).setDepth(101).setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xFFE4A0)
    this.sceneSprites.push(glow)
    this.tweens.add({
      targets: glow, alpha: 0.6, duration: 200,
      onComplete: () => {
        this.tweens.add({ targets: glow, alpha: 0, duration: 400, onComplete: () => glow.destroy() })
      },
    })
    this.time.delayedCall(200, () => this.sparkBurst(cx, logoY, 4, 0xFFE4A0))
  }

  private titleSweep(cx: number, cy: number): void {
    const s = this.coverScale
    const titleY = this.getLogoY(cy)
    const startX = cx - 150
    const medium = this.add.image(startX, titleY, 'boot_recallrogue_blur_medium').setScale(s).setDepth(101).setAlpha(0)
    const sharp = this.add.image(startX, titleY, 'boot_recallrogue').setScale(s).setDepth(101).setAlpha(0)
    this.sceneSprites.push(medium, sharp)
    this.tweens.add({ targets: medium, x: cx, alpha: 1, duration: 400, ease: 'Cubic.easeOut' })
    this.time.delayedCall(200, () => {
      this.tweens.add({ targets: medium, alpha: 0, duration: 300 })
      this.tweens.add({ targets: sharp, x: { from: medium.x, to: cx }, alpha: 1, duration: 400, ease: 'Cubic.easeOut' })
    })
    let elapsed = 0
    const dur = 600
    const trail = this.time.addEvent({
      delay: 33, repeat: Math.floor(dur / 33),
      callback: () => {
        elapsed += 33
        const textHalfW = (1024 * s) / 2
        const progress = Math.min(elapsed / dur, 1)
        const px = startX + (cx - startX) * progress + textHalfW * 0.6
        const emitter = this.add.particles(px, titleY, 'boot_particle', {
          speed: { min: 50, max: 120 }, angle: { min: -30, max: 30 },
          gravityY: 80, scale: { start: 0.3, end: 0 }, lifespan: 400,
          tint: 0xFFD700, quantity: 1, frequency: -1,
        }).setDepth(102)
        emitter.explode(1, px, titleY)
        this.activeEmitters.push(emitter)
        this.sceneSprites.push(emitter)
        this.time.delayedCall(500, () => { if (emitter?.active) emitter.destroy() })
      },
    })
    this.time.delayedCall(dur, () => {
      trail.remove(false)
      for (let i = 0; i < 4; i++) {
        this.time.delayedCall(i * 50, () => this.sparkBurst(cx + Phaser.Math.Between(-40, 40), titleY, 2, 0xFFD700))
      }
    })
  }

  private studioReveal(cx: number, cy: number): void {
    const s = this.coverScale
    const studioY = this.getLogoY(cy)
    const heavy = this.add.image(cx, studioY, 'boot_bramblegategames_blur_heavy').setScale(s).setDepth(102).setAlpha(0)
    const sharp = this.add.image(cx, studioY, 'boot_bramblegategames').setScale(s).setDepth(102).setAlpha(0)
    this.sceneSprites.push(heavy, sharp)
    this.tweens.add({ targets: heavy, alpha: 1, duration: 400 })
    this.time.delayedCall(400, () => {
      this.tweens.add({ targets: heavy, alpha: 0, duration: 400 })
      this.tweens.add({ targets: sharp, alpha: 1, duration: 400 })
    })
  }

  private startFireflies(): void {
    const W = this.scale.width
    const H = this.scale.height
    const spawnFirefly = (): void => {
      if (!this.scene.isActive('BootAnimScene')) return
      const dot = this.add.circle(
        Phaser.Math.Between(20, W - 20),
        Phaser.Math.Between(100, Math.floor(H * 0.65)),
        2 + Math.random() * 2, 0xFFF5CC,
      ).setAlpha(0).setDepth(103)
      this.sceneSprites.push(dot)
      const peak = 0.3 + Math.random() * 0.4
      this.tweens.add({
        targets: dot, alpha: peak, duration: 800, ease: 'Sine.easeIn',
        onComplete: () => {
          this.tweens.add({
            targets: dot, alpha: 0, duration: 1200, ease: 'Sine.easeOut',
            onComplete: () => { if (dot.active) dot.destroy() },
          })
        },
      })
    }
    this.time.addEvent({ delay: 300, repeat: 30, callback: spawnFirefly })
  }

  // ═══ Transition: Sky → Cave (4.8–5.6s) ═══════════════════════════════════════

  private transition(cx: number, cy: number): void {
    // 1) Kill ALL existing tweens
    this.tweens.killAll()

    // 2) DESTROY all stars immediately
    for (const star of this.starSprites) {
      if (star.active) star.destroy()
    }
    this.starSprites = []

    // 2b) Destroy Part 1 background rectangle (depth 0)
    const part1Bgs = this.sceneSprites.filter(obj => {
      const d = (obj as Phaser.GameObjects.Rectangle).depth
      return d === 0 && obj.active
    })
    for (const bg of part1Bgs) { if (bg.active) bg.destroy() }

    // 3) Logo/title/studio disintegrate
    const logoTargets = this.sceneSprites.filter(obj => {
      const d = (obj as Phaser.GameObjects.Image).depth
      return d >= 100 && d <= 102 && obj.active
    })
    for (const t of logoTargets) {
      const img = t as Phaser.GameObjects.Image
      this.tweens.add({
        targets: img, alpha: 0,
        y: img.y - 60,
        scaleX: img.scaleX * 1.03, scaleY: img.scaleY * 1.03,
        duration: 600, ease: 'Quad.easeIn',
        onComplete: () => { if (img.active) img.destroy() },
      })
    }
    const logoY = this.getLogoY(cy)
    for (let i = 0; i < 25; i++) {
      this.time.delayedCall(i * 20, () => {
        const px = cx + Phaser.Math.Between(-180, 180)
        const py = logoY + Phaser.Math.Between(-100, 60)
        const emitter = this.add.particles(px, py, 'boot_particle', {
          speed: { min: 30, max: 90 },
          angle: { min: 220, max: 320 },
          gravityY: -20,
          scale: { start: 0.5, end: 0 },
          lifespan: { min: 400, max: 800 },
          tint: [0xFFFFFF, 0xFFF5CC, 0xFFE4A0],
          quantity: 1, frequency: -1,
        }).setDepth(104)
        emitter.explode(1, px, py)
        this.activeEmitters.push(emitter)
        this.sceneSprites.push(emitter)
        this.time.delayedCall(900, () => { if (emitter?.active) emitter.destroy() })
      })
    }

    // 4) Kill fireflies and emitters
    for (const emitter of this.activeEmitters) {
      if (emitter?.active) { emitter.stop(); emitter.destroy() }
    }
    this.activeEmitters = []
    const fireflies = this.sceneSprites.filter(obj =>
      (obj as Phaser.GameObjects.Arc).depth === 103 && obj.active,
    )
    for (const ff of fireflies) { if (ff.active) ff.destroy() }

    // 5) Signal hub to show blurred campsite BEHIND the canvas
    this.game.events.emit('boot-anim-show-blurred')

    // 6) Deblur campsite and complete after disintegration settles
    this.time.delayedCall(400, () => {
      this.game.events.emit('boot-anim-deblur')
    })
    this.time.delayedCall(800, () => {
      this.complete()
    })
  }

  private complete(): void {
    this.game.events.emit('boot-anim-complete')
    this.time.delayedCall(200, () => {
      for (const emitter of this.activeEmitters) {
        if (emitter?.active) { emitter.stop(); emitter.destroy() }
      }
      this.activeEmitters = []
      for (const obj of this.sceneSprites) { if (obj?.active) obj.destroy() }
      this.sceneSprites = []
      this.starSprites = []
      if (this.textures.exists('boot_particle')) this.textures.remove('boot_particle')
      this.scene.sleep()
    })
  }

  // ═══ Helpers ════════════════════════════════════════════════════════════════

  /**
   * Returns the corrected Y position for a boot image in landscape mode.
   * All three boot images share the same 1024×1835 canvas, so applying the same
   * uniform offset to every image preserves their relative positions while
   * shifting the group center to screen center.
   *
   * @param cy - Screen centre Y
   */
  private getLogoY(cy: number): number {
    if (this.currentLayoutMode !== 'landscape') return cy
    return cy + BootAnimScene.LANDSCAPE_GROUP_OFFSET * this.coverScale
  }

  private sparkBurst(x: number, y: number, count: number, tint: number): void {
    const emitter = this.add.particles(x, y, 'boot_particle', {
      speed: { min: 40, max: 100 }, angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 }, lifespan: 500,
      tint, quantity: count, frequency: -1,
    }).setDepth(105)
    emitter.explode(count, x, y)
    this.activeEmitters.push(emitter)
    this.sceneSprites.push(emitter)
    this.time.delayedCall(600, () => { if (emitter?.active) emitter.destroy() })
  }

  shutdown(): void {
    this.tweens.killAll()
    this.time.removeAllEvents()
    for (const emitter of this.activeEmitters) { if (emitter?.active) emitter.destroy() }
    this.activeEmitters = []
    for (const obj of this.sceneSprites) { if (obj?.active) obj.destroy() }
    this.sceneSprites = []
    this.starSprites = []
  }
}
