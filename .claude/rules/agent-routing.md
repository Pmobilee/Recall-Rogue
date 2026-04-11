# Agent Routing

## Orchestrator vs Sub-Agent Edit Rights

The orchestrator edits **configuration and coordination files** directly. Everything else is delegated to a named domain agent.

**Orchestrator may edit directly:**
- `.claude/` — rules, agents, hooks, settings, skills
- `CLAUDE.md` and `CLAUDE.local.md`
- Plan files under `~/.claude-muldamion/plans/`
- Memory files under `~/.claude-muldamion/projects/*/memory/`

**Orchestrator MUST delegate to a domain agent:**
- `src/` — game code, services, UI, data
- `tests/` — test files
- `data/` — decks, corpora, playtests
- `docs/` — all documentation
- `scripts/` — build, lint, content pipeline
- `public/` — shipped assets and DBs

**Exception for mechanical data transforms after sub-agent failure.** If a sub-agent has demonstrably failed on a pure-data transform (verified via `git status` / `git diff`), the orchestrator may take direct action instead of re-delegating. Log the incident in `docs/gotchas.md`. This is rare and should never be a first resort.

## Research Phase Ownership

- **Orchestrator:** reads docs, explores codebase, designs approach, creates plans, coordinates agents, verifies sub-agent output against ground truth.
- **Sub-agents:** implement changes, update domain docs, run domain verification.

The orchestrator does NOT write game code — but DOES do all pre-implementation research.

## Routing Table

| File Path | Agent | Definition |
|---|---|---|
| `src/game/**`, `src/game/shaders/**`, `src/game/systems/**` | game-logic | `.claude/agents/game-logic.md` |
| `src/services/**`, `src/data/**` | game-logic | `.claude/agents/game-logic.md` |
| `src/main.ts`, `src/csp.ts` | game-logic | `.claude/agents/game-logic.md` |
| `src/events/**`, `src/types/**`, `src/utils/**` | game-logic | `.claude/agents/game-logic.md` |
| `src/i18n/index.ts`, `src/i18n/formatters.ts` | game-logic | `.claude/agents/game-logic.md` |
| `src/assets/**` | game-logic | `.claude/agents/game-logic.md` |
| `src/ui/**` (components, stores, styles, utils, effects) | ui-agent | `.claude/agents/ui-agent.md` |
| `src/CardApp.svelte`, `src/stores/**` | ui-agent | `.claude/agents/ui-agent.md` |
| `data/decks/**`, `facts.db`, `data/curated/**` | content-agent | `.claude/agents/content-agent.md` |
| `src/data/chainThemes/**`, `src/data/domainMetadata.ts` | content-agent | `.claude/agents/content-agent.md` |
| `src/i18n/locales/**` (translation content) | content-agent | `.claude/agents/content-agent.md` |
| `tests/**`, `src/dev/**` | qa-agent | `.claude/agents/qa-agent.md` |
| `scripts/lint/**` | qa-agent | `.claude/agents/qa-agent.md` |
| `docs/gotchas.md` | qa-agent (primary writer) | `.claude/agents/qa-agent.md` |
| `docs/**` (all other docs) | docs-agent | `.claude/agents/docs-agent.md` |
| `src/_archived/**` | — ignored, do not edit | — |

## Routing Procedure

1. **Identify files** the task will edit.
2. **Match to agent** via the routing table.
3. **Read the agent definition** (`.claude/agents/{agent}.md`) and include its full instructions in the sub-agent prompt.
4. **Cross-domain tasks:** spawn one agent per domain. Never let one domain agent touch another's files.
5. **Unrouted files:** assign to the closest domain agent, then update this table.

## Worktrees — Automatic for Parallel Batches

When the orchestrator dispatches **2+ file-editing sub-agents simultaneously**, pass `isolation: "worktree"` to each Agent call. Sequential single-agent tasks work directly on `main`. Read-only agents (Explore, review) never need worktrees. See `.claude/rules/git-workflow.md`.

