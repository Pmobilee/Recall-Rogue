# AR-121: Knowledge Fact Source Verification & Regeneration

**Status:** FUTURE
**Priority:** Medium — all 4,681 knowledge facts are marked verified, but verification tooling is incomplete
**Scope:** Knowledge facts ONLY (4,681) — vocab facts (105,976) are excluded, they don't need source verification

---

## Problem Statement

AR-108 built the grounded fact pipeline and successfully generated 4,681 verified knowledge facts. However, two pieces remain:

1. **No automated source verification script** — there's no tooling to programmatically cross-check that numbers in generated facts match their Wikipedia/Wikidata source data
2. **No full knowledge corpus regeneration** — only pilot domains were regenerated with the grounded pipeline; remaining knowledge facts from older batches may still contain unverified claims
3. **No `source_verified` DB index** — if runtime ever needs to filter by verification status, it'll do a full table scan

---

## Sub-Steps

### Phase A: Verification Tooling (no LLM needed)

- [ ] **A1.** Build `scripts/content-pipeline/verify-sources.mjs` — pure numerical cross-checker:
  - Extract all numbers from a fact's `correct_answer` and `explanation`
  - Load the corresponding entity's Wikipedia extract + Wikidata claims from `data/curated/{domain}/entities-enriched.json`
  - Check each number appears in the source data (fuzzy match for rounding)
  - Output a report: `{factId, claimedNumber, foundInSource: bool, sourceField}`
- [ ] **A2.** Run verification gate on all 4,681 knowledge facts — quantify how many have numbers not traceable to source data
- [ ] **A3.** Add DB index: `CREATE INDEX idx_facts_source_verified ON facts(source_verified)`

### Phase B: Knowledge Fact Regeneration (requires LLM)

- [ ] **B1.** Identify which knowledge domains still have unverified facts (check `source_verified = 0` by `category_l1`)
- [ ] **B2.** Enrich remaining knowledge entities via `enrich-entities.mjs`
- [ ] **B3.** Regenerate knowledge facts domain-by-domain using the AR-108 grounded pipeline
- [ ] **B4.** Run source verification gate (A1) on newly generated facts
- [ ] **B5.** Rebuild DB after each domain completes

---

## Out of Scope

- **Vocabulary facts (105,976)** — these are language learning items (translations, pronunciation, example sentences), not factual claims. They don't need Wikipedia/Wikidata source verification.
- **Distractor regeneration** — distractors are already high quality per AR-108 pipeline and brace marker system.

---

## Acceptance Criteria

- [ ] verify-sources.mjs runs on all knowledge facts and produces a pass/fail report
- [ ] All regenerated knowledge facts have `source_verified = 1`
- [ ] Every numerical claim in knowledge facts is traceable to Wikipedia or Wikidata
- [ ] DB rebuild succeeds with 0 invalid subcategories
- [ ] `npm run typecheck` and `npm run build` pass

---

## Files Affected

| File | Action |
|------|--------|
| `scripts/content-pipeline/verify-sources.mjs` | CREATE |
| `scripts/build-facts-db.mjs` | UPDATE — add source_verified index |
| `src/data/seed/knowledge-*.json` | UPDATE — regenerated facts (Phase B) |
| `data/curated/{domain}/entities-enriched.json` | UPDATE — new entity enrichments |
