# AR-46: Knowledge Fact Generation — Round 2 (20 entities × 10 domains)

**Status:** In Progress
**Created:** 2026-03-16
**Depends on:** AR-43 (Round 1 complete)

---

## Overview

Generate knowledge facts from the next 20 unprocessed entities per domain across all 10 domains. Same workflow as AR-43 but 2x scale.

## TODO

1. [ ] Extract next 20 unprocessed entities per domain from curated entity files
2. [ ] Launch 10 parallel Sonnet workers (one per domain, 20 entities each)
3. [ ] QA spot-check 2-3 facts per domain before merge
4. [ ] Save batch files to `data/generated/knowledge/ar46-{domain}-b1.json`
5. [ ] Merge into seed files, mark entities processed
6. [ ] Rebuild DB
7. [ ] Update progress doc

## Acceptance Criteria

- [ ] ~600 new facts across 10 domains (est. 3-5 per entity × 20 entities × 10 domains, minus skips)
- [ ] QA spot-check passes
- [ ] DB rebuilt with updated totals
- [ ] Progress doc updated

## Files Affected

- `data/curated/{domain}/entities.json` — mark 20 entities processed per domain
- `data/generated/knowledge/ar46-*.json` — batch output files
- `src/data/seed/knowledge-*.json` — merged facts
- `public/facts.db` — rebuilt
- `docs/RESEARCH/SOURCES/content-pipeline-progress.md` — updated counts
