# AR-102: Skill & Agent Consolidation and Documentation

## Overview
The project has 11 skills in `.claude/skills/`, 6 commands in `.claude/commands/`, and 3 agents in `.claude/agents/`. Some skills overlap (5 playtest-related skills), some have massive AR-enforcement preambles that could be centralized, and the skill documentation is scattered. Consolidate, document, and add missing skills.

**Complexity**: Medium
**Risk**: Low (skills are agent instructions, not production code)
**Dependencies**: None

## TODO Checklist

- [ ] **1. Audit all 11 skills for relevance and overlap**
  - `playtest` — runs a single playtest simulation
  - `playtest-analyze` — analyzes playtest logs
  - `playtest-results` — views playtest results
  - `playtest-suite` — runs full playtest pipeline
  - `playtest-triage` — triages playtest reports
  - **Question**: Can `playtest-suite` replace the other 4? Or should they remain granular?
  - `balance-check` — analyzes balance simulation results
  - `answer-checking` — DB-first answer checking
  - `manual-fact-ingest-dedup` — content pipeline
  - `subcategorize` — fact subcategorization
  - `android-deploy` — Android APK deployment
  - `work-tracking` — AR enforcement

- [ ] **2. Consolidate playtest skills if beneficial**
  - Option A: Keep all 5 granular skills (current)
  - Option B: Merge into 2 skills: `playtest` (run + analyze) and `playtest-manage` (results + triage)
  - Choose based on actual usage patterns
  - If consolidating: merge SKILL.md files, update references

- [ ] **3. Centralize AR enforcement preamble**
  - Currently every skill has the same 20-line AR enforcement block copy-pasted
  - Create a shared note or reduce to a 2-line reference: "See work-tracking skill for AR rules"
  - This reduces skill file sizes and makes updates easier

- [ ] **4. Audit the 6 commands in `.claude/commands/`**
  - `playtest.md` — overlaps with playtest skill?
  - `playthrough.md` — visual playthrough command
  - `progress-phase-write.md` — CR spec writer
  - `progress-reflect.md` — phase reflection
  - `verify-fix.md` — fix verification
  - `playthrough-scenarios/` (13 scenario files) — are these still current?
  - Remove any that duplicate skills or are no longer used

- [ ] **5. Add missing skills**
  - **`cleanup` skill**: Run typecheck + build + test suite in one command (useful for verification gates)
  - **`quick-verify` skill**: Screenshot + snapshot + console check in one step (the standard debug sequence from CLAUDE.md, packaged as a reusable skill)
  - **`code-review` skill**: Review a diff/PR for quality, security, and convention compliance

- [ ] **6. Audit the 3 agents in `.claude/agents/`**
  - `playwright-test-generator.md` — still current?
  - `playwright-test-healer.md` — still current?
  - `playwright-test-planner.md` — still current?
  - Verify they reference correct file paths and test patterns

- [ ] **7. Create skills index document**
  - Create `docs/SKILLS-AND-AGENTS.md` with:
    - Table of all skills: name, description, when to use, key commands
    - Table of all agents: name, purpose, when to invoke
    - Table of all commands: name, purpose
  - This helps new agent sessions understand what tools are available

- [ ] **8. Update CLAUDE.md skill references**
  - Ensure CLAUDE.md accurately lists current skills
  - Remove references to deleted/renamed skills

## Acceptance Criteria
- No duplicate or overlapping skills
- AR enforcement preamble centralized (not copy-pasted in every skill)
- Missing utility skills created (cleanup, quick-verify)
- `docs/SKILLS-AND-AGENTS.md` exists and is comprehensive
- All agent files reference current file paths
- CLAUDE.md skill references up to date

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `.claude/skills/*/SKILL.md` (consolidate preambles) |
| MAYBE MERGE | Playtest skills (5 → 2-3) |
| CREATE | `.claude/skills/quick-verify/SKILL.md` |
| CREATE | `.claude/skills/code-review/SKILL.md` |
| CREATE | `docs/SKILLS-AND-AGENTS.md` |
| AUDIT | `.claude/agents/*.md` (3 files) |
| AUDIT | `.claude/commands/*.md` (6 files + 13 scenarios) |
| EDIT | `CLAUDE.md` (update skill references) |

## Verification Gate
- [ ] All skills load without errors
- [ ] No duplicate functionality
- [ ] `docs/SKILLS-AND-AGENTS.md` complete and accurate
- [ ] CLAUDE.md references match actual skills
