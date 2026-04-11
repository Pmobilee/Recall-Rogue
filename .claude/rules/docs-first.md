# Documentation-First

**Read docs BEFORE code. Update docs AND skills AFTER every change. In the same commit. No threshold.**

Docs and skills are part of the change, not a follow-up. A new CSS prop, a renamed function, a changed value, a removed field, a new Svelte component, a backend order swap — all get documented in the same commit. "It's just a tiny tweak" is never a valid excuse. "I'll do a docs pass after" is a banned phrase — by the time the follow-up lands, another agent has bundled it, another session has forgotten, or the drift is shipped.

## Before Any Change
1. Navigate via `docs/INDEX.md` to find the relevant sub-file.
2. Read it to understand current state and conventions.
3. If no doc covers your area, that's a gap — create the sub-file before writing the code.

## After Any Change
1. Update the relevant doc sub-file to reflect your change.
2. Include actual function names, values, and file paths.
3. If you found a doc contradiction, fix it AND append a gotcha entry.
4. If you touched a file, the docs for that file are part of your commit.

## Mandatory Pre-Commit Self-Check

**Before every `git commit` that includes non-trivial code changes, run the following mental pre-flight. Skipping it is a discipline failure, not a time-saver.**

1. **"What observable behavior did I change?"** — State it in one sentence. If nothing observable changed (pure internal refactor, test-only, lint infra, dev script), skip the rest.
2. **"Which `docs/` sub-files reference this behavior?"** — Grep `docs/` for the function / component / flag / type / subsystem name. Every match is a candidate for update. Common hit list: `docs/architecture/*.md`, `docs/mechanics/*.md`, `docs/ui/*.md`, `docs/roadmap/AR-*.md`, `docs/GAME_DESIGN.md`, `docs/INDEX.md`.
3. **"Which `.claude/skills/*/SKILL.md` references this subsystem?"** — Skill files carry status tables, phase tables, example code, and "last updated" snapshots that silently drift. Check the skill for the feature area (e.g. `multiplayer/`, `deck-master/`, `audio-manager/`, `content-pipeline/`, `inspect/`).
4. **"Is the status still accurate?"** — Phase tables, LOC counts, IN-PROGRESS markers, commit hashes in tables, code blocks with old identifiers. Update what's stale.
5. **"Did I discover a non-obvious lesson?"** — Append to `docs/gotchas.md` (append-only; never edit existing entries).
6. **Stage the doc/skill edits and include them in the SAME `git commit` invocation** as the code. Do not split into a follow-up commit.

**The "I'll do a docs pass after" failure mode:** It was observed on 2026-04-11 when `cc2e5b8bc` shipped the lobby-browser `pickBackend` order swap and `authStore.displayName` wiring as a code-only commit, leaving `.claude/skills/multiplayer/SKILL.md` with Phase 7-8 still marked IN-PROGRESS and `docs/architecture/multiplayer.md` with the old pickBackend cascade. A separate `6e3a91fb3 docs(multiplayer): sync` had to land afterward — extra history noise, extra review surface, and in multi-agent mode a real risk of cross-session bundling. **This rule is hardened to prevent repeats.**

**"Where needed, obviously":** Pure internal refactors, test-only edits, lint rules, CI infra, and config tweaks that preserve observable behavior are exempt. Everything else runs the pre-commit self-check.

## Doc Structure
Each sub-file under `docs/`:
- Covers ONE system or domain.
- Stays under ~200 lines.
- Has a purpose header listing source files it documents.
- Is independently useful.

## Persist Everything
Sessions can end abruptly. After every meaningful change: commit (with docs updated), don't batch, don't defer.

## Gotchas
When you discover non-obvious behavior or make a mistake, append to `docs/gotchas.md` immediately:
- Format: `### YYYY-MM-DD — Brief Title` followed by what / why / fix.
- **NEVER edit or remove existing entries** — append only.

## Full Workflow
For the docs-keeper culture, modular sub-file philosophy, and freshness rituals, see `.claude/skills/docs-keeper/`.
