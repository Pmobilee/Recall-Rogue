# Testing Rules

## Unit Tests
- Every card mechanic effect gets a unit test
- Use Vitest: `npx vitest run` (1900+ tests)
- Single test: `npx vitest run src/path/to/test.ts`
- Test files live next to source: `chainSystem.ts` → `chainSystem.test.ts`
- Mock Phaser in unit tests, don't import Phaser in service logic
- ALWAYS run after logic/data changes — typecheck alone is NOT enough

## Build Verification
- `npm run typecheck` — TypeScript/Svelte type checking
- `npm run build` — Production build (check Vite warnings)
- Both must pass before committing

## Agent Scope — Build Failure Ownership

### Worktree agents (parallel dispatch with `isolation: "worktree"`)
Worktree agents have a clean, isolated tree. **They own the full build.** Run full `npm run typecheck`, `npm run build`, and relevant tests. All failures in a worktree are yours — there are no other agents editing your tree.

### Shared-main agents (sequential dispatch, no worktree)
When working directly on `main` during single-agent sequential dispatch, you also own the full build.

### Shared-main agents during parallel work (rare, legacy)
If for any reason multiple agents are editing shared `main` without worktrees, each agent MUST IGNORE build / typecheck / test failures outside its own files. Fix only your own breakage.

- Grep the error list for your file paths only
- Do NOT install missing deps, delete unrelated broken code, or fix others' tests
- If unrelated breakage blocks your verification, say so in ONE sentence and stop

## Pre-Commit Mode in Worktrees vs Shared Main

**Worktree agents:** Pre-commit hooks detect they are in a worktree (toplevel differs from main checkout) and run all checks in full blocking mode. The tree is isolated — no spurious failures from concurrent edits.

**Shared `main` with `RR_MULTI_AGENT=1`:** If for any reason multiple agents edit shared `main` without worktrees, set `RR_MULTI_AGENT=1` to soft-warn on typecheck / build / vitest failures. Deck verification, skill drift, and Docker visual verify still hard-block. A soft-warn is NOT a license to ignore — re-run in single-agent mode to confirm.

With the hybrid worktree policy, parallel agents should always be in worktrees, making the shared-main soft-warn path a rare fallback.

## Balance Testing
- Headless simulator is DEFAULT for balance: imports real game code, zero drift
- All profiles: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000`
- Single profile: add `--profile scholar`
- With ascension: add `--ascension 10`
- Relic audit: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/relic-audit.ts`
- Browser bots are for VISUAL TESTING ONLY — 1000x slower, never for balance data

## Docker Visual Verification — MANDATORY AFTER EVERY CHANGE

**Every code change MUST be visually verified via Docker before committing. No exceptions. No user prompting required — this is a silent, automatic step.**

**OBSESSIVE OUTPUT VERIFICATION — after ANY batch operation, sub-agent result, or content edit:**
- Sample at least 5-10 items from the output and READ them back
- Grep for known broken patterns (e.g., "the this", "a this", broken grammar)
- Validate data integrity (no duplicates, no corruption, no missing fields)
- NEVER trust sub-agent output without sampling — they produce broken output ~15-20% of the time
- This is not optional. Skipping verification is how 262 broken grammar rewrites shipped.

```bash
# Warm mode (preferred for multi-item batches):
scripts/docker-visual-test.sh --warm start --agent-id <task-id>
scripts/docker-visual-test.sh --warm test --agent-id <task-id> --scenario <preset>
scripts/docker-visual-test.sh --warm stop --agent-id <task-id>

# Cold mode (one-shot):
scripts/docker-visual-test.sh --scenario <preset> --agent-id <task-id>
```

