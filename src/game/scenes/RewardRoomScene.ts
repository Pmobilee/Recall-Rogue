import Phaser from 'phaser'
import { BASE_WIDTH } from '../../data/layout'
import type { LayoutMode } from '../../stores/layoutStore'
import type { Card } from '../../data/card-types'
import type { RelicDefinition } from '../../data/relics/types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RewardItem =
  | { type: 'gold'; amount: number }
  | { type: 'health_vial'; size: 'small' | 'large'; healAmount: number }
  | { type: 'card'; card: Card }
  | { type: 'relic'; relic: RelicDefinition }

export interface RewardRoomData {
  rewards: RewardItem[]
}

interface GoldTierEntry {
  tier: number
  key: string
  minGold: number
  maxGold: number | null
}

interface SpawnZoneData {
  positions?: Array<{ x: number; y: number }>
}

interface Firefly {
  sprite: Phaser.GameObjects.Arc
  baseX: number
  baseY: number
  phase: number
  ampX: number
  ampY: number
  freqX: number
  freqY: number
  depthLayer: number
  lifespan: number
  elapsed: number
  fadeIn: number
  fadeOut: number
  state: 'fadingIn' | 'alive' | 'fadingOut' | 'dead'
}

export interface ItemObject {
  sprite: Phaser.GameObjects.GameObject
  shadow: Phaser.GameObjects.Ellipse
  phaseOffset: number
  baseY: number
  reward: RewardItem
  collected: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FIREFLY_COUNT = 15
const FIREFLY_COLORS = [0xd4e157, 0xfff176, 0xffee58]
const CONTINUE_Y_PCT = 0.92
const CARD_W = 48
const CARD_H = 68
const RELIC_SIZE = 44
const CARD_TYPE_COLORS: Record<string, number> = {
  attack: 0xff6b6b,
  shield: 0x4dabf7,
  buff: 0xcc5de8,
  debuff: 0xff8787,
  utility: 0xffd43b,
  wild: 0xff922b,
}
const RARITY_COLORS: Record<string, number> = {
  common: 0x9ca3af,
  uncommon: 0x22c55e,
  rare: 0x3b82f6,
  legendary: 0xf59e0b,
}

// ─── Scene ────────────────────────────────────────────────────────────────────

/**
 * RewardRoomScene — Phaser 3 scene for the dungeon reward room.
 *
 * Displays collectible reward items on a cloth-covered boulder background.
 * Players tap items to collect gold, health vials, cards, and relics.
 * Emits events: 'goldCollected', 'vialCollected', 'cardAccepted', 'relicAccepted', 'sceneComplete'.
 */
export class RewardRoomScene extends Phaser.Scene {
  private fireflies: Firefly[] = []
  private items: ItemObject[] = []
  private overlayObjects: Phaser.GameObjects.GameObject[] = []
  private goldTiers: GoldTierEntry[] = []
  private continueButton!: Phaser.GameObjects.Container
  private sf = 1
  private currentLayoutMode: LayoutMode = 'portrait'

  constructor() {
    super({ key: 'RewardRoom' })
  }

  /**
   * Called by CardGameManager when the layout mode changes (portrait ↔ landscape).
   * Actual landscape adaptation is implemented in AR-73.
   * This stub stores the mode for future use.
   */
  handleLayoutChange(mode: LayoutMode): void {
    this.currentLayoutMode = mode
  }

  // ─── Preload ────────────────────────────────────────────────────────────────

