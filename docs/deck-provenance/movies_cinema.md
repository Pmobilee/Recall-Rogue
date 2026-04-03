# Movies & Cinema Deck — Provenance Documentation

**Deck ID**: `movies_cinema`
**Facts**: 277
**Sub-decks**: 3
**Sources**: Wikipedia (CC BY-SA 4.0), Wikidata (CC0), AFI lists (public domain)
**Created**: 2026-04-03
**Expanded**: 2026-04-03 — supplement pass (207→277, +70 facts across 3 supplement batches to fill pool gaps)

---

## 1. Deck Structure

| Sub-deck | Facts | Scope |
|---|---|---|
| Iconic Films | 138 | Films, release years, directors, quotes, records, characters |
| Directors & Stars | 67 | Director careers, actor roles, award histories |
| Cinema History & Craft | 72 | Film movements, techniques, industry firsts, country contexts |

**Answer Type Pools (10, post-supplement):**

| Pool ID | Format | Notes |
|---|---|---|
| `film_titles` | name | Canonical film names (55 members) |
| `director_names` | name | Directors; non-director people excluded (39 members) |
| `actor_names` | name | Actors, characters, and non-director industry figures (35 members) |
| `bracket_years` | bracket_year | Years using `{YEAR}` — runtime fills nearby plausible years (31 members) |
| `character_names` | name | Named film characters (22 members; added supp1) |
| `film_quotes` | quote | Famous quoted lines with attributed films (10 members; added supp1) |
| `country_names` | name | Countries of origin for international cinema (10 members + 10 synthetic; added supp2) |
| `cinema_terms` | term | Film genres, movements, techniques (20 members; added supp3) |
| `film_trivia` | mixed | Miscellaneous cinema facts (6 members) |
| `bracket_counts` | bracket_number | Counts (Oscars won, etc.) (4 members) |

---

## 2. Sources

### Wikipedia (CC-BY-SA-4.0)
- **URL**: https://en.wikipedia.org
- **License**: CC BY-SA 4.0
- **What was taken**: Film facts, director bios, actor careers, award history, production details, narrative context for explanations
- **Method**: Every Sonnet worker WebFetched the Wikipedia article for each entity before writing facts
- **Commercial use**: Yes, with attribution and share-alike
- **Attribution**: "Facts sourced from Wikipedia contributors, licensed under CC-BY-SA 4.0"

### Wikidata SPARQL (CC0)
- **URL**: https://www.wikidata.org
- **License**: CC0 (public domain)
- **What was taken**: Best Picture winners with directors and years (1927–2024), director award counts, genre distributions
- **Commercial use**: Yes, unrestricted (CC0)
- **Note**: Machine-verified structured data used as ground truth for dates and numerical claims

### AFI (American Film Institute) — Public Domain (list facts)
- **URL**: https://www.afi.com
- **What was taken**: AFI Top 100 rankings and AFI 100 Years...100 Movie Quotes list — used as reference for film selection and quote selection
- **Commercial use**: Factual references only (rankings, titles); no copyrighted text reproduced
- **Note**: AFI lists are not copyrightable as lists of facts; only factual references were used

---

## 3. Build Pipeline

### Phase 1 — Wikidata SPARQL Research

Opus orchestrator queried Wikidata for:
- Best Picture winners and their directors (1927–2024)
- Director award counts across major festivals
- Genre distributions across eras

Output: verified structured data for ~100 films and ~40 directors.

### Phase 2 — Architecture Design

Opus orchestrator designed pool-first architecture:
- 8 answer type pools (see structure table above)
- 3 sub-decks with target fact counts
- Common confusions mapped (e.g. director vs. actor names)
- Difficulty tiers planned

Output: `data/deck-architectures/movies_cinema_arch.yaml`

### Phase 3 — Fact Generation (7 parallel Sonnet workers)

Each worker received verified Wikidata data and instructions to WebFetch Wikipedia for narrative details. Workers generated facts with full schema compliance.

