# 5-Room Playtest — BATCH-2026-05-06-002

**Verdict**: ISSUES
**Rooms completed**: 1/5 (blocked at post-combat reward room transition)
**Room types visited**: [combat]

---

## Big Blockers

### 1. Reward Room `acceptReward` Times Out in Docker Warm Container
**Severity**: HIGH (test-environment blocker; game may work fine outside Docker)
**Screen**: `rewardRoom` (confirmed via `getScreen` returning `"rewardRoom"`)
**Repro**:
1. Complete a combat encounter (Room 1: Staple Bug, floor 1)
2. Combat ends → `getScreen` returns `"rewardRoom"` (confirmed)
3. `look()` confirms "AVAILABLE ACTIONS: Continue, Accept, Leave" (confirmed)
4. `getRewardChoices()` returns 3 valid cards (confirmed)
5. Call `acceptReward` → never returns in Docker warm container

**Evidence**:
- `look()` output: `"[fps] Low FPS alert: 1 fps in CombatScene for 279s"`, `"1 fps in CombatScene for 329s"`, `"1 fps in CombatScene for 368s"`, `"1 fps in CombatScene for 414s"`, `"6 fps in CombatScene for 472s"` (from result.json at `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778056458802/result.json`, actionLog[0].out)
- Three concurrent `acceptReward` batches launched (tasks b1sv321yh, b3bvnzq14, b03j459sz) — all returned only `"Warm test: scenario=none agent=llm-playtest-BATCH-2026-05-06-002 port=3281"` with no completion after >20 minutes
- Screenshot confirming rewardRoom rendered: `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778056458802/room1-reward-room.rr.jpg`

**Root cause hypothesis**: CombatScene Phaser RAF loop is running at 1 FPS in Docker SwiftShader environment. The rewardRoom (also a Phaser scene) depends on the RAF loop for `acceptReward` to process the button click and trigger the transition. At 1 FPS, each animation frame takes ~1 second real time. The `acceptReward` call requires multiple Phaser frames to complete the animation and transition, making it impractically slow in Docker.

**Note**: This is very likely a **Docker/SwiftShader performance issue, not a game bug**. The game's reward room UI was verified to be in a correct state (actions present, cards present, gold correctly updated +10 from 50→60). This should be verified in a real browser environment.

---

## Per-Room Log

| # | Screen | Type | Enemy/Event | Outcome | Notes |
|---|--------|------|-------------|---------|-------|
| 1 | combat | enemy | Staple Bug (45 HP) | Win, 5 turns | Player HP 100→95. Combat ran 5 turns (within 4-7 range). acceptReward blocked in Docker. |
| — | rewardRoom | reward | — | Blocked | acceptReward hung at 1 FPS Phaser rendering. |

### Room 1 Combat Detail
- **Enemy**: Staple Bug, 45/45 HP, enemyMaxHp=45
- **Player**: Started 100/100 HP, ended 95/100 HP
- **Turns**: 5 (Turn 1: dealt 13 damage; Turn 2: dealt 11 damage; Turn 3: dealt 10 damage; Turn 4: 0 damage — AP bug below; Turn 5: killed)
- **Gold**: 50 → 60 post-combat (+10 confirmed)
- **Reward choices**: 3 valid cards — Cleanse (utility/art_architecture), Lifetap (attack/human_body_health), Expose (debuff/animals_wildlife)

---

## Secondary Findings (non-blockers)

### AP State Inconsistency Observation (Turns 4-5)
**Severity**: LOW / OBSERVATION
After `endTurn` returned `apRemaining: 3` for turn 4, the subsequent batch's `getCombatState` showed `ap: 0` despite `cardsPlayedThisTurn: 2`. This pattern repeated: the state seen via `getCombatState` after waiting showed 0 AP even when `endTurn` reported 3 AP. This may be a timing issue where two background tasks ran simultaneously and the game state was queried mid-processing, rather than a real bug. Not confirmed as a blocker — combat continued normally.

### `selectMapNode` API: Full testId vs Short ID
**Severity**: LOW / DOCUMENTATION GAP
`selectMapNode("map-node-r0-n0")` returned `{ok: false, "Map node map-node-r0-n0 not found"}`. The correct call is `selectMapNode("r0-n0")` (without the `map-node-` prefix). The DOM `data-testid` attribute uses the full `"map-node-r0-n0"` format, but the API expects the short form. This is a documentation mismatch — `action-specs.md` says to use `'r0-n0'` but the map node discovery eval returns testIds like `"map-node-r0-n0"`.

### Fact with Wrong Domain Tag
**Severity**: DATA / LOW
Card with `factId: "lit_mod_solzhenitsyn_ivan_denisovich"` consistently appeared in the `domain: "art_architecture"` field, but its content (Solzhenitsyn novel, Gulag camps) is clearly Literature/History. This card appeared multiple times across hands. The domain is likely miscategorized in the deck data.

### Console Errors: `ERR_CONNECTION_REFUSED`
**Severity**: LOW (network, not game)
Three batches showed `"Failed to load resource: net::ERR_CONNECTION_REFUSED"` in consoleErrors. This is a background network request being refused — likely a telemetry, analytics, or dev-only endpoint that doesn't exist in the Docker environment. No visible game impact observed.

---

## Evidence Index

### Screenshots
| Label | Path |
|-------|------|
| Hub setup | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778055696209/setup-hub.rr.jpg` |
| After startRun (deckSelectionHub) | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778055711842/after-startRun.rr.jpg` |
| After selectDomain (dungeonMap) | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778055725689/after-selectDomain.rr.jpg` |
| Dungeon map (room 1 node selection) | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778055748742/dungeon-map-room1.rr.jpg` |
| Room 1 combat initial state | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778055873925/room1-combat-initial.rr.jpg` |
| Room 1 combat end (post kill) | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778056416710/room1-combat-end.rr.jpg` |
| Room 1 reward room | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778056458802/room1-reward-room.rr.jpg` |

### Key result.json files
| Label | Path |
|-------|------|
| rewardRoom state + FPS alerts | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778056458802/result.json` |
| Map node discovery | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778055748742/result.json` |
| selectMapNode wrong ID failure | `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-05-06-002_none_1778055761275/result.json` |

### Console Errors Summary
- `"Failed to load resource: net::ERR_CONNECTION_REFUSED"` — appeared in 3 batches (steps 8, 9, 10). Not game-impacting.
- FPS alerts in `look()`: `"[fps] Low FPS alert: 1 fps in CombatScene for 279s"` through `472s`

---

## Self-Verification

```
$ ls /Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-05-06-002/
full-run-5rooms.md
manifest.json
```

Report file: `/Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-05-06-002/full-run-5rooms.md`
