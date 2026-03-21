# AR-124: AP Economy Tutorial (Onboarding)

**Status:** PENDING
**Priority:** MEDIUM
**Complexity:** Medium
**Dependencies:** None
**Source:** LLM playtest onboarding analysis — AP economy rated #1 confusion point for new players

---

## Overview

New players don't understand the AP economy: base cost vs surcharge, why Charge costs vary, how remaining AP is calculated. The casual gamer agent identified this as the #1 reason players would bounce at turns 2-4. A brief, non-intrusive tutorial during the first 3 turns solves this.

---

## Sub-step 1: First-Turn AP Tooltip

On the player's very first combat turn (ever, tracked via persistent flag), show a brief tooltip near the AP counter:

**Trigger:** First card played in first-ever combat
**Content:** "You have 3 AP per turn. Each card costs AP to play. Strike costs 1 AP — you have 2 AP left."
**Style:** Small floating tooltip, auto-dismiss after 4 seconds or on tap. Non-blocking.
**Implementation:** Check `localStorage` flag `tutorial:apShown`. Show tooltip on first `playCardAction`. Set flag after shown.

**Acceptance criteria:**
- [ ] Tooltip appears on first card play of first-ever combat
- [ ] Shows remaining AP after the play
- [ ] Auto-dismisses after 4 seconds
- [ ] Only shows once (persistent flag)
- [ ] Does not block gameplay

---

## Sub-step 2: First Charge Cost Tooltip

When the player first taps CHARGE (not Free First Charge — that's already labeled "FREE"), show a tooltip explaining the surcharge:

**Trigger:** First time player sees a non-free CHARGE button and taps it
**Content:** "Charging costs +1 extra AP for the quiz. This Strike costs 2 AP total (1 base + 1 charge)."
**Style:** Same floating tooltip style, 5 seconds, non-blocking.
**Implementation:** Check `tutorial:chargeShown` flag. Show on first non-free Charge tap.

**Acceptance criteria:**
- [ ] Tooltip appears on first non-free Charge
- [ ] Explains base + surcharge = total cost
- [ ] Only shows once
- [ ] Does not show for Free First Charge (those already say "FREE")

---

## Sub-step 3: First Quick Play vs Charge Comparison

After the player has seen both Quick Play and Charge in their first run, show a brief comparison:

**Trigger:** Player has done at least 1 Quick Play AND 1 Charge in the same run
**Content:** "Quick Play: safe, 1.0x power. Charge: quiz for 3x power, but costs +1 AP and risks fizzle on new facts."
**Style:** Brief banner at top of screen, 5 seconds, non-blocking.
**Implementation:** Track `hasQuickPlayed` and `hasCharged` flags on run state. Show banner when both are true for the first time.

**Acceptance criteria:**
- [ ] Banner shows after player has done both QP and Charge
- [ ] Concise comparison of the two modes
- [ ] Only shows once per lifetime (persistent flag)
- [ ] Non-blocking

---

## Sub-step 4: Deck Cycle-Speed Indicator on Reward/Meditate UI

**Problem:** "More cards = slower cycle" is real but not felt. Players add cards without understanding the tradeoff.

**Fix:** On the card reward screen and Meditate overlay, show the current deck cycle speed and what it would be after the action:

**Card Reward:** "Deck: 12 cards (cycles every 2.4 turns) → 13 cards (2.6 turns)"
**Meditate:** "Deck: 12 cards (cycles every 2.4 turns) → 11 cards (2.2 turns)"

**Style:** Small text below the card options / meditate card list. Neutral color, not alarming.
**Formula:** `cycleSpeed = deckSize / 5` (5 cards drawn per turn)

**Acceptance criteria:**
- [ ] Cycle speed shown on card reward screen
- [ ] Cycle speed shown on Meditate overlay
- [ ] Shows before/after comparison
- [ ] Accurate math (deck size / 5)
- [ ] Subtle visual (not distracting)

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Tooltips appear correctly on first play (test with fresh localStorage)
- [ ] Tooltips don't reappear after dismissal
- [ ] Cycle-speed indicator accurate on reward and meditate screens
- [ ] docs/GAME_DESIGN.md updated with tutorial system
