# Gameplay Playthrough

Conduct an alpha-tester-level playthrough of any Terra Miner gameplay area. Build a custom game state, inject it, play through using Playwright MCP tools, and document findings — especially visual abnormalities, behavioral bugs, and data inconsistencies.

This file is self-contained. An agent reading ONLY this skill file should be able to run the entire playthrough without any other context.

---

## 0. Batch Playtest Management

This skill supports two additional modes beyond individual playthroughs:

### 0.1 Batch Creation Mode

**Trigger**: User says "create a playtest batch for {topic}" or similar.

**Protocol**:
1. Determine the next batch number by scanning `docs/playtests/active/` and `docs/playtests/completed/` for the highest NNN
2. Create folder: `docs/playtests/active/{NNN+1}-{kebab-description}/`
3. Create `MANIFEST.md` using the template at `docs/playtests/templates/BATCH-MANIFEST-TEMPLATE.md`
4. Create `questions.md` with detailed test specifications
5. Create empty `results/` directory (add `.gitkeep`)
6. Report the batch number and folder path to the user

### 0.2 Batch Execution Mode

**Trigger**: User says "run the next batch", "run batch NNN", or "do the next playtest".

**Protocol**:
1. Scan `docs/playtests/active/` for the highest-numbered folder (that's the next batch)
2. Read its `MANIFEST.md` for worker instructions
3. Read `questions.md` (or individual test files) for test specifications
4. Execute each test according to the manifest's protocol
5. Write results to the batch's `results/` folder
6. When all tests complete, create `results/SUMMARY.md` and move the batch to `docs/playtests/completed/`

### 0.3 Node.js Script Execution (for Codex / Headless Workers)

Some workers (like Codex) do NOT have MCP Playwright tools available. These workers MUST use Node.js Playwright scripts instead.

**Detection**: If MCP tools (`browser_navigate`, `browser_evaluate`, etc.) are not available, fall back to writing and running Node.js scripts.

**Boilerplate** — every playtest script follows this pattern:

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 412, height: 915 });

  try {
    // 1. Navigate
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // 2. Pre-flight: clear SW + localStorage
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      localStorage.clear();
    });

    // 3. Inject save
    await page.evaluate((saveData) => {
      localStorage.setItem('terra_guest_mode', 'true');
      localStorage.setItem('terra_age_bracket', 'teen');
      localStorage.setItem('recall-rogue-save', JSON.stringify(saveData));
    }, buildCustomSave());

    // 4. Reload with skipOnboarding
    await page.goto('http://localhost:5173?skipOnboarding=true', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 5. Verify save loaded
    const state = await page.evaluate(() => {
      const store = globalThis[Symbol.for('terra:playerSave')];
      if (!store) return { error: 'no store' };
      let v; store.subscribe(x => { v = x })();
      const screenStore = globalThis[Symbol.for('terra:currentScreen')];
      let screen; screenStore?.subscribe(x => { screen = x })();
      return { loaded: !!v, factCount: v?.learnedFacts?.length, screen };
    });
    console.log('Save verified:', state);

    // 6. Run test protocol...
    // (test-specific code here)

    // 7. Capture screenshots
    await page.screenshot({ path: '/tmp/playtest-checkpoint.png', fullPage: true });

    // 8. Write results
    const results = { /* structured data */ };
    fs.writeFileSync('/tmp/playtest-results.json', JSON.stringify(results, null, 2));

  } finally {
    await browser.close();
  }
})();
```

**MCP-to-Script Translation Table:**

| MCP Tool | Node.js Equivalent |
|----------|-------------------|
| `browser_navigate(url)` | `await page.goto(url, { waitUntil: 'domcontentloaded' })` |
| `browser_evaluate(code)` | `await page.evaluate(() => { ... })` |
| `browser_take_screenshot()` | `await page.screenshot({ path: '/tmp/name.png', fullPage: true })` |
| `browser_click(selector)` | `await page.click(selector, { force: true })` |
| `browser_snapshot()` | `await page.content()` or `await page.locator('body').innerText()` |
| `browser_press_key(key)` | `await page.keyboard.press(key)` |
| `browser_console_messages()` | Use `attachDiagnostics(page)` from `tests/e2e/lib/diagnostics.cjs` |

**Reading Svelte stores from Node.js scripts:**

```javascript
async function readStore(page, key) {
  return page.evaluate((k) => {
    const store = globalThis[Symbol.for(k)];
    if (!store) return null;
    let v; store.subscribe(x => { v = x })();
    return v;
  }, key);
}

// Usage:
const save = await readStore(page, 'terra:playerSave');
const screen = await readStore(page, 'terra:currentScreen');
const quiz = await readStore(page, 'terra:activeQuiz');
```

**Working examples** — reference these for proven patterns:
- `tests/e2e/q08-quiz-frequency.cjs` — full mine dive with quiz handling, state injection, forced quizzes
- `tests/e2e/q16-study-session.cjs` — study session with card grading, session size selection
- `tests/e2e/01-app-loads.cjs` — basic smoke test with diagnostics

**Running scripts:**
```bash
node tests/e2e/q08-quiz-frequency.cjs
# Results written to /tmp/q08-results.json + /tmp/q08-*.png screenshots
```

**IMPORTANT for Codex workers:**
- Scripts MUST be `.cjs` files (CommonJS, not ESM)
- Use `require('/root/terra-miner/node_modules/playwright-core')` (absolute path)
- Chrome executable: `/opt/google/chrome/chrome`
- Dev server must be running at `http://localhost:5173`
- Write results to `/tmp/` for JSON data and screenshots
- Write markdown reports to the batch's `results/` folder

## 0.4 AI Playtester API — `window.__terraPlay`

Terra Miner has a programmatic gameplay API that lets AI models play the game through function calls instead of clicking the canvas. This is the PREFERRED method for all playtesting.

### Quick Start (Node.js Playwright script)
```javascript
const { createPlaytester } = require('./tests/e2e/lib/playtest-harness.cjs');
const tester = await createPlaytester({ preset: 'mid_game_3_rooms' });

// See the game state as text
const view = await tester.look();
console.log(view);

// Play a dive
await tester.startDive(1);
for (let i = 0; i < 20; i++) {
  const quiz = await tester.getQuiz();
  if (quiz) await tester.answerQuizCorrectly();
  else await tester.mineBlock('down');
}
const summary = await tester.getSessionSummary();
await tester.cleanup();
```

### API Reference

