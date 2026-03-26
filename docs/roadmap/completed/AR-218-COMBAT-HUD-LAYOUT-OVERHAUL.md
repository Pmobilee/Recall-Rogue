# AR-218: Combat HUD Layout Overhaul

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #20, #28, #46
> **Priority:** P0 — Foundation for all other combat UI ARs
> **Complexity:** Large (14 discrete layout changes + architecture clarifications)
> **Dependencies:** None (this is the foundation)

---

## Overview

Complete overhaul of the combat HUD layout in landscape mode. The current layout has numerous issues: misplaced elements, wrong sizes, ugly styling, and redundant text. This AR restructures the entire combat HUD to feel polished and game-ready for Steam PC at 1920x1080.

The combat UI is a **hybrid Phaser canvas + Svelte DOM system**. Workers must understand this before touching anything:
- **Phaser canvas (CombatScene.ts):** Enemy HP bar, enemy block text, enemy intent bubble. Playwright cannot click Phaser objects directly.
- **Svelte DOM overlay (CardCombatOverlay.svelte):** Everything else — player HP bar, card hand, chain counter (landscape variant), AP sphere, draw/discard piles, end turn button, status effects, card info tooltip.

---

## User's Exact Words

- **#6:** "The end turn button has a 0 in it for some reason, dunno if this is the chain counter, but if not, we dont need this."
- **#7:** "We need a nice and clear Chain: to the right of our hand, in the middle of the card row, IF we have any chain, and must have nice black border and must be in the color of that chain!"
- **#8:** "Make the cards just 15% larger."
- **#9:** "The end turn button, put it stuck to the bottom left."
- **#10:** "The draw pile and discard pile can be twice as big."
- **#11:** "Underneath the draw pile as I can see it says Deck: 100, dunno what this is but remove it."
- **#12:** "The HP bar is enveloped in this horrible black bar, remove the black bar, center our hp bar. Make our hp green or red or orange based on hp percentage left, and make it blue only if we have ANY block!"
- **#13:** "The HP bar must be centered, and be BELOW the cards, meaning we must move up the cards."
- **#14:** "The AP sphere needs to be twice as big, and moved to about 15% of the screen to the right."
- **#15:** "We must no longer say BLOCK: 0, if there IS any block, just show the dimmed block icon we have, larger, with a number in it indicating block, stuck to the left of our hp bar, not moving the hp bar."
- **#16:** "The text of the number of cards in draw and discard also needs to match increase in size."
- **#20:** "When hovering over a card it says in the middle of the screen underneath the cards stuff like block 1 ap crimson. Have this instead show slightly above the end turn button, stuck to the left of the screen and slightly above the end turn button."
- **#28:** "For our own effects applied, they can be above our own hp bar, meaning the cards will go even a bit higher, not too much though, our icons can be a little bit smaller, or not the icons, but the boxes/containers around our icons."
- **#46:** "NO MORE BLOCK ICONS, just show (6) in front of our first number in the healthbar, or the healthbar of the enemy, if they have block."

---

## Sub-Steps

### 1. End Turn Button — Investigate "0", Remove It, Relocate to Bottom-Left

**File:** `src/ui/components/CardCombatOverlay.svelte` (~lines 2005-2018)

- **BEFORE CHANGING ANYTHING:** Take a Playwright screenshot (`browser_evaluate(() => window.__terraScreenshotFile())`, then `Read('/tmp/terra-screenshot.jpg')`) to confirm what the "0" actually is. The end turn button text in code is just "END TURN" — no "0" is present in the button markup itself. The "0" the user sees is most likely the `ap-orb` displaying `{apCurrent}` when AP is 0, OR the `lsb-chain-indicator` showing "0" when chain is empty. Do NOT remove anything until the screenshot makes it clear what element this is.
- Once identified: if it is the AP orb or chain indicator, suppress display when value is 0 (conditional render or `display: none`), do not remove any functional element.
- Move the end turn button from its current position to bottom-left corner, fixed position, with `calc(16px * var(--layout-scale, 1))` padding from left and bottom edges.
- **Acceptance:** End turn button is at bottom-left, no spurious "0" visible near it, button functions correctly.

### 2. Chain Display — Relocate to Right of Card Hand (Landscape)

**File:** `src/ui/components/CardCombatOverlay.svelte` — `lsb-chain-indicator` inside `landscape-arena-right-col`

