# Documentation Archive

This directory contains historical documentation and planning materials from earlier phases of Recall Rogue development. **This is reference material only** — not current design documentation.

For active project work, refer to:
- **Game mechanics & design**: `/docs/GAME_DESIGN.md`
- **System architecture**: `/docs/ARCHITECTURE.md`
- **Active roadmap phases**: `/docs/roadmap/phases/`
- **Completed phases**: `/docs/roadmap/completed/`

---

## Archive Contents

### `v1-v5-phases/` (71 files)
**Purpose**: Phase planning documents from early project versions (V1–V5)
**Date Range**: ~2025–early 2026
**Contains**:
- Detailed phase specifications (Phases 1–63)
- Feature design documents (seasons, character animation, learning systems, endgame mechanics)
- Balance proposals, UX improvements, and backend integration plans
- Status: All phases from this era are either completed or superseded by AR-based workflow

**When to consult**: Rarely needed; check when researching historical design decisions or understanding why certain systems were chosen or abandoned.

---

### `old-roadmap/` (6 files)
**Purpose**: Pre-AR phase tracking and roadmap documents
**Date Range**: ~mid-2025
**Contains**:
- Soft launch tracker
- Parallel phase execution guides
- Playtest findings summaries
- Quick-win lists
- Phase 48 (Prestige & Endgame)

**When to consult**: When reviewing historical product roadmap or understanding earlier launch strategies.

---

### `old-docs/` (14 files)
**Purpose**: Design documentation from early development phases
**Date Range**: ~early–mid 2025
**Contains**:
- Design decision archives
- Context index from v1–v2 era
- Early mechanic specifications
- Performance analysis documents
- Asset pipeline research

**When to consult**: When investigating the reasoning behind core systems or checking if an "old feature" was previously attempted.

---

### `api/` (15 files)
**Purpose**: Backend API specifications and integrations
**Date Range**: ~2025–early 2026
**Contains**:
- Endpoint documentation (quiz delivery, save/load, subscriptions)
- Integration guides (RevenueCat, analytics platforms)
- Webhook specifications
- Data schemas

**When to consult**: When working on backend integration or understanding how old API contracts worked.

---

### `questions/` (5 files)
**Purpose**: Fact database organization and content pipeline notes
**Date Range**: ~mid–late 2025
**Contains**:
- Fact sourcing and mining strategies
- Domain categorization schemes
- Content scaling proposals

**When to consult**: When researching historical fact sourcing approaches or understanding earlier content generation methods.

---

### `playtests/` (201 files)
**Purpose**: Playtest logs, analytics, and run data
**Date Range**: ~2026
**Contains**:
- Playtest campaign runs with detailed metrics
- Run breakdowns and analysis reports
- Test data organized by domain/feature
- Completed playtest summaries

**When to consult**: When analyzing historical playtest performance or debugging why a specific balance change was made.

---

### `playthroughs/` (1 file)
**Purpose**: Manual playthrough recordings and observations
**Date Range**: ~2026
**Contains**:
- Session logs of gameplay walkthroughs

**When to consult**: When reviewing how players actually experienced specific flows.

---

### `store/` (4 files)
**Purpose**: In-app store and monetization documentation
**Date Range**: ~late 2025–early 2026
**Contains**:
- Product definitions and pricing strategies
- Subscription tier specifications
- RevenueCat integration details

**When to consult**: When researching historical monetization models or IAP implementations.

---

### `perf/` (1 file)
**Purpose**: Performance optimization research
**Date Range**: ~2025
**Contains**:
- Performance profiling notes and optimization proposals

**When to consult**: When investigating old performance issues or understanding previous optimization decisions.

---

### `misc/` (2 files)
**Purpose**: Miscellaneous planning and process notes
**Date Range**: ~2025–early 2026
**Contains**:
- Agent onboarding and process documentation
- Overnight task lists and automation notes
- Security audit records

**When to consult**: When understanding historical agent workflows or process improvements.

---

## Root-Level Files

### `V6-CORE-LOOP-PROPOSITION.md`
Complete specification for Recall Rogue's V6 game loop and core mechanics. Historical design document; see `docs/GAME_DESIGN.md` for current state.

### `V6-PROGRESS-mining.md`
Progress tracking for V6 mining system implementation. Superseded by AR-based workflow.

---

## Quick Navigation

| Need | Look Here |
|------|-----------|
| Current game mechanics | `/docs/GAME_DESIGN.md` |
| System architecture | `/docs/ARCHITECTURE.md` |
| Active roadmap | `/docs/roadmap/phases/` |
| Completed work | `/docs/roadmap/completed/` |
| **Historical API specs** | `/docs/archive/api/` |
| **Old design decisions** | `/docs/archive/old-docs/` or `/docs/archive/v1-v5-phases/` |
| **Playtest data** | `/docs/archive/playtests/` |
| **Old phase plans** | `/docs/archive/v1-v5-phases/` or `/docs/archive/old-roadmap/` |

---

## Security Notes

- All API keys in phase docs are **redacted or placeholder values** (`sk-ant-...`, `appl_xxxx`)
- No active credentials are stored in the archive
- The archive is safe to browse but should not be referenced for sensitive configurations
- Actual credentials are managed via environment variables (`.env`, not committed)

---

## When NOT to Use the Archive

- **Don't treat old phase docs as current specs** — they may be outdated
- **Don't copy code patterns from old phases** — current patterns are in `/src/`
- **Don't use archived balance values** — check `/src/data/balance.ts` for current values
- **Don't reference archived API specs** — use `/docs/api/` or the actual running backend

---

**Last updated**: 2026-03-18