**Perception (see the game without screenshots):**
| Method | Returns |
|--------|---------|
| `look()` | Full text description of current screen, grid, items, actions |
| `getAllText()` | All visible text organized by data-testid, CSS class, raw |
| `getQuizText()` | Quiz question, 4 choices, GAIA reaction, memory tip |
| `getStudyCardText()` | Card front, back, explanation, mnemonic, progress |
| `getHUDText()` | O2, dust, layer, streak values |
| `getNotifications()` | All visible toasts, GAIA bubbles, alerts |
| `validateScreen()` | Sanity check — returns `{ valid, issues[] }` |

**Navigation:**
| Method | What it does |
|--------|-------------|
| `navigate(screen)` | Switch to any screen (base, mine, dome, study, etc.) |
| `getScreen()` | Current screen name |
| `getAvailableScreens()` | Screens reachable from current state |

**Mining:**
| Method | What it does |
|--------|-------------|
| `mineBlock(dir)` | Mine up/down/left/right — triggers O2 drain, quizzes, loot |
| `mineAt(x, y)` | Mine at specific coordinates |
| `startDive(tanks?)` | Begin a mine dive |
| `endDive()` | Surface and end dive |
| `useBomb()` | Use bomb consumable |
| `useScanner()` | Use scanner consumable |

**Quiz:**
| Method | What it does |
|--------|-------------|
| `getQuiz()` | Current quiz state (question, choices, correctIndex) or null |
| `answerQuiz(index)` | Answer by choice index (0-3) |
| `answerQuizCorrectly()` | Auto-answer correctly |
| `answerQuizIncorrectly()` | Auto-answer wrong |

**Study:**
| Method | What it does |
|--------|-------------|
| `startStudy(size?)` | Start study session (quick/normal/full) |
| `getStudyCard()` | Current card info |
| `gradeCard(button)` | Grade as again/okay/good |
| `endStudy()` | End session |

**Dome:**
| Method | What it does |
|--------|-------------|
| `enterRoom(roomId)` | Enter dome room |
| `exitRoom()` | Leave room |

**State:**
| Method | What it does |
|--------|-------------|
| `getInventory()` | All items and artifacts |
| `getSave()` | Full save state |
| `getStats()` | Play statistics |
| `fastForward(hours)` | Advance game clock for SM-2 testing |
| `getRecentEvents(n?)` | Last N events from log |
| `getSessionSummary()` | Aggregate stats for current session |

### Pre-built Strategies
Available in `tests/e2e/lib/play-strategies.cjs`:
- `aggressiveMiner(tester, maxBlocks)` — mine straight down, answer quizzes correctly
- `cautiousMiner(tester, maxBlocks)` — use scanner, avoid hazards
- `randomWalker(tester, maxBlocks)` — mine random directions
- `diligentStudent(tester, gradeDistribution)` — study cards with grade distribution
- `domeExplorer(tester)` — visit every dome room
- `fullSession(tester, dives)` — complete dive + study + dome loop

## 0.5 Worker Playbook — MANDATORY Play Loop

Every AI worker MUST follow this protocol when playtesting:

### Core Play Loop (repeat until objective is complete)
1. **LOOK**: Call `look()` to see current state
2. **DECIDE**: Pick an action from AVAILABLE ACTIONS (listed in look output)
3. **ACT**: Call the action method (e.g., `mineBlock('down')`)
4. **CHECK**: Call `validateScreen()` — if issues[] is non-empty, LOG THEM AS BUGS

### After Every Quiz
1. Read question and ALL 4 choices from `getQuizText()`
2. Check: Are all 4 choices different? Is the question complete/readable?
3. Answer the quiz
4. Read GAIA reaction — does it make sense?
5. Log: question text, answer, correctness, any issues

### After Every Study Card
1. Read front via `getStudyCardText()` — is question clear?
2. Reveal answer
3. Read back — is answer correct? explanation helpful?
4. Grade the card
5. Log: front text, back text, grade, any issues

### What To Watch For (check on EVERY action)
- Text that says "undefined", "null", "NaN", "[object Object]", or is empty
- Same quiz question appearing twice in a row
- Same fact as answer choice AND question
- O2 going below 0 or above max
- Buttons that don't respond (check validateScreen issues)
- GAIA messages that don't match context
- Quiz choices where 2+ are identical
- Study cards where front and back are the same
- Any error messages or blank screens

### Qualitative Report Template
```markdown
# Playtest Report: [Title]

## Session Narrative
[2-3 paragraphs describing what happened, like a human tester]

## Key Observations
- [Qualitative observation + data]

## Measurements
| Metric | Value | Target | Status |

## Emotional Arc
- Start: [feeling] → Mid: [feeling] → End: [feeling]

## Issues Found
### Bug/Balance: [title]
- Severity, description, expected, suggested fix

## Verdict
[PASS/FAIL/INCONCLUSIVE per criterion with explanation]
```

## 0.6 Known API Issues & Workarounds (Batches 001-003)

These are confirmed issues discovered through playtesting. Workers MUST apply these workarounds.

### API Bugs (unfixed as of batch 003)

| Issue | Workaround | Severity |
|-------|-----------|----------|
| `navigate('invalid_screen')` returns `ok:true` | Always check `getScreen()` after navigation to confirm you're on the expected screen | HIGH |
| `startStudy(size)` may not start a playable session | After calling `startStudy()`, verify with `getStudyCard()` — if null, try clicking the study size button via DOM: `document.querySelector('[data-testid="btn-study-10"]')?.click()` | HIGH |
| `fastForward()` + SM-2 intervals may flatten | After `fastForward()`, always re-read `getSave()` to verify interval separation is preserved. If intervals regressed, note it as a known issue — don't report as a new bug | HIGH |
| `fastForward(-1)` accepted (no validation) | Always pass positive hours. Don't rely on the API to reject bad input | LOW |
| `getSessionSummary()` returns low-fidelity data | `eventCount` is often 1. Supplement with manual tracking: count actions yourself in your script | MEDIUM |

### False Positives — DO NOT Report These

| Pattern | Why It's Not a Bug |
|---------|-------------------|
| `validateScreen()` reports `gaia-toast-text` as occluded | GAIA toasts are transient overlays — occlusion is normal during fade-in/out |
| `validateScreen()` reports `study-progress` as occluded | Progress bar may be behind card flip animation — timing artifact |
| Session duration = 0ms in metrics | API executes instantly — this measures API speed, not human play time. Only flag if the session truly didn't happen |
| No quiz in 15 blocks of mining | At 4% chance per block (`RANDOM_QUIZ_CHANCE: 0.04`), there's a 54% chance of zero quizzes in 15 blocks. Mine 30+ blocks for reliable quiz encounters |

