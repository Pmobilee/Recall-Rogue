# AR-215: Room Atmosphere Config System (Foundation)

**Status:** Pending
**Priority:** Critical (blocks AR-216 through AR-221)
**Complexity:** Medium
**Estimated Files:** 2 new, 2 modified

## Overview

Create a unified, data-driven atmosphere configuration system that maps floor themes to visual parameters: tint colors, ambient light color, particle presets, fog density, light positions, rim color, and haze strength. This is the **foundation layer** that all subsequent environmental presence ARs build upon.

Currently `CombatAtmosphereSystem.ts` has a minimal `THEME_TINTS` map and `getFloorTheme()` function. This AR expands that into a comprehensive config structure that drives every downstream visual system from a single source of truth.

### Why This Must Be First

Every other AR in this series (color grading, particles, lighting, rim, parallax) needs to know "what does this room look like?" The answer must come from ONE config, not scattered constants across 6 files. Build the data layer first, consume it everywhere.

## Dependencies

- **Blocks:** AR-216, AR-217, AR-218, AR-219, AR-220, AR-221
- **Blocked by:** None
- **Related:** `src/game/systems/CombatAtmosphereSystem.ts` (current atmosphere), `src/data/biomeAudio.ts` (biome structure)

## Sub-Steps

### 1. Create `src/data/roomAtmosphere.ts` — The Master Config

Create a new file defining the atmosphere config type and all theme presets.

**Type definition:**

```typescript
export interface AtmosphereConfig {
  /** Floor theme identifier */
  theme: FloorTheme;

  /** --- Color Grading (AR-216) --- */
  /** Multiplicative tint applied to enemy sprites via setTint(). Hex color. */
  spriteTint: number;
  /** Multiplicative tint for background image. Hex color. */
  backgroundTint: number;
  /** Camera ColorMatrix adjustments */
  cameraColorMatrix: {
    saturation: number;   // -1.0 to 1.0 (0 = no change)
    brightness: number;   // 0.0 to 2.0 (1.0 = no change)
    hueRotate?: number;   // degrees, optional
  };

  /** --- Ground Shadow (AR-216) --- */
  /** Shadow alpha multiplier (0.0 to 1.0). Darker rooms = stronger shadows. */
  shadowAlpha: number;
  /** Shadow tint color (usually dark version of ambient). Hex color. */
  shadowTint: number;

  /** --- Ambient Occlusion (AR-216) --- */
  /** AO gradient strength on sprite base (0.0 to 0.4). */
  aoStrength: number;

  /** --- Fog (AR-217) --- */
  /** Fog overlay alpha (0.0 to 0.25). 0 = no fog. */
  fogAlpha: number;
  /** Fog tint color. Hex. */
  fogTint: number;

  /** --- Particles (AR-217) --- */
  particles: {
    /** Particle type identifier */
    type: 'dust' | 'embers' | 'ice_crystals' | 'arcane_runes' | 'void_wisps' | 'spores' | 'ash' | 'none';
    /** Tint colors for random selection */
    tints: number[];
    /** Gravity Y (negative = float up, positive = fall down) */
    gravityY: number;
    /** Particle scale range */
    scaleRange: [number, number];
    /** Max alive particles (back layer) */
    maxBack: number;
    /** Max alive particles (front layer) */
    maxFront: number;
    /** Blend mode for particles */
    blendMode: 'ADD' | 'NORMAL';
    /** Lifespan in ms */
    lifespan: number;
    /** Spawn frequency in ms */
    frequency: number;
  };

  /** --- Light Shafts (AR-217) --- */
  lightShafts: {
    enabled: boolean;
    /** Number of shafts (0-3) */
    count: number;
    /** Shaft tint color */
    tint: number;
    /** Base alpha (will tween around this) */
    alpha: number;
    /** Angle in degrees (0 = vertical, positive = rightward lean) */
    angle: number;
  };

  /** --- Lighting (AR-219) --- */
  lighting: {
    /** Ambient light color for Light2D pipeline */
    ambientColor: number;
    /** Point light definitions (max 5 for perf) */
    lights: Array<{
      /** X position as fraction of scene width (0.0 to 1.0) */
      xPct: number;
      /** Y position as fraction of scene height (0.0 to 1.0) */
      yPct: number;
      /** Light radius in pixels (will be scaled) */
      radius: number;
      /** Light color. Hex. */
      color: number;
      /** Intensity (0.5 to 3.0) */
      intensity: number;
      /** Optional flicker amplitude (0.0 to 0.3) */
      flicker?: number;
    }>;
  };

  /** --- Rim Lighting (AR-220) --- */
  rim: {
    /** Rim light color (matches dominant light source) */
    color: number;
    /** Rim intensity (0.0 to 1.0) */
    intensity: number;
    /** Light direction as [x, y] normalized vector */
    lightDir: [number, number];
  };

  /** --- Parallax (AR-221) --- */
  parallax: {
    /** Idle camera sway amplitude in pixels (snapped to int) */
    swayAmplitudeX: number;
    swayAmplitudeY: number;
    /** Sway duration in ms (one full cycle) */
    swayDuration: number;
  };

  /** --- Heat Haze (AR-221) --- */
  haze: {
    enabled: boolean;
    /** UV displacement strength (0.002 to 0.008) */
    strength: number;
    /** Y-start of haze effect (0.0 = top, 1.0 = bottom). 0.4 = bottom 60% */
    yStart: number;
  };

  /** --- Micro-Animation Sync (AR-221) --- */
  microAnimation: {
    /** Room oscillator frequency for synced effects */
    oscillatorFreq: number;
    /** Enemy-specific reaction type */
    enemyReaction: 'none' | 'torch_flicker' | 'ice_shiver' | 'arcane_pulse' | 'void_phase';
    /** Reaction intensity (0.0 to 1.0) */
    reactionIntensity: number;
  };
}
```

