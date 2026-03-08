# Phase 8: Mine Gameplay Overhaul

**Status**: Not Started
**Priority**: P0 — Core gameplay foundation; must complete before Phase 9
**Estimated Effort**: 8-12 sprints across 14 sub-phases
**Last Updated**: 2026-03-03

---

## Overview

Phase 8 is the most comprehensive overhaul in the V2 roadmap. It transforms the current flat, single-layer mine into a 20-layer roguelite system with tick-based time, active hazards, oxygen depth decay, landmark layers, a 5-consumable toolkit, companion integration, relic tier expansion, and a fully overhauled quiz/SM-2 system.

Every sub-phase was derived from the Gameplay Q&A Batch 1 (DD-V2-051 through DD-V2-084) and the Learning & Content Batch 2 (DD-V2-085 through DD-V2-134).

**Key Constraint**: ALL game time is action-based (DD-V2-051). One player movement or one block hit equals one "tick." No real-time seconds anywhere in any system.

**Key Files**:
- `src/game/scenes/MineScene.ts` — primary mine rendering and input
- `src/game/MineGenerator.ts` — procedural level generation
- `src/game/GameManager.ts` — central game state coordinator
- `src/game/managers/QuizManager.ts` — quiz triggering and scoring
- `src/game/managers/StudyManager.ts` — SM-2 review sessions
- `src/game/managers/GaiaManager.ts` — GAIA dialogue and toasts
- `src/game/managers/InventoryManager.ts` — backpack, consumables, minerals
- `src/data/balance.ts` — numeric constants, densities, multipliers
- `src/data/biomes.ts` — biome definitions
- `src/data/relics.ts` — relic definitions
- `src/ui/stores/gameState.ts` — Svelte stores for reactive state
- `src/ui/stores/playerData.ts` — persistent player progression

---

## Sub-Phase Index

| Sub-Phase | Name | Status |
|-----------|------|--------|
| 8.1 | Tick-Based Time System | Not Started |
| 8.2 | 20-Layer Mine Structure | Not Started |
| 8.3 | Active Hazard System | Not Started |
| 8.4 | Oxygen Depth Decay | Not Started |
| 8.5 | Landmark Layers | Not Started |
| 8.6 | Consumable Tools | Not Started |
| 8.7 | Biome Depth Tiers | Not Started |
| 8.8 | Quiz System Overhaul | Not Started |
| 8.9 | SM-2 Tuning | Not Started |
| 8.10 | Relic System Expansion | Not Started |
| 8.11 | Pre-Dive Prep Screen | Not Started |
| 8.12 | Companion System | Not Started |
| 8.13 | Difficulty Scaling and Balance Simulation | Not Started |
| 8.14 | Auto-Save, Loot Loss, Send-Up Enhancements | Not Started |
| 8.17 | Mine Generation Profiling | Not Started |
| 8.18 | Seed Determinism Tests | Not Started |

---

## Phase 8 Prerequisites

Before starting any sub-phase, verify:
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` produces a clean production bundle
- [ ] Dev server starts at `http://localhost:5173`
- [ ] A full dive loop (enter mine, mine blocks, exit) completes without console errors
- [ ] Existing quiz overlay triggers and renders correctly

---

## Sub-Phase 8.1: Tick-Based Time System

### Overview

**Design Decision**: DD-V2-051

Every game system currently mixed with JavaScript `setInterval`/`setTimeout` calls must be replaced with an action-count ("tick") model. One tick = one player movement OR one block hit. This eliminates all real-time pressure while keeping action-pressure meaningful.

This sub-phase establishes the tick infrastructure that all subsequent sub-phases depend on. It is a pure refactor — no player-visible features change, but the execution model fundamentally shifts.

### Sub-Steps

**Step 1: Add tick counter to game state**

File: `src/ui/stores/gameState.ts`

Add to the game session state (the object reset each dive):
```typescript
// Tick counter — increments on every player movement or block hit
tickCount: number;           // cumulative ticks this dive
layerTickCount: number;      // ticks since last layer entry (reset on layer change)
```

**Step 2: Create TickSystem singleton**

File: `src/game/systems/TickSystem.ts` (new file)

```typescript
/**
 * TickSystem — central registry for tick-driven game logic.
 * All hazard timers, instability meters, and active entities
 * register callbacks here. Never use setInterval or setTimeout
 * for game logic — always use ticks. (DD-V2-051)
 */
export type TickCallback = (tick: number, layerTick: number) => void;

export class TickSystem {
  private static instance: TickSystem;
  private callbacks: Map<string, TickCallback> = new Map();
  private tickCount = 0;
  private layerTickCount = 0;

  static getInstance(): TickSystem {
    if (!TickSystem.instance) TickSystem.instance = new TickSystem();
    return TickSystem.instance;
  }

  /** Register a named tick listener. Overwrites existing if same key. */
  register(key: string, cb: TickCallback): void {
    this.callbacks.set(key, cb);
  }

  /** Remove a tick listener by key. */
  unregister(key: string): void {
    this.callbacks.delete(key);
  }

  /** Called by MineScene after every player move or block hit. */
  advance(): void {
    this.tickCount++;
    this.layerTickCount++;
    this.callbacks.forEach(cb => cb(this.tickCount, this.layerTickCount));
  }

  /** Reset layer tick counter on layer change. */
  resetLayerTick(): void {
    this.layerTickCount = 0;
  }

  /** Full reset on new dive. */
  resetAll(): void {
    this.tickCount = 0;
    this.layerTickCount = 0;
    this.callbacks.clear();
  }

  getTick(): number { return this.tickCount; }
  getLayerTick(): number { return this.layerTickCount; }
}
```

**Step 3: Integrate TickSystem into MineScene**

File: `src/game/scenes/MineScene.ts`

In the player movement handler (wherever `movePlayer()` is called) and block mining handler (wherever a block is broken), add immediately after the action resolves:
```typescript
TickSystem.getInstance().advance();
```

**Step 4: Audit and remove real-time hazard timers**

Search for all `setInterval`, `setTimeout`, and Phaser `time.addEvent` calls inside `MineScene.ts`, `GameManager.ts`, and the managers directory. For each one that drives gameplay logic (not UI animations):
- If it drives hazard behavior: remove and replace with tick-listener registration in TickSystem
- If it drives a UI animation (shake, flash, particle): leave it — visual effects may use real time
- Document every removed timer with a comment: `// Replaced by TickSystem.register — DD-V2-051`

**Step 5: Replace unstable ground real-time collapse**

File: `src/game/GameManager.ts`

The existing unstable ground system uses a timed collapse. Replace with a tick-count check: collapse triggers after N ticks of the player standing adjacent, configurable in `src/data/balance.ts`:
```typescript
export const UNSTABLE_GROUND_TICK_THRESHOLD = 3;
```

**Step 6: Add tick-based constants section to balance**

File: `src/data/balance.ts`

```typescript
// ---- Tick-Based Timing Constants (DD-V2-051) ----
export const TICK_LAVA_SPREAD_INTERVAL = 1;          // lava expands every N ticks
export const TICK_GAS_DRIFT_INTERVAL = 2;            // gas cloud moves every N ticks
export const TICK_GAS_DISSIPATE_AFTER = 30;          // gas cloud lifetime in ticks
export const TICK_INSTABILITY_WARNING = 0.75;        // 75% = doubled earthquake frequency
export const TICK_INSTABILITY_COLLAPSE = 1.0;        // 100% = evacuation countdown begins
export const UNSTABLE_GROUND_TICK_THRESHOLD = 3;     // ticks adjacent before collapse
export const TICK_INSTABILITY_PER_ACTION = 0.001;    // instability gained per player action
```

### Acceptance Criteria

- [ ] Player movement increments `tickCount` by exactly 1 per move (verified via DevPanel debug info)
- [ ] Block mining increments `tickCount` by exactly 1 per block hit
- [ ] `TickSystem.getInstance()` returns the same singleton across all callers
- [ ] Layer transition calls `TickSystem.getInstance().resetLayerTick()`
- [ ] New dive calls `TickSystem.getInstance().resetAll()`
- [ ] No `setInterval` or `setTimeout` calls remain in gameplay logic files (UI animations excepted)
- [ ] `npm run typecheck` passes
- [ ] Full dive loop completes without console errors

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-1-tick.png' })
  // Attempt to read tick count from DevPanel debug section
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    const debugInfo = await page.textContent('[data-testid="debug-tick-count"]').catch(() => null)
    console.log('Tick count visible:', debugInfo)
    await page.screenshot({ path: '/tmp/ss-8-1-devpanel.png' })
  }
  await browser.close()
  console.log('8.1 tick system test complete')
})()
```

### Verification Gate

All must pass before starting 8.2:
- [ ] Tick counter visible in DevPanel debug section
- [ ] `grep -r "setInterval\|addEvent" src/game/` shows no remaining gameplay timers
- [ ] `TickSystem.ts` exists in `src/game/systems/`
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean
- [ ] Screenshot taken at `/tmp/ss-8-1-tick.png`

---

## Sub-Phase 8.2: 20-Layer Mine Structure

### Overview

**Design Decisions**: DD-V2-022, DD-V2-054, DD-V2-056, DD-V2-057, BUG-004

Transform the current 3-layer mine into a 20-layer system with:
- Stepped grid sizes: 20×20 (L1-5), 25×25 (L6-10), 30×30 (L11-15), 40×40 (L16-20)
- Layer 1: top-center spawn, 3×3 pre-cleared
- Layers 2-20: random spawn far from descent shaft (Pixel Dungeon style)
- Descent shaft randomly placed anywhere — not bottom-half restricted (DD-V2-052 supersedes DD-V2-024)
- Depth-based block distribution (dirt fades with depth, hard rock rises)
- No point-of-no-return mechanic anywhere
- Fix BUG-004: remove conflicting `MINE_TOTAL_LAYERS` constant

### Sub-Steps

**Step 1: Fix BUG-004 — Consolidate layer constants**

File: `src/data/balance.ts`

Remove `MINE_TOTAL_LAYERS` entirely. Update `MAX_LAYERS` to 20:
```typescript
export const MAX_LAYERS = 20;
// DELETED: export const MINE_TOTAL_LAYERS = 1;  // BUG-004 — use MAX_LAYERS
```

Add grid size lookup function:
```typescript
/**
 * Returns the [width, height] grid dimensions for the given layer (1-indexed).
 * Tier boundaries: L1-5 = 20x20, L6-10 = 25x25, L11-15 = 30x30, L16-20 = 40x40.
 * (DD-V2-054)
 */
export function getLayerGridSize(layer: number): [number, number] {
  if (layer <= 5)  return [20, 20];
  if (layer <= 10) return [25, 25];
  if (layer <= 15) return [30, 30];
  return [40, 40];
}
```

**Step 2: Update MineGenerator signature to accept layer number**

File: `src/game/MineGenerator.ts`

Add `layer: number` parameter (1-indexed):
```typescript
export function generateMine(
  biome: BiomeId,
  layer: number,
  seed?: number
): MineMap { ... }
```

Inside `generateMine`, call `getLayerGridSize(layer)` to determine width and height.

**Step 3: Depth-based block distribution**

File: `src/game/MineGenerator.ts`

Add a `getBlockWeightsForLayer(layer: number)` helper that returns density values for each block type:

```typescript
interface BlockWeights {
  dirt: number;
  softRock: number;
  stone: number;
  hardRock: number;
  lavaBlock: number;
  gasPocket: number;
  mineralNode: number;
  artifactNode: number;
  fossilNode: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function getBlockWeightsForLayer(layer: number): BlockWeights {
  const depth = (layer - 1) / 19;  // 0.0 at L1, 1.0 at L20
  return {
    dirt:        lerp(0.35, 0.02, depth),
    softRock:    lerp(0.20, 0.08, depth),
    stone:       lerp(0.25, 0.20, depth),
    hardRock:    lerp(0.00, 0.35, depth),
    lavaBlock:   layer >= 8  ? lerp(0.01, 0.04, (layer - 8) / 12) : 0,
    gasPocket:   layer >= 5  ? lerp(0.01, 0.03, (layer - 5) / 15) : 0,
    mineralNode: layer <= 12 ? lerp(0.05, 0.08, depth) : lerp(0.08, 0.04, (layer - 12) / 8),
    artifactNode: lerp(0.01, 0.06, depth),
    fossilNode:  lerp(0.01, 0.03, depth),
  };
}
```

**Step 4: Layer 1 spawn — top-center, 3×3 pre-cleared**

File: `src/game/MineGenerator.ts`

After generation, if `layer === 1`:
```typescript
const spawnX = Math.floor(width / 2);
const spawnY = 1;
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    const cx = spawnX + dx, cy = spawnY + dy;
    if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
      grid[cy][cx] = BlockType.Empty;
    }
  }
}
map.spawnX = spawnX;
map.spawnY = spawnY;
```

**Step 5: Layers 2-20 spawn — random, far from descent shaft**

File: `src/game/MineGenerator.ts`

After placing the descent shaft, compute spawn point using a minimum Manhattan distance:
```typescript
const MIN_DIST_FROM_SHAFT = 8;
let spawnX = 1, spawnY = 1;
let attempts = 0;
do {
  spawnX = 1 + Math.floor(rng() * (width - 2));
  spawnY = 1 + Math.floor(rng() * (height - 2));
  attempts++;
} while (
  attempts < 200 &&
  (Math.abs(spawnX - shaftX) + Math.abs(spawnY - shaftY) < MIN_DIST_FROM_SHAFT ||
   grid[spawnY][spawnX] !== BlockType.Empty)
);
// Fallback if no valid position found after 200 attempts
if (attempts >= 200) { spawnX = 1; spawnY = 1; }
```

**Step 6: Descent shaft — fully random placement**

File: `src/game/MineGenerator.ts`

Remove any bottom-half restriction from existing shaft placement logic. Place the shaft at a random empty cell anywhere in the grid:
```typescript
// Shaft placed at random empty cell — NOT restricted to bottom half (DD-V2-052)
const emptyList = getAllEmptyCells(grid);
const shaftCell = emptyList[Math.floor(rng() * emptyList.length)];
grid[shaftCell.y][shaftCell.x] = BlockType.DescentShaft;
const shaftX = shaftCell.x, shaftY = shaftCell.y;
```

**Step 7: Remove PONR (point-of-no-return) mechanic**

Files: `src/game/MineGenerator.ts`, `src/game/GameManager.ts`

Search for any logic that permanently blocks upward movement or forces the player to continue downward. Remove it. Players must be able to freely traverse the entire layer grid. (Note: layer transitions remain one-way — you can only go down via the descent shaft, not back up between layers.)

**Step 8: Pass layer number from MineScene to generateMine**

File: `src/game/scenes/MineScene.ts`

```typescript
import { get } from 'svelte/store';
import { currentLayer } from '../../ui/stores/gameState';

// In create():
const layer = get(currentLayer);
const mineMap = generateMine(selectedBiome, layer, seed);
```

**Step 9: Derived layer tier store**

File: `src/ui/stores/gameState.ts`

```typescript
export const currentLayer = writable<number>(1);

export const layerTierLabel = derived(currentLayer, (layer): string => {
  if (layer <= 5)  return 'Shallow';
  if (layer <= 10) return 'Mid';
  if (layer <= 15) return 'Deep';
  return 'Extreme';
});
```

**Step 10: HUD layer display**

File: HUD component used during mining (identify via grep in `src/ui/components/`)

Display current layer and tier: `Layer 7 — Mid`

Show tier in a color:
- Shallow: green
- Mid: yellow
- Deep: orange
- Extreme: red

### Acceptance Criteria

- [ ] `MAX_LAYERS === 20` is the only authoritative layer constant
- [ ] `grep -r "MINE_TOTAL_LAYERS" src/` returns empty
- [ ] `getLayerGridSize(1)` returns `[20, 20]`
- [ ] `getLayerGridSize(6)` returns `[25, 25]`
- [ ] `getLayerGridSize(11)` returns `[30, 30]`
- [ ] `getLayerGridSize(16)` returns `[40, 40]`
- [ ] Layer 1 spawn is within 2 cells of top-center column
- [ ] Layers 2-20 spawn is at least 8 Manhattan tiles from the descent shaft
- [ ] Descent shaft appears somewhere in the layer (not restricted to bottom half)
- [ ] No PONR logic blocks movement within the layer grid
- [ ] HUD shows current layer number and tier label
- [ ] Dirt block density in an L20 mine visibly lower than L1 (screenshot comparison)
- [ ] `npm run typecheck` passes

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-2-layer1.png' })
  const bodyText = await page.textContent('body')
  if (!bodyText.includes('Layer')) {
    console.warn('WARNING: Layer indicator not found in HUD')
  }
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-8-2-devpanel.png' })
  }
  await browser.close()
  console.log('8.2 layer structure test complete')
})()
```

### Verification Gate

All must pass before starting 8.3:
- [ ] `grep -r "MINE_TOTAL_LAYERS" src/` returns empty
- [ ] `getLayerGridSize` exported from `balance.ts`
- [ ] Screenshots at `/tmp/ss-8-2-layer1.png` and `/tmp/ss-8-2-devpanel.png` taken
- [ ] HUD layer number visible in screenshot
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean

---

## Sub-Phase 8.3: Active Hazard System

### Overview

**Design Decisions**: DD-V2-060 (hazards), DD-V2-064 (lava behavior), DD-V2-065 (gas behavior), DD-V2-062 (quiz on hazard hit), DD-V2-051 (tick model)

Implement two active hazards driven entirely by the TickSystem from 8.1:

1. **Lava Entity**: Expands outward by exactly 1 block per tick from its origin. Never exponential or branching. A Coolant Bomb (implemented in 8.6) solidifies 3×3 lava into passable stone.
2. **Gas Cloud**: Triggered when a GasPocket block is broken. Fills a 3×3 area initially. Drifts 1 cell toward the player every 2 ticks. Drains O2 per tick while the player occupies a cloud cell. Dissipates after 30 ticks.

When a hazard hits the player, a quiz overlay fires (DD-V2-062): correct answer = reduced damage, wrong answer = full damage.

### Sub-Steps

**Step 1: Create HazardSystem file**

File: `src/game/systems/HazardSystem.ts` (new file)

```typescript
import { BlockType } from '../MineGenerator';
import type { MineMap } from '../MineGenerator';
import { TICK_LAVA_SPREAD_INTERVAL, TICK_GAS_DRIFT_INTERVAL, TICK_GAS_DISSIPATE_AFTER } from '../../data/balance';

export interface LavaEntity {
  type: 'lava';
  cells: Set<string>;    // "x,y" string keys
  originX: number;
  originY: number;
  ticksAlive: number;
}

export interface GasCloud {
  type: 'gas';
  cells: Set<string>;
  centerX: number;
  centerY: number;
  ticksAlive: number;
  dissipatesAt: number;
}

export type ActiveHazard = LavaEntity | GasCloud;
```

**Step 2: HazardSystem class implementation**

File: `src/game/systems/HazardSystem.ts`

```typescript
export class HazardSystem {
  private hazards: ActiveHazard[] = [];

  constructor(
    private getMineMap: () => MineMap,
    private getPlayerPos: () => { x: number; y: number },
    private onPlayerInHazard: (hazard: ActiveHazard) => void,
    private onCellBecameLava: (x: number, y: number) => void
  ) {}

  spawnLava(x: number, y: number): void {
    const entity: LavaEntity = {
      type: 'lava',
      cells: new Set([`${x},${y}`]),
      originX: x,
      originY: y,
      ticksAlive: 0,
    };
    this.hazards.push(entity);
  }

  spawnGas(x: number, y: number): void {
    const cloud: GasCloud = {
      type: 'gas',
      cells: new Set(),
      centerX: x,
      centerY: y,
      ticksAlive: 0,
      dissipatesAt: TICK_GAS_DISSIPATE_AFTER,
    };
    // Initial 3x3 fill
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        cloud.cells.add(`${x + dx},${y + dy}`);
      }
    }
    this.hazards.push(cloud);
  }

  onTick(tick: number, _layerTick: number): void {
    for (const h of this.hazards) {
      h.ticksAlive++;
    }
    this.tickLava();
    this.tickGas();
    this.checkPlayerCollision();
    // Remove dissipated gas clouds
    this.hazards = this.hazards.filter(h =>
      !(h.type === 'gas' && h.ticksAlive >= h.dissipatesAt)
    );
  }

  private tickLava(): void {
    const map = this.getMineMap();
    for (const h of this.hazards) {
      if (h.type !== 'lava') continue;
      if (h.ticksAlive % TICK_LAVA_SPREAD_INTERVAL !== 0) continue;
      // Find all empty cells adjacent to current lava cells
      const candidates: Array<{ x: number; y: number }> = [];
      for (const cellKey of h.cells) {
        const [cx, cy] = cellKey.split(',').map(Number);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
          if (map.grid[ny][nx] === BlockType.Unbreakable) continue;
          const nKey = `${nx},${ny}`;
          if (!h.cells.has(nKey) && map.grid[ny][nx] === BlockType.Empty) {
            candidates.push({ x: nx, y: ny });
          }
        }
      }
      if (candidates.length > 0) {
        // Expand to exactly ONE candidate (nearest to player preferred)
        const { x: px, y: py } = this.getPlayerPos();
        candidates.sort((a, b) =>
          (Math.abs(a.x - px) + Math.abs(a.y - py)) -
          (Math.abs(b.x - px) + Math.abs(b.y - py))
        );
        const { x, y } = candidates[0];
        h.cells.add(`${x},${y}`);
        map.grid[y][x] = BlockType.LavaBlock;
        this.onCellBecameLava(x, y);
      }
    }
  }

  private tickGas(): void {
    const { x: px, y: py } = this.getPlayerPos();
    for (const h of this.hazards) {
      if (h.type !== 'gas') continue;
      if (h.ticksAlive % TICK_GAS_DRIFT_INTERVAL !== 0) continue;
      // Drift center toward player by 1 cell
      const dx = Math.sign(px - h.centerX);
      const dy = Math.sign(py - h.centerY);
      if (dx !== 0 || dy !== 0) {
        h.centerX += dx;
        h.centerY += dy;
        // Recompute cells around new center
        h.cells.clear();
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            h.cells.add(`${h.centerX + ox},${h.centerY + oy}`);
          }
        }
      }
    }
  }

  private checkPlayerCollision(): void {
    const { x, y } = this.getPlayerPos();
    const key = `${x},${y}`;
    for (const h of this.hazards) {
      if (h.cells.has(key)) {
        this.onPlayerInHazard(h);
        break;
      }
    }
  }

  solidifyLava(centerX: number, centerY: number, radius = 1): void {
    const map = this.getMineMap();
    for (const h of this.hazards) {
      if (h.type !== 'lava') continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const key = `${centerX + dx},${centerY + dy}`;
          if (h.cells.has(key)) {
            h.cells.delete(key);
            const x = centerX + dx, y = centerY + dy;
            map.grid[y][x] = BlockType.Stone;
          }
        }
      }
    }
    // Remove lava entities with no remaining cells
    this.hazards = this.hazards.filter(h => h.type !== 'lava' || h.cells.size > 0);
  }

  clearAll(): void {
    this.hazards = [];
  }

  getActiveHazards(): ActiveHazard[] {
    return this.hazards;
  }
}
```

**Step 3: Register HazardSystem with TickSystem in MineScene**

File: `src/game/scenes/MineScene.ts`

```typescript
// In create():
const hazardSystem = new HazardSystem(
  () => this.mineMap,
  () => ({ x: this.playerGridX, y: this.playerGridY }),
  (hazard) => this.gameManager.onHazardContact(hazard),
  (x, y) => this.redrawCell(x, y)
);
TickSystem.getInstance().register('hazard-system',
  (tick, layerTick) => hazardSystem.onTick(tick, layerTick)
);
// Store reference for cleanup and Coolant Bomb usage
this.hazardSystem = hazardSystem;
```

On layer change or mine exit:
```typescript
this.hazardSystem.clearAll();
TickSystem.getInstance().unregister('hazard-system');
```

**Step 4: Spawn lava on LavaBlock exposure**

File: `src/game/scenes/MineScene.ts` or `GameManager.ts`

After each block is mined, check all 4 neighbors for `BlockType.LavaBlock`:
```typescript
for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
  const nx = brokenX + dx, ny = brokenY + dy;
  if (inBounds(nx, ny) && map.grid[ny][nx] === BlockType.LavaBlock) {
    hazardSystem.spawnLava(nx, ny);
  }
}
```

**Step 5: Spawn gas on GasPocket break**

File: `src/game/scenes/MineScene.ts` or `GameManager.ts`

When `BlockType.GasPocket` is mined:
```typescript
hazardSystem.spawnGas(block.x, block.y);
```

**Step 6: Hazard-triggered quiz in QuizManager**

File: `src/game/managers/QuizManager.ts`

Add `triggerHazardQuiz(hazard: ActiveHazard, playerDefense: number): void`:
- Retrieve a previously-seen fact due for review (SM-2 reps >= 1)
- Present quiz with `triggerSource: 'hazard'`
- On correct: `actualDamage = Math.ceil(BASE_DAMAGE * (1 - Math.min(0.5, playerDefense * 0.1)))`
- On wrong: `actualDamage = BASE_DAMAGE`
- Do NOT update SM-2 state from hazard quizzes (they are consequence mechanics, not study)

Add to `src/data/balance.ts`:
```typescript
export const BASE_LAVA_HAZARD_DAMAGE = 20;    // O2 cost, wrong answer on lava hit
export const BASE_GAS_HAZARD_DAMAGE = 12;     // O2 cost per tick inside gas (wrong answer)
export const HAZARD_MAX_DEFENSE_REDUCTION = 0.5;  // 50% max damage reduction at full defense
```

