---
description: End-of-session ritual — update gotchas, check doc drift, generate commit summary
---

Run this at the end of every productive session.

## 1. Gotchas Update
If any mistakes were made or non-obvious behaviors discovered during this session:
- Append to `docs/gotchas.md` in this format:

```
### YYYY-MM-DD — Brief Title
**What went wrong:** Description
**Why:** Root cause
**Fix:** How to avoid next time
```

## 2. Feature Progress
If working on an active plan:
- Check `docs/plans/` for current plan
- Update task status (completed/blocked/new tasks discovered)
- Note any blockers for the next session

## 3. Architecture Drift Check
If new files, services, or structural changes were made:
- Check if `docs/architecture/` sub-files need updating
- Check if `docs/INDEX.md` needs new entries
- Flag specific files that need docs-agent attention

## 4. Doc Staleness Quick Scan
- Run: `git diff --name-only HEAD~5` to see recently changed files
- For each changed source file, check if its corresponding doc sub-file was also updated
- Flag any source changes without doc updates

## 5. Commit Summary
Print a brief summary suitable for git commit message:

```
[feature/fix/refactor]: One-line summary

- Bullet list of specific changes
- Files modified
- Docs updated (or flagged as needing update)
```

Do NOT commit automatically — just print the summary for the user.

## 6. Push & Merge Check
- If on a feature branch: push to remote with `git push -u origin <branch>`
- **ASK THE USER:** "Should I merge this branch into main?" — they may forget about lingering branches/worktrees
- If yes: merge to main, delete the branch, clean up any worktree
- If not yet: print the branch name clearly so the user can find it later
- List any other active branches/worktrees that might be lingering: `git worktree list`

## 7. Worktree Cleanup
- Run `git worktree list` to check for lingering worktrees
- If any exist from previous sessions, flag them to the user:
  "These worktrees exist and may have unpushed work: [list]"
- The user decides whether to keep, merge, or delete them
