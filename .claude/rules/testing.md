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

## Visual Testing
- Use `/visual-inspect` or `/quick-verify` skills
- Chrome lock: acquire before ANY Chrome tool call (see CLAUDE.md protocol)
- ALWAYS use `__rrScreenshotFile()` + `__rrLayoutDump()` — NEVER `mcp__playwright__browser_take_screenshot` (Phaser RAF blocks it)
- ALWAYS use `__rrScenario.load()` to jump to game states — NEVER click through menus manually
- Playwright WebGL: ALWAYS use `channel: 'chrome'` — bundled Chromium has no WebGL on macOS ARM64

## Inspection Registry
- `npm run registry:sync` — rebuild from source after adding/removing game elements
- `npm run registry:stale` — see what needs testing
- Testing skills auto-stamp dates after completing