- In **landscape** mode the chain display is the inline `lsb-chain-indicator` element inside the stats bar, NOT `ChainCounter.svelte` (that component is for portrait mode only).
- Extract `lsb-chain-indicator` from its current position inside `landscape-stats-bar` and reposition it to appear to the RIGHT of the card hand row, vertically centered with the cards.
- Style: bold black border (`calc(2px * var(--layout-scale, 1))` solid black), text colored by chain type using the existing `getChainColor()` helper. Format: "Chain: X.x" (e.g., "Chain: 1.7").
- Visibility: only render when chain length >= 2 (existing behavior — keep it).
- **Acceptance:** Chain display appears to the right of the rightmost card when active, colored by chain type, with black border. Hidden when no chain. `ChainCounter.svelte` is untouched.

### 3. Cards — 15% Larger

**File:** `src/ui/components/CardHand.svelte`

- Locate the card width and height values and multiply by 1.15. Ensure values remain in `calc(Npx * var(--layout-scale, 1))` form — do NOT introduce hardcoded px.
- Verify no overflow, clipping, or text readability issues after the resize.
- **Acceptance:** Cards are visibly larger (15%). No overflow. Card text still readable at 1920x1080.

### 4. Draw Pile & Discard Pile — Twice as Big

**File:** `src/ui/components/CardCombatOverlay.svelte` (~lines 1805-1836)

- Current pile icon dimensions are approximately 36px x 46px, with card stacks at 26px x 36px. Double all of these values, keeping them in `calc(Npx * var(--layout-scale, 1))` form.
- Current positioning is at `bottom: calc(27vh + 36px + 8px)`. After doubling, verify the enlarged icons do not overlap the stats bar below or the card hand above. Adjust the `bottom` offset if needed — document what you changed and why.
- **Acceptance:** Draw and discard pile icons are 2x their previous size. No overlap with stats bar or card hand. Correctly positioned.

### 5. Remove "Deck: 100" Label

**File:** `src/ui/components/CardCombatOverlay.svelte` (line ~1812)

- Remove the element: `<span class="deck-total-label">Deck: {drawPileCount + discardPileCount + handCards.length}</span>`
- Also remove its associated CSS rule(s) for `.deck-total-label`.
- **Acceptance:** No "Deck: X" text visible anywhere on the combat screen. No dead CSS left behind.

### 6. Draw/Discard Card Count Text — Match Size Increase

**File:** `src/ui/components/CardCombatOverlay.svelte` (~lines 1805-1836)

- The card count numbers displayed on the draw and discard pile icons must scale proportionally with the 2x pile size increase from sub-step 4. If currently `calc(14px * var(--layout-scale, 1))`, make it `calc(28px * var(--layout-scale, 1))`, etc.
- **Acceptance:** Card count text is proportionally larger and clearly readable at 1920x1080.

### 7. Player HP Bar — Remove Black Bar Container

**File:** `src/ui/components/CardCombatOverlay.svelte` — `landscape-stats-bar` CSS (~lines 3334-3336 for borders, and the background rule)

- The `landscape-stats-bar` element has `background: rgba(10, 10, 26, 0.88)` and top/bottom border lines that create the black bar appearance.
- Remove or make the background fully transparent (`background: transparent`). Remove the border lines. The HP bar itself should float cleanly without a container.
- Note: sub-steps 7, 8, 9, 10, 11, and 13 all touch the `landscape-stats-bar` CSS section — assign ALL of these sub-steps to a single worker to avoid merge conflicts.
- **Acceptance:** Player HP bar has no surrounding black container or bar. Floats cleanly against the game background.

### 8. Player HP Bar — Color by HP Percentage (with Block Override)

**File:** `src/ui/components/CardCombatOverlay.svelte` — `playerHpColor` derived (~lines 604-606), `.lsb-hp-fill` and `.player-hp-fill` CSS

- The current `playerHpColor` derived uses: blue at >50%, orange at >25%, red below. This convention must change.
- New color logic:
  - `playerShield > 0` → blue (overrides all other states; block takes priority)
  - HP >= 60% → green
  - HP 30-59% → orange
  - HP < 30% → red
- Apply this to both the portrait `player-hp-fill` and landscape `lsb-hp-fill` fill elements (they share the same derived).
- Also check `CombatScene.ts` line ~112 for `playerHpColor()` — if it exists and controls any Phaser-rendered player HP element, update it to match the same logic. (Note: if `USE_OVERLAY_PLAYER_HUD = true`, the Phaser player HP bar may be hidden and irrelevant — confirm before editing.)
- **Acceptance:** HP bar is green at high health, orange at mid, red when critical, blue when any block exists. Blue correctly overrides other states.

### 9. Player HP Bar — Center Below Cards, Cards Move Up

