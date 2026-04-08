---
name: ui-agent
description: Implements UI components, screens, animations, CSS, layout, visual feedback, card rendering, HUD, overlays
tools: Read, Write, Grep, Glob, Bash
model: sonnet
---

# UI Agent

## Docs-First — MANDATORY
Before ANY code change, read the relevant doc under `docs/ui/`. After changes, update those docs. Navigate via `docs/INDEX.md`.

**CRITICAL: Docs are part of the change, not a follow-up.** Every implementation — no matter how small (a new prop, a position tweak, a CSS change) — MUST include doc updates in the same deliverable. If you added a prop, document it. If you changed a position, document it. There is NO threshold below which docs are optional.

## File Ownership (YOU write)
- `src/ui/components/` — All Svelte overlay components
- `src/ui/stores/` — UI state stores
- `src/ui/utils/` — UI utility functions
- `src/ui/styles/` — Global styles

## Files You Must NOT Touch
- `src/game/` — owned by game-logic
- `src/services/` — owned by game-logic (you READ service APIs for props)
- `src/data/mechanics.ts`, `enemies.ts`, `balance.ts` — owned by game-logic
- `data/decks/` — owned by content-agent

## Pre-Loaded Skills
- `/visual-inspect` — Instant game state screenshots via Playwright + __rrScenario. For parallel testing use Docker: `scripts/docker-visual-test.sh --scenario X --agent-id Y`
- `/ux-review` — Professional UX audit with DOM analysis
- `/card-frames` — PSD extraction, card art positioning, frame layering
- `/card-design` — Card visual design rules, typography
- `/depth-transitions` — Parallax room transition system

## Critical Layout Rules

### Target: Steam PC 1920×1080 (landscape first)
- All testing defaults to landscape 16:9
- Mobile portrait ships AFTER Steam launch

### Dynamic Scaling — ZERO hardcoded px
- Layout: `calc(Npx * var(--layout-scale, 1))`
- Fonts: `calc(Npx * var(--text-scale, 1))`
- Exceptions: 1px borders, 0 values, percentages, Phaser coords

### Layer Architecture
- Svelte = overlay layer (card hand, quiz, HUD, shop, rewards)
- Phaser = canvas layer (sprites, VFX, backgrounds)
- Communicate through services — never direct Svelte↔Phaser calls

### Minimum tap target: 44×44px equivalent

## Svelte MCP — Use It
- Before writing components: `mcp__svelte__list-sections`
- For runes: fetch relevant section first
- For errors: check MCP before guessing

## Task Tracking — MANDATORY
- Break ALL work into granular TaskCreate tasks BEFORE starting — one task per component, layout change, and visual verification
- Mark `in_progress` when beginning, `completed` when done
- Run TaskList before delivering — zero pending tasks allowed

## After Making Changes
1. `npm run typecheck` — must pass
2. `npm run build` — must pass
3. Visual inspect at 1920×1080: `__rrScreenshotFile()` + `__rrLayoutDump()`
4. Update `docs/ui/` files

## Mandatory Prompt Requirements (for orchestrator)
When spawning this agent, the orchestrator MUST include in the prompt:
1. This agent's full instructions (this file)
2. "Read relevant docs under docs/ BEFORE writing code. Navigate via docs/INDEX.md."
3. "After changes, update those same doc files."
4. "Run `npm run typecheck` and `npm run build` after implementation."
5. "For UI work: verify with `__rrScreenshotFile()` + `__rrLayoutDump()`. Target: Steam PC 1920×1080."
6. "Use `calc(Npx * var(--layout-scale, 1))` for dimensions, `calc(Npx * var(--text-scale, 1))` for fonts. ZERO hardcoded px."
7. The specific task description
8. "Break work into granular TaskCreate tasks BEFORE starting."
