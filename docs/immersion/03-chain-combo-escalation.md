---
status: implemented
delete-after-implementation: true
priority: mid-term
effort: M-L
impact: high
owner-agent: game-logic
depends-on: none
---

# Chain Combo Escalating Visual Feedback

## What It Is

As the player builds a chain (2 → 3 → 5 → 7+ consecutive cards of the same chain type), the environment visually intensifies at each threshold: particle density rises, point lights brighten and shift hue toward the chain color, the vignette begins pulsing, and at chain 7+ the depth lighting subtly pulses. When the chain resolves or breaks, everything snaps back to normal over 500ms — the "pressure release."

## Why It Matters

Chain combos are the highest-skill expression in the game. Currently they produce nothing beyond a one-shot `comboMilestone()` particle burst (which already exists in `CombatParticleSystem`). The environment should FEEL like a chain is happening — not just show a number. Progressive escalation makes every additional link feel earned and makes breaking a chain feel like losing something tangible.

## Current State

**`src/services/chainVisuals.ts`** (48 lines total) — only static color helpers:
- `getChainColor(chainType)` → CSS hex string
- `getChainGlowColor(chainType)` → CSS rgba string
- `getChainColorGroups(cards)` → `Map<chainType, cardId[]>`
- No dynamic state, no modifiers, no runtime output

**`src/game/systems/CombatAtmosphereSystem.ts`:**
- `backEmitter` and `frontEmitter` are `Phaser.GameObjects.Particles.ParticleEmitter` instances (lines 123/141). Their `frequency` is set once at `start()` from `AtmosphereConfig.particles.frequency`. No mutation API exists. The emitters are stored as private fields with no public accessor.
- `config` (the `AtmosphereConfig`) is also private with only a getter.

**`src/game/systems/DepthLightingSystem.ts`:**
- `pointLights` array holds `baseIntensity`, `flickerStrength`, `flickerSpeed` per light (lines 32–39).
- `pushPointLightsToShader(time)` is private, called from `update()`.
- No public API to modify intensity or hue at runtime.
- `applyAtmosphere()` is the only public config method — it rebuilds everything from an `AtmosphereConfig`.

**`src/game/systems/CombatParticleSystem.ts`:**
- `comboMilestone(comboLevel)` (lines 194+) fires a one-shot burst that scales with level. Already wired — no changes needed to this.

**`src/game/scenes/CombatScene.ts`:**
- No chain-count tracking or chain event hooks. Chain state is managed by the service layer (likely `src/services/chainSystem.ts` or similar).
- `nearDeathVignette` (depth 3, alpha 0 default) has a pulse tween for near-death. The same "slow alpha oscillation" pattern is available for chain pulsing using a separate overlay rect.

**Chain color values** — `getChainTypeColor()` returns a CSS hex string (`'#...'`). To use as Phaser tint, strip `#` and parse: `parseInt(color.slice(1), 16)`.

## Implementation Spec

### Files to Modify

1. **`src/services/chainVisuals.ts`** — add `getChainAtmosphereModifiers(chainCount, chainType)`
2. **`src/game/systems/CombatAtmosphereSystem.ts`** — add `applyChainModifiers(modifiers)` and `clearChainModifiers()`
3. **`src/game/systems/DepthLightingSystem.ts`** — add `setChainLightOverride(color, intensityMultiplier, flickerSpeedMultiplier)` and `clearChainLightOverride(fadeMs)`
4. **`src/game/scenes/CombatScene.ts`** — add `onChainUpdated(chainCount, chainType)` and `onChainBroken()` public methods; wire vignette pulse overlay

### Files to Create

None.

### Technical Details

#### 1. `getChainAtmosphereModifiers` in `chainVisuals.ts`