**File:** `src/ui/components/CardCombatOverlay.svelte` — `landscape-stats-bar` positioning and card hand vertical positioning

- Reposition the HP bar to be horizontally centered below the card hand area.
- Move the card hand up (increase its `bottom` offset or reduce `top` margin) to make room for the HP bar below.
- Final vertical order from bottom to top: HP bar → cards → (status effects above HP bar, per sub-step 13).
- This sub-step is closely coupled with sub-steps 7, 10, 11, and 13 — assign to same worker.
- **Acceptance:** HP bar is centered horizontally. It appears below the card hand. Cards are positioned higher than before.

### 10. AP Sphere — Twice as Big, Repositioned as Standalone Element

**File:** `src/ui/components/CardCombatOverlay.svelte` — `lsb-ap-circle` (~28px in `landscape-stats-bar` flex layout)

- In landscape mode the AP circle (`lsb-ap-circle`, currently ~28px) is embedded inside the `landscape-stats-bar` flex layout, not a standalone element.
- To achieve 2x size AND position at ~15% from left: **extract** `lsb-ap-circle` from the stats bar flex into a standalone `position: fixed` (or `position: absolute` relative to the overlay root) element.
- Size: `calc(56px * var(--layout-scale, 1))` diameter (2x of ~28px).
- Position: `left: 15%; bottom: calc(Npx * var(--layout-scale, 1))` — set bottom to align near the HP bar row. Adjust N by visual inspection.
- All sizing values must use `calc(Npx * var(--layout-scale, 1))` — zero hardcoded px.
- **Acceptance:** AP sphere is 2x its previous size. Positioned at approximately 15% from left edge of screen. Does not overlap end turn button or other elements.

### 11. Block Display — Inline HP Text, No Icon

**Files:**
- `src/ui/components/CardCombatOverlay.svelte` — `lsb-block` (player block in landscape), `class:lsb-block-zero` logic
- `src/game/scenes/CombatScene.ts` — `refreshEnemyHpBar()` (~line 1864) and `refreshEnemyBlockBar()` (~line 1886), `enemyBlockIcon` and `enemyBlockText` Phaser objects

**Player block (Svelte):**
- Remove the `lsb-block` shield icon element entirely from the layout.
- The `lsb-block-zero` class currently dims to `opacity: 0.35` when shield is 0 — instead, conditionally render the block element only when `playerShield > 0` using `{#if playerShield > 0}`.
- In the HP bar text, change the display from "85/100" to "(6) 85/100" when `playerShield > 0`, and "85/100" when `playerShield === 0`. The "(N)" prefix uses `playerShield` value. Ensure the "(N)" prefix is placed inside the HP bar text element without shifting the bar's layout.

**Enemy block (Phaser):**
- In `CombatScene.ts`, `refreshEnemyHpBar()` and `refreshEnemyBlockBar()`: remove rendering of `enemyBlockIcon` (shield sprite if any) and `enemyBlockText` as a separate UI element.
- Instead, prepend "(N) " to the enemy HP bar label text when enemy block > 0. When block is 0, omit the prefix.
- All Phaser text changes must use the existing Phaser text style — do not introduce new fonts or colors for this element.
- **Acceptance:** No block icon or "Block: X" label anywhere on screen for player or enemy. When block > 0 for either entity, block value appears as "(N)" prefix before HP numbers. When block = 0, nothing extra is shown.

### 12. Card Hover Info — Relocate Above End Turn Button

**File:** `src/ui/components/CardCombatOverlay.svelte` — `enemy-hover-zone` tooltip or `intent-bubble-detail` (~lines 2103-2135)

- **BEFORE CHANGING ANYTHING:** Take a Playwright screenshot with a card hovered (or use `browser_evaluate` to force the hover state) to confirm exactly which element shows the info the user sees ("block 1 ap crimson"). There is no dedicated card info tooltip component file — the relevant element is inline in `CardCombatOverlay.svelte`. It may be the `enemy-hover-zone` tooltip or the `intent-bubble-detail` for enemy intent.
- Once identified: change its CSS positioning from its current mid-screen location to `position: fixed; left: calc(16px * var(--layout-scale, 1)); bottom: calc(Npx * var(--layout-scale, 1))` where N places it slightly above the end turn button. Determine N by measuring the end turn button's height plus a small gap.
- **Acceptance:** Card hover info appears near bottom-left, above the end turn button. Not in the middle of the screen.

### 13. Player Status Effects — Above HP Bar, Smaller Containers

