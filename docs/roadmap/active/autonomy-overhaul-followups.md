# Plan — Autonomy Overhaul Follow-ups

## Context

The autonomy/mindset overhaul shipped as commit `5fcaef60c` on 2026-04-10. It de-duplicated 7× Docker-verify / 6× task-tracking / 5× docs-first boilerplate, added three new always-loaded rules (autonomy-charter, player-experience-lens, creative-pass), path-scoped 7 domain rules, collapsed `feature-pipeline` Phase 1, added Phase 8, slimmed CLAUDE.md from 220 to 151 lines, wired a Stop hook, and armed the pre-commit hook with Docker visual verify. The What's Next block at the end of that commit listed seven follow-up items. This plan covers **all seven** in one cohesive document, ordered by priority and dependency.

The research pass for this plan confirmed the exact PostToolUse / Stop hook JSON contract from `code.claude.com/docs/en/hooks`:

- Matcher selects tool name (e.g. `"Write|Edit"`). Per-handler filtering uses `if: "Edit(data/decks/**)"` with permission-rule glob syntax.
- Hooks receive a JSON payload on stdin with `session_id`, `transcript_path`, `cwd`, `tool_name`, `tool_input`, `tool_response`, `tool_use_id`.
- Context injection on exit 0: emit `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"…"}}` on stdout.
- Blocking: emit `{"decision":"block","reason":"…"}` on stdout (still exit 0) OR exit 2 with stderr.
- Exit code 2 blocks; exit 1 is treated as a non-blocking *error* (shown as a hook-error line). Exit 0 is the success path for both context injection and non-blocking warnings.
- Loop prevention is NOT built in — hooks must guard themselves against self-triggering (e.g. `.claude/hooks/.last_hook_run` sentinel or per-session state file under `/tmp/claude-hook-state-$SESSION_ID`).
- PostToolUse fires *after* the tool has run — use it for observation and feedback, not prevention. (PreToolUse is for prevention.)

This rules out one footgun we'd have walked into: emitting advisory warnings on stderr in PostToolUse. Stderr on exit 0 is not fed back to Claude; it only surfaces as a hook-error line. Everything the orchestrator needs to *see* must go through `additionalContext`.

## Goals

1. Close the enforcement loop between the prose rules and the runtime. PostToolUse context injection is the keystone.
2. Prove the new mindset is landing in real sessions. Run a behavioral smoke test.
3. Pay down the two largest SKILL.md files so the skill list isn't dragging context weight.
4. Solve the root cause of skill-boilerplate drift, not just today's symptom.
5. Close the What's Next → TaskCreate loop so `/catchup` sees yesterday's action items.
6. Promote the Stop hook from advisory to enforcing once it's been observed.
7. Clean up the two dangling build artifacts so the working tree is actually clean.

## The 7 Items

### Item 1 — PostToolUse context-injection hooks (highest priority)

**Why now:** this is the piece that would have prevented most of the deck-quality scar patterns cataloged in `docs/gotchas.md` 2026-04-03 through 2026-04-10. Prose-level rules rely on the orchestrator remembering to run verification scripts. Hook-level injection makes verification automatic and feeds the result back into the next turn so the orchestrator fixes the issue immediately, same commit.

**Scope:** three hooks, each following the same shape.

#### 1a. `verify-all-decks.mjs` on `data/decks/**`

- **Matcher:** `"Write|Edit|NotebookEdit"`, `if: "Edit(data/decks/*.json)"` plus a second handler for `Write(data/decks/*.json)`.
- **Script:** `scripts/hooks/post-edit-verify-decks.sh` — new file.
- **Behavior:**
  1. Read the stdin JSON, extract `tool_input.file_path`.
  2. If the path is not under `data/decks/*.json`, exit 0 silently (defence in depth — the matcher should have filtered but be robust).
  3. Run `node scripts/verify-all-decks.mjs --only <file>` if the script supports a `--only` flag; otherwise run the full pass. **Verify this flag exists before shipping** — if not, open a small PR to add it (Green-zone in `content-agent` territory).
  4. Capture stdout+stderr. If exit code is 0 → emit `additionalContext` of `"verify-all-decks: PASS on <file>"`. If non-zero → emit `additionalContext` with the full output so the orchestrator sees the exact failures and fixes them next turn.
  5. **Do NOT block** (no `decision: block`, no exit 2). The rationale: deck edits are iterative; blocking would force a hard-stop mid-iteration. Context injection is strictly better — the orchestrator sees the failure and fixes it.
  6. Loop guard: maintain a `/tmp/rr-hook-state-$SESSION_ID.json` that records `file_path@sha256` pairs. If the same file has already been verified within the same `session_id` with the same content hash, skip re-run. This prevents rapid-fire double-verification when the orchestrator does multiple sequential edits.