**Theme presets (5 themes + boss variant for each):**

```typescript
export const ATMOSPHERE_PRESETS: Record<FloorTheme, AtmosphereConfig> = {
  dust: {
    theme: 'dust',
    spriteTint: 0xFFDDBB,          // warm amber wash
    backgroundTint: 0xFFCCAA,
    cameraColorMatrix: { saturation: -0.1, brightness: 0.9 },
    shadowAlpha: 0.35,
    shadowTint: 0x1a0f05,
    aoStrength: 0.2,
    fogAlpha: 0.08,
    fogTint: 0xd4c4a0,
    particles: {
      type: 'dust',
      tints: [0xd4c4a0, 0xc8b888, 0xbca870, 0xe0d4b8],
      gravityY: 10,
      scaleRange: [0.1, 0.4],
      maxBack: 20,
      maxFront: 8,
      blendMode: 'NORMAL',
      lifespan: 6000,
      frequency: 300,
    },
    lightShafts: { enabled: true, count: 2, tint: 0xFFEECC, alpha: 0.15, angle: 10 },
    lighting: {
      ambientColor: 0x332211,
      lights: [
        { xPct: 0.2, yPct: 0.3, radius: 350, color: 0xff8833, intensity: 1.8, flicker: 0.15 },
        { xPct: 0.8, yPct: 0.5, radius: 250, color: 0xff9944, intensity: 1.2, flicker: 0.1 },
      ],
    },
    rim: { color: 0xff8833, intensity: 0.4, lightDir: [-0.7, -0.3] },
    parallax: { swayAmplitudeX: 3, swayAmplitudeY: 2, swayDuration: 5000 },
    haze: { enabled: false, strength: 0, yStart: 0 },
    microAnimation: { oscillatorFreq: 0.003, enemyReaction: 'torch_flicker', reactionIntensity: 0.3 },
  },

  embers: {
    theme: 'embers',
    spriteTint: 0xFFBB99,          // hot orange wash
    backgroundTint: 0xFFAA88,
    cameraColorMatrix: { saturation: 0.1, brightness: 0.85 },
    shadowAlpha: 0.25,
    shadowTint: 0x220808,
    aoStrength: 0.25,
    fogAlpha: 0.12,
    fogTint: 0xff6600,
    particles: {
      type: 'embers',
      tints: [0xfacc22, 0xf89800, 0xf83600, 0x9f0404],
      gravityY: -40,
      scaleRange: [0.15, 0.35],
      maxBack: 15,
      maxFront: 25,
      blendMode: 'ADD',
      lifespan: 2500,
      frequency: 100,
    },
    lightShafts: { enabled: false, count: 0, tint: 0, alpha: 0, angle: 0 },
    lighting: {
      ambientColor: 0x1a0500,
      lights: [
        { xPct: 0.5, yPct: 0.9, radius: 500, color: 0xff4400, intensity: 2.2, flicker: 0.25 },
        { xPct: 0.3, yPct: 0.4, radius: 200, color: 0xff8800, intensity: 1.5, flicker: 0.2 },
        { xPct: 0.7, yPct: 0.3, radius: 200, color: 0xff6600, intensity: 1.5, flicker: 0.2 },
      ],
    },
    rim: { color: 0xff4400, intensity: 0.6, lightDir: [0.0, 0.7] },
    parallax: { swayAmplitudeX: 2, swayAmplitudeY: 1, swayDuration: 4000 },
    haze: { enabled: true, strength: 0.005, yStart: 0.5 },
    microAnimation: { oscillatorFreq: 0.004, enemyReaction: 'torch_flicker', reactionIntensity: 0.5 },
  },

  ice: {
    theme: 'ice',
    spriteTint: 0xBBDDFF,          // cool blue wash
    backgroundTint: 0xAADDFF,
    cameraColorMatrix: { saturation: -0.15, brightness: 1.05 },
    shadowAlpha: 0.2,
    shadowTint: 0x051525,
    aoStrength: 0.15,
    fogAlpha: 0.15,
    fogTint: 0x88ccff,
    particles: {
      type: 'ice_crystals',
      tints: [0x88ccff, 0xaaddff, 0x66bbee, 0xcceeFF],
      gravityY: 5,
      scaleRange: [0.08, 0.3],
      maxBack: 25,
      maxFront: 10,
      blendMode: 'ADD',
      lifespan: 5000,
      frequency: 250,
    },
    lightShafts: { enabled: true, count: 1, tint: 0xAADDFF, alpha: 0.12, angle: -5 },
    lighting: {
      ambientColor: 0x0a1525,
      lights: [
        { xPct: 0.5, yPct: 0.1, radius: 500, color: 0x4488cc, intensity: 1.5 },
        { xPct: 0.2, yPct: 0.6, radius: 200, color: 0x66aadd, intensity: 0.8 },
      ],
    },
    rim: { color: 0x4488cc, intensity: 0.5, lightDir: [0.0, -0.8] },
    parallax: { swayAmplitudeX: 2, swayAmplitudeY: 1, swayDuration: 6000 },
    haze: { enabled: false, strength: 0, yStart: 0 },
    microAnimation: { oscillatorFreq: 0.002, enemyReaction: 'ice_shiver', reactionIntensity: 0.4 },
  },

  arcane: {
    theme: 'arcane',
    spriteTint: 0xDDCCEE,          // pale purple wash
    backgroundTint: 0xDDBBEE,
    cameraColorMatrix: { saturation: 0.05, brightness: 0.92 },
    shadowAlpha: 0.3,
    shadowTint: 0x110822,
    aoStrength: 0.2,
    fogAlpha: 0.1,
    fogTint: 0xcc88ff,
    particles: {
      type: 'arcane_runes',
      tints: [0xcc88ff, 0xaa66ee, 0xdd99ff, 0xee88cc],
      gravityY: -15,
      scaleRange: [0.1, 0.35],
      maxBack: 15,
      maxFront: 15,
      blendMode: 'ADD',
      lifespan: 4000,
      frequency: 200,
    },
    lightShafts: { enabled: true, count: 2, tint: 0xCC88FF, alpha: 0.1, angle: 0 },
    lighting: {
      ambientColor: 0x110822,
      lights: [
        { xPct: 0.5, yPct: 0.2, radius: 400, color: 0xcc88ff, intensity: 1.8 },
        { xPct: 0.15, yPct: 0.7, radius: 200, color: 0xaa66ee, intensity: 1.0 },
        { xPct: 0.85, yPct: 0.7, radius: 200, color: 0xdd99ff, intensity: 1.0 },
      ],
    },
    rim: { color: 0xcc88ff, intensity: 0.5, lightDir: [0.0, -0.6] },
    parallax: { swayAmplitudeX: 4, swayAmplitudeY: 2, swayDuration: 7000 },
    haze: { enabled: false, strength: 0, yStart: 0 },
    microAnimation: { oscillatorFreq: 0.0025, enemyReaction: 'arcane_pulse', reactionIntensity: 0.4 },
  },

  void: {
    theme: 'void',
    spriteTint: 0xCCAADD,          // dark purple wash
    backgroundTint: 0xBB99CC,
    cameraColorMatrix: { saturation: -0.25, brightness: 0.75 },
    shadowAlpha: 0.4,
    shadowTint: 0x0a0515,
    aoStrength: 0.3,
    fogAlpha: 0.2,
    fogTint: 0x6633aa,
    particles: {
      type: 'void_wisps',
      tints: [0x8844cc, 0x6633aa, 0xaa55dd, 0x442266],
      gravityY: -15,
      scaleRange: [0.12, 0.4],
      maxBack: 20,
      maxFront: 20,
      blendMode: 'ADD',
      lifespan: 3500,
      frequency: 150,
    },
    lightShafts: { enabled: false, count: 0, tint: 0, alpha: 0, angle: 0 },
    lighting: {
      ambientColor: 0x050210,
      lights: [
        { xPct: 0.5, yPct: 0.5, radius: 300, color: 0x8844cc, intensity: 2.0 },
        { xPct: 0.3, yPct: 0.2, radius: 150, color: 0x6633aa, intensity: 1.2 },
        { xPct: 0.7, yPct: 0.8, radius: 150, color: 0xaa55dd, intensity: 1.2 },
      ],
    },
    rim: { color: 0x8844cc, intensity: 0.7, lightDir: [0.3, -0.5] },
    parallax: { swayAmplitudeX: 5, swayAmplitudeY: 3, swayDuration: 8000 },
    haze: { enabled: true, strength: 0.003, yStart: 0.3 },
    microAnimation: { oscillatorFreq: 0.002, enemyReaction: 'void_phase', reactionIntensity: 0.5 },
  },
};
```

