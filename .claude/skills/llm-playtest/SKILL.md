---
name: llm-playtest
description: |
  Batch LLM playtest orchestrator. Spawns Sonnet sub-agents to actually PLAY the game through Playwright MCP + __terraPlay API, each with a unique testing focus (quiz quality, balance curve, fun/engagement, study temple). Produces per-tester reports and a combined summary in data/playtests/llm-batches/. Complements /strategy-analysis (static reasoning about hypothetical states) and /visual-inspect (screenshots) by providing live gameplay with LLM reasoning — the only method that tests real quiz content, actual run flow, and subjective engagement.
user_invocable: true
model: sonnet
---

# /llm-playtest — Live LLM Game Playtest Orchestrator

## What This Skill Does

Spawns Sonnet sub-agents that **actually play the game** through Playwright MCP using the `window.__terraPlay` API. Each agent has a different testing focus and writes a structured report. The orchestrator aggregates all reports into a combined `SUMMARY.md`.

This is NOT screenshot-based visual testing, NOT static balance analysis, NOT a heuristic bot. This is an LLM with real reasoning that interacts with live game systems, reads quiz content, makes choices, and reports what it finds.

---

## When to Use

- After any game changes before a release or milestone
- When you want to know if quizzes are actually good (not just valid)
- When the headless sim shows balance numbers but you want "does it FEEL fun?"
- When study mode changes and you need SM-2 verification
- When adding new cards/relics and want end-to-end run coverage
- When the user asks about overall game quality or readiness
- **PROACTIVE TRIGGER**: Any conversation about quiz quality, game feel, content quality, or release readiness — mention this skill

---

## Arguments

Parse from the user's invocation message:

| Argument | Meaning |
|----------|---------|
| (none) | Run all 4 testers |
| `quiz` | Quiz Quality tester only |
| `balance` | Balance Curve tester only |
| `fun` | Fun/Engagement tester only |
| `study` | Study Temple tester only |
| Comma-separated names | Run named testers only (e.g., `quiz,balance`) |
| `smoke-only` | Phase 0 connectivity check only — do not run testers |
| `runs=N` | Each tester completes N combat encounters (default: 3) |
| `domain=X` | Override domain (default: `general_knowledge`) |

**Examples:**
- `/llm-playtest` — all 4 testers, general_knowledge, 3 encounters each
- `/llm-playtest quiz,fun` — quiz quality + fun/engagement only
- `/llm-playtest domain=history runs=5` — all testers, history domain, 5 encounters
- `/llm-playtest smoke-only` — just verify the game is running and APIs work

---

## Relationship to Other Skills

| Skill | What it does | What this adds |
|-------|-------------|----------------|
| `/strategy-analysis` | LLM reasons about STATIC hypothetical game states | This uses LIVE states from actual gameplay; captures real quiz content |
| `/visual-inspect` | Screenshots and DOM inspection | This does NOT do visual testing — defer to `/visual-inspect` for that |
| `/ux-review` | 120+ UX principle checks on screens | This does NOT audit UI/UX — defer to `/ux-review` for screens |
| `/balance-sim` | 6000 heuristic bot runs for statistical balance data | This adds qualitative "why" and subjective feel that the sim can't provide |
| `/rogue-brain` | Neural agent plays optimally for balance regression | This tests fun/surprise/quiz quality, not optimal play patterns |
| `/inspect` | Master orchestrator — runs ALL methods | This is the 7th testing method `/inspect` can invoke |

**NOT a replacement for any of them. Complements all of them.**

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

---

## Phase 0: Smoke Test (Orchestrator Runs Directly — NOT Sub-Agent)

Before spawning any testers, the orchestrator MUST verify the game is running and APIs are accessible. Run these 6 checks via Playwright MCP directly:

```javascript
// Step 1: Navigate
// mcp__playwright__browser_navigate -> http://localhost:5173?skipOnboarding=true&turbo=true&botMode=true
// Wait 5 seconds.

// Step 2: Check all 6 APIs in one evaluate call
const result = await page.evaluate(async () => {
  const checks = {};

  // Check 1: __terraPlay exists
  checks.terraPlayExists = typeof window.__terraPlay !== 'undefined';

  // Check 2: getScreen() works
  try { checks.getScreen = window.__terraPlay.getScreen(); } catch(e) { checks.getScreen = 'ERROR: ' + e.message; }

  // Check 3: look() returns state
  try { const s = window.__terraPlay.look(); checks.lookWorks = !!s && typeof s === 'object'; } catch(e) { checks.lookWorks = 'ERROR: ' + e.message; }

  // Check 4: __terraScenario exists
  checks.terraScenarioExists = typeof window.__terraScenario !== 'undefined';

  // Check 5: __terraScreenshotFile exists
  checks.screenshotFnExists = typeof window.__terraScreenshotFile === 'function';

  // Check 6: __terraDebug exists
  checks.debugFnExists = typeof window.__terraDebug === 'function';

  return checks;
});
```

**Smoke test PASS criteria:** All 6 checks truthy. If any fail:
- If dev server not running: tell user `npm run dev` is needed, abort
- If APIs missing: warn that `__terraPlay` may not be initialized yet (game may still be loading) — wait 5 more seconds and retry once
- If still failing after retry: report which checks failed, abort with instructions

If `smoke-only` was requested, stop here after reporting results.

---

## Phase 1: Create Batch Directory

Before spawning testers, create the batch manifest:

```javascript
// Find next batch number by reading data/playtests/llm-batches/
// List directories matching BATCH-YYYY-MM-DD-NNN
// Increment the highest NNN (or start at 001 if none for today)
// Create: data/playtests/llm-batches/BATCH-{DATE}-{NNN}/manifest.json
```

