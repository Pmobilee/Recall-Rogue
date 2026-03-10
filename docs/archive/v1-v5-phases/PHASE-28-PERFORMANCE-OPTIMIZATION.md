# Phase 28: Performance & Optimization

**Status**: Not Started
**Priority**: P1 — Required before soft launch; 60 fps on mid-range is a ship blocker
**Estimated Effort**: 5-7 sprints across 7 sub-phases
**Dependencies**: Phases 7, 8, 9, 10, 17, 19, 20 complete
**Design Decisions**: DD-V2-182, DD-V2-186, DD-V2-188, DD-V2-189, DD-V2-190, DD-V2-191,
DD-V2-192, DD-V2-194, DD-V2-215, DD-V2-218, DD-V2-219, DD-V2-222, DD-V2-223, DD-V2-246
**Last Updated**: 2026-03-04

---

## Overview

Phase 28 brings Recall Rogue's rendering, memory, and network footprint within the budget
constraints defined at architecture time. The three primary targets:

1. **60 fps** on mid-range devices (Snapdragon 7xx / A14 class, 6 GB RAM) during active mining
2. **30 fps floor** on low-end devices (Snapdragon 6xx, 3 GB RAM) with quality-scaled settings
3. **< 500 KB gzipped** initial JS payload; GPU texture memory ≤ 80 MB across a 20-layer dive

The existing codebase accumulates rendering debt from Phases 7-27: `MineScene.ts`
calls `redrawAll()` every frame even when nothing changes (O(viewport_tiles) per frame instead
of O(changed_tiles)); `BiomeParticleManager` uses a hardcoded 50-particle cap regardless of
device capability; texture atlases load eagerly with no eviction; and the auto-save tick calls
`localStorage.setItem` synchronously with full JSON serialization every 30 ticks.

Phase 28 fixes all of these without restructuring the Phaser scene hierarchy or Svelte store
topology established in prior phases. Coding workers execute each sub-phase independently;
the phase is verified when all acceptance criteria and the full Verification Gate pass.

**Workers implementing this phase must**:
- Run `npm run typecheck` after every sub-phase before moving to the next
- Never remove the legacy `redrawAll()` path until the dirty-rect system passes visual tests
- Ask the user before installing any new npm packages (`rollup-plugin-visualizer`,
  `@fastify/compress`, `lz-string`)
- Read `src/game/scenes/MineScene.ts`, `src/data/balance.ts`, and
  `src/game/managers/BiomeParticleManager.ts` before editing them

---

## Sub-Phase Index

| Sub-Phase | Title | Primary Files | Effort |
|---|---|---|---|
| 28.1 | Device Tier Detection | `src/services/deviceTierService.ts` (new), `src/ui/stores/settings.ts`, `src/ui/components/Settings.svelte` | 0.5 sprint |
| 28.2 | Bundle Size Audit & Optimization | `vite.config.ts`, `src/game/phaserBundle.ts` (new), `src/services/factsDB.ts`, `package.json` | 1 sprint |
| 28.3 | Draw Call Profiling & Enforcement | `src/game/scenes/MineScene.ts`, `src/game/systems/DirtyRectTracker.ts` (new), `src/data/types.ts` | 2 sprints |
| 28.4 | Dirty-Rect Rendering | `src/game/scenes/MineScene.ts`, `src/game/systems/MineGenerator.ts` | 1 sprint |
| 28.5 | Memory Management | `src/game/systems/TextureAtlasLRU.ts` (new), `src/game/spriteManifest.ts`, `src/game/scenes/MineScene.ts` | 0.5 sprint |
| 28.6 | Asset Lazy Loading Pipeline | `src/services/factsDB.ts`, `src/game/spriteManifest.ts`, `src/ui/components/HubView.svelte` | 0.5 sprint |
| 28.7 | Performance Monitoring Dashboard | `src/ui/components/DevPanel.svelte`, `src/services/gpuMemoryService.ts` (new) | 0.5 sprint |

---

## Sub-Phase 28.1: Device Tier Detection

### Overview

Classify the player's device into one of three tiers at startup (DD-V2-215). All subsequent
sub-phases read from this classification to select appropriate quality budgets. Players can
override the auto-detected tier in Settings.

### Sub-Steps

**28.1.1** — Create `src/services/deviceTierService.ts`:

```typescript
/**
 * Device tier detection and quality preset service.
 * Tier is determined at startup and cached for the session.
 * Manual override is persisted in localStorage key 'device-tier-override'.
 *
 * Detection priority:
 *   1. Manual override (localStorage)
 *   2. navigator.deviceMemory  (Chromium Android; not available on iOS/Firefox)
 *   3. WEBGL_debug_renderer_info GPU string  (most reliable cross-platform)
 *   4. navigator.hardwareConcurrency  (coarse CPU-core proxy)
 *
 * DD-V2-215: low-end ≈ 3 GB RAM, mid ≈ 6 GB RAM, flagship ≈ 12 GB RAM.
 */

export type DeviceTier = 'low-end' | 'mid' | 'flagship'

export interface QualityPreset {
  particleBudget: number        // Total simultaneous particles across all emitters
  ambientParticleBudget: number // Sub-budget for biome ambient emitters
  tileResolution: 32 | 64      // Source texture pixel density (world size always 32px)
  animFrameInterval: number    // Animated tile update cadence (every N frames)
  maxAtlases: number           // Concurrent texture atlases in GPU (DD-V2-189)
  fogResolution: 0.5 | 1.0    // Fog RenderTexture scale factor
}

const PRESETS: Record<DeviceTier, QualityPreset> = {
  'low-end': {
    particleBudget: 40,
    ambientParticleBudget: 10,
    tileResolution: 32,
    animFrameInterval: 6,
    maxAtlases: 2,
    fogResolution: 0.5,
  },
  'mid': {
    particleBudget: 80,
    ambientParticleBudget: 20,
    tileResolution: 32,
    animFrameInterval: 4,
    maxAtlases: 3,
    fogResolution: 1.0,
  },
  'flagship': {
    particleBudget: 150,
    ambientParticleBudget: 50,
    tileResolution: 64,
    animFrameInterval: 2,
    maxAtlases: 3,
    fogResolution: 1.0,
  },
}

let _cached: DeviceTier | null = null

/** Returns the device tier. Cached after first call. */
export function getDeviceTier(): DeviceTier {
  if (_cached) return _cached
  const override = localStorage.getItem('device-tier-override') as DeviceTier | null
  if (override && override in PRESETS) { _cached = override; return _cached }
  _cached = detectTier()
  return _cached
}

/** Sets or clears a manual quality override. Invalidates the cache. */
export function setDeviceTierOverride(tier: DeviceTier | null): void {
  tier ? localStorage.setItem('device-tier-override', tier)
       : localStorage.removeItem('device-tier-override')
  _cached = null
}

/** Returns the quality preset for the current (or specified) tier. */
export function getQualityPreset(tier?: DeviceTier): QualityPreset {
  return PRESETS[tier ?? getDeviceTier()]
}

/** Human-readable label for the Settings UI dropdown. */
export function getTierLabel(tier: DeviceTier): string {
  const labels: Record<DeviceTier, string> = {
    'low-end': 'Low (Battery Saver)',
    'mid': 'Medium (Balanced)',
    'flagship': 'High (Max Quality)',
  }
  return labels[tier]
}

function detectTier(): DeviceTier {
  const mem = (navigator as any).deviceMemory as number | undefined
  if (mem !== undefined) {
    if (mem >= 8) return 'flagship'
    if (mem >= 4) return 'mid'
    return 'low-end'
  }
  const gpu = probeGPU()
  if (gpu !== 'mid') return gpu
  const cores = navigator.hardwareConcurrency ?? 4
  if (cores >= 8) return 'flagship'
  if (cores >= 6) return 'mid'
  return 'low-end'
}

function probeGPU(): DeviceTier {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
    if (!gl) return 'mid'
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
    if (!ext) return 'mid'
    const r = ((gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string ?? '').toLowerCase()
    if (/adreno 7[3-9]\d|adreno [89]\d\d|apple gpu|m[123]|rtx|rx [67]\d\d\d/.test(r)) return 'flagship'
    if (/adreno [23]\d\d|mali-[gt][5-7]\d|powervr|intel hd [45]/.test(r)) return 'low-end'
    return 'mid'
  } catch (_) { return 'mid' }
}
```

**28.1.2** — In `src/ui/stores/settings.ts`, add:

```typescript
import { getDeviceTier, setDeviceTierOverride, type DeviceTier } from '../../services/deviceTierService'
export const deviceTierOverride = writable<DeviceTier | null>(null)
deviceTierOverride.subscribe((t) => setDeviceTierOverride(t))
```

**28.1.3** — In `src/ui/components/Settings.svelte`, add a "Performance" section inside the
existing settings panel (find the closing `</main>` or last `<section>` and add before it):

```svelte
<section class="settings-section">
  <h3>Performance</h3>
  <p class="setting-hint">Auto-detected: {getTierLabel(getDeviceTier())}</p>
  <label>
    Quality Preset
    <select bind:value={$deviceTierOverride}>
      <option value={null}>Auto ({getTierLabel(getDeviceTier())})</option>
      <option value="low-end">{getTierLabel('low-end')}</option>
      <option value="mid">{getTierLabel('mid')}</option>
      <option value="flagship">{getTierLabel('flagship')}</option>
    </select>
  </label>
  <p class="setting-hint">Changes apply after restarting the game.</p>
</section>
```

Add the required imports to the `<script lang="ts">` block of `Settings.svelte`:
```typescript
import { getDeviceTier, getTierLabel } from '../../services/deviceTierService'
import { deviceTierOverride } from '../stores/settings'
```

### Acceptance Criteria

- `src/services/deviceTierService.ts` exists and exports `getDeviceTier`, `setDeviceTierOverride`, `getQualityPreset`, `getTierLabel`
- `deviceTierOverride` store exists in `src/ui/stores/settings.ts`
- Settings page renders a "Performance" section with a 4-option dropdown
- Selecting "Low (Battery Saver)" and reloading causes `getDeviceTier()` to return `'low-end'`
- `npm run typecheck` passes

---

## Sub-Phase 28.2: Bundle Size Audit & Optimization

### Overview

Reduce the initial JS payload to meet DD-V2-218 (< 500 KB gzipped, main chunk < 200 KB gzipped).
Phaser is ~1 MB minified; tree-shaking unused modules and converting the sql.js import to a
dynamic import are the primary levers.

### Sub-Steps

**28.2.1** — Ask the user for approval to install `rollup-plugin-visualizer` as a dev dependency
before running `npm install`. Once approved, add to `vite.config.ts`:

```typescript
import { visualizer } from 'rollup-plugin-visualizer'

// In the plugins array, add conditionally so it only runs during analysis:
...(process.env.ANALYZE === 'true' ? [
  visualizer({ filename: 'docs/perf/bundle-report.html', gzipSize: true, template: 'treemap' })
] : []),
```

Add to `package.json` scripts:
```json
"analyze": "ANALYZE=true npm run build"
```

**28.2.2** — Create `src/game/phaserBundle.ts`. This file re-exports Phaser's default namespace
(preserving `Phaser.X.Y` type usages across all scenes) while allowing named-export tree-shaking:

```typescript
/**
 * Custom Phaser entry point for Recall Rogue.
 * Re-exporting default preserves Phaser.X.Y namespace types used throughout the codebase.
 * Named re-exports allow Rollup to tree-shake unused modules (Matter.js, Spine, DOM plugin).
 *
 * Excluded (not used by Recall Rogue):
 *   Matter.js physics, Arcade physics, Facebook Instant Games, Spine, Rope game object,
 *   Impact physics, DOM element plugin, Bitmap mask (we use geometry mask for fog only)
 *
 * DD-V2-218: Initial JS bundle < 500 KB gzipped.
 */
import Phaser from 'phaser'
export default Phaser
export * from 'phaser'
```

Do NOT perform a codebase-wide `import` replacement automatically. Instead, add the new file and
verify it typechecks cleanly. Replacing `import Phaser from 'phaser'` with
`import Phaser from './phaserBundle'` (or the appropriate relative path) can be done incrementally
as a follow-up once the bundle-size benefit is confirmed via `npm run analyze`.

**28.2.3** — In `src/services/factsDB.ts`, convert the top-level static import of sql.js to a
lazy dynamic import. The facts DB is not needed until the player's first quiz (30+ seconds into
a session), so this defers ~300 KB of WASM from the critical path:

```typescript
// Before (static import — included in initial bundle):
// import initSqlJs from 'sql.js'

// After (lazy — loaded on first call to factsDB.init()):
type SqlJsStatic = typeof import('sql.js')['default']
let _initSqlJs: SqlJsStatic | null = null

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!_initSqlJs) {
    const mod = await import('sql.js')
    _initSqlJs = mod.default
  }
  return _initSqlJs
}
```

Update all internal callers that previously referenced the static `initSqlJs` to call
`await getSqlJs()` instead. Ensure `factsDB.init()` is already async (it should be from
Phase 11 implementation).

**28.2.4** — In `vite.config.ts`, extend `rollupOptions.output.manualChunks` to split
social/seasonal features into lazy chunks that are never fetched during the core game loop:

```typescript
manualChunks(id) {
  if (id.includes('DevPanel'))  return 'dev'      // Never loaded in production
  if (id.includes('phaser'))    return 'phaser'   // Already split; confirm here
  if (id.includes('sql.js'))    return 'sql-wasm' // Already split; confirm here
  // Social features — only loaded when social tab is opened in hub
  if (id.includes('GuildView') || id.includes('DuelView') || id.includes('LeaderboardView')) {
    return 'social'
  }
  // Season pass UI — only loaded on season pass screen
  if (id.includes('SeasonPass') || id.includes('SeasonBanner')) return 'seasons'
},
```

### Acceptance Criteria

- `npm run analyze` produces `docs/perf/bundle-report.html`
- `npm run build` completes with no chunk-size warnings (Vite default threshold: 500 KB)
- `src/services/factsDB.ts` uses dynamic import for sql.js
- `src/game/phaserBundle.ts` exists and typechecks cleanly
- `npm run typecheck` passes with zero errors

---

## Sub-Phase 28.3: Draw Call Profiling & Enforcement

### Overview

Enforce DD-V2-186 (≤ 50 draw calls per frame on mobile). The current `MineScene.ts` calls
`redrawAll()` every frame from `update()`, which iterates all visible tiles via a `Graphics`
object — far exceeding the 50-call budget. This sub-phase introduces `DirtyRectTracker` and
pre-computes autotile bitmasks to eliminate redundant per-frame work.

### Sub-Steps

**28.3.1** — Create `src/game/systems/DirtyRectTracker.ts`:

```typescript
/**
 * Tracks which mine tiles have changed since the last render pass.
 * Consumers call markDirty() when a tile changes, then consumeDirty() each frame
 * to get the minimal set of tiles to redraw.
 *
 * When tile (x, y) is marked dirty, all 8 neighbors are also marked dirty because
 * autotile bitmask computation reads neighbor types. (DD-V2-194)
 *
 * Key contract: consumeDirty() is called exactly once per frame by MineScene.update().
 * All markDirty() calls between frames accumulate in the set.
 */
export interface DirtyTile { x: number; y: number }

export class DirtyRectTracker {
  private dirty = new Set<number>()
  private width: number
  private height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  /** Marks tile (x, y) and its 8 neighbors dirty. Out-of-bounds coordinates are ignored. */
  markDirty(x: number, y: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx; const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < this.width && ny < this.height) {
          this.dirty.add(ny * this.width + nx)
        }
      }
    }
  }

  /** Marks a rectangular region dirty (e.g. after BFS flood-fill reveals a large area). */
  markRegionDirty(x: number, y: number, w: number, h: number): void {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (tx >= 0 && ty >= 0 && tx < this.width && ty < this.height) {
          this.dirty.add(ty * this.width + tx)
        }
      }
    }
  }

  /** Marks every tile dirty. Call on layer load or after a tileset change. */
  markAllDirty(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.dirty.add(y * this.width + x)
      }
    }
  }

  /**
   * Returns the current dirty set and clears it.
   * Called once per frame by MineScene.update().
   */
  consumeDirty(): DirtyTile[] {
    const result: DirtyTile[] = []
    for (const key of this.dirty) {
      result.push({ x: key % this.width, y: Math.floor(key / this.width) })
    }
    this.dirty.clear()
    return result
  }

  /** Number of pending dirty tiles — for DevPanel diagnostics. */
  get pendingCount(): number { return this.dirty.size }

  /** Resets tracker for new grid dimensions (called on layer transition). */
  reset(width: number, height: number): void {
    this.width = width; this.height = height; this.dirty.clear()
  }
}
```

**28.3.2** — Add optional fields to `MineCell` in `src/data/types.ts`:

```typescript
// Inside the MineCell interface (or wherever MineCell is defined):
/** Pre-computed autotile bitmask. Cached at generation; invalidated when tile changes. */
autotileBitmask?: number
/** Sprite key derived from autotileBitmask. Avoids bitmask recomputation on every draw. */
cachedSpriteKey?: string
```

**28.3.3** — In `src/game/systems/MineGenerator.ts`, add a bitmask pre-computation pass at the
end of `generateMine()`. Import `isAutotiledBlock`, `getAutotileGroup`, `bitmaskToSpriteKey` from
`AutotileSystem.ts`:

```typescript
/**
 * Pre-computes autotile bitmasks for the entire grid immediately after generation.
 * Runs O(W×H) once, saving O(viewport_tiles) recomputation every frame.
 * Results stored in cell.autotileBitmask and cell.cachedSpriteKey.
 */
function precomputeAutotileBitmasks(grid: MineCell[][], W: number, H: number): void {
  const DIRS = [
    { dx: 0, dy: -1, bit: 8 },  // N
    { dx: 1, dy:  0, bit: 4 },  // E
    { dx: 0, dy:  1, bit: 2 },  // S
    { dx: -1, dy: 0, bit: 1 },  // W
  ]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = grid[y][x]
      if (!isAutotiledBlock(cell.type)) continue
      const group = getAutotileGroup(cell.type)
      let mask = 0
      for (const { dx, dy, bit } of DIRS) {
        const nx = x + dx; const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) { mask |= bit; continue }
        if (getAutotileGroup(grid[ny][nx].type) === group) mask |= bit
      }
      cell.autotileBitmask = mask
      cell.cachedSpriteKey = bitmaskToSpriteKey(cell.type, mask)
    }
  }
}

// Add at the end of generateMine(), before returning:
precomputeAutotileBitmasks(grid, width, height)
```

**28.3.4** — In `MineScene.ts`, add the following fields alongside the existing Graphics fields:

```typescript
private dirtyTracker: import('../systems/DirtyRectTracker').DirtyRectTracker | null = null
private animFrameCounter = 0
private animFrameInterval: number = 4  // Updated in create() from device tier
```

In `create()`, after the grid is generated, initialize the tracker:

```typescript
import { DirtyRectTracker } from '../systems/DirtyRectTracker'
import { getQualityPreset } from '../../services/deviceTierService'

// In create():
this.animFrameInterval = getQualityPreset().animFrameInterval
this.dirtyTracker = new DirtyRectTracker(this.gridWidth, this.gridHeight)
this.dirtyTracker.markAllDirty()
```

**28.3.5** — Modify `MineScene.update()`. Replace the unconditional `this.redrawAll()` call with
the dirty-rect dispatch. Keep `redrawAll()` as a fallback behind a feature flag until visual
tests pass:

```typescript
update(_time: number, delta: number): void {
  this.animatedTileSystem?.update(delta)
  this.pinchZoom?.update()
  this.particles?.update()

  if (this.dirtyTracker) {
    const dirty = this.dirtyTracker.consumeDirty()
    if (dirty.length > 0) {
      this.updateDirtyTiles(dirty)
    }
    // Animated tiles update at reduced cadence
    this.animFrameCounter = (this.animFrameCounter + 1) % this.animFrameInterval
    if (this.animFrameCounter === 0) this.updateAnimatedTiles()
  } else {
    // Legacy full-redraw path — remove once dirty-rect system passes visual tests
    this.redrawAll()
  }

  this.drawPlayer()
  miniMapData.set({ grid: this.grid, playerX: this.player.gridX, playerY: this.player.gridY })
}
```

**28.3.6** — Replace every `this.redrawAll()` call in `MineScene.ts` that is triggered by a
state change (not in `update()`) with the appropriate `markDirty` call. Use
`grep -n "redrawAll" src/game/scenes/MineScene.ts` to enumerate all occurrences before editing.

Mapping rules:
- After `mineBlock(x, y)` → `this.dirtyTracker?.markDirty(x, y)`
- After `revealAround(x, y)` → `this.dirtyTracker?.markRegionDirty(x - 2, y - 2, 5, 5)`
- After layer load / transition → `this.dirtyTracker?.markAllDirty()`
- After hazard activation at `(hx, hy)` → `this.dirtyTracker?.markDirty(hx, hy)`
- After consumable use affecting multiple tiles → `this.dirtyTracker?.markAllDirty()`

Add `updateDirtyTiles(tiles: DirtyTile[])` to `MineScene`:

```typescript
private updateDirtyTiles(tiles: import('../systems/DirtyRectTracker').DirtyTile[]): void {
  for (const { x, y } of tiles) {
    const cell = this.grid[y]?.[x]
    if (!cell) continue
    const px = x * TILE_SIZE; const py = y * TILE_SIZE
    // Clear just this tile's region on tileGraphics before redrawing
    this.tileGraphics.fillStyle(0x000000, 0)
    this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
    if (cell.revealed) this.drawBlockPattern(cell, x, y, px, py)
  }
}
```

When a tile changes, invalidate its cached bitmask and those of its 8 neighbors so they
are recomputed on the next dirty-tile draw:

```typescript
// After mineBlock() changes grid[y][x]:
this.grid[y][x].cachedSpriteKey = undefined
this.grid[y][x].autotileBitmask = undefined
// DirtyRectTracker.markDirty already marks neighbors dirty; they recompute on next draw
```

In `drawBlockPattern()`, use the cached key when present:

```typescript
const spriteKey = cell.cachedSpriteKey ?? (() => {
  const mask = computeBitmaskForCell(this.grid, x, y, this.gridWidth, this.gridHeight)
  const key = bitmaskToSpriteKey(cell.type, mask)
  cell.cachedSpriteKey = key  // Cache for next frame if this tile is dirty again
  return key
})()
```

### Acceptance Criteria

- `src/game/systems/DirtyRectTracker.ts` exists and exports `DirtyRectTracker`, `DirtyTile`
- `MineCell` in `src/data/types.ts` has `autotileBitmask?: number` and `cachedSpriteKey?: string`
- `MineGenerator.ts` calls `precomputeAutotileBitmasks()` at end of `generateMine()`
- `MineScene.update()` does NOT call `redrawAll()` unconditionally — dirty tiles only
- Draw call count visible in DevPanel (sub-phase 28.7) is ≤ 50 during mining
- `npm run typecheck` passes

---

## Sub-Phase 28.4: Dirty-Rect Rendering for Static Mine Tiles

### Overview

With `DirtyRectTracker` in place (28.3), this sub-phase adds fog-of-war as a
`RenderTexture` overlay updated only for revealed tiles, and adds a feature flag
(`useDirtyRect`) that enables the new path while keeping the legacy `redrawAll()` available
for debugging. Once visual tests pass, the legacy path can be removed.

### Sub-Steps

**28.4.1** — Add fog `RenderTexture` fields to `MineScene.ts`:

```typescript
private fogRenderTexture: Phaser.GameObjects.RenderTexture | null = null
private useDirtyRect = true  // Set false to revert to legacy path
```

**28.4.2** — In `MineScene.create()` (or the layer-init function called from it), after grid
generation, create and fully paint the fog texture:

```typescript
private initFogTexture(): void {
  const W = this.gridWidth; const H = this.gridHeight; const TS = TILE_SIZE
  this.fogRenderTexture?.destroy()
  this.fogRenderTexture = this.add.renderTexture(0, 0, W * TS, H * TS)
  this.fogRenderTexture.setDepth(7)  // Above tiles, below HUD
  // Fill fully opaque black; revealed cells are erased below
  this.fogRenderTexture.fill(0x000000, 1.0)
  // Paint initial visibility state
  this.repaintFogFull()
}

private repaintFogFull(): void {
  if (!this.fogRenderTexture) return
  const TS = TILE_SIZE
  this.fogRenderTexture.beginDraw()
  for (let y = 0; y < this.gridHeight; y++) {
    for (let x = 0; x < this.gridWidth; x++) {
      this.applyFogCell(x, y)
    }
  }
  this.fogRenderTexture.endDraw()
}

private updateFogForTiles(tiles: import('../systems/DirtyRectTracker').DirtyTile[]): void {
  if (!this.fogRenderTexture) return
  this.fogRenderTexture.beginDraw()
  for (const { x, y } of tiles) this.applyFogCell(x, y)
  this.fogRenderTexture.endDraw()
}

private applyFogCell(x: number, y: number): void {
  const cell = this.grid[y]?.[x]; if (!cell) return
  const px = x * TILE_SIZE; const py = y * TILE_SIZE
  if (cell.revealed) {
    // Erase fog: draw transparent pixel at this tile position
    this.fogRenderTexture!.erase('fog_solid', px, py)
  } else if (cell.visibilityLevel === 1) {
    // Semi-transparent: player can see silhouette only
    this.fogRenderTexture!.draw('fog_semi', px, py)
  } else {
    this.fogRenderTexture!.draw('fog_solid', px, py)
  }
}
```