Add `onHazardContact(hazard: ActiveHazard): void` to `GameManager.ts`:
```typescript
onHazardContact(hazard: ActiveHazard): void {
  this.quizManager.triggerHazardQuiz(hazard, this.getPlayerDefense());
}
```

**Step 7: Visual rendering for active hazards**

File: `src/game/scenes/MineScene.ts`

- **Lava expansion**: Call `this.redrawCell(x, y)` in `onCellBecameLava` to re-render the newly lava-covered tile using existing `drawBlockPattern` for `BlockType.LavaBlock`. Add a red pulsing Phaser Graphics overlay (alpha animation — real time OK for visuals).
- **Gas cloud**: Render a green semi-transparent rectangle over each gas cell. Update positions when the cloud drifts. Fade the cloud as its `ticksAlive` approaches `dissipatesAt`.

### Acceptance Criteria

- [ ] Breaking a block adjacent to a LavaBlock activates a lava entity that spreads 1 block per tick
- [ ] Lava does not spread into `BlockType.Unbreakable` cells
- [ ] Walking into a lava-occupied cell triggers a quiz overlay
- [ ] Correct quiz answer applies reduced damage; wrong = full damage
- [ ] Breaking a GasPocket block spawns a visible 3×3 gas cloud at that location
- [ ] Gas cloud visually drifts toward player position over ticks
- [ ] Gas cloud disappears after 30 ticks (TICK_GAS_DISSIPATE_AFTER)
- [ ] Standing in gas cloud drains O2 each tick player remains inside
- [ ] Layer change clears all active hazards
- [ ] `solidifyLava()` converts lava cells to Stone (stub for Coolant Bomb in 8.6)
- [ ] `npm run typecheck` passes

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-3-mine-base.png' })
  // Use DevPanel scenario: jump to layer 8 where lava spawns
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-8-3-hazard-panel.png' })
  }
  // Check console for hazard system errors
  const errors = await page.evaluate(() =>
    window.__consoleErrors ? window.__consoleErrors : []
  )
  console.log('Console errors:', errors)
  await browser.close()
  console.log('8.3 active hazard test complete')
})()
```

### Verification Gate

All must pass before starting 8.4:
- [ ] `HazardSystem.ts` exists in `src/game/systems/`
- [ ] `TickSystem.register('hazard-system', ...)` call present in `MineScene.ts`
- [ ] `onHazardContact` method exists in `GameManager.ts`
- [ ] No console errors when lava neighbor is mined
- [ ] Screenshots at `/tmp/ss-8-3-mine-base.png` and `/tmp/ss-8-3-hazard-panel.png` taken
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean

---

## Sub-Phase 8.4: Oxygen Depth Decay

### Overview

**Design Decisions**: DD-V2-061, DD-V2-051

Oxygen costs scale linearly with layer depth. Every O2-consuming gameplay action applies a multiplier:
- Layer 1: 1.0× (baseline)
- Layer 10: 1.5×
- Layer 20: 2.5×
- Formula: `multiplier = 1.0 + (1.5 * (layer - 1) / 19)`

This is the primary tension mechanic replacing the removed PONR. Players can always return to the surface, but every action at depth costs proportionally more.

**Non-negotiable**: O2 is paused during ALL quiz overlays (DD-V2-085 Learning Q&A). The depth multiplier applies only during active gameplay ticks.

### Sub-Steps

**Step 1: Add depth multiplier function to balance**

File: `src/data/balance.ts`

```typescript
/**
 * Returns the O2 cost multiplier for the given layer number (1-indexed).
 * L1 = 1.0×, L10 = 1.5×, L20 = 2.5×. Linear interpolation. (DD-V2-061)
 */
export function getO2DepthMultiplier(layer: number): number {
  const clamped = Math.max(1, Math.min(20, layer));
  return 1.0 + (1.5 * (clamped - 1) / 19);
}
```

**Step 2: Create drainO2WithDepth helper in GameManager**

File: `src/game/GameManager.ts`

```typescript
import { getO2DepthMultiplier } from '../data/balance';
import { get } from 'svelte/store';
import { currentLayer } from '../ui/stores/gameState';

/**
 * Drain O2 with depth multiplier applied to the base amount.
 * Does nothing if quizActive flag is true (O2 always paused during quizzes).
 */
private drainO2WithDepth(baseAmount: number): void {
  if (this.quizActive) return;
  const layer = get(currentLayer);
  const multiplier = getO2DepthMultiplier(layer);
  const finalAmount = Math.ceil(baseAmount * multiplier);
  this.drainOxygen(finalAmount);
}
```

Replace all bare `drainOxygen(X)` calls for player gameplay actions with `drainO2WithDepth(X)`. Do NOT multiply:
- O2 rewards (cache pickups, correct quiz answers)
- Consumable-granted O2
- Send-up station effects

**Step 3: quizActive flag — pause O2 on quiz open/close**

File: `src/game/GameManager.ts`

Add `private quizActive = false;`

Wire to quiz overlay lifecycle:
```typescript
openQuizOverlay(): void {
  this.quizActive = true;
  // ... existing overlay logic
}

closeQuizOverlay(): void {
  this.quizActive = false;
  // ... existing close logic
}
```

**Step 4: Derived O2 multiplier store for HUD**

File: `src/ui/stores/gameState.ts`

```typescript
import { getO2DepthMultiplier } from '../../data/balance';

export const o2DepthMultiplier = derived(currentLayer, (layer) =>
  getO2DepthMultiplier(layer)
);
```

**Step 5: HUD multiplier display**

File: HUD component during mining

Show `O2 ×1.5` label near the oxygen bar when `$o2DepthMultiplier > 1.0`.

Color coding:
- 1.0 to 1.49: no label shown (Layer 1 is baseline, no alarm needed)
- 1.5 to 1.99: amber label
- 2.0 to 2.5: red label, slight pulse animation

**Step 6: GAIA contextual warnings on depth milestones**

File: `src/game/managers/GaiaManager.ts`

Add one-time-per-session GAIA toasts:
```typescript
if (layer === 10 && !this.shownDepthWarning10) {
  this.shownDepthWarning10 = true;
  triggerGaiaToast("Oxygen consumption is now 50% higher. Choose your movements wisely.");
}
if (layer === 16 && !this.shownDepthWarning16) {
  this.shownDepthWarning16 = true;
  triggerGaiaToast("CAUTION: Oxygen cost is now 2× base rate. Every block matters.");
}
```

### Acceptance Criteria

- [ ] `getO2DepthMultiplier(1)` returns exactly `1.0`
- [ ] `getO2DepthMultiplier(10)` returns approximately `1.5` (within ±0.01)
- [ ] `getO2DepthMultiplier(20)` returns exactly `2.5`
- [ ] Mining a block at Layer 20 drains 2.5× the O2 of the same block at Layer 1
- [ ] O2 rewards are NOT multiplied by depth
- [ ] O2 drain is zero while any quiz overlay is open (quizActive = true)
- [ ] HUD multiplier label is amber at ≥ 1.5×, red at ≥ 2.0×
- [ ] GAIA toasts fire on first descent to Layer 10 and Layer 16 per session
- [ ] `npm run typecheck` passes

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-4-layer1-o2.png' })
  // Jump to Layer 20 via DevPanel and screenshot for multiplier label
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    const layerInput = await page.$('[data-testid="dev-set-layer"]')
    if (layerInput) {
      await layerInput.fill('20')
      await layerInput.press('Enter')
      await page.waitForTimeout(1000)
    }
    await page.screenshot({ path: '/tmp/ss-8-4-layer20-o2.png' })
  }
  await browser.close()
  console.log('8.4 O2 depth decay test complete')
})()
```

### Verification Gate

All must pass before starting 8.5:
- [ ] `getO2DepthMultiplier(1) === 1.0` confirmed in DevPanel or console
- [ ] `getO2DepthMultiplier(20) === 2.5` confirmed
- [ ] HUD multiplier label visible (red) in Layer 20 screenshot
- [ ] Screenshots at `/tmp/ss-8-4-layer1-o2.png` and `/tmp/ss-8-4-layer20-o2.png` taken
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean

---

## Sub-Phase 8.5: Landmark Layers

### Overview

**Design Decision**: DD-V2-055

Four specific layers break from procedural generation entirely and use pre-designed template rooms:

- **Layer 5 — Gauntlet**: A survive-or-escape wave of hazards. Multiple simultaneous lava entities and gas pockets activate on entry. Clearing it awards a guaranteed Rare mineral cache.
- **Layer 10 — Treasure Vault**: A bonus loot room. The entire layer has reduced rock density and elevated mineral node counts. A locked chest at the center awards a bonus relic draw on first visit.
- **Layer 15 — Ancient Archive**: A lore-forward layer. The generation inserts readable stone tablets (fact bonanza: 3 forced quiz triggers on approach). Clearing it awards a fact mastery XP bonus.
- **Layer 20 — Completion Event**: Random outcome drawn from a pool of 8+ hand-authored events. No New Game+; the game is endless. Completion events surface new permanent cosmetics and GAIA monologues.

Landmark layers use pre-authored ASCII templates stored in `src/data/landmarks.ts` and are stamped into the mine grid by `MineGenerator` instead of the normal procedural fill. Their visual themes differ from standard biome tiles.

### Sub-Steps

**Step 1: Define landmark template data structure**

File: `src/data/landmarks.ts` (new file)

```typescript
/**
 * Landmark layer template definitions. (DD-V2-055)
 * ASCII key: ' '=empty, '#'=hardRock, 'L'=lavaBlock, 'G'=gasPocket,
 * 'C'=chest, 'T'=tablet (fact anchor), 'S'=spawnPoint, 'D'=descentShaft
 */
export type LandmarkId = 'gauntlet' | 'treasure_vault' | 'ancient_archive' | 'completion_event';

export interface LandmarkTemplate {
  id: LandmarkId;
  layer: number;
  /** ASCII rows — all rows must have equal length */
  grid: string[];
  /** Which layer this template occupies (1-indexed) */
  targetLayer: number;
  /** Visual theme applied to non-special tiles */
  tileTheme: 'gauntlet' | 'vault' | 'archive' | 'cosmic';
  /** O2 bonus awarded on first clear of this landmark */
  firstClearO2Bonus: number;
}

export const LANDMARK_TEMPLATES: Record<LandmarkId, LandmarkTemplate> = {
  gauntlet: {
    id: 'gauntlet',
    layer: 5,
    targetLayer: 5,
    tileTheme: 'gauntlet',
    firstClearO2Bonus: 30,
    grid: [
      '###################',
      '#  L  #  G  #  L  #',
      '#     #     #     #',
      '# L   S   G #   L #',
      '#     #     #     #',
      '#  G  # LGL #  G  #',
      '#     #     #     #',
      '# L   #     #   L #',
      '#     # G G #     #',
      '#  L  #     #  L  #',
      '#     #  D  #     #',
      '###################',
    ],
  },
  treasure_vault: {
    id: 'treasure_vault',
    layer: 10,
    targetLayer: 10,
    tileTheme: 'vault',
    firstClearO2Bonus: 50,
    grid: [
      '#######################',
      '#   M   M   M   M   M #',
      '#  M  M   M   M  M   #',
      '# M     M  C  M     M #',
      '#  M  M   M   M  M   #',
      '#   M   M S M   M    #',
      '#  M  M   M   M  M   #',
      '# M     M       M  M #',
      '#   M       D       M #',
      '#######################',
    ],
  },
  ancient_archive: {
    id: 'ancient_archive',
    layer: 15,
    targetLayer: 15,
    tileTheme: 'archive',
    firstClearO2Bonus: 40,
    grid: [
      '##############################',
      '#  T     T     T     T     T #',
      '#                            #',
      '#  T  #######  T  #######  T #',
      '#     #     #     #     #    #',
      '#  T  # S   #  T  #   D #  T #',
      '#     #     #     #     #    #',
      '#  T  #######  T  #######  T #',
      '#                            #',
      '#  T     T     T     T     T #',
      '##############################',
    ],
  },
  completion_event: {
    id: 'completion_event',
    layer: 20,
    targetLayer: 20,
    tileTheme: 'cosmic',
    firstClearO2Bonus: 100,
    grid: [
      '########################################',
      '#   E   E   E   E   E   E   E   E   E  #',
      '#  E  E   E   E   E   E   E   E  E    #',
      '# E     E   E   E  S  E   E   E     E #',
      '#  E  E   E   E   E   E   E   E  E    #',
      '#   E   E   E   E   E   E   E   E   E  #',
      '########################################',
    ],
  },
};
```

**Step 2: Add completion event pool**

File: `src/data/landmarks.ts`

```typescript
export interface CompletionEvent {
  id: string;
  title: string;
  gaiaMonologue: string;
  reward: {
    type: 'cosmetic' | 'o2_cache' | 'relic' | 'fact_mastery_bonus';
    value: string | number;
  };
}

export const COMPLETION_EVENTS: CompletionEvent[] = [
  {
    id: 'ancient_signal',
    title: 'Ancient Signal Detected',
    gaiaMonologue: "The deep resonance frequencies match no known geological pattern. Something was built here, long before recorded history.",
    reward: { type: 'cosmetic', value: 'suit_archaic_glow' },
  },
  {
    id: 'crystalline_bloom',
    title: 'Crystalline Bloom',
    gaiaMonologue: "The mineral matrix here has self-organized into geometric perfection. It took millions of years — and you found it in an afternoon.",
    reward: { type: 'relic', value: 'crystal_heart_legendary' },
  },
  {
    id: 'memory_echo',
    title: 'Memory Echo',
    gaiaMonologue: "I am detecting a data-fossil — compressed information encoded in the rock itself. Whoever left this wanted it found.",
    reward: { type: 'fact_mastery_bonus', value: 200 },
  },
  {
    id: 'magnetic_anomaly',
    title: 'Magnetic Anomaly',
    gaiaMonologue: "This field is impossible at this depth. I have updated my geological models. They were wrong. Earth still surprises me.",
    reward: { type: 'o2_cache', value: 150 },
  },
  {
    id: 'terminus_chamber',
    title: 'Terminus Chamber',
    gaiaMonologue: "You have reached the deepest navigable point. Below this, the rock is unbreakable. But there is always another dive. There is always more to learn.",
    reward: { type: 'cosmetic', value: 'pickaxe_terminus_skin' },
  },
  {
    id: 'echo_of_life',
    title: 'Echo of Life',
    gaiaMonologue: "The biota down here are unlike anything catalogued. They have never seen sunlight. They do not need it. Life adapts.",
    reward: { type: 'cosmetic', value: 'companion_slot_deep_dweller' },
  },
  {
    id: 'time_stratum',
    title: 'Time Stratum',
    gaiaMonologue: "Each layer you passed through represents roughly fifty million years of Earth history. You descended four billion years in one dive.",
    reward: { type: 'fact_mastery_bonus', value: 500 },
  },
  {
    id: 'void_resonance',
    title: 'Void Resonance',
    gaiaMonologue: "I cannot explain this. I am not built to explain things I cannot explain. But I can record it. Which is, perhaps, enough.",
    reward: { type: 'relic', value: 'void_shard_legendary' },
  },
];
```

**Step 3: Extend MineGenerator to stamp landmark templates**

File: `src/game/MineGenerator.ts`

Add `stampLandmark(template: LandmarkTemplate, grid: BlockType[][], width: number, height: number): SpawnInfo`:

```typescript
import { LANDMARK_TEMPLATES, type LandmarkTemplate } from '../data/landmarks';

/**
 * Stamps a landmark template into the center of the grid.
 * Returns the resolved spawn (S) and descent shaft (D) positions.
 */
function stampLandmark(
  template: LandmarkTemplate,
  grid: BlockType[][],
  width: number,
  height: number
): { spawnX: number; spawnY: number; shaftX: number; shaftY: number } {
  const tRows = template.grid;
  const tH = tRows.length;
  const tW = Math.max(...tRows.map(r => r.length));
  const offsetX = Math.floor((width - tW) / 2);
  const offsetY = Math.floor((height - tH) / 2);

  let spawnX = offsetX + 1, spawnY = offsetY + 1;
  let shaftX = offsetX + tW - 2, shaftY = offsetY + tH - 2;

  const ASCII_MAP: Record<string, BlockType> = {
    ' ': BlockType.Empty,
    '#': BlockType.HardRock,
    'L': BlockType.LavaBlock,
    'G': BlockType.GasPocket,
    'C': BlockType.Chest,
    'T': BlockType.Tablet,
    'M': BlockType.MineralNode,
    'E': BlockType.Empty,   // cosmic event — rendered specially
    'S': BlockType.Empty,   // spawn marker
    'D': BlockType.DescentShaft,
  };

  for (let row = 0; row < tH; row++) {
    for (let col = 0; col < tRows[row].length; col++) {
      const ch = tRows[row][col];
      const gx = offsetX + col;
      const gy = offsetY + row;
      if (gx < 0 || gx >= width || gy < 0 || gy >= height) continue;
      if (ch === 'S') { spawnX = gx; spawnY = gy; }
      if (ch === 'D') { shaftX = gx; shaftY = gy; }
      const blockType = ASCII_MAP[ch] ?? BlockType.Empty;
      grid[gy][gx] = blockType;
    }
  }

  return { spawnX, spawnY, shaftX, shaftY };
}
```

In `generateMine`, check if the layer is a landmark layer (5, 10, 15, 20) and if so call `stampLandmark` instead of the procedural fill:

```typescript
const LANDMARK_LAYERS = new Set([5, 10, 15, 20]);

export function generateMine(biome: BiomeId, layer: number, seed?: number): MineMap {
  const [width, height] = getLayerGridSize(layer);
  const grid: BlockType[][] = createFilledGrid(width, height, BlockType.Stone);

  let spawnX: number, spawnY: number, shaftX: number, shaftY: number;

  if (LANDMARK_LAYERS.has(layer)) {
    const landmarkId = getLandmarkIdForLayer(layer);
    const template = LANDMARK_TEMPLATES[landmarkId];
    ({ spawnX, spawnY, shaftX, shaftY } = stampLandmark(template, grid, width, height));
  } else {
    // ... existing procedural generation ...
  }
  // ... rest of generateMine ...
}

function getLandmarkIdForLayer(layer: number): LandmarkId {
  if (layer === 5)  return 'gauntlet';
  if (layer === 10) return 'treasure_vault';
  if (layer === 15) return 'ancient_archive';
  return 'completion_event';
}
```

**Step 4: Landmark entry triggers in MineScene**

File: `src/game/scenes/MineScene.ts`

On layer entry (after `generateMine` completes), check if the new layer is a landmark:

```typescript
import { LANDMARK_LAYERS, COMPLETION_EVENTS } from '../../data/landmarks';

private onLayerEntered(layer: number): void {
  if (layer === 5)  this.triggerGauntletEntry();
  if (layer === 10) this.triggerVaultEntry();
  if (layer === 15) this.triggerArchiveEntry();
  if (layer === 20) this.triggerCompletionEvent();
}

private triggerGauntletEntry(): void {
  this.gaiaManager.toast("GAUNTLET ALERT — Multiple active hazards detected. Survive.");
  // Activate all LavaBlock and GasPocket cells in the pre-stamped grid
  this.mineMap.grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === BlockType.LavaBlock) this.hazardSystem.spawnLava(x, y);
      if (cell === BlockType.GasPocket) this.hazardSystem.spawnGas(x, y);
    });
  });
}

private triggerVaultEntry(): void {
  this.gaiaManager.toast("Treasure Vault — Elevated mineral density detected. A chest lies within.");
}

private triggerArchiveEntry(): void {
  this.gaiaManager.toast("Ancient Archive — Stone tablets detected. Approach to learn.");
  // Fact bonanza: mark 3 tablets as fact-anchor cells; approaching within 2 tiles
  // triggers a Discovery quiz (reward-only, first exposure logic).
  this.landmarkState.archiveTabletCount = 3;
}

private triggerCompletionEvent(): void {
  const event = COMPLETION_EVENTS[Math.floor(Math.random() * COMPLETION_EVENTS.length)];
  this.gaiaManager.toast(`DEPTH RECORD — ${event.title}`);
  this.gaiaManager.showMonologue(event.gaiaMonologue);
  this.gameManager.awardCompletionReward(event.reward);
}
```

**Step 5: Landmark tile theme rendering**

File: `src/game/scenes/MineScene.ts`

Add a `tileTheme` parameter check in `drawBlockPattern()`. When the active landmark theme is set, apply a color tint or overlay to Empty/Stone tiles:

```typescript
private getLandmarkTint(theme: LandmarkTemplate['tileTheme']): number {
  switch (theme) {
    case 'gauntlet': return 0xff4422;    // red-orange volcanic
    case 'vault':    return 0xffd700;    // gold
    case 'archive':  return 0x8888cc;    // cool blue-purple ancient stone
    case 'cosmic':   return 0x220044;    // deep space purple
    default:         return 0xffffff;    // no tint
  }
}
```

**Step 6: First-clear tracking and rewards**

File: `src/ui/stores/playerData.ts`

```typescript
export const landmarkClears = writable<Record<string, boolean>>({
  gauntlet: false,
  treasure_vault: false,
  ancient_archive: false,
  completion_event_count: 0,  // incrementing, not boolean
});
```

In `GameManager.ts`, on landmark layer completion (player reaches the descent shaft on a landmark layer), call:

```typescript
awardLandmarkClear(landmarkId: LandmarkId, firstClearO2Bonus: number): void {
  const clears = get(landmarkClears);
  const isFirstClear = !clears[landmarkId];
  if (isFirstClear) {
    landmarkClears.update(c => ({ ...c, [landmarkId]: true }));
    this.drainOxygen(-firstClearO2Bonus);  // negative drain = O2 gain
    this.gaiaManager.toast(`First Clear — +${firstClearO2Bonus} O2 bonus awarded!`);
  }
}
```

### Acceptance Criteria

- [ ] Entering Layer 5 loads the Gauntlet template (not procedural generation)
- [ ] Gauntlet entry immediately activates all pre-placed LavaBlock and GasPocket cells as live hazards
- [ ] GAIA toast fires on Gauntlet entry
- [ ] Entering Layer 10 loads the Treasure Vault template with elevated mineral density visible
- [ ] A Chest block exists near center of the Layer 10 map
- [ ] Entering Layer 15 loads the Ancient Archive template with Tablet blocks visible
- [ ] Approaching a Tablet within 2 tiles triggers a Discovery quiz
- [ ] Entering Layer 20 loads the Completion Event template and fires a random GAIA monologue
- [ ] First-clear O2 bonus is awarded exactly once per landmark per player profile
- [ ] `COMPLETION_EVENTS` has at least 8 entries
- [ ] `npm run typecheck` passes

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-5-base.png' })
  // Use DevPanel to jump to Layer 5 (Gauntlet)
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    const layerInput = await page.$('[data-testid="dev-set-layer"]')
    if (layerInput) {
      await layerInput.fill('5')
      await layerInput.press('Enter')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: '/tmp/ss-8-5-gauntlet.png' })
    }
    // Jump to Layer 10 (Vault)
    if (layerInput) {
      await layerInput.fill('10')
      await layerInput.press('Enter')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: '/tmp/ss-8-5-vault.png' })
    }
    // Jump to Layer 15 (Archive)
    if (layerInput) {
      await layerInput.fill('15')
      await layerInput.press('Enter')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: '/tmp/ss-8-5-archive.png' })
    }
    // Jump to Layer 20 (Completion)
    if (layerInput) {
      await layerInput.fill('20')
      await layerInput.press('Enter')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: '/tmp/ss-8-5-completion.png' })
    }
  }
  // Check GAIA toast appeared on at least one landmark layer
  const bodyText = await page.textContent('body')
  const hasToast = bodyText.toLowerCase().includes('gauntlet') ||
    bodyText.toLowerCase().includes('vault') ||
    bodyText.toLowerCase().includes('archive') ||
    bodyText.toLowerCase().includes('depth record')
  console.log('Landmark toast visible:', hasToast)
  await browser.close()
  console.log('8.5 landmark layers test complete')
})()
```

### Verification Gate

All must pass before starting 8.6:
- [ ] `src/data/landmarks.ts` exists with all four `LandmarkTemplate` entries
- [ ] `COMPLETION_EVENTS` array has 8+ entries
- [ ] `stampLandmark()` function present in `MineGenerator.ts`
- [ ] Screenshots at `/tmp/ss-8-5-gauntlet.png`, `/tmp/ss-8-5-vault.png`, `/tmp/ss-8-5-archive.png`, `/tmp/ss-8-5-completion.png` taken
- [ ] Gauntlet layer visually differs from a procedural layer (colored tint or hazard indicators present)
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean

---

## Sub-Phase 8.6: Consumable Tools

### Overview

**Design Decision**: DD-V2-064

Five consumable tool types are introduced, each with a 5-slot carry limit. They are found as drops in the mine, crafted at the Dome, or eventually purchased. Each has a pixel art sprite (32px), a use animation, and a distinct game effect.

| Tool | Effect |
|---|---|
| Bomb | Instantly mines all blocks in a 3×3 area centered on target tile |
| Flare | Reveals the full 7×7 area (fog-of-war lift) centered on the player |
| Shield Charge | Absorbs the next hazard hit entirely (no damage, no quiz) |
| Drill Charge | Instantly mines 5 blocks in a straight line in the player's facing direction |
| Sonar Pulse | Reveals all mineral nodes within a 10-block Manhattan radius |

Consumables are managed in `InventoryManager`. The 5-slot limit means the player can carry at most 5 total consumables of any combination.

### Sub-Steps

**Step 1: Define consumable types and data**

File: `src/data/consumables.ts` (new file)

```typescript
/**
 * Consumable tool definitions. (DD-V2-064)
 */
