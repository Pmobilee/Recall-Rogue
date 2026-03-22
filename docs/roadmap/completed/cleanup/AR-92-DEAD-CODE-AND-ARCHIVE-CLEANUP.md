# AR-92: Dead Code & Archive Cleanup

## Overview
Remove all dead, archived, and unreferenced code from the repository. This includes archived Svelte components, old seed data files, database backup files, and stale generated data backups. Goal: reduce repo bloat by ~200MB and eliminate confusion from dead code.

**Complexity**: Low
**Risk**: Low (all targets verified as unreferenced)
**Dependencies**: None

## TODO Checklist

- [x] **1. Delete `src/_archived/` directory** (4 files, 16KB)
  - `ArchetypeSelection.svelte` — replaced by current onboarding
  - `ComboCounter.svelte` — replaced by new combo system
  - `StarterRelicSelection.svelte` — removed feature
  - `comboDisplay.ts` — utility for dead feature
  - **Verify**: `grep -r '_archived/' src/` returns nothing (no imports)

- [x] **2. Delete `src/_archived-seed/` directory** (~98MB)
  - `facts-generated.json` (47MB) — old fact generation output
  - `facts-general-a.json`, `facts-general-b.json`, `facts-general-c.json` — old fact seeds
  - `vocab-n3.json.bak` — old vocab backup
  - **Verify**: `grep -r '_archived-seed' src/` returns nothing

- [x] **3. Remove database backup files** (~76MB)
  - `public/facts.db.pre-sweep-backup` (38MB)
  - `dist/facts.db.pre-sweep-backup` (38MB)
  - **Verify**: Current `facts.db` is stable and in use

- [x] **4. Clean old JSONL backup files in `data/generated/`**
  - Remove all `*.backup-*` timestamped files (18+ files)
  - Keep only the current `.jsonl` files per domain
  - **Verify**: Content pipeline still works with `npm run content:verify`

- [x] **5. Remove `.DS_Store` files** (12+ files scattered in data/)
  - Run: `find . -name .DS_Store -type f -delete`
  - Verify `.gitignore` includes `.DS_Store` (it does)

- [x] **6. Clean stale playtest logs older than 30 days**
  - Archive or remove old logs in `data/playtests/logs/` (578 files)
  - Keep most recent 50 logs for analysis continuity
  - **Verify**: Playtest dashboard still loads: `npm run playtest:dashboard`

- [x] **7. Verify `.gitignore` completeness**
  - Ensure `*.backup-*`, `*.pre-sweep-backup`, `.DS_Store` patterns exist
  - Add any missing patterns to prevent future accumulation

## Acceptance Criteria
- `src/_archived/` and `src/_archived-seed/` directories no longer exist
- No database backup files in `public/` or `dist/`
- `npm run typecheck` passes
- `npm run build` passes
- `npx vitest run` passes (all 240+ tests)
- Repo size reduced by at least 150MB

## Files Affected
| Action | Path |
|--------|------|
| DELETE | `src/_archived/` (entire directory) |
| DELETE | `src/_archived-seed/` (entire directory) |
| DELETE | `public/facts.db.pre-sweep-backup` |
| DELETE | `dist/facts.db.pre-sweep-backup` |
| DELETE | `data/generated/*.backup-*` (18+ files) |
| DELETE | Various `.DS_Store` files |
| PRUNE | `data/playtests/logs/` (keep recent 50) |
| EDIT | `.gitignore` (add missing patterns) |

## Verification Gate
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npx vitest run` — all tests pass
- [x] `git status` shows only intended deletions
- [x] No broken imports in codebase
