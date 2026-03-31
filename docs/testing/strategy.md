# Testing Strategy

> **Purpose:** Overview of all testing layers in Recall Rogue — when to use each method, where tests live, and how to run them.
> **Last verified:** 2026-03-31
> **Source files:** `vitest.config.ts`, `tests/unit/*.test.ts`, `src/services/__tests__/`, `CLAUDE.md`

## Four Testing Layers

Recall Rogue uses four complementary layers. Use the right tool — they are not interchangeable.

| Layer | Tool | Speed | Best For |
|-------|------|-------|----------|
| Unit tests | Vitest | ~5s total | Logic correctness, service behavior, data validation |
| Headless balance sim | `tsx` + Node.js | 6 000 runs/5s | Win rates, economy balance, ascension tuning |
| Visual (Playwright) | MCP + E2E scripts | Seconds per screen | UI rendering, transitions, layout regressions |
| LLM playtest | `/llm-playtest` skill | Minutes | Subjective engagement, quiz quality, real card interactions |

Use headless sim for **all balance work** — it imports real game code with zero reimplementation drift. Use Playwright only for visual confirmation. Use LLM playtest for judgment calls numbers cannot capture.

## Unit Tests (Vitest)

**Run:** `npx vitest run`
**Watch:** `npx vitest`

Test locations:
- `tests/unit/` — 80+ standalone unit tests
- `tests/dev/` — dev tool smoke tests (`presets.test.ts`, `snapshotStore.test.ts`)
- `src/services/__tests__/` — service-colocated tests for `relicEffectResolver`

Archived tests live in `tests/unit/_archived/` and are excluded from runs.

**`vitest.config.ts` key settings:**
- `environment: 'happy-dom'` — faster than jsdom for Node-only code
- `globals: true` — no need to import `describe`/`it`/`expect`
- `setupFiles: ['./tests/setup.ts']`
- Coverage: v8, minimum 40% lines/functions/statements, 30% branches
- Excludes: `tests/e2e/**`, `tests/unit/_archived/**`, `src/_archived-mining/**`

**Key test files by area:**

| Area | File |
|------|------|
| SM-2 scheduler | `tests/unit/sm2.test.ts` |
| Combat balance regression | `tests/unit/balance.regression.test.ts` |
| Charge mechanic | `tests/unit/charge-mechanic.test.ts` |
| Relic system | `tests/unit/relicSystem.test.ts` |
| Relic effect resolver | `src/services/__tests__/relicEffectResolver.v2.test.ts` |
| Encounter engine | `tests/unit/encounter-engine.test.ts` |
| Enemy behaviors | `tests/unit/enemyBehaviors.test.ts` |
| Burn/bleed effects | `tests/unit/burn-bleed-status-effects.test.ts` |
| Floor manager | `tests/unit/floor-manager.test.ts` |
| Fact/question quality | `tests/unit/fact-question-quality.test.ts` |
| Determinism | `tests/unit/determinism.test.ts` |
| Card upgrade service | `tests/unit/cardUpgradeService.test.ts` |
| Run manager | `tests/unit/run-manager.test.ts` |

**Always run unit tests after any logic or data change** — typecheck alone is not enough.

## Headless Balance Simulator

See `docs/testing/headless-sim.md` for full documentation.

**Quick commands:**
```bash
# All 6 profiles × 1000 runs (full run mode — default)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000

# Single profile
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --profile scholar

# With ascension
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000 --ascension 10

# Relic audit
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/relic-audit.ts
```

## Visual Testing (Playwright)

See `docs/testing/playwright.md` for full documentation.

**Quick inspection sequence:**
1. Navigate: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
2. Screenshot: `browser_evaluate(() => window.__rrScreenshotFile())` → saves to `/tmp/rr-screenshot.jpg`
3. View: `Read("/tmp/rr-screenshot.jpg")`
4. Layout: `browser_evaluate(() => window.__rrLayoutDump())` → exact pixel coordinates

**E2E scripts** for automated regression:
```bash
node tests/e2e/01-app-loads.cjs    # App loads without JS errors
node tests/e2e/03-save-resume.cjs  # Save/resume flow
```

Both scripts use `channel: 'chrome'` (system Chrome) — mandatory on macOS ARM64 for WebGL.

## LLM Playtest (`/llm-playtest` skill)

Spawns Sonnet sub-agents that actually play the game via Playwright. Each agent has a distinct focus (quiz quality, balance curve, engagement, study flow). Reports land in `data/playtests/llm-batches/`.

Use for questions headless sim cannot answer: "Is the quiz fun?", "Do distractors feel fair?", "Does card reward feel rewarding?"

## Inspection Registry

The registry at `data/inspection-registry.json` tracks 415+ game elements across 14 tables.

```bash
npm run registry:sync    # Rebuild after adding/removing game elements
npm run registry:stale   # Show stale or never-inspected elements
```

Skills that auto-stamp the registry after running: `/inspect`, `/visual-inspect`, `/ux-review`, `/balance-sim`, `/strategy-analysis`, `/rogue-brain`, `/llm-playtest`, `/quick-verify`, `/smart-test`.

Use `/inspect` as the master orchestrator — it fires all applicable methods in parallel.

## Standard Verification Sequence

After any code change, run in order:

```bash
npm run typecheck    # TypeScript + Svelte type check
npm run build        # Production build (catches Vite/Rollup issues)
npx vitest run       # Unit tests (1900+)
```

For balance changes, also run the headless sim. For UI changes, also do a Playwright visual inspection. Never report a fix done without confirming the result.