**File:** `src/ui/components/CardCombatOverlay.svelte` — CSS rule `:global(.layout-landscape .status-effect-bar-player)` and related

- Status effect positioning for landscape mode is controlled by CSS in `CardCombatOverlay.svelte` via `:global()` rules targeting `.status-effect-bar-player`, NOT inside `StatusEffectBar.svelte` itself. Do not edit `StatusEffectBar.svelte` for positioning.
- Move the status effect bar to be directly above the player HP bar (which has moved per sub-step 9). Update the `bottom` value accordingly.
- Reduce the padding/margin of the icon container boxes so the containers are smaller. The icons inside them may remain the same size — only the surrounding box shrinks.
- Move cards up slightly further to accommodate status effects above the HP bar (coordinate with sub-step 9).
- **Acceptance:** Status effects are visible above the HP bar. Containers are smaller. Cards shifted up. No overlap between status effects, HP bar, and cards.

---

## Layout Diagram (Landscape 1920x1080)

```
+------------------------------------------------------------------+
|  [Enemy Title + Turn]              [Enemy HP Bar (N) X/Y]        |
|                    [Enemy Status Effects - UNDER HP bar]          |
|                                                                   |
|                        [Enemy Sprite]                             |
|                                                                   |
|                                                                   |
|  [Draw]                                              [Discard]   |
|   (5)            [Card] [Card] [Card] [Card] [Card]     (3)     |
|                                           [Chain: 1.7 - colored] |
|           [Player Status Effects]                                 |
|  [AP]     [(6) 85/100 HP bar — centered, no black bar]          |
|  (56px)                                                           |
|  [END]    [Card Info tooltip - above END TURN, left-aligned]     |
|  [TURN]                                                           |
+------------------------------------------------------------------+
```

**Key positions:**
- End turn: bottom-left corner
- AP sphere: ~15% from left, near bottom, standalone (not inside stats bar)
- Draw pile: left side, middle-bottom area (2x size)
- Discard pile: right side, middle-bottom area (2x size)
- Cards: centered, raised higher than current
- Status effects: above HP bar
- HP bar: centered, below cards, no black container
- Chain display: right of card hand (landscape `lsb-chain-indicator`, not ChainCounter.svelte)
- Card info: above end turn button, left-aligned

---

## Files Affected

- `src/ui/components/CardCombatOverlay.svelte` — **primary file for almost all changes**: end turn button (lines ~2005-2018), `landscape-stats-bar` (lines ~2062-2088 and CSS ~3334-3336), pile indicators (lines ~1805-1836), deck total label (line ~1812), AP circle (`lsb-ap-circle`), chain indicator (`lsb-chain-indicator`), block display (`lsb-block`), player HP color derived (lines ~604-606), status effect CSS (`:global(.layout-landscape .status-effect-bar-player)`), card hover tooltip (lines ~2103-2135)
- `src/ui/components/CardHand.svelte` — card hand sizing (sub-step 3)
- `src/ui/components/ChainCounter.svelte` — DO NOT EDIT for landscape changes; portrait mode only
- `src/ui/components/StatusEffectBar.svelte` — DO NOT EDIT for positioning; positioning is in CardCombatOverlay CSS
- `src/game/scenes/CombatScene.ts` — enemy HP bar block prefix (sub-step 11): `refreshEnemyHpBar()` (~line 1864), `refreshEnemyBlockBar()` (~line 1886); also check `playerHpColor()` (~line 112) for sub-step 8

**Files that do NOT exist (do not create them):**
- EndTurnButton.svelte — does not exist; end turn is inline in CardCombatOverlay.svelte
- PlayerStats.svelte — does not exist; player stats are inline in CardCombatOverlay.svelte
- DeckCounter.svelte — does not exist; deck label is inline in CardCombatOverlay.svelte
- CardInfoTooltip.svelte — does not exist; tooltip is inline in CardCombatOverlay.svelte

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] All sub-steps visually verified via Playwright at 1920x1080 using `browser_evaluate(() => window.__terraScreenshotFile())` then `Read('/tmp/terra-screenshot.jpg')`
- [ ] End turn button at bottom-left, no spurious "0" visible
- [ ] Cards 15% larger, no clipping or text overflow
- [ ] Draw/discard piles 2x size with proportional card count text
- [ ] "Deck: X" label gone, no dead CSS left behind
- [ ] Black bar removed from player HP area
- [ ] HP bar colored by %: green/orange/red/blue (blue = any block), color logic matches for both portrait and landscape fills
- [ ] Block shown as inline "(N)" text prefix for player and enemy — no shield icon, no "Block: X" label
- [ ] Chain display to the right of card hand, colored by chain type, black border, hidden when no chain
- [ ] AP sphere 2x size (~56px), at ~15% from left, extracted from stats bar flex, no overlap with other elements
- [ ] Card info tooltip near bottom-left, above end turn button, not mid-screen
- [ ] Player status effects above HP bar, containers smaller, cards shifted up
- [ ] `docs/GAME_DESIGN.md` updated: chain display, block display, HP bar colors, status effects positioning, AP sphere position

