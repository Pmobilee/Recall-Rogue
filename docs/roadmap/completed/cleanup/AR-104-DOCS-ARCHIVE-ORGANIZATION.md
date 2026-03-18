# AR-104: Documentation Archive Organization

## Overview
`docs/archive/` contains 299+ files from old phases, research, playtests, and API docs. While valuable as history, it's disorganized and takes up space in the repo. Organize the archive properly, add a README, and consider moving very old/large files to a separate branch or trimming them.

**Complexity**: Low
**Risk**: Very Low (archive files only — no impact on code)
**Dependencies**: None

## TODO Checklist

- [ ] **1. Inventory `docs/archive/` contents**
  - `docs/archive/api/` — old API documentation
  - `docs/archive/misc/` — miscellaneous old docs
  - `docs/archive/old-docs/` — superseded design documents
  - `docs/archive/old-roadmap/` — deprecated roadmap structure
  - `docs/archive/perf/` — old performance reports
  - `docs/archive/playtests/` — completed playtest reports
  - `docs/archive/playthroughs/` — old playthrough logs
  - `docs/archive/questions/` — question design docs
  - `docs/archive/store/` — app store related docs
  - `docs/archive/v1-v5-phases/` — 47 completed phase docs
  - Count files and total size per directory

- [ ] **2. Add `docs/archive/README.md`**
  - Explain what the archive contains
  - List each subdirectory with its purpose
  - Note the date range of archived content
  - Explain when to look here vs active docs

- [ ] **3. Remove truly stale content**
  - Delete any files that are empty, contain only headers, or are clearly drafts
  - Delete duplicate files (same content, different names)
  - Remove any generated output files that can be regenerated

- [ ] **4. Check for sensitive content**
  - Scan archive for any accidentally committed secrets, API keys, or personal data
  - Remove or redact if found

- [ ] **5. Verify no active docs reference archived files**
  - `grep -rn 'docs/archive' docs/ CLAUDE.md src/` — should return nothing from active code
  - If references exist, update them to point to current docs

## Acceptance Criteria
- `docs/archive/README.md` exists with clear organization
- No empty or duplicate files in archive
- No sensitive content in archive
- No active code references archived files
- Archive is navigable for historical research

## Files Affected
| Action | Path |
|--------|------|
| CREATE | `docs/archive/README.md` |
| DELETE | Empty/duplicate archive files |
| AUDIT | All files in `docs/archive/` |

## Verification Gate
- [ ] `docs/archive/README.md` created
- [ ] No broken references from active docs to archive
- [ ] No sensitive content in archive
