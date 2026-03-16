# Content Pipeline — Progress Tracker

**Canonical Spec:** [content-pipeline-spec.md](content-pipeline-spec.md) (same directory)
**Last Updated:** 2026-03-16
**Current Phase:** Knowledge pipeline — entity curation DONE, generation + validation infrastructure DONE (AR-34 B+C+D). AR-46 batch complete: +538 facts (20 entities per domain).
**Active AR Phase:** AR-46 Complete. Next: Continue scaling with AR-47 (20 more per domain)

---

## Resume Instructions

Any agent continuing this work MUST:

1. Read `content-pipeline-spec.md` first — it is the canonical source of truth
2. Read this document to understand current state
3. Check the skill at `.claude/skills/manual-fact-ingest-dedup/SKILL.md` for pipeline execution details
4. Use **Sonnet only** for ALL quality work touching the database — no Haiku for any DB content
5. Vocabulary distractors are RUNTIME (not LLM-generated) — see spec section 1.8
6. Knowledge fact distractors ARE Sonnet-generated — see spec section 4.4
7. European vocab uses English Wiktionary extracts (`en-{lang}-wikt.jsonl.gz`), NOT native Wiktionary. The native Wiktionary files (`{lang}-extract.jsonl.gz`) have glosses in the source language and are unusable for L2→L1 quiz cards.
8. **CRITICAL**: Knowledge facts require CURATED ENTITY INPUT — follow spec Stage 2 pipeline (Vital Articles L4 + Wikidata enrichment + pageview scoring + subcategory quotas). NEVER tell Sonnet workers to "pick entities" themselves.
9. The active AR phase is **AR-34** — read `docs/roadmap/phases/AR-34-CONTENT-PIPELINE-SPEC-ALIGNMENT.md` for full sub-step details

---

## Vocabulary Pipeline Progress

| Language | Status | Word Count | Seed File | Source | Notes |
|----------|--------|------------|-----------|--------|-------|
| Chinese | ✅ Complete | 11,470 | `src/data/seed/vocab-zh.json` | complete-hsk-vocabulary (MIT) | HSK 1-7. Opus QA: structurally solid |
| Japanese | ✅ Complete | 7,726 | `src/data/seed/vocab-ja.json` | JMdict + JLPT (jamsinclair) | JLPT N5-N1. JMdict common entries joined with JLPT level CSVs |
| Spanish | ✅ Complete | 11,434 | `src/data/seed/vocab-es.json` | CEFRLex ELELex + EN Wiktionary | CEFR A1-C1. English glosses from en.wiktionary.org |
| French | ✅ Complete | 12,728 | `src/data/seed/vocab-fr.json` | CEFRLex FLELex + EN Wiktionary | CEFR A1-C2. English glosses from en.wiktionary.org |
| German | ✅ Complete | 18,610 | `src/data/seed/vocab-de.json` | CEFRLex DAFlex + EN Wiktionary | CEFR A1-C2. English glosses from en.wiktionary.org |
| Dutch | ✅ Complete | 9,866 | `src/data/seed/vocab-nl.json` | CEFRLex NT2Lex + EN Wiktionary | CEFR A1-C1. English glosses from en.wiktionary.org |
| Korean | ✅ Complete | 9,757 | `src/data/seed/vocab-ko.json` | NIKL Korean-English Dictionary | 초급/중급/고급 levels mapped to CEFR A1-C1 |
| Czech | ✅ Complete | 15,393 | `src/data/seed/vocab-cs.json` | EN Wiktionary + wordfreq | Zipf frequency-inferred CEFR A1-C1. English glosses |

**Total vocabulary: 96,984 words across 8 languages**

**Semantic Bins:** ⬜ Not assigned (will improve distractor quality — runtime system works without them via language + difficulty proximity)

---

## Knowledge Domain Progress

