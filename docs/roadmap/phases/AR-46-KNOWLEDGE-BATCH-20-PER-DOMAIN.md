# AR-46: Knowledge Fact Generation — 20 Entities Per Domain

**Status:** In Progress
**Created:** 2026-03-16
**Depends on:** AR-34 (complete — pipeline infrastructure built)

## Overview

Generate knowledge facts from the next 20 unprocessed entities in each of the 10 domains using the curated entity pipeline. Expected output: ~400-600 new facts (2-3 facts per entity average), bringing the total from ~1,957 to ~2,500+.

## Deliverables

Total: 10 domain batches generated, validated, merged, and promoted. DB rebuilt.

## Tasks

### Section A: Generate Facts (Parallel Sonnet Workers)

For each domain, spawn a Sonnet worker with 20 unprocessed entities from `data/curated/{domain}/entities.json`. Workers use the system prompt at `scripts/content-pipeline/knowledge/worker-prompt-template.md`.

- [ ] **A.1** Animals & Wildlife — entities index 36-55 (20 entities)
- [ ] **A.2** Art & Architecture — entities index 15-34 (20 entities)
- [ ] **A.3** Food & Cuisine — entities index 37-56 (20 entities)
- [ ] **A.4** General Knowledge — entities index 36-55 (20 entities)
- [ ] **A.5** Geography — entities index 37-56 (20 entities)
- [ ] **A.6** History — entities index 37-56 (20 entities)
- [ ] **A.7** Human Body & Health — entities index 32-51 (20 entities)
- [ ] **A.8** Mythology & Folklore — entities index 36-55 (20 entities)
- [ ] **A.9** Natural Sciences — entities index 35-54 (20 entities)
- [ ] **A.10** Space & Astronomy — entities index 36-55 (20 entities, noting only 47 unprocessed remain — use all available up to 20)

Acceptance per task: Sonnet worker returns valid JSON array of facts with all 28 fields per the output schema.

### Section B: Validate & Merge

- [ ] **B.1** Run validation gates on all 10 domain outputs — flag failures
  - Acceptance: Each batch has >75% pass rate on 11-gate validation
- [ ] **B.2** QA spot-check — read 2-3 random facts per domain, verify quality
  - Acceptance: No answer-in-question, no circular explanations, no garbage distractors
- [ ] **B.3** Merge validated facts into `src/data/seed/knowledge-{domain}.json` (10 files)
  - Acceptance: Each seed file has increased fact count
- [ ] **B.4** Mark processed entities in `data/curated/{domain}/entities.json` (10 files)
  - Acceptance: 20 entities per domain now have `processed: true`

### Section C: Rebuild & Verify

- [ ] **C.1** Backfill subcategories: `node scripts/content-pipeline/backfill-subcategories.mjs --write --force --min-score=1`
  - Acceptance: Exit code 0
- [ ] **C.2** Rebuild DB: `node scripts/build-facts-db.mjs`
  - Acceptance: Exit code 0, DB file updated
- [ ] **C.3** Verify no invalid L2: `node scripts/content-pipeline/count-invalid-l2.mjs`
  - Acceptance: 0 invalid facts
- [ ] **C.4** Run typecheck: `npm run typecheck`
  - Acceptance: Clean
- [ ] **C.5** Run unit tests: `npx vitest run`
  - Acceptance: All pass

### Section D: Update Tracking

- [ ] **D.1** Update `docs/RESEARCH/SOURCES/content-pipeline-progress.md` — new fact counts per domain
- [ ] **D.2** Update manifest if applicable

## Verification Gate

- [ ] `npm run typecheck` — clean
- [ ] `npx vitest run` — all pass
- [ ] `node scripts/content-pipeline/count-invalid-l2.mjs` — 0 invalid
- [ ] All section tasks checked off above
- [ ] Content pipeline progress doc updated with new totals

## Files Affected

| File | Action | Task |
|------|--------|------|
| `data/generated/knowledge/ar46-*-b1.json` | NEW | A.1-A.10 |
| `src/data/seed/knowledge-*.json` (10 files) | EDIT | B.3 |
| `data/curated/*/entities.json` (10 files) | EDIT | B.4 |
| `public/facts.db` | REBUILD | C.2 |
| `public/seed-pack.json` | REBUILD | C.2 |
| `docs/RESEARCH/SOURCES/content-pipeline-progress.md` | EDIT | D.1 |
