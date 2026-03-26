# AR-240: Post-Boss & Descent Screen Fixes

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 39, 40, 41, 42
**Complexity:** Medium — game flow, state persistence, text fixes
**Dependencies:** AR-226 (Mystery Room Overhaul), AR-227 (Screen Transitions)

---

## Overview

Four post-boss and descent issues: (1) Post-boss mystery event click did nothing — transition broken. (2) Descent screen has stale "time is shorter" text that must be removed. (3) Descent screen references wrong boss name ("Magma Worm" hardcoded instead of actual defeated boss). (4) Retreat screen says "keep all 187 dust" but dust doesn't persist — collection on retreat is broken.

---

## User's Exact Words

> "After defeating the boss, there was a mystery event that said something but clicking it did nothing — just went to the descent screen. Post-boss mystery events seem broken."

> "'Delve deeper' screen says 'time is shorter' — remove the 'time is shorter' part."

> "The descent screen says I defeated the Magma Worm but I defeated a completely different boss. Fix the text to reference the actual boss defeated."

> "'Retreat — keep all 187 dust' but the dust indicator on campsite shows no changes, still zero. Dust collection on retreat doesn't seem to persist."

---

## Sub-Steps

### Step 1 — Fix Post-Boss Mystery Event Interaction
**Files:** `src/ui/components/MysteryEventOverlay.svelte`, `src/services/gameFlowController.ts`

- Locate the post-boss mystery event flow. After boss defeat, a mystery event is triggered. Clicking the event option currently does nothing.
- Trace the click handler: does it call `gameFlowController.advanceFromMysteryEvent()`? Is the event system properly initialized in post-boss context?
- Check if the mystery event overlay is rendering in a state where click events are blocked (z-index, pointer-events: none, or a covering div).
- Fix the click handler so choosing a mystery event option: (a) applies the event effect, (b) transitions to the descent screen correctly.

**Acceptance:** After boss defeat, clicking the mystery event option applies the event effect (visible in game state) and transitions to the descent screen.

---

### Step 2 — Remove "Time Is Shorter" from Descent Screen
**File:** `src/ui/components/RetreatOrDelve.svelte`

- Find the text "time is shorter" (or similar phrasing) in the descent/delve deeper screen.
- Remove it entirely. Do not replace with anything.
- If it's conditionally rendered, remove the condition and the element.

**Acceptance:** Descent screen no longer contains "time is shorter" text. Screenshot confirms removal.

---

### Step 3 — Fix Boss Name Reference on Descent Screen
**File:** `src/ui/components/RetreatOrDelve.svelte`

- The descent screen hardcodes "Magma Worm" instead of showing the actual defeated boss name.
- Find the string interpolation or static text that references the boss name.
- Replace with the actual boss name from game state: the defeated boss's name should be stored in run state after combat ends.
- Check `src/services/gameFlowController.ts` or run state for where `defeatedBossName` or similar is stored after boss victory.
- If not stored, add it: when boss combat ends in victory, store `runState.lastDefeatedBossName = enemy.name`.
- Use the stored name in the descent screen text.

**Acceptance:** Descent screen shows the name of the boss that was actually defeated in the run. Not "Magma Worm" (unless that was actually the boss fought).

---

### Step 4 — Fix Dust Collection on Retreat
**Files:** `src/ui/components/RetreatOrDelve.svelte`, `src/services/gameFlowController.ts`, `src/services/floorManager.ts`

- The retreat screen correctly displays the dust amount ("keep all 187 dust") but the dust is not persisted to the player's persistent state when retreat is confirmed.
- Trace the retreat confirmation handler: it should call something like `playerStateService.addDust(runState.dustEarned)` or `persistentState.dust += run.dust`.
- Find where this call is missing or failing and add/fix it.
- After retreat is confirmed and the player returns to the hub/campsite, the dust indicator must reflect the added dust.
- Add a console.log to trace: `console.log('[Retreat] adding dust:', dustAmount, 'total after:', newTotal)`.

**Acceptance:** After retreating with 187 dust, the hub/campsite dust indicator shows 187 more than before. The dust persists across restart (saved to persistent state, not just in-memory run state).

---

### Step 5 — Remove Temporary Logs
**Files:** Any files from Step 1 and Step 4

- Remove console.logs added for debugging.

**Acceptance:** No debug logs in production code.

---

## Files Affected

- `src/ui/components/RetreatOrDelve.svelte` — "time is shorter" removal, boss name fix, dust display
- `src/ui/components/MysteryEventOverlay.svelte` — post-boss mystery click handler
- `src/services/gameFlowController.ts` — post-boss mystery transition, retreat dust persistence, boss name storage
- `src/services/floorManager.ts` — retreat dust collection (if handled here)

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Functional: Post-boss mystery event click → effect applied → descent screen shown
- [ ] Visual: Descent screen — "time is shorter" text removed
- [ ] Functional: Descent screen shows correct defeated boss name
- [ ] Functional: Retreating with dust → dust appears in hub/campsite indicator post-retreat
- [ ] No debug console.logs remaining

---

## Visual Testing — MANDATORY

```javascript
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

Navigate to the descent screen (via game flow or scenario). Screenshot and confirm:
1. "Time is shorter" gone
2. Boss name is dynamic (not "Magma Worm" unless that's the real boss)

For retreat dust: check persistent state before and after retreat via `window.__terraDebug()`.
Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
