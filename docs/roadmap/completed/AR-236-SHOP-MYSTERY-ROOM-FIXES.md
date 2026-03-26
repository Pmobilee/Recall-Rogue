# AR-236: Shop & Mystery Room Fixes

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 15, 27, 28, 29, 30, 31
**Complexity:** High — multiple systems, combat transition, layout fixes, haggling redesign
**Dependencies:** AR-226 (Mystery Room Overhaul)

---

## Overview

Six shop and mystery room issues: mystery room "Lost and Found" layout clips, "Ambush" mystery room's combat transition is broken (stuck on "waiting for encounter"), shop card removal minimum check is wrong, shop item descriptions cut off, black border in shop right side, and haggling mechanic needs proper wrong-answer penalty with price display (not auto-buy).

---

## User's Exact Words

> "Mystery room 'Lost and Found' — has an icon and says 'a basket of lost things' but I cannot see what it actually does. The text or icon clips out."

> "'Ambush' mystery room — game gets stuck on 'waiting for encounter'. Mystery room combat transition doesn't work."

> "Card removal in shop says 'need more than 5 cards' but we start with ~12 cards. Something is wrong with the card removal check."

> "Overclock, Emergency Focus etc. — I cannot see exactly what they mean. Their descriptions are cut off or unclear."

> "There's a black border on the right side of the shop — might be trying to show relics. Does not look great."

> "Correct answer = 30% off, wrong answer = 30% UP. Haggling does NOT mean buying immediately — just show the corrected price."

---

## Sub-Steps

### Step 1 — Fix "Lost and Found" Mystery Room Layout
**File:** `src/ui/components/MysteryEventOverlay.svelte`

- Locate the "Lost and Found" event rendering.
- The icon and description text are clipping — likely `overflow: hidden` on the container without enough height, or absolute positioning pushing content out of bounds.
- Remove overflow clipping or increase container height so the full description and effects list are visible.
- Ensure all text uses `calc(Npx * var(--text-scale, 1))`, all spacing uses `calc(Npx * var(--layout-scale, 1))`.
- Effect list (what the event does) must be fully readable.

**Acceptance:** Screenshot shows "Lost and Found" with icon visible, description readable, full effect list visible. No clipping.

---

### Step 2 — Fix "Ambush" Mystery Room Combat Transition
**Files:** `src/ui/components/MysteryEventOverlay.svelte`, `src/services/floorManager.ts`, `src/services/gameFlowController.ts`

- The "Ambush" event is supposed to trigger a combat encounter. Currently the game gets stuck on "waiting for encounter."
- Trace the event handler for "Ambush": it should call `gameFlowController.startCombat()` or `floorManager.triggerAmbushEncounter()` with an appropriate enemy.
- Check: is the encounter being dispatched but the combat scene failing to initialize? Or is the dispatch never firing?
- Add a console.log to trace the transition: `console.log('[Ambush] triggering combat with enemy:', enemyId)`.
- Fix the transition so clicking the Ambush event correctly starts a combat encounter.
- After combat, the game should return to the map (not get stuck).

**Acceptance:** Clicking "Ambush" mystery room triggers a combat encounter. Combat resolves normally. Game returns to map after.

---

### Step 3 — Fix Shop Card Removal Minimum Check
**Files:** `src/ui/components/ShopRoomOverlay.svelte`, `src/services/gameFlowController.ts` or deck management service

- Find the condition `if (deck.length <= 5) { showError("need more than 5 cards") }`.
- The starting deck is ~12 cards. The minimum deck size before removal should be blocked is likely 10 or whatever the design specifies — NOT 5.
- Check `docs/GAME_DESIGN.md` or `src/data/balance.ts` for the intended minimum deck size. If not specified, set it to 10.
- Update the check and the error message to reflect the correct minimum.

**Acceptance:** With 12-card starting deck, shop card removal is available (not blocked). Removal is blocked only when deck is at or below the configured minimum (10 or design-specified value).

---

### Step 4 — Fix Shop Item Description Truncation
**File:** `src/ui/components/ShopRoomOverlay.svelte`

- Items like "Overclock" and "Emergency Focus" have descriptions that are cut off.
- Find the description text container — likely has a fixed height with `overflow: hidden` or `text-overflow: ellipsis`.
- Options (choose one): (a) increase the description container height to fit full text, (b) use `overflow-y: auto` with a max-height and scroll, (c) add a hover/tooltip that shows the full description.
- Prefer option (a) or (c). The description must be fully readable without interaction if possible.
- All sizes in `calc(Npx * var(--layout-scale, 1))`.

**Acceptance:** All shop item descriptions fully visible. "Overclock", "Emergency Focus", and any other previously truncated items show complete text.

---

### Step 5 — Fix Black Border on Right Side of Shop
**File:** `src/ui/components/ShopRoomOverlay.svelte`

- Take a screenshot of the shop. Identify the black border/panel on the right side.
- This is likely a relic display panel that has a dark background but no content, or a layout container with `border-right` or `background: black` that shouldn't be there.
- Either: remove the panel if relics aren't implemented in shop yet, or give it proper content and styling that matches the shop aesthetic.
- The shop layout should fill the available width cleanly with no unexplained dark borders.

**Acceptance:** Screenshot shows shop with no black border artifact on right side. Layout is clean.

---

### Step 6 — Implement Haggling Mechanic Correctly
**Files:** `src/ui/components/ShopRoomOverlay.svelte`, `src/services/gameFlowController.ts`

Haggling rules:
- Player initiates haggle on an item → quiz question appears.
- **Correct answer:** item price drops by 30%. Show new (lower) price. Player must still click "Buy" to purchase.
- **Wrong answer:** item price rises by 30%. Show new (higher) price. Player must still click "Buy" to purchase.
- Haggling does NOT auto-buy. It only adjusts the displayed price.
- After haggling (win or lose), the player sees the adjusted price and can choose to buy or not.
- Price display: show original price with strikethrough, new price in green (correct) or red (wrong).
- A player should not be able to haggle the same item twice in one visit.

**Acceptance:** (a) Correct haggle answer shows -30% price, no auto-purchase. (b) Wrong haggle answer shows +30% price, no auto-purchase. (c) Buy button still functional after haggle. (d) Cannot haggle same item twice.

---

## Files Affected

- `src/ui/components/MysteryEventOverlay.svelte` — Lost and Found layout, Ambush trigger
- `src/ui/components/ShopRoomOverlay.svelte` — card removal check, description truncation, black border, haggling
- `src/services/floorManager.ts` — Ambush combat transition
- `src/services/gameFlowController.ts` — Ambush flow, card removal minimum

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Visual: "Lost and Found" — no clipping, full description visible
- [ ] Functional: "Ambush" triggers combat, resolves, returns to map
- [ ] Functional: Shop card removal available with 12-card deck
- [ ] Visual: All shop item descriptions fully readable
- [ ] Visual: No black border in shop
- [ ] Functional: Haggling correct → -30% shown, no auto-buy
- [ ] Functional: Haggling wrong → +30% shown, no auto-buy

---

## Visual Testing — MANDATORY

```javascript
await page.evaluate(() => window.__terraScenario.load('shop'));
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

Also test mystery room via scenario or game flow. Check Ambush specifically by triggering it manually and watching for the "waiting for encounter" hang.
Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