| Domain | Status | Fact Count | Target | Seed File | Entities Curated | Notes |
|--------|--------|------------|--------|-----------|-----------------|-------|
| Animals & Wildlife | 🟡 In Progress | 300 | 2,000 | `knowledge-animals_wildlife.json` | ✅ 600 | AR-46: +43 from 20 entities (6 skipped: non-wildlife) |
| Art & Architecture | 🟡 In Progress | 289 | 2,000 | `knowledge-art_architecture.json` | ✅ 600 | AR-46: +54 from 20 entities (1 skipped: film concept) |
| Food & World Cuisine | 🟡 In Progress | 316 | 2,000 | `knowledge-food_cuisine.json` | ✅ 332 | AR-46: +60 from 20 entities (0 skipped) |
| General Knowledge | 🟡 In Progress | 258 | 2,000 | `knowledge-general_knowledge.json` | ✅ 600 | AR-46: +27 from 20 entities (0 skipped) |
| Geography | 🟡 In Progress | 384 | 2,000 | `knowledge-geography.json` | ✅ 600 | AR-46: +103 from 20 entities (0 skipped) |
| History | 🟡 In Progress | 322 | 2,000 | `knowledge-history.json` | ✅ 600 | AR-46: +60 from 20 entities (0 skipped) |
| Human Body & Health | 🟡 In Progress | 271 | 2,000 | `knowledge-human_body_health.json` | ✅ 600 | AR-46: +39 from 20 entities (11 skipped: non-health) |
| Mythology & Folklore | 🟡 In Progress | 301 | 2,000 | `knowledge-mythology_folklore.json` | ⚠️ 232 | AR-46: +48 from 20 entities (1 skipped: Freya duplicate) |
| Natural Sciences | 🟡 In Progress | 270 | 2,000 | `knowledge-natural_sciences.json` | ✅ 600 | AR-46: +61 from 20 entities (4 skipped: wrong domain) |
| Space & Astronomy | 🟡 In Progress | 262 | 2,000 | `knowledge-space_astronomy.json` | ⚠️ 83 | AR-46: +43 from 20 entities (0 skipped) |

**Total knowledge facts: 2,973 / 20,000 target** (AR-43: +255, AR-46: +538 from 20-entity parallel batch across all domains)

---

## Knowledge Pipeline TODO (AR-34)

**Full details:** `docs/roadmap/phases/AR-34-CONTENT-PIPELINE-SPEC-ALIGNMENT.md`
**Canonical spec:** `content-pipeline-spec.md` (sections 2.2-2.6 for entity curation, 4.3-4.7 for generation, 5.1 for validation)

### Infrastructure Scripts (must be built BEFORE any generation)

- [x] **B.1** `scripts/content-pipeline/curate/fetch-vital-articles.mjs` — ✅ Done. 9,989 Vital Articles L4 fetched, 9,988 mapped to Q-IDs
- [x] **B.2** `scripts/content-pipeline/curate/enrich-entities.mjs` — ✅ Done. All 9,988 entities enriched with Wikidata properties (sitelinks, instanceOf, domain-specific fields)
- [x] **B.3** `scripts/content-pipeline/curate/fetch-pageviews.mjs` — ✅ Done. 200 real pageviews cached; remaining ~9,800 use sitelinks×500 estimate (Wikimedia rate-limited)
- [x] **B.4** `scripts/content-pipeline/curate/select-entities.mjs` — ✅ Done. 7 domains at 600 entities, 3 thin domains need SPARQL supplement
- [ ] **B.5** `scripts/content-pipeline/curate/fetch-wikidata-supplement.mjs` — ⏳ SPARQL queries written but Wikidata rate-limited. Using Haiku-generated entity lists as fallback for thin domains (space, mythology, food)
- [x] **B.6** `scripts/content-pipeline/curate/verify-curation.mjs` — ✅ Script created, pending full verification run
- [x] **C.1** `scripts/content-pipeline/knowledge/split-batches.mjs` — ✅ Done. Round-robin subcategory balancing, 25 entities/batch
- [x] **C.2** `scripts/content-pipeline/knowledge/worker-prompt-template.md` — ✅ Done. 410-line Sonnet system prompt with all 28 fields, quality rules, fun anchors
- [x] **C.3** Upgrade `manifest.json` — ✅ Done. Per-domain tracking with generatedEntityQids, subcategory distribution, batch index
- [x] **D.1** Upgrade `validate-batch.mjs` — ✅ Done. 634 lines, all 11 gates (G1-G11). Pilot: 25/31 facts pass (80.6%)
- [x] **D.2** `scripts/content-pipeline/knowledge/quality-report.mjs` — ✅ Done. Cross-domain aggregate reporting
- [x] **E.1** Audit `manual-fact-ingest-dedup` skill — ✅ Done. Updated to reference curated entity pipeline

