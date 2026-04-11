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

## Worktrees — MANDATORY for Every File-Editing Dispatch

**Every sub-agent that will edit files gets `isolation: "worktree"`. No exceptions, no sequential carve-out.** The previous hybrid policy (worktrees only for parallel batches) failed in practice because cross-session parallelism is invisible to any single orchestrator — two sessions both believing they were "sequential on main" produced at least two documented bundling races in one day (commits `713ea981c` and `4a1ba6f5c` on 2026-04-11, where parallel `git add -A` sweeps swept up unrelated work under wrong-titled commits).

### The policy

- **File-editing sub-agents**: ALWAYS pass `isolation: "worktree"`. Sequential dispatch and parallel dispatch are treated the same. The orchestrator never dispatches a file-editing agent on shared `main`.
- **Read-only sub-agents** (Explore, code review, search-only, research): never need worktrees. Dispatch directly without isolation.
- **Orchestrator** stays on `main` for coordination, planning, reading, and verification. The orchestrator may still edit `.claude/`, `CLAUDE.md`, plans, and memory on `main` directly — those files are orchestrator-only and don't have the cross-session bundling risk that `src/`, `data/`, `docs/`, `scripts/`, and `public/` have.

### How it works end-to-end

1. Orchestrator calls `Agent` with `isolation: "worktree"`.
2. Claude Code harness picks a new worktree path (e.g. `.claude/worktrees/agent-<id>`) and a one-time branch name (e.g. `agent-<id>`), then fires the `WorktreeCreate` hook with a JSON payload on stdin: `{ "branch_name": "...", "worktree_path": "...", "session_id": "...", ... }`.
3. `scripts/setup-worktree.sh` reads that JSON via `jq`, resolves the main checkout root via `git rev-parse --git-common-dir`, runs `git worktree add -B "$BRANCH_NAME" "$WORKTREE_PATH" HEAD` (idempotent — `-B` force-resets stale branch refs from aborted sessions), symlinks `node_modules` from the main checkout so the agent boots fast, and prints the worktree path to stdout.
4. The sub-agent runs entirely inside that worktree. It sees a clean tree with only its own changes — no cross-session dirty state, no other agent's staged files, no `git add -A` landmines.
5. When the sub-agent returns, the orchestrator runs `scripts/merge-worktree.sh <worktree-path> <branch-name> "<merge-message>"` which: checks `main..<branch>` for commits, switches to `main`, runs `git merge --no-ff <branch>` (preserves provenance in the graph), removes the worktree, and deletes the one-time branch. Empty-diff case is a no-op.
6. Conflict case: `merge-worktree.sh` exits 1, does NOT clean up the worktree, prints the conflicting files, and the orchestrator resolves manually.

### What this replaces

The April 10 mandatory-worktree experiment failed because (1) the merge-back was manual, (2) worktrees lacked `node_modules`, and (3) nothing parsed stdin — the hook expected env vars the harness didn't set and crashed on every invocation. All three are now fixed: merge-back is automated, `node_modules` symlinks on boot, and the hook parses stdin JSON as its primary contract (with env-var + CWD fallbacks for legacy harness versions). The experiment can now actually run.

### Silent Harness Fallback — Manual Worktree Procedure

**Observed 2026-04-11:** a ui-agent dispatched with `isolation: "worktree"` returned with `worktreePath: /Users/damion/CODE/Recall_Rogue, worktreeBranch: undefined` and committed directly on main. `.claude/worktrees/` and `.git/worktrees/` were both empty — no worktree was ever created. The harness accepted the parameter but did not honor it and did not fire the `WorktreeCreate` hook. Manual testing of `scripts/setup-worktree.sh` with a synthetic JSON payload from inside the repo works perfectly, so the scripts themselves are fine — the gap is in the harness layer.

No bundling race happened that time (a parallel session's commits touched disjoint files), but the isolation mandate was effectively bypassed and we only noticed because the sub-agent echoed its `worktreePath` field in its return. Until the harness behavior is confirmed reliable across sessions, **every file-editing dispatch must be defended two ways**:

1. **Item 11 in the sub-agent prompt template** runs a CWD self-check at task start and aborts on main. See `.claude/rules/agent-routing.md` → Sub-Agent Prompt Template.
2. **If the self-check fires, the orchestrator retries via the manual fallback below.**

### Manual fallback procedure

When Mode A (harness-native `isolation: "worktree"`) silently falls back, the orchestrator creates the worktree directly via `scripts/setup-worktree.sh` and embeds the absolute path in the next dispatch. Exact steps:

```bash
# 1. Pick a unique id and worktree path.
AGENT_ID="task-$(date +%s)"
WT_PATH="/tmp/rr-wt-${AGENT_ID}"

# 2. Create the worktree via the same script the harness would have called.
#    The script accepts the harness JSON payload on stdin.
echo "{\"branch_name\":\"agent-${AGENT_ID}\",\"worktree_path\":\"${WT_PATH}\",\"session_id\":\"orchestrator-manual\",\"hook_event_name\":\"WorktreeCreate\"}" \
  | scripts/setup-worktree.sh

# 3. Verify.
git -C "${WT_PATH}" rev-parse --abbrev-ref HEAD   # should print: agent-${AGENT_ID}
git worktree list                                  # should include ${WT_PATH}
```

Then dispatch the sub-agent **without** `isolation: "worktree"`, with the following injected into the prompt:

```
## Worktree context (manual fallback in effect)

You are running in a pre-created worktree at absolute path:
    WT_PATH=<paste the /tmp/rr-wt-... path>

The orchestrator-side manual fallback procedure is in effect because the
harness's `isolation: "worktree"` parameter silently fell back to main in
this session. Do NOT use the harness isolation parameter; the orchestrator
has already created the worktree for you.

Rules for every tool call in this task:
- First Bash call: `cd ${WT_PATH}` — stay there for the rest of the task.
- Every `git` command: pass `-C ${WT_PATH}` or run it after the `cd`.
- Every `Edit` / `Write` / `Read` file_path: absolute path under ${WT_PATH}/.
- `npm run typecheck`, `npm run build`, `npx vitest` — run from ${WT_PATH}.
- Worktree self-check (item 11 in the template): run `git rev-parse
  --show-toplevel` AFTER the `cd`. It MUST equal ${WT_PATH}. If it equals
  /Users/damion/CODE/Recall_Rogue, ABORT.
```

After the sub-agent returns:

```bash
# 4. Verify the commits actually landed in the worktree.
git -C "${WT_PATH}" log main..HEAD --oneline

# 5. Merge back to main. The script handles --no-ff, worktree removal, and
#    branch cleanup. Empty-commit case is a no-op.
scripts/merge-worktree.sh "${WT_PATH}" "agent-${AGENT_ID}" "<merge message>"
```

### When to use which mode

- **Default:** Try Mode A (pass `isolation: "worktree"`). The sub-agent's item 11 self-check tells you whether it worked.
- **If Mode A's self-check aborts:** switch to Mode B for the retry. Record the failure so the `end-of-turn-check.sh` hook can warn about it.
- **If you already know from an earlier dispatch in the same session that Mode A is broken**: skip Mode A, go straight to Mode B for the remaining dispatches in this session.

### Legacy `RR_MULTI_AGENT=1` soft-warn

Still supported as a last-resort escape hatch for scenarios where worktrees genuinely cannot be used (e.g. a manual `git rebase` workflow), but should never be used for normal sub-agent dispatch under this policy. If you find yourself reaching for it, flag it loudly and stop.

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
