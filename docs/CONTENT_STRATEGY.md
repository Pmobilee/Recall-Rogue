# Arcane Recall — Content Strategy & Source Registry

> This document is the single source of truth for WHERE content comes from, HOW it is generated, and WHAT licenses apply.
> For game mechanics and fact schema, see `GAME_DESIGN.md`. For pipeline implementation, see `docs/roadmap/phases/AR-17-HAIKU-FACT-ENGINE.md`.

---

## 1. Commercial Licensing Requirements

Arcane Recall is a commercial product. ALL fact content must come from sources with licenses that permit commercial use without copyleft/ShareAlike obligations.

### Approved Licenses

| License | Commercial Use | Attribution | ShareAlike | Status |
|---------|---------------|-------------|------------|--------|
| CC0 (Public Domain) | ✅ Yes | Not required | No | **PREFERRED** |
| CC-BY 4.0 | ✅ Yes | Required | No | Approved |
| CC-BY 3.0 | ✅ Yes | Required | No | Approved |
| CC-BY 2.0 | ✅ Yes | Required | No | Approved |
| US Government Works | ✅ Yes (PD) | Not required | No | Approved |
| MIT License | ✅ Yes | Required | No | Approved |
| Apache 2.0 | ✅ Yes | Required | No | Approved |
| JMdict/EDRDG Custom | ✅ Yes | Required + donation encouraged | No | Approved (verified) |

### Prohibited Licenses

| License | Issue | Action |
|---------|-------|--------|
| CC-BY-SA (any version) | ShareAlike — derivative work ambiguity for quiz questions | **DO NOT USE as content source** |
| CC-BY-NC (any version) | NonCommercial — explicitly bans commercial use | **DO NOT USE** |
| CC-BY-NC-SA | Both NC and SA restrictions | **DO NOT USE** |
| GPL / AGPL | Viral copyleft | **DO NOT USE for data** |
| Unknown / No license | Assume all rights reserved | **DO NOT USE** |

### The Wikipedia Question

Wikipedia text is CC-BY-SA 3.0/4.0. Whether quiz questions generated from Wikipedia articles constitute "derivative works" is legally unsettled. Our position:

- **Wikipedia is a VERIFICATION source, not a content source**
- Facts are generated from CC0/CC-BY structured data (Wikidata, NASA, etc.)
- Accuracy is cross-referenced against Wikipedia, but `sourceName` never points to Wikipedia as the origin
- The `sourceUrl` field points to the actual CC0/CC-BY source (Wikidata item URL, NASA page, etc.)
- This completely sidesteps the ShareAlike question

Similarly, Open Trivia Database (opentdb.com) is CC-BY-SA 4.0 — we do NOT use it as a source.

---

## 2. Source Registry by Domain

### General Knowledge

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **Wikidata SPARQL** | CC0 | JSON/CSV | Millions | Cross-domain structured data. PRIMARY SOURCE. |
| **Smithsonian Open Access** | CC0 | API/JSON | 4.7M+ items | Cross-domain museum collection data |
| OpenStax Textbooks (CC-BY) | CC-BY 4.0 | HTML/PDF | Varies | Textbook-quality explanations. Check each book's license individually — some are CC-BY-NC-SA |

### Natural Sciences

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **Wikidata SPARQL** | CC0 | JSON | 500K+ | Chemical elements, physical constants, biological taxonomy |
| **PubChem (NIH)** | CC0 | REST API/JSON | 115M+ compounds | Chemical compound properties, molecular data |
| **OpenStax Biology/Chemistry/Physics** | CC-BY 4.0 | HTML | Full textbooks | Verified educational content |
| GBIF | CC0 | API/CSV | 2.4B+ occurrences | Species data, taxonomy |

### Space & Astronomy

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **NASA Open APIs** | US Gov (PD) | REST API/JSON | Varies | APOD, NEO, Mars Rover, exoplanets |
| **Wikidata SPARQL** | CC0 | JSON | 50K+ | Planets, moons, missions, astronauts, stars |
| NASA Exoplanet Archive | US Gov (PD) | CSV/API | 5,600+ | Confirmed exoplanets with properties |
| JPL Small-Body Database | US Gov (PD) | API | 1.3M+ | Asteroids, comets, orbital data |