**manifest.json structure:**
```json
{
  "batchId": "BATCH-2026-03-27-001",
  "createdAt": "2026-03-27T10:00:00Z",
  "testers": ["quiz-quality", "balance-curve", "fun-engagement", "study-temple"],
  "args": {
    "runs": 3,
    "domain": "general_knowledge"
  },
  "status": "running",
  "smokeTestPassed": true,
  "reports": {}
}
```

---

## Phase 2: Run Testers Sequentially

**IMPORTANT: Run testers SEQUENTIALLY, not in parallel.** They all use Playwright MCP which shares a browser session. Parallel runs would corrupt each other's game state.

For each requested tester, spawn a Sonnet sub-agent with the full self-contained prompt from the templates below. Pass:
- `batchDir`: absolute path to the batch directory (e.g., `/Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-03-27-001`)
- `runs`: number of combat encounters to complete
- `domain`: domain to select

After each tester completes, update `manifest.json` with:
```json
"reports": {
  "quiz-quality": { "status": "complete", "verdict": "ISSUES", "criticalCount": 0, "highCount": 2 }
}
```

---

## Phase 3: Aggregate Results

After all testers complete, read all `*.md` report files in the batch directory and produce `SUMMARY.md`:

```markdown
# Playtest Batch Summary — {BATCH_ID}
**Date**: {DATE} | **Testers**: {N} | **Domain**: {DOMAIN} | **Runs**: {RUNS}

## Overall Verdict: {PASS | ISSUES | FAIL}
(FAIL if any tester reports FAIL; ISSUES if any tester reports ISSUES; PASS only if all PASS)

## Tester Verdicts
| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Quiz Quality | PASS | 0 | 0 | 1 | 2 |
| Balance Curve | ISSUES | 0 | 1 | 2 | 1 |
| Fun/Engagement | PASS | 0 | 0 | 2 | 3 |
| Study Temple | PASS | 0 | 0 | 0 | 1 |

## Cross-Tester Insights
(Issues found by multiple testers get escalated confidence)
- [CONVERGING] Quiz tester + Fun tester both flagged question clarity on floor 1 quizzes
- [SOLO] Balance tester found HP drain too fast in floor 2-3 — not yet corroborated

## All Issues by Severity

### CRITICAL
(none)

### HIGH
- [balance] Floor 2-3 HP drain exceeds safe recovery threshold — player near-dead by floor 3 without rest (Balance Curve)

### MEDIUM
...

## Recommendations
1. {highest impact fix}
2. {second fix}
3. {third fix}

## Next Steps
- Run `/balance-sim` to get statistical confirmation of the HP drain issue
- Run `/visual-inspect` on combat screen to verify visual clarity of quiz UI
- Run `/inspect changed` if balance values are modified
```

Save `SUMMARY.md` to the batch directory. Update `manifest.json` status to `"complete"`.

Report the batch directory path and overall verdict to the user.

---

## Tester 1: Quiz Quality — Full Self-Contained Prompt Template

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt (substituting `{BATCH_DIR}`, `{RUNS}`, `{DOMAIN}`).

---

**QUIZ QUALITY TESTER — SELF-CONTAINED PROMPT**

You are the Quiz Quality Tester for Recall Rogue, a card roguelite where every card is a trivia question. Your job is to play through the game for {RUNS} combat encounters using the `window.__terraPlay` API via Playwright MCP, capture all quiz content you encounter (questions, answers, distractors), and evaluate it against both objective quality checks and subjective educational quality assessments.

**Your output**: Write a markdown report to `{BATCH_DIR}/quiz-quality.md` using the standard report format defined at the end of this prompt.

---

### CRITICAL SCREENSHOT RULE
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` to capture screenshots — saves to `/tmp/terra-screenshot.jpg`, then `Read("/tmp/terra-screenshot.jpg")` to view
- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser's RAF loop blocks it permanently (30s timeout)
- **NEVER** use `page.screenshot()` — same RAF issue
- **NEVER** use `page.context().newCDPSession()` — hangs permanently

---

### Setup

1. Navigate: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&turbo=true&botMode=true`
2. Wait 5 seconds for the game to fully load
3. Take a screenshot to confirm you're at the hub screen

---

### The `window.__terraPlay` API — Full Reference

All calls go through `mcp__playwright__browser_evaluate`. Example: `window.__terraPlay.getScreen()`.

**Navigation & State:**
- `getScreen()` — Returns current screen name (string). Possible values: `'hub'`, `'domainSelect'`, `'archetypeSelect'`, `'dungeonMap'`, `'combat'`, `'cardReward'`, `'rewardRoom'`, `'restRoom'`, `'mysteryEvent'`, `'retreatOrDelve'`, `'runEnd'`
- `look()` — Full game state snapshot. Returns a large object with all current state.
- `getRecentEvents(N)` — Last N events from ring buffer. Use to see what just happened.
- `getAllText()` — All visible text on screen. Use to read UI state.
- `getSessionSummary()` — Aggregate session stats (accuracy, encounters, damage dealt).

**Run Flow:**
- `startRun()` — Start a new run from hub screen. Returns `{ok: boolean}`.
- `selectDomain(domain)` — Pick domain. Use: `'{DOMAIN}'`. Returns `{ok: boolean}`.
- `selectArchetype(archetype)` — Pick archetype. Use: `'balanced'`. Returns `{ok: boolean}`.
- `selectMapNode(nodeId)` — Select a map node. Use `'r0-n0'` for first available. Returns `{ok: boolean}`.

**Combat:**
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
- `quickPlayCard(index)` — Play card at index without quiz. Returns `{ok: boolean, damage?, block?}`.
- `chargePlayCard(index, answerCorrectly)` — Play card with quiz. `answerCorrectly` is boolean — `true` = correct answer, `false` = wrong. Returns `{ok: boolean, damage?, quizData?}`. NOTE: This bypasses the visual quiz UI — the quiz is answered programmatically.
- `endTurn()` — End player turn. Returns `{ok: boolean}`.
- `getQuiz()` — Returns active quiz: `{question, choices: string[], correctIndex: number, mode: string}` or null if no active quiz.

