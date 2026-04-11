# llm-playtest — Action Specs, `__rrPlay` API, Error Handling

**Parent skill:** [`../SKILL.md`](../SKILL.md) — `/llm-playtest`
**Covers:** The actions-file JSON schema, the full `window.__rrPlay` API reference (every method every tester might need), the shared error handling protocol, known behaviors that are NOT bugs, and the shared screenshot/layout-dump rules.

Every tester profile in `profiles.md` references this file for shared mechanics so the prompt blocks don't each re-state the API.

---

## Known Behaviors (Not Bugs) — READ BEFORE REPORTING

Testers MUST understand these design-intentional behaviors. Do NOT report them as issues.

### 1. Fact Repetition Is the Learning Algorithm Working

Seeing ~9 unique facts across 22 quiz charges is **expected Anki-faithful behavior**, not "fact pool starvation." The `InRunFactTracker` uses a three-state model (NEW → LEARNING → GRADUATED) with:

- **MAX_LEARNING = 8**: Only 8 facts can be in the learning state simultaneously
- **STEP_DELAYS = [2, 5]**: A new fact repeats after 2 charges, then 5 charges, before graduating
- **GRADUATE_DELAY = 10**: Graduated facts don't return for 10 charges
- New facts only enter when a learning slot frees up

This means in a 3-encounter session (~22 charges), the system intentionally drills ~8-10 facts repeatedly to cement them. This IS the spaced repetition model. Report it as a finding only if the repetition pattern is *wrong* (e.g., a graduated fact returning too early, or new facts never introduced).

### 2. Quick Play IS Base Damage — Charge Is the Bonus

- **Quick play** = `quickPlayValue` (this is the BASE, not a penalty)
- **Charge correct** = `quickPlayValue × CHARGE_CORRECT_MULTIPLIER (1.5x)`
- **Charge wrong (cursed)** = `quickPlayValue × 0.5`

Do NOT report "quick play damage is low compared to charge" — that's the intended 1:1.5 ratio. The `devpreset=post_tutorial` loads level 25 + all relics, which stack mastery and relic bonuses onto charge plays, making the ratio appear much larger (3-6x). To measure true base ratios, test without devpreset relics or account for relic effects in your analysis.

### 3. Audio Muting for Bot Play

Before each tester runs, the orchestrator mutes audio via Svelte stores (`sfxEnabled`, `musicEnabled` → false, volumes → 0). If sound still leaks, the Phaser AudioManager may have its own channel — this is a known gap, not a game bug.

### 4. Combat Length on Floor 1

Combat should last 4-7 turns after the BATCH-004 enemy rebalance (Act 1 HP 25-40, attack 4-7). If combats are consistently shorter than 4 turns, report as a balance issue. Only report transition bugs separately.

### 5. No Separate cardReward Screen

Card selection is integrated into the rewardRoom Phaser scene. `acceptReward` transitions directly to dungeonMap after collecting all items. If `getScreen` returns `'cardReward'`, route it through the rewardRoom handler.

---

## Critical Screenshot & Layout Dump Rules

- **ALWAYS** use BOTH a screenshot AND a layout dump together — they are required, not interchangeable
  - Screenshot action: `{"type":"rrScreenshot","name":"<label>"}` — saves `{label}.png` + `{label}.layout.txt` via `__rrScreenshotFile` + `__rrLayoutDump` in the output dir
  - Layout dump action: `{"type":"layoutDump","name":"<label>"}` — layout only (cheaper than a full screenshot)
- **ALWAYS** `Read` the full `<label>.png` (NOT any .jpg thumbnail) when diagnosing visual issues
- **NEVER** call `mcp__playwright__browser_take_screenshot` — Phaser's RAF loop blocks it permanently (30s timeout)
- **NEVER** call `page.screenshot()` or `page.context().newCDPSession()` — same RAF/hang issues
- Layout dumps are your PRIMARY perception tool — they show exact positions of all Phaser + DOM elements

### Docker actions-file screenshot rule

All tester sub-agents build JSON actions-files and run them via `scripts/docker-visual-test.sh --warm test --actions-file <path>`. The `rrScreenshot` action type saves both PNG and layout dump automatically. You do NOT need separate eval calls for `window.__rrScreenshotFile` — use the action type.

---

## Actions-File Schema

An actions-file is a JSON array of action objects. The `docker-visual-test.sh --warm test --actions-file <path>` script executes them in order inside the warm container and writes results to `<outputDir>/result.json`.

### Action Types