  preload(): void {
    const cb = `?v=${Date.now()}`

    this.load.image('reward_bg', '/assets/reward_room/reward_room_bg.webp' + cb)

    for (let i = 0; i <= 5; i++) {
      this.load.image(`gold_tier_${i}`, `/assets/reward_room/gold_tier_${i}.png${cb}`)
    }

    this.load.image('vial_small', '/assets/reward_room/health_vial_small.png' + cb)
    this.load.image('vial_large', '/assets/reward_room/health_vial_large.png' + cb)

    this.load.json('gold_tiers', '/assets/reward_room/gold_tiers.json' + cb)
    this.load.json('cloth_spawn_zone', '/assets/reward_room/cloth_spawn_zone.json' + cb)

    // Preload all known card frame textures
    const MECHANIC_IDS = [
      'strike', 'block', 'multi_hit', 'thorns', 'emergency', 'scout', 'recycle',
      'cleanse', 'empower', 'quicken', 'weaken', 'expose', 'mirror', 'adapt',
      'focus', 'heavy_strike', 'piercing', 'reckless', 'execute', 'lifetap',
      'fortify', 'parry', 'brace', 'overheal', 'double_strike', 'slow', 'hex',
      'foresight', 'transmute', 'immunity', 'overclock',
    ]

    for (const id of MECHANIC_IDS) {
      this.load.image(`cardframe_${id}`, `/assets/cardframes/lowres/${id}.webp${cb}`)
    }
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  create(): void {
    const W = this.scale.width
    const H = this.scale.height
    this.sf = W / BASE_WIDTH

    this.goldTiers = this.parseGoldTiers()
    this.createBackground(W, H)
    this.createFireflies(W, H)

    const data = (this.scene.settings.data as RewardRoomData) ?? { rewards: [] }
    this.spawnRewardItems(data.rewards, W, H)
    this.createContinueButton(W, H)
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private createBackground(W: number, H: number): void {
    const bg = this.add.image(W / 2, H / 2, 'reward_bg')
    bg.setOrigin(0.5, 0.5)

    // Cover mode: scale to fill entire viewport
    const scaleX = W / bg.width
    const scaleY = H / bg.height
    const scale = Math.max(scaleX, scaleY)
    bg.setScale(scale)

    bg.setY(H / 2)
    bg.setDepth(0)
  }

  // ─── Fireflies ───────────────────────────────────────────────────────────────

  private createFireflies(W: number, H: number): void {
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      this.spawnFirefly(W, H)
    }
  }

  private spawnFirefly(W: number, H: number): void {
    const depthLayer = 0.5 + Math.random() * 0.5
    const color = Phaser.Utils.Array.GetRandom(FIREFLY_COLORS) as number
    const radius = (2 + Math.random() * 2) * depthLayer
    const bx = Phaser.Math.Between(20, W - 20)
    const by = Phaser.Math.Between(20, H * 0.35)

    const sprite = this.add.circle(bx, by, radius, color)
    sprite.setAlpha(0)
    sprite.setDepth(5)

    const lifespan = 4000 + Math.random() * 4000
    const firefly: Firefly = {
      sprite,
      baseX: bx,
      baseY: by,
      phase: Math.random() * Math.PI * 2,
      ampX: 20 + Math.random() * 40,
      ampY: 15 + Math.random() * 35,
      freqX: 0.0004 + Math.random() * 0.0006,
      freqY: 0.0006 + Math.random() * 0.0008,
      depthLayer,
      lifespan,
      elapsed: 0,
      fadeIn: 600,
      fadeOut: 800,
      state: 'fadingIn',
    }
    this.fireflies.push(firefly)
  }

  private updateFireflies(time: number, delta: number): void {
    const W = this.scale.width
    const H = this.scale.height

    for (const fly of this.fireflies) {
      if (!fly.sprite.active) continue
      fly.elapsed += delta

      const maxAlpha = 0.3 + fly.depthLayer * 0.4

      switch (fly.state) {
        case 'fadingIn': {
          const t = Math.min(fly.elapsed / fly.fadeIn, 1)
          fly.sprite.setAlpha(t * maxAlpha)
          if (t >= 1) {
            fly.state = 'alive'
            fly.elapsed = 0
          }
          break
        }
        case 'alive': {
          fly.sprite.setAlpha(maxAlpha)
          const speed = fly.depthLayer
          const nx =
            fly.baseX +
            Math.sin(time * fly.freqX * speed + fly.phase) * fly.ampX
          const ny =
            fly.baseY +
            Math.cos(time * fly.freqY * speed + fly.phase) * fly.ampY
          fly.sprite.setPosition(nx, ny)

          // Slow horizontal drift
          fly.baseX += (Math.random() - 0.5) * 0.3
          fly.baseX = Phaser.Math.Clamp(fly.baseX, 20, W - 20)

          if (fly.elapsed >= fly.lifespan) {
            fly.state = 'fadingOut'
            fly.elapsed = 0
          }
          break
        }
        case 'fadingOut': {
          const t = Math.min(fly.elapsed / fly.fadeOut, 1)
          fly.sprite.setAlpha(maxAlpha * (1 - t))
          if (t >= 1) {
            fly.state = 'dead'
            fly.sprite.destroy()
          }
          break
        }
        case 'dead':
          break
      }
    }

    // Remove dead fireflies and spawn replacements
    const alive = this.fireflies.filter((f) => f.state !== 'dead')
    const deadCount = this.fireflies.length - alive.length
    this.fireflies = alive
    for (let i = 0; i < deadCount; i++) {
      this.spawnFirefly(W, H)
    }
  }

  // ─── Item Spawning ───────────────────────────────────────────────────────────

  private spawnRewardItems(rewards: RewardItem[], W: number, H: number): void {
    if (rewards.length === 0) return

    // Read cloth spawn zone data
    const clothData = this.cache.json.get('cloth_spawn_zone')
    const bounds = clothData?.bounds ?? { minX: 300, minY: 900, maxX: 1200, maxY: 1500 }
    const maskW = clothData?.maskWidth ?? 1536
    const maskH = clothData?.maskHeight ?? 2752

    // Compute same scale as background (cover mode)
    const bgW = this.textures.get('reward_bg').getSourceImage().width as number
    const bgH = this.textures.get('reward_bg').getSourceImage().height as number
    const scaleX = W / bgW
    const scaleY = H / bgH
    const bgScale = Math.max(scaleX, scaleY)

    // Background offset (same as createBackground — just centered)
    const bgCenterY = H / 2

    // Transform cloth bounds from source coords to scene coords
    // Source image origin is at (bgCenterX - bgW*bgScale/2, bgCenterY - bgH*bgScale/2)
    const bgOriginX = W / 2 - (bgW * bgScale) / 2
    const bgOriginY = bgCenterY - (bgH * bgScale) / 2

    const clothMinX = bgOriginX + bounds.minX * bgScale
    const clothMaxX = bgOriginX + bounds.maxX * bgScale
    const clothMinY = bgOriginY + bounds.minY * bgScale
    const clothMaxY = bgOriginY + bounds.maxY * bgScale
    const clothCX = (clothMinX + clothMaxX) / 2
    const clothCY = (clothMinY + clothMaxY) / 2
    const clothW = clothMaxX - clothMinX
    const clothH = clothMaxY - clothMinY

    void maskW; void maskH

    // Layout items within cloth area
    const positions = this.computeClothLayout(rewards.length, clothCX, clothCY, clothW, clothH)

    rewards.forEach((reward, i) => {
      const pos = positions[i] ?? { x: clothCX, y: clothCY }
      this.createItemAt(reward, pos.x, pos.y, i * 200)
    })

    // Emit card positions for Svelte DOM overlay (pixel-identical card rendering)
    const cardPositions: Array<{ card: Card; x: number; y: number; index: number }> = []
    this.items.forEach((item, idx) => {
      if (item.reward.type === 'card') {
        const sprite = item.sprite as any
        cardPositions.push({
          card: (item.reward as { type: 'card'; card: Card }).card,
          x: sprite.x ?? 0,
          y: sprite.y ?? 0,
          index: idx,
        })
      }
    })
    if (cardPositions.length > 0) {
      // Delay slightly so spawn animations complete
      this.time.delayedCall(500, () => {
        this.events.emit('cardPositions', cardPositions)
      })
    }
  }

  private computeClothLayout(count: number, cx: number, cy: number, w: number, h: number): Array<{x: number, y: number}> {
    if (count <= 0) return []

    // Place items using predefined scatter positions across the cloth
    // These are normalized offsets from center (-0.5 to 0.5 range)
    const scatterPatterns: Record<number, Array<{dx: number, dy: number}>> = {
      1: [{ dx: 0, dy: 0 }],
      2: [{ dx: -0.25, dy: -0.05 }, { dx: 0.25, dy: 0.08 }],
      3: [{ dx: -0.32, dy: 0.10 }, { dx: 0.05, dy: -0.15 }, { dx: 0.30, dy: 0.12 }],
      4: [
        { dx: -0.30, dy: -0.18 }, { dx: 0.22, dy: -0.12 },
        { dx: -0.15, dy: 0.20 }, { dx: 0.32, dy: 0.15 },
      ],
      5: [
        { dx: -0.35, dy: -0.08 }, { dx: 0.0, dy: -0.22 }, { dx: 0.33, dy: -0.05 },
        { dx: -0.20, dy: 0.22 }, { dx: 0.25, dy: 0.20 },
      ],
      6: [
        { dx: -0.35, dy: -0.18 }, { dx: 0.02, dy: -0.22 }, { dx: 0.36, dy: -0.12 },
        { dx: -0.28, dy: 0.20 }, { dx: 0.08, dy: 0.22 }, { dx: 0.35, dy: 0.18 },
      ],
    }

    const pattern = scatterPatterns[Math.min(count, 6)] ?? scatterPatterns[6]

    return pattern.slice(0, count).map(p => ({
      x: cx + p.dx * w * 0.85 + (Math.random() - 0.5) * 10,
      y: cy + p.dy * h * 0.85 + (Math.random() - 0.5) * 10,
    }))
  }

  private createItemAt(
    reward: RewardItem,
    x: number,
    y: number,
    delay: number
  ): void {
    const sprite = this.createRewardSprite(reward, x, y)

    // Compute shadow size proportional to sprite
    const spriteW = (sprite as any).displayWidth ?? (sprite as any).width ?? 48
    const shadowW = Math.max(30, spriteW * 0.7)
    const shadowH = shadowW * 0.25
    const shadow = this.add.ellipse(x, y + shadowH + 4, shadowW, shadowH, 0x000000, 0)
    shadow.setDepth(2)
    const phaseOffset = Math.random() * Math.PI * 2

    // Add shimmer effect around the item
    const shimmerW = (reward.type === 'card') ? CARD_W * this.sf : (reward.type === 'relic') ? RELIC_SIZE * this.sf : 48 * this.sf
    const shimmerH = (reward.type === 'card') ? CARD_H * this.sf : shimmerW
    this.addShimmerEffect(x, y, shimmerW, shimmerH)

    const item: ItemObject = {
      sprite,
      shadow,
      phaseOffset,
      baseY: y,
      reward,
      collected: false,
    }
    this.items.push(item)

    // Capture the intended scale before overriding for animation
    const targetScaleX = (sprite as any).scaleX ?? 1
    const targetScaleY = (sprite as any).scaleY ?? 1

    // Set initial state for spawn animation
    ;(sprite as any).y = y + 25
    ;(sprite as any).alpha = 0
    ;(sprite as any).scaleX = 0
    ;(sprite as any).scaleY = 0

    this.time.delayedCall(delay, () => {
      this.tweens.add({
        targets: sprite,
        y: y,
        alpha: 1,
        scaleX: targetScaleX,
        scaleY: targetScaleY,
        duration: 350,
        ease: 'Back.easeOut',
      })
      this.tweens.add({
        targets: shadow,
        alpha: 0.3,
        duration: 350,
        ease: 'Linear',
      })
    })

    // Interaction
    ;(sprite as Phaser.GameObjects.Image).setInteractive()
    ;(sprite as Phaser.GameObjects.Image).on('pointerdown', () => {
      if (item.collected) return
      this.handleItemTap(item)
    })
  }

  private createRewardSprite(
    reward: RewardItem,
    x: number,
    y: number
  ): Phaser.GameObjects.GameObject {
    switch (reward.type) {
      case 'gold': {
        const tier = this.getGoldTier(reward.amount)
        const key = tier ? `gold_tier_${tier.tier}` : 'gold_tier_0'
        const img = this.add.image(x, y, key)
        img.setDepth(3)
        img.setScale(this.sf * 1.8)
        if ((img as any).preFX) {
          (img as any).preFX.addGlow(0x000000, 2, 0, false, 0.8, 12)
        }
        return img
      }

      case 'health_vial': {
        const key = reward.size === 'large' ? 'vial_large' : 'vial_small'
        const img = this.add.image(x, y, key)
        img.setDepth(3)
        img.setScale(this.sf * 0.8)
        if ((img as any).preFX) {
          (img as any).preFX.addGlow(0x000000, 2, 0, false, 0.8, 12)
        }
        return img
      }

      case 'card': {
        const mechanicId = reward.card.mechanicId ?? ''
        const frameKey = `cardframe_${mechanicId}`
        const hasFrame = this.textures.exists(frameKey)

        if (hasFrame) {
          const img = this.add.image(x, y, frameKey)
          img.setDepth(3)
          // Scale card frame to fit ~40x57 on screen (small collectible icon on cloth)
          const targetW = 48 * this.sf
          const imgScale = targetW / img.width
          img.setScale(imgScale)
          // Use linear filtering for smooth scaling (not pixelated)
          if (img.texture) {
            img.texture.setFilter(Phaser.Textures.FilterMode.LINEAR)
          }
          if ((img as any).preFX) {
            (img as any).preFX.addGlow(0x000000, 2, 0, false, 0.8, 12)
            // Card type color glow
            const typeGlow = CARD_TYPE_COLORS[reward.card.cardType] ?? 0xaaaaaa
            ;(img as any).preFX.addGlow(typeGlow, 3, 0, false, 0.3, 16)
            // Golden glow for upgraded cards
            if (reward.card.isUpgraded) {
              (img as any).preFX.addGlow(0xfbbf24, 6, 0, false, 0.5, 20)
            }
          }
          return img
        } else {
          // Fallback: colored rectangle
          const color = CARD_TYPE_COLORS[reward.card.cardType] ?? 0xaaaaaa
          const container = this.add.container(x, y)
          const rect = this.add.graphics()
          rect.fillStyle(0x1a1a2e, 1)
          rect.fillRoundedRect(-CARD_W/2*this.sf, -CARD_H/2*this.sf, CARD_W*this.sf, CARD_H*this.sf, 6*this.sf)
          rect.lineStyle(2*this.sf, color, 1)
          rect.strokeRoundedRect(-CARD_W/2*this.sf, -CARD_H/2*this.sf, CARD_W*this.sf, CARD_H*this.sf, 6*this.sf)
          const label = this.add.text(0, 0, reward.card.mechanicName ?? reward.card.cardType, {
            fontFamily: 'monospace', fontSize: `${Math.round(9*this.sf)}px`, color: '#ffffff',
            align: 'center', wordWrap: { width: (CARD_W-6)*this.sf },
          })
          label.setOrigin(0.5, 0.5)
          container.add([rect, label])
          container.setDepth(3)
          container.setSize(CARD_W*this.sf, CARD_H*this.sf)
          container.setInteractive()
          return container
        }
      }

      case 'relic': {
        const borderColor = RARITY_COLORS[reward.relic.rarity] ?? 0x9ca3af
        const container = this.add.container(x, y)
        const rect = this.add.graphics()
        rect.fillStyle(0x1a1a2e, 1)
        rect.fillRoundedRect(
          -RELIC_SIZE / 2 * this.sf,
          -RELIC_SIZE / 2 * this.sf,
          RELIC_SIZE * this.sf,
          RELIC_SIZE * this.sf,
          8 * this.sf
        )
        rect.lineStyle(2 * this.sf, borderColor, 1)
        rect.strokeRoundedRect(
          -RELIC_SIZE / 2 * this.sf,
          -RELIC_SIZE / 2 * this.sf,
          RELIC_SIZE * this.sf,
          RELIC_SIZE * this.sf,
          8 * this.sf
        )
        const icon = this.add.text(0, 0, reward.relic.icon ?? '?', {
          fontFamily: 'monospace',
          fontSize: `${Math.round(20 * this.sf)}px`,
          align: 'center',
        })
        icon.setOrigin(0.5, 0.5)
        container.add([rect, icon])
        container.setDepth(3)
        container.setSize(RELIC_SIZE * this.sf, RELIC_SIZE * this.sf)
        container.setInteractive()
        return container
      }
    }
  }

  // ─── Item Bobs ───────────────────────────────────────────────────────────────

  private updateItemBobs(time: number): void {
    for (const item of this.items) {
      if (item.collected) continue
      const sprite = item.sprite as any
      if (sprite && sprite.y !== undefined) {
        sprite.y = item.baseY + Math.sin(time * 0.002 + item.phaseOffset) * 2.5
      }
    }
  }

  // ─── Item Tap Handlers ──────────────────────────────────────────────────────

  private handleItemTap(item: ItemObject): void {
    switch (item.reward.type) {
      case 'gold':
        this.collectGold(item)
        break
      case 'health_vial':
        this.collectVial(item)
        break
      case 'card':
        this.showCardDetail(item)
        break
      case 'relic':
        this.showRelicDetail(item)
        break
    }
  }

  private collectGold(item: ItemObject): void {
    if (item.collected) return
    item.collected = true

    const amount = (item.reward as { type: 'gold'; amount: number }).amount
    const x = (item.sprite as any).x ?? 0
    const y = (item.sprite as any).y ?? 0

    this.tweens.add({ targets: item.sprite, scaleX: 0, scaleY: 0, alpha: 0, duration: 200, ease: 'Linear' })
    this.tweens.add({ targets: item.shadow, alpha: 0, duration: 200, ease: 'Linear', onComplete: () => {
      item.sprite.destroy()
      item.shadow.destroy()
    }})

    this.burstParticles(x, y, 0xffd700, 8)
    this.floatingText(x, y, `+${amount}`, '#ffd700')
    this.events.emit('goldCollected', amount)
    this.checkAutoAdvance()
  }

  private collectVial(item: ItemObject): void {
    if (item.collected) return
    item.collected = true

    const reward = item.reward as { type: 'health_vial'; size: 'small' | 'large'; healAmount: number }
    const x = (item.sprite as any).x ?? 0
    const y = (item.sprite as any).y ?? 0

    this.tweens.add({ targets: item.sprite, scaleX: 0, scaleY: 0, alpha: 0, duration: 200, ease: 'Linear' })
    this.tweens.add({ targets: item.shadow, alpha: 0, duration: 200, ease: 'Linear', onComplete: () => {
      item.sprite.destroy()
      item.shadow.destroy()
    }})

    this.burstParticles(x, y, 0x4ade80, 8)
    this.floatingText(x, y, `+${reward.healAmount} HP`, '#4ade80')
    this.events.emit('vialCollected', reward.healAmount)
    this.checkAutoAdvance()
  }

  /** Check if all items are collected and auto-advance if so. */
  private checkAutoAdvance(): void {
    const uncollected = this.items.filter(i => !i.collected)
    if (uncollected.length === 0) {
      // All items collected — auto-advance after disintegration finishes
      this.time.delayedCall(800, () => {
        this.events.emit('sceneComplete')
      })
    }
  }

  private showCardDetail(item: ItemObject): void {
    if (item.collected) return
    const card = (item.reward as { type: 'card'; card: Card }).card

    // Emit event for the bridge to show Svelte card detail overlay
    this.events.emit('cardTapped', card, item)
  }

  /** Called by bridge when player accepts a card from the detail overlay. */
  public acceptCard(item: ItemObject): void {
    item.collected = true
    this.destroyItemSprite(item)
    this.disintegrateRemainingItems(item)
    this.checkAutoAdvance()
  }

  /** Called by bridge when player rejects — card returns to cloth. */
  public rejectCard(): void {
    // Card stays on cloth, nothing to do — overlay was handled by Svelte
  }

  /** Get items list for bridge access. */
  public getItems(): ItemObject[] {
    return this.items
  }

  private showRelicDetail(item: ItemObject): void {
    if (item.collected) return
    const relic = (item.reward as { type: 'relic'; relic: RelicDefinition }).relic
    const W = this.scale.width
    const H = this.scale.height

    this.clearOverlay()

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6)
    dim.setDepth(10)
    dim.setInteractive()
    this.overlayObjects.push(dim)

    const panelW = 260 * this.sf
    const panelH = 300 * this.sf
    const panelX = W / 2
    const panelY = H / 2
    const borderColor = RARITY_COLORS[relic.rarity] ?? 0x9ca3af

    const panel = this.add.graphics()
    panel.setDepth(11)
    panel.fillStyle(0x1f2937, 1)
    panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 12 * this.sf)
    panel.lineStyle(2 * this.sf, borderColor, 1)
    panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 12 * this.sf)
    this.overlayObjects.push(panel)

