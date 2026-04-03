# Medical Terminology Deck — Provenance Documentation

**Deck ID**: `medical_terminology`
**Facts**: 635
**Sub-decks**: 5
**Sources**: Wikipedia (CC-BY-SA-4.0), Wikidoc (CC-BY-SA-3.0), NCBI Bookshelf (public domain), UWF Medical Terminology (CC-BY-4.0), GlobalRPH (reference)
**Created**: 2026-04-03

---

## 1. Deck Structure

| Sub-deck | Facts | Scope |
|---|---|---|
| Prefixes | 80 | Common medical prefixes and their meanings |
| Suffixes | 60 | Common medical suffixes and their meanings |
| Body Roots | 320 | Combining forms derived from anatomical structures and organs |
| Conditions | 120 | Disease names, pathological terms, and condition descriptors |
| Procedures | 55 | Diagnostic and surgical procedure terminology |

**Answer Type Pools (8):**

| Pool ID | Format | Notes |
|---|---|---|
| `prefix_meanings` | term | Meanings of medical prefixes (e.g. brady- = slow) |
| `suffix_meanings` | term | Meanings of medical suffixes (e.g. -itis = inflammation) |
| `root_meanings` | term | Meanings of anatomical combining forms (e.g. cardi/o = heart) |
| `organ_names` | name | Anatomical organ and structure names |
| `combining_forms` | term | The combining form itself (e.g. cardi/o, hepat/o) |
| `body_systems` | term | Body system names (cardiovascular, respiratory, etc.) |
| `condition_names` | name | Disease and condition names |
| `procedure_names` | name | Diagnostic and surgical procedure names |

---

## 2. Sources

### Wikipedia (CC-BY-SA-4.0)
- **URL**: https://en.wikipedia.org — especially [List of medical roots, suffixes and prefixes](https://en.wikipedia.org/wiki/List_of_medical_roots,_suffixes_and_prefixes)
- **License**: CC BY-SA 4.0
- **What was taken**: Combining form meanings, etymologies, example words, anatomical context, condition descriptions, procedure overviews
- **Method**: Every Sonnet worker WebFetched the Wikipedia article for each entity before writing facts
- **Commercial use**: Yes, with attribution and share-alike
- **Attribution**: "Facts sourced from Wikipedia contributors, licensed under CC-BY-SA 4.0"

### Wikidoc (CC-BY-SA-3.0)
- **URL**: https://www.wikidoc.org
- **License**: CC BY-SA 3.0
- **What was taken**: Clinical context, condition classifications, differential diagnosis terminology
- **Commercial use**: Yes, with attribution and share-alike
- **Attribution**: "Some content sourced from Wikidoc contributors, licensed under CC-BY-SA 3.0"

### NCBI Bookshelf (Public Domain)
- **URL**: https://www.ncbi.nlm.nih.gov/books/
- **License**: Public domain (US government works)
- **What was taken**: Verified definitions for medical combining forms, procedure terminology, condition classifications
- **Commercial use**: Yes, unrestricted (public domain)

### UWF Medical Terminology (CC-BY-4.0)
- **URL**: University of West Florida open courseware
- **License**: CC BY 4.0
- **What was taken**: Structured lists of prefixes, suffixes, and combining forms with verified meanings used as ground-truth source data
- **Commercial use**: Yes, with attribution
- **Attribution**: "Some terminology sourced from UWF Medical Terminology open courseware, licensed under CC-BY 4.0"

### GlobalRPH (Reference Only)
- **URL**: https://globalrph.com/medterms/
- **License**: Reference use
- **What was taken**: Cross-reference only — used to verify combining form spellings and meanings against other sources; no text reproduced
- **Commercial use**: Reference use only; no content copied

---

## 3. Build Pipeline

### Phase 1 — Wikidata Research

Opus orchestrator queried Wikidata and Wikipedia for:
- Canonical medical combining forms with confirmed Greek/Latin etymologies
- Organ and body system taxonomy
- ICD-10 condition name classifications
- CPT/SNOMED-aligned procedure terminology

Output: verified structured data for ~400 combining forms, ~150 conditions, ~60 procedures.

### Phase 2 — Architecture Design

Opus orchestrator designed pool-first architecture:
- 8 answer type pools (see structure table above)
- 5 sub-decks with target fact counts
- Synonym pairs mapped (e.g. phleb/o and ven/o both = vein; hem/o and hemat/o both = blood)
- Difficulty tiers planned across all sub-decks

Output: `data/deck-architectures/medical_terminology_arch.yaml`

### Phase 3 — Fact Generation (17 parallel Sonnet workers across 2 waves + supplements)

Each worker received verified source data and instructions to WebFetch Wikipedia for additional context. Two main generation waves were run with additional supplement batches for rate-limit recovery. Workers generated facts with full schema compliance.

