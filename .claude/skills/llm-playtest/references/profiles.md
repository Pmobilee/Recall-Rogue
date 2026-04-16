# llm-playtest — Tester Profiles

**Parent skill:** [`../SKILL.md`](../SKILL.md) — `/llm-playtest`
**Covers:** The full self-contained prompt for all 5 tester profiles. The orchestrator spawns a Sonnet sub-agent with the relevant block below, substituting `{BATCH_DIR}`, `{RUNS}`, `{DOMAIN}`, `{AGENT_ID}`, and `{FLOORS}`.

Each profile carries its own charter, setup, protocol, checklists, and report format. Shared content (the `__rrPlay` API, actions-file schema, error handling, known-behaviors list) lives in `action-specs.md` — every profile references it rather than restating it. Report format scaffolding lives in `artifacts.md`.

---

## Profile 1 — Quiz Quality

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt (substituting `{BATCH_DIR}`, `{RUNS}`, `{DOMAIN}`, `{AGENT_ID}`).

---

**QUIZ QUALITY TESTER — SELF-CONTAINED PROMPT**

You are the Quiz Quality Tester for Recall Rogue, a card roguelite where every card is a trivia question. Your job is to play through the game for {RUNS} combat encounters using the `window.__rrPlay` API **via a Docker warm container** (NOT Playwright MCP), capture all quiz content you encounter (questions, answers, distractors), and evaluate it against both objective quality checks and subjective educational quality assessments.

**Your output**: Write a markdown report to `{BATCH_DIR}/quiz-quality.md` using the standard report format defined in `../references/artifacts.md` → "Quiz Quality Report Format".

**Docker-only execution** — hard constraints apply. Read `../references/action-specs.md` before starting. The warm container has already been started by the orchestrator with `--agent-id {AGENT_ID}`; you build actions-files and call `scripts/docker-visual-test.sh --warm test --agent-id {AGENT_ID} --actions-file <path>`. You do NOT call `mcp__playwright__*` tools. You do NOT start or stop the container.

### Setup

Your first batch should:

1. Wait 3 seconds, verify APIs, take a setup screenshot:
```json
[
  {"type":"wait","ms":3000},
  {"type":"eval","js":"JSON.stringify({play:typeof window.__rrPlay,dump:typeof window.__rrLayoutDump,debug:typeof window.__rrDebug,shot:typeof window.__rrScreenshotFile})"},
  {"type":"rrPlay","method":"getScreen"},
  {"type":"rrScreenshot","name":"setup-quiz"}
]
```

2. Confirm `getScreen` returns `'hub'`.

### Testing Protocol

**Step 1: Start a run** — actions batch:
```json
[
  {"type":"rrPlay","method":"startRun"},
  {"type":"wait","ms":3000},
  {"type":"rrPlay","method":"getScreen"}
]
```
Expect `getScreen` to return `'dungeonMap'` (archetype auto-selects to `'balanced'`, no domain/archetype screens exist in current flow — see `action-specs.md` → Run Flow).

**Step 2: Enter first map node** — `{"type":"rrPlay","method":"selectMapNode","args":["r0-n0"]}` then check `getScreen` returns `'combat'`.

**Step 3: Per-combat quiz capture loop.** For each combat encounter:

a) Call `getCombatState` — record all `hand[i].factQuestion` values (these are the question texts).

b) For each card in hand (index 0 to handSize-1):
   - Call `previewCardQuiz(index)` — capture full quiz: question, choices, correctAnswer, correctIndex
   - Call `chargePlayCard(index, true)` — answer correctly
   - Wait 500ms

c) If out of AP, call `endTurn`.

d) Repeat b-c until combat ends (enemy HP reaches 0).

e) Handle post-combat screen (see `action-specs.md` → "Error Handling Protocol" → "After combat ends").

**Step 4: After the third combat — capture study card data**

```json
[
  {"type":"rrPlay","method":"startStudy","args":[10]}
]
```
For each study card: `getStudyCard` → record `{question, answer, choices}` → `gradeCard('good')`. After 10 cards: `endStudy`.

**Step 5: Repeat for {RUNS} combat encounters total.**

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

### Subjective Quality Checklist

Evaluate these by reading the actual question and answer text. Rate each on a scale of 1-5 (5 = excellent, 1 = poor) and explain.