export type ConsumableId = 'bomb' | 'flare' | 'shield_charge' | 'drill_charge' | 'sonar_pulse';

export interface ConsumableDefinition {
  id: ConsumableId;
  label: string;
  description: string;
  spriteKey: string;       // Phaser texture key
  /** How many the player can carry in inventory (not per-slot, total across all consumables) */
  maxCarry: number;
  stackable: boolean;
}

export const CONSUMABLE_DEFS: Record<ConsumableId, ConsumableDefinition> = {
  bomb: {
    id: 'bomb',
    label: 'Bomb',
    description: 'Instantly mines a 3×3 area. Does not trigger block mining events.',
    spriteKey: 'consumable_bomb',
    maxCarry: 3,
    stackable: true,
  },
  flare: {
    id: 'flare',
    label: 'Flare',
    description: 'Reveals the 7×7 area around you through the Fog of War.',
    spriteKey: 'consumable_flare',
    maxCarry: 3,
    stackable: true,
  },
  shield_charge: {
    id: 'shield_charge',
    label: 'Shield Charge',
    description: 'Absorbs the next hazard hit. No damage. No quiz.',
    spriteKey: 'consumable_shield',
    maxCarry: 2,
    stackable: true,
  },
  drill_charge: {
    id: 'drill_charge',
    label: 'Drill Charge',
    description: 'Mines 5 blocks in a straight line in your current facing direction.',
    spriteKey: 'consumable_drill',
    maxCarry: 3,
    stackable: true,
  },
  sonar_pulse: {
    id: 'sonar_pulse',
    label: 'Sonar Pulse',
    description: 'Pings all mineral nodes within a 10-block radius on the minimap.',
    spriteKey: 'consumable_sonar',
    maxCarry: 2,
    stackable: true,
  },
};

export const CONSUMABLE_CARRY_LIMIT = 5;  // total consumable slots across all types
```

**Step 2: Add consumables to InventoryManager**

File: `src/game/managers/InventoryManager.ts`

Add consumable slot tracking:

```typescript
import type { ConsumableId } from '../../data/consumables';
import { CONSUMABLE_CARRY_LIMIT, CONSUMABLE_DEFS } from '../../data/consumables';

export interface ConsumableSlot {
  id: ConsumableId;
  count: number;
}

// Add to InventoryManager class:
private consumables: ConsumableSlot[] = [];  // max 5 total items

/** Total consumable count across all slots */
getTotalConsumableCount(): number {
  return this.consumables.reduce((sum, s) => sum + s.count, 0);
}

/** Add a consumable. Returns false if carry limit is reached. */
addConsumable(id: ConsumableId): boolean {
  if (this.getTotalConsumableCount() >= CONSUMABLE_CARRY_LIMIT) return false;
  const existing = this.consumables.find(s => s.id === id);
  if (existing) {
    existing.count++;
  } else {
    this.consumables.push({ id, count: 1 });
  }
  return true;
}

/** Use a consumable. Returns false if not in inventory. */
useConsumable(id: ConsumableId): boolean {
  const slot = this.consumables.find(s => s.id === id);
  if (!slot || slot.count <= 0) return false;
  slot.count--;
  if (slot.count === 0) {
    this.consumables = this.consumables.filter(s => s.id !== id);
  }
  return true;
}

getConsumables(): ConsumableSlot[] {
  return [...this.consumables];
}
```

**Step 3: Implement consumable effects in MineScene**

File: `src/game/scenes/MineScene.ts`

Add `applyConsumable(id: ConsumableId): void`:

```typescript
applyConsumable(id: ConsumableId): void {
  const used = this.inventoryManager.useConsumable(id);
  if (!used) return;

  switch (id) {
    case 'bomb':
      this.applyBomb(this.playerGridX, this.playerGridY);
      break;
    case 'flare':
      this.applyFlare(this.playerGridX, this.playerGridY);
      break;
    case 'shield_charge':
      this.activeShield = true;
      this.gaiaManager.toast('Shield active — next hazard blocked.');
      break;
    case 'drill_charge':
      this.applyDrillCharge(this.playerFacing);
      break;
    case 'sonar_pulse':
      this.applySonarPulse(this.playerGridX, this.playerGridY);
      break;
  }
}

private applyBomb(cx: number, cy: number): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (!this.inBounds(nx, ny)) continue;
      const block = this.mineMap.grid[ny][nx];
      if (block !== BlockType.Empty && block !== BlockType.Unbreakable) {
        this.mineMap.grid[ny][nx] = BlockType.Empty;
        this.revealAround(nx, ny);
        this.redrawCell(nx, ny);
        // NOTE: Bomb does NOT trigger per-block mining events (no minerals, no tick per block)
      }
    }
  }
  TickSystem.getInstance().advance();  // One tick for using a bomb
  this.gaiaManager.toast('Bomb detonated — 3×3 area cleared.');
}

private applyFlare(cx: number, cy: number): void {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (this.inBounds(nx, ny)) this.revealAround(nx, ny);
    }
  }
  TickSystem.getInstance().advance();
  this.gaiaManager.toast('Flare deployed — 7×7 area revealed.');
}

private applyDrillCharge(facing: 'up' | 'down' | 'left' | 'right'): void {
  const [dx, dy] = {
    up:    [0, -1],
    down:  [0,  1],
    left:  [-1, 0],
    right: [1,  0],
  }[facing];
  let mined = 0;
  let cx = this.playerGridX, cy = this.playerGridY;
  while (mined < 5) {
    cx += dx; cy += dy;
    if (!this.inBounds(cx, cy)) break;
    const block = this.mineMap.grid[cy][cx];
    if (block === BlockType.Unbreakable) break;
    if (block !== BlockType.Empty) {
      this.mineMap.grid[cy][cx] = BlockType.Empty;
      this.revealAround(cx, cy);
      this.redrawCell(cx, cy);
      mined++;
    }
  }
  TickSystem.getInstance().advance();
  this.gaiaManager.toast(`Drill Charge — ${mined} blocks bored through.`);
}

private applySonarPulse(cx: number, cy: number): void {
  const revealed: Array<{ x: number; y: number }> = [];
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 10) continue;  // Manhattan radius
      const nx = cx + dx, ny = cy + dy;
      if (!this.inBounds(nx, ny)) continue;
      const block = this.mineMap.grid[ny][nx];
      if (block === BlockType.MineralNode || block === BlockType.Crystal ||
          block === BlockType.Geode) {
        revealed.push({ x: nx, y: ny });
      }
    }
  }
  this.minimapHighlightMineral(revealed);
  TickSystem.getInstance().advance();
  this.gaiaManager.toast(`Sonar Pulse — ${revealed.length} mineral nodes detected.`);
}
```

**Step 4: Shield Charge intercept in hazard contact**

File: `src/game/GameManager.ts`

In `onHazardContact`, check the shield before triggering quiz:

```typescript
onHazardContact(hazard: ActiveHazard): void {
  if (this.activeShield) {
    this.activeShield = false;
    this.gaiaManager.toast('Shield absorbed the hit — charge depleted.');
    return;
  }
  this.quizManager.triggerHazardQuiz(hazard, this.getPlayerDefense());
}
```

Add `activeShield` property to `MineScene` and expose a setter on `GameManager`.

**Step 5: Consumable drop from block mining**

File: `src/game/GameManager.ts`

Add consumable drop logic to the block-broken handler:

```typescript
import { CONSUMABLE_DROP_CHANCE } from '../../data/balance';

private onBlockBroken(block: BlockType, layer: number): void {
  // ... existing mineral/artifact logic ...
  if (Math.random() < CONSUMABLE_DROP_CHANCE) {
    const possibleDrops: ConsumableId[] = ['bomb', 'flare', 'shield_charge', 'drill_charge', 'sonar_pulse'];
    const dropped = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];
    const added = this.inventoryManager.addConsumable(dropped);
    if (added) {
      this.gaiaManager.toast(`Found: ${CONSUMABLE_DEFS[dropped].label}`);
    }
  }
}
```

Add to `src/data/balance.ts`:
```typescript
export const CONSUMABLE_DROP_CHANCE = 0.04;  // 4% chance per block broken
```

**Step 6: Consumable HUD bar**

File: HUD component during mining (identify via grep in `src/ui/components/`)

Display up to 5 consumable slots in a horizontal bar at the bottom of the HUD. Each slot shows:
- The consumable sprite icon (32px)
- A count badge if count > 1
- A tap/click handler that calls `applyConsumable(id)` in `MineScene`
- Grayed out appearance if slot is empty

**Step 7: Pre-dive consumable loadout (stub for 8.11)**

File: `src/ui/stores/gameState.ts`

Add a `pendingConsumables: ConsumableSlot[]` store that the Pre-Dive Prep screen (8.11) writes to. On dive start, `InventoryManager` initializes from this store.

### Acceptance Criteria

- [ ] `CONSUMABLE_CARRY_LIMIT === 5` exported from `consumables.ts`
- [ ] All 5 consumable types defined in `CONSUMABLE_DEFS`
- [ ] Bomb clears a visible 3×3 area of blocks in a single use
- [ ] Flare lifts fog in a 7×7 area around player
- [ ] Shield Charge absorbs next hazard hit with no damage and no quiz
- [ ] Drill Charge bores 5 blocks in a straight line in the player's facing direction
- [ ] Sonar Pulse highlights mineral nodes on the minimap within 10 Manhattan tiles
- [ ] Consumable bar shows in HUD with correct icons and counts
- [ ] Block mining has a 4% chance of dropping a random consumable
- [ ] Carry limit enforced: adding a 6th consumable returns false and shows no toast
- [ ] `npm run typecheck` passes

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-6-consumable-hud.png' })
  // Use DevPanel to inject consumables
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    // Attempt to add all 5 consumable types via dev panel
    const addBomb = await page.$('[data-testid="dev-add-consumable-bomb"]')
    if (addBomb) {
      await addBomb.click()
      await page.waitForTimeout(200)
    }
    await page.screenshot({ path: '/tmp/ss-8-6-with-consumables.png' })
  }
  // Check consumable bar is visible
  const consumableBar = await page.$('[data-testid="consumable-bar"]')
  console.log('Consumable bar present:', !!consumableBar)
  // Check for carry limit enforcement
  const errors = await page.evaluate(() =>
    window.__consoleErrors ? window.__consoleErrors : []
  )
  console.log('Console errors:', errors)
  await browser.close()
  console.log('8.6 consumable tools test complete')
})()
```

### Verification Gate

All must pass before starting 8.7:
- [ ] `src/data/consumables.ts` exists with all 5 consumable types
- [ ] `InventoryManager` has `addConsumable`, `useConsumable`, `getConsumables`, `getTotalConsumableCount`
- [ ] `CONSUMABLE_DROP_CHANCE` exported from `balance.ts`
- [ ] Consumable HUD bar visible in screenshot at `/tmp/ss-8-6-consumable-hud.png`
- [ ] No console errors during a normal mine session
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean

---

## Sub-Phase 8.7: Biome Depth Tiers

### Overview

**Design Decision**: DD-V2-057 (cross-reference: Phase 9 for full biome content)

Biomes are organized into four depth tiers with 5 biomes each, plus 5 anomaly biomes that override the normal selection 10-15% of the time:

| Tier | Layers | Biome Count |
|---|---|---|
| Shallow | 1-5 | 5 |
| Mid | 6-10 | 5 |
| Deep | 11-15 | 5 |
| Extreme | 16-20 | 5 |
| Anomaly | Any | 5 (10-15% override) |

This sub-phase establishes the `BiomeDefinition` type expansion, the biome registry, and the selection algorithm. Actual biome art assets and unique gameplay rules are finalized in Phase 9. Here, each biome is wired with placeholder weights and the correct selection logic so downstream systems (hazard weights, mineral weights, tile themes) are structurally complete.

### Sub-Steps

**Step 1: Expand BiomeDefinition type**

File: `src/data/biomes.ts`

Replace or augment the existing `BiomeDefinition` with the full V2 type:

```typescript
export type BiomeTier = 'shallow' | 'mid' | 'deep' | 'extreme' | 'anomaly';

export interface BiomeHazardWeights {
  lavaBlockDensity: number;     // 0–1 multiplier on base lava density
  gasPocketDensity: number;     // 0–1 multiplier on base gas density
  unstableGroundChance: number; // 0–1 probability per empty cell
}

export interface BiomeMineralWeights {
  dustMultiplier: number;       // applies to Dust mineral type
  shardMultiplier: number;      // Shard
  crystalMultiplier: number;    // Crystal
  geodeMultiplier: number;      // Geode
  essenceMultiplier: number;    // Essence
  rareNodeBonus: number;        // flat bonus to rare node count
}

export interface BiomeDefinition {
  id: BiomeId;
  label: string;
  tier: BiomeTier;
  /** Layer range this biome appears in (inclusive) */
  layerRange: [number, number];
  /** 0–1 override probability for anomaly biomes; ignored for non-anomaly */
  anomalyChance?: number;
  hazardWeights: BiomeHazardWeights;
  mineralWeights: BiomeMineralWeights;
  /** Phaser scene-level tint color for tiles (hex) */
  ambientColor: number;
  /** Tile texture key prefix for this biome's stone/dirt variants */
  tileTheme: string;
  /** GAIA comment shown on first entry to this biome */
  gaiaEntryComment: string;
}
```

**Step 2: Define the 25 biome stubs**

File: `src/data/biomes.ts`

Add or replace `BIOME_REGISTRY` with all 25 entries. Use placeholder values for Phase 9 art:

```typescript
export type BiomeId =
  // Shallow (L1-5)
  | 'limestone_caves'   | 'clay_basin'        | 'iron_seam'         | 'root_tangle'       | 'peat_bog'
  // Mid (L6-10)
  | 'basalt_maze'       | 'salt_flats'        | 'coal_veins'        | 'granite_canyon'    | 'sulfur_springs'
  // Deep (L11-15)
  | 'obsidian_rift'     | 'magma_shelf'       | 'crystal_geode'     | 'fossil_layer'      | 'quartz_halls'
  // Extreme (L16-20)
  | 'primordial_mantle' | 'iron_core_fringe'  | 'pressure_dome'     | 'deep_biolume'      | 'tectonic_scar'
  // Anomaly
  | 'temporal_rift'     | 'alien_intrusion'   | 'bioluminescent'    | 'void_pocket'       | 'echo_chamber';

export const BIOME_REGISTRY: Record<BiomeId, BiomeDefinition> = {
  // --- Shallow Tier ---
  limestone_caves: {
    id: 'limestone_caves', label: 'Limestone Caves', tier: 'shallow',
    layerRange: [1, 5], ambientColor: 0xd4c8a8, tileTheme: 'limestone',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.1, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 1.5, shardMultiplier: 0.5, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 0 },
    gaiaEntryComment: "Carbonate rock, formed from ancient marine sediments. You are walking on ocean floor.",
  },
  clay_basin: {
    id: 'clay_basin', label: 'Clay Basin', tier: 'shallow',
    layerRange: [1, 5], ambientColor: 0xc4a882, tileTheme: 'clay',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 2.0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 0 },
    gaiaEntryComment: "Clay deposits indicate prolonged waterlogging. This region was once a shallow lake bed.",
  },
  iron_seam: {
    id: 'iron_seam', label: 'Iron Seam', tier: 'shallow',
    layerRange: [1, 5], ambientColor: 0x8b5a2b, tileTheme: 'iron',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0 },
    mineralWeights: { dustMultiplier: 0.8, shardMultiplier: 1.8, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 1 },
    gaiaEntryComment: "Banded iron formations. Some of these ore veins are 2.4 billion years old.",
  },
  root_tangle: {
    id: 'root_tangle', label: 'Root Tangle', tier: 'shallow',
    layerRange: [1, 5], ambientColor: 0x4a7c3f, tileTheme: 'root',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.2, unstableGroundChance: 0.15 },
    mineralWeights: { dustMultiplier: 1.0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0.5, rareNodeBonus: 0 },
    gaiaEntryComment: "Root systems can penetrate up to 60 meters in extreme cases. These belong to trees that fell centuries ago.",
  },
  peat_bog: {
    id: 'peat_bog', label: 'Peat Bog', tier: 'shallow',
    layerRange: [1, 5], ambientColor: 0x3d2b1f, tileTheme: 'peat',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.3, unstableGroundChance: 0.2 },
    mineralWeights: { dustMultiplier: 1.2, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0.8, rareNodeBonus: 0 },
    gaiaEntryComment: "Peat bogs preserve organic matter for millennia. Bog bodies have been found here — intact, eerily so.",
  },
  // --- Mid Tier (stubs — content expanded in Phase 9) ---
  basalt_maze: {
    id: 'basalt_maze', label: 'Basalt Maze', tier: 'mid',
    layerRange: [6, 10], ambientColor: 0x333344, tileTheme: 'basalt',
    hazardWeights: { lavaBlockDensity: 0.3, gasPocketDensity: 0.1, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 0.5, shardMultiplier: 1.5, crystalMultiplier: 0.5, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 0 },
    gaiaEntryComment: "Columnar basalt — lava that cooled and fractured into hexagonal prisms. Mathematics encoded in stone.",
  },
  salt_flats: {
    id: 'salt_flats', label: 'Salt Flats', tier: 'mid',
    layerRange: [6, 10], ambientColor: 0xe8e8e0, tileTheme: 'salt',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 2.0, crystalMultiplier: 0.3, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 2 },
    gaiaEntryComment: "Halite. Evaporite deposits from ancient inland seas. These crystals have been here since the Permian.",
  },
  coal_veins: {
    id: 'coal_veins', label: 'Coal Veins', tier: 'mid',
    layerRange: [6, 10], ambientColor: 0x1a1a1a, tileTheme: 'coal',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.5, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 0.5, shardMultiplier: 0.5, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 1.5, rareNodeBonus: 0 },
    gaiaEntryComment: "Compressed Carboniferous forest. Every lump of coal is a tree that lived 300 million years ago.",
  },
  granite_canyon: {
    id: 'granite_canyon', label: 'Granite Canyon', tier: 'mid',
    layerRange: [6, 10], ambientColor: 0x888080, tileTheme: 'granite',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0 },
    mineralWeights: { dustMultiplier: 0.3, shardMultiplier: 1.0, crystalMultiplier: 1.0, geodeMultiplier: 0.5, essenceMultiplier: 0, rareNodeBonus: 1 },
    gaiaEntryComment: "Granite forms from slowly cooling magma deep in the crust. What you see took millions of years to reach this surface.",
  },
  sulfur_springs: {
    id: 'sulfur_springs', label: 'Sulfur Springs', tier: 'mid',
    layerRange: [6, 10], ambientColor: 0xaaaa00, tileTheme: 'sulfur',
    hazardWeights: { lavaBlockDensity: 0.2, gasPocketDensity: 0.6, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 0.5, shardMultiplier: 0.5, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 2.0, rareNodeBonus: 0 },
    gaiaEntryComment: "Hydrothermal vents. The chemosynthetic organisms here do not require sunlight. Life finds a way.",
  },
  // --- Deep Tier ---
  obsidian_rift: {
    id: 'obsidian_rift', label: 'Obsidian Rift', tier: 'deep',
    layerRange: [11, 15], ambientColor: 0x110022, tileTheme: 'obsidian',
    hazardWeights: { lavaBlockDensity: 0.5, gasPocketDensity: 0.2, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0.5, crystalMultiplier: 1.5, geodeMultiplier: 1.0, essenceMultiplier: 0, rareNodeBonus: 2 },
    gaiaEntryComment: "Volcanic glass. Obsidian fractures with conchoidal edges sharp enough to outperform surgical steel.",
  },
  magma_shelf: {
    id: 'magma_shelf', label: 'Magma Shelf', tier: 'deep',
    layerRange: [11, 15], ambientColor: 0xff3300, tileTheme: 'magma',
    hazardWeights: { lavaBlockDensity: 0.8, gasPocketDensity: 0.3, unstableGroundChance: 0.2 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 1.0, geodeMultiplier: 2.0, essenceMultiplier: 0.5, rareNodeBonus: 3 },
    gaiaEntryComment: "You are near the boundary between crust and upper mantle. The Mohorovičić discontinuity is close.",
  },
  crystal_geode: {
    id: 'crystal_geode', label: 'Crystal Geode', tier: 'deep',
    layerRange: [11, 15], ambientColor: 0xaaffff, tileTheme: 'geode',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 3.0, geodeMultiplier: 3.0, essenceMultiplier: 0, rareNodeBonus: 5 },
    gaiaEntryComment: "A geode cavity of this scale forms over millions of years through hydrothermal fluid deposition.",
  },
  fossil_layer: {
    id: 'fossil_layer', label: 'Fossil Layer', tier: 'deep',
    layerRange: [11, 15], ambientColor: 0x887766, tileTheme: 'fossil',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.1, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0.5, geodeMultiplier: 0, essenceMultiplier: 2.0, rareNodeBonus: 2 },
    gaiaEntryComment: "The density of preserved organisms here suggests a mass extinction boundary. Likely the K-Pg event.",
  },
  quartz_halls: {
    id: 'quartz_halls', label: 'Quartz Halls', tier: 'deep',
    layerRange: [11, 15], ambientColor: 0xffffff, tileTheme: 'quartz',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 1.0, crystalMultiplier: 2.5, geodeMultiplier: 1.5, essenceMultiplier: 0, rareNodeBonus: 3 },
    gaiaEntryComment: "Pure quartz formations. Piezoelectric properties. Pressure applied here generates measurable current.",
  },
  // --- Extreme Tier ---
  primordial_mantle: {
    id: 'primordial_mantle', label: 'Primordial Mantle', tier: 'extreme',
    layerRange: [16, 20], ambientColor: 0xff6600, tileTheme: 'mantle',
    hazardWeights: { lavaBlockDensity: 1.0, gasPocketDensity: 0.5, unstableGroundChance: 0.3 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 1.0, geodeMultiplier: 2.0, essenceMultiplier: 3.0, rareNodeBonus: 5 },
    gaiaEntryComment: "You are in the upper mantle. Peridotite. Olivine. Rocks that have never seen a surface.",
  },
  iron_core_fringe: {
    id: 'iron_core_fringe', label: 'Iron Core Fringe', tier: 'extreme',
    layerRange: [16, 20], ambientColor: 0x882200, tileTheme: 'core',
    hazardWeights: { lavaBlockDensity: 0.8, gasPocketDensity: 0, unstableGroundChance: 0.4 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 3.0, essenceMultiplier: 5.0, rareNodeBonus: 8 },
    gaiaEntryComment: "The iron-nickel core begins approximately 2,890 km below the surface. You are metaphorically close.",
  },
  pressure_dome: {
    id: 'pressure_dome', label: 'Pressure Dome', tier: 'extreme',
    layerRange: [16, 20], ambientColor: 0x004488, tileTheme: 'pressure',
    hazardWeights: { lavaBlockDensity: 0.3, gasPocketDensity: 0.8, unstableGroundChance: 0.5 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 2.0, geodeMultiplier: 2.0, essenceMultiplier: 4.0, rareNodeBonus: 6 },
    gaiaEntryComment: "Pressure here exceeds anything achievable in a surface laboratory. Diamond formation conditions.",
  },
  deep_biolume: {
    id: 'deep_biolume', label: 'Deep Biolume', tier: 'extreme',
    layerRange: [16, 20], ambientColor: 0x003366, tileTheme: 'biolume',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.4, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 1.0, essenceMultiplier: 6.0, rareNodeBonus: 4 },
    gaiaEntryComment: "Bioluminescent extremophile colonies. These organisms have been evolving in complete darkness for geological timescales.",
  },
  tectonic_scar: {
    id: 'tectonic_scar', label: 'Tectonic Scar', tier: 'extreme',
    layerRange: [16, 20], ambientColor: 0x660000, tileTheme: 'tectonic',
    hazardWeights: { lavaBlockDensity: 0.6, gasPocketDensity: 0.6, unstableGroundChance: 0.6 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0.5, geodeMultiplier: 1.5, essenceMultiplier: 5.0, rareNodeBonus: 7 },
    gaiaEntryComment: "A fault boundary. Two tectonic plates once ground together here. The energy released was... considerable.",
  },
  // --- Anomaly Tier ---
  temporal_rift: {
    id: 'temporal_rift', label: 'Temporal Rift', tier: 'anomaly',
    layerRange: [1, 20], anomalyChance: 0.12, ambientColor: 0x8800ff, tileTheme: 'temporal',
    hazardWeights: { lavaBlockDensity: 0.3, gasPocketDensity: 0.3, unstableGroundChance: 0.3 },
    mineralWeights: { dustMultiplier: 1.5, shardMultiplier: 1.5, crystalMultiplier: 1.5, geodeMultiplier: 1.5, essenceMultiplier: 1.5, rareNodeBonus: 3 },
    gaiaEntryComment: "My sensors are reading inconsistent isotope signatures. The apparent age of this stratum changes with depth.",
  },
  alien_intrusion: {
    id: 'alien_intrusion', label: 'Alien Intrusion', tier: 'anomaly',
    layerRange: [1, 20], anomalyChance: 0.10, ambientColor: 0x00ff88, tileTheme: 'alien',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.5, unstableGroundChance: 0.2 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 2.0, crystalMultiplier: 2.0, geodeMultiplier: 3.0, essenceMultiplier: 3.0, rareNodeBonus: 10 },
    gaiaEntryComment: "Non-terrestrial mineral composition detected. This rock did not form on Earth.",
  },
  bioluminescent: {
    id: 'bioluminescent', label: 'Bioluminescent Grotto', tier: 'anomaly',
    layerRange: [1, 20], anomalyChance: 0.10, ambientColor: 0x00ffcc, tileTheme: 'grotto',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 10.0, rareNodeBonus: 5 },
    gaiaEntryComment: "These organisms emit light via luciferin oxidation. In the darkness below, they create their own day.",
  },
  void_pocket: {
    id: 'void_pocket', label: 'Void Pocket', tier: 'anomaly',
    layerRange: [1, 20], anomalyChance: 0.08, ambientColor: 0x000000, tileTheme: 'void',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0.8 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 5.0, essenceMultiplier: 5.0, rareNodeBonus: 12 },
    gaiaEntryComment: "Acoustic monitoring returns no echoes. This cavity has been sealed for an estimated 400 million years.",
  },
  echo_chamber: {
    id: 'echo_chamber', label: 'Echo Chamber', tier: 'anomaly',
    layerRange: [1, 20], anomalyChance: 0.10, ambientColor: 0x666699, tileTheme: 'echo',
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.2, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 1.0, shardMultiplier: 1.0, crystalMultiplier: 1.0, geodeMultiplier: 1.0, essenceMultiplier: 1.0, rareNodeBonus: 2 },
    gaiaEntryComment: "The resonance frequency of this chamber matches human vocal range. Ancient cultures considered such spaces sacred.",
  },
};
```

