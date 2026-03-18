# AR-92: Relic Reward on Cloth + Anytime Relic Swap

## Overview

Two changes:

1. **Relic choose-1-of-3** (boss/elite reward) uses the RewardRoomScene cloth display instead of the flat `RelicRewardScreen.svelte` modal. Relics hover on the cloth as icons. Click one → detail panel with Accept/Leave. Accept → others wither away. Skip via Continue button.

2. **Anytime relic swap** — when relic slots are full, tapping the relic tray (in combat or hub) lets you sell an equipped relic to free a slot. Currently the swap only triggers when a new relic is offered. The new behavior: player can proactively manage relics anytime.

## Part 1: Relic Reward on Cloth

### Current Flow
1. Boss/elite defeated → `gameFlowState = 'relicReward'` → `RelicRewardScreen.svelte` renders
2. Player taps one of 3 relic cards → double-tap to confirm → `onRelicRewardSelected(relic)`
3. Slot check → add or swap → proceed to card reward

### New Flow
1. Boss/elite defeated → `gameFlowState = 'relicReward'` → open `RewardRoomScene` with 3 relic items
2. Relics appear on cloth as hovering icons (existing relic rendering in RewardRoomScene)
3. Player taps a relic → detail panel slides in (name, rarity, description, icon) with Accept/Leave
4. **Accept** → relic collected with particle burst, other 2 relics wither/disintegrate rightward (existing animation)
5. **Leave** → detail panel dismisses, relic stays on cloth (player can pick another)
6. **Continue/Skip** → player can leave without picking any relic
7. After collection or skip → slot check → if full, show RelicSwapOverlay → then proceed to card reward

### Implementation

**File: `src/services/gameFlowController.ts`**
- In the boss relic reward path (around line 1169-1199), instead of:
  ```
  activeRelicRewardOptions.set(choices)
  currentScreen.set('relicReward')
  ```
  Change to open the RewardRoomScene with relic-only items:
  ```
  openRewardRoom(relicRewards, null, null, null, onRelicAccepted, onComplete)
  ```
- The `RewardItem[]` passed to `openRewardRoom` should contain 3 relic items

**File: `src/services/rewardRoomBridge.ts`**
- Ensure `openRewardRoom` can handle relic-only reward sets (no gold, no vials, no cards)
- The `onRelicAccepted` callback already exists and goes through slot enforcement

**File: `src/game/scenes/RewardRoomScene.ts`**
- Relic items on cloth already work (rounded squares with emoji, bobbing, shimmer)
- Clicking a relic already shows a detail panel with Accept/Leave buttons
- Accept already emits `relicAccepted` and disintegrates other items
- **May need**: ensure the detail panel shows the same info as RelicRewardScreen (rarity badge, description, effects, flavor text, curse warning)
- **May need**: add reroll button support if `canReroll` is true

**File: `src/ui/components/CardApp.svelte`**
- Remove or skip the `RelicRewardScreen` rendering when `gameFlowState === 'relicReward'`
- Instead, ensure the Phaser reward room scene is started for relic rewards

**File: `src/ui/components/RelicRewardScreen.svelte`**
- Keep the file (may be used as fallback) but it should no longer be the primary path

### Relic Detail Panel Enhancement (RewardRoomScene)

The current Phaser-drawn relic detail panel (`showRelicDetail`) shows:
- Icon, name, rarity label, description, Accept/Leave buttons

Enhance to also show:
- Individual effects list (if available)
- Flavor text
- Curse description (orange warning)
- Reroll button (if applicable)

This can stay as Phaser graphics (current implementation) or be a Svelte overlay triggered by the scene event. Svelte overlay is cleaner for rich text.

## Part 2: Anytime Relic Swap

### Current Behavior
- Relic swap only happens when a NEW relic is offered and slots are full
- Player cannot proactively sell/discard relics

### New Behavior
- **In combat**: tapping an equipped relic in the RelicTray shows a tooltip. Add a "Sell" button to the tooltip when slots are full (or always, for inventory management).
- **In hub**: tapping the relic tray area (or a dedicated "Manage Relics" button) opens a relic management panel where you can sell relics for gold.

### Implementation

**File: `src/ui/components/RelicTray.svelte`**
- When a relic tooltip is shown, add a "Sell (Xg)" button at the bottom
- Clicking "Sell" → confirmation ("Sell [Name] for Xg?") → sell via `gameFlowController.sellEquippedRelic(id)`
- The sell refund uses existing `RELIC_SELL_REFUND_PCT` (40% of base price)
- After selling, the relic slot frees up and the tray updates

**File: `src/services/gameFlowController.ts`**
- `sellEquippedRelic()` already exists — just needs to be callable from the tray tooltip
- Export it if not already exported

## Acceptance Criteria

- [ ] Boss/elite relic reward uses cloth scene (3 relics on cloth)
- [ ] Click relic on cloth → detail panel with Accept/Leave
- [ ] Accept → others wither away → proceed to card reward (or swap if full)
- [ ] Skip/Continue → no relic taken → proceed
- [ ] Relic tray tooltip has "Sell" button
- [ ] Selling a relic frees the slot and refunds gold
- [ ] Portrait mode: works as before (cloth is already portrait-compatible)
- [ ] Landscape mode: works (RewardRoomScene adapts to landscape)

## Files Affected

| File | Action |
|------|--------|
| `src/services/gameFlowController.ts` | MODIFY (relic reward → reward room) |
| `src/services/rewardRoomBridge.ts` | MODIFY (support relic-only rewards) |
| `src/game/scenes/RewardRoomScene.ts` | MODIFY (enhance relic detail panel) |
| `src/ui/components/RelicTray.svelte` | MODIFY (add sell button to tooltip) |
| `src/CardApp.svelte` | MODIFY (skip RelicRewardScreen rendering) |

## GDD Updates

Update `docs/GAME_DESIGN.md` §16 (Relic System):
- Relic reward now uses reward room cloth display
- Anytime relic selling via tray tooltip