| Batch | File | Facts | Scope |
|---|---|---|---|
| 1 | `data/decks/_wip/movies_cinema_batch1.json` | 30 | Classic pre-1970 films |
| 2 | `data/decks/_wip/movies_cinema_batch2.json` | 30 | 1970–1995 films |
| 3 | `data/decks/_wip/movies_cinema_batch3.json` | 30 | Modern (1995–2020) + famous quotes |
| 4 | `data/decks/_wip/movies_cinema_batch4.json` | 32 | Directors |
| 5 | `data/decks/_wip/movies_cinema_batch5.json` | 30 | Actors and characters |
| 6 | `data/decks/_wip/movies_cinema_batch6.json` | 28 | Cinema history |
| 7 | `data/decks/_wip/movies_cinema_batch7.json` | 27 | Techniques, craft, records |

### Phase 4 — Assembly

Sonnet content-agent merged all 7 batches into a single CuratedDeck envelope:
- Normalized schema across batches
- Fixed pool assignments: `bracket_numbers` → `bracket_years` for year facts; non-director people moved to `actor_names` pool
- Built pool/tier/subdeck metadata programmatically

Output: `data/decks/movies_cinema.json` (207 facts)

### Phase 5 — Supplement Pass (2026-04-03)

Pool size analysis identified under-populated pools needing ≥15 members for distractor variety. 3 supplement batches added 70 facts:

| Batch | File | Facts | Scope |
|---|---|---|---|
| supp1 | `data/decks/_wip/movies_cinema_supp1.json` | 25 | 15 character_names + 10 film_quotes → iconic_films |
| supp2 | `data/decks/_wip/movies_cinema_supp2.json` | 22 | 12 bracket_years → iconic_films, 10 country_names → cinema_craft |
| supp3 | `data/decks/_wip/movies_cinema_supp3.json` | 23 | 7 cinema_terms → cinema_craft, 11 film_titles → iconic_films, 5 actor_names → directors_and_stars |

Final deck: 277 facts across 10 answer type pools. All supplement facts verified against Wikipedia.

---

## 4. Distractor Generation

- **Method**: LLM-generated by each Sonnet worker reading the specific question and producing 8 plausible wrong answers from world knowledge
- **Pool-based runtime**: At runtime, distractors are drawn from answer type pools (film_titles, director_names, actor_names, etc.) weighted by the confusion matrix
- **Bracket year facts**: Year facts use `{YEAR}` format with empty static distractors — the runtime generates nearby plausible years automatically
- **Sources**: Distractors drawn from film knowledge — same-era directors, same-genre films, related works
- **DB queries**: Permitted only for post-generation collision validation; never used as distractor source

---

## 5. Fact Verification

- **Method**: Every Sonnet worker WebFetched the Wikipedia article for each entity before writing facts; Wikidata SPARQL provided machine-verified dates, director credits, and award counts
- **Known limitations**: Some early Oscar ceremony dates may differ from film release dates (ceremonies are held the following year). All dates verified against Wikipedia
- **Error rate**: 0 factual errors found in automated and structural playtest reviews

---

## 6. Quality Assurance

| Check | Result |
|---|---|
| Structural validation (verify-curated-deck.mjs) | 0 issues |
| Batch verifier (verify-all-decks.mjs, 65 decks) | 0 failures, 0 warnings |
| Automated playtest — 30 charges, all correct | 0 issues |
| Automated playtest — 20 charges, 30% wrong rate | 0 issues |
| LLM playtest review | Pending final scores |

---

## 7. Attribution Requirements

- **In-app credits**: "Movie and cinema facts sourced from Wikipedia contributors (CC-BY-SA 4.0)"
- **Wikidata**: CC0, no attribution required
- **AFI lists**: Factual references only, not copyrightable
- **Share-alike**: Derivative works using Wikipedia-sourced text must also be CC-BY-SA

---

## 8. Reproduction Steps

```bash
# 1. Architecture file:
cat data/deck-architectures/movies_cinema_arch.yaml

# 2. WIP batch files (if still present):
ls data/decks/_wip/movies_cinema_batch*.json

# 3. Final assembled deck — fact count check:
node -e "const d=JSON.parse(require('fs').readFileSync('data/decks/movies_cinema.json','utf8'));console.log(d.facts.length,'facts')"

# 4. Structural validation:
node scripts/verify-all-decks.mjs

# 5. Automated playtest (all correct):
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts movies_cinema --charges 30 --verbose

# 6. Automated playtest (30% wrong):
npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts movies_cinema --charges 20 --wrong-rate 0.3
```
