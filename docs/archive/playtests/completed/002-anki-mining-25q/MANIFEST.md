# Batch 002: Anki Integration & Core Mining Loop

**Status:** ACTIVE -- waiting for workers
**Created:** 2026-03-07
**Model:** Codex 5.3 (medium thinking) -- requires reasoning about game state and SM-2 mechanics

## What This Batch Tests

25 questions validating whether the SM-2/Anki spaced repetition integration actually works, and whether the core mining game loop is well-paced. See `questions.md` for the full list.

## How to Execute

### Prerequisites
- Dev server running at `http://localhost:5173` (verify with `curl -s http://localhost:5173 | head -1`)
- Playwright available via Node.js: `node -e "require('/root/terra-miner/node_modules/playwright-core')"`
- Chrome at `/opt/google/chrome/chrome`

### Execution Method: Node.js Playwright Scripts

**DO NOT use MCP Playwright tools.** Instead, write and run `.cjs` Node.js scripts.

**Boilerplate pattern** (every test script follows this):

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 412, height: 915 });

  try {
    // Pre-flight
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      localStorage.clear();
    });

    // Inject save (customize per question)
    await page.evaluate((save) => {
      localStorage.setItem('terra_guest_mode', 'true');
      localStorage.setItem('terra_age_bracket', 'teen');
      localStorage.setItem('recall-rogue-save', JSON.stringify(save));
    }, buildYourSave());

    // Reload with skip
    await page.goto('http://localhost:5173?skipOnboarding=true', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Verify
    const state = await page.evaluate(() => {
      const store = globalThis[Symbol.for('terra:playerSave')];
      if (!store) return null;
      let v; store.subscribe(x => { v = x })();
      return { facts: v?.learnedFacts?.length, o2: v?.oxygen };
    });
    console.log('Verified:', state);

    // ... test-specific protocol from questions.md ...

    // Write results
    fs.writeFileSync('/tmp/qNN-results.json', JSON.stringify(results, null, 2));
    await page.screenshot({ path: '/tmp/qNN-screenshot.png', fullPage: true });

  } finally {
    await browser.close();
  }
})();
```

**Reading Svelte stores:**
```javascript
async function readStore(page, key) {
  return page.evaluate((k) => {
    const store = globalThis[Symbol.for(k)];
    if (!store) return null;
    let v; store.subscribe(x => { v = x })();
    return v;
  }, key);
}
// Keys: 'terra:playerSave', 'terra:currentScreen', 'terra:activeQuiz', 'terra:diveResults'
```

**Working reference scripts:**
- `tests/e2e/q08-quiz-frequency.cjs` — mine dive with quiz handling, forced quizzes, consistency penalty
- `tests/e2e/q16-study-session.cjs` — study session with card grading
- `tests/e2e/01-app-loads.cjs` — basic smoke test with diagnostics

### Worker Assignment
- Launch **up to 25 workers in parallel**, one per question
- Each worker reads ONE question from `questions.md` (Q1 through Q25)
- Each worker writes a `.cjs` script, runs it, captures results, then writes a markdown report

### Worker Prompt Template

For worker N (where N = 1 to 25), use this prompt:

```
You are testing Terra Miner, a mining/knowledge game.

Read `docs/playtests/active/002-anki-mining-25q/questions.md` and find Q{N}.

Execute that question's playtest protocol using a Node.js Playwright script:

1. Write a `.cjs` script in `tests/e2e/` following the boilerplate in the MANIFEST
2. Build a custom save state matching the question's "Setup" section
3. Run the script: `node tests/e2e/your-script.cjs`
4. Capture all measurements listed in "Observe/Measure"
5. Evaluate each point in "Success criteria" as PASS/FAIL/INCONCLUSIVE

Reference scripts for patterns:
- tests/e2e/q08-quiz-frequency.cjs (mine dive + quizzes)
- tests/e2e/q16-study-session.cjs (study sessions)

Write your report to:
  docs/playtests/active/002-anki-mining-25q/results/q{NN}-{kebab-title}.md

IMPORTANT:
- Use Node.js Playwright scripts, NOT MCP tools
- require('/root/terra-miner/node_modules/playwright-core')
- Chrome: /opt/google/chrome/chrome
- Dev server: http://localhost:5173
- Do NOT stop early. Complete the FULL protocol.
- Include a VERDICT section with each success criterion rated.
```

### Expected Output Files

| Q# | Title | Output File |
|----|-------|-------------|
| Q1 | First-Contact Fact Retention | results/q01-first-contact-retention.md |
| Q2 | SM-2 Interval Accuracy Over 7 Days | results/q02-sm2-interval-accuracy.md |
| Q3 | Distractor Interference | results/q03-distractor-interference.md |
| Q4 | Vocab vs General Fact Mastery Pace | results/q04-vocab-vs-general-mastery.md |
| Q5 | Leech Detection Sensitivity | results/q05-leech-detection.md |
| Q6 | Morning/Evening Ritual Adherence | results/q06-ritual-adherence.md |
| Q7 | Knowledge Tree as Motivation Anchor | results/q07-knowledge-tree-motivation.md |
| Q8 | Pop Quiz Frequency Sweet Spot | results/q08-quiz-frequency.md |
| Q9 | Quiz Interruption Impact on Flow State | results/q09-quiz-flow-interruption.md |
| Q10 | Consistency Penalty Fairness | results/q10-consistency-penalty.md |
| Q11 | Layer Entrance Quiz Pressure | results/q11-layer-entrance-quiz.md |
| Q12 | Artifact Boost Quiz Value Perception | results/q12-artifact-boost-quiz.md |
| Q13 | Quiz Streak Motivation | results/q13-quiz-streak.md |
| Q14 | Difficulty Weighting by Depth | results/q14-difficulty-by-depth.md |
| Q15 | Three-Button Grading Clarity | results/q15-three-button-grading.md |
| Q16 | Study Session Length Satisfaction | results/q16-session-length.md |
| Q17 | Card Ordering and Cognitive Load | results/q17-card-ordering.md |
| Q18 | GAIA Study Feedback Helpfulness | results/q18-gaia-feedback.md |
| Q19 | New Card Introduction Pacing | results/q19-new-card-pacing.md |
| Q20 | O2 Pacing and Tension Curve | results/q20-o2-pacing.md |
| Q21 | Layer Progression Depth vs Breadth | results/q21-depth-vs-breadth.md |
| Q22 | Artifact Discovery Rate and Excitement | results/q22-artifact-discovery.md |
| Q23 | Risk/Reward Balance on Hazards | results/q23-hazard-balance.md |
| Q24 | Mining + Learning Integration Cohesion | results/q24-integration-cohesion.md |
| Q25 | Return Visit Drivers | results/q25-return-visit-drivers.md |

### After All Workers Complete

1. Read all 25 reports from `results/`
2. Create `results/SUMMARY.md` with:
   - Verdict table (Q1-Q25: PASS/FAIL/INCONCLUSIVE + one-line finding)
   - Confirmed bugs by severity
   - Balance constants to adjust (variable name, current value, recommended change, rationale)
   - Top 5 most actionable findings
3. Move this batch to `completed/`: `mv docs/playtests/active/002-anki-mining-25q docs/playtests/completed/`
