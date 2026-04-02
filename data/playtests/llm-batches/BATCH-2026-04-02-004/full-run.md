# Full Run Bug Report — BATCH-2026-04-02-004

**Date:** 2026-04-02  
**Tester:** LLM Bug Hunter (Sonnet 4.6)  
**Runs executed:** 2 (Run A, Run B)  
**Game version:** main branch @ commit 615614ce  
**Target:** 4+ reward transitions without crash

---

## Run Summary

| Metric | Run A | Run B |
|---|---|---|
| Floor reached | 1 | 1 |
| Rooms completed | 2 combat + 1 rest attempt | 2 combat + 1 mystery attempt |
| Reward transitions | 2 | 1 |
| Run outcome | STUCK at campfire (restRoom) | STUCK at mysteryEvent quiz phase |
| Player HP at end | 100/100 | 100/100 |
| Gold at end | 40 | 20 |
| Enemy names defeated | Mold Puff, Page Flutter | Margin Gremlin (+ 1 autowin) |
| Combat wins | 2 | 2 |

---

## Verdict: ISSUES

Run did not crash (no page errors), but **two separate hard locks were encountered** on consecutive room types. Both prevent run completion. Target of 4+ reward transitions was **not reached** (max: 2 in Run A).

---

## Room Type Coverage

| Room Type | Attempted | Resolved | Stuck | Notes |
|---|---|---|---|---|
| Combat | 4 | 4 | 0 | Working correctly |
| Reward Room (post-combat) | 3 | 3 | 0 | acceptReward() works |
| Rest Site (restRoom) | 1 | 0 | 1 | restMeditate/restHeal not found after staggerPopIn |
| Mystery Event | 1 | 0 | 1 | EventQuiz has no data-testid; mysteryContinue locked after Begin Quiz click |
| Shop | 0 | — | — | Not tested |
| Elite | 0 | — | — | Not tested |
| Boss | 0 | — | — | Not tested |
| Treasure | 0 | — | — | Not tested |

---

## Screen Transition Log

| # | From | To | Notes |
|---|---|---|---|
| 1 | null | hub | Initial load |
| 2 | hub | deckSelectionHub | startRun() |
| 3 | deckSelectionHub | onboarding | selectDomain + selectArchetype auto-resolved |
| 4 | onboarding | dungeonMap | enter-btn click |
| 5 | dungeonMap | combat | selectMapNode(r0-n0) |
| 6 | combat | rewardRoom | Enemy defeated |
| 7 | rewardRoom | dungeonMap | acceptReward() — clean |
| 8 | dungeonMap | combat | selectMapNode(r1-n0) |
| 9 | combat | rewardRoom | Enemy defeated |
| 10 | rewardRoom | dungeonMap | acceptReward() — clean |
| 11 | dungeonMap | restRoom | selectMapNode(r2-n1) [Run A] |
| 12 | restRoom | campfire | Settings button click (accident) [Run A] |
| 13 | dungeonMap | mysteryEvent | selectMapNode(r1-n1) [Run B] |
| — | mysteryEvent | stuck | mysteryContinue = Begin Quiz → quizPhase locked [Run B] |

---

## Bugs Found

### BUG-001 — HIGH: `EventQuiz` component missing `data-testid` attributes — mystery events with quiz type cause hard lock

**Severity:** HIGH  
**File:** `src/ui/components/EventQuiz.svelte`  
**Category:** Playtest API / Test Coverage Gap  

**Description:**  
When a mystery event of type `quiz` or `rivalDuel` is triggered, clicking the "Begin Quiz" button (which IS findable as `mystery-continue`) transitions `quizPhase` from `intro` to `quiz`. At this point the `EventQuiz` component renders. The `EventQuiz` choice buttons have class `.choice-btn` but **no `data-testid` attribute**, making them inaccessible to:
- `answerQuiz(index)` — requires `[data-testid="quiz-answer-{index}"]`
- `answerQuizCorrectly()` — depends on `answerQuiz()`
- `mysteryContinue()` — button disappears while in `quiz` phase

**Evidence:**  
```
[MYSTERY_CONT] {"ok":true,"message":"Mystery resolved. Screen: mysteryEvent"}  // Begin Quiz clicked
[MYSTERY_CONT] {"ok":false,"message":"Mystery continue button not found"}      // Now stuck in quiz phase
[CHOICES] []                                                                    // No choice buttons found
```
Source in `EventQuiz.svelte` line 159-168: `<button class="choice-btn" ...>` — no `data-testid`.

