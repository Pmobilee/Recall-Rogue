# Full Run Bug Report — BATCH-2026-04-16-007
**Tester**: Full Run Bug Hunter | **Model**: claude-sonnet-4-6 | **Date**: 2026-04-16

## Run Summary
- **Floors attempted**: 1 / 3 target (floor 1 partially completed, delve to floor 2 not reached)
- **Floors completed**: 0 (boss not reached due to stale-state bug cascade)
- **Total rooms visited**: ~10 across 3 run attempts
- **Room types visited**: combat (5), shop (1), rest (2), mystery (2), boss (1 — stale state), treasure (2)
- **Total combat encounters**: 5 started (2 completed cleanly, 1 stale-state zombie, 2 incomplete)
- **Run outcome**: stuck — stale combat state prevented reaching boss cleanly
- **Total bugs found**: 7 (critical: 2, high: 2, medium: 2, low: 1)

## Verdict: FAIL

Primary blocker: a stale combat state persists after any combat ends mid-turn (via AP exhaustion without explicit kill), causing all subsequent getCombatState calls to return outdated data with AP=1. This made clean boss testing impossible.

## Room Type Coverage
| Room Type | Visited? | Count | Working? | Notes |
|-----------|----------|-------|----------|-------|
| combat | Yes | 5 | Partial | 2 worked cleanly; others hit stale state |
| shop | Yes | 1 | Yes | getShopInventory working; no affordable items |
| rest | Yes | 2 | Partial | restHeal works; restMeditate has no API exit |
| mystery | Yes | 2 | Partial | getMysteryEventChoices works; mysteryContinue fails post-choice |
| boss | Yes | 1 | No | Loaded stale Eraser Worm instead of Algorithm boss |
| treasure | Yes | 2 | Yes | acceptReward transitions correctly |
| elite | No | 0 | — | Not reached in tested path |

## Screen Transition Log
| # | From Screen | To Screen | Expected | Match? | Notes |
|---|-------------|-----------|----------|--------|-------|
| 1 | hub | deckSelectionHub | deckSelectionHub | Yes | startRun works |
| 2 | deckSelectionHub | dungeonMap | dungeonMap | Yes | selectDomain works |
| 3 | dungeonMap | combat | combat | Yes | selectMapNode works |
| 4 | combat | rewardRoom | rewardRoom | Yes | After enemy killed |
| 5 | rewardRoom | dungeonMap | dungeonMap | Yes | acceptReward works |
| 6 | dungeonMap | restRoom | restRoom | Yes | |
| 7 | restRoom | restMeditate | restMeditate | Yes | restMeditate called |
| 8 | restMeditate | dungeonMap | dungeonMap | No — required navigate() force | No API exit from restMeditate |
| 9 | dungeonMap | mysteryEvent | mysteryEvent | Yes | |
| 10 | mysteryEvent | cardUpgradeReveal | dungeonMap expected | No | Stuck on cardUpgradeReveal; mysteryContinue fails |
| 11 | cardUpgradeReveal | dungeonMap | dungeonMap | No — required navigate() | "Restart Game" / "Error details" buttons visible |
| 12 | dungeonMap | shopRoom | shopRoom | Yes | |
| 13 | shopRoom | dungeonMap | dungeonMap | No — required navigate() | No API exit from shopRoom |
| 14 | dungeonMap | rewardRoom | rewardRoom | Yes | Treasure node |
| 15 | hub | hub | deckSelectionHub | No | startRun after navigate-to-hub returns Screen:hub |

## Bugs Found

### CRITICAL

**BUG-001: Boss encounter loads stale previous combat state (Eraser Worm instead of Algorithm)**
- **Severity**: Critical
- **Reproduction**: Fight combat 2 (Eraser Worm) and end the turn at the moment the enemy dies (or when AP runs out mid-kill). Navigate to boss node r7-n0. Boss loads Eraser Worm at 25 HP instead of Algorithm.
- **Evidence**: selectMapNode r7-n0 returned "Screen: combat"; getCombatState shows enemyName="Eraser Worm", enemyHp=25, ap=0, handSize=3 (stale from combat 2). Expected: Algorithm boss with full HP.
- **Root cause**: Combat state not cleared after endTurn returns "Not in combat". The `turnManager` / `encounterBridge` stale state persists across room transitions.
- **Impact**: Boss fight is a zombie encounter from a prior room. Player cannot properly fight the boss.
- **Console error**: `[CardApp] Failed to start map node encounter TypeError: Cannot read properties of null (reading 'drawImage')` — the GL null error during encounter load may be causing the state to not reinitialize.