### Geography

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **Wikidata SPARQL** | CC0 | JSON | 200K+ | Countries, cities, landmarks, demographics |
| **World Bank Open Data** | CC-BY 4.0 | API/CSV | 16K+ indicators | Population, GDP, development indicators |
| Natural Earth | Public Domain | Shapefiles/CSV | ~250 countries | Boundaries, populated places, physical features |
| GeoNames | CC-BY 4.0 | CSV | 11M+ | Place names, coordinates, populations |

### History

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **Wikidata SPARQL** | CC0 | JSON | 500K+ | Historical events, figures, battles, inventions |
| **OpenStax US/World History** | CC-BY 4.0 | HTML | Full textbooks | Structured historical narratives |
| Smithsonian Open Access | CC0 | API | 4.7M+ | Historical artifacts, primary sources |

### Mythology & Folklore

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **Wikidata SPARQL** | CC0 | JSON | 30K+ | Deities, creatures, mythological figures across all cultures |
| Smithsonian Open Access | CC0 | API | Varies | Mythological artifacts, cultural items |
| OpenStax World History | CC-BY 4.0 | HTML | Chapters | Ancient civilization mythology sections |

### Animals & Wildlife

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **GBIF** | CC0 | API/CSV | 2.4B+ occurrences | Species taxonomy, distribution, conservation |
| **Wikidata SPARQL** | CC0 | JSON | 200K+ species | Taxonomy, habitats, conservation status, diet |
| IUCN Red List | Varies (check) | API | 150K+ species | Conservation status — verify commercial API terms |
| Smithsonian NMNH | CC0 | API | Millions | Natural history specimens |

### Human Body & Health

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **OpenStax Anatomy & Physiology** | CC-BY 4.0 | HTML | Full textbook | Comprehensive anatomy content |
| **PubChem (NIH)** | CC0 | API | 115M+ | Drug compounds, molecular biology |
| **USDA FoodData Central** | US Gov (PD) | API/CSV | 400K+ foods | Nutritional data (cross-ref with Food domain) |
| MedlinePlus (NIH) | US Gov (PD) | API | 1K+ topics | Health conditions, treatments — consumer-level |

### Food & World Cuisine

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **USDA FoodData Central** | US Gov (PD) | API/CSV | 400K+ | Nutritional composition, food groups |
| **Wikidata SPARQL** | CC0 | JSON | 50K+ | Dishes, ingredients, cuisines, food origins |
| OpenStax Nutrition | CC-BY 4.0 | HTML | Chapters | Nutritional science content |

### Art & Architecture

| Source | License | Format | ~Records | Notes |
|--------|---------|--------|----------|-------|
| **Metropolitan Museum of Art API** | CC0 | REST API/JSON | 490K+ objects | Artworks, artists, periods, techniques |
| **Art Institute of Chicago API** | CC0 | REST API/JSON | 120K+ | Artwork metadata, artist info |
| **Wikidata SPARQL** | CC0 | JSON | 100K+ | Artists, art movements, architectural landmarks |
| Smithsonian American Art | CC0 | API | 60K+ | American art collection |
| Rijksmuseum API | CC0 metadata | REST API | 700K+ | Dutch Golden Age and European art |

---

## 3. Language Vocabulary Sources

### Japanese (JLPT N5–N1)

| Source | License | Format | ~Words | Notes |
|--------|---------|--------|--------|-------|
| **JMdict/EDRDG** | Custom (commercial OK with attribution) | XML/JSON | 190K+ entries | THE canonical Japanese-English dictionary. EDRDG explicitly permits commercial use. Attribution to EDRDG required. Donation encouraged if profiting. |
| **Tatoeba** | CC-BY 2.0 FR (per sentence, per author) | CSV/API | 1.5M+ Japanese sentences | Example sentences. Attribution per sentence author required. |
| BCCWJ Frequency List | Academic (check terms) | CSV | 100K+ | Balanced Corpus of Contemporary Written Japanese frequency data |
| Wikipedia JP frequency | CC-BY-SA (avoid) | — | — | Use for reference only, not as source |

### Spanish (CEFR A1–C2)

