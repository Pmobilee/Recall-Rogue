# AR-219: Enemy Display & Intent System

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #1, #2, #3, #4, #5, #27, #45
> **Priority:** P0 — Core enemy UI, paired with AR-218
> **Complexity:** Medium (7 discrete changes to enemy display)
> **Dependencies:** AR-218 (shares HP bar changes — block inline text applies to enemy HP bar too)

---

## Overview

Overhaul the enemy display system: intent button positioning, intent interaction behavior, enemy title styling, HP bar visual quality, status effect placement, and elite/boss HP bar coloring.

---

## User's Exact Words

- **#1:** "The enemy intention, the gold button at the top which pops out when you click on it, should at all times be stuck to the top-left of the enemy, of course not moving with the enemy as this would be annoying."
- **#2:** "When clicking the enemy we see a popup with another intention explanation, remove this."
- **#3:** "When clicking the enemy intention, show the name of the attack in a darker version of the intent color like Screech: Buff self 1 strength for 2 turns."
- **#4:** "Title of the enemy must be bigger and have a stronger border, including the turn 1 below it, also relatively bigger."
- **#5:** "The HP bar looks ugly, I dont mind the text, but we need a black border around it and an rpg like 3d effect."
- **#27:** "I want the enemy upgrades like strength, etc or dots like bleed poison, basically any and all effects, to show up underneath the health bar of the enemy, not on top."
- **#45:** "Elites must have a different color healthbar, and so must the bosses, although their healthbar must turn blue as always if they have block."

---

## Worker Notes — CRITICAL: Read Before Touching Anything

The enemy UI is split across two rendering systems. Getting this wrong causes invisible bugs.

**Phaser canvas (`src/game/scenes/CombatScene.ts`):**
- Enemy HP bar — drawn with Phaser `Graphics` using `fillRoundedRect`. NOT CSS, NOT Svelte. All HP bar styling, border, 3D effect, and color changes go here.
- Enemy name text — `enemyNameText` Phaser text object (line 151). May be hidden in landscape; verify at runtime.
- Block display — HP bar color switch at `refreshEnemyHpBar()` (line 1871). Currently: `currentEnemyBlock > 0 ? 0x3498db : COLOR_HP_RED`.
- Existing color constants (DO NOT reinvent): `COLOR_ELITE = 0xd4af37` (gold), `COLOR_BOSS = 0xdc2626` (red), `categoryColor()` function at lines 84-91.

**Svelte DOM (`src/ui/components/CardCombatOverlay.svelte`):**
- Intent bubble — `enemy-intent-bubble` div, lines 1849-1877. Has `onclick={() => { intentPopupOpen = !intentPopupOpen }}` toggling `intent-bubble-detail`.
- Enemy name/turn header — `enemy-name-header` div, lines 1779-1783. This is the active one in landscape 1920x1080 (primary target).
- Enemy hover tooltip — `enemy-hover-zone` div, lines 2100-2135. Shows on mouseenter/mouseleave.
- Status effects — rendered by `StatusEffectBar.svelte`. Positioned via `:global()` CSS in CardCombatOverlay.

**No separate EnemyHPBar.svelte, EnemyIntent.svelte, or EnemyInfo.svelte exist.** The old file list in this doc was wrong. Do not create these files.

**Phaser-Svelte coordinate bridge:**
The intent bubble and status effects are Svelte DOM elements that must visually align with Phaser canvas elements (enemy sprite, HP bar). These live in different coordinate systems. The solution is a shared Svelte store:

Create `src/stores/enemyLayoutStore.ts` with shape:
```ts
export interface EnemyLayout {
  enemyBoundingLeft: number;  // px from left edge of viewport
  enemyBoundingTop: number;   // px from top edge of viewport
  hpBarBottom: number;        // px from top edge of viewport (bottom of HP bar)
}
```
`CombatScene.ts` writes to this store after `create()` and on `resize()`. `CardCombatOverlay.svelte` reads from it to position the intent bubble (sub-step 1) and status effects (sub-step 6).

Use known constants to calculate initial values: `LANDSCAPE.ENEMY_X_PCT = 0.50`, `LANDSCAPE.ENEMY_Y_PCT = 0.45`.

**Sub-step 3 intent names — no schema change required:**
`EnemyIntent` (defined in `src/data/enemies.ts`, lines 17-32) has NO `name` field — only `type`, `value`, `weight`, `telegraph`, `statusEffect`, `hitCount`, `bypassDamageCap`. Derive the display name from the `telegraph` field using a `getIntentDisplayName(intent: EnemyIntent): string` utility function. Do NOT add `name` to `EnemyIntent` or update 89 enemy definitions.

**AR-218 coordination:**
The block inline "(N)" text change in the enemy HP bar is shared with AR-218. Check whether AR-218 has already implemented it before duplicating the change.

---

## Sub-Steps

### 1. Intent Button — Fixed Position Top-Left of Enemy

