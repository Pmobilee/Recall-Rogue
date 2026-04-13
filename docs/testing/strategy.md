# Testing Strategy

> **Purpose:** Overview of all testing layers in Recall Rogue — when to use each method, where tests live, and how to run them.
> **Last verified:** 2026-04-13
> **Source files:** `vitest.config.ts`, `tests/unit/*.test.ts`, `src/services/__tests__/`, `CLAUDE.md`

## Five Testing Layers

Recall Rogue uses five complementary layers. Use the right tool — they are not interchangeable.

| Layer | Tool | Speed | Best For |
|-------|------|-------|----------|
| Unit tests | Vitest | ~5s total | Logic correctness, service behavior, data validation |
| Headless balance sim | `tsx` + Node.js | 6 000 runs/5s | Win rates, economy balance, ascension tuning |
| Visual (Playwright) | MCP + E2E scripts | Seconds per screen | UI rendering, transitions, layout regressions |
| LLM playtest | `/llm-playtest` skill | Minutes | Subjective engagement, quiz quality, real card interactions |
| Multiplayer E2E | `/multiplayer-playtest` skill | 10–20 min | Two-player flows, lobby, race mode, WebSocket transport |

Use headless sim for **all balance work** — it imports real game code with zero reimplementation drift. Use Playwright only for visual confirmation. Use LLM playtest for judgment calls numbers cannot capture. Use multiplayer E2E for any change touching lobby, transport, or race mode.

**Visual verification checklist:** `docs/testing/visual-verification/INDEX.md` — 885 items organized into 3 execution phases. Use for systematic pre-launch verification.

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

**Docker parallel testing (no chrome-lock):**
```bash
# Each container gets its own Xvfb + Chromium + SwiftShader WebGL — fully isolated
scripts/docker-visual-test.sh --scenario combat-basic --agent-id my-agent
# Outputs: /tmp/rr-docker-visual/{agent}_{scenario}_{timestamp}/
#   screenshot.png, rr-screenshot.jpg, layout-dump.txt, result.json
```
Supports 2-3 simultaneous containers (stagger launches by 3s). Requires Docker Desktop. ~60-110s per test due to software rendering. See `/visual-inspect` skill for full details.

## LLM Playtest (`/llm-playtest` skill)

Spawns Sonnet sub-agents that actually play the game via Playwright. Each agent has a distinct focus (quiz quality, balance curve, engagement, study flow). Reports land in `data/playtests/llm-batches/`.

Use for questions headless sim cannot answer: "Is the quiz fun?", "Do distractors feel fair?", "Does card reward feel rewarding?"

## Multiplayer E2E Playtest (`/multiplayer-playtest` skill)

Two-container Docker playtest that tests the full multiplayer system with real WebSocket transport. Boots two warm containers (host + guest) against the Fastify `webBackend`, then runs coordinated action sequences to verify:

- **Lobby system** (10 scenarios): create, join by code, password protection, lobby browser, deck selection, house rules, max players, visibility, ready/start gate, leave
- **Race Mode** (5 scenarios): race start, shared seed verification, gameplay, MultiplayerHUD, race end
- **Mode UI**: all 5 mode cards render correctly
- **Trivia Night**: isolated scenario preset test

**Usage:** `/multiplayer-playtest [lobby|race|smoke|ui]` (no argument = full suite)

**Infrastructure:** Requires Fastify server (port 3000), Vite dev server, and Docker. The skill manages all infrastructure automatically, including try/finally teardown so containers never leak.

**Output:** `data/playtests/mp-batches/MP-{DATE}/` with SUMMARY.md and per-scenario reports.

**When to run:** Any change touching `src/services/multiplayerLobbyService.ts`, `multiplayerTransport.ts`, `MultiplayerMenu.svelte`, `MultiplayerLobby.svelte`, `LobbyBrowserScreen.svelte`, `MultiplayerHUD.svelte`, or the Fastify server routes under `server/src/routes/`.

### Two-Container Methodology (not bots)

All MP E2E testing uses two real Docker containers connected via WebSocket. Bot players are deprecated and removed from the lobby UI. Bots do not participate in map node consensus barriers and cause encounter-start deadlocks. If you need to simulate a second player, boot a second container.

