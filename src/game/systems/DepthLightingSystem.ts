import Phaser from 'phaser'
import { DepthLightingFX } from '../shaders/DepthLightingFX'
import { getCombatDepthMap } from '../../data/backgroundManifest'
import { getDeviceTier } from '../../services/deviceTierService'
import type { AtmosphereConfig } from '../../data/roomAtmosphere'
import { resolveCombatLights, getFlickerForLight } from '../../data/lightSourceResolver'
import type { BackgroundLightSource } from '../../data/lightSourceManifest'

/**
 * DepthLightingSystem manages depth-based lighting for combat backgrounds.
 *
 * Loads depth maps alongside background images, attaches the DepthLightingFX
 * PostFX pipeline to the background, and configures it based on the current
 * atmosphere theme. Disabled entirely on low-end devices.
 *
 * Integration points in CombatScene:
 *   - Call {@link queueDepthMapLoad} inside `setBackground()` to co-load the
 *     depth texture in the same Phaser loader batch as the background image.
 *   - Call {@link attachToBackground} inside `_swapBackground()` after the
 *     `Phaser.GameObjects.Image` is created or updated.
 *   - Call {@link applyAtmosphere} whenever the atmosphere config changes.
 *   - Call {@link stop} in the scene `shutdown` / `destroy` handler.
 */
export class DepthLightingSystem {
  private scene: Phaser.Scene
  private activePipeline: DepthLightingFX | null = null
  private currentDepthKey: string = ''
  private enabled: boolean
  private pendingAtmConfig: AtmosphereConfig | null = null
  private currentEnemyId: string = ''
  private currentFloor: number = 1
  private pointLights: Array<{
    source: BackgroundLightSource
    seed: number
    baseIntensity: number
    baseRadius: number
    flickerStrength: number
    flickerSpeed: number
  }> = []