**QUIZ DATA CAPTURE STRATEGY**:
1. Call `getCombatState()` → each card now has `factQuestion`, `factAnswer`, `factId`, `domain`
2. For detailed quiz data (including distractors): call `previewCardQuiz(index)` → returns full `{question, choices[], correctAnswer, correctIndex}`
3. Play the card: `chargePlayCard(index, true/false)` — answer based on your assessment
4. `previewCardQuiz` does NOT consume AP or play the card — it's purely informational

**Post-Combat:**
- `getRunState()` — Returns: `{floor, segment, currency, deckSize, relics: string[], playerHp, playerMaxHp, encountersCompleted}`.
- `acceptReward()` — Accept card reward (takes first option).
- `selectRewardType(cardType)` — Pick reward card type by type name.
- `delve()` — Delve deeper at checkpoint screen.
- `retreat()` — Cash out at checkpoint screen.
- `restHeal()` — Heal at rest room.
- `restMeditate()` — Meditate at rest room.
- `mysteryContinue()` — Continue past mystery event.
- `getShopInventory()` — Returns shop items: `{relics: [{index, id, name, description, price, sold}], cards: [{index, type, domain, factQuestion, price, sold}], removalCost}`.
- `shopBuyRelic(index)` — Buy a relic from shop.
- `shopBuyCard(index)` — Buy a card from shop.
- `rerollReward()` — Reroll card reward options.
- `getMysteryEventChoices()` — Returns: `[{index, text}]`.
- `selectMysteryChoice(index)` — Select a mystery event choice.

**Study Mode:**
- `startStudy(size)` — Start study session with N cards.
- `getStudyCard()` — Returns current study card: `{question, answer, category, choices?: string[]}`.
- `gradeCard(button)` — Grade card: `'again'` | `'hard'` | `'good'` | `'easy'`.
- `endStudy()` — End study session.

---

### Error Handling Protocol

Apply this protocol whenever any API call returns unexpected results:

1. **`{ok: false}` returned**: Log the error, retry the call once after 1 second. If still failing, skip this action and continue.
2. **Stuck detection**: If `getScreen()` returns the same value for 10+ consecutive calls without progress, take a screenshot, call `look()` to dump full state, then try `getAllText()` to see UI options.
3. **Unknown screen**: If `getScreen()` returns an unexpected value, call `getAllText()` to read what's on screen, then handle it.
4. **After combat ends**: Always check `getScreen()` to determine what comes next:
   - `'cardReward'` → `rerollReward()` (optional) or `acceptReward()`
   - `'rewardRoom'` → call `look()` to see reward types, then `acceptReward()`
   - `'retreatOrDelve'` → always `delve()` (to keep the run going)
   - `'dungeonMap'` → `selectMapNode('r0-n0')` or next available
   - `'shopRoom'` → `getShopInventory()` to see items, then `shopBuyRelic(0)` or `shopBuyCard(0)` or skip
   - `'restRoom'` → `restHeal()` or `restMeditate()`
   - `'mysteryEvent'` → `getMysteryEventChoices()` to see choices, then `selectMysteryChoice(0)` or `mysteryContinue()`
   - `'runEnd'` → run is over; start a new run if encounters target not met

---

### Your Testing Protocol

**Step 1: Start a run**
```
startRun() → selectDomain('{DOMAIN}') → selectArchetype('balanced')
```
Wait 2 seconds between each call.

**Step 2: Enter first map node**
```
selectMapNode('r0-n0')
```
Wait 2 seconds. Check `getScreen()` — should be `'combat'`.

**Step 3: Per-combat quiz capture loop**

For each combat encounter:

a) Call `getCombatState()` — record all `hand[i].factQuestion` values (these are the question texts).

b) For each card in hand (index 0 to handSize-1):
   - Call `previewCardQuiz(index)` — capture full quiz: question, choices, correctAnswer, correctIndex
   - Call `chargePlayCard(index, true)` — answer correctly
   - Wait 500ms

c) If out of AP, call `endTurn()`.

d) Repeat steps b-c until combat ends (enemy HP reaches 0).

e) Handle post-combat screen (see Error Handling Protocol above).

**Step 4: After each combat — capture study card data**

After the third combat, use study mode to capture full distractor data:
```
startStudy(10)
```
For each study card: `getStudyCard()` → record `{question, answer, choices}` → `gradeCard('good')`
After 10 cards: `endStudy()`

**Step 5: Repeat for {RUNS} combat encounters total**

---

### Quiz Data to Capture

For each quiz/card you encounter, record:
```json
{
  "question": "text of question",
  "choices": ["choice A", "choice B", "choice C"],
  "correctIndex": 0,
  "domain": "category from hand if available",
  "source": "combat_hand | getQuiz | study_card",
  "anomalies": ["list of any data quality issues noticed"]
}
```

Aim to capture 20+ unique quiz entries across all encounters.

---

### Objective Quality Checklist

Evaluate every captured quiz entry against ALL of these checks. For each check, report: PASS, FAIL, or N/A with count.

| ID | Check | Pass Condition |
|----|-------|---------------|
| O-QZ1 | Choice count | Every quiz has 3 or more answer choices |
| O-QZ2 | No duplicate choices | No two choices are identical strings |
| O-QZ3 | No data artifacts | No choice or question contains: `undefined`, `null`, `NaN`, `[object`, `[Object` |
| O-QZ4 | Question completeness | Question text is not empty, not just whitespace |
| O-QZ5 | Question length | Question text is 20-300 characters |
| O-QZ6 | Correct index in bounds | `correctIndex` is >= 0 and < choices.length |
| O-QZ7 | No near-duplicate choices | No two choices have >90% character similarity (e.g., "Paris" and "Paris, France" — flag as suspicious) |
| O-QZ8 | Domain coverage | At least 2 different domain/category values across all quizzes (not all from same topic) |

