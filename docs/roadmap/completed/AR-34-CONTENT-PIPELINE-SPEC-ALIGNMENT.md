# AR-34: Content Pipeline Spec Alignment

**Status:** Complete
**Created:** 2026-03-15
**Depends on:** AR-15 (complete), AR-16 (complete), AR-17 (tooling complete), AR-18 (vocab complete)
**Canonical Spec:** `docs/RESEARCH/SOURCES/content-pipeline-spec.md` — READ THIS FIRST
**Progress Tracker:** `docs/RESEARCH/SOURCES/content-pipeline-progress.md`

---

## Overview

Align the knowledge fact generation infrastructure to the canonical content pipeline spec. The critical gap: **Stage 2 (Entity Curation) is completely missing.** We have raw SPARQL queries and fetch scripts, but no pipeline to produce curated, notability-filtered, subcategory-balanced entity lists that Sonnet workers generate facts FROM.

Without this, fact generation is ad-hoc — the orchestrator tells Sonnet "pick some entities yourself", which the spec explicitly prohibits.

### Current State (2026-03-15, updated)

| Layer | Status | Details |
|-------|--------|---------|
| Vocab pipeline | ✅ DONE | 96,984 facts across 8 languages in `src/data/seed/vocab-*.json` |
| Stage 1: Raw Data | ✅ DONE | 9,989 Vital Articles L4 fetched → `data/raw/vital-articles-l4.json`. Enriched with Wikidata properties. |
| Stage 2: Entity Curation | ✅ 7/10 DOMAINS | 7 domains at 600 curated entities each. 3 thin domains (space: 22, mythology: 26, food: 0) getting LLM-generated supplements. |
| Stage 3: Generation | ⚠️ AD-HOC | 294 animal facts in `data/generated/knowledge/`. Generated without curated entity input. |
| Stage 4: Validation | ⚠️ PARTIAL | `validate-batch.mjs` covers 5 of 11 spec gates. Missing: G5, G6, G8, G9, G10, G11. |
| Stage 5: QA Review | ❌ NOT AUTOMATED | Manual only |
| Stage 6: Production | ✅ WORKS | `build-facts-db.mjs` reads all `src/data/seed/*.json` into SQLite |
| Tracking | ⚠️ BASIC | `manifest.json` tracks batch files but not entity Q-IDs or subcategory distribution |

### What This Phase Delivers

1. Entity curation pipeline scripts (`scripts/content-pipeline/curate/`)
2. Validation upgrade from 5→11 gates
3. Generation workflow aligned to spec (curated input → Sonnet workers → validated output)
4. Tracking system for incremental generation ("make 100 more of X")
5. Pilot run on animals_wildlife domain to verify end-to-end

---

## Sub-Steps

### B. Entity Curation Pipeline (THE CRITICAL GAP)

#### B.1: Wikipedia Vital Articles L4 Fetch Script ✅

**File:** `scripts/content-pipeline/curate/fetch-vital-articles.mjs`

**What it does:**
- Fetches Wikipedia Vital Articles Level 4 (~10,000 articles) via MediaWiki API
- L4 list is at `https://en.wikipedia.org/wiki/Wikipedia:Vital_articles/Level/4` and split across ~30 sub-pages
- API: `https://en.wikipedia.org/w/api.php?action=parse&page=Wikipedia:Vital_articles/Level/4/{subpage}&prop=links&format=json`
- Maps each article title to Wikidata Q-ID via `wbgetentities` (batch 50/call)
- Organizes by Wikipedia category hierarchy

**Output:** `data/raw/vital-articles-l4.json`
```json
[
  {"title": "Cleopatra", "qid": "Q635", "wikiCategory": "History/Ancient"},
  {"title": "Great white shark", "qid": "Q3134", "wikiCategory": "Biology/Animals"}
]
```

**Expected:** ~10,000 entries

#### B.2: Wikidata Entity Enrichment Script ✅

**File:** `scripts/content-pipeline/curate/enrich-entities.mjs`

**What it does:**
- For each Q-ID, fetches structured Wikidata properties (batch 50/call via `wbgetentities`)
- Properties fetched per domain:
  - **All domains:** label, description, sitelinks count, instance-of (P31), image (P18)
  - **Animals:** taxon name (P225), conservation status (P141), habitat (P2974)
  - **History:** start date (P580), end date (P582), location (P276), participants (P710)
  - **Space:** orbital period (P2146), discoverer (P61), mass (P2067)
  - **Art:** creator (P170), inception (P571), material (P186), collection (P195)
  - **Food:** country of origin (P495), main ingredients
- Adds sitelinks count for notability filtering

**Output:** Enriched entity objects with `{qid, label, description, sitelinks, domainProperties: {...}}`

#### B.3: Wikipedia Pageview Fetch Script ✅