### Quiz Triggering Math

Workers frequently expect quizzes to appear within a short mining window. Here's the actual probability:

| Blocks Mined | P(at least 1 quiz) | Recommendation |
|-------------|-------------------|----------------|
| 10 | 34% | Too few — unreliable |
| 15 | 46% | Coin flip — don't count on it |
| 25 | 64% | Reasonable for 1 quiz |
| 40 | 80% | Good for quiz-dependent tests |
| 60 | 91% | Use this for quiz-critical protocols |

**For quiz-dependent tests**: Mine at least 40 blocks, or use `QUIZ_FIRST_TRIGGER_AFTER_BLOCKS` (10) + patience. The first quiz can't appear before 10 blocks due to the cooldown. After that, there's also a `QUIZ_COOLDOWN_BLOCKS` (15) gap between quizzes.

### Study Session Sizes

When calling `startStudy(size)`:
- `'quick'` = 5 cards
- `'normal'` = 10 cards
- `'full'` = 20 cards

If size is omitted, it defaults to 10. The session ends automatically when all cards (including re-queued Again cards) are graded.

### Preset Recommendations by Test Type

| Test Type | Best Preset | Why |
|-----------|------------|-----|
| Study/review testing | `many_reviews_due` | 50+ facts with varied SM-2 states, many overdue |
| Mining + quiz | `quiz_due` or `many_reviews_due` | Ensures facts exist for quiz selection |
| New player experience | `post_tutorial` or `new_player` | Clean state, minimal facts |
| Dome exploration | `mid_game_3_rooms` or `five_rooms` | Multiple rooms unlocked |
| Economy testing | `rich_player` | High resource counts |
| Streak testing | `max_streak` or `streak_about_to_break` | Specific streak states |
| Active dive | `mid_dive_active` | Already mid-dive, skip dive start |
| SM-2 time travel | `many_reviews_due` + `fastForward()` | Varied intervals to observe drift |

### Codex/Headless Worker Constraints

- Workers do NOT have MCP Playwright tools — must write `.cjs` scripts
- Workers do NOT have access to `/playthrough` or other Claude Code skills
- Scripts MUST use `require('/root/terra-miner/node_modules/playwright-core')` (absolute path)
- Chrome at `/opt/google/chrome/chrome`
- Always `waitForTimeout(3000-5000)` after page navigation — the API needs time to initialize
- Write reports to `docs/playtests/active/{batch}/results/` NOT to `/tmp/`
- Use the harness at `tests/e2e/lib/playtest-harness.cjs` when possible — it handles browser launch, preset loading, and API readiness waiting

### Report Quality Guidelines

Based on batch 001-002 output quality:
- **DON'T** produce metric-only reports with just PASS/FAIL tables — these miss the point
- **DO** write 2-3 paragraph narratives describing what happened and how it felt
- **DO** note moments of confusion, frustration, satisfaction, or surprise
- **DO** distinguish between API limitations and actual game bugs
- **DON'T** report known false positives (see tables above)
- **DO** include the raw JSON data alongside the narrative
- **DO** use the Emotional Arc section — it's the most unique value AI playtesting adds

---

## 1. Execution Model

1. **Opus orchestrator** reads the user's prompt to decide what gameplay to test
2. **Dispatch a Sonnet agent** (`model: "sonnet"`) to execute the playthrough and write the raw report — Sonnet is required because playthroughs involve complex state tracking, conditional branching, and adaptive decision-making
3. **Opus reads the raw report**, investigates source files for any issues found, and appends an "Analysis & Fix Proposals" section

### Execution Paths

There are two execution paths depending on the worker's capabilities:

- **MCP Path** (Claude Code, interactive): Use `browser_navigate`, `browser_evaluate`, `browser_take_screenshot`, and other MCP Playwright tools directly. This is the primary path described in Sections 3-18.
- **Script Path** (Codex, headless workers): Write and run a `.cjs` Node.js script using `require('playwright-core')`. See Section 0.3 for the boilerplate and translation table. Reference `tests/e2e/q08-quiz-frequency.cjs` for a complete working example.

Workers MUST detect which path is available and use the appropriate one. If MCP tools fail or are not configured, fall back to the Script Path.

---

## 2. Known Limitations & False Positives — READ FIRST

### NEVER report these as bugs. They are expected in the test environment.

| Category | Examples | Why it happens |
|----------|----------|----------------|
| **WebSocket/HMR** | `WebSocket connection to 'ws://...' failed`, `[vite] failed to connect to websocket` | No HMR server in test environment |
| **API responses** | 404/500/400 from `/api/facts/*`, `/api/analytics/*`, `/api/auth/*` | No backend server; app works offline |
| **CORS errors** | Any CORS-related console message | No API server deployed |
| **GPU stall** | `GPU stall due to ReadPixels` | WebGL headless browser limitation |
| **Network failures** | `net::ERR_CONNECTION_REFUSED` to localhost API endpoints | No backend running |
| **Browser crashes** | `Target page, context or browser has been closed` | Playwright/browser stability, not game code |
| **Service worker** | Any service-worker-related warnings | Not relevant in test environment |
| **Favicon** | `favicon.ico` 404 | No favicon configured |

### Phaser Canvas Limitations — CRITICAL

Playwright CANNOT interact with Phaser canvas objects. This is a fundamental limitation, not a bug.

**What does NOT work:**
- Key presses (`ArrowDown`, `ArrowLeft`, etc.) — dispatched to the browser but Phaser's input system does not process them reliably in headless mode
- Clicking Phaser canvas objects — mine blocks, companion sprites, farm slots, crafting UI, dome room interactables
- Any attempt to "mine blocks" via keyboard input

**What DOES work:**
- DOM overlay buttons with `force: true`: `btn-dive`, `btn-enter-mine`, `btn-surface`, `quiz-answer-0` through `quiz-answer-3`, `btn-age-adult`
- Reading ALL game state via `browser_evaluate` with `window.__terraDebug()` and store reads
- Injecting state changes via `browser_evaluate`

**If `totalBlocksMined` does not change after key presses, this is a KNOWN LIMITATION. Do NOT report it as a bug.**

Instead of testing via input simulation, focus on **state validation and data integrity** (see Section 10).

### Filtered Console Reader — MANDATORY

Use this instead of raw `browser_console_messages` to avoid noise:

