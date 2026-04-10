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

## 🚨 MANDATORY WORKTREE ISOLATION — EVERY AGENT, EVERY TIME 🚨

**EVERY agent — the orchestrator AND every sub-agent it spawns — MUST do all work inside its OWN dedicated git worktree on its OWN dedicated branch. No agent ever edits files directly in `/Users/damion/CODE/Recall_Rogue` (the primary `main` checkout). No two agents ever share a worktree. No exceptions.**

### Why

Multiple agents operate in parallel. Sharing a working tree causes:
- Lost edits when agent A overwrites agent B's unstaged changes
- Corrupted builds when one agent is mid-`npm run build` while another edits source
- Merge conflicts discovered only at commit time, silently dropping work
- Cross-contamination where an agent "fixes" unrelated files it shouldn't touch
- Session-end data loss when the wrong branch is checked out at shutdown

Worktrees are free. Lost work is not.

### Orchestrator rules (applies to YOU, Claude, in the top-level session)

1. **On session start**, after `/catchup`, check `git worktree list`. If your current working directory is the `main` checkout (`/Users/damion/CODE/Recall_Rogue` on branch `main`), and the user asks for ANY change beyond a trivial read-only question, you MUST create a dedicated worktree before editing anything:
   ```bash
   git worktree add ../rr-<short-task-slug> -b <type>/<short-task-slug>
   cd ../rr-<short-task-slug>
   ```
2. Announce the worktree path and branch name to the user in one short line, then proceed.
3. All file edits, all sub-agent spawns, all builds, all tests happen inside that worktree.
4. If the task is genuinely trivial and read-only (answering a question, showing a file), you may skip the worktree — but the moment you need to edit, stop and create one first.

### Sub-agent rules (applies to EVERY Agent tool invocation)

1. **EVERY `Agent` tool call that will edit files MUST pass `isolation: "worktree"`.** This gives the sub-agent its own isolated git worktree automatically. No exceptions — not for "small" changes, not for "read-mostly" tasks, not for docs-only edits.
2. The sub-agent prompt MUST include this line verbatim near the top:
   > "You are running in an isolated git worktree. Do all work here. Do NOT `cd` out of this worktree. Do NOT touch sibling worktrees or the primary `main` checkout. Commit and push your branch before returning."
3. If you spawn multiple sub-agents in parallel, each gets its own `isolation: "worktree"` — they MUST NOT share.
4. Explore/research agents that only read files may omit `isolation: "worktree"` — read-only is safe.

### Branch naming

- Orchestrator worktree: `<type>/<task-slug>` (e.g. `feat/shop-rework`, `fix/chain-multiplier`)
- Sub-agent worktrees: auto-named by the harness when `isolation: "worktree"` is used
- Never reuse a branch name across agents in the same session

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

## 🚨 END-OF-TASK RITUAL — OBSESSIVE MERGE/COMMIT/PUSH REMINDER 🚨

**At the end of ANY task that produced changes in a worktree (yours or a sub-agent's), you MUST loudly, explicitly, unmistakably remind the user that the work is NOT YET IN MAIN.** Do not bury this. Do not assume the user remembers. Sessions end abruptly and worktrees are invisible to the user.

The final message of any change-producing task MUST include a block that looks exactly like this (fill in the real values):

```
⚠️  WORK IS IN A WORKTREE — NOT YET IN MAIN  ⚠️

Worktree : /Users/damion/CODE/rr-<slug>
Branch   : <type>/<slug>
Commits  : <N> committed, <pushed? yes/no>
Sub-agent worktrees: <list paths + branches, or "none">

NEXT STEPS YOU STILL HAVE TO DO (or ask me to do):
  1. Review the diff:        git -C ../rr-<slug> diff main
  2. Merge into main:         git checkout main && git merge <type>/<slug>
  3. Push main:               git push origin main
  4. Remove the worktree:     git worktree remove ../rr-<slug>
  5. Delete the branch:       git branch -d <type>/<slug>

I have NOT done any of the above automatically. Nothing is on main until you
(or I, on your explicit go-ahead) complete the merge + push.
```

Rules for this reminder:
- It is MANDATORY. Every task with file changes ends with this block. No exceptions.
- If multiple sub-agents each produced their own worktree, list EVERY one — none get dropped.
- Then, in plain prose, ASK THE USER: **"Do you want me to merge, commit, and push everything into `main` now?"** — always ask, never auto-merge.
- If commits were made but not pushed, say so explicitly — "committed locally, NOT pushed" — never let the user assume pushed state.
- If there are UNCOMMITTED changes in any worktree, that is a bug — commit them before showing the reminder.
- This reminder is not optional polish. It is the single most important defense against lost work.

## Tags & Releases

- Tag releases: `git tag v1.0.0` at launch, `v1.1.0` for content updates
- Tags trigger Steam deployment pipeline
- Never delete or move tags after pushing

## Dangerous Operations

- NEVER force push to `main`
- NEVER `git reset --hard` without user confirmation
- NEVER `git checkout .` on uncommitted work without asking
- Prefer new commits over amending — amend only if user explicitly requests
