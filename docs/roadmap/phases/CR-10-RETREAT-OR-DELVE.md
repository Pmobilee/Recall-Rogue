# CR-10: Retreat-or-Delve Screen

> Phase: P1 — Core Systems Completion
> Priority: HIGH
> Depends on: CR-FIX-09 (Encounter flow + run termination)
> Estimated scope: M

At segment boundaries (after defeating the floor 3, 6, and 9 bosses), present the player with a strategic choice: retreat to safety (keep all earned rewards) or delve deeper (risk losing a percentage on death). This creates meaningful risk/reward decisions rooted in prospect theory.

## Design Reference

From GAME_DESIGN.md Section 7 (Run Structure):

| Depth | Floors | Boss | On Retreat | On Death |
|-------|--------|------|-----------|----------|
| Shallow | 1-3 | Floor 3: Gate Guardian | Keep 100% | Keep 100% (no penalty) |
| Deep | 4-6 | Floor 6: Magma Wyrm | Keep 100% | Keep 80% |
| Abyss | 7-9 | Floor 9: The Archivist | Keep 100% | Keep 65% |
| Endless | 10+ | Mini-boss every 3 | Keep 100% | Keep 50% |

From GAME_DESIGN.md Section 7 (Retreat-or-Delve Psychology):

> Kahneman & Tversky's prospect theory: loss aversion at ~2x. At 20% risk (Segment 2), most players push. At 50% risk (Endless), only confident players continue. Escalating risk matches escalating reward. Never exceed 50% loss — total wipeout causes quit behavior on mobile.

Key rule: **Retreat = keep 100%. Death penalty only applies on defeat.** The penalty percentages apply to the NEXT segment if the player dies there.

## Implementation

### Data Model

**Add to `src/data/balance.ts`:**

```typescript
/** Reward retention on death, by segment. Retreat always keeps 100%. */
export const DEATH_PENALTY: Record<1 | 2 | 3 | 4, number> = {
  1: 1.0,    // Shallow: no penalty even on death
  2: 0.80,   // Deep: keep 80% on death
  3: 0.65,   // Abyss: keep 65% on death
  4: 0.50,   // Endless: keep 50% on death
};

export const SEGMENT_BOSS_FLOORS = [3, 6, 9];
export const ENDLESS_BOSS_INTERVAL = 3;
```

**Add `'retreatOrDelve'` to `GameFlowState`** in `src/services/gameFlowController.ts`:

```typescript
export type GameFlowState =
  | 'idle' | 'domainSelection' | 'combat' | 'roomSelection'
  | 'mysteryEvent' | 'restRoom' | 'treasureReward' | 'bossEncounter'
  | 'retreatOrDelve'   // NEW
  | 'cardReward'       // NEW (CR-13)
  | 'runEnd'
```

**Update `RunEndData`** in `src/services/runManager.ts`:

```typescript
export interface RunEndData {
  result: 'victory' | 'defeat' | 'retreat'   // 'cashout' renamed to 'retreat'
  floorReached: number
  factsAnswered: number
  accuracy: number
  bestCombo: number
  cardsEarned: number
  duration: number
  rewardMultiplier: number   // NEW: 1.0 for retreat/victory, penalty for death
  currencyEarned: number     // NEW: final currency after multiplier
}
```

### Logic

**Trigger retreat screen** — Modify `onEncounterComplete()` in `gameFlowController.ts`:

- After boss defeat on segment boundary floors (3, 6, 9): set state to `'retreatOrDelve'`
- After boss defeat on endless floors (12, 15, 18...): same retreat screen with segment 4 penalty display
- Non-boss victories: skip to card reward / room selection as normal

**Handle retreat** — New function `onRetreat()`:

```typescript
export function onRetreat(): void {
  // End run with 100% reward retention
  const run = get(activeRunState);
  if (!run) return;
  const endData = endRun(run, 'retreat');
  endData.rewardMultiplier = 1.0;
  endData.currencyEarned = run.currency;
  activeRunEndData.set(endData);
  gameFlowState.set('runEnd');
  currentScreen.set('runEnd');
}
```

**Handle delve** — New function `onDelve()`:

```typescript
export function onDelve(): void {
  // Advance to next floor and show room selection
  const run = get(activeRunState);
  if (!run) return;
  advanceFloor(run.floor);
  activeRunState.set(run);
  gameFlowState.set('roomSelection');
  currentScreen.set('roomSelection');
  activeRoomOptions.set(generateRoomOptions(run.floor.currentFloor));
}
```

**Death penalty** — Modify `endRun()` in `runManager.ts`:

- On `result: 'defeat'`: apply `DEATH_PENALTY[currentSegment]` multiplier to currency
- On `result: 'retreat'`: keep 100%
- On `result: 'victory'` (floor 9 boss beaten + delved through all): keep 100%

### UI

**New component `src/ui/components/RetreatOrDelve.svelte`:**

```
+------------------------------+
|     SEGMENT CLEARED!         |
|                              |
|   "You've conquered the     |
|    Gate Guardian."           |
|                              |
|   Rewards Earned: 150        |
|   Current HP: 65/80          |
|                              |
|  +-------------------------+ |
|  |   RETREAT               | |
|  |   Keep all 150 earned   | |
|  |   Run ends safely       | |
|  +-------------------------+ |
|                              |
|  +-------------------------+ |
|  |   DELVE DEEPER          | |
|  |   Next: Deep Dungeon    | |
|  |   Death = keep 80%      | |
|  |   (120 of 150)          | |
|  +-------------------------+ |
|                              |
|   Difficulty: harder         |
+------------------------------+
```

Props:
- `bossName: string` — name of the defeated boss
- `segment: 1 | 2 | 3 | 4` — current segment (just completed)
- `currency: number` — total earned currency
- `playerHp: number`, `playerMaxHp: number`
- `nextSegmentName: string` — "Deep Dungeon" / "The Abyss" / "Endless Depths"
- `deathPenalty: number` — e.g. 0.80 for segment 2
- `onretreat: () => void`
- `ondelve: () => void`

Visual design:
- Retreat button: green, safe feel, full width, 56dp height
- Delve button: red/amber, danger feel, shows actual currency loss number
- Stats: rewards earned, HP, next segment name, death penalty as actual number
- Risk text: "Enemies are stronger. Timer is shorter."

### System Interactions

- **Run manager:** Death penalty multiplier applied to final currency on defeat.
- **Floor manager:** After delve, `advanceFloor()` called normally.
- **Game flow:** New state `'retreatOrDelve'` between boss defeat and next segment.
- **Card reward (CR-13):** Card reward screen appears BEFORE retreat/delve on boss floors.
- **Room selection:** After delve, shows room selection for next floor.
- **Run end screen:** Shows final reward (with multiplier if died), retreat vs defeat in header.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Player defeats Floor 3 boss with 1 HP | Retreat screen shows 1 HP. No healing between segments. Player can still delve. |
| Player retreats at Segment 1 (Floor 3) | Keep 100% rewards. Run ends. "Expedition Complete" screen. |
| Player dies on Floor 5 (Segment 2) | Keep 80% of earned currency. |
| Player dies on Floor 11 (Segment 4, Endless) | Keep 50% of earned currency. |
| Player retreats at Endless boundary (Floor 12 boss) | Keep 100% of all earned currency. |
| Currency is 0 when retreat/death occurs | No penalty to apply. Show 0 earned. |
| Non-boss floor (no segment boundary) | No retreat screen. Continue to room selection. |
| Floor 9 boss beaten, player delves into Endless | Retreat screen shows 50% death penalty for Endless. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `src/data/balance.ts` | Add DEATH_PENALTY, SEGMENT_BOSS_FLOORS, ENDLESS_BOSS_INTERVAL |
| Modify | `src/services/gameFlowController.ts` | Add 'retreatOrDelve' state, onRetreat(), onDelve() |
| Modify | `src/services/runManager.ts` | Apply death penalty, update RunEndData with rewardMultiplier |
| Create | `src/ui/components/RetreatOrDelve.svelte` | Decision screen UI |
| Modify | `src/CardApp.svelte` | Route to RetreatOrDelve screen |
| Modify | `src/ui/components/RunEndScreen.svelte` | Distinguish retreat from defeat, show reward multiplier |
| Create | `tests/unit/retreatOrDelve.test.ts` | Unit tests for reward calculations, state transitions |

## Done When

- [ ] After beating boss on floor 3, 6, or 9, retreat/delve screen appears
- [ ] Retreat keeps 100% of earned currency and ends run
- [ ] Delve continues to next segment's first floor
- [ ] Death in Segment 2 keeps 80% currency, shown on RunEndScreen
- [ ] Death in Segment 3 keeps 65% currency
- [ ] Death in Segment 4+ keeps 50% currency
- [ ] Retreat screen shows actual currency numbers (not just percentages)
- [ ] Retreat screen shows current HP, next segment name, and risk description
- [ ] Run end screen distinguishes retreat from defeat in header text
- [ ] Endless mode shows retreat option every 3 floors after a mini-boss
- [ ] 'cashout' renamed to 'retreat' in all types and logic