---

### Subjective Quality Checklist

Evaluate these by reading the actual question and answer text. Rate each on a scale of 1-5 (5 = excellent, 1 = poor) and explain.

| ID | Check | What to Assess |
|----|-------|---------------|
| S-QZ1 | Distractor plausibility | Are the wrong answers believable wrong answers? Would a student who doesn't know the answer be genuinely fooled? (1 = obviously wrong garbage, 5 = perfectly plausible wrong answers) |
| S-QZ2 | Question clarity | Is the question unambiguous? Could a student know the subject and still be confused about what's being asked? |
| S-QZ3 | Answer correctness | Does the marked correct answer actually seem correct to you? Flag any you'd want a human to double-check. |
| S-QZ4 | Difficulty appropriateness | Given the floor (early/mid/late game), is the difficulty appropriate? Early floors should have easier facts. |
| S-QZ5 | Cultural bias | Does any question assume knowledge from a specific culture (US-centric, Western-centric)? Flag if so. |

---

### Standard Report Format

Write your report to `{BATCH_DIR}/quiz-quality.md`:

```markdown
# Quiz Quality Report — {BATCH_ID}
**Tester**: Quiz Quality | **Model**: sonnet | **Domain**: {DOMAIN} | **Encounters**: {N}

## Verdict: {PASS | ISSUES | FAIL}
(FAIL if any CRITICAL issues found; ISSUES if any HIGH issues found; PASS otherwise)

## Summary
- Total quizzes captured: N
- Quizzes with full data (choices[]): N
- Quizzes with question text only: N
- Domains represented: [list]

## Objective Findings
| Check | Result | Pass Count | Fail Count | Notes |
|-------|--------|------------|------------|-------|
| O-QZ1 | PASS | 23/23 | 0/23 | |
| O-QZ2 | PASS | 23/23 | 0/23 | |
| O-QZ3 | FAIL | 21/23 | 2/23 | Two questions contained "undefined" in choice text |
...

## Subjective Assessments
| Check | Rating (1-5) | Representative Examples | Issues Found |
|-------|-------------|------------------------|-------------|
| S-QZ1 Distractor Plausibility | 3/5 | "Q: Capital of France? Wrong: Germany" — Germany is not a plausible city name | Distractors often wrong category (country vs city) |
...

## Issues Found

### CRITICAL
(none)

### HIGH
- **O-QZ3 Artifacts**: 2 quizzes found with "undefined" in choice text
  - Question: "What is the largest planet?" | Choices: ["Jupiter", "undefined", "Saturn"]
  - Question: "Who wrote Hamlet?" | Choices: ["Shakespeare", "null", "Marlowe"]

### MEDIUM
- **S-QZ1 Distractor Quality**: 7/23 quizzes (30%) have implausible distractors — answers that are clearly the wrong type (country names for city questions, animal names for plant questions)

### LOW
...

## Raw Quiz Data
```json
[
  { "question": "...", "choices": ["A", "B", "C"], "correctIndex": 0, "anomalies": [] },
  ...
]
```
```

---

## Tester 2: Balance Curve (Live) — Full Self-Contained Prompt Template

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt.

---

**BALANCE CURVE TESTER — SELF-CONTAINED PROMPT**

You are the Balance Curve Tester for Recall Rogue. Your job is to play {RUNS} complete combat encounters (or until 2 full deaths), simulating a realistic mixed-skill player (~70% quiz accuracy), and produce a floor-by-floor balance report with both objective measurements and subjective assessments.

**Your output**: Write a markdown report to `{BATCH_DIR}/balance-curve.md` using the standard report format defined at the end of this prompt.

---

### CRITICAL SCREENSHOT RULE
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` — saves to `/tmp/terra-screenshot.jpg`, then `Read("/tmp/terra-screenshot.jpg")` to view
- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser RAF blocks it (30s timeout)
- **NEVER** use `page.screenshot()` — same RAF issue

---

### Setup

1. Navigate: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&turbo=true&botMode=true`
2. Wait 5 seconds
3. Take a screenshot to confirm hub screen

---

### The `window.__terraPlay` API — Full Reference

All calls go through `mcp__playwright__browser_evaluate`.

**Navigation & State:**
- `getScreen()` — Current screen name: `'hub'`, `'domainSelect'`, `'archetypeSelect'`, `'dungeonMap'`, `'combat'`, `'cardReward'`, `'rewardRoom'`, `'restRoom'`, `'mysteryEvent'`, `'retreatOrDelve'`, `'runEnd'`
- `look()` — Full game state snapshot
- `getRecentEvents(N)` — Last N events from ring buffer
- `getSessionSummary()` — Aggregate stats

**Run Flow:**
- `startRun()` — Start run from hub
- `selectDomain(domain)` — Pick domain. Use: `'{DOMAIN}'`
- `selectArchetype(archetype)` — Pick archetype. Use: `'balanced'`
- `selectMapNode(nodeId)` — Select map node. Use: `'r0-n0'` for first available

**Combat:**
- `getCombatState()` — Returns full combat state:
  ```
  {
    playerHp, playerMaxHp, playerBlock,
    playerStatusEffects: [{type, value, turnsRemaining}],
    ap, apMax,
    enemyName, enemyHp, enemyMaxHp, enemyBlock,
    enemyIntent: {type, value, telegraph, hitCount, statusEffect},
    enemyStatusEffects: [{type, value, turnsRemaining}],
    handSize,
    hand: [{type, mechanic, mechanicName, tier, apCost, baseEffectValue, domain, factId, factQuestion, factAnswer, isLocked, isCursed, isUpgraded, masteryLevel, chainType}],
    turn, cardsPlayedThisTurn, floor, segment, gold
  }
  ```
