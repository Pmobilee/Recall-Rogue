# Computer Science Deck — Provenance Documentation

**Deck ID**: `computer_science`
**Facts**: 296 (originally 301; 5 cross-batch duplicates removed during QA)
**Sub-decks**: 8
**Sources**: Wikipedia (CC BY-SA 4.0), Wikidata (CC0)
**Created**: 2026-04-02

---

## 1. Deck Structure

| Pool | Sub-deck |
|------|----------|
| cs_pioneers | Computing Pioneers |
| cs_hardware | Hardware & Architecture |
| cs_languages | Programming Languages |
| cs_algorithms | Algorithms & Data Structures |
| cs_systems_networks | Systems & Networks |
| cs_internet_web | Internet & Web |
| cs_ai_ml | AI & Machine Learning |
| cs_software_companies | Software & Companies |

---

## 2. Build Pipeline

### Phase 1 — Architecture

Architecture YAML files define each sub-deck's fact categories, counts, and source references before any generation begins:

- Master architecture: `data/deck-architectures/computer_science_arch.yaml`
- Sub-deck files: `data/deck-architectures/cs_tech_pioneers.yaml`, `cs_tech_hardware.yaml`, `cs_tech_languages.yaml`, `cs_tech_algorithms.yaml`, `cs_tech_systems_networks.yaml`, `cs_tech_internet_web.yaml`, `cs_tech_ai_ml.yaml`, `cs_tech_software_companies.yaml`

All facts were sourced from Wikipedia/Wikidata BEFORE generation. Workers received pre-verified data; they do NOT invent content.

### Phase 2 — Generation

8 parallel batch generation runs, one per sub-deck. Each run received the verified source data from its architecture YAML and produced DeckFact JSON.

### Phase 3 — Assembly

Script: `data/decks/_wip/computer_science/assemble.mjs`

Merged all 8 sub-deck outputs into a single deck file, built the master pool, and computed synonyms.

### Phase 4 — Pool Fix

After assembly, small distractor pools were padded to meet the ≥ 15 member minimum using the global `scripts/content-pipeline/pad-small-pools.mjs` script.

### Phase 5 — QA Review

Script: `data/decks/_wip/computer_science/fix-qa.mjs`

**22 fixes applied:**
- Bad or misleading distractors replaced across multiple sub-decks
- Ambiguous question phrasings clarified
- 5 cross-batch duplicate facts removed (same fact generated independently by two batches)
- Distractor pool integrity verified after duplicate removal

---

## 3. Known Remaining Issues

- None logged at initial release. Future passes may expand sub-deck coverage for post-2020 AI/ML developments.

---

## 4. Attribution

> Facts sourced from Wikipedia (CC BY-SA 4.0) and Wikidata (CC0). Content was pre-verified by human research before LLM formatting. Workers formatted verified data into DeckFact JSON — no facts were invented from model training knowledge.