  // ── Chain light override state (Spec 03) ───────────────────────────────────
  /** Multiplier applied on top of each light's baseIntensity. 1.0 = no change. */
  private chainIntensityMult: number = 1.0
  /** 0–1 blend from original light color toward chainColor. 0 = no blend. */
  private chainColorBlend: number = 0.0
  /** Target color for blend in normalized [r, g, b] format. */
  private chainColor: [number, number, number] = [1, 1, 1]
  /** Multiplier on flicker speed. >1 = faster flicker during high chains. */
  private chainFlickerSpeedMult: number = 1.0
  /** Active timer for clearChainLightOverride fade animation. */
  private chainFadeTimer: Phaser.Time.TimerEvent | null = null
  /** Active timer for setChainBreathing oscillation. */
  private chainBreathingTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    // Skip entirely on low-end devices — all public methods become no-ops.
    this.enabled = getDeviceTier() !== 'low-end'
  }

  // ── Depth map loading ───────────────────────────────────────────────────

  /**
   * Queue the depth map for an enemy background into the current Phaser load batch.
   *
   * Call this inside `CombatScene.setBackground()` **before** `this.load.start()` so
   * the depth texture loads in parallel with the background image.
   *
   * Skips the load if the texture is already cached. No-op on low-end devices.
   *
   * @param enemyId The enemy template ID (e.g. `'page_flutter'`, `'cave-troll'`)
   * @param bgKey   The background texture key used in this load batch — the depth
   *                key is derived from it as `depth-{bgKey}`
   */
  queueDepthMapLoad(enemyId: string, bgKey: string): void {
    if (!this.enabled) return

    const depthPath = getCombatDepthMap(enemyId)
    // Strip the leading slash so Phaser's loader resolves relative to root.
    const cleanPath = depthPath.startsWith('/') ? depthPath.slice(1) : depthPath
    this.currentDepthKey = `depth-${bgKey}`

    // Don't re-load if already cached in the texture manager.
    if (this.scene.textures.exists(this.currentDepthKey)) return
    this.scene.load.image(this.currentDepthKey, cleanPath)
  }

  /**
   * Set the current enemy context for point light resolution.
   * Called from CombatScene when a new enemy is set.
   */
  setEnemyContext(enemyId: string, floor: number): void {
    this.currentEnemyId = enemyId
    this.currentFloor = floor
  }

  // ── Pipeline attachment ─────────────────────────────────────────────────

  /**
   * Attach the DepthLightingFX PostFX pipeline to the combat background Image.
   *
   * Call this from `CombatScene._swapBackground()` **after** `this.combatBackground`
   * has been created or repositioned. Any previously attached pipeline is detached first.
   *
   * No-op on low-end devices or when the renderer does not support PostFX pipelines.
   *
   * @param bgImage The background `Phaser.GameObjects.Image` sitting at depth 0
   */
  attachToBackground(bgImage: Phaser.GameObjects.Image): void {
    if (!this.enabled) return

    // Detach any pipeline from a previous background swap.
    this.detach()

    // Attach the registered PostFX pipeline to this image by name,
    // then retrieve the instance so we can configure its uniforms.
    bgImage.setPostPipeline('DepthLightingFX')
    const pipelineResult = bgImage.getPostPipeline('DepthLightingFX')
    const fx = Array.isArray(pipelineResult) ? pipelineResult[0] as DepthLightingFX | undefined : pipelineResult as DepthLightingFX | undefined
    if (!fx) {
      console.warn('[DepthLighting] Failed to get DepthLightingFX pipeline — pipeline may not be registered')
      return
    }

    // Bind the depth map texture if it was loaded successfully.
    if (this.currentDepthKey && this.scene.textures.exists(this.currentDepthKey)) {
      fx.setDepthMap(this.scene, this.currentDepthKey)
    } else {
      console.warn(`[DepthLighting] Depth map texture "${this.currentDepthKey}" not found — running without depth`)
    }

    // Set quality level: flagship = 2, mid = 1, low-end branch disabled above.
    const tier = getDeviceTier()
    fx.setQualityLevel(tier === 'flagship' ? 2 : 1)

    // Compute cover-crop transform: the background image may be wider/taller
    // than the viewport. The PostFX FBO covers the viewport, but the depth map
    // covers the full image. This transform converts viewport UVs → image UVs.
    const vw = this.scene.scale.width
    const vh = this.scene.scale.height
    const dw = bgImage.displayWidth
    const dh = bgImage.displayHeight
    // FBO UV 0-1 covers viewport. Image extends beyond by (dw-vw)/2 on each side.
    // imageUV = fboUV * (vw/dw) + (1 - vw/dw) / 2
    const cropScaleX = vw / dw
    const cropScaleY = vh / dh
    const cropOffsetX = (1 - cropScaleX) / 2
    const cropOffsetY = (1 - cropScaleY) / 2
    fx.setCropTransform([cropScaleX, cropScaleY], [cropOffsetX, cropOffsetY])

    this.activePipeline = fx

    // Re-apply atmosphere config if it was set before the pipeline was ready
    // (common race: setEnemy→applyAtmosphere runs before async setBackground completes)
    if (this.pendingAtmConfig) {
      this.applyAtmosphere(this.pendingAtmConfig)
    }
  }

  // ── Atmosphere configuration ────────────────────────────────────────────

  /**
   * Translate an {@link AtmosphereConfig} into shader uniforms.
   *
   * Call this after `attachToBackground()` and whenever the atmosphere theme
   * changes (e.g. on boss floors). Safe to call before `attachToBackground()` —
   * it is silently skipped if no pipeline is active.
   *
   * @param config The atmosphere configuration for the current floor theme
   */
  applyAtmosphere(config: AtmosphereConfig): void {
    // Always store config so it can be re-applied when the pipeline attaches later
    // (handles the race where setEnemy runs before async setBackground completes)
    this.pendingAtmConfig = config
    if (!this.activePipeline) return

    // ── Resolve point lights early (needed to adjust ambient) ──────────
    const orientation = window.innerWidth / window.innerHeight < 1 ? 'portrait' : 'landscape'
    const lightConfig = resolveCombatLights(
      this.currentEnemyId, this.currentFloor, orientation as 'portrait' | 'landscape',
    )
    const hasPointLights = lightConfig.lights.length > 0

    // ── Directional light ─────────────────────────────────────────────────
    // If the manifest specifies ambientOverride, use it — the manifest author
    // tuned it for this specific background. Otherwise use defaults.
    //
    // Rooms WITH point lights get much darker ambient so light pools pop.
    // Rooms WITHOUT lights get brighter ambient + synthetic overhead.
    const ambientOverride = lightConfig.ambientOverride
    let ambientLevel: number
    if (ambientOverride !== undefined) {
      // Manifest explicitly set ambient for this background
      ambientLevel = ambientOverride
    } else if (hasPointLights) {
      ambientLevel = 0.15
    } else {
      ambientLevel = 0.40
    }
    // Clamp ambient floor so no background ever goes below 30% brightness.
    // Without this, some enemies (e.g. ink_slug at ambientOverride 0.06) produce a near-black overlay.
    ambientLevel = Math.max(ambientLevel, 0.30)
    const ambient: [number, number, number] = [ambientLevel, ambientLevel, ambientLevel]

    // Rooms WITH point lights: pass through at original brightness (ambient ≈ 1.0,
    // no directional). Point lights add colored glow on top of the untouched image.
    // Rooms WITHOUT lights: use depth normals + directional for subtle 3D effect.
    this.activePipeline.setDirectionalLight(
      [0.0, -0.5, 1.0],
      [0.85, 0.83, 0.80],
      hasPointLights ? 0.0 : 0.35,  // Zero directional when point lights present
      hasPointLights ? [1.0, 1.0, 1.0] as [number, number, number] : ambient,
      hasPointLights ? 0.0 : 1.5,   // Zero normals when point lights present
    )

    // ── Fog ───────────────────────────────────────────────────────────────
    // Disabled for rooms with point lights (image passes through unmodified).
    const fogRgb = hexToRgb(config.fogTint)
    this.activePipeline.setFog(
      fogRgb,
      hasPointLights ? 0 : config.fogAlpha * 5.0,
      0.2,
      0.9,
    )

    // ── Screen-space ambient occlusion ───────────────────────────────────
    // Disabled for rooms with point lights (no darkening at all).
    this.activePipeline.setSSAO(
      5.0,
      hasPointLights ? 0 : 0.3,
    )

    // ── Parallax breathing ─────────────────────────────────────────────
    // Uses the AtmosphereConfig parallax settings, converted to UV-space amplitude.
    // Disabled when reduce-motion is enabled.
    const reduceMotion = typeof window !== 'undefined'
      && JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
    // Re-enabled with background now 4px oversized to absorb edge displacement.
    // Very subtle: ~0.5px at 1000px width, ~10 second period.
    if (reduceMotion) {
      this.activePipeline.setBreathing(0, 0)
    } else {
      this.activePipeline.setBreathing(0.0015, 0.6)
    }

    // ── Point lights from manifest ───────────────────────────────────────
    // lightConfig was resolved earlier (needed for ambient calculation).
    // For backgrounds with NO manifest lights, add a synthetic overhead light
    // to simulate light coming from a hole in the ceiling / distant doorway.
    const effectiveLights = lightConfig.lights.length > 0
      ? lightConfig.lights
      : [{
          x: 0.50, y: 0.20, z: 0.2,
          radius: 0.28,
          color: config.lightShafts.tint,  // Match theme color
          intensity: 1.2,
          type: 'ambient' as const,
        }]

    // Build per-light state with flicker params
    this.pointLights = effectiveLights.map((source, i) => {
      const flicker = getFlickerForLight(source)
      return {
        source,
        seed: i * 137.5 + 42.3,  // Unique per-light seed for noise
        baseIntensity: source.intensity,
        baseRadius: source.radius,
        flickerStrength: flicker.strength,
        flickerSpeed: flicker.speed,
      }
    })

    // Push initial (un-flickered) light data
    this.pushPointLightsToShader(0)
  }

  // ── Chain light override methods (Spec 03) ──────────────────────────────

  /**
   * Override point light intensity and hue toward a chain color.
   * Applied multiplicatively on top of base light values in the per-frame update loop.
   * No-op if the system is disabled (low-end devices).
   *
   * @param chainColorHex  Packed hex color of the active chain type (e.g. 0x9B59B6)
   * @param intensityMult  Multiplier on all point light base intensities
   * @param colorBlend     0–1, how much to blend toward chainColorHex
   * @param flickerSpeedMult  Multiplier on flicker speed (>1 = faster flicker)
   */
  public setChainLightOverride(
    chainColorHex: number,
    intensityMult: number,
    colorBlend: number,
    flickerSpeedMult: number = 1.0,
  ): void {
    if (!this.enabled) return
    // Cancel any in-progress fade so the new values take effect immediately
    if (this.chainFadeTimer) {
      this.chainFadeTimer.destroy()
      this.chainFadeTimer = null
    }
    this.chainIntensityMult = intensityMult
    this.chainColorBlend = colorBlend
    this.chainColor = hexToRgb(chainColorHex)
    this.chainFlickerSpeedMult = flickerSpeedMult
  }

  /**
   * Restore point lights to their base state over fadeMs.
   * Uses a 16ms timer to lerp multipliers back to defaults.
   * No-op if the system is disabled (low-end devices).
   *
   * @param fadeMs Duration in ms for the fade-out (default 500ms). 0 = instant.
   */
  public clearChainLightOverride(fadeMs: number = 500): void {
    if (!this.enabled) return
    if (this.chainFadeTimer) {
      this.chainFadeTimer.destroy()
      this.chainFadeTimer = null
    }
    if (fadeMs <= 0) {
      this.chainIntensityMult = 1.0
      this.chainColorBlend = 0.0
      this.chainFlickerSpeedMult = 1.0
      return
    }
    const startMult = this.chainIntensityMult
    const startBlend = this.chainColorBlend
    const startFlicker = this.chainFlickerSpeedMult
    const startTime = this.scene.time.now
    this.chainFadeTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const t = Math.min((this.scene.time.now - startTime) / fadeMs, 1)
        this.chainIntensityMult = startMult + (1.0 - startMult) * t
        this.chainColorBlend = startBlend * (1 - t)
        this.chainFlickerSpeedMult = startFlicker + (1.0 - startFlicker) * t
        if (t >= 1) {
          this.chainIntensityMult = 1.0
          this.chainColorBlend = 0.0
          this.chainFlickerSpeedMult = 1.0
          this.chainFadeTimer?.destroy()
          this.chainFadeTimer = null
        }
      },
    })
  }

  /**
   * Enable or disable depth-breathing oscillation for chain 7+ visual escalation.
   * When enabled, oscillates the breathing amplitude on a 1.5s sine wave between
   * 0.0015 (normal) and 0.004 (elevated), giving a subtle pulsing depth effect.
   * No-op if the system is disabled or no active pipeline.
   *
   * @param enabled True to start oscillating, false to restore normal breathing.
   */
  public setChainBreathing(enabled: boolean): void {
    if (!this.enabled || !this.activePipeline) return
    // Always stop existing breathing timer first
    if (this.chainBreathingTimer) {
      this.chainBreathingTimer.destroy()
      this.chainBreathingTimer = null
      // Restore normal breathing params
      this.activePipeline?.setBreathing(0.0015, 0.6)
    }
    if (!enabled) return
    // Pulse uDolly amplitude on a 1.5s sine wave.
    // Oscillates between near-normal (0.0015) and elevated (0.004).
    const startTime = this.scene.time.now
    this.chainBreathingTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const t = (this.scene.time.now - startTime) / 1000
        const amp = 0.0015 + Math.sin(t * Math.PI * 2 / 1.5) * 0.0025
        this.activePipeline?.setBreathing(Math.max(0, amp), 0.6)
      },
    })
  }

  // ── Point light helpers ───────────────────────────────────────────────

  /**
   * Push current point light state to the shader.
   * Applies chain override multipliers (intensity, color blend, flicker speed).
   * @param time Elapsed time in seconds (for flicker calculation)
   */
  private pushPointLightsToShader(time: number): void {
    if (!this.activePipeline) return

    // Light positions are in image space (0-1 across the original image).
    // The shader handles the cover-crop UV remapping via uCropScale/uCropOffset.
    const lights = this.pointLights.map(pl => {
      let intensity = pl.baseIntensity
      let radius = pl.baseRadius

      // Flicker: multi-frequency sin noise per light, with chain speed multiplier
      if (pl.flickerStrength > 0 && time > 0) {
        const t = time
        const s = pl.seed
        const effectiveFlickerSpeed = pl.flickerSpeed * this.chainFlickerSpeedMult
        const noise =
          Math.sin(t * effectiveFlickerSpeed * 7.3 + s) * 0.5 +
          Math.sin(t * effectiveFlickerSpeed * 13.1 + s * 2.7) * 0.3 +
          Math.sin(t * effectiveFlickerSpeed * 23.7 + s * 0.3) * 0.2
        intensity = pl.baseIntensity * (1.0 + noise * pl.flickerStrength)
        radius = pl.baseRadius * (1.0 + noise * pl.flickerStrength * 0.3)
      }

      // Apply chain intensity multiplier on top of base + flicker
      intensity = intensity * this.chainIntensityMult

      // Compute base light RGB and blend toward chain color if active
      let rgb = hexToRgb(pl.source.color)
      if (this.chainColorBlend > 0) {
        const [cr, cg, cb] = this.chainColor
        rgb = [
          rgb[0] + (cr - rgb[0]) * this.chainColorBlend,
          rgb[1] + (cg - rgb[1]) * this.chainColorBlend,
          rgb[2] + (cb - rgb[2]) * this.chainColorBlend,
        ] as [number, number, number]
      }

      return {
        x: pl.source.x,
        y: pl.source.y,
        z: pl.source.z,
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
        radius,
        intensity,
      }
    })

    this.activePipeline.setPointLights(lights)
  }

  /**
   * Per-frame update. Call from CombatScene.update().
   * Drives flicker animation for point lights.
   */
  update(time: number): void {
    if (!this.enabled || !this.activePipeline || this.pointLights.length === 0) return
    this.pushPointLightsToShader(time / 1000)  // Convert ms to seconds
  }

  // ── Entrance animation ─────────────────────────────────────────────────

  /**
   * Animate all point light intensities from 0 to their configured base values
   * over the specified duration. Used during enemy entrance to fade lighting in
   * simultaneously with the enemy sprite reveal.
   *
   * No-op if the system is disabled (low-end devices) or no pipeline is active.
   *
   * @param durationMs Total fade-in duration in milliseconds (800 for commons, 1200 for bosses)
   */
  animateLightsIn(durationMs: number): void {
    if (!this.enabled || !this.activePipeline) return

    // Snapshot base intensities, then zero them so lights start dark
    const bases = this.pointLights.map(pl => pl.baseIntensity)
    this.pointLights.forEach(pl => { pl.baseIntensity = 0 })
    const startTime = this.scene.time.now

    const timer = this.scene.time.addEvent({
      delay: 16,  // ~60fps tick rate
      loop: true,
      callback: () => {
        const elapsed = this.scene.time.now - startTime
        const t = Math.min(elapsed / durationMs, 1)
        this.pointLights.forEach((pl, i) => {
          pl.baseIntensity = bases[i] * t
        })
        this.pushPointLightsToShader(this.scene.time.now / 1000)
        if (t >= 1) {
          timer.destroy()
          // Restore exact base values to eliminate floating-point accumulation
          this.pointLights.forEach((pl, i) => { pl.baseIntensity = bases[i] })
        }
      },
    })
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Detach the active pipeline reference.
   *
   * The PostFX pipeline instance itself is owned by the Image's `postFX` manager
   * and will be destroyed when that Image is destroyed or its postFX is cleared.
   * This method only drops our local reference.
   */
  detach(): void {
    this.activePipeline = null
  }

  /**
   * Full cleanup called on scene `shutdown` or `destroy`.
   *
   * Drops all references. The Phaser scene will handle actual GPU resource
   * destruction of any attached PostFX pipelines.
   */
  stop(): void {
    this.detach()
    this.currentDepthKey = ''
    this.pointLights = []
    this.currentEnemyId = ''
    // Clean up chain timers
    if (this.chainFadeTimer) {
      this.chainFadeTimer.destroy()
      this.chainFadeTimer = null
    }
    if (this.chainBreathingTimer) {
      this.chainBreathingTimer.destroy()
      this.chainBreathingTimer = null
    }
    // Reset chain override state
    this.chainIntensityMult = 1.0
    this.chainColorBlend = 0.0
    this.chainFlickerSpeedMult = 1.0
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a packed hex color number to a normalised `[r, g, b]` tuple.
 *
 * @param hex Packed 24-bit color integer (e.g. `0xFFAA33`)
 * @returns Tuple with each channel in the 0–1 range
 */
function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8)  & 0xff) / 255,
    (hex         & 0xff) / 255,
  ]
}
