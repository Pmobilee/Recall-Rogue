# AR-217: Enhanced Atmospheric Particles & Depth Layering

**Status:** Pending
**Priority:** High
**Complexity:** Medium-High
**Estimated Files:** 3 modified, 1 new (light shaft sprite)
**Depends on:** AR-215 (Room Atmosphere Config)

## Overview

Upgrade the existing `CombatAtmosphereSystem` from a single-layer particle system to a **dual-depth particle system** with particles both BEHIND and IN FRONT of the enemy sprite. Add **light shaft sprites** for applicable themes. Add **room-specific particle behaviors** beyond the current 5 basic types.

The key insight from the research doc: particles at two depth layers make the enemy exist *within* an atmosphere rather than *on top of it*. Currently all atmosphere particles render at depth 2 (behind the enemy at depth 5). This AR splits them across depth 3 (behind) and depth 12 (in front), with the front layer being subtler to avoid obscuring the enemy.

## Dependencies

- **Blocked by:** AR-215 (needs `AtmosphereConfig.particles.*` and `AtmosphereConfig.lightShafts.*`)
- **Blocks:** Nothing
- **Related:** `src/game/systems/CombatAtmosphereSystem.ts` (primary target), `src/game/systems/CombatParticleSystem.ts` (impact particles — different system, do not modify)

## Current State Analysis

`CombatAtmosphereSystem.ts` (165 lines) currently:
- Creates fog overlay graphics at depth 2
- Spawns ambient particles every 500ms (single depth layer)
- Uses `THEME_TINTS` for particle colors
- Respects device tier budgets (low=10, mid=20, high=50)
- All particles render at the same depth as fog (depth 2)
- No light shafts, no front-layer particles, no pre-fill

## Sub-Steps

### 1. Split Particle System into Back + Front Layers

**File:** `src/game/systems/CombatAtmosphereSystem.ts`

Replace single emitter with two emitters at different depths:

```typescript
private backEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
private frontEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

private createParticleEmitters(config: AtmosphereConfig): void {
  const pConfig = config.particles;
  if (pConfig.type === 'none') return;

  const w = this.scene.scale.width;
  const h = this.scene.scale.height;

  // --- BACK LAYER (depth 3 — behind enemy at depth 5) ---
  this.backEmitter = this.scene.add.particles(0, 0, this.particleTextureKey, {
    x: { min: 0, max: w },
    y: { min: 0, max: h },
    scale: { min: pConfig.scaleRange[0], max: pConfig.scaleRange[1] },
    alpha: { start: 0, end: 0.35, ease: 'Sine.easeInOut' },
    lifespan: pConfig.lifespan,
    speedX: { min: -10, max: 10 },
    speedY: { min: -8, max: 8 },
    gravityY: pConfig.gravityY,
    frequency: pConfig.frequency,
    quantity: 1,
    maxAliveParticles: this.getScaledBudget(pConfig.maxBack),
    blendMode: pConfig.blendMode,
    tint: pConfig.tints,
    advance: 3000, // Pre-fill so particles exist on scene load
  }).setDepth(3);

  // --- FRONT LAYER (depth 12 — in front of enemy at depth 5) ---
  // Front layer is SUBTLER: lower alpha, fewer particles, smaller scale
  this.frontEmitter = this.scene.add.particles(0, 0, this.particleTextureKey, {
    x: { min: 0, max: w },
    y: { min: 0, max: h },
    scale: { min: pConfig.scaleRange[0] * 0.8, max: pConfig.scaleRange[1] * 0.7 },
    alpha: { start: 0, end: 0.2, ease: 'Sine.easeInOut' },  // lower alpha than back
    lifespan: pConfig.lifespan * 0.8,
    speedX: { min: -12, max: 12 },
    speedY: { min: -6, max: 6 },
    gravityY: pConfig.gravityY,
    frequency: pConfig.frequency * 1.5,  // spawn less frequently
    quantity: 1,
    maxAliveParticles: this.getScaledBudget(pConfig.maxFront),
    blendMode: pConfig.blendMode,
    tint: pConfig.tints,
    advance: 2000,
  }).setDepth(12);
}
```