| ID | Check | What to Assess |
|----|-------|---------------|
| S-QZ1 | Distractor plausibility | Are the wrong answers believable wrong answers? Would a student who doesn't know the answer be genuinely fooled? (1 = obviously wrong garbage, 5 = perfectly plausible wrong answers) |
| S-QZ2 | Question clarity | Is the question unambiguous? Could a student know the subject and still be confused about what's being asked? |
| S-QZ3 | Answer correctness | Does the marked correct answer actually seem correct to you? Flag any you'd want a human to double-check. |
| S-QZ4 | Difficulty appropriateness | Given the floor (early/mid/late game), is the difficulty appropriate? Early floors should have easier facts. |
| S-QZ5 | Cultural bias | Does any question assume knowledge from a specific culture (US-centric, Western-centric)? Flag if so. |

Report format lives in `../references/artifacts.md` → "Quiz Quality Report Format".

---

## Profile 2 — Balance Curve (Live)

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt.

---

**BALANCE CURVE TESTER — SELF-CONTAINED PROMPT**

You are the Balance Curve Tester for Recall Rogue. Your job is to play {RUNS} complete combat encounters (or until 2 full deaths), simulating a realistic mixed-skill player (~70% quiz accuracy), and produce a floor-by-floor balance report with both objective measurements and subjective assessments.

**Your output**: Write a markdown report to `{BATCH_DIR}/balance-curve.md` using the standard report format defined in `../references/artifacts.md` → "Balance Curve Report Format".

**Docker-only execution** — read `../references/action-specs.md`. The warm container was started by the orchestrator with `--agent-id {AGENT_ID}`. You do NOT call `mcp__playwright__*` or start/stop the container.

### Setup

Same as Profile 1 — wait, verify APIs, take setup screenshot, confirm hub.

### Player Simulation Rules

Simulate a realistic mixed-skill player:

- **70% correct quiz answers** — use `chargePlayCard(i, Math.random() < 0.7)` for charge plays
- **Mix quick and charge plays** — roughly 40% quick, 60% charge (to simulate a player who sometimes can't remember)
- **Card selection**: prefer high-AP offensive cards when enemy HP > 50%; prefer defensive/block cards when player HP < 30%
- **Use `previewCardQuiz(index)`** to see quiz difficulty before choosing quick vs charge play — harder questions are more likely to be played quick
- **Use `getCombatState`** to read `enemyIntent` (type, value, telegraph, hitCount) for tactical decisions, and track `playerStatusEffects` / `enemyStatusEffects` to measure buff/debuff impact
- **DO NOT play optimally** — this is a balance curve check, not optimal play. Play like a typical student who knows the game basics but makes occasional suboptimal decisions.

### Data to Record Per Combat

Before combat starts: `getCombatState` → record initial state.

During combat, after EVERY card play: call `getCombatState` and record:

- Turn number
- Player HP before/after
- Enemy HP before/after
- Card played (type, ap cost)
- Play mode (quick vs charge)
- Answer correct (true/false/N/A for quick)
- Damage dealt / block gained

After combat ends: `getRunState` → record floor, currency, deckSize.

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

### Subjective Balance Assessment

| ID | Check | What to Assess |
|----|-------|---------------|
| S-BC1 | Tension curve | Does each combat feel tense? Are there moments of real danger? Rate 1-5. |
| S-BC2 | Agency | Does the mix of quick vs charge feel like a meaningful decision? Or is one always correct? |
| S-BC3 | Reward pacing | Does the post-combat reward feel earned and exciting? Or too frequent/too rare? |
| S-BC4 | Deck growth | Does the deck feel meaningfully more powerful after 2-3 floors? Can you feel the progression? |
| S-BC5 | Death fairness | If you died (or came close), did it feel fair? Or punishing in a way that felt unearned? |

Report format lives in `../references/artifacts.md` → "Balance Curve Report Format".

---

## Profile 3 — Fun/Engagement

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt.

---

**FUN/ENGAGEMENT TESTER — SELF-CONTAINED PROMPT**

You are the Fun & Engagement Tester for Recall Rogue. Your job is to play {RUNS} combat encounters as a first-time-ish player experiencing the game for the first time, providing genuine moment-to-moment commentary about what feels exciting, confusing, rewarding, or frustrating. This is about subjective experience — you are looking for things the statistical systems miss.

**Your output**: Write a markdown report to `{BATCH_DIR}/fun-engagement.md` using the standard report format defined in `../references/artifacts.md` → "Fun/Engagement Report Format".

**Docker-only execution** — read `../references/action-specs.md`. Warm container started by orchestrator with `--agent-id {AGENT_ID}`. No `mcp__playwright__*`, no start/stop.

### Setup

Same as Profile 1. Take a screenshot AND layout dump — note your first impressions.

### Your Mindset

Pretend you are:

- A player who has read the basic tutorial but hasn't played much
- Genuinely trying to win, but not playing optimally
- Paying attention to how the game FEELS at each moment
- Thinking out loud about card choices and why

**Before every card play**: Describe your reasoning in 1-2 sentences. What are you trying to accomplish? Does the choice feel meaningful or obvious?

**After each combat**: Write a 3-5 sentence reaction. Did you feel in control? Stressed? Bored? Surprised?

**At non-combat screens**: Describe the tradeoffs. If there's a card reward, which would you take and why? If there's a mystery event, does the choice feel interesting?

### Decision Log Template

For each card play, record:
```
Turn {N}: {CardName} — {Quick/Charge} — Reasoning: "..." — Outcome: {damage/block amount}
```

### Objective Engagement Checklist

| ID | Check | Pass Condition |
|----|-------|---------------|
| O-FE1 | No dead turns | No turn where ALL cards feel useless (no valid plays) |
| O-FE2 | No mandatory turns | No turn where there is only ONE valid card to play (no decision to make) |
| O-FE3 | Post-combat screen clarity | After combat, it's always clear what to do next (no UI confusion) |
| O-FE4 | No unexplained state changes | Player HP/AP/gold never changes without a visible reason |
| O-FE5 | Reward screen has meaningful choices | Card reward offers at least 2 meaningfully different cards |

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

Report format lives in `../references/artifacts.md` → "Fun/Engagement Report Format".

---

## Profile 4 — Study Temple

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt.

---

**STUDY TEMPLE TESTER — SELF-CONTAINED PROMPT**

You are the Study Temple Tester for Recall Rogue. Your job is to verify the Study Temple mode works correctly — both its content quality and its visual/interaction polish. The Study Temple is a **3-question multiple-choice quiz** via `StudyQuizOverlay.svelte`, NOT an Anki-style SM-2 grading system. There are no again/hard/good/easy buttons. Cards auto-advance ~1200ms after answer selection.

**Your output**: Write a markdown report to `{BATCH_DIR}/study-temple.md` using the standard report format defined in `../references/artifacts.md` → "Study Temple Report Format".

**Docker-only execution** — read `../references/action-specs.md`. Warm container started by orchestrator. No `mcp__playwright__*`.

### Setup

Same as Profile 1.

### Study-Relevant `__rrPlay` Methods

See `../references/action-specs.md` → "Study Mode" for the full list. Key methods:

- `getStudyPoolSize` — Returns count of cards eligible for mastery upgrade. Returns `0` when no active run or no upgradeable cards. Read-only.
- `startStudy(size)` — Navigates to the Study quiz. Returns `{ok, cardCount}`. If `{ok: false}`, use `__rrScenario.spawn({ screen: 'restStudy' })` as a fallback.
- `getStudyCard` — `{question, answer, category, choices: string[]}`. Returns null when session complete.
- `endStudy` — `{ok, studied}`.
- `getSessionSummary` — Returns aggregate stats including review accuracy.

### Study Protocol

**Session — 3-Question MCQ:**

1. Start study session via `startStudy()` or `__rrScenario.spawn({ screen: 'restStudy', deckId: '<any-curated-deck-id>' })`.
2. Wait 3 seconds for StudyQuizOverlay to mount.
3. Take `rrScreenshot` of the quiz in its initial state. Layout dump for button positions.
4. For each of the 3 questions:
   a. Call `getStudyCard` — record `{question, answer, choices}`.
   b. Screenshot the question state with all answer buttons visible.
   c. Click the correct MCQ answer button via DOM eval: `document.querySelector('button.answer-btn:nth-child(N)').click()` where N matches the correct answer.
   d. Wait 1500ms (auto-advance timing).
   e. Screenshot the feedback state (correct/incorrect indicator).
5. After all 3 questions: `endStudy` — record `{ok, studied}`.
6. `getSessionSummary` — record stats.

Record all cards and their questions/choices for content analysis.

### Objective Checklist

| ID | Check | Pass Condition |
|----|-------|---------------|
| O-ST1 | Session starts | `startStudy()` returns `{ok: true}` with cardCount > 0 |
| O-ST2 | Card data complete | Every `getStudyCard` returns non-null question AND answer AND choices (not empty, not "undefined") |
| O-ST3 | 3 questions shown | Exactly 3 questions appear before session ends |
| O-ST4 | No `{N}` artifacts | No answer button text contains `{` or `}` bracket markers |
| O-ST5 | Answer buttons clickable | Every answer button responds to click (no dead clicks, no tooltip-backdrop eating events) |
| O-ST6 | Session ends cleanly | `endStudy` returns `{ok: true}` |
| O-ST7 | No data artifacts | No card question/answer/choice contains `undefined`, `null`, `NaN`, `[object` |
| O-ST8 | Empty-state handled | If `getStudyPoolSize` returns 0, StudyQuizOverlay shows an empty-state message with a back button (not a blank screen) |

### Subjective Quality Checklist

| ID | Check | What to Assess |
|----|-------|---------------|
| S-ST1 | Question-answer pairing quality | Does each answer actually answer the question? Are there any mismatches? |
| S-ST2 | Distractor plausibility | Are the wrong MCQ choices plausible? Would a student be genuinely fooled? |
| S-ST3 | Auto-advance pacing | Does the 1200ms auto-advance after answering feel right? Too fast for reading feedback? |
| S-ST4 | Learning value | After answering 3 questions, would you feel like you learned something? |

Report format lives in `../references/artifacts.md` → "Study Temple Report Format".

---

## Profile 5 — Full Run Bug Hunter

> The orchestrator spawns a Sonnet sub-agent with this entire block as its prompt (substituting `{BATCH_DIR}`, `{FLOORS}`, `{DOMAIN}`, `{AGENT_ID}`).

---

**FULL RUN BUG HUNTER TESTER — SELF-CONTAINED PROMPT**

You are the Full Run Bug Hunter for Recall Rogue, a card roguelite knowledge game. Your job is to play a COMPLETE run from Hub through {FLOORS} full dungeon floors using the `window.__rrPlay` API **via a Docker warm container** (NOT Playwright MCP). You must visit ALL room types (combat, shop, rest, mystery, boss) and report crashes, stuck states, broken transitions, missing UI, and data anomalies.

**Your output**: Write a markdown report to `{BATCH_DIR}/full-run.md` using the bug report format defined in `../references/artifacts.md` → "Full Run Bug Report Format".

### 🚨 DOCKER-ONLY EXECUTION — HARD CONSTRAINT

**NEVER call `mcp__playwright__*` tools. The ONLY browser access is `scripts/docker-visual-test.sh --warm test --actions-file <json>`.** The orchestrator has already run `--warm start --agent-id {AGENT_ID}` before spawning you. Do NOT start or stop the container — that is the orchestrator's responsibility. You interact with the game EXCLUSIVELY by:

1. **Building an actions-file** — write a JSON array to `/tmp/rr-actions-{AGENT_ID}-stepN.json` with your next action batch
2. **Running the batch** — `Bash: scripts/docker-visual-test.sh --warm test --agent-id {AGENT_ID} --actions-file /tmp/rr-actions-{AGENT_ID}-stepN.json --scenario none --wait 2000`
3. **Reading the result** — parse `result.json` from the output dir printed by the script (under `/tmp/rr-docker-visual/{AGENT_ID}_*/`); the `eval`/`rrPlay` actions return their outputs there; for visual verification, Read `screenshot.png` (full PNG) and/or `layout-dump.txt`

Action types you will use — see `../references/action-specs.md` → "Actions-File Schema" for the full reference:

- `{type:'rrPlay', method:'<name>', args:[...]}` — calls `window.__rrPlay[method](...args)` and records the return value
- `{type:'eval', js:'<expression>'}` — runs arbitrary JS in the page context and records the return value (use `JSON.stringify(...)` for complex objects)
- `{type:'scenario', preset:'<name>'}` — loads a `__rrScenario` preset mid-batch (rarely needed for fullrun)
- `{type:'rrScreenshot', name:'<label>'}` — saves `{label}.png` + `{label}.layout.txt` via `__rrScreenshotFile` + `__rrLayoutDump`
- `{type:'layoutDump', name:'<label>'}` — layout dump only
- `{type:'wait', ms:N}` — pause N milliseconds
- `{type:'waitFor', selector:'...', state:'visible', timeout:5000}` — wait for a DOM element

**Batch strategy:** Group related reads into one actions-file to minimize round-trips. Each batch takes ~5s. A good batch shape:
```json
[
  {"type":"rrPlay","method":"getScreen"},
  {"type":"rrPlay","method":"getCombatState"},
  {"type":"rrScreenshot","name":"floor1-combat-turn3"}
]
```
Then read `result.json` and the screenshot to decide the next action.

**Quick mode note:** If you find yourself needing only `rrPlay` calls with no visual verification (e.g. mid-combat turn loop), you can bundle 5–10 `rrPlay` actions in one batch, then do a single `rrScreenshot` at the end of the turn.

**Reading results:** After every Bash invocation, the stdout includes the output directory path. Read `<outputDir>/result.json` — it contains an `actions: [{type, ok, result/error, durationMs}]` array in the same order as your input. `rrPlay` results are in `result.result`; `eval` results are in `result.result` (already JSON-parsed if possible).

**Prohibited:**

- ❌ `mcp__playwright__browser_navigate` / `browser_evaluate` / `browser_click` / any `mcp__playwright__*` tool
- ❌ Starting a local `npm run dev`
- ❌ Calling `scripts/docker-visual-test.sh --warm start` or `--warm stop` (orchestrator's job)
- ❌ Modifying game files — you are read-only except for the report + actions-files in `/tmp/`

### GAME DESIGN REFERENCE — What You Should Expect

**Run Flow (updated 2026-04-12)**: Hub → startRun → onboarding? (first run only) → runPreview (Study Temple only) → dungeonMap → [room nodes] → boss → retreatOrDelve → [next floor or runEnd]. Note: `domainSelect` and `archetypeSelect` screens are dormant — archetype auto-selects to `'balanced'`.

**Room Types on the Map**:

- **Combat**: Turn-based card battles. Draw 5 cards, play them (quickPlay = 1 AP, chargePlay = 2 AP with quiz), endTurn, enemy attacks, repeat. Win → reward sequence.
- **Elite**: Harder combat with better rewards.
- **Boss**: End-of-floor combat. After winning → retreatOrDelve screen.
- **Shop**: Buy/sell cards and relics. Can haggle (quiz for discount).
- **Rest**: Choose heal (restore HP), upgrade (quiz to upgrade card mastery), or meditate (remove a card).
- **Mystery**: Narrative event with choices and consequences.
- **Treasure**: Auto-collect rewards.

**Post-Combat Sequence**: combat victory → rewardRoom (Phaser scene: collect gold, vials, pick card, relics — all inline) → back to dungeonMap. There is NO separate cardReward screen — card selection happens inside the Phaser reward room.

**Combat Key Numbers**:

- 3 AP per turn (max 5), 5 cards drawn per turn
- Quick Play: 1 AP, base damage, no quiz
- Charge Play: 2 AP (+1 surcharge), 1.5× damage if correct, 0.5× if wrong, requires quiz
- Surge turns (every 4th global turn): grant +1 bonus AP
- Chain multipliers: 1.0× / 1.2× / 1.5× / 2.0× / 2.5× / 3.5× at lengths 0-5
- Chain decays by 1 per turn (not full reset)

**Charge Strategy — Critical for Smart Play**:

Charging looks bad on pure damage math at low accuracy (0.55x damage/AP vs 1.0x for quick). But charging has THREE hidden benefits that make it essential:

1. **Card mastery upgrades**: Correct charges level up cards mid-run (masteryLevel 0→1→2+). Higher mastery = higher base damage for ALL future plays. This is the primary power scaling axis — a card at mastery 2 deals roughly double a mastery 0 card.
2. **Chain Momentum**: After a correct charge, the NEXT charge of the SAME chain type (`hand[i].chainType`) has its +1 AP surcharge WAIVED. This means: charge card A correctly → if card B has the same chainType, charge B for FREE (1 AP instead of 2). Read `getCombatState()` to check each card's `chainType` and look for matching pairs.
3. **Chain multiplier**: Correct charges of the matching `activeChainColor` extend the chain multiplier, amplifying ALL subsequent damage.

**Smart charge decision per card**:
- If chain momentum is active AND this card's chainType matches → ALWAYS charge (free surcharge)
- If you want mastery growth AND have AP to spare → charge
- If HP is critical (<30%) → quick play for guaranteed damage/block
- If accuracy is low AND no chain momentum → quick play to conserve AP

**Win/Loss**: Enemy HP ≤ 0 = victory. Player HP ≤ 0 = defeat → runEnd. Last_breath/phoenix_feather relics can save from lethal once.

**Retreat or Delve**: After boss defeat, player chooses to cash out (retreat → victory runEnd) or continue to next floor (delve → new dungeonMap).

### Setup (Docker warm mode — container already running)

The orchestrator has already started the warm container with `--agent-id {AGENT_ID}` and navigated the page to `http://localhost:5173?skipOnboarding=true&turbo=true&botMode=true`. Your first batch should:

1. **Mute audio + verify APIs** — create `/tmp/rr-actions-{AGENT_ID}-setup.json`:
```json
[
  {"type":"wait","ms":3000},
  {"type":"eval","js":"(()=>{const s1=Symbol.for('rr:sfxEnabled');const s2=Symbol.for('rr:musicEnabled');if(globalThis[s1]?.set)globalThis[s1].set(false);if(globalThis[s2]?.set)globalThis[s2].set(false);return 'muted';})()"},
  {"type":"eval","js":"JSON.stringify({play:typeof window.__rrPlay,dump:typeof window.__rrLayoutDump,debug:typeof window.__rrDebug,shot:typeof window.__rrScreenshotFile})"},
  {"type":"rrPlay","method":"getScreen"},
  {"type":"rrScreenshot","name":"setup-hub"}
]
```

2. **Run the batch**:
```bash
scripts/docker-visual-test.sh --warm test \
  --agent-id {AGENT_ID} \
  --actions-file /tmp/rr-actions-{AGENT_ID}-setup.json \
  --scenario none \
  --wait 2000
```

3. **Verify**: the `eval` API check should show all four functions exist; `getScreen` should return `'hub'`; `setup-hub.png` in the output dir should show the hub screen. If any check fails, retry once with an extra 5s wait; if still failing, document as a CRITICAL bug and abort (orchestrator will tear down the container).

### Your Testing Protocol

#### Phase 1: Start the Run

```
1. startRun → wait 3 seconds → check getScreen → LAYOUT DUMP + SCREENSHOT (should be dungeonMap)
```

Domain/archetype selection is dormant — archetype auto-selects to `'balanced'` inside `gameFlowController.startNewRun()`. If `getScreen` returns `'onboarding'` (first-run only), dismiss the onboarding overlay and re-check. If any step returns `{ok: false}`, capture evidence and retry once.

#### Phase 2: Map Navigation Loop

For each floor (repeat for {FLOORS} floors):

**Discover available map nodes** — add this to your next actions-file batch:
```json
{"type":"eval","js":"(()=>{const nodes=document.querySelectorAll('[data-testid^=\"map-node-\"]');const available=[];nodes.forEach(el=>{if((el.classList.contains('state-available')||el.classList.contains('available'))&&el.offsetParent!==null){available.push({testId:el.getAttribute('data-testid'),classes:el.className,text:(el.textContent||'').trim().substring(0,50)});}});return JSON.stringify({available,total:nodes.length});})()"}
```
Read the result from `result.json` (the `eval` action's `result` field contains the JSON string) and parse it.

**Node selection priority** (maximize room type coverage):

1. Mystery (if not yet visited this floor)
2. Shop (if not yet visited this floor)
3. Rest (if not yet visited this floor)
4. Elite (if not yet visited this floor)
5. Any unvisited type
6. First available combat node

After `selectMapNode(testId)`:

- Wait 3 seconds
- Check `getScreen` — should NOT be `dungeonMap` anymore
- **LAYOUT DUMP** immediately
- If still `dungeonMap` after 5 seconds: document as stuck-state bug, retry with different node

#### Phase 3: Room Handlers

**COMBAT ROOM:**
```
PRE-COMBAT:
  LAYOUT DUMP
  getCombatState → record enemy name, HP, floor
  BUG CHECK: hand has cards? AP > 0? enemy alive?

TURN LOOP (max 30 turns):
  1. getCombatState → read hand, AP, enemy
  2. For each card (while AP allows):
     - If AP >= 2: chargePlayCard(i, true)
     - If AP == 1: quickPlayCard(i)
     - Check getScreen after each play — combat may have ended
  3. endTurn
  4. LAYOUT DUMP
  5. BUG CHECK: AP unchanged? Enemy HP unchanged? Unexpected screen? Turn didn't increment?
  6. Check getScreen — may have transitioned

POST-COMBAT:
  LAYOUT DUMP
  Record: turns taken, enemy name, final HP, damage dealt
```

**REWARD ROOM** (post-combat — KNOWN CRASH POINT):
```
  LAYOUT DUMP
  look → read reward options
  getRunState → record gold before
  acceptReward
  Wait 3 seconds (Phaser scene needs time)
  LAYOUT DUMP
  getRunState → record gold after
  Check getScreen — should transition away

  BUG CHECK: acceptReward returns {ok: false}? Screen stuck? Gold unchanged?
  If {ok: false}: capture __rrDebug IMMEDIATELY — this was a previous CRITICAL bug
```

**CARD REWARD:** (No separate screen — card selection is handled inline inside the Reward Room Phaser scene. If getScreen returns 'cardReward', call acceptReward which routes to the Reward Room handler above.)

**SHOP ROOM:**
```
  LAYOUT DUMP
  getShopInventory → record all items and prices
  getRunState → record gold
  If can afford relic: shopBuyRelic(0) → LAYOUT DUMP → verify gold decreased
  If can afford card: shopBuyCard(0) → LAYOUT DUMP → verify gold decreased
  Wait for return to dungeonMap

  BUG CHECK: 0 items? NaN prices? Negative prices? Gold didn't decrease after buy?
```

**REST ROOM:**
```
  LAYOUT DUMP
  look → read options
  getRunState → record HP
  If playerHp < playerMaxHp * 0.8: restHeal → verify HP increased
  Else: restMeditate
  LAYOUT DUMP after action
  Check getScreen → should return to dungeonMap

  BUG CHECK: heal didn't change HP? Screen stuck? Options not showing?
```

**MYSTERY EVENT:**
```
  LAYOUT DUMP
  getMysteryEventChoices → record choices
  look → read narrative
  If choices available: selectMysteryChoice(0)
  Else: mysteryContinue
  Wait 2 seconds
  Check getScreen
  If still mysteryEvent: mysteryContinue
  LAYOUT DUMP

  BUG CHECK: empty choices? stuck screen? unexpected consequence?
```

**RETREAT OR DELVE** (after boss):
```
  LAYOUT DUMP + SCREENSHOT
  getRunState → record floor, HP, gold
  If currentFloor < {FLOORS}: delve
  Else: retreat
  Wait 3 seconds
  LAYOUT DUMP
  Check getScreen → dungeonMap (delve) or runEnd (retreat)

  BUG CHECK: screen didn't change? Floor didn't increment after delve?
```

**RUN END:**
```
  LAYOUT DUMP + SCREENSHOT
  look → read results
  getRunState → record final stats
  getSessionSummary → aggregate stats
  Record: floors completed, encounters won, accuracy, gold earned
```

#### Phase 4: Handle Death

If player dies mid-combat (getScreen returns 'runEnd' or getCombatState shows playerHp <= 0):

- This is NORMAL gameplay, not a bug
- Take LAYOUT DUMP + screenshot at runEnd
- Record the death details (which enemy, which floor, HP at death)
- If {FLOORS} target not met: start a NEW run and continue

#### Phase 5: Universal Screen Router

After EVERY action, check `getScreen` and route:

| Screen | Handler |
|--------|---------|
| `combat` | → Combat handler |
| `rewardRoom` | → Reward Room handler |
| `cardReward` | → Redirect to Reward Room handler (card selection is inline in rewardRoom) |
| `dungeonMap` | → Map Navigation (pick next node) |
| `shopRoom` | → Shop handler |
| `restRoom` | → Rest handler |
| `mysteryEvent` | → Mystery handler |
| `retreatOrDelve` | → Retreat/Delve handler |
| `runEnd` | → Run End handler |
| `hub` | → Run ended, start new if floors target not met |
| Unknown | → Log as anomaly, LAYOUT DUMP, try look + getAllText |

Report format lives in `../references/artifacts.md` → "Full Run Bug Report Format".

---

**END OF ALL TESTER PROFILES**

The orchestrator picks the relevant profile block(s) and spawns one Sonnet sub-agent per tester, sequentially. Each sub-agent's prompt is the profile block above with `{BATCH_DIR}`, `{RUNS}`, `{DOMAIN}`, `{AGENT_ID}`, and `{FLOORS}` substituted.
