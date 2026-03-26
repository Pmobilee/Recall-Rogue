# AR-242: Session 3 Playtest Fixes

> **Source:** Live playtest 2026-03-23, Session 3
> **Priority:** P0 — Visible regressions
> **Visual verification:** MANDATORY after each sub-step

---

## Issues

### 1. Charge button not aligned with non-center cards
The charge button centers perfectly for the middle card but is off for cards 0, 1, 3, 4. The `xOffset` calculation in the landscape charge button transform may not account for the card hand container's own centering offset.

### 2. Enemy clips during quiz (still)
During quiz, the Ink Slug and its HP bar clip out of the visible area. The 0.7x scale-down + reposition is not enough, OR the position target (80% of game width) pushes the enemy too far right. The HP bar text "(8) 37 / 37" appears to overflow the bar container.

### 3. Fact pool composition for new runs
User wants: 60% completely new facts, 20% in review, 5% known-not-mastered, 15% review. No fact repeated in consecutive runs (min 3 encounters before repeat). Quitting before 3 encounters doesn't count as a "run" for cooldown.

### 4. Map layout issues
Nodes too far apart, paths don't connect properly from history to choices. The dashed arrows need to visually branch FROM the previous selected node UP to the next choices. Scaling is poor.

### 5. Background not stretching to full height (again)
Combat background still doesn't reach the top of the screen for some enemies.

### 6. Enemy intent position — must be LEFT of HP bar, not on top
The intent icon (e.g., attack 6x2) sits ON TOP of the HP bar. It should be to the LEFT of the HP bar, outside the bar area.

---

## Sub-Steps

### Step 1: Fix charge button alignment for all card positions
File: `src/ui/components/CardHand.svelte`
- The charge button uses `transform: translateX(calc(-50% + {xOffset}px))` but `xOffset` is relative to the card hand container center
- The charge button may be positioned in a different parent context than the cards
- Fix: calculate the absolute screen X of the selected card center and position the charge button there
- **Visual check after:** Screenshot with card 0 and card 4 selected — charge button must be directly above each

### Step 2: Fix enemy clipping during quiz
Files: `src/game/scenes/CombatScene.ts`, `src/ui/components/CardCombatOverlay.svelte`
- Reduce enemy target X from 80% to 75% of game width during quiz
- Reduce scale from 0.7x to 0.6x if still clipping
- Ensure HP bar repositions to stay fully within the visible canvas area
- Move enemy name header, intent, and status effects to match
- **Visual check after:** Screenshot during quiz at 1920x1080 — enemy and HP bar fully visible

### Step 3: Background stretch fix
File: `src/game/scenes/CombatScene.ts`
- The `repositionAll` fix may not cover all cases — check `_swapBackground` and ensure BOTH the initial placement and resize handler set `displayWidth = canvasWidth` and `displayHeight = canvasHeight`
- Also check if the background image has `setOrigin(0.5, 0.5)` with position at center
- **Visual check after:** Screenshot with multiple enemy types — no gap at top

### Step 4: Enemy intent position — LEFT of HP bar
File: `src/game/scenes/CombatScene.ts` (Phaser) or `src/ui/components/CardCombatOverlay.svelte` (Svelte)
- The intent icon currently overlaps the HP bar from above
- Move it to the LEFT of the HP bar — position it at `hpBarLeft - intentWidth - gap`
- If intent is Svelte DOM: adjust CSS left position
- If intent is Phaser: adjust the Phaser object position
- **Visual check after:** Screenshot showing intent icon clearly to the left of HP bar, not overlapping

### Step 5: Map layout improvements
File: `src/ui/components/DungeonMap.svelte`
- Nodes need to be closer together vertically
- Paths must clearly branch FROM the previous selected node upward to choices
- Scale nodes and spacing to fit the screen better
- History section should show the selected node centered with branching paths leading up
- **Visual check after:** Screenshot of map with 2+ decisions made — clear visual path

### Step 6: Fact pool composition
File: `src/services/deckManager.ts` or `src/services/runManager.ts`
- Pool composition target: 60% new, 20% in-review, 5% known-not-mastered, 15% review
- Cross-run cooldown: facts from the last run cannot appear in the next run (min 3 encounters completed to count as a "run")
- Implementation: adjust `buildRunPool()` weights and add cross-run fact cooldown tracking

---

## Visual Testing — MANDATORY

After EACH sub-step, take screenshot via `browser_evaluate(() => window.__terraScreenshotFile())` then `Read('/tmp/terra-screenshot.jpg')` and verify the fix before moving to the next step.
