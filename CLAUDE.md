# Recall Rogue — Agent Context

A 2D card roguelite knowledge game built with Vite + Svelte + TypeScript + Phaser 3, targeting Steam PC (1920×1080 landscape) first, mobile via Capacitor later.

## 🚨 FIRST ACTION EVERY NEW CONVERSATION — MANDATORY

Before doing ANYTHING else in a fresh conversation, invoke the `/catchup` skill. Applies to the first message in every new chat, every `/clear`, every worktree session, every sub-agent spawn that starts a new orchestrator context. The only exception is when the user's first message IS a skill invocation. Do not announce it — just invoke, read, and respond.

## 🚨 Employee Mindset — First Principle

You are a senior employee of this studio. **Default to action, not interrogation. Only deliver finished work. Never defer findings. Document obsessively in the same commit. Think creatively about the player.**

Read these rules in order, every session — they are short by design:

1. **`.claude/rules/autonomy-charter.md`** — Green/Yellow/Red Autonomy Ladder, Never Defer rule, Only Finished Work checklist, Clarification Bar, Keep Going rule, Final Report Format.
2. **`.claude/rules/player-experience-lens.md`** — five checks before shipping anything player-visible.
3. **`.claude/rules/creative-pass.md`** — three-item Creative Pass at the end of every non-trivial response.
4. **`.claude/rules/agent-mindset.md`** — `## What's Next` forcing function, proactive skill triggers, anti-patterns.
5. **`.claude/rules/task-tracking.md`** — granular `TaskCreate` discipline; `TaskList` must be empty before commit.

If any other file appears to conflict with those five, those five win (except on Red-zone actions, where you ask the user).

## Project Summary
- **Concept**: Card roguelite where every card is a fact. Players answer questions to activate cards in turn-based combat. Learning IS the core mechanic — powered by FSRS spaced repetition.
- **Tech Stack**: Vite 7, Svelte 5, TypeScript 5.9, Phaser 3, Capacitor (Android/iOS)
- **Sprite Generation**: ComfyUI with SDXL + pixel art LoRA (RTX 3060 12GB)
- **Backend**: Fastify + TypeScript (planned)

## Commands
```
npm run dev              # Dev server (port 5173) — clear cache first: rm -rf node_modules/.vite
npm run build            # Production build
npm run typecheck        # TypeScript/Svelte type checking
npm run check            # Full type check (app + node configs)
npx vitest run           # 1900+ unit tests
npm run registry:sync    # Rebuild inspection registry from source
npm run registry:stale   # Show stale/never-inspected elements
npm run build:curated    # Rebuild public/curated.db from data/decks/
npm run build:obfuscate  # XOR-obfuscate public/facts.db + public/curated.db
npm run deck:quality     # Full deck quality gate (structural + quiz audit)
npm run deck:fix-pools   # Auto-split heterogeneous answer pools
npm run deck:fix-synthetics # Pad pools to 15+ with synthetic distractors
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
public/curated.db  — Build artifact (XOR-obfuscated in prod)
docs/RESEARCH/     — Design specs and research
```

## Convention & Rule Files

Rules live in `.claude/rules/`. Short universal rules load every session; heavier domain rules are path-scoped via `paths:` frontmatter and only load when the orchestrator touches matching files.

| Rule File | Scope | Covers |
|---|---|---|
| `autonomy-charter.md` | always | Employee Mindset, Autonomy Ladder, Never Defer, Finished Work, Clarification Bar |
| `player-experience-lens.md` | always | Five checks before shipping player-visible changes |
| `creative-pass.md` | always | Three-item Creative Pass |
| `agent-mindset.md` | always | `## What's Next` forcing function, proactive skill triggers |
| `task-tracking.md` | always | `TaskCreate` discipline — canonical |
| `agent-routing.md` | always | Routing table, Sub-Agent Prompt Template — canonical |
| `docs-first.md` | always | Read before, update after, zero threshold |
| `testing.md` | always | Vitest, Docker visual verify, LLM playtests — canonical |
| `git-workflow.md` | always | Commits, branches, tags, dangerous ops |
| `code-style.md` | always | TypeScript strict, security, no external LLM APIs |
| `content-pipeline.md` | `data/decks/**` | Curriculum sourcing, fact verification, distractor generation |
| `deck-quality.md` | `data/decks/**` | Pool design, batch verification, quiz audit, 14 anti-patterns |
| `game-conventions.md` | `src/{game,services,data}/**` | Damage pipeline, charge values, surge, FSRS, chains |
| `ui-layout.md` | `src/ui/**` | Dynamic scaling, Steam PC target, layer architecture, softlock prevention |
| `save-load.md` | `src/services/runSaveService.ts` etc. | Schema versioning, rehydration, migration |
| `performance.md` | `src/{game,ui}/**` | FPS/memory targets, PostFX by tier |
| `error-handling.md` | `src/{services,game,ui}/**` | Recoverable vs fatal, logging patterns |

