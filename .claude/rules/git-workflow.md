# Git Workflow Rules

## Commit Messages

Format: `type: short description` (imperative mood, <72 chars)

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `style`

Examples:
- `feat: add color-blind mode toggle to settings`
- `fix: chain multiplier not resetting on encounter end`
- `docs: update combat mechanics after surge rework`

## Branching

- `main` — always stable, always deployable to Steam `default` branch
- Feature branches: `feature/short-description` (e.g., `feature/accessibility`)
- Fix branches: `fix/short-description`
- Worktrees: use for parallel work, always push the branch, clean up when merged

## Commit Discipline

- Commit after EVERY meaningful change — not batched, not "at the end"
- Docs, gotchas, memory updated IN THE SAME commit as code
- Pre-commit hook MUST pass (typecheck + build + tests)
- Never skip hooks with `--no-verify`

## Worktree Hygiene

- Run `git worktree list` at natural breakpoints
- Flag orphaned worktrees to the user
- After merge: `git worktree remove <path>` + `git branch -d <branch>`
- Unpushed worktrees get lost if session ends — always push

## Tags & Releases

- Tag releases: `git tag v1.0.0` at launch, `v1.1.0` for content updates
- Tags trigger Steam deployment pipeline
- Never delete or move tags after pushing

## Dangerous Operations

- NEVER force push to `main`
- NEVER `git reset --hard` without user confirmation
- NEVER `git checkout .` on uncommitted work without asking
- Prefer new commits over amending — amend only if user explicitly requests
