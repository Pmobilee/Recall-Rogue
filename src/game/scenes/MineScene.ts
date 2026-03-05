/** SIZE BUDGET: MineScene orchestrator — 1,506 lines. Target: <800 lines. Extracted: MineTileRenderer (662L), MineInputController (226L), MineBlockInteractor (1,505L). */
import Phaser from 'phaser'
import { get } from 'svelte/store'
import { BALANCE } from '../../data/balance'
import { BlockType, type InventorySlot, type MineCell, type MineralTier, type Rarity, type Relic, type RunUpgrade } from '../../data/types'
import { type Biome, DEFAULT_BIOME } from '../../data/biomes'
import { getActiveSynergies, type SynergyEffect } from '../../data/relics'
import { type CompanionEffect } from '../../data/fossils'
import { Player } from '../entities/Player'
import { mineBlock } from '../systems/MiningSystem'
import { MinerAnimController } from '../systems/AnimationSystem'
import { GearOverlaySystem } from '../systems/GearOverlaySystem'
import { isAutotiledBlock, getAutotileGroup, bitmaskToSpriteKey, computeAllVariants } from '../systems/AutotileSystem'
import { applyDepthBackground } from '../systems/DepthGradientSystem'
import { generateMine, generateTutorialMine, revealAround, seededRandom, type DifficultyProfile } from '../systems/MineGenerator'
import {
  addOxygen,
  consumeOxygen,
  createOxygenState,
  type OxygenState,
} from '../systems/OxygenSystem'
import { audioManager } from '../../services/audioService'
import { setupCamera, PinchZoomController } from '../systems/CameraSystem'
import { CameraSequencer } from '../systems/CameraSequencer'
import { BlockShimmerSystem } from '../systems/BlockShimmerSystem'
import { ParticleSystem } from '../systems/ParticleSystem'
import { tickCount, layerTickCount } from '../../ui/stores/gameState'
import { LootPopSystem } from '../systems/LootPopSystem'
import { ImpactSystem } from '../systems/ImpactSystem'
import { TickSystem } from '../systems/TickSystem'
import { HazardSystem } from '../systems/HazardSystem'
import { InstabilitySystem } from '../systems/InstabilitySystem'
import { MineEventSystem } from '../systems/MineEventSystem'
import { REVEAL_TIMING, DESCENT_ANIM } from '../../data/balance'
import { type ConsumableId } from '../../data/consumables'
import { instabilityLevel, instabilityCollapsing, instabilityCountdown, gaiaMessage } from '../../ui/stores/gameState'
import { BiomeParticleManager } from '../managers/BiomeParticleManager'
import { AudioManager } from '../managers/AudioManager'
import { BiomeGlowSystem } from '../systems/BiomeGlowSystem'
import { AnimatedTileSystem } from '../systems/AnimatedTileSystem'
import { ALL_BIOMES } from '../../data/biomes'
import { getSpriteUrls, getSpriteUrlsForBiome } from '../spriteManifest'
import { getSpriteResolution } from '../../ui/stores/settings'
import { GameManager } from '../GameManager'
import { CreatureSpawner } from '../systems/CreatureSpawner'
import { playerSave } from '../../ui/stores/playerData'
import {
  redrawAll as redrawAllImpl,
  drawDepthOverlay as drawDepthOverlayImpl,
  drawTiles as drawTilesImpl,
  drawPlayer as drawPlayerImpl,
  drawBlockPattern as drawBlockPatternImpl,
  drawCrackOverlay as drawCrackOverlayImpl,
  drawLegacyCracks as drawLegacyCracksImpl,
  getPooledSprite as getPooledSpriteImpl,
  getBiomeAccentTint as getBiomeAccentTintImpl,
  getTransitionEdge as getTransitionEdgeImpl,
  spawnBreakParticles as spawnBreakParticlesImpl,
  BLOCK_COLORS,
} from './MineTileRenderer'
import {
  handlePointerDown as handlePointerDownImpl,
  handleKeyDown as handleKeyDownImpl,
  findPath as findPathImpl,
} from './MineInputController'
import {
  handleMoveOrMine as handleMoveOrMineImpl,
  checkPointOfNoReturn as checkPointOfNoReturnImpl,
  addToInventory as addToInventoryImpl,
  getMaxStackSize as getMaxStackSizeImpl,
  applyMineralMagnet as applyMineralMagnetImpl,
  rollUpgrade as rollUpgradeImpl,
  applyUpgrade as applyUpgradeImpl,
  revealSpecialBlocks as revealSpecialBlocksImpl,
  triggerEarthquake as triggerEarthquakeImpl,
  useBomb as useBombImpl,
  handleLavaContact as handleLavaContactImpl,
  handleGasContact as handleGasContactImpl,
  markCellAsLava as markCellAsLavaImpl,
  applyConsumable as applyConsumableImpl,
  applyBomb as applyBombImpl,
  applyFlare as applyFlareImpl,
  applyDrillCharge as applyDrillChargeImpl,
  applySonarPulse as applySonarPulseImpl,
  handleLandmarkEntry as handleLandmarkEntryImpl,
  triggerInstabilityCollapse as triggerInstabilityCollapseImpl,
  isPlayerAt as isPlayerAtImpl,
  forceLayerFail as forceLayerFailImpl,
} from './MineBlockInteractor'

