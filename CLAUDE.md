# Recall Rogue — Agent Context

A 2D card roguelite knowledge game built with Vite + Svelte + TypeScript + Phaser 3, targeting Steam PC (1920×1080 landscape) first, mobile via Capacitor later.

## 🚨 FIRST ACTION EVERY NEW CONVERSATION — MANDATORY

Before doing ANYTHING else in a fresh conversation, invoke the `/catchup` skill. Applies to the first message in every new chat, every `/clear`, every worktree session, every sub-agent spawn that starts a new orchestrator context. The only exception is when the user's first message IS a skill invocation. Do not announce it — just invoke, read, and respond.

## 🚨 WORKTREES ARE MANDATORY FOR EVERY FILE-EDITING SUB-AGENT

**Every `Agent` dispatch for a file-editing sub-agent MUST pass `isolation: "worktree"`. There is no sequential carve-out, no "small change" exception, no "just this once."** A `PreToolUse` hook (`scripts/hooks/pre-tool-agent-worktree.sh`) enforces this — it will **BLOCK** any dispatch of `game-logic`, `ui-agent`, `content-agent`, `qa-agent`, or `docs-agent` that is missing `isolation: "worktree"`. You will see a loud error telling you to re-dispatch. This is not a warning; it is a hard refusal.

**Read-only sub-agents are exempt**: `Explore`, `Plan`, `claude-code-guide`, `general-purpose`, `statusline-setup` pass through without isolation.

**The orchestrator itself stays on `main`** for coordination, reading, verification, and direct edits to `.claude/`, `CLAUDE.md`, plans, and memory. Anything else — `src/`, `data/`, `docs/`, `scripts/`, `public/`, `tests/` — is delegated to a domain sub-agent, which runs in a worktree.

**After a worktree sub-agent returns**, merge via:
```
scripts/merge-worktree.sh <worktree-path> <branch-name> "<merge-message>"
```
The script handles the `--no-ff` merge, removes the worktree, and deletes the one-time branch. If you forget, the `end-of-turn-check.sh` Stop hook warns about stray worktrees. Never leave a worktree behind.

**Why this exists**: on 2026-04-11, three cross-session `git add` races produced bundled commits (`713ea981c`, `4a1ba6f5c`, `63995b4ce`) where one orchestrator's files were swept into another orchestrator's commit under a wrong title. Worktrees eliminate the race because each session has its own git index. Full rationale: `.claude/rules/git-workflow.md` → "Worktrees — MANDATORY for Every File-Editing Dispatch".

**⚠️ Silent harness fallback (observed 2026-04-11, same day):** on at least one dispatch, the harness accepted `isolation: "worktree"` but silently fell back to shared `main` — no worktree created, no `WorktreeCreate` hook fired, and the sub-agent committed directly on main anyway. Two defences are now in place: (1) item 11 in the Sub-Agent Prompt Template forces a `git rev-parse --show-toplevel` self-check at task start that ABORTS if the agent is on main; (2) when the self-check aborts, the orchestrator retries via the **manual fallback procedure** that pre-creates the worktree via `scripts/setup-worktree.sh` and embeds the absolute `WT_PATH` in the next dispatch. Full procedure: `.claude/rules/git-workflow.md` → "Silent Harness Fallback — Manual Worktree Procedure".

**Quick decision table:**

| Agent type | `isolation: "worktree"`? |
|---|---|
| `game-logic`, `ui-agent`, `content-agent`, `qa-agent`, `docs-agent` | **YES — always** |
| `Explore`, `Plan`, `claude-code-guide`, `general-purpose` | No (read-only) |
| Orchestrator direct edits to `.claude/**`, `CLAUDE.md`, plans, memory | No (stays on `main`) |
| Orchestrator direct edits to `src/`, `data/`, `docs/`, `scripts/`, `public/`, `tests/` | **DELEGATE** to a domain agent with worktree |

## 🚨 Employee Mindset — First Principle

You are a senior employee of this studio. **Default to action, not interrogation. Only deliver finished work. Never defer findings. Document obsessively in the same commit. Think creatively about the player.**

Read these rules in order, every session — they are short by design:

1. **`.claude/rules/employee-mindset.md`** — Autonomy Ladder, Never Defer, Finished-Work Checklist, Clarification Bar, Keep Going, Player-Experience Lens, Creative Pass, What's Next. One file, the whole operating contract. Trivial tasks skip the Creative Pass / What's Next ceremony.
2. **`.claude/rules/human-prose.md`** — 🚨 HARDCORE: every player-visible string goes through `/humanizer` with `voice-sample.md` before commit. No exceptions. Hard failure if skipped.
3. **`.claude/rules/task-tracking.md`** — granular `TaskCreate` discipline; `TaskList` must be empty before commit.

If any other file appears to conflict with those three, those three win (except on Red-zone actions, where you ask the user).

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
npm run hooks:install    # One-time post-clone: point git at checked-in hooks/
```

## One-Time Post-Clone Setup
After cloning this repo, run `npm run hooks:install` once. It sets
`core.hooksPath=hooks` so git invokes the checked-in `hooks/pre-commit`
directly, eliminating the drift problem between the checked-in mirror and
the `.git/hooks/` live copy. Skip this and you'll run the old unversioned
hook. See `docs/gotchas.md` 2026-04-11 for the full story.

## Parallel Agent Isolation (Hybrid Worktree Mode)
When the orchestrator dispatches 2+ file-editing sub-agents simultaneously,
each gets `isolation: "worktree"` for true git isolation. Sequential
single-agent tasks work directly on `main`. The `WorktreeCreate` hook
auto-bootstraps worktrees (symlinks `node_modules`, etc.) via
`scripts/setup-worktree.sh`. After each agent returns, the orchestrator
merges via `scripts/merge-worktree.sh`. Pre-commit hooks run in full
blocking mode inside worktrees (no soft-warn needed — the tree is isolated).
Fallback: set `RR_MULTI_AGENT=1` to soft-warn if agents must share `main`.
See `.claude/rules/git-workflow.md` → "Worktrees — Automatic for Parallel Batches".

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
| `employee-mindset.md` | always | Autonomy Ladder, Never Defer, Finished-Work Checklist, Clarification Bar, Keep Going, PX Lens, Creative Pass, What's Next, Proactive Triggers, Two-Sided Enforcement — one consolidated contract |
| `human-prose.md` | always | 🚨 HARDCORE: every player-visible string through `/humanizer` with `voice-sample.md`; banned tells, same-commit, pre-commit lint + PostToolUse hook |
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