**Accessor functions:**

```typescript
export function getFloorTheme(floor: number): FloorTheme {
  if (floor <= 3) return 'dust';
  if (floor <= 6) return 'embers';
  if (floor <= 9) return 'ice';
  if (floor <= 12) return 'arcane';
  return 'void';
}

export function getAtmosphereConfig(floor: number): AtmosphereConfig {
  return ATMOSPHERE_PRESETS[getFloorTheme(floor)];
}

export function getBossAtmosphereConfig(floor: number): AtmosphereConfig {
  const base = { ...ATMOSPHERE_PRESETS[getFloorTheme(floor)] };
  // Boss encounters: stronger fog, more particles, higher light intensity
  base.fogAlpha = Math.min(base.fogAlpha * 1.5, 0.25);
  base.particles = { ...base.particles, maxBack: Math.round(base.particles.maxBack * 1.3), maxFront: Math.round(base.particles.maxFront * 1.3) };
  base.lighting = {
    ...base.lighting,
    lights: base.lighting.lights.map(l => ({ ...l, intensity: l.intensity * 1.2 })),
  };
  base.rim = { ...base.rim, intensity: Math.min(base.rim.intensity * 1.3, 1.0) };
  return base;
}
```

**File:** `src/data/roomAtmosphere.ts`

