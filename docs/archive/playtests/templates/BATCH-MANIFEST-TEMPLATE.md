# Batch NNN: {Title}

**Status:** ACTIVE -- waiting for workers
**Created:** YYYY-MM-DD
**Model:** {Codex 5.3 medium / Codex 5.1 mini / Claude Sonnet}

## What This Batch Tests

{1-2 paragraph description of what this batch validates}

## How to Execute

### Prerequisites
- Dev server running at `http://localhost:5173`
- Playwright available: `node -e "require('/root/terra-miner/node_modules/playwright-core')"`
- Chrome at `/opt/google/chrome/chrome`

### Execution Method: AI Playtester API

**Use the `window.__terraPlay` API via Node.js Playwright scripts.** This is the preferred method for all workers.

**Harness pattern** (every test script follows this):

```javascript
const { createPlaytester } = require('/root/terra-miner/tests/e2e/lib/playtest-harness.cjs');
const { aggressiveMiner, diligentStudent } = require('/root/terra-miner/tests/e2e/lib/play-strategies.cjs');
const fs = require('fs');

(async () => {
  const tester = await createPlaytester({
    preset: 'post_tutorial',  // customize per question
  });

  try {
    // 1. LOOK at initial state
    console.log(await tester.look());

    // 2. Play using strategies or manual loop
    // ... test-specific protocol ...

    // 3. Validate and report
    const validation = await tester.validateScreen();
    const summary = await tester.getSessionSummary();

    // 4. Write results
    fs.writeFileSync('/tmp/qNN-results.json', JSON.stringify({ validation, summary }, null, 2));
    await tester.screenshot('/tmp/qNN-screenshot.png');

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
1. **LOOK**: `look()` → see state
2. **DECIDE**: pick from AVAILABLE ACTIONS
3. **ACT**: call the method
4. **CHECK**: `validateScreen()` → log any issues as bugs

**After every quiz**: Read all 4 choices via `getQuizText()`. Are they unique? Is question readable?
**After every study card**: Read front+back via `getStudyCardText()`. Is content correct?
**Watch for**: "undefined", "NaN", empty text, duplicate choices, negative O2, blank screens.

### Worker Assignment
- Launch **{N} workers in parallel**, one per test
- Each worker gets ONE test from `questions.md`

### Worker Prompt Template

```
You are playtesting Terra Miner using the AI Playtester API.

Read `docs/playtests/active/NNN-{name}/questions.md` and find Q{N}.

Execute that question's protocol:
1. Write a .cjs script using the playtest harness (see MANIFEST boilerplate)
2. Use the preset matching the question's Setup section
3. Run it: node tests/e2e/your-script.cjs
4. Follow the MANDATORY play loop: LOOK → DECIDE → ACT → CHECK
5. Call validateScreen() after every action
6. Call getQuizText()/getStudyCardText() to check content quality
7. Measure everything in "Observe/Measure"
8. Evaluate each "Success criteria" as PASS/FAIL/INCONCLUSIVE

Write your report to:
  docs/playtests/active/NNN-{name}/results/{output-filename}.md

Use the qualitative report template (narrative + measurements + emotional arc + issues + verdict).

IMPORTANT:
- Use the __terraPlay API — do NOT try to click the Phaser canvas
- Call look() to see the game, not screenshots
- Log ALL issues found by validateScreen()
- Write like a human tester, not a test framework
```

### Qualitative Report Template

```markdown
# Playtest Report: [Title]

## Session Narrative
[2-3 paragraphs describing what happened, like a human tester would write]

## Key Observations
- [Qualitative observation + supporting data]

## Measurements
| Metric | Value | Target | Status |
|--------|-------|--------|--------|

## Emotional Arc
- Start: [feeling] → Mid: [feeling] → End: [feeling]

## Issues Found
### Bug/Balance: [title]
- Severity: [critical/high/medium/low]
- Description: [what happened]
- Expected: [what should happen]
- Suggested fix: [if applicable]

## Verdict
[PASS/FAIL/INCONCLUSIVE per success criterion with explanation]
```

### Expected Output Files

| # | Title | Output File |
|---|-------|-------------|
| 1 | {test title} | results/{filename}.md |

### After All Workers Complete

1. Read all reports from `results/`
2. Create `results/SUMMARY.md`
3. Move batch to `completed/`
