# AR-48: Fact Data Quality Fix — Domain Names, Variants, True/False

**Status:** Complete
**Created:** 2026-03-16
**Completed:** 2026-03-16
**Depends on:** AR-46 (complete)

## Overview

Player reported Einstein Nobel Prize true/false question appearing in Food & World Cuisine domain with only "False" as an answer option. Investigation found 3 root causes:

1. **189 knowledge facts have non-canonical domain names** (e.g., "Physics", "Planets & Moons", "Gods & Deities") that don't match the `DOMAIN_TO_CATEGORY` mapping in `runPoolBuilder.ts`, causing them to potentially appear in wrong domains
2. **True/false variants may have empty/missing distractors**, causing only one answer to render
3. **Variant data inconsistency** — some variants use `answer` field, others use `correctAnswer`

## Deliverables

Total: 3 fixes in seed files, 1 build script enhancement, DB rebuild

## Tasks

### Section A: Fix Non-Canonical Domain Names in Seed Files

- [x] **A.1** Create `scripts/content-pipeline/fix-domain-names.mjs` — script that reads all `src/data/seed/knowledge-*.json` files and normalizes `domain` and `categoryL1` to canonical names
  - Map: "Physics"/"Science"/"Science & Technology" → "Natural Sciences"
  - Map: "Planets & Moons"/"Astronomy" → "Space & Astronomy"
  - Map: "Gods & Deities"/"Creatures & Monsters"/"Creation & Cosmology"/"Folk Legends"/"Religion & Mythology" → "Mythology & Folklore"
  - Map: "Literary Art"/"Film Art"/"Architecture"/"Art & Culture" → "Art & Architecture"
  - Map: "Mathematics"/"Math" → "Natural Sciences"
  - Map: "Biology" → "Natural Sciences"
  - Map: "Beverages"/"Food & Cuisine" → "Food & World Cuisine"
  - Map: "Culture"/"Education"/"Linguistics"/"Philosophy"/"Politics & Society"/"Religion" → "General Knowledge"
  - Map: "animals_wildlife" → "Animals & Wildlife" (snake_case to display)
  - Map: "art_architecture" → "Art & Architecture"
  - Map: "general_knowledge" → "General Knowledge"
  - Also fix `subdomain` and `categoryL2` if they use display names instead of snake_case IDs
  - Acceptance: Script runs, reports number of fixes per file
- [x] **A.2** Run the fix script with --write
  - Acceptance: 0 non-canonical domain names remain in seed files
  - **Result:** 171 domain names fixed across 10 seed files. Added "History & Civilization" → "History" mapping (40 extra facts found). 0 non-canonical domains remaining.

### Section B: Fix True/False Variant Distractors

- [x] **B.1** Create `scripts/content-pipeline/fix-tf-variants.mjs` — script that scans all seed files for variants with type "true_false" and ensures:
  - If answer is "True", distractors must include "False" (and vice versa)
  - If distractors is empty `[]` or missing, set it to the opposite of the answer
  - Normalize variant answer field: ensure `answer` field exists (not just `correctAnswer`)
  - Acceptance: Script fixes all broken true/false variants
- [x] **B.2** Run the fix script with --write
  - Acceptance: All true_false variants have exactly 1 distractor (the opposite boolean)
  - **Result:** 250 true/false distractor fixes, 216 answer field normalizations, 468 empty variant distractor backfills = 934 total variant fixes. Also handles string variants (skips malformed entries).

### Section C: Fix Variant Answer Field Consistency

- [x] **C.1** In the same or separate script, normalize all variants to have `answer` field (the field that CardCombatOverlay reads first)
  - If variant has `correctAnswer` but no `answer`, copy `correctAnswer` to `answer`
  - Acceptance: All variants have `answer` field
  - **Result:** Covered by B.1 (answer field normalizations included)

### Section D: Rebuild & Verify

- [x] **D.1** Rebuild DB: `node scripts/build-facts-db.mjs`
  - Acceptance: 0 non-canonical domains in rebuilt DB
  - **Result:** DB rebuilt — 99,958 facts, 0 non-canonical domains
- [x] **D.2** Verify: query DB for non-canonical domain names — expect 0
  - **Result:** Verified clean
- [x] **D.3** Run typecheck: `npm run typecheck`
  - Acceptance: 0 errors
  - **Result:** Typecheck clean (0 errors)
- [x] **D.4** Run unit tests: `npx vitest run`
  - Acceptance: No new failures
  - **Result:** Pre-existing test failures only (same as before)

## Verification Gate

- [x] `npm run typecheck` — clean
- [x] DB query shows 0 non-canonical domain names
- [x] All true_false variants have proper distractors
- [x] Visual test: start a Food domain run, verify no cross-domain facts appear

## Files Affected

| File | Action | Task |
|------|--------|------|
| `scripts/content-pipeline/fix-domain-names.mjs` | NEW | A.1 |
| `scripts/content-pipeline/fix-tf-variants.mjs` | NEW | B.1 |
| `src/data/seed/knowledge-*.json` (10 files) | EDIT | A.2, B.2, C.1 |
| `public/facts.db` | REBUILD | D.1 |
| `public/seed-pack.json` | REBUILD | D.1 |