**Rules:**
- ALWAYS use `__rrScreenshotFile()` + `__rrLayoutDump()` — NEVER `mcp__playwright__browser_take_screenshot` (Phaser RAF blocks it)
- ALWAYS use `__rrScenario.load()` to jump to game states — NEVER click through menus manually
- ALWAYS capture BOTH screenshot AND layout dump — one without the other is incomplete
- ALWAYS reference `/tmp/rr-docker-visual/...` artifact paths in commit messages
- **ALWAYS read `screenshot.png` (the full 1920×1080 PNG) as the source of truth** — never diagnose from `rr-screenshot.jpg` alone (it's a downscaled thumbnail that can make landscape look portrait and hide details). Cross-check the PNG before making any visual claim. See `docs/gotchas.md` 2026-04-09 "Visual playtest false positives" for a full case study.
- **Layout dump is NOT ground truth.** `getBoundingClientRect` returns mid-animation transforms (a deal-animated card reports 12×17 px during its scale transition). Docker runners now inject a global `transition-duration: 0s !important` stylesheet to prevent this, but the rule stands: if the layout dump says something is broken and the PNG looks fine, the PNG wins.
- **"HIDDEN" flags in layout dump are NOT bugs without PNG confirmation.** The dump flags many transformed/clipped elements as HIDDEN even when they render normally (`card-app`, `topbar`, `enemy-name-header`, `btn-end-turn`, `card-combat-overlay`, etc.).
- **Minimum `--wait` for combat/map/shop scenarios is 5000ms.** 3–4 s captures show black scenes and stale HP values that look like bugs but are just init-timing artifacts. If a scene looks black/empty, recapture with 7–8 s before reporting anything.
- **Reality-check against the user.** If your capture shows something "broken" that the user (who plays the game daily) hasn't mentioned, the bug is almost always in your capture methodology, not the game. Ask before writing a long report.
- Docker containers use system Chromium + SwiftShader — full WebGL 2.0, no GPU needed
- Chrome-lock only needed for `claude-in-chrome` MCP tools (shared browser session)
- Native Playwright: use `channel: 'chrome'` — bundled Chromium has no WebGL on macOS ARM64
- Use `/visual-inspect` or `/quick-verify` skills for orchestrated verification
- **Parallel agents: use Docker containers** — `scripts/docker-visual-test.sh` — no chrome-lock needed
  - Cold mode: `--scenario X --agent-id Y` (~54s, fully isolated)
  - Warm mode: `--warm start`, then `--warm test --scenario X` (~5s per test after boot)

## Docker-Only LLM Playtests — MANDATORY, NO EXCEPTIONS

**All LLM-driven playtests MUST run inside a Docker warm container via `scripts/docker-visual-test.sh --warm`. Local `npm run dev` + Playwright MCP is PROHIBITED for playtest sessions.**

This applies to:
- `/llm-playtest` (all testers: quiz, balance, fun, study, fullrun)
- `/scenario-playtest` (all scenarios)
- `/bot-playtest`
- `/inspect`'s live-play leg
- Any ad-hoc LLM-driving-the-browser workflow where an agent interacts with `window.__rrPlay`, `__rrScenario`, or reads game UI

**Rationale:**
- Reproducible WebGL via system Chromium + SwiftShader — no host GPU dependency
- No host dev-server dependency — container boots its own Vite inside
- Parallel-safe `--agent-id` scoping — no chrome-lock contention
- Consistent artifact paths under `/tmp/rr-docker-visual/<agent-id>_*`
- Audit trail: every action batch writes a `result.json` the orchestrator can inspect

**Allowed workflow (orchestrator + sub-agent must follow this exact shape):**
```bash
# 1. Start persistent container (once per session)
scripts/docker-visual-test.sh --warm start --agent-id <session-id>

# 2. Run N action batches — each batch is a JSON actions-file with
#    rrPlay / eval / scenario / screenshot / rrScreenshot / layoutDump / wait
scripts/docker-visual-test.sh --warm test --agent-id <session-id> --actions-file /tmp/rr-actions-<step>.json
# Read the returned result.json + screenshots, decide next batch, repeat

# 3. UNCONDITIONALLY stop the container — try/finally shape, even on crash
scripts/docker-visual-test.sh --warm stop --agent-id <session-id>
```

**Forbidden in playtest contexts:**
- ❌ `mcp__playwright__browser_navigate` / `browser_evaluate` / `browser_click` against `http://localhost:5173`
- ❌ Starting `npm run dev` as a playtest prerequisite
- ❌ Running a tester sub-agent without first starting a warm Docker container
- ❌ Leaving a warm container running after a playtest completes (container leak)

**Enforcement:** Every playtest skill (`/llm-playtest`, `/scenario-playtest`, `/bot-playtest`, `/inspect`) MUST carry a top-of-file banner referencing this rule. Sub-agent prompts spawned by these skills MUST include "NEVER call `mcp__playwright__*`. The ONLY browser access is `scripts/docker-visual-test.sh --warm test --actions-file`." as a hard constraint.

**What to verify per change type:**
- UI/layout changes → screenshot the affected screen at 1920x1080
- Mechanic/data changes → screenshot the game state where the change is observable
- Content/deck changes → load a relevant deck scenario and verify rendering
- Schema/DB changes → load a scenario that reads the changed data and verify it displays correctly

**"It's just a data change" is NOT an excuse to skip.** The Ch9 category schema fix was "just data" but affected every card's displayed category in combat.

## Inspection Registry
- `npm run registry:sync` — rebuild from source after adding/removing game elements
- `npm run registry:stale` — see what needs testing
- Testing skills auto-stamp dates after completing

## Deck Content Testing
- Structural: `node scripts/verify-all-decks.mjs` — 19 checks, 0 failures required
- In-game audit: 20+ random facts displayed as quiz (Q + 4 options) — catches distractor quality issues the structural verifier misses
- See `.claude/rules/content-pipeline.md` "In-Game Quiz Audit" for full protocol

## Registry Stamping — Opt-In Only (added 2026-04-10)

**Running `verify-all-decks.mjs`, `quiz-audit.mjs`, or `extract-trivia-from-decks.mjs` does NOT automatically stamp `data/inspection-registry.json`.** This was previously a silent side effect that caused three reset rounds in one session.

To mark decks as verified in the registry, explicitly pass `--stamp-registry`:
```
node scripts/verify-all-decks.mjs --stamp-registry
node scripts/quiz-audit.mjs --deck <id> --stamp-registry
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs --stamp-registry
```

Agents running verification in a CI/iteration loop (no intent to stamp) should OMIT the flag.
Agents that genuinely want to update registry truth after a verified pass should INCLUDE the flag.
