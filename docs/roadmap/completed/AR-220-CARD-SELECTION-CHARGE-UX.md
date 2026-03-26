# AR-220: Card Selection & Charge UX

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #17, #18, #19, #21, #22, #24, #37, #38
> **Priority:** P0 — Core card interaction polish
> **Complexity:** Medium (8 discrete UX changes)
> **Dependencies:** AR-218 (card sizing changes in that AR affect positioning here)

---

## Overview

Polish the card selection, pop-up, and charge button UX. Fix multiple interaction issues: cards rise too high when selected, unwanted visual artifacts around selected cards, redundant tutorial text, charge button misplacement, incorrect charge preview values, card description overflow, and cursed card visual redesign.

---

## User's Exact Words

- **#17:** "When selecting a card, move it up less, to about half the length up of the card."
- **#18:** "When selected, the cards have this sort of transparent container around them, make it invisible."
- **#19:** "When selecting a card it says tap again = quick play, remove this, we have a tutorial."
- **#21:** "When we select a card, the charge button has the + 1 ap in a slight black indicator next to it, I like this one, but put it instead centered slightly above the E of the chargE, that looks better. Make sure that when charging is free, it says + 0 AP, 0 in green. Or when it costs more than 1, in red."
- **#22:** "Center the charge button exactly centered slightly above the selected card instead of in the middle!"
- **#24:** "When charging and we see the question, the amount of the effect is not correct, it doesn't take into account the charge, for example it shows 6 block instead of 9."
- **#37:** "Card descriptions are sometimes coming out of the description frame, and it's not centered well vertically, auto scale it with a tiny bit of padding!"
- **#38:** "Right now, for some reason, I sometimes see that a card like my strike has gone purple, and has a green sharp container around it, or rather its invisible with a single pixel dark green outline. Is this a cursed card? If so, make it ghostlike, like ghostly orbs coming from it! Also, when cursed, should it do less damage, it says deal 8 damage so I don't think it's cursed. Also, the color change is not necessary, make it slightly faded instead. If this is not a curse indication, figure out what it is."

---

## Worker Notes — Read Before Implementing

- **Two card rendering branches exist in `CardHand.svelte`:** one for landscape (~lines 690–995) and one for portrait (~lines 998–1230). EVERY change to card rendering must be applied to BOTH branches.
- **The card rise change (sub-step 1) has 3 co-dependent references that must all change together.** The `-80` value appears in the JS template literal for card transform AND is referenced in the charge button portrait position and hover tooltip position as `calc(-80px - var(--card-h) - 8px)`. Changing only the JS transform without updating the CSS calc expressions will break layout.
- **The landscape charge button (sub-step 4/5) is missing first-charge-free logic** that portrait already has (portrait handles `isFirstChargeFree()` at ~line 1031). Add the free-charge AP display to the landscape charge button as part of sub-step 4 — it is a pre-existing gap that must be closed here.
- **Cursed card visual (sub-step 8) is intentional AR-202 work** — it is not a bug. The user wants the visual redesigned. Do not treat it as an unknown artifact or remove it as a bug; redesign it as specified.
- **ALL CSS values must use `calc(Npx * var(--layout-scale, 1))` per project scaling rules.** Never write bare `px` values for layout, sizing, spacing, or fonts. `font-size` uses `var(--text-scale, 1)`. See CLAUDE.md Dynamic Scaling Rule.

---

## Sub-Steps

### 1. Selected Card Rise — Reduce to Half Card Height

- **What:** When a card is tapped/selected in hand, it rises too high. Reduce the rise distance to approximately half the card height.
- **File:** `src/ui/components/CardHand.svelte`
- **Current behavior:** Hardcoded `-80` in the JS template literal: `transform: translate3d(${xOffset}px, ${isSelected ? -80 : ...}px, 0)` — used in BOTH landscape and portrait rendering branches.
- **Problem with naive fix:** `calc()` cannot be used inside JS template literals. Options:
  - (a) Read the CSS custom property `--card-h` via `getComputedStyle(element).getPropertyValue('--card-h')` in JavaScript, convert to number, multiply by 0.5, use the result directly.
  - (b) Apply a CSS class `.card--selected` that sets `transform: translateY(calc(var(--card-h) * -0.5))` and remove the inline transform override for the Y axis.
  - Option (a) is simpler given the existing inline-style pattern. Option (b) is cleaner long-term.
