# Recall Rogue — Complete Content Pipeline Specification

**Date:** March 14, 2026
**Purpose:** Single source of truth for rebuilding the entire fact database from scratch. This document is the canonical spec — everything in the codebase must conform to it.

**Current state:** The fact database is empty (0 facts, 0 vocabulary). All cardback art deleted. This spec covers vocabulary (8 languages), knowledge facts (10 domains), and a geography special deck.

---

## CRITICAL: Agent Directives (Read Before Doing Anything)

### 1. NO API CALLS — EVER

You do NOT have access to the Anthropic API, OpenAI API, or any external LLM API. You MUST NOT import `@anthropic-ai/sdk`, use `fetch("https://api.anthropic.com/...")`, or call any remote model endpoint. This is a hard constraint.

**Instead, use Claude Code's built-in Agent tool to spawn sub-agent workers.** When this document says "Sonnet worker" or "Haiku worker", it means: spawn a sub-agent using the Agent tool with `model: "sonnet"` or `model: "haiku"`. Pass the task as a prompt. Receive the output. This is local orchestration, not an API call.

Example — generating facts for a batch of 20 entities:
```
Use the Agent tool with model: "sonnet" and a prompt containing:
- The system instructions (quality rules from Part 4)
- The batch of 20 entities with their structured data
- The target output schema
The sub-agent returns JSON. You validate it against the 11 gates.
```

For cheaper/faster tasks (semantic bin assignment, validation checks, simple classification), use `model: "haiku"`.

### 2. AUDIT AND REWRITE EXISTING SKILLS FIRST

Before generating ANY content, you MUST:

1. **Read every existing skill** in the repository related to fact generation, vocabulary generation, card generation, content pipeline, and quality assurance. Check `/mnt/skills/`, `scripts/content-pipeline/`, and any `SKILL.md` files.
2. **Compare each skill against this document.** This document is the authority. If a skill contradicts this spec (e.g., uses the Anthropic API, has different quality rules, uses different output schemas, references deprecated pipeline stages), the skill is WRONG.
3. **Rewrite or replace any conflicting skills** to align with this document before executing any pipeline stages. Do not silently use outdated skills.
4. **Delete or disable any skill** that calls external APIs for LLM generation (`@anthropic-ai/sdk`, `haiku-client.mjs` with API calls, etc.). Replace with sub-agent orchestration.

### 3. BE CRITICAL — ASK BEFORE EXECUTING

Before starting work, read this entire document and the game design document. If ANYTHING is:
- **Unclear** — ask for clarification before guessing
- **Contradictory** — point out the contradiction and ask which version to follow
- **Seemingly wrong** (e.g., a data source URL is dead, a field name doesn't match the codebase schema, a subcategory distribution doesn't add to 100%) — flag it
- **Missing** (e.g., a step references a script that doesn't exist, a schema field isn't defined) — ask rather than inventing

Do NOT silently proceed with assumptions. A 30-second question saves hours of wasted generation.

---

## Table of Contents