Note: `'fog_solid'` and `'fog_semi'` must be pre-loaded as 32×32 textures in `BootScene.ts`
or `MineScene.preload()`. Create them programmatically if no asset files exist:

```typescript
// In MineScene.create(), before initFogTexture():
if (!this.textures.exists('fog_solid')) {
  const g = this.make.graphics({ x: 0, y: 0, add: false })
  g.fillStyle(0x000000, 1.0); g.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  g.generateTexture('fog_solid', TILE_SIZE, TILE_SIZE); g.destroy()
}
if (!this.textures.exists('fog_semi')) {
  const g = this.make.graphics({ x: 0, y: 0, add: false })
  g.fillStyle(0x000000, 0.45); g.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  g.generateTexture('fog_semi', TILE_SIZE, TILE_SIZE); g.destroy()
}
```

**28.4.3** — Call `updateFogForTiles(dirty)` in `update()` alongside `updateDirtyTiles()`:

```typescript
if (this.useDirtyRect && this.dirtyTracker) {
  const dirty = this.dirtyTracker.consumeDirty()
  if (dirty.length > 0) {
    this.updateDirtyTiles(dirty)
    this.updateFogForTiles(dirty)
  }
  // ...
} else {
  this.redrawAll()
}
```

**28.4.4** — On layer transition (when `loadLayer()` or equivalent is called), call:

```typescript
this.dirtyTracker?.reset(this.gridWidth, this.gridHeight)
this.dirtyTracker?.markAllDirty()
this.repaintFogFull()
```

### Acceptance Criteria

- Fog of war renders correctly: unrevealed tiles fully black, ring-1 adjacent tiles at ~45% alpha, revealed tiles clear
- Mining a block reveals its neighbors without any visual artifacts
- Layer transition resets fog correctly (new layer starts fully fogged)
- `fogRenderTexture` is a single Phaser `RenderTexture` — not recreated per-frame
- `npm run typecheck` passes

---

## Sub-Phase 28.5: Memory Management (Texture Atlas Pooling)

### Overview

Enforce DD-V2-189 (≤ 3 simultaneous atlases in GPU) and DD-V2-192 (≤ 80 MB GPU texture memory)
via an LRU cache that evicts the least-recently-used biome atlas on transition.

### Sub-Steps

**28.5.1** — Create `src/game/systems/TextureAtlasLRU.ts`:

```typescript
/**
 * LRU cache for Phaser texture atlases.
 * Enforces max-atlas count (DD-V2-189) and calls scene.textures.remove() on eviction
 * so the GPU VRAM is freed immediately (not deferred to GC).
 *
 * Usage:
 *   const lru = new TextureAtlasLRU(scene, 3)
 *   await lru.ensureLoaded('mine_atlas_volcanic', '/assets/atlases/volcanic.json', '/assets/atlases/volcanic.webp')
 *   // ... use textures ...
 *   lru.evictAll()  // Call in MineScene.shutdown()
 */
import type Phaser from 'phaser'

interface AtlasEntry { key: string; lastUsed: number }

export class TextureAtlasLRU {
  private entries: Map<string, AtlasEntry> = new Map()
  constructor(private scene: Phaser.Scene, private maxAtlases = 3) {}

  async ensureLoaded(key: string, jsonUrl: string, imageUrl: string): Promise<void> {
    if (this.entries.has(key)) {
      this.entries.get(key)!.lastUsed = Date.now()
      return
    }
    while (this.entries.size >= this.maxAtlases) this.evictLRU()

    await new Promise<void>((resolve, reject) => {
      if (this.scene.textures.exists(key)) { resolve(); return }
      this.scene.load.atlas(key, imageUrl, jsonUrl)
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, resolve)
      this.scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, reject)
      this.scene.load.start()
    })
    this.entries.set(key, { key, lastUsed: Date.now() })
  }

  private evictLRU(): void {
    let oldest: string | null = null; let oldestTime = Infinity
    for (const [k, e] of this.entries) {
      if (e.lastUsed < oldestTime) { oldestTime = e.lastUsed; oldest = k }
    }
    if (oldest) {
      if (this.scene.textures.exists(oldest)) this.scene.textures.remove(oldest)
      this.entries.delete(oldest)
    }
  }

  evictAll(): void {
    for (const key of this.entries.keys()) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    }
    this.entries.clear()
  }

  get count(): number { return this.entries.size }
}
```

**28.5.2** — Add `getBiomeAtlasUrl()` to `src/game/spriteManifest.ts`:

```typescript
/**
 * Returns the CDN-relative URLs for a biome's packed texture atlas.
 * Atlas files are generated by the ComfyUI sprite pipeline and packed via scripts/pack-atlas.mjs.
 * Naming convention: mine_atlas_<biomeId>.{json,webp}
 *
 * DD-V2-189: TextureAtlasLRU enforces the 3-atlas max; this function provides the URLs.
 */
export function getBiomeAtlasUrl(biomeId: string): { json: string; image: string } {
  const base = import.meta.env.VITE_ASSET_BASE_URL ?? ''
  return {
    json:  `${base}/assets/atlases/mine_atlas_${biomeId}.json`,
    image: `${base}/assets/atlases/mine_atlas_${biomeId}.webp`,
  }
}

export function getBiomeAtlasKey(biomeId: string): string {
  return `mine_atlas_${biomeId}`
}
```

**28.5.3** — Add `atlasLRU` to `MineScene.ts` and call `ensureLoaded` on biome transition:

```typescript
import { TextureAtlasLRU } from '../systems/TextureAtlasLRU'
import { getBiomeAtlasKey, getBiomeAtlasUrl } from '../spriteManifest'
import { getQualityPreset } from '../../services/deviceTierService'

// Field:
private atlasLRU: TextureAtlasLRU | null = null

// In create():
this.atlasLRU = new TextureAtlasLRU(this, getQualityPreset().maxAtlases)

// On biome transition (call this before loading new biome's tiles):
async loadBiomeAtlas(biomeId: string): Promise<void> {
  if (!this.atlasLRU) return
  const { json, image } = getBiomeAtlasUrl(biomeId)
  await this.atlasLRU.ensureLoaded(getBiomeAtlasKey(biomeId), json, image)
}

// In MineScene.shutdown():
shutdown(): void {
  this.atlasLRU?.evictAll()
  // ... existing cleanup ...
}
```

**28.5.4** — Extend `LootPopSystem.ts` with an object pool to prevent GC pressure from
rapid create/destroy cycles during fast mining:

```typescript
private pool: Phaser.GameObjects.Image[] = []

private acquire(key: string, x: number, y: number): Phaser.GameObjects.Image {
  const img = this.pool.pop()
  if (img) return img.setTexture(key).setPosition(x, y).setVisible(true).setActive(true)
  return this.scene.add.image(x, y, key)
}

private release(img: Phaser.GameObjects.Image): void {
  img.setVisible(false).setActive(false)
  if (this.pool.length < 50) this.pool.push(img)
  else img.destroy()
}
```

### Acceptance Criteria

- `src/game/systems/TextureAtlasLRU.ts` exports `TextureAtlasLRU`
- `MineScene` creates `TextureAtlasLRU` in `create()` and calls `evictAll()` in `shutdown()`
- `src/game/spriteManifest.ts` exports `getBiomeAtlasKey()` and `getBiomeAtlasUrl()`
- `LootPopSystem` uses a pool capped at 50 instances
- `npm run typecheck` passes

---

## Sub-Phase 28.6: Asset Lazy Loading Pipeline

### Overview

Several heavy assets are currently loaded eagerly or in-line at scene start. This sub-phase
defers loading to the point of first use and pre-warms the next biome's atlas while the player
is still on the current layer.

### Sub-Steps

**28.6.1** — In `MineScene.ts`, when the player mines the `DescentShaft` block (triggering the
descent prompt), begin loading the next layer's biome atlas in the background so it is ready
by the time the player confirms descent:

```typescript
// Inside the DescentShaft interaction handler (search for DescentShaft in MineScene.ts):
const nextBiome = this.biomeSequence[this.currentLayer + 1]
if (nextBiome) {
  // Pre-warm the next biome atlas while player reads descent confirmation
  void this.loadBiomeAtlas(nextBiome.id)
}
```

**28.6.2** — In `src/ui/components/HubView.svelte`, convert social-tab imports to dynamic so
they are not bundled into the hub's initial render. Find the social-tab conditional block and
replace static imports with `{#await}`:

```svelte
<!-- Before: static import at top of <script> -->
<!-- After: dynamic import on first tab open -->
{#if activeTab === 'social'}
  {#await import('./GuildView.svelte') then { default: GuildView }}
    <GuildView />
  {/await}
{/if}
```

Apply the same pattern to `DuelView.svelte` and `LeaderboardView.svelte` if they exist as
separate component files.

**28.6.3** — Ensure the service worker (`public/sw.js`) pre-caches only the first biome's
atlas at install time. Additional biome atlases are fetched and cached on first access:

```js
// In sw.js install handler — update PRECACHE_URLS:
const PRECACHE_URLS = [
  '/',
  '/index.html',
  // Only the first (shallow-tier) biome atlas is precached
  // Others are cached lazily via the stale-while-revalidate strategy
  '/assets/atlases/mine_atlas_surface.json',
  '/assets/atlases/mine_atlas_surface.webp',
]
```

**28.6.4** — Add a `WebP` support detection helper to `src/game/spriteManifest.ts` for future
use when WebP-converted UI icon assets are generated:

```typescript
/** Detects WebP support at runtime. True on Chrome/Edge/Firefox 65+; false on older Safari. */
export function supportsWebP(): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    return c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch (_) { return false }
}
```

### Acceptance Criteria

- Descending to a new layer does not cause a visible stall from atlas loading (atlas is pre-warmed)
- Social tab components load on first open, not at hub initialization
- `supportsWebP()` exported from `spriteManifest.ts`
- `npm run typecheck` passes

---

## Sub-Phase 28.7: Performance Monitoring Dashboard (Dev-Only)

### Overview

Add a live performance overlay to `DevPanel.svelte` that shows FPS, draw calls, active sprites,
GPU texture memory, JS heap, dirty tile count, and save size. This overlay is dev-only
(`import.meta.env.DEV` guard) and is used during playtesting to verify all budget constraints.

### Sub-Steps

**28.7.1** — Create `src/services/gpuMemoryService.ts`:

```typescript
/**
 * GPU texture memory query via the GMAN_webgl_memory WebGL extension.
 * Available in Chrome 91+ (and Chromium-based browsers on Android).
 * Falls back gracefully when the extension is unavailable.
 *
 * DD-V2-192: 80 MB GPU texture memory budget.
 */

export interface GpuMemoryInfo {
  textureBytes: number      // Current GPU texture memory in bytes (0 if unavailable)
  atlasCount: number        // Number of texture objects loaded
  extensionAvailable: boolean
}

let _gl: WebGLRenderingContext | WebGL2RenderingContext | null = null
let _ext: any = null

/** Initialize with the Phaser WebGL renderer's gl context. Call after game.renderer is ready. */
export function initGpuMemoryTracking(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  _gl = gl; _ext = gl.getExtension('GMAN_webgl_memory') ?? null
}

/** Query current GPU texture memory usage. */
export function queryGpuMemory(): GpuMemoryInfo {
  if (!_ext) return { textureBytes: 0, atlasCount: 0, extensionAvailable: false }
  try {
    const info = _ext.getMemoryInfo()
    return {
      textureBytes: info.resources?.texture ?? 0,
      atlasCount: info.resources?.textureCount ?? 0,
      extensionAvailable: true,
    }
  } catch (_) { return { textureBytes: 0, atlasCount: 0, extensionAvailable: false } }
}

export const GPU_WARN_BYTES = 60 * 1024 * 1024   // 60 MB soft warning
export const GPU_HARD_BYTES = 80 * 1024 * 1024   // 80 MB hard limit (DD-V2-192)
export function isGpuOverBudget(): boolean { return queryGpuMemory().textureBytes > GPU_HARD_BYTES }
```