### Required Infrastructure Setup

Before running `/multiplayer-playtest`, ensure:

1. **Fastify server running** on port 3000 with `CORS_ORIGIN` set to include the Docker bridge origin:
   ```bash
   CORS_ORIGIN=http://host.docker.internal:5173 npx tsx server/src/index.ts
   ```
   Without `CORS_ORIGIN`, WebSocket upgrade handshakes fail silently (the WS connection is refused at the HTTP layer, not the application layer — no visible client error).

2. **Vite dev server running** on port 5173 with the MP env vars baked in:
   ```
   VITE_MP_API_URL=http://host.docker.internal:3000
   VITE_MP_WS_URL=ws://host.docker.internal:3000/mp/ws
   ```
   Docker containers reach the host machine via `host.docker.internal`, not `localhost`.

3. **Docker Desktop running** — warm container boot takes ~30s on first start.

### `--scenario none` for Multi-Step Action Batches

When an MP action batch navigates via WebSocket/lobby flow (not a scenario preset), start the initial action list with:
```json
{"type": "scenario", "preset": "none"}
```
This resets the game to a clean slate without loading a named preset. A `scenario` action in the middle of a batch overwrites any state set by preceding `navigate` or `eval` actions — so always put it first if you need it at all.

### Seed Verification Methodology

To verify that both players received the same run seed and are in sync, compare these three values across containers immediately after the race encounter starts:

1. **Enemy** — both players should see identical enemy name and max HP (e.g., "Eraser Worm 28/28")
2. **Hand** — both players should see identical cards in identical order (e.g., Strike, Block, Transmute, Strike, Block)
3. **Map** — both players should see the same node count (e.g., 25 nodes)

If any of these differ, the run seeds diverged — check the seed broadcast timing in `multiplayerGameService.ts`.

See `.claude/skills/multiplayer-playtest/SKILL.md` for full documentation.

## Inspection Registry

The registry at `data/inspection-registry.json` tracks 415+ game elements across 14 tables.

```bash
npm run registry:sync    # Rebuild after adding/removing game elements
npm run registry:stale   # Show stale or never-inspected elements
```

Skills that auto-stamp the registry after running: `/inspect`, `/visual-inspect`, `/ux-review`, `/balance-sim`, `/strategy-analysis`, `/rogue-brain`, `/llm-playtest`, `/quick-verify`, `/smart-test`.

Use `/inspect` as the master orchestrator — it fires all applicable methods in parallel.

### Deck Tracking + Agent Locks

The registry includes a `decks` table (~99 entries, one per `data/decks/*.json` file) with four quality-pipeline date fields that are automatically stamped when the corresponding tool completes successfully: `lastStructuralVerify`, `lastQuizAudit`, `lastLLMPlaytest`, and `lastTriviaBridge`.

Each registry element also carries an `inProgress` lock so parallel agents do not stomp on each other. Before touching any deck, check for a lock, acquire one, and use a shell `trap` to guarantee unlock on exit. Locks have a default TTL of 4 hours; abandoned locks are shown separately in `registry:stale` output and are safe to override.

**Full reference:** `docs/testing/inspection-registry.md` — covers field schemas, staleness thresholds, CLI reference (`registry:lock`, `registry:unlock`, `registry:check-lock`), and the canonical agent collaboration flow.

## Deck Structural Validation

Curated deck quality is verified at two levels:

**Per-deck** (during build): Inline validation script in `/deck-master` skill — run against the specific deck being built.

**Batch** (after any deck change):
```bash
node scripts/verify-all-decks.mjs           # All decks, summary table
node scripts/verify-all-decks.mjs --verbose  # Per-fact details on failures
```

Checks 22 quality dimensions across all 75 decks (53K+ facts): pool field naming, orphaned pool references, duplicate questions (excluding image-based), braces in questions (excluding fill-in-blank `{___}`), distractor collisions, missing fields, pool size minimums, em-dash in answers (FAIL), and answer-in-question self-answering (WARN).

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

