# Batch 003: AI Playtester API Shakedown

**Status:** ACTIVE -- waiting for workers
**Created:** 2026-03-07
**Model:** Codex (any tier)

## What This Batch Tests

First real test of the `window.__terraPlay` API — the programmatic gameplay system that lets AI models play Terra Miner through function calls instead of clicking. This batch validates:
1. **API correctness**: Do all methods work? Do edge cases crash?
2. **Perception quality**: Does `look()` provide enough info to make decisions?
3. **Report quality**: Can workers produce rich, human-like qualitative feedback?
4. **Game feedback**: Mining feel, study card quality, GAIA personality, SM-2 intervals

## How to Execute

### Prerequisites
- Dev server running at `http://localhost:5173`
- Playwright available: `node -e "require('/root/terra-miner/node_modules/playwright-core')"`
- Chrome at `/opt/google/chrome/chrome`

### Execution Method: AI Playtester API

**Use the `window.__terraPlay` API via Node.js Playwright scripts.**

**Harness pattern** (every test script follows this):

```javascript
const { createPlaytester } = require('/root/terra-miner/tests/e2e/lib/playtest-harness.cjs');
const { aggressiveMiner, diligentStudent, domeExplorer } = require('/root/terra-miner/tests/e2e/lib/play-strategies.cjs');
const fs = require('fs');

(async () => {
  const tester = await createPlaytester({
    preset: 'post_tutorial',  // CHANGE per question — see Setup section
  });

  try {
    // 1. LOOK at initial state
    console.log(await tester.look());

    // 2. Play — follow the question's Protocol section exactly
    // Use the MANDATORY play loop: LOOK → DECIDE → ACT → CHECK

    // 3. Validate and collect data
    const validation = await tester.validateScreen();
    const summary = await tester.getSessionSummary();
    const allText = await tester.getAllText();

    // 4. Write results
    const results = { validation, summary, allText };
    fs.writeFileSync('/tmp/q0N-results.json', JSON.stringify(results, null, 2));
    await tester.screenshot('/tmp/q0N-screenshot.png');

    console.log('DONE:', JSON.stringify(summary, null, 2));

  } finally {
    await tester.cleanup();
  }
})();
```

### API Quick Reference

**See the game:** `look()`, `getAllText()`, `getQuizText()`, `getStudyCardText()`, `validateScreen()`
**Mine:** `startDive(tanks)`, `mineBlock(dir)`, `endDive()`, `useBomb()`, `useScanner()`
**Quiz:** `getQuiz()`, `answerQuiz(index)`, `answerQuizCorrectly()`, `answerQuizIncorrectly()`
**Study:** `startStudy(size)`, `getStudyCard()`, `gradeCard(button)`, `endStudy()`
**Navigate:** `navigate(screen)`, `getScreen()`, `enterRoom(id)`, `exitRoom()`
**State:** `getSave()`, `getStats()`, `getInventory()`, `fastForward(hours)`, `getSessionSummary()`

### Pre-built Strategies
In `tests/e2e/lib/play-strategies.cjs`:
- `aggressiveMiner(tester, maxBlocks)` — mine down, answer quizzes correctly
- `cautiousMiner(tester, maxBlocks)` — use scanner, avoid hazards
- `randomWalker(tester, maxBlocks)` — random directions
- `diligentStudent(tester, gradeDistribution)` — study with grade mix
- `domeExplorer(tester)` — visit every dome room
- `fullSession(tester, dives)` — complete dive + study + dome loop

### MANDATORY Play Loop

Every worker MUST follow this cycle on every action:
1. **LOOK**: `look()` — see state
2. **DECIDE**: pick from AVAILABLE ACTIONS
3. **ACT**: call the method
4. **CHECK**: `validateScreen()` — log any issues as bugs

**After every quiz**: Read all 4 choices via `getQuizText()`. Are they unique? Is question readable?
**After every study card**: Read front+back via `getStudyCardText()`. Is content correct?
**Watch for**: "undefined", "NaN", empty text, duplicate choices, negative O2, blank screens.

### Worker Assignment
- Launch **up to 8 workers in parallel**, one per question
- Each worker reads ONE question from `questions.md` (Q1 through Q8)

### Worker Prompt Template

```
You are playtesting Terra Miner using the AI Playtester API.

Read `docs/playtests/active/003-api-shakedown/questions.md` and find Q{N}.

Execute that question's protocol:
1. Write a .cjs script in `tests/e2e/` using the playtest harness (see MANIFEST boilerplate)
2. Use the preset specified in the question's Setup section
3. Run it: node tests/e2e/your-script.cjs
4. Follow the MANDATORY play loop: LOOK → DECIDE → ACT → CHECK
5. Call validateScreen() after every action — log ALL issues
6. Call getQuizText()/getStudyCardText() whenever quiz/study content appears
7. Measure everything in "Observe/Measure"
8. Evaluate each "Success criteria" as PASS/FAIL/INCONCLUSIVE

Write your report to:
  docs/playtests/active/003-api-shakedown/results/q0{N}-{kebab-title}.md

CRITICAL REPORT RULES:
- Write like a human game tester, NOT like a test framework
- Include a Session Narrative (2-3 paragraphs)
- Include an Emotional Arc (how the experience felt over time)
- Include specific quotes from the game (quiz text, GAIA messages, etc.)
- Rate each success criterion as PASS/FAIL/INCONCLUSIVE with explanation
- End with "What I'd change" — your honest suggestion for improvement

IMPORTANT:
- Use the __terraPlay API — do NOT try to click the Phaser canvas
- Call look() to see the game state, not screenshots
- The game runs at http://localhost:5173 with Chrome at /opt/google/chrome/chrome
```

### Expected Output Files

| Q# | Title | Output File |
|----|-------|-------------|
| Q1 | Blind Miner — First Impressions | results/q01-blind-miner.md |
| Q2 | The Study Skeptic — Card Quality Audit | results/q02-study-skeptic.md |
| Q3 | Speed Runner vs Explorer | results/q03-speed-vs-explore.md |
| Q4 | The GAIA Whisperer — NPC Feedback | results/q04-gaia-whisperer.md |
| Q5 | The Bug Hunter — Validation Sweep | results/q05-bug-hunter.md |
| Q6 | The Time Traveler — SM-2 Intervals | results/q06-time-traveler.md |
| Q7 | The Completionist — Full Game Loop | results/q07-completionist.md |
| Q8 | The Stress Tester — Edge Cases | results/q08-stress-tester.md |

### After All Workers Complete

1. Read all 8 reports from `results/`
2. Create `results/SUMMARY.md` with:
   - Verdict table (Q1-Q8: PASS/FAIL/INCONCLUSIVE + one-line finding)
   - API issues discovered (methods that failed/returned wrong data)
   - Game bugs by severity
   - Top 5 most actionable findings
   - Overall "API readiness" grade (A-F)
3. Move batch to `completed/`: `mv docs/playtests/active/003-api-shakedown docs/playtests/completed/`
