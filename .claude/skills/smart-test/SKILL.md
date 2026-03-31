---
name: smart-test
description: Diff-aware testing — runs only tests affected by recent changes, plus auto-triggers headless balance sim when balance-related files change. Faster feedback than full test suite.
---

# Smart Test — Diff-Aware Testing

Run only the tests that matter for the current changes, instead of the full 1900+ test suite.

## Step 1: Identify Changed Files

```bash
# Uncommitted changes
git diff --name-only HEAD

# Or changes since last commit
git diff --name-only HEAD~1
```

## Step 2: Run Affected Tests

Vitest has a built-in `--related` flag that traces the import graph:

```bash
# Run tests related to changed files
npx vitest run --related $(git diff --name-only HEAD | tr '\n' ' ')
```

If `--related` returns nothing (changed file has no direct test consumers), fall back to:
```bash
# Run critical tests as a safety net
npx vitest run tests/unit/run-manager.test.ts tests/unit/encounter-engine.test.ts tests/unit/deckManager.hotfix.test.ts tests/unit/ascension.test.ts
```

## Step 3: Balance-Aware Auto-Trigger

If ANY of these files were changed, automatically run the headless balance simulator:

**Trigger files:**
- `src/data/balance.ts`
- `src/data/enemies.ts`
- `src/data/relics/starters.ts`
- `src/data/relics/unlockable.ts`
- `src/data/mechanics.ts`
- `src/data/statusEffects.ts`
- `src/game/systems/turnManager.ts`
- `src/game/combat/cardEffectResolver.ts`
- `src/game/combat/relicEffectResolver.ts`

**Balance sim command:**
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500
```

Review the output for significant shifts in win rate, average turns, or damage metrics compared to expected baselines.

## Step 4: Report

Summarize:
- Which files changed
- How many tests ran (vs full suite of 1900+)
- Pass/fail status
- Whether balance sim was triggered and its results
- Any files that changed but had NO test coverage (flag for attention)

## When to Use

- After any code change, instead of `npx vitest run` (full suite)
- Especially useful during rapid iteration on a single feature
- The full suite should still run before commits (the pre-commit hook handles this)

## If `--related` Fails

If `--related` fails or produces errors:
1. **DIAGNOSE** — check the error output. Common causes: broken import paths, missing test files, vitest config issues
2. **FIX** — resolve the root cause (fix the import, update the config, etc.)
3. **RETRY** — run `--related` again
4. If the `--related` flag itself is broken (vitest bug), run the full suite as an interim measure while investigating:
```bash
npx vitest run
```
But file an issue or fix the `--related` functionality — don't permanently accept the slower workflow.

### Registry Update (AUTO)
After running affected tests, stamp elements related to changed files:
```bash
npx tsx scripts/registry/updater.ts --ids "{comma-separated affected element IDs}" --type mechanicDate
```
