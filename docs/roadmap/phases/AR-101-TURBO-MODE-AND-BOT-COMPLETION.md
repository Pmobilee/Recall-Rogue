# AR-101: Turbo Mode + Bot Run Completion

## Overview

**Goal:** Add a `?turbo=true` URL parameter that disables ALL blocking animations and delays while keeping game logic byte-for-byte identical. Then fix the remaining bot issues so it completes full runs in <30 seconds.

**Why:** The Playwright bot takes 5+ minutes per run because the game waits for animations. With turbo mode, target is <10 seconds per run. This enables mass-testing hundreds of games against the REAL game engine.

**CRITICAL CONSTRAINT:** Turbo mode ONLY affects timing/visuals. Game logic (damage, HP, cards, relics, enemy AI, healing, deck management) MUST be identical. The bot tests the real game or it tests nothing.

**Estimated complexity:** MEDIUM

---

## Phase 1: Turbo Mode Flag

### 1.1 Create turbo mode store
Create a simple boolean flag readable from anywhere:
- Read `?turbo=true` from URL params in `src/main.ts`
- Store in a global: `globalThis[Symbol.for('terra:turboMode')] = true`
- Also export a utility: `export function isTurboMode(): boolean`

### 1.2 Key files to check for the flag
- `src/services/encounterBridge.ts` — victory/defeat delays, card draw stagger
- `src/ui/components/CardCombatOverlay.svelte` — card play animation sequence
- `src/ui/components/CardRewardScreen.svelte` — reward step auto-advance
- `src/ui/components/QuizOverlay.svelte` — quiz answer auto-dismiss
- `src/game/scenes/CombatScene.ts` — kill confirmation, death animation

---

## Phase 2: Eliminate Blocking Delays

### 2.1 encounterBridge.ts — Victory/Defeat delays (550ms each)
```
Line ~721-724: setTimeout(() => { ... }, 550) // victory
Line ~819-823: setTimeout(() => { ... }, 550) // defeat
```
Change to: `setTimeout(() => { ... }, isTurboMode() ? 0 : 550)`

### 2.2 encounterBridge.ts — Card draw stagger (90ms × cards)
```
Line ~477: await wait(90 * i) // card draw stagger
```
Change to: `await wait(isTurboMode() ? 0 : 90 * i)`

### 2.3 CardCombatOverlay.svelte — Card play animation sequence (~1000ms)
The REVEAL→SWOOSH→IMPACT→DISCARD chain blocks the next card play.
In turbo mode, execute the callback chain immediately (0ms timeouts).

### 2.4 CardCombatOverlay.svelte — End turn animation (~450ms)
Hand cards animate out before `onendturn()` fires.
In turbo mode, call `onendturn()` immediately.

### 2.5 CardRewardScreen.svelte — Step auto-advance (900ms + 1000ms)
Gold reveal → heal step → card selection has ~2 second wait.
In turbo mode, advance immediately.

### 2.6 QuizOverlay.svelte — Correct answer dismiss (1000ms)
In turbo mode, call `onAnswer(true)` immediately.

### 2.7 CombatScene.ts — Kill confirmation tween (~300ms)
The kill punch + death animation blocks encounter completion.
In turbo mode, resolve immediately.

### 2.8 CardCombatOverlay.svelte — Reshuffle delay (40ms × cards + 300ms)
In turbo mode, skip reshuffle animation entirely.

---

## Phase 3: Bot Run Completion Fixes

### 3.1 Reward room — wait for reward UI or skip
The `rewardRoom` screen shows combat UI during victory animation. In turbo mode this resolves instantly. But also add: if on `rewardRoom` with no reward buttons after 500ms, accept whatever is shown or skip.

### 3.2 Segment completion — limit delve count
The bot loops infinitely delving. Add a segment counter and cap at 4 segments (matching game structure). After 4 segments, detect run completion.

### 3.3 Run-end detection — check for hub/base return
After the final segment, the game returns to hub. Detect: if on `hub`/`base` AND `stats.totalCardsPlayed > 0`, the run is complete.

### 3.4 Floor tracking — debug the field name
Log `Object.keys(runState)` once during combat to find the actual floor field name.

### 3.5 Remove debug logging
Strip all `[MAP]`, `[iter]` console.logs from bot.ts.

---

## Phase 4: Delete Headless Simulator

### 4.1 Archive these files
- `tests/playtest/core/headless-combat.ts` → `src/_archived/headless-combat.ts`
- `tests/playtest/core/combat-strategies.ts` → `src/_archived/combat-strategies.ts`
- `tests/playtest/core/types.ts` → keep (shared types may be used)
- `scripts/mass-simulate.ts` → `src/_archived/mass-simulate.ts`

### 4.2 Update CLAUDE.md
Remove references to headless simulator. Document the Playwright bot as the canonical testing tool.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` — tests pass
- [ ] Bot completes 1 full run with `?turbo=true` in <30 seconds
- [ ] Bot result is either victory or defeat (not error/timeout)
- [ ] Game logic in turbo mode is identical (same damage, same HP, same cards)
- [ ] Normal mode (no turbo flag) is completely unaffected
- [ ] Headless simulator files archived
