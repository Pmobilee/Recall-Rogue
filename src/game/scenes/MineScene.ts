import Phaser from 'phaser'
import { BALANCE } from '../../data/balance'
import { BlockType, type InventorySlot, type MineCell, type MineralTier, type Rarity, type Relic, type RunUpgrade } from '../../data/types'
import { type Biome, DEFAULT_BIOME } from '../../data/biomes'
import { getActiveSynergies, pickRandomRelic, type SynergyEffect } from '../../data/relics'
import { type CompanionEffect } from '../../data/fossils'
import { Player } from '../entities/Player'
import { canMine, mineBlock } from '../systems/MiningSystem'
import { generateMine, revealAround, seededRandom } from '../systems/MineGenerator'
import {
  addOxygen,
  consumeOxygen,
  createOxygenState,
  getOxygenCostForBlock,
  type OxygenState,
} from '../systems/OxygenSystem'
import { audioManager } from '../../services/audioService'
import { pickQuote } from '../../data/quotes'

const TILE_SIZE = BALANCE.TILE_SIZE

const BLOCK_COLORS: Record<BlockType, number> = {
  [BlockType.Empty]: 0x3a3550,
  [BlockType.Dirt]: 0x5c4033,
  [BlockType.SoftRock]: 0x7a6652,
  [BlockType.Stone]: 0x6b6b6b,
  [BlockType.HardRock]: 0x4a4a4a,
  [BlockType.MineralNode]: 0x4ecca3,
  [BlockType.ArtifactNode]: 0xe94560,
  [BlockType.OxygenCache]: 0x5dade2,
  [BlockType.QuizGate]: 0xffd369,
  [BlockType.UpgradeCrate]: 0xc49b1a,
  [BlockType.ExitLadder]: 0x00ff88,
  [BlockType.DescentShaft]: 0x6633cc,
  [BlockType.RelicShrine]: 0xd4af37,
  [BlockType.QuoteStone]: 0x7788aa,
  [BlockType.LavaBlock]: 0xcc3300,
  [BlockType.GasPocket]: 0x446633,
  [BlockType.UnstableGround]: 0x8B7355,
  [BlockType.SendUpStation]: 0x44aadd,
  [BlockType.OxygenTank]: 0x00ccaa,
  [BlockType.DataDisc]: 0x22aacc,
  [BlockType.FossilNode]: 0xd4a574,
  [BlockType.Unbreakable]: 0x2c2c2c,
}

export interface MineSceneData {
  seed: number
  oxygenTanks: number
  inventorySlots: number
  facts: string[]
  layer?: number
  inventory?: InventorySlot[]
  blocksMinedThisRun?: number
  artifactsFound?: string[]
  collectedRelics?: Relic[]
  /** Optional biome override — if absent the scene picks one deterministically from seed+layer. */
  biome?: Biome
  /** Active fossil companion effect for this dive (null/absent = no companion). */
  companionEffect?: CompanionEffect | null
}

export class MineScene extends Phaser.Scene {
  private seed = 0
  private oxygenTanks: number = BALANCE.STARTING_OXYGEN_TANKS
  private grid: MineCell[][] = []
  private player!: Player
  private oxygenState!: OxygenState
  private inventory: InventorySlot[] = []
  private inventorySlots: number = BALANCE.STARTING_INVENTORY_SLOTS
  private tileGraphics!: Phaser.GameObjects.Graphics
  private overlayGraphics!: Phaser.GameObjects.Graphics
  private playerSprite!: Phaser.GameObjects.Image
  private breakEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private itemSpritePool: Phaser.GameObjects.Image[] = []
  private itemSpritePoolIndex = 0
  private cameraTarget!: Phaser.GameObjects.Zone
  private flashTiles = new Map<string, number>()
  private facts: string[] = []
  private blocksMinedThisRun = 0
  private artifactsFound: string[] = []
  private gridWidth = 0
  private gridHeight = 0
  private isPaused = false
  private oxygenWarningPlayed = false
  private passedPointOfNoReturn = false
  private pendingOxygenReward = 0
  private pendingArtifactSlot: InventorySlot | null = null
  private pendingArtifactQuestions: number = 0
  private pendingArtifactBoosts: number = 0
  private activeUpgrades: Map<RunUpgrade, number> = new Map()
  /** Relics collected this run — provides persistent passive bonuses. */
  private collectedRelics: Relic[] = []
  /** Seeded RNG for relic selection (deterministic per seed). */
  private rng: () => number = Math.random
  /** Zero-based layer index for this dive session. */
  private currentLayer = 0
  /** Items secured via send-up station — preserved across layers and never lost on forced surface. */
  public sentUpItems: InventorySlot[] = []
  /** The active biome for this mine layer — controls visual palette and generation weights. */
  private currentBiome: Biome = DEFAULT_BIOME
  /** Number of blocks mined since the last earthquake (for cooldown tracking). */
  private blocksSinceLastQuake: number = 0
  /** Current pickaxe tier index (into BALANCE.PICKAXE_TIERS). 0 = Stone Pick. */
  private pickaxeTierIndex: number = 0
  /** Current scanner tier index (into BALANCE.SCANNER_TIERS). 0 = Basic Scanner. */
  private scannerTierIndex: number = 0
  /** How many temporary backpack expansions have been collected this run (resets each dive). */
  private backpackExpansionCount: number = 0
  /** Active fossil companion effect for this dive. Null if no companion is equipped. */
  private companionEffect: CompanionEffect | null = null
  /** Tracks whether the companion effect triggered on the last mining action (for badge flash). */
  public companionFlash: boolean = false

  constructor() {
    super({ key: 'MineScene' })
  }

  /**
   * Initializes the run state from scene data.
   */
  init(data: Partial<MineSceneData> = {}): void {
    this.seed = data.seed ?? (Date.now() >>> 0)
    this.oxygenTanks = data.oxygenTanks ?? BALANCE.STARTING_OXYGEN_TANKS
    this.inventorySlots = data.inventorySlots ?? BALANCE.STARTING_INVENTORY_SLOTS
    this.facts = data.facts ?? []
    this.currentLayer = data.layer ?? 0
    // Carry over persistent run data when descending layers.
    this.blocksMinedThisRun = data.blocksMinedThisRun ?? 0
    this.artifactsFound = data.artifactsFound ? [...data.artifactsFound] : []
    this.isPaused = false
    this.oxygenWarningPlayed = false
    this.passedPointOfNoReturn = false
    this.pendingOxygenReward = 0
    this.pendingArtifactSlot = null
    this.pendingArtifactQuestions = 0
    this.pendingArtifactBoosts = 0
    this.flashTiles.clear()
    this.activeUpgrades = new Map()
    this.blocksSinceLastQuake = 0
    this.scannerTierIndex = 0
    this.pickaxeTierIndex = 0
    this.backpackExpansionCount = 0
    // Only reset relics/sentUpItems on fresh layer-0 starts; carry them over on layer descent.
    if ((data.layer ?? 0) === 0) {
      this.collectedRelics = []
      this.sentUpItems = []
    } else if (data.collectedRelics) {
      this.collectedRelics = [...data.collectedRelics]
    }
    this.rng = seededRandom((data.seed ?? Date.now()) ^ 0xdeadbeef)
    // Store biome passed from GameManager (if any); create() will pick one if absent.
    if (data.biome) {
      this.currentBiome = data.biome
    }
    // Capture companion effect for this layer.
    this.companionEffect = data.companionEffect ?? null
    this.companionFlash = false
  }