---

## Worker Notes

**CRITICAL: Read these before touching any file.**

1. **Hybrid rendering system.** The combat UI is split across two rendering systems. Enemy HP bar = Phaser (`CombatScene.ts`). Everything player-facing (HP bar, cards, chain, AP, end turn, piles, status effects, tooltip) = Svelte DOM (`CardCombatOverlay.svelte`). Sub-step 11 touches BOTH.

2. **One worker for the stats bar cluster.** Sub-steps 7, 8, 9, 10, 11, and 13 all modify the `landscape-stats-bar` CSS block and elements within it. Assign ALL six to a single worker in one pass to avoid merge conflicts.

3. **Screenshot before implementing sub-steps 1 and 12.** The "0" on the end turn button and the card hover info location are ambiguous from code inspection alone. Take a Playwright screenshot first (`browser_evaluate(() => window.__terraScreenshotFile())`, then `Read('/tmp/terra-screenshot.jpg')`) before changing anything.

4. **Zero hardcoded px.** Every layout value must use `calc(Npx * var(--layout-scale, 1))`. Font sizes use `calc(Npx * var(--text-scale, 1))`. This is non-negotiable. Values already using `%`, `vw`, `vh`, `rem`, `clamp()`, or `var()` are fine as-is.

5. **ChainCounter.svelte is portrait-only.** For landscape mode, the chain indicator is the inline `lsb-chain-indicator` inside `CardCombatOverlay.svelte`. Do not edit `ChainCounter.svelte` for any landscape layout change.

6. **StatusEffectBar.svelte positioning is in CardCombatOverlay.** Do not edit `StatusEffectBar.svelte` to reposition status effects in landscape. The controlling CSS is `:global(.layout-landscape .status-effect-bar-player)` in `CardCombatOverlay.svelte`.

7. **AP sphere extraction is architectural.** Sub-step 10 requires extracting `lsb-ap-circle` from the flex layout of `landscape-stats-bar` into a standalone fixed-position element. This is a structural change, not a CSS tweak — test carefully that the flex layout of the remaining stats bar elements is not broken.

8. **Update docs.** After implementation, update `docs/GAME_DESIGN.md` for: chain display behavior, block display (no icon, inline prefix), HP bar color logic, AP sphere position, status effects positioning. Stale docs are treated as bugs.

---

## Visual Testing — MANDATORY

**After ALL sub-steps are implemented, a Sonnet visual-testing worker MUST inspect the result before the AR is considered complete.**

### Procedure

1. Ensure the dev server is running (`npm run dev`)
2. Navigate with Playwright MCP: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
3. Load the relevant scenario: `browser_evaluate(() => window.__terraScenario.load('combat-basic'))` (or the appropriate scenario for this AR)
4. Take screenshot: `browser_evaluate(() => window.__terraScreenshotFile())` — saves to `/tmp/terra-screenshot.jpg`
5. Read the screenshot: `Read('/tmp/terra-screenshot.jpg')` to visually inspect
6. Take DOM snapshot: `mcp__playwright__browser_snapshot` for structural verification
7. Check console: `mcp__playwright__browser_console_messages` for JS errors
8. **If ANY visual issue is found: fix it before reporting done.** Do not tell the user "it should work" — CONFIRM it works.

### What to Verify (per AR)

The visual-testing worker must check every sub-step's acceptance criteria against the actual rendered output. Specific checks:

- Layout positions match the AR's layout diagram (if any)
- No element overlap or clipping
- Text is readable at 1920x1080 landscape
- Colors match the spec (HP bar colors, chain colors, etc.)
- No hardcoded-px visual artifacts (elements too small or too large)
- No console errors or warnings
- Dynamic scaling works (test at 1920x1080 AND 1280x720 if the AR touches layout)

### Resolution

- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser's RAF blocks it permanently
- **NEVER** use `page.screenshot()` via `browser_run_code` — same RAF blocking issue
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` then `Read('/tmp/terra-screenshot.jpg')`
- Use Sonnet workers (`model: "sonnet"`) for visual inspection — equally capable as Opus for screenshot analysis
