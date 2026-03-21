# AR-126: Combat UX Audit Fixes

## Overview
Fix all 22 issues identified by the `/ux-review` audit of the combat screen (combat-basic preset, 393x852 iPhone 15 Pro). The audit revealed 3 critical typography failures, 5 high-severity issues, 7 medium, and 7 low. Most critical issues are CSS-only fixes.

**Source:** `data/ux-reviews/combat-basic-393x852.md`
**Complexity:** Medium (mostly CSS/markup, one interaction change)
**Dependencies:** None

---

## Sub-steps

### Phase 1: Critical Typography Fixes (CSS-only)

#### 1.1 Card type label font size
- **File:** `src/ui/components/CardV2Frame.svelte` (or wherever `.v2-card-type` is styled)
- **Change:** Increase `.v2-card-type` fontSize from ~3.77px to minimum **10px**
- **Acceptance:** Card type labels ("ATTACK", "SHIELD") readable at card-in-hand size

#### 1.2 Card effect text font size
- **File:** Same card frame component
- **Change:** Increase `.v2-effect-text` / `.parchment-inner` fontSize from ~8.25px to minimum **11px**
- **Acceptance:** "Deal 8 damage" / "Gain 6 Block" readable at hand size without tapping

#### 1.3 Player HP text font size
- **File:** `src/ui/components/CardCombatOverlay.svelte` (player HP display area)
- **Change:** Increase `.player-hp-text` fontSize from ~9px to minimum **13px**. Expand the player HUD bar height from 20px to at least **36px**
- **Acceptance:** "100/100" clearly readable at bottom of screen

### Phase 2: High-Severity Fixes

#### 2.1 Enemy name contrast
- **File:** `src/ui/components/CardCombatOverlay.svelte`
- **Change:** Change `.enemy-name-header` color from `rgb(156,163,175)` to `rgb(226,232,240)` or whiter. Must achieve 4.5:1 contrast ratio against dark backgrounds.
- **Acceptance:** Enemy name passes WCAG AA contrast

#### 2.2 Card type icons (color-blindness fix)
- **File:** Card frame component
- **Change:** Add a small sword icon for ATTACK cards and shield icon for SHIELD cards (16x16px) in the card header area alongside the type label. This ensures card type is not communicated by color alone.
- **Acceptance:** Card type identifiable without relying on border color

#### 2.3 Player stats HUD redesign
- **File:** `src/ui/components/CardCombatOverlay.svelte`
- **Change:** Expand player HUD to ~40px tall. HP: 14-16px bold white, prominently positioned. Block: 12-14px sky-blue, secondary position. Clear separation between HP number and block value. Fix the inverted hierarchy where block (12px bold) visually outweighs HP (9px regular).
- **Acceptance:** HP is the visually dominant stat in the player HUD. Block is secondary.

#### 2.4 Card overlap — add "lift to select" confirmation
- **File:** `src/ui/components/CardHand.svelte` and interaction handler
- **Change:** First tap on a card should lift and highlight it (scale 1.1, translate Y -20px, z-index boost). A SECOND tap on the lifted card triggers the quiz. Tapping a different card lifts that one instead. This prevents mis-taps on overlapping center cards.
- **Acceptance:** Tapping a card lifts it visually; only a second tap on the SAME card triggers play. Tapping elsewhere or a different card deselects.

#### 2.5 Enemy intent button — convert to non-interactive or relocate
- **File:** `src/ui/components/CardCombatOverlay.svelte`
- **Change:** If the intent badge is informational only, remove button role (make it a div/span). If it opens a detail view, move it closer to the enemy sprite (center-top area) and add a tappable affordance. Currently at x=8,y=12 in top-left corner — unreachable.
- **Acceptance:** Intent info is clearly visible without needing to tap in a hard-to-reach corner

### Phase 3: Medium-Severity Fixes

