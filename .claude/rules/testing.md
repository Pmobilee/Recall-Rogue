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