- **What:** The `enemy-intent-bubble` in `CardCombatOverlay.svelte` must be anchored to the top-left of the enemy sprite's static bounding area.
- **Critical:** The intent button must NOT move during enemy idle bob, attack animations, or any other animation. It stays at the fixed initial position regardless of what the sprite is doing.
- **Current behavior:** Intent button is centered above the enemy HP bar.
- **New behavior:** Intent button positioned using values from `enemyLayoutStore` — set `left: enemyBoundingLeft` and `top: enemyBoundingTop` in CSS. Use `position: absolute` relative to the combat overlay container.
- **Implementation:**
  1. Create `src/stores/enemyLayoutStore.ts` (see Worker Notes above).
  2. In `CombatScene.ts`, import the store and write `{ enemyBoundingLeft, enemyBoundingTop, hpBarBottom }` after enemy placement in `create()` and in the resize handler.
  3. In `CardCombatOverlay.svelte`, subscribe to the store and bind `left`/`top` CSS vars to the intent bubble.
  4. All CSS values must use `calc(Npx * var(--layout-scale, 1))` — zero hardcoded px for spacing/sizing.
- **Acceptance:** Intent button at top-left of enemy. Stationary during idle bob and all attack animations. Repositions correctly on window resize.

### 2. Remove Enemy Click Popup

- **What:** The `intent-bubble-detail` div that appears when clicking the intent bubble must be removed entirely, along with the `intentPopupOpen` toggle logic.
- **Clarification:** There is NO click handler on the Phaser enemy sprite itself. The user's mental model of "clicking the enemy shows a popup" refers to clicking the `enemy-intent-bubble` Svelte button, which toggles `intent-bubble-detail`. That is what must be removed.
- **Do NOT touch:** The `enemy-hover-zone` tooltip (lines 2100-2135) shows on hover, not click — leave it unless sub-step 3 replaces it.
- **Implementation:**
  1. In `CardCombatOverlay.svelte`, remove the `intentPopupOpen` state variable.
  2. Remove the `onclick` toggle from `enemy-intent-bubble`.
  3. Remove the `intent-bubble-detail` div and all its contents.
- **Acceptance:** Clicking the intent bubble produces no popup. The hover tooltip (if still present) still works. No JS errors.

### 3. Intent Click — Show Attack Name in Darker Intent Color

- **What:** When clicking the intent button, display a styled label: `"[Attack Name]: [Description]"` — e.g., `"Screech: Buff self 1 strength for 2 turns"`.
- **Color:** Text in a darker shade of the current intent color. Attack intent (red) → dark red text. Buff intent (yellow/gold) → dark amber text. Defend intent (blue) → dark blue text. Derive the darker shade programmatically (e.g., reduce luminance by 30%).
- **Attack name derivation:** Add a utility function `getIntentDisplayName(intent: EnemyIntent): string` that derives a human-readable name from the `telegraph` field. Do NOT modify the `EnemyIntent` interface or any enemy definition files. The telegraph field already contains a short description string — use it directly or format it (e.g., title-case it).
- **Behavior:** Shows on click of intent button. Dismisses on click elsewhere or after 3 seconds via a timeout.
- **Implementation:** Add the click handler back to `enemy-intent-bubble` (replacing the removed `intentPopupOpen` behavior) but now it shows the new styled label, not the old `intent-bubble-detail` popup.
- **Acceptance:** Clicking intent button shows `"[Name]: [description]"` in darker intent color. Auto-dismisses. No leftover `intentPopupOpen` logic.

### 4. Enemy Title — Bigger with Stronger Border

- **What:** In `CardCombatOverlay.svelte`, increase the `enemy-name-header` (lines 1779-1783) font size by approximately 1.4-1.6x current value.
- **What:** Add a stronger text outline/stroke — 2-3px black stroke using `-webkit-text-stroke` or `text-shadow` stack.
- **What:** The "Turn X" counter below the title must also scale up proportionally.
- **Landscape primary target:** Verify the Phaser `enemyNameText` (line 151 in CombatScene.ts) is hidden in landscape 1920x1080. If visible, update its font size and stroke there too.
- **All font-size values MUST use `calc(Npx * var(--text-scale, 1))`** — zero hardcoded px.
- **Acceptance:** Enemy title visually prominent and easy to read against any background. Turn counter proportionally larger. Strong black outline visible.

### 5. Enemy HP Bar — RPG 3D Effect with Black Border

- **This is a Phaser `Graphics` object in `CombatScene.ts`, NOT CSS.** All changes go in `refreshEnemyHpBar()` and related Phaser drawing code.
- **What:** Add a solid black border around the HP bar. In Phaser: draw a slightly larger black `fillRoundedRect` behind the HP bar rect to simulate a border (2-3px on each side).
- **What:** Add an RPG-style 3D bevel effect. Options in Phaser:
  - Use `fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alpha)` for a linear gradient (lighter top edge, darker bottom).
  - Or draw a thin highlight `fillRoundedRect` along the top edge (white at low alpha) and a thin shadow along the bottom edge (black at low alpha) after drawing the main bar.
