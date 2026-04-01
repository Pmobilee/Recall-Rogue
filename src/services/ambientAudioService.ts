/**
 * ambientAudioService.ts
 *
 * Layered ambient atmosphere system for Recall Rogue.
 *
 * Audio graph (per layer):
 *   AudioBufferSourceNode → layer GainNode → masterGain → destination
 *
 * Each ambient context is a recipe of simultaneous looping layers. Switching
 * contexts crossfades all layers out (800 ms) then the new ones in (800 ms).
 *
 * Features:
 * - Lazy AudioContext creation (requires user gesture)
 * - 16 named contexts (hub, dungeon_map, combat themes, boss_arena, etc.)
 * - 800 ms crossfade between contexts
 * - Quiz-overlay ducking (50% master volume)
 * - Music coexistence mode (30% of recipe target volumes)
 * - Boss overlay: additive layers on top of current recipe
 * - Buffer cache keyed by file path
 *
 * Usage:
 *   import { ambientAudio } from '../services/ambientAudioService'
 *   ambientAudio.init()                        // call from first user gesture
 *   await ambientAudio.setContext('combat_dust')
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single layer in an ambient recipe */
interface AmbientLayer {
  /** Path to the .ogg loop file under /assets/audio/sfx/ */
  file: string
  /** Target volume 0.0–1.0 */
  volume: number
  /** Whether to loop. Defaults to true. */
  loop?: boolean
}

/** A complete ambient atmosphere recipe */
interface AmbientRecipe {
  layers: AmbientLayer[]
}

/** All recipe contexts */
export type AmbientContext =
  | 'hub'
  | 'dungeon_map'
  | 'shop'
  | 'rest'
  | 'mystery'
  | 'combat_dust'
  | 'combat_embers'
  | 'combat_ice'
  | 'combat_arcane'
  | 'combat_void'
  | 'boss_arena'
  | 'mastery_challenge'
  | 'run_end_victory'
  | 'run_end_defeat'
  | 'retreat_delve'
  | 'silent'

