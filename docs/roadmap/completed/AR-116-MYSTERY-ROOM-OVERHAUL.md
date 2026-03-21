# AR-116: Mystery Room Overhaul — Memorable Events, Floor Scaling, and Background Fixes

## Overview

The mystery room is currently the weakest room in the game. Five events, most trivially boring ("Empty Chamber — nothing happens"). This AR transforms mystery rooms into unpredictable, memorable narrative moments without breaking progression balance.

**Design philosophy**: Mystery rooms are **spicy side dishes, not the main course.** They add flavor and unpredictability but never outclass combat rewards, shops, or rest sites. The "best case" mystery event is roughly equal to a good combat reward — not better. Higher floors bring more *interesting* and *dangerous* events, not more *powerful* ones.

**Balance rules**:
- **No free relics** from narrative events. Relics come from bosses, elites, and treasure rooms only.
- **Single card upgrade max** per event. Rest site study upgrades cards — mystery shouldn't do it better for free.
- **Heals capped at 15-20% max HP.** Rest sites heal 30% — mystery rooms never outclass rest.
- **Late-game events are weirder and riskier, not more rewarding.** The fun is the gamble, not the payout.
- **Combat mystery events give NO post-combat card reward** — the fight itself is the event.
- **Currency gains capped at 25-40 gold.** Shops sell cards for 50-75g — mystery shouldn't fund full purchases trivially.

**Additionally**: Fix all broken room backgrounds (rest, shop, mystery, treasure, descent all have wrong file paths).

**Dependencies**: floorManager.ts, MysteryEventOverlay.svelte, backgroundManifest.ts, gameFlowController.ts
**Complexity**: High (25+ events, new effect types, floor scaling)

---

## Sub-step 0: Fix ALL Room Backgrounds

### The Bug

`getRandomRoomBg()` returns paths like `/assets/backgrounds/rooms/mystery/portrait.webp`, but the actual files are named `mystery-arcane-01.webp`, `rest-campfire-01.webp`, etc. No room has `portrait.webp` or `landscape.webp` files. **Every room background is broken.**

### The Fix

Change `getRandomRoomBg()` back to picking a random file from the pool arrays (which still exist in backgroundManifest.ts for rest, shop, mystery, treasure, descent). The function should use the existing pool arrays, not construct orientation-based paths.

```typescript
export function getRandomRoomBg(
  roomType: 'rest' | 'shop' | 'mystery' | 'treasure' | 'descent'
): string {
  switch (roomType) {
    case 'rest': return pickRandom(ROOM_REST)
    case 'shop': return pickRandom(ROOM_SHOP)
    case 'mystery': return pickRandom(ROOM_MYSTERY)
    case 'treasure': return pickRandom(ROOM_TREASURE)
    case 'descent': return pickRandom(ROOM_DESCENT)
  }
}
```

Do the same for `getRandomScreenBg` if it has the same bug.

**Files**: `src/data/backgroundManifest.ts`

**Acceptance criteria**:
- [ ] All 5 room types display actual background images
- [ ] No 404s for room backgrounds in console

---

## Sub-step 1: Expand MysteryEffect Types

Add to the `MysteryEffect` union in `floorManager.ts`:

```typescript
export type MysteryEffect =
  | { type: 'heal'; amount: number }
  | { type: 'damage'; amount: number }
  | { type: 'freeCard' }
  | { type: 'nothing'; message: string }
  | { type: 'choice'; options: Array<{ label: string; effect: MysteryEffect }> }
  // NEW TYPES:
  | { type: 'currency'; amount: number }
  | { type: 'maxHpChange'; amount: number }
  | { type: 'upgradeRandomCard' }
  | { type: 'removeRandomCard' }
  | { type: 'combat' }
  | { type: 'cardReward' }
  | { type: 'healPercent'; percent: number }
  | { type: 'transformCard' }
```