## Agent Definitions

Agent roles and file ownership in `.claude/agents/`:

| Agent | Owns | Key Skills |
|---|---|---|
| `game-logic` | `src/game/`, `src/services/`, `src/data/` | balance-sim, rogue-brain, strategy-analysis |
| `ui-agent` | `src/ui/` | visual-inspect, ux-review, card-frames |
| `content-agent` | `data/decks/`, `facts.db` | deck-master, answer-checking, japanese-decks |
| `qa-agent` | `tests/`, `docs/gotchas.md` | inspect, quick-verify, code-review |
| `docs-agent` | `docs/`, CLAUDE.md | game-design-sync, docs-keeper |

## Agent Architecture (Claude Code)
- **Orchestrator**: Opus 4.6 — planning, research, coordination, verification. May edit `.claude/` and `CLAUDE.md` directly; must delegate all other edits.
- **Coding workers**: Sonnet sub-agents (`model: "sonnet"`) — all code edits in `src/`, `tests/`, `data/`, `docs/`.
- **Quick tasks**: Haiku sub-agents (`model: "haiku"`) — simple/mechanical changes.
- **Exploration**: Explore sub-agents — codebase search.
- Routing and edit rights: `.claude/rules/agent-routing.md` (canonical).

## Session Discipline

Sessions end abruptly. Never defer persistence.
- Commit after EVERY meaningful change. Docs, gotchas, memory, rules updated IN THE SAME commit as code.
- Every commit should leave the repo so a fresh agent can pick up seamlessly.

## Debugging
1. Add logging first (don't guess).
2. Read logs via `browser_console_messages` or `window.__rrLog`.
3. Fix based on evidence.
4. Verify with screenshot + `__rrDebug()`.

## Planning Workflow
Non-trivial tasks: `/plan` → user reviews → implement with `TaskCreate` → verify → done. `/feature-pipeline` skill governs the full 8-phase lifecycle. Historical: `docs/roadmap/completed/`, `docs/roadmap/archived-futures/`.

## Inspection Registry
- `data/inspection-registry.json` — 415+ elements, 14 tables, auto-generated.
- Never edit manually. `npm run registry:sync` to rebuild, `npm run registry:stale` for what to test.
- Testing skills auto-stamp dates after completing.

## Headless Balance Simulation
```
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000
```
Imports real game code directly. 6,000 runs in 5 seconds. Browser bots are for VISUAL TESTING ONLY.

## Context Guide — What to Read
- **Start here** → `docs/INDEX.md` (master navigation hub)
- Game design intent → `docs/GAME_DESIGN.md`
- Architecture overview → `docs/architecture/overview.md`
- Service catalog → `docs/architecture/services/index.md` (140 services, 8 domain files)
- Combat mechanics → `docs/mechanics/combat.md`
- Card system → `docs/mechanics/cards.md`
- Enemy roster → `docs/mechanics/enemies.md`
- Relic catalog → `docs/mechanics/relics.md`
- Quiz engine → `docs/mechanics/quiz.md`
- UI components → `docs/ui/components.md`
- Screen flow → `docs/ui/screens.md`
- Deck system → `docs/content/deck-system.md`
- Testing strategy → `docs/testing/strategy.md`
- Gotchas / lessons → `docs/gotchas.md`
- Curated deck spec → `docs/RESEARCH/DECKBUILDER.md`
- Security → `docs/SECURITY.md`

## Playtest Dashboard
- Start: `npm run playtest:dashboard` → `http://localhost:5175/playtest`
- Data: `data/playtests/leaderboard.json`, `data/playtests/logs/`, `data/playtests/reports/`
- Details: `docs/testing/PLAYTEST-DASHBOARD.md`

## Dev bypass URL
`http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
