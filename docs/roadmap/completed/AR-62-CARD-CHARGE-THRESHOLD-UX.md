# AR-62: Card Charge Threshold UX — Screen-Position Based Play Zones

## Overview
**Goal**: Replace the current drag-distance-based Charge trigger with a screen-position threshold system. Cards dragged below a horizontal cutoff line (slightly above screen center) trigger Quick Play (no quiz). Cards dragged above the cutoff trigger Charge Play (quiz). Visual feedback (glow + text) changes in real-time as the card crosses the threshold.

**Dependencies**: AR-59 (V2 combat system — already completed)
**Complexity**: Medium — mostly UI/interaction logic in CardHand.svelte + CardCombatOverlay.svelte

## Current Behavior (Problem)
- Card drag uses **relative distance** from start position (80px upward = Charge)
- Releasing a held card immediately triggers quiz regardless of position
- No visual distinction between "about to Quick Play" vs "about to Charge Play" during drag
- User has no spatial mental model — threshold is invisible

## Desired Behavior
- A **screen-position threshold line** at ~40% from top of viewport (slightly above center)
- **Below threshold**: Card has normal playable glow (green). Releasing = Quick Play (no quiz)
- **Above threshold**: Card gets charge glow (brighter, pulsing) + "CHARGE!" text indicator above the card. Releasing = Charge Play (quiz)
- Transition between zones is **immediate** as card crosses the line during drag
- The threshold line itself is invisible — communicated purely through visual feedback on the card

## Sub-Steps

### Step 1: Add screen-position threshold constant and compute zone during drag
**File**: `src/ui/components/CardHand.svelte`
- Add a constant `CHARGE_ZONE_Y_RATIO = 0.4` (40% from top of viewport)
- In `handlePointerMove`, compute `chargeZoneY = window.innerHeight * CHARGE_ZONE_Y_RATIO`
- Track a new reactive state `isInChargeZone` = `currentY < chargeZoneY` (card is above threshold)
- Remove or repurpose the old `isDragChargeReady` (80px threshold) — replace with the new zone check
- Keep `isDragPreview` (40px) and `isDragPastThreshold` (60px) for the initial drag activation, but the Charge vs Quick Play decision should be based on screen position

**Acceptance**: During drag, `isInChargeZone` correctly toggles based on card Y position relative to 40% viewport height.

### Step 2: Update glow and visual feedback based on zone
**File**: `src/ui/components/CardHand.svelte`
- **Below threshold (Quick Play zone)**: Normal green playable glow (existing `.drag-ready` style or similar)
- **Above threshold (Charge zone)**: Brighter charge glow — use a distinct CSS class `.drag-charge-zone` with:
  - Brighter green/yellow glow: `filter: drop-shadow(0 0 16px rgba(250, 204, 21, 0.8)) drop-shadow(0 0 32px rgba(250, 204, 21, 0.4))`
  - Slight scale increase (1.05x) to emphasize
- Add a **"CHARGE!" text indicator** above the card when in charge zone:
  - Position it above the dragged card using absolute positioning
  - Style: bold, uppercase, golden color (#facc15), text-shadow for glow, ~14-16px font
  - Include the AP cost badge: "⚡ CHARGE +1 AP" (or "+0 AP" on Surge)
  - Animate in with a quick scale-up or fade-in transition

**Acceptance**: Card visually changes glow color AND shows "CHARGE!" text when dragged above the threshold. Changes revert when dragged back below.

### Step 3: Update release logic to use zone-based play mode
**File**: `src/ui/components/CardHand.svelte`
- In `handlePointerUp`:
  - If `isInChargeZone` is true at release → call `onchargeplay(index)` (Charge Play — quiz)
  - If card was dragged past minimum threshold (60px) but `isInChargeZone` is false → call `oncastdirect(index)` (Quick Play — no quiz)
  - If card barely moved (< 40px) → treat as tap/select (existing behavior)
- Remove the old `deltaY > 80` charge check

**Acceptance**: Releasing above threshold triggers quiz. Releasing below threshold (but past drag minimum) triggers Quick Play. Tap behavior unchanged.

### Step 4: Handle edge cases
**Files**: `src/ui/components/CardHand.svelte`, `src/ui/components/CardCombatOverlay.svelte`
- If Charge is not affordable (not enough AP), show the charge indicator in a dimmed/red state with "NOT ENOUGH AP" instead — do NOT trigger charge on release
- If card is Tier 3 (no charge allowed), never show charge indicator regardless of position
- On small screens (viewport < 600px height), adjust threshold to 35% to give more room
- Ensure pointer cancel cleans up charge zone state

**Acceptance**: Unaffordable charge shows disabled indicator. Tier 3 cards never enter charge zone visually. Small screens have adjusted threshold.

## Files Affected
- `src/ui/components/CardHand.svelte` — Primary changes (drag logic, glow, text indicator)
- `src/ui/components/CardCombatOverlay.svelte` — May need minor adjustments to how charge/quick play callbacks are wired

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Playwright visual test: drag card below threshold → green glow, no "CHARGE!" text
- [ ] Playwright visual test: drag card above threshold → golden glow + "CHARGE!" text
- [ ] Playwright visual test: release below → Quick Play (no quiz)
- [ ] Playwright visual test: release above → Charge Play (quiz appears)
- [ ] Tier 3 cards never show charge indicator
- [ ] Unaffordable charge shows disabled state
- [ ] `npx vitest run` — all unit tests pass
- [ ] Docs updated: GAME_DESIGN.md card interaction section reflects new zone-based system
