# AR-66: Card Feedback & Combo Rules

## Overview
Three interconnected changes to improve combat clarity and strategic depth:

1. **Gradual charge glow** — Card visually transitions from normal → charged as it's dragged upward, instead of a hard cutoff
2. **Dynamic effect values on cards** — Cards show actual computed damage/block/effect (with combo, relics, chain), updating live when dragged into charge zone
3. **Combo rules fix** — Correct answers increase combo; quick play slightly decreases combo; wrong answers decrease combo more heavily

**Dependencies**: None (builds on existing V2 systems)
**Estimated complexity**: Medium-high (touches CardHand visuals, effect computation, turnManager combo logic)

---

## Sub-step 1: Gradual Charge Glow Transition

### Current behavior
- Card has no charge visual feedback until it crosses the charge zone threshold (40% from top of viewport)
- At threshold, class `.drag-charge-zone` snaps on → golden glow appears instantly
- Binary state: either normal or fully charged

### Target behavior
- As card is dragged upward from rest, its border/glow **gradually** transitions:
  - **Rest position**: Normal card glow (domain-colored or neutral)
  - **Mid-drag** (below charge zone): Glow shifts toward warm yellow/amber
  - **At charge zone threshold**: Full golden charge glow (current `.drag-charge-zone` color)
- Transition is based on **drag progress ratio** — how far the card has traveled toward the charge zone threshold
- The hard `.drag-charge-zone` class remains for the charge text indicator ("⚡ CHARGE +1 AP") — that still snaps on at the threshold

### Files affected
- `src/ui/components/CardHand.svelte` — drag glow interpolation logic + CSS

### Implementation
- Compute a `chargeProgress` ratio: `0.0` at rest → `1.0` at charge zone threshold
  - `chargeProgress = clamp(dragDeltaY / (startY - chargeZoneY), 0, 1)`
  - Only compute when actively dragging
- Use `chargeProgress` to interpolate the card's `filter: drop-shadow(...)` between:
  - Normal: card's existing domain glow (or transparent)
  - Charged: `rgba(250, 204, 21, 0.8)` (current golden glow)
- Apply via inline style on the dragged card, not CSS class toggle
- The existing `.drag-charge-zone` class still applies at threshold for the scale bump and charge text

### Acceptance criteria
- [ ] Dragging a card upward shows a smooth color transition in the glow
- [ ] Glow starts shifting toward yellow/amber before reaching the charge zone
- [ ] At charge zone, glow matches current golden intensity
- [ ] Releasing card below threshold returns glow to normal
- [ ] No visual change when card is not being dragged

---

## Sub-step 2: Dynamic Effect Values on Cards

### Current behavior
- Card face shows: `Math.round(card.baseEffectValue * card.effectMultiplier * comboMultiplier)` (CardHand.svelte line 117)
- This includes combo but NOT: chain multiplier, relic bonuses, speed bonus, overclock, ascension shield scaling
- Value does NOT change when card enters charge zone — always shows quick-play value
- Only attack/shield cards and heal/regen mechanics show values (lines 120-128)

### Target behavior
- Card face shows the **actual final value** the card will produce when played in the current mode:
  - **At rest / below charge zone**: Quick-play value with all applicable multipliers
  - **In charge zone**: Charge-correct value with all applicable multipliers
- Values update **reactively** as combo changes, relics activate, etc.
- For mechanics with non-numeric effects (draw cards, apply statuses), show the relevant number:
  - Foresight/Scout/Recycle: show draw count
  - Hex: show poison value
  - Slow: show "Slow" (no number needed)
  - Focus/Double Strike: show buff indicator (no number needed)

### Files affected
- `src/ui/components/CardHand.svelte` — `getEffectValue()` function, add charge-mode variant
- `src/ui/components/CardCombatOverlay.svelte` — pass additional context to CardHand (active relics, enemy state for conditional mechanics)
- `src/data/mechanics.ts` — export `quickPlayValue` / `chargeCorrectValue` for display lookup
- Possibly `src/services/cardEffectResolver.ts` — extract a "preview" function that computes display value without applying effects

### Implementation

#### A. Create a display value calculator
- New export in `cardEffectResolver.ts`: `previewCardValue(card, comboCount, playMode, activeRelicIds, passiveBonuses): number`
- Reuses the same multiplier logic as `resolveCardEffect` but returns only the numeric value, no side effects
- Handles per-mechanic charge values: uses `mechanic.quickPlayValue` vs `mechanic.chargeCorrectValue`

#### B. Update CardHand to use preview values
- Replace `getEffectValue()` with calls to `previewCardValue()`
- For the dragged card in charge zone, call with `playMode: 'charge'`
- For all other cards, call with `playMode: 'quick'`
- Props needed from CardCombatOverlay: `activeRelicIds`, `passiveBonuses` (already available there)

