# Phase: Critical Fixes & UX Overhaul (Priority — Execute Before All Other Phases)

**Status**: Not Started
**Priority**: HIGHEST — Must be completed before ANY other V3 phase
**Estimated Complexity**: Medium-High (7-10 sub-tasks, each small-to-medium)

---

## Overview

This phase addresses critical runtime crashes, UX bugs, and missing features reported during live gameplay testing on 2026-03-04. These issues make the game unplayable or confusing in key flows. They must be fixed before continuing with visual polish, content scaling, or any other roadmap phase.

### Dependencies
- Phases 0-26 complete (current state)
- Dev server running at `http://localhost:5173`

### Error Evidence (from browser debug tools)
```
TypeError: undefined is not an object (evaluating 'camera.worldView')
  drawTiles (MineScene.ts:693 [source-mapped to ~line 825])
  redrawAll (MineScene.ts:400)
  handleMoveOrMine (MineScene.ts:1109)

TypeError: undefined is not an object (evaluating 'cam.width')
  centerCamera (DomeScene.ts:270 [source-mapped to ~line 386])
  also in HubView.svelte $effect → invoke_error_boundary
```
Plus `localhost:3001` analytics connection errors (harmless — no backend server).

---

## Sub-Tasks

### FIX-1: Mine Freezes After Quiz Answer (CRITICAL — Blocks Disappear)

**Problem**: After answering ANY quiz question in the mine, all blocks disappear, O2 bar vanishes, and the player cannot move or interact. Only the DEV button remains clickable.

**Root Cause**: `camera.worldView` is `undefined` in `MineScene.drawTiles()` at line 825. The method starts by clearing ALL graphics (`this.tileGraphics.clear()` at line 821, `this.overlayGraphics.clear()` at line 822), then tries to read `camera.worldView.width` at line 825. When `this.cameras.main` returns `undefined` or the camera's `worldView` property is `undefined` (which happens when the scene is in a transition state — being stopped/restarted, or after `scene.stop()` is called), the crash occurs AFTER the graphics were already cleared, leaving a blank screen.

**Call chain**: `handleKeyDown` → `handleMoveOrMine` → `redrawAll()` → `drawTiles()` → CRASH at `camera.worldView`

**Files to modify**:
- `src/game/scenes/MineScene.ts` — line 818-828

**Fix**:
Add a null guard at the top of `drawTiles()` before any clearing operations:
```typescript
private drawTiles(): void {
  const camera = this.cameras.main
  if (!camera || !camera.worldView) return  // ← ADD THIS GUARD FIRST

  this.itemSpritePoolIndex = 0
  this.itemSpritePool.forEach(s => s.setVisible(false))
  this.tileGraphics.clear()
  this.overlayGraphics.clear()
  // ... rest of method
}
```
The key insight: the camera guard MUST come BEFORE the `.clear()` calls. If you guard after clearing, the screen still goes blank.

Also add the same guard to `redrawAll()` (line ~400) and `handleMoveOrMine()` (line ~1109) — anywhere that accesses `this.cameras.main` should have a null check.

**Acceptance Criteria**:
- [ ] Answering a quiz question (correct or wrong) returns to normal mining
- [ ] No `camera.worldView` errors in browser console
- [ ] Mining continues normally after quiz overlay dismisses

---

### FIX-2: DomeScene Camera Crash (cam.width undefined)

**Problem**: `TypeError: undefined is not an object (evaluating 'cam.width')` in `DomeScene.centerCamera()` at line 386, and propagating to `HubView.svelte`'s `$effect` via Svelte 5's error boundary.

**Root Cause**: `this.cameras.main` returns `undefined` when the DomeScene is stopped or not fully created. The existing guard at line 389 (`if (cam.width <= 0 || cam.height <= 0) return`) only guards against zero-size cameras, NOT undefined cameras.

**Files to modify**:
- `src/game/scenes/DomeScene.ts` — line 386-389