- `previewCardQuiz(index)` — Preview the quiz for a card WITHOUT playing it. Returns: `{ok, state: {question, choices[], correctAnswer, correctIndex, factId, domain, cardType}}`. Use this to see quiz difficulty before choosing quick vs charge play.
- `quickPlayCard(index)` — Quick play (1x damage, 1 AP). Returns: `{ok, damage?, block?}`
- `chargePlayCard(index, answerCorrectly)` — Charge play with quiz (1.5x if correct, ~0.7x if wrong). Returns: `{ok, damage?, quizData?}`
- `endTurn()` — End turn. Returns: `{ok}`
- `getRunState()` — Returns: `{floor, segment, currency, deckSize, relics: string[], playerHp, playerMaxHp, encountersCompleted}`
- `getRelicDetails()` — Returns: `[{id, name, description, rarity, trigger, acquiredAtFloor, triggerCount}]`

**Post-Combat:**
- `acceptReward()` — Accept first card reward
- `selectRewardType(cardType)` — Pick reward card by type
- `selectRelic(index)` — Pick relic by index
- `rerollReward()` — Reroll card reward options
- `delve()` — Delve deeper
- `retreat()` — Cash out
- `restHeal()` — Heal at rest room
- `restMeditate()` — Meditate at rest room
- `mysteryContinue()` — Continue past mystery event
- `getShopInventory()` — Returns shop items: `{relics: [{index, id, name, description, price, sold}], cards: [{index, type, domain, factQuestion, price, sold}], removalCost}`
- `shopBuyRelic(index)` — Buy a relic from shop
- `shopBuyCard(index)` — Buy a card from shop
- `getMysteryEventChoices()` — Returns: `[{index, text}]`
- `selectMysteryChoice(index)` — Select a mystery event choice

---

### Error Handling Protocol

1. **`{ok: false}`**: Log error, retry once, skip and continue
2. **Stuck (same screen 10+ calls)**: Take screenshot, call `look()`, then `getAllText()`
3. **After combat ends**: Check `getScreen()`:
   - `'cardReward'` → `rerollReward()` (optional) or `acceptReward()`
   - `'rewardRoom'` → `acceptReward()`
   - `'retreatOrDelve'` → `delve()` (always — to continue the run)
   - `'dungeonMap'` → `selectMapNode('r0-n0')`
   - `'shopRoom'` → `getShopInventory()` to see items, then `shopBuyRelic(0)` or `shopBuyCard(0)` or skip
   - `'restRoom'` → `restHeal()` or `restMeditate()`
   - `'mysteryEvent'` → `getMysteryEventChoices()` to see choices, then `selectMysteryChoice(0)` or `mysteryContinue()`
   - `'runEnd'` → Run over; start a new run if not done

---

### Player Simulation Rules

