# AR-114: Visual Inspection — AR-113 Mastery Upgrade System

## Overview
Comprehensive visual and functional inspection of every change from AR-113. Walk through each feature in-game and verify it works as designed.

## Inspection Checklist

### 1. Charge Multiplier Nerf
- [ ] Enter combat, charge-play a card correctly
- [ ] Verify the damage dealt is ~1.5x the quick-play value (not 3x)
- [ ] Quick-play the same card type and compare numbers
- [ ] Confirm charge is still worth doing (1.5x + mastery upgrade reward)

### 2. Mastery Upgrade on Correct Charge
- [ ] Charge-play a card and answer correctly
- [ ] Verify "Upgraded!" popup appears (green text, fades up)
- [ ] Verify the upgrade icon appears on the card (green + icon at level 1)
- [ ] Verify the icon gently bobs up and down (mastery-bob animation)
- [ ] Verify the card's description shows `base+bonus` format (e.g., "Deal 8+2 damage") with the bonus in green
- [ ] Charge the SAME card again next encounter — verify it goes to level 2 (blue icon)
- [ ] Continue upgrading through levels 3 (purple), 4 (orange), 5 (gold)

### 3. Mastery Downgrade on Wrong Charge
- [ ] Charge-play a card and answer incorrectly
- [ ] Verify "Downgraded!" popup appears (red text, fades up)
- [ ] Verify the upgrade icon changes color or disappears (if dropping to level 0)
- [ ] Verify the card's description bonus decreases
- [ ] Confirm downgrade is exactly -1 level (not more)

### 4. Stat Flash Animation
- [ ] On upgrade: verify damage/block numbers flash green briefly
- [ ] On downgrade: verify damage/block numbers flash red briefly
- [ ] On upgrade: verify AP cost flashes green if it changed
- [ ] Flash should be visible but brief (~800ms)

### 5. Level 5 Mastered Card Behavior
- [ ] Get a card to mastery level 5
- [ ] Verify gold + icon with gold glow effect
- [ ] Verify the CHARGE button does NOT appear when card is selected
- [ ] Verify tapping the card twice quick-plays it (no quiz)
- [ ] Verify drag-up also quick-plays (no charge zone)
- [ ] In a boss encounter: verify the card DOES show the charge button and quiz

### 6. Once Per Encounter Limit
- [ ] Upgrade a card in combat (correct charge)
- [ ] In the SAME encounter, charge the same card again — verify it does NOT upgrade a second time
- [ ] Start a NEW encounter — verify the card CAN upgrade again

### 7. Quick Play = No Mastery Change
- [ ] Quick-play a card (no quiz)
- [ ] Verify NO "Upgraded!" or "Downgraded!" popup
- [ ] Verify the mastery level is unchanged

### 8. Echo Cards
- [ ] If an echo card appears, verify it has NO upgrade icon
- [ ] Verify echo cards cannot be charged for mastery (must charge tooltip still works)
- [ ] Verify echo copies the mastery-boosted stats of the source card

### 9. Card Description Format
- [ ] Level 0 card: shows plain number (e.g., "Deal 8 damage")
- [ ] Level 1+ card: shows base+bonus (e.g., "Deal 8+2 damage") with bonus in green
- [ ] Shield cards: same format (e.g., "Gain 6+2 Block")
- [ ] Debuff cards with secondary mastery (thorns): verify secondary bonus shown
- [ ] Verify the green bonus text is readable against the dark parchment area

### 10. Upgrade Icon Colors (All 5 Levels)
- [ ] Level 1: Green + icon
- [ ] Level 2: Blue + icon (hue-rotated)
- [ ] Level 3: Purple + icon
- [ ] Level 4: Orange + icon
- [ ] Level 5: Gold + icon with gold drop-shadow glow
- [ ] All icons bob gently (mastery-bob animation)
- [ ] Icons visible in: hand, reward detail, library (if shown)

### 11. Distractor Count
- [ ] Level 0 card: quiz shows 3 answer options (2 distractors)
- [ ] Level 1+ card: quiz shows 4 answer options (3 distractors)

### 12. Rest Site Study Session
- [ ] Enter a rest node, choose "Study"
- [ ] Verify 3 quiz questions appear from your deck's facts
- [ ] Verify no duplicate facts in the 3 questions
- [ ] Answer correctly — verify the specific card upgrades (not a random card)
- [ ] Answer incorrectly — verify NO downgrade (study only upgrades)
- [ ] After completing, verify you return to the rest room
- [ ] Verify "Study" option is disabled when all cards are at mastery level 5

### 13. Reward Card Detail Popup
- [ ] Pick up a reward card, tap to inspect
- [ ] Verify the popup shows: card name on banner, card type badge, effect text, AP cost
- [ ] Verify Accept/Put Back buttons work
- [ ] If the reward card has mastery (shouldn't for new cards), verify icon shows

### 14. Camp Background
- [ ] On a wider screen/tablet, verify the camp background stretches to the full viewport edges (no black bars)

### 15. Combat Card Layout (Portrait)
- [ ] Verify card fan is positioned lower on screen (closer to bottom)
- [ ] Verify draw pile (green) is on the right, positioned alongside/above card tops
- [ ] Verify discard pile (orange) is on the left, same vertical level as draw pile
- [ ] Verify no overlap between piles and AP orb

### 16. Charge Button
- [ ] Select a card — verify CHARGE button appears directly above it
- [ ] Verify CHARGE button is the same width as the selected card
- [ ] Verify no lightning bolt icon before "CHARGE"
- [ ] Verify "+1 AP" badge is present

### 17. Combo Counter / PERFECT!
- [ ] Quick-play a card without quiz — verify "PERFECT!" does NOT appear
- [ ] Charge-play and answer correctly — verify combo counter shows multiplier
- [ ] Get all charge answers correct in a turn — verify "PERFECT!" shows
- [ ] Get one wrong — verify PERFECT does not show

### 18. Reward Room Card Clicks
- [ ] Enter a reward room (Phaser scene with items on cloth)
- [ ] Verify card rewards are clickable (tap to collect)
- [ ] Verify gold, health vials, relics are also clickable

## Files Changed (AR-113)
- `src/data/card-types.ts` — masteryLevel, masteryChangedThisEncounter
- `src/data/balance.ts` — charge nerf, mastery constants
- `src/services/cardUpgradeService.ts` — mastery upgrade/downgrade logic
- `src/services/cardEffectResolver.ts` — mastery bonus + charge nerf
- `src/services/turnManager.ts` — combat wiring
- `src/services/cardDescriptionService.ts` — base+bonus format
- `src/services/gameFlowController.ts` — rest site mastery study
- `src/services/questionFormatter.ts` — (unchanged, distractor count applied in overlay)
- `src/ui/utils/cardFrameV2.ts` — mastery icon filter/glow
- `src/ui/components/CardHand.svelte` — icon rendering, flash, charge button gate
- `src/ui/components/CardCombatOverlay.svelte` — popups, flash trigger, auto-play, distractors
- `src/ui/components/RewardCardDetail.svelte` — mastery icon + description
- `src/ui/components/StudyQuizOverlay.svelte` — correct fact ID tracking

## Pre-AR-113 Fixes Also Needing Verification
- `src/ui/components/HubScreen.svelte` — camp background full-viewport stretch
- `src/game/scenes/RewardRoomScene.ts` — card reward click hit area
- `src/ui/components/CardHand.svelte` — charge preview threshold, charge button width/position

## Verification Gate
- [ ] All 18 sections above checked
- [ ] No console errors during inspection
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — clean
- [ ] `npx vitest run` — no new failures