Note: `quizChallenge`, `relic`, and `statusEffect` types from the original AR are **removed** — too complex for this pass and relics are banned from mystery events per balance rules.

**Files**: `src/services/floorManager.ts`

---

## Sub-step 2: The Event Pool — 25+ Events, Floor-Scaled

### Balance Ceiling Reference
| Source | Reward |
|--------|--------|
| Combat win | 3 card choices (pick 1) + gold |
| Rest site | 30% HP heal OR 1 upgrade OR 1 remove |
| Shop | Buy cards/relics with gold |
| Treasure room | 3 relic choices (pick 1) |
| **Mystery ceiling** | **Comparable to rest site at best** |

### Tier 1: Floors 1+ (Always Available) — Simple & Safe

```
1. "The Reading Nook"
   Effect: upgradeRandomCard
   Description: "A quiet corner with a well-worn book. Reading it sharpens one of your cards."

2. "Scattered Coins"
   Effect: currency(+25)
   Description: "Someone left in a hurry. Their loss is your gain."

3. "The Healing Fountain"
   Effect: healPercent(15%)
   Description: "Crystal-clear water flows from a crack in the wall. It tastes like remembering something you forgot."

4. "The Whispering Shelf"
   Effect: freeCard
   Description: "A book slides off the shelf and into your bag. It seems to want to come with you."

5. "Dust and Silence"
   Effect: nothing("The desk is still warm. Whoever was here left no clues.")
   Description: "An abandoned study. Papers scattered, ink still wet. But whoever was here is long gone."

6. "The Lost Notebook"
   Choice: "Read it carefully" -> upgradeRandomCard | "Stuff it in your bag" -> freeCard
   Description: "A leather notebook lies open. The handwriting is frantic but brilliant."

7. "Lost and Found"
   Effect: currency(+15) + heal(5)
   (Implemented as choice with single option "Take it" -> currency+heal, or just a compound effect)
   Description: "A basket of lost things — some coins, a bandage, half a sandwich. Better than nothing."
```

### Tier 2: Floors 3+ — Risk/Reward Choices

```
8. "The Strict Librarian"
   Choice: "Return a card" -> removeRandomCard + heal(15) | "Refuse" -> damage(12)
   Description: "A ghostly librarian blocks your path. 'Return what you've borrowed,' she hisses, 'or pay the fine.'"

9. "Knowledge Tax"
   Choice: "Pay 30 gold" -> healPercent(20%) | "Pay with blood" -> damage(12) + currency(+40) | "Refuse" -> nothing
   Description: "A toll booth carved into the stone. 'Knowledge has a price,' reads the sign."

10. "The Copyist's Workshop"
    Effect: transformCard
    Description: "Rows of desks, each with a scribe frantically copying. One of your cards catches their eye and they 'improve' it."

11. "Strange Mushrooms"
    Choice: "Eat one" -> 60% healPercent(15%) / 40% damage(15) | "Ignore them" -> nothing
    Description: "Bioluminescent mushrooms pulse with an inviting glow. They smell like answers."

12. "Ambush!"
    Effect: combat (regular enemy, NO post-combat reward)
    Description: "The room seemed empty until the books started moving. Something is very much alive in here."

13. "The Donation Box"
    Choice: "Donate 20 gold" -> maxHpChange(+3) | "Shake it" -> currency(+10) | "Leave it" -> nothing
    Description: "A box labeled 'For the Preservation of Knowledge.' It jingles when shaken."

14. "The Gambler's Tome"
    Choice: "Open it (risk 15 HP)" -> 50% upgradeRandomCard / 50% damage(15) | "Walk away" -> nothing
    Description: "A tome bound in shuffled cards. Opening it could be enlightening — or painful."
```

### Tier 3: Floors 6+ — Higher Stakes, Same Ceiling

