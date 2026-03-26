# AR-254: Periodic Table Curated Deck

**Status:** In Progress
**Priority:** Tier 1 (NS-01 from deck-ideas.md)
**Complexity:** Medium — well-documented domain, established deck pipeline
**Dependencies:** Curated deck runtime system (AR-245 through AR-253, all complete)

---

## Overview

Create the Periodic Table curated deck for Study Temple. This is the first natural science deck and the first non-geography/non-language knowledge deck. The periodic table is a "cultural touchstone" — nearly universal appeal to anyone who's taken a chemistry class.

**Target:** ~80-100 facts covering the most educationally interesting elements. Pool-first design — not all 118 elements need facts. Skip obscure synthetic elements (Og, Ts, Mc, etc.) that add nothing educationally.

---

## Phase 2: Architecture

### Answer Type Pools (pool-first design)

| Pool ID | Format | Est. Count | Notes |
|---------|--------|-----------|-------|
| `element_names` | name | 80-100 | Primary pool. "Which element has symbol Au?" -> Gold |
| `element_symbols` | name | 80-100 | "What is the chemical symbol for Iron?" -> Fe |
| `element_groups` | term | 9+ | Alkali Metals, Alkaline Earth, Transition Metals, Halogens, Noble Gases, Lanthanides, Actinides, Metalloids, Nonmetals |
| `atomic_numbers` | bracket_number | varies | `{79}` — runtime generates numeric distractors |
| `element_categories` | term | 5+ | Metal, Nonmetal, Metalloid, Noble Gas, Halogen |

### Question Templates (mastery-driven difficulty curve)

| ID | Template | Pool | Mastery | Diff |
|----|----------|------|---------|------|
| symbol_from_name | "What is the chemical symbol for {element}?" | element_symbols | 0 | 1 |
| name_from_symbol | "Which element has the symbol {symbol}?" | element_names | 0 | 1 |
| name_from_description | "Which element is {description}?" | element_names | 1 | 2 |
| atomic_number | "What is the atomic number of {element}?" | atomic_numbers | 1 | 2 |
| group_from_element | "Which group does {element} belong to?" | element_groups | 2 | 3 |
| element_from_group | "Which element is a {group_name}?" | element_names | 2 | 3 |
| element_from_property | "Which element {property}?" | element_names | 3 | 4 |
| element_from_use | "Which element is used in {application}?" | element_names | 3 | 4 |
| counterintuitive | Surprising property questions | element_names | 4 | 5 |

### Seeded Confusion Pairs

- Na/K (Sodium/Potassium — both alkali metals, non-obvious Latin symbols)
- Fe/Cu/Au/Ag (metals with Latin-derived symbols)
- He/Ne/Ar (noble gases — which is used where)
- F/Cl/Br/I (halogens — property mix-ups)
- Li/Na/K (alkali metals — similar reactivity)
- Al/Si (neighbors, both common in Earth's crust)
- N/O (neighbors, both atmospheric gases)
- Pt/Pd (both precious platinum-group metals)
- Co/Ni (neighbors, similar transition metals)
- U/Pu (both nuclear fuel, confused roles)

### Synonym Groups

- mercury_group: Mercury / Quicksilver / Hg (same element, multiple names)
- tungsten_group: Tungsten / Wolfram / W (same element)
- potassium_group: Potassium / Kalium (Latin name explains K symbol)
- sodium_group: Sodium / Natrium (Latin name explains Na symbol)

### Sub-Decks

| Sub-Deck | Target Facts | Rationale |
|----------|-------------|-----------|
| Common Elements | ~40 | Elements most people encounter: H, He, C, N, O, Na, Mg, Al, Si, S, Cl, K, Ca, Fe, Cu, Zn, Ag, Sn, Au, Hg, Pb, U — the "I've heard of these" set |
| Full Periodic Table | all | Default — the complete deck |

### Difficulty Tiers

- **Easy (1-2):** H, He, O, C, N, Fe, Au, Ag, Cu, Na — universally known elements
- **Medium (3):** Si, Al, Cl, K, Ca, Zn, Sn, Pb, U, Ne, Ar — commonly known
- **Hard (4-5):** Pt, Pd, W, Rh, Os, Ir, Sb, Bi, Se, Te — requires specific chemistry knowledge

### Data Sources

| Source | License | Usage |
|--------|---------|-------|
| Wikipedia | CC-BY-SA-4.0 | Fact text, explanations, wow factors |
| Wikidata | CC0 | Structured data (atomic numbers, symbols, groups, discovery dates) |
| PubChem | Public domain | Element properties verification |
| IUPAC | Public domain | Official element names, symbols |

---

## Phase 3: Generation

### Sub-steps

- [ ] **3.1** Fetch Wikidata SPARQL data for all elements (atomic number, symbol, group, category, discovery year, discoverer, key properties)
- [ ] **3.2** Fetch Wikipedia summaries for top ~90 elements (wow factors, explanations, applications)
- [ ] **3.3** Write architecture YAML to `data/deck-architectures/periodic_table_arch.yaml`
- [ ] **3.4** Spawn Sonnet workers (batches of 10) with architecture + source data + master worker prompt
- [ ] **3.5** Merge worker output, build CuratedDeck envelope
- [ ] **3.6** Write to `data/decks/periodic_table.json`, update `data/decks/manifest.json`

### Validation Gate

- [ ] `node scripts/verify-curated-deck.mjs periodic_table` — 0 failures
- [ ] Data simulation check — no braces in answers, no pool pollution
- [ ] `playtest-curated-deck.ts periodic_table --charges 30` — 0 issues
- [ ] `playtest-curated-deck.ts periodic_table --charges 20 --wrong-rate 0.3` — 0 issues
- [ ] LLM playtest via Haiku — all categories 7+/10
- [ ] Age group distribution: 40%+ tagged "all"
- [ ] Pool sizes: all pools 5+ members
- [ ] Chain slots: 0-5 evenly distributed

---

## Files Affected

| File | Action |
|------|--------|
| `data/deck-architectures/periodic_table_arch.yaml` | Create |
| `data/decks/periodic_table.json` | Create |
| `data/decks/manifest.json` | Add entry |
| `data/deck-ideas.md` | Mark NS-01 as shipped |
