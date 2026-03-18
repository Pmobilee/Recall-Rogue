import Phaser from 'phaser'
import type { LayoutMode } from '../../stores/layoutStore'

/**
 * BootAnimScene — Cinematic boot/splash for Recall Rogue.
 *
 * ~12s animation:
 *   Part 1 (0–4.8s): Stars + logo deblur, glow, title sweep, studio tag, fireflies
 *   Transition (4.8–5.6s): Logo/title/studio disintegrate, stars destroyed
 *   Part 2 (5.6–~12s): 8-ring cave descent with 3D perspective stretch,
 *     decelerating freefall, campsite revealed through ring holes via ADD blending
 *
 * Ring assets are 1024×1024 with pure black backgrounds.
 * Using ADD blend mode, black = invisible, rock detail glows additively.
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

  // Ring display order: surface → deep → void then library (swapped 7↔8)
  // File names stay as generated, but display order is swapped.
  private static readonly RING_FILES = [
    'cave_ring_1_entrance', 'cave_ring_2_roots', 'cave_ring_3_stalactite',
    'cave_ring_4_crystal', 'cave_ring_5_magma', 'cave_ring_6_runes',
    'cave_ring_8_void', 'cave_ring_7_library',
  ] as const

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
    for (let i = 0; i < BootAnimScene.RING_FILES.length; i++) {
      this.load.image(`boot_cave_ring_${i + 1}`, base + BootAnimScene.RING_FILES[i] + '.png')
    }
  }

  create(): void {
    // Part 1 needs a black background for the starfield.
    // We use a full-screen black rectangle instead of camera bg color,
    // so we can fade it out independently during Part 2.
    this.cameras.main.setBackgroundColor(0x000000)

    const cx = this.cameras.main.centerX
    const cy = this.cameras.main.centerY
    const viewW = this.scale.width
    const viewH = this.scale.height
    this.coverScale = this.calcLogoScale(viewW, viewH)

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
      ...Array.from({ length: 8 }, (_, i) => `boot_cave_ring_${i + 1}`),
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
    const heavy = this.add.image(cx, cy, 'boot_logo_blur_heavy').setScale(s).setDepth(100).setAlpha(0)
    const medium = this.add.image(cx, cy, 'boot_logo_blur_medium').setScale(s).setDepth(100).setAlpha(0)
    const sharp = this.add.image(cx, cy, 'boot_logo').setScale(s).setDepth(100).setAlpha(0)
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
    const glow = this.add.image(cx, cy, 'boot_logo')
      .setScale(this.coverScale).setDepth(101).setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xFFE4A0)
    this.sceneSprites.push(glow)
    this.tweens.add({
      targets: glow, alpha: 0.6, duration: 200,
      onComplete: () => {
        this.tweens.add({ targets: glow, alpha: 0, duration: 400, onComplete: () => glow.destroy() })
      },
    })
    this.time.delayedCall(200, () => this.sparkBurst(cx, cy, 4, 0xFFE4A0))
  }

  private titleSweep(cx: number, cy: number): void {
    const s = this.coverScale
    const startX = cx - 150
    const medium = this.add.image(startX, cy, 'boot_recallrogue_blur_medium').setScale(s).setDepth(101).setAlpha(0)
    const sharp = this.add.image(startX, cy, 'boot_recallrogue').setScale(s).setDepth(101).setAlpha(0)
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
        const emitter = this.add.particles(px, cy, 'boot_particle', {
          speed: { min: 50, max: 120 }, angle: { min: -30, max: 30 },
          gravityY: 80, scale: { start: 0.3, end: 0 }, lifespan: 400,
          tint: 0xFFD700, quantity: 1, frequency: -1,
        }).setDepth(102)
        emitter.explode(1, px, cy)
        this.activeEmitters.push(emitter)
        this.sceneSprites.push(emitter)
        this.time.delayedCall(500, () => { if (emitter?.active) emitter.destroy() })
      },
    })
    this.time.delayedCall(dur, () => {
      trail.remove(false)
      for (let i = 0; i < 4; i++) {
        this.time.delayedCall(i * 50, () => this.sparkBurst(cx + Phaser.Math.Between(-40, 40), cy, 2, 0xFFD700))
      }
    })
  }

  private studioReveal(cx: number, cy: number): void {
    const s = this.coverScale
    const heavy = this.add.image(cx, cy, 'boot_bramblegategames_blur_heavy').setScale(s).setDepth(102).setAlpha(0)
    const sharp = this.add.image(cx, cy, 'boot_bramblegategames').setScale(s).setDepth(102).setAlpha(0)
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
    for (let i = 0; i < 25; i++) {
      this.time.delayedCall(i * 20, () => {
        const px = cx + Phaser.Math.Between(-180, 180)
        const py = cy + Phaser.Math.Between(-100, 60)
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

    // 6) Start descent after disintegration
    this.time.delayedCall(800, () => this.playPartTwo(cx, cy))
  }

  // ═══ Part 2: 8-Ring Cave Descent ═══════════════════════════════════════════
  //
  // How transparency works:
  // - Phaser game was created with `transparent: true` (see CardGameManager)
  // - Camera background is set to alpha 0 → WebGL clears to (0,0,0,0)
  // - Rings use NORMAL blend mode but have black (#000000) backgrounds
  // - A fading black rectangle at depth 5 covers the WHOLE screen,
  //   gradually revealing the campsite behind the canvas
  // - Ring center holes show the campsite THROUGH both the fading rect
  //   and the transparent canvas
  //
  // 3D effect: rings scale Y 30-50% more than X as they approach,
  // creating a tunnel-mouth perspective distortion.

  private playPartTwo(cx: number, cy: number): void {
    const viewW = this.scale.width
    const viewH = this.scale.height
    const ringCover = Math.max(viewW / 1024, viewH / 1024)

    // ── Make camera transparent ──
    // Phaser camera.setBackgroundColor with alpha 0:
    // The camera internally uses a Phaser.Display.Color object.
    // Setting alpha to 0 makes the WebGL clear color transparent.
    const cam = this.cameras.main
    cam.setBackgroundColor({ r: 0, g: 0, b: 0, a: 0 } as unknown as number)
    // Also try the transparent property directly
    cam.transparent = true

    // ── Fading black screen ──
    // This rectangle covers the entire viewport at a LOW depth (below rings).
    // It starts fully opaque (black) and fades out over the descent,
    // gradually revealing the Svelte HubScreen (campsite) behind the canvas.
    // The ring holes let you see THROUGH to this rect → through to campsite.
    const blackScreen = this.add.rectangle(cx, cy, viewW * 2, viewH * 2, 0x000000)
      .setDepth(5).setAlpha(1)
    this.sceneSprites.push(blackScreen)

    // Fade the black screen: starts at ring 2 (~300ms), reaches 0 around ring 7
    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: blackScreen,
        alpha: 0,
        duration: 5500,
        ease: 'Cubic.easeIn', // slow start → accelerating reveal
        onComplete: () => { if (blackScreen.active) blackScreen.destroy() },
      })
    })

    // ── Ring configs: decelerating descent with 3D stretch ──
    const ringConfigs = [
      { delay: 0,    duration: 1400,  yDrift: -100, startScale: 0.08,  angle: 0,    yStretch: 3.5 },
      { delay: 150,  duration: 1800,  yDrift: -75,  startScale: 0.06,  angle: 1.2,  yStretch: 3.0 },
      { delay: 350,  duration: 2200,  yDrift: -55,  startScale: 0.05,  angle: -0.8, yStretch: 2.5 },
      { delay: 600,  duration: 2600,  yDrift: -40,  startScale: 0.04,  angle: 0.6,  yStretch: 2.1 },
      { delay: 900,  duration: 3000,  yDrift: -28,  startScale: 0.035, angle: -0.4, yStretch: 1.8 },
      { delay: 1250, duration: 3400,  yDrift: -16,  startScale: 0.03,  angle: 0.3,  yStretch: 1.5 },
      { delay: 1650, duration: 3800,  yDrift: -8,   startScale: 0.025, angle: -0.2, yStretch: 1.3 },
      { delay: 2100, duration: 4200,  yDrift: -3,   startScale: 0.02,  angle: 0,    yStretch: 1.12 },
    ]

    const endScaleX = ringCover * 4
    const fadeThreshold = ringCover * 1.5

    for (let i = 0; i < 8; i++) {
      const cfg = ringConfigs[i]
      const ringKey = `boot_cave_ring_${i + 1}`
      // Rings at depth 10-17, all ABOVE the black screen (depth 5)
      const depth = 17 - i

      this.time.delayedCall(cfg.delay, () => {
        const offsetX = cx + Phaser.Math.Between(-5, 5)
        const offsetY = cy + Phaser.Math.Between(0, 6)

        const ring = this.add.image(offsetX, offsetY, ringKey)
          .setScale(ringCover * cfg.startScale)
          .setDepth(depth)
          .setAlpha(0)
        this.sceneSprites.push(ring)

        // Fade in
        this.tweens.add({
          targets: ring, alpha: 1,
          duration: 400, ease: 'Sine.easeOut',
        })

        // 3D zoom: ring stretches outward in ALL directions as it passes.
        // Early rings stretch massively (high-speed flyby), later rings barely.
        const endScale = endScaleX * cfg.yStretch
        const ease = i < 2 ? 'Expo.easeIn'
          : i < 5 ? 'Cubic.easeIn'
            : 'Quad.easeIn'

        this.tweens.add({
          targets: ring,
          scaleX: endScale,
          scaleY: endScale,
          y: offsetY + cfg.yDrift,
          x: offsetX + Phaser.Math.Between(-8, 8),
          angle: cfg.angle,
          duration: cfg.duration,
          ease,
          onUpdate: (_tween, target) => {
            const img = target as Phaser.GameObjects.Image
            const s = img.scaleX
            if (s > fadeThreshold) {
              const progress = (s - fadeThreshold) / (endScale - fadeThreshold)
              img.setAlpha(Math.max(0, 1 - progress * progress))
            }
          },
          onComplete: () => { if (ring.active) ring.destroy() },
        })

        // Deblur campsite at ring 7
        if (i === 6) {
          this.game.events.emit('boot-anim-deblur')
        }

        // Last ring → complete
        if (i === 7) {
          this.time.delayedCall(cfg.duration, () => this.complete())
        }
      })
    }
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
