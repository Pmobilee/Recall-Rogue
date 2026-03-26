# AR-255: US States Curated Deck

**Status:** In Progress
**Priority:** Tier 1 (G-04 from deck-ideas.md)
**Complexity:** Medium — well-documented domain, established deck pipeline
**Dependencies:** Curated deck runtime system (complete), deck-master pipeline (proven with Periodic Table)

---

## Overview

Create the US States curated deck for Study Temple. 50 states with capitals, nicknames, regions, admission dates, and surprising facts. High demand from American students, social studies classes, and trivia fans. Complements the existing World Capitals, Countries & Continents, and Flags decks.

**Target:** ~85 facts. Every state gets at least 1 fact (capital). Major/interesting states (CA, TX, NY, AK, HI, FL) get 2-3. Pool-first design drives structure.

---

## Architecture

### Answer Type Pools

| Pool ID | Format | Count | Notes |
|---------|--------|-------|-------|
| `state_names` | name | 50 | Primary pool. "Which state is the Sunshine State?" → Florida |
| `state_capitals` | name | 50 | "What is the capital of Texas?" → Austin |
| `us_regions` | term | 6-9 | Northeast, Southeast, Midwest, Southwest, West, Pacific |
| `bracket_numbers` | bracket_number | varies | Year admitted, population rank, area |

### Question Templates

| ID | Template | Pool | Mastery | Diff |
|----|----------|------|---------|------|
| capital_from_state | "What is the capital of {state}?" | state_capitals | 0 | 1 |
| state_from_capital | "Which state's capital is {capital}?" | state_names | 1 | 2 |
| state_from_nickname | "Which state is known as the {nickname}?" | state_names | 1 | 2 |
| state_from_fact | "Which state {fact}?" | state_names | 2 | 3 |
| state_from_region | "Which {region} state {property}?" | state_names | 3 | 4 |
| admission_year | "In what year was {state} admitted to the Union?" | bracket_numbers | 3 | 4 |
| counterintuitive | Surprising state facts | state_names | 4 | 5 |

### Seeded Confusion Pairs

- Virginia / West Virginia
- North Carolina / South Carolina
- North Dakota / South Dakota
- New York / New Jersey / New Hampshire
- Missouri / Mississippi / Montana / Michigan / Minnesota
- Washington (state) / Washington D.C.
- Georgia (state) / Georgia (country)
- Capital != largest city pairs (Sacramento/LA, Albany/NYC, Tallahassee/Miami, etc.)

### Sub-Decks

| Sub-Deck | States | Notes |
|----------|--------|-------|
| Northeast | ~11 | ME, NH, VT, MA, RI, CT, NY, NJ, PA, DE, MD |
| South | ~16 | VA, WV, KY, TN, NC, SC, GA, FL, AL, MS, LA, AR, TX, OK, MO |
| Midwest | ~12 | OH, IN, IL, MI, WI, MN, IA, ND, SD, NE, KS |
| West | ~13 | MT, WY, CO, NM, AZ, UT, NV, ID, WA, OR, CA, AK, HI |

### Data Sources

| Source | License | Usage |
|--------|---------|-------|
| Wikipedia | CC-BY-SA-4.0 | State facts, histories, nicknames |
| Wikidata | CC0 | Structured data (capitals, admission dates, populations, areas) |
| US Census Bureau | Public domain | Population and area verification |

---

## Sub-steps

- [ ] **1** Fetch Wikidata SPARQL data for all 50 states
- [ ] **2** Write architecture YAML to `data/deck-architectures/us_states_arch.yaml`
- [ ] **3** Spawn Sonnet workers (5 batches of 10 states)
- [ ] **4** Merge worker output, build CuratedDeck envelope
- [ ] **5** Write `data/decks/us_states.json`, update manifest
- [ ] **6** Run all validation and playtest checks

### Validation Gate

- [ ] `node scripts/verify-curated-deck.mjs us_states` — 0 failures
- [ ] `playtest-curated-deck.ts us_states --charges 30` — 0 issues
- [ ] `playtest-curated-deck.ts us_states --charges 20 --wrong-rate 0.3` — 0 issues
- [ ] LLM playtest via Haiku — all categories 7+/10
- [ ] `npm run typecheck` + `npm run build` — clean

---

## Files Affected

| File | Action |
|------|--------|
| `data/deck-architectures/us_states_arch.yaml` | Create |
| `data/decks/us_states.json` | Create |
| `data/decks/manifest.json` | Add entry |
