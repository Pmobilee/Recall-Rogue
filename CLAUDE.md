# Terra Miner — Agent Context

A 2D pixel art mining/knowledge game built with Vite + Svelte + TypeScript + Phaser 3, targeting mobile via Capacitor.

## Project Summary
- **Concept**: Miner crash-lands on a far-future Earth. Mine underground to discover minerals and relics. Learn facts about Earth's history through Anki-inspired spaced repetition quizzes (1 correct + 3 similar distractors).
- **Tech Stack**: Vite 7, Svelte 5, TypeScript 5.9, Phaser 3, Capacitor (Android/iOS)
- **Sprite Generation**: ComfyUI with SDXL + pixel art LoRA, running locally on RTX 3060 12GB
- **Backend**: Fastify + TypeScript (planned), containerized for portable hosting
- **Data**: Quiz facts served via API, cached locally for offline play

## Directory Structure
```
src/game/          — Phaser scenes, entities, game systems
src/ui/            — Svelte components (menus, quiz overlay, HUD)
src/services/      — API client, caching, auth
src/data/          — TypeScript types, schemas, seed data
src/assets/        — Sprites, tilesets, audio, UI graphics
sprite-gen/        — ComfyUI workflows, automation scripts
docs/              — Project documentation (LLM-optimized)
```

## Key Conventions
- All code in TypeScript with strict mode
- Svelte components use `.svelte` extension, PascalCase filenames
- Game entities use composition over inheritance
- File naming: kebab-case for utilities, PascalCase for components/classes
- All public functions must have JSDoc comments
- Pixel art assets: PNG format, transparent backgrounds, power-of-2 dimensions

## Security Rules — MANDATORY
- NEVER use `eval()`, `Function()`, or `innerHTML` with dynamic content
- NEVER commit `.env` files, API keys, tokens, or credentials
- NEVER disable Content Security Policy headers
- ALWAYS sanitize user input before rendering or storing
- ALWAYS use parameterized queries for any database operations
- ALWAYS validate API responses against expected schemas
- Keep dependencies minimal; audit before adding new packages

## Agent Architecture (Claude Code)
- **Orchestrator**: Claude Opus 4.6 — planning, analysis, coordination, verification
- **Coding workers**: Sonnet 4.5 sub-agents via Agent tool (`model: "sonnet"`) — all code edits, new files, refactoring
- **Quick tasks**: Haiku 4.5 sub-agents via Agent tool (`model: "haiku"`) — simple/mechanical changes, formatting, boilerplate
- **Exploration**: Explore-type sub-agents (`subagent_type: "Explore"`) — codebase search, file discovery, code understanding

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

## Visual Testing with Playwright — MANDATORY

Two tools available — use the right one for the job:

### 1. MCP Playwright (interactive — use during development)
- Use `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_take_screenshot` etc.
- Persistent browser session, no scripts needed — call tools directly
- Best for: live debugging, visual inspection, clicking through flows interactively
- Dev bypass: always navigate with `?skipOnboarding=true&devpreset=post_tutorial`