  /**
   * Creates mine state, camera, rendering layers, and input handlers.
   */
  create(): void {
    audioManager.unlock()
    const mineResult = generateMine(this.seed, BALANCE.MINE_WIDTH, BALANCE.MINE_LAYER_HEIGHT, this.facts, this.currentLayer, this.currentBiome)
    this.grid = mineResult.grid
    this.currentBiome = mineResult.biome
    this.gridHeight = this.grid.length
    this.gridWidth = this.gridHeight > 0 ? this.grid[0].length : 0
    this.oxygenState = createOxygenState(this.oxygenTanks)
    // On layer descents, inventory is pre-loaded via init(); only reset on fresh layer-0 starts.
    if (this.currentLayer === 0) {
      this.inventory = Array.from({ length: this.inventorySlots }, () => ({ type: 'empty' as const }))
    }

    // Spawn anywhere in the mine — position is seeded so it's deterministic per seed
    const startY = mineResult.spawnY
    const startX = mineResult.spawnX

    this.player = new Player(startX, startY)

    // Ensure starting area is empty (3x3 around player)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = startX + dx
        const y = startY + dy
        if (y >= 0 && y < this.gridHeight && x >= 0 && x < this.gridWidth) {
          this.grid[y][x] = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }
      }
    }

    this.tileGraphics = this.add.graphics()
    this.tileGraphics.setDepth(0)

    this.overlayGraphics = this.add.graphics()
    this.overlayGraphics.setDepth(7)

    this.playerSprite = this.add.image(
      startX * TILE_SIZE + TILE_SIZE * 0.5,
      startY * TILE_SIZE + TILE_SIZE * 0.5,
      'miner_idle'
    )
    this.playerSprite.setDisplaySize(TILE_SIZE, TILE_SIZE)
    this.playerSprite.setDepth(10)

    const particleTextureKey = 'break-particle'
    if (!this.textures.exists(particleTextureKey)) {
      const particleGraphics = this.make.graphics({ x: 0, y: 0 })
      particleGraphics.fillStyle(0xffffff, 1)
      particleGraphics.fillRect(0, 0, 4, 4)
      particleGraphics.generateTexture(particleTextureKey, 4, 4)
      particleGraphics.destroy()
    }

    this.breakEmitter = this.add.particles(0, 0, particleTextureKey, {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 400,
      quantity: 6,
      emitting: false,
    })

    this.cameraTarget = this.add.zone(
      startX * TILE_SIZE + TILE_SIZE * 0.5,
      startY * TILE_SIZE + TILE_SIZE * 0.5,
      1,
      1,
    )

    const worldWidth = this.gridWidth * TILE_SIZE
    const worldHeight = this.gridHeight * TILE_SIZE
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight)

    this.redrawAll()
    revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)

    // Apply companion create() effects
    if (this.companionEffect) {
      if (this.companionEffect.type === 'reveal_exit') {
        // Reveal the exit ladder and surrounding area on the minimap/fog
        this.applyCompanionRevealExit()
      }
      if (this.companionEffect.type === 'scout_drone') {
        // Reveal a random cluster of unexplored tiles to simulate a scouting drone
        this.applyCompanionScoutDrone()
      }
    }

    this.redrawAll()

    this.input.on('pointerdown', this.handlePointerDown, this)
    this.input.keyboard?.on('keydown', this.handleKeyDown, this)

    this.game.events.emit('mine-started', {
      seed: this.seed,
      oxygen: this.oxygenState,
      inventorySlots: this.inventorySlots,
      layer: this.currentLayer,
    })
  }

  /**
   * Phaser update loop — redraws the visible mine each frame.
   */
  update(): void {
    this.redrawAll()
  }

  private redrawAll(): void {
    this.updateCameraTarget()
    this.drawTiles()
    this.drawPlayer()
  }

  private updateCameraTarget(): void {
    const targetX = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
    const targetY = this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5

    this.cameraTarget.setPosition(targetX, targetY)

    const cam = this.cameras.main
    const desiredX = targetX - cam.width / 2
    const desiredY = targetY - cam.height / 2
    const lerp = 0.15

    cam.scrollX += (desiredX - cam.scrollX) * lerp
    cam.scrollY += (desiredY - cam.scrollY) * lerp
  }

  private shiftColor(color: number, amount: number): number {
    const r = Phaser.Math.Clamp(((color >> 16) & 0xff) + amount, 0, 255)
    const g = Phaser.Math.Clamp(((color >> 8) & 0xff) + amount, 0, 255)
    const b = Phaser.Math.Clamp((color & 0xff) + amount, 0, 255)
    return (r << 16) | (g << 8) | b
  }

  private seededModulo(tileX: number, tileY: number, salt: number, modulo: number): number {
    const rawSeed = tileX * 31 + tileY * 17 + salt * 13
    const positiveSeed = ((rawSeed % 7919) + 7919) % 7919
    return positiveSeed % modulo
  }

  private drawBlockPattern(cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
    const cx = px + TILE_SIZE * 0.5
    const cy = py + TILE_SIZE * 0.5
    switch (cell.type) {
      case BlockType.Dirt:
        this.getPooledSprite('tile_dirt', cx, cy)
        break
      case BlockType.SoftRock:
        this.getPooledSprite('tile_soft_rock', cx, cy)
        break
      case BlockType.Stone:
        this.getPooledSprite('tile_stone', cx, cy)
        break
      case BlockType.HardRock:
        this.getPooledSprite('tile_hard_rock', cx, cy)
        break
      case BlockType.Unbreakable:
        this.getPooledSprite('tile_unbreakable', cx, cy)
        break
      case BlockType.OxygenCache:
        this.getPooledSprite('block_oxygen_cache', cx, cy)
        break
      case BlockType.UpgradeCrate:
        this.getPooledSprite('block_upgrade_crate', cx, cy)
        break
      case BlockType.QuizGate:
        this.getPooledSprite('block_quiz_gate', cx, cy)
        break
      case BlockType.ExitLadder:
        this.getPooledSprite('block_exit_ladder', cx, cy)
        break
      case BlockType.DescentShaft: {
        // Deep purple block with a downward chevron arrow drawn procedurally.
        // Base color (0x6633cc) is rendered as the background rect in drawTiles.
        // Draw a lighter inner border to give it a "portal" look.
        this.overlayGraphics.lineStyle(2, 0x9966ff, 0.9)
        const inset = 4
        this.overlayGraphics.strokeRect(px + inset, py + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2)
        // Draw a downward-pointing chevron arrow in the center.
        const midX = px + TILE_SIZE * 0.5
        const arrowTop = py + 8
        const arrowMid = py + TILE_SIZE * 0.55
        const arrowBot = py + TILE_SIZE - 8
        const arrowHalf = TILE_SIZE * 0.3
        this.overlayGraphics.lineStyle(2, 0xddaaff, 0.95)
        // Top-left to midpoint
        this.overlayGraphics.lineBetween(midX - arrowHalf, arrowTop, midX, arrowMid)
        // Top-right to midpoint
        this.overlayGraphics.lineBetween(midX + arrowHalf, arrowTop, midX, arrowMid)
        // Bottom tip
        this.overlayGraphics.lineBetween(midX, arrowMid, midX, arrowBot)
        break
      }
      case BlockType.MineralNode: {
        const tier = cell.content?.mineralType ?? 'dust'
        if (tier === 'geode') {
          // Geode: purple-tinted sprite with bright crystalline inner dot and outline
          const sprite = this.getPooledSprite('mineral_red', cx, cy)
          sprite.setTint(0x9b59b6)
          this.overlayGraphics.fillStyle(0xda70d6, 0.85)
          this.overlayGraphics.fillCircle(cx, cy, 5)
          this.overlayGraphics.lineStyle(1, 0xffffff, 0.6)
          this.overlayGraphics.strokeCircle(cx, cy, 8)
        } else if (tier === 'essence') {
          // Primordial Essence: white/gold tinted relic sprite with radiating gold star rays
          const sprite = this.getPooledSprite('relic_gold', cx, cy)
          sprite.setTint(0xfffde7)
          const r = TILE_SIZE * 0.38
          this.overlayGraphics.lineStyle(2, 0xffd700, 0.9)
          this.overlayGraphics.lineBetween(cx, cy - r, cx, cy + r)
          this.overlayGraphics.lineBetween(cx - r, cy, cx + r, cy)
          const rd = r * 0.65
          this.overlayGraphics.lineStyle(1, 0xffd700, 0.55)
          this.overlayGraphics.lineBetween(cx - rd, cy - rd, cx + rd, cy + rd)
          this.overlayGraphics.lineBetween(cx + rd, cy - rd, cx - rd, cy + rd)
          this.overlayGraphics.fillStyle(0xffffff, 1)
          this.overlayGraphics.fillCircle(cx, cy, 3)
        } else {
          const key = tier === 'crystal' ? 'mineral_red'
            : tier === 'shard' ? 'mineral_green'
            : 'mineral_blue'
          this.getPooledSprite(key, cx, cy)
        }
        break
      }
      case BlockType.ArtifactNode: {
        const key = cell.content?.factId ? 'relic_tablet' : 'relic_gold'
        this.getPooledSprite(key, cx, cy)
        break
      }
      case BlockType.LavaBlock: {
        // Base color (0xcc3300) is already drawn as the background rect in drawTiles.
        // Draw bright lava highlight lines to suggest flowing lava.
        this.overlayGraphics.lineStyle(2, 0xff6600, 0.75)
        // Three wavy horizontal stripes at different y offsets
        const stripeOffsets = [6, 14, 22]
        for (const offset of stripeOffsets) {
          const waveAmp = this.seededModulo(tileX, tileY, offset, 3) - 1  // -1, 0, or 1
          this.overlayGraphics.lineBetween(
            px + 2, py + offset + waveAmp,
            px + TILE_SIZE - 2, py + offset - waveAmp,
          )
        }
        // A few bright highlight dots
        this.overlayGraphics.fillStyle(0xff8800, 0.6)
        const dotX = px + 4 + this.seededModulo(tileX, tileY, 7, TILE_SIZE - 8)
        const dotY = py + 4 + this.seededModulo(tileX, tileY, 11, TILE_SIZE - 8)
        this.overlayGraphics.fillCircle(dotX, dotY, 2)
        break
      }
      case BlockType.GasPocket: {
        // Base color (0x446633) is already drawn in drawTiles.
        // Draw lighter speckles to suggest rising gas bubbles.
        this.overlayGraphics.fillStyle(0x88aa55, 0.65)
        const bubbleCount = 4
        for (let i = 0; i < bubbleCount; i++) {
          const bx = px + 3 + this.seededModulo(tileX, tileY, i * 5, TILE_SIZE - 6)
          const by = py + 3 + this.seededModulo(tileX, tileY, i * 7 + 3, TILE_SIZE - 6)
          const radius = 1 + this.seededModulo(tileX, tileY, i * 3 + 1, 2)
          this.overlayGraphics.fillCircle(bx, by, radius)
        }
        break
      }
      case BlockType.UnstableGround: {
        // Base color (0x8B7355) is already drawn in drawTiles.
        // Draw darker brown crack lines to suggest cracked, unstable earth.
        this.overlayGraphics.lineStyle(1, 0x5a4020, 0.85)
        // Crack 1: diagonal from upper-left area to lower-right area
        const c1x1 = px + 4 + this.seededModulo(tileX, tileY, 3, 6)
        const c1y1 = py + 3
        const c1x2 = px + TILE_SIZE - 5 - this.seededModulo(tileX, tileY, 7, 4)
        const c1y2 = py + TILE_SIZE - 4
        this.overlayGraphics.lineBetween(c1x1, c1y1, c1x2, c1y2)
        // Crack 2: shorter diagonal in opposite direction (upper-right to mid-left)
        const c2x1 = px + TILE_SIZE - 6
        const c2y1 = py + 5 + this.seededModulo(tileX, tileY, 11, 5)
        const c2x2 = px + 8 + this.seededModulo(tileX, tileY, 13, 4)
        const c2y2 = py + TILE_SIZE * 0.6
        this.overlayGraphics.lineBetween(c2x1, c2y1, c2x2, c2y2)
        // Crack 3: small branch off crack 1 midpoint
        const midX = Math.floor((c1x1 + c1x2) / 2)
        const midY = Math.floor((c1y1 + c1y2) / 2)
        this.overlayGraphics.lineBetween(midX, midY, midX + 5, midY - 4)
        break
      }
      case BlockType.QuoteStone: {
        // Blue-grey stone tablet with 3 carved horizontal text lines.
        // Base color (0x7788aa) is drawn as background rect in drawTiles.
        // Draw a slightly lighter inner border to frame the tablet face.
        const tabletInset = 4
        this.overlayGraphics.lineStyle(1, 0x99aacc, 0.8)
        this.overlayGraphics.strokeRect(
          px + tabletInset,
          py + tabletInset,
          TILE_SIZE - tabletInset * 2,
          TILE_SIZE - tabletInset * 2,
        )
        // Three horizontal carved-text lines across the stone face
        const lineMargin = 7
        const lineOffsets = [10, 16, 22]
        for (const lineOffset of lineOffsets) {
          this.overlayGraphics.lineStyle(1, 0x99aacc, 0.7)
          this.overlayGraphics.lineBetween(
            px + lineMargin,
            py + lineOffset,
            px + TILE_SIZE - lineMargin,
            py + lineOffset,
          )
        }
        break
      }
      case BlockType.RelicShrine: {
        // Base color (0xd4af37 gold) already drawn in drawTiles.
        // Golden pedestal base with a bright 4-pointed diamond star on top.
        const pedestalH = Math.round(TILE_SIZE * 0.35)
        const pedestalW = Math.round(TILE_SIZE * 0.6)
        const pedestalX = px + (TILE_SIZE - pedestalW) / 2
        const pedestalY = py + TILE_SIZE - pedestalH - 3
        this.overlayGraphics.fillStyle(0xffcc00, 0.9)
        this.overlayGraphics.fillRect(pedestalX, pedestalY, pedestalW, pedestalH)
        this.overlayGraphics.lineStyle(1, 0xffeebb, 0.95)
        this.overlayGraphics.lineBetween(pedestalX, pedestalY, pedestalX + pedestalW, pedestalY)
        const starCx = px + TILE_SIZE * 0.5
        const starCy = py + TILE_SIZE * 0.35
        const outerR = TILE_SIZE * 0.22
        const innerR = TILE_SIZE * 0.10
        this.overlayGraphics.fillStyle(0xffffff, 0.95)
        const starPoints: { x: number; y: number }[] = []
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4 - Math.PI / 4
          const r = i % 2 === 0 ? outerR : innerR
          starPoints.push({ x: starCx + Math.cos(angle) * r, y: starCy + Math.sin(angle) * r })
        }
        this.overlayGraphics.fillPoints(starPoints, true)
        this.overlayGraphics.lineStyle(1, 0xffee44, 0.7)
        this.overlayGraphics.strokeCircle(starCx, starCy, outerR + 2)
        break
      }
      case BlockType.SendUpStation: {
        // Bright blue teleporter pad. Base color (0x44aadd) is drawn in drawTiles.
        // Draw inner border to give it a "pad" look.
        this.overlayGraphics.lineStyle(2, 0x88ddff, 0.9)
        const suInset = 3
        this.overlayGraphics.strokeRect(px + suInset, py + suInset, TILE_SIZE - suInset * 2, TILE_SIZE - suInset * 2)
        // Draw an upward-pointing arrow in white/cyan.
        const suMidX = px + TILE_SIZE * 0.5
        const suArrowBot = py + TILE_SIZE - 7
        const suArrowMid = py + TILE_SIZE * 0.45
        const suArrowTop = py + 7
        const suArrowHalf = TILE_SIZE * 0.28
        this.overlayGraphics.lineStyle(2, 0xffffff, 0.95)
        this.overlayGraphics.lineBetween(suMidX, suArrowBot, suMidX, suArrowMid)
        this.overlayGraphics.lineBetween(suMidX, suArrowTop, suMidX - suArrowHalf, suArrowMid)
        this.overlayGraphics.lineBetween(suMidX, suArrowTop, suMidX + suArrowHalf, suArrowMid)
        this.overlayGraphics.fillStyle(0x88ffff, 0.7)
        this.overlayGraphics.fillCircle(px + 5, py + 5, 2)
        this.overlayGraphics.fillCircle(px + TILE_SIZE - 5, py + 5, 2)
        this.overlayGraphics.fillCircle(px + 5, py + TILE_SIZE - 5, 2)
        this.overlayGraphics.fillCircle(px + TILE_SIZE - 5, py + TILE_SIZE - 5, 2)
        break
      }
      case BlockType.OxygenTank: {
        // Bright teal permanent-upgrade tank. Base color (0x00ccaa) drawn in drawTiles.
        // Tank body: teal rectangle with a white valve circle on top and a "+" pickup indicator.
        const tankBodyW = Math.round(TILE_SIZE * 0.45)
        const tankBodyH = Math.round(TILE_SIZE * 0.6)
        const tankBodyX = px + (TILE_SIZE - tankBodyW) / 2
        const tankBodyY = py + TILE_SIZE - tankBodyH - 4
        this.overlayGraphics.fillStyle(0x00ffcc, 0.85)
        this.overlayGraphics.fillRect(tankBodyX, tankBodyY, tankBodyW, tankBodyH)
        // Valve cap: white circle at the top center of the tank body
        const valveX = px + TILE_SIZE * 0.5
        const valveY = tankBodyY - 3
        this.overlayGraphics.fillStyle(0xffffff, 1)
        this.overlayGraphics.fillCircle(valveX, valveY, 4)
        // Inner shine stripe on tank body
        this.overlayGraphics.fillStyle(0xaaffee, 0.55)
        this.overlayGraphics.fillRect(tankBodyX + 3, tankBodyY + 4, 3, tankBodyH - 8)
        // "+" symbol in white on tank body to indicate it's a bonus/pickup
        const plusCx = px + TILE_SIZE * 0.5
        const plusCy = tankBodyY + tankBodyH * 0.5
        this.overlayGraphics.lineStyle(2, 0xffffff, 0.95)
        this.overlayGraphics.lineBetween(plusCx - 5, plusCy, plusCx + 5, plusCy)
        this.overlayGraphics.lineBetween(plusCx, plusCy - 5, plusCx, plusCy + 5)
        break
      }
      case BlockType.DataDisc: {
        // Data Disc — glowing cyan CD/disc shape with a white horizontal stripe and center dot.
        // Base color (0x22aacc) drawn as background in drawTiles.
        const discRadius = Math.round(TILE_SIZE * 0.35)
        // Outer disc: bright cyan circle
        this.overlayGraphics.fillStyle(0x44ddff, 0.90)
        this.overlayGraphics.fillCircle(cx, cy, discRadius)
        // Inner ring gap: dark circle to create the disc ring look
        this.overlayGraphics.fillStyle(0x112233, 0.85)
        this.overlayGraphics.fillCircle(cx, cy, Math.round(discRadius * 0.55))
        // Center hole: tiny bright dot
        this.overlayGraphics.fillStyle(0xffffff, 1)
        this.overlayGraphics.fillCircle(cx, cy, 3)
        // Horizontal data stripe across the middle
        this.overlayGraphics.fillStyle(0xffffff, 0.75)
        this.overlayGraphics.fillRect(cx - discRadius + 3, cy - 2, (discRadius - 3) * 2, 3)
        // Glow effect: subtle outer ring
        this.overlayGraphics.lineStyle(1, 0x88eeff, 0.50)
        this.overlayGraphics.strokeCircle(cx, cy, discRadius + 2)
        break
      }
      case BlockType.FossilNode: {
        // Fossil Node — amber/brown base (0xd4a574) drawn in drawTiles.
        // Draw a bone-like pattern: two oval ends connected by a narrow shaft.
        const boneW = Math.round(TILE_SIZE * 0.55)
        const boneH = Math.round(TILE_SIZE * 0.18)
        const knobR = Math.round(TILE_SIZE * 0.14)
        // Central shaft in off-white/cream
        this.overlayGraphics.fillStyle(0xf5e6c8, 0.90)
        this.overlayGraphics.fillRect(cx - boneW / 2, cy - boneH / 2, boneW, boneH)
        // Left knob
        this.overlayGraphics.fillStyle(0xfff4e0, 0.95)
        this.overlayGraphics.fillCircle(cx - boneW / 2 + knobR, cy, knobR + 2)
        // Right knob
        this.overlayGraphics.fillCircle(cx + boneW / 2 - knobR, cy, knobR + 2)
        // Subtle amber highlight across shaft
        this.overlayGraphics.fillStyle(0xc8844a, 0.35)
        this.overlayGraphics.fillRect(cx - boneW / 2 + knobR, cy - 1, boneW - knobR * 2, 2)
        // Faint border
        this.overlayGraphics.lineStyle(1, 0x8b5e3c, 0.60)
        this.overlayGraphics.strokeRect(cx - boneW / 2, cy - boneH / 2, boneW, boneH)
        break
      }
      default:
        break
    }
  }

  private getPooledSprite(key: string, x: number, y: number): Phaser.GameObjects.Image {
    let sprite = this.itemSpritePool[this.itemSpritePoolIndex]
    if (!sprite) {
      sprite = this.add.image(x, y, key)
      this.itemSpritePool.push(sprite)
    } else {
      sprite.setTexture(key)
      sprite.setPosition(x, y)
      sprite.setVisible(true)
    }
    sprite.setDisplaySize(TILE_SIZE, TILE_SIZE)
    sprite.setDepth(5)
    this.itemSpritePoolIndex++
    return sprite
  }

  private drawTiles(): void {
    this.itemSpritePoolIndex = 0
    this.itemSpritePool.forEach(s => s.setVisible(false))
    this.tileGraphics.clear()
    this.overlayGraphics.clear()

    const camera = this.cameras.main
    const viewWidth = camera.worldView.width > 0 ? camera.worldView.width : camera.width
    const viewHeight = camera.worldView.height > 0 ? camera.worldView.height : camera.height
    const viewX = camera.worldView.width > 0 ? camera.worldView.x : camera.scrollX
    const viewY = camera.worldView.height > 0 ? camera.worldView.y : camera.scrollY

    const startX = Math.max(0, Math.floor(viewX / TILE_SIZE) - 1)
    const endX = Math.min(this.gridWidth - 1, Math.ceil((viewX + viewWidth) / TILE_SIZE) + 1)
    const startY = Math.max(0, Math.floor(viewY / TILE_SIZE) - 1)
    const endY = Math.min(this.gridHeight - 1, Math.ceil((viewY + viewHeight) / TILE_SIZE) + 1)

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const cell = this.grid[y][x]
        const px = x * TILE_SIZE
        const py = y * TILE_SIZE

        if (!cell.revealed) {
          const scannerCount = this.activeUpgrades.get('scanner_boost') ?? 0
          const tierInfo = BALANCE.SCANNER_TIERS[this.scannerTierIndex]
          const visLevel = cell.visibilityLevel ?? 0

          if (visLevel === 1) {
            // Ring 1: render actual tile sprite, dimmed by overlay
            const borderBrightness = Math.min(0.90, 0.80 + scannerCount * 0.05)
            // Biome fog tint background in case sprite has transparency
            this.tileGraphics.fillStyle(this.currentBiome.fogTint, 1)
            this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            // Render the tile sprite (depth 5)
            this.drawBlockPattern(cell, x, y, px, py)
            // Dim overlay on overlayGraphics (depth 7) to create fog effect
            const dimAmount = 1.0 - borderBrightness
            this.overlayGraphics.fillStyle(0x000000, dimAmount)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            // Rarity hint: gold shimmer for artifacts, colored dot for minerals (Advanced+ scanner)
            if (tierInfo.showsRarity) {
              if (cell.type === BlockType.ArtifactNode) {
                this.overlayGraphics.lineStyle(2, 0xffd700, 0.75)
                this.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
                this.overlayGraphics.fillStyle(0xffd700, 0.35)
                this.overlayGraphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
              } else if (cell.type === BlockType.MineralNode) {
                const tier = cell.content?.mineralType ?? 'dust'
                const dotColor = tier === 'essence' ? 0xffffff
                  : tier === 'geode' ? 0xda70d6
                  : tier === 'crystal' ? 0xff4444
                  : tier === 'shard' ? 0x44ff88
                  : 0x4ecca3
                this.overlayGraphics.fillStyle(dotColor, 0.85)
                this.overlayGraphics.fillCircle(px + TILE_SIZE - 6, py + 6, 4)
                this.overlayGraphics.lineStyle(1, dotColor, 0.5)
                this.overlayGraphics.strokeCircle(px + TILE_SIZE - 6, py + 6, 5)
              }
            }
            // Hazard hint: small red warning indicator for hazardous blocks (Enhanced+ scanner)
            if (tierInfo.showsHazards) {
              if (
                cell.type === BlockType.LavaBlock ||
                cell.type === BlockType.GasPocket ||
                cell.type === BlockType.UnstableGround
              ) {
                const tx = px + 4
                const ty = py + 4
                const ts = 8
                this.overlayGraphics.fillStyle(0xff2200, 0.90)
                this.overlayGraphics.fillTriangle(tx, ty + ts, tx + ts * 0.5, ty, tx + ts, ty + ts)
                this.overlayGraphics.lineStyle(1, 0xffffff, 0.80)
                this.overlayGraphics.strokeTriangle(tx, ty + ts, tx + ts * 0.5, ty, tx + ts, ty + ts)
              }
            }
            // hazard_alert companion: show pulsing amber warning on hazards within companion range
            if (this.companionEffect?.type === 'hazard_alert') {
              const alertRadius = this.companionEffect.value
              const distX = Math.abs(x - this.player.gridX)
              const distY = Math.abs(y - this.player.gridY)
              const withinRange = distX <= alertRadius && distY <= alertRadius
              if (withinRange && (
                cell.type === BlockType.LavaBlock ||
                cell.type === BlockType.GasPocket ||
                cell.type === BlockType.UnstableGround
              )) {
                // Amber pulsing border — distinct from scanner red triangle
                this.overlayGraphics.lineStyle(2, 0xffaa00, 0.85)
                this.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
                this.overlayGraphics.fillStyle(0xffaa00, 0.25)
                this.overlayGraphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
              }
            }
          } else if (visLevel === 2 && scannerCount >= 1) {
            // Ring 2: only visible with scanner; render sprite with heavy dim overlay
            const dimBrightness = Math.min(0.30, 0.10 + (scannerCount - 1) * 0.10)
            this.tileGraphics.fillStyle(this.currentBiome.fogTint, 1)
            this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            this.drawBlockPattern(cell, x, y, px, py)
            const dimAmount = 1.0 - dimBrightness
            this.overlayGraphics.fillStyle(0x000000, dimAmount)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          } else {
            // Hidden: use biome fog tint
            this.tileGraphics.fillStyle(this.currentBiome.fogTint, 1)
            this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          }
          continue
        }

        if (cell.type === BlockType.Empty) {
          // Use biome background color for empty (open) cells
          this.tileGraphics.fillStyle(this.currentBiome.bgColor, 1)
          this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        } else {
          // Dark base behind tile sprite: prefer biome color override, then default BLOCK_COLORS
          const color = (this.currentBiome.blockColorOverrides[cell.type] ?? BLOCK_COLORS[cell.type]) ?? this.currentBiome.fogTint
          this.tileGraphics.fillStyle(color, 1)
          this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          this.drawBlockPattern(cell, x, y, px, py)
        }

        if (cell.maxHardness > 0 && cell.hardness > 0 && cell.hardness < cell.maxHardness) {
          const damagePercent = 1 - cell.hardness / cell.maxHardness
          const crackPadding = 4

          if (damagePercent <= 0.33) {
            this.overlayGraphics.lineStyle(1, 0x000000, 0.3)
            this.overlayGraphics.lineBetween(
              px + crackPadding,
              py + crackPadding,
              px + TILE_SIZE - crackPadding,
              py + TILE_SIZE - crackPadding,
            )
          } else if (damagePercent <= 0.66) {
            this.overlayGraphics.lineStyle(1.5, 0x000000, 0.5)
            this.overlayGraphics.lineBetween(
              px + crackPadding,
              py + crackPadding,
              px + TILE_SIZE - crackPadding,
              py + TILE_SIZE - crackPadding,
            )
            this.overlayGraphics.lineBetween(
              px + TILE_SIZE - crackPadding,
              py + crackPadding,
              px + crackPadding,
              py + TILE_SIZE - crackPadding,
            )
          } else {
            this.overlayGraphics.lineStyle(2, 0x662222, 0.7)
            this.overlayGraphics.lineBetween(
              px + crackPadding,
              py + crackPadding,
              px + TILE_SIZE - crackPadding,
              py + TILE_SIZE - crackPadding,
            )
            this.overlayGraphics.lineBetween(
              px + TILE_SIZE - crackPadding,
              py + crackPadding,
              px + crackPadding,
              py + TILE_SIZE - crackPadding,
            )
            this.overlayGraphics.lineBetween(
              px + TILE_SIZE * 0.5,
              py + crackPadding,
              px + TILE_SIZE * 0.45,
              py + TILE_SIZE - crackPadding,
            )
            this.overlayGraphics.lineBetween(
              px + crackPadding + 1,
              py + TILE_SIZE * 0.7,
              px + TILE_SIZE - crackPadding - 1,
              py + TILE_SIZE * 0.35,
            )
          }
        }

        const flashKey = `${x},${y}`
        const flashStart = this.flashTiles.get(flashKey)
        if (flashStart !== undefined) {
          const elapsed = this.time.now - flashStart
          if (elapsed < 150) {
            const alpha = 0.45 * (1 - elapsed / 150)
            this.overlayGraphics.fillStyle(0xffffff, alpha)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          } else {
            this.flashTiles.delete(flashKey)
          }
        }
      }
    }
  }

  private drawPlayer(): void {
    const px = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
    const py = this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5
    this.playerSprite.setPosition(px, py)
  }

  private spawnBreakParticles(px: number, py: number, blockType: BlockType): void {
    // Use biome color override if present, otherwise fall back to default BLOCK_COLORS
    const particleColor = (this.currentBiome.blockColorOverrides[blockType] ?? BLOCK_COLORS[blockType]) ?? 0x888888
    this.breakEmitter.setParticleTint(particleColor)
    this.breakEmitter.setPosition(px + TILE_SIZE * 0.5, py + TILE_SIZE * 0.5)
    this.breakEmitter.explode(6)
  }

  /**
   * Find shortest path through empty tiles using BFS.
   * Returns positions from start to end (excluding start, including end).
   */
  private findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): { x: number; y: number }[] | null {
    if (startX === endX && startY === endY) {
      return []
    }

    const visited = new Set<string>()
    const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = []

    queue.push({ x: startX, y: startY, path: [] })
    visited.add(`${startX},${startY}`)

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        break
      }

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ]

      for (const next of neighbors) {
        if (next.x < 0 || next.y < 0 || next.x >= this.gridWidth || next.y >= this.gridHeight) {
          continue
        }

        const key = `${next.x},${next.y}`
        if (visited.has(key)) {
          continue
        }

        const cell = this.grid[next.y][next.x]
        if (cell.type !== BlockType.Empty && cell.type !== BlockType.ExitLadder) {
          continue
        }

        const newPath = [...current.path, next]

        if (next.x === endX && next.y === endY) {
          return newPath
        }

        queue.push({ x: next.x, y: next.y, path: newPath })
        visited.add(key)
      }
    }

    return null
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isPaused) {
      return
    }

    const camera = this.cameras.main
    const worldX = pointer.x + camera.scrollX
    const worldY = pointer.y + camera.scrollY
    const targetX = Math.floor(worldX / TILE_SIZE)
    const targetY = Math.floor(worldY / TILE_SIZE)

    if (targetX < 0 || targetY < 0 || targetX >= this.gridWidth || targetY >= this.gridHeight) {
      return
    }

    const playerX = this.player.gridX
    const playerY = this.player.gridY

    if (targetX === playerX && targetY === playerY) {
      return
    }

    // Check if clicked target is empty and reachable via pathfinding.
    const clickedCell = this.grid[targetY][targetX]
    if ((clickedCell.type === BlockType.Empty || clickedCell.type === BlockType.ExitLadder) && clickedCell.revealed) {
      const path = this.findPath(playerX, playerY, targetX, targetY)
      if (path && path.length > 0) {
        const nextStep = path[0]
        const moved = this.player.moveToEmpty(nextStep.x, nextStep.y, this.grid)
        if (moved) {
          revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
          if (this.activeUpgrades.has('scanner_boost')) {
            this.revealSpecialBlocks()
          }
          this.game.events.emit('oxygen-changed', this.oxygenState)
          this.game.events.emit('depth-changed', this.player.gridY)
          this.checkPointOfNoReturn()
          this.redrawAll()
        }
        return
      }
    }

    let finalX = targetX
    let finalY = targetY

    // If not adjacent, move in the direction of the click
    if (Math.abs(targetX - playerX) + Math.abs(targetY - playerY) !== 1) {
      const dx = targetX - playerX
      const dy = targetY - playerY

      // Determine primary direction (prefer vertical over horizontal for ties)
      if (Math.abs(dy) >= Math.abs(dx)) {
        // Move vertically
        finalX = playerX
        finalY = playerY + (dy > 0 ? 1 : -1)
      } else {
        // Move horizontally
        finalX = playerX + (dx > 0 ? 1 : -1)
        finalY = playerY
      }

      // Bounds check
      if (finalX < 0 || finalY < 0 || finalX >= this.gridWidth || finalY >= this.gridHeight) {
        return
      }
    }

    this.handleMoveOrMine(finalX, finalY)
  }

  /**
   * Handles keyboard input for arrow keys and WASD movement.
   * Maps each key to a directional delta and delegates to handleMoveOrMine.
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isPaused) {
      return
    }

    let dx = 0
    let dy = 0

    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        dy = -1
        break
      case 'ArrowDown':
      case 's':
      case 'S':
        dy = 1
        break
      case 'ArrowLeft':
      case 'a':
      case 'A':
        dx = -1
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        dx = 1
        break
      case 'b':
      case 'B':
        this.useBomb()
        return
      default:
        return
    }

    const targetX = this.player.gridX + dx
    const targetY = this.player.gridY + dy

    if (targetX < 0 || targetY < 0 || targetX >= this.gridWidth || targetY >= this.gridHeight) {
      return
    }

    this.handleMoveOrMine(targetX, targetY)
  }

  /**
   * Core logic for moving into an empty tile or mining an adjacent block.
   * Called by both handlePointerDown and handleKeyDown after the target
   * grid position has been determined.
   *
   * @param targetX - The grid x-coordinate of the target tile.
   * @param targetY - The grid y-coordinate of the target tile.
   */
  private handleMoveOrMine(targetX: number, targetY: number): void {
    const playerX = this.player.gridX
    const playerY = this.player.gridY
    const targetCell = this.grid[targetY][targetX]

    if (targetCell.type === BlockType.Empty || targetCell.type === BlockType.ExitLadder) {
      const isExitLadder = targetCell.type === BlockType.ExitLadder
      const moved = this.player.moveToEmpty(targetX, targetY, this.grid)
      if (!moved) {
        return
      }

      revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
      if (this.activeUpgrades.has('scanner_boost')) {
        this.revealSpecialBlocks()
      }

      this.game.events.emit('oxygen-changed', this.oxygenState)
      this.game.events.emit('depth-changed', this.player.gridY)
      this.checkPointOfNoReturn()

      if (isExitLadder) {
        this.game.events.emit('exit-reached')
      }

      this.redrawAll()
      return
    }

    if (!canMine(this.grid, targetX, targetY, playerX, playerY)) {
      return
    }

    const blockType = targetCell.type

    if (blockType !== BlockType.QuizGate) {
      let oxygenCost = getOxygenCostForBlock(blockType)
      if (this.activeUpgrades.has('oxygen_efficiency')) {
        const o2Count = this.activeUpgrades.get('oxygen_efficiency') ?? 0
        oxygenCost = Math.max(1, Math.ceil(oxygenCost * Math.pow(BALANCE.UPGRADE_OXYGEN_EFFICIENCY, o2Count)))
      }
      const oxygenResult = consumeOxygen(this.oxygenState, oxygenCost)
      this.oxygenState = oxygenResult.state

      if (oxygenResult.depleted) {
        this.game.events.emit('oxygen-changed', this.oxygenState)
        this.game.events.emit('oxygen-depleted')
        this.redrawAll()
        return
      }
    }

    // QuizGate: trigger quiz before mining — each correct answer removes 1 hardness
    if (blockType === BlockType.QuizGate) {
      this.isPaused = true
      this.game.events.emit('quiz-gate', {
        factId: targetCell.content?.factId,
        gateX: targetX,
        gateY: targetY,
        gateRemaining: targetCell.hardness,
        gateTotal: targetCell.maxHardness,
      })
      return
    }

    // Companion instant_break: N% chance to destroy any block in one hit
    if (
      this.companionEffect?.type === 'instant_break' &&
      this.rng() < this.companionEffect.value &&
      targetCell.hardness > 1
    ) {
      targetCell.hardness = 1
      this.companionFlash = true
      this.game.events.emit('companion-triggered', { effect: 'instant_break' })
    }

    // Pickaxe tier damage: apply tier-based extra damage before mining
    // Tier 0 (Stone Pick) does 1 damage (default mineBlock), higher tiers do bonus damage
    const tierDamage = BALANCE.PICKAXE_TIERS[this.pickaxeTierIndex].damage
    if (tierDamage > 1 && targetCell.hardness > 1) {
      targetCell.hardness = Math.max(1, targetCell.hardness - (tierDamage - 1))
    }

    const mineResult = mineBlock(this.grid, targetX, targetY)
    if (mineResult.success) {
      this.blocksMinedThisRun += 1
      this.blocksSinceLastQuake += 1
      this.game.events.emit('blocks-mined-update', this.blocksMinedThisRun)
      // oxygen_regen relic: restore O2 every 10 blocks mined
      if (this.blocksMinedThisRun % 10 === 0) {
        const regenRelic = this.collectedRelics.find(r => r.effect.type === 'oxygen_regen')
        if (regenRelic && regenRelic.effect.type === 'oxygen_regen') {
          // oxygen_regen_boost synergy: add extra O2 on top of base regen
          const synergyEffects = this.getActiveSynergyEffects()
          const boostEffect = synergyEffects.find(e => e.type === 'oxygen_regen_boost')
          const bonusAmount = (boostEffect && boostEffect.type === 'oxygen_regen_boost') ? boostEffect.amount : 0
          this.oxygenState = addOxygen(this.oxygenState, regenRelic.effect.amount + bonusAmount)
          this.game.events.emit('oxygen-changed', this.oxygenState)
        }
      }
      if (!mineResult.destroyed) {
        this.flashTiles.set(`${targetX},${targetY}`, this.time.now)
        if (blockType === BlockType.Dirt || blockType === BlockType.SoftRock || blockType === BlockType.GasPocket) {
          audioManager.playSound('mine_dirt')
        } else if (blockType === BlockType.Stone || blockType === BlockType.HardRock || blockType === BlockType.Unbreakable || blockType === BlockType.LavaBlock) {
          audioManager.playSound('mine_rock')
        } else if (blockType === BlockType.MineralNode) {
          audioManager.playSound('mine_crystal')
        } else {
          audioManager.playSound('mine_dirt')
        }
      }
    }

    if (mineResult.destroyed) {
      this.spawnBreakParticles(targetX * TILE_SIZE, targetY * TILE_SIZE, blockType)
      audioManager.playSound('mine_break')

      // Random quiz: only on plain terrain blocks, after at least RANDOM_QUIZ_MIN_BLOCKS mined,
      // and only when not already paused (no nested quizzes).
      const randomQuizEligibleTypes = new Set<BlockType>([
        BlockType.Dirt,
        BlockType.SoftRock,
        BlockType.Stone,
        BlockType.HardRock,
        BlockType.LavaBlock,
        BlockType.GasPocket,
      ])
      if (
        randomQuizEligibleTypes.has(blockType) &&
        this.blocksMinedThisRun >= BALANCE.RANDOM_QUIZ_MIN_BLOCKS &&
        !this.isPaused &&
        Math.random() < BALANCE.RANDOM_QUIZ_CHANCE
      ) {
        this.isPaused = true
        this.game.events.emit('random-quiz')
        // Flush state updates so the UI is current when the quiz overlay appears
        revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
        if (this.activeUpgrades.has('scanner_boost')) {
          this.revealSpecialBlocks()
        }
        this.game.events.emit('oxygen-changed', this.oxygenState)
        this.redrawAll()
        return
      }

      // Earthquake trigger: after cooldown and minimum blocks, random chance per destroyed block
      if (
        this.blocksSinceLastQuake >= BALANCE.EARTHQUAKE_COOLDOWN &&
        this.blocksMinedThisRun >= BALANCE.EARTHQUAKE_MIN_BLOCKS &&
        !this.isPaused &&
        Math.random() < BALANCE.EARTHQUAKE_CHANCE_PER_BLOCK
      ) {
        this.triggerEarthquake()
      }

      switch (blockType) {
        case BlockType.MineralNode: {
          let mineralAmount = mineResult.content?.mineralAmount ?? 0
          // lucky_strike relic: chance to double mineral drops
          const luckyRelic = this.collectedRelics.find(r => r.effect.type === 'lucky_strike')
          if (luckyRelic && luckyRelic.effect.type === 'lucky_strike' && this.rng() < luckyRelic.effect.chance) {
            mineralAmount = mineralAmount * 2
          }
          // mineral_multiplier synergy (Treasure Hunter): multiply mineral drops
          const mineralSynergyEffects = this.getActiveSynergyEffects()
          const multiplierEffect = mineralSynergyEffects.find(e => e.type === 'mineral_multiplier')
          if (multiplierEffect && multiplierEffect.type === 'mineral_multiplier') {
            mineralAmount = Math.round(mineralAmount * multiplierEffect.multiplier)
          }
          // mineral_rate companion: N% chance to add +1 to mineral yield
          if (this.companionEffect?.type === 'mineral_rate' && this.rng() < this.companionEffect.value) {
            mineralAmount += 1
            this.companionFlash = true
            this.game.events.emit('companion-triggered', { effect: 'mineral_rate' })
          }
          // mineral_magnet relic: after collecting, auto-collect adjacent MineralNodes
          const mineralSlot: InventorySlot = {
            type: 'mineral',
            mineralTier: mineResult.content?.mineralType,
            mineralAmount,
          }
          const added = this.addToInventory(mineralSlot)
          this.game.events.emit('mineral-collected', {
            ...mineResult.content,
            mineralAmount,
            addedToInventory: added,
          })
          audioManager.playSound('collect')
          // mineral_magnet: auto-collect minerals within radius
          this.applyMineralMagnet(targetX, targetY)
          break
        }
        case BlockType.ArtifactNode: {
          const artifactSlot: InventorySlot = {
            type: 'artifact',
            artifactRarity: mineResult.content?.artifactRarity,
            factId: mineResult.content?.factId,
          }
          // double_artifact_chance synergy (Scholar's Blessing): 2x the rarity-boost quiz trigger chance
          const artifactSynergyEffects = this.getActiveSynergyEffects()
          const doubleArtifactChance = artifactSynergyEffects.some(e => e.type === 'double_artifact_chance')
          const effectiveArtifactQuizChance = doubleArtifactChance
            ? Math.min(1, BALANCE.ARTIFACT_QUIZ_CHANCE * 2)
            : BALANCE.ARTIFACT_QUIZ_CHANCE
          if (Math.random() < effectiveArtifactQuizChance && this.facts.length > 0) {
            // Artifact triggers a multi-question appraisal quiz — store the slot pending quiz result
            this.pendingArtifactSlot = artifactSlot
            this.pendingArtifactQuestions = BALANCE.ARTIFACT_QUIZ_QUESTIONS
            this.pendingArtifactBoosts = 0
            this.isPaused = true
            const factId = this.facts[Math.floor(Math.random() * this.facts.length)]
            this.game.events.emit('artifact-quiz', {
              factId,
              artifactRarity: mineResult.content?.artifactRarity,
              questionsRemaining: BALANCE.ARTIFACT_QUIZ_QUESTIONS,
              questionsTotal: BALANCE.ARTIFACT_QUIZ_QUESTIONS,
            })
          } else {
            const added = this.addToInventory(artifactSlot)
            if (mineResult.content?.factId) {
              this.artifactsFound.push(mineResult.content.factId)
            }
            this.game.events.emit('artifact-found', {
              factId: mineResult.content?.factId,
              rarity: mineResult.content?.artifactRarity,
              addedToInventory: added,
            })
            audioManager.playSound('collect')
          }
          break
        }
        case BlockType.OxygenCache: {
          const oxygenAmount = mineResult.content?.oxygenAmount ?? BALANCE.OXYGEN_CACHE_RESTORE
          if (Math.random() < BALANCE.OXYGEN_CACHE_QUIZ_CHANCE && this.facts.length > 0) {
            // Store the pending oxygen amount so we can grant it after quiz
            this.pendingOxygenReward = oxygenAmount
            this.isPaused = true
            // Pick a random fact ID for the quiz
            const factId = this.facts[Math.floor(Math.random() * this.facts.length)]
            this.game.events.emit('oxygen-quiz', { factId, oxygenAmount })
          } else {
            this.oxygenState = addOxygen(this.oxygenState, oxygenAmount)
            this.game.events.emit('oxygen-restored', {
              amount: oxygenAmount,
              state: this.oxygenState,
            })
            audioManager.playSound('collect')
          }
          break
        }
        case BlockType.UpgradeCrate: {
          const upgrade = this.rollUpgrade()
          this.applyUpgrade(upgrade)
          this.game.events.emit('upgrade-found', { upgrade })
          audioManager.playSound('collect')
          break
        }
        case BlockType.OxygenTank: {
          // Permanent progression reward — emits event for GameManager to handle save update.
          this.game.events.emit('oxygen-tank-found')
          audioManager.playSound('collect')
          break
        }
        case BlockType.DataDisc: {
          // Collectible that unlocks a themed fact pack — emits event for GameManager to handle.
          this.game.events.emit('data-disc-found')
          audioManager.playSound('collect')
          break
        }
        case BlockType.FossilNode: {
          // Fossil fragment found — GameManager picks species from run RNG and updates save.
          this.game.events.emit('fossil-found', { x: targetX, y: targetY })
          audioManager.playSound('collect')
          break
        }
        case BlockType.LavaBlock: {
          // Lava costs extra oxygen when broken through
          // hazard_immunity synergy (Deep Diver): skip all O2 cost for hazards
          const lavaHazardImmune = this.getActiveSynergyEffects().some(e => e.type === 'hazard_immunity')
          if (!lavaHazardImmune) {
            const toughSkinLava = this.collectedRelics.find(r => r.effect.type === 'tough_skin')
            const relicReduction = (toughSkinLava && toughSkinLava.effect.type === 'tough_skin') ? toughSkinLava.effect.reduction : 0
            const companionReduction = this.companionEffect?.type === 'hazard_resist' ? this.companionEffect.value : 0
            const lavaCost = Math.max(1, BALANCE.LAVA_OXYGEN_COST - relicReduction - companionReduction)
            const lavaResult = consumeOxygen(this.oxygenState, lavaCost)
            this.oxygenState = lavaResult.state
            if (lavaResult.depleted) {
              this.game.events.emit('oxygen-changed', this.oxygenState)
              this.game.events.emit('oxygen-depleted')
              this.redrawAll()
              return
            }
          }
          break
        }
        case BlockType.GasPocket: {
          // Gas pocket drains oxygen when the player steps into it
          // hazard_immunity synergy (Deep Diver): skip all O2 cost for hazards
          const gasHazardImmune = this.getActiveSynergyEffects().some(e => e.type === 'hazard_immunity')
          if (!gasHazardImmune) {
            const toughSkinGas = this.collectedRelics.find(r => r.effect.type === 'tough_skin')
            const relicReductionGas = (toughSkinGas && toughSkinGas.effect.type === 'tough_skin') ? toughSkinGas.effect.reduction : 0
            const companionReductionGas = this.companionEffect?.type === 'hazard_resist' ? this.companionEffect.value : 0
            const gasCost = Math.max(1, BALANCE.GAS_POCKET_OXYGEN_DRAIN - relicReductionGas - companionReductionGas)
            const gasResult = consumeOxygen(this.oxygenState, gasCost)
            this.oxygenState = gasResult.state
            if (gasResult.depleted) {
              this.game.events.emit('oxygen-changed', this.oxygenState)
              this.game.events.emit('oxygen-depleted')
              this.redrawAll()
              return
            }
          }
          break
        }
        case BlockType.RelicShrine: {
          // Relic shrine: pick a random relic not already owned this run.
          const relic = pickRandomRelic(this.collectedRelics.map(r => r.id), this.rng)
          if (relic) {
            this.collectedRelics.push(relic)
            // Apply immediate effects
            if (relic.effect.type === 'deep_breath') {
              this.oxygenState = {
                ...this.oxygenState,
                max: this.oxygenState.max + relic.effect.bonus,
                current: Math.min(this.oxygenState.current + relic.effect.bonus, this.oxygenState.max + relic.effect.bonus),
              }
              this.game.events.emit('oxygen-changed', this.oxygenState)
            }
            this.game.events.emit('relic-found', { relic })
            audioManager.playSound('collect')
          }
          break
        }
        case BlockType.DescentShaft: {
          // Pause and show a layer entrance quiz before descending.
          // The actual descent is triggered after the quiz via resumeFromLayerQuiz().
          this.isPaused = true
          this.game.events.emit('layer-entrance-quiz', { layer: this.currentLayer })
          // Don't destroy or move — GameManager will handle the quiz then call resumeFromLayerQuiz().
          return
        }
        case BlockType.QuoteStone: {
          // Quote stone broken — pick a random lore quote and emit it as a toast message.
          const quote = pickQuote(this.rng)
          this.game.events.emit('quote-found', { quote })
          break
        }
        case BlockType.UnstableGround: {
          // Cave-in: collapse nearby terrain when this block is broken.
          const caveInRadius = BALANCE.CAVE_IN_RADIUS
          const playerPosKey = `${this.player.gridX},${this.player.gridY}`
          const specialTypes = new Set<BlockType>([
            BlockType.MineralNode,
            BlockType.ArtifactNode,
            BlockType.OxygenCache,
            BlockType.UpgradeCrate,
            BlockType.QuizGate,
            BlockType.ExitLadder,
            BlockType.DescentShaft,
            BlockType.RelicShrine,
            BlockType.QuoteStone,
            BlockType.LavaBlock,
            BlockType.GasPocket,
            BlockType.UnstableGround,
            BlockType.OxygenTank,
            BlockType.FossilNode,
            BlockType.Unbreakable,
          ])
          const terrainTypes = new Set<BlockType>([
            BlockType.Dirt,
            BlockType.SoftRock,
            BlockType.Stone,
            BlockType.HardRock,
          ])
          let affectedCount = 0
          for (let dy = -caveInRadius; dy <= caveInRadius; dy++) {
            for (let dx = -caveInRadius; dx <= caveInRadius; dx++) {
              if (dx === 0 && dy === 0) continue
              const nx = targetX + dx
              const ny = targetY + dy
              if (nx < 0 || ny < 0 || ny >= this.gridHeight || nx >= this.gridWidth) continue
              // Never affect the player's current position
              if (`${nx},${ny}` === playerPosKey) continue
              const nCell = this.grid[ny][nx]
              // Only affect revealed cells (don't reshape unexplored territory)
              if (!nCell.revealed) continue
              // Skip special/protected block types
              if (specialTypes.has(nCell.type)) continue
              // Roll for collapse
              if (Math.random() < BALANCE.CAVE_IN_COLLAPSE_CHANCE) {
                if (nCell.type === BlockType.Empty) {
                  // Empty space: rubble falls in
                  this.grid[ny][nx] = { type: BlockType.Dirt, hardness: 1, maxHardness: 1, revealed: true }
                  affectedCount++
                } else if (terrainTypes.has(nCell.type)) {
                  // Terrain crumbles away
                  this.grid[ny][nx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
                  affectedCount++
                }
              }
            }
          }
          // Update fog of war from player position after cave-in reshapes terrain
          revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
          if (this.activeUpgrades.has('scanner_boost')) {
            this.revealSpecialBlocks()
          }
          // Emit event so GameManager can show a GAIA quip
          this.game.events.emit('cave-in', { affectedCount })
          // Screen shake: jitter camera for ~300ms then re-center on player
          const shakeCamera = (): void => {
            const offsetX = (Math.random() - 0.5) * 6
            const offsetY = (Math.random() - 0.5) * 6
            this.cameras.main.setScroll(
              this.cameras.main.scrollX + offsetX,
              this.cameras.main.scrollY + offsetY,
            )
          }
          shakeCamera()
          setTimeout(() => { shakeCamera() }, 80)
          setTimeout(() => { shakeCamera() }, 160)
          setTimeout(() => { shakeCamera() }, 240)
          setTimeout(() => {
            const centerX = this.player.gridX * TILE_SIZE + TILE_SIZE / 2
            const centerY = this.player.gridY * TILE_SIZE + TILE_SIZE / 2
            this.cameras.main.centerOn(centerX, centerY)
          }, 320)
          break
        }
        case BlockType.SendUpStation: {
          // Send-up station reached — emit event and pause; don't destroy the block.
          // GameManager will show the SendUpOverlay; resumeFromSendUp() will unpause.
          this.isPaused = true
          this.game.events.emit('send-up-station', {
            inventory: this.inventory.map(s => ({ ...s })),
          })
          // Early return: do NOT move the player or proceed with normal mine logic.
          return
        }
        default:
          break
      }

      const moved = this.player.moveToEmpty(targetX, targetY, this.grid)
      if (moved) {
        revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
        if (this.activeUpgrades.has('scanner_boost')) {
          this.revealSpecialBlocks()
        }
        this.game.events.emit('depth-changed', this.player.gridY)
        this.checkPointOfNoReturn()
      }
    }

    revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
    if (this.activeUpgrades.has('scanner_boost')) {
      this.revealSpecialBlocks()
    }
    this.game.events.emit('oxygen-changed', this.oxygenState)
    if (this.oxygenState.current / this.oxygenState.max < 0.2 && !this.oxygenWarningPlayed) {
      this.oxygenWarningPlayed = true
      audioManager.playSound('oxygen_warning')
    }
    this.game.events.emit('depth-changed', this.player.gridY)
    this.checkPointOfNoReturn()
    this.redrawAll()
  }

  /**
   * Emits the 'point-of-no-return' event once per run when the player descends past
   * BALANCE.POINT_OF_NO_RETURN_PERCENT of the mine depth.
   */
  private checkPointOfNoReturn(): void {
    if (this.passedPointOfNoReturn) return
    if (this.player.gridY / this.gridHeight >= BALANCE.POINT_OF_NO_RETURN_PERCENT) {
      this.passedPointOfNoReturn = true
      this.game.events.emit('point-of-no-return', {
        depth: this.player.gridY,
        maxDepth: this.gridHeight,
      })
    }
  }

  /**
   * Resumes mining input after a quiz gate result.
   * If the player answered correctly, mines one hardness off the gate at the given coordinates.
   * If the gate is destroyed, spawns particles and auto-steps the player into the cleared tile.
   * If the player answered wrong, applies oxygen penalty.
   *
   * @param passed - Whether the player answered correctly.
   * @param gateX - Grid x-coordinate of the quiz gate (required when passed is true).
   * @param gateY - Grid y-coordinate of the quiz gate (required when passed is true).
   */
  public resumeFromQuiz(passed: boolean, gateX?: number, gateY?: number): void {
    this.isPaused = false

    if (passed && gateX !== undefined && gateY !== undefined) {
      // Correct answer — mine one hardness off the gate
      const result = mineBlock(this.grid, gateX, gateY)
      if (result.destroyed) {
        this.spawnBreakParticles(gateX * TILE_SIZE, gateY * TILE_SIZE, BlockType.QuizGate)
        audioManager.playSound('mine_break')
        // Auto-step into the cleared gate tile
        const moved = this.player.moveToEmpty(gateX, gateY, this.grid)
        if (moved) {
          revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
          if (this.activeUpgrades.has('scanner_boost')) {
            this.revealSpecialBlocks()
          }
          this.game.events.emit('depth-changed', this.player.gridY)
          this.checkPointOfNoReturn()
        }
      } else {
        // Gate still has hardness remaining — flash it to show progress
        this.flashTiles.set(`${gateX},${gateY}`, this.time.now)
        audioManager.playSound('mine_rock')
      }
      this.blocksMinedThisRun += 1
      this.game.events.emit('blocks-mined-update', this.blocksMinedThisRun)
    } else if (!passed) {
      const oxygenResult = consumeOxygen(this.oxygenState, BALANCE.QUIZ_GATE_FAILURE_OXYGEN_COST)
      this.oxygenState = oxygenResult.state
      this.game.events.emit('oxygen-changed', this.oxygenState)

      if (oxygenResult.depleted) {
        this.game.events.emit('oxygen-depleted')
      }
    }

    this.redrawAll()
  }

  /**
   * Resumes mining input after an oxygen cache quiz result.
   * Grants the pending oxygen reward only if the player answered correctly.
   */
  public resumeFromOxygenQuiz(passed: boolean): void {
    this.isPaused = false
    if (passed && this.pendingOxygenReward > 0) {
      this.oxygenState = addOxygen(this.oxygenState, this.pendingOxygenReward)
      this.game.events.emit('oxygen-restored', {
        amount: this.pendingOxygenReward,
        state: this.oxygenState,
      })
      audioManager.playSound('collect')
    }
    this.pendingOxygenReward = 0
    this.game.events.emit('oxygen-changed', this.oxygenState)
    this.redrawAll()
  }

  /**
   * Rarity tiers in ascending order used by boostRarity.
   */
  private static readonly RARITY_ORDER = [
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
    'mythic',
  ] as const

  /**
   * Boost a rarity string up by the given number of tiers, capped at mythic.
   */
  private boostRarity(base: string, boosts: number): Rarity {
    const order = MineScene.RARITY_ORDER
    const idx = order.indexOf(base as Rarity)
    if (idx === -1) return (base as Rarity)
    return order[Math.min(idx + boosts, order.length - 1)]
  }

  /**
   * Finalize an artifact after the appraisal quiz completes (either all questions
   * answered or the player gave a wrong answer).  Applies accumulated rarity boosts,
   * adds the artifact to the inventory, and emits the artifact-found event.
   */
  private finalizeArtifact(boostedRarity?: Rarity): void {
    if (!this.pendingArtifactSlot) return
    const slot: InventorySlot = {
      ...this.pendingArtifactSlot,
      artifactRarity: boostedRarity ?? this.pendingArtifactSlot.artifactRarity,
    }
    const added = this.addToInventory(slot)
    if (slot.factId) {
      this.artifactsFound.push(slot.factId)
    }
    this.game.events.emit('artifact-found', {
      factId: slot.factId,
      rarity: slot.artifactRarity,
      addedToInventory: added,
      rarityBoosted: slot.artifactRarity !== this.pendingArtifactSlot.artifactRarity,
    })
    audioManager.playSound('collect')
    this.pendingArtifactSlot = null
    this.pendingArtifactQuestions = 0
    this.pendingArtifactBoosts = 0
  }

  /**
   * Resumes the multi-question artifact appraisal quiz after each answer.
   * On correct answers: rolls for a rarity boost and continues to the next question
   * (or finalizes if no questions remain).
   * On wrong answers: ends the quiz early and finalizes with whatever boosts were
   * accumulated so far.
   */
  public resumeFromArtifactQuiz(passed: boolean): void {
    if (passed) {
      // Roll for a rarity boost on this correct answer
      if (Math.random() < BALANCE.ARTIFACT_BOOST_CHANCE) {
        this.pendingArtifactBoosts++
      }
      this.pendingArtifactQuestions--

      if (this.pendingArtifactQuestions > 0) {
        // More questions remain — emit another artifact-quiz to continue the flow
        const questionsRemaining = this.pendingArtifactQuestions
        const questionsTotal = BALANCE.ARTIFACT_QUIZ_QUESTIONS
        this.game.events.emit('artifact-quiz', {
          artifactRarity: this.pendingArtifactSlot?.artifactRarity,
          questionsRemaining,
          questionsTotal,
          boostedSoFar: this.pendingArtifactBoosts,
        })
        // Stay paused — next question is coming
        return
      }

      // All questions answered — finalize with accumulated boosts
      const baseRarity = this.pendingArtifactSlot?.artifactRarity ?? 'common'
      const finalRarity = this.boostRarity(baseRarity, this.pendingArtifactBoosts)
      this.isPaused = false
      this.finalizeArtifact(finalRarity)
    } else {
      // Wrong answer — end quiz early, apply whatever boosts accumulated so far
      const baseRarity = this.pendingArtifactSlot?.artifactRarity ?? 'common'
      const finalRarity = this.boostRarity(baseRarity, this.pendingArtifactBoosts)
      this.isPaused = false
      this.finalizeArtifact(finalRarity)
    }
    this.redrawAll()
  }

  /**
   * Resumes mining input after a random (in-mine pop quiz) result.
   * Grants a small dust reward on correct answer; deducts a small oxygen cost on wrong.
   */
  public resumeFromRandomQuiz(correct: boolean): void {
    this.isPaused = false
    if (correct) {
      // quiz_master relic: bonus dust on correct answer
      const quizMasterRelic = this.collectedRelics.find(r => r.effect.type === 'quiz_master')
      const bonusDust = (quizMasterRelic && quizMasterRelic.effect.type === 'quiz_master')
        ? quizMasterRelic.effect.bonus
        : 0
      const totalDust = BALANCE.RANDOM_QUIZ_REWARD_DUST + bonusDust
      const rewardSlot: InventorySlot = {
        type: 'mineral',
        mineralTier: 'dust',
        mineralAmount: totalDust,
      }
      this.addToInventory(rewardSlot)
      // Flash the player tile to signal reward
      this.flashTiles.set(`${this.player.gridX},${this.player.gridY}`, this.time.now)
      this.game.events.emit('mineral-collected', {
        mineralType: 'dust',
        mineralAmount: totalDust,
        addedToInventory: true,
      })
      audioManager.playSound('collect')
    } else {
      const penaltyResult = consumeOxygen(this.oxygenState, BALANCE.RANDOM_QUIZ_WRONG_O2_COST)
      this.oxygenState = penaltyResult.state
      this.game.events.emit('oxygen-changed', this.oxygenState)
      if (penaltyResult.depleted) {
        this.game.events.emit('oxygen-depleted')
        this.redrawAll()
        return
      }
    }
    this.redrawAll()
  }

  /**
   * Resumes mining after the send-up station overlay is confirmed.
   * Moves the selected items from the active inventory to sentUpItems (safe storage).
   * If the player clicked "Skip", selectedItems should be an empty array.
   *
   * @param selectedItems - Items the player chose to send to the surface.
   */
  public resumeFromSendUp(selectedItems: InventorySlot[]): void {
    if (selectedItems.length > 0) {
      // Move selected items to sentUpItems and clear those slots from the active inventory
      for (const item of selectedItems) {
        // Remove first matching item from inventory
        const idx = this.inventory.findIndex(
          s => s.type === item.type &&
               s.mineralTier === item.mineralTier &&
               s.mineralAmount === item.mineralAmount &&
               s.artifactRarity === item.artifactRarity &&
               s.factId === item.factId
        )
        if (idx !== -1) {
          this.sentUpItems.push({ ...this.inventory[idx] })
          this.inventory[idx] = { type: 'empty' }
        }
      }
      // Sync the inventory store
      this.game.events.emit('mineral-collected', { addedToInventory: false })
    }
    this.isPaused = false
    this.redrawAll()
  }

  /**
   * Resumes after the layer entrance quiz.
   * If the player answered correctly, the descent proceeds with no penalty.
   * If wrong, applies an oxygen penalty then descends anyway — passage is always granted.
   *
   * @param passed - Whether the player answered correctly.
   */
  public resumeFromLayerQuiz(passed: boolean): void {
    this.isPaused = false

    if (!passed) {
      // Wrong answer — apply O2 penalty but still allow descent
      const penaltyResult = consumeOxygen(this.oxygenState, BALANCE.LAYER_ENTRANCE_WRONG_O2_COST)
      this.oxygenState = penaltyResult.state
      this.game.events.emit('oxygen-changed', this.oxygenState)
      if (penaltyResult.depleted) {
        this.game.events.emit('oxygen-depleted')
        this.redrawAll()
        return
      }
    }

    // Emit descent-shaft-entered to trigger the actual layer transition via GameManager.
    this.game.events.emit('descent-shaft-entered', {
      layer: this.currentLayer,
      inventory: this.inventory.map(s => ({ ...s })),
      blocksMinedThisRun: this.blocksMinedThisRun,
      artifactsFound: [...this.artifactsFound],
      oxygenState: { ...this.oxygenState },
      collectedRelics: [...this.collectedRelics],
    })
  }

  /**
   * Returns all active synergy effects for the current relic combination.
   * Used internally by mining logic to apply bonus effects without importing
   * the store directly into MineScene.
   */
  /**
   * Applies an immediate oxygen penalty to the current run.
   * Called by GameManager to impose the consistency penalty for knowing a fact
   * but answering it wrong in-dive.
   *
   * @param amount - Amount of oxygen to drain (positive number).
   * @returns true if the player's oxygen was depleted after the drain.
   */
  public drainOxygen(amount: number): boolean {
    const result = consumeOxygen(this.oxygenState, amount)
    this.oxygenState = result.state
    this.game.events.emit('oxygen-changed', this.oxygenState)
    if (result.depleted) {
      this.game.events.emit('oxygen-depleted')
    }
    return result.depleted
  }

  public getActiveSynergyEffects(): SynergyEffect[] {
    const relicIds = this.collectedRelics.map(r => r.id)
    return getActiveSynergies(relicIds).map(s => s.effect)
  }

  /**
   * Ends the active run and returns run results for processing.
   * sentUpItems are included separately and must bypass the forced-surface loss penalty.
   */
  public surfaceRun(): { inventory: InventorySlot[]; sentUpItems: InventorySlot[]; blocksMinedThisRun: number; artifactsFound: string[]; collectedRelics: Relic[] } {
    const runResults = {
      inventory: this.inventory.map((slot) => ({ ...slot })),
      sentUpItems: this.sentUpItems.map((slot) => ({ ...slot })),
      blocksMinedThisRun: this.blocksMinedThisRun,
      artifactsFound: [...this.artifactsFound],
      collectedRelics: [...this.collectedRelics],
    }

    this.game.events.emit('run-complete', runResults)
    return runResults
  }

  /**
   * Auto-collects MineralNode blocks within mineral_magnet relic radius around (originX, originY).
   * The companion magnet_range effect adds extra tiles to the base relic radius.
   * Called after manually mining a MineralNode.
   */
  private applyMineralMagnet(originX: number, originY: number): void {
    const magnetRelic = this.collectedRelics.find(r => r.effect.type === 'mineral_magnet')
    // magnet_range companion: also activate even without the relic (using companion value as base radius)
    const companionRange = this.companionEffect?.type === 'magnet_range' ? this.companionEffect.value : 0
    if (!magnetRelic && companionRange === 0) return
    const relicRadius = (magnetRelic && magnetRelic.effect.type === 'mineral_magnet') ? magnetRelic.effect.radius : 0
    const radius = relicRadius + companionRange
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = originX + dx
        const ny = originY + dy
        if (nx < 0 || ny < 0 || nx >= this.gridWidth || ny >= this.gridHeight) continue
        const cell = this.grid[ny][nx]
        if (cell.type === BlockType.MineralNode) {
          // Collect the mineral node without mining cost
          const slot: InventorySlot = {
            type: 'mineral',
            mineralTier: cell.content?.mineralType,
            mineralAmount: cell.content?.mineralAmount,
          }
          const added = this.addToInventory(slot)
          // Clear the block
          this.grid[ny][nx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
          this.blocksMinedThisRun += 1
          this.spawnBreakParticles(nx * TILE_SIZE, ny * TILE_SIZE, BlockType.MineralNode)
          this.game.events.emit('mineral-collected', { ...cell.content, addedToInventory: added })
        }
      }
    }
    this.game.events.emit('blocks-mined-update', this.blocksMinedThisRun)
  }

  /**
   * Roll a random upgrade from the full options pool using weighted random selection.
   * Bomb has a lower weight than the other upgrades to keep it feeling special.
   */
  private rollUpgrade(): RunUpgrade {
    let weightedOptions: { upgrade: RunUpgrade; weight: number }[] = [
      { upgrade: 'pickaxe_boost', weight: 25 },
      { upgrade: 'scanner_boost', weight: 25 },
      { upgrade: 'backpack_expand', weight: 25 },
      { upgrade: 'oxygen_efficiency', weight: 25 },
      { upgrade: 'bomb', weight: BALANCE.BOMB_DROP_WEIGHT },
    ]
    // Exclude backpack_expand when the temporary expansion cap has been reached.
    if (this.backpackExpansionCount >= BALANCE.BACKPACK_MAX_TEMP_EXPANSIONS) {
      weightedOptions = weightedOptions.filter(o => o.upgrade !== 'backpack_expand')
    }
    const totalWeight = weightedOptions.reduce((sum, o) => sum + o.weight, 0)
    let roll = Math.random() * totalWeight
    for (const option of weightedOptions) {
      roll -= option.weight
      if (roll <= 0) return option.upgrade
    }
    return weightedOptions[0].upgrade
  }

  /**
   * Apply an upgrade for the current run, recording it in activeUpgrades.
   */
  private applyUpgrade(upgrade: RunUpgrade): void {
    const currentCount = this.activeUpgrades.get(upgrade) ?? 0
    switch (upgrade) {
      case 'bomb': {
        const newCount = Math.min(currentCount + 1, BALANCE.BOMB_MAX_STACK)
        this.activeUpgrades.set(upgrade, newCount)
        break
      }
      case 'pickaxe_boost': {
        // Advance tier index up to the maximum tier
        const maxTier = BALANCE.PICKAXE_TIERS.length - 1
        this.pickaxeTierIndex = Math.min(this.pickaxeTierIndex + 1, maxTier)
        // Keep count in activeUpgrades for display purposes
        this.activeUpgrades.set(upgrade, this.pickaxeTierIndex)
        const tier = BALANCE.PICKAXE_TIERS[this.pickaxeTierIndex]
        this.game.events.emit('pickaxe-upgraded', {
          tierIndex: this.pickaxeTierIndex,
          tierName: tier.name,
        })
        break
      }
      case 'backpack_expand': {
        if (this.backpackExpansionCount < BALANCE.BACKPACK_MAX_TEMP_EXPANSIONS) {
          const bonus = BALANCE.BACKPACK_EXPANSION_SIZES[this.backpackExpansionCount]
          this.backpackExpansionCount++
          for (let i = 0; i < bonus; i++) {
            this.inventory.push({ type: 'empty' as const })
          }
          this.inventorySlots += bonus
          this.activeUpgrades.set(upgrade, currentCount + 1)
          this.game.events.emit('backpack-expanded', {
            slotsAdded: bonus,
            totalSlots: this.inventory.length,
            expansionCount: this.backpackExpansionCount,
          })
        }
        // If at max expansions, the caller should have re-rolled; applyUpgrade is a no-op here.
        break
      }
      case 'scanner_boost': {
        this.activeUpgrades.set(upgrade, currentCount + 1)
        // Advance scanner tier (capped at max tier index)
        const maxTierIndex = BALANCE.SCANNER_TIERS.length - 1
        this.scannerTierIndex = Math.min(this.scannerTierIndex + 1, maxTierIndex)
        const tierName = BALANCE.SCANNER_TIERS[this.scannerTierIndex].name
        this.game.events.emit('scanner-upgraded', { tierIndex: this.scannerTierIndex, tierName })
        this.revealSpecialBlocks()
        break
      }
      default:
        this.activeUpgrades.set(upgrade, currentCount + 1)
        break
    }
  }

  /**
   * Reveal special blocks within scanner range around the player.
   * Range is determined by the current scanner tier's revealRadius.
   */
  private revealSpecialBlocks(): void {
    const scanRadius = BALANCE.SCANNER_TIERS[this.scannerTierIndex].revealRadius
    const px = this.player.gridX
    const py = this.player.gridY
    for (let dy = -scanRadius; dy <= scanRadius; dy++) {
      for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        const x = px + dx
        const y = py + dy
        if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) continue
        if (Math.abs(dx) + Math.abs(dy) > scanRadius) continue
        const cell = this.grid[y][x]
        if (
          cell.type === BlockType.MineralNode ||
          cell.type === BlockType.ArtifactNode ||
          cell.type === BlockType.OxygenCache ||
          cell.type === BlockType.UpgradeCrate ||
          cell.type === BlockType.ExitLadder ||
          cell.type === BlockType.DescentShaft
        ) {
          cell.revealed = true
        }
      }
    }
  }

  /**
   * Triggers a random earthquake event that reshapes a portion of the mine.
   *
   * Phase 1 — Screen shake: stronger than a cave-in, multiple jitter steps over 600ms.
   * Phase 2 — Collapse: up to EARTHQUAKE_COLLAPSE_COUNT random revealed terrain blocks
   *            (Dirt/SoftRock/Stone/HardRock) are destroyed and become Empty, opening new passages.
   * Phase 3 — Rubble: some Empty cells near collapsed blocks are back-filled with Dirt,
   *            simulating debris fall and partially blocking old tunnels.
   * Phase 4 — Reveal: up to EARTHQUAKE_REVEAL_COUNT unrevealed blocks adjacent to revealed
   *            space are given visibilityLevel=1 (ring-1 fog crack).
   *
   * After all grid changes, revealAround() is called from the player position to keep the
   * fog-of-war consistent.  An 'earthquake' event is emitted for GameManager commentary.
   * Never affects: player cell, special blocks, Unbreakable blocks.
   */
  private triggerEarthquake(): void {
    this.blocksSinceLastQuake = 0

    const playerPosKey = `${this.player.gridX},${this.player.gridY}`

    // Block types that are safe to collapse (plain terrain only)
    const terrainTypes = new Set<BlockType>([
      BlockType.Dirt,
      BlockType.SoftRock,
      BlockType.Stone,
      BlockType.HardRock,
    ])

    // Block types that must never be altered by an earthquake
    const protectedTypes = new Set<BlockType>([
      BlockType.Unbreakable,
      BlockType.MineralNode,
      BlockType.ArtifactNode,
      BlockType.OxygenCache,
      BlockType.QuizGate,
      BlockType.UpgradeCrate,
      BlockType.ExitLadder,
      BlockType.DescentShaft,
      BlockType.RelicShrine,
      BlockType.QuoteStone,
      BlockType.LavaBlock,
      BlockType.GasPocket,
      BlockType.UnstableGround,
      BlockType.SendUpStation,
    ])

    // === Phase 1: Screen shake (stronger than cave-in) ===
    const shakeStep = (): void => {
      const offsetX = (Math.random() - 0.5) * 12
      const offsetY = (Math.random() - 0.5) * 12
      this.cameras.main.setScroll(
        this.cameras.main.scrollX + offsetX,
        this.cameras.main.scrollY + offsetY,
      )
    }
    shakeStep()
    setTimeout(() => { shakeStep() }, 100)
    setTimeout(() => { shakeStep() }, 200)
    setTimeout(() => { shakeStep() }, 320)
    setTimeout(() => { shakeStep() }, 440)
    // Re-center after shake
    setTimeout(() => {
      const centerX = this.player.gridX * TILE_SIZE + TILE_SIZE / 2
      const centerY = this.player.gridY * TILE_SIZE + TILE_SIZE / 2
      this.cameras.main.centerOn(centerX, centerY)
    }, 600)

    // === Phase 2: Collapse — destroy revealed terrain blocks to create new passages ===
    // Gather all candidate revealed terrain blocks
    const terrainCandidates: { x: number; y: number }[] = []
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        if (`${col},${row}` === playerPosKey) continue
        const cell = this.grid[row][col]
        if (!cell.revealed) continue
        if (!terrainTypes.has(cell.type)) continue
        terrainCandidates.push({ x: col, y: row })
      }
    }

    // Shuffle and take up to EARTHQUAKE_COLLAPSE_COUNT
    for (let i = terrainCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [terrainCandidates[i], terrainCandidates[j]] = [terrainCandidates[j], terrainCandidates[i]]
    }

    const collapseTargets = terrainCandidates.slice(0, BALANCE.EARTHQUAKE_COLLAPSE_COUNT)
    const collapsedPositions: { x: number; y: number }[] = []

    for (const pos of collapseTargets) {
      this.grid[pos.y][pos.x] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
      collapsedPositions.push(pos)
      this.spawnBreakParticles(pos.x * TILE_SIZE, pos.y * TILE_SIZE, BlockType.Dirt)
    }

    // === Phase 3: Rubble — fill some Empty cells near collapsed blocks with Dirt ===
    // For each collapsed block, check its neighbours for empty revealed cells
    const rubbleCandidates = new Set<string>()
    for (const pos of collapsedPositions) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = pos.x + dx
        const ny = pos.y + dy
        if (nx < 0 || ny < 0 || nx >= this.gridWidth || ny >= this.gridHeight) continue
        if (`${nx},${ny}` === playerPosKey) continue
        const nCell = this.grid[ny][nx]
        if (nCell.type !== BlockType.Empty) continue
        if (!nCell.revealed) continue
        // 50% chance to become rubble
        if (Math.random() < 0.5) {
          rubbleCandidates.add(`${nx},${ny}`)
        }
      }
    }

    for (const key of rubbleCandidates) {
      const [rx, ry] = key.split(',').map(Number)
      if (`${rx},${ry}` === playerPosKey) continue
      this.grid[ry][rx] = { type: BlockType.Dirt, hardness: 1, maxHardness: 1, revealed: true }
    }

    // === Phase 4: Reveal — crack open fog near revealed space ===
    // Find unrevealed blocks that are directly adjacent to a revealed cell
    const revealCandidates: { x: number; y: number }[] = []
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const cell = this.grid[row][col]
        if (cell.revealed || cell.visibilityLevel !== undefined) continue
        if (protectedTypes.has(cell.type)) continue
        // Check if any orthogonal neighbour is revealed
        let hasRevealedNeighbour = false
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = col + dx
          const ny = row + dy
          if (nx < 0 || ny < 0 || nx >= this.gridWidth || ny >= this.gridHeight) continue
          if (this.grid[ny][nx].revealed) {
            hasRevealedNeighbour = true
            break
          }
        }
        if (hasRevealedNeighbour) {
          revealCandidates.push({ x: col, y: row })
        }
      }
    }

    // Shuffle and take up to EARTHQUAKE_REVEAL_COUNT
    for (let i = revealCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [revealCandidates[i], revealCandidates[j]] = [revealCandidates[j], revealCandidates[i]]
    }

    const revealTargets = revealCandidates.slice(0, BALANCE.EARTHQUAKE_REVEAL_COUNT)
    for (const pos of revealTargets) {
      this.grid[pos.y][pos.x].visibilityLevel = 1
    }

    // === Update fog of war from player position after all grid changes ===
    revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
    if (this.activeUpgrades.has('scanner_boost')) {
      this.revealSpecialBlocks()
    }

    // Emit event for GameManager to display a GAIA quip
    this.game.events.emit('earthquake', {
      collapsed: collapsedPositions.length,
      revealed: revealTargets.length,
    })

    this.redrawAll()
  }

  /**
   * Detonates a bomb centered on the player, clearing a 3x3 area of blocks.
   * Skips Unbreakable, ExitLadder, and QuizGate blocks.
   * Collects minerals, artifacts, and oxygen from destroyed special blocks.
   * LavaBlock and GasPocket are destroyed without applying their hazard effects.
   * Costs BOMB_OXYGEN_COST oxygen and decrements the bomb count by 1.
   */
  public useBomb(): void {
    const bombCount = this.activeUpgrades.get('bomb') ?? 0
    if (bombCount <= 0) return

    // Deduct one bomb
    this.activeUpgrades.set('bomb', bombCount - 1)

    // Deduct oxygen cost
    const oxygenResult = consumeOxygen(this.oxygenState, BALANCE.BOMB_OXYGEN_COST)
    this.oxygenState = oxygenResult.state
    this.game.events.emit('oxygen-changed', this.oxygenState)

    const cx = this.player.gridX
    const cy = this.player.gridY
    const radius = BALANCE.BOMB_RADIUS

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) continue

        const cell = this.grid[y][x]

        // Skip the player's own cell (already empty), unbreakable, exit ladder, and quiz gates
        if (
          cell.type === BlockType.Empty ||
          cell.type === BlockType.Unbreakable ||
          cell.type === BlockType.ExitLadder ||
          cell.type === BlockType.QuizGate
        ) continue

        const blockType = cell.type
        const content = cell.content

        // Destroy the block instantly
        this.spawnBreakParticles(x * TILE_SIZE, y * TILE_SIZE, blockType)
        this.grid[y][x] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
        this.blocksMinedThisRun += 1

        // Flash the destroyed tile with yellow tint
        this.flashTiles.set(`${x},${y}`, this.time.now)

        // Handle special block content (no hazard effects for lava/gas)
        switch (blockType) {
          case BlockType.MineralNode: {
            const mineralSlot: InventorySlot = {
              type: 'mineral',
              mineralTier: content?.mineralType,
              mineralAmount: content?.mineralAmount,
            }
            const added = this.addToInventory(mineralSlot)
            this.game.events.emit('mineral-collected', { ...content, addedToInventory: added })
            break
          }
          case BlockType.ArtifactNode: {
            const artifactSlot: InventorySlot = {
              type: 'artifact',
              artifactRarity: content?.artifactRarity,
              factId: content?.factId,
            }
            const added = this.addToInventory(artifactSlot)
            if (content?.factId) {
              this.artifactsFound.push(content.factId)
            }
            this.game.events.emit('artifact-found', {
              factId: content?.factId,
              rarity: content?.artifactRarity,
              addedToInventory: added,
            })
            break
          }
          case BlockType.OxygenCache: {
            const oxygenAmount = content?.oxygenAmount ?? BALANCE.OXYGEN_CACHE_RESTORE
            this.oxygenState = addOxygen(this.oxygenState, oxygenAmount)
            this.game.events.emit('oxygen-restored', { amount: oxygenAmount, state: this.oxygenState })
            this.game.events.emit('oxygen-changed', this.oxygenState)
            break
          }
          case BlockType.UpgradeCrate: {
            const upgrade = this.rollUpgrade()
            this.applyUpgrade(upgrade)
            this.game.events.emit('upgrade-found', { upgrade })
            break
          }
          default:
            // LavaBlock and GasPocket are destroyed without hazard effects
            break
        }
      }
    }

    this.game.events.emit('blocks-mined-update', this.blocksMinedThisRun)
    audioManager.playSound('mine_break')

    // Update fog of war after blast
    revealAround(this.grid, cx, cy, BALANCE.FOG_REVEAL_RADIUS)
    if (this.activeUpgrades.has('scanner_boost')) {
      this.revealSpecialBlocks()
    }

    // Update the bomb count in the Svelte store
    this.game.events.emit('bomb-used', { remaining: this.activeUpgrades.get('bomb') ?? 0 })

    if (oxygenResult.depleted) {
      this.game.events.emit('oxygen-depleted')
    }

    this.redrawAll()
  }

  /**
   * Gets the max stack size for a mineral tier.
   */
  private getMaxStackSize(tier: MineralTier): number {
    switch (tier) {
      case 'dust': return BALANCE.DUST_STACK_SIZE
      case 'shard': return BALANCE.SHARD_STACK_SIZE
      case 'crystal': return BALANCE.CRYSTAL_STACK_SIZE
      case 'geode': return BALANCE.GEODE_STACK_SIZE
      case 'essence': return BALANCE.ESSENCE_STACK_SIZE
      default: return 1
    }
  }

  /**
   * Adds an item to inventory with auto-stacking for minerals.
   * Minerals stack up to their max stack size before using a new slot.
   * Returns true if at least some of the item was added.
   */
  private addToInventory(slot: InventorySlot): boolean {
    // Non-minerals go to first empty slot (no stacking)
    if (slot.type !== 'mineral' || !slot.mineralTier) {
      const emptyIndex = this.inventory.findIndex((s) => s.type === 'empty')
      if (emptyIndex === -1) return false
      this.inventory[emptyIndex] = slot
      return true
    }

    const tier = slot.mineralTier
    const maxStack = this.getMaxStackSize(tier)
    let remaining = slot.mineralAmount ?? 1

    // First: try to add to existing stacks of the same mineral tier
    for (let i = 0; i < this.inventory.length && remaining > 0; i++) {
      const existing = this.inventory[i]
      if (existing.type === 'mineral' && existing.mineralTier === tier) {
        const currentAmount = existing.mineralAmount ?? 0
        const space = maxStack - currentAmount
        if (space > 0) {
          const toAdd = Math.min(remaining, space)
          this.inventory[i] = {
            ...existing,
            mineralAmount: currentAmount + toAdd,
          }
          remaining -= toAdd
        }
      }
    }

    // Second: overflow into empty slots as new stacks
    while (remaining > 0) {
      const emptyIndex = this.inventory.findIndex((s) => s.type === 'empty')
      if (emptyIndex === -1) break  // Inventory full

      const toAdd = Math.min(remaining, maxStack)
      this.inventory[emptyIndex] = {
        type: 'mineral',
        mineralTier: tier,
        mineralAmount: toAdd,
      }
      remaining -= toAdd
    }

    // Return true if we managed to store at least some
    return remaining < (slot.mineralAmount ?? 1)
  }

  /**
   * reveal_exit companion effect: scans the entire grid for the ExitLadder block and
   * marks it (and its immediate neighbours) with visibilityLevel=1 so it shows through fog.
   * Called once at the start of each layer.
   */
  private applyCompanionRevealExit(): void {
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.grid[y][x].type === BlockType.ExitLadder) {
          // Reveal the exit and a small ring around it
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx
              const ny = y + dy
              if (nx < 0 || ny < 0 || nx >= this.gridWidth || ny >= this.gridHeight) continue
              const cell = this.grid[ny][nx]
              if (!cell.revealed) {
                cell.visibilityLevel = 1
              }
            }
          }
          return // Only one exit per layer
        }
      }
    }
  }

  /**
   * scout_drone companion effect: at the start of a dive layer, reveals a random cluster
   * of ~30 unrevealed tiles to simulate a scouting drone flyover.
   * Prefers tiles toward the lower half of the mine (where the exit would be).
   */
  private applyCompanionScoutDrone(): void {
    const candidates: { x: number; y: number }[] = []
    const midY = Math.floor(this.gridHeight * 0.4)

    for (let y = midY; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x]
        if (!cell.revealed && (cell.visibilityLevel === undefined || cell.visibilityLevel < 1)) {
          candidates.push({ x, y })
        }
      }
    }

    // Fisher-Yates shuffle using seeded RNG
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }

    // Reveal up to 30 tiles as visibilityLevel=1 (fog ring — player can see what's there)
    const revealCount = Math.min(30, candidates.length)
    for (let i = 0; i < revealCount; i++) {
      this.grid[candidates[i].y][candidates[i].x].visibilityLevel = 1
    }
  }
}