| Type | Fields | Purpose |
|---|---|---|
| `rrPlay` | `method: string`, `args: any[]` | Calls `window.__rrPlay[method](...args)` and records the return value |
| `eval` | `js: string` | Runs arbitrary JS in the page context and records the return value (use `JSON.stringify(...)` for complex objects) |
| `scenario` | `preset: string` | Loads a `__rrScenario` preset mid-batch |
| `rrScreenshot` | `name: string` | Saves `{name}.png` + `{name}.layout.txt` via `__rrScreenshotFile` + `__rrLayoutDump` |
| `layoutDump` | `name: string` | Layout dump only (no PNG) |
| `wait` | `ms: number` | Pauses N milliseconds |
| `waitFor` | `selector: string`, `state?: 'visible' \| 'hidden'`, `timeout?: number` | Waits for a DOM element |

### Example actions-file

```json
[
  {"type":"wait","ms":3000},
  {"type":"eval","js":"JSON.stringify({play:typeof window.__rrPlay,shot:typeof window.__rrScreenshotFile})"},
  {"type":"rrPlay","method":"getScreen"},
  {"type":"rrPlay","method":"getCombatState"},
  {"type":"rrScreenshot","name":"floor1-combat-turn3"}
]
```

### Reading results

After every Bash invocation, the stdout includes the output directory path. Read `<outputDir>/result.json` — it contains:

```json
{
  "actions": [
    {"type": "wait", "ok": true, "durationMs": 3001},
    {"type": "eval", "ok": true, "result": "{\"play\":\"object\",\"shot\":\"function\"}", "durationMs": 12},
    {"type": "rrPlay", "ok": true, "result": "hub", "durationMs": 5},
    {"type": "rrPlay", "ok": true, "result": {"playerHp": 60, ...}, "durationMs": 8},
    {"type": "rrScreenshot", "ok": true, "result": "floor1-combat-turn3.png", "durationMs": 320}
  ]
}
```

`rrPlay` results are in `result.result`. `eval` results are in `result.result` (already JSON-parsed if possible).

### Batch strategy

Group related reads into one actions-file to minimize round-trips. Each batch takes ~5s. A good batch shape:

```json
[
  {"type":"rrPlay","method":"getScreen"},
  {"type":"rrPlay","method":"getCombatState"},
  {"type":"rrScreenshot","name":"floor1-combat-turn3"}
]
```

**Quick mode:** If you need only `rrPlay` calls with no visual verification (e.g. mid-combat turn loop), bundle 5–10 `rrPlay` actions in one batch, then do a single `rrScreenshot` at the end of the turn.

---

## The `window.__rrPlay` API — Full Reference

All calls go through an `rrPlay` action in an actions-file. Example: `{"type":"rrPlay","method":"getScreen"}`.

### Navigation & State

- `getScreen()` — Returns current screen name (string). Possible values: `'hub'`, `'domainSelect'`, `'archetypeSelect'`, `'dungeonMap'`, `'combat'`, `'cardReward'`, `'rewardRoom'`, `'restRoom'`, `'shopRoom'`, `'mysteryEvent'`, `'retreatOrDelve'`, `'runEnd'`
- `look()` — Full game state snapshot. Returns a large object with all current state.
- `getRecentEvents(N)` — Last N events from ring buffer. Use to see what just happened.
- `getAllText()` — All visible text on screen. Use to read UI state.
- `getSessionSummary()` — Aggregate session stats (accuracy, encounters, damage dealt).
- `validateScreen()` — Check screen state validity
- `getRunState()` — Returns: `{floor, segment, currency, deckSize, relics, playerHp, playerMaxHp, encountersCompleted}`

### Run Flow

- `startRun()` — Start a new run from hub screen. Returns `{ok: boolean}`.
- `selectDomain(domain)` — Pick domain. Returns `{ok: boolean}`.
- `selectArchetype(archetype)` — Pick archetype. Returns `{ok: boolean}`.
- `selectMapNode(nodeId)` — Select a map node. Use `'r0-n0'` for first available. Returns `{ok: boolean}`.

### Combat

- `getCombatState()` — Returns full combat state:
  ```
  {
    // Player
    playerHp, playerMaxHp, playerBlock,
    playerStatusEffects: [{type, value, turnsRemaining}],
    ap, apMax,
    // Enemy
    enemyName, enemyHp, enemyMaxHp, enemyBlock,
    enemyIntent: {type, value, telegraph, hitCount, statusEffect},
    enemyStatusEffects: [{type, value, turnsRemaining}],
    // Hand
    handSize,
    hand: [{
      type, mechanic, mechanicName, tier, apCost, baseEffectValue,
      domain, factId, factQuestion, factAnswer,
      isLocked, isCursed, isUpgraded, masteryLevel, chainType
    }],
    // Turn & Run
    turn, cardsPlayedThisTurn, floor, segment, gold
  }
  ```