Simulate a realistic mixed-skill player:
- **70% correct quiz answers** — use `chargePlayCard(i, Math.random() < 0.7)` for charge plays
- **Mix quick and charge plays** — roughly 40% quick, 60% charge (to simulate a player who sometimes can't remember)
- **Card selection**: prefer high-AP offensive cards when enemy HP > 50%; prefer defensive/block cards when player HP < 30%
- **Use `previewCardQuiz(index)`** to see quiz difficulty before choosing quick vs charge play — harder questions are more likely to be played quick
- **Use `getCombatState()`** to read `enemyIntent` (type, value, telegraph, hitCount) for tactical decisions, and track `playerStatusEffects` / `enemyStatusEffects` to measure buff/debuff impact
- **DO NOT play optimally** — this is a balance curve check, not optimal play. Play like a typical student who knows the game basics but makes occasional suboptimal decisions.

---

### Data to Record Per Combat

Before combat starts: `getCombatState()` → record initial state.

During combat, after EVERY card play: call `getCombatState()` and record:
- Turn number
- Player HP before/after
- Enemy HP before/after
- Card played (type, ap cost)
- Play mode (quick vs charge)
- Answer correct (true/false/N/A for quick)
- Damage dealt / block gained

After combat ends: `getRunState()` → record floor, currency, deckSize.

---

### Objective Balance Checklist

| ID | Check | Pass Condition |
|----|-------|---------------|
| O-BC1 | Floor 1 survivability | Player reaches floor 2 with >40% HP in both test runs |
| O-BC2 | Floor 2-3 danger | Player takes meaningful damage in floors 2-3 (not trivialized) — enemy deals >10 damage per encounter |
| O-BC3 | Quick vs Charge value | Charge plays deal meaningfully more than quick plays (ratio should be 1.3-2.0x) |
| O-BC4 | HP recovery pace | After a full floor (2-3 encounters), player HP isn't trapped in death spiral |
| O-BC5 | Gold economy | Player has 50-200 gold at checkpoint — enough for shop but not unlimited |
| O-BC6 | Combat length | Each combat lasts 3-8 turns (not 1-hit trivial, not 20+ turn grinds) |
| O-BC7 | Enemy damage scaling | Floor 2 enemies deal noticeably more damage than floor 1 enemies |
| O-BC8 | No instant death | Player never drops from >60% HP to dead in a single enemy turn (unless boss encounter) |

---

### Subjective Balance Assessment

| ID | Check | What to Assess |
|----|-------|---------------|
| S-BC1 | Tension curve | Does each combat feel tense? Are there moments of real danger? Rate 1-5. |
| S-BC2 | Agency | Does the mix of quick vs charge feel like a meaningful decision? Or is one always correct? |
| S-BC3 | Reward pacing | Does the post-combat reward feel earned and exciting? Or too frequent/too rare? |
| S-BC4 | Deck growth | Does the deck feel meaningfully more powerful after 2-3 floors? Can you feel the progression? |
| S-BC5 | Death fairness | If you died (or came close), did it feel fair? Or punishing in a way that felt unearned? |

---

### Standard Report Format

Write your report to `{BATCH_DIR}/balance-curve.md`:

```markdown
# Balance Curve Report — {BATCH_ID}
**Tester**: Balance Curve | **Model**: sonnet | **Domain**: {DOMAIN} | **Encounters**: {N_ACTUAL} | **Deaths**: {DEATHS}

## Verdict: {PASS | ISSUES | FAIL}

## Floor-by-Floor Data
| Floor | Encounter | Start HP | End HP | Enemy | Enemy Initial HP | Turns | Gold Earned |
|-------|-----------|----------|--------|-------|------------------|-------|-------------|
| 1 | 1 | 80/80 | 65/80 | Cave Bat | 40 | 4 | 15 |
...

## Damage Exchange Log
(Per-turn damage dealt/received table — include for first 2 encounters in detail)

## Objective Findings
| Check | Result | Measured Value | Expected Range | Notes |
|-------|--------|---------------|----------------|-------|

## Subjective Assessments
| Check | Rating | Notes |
|-------|--------|-------|

## Issues Found
### CRITICAL
### HIGH
### MEDIUM
### LOW

## Raw Run Data
```json
{ "runs": [...], "encounters": [...] }
```
```

---

## Tester 3: Fun/Engagement — Full Self-Contained Prompt Template

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt.

---

**FUN/ENGAGEMENT TESTER — SELF-CONTAINED PROMPT**

You are the Fun & Engagement Tester for Recall Rogue. Your job is to play {RUNS} combat encounters as a first-time-ish player experiencing the game for the first time, providing genuine moment-to-moment commentary about what feels exciting, confusing, rewarding, or frustrating. This is about subjective experience — you are looking for things the statistical systems miss.

**Your output**: Write a markdown report to `{BATCH_DIR}/fun-engagement.md` using the standard report format defined at the end of this prompt.

---

### CRITICAL SCREENSHOT RULE
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` — saves to `/tmp/terra-screenshot.jpg`, then `Read("/tmp/terra-screenshot.jpg")` to view
- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser RAF blocks it (30s timeout)

---

### Setup

1. Navigate: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&turbo=true&botMode=true`
2. Wait 5 seconds
3. Take screenshot — note your first impressions

---

### The `window.__terraPlay` API — Full Reference

All calls via `mcp__playwright__browser_evaluate`.

**Navigation & State:**
- `getScreen()` — Current screen: `'hub'`, `'domainSelect'`, `'archetypeSelect'`, `'dungeonMap'`, `'combat'`, `'cardReward'`, `'rewardRoom'`, `'restRoom'`, `'mysteryEvent'`, `'retreatOrDelve'`, `'runEnd'`
- `look()` — Full game state
- `getAllText()` — All visible text (use to read UI when confused)
- `getRecentEvents(N)` — Last N events from ring buffer

**Run Flow:**
- `startRun()` — Start from hub
- `selectDomain(domain)` — Pick domain: `'{DOMAIN}'`
- `selectArchetype(archetype)` — Pick: `'balanced'`
- `selectMapNode(nodeId)` — Enter map node: `'r0-n0'`

**Combat:**
- `getCombatState()` — Returns full combat state including `playerHp, playerMaxHp, playerBlock, playerStatusEffects, ap, apMax, enemyName, enemyHp, enemyMaxHp, enemyBlock, enemyIntent: {type, value, telegraph, hitCount}, enemyStatusEffects, handSize, hand: [{type, mechanic, mechanicName, tier, apCost, domain, factQuestion, factAnswer, chainType}], turn, floor, segment, gold`
- `previewCardQuiz(index)` — Preview the quiz for a card WITHOUT playing it. Returns: `{ok, state: {question, choices[], correctAnswer, correctIndex, domain, cardType}}`. Use before deciding whether to quick-play or charge-play.
- `quickPlayCard(index)` — Quick play
- `chargePlayCard(index, answerCorrectly)` — Charge play with quiz (true = correct)
- `endTurn()` — End turn

**Post-Combat:**
- `acceptReward()` — Accept first card reward
- `rerollReward()` — Reroll card reward options
- `delve()` — Delve deeper
- `retreat()` — Cash out
- `restHeal()` — Heal
- `restMeditate()` — Meditate at rest room
- `mysteryContinue()` — Continue past mystery
- `getShopInventory()` — Returns shop items: `{relics: [{index, id, name, description, price, sold}], cards: [{index, type, domain, factQuestion, price, sold}], removalCost}`
- `shopBuyRelic(index)` — Buy a relic from shop
- `shopBuyCard(index)` — Buy a card from shop
- `getMysteryEventChoices()` — Returns: `[{index, text}]`
- `selectMysteryChoice(index)` — Select a mystery event choice

---

### Error Handling Protocol

1. **`{ok: false}`**: Log, retry once, skip and continue
2. **Stuck**: Screenshot, `look()`, `getAllText()`
3. **After combat**: Check `getScreen()`:
   - `'cardReward'` → `rerollReward()` (optional, to see variety) or `acceptReward()`
   - `'rewardRoom'` → `acceptReward()`
   - `'retreatOrDelve'` → `delve()`
   - `'dungeonMap'` → `selectMapNode('r0-n0')`
   - `'shopRoom'` → `getShopInventory()` to see items, then `shopBuyRelic(0)` or `shopBuyCard(0)` or skip
   - `'restRoom'` → `restHeal()` or `restMeditate()`
   - `'mysteryEvent'` → `getMysteryEventChoices()` to see choices, then `selectMysteryChoice(0)` or `mysteryContinue()`
   - `'runEnd'` → Start new run if not done

---

### Your Mindset

Pretend you are:
- A player who has read the basic tutorial but hasn't played much
- Genuinely trying to win, but not playing optimally
- Paying attention to how the game FEELS at each moment
- Thinking out loud about card choices and why

**Before every card play**: Describe your reasoning in 1-2 sentences. What are you trying to accomplish? Does the choice feel meaningful or obvious?

**After each combat**: Write a 3-5 sentence reaction. Did you feel in control? Stressed? Bored? Surprised?

**At non-combat screens**: Describe the tradeoffs. If there's a card reward, which would you take and why? If there's a mystery event, does the choice feel interesting?

---

### Decision Log Template

For each card play, record:
```
Turn {N}: {CardName} — {Quick/Charge} — Reasoning: "..." — Outcome: {damage/block amount}
```

---

### Objective Engagement Checklist

| ID | Check | Pass Condition |
|----|-------|---------------|
| O-FE1 | No dead turns | No turn where ALL cards feel useless (no valid plays) |
| O-FE2 | No mandatory turns | No turn where there is only ONE valid card to play (no decision to make) |
| O-FE3 | Post-combat screen clarity | After combat, it's always clear what to do next (no UI confusion) |
| O-FE4 | No unexplained state changes | Player HP/AP/gold never changes without a visible reason |
| O-FE5 | Reward screen has meaningful choices | Card reward offers at least 2 meaningfully different cards |

---

### Subjective Engagement Checklist

| ID | Check | What to Assess |
|----|-------|---------------|
| S-FE1 | First 60 seconds excitement | Does the game grab your attention immediately? Any "wait, that's cool" moments? |
| S-FE2 | Card choice depth | Do card decisions feel like they matter? Or is there usually one obviously correct play? Rate 1-5. |
| S-FE3 | Quiz integration feel | Does answering quizzes feel integrated into the game, or does it feel like an interruption? |
| S-FE4 | Progression reward | After completing an encounter and getting rewards, does it feel satisfying? |
| S-FE5 | Clarity of feedback | Can you tell what's happening on screen? Do you understand why damage numbers are what they are? |
| S-FE6 | Pacing | Does the game feel too slow, too fast, or just right? |
| S-FE7 | "One more turn" feeling | At the end of a run or encounter, do you want to keep playing? |
| S-FE8 | Learning curve | Does the game teach itself through play? Or are you frequently confused about mechanics? |

---

### Standard Report Format

Write your report to `{BATCH_DIR}/fun-engagement.md`:

```markdown
# Fun/Engagement Report — {BATCH_ID}
**Tester**: Fun/Engagement | **Model**: sonnet | **Domain**: {DOMAIN} | **Encounters Played**: {N}

## Verdict: {PASS | ISSUES | FAIL}

## First Impressions
(Your immediate reaction to loading the game)

## Combat Narrative Log
### Encounter 1 (Floor {N}, vs {Enemy})
**Turn 1**: [cards available] → chose [card] because [reasoning] → result
**Turn 2**: ...
**Post-combat reaction**: ...

### Encounter 2...

## Decision Quality Analysis
(Which turns felt like genuine decisions vs obvious plays)
- Meaningful decisions: {N}/{TOTAL} turns
- "Obvious only one play" turns: {N}/{TOTAL} turns
- Dead turns (nothing useful): {N}/{TOTAL} turns

## Objective Findings
| Check | Result | Notes |
|-------|--------|-------|

## Subjective Assessments
| Check | Rating | Notes |
|-------|--------|-------|

## Issues Found
### CRITICAL
### HIGH
### MEDIUM
### LOW

## Notable Moments
(Specific moments that were particularly good or bad — the game designer wants these)
- [HIGHLIGHT] Turn 3 of encounter 2: playing a charge card and getting it right for a huge damage hit felt GREAT
- [LOWLIGHT] Mystery event text was confusing — not clear which option was better
```

---

## Tester 4: Study Temple — Full Self-Contained Prompt Template

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt.

---

**STUDY TEMPLE TESTER — SELF-CONTAINED PROMPT**

You are the Study Temple Tester for Recall Rogue. Your job is to verify the study mode (spaced repetition / SM-2 system) works correctly — both its mechanics and its content quality. You'll run two study sessions with a time-advance between them to verify the SM-2 scheduling logic.

**Your output**: Write a markdown report to `{BATCH_DIR}/study-temple.md` using the standard report format defined at the end of this prompt.

---

### CRITICAL SCREENSHOT RULE
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` — saves to `/tmp/terra-screenshot.jpg`, then `Read("/tmp/terra-screenshot.jpg")` to view
- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser RAF blocks it

---

### Setup

1. Navigate: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&turbo=true&botMode=true`
2. Wait 5 seconds
3. Take a screenshot

---

### The `window.__terraPlay` API — Study-Relevant Methods

All calls via `mcp__playwright__browser_evaluate`.

**Study Mode:**
- `startStudy(size)` — Start study session. `size` = number of cards to study. Returns `{ok: boolean, cardCount: number}`.
- `getStudyCard()` — Get current card: `{question, answer, category, choices?: string[], interval?: number, reps?: number}`. Returns null when session complete.
- `gradeCard(button)` — Grade current card: `'again'` | `'hard'` | `'good'` | `'easy'`. Returns `{ok, nextInterval?: number}`.
- `endStudy()` — End study session. Returns `{ok, studied: number}`.

**Time Control:**
- `fastForward(hours)` — Advance game clock by N hours (for SM-2 testing). Returns `{ok}`.

**Diagnostics:**
- `getLeechInfo()` — Returns `{suspended: [], nearLeech: []}` — cards that failed too many times.
- `getSessionSummary()` — Returns aggregate stats including review accuracy.
- `getScreen()` — Current screen name
- `getAllText()` — All visible text

**Navigation (if needed to reach study):**
- `startRun()` — Start from hub (study mode may be accessible from hub)
- `getScreen()` — Verify current screen

---

### Error Handling Protocol

1. **`startStudy()` returns `{ok: false}`**: Study mode may not be accessible from current screen. Try navigating: check `getScreen()`, use `getAllText()` to find UI options.
2. **`getStudyCard()` returns null immediately**: Session may already be complete (no due cards). Try `fastForward(24)` to advance time, then `startStudy(10)` again.
3. **Any other `{ok: false}`**: Log, retry once, skip.

---

### Study Protocol

**Session 1 — Baseline:**
1. `startStudy(10)` — Study 10 cards
2. For cards 1-5: grade as `'again'` (failed — should reschedule soon)
3. For cards 6-8: grade as `'good'` (passed — should reschedule later)
4. For cards 9-10: grade as `'easy'` (mastered — long interval)
5. `endStudy()`
6. `getLeechInfo()` — record any near-leech cards
7. `getSessionSummary()` — record stats

Record all cards and their questions for content analysis.

**Time Advance:**
8. `fastForward(2)` — Advance 2 hours

**Session 2 — SM-2 Verification:**
9. `startStudy(10)` — Start second session
10. Record which cards appear:
    - "Again" cards (graded failing) SHOULD reappear now (short interval)
    - "Good" cards SHOULD NOT reappear (interval > 2 hours)
    - "Easy" cards DEFINITELY should not reappear
11. For each card that appears: `getStudyCard()` → record details → `gradeCard('good')`
12. `endStudy()`

---

### Objective Checklist

| ID | Check | Pass Condition |
|----|-------|---------------|
| O-ST1 | Session starts | `startStudy(10)` returns `{ok: true}` with cardCount > 0 |
| O-ST2 | Card data complete | Every `getStudyCard()` returns non-null question AND answer (not empty, not "undefined") |
| O-ST3 | Grade accepts all types | `gradeCard('again')`, `gradeCard('hard')`, `gradeCard('good')`, `gradeCard('easy')` all return `{ok: true}` |
| O-ST4 | Session ends cleanly | `endStudy()` returns `{ok: true}` |
| O-ST5 | SM-2 reschedule — "again" cards | After `fastForward(2)`, "again"-graded cards reappear in session 2 |
| O-ST6 | SM-2 reschedule — "good" cards | "good"-graded cards do NOT reappear after only 2 hours |
| O-ST7 | No data artifacts | No card question/answer contains `undefined`, `null`, `NaN`, `[object` |

---

### Subjective Quality Checklist

| ID | Check | What to Assess |
|----|-------|---------------|
| S-ST1 | Question-answer pairing quality | Does each answer actually answer the question? Are there any mismatches? |
| S-ST2 | Study session pacing | Does studying 10 cards feel appropriately short (2-3 minutes)? Not too long? |
| S-ST3 | Grade button clarity | Is it clear what 'again'/'hard'/'good'/'easy' mean without explanation? |
| S-ST4 | Learning value | After studying 10 cards, would you actually feel like you learned something? |

---

### Standard Report Format

Write your report to `{BATCH_DIR}/study-temple.md`:

```markdown
# Study Temple Report — {BATCH_ID}
**Tester**: Study Temple | **Model**: sonnet | **Domain**: {DOMAIN}

## Verdict: {PASS | ISSUES | FAIL}

## Session 1 Summary
- Cards studied: N
- "Again" graded: N (question list)
- "Hard" graded: N
- "Good" graded: N
- "Easy" graded: N
- Near-leech cards found: N

## Session 2 Summary (after +2 hours)
- Cards appeared: N
- "Again" cards that reappeared: N/N (expected: all)
- "Good" cards that reappeared: N/N (expected: 0)
- "Easy" cards that reappeared: N/N (expected: 0)

## SM-2 Scheduling Verdict
(PASS / FAIL with explanation)

## Content Quality Sample
| Question | Answer | Quality Notes |
|----------|--------|---------------|
| "..." | "..." | Good — clear Q and A |
| "..." | "..." | ISSUE: Answer appears to be wrong |

## Objective Findings
| Check | Result | Notes |
|-------|--------|-------|

## Subjective Assessments
| Check | Rating | Notes |
|-------|--------|-------|

## Issues Found
### CRITICAL
### HIGH
### MEDIUM
### LOW

## All Studied Cards (Raw)
```json
[{ "question": "...", "answer": "...", "graded": "good" }, ...]
```
```

---

## Integration with /inspect

The `/inspect` orchestrator can invoke `/llm-playtest` as its **7th testing method**. When `/inspect` runs on:
- **Cards**: add `quiz,balance` testers to verify quiz content for those card domains
- **Enemies**: add `balance` tester to verify HP/damage scaling feel
- **Quiz Systems**: add `quiz,study` testers for full content + SM-2 verification
- **Screens**: `fun` tester for engagement quality (visual screens handled separately by `/visual-inspect`)
- **Overall game**: all 4 testers

The `/inspect` skill should document in its Phase 3 aggregation that LLM playtest results are incorporated alongside other methods.

---

## Output Locations

All batch output is stored in:
```
data/playtests/llm-batches/
  BATCH-YYYY-MM-DD-NNN/
    manifest.json         — batch metadata and status
    quiz-quality.md       — Quiz Quality tester report
    balance-curve.md      — Balance Curve tester report
    fun-engagement.md     — Fun/Engagement tester report
    study-temple.md       — Study Temple tester report
    SUMMARY.md            — Aggregated cross-tester summary
```

Batch IDs use format `BATCH-YYYY-MM-DD-NNN` (e.g., `BATCH-2026-03-27-001`). NNN increments per day.
