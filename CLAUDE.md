# Recall Rogue — Agent Context

A 2D card roguelite knowledge game built with Vite + Svelte + TypeScript + Phaser 3, targeting mobile via Capacitor.

## Task Management Rule — MANDATORY

**USE CLAUDE CLI TASKS (TaskCreate, TaskUpdate, TaskList) FOR EVERYTHING.**

Unless the request is a simple couple-line fix or a quick question, you MUST:
1. Break work into tasks with TaskCreate BEFORE starting
2. Set tasks to `in_progress` when you begin each one
3. Set tasks to `completed` when done
4. Use TaskList to track progress throughout

This is non-negotiable. Tasks keep work organized, prevent drift, and make it possible to recover if context is lost. Be obsessive about it.

## Project Summary
- **Concept**: Card roguelite where every card is a fact. Players answer questions to activate cards in turn-based combat, build knowledge-powered decks, and delve deeper into procedurally generated dungeon floors. Learning IS the core mechanic — powered by SM-2 spaced repetition.
- **Tech Stack**: Vite 7, Svelte 5, TypeScript 5.9, Phaser 3, Capacitor (Android/iOS)
- **Sprite Generation**: ComfyUI with SDXL + pixel art LoRA, running locally on RTX 3060 12GB
- **Backend**: Fastify + TypeScript (planned), containerized for portable hosting
- **Data**: Quiz facts served via API, cached locally for offline play

## Playtest Dashboard
- Start command (repo root): `npm run playtest:dashboard`
- URL: `http://localhost:5175/playtest`
- Backing data: `data/playtests/leaderboard.json`, `data/playtests/logs/`, `data/playtests/reports/`
- API: `/api/playtest/leaderboard`, `/api/playtest/logs`, `/api/playtest/reports`
- Details: `docs/PLAYTEST-DASHBOARD.md`
- Investigation flow: leaderboard entry -> `runBreakdown` context -> `/api/playtest/report/:id` -> `/api/playtest/log/:id`

## Headless Balance Simulation — DEFAULT

**For ALL balance testing, use the headless simulator.** It imports real game code (turnManager, cardEffectResolver, relicEffectResolver, enemies, balance.ts) directly into Node.js. Zero reimplementation, zero drift. 6,000 runs in 5 seconds.

