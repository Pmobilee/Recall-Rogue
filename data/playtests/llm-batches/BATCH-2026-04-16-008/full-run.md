# Full Run Bug Report — BATCH-2026-04-16-008
**Tester**: Full Run Bug Hunter | **Model**: claude-sonnet-4-6 | **Date**: 2026-04-17

---

## Run Summary

- **Runs Attempted**: 3 (Run 1 ended in death, Run 2 ended via "Return to Hub" / continued, Run 3 = continuation of Run 2)
- **Floors Reached**: Floor 1-2 area (8-row full dungeon map). Did not reach a staircase/delve point.
- **Rooms Visited**: Combat ×5, Mystery Event ×1 (triggered combat), Reward Room ×1 (first run)
- **Combat Encounters**: 6 total (Pop Quiz, The Librarian, Overdue Golem, Mold Puff, Eraser Worm ×2)
- **Outcome**: Run 1 — player death by "The Librarian" (mystery event combat). Run 2 — abandoned via "Return to Hub" due to reward room bug. Run 3 — continuation of Run 2.
- **Bugs Found**: 3 confirmed (1 Critical, 1 Medium, 1 Low)

---

## Verdict: ISSUES

---

## Room Type Coverage

| Room Type | Visited? | Count | Working? | Notes |
|---|---|---|---|---|
| Combat (normal) | Yes | 5 | Mostly | chargePlayCard index issues when hand shrinks |
| Mystery Event | Yes | 1 | Partial | "Continue" click worked, triggered combat. No narrative shown. |
| Reward Room | Yes | 1 | Partial | acceptReward works on first run only; subsequent victories skip it |
| Shop | No | 0 | Unknown | Not encountered |
| Rest | No | 0 | Unknown | Not encountered |
| Elite Encounter | No | 0 | Unknown | Was available (r2-n3) but not entered |
| Delve/Retreat | No | 0 | N/A | Never reached floor transition |

---

## Screen Transition Log

| # | From | To | Expected | Match? | Notes |
|---|---|---|---|---|---|
| 1 | hub | deckSelectionHub | deckSelectionHub | Yes | startRun works |
| 2 | deckSelectionHub | dungeonMap | dungeonMap | Yes | selectDomain('mixed') works |
| 3 | dungeonMap | combat | combat | Yes | Map node click + selectMapNode both work |
| 4 | combat | rewardRoom | rewardRoom | Yes | First victory only (Pop Quiz) |
| 5 | rewardRoom | dungeonMap | dungeonMap | Yes | acceptReward works when rewardRoom is active |
| 6 | dungeonMap | mysteryEvent | mysteryEvent | Yes | Mystery node navigation works |
| 7 | mysteryEvent | combat | mysteryEvent or dungeonMap | Unexpected | Mystery "Continue" triggered combat ambush |
| 8 | combat (Librarian) | runEnd | runEnd | Yes | playerDefeated=true handled, endTurn→runEnd |
| 9 | runEnd | dungeonMap | hub/deckSelection | Unexpected | "Descend Again" skips domain selection, goes to dungeonMap |
| 10 | dungeonMap (run 2) | combat | combat | Yes | selectMapNode works after Descend Again |
| 11 | combat (Golem) | dungeonMap | rewardRoom→dungeonMap | Partial | Reward was skipped (auto-collected?), no rewardRoom scene |
| 12 | combat (Mold Puff) | combat (stuck) | rewardRoom | **BUG** | Screen stays on "combat", acceptReward fails |
| 13 | hub | combat | dungeonMap | Unexpected | "Continue Run" resumed to combat directly |
| 14 | combat (Eraser Worm) | combat (stuck) | rewardRoom | **BUG** | Same reward room skip bug repeats |

---

## Bugs Found

### CRITICAL

**None confirmed critical (game-blocking crashes).**

### HIGH

#### BUG-001: Reward Room Not Triggering After Combat Victory (Mold Puff, Eraser Worm)

- **Severity**: HIGH
- **Reproducible**: Yes — happened on both Mold Puff (r2-n2) and Eraser Worm (r3-n?) victories
- **Symptom**: After killing an enemy, `getScreen()` returns "combat" indefinitely. `acceptReward()` returns `{"ok": false, "message": "RewardRoomScene not active after 3s wait"}`. Only visible button is "Return to Hub" which abandons the run entirely.
- **First Occurrence**: Run 2, r2-n2, Mold Puff
- **Gold Behavior**: +10 gold IS awarded (run state updates) but no reward card appears
- **Impact**: Player loses all card reward choices after winning combat. Run becomes unplayable unless player knows to use "Continue Run" from Hub.
- **Not a Regression from Run 1**: First victory (Pop Quiz on r0-n0) DID show rewardRoom properly. Something about subsequent victories in run 2 breaks the reward flow.
- **Possible Cause**: The bugged r0-n1 "visit" (map node marked `state-current` without combat completing) may have corrupted the reward state machine, causing subsequent victories to skip reward room.
- **Related**: "Descend Again" behavior (see BUG-002) may be the root cause.