**Step 3: Biome selection algorithm**

File: `src/game/MineGenerator.ts`

Add `selectBiome(layer: number, rng: () => number): BiomeId`:

```typescript
import { BIOME_REGISTRY, type BiomeId, type BiomeTier } from '../data/biomes';

/**
 * Selects a biome for the given layer.
 * Anomaly biomes override the tier selection at their configured chance.
 * Otherwise a random biome within the layer's tier is selected. (DD-V2-057)
 */
function selectBiome(layer: number, rng: () => number): BiomeId {
  const ANOMALY_OVERRIDE_CHANCE = 0.12;  // 12% base anomaly chance

  // Roll for anomaly override first
  if (rng() < ANOMALY_OVERRIDE_CHANCE) {
    const anomalyBiomes = Object.values(BIOME_REGISTRY)
      .filter(b => b.tier === 'anomaly');
    return anomalyBiomes[Math.floor(rng() * anomalyBiomes.length)].id;
  }

  // Select tier based on layer
  const tier: BiomeTier =
    layer <= 5  ? 'shallow' :
    layer <= 10 ? 'mid'     :
    layer <= 15 ? 'deep'    : 'extreme';

  const tierBiomes = Object.values(BIOME_REGISTRY)
    .filter(b => b.tier === tier);
  return tierBiomes[Math.floor(rng() * tierBiomes.length)].id;
}
```

**Step 4: Apply biome weights to MineGenerator**

File: `src/game/MineGenerator.ts`

In `getBlockWeightsForLayer`, incorporate the active biome's `hazardWeights` and `mineralWeights` as multipliers on the base depth-derived weights:

```typescript
function getBlockWeightsForLayer(layer: number, biome: BiomeDefinition): BlockWeights {
  const depth = (layer - 1) / 19;
  const base = {
    dirt:        lerp(0.35, 0.02, depth),
    softRock:    lerp(0.20, 0.08, depth),
    stone:       lerp(0.25, 0.20, depth),
    hardRock:    lerp(0.00, 0.35, depth),
    lavaBlock:   layer >= 8  ? lerp(0.01, 0.04, (layer - 8) / 12) : 0,
    gasPocket:   layer >= 5  ? lerp(0.01, 0.03, (layer - 5) / 15) : 0,
    mineralNode: layer <= 12 ? lerp(0.05, 0.08, depth) : lerp(0.08, 0.04, (layer - 12) / 8),
    artifactNode: lerp(0.01, 0.06, depth),
    fossilNode:  lerp(0.01, 0.03, depth),
  };
  return {
    ...base,
    lavaBlock:  base.lavaBlock  * biome.hazardWeights.lavaBlockDensity,
    gasPocket:  base.gasPocket  * biome.hazardWeights.gasPocketDensity,
    mineralNode: base.mineralNode * Math.max(
      biome.mineralWeights.dustMultiplier,
      biome.mineralWeights.shardMultiplier,
      biome.mineralWeights.crystalMultiplier,
      0.1
    ),
  };
}
```

**Step 5: Apply ambient color tint in MineScene**

File: `src/game/scenes/MineScene.ts`

After generating a mine and determining the biome, apply the biome's `ambientColor` as a global tint to the mine tile layer:

```typescript
import { BIOME_REGISTRY } from '../../data/biomes';

// In create(), after generateMine():
const biomeDef = BIOME_REGISTRY[this.currentBiome];
this.cameras.main.setBackgroundColor(biomeDef.ambientColor);
```

**Step 6: GAIA biome entry comment**

File: `src/game/managers/GaiaManager.ts`

On entering a new layer (after biome selection), fire a one-time GAIA toast with `biomeDef.gaiaEntryComment`:

```typescript
onBiomeEntry(biomeId: BiomeId): void {
  const biomeDef = BIOME_REGISTRY[biomeId];
  if (biomeDef && !this.shownBiomeComments.has(biomeId)) {
    this.shownBiomeComments.add(biomeId);
    this.toast(biomeDef.gaiaEntryComment);
  }
}
```

**Step 7: Derived biome store for HUD**

File: `src/ui/stores/gameState.ts`

```typescript
export const currentBiomeId = writable<BiomeId>('limestone_caves');

export const currentBiomeDef = derived(currentBiomeId, id => BIOME_REGISTRY[id]);
```

Display `$currentBiomeDef.label` in the HUD alongside the layer/tier label from 8.2.

### Acceptance Criteria

- [ ] `BiomeDefinition` type includes `hazardWeights`, `mineralWeights`, `ambientColor`, `tileTheme`, `gaiaEntryComment`
- [ ] `BIOME_REGISTRY` contains exactly 25 entries (5 shallow + 5 mid + 5 deep + 5 extreme + 5 anomaly)
- [ ] `selectBiome(3, rng)` always returns a shallow-tier biome (unless anomaly override triggers)
- [ ] `selectBiome(17, rng)` always returns an extreme-tier biome (unless anomaly override triggers)
- [ ] Anomaly biome override fires approximately 10-15% of the time (verified over 100 calls in unit test)
- [ ] Mine background color visually changes between biomes (screenshot comparison)
- [ ] GAIA entry comment toast fires once per unique biome per session
- [ ] HUD shows biome label alongside layer number
- [ ] `npm run typecheck` passes

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-7-shallow-biome.png' })
  // Check that biome label is shown in HUD
  const bodyText = await page.textContent('body')
  const hasBiomeName = [
    'Limestone', 'Clay', 'Iron Seam', 'Root', 'Peat',
    'Basalt', 'Salt', 'Coal', 'Granite', 'Sulfur',
    'Temporal', 'Alien', 'Bioluminescent', 'Void', 'Echo'
  ].some(name => bodyText.includes(name))
  console.log('Biome name visible in HUD:', hasBiomeName)
  // Use DevPanel to force a specific biome
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    const biomeSelect = await page.$('[data-testid="dev-set-biome"]')
    if (biomeSelect) {
      await biomeSelect.selectOption('temporal_rift')
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-8-7-anomaly-biome.png' })
    }
  }
  await browser.close()
  console.log('8.7 biome depth tiers test complete')
})()
```

### Verification Gate

All must pass before starting 8.8:
- [ ] `src/data/biomes.ts` has `BiomeDefinition` with all required fields
- [ ] `BIOME_REGISTRY` has exactly 25 entries
- [ ] `selectBiome` exported from `MineGenerator.ts`
- [ ] Screenshots at `/tmp/ss-8-7-shallow-biome.png` and `/tmp/ss-8-7-anomaly-biome.png` taken
- [ ] Two screenshots have visually different background colors
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean

---

## Sub-Phase 8.8: Quiz System Overhaul

### Overview

**Design Decisions**: DD-V2-060, DD-V2-063, DD-V2-085 through DD-V2-134

This sub-phase overhauls the existing quiz system to implement the full learning model defined in the Learning & Content Q&A Batch 2:

- **Adaptive quiz rate**: 8% base chance per block mined, 15-block cooldown between quizzes, -2% fatigue penalty per quiz after 5 quizzes in a session, first quiz always after 10 blocks explored
- **Quiz type split**: Review quizzes (reps ≥ 1) apply O2 penalties on wrong answers; Discovery quizzes (first exposure, reps = 0) are reward-only — no penalties
- **O2 always paused during quiz overlays** — no exceptions
- **Hazard quizzes**: triggered by hazard contact (from 8.3); correct = reduced damage, wrong = full damage; do not affect SM-2 state
- **Fact-agnostic depth**: same facts appear at any depth; difficulty is delivered via distractor quality and consequence severity, never by changing which facts appear
- **3-button study**: Easy (SM-2 q=5), Got it (q=4), Didn't get it (q=1)
- **Teaching moments**: when a new fact is presented for the first time, show the full fact card before presenting the question; first exposure is NOT SM-2 graded

### Sub-Steps

**Step 1: Add quiz rate constants to balance**

File: `src/data/balance.ts`

```typescript
// ---- Quiz Rate System (DD-V2-060, DD-V2-085) ----
export const QUIZ_BASE_RATE = 0.08;                 // 8% chance per block mined
export const QUIZ_COOLDOWN_BLOCKS = 15;             // blocks between quiz triggers
export const QUIZ_FIRST_TRIGGER_AFTER_BLOCKS = 10; // first quiz after 10 blocks explored
export const QUIZ_FATIGUE_PENALTY_PER_QUIZ = 0.02; // -2% rate after each quiz past threshold
export const QUIZ_FATIGUE_THRESHOLD = 5;            // quizzes before fatigue kicks in
export const QUIZ_MIN_RATE = 0.02;                  // floor: never below 2% even with fatigue
```

**Step 2: Refactor QuizManager rate logic**

File: `src/game/managers/QuizManager.ts`

Replace any existing rate logic with:

```typescript
export class QuizManager {
  private blocksSinceLastQuiz = 0;
  private totalBlocksThisDive = 0;
  private quizzesThisDive = 0;
  private quizActive = false;

  /**
   * Call after every block is mined. Returns true if a quiz should trigger.
   * Enforces cooldown, fatigue, and first-quiz-after-10 rules. (DD-V2-060)
   */
  shouldTriggerQuiz(): boolean {
    this.totalBlocksThisDive++;
    this.blocksSinceLastQuiz++;

    // First quiz rule: never before block 10
    if (this.totalBlocksThisDive < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS) return false;

    // Cooldown rule: must wait QUIZ_COOLDOWN_BLOCKS between quizzes
    if (this.blocksSinceLastQuiz < QUIZ_COOLDOWN_BLOCKS) return false;

    // Compute effective rate with fatigue
    const excessQuizzes = Math.max(0, this.quizzesThisDive - QUIZ_FATIGUE_THRESHOLD);
    const effectiveRate = Math.max(
      QUIZ_MIN_RATE,
      QUIZ_BASE_RATE - (excessQuizzes * QUIZ_FATIGUE_PENALTY_PER_QUIZ)
    );

    if (Math.random() < effectiveRate) {
      this.blocksSinceLastQuiz = 0;
      this.quizzesThisDive++;
      return true;
    }
    return false;
  }

  resetForDive(): void {
    this.blocksSinceLastQuiz = 0;
    this.totalBlocksThisDive = 0;
    this.quizzesThisDive = 0;
    this.quizActive = false;
  }
}
```

**Step 3: Discovery vs Review quiz routing**

File: `src/game/managers/QuizManager.ts`

Add `triggerQuiz()` method that selects the appropriate quiz type:

```typescript
import { factsDB } from '../../services/factsDB';

/**
 * Triggers a quiz for the given context.
 * - If a fact with reps=0 exists in the player's queue, shows Discovery quiz (reward-only).
 * - Otherwise shows a Review quiz (O2 penalty on wrong).
 * (DD-V2-063, DD-V2-097)
 */
async triggerQuiz(context: 'mine' | 'dome' | 'hazard'): Promise<void> {
  if (this.quizActive) return;
  this.quizActive = true;

  // Pause O2 drain immediately (DD-V2-085)
  gameManager.pauseO2();

  const discoveryFact = await factsDB.getNextDiscoveryFact();

  if (discoveryFact && context !== 'hazard') {
    await this.showDiscoveryQuiz(discoveryFact);
  } else {
    const reviewFact = await factsDB.getNextReviewFact();
    if (!reviewFact) {
      this.quizActive = false;
      gameManager.resumeO2();
      return;
    }
    await this.showReviewQuiz(reviewFact, context);
  }

  this.quizActive = false;
  gameManager.resumeO2();
}
```

**Step 4: Discovery quiz — full card first, then question**

File: `src/game/managers/QuizManager.ts`

```typescript
private async showDiscoveryQuiz(fact: FactRecord): Promise<void> {
  // Step 1: Show full fact card (teaching moment)
  await overlayManager.showFactCard({
    fact,
    mode: 'discovery',
    onContinue: () => overlayManager.closeFactCard(),
  });

  // Step 2: Show the quiz question (reward-only, no SM-2 grading)
  await overlayManager.showQuiz({
    fact,
    triggerSource: 'discovery',
    onCorrect: () => {
      // Reward: O2 gain, GAIA praise
      gameManager.drainOxygen(-QUIZ_DISCOVERY_O2_REWARD);
      gaiaManager.toastCorrect(fact);
      // Mark as seen (reps=1) but do NOT run SM-2 interval calculation
      factsDB.markFirstExposure(fact.id);
    },
    onWrong: () => {
      // No penalty on discovery; show explanation
      gaiaManager.toastWrong(fact, 'discovery');
      factsDB.markFirstExposure(fact.id);
    },
  });
}
```

Add to `src/data/balance.ts`:
```typescript
export const QUIZ_DISCOVERY_O2_REWARD = 5;   // O2 bonus for correct answer on first exposure
export const QUIZ_REVIEW_O2_PENALTY  = 8;    // O2 penalty for wrong answer on review quiz (base)
```

**Step 5: Review quiz — 3-button study response**

File: `src/game/managers/QuizManager.ts`

```typescript
private async showReviewQuiz(fact: FactRecord, context: 'mine' | 'dome' | 'hazard'): Promise<void> {
  await overlayManager.showQuiz({
    fact,
    triggerSource: context,
    // 3-button layout: Easy | Got it | Didn't get it
    responseMode: 'three_button',
    onEasy: () => {
      factsDB.updateSM2(fact.id, 5);  // q=5
      gaiaManager.toastMastery(fact);
    },
    onGotIt: () => {
      factsDB.updateSM2(fact.id, 4);  // q=4
      gaiaManager.toastCorrect(fact);
    },
    onDidntGetIt: () => {
      factsDB.updateSM2(fact.id, 1);  // q=1 (resets interval)
      if (context !== 'hazard') {
        // Apply O2 penalty for review misses in mine (not hazard context — handled separately)
        gameManager.drainOxygen(QUIZ_REVIEW_O2_PENALTY);
      }
      gaiaManager.toastWrong(fact, context);
      this.trackFailureEscalation(fact.id);
    },
  });
}
```

**Step 6: Failure escalation tracking**

File: `src/game/managers/QuizManager.ts`

```typescript
private failureCounts: Map<string, number> = new Map();

private trackFailureEscalation(factId: string): void {
  const count = (this.failureCounts.get(factId) ?? 0) + 1;
  this.failureCounts.set(factId, count);

  if (count <= 2) {
    // Wrong 1-2x: show explanation + mnemonic
    overlayManager.showFactExplanation(factId, 'mnemonic');
  } else if (count <= 4) {
    // Wrong 3-4x: alternate explanation
    overlayManager.showFactExplanation(factId, 'alternate');
  } else {
    // Wrong 5+: suggest deep study
    gaiaManager.toast(
      "This one is proving difficult. Consider a study session in the Dome — I will focus on it with you."
    );
    overlayManager.showFactExplanation(factId, 'deep_study_prompt');
  }
}
```

**Step 7: O2 pause integration**

File: `src/game/GameManager.ts`

Add `pauseO2()` and `resumeO2()` methods that toggle the `quizActive` flag checked by `drainO2WithDepth()` (established in 8.4):

```typescript
pauseO2(): void  { this.quizActive = true; }
resumeO2(): void { this.quizActive = false; }
```

**Step 8: lastReviewContext tracking**

File: `src/services/factsDB.ts`

When updating SM-2 state, record the context in which the review occurred:

```typescript
export type ReviewContext = 'mine' | 'dome' | 'study_session' | 'hazard';

// Add to FactRecord schema:
// lastReviewContext: ReviewContext | null
// lastReviewedAt: number (timestamp)

