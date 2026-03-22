# AR-220: Card Selection & Charge UX

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #17, #18, #19, #21, #22, #24, #37, #38
> **Priority:** P0 — Core card interaction polish
> **Complexity:** Medium (8 discrete UX changes)
> **Dependencies:** AR-218 (card sizing changes in that AR affect positioning here)

---

## Overview

Polish the card selection, pop-up, and charge button UX. Fix multiple interaction issues: cards rise too high when selected, unwanted visual artifacts around selected cards, redundant tutorial text, charge button misplacement, incorrect charge preview values, card description overflow, and mysterious card color changes.

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

## Sub-Steps

### 1. Selected Card Rise — Reduce to Half Card Height
- **What:** When a card is tapped/selected in hand, it currently rises too high. Reduce the rise distance to approximately half the card's height.
- **Current:** Card rises ~80px (per GAME_DESIGN.md).
- **New:** Card rises ~50% of card height (dynamically calculated, not hardcoded px).
- **Acceptance:** Selected card rises noticeably but not excessively. Feels natural.

### 2. Remove Transparent Container Around Selected Cards
- **What:** Selected cards have a semi-transparent container/background behind them. Make this fully invisible (opacity 0 or remove the element).
- **Acceptance:** No visible container/background behind selected cards.

### 3. Remove "Tap Again = Quick Play" Text
- **What:** Remove the instructional text that appears when a card is selected. The tutorial already teaches this.
- **Acceptance:** No "tap again = quick play" or similar instructional text on card selection.

### 4. Charge Button AP Indicator — Reposition Above "E"
- **What:** The "+1 AP" cost indicator next to the CHARGE button should be repositioned to be centered slightly above the letter "E" at the end of "CHARGE".
- **What:** Color coding for the AP cost number:
  - Normal (+1 AP): default/white color
  - Free (+0 AP): the "0" in GREEN (#4ADE80)
  - Expensive (>1 AP): the number in RED (#EF4444)
- **Acceptance:** AP indicator positioned above the E in CHARGE. Color-coded correctly for all cost states.

### 5. Charge Button — Centered Above Selected Card
- **What:** The CHARGE button must be positioned exactly centered horizontally above the currently selected card, NOT in the center of the screen.
- **Current:** CHARGE button appears in the middle of the screen.
- **New:** CHARGE button follows the selected card's horizontal center.
- **Acceptance:** CHARGE button is directly above the selected card, moves with different card positions.

### 6. Charge Preview — Show Correct Charged Values
- **What:** When the quiz panel shows during a charge, the card effect text must show the CHARGED value, not the base value.
- **Bug:** Currently shows "6 block" when it should show "9 block" (with charge multiplier applied).
- **Fix:** The effect preview during charge must multiply by the charge multiplier (1.5x for correct at mastery 0, etc.).
- **Acceptance:** Quiz panel shows the charged effect value (e.g., 9 block, not 6 block). Verified at multiple mastery levels.

### 7. Card Description — Auto-Scale with Padding
- **What:** Card description text sometimes overflows the description frame and isn't vertically centered.
- **Fix:** Implement auto-scaling text that shrinks to fit within the frame, with a small padding margin on all sides.
- **Method:** Use CSS `overflow: hidden` with dynamic font-size adjustment, or `clamp()` based on text length.
- **Acceptance:** No text overflow on any card. Text vertically centered within frame. Small consistent padding.

### 8. Investigate Purple Card / Green Outline — Cursed Card Visual
- **What:** Investigate what causes cards to turn purple with a 1px dark green outline. Determine if this is:
  - Cursed card indicator
  - Mastery level visual
  - Bug / unintended behavior
- **If cursed card:**
  - Remove the purple color change entirely — make cursed cards slightly faded instead
  - Remove the green outline
  - Add ghostly orb particle effect (small translucent orbs floating up from the card)
  - Verify that cursed cards actually deal reduced damage (if not, fix the mechanic)
- **If not cursed card:** Fix whatever visual bug causes this.
- **Acceptance:** Cursed cards are identifiable by subtle fade + ghostly orbs. No random purple/green artifacts. Damage reduction verified.

---

## Files Affected

- `src/ui/combat/CardHand.svelte` — card selection rise distance, transparent container
- `src/ui/combat/CardInteraction.svelte` or equivalent — quick play text removal
- `src/ui/combat/ChargeButton.svelte` or equivalent — positioning, AP indicator
- `src/ui/combat/CardExpanded.svelte` — charge value preview
- `src/ui/combat/QuizPanel.svelte` — charge effect display
- `src/ui/cards/CardFrame.svelte` — description overflow, cursed visual
- `src/ui/cards/CardDescription.svelte` — text auto-scaling
- `src/services/cardEffectResolver.ts` — charge preview calculation
- `src/data/card-types.ts` — cursed card behavior investigation

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Selected card rises ~50% of card height
- [ ] No transparent container behind selected cards
- [ ] No "tap again" instructional text
- [ ] Charge button centered above selected card (not screen center)
- [ ] AP indicator above "E" in CHARGE, color-coded (green for free, red for expensive)
- [ ] Quiz panel shows correct charged values (not base values)
- [ ] No card description overflow on any card type
- [ ] Cursed cards: faded + ghostly orbs, no purple/green artifacts
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: Charge Gesture, Card Anatomy, Cursed Cards