### Two Modes — Both Required for Production Quality

The quiz-audit-engine runs in two complementary modes. **Running only one mode is insufficient.**

**Programmatic mode** (default): Runs automated checks against every fact. Catches structural and format issues: wrong distractor counts, length ratio violations, em-dash in answers, synonym violations, POS mismatches, template rendering failures, unresolved placeholders, empty answers, mastery count errors, confusion matrix responsiveness. Fast (~1000 facts/sec). Exits with code 1 on any FAIL.

**Render mode** (`--render`): Skips programmatic checks and outputs human-readable quiz samples — one question with 4 shuffled lettered answer options per fact. Designed for LLM content review. Catches what programmatic checks cannot: cross-domain distractors that are wrong but plausible-looking, factual errors in explanations, ambiguous questions with multiple defensible answers, length-tell situations, and context clues that let a student guess without domain knowledge.

**Both modes are required for production quality. Running only programmatic checks is insufficient — it misses cross-domain distractors, ambiguous questions, and factual errors that only a human or LLM can catch.**

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
| `--min-pool-facts <n>` | Minimum real factIds per non-bracket pool before WARN is raised (default: 5) |

**Render mode** (`--render`) skips all programmatic checks and outputs human-readable quiz samples suitable for LLM content review. Facts are sampled per pool using a reproducible seeded RNG. Each sample shows the question, shuffled lettered answer options (correct marked with checkmark), and a metadata line with mastery level, difficulty, and distractor sources.

| Render Option | Description |
|---------------|-------------|
| `--render` | Activate render mode (skips programmatic checks) |
| `--render-per-pool <n>` | Facts to sample per pool (default: 5) |
| `--deck <id>` | Limit to a single deck |
| `--include-vocab` | Include vocabulary/language decks |

```bash
# Render 5 samples per pool for one deck (LLM review)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/quiz-audit-engine.ts --render --deck solar_system

# Render 10 samples per pool across all knowledge decks
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/quiz-audit-engine.ts --render --render-per-pool 10
```

**27 quality checks** — 10 preserved from `quiz-audit.mjs` plus 17 engine-enabled checks (3 new in 2026-04-05):

| Check | Severity | Description |
|-------|----------|-------------|
| `answer_emdash` | FAIL | Answer contains em-dash (formatting error baked into answer text) |
| `answer_too_long` | FAIL/>100, WARN/>60 | Answer too long for comfortable in-game display |
| `distractor_count_low` | FAIL | Fewer than 2 distractors returned by engine |
| `length_ratio` | WARN/>3×, WARN/>2× | Answer length vs distractor length ratio — downgraded to WARN (see note below) |
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
| `question_type_mismatch` | WARN | Question keyword (who/when/where/how many) implies an answer type but ≥2 options don't match that format |
| `distractor_format_inconsistency` | WARN | Distractor has ≥2 format features different from correct answer (e.g., capitalization, units, multi-word) |
| `near_duplicate_options` | WARN | Two options in the same quiz are suspiciously similar (Levenshtein >80%, substring containment, or trailing-digit variant) |
| `min_pool_facts` (deck-level) | WARN | A non-bracket pool has fewer real factIds than `--min-pool-facts` (default: 5) |

Runs at ~1000 facts/sec. Exits with code 1 if any FAILs. Image facts (`quizMode: image_question` or `image_answers`) are always skipped.

**Note on `length_ratio` (2026-04-06):** The quiz-audit-engine reports 0 FAILs across all 34 knowledge decks as of 2026-04-06. All remaining issues are WARN-level (informational). The `length_mismatch` check was downgraded from FAIL to WARN because the real game engine's confusion-matrix scoring compensates for length variation — the audit's simulated distractor selection does not reflect actual in-game quiz quality. Short clinical codes ("T8") alongside long descriptions ("Posterior triangle of the neck") in the same pool are INTENTIONAL when the player has confused them; the confusion matrix overrides any length preference.

### Full Deck Quality Pipeline

For every new deck or major modification, run these steps in order:

1. `node scripts/verify-all-decks.mjs` — structural + content quality (0 failures required)
2. `node scripts/pool-homogeneity-analysis.mjs --deck <id>` — pool design check (0 FAILs required)
3. `npm run audit:quiz-engine -- --deck <id>` — programmatic engine audit (0 FAILs required)
4. `npm run audit:quiz-engine -- --render --deck <id>` — generate render output for LLM review
5. LLM agent reviews rendered quiz samples — flags semantic issues not caught by checks 1-3
6. Fix all flagged issues, re-run checks 1-3 to confirm clean

**Do not skip steps 4-5.** Passing all programmatic checks does not mean the deck plays well.

## Quiz Sample Dump (`audit-dump-samples.ts`)

The **quiz sample dump** (`scripts/audit-dump-samples.ts`) produces a JSONL file per deck at `data/audits/quiz-dumps/<deckId>.jsonl`. Each line is a fully rendered quiz question exactly as a player would see it — with shuffled answer options, correct index, distractor sources, and all fact metadata — rendered at mastery levels 0, 2, and 4.

**Purpose:** Feeds downstream LLM content quality audits. Unlike `quiz-audit-engine.ts --render` which prints human-readable text for manual review, this script emits structured JSONL for programmatic processing (automated quality scoring, batch LLM review, CI regression).

**Key behaviors:**
- Stratified sampling across pools — every non-empty pool gets at least 1 fact, remaining quota distributed proportionally
- Default sample: 30 facts per deck (auto-bumped to 60 for decks with 1000+ facts)
- Each sampled fact rendered at 3 mastery levels → 3 / 4 / 5 answer options respectively
- Reproducible: seeded by `djb2(deckId + seed)` — same seed = same output
- Image/chess/map facts emitted as passthrough rows with all special fields preserved
- Per-fact errors are logged to stderr and skipped — partial output is always written

```bash
# Single deck
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/audit-dump-samples.ts --deck solar_system

# All decks (writes one .jsonl file per deck)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/audit-dump-samples.ts

# All decks, skip vocab and image decks, custom output dir
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/audit-dump-samples.ts --exclude-vocab --exclude-image --out /tmp/quiz-dumps
```

**Options:**

| Option | Description |
|--------|-------------|
| `--deck <id>` | Single deck by ID (default: all decks) |
| `--exclude-vocab` | Skip vocab-classified decks (chinese_hsk, japanese_, korean_, french_, etc.) |
| `--exclude-image` | Skip image decks (world_flags and IMAGE_EXACT set) |
| `--sample <N>` | Override sample quota per deck (default: 30 or 60 for large decks) |
| `--out <dir>` | Output directory (default: `data/audits/quiz-dumps`) |
| `--seed <N>` | Master seed for reproducible sampling (default: 20260410) |

**Output schema** — each JSONL line:

```jsonc
{
  "deckId": "solar_system",
  "deckName": "Solar System",
  "factId": "solar_system_neptune_strongest_winds",
  "poolId": "planet_names",
  "subDeckName": "The Planets & the Sun",  // null if no subDecks
  "masteryLevel": 0,                        // 0, 2, or 4
  "requestedDistractorCount": 2,            // 2 (m=0), 3 (m=2), 4 (m=4)
  "templateId": "_fallback",
  "renderedQuestion": "Which planet has the strongest winds...",
  "correctAnswer": "Neptune",
  "options": ["Uranus", "Venus", "Neptune"],  // shuffled
  "correctIndex": 2,                           // options[correctIndex] === correctAnswer
  "distractorSources": ["similar_difficulty", "similar_difficulty"],
  "isNumerical": false,
  "difficulty": 3,
  "funScore": 9,
  "explanation": "...",
  "sourceName": "Wikipedia",
  "sourceUrl": "...",                          // optional
  "categoryL1": "space_astronomy",             // optional
  "categoryL2": "planets_moons",               // optional
  // Chess/map/image passthrough fields present when set on the fact:
  // fenPosition, solutionMoves, tacticTheme, lichessRating,
  // mapCoordinates, mapRegion, mapDifficultyTier,
  // sentenceFurigana, sentenceRomaji, sentenceTranslation, grammarPointLabel
}
```