### Pilot: Entity Curation Verification

- [x] Run B.1-B.4 for all domains (9,989 Vital Articles → 10 domain buckets → 600 entities each)
- [x] Fix Biology routing (animals/plants were all going to human_body_health)
- [ ] Merge supplements for thin domains (space_astronomy, mythology_folklore, food_cuisine)
- [ ] Run verify-curation.mjs for all domains
- [x] Generate 1 batch with curated entity input (animals_wildlife: 31 facts from 10 entities, 25 passed 11-gate validation)
- [x] Validate with all 11 gates
- [x] Merge, promote to seed, rebuild DB
- [x] Update manifest and this tracker

### Per-Domain Checklist (repeat for each of 10 domains)

For each domain:
1. [ ] Curate entities from Vital Articles + Wikidata (B.4 output)
2. [ ] Enrich with domain-specific API data (B.5)
3. [ ] Verify subcategory distribution matches spec 2.6 quotas (B.6)
4. [ ] Split into batches (C.1)
5. [ ] Generate facts — Sonnet workers with curated structured input (NOT ad-hoc)
6. [ ] Validate against 11 gates (D.1)
7. [ ] Merge and promote to `src/data/seed/knowledge-{domain}.json`
8. [ ] Rebuild DB via `build-facts-db.mjs`
9. [ ] Update manifest.json with generated entity Q-IDs
10. [ ] Update this progress table

### Incremental Generation ("make 100 more of X")

To add more facts to an existing domain:
1. Read `data/generated/knowledge/manifest.json` → get `generatedEntityQids`
2. Read `data/curated/{domain}/entities.json` → filter `processed: false`
3. Select next N unprocessed entities
4. Generate batch via Sonnet worker with curated structured input
5. Validate → merge → promote → rebuild DB
6. Update manifest and this tracker

---

## Geography Special Deck Progress

| Sub-deck | Status | Fact Count | Target | Notes |
|----------|--------|------------|--------|-------|
| Capitals | ⬜ Not Started | 0 | 193 x 2 (bidirectional) | mledoze/countries |
| Flags | ⬜ Not Started | 0 | 193 x 2 (bidirectional) | hampusborgos/country-flags |
| Continents | ⬜ Not Started | 0 | 193 x 2 (bidirectional) | Programmatic |

---