```javascript
(() => {
  const NOISE_PATTERNS = [
    /WebSocket connection.*failed/i,
    /\[vite\] failed to connect/i,
    /failed to load resource.*status of [45]\d\d/i,
    /GPU stall due to ReadPixels/i,
    /net::ERR_CONNECTION_REFUSED/i,
    /CORS/i,
    /api\/(facts|analytics|auth)/i,
    /WebSocket closed without opened/i,
    /favicon\.ico/i,
    /service.worker/i,
  ];
  return window.__terraLog
    ? window.__terraLog.filter(e => e.type === 'error').slice(-20)
    : [];
})()
```

NEVER report WebSocket, HMR, CORS, API 404/500, or GPU stall messages as issues. Only report errors that indicate actual game logic failures.

---

## 3. Token Budget — HARD LIMITS

| Resource | Max | Notes |
|----------|-----|-------|
| Screenshots (`browser_take_screenshot`) | **6** | Only at the 5 checkpoints below, plus 1 spare for bugs |
| Snapshots (`browser_snapshot`) | **15** | Cheap DOM text — use for all state checks |
| `browser_evaluate` calls | **30** | Store reads, state checks, filtered console |
| Key presses (`browser_press_key`) | **250** | Stop mining and surface if approaching this |

### Screenshot Checkpoints (ONLY these 5 + 1 spare)

1. **BASE**: After save injection, base/dome screen loaded and verified
2. **MINE_ENTRY**: First frame of mine gameplay (grid visible, HUD active)
3. **FIRST_QUIZ**: First quiz overlay encountered
4. **DIVE_END**: Dive results screen or end-of-dive state
5. **FINAL_DOME**: Return to dome after dive, final state

NEVER take more than 6 screenshots. Use `browser_snapshot` for everything else.

---

## 4. Pre-Flight Checks — MANDATORY

Before injecting saves or starting gameplay, run these three steps in a single `browser_evaluate` after initial navigation:

```javascript
// Step 1: Navigate to http://localhost:5173 via browser_navigate
// Step 2: Run pre-flight via browser_evaluate:
(async () => {
  // Unregister stale service workers
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(r => r.unregister()));
  // Clear localStorage
  localStorage.clear();
  return { swsRemoved: regs.length, storageCleared: true };
})()
```

