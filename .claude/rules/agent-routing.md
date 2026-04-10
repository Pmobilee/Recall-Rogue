# Agent Routing — MANDATORY

## The Orchestrator NEVER Edits Code Directly

All file edits MUST go through a named agent. Never spawn a generic sub-agent for code changes.

**Exception**: `.claude/` configuration files (rules, hooks, settings, agent definitions) are infrastructure — the orchestrator may edit these directly.

## Research Phase Ownership

The orchestrator and sub-agents have distinct responsibilities:
- **Orchestrator**: Reads docs, explores codebase, designs approach, creates plan, coordinates agents
- **Sub-agents**: Implement code changes, update docs for their domain, run verification
- The orchestrator does NOT write game code, but DOES do all pre-implementation research

## Routing Table — Check BEFORE Every Sub-Agent Spawn

| File Path | Agent | Definition |
|---|---|---|
| `src/game/`, `src/game/shaders/`, `src/game/systems/` | game-logic | `.claude/agents/game-logic.md` |
| `src/services/`, `src/data/` | game-logic | `.claude/agents/game-logic.md` |
| `src/main.ts`, `src/csp.ts` | game-logic | `.claude/agents/game-logic.md` |
| `src/events/`, `src/types/`, `src/utils/` | game-logic | `.claude/agents/game-logic.md` |
| `src/i18n/` (logic: index.ts, formatters.ts) | game-logic | `.claude/agents/game-logic.md` |
| `src/assets/` | game-logic | `.claude/agents/game-logic.md` |
| `src/ui/` (all: components, stores, styles, utils, effects) | ui-agent | `.claude/agents/ui-agent.md` |
| `src/CardApp.svelte`, `src/stores/` | ui-agent | `.claude/agents/ui-agent.md` |
| `data/decks/`, `facts.db`, `data/curated/` | content-agent | `.claude/agents/content-agent.md` |
| `src/data/chainThemes/`, `src/data/domainMetadata.ts` | content-agent | `.claude/agents/content-agent.md` |
| `src/i18n/locales/` (translation content) | content-agent | `.claude/agents/content-agent.md` |
| `tests/`, `src/dev/` | qa-agent | `.claude/agents/qa-agent.md` |
| `docs/gotchas.md` | qa-agent (primary writer) | `.claude/agents/qa-agent.md` |
| `docs/` (all other docs) | docs-agent | `.claude/agents/docs-agent.md` |
| `src/_archived/` | none — ignored, do not edit | — |

## How to Route

1. **Identify files** — Before spawning, determine which files the task will edit
2. **Match to agent** — Use the routing table above
3. **Read the agent definition** — Read `.claude/agents/{agent}.md` and include its full instructions in the sub-agent prompt
4. **Cross-domain tasks** — If files span multiple agents, spawn one agent per domain. Never let game-logic touch `src/ui/` or vice versa.
5. **Unrouted files** — If a file doesn't appear in the table, flag it and assign to the closest domain agent. Then update this table.

## 🚨 MANDATORY WORKTREE ISOLATION FOR EVERY SUB-AGENT 🚨

**Every `Agent` tool invocation that edits files MUST pass `isolation: "worktree"`.** No sub-agent ever edits in the orchestrator's working tree. No two sub-agents ever share a tree. See `.claude/rules/git-workflow.md` → "MANDATORY WORKTREE ISOLATION" for the full rationale.

- Editing sub-agent → `isolation: "worktree"` — NON-NEGOTIABLE
- Read-only Explore/research sub-agent → may omit isolation (safe, no writes)
- Parallel sub-agents → EACH gets its own `isolation: "worktree"`, never shared
- The sub-agent prompt MUST tell it to stay inside its worktree and push its branch before returning

The orchestrator itself ALSO must be operating inside a dedicated worktree (not primary `main` checkout) before spawning editing sub-agents. If you are still in `/Users/damion/CODE/Recall_Rogue` on `main`, create your own worktree first.

## Sub-Agent Prompt Template

Every sub-agent prompt MUST include:
1. The agent's full instructions from its definition file
2. **"You are running in an isolated git worktree (`isolation: worktree`). Do all work here. Do NOT `cd` out of this worktree. Do NOT touch sibling worktrees or the primary `main` checkout. Commit and push your branch before returning, and report the exact worktree path + branch name in your final message."**
3. "Read relevant docs under docs/ BEFORE writing code. Navigate via docs/INDEX.md."
4. "After changes, update those same doc files."
   **This is non-negotiable. Every sub-agent deliverable MUST include doc updates. There is no change too small to document.**
5. "Run `npm run typecheck` and `npm run build` after implementation."
6. **"Run Docker visual verification (`scripts/docker-visual-test.sh`) with `__rrScreenshotFile()` + `__rrLayoutDump()` after implementation. Load a scenario where the change is observable. No exceptions."**
7. **"After ANY batch operation or content edit, sample 5-10 items and READ them back. Check for broken grammar, corrupted data, unintended patterns. NEVER deliver output without verifying samples."**
8. The specific task description
9. "Break work into granular TaskCreate tasks BEFORE starting. One task per discrete step. Mark in_progress when beginning, completed when done. Run TaskList before delivering — zero pending tasks allowed."

## Anti-Patterns — NEVER Do These

- ❌ Spawning `model: "sonnet"` without agent instructions — this is a generic worker with no context
- ❌ Orchestrator making direct edits via Edit/Write tools
- ❌ One agent editing files owned by another agent
- ❌ Skipping the agent definition read step because "it's a small change"

## Visual Verification Routing

After any visual/rendering change (shaders, UI, layout, backgrounds):
- Spawn ui-agent with `/visual-inspect` for screenshot verification
- OR use `/quick-verify` via qa-agent
- NEVER commit visual changes without a screenshot