### 2. Refactor `CombatAtmosphereSystem.ts` to Consume the Config

Modify `src/game/systems/CombatAtmosphereSystem.ts` to:
- Remove its local `THEME_TINTS`, `getFloorTheme()`, and hardcoded gravity/lifespan values
- Import `getAtmosphereConfig()` from the new config file
- Consume `config.particles.*`, `config.fogAlpha`, `config.fogTint` instead of local constants
- Keep the existing fog rendering and particle spawning logic, just wire it to the new config
- Accept `isBoss: boolean` parameter to select boss variant

**Changes to `CombatAtmosphereSystem.ts`:**
- `constructor(scene, floor, isBoss)` now calls `getAtmosphereConfig(floor)` or `getBossAtmosphereConfig(floor)`
- `createFog()` reads `config.fogAlpha`, `config.fogTint`
- `spawnParticle()` reads `config.particles.tints`, `config.particles.gravityY`, etc.
- `getParticleBudget()` still respects device tier but caps at `config.particles.maxBack + config.particles.maxFront`

### 3. Export Config for Downstream Consumers

Ensure `roomAtmosphere.ts` exports everything needed:
- `AtmosphereConfig` type (for type-safe consumption in other systems)
- `getAtmosphereConfig(floor)` function
- `getBossAtmosphereConfig(floor)` function
- `getFloorTheme(floor)` function (migrated from CombatAtmosphereSystem)
- `ATMOSPHERE_PRESETS` (for debug/dev tools)
- `FloorTheme` type

