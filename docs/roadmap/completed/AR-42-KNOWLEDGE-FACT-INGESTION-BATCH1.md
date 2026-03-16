# AR-42 — Knowledge Fact Ingestion (Incremental Batches)

## Overview
Incremental knowledge fact generation across all 10 domains. Each session generates ~1 entity per domain (3-5 facts each) to slowly build up the knowledge database while staying within token budgets.

**Dependencies:** AR-34 (infrastructure complete)
**Complexity:** Low per batch, ongoing

## Approach
1. Pick 1 unprocessed entity per domain from curated entity lists
2. Spawn parallel Sonnet workers (1 per domain) with full worker prompt template
3. Validate output, merge into seed files, rebuild DB
4. Mark entities as processed, update progress tracker
5. Repeat in future sessions

## Batch 1 — 2026-03-15
Entities selected:
- animals_wildlife: horse
- art_architecture: Academy Awards
- food_cuisine: Pizza
- general_knowledge: book
- geography: France
- history: Plato
- human_body_health: biology
- mythology_folklore: Ambrose
- natural_sciences: Earth
- space_astronomy: Edwin Hubble

## Acceptance Criteria
- [ ] Each domain has 3-5 new validated facts
- [ ] All facts pass schema validation (28 fields)
- [ ] All facts have 8+ quality distractors
- [ ] Seed files updated
- [ ] DB rebuilt
- [ ] Progress tracker updated
- [ ] Entities marked processed in curated lists

## Files Affected
- `src/data/seed/knowledge-{domain}.json` (all 10)
- `data/curated/{domain}/entities.json` (all 10 — mark processed)
- `docs/RESEARCH/SOURCES/content-pipeline-progress.md`
- `public/facts.db`
- `public/seed-pack.json`

## Verification Gate
- [ ] `node scripts/build-facts-db.mjs` succeeds
- [ ] `node scripts/content-pipeline/count-invalid-l2.mjs` returns 0
- [ ] Fact counts increased in all 10 domains