- **Co-dependent references that must also change:** After changing `-80` in the JS template, search CardHand.svelte for all occurrences of `80px` and `calc(-80px`. The charge button portrait position and hover tooltip use `calc(-80px - var(--card-h) - 8px)` — update these to match the new rise value.
- **Acceptance:** Selected card rises approximately half its own height. Works correctly in both landscape and portrait. No layout breakage on charge button or hover tooltip.

### 2. Remove Transparent Container Around Selected Cards

- **What:** Selected cards have an unwanted visible container/background. Make it fully invisible.
- **File:** `src/ui/components/CardHand.svelte`
- **Important — investigate before implementing:** The exact source of the visible container is not confirmed. It may be:
  - The card button's default `background-color: #1e2d3d` showing through
  - The cursed card `::before` pseudo-element border (see sub-step 8)
  - A wrapper div that gains a background on selection
  - **Worker MUST take a screenshot via `browser_evaluate(() => window.__terraScreenshotFile())` then `Read('/tmp/terra-screenshot.jpg')` with a card selected to identify the visual before implementing any fix.**
- **Likely fix:** Add `background: transparent` to the `.card-selected` state or the card button element when selected. If it is the `::before` border, address in sub-step 8 (cursed card redesign) instead.
- **Acceptance:** No visible container, background, or border appears behind/around selected cards (other than the intentional cursed card orb effect if that card is cursed).

### 3. Remove "Tap Again = Quick Play" Text

- **What:** Remove the instructional overlay text that appears when a card is selected.
- **File:** `src/ui/components/CardHand.svelte`
- **Confirmed location:** Line 821, landscape-only block:
  ```svelte
  {#if isSelected && $isLandscape}
    <div class="card-quickplay-hint">Tap again = quick play</div>
  {/if}
  ```
- **Remove:** The entire `{#if isSelected && $isLandscape}` block above, plus the `.card-quickplay-hint` CSS rule (~line 1386).
- **Acceptance:** No "tap again = quick play" or similar instructional text appears on card selection in any orientation.

### 4. Charge Button AP Indicator — Reposition and Color-Code

- **What:** The "+1 AP" cost indicator must be repositioned to sit centered slightly above the letter "E" at the end of "CHARGE", with color coding.
- **File:** `src/ui/components/CardHand.svelte`
- **Color coding rules:**
  - Free (+0 AP, when `isFirstChargeFree()` returns true): display "0" in GREEN (`#4ADE80`)
  - Normal (+1 AP): default/white color
  - Expensive (>1 AP): number in RED (`#EF4444`)
- **Pre-existing gap to fix here:** The landscape charge button does NOT currently handle `isFirstChargeFree()` — only the portrait version does (~line 1031). Add the free-charge AP display and color logic to the landscape charge button as part of this sub-step. Both landscape and portrait charge buttons must be functionally identical on AP display.
- **Positioning:** The indicator element should be absolutely positioned relative to the charge button container, using `right: 0; top: 0; transform: translate(0, -100%)` or equivalent to place it above the trailing edge of the button text. Adjust with `calc()` values as needed for visual alignment above the "E".
- **Acceptance:** AP indicator is above the "E" in "CHARGE" in both landscape and portrait. Color-coded correctly for free (green 0), normal (white 1), expensive (red N). First-charge-free logic works in both orientations.

### 5. Charge Button — Centered Above Selected Card

- **What:** The CHARGE button must be positioned horizontally centered above the currently selected card, not in the center of the screen.
- **File:** `src/ui/components/CardHand.svelte`
- **Current behavior (landscape):** Charge button uses `left: 50%; transform: translateX(-50%)` — centered in its parent container, which is the full screen width, not the selected card.
- **Fix:** The selected card's horizontal offset is tracked as `xOffset` (the same value used in the card's `translate3d` transform). Apply this offset to the charge button:
  ```svelte
  style="left: 50%; transform: translateX(calc(-50% + {xOffset}px));"
  ```
  This keeps the 50% base centering and adds the card's `xOffset` to follow the selected card's position.
