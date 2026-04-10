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

## Worktrees — Not Used by Default

Worktrees are **not** required. Work directly in the primary checkout at `/Users/damion/CODE/Recall_Rogue` on `main`. Do not create worktrees proactively, do not pass `isolation: "worktree"` to `Agent` calls by default, and do not spawn sub-agents into isolated trees. Only use a worktree if the user explicitly asks for one (e.g. "do this in a worktree", "spin up a branch for this").

Rationale: the prior mandatory-worktree policy created more overhead than it prevented — hidden branches, forgotten merges, and end-of-task merge rituals that slowed every task down. Direct work on `main` with disciplined commits is the default.

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
