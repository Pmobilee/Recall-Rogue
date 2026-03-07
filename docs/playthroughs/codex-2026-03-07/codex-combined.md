# Codex Tasks — Playthrough Bug Fixes

Derived from consolidated playthrough reports (`docs/playthroughs/codex-2026-03-07/`).
Only includes confirmed code bugs with exact file paths and clear acceptance criteria.

Items marked ALREADY FIXED are included for reference only — do not re-implement.

---

## Task 1: Fix Preset Race Condition — Presets Land on `cutscene` Instead of Target Screen

**Severity**: CRITICAL — root cause of ~70% of all playthrough failures.

**Problem**: Dev presets (e.g. `post_tutorial`, `rich_player`, `many_reviews_due`) land on the `cutscene` screen instead of `base`. This blocked mine entry, dome traversal, economy testing, companion flows, save verification, and streak validation across dozens of runs.

**Root Cause**: The preset loading in `src/App.svelte:134-144` is **async** (`import('./dev/presets').then(...)`) but the screen routing in `src/main.ts:165-170` is **sync** and runs first. Timeline:

1. `src/main.ts:117` — `initPlayer('teen')` loads save from localStorage (old/empty save)
2. `src/main.ts:165-167` — checks `save.tutorialComplete` on the OLD save, sets `currentScreen.set('cutscene')`
3. `src/App.svelte:135-143` — preset module finishes loading milliseconds later, calls `playerSave.set(builtSave)` and `currentScreen.set('base')` — but the cutscene component has already mounted and may not yield

**Files to change**: `src/main.ts`

**Fix**: In `src/main.ts`, before the `bootGame()` call (before line 122), check for the `devpreset` URL parameter synchronously. If present, **skip the screen routing at lines 165-170** and let the preset's async handler in App.svelte set the screen. The simplest approach:

```typescript
// At line 162, before the screen routing:
const urlParams = new URLSearchParams(window.location.search)
const hasDevPreset = import.meta.env.DEV && urlParams.get('devpreset')

if (!hasDevPreset) {
  if (!save.tutorialComplete) {
    currentScreen.set('cutscene')
  } else {
    currentScreen.set('base')
  }
}
```

This way, when a devpreset is specified, `main.ts` does NOT set the screen — it defers to App.svelte's preset handler which sets the correct screen after loading the preset save.

**Current code to change** (`src/main.ts:162-170`):
```typescript
  // BootScene has no preload, so boot completes synchronously.
  // Navigate to appropriate screen immediately.
  // Phase 14: Route through tutorial flow for new players
  if (!save.tutorialComplete) {
    // Brand new player — start the onboarding cutscene
    currentScreen.set('cutscene')
  } else {
    currentScreen.set('base')
  }
```

**Replace with**:
```typescript
  // BootScene has no preload, so boot completes synchronously.
  // Navigate to appropriate screen immediately.
  // Phase 14: Route through tutorial flow for new players
  // Skip screen routing when a dev preset is active — the preset handler in
  // App.svelte sets the correct screen after async module load completes.
  const urlParams = new URLSearchParams(window.location.search)
  const hasDevPreset = import.meta.env.DEV && urlParams.get('devpreset')
  if (!hasDevPreset) {
    if (!save.tutorialComplete) {
      currentScreen.set('cutscene')
    } else {
      currentScreen.set('base')
    }
  }
```

**Acceptance criteria**:
- `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial` lands on `base` screen (not `cutscene`)
- `http://localhost:5173?skipOnboarding=true&devpreset=rich_player` lands on `base` screen
- `http://localhost:5173?skipOnboarding=true&devpreset=many_reviews_due` lands on `base` screen
- Normal first boot (no devpreset) still shows `cutscene` for new players
- Normal returning player (no devpreset, tutorialComplete=true) still shows `base`
- `npm run typecheck` passes with 0 errors

**Status**: Fixed in current working tree (uncommitted).
**Verification**: `npm run typecheck` passed (0 errors), `npx vitest run` passed (290/290 tests).

---

## Task 2: Fix Consistency Penalty — Add `cardState` Check and Lower Threshold

**Severity**: MEDIUM — consistency penalty never fires in normal gameplay.

**Problem**: Wrong answers on mature review cards in the mine show no extra O2 drain. The penalty system exists but its guard condition is too strict and missing a cardState check.

**Root Cause**: `isConsistencyViolation()` in `src/game/managers/QuizManager.ts:196-204` checks `reviewState.repetitions >= BALANCE.CONSISTENCY_MIN_REPS` (which is 2), but:
1. It does NOT check that `cardState === 'review'` — learning/new cards should never trigger penalty
2. The threshold of 2 means a card must have been reviewed successfully twice AFTER graduating — most test cards only have `repetitions: 1` after graduation

**File to change**: `src/game/managers/QuizManager.ts`