**After each worktree agent returns:**
1. Verify changes: `git -C <worktree_path> log main..HEAD --oneline`
2. Run ground-truth verification (same as Post-Sub-Agent Verification below, but in the worktree)
3. Merge: `scripts/merge-worktree.sh <worktree-path> <branch-name> "<merge-message>"`
4. The script handles `--no-ff` merge, worktree removal, and branch cleanup

**Worktree agents own the full build.** Unlike shared-main agents, a worktree agent has a clean isolated tree. It should run full `npm run typecheck` and `npm run build` — not the own-files-only scoping. Pre-commit hooks skip multi-agent soft-warn when running inside a worktree.

## Sub-Agent Prompt Template — Canonical

**This is the only source of the Sub-Agent Prompt Template.** Every sub-agent prompt MUST include every item below. Agent definitions MUST NOT re-state this list — they reference this template.

1. **The agent's full instructions** from its definition file (`.claude/agents/{agent}.md`).
2. **Read first.** "Read relevant docs under `docs/` BEFORE writing code. Navigate via `docs/INDEX.md`."
3. **Docs same-commit.** "After changes, update the same doc files. Docs-first is non-negotiable; see `.claude/rules/docs-first.md`."
4. **Tasks.** "Break work into granular `TaskCreate` tasks before starting. `TaskList` must be empty before delivering. See `.claude/rules/task-tracking.md`."
5. **Build & test.** "Run `npm run typecheck` and `npm run build` after implementation. Run relevant unit tests.
    - **If you are in a worktree** (`isolation: "worktree"`): you own the full build. Run full typecheck/build/tests. Your tree is clean and isolated — all failures are yours.
    - **If you are on shared `main`** (sequential dispatch, no worktree): **Only verify your OWN edited files compile cleanly.** Ignore pre-existing failures in files you did not touch — those belong to another parallel agent. Do NOT install missing deps you did not introduce, do NOT delete unrelated broken code, do NOT 'fix' tests you did not author. See `.claude/rules/testing.md` → 'Agent Scope — Own-Files-Only Build Failures'.

    **CRITICAL — Batch preflight SHA comparison (shared-main only).** When you see test failures on shared `main`, **'pre-existing' means present before the BATCH started, NOT before your task started.** Your parent BATCH has a preflight commit SHA (included in your task prompt when relevant). Compare test results against THAT SHA, not against the commit immediately before your task. Lesson from BATCH-ULTRA 2026-04-11 WAVE-B.FOLLOW test-failure misreport."
6. **Visual verify — ONLY when visual.** "Run Docker visual verification per `.claude/rules/testing.md` → Visual Verify — Scoped. Run it only when the change could actually be seen by the player (UI, sprites, shaders, CSS, card/enemy data the combat screen reads, content text). Skip it for lint/test/doc/script edits and pure-TypeScript refactors. Don't burn 50–60s on a cold Docker boot for a change that has zero visual surface."
7. **Output sampling.** "After ANY batch operation or content edit, sample 5–10 items and READ them back. Sub-agents produce broken output ~15–20% of the time — catch it before delivering."
8. **Employee mindset.** "Follow `.claude/rules/employee-mindset.md` (single file covering Autonomy Ladder, Never Defer, Finished-Work Checklist, Clarification Bar, PX Lens, Creative Pass, What's Next). Default to action, not interrogation. Fix Green-zone issues in the same commit. Creative Pass + What's Next are required ONLY on non-trivial tasks — skip for mechanical single-purpose edits."
9. **🚨 Human-prose rule.** "If your task touches ANY user-facing text — deck `description` / `explanation` / `wowFactor`, narration JSON files, card/relic/enemy `name`/`description`/`flavorText`/`telegraph`, enemy `opening`/`ending` dialogue, mystery-event prose, achievement text, i18n locale strings, Svelte hardcoded player-visible strings, tooltips, onboarding lines, error messages — you MUST invoke `/humanizer` with `.claude/skills/humanizer/voice-sample.md` loaded BEFORE committing. Paste the humanizer self-audit pass output under a `## Humanizer Audit` heading in your final report. Exempt: `quizQuestion`, `correctAnswer`, `distractors`, `acceptableAlternatives` (factual data, not voice). See `.claude/rules/human-prose.md`. A sub-agent return that touches text without a `## Humanizer Audit` section is a hard failure — the orchestrator will reject it and re-delegate with a verification-first protocol."
10. **Self-verification paste (MANDATORY for data-mutating work).** "Before returning your summary, run a ground-truth verification command for every claim that touches data files — commits, registry stamps, deck JSON edits, script creation, file deletions. Paste the raw command output (not a description, not a paraphrase) into your final report under a `## Self-Verification` heading. For:
    - **File edits** → `git diff <file> | head -30`
    - **New files** → `ls -la <file>` and `wc -l <file>`
    - **Commits** → `git log -1 --stat`
    - **Registry stamps** → a `node -e` one-liner that counts the stamps you claim landed, e.g. `node -e \"const r=JSON.parse(require('fs').readFileSync('data/inspection-registry.json','utf8')); console.log(Object.values(r.tables.decks).filter(d=>d.lastQuizAudit==='2026-04-11').length)\"`
    - **Audit results** → the exact script stdout, not a summary of it
    - **Build / typecheck** → the final `ERRORS N WARNINGS M` line (or the full error list if non-zero)

    If you cannot verify a claim, say so explicitly: 'unable to verify X because Y'. Returning a success summary without a `## Self-Verification` section for data-mutating claims is a hard failure — the orchestrator will re-run ground-truth checks regardless, and a missing self-verification section is treated as evidence the work did not land. See `docs/gotchas.md` 2026-04-11 for the sub-agent stamping incident that prompted this rule."
