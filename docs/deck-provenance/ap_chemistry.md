# AP Chemistry Deck — Provenance Documentation

**Deck ID**: `ap_chemistry`
**Facts**: ~400 (planned; generation in progress)
**Sub-decks**: 5
**Sources**: College Board AP Chemistry CED (educational reference), Wikipedia (CC-BY-SA-4.0), OpenStax Chemistry 2e (CC-BY-4.0), Wikidata (CC0)
**Created**: 2026-04-03

---

## 1. Deck Structure

| Sub-deck | Scope |
|---|---|
| Atomic Structure & Periodicity | Electron configuration, periodic trends, atomic theory, quantum numbers |
| Bonding & Molecular Geometry | IMFs, VSEPR, Lewis structures, polarity, hybridization |
| Thermodynamics & Kinetics | Enthalpy, entropy, Gibbs free energy, reaction rates, activation energy |
| Equilibrium & Electrochemistry | Acid/base equilibria, Ksp, redox reactions, electrochemical cells |
| Reactions & Stoichiometry | Reaction types, limiting reagents, solution chemistry, gases |

**Curriculum Alignment**: College Board AP Chemistry Course and Exam Description (CED), 9 units, 92 topics, exam weight distribution matched.

**Answer Type Pools (16):**

| Pool ID | Format | Notes |
|---|---|---|
| `element_symbols` | symbol | Chemical symbols for elements Z=1–56 |
| `element_names` | name | Full element names |
| `periodic_groups` | group name | Group/family names (alkali metals, halogens, etc.) |
| `atomic_numbers` | integer | Atomic numbers for common elements |
| `molar_masses` | numeric (g/mol) | Molar masses of elements and common compounds |
| `electronegativities` | numeric | Pauling electronegativities (2 sig figs) |
| `bond_types` | term | Bond type names (ionic, covalent, metallic, H-bond, etc.) |
| `molecular_geometries` | term | VSEPR geometry names (linear, tetrahedral, etc.) |
| `reaction_types` | term | Synthesis, decomposition, single/double replacement, combustion |
| `thermodynamic_terms` | term | Enthalpy, entropy, Gibbs free energy, etc. |
| `equilibrium_expressions` | term/formula | Ka, Kb, Ksp, Kw, Kp, Kc |
| `scientist_names` | name | Chemists associated with laws and discoveries |
| `units_of_measure` | unit | SI and derived units used in chemistry |
| `quantum_numbers` | term | n, l, ml, ms with allowed values |
| `gas_law_names` | law name | Boyle, Charles, Dalton, Avogadro, Ideal, van der Waals |
| `oxidation_states` | integer | Common oxidation states for transition metals and polyatomics |

---

## 2. Sources

### College Board AP Chemistry CED (Educational Reference)
- **URL**: https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf
- **License**: Public educational resource — structure and scope referenced, no text reproduced
- **What was taken**: Unit/topic structure (9 units, 92 topics), exam weight distribution, required equations and constants list
- **Commercial use**: Structure and learning objectives are not copyrightable; no verbatim reproduction

### Wikipedia (CC-BY-SA-4.0)
- **URL**: https://en.wikipedia.org/wiki/Chemistry (and linked articles per topic)
- **License**: CC BY-SA 4.0
- **What was taken**: Element properties, compound descriptions, scientist biographies, process explanations, historical context
- **Method**: Sonnet workers WebFetched the Wikipedia article for each element/compound/topic before writing facts
- **Commercial use**: Yes, with attribution and share-alike
- **Attribution**: "Facts sourced from Wikipedia contributors, licensed under CC-BY-SA 4.0"

### OpenStax Chemistry 2e (CC-BY-4.0)
- **URL**: https://openstax.org/books/chemistry-2e/pages/1-introduction
- **License**: CC BY 4.0
- **What was taken**: Chapter-level concept explanations, verified definitions, worked example structures
- **Commercial use**: Yes, with attribution
- **Attribution**: "Based on OpenStax Chemistry 2e, licensed under CC-BY 4.0"

### Wikidata (CC0)
- **URL**: https://www.wikidata.org/
- **License**: CC0 (public domain)
- **What was taken**: Structured element data (atomic numbers, electronegativities, molar masses for Z=1–56), compound molar masses
- **Method**: SPARQL queries for element properties; cross-referenced with CRC Handbook values
- **Commercial use**: Yes, unrestricted (public domain)

---

## 3. Build Pipeline

### Phase 1 — Discovery & Scope

Opus orchestrator WebSearched and WebFetched College Board, Fiveable, Albert.io, and TestPrepKart to extract the complete CED scope. Cross-referenced 4 sources to confirm 92 topics across 9 units with exam weightings.

Output: Discovery appended to `data/deck-ideas.md`. Unit/topic list verified against multiple sources.