If `browser_navigate` fails (page doesn't load), the dev server is not running. Abort immediately and report: "Dev server not responding at localhost:5173."

### Script Path Equivalent

For Codex / headless workers using the Script Path (see Section 0.3), here is the same pre-flight as a Node.js script pattern:

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 412, height: 915 });

  // Step 1: Navigate
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

  // Step 2: Pre-flight — clear SW + localStorage
  const preflight = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    localStorage.clear();
    return { swsRemoved: regs.length, storageCleared: true };
  });
  console.log('Pre-flight:', preflight);

  // Step 3: Inject save (customize buildSave() for your scenario)
  await page.evaluate((save) => {
    localStorage.setItem('terra_guest_mode', 'true');
    localStorage.setItem('terra_age_bracket', 'teen');
    localStorage.setItem('recall-rogue-save', JSON.stringify(save));
  }, buildSave());

  // Step 4: Reload with skipOnboarding
  await page.goto('http://localhost:5173?skipOnboarding=true', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Step 5: Verify
  const state = await page.evaluate(() => {
    const s = globalThis[Symbol.for('terra:playerSave')];
    if (!s) return { error: 'no store' };
    let v; s.subscribe(x => { v = x })();
    const cs = globalThis[Symbol.for('terra:currentScreen')];
    let screen; cs?.subscribe(x => { screen = x })();
    return { loaded: !!v, factCount: v?.learnedFacts?.length, screen };
  });
  console.log('Verification:', state);

  // ... continue with test protocol ...

  await browser.close();
})();
```

---

## 5. Save Injection

Build a custom `PlayerSave` object tailored to the test scenario, inject it, and VERIFY it loaded correctly before proceeding.

### Injection Protocol

```javascript
// After pre-flight, run via browser_evaluate:
(() => {
  const now = Date.now();
  const MS_PER_DAY = 86400000;

  const save = {
    // === REQUIRED FIELDS (customize values based on test scenario) ===
    version: 1,
    factDbVersion: 0,
    playerId: 'playthrough-tester',
    ageRating: 'teen',
    createdAt: now,
    lastPlayedAt: now,

    // Resources
    oxygen: 3,  // number of tanks (each = 100 O2 points)
    minerals: { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 },

    // Knowledge (SM-2 spaced repetition)
    learnedFacts: [],      // array of fact ID strings
    reviewStates: [],      // array of ReviewState objects (see below)
    soldFacts: [],
    discoveredFacts: [],

    // Stats
    stats: {
      totalBlocksMined: 0,
      totalDivesCompleted: 0,
      deepestLayerReached: 0,
      totalFactsLearned: 0,
      totalFactsSold: 0,
      totalQuizCorrect: 0,
      totalQuizWrong: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalSessions: 0,
      zeroDiveSessions: 0,
    },

    lastDiveDate: undefined,
    unlockedDiscs: [],
    craftedItems: {},
    craftCounts: {},
    activeConsumables: [],
    insuredDive: false,
    ownedCosmetics: [],
    equippedCosmetic: null,
    purchasedDeals: [],
    lastDealDate: undefined,
    fossils: {},
    activeCompanion: null,
    lastMorningReview: undefined,
    lastEveningReview: undefined,
    knowledgePoints: 0,
    purchasedKnowledgeItems: [],
    unlockedRooms: ['command'],
    farm: { slots: [null, null, null], maxSlots: 3 },
    premiumMaterials: {},
    streakFreezes: 0,
    lastStreakMilestone: 0,
    claimedMilestones: [],
    streakProtected: false,
    titles: [],
    activeTitle: null,
    hubState: { unlockedFloorIds: ['starter'], floorTiers: { starter: 0 } },
    interestConfig: { weights: {}, lockedCategories: [] },
    behavioralSignals: { perCategory: {}, lastRecalcDives: 0 },
    archetypeData: { detected: 'undetected', manualOverride: null, lastEvaluatedDate: null, detectedOnDay: null },
    engagementData: { dailySnapshots: [], currentScore: 50, mode: 'normal' },
    tutorialComplete: true,
    hasCompletedInitialStudy: false,
    selectedInterests: ['Generalist'],
    interestWeights: {},
    diveCount: 0,
    tutorialStep: 0,
    activeFossil: null,
    studySessionsCompleted: 0,
    pendingArtifacts: [],
    ownedPickaxes: ['standard_pick'],
  };

  localStorage.setItem('terra_guest_mode', 'true');
  localStorage.setItem('terra_age_bracket', 'teen');
  localStorage.setItem('recall-rogue-save', JSON.stringify(save));
  return { injected: true, factCount: save.learnedFacts.length };
})()
```

Then navigate to load the save:
```
browser_navigate -> http://localhost:5173?skipOnboarding=true
```

### Post-Injection Verification — MANDATORY

After navigation, wait up to 5 seconds, then verify:

```javascript
(() => {
  const s = globalThis[Symbol.for('terra:playerSave')];
  if (!s) return { error: 'playerSave store not found' };
  let v;
  s.subscribe(x => { v = x })();
  return {
    loaded: !!v,
    factCount: v?.learnedFacts?.length ?? -1,
    oxygen: v?.oxygen ?? -1,
    minerals: v?.minerals ?? null,
    reviewStateCount: v?.reviewStates?.length ?? -1,
    screen: (() => {
      const cs = globalThis[Symbol.for('terra:currentScreen')];
      if (!cs) return 'unknown';
      let sv; cs.subscribe(x => { sv = x })(); return sv;
    })()
  };
})()
```

**Verification rules:**
- `factCount` must match the number of fact IDs you injected
- `oxygen` must match the tank count you set
- `screen` should be `'base'` (not `'onboarding'`, `'ageGate'`, or `'cutscene'`)
- If screen is `'cutscene'`, reload the page ONCE (`browser_navigate` again). This is a known race condition.
- If ANY field is wrong or `-1`, retry injection ONCE. If it fails again, abort and report the injection failure.
- Do NOT proceed until verification passes.

### Available Fact IDs (30 real facts in the database)

```
cult-001, cult-002, cult-003, cult-004, cult-005,
cult-006, cult-007, cult-008, cult-009, cult-010,
geo-001, geo-002, geo-003, geo-004, geo-005,
lsci-001, lsci-002, lsci-003, lsci-004, lsci-005,
hist-001, hist-002, hist-003, hist-004, hist-005,
nsci-001, nsci-002, nsci-003, nsci-004, nsci-005
```

### ReviewState Object Shape

Each entry in `reviewStates` must have ALL of these fields:

```javascript
{
  factId: 'cult-001',           // must match an entry in learnedFacts
  cardState: 'review',          // 'new' | 'learning' | 'review' | 'relearning'
  easeFactor: 2.5,              // starts 2.5, min 1.3
  interval: 7,                  // days until next review
  repetitions: 3,               // consecutive correct answers
  nextReviewAt: Date.now(),     // Unix ms — set to past for overdue
  lastReviewAt: Date.now(),     // Unix ms
  quality: 3,                   // last response quality 0-5
  learningStep: 0,              // step index for learning/relearning
  lapseCount: 0,                // times card lapsed
  isLeech: false,               // flagged after 8+ lapses
}
```

**Recipes for different card states:**
- **New**: `{ cardState: 'new', easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewAt: 0, lastReviewAt: 0, quality: 0, learningStep: 0, lapseCount: 0, isLeech: false }`
- **Learning**: `{ cardState: 'learning', easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewAt: now + 600000, learningStep: 0 or 1, quality: 0 }`
- **Review (young, overdue)**: `{ cardState: 'review', easeFactor: 2.5, interval: 5, repetitions: 3, nextReviewAt: now - 2*MS_PER_DAY }`
- **Review (mature, overdue)**: `{ cardState: 'review', easeFactor: 2.7, interval: 90, repetitions: 10, nextReviewAt: now - 7*MS_PER_DAY }`
- **Review (not due)**: `{ cardState: 'review', easeFactor: 2.5, interval: 14, repetitions: 4, nextReviewAt: now + 10*MS_PER_DAY }`
- **Relearning (lapsed)**: `{ cardState: 'relearning', easeFactor: 1.8, interval: 10, repetitions: 0, nextReviewAt: now + 600000, lapseCount: 2, learningStep: 0 }`

**Important**: Mine quizzes ONLY select cards where `cardState === 'review'` AND `nextReviewAt <= Date.now()`. To test mine quizzes, you MUST include overdue review cards.

---

## 6. State Capture Protocol

### Snapshot-First Rule

Default to `browser_snapshot` (cheap DOM text) for ALL state checks. Only use `browser_take_screenshot` at the 5 designated checkpoints.

### Reading Svelte Stores

```javascript
// Generic pattern — replace KEY with store name
(() => {
  const s = globalThis[Symbol.for('terra:KEY')];
  if (!s) return null;
  let v;
  s.subscribe(x => { v = x })();
  return v;
})()
```

**Key store names:**

| Store Key | Contains |
|-----------|----------|
| `terra:playerSave` | Full save: learnedFacts, reviewStates, minerals, oxygen, stats |
| `terra:currentScreen` | Current screen name string |
| `terra:activeQuiz` | Active quiz data (null when no quiz) |
| `terra:diveResults` | Dive results after endDive() |

### Compact State Read (minimizes evaluate calls)

```javascript
(() => {
  const read = (key) => {
    const s = globalThis[Symbol.for(key)];
    if (!s) return null;
    let v; s.subscribe(x => { v = x })(); return v;
  };
  const save = read('terra:playerSave');
  return {
    screen: read('terra:currentScreen'),
    quiz: read('terra:activeQuiz'),
    diveResults: read('terra:diveResults'),
    o2: save?.oxygen,
    minerals: save?.minerals,
    factCount: save?.learnedFacts?.length,
    reviewStateCount: save?.reviewStates?.length,
    stats: save?.stats,
  };
})()
```

### Debug Snapshot (comprehensive)

```javascript
window.__terraDebug()
// Returns: { currentScreen, phaser: { running, activeScene }, stores: {...},
//           interactiveElements: [...], recentErrors: [...] }
```

### Event Log (last N events)

```javascript
window.__terraLog.slice(-20)
```

---

## 7. Visual Analysis Protocol — MANDATORY

After EVERY screenshot, the agent MUST evaluate ALL of the following and include a "Visual Check" table in the report. Only elaborate on failures.

| # | Check | What to look for |
|---|-------|------------------|
| 1 | **Sprites** | All expected sprites visible? Any placeholder rectangles, missing images, broken textures, teal fallback rectangles? |
| 2 | **Layout** | Any overflow, clipping, elements outside viewport? Proper containment? |
| 3 | **Text** | All text readable? Truncation, overlap, wrong font size? |
| 4 | **Colors/Contrast** | Appropriate palette? Readable text contrast? Missing backgrounds? |
| 5 | **Z-Order** | Elements correctly stacked? Buttons hidden behind other elements? |
| 6 | **Empty States** | If a list/grid should have items, does it? Unexpected "empty" messages? |
| 7 | **Alignment** | Elements properly aligned? Even spacing? Broken grids? |
| 8 | **Animations** | Any frozen/stuck frames visible? Missing transitions? |
| 9 | **Mobile Fit** | Everything fits mobile viewport (412x915)? No horizontal scroll? |
| 10 | **Interactive Elements** | Buttons visible and properly styled? Disabled buttons that should be enabled? |

**Format in report:**
```markdown
### Screenshot N: {checkpoint name}
| Check | Status | Notes |
|-------|--------|-------|
| Sprites | PASS/FAIL | {details only if fail} |
| Layout | PASS/FAIL | |
...
```

---

## 8. Interaction Constraints

### What Works (DOM overlay buttons)

- `browser_click` with `force: true` on elements with `data-testid`:
  - `btn-dive`, `btn-enter-mine`, `btn-surface`
  - `quiz-answer-0` through `quiz-answer-3`
  - `btn-age-adult`, `hud-o2-bar`
- Screen changes: poll `terra:currentScreen` store to detect transitions
- Quiz detection: check `terra:activeQuiz` store (non-null when quiz is active)

### What Does NOT Work (Phaser canvas)

- Arrow key presses for mining (Phaser ignores them in headless mode)
- Clicking on canvas-rendered game objects (mine blocks, companions, farm slots, crafting buttons, dome interactables)
- Audio/sound testing (not implemented in headless)
- Multi-player/social features (no backend)
- Push notifications (no Capacitor in browser)

### Key Press Protocol (when attempting mining — understand limitations)

If the test scenario requires attempting mine key presses:
1. Press 5 keys per batch (200ms implicit delay between `browser_press_key` calls)
2. After each batch, run one `browser_evaluate` to check state
3. Do NOT take a snapshot between individual key presses
4. If `totalBlocksMined` stays at 0 after 20 key presses, STOP pressing keys — this is the Phaser limitation, not a bug
5. Shift to state validation approach (Section 10) instead

---

## 9. Smart Mining Loop

Because Phaser canvas input is unreliable in headless mode, the mining loop has two modes:

### Mode A: Key Press Attempt (first 20 keys only)

```
1. Press 5 arrow keys (Down, Down, Right, Down, Left pattern)
2. browser_evaluate -> compact state read
3. If totalBlocksMined increased: Phaser is responding! Continue with key presses.
4. If totalBlocksMined unchanged after 20 keys: Switch to Mode B.
```

### Mode B: State Observation (primary mode)

When key presses don't register (the common case), shift to observing the game state as it exists:

```
1. browser_evaluate -> read full game state (save, screen, quiz, diveResults)
2. browser_snapshot -> check DOM for HUD values, visible elements
3. Validate data integrity (see Section 10)
4. Check for quiz triggers via store polling
5. If a quiz appears, handle it (see Event Handlers below)
6. Take screenshots at designated checkpoints
7. Document all observations
```

### Event Handlers

**Quiz appeared** (`quiz !== null` from store read):
1. Take Screenshot Checkpoint #3 (FIRST_QUIZ) if this is the first quiz
2. Read full quiz data: factId, question, choices, correctAnswer
3. Decide answer strategy (see Deliberate Wrong Answers below)
4. Click `quiz-answer-{index}` with `force: true`
5. Wait 2 seconds, re-check state to confirm quiz dismissed
6. Record O2 before/after

**Dive ended** (`screen === 'diveResults'`):
1. IMMEDIATELY read `terra:diveResults` store
2. Read final playerSave state
3. Take Screenshot Checkpoint #4 (DIVE_END)
4. Record complete dive results

**Screen changed unexpectedly**:
1. Take `browser_snapshot` (NOT screenshot)
2. Log the unexpected transition
3. Attempt to continue or document the issue

### Deliberate Wrong Answers — MANDATORY for Consistency Penalty Testing

When a quiz appears for a **mature card** (one where `repetitions >= 5` in the injected reviewStates):
1. Read `correctAnswer` from quiz data
2. Click a DIFFERENT answer index (answer WRONG deliberately)
3. Record O2 before and after
4. Document: factId, repetitions, O2 delta, whether consistency penalty was applied
5. Expected: mature cards (repetitions >= 4) get extra O2 drain on wrong answers

For all other cards (repetitions < 5), answer CORRECTLY.

Include at least 3-4 mature cards (repetitions >= 5) in the injected save to test this.

---

## 10. Data Integrity Validation — MANDATORY

Since Phaser input is unreliable, shift testing effort toward validating game data consistency. Run these checks via `browser_evaluate`:

### Save Data Validation

```javascript
(() => {
  const s = globalThis[Symbol.for('terra:playerSave')];
  if (!s) return { error: 'no save store' };
  let save; s.subscribe(x => { save = x })();
  if (!save) return { error: 'save is null' };

  const issues = [];

  // Check SM-2 data integrity
  (save.reviewStates || []).forEach((rs, i) => {
    if (rs.easeFactor < 1.3) issues.push(`reviewState[${i}] easeFactor ${rs.easeFactor} < 1.3`);
    if (rs.interval < 0) issues.push(`reviewState[${i}] negative interval ${rs.interval}`);
    if (isNaN(rs.nextReviewAt)) issues.push(`reviewState[${i}] NaN nextReviewAt`);
    if (!['new','learning','review','relearning'].includes(rs.cardState))
      issues.push(`reviewState[${i}] invalid cardState '${rs.cardState}'`);
    if (!save.learnedFacts.includes(rs.factId))
      issues.push(`reviewState[${i}] factId '${rs.factId}' not in learnedFacts`);
  });

  // Check learnedFacts have matching reviewStates
  const rsFactIds = new Set((save.reviewStates || []).map(r => r.factId));
  save.learnedFacts.forEach(f => {
    if (!rsFactIds.has(f)) issues.push(`learnedFact '${f}' has no reviewState`);
  });

  // Check minerals are non-negative
  Object.entries(save.minerals || {}).forEach(([k, v]) => {
    if (v < 0) issues.push(`mineral '${k}' is negative: ${v}`);
  });

  // Check stats are non-negative
  Object.entries(save.stats || {}).forEach(([k, v]) => {
    if (typeof v === 'number' && v < 0) issues.push(`stat '${k}' is negative: ${v}`);
  });

  // Check oxygen is valid
  if (save.oxygen < 0) issues.push(`oxygen is negative: ${save.oxygen}`);

  return { issueCount: issues.length, issues, valid: issues.length === 0 };
})()
```

### HUD-Store Consistency Check

After taking a screenshot or snapshot that shows the HUD, compare DOM-rendered values against store values:

```javascript
(() => {
  const s = globalThis[Symbol.for('terra:playerSave')];
  if (!s) return { error: 'no save store' };
  let save; s.subscribe(x => { save = x })();

  // Read O2 bar element
  const o2El = document.querySelector('[data-testid="hud-o2-bar"]');
  const o2Text = o2El?.textContent?.trim() ?? 'not found';

  return {
    storeOxygen: save?.oxygen,
    hudO2Text: o2Text,
    storeMinerals: save?.minerals,
    storeScreen: (() => {
      const cs = globalThis[Symbol.for('terra:currentScreen')];
      if (!cs) return 'unknown';
      let sv; cs.subscribe(x => { sv = x })(); return sv;
    })(),
  };
})()
```

### Room Unlock Consistency

```javascript
(() => {
  const s = globalThis[Symbol.for('terra:playerSave')];
  if (!s) return null;
  let save; s.subscribe(x => { save = x })();
  return {
    unlockedRooms: save?.unlockedRooms,
    hubFloors: save?.hubState?.unlockedFloorIds,
    diveCount: save?.diveCount,
    divesCompleted: save?.stats?.totalDivesCompleted,
  };
})()
```

---

## 11. Wait Time Standards

| Transition | Wait Strategy | Max Retries |
|---|---|---|
| Page load after navigate | Poll `terra:currentScreen` store every 500ms for up to 10s | 2 reloads |
| Preset -> base screen | Wait up to 5s, check screen store. If stuck on `cutscene`, reload once | 1 |
| btn-dive click -> divePrepScreen | Wait 3s, check screen store | 1 retry click |
| btn-enter-mine -> mine loaded | Wait 5s, then check for `hud-o2-bar` element | 1 retry click |
| Mine key press batch (5 keys) | 200ms between each key press | - |
| Quiz answer click -> quiz dismissed | Wait 2s, check `terra:activeQuiz` is null | - |
| Surface/dive end -> diveResults | Wait 3s, check screen store | - |

**General rule:** After any click that should cause a screen transition, wait 3 seconds then verify the transition occurred via store read before proceeding. If it didn't happen, retry the click once. If it still doesn't happen, document the failure and continue.

---

## 12. Observation Protocol — Finding Confidence Levels

Every finding MUST be tagged with exactly one confidence level:

| Tag | Meaning | Criteria |
|-----|---------|----------|
| `[CONFIRMED-BUG]` | Verified with data | Store values, console errors, or visual evidence prove this is a real code bug |
| `[LIKELY-BUG]` | Strong evidence, not 100% confirmed | Needs investigation but pattern is suspicious |
| `[DESIGN-QUESTION]` | Working as coded, might not be intended | Flag for human review |
| `[ENVIRONMENT]` | Caused by test infrastructure | Headless browser, no backend, Playwright limitations — do NOT include in issues table |
| `[COSMETIC]` | Visual polish issue, not functional | Low priority |

**Rules:**
- NEVER tag a finding as `[CONFIRMED-BUG]` unless you have concrete evidence (store values, error messages, visual proof)
- NEVER include `[ENVIRONMENT]` findings in the Confirmed Issues table
- If the same issue appears multiple times, report it ONCE with a count. Example: "O2 HUD mismatch (observed 3 times at actions 20, 45, 72)." Do NOT create separate rows for repeated occurrences.

### What to Observe

**Visual** (on screenshots): Missing sprites, layout overflow, z-order problems, alignment issues, text truncation, color/contrast problems, mobile viewport fit (see Section 7 checklist).

**Behavioral** (on snapshots/evaluates): Wrong screen transitions, buttons not responding, unexpected state changes, actions having no effect.

**Data** (on store reads): SM-2 values outside valid ranges, cards quizzed that shouldn't be (wrong cardState, not due), mineral counts that don't match expected calculations, missing or corrupt quiz data, review states changing for uninvolved facts.

---

## 13. Performance Metrics

Capture performance data at two points: after initial page load and after entering the mine.

```javascript
(() => {
  const perf = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  return {
    pageLoadMs: perf ? Math.round(perf.loadEventEnd - perf.startTime) : null,
    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime ?? null,
    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime ?? null,
    jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  };
})()
```

Include results in the report under "Performance Metrics".

---

## 14. Gameplay-Specific Guidance

### Mine

- **Navigate**: base -> `btn-dive` (force:true) -> wait 3s -> `btn-enter-mine` (force:true) -> wait 5s
- **Mining**: Attempt Mode A key presses (20 max). If blocks don't increase, switch to Mode B state observation.
- **Quiz handling**: Read `terra:activeQuiz` store for factId/question/choices/correctAnswer, click `quiz-answer-{index}` with force:true
- **Monitor**: O2 levels, quiz encounters, hazard events, screen transitions
- **Consistency penalty**: Mature cards (repetitions >= 4) answered wrong -> extra O2 drain
- **Dive ends when**: O2 depletes -> screen becomes `diveResults`

### Study Session

- **Navigate**: base -> study/review button, or set screen via `globalThis[Symbol.for('terra:currentScreen')].set('studySession')`
- **Controls**: Click "Reveal" button, then rate with Again/Hard/Good/Easy buttons
- **Monitor**: SM-2 state changes per card, session completion rewards, card count
- **Ends when**: All due cards reviewed

### Dome / Hub

- **Navigate**: base screen IS the dome
- **Test**: Visit each unlocked room via DOM buttons, verify sprites load (screenshot check), check for teal fallback rectangles
- **Note**: Room interactables are Phaser canvas objects — cannot be clicked via Playwright

### Farm / Crafting / Companions

These are primarily Phaser canvas interactions. Use `window.__terraDebug()` and store reads to validate state rather than attempting to click canvas objects.

---

## 15. Abort Conditions

The agent MUST stop the playthrough and write up findings if ANY of these occur:

- **3 consecutive state checks** return identical values (game is stuck)
- **Screenshot budget exhausted** (6 screenshots taken)
- **Key press budget exceeded** (250 key presses)
- **Same game error appears 5+ times** in filtered console (not noise — actual game errors)
- **Screen stuck on unexpected value** for >15 seconds after expected transition
- **Save injection fails twice** after retry

**A partial report with clear data beats a run that exhausted context. Stop early, write what you have.**

---

## 16. Report Template — MANDATORY FORMAT

The report MUST follow this exact structure. No variations, no omissions.

**File path:** `docs/playthroughs/{gameplay-type}/YYYY-MM-DD-HHmm-{kebab-description}.md`

Create the subdirectory if it doesn't exist.

```markdown
# Playthrough Report — {Type}