### 2. Room-Specific Particle Behaviors

Each particle type gets unique movement patterns beyond just gravity:

```typescript
private applyParticleBehavior(
  emitter: Phaser.GameObjects.Particles.ParticleEmitter,
  type: string,
  isFrontLayer: boolean
): void {
  switch (type) {
    case 'dust':
      // Gentle floating — slight horizontal drift, lazy vertical
      emitter.setParticleSpeed({ min: -8, max: 8 }, { min: -5, max: 5 });
      break;

    case 'embers':
      // Rise from bottom, curl sideways
      emitter.setEmitZone({
        type: 'random',
        source: new Phaser.Geom.Rectangle(0, this.h * 0.7, this.w, this.h * 0.3),
      });
      emitter.setParticleSpeed({ min: -15, max: 15 }, { min: -60, max: -20 });
      // Color lifecycle: yellow -> orange -> red -> fade
      break;

    case 'ice_crystals':
      // Drift down slowly, slight sparkle (alpha oscillation via custom update)
      emitter.setParticleSpeed({ min: -5, max: 5 }, { min: 3, max: 12 });
      break;

    case 'arcane_runes':
      // Float upward in slow spirals — use sin/cos in particle update callback
      emitter.setParticleSpeed({ min: -5, max: 5 }, { min: -20, max: -8 });
      break;

    case 'void_wisps':
      // Erratic movement — fast speed changes, phase in/out (alpha flicker)
      emitter.setParticleSpeed({ min: -20, max: 20 }, { min: -20, max: 20 });
      break;
  }
}
```

### 3. Procedural Particle Textures Per Type

Currently CombatAtmosphereSystem uses a single particle texture. Create type-specific textures:

```typescript
private createParticleTextures(scene: Phaser.Scene): void {
  // Dust: 4x4 soft square
  if (!scene.textures.exists('atm_dust')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 0.8);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('atm_dust', 4, 4);
    g.destroy();
  }

  // Embers: 3x3 bright core with 1px glow
  if (!scene.textures.exists('atm_ember')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(0, 0, 5, 5);
    g.fillStyle(0xffffff, 1.0);
    g.fillRect(1, 1, 3, 3);
    g.generateTexture('atm_ember', 5, 5);
    g.destroy();
  }

  // Ice crystals: 4x4 diamond shape
  if (!scene.textures.exists('atm_ice')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 0.9);
    g.fillPoint(2, 0, 1); // top
    g.fillPoint(0, 2, 1); // left
    g.fillPoint(4, 2, 1); // right
    g.fillPoint(2, 4, 1); // bottom
    g.fillPoint(2, 2, 1); // center
    g.fillPoint(1, 1, 1); g.fillPoint(3, 1, 1);
    g.fillPoint(1, 3, 1); g.fillPoint(3, 3, 1);
    g.generateTexture('atm_ice', 5, 5);
    g.destroy();
  }

  // Arcane runes: 6x6 small cross/rune shape
  if (!scene.textures.exists('atm_arcane')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1.0);
    g.fillRect(2, 0, 2, 6); // vertical bar
    g.fillRect(0, 2, 6, 2); // horizontal bar
    g.generateTexture('atm_arcane', 6, 6);
    g.destroy();
  }

  // Void wisps: 3x3 pixel with 1px halo
  if (!scene.textures.exists('atm_void')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(3, 3, 3);
    g.fillStyle(0xffffff, 0.9);
    g.fillPoint(3, 3, 1);
    g.generateTexture('atm_void', 7, 7);
    g.destroy();
  }
}
```

Map particle type to texture key:
```typescript
const PARTICLE_TEXTURES: Record<string, string> = {
  dust: 'atm_dust',
  embers: 'atm_ember',
  ice_crystals: 'atm_ice',
  arcane_runes: 'atm_arcane',
  void_wisps: 'atm_void',
  spores: 'atm_dust',  // reuse dust texture, different color
  ash: 'atm_dust',     // reuse dust texture, gray tint
};
```