interface ActiveLayer {
  source: AudioBufferSourceNode
  gain: GainNode
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CROSSFADE_SEC = 0.8
const CROSSFADE_DISCONNECT_DELAY_MS = 900  // slightly longer than CROSSFADE_SEC
const DUCK_RATIO = 0.5
const MUSIC_COEXISTENCE_RATIO = 0.3

// ─── Recipe definitions ──────────────────────────────────────────────────────
// Source: docs/roadmap/future/SFX-SOUND-GENERATION-PROMPTS.md §AMBIENT ATMOSPHERE RECIPES

const RECIPES: Record<AmbientContext, AmbientRecipe> = {
  hub: {
    layers: [
      { file: '/assets/audio/sfx/loops/hub_campfire_ambience.ogg', volume: 0.7 },
      { file: '/assets/audio/sfx/loops/water_drip_close.ogg', volume: 0.12 },
      { file: '/assets/audio/sfx/loops/stone_room_resonance.ogg', volume: 0.2 },
      { file: '/assets/audio/sfx/loops/camp_cloth_rustle.ogg', volume: 0.08 },
      { file: '/assets/audio/sfx/loops/distant_creature_stir.ogg', volume: 0.06 },
    ],
  },
  dungeon_map: {
    layers: [
      { file: '/assets/audio/sfx/loops/wind_passage.ogg', volume: 0.4 },
      { file: '/assets/audio/sfx/loops/water_drip_close.ogg', volume: 0.1 },
      { file: '/assets/audio/sfx/loops/stone_creak_settle.ogg', volume: 0.08 },
    ],
  },
  shop: {
    layers: [
      { file: '/assets/audio/sfx/loops/fire_torch_crackle.ogg', volume: 0.5 },
      { file: '/assets/audio/sfx/loops/chain_rattle_distant.ogg', volume: 0.15 },
      { file: '/assets/audio/sfx/loops/wind_passage.ogg', volume: 0.08 },
    ],
  },
  rest: {
    layers: [
      { file: '/assets/audio/sfx/loops/hub_campfire_ambience.ogg', volume: 0.6 },
      { file: '/assets/audio/sfx/loops/water_drip_close.ogg', volume: 0.15 },
      { file: '/assets/audio/sfx/loops/wind_passage.ogg', volume: 0.1 },
      { file: '/assets/audio/sfx/loops/stone_creak_settle.ogg', volume: 0.05 },
    ],
  },
  mystery: {
    layers: [
      { file: '/assets/audio/sfx/loops/arcane_whisper.ogg', volume: 0.5 },
      { file: '/assets/audio/sfx/loops/void_drone.ogg', volume: 0.25 },
      { file: '/assets/audio/sfx/loops/wind_passage.ogg', volume: 0.08 },
    ],
  },
  combat_dust: {
    layers: [
      { file: '/assets/audio/sfx/loops/water_drip_close.ogg', volume: 0.35 },
      { file: '/assets/audio/sfx/loops/stone_creak_settle.ogg', volume: 0.2 },
      { file: '/assets/audio/sfx/loops/wind_passage.ogg', volume: 0.1 },
      { file: '/assets/audio/sfx/loops/fire_torch_crackle.ogg', volume: 0.08 },
    ],
  },
  combat_embers: {
    layers: [
      { file: '/assets/audio/sfx/loops/fire_ember_pit.ogg', volume: 0.45 },
      { file: '/assets/audio/sfx/loops/lava_bubble.ogg', volume: 0.3 },
      { file: '/assets/audio/sfx/loops/steam_vent_hiss.ogg', volume: 0.15 },
      { file: '/assets/audio/sfx/loops/stone_creak_settle.ogg', volume: 0.08 },
    ],
  },
  combat_ice: {
    layers: [
      { file: '/assets/audio/sfx/loops/ice_creak.ogg', volume: 0.4 },
      { file: '/assets/audio/sfx/loops/wind_howl_deep.ogg', volume: 0.3 },
      { file: '/assets/audio/sfx/loops/water_drip_close.ogg', volume: 0.1 },
      { file: '/assets/audio/sfx/loops/crystal_hum.ogg', volume: 0.05 },
    ],
  },
  combat_arcane: {
    layers: [
      { file: '/assets/audio/sfx/loops/arcane_whisper.ogg', volume: 0.4 },
      { file: '/assets/audio/sfx/loops/crystal_hum.ogg', volume: 0.25 },
      { file: '/assets/audio/sfx/loops/wind_passage.ogg', volume: 0.1 },
      { file: '/assets/audio/sfx/loops/stone_creak_settle.ogg', volume: 0.08 },
    ],
  },
  combat_void: {
    layers: [
      { file: '/assets/audio/sfx/loops/void_drone.ogg', volume: 0.5 },
      { file: '/assets/audio/sfx/loops/wind_howl_deep.ogg', volume: 0.15 },
    ],
  },
  boss_arena: {
    layers: [
      { file: '/assets/audio/sfx/loops/combat_tension_underbed.ogg', volume: 0.5 },
      { file: '/assets/audio/sfx/loops/boss_arena_ambient.ogg', volume: 0.4 },
    ],
  },
  mastery_challenge: {
    layers: [
      { file: '/assets/audio/sfx/loops/arcane_whisper.ogg', volume: 0.4 },
      { file: '/assets/audio/sfx/loops/crystal_hum.ogg', volume: 0.3 },
    ],
  },
  run_end_victory: {
    layers: [
      { file: '/assets/audio/sfx/loops/hub_campfire_ambience.ogg', volume: 0.4 },
    ],
  },
  run_end_defeat: {
    layers: [
      { file: '/assets/audio/sfx/loops/void_drone.ogg', volume: 0.3 },
      { file: '/assets/audio/sfx/loops/wind_passage.ogg', volume: 0.15 },
    ],
  },
  retreat_delve: {
    layers: [
      { file: '/assets/audio/sfx/loops/wind_passage.ogg', volume: 0.35 },
      { file: '/assets/audio/sfx/loops/stone_creak_settle.ogg', volume: 0.15 },
      { file: '/assets/audio/sfx/loops/dungeon_drip_ambient.ogg', volume: 0.1 },
    ],
  },
  silent: { layers: [] },
}

// Boss overlay layers added on top of the current recipe without stopping it
const BOSS_OVERLAY_LAYERS: AmbientLayer[] = [
  { file: '/assets/audio/sfx/loops/combat_tension_underbed.ogg', volume: 0.3 },
]

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** Apply music coexistence and ducking multipliers to a recipe target volume */
function effectiveVolume(
  targetVolume: number,
  musicCoexistence: boolean,
  ducking: boolean,
): number {
  let v = targetVolume
  if (musicCoexistence) v *= MUSIC_COEXISTENCE_RATIO
  if (ducking) v *= DUCK_RATIO
  return v
}

// ─── Service class ───────────────────────────────────────────────────────────

class AmbientAudioService {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null