```typescript
export interface ChainAtmosphereModifiers {
  /** Multiplier on emitter frequency interval (lower = more particles). 1.0 = no change. */
  particleFrequencyMultiplier: number
  /** Intensity multiplier for all point lights. 1.0 = no change. */
  lightIntensityMultiplier: number
  /** Hue blend toward chain color. 0 = no blend, 1 = full chain color. */
  lightColorBlend: number
  /** Vignette pulse: non-zero enables slow oscillation. Value = peak alpha delta. 0 = off. */
  vignettePulseAmplitude: number
  /** Screen shake on each card play. 0 = none, 1 = micro, 2 = tier-2. */
  cardPlayShakeTier: 0 | 1 | 2
  /** Tint overlay alpha (chain color at this opacity over the scene). 0 = none. */
  tintOverlayAlpha: number
  /** Depth displacement pulse. True = enable breathing uDolly oscillation. */
  depthPulse: boolean
}

/**
 * Returns environment modifier values for a given chain count and chain type.
 * Returns null for chainCount < 2 (no modifiers active).
 */
export function getChainAtmosphereModifiers(
  chainCount: number,
  chainType: number | undefined,
): ChainAtmosphereModifiers | null {
  if (chainCount < 2) return null

  if (chainCount >= 7) {
    return {
      particleFrequencyMultiplier: 0.5,  // half interval = double rate
      lightIntensityMultiplier: 1.8,
      lightColorBlend: 0.7,
      vignettePulseAmplitude: 0.10,
      cardPlayShakeTier: 2,
      tintOverlayAlpha: 0.05,
      depthPulse: true,
    }
  }
  if (chainCount >= 5) {
    return {
      particleFrequencyMultiplier: 0.5,
      lightIntensityMultiplier: 1.5,
      lightColorBlend: 0.5,
      vignettePulseAmplitude: 0.08,
      cardPlayShakeTier: 1,
      tintOverlayAlpha: 0.05,
      depthPulse: false,
    }
  }
  if (chainCount >= 3) {
    return {
      particleFrequencyMultiplier: 0.7,  // ~40% more particles
      lightIntensityMultiplier: 1.25,
      lightColorBlend: 0.3,
      vignettePulseAmplitude: 0,
      cardPlayShakeTier: 1,
      tintOverlayAlpha: 0,
      depthPulse: false,
    }
  }
  // chainCount === 2
  return {
    particleFrequencyMultiplier: 0.8,  // ~20% more particles
    lightIntensityMultiplier: 1.0,
    lightColorBlend: 0,
    vignettePulseAmplitude: 0,
    cardPlayShakeTier: 0,
    tintOverlayAlpha: 0,
    depthPulse: false,
  }
}
```

#### 2. `CombatAtmosphereSystem` chain methods

Add two public methods. They need access to `backEmitter`, `frontEmitter`, and the base `config.particles.frequency` value (store it as `private baseFrequency: number = 0` and set it in `start()`).

```typescript
/** Expose emitters for chain modulation (stored frequency). */
private baseBackFrequency: number = 0
private baseFrontFrequency: number = 0

// In start(), after creating backEmitter:
//   this.baseBackFrequency = pConfig.frequency
//   this.baseFrontFrequency = Math.round(pConfig.frequency * 1.5)

/**
 * Apply chain combo atmosphere modifiers.
 * @param multiplier Frequency multiplier (0.5 = double rate, 1.0 = no change)
 */
public applyChainModifiers(frequencyMultiplier: number): void {
  if (!this.isActive || this.reduceMotion) return
  if (this.backEmitter && this.baseBackFrequency > 0) {
    this.backEmitter.setFrequency(Math.round(this.baseBackFrequency * frequencyMultiplier))
  }
  if (this.frontEmitter && this.baseFrontFrequency > 0) {
    this.frontEmitter.setFrequency(Math.round(this.baseFrontFrequency * frequencyMultiplier))
  }
}

/** Reset particle rates to their base values. */
public clearChainModifiers(): void {
  if (!this.isActive) return
  if (this.backEmitter && this.baseBackFrequency > 0) {
    this.backEmitter.setFrequency(this.baseBackFrequency)
  }
  if (this.frontEmitter && this.baseFrontFrequency > 0) {
    this.frontEmitter.setFrequency(this.baseFrontFrequency)
  }
}
```

