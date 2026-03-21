# AR-125: Full Run Simulator (Headless)

**Status:** ACTIVE
**Priority:** HIGH
**Complexity:** High (integrating 7+ game systems into headless sim)
**Dependencies:** AR-122 (balance changes), AR-123 (enemy redesigns)
**Source:** User feedback — sim was combat-only with synthetic cards. Need full run simulation with all game systems.

---

## Overview

The headless combat simulator currently runs isolated combat encounters with synthetic cards. It needs to simulate FULL RUNS including: map progression, card rewards + deck building, relics, shops, rest sites, mystery events, gold economy, and act transitions. All using real game code — no reimplementation.

---

## What the sim currently does (combat-only):
- Picks random enemies from act pool
- Runs combat with real turnManager
- Uses real mechanic definitions (strike, block, hex, etc.)
- Tracks per-card play stats
- Heals between encounters (flat %)
- No relics, no rooms, no rewards, no gold, no map

## What it needs to do (full run):
- Generate a real act map (mapGenerator.ts)
- Walk a path through the map
- Handle each node type: combat, elite, boss, shop, rest, mystery, treasure
- Pick up card rewards after combat
- Apply relics (start with starter relic, earn from elites/bosses/treasure)
- Track gold and spend at shops
- Make rest site decisions (heal vs study vs meditate)
- Progress through 3 acts
- Track full run stats

---

## Sub-step 1: Run Structure

Create a `SimRunState` that tracks the full run:

```typescript
interface SimRunState {
  deck: Card[];
  relics: string[];        // relic IDs
  gold: number;
  hp: number;
  maxHp: number;
  currentAct: 1 | 2 | 3;
  currentFloor: number;
  globalTurnCounter: number;
  cardRemovalCount: number; // tracks meditate/shop removal cost
  encountersWon: number;
  cardsRewarded: number;
  relicsAcquired: number;
  shopVisits: number;
  restSiteVisits: number;
  mysteryEvents: number;
}
```

The main loop:
1. Generate act map (using mapGenerator)
2. For each act, walk a path from bottom to top
3. At each node, handle by type
4. After act boss, advance to next act
5. After act 3 boss, run is complete (survived)
6. If HP <= 0 at any point, run ends (defeat)

---

## Sub-step 2: Room Type Handlers

### Combat / Elite / Boss
- Use existing `simulateSingleEncounter()`
- After victory: offer card reward (pick best mechanic for the bot's strategy)
- Elite victory: also award a relic
- Boss victory: award choice of 3 relics + gold

### Shop
- Bot buys the highest-value card it can afford
- Bot buys a relic if affordable and beneficial
- Bot removes a card if deck > 15 cards and can afford removal

### Rest Site
- If HP < 50%: Rest (heal 30%)
- If HP >= 50% and deck has low-mastery cards: Study
- If HP >= 50% and deck > 15: Meditate (remove weakest card)

### Mystery
- Simulate mystery event outcomes using the event probability table
- 70% narrative event (heal/damage/gold/upgrade), 20% combat, 10% card reward

### Treasure
- Award a random relic from the pool

---

## Sub-step 3: Card Reward Bot Logic

After combat, bot gets 3 card choices. Simple heuristic:
- If deck has < 2 attack cards: pick attack
- If deck has < 2 shield cards: pick shield
- If deck has no buff/debuff: pick buff/debuff
- Otherwise: pick the mechanic with highest chargeCorrectValue
- Skip (don't pick) if deck already has 18+ cards

---

## Sub-step 4: Relic Integration

- Start with a random starter relic
- Import relic definitions and apply passive effects
- Track relic triggers during combat (on_encounter_start, on_correct_answer, etc.)
- Award relics from elite/boss/treasure rooms

---

## Sub-step 5: Gold Economy

- Start with 0 gold
- Earn gold from combat (15-30), elite (40-60), boss (80-120)
- Spend at shops: cards (50-140g), relics (100-400g), removal (50g+25g per removal)
- Track total gold earned/spent

---

## Verification Gate

- [ ] Full run simulation completes (3 acts, ~16-18 rooms)
- [ ] All room types handled
- [ ] Relics applied
- [ ] Card rewards modify deck
- [ ] Gold tracked
- [ ] Win rates reasonable across profiles
- [ ] Per-mechanic stats still tracked
- [ ] 1000 runs complete in < 30 seconds
