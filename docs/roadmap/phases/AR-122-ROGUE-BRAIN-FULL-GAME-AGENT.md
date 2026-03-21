# AR-122: Rogue Brain v2 — Full Game Agent

## Overview

Upgrade the RL agent from combat-only to full game loop. The agent must play identically to a real player: choose rooms, pick card rewards, visit shops, rest sites, handle relics (5 slots), retreat/delve decisions, and play at any ascension level.

**Why**: AR-121 only teaches the agent combat card-play. A real player's strategy is 50% between-combat decisions (deck building, pathing, economy). Without these, we can't find issues like "shop is useless," "rest heal is always better than upgrade," or "optimal path always avoids mystery rooms."

**Builds on**: AR-121 (gym-server.ts, recall_rogue_env.py, train.py, analyze.py)

---

## Architecture: Phase-Based Action Space

The game alternates between phases. Each phase has its own observation additions and action set. The agent sees a `phase` indicator and acts accordingly.

### Phases

| Phase | When | Actions Available |
|-------|------|-------------------|
| `combat` | During encounter | Play card 0-7 charge/quick, skip turn |
| `card_reward` | After combat victory | Pick card 0/1/2, skip |
| `relic_reward` | Relic offered | Pick relic 0/1/2, skip |
| `relic_swap` | Relic slots full + new relic | Swap slot 0-4, skip |
| `room_select` | Between encounters | Choose room 0/1/2 |
| `shop` | In shop | Buy relic 0/1, buy card 0/1/2, remove card, leave |
| `rest` | At rest site | Heal, upgrade card 0/1/2 |
| `mystery` | Mystery event | Choose option 0/1/2, continue |
| `retreat_or_delve` | After floor clear | Retreat, delve |

### Expanded Observation Vector (120 floats)

Indices 0-79: Same as AR-121 combat observations.

Indices 80-119: Run-level and phase-specific features.

```
80: Phase indicator (combat=0.0, card_reward=0.1, relic_reward=0.2, relic_swap=0.25, room_select=0.3, shop=0.4, rest=0.5, mystery=0.6, retreat_or_delve=0.7)
81: Gold / 500 (capped at 1.0)
82: Floor number / 12
83: Encounter in floor / 3
84: Deck size / 30
85: Player HP % (duplicated for non-combat phases)

86-90: Relic slots (5 slots, relic_id hash / max_hash or 0 if empty)
91: Relic slots used / 5

92-96: Room option types (3 slots, encoded: combat=0.2, elite=0.4, shop=0.6, rest=0.8, mystery=0.9, treasure=1.0, boss=0.3, padding=0)

97-108: Card reward options (3 cards x 4 features: type, tier, baseValue/20, apCost/3)

109-113: Shop relic options (2 slots: rarity encoded, padding=0)
114-116: Shop card options (3 slots: type encoded)
117: Shop removal cost / 200
118: Can haggle (0 or 1)

119: Ascension level / 20
```

### Expanded Action Space (Discrete, 30 actions)

```
Actions 0-7:   Play card index 0-7 CHARGE (combat phase)
Actions 8-15:  Play card index 0-7 QUICK (combat phase)
Action 16:     Skip turn / End turn (combat phase)
Action 17:     Use hint (combat phase)

Action 18:     Pick reward card 0 / Room 0 / Buy relic 0 / Rest heal / Mystery option 0 / Retreat
Action 19:     Pick reward card 1 / Room 1 / Buy relic 1 / Upgrade card 0 / Mystery option 1 / Delve
Action 20:     Pick reward card 2 / Room 2 / Buy card 0 / Upgrade card 1 / Mystery option 2
Action 21:     Skip reward / Leave shop / Buy card 1 / Upgrade card 2
Action 22:     Buy card 2 (shop)
Action 23:     Remove card (shop)
Action 24:     Pick relic 0 (relic_reward) / Swap relic slot 0 (relic_swap)
Action 25:     Pick relic 1 / Swap relic slot 1
Action 26:     Pick relic 2 / Swap relic slot 2
Action 27:     Swap relic slot 3
Action 28:     Swap relic slot 4
Action 29:     Skip relic / Reroll relics
```

Invalid actions for current phase return reward=-0.1, no state change.

---

## Sub-Steps

### Step 1: Expand gym-server.ts with full run loop
**Files modified**: `tests/playtest/headless/gym-server.ts`

Major refactor: the server now simulates a complete run, not just combat encounters.

After combat victory:
1. Heal player (POST_ENCOUNTER_HEAL_PCT)
2. Generate card reward (3 options from deck pool) -> enter `card_reward` phase
3. Roll for relic drop (20% regular, guaranteed mini-boss/boss) -> `relic_reward` phase
4. Check floor progress -> if floor complete, enter `retreat_or_delve`
5. Otherwise generate room options (3 choices) -> `room_select` phase
6. Handle room type: combat, shop, rest, mystery, treasure

Key imports to add from game code:
- `getEnemiesForNode` for room-appropriate enemies
- Relic definitions from `src/data/relics/`
- Card reward generation logic

**For systems that depend on Svelte stores (shop, mystery events)**: simulate them with simplified logic that matches the real game's probabilities and outcomes. The combat is exact (real turnManager), the between-combat is faithful approximation.

Relic inventory: 5 slots max. Track as array of relic definition IDs.

**Acceptance Criteria**:
- Server handles all 9 phases
- Full run plays 9-12 encounters across 3 acts
- Relic inventory capped at 5
- Room selection offers 3 typed rooms
- Card rewards offer 3 cards
- Shop offers relics, cards, removal
- Rest offers heal/upgrade
- Retreat/delve works at floor boundaries

### Step 2: Update Python environment
**Files modified**: `tests/playtest/rl/recall_rogue_env.py`, `tests/playtest/rl/config.py`

- Observation space: Box(120,)
- Action space: Discrete(30)
- Update step() to handle new action encoding

### Step 3: Retrain with full game loop
**Files modified**: `tests/playtest/rl/train.py`

New curriculum:
1. Phase 1 (500K): Single encounters, combat only (warmup)
2. Phase 2 (500K): 3-encounter runs with room selection
3. Phase 3 (1M): Full 10-encounter runs, all phases
4. Phase 4 (500K): Ascension 1-10

### Step 4: Expand analysis for full game decisions
**Files modified**: `tests/playtest/rl/analyze.py`, `tests/playtest/rl/report.py`

New analysis categories:
- Room preference (combat vs shop vs rest vs mystery selection rates)
- Card reward strategy (which types picked, skip rate)
- Relic selection patterns
- Shop purchase patterns (what it buys, what it ignores)
- Rest site strategy (heal vs upgrade frequency)
- Retreat/delve decision patterns by HP/floor
- Deck composition over time
- Ascension difficulty curve

---

## Verification Gate

- [ ] Full run completes (9-12 encounters with all phases)
- [ ] Relic inventory: exactly 5 slots, swap works
- [ ] Room selection: 3 options with correct types per act
- [ ] Card rewards: 3 cards offered, can skip
- [ ] Shop: buy relic/card/removal all work
- [ ] Rest: heal and upgrade both work
- [ ] Retreat/delve: both paths work
- [ ] Ascension 0-20 all playable
- [ ] Agent learns non-trivial between-combat strategy
- [ ] Analysis reports include all new decision categories
