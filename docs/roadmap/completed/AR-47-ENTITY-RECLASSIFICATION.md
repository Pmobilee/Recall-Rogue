# AR-47: Pre-Generation Entity Reclassification

**Status:** Complete
**Created:** 2026-03-16
**Completed:** 2026-03-16
**Depends on:** AR-34 (complete), AR-46 (complete)

## Overview

Build an automated pre-generation step that validates whether each entity in `data/curated/{domain}/entities.json` actually belongs to its assigned domain. AR-46 revealed 23 out of 200 entities (~11.5%) were misclassified — strawberry in Animals, Chaplin/Bach/Dostoyevsky in Art, butterfly/leaf/zoology in Health, Pluto/Milky Way in Natural Sciences, etc. This wastes entity slots and requires manual skip instructions per worker.

The fix: before selecting entities for a generation batch, run a classification check that flags or moves misclassified entities so every slot produces facts.

## Deliverables

Total: 1 new script, 10 entity files cleaned, 1 verification report

## Tasks

### Section A: Build Reclassification Script

- [x] **A.1** Create `scripts/content-pipeline/curate/reclassify-entities.mjs`
  - Reads all 10 `data/curated/{domain}/entities.json` files
  - For each unprocessed entity, checks if `label` + `description` match the domain
  - Uses a keyword/heuristic classifier first (fast, no LLM needed):
    - Animals: taxonName present + description contains "species/genus/animal/bird/fish/insect/mammal/reptile"
    - Art: description contains "painter/sculptor/artist/architect/artwork/painting/building/museum"
    - Food: description contains "food/dish/cuisine/beverage/ingredient/recipe/cooking"
    - Geography: description contains "country/city/region/island/river/mountain/sea/ocean/continent"
    - History: description contains "war/empire/dynasty/battle/king/queen/pharaoh/civilization/historical"
    - Health: description contains "organ/body/disease/medical/health/anatomy/muscle/bone/brain/blood"
    - Mythology: description contains "god/goddess/myth/legend/folklore/deity/hero/creature"
    - Science: description contains "physics/chemistry/biology/math/element/formula/theorem/scientist"
    - Space: description contains "planet/moon/star/galaxy/asteroid/comet/spacecraft/orbit/nebula"
    - General: catch-all for anything that doesn't clearly fit elsewhere
  - Entities that DON'T match their current domain get flagged with `"domainMismatch": true` and `"suggestedDomain": "correct_domain"`
  - Accepts `--dry-run` (default) to just report, and `--write` to actually update files
  - Accepts `--llm` flag to use a Sonnet sub-agent for ambiguous cases (entity matches 0 or 2+ domains by keywords)
  - Acceptance: Script runs without errors, produces a summary report