### 4. Wire Config into CombatScene

In `src/game/scenes/CombatScene.ts`:
- Import `getAtmosphereConfig` and `AtmosphereConfig`
- Store `private atmosphereConfig: AtmosphereConfig` on the scene (set in `create()` or `setEnemy()`)
- Pass it to `CombatAtmosphereSystem` constructor
- Future ARs will consume `this.atmosphereConfig` for tinting, lighting, rim, etc.

### 5. Add `__terraDebug` Extension

In the dev debug output (`window.__terraDebug()`), include:
- `atmosphere.theme` — current floor theme name
- `atmosphere.floor` — floor number
- `atmosphere.particleBudget` — active particle budget
- `atmosphere.isBoss` — whether boss atmosphere is active

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/data/roomAtmosphere.ts` | **CREATE** | Master atmosphere config with types and presets |
| `src/game/systems/CombatAtmosphereSystem.ts` | **MODIFY** | Consume config instead of local constants |
| `src/game/scenes/CombatScene.ts` | **MODIFY** | Store and pass atmosphere config |
| `src/dev/debugPanel.ts` (or equivalent) | **MODIFY** | Add atmosphere debug info |

## Acceptance Criteria

- [ ] `AtmosphereConfig` type is exported and fully documented with JSDoc
- [ ] All 5 theme presets have complete, sensible values for every field
- [ ] `getBossAtmosphereConfig()` returns amplified version of base config
- [ ] `CombatAtmosphereSystem` no longer has ANY hardcoded theme values — all from config
- [ ] `getFloorTheme()` moved from CombatAtmosphereSystem to roomAtmosphere.ts (single source of truth)
- [ ] CombatScene stores `atmosphereConfig` and passes it to atmosphere system
- [ ] Fog and particles behave identically to before (no visual regression)
- [ ] `__terraDebug()` shows atmosphere theme info
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (no test regressions)
- [ ] Visual inspection confirms fog/particles unchanged from current behavior

## Verification Gate

1. `npm run typecheck` — clean
2. `npm run build` — clean
3. `npx vitest run` — all pass
4. Playwright visual inspection at floors 1, 5, 8, 10, 14 — fog and particles match current behavior
5. `window.__terraDebug()` shows correct atmosphere info per floor
6. Import `AtmosphereConfig` type in a test file to confirm it's properly exported

## Performance Notes

- Zero performance impact — this is a data restructuring, not new rendering
- Config objects are static (frozen at module level), no runtime allocation

## Design Decisions

- **Percentage-based light positions** (`xPct`, `yPct`) instead of absolute pixels — scales across portrait/landscape without conversion logic
- **Boss variant is computed, not stored** — avoids 5 duplicate config entries; boss simply amplifies base values
- **Particle config includes both back and front max counts** — AR-217 will split particles across two depth layers; the config already accounts for this split
- **All lighting values are pre-populated** even though Light2D isn't implemented yet (AR-219) — workers can read the config immediately when they start
