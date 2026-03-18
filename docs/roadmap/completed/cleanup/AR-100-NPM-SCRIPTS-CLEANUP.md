# AR-100: npm Scripts Audit & Cleanup

## Overview
`package.json` contains 102 npm scripts. Many may be stale, duplicative, or point to scripts that no longer exist. Audit every script, remove dead ones, consolidate duplicates, and add descriptions via a scripts reference doc.

**Complexity**: Medium
**Risk**: Low (only removing/renaming scripts, not code)
**Dependencies**: None

## TODO Checklist

- [ ] **1. Audit all 102 scripts for validity**
  - For each script: verify the target file/command exists
  - Flag scripts whose targets have been moved/deleted
  - Flag scripts that duplicate another script's function
  - List: broken, duplicate, stale, active

- [ ] **2. Remove broken scripts**
  - Delete scripts pointing to non-existent files
  - Delete scripts for removed features

- [ ] **3. Consolidate duplicate scripts**
  - Example candidates:
    - `test:unit:critical` vs `test` — are they redundant?
    - `build` vs `build:web` — is `build:web` actually different?
    - `content:qa` family — any that overlap?
    - `balance:*` family — any that can be merged?
  - Keep the most descriptive name

- [ ] **4. Organize scripts by namespace**
  - Ensure consistent namespacing: `content:*`, `balance:*`, `playtest:*`, `test:*`, `build:*`
  - Rename any that break convention

- [ ] **5. Verify remaining scripts all work**
  - Spot-check at least 10 critical scripts:
    - `npm run dev`, `npm run build`, `npm run typecheck`, `npm run test`
    - `npm run content:verify`, `npm run balance:sanity`
    - `npm run playtest:dashboard`
  - Fix any that are broken

- [ ] **6. Update docs/TESTING-GUIDE.md with current script list**
  - Add table of all scripts with one-line descriptions
  - Group by category (dev, build, test, content, balance, deploy)

## Acceptance Criteria
- All remaining scripts in package.json point to valid targets
- No duplicate scripts
- Consistent namespace conventions
- At least 10 critical scripts verified working
- Script count reduced (target: <85 scripts)

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `package.json` (remove/consolidate scripts) |
| EDIT | `docs/TESTING-GUIDE.md` (script reference table) |
| MAYBE DELETE | Dead script targets in `scripts/` |

## Verification Gate
- [ ] All remaining scripts resolve (no "missing script" errors)
- [ ] `npm run dev` works
- [ ] `npm run build` works
- [ ] `npm run typecheck` works
- [ ] `npx vitest run` works
- [ ] `npm run content:verify` works