| Source | License | Format | ~Words | Notes |
|--------|---------|--------|--------|-------|
| **Wikidata SPARQL** | CC0 | JSON | Varies | Lexeme data for Spanish words |
| **Tatoeba** | CC-BY 2.0 FR | CSV/API | 500K+ Spanish sentences | Example sentences |
| OpenSubtitles frequency | Check license | CSV | 50K+ | Frequency-ranked from movie subtitles |
| CEFR-aligned word lists | Varies (many academic) | CSV | ~5K per level | Must verify each list's license individually |

### French (CEFR A1–C2)

| Source | License | Format | ~Words | Notes |
|--------|---------|--------|--------|-------|
| **Wikidata SPARQL lexemes** | CC0 | JSON | Varies | French lexeme data |
| **Tatoeba** | CC-BY 2.0 FR | CSV/API | 800K+ French sentences | Example sentences |
| Lexique.org | CC-BY-SA (AVOID as source) | — | 140K+ | Use for reference/verification only |

### German (CEFR A1–C2)

| Source | License | Format | ~Words | Notes |
|--------|---------|--------|----------|-------|
| **Wikidata SPARQL lexemes** | CC0 | JSON | Varies | German lexeme data |
| **Tatoeba** | CC-BY 2.0 FR | CSV/API | 300K+ German sentences | Example sentences |
| DWDS frequency | Check terms | API | 400K+ | Berlin-Brandenburg Academy corpus |

### Korean (TOPIK 1–6)

| Source | License | Format | ~Words | Notes |
|--------|---------|--------|--------|-------|
| **Wikidata SPARQL lexemes** | CC0 | JSON | Varies | Korean lexeme data |
| **Tatoeba** | CC-BY 2.0 FR | CSV/API | 30K+ Korean sentences | Example sentences (smaller corpus) |
| National Institute of Korean Language | Check terms | Various | Standard Korean dictionary — verify API access and commercial terms |

### Mandarin Chinese (HSK 1–6)

| Source | License | Format | ~Words | Notes |
|--------|---------|--------|--------|-------|
| **CC-CEDICT** | CC-BY-SA 4.0 | Text/CSV | 120K+ entries | **LICENSING CONCERN**: CC-BY-SA. Use for verification only, NOT as primary source. Generate vocab from Wikidata lexemes instead. |
| **Wikidata SPARQL lexemes** | CC0 | JSON | Varies | Chinese lexeme data — PRIMARY for Mandarin |
| **Tatoeba** | CC-BY 2.0 FR | CSV/API | 100K+ Chinese sentences | Example sentences |
| HSK word lists | Public (government standard) | Various | ~5K (HSK 1-6) | HSK levels are a public standard — individual word list publications may have their own licenses |

---

## 4. Haiku Generation Pipeline

### Overview

Raw structured data from approved sources is transformed into game-ready Fact schema JSON using Claude Haiku API.

```
Source Data (CC0/CC-BY)
    ↓
Wikidata SPARQL / API fetch scripts
    ↓
Structured JSON (raw facts)
    ↓
Claude Haiku API (domain-specific system prompt)
    ↓
Fact schema JSON (question, distractors, difficulty, funScore, visualDescription)
    ↓
Schema validation + duplicate detection
    ↓
Human verification queue (verifiedAt = null until reviewed)
    ↓
Production database (public/facts.db)
```

### Cost Projections

| Item | Estimate |
|------|----------|
| Tokens per fact (input + output) | ~500 input + ~800 output |
| Haiku pricing | $0.25/M input, $1.25/M output |
| Cost per fact | ~$0.001125 |
| Cost per 10K facts | ~$11.25 |
| 10 knowledge domains × 10K | ~$112.50 |
| 6 languages × 5K vocab | ~$33.75 |
| **Total estimated generation cost** | **~$150** |
| Verification/re-generation overhead (20%) | ~$30 |
| **Grand total** | **~$180** |

Note: These are estimates. Actual costs depend on prompt complexity, retries, and rejection rates.

### System Prompt Structure

Each domain gets a tailored system prompt that instructs Haiku to:
1. Generate a quiz question from the structured input data
2. Create 3–4 question variants (forward, reverse, fill-blank, true/false)
3. Generate 8–25 plausible distractors with difficulty tiers
4. Rate difficulty (1–5) and funScore (1–10)
5. Write a `wowFactor` framing (mind-blowing restatement)
6. Generate a `visualDescription` for card back art
7. Set appropriate `ageRating`
8. Preserve the `sourceName` and `sourceUrl` from input data

