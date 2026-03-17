# AR-64: Reward Screen — Show Actual Cards + Upgraded Rewards

## Overview
The card reward screen currently shows generic thematic icons (🗡️ "Rust Dagger", 🛡️ "Tower Shield") that don't represent the actual cards being offered. Players must tap to inspect and discover what they're actually getting. This is confusing and breaks the reward loop.

**Goals:**
1. Replace generic icons with actual card visuals (card frame, mechanic name, effect value, domain color)
2. Add floor-based probability of offering pre-upgraded cards in rewards

**Dependencies:** None
**Complexity:** Medium

## Sub-steps

### 1. Redesign altar options to show actual card info
- **File:** `src/ui/components/CardRewardScreen.svelte`
- **What:** Replace the `CARD_TYPE_ICON_POOL` icon system with actual card rendering:
  - Show the card's mechanic name (e.g., "Strike", "Block+", "Scout")
  - Show the card frame image (from `getCardFrameUrl`)
  - Show the card's effect value
  - Show domain color stripe
  - Show AP cost gem
  - Show upgrade badge ("+" suffix) if pre-upgraded
  - Remove the generic `RewardIcon` / `CARD_TYPE_ICON_POOL` system entirely
- **Acceptance:** Each altar option visually represents the actual card being offered, matching the in-hand card style

### 2. Update inspect panel to show card name instead of icon label
- **File:** `src/ui/components/CardRewardScreen.svelte`
- **What:** The inspect panel currently shows `selectedIcon.label` (e.g., "Rust Dagger"). Change to show the card's actual `mechanicName` and card description.
- **Acceptance:** Inspect panel shows real card info: mechanic name, description, AP cost, effect value

### 3. Add floor-based upgraded reward probability
- **File:** `src/services/rewardGenerator.ts`, `src/data/balance.ts`
- **What:** After selecting a reward card, apply a floor-based probability to pre-upgrade it:
  - Floors 1-3: 0% chance
  - Floors 4-6: 10% chance
  - Floors 7-9: 20% chance
  - Floors 10-12: 30% chance
  - Floors 13+: 40% chance
- Add `UPGRADED_REWARD_FLOOR_THRESHOLDS` to balance.ts
- Modify `generateCardRewardOptionsByType` to accept `currentFloor` param and apply upgrades
- Only upgrade cards that `canUpgradeCard()` returns true for
- **Acceptance:** Higher floors increasingly offer pre-upgraded cards. Upgrade indicator visible on reward cards.

### 4. Pass floor number to reward generation
- **File:** `src/services/gameFlowController.ts`
- **What:** Pass `run.floor.currentFloor` to `generateCardRewardOptionsByType` calls
- **Acceptance:** Floor number flows through to upgrade probability logic

## Files Affected
- `src/ui/components/CardRewardScreen.svelte` (major rewrite of altar options)
- `src/services/rewardGenerator.ts` (add floor param, upgrade logic)
- `src/data/balance.ts` (add upgrade probability constants)
- `src/services/gameFlowController.ts` (pass floor to reward generator)

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Reward screen shows actual card frames, names, and values
- [ ] Inspect panel shows correct card details
- [ ] Higher floors produce upgraded rewards at expected rates
- [ ] Cards marked `isUpgraded` display "+" suffix in reward screen
- [ ] Visual test via Playwright screenshot
