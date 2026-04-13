# Track 15 — API Documentation Drift Audit
## Verdict: ISSUES

Tested 2026-04-12 against warm container agent-id `track-15`. All methods verified live in-browser via `scripts/docker-visual-test.sh --warm test`.

---

## Method Enumeration

### `window.__rrPlay` — 66 methods actual vs documented

**Documented methods present in actual API:** acceptReward, chargePlayCard, delve, endStudy, endTurn, fastForward, getAllText, getCombatState, getLeechInfo, getMysteryEventChoices, getQuiz, getRecentEvents, getRelicDetails, getRewardChoices, getRunState, getScreen, getSessionSummary, getShopInventory, getStudyCard, getStudyPoolSize, gradeCard, look, mysteryContinue, navigate, patch, previewCardQuiz, quickPlayCard, recipes, rerollReward, restHeal, restMeditate, restore, retreat, schema, selectArchetype, selectDomain, selectMapNode, selectMysteryChoice, selectRelic, selectRewardType, shopBuyCard, shopBuyRelic, snapshot, spawn, startRun, startStudy, validateScreen

**Documented but NOT in actual API (0 missing):** None — all documented methods are present.

**In actual API but NOT documented (18 extra/undocumented methods):**
- `answerQuiz` — not documented
- `answerQuizCorrectly` — not documented
- `answerQuizIncorrectly` — not documented
- `enterRoom` — not documented
- `exitRoom` — not documented
- `forceQuizForFact` — not documented
- `getAvailableScreens` — not documented (returns list of navigable screen names)
- `getHUDText` — not documented (returns `{hp, currency, floor, streak, combo}`, all null outside active HUD)
- `getInventory` — not documented (returns `[]` in current test)
- `getNotifications` — not documented (returns `[]`)
- `getStats` — not documented (returns `{bestStreak, currency, currentStreak, learnedFactCount, totalEncountersWon, totalQuizCorrect, totalQuizWrong, totalRunsCompleted}`)
- `getQuizText` — not documented (returns null when no active quiz)
- `getSave` — not documented (returns full save-file object with keys: version, factDbVersion, playerId, deviceId, accountId, etc.)
- `getStudyCardText` — not documented
- `playCard` — not documented (likely an alias or earlier name for quickPlayCard/chargePlayCard)
- `resetToPreset` — not documented
- `seedDriftFixture` — not documented
- `selectRoom` — not documented
- `restUpgrade` — not documented

### `window.__rrScenario` — 24 methods actual vs documented

**Documented in action-specs (used in scenarios action):** load, list, spawn, patch, snapshot, restore — all present.

**In actual API but NOT documented (extra methods):**
- `addRelic`, `forceHand`, `help`, `listMysteryEvents`, `loadCustom`, `pause`, `recipes`, `registerScenario`, `removeRelic`, `resume`, `schema`, `setEnemyBlock`, `setEnemyHp`, `setFloor`, `setGold`, `setPlayerBlock`, `setPlayerHp`, `scenarios` — NOTE: `scenarios` appears in the key list but calling `window.__rrScenario.scenarios()` throws `TypeError: not a function`. It's a property, not a method.

**Documented scenario presets (from `__rrScenario.list()`):** 66 presets registered including: combat-basic, shop-loaded, mystery-event, rest-site, reward-room, dungeon-map, hub-fresh, hub-endgame, study-quiz, plus all study-deck-* variants.

---

## Return Shape Verification