**Quick commands:**
- All profiles, 1000 runs each: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000`
- Single profile: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --profile scholar`
- With ascension: add `--ascension 10`
- Relic audit: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/relic-audit.ts`

**Key files:** `tests/playtest/headless/simulator.ts` (engine), `tests/playtest/headless/run-batch.ts` (batch runner), `tests/playtest/headless/browser-shim.ts` (Node.js shim)

**Browser bots (`tests/playtest/playwright-bot/`) are for VISUAL TESTING ONLY** — verifying UI flows, Phaser rendering, screen transitions. They are 1000x slower and must NOT be used for balance data.

## Directory Structure
```
src/game/          — Phaser scenes, entities, game systems
src/ui/            — Svelte components (card hand, combat UI, menus)
src/services/      — Quiz engine, SM-2 scheduler, API client, caching
src/data/          — TypeScript types, schemas, fact database, enemy definitions
src/assets/        — Sprites, card art, audio, UI graphics
src/_archived/       — Archived deprecated components (not compiled)
docs/              — Project documentation (LLM-optimized)
docs/RESEARCH/     — Design specs and research (source of truth for game design)
public/assets/cardframes/v2/ — V2 layered card frame assets (14 WebP files: 1 base + 6 borders + 6 banners + 1 upgrade icon, plus lowres variants)
scripts/extract-card-frame.py — PSD extraction + black-preserving hue-shift pipeline for V2 card frames
```

## Key Conventions
- All code in TypeScript with strict mode
- Svelte components use `.svelte` extension, PascalCase filenames
- Game entities use composition over inheritance
- File naming: kebab-case for utilities, PascalCase for components/classes
- All public functions must have JSDoc comments
- Pixel art assets: PNG format, transparent backgrounds, power-of-2 dimensions

## Dynamic Scaling Rule — MANDATORY

**ZERO hardcoded px values for layout, sizing, spacing, or fonts.** This is non-negotiable. The game must scale seamlessly from 720p to 1440p+ without any element appearing too small or too large.

### CSS Variable System
- **Layout values** (padding, margin, gap, width, height, border-width): Use `calc(Npx * var(--layout-scale, 1))`
- **Font sizes**: Use `calc(Npx * var(--text-scale, 1))`
- **Both variables** default to 1 and are set dynamically by `CardApp.svelte` based on viewport size

### What This Means in Practice
- `padding: 12px` is WRONG — use `padding: calc(12px * var(--layout-scale, 1))`
- `font-size: 14px` is WRONG — use `font-size: calc(14px * var(--text-scale, 1))`
- `width: 100px` is WRONG — use `width: calc(100px * var(--layout-scale, 1))`
- `min-height: 48px` is WRONG — use `min-height: calc(48px * var(--layout-scale, 1))`
- Values already using `%`, `vw`, `vh`, `rem`, `clamp()`, or `var()` are fine

### Exceptions (OK to hardcode)
- `border-radius: 50%` (percentages are fine)
- `opacity`, `z-index`, `flex` values (unitless)
- `0` values (`margin: 0`, `padding: 0`)
- `1px` borders (too thin to scale meaningfully)
- `inset: 0` (shorthand for position)
- Phaser/canvas pixel coordinates (handled by Phaser's own scaling)

### Enforcement
- Every sub-agent working on UI/CSS MUST be told this rule
- The orchestrator MUST verify no hardcoded px values in any PR touching UI
- Violations are treated as bugs with the same priority as broken tests

## Security Rules — MANDATORY
- NEVER use `eval()`, `Function()`, or `innerHTML` with dynamic content
- NEVER commit `.env` files, API keys, tokens, or credentials
- NEVER disable Content Security Policy headers
- ALWAYS sanitize user input before rendering or storing
- ALWAYS use parameterized queries for any database operations
- ALWAYS validate API responses against expected schemas
- Keep dependencies minimal; audit before adding new packages
- NEVER import or call `@anthropic-ai/sdk` or any paid LLM API — use Claude Code Agent tool for all LLM work

### CRITICAL: Distractor Generation Security Rule

**NEVER generate distractors from database pools.** Distractors must NEVER be pulled from `correct_answer` values of other facts in the same domain/subcategory. This produces semantically nonsensical garbage and is a SECURITY/QUALITY issue that compromises educational integrity.

ALL distractors MUST be generated by an LLM (GPT-5.2+ or Haiku agent) that reads the specific question and produces plausible wrong answers. The ONLY permitted DB usage is POST-GENERATION VALIDATION. Scripts like `mine-distractors.mjs` are PERMANENTLY BANNED.

## Fact Generation Sourcing — ABSOLUTE RULE — NEVER VIOLATE

### 🚨🚨🚨 NEVER GENERATE FACTS FROM LLM KNOWLEDGE 🚨🚨🚨

**This is the single most important content pipeline rule. Violating it wastes ALL work.**

**EVERY fact-generation worker MUST receive verified source data IN ITS PROMPT.** The worker does NOT research, does NOT use its training knowledge for factual claims, and does NOT invent data. The worker's ONLY job is to FORMAT pre-verified data into the DeckFact JSON structure.

### What "verified source data" means:
- Dates, numbers, names, and claims that have been **looked up and confirmed** against Wikipedia, Wikidata, or other authoritative sources BEFORE being given to the worker
- The architecture YAML (`data/deck-architectures/*.yaml`) must contain this verified data
- The orchestrator or a research agent must verify data BEFORE passing it to fact-writing workers

### The correct workflow:
1. **Research phase**: Orchestrator or Explore agent looks up facts from Wikipedia/Wikidata, verifies dates, numbers, names, casualty figures
2. **Architecture phase**: Verified data is written into the architecture YAML with source URLs
3. **Generation phase**: Workers receive the verified data and format it into DeckFact JSON. Workers copy facts FROM the source data, they do NOT generate facts from their own knowledge
4. **QA phase**: Every fact is reviewed against the original sources

### What workers MUST receive in their prompt:
- The exact verified data (dates, numbers, names, claims)
- Source URLs for each data point
- The DeckFact JSON template
- Instructions to FORMAT the data, not to INVENT content

### What workers MUST NEVER do:
- Generate dates from training knowledge ("Pearl Harbor was December 7, 1941" — even if correct, must come from verified source data)
- Generate casualty figures from memory ("6 million Jews" — must be verified and sourced)
- Generate explanations with unverified claims
- Put Wikipedia URLs in sourceUrl without having actually verified against that page
- Generate distractors that might accidentally be correct (must be checked against source data)

### Why this matters:
- LLMs confidently produce wrong dates, wrong numbers, wrong attributions
- A QA pass by another LLM has the SAME blind spots
- Fake sourceUrls that weren't actually consulted are worse than no sources — they create false confidence
- One wrong fact in a 1000-fact deck undermines educational trust in the entire product

### Enforcement:
- The orchestrator MUST verify that source data exists in the architecture YAML before spawning fact-generation workers
- Any worker prompt that says "generate facts about X" without providing verified source data is BANNED
- If a worker needs to look something up, it must use WebSearch/WebFetch tools and cite what it found — never its training data
- This rule applies to ALL content: facts, distractors, explanations, variants, alternative answers

## Agent Architecture (Claude Code)
- **Orchestrator**: Claude Opus 4.6 — planning, analysis, coordination, verification
- **Coding workers**: Sonnet 4.5 sub-agents via Agent tool (`model: "sonnet"`) — all code edits, new files, refactoring
- **Quick tasks**: Haiku 4.5 sub-agents via Agent tool (`model: "haiku"`) — simple/mechanical changes, formatting, boilerplate
- **Exploration**: Explore-type sub-agents (`subagent_type: "Explore"`) — codebase search, file discovery, code understanding

### ABSOLUTE RULE: No Anthropic API
- We do NOT have an Anthropic API key or budget. The Claude Code subscription is the ONLY LLM access.
- NEVER write scripts that import `@anthropic-ai/sdk`, call the Anthropic Messages API, or use any external LLM API.
- ALL LLM processing (fact generation, rewriting, quality assessment, content transformation) MUST be done by spawning Haiku sub-agents via the Claude Code Agent tool (`model: "haiku"`).
- The `haiku-client.mjs` file's `LOCAL_PAID_GENERATION_DISABLED = true` flag must STAY true. It exists as a safeguard.
- This applies to ALL content pipeline work: Wikidata ingestion, fact fixing, variant generation, quality checks.

## Agent Autonomy Rules
- MAY: Run ComfyUI workflows to generate sprites autonomously
- MAY: Run `npm run typecheck`, `npm run build`, `npm run dev`
- MAY: Read code/docs and run diagnostics to plan changes
- MUST: Delegate all code/doc file edits and new file creation to Agent sub-agents (Sonnet or Haiku)
- MUST ASK: Before adding new npm dependencies
- MUST ASK: Before modifying database schemas
- MUST ASK: Before deleting files
- MUST ASK: Before changing security-critical configuration (CSP, auth, CORS)

## Workflow Rules — MANDATORY
- **ALL code changes** (edits, new files, refactors) MUST be performed by Sonnet/Haiku sub-agents via the Agent tool
- The Opus orchestrator is for **planning, analysis, and coordination only** — it must NOT directly edit or write code files
- The orchestrator MAY: read files, run typecheck/build/git commands, take screenshots, analyze bugs
- The orchestrator MUST delegate to Sonnet/Haiku workers: all file edits, all code writing, all refactoring
- After workers complete, the orchestrator verifies (typecheck, build, visual test) and commits
- This conserves Opus budget for architecture and creative decisions where it matters most
- **ALWAYS rebuild/restart the dev server after code changes** so the user's browser shows the live version. Vite HMR handles most changes automatically, but after config changes, dependency updates, or structural changes, explicitly restart with `npm run dev`

## Game Design Documentation — MANDATORY

Every code change that touches gameplay MUST have corresponding documentation updates. This is non-negotiable.

### What Triggers a Doc Update
- **Addition**: New mechanic, card type, enemy, status effect, UI element, screen, or system → add to `docs/GAME_DESIGN.md` AND `docs/ARCHITECTURE.md`
- **Change**: Modified balance values, altered mechanic behavior, changed UX flow, updated card effects → update the relevant sections in `docs/GAME_DESIGN.md`
- **Deletion**: Removed feature, deprecated system, dead code cleanup → remove from docs, do NOT leave stale references
- **Any change to data files** (`src/data/balance.ts`, `src/data/card-types.ts`, enemy definitions, fact DB) → update `docs/GAME_DESIGN.md` balance/data sections

### Which Docs to Update
| Change Type | `GAME_DESIGN.md` | `ARCHITECTURE.md` | `PROGRESS.md` | Phase Doc |
|---|---|---|---|---|
| New mechanic/system | YES | YES | if phase-related | YES |
| Balance tweak | YES | — | — | — |
| New UI component | YES (if player-facing) | YES | if phase-related | YES |
| Bug fix changing behavior | YES (if it changes documented behavior) | — | — | — |
| File restructure | — | YES | — | — |
| Phase completion | — | — | YES | Move to completed/ |

### Enforcement
- The orchestrator MUST verify docs are current after EVERY worker task completes
- Workers MUST include doc updates in the same task as code changes — never as a separate follow-up
- If a worker's PR/task does not update docs where required, the orchestrator MUST spawn a follow-up worker to fix it before the task is considered done
- Stale docs are treated as bugs — they have the same priority as broken tests

### Source File → GDD Section Mapping (Quick Reference)

| Source File | GDD Section |
|-------------|-------------|
| `src/data/enemies.ts` | §8 Enemy Design |
| `src/data/relics/starters.ts` + `unlockable.ts` | §16 Relic System |
| `src/data/statusEffects.ts` | §4.5 Status Effects |
| `src/data/mechanics.ts` | §6 Card Mechanics |
| `src/data/balance.ts` | Inline (referenced throughout) |
| `src/services/ascension.ts` | §27 Ascension Mode |
| `src/data/domainMetadata.ts` | §28 Fact Database |

See `.claude/skills/game-design-sync/SKILL.md` for complete per-element checklists and audit commands.

## Inspection Registry — MANDATORY

The game element inspection registry at `data/inspection-registry.json` tracks **449 elements** across 24 tables. It is the single source of truth for what exists in the game and when each element was last verified.

### Tables
cards (31), relics (42), enemies (89), rooms (7), screens (28), systems (26), mysteryEvents (27), specialEvents (5), statusEffects (6), rewardTypes (4), chainTypes (6), domains (12), quizSystems (21), domainTestMatrix (20), testingRecommendations (10), ascensionLevels (20), animationArchetypes (8), cardSynergies (27), questionFormats (4), relicTriggers (27), enemyIntents (7), masteryLevels (6), cardKeywords (10), cardTypes (6)

### When to Update
- **Any code change** touching a game element (card, relic, enemy, room, screen, system, quiz, domain): update `lastChangedDate` to today
- **Adding new elements**: add entry to the registry in the same task
- **Removing elements**: set status to `"deprecated"` (don't delete)
- **Visual inspection**: update the orientation-specific field that was tested: `visualInspectionDate_portraitMobile`, `visualInspectionDate_landscapeMobile`, or `visualInspectionDate_landscapePC`
- **Mechanic verification**: update `mechanicInspectionDate`
- **UX review**: update `uxReviewDate`

### Testing Recommendations
The `testingRecommendations` table maps each element type to the correct skill:
- Cards/Relics → `/balance-sim`, `/strategy-analysis`, `/rogue-brain watchdog`
- Screens → `/ux-review {screen}`, `/visual-inspect`
- Quiz systems → `npx vitest run`, manual multi-domain runs
- Enemies → `/balance-sim`, `/strategy-analysis`
- Domains → `domainTestMatrix` test combinations

### Quick Commands
```bash
# Check what needs inspection (elements never checked):
node -e "const r=JSON.parse(require('fs').readFileSync('data/inspection-registry.json'));Object.entries(r.tables).forEach(([t,items])=>{if(!Array.isArray(items))return;const nc=items.filter(i=>i.mechanicInspectionDate==='not_checked').length;if(nc)console.log(t+': '+nc+'/'+items.length+' unchecked')})"
```

## Visual Testing with Playwright — MANDATORY

### ABSOLUTE RULE: Visual Inspection After Every Sub-Agent Batch

**After EVERY sub-agent returns from a visual/UI/CSS task, the orchestrator MUST visually inspect the result BEFORE committing.** This is non-negotiable. On 2026-03-21, skipping this step caused 10+ visual regressions to ship (duplicate HP text, moved buttons, bloated bars, clutter labels). The user caught it, not the agent.

- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` to take screenshots — saves to `/tmp/terra-screenshot.jpg` server-side, returns the path — then `Read()` the file to view
- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser's continuous `requestAnimationFrame` loop blocks Playwright's animation-wait logic, causing a permanent 30s timeout
- **NEVER** use `page.screenshot()` via `browser_run_code` — same RAF blocking issue
- **NEVER** use `page.context().newCDPSession()` — it HANGS permanently and blocks the session
- **NEVER** use raw `__terraScreenshot()` via browser_evaluate — the base64 exceeds tool output character limits
- `mcp__playwright__browser_snapshot` (DOM snapshot) is still valid as a supplementary tool for DOM state
- If `__terraScreenshotFile()` fails or is unavailable, TELL THE USER you couldn't verify and ask them to check
- Sub-agents making CSS/layout changes are the HIGHEST RISK — always verify their output
- **Never batch-commit multiple visual agent results without inspecting each one**

Two tools available — use the right one for the job:

### Quick Combat Setup (use instead of clicking through menus)

**ALWAYS use `__terraScenario` to instantly enter any game state. Do NOT navigate through hub → dungeon → map → node manually.**

```javascript
// In browser_evaluate:
await page.evaluate(() => window.__terraScenario.load('combat-basic'));  // instant combat
await page.evaluate(() => window.__terraScenario.load('combat-boss'));   // boss with relics
await page.evaluate(() => window.__terraScenario.load('combat-10-cards')); // 10-card hand
await page.evaluate(() => window.__terraScenario.load('shop'));          // shop with 500g
await page.evaluate(() => window.__terraScenario.load('reward-room'));   // reward room
```

**Before taking screenshots, ALWAYS disable animations:**
```javascript
await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
```

**Full scenario list:** `window.__terraScenario.list()` or see `src/dev/scenarioSimulator.ts`

**Screenshot method — CRITICAL:**
- **ALWAYS** use `browser_evaluate(() => window.__terraScreenshotFile())` to take screenshots — saves to `/tmp/terra-screenshot.jpg` server-side, returns the path
- Then use `Read("/tmp/terra-screenshot.jpg")` to view the image
- **NEVER** use `mcp__playwright__browser_take_screenshot` — Phaser's continuous `requestAnimationFrame` loop blocks Playwright's animation-wait logic, causing a permanent 30s timeout
- **NEVER** use `page.screenshot()` via `browser_run_code` — same RAF blocking issue
- **NEVER** use `page.context().newCDPSession()` — it hangs permanently and blocks the entire session
- **NEVER** use raw `__terraScreenshot()` via browser_evaluate — the base64 exceeds tool output character limits
- `mcp__playwright__browser_snapshot` (DOM snapshot) is still valid as a supplementary tool for DOM state
- The `__terraScreenshotFile()` function (defined in `src/dev/screenshotHelper.ts`) composites the Phaser WebGL canvas + Svelte DOM overlays via SVG foreignObject, saves via a Vite dev server endpoint (`POST /__dev/screenshot`), and returns the file path

### CRITICAL: Playwright WebGL Requirement
**Playwright's bundled Chromium does NOT have WebGL on macOS ARM64** (no SwiftShader). The game requires WebGL for Phaser 3. When launching Playwright programmatically, ALWAYS use system Chrome:
```javascript
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
```
**NEVER** use the default `chromium.launch({ headless: true })` — it will show "Device Not Supported" because WebGL is missing.

### 1. MCP Playwright (interactive — use during development)
- Use `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_evaluate` etc.
- Persistent browser session, no scripts needed — call tools directly
- Best for: live debugging, visual inspection, clicking through flows interactively
- Dev bypass: always navigate with `?skipOnboarding=true&devpreset=post_tutorial`

**Standard debug sequence:**
1. `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
2. `mcp__playwright__browser_snapshot` → inspect DOM / find errors
3. `browser_evaluate(() => window.__terraScreenshotFile())` → visual check (saves to `/tmp/terra-screenshot.jpg`), then `Read("/tmp/terra-screenshot.jpg")` to view
4. `mcp__playwright__browser_console_messages` → check JS errors

### 2. E2E Scripts (automated — use for CI and end-of-session verification)
- Scripts in `tests/e2e/` — run with `node tests/e2e/01-app-loads.cjs`
- Captures full diagnostic report: console errors, page errors, runtime JS state
- Best for: regression checks, CI/CD pipelines, end-of-session verification

**Run all E2E checks:**
```bash
node tests/e2e/01-app-loads.cjs
node tests/e2e/03-save-resume.cjs
```

- **ALWAYS capture diagnostics** — screenshots alone miss silent JS failures
- **ALWAYS verify before ending a session** — run at least `01-app-loads.cjs`
- **ALWAYS run unit tests after logic changes** — `npx vitest run` (1900+ tests); typecheck alone is not enough
- **data-testid selectors**: `btn-start-run`, `card-hand-0`..`card-hand-4`, `quiz-answer-0`..`quiz-answer-2`, `btn-age-adult`, `btn-retreat`, `btn-delve`, `combo-counter`, `room-choice-0`..`room-choice-2`
- **Screen flow**: Start Run (`btn-start-run`) → choose domain → combat encounters → retreat (`btn-retreat`) or delve deeper (`btn-delve`)
- Full reference: see `memory/playwright-workflow.md` in the auto-memory directory


## Fix Verification — MANDATORY

### 🚨 VISUAL INSPECTION IS NON-NEGOTIABLE 🚨

**After EVERY fix, implementation, or AR completion, the Opus orchestrator MUST visually inspect the actual gameplay exactly as the user would see it.** This applies to ALL work — not just bug fixes. Even if it costs more tokens. It is ALWAYS worth it.

**Visual inspection workflow:**
1. Ensure dev server is running (`npm run dev`)
2. Navigate with Playwright MCP: `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
3. Take screenshot: `browser_evaluate(() => window.__terraScreenshotFile())` — saves to `/tmp/terra-screenshot.jpg`, then `Read("/tmp/terra-screenshot.jpg")` to view
4. Take DOM snapshot: `mcp__playwright__browser_snapshot`
5. Check console: `mcp__playwright__browser_console_messages`
6. **If the visual result doesn't match expectations: FIX IT before reporting done.** Update the AR, spawn another worker, iterate. Do NOT tell the user "it should work" — CONFIRM it works.
7. For Phaser canvas content that can't be screenshotted: use `browser_evaluate` to check scene state, sprite positions, tween counts, etc.

**Edge cases MUST be examined programmatically where possible:**
- Run `npx vitest run` after any logic changes
- Use `browser_evaluate` to check boundary conditions, null states, empty arrays
- Test with different screen sizes, empty data, edge-case inputs
- If an AR touches multiple screens/flows, inspect ALL of them

**This rule applies to workers too:** Every sub-agent task prompt MUST include: "After implementation, verify visually with Playwright (`browser_evaluate(() => window.__terraScreenshotFile())` to save screenshot, then `Read()` to view + `browser_snapshot` for DOM + console check). If anything looks wrong, fix it before returning."

### Standard verification checklist
- After ANY bug fix, VERIFY it works before reporting done (Playwright screenshot+snapshot, console logs, or tests)
- Never say "this should fix it" — either confirm it works or say "I cannot verify this runtime behavior"
- If a fix can't be visually confirmed (e.g., Phaser canvas), add temporary `console.log` and check via `browser_console_messages` or `browser_evaluate` before removing them
- Use `window.__terraDebug()` (available in dev mode) to check runtime state: current screen, Phaser scene, combat state, interactive element health
- Use `window.__terraLog` (ring buffer of last 100 events) to trace what actually happened after an interaction

## Debugging Approach — MANDATORY
When fixing interaction/visual bugs:
1. **ADD LOGGING** first to confirm what's actually happening (don't guess)
2. **READ THE LOGS** via `browser_console_messages` or `browser_evaluate(() => window.__terraLog)`
3. **FIX** based on evidence
4. **VERIFY** the fix with logs, Playwright screenshot, or `window.__terraDebug()`
Never skip to step 3 — guessing at fixes without evidence wastes cycles and creates fix-loops.

## Phaser Canvas Debugging
- Playwright CANNOT interact with Phaser canvas objects — clicks don't reach Phaser's input system
- To debug Phaser interactions in the combat scene: add `this.input.on('pointerdown', (p: any) => console.log('scene click', p.x, p.y))` at scene level first to confirm clicks reach Phaser
- Common Phaser click failures in combat scene: missing `setInteractive()`, z-order occlusion, camera/scale mismatch, Svelte DOM overlay blocking canvas
- Use devpresets and `globalThis[Symbol.for('terra:currentScreen')].set('screenName')` for testing game states instead of clicking canvas
- To check if a DOM button is actually clickable, use `browser_evaluate` to test: visibility, disabled state, pointer-events, and z-index occlusion
- For Phaser-specific state, use `window.__terraDebug()` which exposes active scene, input handler count, and last click coordinates

## Roadmap Workflow — MANDATORY

### 🚨 THE #1 RULE: AR DOCS BEFORE CODE 🚨

**EVERY non-trivial task MUST have an AR phase doc BEFORE any code is written.** This is the single most important workflow rule in this project. Agents consistently violate it and it causes chaos.

**What requires an AR doc (EVERYTHING except trivial fixes):**
- New features or mechanics
- Multi-file changes
- Content pipeline batches
- Balance adjustments
- UI/UX modifications
- Refactors
- Any task with more than 2-3 discrete steps

**What does NOT require an AR doc (trivial fixes only):**
- Single-line bug fix
- Typo correction
- Simple config value change

**The workflow is: AR doc → user review → implement → check off TODOs → move to completed. NEVER skip steps 1-2.**

### 🚨 AR DOCS MUST BE WRITTEN BY OPUS — NEVER DELEGATED 🚨

**AR phase docs MUST ALWAYS be written directly by the active Opus orchestrator agent.** NEVER delegate AR doc creation to Haiku or Sonnet sub-agents. Sub-agents lose critical context, produce shallow specs, and miss important design nuances that only the orchestrator has from the conversation. The orchestrator has the full conversation context, understands the user's intent, and can write specs that workers can implement without ambiguity. This rule is absolute — no exceptions.

### Phase Documents = Source of Truth
- **`docs/roadmap/phases/`** = active/pending work. If a doc is here, it's not done.
- **`docs/roadmap/completed/`** = finished work. Moved here when all sub-steps pass.
- There is NO index file. The phase docs themselves are the only tracking mechanism.
- Naming: `AR-NN-SHORT-NAME.md` (e.g., `AR-35-COMBAT-UI-CARD-SIZE.md`)
- To find active work: `ls docs/roadmap/phases/`
- To find next AR number: check both `phases/` and `completed/` directories

### Phase Doc Requirements
Each phase doc MUST contain:
  1. **Overview**: Goal, dependencies, estimated complexity
  2. **Sub-steps**: Numbered, granular tasks with exact file paths and expected behavior
  3. **Acceptance Criteria**: Per sub-step — what must be true for the step to be done
  4. **Files Affected**: Explicit list of files created/modified
  5. **Verification Gate**: Final checklist (typecheck, build, tests, screenshots)
- Workers receiving a phase doc should be able to implement it WITHOUT reading other docs

### Workflow for Executing a Phase
1. Orchestrator lists `docs/roadmap/phases/` → picks the relevant phase doc
2. Orchestrator reads the phase doc — it is the implementation spec
3. Orchestrator spawns coding workers with the phase doc content as their spec
4. Workers implement, orchestrator verifies (typecheck, build, Playwright, acceptance criteria)
5. **Orchestrator VISUALLY INSPECTS the result** using Playwright (`browser_evaluate(() => window.__terraScreenshotFile())` to save, `Read()` to view + `browser_snapshot` + console). If it doesn't look right, iterate — spawn another worker, fix it, re-inspect. Never skip this step.
6. Orchestrator verifies doc files (`GAME_DESIGN.md`, `ARCHITECTURE.md`) reflect changes
7. On completion: check off all sub-steps, move the phase doc to `docs/roadmap/completed/`

## Sub-Agent Rules (Agent Tool)
- **Complex tasks** (system integration, architecture, multi-file changes, debugging): use `model: "sonnet"`, `subagent_type: "general-purpose"`
- **Simple tasks** (file creation from spec, single-file edits, formatting, boilerplate): use `model: "haiku"`, `subagent_type: "general-purpose"`
- **Fact/content generation** (trivia facts, JSONL content, quiz questions): use `model: "haiku"`, `subagent_type: "general-purpose"` — produces equivalent quality to Sonnet for structured content at ~10x lower cost
- **Codebase exploration** (finding files, searching code, understanding patterns): use `subagent_type: "Explore"`
- Always provide sub-agents with full context: file paths, expected behavior, verification commands
- Parallelize independent sub-agent tasks whenever possible
- The orchestrator must NEVER edit code files directly — always delegate via Agent tool
- **EXCEPTION: AR phase docs** — the orchestrator MUST write AR docs directly (never delegate to sub-agents). AR docs require full conversation context that sub-agents don't have.
- **EVERY worker task prompt MUST include**: "Update `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` if your changes affect gameplay, balance, systems, or file structure. Stale docs = bugs."
- **EVERY worker task prompt MUST include**: "After implementation, run `npm run typecheck` and `npm run build`. Then verify visually with Playwright if the change is UI/visual: use `browser_evaluate(() => window.__terraScreenshotFile())` to save, then `Read()` to view (NEVER `mcp__playwright__browser_take_screenshot` — it times out) — the orchestrator will inspect too."
- **After EVERY worker completes**: The Opus orchestrator MUST visually inspect the result using Playwright MCP (`browser_evaluate(() => window.__terraScreenshotFile())` to save, `Read()` to view + `browser_snapshot` + console). If the result doesn't match expectations, iterate immediately. NEVER report done without visual confirmation.
- **EVERY worker that touches gameplay, UI, or balance MUST update docs IN THE SAME TASK** — not as a follow-up. If the worker adds a new screen, mechanic, relic, enemy, card type, or changes any player-facing behavior, the doc updates are PART of the task, not optional. The orchestrator MUST verify docs were updated before marking the task complete.
- **CRITICAL — EVERY fact-generation worker MUST receive verified source data in its prompt.** Workers format pre-verified data into JSON — they NEVER generate factual content from LLM training knowledge. See "Fact Generation Sourcing" section. Violating this wastes ALL generated work.

## Specialized Task Patterns
### Security Audit
When reviewing code for security, delegate to a Sonnet sub-agent with these instructions:
- Review for XSS (innerHTML, eval, document.write), CSP issues, input validation gaps
- Check for dependency vulnerabilities, secret leaks, unsafe deserialization, CORS misconfig
- Reference `docs/SECURITY.md` for project security policies
- Report findings with severity (critical/high/medium/low) and file:line references

### Sprite Generation
When generating sprites, delegate to a sub-agent with these instructions:
- Create ComfyUI API workflow payloads for pixel art sprites
- Submit to local ComfyUI server at `http://localhost:8188`
- Validate output (correct dimensions, transparent background, PNG format)
- Save to appropriate location under `src/assets/`
- Reference `docs/SPRITE_PIPELINE.md` for prompt templates and resolution targets
- ComfyUI Python venv: `/Users/damion/CODE/ComfyUI/.venv`, Models: `/Users/damion/CODE/ComfyUI/models/`

## Context Guide — What to Read
- Game mechanics and design → `docs/GAME_DESIGN.md` (v3 — curated deck system)
- System architecture and data flow → `docs/ARCHITECTURE.md` (v8)
- Curated deck redesign spec → `docs/RESEARCH/DECKBUILDER.md` (takes precedence over GDD where conflicts exist)
- UX design details → `docs/RESEARCH/03_UX_IMPROVEMENTS.md`
- Addictiveness research → `docs/RESEARCH/01_Addictiveness_research.md`
- Expansion production spec → `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md`
- Sprite generation pipeline → `docs/SPRITE_PIPELINE.md`
- Security policies and practices → `docs/SECURITY.md`

## Svelte MCP — MANDATORY for Component Work
The `mcp__svelte__*` MCP server provides official Svelte 5 documentation. Use it proactively:
- **Before writing any `.svelte` component**: call `mcp__svelte__list-sections` to find relevant docs
- **When using runes** (`$state`, `$derived`, `$effect`, `$props`): fetch the relevant section first
- **When hitting a Svelte error**: check the MCP before guessing — see also `memory/svelte-bugs.md`
- Key sections: `svelte/$state`, `svelte/$derived`, `svelte/$effect`, `svelte/basic-markup`, `svelte/each`

## Content Pipeline — Distractor Generation Rules

**CRITICAL: NEVER generate distractors from database pools**

Distractors (wrong answers for quiz questions) MUST NEVER be pulled from `correct_answer` values of other facts in the same domain/subcategory. This approach produces semantically nonsensical garbage — a bird species name as a distractor for a bird behavior question, a random capital for a flag question, etc. On March 12, 2026, 58,359 garbage distractors had to be stripped from the database.

**MANDATORY:** ALL distractors MUST be generated by an LLM (GPT-5.2+ or Haiku agent) that reads the specific question, understands what's being asked, and produces plausible wrong answers that:
- Are semantically coherent with what the question asks
- Match the format and length of the correct answer
- Are factually WRONG but plausible to a student
- Come from the LLM's world knowledge, NOT from database queries

The ONLY permitted use of DB queries for distractors is POST-GENERATION VALIDATION — checking that a generated distractor doesn't accidentally match another fact's correct answer.

Scripts like `mine-distractors.mjs` or any `SELECT correct_answer FROM facts WHERE category = ...` approach for distractor generation are PERMANENTLY BANNED.

## Commands
- `npm run dev` — Start dev server (port 5173)
- `npm run build` — Production build
- `npm run typecheck` — Run TypeScript/Svelte type checking
- `npm run check` — Full type check (app + node configs)
- `npx vitest run` — Run 1900+ unit tests (run after any logic/data changes)
- `python3 scripts/extract-card-frame.py` — Re-extract card frame layers from master PSD and regenerate all 14 color variant WebP files in `public/assets/cardframes/v2/`
- `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000` — Headless balance sim (6 profiles x 1000 runs)
