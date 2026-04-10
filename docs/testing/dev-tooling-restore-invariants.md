# Dev Tooling — Restore Invariants

> **Purpose:** Invariants that `__rrPlay.restore()` / `scenarioSimulator.restore()` MUST satisfy,
> and how to test them.
> **Last verified:** 2026-04-10 (CRITICAL-3 fix)
> **Source files:** src/dev/scenarioSimulator.ts, src/services/encounterBridge.ts,
> src/services/runSaveService.ts, src/dev/scenarioSimulator.test.ts

---

## Background

`__rrPlay.restore(snap)` in the browser console (and `scenarioSimulator.restore(snap)` in tests)
is the primary mechanism for jumping the game into a pre-captured state during development and LLM
playtesting. It underpins the `/inspect`, `/llm-playtest`, and `/scenario-playtest` skills.

A broken `restore()` means these skills silently produce incorrect results — making bugs
*look fixed* even when they are not.

---

## Invariant 1: Svelte stores are updated

`restore()` calls `writeStore()` for every top-level field in the snapshot. After restore, reading
any Svelte store (e.g., `runState`, `currentScreen`, `activeTurnState`) must reflect the snapshot
values.

**Test:** `src/dev/scenarioSimulator.test.ts` — mock `readStore` / `writeStore` and verify calls.

---

## Invariant 2: Combat screen re-mounts the Phaser CombatScene (CRITICAL-3)

When `snap.screen === 'combat'`, restore MUST:
1. Boot the Phaser game if not already running (`CardGameManager.getInstance().boot()`)
2. Start the CombatScene if not already active (`CardGameManager.getInstance().startCombat()`)
3. Call `syncCombatDisplayFromCurrentState()` (from `encounterBridge`) to push the stored
   `activeTurnState` into the live Phaser scene

**Why this is necessary:** Phaser scenes do NOT subscribe to Svelte stores reactively. Writing to
`activeTurnState` store alone leaves the canvas black — the CombatScene's enemy sprites, HP bars,
and backgrounds are only updated by explicit calls to `syncCombatScene(turnState)`.

**Implementation:** `scenarioSimulator.ts` fires a fire-and-forget async IIFE after writing stores.
This means the Svelte UI update is synchronous and the Phaser sync happens ~50 ms later. Callers
that need to screenshot should wait at least 500 ms after calling `restore()`.

**Test:** `src/dev/scenarioSimulator.test.ts` — mocks `CardGameManager` and `encounterBridge`,
verifies `boot()` and `syncCombatDisplayFromCurrentState()` are not called for non-combat screens.

**The exported function:**
```typescript
// src/services/encounterBridge.ts
export function syncCombatDisplayFromCurrentState(): void
```
This is the bridge between `restore()` and the live Phaser scene. It reads `activeTurnState` from
the store and calls the internal `syncCombatScene(ts)` that updates enemy sprites, HP, etc.
Guards gracefully when `activeTurnState` is null (logs a DEV warning, returns early).

---

## Invariant 3: Non-combat screens do NOT trigger Phaser boot

When `snap.screen !== 'combat'` (e.g., `'dungeonMap'`, `'shop'`, `'reward'`), restore must NOT
call `CardGameManager.boot()` or `startCombat()`. Phaser boot is expensive and unexpected for
screens that don't need it.

**Test:** `src/dev/scenarioSimulator.test.ts` — verifies mockBoot and mockStartCombat are not
called after a 100 ms delay when no restore was triggered.

---

## Invariant 4: RunState Set/Map fields survive round-trip (CRITICAL-2)

Any snapshot captured via `__rrPlay.capture()` will serialize RunState to JSON. When restored,
all `Set`-typed fields on RunState must come back as proper `Set` instances — not plain `{}`.

**Test:** `src/services/runSaveService.test.ts` — exercises the full JSON round-trip via
`saveActiveRun()` / `loadActiveRun()` and verifies `.has()` on every Set field.

**Rule:** See `.claude/rules/save-load.md` §"Rehydrating Typed Collections".

---

## Pre-Flight Checklist for Restore-Dependent Scenarios

Before relying on `restore()` in a playtest session:

1. **Verify the snapshot's `screen` field matches the expected game screen.**
   A combat snapshot loaded while on the main menu will attempt to boot Phaser — this may fail
   if the game hasn't been initialized yet.

2. **Wait at least 500 ms after calling `restore()` before capturing a screenshot.**
   Phaser sync is deferred 50 ms; scene animations may require additional settling time.

3. **After restore, check `window.__rrDebug()` for error output.**
   If `syncCombatDisplayFromCurrentState` found no active turn state, it will log a DEV warning.

4. **If the Phaser canvas is black after restore:**
   - Check `window.__rrLog` for `[restore] Could not sync CombatScene` warnings
   - Verify `activeTurnState` store has a non-null value: `window.__rrDebug().activeTurnState`
   - Re-run the capture in a live combat session and check the snapshot has `activeTurnState`

---

## Regression Test Suite

```bash
npx vitest run src/dev/scenarioSimulator.test.ts   # CRITICAL-3: restore() combat re-mount
npx vitest run src/services/runSaveService.test.ts  # CRITICAL-2: Set/Map round-trip
```

Both test files mock all browser/Phaser dependencies and run in Node (no DOM needed).