See `docs/roadmap/phases/AR-17-HAIKU-FACT-ENGINE.md` for full system prompt specifications.

---

## 5. Quality Assurance

### Source Quality Tiers

| Tier | Source Type | Trust Level | Pipeline Action |
|------|-----------|-------------|-----------------|
| Gold | Wikidata, NASA, NIH, US Gov, museum APIs | High | Accept if schema valid |
| Silver | OpenStax, World Bank, educational institutions | Medium | Accept, flag for spot-check |
| Bronze | AI-generated without source, unverifiable claims | Low | Reject unless manually verified |

### Automated QA Checks

1. **Schema validation** — all required fields present, correct types, variant count ≥ 2
2. **Duplicate detection** — fuzzy match on question text (Levenshtein distance < 0.3)
3. **Distractor quality** — distractors must not be synonyms of correct answer, must be plausible
4. **Answer ambiguity** — flag facts where multiple distractors could be considered correct
5. **Age rating consistency** — content must match declared age rating
6. **Domain coverage** — balanced distribution across difficulty levels (target: 20% per level)

### Human Review Workflow

- All facts enter with `verifiedAt: null`
- Reviewers verify: factual accuracy, answer correctness, distractor plausibility, age appropriateness
- On approval: `verifiedAt` set to current timestamp, `status` changed to `approved`
- On rejection: `status` changed to `archived` with rejection reason
- Only `approved` + `verifiedAt` facts enter production database

---

## 6. Attribution Requirements

For sources requiring attribution, the game must display credits. Implementation:

- **In-app credits screen** (accessible from Settings → About → Content Sources)
- Lists all CC-BY sources with proper attribution text
- JMdict/EDRDG attribution: "This application uses the JMdict/EDICT dictionary file. This file is the property of the Electronic Dictionary Research and Development Group, and is used in conformance with the Group's licence."
- Tatoeba: per-sentence attribution stored in fact metadata, displayed on fact detail view

---

## 7. Content Targets

| Domain | Target Facts | Primary Source | Secondary Sources |
|--------|-------------|----------------|-------------------|
| General Knowledge | 10,000+ | Wikidata SPARQL | Smithsonian |
| Natural Sciences | 10,000+ | Wikidata + PubChem | OpenStax CC-BY |
| Space & Astronomy | 10,000+ | NASA APIs + Wikidata | JPL databases |
| Geography | 10,000+ | Wikidata + World Bank | GeoNames, Natural Earth |
| History | 10,000+ | Wikidata | OpenStax CC-BY, Smithsonian |
| Mythology & Folklore | 10,000+ | Wikidata | Smithsonian |
| Animals & Wildlife | 10,000+ | GBIF + Wikidata | Smithsonian NMNH |
| Human Body & Health | 10,000+ | OpenStax CC-BY + PubChem | USDA, MedlinePlus |
| Food & World Cuisine | 10,000+ | USDA + Wikidata | — |
| Art & Architecture | 10,000+ | Met Museum + AIC APIs | Wikidata, Rijksmuseum |
| Japanese (N5–N1) | 8,000+ | JMdict/EDRDG | Tatoeba |
| Spanish (A1–C2) | 5,000+ | Wikidata lexemes | Tatoeba |
| French (A1–C2) | 5,000+ | Wikidata lexemes | Tatoeba |
| German (A1–C2) | 5,000+ | Wikidata lexemes | Tatoeba |
| Korean (1–6) | 5,000+ | Wikidata lexemes | Tatoeba |
| Mandarin (HSK 1–6) | 5,000+ | Wikidata lexemes | Tatoeba |
| **TOTAL** | **128,000+** | | |

---

## 8. Implementation Phases

### Phase 1: Foundation (Gold-Tier Sources)

Start with the highest-confidence, most accessible sources:

1. **Wikidata SPARQL queries** (General Knowledge, History, Space, Geography, Animals)
   - Immediate availability, no API keys
   - Rich structured data, multilingual
   - Query complexity: low to medium
   - Estimated effort: 2–3 weeks

2. **NASA Open APIs** (Space & Astronomy)
   - Free tier with simple registration
   - Well-documented
   - Estimated effort: 1 week

