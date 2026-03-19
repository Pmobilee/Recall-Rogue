# AR-105: Headless Combat Simulator V2 — Import Real Code, Not Rewrite

## Overview

**Goal:** Build a Node.js headless combat simulator that IMPORTS the actual game's turn manager, card resolver, enemy manager, and relic system — zero reimplementation. Runs 1,000+ encounters per second for rapid balance iteration.

**Why the old headless sim failed:** It REWROTE combat math in a separate file (`headless-combat.ts`). Every game change required manual porting. It drifted silently — wrong damage formulas, missing relic effects, excluded mechanics. The data was unreliable.

**Why this is different:** We import `turnManager.ts`, `cardEffectResolver.ts`, `relicEffectResolver.ts`, and `enemyManager.ts` directly. When `balance.ts` changes, the simulator automatically uses new values. Zero drift by design.

**Why the browser bot isn't enough:** SwiftShader uses 500%+ CPU per instance. Parallel 1 only. 1 run/min. 20 runs in 30 min. Can't iterate on balance.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Node.js Runner (tsx)                                │
│                                                      │
│  svelte-store-shim.ts ─── mocks get(), writable()   │
│  phaser-shim.ts ────────── no-ops for scene calls    │
│                                                      │
│  IMPORTS (real game code, zero rewrites):             │
│  ├─ src/services/turnManager.ts                      │
│  │   └─ startEncounter(), playCardAction(),          │
│  │      endPlayerTurn()                              │
│  ├─ src/services/cardEffectResolver.ts               │
│  ├─ src/services/playerCombatState.ts                │
│  ├─ src/services/enemyManager.ts                     │
│  ├─ src/services/relicEffectResolver.ts              │
│  ├─ src/services/relicSynergyResolver.ts             │
│  ├─ src/services/chainSystem.ts                      │
│  ├─ src/services/surgeSystem.ts                      │
│  ├─ src/services/discoverySystem.ts                  │
│  ├─ src/services/deckManager.ts                      │
│  ├─ src/data/balance.ts (ALL balance constants)      │
│  ├─ src/data/enemies.ts (ALL enemy templates)        │
│  ├─ src/data/card-types.ts (ALL card types)          │
│  ├─ src/data/relics/ (ALL relic definitions)         │
│  └─ src/data/mechanics.ts                            │
│                                                      │
│  Simulation Loop:                                    │
│  1. Create deck (starter cards + random additions)   │
│  2. Create enemy from template                       │
│  3. startEncounter(deck, enemy)                      │
│  4. Loop: playCardAction() → track stats             │
│  5. endPlayerTurn() → enemy attacks                  │
│  6. Repeat until victory/defeat                      │
│  7. Advance floor, pick next enemy, heal between     │
│  8. Track: HP, damage, cards, relics, death floor    │
│                                                      │
│  Output: JSON stats identical to BotRunStats         │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Svelte Store Shim

### File: `tests/playtest/headless/svelte-shim.ts`

The game code imports `{ get, writable }` from `'svelte/store'`. In Node.js, Svelte isn't available. Create a shim that tsx resolves instead.

```typescript
// Minimal Svelte store shim for Node.js
export function writable<T>(initial: T) {
  let value = initial;
  const subs: Array<(v: T) => void> = [];
  return {
    set(v: T) { value = v; subs.forEach(s => s(v)); },
    update(fn: (v: T) => T) { value = fn(value); subs.forEach(s => s(value)); },
    subscribe(fn: (v: T) => void) { fn(value); subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; },
  };
}

export function readable<T>(initial: T, _start?: unknown) {
  return writable(initial);
}

export function derived<T>(_stores: unknown, fn: (...args: unknown[]) => T) {
  return writable(fn());
}

export function get<T>(store: { subscribe: (fn: (v: T) => void) => unknown }): T {
  let value: T;
  store.subscribe((v) => { value = v; })();
  return value!;
}
```

### Resolution Strategy

Use tsx with `--tsconfig` pointing to a config that maps `svelte/store` → our shim:

```json
// tests/playtest/headless/tsconfig.json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "svelte/store": ["./svelte-shim.ts"],
      "svelte": ["./svelte-shim.ts"]
    }
  }
}
```

OR use Node's `--loader` / `--require` to intercept the import.
OR simply use `tsx` with `tsconfig.paths` + `tsconfig-paths` package.

---

## Phase 2: Browser/Phaser Shims

### Modules that need no-op shims:

1. **`src/services/juiceManager.ts`** — visual effects, no-op
2. **`src/services/cardAudioManager.ts`** — sound, no-op
3. **`src/services/analyticsService.ts`** — telemetry, no-op
4. **`src/services/subscriptionService.ts`** — subscription check, return false
5. **`src/game/scenes/CombatScene.ts`** — Phaser scene, no-op class
6. **`localStorage`** — simple in-memory Map
7. **`window` / `globalThis` symbols** — mock store registry

### Strategy: Intercept at import time

Instead of shimming every file, intercept imports that fail:

```typescript
// Register module resolution hooks in tsx
// If import fails (Phaser, audio, etc.), return empty module
```

OR: Create a barrel file that re-exports only what we need from encounterBridge, skipping the Phaser/audio parts.

---

## Phase 3: Simulation Engine

### File: `tests/playtest/headless/simulator.ts`

```typescript
import { startEncounter, playCardAction, endPlayerTurn } from '../../../src/services/turnManager';
import { createEnemy } from '../../../src/services/enemyManager';
import { createDeck } from '../../../src/services/deckManager';
import { ENEMY_TEMPLATES } from '../../../src/data/enemies';
import { FULL_RELIC_CATALOGUE } from '../../../src/data/relics';
import * as balance from '../../../src/data/balance';

interface SimConfig {
  quizAccuracy: number;    // 0-1
  chargeRate: number;      // 0-1
  strategy: 'basic' | 'intermediate' | 'optimal';
  maxFloors: number;       // how deep to go
  relicIds: string[];      // relics to equip
  seed: number;
}

interface SimResult {
  deathFloor: number;
  totalCards: number;
  totalTurns: number;
  encounters: Array<{ enemy: string; floor: number; result: 'won' | 'lost'; turns: number; hpLost: number }>;
  // ... compatible with BotRunStats
}

function simulateRun(config: SimConfig): SimResult {
  // Build initial deck from starter composition
  // For each floor:
  //   Pick enemy from floor's template pool
  //   startEncounter(deck, enemy)
  //   While encounter not over:
  //     Pick card (smart selection based on strategy)
  //     Decide charge vs quick (based on chargeRate)
  //     playCardAction(turnState, cardId, correct, false, mode)
  //     If AP exhausted: endPlayerTurn(turnState)
  //   Apply post-encounter healing
  //   If player dead: record death floor, return
  // Return stats
}
```

### Card Selection Logic

Reuse the same strategy logic from the browser bot's `selectCardIndex`:
- Basic: random
- Intermediate: shield when enemy attacking + low HP
- Optimal: 5-priority decision tree

### Quiz Accuracy Simulation

```typescript
const answeredCorrectly = Math.random() < config.quizAccuracy;
```

### Post-Encounter Healing

```typescript
const healPct = balance.POST_ENCOUNTER_HEAL_PCT;
playerHP = Math.min(maxHP, playerHP + Math.floor(maxHP * healPct));
```

---

## Phase 4: Run Manager

### File: `tests/playtest/headless/run-headless.ts`

CLI that runs N simulations and outputs JSON:

```bash
# Run 1000 games with scholar profile
npx tsx tests/playtest/headless/run-headless.ts --profile scholar --runs 1000

# Run all profiles
npx tsx tests/playtest/headless/run-headless.ts --all --runs 500

# Output to timestamped folder
npx tsx tests/playtest/headless/run-headless.ts --all --runs 1000 --description "Post healing buff"
```

Output: Same `data/playtests/runs/YYYY-MM-DD_HH-MM-SS/` structure with `combined.json`, `README.md`, balance report.

---

## Phase 5: Validation — Compare Headless vs Browser Bot

Run the SAME seeds on both systems and compare results:
1. Run 10 browser bot games, record seeds + results
2. Run the same 10 seeds on headless sim
3. Compare: damage dealt, HP lost, turns per encounter, death floor
4. If they match within 5%, the headless sim is accurate
5. If they don't match, identify which mechanic diverges

This is the CRITICAL validation step. If results don't match, we need to find and fix the divergence before trusting headless data.

---

## Success Criteria

- [ ] Headless sim imports real game code (turnManager, cardEffectResolver, etc.)
- [ ] svelte/store shim works — no import errors
- [ ] 1,000+ runs complete without errors
- [ ] Speed: >100 runs/second
- [ ] Validation: headless vs browser bot results match within 10% on same seeds
- [ ] Output format compatible with existing analyzer
- [ ] Balance iteration cycle: change value → run 1000 games → analyze → <5 minutes total

---

## Risk: What Can Go Wrong

1. **Import chain explosion** — turnManager imports encounterBridge which imports 35+ modules. May need to extract turnManager's core functions into a separate import path.
2. **Module-level side effects** — Some modules execute code on import (register stores, set globals). These may crash in Node.js.
3. **Circular dependencies** — Svelte projects sometimes have circular imports that work in the browser but fail in Node.
4. **Missing browser APIs** — `localStorage`, `window`, `document` referenced in imported modules.

### Mitigation: Incremental approach
Start by importing ONLY `turnManager.ts` + `balance.ts` + `enemies.ts`. If that works, add more. If it breaks, identify the failing import and shim it.

---

## Files Created

- `tests/playtest/headless/svelte-shim.ts` — Svelte store mock
- `tests/playtest/headless/browser-shim.ts` — localStorage, window mocks
- `tests/playtest/headless/simulator.ts` — Core simulation engine
- `tests/playtest/headless/run-headless.ts` — CLI runner
- `tests/playtest/headless/tsconfig.json` — Path mappings for shims
