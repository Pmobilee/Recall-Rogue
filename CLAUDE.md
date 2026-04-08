# Recall Rogue — Agent Context

A 2D card roguelite knowledge game built with Vite + Svelte + TypeScript + Phaser 3, targeting Steam PC (1920×1080 landscape) first, mobile via Capacitor later.

## Task Management — MANDATORY — NO EXCEPTIONS

**USE CLAUDE CLI TASKS (TaskCreate, TaskUpdate, TaskList) FOR EVERYTHING.**

Unless it's a simple couple-line fix, you MUST break work into **granular** tasks BEFORE starting. Not just high-level phases — every discrete sub-step gets its own task.

**Rules:**
- Create tasks for EVERY pool, EVERY batch, EVERY assembly step, EVERY validation check
- Mark `in_progress` when beginning, `completed` when done
- Failed tasks stay `in_progress` as visible reminders — never delete failed work
- **Before committing:** run TaskList and verify ZERO pending tasks. If anything is pending, that work hasn't been done
- **If it's not a task, it WILL be forgotten.** Three entire pools were skipped in the Medical Terminology deck because they weren't tracked as tasks (2026-04-03). This is the #1 cause of incomplete deliverables.

## Project Summary
- **Concept**: Card roguelite where every card is a fact. Players answer questions to activate cards in turn-based combat. Learning IS the core mechanic — powered by FSRS spaced repetition.
- **Tech Stack**: Vite 7, Svelte 5, TypeScript 5.9, Phaser 3, Capacitor (Android/iOS)
- **Sprite Generation**: ComfyUI with SDXL + pixel art LoRA (RTX 3060 12GB)
- **Backend**: Fastify + TypeScript (planned)

## Commands
```
npm run dev              # Dev server (port 5173) — ALWAYS clear cache first: rm -rf node_modules/.vite
npm run build            # Production build
npm run typecheck        # TypeScript/Svelte type checking
npm run check            # Full type check (app + node configs)
npx vitest run           # 1900+ unit tests
npm run registry:sync    # Rebuild inspection registry from source
npm run registry:stale   # Show stale/never-inspected elements
npm run build:curated    # Rebuild public/curated.db from data/decks/ JSON files
npm run build:obfuscate  # XOR-obfuscate public/facts.db and public/curated.db for production
```

## Directory Structure
```
src/game/          — Phaser scenes, entities, game systems
src/ui/            — Svelte components (card hand, combat UI, menus)
src/services/      — Quiz engine, FSRS scheduler, turn management
src/data/          — TypeScript types, schemas, enemy/card/relic definitions
src/assets/        — Sprites, card art, audio, UI graphics
src/_archived/     — Archived deprecated components (not compiled)
docs/              — Modular documentation (see docs/INDEX.md)
public/curated.db  — Build artifact: all curated decks compiled to SQLite (XOR-obfuscated in prod)
docs/RESEARCH/     — Design specs and research
```

## Convention & Rule Files

Stable conventions are in `.claude/rules/` (auto-loaded every session):

| Rule File | Covers |
|---|---|
| `agent-mindset.md` | Self-review protocol, production standards, proactive skill triggers |
| `agent-routing.md` | Mandatory agent routing, file ownership, sub-agent prompts |
| `code-style.md` | TypeScript strict, security, no Anthropic API |
| `content-pipeline.md` | Curriculum sourcing, fact verification, distractor generation |
| `deck-quality.md` | Pool design, batch verification, quiz audit, LLM review |
| `docs-first.md` | Read docs before code, update after every change |
| `error-handling.md` | Error boundaries, recoverable vs fatal, logging patterns |
| `game-conventions.md` | Damage pipeline, charge values, surge, FSRS, chains |
| `git-workflow.md` | Branch naming, commit format, tags, worktree hygiene |
| `performance.md` | FPS/memory targets, optimization guidelines |
| `save-load.md` | Schema versioning, migration strategy, crash-safe writes |
| `task-tracking.md` | CLI tasks for ALL work, no exceptions |
| `testing.md` | Vitest, build verification, headless sim, Playwright |
| `ui-layout.md` | Dynamic scaling, Steam PC target, layer architecture |

## Agent Definitions

Agent roles and file ownership in `.claude/agents/`:

| Agent | Owns | Key Skills |
|---|---|---|
| `game-logic` | src/game/, src/services/, src/data/ | balance-sim, rogue-brain, strategy-analysis |
| `ui-agent` | src/ui/ | visual-inspect, ux-review, card-frames |
| `content-agent` | data/decks/, facts.db | deck-master, answer-checking, japanese-decks |
| `qa-agent` | tests/, gotchas | inspect, quick-verify, code-review |
| `docs-agent` | docs/, CLAUDE.md | game-design-sync, docs-keeper |

## Agent Architecture (Claude Code)
- **Orchestrator**: Opus 4.6 — planning, analysis, coordination, verification only
- **Coding workers**: Sonnet sub-agents (`model: "sonnet"`) — all code edits
- **Quick tasks**: Haiku sub-agents (`model: "haiku"`) — simple/mechanical changes
- **Exploration**: Explore sub-agents (`subagent_type: "Explore"`) — codebase search
- Orchestrator MUST delegate all file edits to sub-agents — never edit directly

## Autonomy Rules
- MAY: Run typecheck, build, dev server, ComfyUI, read code/docs
- MUST: Delegate all code/doc edits to sub-agents
- MUST ASK: Before adding npm deps, modifying DB schemas, deleting files, changing security config

