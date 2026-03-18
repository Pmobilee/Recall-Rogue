# AR-103: Dependency Audit & Bundle Size Optimization

## Overview
Audit all npm dependencies for: unused packages, outdated versions with security vulnerabilities, packages that could be replaced with lighter alternatives, and bundle size impact. The game targets mobile — every KB matters.

**Complexity**: Medium
**Risk**: Low-Medium (dependency changes can cause subtle breakage)
**Dependencies**: None

## TODO Checklist

- [ ] **1. Identify unused dependencies**
  - Run: `npx depcheck` (or manual grep for each dependency)
  - For each dependency in `package.json`:
    - `grep -rn 'package-name' src/ scripts/ server/ tests/` — is it imported?
    - Check if it's only used in scripts/ but listed in dependencies (should be devDependencies)
  - List: used, unused, misplaced (dep vs devDep)

- [ ] **2. Run security audit**
  - `npm audit` — document all findings
  - `npm audit fix` — apply safe fixes
  - For remaining: evaluate if upgrade is safe or if package should be replaced

- [ ] **3. Analyze bundle size impact**
  - Run: `ANALYZE=true npm run build` (uses rollup-plugin-visualizer)
  - Identify top 10 largest chunks
  - Look for:
    - Large dependencies that could be lazy-loaded
    - Dependencies with lighter alternatives
    - Tree-shaking opportunities (are we importing entire packages for one function?)

- [ ] **4. Move misplaced dependencies**
  - Scripts-only packages should be in devDependencies
  - Test-only packages should be in devDependencies
  - Build-only packages should be in devDependencies

- [ ] **5. Remove unused dependencies**
  - Uninstall confirmed unused packages
  - Verify build still works after each removal

- [ ] **6. Check for lighter alternatives**
  - Common candidates:
    - Any date library → could use native Intl/Date?
    - Any utility library → could use native JS?
    - Check if `sql-wasm` has a lighter variant
  - Only replace if benefit is clear and migration is safe

- [ ] **7. Verify production bundle size**
  - Record bundle sizes before and after
  - Target: no increase, ideally 5-10% decrease
  - Check chunk sizes stay under 500KB warning limit

## Acceptance Criteria
- Zero unused dependencies in package.json
- All dependencies correctly categorized (dep vs devDep)
- No known security vulnerabilities (or documented exceptions)
- Bundle size same or smaller
- All tests pass after dependency changes

## Files Affected
| Action | Path |
|--------|------|
| EDIT | `package.json` (remove/move dependencies) |
| EDIT | `package-lock.json` (regenerated) |
| MAYBE EDIT | Import statements (if replacing a dependency) |

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` — all tests pass
- [ ] `npm audit` shows no critical/high vulnerabilities
- [ ] Bundle size recorded and compared to pre-cleanup
- [ ] `npm run check-bundle-size` passes