**Standard debug sequence:**
1. `mcp__playwright__browser_navigate` → `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
2. `mcp__playwright__browser_snapshot` → inspect DOM / find errors
3. `mcp__playwright__browser_take_screenshot` → visual check
4. `mcp__playwright__browser_console_messages` → check JS errors

### 2. E2E Scripts (automated — use for CI and end-of-session verification)
- Scripts in `tests/e2e/` — run with `node tests/e2e/01-app-loads.cjs`
- Captures full diagnostic report: console errors, page errors, runtime JS state
- Best for: regression checks, CI/CD pipelines, end-of-session verification

**Run all E2E checks:**
```bash
node tests/e2e/01-app-loads.cjs
node tests/e2e/02-mine-quiz-flow.cjs
node tests/e2e/03-save-resume.cjs
```

- **ALWAYS capture diagnostics** — screenshots alone miss silent JS failures
- **ALWAYS verify before ending a session** — run at least `01-app-loads.cjs`
- **ALWAYS run unit tests after logic changes** — `npx vitest run` (215+ tests); typecheck alone is not enough
- **data-testid selectors**: `btn-dive`, `btn-enter-mine`, `btn-surface`, `quiz-answer-0`..`quiz-answer-3`, `btn-age-adult`, `hud-o2-bar`
- Full reference: see `memory/playwright-workflow.md` in the auto-memory directory

### 3. Playwright Test Agents (test creation and healing)
- Three agents in `.claude/agents/`: **planner** (explores app, writes test plans), **generator** (converts plans to tests), **healer** (debugs and fixes failing tests)
- Config: `playwright.config.ts`, tests in `tests/e2e/playwright/`, seed test: `seed.spec.ts`
- Use the **Healer agent** after any fix to automatically verify tests still pass
- Agents use `mcp__playwright-test__*` tools (separate MCP server from the interactive one)
- Run tests directly: `npx playwright test` (uses the config file)

## Fix Verification — MANDATORY
- After ANY bug fix, VERIFY it works before reporting done (Playwright screenshot+snapshot, console logs, or tests)
- Never say "this should fix it" — either confirm it works or say "I cannot verify this runtime behavior"
- If a fix can't be visually confirmed (e.g., Phaser canvas), add temporary `console.log` and check via `browser_console_messages` or `browser_evaluate` before removing them
- Use `window.__terraDebug()` (available in dev mode) to check runtime state: current screen, Phaser scene, player position, interactive element health
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
- To debug Phaser interactions: add `this.input.on('pointerdown', (p: any) => console.log('scene click', p.x, p.y))` at scene level first to confirm clicks reach Phaser
- Common Phaser click failures: missing `setInteractive()`, z-order occlusion, camera/scale mismatch, Svelte DOM overlay blocking canvas
- Use devpresets and `globalThis[Symbol.for('terra:currentScreen')].set('screenName')` for testing game states instead of clicking canvas
- To check if a DOM button is actually clickable, use `browser_evaluate` to test: visibility, disabled state, pointer-events, and z-index occlusion
- For Phaser-specific state, use `window.__terraDebug()` which exposes active scene, input handler count, and last click coordinates

## Roadmap Workflow — MANDATORY

### PROGRESS.md = Lightweight Oversight Index
- `docs/roadmap/PROGRESS.md` is the master checklist — consult it first for next work
- PROGRESS.md contains ONLY: phase name, status (checkbox), one-line summary, and a link to the detailed phase document
- It is an oversight file for tracking completion, NOT a detailed specification

### Detailed Phase Documents = Source of Truth for Implementation
- Every uncompleted phase has a dedicated detailed document in `docs/roadmap/phases/`
- Naming: `PHASE-07-VISUAL-ENGINE.md`, `PHASE-08-MINE-GAMEPLAY.md`, etc.
- These documents are the SOLE specification that coding workers (Sonnet/Haiku) execute against
- Each phase document MUST contain:
  1. **Overview**: Goal, dependencies on prior phases, estimated complexity
  2. **Sub-steps**: Numbered, granular, unambiguous tasks with exact file paths, function names, and expected behavior
  3. **Acceptance Criteria**: Per sub-step — what must be true for the step to be considered done
  4. **Playwright Test Scripts**: Concrete test code (Node.js scripts) that visually and functionally verify each feature
  5. **Verification Gate**: A final checklist that MUST pass before the phase is marked complete (typecheck, build, screenshots, specific behavioral tests)
  6. **Files Affected**: Explicit list of files that will be created or modified
- Workers receiving a phase document should be able to implement it WITHOUT reading any other documentation
- Phase documents reference design decisions by ID (e.g., DD-V2-087) for traceability

### Workflow for Executing a Phase
1. Orchestrator consults PROGRESS.md → identifies next uncompleted phase
2. Orchestrator reads the detailed phase doc from `docs/roadmap/phases/`
3. Orchestrator spawns coding workers with the phase doc content as their spec
4. Workers implement, orchestrator verifies (typecheck, build, Playwright screenshots, acceptance criteria)
5. On completion: orchestrator checks off the phase in PROGRESS.md, moves the phase doc to `docs/roadmap/completed/`
6. Push to remote after every completed phase

### Active Work Tracking
- `docs/roadmap/in-progress/` contains docs for phases currently being actively worked on (moved from `phases/` when work begins)
- `docs/roadmap/completed/` contains docs for finished phases
- `docs/roadmap/phases/` contains docs for phases not yet started
- Keep the roadmap current on every meaningful change; if the session resets, this is the source of truth

## Sub-Agent Rules (Agent Tool)
- **Complex tasks** (system integration, architecture, multi-file changes, debugging): use `model: "sonnet"`, `subagent_type: "general-purpose"`
- **Simple tasks** (file creation from spec, single-file edits, formatting, boilerplate): use `model: "haiku"`, `subagent_type: "general-purpose"`
- **Codebase exploration** (finding files, searching code, understanding patterns): use `subagent_type: "Explore"`
- Always provide sub-agents with full context: file paths, expected behavior, verification commands
- Parallelize independent sub-agent tasks whenever possible
- The orchestrator must NEVER edit files directly — always delegate via Agent tool

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
- ComfyUI Python venv: `/opt/comfyui-env`, Models: `/opt/ComfyUI/models/`

## Context Guide — What to Read
- Game mechanics and design → `docs/GAME_DESIGN.md`
- System architecture and data flow → `docs/ARCHITECTURE.md`
- Past decisions and rationale → `docs/DECISIONS.md`
- Sprite generation pipeline → `docs/SPRITE_PIPELINE.md`
- Security policies and practices → `docs/SECURITY.md`
- Quick lookup index → `docs/CONTEXT_INDEX.md`

## Svelte MCP — MANDATORY for Component Work
The `mcp__svelte__*` MCP server provides official Svelte 5 documentation. Use it proactively:
- **Before writing any `.svelte` component**: call `mcp__svelte__list-sections` to find relevant docs
- **When using runes** (`$state`, `$derived`, `$effect`, `$props`): fetch the relevant section first
- **When hitting a Svelte error**: check the MCP before guessing — see also `memory/svelte-bugs.md`
- Key sections: `svelte/$state`, `svelte/$derived`, `svelte/$effect`, `svelte/basic-markup`, `svelte/each`

## Commands
- `npm run dev` — Start dev server (port 5173)
- `npm run build` — Production build
- `npm run typecheck` — Run TypeScript/Svelte type checking
- `npm run check` — Full type check (app + node configs)
- `npx vitest run` — Run 215+ unit tests (run after any logic/data changes)