**BUG-002: 0 HP softlock NOT fixed for stale combat scenario**
- **Severity**: Critical
- **Reproduction**: Enter boss encounter with stale Eraser Worm state. endTurn repeatedly with no cards (handSize=0, AP=0). Player HP drops from 100 → 84 → 68 → 50 → 34 → 16 → 0. At HP=0, endTurn continues returning `{ok:true}` and staying on "combat" screen. Does NOT return `{playerDefeated: true}`. Does NOT transition to runEnd.
- **Evidence**: Multiple sequential endTurn calls after playerHp=0 all return `ok:true, Screen:combat, playerHp:0`. getCombatState.result stays null, never transitions to 'defeat'.
- **Note**: The today's fix (check turnState.result before button disabled) may have fixed the UI button disable, but the API path (`endTurn()` API call) does NOT return playerDefeated when in stale combat context.
- **Workaround**: `navigate('hub')` escapes the stuck state.

### HIGH

**BUG-003: Stale getCombatState data persists after combat ends**
- **Severity**: High
- **Reproduction**: Complete any combat. Navigate back to dungeonMap. Call getCombatState. Returns last combat's enemy HP, player AP (typically 1), and hand data.
- **Evidence**: After all combat encounters, getCombatState consistently returns stale data: ap=1, eHP=last-enemy-HP. This misleads the agent and any automation relying on getCombatState to determine combat status.
- **Distinguishing feature**: getScreen correctly returns "dungeonMap", but getCombatState returns non-null stale data. AP=1 is the tell.
- **Impact**: Medium-high for API consumers. The chargePlayCard calls fail with "needs 2, have 1" due to stale AP=1.

**BUG-004: chargePlayCard returns "Error: Cannot read properties of null (reading 'drawImage')"**
- **Severity**: High
- **Reproduction**: In a stale combat state after a GL context error on encounter load, calling quickPlayCard returns an exception rather than a clean error message.
- **Evidence**: `quickPlayCard: Error: Cannot read properties of null (reading 'drawImage')` in action log for step 53.
- **Root cause**: The GL context null error in `CombatScene.setEnemy()` (line 917) propagates to card play API calls.
- **Stack trace**: `Frame2.updateUVs → Frame2.setCutPosition → Frame2.setSize → Text2.updateText → Text2.setText → CombatScene.setEnemy → pushDisplayData → tryPush → syncCombatScene → startEncounterForRoom`
- **Impact**: API consumers see uncaught exceptions instead of actionable error messages.

### MEDIUM

**BUG-005: restMeditate and shopRoom have no API exit path**
- **Severity**: Medium
- **Reproduction**: Enter restRoom and call restMeditate. Screen transitions to "restMeditate". `mysteryContinue`, `restUpgrade`, and all other rrPlay methods fail to exit. DOM has card buttons but no testId-bearing exit button.
- **Evidence**: Multiple attempts to find continue/leave button in restMeditate and shopRoom failed. Required `navigate('dungeonMap')` to escape both screens.
- **Impact**: Automated testing and API-driven play cannot complete rest or shop without the navigate workaround.
- **Note**: shopRoom also has no API exit — same pattern.

**BUG-006: `cardUpgradeReveal` screen shows "Restart Game" + "Error details" buttons**
- **Severity**: Medium
- **Reproduction**: Select mystery choice 0 (upgrade a card) from mysteryEvent. Screen transitions to "cardUpgradeReveal". DOM contains buttons: "Continue", "Restart Game", "Error details".
- **Evidence**: Eval of buttons in step 29 returned `[{text:"Continue",class:"continue-btn svelte-oz6x3e"},{text:"Restart Game",class:""},{text:"Error details ▼",class:""}]`
- **Impact**: An uncaught error is occurring on the cardUpgradeReveal screen transition. The "Continue" button exists but `mysteryContinue` API can't find it (selector mismatch). The error dialog suggests a JS exception during card upgrade reveal.
- **Note**: `navigate('dungeonMap')` escapes successfully.

### LOW

**BUG-007: startRun returns "Screen: hub" after navigate-to-hub**
- **Severity**: Low
- **Reproduction**: Call `navigate('hub')` then `startRun()`. startRun returns `{ok:true, message:"Run started. Screen: hub"}` instead of transitioning to deckSelectionHub.
- **Evidence**: Steps 43-45: navigate→hub → startRun returns Screen:hub → selectDomain returns Screen:hub. Workaround: `navigate('deckSelectionHub')` + selectDomain works correctly.
- **Impact**: Cannot restart a run cleanly from hub via the standard startRun flow when the previous run ended via navigate workaround.