### Phase 2 — Wikidata Research

SPARQL queries against Wikidata for element properties (Z=1–56) and common compound data. Values cross-referenced with CRC Handbook where available.

Output: Structured element data for 56 elements, compound data for 9+ common compounds.

### Phase 3 — Architecture Design

Pool-first design with 16 answer type pools, 22 question templates, 32 common confusion pairs, 12 synonym groups. Architecture maps directly to CED unit structure.

Output: `data/deck-architectures/ap_chemistry_arch.yaml`

### Phase 4 — Fact Generation (16 batches across 5 sub-decks)

Each Sonnet worker received:
- The relevant architecture YAML section
- Pre-verified source data from Wikidata research
- Instructions to WebFetch Wikipedia for each specific topic

Workers FORMAT pre-verified data into DeckFact JSON — they do NOT invent content.

| Batch | Sub-deck | Scope |
|---|---|---|
| 1–3 | Atomic Structure & Periodicity | Elements Z=1–56, periodic trends, quantum numbers |
| 4–6 | Bonding & Molecular Geometry | Bond types, VSEPR, hybridization, IMFs |
| 7–9 | Thermodynamics & Kinetics | Enthalpy, entropy, Gibbs free energy, rate laws |
| 10–12 | Equilibrium & Electrochemistry | Ka/Kb/Ksp, pH, redox, electrochemical cells |
| 13–16 | Reactions & Stoichiometry | Reaction types, limiting reagents, gas laws, solutions |

### Phase 5 — Assembly

Script: `data/decks/_wip/ap_chemistry/assemble.mjs`

Merged all 16 batch outputs into a single CuratedDeck envelope, built master pool, resolved synonym groups, computed synonyms.

### Phase 6 — Pool Padding

Small distractor pools padded to meet ≥ 15 member minimum using `scripts/content-pipeline/pad-small-pools.mjs`.

### Phase 7 — QA Review

- Ambiguous question phrasings clarified (especially Ka vs pKa, oxidation state notation)
- Duplicate facts removed across batches
- Distractor pool integrity verified
- College Board reference values used where textbook editions disagree (Ka/Kb values)

---

## 4. Distractor Generation

- **Method**: LLM-generated by each Sonnet worker reading the specific question and producing 8 plausible wrong answers from world knowledge
- **Pool-based runtime**: At runtime, distractors drawn from answer type pools (element_names, molecular_geometries, etc.) weighted by confusion matrix
- **Homogeneity enforced**: Element symbols do not share pools with scientist names; numeric pools (molar masses, electronegativities) separated from term pools
- **Sources**: Chemistry world knowledge — adjacent elements, similar geometry names, related laws
- **DB queries**: Permitted only for post-generation collision validation; never used as distractor source

---

## 5. Fact Verification

- **Method**: Sonnet workers WebFetched Wikipedia per topic; Wikidata SPARQL provided ground-truth numeric values for elements; OpenStax Chemistry 2e verified definitions
- **Known limitations**: Ka/Kb values vary between textbook editions — College Board reference sheet values used as canonical source; some electronegativities differ by scale (Pauling used throughout)
- **Synonym pairs**: Examples — enthalpy/heat of reaction, Kw/ion product of water, oxidation/loss of electrons

---

## 6. Quality Assurance

| Check | Result |
|---|---|
| Structural validation (verify-curated-deck.mjs) | (pending) |
| Batch verifier (verify-all-decks.mjs) | (pending) |
| Pool homogeneity (numeric vs. term pools separated) | (pending) |
| CED exam weight alignment | (pending) |

---

## 7. Attribution Requirements

- **In-app credits**: "Chemistry facts sourced from Wikipedia contributors (CC-BY-SA 4.0) and OpenStax Chemistry 2e (CC-BY 4.0)"
- **Wikidata**: No attribution required (CC0)
- **College Board CED**: No content reproduced; referenced for educational alignment only
- **Share-alike**: Derivative works using Wikipedia or OpenStax-sourced text must also be CC-BY-SA or CC-BY respectively

---

## 8. Reproduction Steps

```bash
# 1. Architecture file:
cat data/deck-architectures/ap_chemistry_arch.yaml

# 2. WIP batch files (if still present):
ls data/decks/_wip/ap_chemistry/

# 3. Final assembled deck — fact count check:
node -e "const d=JSON.parse(require('fs').readFileSync('data/decks/ap_chemistry.json','utf8'));console.log(d.facts.length,'facts')"

# 4. Structural validation:
node scripts/verify-all-decks.mjs

# 5. Automated playtest (all correct):
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts ap_chemistry --charges 30 --verbose

# 6. Automated playtest (30% wrong):
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts ap_chemistry --charges 20 --wrong-rate 0.3

# 7. Bridge to trivia DB:
node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs
node scripts/build-facts-db.mjs
```