#### C. Visual differentiation for charge value
- When card is in charge zone and value differs from quick-play value, show the charge value with a visual indicator:
  - Slightly larger font or bold
  - Golden/amber text color matching the charge glow
  - Brief scale-pop animation when entering charge zone

### Acceptance criteria
- [ ] Strike card at combo 0 shows "8" at rest, "24" in charge zone
- [ ] Strike card at combo 2 shows "10" at rest (8 × 1.30), "31" in charge zone (24 × 1.30)
- [ ] Block card shows accurate shield values with same logic
- [ ] Relic bonuses (e.g., glass_cannon 1.35x) are reflected in displayed values
- [ ] Utility mechanics (foresight, scout) show draw counts appropriate to play mode
- [ ] Values update live when combo count changes mid-turn
- [ ] Charge value is visually distinct from quick-play value (color/size)

---

## Sub-step 3: Combo Rules Fix

### Current behavior
- **Correct answer**: `comboCount += 1` (turnManager.ts line 767)
- **Wrong answer**: `comboCount = baseComboCount` (reset to 0 or relic base, line 491)
- **Quick play (no question)**: Combo is NOT modified — but the combo multiplier still applies to the card's effect, and the combo counter UI shows the current count, making it LOOK like quick play benefits from and contributes to combo
- **Bug**: Playing cards via quick play does not change combo, but the displayed damage values increase with combo from previous correct answers, which is correct behavior. However the user reports combo INCREASES on quick play — need to verify in turnManager

### Target behavior
- **Correct answer (charge play)**: `comboCount += 1` (unchanged)
- **Quick play (no question)**: `comboCount = max(baseComboCount, comboCount - 1)` — small decay, never below base
- **Wrong answer (charge play)**: `comboCount = max(baseComboCount, comboCount - 2)` — heavier penalty but not full reset
- This creates strategic tension: quick play is safe but costs momentum, charge play risks wrong answers but builds combo

### Balance values (new constants in balance.ts)
```typescript
export const COMBO_DECAY_QUICK_PLAY = 1;    // Lose 1 combo on quick play
export const COMBO_DECAY_WRONG_ANSWER = 2;  // Lose 2 combo on wrong answer
```

### Files affected
- `src/data/balance.ts` — new decay constants
- `src/services/turnManager.ts` — modify combo logic in `playCardAction()`
- `docs/GAME_DESIGN.md` — update combo/chain rules section

### Implementation
- In `playCardAction()`, after determining play mode and correctness:
  - If `playMode === 'quick'`: `comboCount = max(baseComboCount, comboCount - COMBO_DECAY_QUICK_PLAY)`
  - If wrong answer: `comboCount = max(baseComboCount, comboCount - COMBO_DECAY_WRONG_ANSWER)` (replaces full reset)
  - If correct answer: `comboCount += 1` (unchanged)

### Acceptance criteria
- [ ] Correct charge answer increases combo by 1
- [ ] Quick play decreases combo by 1 (minimum: base combo count)
- [ ] Wrong charge answer decreases combo by 2 (minimum: base combo count)
- [ ] Combo counter UI reflects changes immediately
- [ ] Card displayed values update to reflect new combo after each play
- [ ] Combo heal at threshold 6 still works correctly
- [ ] Relic-based base combo (combo_ring) is respected as floor

---

## Verification Gate

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — no new test failures
- [ ] Visual verification via Playwright:
  - Drag card upward → glow transitions gradually
  - Card value changes when entering charge zone
  - Play card via quick play → combo decreases by 1
  - Answer correctly via charge → combo increases by 1
  - Answer wrong via charge → combo decreases by 2
- [ ] `docs/GAME_DESIGN.md` updated with new combo rules and card display behavior
- [ ] `docs/ARCHITECTURE.md` updated if new functions/modules added

## Files Summary

| File | Change |
|------|--------|
| `src/ui/components/CardHand.svelte` | Gradual glow interpolation, dynamic effect values with charge preview |
| `src/ui/components/CardCombatOverlay.svelte` | Pass relic/bonus context to CardHand |
| `src/services/cardEffectResolver.ts` | New `previewCardValue()` export |
| `src/services/turnManager.ts` | Combo decay on quick play, reduced penalty on wrong answer |
| `src/data/balance.ts` | New combo decay constants |
| `src/data/mechanics.ts` | Ensure quickPlayValue/chargeCorrectValue exported for display |
| `docs/GAME_DESIGN.md` | Updated combo rules, card display behavior |
| `docs/ARCHITECTURE.md` | Document previewCardValue if added |