- **Portrait:** Verify the portrait charge button also follows the selected card position. Apply the same `xOffset` correction if it does not.
- **Acceptance:** CHARGE button is horizontally centered directly above the selected card. Selecting different cards in different hand positions moves the CHARGE button to follow. Verified in both landscape and portrait.

### 6. Charge Preview — Show Correct Charged Values

- **What:** The card effect shown in the quiz panel during a charge must display the charged value, not the base value.
- **Files:** `src/ui/components/CardExpanded.svelte`, `src/ui/components/CardCombatOverlay.svelte`
- **Confirmed bug:** `CardExpanded.svelte` computes displayed effect as `card.baseEffectValue * card.effectMultiplier` — this does not include the charge multiplier.
- **Fix approach:** The correct charged value must account for both the charge multiplier (1.5x for correct answer at mastery 0) and mastery bonuses (`getMasteryBaseBonus()` from `cardUpgradeService`). The cleanest approach is:
  - Reuse the existing `getEffectValue(card, true)` function from CardHand.svelte (where `true` = charged), OR
  - Pass a pre-computed `chargedEffectValue` prop from `CardCombatOverlay.svelte` down to `CardExpanded.svelte`, so the display component does not need to know the multiplier logic.
  - Do NOT duplicate the multiplier formula inline in CardExpanded — keep the single source of truth.
- **Check if `CardCombatOverlay.svelte` needs a prop change** to pass the charged value context. Update its interface if so.
- **Acceptance:** Quiz panel shows the correct charged effect value (e.g., 9 block, not 6 block). Verified at mastery levels 0, 1, and 2 that values reflect both charge multiplier and mastery bonuses.

### 7. Card Description — Auto-Scale Text with Padding

- **What:** Card description text sometimes overflows the description frame and is not well vertically centered. Text must auto-scale to fit.
- **File:** `src/ui/components/CardHand.svelte`
- **Both rendering branches must be updated** — landscape (~lines 690–995) and portrait (~lines 998–1230) each render card descriptions separately.
- **Current:** Font size uses `font-size: calc(var(--card-w) * 0.095)` — scales with card width but does not shrink for long text.
- **Recommended approach:** JavaScript measurement is more reliable than pure CSS for this:
  1. After render, check `element.scrollHeight > element.clientHeight` on the description container.
  2. If overflowing, reduce font size in steps (e.g., by 0.5px or by multiplying the scale factor) until it fits.
  3. Use a Svelte `$effect` or `afterUpdate` callback to trigger measurement after text changes.
  - Alternatively: `clamp()` based approach with a generous minimum size, but this may not reliably prevent overflow for very long descriptions.
- **Padding:** Add a small consistent inner padding (e.g., `calc(4px * var(--layout-scale, 1))`) to the description frame on all sides so text never touches the frame edge.
- **Vertical centering:** Ensure the description container uses `display: flex; align-items: center; justify-content: center; text-align: center`.
- **Acceptance:** No text overflow on any card type including cards with long descriptions. Text is vertically centered within the frame. Consistent padding on all sides. Works in both landscape and portrait.

### 8. Cursed Card Visual — Redesign to Ghostly Fade + Orbs

- **What:** The cursed card visual system (from AR-202) is intentional but the user wants it redesigned. This is NOT a bug investigation — the visual is confirmed to be the cursed card indicator.
- **File:** `src/ui/components/CardHand.svelte`
- **Current cursed card implementation:**
  - `.card--cursed { filter: sepia(0.3) hue-rotate(240deg) saturate(1.4) brightness(0.85); }` — produces the purple tint
  - `.card--cursed::before { border: 2px solid rgba(160, 60, 220, 0.85); }` — produces the purple border (the user perceives this as a "green outline" due to the hue-shifted art underneath)