| Method | Documented Shape | Actual Shape | Match? |
|--------|-----------------|-------------|--------|
| `getScreen()` | string, one of: hub/combat/dungeonMap/etc. | string — `"combat"` confirmed | YES |
| `getCombatState()` | `{playerHp, playerMaxHp, playerBlock, playerStatusEffects, ap, apMax, enemyName, enemyHp, enemyMaxHp, enemyBlock, enemyIntent, enemyStatusEffects, handSize, hand, turn, cardsPlayedThisTurn, floor, segment, gold}` | Keys: `ap, apMax, cardsPlayedThisTurn, enemyBlock, enemyHp, enemyIntent, enemyMaxHp, enemyName, enemyStatusEffects, floor, gold, hand, handSize, playerBlock, playerHp, playerMaxHp, playerStatusEffects, segment, turn` (19 keys) | YES — all documented keys present |
| `getCombatState().hand[n]` | `{type, mechanic, mechanicName, tier, apCost, baseEffectValue, domain, factId, factQuestion, factAnswer, isLocked, isCursed, isUpgraded, masteryLevel, chainType}` | Keys: `apCost, baseEffectValue, chainType, domain, factAnswer, factId, factQuestion, isCursed, isLocked, isUpgraded, masteryLevel, mechanic, mechanicName, tier, type` (15 keys) | YES — all documented keys present |
| `getRunState()` | `{floor, segment, currency, deckSize, relics, playerHp, playerMaxHp, encountersCompleted}` | Keys: `currency, deckSize, encountersCompleted, floor, playerHp, playerMaxHp, relics, segment` (8 keys) | YES |
| `look()` | "Full game state snapshot. Returns a large object with all current state." | **Returns a STRING** (formatted text summary, e.g. "SCREEN: combat (Floor ?, Turn ?)\nPLAYER: ?/100 HP...") | **MISMATCH** — documented as object, actual is string |
| `getAllText()` | "All visible text on screen." — implied to be a string | **Returns an OBJECT** `{screen: string, byTestId: {[testId]: string}, byClass: {}, raw: string[]}` | **MISMATCH** — documented as string-like, actual is structured object |
| `getRecentEvents(N)` | "Last N events from ring buffer" | Returns array of `{ts, type, detail}` objects — correct shape | YES |
| `getSessionSummary()` | Not formally documented (just listed as method) | `{durationMin, durationMs, eventCount, firstEvent, lastEvent, typeCounts}` | N/A (no doc to compare) |
| `validateScreen()` | "Check screen state validity" — no return shape documented | Returns `{valid: boolean, issues: string[]}` — e.g. `{valid: false, issues: ["Occluded interactive elements: active-chain-bar"]}` | N/A |
| `getRelicDetails()` | `[{id, name, description, rarity, trigger, acquiredAtFloor, triggerCount}]` | Returns `[]` (empty — no relics in combat-basic scenario) | Cannot verify shape; correct type (array) |
| `previewCardQuiz(index)` | `{ok, state: {question, choices[], correctAnswer, correctIndex, factId, domain, cardType}}` | Keys: `{message, ok, state}` where state has `{cardType, choices, correctAnswer, correctIndex, domain, factId, question}` | YES — matches, has extra `message` key |
| `getRewardChoices()` | "Returns `[{...}]`... Returns `[]` when no reward pending." | Returns `{}` (empty object, NOT an array) outside reward context | **MISMATCH** — documented as `[]`, actual is `{}` |
| `getShopInventory()` | `{relics: [{index, id, name, description, price, sold}], cards: [{index, type, domain, factQuestion, price, sold}], removalCost}` | Returns `{}` (empty object — zero keys) on shop-loaded scenario | **BROKEN** — returns empty object, not documented shape |
| `getMysteryEventChoices()` | `[{index, text}]` | Returns `[]` (empty array) on mystery-event scenario | **BROKEN** — returns empty, no choices exposed |
| `getStudyPoolSize()` | "Returns count of cards eligible for mastery upgrade. Returns `0` when no active run." | Returns `{}` (empty object, NOT a number) | **MISMATCH** — documented as number, actual is `{}` |
| `schema()` | Not documented (listed as method) | Returns array of 446 objects: `{path, type, currentValue, description, validValues}` — full game state schema | N/A |
| `getLeechInfo()` | `{suspended: [], nearLeech: []}` | `{suspended: [], nearLeech: [], totalLeeches: 0}` — has extra `totalLeeches` key | YES + extra key |
| `getStats()` | Not documented | `{bestStreak, currency, currentStreak, learnedFactCount, totalEncountersWon, totalQuizCorrect, totalQuizWrong, totalRunsCompleted}` | N/A |
| `getSave()` | Not documented | Full save-file object (version, playerId, deviceId, etc.) | N/A |

---

## Known-Broken Helpers Status (from B12-001)