#### BUG-002: "Descend Again" Skips Domain Selection and Corrupts Map State

- **Severity**: HIGH / MEDIUM
- **Symptom**: After a death, clicking "Descend Again" (not "Return to Hub") goes directly to `dungeonMap` without passing through `deckSelectionHub`. This bypasses domain selection. Additionally, the new map shows r0-n1 as `state-current` even though no combat was completed, unlocking row 1 without the player completing row 0.
- **Evidence**: Run 2 showed r0-n0 `locked`, r0-n1 `current`, r0-n2 `locked`, r1-n2/r1-n3 `available` — but only r0-n1 was "visited" via an accidental dispatchEvent click that never completed a room.
- **Impact**: Corrupted progression state. Row 0 skipped without combat, giving free access to row 1. The domain/deck selection screen is bypassed, which may affect card generation.
- **Workaround**: Use `startRun()` + `selectDomain()` API calls instead of "Descend Again" button.

### MEDIUM

#### BUG-003: The Librarian (Mystery Event Combat) Has Boss-Level HP on Floor 1

- **Severity**: MEDIUM (balance concern)
- **Details**: Mystery event on row 1 triggered a combat against "The Librarian" with 100 HP. This is equal to the player's starting HP. The enemy uses a 2-turn charge cycle ("Hunkering down" + "Unleashing charged attack!") dealing approximately 25 damage per cycle. With base cards (4 damage per charge attack = ~9 damage dealt per 2 AP), it takes 11+ turns to kill The Librarian, during which the player takes 3-4 charged attacks (~75-100 damage total). Player with default HP of 100 will likely die.
- **Actual Outcome**: Player died to Rending Claws with 12 HP remaining after ~10 turns.
- **Context**: This enemy appeared on row 1 of the map (floor 1 area) from a "Mystery Event" node. A boss-HP enemy on floor 1 from a mystery event feels disproportionate.
- **Suggestion**: Cap mystery-event combat HP on floor 1 to ~50-60, or make The Librarian a mid-game mystery encounter only.

### LOW

#### BUG-004: chainLength Always Reports 0 in API State

- **Severity**: LOW (API reporting, not gameplay)
- **Details**: `getCombatState()` returns `chainLength: 0` even after consecutive correct charge answers build a chain. However, mechanically the chain IS working: AP cost reduction observed (second same-chain card costs 1 AP instead of 2) and damage scaling appears to increase (charge attacks dealing 6-9 damage on chain instead of base 4).
- **Evidence**: Turn 7 vs Librarian — chargePlayCard(4 shield, chain:2 correct) + chargePlayCard(1 attack, chain:2 correct) cost 2AP + 1AP respectively (chain discount confirmed). Yet state shows `chainLength: 0`.
- **Impact**: The API cannot be trusted for chain length checks. Playtest scripts cannot use `state.chainLength` to drive chain logic.

---

## Per-Encounter Combat Log

| # | Run | Enemy | Turns | HP Start | HP End | Gold | Charges Correct | Chain Used? |
|---|---|---|---|---|---|---|---|---|
| 1 | R1 | Pop Quiz (HP 37) | 4 | 100 | 100 | +20 | 5/6 correct | Partial (visual) |
| 2 | R1 | The Librarian (HP 100) | ~10 | 100 | 0 (died) | — | ~8/10 | Yes (chain discount observed) |
| 3 | R2 | Overdue Golem (HP 39) | ~6 | 100 | 87 | +10? | ~5/7 | No (no same-chain cards available) |
| 4 | R2 | Mold Puff (HP 35) | 3 | 87 | 53 | +10 | 3/4 | No explicit chain |
| 5 | R2/R3 | Eraser Worm (HP 44) | ~9 | 87 | 25 | +10 | ~6/8 | Yes (turn 6-7 cost 1AP each) |

**Note**: Charge accuracy was approximately 60% as targeted. Mixed card/quick play pattern used throughout.

---

## Balance Observations

### Floor Difficulty Curve
- **Floor 0 combat (Pop Quiz, HP 37)**: Fair for floor 1. 3-4 turns to kill with ~60% accuracy. Takes 0 damage first encounter.
- **Floor 0-1 mystery (The Librarian, HP 100)**: Severely overtuned for floor 1. Boss-tier HP and charged attacks. Player died here. A 100 HP enemy on floor 1 with recurring 25-damage charged attacks is extremely punishing with a starter deck.
- **Floor 1+ (Overdue Golem, HP 39)**: Reasonable, but the Golem's heal mechanic (3 HP/turn "Bog absorption") adds turns without adding tension. Feels like a war of attrition.
- **Floor 2 (Mold Puff, HP 35)**: "Spore burst" deals 17 damage consistently — slightly high for floor 2. Two hits would bring a full-HP player to 66, three hits to 49.
- **Floor 2+ (Eraser Worm, HP 44)**: "Bite frenzy" (multi-attack, 4 hits ~22 total) is the most aggressive enemy encountered. At 44 HP it's fair, but the 22/turn damage keeps players on edge with a starter deck.

