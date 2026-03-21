# AR-119: Feature Pipeline Skill — Full Lifecycle Implementation Workflow

**Status:** Complete
**Created:** 2026-03-21
**Depends on:** None

## Overview

Create a comprehensive, always-active skill called `feature-pipeline` that enforces a rigorous 7-phase workflow for ANY non-trivial task. This skill replaces the ad-hoc approach where the orchestrator often skips clarification, research, intent verification, and testing. It synthesizes best practices from Anthropic's official skill docs, aaddrick/claude-pipeline, levnikolaevich/claude-code-skills, and shinpr/claude-code-workflows.

The skill addresses recurring failures:
- Starting implementation without clarifying ambiguous requirements
- Building features that are technically correct but miss the user's actual intent (e.g., Wikipedia pipeline that generated entity names but never fetched actual Wikipedia data)
- Not offering better alternatives proactively
- Skipping documentation updates
- Not building verification tests at the end of each AR
- Not moving completed ARs to `completed/`

## Deliverables
Total: 1 new skill directory with SKILL.md + 1 reference file, memory update

## Tasks

### Section A: Skill Creation

- [x] **A.1** Create `.claude/skills/feature-pipeline/SKILL.md` — always-active skill with 7-phase workflow
  - Acceptance: File exists with valid YAML frontmatter (`user_invocable: false`, always-active description), body under 500 lines (155 lines), imperative instructions covering all 7 phases
- [x] **A.2** Create `.claude/skills/feature-pipeline/references/phase-checklist.md` — detailed per-phase checklist (166 lines)
  - Acceptance: Contains concrete checklist items for each phase, with specific commands and tools to use

### Section B: Integration

- [x] **B.1** Update memory index to reference the new skill's purpose
  - Acceptance: `MEMORY.md` has entry for the feature pipeline skill

### Section C: Verification

- [x] **C.1** Verify skill is detected by Claude Code — confirmed in skill list
- [x] **C.2** Dry-run test — Wikipedia pipeline scenario would be caught:
  - Phase 1 CLARIFY: "Do you want me to actually fetch Wikipedia article text, or just generate entity names?"
  - Phase 3 PROPOSE: "The pipeline needs: entity selection -> Wikipedia API fetch -> fact extraction -> validation. Currently you only have entity names — shall I build the full pipeline?"

## Verification Gate

- [x] Skill file exists at `.claude/skills/feature-pipeline/SKILL.md`
- [x] YAML frontmatter is valid (name, description, user_invocable: false)
- [x] Body is under 500 lines (155 lines)
- [x] References file exists and is linked from SKILL.md
- [x] Memory index updated
- [x] All 7 phases are documented with concrete actions

## Files Affected

| File | Action | Task |
|------|--------|------|
| `.claude/skills/feature-pipeline/SKILL.md` | NEW | A.1 |
| `.claude/skills/feature-pipeline/references/phase-checklist.md` | NEW | A.2 |
| `memory/MEMORY.md` | EDIT | B.1 |