```
15. "The Burning Library"
    Choice: "Rush in (lose 15 HP)" -> upgradeRandomCard + freeCard | "Watch it burn" -> nothing
    Description: "Fire crawls across the shelves. You could save something if you're fast enough."

16. "The Mirror Scholar"
    Effect: combat (elite-tier enemy, NO post-combat reward)
    Description: "A full-length mirror in an otherwise empty room. Your reflection smiles. You didn't."

17. "The Merchant of Memories"
    Choice: "Trade 8 max HP for a card upgrade" -> maxHpChange(-8) + upgradeRandomCard | "Trade 15 HP for a free card" -> damage(15) + freeCard | "Decline" -> nothing
    Description: "An ancient merchant sits cross-legged. 'I don't deal in gold,' they say. 'Only vitality.'"

18. "Cache of Contraband"
    Choice: "Read them (risky)" -> freeCard + damage(10) | "Take one safely" -> freeCard | "Report them" -> currency(+30)
    Description: "Books with red 'BANNED' stamps. They vibrate with forbidden knowledge."

19. "The Wishing Well"
    Choice: "Toss 10 gold" -> 33% healPercent(20%) / 33% upgradeRandomCard / 34% nothing("The well swallows your coin. Silence.") | "Save your gold" -> nothing
    Description: "A deep shaft in the floor, coins glittering at the bottom. 'Toss a coin to your scholar.'"

20. "The Study Group"
    Effect: upgradeRandomCard (just 1, not multiple)
    Description: "Four ghostly students huddle around a desk. 'Sit down,' one says. The study session is surprisingly productive."
```

### Tier 4: Floors 9+ — Dramatic & Dangerous (Rewards Stay Modest)

```
21. "The Final Wager"
    Choice: "Bet half your current HP" -> 50% healPercent(20%) + currency(+30) / 50% damage(half current HP) | "No deal" -> nothing
    Description: "A figure shuffles a single card. 'Your health against my prize. Fifty-fifty. Interested?'"

22. "The Purge"
    Effect: removeRandomCard + maxHpChange(+3)
    Description: "A stone altar with a sacrificial flame. The fire burns away your weakest knowledge — and something stronger fills the gap."

23. "The Recursion"
    Choice: "Share knowledge" -> upgradeRandomCard | "Take their supplies" -> healPercent(15%) + currency(+20) | "Walk away" -> nothing
    Description: "A figure in familiar armor sits exhausted against the wall. It's you — from a run that didn't make it this far."

24. "The Eraser Storm"
    Effect: removeRandomCard + removeRandomCard + healPercent(15%)
    Description: "A white mist rolls in, dissolving everything it touches. Two of your cards dissolve — but the mist is strangely restorative."

25. "Ambush! (Elite)"
    Effect: combat (elite-tier enemy, NO post-combat reward)
    Description: "You should have known this room was too quiet."

26. "The Desperate Bargain"
    Choice: "Sacrifice 10 max HP" -> removeRandomCard + removeRandomCard + healPercent(20%) | "Keep your strength" -> nothing
    Description: "An altar hums with energy. It promises clarity — at a permanent cost."

27. "The Breakthrough"
    Effect: upgradeRandomCard + healPercent(10%)
    Description: "Everything clicks. A connection forms between ideas you never linked before."
```

---

## Sub-step 3: Floor-Scaled Event Selection

### `generateMysteryEvent(floor: number)` logic

```typescript
function generateMysteryEvent(floor: number): MysteryEvent {
  // 20% chance: combat encounter (no reward)
  if (Math.random() < 0.20) {
    return buildCombatMysteryEvent(floor)
  }

  // 10% chance: card reward room
  if (Math.random() < 0.125) {  // 0.125 of remaining 80% = ~10% total
    return {
      id: 'mystery_reward',
      name: 'Hidden Cache',
      description: 'A stash of cards, hidden behind loose bricks.',
      effect: { type: 'cardReward' },
    }
  }

  // 70%: narrative event from tiered pool
  const pool = buildEventPool(floor)
  const idx = Math.floor(Math.random() * pool.length)
  return pool[idx]
}

function buildEventPool(floor: number): MysteryEvent[] {
  const pool = [...TIER_1_EVENTS]  // Always available
  if (floor >= 3) pool.push(...TIER_2_EVENTS)
  if (floor >= 6) pool.push(...TIER_3_EVENTS)
  if (floor >= 9) pool.push(...TIER_4_EVENTS)
  return pool
}
```