3. **Museum APIs** (Art & Architecture)
   - Met Museum, AIC: CC0 metadata
   - Rijksmuseum: CC0 metadata
   - Estimated effort: 1–2 weeks

### Phase 2: Educational Content (Silver-Tier Sources)

Integrate verified educational sources:

1. **OpenStax Textbooks** (Biology, Chemistry, Physics, History, Anatomy)
   - License verification per book
   - HTML scraping + text extraction
   - Estimated effort: 2–3 weeks

2. **World Bank Open Data** (Geography, Economics)
   - CSV/API access
   - Requires careful fact generation (statistics → questions)
   - Estimated effort: 1 week

3. **USDA FoodData Central** (Food, Health)
   - Free API access
   - Estimated effort: 1 week

### Phase 3: Specialty Sources (Language Corpora)

1. **JMdict/EDRDG** (Japanese Vocabulary)
   - Download → parse → generate facts
   - Attribution compliance critical
   - Estimated effort: 2 weeks

2. **Wikidata Lexemes** (Multilingual Vocabulary)
   - SPARQL queries for each language
   - Integration with Tatoeba for example sentences
   - Estimated effort: 3 weeks

3. **Tatoeba Corpus** (Example Sentences)
   - CSV download → parse → link to vocabulary
   - Per-author attribution handling
   - Estimated effort: 2 weeks

### Phase 4: Optimization & Human Review

1. **QA automation** (schema validation, duplicate detection, age-rating checks)
   - Estimated effort: 2 weeks

2. **Human review pipeline** (batch processing, feedback loops)
   - Ongoing throughout project

---

## 9. Licensing Compliance Checklist

Use this checklist before any content goes into production:

- [ ] Source has an approved license (CC0, CC-BY, US Gov, JMdict-EDRDG, MIT, Apache)
- [ ] License does NOT include ShareAlike or NonCommercial restrictions
- [ ] Attribution requirement documented in `facts.attribution_sources` (if applicable)
- [ ] `sourceName` and `sourceUrl` correctly identify the origin
- [ ] No copyrighted text is reproduced verbatim in quiz questions (questions are generated, not excerpted)
- [ ] Age rating is appropriate to content
- [ ] Fact has passed schema validation
- [ ] Duplicate detection passed (Levenshtein < 0.3)
- [ ] At least one human reviewer has approved (`verifiedAt` is not null)

---

## 10. Future Expansion Opportunities

### Potential High-Value Sources (Subject to License Verification)

- **Europeana** (European cultural heritage) — check license terms for commercial use
- **Internet Archive Scholar** (academic texts) — CC0 and permissively licensed books
- **OpenDOAR** (open access research repositories) — verify per-repository terms
- **Biodiversity Heritage Library** (natural history) — CC0/CC-BY historical scientific texts
- **Digital Public Library of America** (US cultural heritage) — mostly CC0/CC-BY
- **Project Gutenberg** (public domain literature) — US PD and some CC0
- **British Library Collections Online** — CC0 items only
- **Corpus of Contemporary American English (COCA)** — academic license; verify commercial terms

Each source expansion requires:
1. License review (legal clearance)
2. API/data access documentation
3. Haiku prompt adaptation
4. QA pipeline integration
5. Attribution infrastructure update

---

## 11. Maintenance & Monitoring

### Quarterly Review

1. **License updates** — check if any source licenses have changed
2. **Source status** — APIs down? Data quality degraded?
3. **Distractor effectiveness** — are players consistently guessing incorrectly on certain fact categories?
4. **Attribution compliance** — are in-app credits current and accurate?

### Annual Audit

1. **Content refresh** — retire oldest facts, generate new ones to maintain novelty
2. **Accuracy spot-check** — sample 100 random approved facts, verify correctness
3. **Source diversification** — are we over-reliant on any single source?
4. **Player feedback** — incorporate player-reported errors and complaints

---

## 12. Contact & Escalation

### License Questions
- Consult legal team before using any source marked "Verify" or "Check terms"
- When in doubt, ask EDRDG for clarification on JMdict usage: info@edrdg.org

### API Issues
- Wikidata SPARQL: post on MediaWiki mailing list
- NASA APIs: support@api.nasa.gov
- Museum APIs: check individual museum contact pages

### Attribution Corrections
- If player reports incorrect attribution, prioritize correction in next update
- Maintain error log for quarterly review
