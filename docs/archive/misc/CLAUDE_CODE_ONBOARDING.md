# Claude Code Agent — Performance Improvement Plan

This document captures diagnosed problems and recommended fixes for how the Claude Code agent
builds, tests, and verifies Terra Miner. Implement in priority order.

---

## Root Cause: "Says it's fixed but it's broken"

The agent feedback loop is broken in three ways:
1. Visual verification only captures static screenshots — no console errors, no runtime JS state
2. Every Playwright test must navigate 5–6 onboarding screens before reaching gameplay
3. Large files (3,693/2,880/1,960 lines) exhaust agent context windows, causing incomplete edits
4. MEMORY.md truncates at 200 lines, silently dropping recent session context every restart

---


personal note, ive installed the connector for google chrome for you so you can use that for debugging, youre the only one to use that browser!

## Priority 1 — Diagnostic Playwright Library

**Effort**: 1 hour | **Impact**: Closes "says fixed but broken" gap

Create `tests/e2e/lib/diagnostics.js` — a shared helper required by all E2E scripts:

```js
module.exports = function attachDiagnostics(page) {
  const d = { errors: [], warnings: [], networkFailed: [], pageErrors: [] }
  page.on('console', m => {
    if (m.type() === 'error') d.errors.push(m.text())
    if (m.type() === 'warning') d.warnings.push(m.text())
  })
  page.on('pageerror', e => d.pageErrors.push(e.message))
  page.on('requestfailed', r => d.networkFailed.push(r.url()))
  return {
    report: async () => {
      const js = await page.evaluate(() => ({
        currentScreen: (() => {
          const sym = Symbol.for('terra:currentScreen')
          let v; const s = globalThis[sym]; if (s) s.subscribe(x => { v = x })(); return v
        })(),
        phaserCanvas: !!document.querySelector('canvas'),
        canvasDimensions: (() => { const c = document.querySelector('canvas'); return c ? `${c.width}x${c.height}` : null })(),
        hasSave: !!localStorage.getItem('recall-rogue-save'),
        ageBracket: localStorage.getItem('terra_age_bracket'),
        isGuest: localStorage.getItem('terra_guest_mode'),
      }))
      return { ...d, js }
    }
  }
}
```

**Also update**:
- `tests/e2e/01-app-loads.js`, `02-mine-quiz-flow.js`, `03-save-resume.js` to use it
- `CLAUDE.md` Playwright template section — replace screenshot-only template with diagnostic-first template
- `memory/playwright-workflow.md` — add "Fast Diagnostic Template" section

---

## Priority 2 — Fix MEMORY.md Truncation

**Effort**: 30 min | **Impact**: Stops silent context loss every session

MEMORY.md is 218 lines but truncates at 200. Fix:
- Move all per-phase completion summaries (Phases 27, 29, 35, 36, 37, 38, 42, 48, 49) to `memory/phase-history.md`
- Replace with single 2-line index entry in MEMORY.md
- Target: MEMORY.md under 160 lines

Add mandatory session start block at top of MEMORY.md:
```markdown
## MANDATORY SESSION START
1. Read MEMORY.md (this file)
2. Read docs/roadmap/PROGRESS.md
3. Read memory/testing-workflow.md for Playwright patterns
4. Screenshot current state before any work
```

Create `memory/testing-workflow.md` consolidating all Playwright patterns, dev bypass URL params, and diagnostic library usage.

---

## Priority 3 — Dev URL Bypass for Onboarding

**Effort**: 1 hour | **Impact**: 5× faster targeted testing

Add URL param handling in `src/App.svelte` (script section, early `$effect`), guarded by `import.meta.env.DEV`:

```typescript
// DEV BYPASS — stripped in production builds (import.meta.env.DEV is false in prod)
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search)
  if (params.get('skipOnboarding') === 'true') {
    if (!localStorage.getItem(AGE_BRACKET_KEY)) localStorage.setItem(AGE_BRACKET_KEY, 'teen')
    localStorage.setItem('terra_guest_mode', 'true')
  }
  const presetId = params.get('devpreset')
  if (presetId) {
    // Dynamic import to avoid bundling dev code in prod
    const { SCENARIO_PRESETS } = await import('./dev/presets')
    const preset = SCENARIO_PRESETS.find(p => p.id === presetId)
    if (preset) {
      const builtSave = preset.buildSave(Date.now())
      SaveManager.save(builtSave)
      playerSave.set(builtSave)
      currentScreen.set('base')
    }
  }
}
```

Add `?screen=<screenName>` direct navigation in `src/main.ts` after `bootGame()`, following existing `?action=dive` pattern (line ~196).

**Usage in Playwright**:
```js
// Skip all 5-6 onboarding screens, load post-tutorial preset directly
await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial')
await page.waitForTimeout(2000)
// Now on 'base' screen — no age gate, no profile, no auth, no cutscene
```

**Files affected**: `src/App.svelte`, `src/main.ts`, `tests/e2e/*.js`

---

## Priority 4 — Hooks in settings.json

**Effort**: 15 min | **Impact**: Automated screenshot reminder before ending sessions

Add to `/root/.claude/settings.json`:

```json
{
  "permissions": { "allow": ["*"], "defaultMode": "bypassPermissions" },
  "env": { "IS_SANDBOX": "1" },
  "additionalDirectories": ["/tmp"],
  "hooks": {
    "Stop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "echo 'REMINDER: Run a diagnostic Playwright script to verify visual + runtime state before ending session.' >&2"
      }]
    }]
  }
}
```

---

## Priority 5 — data-testid Attributes for Stable E2E Tests

**Effort**: 45 min | **Impact**: E2E scripts stop breaking when copy changes

| File | Element | data-testid |
|---|---|---|
| App.svelte main menu | Dive button | `btn-dive` |
| DivePrepScreen.svelte | Enter Mine button | `btn-enter-mine` |
| HUD.svelte | Surface button | `btn-surface` |
| QuizOverlay.svelte | Answer buttons | `quiz-answer-0` → `quiz-answer-3` |
| AgeGate.svelte | 18+ button | `btn-age-adult` |
| HUD.svelte | O2 bar | `hud-o2-bar` |

Update E2E scripts to use `[data-testid="btn-dive"]` instead of `button:has-text("Dive")`.

---

## Priority 6 — File Splitting (MineGenerator → MineScene → GameManager)

**Effort**: 6–7 hours total | **Impact**: Reliable LLM editing of split ~500-line files

The three largest files consume 30–40% of a sub-agent's context window before instructions are read.

### Safe Strategy: Extract → Re-export → Update imports later

```typescript
// MineGenerator.ts (after extraction — becomes a barrel)
export { seededRandom, getHardness, pickRarity } from './MineGeneratorUtils'
export { stampFeature } from './MineRoomStamper'
// Callers don't change. Run typecheck after each extraction.
```

### MineGenerator.ts (2,880 lines) → 4 files

| New file | Content | ~Lines |
|---|---|---|
| `MineGeneratorUtils.ts` | `seededRandom`, `getHardness`, `pickRarity`, `randomIntInclusive`, `revealAround`, `blendBiomeWeights` | 200 |
| `MineRoomStamper.ts` | `stampFeature()` + all stamp functions | 1,400 |
| `MinePlacementPasses.ts` | All `place*()` functions | 900 |
| `MineGenerator.ts` | `generateMine()`, `generateTutorialMine()`, `buildDifficultyProfile()`, barrel re-exports | 400 |

**Safety net**: `tests/seed-determinism.test.ts` (42 tests) — run after each extraction.

### MineScene.ts (3,693 lines) → 5 files

| New file | Content |
|---|---|
| `MineScene.ts` | Lifecycle, 40+ private fields, GM integration methods |
| `MineTileRenderer.ts` | Tile drawing, autotile, fog rendering |
| `MineInputController.ts` | Player movement, keyboard/touch input |
| `MineBlockInteractor.ts` | Block mining outcomes, hazards, drill, bombs |
| Merge → existing `MineFogSystem.ts` | Fog-of-war, BFS reveal |

### GameManager.ts (1,960 lines) → 3 files

| New file | Content |
|---|---|
| `GameManager.ts` | Boot, event bus wiring, sub-manager coordination |
| `DiveSessionManager.ts` | `startDive`, `handleSurface`, `endDive`, loot calculation |
| `GameEventHandlers.ts` | Large event listener block from `boot()`, mine event wiring |

**Add size budget comments to prevent re-growth**:
```typescript
/** SIZE BUDGET: Orchestrator — stay below 600 lines. Extract new behavior to src/game/systems/ */
```

---

## Priority 7 — Claude Code CLI vs Extension

**Verdict**: Low priority now. Revisit after other improvements are in place.

The extension and CLI run the same underlying model. Both support hooks. The Playwright MCP
sandbox restriction (`IS_SANDBOX=1`) affects both modes identically.

If migrated to CLI:
- Use `claude --dangerously-skip-permissions` to match current `bypassPermissions` behavior
- All `.claude/settings.json` hooks work unchanged
- Gain: better compaction visibility, `--max-turns` control, terminal-first workflow
- Lose: IDE file history sidebar, inline diff review

---

## Verification

### After diagnostic library:
```bash
node tests/e2e/01-app-loads.js
# Output should include diagnostics object with empty error arrays
```

### After dev bypass:
```js
await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial')
await page.waitForTimeout(2000)
const report = await diagnostics.report()
// Expect: report.js.currentScreen === 'base', report.errors.length === 0
```

### After file splitting:
```bash
npm run typecheck          # 0 errors
npx vitest run tests/seed-determinism.test.ts  # 42/42 pass
npm run build              # success
```

---

## Anti-Patterns to Eliminate

1. **Screenshot without console capture** — A visually-fine screenshot can hide a silent Phaser
   scene error or missing texture key. Always use the diagnostic template.

2. **TypeCheck-only verification** — TypeScript verifies types, not runtime behavior. Always run
   a Playwright diagnostic script after any Phaser or store change.

3. **Editing a 3,000-line file whole** — Split files first; then target the resulting 500-line
   files with sub-agent tasks.

4. **Phase documents that say "follow existing patterns"** without specifying file path and code
   snippet — Sub-agents cannot infer. Every spec must be self-contained.