11. **The specific task description.**

## Post-Sub-Agent Verification — MANDATORY

**After every file-editing sub-agent returns, the orchestrator MUST verify claimed changes against ground truth BEFORE trusting the summary.**

Sub-agents have been observed returning polished success summaries with zero bytes written to disk — a real ~15–20% failure mode that cannot be fixed by stronger prompts. The orchestrator's job is to catch it.

**Required verification steps:**

1. Run `git status` — claimed-modified files must appear in the working tree.
2. Run `git diff <file>` — confirm byte-level changes match the sub-agent's claim.
3. Re-run the verification command the sub-agent claimed to run, compare numeric output.
4. Sample-read the claimed changes as the player would see them — not just the diff.

**If ground truth contradicts the summary:**
- Do **not** re-delegate with "stronger" instructions — the failure is not an instruction deficit.
- Either take the mechanical fix directly (see orchestrator-edit exception above), spawn a different agent type, or spawn a fresh agent with a verification-first protocol.
- Log the incident in `docs/gotchas.md`.

## Visual Verification Routing

After any visual/rendering change: spawn ui-agent with `/visual-inspect`, OR use `/quick-verify` via qa-agent. Never commit visual changes without a screenshot.

## Anti-Patterns

- ❌ Spawning `model: "sonnet"` without agent instructions — generic worker, no context.
- ❌ Orchestrator editing files outside the explicit allow-list above.
- ❌ One domain agent editing files owned by another agent.
- ❌ Skipping the agent definition read step because "it's a small change."
- ❌ Trusting a sub-agent's return summary without `git status` + `git diff` + sample read-back.
- ❌ Re-stating the Sub-Agent Prompt Template in any other rule or agent definition. Always reference this file.
- ❌ Sub-agent returning a success summary without a `## Self-Verification` paste for every data-mutating claim. The orchestrator will re-verify regardless — a missing self-verification section is evidence of either a silent failure or a skipped check, both of which are hard failures.
- ❌ **`git add -A` / `git add .` on shared `main` when parallel agents are active.** A bulk `git add` sweeps up other agents' in-progress files. Use explicit paths instead. **Exception:** `git add -A` is safe inside a worktree — only your files exist in that index. See `docs/gotchas.md` 2026-04-11 "BATCH-ULTRA 51b68139b cross-agent git-add race".
- ❌ **Sub-agent auto-committing outside its assigned wave.** The BATCH plan says when commits happen. Sub-agents that ship their own commits mid-batch break the orchestrator's ability to bundle related work atomically. When in doubt, stage your work and let the orchestrator commit at the wave boundary, unless your task prompt explicitly says "commit after each fix".
