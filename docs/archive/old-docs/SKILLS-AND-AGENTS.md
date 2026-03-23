# Skills, Agents & Commands Reference

Quick reference for all Claude Code automation available in this project.

## Skills (`.claude/skills/`)

| Skill | Type | Description |
|-------|------|-------------|
| `work-tracking` | Enforcement | AR phase doc requirement for all implementation work |
| `playtest` | Simulation | Run a single playtest with configurable profile |
| `playtest-analyze` | Analysis | Analyze playtest logs for issues |
| `playtest-results` | Viewer | View playtest leaderboard and reports |
| `playtest-suite` | Pipeline | Full playtest pipeline: simulate → analyze → triage |
| `playtest-triage` | Analysis | Deduplicate and rank playtest issues |
| `balance-check` | Analysis | Analyze mass simulation results |
| `answer-checking` | Content QA | DB-first answer checking and fixing |
| `manual-fact-ingest-dedup` | Content Pipeline | Knowledge fact and vocabulary ingestion |
| `subcategorize` | Content Pipeline | Assign subcategories to unclassified facts |
| `android-deploy` | Deployment | Build and deploy Android debug APK |
| `quick-verify` | Verification | Run typecheck + build + tests verification gate |
| `code-review` | Quality | Review changes for quality, security, conventions |

## Commands (`.claude/commands/`)

| Command | Description |
|---------|-------------|
| `playtest` | Run playtest (alternative to skill) |
| `playthrough` | Visual playthrough session |
| `progress-phase-write` | Write CR spec documents |
| `progress-reflect` | Phase reflection and retrospective |
| `verify-fix` | Verify a specific fix works |
| `playthrough-scenarios/*` | 13 scenario-specific playthrough scripts |

## Agents (`.claude/agents/`)

No custom agents currently active. All Playwright testing uses the official `@playwright/mcp` server via `mcp__playwright__*` tools.