**Fix required:**  
Add `data-testid="quiz-answer-{i}"` to each choice button in `EventQuiz.svelte`, matching the format expected by `answerQuiz()` in `playtestAPI.ts`.

---

### BUG-002 — HIGH: `restMeditate()` and `restHeal()` fail — rest site buttons not found after screen name mismatch

**Severity:** HIGH  
**Files:** `src/ui/components/RestRoomOverlay.svelte`, `src/dev/playtestAPI.ts`, test script  
**Category:** Rest Room / Screen Name Handling  

**Description:**  
The rest site enters as `restRoom` screen but after the `staggerPopIn` animation, the screen briefly transitions to `campfire` due to an unrelated navigation issue (in Run A, the `⚙` settings button was accidentally clicked during the unhandled `restRoom` screen). However even without this, `restRoom` was NOT handled in the test script's switch statement and fell into the `default` handler which attempted to click any visible button.

Additionally, the `staggerPopIn` animation takes 2 seconds, during which all rest buttons (including `[data-testid="rest-meditate"]`) are opacity-0/scale-0. If `restMeditate()` is called during this window, the `offsetParent` check inside the API would fail.

**Evidence (Run A):**  
```
[LAYOUT:UNHANDLED_restRoom] {}  // restRoom not handled
[TRY_ANY_BTN] "clicked:⚙"      // Settings button clicked instead of rest option
[TRANSITION] restRoom -> campfire  // Unexpected navigation
[MEDITATE] {"ok":false,"message":"Rest meditate button not found"}  // Stuck on campfire
```

**Note:** This was partly a test script issue (restRoom not in switch) and partly a real concern — the 2s staggerPopIn animation window where buttons are invisible is a real fragility. The `restMeditate()` API has no retry or animation-aware wait.

**Fix required (test script):** Handle `restRoom` case correctly, wait 2s for animation before calling rest APIs.  
**Fix to consider (production):** `restMeditate()` in `playtestAPI.ts` could use a brief polling loop to wait for the button to become visible.

---

### BUG-003 — MEDIUM: `getCombatState()` returns null on first call while `getScreen()` still returns `combat`

**Severity:** MEDIUM  
**File:** `src/dev/playtestAPI.ts`, `src/services/encounterBridge.ts`  
**Category:** Combat State Timing  