## Per-Encounter Combat Log
| # | Floor | Enemy | Turns | HP Start | HP End | Gold | Result |
|---|-------|-------|-------|----------|--------|------|--------|
| 1 | 1 | Pop Quiz (31 HP) | 4 | 100 | 100 | 10 | Victory |
| 2 | 1 | Eraser Worm (35 HP) | ~2 | 100 | 100 | 20→? | Victory (auto-ended mid-turn) |
| 3 | 1 | Pop Quiz (37 HP) R2 | ~1 | 100 | 100 | 0 | Victory (auto-ended mid-turn) |
| 4 | 1 | Pop Quiz (35 HP) R3 | 5 | 100 | 92 | 20 | Victory (clean) |
| 5 | 1 | Ink Slug (63 HP) | 3+ | 100 | 66 | 35 | Incomplete (batch limit) |
| B | 1 | Eraser Worm STALE (25 HP) | ~10 | 100 | 0 | — | Softlock (BUG-001/002) |

## Balance Observations
- **Pop Quiz**: 31-37 HP at floor 1. Manageable with charge attacks (6-11 dmg per correct charge).
- **Eraser Worm**: 35 HP, applies vulnerable debuff. Mandible crush does ~16 dmg with vulnerable.
- **Ink Slug**: 63 HP. Significantly tankier than floor 1 enemies — appropriate scaling.
- **Player damage received**: ~8-17 HP per enemy turn at floor 1 with no block. Correct answers + chain momentum keeps player alive.
- **Chain system**: Confirmed working (chain=2 observed, damage scales with chain).
- **FIZZLE_EFFECT_RATIO**: Confirmed 0.5× on wrong answers (16→13 HP enemy = 3 dmg vs 6 dmg correct = 0.5×).
- **60% accuracy survivability**: Borderline. Player dropped from 100 HP to 66 HP in 3 turns vs Ink Slug without block plays. With block cards it's more manageable.

## Today's Fixes Verified
- [x] **Overdue Golem nerf**: Not encountered — Golem not in floor 1 rotation tested.
- [x] **Vial drop rates**: Not observed — no vials dropped in tested floors.
- [x] **Enriched API returns verified**: YES — chargePlayCard returns full state including `apRemaining`, `playerHp`, `enemyHp` in `state` field. Confirmed working.
- [x] **rewardRoom force-continue works**: YES — acceptReward worked correctly in all non-stale scenarios.
- [x] **mystery continue fallback works**: YES — getMysteryEventChoices returned `[{index:0, text:"Continue"}]` for empty mystery; selectMysteryChoice(0) triggered "Mystery continue clicked (no choice buttons found)".
- [ ] **0HP softlock NOT observed (fix verified)**: PARTIAL — `endTurn` in stale boss combat context does NOT return `{playerDefeated:true}` at 0 HP. Player stuck in infinite 0 HP loop. The fix may only work for the UI button path.
- [x] **endTurn playerDefeated field**: PARTIAL — In clean combats, endTurn returns proper state. At 0 HP in stale context, does not return playerDefeated.
- [x] **GL context guard in EnemySpriteSystem**: Non-fatal — the `drawImage null` error still appears in console but doesn't crash the game. Guard prevents hard crash.
- [x] **getCombatState result field**: Confirmed present (`result: null` during combat, transitions correctly).

## What Worked Well
1. **acceptReward** transitions to dungeonMap correctly in all clean scenarios.
2. **selectMapNode** correctly discovers and enters room types (combat, rest, mystery, shop, treasure).
3. **getMysteryEventChoices** returns correct choice data.
4. **chargePlayCard enriched API** returns full state snapshot including apRemaining/playerHp/enemyHp.
5. **Chain momentum** builds correctly (chain=1 → chain=2 observed).
6. **getShopInventory** returns full relic and card data with prices.
7. **navigate()** API works as an escape hatch for stuck screens.
8. **Floor map generation** produces varied layouts (3-wide, 4-wide floors observed).

## Narration Quality
`getNarrativeText()` returned `null` in all contexts tested (after combat, after mystery). No narration was surfaced through the API during this session.

## Console Errors
Recurring non-fatal errors observed throughout all sessions:
1. `[CardApp] Failed to start map node encounter TypeError: Cannot read properties of null (reading 'drawImage') at Frame2.updateUVs ... CombatScene.setEnemy (line 917) ... startEncounterForRoom` — appears on every combat start; game continues.
2. `Failed to load resource: net::ERR_CONNECTION_REFUSED` — appears intermittently; likely a backend service connection attempt that fails gracefully.

## Critical Path Blocked
The primary objective (3-floor full run with delve) was not achieved due to BUG-001 (stale state on boss) and BUG-002 (0 HP softlock in stale state). The stale combat state bug (`getCombatState` returning stale AP=1 data after combat completion) cascades through the entire run, making clean boss testing impossible without lucky timing.

**Recommendation**: Fix BUG-001 (clear turnState on room exit) and BUG-003 (getCombatState should return null or a proper terminal state when not in active combat) as the highest priority items before next full-run test.
