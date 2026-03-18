# AR-101: Documentation Accuracy Refresh

## Overview
After 77+ ARs and a V2 overhaul, documentation has likely drifted from reality. Audit all key docs against the actual codebase and fix inaccuracies. This is especially important since CLAUDE.md drives all agent behavior — stale instructions cause agents to make wrong decisions.

**Complexity**: Medium
**Risk**: Low (documentation only — no code changes)
**Dependencies**: Should run AFTER AR-92 through AR-100 so docs reflect the cleaned-up state

## TODO Checklist

- [ ] **1. Audit `CLAUDE.md` (323 lines)**
  - Verify every file path mentioned still exists
  - Verify every npm command listed still works
  - Check data-testid selectors match actual components
  - Verify screen flow description matches actual game flow
  - Check if any new systems/patterns need documenting
  - Verify sub-agent rules still make sense
  - Check if any referenced tools/scripts have been removed

- [ ] **2. Audit `docs/GAME_DESIGN.md` (2,179 lines)**
  - Cross-reference every mechanic with actual implementation in `src/services/`
  - Verify balance values match `src/data/balance.ts`
  - Check enemy definitions match `src/data/enemies.ts`
  - Verify relic descriptions match `src/data/relics/`
  - Remove any mechanics that were cut/never implemented
  - Add any mechanics that exist in code but aren't documented

- [ ] **3. Audit `docs/ARCHITECTURE.md` (999 lines)**
  - Verify directory structure section matches reality
  - Check system diagrams match actual data flow
  - Verify file references point to existing files
  - Update service list with current service inventory
  - Add missing systems (anything from V2 overhaul not documented)

- [ ] **4. Audit `docs/SECURITY.md` (54 lines)**
  - Very short — may need expansion
  - Verify CSP policy matches `vite.config.ts` implementation
  - Add any security patterns from the codebase not yet documented

- [ ] **5. Audit `docs/CONTENT_PIPELINE.md` (120 lines)**
  - Verify against actual pipeline in `scripts/content-pipeline/`
  - Check if workflow steps match current process
  - Verify script names and paths

- [ ] **6. Audit `docs/TESTING-GUIDE.md` (71 lines)**
  - Very short — expand with current test patterns
  - Document test categories, run commands, coverage expectations
  - Add playtest framework documentation

- [ ] **7. Cross-reference all doc-to-doc links**
  - Ensure no docs reference deleted docs
  - Fix any broken internal links

## Acceptance Criteria
- Every file path in docs points to a real file
- Every npm command in docs actually works
- Balance values in GAME_DESIGN.md match balance.ts
- No references to removed features/mechanics
- All new V2 systems documented
- ARCHITECTURE.md service list complete and accurate

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `CLAUDE.md` |
| EDIT | `docs/GAME_DESIGN.md` |
| EDIT | `docs/ARCHITECTURE.md` |
| EDIT | `docs/SECURITY.md` |
| EDIT | `docs/CONTENT_PIPELINE.md` |
| EDIT | `docs/TESTING-GUIDE.md` |

## Verification Gate
- [ ] All file paths in docs verified against filesystem
- [ ] All npm commands in docs verified runnable
- [ ] No references to deleted features/files
- [ ] Spot-check 10 balance values: doc matches code