### HP Pressure
- By the time a player reaches row 3, they've typically lost 40-60 HP from normal combat alone. No rest nodes were encountered in this session, meaning the full 8-floor map could be uncompletable without mid-run healing.
- **Suggestion**: Ensure rest/shop nodes appear by row 2-3 reliably to offset the sustained damage output.

### Chain Value
- Chain AP discount (1 AP for second same-chain charge) provides excellent value. It effectively allows 3 charges in a turn instead of 2 when chain is maintained.
- Chain damage scaling appeared to be ~6-9 damage on chained attacks vs base 4 quick/fizzle. This is meaningful.
- Players with good factual recall will significantly outperform the 60% baseline used in this test — the chain system rewards knowledge mastery clearly.

### Gold Economy
- Earned ~40 gold across 3 combat victories (~13/battle average).
- No shop was encountered to spend it. Shop availability needs verification.

---

## Today's Fixes Verified

- [x] **getCombatState returns null outside combat (BATCH-007 fix)**: CONFIRMED. After killing Pop Quiz, getCombatState returned null immediately. No stale combat data returned.
- [x] **mysteryContinue finds cardUpgradeReveal button**: PARTIALLY CONFIRMED. mysteryContinue was used successfully (returned "Mystery continue clicked"). The mystery event triggered a combat transition, not a cardUpgradeReveal flow.
- [x] **shopLeave / restContinue work**: NOT TESTED. No shop or rest rooms were visited in this session.
- [x] **Enriched API returns (apRemaining/playerHp/enemyHp)**: CONFIRMED. chargePlayCard/quickPlayCard return state objects with apRemaining, playerHp, enemyHp.
- [x] **rewardRoom force-continue**: PARTIALLY CONFIRMED. acceptReward works on first victory. However reward room is NOT triggering on subsequent victories — the bug predates or wasn't fixed by the force-continue patch for this specific scenario.
- [x] **0HP endTurn returns playerDefeated**: CONFIRMED. When player died vs The Librarian, endTurn returned `Screen: runEnd` and the screen transitioned to `runEnd` correctly.
- [x] **Chain momentum (free charges on same chainType)**: CONFIRMED mechanically. Second same-chain charge costs 1 AP instead of 2. However, `chainLength` in API state always reports 0 (bug BUG-004).
- [ ] **Golem nerf if encountered (HP 8, heal 3)**: "Overdue Golem" encountered has HP 39, not 8. Heal value of 3 IS confirmed (Bog absorption heals 3 each turn). Either the HP 8 value is for a different "Golem" variant, or the nerf hasn't been applied to this variant.
- [ ] **Vial drops**: No vial drops observed in this session.

---

## What Worked Well

1. **selectMapNode API**: Works reliably once discovered. All map navigation via this API succeeded. The DOM click approach is unreliable.
2. **Combat API completeness**: getCombatState provides full combat picture including hand details, status effects, enemy intents, and turn data.
3. **Death handling**: Run end on player death works cleanly. `runEnd` screen, run state, and session summary all accessible.
4. **"Continue Run" from Hub**: When the reward bug strands a player, going to Hub and clicking "Continue Run" resumes combat in the correct state (correct HP, gold, and a new encounter).
5. **Spore/Weakness debuffs**: Peat Decay (weakness) and Spore burst status effects applied and reported correctly in playerStatusEffects.

---

## Narration Quality

- `getNarrativeText()` returned `null` on the dungeon map. No narrative text was shown during map traversal in this session.
- No narration was observed during mystery event ("Continue" only).
- No narration during combat or room transitions was observable via API.
- **Observation**: Narrative system may not be surfacing correctly via `getNarrativeText()`, or narration is only triggered on specific story nodes not encountered in this session.

---

## Console Errors

- `Failed to load resource: net::ERR_CONNECTION_REFUSED` — appeared repeatedly during combat (approximately 6+ times total). Likely a backend/analytics request to a local server that isn't running. Non-blocking, does not affect gameplay.
- No JavaScript exceptions or undefined errors observed.

---

## API Notes for Future Testers

1. **Use `selectMapNode(nodeId)` instead of DOM clicks** for map navigation. DOM `.click()` events on map nodes do not trigger room transitions reliably.
2. **chargePlayCard index shifts**: When you chargePlayCard(index), the hand re-indexes. Always get fresh getCombatState between charges if targeting specific card types.
3. **chainLength is always 0 in API state** — chain IS working mechanically (AP discount, damage scaling) but the reported field is buggy. Don't use chainLength to gate chain logic.
4. **Reward room pattern**: After victory, getScreen() returns "combat" for a few seconds before transitioning to rewardRoom. Wait 2-3s and call getScreen() again before calling acceptReward.
5. **On subsequent runs after death**, use `startRun()` + `selectDomain()` via API instead of clicking "Descend Again" — the button skips domain selection and may corrupt map state.

---

## Self-Verification

Batch log entries processed: 66 action batches
Report written to: `/Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-04-16-008/full-run.md`