## Documentation — Docs-First Culture

**Read docs BEFORE code. Update docs AFTER every change.** See `/docs-keeper` skill.

- Docs are modular sub-files under `docs/` — navigate via `docs/INDEX.md`
- Each sub-file covers one system, stays under ~200 lines
- `docs/gotchas.md` — append-only mistake log
- `docs/GAME_DESIGN.md` — design intent (GDD, single file)
- See `.claude/rules/docs-first.md` for full protocol

## Session Discipline — CRITICAL

**Sessions can end abruptly. NEVER defer persistence.**

- Commit + push after EVERY meaningful change — not batched, not "at the end"
- Docs, memory, rules, gotchas updated IN THE SAME commit as code changes
- If in a worktree, push the branch — unpushed worktrees get lost
- At task completion: ASK THE USER "Should I merge this into main?" — they forget about lingering branches
- Run `git worktree list` at natural breakpoints and flag orphaned worktrees
- Every commit should leave the repo so a fresh agent can pick up seamlessly

## Chrome Browser Locking

**Chrome-lock is only needed for `claude-in-chrome` MCP tools** (shared browser session).

For Playwright-based visual testing, use **Docker containers instead** — no lock needed:
```bash
scripts/docker-visual-test.sh --scenario combat-basic --agent-id my-agent
# Outputs: /tmp/rr-docker-visual/{agent}_{scenario}_{timestamp}/
# Requires Docker Desktop running. Supports 2-3 parallel containers.
```

Legacy chrome-lock (for claude-in-chrome MCP only):
```bash
scripts/chrome-lock.sh check                    # Check if locked
scripts/chrome-lock.sh wait 60                  # Wait up to 60s
scripts/chrome-lock.sh acquire <task-id>        # Acquire lock
scripts/chrome-lock.sh release                  # Release lock
```

Locks do NOT auto-expire. Always release when done.

## Visual Testing — Key Rules

Full details in `.claude/rules/testing.md`. Critical points:
- **ALWAYS** use `__rrScreenshotFile()` + `__rrLayoutDump()` for visual verification
- **NEVER** use `mcp__playwright__browser_take_screenshot` (Phaser RAF blocks it)
- **ALWAYS** use `__rrScenario.load()` to jump to game states — never click through menus
- **ALWAYS** visually inspect after EVERY sub-agent batch before committing
- Playwright WebGL: use `channel: 'chrome'` — bundled Chromium has no WebGL on macOS ARM64
- Dev bypass URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Debugging
1. ADD LOGGING first (don't guess)
2. READ LOGS via `browser_console_messages` or `window.__rrLog`
3. FIX based on evidence
4. VERIFY with screenshot + `__rrDebug()`

## Planning Workflow
- Non-trivial tasks: `/plan` → user reviews → implement with TaskCreate → verify → done
- `/feature-pipeline` skill governs the full 7-phase lifecycle
- Historical: `docs/roadmap/completed/` (254 completed phases), `docs/roadmap/archived-futures/`

## Inspection Registry
- `data/inspection-registry.json` — 415+ elements, 14 tables, auto-generated
- Never edit manually. `npm run registry:sync` to rebuild, `registry:stale` for what to test
- Testing skills auto-stamp dates after completing

## Headless Balance Simulation
```
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000
```
Imports real game code directly. 6,000 runs in 5 seconds. Browser bots are for VISUAL TESTING ONLY.

## Context Guide — What to Read
- **Start here** → `docs/INDEX.md` (master navigation hub)
- Game design intent → `docs/GAME_DESIGN.md` (v3 — design spec, not code docs)
- Architecture overview → `docs/architecture/overview.md`
- Service catalog → `docs/architecture/services/index.md` (140 services, 8 domain files)
- Combat mechanics → `docs/mechanics/combat.md`
- Card system → `docs/mechanics/cards.md`
- Enemy roster → `docs/mechanics/enemies.md`
- Relic catalog → `docs/mechanics/relics.md`
- Quiz engine → `docs/mechanics/quiz.md`
- UI components → `docs/ui/components.md` (181 components)
- Screen flow → `docs/ui/screens.md`
- Layout scaling → `docs/ui/layout.md`
- Deck system → `docs/content/deck-system.md`
- Testing strategy → `docs/testing/strategy.md`
- Gotchas / lessons → `docs/gotchas.md`
- Curated deck spec → `docs/RESEARCH/DECKBUILDER.md` (precedence over GDD)
- Security → `docs/SECURITY.md`

## Playtest Dashboard
- Start: `npm run playtest:dashboard` → `http://localhost:5175/playtest`
- Data: `data/playtests/leaderboard.json`, `data/playtests/logs/`, `data/playtests/reports/`
- Details: `docs/testing/PLAYTEST-DASHBOARD.md`

## Sub-Agent Prompt Requirements
Every sub-agent prompt MUST include:
1. "Read relevant docs under docs/ BEFORE writing code. Navigate via docs/INDEX.md."
2. "After changes, update those same doc files."
3. "Run `npm run typecheck` and `npm run build` after implementation."
4. "For UI work: verify with `__rrScreenshotFile()` + `__rrLayoutDump()`. Target: Steam PC 1920×1080."
5. "Use `calc(Npx * var(--layout-scale, 1))` for dimensions, `calc(Npx * var(--text-scale, 1))` for fonts. ZERO hardcoded px."

## Svelte MCP
Before writing `.svelte` components: call `mcp__svelte__list-sections`. For runes: fetch section first. For errors: check MCP before guessing.