**Description:**  
On first call after a combat room is entered, `getCombatState()` returns `null` while `getScreen()` returns `combat`. This is a transient race condition — on the next call 1 second later, `getCombatState()` also returns null because combat has ended (enemy was defeated during the previous turn's card plays). The root cause appears to be that card plays (via `quickPlayCard`) can kill the enemy and end combat, but the screen doesn't immediately update — there's a brief window where `getScreen() === 'combat'` but `getCombatState() === null`.

**Evidence:**
```
T4: HP=100/100 AP=3 Blk=27 EnemyHP=1/27 Phase=active
[LAYOUT:POST_COMBAT_F1_R0] {}
[getScreen] "combat"        // screen still says combat
// Loop re-enters
[CS] null                   // getCombatState returns null
[getScreen] "combat"        // still says combat
// 1s later...
[CS] null                   // still null
[getScreen] "rewardRoom"    // NOW transitions
```

**Impact:** Low — the fallback `while(!cs) { check screen; if not combat, break; }` loop handles this correctly. 1 false positive medium bug logged per affected combat.

**Fix:** Add a brief delay or check `getScreen()` before re-entering combat handler. Consider returning a `{ phase: 'ending' }` state instead of null during the transition window.

---

### BUG-004 — LOW: `endTurn` fails ("End turn button not found") in one turn after combat seems to finish

**Severity:** LOW  
**File:** `src/dev/playtestAPI.ts`  
**Category:** Combat End Timing  

**Description:**  
In one combat turn (Turn 6 of combat 2, Run A), `endTurn()` returned `{"ok":false,"message":"End turn button not found"}`. This happened when the last card play killed the enemy but the loop continued to attempt `endTurn()`. The end-turn button is hidden/removed when combat ends.

**Evidence:**
```
[QUICK_5] {"ok":true,"message":"Quick-played card 5 (attack, \"card_40\")"}
[END_TURN] {"ok":false,"message":"End turn button not found"}
// Immediately after:
[CS] null     // Combat ended
[getScreen] "rewardRoom"  // Success
```

**Impact:** Cosmetic — the ok:false result is handled gracefully and combat transitions correctly.

**Fix:** Not blocking. Consider checking if enemy is dead before calling endTurn.

---

### BUG-005 — LOW: CSP violation and failed resource loads on startup

**Severity:** LOW  
**Category:** Network / CSP  

**Description:**  
On every load, two errors appear:
1. `Connecting to 'http://100.74.153.81:5175/api/game/cardback-updates' violates CSP directive`
2. `Failed to load resource: net::ERR_CONNECTION_REFUSED`

The first is a CSP violation from a hardcoded LAN IP for the playtest dashboard API endpoint. The second is a failed connection to the same server.

**Impact:** Non-blocking — these errors fire every ~30s and don't affect gameplay. However they pollute error logs.

**Fix:** Either add the LAN IP to CSP `connect-src` or guard the cardback-updates polling to skip when server is unreachable.

---

## Per-Encounter Combat Log

| # | Floor | Enemy | Start HP | End HP | Turns | Cards Played | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | 1 | Margin Gremlin | 100 | 100 | 4 | 11 | Victory (turns=0 logged due to endScreen transition) |
| 2 | 1 | (autowin) | n/a | n/a | 0 | 0 | Completed → rewardRoom |
| 3 | 1 | Page Flutter | 100 | 97 | 6 | ~12 | Victory |
| 4 | 1 | Mold Puff | 100 | 100 | 6 | ~10 | Victory |

**Notes:**
- `turns` counter shows 0 for Combat 1 because the enemy died during a card play loop iteration (before `endTurn` incremented the counter). This is a counter instrumentation issue, not a real bug.
- Player took 3 damage in Combat 3 (Page Flutter attack before death).
- Block was functioning correctly — Margin Gremlin was blocked completely.
- Status effects (weakness, poison) were applied and tracked correctly.
- AP costs correct at 3 base, 4 max. Cards cost 1 AP (quick) or 2 AP (charge).

---

## Console Errors

| Error | Frequency | Severity | Notes |
|---|---|---|---|
| `Failed to load resource: net::ERR_CONNECTION_REFUSED` | 4+ times | LOW | Playtest dashboard API at 100.74.153.81:5175 unreachable |
| `CSP violation: connect to 100.74.153.81:5175` | 1 time | LOW | Hardcoded LAN IP in CSP |

No `pageerror` events. No TypeScript runtime errors.

---

## What Worked Well

1. **Combat system is solid.** All 4 combat encounters resolved correctly. Block, status effects, enemy intents, AP costs all behaved as expected.
2. **Reward room transitions are clean.** `acceptReward()` worked correctly 3/3 times. Screen transitioned to `dungeonMap` immediately with no delays or stuck states.
3. **Map navigation works.** `selectMapNode(shortId)` correctly enters combat, mystery, and rest rooms. Node selection by aria-label for type detection works.
4. **Run initialization flow works.** `startRun()` → `selectDomain()` → `selectArchetype()` → onboarding button → `dungeonMap` is clean.
5. **No page crashes.** Neither run triggered any runtime errors or TypeScript panics.
6. **Enemy variety.** Saw Margin Gremlin, Page Flutter, Mold Puff — different intents (attack, debuff, buff, defend).
7. **Status effects.** Poison, weakness, strength status effects correctly tracked and displayed in `getCombatState()`.

---

## Action Items (Priority Order)

| Priority | Bug | Fix Owner | Effort |
|---|---|---|---|
| 1 | BUG-001: EventQuiz missing data-testid | ui-agent | Small — add `data-testid="quiz-answer-{i}"` to EventQuiz choices |
| 2 | BUG-002: restRoom handler gap + staggerPopIn timing | game-logic + test script | Small — handle restRoom screen, add 2s wait before API calls |
| 3 | BUG-003: getCombatState null timing | game-logic | Medium — return `{phase:'ending'}` instead of null during transition |
| 4 | BUG-004: endTurn after enemy death | game-logic | Trivial — check enemy HP before endTurn call |
| 5 | BUG-005: CSP/network errors | game-logic | Small — guard polling or add IP to CSP |