- `previewCardQuiz(index)` — Preview the quiz for a card WITHOUT playing it. Returns: `{ok, state: {question, choices[], correctAnswer, correctIndex, factId, domain, cardType}}`. Use this to see the question before deciding whether to answer correctly or incorrectly.
- `quickPlayCard(index)` — Quick play (1 AP, base damage, no quiz). Returns `{ok, damage?, block?}`.
- `chargePlayCard(index, answerCorrectly)` — Charge play with quiz (2 AP, 1.5× damage if correct, ~0.5× if wrong — FIZZLE_EFFECT_RATIO). `answerCorrectly` is a boolean. Returns `{ok, damage?, quizData?}`. NOTE: This bypasses the visual quiz UI — the quiz is answered programmatically.
- `endTurn()` — End player turn. Returns `{ok: boolean}`. NOTE: Returns `{ok: true}` even after combat ends (graceful degradation — no longer errors when enemy is dead).
- `getQuiz()` — Returns active quiz: `{question, choices: string[], correctIndex: number, mode: string}` or null.
- `getRelicDetails()` — Returns: `[{id, name, description, rarity, trigger, acquiredAtFloor, triggerCount}]`

**QUIZ DATA CAPTURE STRATEGY:**

1. Call `getCombatState()` → each card now has `factQuestion`, `factAnswer`, `factId`, `domain`
2. For detailed quiz data (including distractors): call `previewCardQuiz(index)` → returns full `{question, choices[], correctAnswer, correctIndex}`
3. Play the card: `chargePlayCard(index, true/false)` — answer based on your assessment
4. `previewCardQuiz` does NOT consume AP or play the card — it's purely informational

### Post-Combat

- `getRewardChoices()` — Preview 3-card reward choices WITHOUT accepting. Returns: `[{index, id, cardType, mechanicId, mechanicName, domain, tier, apCost, baseEffectValue, masteryLevel, factId, factQuestion}]`. Returns `[]` when no reward pending. Use BEFORE `acceptReward` to read the options.
- `acceptReward()` — Accept reward (handles cards, relics, gold, and vials). Relics use Phaser overlay accept button; cards use Svelte callbacks.
- `selectRewardType(cardType)` — Pick reward card type by type name.
- `selectRelic(index)` — Pick relic by index.
- `rerollReward()` — Reroll card reward options.
- `delve()` — Delve deeper at checkpoint screen.
- `retreat()` — Cash out at checkpoint screen.
- `restHeal()` — Heal at rest room.
- `restMeditate()` — Meditate at rest room.
- `mysteryContinue()` — Continue past mystery event.
- `getShopInventory()` — Returns shop items: `{relics: [{index, id, name, description, price, sold}], cards: [{index, type, domain, factQuestion, price, sold}], removalCost}`.
- `shopBuyRelic(index)` — Buy a relic from shop.
- `shopBuyCard(index)` — Buy a card from shop.
- `getMysteryEventChoices()` — Returns: `[{index, text}]`.
- `selectMysteryChoice(index)` — Select a mystery event choice.

### Study Mode

- `getStudyPoolSize()` — Returns count of cards eligible for mastery upgrade. Returns `0` when no active run or no upgradeable cards. Read-only. Use BEFORE `startStudy()` to verify the pool is non-empty.
- `startStudy(size)` — Start study session. Returns `{ok: boolean, cardCount: number}`. NOTE: The `size` parameter is no longer functional. The function navigates to the Study screen and clicks the Study button in RestRoomOverlay. Use `__rrScenario.spawn({ screen: 'restStudy' })` for direct access.
- `getStudyCard()` — Get current card: `{question, answer, category, choices?: string[], interval?: number, reps?: number}`. Returns null when session complete.
- `gradeCard(button)` — Grade current card: `'again'` | `'hard'` | `'good'` | `'easy'`. Returns `{ok, nextInterval?: number}`.
- `endStudy()` — End study session. Returns `{ok, studied: number}`.

### Time Control

- `fastForward(hours)` — Advance game clock by N hours (for SM-2 testing). Returns `{ok}`. Shifts all FSRS scheduling fields (nextReviewAt, due, lastReviewAt, lastReview). Fixed in BATCH-004.

### Diagnostics

- `getLeechInfo()` — Returns `{suspended: [], nearLeech: []}` — cards that failed too many times.

### Instant State Spawning (PREFERRED for targeted testing)

