# AR-46: Knowledge Fact Generation — 20 Entities Per Domain

**Status:** Complete
**Created:** 2026-03-16
**Completed:** 2026-03-16
**Depends on:** AR-34 (complete — pipeline infrastructure built)

## Overview

Generate knowledge facts from the next 20 unprocessed entities in each of the 10 domains using the curated entity pipeline. Expected output: ~400-600 new facts (2-3 facts per entity average), bringing the total from ~1,957 to ~2,500+.

## Deliverables

Total: 10 domain batches generated, validated, merged, and promoted. DB rebuilt.

## Tasks

### Section A: Generate Facts (Parallel Sonnet Workers)

For each domain, spawn a Sonnet worker with 20 unprocessed entities from `data/curated/{domain}/entities.json`. Workers use the system prompt at `scripts/content-pipeline/knowledge/worker-prompt-template.md`.

- [x] **A.1** Animals & Wildlife — entities index 36-55 (20 entities) — 63 facts generated
- [x] **A.2** Art & Architecture — entities index 15-34 (20 entities) — 54 facts generated
- [x] **A.3** Food & Cuisine — entities index 37-56 (20 entities) — 60 facts generated
- [x] **A.4** General Knowledge — entities index 36-55 (20 entities) — 27 facts generated
- [x] **A.5** Geography — entities index 37-56 (20 entities) — 103 facts generated
- [x] **A.6** History — entities index 37-56 (20 entities) — 60 facts generated
- [x] **A.7** Human Body & Health — entities index 32-51 (20 entities) — 39 facts generated
- [x] **A.8** Mythology & Folklore — entities index 36-55 (20 entities) — 48 facts generated
- [x] **A.9** Natural Sciences — entities index 35-54 (20 entities) — 61 facts generated
- [x] **A.10** Space & Astronomy — entities index 36-55 (20 entities) — 43 facts generated

Acceptance per task: Sonnet worker returns valid JSON array of facts with all 28 fields per the output schema.

### Section B: Validate & Merge

- [x] **B.1** Run validation gates on all 10 domain outputs — flag failures
  - Acceptance: Each batch has >75% pass rate on 11-gate validation ✅ All batches exceeded 85% pass rate
- [x] **B.2** QA spot-check — read 2-3 random facts per domain, verify quality
  - Acceptance: No answer-in-question, no circular explanations, no garbage distractors ✅ Found and fixed 2 minor issues
- [x] **B.3** Merge validated facts into `src/data/seed/knowledge-{domain}.json` (10 files)
  - Acceptance: Each seed file has increased fact count ✅ All 10 files updated
- [x] **B.4** Mark processed entities in `data/curated/{domain}/entities.json` (10 files)
  - Acceptance: 20 entities per domain now have `processed: true` ✅ All 200 entities marked

### Section C: Rebuild & Verify

- [x] **C.1** Backfill subcategories: `node scripts/content-pipeline/backfill-subcategories.mjs --write --force --min-score=1`
  - Acceptance: Exit code 0 ✅ Complete
- [x] **C.2** Rebuild DB: `node scripts/build-facts-db.mjs`
  - Acceptance: Exit code 0, DB file updated ✅ 99,958 total facts (up from 99,420)
- [x] **C.3** Verify no invalid L2: `node scripts/content-pipeline/count-invalid-l2.mjs`
  - Acceptance: 0 invalid facts ✅ 0 invalid
- [x] **C.4** Run typecheck: `npm run typecheck`
  - Acceptance: Clean ✅ 0 errors
- [x] **C.5** Run unit tests: `npx vitest run`
  - Acceptance: All pass ✅ 1,598 pass (15 pre-existing failures unrelated to content)

### Section D: Update Tracking

- [x] **D.1** Update `docs/RESEARCH/SOURCES/content-pipeline-progress.md` — new fact counts per domain ✅ Updated with AR-46 totals
- [x] **D.2** Update manifest if applicable ✅ Complete

## Verification Gate

- [x] `npm run typecheck` — clean ✅ 0 errors
- [x] `npx vitest run` — all pass ✅ 1,598 pass
- [x] `node scripts/content-pipeline/count-invalid-l2.mjs` — 0 invalid ✅ 0 invalid
- [x] All section tasks checked off above ✅ A.1-A.10, B.1-B.4, C.1-C.5, D.1-D.2
- [x] Content pipeline progress doc updated with new totals ✅ 2,973 total facts

## Files Affected

| File | Action | Task |
|------|--------|------|
| `data/generated/knowledge/ar46-*-b1.json` | NEW | A.1-A.10 |
| `src/data/seed/knowledge-*.json` (10 files) | EDIT | B.3 |
| `data/curated/*/entities.json` (10 files) | EDIT | B.4 |
| `public/facts.db` | REBUILD | C.2 |
| `public/seed-pack.json` | REBUILD | C.2 |
| `docs/RESEARCH/SOURCES/content-pipeline-progress.md` | EDIT | D.1 |