async updateSM2WithContext(
  factId: string,
  quality: number,
  context: ReviewContext
): Promise<void> {
  // ... existing SM-2 update logic ...
  await db.run(
    `UPDATE facts SET lastReviewContext = ?, lastReviewedAt = ? WHERE id = ?`,
    [context, Date.now(), factId]
  );
}
```

**Step 9: Update QuizOverlay Svelte component for 3-button layout**

File: `src/ui/components/QuizOverlay.svelte`

Add a `responseMode: 'standard' | 'three_button'` prop. When `responseMode === 'three_button'`, render three buttons instead of the existing answer options:

```svelte
{#if responseMode === 'three_button'}
  <div class="response-buttons">
    <button class="btn-easy"    on:click={onEasy}>Easy</button>
    <button class="btn-got-it"  on:click={onGotIt}>Got it</button>
    <button class="btn-didnt"   on:click={onDidntGetIt}>Didn't get it</button>
  </div>
{/if}
```

Style: Easy = green, Got it = blue, Didn't get it = orange/red.

### Acceptance Criteria

- [ ] First quiz triggers after exactly 10 blocks mined in a new dive (never before)
- [ ] Minimum 15 blocks between any two consecutive quiz triggers
- [ ] After 5 quizzes in a session, effective rate measurably lower than 8% (confirm via DevPanel or console log)
- [ ] Discovery quiz shows full fact card before the question
- [ ] Discovery quiz correct answer grants O2 without penalty; wrong shows explanation only
- [ ] Review quiz shows 3 buttons: Easy / Got it / Didn't get it
- [ ] Wrong answer on Review quiz in mine context drains `QUIZ_REVIEW_O2_PENALTY` O2
- [ ] O2 drain is zero while any quiz overlay is open
- [ ] `lastReviewContext` persisted in facts DB after each review
- [ ] Failure escalation: 1-2 wrong = mnemonic; 3-4 = alternate; 5+ = study suggestion
- [ ] Hazard quiz (from 8.3) does NOT call `updateSM2`
- [ ] `npm run typecheck` passes

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-8-mine-base.png' })
  // Force quiz trigger via DevPanel
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    const forceQuiz = await page.$('[data-testid="dev-force-quiz"]')
    if (forceQuiz) {
      await forceQuiz.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-8-8-quiz-overlay.png' })
      // Verify 3-button layout or standard layout
      const easyBtn = await page.$('button:has-text("Easy")')
      const gotItBtn = await page.$('button:has-text("Got it")')
      const didntBtn = await page.$('button:has-text("Didn\'t get it")')
      console.log('3-button layout present:', !!(easyBtn && gotItBtn && didntBtn))
    }
    // Force a discovery quiz
    const forceDiscovery = await page.$('[data-testid="dev-force-discovery-quiz"]')
    if (forceDiscovery) {
      await forceDiscovery.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-8-8-discovery-quiz.png' })
    }
  }
  await browser.close()
  console.log('8.8 quiz system overhaul test complete')
})()
```

### Verification Gate

All must pass before starting 8.9:
- [ ] `QUIZ_BASE_RATE`, `QUIZ_COOLDOWN_BLOCKS`, `QUIZ_FIRST_TRIGGER_AFTER_BLOCKS` exported from `balance.ts`
- [ ] `QuizManager.shouldTriggerQuiz()` method exists
- [ ] `QuizManager.triggerQuiz()` method distinguishes discovery vs review
- [ ] 3-button response layout present in `QuizOverlay.svelte`
- [ ] `factsDB.updateSM2WithContext()` accepts `ReviewContext` param
- [ ] Screenshots at `/tmp/ss-8-8-quiz-overlay.png` and `/tmp/ss-8-8-discovery-quiz.png` taken
- [ ] No O2 drain occurs while quiz overlay is open (confirmed via DevPanel O2 log)
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean

---

## Sub-Phase 8.9: SM-2 Algorithm Tuning

### Overview

**Design Decisions**: DD-V2-085 through DD-V2-134 (Learning & Content Q&A Batch 2)

This sub-phase tunes the SM-2 spaced repetition parameters to match the Terra Miner learning model and adds the mastery tracking, color progression, and failure escalation infrastructure.

Key changes from SM-2 defaults:
- Second interval = **3 days** (SM-2 default is 6 days; shorter for mobile game pace)
- Consistency penalty: **5 O2 at reps ≥ 4** (DD-V2-095; replaces the old 8 O2 at reps ≥ 2 rule)
- `lastReviewContext` field tracked per fact (introduced in 8.8; used here for analytics)
- Mastery thresholds: general facts at **60-day interval or more**, vocab at **30-day interval or more**
- Color progression: **grayscale** (unseen/early) → **orange/autumn** (learning) → **green** (mastered)
- Rotating GAIA comments: `gaiaComments` array (3-5 entries per fact) replaces single `gaiaComment` string

### Sub-Steps

**Step 1: Update SM-2 second interval constant**

File: `src/data/balance.ts`

```typescript
// ---- SM-2 Tuning Constants (DD-V2-085, DD-V2-095) ----
export const SM2_SECOND_INTERVAL_DAYS = 3;          // second interval: 3 days (default SM-2 = 6)
export const SM2_CONSISTENCY_PENALTY_O2 = 5;        // O2 drained when lapsing a mature fact
export const SM2_CONSISTENCY_PENALTY_REPS_MIN = 4;  // minimum reps before penalty applies
export const SM2_MASTERY_INTERVAL_GENERAL = 60;     // days — general fact mastered threshold
export const SM2_MASTERY_INTERVAL_VOCAB   = 30;     // days — vocab fact mastered threshold
export const SM2_INITIAL_EASE_FACTOR = 2.5;         // standard SM-2 default
export const SM2_MIN_EASE_FACTOR = 1.3;             // floor on ease factor
```

**Step 2: Update SM-2 interval calculation in factsDB**

File: `src/services/factsDB.ts`

Find the SM-2 `updateSM2` (or equivalent) function and apply the second-interval override:

```typescript
import {
  SM2_SECOND_INTERVAL_DAYS,
  SM2_INITIAL_EASE_FACTOR,
  SM2_MIN_EASE_FACTOR,
} from '../data/balance';

/**
 * SM-2 algorithm with Terra Miner tuning.
 * Second interval = 3 days instead of SM-2 default of 6. (DD-V2-085)
 */
function calcNextInterval(reps: number, prevInterval: number, easeFactor: number, quality: number): {
  nextInterval: number;
  nextEaseFactor: number;
  nextReps: number;
} {
  if (quality < 3) {
    // Failed: reset to beginning
    return { nextInterval: 1, nextEaseFactor: Math.max(SM2_MIN_EASE_FACTOR, easeFactor - 0.2), nextReps: 0 };
  }

  let nextReps = reps + 1;
  let nextInterval: number;

  if (reps === 0) {
    nextInterval = 1;
  } else if (reps === 1) {
    nextInterval = SM2_SECOND_INTERVAL_DAYS;  // 3 days (tuned from SM-2 default of 6)
  } else {
    nextInterval = Math.round(prevInterval * easeFactor);
  }

  const nextEaseFactor = Math.max(
    SM2_MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  return { nextInterval, nextEaseFactor, nextReps };
}
```

**Step 3: Consistency penalty on lapse of mature fact**

File: `src/services/factsDB.ts`

In `updateSM2` (called from `QuizManager`), after computing the quality score, apply the O2 penalty if the player lapses a mature fact:

```typescript
import { SM2_CONSISTENCY_PENALTY_O2, SM2_CONSISTENCY_PENALTY_REPS_MIN } from '../data/balance';

async updateSM2(factId: string, quality: number): Promise<void> {
  const fact = await this.getFact(factId);
  const isLapse = quality < 3;
  const isMatureFact = (fact.reps ?? 0) >= SM2_CONSISTENCY_PENALTY_REPS_MIN;

  if (isLapse && isMatureFact) {
    // Consistency penalty: player hasn't kept up with a fact they previously knew well
    gameManager.drainOxygen(SM2_CONSISTENCY_PENALTY_O2);
    gaiaManager.toast(`Consistency penalty: −${SM2_CONSISTENCY_PENALTY_O2} O2. Keep reviewing regularly.`);
  }

  const { nextInterval, nextEaseFactor, nextReps } = calcNextInterval(
    fact.reps ?? 0,
    fact.interval ?? 0,
    fact.easeFactor ?? SM2_INITIAL_EASE_FACTOR,
    quality
  );

  await db.run(
    `UPDATE facts SET reps = ?, interval = ?, easeFactor = ?, nextReviewAt = ? WHERE id = ?`,
    [nextReps, nextInterval, nextEaseFactor, Date.now() + nextInterval * 86400000, factId]
  );
}
```

**Step 4: Mastery threshold check**

File: `src/services/factsDB.ts`

```typescript
import { SM2_MASTERY_INTERVAL_GENERAL, SM2_MASTERY_INTERVAL_VOCAB } from '../data/balance';

/**
 * Returns true if the fact has reached the mastery threshold for its category.
 * General: interval ≥ 60 days. Vocab: interval ≥ 30 days. (DD-V2-099)
 */
function isMastered(fact: FactRecord): boolean {
  const threshold = fact.category === 'vocab'
    ? SM2_MASTERY_INTERVAL_VOCAB
    : SM2_MASTERY_INTERVAL_GENERAL;
  return (fact.interval ?? 0) >= threshold;
}
```

Expose as `async checkMastery(factId: string): Promise<boolean>` and call it after every `updateSM2` call. On first mastery:

```typescript
async onFirstMastery(fact: FactRecord): Promise<void> {
  await db.run(`UPDATE facts SET masteredAt = ? WHERE id = ?`, [Date.now(), fact.id]);
  overlayManager.showMasteryScreen(fact);          // Full-screen celebration (DD-V2-100)
  gaiaManager.showMasteryMonologue(fact);          // Unique GAIA monologue
  playerData.incrementMasteredCount();
}
```

**Step 5: Color progression for Knowledge Tree and fact cards**

File: `src/ui/components/FactCard.svelte` and `src/ui/components/KnowledgeTree.svelte`

Add a `getMasteryColor(fact: FactRecord): string` utility:

```typescript
// In src/ui/utils/masteryColor.ts (new file)
import type { FactRecord } from '../../data/types';

/**
 * Returns a CSS color string for the given fact's learning stage.
 * Grayscale = unseen or very early (reps < 2)
 * Orange/autumn = actively learning (reps 2-5, or interval < mastery threshold)
 * Green = mastered (interval ≥ mastery threshold)
 * (DD-V2-099)
 */
export function getMasteryColor(fact: FactRecord): string {
  if ((fact.reps ?? 0) < 2) return '#888888';           // grayscale — unseen
  const threshold = fact.category === 'vocab' ? 30 : 60;
  if ((fact.interval ?? 0) >= threshold) return '#44bb44';  // green — mastered
  return '#e07820';                                     // orange/autumn — learning
}
```

Apply `getMasteryColor` to:
- Fact card border/header tint in `FactCard.svelte`
- Knowledge Tree node fill color in `KnowledgeTree.svelte`
- HUD "facts mastered" counter icon color

**Step 6: Rotate GAIA comments per fact**

File: `src/data/types.ts` (or wherever `FactRecord` is defined)

Change `gaiaComment: string` to `gaiaComments: string[]`. If the fact data has a single `gaiaComment` (legacy), wrap it in an array at load time.

File: `src/game/managers/GaiaManager.ts`

Replace single-comment access with rotation:

```typescript
/**
 * Returns a rotating GAIA comment for the given fact.
 * Cycles through gaiaComments array deterministically based on review count.
 */
getGaiaComment(fact: FactRecord): string {
  const comments = fact.gaiaComments ?? [fact.gaiaComment ?? ''];
  const idx = (fact.reps ?? 0) % comments.length;
  return comments[idx];
}
```

**Step 7: Review forecast store**

File: `src/ui/stores/reviewForecast.ts` (new file)

```typescript
import { writable, derived } from 'svelte/store';
import { factsDB } from '../../services/factsDB';

export const reviewForecastRaw = writable<{ today: number; tomorrow: number; thisWeek: number }>({
  today: 0,
  tomorrow: 0,
  thisWeek: 0,
});

/** Call this when player enters the dome or starts the app. */
export async function refreshReviewForecast(): Promise<void> {
  const now = Date.now();
  const DAY = 86400000;

  const allDue = await factsDB.getAllFacts();
  const today    = allDue.filter(f => (f.nextReviewAt ?? 0) <= now + DAY).length;
  const tomorrow = allDue.filter(f => (f.nextReviewAt ?? 0) <= now + 2 * DAY).length;
  const thisWeek = allDue.filter(f => (f.nextReviewAt ?? 0) <= now + 7 * DAY).length;

  reviewForecastRaw.set({ today, tomorrow, thisWeek });
}
```

**Step 8: Display review forecast on Dome screen**

File: Dome screen component (identify via grep in `src/ui/components/`)

Display the review forecast:
```
Today: 8   Tomorrow: 12   This week: 43
```

Format in a card or banner near the top of the Dome home view. Use `refreshReviewForecast()` on dome entry.

### Acceptance Criteria

- [ ] `SM2_SECOND_INTERVAL_DAYS === 3` exported from `balance.ts`
- [ ] Second SM-2 interval is 3 days, not 6 (verify: fact with reps=1 gets nextReviewAt ≈ now + 3 days)
- [ ] Lapsing a fact with reps ≥ 4 drains exactly 5 O2 (consistency penalty)
- [ ] Lapsing a fact with reps < 4 does NOT drain O2 from consistency penalty
- [ ] `isMastered(fact)` returns true for general facts at interval ≥ 60 days
- [ ] `isMastered(fact)` returns true for vocab facts at interval ≥ 30 days
- [ ] First mastery triggers full-screen celebration overlay
- [ ] Fact card border color: gray for reps < 2, orange for learning, green for mastered
- [ ] Knowledge Tree node colors match mastery progression
- [ ] `gaiaComments` array rotates comment selection (verify by reviewing same fact multiple times)
- [ ] Review forecast shows Today / Tomorrow / This week counts on Dome screen
- [ ] `npm run typecheck` passes

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-8-9-dome-base.png' })
  // Check review forecast on dome screen
  const bodyText = await page.textContent('body')
  const hasForecast = bodyText.includes('Today') && bodyText.includes('Tomorrow')
  console.log('Review forecast visible on dome:', hasForecast)
  // Enter mine and force a review quiz, then answer "Didn't get it"
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-9-mine.png' })
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    // Force a review quiz
    const forceReview = await page.$('[data-testid="dev-force-review-quiz"]')
    if (forceReview) {
      await forceReview.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-8-9-review-quiz.png' })
      const didntBtn = await page.$('button:has-text("Didn\'t get it")')
      if (didntBtn) {
        await didntBtn.click()
        await page.waitForTimeout(500)
        await page.screenshot({ path: '/tmp/ss-8-9-after-wrong.png' })
      }
    }
    // Force first-mastery event
    const forceMastery = await page.$('[data-testid="dev-trigger-mastery"]')
    if (forceMastery) {
      await forceMastery.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-8-9-mastery-screen.png' })
    }
  }
  await browser.close()
  console.log('8.9 SM-2 tuning test complete')
})()
```

### Verification Gate

All must pass before starting 8.10:
- [ ] `SM2_SECOND_INTERVAL_DAYS`, `SM2_CONSISTENCY_PENALTY_O2`, `SM2_MASTERY_INTERVAL_GENERAL`, `SM2_MASTERY_INTERVAL_VOCAB` exported from `balance.ts`
- [ ] `calcNextInterval(1, 1, 2.5, 4).nextInterval === 3` (second interval = 3 days)
- [ ] `getMasteryColor` utility exists in `src/ui/utils/masteryColor.ts`
- [ ] `reviewForecast.ts` store exists in `src/ui/stores/`
- [ ] Review forecast visible on Dome screen in screenshot `/tmp/ss-8-9-dome-base.png`
- [ ] Mastery celebration screen appears in screenshot `/tmp/ss-8-9-mastery-screen.png`
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean

---

## Sub-Phase 8.10: Relic System Expansion

### Overview

**Design Decisions**: DD-V2-068, DD-V2-062 (Binding of Isaac philosophy)

Expand the existing placeholder relic system into a full three-tier relic framework with four archetypes, synergy bonuses, and diverse drop sources. Relics are the primary vehicle for run-defining power (DD-V2-062 — Binding of Isaac philosophy: powerful in-run builds, but SM-2 learning rate is NEVER affected by relic power).

Tiers: **Common** (small incremental bonuses), **Rare** (meaningful power spikes), **Legendary** (run-defining effects that fundamentally alter gameplay). Each relic belongs to one of four archetypes: Explorer (movement/reveal), Miner (damage/speed), Scholar (quiz bonuses/O2), Survivor (defense/healing). Equipping two or more relics of the same archetype triggers a synergy bonus.

Drop sources: special mineral nodes (RareNode block type), landmark layer rewards (8.5), and crafting via the recipe system.

### Sub-Steps

**Step 1: Define RelicDefinition and RelicEffect types**

File: `src/data/relics.ts` (new file if not present, otherwise extend)

```typescript
/**
 * Relic tier controls power level. Legendary = run-defining. (DD-V2-062, DD-V2-068)
 */
export type RelicTier = 'common' | 'rare' | 'legendary';

/**
 * Relic archetypes determine synergy groupings.
 * Explorer: movement speed, reveal radius, fog reduction.
 * Miner: block damage, mining speed, critical hits.
 * Scholar: quiz rewards, O2 cost reduction, SM-2 bonuses (visual only — never affects actual SM-2 algorithm).
 * Survivor: incoming damage reduction, passive O2 regen, knockback resistance.
 */
export type RelicArchetype = 'explorer' | 'miner' | 'scholar' | 'survivor';

/**
 * A single stat modification carried by a relic.
 * All numeric fields are additive multipliers unless noted.
 */
export interface RelicEffect {
  /** Unique identifier for the effect type (e.g. 'moveSpeed', 'blockDamage', 'quizO2Reward'). */
  effectId: string;
  /** Human-readable description of what this effect does. */
  description: string;
  /** Numeric magnitude. Interpretation depends on effectId. */
  magnitude: number;
}

/**
 * Full definition of a relic item.
 */
export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  lore: string;
  tier: RelicTier;
  archetype: RelicArchetype;
  effects: RelicEffect[];
  /** Key into Phaser texture atlas for this relic's sprite. */
  spriteKey: string;
  /** Drop weight (1–100). Higher = more common within its tier. */
  dropWeight: number;
}

/**
 * Synergy bonus granted when 2+ equipped relics share the same archetype.
 */
export interface ArchetypeSynergyBonus {
  archetype: RelicArchetype;
  /** Minimum number of equipped relics of this archetype to trigger. */
  threshold: number;
  effects: RelicEffect[];
  description: string;
}
```

**Step 2: Populate the relic catalogue**

File: `src/data/relics.ts`

Define at minimum 18 relics (6 per tier: 1–2 per archetype per tier) and the 4 synergy bonuses. Use the following as a required minimum — workers may add more:

```typescript
export const RELIC_CATALOGUE: RelicDefinition[] = [
  // ---- COMMON ----
  {
    id: 'rc_pathfinder_boots',
    name: "Pathfinder's Boots",
    description: 'Movement costs 10% less O2.',
    lore: 'Worn smooth by a thousand forgotten expeditions.',
    tier: 'common',
    archetype: 'explorer',
    effects: [{ effectId: 'o2CostMove', description: '-10% O2 per move', magnitude: -0.10 }],
    spriteKey: 'relic_pathfinder_boots',
    dropWeight: 30,
  },
  {
    id: 'rc_tungsten_pick',
    name: 'Tungsten Pick Fragment',
    description: 'Block damage +15%.',
    lore: 'A shard from a legendary drill, still humming faintly.',
    tier: 'common',
    archetype: 'miner',
    effects: [{ effectId: 'blockDamage', description: '+15% block damage', magnitude: 0.15 }],
    spriteKey: 'relic_tungsten_pick',
    dropWeight: 30,
  },
  {
    id: 'rc_focus_crystal',
    name: 'Focus Crystal',
    description: 'Correct quiz answers restore +5 O2.',
    lore: 'Resonates with concentrated knowledge.',
    tier: 'common',
    archetype: 'scholar',
    effects: [{ effectId: 'quizO2Reward', description: '+5 O2 on correct answer', magnitude: 5 }],
    spriteKey: 'relic_focus_crystal',
    dropWeight: 30,
  },
  {
    id: 'rc_carbon_weave',
    name: 'Carbon Weave Patch',
    description: 'Damage taken reduced by 10%.',
    lore: 'Harvested from a pre-collapse pressure suit.',
    tier: 'common',
    archetype: 'survivor',
    effects: [{ effectId: 'damageReduction', description: '-10% damage taken', magnitude: 0.10 }],
    spriteKey: 'relic_carbon_weave',
    dropWeight: 30,
  },
  {
    id: 'rc_sonar_lens',
    name: 'Sonar Lens',
    description: 'Reveal radius +1 cell.',
    lore: 'Pings the darkness before you even ask it to.',
    tier: 'common',
    archetype: 'explorer',
    effects: [{ effectId: 'revealRadius', description: '+1 reveal radius', magnitude: 1 }],
    spriteKey: 'relic_sonar_lens',
    dropWeight: 25,
  },
  {
    id: 'rc_miners_rhythm',
    name: "Miner's Rhythm",
    description: 'Mining speed +10% (one fewer tick per multi-hit block).',
    lore: 'A cadence carved into muscle memory.',
    tier: 'common',
    archetype: 'miner',
    effects: [{ effectId: 'miningSpeed', description: '+10% mining speed', magnitude: 0.10 }],
    spriteKey: 'relic_miners_rhythm',
    dropWeight: 25,
  },

  // ---- RARE ----
  {
    id: 'rr_cartographers_compass',
    name: "Cartographer's Compass",
    description: 'Reveal radius +3 cells. Descent shaft always revealed from layer start.',
    lore: 'Belonged to the last surviving surveyor of the Third Expedition.',
    tier: 'rare',
    archetype: 'explorer',
    effects: [
      { effectId: 'revealRadius', description: '+3 reveal radius', magnitude: 3 },
      { effectId: 'revealShaftOnEntry', description: 'Shaft always visible on layer entry', magnitude: 1 },
    ],
    spriteKey: 'relic_cartographers_compass',
    dropWeight: 15,
  },
  {
    id: 'rr_seismic_gauntlet',
    name: 'Seismic Gauntlet',
    description: 'Block damage +30%. Every 10th block mined sends a shockwave, clearing adjacent blocks.',
    lore: 'The resonance frequency was calibrated for Earth rock.',
    tier: 'rare',
    archetype: 'miner',
    effects: [
      { effectId: 'blockDamage', description: '+30% block damage', magnitude: 0.30 },
      { effectId: 'shockwavePeriod', description: 'Shockwave every 10 blocks mined', magnitude: 10 },
    ],
    spriteKey: 'relic_seismic_gauntlet',
    dropWeight: 15,
  },
  {
    id: 'rr_mnemonics_codex',
    name: "Mnemonist's Codex",
    description: 'O2 cost for all actions reduced by 20%. Wrong quiz answers cost no extra O2.',
    lore: 'Margin notes suggest its owner never forgot anything. Not even pain.',
    tier: 'rare',
    archetype: 'scholar',
    effects: [
      { effectId: 'o2CostAll', description: '-20% all O2 costs', magnitude: -0.20 },
      { effectId: 'suppressQuizO2Penalty', description: 'Wrong quiz answers cost no O2', magnitude: 1 },
    ],
    spriteKey: 'relic_mnemonics_codex',
    dropWeight: 15,
  },
  {
    id: 'rr_aegis_shard',
    name: 'Aegis Shard',
    description: 'Damage taken reduced by 25%. Once per layer, auto-absorbs one lethal hit.',
    lore: 'Still radiates the warmth of whoever it saved last.',
    tier: 'rare',
    archetype: 'survivor',
    effects: [
      { effectId: 'damageReduction', description: '-25% damage taken', magnitude: 0.25 },
      { effectId: 'lethalAbsorb', description: 'Absorb one lethal hit per layer', magnitude: 1 },
    ],
    spriteKey: 'relic_aegis_shard',
    dropWeight: 15,
  },
  {
    id: 'rr_quantum_pickaxe',
    name: 'Quantum Pickaxe Core',
    description: '20% chance per block hit to mine two blocks simultaneously.',
    lore: 'Exists in two states: hitting and having already hit.',
    tier: 'rare',
    archetype: 'miner',
    effects: [{ effectId: 'doubleMineProbability', description: '20% double-mine chance', magnitude: 0.20 }],
    spriteKey: 'relic_quantum_pickaxe',
    dropWeight: 12,
  },
  {
    id: 'rr_leyline_tap',
    name: 'Leyline Tap',
    description: 'Passive O2 regen: +1 O2 every 5 ticks.',
    lore: 'Draws from something older than the mine.',
    tier: 'rare',
    archetype: 'survivor',
    effects: [{ effectId: 'o2RegenPerTicks', description: '+1 O2 every 5 ticks', magnitude: 5 }],
    spriteKey: 'relic_leyline_tap',
    dropWeight: 12,
  },

  // ---- LEGENDARY ----
  {
    id: 'rl_atlas_heart',
    name: 'Heart of Atlas',
    description: 'All movement costs 0 O2. Reveal radius +5. Legendary Explorer synergy: mine grid fully revealed on layer entry.',
    lore: 'A planet compressed into something small enough to carry. Almost.',
    tier: 'legendary',
    archetype: 'explorer',
    effects: [
      { effectId: 'o2CostMove', description: '0 O2 per move', magnitude: -1.0 },
      { effectId: 'revealRadius', description: '+5 reveal radius', magnitude: 5 },
      { effectId: 'legendaryExplorerReveal', description: 'Full layer reveal on entry (with other Legendary Explorer)', magnitude: 1 },
    ],
    spriteKey: 'relic_atlas_heart',
    dropWeight: 3,
  },
  {
    id: 'rl_world_ender',
    name: 'World-Ender Drill Bit',
    description: 'Block damage +100%. Hard rock mined in one hit. Every block mined has 5% chance to spawn a rare mineral.',
    lore: 'Built for a planet that no longer needs to be mined.',
    tier: 'legendary',
    archetype: 'miner',
    effects: [
      { effectId: 'blockDamage', description: '+100% block damage', magnitude: 1.0 },
      { effectId: 'hardRockOneHit', description: 'Hard rock destroyed in 1 hit', magnitude: 1 },
      { effectId: 'mineralSpawnChance', description: '5% rare mineral spawn per block', magnitude: 0.05 },
    ],
    spriteKey: 'relic_world_ender',
    dropWeight: 3,
  },
  {
    id: 'rl_akashic_record',
    name: 'Akashic Record',
    description: 'Correct quiz answers grant +20 O2. O2 costs for all actions reduced by 40%. Quiz rate doubled — every quiz missed (skipped or wrong) is silently re-queued.',
    lore: 'Contains everything that has ever been known. Reading it is the hard part.',
    tier: 'legendary',
    archetype: 'scholar',
    effects: [
      { effectId: 'quizO2Reward', description: '+20 O2 on correct answer', magnitude: 20 },
      { effectId: 'o2CostAll', description: '-40% all O2 costs', magnitude: -0.40 },
      { effectId: 'quizRateMultiplier', description: 'Quiz rate ×2; missed quizzes re-queued', magnitude: 2 },
    ],
    spriteKey: 'relic_akashic_record',
    dropWeight: 3,
  },
  {
    id: 'rl_phoenix_core',
    name: 'Phoenix Core',
    description: 'On death, resurrect once per run at 30% O2. All damage taken reduced by 40%. Hazard damage triggers quiz for potential full negation.',
    lore: 'The last backup of something that refused to end.',
    tier: 'legendary',
    archetype: 'survivor',
    effects: [
      { effectId: 'resurrection', description: 'Resurrect once per run at 30% O2', magnitude: 1 },
      { effectId: 'damageReduction', description: '-40% damage taken', magnitude: 0.40 },
      { effectId: 'hazardQuizFullNegation', description: 'Correct quiz negates full hazard damage', magnitude: 1 },
    ],
    spriteKey: 'relic_phoenix_core',
    dropWeight: 3,
  },
  {
    id: 'rl_gravity_lens',
    name: 'Gravity Lens',
    description: 'Movement is free (no O2 cost). Descent shaft pulled toward player: shaft moves 1 cell closer every 10 ticks.',
    lore: 'Space bends around certainty of purpose.',
    tier: 'legendary',
    archetype: 'explorer',
    effects: [
      { effectId: 'o2CostMove', description: '0 O2 per move', magnitude: -1.0 },
      { effectId: 'shaftAttraction', description: 'Shaft moves 1 cell toward player every 10 ticks', magnitude: 10 },
    ],
    spriteKey: 'relic_gravity_lens',
    dropWeight: 2,
  },
  {
    id: 'rl_epoch_hammer',
    name: 'Epoch Hammer',
    description: 'Every 5th block mined detonates a 3×3 area instantly. Block damage +80%. Mining speed +50%.',
    lore: 'Five million years of geology. Five swings.',
    tier: 'legendary',
    archetype: 'miner',
    effects: [
      { effectId: 'aoeMinePeriod', description: '3×3 AoE mine every 5th block', magnitude: 5 },
      { effectId: 'blockDamage', description: '+80% block damage', magnitude: 0.80 },
      { effectId: 'miningSpeed', description: '+50% mining speed', magnitude: 0.50 },
    ],
    spriteKey: 'relic_epoch_hammer',
    dropWeight: 2,
  },
];

export const ARCHETYPE_SYNERGY_BONUSES: ArchetypeSynergyBonus[] = [
  {
    archetype: 'explorer',
    threshold: 2,
    effects: [
      { effectId: 'revealRadius', description: '+2 bonus reveal radius (Explorer synergy)', magnitude: 2 },
      { effectId: 'o2CostMove', description: '-5% bonus O2 cost per move (Explorer synergy)', magnitude: -0.05 },
    ],
    description: 'Explorer Synergy (2+): +2 reveal radius, -5% O2 per move.',
  },
  {
    archetype: 'miner',
    threshold: 2,
    effects: [
      { effectId: 'blockDamage', description: '+20% bonus block damage (Miner synergy)', magnitude: 0.20 },
      { effectId: 'critChance', description: '+10% critical hit chance (Miner synergy)', magnitude: 0.10 },
    ],
    description: 'Miner Synergy (2+): +20% block damage, +10% crit chance.',
  },
  {
    archetype: 'scholar',
    threshold: 2,
    effects: [
      { effectId: 'quizO2Reward', description: '+10 bonus O2 per correct answer (Scholar synergy)', magnitude: 10 },
      { effectId: 'quizCooldownReduction', description: '-25% quiz cooldown (Scholar synergy)', magnitude: -0.25 },
    ],
    description: 'Scholar Synergy (2+): +10 O2 per correct quiz, -25% quiz cooldown.',
  },
  {
    archetype: 'survivor',
    threshold: 2,
    effects: [
      { effectId: 'damageReduction', description: '+15% bonus damage reduction (Survivor synergy)', magnitude: 0.15 },
      { effectId: 'o2RegenPerTicks', description: '+1 O2 every 8 ticks (Survivor synergy)', magnitude: 8 },
    ],
    description: 'Survivor Synergy (2+): +15% damage reduction, +1 O2 every 8 ticks.',
  },
];
```

**Step 3: Create RelicManager**

File: `src/game/managers/RelicManager.ts` (new file)

```typescript
import type { RelicDefinition, RelicEffect, RelicArchetype } from '../../data/relics';
import { RELIC_CATALOGUE, ARCHETYPE_SYNERGY_BONUSES } from '../../data/relics';

/**
 * RelicManager handles relic equipping, effect resolution, synergy calculation,
 * and loot table draws. Max 3 relics equipped per run (enforced by PreDiveScreen).
 * (DD-V2-068)
 */
export class RelicManager {
  /** Currently equipped relic IDs this run. Max 3. */
  private equipped: RelicDefinition[] = [];

  /** Resolved combined effects including synergy bonuses. Recomputed on any change. */
  private resolvedEffects: Map<string, number> = new Map();

  constructor(initialEquipped: RelicDefinition[] = []) {
    this.equipped = initialEquipped.slice(0, 3);
    this.recompute();
  }

  /** Equip a relic. No-ops if already at 3 or already equipped. */
  equip(relic: RelicDefinition): boolean {
    if (this.equipped.length >= 3) return false;
    if (this.equipped.find(r => r.id === relic.id)) return false;
    this.equipped.push(relic);
    this.recompute();
    return true;
  }

  /** Unequip a relic by id. */
  unequip(relicId: string): void {
    this.equipped = this.equipped.filter(r => r.id !== relicId);
    this.recompute();
  }

  /** Get the resolved numeric value for a given effectId. Returns 0 if not present. */
  getEffect(effectId: string): number {
    return this.resolvedEffects.get(effectId) ?? 0;
  }

  /** Returns all currently equipped relic definitions. */
  getEquipped(): RelicDefinition[] {
    return [...this.equipped];
  }

  /**
   * Draw a random relic from the catalogue filtered by tier.
   * Uses weighted random selection (dropWeight field).
   */
  static drawRelic(tier?: RelicDefinition['tier']): RelicDefinition {
    const pool = tier
      ? RELIC_CATALOGUE.filter(r => r.tier === tier)
      : RELIC_CATALOGUE;
    const totalWeight = pool.reduce((sum, r) => sum + r.dropWeight, 0);
    let rand = Math.random() * totalWeight;
    for (const relic of pool) {
      rand -= relic.dropWeight;
      if (rand <= 0) return relic;
    }
    return pool[pool.length - 1];
  }