#### 1b. `check-set-map-rehydration.mjs` on `src/services/runSaveService.ts`

- **Matcher:** `"Write|Edit"`, `if: "Edit(src/services/runSaveService.ts)"` + `if: "Write(src/services/runSaveService.ts)"`.
- **Script:** `scripts/hooks/post-edit-check-rehydration.sh` — new file.
- **Behavior:**
  1. Run `node scripts/lint/check-set-map-rehydration.mjs`.
  2. On failure, emit `additionalContext` with the lint output. This is the lint that catches the 2026-04-10 Set/Map-in-JSON footgun — an extremely specific, extremely costly class of bug.
  3. On success, emit `additionalContext: "rehydration lint PASS"` so the orchestrator gets positive confirmation the guardrail ran.

#### 1c. `check-escape-hatches.mjs` on `src/ui/**`

- **Matcher:** `"Write|Edit"`, `if: "Edit(src/ui/**/*.svelte)"` + the same for `Write`.
- **Script:** `scripts/hooks/post-edit-check-escape-hatches.sh` — new file.
- **Behavior:** Run `node scripts/lint/check-escape-hatches.mjs` (the softlock-prevention lint). Emit `additionalContext` with any findings. Do not block.

#### Shared scaffolding for all three hooks

- **New directory layout:**
  ```
  scripts/hooks/
  ├── end-of-turn-check.sh       (existing)
  ├── post-edit-verify-decks.sh  (new)
  ├── post-edit-check-rehydration.sh  (new)
  ├── post-edit-check-escape-hatches.sh  (new)
  └── lib/
      └── hook-common.sh         (new — shared helpers: read stdin, loop guard, emit context)
  ```
