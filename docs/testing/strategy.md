# Testing Strategy

> **Purpose:** Overview of all testing layers in Recall Rogue — when to use each method, where tests live, and how to run them.
> **Last verified:** 2026-04-05
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

### Advanced Balance Analysis (`/advanced-balance`)

After running the basic headless sim, run `/advanced-balance` for deeper insight. The basic sim tells you **win rates** — advanced balance tells you **why** those rates are what they are:

- **Per-card win-rate contribution** — which cards correlate with winning vs losing runs
- **Tension metrics** — HP-at-death (close loss vs steamroll?), turns-to-outcome, meaningful-choice ratio
- **Predictability scoring** — can you tell by floor 3 whether you'll win? (high = boring mid-game)

Run after ANY balance change (enemy stats, card values, fizzle ratio, relic tuning). The basic sim shows the number moved; advanced balance shows whether the change made the game more or less fun to lose.

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

## Deck Structural Validation

Curated deck quality is verified at two levels:

**Per-deck** (during build): Inline validation script in `/deck-master` skill — run against the specific deck being built.

**Batch** (after any deck change):
```bash
node scripts/verify-all-decks.mjs           # All decks, summary table
node scripts/verify-all-decks.mjs --verbose  # Per-fact details on failures
```

Checks 12 quality dimensions across all 63 decks (45K+ facts): pool field naming, orphaned pool references, duplicate questions (excluding image-based), braces in questions (excluding fill-in-blank `{___}`), distractor collisions, missing fields, pool size minimums.

Run after modifying any deck JSON or assembly script. Target: 0 failures.

**Pool homogeneity analysis** (after answer pool design or reassignment):
```bash
node scripts/pool-homogeneity-analysis.mjs             # All knowledge decks
node scripts/pool-homogeneity-analysis.mjs --deck <id> # Single deck
node scripts/pool-homogeneity-analysis.mjs --json      # Machine-readable JSON
```

Detects pools where answer-length disparity lets players guess by length alone. Three flag levels:
- **FAIL** length ratio >3× within a pool (text answers only, bracket-numbers excluded)
- **WARN** length ratio >2×
- **INFO** bare-number answers that could use `{N}` bracket notation for algorithmic distractors
- **FAIL** pool <5 members with no `syntheticDistractors`

Exempt: all vocabulary/language decks, `world_flags`, script decks (hiragana/katakana/hangul). Run after any pool redesign or fact reassignment.

## Real-Engine Quiz Audit

The **real-engine quiz audit** (`scripts/quiz-audit-engine.ts`) exercises the actual game engine functions — `selectDistractors()`, `selectQuestionTemplate()`, `getNumericalDistractors()`, and `ConfusionMatrix` — against all curated deck JSON files. Unlike the static `quiz-audit.mjs` pre-commit gate, it catches engine-specific failures that only occur at runtime.

**Relationship to `quiz-audit.mjs`:** `quiz-audit.mjs` is a fast JS structural gate (run before every commit). `quiz-audit-engine.ts` is comprehensive engine-level validation (run after structural checks pass, especially before releases or after quiz engine changes).

```bash
# npm shorthand
npm run audit:quiz-engine                             # All knowledge decks
npm run audit:quiz-engine -- --include-vocab          # Include vocab/language decks
npm run audit:quiz-engine -- --deck <id> --verbose    # Single deck, full detail
npm run audit:quiz-engine -- --confusion-test         # Verify confusion matrix path

# Direct invocation with full options
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/quiz-audit-engine.ts [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--deck <id>` | Audit a single deck by ID |
| `--sample <n>` | Sample N facts per pool (faster for large decks; default: all) |
| `--mastery <levels>` | Comma-separated mastery levels to test (default: `0,2,4`) |
| `--verbose` | Print every fact result, not just failures |
| `--json` | Machine-readable JSON output (pipe to file for CI) |
| `--include-vocab` | Include vocabulary/language decks (skipped by default) |
| `--confusion-test` | Seed synthetic confusions and verify they surface in distractors |

**24 quality checks** — 10 preserved from `quiz-audit.mjs` plus 14 new engine-enabled checks:

| Check | Severity | Description |
|-------|----------|-------------|
| `answer_emdash` | FAIL | Answer contains em-dash (formatting error baked into answer text) |
| `answer_too_long` | FAIL/>100, WARN/>60 | Answer too long for comfortable in-game display |
| `distractor_count_low` | FAIL | Fewer than 2 distractors returned by engine |
| `length_ratio` | FAIL/>3×, WARN/>2× | Answer length vs distractor length ratio too large |
| `answer_in_distractors` | FAIL | Correct answer text appears as a distractor |
| `duplicate_distractors` | FAIL | Same distractor text appears twice |
| `question_too_long` | FAIL/>400, WARN/>300 | Rendered question too long for display |
| `missing_explanation` | FAIL | Fact has empty or missing explanation |
| `outlier_option_length` | WARN | One option length is >4× or <0.2× the average |
| `double_space` | WARN | Double spaces suggest an empty template placeholder slot |
| `synonym_violation` | FAIL | Distractor shares a synonym group with the correct fact |
| `unit_contamination` | WARN | Distractor has a different measurement unit than the answer |
| `pos_mismatch` | WARN | Vocab: distractor part-of-speech differs from correct answer |
| `template_fallback` | WARN | Real template fell back to `fact.quizQuestion` |
| `unresolved_placeholder` | FAIL | `{placeholder}` pattern still present in the rendered question |
| `reverse_answer_wrong` | FAIL | Reverse template returned the wrong answer |
| `reading_answer_wrong` | FAIL | Reading template returned the wrong answer |
| `question_text_leak` | WARN | Distractor answer text appears verbatim in the question |
| `all_pool_fill` | WARN | All distractors are `pool_fill` (no confusion or difficulty signals used) |
| `fallback_distractors` | WARN | Pre-generated fallback distractors used because pool was too small |
| `empty_correct_answer` | FAIL | Displayed correct answer is empty after template rendering |
| `mastery_count_wrong` | WARN | Distractor count returned does not match what mastery level requests |
| `confusion_not_responsive` | FAIL | `--confusion-test` mode: seeded confusion entry did not surface in distractors |
| `mastery_count_over` | FAIL | Got more distractors than the mastery level expects |

Runs at ~1000 facts/sec. Exits with code 1 if any FAILs. Image facts (`quizMode: image_question` or `image_answers`) are always skipped.

## Standard Verification Sequence

After any code change, run in order:

```bash
npm run typecheck    # TypeScript + Svelte type check
npm run build        # Production build (catches Vite/Rollup issues)
npx vitest run       # Unit tests (1900+)
```

For balance changes, also run the headless sim. For UI changes, also do a Playwright visual inspection. Never report a fix done without confirming the result.