## Metadata
| Field | Value |
|---|---|
| Date | YYYY-MM-DD HH:mm |
| Gameplay | {mine/study/dome/etc.} |
| Scenario | {brief description} |
| Preset/Save | {preset name or "custom injection"} |
| Budget Used | {N} screenshots, {N} snapshots, {N} evaluate, {N} key presses |
| Result | PASS / PARTIAL / BLOCKED |

## Performance Metrics
| Metric | Value |
|---|---|
| Page Load | {N}ms |
| First Contentful Paint | {N}ms |
| JS Heap | {N}MB |

## Starting State
| Field | Value |
|---|---|
| Oxygen Tanks | {N} |
| Learned Facts | {N} |
| Review States | {N} (N overdue) |
| Minerals | dust:{N} shard:{N} crystal:{N} geode:{N} essence:{N} |
| Total Dives | {N} |
| Unlocked Rooms | {list} |
{Add other relevant fields for the scenario}

## Visual Checks
### Screenshot 1: {checkpoint name}
| Check | Status | Notes |
|---|---|---|
| Sprites | PASS/FAIL | {details if fail} |
| Layout | PASS/FAIL | |
| Text | PASS/FAIL | |
| Colors | PASS/FAIL | |
| Z-Order | PASS/FAIL | |
| Empty States | PASS/FAIL | |
| Alignment | PASS/FAIL | |
| Animations | PASS/FAIL | |
| Mobile Fit | PASS/FAIL | |
| Interactive | PASS/FAIL | |
{Repeat for each screenshot}