- **Cursed card mechanics (confirmed correct):**
  - `CURSED_QP_MULTIPLIER = 0.7` — quick play deals reduced damage
  - `CURSED_CHARGE_CORRECT_MULTIPLIER = 1.0` — charge + correct = normal damage
  - `CURSED_CHARGE_WRONG_MULTIPLIER = 0.5` — charge + wrong = half damage
  - The card face still shows the base value (e.g., "deal 8 damage") because the multiplier is applied at resolution time, not display time. This is consistent behavior; no mechanic fix needed.
- **Redesign spec:**
  1. **Remove purple tint:** Replace the `filter` rule with a subtle fade: `opacity: 0.75` or `filter: brightness(0.8) saturate(0.6)`. The card should look desaturated/faded, not color-shifted.
  2. **Remove the `::before` border:** Delete or clear the `.card--cursed::before` border rule.
  3. **Add ghostly orb particles:** Implement CSS-only floating orbs using `::before` and `::after` pseudo-elements (or small `<span>` elements injected via Svelte for more orbs). Orbs should be small (8–12px scaled), semi-transparent white/pale-blue circles, animating upward with a gentle float keyframe animation and slight opacity fade. Example keyframe: float from `translateY(0)` to `translateY(-20px)` with `opacity: 0` at the end, looping with varied `animation-delay` values per orb for a staggered effect.
  4. Use `calc(Npx * var(--layout-scale, 1))` for all orb sizing.
- **Acceptance:** Cursed cards are visually distinct via subtle desaturation/fade. No purple color shift. No sharp border. Ghostly orbs visually float upward from the card. Orb animation loops smoothly. Mechanic (reduced quick-play damage) is unchanged.

---

## Files Affected

- `src/ui/components/CardHand.svelte` — PRIMARY file for sub-steps 1, 2, 3, 4, 5, 7, 8. Contains all card rendering (two branches: landscape + portrait), charge button, AP indicator, quick play hint, card description rendering, and cursed card CSS. Everything is inlined here — no separate ChargeButton.svelte, CardInteraction.svelte, CardFrame.svelte, or CardDescription.svelte exists.
- `src/ui/components/CardExpanded.svelte` — sub-step 6 (charge preview value calculation fix)
- `src/ui/components/CardCombatOverlay.svelte` — sub-step 6 (may need prop changes to pass charged-value context to CardExpanded)

**Files that do NOT exist (do not reference or create):**
- `ChargeButton.svelte`, `CardInteraction.svelte`, `CardFrame.svelte`, `CardDescription.svelte` — these are all inlined in `CardHand.svelte`

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] Selected card rises ~50% of card height (not ~80px) in both landscape and portrait
- [ ] All three co-dependent rise references updated (JS transform + charge button CSS + tooltip CSS)
- [ ] No visible transparent container or background behind selected cards
- [ ] No "tap again = quick play" text in any orientation
- [ ] Charge button horizontally centered above selected card (follows card position via `xOffset`)
- [ ] AP indicator positioned above "E" in "CHARGE" in both landscape and portrait
- [ ] AP indicator color-coded: green for free (0 AP), white for normal (1 AP), red for expensive (>1 AP)
- [ ] First-charge-free AP display works in BOTH landscape and portrait (landscape gap fixed)
- [ ] Quiz panel during charge shows correct charged values (not base values)
- [ ] Charged values account for both charge multiplier and mastery bonuses
- [ ] No card description overflow on any card type in landscape or portrait
- [ ] Card description text is vertically centered with consistent padding
- [ ] Cursed cards: subtle desaturation/fade (no purple tint, no border)
- [ ] Ghostly orb animation plays on cursed cards, loops smoothly
- [ ] Cursed card damage reduction mechanic is unchanged and verified
- [ ] Visual inspection screenshot taken after all changes: `browser_evaluate(() => window.__terraScreenshotFile())` then `Read('/tmp/terra-screenshot.jpg')`
- [ ] Update `docs/GAME_DESIGN.md` sections: Charge Gesture, Card Anatomy, Cursed Cards

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