For faster setup, use `__rrPlay.spawn()` to jump directly to specific game states instead of clicking through menus. In a Docker actions-file, use `eval`:

```json
{"type":"eval","js":"__rrPlay.spawn({screen:'combat',enemy:'peer_reviewer',playerHp:40,hand:['heavy_strike','block','lifetap'],relics:['whetstone'],turnOverrides:{apCurrent:2,chainMultiplier:1.5,playerState:{statusEffects:[{type:'poison',value:3,turnsRemaining:2}]}},runOverrides:{ascensionLevel:5}})"}
```

Other state-manipulation methods:

- `__rrPlay.patch({turn: {enemy: {currentHP: 5}, isSurge: true}})` — mid-gameplay adjustment
- `__rrPlay.recipes('soul_jar')` — get a recipe for testing a specific element
- `__rrPlay.snapshot('before-boss')` / `__rrPlay.restore(snap)` — snapshot and restore game state

Use `spawn()` instead of normal menu navigation for:

- Testing specific combat scenarios without menu clicks
- Verifying card/relic interactions in controlled conditions
- Testing error paths that are hard to reach naturally
- Quickly jumping between multiple test scenarios

---

## Error Handling Protocol

Apply this protocol whenever any API call returns unexpected results:

1. **`{ok: false}` returned**: Log the error, retry the call once after 1 second. If still failing, diagnose the cause (check console errors, game state, screen). Fix the underlying issue (e.g., wrong screen state, missing prerequisite action) and retry. Only after 3+ failed attempts with different approaches, log the failure with full diagnostics and continue.
2. **Stuck detection**: If `getScreen()` returns the same value for 10+ consecutive calls without progress, take a screenshot AND layout dump (`rrScreenshot` action), call `look()` to dump full state, then try `getAllText()` to see UI options.
3. **Unknown screen**: If `getScreen()` returns an unexpected value, call `getAllText()` to read what's on screen, then handle it.
4. **Combat doesn't end after 30 turns**: Record as HIGH bug (infinite loop), end turn 5 more times, then force navigate away.
5. **After combat ends**: Always check `getScreen()` to determine what comes next:
   - `'cardReward'` → `rerollReward()` (optional) or `acceptReward()` (routes through rewardRoom)
   - `'rewardRoom'` → call `look()` to see reward types, then `acceptReward()`
   - `'retreatOrDelve'` → always `delve()` (to keep the run going)
   - `'dungeonMap'` → `selectMapNode('r0-n0')` or next available
   - `'shopRoom'` → `getShopInventory()` to see items, then `shopBuyRelic(0)` or `shopBuyCard(0)` or skip
   - `'restRoom'` → `restHeal()` or `restMeditate()`
   - `'mysteryEvent'` → `getMysteryEventChoices()` to see choices, then `selectMysteryChoice(0)` or `mysteryContinue()`
   - `'runEnd'` → run is over; start a new run if encounters target not met

### Full-run stuck detection (extended)

For the Full Run Bug Hunter, apply stricter stuck detection:

1. **Stuck detection**: If `getScreen()` returns the same value 3+ consecutive times with no game state progress:
   a. Capture: `__rrLayoutDump()` + `__rrDebug()` + `__rrScreenshotFile()` + `look()` + `getAllText()` + `getRecentEvents(20)`
   b. Try clicking any visible interactive elements found in layout dump
   c. If 3 recovery attempts fail: record as CRITICAL bug, try `navigate('dungeonMap')` as last resort
   d. If that fails too: end run and report

2. **`{ok: false}` returned**: Log error, capture `__rrDebug()` + `__rrLayoutDump()`, retry once after 2 seconds. If still failing, document as BUG with full evidence.

3. **Combat doesn't end after 30 turns**: Record as HIGH bug (infinite loop), end turn 5 more times, then force navigate away.

---

## Screen Router — Universal Post-Action Check

After EVERY action, check `getScreen()` and route:

| Screen | Handler |
|--------|---------|
| `combat` | → Combat turn loop |
| `rewardRoom` | → Reward Room handler (accept reward, wait for transition) |
| `cardReward` | → Redirect to Reward Room handler (card selection is inline in rewardRoom) |
| `dungeonMap` | → Map Navigation (pick next node) |
| `shopRoom` | → Shop handler |
| `restRoom` | → Rest handler |
| `mysteryEvent` | → Mystery handler |
| `retreatOrDelve` | → Retreat/Delve handler |
| `runEnd` | → Run End handler (start new run if target not met) |
| `hub` | → Run ended, start new if floors target not met |
| Unknown | → Log as anomaly, LAYOUT DUMP, try `look()` + `getAllText()` |