| Helper | B12 Status | Current Status | Fixed? |
|--------|-----------|---------------|--------|
| `getMysteryEventChoices` | Returning empty for all events | Still returns `[]` on mystery-event preset — `getAllText` confirms the screen only has a "Continue" button, no choice buttons | NOT FIXED — the mystery-event preset loads a scene with no branching choices; this is either a preset limitation or the helper doesn't read the DOM correctly |
| `getShopInventory` | Returning empty relic metadata | Returns `{}` (zero-key empty object) — completely empty, not even the `{relics, cards, removalCost}` skeleton | NOT FIXED — actually worse than reported: it's `{}` not `{relics:[], ...}` |
| `startStudy()` | Was navigating to wrong screen | Returns `{ok: false, message: "empty study pool — no cards are eligible..."}` on rest-site preset — correct behavior when pool is empty, stays on `restRoom` screen | POSSIBLY FIXED — cannot test navigation because the rest-site preset has no upgradeable cards. Use `study-quiz` preset for a proper test |
| `selectMysteryChoice` | Not finding elements | Returns `{ok: false, message: "Mystery choice 0 not found (only 0 visible .choice-btn elements)"}` — confirms it's looking for `.choice-btn` but the mystery-event preset renders no choices | NOT FIXED — dependent on `getMysteryEventChoices` fix |
| `shopBuyRelic` | Was only opening modal, not confirming | Returns `{ok: true, message: "Bought shop relic 'whetstone'. Screen: shopRoom"}` — appears to complete the purchase | APPEARS FIXED — buy completes and returns ok:true, stays on shopRoom (correct behavior) |
| `selectMapNode` | Was using wrong testid format | Returns `{ok: false, message: "Map node r0-n0 not found"}` — but this was called when screen was `deckSelectionHub`, not `dungeonMap`. Cannot verify fix without being on the map screen. | UNTESTED — tested on wrong screen |

---

## Post-startRun Flow

**Documented:** `startRun()` returns `{ok: boolean}`. After calling, "transitions `hub → onboarding?` (first run only) → runPreview? → dungeonMap`." Docs say expect `getScreen()` to return `'dungeonMap'`.

**Actual observed:** `startRun()` returns `{ok: true, message: "Run started. Screen: deckSelectionHub"}` and `getScreen()` confirms screen is `"deckSelectionHub"` — NOT `dungeonMap`.

**Verdict: DRIFT.** The docs say `startRun` ends at `dungeonMap`; the actual flow pauses at `deckSelectionHub` (deck selection screen). This is a new screen not even listed in the documented `getScreen()` return values.

The `deckSelectionHub` screen is also missing from `getAvailableScreens()` — that list returns: `["hub", "library", "settings", "profile", "journal", "leaderboards", "combat", "dungeonMap", "cardReward", "retreatOrDelve"]`.

**Consequence for testers:** Any tester calling `startRun()` and immediately calling `selectMapNode('r0-n0')` will get `{ok: false}` because the map isn't loaded yet. The canonical run-start sequence in the docs (`startRun → wait 3s → getScreen → expect dungeonMap`) is broken.

---

## Issues Found

### CRITICAL

**[action-specs.md] `startRun()` documented destination is wrong**
- Documented: leads to `dungeonMap`
- Actual: leads to `deckSelectionHub` (a new screen, post-deck-selection step added since docs were written)
- `deckSelectionHub` is not in the `getScreen()` possible values list in the docs
- `deckSelectionHub` is not in `getAvailableScreens()` return values
- Impact: Every tester that calls `startRun()` and then immediately navigates assumes they're on the map — they're not. This causes a cascade of `{ok:false}` failures in every profile that starts a fresh run.
- Fix needed: Update docs with new canonical sequence: `startRun() → deckSelectionHub → [deck selection action] → dungeonMap`

**[action-specs.md] `getShopInventory()` returns `{}` not `{relics, cards, removalCost}`**
- Documented: structured object with relics array, cards array, removalCost
- Actual: empty object `{}` — zero keys even when on `shopRoom` screen with `shop-loaded` preset
- Cannot read shop contents at all via this helper
- Still broken from B12-001

**[action-specs.md] `getMysteryEventChoices()` returns `[]` on mystery-event preset**
- No choices are exposed even though the screen is `mysteryEvent`
- The `getAllText` confirms only a "Continue" button is visible (no `.choice-btn` elements)
- This may be a preset issue: `mystery-event` loads a scene with no branching choices
- Recommend testing with a preset that has choices, e.g. `mystery-tutors-office`, `mystery-rival-student`, `mystery-knowledge-gamble`
- Until confirmed otherwise: this helper is non-functional for branching events

### MEDIUM