  /**
   * Draw a relic appropriate for a specific layer depth.
   * L1-5: 80% common / 20% rare. L6-10: 50/40/10. L11-15: 20/50/30. L16-20: 0/30/70.
   */
  static drawRelicForLayer(layer: number): RelicDefinition {
    let r = Math.random();
    if (layer <= 5) {
      return RelicManager.drawRelic(r < 0.80 ? 'common' : 'rare');
    } else if (layer <= 10) {
      if (r < 0.50) return RelicManager.drawRelic('common');
      if (r < 0.90) return RelicManager.drawRelic('rare');
      return RelicManager.drawRelic('legendary');
    } else if (layer <= 15) {
      if (r < 0.20) return RelicManager.drawRelic('common');
      if (r < 0.70) return RelicManager.drawRelic('rare');
      return RelicManager.drawRelic('legendary');
    } else {
      return RelicManager.drawRelic(r < 0.30 ? 'rare' : 'legendary');
    }
  }

  /** Recompute resolvedEffects by summing base relic effects + active synergy bonuses. */
  private recompute(): void {
    this.resolvedEffects.clear();

    // Sum base effects
    for (const relic of this.equipped) {
      for (const effect of relic.effects) {
        this.resolvedEffects.set(
          effect.effectId,
          (this.resolvedEffects.get(effect.effectId) ?? 0) + effect.magnitude
        );
      }
    }

    // Apply synergy bonuses
    const archetypeCounts = new Map<RelicArchetype, number>();
    for (const relic of this.equipped) {
      archetypeCounts.set(relic.archetype, (archetypeCounts.get(relic.archetype) ?? 0) + 1);
    }
    for (const synergy of ARCHETYPE_SYNERGY_BONUSES) {
      const count = archetypeCounts.get(synergy.archetype) ?? 0;
      if (count >= synergy.threshold) {
        for (const effect of synergy.effects) {
          this.resolvedEffects.set(
            effect.effectId,
            (this.resolvedEffects.get(effect.effectId) ?? 0) + effect.magnitude
          );
        }
      }
    }
  }
}
```

**Step 4: Wire RelicManager into GameManager**

File: `src/game/GameManager.ts`

Import and instantiate `RelicManager`. Pass equipped relics from `gameState` store on dive start:

```typescript
import { RelicManager } from './managers/RelicManager';

// In GameManager class:
private relicManager!: RelicManager;

startDive(equippedRelicIds: string[]): void {
  const equippedDefs = equippedRelicIds
    .map(id => RELIC_CATALOGUE.find(r => r.id === id))
    .filter((r): r is RelicDefinition => r !== undefined);
  this.relicManager = new RelicManager(equippedDefs);
  // ... existing startDive logic
}

getRelicManager(): RelicManager {
  return this.relicManager;
}
```

**Step 5: Apply relic effects to gameplay systems**

File: `src/game/GameManager.ts` and relevant system files

Audit all gameplay calculations and gate them through `relicManager.getEffect()`. Priority effectIds to wire in this sub-phase:

- `blockDamage` — in `MineScene.ts` block hit handler: `baseDamage * (1 + relicManager.getEffect('blockDamage'))`
- `o2CostMove` — in `GameManager.ts` O2 deduction: `baseCost * (1 + relicManager.getEffect('o2CostMove'))`
- `o2CostAll` — applied as a final multiplier after `o2CostMove` is resolved
- `damageReduction` — in hazard damage handler: `rawDamage * (1 - relicManager.getEffect('damageReduction'))`
- `revealRadius` — in `MineGenerator.ts` fog-of-war reveal: base radius + `relicManager.getEffect('revealRadius')`
- `quizO2Reward` — in `QuizManager.ts` correct-answer handler: award base + `relicManager.getEffect('quizO2Reward')` O2

**Step 6: Special-block relic drops**

File: `src/game/MineGenerator.ts`

Add a new block type `RareNode` to the `BlockType` enum. When a `RareNode` is broken in `MineScene.ts`, call `RelicManager.drawRelicForLayer(currentLayer)` and display a pickup overlay (reuse the artifact pickup overlay component from Phase 2.x if present, or show a Svelte toast).

```typescript
// In BlockType enum (src/game/MineGenerator.ts or wherever BlockType lives):
RareNode = 'rareNode',

// In getBlockWeightsForLayer:
rareNode: layer >= 3 ? lerp(0.005, 0.015, (layer - 3) / 17) : 0,
```

**Step 7: Relic pickup Svelte overlay**

File: `src/ui/components/RelicPickupOverlay.svelte` (new file)

```svelte
<script lang="ts">
  import type { RelicDefinition } from '../../data/relics';

  export let relic: RelicDefinition | null = null;
  export let onAccept: () => void = () => {};
  export let onDecline: () => void = () => {};

  const tierColors: Record<string, string> = {
    common: '#aaaaaa',
    rare: '#4488ff',
    legendary: '#ffcc00',
  };
</script>

