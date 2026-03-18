# AR-102: Overnight Mass Playtest — 8-Hour Autonomous Data Collection

## Overview

**Goal:** Run hundreds of bot games overnight, collecting rich per-encounter stats from the REAL game engine. Fix the 30% first-map-click timeout bug first, then launch a long-running collection script that gracefully handles failures, retries, and saves incrementally.

**Why:** We need 50+ successful runs per profile (300+ total) to do statistically meaningful balance analysis. At 60-80% success rate and 15-35s per run, this takes ~2-3 hours. The overnight window gives us buffer for retries and multiple ascension levels.

**CRITICAL:** The dev server (`npm run dev`) must be running on port 5173 throughout. The collection script must survive individual run failures without dying.

---

## Phase 1: Fix First-Map-Click Timeout Bug

### The Bug
~30% of runs timeout at 90s with 0 cards played, HP 100/100. The `selectMapNode` API fires but combat doesn't start. The map component needs time to mount before clicks register.

### The Fix
In `bot.ts`, after `selectArchetype` and before the main loop, add a dedicated "enter first room" step with retries:

```typescript
// Enter first room with retry (the map needs time to mount)
let enteredFirstRoom = false;
for (let attempt = 0; attempt < 5 && !enteredFirstRoom; attempt++) {
  await page.waitForTimeout(500); // Give map time to render
  const mapNodes = await page.evaluate(`...state-available query...`);
  if (mapNodes.length > 0) {
    const result = await page.evaluate(
      (id) => (window as any).__terraPlay?.selectMapNode?.(id),
      mapNodes[0].replace('map-node-', ''),
    );
    if (result?.ok) {
      await page.waitForTimeout(500);
      const screen = await readGameState(page);
      if (screen.currentScreen === 'combat') enteredFirstRoom = true;
    }
  }
}
```

### Verification
Run 20 sequential scholar runs — success rate should be >90%.

---

## Phase 2: Build Overnight Collection Script

### File: `tests/playtest/playwright-bot/overnight.ts`

A resilient wrapper around `runner.ts` logic that:
1. Runs in batches of 10 per profile
2. Saves results to disk after EACH batch (never loses data)
3. Retries failed seeds up to 2 times
4. Logs progress to console AND a log file
5. Continues to next profile if one profile crashes
6. Calculates running statistics

### Configuration
```typescript
const OVERNIGHT_CONFIG = {
  profiles: ['first_timer', 'casual_learner', 'regular', 'gamer', 'dedicated', 'scholar'],
  runsPerProfile: 100,        // 100 runs per profile = 600 total
  batchSize: 10,              // Save after every 10 runs
  maxRetries: 2,              // Retry failed seeds up to 2x
  parallel: 1,                // Sequential for reliability
  outputDir: 'data/playtests/overnight-2026-03-19/',
  logFile: 'data/playtests/overnight-2026-03-19/progress.log',
};
```

### Incremental Save Format
Each batch saves to: `data/playtests/overnight-2026-03-19/{profile}_batch_{N}.json`
Final aggregated file: `data/playtests/overnight-2026-03-19/combined.json`

### Progress Logging
```
[00:00:00] Starting overnight collection — 600 runs across 6 profiles
[00:00:00] === first_timer (100 runs) ===
[00:00:34] Batch 1/10: 8/10 success (2 retrying) — 34.2s
[00:01:12] Batch 2/10: 10/10 success — 38.1s
...
[00:15:00] first_timer complete: 92/100 success (92%) | Avg 22.3s | 87 victories, 5 defeats
[00:15:00] === casual_learner (100 runs) ===
...
[02:30:00] ALL COMPLETE — 547/600 successful runs across 6 profiles
[02:30:00] Results saved to data/playtests/overnight-2026-03-19/combined.json
```

### Graceful Error Handling
- Individual run crash → log error, continue to next run
- Entire batch crash → log, save what we have, continue to next batch
- Profile crash → save results, continue to next profile
- Dev server unreachable → wait 30s and retry up to 5 times
- Browser crash → close and relaunch

### Script Structure
```typescript
async function overnightCollection() {
  const startTime = Date.now();
  ensureOutputDir();

  const browser = await launchBrowser();

  for (const profileId of OVERNIGHT_CONFIG.profiles) {
    const profileResults = [];
    const failedSeeds = [];

    for (let batch = 0; batch < totalBatches; batch++) {
      const batchResults = await runBatch(browser, profileId, batch);
      profileResults.push(...batchResults);

      // Save incrementally
      saveBatchResults(profileId, batch, batchResults);
      logProgress(profileId, batch, batchResults);

      // Collect failed seeds for retry
      failedSeeds.push(...batchResults.filter(r => r.result === 'error' || r.result === 'timeout'));
    }

    // Retry failed seeds
    if (failedSeeds.length > 0 && OVERNIGHT_CONFIG.maxRetries > 0) {
      const retryResults = await retryFailed(browser, profileId, failedSeeds);
      profileResults.push(...retryResults);
      saveBatchResults(profileId, 'retries', retryResults);
    }

    // Save profile summary
    saveProfileSummary(profileId, profileResults);
  }

  // Save combined results
  saveCombinedResults();

  await browser.close();
  logFinalSummary(startTime);
}
```

### Usage
```bash
# Start dev server in one terminal:
npm run dev

# In another terminal, start overnight collection:
npx tsx tests/playtest/playwright-bot/overnight.ts

# Or with custom config:
npx tsx tests/playtest/playwright-bot/overnight.ts --runs 50 --parallel 1
```

---

## Phase 3: Analysis Report Generator

### File: `tests/playtest/playwright-bot/analyze.ts`

Reads the overnight JSON data and produces a comprehensive balance report:

```bash
npx tsx tests/playtest/playwright-bot/analyze.ts --input data/playtests/overnight-2026-03-19/combined.json
```

### Report Sections
1. **Profile Comparison** — win rate, avg cards, quiz accuracy, gold per profile
2. **Relic Analysis** — which relics were earned, trigger counts, correlation with wins
3. **Enemy Difficulty** — per-enemy win/loss rate, avg turns to kill, damage taken
4. **Per-Floor Death Rate** — which floors kill the most players
5. **Card Type Effectiveness** — charge vs quick play per card type
6. **Chain Analysis** — avg chain length, damage contribution
7. **Economy** — gold earned/spent, shop usage, food purchases
8. **Recommendations** — auto-generated balance suggestions

---

## Verification Gate

- [ ] First-map-click bug fixed (>90% success rate on 20 runs)
- [ ] Overnight script runs for 10+ minutes without crashing
- [ ] Incremental saves work (kill and restart preserves data)
- [ ] Combined JSON contains all successful runs
- [ ] Analysis report generates from combined data

---

## Estimated Timeline

| Phase | Time | Runs |
|-------|------|------|
| Phase 1 (fix bug) | 30 min | 20 test runs |
| Phase 2 (build script) | 30 min | — |
| Phase 3 (analyzer) | 30 min | — |
| Overnight collection | ~3-5 hours | 600 runs (100 per profile) |
| Analysis | 15 min | — |

Total overnight data: ~400-500 successful runs with full per-encounter breakdowns.