**Wave 1 (batches 1–9):**

| Batch | Facts | Scope |
|---|---|---|
| 1 | ~35 | Cardiovascular and respiratory combining forms (Body Roots) |
| 2 | ~35 | Neurological and musculoskeletal combining forms |
| 3 | ~35 | Gastrointestinal and hepatic combining forms |
| 4 | ~35 | Urological and reproductive combining forms |
| 5 | ~35 | Endocrine, immune, and hematological combining forms |
| 6 | ~20 | Common prefixes (Prefixes sub-deck) |
| 7 | ~20 | Common prefixes continued |
| 8 | ~20 | Common suffixes (Suffixes sub-deck) |
| 9 | ~20 | Common suffixes continued |

**Wave 2 (batches 10–15):**

| Batch | Facts | Scope |
|---|---|---|
| 10 | ~30 | Inflammatory and neoplastic condition names |
| 11 | ~30 | Cardiovascular and neurological conditions |
| 12 | ~30 | Gastrointestinal and endocrine conditions |
| 13 | ~20 | Diagnostic procedure names |
| 14 | ~20 | Surgical procedure names |
| 15 | ~20 | Remaining Body Roots (integumentary, sensory organs) |

**Supplement batches (rate-limit recovery):**

| Batch | Facts | Scope |
|---|---|---|
| supp1 | ~15 | Additional combining forms to reach Body Roots target |
| supp2 | ~10 | Additional conditions |

### Phase 4 — Assembly

Sonnet content-agent merged all 17 batches into a single CuratedDeck envelope:
- Normalized schema across all batches
- Stripped non-standard WIP fields (statement, wowFactor, tags, ageGroup, visualDescription)
- Built pool/tier/subdeck metadata programmatically
- Resolved synonym groups for equivalent combining forms

Output: `data/decks/medical_terminology.json`

---

## 4. Distractor Generation

- **Method**: LLM-generated by each Sonnet worker reading the specific question and producing 8 plausible wrong answers from world knowledge
- **Pool-based runtime**: At runtime, distractors are drawn from answer type pools (prefix_meanings, suffix_meanings, root_meanings, etc.) weighted by the confusion matrix
- **Homogeneity enforced**: Each pool contains only facts whose answers are of the same format and category — prefix meanings do not share pools with condition names
- **Sources**: Distractors drawn from medical knowledge — related body systems, similar-sounding terms, anatomically adjacent structures
- **DB queries**: Permitted only for post-generation collision validation; never used as distractor source

---

## 5. Fact Verification

- **Method**: Every Sonnet worker WebFetched the Wikipedia article for each combining form or condition before writing facts; NCBI Bookshelf and UWF Medical Terminology provided ground-truth structured lists for combining form meanings
- **Known limitations**: Some combining forms have multiple accepted spellings (e.g. hem/o vs haem/o); British spelling variants are noted in acceptableAlternatives
- **Synonym pairs in synonym groups**: phleb/o–ven/o (vein), hem/o–hemat/o (blood), pulmon/o–pneumon/o (lung), nas/o–rhin/o (nose), additional pairs across Body Roots sub-deck

---

## 6. Quality Assurance

| Check | Result |
|---|---|
| Structural validation (verify-curated-deck.mjs) | 0 issues |
| Batch verifier (verify-all-decks.mjs) | 0 failures, 0 warnings |
| Pool homogeneity (prefix/suffix/root pools separated) | Verified |
| Synonym group coverage | Verified |

---

## 7. Attribution Requirements

- **In-app credits**: "Medical terminology facts sourced from Wikipedia contributors (CC-BY-SA 4.0) and UWF Medical Terminology open courseware (CC-BY 4.0)"
- **Wikidoc**: "Some content sourced from Wikidoc contributors (CC-BY-SA 3.0)"
- **NCBI Bookshelf**: No attribution required (public domain)
- **GlobalRPH**: No content reproduced; reference use only
- **Share-alike**: Derivative works using Wikipedia or Wikidoc-sourced text must also be CC-BY-SA

---

## 8. Reproduction Steps

```bash
# 1. Architecture file:
cat data/deck-architectures/medical_terminology_arch.yaml

# 2. WIP batch files (if still present):
ls data/decks/_wip/medterm_*.json

# 3. Final assembled deck — fact count check:
node -e "const d=JSON.parse(require('fs').readFileSync('data/decks/medical_terminology.json','utf8'));console.log(d.facts.length,'facts')"

# 4. Structural validation:
node scripts/verify-all-decks.mjs

# 5. Automated playtest (all correct):
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts medical_terminology --charges 30 --verbose

# 6. Automated playtest (30% wrong):
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts medical_terminology --charges 20 --wrong-rate 0.3
```
