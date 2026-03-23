# AR-233: Card Rendering Parity & Intent Removal

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 11, 12, 13
**Complexity:** Medium — shared card rendering, data model cleanup
**Dependencies:** AR-225 (Reward/Treasure Room Fixes), AR-220 (Card Selection UX)

---

## Overview

Three card rendering issues: (1) Reward screen card artwork renders too low and overlaps the card frame. (2) Same artwork overlap in the card selection popup (CardExpanded). (3) The "next intent" field is displayed on cards everywhere — this must be removed entirely since intents are dynamic and not appropriate for display on cards.

---

## User's Exact Words

> "In the reward screen, the floating card icons still don't have the correct layout — the artwork is too low and overlaps on top of the card frame. We need to render reward cards EXACTLY the same way as combat cards."

> "This artwork overlap issue also exists during card selection popup (when card pops up to middle of screen)."

> "Remove the 'next intent' display from ALL cards. Intent is selected dynamically based on player performance and seed — it's identical for identical runs. Since intents aren't shown on cards (not implemented), remove the field. If any cards break in their upgrade path because of this removal, fix the path."

---

## Sub-Steps

### Step 1 — Audit Combat Card Artwork Layout (Reference)
**File:** `src/ui/components/CardHand.svelte`

- Read the CSS that positions card artwork within the card frame in combat hand cards.
- Document: artwork container's `top`, `height`, `object-fit`, `object-position`, and any `overflow: hidden` clipping.
- This is the reference layout that reward and popup cards must match exactly.

**Acceptance:** Reference values documented in code comments or noted for Steps 2 and 3.

---

### Step 2 — Fix Reward Screen Card Artwork Layout
**File:** `src/ui/components/CardRewardScreen.svelte`

- Apply the exact same artwork positioning CSS from Step 1 to the card components rendered in the reward screen.
- Ensure: artwork does not extend below the card frame boundary, `overflow: hidden` is set on the card frame container, artwork vertical position matches combat cards.
- All sizing must use `calc(Npx * var(--layout-scale, 1))` — zero hardcoded px.

**Acceptance:** Screenshot shows reward screen cards with artwork fully within the card frame, not overlapping the frame bottom edge. Visually identical to combat hand cards.

---

### Step 3 — Fix CardExpanded (Selection Popup) Artwork Layout
**File:** `src/ui/components/CardExpanded.svelte`

- Apply the same artwork positioning from Step 1 to `CardExpanded`.
- The popup card is larger than hand cards — ensure the artwork scales proportionally, not just copy-pasting absolute pixel values.
- Use `%` or `calc` based on the card frame container dimensions.

**Acceptance:** Screenshot shows CardExpanded popup with artwork correctly contained within the frame. No overlap at bottom edge.

---

### Step 4 — Remove "Next Intent" From All Card Displays
**Files:** `src/ui/components/CardHand.svelte`, `src/ui/components/CardRewardScreen.svelte`, `src/ui/components/CardExpanded.svelte`

- Search all card-rendering components for any element that displays "next intent", "intent", or references the card's `intent` / `nextIntent` field for display purposes.
- Remove the display elements. Do NOT remove the data field from the card type definition yet — just remove the UI rendering.
- Check: does any card's upgrade path logic depend on the rendered intent field? If so, fix the upgrade path to use the underlying data directly, not the display element.
- After removal, verify no TypeScript errors from referencing undefined fields.

**Acceptance:** No intent text or icon visible on any card in combat hand, reward screen, or card popup. `npm run typecheck` passes. No upgrade path functionality broken.

---

### Step 5 — Regression Check Upgrade Paths
**Files:** `src/ui/components/CardHand.svelte`, relevant card data files

- Run `npm run typecheck` and `npx vitest run` to catch any breakage.
- If tests reference intent display, update them to reflect removal.
- Manually verify in the game that card upgrades still function (upgraded cards show their upgraded stats, names, effects).

**Acceptance:** `npx vitest run` passes. Upgrade visual indicators (glow, icon) still functional. No console errors about missing intent field.

---

## Files Affected

- `src/ui/components/CardRewardScreen.svelte` — artwork layout fix
- `src/ui/components/CardHand.svelte` — intent display removal
- `src/ui/components/CardExpanded.svelte` — artwork layout fix, intent display removal

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes
- [ ] Visual: Reward screen cards — artwork within frame, not overlapping bottom
- [ ] Visual: CardExpanded popup — artwork within frame
- [ ] Visual: No intent text/icon on any card in any context
- [ ] Functional: Card upgrades still display correctly with upgrade icon

---

## Visual Testing — MANDATORY

```javascript
// Combat cards:
await page.evaluate(() => window.__terraScenario.load('combat-basic'));
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
browser_evaluate(() => window.__terraScreenshotFile())

// Reward screen:
await page.evaluate(() => window.__terraScenario.load('reward-room'));
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg') after each
```

Compare combat cards vs reward cards side by side — artwork position must be identical relative to card frame.
Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