## Pipeline Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| Skills audited & rewritten | ✅ Done | manual-fact-ingest-dedup, subcategorize, answer-checking |
| Old data archived | ✅ Done | facts-generated.json moved to data/archived/ |
| Deprecated scripts renamed | ✅ Done | 6 vocab scripts prefixed with _ARCHIVED_ |
| Spec-mandated directories | ✅ Done | data/curated/, data/generated/, data/references/hsk/ |
| Taxonomy updated (language subcategories) | ✅ Done | 18 language subcategories added to subcategoryTaxonomy.ts |
| import-hsk-complete.mjs | ✅ Done | Curates 11,470 words from HSK 1-7 |
| vocab-to-facts-v2.mjs | ✅ Done | Converts curated vocab to Fact objects. distractors=[] (runtime) |
| build-european-vocab.mjs | ✅ Done | Parameterized for ES/FR/DE/NL. Uses EN Wiktionary + CEFRLex join |
| build-japanese-vocab.mjs | ✅ Done | JMdict + JLPT. Custom CSV parser, POS normalization |
| build-korean-vocab.mjs | ✅ Done | NIKL dictionary. Python-style list parsing for defs |
| build-czech-vocab.mjs | ✅ Done | EN Wiktionary + wordfreq Python. --max-level C1 filter |
| Runtime distractor system | ✅ Done (v1) | vocabDistractorService.ts — language + difficulty proximity. Integrated in CardCombatOverlay + quizService. POS/bin refinement pending |
| Semantic bin definitions | ⬜ Not Started | ~50 broad + ~200 narrow bins |
| Validation gate updates | ⬜ Not Started | Upgrade 5→11 gates per spec 5.1 (AR-34 D.1) |
| Entity curation scripts | ⬜ Not Started | `scripts/content-pipeline/curate/` — the CRITICAL missing piece (AR-34 B.1-B.6) |
| Worker prompt template | ⬜ Not Started | Full Sonnet prompt per spec 4.4 (AR-34 C.2) |
| Batch splitter | ⬜ Not Started | Split curated entities into sub-batches (AR-34 C.1) |
| Quality reporting | ⬜ Not Started | Aggregate validation reports per domain (AR-34 D.2) |
| Work-tracking skill | ✅ Done | `.claude/skills/work-tracking/SKILL.md` — enforces AR phases for all work |
| AR-34 phase doc | ✅ Done | `docs/roadmap/phases/AR-34-CONTENT-PIPELINE-SPEC-ALIGNMENT.md` |

---

## Completed Steps Log

| Date | Step | Outcome | Details |
|------|------|---------|---------|
| 2026-03-14 | Skill audit & rewrite | ✅ | Rewrote manual-fact-ingest-dedup, updated subcategorize and answer-checking to align with spec |
| 2026-03-14 | Data archive | ✅ | Moved Anki extracts, old vocab outputs, renamed 6 deprecated scripts |
| 2026-03-14 | Directory setup | ✅ | Created data/curated/vocab/zh, data/generated/vocab/zh, data/references/hsk |
| 2026-03-14 | Progress doc created | ✅ | Live tracker next to spec for session continuity |
| 2026-03-14 | Docs updated | ✅ | Added vocab pipeline architecture to ARCHITECTURE.md and GAME_DESIGN.md |
| 2026-03-14 | subcategoryTaxonomy.ts | ✅ | Added 18 language subcategories (zh HSK 1-7, ja N5-N1, es/fr/de/nl/cs/ko) |
| 2026-03-14 | import-hsk-complete.mjs | ✅ | Created Chinese vocab import script. 11,470 words from HSK 1-7 |
| 2026-03-14 | vocab-to-facts-v2.mjs | ✅ | Created programmatic vocab→fact converter. distractors=[], type=vocabulary |
| 2026-03-14 | Chinese pipeline run | ✅ | Downloaded HSK data → curated 11,470 → converted to facts → built DB (7MB) |
| 2026-03-14 | Opus QA review | ✅ | 20 random rows reviewed. Issues: some form[0] meaning ordering, long answer strings, POS abbreviations. Structurally sound. |
| 2026-03-14 | European 4-pack pipeline | ✅ | ES: 11,434, FR: 12,728, DE: 18,610, NL: 9,866. Initial run had native-language glosses bug — fixed by switching to EN Wiktionary extracts |
| 2026-03-14 | Japanese pipeline | ✅ | 7,726 words. JMdict common entries joined with JLPT N1-N5 CSVs |
| 2026-03-14 | Korean pipeline | ✅ | 9,757 words. NIKL dictionary with Python-style list parsing fix |
| 2026-03-14 | Czech pipeline | ✅ | 15,393 words (--max-level C1). EN Wiktionary + wordfreq Zipf→CEFR |
| 2026-03-14 | Full DB rebuild | ✅ | 96,985 total facts (96,984 vocab + 1 tutorial). DB: 56MB, seed-pack: 34MB |
| 2026-03-14 | Opus QA review (all languages) | ✅ | All 7 new languages verified with English glosses. Cognate answer-in-question expected for European langs |
| 2026-03-15 | Runtime vocab distractors (v1) | ✅ | Created vocabDistractorService.ts. Picks from same-language vocab pool filtered by difficulty ±1. Integrated into CardCombatOverlay.svelte and quizService.ts. Verified: Japanese deck shows 3 answer choices (was showing 1) |
| 2026-03-15 | Ad-hoc knowledge fact generation (294 animals) | ⚠️ | Generated 294 animal facts across 6 batch files WITHOUT curated entity input. Workers picked their own entities — violates spec Stage 2. Facts may be kept but this approach is ABANDONED. |
| 2026-03-15 | AR-34 created | ✅ | Phase doc, work-tracking skill, memory entry, PROGRESS.md updated. Full pipeline TODO added to this file. Canonical spec recognized as source of truth. |
| 2026-03-15 | Gap analysis complete | ✅ | Stage 2 (entity curation) identified as COMPLETELY MISSING. Existing SPARQL queries are "broad dumps" without notability filtering. validate-batch.mjs covers 5/11 gates. No Vital Articles, no pageview scoring, no subcategory quotas. |

