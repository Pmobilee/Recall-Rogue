import Phaser from 'phaser'

/**
 * BootAnimScene — Cinematic boot/splash for Recall Rogue.
 *
 * ~11s animation:
 *   Part 1 (0–4.8s): Stars + logo deblur, glow, title sweep, studio tag, fireflies
 *   Transition (4.8–5.6s): Logo fades, stars drift upward (looking-down effect)
 *   Part 2 (5.6–~11s): Layered cave tunnel — all 3 rings visible simultaneously
 *     at staggered scales, campsite visible through holes, final ring passes
 *     then campsite fully reveals
 *
 * Assets are 1024×1835, scaled to COVER viewport.
 * Cave rings have transparent centers — campsite is visible through the holes.
 *
 * Emits: `this.game.events.emit('boot-anim-complete')` when done.
 */
export default class BootAnimScene extends Phaser.Scene {
  private activeEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []
  private sceneSprites: Phaser.GameObjects.GameObject[] = []
  private coverScale = 1

  constructor() {
    super({ key: 'BootAnimScene' })
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
    this.load.image('boot_cave_ring_1', base + 'cave_ring_1.png')
    this.load.image('boot_cave_ring_2', base + 'cave_ring_2.png')
    this.load.image('boot_cave_ring_3', base + 'cave_ring_3.png')
    // Campsite background — shown through cave ring holes
    this.load.image('boot_campsite', '/assets/camp/sprites/background/camp-background.jpg')
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000)
    const cx = this.cameras.main.centerX
    const cy = this.cameras.main.centerY
    const viewW = this.scale.width
    const viewH = this.scale.height
    this.coverScale = Math.max(viewW / 1024, viewH / 1835)

    // Particle texture
    const gfx = this.make.graphics({ x: 0, y: 0 })
    gfx.fillStyle(0xffffff)
    gfx.fillCircle(4, 4, 4)
    gfx.generateTexture('boot_particle', 8, 8)
    gfx.destroy()

    // Smooth filtering for all boot textures
    const bootKeys = [
      'boot_logo', 'boot_logo_blur_medium', 'boot_logo_blur_heavy',
      'boot_recallrogue', 'boot_recallrogue_blur_medium', 'boot_recallrogue_blur_heavy',
      'boot_bramblegategames', 'boot_bramblegategames_blur_medium', 'boot_bramblegategames_blur_heavy',
      'boot_cave_ring_1', 'boot_cave_ring_2', 'boot_cave_ring_3', 'boot_campsite',
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
    // Transition → Part 2
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
        Math.random() < 0.3 ? 0xFFFAE0 : 0xFFFFFF
      ).setAlpha(Math.random() * 0.3 + 0.1).setDepth(1)
      this.sceneSprites.push(star)
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
        2 + Math.random() * 2, 0xFFF5CC
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
    // 1) Fade out logo elements (depth 100-103)
    const logoTargets = this.sceneSprites.filter(obj => {
      const d = (obj as Phaser.GameObjects.Image).depth
      return d >= 100 && d <= 103 && obj.active
    })
    if (logoTargets.length > 0) {
      this.tweens.add({
        targets: logoTargets, alpha: 0, duration: 600,
        onComplete: () => { for (const t of logoTargets) { if (t.active) t.destroy() } },
      })
    }

    // 2) Stars drift UPWARD and fade — "looking down" effect
    const stars = this.sceneSprites.filter(obj => (obj as Phaser.GameObjects.Arc).depth === 1 && obj.active)
    for (const star of stars) {
      this.tweens.add({
        targets: star,
        y: (star as Phaser.GameObjects.Arc).y - Phaser.Math.Between(150, 300),
        alpha: 0,
        duration: 800,
        ease: 'Quad.easeIn',
      })
    }