1. [Vocabulary Pipeline (8 Languages)](#part-1-vocabulary-pipeline)
2. [Knowledge Domain Facts (10 Domains)](#part-2-knowledge-domain-facts)
3. [Geography Special Deck](#part-3-geography-special-deck)
4. [Sonnet Worker Skill Specification](#part-4-sonnet-worker-skill)
5. [Validation Gates & Failure Prevention](#part-5-validation-gates)
6. [Data Source Licensing Table](#part-6-licensing)
7. [Pipeline Architecture](#part-7-pipeline-architecture)

---

## Part 1: Vocabulary Pipeline

### Design Principle

For each language, use the **single easiest pipeline** that produces game-ready vocabulary. No complex multi-source joins unless absolutely necessary. One primary source per language where possible. License restrictions are ignored for vocabulary data — use whichever source provides the highest quality with the least effort.

### Required Fields Per Word

| Field | Required | Notes |
|-------|----------|-------|
| `targetWord` | YES | The word in the target language |
| `englishTranslation` | YES | English meaning (hub language) |
| `reading` | CJK only | Furigana, pinyin, romanization |
| `partOfSpeech` | YES | noun, verb, adjective, adverb, etc. |
| `level` | YES | JLPT / TOPIK / HSK / CEFR |
| `frequencyRank` | NICE TO HAVE | From frequency corpus |

---

### 1.1 Japanese — JMdict + JLPT Level Lists

**Difficulty: EASY**

**Primary source:** JMdict via `scriptin/jmdict-simplified`
- URL: `https://github.com/scriptin/jmdict-simplified/releases`
- Format: Pre-built JSON, updated regularly
- Download: `jmdict-eng-common-3.5.0.json` (~21K common entries) or full `jmdict-eng-3.5.0.json` (~214K)
- Fields: word, reading (kana), English glosses, POS tags, common-word flag

**Level source:** `jamsinclair/open-anki-jlpt-decks`
- URL: `https://github.com/jamsinclair/open-anki-jlpt-decks`
- Contains JLPT N5→N1 word lists
- Join on word/reading to JMdict for translations

**Alternative level source:** Kaggle JLPT dataset at `https://www.kaggle.com/datasets/robinpourtaud/jlpt-words-by-level`

**Reading generation:** Not needed — JMdict includes kana readings natively.

**Furigana rendering (client-side):** `wanakana` (MIT, npm) for kana↔romaji.

**Pipeline:**
```
1. Download jmdict-eng-common JSON from scriptin releases
2. Download JLPT level lists, build level lookup map
3. Join: for each JLPT word, find matching JMdict entry
   → output {word, reading, english, pos, jlptLevel}
```

**Expected output:** ~10,000 words across N5 (~800) / N4 (~700) / N3 (~3,500) / N2 (~1,200) / N1 (~3,800)

---

### 1.2 Mandarin Chinese — complete-hsk-vocabulary

**Difficulty: TRIVIAL** — Single MIT-licensed repo has everything.

**Primary source:** `drkameleon/complete-hsk-vocabulary`
- URL: `https://github.com/drkameleon/complete-hsk-vocabulary`
- License: MIT
- Format: JSON files per HSK level (both HSK 2.0 and HSK 3.0)
- Fields: simplified, traditional, pinyin, English meaning, frequency rank, POS, HSK level

**Supplementary:** `ivankra/hsk30` for cleaner HSK 3.0 data
- URL: `https://github.com/ivankra/hsk30`
- License: MIT — CSV with cross-validated entries

**Reading generation:** Pinyin included in source data. For gaps: `pypinyin` (MIT, pip) or `pinyin` npm package (MIT).

**Pipeline:**
```
1. Download HSK 3.0 JSON files → already game-ready
   Output: {word, pinyin, english, pos, hskLevel, frequencyRank}
```

**Expected output:** 11,092 words: L1 (500), L2 (772), L3 (973), L4 (1,000), L5 (1,071), L6 (1,140), L7-9 (5,636)

---

### 1.3 Korean — NIKL Dictionary + TOPIK Level Lists

**Difficulty: MODERATE** — Requires parsing TOPIK PDFs, but feasible.

**Primary source:** NIKL Korean Basic Dictionary
- URL: `https://huggingface.co/datasets/binjang/NIKL-korean-english-dictionary`
- Format: Structured dataset, 53,200 entries
- Fields: Korean word, English meaning, POS, example sentences

**Level source:** TOPIK vocabulary PDFs from learning-korean.com (Tammy Korean)
- TOPIK I (Beginner, Levels 1-2): 1,671 words — `https://learning-korean.com/DL/TOPIK-I-1671.pdf`
- TOPIK II (Intermediate, Levels 3-4): 2,662 words — `https://learning-korean.com/DL/topik-2662.pdf`
- These are structured PDF tables (Korean word + English meaning) parseable programmatically

**Alternative level source:** NIIED official TOPIK lists — TOPIK 1: 1,850 words, TOPIK 2: 3,900 words — available from koreantopik.com

**Supplementary frequency:** `wordfreq` Python library (MIT) — for words not in TOPIK lists, use frequency rank to assign approximate levels

**Romanization:** `jamo` package (Apache-2.0, pip) decomposes Hangul syllables. Implement Revised Romanization as a lookup table (~200 lines of code).

**Pipeline:**
```
1. Parse TOPIK PDFs → {koreanWord, englishMeaning, topikLevel}
2. Download NIKL dictionary from HuggingFace → {koreanWord, englishMeaning, pos, example}
3. Join TOPIK words against NIKL for POS and examples
4. For words in NIKL but not TOPIK, assign level via wordfreq frequency rank
   Output: {word, english, pos, topikLevel, example}
```

**Expected output:** ~5,500 leveled words (1,850 TOPIK I + 3,900 TOPIK II, deduplicated)

---

### 1.4 Spanish / French / German / Dutch — CEFRLex + Kaikki.org

**Difficulty: EASY** — All four use the exact same pipeline. Write once, parameterize.

These four languages each have a CEFRLex resource (pre-computed CEFR levels from L2 textbook corpora) and Kaikki.org coverage (English Wiktionary extracts with translations, POS, IPA). A single parameterized script handles all four.

**CEFRLex sources (level data):**

| Language | Resource | URL | Entries |
|----------|----------|-----|---------|
| Spanish | ELELex | `https://cental.uclouvain.be/cefrlex/elelex/` → Download | ~24,800 |
| French | FLELex | `https://cental.uclouvain.be/cefrlex/flelex/` → Download | ~14,200 (TT) / ~17,800 (CRF) |
| German | DAFlex | `https://cental.uclouvain.be/cefrlex/daflex/` → Download | ~15,000 est. |
| Dutch | NT2Lex | `https://cental.uclouvain.be/cefrlex/nt2lex/` → Download (also GitHub: `https://github.com/anaistack/NT2Lex`) | ~15,200 (CGN) / ~17,700 (CGN+ODWN) |

All are TSV format, UTF-8. Each row contains a lemma, POS tag, and frequency counts per CEFR level (A1 through C1/C2). The word's assigned level = the lowest CEFR level with non-zero frequency ("first occurrence" method). For French, the "Beacco" version includes a pre-computed CEFR level column.

**Kaikki.org sources (translations):**

| Language | URL | Entries |
|----------|-----|---------|
| Spanish | `https://kaikki.org/dictionary/Spanish/` → JSONL download | ~70K |
| French | `https://kaikki.org/dictionary/French/` → JSONL download | ~60K |
| German | `https://kaikki.org/dictionary/German/` → JSONL download | ~60K |
| Dutch | `https://kaikki.org/dictionary/Dutch/` → JSONL download | ~30K |

All are JSONL (one JSON object per line). Each entry has: word, pos, senses[].glosses (English translations), sounds[].ipa.

**The template pipeline (identical for all 4 languages):**
```javascript
// pseudocode — build-european-vocab.mjs
const LANGUAGES = {
  spanish: { cefrlex: 'elelex', kaikki: 'Spanish', code: 'es' },
  french:  { cefrlex: 'flelex', kaikki: 'French',  code: 'fr' },
  german:  { cefrlex: 'daflex', kaikki: 'German',  code: 'de' },
  dutch:   { cefrlex: 'nt2lex', kaikki: 'Dutch',   code: 'nl' },
};

for (const [lang, config] of Object.entries(LANGUAGES)) {
  // 1. Parse CEFRLex TSV → Map<lemma+pos, cefrLevel>
  const levels = parseCEFRLex(`data/cefrlex/${config.cefrlex}.tsv`);
  
  // 2. Parse Kaikki.org JSONL → Array<{word, pos, english, ipa}>
  const words = parseKaikki(`data/kaikki/${config.kaikki}.jsonl`);
  
  // 3. Join on lemma + POS
  const output = words
    .filter(w => levels.has(`${w.word}:${w.pos}`))
    .map(w => ({
      targetWord: w.word,
      englishTranslation: w.english[0],
      pos: w.pos,
      cefrLevel: levels.get(`${w.word}:${w.pos}`),
      ipa: w.ipa,
      language: config.code,
    }));
  
  writeJSON(`data/vocab/${lang}.json`, output);
}
```

**Expected output per language:** Spanish ~12,000-15,000 words; French ~10,000-12,000; German ~10,000-12,000; Dutch ~8,000-10,000.

---

### 1.5 Czech — Kaikki.org + Frequency-Inferred Levels

**Difficulty: MODERATE** — No CEFRLex resource exists for Czech. Must infer levels from frequency.

**Primary source:** Kaikki.org Czech JSONL
- URL: `https://kaikki.org/dictionary/Czech/` → download JSONL
- Entries: ~20K Czech words with English glosses, POS, IPA

**Frequency source:** `wordfreq` Python library (MIT)
- `pip install wordfreq`
- `wordfreq.zipf_frequency('dům', 'cs')` returns log-frequency on the Zipf scale

**Supplementary frequency:** Leipzig Corpora Czech — `https://wortschatz.uni-leipzig.de/en/download/Czech` (CC-BY 4.0, TSV)

**Level inference (frequency → CEFR heuristic):**
```
Zipf ≥ 5.5  → A1 (~500 most common words)
Zipf 5.0-5.5 → A2 (~1,000 words)
Zipf 4.3-5.0 → B1 (~2,000 words)
Zipf 3.5-4.3 → B2 (~3,000 words)
Zipf 2.8-3.5 → C1 (~3,000 words)
Zipf < 2.8   → C2 (remaining)
```

**Pipeline:**
```
1. Download Kaikki.org Czech JSONL → extract {word, pos, englishGlosses[], ipa}
2. For each word, get Zipf frequency via wordfreq → assign CEFR level
3. Filter to common POS, sort by frequency within each level
   Output: {word, english, pos, cefrLevel, frequencyRank}
```

**Expected output:** ~5,000-8,000 words with inferred CEFR levels

---

### 1.6 Vocabulary Summary

| Language | Primary Source | Level Source | Effort | Expected Words |
|----------|---------------|-------------|--------|----------------|
| Chinese | complete-hsk-vocabulary (MIT) | Built-in HSK levels | Trivial | 11,092 |
| Japanese | JMdict (scriptin) | JLPT level lists | Easy | ~10,000 |
| Spanish | Kaikki.org | CEFRLex ELELex | Easy | ~12,000 |
| French | Kaikki.org | CEFRLex FLELex | Easy | ~10,000 |
| German | Kaikki.org | CEFRLex DAFlex | Easy | ~10,000 |
| Dutch | Kaikki.org | CEFRLex NT2Lex | Easy | ~8,000 |
| Korean | NIKL Dictionary | TOPIK PDFs | Moderate | ~5,500 |
| Czech | Kaikki.org | wordfreq (inferred) | Moderate | ~5,000 |

**Implementation order:** Chinese (1 hour) → European 4-pack (half day) → Japanese (half day) → Korean (1 day) → Czech (half day). **Total: ~3 developer-days.**

---

### 1.7 Reading/Pronunciation Libraries

| Language | Library | License | Platform | Purpose |
|----------|---------|---------|----------|---------|
| Japanese | wanakana | MIT | npm | Kana↔romaji |
| Japanese | kuroshiro | MIT | npm | Kanji→furigana |
| Chinese | pinyin (hotoo) | MIT | npm | Hanzi→pinyin |
| Chinese | pypinyin | MIT | pip | Build-time pinyin |
| Korean | jamo | Apache-2.0 | pip | Hangul decomposition |
| All CJK | epitran | MIT | pip | IPA transcription |

European languages get IPA from Kaikki.org data (Wiktionary includes IPA for most entries). No additional library needed.

---

### 1.8 Runtime Distractor Generation

**Recommendation: Option E — Hybrid POS + Level + Semantic Bins.**

**Build-time:** POS-tag all vocabulary. Cluster words into ~50 broad semantic bins (animals, colors, food, body, weather, emotions) and ~200 narrow sub-bins. Ship only metadata per word: POS tag, level, bin_id, sub_bin_id — **under 300 KB** added to the app bundle.

**Runtime algorithm:** Filter candidates by POS match + level proximity (±1 level). Easy difficulty → distractors from different bins. Medium → same broad bin, different sub-bin. Hard → same sub-bin. Performance: **<10ms for 120 words** on mobile.

**Semantic bin assignment** during build: spawn a sub-agent with `model: "haiku"` for each language batch — prompt: "Assign each of these words to one of these 50 categories: [animals, colors, food, body, weather, ...]". Parse the returned assignments. Total processing time: minutes per language.

---

### 1.9 Programmatic Question Types

Generated by code, not LLM:

| Format | Tier | Template |
|--------|------|----------|
| L2→L1 meaning | 1 | "What does '{targetWord}' mean?" → [correct + 2 distractors] |
| L1→L2 reverse | 2a | "How do you say '{english}' in {language}?" → [correct + 3 distractors] |
| Reading (CJK) | 1 | "What is the reading of '{kanji}'?" → [correct + 2 distractors] |
| Fill-blank | 2b | "'{___}' means '{english}' in {language}" → [correct + 4 distractors] |

Tier 1 = 3 options. Tier 2a = 4 options. Tier 2b = 5 options with close distractors (same sub-bin).

---

### 1.10 Grammar Points

Ship vocabulary only for launch. Grammar data exists only for Japanese (FJSD repo, 644 points) and partially for Korean (TOPIK grammar PDFs). European language grammar requires LLM-generated content — defer to post-launch.

---

### 1.11 Phonetic Mnemonics for Visual Descriptions

The keyword method has one of the largest effect sizes in educational psychology (d ≈ 0.97, Stahl & Fairbanks 1986 meta-analysis). Atkinson & Raugh (1975) demonstrated 88% correct recall vs. 28% for controls.

**Method:** Find an English word phonetically similar to the foreign word ("keyword bridge"), then compose a vivid scene linking the keyword to the meaning for the cardback art.

**Programmatic bridge detection (build-time):** Use `epitran` (pip, MIT, 60+ languages) for L2→IPA conversion + `panphon` (pip, MIT) for weighted articulatory edit distance. Cross-reference against CMU Pronouncing Dictionary (134K English words) to find closest-sounding English words.

**Visual scene composition:** Requires a sub-agent pass per word. Spawn a worker with `model: "sonnet"` to generate a culturally-themed mnemonic scene description linking the keyword bridge to the meaning. Process in batches of 200-500 words per sub-agent call.

**Example:** Japanese "taberu" (to eat) → sounds like "table" → "A samurai's table overflowing with steaming bowls of rice and grilled fish in a traditional Japanese dining room"

---

## Part 2: Knowledge Domain Facts

### 2.1 Target: ~2,000 Facts Per Domain, 20,000 Total

| Domain | Target | Key Subcategories |
|--------|--------|-------------------|
| General Knowledge | 2,000 | Inventions, records, everyday science, oddities, pop culture |
| Natural Sciences | 2,000 | Physics, chemistry, biology, geology, ecology |
| History | 2,000 | Ancient, medieval, early modern, modern, social/cultural |
| Space & Astronomy | 2,000 | Planets, stars, missions, cosmology, exoplanets |
| Mythology & Folklore | 2,000 | Greek/Roman, Norse, Eastern, creatures, creation myths |
| Animals & Wildlife | 2,000 | Mammals, birds, marine, insects, behavior, adaptations |
| Human Body & Health | 2,000 | Anatomy, diseases, neuro, nutrition, genetics |
| Food & World Cuisine | 2,000 | Food history, Asian, European, ingredients, food science |
| Art & Architecture | 2,000 | Painting, sculpture, styles, buildings, modern art |
| Geography | 2,000+ | Handled separately in Part 3 |

### 2.2 The Hybrid Curation Approach

Use curated topic lists to define WHAT to generate facts about, then use Wikidata and specialized APIs to provide STRUCTURED DATA to generate from. This prevents the "broad SPARQL query → 10K obscure entities" failure.

**Per-domain strategy:**

| Domain | Primary Curation | Wikidata Role |
|--------|-----------------|---------------|
| General Knowledge | Wikipedia Vital Articles L4 + Nobel API | Structured data enrichment |
| Natural Sciences | OpenStax textbook TOCs + Vital Articles | Properties (formulas, values) |
| History | Vital Articles + AP curriculum topics | Dates, relationships |
| Space & Astronomy | Wikidata + OpenStax Astronomy | Primary (celestial body data is excellent) |
| Mythology & Folklore | Vital Articles + MANTO + FactGrid | Supplementary (patchy Wikidata coverage) |
| Animals & Wildlife | Wikidata (>20 sitelinks filter) | Primary (taxon data is comprehensive) |
| Human Body & Health | OpenStax Anatomy & Physiology | Properties, relationships |
| Food & World Cuisine | Manual curation + USDA | Supplementary (sparse Wikidata food data) |
| Art & Architecture | Museum APIs + Vital Articles | Properties (dates, creators) |

### 2.3 Key Data Sources

**CC0 / Public Domain (zero risk):**
- **Wikidata** — `https://www.wikidata.org` — CC0 — 100M+ items, SPARQL at `https://query.wikidata.org`
- **USDA FoodData Central** — `https://fdc.nal.usda.gov` — CC0 — hundreds of thousands of food items
- **Met Museum Open Access** — `https://metmuseum.github.io/` — CC0 — 470K+ artworks
- **Art Institute of Chicago** — `https://api.artic.edu/docs/` — CC0 — 131K+ artworks
- **Smithsonian Open Access** — `https://www.si.edu/openaccess` — CC0 — 11M+ records
- **Rijksmuseum** — `https://data.rijksmuseum.nl` — CC0 — 800K+ objects
- **FactGrid Roscher Mythology** — `https://blog.factgrid.de/archives/3454` — CC0 — 15K+ mythical entities
- **Nobel Prize API** — `https://www.nobelprize.org/about/developer-zone-2/` — CC0 — ~1,000 laureates
- **NASA Open APIs** — `https://api.nasa.gov` — Public Domain — APOD, NEO, Mars Rover, Exoplanets
- **CIA World Factbook** — `https://github.com/factbook/factbook.json` — CC0 — 266 entities (frozen Feb 2026)
- **Natural Earth** — `https://www.naturalearthdata.com` — Public Domain — country boundaries, capitals
- **PubChem** — `https://pubchem.ncbi.nlm.nih.gov` — US Gov PD — 111M+ compounds

**CC-BY 4.0 (attribution required, low risk):**
- **World Bank Open Data** — `https://data.worldbank.org` — 1,400+ indicators
- **GeoNames** — `https://www.geonames.org` — 25M+ geographical names
- **MANTO Mythlab** — `https://www.manto-myth.org/manto` — 3,600 mythical entities
- **OpenStax** — `https://openstax.org` — 50+ peer-reviewed textbooks
- **Leipzig Corpora** — `https://wortschatz.uni-leipzig.de/en/download/` — word frequency, 250+ languages
- **Tatoeba** — `https://tatoeba.org/en/downloads` — sentence pairs

**Curated topic list (backbone):**
- **Wikipedia Vital Articles Level 4** — `https://en.wikipedia.org/wiki/Wikipedia:Vital_articles` — 10,000 articles organized by category, extractable via MediaWiki API, each maps to a Wikidata Q-ID
- **Open Trivia Database** — `https://opentdb.com` — ~4,738 verified questions (CC-BY-SA 4.0, use for reference/inspiration only)

### 2.4 Wikipedia Pageview Data as Engagement Proxy

Use pageview counts to select "notable" entities and inform fun scoring.

**API endpoint:** `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/{title}/daily/{start}/{end}`

**Bulk dumps:** `https://dumps.wikimedia.org/other/pageview_complete/`

Use 90-day rolling average. Topics with >10K monthly views are broadly recognizable; <1K may be too niche for general trivia.

### 2.5 Wikidata Popularity Filtering

For domains where Wikidata is the primary source (Animals, Space), filter by sitelinks to ensure notability:

```sparql
SELECT ?item ?itemLabel ?sitelinks WHERE {
  ?item wdt:P31 wd:Q729 .  # instance of: animal
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT 2000
```

Entities with articles in 20+ Wikipedia language editions are globally notable. Produces 500K-1.5M entities across all domains — far more than needed.

### 2.6 Subcategory Distributions (Mandatory)

These prevent the "61% battles" disaster. No single subcategory exceeds 18%.

**History (2,000 facts):**
- Ancient Civilizations 14%, Medieval 10%, Renaissance & Exploration 10%, Colonial Era & Revolutions 10%, Industrial Revolution 8%, World War I 7%, World War II 10%, Cold War & 20th Century 8%, Social & Cultural History 14%, Historical Figures 9%

**Animals & Wildlife (2,000 facts):**
- Mammals 16%, Birds 12%, Marine Life 14%, Reptiles & Amphibians 10%, Insects & Arachnids 10%, Animal Behaviors & Abilities 15%, Endangered Species 10%, Animal Records & Extremes 13%

**Human Body & Health (2,000 facts):**
- Anatomy & Organs 14%, Brain & Neuroscience 14%, Immunity & Disease 12%, Cardiovascular 10%, Digestion & Nutrition 12%, Senses & Perception 10%, Genetics & DNA 12%, Medical Discoveries 8%, Human Records 8%

**Natural Sciences (2,000 facts):**
- Physics & Mechanics 18%, Chemistry & Elements 16%, Biology & Organisms 14%, Geology & Earth 12%, Ecology & Environment 10%, Materials & Engineering 10%, Scientific Discoveries 10%, Math & Numbers 10%

**General Knowledge (2,000 facts):**
- World Records & Superlatives 15%, Inventions & Discoveries 15%, Language & Words 12%, Famous Firsts 12%, Money & Economics 10%, Symbols & Flags 10%, Calendar & Time 8%, Transportation 8%, Miscellaneous Oddities 10%

**Space & Astronomy (2,000 facts):**
- Planets & Moons 18%, Stars & Galaxies 15%, Space Missions 15%, Cosmology & Universe 12%, Astronauts & Space History 12%, Exoplanets 8%, Space Technology 10%, Astronomical Records 10%

**Mythology & Folklore (2,000 facts):**
- Greek & Roman 20%, Norse & Celtic 15%, Eastern Myths 15%, Creatures & Monsters 15%, Creation & Cosmology 10%, Folk Legends 15%, Gods & Deities 10%

**Food & World Cuisine (2,000 facts):**
- Food History & Origins 15%, Asian Cuisine 15%, European Cuisine 12%, Americas Cuisine 10%, Ingredients & Spices 12%, Food Science 10%, Fermentation & Beverages 10%, Baking & Desserts 8%, Food Records & Oddities 8%

**Art & Architecture (2,000 facts):**
- Painting & Visual Art 18%, Sculpture & Decorative 12%, Architectural Styles 15%, Famous Buildings 15%, Modern & Contemporary 12%, Museums & Institutions 10%, Art History Movements 10%, Engineering & Design 8%

---

## Part 3: Geography Special Deck

### 3.1 Data Sources

**Country data:** `mledoze/countries` (ODbL-1.0)
- URL: `https://github.com/mledoze/countries`
- Format: JSON (250+ ISO 3166-1 entities — filter `unMember: true` for 193 UN states)
- Fields: common/official names, capitals (array — handles multi-capital countries), continent/region/subregion, population, area, languages, currencies, ISO codes, lat/lng, borders
- Includes SVG flags in `data/` folder

**Flag SVGs:** `hampusborgos/country-flags` (Public Domain)
- URL: `https://github.com/hampusborgos/country-flags`
- Higher-quality SVGs + pre-rendered PNGs at 100px, 250px, 1000px widths
- Named by ISO alpha-2 code

**Supplementary:** GeoNames countryInfo.txt for capital coordinates
- `wget https://download.geonames.org/export/dump/countryInfo.txt`

**Download:**
```bash
git clone https://github.com/mledoze/countries.git
git clone https://github.com/hampusborgos/country-flags.git
```

### 3.2 Sub-decks

| Sub-deck | Content | Bidirectional |
|----------|---------|---------------|
| Capitals | Country ↔ Capital city | Yes |
| Flags | Country ↔ Flag image | Yes |
| Continents | Country ↔ Continent/Region | Yes |

### 3.3 Multi-Capital Handling

11 countries have multiple official capitals: South Africa (3), Bolivia, Malaysia, Netherlands, Sri Lanka, Tanzania, Côte d'Ivoire, Benin, Eswatini, Burundi, Myanmar. Israel/Jerusalem is disputed.

Store capitals as array of objects: `{name, type, isPrimary}`. Accept any listed capital as correct. Multi-capital countries trigger a "Did you know?" tooltip.

### 3.4 Distractor Strategies

**Capitals:** Use geographic proximity via haversine distance on lat/lng. For France (Paris), select Brussels, Luxembourg City, Amsterdam as nearby-but-wrong capitals. Filter to same region/continent first.

**Flags:** Pre-compute visual similarity groups. Known confusable pairs:
- Chad/Romania (near-identical tricolors)
- Monaco/Indonesia (identical red-white bicolors)
- Ireland/Côte d'Ivoire (reversed green-white-orange)
- Nordic crosses (Denmark/Sweden/Norway/Finland/Iceland)

Ship a `flag_distractors` array per country (3-5 visually similar flags).

**Continents:** Use wrong-continent distractors. For Egypt: [Africa ✓ / Asia / Europe].

### 3.5 Difficulty Ratings (1-5)

Combine population, tourism prominence, G20 membership, flag distinctiveness:
- **Tier 1 (Very Easy):** USA, UK, China, France, Japan, Germany, Australia, Canada, Brazil, India, Russia
- **Tier 2 (Easy):** Italy, Spain, Mexico, Egypt, South Korea, Turkey, Thailand, South Africa, Sweden, Greece
- **Tier 3 (Medium):** Portugal, Argentina, Poland, Vietnam, Morocco, Kenya, Chile, Colombia, Peru, Philippines
- **Tier 4 (Hard):** Latvia, Slovenia, Bhutan, Mozambique, Paraguay, Laos, Mongolia, Brunei, Namibia, Oman
- **Tier 5 (Very Hard):** Comoros, Djibouti, Eswatini, São Tomé, Tuvalu, Nauru, Palau, Kiribati, Guinea-Bissau

---

## Part 4: Sonnet Worker Skill Specification

### 4.1 Overview

Knowledge domain facts are generated by **spawning Claude sub-agent workers** using Claude Code's Agent tool with `model: "sonnet"`. Every single fact is LLM-generated, but from carefully curated structured input data (not "generate 2000 science facts from your training data").

**CRITICAL: Do NOT use the Anthropic API, `@anthropic-ai/sdk`, or any external HTTP endpoint for generation. All LLM work is done by spawning sub-agents via the Agent tool.**

### 4.2 Worker Configuration

- Spawn sub-agents using Claude Code Agent tool with `model: "sonnet"` for fact generation
- Use `model: "haiku"` for cheaper tasks: validation, classification, semantic bin assignment
- Each sub-agent call should process **20-30 entities** producing **3-5 facts per entity** (60-150 facts per call)
- Quality degrades beyond 5 facts per entity — the model starts recycling patterns
- Pass the full system prompt (quality rules below) + structured entity data as the agent prompt
- Parse the returned text as JSON — validate against schema before accepting
- If a sub-agent returns malformed output, retry once with a simplified prompt before flagging for review

### 4.3 Output Schema (Per Fact)

Every row in the output JSON MUST include ALL of these fields:

```json
{
  "id": "domain-prefix-unique-slug",
  "type": "knowledge",
  "domain": "Animals & Wildlife",
  "subdomain": "marine_life",
  "categoryL1": "Animals & Wildlife",
  "categoryL2": "marine_life",
  "categoryL3": "",
  "statement": "The pistol shrimp snaps its claw so fast it creates a cavitation bubble reaching nearly 4,700°C.",
  "quizQuestion": "What extreme phenomenon does a pistol shrimp's claw snap produce?",
  "correctAnswer": "A cavitation bubble",
  "distractors": ["A sonic boom", "An electric discharge", "A bioluminescent flash", "A pressure wave", "A magnetic pulse", "An ink cloud", "A thermal vent", "A chemical spray"],
  "acceptableAnswers": ["cavitation bubble"],
  "explanation": "Pistol shrimp snap their oversized claw so fast it creates a cavitation bubble that briefly reaches temperatures comparable to the sun's surface.",
  "wowFactor": "This tiny shrimp briefly creates temperatures hotter than the surface of the sun — with a claw snap!",
  "variants": [
    {"type": "forward", "question": "What does a pistol shrimp's claw snap produce?", "answer": "A cavitation bubble", "distractors": ["A sonic boom", "An electric discharge", "A bioluminescent flash"]},
    {"type": "reverse", "question": "Which marine creature produces cavitation bubbles reaching 4,700°C?", "answer": "Pistol shrimp", "distractors": ["Mantis shrimp", "Electric eel", "Box jellyfish"]},
    {"type": "negative", "question": "Which is NOT a result of a pistol shrimp's claw snap?", "answer": "Bioluminescent flash", "distractors": ["Cavitation bubble", "Extreme heat", "Shockwave"]},
    {"type": "truefalse", "question": "A pistol shrimp's claw snap can produce temperatures reaching nearly 4,700°C.", "answer": "True", "distractors": ["False"]},
    {"type": "context", "question": "A biologist observes a small crustacean stun prey with a snap producing extreme heat. What creature?", "answer": "Pistol shrimp", "distractors": ["Mantis shrimp", "Coconut crab", "Horseshoe crab"]}
  ],
  "difficulty": 3,
  "funScore": 9,
  "noveltyScore": 9,
  "ageRating": "kid",
  "rarity": "rare",
  "sourceName": "Wikipedia",
  "sourceUrl": "https://en.wikipedia.org/wiki/Alpheidae",
  "contentVolatility": "timeless",
  "sensitivityLevel": 0,
  "sensitivityNote": null,
  "visualDescription": "A tiny iridescent shrimp in dark ocean depths, its oversized claw glowing white-hot as a plasma bubble erupts from the snap, illuminating surrounding coral in brilliant orange light",
  "tags": ["marine", "extreme_animals", "physics_in_nature"]
}
```

### 4.4 Quality Rules (in Worker System Prompt)

1. **Question length:** Max 15 words. Must end with `?`.
2. **Answer length:** Max 5 words / 30 characters.
3. **Distractor count:** 8-12 per fact, max 30 chars each.
4. **Distractor quality:** Semantically coherent, plausible, factually WRONG, similar length to correct answer. NEVER use "Unknown", "Other", "None of the above", "All of the above", "N/A", empty strings.
5. **Variant count:** Minimum 4 per fact (forward + reverse + one of negative/truefalse/context + fill_blank).
6. **Fun score honesty:** Classification facts ("X is a type of Y") are NEVER above 4. Scores of 8+ require genuine surprise.
7. **Explanation quality:** 1-3 sentences, engaging, adds context. NEVER circular ("X is X"). NEVER template ("This is important to science").
8. **Visual description:** 20-40 words, vivid scene for pixel art cardback. Mnemonic — helps player remember the fact.
9. **Source verification:** `sourceName` REQUIRED. `sourceUrl` strongly recommended.
10. **No overlap:** Within a batch, no two facts about the same entity from the same angle.
11. **No classification questions:** Do NOT generate "What type of X is Y?" → "bird/mammal/fish" questions.

### 4.5 Fun Score Calibration

Multi-signal formula: `funScore = round((surprise × 0.4) + (relatability × 0.35) + (narrative × 0.25))`

**Anchor examples (MUST be in system prompt):**
- Score 1-2: "Water boils at 100°C", "The atomic number of hydrogen is 1"
- Score 3-4: "Tokyo is Japan's capital", "Gold is element 79"
- Score 5-6: "The Great Wall is visible from low orbit", "Octopuses have three hearts"
- Score 7-8: "Honey never spoils — 3,000-year-old Egyptian honey was still edible", "Wombat poop is cube-shaped"
- Score 9-10: "Cleopatra lived closer to the Moon landing than to the Great Pyramid's construction"

**Post-hoc check:** Reject any batch where fun score std_dev < 1.5 or >30% cluster on single integer.

### 4.6 Age Rating Rubric

| Rating | Label | Criteria |
|--------|-------|----------|
| `kid` | Ages 8+ | No violence, death counts, substances, mature themes. Understandable by a 10-year-old. |
| `teen` | Ages 13+ | Historical violence OK, mild medical content, basic chemistry. No graphic detail. |
| `adult` | Ages 18+ | Detailed medical/pharmacological content, graphic historical events, controversial topics. |

Classification uses content-keyword flags: if any Adult flag triggers, fact gets Adult rating.

### 4.7 Batch Workflow

```
Step 1: Prepare curated entity list (Vital Articles + Wikidata enrichment + API data)
        → JSON array of {entityName, wikidataId, properties, subcategory}

Step 2: Split into sub-batches of 20-30 entities each

Step 3: For each sub-batch, spawn a sub-agent worker:
        - Use Claude Code Agent tool with model: "sonnet"
        - Prompt contains: system instructions (quality rules from this spec)
                          + sub-batch entity data as JSON
                          + target subcategory
                          + full output schema example
        - Parse returned output as JSON
        - On malformed output: retry once with simplified prompt, then flag

Step 4: Validate output (11 gates — see Part 5)

Step 5: Merge validated batches into seed JSON files

Step 6: Build facts.db via build-facts-db.mjs
```

**For cheaper tasks (semantic bin assignment, age rating checks, distractor validation):**
Use Agent tool with `model: "haiku"` instead of "sonnet" — faster and sufficient for classification work.

---

## Part 5: Validation Gates

### 5.1 Automated Gates (11 Checks)

| # | Gate | Rule | Action |
|---|------|------|--------|
| 1 | Answer length | `len(answer) ≤ 30 chars` | Hard reject |
| 2 | Schema validation | JSON validates against schema | Hard reject |
| 3 | Source attribution | `sourceName` is not null/empty | Hard reject |
| 4 | Variant count | `variants.length ≥ 4` | Hard reject, regenerate |
| 5 | Circular detection | Jaccard(question, answer) > 0.5 | Reject |
| 6 | Duplicate detection | Embedding cosine sim > 0.92 vs existing facts | Reject |
| 7 | Classification filter | Regex: `"What (type\|kind\|category) of.*is"` | Reject |
| 8 | Entity validation | Entity name vs Wikidata label fuzzy match ≥ 0.85 | Reject |
| 9 | Distractor quality | All distractors ≠ answer, same entity type, similar length | Reject variant |
| 10 | Fun score distribution | Per-batch std_dev < 1.5 OR >30% in single bucket | Flag batch |
| 11 | Age rating consistency | Content keyword scan matches declared rating | Flag for review |

### 5.2 Preventing Previous Failures

| Previous Failure | Root Cause | Prevention |
|------------------|-----------|------------|
| "What type of animal is X?" → "bird" | Unconstrained prompt | Gate #7 regex + explicit prompt prohibition |
| 81% missing source attribution | Optional field | Gate #3 hard reject + schema `minLength: 1` |
| 76% fun scores at 5-6 | Uncalibrated scoring | Anchor examples + forced distribution + Gate #10 |
| 61% of History was battles | No subcategory quotas | Pre-allocated quotas, pipeline monitoring |
| "X is X" circular explanations | No detection | Gate #5 Jaccard + embedding similarity |
| 0.3% variant coverage | Variants not generated | Gate #4 minimum 4 variants required |
| 3,199 answers > 30 chars | No enforcement | Gate #1 hard reject + schema `maxLength: 30` |
| "RNA like tension headache" corrupted entities | No entity validation | Gate #8 Wikidata label matching + blocklist |

---

## Part 6: Licensing

### 6.1 Knowledge Domain Sources

| Source | License | Commercial OK? | Attribution? |
|--------|---------|---------------|-------------|
| Wikidata | CC0 | Yes | No |
| USDA FoodData Central | CC0 | Yes | No |
| Met Museum | CC0 | Yes | No |
| Art Institute of Chicago | CC0 (CC-BY for descriptions) | Yes | Descriptions only |
| Smithsonian | CC0 | Yes | No |
| Rijksmuseum | CC0 | Yes | No |
| FactGrid Roscher | CC0 | Yes | No |
| Nobel Prize API | CC0 | Yes | No |
| NASA APIs | US Gov PD | Yes | No |
| CIA Factbook | CC0/PD | Yes | No |
| Natural Earth | Public Domain | Yes | No |
| PubChem | US Gov PD | Yes | No |
| World Bank | CC-BY 4.0 | Yes | Yes |
| GeoNames | CC-BY 4.0 | Yes | Yes |
| MANTO | CC-BY 4.0 | Yes | Yes |
| OpenStax | CC-BY 4.0 | Yes | Yes |
| Leipzig Corpora | CC-BY 4.0 | Yes | Yes |
| Tatoeba | CC-BY 2.0 FR | Yes | Yes |
| mledoze/countries | ODbL 1.0 | Yes (produced works) | Yes |
| hampusborgos/country-flags | Public Domain | Yes | No |
| Open Trivia DB | CC-BY-SA 4.0 | Reference only | — |

### 6.2 Vocabulary Sources (License Restrictions Ignored)

| Source | License | Notes |
|--------|---------|-------|
| JMdict (scriptin) | CC-BY-SA 4.0 | EDRDG explicitly permits commercial use |
| complete-hsk-vocabulary | MIT | No restrictions |
| ivankra/hsk30 | MIT | No restrictions |
| NIKL Korean Dictionary | CC-BY-SA 2.0 KR | — |
| CEFRLex (all variants) | CC-BY-NC-SA 4.0 | Used regardless |
| Kaikki.org (Wiktionary) | CC-BY-SA 3.0 + GFDL | — |
| wordfreq | MIT | No restrictions |
| TOPIK PDFs | Unspecified (educational) | — |

### 6.3 Recommended Credits Page

> Data sources: Wikidata (CC0), GeoNames (CC-BY 4.0), World Bank (CC-BY 4.0), OpenStax (CC-BY 4.0), MANTO (CC-BY 4.0), mledoze/countries (ODbL-1.0). Country flags from Wikimedia Commons. Art data from The Metropolitan Museum of Art, Art Institute of Chicago, Rijksmuseum, and Smithsonian Institution (CC0). Dictionary data from JMdict/EDRDG and Wiktionary.

---

## Part 7: Pipeline Architecture

### 7.1 Six-Stage Pipeline

```
STAGE 1 — RAW DATA INGESTION
  Download: Wikidata dumps, Wikipedia pageviews, dictionary files,
            museum APIs, CEFRLex TSVs, Kaikki.org JSONLs, HSK JSONs
  Store: data/raw/{source}/

STAGE 2 — CURATED INPUT GENERATION
  For vocabulary: parse + join per language (see Part 1)
  For knowledge: select entities via Vital Articles L4 + Wikidata filtering
                 Apply subcategory quotas, validate Q-IDs, sanitize strings
  Store: data/curated/{domain}/ and data/curated/vocab/{language}/

STAGE 3 — FACT GENERATION
  Vocabulary: programmatic (word + translation + readings + POS + level + bin)
  Knowledge: spawn Sonnet sub-agents via Agent tool (20-30 entities per call, all 6 variants)
  Semantic bins + validation: spawn Haiku sub-agents via Agent tool
  Store: data/generated/{domain}/ and data/generated/vocab/{language}/

STAGE 4 — AUTOMATED VALIDATION (11 gates)
  Run all 11 validation gates from Part 5
  Reject / flag / pass decisions logged
  Store: data/generated/qa-reports/

STAGE 5 — QA REVIEW
  Human review of 5-10% of generated facts
  Focus: borderline age ratings, extreme fun scores, complex topics
  Spot-check source URLs

STAGE 6 — PRODUCTION BUILD
  Promote to: src/data/seed/*.json
  Build: public/facts.db via build-facts-db.mjs
  Build: public/seed-pack.json
```

### 7.2 Estimated Effort

| Stage | Vocabulary | Knowledge | Total |
|-------|-----------|-----------|-------|
| Pipeline scripts | 3 days | 2 days | 5 days |
| Data download + prep | 1 day | 2 days | 3 days |
| Generation | <1 day (programmatic) | 2-3 days (Sonnet sub-agents) | 3 days |
| Validation + QA | 1 day | 2 days | 3 days |
| **Total** | **~5 days** | **~8 days** | **~14 days** |

### 7.3 Implementation Order

1. **Chinese vocabulary** (trivial, builds confidence)
2. **European 4-pack vocabulary** (single script, 4 languages)
3. **Japanese vocabulary**
4. **Geography special deck** (programmatic, no LLM)
5. **Knowledge domain generation** (Sonnet sub-agents, largest effort)
6. **Korean vocabulary** (PDF parsing)
7. **Czech vocabulary** (frequency inference)
8. **Cardback art regeneration** (after facts populated)