{#if relic}
  <div class="relic-overlay" role="dialog" aria-modal="true">
    <div class="relic-card" style="border-color: {tierColors[relic.tier]}">
      <div class="tier-label" style="color: {tierColors[relic.tier]}">{relic.tier.toUpperCase()}</div>
      <img src="/assets/relics/{relic.spriteKey}.png" alt={relic.name} class="relic-sprite" />
      <h2 class="relic-name">{relic.name}</h2>
      <p class="relic-desc">{relic.description}</p>
      <p class="relic-lore">"{relic.lore}"</p>
      <div class="relic-actions">
        <button on:click={onAccept} class="btn-accept">Equip Relic</button>
        <button on:click={onDecline} class="btn-decline">Leave It</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .relic-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .relic-card {
    background: #1a1a2e;
    border: 2px solid;
    border-radius: 8px;
    padding: 24px;
    max-width: 320px;
    width: 90%;
    text-align: center;
    color: #e0e0e0;
  }
  .tier-label { font-size: 0.75rem; letter-spacing: 0.15em; margin-bottom: 8px; }
  .relic-sprite { width: 64px; height: 64px; image-rendering: pixelated; margin: 8px auto; display: block; }
  .relic-name { font-size: 1.1rem; margin: 8px 0 4px; }
  .relic-desc { font-size: 0.85rem; margin: 0 0 8px; }
  .relic-lore { font-size: 0.75rem; font-style: italic; color: #888; margin: 0 0 16px; }
  .relic-actions { display: flex; gap: 12px; justify-content: center; }
  .btn-accept { background: #2a5298; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; min-height: 44px; }
  .btn-decline { background: #333; color: #ccc; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; min-height: 44px; }
</style>
```

**Step 8: Export relic state for persistence**

File: `src/ui/stores/gameState.ts`

```typescript
import { writable, derived } from 'svelte/store';
import type { RelicDefinition } from '../../data/relics';

/** Relics equipped for the current run (max 3). Set by PreDiveScreen (8.11). */
export const equippedRelics = writable<RelicDefinition[]>([]);

/** Relics collected into the player's permanent vault between runs. */
export const relicVault = writable<RelicDefinition[]>([]);

/** Derived: active archetype synergy labels for HUD display. */
export const activeSynergies = derived(equippedRelics, (relics) => {
  const counts = new Map<string, number>();
  for (const r of relics) counts.set(r.archetype, (counts.get(r.archetype) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .map(([arch]) => arch);
});
```

### Acceptance Criteria

- [ ] `RELIC_CATALOGUE` contains at least 18 entries (6 common, 6 rare, 6 legendary)
- [ ] All four archetypes (explorer, miner, scholar, survivor) represented at all three tiers
- [ ] `ARCHETYPE_SYNERGY_BONUSES` contains 4 entries, one per archetype
- [ ] `RelicManager.drawRelicForLayer(1)` never returns a legendary relic (by weight design)
- [ ] `RelicManager.drawRelicForLayer(20)` returns rare or legendary 100% of the time
- [ ] `RelicManager.getEffect('blockDamage')` returns sum across all equipped relics + synergy
- [ ] Equipping 2 relics of same archetype causes synergy effects to appear in `resolvedEffects`
- [ ] `equip()` rejects a 4th relic (returns `false`)
- [ ] `RareNode` block type exists in enum; breaking one in-mine triggers `RelicPickupOverlay`
- [ ] `blockDamage` relic effect demonstrably increases mining speed in gameplay
- [ ] `quizO2Reward` relic effect demonstrably increases O2 on correct quiz answers
- [ ] `RelicPickupOverlay` renders with correct tier color and accept/decline buttons ≥44px touch target
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` clean

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-8-10-start.png' })
  // Navigate to mine
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-10-mine.png' })
  // Check for relic overlay (may appear if RareNode spawned near start)
  const relicOverlay = await page.$('.relic-overlay')
  if (relicOverlay) {
    await page.screenshot({ path: '/tmp/ss-8-10-relic-overlay.png' })
    console.log('Relic pickup overlay visible')
    // Accept it
    const acceptBtn = await page.$('.btn-accept')
    if (acceptBtn) await acceptBtn.click()
    await page.waitForTimeout(500)
  } else {
    console.log('No relic overlay on this run (RareNode may not have spawned near start)')
  }
  // Open DevPanel to check relic state
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-8-10-devpanel.png' })
  }
  await browser.close()
  console.log('8.10 relic system test complete')
})()
```

### Verification Gate

All must pass before starting 8.11:
- [ ] `src/data/relics.ts` exists with `RELIC_CATALOGUE` (18+ entries) and `ARCHETYPE_SYNERGY_BONUSES`
- [ ] `src/game/managers/RelicManager.ts` exists and exports `RelicManager` class
- [ ] `src/ui/components/RelicPickupOverlay.svelte` exists
- [ ] `equippedRelics` and `relicVault` stores exported from `src/ui/stores/gameState.ts`
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean
- [ ] Screenshots taken at `/tmp/ss-8-10-start.png` and `/tmp/ss-8-10-mine.png`

---

## Sub-Phase 8.11: Pre-Dive Prep Screen

### Overview

**Design Decisions**: DD-V2-065, DD-V2-067, DD-V2-068

The Pre-Dive Prep Screen is the loadout UI shown between the Dome and the mine. The player configures their run before committing: choosing a pickaxe, selecting a companion (from permanently unlocked companions), filling 3 consumable slots (from carried consumables), and equipping up to 3 relics from their vault.

The screen also displays the target layer number, the predicted biome (from 8.7's biome assignment), and a rough difficulty estimate (derived from layer + biome danger rating). The "Dive" button is disabled until a pickaxe is selected (minimum viable loadout).

This screen replaces the existing direct "Enter Mine" button flow.

### Sub-Steps

**Step 1: Define selectedLoadout store**

File: `src/ui/stores/gameState.ts`

```typescript
import type { CompanionDefinition } from '../../data/companions';
import type { ConsumableType } from '../../data/consumables';

export interface DiveLoadout {
  pickaxeId: string | null;
  companionId: string | null;
  /** Exactly 3 slots; null = empty slot. */
  consumableSlots: [ConsumableType | null, ConsumableType | null, ConsumableType | null];
  /** Relic ids; max 3. */
  relicIds: string[];
}

export const selectedLoadout = writable<DiveLoadout>({
  pickaxeId: null,
  companionId: null,
  consumableSlots: [null, null, null],
  relicIds: [],
});

/** True when minimum viable loadout filled (pickaxe selected). */
export const loadoutReady = derived(selectedLoadout, (loadout): boolean => {
  return loadout.pickaxeId !== null;
});
```

**Step 2: Create PreDiveScreen Svelte component**

File: `src/ui/components/PreDiveScreen.svelte` (new file)

```svelte
<script lang="ts">
  import { selectedLoadout, loadoutReady, equippedRelics } from '../../stores/gameState';
  import { currentLayer, layerTierLabel } from '../../stores/gameState';
  import { get } from 'svelte/store';
  import type { DiveLoadout } from '../../stores/gameState';
  import type { RelicDefinition } from '../../../data/relics';
  import { RELIC_CATALOGUE } from '../../../data/relics';

  export let onDive: () => void = () => {};
  export let onBack: () => void = () => {};

  // Player's relic vault (populated from persistent store)
  import { relicVault } from '../../stores/gameState';

  let loadout = get(selectedLoadout);
  selectedLoadout.subscribe(v => { loadout = v; });

  let layer = get(currentLayer);
  currentLayer.subscribe(v => { layer = v; });

  let tierLabel = get(layerTierLabel);
  layerTierLabel.subscribe(v => { tierLabel = v; });

  // Pickaxe options (placeholder; will be populated from pickaxe catalogue in Phase 8)
  const pickaxeOptions = [
    { id: 'pick_standard', name: 'Standard Pick', damage: 1 },
    { id: 'pick_reinforced', name: 'Reinforced Pick', damage: 1.5 },
  ];

  function selectPickaxe(id: string) {
    selectedLoadout.update(l => ({ ...l, pickaxeId: id }));
  }

  function selectConsumable(slot: 0 | 1 | 2, type: string | null) {
    selectedLoadout.update(l => {
      const slots: DiveLoadout['consumableSlots'] = [...l.consumableSlots];
      slots[slot] = type as any;
      return { ...l, consumableSlots: slots };
    });
  }

  function toggleRelic(relicId: string) {
    selectedLoadout.update(l => {
      const has = l.relicIds.includes(relicId);
      if (has) {
        return { ...l, relicIds: l.relicIds.filter(id => id !== relicId) };
      }
      if (l.relicIds.length >= 3) return l; // max 3
      return { ...l, relicIds: [...l.relicIds, relicId] };
    });
  }

  function handleDive() {
    // Sync equippedRelics store from selectedLoadout before diving
    const defs = loadout.relicIds
      .map(id => RELIC_CATALOGUE.find(r => r.id === id))
      .filter((r): r is RelicDefinition => r !== undefined);
    equippedRelics.set(defs);
    onDive();
  }

  /** Rough difficulty estimate: 1-5 stars based on layer depth. */
  function difficultyStars(layer: number): number {
    return Math.min(5, Math.ceil(layer / 4));
  }
</script>

<div class="predive-screen" role="main" aria-label="Pre-Dive Preparation">
  <header class="predive-header">
    <button class="btn-back" on:click={onBack} aria-label="Back to Dome">← Back</button>
    <h1>Mission Prep</h1>
    <div class="layer-info">
      <span class="layer-num">Layer {layer}</span>
      <span class="tier-label">{tierLabel}</span>
      <span class="difficulty">{'★'.repeat(difficultyStars(layer))}{'☆'.repeat(5 - difficultyStars(layer))}</span>
    </div>
  </header>

  <section class="section-pickaxe" aria-labelledby="pickaxe-heading">
    <h2 id="pickaxe-heading">Pickaxe</h2>
    <div class="pick-options">
      {#each pickaxeOptions as pick}
        <button
          class="pick-btn"
          class:selected={loadout.pickaxeId === pick.id}
          on:click={() => selectPickaxe(pick.id)}
          aria-pressed={loadout.pickaxeId === pick.id}
        >
          <span class="pick-name">{pick.name}</span>
          <span class="pick-stat">×{pick.damage} dmg</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="section-consumables" aria-labelledby="consumables-heading">
    <h2 id="consumables-heading">Consumables (3 slots)</h2>
    <div class="consumable-slots">
      {#each [0, 1, 2] as slotIdx}
        <div class="consumable-slot" aria-label="Consumable slot {slotIdx + 1}">
          {#if loadout.consumableSlots[slotIdx]}
            <span class="consumable-name">{loadout.consumableSlots[slotIdx]}</span>
            <button class="btn-clear-slot" on:click={() => selectConsumable(slotIdx as 0|1|2, null)} aria-label="Remove">✕</button>
          {:else}
            <span class="slot-empty">Empty</span>
          {/if}
        </div>
      {/each}
    </div>
    <!-- Consumable picker (shows carried consumables from inventory) -->
    <p class="hint">Select consumables from your inventory above each slot.</p>
  </section>

  <section class="section-relics" aria-labelledby="relics-heading">
    <h2 id="relics-heading">Relics (max 3)</h2>
    <div class="relic-vault-grid">
      {#each $relicVault as relic}
        <button
          class="relic-vault-btn"
          class:selected={loadout.relicIds.includes(relic.id)}
          class:disabled={!loadout.relicIds.includes(relic.id) && loadout.relicIds.length >= 3}
          on:click={() => toggleRelic(relic.id)}
          aria-pressed={loadout.relicIds.includes(relic.id)}
          title="{relic.name}: {relic.description}"
        >
          <span class="relic-tier-dot" style="background: {relic.tier === 'legendary' ? '#ffcc00' : relic.tier === 'rare' ? '#4488ff' : '#aaa'}"></span>
          <span class="relic-vault-name">{relic.name}</span>
        </button>
      {/each}
      {#if $relicVault.length === 0}
        <p class="no-relics">No relics in vault. Find them while mining!</p>
      {/if}
    </div>
  </section>

  <footer class="predive-footer">
    <button
      class="btn-dive"
      disabled={!$loadoutReady}
      on:click={handleDive}
      aria-disabled={!$loadoutReady}
    >
      {$loadoutReady ? 'Dive' : 'Select a pickaxe to dive'}
    </button>
  </footer>
</div>

<style>
  .predive-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0d0d1a;
    color: #e0e0e0;
    padding: 16px;
    overflow-y: auto;
    font-family: 'Press Start 2P', monospace, sans-serif;
  }
  .predive-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .predive-header h1 { flex: 1; font-size: 1rem; margin: 0; }
  .btn-back { background: none; border: 1px solid #555; color: #aaa; padding: 8px 12px; border-radius: 4px; cursor: pointer; min-height: 44px; }
  .layer-info { display: flex; flex-direction: column; align-items: flex-end; font-size: 0.7rem; gap: 2px; }
  .layer-num { color: #fff; }
  .tier-label { color: #ffaa00; }
  .difficulty { color: #ffcc00; letter-spacing: 2px; }
  h2 { font-size: 0.75rem; color: #aaa; margin: 0 0 10px; }
  .pick-options { display: flex; gap: 8px; flex-wrap: wrap; }
  .pick-btn {
    background: #1a1a2e; border: 1px solid #333; color: #e0e0e0;
    padding: 12px 16px; border-radius: 4px; cursor: pointer; min-height: 44px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .pick-btn.selected { border-color: #4488ff; background: #1a2a4e; }
  .pick-name { font-size: 0.7rem; }
  .pick-stat { font-size: 0.6rem; color: #88aaff; }
  .consumable-slots { display: flex; gap: 8px; margin-bottom: 6px; }
  .consumable-slot {
    flex: 1; background: #1a1a2e; border: 1px dashed #444;
    border-radius: 4px; padding: 12px 8px; min-height: 44px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.65rem;
  }
  .slot-empty { color: #555; }
  .btn-clear-slot { background: none; border: none; color: #f66; cursor: pointer; font-size: 0.8rem; padding: 4px; }
  .hint { font-size: 0.6rem; color: #555; margin: 4px 0 0; }
  .relic-vault-grid { display: flex; flex-direction: column; gap: 6px; }
  .relic-vault-btn {
    background: #1a1a2e; border: 1px solid #333; color: #e0e0e0;
    padding: 10px 12px; border-radius: 4px; cursor: pointer; min-height: 44px;
    display: flex; align-items: center; gap: 8px; text-align: left;
  }
  .relic-vault-btn.selected { border-color: #4488ff; background: #1a2a4e; }
  .relic-vault-btn.disabled { opacity: 0.4; cursor: not-allowed; }
  .relic-tier-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .relic-vault-name { font-size: 0.65rem; }
  .no-relics { font-size: 0.65rem; color: #555; }
  .predive-footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #222; }
  .btn-dive {
    width: 100%; background: #2a5298; color: #fff; border: none;
    padding: 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
    min-height: 56px; font-family: inherit;
  }
  .btn-dive:disabled { background: #333; color: #666; cursor: not-allowed; }
  .section-pickaxe, .section-consumables, .section-relics { margin-bottom: 20px; }
</style>
```

**Step 3: Register PreDiveScreen in routing flow**

File: `src/ui/App.svelte` (or whichever top-level component controls screen routing)

Identify the current "Enter Mine" button. Replace its click handler to navigate to a new `'predive'` view state, rendering `<PreDiveScreen>` in the screen slot. The `onDive` callback should transition to `'mine'`.

```svelte
<!-- Add to view state union type: -->
<!-- type ViewState = 'dome' | 'predive' | 'mine' | 'quiz' | ... -->

<!-- Replace "Enter Mine" handler: -->
<!-- on:click={() => viewState = 'predive'} -->

<!-- In view conditional: -->
<!-- {:else if viewState === 'predive'} -->
<!--   <PreDiveScreen onDive={() => viewState = 'mine'} onBack={() => viewState = 'dome'} /> -->
```

**Step 4: Pass loadout into GameManager on dive start**

File: `src/game/GameManager.ts`

On the `'mine'` view transition, read `selectedLoadout` from the store and pass `pickaxeId`, `relicIds`, and `companionId` into `GameManager.startDive()`:

```typescript
import { get } from 'svelte/store';
import { selectedLoadout } from '../../ui/stores/gameState';

// In dive initiation logic:
const loadout = get(selectedLoadout);
gameManager.startDive(
  loadout.relicIds,
  loadout.pickaxeId ?? 'pick_standard',
  loadout.companionId,
  loadout.consumableSlots
);
```

**Step 5: Layer and biome preview data**

File: `src/ui/components/PreDiveScreen.svelte`

Import `predictBiomeForLayer(layer: number): string` from `src/data/biomes.ts` (add this function if not present). Display the predicted biome name beneath the layer number in the header. If biome data not yet available (8.7 not complete), display `"Unknown Biome"` as a placeholder.

### Acceptance Criteria

- [ ] Navigating to the mine now routes through `PreDiveScreen` — direct "Enter Mine" no longer skips prep
- [ ] Pickaxe options render and selecting one enables the Dive button
- [ ] Dive button remains disabled (and shows hint text) when no pickaxe selected
- [ ] Relic vault shows relics from `relicVault` store; toggling selects/deselects up to max 3
- [ ] Selecting a 4th relic when 3 already selected is prevented (button greyed out)
- [ ] `handleDive()` correctly populates `equippedRelics` store before transitioning
- [ ] Layer number, tier label, and difficulty stars display correctly for layer 1 (1 star, Shallow)
- [ ] Back button returns to Dome without starting a dive
- [ ] All interactive elements have `min-height: 44px` for mobile touch targets
- [ ] `selectedLoadout` store is reset or persisted correctly between sessions
- [ ] `npm run typecheck` passes
- [ ] `npm run build` clean

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-8-11-dome.png' })
  // Navigate to pre-dive screen (new flow replaces direct Enter Mine)
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/ss-8-11-predive.png' })
  // Verify Dive button is disabled before pickaxe selected
  const diveBtn = await page.$('.btn-dive')
  const isDisabled = await diveBtn?.getAttribute('disabled')
  console.log('Dive button disabled before pickaxe selection:', isDisabled !== null)
  // Select first pickaxe
  const pickaxeBtn = await page.$('.pick-btn')
  if (pickaxeBtn) {
    await pickaxeBtn.click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ss-8-11-pickaxe-selected.png' })
    const nowDisabled = await diveBtn?.getAttribute('disabled')
    console.log('Dive button disabled after pickaxe selection:', nowDisabled !== null)
  } else {
    console.warn('WARNING: No pickaxe buttons found')
  }
  // Test Back button
  const backBtn = await page.$('.btn-back')
  if (backBtn) {
    await backBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-8-11-back-to-dome.png' })
    console.log('Back button navigated away from pre-dive screen')
  }
  await browser.close()
  console.log('8.11 pre-dive screen test complete')
})()
```

### Verification Gate

All must pass before starting 8.12:
- [ ] `src/ui/components/PreDiveScreen.svelte` exists
- [ ] `selectedLoadout` and `loadoutReady` exported from `src/ui/stores/gameState.ts`
- [ ] Dive flow routes through PreDiveScreen (verified in screenshot `/tmp/ss-8-11-predive.png`)
- [ ] Dive button disabled state confirmed before pickaxe selection (console log in test script)
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean
- [ ] Screenshots at `/tmp/ss-8-11-dome.png`, `/tmp/ss-8-11-predive.png`, `/tmp/ss-8-11-pickaxe-selected.png`

---

## Sub-Phase 8.12: Companion System

### Overview

**Design Decisions**: DD-V2-067, DD-V2-062 (Binding of Isaac philosophy for in-run companions)

Companions are persistent characters that accompany the miner. They provide passive buffs during runs and can evolve permanently between runs through shard investment. In-run, the player may also find temporary companion upgrades as random mine events (these expire when the run ends).

Each companion has one of five affinities: Mining (block damage+), Scouting (reveal range+), Healing (O2 regen), Learning (quiz bonus%), or Defense (damage reduction). Each companion has 3 evolution stages, each requiring a shard cost and a mastered-facts threshold, enforcing the link between learning progress and character growth.

Companions follow the player in the mine scene as a small sprite and display their affinity buff in the HUD.

### Sub-Steps

**Step 1: Define CompanionDefinition and CompanionAffinity types**

File: `src/data/companions.ts` (new file)

```typescript
/**
 * Companion affinities determine the primary buff category. (DD-V2-067)
 */
export type CompanionAffinity = 'mining' | 'scouting' | 'healing' | 'learning' | 'defense';

/**
 * A single evolution stage of a companion.
 */
export interface CompanionEvolutionStage {
  /** Stage index: 0 = base, 1 = evolved, 2 = apex. */
  stage: number;
  /** Display name for this stage. */
  stageName: string;
  /** Shards required to reach this stage (from previous stage). 0 for base. */
  shardsRequired: number;
  /** Total mastered facts required to unlock this evolution option. */
  masteredFactsRequired: number;
  /** Affinity magnitude at this stage. Interpretation matches effectId in RelicEffect. */
  affinityMagnitude: number;
  /** Optional secondary effect at evolved/apex stage. */
  secondaryEffect?: { effectId: string; magnitude: number; description: string };
  spriteKey: string;
}

/**
 * Full definition of a companion character.
 */
export interface CompanionDefinition {
  id: string;
  name: string;
  species: string;
  description: string;
  affinity: CompanionAffinity;
  /** Maps affinity to the effectId it modifies. */
  effectId: string;
  /** All three evolution stages (index 0-2). */
  evolutionPath: [CompanionEvolutionStage, CompanionEvolutionStage, CompanionEvolutionStage];
  /** Flavor lore. */
  lore: string;
}

/**
 * Runtime companion state (stored per player, persisted between runs).
 */
export interface CompanionState {
  companionId: string;
  /** Current evolution stage (0-2). */
  currentStage: number;
  /** Whether this companion is permanently unlocked. */
  unlocked: boolean;
}
```

**Step 2: Populate companion catalogue**

File: `src/data/companions.ts`

Define at minimum 5 companions (one per affinity):

```typescript
export const COMPANION_CATALOGUE: CompanionDefinition[] = [
  {
    id: 'comp_borebot',
    name: 'Borebot',
    species: 'Drill Automaton',
    description: 'A compact drilling bot that amplifies your pickaxe strikes.',
    affinity: 'mining',
    effectId: 'blockDamage',
    lore: 'Originally built for asteroid mining. Ended up somewhere much weirder.',
    evolutionPath: [
      { stage: 0, stageName: 'Basic', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 0.10, spriteKey: 'comp_borebot_0' },
      { stage: 1, stageName: 'Upgraded', shardsRequired: 50, masteredFactsRequired: 25, affinityMagnitude: 0.25, secondaryEffect: { effectId: 'critChance', magnitude: 0.05, description: '+5% crit chance' }, spriteKey: 'comp_borebot_1' },
      { stage: 2, stageName: 'Apex Drill', shardsRequired: 150, masteredFactsRequired: 100, affinityMagnitude: 0.45, secondaryEffect: { effectId: 'aoeMinePeriod', magnitude: 20, description: 'AoE mine every 20th block' }, spriteKey: 'comp_borebot_2' },
    ],
  },
  {
    id: 'comp_lumis',
    name: 'Lumis',
    species: 'Bioluminescent Floater',
    description: 'Floats ahead of you, illuminating tunnels before you enter them.',
    affinity: 'scouting',
    effectId: 'revealRadius',
    lore: 'Found clinging to a geode in the deep. Seems happy here.',
    evolutionPath: [
      { stage: 0, stageName: 'Dim', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 1, spriteKey: 'comp_lumis_0' },
      { stage: 1, stageName: 'Bright', shardsRequired: 40, masteredFactsRequired: 20, affinityMagnitude: 2, secondaryEffect: { effectId: 'revealShaftOnEntry', magnitude: 1, description: 'Shaft visible from entry' }, spriteKey: 'comp_lumis_1' },
      { stage: 2, stageName: 'Blazing', shardsRequired: 120, masteredFactsRequired: 80, affinityMagnitude: 4, secondaryEffect: { effectId: 'sonarPulsePassive', magnitude: 1, description: 'Passive sonar pulse every 15 ticks' }, spriteKey: 'comp_lumis_2' },
    ],
  },
  {
    id: 'comp_medi',
    name: 'Medikit Mk. II',
    species: 'Medical Drone',
    description: 'Hovers at your shoulder, trickling O2 back into your suit.',
    affinity: 'healing',
    effectId: 'o2RegenPerTicks',
    lore: 'The voice module burned out. Now it just beeps affectionately.',
    evolutionPath: [
      { stage: 0, stageName: 'Standard', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 8, spriteKey: 'comp_medi_0' },
      { stage: 1, stageName: 'Enhanced', shardsRequired: 60, masteredFactsRequired: 30, affinityMagnitude: 5, secondaryEffect: { effectId: 'o2CostAll', magnitude: -0.05, description: '-5% all O2 costs' }, spriteKey: 'comp_medi_1' },
      { stage: 2, stageName: 'Apex Care', shardsRequired: 180, masteredFactsRequired: 120, affinityMagnitude: 3, secondaryEffect: { effectId: 'deathRevive', magnitude: 0.5, description: 'On death, revive at 50% O2 (once per run)' }, spriteKey: 'comp_medi_2' },
    ],
  },
  {
    id: 'comp_archivist',
    name: 'The Archivist',
    species: 'Data Specter',
    description: 'A ghostly archive fragment. Rewards knowledge with oxygen.',
    affinity: 'learning',
    effectId: 'quizO2Reward',
    lore: 'Technically a corrupted museum AI. It considers your quizzes "field research."',
    evolutionPath: [
      { stage: 0, stageName: 'Fragment', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 3, spriteKey: 'comp_archivist_0' },
      { stage: 1, stageName: 'Restored', shardsRequired: 45, masteredFactsRequired: 35, affinityMagnitude: 8, secondaryEffect: { effectId: 'quizCooldownReduction', magnitude: -0.15, description: '-15% quiz cooldown' }, spriteKey: 'comp_archivist_1' },
      { stage: 2, stageName: 'Omniscient', shardsRequired: 140, masteredFactsRequired: 150, affinityMagnitude: 15, secondaryEffect: { effectId: 'suppressQuizO2Penalty', magnitude: 1, description: 'Wrong answers cost no extra O2' }, spriteKey: 'comp_archivist_2' },
    ],
  },
  {
    id: 'comp_carapace',
    name: 'Carapace',
    species: 'Armored Symbiont',
    description: 'Attaches to your suit, distributing impact forces.',
    affinity: 'defense',
    effectId: 'damageReduction',
    lore: 'Evolved to survive exactly what you keep walking into.',
    evolutionPath: [
      { stage: 0, stageName: 'Juvenile', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 0.08, spriteKey: 'comp_carapace_0' },
      { stage: 1, stageName: 'Mature', shardsRequired: 55, masteredFactsRequired: 28, affinityMagnitude: 0.20, secondaryEffect: { effectId: 'lethalAbsorb', magnitude: 1, description: 'Absorb one lethal hit per layer' }, spriteKey: 'comp_carapace_1' },
      { stage: 2, stageName: 'Elder Shell', shardsRequired: 165, masteredFactsRequired: 110, affinityMagnitude: 0.35, secondaryEffect: { effectId: 'hazardQuizFullNegation', magnitude: 1, description: 'Correct quiz negates full hazard damage' }, spriteKey: 'comp_carapace_2' },
    ],
  },
];
```

**Step 3: Create CompanionManager**

File: `src/game/managers/CompanionManager.ts` (new file)

```typescript
import type { CompanionDefinition, CompanionState } from '../../data/companions';
import { COMPANION_CATALOGUE } from '../../data/companions';
import type { RelicEffect } from '../../data/relics';

/**
 * CompanionManager handles active companion effects, in-run temporary upgrades,
 * and the evolution upgrade system. (DD-V2-067)
 */
export class CompanionManager {
  private companion: CompanionDefinition | null = null;
  private state: CompanionState | null = null;
  /** Temporary in-run stage bonus (from mine event finds). Resets on run end. */
  private tempStageBonus = 0;

  /** Initialize with the companion selected in PreDiveScreen. */
  setCompanion(companionId: string | null, states: CompanionState[]): void {
    if (!companionId) { this.companion = null; this.state = null; return; }
    const def = COMPANION_CATALOGUE.find(c => c.id === companionId) ?? null;
    const state = states.find(s => s.companionId === companionId) ?? null;
    this.companion = def;
    this.state = state;
    this.tempStageBonus = 0;
  }

  /** Apply a temporary in-run stage upgrade (from a mine event). Max stage cap at 2. */
  applyTemporaryUpgrade(): void {
    if (!this.state) return;
    const effectiveStage = Math.min(2, this.state.currentStage + this.tempStageBonus);
    if (effectiveStage < 2) this.tempStageBonus++;
  }

  /** Get the effective evolution stage this run (capped at 2). */
  getEffectiveStage(): number {
    if (!this.state) return 0;
    return Math.min(2, this.state.currentStage + this.tempStageBonus);
  }

  /** Get the primary affinity effect for this companion at its effective stage. */
  getPrimaryEffect(): RelicEffect | null {
    if (!this.companion || !this.state) return null;
    const stage = this.companion.evolutionPath[this.getEffectiveStage()];
    return {
      effectId: this.companion.effectId,
      description: `${this.companion.name} (${this.companion.affinity})`,
      magnitude: stage.affinityMagnitude,
    };
  }

  /** Get optional secondary effect for this companion at effective stage, if any. */
  getSecondaryEffect(): RelicEffect | null {
    if (!this.companion || !this.state) return null;
    const stage = this.companion.evolutionPath[this.getEffectiveStage()];
    if (!stage.secondaryEffect) return null;
    return {
      effectId: stage.secondaryEffect.effectId,
      description: stage.secondaryEffect.description,
      magnitude: stage.secondaryEffect.magnitude,
    };
  }

  getCompanionDef(): CompanionDefinition | null { return this.companion; }
  getState(): CompanionState | null { return this.state; }

  /**
   * Check if a companion can be evolved to the next stage.
   * Returns true if shard cost and mastered facts threshold are both met.
   */
  static canEvolve(state: CompanionState, masteredFactsCount: number, availableShards: number): boolean {
    const def = COMPANION_CATALOGUE.find(c => c.id === state.companionId);
    if (!def) return false;
    const nextStage = state.currentStage + 1;
    if (nextStage > 2) return false;
    const evolution = def.evolutionPath[nextStage];
    return availableShards >= evolution.shardsRequired && masteredFactsCount >= evolution.masteredFactsRequired;
  }

  /**
   * Perform evolution upgrade. Mutates state. Returns shard cost.
   * Caller must deduct shards from inventory.
   */
  static evolve(state: CompanionState): { newStage: number; shardsSpent: number } {
    const def = COMPANION_CATALOGUE.find(c => c.id === state.companionId);
    if (!def || state.currentStage >= 2) throw new Error('Cannot evolve companion');
    const nextStage = state.currentStage + 1;
    const cost = def.evolutionPath[nextStage].shardsRequired;
    state.currentStage = nextStage;
    return { newStage: nextStage, shardsSpent: cost };
  }
}
```

**Step 4: Companion sprite follower in MineScene**

File: `src/game/scenes/MineScene.ts`

After the player sprite is created, add a companion follower sprite that tracks the player's position with a 1-cell lag:

```typescript
import { CompanionManager } from '../managers/CompanionManager';

// In MineScene.create():
private companionSprite: Phaser.GameObjects.Sprite | null = null;

setupCompanionSprite(): void {
  const cm = this.gameManager.getCompanionManager();
  const def = cm.getCompanionDef();
  if (!def) return;
  const stage = cm.getEffectiveStage();
  const spriteKey = def.evolutionPath[stage].spriteKey;
  this.companionSprite = this.add.sprite(0, 0, spriteKey)
    .setScale(0.5)
    .setDepth(5)
    .setAlpha(0.9);
}

// In player movement handler, after moving player:
updateCompanionPosition(playerX: number, playerY: number): void {
  if (!this.companionSprite) return;
  // Offset 1 tile behind in move direction
  this.companionSprite.setPosition(
    playerX * TILE_SIZE - TILE_SIZE,
    playerY * TILE_SIZE
  );
}
```

**Step 5: Wire CompanionManager into GameManager**

File: `src/game/GameManager.ts`

```typescript
import { CompanionManager } from './managers/CompanionManager';

private companionManager!: CompanionManager;

startDive(relicIds: string[], pickaxeId: string, companionId: string | null, consumableSlots: any[]): void {
  // ... existing logic ...
  this.companionManager = new CompanionManager();
  const companionStates: CompanionState[] = get(playerCompanionStates); // from playerData store
  this.companionManager.setCompanion(companionId, companionStates);
}

getCompanionManager(): CompanionManager { return this.companionManager; }
```

**Step 6: Apply companion effects to gameplay**

File: `src/game/GameManager.ts`

After `startDive()`, extract companion primary and secondary effects and register them in the same effect resolution pipeline as relic effects:

```typescript
// After companion manager is initialized:
const primaryEffect = this.companionManager.getPrimaryEffect();
const secondaryEffect = this.companionManager.getSecondaryEffect();
// These effectIds are resolved alongside relic effects in all gameplay calculations.
// Store them in a companionEffects map and check it wherever relicManager.getEffect() is checked.
```

**Step 7: In-run companion upgrade event**

File: `src/game/systems/MineEventSystem.ts` (or wherever random mine events are triggered)

Add event type `'companion_upgrade'` to the random event pool (probability ~2% per layer entry). When triggered, call `companionManager.applyTemporaryUpgrade()` and display a GAIA toast:

```typescript
// Example event handler:
case 'companion_upgrade':
  this.companionManager.applyTemporaryUpgrade();
  this.gaiaManager.showToast(`${companionDef.name} feels stronger! Temporary upgrade applied.`);
  break;
```

**Step 8: CompanionState persistence store**

File: `src/ui/stores/playerData.ts`

```typescript
import type { CompanionState } from '../../data/companions';
import { COMPANION_CATALOGUE } from '../../data/companions';
import { writable } from 'svelte/store';

/** Persistent companion states for all companions (unlocked or not). */
export const playerCompanionStates = writable<CompanionState[]>(
  COMPANION_CATALOGUE.map(c => ({
    companionId: c.id,
    currentStage: 0,
    unlocked: c.id === 'comp_borebot', // Borebot unlocked by default
  }))
);
```

### Acceptance Criteria

- [ ] `COMPANION_CATALOGUE` contains 5 companions, one per affinity type
- [ ] Each companion has exactly 3 evolution stages in `evolutionPath`
- [ ] `CompanionManager.canEvolve()` returns false when shards insufficient
- [ ] `CompanionManager.canEvolve()` returns false when mastered facts threshold not met
- [ ] `CompanionManager.evolve()` increments `currentStage` and returns correct shard cost
- [ ] `applyTemporaryUpgrade()` does not push effective stage above 2
- [ ] Companion sprite appears in mine scene adjacent to player when companion selected
- [ ] `getPrimaryEffect()` returns correct effectId and magnitude for current stage
- [ ] `playerCompanionStates` persisted to localStorage (survives page reload)
- [ ] Borebot unlocked by default in fresh player state
- [ ] `npm run typecheck` passes
- [ ] `npm run build` clean

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Navigate through pre-dive screen with companion selection
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/ss-8-12-predive.png' })
  // Select pickaxe and companion if PreDiveScreen renders them
  const pickaxeBtn = await page.$('.pick-btn')
  if (pickaxeBtn) await pickaxeBtn.click()
  const diveBtn = await page.$('.btn-dive')
  if (diveBtn) {
    const disabled = await diveBtn.getAttribute('disabled')
    if (!disabled) {
      await diveBtn.click()
    } else {
      // Try Enter Mine fallback
      const enterBtn = await page.$('button:has-text("Enter Mine")')
      if (enterBtn) await enterBtn.click()
    }
  }
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-12-mine-companion.png' })
  // Check for companion sprite in mine
  const companionSprite = await page.$('.companion-sprite, [data-testid="companion-sprite"]')
  console.log('Companion sprite found in mine:', companionSprite !== null)
  // Check HUD for companion buff indicator
  const bodyText = await page.textContent('body')
  const hasCompanionHud = bodyText.includes('Borebot') || bodyText.includes('mining')
  console.log('Companion info in HUD:', hasCompanionHud)
  await browser.close()
  console.log('8.12 companion system test complete')
})()
```

### Verification Gate

All must pass before starting 8.13:
- [ ] `src/data/companions.ts` exists with `COMPANION_CATALOGUE` (5 entries) and all types
- [ ] `src/game/managers/CompanionManager.ts` exists with `CompanionManager` class
- [ ] `playerCompanionStates` store exported from `src/ui/stores/playerData.ts`
- [ ] Companion sprite visible in mine screenshot at `/tmp/ss-8-12-mine-companion.png`
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean
- [ ] Screenshots at `/tmp/ss-8-12-predive.png` and `/tmp/ss-8-12-mine-companion.png`

---

## Sub-Phase 8.13: Difficulty Scaling and Balance Simulation

### Overview

**Design Decisions**: DD-V2-053, DD-V2-062 (no SM-2 modification from power)

This sub-phase formalizes the per-layer difficulty curve into explicit constants in `src/data/balance.ts` and validates the curve with a programmatic balance simulation script. The simulation generates 1,000 synthetic runs and measures: average layer reached, death rate per layer, O2 consumption per layer, quiz trigger rate, and loot yield.

An auto-balance mechanic is also introduced: if the current player has died on the same layer 3 or more consecutive times in a session, a subtle difficulty easing is applied (reduced hazard density, +10% O2 per tank) without informing the player.

All difficulty modifiers are purely gameplay-side. The SM-2 learning algorithm is never touched by any difficulty scalar. (DD-V2-062)

### Sub-Steps

**Step 1: Define per-layer difficulty constants**

File: `src/data/balance.ts`

```typescript
// ---- Per-Layer Difficulty Curve (DD-V2-053) ----

/**
 * Hazard density multiplier per layer. 1.0 = base density from getBlockWeightsForLayer().
 * Applied as a scalar to lavaBlock and gasPocket weights at generation time.
 */
export const HAZARD_DENSITY_BY_LAYER: Record<number, number> = {
  1: 0.0,   // No hazards on layer 1 (tutorial-safe)
  2: 0.2,
  3: 0.4,
  4: 0.6,
  5: 0.8,
  6: 1.0,
  7: 1.1,
  8: 1.2,
  9: 1.3,
  10: 1.4,
  11: 1.6,
  12: 1.8,
  13: 2.0,
  14: 2.2,
  15: 2.5,
  16: 2.8,
  17: 3.2,
  18: 3.6,
  19: 4.0,
  20: 4.5,
};

/**
 * O2 tank size per layer. Deep layers have larger tanks to compensate for
 * higher O2 costs — the math still gets harder, but not punishing.
 * (Replaces mineral decay mechanic — DD-V2-181)
 */
export const O2_TANK_SIZE_BY_LAYER: Record<number, number> = {
  1: 100, 2: 100, 3: 100, 4: 100, 5: 100,
  6: 110, 7: 115, 8: 120, 9: 125, 10: 130,
  11: 140, 12: 145, 13: 150, 14: 155, 15: 160,
  16: 175, 17: 185, 18: 195, 19: 205, 20: 220,
};

/**
 * Mineral rarity tier minimum per layer. Controls what quality minerals can spawn.
 * 0 = dust only, 1 = shards+, 2 = crystals+, 3 = geodes/essence.
 */
export const MINERAL_TIER_MINIMUM_BY_LAYER: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
  11: 2, 12: 2, 13: 2, 14: 2, 15: 2,
  16: 3, 17: 3, 18: 3, 19: 3, 20: 3,
};

/**
 * Biome danger rating. Used in difficulty estimate displayed in PreDiveScreen.
 * 1 = safe, 5 = extreme.
 */
export const BIOME_DANGER_RATING: Partial<Record<string, number>> = {
  verdant_tunnels: 1,
  crystal_caves: 2,
  salt_flats: 1,
  iron_seam: 2,
  chalk_beds: 1,
  basalt_flow: 3,
  granite_press: 3,
  obsidian_vent: 4,
  magma_shelf: 5,
  void_pocket: 5,
};

/**
 * Relic power rating weight for difficulty offset.
 * When equipped relic power sum exceeds threshold, biome danger is offset.
 * This NEVER affects SM-2 — purely cosmetic difficulty estimate. (DD-V2-062)
 */
export const RELIC_POWER_OFFSET_THRESHOLD = 3.0;
export const RELIC_POWER_OFFSET_AMOUNT = -1;  // -1 to displayed difficulty stars only

// ---- Auto-Balance Easing (DD-V2-053) ----
/** Deaths on same layer required to trigger auto-easing. */
export const AUTO_BALANCE_DEATH_THRESHOLD = 3;
/** Hazard density multiplier when auto-easing is active. */
export const AUTO_BALANCE_HAZARD_SCALAR = 0.75;
/** O2 bonus when auto-easing is active. */
export const AUTO_BALANCE_O2_BONUS = 10;
```

**Step 2: Apply HAZARD_DENSITY_BY_LAYER in MineGenerator**

File: `src/game/MineGenerator.ts`

In `getBlockWeightsForLayer()` (from sub-phase 8.2), multiply `lavaBlock` and `gasPocket` weights by `HAZARD_DENSITY_BY_LAYER[layer] ?? 1.0`:

```typescript
import { HAZARD_DENSITY_BY_LAYER } from '../data/balance';

function getBlockWeightsForLayer(layer: number): BlockWeights {
  const depth = (layer - 1) / 19;
  const hazardScale = HAZARD_DENSITY_BY_LAYER[layer] ?? 1.0;
  return {
    // ... existing weights ...
    lavaBlock:   layer >= 8  ? lerp(0.01, 0.04, (layer - 8) / 12) * hazardScale : 0,
    gasPocket:   layer >= 5  ? lerp(0.01, 0.03, (layer - 5) / 15) * hazardScale : 0,
    // ...
  };
}
```

**Step 3: Apply O2 tank size from balance constants**

File: `src/game/GameManager.ts`

When starting a layer or distributing O2 tanks, read from `O2_TANK_SIZE_BY_LAYER`:

```typescript
import { O2_TANK_SIZE_BY_LAYER, AUTO_BALANCE_O2_BONUS } from '../data/balance';
import { get } from 'svelte/store';
import { currentLayer } from '../ui/stores/gameState';

getTankSize(): number {
  const layer = get(currentLayer);
  const base = O2_TANK_SIZE_BY_LAYER[layer] ?? 100;
  const ease = this.autoBalanceActive ? AUTO_BALANCE_O2_BONUS : 0;
  return base + ease;
}
```

**Step 4: Implement auto-balance tracker**

File: `src/game/GameManager.ts`

Track consecutive deaths on the same layer. Persist `sameLayerDeathCount` across dives (session-scoped, reset on layer advance):

```typescript
private sameLayerDeathCount = 0;
private lastDeathLayer = -1;
private autoBalanceActive = false;

onPlayerDeath(): void {
  const layer = get(currentLayer);
  if (layer === this.lastDeathLayer) {
    this.sameLayerDeathCount++;
  } else {
    this.sameLayerDeathCount = 1;
    this.lastDeathLayer = layer;
  }
  this.autoBalanceActive = this.sameLayerDeathCount >= AUTO_BALANCE_DEATH_THRESHOLD;
  // Note: auto-balance is NEVER shown to the player. Silent assistance.
}

onLayerAdvance(): void {
  this.sameLayerDeathCount = 0;
  this.autoBalanceActive = false;
}
```

**Step 5: Apply auto-balance hazard scalar in MineGenerator call**

File: `src/game/scenes/MineScene.ts`

Pass `autoBalanceActive` flag to `generateMine()`:

```typescript
const mineMap = generateMine(biome, layer, seed, { hazardScalar: gameManager.isAutoBalanceActive() ? AUTO_BALANCE_HAZARD_SCALAR : 1.0 });
```

Update `generateMine()` signature to accept an options object:

```typescript
export function generateMine(
  biome: BiomeId,
  layer: number,
  seed?: number,
  options?: { hazardScalar?: number }
): MineMap {
  const hazardScalar = options?.hazardScalar ?? 1.0;
  // Apply hazardScalar to lavaBlock and gasPocket weights in addition to HAZARD_DENSITY_BY_LAYER
}
```

**Step 6: Balance simulation script**

File: `scripts/simulate-balance.mjs` (new file)

```javascript
/**
 * Balance simulation: runs 1,000 synthetic dives and reports key metrics.
 * Run with: node scripts/simulate-balance.mjs
 * Uses TypeScript-compiled balance constants via dynamic import.
 */

// Synthetic player model constants
const MOVE_O2_BASE = 1;
const MINE_O2_BASE = 2;
const HAZARD_HIT_PROBABILITY_PER_TICK = 0.02;
const QUIZ_CORRECT_PROBABILITY = 0.65;
const QUIZ_O2_REWARD_BASE = 5;
const QUIZ_TRIGGER_RATE = 0.08;

// Hazard damage model
const LAVA_DAMAGE = 20;
const GAS_DAMAGE = 5; // per tick in cloud

// Layer grid sizes
function getGridSize(layer) {
  if (layer <= 5)  return [20, 20];
  if (layer <= 10) return [25, 25];
  if (layer <= 15) return [30, 30];
  return [40, 40];
}

// O2 tank sizes (mirroring balance.ts)
const O2_BY_LAYER = [100,100,100,100,100,110,115,120,125,130,140,145,150,155,160,175,185,195,205,220];
const HAZARD_DENSITY = [0,0.2,0.4,0.6,0.8,1.0,1.1,1.2,1.3,1.4,1.6,1.8,2.0,2.2,2.5,2.8,3.2,3.6,4.0,4.5];

// O2 depth decay (DD-V2-063)
function getO2Decay(layer) {
  return 1.0 + ((layer - 1) / 19) * 1.5;  // 1.0x at L1, 2.5x at L20
}

function simulateRun() {
  let currentLayer = 1;
  let totalO2Consumed = 0;
  let totalQuizzes = 0;
  let totalBlocks = 0;
  let deaths = 0;

  for (let layer = 1; layer <= 20; layer++) {
    const [w, h] = getGridSize(layer);
    const totalCells = w * h;
    const tankO2 = O2_BY_LAYER[layer - 1];
    const hazardDensity = HAZARD_DENSITY[layer - 1];
    const o2Decay = getO2Decay(layer);

    let o2 = tankO2;
    let ticksOnLayer = 0;
    let survived = true;

    // Simulate traversal: ~60% of cells touched per layer
    const targetBlocks = Math.floor(totalCells * 0.6);
    for (let tick = 0; tick < targetBlocks; tick++) {
      // Movement cost
      const moveCost = MOVE_O2_BASE * o2Decay;
      o2 -= moveCost;
      totalO2Consumed += moveCost;
      totalBlocks++;
      ticksOnLayer++;

      // Quiz trigger
      if (Math.random() < QUIZ_TRIGGER_RATE) {
        totalQuizzes++;
        if (Math.random() < QUIZ_CORRECT_PROBABILITY) {
          o2 += QUIZ_O2_REWARD_BASE;
          totalO2Consumed -= QUIZ_O2_REWARD_BASE; // net reduction
        }
      }

      // Hazard hit
      if (hazardDensity > 0 && Math.random() < HAZARD_HIT_PROBABILITY_PER_TICK * hazardDensity * 0.01) {
        const dmg = Math.random() < 0.5 ? LAVA_DAMAGE : GAS_DAMAGE;
        o2 -= dmg;
        totalO2Consumed += dmg;
      }

      if (o2 <= 0) {
        deaths++;
        survived = false;
        break;
      }
    }

    if (!survived) {
      currentLayer = layer;
      break;
    }
    currentLayer = layer;
  }

  return { layerReached: currentLayer, died: deaths > 0, totalO2Consumed, totalQuizzes, totalBlocks };
}

// Run 1000 simulations
const N = 1000;
const results = Array.from({ length: N }, simulateRun);

const avgLayer = results.reduce((s, r) => s + r.layerReached, 0) / N;
const deathRate = results.filter(r => r.died).length / N;
const avgO2 = results.reduce((s, r) => s + r.totalO2Consumed, 0) / N;
const avgQuizzes = results.reduce((s, r) => s + r.totalQuizzes, 0) / N;

// Death rate per layer
const deathsByLayer = {};
for (const r of results) {
  if (r.died) deathsByLayer[r.layerReached] = (deathsByLayer[r.layerReached] ?? 0) + 1;
}

console.log('=== Balance Simulation Results (N=1000) ===');
console.log(`Average layer reached: ${avgLayer.toFixed(2)}`);
console.log(`Overall death rate: ${(deathRate * 100).toFixed(1)}%`);
console.log(`Average O2 consumed per run: ${avgO2.toFixed(0)}`);
console.log(`Average quizzes triggered per run: ${avgQuizzes.toFixed(1)}`);
console.log('\nDeath rate by layer:');
for (let l = 1; l <= 20; l++) {
  const count = deathsByLayer[l] ?? 0;
  const rate = ((count / N) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(count / 10));
  console.log(`  L${String(l).padStart(2)}: ${rate.padStart(5)}%  ${bar}`);
}
console.log('\n=== Target Benchmarks ===');
console.log('  Avg layer reached: 8-12 (accessible roguelite feel)');
console.log('  Death rate L1-5: <10% (gentle entry)');
console.log('  Death rate L16-20: 40-70% (brutal end-game)');
console.log('  Quiz rate: 6-12 per run');
```

**Step 7: Add `simulate` npm script**

File: `package.json`

Add to the `scripts` block:
```json
"simulate": "node scripts/simulate-balance.mjs"
```

**Step 8: Validate targets and tune constants**

Run the simulation after implementation: `npm run simulate`. If average layer reached is below 6, reduce hazard density at L1-5. If death rate at L1-5 exceeds 10%, reduce `LAVA_DAMAGE` or `HAZARD_HIT_PROBABILITY_PER_TICK`. Adjust constants in `src/data/balance.ts` until targets are met.

Document the accepted simulation output in a code comment at the top of `scripts/simulate-balance.mjs`.

### Acceptance Criteria

- [ ] `HAZARD_DENSITY_BY_LAYER` defined for all 20 layers in `src/data/balance.ts`
- [ ] `O2_TANK_SIZE_BY_LAYER` defined for all 20 layers
- [ ] `MINERAL_TIER_MINIMUM_BY_LAYER` defined for all 20 layers
- [ ] `BIOME_DANGER_RATING` defined for at least 8 biomes
- [ ] `AUTO_BALANCE_DEATH_THRESHOLD = 3` and easing constants defined
- [ ] `getBlockWeightsForLayer()` reads `HAZARD_DENSITY_BY_LAYER` (no hardcoded values)
- [ ] `GameManager.onPlayerDeath()` tracks same-layer death count
- [ ] `GameManager.onLayerAdvance()` resets auto-balance state
- [ ] Auto-balance is invisible to the player (no UI message, no log)
- [ ] `scripts/simulate-balance.mjs` runs without errors: `node scripts/simulate-balance.mjs`
- [ ] Simulation output shows avg layer reached between 6 and 14
- [ ] Simulation death rate at L1-5 below 10%
- [ ] `"simulate"` script added to `package.json`
- [ ] `npm run typecheck` passes
- [ ] `npm run build` clean

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Navigate to mine and verify no L1 hazards visible
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  const pickaxeBtn = await page.$('.pick-btn')
  if (pickaxeBtn) await pickaxeBtn.click()
  const diveBtn = await page.$('.btn-dive')
  if (diveBtn && !(await diveBtn.getAttribute('disabled'))) {
    await diveBtn.click()
  } else {
    const enterBtn = await page.$('button:has-text("Enter Mine")')
    if (enterBtn) await enterBtn.click()
  }
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-8-13-layer1.png' })
  console.log('Layer 1 screenshot taken — verify no lava/gas visible (HAZARD_DENSITY=0 at L1)')
  // Open DevPanel to verify auto-balance and difficulty state
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-8-13-devpanel.png' })
  }
  await browser.close()
  console.log('8.13 difficulty scaling test complete')
  console.log('Also run: node scripts/simulate-balance.mjs to verify balance targets')
})()
```

### Verification Gate

All must pass before starting 8.14:
- [ ] `HAZARD_DENSITY_BY_LAYER[1] === 0.0` (layer 1 has no hazards)
- [ ] `node scripts/simulate-balance.mjs` runs and outputs results without throwing
- [ ] Simulation avg layer reached is between 6 and 14
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean
- [ ] Screenshot at `/tmp/ss-8-13-layer1.png` shows mine without lava or gas tiles
- [ ] Auto-balance death-count tracking verified in DevPanel (3 deaths → easing active)

---

## Sub-Phase 8.14: Auto-Save, Loot Loss, and Send-Up Enhancements

### Overview

**Design Decisions**: DD-V2-053, DD-V2-181

This sub-phase implements the full save/resume loop and the death economics system. Auto-save writes the full mine state to `localStorage` every 30 ticks, enabling crash recovery and mid-session pausing. On death, graduated loot loss applies based on how deep the player reached. The send-up pod mechanic is enhanced: the player can bank minerals mid-dive (at a tick cost), protecting them from the death loot loss penalty.

On app restart, if a mid-dive save exists, the player is offered "Resume Dive" or "Abandon Run". Abandoned runs still apply the loot-loss penalty (simulating extraction failure).

### Sub-Steps

**Step 1: Define SaveState type**

File: `src/data/saveState.ts` (new file)

```typescript
import type { MineMap } from '../game/MineGenerator';
import type { ConsumableType } from './consumables';
import type { CompanionState } from './companions';

/**
 * Full mid-dive save state. Written to localStorage every 30 ticks.
 * Key: 'terra_miner_dive_save'
 * (DD-V2-053)
 */
export interface SaveState {
  /** Schema version for forward-compatibility checks. */
  version: number;
  /** ISO timestamp of last save. */
  savedAt: string;
  /** Serialized mine grid (block types as 2D array of strings). */
  mineGrid: string[][];
  /** Player position in grid coordinates. */
  playerPos: { x: number; y: number };
  /** Current inventory: mineral counts by type. */
  inventory: Record<string, number>;
  /** Cumulative tick count this dive. */
  ticks: number;
  /** Current layer (1-indexed). */
  layer: number;
  /** Active biome id. */
  biome: string;
  /** Current O2 level. */
  o2: number;
  /** Active companion states (in-run temporary upgrades included). */
  companions: CompanionState[];
  /** Equipped relic ids. */
  relicIds: string[];
  /** Quiz history this dive: fact ids answered. */
  quizHistory: string[];
  /** Consumable slots. */
  consumableSlots: [ConsumableType | null, ConsumableType | null, ConsumableType | null];
  /** Minerals already banked via send-up this run. Exempt from loot loss. */
  bankedMinerals: Record<string, number>;
  /** Auto-balance state. */
  sameLayerDeathCount: number;
  lastDeathLayer: number;
}

export const SAVE_STATE_KEY = 'terra_miner_dive_save';
export const SAVE_STATE_VERSION = 1;
```

**Step 2: Create SaveManager**

File: `src/game/managers/SaveManager.ts` (new file)

```typescript
import type { SaveState } from '../../data/saveState';
import { SAVE_STATE_KEY, SAVE_STATE_VERSION } from '../../data/saveState';

/**
 * SaveManager handles auto-save, state hydration, and save deletion.
 * Writes to localStorage every AUTO_SAVE_TICK_INTERVAL ticks. (DD-V2-053)
 */
export const AUTO_SAVE_TICK_INTERVAL = 30;

export class SaveManager {
  /**
   * Write the current game state to localStorage.
   * Called by TickSystem listener every 30 ticks.
   */
  static save(state: SaveState): void {
    try {
      const serialized = JSON.stringify({ ...state, version: SAVE_STATE_VERSION, savedAt: new Date().toISOString() });
      localStorage.setItem(SAVE_STATE_KEY, serialized);
    } catch (e) {
      console.warn('[SaveManager] Failed to write save state:', e);
    }
  }

  /**
   * Load a save state from localStorage.
   * Returns null if no save exists or version mismatch.
   */
  static load(): SaveState | null {
    try {
      const raw = localStorage.getItem(SAVE_STATE_KEY);
      if (!raw) return null;
      const parsed: SaveState = JSON.parse(raw);
      if (parsed.version !== SAVE_STATE_VERSION) {
        console.warn('[SaveManager] Save version mismatch — discarding stale save.');
        SaveManager.clear();
        return null;
      }
      return parsed;
    } catch (e) {
      console.warn('[SaveManager] Failed to parse save state:', e);
      return null;
    }
  }

  /**
   * Delete the save state. Called on successful run completion or deliberate abandonment.
   */
  static clear(): void {
    localStorage.removeItem(SAVE_STATE_KEY);
  }

  /**
   * Returns true if a mid-dive save exists.
   */
  static hasSave(): boolean {
    return localStorage.getItem(SAVE_STATE_KEY) !== null;
  }
}
```

**Step 3: Register auto-save tick listener in GameManager**

File: `src/game/GameManager.ts`

```typescript
import { SaveManager, AUTO_SAVE_TICK_INTERVAL } from './managers/SaveManager';
import { TickSystem } from './systems/TickSystem';

startDive(/* ... */): void {
  // ... existing init ...
  TickSystem.getInstance().register('autoSave', (tick) => {
    if (tick % AUTO_SAVE_TICK_INTERVAL === 0) {
      SaveManager.save(this.buildSaveState());
    }
  });
}

/**
 * Construct a SaveState snapshot from current game state.
 */
buildSaveState(): SaveState {
  return {
    version: SAVE_STATE_VERSION,
    savedAt: new Date().toISOString(),
    mineGrid: this.currentMineMap.grid.map(row => row.map(cell => cell.type)),
    playerPos: { x: this.playerX, y: this.playerY },
    inventory: get(playerInventory),
    ticks: TickSystem.getInstance().getTick(),
    layer: get(currentLayer),
    biome: this.currentBiome,
    o2: get(currentO2),
    companions: get(playerCompanionStates),
    relicIds: get(equippedRelics).map(r => r.id),
    quizHistory: this.quizManager.getHistoryThisRun(),
    consumableSlots: this.consumableSlots,
    bankedMinerals: this.bankedMinerals,
    sameLayerDeathCount: this.sameLayerDeathCount,
    lastDeathLayer: this.lastDeathLayer,
  };
}
```

**Step 4: Resume-from-save flow**

File: `src/ui/App.svelte` (or top-level routing component)

On app mount, check `SaveManager.hasSave()`. If true, display a `ResumeDiveModal` offering "Resume Dive" or "Abandon Run":

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { SaveManager } from '../game/managers/SaveManager';

  let showResumeModal = false;

  onMount(() => {
    if (SaveManager.hasSave()) showResumeModal = true;
  });

  function handleResume() {
    showResumeModal = false;
    // Load save state and transition directly to mine
    const save = SaveManager.load();
    if (save) {
      gameManager.restoreFromSave(save);
      viewState = 'mine';
    }
  }

  function handleAbandon() {
    showResumeModal = false;
    const save = SaveManager.load();
    if (save) {
      // Apply loot loss on abandoned run
      applyLootLoss(save.layer, save.inventory, save.bankedMinerals);
    }
    SaveManager.clear();
  }
</script>

{#if showResumeModal}
  <ResumeDiveModal onResume={handleResume} onAbandon={handleAbandon} />
{/if}
```

**Step 5: Create ResumeDiveModal Svelte component**

File: `src/ui/components/ResumeDiveModal.svelte` (new file)

```svelte
<script lang="ts">
  import { SaveManager } from '../../game/managers/SaveManager';

  export let onResume: () => void = () => {};
  export let onAbandon: () => void = () => {};

  const save = SaveManager.load();
  const savedDate = save ? new Date(save.savedAt).toLocaleString() : '';
</script>

<div class="resume-modal" role="dialog" aria-modal="true" aria-labelledby="resume-heading">
  <div class="resume-card">
    <h2 id="resume-heading">Mid-Dive Save Found</h2>
    {#if save}
      <p class="save-info">Layer {save.layer} · {save.ticks} ticks · saved {savedDate}</p>
    {/if}
    <p class="resume-desc">You were deep underground. Resume your dive or abandon the run (you'll keep banked minerals, but loose inventory may be lost).</p>
    <div class="resume-actions">
      <button class="btn-resume" on:click={onResume}>Resume Dive</button>
      <button class="btn-abandon" on:click={onAbandon}>Abandon Run</button>
    </div>
  </div>
</div>

<style>
  .resume-modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 300;
  }
  .resume-card {
    background: #1a1a2e; border: 2px solid #4488ff;
    border-radius: 8px; padding: 28px; max-width: 340px; width: 90%;
    color: #e0e0e0; text-align: center;
  }
  h2 { font-size: 0.9rem; margin: 0 0 12px; color: #88aaff; }
  .save-info { font-size: 0.7rem; color: #aaa; margin: 0 0 12px; }
  .resume-desc { font-size: 0.75rem; line-height: 1.5; margin: 0 0 20px; }
  .resume-actions { display: flex; flex-direction: column; gap: 10px; }
  .btn-resume {
    background: #2a5298; color: #fff; border: none;
    padding: 14px; border-radius: 4px; cursor: pointer;
    min-height: 48px; font-size: 0.8rem;
  }
  .btn-abandon {
    background: #3a2020; color: #f88; border: 1px solid #744;
    padding: 14px; border-radius: 4px; cursor: pointer;
    min-height: 48px; font-size: 0.8rem;
  }
</style>
```

**Step 6: Implement graduated loot loss on death**

File: `src/game/GameManager.ts`

```typescript
import { LOOT_LOSS_RATES } from '../data/balance';

/**
 * Apply graduated loot loss on player death.
 * Banked minerals are always exempt. (DD-V2-181)
 * Layer 1-5: 0% loss. Layer 6-10: 15% loss. Layer 11-20: 30% loss.
 */
applyLootLoss(layer: number, inventory: Record<string, number>, bankedMinerals: Record<string, number>): void {
  let lossRate = 0;
  if (layer >= 6 && layer <= 10) lossRate = 0.15;
  else if (layer >= 11) lossRate = 0.30;

  if (lossRate === 0) return;

  const result: Record<string, number> = {};
  for (const [mineral, count] of Object.entries(inventory)) {
    const banked = bankedMinerals[mineral] ?? 0;
    const atRisk = Math.max(0, count - banked);
    const lost = Math.floor(atRisk * lossRate);
    result[mineral] = Math.max(0, count - lost);
  }
  playerInventory.set(result);
}
```

Add to `src/data/balance.ts`:
```typescript
// ---- Loot Loss Rates on Death (DD-V2-181) ----
export const LOOT_LOSS_RATE_SHALLOW = 0;     // L1-5: no loss
export const LOOT_LOSS_RATE_MID = 0.15;      // L6-10: 15% of un-banked minerals lost
export const LOOT_LOSS_RATE_DEEP = 0.30;     // L11-20: 30% of un-banked minerals lost
```

**Step 7: Send-up pod enhancement — mid-dive mineral banking**

File: `src/game/GameManager.ts`

The send-up pod costs 5 ticks and moves the player's current portable mineral inventory into `bankedMinerals`. These are immediately sent to the dome and are exempt from loot loss:

```typescript
/**
 * Execute a send-up: bank all current minerals, costing SEND_UP_TICK_COST ticks.
 * Minerals transferred to bankedMinerals are safe from death loot loss.
 * Also physically extracts them to dome storage immediately.
 */
executeSendUp(): void {
  const SEND_UP_TICK_COST = 5;
  const inventory = get(playerInventory);

  // Merge current inventory into bankedMinerals
  for (const [mineral, count] of Object.entries(inventory)) {
    this.bankedMinerals[mineral] = (this.bankedMinerals[mineral] ?? 0) + count;
  }

  // Clear portable inventory
  playerInventory.set({});

  // Advance ticks by SEND_UP_TICK_COST to represent pod deployment
  for (let i = 0; i < SEND_UP_TICK_COST; i++) {
    TickSystem.getInstance().advance();
  }

  this.gaiaManager.showToast('Send-up pod deployed. Minerals safe in dome storage.');
}
```

Add to `src/data/balance.ts`:
```typescript
export const SEND_UP_TICK_COST = 5;
```

**Step 8: GameManager.restoreFromSave() implementation**

File: `src/game/GameManager.ts`

```typescript
import type { SaveState } from '../../data/saveState';

/**
 * Restore full game state from a SaveState snapshot.
 * Called when player chooses "Resume Dive" at app start.
 */
restoreFromSave(save: SaveState): void {
  // Restore stores
  currentLayer.set(save.layer);
  currentO2.set(save.o2);
  playerInventory.set(save.inventory);
  equippedRelics.set(
    save.relicIds
      .map(id => RELIC_CATALOGUE.find(r => r.id === id))
      .filter((r): r is RelicDefinition => r !== undefined)
  );

  // Restore manager state
  TickSystem.getInstance().resetAll();
  // Note: tick counter starts at 0 after resume — layerTick resets on restore
  this.currentBiome = save.biome as BiomeId;
  this.bankedMinerals = save.bankedMinerals;
  this.sameLayerDeathCount = save.sameLayerDeathCount;
  this.lastDeathLayer = save.lastDeathLayer;
  this.consumableSlots = save.consumableSlots;

  // Rebuild mine from saved grid
  this.currentMineMap = hydrateMineMap(save.mineGrid, save.layer);
  this.playerX = save.playerPos.x;
  this.playerY = save.playerPos.y;

  // Re-initialize managers
  this.relicManager = new RelicManager(get(equippedRelics));
  const companionId = selectedLoadout ? get(selectedLoadout).companionId : null;
  this.companionManager = new CompanionManager();
  this.companionManager.setCompanion(companionId, save.companions);

  // Re-register auto-save listener
  TickSystem.getInstance().register('autoSave', (tick) => {
    if (tick % AUTO_SAVE_TICK_INTERVAL === 0) SaveManager.save(this.buildSaveState());
  });

  // Re-apply quiz history to QuizManager
  this.quizManager.restoreHistory(save.quizHistory);
}
```

Add `hydrateMineMap()` helper to `src/game/MineGenerator.ts`:

```typescript
/**
 * Reconstruct a MineMap from a serialized grid (string[][]).
 * Used for save/restore.
 */
export function hydrateMineMap(grid: string[][], layer: number): MineMap {
  const [width, height] = getLayerGridSize(layer);
  return {
    width,
    height,
    layer,
    grid: grid.map(row => row.map(cellType => ({ type: cellType as BlockType }))),
    spawnX: 0, // Will be overridden by playerPos from SaveState
    spawnY: 0,
    shaftX: 0,
    shaftY: 0,
  };
}
```

### Acceptance Criteria

- [ ] `SaveState` type defined in `src/data/saveState.ts` with all 16 fields
- [ ] `SaveManager.save()` writes to `localStorage` key `'terra_miner_dive_save'`
- [ ] `SaveManager.load()` returns `null` for missing or version-mismatched saves
- [ ] Auto-save fires every 30 ticks (verified via DevPanel tick counter)
- [ ] `ResumeDiveModal` renders on app start when a save exists
- [ ] "Resume Dive" restores player to correct layer with correct O2 level
- [ ] "Abandon Run" clears save and applies loot loss before returning to dome
- [ ] Loot loss at L1-5 = 0% (no minerals lost)
- [ ] Loot loss at L6-10 = 15% of un-banked minerals lost
- [ ] Loot loss at L11-20 = 30% of un-banked minerals lost
- [ ] Banked minerals are never included in loot loss calculation
- [ ] `executeSendUp()` costs exactly 5 ticks and clears portable inventory
- [ ] `executeSendUp()` transfers minerals to `bankedMinerals` (exempting them from loss)
- [ ] `hydrateMineMap()` reconstructs a valid `MineMap` from serialized grid
- [ ] `LOOT_LOSS_RATE_SHALLOW/MID/DEEP` and `SEND_UP_TICK_COST` exported from `balance.ts`
- [ ] `npm run typecheck` passes
- [ ] `npm run build` clean

### Playwright Test Script

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })

  // --- Test 1: Fresh app (no save) shows no resume modal ---
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  const resumeModal = await page.$('.resume-modal')
  console.log('Resume modal on fresh load (expect false):', resumeModal !== null)
  await page.screenshot({ path: '/tmp/ss-8-14-fresh.png' })

  // --- Test 2: Navigate into mine and verify auto-save ---
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  const pickaxeBtn = await page.$('.pick-btn')
  if (pickaxeBtn) await pickaxeBtn.click()
  const diveBtn = await page.$('.btn-dive')
  if (diveBtn && !(await diveBtn.getAttribute('disabled'))) {
    await diveBtn.click()
  } else {
    const enterBtn = await page.$('button:has-text("Enter Mine")')
    if (enterBtn) await enterBtn.click()
  }
  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/ss-8-14-mine.png' })

  // Check localStorage for auto-save (wait 35 ticks worth of play)
  await page.waitForTimeout(2000)
  const hasSave = await page.evaluate(() => localStorage.getItem('terra_miner_dive_save') !== null)
  console.log('Auto-save written to localStorage after 35 ticks (may need manual play):', hasSave)

  // --- Test 3: Reload page and check for resume modal ---
  await page.reload()
  await page.waitForTimeout(2000)
  const resumeAfterReload = await page.$('.resume-modal')
  console.log('Resume modal appears after reload with save present:', resumeAfterReload !== null)
  if (resumeAfterReload) {
    await page.screenshot({ path: '/tmp/ss-8-14-resume-modal.png' })
    // Test abandon button
    const abandonBtn = await page.$('.btn-abandon')
    if (abandonBtn) {
      await abandonBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: '/tmp/ss-8-14-after-abandon.png' })
      const saveGone = await page.evaluate(() => localStorage.getItem('terra_miner_dive_save') === null)
      console.log('Save cleared after abandon:', saveGone)
    }
  }

  await browser.close()
  console.log('8.14 auto-save and loot-loss test complete')
})()
```

### Verification Gate

All must pass before Phase 8 is considered complete:
- [ ] `src/data/saveState.ts` exists with `SaveState` interface and constants
- [ ] `src/game/managers/SaveManager.ts` exists with `save()`, `load()`, `clear()`, `hasSave()`
- [ ] `src/ui/components/ResumeDiveModal.svelte` exists
- [ ] `hydrateMineMap()` exported from `src/game/MineGenerator.ts`
- [ ] `localStorage.getItem('terra_miner_dive_save')` contains valid JSON after 30+ ticks in mine
- [ ] Resume modal appears on page reload when save exists (screenshot `/tmp/ss-8-14-resume-modal.png`)
- [ ] Save cleared after abandon (console log confirms)
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean
- [ ] Full Phase 8 verification: all 14 sub-phases complete, `PROGRESS.md` updated, phase doc moved to `docs/roadmap/completed/`

---

## Sub-Phase 8.17: Mine Generation Profiling

- [ ] Profile 40×40 mine generation (Layer 16-20 grid size) on a mid-range Android WebView; measure time from `generateMine()` call to first rendered frame. (DD-V2-191)
- [ ] Cap BFS flood-fill (fog-of-war reveal, connectivity checks) at 200 cells per animation frame tick; spread the remainder across subsequent frames to avoid jank.

## Sub-Phase 8.18: Seed Determinism Tests

- [ ] Write snapshot tests for 20 seeds × 3 depth layers (1, 10, 20) asserting identical mine grid output across builds and environments. (DD-V2-217)
- [ ] Integrate with the Phase 18 CI pipeline (18.9); failing snapshots block merge to `main`.