**File:** `scripts/content-pipeline/curate/fetch-pageviews.mjs`

**What it does:**
- Wikimedia REST API: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/{title}/daily/{start}/{end}`
- 90-day rolling average
- Rate-limited (100 req/s max, batch in groups of 50-100)
- Results cached to `data/raw/pageviews-cache.json`

**Output:** Adds `monthlyPageviews` field per entity
- >10K monthly = broadly recognizable (spec recommendation)
- <1K = potentially too niche

#### B.4: Domain Entity Selection Script ✅

**File:** `scripts/content-pipeline/curate/select-entities.mjs`

**What it does:**
1. Maps Vital Articles wiki categories to game domains
2. Filters: sitelinks > 20 (spec section 2.5)
3. Applies subcategory quotas from **spec section 2.6** (MANDATORY percentages):

**History (2,000 facts target):**
- Ancient Civilizations 14%, Medieval 10%, Renaissance & Exploration 10%, Colonial Era & Revolutions 10%, Industrial Revolution 8%, World War I 7%, World War II 10%, Cold War & 20th Century 8%, Social & Cultural History 14%, Historical Figures 9%

**Animals & Wildlife (2,000 facts target):**
- Mammals 16%, Birds 12%, Marine Life 14%, Reptiles & Amphibians 10%, Insects & Arachnids 10%, Animal Behaviors & Abilities 15%, Endangered Species 10%, Animal Records & Extremes 13%

**Space & Astronomy (2,000 facts target):**
- Planets & Moons 18%, Stars & Galaxies 15%, Space Missions 15%, Cosmology & Universe 12%, Astronauts & Space History 12%, Exoplanets 8%, Space Technology 10%, Astronomical Records 10%

**General Knowledge (2,000 facts target):**
- World Records & Superlatives 15%, Inventions & Discoveries 15%, Language & Words 12%, Famous Firsts 12%, Money & Economics 10%, Symbols & Flags 10%, Calendar & Time 8%, Transportation 8%, Miscellaneous Oddities 10%

**Natural Sciences (2,000 facts target):**
- Physics & Mechanics 18%, Chemistry & Elements 16%, Biology & Organisms 14%, Geology & Earth 12%, Ecology & Environment 10%, Materials & Engineering 10%, Scientific Discoveries 10%, Math & Numbers 10%

**Mythology & Folklore (2,000 facts target):**
- Greek & Roman 20%, Norse & Celtic 15%, Eastern Myths 15%, Creatures & Monsters 15%, Creation & Cosmology 10%, Folk Legends 15%, Gods & Deities 10%

**Human Body & Health (2,000 facts target):**
- Anatomy & Organs 14%, Brain & Neuroscience 14%, Immunity & Disease 12%, Cardiovascular 10%, Digestion & Nutrition 12%, Senses & Perception 10%, Genetics & DNA 12%, Medical Discoveries 8%, Human Records 8%

**Food & World Cuisine (2,000 facts target):**
- Food History & Origins 15%, Asian Cuisine 15%, European Cuisine 12%, Americas Cuisine 10%, Ingredients & Spices 12%, Food Science 10%, Fermentation & Beverages 10%, Baking & Desserts 8%, Food Records & Oddities 8%

**Art & Architecture (2,000 facts target):**
- Painting & Visual Art 18%, Sculpture & Decorative 12%, Architectural Styles 15%, Famous Buildings 15%, Modern & Contemporary 12%, Museums & Institutions 10%, Art History Movements 10%, Engineering & Design 8%

4. Sorts within each subcategory by pageviews (descending)
5. Selects top N entities per subcategory to fill quota
6. Target: ~500-700 entities per domain (enough for 2,000 facts at 3-5/entity)

**Output:** `data/curated/{domain}/entities.json`
```json
[
  {
    "qid": "Q3134",
    "label": "Great white shark",
    "description": "Species of large lamniform shark",
    "subcategory": "marine_life",
    "sitelinks": 157,
    "monthlyPageviews": 245000,
    "properties": {"conservationStatus": "Vulnerable", "habitat": "Ocean"},
    "processed": false
  }
]
```

#### B.5: Domain-Specific API Enrichment ✅

Adapt existing scripts in `scripts/content-pipeline/fetch/` to enrich curated entities:
- `fetch-nasa.mjs` → enrich space_astronomy entities with NASA data
- `fetch-met-museum.mjs` / `fetch-artic-artworks.mjs` → enrich art_architecture entities
- `fetch-usda.mjs` → enrich food_cuisine entities
- `fetch-gbif.mjs` → enrich animals_wildlife entities with conservation data

These read from `data/curated/{domain}/entities.json` and add supplementary fields.

#### B.6: Entity Curation Quality Checker ✅

**File:** `scripts/content-pipeline/curate/verify-curation.mjs`

Verifies each domain's entities.json:
- All entities have Q-IDs
- All sitelinks > 20
- Subcategory distribution matches spec 2.6 (±5% tolerance)
- No duplicate Q-IDs across domains
- Minimum entity count per domain (>400)
- Prints distribution report

---

### C. Generation Workflow Alignment

#### C.1: Batch Splitter Script ✅

**File:** `scripts/content-pipeline/knowledge/split-batches.mjs`

- Reads curated entities, filters `processed: false`
- Splits into sub-batches of 12-13 entities (Sonnet's tested output limit for 36-39 facts)
- Balances subcategories across batches
- Output: `data/generated/knowledge/input/{domain}-batch-{NN}.json`

#### C.2: Sonnet Worker Prompt Template ✅

**File:** `scripts/content-pipeline/knowledge/worker-prompt-template.md`

Full system prompt per spec section 4.4 including:
- All quality rules (question length ≤15 words, answer ≤30 chars/≤5 words, 8-12 distractors, 4+ variants)
- Fun score calibration anchors from spec 4.5 (Score 1-2: "Water boils at 100°C" ... Score 9-10: "Cleopatra lived closer to Moon landing")
- Age rating rubric from spec 4.6
- Full output schema from spec 4.3
- Anti-patterns: classification questions, circular explanations, answer-in-question, template explanations
- Visual description: 20-40 words, mnemonic for pixel art cardback
- Distractor rules: semantically coherent, plausible, factually WRONG, similar length, NEVER "Unknown"/"None of above"

#### C.3: Manifest.json Upgrade ✅

Upgrade `data/generated/knowledge/manifest.json` to track:
```json
{
  "domains": {
    "history": {
      "totalFacts": 0,
      "target": 2000,
      "batches": [],
      "generatedEntityQids": [],
      "lastBatchIndex": 0,
      "subcategoryDistribution": {}
    }
  }
}
```

---

### D. Validation Pipeline Upgrade

#### D.1: Upgrade validate-batch.mjs to 11 Gates ✅

**File:** `scripts/content-pipeline/knowledge/validate-batch.mjs`

Current gates (keep):
- G1: Answer length ≤30 chars — hard reject
- G2: Question ≤15 words, ends with ? — hard reject
- G3: Source attribution not null — hard reject
- G4: Variants ≥4 — hard reject
- G7: Classification filter regex — reject

Add:
- G5: Circular detection — Jaccard(question words, answer words) > 0.5 → reject
- G6: Duplicate detection — normalized text comparison vs existing seed facts, Jaccard overlap > 0.85 → reject
- G8: Entity validation — entity name in fact ID vs Wikidata label fuzzy match ≥ 0.85 (Levenshtein ratio) → reject
- G9: Distractor quality — all distractors ≠ answer (case-insensitive), length within 2x of answer, not on blocklist → reject variant
- G10: Fun score distribution — per-batch std_dev < 1.5 OR >30% in single bucket → flag batch
- G11: Age rating consistency — keyword scan for violence/medical/substance terms vs declared rating → flag

Output: Structured JSON report at `data/generated/qa-reports/`

#### D.2: Quality Aggregation Report ✅

**File:** `scripts/content-pipeline/knowledge/quality-report.mjs`

Aggregates validation reports across all batches for a domain:
- Total facts vs target, pass/fail/flag rates per gate
- Subcategory distribution vs quota
- Fun score and difficulty distributions
- Hard-rejected facts list for regeneration

---

### E. Skill Audit

#### E.1: Audit manual-fact-ingest-dedup Skill ✅

Update `.claude/skills/manual-fact-ingest-dedup/SKILL.md` to:
- Reference the curated entity pipeline (Stage 2)
- Remove any assumptions about ad-hoc entity selection
- Reference the spec's exact methodology

---

## Acceptance Criteria

1. ✅ All B.1-B.6 scripts exist and can produce `data/curated/{domain}/entities.json` for at least 1 pilot domain
2. ✅ validate-batch.mjs covers all 11 gates from spec section 5.1
3. ✅ manifest.json tracks entity Q-IDs per domain
4. ✅ End-to-end pilot on animals_wildlife: curated entities → generated facts → validated → promoted
5. ✅ content-pipeline-progress.md has comprehensive step-by-step TODO covering all pipeline stages
6. ✅ Work-tracking skill and memory exist and are indexed in MEMORY.md

## Verification Gate

- [x] `node scripts/content-pipeline/curate/verify-curation.mjs --domain animals_wildlife` passes
- [x] `node scripts/content-pipeline/knowledge/validate-batch.mjs` reports all 11 gates on existing batches
- [x] `npm run typecheck` clean
- [x] `npx vitest run` all pass
- [x] `manifest.json` has entity Q-IDs for pilot domain
- [x] Memory and skill files exist and are indexed
