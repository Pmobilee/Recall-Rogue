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

## Worktrees — Optional

Worktree isolation (`isolation: "worktree"`) is available but not required. Use it when you genuinely need git isolation (parallel agents editing overlapping files, risky refactors). For normal sequential work, sub-agents work directly on `main`.

Scripts `scripts/setup-worktree.sh` and `scripts/merge-worktree.sh` still work if needed.

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