- **What:** Keep the HP text as-is (user said "I don't mind the text").
- **What:** Block inline "(N)" text — coordinate with AR-218 to avoid duplicate implementation. If AR-218 has not done it, implement here.
- **Acceptance:** HP bar has visible black border. Visible top-highlight / bottom-shadow 3D bevel. Looks polished and RPG-like. Text unchanged.

### 6. Enemy Status Effects — Under HP Bar

- **What:** Move `StatusEffectBar.svelte` for the enemy from its current position (above the HP bar) to below it.
- **This is a Svelte-Phaser coordinate bridge problem.** Status effects are Svelte DOM, HP bar is Phaser canvas.
- **Implementation:** Read `hpBarBottom` from `enemyLayoutStore` (created in sub-step 1). Position the status effect bar at `top: hpBarBottom + offset` using inline CSS or a CSS variable. `CombatScene.ts` must write `hpBarBottom` to the store whenever the HP bar is drawn/repositioned.
- **All spacing values MUST use `calc(Npx * var(--layout-scale, 1))`** — zero hardcoded px.
- **Acceptance:** All enemy status effect icons (strength, weakness, poison, bleed, burn, etc.) render visibly below the HP bar, not above it. Positions update correctly on resize.

### 7. Elite & Boss HP Bar Colors

- **This is Phaser `Graphics` in `CombatScene.ts`.** All changes go in `refreshEnemyHpBar()`.
- **Use existing constants — do NOT invent new ones:**
  - `COLOR_ELITE = 0xd4af37` (gold) — already defined
  - `COLOR_BOSS = 0xdc2626` (red) — already defined
  - `categoryColor()` function at lines 84-91 — already exists
- **Color hierarchy (highest priority wins):**
  1. Block > 0 → blue (`0x3498db`) — already implemented at line 1871, keep this
  2. Boss → `COLOR_BOSS` (`0xdc2626`, crimson red)
  3. Elite → `COLOR_ELITE` (`0xd4af37`, gold)
  4. Normal → `COLOR_HP_RED` (unchanged)
- **Current code:** `currentEnemyBlock > 0 ? 0x3498db : COLOR_HP_RED`
- **New code:** `currentEnemyBlock > 0 ? 0x3498db : getCategoryHpColor(currentEnemyCategory)` where `getCategoryHpColor` returns the appropriate constant based on enemy category.
- **Normal enemies keep red. Blue override for block applies to ALL enemy types.**
- **Acceptance:** Normal enemy HP bar is red. Elite HP bar is gold. Boss HP bar is crimson. Any enemy with block > 0 shows blue regardless of category.

---

## Files Affected

- `src/stores/enemyLayoutStore.ts` — **NEW FILE** — Svelte store bridging Phaser canvas coordinates to Svelte DOM positioning
- `src/game/scenes/CombatScene.ts` — enemy HP bar styling (3D effect, black border, elite/boss colors), writes to `enemyLayoutStore`
- `src/ui/components/CardCombatOverlay.svelte` — intent bubble positioning, remove `intentPopupOpen`/`intent-bubble-detail`, add attack name display, enemy name/turn sizing, status effect repositioning
- `src/ui/components/StatusEffectBar.svelte` — positioning adjustment if needed (may be fully controlled from CardCombatOverlay CSS)
- `src/data/enemies.ts` — read-only reference for `EnemyIntent` interface shape. DO NOT modify.

Files explicitly NOT involved:
- `src/game/systems/EnemySpriteSystem.ts` — sprite-level interactions only, not intent button
- No `EnemyHPBar.svelte`, `EnemyIntent.svelte`, or `EnemyInfo.svelte` — these do not exist

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] Intent button at top-left of enemy, stationary during all animations
- [ ] Intent button repositions correctly on window resize
- [ ] No popup when clicking intent button (old `intent-bubble-detail` removed)
- [ ] Intent click shows `"[AttackName]: [description]"` in darker intent color, auto-dismisses
- [ ] Enemy hover tooltip still works (was not removed)
- [ ] Enemy title visibly larger with strong black stroke/outline
- [ ] Turn counter proportionally larger
- [ ] HP bar has visible black border
- [ ] HP bar has visible RPG 3D bevel effect (top highlight / bottom shadow)
- [ ] HP text unchanged
- [ ] Status effects render below HP bar, not above
- [ ] Normal enemy HP bar is red
- [ ] Elite HP bar is gold (`0xd4af37`)
- [ ] Boss HP bar is crimson (`0xdc2626`)
- [ ] Blue override (`0x3498db`) when any enemy has block > 0
- [ ] Block shown as "(N)" inline in HP bar (coordinate with AR-218 — only implement if AR-218 has not)
- [ ] All CSS sizing/spacing uses `calc(Npx * var(--layout-scale, 1))` — zero hardcoded px
- [ ] All font sizes use `calc(Npx * var(--text-scale, 1))` — zero hardcoded px
- [ ] Visually inspect at 1920x1080 landscape (primary target) via Playwright screenshot
- [ ] Update `docs/GAME_DESIGN.md` sections: Enemy Sprite Rendering, Enemy Rarity System
- [ ] Update `data/inspection-registry.json` — set `lastChangedDate` for affected enemies, screens, and systems

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
