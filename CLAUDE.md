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
- **ALWAYS take screenshots after every visual/UI change** before considering work done
- **ALWAYS take a screenshot before ending a session** to confirm the game is in a working visual state
- The MCP Playwright tool DOES NOT WORK in this environment (sandbox restriction) — use the Bash Node.js script approach below
- When debugging visual bugs, screenshot FIRST to see the actual problem, then after each fix attempt
- **Template** (write to `/tmp/ss.js` and run with `node /tmp/ss.js`):
```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-base.png' })
  // Navigate to mine:
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-mine.png' })
  await browser.close()
})()
```
- Then read `/tmp/ss-mine.png` with the Read tool to visually inspect the result
- Full reference: see `memory/playwright-workflow.md` in the auto-memory directory

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

## Commands
- `npm run dev` — Start dev server (port 5173)
- `npm run build` — Production build
- `npm run typecheck` — Run TypeScript/Svelte type checking
- `npm run check` — Full type check (app + node configs)