**Current code** (lines 196-204):
```typescript
  isConsistencyViolation(factId: string, wasCorrect: boolean): boolean {
    if (wasCorrect) return false // only penalize wrong answers
    const save = get(playerSave)
    if (!save) return false
    const reviewState = save.reviewStates.find(rs => rs.factId === factId)
    if (!reviewState) return false
    // Penalize if player has answered this correctly at least CONSISTENCY_MIN_REPS times before
    return reviewState.repetitions >= BALANCE.CONSISTENCY_MIN_REPS
  }
```

**Replace with**:
```typescript
  isConsistencyViolation(factId: string, wasCorrect: boolean): boolean {
    if (wasCorrect) return false // only penalize wrong answers
    const save = get(playerSave)
    if (!save) return false
    const reviewState = save.reviewStates.find(rs => rs.factId === factId)
    if (!reviewState) return false
    // Only penalize review-state cards (not learning/new/relearning)
    if (reviewState.cardState !== 'review') return false
    // Penalize if player has answered this correctly at least CONSISTENCY_MIN_REPS times before
    return reviewState.repetitions >= BALANCE.CONSISTENCY_MIN_REPS
  }
```

**Also change**: `src/data/balance.ts` line 114 — lower the threshold from 2 to 1:

**Current**:
```typescript
  CONSISTENCY_MIN_REPS: 2,        // Only penalize facts with 2+ successful reps (actually learned)
```

**Replace with**:
```typescript
  CONSISTENCY_MIN_REPS: 1,        // Penalize facts with 1+ successful reps (graduated to review)
```

**Acceptance criteria**:
- A card with `cardState: 'review'` and `repetitions >= 1` triggers the penalty when answered wrong
- A card with `cardState: 'learning'` does NOT trigger the penalty regardless of repetitions
- A card with `cardState: 'new'` does NOT trigger the penalty
- `npm run typecheck` passes with 0 errors
- `npx vitest run` passes (all 290 tests)

**Status**: Fixed in current working tree (uncommitted).
**Verification**: `npm run typecheck` passed (0 errors), `npx vitest run` passed (290/290 tests).

---

## Task 3 (ALREADY FIXED): O2 Bar Max Resets on Layer Descent

**Status**: Fixed in commit `6d34641`.

**What was fixed**: `createOxygenState()` in `src/game/systems/OxygenSystem.ts` now accepts an optional `maxCapacity` parameter. `GameManager.ts` stores `diveMaxO2` on dive start and passes it through layer transitions so the O2 bar correctly shows `current/diveMax` instead of resetting to 100%.

**No action needed.**

---

## Task 4 (ALREADY FIXED): `deepestLayerReached` Tracked Grid Y Instead of Layer Number

**Status**: Fixed in commit `6d34641`.

**What was fixed**: `maxDepthThisRun` in `GameManager.ts` now tracks the mine layer number (updated in `handleDescentShaft()`) instead of the player's grid Y position (removed from `depth-changed` handler in `GameEventBridge.ts`).

**No action needed.**

---

## Issues NOT Bugs — Do Not Fix

The following reported issues are **environment/infrastructure noise**, not code bugs:

| Report Category | Issue | Why Not a Bug |
|---|---|---|
| Runtime | WebSocket/HMR failures, 404/500/400 responses | No backend server running during playthroughs; expected in offline dev mode |
| Runtime | CORS failures on `/api/facts/*` and `/api/analytics/*` | No API server deployed; app is designed to work offline |
| Runtime | `GPU stall due to ReadPixels` WebGL warnings | Headless browser limitation; not visible to real users |
| Mine | "blocks mined stayed at zero" across many runs | Playwright cannot interact with Phaser canvas objects (known limitation documented in CLAUDE.md); the mine works correctly via touch/mouse |
| Mine | Mine entry buttons missing | Direct consequence of Task 1 (cutscene race condition); fixing Task 1 resolves this |
| Companion/Farm | Controls not discoverable through DOM | These are Phaser canvas objects, not DOM elements; Playwright cannot click them |
| Economy | Crafting controls unreachable | Same as above — Phaser canvas, not DOM |
| Dome | "limited state variation" in traversal | Dome rooms are Phaser-rendered; DOM-only testing sees limited interaction surface |
| Save | Reloads land on cutscene | Direct consequence of Task 1; the save itself persists correctly |
| Streak/Social | Surfaces not reachable through DOM | Canvas-rendered UI; not a code bug |
| Browser | "Target page, context or browser has been closed" | Playwright/browser stability issue; not game code |
| Study | No bugs found | Study session flow confirmed working correctly |
| Mine | Pop quiz rate "too low" (4.2%) | Working as designed — 2 quizzes in 58 blocks is statistically expected with 15-block cooldown |
| Mine | Low dust per block (0.28) | Working as designed — plain terrain blocks give no dust; only mineral nodes and quiz rewards do |
| Mine | HUD text truncation on mobile | Cosmetic; CSS `text-overflow: ellipsis` on small viewport; defer to polish pass |
