# AR-115: Treasure Room Relic Rewards, Descent Background, and Dead Code Cleanup

## Overview

Three changes that improve room identity and add a meaningful treasure room experience:

1. **Treasure Room overhaul** — Treasure nodes show the RewardRoomScene (rock/cloth display) with 3 unlocked relics to choose from, using the treasure background
2. **Bonus relic on card rewards** — 50% chance per floor, a bonus relic appears alongside card choices on the post-combat reward screen
3. **Descent background for retreat-or-delve** — Replace crossroads background with descent background on the RetreatOrDelve screen
4. **Dead code cleanup** — Remove unused RoomSelection.svelte + hallway background references

**Dependencies**: RewardRoomScene (AR-65/66/67/68/92), character level relic unlocks (AR-112), backgroundManifest.ts
**Complexity**: Medium
**Risk**: Low — treasure room uses existing RewardRoomScene, background swap is trivial

---

## Sub-step 1: Treasure Room — 3 Relic Choices

Currently treasure nodes give +15 gold and open the card reward screen. Replace with a dedicated relic choice experience.

### 1a. Change treasure node handler in gameFlowController.ts

**File**: `src/services/gameFlowController.ts`

In the `case 'treasure':` block (~line 1666), replace the current logic:
```typescript
// OLD:
case 'treasure':
  {
    const treasureRun = get(activeRunState);
    if (treasureRun) {
      treasureRun.currency += 15;
      treasureRun.floor.lastSlotWasEvent = true;
      activeRunState.set(treasureRun);
    }
  }
  openCardReward();
  return;
```

With:
```typescript
case 'treasure':
  openTreasureRoom();
  return;
```

### 1b. Create openTreasureRoom() function

Add a new function in `gameFlowController.ts`:

```typescript
/**
 * Opens a treasure room with 3 relic choices from the player's unlocked pool.
 * Uses the RewardRoomScene with the treasure background.
 * Falls back to gold reward if no eligible relics remain.
 */
function openTreasureRoom(): void {
  const run = get(activeRunState);
  if (!run) return;

  // Mark as event room for flow tracking
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);

  // Build relic pool from character-unlocked relics, excluding already-held
  const pool = buildRelicPool();

  if (pool.length === 0) {
    // Fallback: no relics available, give gold instead
    run.currency += 25;
    activeRunState.set(run);
    openCardReward();
    return;
  }

  // Pick 3 random relics (or fewer if pool is small)
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, Math.min(3, shuffled.length));

  // Use the existing relic choice reward room flow
  openRelicChoiceRewardRoom(choices, false);
}
```

### 1c. Set treasure background on RewardRoomScene for treasure rewards

The RewardRoomScene already has background support. When opening for treasure rewards, pass a flag or background path so it uses the treasure background instead of the default reward cave.

In `rewardRoomBridge.ts`, check if we can pass a background URL. If the scene supports it, pass `getRandomRoomBg('treasure')` as the background for treasure room rewards.

If the scene doesn't support custom backgrounds yet, add an optional `backgroundUrl` field to `RewardRoomData` and load it in `RewardRoomScene.create()`.

**Acceptance criteria**:
- [ ] Treasure map nodes open RewardRoomScene with 3 relic choices
- [ ] Relics are drawn from the character's unlocked pool, excluding already-held relics
- [ ] Player picks one relic, the other two are dismissed
- [ ] If no relics available, falls back to +25 gold and card reward
- [ ] Treasure background is displayed behind the reward scene

---

## Sub-step 2: Bonus Relic on Post-Combat Card Rewards

50% chance per floor, a relic item appears alongside the card choices on the post-combat reward screen (RewardRoomScene on the rock/cloth display).

### 2a. Add relic-on-reward logic in gameFlowController.ts

In the `openCardReward()` function (or wherever rewards are assembled for the RewardRoomScene), add:

```typescript
// 50% chance per floor to include a bonus relic in the card reward
// Only triggers once per floor (track via run state)
if (!run.floor.bonusRelicOfferedThisFloor && Math.random() < 0.5) {
  const pool = buildRelicPool();
  if (pool.length > 0) {
    const bonusRelic = pool[Math.floor(Math.random() * pool.length)];
    rewards.push({ type: 'relic', relic: bonusRelic });
    run.floor.bonusRelicOfferedThisFloor = true;
    activeRunState.set(run);
  }
}
```

### 2b. Add `bonusRelicOfferedThisFloor` to floor state

In the floor state type (likely in `src/data/card-types.ts` or wherever `FloorState` is defined), add:
```typescript
bonusRelicOfferedThisFloor?: boolean
```

Reset it to `false` when advancing to a new floor.

**Acceptance criteria**:
- [ ] ~50% of floors include a bonus relic on the card reward screen
- [ ] The relic appears on the rock/cloth alongside cards and gold
- [ ] Only one bonus relic per floor (flag prevents double-offering)
- [ ] Relic comes from the unlocked pool, excluding held relics
- [ ] Flag resets when advancing to the next floor

---

## Sub-step 3: Descent Background for Retreat-or-Delve

### 3a. Update RetreatOrDelve.svelte

**File**: `src/ui/components/RetreatOrDelve.svelte`

Change:
```typescript
const bgUrl = getRandomRoomBg('crossroads')
```
to:
```typescript
const bgUrl = getRandomRoomBg('descent')
```

**Acceptance criteria**:
- [ ] Retreat-or-delve screen shows the descent background
- [ ] No visual regressions

---

## Sub-step 4: Dead Code Cleanup

### 4a. Remove RoomSelection.svelte

**File**: `src/ui/components/RoomSelection.svelte` — DELETE

This component is never navigated to (`currentScreen` is never set to `'roomSelection'` in active code). The dungeon map replaced it entirely.

### 4b. Remove RoomSelection from CardApp.svelte

Remove the import and the `{#if $currentScreen === 'roomSelection'}` block from `src/CardApp.svelte`.

### 4c. Remove hallway background references

In `src/data/backgroundManifest.ts`:
- Remove `ROOM_HALLWAY` array
- Remove `'hallway'` from the `getRandomRoomBg` type union
- Remove `ROOM_CROSSROADS` array (no longer used — descent replaces it)
- Remove `'crossroads'` from the `getRandomRoomBg` type union

### 4d. Update GAME_DESIGN.md

Update treasure node description to reflect the new relic-choice behavior. Remove any references to `RoomSelection` or hallway backgrounds.

**Acceptance criteria**:
- [ ] RoomSelection.svelte deleted
- [ ] CardApp.svelte no longer imports or renders RoomSelection
- [ ] backgroundManifest.ts no longer exports hallway or crossroads
- [ ] No typecheck errors from removed references
- [ ] GAME_DESIGN.md reflects treasure room changes

---

## Files Affected

| File | Change |
|------|--------|
| `src/services/gameFlowController.ts` | Treasure room handler, bonus relic logic |
| `src/ui/components/RetreatOrDelve.svelte` | Background swap to descent |
| `src/ui/components/RoomSelection.svelte` | DELETE |
| `src/CardApp.svelte` | Remove RoomSelection import/render |
| `src/data/backgroundManifest.ts` | Remove hallway/crossroads, keep descent |
| `src/data/card-types.ts` (or FloorState type) | Add `bonusRelicOfferedThisFloor` |
| `src/services/rewardRoomBridge.ts` | Optional treasure background support |
| `docs/GAME_DESIGN.md` | Update treasure node description |

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes
- [ ] Treasure nodes on dungeon map open relic choice (3 relics on rock/cloth)
- [ ] Bonus relic appears on ~50% of post-combat reward screens
- [ ] Retreat-or-delve shows descent background
- [ ] No console errors
- [ ] RoomSelection is fully removed with no stale references
