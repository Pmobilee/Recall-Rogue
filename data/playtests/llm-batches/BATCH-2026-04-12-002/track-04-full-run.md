# Track 4 — Full Run Bug Hunter Extended
## Verdict: ISSUES

## Run Summary
| Metric | Value |
|--------|-------|
| Floors Completed | N/A (scenario-based testing) |
| Encounters Won | 0 (used setEnemyHp workaround attempted; combat reset bug prevented completion) |
| Room Types Visited | combat, rewardRoom, shopRoom, restRoom, mysteryEvent, retreatOrDelve, dungeonMap, cardReward, runEnd |
| Total Screen Transitions | 15+ tracked |
| Stuck States | 1 (mysteryEvent after mysteryContinue) |
| Crashes | 1 (page crash when running background + foreground Docker tests simultaneously) |

## Screen Transition Log
1. combat-basic → combat (initial scenario)
2. scenario:reward-room → rewardRoom → hub (acceptReward)
3. scenario:shop → shopRoom (purchase dialog intercepted, no transition)
4. scenario:rest-site → restRoom → restRoom (restHeal, stays in room)
5. scenario:mystery-event → mysteryEvent → mysteryEvent (after mysteryContinue — STUCK, then quiz phase visible)
6. scenario:combat-boss → combat (The Algorithm boss)
7. scenario:retreat-or-delve → retreatOrDelve → runEnd (retreat)
8. scenario:retreat-or-delve → retreatOrDelve → dungeonMap (delve)
9. scenario:dungeon-map → dungeonMap (selectMapNode API fails, direct eval click works) → combat (Mold Puff)
10. scenario:combat-elite → combat (The Final Lesson elite)
11. scenario:card-reward → cardReward (selectRewardType API fails)
12. scenario:run-end-victory → runEnd (all buttons present)
13. scenario:mystery-tutors-office → mysteryEvent (quiz-start flow)
14. scenario:mystery-knowledge-gamble → mysteryEvent (quiz-start flow, asset error logged)
15. scenario:mystery-rival-student → mysteryEvent (quiz-start flow)

## Room Type Coverage
| Room Type | Visited? | Notes |
|-----------|----------|-------|
| Combat (Normal) | YES | Page Flutter, Mold Puff tested. endTurn flow works. |
| Combat (Elite) | YES | "The Final Lesson" loaded correctly |
| Combat (Boss) | YES | "The Algorithm" loaded correctly |
| Shop | YES | Loaded, inventory returned. Buy flow triggers confirmation dialog |
| Rest Site | YES | restHeal works, restUpgrade/restMeditate not tested |
| Mystery Event | YES | Multiple mystery presets tested. All route to quiz-start, none have choice buttons |
| Dungeon Map | YES | Map loads. selectMapNode API broken; direct DOM click works |
| Card Reward | YES | Cards shown, selectRewardType API broken for index args |
| Reward Room | YES | acceptReward works, transitions to hub |
| Run End (Victory) | YES | Full stats displayed correctly |
| Run End (Retreat) | YES | retreatOrDelve → runEnd works |
| Hub | YES | Appears after acceptReward |

## Issues Found

### CRITICAL — Enemy HP Escalation Between Action Batches
**Severity:** Critical / Potential Data Bug  
**Location:** combat-basic scenario, getCombatState  
**Description:** Enemy maxHP escalates with each action batch even when the scenario is freshly loaded:
- Batch 1: Page Flutter 30/30 HP
- Batch 2 (after endTurn + enemy attack): 36/36 HP (reset AND increased)
- Batch 3: 31/31, then 32/32, then 36/36, then 37/37, then 38/38...
Enemy maxHP increases monotonically across sessions on the same Docker warm container.
**Evidence:** getCombatState results across batches track-4 step 3–9.
**Impact:** Could indicate enemy state persists across scenarios, or a seeding/RNG issue where repeated scenario loads pull from an advancing pool.

