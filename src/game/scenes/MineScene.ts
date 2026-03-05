import Phaser from 'phaser'
import { get } from 'svelte/store'
import { BALANCE } from '../../data/balance'
import { BlockType, type InventorySlot, type MineCell, type MineralTier, type Rarity, type Relic, type RunUpgrade } from '../../data/types'
import { type Biome, DEFAULT_BIOME } from '../../data/biomes'
import { getActiveSynergies, pickRandomRelic, type SynergyEffect } from '../../data/relics'
import { type CompanionEffect } from '../../data/fossils'
import { Player } from '../entities/Player'
import { canMine, mineBlock } from '../systems/MiningSystem'
import { MinerAnimController } from '../systems/AnimationSystem'
import { GearOverlaySystem } from '../systems/GearOverlaySystem'
import { isAutotiledBlock, getAutotileGroup, bitmaskToSpriteKey, computeAllVariants, invalidateNeighborVariants } from '../systems/AutotileSystem'
import { resolveTileSpriteKey } from '../../data/biomeTileSpec'
import { transitionTileSpriteKey } from '../../data/biomeTileSpec'
import type { TileCategory } from '../../data/biomeTileSpec'
import { applyDepthBackground, computeDepthModifiers } from '../systems/DepthGradientSystem'
import { generateMine, generateTutorialMine, revealAround, seededRandom, type DifficultyProfile } from '../systems/MineGenerator'
import {
  addOxygen,
  consumeOxygen,
  createOxygenState,
  getOxygenCostForBlock,
  type OxygenState,
} from '../systems/OxygenSystem'
import { audioManager } from '../../services/audioService'
import { pickQuote } from '../../data/quotes'
import { setupCamera, PinchZoomController } from '../systems/CameraSystem'
import { CameraSequencer } from '../systems/CameraSequencer'
import { BlockShimmerSystem } from '../systems/BlockShimmerSystem'
import { ParticleSystem } from '../systems/ParticleSystem'
import { miniMapData } from '../../ui/stores/miniMap'
import { tickCount, layerTickCount } from '../../ui/stores/gameState'
import { LootPopSystem } from '../systems/LootPopSystem'
import { ImpactSystem } from '../systems/ImpactSystem'
import { BlockAnimSystem } from '../systems/BlockAnimSystem'
import { TickSystem } from '../systems/TickSystem'
import { HazardSystem } from '../systems/HazardSystem'
import { InstabilitySystem } from '../systems/InstabilitySystem'
import { MineEventSystem } from '../systems/MineEventSystem'
import { BASE_LAVA_HAZARD_DAMAGE, BASE_GAS_HAZARD_DAMAGE, getO2DepthMultiplier, CONSUMABLE_DROP_CHANCE, REVEAL_TIMING, DESCENT_ANIM } from '../../data/balance'
import { ALL_CONSUMABLE_IDS, CONSUMABLE_DEFS, type ConsumableId } from '../../data/consumables'
import { activeConsumables, addConsumableToDive, useConsumableFromDive, shieldActive, instabilityLevel, instabilityCollapsing, instabilityCountdown, activeAltar, activeMineEvent, gaiaMessage } from '../../ui/stores/gameState'
import { LANDMARK_TEMPLATES, COMPLETION_EVENTS, getLandmarkIdForLayer } from '../../data/landmarks'
import { BiomeParticleManager } from '../managers/BiomeParticleManager'
import { AudioManager } from '../managers/AudioManager'
import { BiomeGlowSystem } from '../systems/BiomeGlowSystem'
import { AnimatedTileSystem } from '../systems/AnimatedTileSystem'
import { ALL_BIOMES } from '../../data/biomes'
import { getSpriteUrls } from '../spriteManifest'
import { getSpriteResolution } from '../../ui/stores/settings'
import { GameManager } from '../GameManager'
import { BOSS_LAYER_MAP, createBoss } from '../entities/Boss'
import { CreatureSpawner } from '../systems/CreatureSpawner'
import { playerSave } from '../../ui/stores/playerData'
import { encounterManager } from '../managers/EncounterManager'

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
  [BlockType.Chest]: 0xffd700,             // gold
  [BlockType.Tablet]: 0x8888cc,            // blue-purple
  [BlockType.OfferingAltar]: 0x9944cc,     // purple — Phase 35.3
  [BlockType.LockedBlock]: 0x4a4a4a,       // same base as HardRock — Phase 35.6
  [BlockType.RecipeFragmentNode]: 0x44ccaa, // teal/cyan — Phase 35.5
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
  /** Optional secondary biome for dual-biome blending (Phase 49.2). */
  secondaryBiome?: Biome
  /** Optional dynamic difficulty profile derived from player engagement data (Phase 49.7). */
  difficultyProfile?: DifficultyProfile
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
  private playerSprite!: Phaser.GameObjects.Sprite
  private animController!: MinerAnimController
  private gearOverlay: GearOverlaySystem | null = null
  private playerVisualX: number = 0
  private playerVisualY: number = 0
  private readonly MOVE_LERP = 0.25
  private particles!: ParticleSystem
  private cameraSequencer: CameraSequencer | null = null
  private blockShimmer: BlockShimmerSystem | null = null
  private pinchZoom!: PinchZoomController
  private itemSpritePool: Phaser.GameObjects.Image[] = []
  private itemSpritePoolIndex = 0
  private flashTiles = new Map<string, number>()
  private lootPop!: LootPopSystem
  private impactSystem!: ImpactSystem
  private bufferedInput: { x: number; y: number } | null = null
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
  /** Active hazard manager — lava flows and gas clouds. Initialized in create(). */
  private hazardSystem: HazardSystem | null = null
  /** Layer instability meter — rises from hazards, collapses at 100%. (Phase 35.4) */
  private instabilitySystem: InstabilitySystem | null = null
  /** Random mine event dispatcher. (Phase 35.7) */
  private mineEventSystem: MineEventSystem | null = null
  /** Tracks which locked blocks have already shown a denial GAIA message this layer (prevent spam). */
  private lockedBlockDeniedSet: Set<string> = new Set()
  /** Tracks the last direction the player moved/mined, used for Drill Charge. */
  private playerFacing: 'up' | 'down' | 'left' | 'right' = 'down'
  /** Phase 9: Per-biome ambient particle manager. */
  private biomeParticles: BiomeParticleManager | null = null
  /** Phase 9: Biome audio crossfading manager. */
  private audioManager: AudioManager | null = null
  /** Phase 9: Fog glow system for luminous blocks. */
  private glowSystem: BiomeGlowSystem | null = null
  /** Phase 9: Animated tile frame cycling system. */
  private animatedTileSystem: AnimatedTileSystem | null = null
  /** Tracks whether LINEAR texture filters have been applied after the first sprite load. */
  private _filtersApplied = false
  /** Phase 33.5: Depth gradient overlay graphics layer (darkens viewport at deeper layers). */
  private depthOverlayGraphics!: Phaser.GameObjects.Graphics
  /** Phase 33.6: Biome ID of the adjacent layer (used for transition tile rendering). */
  private transitionBiomeId: import('../../data/biomes').BiomeId | null = null
  /** Phase 49.2: Optional secondary biome for dual-biome blended layers. */
  private secondaryBiome: Biome | undefined = undefined
  /** Phase 49.7: Optional dynamic difficulty profile. */
  private difficultyProfile: DifficultyProfile | undefined = undefined
  /** Phase 36: Creature spawner — manages random encounter timing and selection. */
  private creatureSpawner = new CreatureSpawner()

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
      // Phase 36: Reset creature spawner for a fresh dive
      this.creatureSpawner.resetForDive()
    } else {
      // Phase 36: Reset creature spawner for a new layer (but not a full dive reset)
      this.creatureSpawner.resetForLayer()
    }
    if ((data.layer ?? 0) !== 0 && data.collectedRelics) {
      this.collectedRelics = [...data.collectedRelics]
    }
    this.rng = seededRandom((data.seed ?? Date.now()) ^ 0xdeadbeef)
    // Store biome passed from GameManager (if any); create() will pick one if absent.
    if (data.biome) {
      this.currentBiome = data.biome
    }
    // Phase 9.3: Developer biome override via URL parameter
    const urlParams = new URLSearchParams(window.location.search)
    const biomeOverride = urlParams.get('biome')
    if (biomeOverride) {
      const found = ALL_BIOMES.find(b => b.id === biomeOverride)
      if (found) {
        this.currentBiome = found
        console.info(`[MineScene] Biome override active: ${found.name}`)
      }
    }
    // Phase 49.2/49.7: Capture optional secondary biome and difficulty profile.
    this.secondaryBiome = data.secondaryBiome
    this.difficultyProfile = data.difficultyProfile
    // Capture companion effect for this layer.
    this.companionEffect = data.companionEffect ?? null
    this.companionFlash = false
  }

  /**
   * Preload mine sprites on first entry. Skips if textures are already cached
   * (e.g. layer transitions within the same dive).
   */
  preload(): void {
    // Skip if already loaded (layer transitions reuse cached textures)
    if (this.textures.exists('tile_dirt')) return

    const cam = this.cameras.main
    const width = cam?.width ?? 800
    const height = cam?.height ?? 600

    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x16213e, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50)

    const progressBar = this.add.graphics()
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Preparing mine...', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#e94560',
    })
    loadingText.setOrigin(0.5, 0.5)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0xe94560, 1)
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
      loadingText.destroy()
    })

    const resolution = getSpriteResolution()
    const spriteUrls = getSpriteUrls(resolution)
    for (const [key, url] of Object.entries(spriteUrls)) {
      if (key === 'miner_sheet') continue
      this.load.image(key, url)
    }

    const minerSheetKey = 'miner_sheet'
    if (spriteUrls[minerSheetKey]) {
      this.load.spritesheet(minerSheetKey, spriteUrls[minerSheetKey], {
        frameWidth:  resolution === 'high' ? 256 : 32,
        frameHeight: resolution === 'high' ? 384 : 48,   // 48px height (2:3 ratio for 32×48 frames)
      })
    }
  }

  /**
   * Creates mine state, camera, rendering layers, and input handlers.
   */
  create(): void {
    // Apply LINEAR filter for hi-res sprites (first mine entry only)
    if (getSpriteResolution() === 'high' && !this._filtersApplied) {
      const texManager = this.textures
      for (const key of Object.keys(getSpriteUrls('high'))) {
        const texture = texManager.get(key)
        if (texture) {
          texture.setFilter(Phaser.Textures.FilterMode.LINEAR)
        }
      }
      this._filtersApplied = true
    }

    audioManager.unlock()

    // Initialize or reset tick system depending on whether this is a new dive or a new layer.
    const ts = TickSystem.getInstance()
    if (this.currentLayer === 0) {
      // Fresh dive — full reset of all tick state and registered callbacks
      ts.resetAll()
      tickCount.set(0)
      layerTickCount.set(0)
    } else {
      // Layer descent — preserve cumulative tick count but reset the per-layer counter
      ts.resetLayerTick()
      layerTickCount.set(0)
    }

    // Phase 14: Use tutorial mine for first-time players
    const isTutorial = GameManager.getInstance().isTutorialDive
    const mineResult = isTutorial
      ? generateTutorialMine()
      : generateMine(
          this.seed, this.facts, this.currentLayer, this.currentBiome,
          this.secondaryBiome, undefined, this.difficultyProfile,
        )
    this.grid = mineResult.grid
    this.currentBiome = mineResult.biome
    // Compute initial autotile variants for all terrain blocks (blob47 for hero biomes)
    computeAllVariants(this.grid, this.currentBiome.id)
    // Phase 33.5: Apply depth-adjusted background color
    applyDepthBackground(this.cameras.main, this.currentBiome, this.currentLayer)
    // GAIA biome entry comment (DD-V2-057)
    if (this.currentBiome.gaiaEntryComment) {
      this.game.events.emit('gaia-toast', this.currentBiome.gaiaEntryComment)
    }
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

    // Phase 33.5: Depth gradient overlay — fixed to camera, above tiles, below sprites
    this.depthOverlayGraphics = this.add.graphics()
    this.depthOverlayGraphics.setDepth(4)
    this.depthOverlayGraphics.setScrollFactor(0)

    const startPx = startX * TILE_SIZE + TILE_SIZE * 0.5
    const startPy = startY * TILE_SIZE + TILE_SIZE          // bottom of the tile, not center

    // Use sprite sheet if available, otherwise fall back to static image
    if (this.textures.exists('miner_sheet')) {
      this.playerSprite = this.add.sprite(startPx, startPy, 'miner_sheet', 0)
    } else {
      this.playerSprite = this.add.sprite(startPx, startPy, 'miner_idle')
    }

    // Anchor at feet (bottom-center) so character's feet align with the tile grid
    this.playerSprite.setOrigin(0.5, 1.0)

    // Display at tile width; height is 1.5× to accommodate the 32×48 frame
    this.playerSprite.setDisplaySize(TILE_SIZE, TILE_SIZE * 1.5)  // 32×48 at 32px tile size
    this.playerSprite.setDepth(10)

    // Visual tracking variables use the BOTTOM of the tile as the Y reference
    this.playerVisualX = startPx
    this.playerVisualY = startY * TILE_SIZE + TILE_SIZE   // bottom of tile

    // Set up animation controller
    this.animController = new MinerAnimController(this.playerSprite)
    if (this.textures.exists('miner_sheet')) {
      this.animController.registerAnims(this)
      this.animController.setIdle()
      this.setupMineSwingFrameEvent()
    }

    // Set up gear overlay system
    this.gearOverlay = new GearOverlaySystem(this)
    this.gearOverlay.init()
    this.gearOverlay.setPickaxeTier(this.pickaxeTierIndex)
    // Companion badge: use the companion ID from the player's active companion (from save)
    this.gearOverlay.setCompanionBadge(this.companionEffect ? 'active' : null)
    // Set relic glow when relics are equipped (use 'common' as default since Relic type doesn't track tier)
    if (this.collectedRelics.length > 0) {
      this.gearOverlay.setRelicGlow('common')
    }

    // Initialize particle system with per-block-type emitters
    this.particles = new ParticleSystem(this)
    this.particles.init()

    // Phase 31: Initialize shimmer system for high-rarity ArtifactNode tiles
    this.blockShimmer = new BlockShimmerSystem(this, TILE_SIZE)
    this.blockShimmer.init()

    // Initialize loot pop and impact feedback systems
    this.lootPop = new LootPopSystem(this)
    this.impactSystem = new ImpactSystem(this)

    const worldWidth = this.gridWidth * TILE_SIZE
    const worldHeight = this.gridHeight * TILE_SIZE
    setupCamera(this.cameras.main, worldWidth, worldHeight, TILE_SIZE)
    this.cameras.main.startFollow(
      this.playerSprite,
      true,    // roundPixels
      0.12,    // lerpX
      0.12,    // lerpY
      0,       // offsetX
      -(TILE_SIZE * 0.75)   // offsetY: shift camera up by 0.75 tiles to center on torso
    )
    this.pinchZoom = new PinchZoomController(this.cameras.main, this.input)

    // Phase 31: Initialize camera sequencer for artifact reveals and descent
    this.cameraSequencer = new CameraSequencer(this)

    // Start biome-specific ambient particles
    this.particles.startAmbientEmitters(this.currentBiome, worldWidth, worldHeight)

    // Phase 9: Per-biome particle manager
    this.biomeParticles = new BiomeParticleManager(this)
    this.biomeParticles.activateBiome(this.currentBiome.id)

    // Phase 9: Audio manager for biome crossfading
    this.audioManager = new AudioManager(this)
    this.audioManager.transitionToBiome(this.currentBiome.id)

    // Phase 9: Fog glow system for luminous blocks
    this.glowSystem = new BiomeGlowSystem(this, 32) // 32px tile size
    this.glowSystem.init()

    // Phase 9.15: Animated tile system
    this.animatedTileSystem = new AnimatedTileSystem()

    this.redrawAll()
    revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
    // Update fog glow after initial block reveals
    if (this.glowSystem) {
      this.glowSystem.update(this.grid)
    }

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

    // Phase 31: Register ArtifactNode tiles for shimmer rendering
    if (this.blockShimmer) {
      this.blockShimmer.clear()
      for (let row = 0; row < this.gridHeight; row++) {
        for (let col = 0; col < this.gridWidth; col++) {
          const cell = this.grid[row][col]
          if (cell && cell.type === BlockType.ArtifactNode && cell.content?.artifactRarity) {
            this.blockShimmer.registerNode(col, row, col * TILE_SIZE, row * TILE_SIZE, cell.content.artifactRarity as Rarity)
          }
        }
      }
    }

    // Initialize HazardSystem — active lava flows and gas clouds. (Phase 8.3)
    this.hazardSystem = new HazardSystem(
      this.gridWidth,
      this.gridHeight,
      (x, y) => this.grid[y]?.[x]?.type?.toString() ?? 'Unbreakable',
      (x, y) => this.grid[y]?.[x]?.type === BlockType.Empty,
      (x, y) => this.grid[y]?.[x]?.type === BlockType.Unbreakable,
      () => ({ x: this.player.gridX, y: this.player.gridY }),
      () => this.handleLavaContact(),
      () => this.handleGasContact(),
      (x, y) => this.markCellAsLava(x, y),
    )
    TickSystem.getInstance().register('hazard-system',
      (tick, layerTick) => this.hazardSystem?.onTick(tick, layerTick)
    )

    // ---- Phase 35.4: Instability system ----
    this.instabilitySystem = new InstabilitySystem(
      () => {
        gaiaMessage.set("Structural readings critical. Find the shaft — now.")
        audioManager.playSound('oxygen_warning')
        instabilityLevel.set(this.instabilitySystem!.getLevel())
      },
      () => {
        this.triggerInstabilityCollapse()
        instabilityCollapsing.set(true)
      },
      (remaining) => {
        instabilityCountdown.set(remaining)
        instabilityLevel.set(this.instabilitySystem?.getLevel() ?? 100)
        if (remaining <= 0) {
          instabilityCollapsing.set(false)
          this.forceLayerFail()
        }
      },
    )
    TickSystem.getInstance().register('instability', (t, lt) => {
      this.instabilitySystem?.onTick(t, lt)
      if (this.instabilitySystem) {
        instabilityLevel.set(this.instabilitySystem.getLevel())
      }
    })

    // ---- Phase 35.7: Mine event system ----
    this.mineEventSystem = new MineEventSystem((type) => {
      this.game.events.emit('mine-event', { type })
    })
    TickSystem.getInstance().register('mine-events', (t, lt) => this.mineEventSystem?.onTick(t, lt))

    this.input.on('pointerdown', this.handlePointerDown, this)
    this.input.keyboard?.on('keydown', this.handleKeyDown, this)
    this.events.on('shutdown', this.handleShutdown, this)

    this.game.events.emit('mine-started', {
      seed: this.seed,
      oxygen: this.oxygenState,
      inventorySlots: this.inventorySlots,
      layer: this.currentLayer,
    })

    // Handle landmark-specific entry effects (toasts, hazard activation). (DD-V2-055)
    this.handleLandmarkEntry()
  }

  // =========================================================
  // Phase 10.15 — Entry transition
  // =========================================================

  /**
   * Play a fade-in entry transition when entering the mine from the dome.
   * Call this immediately after the scene becomes active.
   * Phase 31.5: uses DESCENT_ANIM.fadeInDurationMs for layer-descent continuity.
   */
  async playEntryTransition(): Promise<void> {
    this.cameras.main.fadeIn(DESCENT_ANIM.fadeInDurationMs, 0, 0, 0)
    await new Promise<void>(resolve => {
      this.cameras.main.once('camerafadeincomplete', () => resolve())
    })
  }

  /**
   * Phaser update loop — redraws the visible mine each frame.
   */
  update(_time: number, delta: number): void {
    this.animatedTileSystem?.update(delta)
    this.pinchZoom?.update()
    // O2 warning particles when below 30%
    if (this.particles && this.oxygenState) {
      const oxygenPct = this.oxygenState.current / this.oxygenState.max
      const cam = this.cameras.main
      this.particles.setO2Warning(
        oxygenPct < 0.3,
        cam.scrollX, cam.scrollY,
        cam.width, cam.height
      )
    }
    // Phase 31: Update shimmer overlays for high-rarity ArtifactNode tiles
    this.blockShimmer?.update(this.time.now)
    // Phase 29: Update gear overlays to follow player
    this.gearOverlay?.update(this.playerVisualX, this.playerVisualY, this.time.now)
    this.redrawAll()
  }

  private redrawAll(): void {
    this.updateCameraTarget()
    this.drawDepthOverlay()
    this.drawTiles()
    this.drawPlayer()
    // Update mini-map store
    miniMapData.set({
      grid: this.grid,
      playerX: this.player.gridX,
      playerY: this.player.gridY,
    })
  }

  /** Camera follow is now handled by Phaser's startFollow(). */
  private updateCameraTarget(): void {
    // No-op — Phaser's built-in camera follow handles position tracking.
    // Kept as a method stub since redrawAll() calls it.
  }

  /**
   * Phase 33.5: Draws a semi-transparent dark overlay over the entire viewport.
   * Overlay alpha scales with depth: 0 at layer 0, ~0.30 at layer 19.
   */
  private drawDepthOverlay(): void {
    if (!this.depthOverlayGraphics) return
    const { viewportDarkAlpha } = computeDepthModifiers(this.currentLayer, this.currentBiome)
    this.depthOverlayGraphics.clear()
    if (viewportDarkAlpha > 0) {
      const cam = this.cameras.main
      this.depthOverlayGraphics.fillStyle(0x000000, viewportDarkAlpha)
      this.depthOverlayGraphics.fillRect(0, 0, cam.width, cam.height)
    }
  }

  /**
   * Phase 33.6: Returns the transition edge direction for a cell based on its grid position.
   * Top rows return 'n', bottom rows return 's'.
   */
  private getTransitionEdge(tileX: number, tileY: number): 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' {
    if (tileY < 3) return 'n'
    if (tileY >= this.gridHeight - 3) return 's'
    if (tileX < 3) return 'w'
    if (tileX >= this.gridWidth - 3) return 'e'
    return 'n'
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

  /**
   * Returns the biome accent tint color for critical special blocks (DD-V2-241).
   * Critical blocks (QuizGate, DescentShaft, ExitLadder) use a universal shape
   * with biome-specific accent coloring for visual integration.
   */
  private getBiomeAccentTint(): number {
    return this.currentBiome.palette?.accent ?? this.currentBiome.ambientColor
  }

  private drawBlockPattern(cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
    const cx = px + TILE_SIZE * 0.5
    const cy = py + TILE_SIZE * 0.5
    switch (cell.type) {
      case BlockType.Dirt:
      case BlockType.SoftRock: {
        const mask = cell.tileVariant ?? 0
        const category: TileCategory = 'soil'
        // Phase 33.3: Try biome-specific tile first, fall back to universal autotile
        const biomeSpriteKey = resolveTileSpriteKey(this.currentBiome.id, category, mask, this.textures)
        // Phase 33.6: Use transition tile if cell is in a transition zone
        if (cell.isTransitionZone && this.transitionBiomeId) {
          const edgeDir = this.getTransitionEdge(tileX, tileY)
          const transKey = transitionTileSpriteKey(this.currentBiome.id, this.transitionBiomeId, category, edgeDir)
          if (this.textures.exists(transKey)) {
            this.getPooledSprite(transKey, cx, cy)
            break
          }
        }
        this.getPooledSprite(biomeSpriteKey, cx, cy)
        break
      }
      case BlockType.Stone:
      case BlockType.HardRock:
      case BlockType.Unbreakable: {
        const mask = cell.tileVariant ?? 0
        const category: TileCategory = 'rock'
        // Phase 33.3: Try biome-specific tile first, fall back to universal autotile
        const biomeSpriteKey = resolveTileSpriteKey(this.currentBiome.id, category, mask, this.textures)
        // Phase 33.6: Use transition tile if cell is in a transition zone
        if (cell.isTransitionZone && this.transitionBiomeId) {
          const edgeDir = this.getTransitionEdge(tileX, tileY)
          const transKey = transitionTileSpriteKey(this.currentBiome.id, this.transitionBiomeId, category, edgeDir)
          if (this.textures.exists(transKey)) {
            this.getPooledSprite(transKey, cx, cy)
            break
          }
        }
        this.getPooledSprite(biomeSpriteKey, cx, cy)
        break
      }
      case BlockType.OxygenCache: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.OxygenCache, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_oxygen_cache', cx, cy)
        break
      }
      case BlockType.UpgradeCrate: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.UpgradeCrate, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_upgrade_crate', cx, cy)
        break
      }
      case BlockType.QuizGate: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.QuizGate, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_quiz_gate', cx, cy)
        break
      }
      case BlockType.ExitLadder:
        this.getPooledSprite('block_exit_ladder', cx, cy)
        break
      case BlockType.DescentShaft: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.DescentShaft, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_descent_shaft', cx, cy)
        break
      }
      case BlockType.MineralNode: {
        const tier = cell.content?.mineralType ?? 'dust'
        const mineralKey = tier === 'essence' ? 'block_mineral_essence'
          : tier === 'geode' ? 'block_mineral_geode'
          : tier === 'crystal' ? 'block_mineral_crystal'
          : tier === 'shard' ? 'block_mineral_shard'
          : 'block_mineral_dust'
        this.getPooledSprite(mineralKey, cx, cy)
        // Shimmer overlay animation
        const shimmerKey = BlockAnimSystem.getFrameKey(BlockType.MineralNode, this.time.now, this.textures)
        if (shimmerKey) {
          const shimmer = this.getPooledSprite(shimmerKey, cx, cy)
          shimmer.setAlpha(0.3)
          shimmer.setDepth(6)
        }
        // Essence overlay: radiating gold star rays on top of sprite
        if (tier === 'essence') {
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
        }
        break
      }
      case BlockType.ArtifactNode: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.ArtifactNode, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_artifact', cx, cy)
        break
      }
      case BlockType.LavaBlock: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.LavaBlock, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_lava', cx, cy)
        // Lava glow overlay: bright highlight dot on top of sprite
        this.overlayGraphics.fillStyle(0xff8800, 0.6)
        const dotX = px + 4 + this.seededModulo(tileX, tileY, 7, TILE_SIZE - 8)
        const dotY = py + 4 + this.seededModulo(tileX, tileY, 11, TILE_SIZE - 8)
        this.overlayGraphics.fillCircle(dotX, dotY, 2)
        break
      }
      case BlockType.GasPocket: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.GasPocket, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_gas', cx, cy)
        break
      }
      case BlockType.UnstableGround: {
        this.getPooledSprite('block_unstable', cx, cy)
        break
      }
      case BlockType.QuoteStone: {
        this.getPooledSprite('block_quote_stone', cx, cy)
        break
      }
      case BlockType.RelicShrine: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.RelicShrine, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_relic_shrine', cx, cy)
        break
      }
      case BlockType.SendUpStation: {
        this.getPooledSprite('block_send_up', cx, cy)
        break
      }
      case BlockType.OxygenTank: {
        this.getPooledSprite('block_oxygen_tank', cx, cy)
        break
      }
      case BlockType.DataDisc: {
        this.getPooledSprite('block_data_disc', cx, cy)
        break
      }
      case BlockType.FossilNode: {
        const animKey = BlockAnimSystem.getFrameKey(BlockType.FossilNode, this.time.now, this.textures)
        this.getPooledSprite(animKey ?? 'block_fossil', cx, cy)
        break
      }
      case BlockType.Chest: {
        const g = this.tileGraphics
        g.fillStyle(0xffd700)
        g.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
        // Inner detail — darker gold band across center
        g.fillStyle(0xcc9900)
        g.fillRect(px + 4, py + TILE_SIZE / 2 - 1, TILE_SIZE - 8, 2)
        break
      }
      case BlockType.Tablet: {
        const g = this.tileGraphics
        g.fillStyle(0x8888cc)
        g.fillRect(px + 3, py + 1, TILE_SIZE - 6, TILE_SIZE - 2)
        // Inscription lines
        g.fillStyle(0xaaaaee)
        g.fillRect(px + 5, py + 3, TILE_SIZE - 10, 1)
        g.fillRect(px + 5, py + 6, TILE_SIZE - 10, 1)
        g.fillRect(px + 5, py + 9, TILE_SIZE - 12, 1)
        break
      }
      default:
        break
    }
  }

  /**
   * Renders a sprite-based crack overlay on a damaged block.
   * Replaces the old procedural crack drawing with 4 damage stages.
   */
  private drawCrackOverlay(cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
    if (cell.maxHardness <= 0 || cell.hardness <= 0 || cell.hardness >= cell.maxHardness) return

    const damagePercent = 1 - cell.hardness / cell.maxHardness
    if (damagePercent < 0.25) return  // Stage 0: pristine

    const cx = px + TILE_SIZE * 0.5
    const cy = py + TILE_SIZE * 0.5

    // Select crack sprite key based on damage stage
    let crackKey: string
    if (damagePercent < 0.50) {
      crackKey = 'crack_stage1'  // hairline
    } else if (damagePercent < 0.75) {
      crackKey = 'crack_stage2'  // medium fractures
    } else if (damagePercent < 0.90) {
      crackKey = 'crack_stage3'  // severe breaks
    } else {
      crackKey = 'crack_stage4'  // crumbling
    }

    // Graceful fallback to legacy procedural cracks
    if (!this.textures.exists(crackKey)) {
      this.drawLegacyCracks(px, py, tileX, tileY, damagePercent)
      return
    }

    const crackSprite = this.getPooledSprite(crackKey, cx, cy)
    crackSprite.setDepth(6)  // Above tile (5), below overlay graphics (7)
    crackSprite.setAlpha(0.7 + damagePercent * 0.3)

    // Per-block-type crack tinting
    if (cell.type === BlockType.Dirt || cell.type === BlockType.SoftRock) {
      crackSprite.setTint(0x6b3a2a)
    } else if (cell.type === BlockType.LavaBlock) {
      crackSprite.setTint(0xcc2200)
    } else if (cell.type === BlockType.GasPocket) {
      crackSprite.setTint(0x224422)
    } else {
      crackSprite.setTint(0x2a2a2a)  // dark gray for rock types
    }
  }

  /**
   * Draws procedural crack lines on the overlayGraphics for a partially mined block.
   * Uses a position-seeded pattern so cracks are visually consistent across redraws.
   *
   * @param px - Pixel x of the tile top-left corner
   * @param py - Pixel y of the tile top-left corner
   * @param tileX - Grid column (used for seeded offsets)
   * @param tileY - Grid row (used for seeded offsets)
   * @param damagePercent - Value from 0 to 1 (0 = undamaged, 1 = about to break)
   */
  private drawLegacyCracks(px: number, py: number, tileX: number, tileY: number, damagePercent: number): void {
    // 0-33% damage: no overlay
    if (damagePercent <= 0.33) return

    const s = TILE_SIZE
    const cx = px + s * 0.5
    const cy = py + s * 0.5

    // Seeded sub-pixel offsets so each tile's cracks look unique but are stable
    const ox1 = this.seededModulo(tileX, tileY, 5, s * 0.15)
    const oy1 = this.seededModulo(tileX + 1, tileY, 7, s * 0.15)
    const ox2 = this.seededModulo(tileX, tileY + 1, 11, s * 0.15)
    const oy2 = this.seededModulo(tileX + 2, tileY, 13, s * 0.15)

    if (damagePercent <= 0.66) {
      // 34-66% damage: 2-3 thin cracks
      this.overlayGraphics.lineStyle(1, 0x1a1a1a, 0.6)
      this.overlayGraphics.beginPath()
      this.overlayGraphics.moveTo(px + s * 0.2 + ox1, py + s * 0.1 + oy1)
      this.overlayGraphics.lineTo(cx, cy)
      this.overlayGraphics.lineTo(px + s * 0.8 + ox2, py + s * 0.9 + oy2)
      this.overlayGraphics.strokePath()

      this.overlayGraphics.beginPath()
      this.overlayGraphics.moveTo(px + s * 0.6 + ox2, py + s * 0.05 + oy1)
      this.overlayGraphics.lineTo(cx - ox1 * 0.5, cy - oy1 * 0.5)
      this.overlayGraphics.strokePath()
    } else {
      // 67-99% damage: 4-6 thick cracks with extra branch lines
      this.overlayGraphics.lineStyle(2, 0x1a1a1a, 0.65)
      this.overlayGraphics.beginPath()
      this.overlayGraphics.moveTo(px + s * 0.2 + ox1, py + s * 0.1 + oy1)
      this.overlayGraphics.lineTo(cx, cy)
      this.overlayGraphics.lineTo(px + s * 0.8 + ox2, py + s * 0.9 + oy2)
      this.overlayGraphics.strokePath()

      this.overlayGraphics.beginPath()
      this.overlayGraphics.moveTo(px + s * 0.1 + ox2, py + s * 0.7 + oy2)
      this.overlayGraphics.lineTo(cx + ox1 * 0.3, cy - oy1 * 0.3)
      this.overlayGraphics.lineTo(px + s * 0.9 - ox1, py + s * 0.3 - oy2)
      this.overlayGraphics.strokePath()

      this.overlayGraphics.lineStyle(1, 0x1a1a1a, 0.5)
      this.overlayGraphics.beginPath()
      this.overlayGraphics.moveTo(cx, cy)
      this.overlayGraphics.lineTo(px + s * 0.55 + ox2, py + s * 0.05 + oy1)
      this.overlayGraphics.strokePath()

      this.overlayGraphics.beginPath()
      this.overlayGraphics.moveTo(cx, cy)
      this.overlayGraphics.lineTo(px + s * 0.05 + ox1, py + s * 0.45 + oy2)
      this.overlayGraphics.strokePath()

      // Small fragment chip near top-left
      this.overlayGraphics.fillStyle(0x000000, 0.30)
      this.overlayGraphics.fillTriangle(
        px + 3 + ox1, py + 3 + oy1,
        px + 3 + ox1 + 5, py + 3 + oy1,
        px + 3 + ox1, py + 3 + oy1 + 5,
      )
    }
  }

  private getPooledSprite(key: string, x: number, y: number): Phaser.GameObjects.Image {
    const POOL_CEILING = 500
    const idx = this.itemSpritePoolIndex >= POOL_CEILING ? POOL_CEILING - 1 : this.itemSpritePoolIndex
    let sprite = this.itemSpritePool[idx]
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
    const camera = this.cameras.main
    if (!camera || !camera.worldView) return  // guard: camera not ready (scene transition)

    this.itemSpritePoolIndex = 0
    this.itemSpritePool.forEach(s => s.setVisible(false))
    this.tileGraphics.clear()
    this.overlayGraphics.clear()

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

          // Phase 33.4: Use per-biome fog palette for distinct colored fog
          const fp = this.currentBiome.fogPalette
          if (visLevel === 1) {
            // Ring 1: render actual tile sprite, dimmed by biome ring1 tint
            const borderBrightness = Math.min(0.90, 0.80 + scannerCount * 0.05)
            // Biome fog palette ring1 background in case sprite has transparency
            this.tileGraphics.fillStyle(fp.ring1, 1)
            this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            // Render the tile sprite (depth 5)
            this.drawBlockPattern(cell, x, y, px, py)
            // Dim overlay using fog palette ring1DimAlpha
            const dimAmount = Math.max(1.0 - borderBrightness, fp.ring1DimAlpha * 0.5)
            this.overlayGraphics.fillStyle(0x000000, dimAmount)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            // Rarity hint: full-tile shimmer overlays for valuable blocks (Advanced+ scanner)
            if (tierInfo.showsRarity) {
              const shimmerBase = 0.5 + 0.5 * Math.sin(this.time.now / 1000)
              if (cell.type === BlockType.ArtifactNode) {
                // Golden glow — pulsing full-tile overlay + bright center spot
                const artifactAlpha = 0.10 + 0.05 * shimmerBase
                this.overlayGraphics.fillStyle(0xffc832, artifactAlpha)
                this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
                this.overlayGraphics.fillStyle(0xffd700, artifactAlpha + 0.08)
                const cw = TILE_SIZE * 0.5
                this.overlayGraphics.fillRect(px + cw * 0.5, py + cw * 0.5, cw, cw)
                // Bright corner-to-corner border so it reads clearly at a glance
                this.overlayGraphics.lineStyle(2, 0xffd700, 0.55 + 0.25 * shimmerBase)
                this.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
              } else if (cell.type === BlockType.MineralNode) {
                // Per-tier colored shimmer across the whole tile
                const tier = cell.content?.mineralType ?? 'dust'
                const glowColor = tier === 'essence' ? 0xffd700
                  : tier === 'geode' ? 0xda70d6
                  : tier === 'crystal' ? 0xff4444
                  : tier === 'shard' ? 0x44ff88
                  : 0x4ecca3
                const mineralAlpha = 0.08 + 0.04 * shimmerBase
                this.overlayGraphics.fillStyle(glowColor, mineralAlpha)
                this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
                // Bright corner dot for quick identification
                this.overlayGraphics.fillStyle(glowColor, 0.80 + 0.15 * shimmerBase)
                this.overlayGraphics.fillCircle(px + TILE_SIZE - 7, py + 7, 5)
                this.overlayGraphics.lineStyle(1, glowColor, 0.45)
                this.overlayGraphics.strokeCircle(px + TILE_SIZE - 7, py + 7, 7)
              } else if (cell.type === BlockType.DataDisc) {
                // Cyan glow
                const discAlpha = 0.10 + 0.05 * shimmerBase
                this.overlayGraphics.fillStyle(0x00c8ff, discAlpha)
                this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
                this.overlayGraphics.lineStyle(2, 0x00c8ff, 0.45 + 0.20 * shimmerBase)
                this.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
              } else if (cell.type === BlockType.FossilNode) {
                // Warm brown glow
                const fossilAlpha = 0.08 + 0.04 * shimmerBase
                this.overlayGraphics.fillStyle(0xb48c50, fossilAlpha)
                this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
                this.overlayGraphics.lineStyle(2, 0xd4a574, 0.40 + 0.20 * shimmerBase)
                this.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
              }
            }
            // Hazard hint: pulsing red border outline around the tile (Enhanced+ scanner)
            if (tierInfo.showsHazards) {
              if (
                cell.type === BlockType.LavaBlock ||
                cell.type === BlockType.GasPocket ||
                cell.type === BlockType.UnstableGround
              ) {
                const hazardPulse = 0.5 + 0.5 * Math.sin(this.time.now / 400)
                // Thick red border outline — highly visible on mobile
                this.overlayGraphics.lineStyle(3, 0xff3333, 0.25 + 0.15 * hazardPulse)
                this.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
                // Faint red fill to reinforce the warning
                this.overlayGraphics.fillStyle(0xff3333, 0.06 + 0.04 * hazardPulse)
                this.overlayGraphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
                // Small warning triangle in the top-left corner for quick scanning
                const tx = px + 4
                const ty = py + 4
                const ts = 9
                this.overlayGraphics.fillStyle(0xff2200, 0.85 + 0.10 * hazardPulse)
                this.overlayGraphics.fillTriangle(tx, ty + ts, tx + ts * 0.5, ty, tx + ts, ty + ts)
                this.overlayGraphics.lineStyle(1, 0xffffff, 0.70)
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
            // Ring 2: only visible with scanner; render sprite with lighter dim
            const dimBrightness = Math.min(0.30, 0.10 + (scannerCount - 1) * 0.10)
            // Phase 33.4: Use fog palette ring2 color
            this.tileGraphics.fillStyle(fp.ring2, 1)
            this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            this.drawBlockPattern(cell, x, y, px, py)
            const dimAmount = Math.max(1.0 - dimBrightness, fp.ring2DimAlpha)
            this.overlayGraphics.fillStyle(0x000000, dimAmount)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          } else {
            // Hidden: use biome fog palette hidden color (distinct per biome)
            this.tileGraphics.fillStyle(fp.hidden, 1)
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
          // Biome tint overlay: apply semi-transparent color on top of geology sprites
          if (
            cell.type === BlockType.Dirt ||
            cell.type === BlockType.SoftRock ||
            cell.type === BlockType.Stone ||
            cell.type === BlockType.HardRock
          ) {
            // NOTE: Per-biome color tint reduced (DD-V2-240).
            // Each biome now uses its own palette-accurate sprites — strong uniform tint
            // creates "double-tint" muddiness. 0.05 alpha atmospheric wash retained
            // for layer-depth cohesion only.
            const hw = this.currentBiome.hazardWeights
            const mw = this.currentBiome.mineralWeights
            if (hw.lavaBlockDensity > 0.3) {
              this.overlayGraphics.fillStyle(0xb43c1e, 0.05)
              this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            } else if (mw.crystalMultiplier >= 1.5 || mw.geodeMultiplier >= 1.5) {
              this.overlayGraphics.fillStyle(0x5078c8, 0.05)
              this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            } else {
              this.overlayGraphics.fillStyle(this.currentBiome.ambientColor, 0.04)
              this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
            }
          }
          // DD-V2-241: Biome accent tint for critical special blocks
          if (
            cell.type === BlockType.QuizGate ||
            cell.type === BlockType.DescentShaft ||
            cell.type === BlockType.ExitLadder
          ) {
            this.overlayGraphics.fillStyle(this.getBiomeAccentTint(), 0.12)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          }
          // Hazard idle animations: subtle pulsing overlay on revealed hazard blocks
          if (cell.type === BlockType.LavaBlock) {
            const pulse = 0.15 + 0.10 * Math.sin(this.time.now / 500)
            this.overlayGraphics.fillStyle(0xff6600, pulse)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          } else if (cell.type === BlockType.GasPocket) {
            const pulse = 0.10 + 0.06 * Math.sin(this.time.now / 700)
            this.overlayGraphics.fillStyle(0x33ff33, pulse)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          } else if (cell.type === BlockType.UnstableGround) {
            const pulse = 0.05 + 0.03 * Math.sin(this.time.now / 1200)
            this.overlayGraphics.fillStyle(0x8b7355, pulse)
            this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          }
        }

        if (cell.maxHardness > 0 && cell.hardness > 0 && cell.hardness < cell.maxHardness) {
          this.drawCrackOverlay(cell, x, y, px, py)
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

    // Biome glow pass: emitting blocks bleed color into adjacent unexplored fog
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const cell = this.grid[y][x]
        if (!cell.revealed && (cell.visibilityLevel ?? 0) < 1) continue

        let glowColor: number | null = null
        if (cell.type === BlockType.LavaBlock) {
          glowColor = 0xff6600
        } else if (cell.type === BlockType.MineralNode) {
          const tier = cell.content?.mineralType
          if (tier === 'crystal') glowColor = 0x44aaff
          else if (tier === 'essence') glowColor = 0x9944cc
        }
        if (glowColor === null) continue

        // Bleed glow into cardinal neighbors that are in full fog
        const neighbors = [
          { nx: x, ny: y - 1 },
          { nx: x, ny: y + 1 },
          { nx: x - 1, ny: y },
          { nx: x + 1, ny: y },
        ]
        for (const { nx, ny } of neighbors) {
          if (ny < 0 || ny >= this.gridHeight || nx < 0 || nx >= this.gridWidth) continue
          const neighbor = this.grid[ny][nx]
          // Only glow into fully dark unrevealed tiles
          if (neighbor.revealed || (neighbor.visibilityLevel ?? 0) >= 1) continue
          const npx = nx * TILE_SIZE
          const npy = ny * TILE_SIZE
          this.overlayGraphics.fillStyle(glowColor, 0.10)
          this.overlayGraphics.fillRect(npx, npy, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  private drawPlayer(): void {
    const targetX = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
    const targetY = this.player.gridY * TILE_SIZE + TILE_SIZE   // bottom of target tile

    // Lerp visual position toward logical position for smooth movement
    this.playerVisualX += (targetX - this.playerVisualX) * this.MOVE_LERP
    this.playerVisualY += (targetY - this.playerVisualY) * this.MOVE_LERP

    // Snap if within 1px to avoid floating-point drift
    if (Math.abs(this.playerVisualX - targetX) < 1) this.playerVisualX = targetX
    if (Math.abs(this.playerVisualY - targetY) < 1) this.playerVisualY = targetY

    this.playerSprite.setPosition(this.playerVisualX, this.playerVisualY)

    // If visual position has snapped to logical position (movement is done), return to idle
    const atTarget = this.playerVisualX === targetX && this.playerVisualY === targetY
    if (atTarget && !this.animController?.isPlayingMineAnim) {
      this.animController?.setIdle()
    }
  }

  private spawnBreakParticles(px: number, py: number, blockType: BlockType): void {
    this.particles.emitBreak(blockType, px + TILE_SIZE * 0.5, py + TILE_SIZE * 0.5)
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
    if (!camera) return  // guard: camera not ready (scene transition)
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

    // Buffer input if mine animation is playing (rhythm mining support)
    if (this.animController?.isPlayingMineAnim) {
      this.bufferedInput = { x: finalX, y: finalY }
      return
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
      case 'f':
      case 'F':
        this.applyConsumable('flare')
        return
      case 'Escape':
        document.dispatchEvent(new CustomEvent('game:back-pressed'))
        return
      case '1': case '2': case '3': case '4':
        document.dispatchEvent(new CustomEvent('quiz:keyboard-answer', { detail: { choice: parseInt(event.key) - 1 } }))
        return
      case ' ':
        // Space = interact (no-op for now, reserved for future use)
        return
      default:
        return
    }

    const targetX = this.player.gridX + dx
    const targetY = this.player.gridY + dy

    if (targetX < 0 || targetY < 0 || targetX >= this.gridWidth || targetY >= this.gridHeight) {
      return
    }

    // Buffer input if mine animation is playing (rhythm mining support)
    if (this.animController?.isPlayingMineAnim) {
      this.bufferedInput = { x: targetX, y: targetY }
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

    // Track facing direction for Drill Charge
    const dx = targetX - playerX
    const dy = targetY - playerY
    if (dx > 0) this.playerFacing = 'right'
    else if (dx < 0) this.playerFacing = 'left'
    else if (dy > 0) this.playerFacing = 'down'
    else if (dy < 0) this.playerFacing = 'up'

    if (targetCell.type === BlockType.Empty || targetCell.type === BlockType.ExitLadder) {
      const isExitLadder = targetCell.type === BlockType.ExitLadder
      const moved = this.player.moveToEmpty(targetX, targetY, this.grid)
      if (!moved) {
        return
      }

      // Trigger walk animation
      this.animController.setWalk(targetX - playerX, targetY - playerY)
      this.time.delayedCall(200, () => {
        if (!this.animController.isPlayingMineAnim) {
          this.animController.setIdle()
        }
      })

      revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
      if (this.activeUpgrades.has('scanner_boost')) {
        this.revealSpecialBlocks()
      }
      // Update fog glow after block reveals
      if (this.glowSystem) {
        this.glowSystem.update(this.grid)
      }

      // Phase 35.3: Check adjacent cells for offering altar after each move
      {
        const newX = this.player.gridX
        const newY = this.player.gridY
        for (const [adx, ady] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
          const ax = newX + adx, ay = newY + ady
          if (ax >= 0 && ax < this.gridWidth && ay >= 0 && ay < this.gridHeight) {
            const aCell = this.grid[ay][ax]
            if (aCell?.type === BlockType.OfferingAltar && !aCell.altarUsed) {
              this.game.events.emit('altar-adjacent', { x: ax, y: ay })
              break
            }
          }
        }
      }

      // Advance tick on every successful player move
      const tsMove = TickSystem.getInstance()
      tsMove.advance()
      tickCount.set(tsMove.getTick())
      layerTickCount.set(tsMove.getLayerTick())

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
      // Apply depth multiplier: O2 costs scale linearly with layer (DD-V2-061)
      const depthMult = getO2DepthMultiplier(this.currentLayer)
      oxygenCost = Math.ceil(oxygenCost * depthMult)
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

    // LockedBlock guard (Phase 35.6): check if player can break this block
    if (blockType === BlockType.LockedBlock && targetCell.requiredTier !== undefined) {
      const hasPickaxe = this.pickaxeTierIndex >= targetCell.requiredTier
      const consumableSlots = get(activeConsumables)
      const hasDrill = consumableSlots.some(s => s.id === 'drill_charge' && s.count > 0)
      const hasBomb = consumableSlots.some(s => s.id === 'bomb' && s.count > 0)
      if (!hasPickaxe && !hasDrill && !hasBomb) {
        // Only show the GAIA denial message once per unique block position per layer
        const blockKey = `${targetX},${targetY}`
        if (!this.lockedBlockDeniedSet.has(blockKey)) {
          this.lockedBlockDeniedSet.add(blockKey)
          this.game.events.emit('locked-block-denied', { x: targetX, y: targetY, requiredTier: targetCell.requiredTier })
        }
        return  // No O2 cost, no block damage
      }
    }

    // OfferingAltar guard (Phase 35.3): can't be mined — tap does nothing
    if (blockType === BlockType.OfferingAltar) {
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
      this.gearOverlay?.flashCompanionBadge()   // Phase 29: flash badge on companion trigger
      this.game.events.emit('companion-triggered', { effect: 'instant_break' })
    }

    // Pickaxe tier damage: apply tier-based extra damage before mining
    // Tier 0 (Stone Pick) does 1 damage (default mineBlock), higher tiers do bonus damage
    const tierDamage = BALANCE.PICKAXE_TIERS[this.pickaxeTierIndex].damage
    if (tierDamage > 1 && targetCell.hardness > 1) {
      targetCell.hardness = Math.max(1, targetCell.hardness - (tierDamage - 1))
    }

    // Track per-block hit count for impact escalation
    const hitCount = this.player.recordHit(targetX, targetY)
    const targetCellBefore = this.grid[targetY][targetX]
    const isFinalHit = targetCellBefore.hardness === 1

    // Trigger mine animation with input buffering support
    const mineDx = targetX - playerX
    const mineDy = targetY - playerY
    this.animController.setMine(mineDx, mineDy, () => {
      this.animController.setIdle()
      // Process buffered input for rhythm mining
      if (this.bufferedInput) {
        const buf = this.bufferedInput
        this.bufferedInput = null
        this.handleMoveOrMine(buf.x, buf.y)
      }
    })

    const mineResult = mineBlock(this.grid, targetX, targetY)
    if (mineResult.destroyed) {
      invalidateNeighborVariants(this.grid, targetX, targetY, this.currentBiome.id)
    }
    if (mineResult.success) {
      const blockWorldX = targetX * TILE_SIZE + TILE_SIZE * 0.5
      const blockWorldY = targetY * TILE_SIZE + TILE_SIZE * 0.5

      // Trigger impact feedback (shake, flash, haptic)
      this.impactSystem.triggerHit(
        blockType,
        hitCount,
        isFinalHit,
        blockWorldX,
        blockWorldY,
        targetX,
        targetY,
        this.pickaxeTierIndex,
        this.flashTiles
      )

      this.blocksMinedThisRun += 1
      this.blocksSinceLastQuake += 1
      this.game.events.emit('blocks-mined-update', this.blocksMinedThisRun)

      // Phase 36: Creature spawn check after each block mined
      if (mineResult.destroyed) {
        const spawnedCreature = this.creatureSpawner.checkSpawn(
          this.currentLayer,
          (this.currentBiome?.id as import('../../data/biomes').BiomeId) ?? null
        )
        if (spawnedCreature) {
          this.game.events.emit('creature-encounter', spawnedCreature)
        }
      }

      // Advance tick on every successful block hit
      const tsMine = TickSystem.getInstance()
      tsMine.advance()
      tickCount.set(tsMine.getTick())
      layerTickCount.set(tsMine.getLayerTick())
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
        // Sound feedback for non-destroying hits (impact system handles flash)
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

      // Clear hit count when block is destroyed
      if (mineResult.destroyed) {
        this.player.clearHitCount(targetX, targetY)
      }
    }

    if (mineResult.destroyed) {
      this.spawnBreakParticles(targetX * TILE_SIZE, targetY * TILE_SIZE, blockType)
      audioManager.playSound('mine_break')

      // Consumable drop chance (DD-V2-064)
      if (Math.random() < CONSUMABLE_DROP_CHANCE) {
        const dropped = ALL_CONSUMABLE_IDS[Math.floor(Math.random() * ALL_CONSUMABLE_IDS.length)]
        const added = addConsumableToDive(dropped)
        if (added) {
          this.game.events.emit('gaia-toast', `Found: ${CONSUMABLE_DEFS[dropped].label}`)
        }
      }

      // Random quiz: only on plain terrain blocks, not when already paused.
      // The adaptive rate check (cooldown, fatigue, first-trigger-after-N) is
      // delegated to QuizManager via the game registry. (DD-V2-060)
      const randomQuizEligibleTypes = new Set<BlockType>([
        BlockType.Dirt,
        BlockType.SoftRock,
        BlockType.Stone,
        BlockType.HardRock,
        BlockType.LavaBlock,
        BlockType.GasPocket,
      ])
      const adaptiveQuizCheck = this.game.registry.get('shouldTriggerRandomQuiz') as (() => boolean) | undefined
      const shouldTriggerQuiz = adaptiveQuizCheck
        ? adaptiveQuizCheck()
        : (this.blocksMinedThisRun >= BALANCE.RANDOM_QUIZ_MIN_BLOCKS && Math.random() < BALANCE.RANDOM_QUIZ_CHANCE)
      if (
        randomQuizEligibleTypes.has(blockType) &&
        !this.isPaused &&
        shouldTriggerQuiz
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
            this.gearOverlay?.flashCompanionBadge()   // Phase 29: flash badge on companion trigger
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
          // Pop loot toward player with physics arc
          this.lootPop.popLoot({
            spriteKey: `block_mineral_${mineResult.content?.mineralType ?? 'dust'}`,
            worldX: targetX * TILE_SIZE + TILE_SIZE * 0.5,
            worldY: targetY * TILE_SIZE + TILE_SIZE * 0.5,
            targetX: this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5,
            targetY: this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5,
          })
          // mineral_magnet: auto-collect minerals within radius
          this.applyMineralMagnet(targetX, targetY)
          break
        }
        case BlockType.ArtifactNode: {
          // Phase 31.3: Remove shimmer when ArtifactNode is broken
          this.blockShimmer?.unregisterNode(targetX, targetY)
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
            // Phase 31.2: trigger camera zoom + GAIA commentary before collecting
            const revealRarity = (mineResult.content?.artifactRarity ?? 'common') as Rarity
            this.triggerArtifactRevealSequence(
              artifactSlot,
              targetX * TILE_SIZE + TILE_SIZE * 0.5,
              targetY * TILE_SIZE + TILE_SIZE * 0.5,
              revealRarity,
              targetX,
              targetY,
            )
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
            // Phase 29: Update relic glow overlay when a new relic is collected
            if (this.gearOverlay) {
              // Show glow when any relic is equipped (tier info not on Relic type)
              this.gearOverlay.setRelicGlow('common')
            }
          }
          break
        }
        case BlockType.DescentShaft: {
          // Phase 36: Boss gate check — block descent at landmark layers until boss is defeated
          const bossTemplateId = BOSS_LAYER_MAP[this.currentLayer]
          if (bossTemplateId !== undefined) {
            const save = get(playerSave)
            const defeatedThisRun: string[] = save?.defeatedBossesThisRun ?? []
            if (!defeatedThisRun.includes(bossTemplateId)) {
              const boss = createBoss(bossTemplateId, this.currentLayer + 1)
              if (boss) {
                this.game.events.emit('boss-encounter', boss)
                return  // Halt descent until boss is defeated
              }
            }
          }
          // Phase 36: The Deep unlock check at layer index 19
          if (this.currentLayer === 19 && encounterManager.isTheDeepUnlocked()) {
            this.game.events.emit('the-deep-unlocked')
            return
          }
          // Phase 29: Start fall animation before descent
          this.animController?.startFall()
          // Phase 31.5: Animate descent before showing the layer entrance quiz.
          this.isPaused = true
          this.triggerDescentAnimation(() => {
            // After animation completes, emit the layer-entrance-quiz event.
            this.game.events.emit('layer-entrance-quiz', { layer: this.currentLayer })
          })
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
            BlockType.Chest,
            BlockType.Tablet,
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
          // Phase 35.4: Cave-in contributes to instability
          this.instabilitySystem?.addInstability('cave_in')
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
        case BlockType.Chest: {
          // Treasure chest opened — award bonus minerals based on current layer. (DD-V2-055)
          this.game.events.emit('chest-opened', { layer: this.currentLayer })
          audioManager.playSound('collect')
          break
        }
        case BlockType.Tablet: {
          // Stone tablet found — trigger a discovery quiz. (DD-V2-055)
          this.isPaused = true
          this.game.events.emit('random-quiz')
          break
        }
        case BlockType.RecipeFragmentNode: {
          // Phase 35.5: Recipe fragment node — collect and notify GameManager
          const fragId = targetCell.fragmentId
          if (fragId) {
            this.game.events.emit('fragment-collected', { fragmentId: fragId })
          }
          audioManager.playSound('collect')
          break
        }
        default:
          break
      }

      // ---- Phase 35.4: Instability triggers based on what was mined ----
      if (this.instabilitySystem) {
        // Lava adjacent trigger: was this block next to any lava?
        let adjacentToLava = false
        for (const [adx, ady] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
          const anx = targetX + adx, any = targetY + ady
          if (any >= 0 && any < this.gridHeight && anx >= 0 && anx < this.gridWidth) {
            if (this.grid[any][anx]?.type === BlockType.LavaBlock) {
              adjacentToLava = true
              break
            }
          }
        }
        if (adjacentToLava) {
          this.instabilitySystem.addInstability('lava_adjacent')
        }
        // UnstableGround trigger
        if (blockType === BlockType.UnstableGround) {
          this.instabilitySystem.addInstability('unstable_broke')
        }
        // HardRock in extreme layer tier (layer index 15+ = layers 16-20)
        if (blockType === BlockType.HardRock && this.currentLayer >= 15) {
          this.instabilitySystem.addInstability('hard_rock_deep')
        }
      }

      // Check adjacent cells for lava blocks — if a lava block is now exposed, spawn a flow. (Phase 8.3)
      if (this.hazardSystem) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
          const nx = targetX + dx, ny = targetY + dy
          if (ny >= 0 && ny < this.gridHeight && nx >= 0 && nx < this.gridWidth) {
            if (this.grid[ny][nx]?.type === BlockType.LavaBlock) {
              this.hazardSystem.spawnLava(nx, ny)
            }
          }
        }
      }

      // Spawn a gas cloud when a GasPocket block is broken. (Phase 8.3)
      if (blockType === BlockType.GasPocket && this.hazardSystem) {
        this.hazardSystem.spawnGas(targetX, targetY)
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
   * Point-of-no-return check removed (Phase 8.2 — PONR mechanic retired).
   * Stub retained to avoid touching call sites; becomes a no-op.
   */
  private checkPointOfNoReturn(): void {
    // no-op: PONR mechanic removed in Phase 8.2
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
   * Phase 31.2: Choreographed artifact reveal sequence.
   * Zooms camera into the artifact tile, emits a GAIA reveal line, then
   * collects the artifact and emits the artifact-found event.
   *
   * Replaces the direct artifact collection for non-quiz artifact breaks.
   */
  private triggerArtifactRevealSequence(
    artifactSlot: InventorySlot,
    tileWorldX: number,
    tileWorldY: number,
    rarity: Rarity,
    tileGridX: number,
    tileGridY: number,
  ): void {
    if (!this.cameraSequencer) {
      // Fallback: collect directly without camera sequence
      const added = this.addToInventory(artifactSlot)
      if (artifactSlot.factId) {
        this.artifactsFound.push(artifactSlot.factId)
      }
      this.game.events.emit('artifact-found', {
        factId: artifactSlot.factId,
        rarity: artifactSlot.artifactRarity,
        addedToInventory: added,
      })
      audioManager.playSound('collect')
      this.lootPop.popLoot({
        spriteKey: 'block_artifact',
        worldX: tileWorldX,
        worldY: tileWorldY,
        targetX: this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5,
        targetY: this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5,
        rarity: artifactSlot.artifactRarity,
      })
      return
    }

    // Pause input during the sequence
    this.isPaused = true

    // Fire particle reveal at the tile immediately
    this.particles.emitArtifactReveal(rarity, tileWorldX, tileWorldY)

    const timing = REVEAL_TIMING[rarity] ?? REVEAL_TIMING['common']

    // Zoom into the artifact tile
    this.cameraSequencer.zoomToPoint({
      worldX: tileWorldX,
      worldY: tileWorldY,
      targetZoomMultiplier: 2.0,
      zoomInMs: 350,
      holdMs: timing.anticipationMs,
      zoomOutMs: 250,
      onHoldStart: () => {
        // Emit GAIA line during the hold phase
        const gaiaManager = GameManager.getInstance().getGaiaManager()
        const line = gaiaManager.getArtifactRevealLine(rarity)
        this.game.events.emit('gaia-toast', line)
      },
      onComplete: () => {
        // Re-enable input and collect the artifact
        this.isPaused = false
        this.cameraSequencer?.updateBaseZoom()

        const added = this.addToInventory(artifactSlot)
        if (artifactSlot.factId) {
          this.artifactsFound.push(artifactSlot.factId)
        }
        this.game.events.emit('artifact-found', {
          factId: artifactSlot.factId,
          rarity: artifactSlot.artifactRarity,
          addedToInventory: added,
        })
        audioManager.playSound('collect')
        this.lootPop.popLoot({
          spriteKey: 'block_artifact',
          worldX: tileWorldX,
          worldY: tileWorldY,
          targetX: this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5,
          targetY: this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5,
          rarity: artifactSlot.artifactRarity,
        })
      },
    })
  }

  /**
   * Phase 31.5: Plays the descent animation (camera pan-down + zoom + fade to black)
   * when the player steps on a DescentShaft. Calls `onComplete` after the pan and fade.
   *
   * @param onComplete - Callback invoked after the animation completes
   */
  private triggerDescentAnimation(onComplete: () => void): void {
    const cam = this.cameras.main

    // Emit descent overlay event so Svelte DescentOverlay component can animate
    this.game.events.emit('descent-animation-start', {
      fromLayer: this.currentLayer + 1,  // 1-based layer leaving
      toLayer: this.currentLayer + 2,    // 1-based layer entering
      biomeName: null,                   // biome name determined by GameManager on next scene start
    })

    // Pan camera down slightly while zooming in
    const panOffsetY = TILE_SIZE * 3
    this.tweens.add({
      targets: cam,
      scrollY: cam.scrollY + panOffsetY,
      zoom: cam.zoom * DESCENT_ANIM.zoomDuringDescent,
      duration: DESCENT_ANIM.panDurationMs,
      ease: 'Cubic.In',
      onComplete: () => {
        // Fade to black
        cam.fadeOut(DESCENT_ANIM.fadeDurationMs, 0, 0, 0)
        cam.once('camerafadeoutcomplete', () => {
          // Clear shimmer nodes before layer transition
          this.blockShimmer?.clear()
          onComplete()
        })
      },
    })
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
  public resumeFromRandomQuiz(correct: boolean, streakMultiplier = 1.0): void {
    this.isPaused = false
    if (correct) {
      // quiz_master relic: bonus dust on correct answer
      const quizMasterRelic = this.collectedRelics.find(r => r.effect.type === 'quiz_master')
      const bonusDust = (quizMasterRelic && quizMasterRelic.effect.type === 'quiz_master')
        ? quizMasterRelic.effect.bonus
        : 0
      const totalDust = Math.round((BALANCE.RANDOM_QUIZ_REWARD_DUST + bonusDust) * streakMultiplier)
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
  /**
   * Returns the current mine grid (read-only reference for save state serialisation).
   * Used by GameManager.buildDiveSaveState(). (DD-V2-053)
   */
  public getGrid(): MineCell[][] {
    return this.grid
  }

  /**
   * Returns the player's current grid position.
   * Used by GameManager.buildDiveSaveState(). (DD-V2-053)
   */
  public getPlayerGridPos(): { x: number; y: number } {
    return { x: this.player.gridX, y: this.player.gridY }
  }

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
        // Phase 29: Update gear overlay when pickaxe tier changes
        this.gearOverlay?.setPickaxeTier(this.pickaxeTierIndex)
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

  /**
   * Called by HazardSystem when the player occupies a lava cell.
   * Emits a game event so GameManager can drain O2 and trigger GAIA commentary. (Phase 8.3)
   */
  private handleLavaContact(): void {
    this.animController?.setHurt()    // Phase 29: trigger hurt flash animation
    this.game.events.emit('hazard-lava-contact')
  }

  /**
   * Called by HazardSystem when the player occupies a gas cloud cell.
   * Emits a game event so GameManager can drain O2 per tick. (Phase 8.3)
   */
  private handleGasContact(): void {
    this.animController?.setHurt()    // Phase 29: trigger hurt flash animation
    this.game.events.emit('hazard-gas-contact')
  }

  /**
   * Called by HazardSystem when lava spreads into a new empty cell.
   * Updates the grid to reflect the new lava block and redraws the tile. (Phase 8.3)
   *
   * @param x - Grid column of the newly lava-filled cell.
   * @param y - Grid row of the newly lava-filled cell.
   */
  private markCellAsLava(x: number, y: number): void {
    if (this.grid[y]?.[x]) {
      this.grid[y][x] = {
        type: BlockType.LavaBlock,
        hardness: 0,
        maxHardness: 0,
        revealed: true,
      }
    }
  }

  /**
   * Apply a consumable tool effect. (DD-V2-064)
   */
  public applyConsumable(id: ConsumableId): void {
    const used = useConsumableFromDive(id)
    if (!used) return

    switch (id) {
      case 'bomb':
        this.applyBomb()
        break
      case 'flare':
        this.applyFlare()
        break
      case 'shield_charge':
        shieldActive.set(true)
        this.game.events.emit('gaia-toast', 'Shield active — next hazard blocked.')
        break
      case 'drill_charge':
        this.applyDrillCharge()
        break
      case 'sonar_pulse':
        this.applySonarPulse()
        break
    }
  }

  /** Bomb: clear 3x3 area around player */
  private applyBomb(): void {
    const cx = this.player.gridX
    const cy = this.player.gridY
    let cleared = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= this.grid[0].length || ny >= this.grid.length) continue
        const cell = this.grid[ny][nx]
        if (cell.type !== BlockType.Empty && cell.type !== BlockType.Unbreakable &&
            cell.type !== BlockType.ExitLadder && cell.type !== BlockType.DescentShaft) {
          this.grid[ny][nx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
          cleared++
        }
      }
    }
    revealAround(this.grid, cx, cy, BALANCE.FOG_REVEAL_RADIUS)
    TickSystem.getInstance().advance()
    tickCount.set(TickSystem.getInstance().getTick())
    layerTickCount.set(TickSystem.getInstance().getLayerTick())
    this.redrawAll()
    this.game.events.emit('gaia-toast', `Bomb detonated — ${cleared} blocks cleared.`)
  }

  /** Flare: reveal 7x7 area */
  private applyFlare(): void {
    const cx = this.player.gridX
    const cy = this.player.gridY
    const width = this.grid[0].length
    const height = this.grid.length
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          this.grid[ny][nx].revealed = true
        }
      }
    }
    TickSystem.getInstance().advance()
    tickCount.set(TickSystem.getInstance().getTick())
    layerTickCount.set(TickSystem.getInstance().getLayerTick())
    this.redrawAll()
    this.game.events.emit('gaia-toast', 'Flare deployed — 7×7 area revealed.')
  }

  /** Drill Charge: mine 5 blocks in facing direction */
  private applyDrillCharge(): void {
    const dirMap: Record<string, [number, number]> = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    }
    const [ddx, ddy] = dirMap[this.playerFacing]
    let mined = 0
    let cx = this.player.gridX
    let cy = this.player.gridY
    const width = this.grid[0].length
    const height = this.grid.length
    while (mined < 5) {
      cx += ddx
      cy += ddy
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) break
      const cell = this.grid[cy][cx]
      if (cell.type === BlockType.Unbreakable) break
      if (cell.type !== BlockType.Empty) {
        this.grid[cy][cx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
        mined++
      }
    }
    revealAround(this.grid, this.player.gridX, this.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
    TickSystem.getInstance().advance()
    tickCount.set(TickSystem.getInstance().getTick())
    layerTickCount.set(TickSystem.getInstance().getLayerTick())
    this.redrawAll()
    this.game.events.emit('gaia-toast', `Drill Charge — ${mined} blocks bored through.`)
  }

  /** Sonar Pulse: highlight minerals within 10 Manhattan distance */
  private applySonarPulse(): void {
    const cx = this.player.gridX
    const cy = this.player.gridY
    const width = this.grid[0].length
    const height = this.grid.length
    let revealed = 0
    for (let dy = -10; dy <= 10; dy++) {
      for (let dx = -10; dx <= 10; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 10) continue
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const cell = this.grid[ny][nx]
        if (cell.type === BlockType.MineralNode || cell.type === BlockType.ArtifactNode ||
            cell.type === BlockType.FossilNode) {
          cell.revealed = true
          revealed++
        }
      }
    }
    TickSystem.getInstance().advance()
    tickCount.set(TickSystem.getInstance().getTick())
    layerTickCount.set(TickSystem.getInstance().getLayerTick())
    this.redrawAll()
    this.game.events.emit('gaia-toast', `Sonar Pulse — ${revealed} nodes detected.`)
  }

  /**
   * Called after mine generation to handle landmark-specific entry effects. (DD-V2-055)
   * Emits GAIA toast messages and activates hazards present in the landmark template.
   */
  private handleLandmarkEntry(): void {
    const oneIndexedLayer = this.currentLayer + 1
    const landmarkId = getLandmarkIdForLayer(oneIndexedLayer)
    if (!landmarkId) return

    switch (landmarkId) {
      case 'gauntlet':
        this.game.events.emit('gaia-toast', 'GAUNTLET — Multiple active hazards detected. Survive.')
        // Activate all lava and gas cells in the stamped grid
        for (let y = 0; y < this.grid.length; y++) {
          for (let x = 0; x < this.grid[0].length; x++) {
            if (this.grid[y][x].type === BlockType.LavaBlock) {
              this.hazardSystem?.spawnLava(x, y)
            }
            if (this.grid[y][x].type === BlockType.GasPocket) {
              this.hazardSystem?.spawnGas(x, y)
            }
          }
        }
        break
      case 'treasure_vault':
        this.game.events.emit('gaia-toast', 'Treasure Vault — Elevated mineral density detected. A chest lies within.')
        break
      case 'ancient_archive':
        this.game.events.emit('gaia-toast', 'Ancient Archive — Stone tablets detected. Approach to learn.')
        break
      case 'completion_event': {
        const event = COMPLETION_EVENTS[Math.floor(Math.random() * COMPLETION_EVENTS.length)]
        this.game.events.emit('gaia-toast', `DEPTH RECORD — ${event.title}`)
        // Show monologue after a delay
        setTimeout(() => {
          this.game.events.emit('gaia-toast', event.gaiaMonologue)
        }, 3000)
        break
      }
    }
  }

  /**
   * Registers per-frame animation listeners that emit 'mineSwingFrame' at peak impact.
   * Called once from create() after animController.registerAnims().
   * The 'mineSwingFrame' event signals particle emitters and screen shake to trigger.
   *
   * Design (DD-V2-249): damage is applied on input; this event is for visual feedback only.
   */
  private setupMineSwingFrameEvent(): void {
    // Frame 3 of the mine strip is the "impact moment" (pickaxe fully extended)
    const SWING_FRAME_INDEX_IN_STRIP = 3

    this.playerSprite.on(
      Phaser.Animations.Events.ANIMATION_UPDATE,
      (
        _anim: Phaser.Animations.Animation,
        frame: Phaser.Animations.AnimationFrame,
        _sprite: Phaser.GameObjects.Sprite
      ) => {
        // Check if this is a mine animation (starts at frame 28, 34, or 40)
        const globalFrame = frame.index  // 0-based global index in the sheet
        const mineDownSwingFrame  = 28 + SWING_FRAME_INDEX_IN_STRIP   // = 31
        const mineLeftSwingFrame  = 34 + SWING_FRAME_INDEX_IN_STRIP   // = 37
        const mineRightSwingFrame = 40 + SWING_FRAME_INDEX_IN_STRIP   // = 43

        if (
          globalFrame === mineDownSwingFrame ||
          globalFrame === mineLeftSwingFrame ||
          globalFrame === mineRightSwingFrame
        ) {
          this.game.events.emit('mineSwingFrame', {
            playerX: this.player.gridX,
            playerY: this.player.gridY,
            facing: this.playerFacing,
            state: this.animController?.state,
          })
        }
      }
    )

    // Listen for the mineSwingFrame event to emit swing dust particles
    this.game.events.on('mineSwingFrame', (data: {
      playerX: number, playerY: number, facing: string, state: string
    }) => {
      // Emit a small dust burst at the face of the block being swung at
      const blockX = data.playerX + (data.facing === 'left' ? -1 : data.facing === 'right' ? 1 : 0)
      const blockY = data.playerY + (data.facing === 'down' ? 1 : data.facing === 'up' ? -1 : 0)
      const worldPx = blockX * TILE_SIZE + TILE_SIZE * 0.5
      const worldPy = blockY * TILE_SIZE + TILE_SIZE * 0.5
      this.particles?.emitSwingDust(worldPx, worldPy, data.facing as 'left' | 'right' | 'up' | 'down')
    })
  }

  // =========================================================
  // Phase 35: Public methods for GameManager integration
  // =========================================================

  /**
   * Mark an offering altar as used after the player completes a sacrifice.
   * Prevents the altar from triggering again this layer. (Phase 35.3)
   */
  public markAltarUsed(x: number, y: number): void {
    if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
      const cell = this.grid[y][x]
      if (cell) {
        this.grid[y][x] = { ...cell, altarUsed: true }
      }
    }
  }

  /**
   * Add instability from an external trigger (e.g. altar tier 4 sacrifice).
   * Delegates to the InstabilitySystem instance. (Phase 35.4)
   */
  public addInstability(trigger: import('../systems/InstabilitySystem').InstabilityTrigger): void {
    this.instabilitySystem?.addInstability(trigger)
  }

  /**
   * Trigger a small earthquake event (used by mine event system for tremor).
   * Reveals fewer blocks than a full earthquake. (Phase 35.7)
   */
  public triggerSmallEarthquake(): void {
    // Trigger a standard earthquake — the event system already keeps these infrequent
    this.triggerEarthquake()
  }

  /**
   * Spawn a gas cloud at a random position in the lower half of the grid.
   * Used by the mine event system for gas_leak events. (Phase 35.7)
   */
  public spawnRandomGasLeak(): void {
    if (!this.hazardSystem) return
    const rx = Math.floor(Math.random() * this.gridWidth)
    const ry = Math.floor(this.gridHeight * 0.5 + Math.random() * this.gridHeight * 0.5)
    const clampedY = Math.min(ry, this.gridHeight - 1)
    this.hazardSystem.spawnGas(rx, clampedY)
  }

  /**
   * Temporarily reveal all RelicShrine cells for the given duration (ms).
   * Used by the mine event system for relic_signal events. (Phase 35.7)
   */
  public revealRelicShrines(durationMs: number): void {
    const revealed: Array<{ y: number; x: number }> = []
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x]
        if (cell?.type === BlockType.RelicShrine && !cell.revealed) {
          this.grid[y][x] = { ...cell, revealed: true }
          revealed.push({ y, x })
        }
      }
    }
    if (revealed.length > 0) {
      this.redrawAll()
      // Re-hide after duration
      setTimeout(() => {
        for (const { y, x } of revealed) {
          const cell = this.grid[y]?.[x]
          if (cell?.type === BlockType.RelicShrine) {
            this.grid[y][x] = { ...cell, revealed: false }
          }
        }
        this.redrawAll()
      }, durationMs)
    }
  }

  /**
   * Temporarily reveal MineralNode cells within radius tiles of the player.
   * Used by the mine event system for crystal_vein events. (Phase 35.7)
   */
  public revealNearbyMinerals(radius: number): void {
    const px = this.player.gridX
    const py = this.player.gridY
    const revealed: Array<{ y: number; x: number }> = []
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = px + dx, ny = py + dy
        if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) continue
        const cell = this.grid[ny][nx]
        if (cell?.type === BlockType.MineralNode && !cell.revealed) {
          this.grid[ny][nx] = { ...cell, revealed: true }
          revealed.push({ y: ny, x: nx })
        }
      }
    }
    if (revealed.length > 0) {
      this.redrawAll()
    }
  }

  /**
   * Trigger the instability collapse event: fills random cells with HardRock
   * and spawns lava near the center. Called by InstabilitySystem on full collapse. (Phase 35.4)
   */
  private triggerInstabilityCollapse(): void {
    const count = BALANCE.INSTABILITY_COLLAPSE_BLOCK_COUNT
    let placed = 0
    const minY = Math.floor(this.gridHeight * 0.4)
    for (let attempts = 0; attempts < count * 4 && placed < count; attempts++) {
      const rx = Math.floor(Math.random() * this.gridWidth)
      const ry = Math.floor(minY + Math.random() * (this.gridHeight - minY))
      const cell = this.grid[ry]?.[rx]
      if (!cell) continue
      if (cell.type === BlockType.Empty && cell.revealed && !this.isPlayerAt(rx, ry)) {
        this.grid[ry][rx] = { type: BlockType.HardRock, hardness: BALANCE.HARDNESS_HARD_ROCK, maxHardness: BALANCE.HARDNESS_HARD_ROCK, revealed: true }
        placed++
      }
    }
    // Spawn lava near grid center
    if (this.hazardSystem) {
      const cx = Math.floor(this.gridWidth / 2)
      const cy = Math.floor(this.gridHeight * 0.6)
      this.hazardSystem.spawnLava(cx, cy)
    }
    this.redrawAll()
    gaiaMessage.set("The layer is collapsing! Find the shaft — NOW.")
    this.game.events.emit('earthquake', { collapsed: placed, revealed: 0 })
  }

  /** Returns true if the player is at grid cell (x, y). */
  private isPlayerAt(x: number, y: number): boolean {
    return this.player.gridX === x && this.player.gridY === y
  }

  /**
   * Force a layer failure (triggered when instability countdown reaches 0).
   * Behaves like oxygen depletion — forced surface with loot loss. (Phase 35.4)
   */
  private forceLayerFail(): void {
    this.game.events.emit('oxygen-depleted')
  }

  /**
   * Scene shutdown — clean up systems that hold references to Phaser objects.
   * Registered via this.events.on('shutdown', ...) in create().
   */
  private handleShutdown(): void {
    this.hazardSystem?.clearAll()
    TickSystem.getInstance().unregister('hazard-system')
    this.lootPop?.destroy()
    this.biomeParticles?.destroyAll()
    this.biomeParticles = null
    this.audioManager?.stopAll()
    this.audioManager = null
    this.glowSystem?.destroy()
    this.glowSystem = null
    this.animatedTileSystem?.reset()
    this.animatedTileSystem = null
    // Phase 29: Tear down gear overlays and mineSwingFrame listener
    this.gearOverlay?.destroy()
    this.gearOverlay = null
    this.game.events.off('mineSwingFrame')
  }
}
