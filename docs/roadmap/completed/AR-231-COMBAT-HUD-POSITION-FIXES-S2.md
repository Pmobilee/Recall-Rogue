# AR-231: Combat HUD Position Fixes (Session 2)

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 1, 2, 3, 4, 5, 8
**Complexity:** Medium — CSS positioning fixes, prop-wiring audit
**Dependencies:** AR-218 (Combat HUD Layout Overhaul), AR-220 (Card Selection/Charge UX)

---

## Overview

Six HUD-positioning and charge-display bugs survived the AR-218/AR-220 implementation. Previous fixes either didn't take effect or were partially applied. This AR resolves all six in a single focused pass with mandatory visual verification after each sub-step.

---

## User's Exact Words

> "The AP button is too low. It needs to be at approximately the same height as the player HP bar — on the same horizontal axis."

> "When selecting a card, there is still a semi-transparent container (or drop shadow) visible around it. Make this completely transparent."

> "When selecting a card, it still goes all the way up. It needs to go up only about half the height of the card."

> "The charge button is still in the center of the screen. It needs to be exactly above the selected card."

> "I have 1 AP left. The charge on the card says '+0 AP'. Yet clicking charge does nothing."

> "Our own HP bar can be about 5% of the screen lower. Same for the AP sphere."

---

## Sub-Steps

### Step 1 — AP Sphere Vertical Alignment
**File:** `src/ui/components/CardCombatOverlay.svelte`

- Locate the AP sphere container. Its `top` or `bottom` CSS must place it on the same horizontal axis as the HP bar.
- Both elements should share the same `bottom` offset from the bottom of the viewport (or same `top` value if positioned from top).
- Use `calc(Npx * var(--layout-scale, 1))` — zero hardcoded px.

**Acceptance:** AP sphere and HP bar visually sit at the same vertical height in landscape 1920x1080 screenshot.

---

### Step 2 — HP Bar + AP Sphere Both 5% Lower
**File:** `src/ui/components/CardCombatOverlay.svelte`

- After aligning them (Step 1), shift both elements downward by approximately 5vh.
- Adjust the shared bottom offset or top positioning value so both move together.

**Acceptance:** Screenshot shows both HP bar and AP sphere visibly lower than the AR-218 baseline, still within the bottom safe zone, not clipping off screen.

---

### Step 3 — Remove Card Selection Shadow/Glow/Background
**File:** `src/ui/components/CardHand.svelte`

- Find the CSS class applied to the selected card container (e.g., `.selected`, `.card-selected`, `:selected`).
- Remove or zero out: `box-shadow`, `filter: drop-shadow(...)`, `background`, `backdrop-filter`, any semi-transparent overlay.
- The selected card must have zero visual background — fully transparent.

**Acceptance:** Selected card has no visible glow, shadow, or background highlight in screenshot.

---

### Step 4 — Card Rise Distance: Half Card Height Only
**File:** `src/ui/components/CardHand.svelte`

- Find the `transform: translateY(...)` (or equivalent) applied when a card is selected.
- The rise distance must equal approximately 50% of the card's rendered height.
- If card height is stored as a variable or CSS custom property, use `calc(var(--card-height) * -0.5)`. If not, derive it: the card rise should be `calc(-Npx * var(--layout-scale, 1))` where N ≈ half the card's pixel height.
- Remove any previous override that was added in AR-220 if it set a larger value.

**Acceptance:** Selected card rises approximately half its own height above its resting position. Card does not travel near the top of the screen.

---

### Step 5 — Charge Button Position Above Selected Card
**File:** `src/ui/components/CardHand.svelte` or `src/ui/components/CardCombatOverlay.svelte`

- The charge button must be absolutely positioned directly above whichever card is currently selected.
- It must track the selected card's horizontal center. If card positions are tracked in JS (index * card-width + offset), use that same calculation for the charge button's `left`.
- Vertical: the button should sit just above the top edge of the risen card — `calc(selectedCardTop - buttonHeight - Npx * var(--layout-scale, 1))` or equivalent.
- It must NOT be centered on the screen unless the selected card happens to be centered.

**Acceptance:** Screenshot with card index 0 selected shows charge button above leftmost card. Screenshot with card index 4 selected shows charge button above rightmost card.

---

### Step 6 — Fix Charge +AP Display (Always Shows +0)
**File:** `src/ui/components/CardHand.svelte` and/or `src/ui/components/CardCombatOverlay.svelte`

- Trace the prop or store that feeds the "+N AP" value shown above the charge button on each card.
- Check: is the chain momentum color/bonus being passed down to the card component? Is it reactive?
- The display should show `+0` only for cards matching the active momentum chain color. All other cards should show `+1` (standard charge AP cost).
- If no momentum chain is active, all cards show `+1`.
- This is likely a prop-passing bug — verify the parent component is not passing a stale or hardcoded `0`.

**Acceptance:** With no chain momentum active: all cards show `+1 AP` on the charge indicator. After a correct chain answer matching a card's color: that card shows `+0 AP`, others show `+1 AP`.

---

## Files Affected

- `src/ui/components/CardCombatOverlay.svelte` — AP sphere position, HP bar position, charge AP display prop
- `src/ui/components/CardHand.svelte` — card rise distance, selection shadow, charge button position

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Visual: AP sphere and HP bar on same horizontal axis
- [ ] Visual: Both 5% lower than before
- [ ] Visual: Selected card has no shadow/glow/background
- [ ] Visual: Card rises only ~half its own height
- [ ] Visual: Charge button appears directly above selected card at any index position
- [ ] Visual: Charge AP indicator shows correct value based on chain momentum state

---

## Visual Testing — MANDATORY

After EVERY sub-step, take a screenshot using:
```javascript
browser_evaluate(() => window.__terraScreenshotFile())
// then Read('/tmp/terra-screenshot.jpg')
```

Load combat instantly via:
```javascript
await page.evaluate(() => window.__terraScenario.load('combat-basic'));
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
```

Test charge button position by selecting card at different hand positions (index 0, middle, last).
NEVER use `mcp__playwright__browser_take_screenshot` — it hangs permanently.
Target: Steam PC landscape 1920x1080.
