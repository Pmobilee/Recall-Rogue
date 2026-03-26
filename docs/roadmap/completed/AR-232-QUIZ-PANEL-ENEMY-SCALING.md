# AR-232: Quiz Panel Enemy Scaling

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 6, 7
**Complexity:** Medium — dynamic sizing/layout during quiz state
**Dependencies:** AR-218 (Combat HUD), AR-221 (Quiz Panel Redesign)

---

## Overview

When the quiz panel opens, the enemy slides right but clips out of the visible combat container. The enemy sprite, HP bar, and intent icon must all scale down dynamically to fit neatly in the space to the right of the quiz panel. Nothing should clip.

---

## User's Exact Words

> "When in a quiz, the enemy moves to the right correctly, but it clips out of the container. The enemy should be visible, dynamically adjusted in size to fit neatly centered in whatever space remains to the right of the quiz popup."

> "The enemy HP bar and other elements also clip out during quiz. All enemy elements need to be scaled down dynamically to fit the available space."

---

## Sub-Steps

### Step 1 — Measure Available Space Right of Quiz Panel
**File:** `src/ui/components/CardCombatOverlay.svelte`

- Determine the quiz panel's rendered width when active (percentage of viewport or fixed calc value).
- The remaining space right of the quiz panel = `100vw - quizPanelWidth`.
- Store this as a reactive CSS variable `--enemy-quiz-zone-width` applied to the combat overlay when quiz is active.

**Acceptance:** `--enemy-quiz-zone-width` is set correctly and corresponds to the actual right-side space when quiz is visible.

---

### Step 2 — Scale Enemy Phaser Container During Quiz
**File:** `src/game/scenes/CombatScene.ts`

- When the quiz becomes active (listen for the quiz-open event/store), scale the enemy sprite container down so that its bounding width fits within the available right-side zone.
- Target scale: enemy container should fit within `(100vw - quizPanelWidth) * 0.85` — 85% of the right zone to give breathing room.
- Use Phaser's `setScale()` on the enemy container/group. Tween the scale change over ~200ms.
- Restore original scale when quiz closes.
- The enemy must remain fully visible — no clipping against the right or top edges.

**Acceptance:** During quiz, enemy sprite is visibly smaller and fully within the right portion of the screen. No clipping.

---

### Step 3 — Scale HP Bar and Intent to Match
**File:** `src/ui/components/CardCombatOverlay.svelte` and/or `src/game/scenes/CombatScene.ts`

- The enemy HP bar (Phaser drawn) and intent icon must scale/reposition in sync with the enemy sprite during quiz.
- If HP bar is a Phaser element positioned relative to the enemy, it will follow automatically if it's part of the same container. Verify this.
- If HP bar is a Svelte overlay element, add a CSS class `.quiz-active` that reduces its width and shifts it right to stay above the scaled enemy.
- Intent icon follows same logic — verify it tracks the enemy position correctly at reduced scale.

**Acceptance:** HP bar and intent icon remain visually above/near the scaled-down enemy during quiz. None clip out of the right zone.

---

### Step 4 — Center Enemy in Right Zone
**File:** `src/game/scenes/CombatScene.ts`

- During quiz, the enemy should be centered horizontally within the right zone, not just pushed to the right edge.
- Calculate center of right zone: `quizPanelWidth + (100vw - quizPanelWidth) / 2`.
- Tween enemy to this horizontal center position simultaneously with the scale-down.

**Acceptance:** Enemy is horizontally centered in the right-side zone during quiz, not flush against right edge or quiz panel edge.

---

## Files Affected

- `src/ui/components/CardCombatOverlay.svelte` — quiz-active class, HP bar/intent scaling
- `src/game/scenes/CombatScene.ts` — enemy container scale tween during quiz open/close

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Visual: Quiz panel open — enemy fully visible, not clipping
- [ ] Visual: HP bar visible above enemy during quiz
- [ ] Visual: Intent icon visible during quiz
- [ ] Visual: Enemy centered in right zone, not flush to edge
- [ ] Visual: Smooth scale transition on quiz open/close

---

## Visual Testing — MANDATORY

After implementation, load combat and trigger a quiz:
```javascript
await page.evaluate(() => window.__terraScenario.load('combat-basic'));
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
// Click a card to trigger quiz, then screenshot
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

Check: enemy fully visible on right side while quiz panel occupies left/center.
Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