**Fix**:
```typescript
private centerCamera(): void {
  const cam = this.cameras.main
  if (!cam) return  // ← ADD THIS
  if (cam.width <= 0 || cam.height <= 0) return
  // ... rest of method
}
```

Also audit ALL other `this.cameras.main` accesses in DomeScene.ts for the same issue. Lines to check: 260, 268, 270, 282, and anywhere in transition methods.

**Acceptance Criteria**:
- [ ] No `cam.width` errors in browser console during any screen transition
- [ ] HubView.svelte $effect does not crash when DomeScene is stopped
- [ ] Dome renders correctly when returning from mine

---

### FIX-3: Dome Floor Buttons Visible During Mining

**Problem**: The dome's floor navigation buttons are visible overlaying the mine while mining.

**Root Cause Investigation**: The Svelte routing in App.svelte uses `{:else if}` blocks, so `HubView` (which contains `FloorIndicator`) should NOT render during `$currentScreen === 'mining'`. The likely cause is:
1. The Phaser canvas is shared between DomeScene and MineScene — if DomeScene isn't properly stopped, its rendered floor buttons remain on the shared canvas
2. OR `stopDome()` at `GameManager.ts:892-896` isn't being called in all paths (e.g. when resuming a dive)

**Files to investigate**:
- `src/game/GameManager.ts` — `stopDome()` (line 892), `startDive()` (line 1067-1073), `handleDescentShaft()` (line 810-826)
- `src/game/scenes/DomeScene.ts` — check if `shutdown()` properly clears all drawn objects
- `src/App.svelte` — verify no HubView rendering during mining screen

**Fix approach**:
1. Check if `stopDome()` is called in ALL paths that lead to mining (initial dive, layer transitions, resumed dives)
2. Ensure DomeScene's `shutdown()` method clears all graphics layers
3. If it's a Phaser canvas issue, explicitly clear the DomeScene's display list on stop
4. As a defensive measure, could also add `this.scene.stop('DomeScene')` at the start of MineScene's `create()` method

**Acceptance Criteria**:
- [ ] No dome UI elements visible during mine gameplay
- [ ] Floor navigation buttons only appear on the dome/base screen

---

### FIX-4: Layer Transition Broken (Descent Shaft → Next Level Doesn't Load)

**Problem**: When going through the door (descent shaft) to the next level and clicking "Continue", the next level doesn't load. The player is stuck with nothing to do except the DEV button.

**Root Cause Investigation**: The descent shaft flow is:
1. Player steps on `BlockType.DescentShaft` → MineScene emits `'descent-shaft-entered'` event (MineScene.ts:2181-2189)
2. GameManager listens at line 600-608 → calls `handleDescentShaft()` (line 751-826)
3. `handleDescentShaft()` does: `this.game.scene.stop('MineScene')` then `this.game.scene.start('MineScene', {...})` then `currentScreen.set('mining')` (lines 811-825)

Possible failure points:
- If there's a layer quiz triggered before descent, the quiz overlay may interfere with the scene restart
- The `scene.stop()` + `scene.start()` back-to-back may have a race condition where the scene isn't fully stopped before starting
- The `currentScreen` may be set to something other than 'mining' by a competing event handler
- FIX-1's camera crash could be cascading: if `drawTiles()` crashes during the new scene's `create()`, the scene appears blank

**Files to modify**:
- `src/game/GameManager.ts` — `handleDescentShaft()` at line 751-826
- `src/game/scenes/MineScene.ts` — `create()` method, ensure it handles being restarted cleanly

**Fix approach**:
1. Fix FIX-1 first — the camera guard may resolve this entirely
2. Add logging to `handleDescentShaft()` to trace the flow
3. Ensure `scene.stop()` completes before `scene.start()` — may need a small delay or use `scene.events.once('shutdown', ...)` callback
4. Verify `currentScreen` isn't being overridden by a stale quiz handler after the layer quiz answer