#### 3.1 End Turn button repositioning
- **File:** `src/ui/components/CardCombatOverlay.svelte`
- **Change:** Move End Turn to bottom-right OR expand to 80%+ width centered at bottom. Current left-aligned position disadvantages 88% right-handed users.
- **Acceptance:** End Turn reachable without cross-screen thumb stretch

#### 3.2 AP orb label
- **File:** `src/ui/components/CardCombatOverlay.svelte`
- **Change:** Add small "AP" label (10-11px) below or inside the AP orb. Add `aria-label="3 Action Points remaining"` (dynamic with current AP value).
- **Acceptance:** New players can identify what the number means

#### 3.3 Card aria-labels
- **File:** `src/ui/components/CardHand.svelte`
- **Change:** Add descriptive aria-labels to each card: `aria-label="Strike: costs 1 AP, deals 8 damage. Card 1 of 5."` with `aria-disabled="true"` when unaffordable.
- **Acceptance:** Screen readers get full card context

#### 3.4 Turn phase indicator
- **File:** `src/ui/components/CardCombatOverlay.svelte`
- **Change:** Add a turn phase badge near the top of the player zone showing "YOUR TURN" on player turn start, "ENEMY ATTACKING" during enemy actions. Brief display (1.5s fade).
- **Acceptance:** Player always knows whose turn it is

#### 3.5 Unaffordable card state
- **File:** `src/ui/components/CardHand.svelte`
- **Change:** When player AP is insufficient for a card's cost, apply `opacity: 0.5` + CSS desaturation filter + greyed cost gem. On tap attempt of unaffordable card, show a brief shake animation.
- **Note:** Check if this is already implemented — the audit used a fresh state with 3 AP and 1-cost cards so couldn't observe this state.
- **Acceptance:** Cards visually disabled when unaffordable, shake on invalid tap

#### 3.6 Card selection feedback before quiz
- **File:** `src/ui/components/CardHand.svelte`
- **Change:** This is effectively the same as 2.4 (lift to select). Ensure the 100-150ms lift animation clearly shows which card was committed before quiz overlay appears.
- **Acceptance:** Player sees which card was selected

#### 3.7 Card hand screen space usage
- **File:** `src/ui/components/CardCombatOverlay.svelte` / `CardHand.svelte`
- **Change:** Consider implementing a collapsed hand mode. SKIP this for now — it's high effort and the current 34% usage is acceptable. Document as a future improvement.
- **Status:** DEFERRED

### Phase 4: Low-Severity Polish

#### 4.1 Pile count labels
- **File:** `src/ui/components/CardCombatOverlay.svelte`
- **Change:** Add 9-10px labels "DRAW" / "DISC" (or small deck/discard icons) near the pile count numbers
- **Acceptance:** New players understand what the numbers mean

#### 4.2 Background contrast backing
- **File:** `src/ui/components/CardCombatOverlay.svelte`
- **Change:** Ensure all floating UI text elements have `rgba(0,0,0,0.6)` or darker backing. The AP orb model is correct — extend to enemy name area, pile counts, and any other un-backed text.
- **Acceptance:** All UI text readable regardless of background art

#### 4.3 Enemy intent affordance
- **File:** If intent badge remains interactive: add subtle rounded border or chevron indicator
- **Acceptance:** If tappable, it looks tappable

#### 4.4 Card name size bump
- **File:** Card frame component
- **Change:** Increase `.v2-mechanic-name` from 11.79px to 13px
- **Acceptance:** Card names readable on center/overlapped cards

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes
- [ ] Playwright screenshot at 393x852 — all text readable
- [ ] Playwright screenshot at 375x667 (iPhone SE) — no truncation
- [ ] Re-run `/ux-review combat` — grade should be B or higher
- [ ] Card overlap: tap center card, confirm correct card lifts
- [ ] HP clearly readable at bottom of screen
- [ ] Card type identifiable without color (icons present)
- [ ] Enemy name passes contrast check visually
- [ ] docs/GAME_DESIGN.md updated if any mechanic behavior changed
