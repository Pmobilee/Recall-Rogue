# AR-98: Consolidate Parental Control Stores & Duplicate Type Definitions

## Overview
Two overlapping parental control stores exist (`parentalControls.ts` and `parentalStore.ts`). Additionally, `src/data/types.ts` has duplicate interface definitions. This AR consolidates both into clean single sources of truth.

**Complexity**: Low
**Risk**: Low
**Dependencies**: None

## TODO Checklist

- [x] **1. Audit parental control duplication**
  - Read `src/ui/stores/parentalControls.ts` (41 lines)
  - Read `src/ui/stores/parentalStore.ts` (110 lines)
  - Map all consumers of each store
  - Determine which is the "real" store vs the wrapper

- [x] **2. Consolidate into single `parentalStore.ts`**
  - Merge functionality from `parentalControls.ts` into `parentalStore.ts`
  - Keep the richer store (parentalStore) as the base
  - Add any missing interval tracking from parentalControls
  - Delete `parentalControls.ts`

- [x] **3. Update all imports**
  - Redirect any `parentalControls` imports to `parentalStore`
  - Verify no broken references

- [x] **4. Fix duplicate type definitions in `src/data/types.ts`**
  - Consolidate duplicate `RelicDefinition` interface (appears 2x)
  - Consolidate duplicate `DomainMetadata` interface (appears 2x)
  - Verify all consumers reference the single definition

- [x] **5. Scan for other type duplications**
  - Search for interfaces/types defined in multiple files
  - Consolidate any found duplicates into canonical locations

## Acceptance Criteria
- Single `parentalStore.ts` handles all parental control logic
- `parentalControls.ts` deleted
- No duplicate type definitions in `types.ts`
- All tests pass, no runtime errors

## Files Affected
| Action | Path |
|--------|------|
| DELETE | `src/ui/stores/parentalControls.ts` |
| EDIT | `src/ui/stores/parentalStore.ts` (consolidate) |
| EDIT | `src/data/types.ts` (remove duplicate interfaces) |
| EDIT | Any files importing from `parentalControls` |

## Verification Gate
- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] `npx vitest run` — all tests pass
- [x] `grep -r 'parentalControls' src/` returns nothing
