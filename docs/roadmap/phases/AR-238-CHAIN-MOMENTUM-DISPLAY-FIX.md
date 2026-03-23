# AR-238: Chain Momentum Display Fix

**Source:** `docs/roadmap/PLAYTEST-FEEDBACK-2026-03-23.md`, issues 5, 36, 37
**Complexity:** Medium — prop tracing, store reactivity, momentum logic audit
**Dependencies:** AR-223 (Fact Assignment/Curse Mechanics), AR-231 (Combat HUD Position Fixes S2)

---

## Overview

The charge +AP indicator appears to always show "+0" regardless of actual chain momentum state. This breaks the chain momentum feedback loop. The fix must: (1) correctly display +0 only for cards matching the active chain color, +1 for all others, (2) ensure wrong answers do NOT grant free charge momentum, and (3) verify AR-223 sub-step 4 actually took effect — this may be a prop-passing bug where the value never reaches the card component.

---

## User's Exact Words

> "I have 1 AP left. The charge on the card says '+0 AP'. Yet clicking charge does nothing."

> "When I charge correctly, the next charge OUTSIDE of surge is still showing +0 AP for ALL cards. It should only be free for cards of the SAME chain color."

> "Getting a question WRONG still shows +0 AP on the next charge. Actually wait — it's not free, the +0 AP indicator above the charge button just seems to be broken/always showing +0."

---

## Sub-Steps

### Step 1 — Audit Chain Momentum State Propagation
**Files:** `src/services/turnManager.ts`, `src/ui/components/CardCombatOverlay.svelte`, `src/ui/components/CardHand.svelte`

- Locate where chain momentum is stored: likely a Svelte store or reactive variable in `turnManager.ts`.
- Trace the data path: `turnManager` → `CardCombatOverlay` → `CardHand` → individual card render.
- Add a temporary `console.log` at each level: `console.log('[Momentum] color:', momentumColor, 'active:', momentumActive)`.
- Check: is the store value updating correctly in `turnManager` when a correct chain answer is given? Is it being passed as a prop to child components? Is the child component actually using the prop to compute the display value?

**Acceptance:** Console logs confirm the momentum state flows correctly from `turnManager` → `CardCombatOverlay` → `CardHand`. Identify the exact break point.

---

### Step 2 — Fix the +AP Indicator Computation
**File:** `src/ui/components/CardHand.svelte`

- The charge AP cost indicator for each card should be computed as:
  - `+0` if: chain momentum is active AND this card's color matches the active momentum color.
  - `+1` if: no chain momentum active, OR this card's color does NOT match momentum color.
- Fix the computation. It must be reactive — when momentum changes, all card indicators update immediately.
- If the card component receives `activeMomentumColor: string | null` as a prop, use that prop in the reactive expression.
- If it's reading from a store directly, ensure the store subscription is set up correctly in Svelte 5 rune style.

**Acceptance:** With no momentum: all cards show `+1`. With red momentum active: red cards show `+0`, all others show `+1`. Verified in screenshot and/or console.

---

### Step 3 — Ensure Wrong Answer Does Not Grant Momentum
**File:** `src/services/turnManager.ts`

- Find where charge quiz results are handled.
- Verify the logic: correct answer on a chain charge → grants momentum for that card's color. Wrong answer → does NOT grant momentum (momentum is cleared or remains unchanged, not set).
- Check AR-223 sub-step 4 was implemented: wrong answers should clear or not activate momentum.
- If the wrong-answer handler accidentally sets momentum, fix it.

**Acceptance:** Answering a charge quiz wrong does not result in +0 AP showing on subsequent cards. Momentum state remains unchanged (or cleared) after a wrong charge answer.

---

### Step 4 — Remove Temporary Console Logs
**Files:** `src/services/turnManager.ts`, `src/ui/components/CardCombatOverlay.svelte`, `src/ui/components/CardHand.svelte`

- Remove all console.logs added in Step 1 after the bug is found and fixed.

**Acceptance:** No debug console.logs remain in production code.

---

## Files Affected

- `src/services/turnManager.ts` — wrong-answer momentum logic, state management
- `src/ui/components/CardCombatOverlay.svelte` — momentum prop passing
- `src/ui/components/CardHand.svelte` — +AP indicator computation, reactivity

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes
- [ ] Visual/Functional: No momentum → all cards show `+1 AP`
- [ ] Visual/Functional: Red momentum active → red cards `+0`, others `+1`
- [ ] Functional: Wrong charge answer → momentum NOT granted, indicator stays correct
- [ ] No debug console.logs remaining

---

## Visual Testing — MANDATORY

```javascript
await page.evaluate(() => window.__terraScenario.load('combat-basic'));
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
browser_evaluate(() => window.__terraScreenshotFile())
// Read('/tmp/terra-screenshot.jpg')
```

Check the charge AP indicator on each card before and after triggering a chain charge. Use `browser_evaluate` to read the momentum store value directly:
```javascript
// Check store value
await page.evaluate(() => window.__terraDebug())
```

Target: Steam PC landscape 1920x1080.
NEVER use `mcp__playwright__browser_take_screenshot`.