## Playthrough Log
{Batch-by-batch log grouped by ~10 actions}
{Each batch: actions taken, state changes observed, O2 readings}
{Special events: quizzes (factId, answer, correct/wrong, O2 delta), transitions}

## Data Integrity Results
{Output of save data validation check}
{HUD-Store consistency check results}
{Any data anomalies found}

## Confirmed Issues
| # | Confidence | Severity | Category | Description | Evidence |
|---|---|---|---|---|---|
{ONLY [CONFIRMED-BUG] and [LIKELY-BUG] items}
{Each row MUST have concrete evidence in the Evidence column}
{If no issues found, write "No confirmed issues found."}

## Design Questions
{[DESIGN-QUESTION] items — things working as coded but worth reviewing}
{If none, write "No design questions."}

## Consistency Penalty Test Results
| factId | repetitions | O2 Before | O2 After | Expected Penalty | Actual Drain | Pass/Fail |
|---|---|---|---|---|---|---|
{For each mature card deliberately answered wrong}
{If no quizzes triggered, note that and explain why}

## Ending State
| Field | Value |
|---|---|
{Same fields as Starting State}

## State Delta
| Field | Before | After | Expected? |
|---|---|---|---|
{All changed values with yes/no on whether the change was expected}

## Pacing & Balance Notes
{Subjective observations: timing feel, difficulty, reward pacing}
```

---

## 17. Orchestrator Instructions

After the Sonnet agent finishes:

1. Read the completed report from the file it created
2. For each `[CONFIRMED-BUG]` or `[LIKELY-BUG]` issue:
   - Search relevant source files to identify root causes
   - Reference specific file paths and line numbers
   - Propose concrete fixes (not vague suggestions)
   - Assess blast radius
3. Append an "Analysis & Fix Proposals" section to the report:
   ```markdown
   ## Analysis & Fix Proposals (Opus)

   ### Issue {n}: {title}
   - **Severity**: {CRITICAL/HIGH/MEDIUM/LOW/COSMETIC}
   - **Category**: {visual/behavioral/data/pacing}
   - **Root Cause**: {hypothesis with file:line references}
   - **Proposed Fix**: {code-level description}
   - **Blast Radius**: {what else might break}
   - **Needs Re-test**: {yes/no}
   ```
4. Discard any `[ENVIRONMENT]` findings — do not investigate them
5. Summarize key findings to the user

---

## 18. Quick Reference: Full Mine Playthrough Sequence

```
 1. browser_navigate -> http://localhost:5173
 2. browser_evaluate -> pre-flight (clear SW, clear localStorage)
 3. browser_evaluate -> inject save (customize for scenario)
 4. browser_navigate -> http://localhost:5173?skipOnboarding=true
 5. Wait 5s, browser_evaluate -> verify save loaded
    - If screen === 'cutscene', reload once
    - If verification fails, retry injection once
 6. browser_evaluate -> capture performance metrics
 7. browser_take_screenshot -> CHECKPOINT #1 (BASE) + visual check
 8. browser_evaluate -> data integrity validation
 9. browser_click [data-testid="btn-dive"] force:true