Note on low-end: `applyChainModifiers` should early-return on low-end devices in addition to `reduceMotion`. Add: `if (getDeviceTier() === 'low-end') return`. Low-end gets no particle rate changes, only color/brightness shifts (which come from DepthLightingSystem — disabled on low-end anyway, so the chain has no environmental effect on low-end).

#### 3. `DepthLightingSystem` chain methods

Add a chain override layer that is multiplied on top of `baseIntensity` in `pushPointLightsToShader`. Store the override as a simple multiplier + color blend value.

```typescript
// New private fields:
private chainIntensityMult: number = 1.0
private chainColorBlend: number = 0.0
private chainColor: [number, number, number] = [1, 1, 1]
private chainFlickerSpeedMult: number = 1.0

/**
 * Override point light intensity and hue toward a chain color.
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
  this.chainIntensityMult = intensityMult
  this.chainColorBlend = colorBlend
  this.chainColor = hexToRgb(chainColorHex)
  this.chainFlickerSpeedMult = flickerSpeedMult
}

/**
 * Restore point lights to their base state over fadeMs.
 * Uses a simple time-based lerp in the update loop.
 */
public clearChainLightOverride(fadeMs: number = 500): void {
  if (!this.enabled) return
  // Animate back to defaults
  const startMult = this.chainIntensityMult
  const startBlend = this.chainColorBlend
  const startFlicker = this.chainFlickerSpeedMult
  const startTime = this.scene.time.now
  const timer = this.scene.time.addEvent({
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
        timer.destroy()
      }
    },
  })
}
```

Modify `pushPointLightsToShader` to apply the override multipliers:

```typescript
// In the .map() callback, after computing intensity and radius:
intensity = intensity * this.chainIntensityMult

// Blend rgb toward chainColor:
if (this.chainColorBlend > 0) {
  const [cr, cg, cb] = this.chainColor
  rgb = [
    rgb[0] + (cr - rgb[0]) * this.chainColorBlend,
    rgb[1] + (cg - rgb[1]) * this.chainColorBlend,
    rgb[2] + (cb - rgb[2]) * this.chainColorBlend,
  ] as [number, number, number]
}

// Apply flicker speed multiplier:
// In the noise formula, multiply flickerSpeed by chainFlickerSpeedMult:
// const noise = Math.sin(t * pl.flickerSpeed * this.chainFlickerSpeedMult * 7.3 + s) * 0.5 + ...
```

**Depth pulse (chain 7+):** The `DepthLightingFX` shader has a `uDolly` uniform controlled via `setBreathing(amplitude, period)`. To add a chain-driven breathing oscillation layer, add a `setChainBreathing(enabled)` method:

```typescript
private chainBreathingTimer: Phaser.Time.TimerEvent | null = null

public setChainBreathing(enabled: boolean): void {
  if (!this.enabled || !this.activePipeline) return
  if (this.chainBreathingTimer) {
    this.chainBreathingTimer.destroy()
    this.chainBreathingTimer = null
    // Restore normal breathing params
    this.activePipeline.setBreathing(0.0015, 0.6)
  }
  if (!enabled) return
  // Pulse uDolly amplitude faster and wider
  // Oscillate between normal (0.0015) and elevated (0.004) on a 1.5s sine wave
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
```

#### 4. `CombatScene` chain wiring

Add two public methods callable by the service layer:

```typescript
// New private fields:
private chainVignetteTween: Phaser.Tweens.Tween | null = null
private chainVignetteOverlay: Phaser.GameObjects.Rectangle | null = null
private chainTintOverlay: Phaser.GameObjects.Rectangle | null = null
private currentChainCount: number = 0

/**
 * Called whenever the active chain count changes.
 * Pass chainCount=0 and chainType=undefined to clear (same as onChainBroken).
 */
public onChainUpdated(chainCount: number, chainType: number | undefined): void {
  if (this.reduceMotion && isTurboMode()) return
  this.currentChainCount = chainCount

  const modifiers = getChainAtmosphereModifiers(chainCount, chainType)

  // ── Particles ──────────────────────────────────────────────────────────
  if (modifiers) {
    this.atmosphereSystem.applyChainModifiers(modifiers.particleFrequencyMultiplier)
  } else {
    this.atmosphereSystem.clearChainModifiers()
  }

  // ── Point lights ────────────────────────────────────────────────────────
  if (modifiers && chainType !== undefined) {
    const chainHex = parseInt(getChainColor(chainType).slice(1), 16)
    const flickerMult = chainCount >= 7 ? 2.0 : 1.0
    this.depthLightingSystem.setChainLightOverride(
      chainHex,
      modifiers.lightIntensityMultiplier,
      modifiers.lightColorBlend,
      flickerMult,
    )
    this.depthLightingSystem.setChainBreathing(modifiers.depthPulse)
  } else {
    this.depthLightingSystem.clearChainLightOverride(500)
    this.depthLightingSystem.setChainBreathing(false)
  }

  // ── Vignette pulse ──────────────────────────────────────────────────────
  if (modifiers && modifiers.vignettePulseAmplitude > 0 && !this.reduceMotion) {
    if (!this.chainVignetteOverlay) {
      const w = this.scale.width
      const h = this.scale.height
      this.chainVignetteOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0).setDepth(2)
    }
    if (this.chainVignetteTween) { this.chainVignetteTween.destroy() }
    this.chainVignetteTween = this.tweens.add({
      targets: this.chainVignetteOverlay,
      alpha: { from: 0, to: modifiers.vignettePulseAmplitude },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  } else {
    this.chainVignetteTween?.destroy()
    this.chainVignetteTween = null
    if (this.chainVignetteOverlay) {
      this.tweens.add({
        targets: this.chainVignetteOverlay,
        alpha: 0,
        duration: 300,
        onComplete: () => { this.chainVignetteOverlay?.destroy(); this.chainVignetteOverlay = null },
      })
    }
  }

  // ── Tint overlay ────────────────────────────────────────────────────────
  if (modifiers && modifiers.tintOverlayAlpha > 0 && chainType !== undefined && !this.reduceMotion) {
    const chainHex = parseInt(getChainColor(chainType).slice(1), 16)
    if (!this.chainTintOverlay) {
      const w = this.scale.width
      const h = this.scale.height
      this.chainTintOverlay = this.add.rectangle(w / 2, h / 2, w, h, chainHex, 0)
        .setDepth(2)
        .setBlendMode(Phaser.BlendModes.ADD)
    } else {
      this.chainTintOverlay.setFillStyle(chainHex, 0)
    }
    this.tweens.add({
      targets: this.chainTintOverlay,
      alpha: modifiers.tintOverlayAlpha,
      duration: 300,
    })
  } else if (this.chainTintOverlay) {
    this.tweens.add({
      targets: this.chainTintOverlay,
      alpha: 0,
      duration: 300,
      onComplete: () => { this.chainTintOverlay?.destroy(); this.chainTintOverlay = null },
    })
  }
}

/** Called when the chain breaks or is resolved. Full reset over 500ms. */
public onChainBroken(): void {
  this.onChainUpdated(0, undefined)
}
```

**Screen shake on card play (chains 3+):** This is triggered per-card-play, not per-chain-update. The existing `playCorrectAnswer()` or equivalent method in `CombatScene` should check `this.currentChainCount` and add a shake tier:

```typescript
// Inside the card-play juice firing path:
if (this.currentChainCount >= 7) {
  this.screenShake.trigger('medium')
} else if (this.currentChainCount >= 3) {
  this.screenShake.trigger('micro')
}
```

### Integration Points