### Combat mystery events
- Floors 1-5: regular combat encounter
- Floors 6-8: 50% regular / 50% elite
- Floors 9+: always elite

Combat uses the current act's enemy pool via `getEnemiesForFloorNode()`. After winning, the mystery event resolves with NO card reward — the fight was the event. Player returns to the map.

**Files**: `src/services/floorManager.ts`, `src/services/gameFlowController.ts`

---

## Sub-step 4: Handle New Effect Types in gameFlowController

In the mystery event resolution handler, add cases for new effect types:

- `currency`: `run.currency += amount` (clamp to 0 minimum)
- `maxHpChange`: `run.playerMaxHP += amount`, clamp `run.playerHP` to new max
- `upgradeRandomCard`: pick a random non-max-mastery card in deck, increase mastery level by 1
- `removeRandomCard`: pick a random card and remove from deck (skip if deck <= 5 cards)
- `combat`: transition to combat encounter with appropriate enemy
- `cardReward`: call `openCardReward()`
- `transformCard`: pick a random card, change its `cardType` to a different random type
- `healPercent`: heal `Math.round(percent/100 * run.playerMaxHP)` HP

For probabilistic choices (e.g. "50% heal / 50% damage"), resolve the probability at event generation time — the event the player sees should already have its outcome determined. The description should hint at the risk but the effect should be concrete.

**Files**: `src/services/gameFlowController.ts`

---

## Sub-step 5: Update MysteryEventOverlay.svelte

The overlay needs to handle new effect types gracefully:

- `choice` events: already supported (choice buttons)
- `combat` effect: show "Prepare for battle!" message, then transition to combat on Continue
- `cardReward` effect: show "You found something!" then transition to card reward on Continue
- Simple effects (heal, damage, currency, etc.): show description and Continue button (already works)

Icons are optional — not every event needs one. Fall back gracefully if no icon exists (already has emoji fallback).

**Files**: `src/ui/components/MysteryEventOverlay.svelte`

---

## Sub-step 6: Thread Floor Number to generateMysteryEvent

Current signature: `generateMysteryEvent()` (no args)
New signature: `generateMysteryEvent(floor: number)`

Find all call sites and pass `run.floor.currentFloor`.

**Files**: `src/services/floorManager.ts`, `src/services/gameFlowController.ts`

---

## Files Affected

| File | Change |
|------|--------|
| `src/data/backgroundManifest.ts` | Fix `getRandomRoomBg()` to use pool arrays |
| `src/services/floorManager.ts` | Expand MysteryEffect types, 27 events in 4 tiers, floor-scaled selection |
| `src/services/gameFlowController.ts` | Handle new effect types, thread floor number, combat mystery flow |
| `src/ui/components/MysteryEventOverlay.svelte` | Support combat/cardReward transitions, graceful icon fallback |
| `docs/GAME_DESIGN.md` | Update mystery room documentation |

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` passes
- [ ] All 5 room backgrounds display correctly (no 404s)
- [ ] Mystery rooms on floors 1-2 only show Tier 1 events
- [ ] Mystery rooms on floors 9+ can show Tier 4 events
- [ ] ~20% of mystery rooms trigger combat (no card reward after)
- [ ] ~10% of mystery rooms trigger card rewards
- [ ] Choice events display multiple buttons
- [ ] Currency, heal, damage, maxHP, upgrade, remove, transform effects all work
- [ ] No single mystery event grants a relic
- [ ] No single mystery event heals more than 20% max HP
- [ ] No single mystery event upgrades more than 1 card
- [ ] No console errors during mystery event flow