In `src/game/GameManager.ts` (or wherever `game.renderer` is accessible after Phaser boot),
call `initGpuMemoryTracking(game.renderer.gl)` once after the renderer initializes.

**28.7.2** — Extend `src/ui/components/DevPanel.svelte`. In the `<script lang="ts">` block,
add a performance stats section. The existing `DevPanel` has `sectionsOpen.debug`; add stats
tracking to the debug section:

```typescript
// Add to DevPanel.svelte <script lang="ts">:
import { queryGpuMemory } from '../../services/gpuMemoryService'

interface PerfStats {
  fps: number
  drawCalls: number
  sprites: number
  gpuMB: number
  heapMB: number
  dirtyTiles: number
  saveSizeKB: number
}
let perfStats = $state<PerfStats>({ fps: 0, drawCalls: 0, sprites: 0, gpuMB: 0, heapMB: 0, dirtyTiles: 0, saveSizeKB: 0 })
let perfInterval: ReturnType<typeof setInterval> | null = null

function startPerfPolling(): void {
  if (perfInterval) return
  perfInterval = setInterval(() => {
    const gm = getGM()
    const game = (gm as any)?.game as Phaser.Game | undefined
    if (!game) return
    const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined
    const fps = Math.round(game.loop.actualFps)
    const drawCalls = renderer?.drawCount ?? 0
    let sprites = 0
    game.scene.scenes.forEach((s) => { sprites += s.children?.length ?? 0 })
    const gpu = queryGpuMemory()
    const gpuMB = gpu.textureBytes / 1024 / 1024
    const heapMB = (performance as any).memory?.usedJSHeapSize / 1024 / 1024 ?? 0
    // Dirty tile count: read from MineScene if accessible
    const mineScene = game.scene.getScene('MineScene') as any
    const dirtyTiles = mineScene?.dirtyTracker?.pendingCount ?? 0
    // Save size from localStorage
    const raw = localStorage.getItem('recall-rogue-save') ?? ''
    const saveSizeKB = Math.round(raw.length / 1024)
    perfStats = { fps, drawCalls, sprites, gpuMB, heapMB, dirtyTiles, saveSizeKB }
  }, 500)
}

function stopPerfPolling(): void {
  if (perfInterval) { clearInterval(perfInterval); perfInterval = null }
}

$effect(() => {
  if (open && sectionsOpen.debug) startPerfPolling()
  else stopPerfPolling()
})
```

**28.7.3** — Add the HTML template for the perf overlay inside the debug section in `DevPanel.svelte`:

```svelte
{#if sectionsOpen.debug}
  <div class="perf-overlay" style="font-family: monospace; font-size: 12px; line-height: 1.6">
    <div class:warn={perfStats.fps < 30} class:ok={perfStats.fps >= 55}>
      FPS: {perfStats.fps} {perfStats.fps >= 55 ? '✓' : perfStats.fps >= 30 ? '⚠' : '✗'}
    </div>
    <div class:warn={perfStats.drawCalls > 50}>
      Draw calls: {perfStats.drawCalls}{perfStats.drawCalls > 50 ? ' ⚠ DD-V2-186' : ''}
    </div>
    <div class:warn={perfStats.sprites > 300}>
      Sprites: {perfStats.sprites}
    </div>
    <div class:warn={perfStats.gpuMB > 60}>
      GPU tex: {perfStats.gpuMB.toFixed(1)} MB{perfStats.gpuMB > 80 ? ' ✗ OVER BUDGET' : perfStats.gpuMB > 60 ? ' ⚠' : ''}
    </div>
    <div class:warn={perfStats.heapMB > 100}>
      JS heap: {perfStats.heapMB.toFixed(1)} MB
    </div>
    <div>Dirty tiles: {perfStats.dirtyTiles}</div>
    <div class:warn={perfStats.saveSizeKB > 200}>
      Save: {perfStats.saveSizeKB} KB{perfStats.saveSizeKB > 200 ? ' ⚠ large' : ''}
    </div>
  </div>
{/if}
```

Add to the `<style>` block:

```css
.perf-overlay { background: rgba(0,0,0,0.7); color: #eee; padding: 6px 8px; border-radius: 4px; }
.perf-overlay .warn { color: #ffaa00; }
.perf-overlay .ok   { color: #44ff88; }
```

### Acceptance Criteria

- `src/services/gpuMemoryService.ts` exports `initGpuMemoryTracking`, `queryGpuMemory`, `isGpuOverBudget`
- DevPanel debug section shows FPS, draw calls, sprite count, GPU MB, JS heap MB, dirty tile count, save size KB
- Stats update every 500 ms while the debug section is open and pause when collapsed (no runaway intervals)
- Overlay only renders when `import.meta.env.DEV` is true (confirm in build output that `DevPanel` is in the `dev` chunk)
- Warning colors apply when FPS < 30, draw calls > 50, GPU > 60 MB, save > 200 KB
- `npm run typecheck` passes

---

## Playwright Test Scripts

All scripts use the Node.js + playwright-core pattern. Write the script to `/tmp/ss-28.js` and
run with `node /tmp/ss-28.js`. Requires dev server at `http://localhost:5173`.

### Test 1: DevPanel Performance Overlay

```js
// /tmp/test-28-devpanel.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 412, height: 915 })
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  try { await page.click('button:has-text("Skip")', { timeout: 3000 }) } catch (_) {}
  await page.waitForSelector('button:has-text("Dive")', { timeout: 20000 })

  // Enter mine
  await page.click('button:has-text("Dive")')
  await page.waitForSelector('button:has-text("Enter Mine")', { timeout: 10000 })
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Open DevPanel
  try {
    await page.click('button:has-text("DEV")', { timeout: 3000 })
    await page.waitForTimeout(300)
    await page.click('text=debug')
    await page.waitForTimeout(800)
  } catch (_) { console.log('DevPanel not found — skipping perf overlay check') }

  await page.screenshot({ path: '/tmp/ss-28-devpanel.png' })
  console.log('Screenshot saved: /tmp/ss-28-devpanel.png')
  await browser.close()
})()
```

