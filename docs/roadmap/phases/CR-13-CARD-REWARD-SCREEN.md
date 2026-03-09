# CR-13: Card Reward Screen

> Phase: P1 — Core Systems Completion
> Priority: MEDIUM
> Depends on: CR-FIX-07 (Domain/type decoupling), CR-FIX-08 (Card mechanics pool)
> Estimated scope: S

After winning a combat encounter, present the player with a choice of 3 cards to add to their deck. Each card shows its mechanic, domain, tier, and effect value. This is the primary deck-building moment in the roguelite loop — it creates agency over future combat strategy and learning direction.

## Design Reference

From GAME_DESIGN.md Section 7 (Run Structure):

> After each encounter victory, players earn a card reward.

Standard STS pattern: 3 cards offered, pick 1 (or skip). Cards come from the run pool — facts allocated to this run but not yet in the active deck.

From GAME_DESIGN.md Section 3 (Domain/Type Decoupling):

> Run pool of 120 facts. Player sees ~50-60 per run. Card reward lets player grow the active deck with new facts.

## Implementation

### Data Model

**Add `'cardReward'` to `GameFlowState`** in `src/services/gameFlowController.ts`:

```typescript
export type GameFlowState =
  | 'idle' | 'domainSelection' | 'combat' | 'roomSelection'
  | 'mysteryEvent' | 'restRoom' | 'treasureReward' | 'bossEncounter'
  | 'retreatOrDelve' | 'cardReward'
  | 'runEnd'
```

**Add store** in `src/services/gameFlowController.ts`:

```typescript
export const activeCardRewardOptions = writable<Card[]>([]);
```

### Logic

**Generate reward options** — Create `src/services/rewardGenerator.ts`:

```typescript
import type { Card } from '../data/card-types';

/**
 * Generate card reward options from the run pool.
 * Excludes cards already in the active deck, Tier 3 facts, and Echo cards.
 */
export function generateCardRewardOptions(
  runPool: Card[],
  activeDeckFactIds: Set<string>,
  count: number = 3,
): Card[] {
  const eligible = runPool.filter(c =>
    !activeDeckFactIds.has(c.factId) &&
    c.tier !== '3' &&
    !c.isEcho
  );

  // Shuffle and take `count`
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

**Handle card selection** — New function `onCardRewardSelected()`:

```typescript
export function onCardRewardSelected(card: Card): void {
  // Add selected card to top of draw pile
  const deck = get(activeTurnState)?.deck;
  if (deck) {
    deck.drawPile.unshift(card);
  }
  // Transition to room selection (or retreat screen if boss floor)
  proceedAfterReward();
}
```

**Handle skip:**

```typescript
export function onCardRewardSkipped(): void {
  proceedAfterReward();
}
```

**Flow integration** — Modify `onEncounterComplete()`:

- On victory: transition to `'cardReward'` instead of directly to room selection
- After card reward (select or skip): check if boss floor → retreat/delve, else → room selection
- On defeat: skip card reward, go to `'runEnd'`

### UI

**New component `src/ui/components/CardRewardScreen.svelte`:**

```
+------------------------------+
|         VICTORY!             |
|   Choose a card to add       |
|   to your deck               |
|                              |
|  +--------+ +--------+ +--------+
|  | Card 1 | | Card 2 | | Card 3 |
|  |  ATK   | |  SHD   | |  HEL   |
|  | Strike | | Block  | | Rest.  |
|  | 8 dmg  | | 6 blk  | | 5 HP   |
|  |  **    | |  *     | |  ***   |
|  | [Sci]  | | [Hist] | | [Art]  |
|  +--------+ +--------+ +--------+
|                              |
|        [ Skip ]              |
+------------------------------+
```

Props:
- `options: Card[]` — 1-3 card options
- `onselect: (card: Card) => void`
- `onskip: () => void`

Each reward card shows:
- Card type icon and label (e.g., sword icon + "Attack")
- Mechanic name (e.g., "Strike", "Multi-Hit", "Thorns")
- Effect value (e.g., "8 dmg", "3x3 dmg", "4 blk + 2 reflect")
- Difficulty stars (1-3, from fact's `baseDifficulty`)
- Domain color tint and label (e.g., "[Science]" with blue tint)
- Tier indicator: Tier 1 = no badge, Tier 2a = silver border, Tier 2b = silver+glow

Card selection interaction:
1. Tap a card → card enlarges, "Add to Deck" button appears below it
2. Tap "Add to Deck" → card flies upward off-screen, transition to next screen
3. Tap another card → deselects current, selects new
4. Tap same card again → deselects it

Skip button:
- Below the cards, centered
- Muted/gray styling: "Skip" text
- No confirmation needed — immediate transition

### System Interactions

- **Deck manager:** Selected card added to top of draw pile via `drawPile.unshift(card)`.
- **Run pool:** Selected card is "consumed" (removed from future reward pools — track by factId).
- **Room selection:** After card reward, room selection shows for next encounter.
- **Boss encounters:** Boss victories also offer card rewards (before retreat/delve screen).
- **Treasure rooms:** May also invoke this component (free card, no combat required).
- **Echoes (CR-12):** Echo cards never appear as rewards.
- **Mastery Trial cards:** May appear as rewards if fact qualifies for trial.
- **Retreat/Delve (CR-10):** On boss floor: card reward → retreat/delve → (room selection if delve).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Fewer than 3 cards available in pool | Show as many as available (1 or 2). If 0, skip reward screen entirely. |
| All remaining pool cards are Tier 3 | No cards to offer. Skip reward screen. |
| Player taps Skip | No card added. Proceed to next screen. |
| Card reward after boss on segment boundary | Show card reward FIRST, then retreat/delve screen. |
| Same fact appears as reward in consecutive encounters | Allowed. Each encounter generates fresh random selection. |
| Player closes app during card reward | On resume, show card reward screen again with same options (persist options). |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/services/rewardGenerator.ts` | generateCardRewardOptions() |
| Create | `src/ui/components/CardRewardScreen.svelte` | 3-card selection UI |
| Modify | `src/services/gameFlowController.ts` | Add 'cardReward' state, route after combat victory |
| Modify | `src/CardApp.svelte` | Route to CardRewardScreen |
| Modify | `src/services/deckManager.ts` | addCardToDeck() function |
| Create | `tests/unit/rewardGenerator.test.ts` | Unit tests for reward generation filtering |

## Done When

- [ ] After combat victory, 3 card options displayed (not immediate room selection)
- [ ] Each card shows: type icon, mechanic name, effect value, difficulty stars, domain tint
- [ ] Tapping a card selects it (enlarges, shows "Add to Deck" button)
- [ ] Confirming adds card to draw pile and transitions to next screen
- [ ] Skip button bypasses reward, transitions to next screen
- [ ] Cards drawn from run pool, excluding active deck cards
- [ ] Tier 3 and Echo cards excluded from rewards
- [ ] If <3 eligible cards, show fewer. If 0, skip screen entirely.
- [ ] Card reward appears before retreat/delve screen on boss floors
- [ ] Selected cards tracked — not offered again in same run
