# AR-99: Dead Service Audit & Service Status Documentation

## Overview
Audit all 124 services in `src/services/` for stub/dead code. Many services were created for planned features (co-op, duels, guilds, seasons) that may be shells with no real implementation. Document which services are fully implemented vs stubs to help future development sessions.

**NOTE**: SM-2 (`sm2.ts`) was found to be ACTIVELY USED by 8+ files (playerData, StudySession, KnowledgeTree, GaiaReport, StudyStation, presets, KnowledgeTreeView). It is NOT dead — do NOT delete it. The FSRS migration (AR-02) added FSRS as a parallel system, not a replacement.

**Complexity**: Medium
**Risk**: Low (audit + documentation + dead export removal)
**Dependencies**: None

## TODO Checklist

- [x] **1. Document SM-2 vs FSRS relationship**
  - SM-2 is used by: playerData.ts, StudySession.svelte, KnowledgeTree.svelte, KnowledgeTreeView.svelte, GaiaReport.svelte, StudyStation.svelte, dev/presets.ts
  - FSRS (`fsrsScheduler.ts`) usage: check which files import it
  - Document in ARCHITECTURE.md: "SM-2 is the primary review scheduler. FSRS exists as an experimental parallel scheduler."

- [x] **3. Audit stub services for dead features**
  - `src/services/steamService.ts` — check if all exports are no-ops/stubs
  - `src/services/coopService.ts` — is co-op actually wired up or just a shell?
  - `src/services/duelService.ts` — same question
  - `src/services/guildService.ts` — same question
  - `src/services/leaderboardService.ts` — real implementation or stub?
  - `src/services/seasonService.ts` / `seasonPass.ts` — functional or placeholder?
  - For each: if it's a stub with no real logic, consider marking with `@stub` JSDoc tag or consolidating stubs

- [x] **4. Identify and remove truly dead exports**
  - For each service flagged as stub, check if any component actually uses the service
  - Remove exports that have zero consumers
  - Keep stubs that are imported by UI components (they serve as type contracts)

- [x] **5. Document service status in ARCHITECTURE.md**
  - Add a "Service Status" table: implemented / stub / deprecated
  - Helps future sessions know what's real vs placeholder

## Acceptance Criteria
- SM-2 scheduler removed if confirmed dead (replaced by FSRS)
- All stub services clearly documented or consolidated
- Dead exports removed
- ARCHITECTURE.md updated with service status table
- All tests pass

## Files Affected
| Action | Path |
|--------|------|
| MAYBE DELETE | `src/services/sm2.ts` |
| MAYBE DELETE | `tests/unit/sm2.test.ts` |
| AUDIT | `src/services/steamService.ts` |
| AUDIT | `src/services/coopService.ts`, `duelService.ts`, `guildService.ts` |
| AUDIT | `src/services/seasonService.ts`, `seasonPass.ts` |
| EDIT | `docs/ARCHITECTURE.md` (service status table) |

## Verification Gate
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npx vitest run` — all tests pass
- [x] No broken imports after any deletions
- [x] ARCHITECTURE.md has service status table