  /** Currently playing recipe layers */
  private activeLayers: ActiveLayer[] = []
  /** Currently playing boss overlay layers */
  private bossOverlayLayers: ActiveLayer[] = []
  /** Decoded buffer cache keyed by file path */
  private bufferCache = new Map<string, AudioBuffer>()

  private currentContext: AmbientContext = 'silent'
  private musicCoexistence = false
  private ducking = false

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Create AudioContext and master gain node lazily.
   * Must be called within a user gesture handler (browser autoplay policy).
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 1
    this.masterGain.connect(this.ctx.destination)
  }

  /**
   * Resume a suspended AudioContext.
   * Call from any user gesture handler to unblock audio after browser suspension.
   */
  unlock(): void {
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  /**
   * Switch to a new ambient context with an 800 ms crossfade.
   * No-op if the requested context is already active.
   */
  async setContext(context: AmbientContext): Promise<void> {
    if (context === this.currentContext) return
    this.currentContext = context
    const recipe = RECIPES[context]
    await this.crossfadeTo(recipe)
  }

  /**
   * Duck all ambient layers to 50% of their target volumes.
   * Intended for quiz overlay activation. Idempotent.
   */
  duck(): void {
    if (this.ducking) return
    this.ducking = true
    this.applyVolumesToActive()
  }

  /**
   * Restore ambient layers from quiz-overlay duck. Idempotent.
   */
  unduck(): void {
    if (!this.ducking) return
    this.ducking = false
    this.applyVolumesToActive()
  }

  /**
   * Enable or disable music coexistence mode.
   * When enabled, all recipe layer volumes are multiplied by 0.3 so ambient
   * doesn't fight the BGM.
   */
  setMusicCoexistence(enabled: boolean): void {
    if (this.musicCoexistence === enabled) return
    this.musicCoexistence = enabled
    this.applyVolumesToActive()
  }

  /**
   * Start the boss overlay layers on top of the current recipe.
   * Fades them in over 800 ms. Calling again while overlay is active is a no-op.
   */
  addBossOverlay(): void {
    if (!this.ctx || !this.masterGain) return
    if (this.bossOverlayLayers.length > 0) return

    for (const layer of BOSS_OVERLAY_LAYERS) {
      const active = this.startLayer(layer)
      if (active) this.bossOverlayLayers.push(active)
    }
  }

  /**
   * Fade out and remove boss overlay layers over 800 ms.
   */
  removeBossOverlay(): void {
    if (!this.ctx) return
    this.fadeOutAndDetach(this.bossOverlayLayers)
    this.bossOverlayLayers = []
  }

  /**
   * Immediately stop all ambient audio and reset to silent.
   */
  stop(): void {
    if (!this.ctx) return
    this.stopLayers(this.activeLayers)
    this.stopLayers(this.bossOverlayLayers)
    this.activeLayers = []
    this.bossOverlayLayers = []
    this.currentContext = 'silent'
  }

  // ─── Private — buffer loading ──────────────────────────────────────────────

  /**
   * Fetch, decode, and cache an AudioBuffer for a file path.
   * Returns null if the fetch or decode fails (non-fatal — layer is silently skipped).
   */
  private async loadBuffer(path: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(path)
    if (cached !== undefined) return cached

    if (!this.ctx) return null

    try {
      const response = await fetch(path)
      if (!response.ok) {
        console.warn(`[ambientAudio] fetch failed for "${path}": ${response.status}`)
        this.bufferCache.set(path, null as unknown as AudioBuffer)
        return null
      }
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)
      this.bufferCache.set(path, audioBuffer)
      return audioBuffer
    } catch (err) {
      console.warn(`[ambientAudio] could not load "${path}":`, err)
      this.bufferCache.set(path, null as unknown as AudioBuffer)
      return null
    }
  }

