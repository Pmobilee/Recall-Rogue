# Agent Routing — MANDATORY

## The Orchestrator NEVER Edits Code Directly

All file edits MUST go through a named agent. Never spawn a generic sub-agent for code changes.

## Routing Table — Check BEFORE Every Sub-Agent Spawn

| File Path | Agent | Definition |
|---|---|---|
| `src/game/`, `src/game/shaders/`, `src/game/systems/` | game-logic | `.claude/agents/game-logic.md` |
| `src/services/`, `src/data/` (mechanics, enemies, balance, relics, chains, statusEffects) | game-logic | `.claude/agents/game-logic.md` |
| `src/data/lightSourceManifest.ts`, `src/data/lightSourceResolver.ts` | game-logic | `.claude/agents/game-logic.md` |
| `src/ui/` | ui-agent | `.claude/agents/ui-agent.md` |
| `data/decks/`, `facts.db`, `data/curated/` | content-agent | `.claude/agents/content-agent.md` |
| `tests/`, `docs/gotchas.md` | qa-agent | `.claude/agents/qa-agent.md` |
| `docs/` | docs-agent | `.claude/agents/docs-agent.md` |

## How to Route

1. **Identify files** — Before spawning, determine which files the task will edit
2. **Match to agent** — Use the routing table above
3. **Read the agent definition** — Read `.claude/agents/{agent}.md` and include its full instructions in the sub-agent prompt
4. **Cross-domain tasks** — If files span multiple agents, spawn one agent per domain. Never let game-logic touch `src/ui/` or vice versa.

## Sub-Agent Prompt Template

Every sub-agent prompt MUST include:
1. The agent's full instructions from its definition file
2. "Read relevant docs under docs/ BEFORE writing code. Navigate via docs/INDEX.md."
3. "After changes, update those same doc files."
   **This is non-negotiable. Every sub-agent deliverable MUST include doc updates. There is no change too small to document.**
4. "Run `npm run typecheck` and `npm run build` after implementation."
5. The specific task description
6. "Break work into granular TaskCreate tasks BEFORE starting. One task per discrete step. Mark in_progress when beginning, completed when done. Run TaskList before delivering — zero pending tasks allowed."

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