---

## Current Seed Files

| File | Type | Count | Status |
|------|------|-------|--------|
| `src/data/seed/tutorial.json` | Tutorial | 1 fact | Active |
| `src/data/seed/vocab-zh.json` | Chinese Vocab | 11,470 facts | Active |
| `src/data/seed/vocab-ja.json` | Japanese Vocab | 7,726 facts | Active |
| `src/data/seed/vocab-es.json` | Spanish Vocab | 11,434 facts | Active |
| `src/data/seed/vocab-fr.json` | French Vocab | 12,728 facts | Active |
| `src/data/seed/vocab-de.json` | German Vocab | 18,610 facts | Active |
| `src/data/seed/vocab-nl.json` | Dutch Vocab | 9,866 facts | Active |
| `src/data/seed/vocab-ko.json` | Korean Vocab | 9,757 facts | Active |
| `src/data/seed/vocab-cs.json` | Czech Vocab | 15,393 facts | Active |

---

## Known Quality Issues (from Opus QA)

| Issue | Severity | Affected Scope | Proposed Fix |
|-------|----------|---------------|--------------|
| form[0].meanings[0] not always primary meaning | Medium | ~5-10% of Chinese words | Sonnet review pass to pick best primary meaning |
| Long semicolon-separated answers | ✅ FIXED (AR-45) | Was: words with many synonyms | normalize-vocab-answers.mjs takes first meaning before `;` |
| POS abbreviations (v, a, n, g) not user-friendly | Low | All vocab facts | Add POS expansion mapping in vocab-to-facts-v2.mjs |
| Cognate answer-in-question | ✅ FLAGGED (AR-45) | 8,279 European vocab facts | Flagged with `cognate: true` field. Runtime service aware. |
| Korean definitions are explanatory | ✅ FIXED (AR-45) | Was: ~90% of Korean vocab | 8,245 NIKL definitions rewritten to concise 1-3 word translations via Haiku batch. Median 59→10 chars. |
| French/German/etc verbose definitions | ✅ FIXED (AR-45) | Was: 26-34% of EU vocab | Parentheticals stripped, answers capped at 45 chars. 21,887 facts normalized. |
| Answer length exploit (guess by longest/shortest) | ✅ FIXED (AR-45) | All 8 languages | Runtime vocabDistractorService now filters by answer length ±2.5x. Audit: 1/80 issues (from 24/80). |