  // ─── Private — playback ───────────────────────────────────────────────────

  /**
   * Cross-fade from the current active layers to a new recipe:
   * 1. Fade out old layers over 800 ms, then stop + disconnect them.
   * 2. Load all buffers for the new recipe (in parallel).
   * 3. Start new layers at volume 0, ramp up to target volume over 800 ms.
   */
  private async crossfadeTo(recipe: AmbientRecipe): Promise<void> {
    if (!this.ctx || !this.masterGain) return

    // Capture old layers before overwriting
    const oldLayers = [...this.activeLayers]
    this.activeLayers = []

    // Fade out old layers (non-blocking — disconnect happens via setTimeout)
    this.fadeOutAndDetach(oldLayers)

    // Load all new buffers in parallel (gracefully skip missing files)
    const buffers = await Promise.all(
      recipe.layers.map(layer => this.loadBuffer(layer.file))
    )

    // Start new layers (ctx may have changed state while awaiting, guard again)
    if (!this.ctx || !this.masterGain) return

    for (let i = 0; i < recipe.layers.length; i++) {
      const layer = recipe.layers[i]!
      const buffer = buffers[i]
      if (!buffer) continue  // file not found — skip silently

      const active = this.startLayer(layer)
      if (active) this.activeLayers.push(active)
    }
  }

  /**
   * Create, connect, and start a single looping layer node.
   * Returns the ActiveLayer pair, or null if AudioContext is unavailable.
   */
  private startLayer(layer: AmbientLayer): ActiveLayer | null {
    if (!this.ctx || !this.masterGain) return null

    // Retrieve from cache — loadBuffer must have been called for recipe layers
    const buffer = this.bufferCache.get(layer.file)
    if (!buffer) return null

    const now = this.ctx.currentTime
    const targetVol = effectiveVolume(layer.volume, this.musicCoexistence, this.ducking)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(targetVol, now + CROSSFADE_SEC)
    gain.connect(this.masterGain)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = layer.loop !== false  // default true
    source.connect(gain)
    source.start()

    return { source, gain }
  }

  /**
   * Fade out a set of layers over CROSSFADE_SEC, then stop + disconnect them.
   * Fire-and-forget via setTimeout — does not block the calling async flow.
   */
  private fadeOutAndDetach(layers: ActiveLayer[]): void {
    if (!this.ctx || layers.length === 0) return
    const now = this.ctx.currentTime

    for (const { source, gain } of layers) {
      gain.gain.setValueAtTime(gain.gain.value, now)
      // exponentialRamp can't reach 0; ramp to near-silence then stop
      gain.gain.exponentialRampToValueAtTime(0.001, now + CROSSFADE_SEC)
    }

    setTimeout(() => {
      this.stopLayers(layers)
    }, CROSSFADE_DISCONNECT_DELAY_MS)
  }

  /**
   * Immediately stop and disconnect a set of layers. Safe to call multiple times.
   */
  private stopLayers(layers: ActiveLayer[]): void {
    for (const { source, gain } of layers) {
      try { source.stop() } catch { /* already stopped */ }
      try { gain.disconnect() } catch { /* already disconnected */ }
    }
  }

  /**
   * Re-apply effective volumes to all currently active layers (recipe + boss overlay).
   * Called when ducking or musicCoexistence state changes.
   */
  private applyVolumesToActive(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const recipe = RECIPES[this.currentContext]

    for (let i = 0; i < this.activeLayers.length; i++) {
      const layer = recipe.layers[i]
      if (!layer) continue
      const targetVol = effectiveVolume(layer.volume, this.musicCoexistence, this.ducking)
      const { gain } = this.activeLayers[i]!
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(targetVol, now + 0.1)
    }

    for (let i = 0; i < this.bossOverlayLayers.length; i++) {
      const overlayLayer = BOSS_OVERLAY_LAYERS[i]
      if (!overlayLayer) continue
      const targetVol = effectiveVolume(overlayLayer.volume, this.musicCoexistence, this.ducking)
      const { gain } = this.bossOverlayLayers[i]!
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(targetVol, now + 0.1)
    }
  }
}

/** Singleton instance — import this everywhere. */
export const ambientAudio = new AmbientAudioService()