### 4. Light Shaft Sprites

**File:** `src/game/systems/CombatAtmosphereSystem.ts` (add method)

Light shafts are pre-rendered tapered beam sprites with ADD blend, gently animated:

```typescript
private lightShafts: Phaser.GameObjects.Image[] = [];

private createLightShafts(config: AtmosphereConfig): void {
  if (!config.lightShafts.enabled) return;

  // Generate light shaft texture procedurally (tapered gradient beam)
  if (!this.scene.textures.exists('light_shaft')) {
    const w = 80, h = 600;
    const canvas = this.scene.textures.createCanvas('light_shaft', w, h);
    const ctx = canvas.getContext();

    // Vertical gradient: transparent -> white -> transparent
    // Tapered: wider at top, narrower at bottom
    for (let y = 0; y < h; y++) {
      const progress = y / h;
      const width = w * (1 - progress * 0.6); // taper from 100% to 40%
      const x = (w - width) / 2;
      const alpha = Math.sin(progress * Math.PI) * 0.5; // peak alpha in middle
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(x, y, width, 1);
    }
    canvas.refresh();
  }

  const shaftConfig = config.lightShafts;
  for (let i = 0; i < shaftConfig.count; i++) {
    // Distribute shafts across scene width
    const xPos = this.w * (0.2 + (i * 0.6 / Math.max(shaftConfig.count - 1, 1)));

    const shaft = this.scene.add.image(xPos, 0, 'light_shaft')
      .setOrigin(0.5, 0)
      .setBlendMode('ADD')
      .setAlpha(shaftConfig.alpha)
      .setTint(shaftConfig.tint)
      .setAngle(shaftConfig.angle)
      .setDepth(4); // Between back particles (3) and enemy (5)

    // Gentle breathing animation
    this.scene.tweens.add({
      targets: shaft,
      alpha: { from: shaftConfig.alpha * 0.6, to: shaftConfig.alpha * 1.2 },
      scaleX: { from: 0.9, to: 1.1 },
      duration: 3000 + i * 500, // Stagger so shafts don't pulse in sync
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.lightShafts.push(shaft);
  }
}
```

**Light shaft depth:** Depth 4 (behind enemy at depth 5, in front of atmosphere back-layer at depth 3). This places shafts between the back particles and the enemy, creating the layered depth effect.

### 5. Pre-Fill Particles on Scene Load

The `advance` property in Phaser particle configs pre-simulates particles so they exist when the scene loads. This is already included in the emitter configs above (3000ms back, 2000ms front).

Without pre-fill, players see an empty room for 3-6 seconds while particles slowly spawn — breaking immersion.

### 6. Performance Budget Enforcement

```typescript
/** Scale particle budget by device tier */
private getScaledBudget(configMax: number): number {
  const tier = getDeviceTier();
  if (tier === 'low-end') return Math.round(configMax * 0.4);
  if (tier === 'mid') return Math.round(configMax * 0.7);
  return configMax; // high-end gets full budget
}
```

**Total particle budget targets:**
| Tier | Back Layer | Front Layer | Total Max |
|------|-----------|-------------|-----------|
| Low-end | 8 | 3 | 11 |
| Mid | 14 | 7 | 21 |
| High-end | 25 | 25 | 50 |

On low-end devices, skip light shafts entirely (saves 2-3 sprite draws with ADD blend).

### 7. Cleanup on Scene Transition

```typescript
destroy(): void {
  this.backEmitter?.destroy();
  this.frontEmitter?.destroy();
  this.lightShafts.forEach(s => s.destroy());
  this.lightShafts = [];
  // Existing fog cleanup...
}
```

### 8. Updated Depth Layer Table

After this AR, the combat scene depth stack becomes:

| Depth | Layer | Notes |
|-------|-------|-------|
| 0 | Background image | Enemy-specific |
| 1 | Vignette | Permanent edge fade |
| 2 | Fog overlay | Theme-tinted |
| 3 | **Back atmosphere particles** | NEW — behind enemy |
| 4 | **Light shaft sprites** | NEW — ADD blend, behind enemy |
| 5 | Enemy sprite container | Shadow + outlines + main |
| 7 | Enemy name text | |
| 8-13 | HP bars, block, etc. | Existing UI elements |
| 12 | **Front atmosphere particles** | NEW — in front of enemy |
| 998 | Impact particles | Combat effects |
| 999 | Screen flash | |

**Conflict note:** Front particles at depth 12 share depth with enemy block bar. This is acceptable — particles are sparse, low-alpha, and ADD-blended, so visual overlap is minimal. If it becomes an issue, front particles can move to depth 6 (between enemy and name text).

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/game/systems/CombatAtmosphereSystem.ts` | **MAJOR MODIFY** | Dual emitters, light shafts, per-type textures, pre-fill, budget scaling |
| `src/game/scenes/CombatScene.ts` | **MINOR MODIFY** | Pass config to atmosphere system, ensure light shaft depth doesn't conflict |
| `src/data/roomAtmosphere.ts` | **MINOR MODIFY** | May need to adjust particle config values after visual testing |

## Acceptance Criteria

- [ ] Back-layer particles render at depth 3 (behind enemy)
- [ ] Front-layer particles render at depth 12 (in front of enemy)
- [ ] Front-layer particles are visibly subtler than back-layer (lower alpha, smaller scale)
- [ ] Each theme has distinct particle texture (dust=square, embers=bright core, ice=diamond, arcane=cross, void=halo)
- [ ] Embers rise from bottom of screen; ice crystals drift down; dust floats; arcane floats up; void moves erratically
- [ ] Light shafts appear in dust, ice, and arcane themes (not embers or void per config)
- [ ] Light shafts animate with gentle alpha/scale breathing, staggered timing
- [ ] Particles are pre-filled on scene load (no empty room on transition)
- [ ] Low-end devices get 40% particle budget, no light shafts
- [ ] Mid devices get 70% particle budget
- [ ] All emitters have `maxAliveParticles` set (hard cap)
- [ ] All emitters and shafts are destroyed on scene transition (no leaks)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes

## Verification Gate

1. `npm run typecheck` + `npm run build` — clean
2. Playwright screenshots at floors 1 (dust), 5 (embers), 8 (ice), 10 (arcane), 14 (void) — verify unique particle types
3. Verify dual-depth: take screenshot, confirm some particles appear behind enemy, some in front
4. Verify light shafts visible in dust/ice/arcane themes, absent in embers/void
5. Verify pre-fill: immediately after scene transition, particles are already present
6. Console: no WebGL errors, no "texture not found" warnings
7. FPS check: `window.__terraDebug()` should show < 0.5ms particle overhead

## Performance Budget

| Component | GPU Cost | Notes |
|-----------|----------|-------|
| Back emitter (25 particles) | ~0.2ms | Small textures, alpha blend |
| Front emitter (25 particles) | ~0.2ms | Smaller textures, alpha blend |
| Light shafts (2-3 sprites, ADD) | ~0.05ms | Static images, ADD blend |
| **Total** | **~0.5ms** | Down from research estimate |

## Design Decisions

- **Front layer at depth 12 (not 6):** Places front particles clearly in front of all gameplay elements except impact effects. The slight overlap with block bar is acceptable given low particle density and alpha.
- **Procedural textures, not loaded assets:** Keeps the asset pipeline clean. 4-7px procedural textures are indistinguishable from hand-drawn at this scale.
- **Pre-fill via `advance`:** Phaser's built-in pre-simulation. No custom code needed. 2-3 seconds of advance fills the space convincingly.
- **Staggered light shaft timing:** Prevents synchronized pulsing which looks mechanical. Each shaft gets +500ms offset.