### HIGH — getCombatState Reports Wrong HP When Dialog Is Open
**Severity:** High / Data Inconsistency  
**Location:** src/game/ (combat scene), __rrPlay.getCombatState  
**Description:** When the "End Turn with remaining AP" confirmation dialog is open, getCombatState returns wrong values. Screenshot showed enemy at 30/36 HP but API returned 36/36 (full health). Player HP similarly reported 100/100 when visual showed ~87. The dialog state blocks correct HP reporting from the API.
**Evidence:** Step 7 screenshot vs getCombatState result showing 36/36 vs visual 30/36.
**Impact:** Any automation or bot relying on getCombatState during a dialog will get incorrect values.

### HIGH — shopBuyRelic Returns ok:true Before Purchase Is Confirmed
**Severity:** High / API Contract Violation  
**Location:** src/ui/components/ (shop), __rrPlay.shopBuyRelic  
**Description:** shopBuyRelic(0) returns `{ok: true, message: "Bought shop relic 'whetstone'"}` but the UI shows the purchase confirmation dialog is still open. The relic is NOT actually purchased (getShopInventory still shows sold:false). The function reports success prematurely.
**Evidence:** Step 17 result.json — shopBuyRelic returns ok:true, subsequent getShopInventory shows whetstone still unsold.
**Impact:** Automation that trusts shopBuyRelic return value will incorrectly assume purchase completed.

### HIGH — selectMapNode API Uses Wrong Selector
**Severity:** High / API Bug  
**Location:** src/ui/ or __rrPlay implementation  
**Description:** selectMapNode(0) fails with "Map node 0 not found". DOM inspection shows nodes use data-testid="map-node-r0-n0" format (row + node index), not a simple integer index. The API doesn't match the DOM structure.
**Evidence:** Step 26 — selectMapNode(0) fails; Step 27 — direct querySelector('[data-testid="map-node-r0-n0"]').click() succeeds and navigates to combat.
**Impact:** Cannot navigate dungeon map via the API.

### MEDIUM — getMysteryEventChoices Always Returns Empty Array
**Severity:** Medium / API Limitation  
**Location:** __rrPlay.getMysteryEventChoices  
**Description:** All mystery event presets tested (mystery-event, mystery-tutors-office, mystery-knowledge-gamble, mystery-rival-student) return getMysteryEventChoices as []. All these events use a "Begin Quiz" flow, not the .choice-btn selector the API looks for. There are no tested mystery events with classic choice buttons.
**Evidence:** Steps 19, 32, 33, 34 all return getMysteryEventChoices: [].
**Impact:** Cannot interact with mystery events via the getMysteryEventChoices/selectMysteryChoice API chain.

### MEDIUM — selectRewardType Fails for Numeric Index
**Severity:** Medium / API Bug  
**Location:** __rrPlay.selectRewardType  
**Description:** selectRewardType(0) fails with "Reward type '0' not found". The method expects a string reward type (e.g. "gold", "relic") not a numeric card index. Using it to select a card from card-reward screen doesn't work.
**Evidence:** Step 30 result.json.
**Impact:** Cannot select cards from card reward screen via the API.

### LOW — Missing Asset: knowledge_gamble/landscape.webp
**Severity:** Low / Missing Asset  
**Location:** /assets/backgrounds/mystery/knowledge_gamble/landscape.webp  
**Description:** Console error: "[ParallaxTransition] WebGL init failed: Error: Failed to load image: /assets/backgrounds/mystery/knowledge_gamble/landscape.webp". The knowledge gamble mystery event background parallax layer fails to load. The scene still renders (likely falls back) but the parallax transition fails silently.
**Evidence:** Step 33 consoleErrors.
**Impact:** Minor visual degradation for knowledge gamble mystery event.

### LOW — Run End Timer Display Format May Be Incorrect
**Severity:** Low / UI Display  
**Location:** run-end-victory screen, Time field  
**Description:** The Time field in Run Stats shows "01s 01m" format which appears to have seconds before minutes (should be "1m 01s" or "0:01:01"). The run-end-victory scenario with 10 floors shows "01s 01m".
**Evidence:** Screenshot from step 31.
**Impact:** Minor UX confusion for long runs.