    const iconText = this.add.text(panelX, panelY - panelH / 2 + 28 * this.sf, relic.icon ?? '?', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(28 * this.sf)}px`,
    })
    iconText.setOrigin(0.5, 0)
    iconText.setDepth(12)
    this.overlayObjects.push(iconText)

    const title = this.add.text(panelX, panelY - panelH / 2 + 68 * this.sf, relic.name, {
      fontFamily: 'monospace',
      fontSize: `${Math.round(13 * this.sf)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5, 0)
    title.setDepth(12)
    this.overlayObjects.push(title)

    const rarityLabel = this.add.text(panelX, panelY - panelH / 2 + 88 * this.sf, relic.rarity.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: `${Math.round(10 * this.sf)}px`,
      color: `#${borderColor.toString(16).padStart(6, '0')}`,
    })
    rarityLabel.setOrigin(0.5, 0)
    rarityLabel.setDepth(12)
    this.overlayObjects.push(rarityLabel)

    const desc = this.add.text(panelX, panelY - 20 * this.sf, relic.description, {
      fontFamily: 'monospace',
      fontSize: `${Math.round(11 * this.sf)}px`,
      color: '#e2e8f0',
      align: 'center',
      wordWrap: { width: panelW - 32 * this.sf },
    })
    desc.setOrigin(0.5, 0.5)
    desc.setDepth(12)
    this.overlayObjects.push(desc)

    // Accept button
    const acceptBtnY = panelY + panelH / 2 - 55 * this.sf
    const acceptBtn = this.add.graphics()
    acceptBtn.setDepth(12)
    acceptBtn.fillStyle(0x16a34a, 1)
    acceptBtn.fillRoundedRect(panelX - 60 * this.sf, acceptBtnY - 16 * this.sf, 120 * this.sf, 32 * this.sf, 6 * this.sf)
    acceptBtn.setInteractive(
      new Phaser.Geom.Rectangle(panelX - 60 * this.sf, acceptBtnY - 16 * this.sf, 120 * this.sf, 32 * this.sf),
      Phaser.Geom.Rectangle.Contains
    )
    this.overlayObjects.push(acceptBtn)

    const acceptLabel = this.add.text(panelX, acceptBtnY, 'Accept', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(13 * this.sf)}px`,
      color: '#ffffff',
    })
    acceptLabel.setOrigin(0.5, 0.5)
    acceptLabel.setDepth(13)
    this.overlayObjects.push(acceptLabel)

    acceptBtn.on('pointerdown', () => {
      this.clearOverlay()
      item.collected = true
      this.destroyItemSprite(item)
      this.events.emit('relicAccepted', relic)
      // Disintegrate all other uncollected card/relic items
      this.disintegrateRemainingItems(item)
      this.checkAutoAdvance()
    })

    // Leave button
    const leaveBtnY = panelY + panelH / 2 - 16 * this.sf
    const leaveBtn = this.add.graphics()
    leaveBtn.setDepth(12)
    leaveBtn.fillStyle(0x374151, 1)
    leaveBtn.fillRoundedRect(panelX - 50 * this.sf, leaveBtnY - 14 * this.sf, 100 * this.sf, 28 * this.sf, 6 * this.sf)
    leaveBtn.setInteractive(
      new Phaser.Geom.Rectangle(panelX - 50 * this.sf, leaveBtnY - 14 * this.sf, 100 * this.sf, 28 * this.sf),
      Phaser.Geom.Rectangle.Contains
    )
    this.overlayObjects.push(leaveBtn)

    const leaveLabel = this.add.text(panelX, leaveBtnY, 'Leave', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(12 * this.sf)}px`,
      color: '#9ca3af',
    })
    leaveLabel.setOrigin(0.5, 0.5)
    leaveLabel.setDepth(13)
    this.overlayObjects.push(leaveLabel)

    leaveBtn.on('pointerdown', () => {
      this.clearOverlay()
    })

    this.tweens.add({
      targets: [panel, iconText, title, rarityLabel, desc, acceptBtn, acceptLabel, leaveBtn, leaveLabel],
      scaleX: { from: 0.8, to: 1 },
      scaleY: { from: 0.8, to: 1 },
      duration: 200,
      ease: 'Sine.easeOut',
    })
  }

  /**
   * When a card/relic is accepted, disintegrate all other uncollected items.
   * Items blow to the right with particle effects and fade out.
   */
  private disintegrateRemainingItems(acceptedItem: ItemObject): void {
    const W = this.scale.width

    for (const item of this.items) {
      if (item === acceptedItem || item.collected) continue
      // Only disintegrate other cards and relics — gold and vials stay collectible
      if (item.reward.type !== 'card' && item.reward.type !== 'relic') continue
      item.collected = true  // Prevent further interaction

      const sprite = item.sprite as any
      const sx = sprite.x ?? 0
      const sy = sprite.y ?? 0

      // Spawn disintegration particles that fly right
      for (let i = 0; i < 12; i++) {
        const px = sx + (Math.random() - 0.5) * 30
        const py = sy + (Math.random() - 0.5) * 30
        const dot = this.add.circle(px, py, 2 + Math.random() * 2, 0xaaaaaa)
        dot.setDepth(6)
        dot.setAlpha(0.8)

        this.tweens.add({
          targets: dot,
          x: W + 40 + Math.random() * 60,
          y: py + (Math.random() - 0.5) * 80,
          alpha: 0,
          scale: 0.3,
          duration: 500 + Math.random() * 400,
          ease: 'Cubic.easeIn',
          delay: Math.random() * 150,
          onComplete: () => dot.destroy(),
        })
      }

      // Blow sprite to the right and fade
      this.tweens.add({
        targets: sprite,
        x: W + 100,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        rotation: 0.5 + Math.random() * 0.5,
        duration: 450,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          if (sprite.active) sprite.destroy()
        },
      })

      // Fade shadow
      this.tweens.add({
        targets: item.shadow,
        alpha: 0,
        duration: 300,
        ease: 'Linear',
        onComplete: () => {
          if (item.shadow.active) item.shadow.destroy()
        },
      })
    }
  }

  // ─── Continue Button ─────────────────────────────────────────────────────────

  private createContinueButton(W: number, H: number): void {
    const btnW = 160 * this.sf
    const btnH = 48 * this.sf
    const bx = W / 2
    const by = H * CONTINUE_Y_PCT

    const bg = this.add.graphics()
    bg.fillStyle(0x1f2937, 1)
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8 * this.sf)
    bg.lineStyle(2 * this.sf, 0x475569, 1)
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8 * this.sf)

    const label = this.add.text(0, 0, 'Continue', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(16 * this.sf)}px`,
      color: '#ffffff',
    })
    label.setOrigin(0.5, 0.5)

    this.continueButton = this.add.container(bx, by, [bg, label])
    this.continueButton.setDepth(8)
    this.continueButton.setSize(btnW, btnH)
    this.continueButton.setInteractive()

    this.continueButton.on('pointerdown', () => {
      this.onContinueTapped()
    })
  }

  private onContinueTapped(): void {
    const uncollected = this.items.filter((i) => !i.collected)
    if (uncollected.length > 0) {
      this.showLeaveConfirmation()
    } else {
      this.events.emit('sceneComplete')
    }
  }

  private showLeaveConfirmation(): void {
    const W = this.scale.width
    const H = this.scale.height

    // Remove any existing confirmation
    this.clearOverlay()

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5)
    dim.setDepth(14)
    dim.setInteractive()
    this.overlayObjects.push(dim)

    const panelW = 200 * this.sf
    const panelH = 120 * this.sf
    const panelX = W / 2
    const panelY = H / 2

    const panel = this.add.graphics()
    panel.setDepth(15)
    panel.fillStyle(0x1f2937, 1)
    panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 10 * this.sf)
    panel.lineStyle(2 * this.sf, 0x475569, 1)
    panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 10 * this.sf)
    this.overlayObjects.push(panel)

    const msg = this.add.text(panelX, panelY - 28 * this.sf, 'Leave items behind?', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(12 * this.sf)}px`,
      color: '#e2e8f0',
      align: 'center',
      wordWrap: { width: panelW - 20 * this.sf },
    })
    msg.setOrigin(0.5, 0.5)
    msg.setDepth(16)
    this.overlayObjects.push(msg)

    // Yes button
    const yesBtn = this.add.graphics()
    yesBtn.setDepth(16)
    yesBtn.fillStyle(0xdc2626, 1)
    yesBtn.fillRoundedRect(panelX - 80 * this.sf, panelY + 8 * this.sf, 70 * this.sf, 28 * this.sf, 5 * this.sf)
    yesBtn.setInteractive(
      new Phaser.Geom.Rectangle(panelX - 80 * this.sf, panelY + 8 * this.sf, 70 * this.sf, 28 * this.sf),
      Phaser.Geom.Rectangle.Contains
    )
    this.overlayObjects.push(yesBtn)

    const yesLabel = this.add.text(panelX - 45 * this.sf, panelY + 22 * this.sf, 'Yes', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(12 * this.sf)}px`,
      color: '#ffffff',
    })
    yesLabel.setOrigin(0.5, 0.5)
    yesLabel.setDepth(17)
    this.overlayObjects.push(yesLabel)

    yesBtn.on('pointerdown', () => {
      this.clearOverlay()
      this.events.emit('sceneComplete')
    })

    // No button
    const noBtn = this.add.graphics()
    noBtn.setDepth(16)
    noBtn.fillStyle(0x374151, 1)
    noBtn.fillRoundedRect(panelX + 10 * this.sf, panelY + 8 * this.sf, 70 * this.sf, 28 * this.sf, 5 * this.sf)
    noBtn.setInteractive(
      new Phaser.Geom.Rectangle(panelX + 10 * this.sf, panelY + 8 * this.sf, 70 * this.sf, 28 * this.sf),
      Phaser.Geom.Rectangle.Contains
    )
    this.overlayObjects.push(noBtn)

    const noLabel = this.add.text(panelX + 45 * this.sf, panelY + 22 * this.sf, 'No', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(12 * this.sf)}px`,
      color: '#9ca3af',
    })
    noLabel.setOrigin(0.5, 0.5)
    noLabel.setDepth(17)
    this.overlayObjects.push(noLabel)

    noBtn.on('pointerdown', () => {
      this.clearOverlay()
    })
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private clearOverlay(): void {
    for (const obj of this.overlayObjects) {
      if (obj && obj.active) {
        obj.destroy()
      }
    }
    this.overlayObjects = []
  }

  private destroyItemSprite(item: ItemObject): void {
    const sx = (item.sprite as any).x ?? 0
    const sy = (item.sprite as any).y ?? 0
    this.tweens.add({
      targets: item.sprite,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
      onComplete: () => item.sprite.destroy(),
    })
    this.tweens.add({
      targets: item.shadow,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
      onComplete: () => item.shadow.destroy(),
    })
    void sx; void sy
  }

  private burstParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
      const dist = 60 + Math.random() * 60
      const tx = x + Math.cos(angle) * dist * 0.4
      const ty = y - 60 - Math.random() * 60

      const dot = this.add.circle(x, y, 3, color)
      dot.setDepth(6)
      dot.setAlpha(1)

      this.tweens.add({
        targets: dot,
        x: tx,
        y: ty,
        alpha: 0,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      })
    }
  }

  private addShimmerEffect(x: number, y: number, w: number, h: number): void {
    // Spawn periodic sparkle particles around the item
    const spawnSparkle = (): void => {
      if (!this.scene.isActive()) return
      const sx = x + (Math.random() - 0.5) * w
      const sy = y + (Math.random() - 0.5) * h
      const dot = this.add.circle(sx, sy, 1.5, 0xffffff)
      dot.setAlpha(0)
      dot.setDepth(4)

      this.tweens.add({
        targets: dot,
        alpha: { from: 0, to: 0.8 },
        scale: { from: 0.5, to: 1.5 },
        duration: 400,
        yoyo: true,
        onComplete: () => dot.destroy(),
      })
    }

    // Spawn a sparkle every 800-1500ms
    this.time.addEvent({
      delay: 800 + Math.random() * 700,
      callback: spawnSparkle,
      loop: true,
    })
  }

  private floatingText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: `${Math.round(18 * this.sf)}px`,
      color,
      stroke: '#000000',
      strokeThickness: 3 * this.sf,
    })
    t.setOrigin(0.5, 0.5)
    t.setDepth(7)

    this.tweens.add({
      targets: t,
      y: y - 50 * this.sf,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    })
  }

  private parseGoldTiers(): GoldTierEntry[] {
    const raw = this.cache.json.get('gold_tiers')
    if (!raw || !Array.isArray(raw)) {
      // Fallback defaults
      return [
        { tier: 0, key: 'gold_tier_0', minGold: 0, maxGold: 10 },
        { tier: 1, key: 'gold_tier_1', minGold: 11, maxGold: 25 },
        { tier: 2, key: 'gold_tier_2', minGold: 26, maxGold: 50 },
        { tier: 3, key: 'gold_tier_3', minGold: 51, maxGold: 100 },
        { tier: 4, key: 'gold_tier_4', minGold: 101, maxGold: 200 },
        { tier: 5, key: 'gold_tier_5', minGold: 201, maxGold: null },
      ]
    }
    return raw as GoldTierEntry[]
  }

  private getGoldTier(amount: number): GoldTierEntry | undefined {
    return this.goldTiers.find(
      (t) => amount >= t.minGold && (t.maxGold === null || amount <= t.maxGold)
    )
  }

  // ─── Update Loop ─────────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    this.updateFireflies(time, delta)
    this.updateItemBobs(time)
  }

  // ─── Shutdown ────────────────────────────────────────────────────────────────

  /**
   * Clean up all tweens, timers, and game objects when the scene stops.
   */
  shutdown(): void {
    this.tweens.killAll()
    this.time.removeAllEvents()
    this.clearOverlay()

    for (const fly of this.fireflies) {
      if (fly.sprite && fly.sprite.active) {
        fly.sprite.destroy()
      }
    }
    this.fireflies = []

    for (const item of this.items) {
      if (item.sprite && (item.sprite as any).active) {
        item.sprite.destroy()
      }
      if (item.shadow && item.shadow.active) {
        item.shadow.destroy()
      }
    }
    this.items = []
  }
}