10. Wait 3s, browser_evaluate -> check screen is divePrepScreen
11. browser_click [data-testid="btn-enter-mine"] force:true
12. Wait 5s, browser_evaluate -> check screen, capture performance metrics
13. browser_take_screenshot -> CHECKPOINT #2 (MINE_ENTRY) + visual check
14. Attempt Mode A key presses (20 max)
    - If blocks increase: continue mining loop
    - If blocks don't increase: switch to Mode B (state observation)
15. Poll state every 5s via browser_evaluate
    - Handle quizzes (CHECKPOINT #3 on first quiz)
    - Watch for dive end
    - Run filtered console check every 30s
16. When diveResults detected:
    - IMMEDIATELY read terra:diveResults store
    - Read final playerSave
    - Run data integrity validation
    - browser_take_screenshot -> CHECKPOINT #4 (DIVE_END) + visual check
17. Navigate back to dome if applicable
    - browser_take_screenshot -> CHECKPOINT #5 (FINAL_DOME) + visual check
18. browser_evaluate -> HUD-store consistency check
19. Write report to docs/playthroughs/{type}/YYYY-MM-DD-HHmm-{description}.md
```

---

## 19. Example User Prompts

> "Test the mine with 20 review cards at varied SM-2 states, 3 O2 tanks, mid-game progression. Play through a full dive documenting all quiz encounters, hazard events, and O2 pacing."

> "Test the study session with 15 overdue cards, mix of vocab and general facts. Go through all of them rating some wrong to test lapse behavior."

> "Tour the dome with all rooms unlocked and max resources. Visit every room and document any visual issues."

> "Run a data integrity check: inject a save with edge-case values (near-minimum easeFactor, high lapse counts, large fact collections) and validate everything stays consistent after a dive."

> "Test the base screen layout on mobile: inject a mid-game save, screenshot the base screen, and do a thorough visual analysis of all UI elements."