### INFO — "Failed to load resource: net::ERR_CONNECTION_REFUSED" Recurring
**Severity:** Info / Expected in Docker  
**Location:** consoleErrors across all combat scenarios  
**Description:** Most combat scenarios log "Failed to load resource: net::ERR_CONNECTION_REFUSED" in consoleErrors. This is the backend API call (likely Fastify analytics/telemetry) that is expected to fail in Docker because the backend server is not running.
**Evidence:** Present in steps 2, 4, 6, 7, 15, 17, 25, 26, 29.
**Impact:** Expected in test environment, not a game bug.

## Observations

**Combat Feel:** The charge-play system works mechanically. Cards correctly cost 2 AP for charge and 1 AP for quick. The card variety in hand (Strike, Block, Heavy Strike, Multi-Hit, Lifetap, Expose, Transmute) shows good diversity. The quiz mechanic is correctly bound to card play.

**Enemy Diversity:** Confirmed 4 unique enemies across tests: Page Flutter (bat, combat-basic), Mold Puff (mushroom, from map node), The Algorithm (boss, cyberpunk), The Final Lesson (elite). All have distinct art and mechanics.

**Map Navigation:** The dungeon map renders correctly with different node types (combat ?, mystery ?). Available nodes are enabled (state-available), locked future nodes are disabled (state-locked). The visual map layout looks correct.

**Run End Screen:** Both victory and retreat run-end screens render correctly with Knowledge Harvest stats, Run Stats, and navigation buttons.

**Shop:** The shop renders correctly with 500g pre-loaded gold and 3 relics at 150g each. The "Card Transform" section is visible but shows no cards. The Haggle mechanic (30% off for correct answer) is present in purchase dialog.

**Rest Site:** Three clear options: Rest (30% HP heal, disabled at full HP), Study, Meditate. Clean UI.

**Mystery Events:** All tested mystery events use quiz-start flow ("Begin Quiz" button). The event flavor text is well-written. Multiple distinct backgrounds for different mystery event types.

**Boss Visual:** The Algorithm boss has impressive art — a glowing eye-tree structure in a server room environment. Thematically strong.

## Test Methodology Notes

The warm Docker container state persists within a single action batch file but resets to the initial scenario at the start of each new batch file. To test room transitions, each batch must begin with a `{"type":"scenario","preset":"X"}` action to load the target scenario. This is correct behavior but means a true continuous run simulation requires all actions in one batch file.

The enemy HP escalation behavior (maxHP increasing monotonically across sessions) may be caused by the combat scenario using an RNG seed that increments with each container-session-counter, rather than resetting per scenario load.

### MEDIUM — Truncated/Broken Quiz Question in Seed Data
**Severity:** Medium / Content Bug  
**Location:** src/data/seed/knowledge-general_knowledge.json line 21460  
**Description:** factId `general_knowledge-romance-languages-vulgar-latin` has a broken quizQuestion: `"Which specific form of did all Romance languages directly descend from?"` — missing "Latin" after "of". Should read: `"Which specific form of Latin did all Romance languages directly descend from?"`  
**Evidence:** getCombatState hand data during step 35 shows this fact with broken question text. Confirmed in source file at line 21460.  
**Fix:** Edit line 21460 to add "Latin". Rebuild facts.db.  
**Impact:** Player sees a grammatically broken question in combat.

### HIGH — Brace-Format Numeric Distractors in Quiz Choices (Still Unresolved)
**Severity:** High / Player-Facing Content Bug  
**Location:** quizService.ts getBridgedDistractors() (documented in gotchas 2026-04-12)  
**Description:** Quiz choices for numeric-answer facts include raw brace-format strings. Example: question "How many consecutive years did Mad Men win Outstanding Drama?" — correct answer: `4`, but distractor choices show `{3}`, `{25}`, `{500}`. Players see braces in answer options.  
**Evidence:** Step 37 — previewCardQuiz for card index 2 returned choices: `['{3}', '{25}', '{500}', 'Correct Answer']`  
**Fix:** Already documented in gotchas.md — change line 188 of quizService.ts from `d.correctAnswer` to `displayAnswer(d.correctAnswer)`.  
**Impact:** Players see unformatted `{N}` brace strings as quiz answer choices. Confirmed still present in current build.