**Acceptance Criteria**:
- [ ] Walking into descent shaft → quiz (if layer quiz) → answer → new layer loads and is playable
- [ ] Mining continues normally on the new layer
- [ ] Layer counter in HUD increments

---

### FIX-5: Quiz Shows Raw Code in Fact Display

**Problem**: When answering a fact question, the result area shows raw code/markup in the "blue/red part" (the correct/wrong answer feedback section).

**Root Cause**: The `resultText` in `QuizOverlay.svelte` (line 60-65) uses `$derived()` with a function that returns a string. In Svelte 5, `$derived()` returns the function itself, while `$derived.by()` invokes it. Check whether `resultText` is being used as `{resultText}` (renders the function reference as code) vs `{resultText()}` (calls it).

At line 60: `const resultText = $derived(() => {...})` — this creates a derived value that IS a function. But at line 254: `<p class={...}>{resultText}</p>` — this renders the function's `.toString()`, which is the raw code.

**Files to modify**:
- `src/ui/components/QuizOverlay.svelte` — line 60 and line 67 and line 73

**Fix**: Change from `$derived()` to `$derived.by()`:
```typescript
// BEFORE (wrong — $derived returns the function itself):
const resultText = $derived(() => { ... })
const resultClass = $derived(() => { ... })
const cardOutcomeClass = $derived(() => { ... })

// AFTER (correct — $derived.by() evaluates the function):
const resultText = $derived.by(() => { ... })
const resultClass = $derived.by(() => { ... })
const cardOutcomeClass = $derived.by(() => { ... })
```

NOTE: Check that `resultText`, `resultClass`, and `cardOutcomeClass` are used in the template WITHOUT `()` — they should be just `{resultText}`, `{resultClass}`, `{cardOutcomeClass()}` depending on whether they're `$derived` or `$derived.by`. Audit all three for consistency. If they're already `$derived.by()`, then the issue is somewhere else — check the `fact` object fields for HTML/code content.

**Acceptance Criteria**:
- [ ] Correct answer shows "That's it!" / "Nailed it!" / "Locked in!" (not function code)
- [ ] Wrong answer shows "Not quite!" / "Hmm, let me remind you..." (not function code)
- [ ] The result area colors (green/red) display correctly

---

### FIX-6: Wrong Answer Must Wait for Tap Before Dismissing

**Problem**: When a fact is answered wrongly, the quiz overlay auto-dismisses after 1 second. This doesn't give the player enough time to read the correct answer, mnemonics, memory tip, and GAIA's explanation. The player should have to TAP/CLICK to continue.

**Current behavior** (QuizOverlay.svelte line 133-167):
```typescript
async function handleAnswer(answer: string): Promise<void> {
  showResult = true
  await new Promise(resolve => setTimeout(resolve, 1000))  // ← 1s auto-dismiss
  if (isCorrect) { onAnswer(true); return }
  // Wrong answer cases also call onAnswer(false) immediately
}
```

**Desired behavior**:
- **Correct answer**: Auto-dismiss after 1s is fine (the player already knows the answer)
- **Wrong answer**: Show the result (correct answer highlighted, memory tip, GAIA reaction) and wait for the player to TAP a "Continue" or "Got it" button before dismissing

**Files to modify**:
- `src/ui/components/QuizOverlay.svelte` — `handleAnswer()` function (line 133-172) and template (line 253-301)

**Fix approach**:
1. Add a `waitingForTap` state variable
2. For wrong answers, after showing the result, set `waitingForTap = true` instead of calling `onAnswer(false)`
3. Add a "Continue" / "Got it" button that only appears when `waitingForTap && !isCorrect`
4. When that button is tapped, call `onAnswer(false)` and dismiss
5. For correct answers, keep the existing 1s auto-dismiss behavior

