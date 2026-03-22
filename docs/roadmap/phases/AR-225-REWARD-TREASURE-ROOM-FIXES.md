# AR-225: Reward & Treasure Room Fixes

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #32, #40, #42, #43
> **Priority:** P1 — Gameplay-breaking bugs + UX fixes
> **Complexity:** Medium (4 distinct fixes)
> **Dependencies:** AR-220 (card rendering improvements referenced in #43)

---

## Overview

Fix four issues with reward and treasure rooms: auto-skip timeout bug, treasure room giving cards/gold/health instead of relics-only, multi-enemy relic conversion, and reward screen card rendering not matching combat improvements.

---

## User's Exact Words

- **#32:** "When you wait too long to select a reward it automatically seems to skip the reward and go to the map, this is bad!!"
- **#40:** "The reward screen with the stone slab and cloth on it needs to be redone by me, just create an AR that requires me to do that so I can remember. Also, those treasure rooms should NOT give cards, instead only give the relics as pickup option, NO HEALTH NO GOLD. Right now a treasure room seems to give two back to back reward screens. One with relics then one with cards, ONLY do the relics."
- **#42:** "We have some multi-enemy relics, but never any multiple enemies. If there are less than 5, just change what they do based on their lore and something basic but that we haven't seen before, like more cards is more strength, start with block per turn, boosts damage by 50% with hp under 25% etc."
- **#43:** "The cards in the reward room, the floating icons and their popup, don't have the latest improvements to how cards are rendered like we mentioned in our skill, and how we do it during combat."

---

## Sub-Steps

### 1. Fix Reward Auto-Skip Timeout
- **What:** There is a timeout that automatically skips the reward selection and advances to the map if the player doesn't choose quickly enough. REMOVE this timeout entirely.
- **Behavior:** Reward screen stays open indefinitely until the player makes a selection or explicitly skips.
- **Acceptance:** Player can wait on the reward screen as long as they want. No auto-skip.

### 2. Treasure Rooms — Relics Only
- **What:** Treasure rooms currently show two reward screens (relics, then cards). Change to show ONLY the relic selection.
- **Remove:** No card reward after treasure room. No health reward. No gold reward.
- **Keep:** Relic selection only — player picks 1 relic from the offered options.
- **Acceptance:** Treasure rooms show exactly 1 reward screen with relics only. No second screen.

### 3. Stone Slab Redesign — User Action Required
- **What:** Create a reminder/placeholder that the reward screen stone slab + cloth art needs to be redesigned by the user.
- **Action:** Add a TODO note in the reward screen component referencing this requirement.
- **This is NOT a code task — it's an art task for the user.**
- **Acceptance:** TODO note exists in code. User is reminded.

### 4. Multi-Enemy Relics — Convert to Single-Enemy Effects
- **What:** Find all relics that reference multiple enemies or multi-enemy combat. Since the game never has multiple enemies simultaneously, these relics are dead.
- **What:** If there are fewer than 5 such relics, redesign their effects to be single-enemy alternatives that are thematically appropriate:
  - Ideas from user: "more cards is more strength, start with block per turn, boosts damage by 50% with hp under 25% etc."
  - Each redesigned relic should have a unique effect not already covered by existing relics
  - Base the new effect on the relic's existing lore/name
- **If more than 5:** Flag for separate AR.
- **Acceptance:** No relics reference multi-enemy scenarios. All redesigned relics have unique, functional effects.

### 5. Reward Room Cards — Latest Rendering
- **What:** Cards displayed in the reward room (card selection after combat) must use the same rendering pipeline as combat cards.
- **Includes:** Chain border colors, card frame layers, description styling, AP badge, mastery indicators.
- **Acceptance:** Reward room cards are visually identical to combat cards. No outdated rendering.

### 6. Reward Room Gold Icon Fix
- **What:** There's a gold/coin icon in the reward room that has a single coin way at the bottom of the PNG — this is an error from when it was a spritesheet.
- **Fix:** Crop the PNG to remove the stray coin pixel at the bottom.
- **Acceptance:** Gold icon is clean, no stray pixel/coin at the bottom.

---

## Files Affected

- `src/ui/screens/RewardScreen.svelte` — timeout removal, treasure room logic, card rendering
- `src/ui/screens/TreasureRoom.svelte` or equivalent — relics-only flow
- `src/data/relics.ts` — multi-enemy relic redesign
- `src/services/relicEffectResolver.ts` — updated relic effects
- `src/ui/cards/` — card rendering components shared with combat
- `public/assets/ui/` — gold icon fix

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Reward screen has no auto-skip timeout
- [ ] Treasure room shows relics only (no cards, health, or gold)
- [ ] No double reward screen in treasure rooms
- [ ] Multi-enemy relics identified and converted (if <5) with unique effects
- [ ] Reward room cards render identically to combat cards
- [ ] Gold icon has no stray pixel at bottom
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: Treasure Room rewards, relic descriptions