const TILE_SIZE = BALANCE.TILE_SIZE

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
  /** @internal */ public seed = 0
  /** @internal */ public oxygenTanks: number = BALANCE.STARTING_OXYGEN_TANKS
  /** @internal */ public grid: MineCell[][] = []
  /** @internal */ public player!: Player
  /** @internal */ public oxygenState!: OxygenState
  /** @internal */ public inventory: InventorySlot[] = []
  /** @internal */ public inventorySlots: number = BALANCE.STARTING_INVENTORY_SLOTS
  /** @internal */ public tileGraphics!: Phaser.GameObjects.Graphics
  /** @internal */ public overlayGraphics!: Phaser.GameObjects.Graphics
  /** @internal */ public playerSprite!: Phaser.GameObjects.Sprite
  /** @internal */ public animController!: MinerAnimController
  /** @internal */ public gearOverlay: GearOverlaySystem | null = null
  /** @internal */ public playerVisualX: number = 0
  /** @internal */ public playerVisualY: number = 0
  /** @internal */ public readonly MOVE_LERP = 0.25
  /** @internal */ public particles!: ParticleSystem
  private cameraSequencer: CameraSequencer | null = null
  /** @internal */ public blockShimmer: BlockShimmerSystem | null = null
  private pinchZoom!: PinchZoomController
  /** @internal */ public itemSpritePool: Phaser.GameObjects.Image[] = []
  /** @internal */ public itemSpritePoolIndex = 0
  /** @internal */ public flashTiles = new Map<string, number>()
  /** @internal */ public lootPop!: LootPopSystem
  /** @internal */ public impactSystem!: ImpactSystem
  /** @internal */ public bufferedInput: { x: number; y: number } | null = null
  /** @internal */ public facts: string[] = []
  /** @internal */ public blocksMinedThisRun = 0
  /** @internal */ public artifactsFound: string[] = []
  /** @internal */ public gridWidth = 0
  /** @internal */ public gridHeight = 0
  /** @internal */ public isPaused = false
  /** @internal */ public oxygenWarningPlayed = false
  /** @internal */ public passedPointOfNoReturn = false
  /** @internal */ public pendingOxygenReward = 0
  /** @internal */ public pendingArtifactSlot: InventorySlot | null = null
  /** @internal */ public pendingArtifactQuestions: number = 0
  /** @internal */ public pendingArtifactBoosts: number = 0
  /** @internal */ public activeUpgrades: Map<RunUpgrade, number> = new Map()
  /** @internal Relics collected this run — provides persistent passive bonuses. */
  public collectedRelics: Relic[] = []
  /** @internal Seeded RNG for relic selection (deterministic per seed). */
  public rng: () => number = Math.random
  /** @internal Zero-based layer index for this dive session. */
  public currentLayer = 0
  /** Items secured via send-up station — preserved across layers and never lost on forced surface. */
  public sentUpItems: InventorySlot[] = []
  /** @internal The active biome for this mine layer — controls visual palette and generation weights. */
  public currentBiome: Biome = DEFAULT_BIOME
  /** @internal Number of blocks mined since the last earthquake (for cooldown tracking). */
  public blocksSinceLastQuake: number = 0
  /** @internal Current pickaxe tier index (into BALANCE.PICKAXE_TIERS). 0 = Stone Pick. */
  public pickaxeTierIndex: number = 0
  /** @internal Current scanner tier index (into BALANCE.SCANNER_TIERS). 0 = Basic Scanner. */
  public scannerTierIndex: number = 0
  /** @internal How many temporary backpack expansions have been collected this run (resets each dive). */
  public backpackExpansionCount: number = 0
  /** @internal Active fossil companion effect for this dive. Null if no companion is equipped. */
  public companionEffect: CompanionEffect | null = null
  /** Tracks whether the companion effect triggered on the last mining action (for badge flash). */
  public companionFlash: boolean = false
  /** @internal Active hazard manager — lava flows and gas clouds. Initialized in create(). */
  public hazardSystem: HazardSystem | null = null
  /** @internal Layer instability meter — rises from hazards, collapses at 100%. (Phase 35.4) */
  public instabilitySystem: InstabilitySystem | null = null
  /** @internal Random mine event dispatcher. (Phase 35.7) */
  public mineEventSystem: MineEventSystem | null = null
  /** @internal Tracks which locked blocks have already shown a denial GAIA message this layer (prevent spam). */
  public lockedBlockDeniedSet: Set<string> = new Set()
  /** @internal Tracks the last direction the player moved/mined, used for Drill Charge. */
  public playerFacing: 'up' | 'down' | 'left' | 'right' = 'down'
  /** @internal Phase 9: Per-biome ambient particle manager. */
  public biomeParticles: BiomeParticleManager | null = null
  /** @internal Phase 9: Biome audio crossfading manager. */
  public audioManager: AudioManager | null = null
  /** @internal Phase 9: Fog glow system for luminous blocks. */
  public glowSystem: BiomeGlowSystem | null = null
  /** @internal Phase 9: Animated tile frame cycling system. */
  public animatedTileSystem: AnimatedTileSystem | null = null
  /** @internal Tracks whether LINEAR texture filters have been applied after the first sprite load. */
  public _filtersApplied = false
  /** @internal Phase 33.5: Depth gradient overlay graphics layer (darkens viewport at deeper layers). */
  public depthOverlayGraphics!: Phaser.GameObjects.Graphics
  /** @internal Phase 33.6: Biome ID of the adjacent layer (used for transition tile rendering). */
  public transitionBiomeId: import('../../data/biomes').BiomeId | null = null
  /** @internal Phase 49.2: Optional secondary biome for dual-biome blended layers. */
  public secondaryBiome: Biome | undefined = undefined
  /** @internal Phase 49.7: Optional dynamic difficulty profile. */
  public difficultyProfile: DifficultyProfile | undefined = undefined
  /** @internal Phase 36: Creature spawner — manages random encounter timing and selection. */
  public creatureSpawner = new CreatureSpawner()

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
    const spriteUrls = getSpriteUrlsForBiome(resolution, this.currentBiome?.id ?? null, this.secondaryBiome?.id)
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
      for (const key of Object.keys(getSpriteUrlsForBiome('high', this.currentBiome?.id ?? null))) {
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
    // Immediately snap camera to player spawn so the initial redrawAll() renders the correct area.
    // Without this, the camera retains scroll from the previous layer and the first frame is blank.
    this.cameras.main.centerOn(startPx, startPy - TILE_SIZE * 0.75)
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

    // On layer transitions the camera was faded to black by triggerDescentAnimation().
    // Fade it back in so the new layer is visible. Also apply on layer 0 for a clean intro.
    this.cameras.main.fadeIn(DESCENT_ANIM.fadeInDurationMs, 0, 0, 0)
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

  /** @internal */ public redrawAll(): void { redrawAllImpl(this) }

  /** @internal Camera follow is now handled by Phaser's startFollow(). */
  public updateCameraTarget(): void {
    // No-op — Phaser's built-in camera follow handles position tracking.
    // Kept as a method stub since redrawAll() calls it.
  }

  private drawDepthOverlay(): void { drawDepthOverlayImpl(this) }

  private getTransitionEdge(tileX: number, tileY: number): 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' {
    return getTransitionEdgeImpl(this, tileX, tileY)
  }

  private getBiomeAccentTint(): number { return getBiomeAccentTintImpl(this) }

  private drawBlockPattern(cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
    drawBlockPatternImpl(this, cell, tileX, tileY, px, py)
  }

  private drawCrackOverlay(cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
    drawCrackOverlayImpl(this, cell, tileX, tileY, px, py)
  }

  private drawLegacyCracks(px: number, py: number, tileX: number, tileY: number, damagePercent: number): void {
    drawLegacyCracksImpl(this, px, py, tileX, tileY, damagePercent)
  }

  private getPooledSprite(key: string, x: number, y: number): Phaser.GameObjects.Image {
    return getPooledSpriteImpl(this, key, x, y)
  }

  private drawTiles(): void { drawTilesImpl(this) }

  private drawPlayer(): void { drawPlayerImpl(this) }

  /** @internal */ public spawnBreakParticles(px: number, py: number, blockType: BlockType): void {
    spawnBreakParticlesImpl(this, px, py, blockType)
  }

  private findPath(startX: number, startY: number, endX: number, endY: number): { x: number; y: number }[] | null {
    return findPathImpl(this, startX, startY, endX, endY)
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    handlePointerDownImpl(this, pointer)
  }

  private handleKeyDown(event: KeyboardEvent): void {
    handleKeyDownImpl(this, event)
  }

  /**
   * Core logic for moving into an empty tile or mining an adjacent block.
   * Called by both handlePointerDown and handleKeyDown after the target
   * grid position has been determined.
   *
   * @param targetX - The grid x-coordinate of the target tile.
   * @param targetY - The grid y-coordinate of the target tile.
   */
  /** @internal */ public handleMoveOrMine(targetX: number, targetY: number): void {
    handleMoveOrMineImpl(this, targetX, targetY)
  }


  /**
   * Point-of-no-return check removed (Phase 8.2 — PONR mechanic retired).
   * Stub retained to avoid touching call sites; becomes a no-op.
   */
  /** @internal */ public checkPointOfNoReturn(): void { checkPointOfNoReturnImpl(this) }

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
  /** @internal */ public triggerArtifactRevealSequence(
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
  /** @internal */ public triggerDescentAnimation(onComplete: () => void): void {
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
  private applyMineralMagnet(originX: number, originY: number): void { applyMineralMagnetImpl(this, originX, originY) }

  /**
   * Roll a random upgrade from the full options pool using weighted random selection.
   * Bomb has a lower weight than the other upgrades to keep it feeling special.
   */
  private rollUpgrade(): RunUpgrade { return rollUpgradeImpl(this) }

  /**
   * Apply an upgrade for the current run, recording it in activeUpgrades.
   */
  private applyUpgrade(upgrade: RunUpgrade): void { applyUpgradeImpl(this, upgrade) }

  /**
   * Reveal special blocks within scanner range around the player.
   * Range is determined by the current scanner tier's revealRadius.
   */
  /** @internal */ public revealSpecialBlocks(): void { revealSpecialBlocksImpl(this) }

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
  private triggerEarthquake(): void { triggerEarthquakeImpl(this) }

  /**
   * Detonates a bomb centered on the player, clearing a 3x3 area of blocks.
   * Skips Unbreakable, ExitLadder, and QuizGate blocks.
   * Collects minerals, artifacts, and oxygen from destroyed special blocks.
   * LavaBlock and GasPocket are destroyed without applying their hazard effects.
   * Costs BOMB_OXYGEN_COST oxygen and decrements the bomb count by 1.
   */
  public useBomb(): void { useBombImpl(this) }

  /**
   * Gets the max stack size for a mineral tier.
   */
  private getMaxStackSize(tier: MineralTier): number { return getMaxStackSizeImpl(tier) }

  /** @internal */ public addToInventory(slot: InventorySlot): boolean { return addToInventoryImpl(this, slot) }

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
  private handleLavaContact(): void { handleLavaContactImpl(this) }

  /**
   * Called by HazardSystem when the player occupies a gas cloud cell.
   * Emits a game event so GameManager can drain O2 per tick. (Phase 8.3)
   */
  private handleGasContact(): void { handleGasContactImpl(this) }

  /**
   * Called by HazardSystem when lava spreads into a new empty cell.
   * Updates the grid to reflect the new lava block and redraws the tile. (Phase 8.3)
   *
   * @param x - Grid column of the newly lava-filled cell.
   * @param y - Grid row of the newly lava-filled cell.
   */
  private markCellAsLava(x: number, y: number): void { markCellAsLavaImpl(this, x, y) }

  /**
   * Apply a consumable tool effect. (DD-V2-064)
   */
  public applyConsumable(id: ConsumableId): void { applyConsumableImpl(this, id) }

  /** Bomb: clear 3x3 area around player */
  private applyBomb(): void { applyBombImpl(this) }

  /** Flare: reveal 7x7 area */
  private applyFlare(): void { applyFlareImpl(this) }

  /** Drill Charge: mine 5 blocks in facing direction */
  private applyDrillCharge(): void { applyDrillChargeImpl(this) }

  /** Sonar Pulse: highlight minerals within 10 Manhattan distance */
  private applySonarPulse(): void { applySonarPulseImpl(this) }

  /**
   * Called after mine generation to handle landmark-specific entry effects. (DD-V2-055)
   * Emits GAIA toast messages and activates hazards present in the landmark template.
   */
  private handleLandmarkEntry(): void { handleLandmarkEntryImpl(this) }

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
  private triggerInstabilityCollapse(): void { triggerInstabilityCollapseImpl(this) }

  /** Returns true if the player is at grid cell (x, y). */
  private isPlayerAt(x: number, y: number): boolean { return isPlayerAtImpl(this, x, y) }

  /** Force a layer failure (triggered when instability countdown reaches 0). (Phase 35.4) */
  private forceLayerFail(): void { forceLayerFailImpl(this) }

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
