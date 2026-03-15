# AR-38: Knowledge Fact Generation — Round 1

**Status:** In Progress
**Created:** 2026-03-15
**Depends on:** AR-34 (complete — entity curation + generation infrastructure)
**Canonical Spec:** `docs/RESEARCH/SOURCES/content-pipeline-spec.md`

## Overview

Generate 100 validated knowledge facts per domain across all 10 domains (1,000 total target). Uses the curated entity pipeline from AR-34: split-batches → Sonnet workers → 11-gate validation → merge to seed files → rebuild DB.

Each Sonnet worker receives 10 curated entities and generates 3-4 facts per entity (~30-40 per batch). To reach 100 validated facts per domain at ~80% pass rate, we need ~125 raw facts = ~4 batches of 10 entities each.

## Deliverables
Total: 10 seed files updated, 1 database rebuild, 1 manifest update

## Tasks

### Section A: Generate Facts — Batch 1 (all 10 domains, 10 entities each)

- [ ] **A.1** Split 10 entities per domain via `split-batches.mjs --max-batches 1`
- [ ] **A.2** Spawn 5 parallel Sonnet workers (2 domains each) to generate ~30 facts per domain
- [ ] **A.3** Validate all 10 outputs via `validate-batch.mjs --fix`
- [ ] **A.4** Merge validated facts into seed files via `merge-batches.mjs`
- [ ] **A.5** Rebuild DB via `node scripts/build-facts-db.mjs`
- [ ] **A.6** Log counts: expected ~250 validated facts across 10 domains

### Section B: Generate Facts — Batch 2 (all 10 domains, next 10 entities each)

- [ ] **B.1** Split next 10 entities per domain
- [ ] **B.2** Spawn 5 parallel Sonnet workers (2 domains each)
- [ ] **B.3** Validate all 10 outputs via `validate-batch.mjs --fix`
- [ ] **B.4** Merge validated facts into seed files
- [ ] **B.5** Rebuild DB
- [ ] **B.6** Log counts: expected ~500 cumulative

### Section C: Generate Facts — Batch 3 (all 10 domains, next 10 entities each)

- [ ] **C.1** Split next 10 entities per domain
- [ ] **C.2** Spawn 5 parallel Sonnet workers (2 domains each)
- [ ] **C.3** Validate all 10 outputs via `validate-batch.mjs --fix`
- [ ] **C.4** Merge validated facts into seed files
- [ ] **C.5** Rebuild DB
- [ ] **C.6** Log counts: expected ~750 cumulative

### Section D: Generate Facts — Batch 4 (top-up to reach 100/domain)

- [ ] **D.1** Check which domains are below 100 validated facts
- [ ] **D.2** Generate additional batches only for domains below target
- [ ] **D.3** Validate and merge
- [ ] **D.4** Rebuild DB
- [ ] **D.5** Log final counts per domain — all must be ≥100

### Section E: Finalize

- [ ] **E.1** Mark processed entities as `processed: true` in `data/curated/{domain}/entities.json`
- [ ] **E.2** Update `manifest.json` with generated entity Q-IDs and fact counts
- [ ] **E.3** Update `docs/RESEARCH/SOURCES/content-pipeline-progress.md` with final counts
- [ ] **E.4** Run `quality-report.mjs` for cross-domain summary
- [ ] **E.5** Run `npm run typecheck` — clean
- [ ] **E.6** Run `npx vitest run` — no new failures

## Verification Gate

- [ ] Every domain has ≥100 validated knowledge facts in its seed file
- [ ] `node scripts/build-facts-db.mjs` completes without errors
- [ ] `node scripts/content-pipeline/knowledge/quality-report.mjs` shows all domains populated
- [ ] No duplicate fact IDs across domains
- [ ] `manifest.json` entity counts match actual processed entities

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/data/seed/knowledge-animals_wildlife.json` | UPDATE | A-D |
| `src/data/seed/knowledge-history.json` | UPDATE | A-D |
| `src/data/seed/knowledge-space_astronomy.json` | UPDATE | A-D |
| `src/data/seed/knowledge-natural_sciences.json` | UPDATE | A-D |
| `src/data/seed/knowledge-general_knowledge.json` | UPDATE | A-D |
| `src/data/seed/knowledge-mythology_folklore.json` | UPDATE | A-D |
| `src/data/seed/knowledge-human_body_health.json` | UPDATE | A-D |
| `src/data/seed/knowledge-food_cuisine.json` | UPDATE | A-D |
| `src/data/seed/knowledge-art_architecture.json` | UPDATE | A-D |
| `src/data/seed/knowledge-geography.json` | UPDATE | A-D |
| `scripts/content-pipeline/knowledge/manifest.json` | UPDATE | E.2 |
| `docs/RESEARCH/SOURCES/content-pipeline-progress.md` | UPDATE | E.3 |
| `public/facts.db` | REBUILD | A.5, B.5, C.5, D.4 |
| `public/seed-pack.json` | REBUILD | A.5, B.5, C.5, D.4 |
