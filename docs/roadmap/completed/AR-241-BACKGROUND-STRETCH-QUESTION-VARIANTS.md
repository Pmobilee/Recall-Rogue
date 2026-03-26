# AR-241: Background Stretching & Question Variant Progression

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 20, 24
**Complexity:** Medium — Phaser scaling fix + per-fact variant tracking system
**Dependencies:** AR-229 (Question Variant Audit), AR-223 (Fact Assignment)

---

## Overview

Two distinct issues bundled here: (1) Some combat backgrounds don't fill the full screen height — all backgrounds must stretch to fill 100% of screen height at all times. (2) Question variant progression needs per-fact tracking: correct answer advances to the next variant, wrong answer stays or regresses. Also includes four design decisions codified from the session (quick play, Focus card, "Spend 4 HP" relic redesign, charge inspection registry column).

---

## User's Exact Words

> "The background (at Thesis Construct) does not fully stretch the height of the screen. Backgrounds must ALWAYS stretch completely to fill the screen."

> "I'm doing Japanese. Three times in a row for the same fact ('what does bento mean?') I get the same question format. There should be more variation. Maybe force a different variant every time the same fact is asked."

---

## Sub-Steps

### Step 1 — Fix Combat Background Full-Screen Stretch
**File:** `src/game/scenes/CombatScene.ts`

- Find where combat background images are loaded and displayed in Phaser.
- Current issue: background image does not fill the full screen height (it may be cropped or anchored incorrectly).
- Fix: after loading the background image, set it to cover the full screen:
  ```typescript
  // Scale to fill width AND height, no letterboxing
  const scaleX = this.scale.width / bg.width;
  const scaleY = this.scale.height / bg.height;
  const scale = Math.max(scaleX, scaleY); // cover, not contain
  bg.setScale(scale);
  bg.setPosition(this.scale.width / 2, this.scale.height / 2);
  bg.setOrigin(0.5, 0.5);
  ```
- Apply this to ALL background images loaded in `CombatScene`, not just "Thesis Construct."
- On resize events (`this.scale.on('resize', ...)`), reapply the scaling so it stays correct on window resize.

**Acceptance:** Screenshot shows combat background filling 100% of screen height and width. No black bars visible at top, bottom, or sides. Tested at 1920x1080 and 1280x720.

---

### Step 2 — Per-Fact Variant Tracking System
**File:** `src/services/vocabVariantService.ts`

Implement per-fact variant progression:
- Each fact in the run has a current variant index stored in run state (e.g., `RunState.factVariantIndex: Record<factId, number>`).
- **Correct answer:** advance `factVariantIndex[factId]` by 1 (wrapping around if at max variants).
- **Wrong answer:** stay at current index (do not advance). Optionally regress by 1 (minimum 0) — the design team can decide; default to "stay."
- When a fact's quiz is triggered, use `factVariantIndex[factId]` to select the variant.
- Force variant change: even if the player keeps answering correctly, the next encounter with the same fact uses the next variant. Same-variant repetition should only happen after cycling through all variants.

**Acceptance:** Same fact queried 3 times in a row with correct answers → 3 different question variants. Same fact queried with wrong answer → same variant repeated next time. Verify with a test or console log trace.

---

### Step 3 — Persist Variant Index in Run State
**File:** `src/services/vocabVariantService.ts` and run state management

- The `factVariantIndex` record must be initialized in run state at the start of each run (all facts start at index 0).
- It must persist through the full run — not reset on each combat encounter.
- It must NOT persist between runs (this is run-scoped, not persistent player state).
- Integrate with `RunState` type if not already present: add `factVariantIndex: Record<string, number>`.

**Acceptance:** Starting a new run initializes variant indices to 0. Variant index persists through multiple combat rooms in the same run. Starting a new run resets all indices to 0.

---

### Step 4 — Design Decisions: Codify in Code and Docs

These design decisions from the session must be implemented or documented:

**4a — Quick Play on Selected Card: Always Quick Play (Issue 10)**
- File: `src/ui/components/CardHand.svelte`
- Clicking a selected (risen) card again must ALWAYS trigger quick play (normal attack, no quiz, no chain).
- Charge is only triggered via: the charge button, OR swipe up gesture.
- Remove any logic that makes a second click on a selected card trigger charge.

**4b — Focus: Quick Play Only, No Charge Interaction (Issue 34)**
- File: relevant card effect handler
- The "Focus" card effect ("next card costs 1 less AP") only applies to quick play. It must not interact with charge — no bonus when charging a card after Focus is active.
- Verify this in the card effect handler. If Focus incorrectly grants AP reduction to charge, remove that interaction.

**4c — "Spend 4 HP" Relic: Mark as Needs Redesign (Issue 26)**
- File: `data/inspection-registry.json`
- The "Spend 4 HP" relic trigger is a dead mechanic — there is no standard game action that spends HP intentionally.
- Do NOT implement a fix in this AR. Instead: mark the relic as `"status": "needs_redesign"` in the inspection registry.
- Add a note: "Relic trigger condition 'spend 4 HP in a turn' has no standard trigger path — needs alternative trigger design."

**4d — Add Charge Inspection Column to Inspection Registry (Issue 35)**
- File: `data/inspection-registry.json`
- Add field `"chargeInspectionDate": "not_checked"` to all card entries in the `cards` table.
- This tracks whether each card's charge interaction has been manually verified.

**Acceptance for 4a:** Clicking selected card triggers quick play, never charge. Swipe up triggers charge.
**Acceptance for 4b:** Focus does not reduce AP cost of charged cards.
**Acceptance for 4c:** Relic marked as `needs_redesign` in registry with note.
**Acceptance for 4d:** All card entries in registry have `chargeInspectionDate` field.

---

## Files Affected

- `src/game/scenes/CombatScene.ts` — background full-screen stretch, resize handler
- `src/services/vocabVariantService.ts` — per-fact variant tracking, progression logic
- `src/ui/components/CardHand.svelte` — quick play on selected card fix (4a)
- `data/inspection-registry.json` — relic needs_redesign status (4c), chargeInspectionDate field (4d)
- Run state type definition — `factVariantIndex` field

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes
- [ ] Visual: Combat background fills full screen height — no black bars at 1920x1080
- [ ] Visual: Combat background fills full screen at 1280x720 as well
- [ ] Functional: Same fact → 3 correct answers → 3 different question variants
- [ ] Functional: Same fact → wrong answer → same variant repeated
- [ ] Functional: Clicking selected card → quick play (not charge)
- [ ] Functional: Focus does not reduce charge AP cost
- [ ] Registry: "Spend 4 HP" relic marked `needs_redesign`
- [ ] Registry: All card entries have `chargeInspectionDate` field

---

## Visual Testing — MANDATORY

```javascript
await page.evaluate(() => window.__terraScenario.load('combat-basic'));
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

Check: does the background touch all four edges? If any black bar visible at top/bottom/sides, the fix did not work.

Also test at 1280x720 by resizing the browser window before taking the screenshot.
Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