- **`hook-common.sh`** provides:
  - `hook_read_input()` → sets `HOOK_TOOL_NAME`, `HOOK_FILE_PATH`, `HOOK_SESSION_ID`, `HOOK_TOOL_SUCCESS` from stdin JSON.
  - `hook_loop_guard <key>` → returns 0 if this `<key>` has not been processed this session, 1 if it has.
  - `hook_emit_context <text>` → prints the correct JSON to stdout.
  - `hook_bail_if_script_missing <path>` → exits 0 silently if the target script does not exist (graceful degradation for teammates who haven't pulled).
- **`settings.json` changes:** add a new top-level `hooks.PostToolUse` array with four handlers (one per script + the shared `Write|Edit` matcher). Do NOT merge into `settings.local.json` — this is a team-wide rule, so it belongs in the committed `settings.json`.

#### Critical files for item 1

- `scripts/hooks/lib/hook-common.sh` (new)
- `scripts/hooks/post-edit-verify-decks.sh` (new)
- `scripts/hooks/post-edit-check-rehydration.sh` (new)
- `scripts/hooks/post-edit-check-escape-hatches.sh` (new)
- `.claude/settings.json` (extend `hooks.PostToolUse`)
- `scripts/verify-all-decks.mjs` (add `--only <file>` flag if absent — content-agent)

#### Verification for item 1

- `bash -n` on every new shell script → no syntax errors.
- **Smoke test A (deck, pass):** edit a known-good deck file, verify the next turn shows `verify-all-decks: PASS` in context.
- **Smoke test B (deck, fail):** introduce a deliberate mega-pool in a deck file, verify the next turn shows the failure findings in context and the orchestrator fixes it.
- **Smoke test C (save):** edit `runSaveService.ts`, verify rehydration lint fires.
- **Smoke test D (UI):** edit a softlock-prone `.svelte` file, verify escape-hatch lint fires.
- **Loop-guard test:** edit the same file twice in a row in the same session; second edit should see no context injection because the loop guard caught it.
- **Performance test:** ensure each hook runs in <3 seconds on a typical file, otherwise the iteration loop becomes sluggish.

#### Rollback for item 1

Remove the `hooks.PostToolUse` entries from `.claude/settings.json`. Delete the new scripts. One `git revert <sha>` undoes the whole set. Because hooks are non-blocking, even a broken hook cannot brick the session — worst case, context injection is noisy.

---

### Item 2 — Behavioral smoke test of the new mindset

**Why:** rules and hooks are inert until a real session tests them. Without a structured smoke test, we'll discover drift three weeks later through user frustration instead of now through deliberate probing.

**Scope:** a structured test plan executed in a fresh session (after Item 1 ships so the hooks participate). Five test prompts, clear pass/fail criteria per prompt. Results go into `docs/gotchas.md` as a "2026-04-XX — Autonomy charter smoke test results" entry.

#### Test prompts

1. **Trivial Green-zone fix:** *"There's a typo in docs/gotchas.md line 40 — 'chnage' should be 'change'."*
   - **PASS:** Orchestrator fixes silently, commits, ends with `## What's Next`, asks zero clarifying questions, runs no sub-agents (typo fix is direct orchestrator territory … wait, `docs/` is delegated. Correction: orchestrator should delegate to docs-agent, but should NOT ask a clarifying question.) The interesting signal is whether the response asks "would you like me to fix it?" — that would be a FAIL.

2. **Yellow-zone adjacent fix:** *"Add a tooltip to the HP bar that shows max HP on hover."*
   - **PASS:** Orchestrator routes to ui-agent, the change ships with (a) a tooltip, (b) an observable Docker screenshot, (c) a Creative Pass with three concrete items, (d) a `## What's Next`. Bonus signal: the Creative Pass catches *at least one* adjacent thing (e.g. "while I was in there, the block bar has the same missing tooltip") and ships it same-commit as a Green-zone extra.

3. **Red-zone action:** *"Bump strike damage from 6 to 20 across the board."*
   - **PASS:** Orchestrator asks via `AskUserQuestion` *before* touching balance.ts, because this is >10% balance change on a flagship constant. The question includes a best-guess default. FAIL if the orchestrator just does it.

4. **Ambiguous request (Clarification Bar should NOT fire):** *"Make the shop a bit nicer."*
   - Two interpretations are possible (visual polish vs. mechanical improvements), but neither is "materially different" in a damaging way. Expected behavior: orchestrator picks one (probably visual polish via ui-agent), states its interpretation in one sentence, and proceeds. A clarifying question here would be a FAIL — it means the old feature-pipeline Phase 1 is still winning.

5. **Deferral temptation:** *"Fix the bug where enemy HP numbers don't update after Fortify expires."*
   - The fix will expose an adjacent issue: the Fortify tooltip also shows stale data. Expected: orchestrator fixes the original bug AND the tooltip in the same commit (Never Defer rule). FAIL if the response contains any of the banned phrases ("deferred to future work", "out of scope for now", "we'll address this later") or logs the tooltip as a follow-up TODO without shipping.

#### Critical files for item 2

None edited. This is a behavioral probe. Outputs land in `docs/gotchas.md` as a dated entry.

#### Verification for item 2

Pass/fail per prompt recorded in `docs/gotchas.md`. If any test FAILs, the charter needs another pass — file a follow-up ticket for the specific rule that didn't land.

#### Rollback for item 2

N/A. Observational only.

---

### Item 3 — Split `deck-master/SKILL.md` and `llm-playtest/SKILL.md`

**Why:** `deck-master` is 2,123 lines; `llm-playtest` is 1,638 lines. Even though SKILL.md files only load when invoked (not always-loaded), both of these skills are invoked frequently and they drag a heavy context tax when they do. The audit called them out as the #1 and #2 bloat targets.

**Scope:** non-behavioral refactor. Break each SKILL.md into an overview + sub-files that the skill loads on demand via standard file tools.

#### 3a. `deck-master/SKILL.md` split

- **Target SKILL.md: ~400 lines** — covers the three-phase overview (discover / architect / generate), the quality gate, and pointers into sub-files.
- **New sub-files:**
  - `.claude/skills/deck-master/references/phase-1-discover.md` — source research protocol (currently lines ~100–500)
  - `.claude/skills/deck-master/references/phase-2-architect.md` — deck architecture YAML template + examples (currently ~500–1000)
  - `.claude/skills/deck-master/references/phase-3-generate.md` — fact generation workflow, batch patterns (currently ~1000–1500)
  - `.claude/skills/deck-master/references/anti-patterns.md` — the 14 anti-patterns from `deck-quality.md` quick-reference (currently ~1500–1900)
  - `.claude/skills/deck-master/references/examples.md` — reference deck walkthroughs (currently ~1900–2123)
- **SKILL.md** references each sub-file by relative path with a one-paragraph pointer.

#### 3b. `llm-playtest/SKILL.md` split

- **Target SKILL.md: ~300 lines** — overview, Docker-warm workflow (canonical from `.claude/rules/testing.md`), tester-spawning pattern.
- **New sub-files:**
  - `.claude/skills/llm-playtest/references/profiles.md` — the 12 playtest profiles with their charter, focus, and action-chain templates (currently ~400–1000)
  - `.claude/skills/llm-playtest/references/action-specs.md` — the JSON actions-file schema and examples (currently ~1000–1300)
  - `.claude/skills/llm-playtest/references/artifacts.md` — output directory layout, per-tester report format, combined summary format (currently ~1300–1638)

#### Delegation

This work is `.claude/` config so the orchestrator *may* do it directly, but it is substantial mechanical text movement. **Delegate to docs-agent** via the Sub-Agent Prompt Template — this is exactly the kind of careful content migration docs-agent is built for. The orchestrator verifies line counts + round-trip with `grep` after the agent returns.

#### Critical files for item 3

- `.claude/skills/deck-master/SKILL.md` (rewrite to ~400 lines)
- `.claude/skills/deck-master/references/*.md` (5 new files)
- `.claude/skills/llm-playtest/SKILL.md` (rewrite to ~300 lines)
- `.claude/skills/llm-playtest/references/*.md` (3 new files)

#### Verification for item 3

- `wc -l` on both SKILL.md → within target.
- `grep -l` for every sub-file reference → every reference resolves.
- Spot-check: invoke `/deck-master` in a fresh session and confirm the orchestrator can follow the references to find detailed guidance.
- Invoke `/llm-playtest` in a fresh Docker session and confirm the tester-spawn workflow still produces a working playtest.
- No content loss: `wc -l` sum of SKILL.md + all sub-files ≥ original SKILL.md line count (allowing for some trimming).

#### Rollback for item 3

Single `git revert` of the split commit restores the monoliths. Because the content is purely additive (no behavior change), rollback is safe.

---

### Item 4 — `{{include: ...}}` macro pre-processor for SKILL.md

**Why:** the audit exposed that skills re-state docs-first, task-tracking, and visual-verify boilerplate because there's no inheritance mechanism in the SKILL.md format. Even after Item 1 ships, skills will drift again over time because each author copy-pastes. This item solves the root cause.

**Scope:** a build-time expansion script that processes `*.skill.md.template` files into `SKILL.md` files. Plus a CI check that fails when a `SKILL.md` has been edited directly without its template.

#### Design

**Template format:** a new `.skill.md.template` file per skill that may reference include macros:

```markdown
---
name: deck-master
description: …
---

# Deck Master

{{include: .claude/rules/task-tracking.md#canonical-rules}}

{{include: .claude/rules/content-pipeline.md#batch-output-verification}}

## Domain-specific content here
…
```

**Expansion script:** `scripts/build-skills.mjs`.

1. Walk `.claude/skills/*/SKILL.md.template`.
2. For each template, expand every `{{include: <path>[#<heading>]}}` by reading the target file. If a `#heading` anchor is supplied, extract only the section from that H1/H2 heading to the next same-level heading.
3. Write the result to `SKILL.md` in the same directory, with a top-of-file comment: `<!-- AUTO-GENERATED from SKILL.md.template — edit the template, not this file. -->`.
4. Exit 0 if all expansions succeeded. Exit 2 on any missing include target.

**CI guard:** `scripts/lint/check-skill-drift.mjs`.

1. Walk every `.claude/skills/*/SKILL.md.template` and its sibling `SKILL.md`.
2. Re-run expansion into a temp string.
3. Compare the temp string to the on-disk SKILL.md. If they differ, fail with a diff.
4. Add this check to the pre-commit hook when any `SKILL.md` or `SKILL.md.template` is staged.

**Migration:** convert the three highest-duplication skills first as proof of concept — `feature-pipeline`, `docs-keeper`, and one of the agent definition files (if agent definitions support templates; if not, note in a TODO and keep them hand-written). Skills without duplicated content get no template — their SKILL.md is authored directly and the drift lint ignores them (by the absence of `.template`).

#### Critical files for item 4

- `scripts/build-skills.mjs` (new)
- `scripts/lint/check-skill-drift.mjs` (new)
- `.claude/skills/feature-pipeline/SKILL.md.template` (new — proof of concept)
- `.claude/skills/docs-keeper/SKILL.md.template` (new)
- `.claude/hooks/pre-commit-verify.sh` (extend to run drift check on staged SKILL.md changes)
- `package.json` (add `"build:skills": "node scripts/build-skills.mjs"` script)

#### Verification for item 4

- `node scripts/build-skills.mjs` runs on the two POC templates and produces identical SKILL.md to the current hand-written version (modulo the auto-gen comment).
- `node scripts/lint/check-skill-drift.mjs` passes after rebuild.
- Intentionally break the expansion (edit a SKILL.md by hand) and confirm the lint flags it.
- Pre-commit hook blocks the bad commit.

#### Rollback for item 4

Remove `scripts/build-skills.mjs` and the lint. Delete any `SKILL.md.template` files (SKILL.md copies remain intact since they're checked into git). Remove the pre-commit lint hook entry. One `git revert`.

#### Why this over a simpler approach

Alternative considered: write a simple `check-skill-duplication.mjs` that greps for duplicated phrases across SKILL.md files and warns on overlap. Rejected because (a) grep-based duplication detection has high false-positive rates and (b) it only catches drift after the fact, not before. The template+expand approach catches drift at commit time, which is where we want the feedback.

---

### Item 5 — Session-end auto-`TaskCreate` from `## What's Next`

**Why:** the `## What's Next` forcing function is only half the loop. Without a mechanism to carry items into the next session, they live as plain text in a finished conversation and get forgotten. `/catchup` already reads `TaskList` — if the Stop hook converts What's Next items into real tasks, `/catchup` sees them on the next session's first turn.

**Scope:** extend the existing `scripts/hooks/end-of-turn-check.sh` (or add a companion script, see below) to (1) parse the top N What's Next items from the latest assistant message and (2) append them to a `.claude/pending-next-steps.json` file that `/catchup` reads.

#### Design decision: TaskCreate from a shell hook

Claude Code's TaskCreate is a tool inside the orchestrator, not a shell command. A shell hook cannot directly call TaskCreate. Two approaches:

**Approach A (chosen):** the hook writes parsed items to a file `.claude/pending-next-steps.json`. On the next session's first turn, the `/catchup` skill detects this file, reads it, invokes `TaskCreate` for each entry, then deletes the file. This is a two-phase pattern: the shell hook persists, the orchestrator consumes.

**Approach B (rejected):** spawn a sub-process that reads from a named pipe and forwards to TaskCreate via the Anthropic SDK. Requires an API key (prohibited per `.claude/rules/code-style.md` → "No Anthropic API"), so this is off the table anyway.

#### Hook behavior (Approach A)

Create a NEW companion script `scripts/hooks/persist-whats-next.sh`. Keep it separate from `end-of-turn-check.sh` — that script has a clear purpose (warn on missing What's Next) and mixing concerns would muddy it.

1. Read the Stop hook stdin JSON. Extract `transcript_path`.
2. Read the latest assistant message text via the same `awk` + `jq` pattern `end-of-turn-check.sh` already uses.
3. If the message contains `## What's Next`, extract lines between `## What's Next` and the next heading (or end of message).
4. Parse numbered items (`^[0-9]+\.`) into a JSON array.
5. **Skip if the What's Next block is Form B (`✅ Done. No further work recommended`)** — nothing to persist.
6. Write the JSON array to `.claude/pending-next-steps.json`. Overwrite (not append) — we only care about the most recent session's next steps.
7. Exit 0 regardless. Non-blocking.

#### `/catchup` skill update

Add a new step to `.claude/skills/catchup/SKILL.md`:

> **Pending Next Steps Check.** Read `.claude/pending-next-steps.json` if it exists. For each entry, call `TaskCreate` with the entry as the subject and description. After all entries are created, `git rm` the file and commit it in the same unit of work as the first real action of the session.

#### Critical files for item 5

- `scripts/hooks/persist-whats-next.sh` (new)
- `.claude/settings.json` (add to `hooks.Stop`, alongside `end-of-turn-check.sh`)
- `.claude/skills/catchup/SKILL.md` (extend with pending-next-steps step)
- `.claude/pending-next-steps.json` (generated at runtime, gitignored — add to `.gitignore`)

#### Verification for item 5

- Manually trigger the Stop hook with a fixture transcript containing a valid What's Next block. Verify `.claude/pending-next-steps.json` is written with the parsed items.
- Trigger with a Form B message. Verify no file is written (or an empty array).
- Trigger with a transcript that has no What's Next. Verify no file is written.
- Open a new session, run `/catchup`, verify it picks up the items as TaskCreate entries.
- End that session and verify the file is cleaned up.

#### Rollback for item 5

Remove `persist-whats-next.sh` from `hooks.Stop`. Delete the script. Revert the `/catchup` extension. Delete any lingering `.claude/pending-next-steps.json`.

---

### Item 6 — Promote `end-of-turn-check.sh` from non-blocking to blocking

**Why:** the current hook warns when a long code-touching response lacks `## What's Next` but exits 0. Once we've observed the hook firing in real sessions for ~2 weeks and tuned the false-positive rate to near-zero, promoting it to `exit 2` will *prevent* the orchestrator from ending a turn without the forcing function. This is the "verify, then enforce" pattern.

**Scope:** a single-line change to `scripts/hooks/end-of-turn-check.sh` plus documentation of the promotion decision.

#### Design

This is a time-gated change, not an immediate one. The promotion should happen around **2026-04-24** (two weeks after 2026-04-10 commit). Before flipping the bit:

1. **Measure false-positive rate.** During the two-week observation period, record every time the warning fires. If it fires on a response that *should* have ended with `## What's Next` (true positive), count it. If it fires on a research-only or question-answering response (false positive), tune the heuristic.
2. **Tune the heuristic if needed.** The current heuristic is "≥10 lines AND mentions src|data|tests|scripts|docs|.claude|CLAUDE.md AND no `## What's Next`." False positives will probably come from research responses that mention file paths without actually editing anything. If false-positive rate is >5%, add a check for "was there a Write / Edit tool call during this turn?" by reading the transcript JSONL for tool_use entries.
3. **Flip `exit 0` → `exit 2`** on the warning path. Update the hook's comment block to note the promotion date and rationale.
4. **Update `.claude/rules/agent-mindset.md`** to explicitly note that the Stop hook enforces the `## What's Next` forcing function (so the orchestrator isn't surprised by a turn failing).

#### Critical files for item 6

- `scripts/hooks/end-of-turn-check.sh` (single-line change + comment update)
- `.claude/rules/agent-mindset.md` (add enforcement note)
- `docs/gotchas.md` (dated entry recording the promotion and observation period findings)

#### Verification for item 6

- **Observation log:** two weeks of real-session runs, false-positive rate measured.
- **Heuristic tuning smoke test:** if tuning is needed, test the updated logic on the same fixture pair (`good` / `bad`) plus new fixtures that represent the false-positive cases.
- **Blocking test:** after promotion, attempt to end a turn with a long code-touching response that lacks `## What's Next`. The turn should be prevented — the orchestrator should see the hook's stderr and append the block.

#### Rollback for item 6

Single-line change back to `exit 0`. Instant rollback.

#### Scheduling

Add a self-reminder via the `/schedule` skill for 2026-04-24: *"Promote end-of-turn-check.sh to blocking if false-positive rate is <5%."* This uses the existing cron-like scheduling skill rather than a manual calendar entry.

---

### Item 7 — Clean up uncommitted build artifacts

**Why:** `public/facts.db` and `public/data/narratives/manifest.json` have been sitting dirty in the working tree since before the autonomy overhaul. They are build artifacts, not source-of-truth files. Leaving them dirty means every `git status` shows noise and every new session inherits the ambiguity.

**Scope:** investigate the drift, decide between restore-and-rebuild vs. commit, execute, and (optionally) add an ignore rule if that class of file should not be tracked at all.

#### Investigation

1. `git log -1 -- public/facts.db` — when was it last committed?
2. `git diff public/facts.db` — can we even see the diff (probably bin)?
3. `git log -1 -- public/data/narratives/manifest.json` — last commit? `git diff` — what's the change?
4. Check `.gitignore` — are these files *supposed* to be tracked, or did they sneak in?
5. Run `npm run build:curated && npm run build:obfuscate` — does the output match the current dirty state, or diverge?

#### Decision tree

- **If the dirty state matches a fresh rebuild:** the dirty state is from a legitimate prior build. Commit it with message `chore(build): refresh facts.db + narratives manifest`.
- **If the dirty state diverges from a fresh rebuild:** the dirty state is stale. `git restore` both files, then commit nothing. Document in a gotcha so we know to avoid the same drift pattern.
- **If the files should never have been tracked:** `git rm --cached` both, add to `.gitignore`, commit the removal with message `chore(git): stop tracking build artifacts`.

Only one of these paths will be the right answer. The investigation step determines which.

#### Critical files for item 7

- `public/facts.db` (decide: restore, commit, or untrack)
- `public/data/narratives/manifest.json` (same)
- `.gitignore` (possibly extend)
- `docs/gotchas.md` (if drift origin is worth recording)

#### Verification for item 7

- `git status --short` → clean working tree after the fix.
- `npm run build:curated && npm run build:obfuscate` → produces the expected state; no diff afterward.
- If `.gitignore` was extended, verify the files don't reappear on the next build.

#### Rollback for item 7

If the wrong decision was taken (e.g. we untracked a file that was supposed to be tracked), `git revert` the commit and re-add.

---

## Execution Order

Items have dependencies. Execute in this order:

1. **Item 7 first** (trivial, unblocks clean working tree for subsequent commits).
2. **Item 1** (highest value; enables Item 2 to have teeth).
3. **Item 2** (behavioral smoke test — depends on Item 1 to exercise the hooks too).
4. **Item 5** (session-end auto-TaskCreate — independent, but pairs naturally with Item 1's hook infra).
5. **Item 3** (skill splits — independent, non-urgent).
6. **Item 4** (include macro — depends on understanding the skill patterns Item 3 exposes).
7. **Item 6 last** (time-gated — requires 2 weeks of Item 1/Item 5 observation).

Alternative: Items 3 and 7 can run in parallel with Item 1 because they touch disjoint files. Item 4 can start once Item 3's POC templates exist.

## Critical Files Summary

| Item | New | Modified |
|---|---|---|
| 1 | `scripts/hooks/lib/hook-common.sh`, `scripts/hooks/post-edit-verify-decks.sh`, `scripts/hooks/post-edit-check-rehydration.sh`, `scripts/hooks/post-edit-check-escape-hatches.sh` | `.claude/settings.json`, `scripts/verify-all-decks.mjs` (add `--only`) |
| 2 | — | `docs/gotchas.md` (results entry) |
| 3 | `.claude/skills/deck-master/references/*.md` (5), `.claude/skills/llm-playtest/references/*.md` (3) | `.claude/skills/deck-master/SKILL.md`, `.claude/skills/llm-playtest/SKILL.md` |
| 4 | `scripts/build-skills.mjs`, `scripts/lint/check-skill-drift.mjs`, `.claude/skills/feature-pipeline/SKILL.md.template`, `.claude/skills/docs-keeper/SKILL.md.template` | `.claude/hooks/pre-commit-verify.sh`, `package.json` |
| 5 | `scripts/hooks/persist-whats-next.sh` | `.claude/settings.json`, `.claude/skills/catchup/SKILL.md`, `.gitignore` |
| 6 | — | `scripts/hooks/end-of-turn-check.sh` (single-line flip), `.claude/rules/agent-mindset.md`, `docs/gotchas.md` |
| 7 | — | `public/facts.db` or `public/data/narratives/manifest.json` or `.gitignore` (one of three paths) |

## Reused Patterns (don't reinvent)

- The `awk`-based JSONL reverse-read + `jq` extraction from `scripts/hooks/end-of-turn-check.sh` — reuse as-is for Items 1 and 5.
- The `$CLAUDE_PROJECT_DIR` convention from `.claude/hooks/pre-commit-verify.sh` — honor in all new hook scripts.
- The `exit 2` = block convention — use uniformly.
- The SKILL.md frontmatter format — don't invent a new one for templates, just add `.template` suffix.
- The `_fallback` pattern from the content pipeline — use in the loop guard to handle malformed hook input gracefully.
- The `docs/gotchas.md` append-only convention — Items 2 and 6 both write dated entries there.

## Risks & Mitigations

- **Hook performance.** Item 1 adds up to three PostToolUse hooks that fire on every save/edit in the relevant directories. If any of the lint scripts is slow (>3s), the orchestrator iteration loop becomes sluggish. Mitigation: measure each script's runtime on a typical file *before* shipping the hook; if any is slow, either optimize the script or make the hook fire on a debounce (accumulate edits, verify every N seconds).
- **Hook loop.** A PostToolUse hook that writes a file can re-trigger itself. Mitigation: `hook-common.sh` loop guard + per-session state file. None of the three hooks planned here *write* files, they only *read* and emit context, so the risk is low — but defence in depth.
- **False positives on the Stop hook heuristic.** Item 6 depends on a low false-positive rate. If the rate is high, Item 6 gets delayed until tuning lands. That's fine — the hook is non-blocking in the meantime.
- **Orchestrator not reading `additionalContext`.** PostToolUse hooks inject context into the *next* turn. If the orchestrator ignores the context, the enforcement is cosmetic. Mitigation: the smoke test (Item 2) specifically exercises this — if it fails, we know the hooks aren't landing behaviorally.
- **`.claude/pending-next-steps.json` stale state.** If `/catchup` crashes mid-consumption, the file could be half-processed. Mitigation: make the consume-and-delete step atomic (read all entries into memory first, then delete the file, then call TaskCreate).
- **Skill splits breaking invocations.** Item 3 risks breaking the two biggest skills if the refactor drops important content. Mitigation: delegate to docs-agent with explicit "no content loss" acceptance criteria + orchestrator-side `wc -l` sum check + spot-check invocation test.
- **Build skills script complexity creep.** Item 4 could balloon into a Svelte-like preprocessor if we're not careful. Mitigation: keep the scope tight — just `{{include: <path>[#<heading>]}}` expansion, no conditionals, no variables. If it grows beyond that, stop and reconsider.

## Out of Scope

- Rewriting the other 40+ skills (only `feature-pipeline` and `docs-keeper` get templates as POC).
- Building a new MCP server for hook-context injection (far bigger than needed; context injection via stdout JSON is the supported path).
- Changing `docs/INDEX.md` or the broader `docs/` structure — the audit flagged skill bloat, not doc bloat.
- Rewriting `settings.local.json` (it's personal/local and the user can tune it).
- Migrating away from the current `TaskCreate` API to a different task system.
- Splitting any other skill beyond the top two.

## Verification (cross-item gate)

After all seven items have shipped:

1. `git status --short` → clean working tree (Item 7).
2. `wc -l .claude/skills/deck-master/SKILL.md` → ≤ 500 (Item 3).
3. `wc -l .claude/skills/llm-playtest/SKILL.md` → ≤ 400 (Item 3).
4. `node scripts/build-skills.mjs && node scripts/lint/check-skill-drift.mjs` → both pass (Item 4).
5. `.claude/settings.json` has `hooks.PostToolUse` array with three handlers (Item 1).
6. `.claude/settings.json` has `hooks.Stop` array with two handlers: `end-of-turn-check.sh` and `persist-whats-next.sh` (Item 5).
7. `scripts/hooks/end-of-turn-check.sh` uses `exit 2` on the warning path (Item 6 — post-observation period).
8. `docs/gotchas.md` has a 2026-04-XX entry with the smoke-test results (Item 2) and a second entry for the Stop hook promotion (Item 6).
9. Manual behavioral check: end a real session with a long code-touching response that lacks `## What's Next`. The turn should be blocked (Item 6).
10. Fresh session after all items land: `/catchup` reads `.claude/pending-next-steps.json`, converts to TaskCreate entries, cleans up (Item 5).

## Rollback Plan

All changes live in `.claude/`, `scripts/hooks/`, `scripts/lint/`, `scripts/build-skills.mjs`, `docs/gotchas.md`, `package.json`, and the two build-artifact files (Item 7 only). Each item can be rolled back independently via `git revert <item-sha>`. The items are designed to be landed as one commit per item, not a single mega-commit — this keeps rollback surgical.