**Read-only harness** — does NOT modify any deck JSON, `quiz-audit-engine.ts`, or `src/services/` files. Output directory `data/audits/quiz-dumps/` is gitignored (build artifact).

## Standard Verification Sequence

After any code change, run in order:

```bash
npm run typecheck    # TypeScript + Svelte type check
npm run build        # Production build (catches Vite/Rollup issues)
npx vitest run       # Unit tests (1900+)
```

For balance changes, also run the headless sim. For UI changes, also do a Playwright visual inspection. Never report a fix done without confirming the result.

## Structural Lint Checks

Two lint scripts prevent structural wiring failures from recurring (added 2026-04-11, BATCH-ULTRA meta-fix):

### Wiring Lint (`lint:wiring`)

```bash
npm run lint:wiring          # Full report
node scripts/lint/check-wiring.mjs
```

Detects **Cluster B "built but not wired" bugs** — features implemented but silently disconnected:

1. **Orphan screen components (ERROR):** Every `*Screen.svelte` in `src/ui/components/` must be imported by `CardApp.svelte` (directly or transitively). Catches `TriviaRoundScreen`, `RaceResultsScreen`, and `MapPinDrop` patterns.

2. **Stale TurnState field reads (ERROR):** Every `.ts` in `tests/playtest/headless/` is checked for `ts.fieldName` reads against the live `TurnState` interface. Catches `ts.comboCount` (removed, replaced by `ts.consecutiveCorrectThisEncounter`) and `ts.ascensionComboResetsOnTurnEnd` (set on TurnState but not in the interface).

3. **Phaser-only interactive buttons (WARN):** Heuristic check — `setInteractive()` calls near button-like strings in `src/game/scenes/*.ts` without a matching DOM `<button>` overlay. Suppress false positives with `// @wiring-check:skip reason: <why>`.

**Exit codes:** 0 = clean, 1 = errors (fix required), 2 = warnings only.

**Pre-commit:** Runs as soft-warn when `src/ui/components/`, `src/game/scenes/`, or `tests/playtest/headless/` files are staged.

### RNG Determinism Lint (`lint:rng`)

```bash
npm run lint:rng             # Full report
node scripts/lint/no-bare-math-random.mjs
```

Detects **Cluster D bare Math.random() calls** in gameplay code that cause co-op RNG desync.

- Scans all `src/**/*.ts` and `src/**/*.svelte` files
- Prints the allowlist on every run (cosmetic files, dev tools, seededRng.ts itself)
- Skips **guarded patterns** — `(rng ? rng.next() : Math.random())` and `isRunRngActive() ? getRunRng(...).next() : Math.random()` are the CORRECT seeded-with-fallback approach and are NOT violations
- Only flags truly bare calls with no seeded RNG check

**The correct fix:**
```typescript
// Before (bare — flags in co-op):
const isCrit = Math.random() < 0.25;

// After (guarded — passes lint):
const _rng = isRunRngActive() ? getRunRng('relicEffects') : null;
const isCrit = (_rng ? _rng.next() : Math.random()) < 0.25;
```

**Exit codes:** 0 = no violations, 1 = violations found.

**Pre-commit:** Runs as soft-warn when any `src/**/*.ts` or `src/**/*.svelte` files are staged. Currently ~168 pre-existing violations exist (migration target). Promote files to clean by applying the guarded pattern or adding to ALLOWLIST_GLOBS.

### Deck Schema Drift Lint (`lint:deck-schema-drift`)

```bash
npm run lint:deck-schema-drift   # Full report
node scripts/lint/check-deck-schema-drift.mjs
```

Detects **interface/schema drift** between `src/data/curatedDeckTypes.ts` (TypeScript interfaces) and `src/data/curatedDeckSchema.ts` (Zod schemas).

Checked pairs:
- `DeckFact` ↔ `DeckFactSchema` (40 fields)
- `AnswerTypePool` ↔ `AnswerTypePoolSchema` (6 fields)
- `SynonymGroup` ↔ `SynonymGroupSchema` (3 fields)

Four failure modes detected:

1. **Missing in schema (FAIL):** Field exists in the TypeScript interface but not in the `z.object({})` block. The field will silently bypass Zod validation — a type mismatch in that field is invisible at runtime.

2. **Extra in schema (FAIL):** Field exists in the Zod schema but not the interface. Usually means the interface field was renamed but the schema was not updated.

3. **Required-in-interface, optional-in-schema (FAIL):** The interface promises the field is always present, but the schema allows it to be absent. Zod passes rows missing the field — the runtime receives `undefined` where a value is guaranteed.

4. **Optional-in-interface, required-in-schema (FAIL):** The interface says the field may be absent, but the schema rejects rows that omit it. Silent data loss at decode time.

A field with `.default(...)` in the schema is treated as optional (Zod supplies the default if the field is absent).

**Also runs under `npm run check`** — wired into the full type-check pipeline.

**Parser:** Regex-based, handles optional fields (`field?:`), JSDoc comments, and nested `z.object()` / `z.array()` blocks without polluting top-level key extraction. Full value expressions (including multi-line) are captured for optionality detection. Sub-second on these files.

**Test coverage:** `scripts/lint/check-deck-schema-drift.test.mjs` — 14 cases (Node built-in test runner): 7 original field-name cases + 7 new optionality cases.

**Fix:** When this lint fails, align the flagged field(s) in `src/data/curatedDeckSchema.ts` or `src/data/curatedDeckTypes.ts` — add missing fields, remove extras, or reconcile `?` / `.optional()` markers.

**Context:** Added 2026-04-11 after `06097f1c7` introduced Zod schemas with no automated sync check. Optionality check added 2026-04-11 (commit extends the lint). See `docs/gotchas.md` "2026-04-11 — Deck schema drift lint extended: required/optional alignment check".

### Resolver Hardcode Lint (`lint:resolver`)

```bash
npm run lint:resolver          # Full report
node scripts/lint/check-resolver-hardcodes.mjs
```

Detects **four-source rule violations** in `src/services/cardEffectResolver.ts` — numeric literals used as effect-quantity values (damage, heal, block, AP, status stacks) inside `case '<mechanicId>':` blocks of `resolveCardEffect`.

**The four-source rule:** every effect-quantity value must come from one of:
1. `stats?.extras?.['field']` — mastery stat table (the canonical source)
2. `mechanic?.quickPlayValue` / `mechanic?.secondaryValue` — mechanic definition fallback
3. `finalValue` / `mechanicBaseValue` — pipeline-computed value (already scales with mastery)
4. An `UPPERCASE_CONSTANT` imported from `src/data/balance.ts`

Hardcoded literals (e.g. `result.healApplied = 6`) cause card-description drift: when stat tables are updated, the description changes but the resolver doesn't (or vice versa). This was identified as Severity-A in the 2026-04-11 card-description audit; 11 mechanics were affected.

**Allowlisted (never flagged):**
- `value: 1` for boolean-like status stacks (Vulnerable, Weakness are always 1 stack = on/off)
- Literals that appear as digits within a `hasTag('...')` call in the surrounding 6-line context (tag-name-encoded values, e.g. `sap_strip3block` encodes `3`)
- Fallbacks immediately after `mechanic?.` or `stats?.` (e.g. `mechanic?.secondaryValue ?? 3`)
- Scheduling fields: `turnsRemaining`, `turns`, `extraCardsDrawn`, `pickCount`, etc.
- Comparison operands: `>= 3`, `< 0.3`, `=== 0`
- `Math.*` arguments
- Lines with `// lint-allow: resolver-hardcode — <reason>` comment

**Exit codes:** 0 = clean, 1 = violations.

**NOT wired into pre-commit** — run standalone after resolver edits. To make it blocking, add `node scripts/lint/check-resolver-hardcodes.mjs` to `.claude/hooks/pre-commit-verify.sh`.

**Context:** Added 2026-04-11 as the preventative side of two-sided enforcement for the four-source rule. See `docs/gotchas.md` 2026-04-11 "card-description-audit Severity-A hardcodes" and `.claude/rules/agent-mindset.md` two-sided enforcement table.