**[action-specs.md] `look()` documented as "large object" but returns a STRING**
- Documented: "Full game state snapshot. Returns a large object with all current state."
- Actual: Returns a formatted multi-line text string (like a console dump). Example: `"SCREEN: combat (Floor ?, Turn ?)\nPLAYER: ?/100 HP  AP: 3/5\nENEMY: Page Flutter — 35/35 HP..."`
- Any tester calling `Object.keys(look())` or `look().playerHp` will get unexpected results
- Fix: Update docs to say `look()` returns a string summary, not an object. For structured data use `getCombatState()`, `getRunState()`, etc.

**[action-specs.md] `getAllText()` documented as string-like, actual is structured object**
- Documented: "All visible text on screen" (implied string)
- Actual: Returns `{screen: string, byTestId: {[testId]: string}, byClass: {}, raw: string[]}`
- Fix: Update docs to document the actual shape. The structured form is actually MORE useful than a raw string.

**[action-specs.md] `getRewardChoices()` returns `{}` not `[]` when empty**
- Documented: "Returns `[]` when no reward pending"
- Actual: Returns `{}` (empty object)
- A tester checking `getRewardChoices().length` will get `undefined`, not `0`
- Fix: Either fix the implementation to return `[]`, or update docs to note the empty-state is `{}`

**[action-specs.md] `getStudyPoolSize()` returns `{}` not a number**
- Documented: "Returns count of cards eligible for mastery upgrade. Returns `0` when no active run."
- Actual: Returns `{}` (empty object) on rest-site preset
- Any numeric comparison like `if (getStudyPoolSize() > 0)` will be truthy on `{}`
- Fix: Either fix implementation to return `0`, or document the actual return type

**[action-specs.md] 18 undocumented `__rrPlay` methods**
- Methods not in docs that exist on the object: `answerQuiz`, `answerQuizCorrectly`, `answerQuizIncorrectly`, `enterRoom`, `exitRoom`, `forceQuizForFact`, `getAvailableScreens`, `getHUDText`, `getInventory`, `getNotifications`, `getStats`, `getQuizText`, `getSave`, `getStudyCardText`, `playCard`, `resetToPreset`, `seedDriftFixture`, `selectRoom`, `restUpgrade`
- Several of these look useful for testers (`getAvailableScreens`, `getStats`, `getHUDText`, `getSave`)
- Fix: Document or remove from the API surface

**[action-specs.md] `getLeechInfo()` returns extra `totalLeeches` key not in docs**
- Documented: `{suspended: [], nearLeech: []}`
- Actual: `{suspended: [], nearLeech: [], totalLeeches: 0}`
- Minor — not breaking, just undocumented

### LOW

**[action-specs.md] `deckSelectionHub` screen not in `getScreen()` possible values list**
- The documented list of possible `getScreen()` values does not include `deckSelectionHub`
- This screen exists and is reachable via `startRun()`

**[action-specs.md] `__rrScenario.scenarios` is a property, not a function**
- `Object.keys(__rrScenario)` returns `scenarios` as a key, but calling `__rrScenario.scenarios()` throws TypeError
- Calling `__rrScenario.list()` is the correct way to enumerate presets

**[infrastructure] Low FPS in Docker container during sustained warm sessions**
- Observed FPS alerts: "Low FPS alert: 6 fps in CombatScene for 60s" and "23 fps for 3s"
- The combat scene degrades to 6 fps after several minutes in warm container
- May cause timing-sensitive tests to behave differently
- Not a test infrastructure failure (all evals still succeed) but worth noting for long sessions

---

## Self-Verification

All results above come directly from `result.json` files in `/tmp/rr-docker-visual/track-15_*`. Key raw outputs:

- Step 1 (enumerate): `rrPlay` has 66 keys, `rrScenario` has 24 keys
- Step 2 (combat shapes): `getCombatState_keys` = 19 keys matching docs; `look_actual_type` = `"string"`; `getAllText_keys` = `["screen","byTestId","byClass","raw"]`
- Step 3 (screens): `getShopInventory` = `{}`; `getMysteryEventChoices` = `[]`; `getStudyPoolSize` = `{}`
- Step 4 (broken helpers): `shopBuyRelic(0)` returned `{ok:true, message:"Bought shop relic 'whetstone'. Screen: shopRoom"}`; `selectMysteryChoice(0)` returned `{ok:false, message:"Mystery choice 0 not found (only 0 visible .choice-btn elements)"}`
- Step 6 (startRun): `startRun()` → `{ok:true, message:"Run started. Screen: deckSelectionHub"}`; `getScreen()` = `"deckSelectionHub"`