- [x] **A.2** Create `scripts/content-pipeline/curate/move-entities.mjs`
  - Reads flagged entities (where `domainMismatch: true` and `suggestedDomain` is set)
  - Moves them from source domain's entities.json to target domain's entities.json
  - Preserves all entity metadata (qid, label, description, properties, sitelinks, etc.)
  - Updates `subcategory` field to match the target domain's taxonomy
  - Resets `processed: false` on moved entities (they haven't been generated in the new domain)
  - Accepts `--dry-run` and `--write` flags
  - Acceptance: Entities appear in correct domain files, no duplicates, no data loss

### Section B: Run Reclassification on All 10 Domains

- [x] **B.1** Run `node scripts/content-pipeline/curate/reclassify-entities.mjs --dry-run` — review report
  - Acceptance: Report shows flagged entities per domain with suggested corrections
- [x] **B.2** Review the dry-run report — confirm suggested domains are correct
  - Acceptance: Manual review of flagged entities, no obviously wrong suggestions
- [x] **B.3** Run `node scripts/content-pipeline/curate/reclassify-entities.mjs --write` — apply flags
  - Acceptance: Entity files updated with domainMismatch/suggestedDomain fields
- [x] **B.4** Run `node scripts/content-pipeline/curate/move-entities.mjs --write` — move flagged entities
  - Acceptance: Entities moved to correct domains, source files have them removed
- [x] **B.5** Run `node scripts/content-pipeline/curate/reclassify-entities.mjs --dry-run` again — verify 0 mismatches remain
  - Acceptance: Clean report, no flagged entities

### Section C: Verify & Report

- [x] **C.1** For each domain, count total entities and unprocessed entities — report new totals
  - Acceptance: All domains have accurate counts, moved entities are unprocessed in new domains
- [x] **C.2** Verify no duplicate qids across domain files
  - Acceptance: 0 duplicates

### Section D: Integration with Generation Pipeline

- [x] **D.1** Update `.claude/skills/manual-fact-ingest-dedup/SKILL.md` — add reclassification as a mandatory pre-step before any batch generation
  - Acceptance: Skill doc includes "Run reclassify-entities.mjs before selecting entities"
- [x] **D.2** Update `docs/RESEARCH/SOURCES/content-pipeline-progress.md` — document the reclassification step in the per-domain checklist
  - Acceptance: Progress doc references the new scripts

## Verification Gate

- [x] `node scripts/content-pipeline/curate/reclassify-entities.mjs --dry-run` — 0 mismatches
- [x] No duplicate qids across domain files
- [x] `npm run typecheck` — clean
- [x] All entity files valid JSON

## Files Affected

| File | Action | Task |
|------|--------|------|
| `scripts/content-pipeline/curate/reclassify-entities.mjs` | NEW | A.1 |
| `scripts/content-pipeline/curate/move-entities.mjs` | NEW | A.2 |
| `data/curated/*/entities.json` (10 files) | EDIT | B.3, B.4 |
| `.claude/skills/manual-fact-ingest-dedup/SKILL.md` | EDIT | D.1 |
| `docs/RESEARCH/SOURCES/content-pipeline-progress.md` | EDIT | D.2 |

## Known Misclassifications from AR-46

These were manually identified during AR-46 generation:

| Entity | Current Domain | Should Be | Reason |
|--------|---------------|-----------|--------|
| strawberry | Animals | Food or Science | It's a plant |
| Archaea | Animals | Science | Microorganism domain |
| Coronavirus | Animals | Health or Science | Virus, not animal |
| Carnivora (order) | Animals | SKIP/flag | Too broad taxonomic group |
| Canidae (family) | Animals | SKIP/flag | Too broad taxonomic group |
| Artiodactyla (order) | Animals | SKIP/flag | Too broad taxonomic group |
| Charlie Chaplin | Art | History or General | Filmmaker, not visual artist |
| J.S. Bach | Art | General or History | Composer, not visual artist |
| Voltaire | Art | History or General | Writer/philosopher |
| Dostoyevsky | Art | General or History | Novelist |
| Mark Twain | Art | General or History | Novelist |
| Cervantes | Art | General or History | Novelist |
| Dickens | Art | General or History | Novelist |
| Pushkin | Art | General or History | Poet/novelist |
| Kafka | Art | General or History | Novelist |
| Rousseau | Art | History or General | Philosopher |
| Marilyn Monroe | Art | General | Actress |
| film (concept) | Art | SKIP/flag | Generic concept |
| Arthur Conan Doyle | Health | General or Art | Writer |
| leaf | Health | Science | Plant biology |
| zoology | Health | Science | Field of study |
| bee | Health | Animals | Insect |
| monkey | Health | Animals | Animal |
| organism | Health | SKIP/flag | Abstract concept |
| photosynthesis | Health | Science | Plant biology |
| species | Health | SKIP/flag | Abstract concept |
| orange | Health | Food | Fruit |
| biochemistry | Health | Science | Field of study |
| butterfly | Health | Animals | Insect |
| Pluto | Science | Space | Dwarf planet |
| Milky Way | Science | Space | Galaxy |
| week | Science | SKIP/flag | Calendar concept |
| comet | Science | Space | Astronomical object |
| desert | Science | Geography | Landform |
| lake | Science | Geography | Physical geography |

## Results

- **148 entities moved** to correct domains
- **110 entities flagged to skip** (Latin taxonomic groups too broad for quiz)
- **5 cross-domain entities** correctly left in place (exist in both source and target)
- **0 mismatches remaining** after cleanup
- **Art → General Knowledge**: 71 entities (writers, musicians, filmmakers, actors)
- **Health → Natural Sciences**: 18 entities (biochemistry, genetics, cell biology)
- **Health → Animals**: 5 entities (tilapia, jackal, Archaeopteryx, bird of prey, trout)
- **Health → Food**: 3 entities (vitamin, fruit, protein)
- **Science → Space**: 12 entities (asteroids, dwarf planets, constellations, moons)
- **Science → Geography**: 11 entities (landforms, biomes, climate features)
- **General → Food**: 6 entities (bread, cheese, meat, vegetable, table salt, chocolate)
- **Other moves**: 22 entities across remaining domain pairs
