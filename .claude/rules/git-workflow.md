# Git Workflow Rules

## Commit Messages

Format: `type: short description` (imperative mood, <72 chars)

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `style`

Examples:
- `feat: add color-blind mode toggle to settings`
- `fix: chain multiplier not resetting on encounter end`
- `docs: update combat mechanics after surge rework`

## Branching

- `main` — the default working branch. Edit directly on `main` unless a feature branch is explicitly requested.
- Feature branches: `feature/short-description` — only when the user asks for one or the work is genuinely long-lived
- Fix branches: `fix/short-description` — same: only on request

## Worktrees — Automatic for Parallel Batches

Worktree isolation is triggered by the orchestrator's dispatch pattern, not by a global flag.

- **Sequential dispatch** (one sub-agent at a time): work directly on `main`. No worktree overhead.
- **Parallel dispatch** (2+ file-editing sub-agents simultaneously): ALL parallel sub-agents get `isolation: "worktree"`. No exceptions. The orchestrator stays on `main`.
- **Read-only agents** (Explore, code review, validation with no edits): never need worktrees, even during parallel batches.

The `WorktreeCreate` hook in `settings.json` auto-bootstraps each worktree (symlinks `node_modules`, etc.) via `scripts/setup-worktree.sh`. After each worktree agent returns, the orchestrator merges via `scripts/merge-worktree.sh` and cleans up — no manual merge ceremony.

Rationale: the April 10 mandatory-worktree experiment failed because (1) merge-back was manual, (2) worktrees lacked `node_modules`, and (3) the mandate was all-or-nothing. The hybrid approach uses worktrees only when parallel isolation is needed, and automates the merge-back.

## Commit Discipline

- Commit after EVERY meaningful change — not batched, not "at the end"
- Docs, gotchas, memory updated IN THE SAME commit as code
- Pre-commit hook MUST pass (typecheck + build + tests)
- Never skip hooks with `--no-verify`

## Tags & Releases

- Tag releases: `git tag v1.0.0` at launch, `v1.1.0` for content updates
- Tags trigger Steam deployment pipeline
- Never delete or move tags after pushing

## Dangerous Operations

- NEVER force push to `main`
- NEVER `git reset --hard` without user confirmation
- NEVER `git checkout .` on uncommitted work without asking
- Prefer new commits over amending — amend only if user explicitly requests