- **Chain count source:** Find where chain count is tracked — search `src/services/` for `chainCount`, `comboCount`, or `chain`. The call to `onChainUpdated` should fire every time the chain count changes (after each card play, after chain breaks).
- **`getChainColor` import in CombatScene:** Already exported from `chainVisuals.ts`. Add to CombatScene imports.
- **`getChainAtmosphereModifiers` import in CombatScene:** Add to CombatScene imports after implementing in `chainVisuals.ts`.
- **Cleanup on encounter end:** Call `onChainBroken()` in the scene's encounter-end handler to reset all chain state before the next fight.
- **Resize handling:** `chainVignetteOverlay` and `chainTintOverlay` are full-viewport rects. In `handleResize()`, update their size:
  ```typescript
  this.chainVignetteOverlay?.setPosition(w / 2, h / 2).setSize(w, h)
  this.chainTintOverlay?.setPosition(w / 2, h / 2).setSize(w, h)
  ```

### Reduce-Motion Handling

Reduce-motion path: skip ALL tweens, particle changes, vignette pulses, shake escalation, and tint overlays. Only color/brightness changes via `DepthLightingSystem` are considered non-motion and may proceed (they are uniform changes, not animated movement). However, since `DepthLightingSystem` changes happen in the update loop (not as CSS animation), they are acceptable:

```typescript
// At top of onChainUpdated:
if (isTurboMode()) return  // headless sim: skip all chain visuals

// Reduce-motion path: apply light changes only, skip everything else
if (this.reduceMotion) {
  if (modifiers && chainType !== undefined) {
    const chainHex = parseInt(getChainColor(chainType).slice(1), 16)
    this.depthLightingSystem.setChainLightOverride(chainHex, modifiers.lightIntensityMultiplier, modifiers.lightColorBlend, 1.0)
  } else {
    this.depthLightingSystem.clearChainLightOverride(0)
  }
  return
}
```

### Device Tier Handling

| Feature | Flagship/Mid | Low-End |
|---|---|---|
| Particle rate increase | Yes | No (emitters disabled) |
| Point light intensity/hue | Yes (via DepthLightingSystem) | No (DepthLightingSystem disabled) |
| Vignette pulse | Yes | Yes (just alpha tween — cheap) |
| Tint overlay | Yes | Yes (just a Rectangle — cheap) |
| Depth pulse | Yes (flagship only in practice, mid may have DepthLightingFX) | No |
| Screen shake escalation | Yes | Yes |

In `applyChainModifiers` in `CombatAtmosphereSystem`: add `if (getDeviceTier() === 'low-end') return`.

In `setChainLightOverride` in `DepthLightingSystem`: already gated by `if (!this.enabled)` which excludes low-end.

## Verification

1. In combat, play two cards of the same chain type. Verify a slight particle density increase.
2. Play a third consecutive chain card. Verify point lights visibly brighten and shift hue toward the chain color. Verify micro screen shake on each subsequent card play.
3. Build to chain 5. Verify vignette begins slow oscillating pulse, lights at 1.5×, tint overlay faint.
4. Build to chain 7. Verify depth lighting pulses (background shifts subtly), lights at 1.8× with faster flicker, screen shakes are stronger.
5. Break the chain by playing an off-type card. Verify everything returns to baseline over ~500ms.
6. Verify turbo mode produces zero chain visual side effects (headless sim must not error).
7. Toggle reduce-motion. Verify no tweens, no particles, no shakes — only point light color/intensity changes.
8. Switch floors (new encounter). Verify chain state is fully cleared (call `onChainBroken()` in encounter-end hook).

## Effort Estimate

**M-L (Medium-Large).** Four files modified, three new public APIs. The trickiest part is:
1. Confirming which service file tracks chain count and inserting the `onChainUpdated` call correctly
2. The `pushPointLightsToShader` modification (private, needs refactoring to support the override multiplier)
3. Testing the depth pulse at chain 7+ without it being distracting
4. Ensuring the `clearChainLightOverride` fade timer doesn't conflict with the per-frame `update()` flicker loop

Expect 4–6 hours including integration and visual tuning.
