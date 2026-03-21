# AR-120: Blindspot Mitigations, Skill Catalog, and Capability Documentation

## Overview

**Goal:** Systematically address every identified Claude agent blindspot with concrete tooling, skills, memory entries, and documentation — so no future agent session starts without full awareness of what's available, what's weak, and what to proactively suggest.

**Origin:** Blindspot analysis session (2026-03-21). Identified 8 capability gaps: Phaser internals, mobile debugging, game balance intuition, visual/UX design, ComfyUI sprite craft, audio (complete gap), educational psychology/SR depth, and Svelte 5 runes. Research produced actionable mitigations for each.

**Scope:** Documentation, skills, and memory only. No game code changes in this AR — those come in follow-up ARs when the user decides to implement specific mitigations (e.g., Howler.js integration, per-card metrics in headless sim).

**Complexity:** Medium (many files, but all are docs/skills/memory — no code risk)

---

## Deliverables

### 1. New Skills (`.claude/skills/`)

- [ ] **`llm-playtest`** — LLM-as-game-agent skill. Spawns Haiku sub-agents to play combat states strategically, producing natural-language reasoning about card choices. Surfaces balance blindspots that heuristic bots miss. References AIPA and MiniSTS research.
- [ ] **`advanced-balance`** — Extended balance analysis: per-card win-rate tracking, tension metrics (HP-at-death, turns-to-outcome, meaningful-choice ratio), and predictability scoring (is win/loss >80% determined at turn 1?). Extends the existing headless sim output.
- [ ] **`audio-manager`** — Audio scaffolding skill. Documents the Howler.js integration path, sound event taxonomy (card-play, card-hit, enemy-attack, victory, defeat, ambient), and file naming conventions. For when the user decides to add audio.
- [ ] **`mobile-debug`** — Capacitor mobile debugging guide. `chrome://inspect` workflow, Inspect.dev, WebDebugX, native profiler export analysis, dev diagnostics panel spec. Everything needed to debug on-device issues.
- [ ] **`phaser-perf`** — Phaser performance optimization skill. Canvas vs WebGL benchmarking, mobile-specific optimizations (reduced canvas size, texture atlas management, draw call monitoring), Phaser Debugger Chrome extension usage, `__terraDebug` extensions.

### 2. Memory Updates (`memory/`)

- [ ] **`blindspot-mitigations.md`** — Master reference for all 8 blindspots with status and links to skills
- [ ] **`proactive-suggestions.md`** — CRITICAL: Lists when to proactively suggest capabilities to the user (e.g., "when balance is discussed, mention LLM playtesting"; "when mobile bugs arise, suggest chrome://inspect workflow"; "when new cards are added, suggest per-card metrics run")
- [ ] **`skill-catalog-importance.md`** — Describes skill tiers: always-active (feature-pipeline, game-design-sync, work-tracking), on-demand (all others), and proactive-suggest (llm-playtest, advanced-balance, mobile-debug, phaser-perf, audio-manager)

### 3. Root Document

- [ ] **`CLAUDE_CAPABILITIES.md`** — Human-readable document for the user explaining what Claude can do in this project. Organized by category: Development, Testing, Content Pipeline, Art, Balance, Deployment, Website. Includes skill names, when to invoke them, and what they produce.

### 4. Game Design Doc Update

- [ ] **Append skills catalog section to `docs/GAME_DESIGN.md`** — Section titled "Appendix: Agent Skills Catalog" listing every skill with a one-line description, grouped by category.

---

## Files Affected

| File | Action |
|------|--------|
| `.claude/skills/llm-playtest/SKILL.md` | CREATE |
| `.claude/skills/advanced-balance/SKILL.md` | CREATE |
| `.claude/skills/audio-manager/SKILL.md` | CREATE |
| `.claude/skills/mobile-debug/SKILL.md` | CREATE |
| `.claude/skills/phaser-perf/SKILL.md` | CREATE |
| `memory/blindspot-mitigations.md` | CREATE |
| `memory/proactive-suggestions.md` | CREATE |
| `memory/skill-catalog-importance.md` | CREATE |
| `CLAUDE_CAPABILITIES.md` | CREATE |
| `docs/GAME_DESIGN.md` | EDIT (append skills catalog) |
| `memory/MEMORY.md` | EDIT (add new memory entries) |

---

## Acceptance Criteria

Per deliverable:
1. Each skill file has correct frontmatter (name, description, user_invocable)
2. Each skill contains enough context that a future agent with zero prior knowledge can use it effectively
3. `CLAUDE_CAPABILITIES.md` is readable by a non-technical user and covers all project capabilities
4. `GAME_DESIGN.md` skills section is concise (one line per skill, grouped by category)
5. Memory entries include proper frontmatter and are indexed in `MEMORY.md`
6. Proactive suggestions memory is specific: "when X happens, suggest Y because Z"

---

## Verification Gate

- [ ] All files exist and are well-formed
- [ ] `MEMORY.md` index updated with new entries
- [ ] `GAME_DESIGN.md` has new appendix section
- [ ] `CLAUDE_CAPABILITIES.md` exists in project root
- [ ] All 5 new skills appear in skill listing
- [ ] No typecheck/build regressions (skills are docs-only, but verify anyway)

---

## Research References

- [AIPA — AI Playtesting](https://github.com/AIPlaytesting/AIPA) — ML agent for PVE card game balance
- [MiniSTS](https://github.com/iambb5445/MiniSTS) — Simplified Slay the Spire for agent testing
- [LLMs as Game-Playing Agents (FDG 2024)](https://dl.acm.org/doi/fullHtml/10.1145/3649921.3650013) — Natural language game reasoning
- [SlayTheSpireFightPredictor](https://github.com/alexdriedger/SlayTheSpireFightPredictor) — ML fight outcome prediction
- [FSRS Algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs) — Next-gen spaced repetition (15-20% fewer reviews)
- [Phaser 3 Mobile Optimization (2025)](https://franzeus.medium.com/how-i-optimized-my-phaser-3-action-game-in-2025-5a648753f62b) — Canvas > WebGL on low-end mobile
- [Howler.js](https://howlerjs.com/) — Cross-browser game audio library
- [ComfyUI-PixelArt-Detector](https://github.com/dimtoneff/ComfyUI-PixelArt-Detector) — Pixel art preservation nodes
- [Inspect.dev](https://inspect.dev/) — Cross-platform WebView debugging
- [Phaser Debugger Extension](https://chromewebstore.google.com/detail/phaser-debugger/aigiefhkiaiihlploginlonehdafjljd) — Chrome extension for Phaser inspection