### Test 2: No Regressions — Core Loop

```js
// /tmp/test-28-regression.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 412, height: 915 })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  try { await page.click('button:has-text("Skip")', { timeout: 3000 }) } catch (_) {}
  await page.waitForSelector('button:has-text("Dive")', { timeout: 20000 })
  await page.screenshot({ path: '/tmp/ss-28-hub.png' })
  console.log('Hub visible: PASS')

  await page.click('button:has-text("Dive")')
  await page.waitForSelector('button:has-text("Enter Mine")', { timeout: 10000 })
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/ss-28-mine.png' })

  const mineCanvas = await page.isVisible('canvas')
  console.log('Mine canvas visible:', mineCanvas ? 'PASS' : 'FAIL')
  if (errors.length > 0) {
    console.error('JS errors:', errors); process.exit(1)
  }
  console.log('No JS errors: PASS')
  await browser.close()
})()
```

### Test 3: Bundle Size Check (run after `npm run build`)

```js
// /tmp/test-28-bundle.js
const fs = require('fs'); const path = require('path'); const zlib = require('zlib')
const DIST = '/root/terra-miner/dist/assets'
const files = fs.readdirSync(DIST).filter(f => f.endsWith('.js'))
let entryKB = 0; let totalKB = 0
for (const f of files) {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(DIST, f))).length
  totalKB += gz / 1024
  const isLazy = /phaser|sql-wasm|social|seasons|dev/.test(f)
  if (!isLazy) entryKB += gz / 1024
  console.log(`  ${f}: ${(gz / 1024).toFixed(1)} KB gz${isLazy ? ' [lazy]' : ' [entry]'}`)
}
console.log(`\nEntry total: ${entryKB.toFixed(1)} KB gz (target < 200 KB)`)
console.log(`All JS total: ${totalKB.toFixed(1)} KB gz`)
if (entryKB > 200) { console.error('FAIL: entry chunk exceeds 200 KB gzipped'); process.exit(1) }
console.log('PASS: bundle within target')
```

---

## Verification Gate

All eight gates must pass before Phase 28 is marked complete and the doc moved to
`docs/roadmap/completed/`.

**Gate 1 — Typecheck**
```bash
npm run typecheck
# Expected: 0 errors
```

**Gate 2 — Build**
```bash
npm run build
# Expected: exits 0, no chunk-size warnings
```

**Gate 3 — Bundle size** (run after Gate 2)
```bash
node /tmp/test-28-bundle.js
# Expected: PASS (entry chunk < 200 KB gzipped)
```

**Gate 4 — No regressions**
```bash
# With dev server running:
node /tmp/test-28-regression.js
# Expected: Hub visible PASS, Mine canvas visible PASS, No JS errors PASS
```

**Gate 5 — DevPanel overlay visible**
```bash
node /tmp/test-28-devpanel.js
# Expected: screenshot shows DevPanel with FPS / draw-call readout
```

**Gate 6 — Draw call budget** (manual verification)
- Start `npm run dev`, enter mine, open DevPanel debug section
- Confirm: draw calls ≤ 50 during normal mining
- Confirm: FPS ≥ 50 during layer 1

**Gate 7 — Memory budget** (manual verification)
- Start `npm run dev`, complete a 10-layer dive
- Confirm via DevPanel: GPU texture memory ≤ 60 MB at deepest layer

**Gate 8 — Device tier settings visible**
- Open Settings → confirm "Performance" section renders
- Change tier to "Low", reload, open DevPanel → confirm particle count reduced

---

## Files Affected

### New Files

| File | Purpose |
|---|---|
| `src/services/deviceTierService.ts` | Device tier detection, quality presets, manual override |
| `src/services/gpuMemoryService.ts` | GPU texture memory query via WEBGL extension |
| `src/game/systems/DirtyRectTracker.ts` | Tracks changed tiles for selective per-frame re-render |
| `src/game/systems/TextureAtlasLRU.ts` | LRU eviction for biome texture atlases (DD-V2-189) |
| `src/game/phaserBundle.ts` | Custom Phaser entry point for tree-shaking unused modules |
| `docs/perf/baselines/BASELINE.md` | Pre/post-optimization metric table (created by worker) |

### Modified Files

| File | Changes |
|---|---|
| `src/game/scenes/MineScene.ts` | `DirtyRectTracker` integration; `TextureAtlasLRU`; fog `RenderTexture`; replace `redrawAll()` calls; `animFrameInterval` from `getQualityPreset()` |
| `src/game/systems/MineGenerator.ts` | Add `precomputeAutotileBitmasks()` call at end of `generateMine()` |
| `src/game/managers/BiomeParticleManager.ts` | Replace hardcoded `MAX_PARTICLES = 50` with `getQualityPreset().particleBudget`; add `cullByViewport()` |
| `src/game/spriteManifest.ts` | Add `getBiomeAtlasKey()`, `getBiomeAtlasUrl()`, `supportsWebP()` |
| `src/game/systems/LootPopSystem.ts` | Add 50-instance object pool (`acquire` / `release`) |
| `src/data/types.ts` | Add `autotileBitmask?: number` and `cachedSpriteKey?: string` to `MineCell` |
| `src/services/factsDB.ts` | Convert `initSqlJs` static import to lazy `getSqlJs()` dynamic import |
| `src/ui/stores/settings.ts` | Add `deviceTierOverride` writable store |
| `src/ui/components/Settings.svelte` | Add "Performance" section with device tier selector |
| `src/ui/components/DevPanel.svelte` | Performance overlay: FPS, draw calls, sprites, GPU mem, heap, dirty tiles, save KB |
| `src/ui/components/HubView.svelte` | Social tab components converted to dynamic imports |
| `vite.config.ts` | Add `rollup-plugin-visualizer` (conditional on `ANALYZE=true`); extend `manualChunks` |
| `package.json` | Add `"analyze"` script |
| `public/sw.js` | Update precache list to first biome atlas only; stale-while-revalidate for atlas routes |

### Files That Must NOT Be Changed in This Phase

- `src/data/biomes.ts` — biome definitions are stable; do not restructure to fix perf
- `src/game/GameManager.ts` — scene lifecycle is unchanged; only `MineScene` internals change
- `server/src/` — server performance (DD-V2-219 CDN headers) is out of scope for this phase
- Any Svelte store in `src/ui/stores/` except `settings.ts`