    // 3) After stars drift, start the cave tunnel
    this.time.delayedCall(800, () => this.playPartTwo(cx, cy))
  }

  // ═══ Part 2: Layered Cave Tunnel (5.6–~10s) ═════════════════════════════════
  //
  // All 3 rings start at coverScale (fully filling screen). You only see deeper
  // layers through each ring's transparent center hole. Each ring scales from
  // 1× → 3× coverScale to "fly past the camera." Rings behind are dimmed/dark,
  // brightening as the ring in front passes. Campsite is visible through all holes.

  private playPartTwo(cx: number, cy: number): void {
    const s = this.coverScale
    const viewW = this.scale.width
    const viewH = this.scale.height

    // ── Campsite at the very back (depth 5) — visible through all ring holes ──
    const campScale = Math.max(viewW / 571, viewH / 1024)
    const camp = this.add.image(cx, cy, 'boot_campsite')
      .setScale(campScale).setDepth(5).setAlpha(0.15) // very dim initially
    this.sceneSprites.push(camp)

    // Dark overlay between campsite and rings
    const overlay = this.add.rectangle(cx, cy, viewW + 40, viewH + 40, 0x000000)
      .setDepth(6).setAlpha(0.75)
    this.sceneSprites.push(overlay)

    // ── All 3 rings at coverScale, layered front-to-back ──
    // Ring 1 (front/closest, depth 12) — fully visible, we fly through this first
    // Ring 2 (middle, depth 11) — dim, seen through ring 1's hole
    // Ring 3 (back/deepest, depth 10) — very dim, seen through ring 2's hole
    const ring1 = this.add.image(cx, cy, 'boot_cave_ring_1')
      .setScale(s).setDepth(12).setAlpha(1)
    const ring2 = this.add.image(cx, cy, 'boot_cave_ring_2')
      .setScale(s).setDepth(11).setAlpha(0.4).setTint(0x666688) // dim/blue = "far away"
    const ring3 = this.add.image(cx, cy, 'boot_cave_ring_3')
      .setScale(s).setDepth(10).setAlpha(0.25).setTint(0x444466) // very dim
    this.sceneSprites.push(ring1, ring2, ring3)

    // ── Ring 1 flies past (0ms): scale 1→3, alpha 1→0 ──
    // As it passes, ring 2 brightens and clears tint
    this.tweens.add({
      targets: ring1,
      scaleX: s * 3, scaleY: s * 3, alpha: 0,
      duration: 1500, ease: 'Quad.easeIn',
      onComplete: () => { if (ring1.active) ring1.destroy() },
    })
    // Ring 2 brightens as ring 1 passes
    this.tweens.add({
      targets: ring2, alpha: 1, duration: 1200, ease: 'Quad.easeOut',
    })
    this.time.delayedCall(400, () => { ring2.clearTint() })

    // ── Ring 2 flies past (800ms after ring 1 starts) ──
    this.time.delayedCall(800, () => {
      this.tweens.add({
        targets: ring2,
        scaleX: s * 3, scaleY: s * 3, alpha: 0, angle: 1.5,
        duration: 1500, ease: 'Quad.easeIn',
        onComplete: () => { if (ring2.active) ring2.destroy() },
      })
      // Ring 3 brightens
      this.tweens.add({ targets: ring3, alpha: 1, duration: 1200, ease: 'Quad.easeOut' })
      this.time.delayedCall(400, () => { ring3.clearTint() })
    })

    // ── Ring 3 flies past (1600ms after ring 1 starts) ──
    this.time.delayedCall(1600, () => {
      // Brighten campsite as ring 3 starts flying past
      this.tweens.add({ targets: camp, alpha: 1, duration: 1200 })
      this.tweens.add({ targets: overlay, alpha: 0, duration: 1200 })

      this.tweens.add({
        targets: ring3,
        scaleX: s * 3, scaleY: s * 3, alpha: 0, angle: -1.5,
        duration: 1800, ease: 'Quad.easeIn',
        onComplete: () => {
          if (ring3.active) ring3.destroy()
          // Campsite fully visible — fade to transparent hub
          this.time.delayedCall(600, () => this.fadeToHub())
          this.time.delayedCall(1400, () => this.complete())
        },
      })
    })
  }

  /** Fade everything to transparent, revealing the Svelte HubScreen underneath. */
  private fadeToHub(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)')
    const remaining = this.sceneSprites.filter(obj => obj?.active)
    if (remaining.length > 0) {
      this.tweens.add({ targets: remaining, alpha: 0, duration: 800 })
    }
    for (const emitter of this.activeEmitters) {
      if (emitter?.active) emitter.stop()
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
  }
}