**Acceptance Criteria**:
- [ ] Wrong answer shows result and waits indefinitely for player tap
- [ ] "Continue" or "Got it" button appears below the result for wrong answers
- [ ] Player can read correct answer, memory tip, and GAIA explanation before dismissal
- [ ] Correct answers still auto-dismiss after ~1s
- [ ] The three-button study response (Easy/Got it/Didn't) still works for review mode

---

### FIX-7: Triple Age Group Selection on First Launch

**Problem**: When starting the game for the first time, the player sees the age group selection THREE times before reaching the main game.

**Root Cause**: There are 3 separate age-related screens in the onboarding flow:
1. **AgeGate** (legal compliance, `src/ui/components/legal/AgeGate.svelte`) — shown at App.svelte line 585-586 when `showAgeGate` is true (localStorage `terra_age_bracket` is null)
2. **ProfileCreateView** (`src/ui/components/profiles/ProfileCreateView.svelte`) — has its own age group selection (18+/Teen/Kid) as part of profile creation
3. **AgeSelection** (`src/ui/components/AgeSelection.svelte`) — shown at App.svelte line 653-654 when `currentScreen === 'ageSelection'`, triggered after GaiaIntro completes (line 281)

So a new player sees: AgeGate → ProfileCreate (with age) → GaiaIntro → AgeSelection = 3 age asks.

**Files to modify**:
- `src/App.svelte` — onboarding flow routing (lines 270-292)
- `src/ui/components/profiles/ProfileCreateView.svelte` — remove age selection or make it use the stored bracket
- `src/ui/components/AgeSelection.svelte` — may need to be removed entirely or repurposed

**Fix approach**:
1. Keep ONLY the AgeGate (it's the legally required one)
2. Remove the age selection from ProfileCreateView — use the AgeGate result instead
3. Remove or skip AgeSelection screen entirely — the age bracket from AgeGate should be used for content filtering
4. In `handleGaiaIntroComplete()`, skip directly to `'mainMenu'` instead of `'ageSelection'`

**Acceptance Criteria**:
- [ ] New player sees age gate ONCE (the legal AgeGate)
- [ ] Age bracket persists and is used for content filtering
- [ ] No redundant age selection in profile creation or onboarding
- [ ] Onboarding flow: AgeGate → Profile → Auth/Guest → Cutscene → GaiaIntro → Main Menu

---

### FIX-8: Language Learning Selection in Onboarding

**Problem**: The onboarding doesn't offer a "Logopedist" (language learner) option. When starting out, the player should be able to select that they want to learn a language. The selection flow should be:

1. During GaiaIntro interest selection, add a "Linguist" / "Language Learner" pill option
2. If "Linguist" is selected → show a language picker (currently only Japanese, more later)
3. If "Linguist" is NOT selected → show a popup: "Would you also like to learn a language?" with Yes/No
4. If Yes → show language picker
5. If No → continue without language learning
6. Selecting "General" knowledge should NOT force a language selection
7. Language learning can be combined with other interest types

**Files to modify/create**:
- `src/ui/components/GaiaIntro.svelte` — add Linguist pill, language popup, language picker
- `src/ui/components/InterestAssessment.svelte` — may need similar updates
- `src/data/types.ts` — add language-related types if not present
- `src/ui/stores/playerData.ts` — persist selected language

**Implementation notes**:
- The existing Phase 24 (Language Learning) has detailed specs, but the ONBOARDING selection needs to work NOW
- Available languages: Japanese only for now (add `['ja']` array, extensible later)
- Store the selected language in PlayerSave (e.g., `targetLanguage: string | null`)
- This affects which facts are unlocked/shown — language vocab facts only appear if a language is selected

**Acceptance Criteria**:
- [ ] "Linguist" / "Language Learner" option appears in interest selection
- [ ] Selecting it shows a language picker
- [ ] NOT selecting it shows a "Would you also like to learn a language?" prompt
- [ ] "General" interest does not force language selection
- [ ] Selected language is persisted in PlayerSave
- [ ] Only Japanese available for now, with UI ready for more languages

---

### FIX-9: Fact Unlocking & Discovery Pacing System

**Problem**: How do we control which facts the player encounters? Current system may overwhelm the player with too many NEW facts without enough review of learned ones.

**Design Requirements**:
1. **Base set**: Unlock a starting set of ~25 facts when the player begins
2. **Scaling unlock**: New facts are unlocked based on how many facts the player has LEARNED (mastered to some degree), not just encountered
3. **Non-duplicate priority**: The system should prefer showing facts the player has already seen but needs to review (SM-2 scheduled reviews) over constantly showing brand new facts
4. **Rate limiting**: Cap new fact discovery rate — e.g., max 3-5 new facts per dive session
5. **Category balance**: New facts should respect the player's interest weights
6. **Never overwhelm**: If the player has >10 facts at low mastery (repetitions ≤ 1), slow down new fact introduction to nearly zero until they catch up

**Files to modify**:
- `src/services/factsDB.ts` — add methods for paced fact selection
- `src/game/GameManager.ts` — integrate paced selection into quiz fact picking (`getInterestWeightedFact()` at line 839)
- `src/game/managers/QuizManager.ts` — use paced selection when picking facts for quizzes
- `src/ui/stores/playerData.ts` — track `unlockedFactIds` in PlayerSave

**Implementation approach**:
1. Add `unlockedFactIds: string[]` to PlayerSave (initially populated with 25 starter facts)
2. Create `FactPacingService` that:
   - Returns review-due facts first (SM-2 scheduled)
   - Introduces new facts only when review queue is manageable (<10 at low mastery)
   - Caps new facts at 3-5 per dive
   - Respects interest weights for new fact selection
3. Integrate into `getInterestWeightedFact()` in GameManager.ts
4. On each dive return, potentially unlock 2-5 new facts based on mastery progress

**Acceptance Criteria**:
- [ ] New players start with ~25 unlocked facts
- [ ] Review-due facts are prioritized over new facts
- [ ] New fact discovery is capped per dive session
- [ ] Players with many unmastered facts see fewer new facts
- [ ] Fact pacing respects interest category weights

---

### FIX-10: Dedicated Settings Menu in Dome

**Problem**: There's no accessible settings menu for the player. Need a settings screen accessible from the dome (via a "toolbench" or similar interactable object).

**Current state**: There IS a `Settings.svelte` component and an `onSettings` prop on HubView, but it may not be accessible from the dome UI.

**Design Requirements**:
1. Add a settings item/object in the dome that's available from the start (e.g., a toolbench, control panel, or gear icon)
2. Clicking it opens the Settings panel
3. Current settings: audio controls (SFX, Music, Ambient, UI volume sliders)
4. Future settings (implement stubs/sections now, mark as "Coming Soon"):
   - Language selection (change target language)
   - Toggle language learning on/off (hides vocab facts, does NOT delete them)
   - Toggle fact learning on/off
   - Switch languages (pauses occurrence of current vocab, enables new language)
   - Content filtering (age bracket)
   - Notification preferences
   - Account/profile management

**Files to modify**:
- `src/ui/components/HubView.svelte` — ensure settings button is visible and accessible
- `src/ui/components/Settings.svelte` — add "Coming Soon" stubs for future settings
- `src/game/scenes/DomeScene.ts` — optionally add a toolbench sprite that triggers settings
- `src/data/hubLayout.ts` — add settings object to floor 0 if needed

**Acceptance Criteria**:
- [ ] Settings accessible from dome via a clear UI element
- [ ] Audio settings functional (volume sliders work)
- [ ] "Coming Soon" sections visible for language, content filtering, notifications
- [ ] Settings changes persist across sessions

---

## Debug Logging Cleanup

**Note**: There is debug logging (`[QM]` and `[App]` tags) added to `QuizManager.ts` and `App.svelte` during the investigation of the quiz answer bug. After FIX-1 and FIX-4 are verified working, **remove all `console.warn('[QM]...')` and `console.warn('[App]...')` debug logging** from:
- `src/game/managers/QuizManager.ts` — all `[QM]` prefixed console.warn calls
- `src/App.svelte` — all `[App]` prefixed console.warn calls in `handleQuizAnswer()`

---

## Analytics Errors (Non-Issue)

The `localhost:3001` connection errors in the console are from the analytics service trying to reach a backend that doesn't exist yet. These are harmless and expected — no fix needed. They will resolve when Phase 26 (Production Backend) is deployed.

---

## Verification Gate

Before marking this phase complete, ALL of the following must pass:

1. **Typecheck**: `npm run typecheck` — zero errors
2. **Build**: `npm run build` — succeeds
3. **Playwright screenshots**: Take screenshots at each step:
   - Fresh launch → single age gate → profile → guest → cutscene → GaiaIntro (with Linguist pill) → main menu
   - Dive prep → enter mine → mine 20+ blocks → quiz appears → answer wrong → wait for tap → continue mining
   - Answer correct → auto-dismiss → continue mining
   - Reach descent shaft → layer quiz → next layer loads and is playable
   - Return to dome → no floor buttons during mine → floor buttons visible in dome
   - Settings accessible from dome
4. **No console errors**: No `camera.worldView`, `cam.width`, or rendering errors in browser console during full gameplay loop
5. **Review pacing**: New facts appear at reasonable rate, review-due facts are prioritized

---

## Execution Order

**Recommended order for the worker**:
1. FIX-1 (camera crash) — fixes the CRITICAL mine freeze, may also fix FIX-4
2. FIX-2 (dome camera crash) — quick fix, prevents cascading errors
3. FIX-5 (raw code in quiz) — likely a one-line `$derived` → `$derived.by` fix
4. FIX-6 (wrong answer tap-to-continue) — small UX change in QuizOverlay
5. FIX-3 (dome buttons during mine) — investigate and fix canvas/scene overlap
6. FIX-4 (layer transition) — test after FIX-1, may already be resolved
7. FIX-7 (triple age gate) — simplify onboarding flow
8. FIX-10 (settings menu) — add dome settings access
9. FIX-8 (language selection) — onboarding addition
10. FIX-9 (fact pacing) — new system, most complex
11. Debug logging cleanup — after all fixes verified

---

## Files Affected (Summary)

| File | Fixes |
|------|-------|
| `src/game/scenes/MineScene.ts` | FIX-1 (camera guard) |
| `src/game/scenes/DomeScene.ts` | FIX-2 (camera guard), FIX-3 (scene cleanup) |
| `src/ui/components/QuizOverlay.svelte` | FIX-5 (derived), FIX-6 (tap to continue) |
| `src/game/GameManager.ts` | FIX-3 (stopDome paths), FIX-4 (descent shaft), FIX-9 (fact pacing) |
| `src/game/managers/QuizManager.ts` | Debug cleanup |
| `src/App.svelte` | FIX-7 (age flow), Debug cleanup |
| `src/ui/components/profiles/ProfileCreateView.svelte` | FIX-7 (remove age) |
| `src/ui/components/AgeSelection.svelte` | FIX-7 (remove/skip) |
| `src/ui/components/GaiaIntro.svelte` | FIX-8 (linguist pill, language popup) |
| `src/ui/components/HubView.svelte` | FIX-10 (settings access) |
| `src/ui/components/Settings.svelte` | FIX-10 (future stubs) |
| `src/services/factsDB.ts` | FIX-9 (paced selection) |
| `src/ui/stores/playerData.ts` | FIX-8 (language), FIX-9 (unlocked facts) |
| `src/data/types.ts` | FIX-8 (language types), FIX-9 (pacing types) |
