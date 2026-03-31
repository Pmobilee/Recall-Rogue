# Recall Rogue — Content Strategy & Source Registry

> This document is the single source of truth for WHERE content comes from, HOW it is generated, and WHAT licenses apply.
> For game mechanics and fact schema, see `GAME_DESIGN.md`. For pipeline implementation, see `docs/roadmap/phases/AR-17-HAIKU-FACT-ENGINE.md`.
>
> **Raw research source**: See `docs/RESEARCH/SOURCES/deep-research-content-sources-2026-03-09.md` for complete verified analysis of 100+ data sources.

---

## 1. Commercial Licensing Requirements

Recall Rogue is a commercial product. ALL fact content must come from sources with licenses that permit commercial use without copyleft/ShareAlike obligations.

### Approved Licenses

| License | Commercial Use | Attribution | ShareAlike | Status |
|---------|---------------|-------------|------------|--------|
| CC0 (Public Domain) | ✅ Yes | Not required | No | **PREFERRED** |
| CC-BY 4.0 | ✅ Yes | Required | No | Approved |
| CC-BY 3.0 | ✅ Yes | Required | No | Approved |
| CC-BY 2.0 / 2.0 FR | ✅ Yes | Required | No | Approved |
| US Government Works (PD) | ✅ Yes | Not required | No | Approved |
| MIT License | ✅ Yes | Required | No | Approved |
| Apache 2.0 | ✅ Yes | Required | No | Approved |
| Unicode License | ✅ Yes | Required | No | Approved |
| JMdict/EDRDG (CC-BY-SA 4.0) | ✅ Yes | Required + donation encouraged | SA on data only | Approved (verified 2026-03-09) |
| CC-CEDICT (CC-BY-SA 4.0) | ✅ Yes | Required + SA on data | SA on data only | Tier 3 (use with care) |

### Prohibited Licenses

| License | Issue | Action |
|---------|-------|--------|
| CC-BY-SA (any version) | ShareAlike — derivative work ambiguity for quiz questions | **DO NOT USE** |
| CC-BY-NC (any version) | NonCommercial — explicitly bans commercial use | **DO NOT USE** |
| CC-BY-NC-SA | Both NC and SA restrictions | **DO NOT USE** |
| GPL / AGPL | Viral copyleft | **DO NOT USE for data** |
| ODbL 1.0 | Share-alike database license | **DO NOT USE** |
| Unknown / No license | Assume all rights reserved | **DO NOT USE** |

### The Wikipedia Question

Wikipedia text is CC-BY-SA 3.0/4.0. Whether quiz questions generated from Wikipedia articles constitute "derivative works" is legally unsettled. Our position:

- **Wikipedia is a VERIFICATION source, not a content source**
- Facts are generated from CC0/CC-BY structured data (Wikidata, NASA, etc.)
- Accuracy is cross-referenced against Wikipedia, but `sourceName` never points to Wikipedia as the origin
- The `sourceUrl` field points to the actual CC0/CC-BY source (Wikidata item URL, NASA page, etc.)
- This completely sidesteps the ShareAlike question

---

## 2. Excluded Sources (License Violations)

The following popular data sources fail the strict commercial licensing requirement and must NOT be used:

| Source | License | Reason |
|--------|---------|--------|
| Open Trivia Database | CC-BY-SA 4.0 | Share-alike |
| REST Countries API | ODbL-derived | Share-alike |
| mledoze/countries | ODbL 1.0 | Share-alike database license |
| Bowserinator Periodic Table JSON | CC-BY-SA 3.0 | Share-alike (better: use Frictionless CC0 + NIST) |
| HYG Star Database | CC-BY-SA 4.0 | Share-alike (use Wikidata/Hipparcos instead) |
| Open Food Facts | ODbL | Share-alike (use USDA + Wikidata instead) |
| IUCN Red List | Custom (NC for commercial) | Explicitly forbids commercial use |
| Wiktionary extracts / kaikki.org | CC-BY-SA 3.0 | Share-alike |
| FreeDict / WikDict | CC-BY-SA or GPL | Share-alike / Copyleft |
| FlavorDB | CC-BY-NC 4.0 | Non-commercial only |
| UNESCO World Heritage Data | All rights reserved | No open license |
| Theoi.com | Custom copyright | Not openly licensed |

---

## 3. Quality Funnel: Fact Targets (NOT Millions)

Recall Rogue does NOT aim for quantity. The goal is **10,000 interesting, quiz-worthy facts per domain** — carefully curated, well-sourced, with high educational value and fun discovery potential. Here are the per-domain targets:

| Domain | Target Facts | Rationale | Primary Source |
|--------|-------------|-----------|-----------------|
| General Knowledge | ~5K | Cross-domain superlatives, famous firsts, Nobel laureates, world records | Wikidata + Nobel Prize API + CIA World Factbook |
| Geography | ~10K | 200 countries × 15 properties, 500 notable cities, 200+ landmarks | CIA World Factbook + GeoNames + Wikidata |
| History | ~10K | Battles, wars, inventions, historical figures, treaties, key dates | Wikidata + CIA World Factbook country histories |
| Natural Sciences | ~10K | 118 elements + properties, notable compounds, physics constants, biology | Wikidata + PubChem + NIST + OpenStax |
| Space & Astronomy | ~5K | Planets, moons, ~200 missions, 1K exoplanets, named stars, phenomena | NASA APIs + Wikidata (NOT all 6,128 exoplanets) |
| Mythology & Folklore | ~5K | All mythologies combined: ~3K deities, creatures, legends, tales | Wikidata + MANTO + FactGrid |
| Animals & Wildlife | ~10K | Recognizable species, fascinating behaviors, record-holders, conservation | ITIS + Wikidata (NOT 839K taxonomic names) |
| Human Body & Health | ~8K | Major diseases, anatomy, nutrition, psychology, wellness facts | Wikidata + OpenStax + USDA FoodData Central |
| Food & World Cuisine | ~5K | Signature dishes, ingredients, cultural food traditions, nutrition facts | Wikidata + USDA FoodData Central |
| Art & Architecture | ~10K | Famous works, artists, art movements, notable buildings, techniques | Met Museum + Rijksmuseum + Wikidata |
| Japanese (N5–N1) | ~8K | Vocabulary, kanji, grammar examples, cultural context | JMdict + KANJIDIC + Tatoeba |
| Spanish (A1–C2) | ~5K | Vocabulary, phrases, cultural context, CEFR-graded | Leipzig Corpora + Tatoeba + Haiku-generated |
| French (A1–C2) | ~5K | Vocabulary, phrases, cultural context, CEFR-graded | Leipzig Corpora + Tatoeba + Haiku-generated |
| German (A1–C2) | ~5K | Vocabulary, phrases, cultural context, CEFR-graded | Leipzig Corpora + Tatoeba + Haiku-generated |
| Dutch (A1–C2) | ~5K | Vocabulary, phrases, cultural context, CEFR-graded | Leipzig Corpora + Tatoeba + Haiku-generated |
| Czech (A1–C2) | ~5K | Vocabulary, phrases, cultural context, CEFR-graded | Leipzig Corpora + Tatoeba + Haiku-generated |
| Korean (TOPIK 1–6) | ~5K | Vocabulary, phrases, cultural context, proficiency-graded | Tatoeba + Legal review of TOPIK lists + commissioned data |
| Mandarin (HSK 1–6) | ~5K | Vocabulary, characters, pinyin, HSK levels, examples | MIT-licensed complete-hsk-vocabulary + Tatoeba |
| **TOTAL** | **~118K** | Achievable, curated, maintainable | Mix of CC0 and CC-BY sources |

---

## 4. Verified Source Registry by Domain

### General Knowledge

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **Wikidata SPARQL** | CC0 | JSON/CSV | 100M+ items | YES | ★★★★★ Tier 1 |
| **Nobel Prize API** | CC0 | REST→JSON | ~1,000 laureates | YES | ★★★★★ Tier 1 |
| **CIA World Factbook** (factbook.json) | CC0 / PD | JSON/CSV | 266 countries × 200 fields | YES | ★★★★★ Tier 1 |
| **Library of Congress APIs** | US Gov PD | REST→JSON | Millions | YES | ★★★★ Tier 2 |

**Top 3 recommendations**: (1) **Wikidata SPARQL** across all domains — target world records, famous firsts, inventions, Nobel laureates. Unlimited question generation potential. (2) **Nobel Prize API** (api.nobelprize.org/2.1/) — perfectly structured CC0 data for 660+ prizes with laureate names, nationalities, years, and motivations. (3) **CIA World Factbook** (github.com/factbook/factbook.json) — 266 world entities with ~200 data fields each, auto-updated weekly. The original website was retired February 4, 2026, but this GitHub archive preserves the complete dataset.

---

### Geography

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **CIA World Factbook** (factbook.json) | CC0 / PD | JSON, SQL, CSV | 266 entities × 200 fields | YES | ★★★★★ Tier 1 |
| **Wikidata Geography** | CC0 | SPARQL→JSON | 200K+ entities | YES | ★★★★★ Tier 1 |
| **GeoNames** | CC-BY 4.0 | TSV bulk, REST API | 25M+ names | YES | ★★★★★ Tier 2 |
| **Natural Earth** | Public Domain | Shapefiles, GeoJSON | 209 states + features | YES | ★★★★ Tier 2 |
| **World Bank Open Data** | CC-BY 4.0 | CSV, JSON, API | 16K indicators, 200+ economies | YES | ★★★★★ Tier 2 |

**Top 3 recommendations**: (1) **CIA World Factbook** — richest single source for country-level quiz questions: population, GDP, area, languages, religions, government type, natural resources, coastline length, elevation extremes, and 190+ more fields. (2) **GeoNames** — 25 million geographical names with 12 million unique features including populated places, mountains, rivers, and lakes. Requires CC-BY 4.0 attribution. (3) **World Bank Open Data** — 16,000+ time series indicators across 200+ economies at api.worldbank.org (no API key required). Perfect for comparative geography questions.

---

### History

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **Wikidata History** | CC0 | SPARQL→JSON | 10K+ battles, 1K+ wars | YES | ★★★★★ Tier 1 |
| **CIA World Factbook** | CC0 / PD | JSON | 266 country histories | YES | ★★★★ Tier 1 |
| **Nobel Prize API** | CC0 | REST→JSON | 660+ prizes (1901–) | YES | ★★★★★ Tier 1 |
| **Library of Congress** | US Gov PD | REST→JSON | Millions of items | YES | ★★★★ Tier 2 |

**Top 3 recommendations**: (1) **Wikidata SPARQL** — structured historical data for all battles with dates/locations/belligerents, wars with start/end dates, inventions with inventors/dates, treaties with signatories, and historical figures filtered by era. (2) **CIA World Factbook country "Background" sections** — narrative history covering independence dates, colonial history, and major political events. (3) **Nobel Prize API** for 20th/21st century milestones in science, literature, and peace.

---

### Natural Sciences

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **PubChem (NIH)** | US Gov PD | REST→JSON/CSV | **119M+ compounds** | YES | ★★★★★ Tier 1 |
| **Wikidata Chemistry** | CC0 | SPARQL→JSON | 118 elements + 500K compounds | YES | ★★★★★ Tier 1 |
| **Frictionless Periodic Table** | CC0 | CSV + JSON | 118 elements | YES | ★★★★★ Tier 1 |
| **NIST Physical Constants** | US Gov PD | Structured data | 350+ constants | YES | ★★★★★ Tier 2 |
| **NIST Atomic Data** | US Gov PD | Web/structured | All elements | YES | ★★★★ Tier 2 |
| **OpenStax Biology/Chemistry/Physics** | CC-BY 4.0 | HTML | Full textbooks | YES | ★★★★ Tier 2 |
| **USGS Mineral Resources** | US Gov PD | CSV, GIS | 111K+ records | YES | ★★★ Tier 2 |

**Top 3 recommendations**: (1) **PubChem PUG-REST API** (pubchem.ncbi.nlm.nih.gov/rest/pug) — query any named compound for molecular formula, weight, properties, and structure. Example: `/compound/name/aspirin/property/MolecularFormula,MolecularWeight/JSON`. Public domain, no restrictions. (2) **NIST CODATA Fundamental Physical Constants** — 350+ constants (speed of light, Planck's constant, Avogadro's number) with values, uncertainties, and units. US government public domain. (3) **Wikidata periodic table query** — all 118 elements with atomic number, symbol, mass, melting/boiling points, discoverer, and discovery date under CC0.

**Note**: Bowserinator's Periodic-Table-JSON (best dataset) is CC-BY-SA 3.0. Instead, combine the simpler CC0 Frictionless dataset with NIST data to recreate equivalent coverage.

---

### Space & Astronomy

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **NASA Exoplanet Archive** | US Gov PD | CSV, TAP API | **6,128+ exoplanets** | YES | ★★★★★ Tier 1 |
| **JPL Solar System Dynamics** | US Gov PD | REST→JSON | 1.3M+ small bodies | YES | ★★★★★ Tier 1 |
| **Wikidata Space** | CC0 | SPARQL→JSON | 800+ exoplanets, 1K missions | YES | ★★★★★ Tier 1 |
| **NASA Open APIs** | US Gov PD | REST→JSON | Varies (APOD, NeoWs, Rovers) | CONDITIONAL | ★★★★★ Tier 2 |
| **Astronaut Database (Mendeley)** | CC-BY 4.0 | CSV | 564 astronauts | YES | ★★★★ Tier 2 |

**Top 3 recommendations**: (1) **NASA Exoplanet Archive** — 6,128+ confirmed exoplanets with planet name, host star, orbital period, radius, mass, discovery method, year, and facility. Gold-standard data via Table Access Protocol. (2) **JPL Solar System Dynamics** — 1.3 million small bodies plus comprehensive orbital data for all solar system objects. Cache locally rather than querying live. (3) **NASA Open APIs** — APOD (11,000+ daily astronomy images with rich descriptions since 1995), NeoWs (asteroid close-approach data), and Mars Rover photos (800,000+). Free API key at api.nasa.gov. **Must not imply NASA endorsement.**

**Note**: The HYG Star Database (~120K stars) would be ideal but is CC-BY-SA 4.0. Use Wikidata star queries or the raw Hipparcos catalog (ESA) instead.

---

### Mythology & Folklore

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **Wikidata Mythology** | CC0 | SPARQL→JSON | ~3K deities, 5K+ characters | YES | ★★★★★ Tier 1 |
| **MANTO (Mythlab)** | CC-BY 4.0 | Linked Open Data | ~5,400 entities | YES | ★★★★ Tier 2 |
| **FactGrid Roscher Project** | CC0 | SPARQL | 15,000+ entities (growing) | YES | ★★★★ Tier 2 |
| **Dariusk/Corpora** | CC0 | JSON | ~200–500 mythology entries | YES | ★★★ Tier 1 |

**Top 3 recommendations**: (1) **Wikidata mythology queries** — the only source covering ALL world mythologies (Greek, Norse, Japanese, Egyptian, Hindu, Celtic, Mesoamerican) under CC0. Key properties: P8083 (mythology), P361 (part of), family relationships (P22 father, P25 mother, P26 spouse), and P31 (instance of deity/creature). Coverage is uneven — Greek/Roman well-represented, others sparser. (2) **FactGrid's Roscher's Lexikon Project** — 15,000+ mythological entities from the comprehensive 19th-century mythology encyclopedia (public domain source material, 1884–1937). Interlinks with Wikidata. (3) **MANTO** — scholarly Greek mythology with 4,800+ mythological agents, 300 collectives, and 350 objects, linked to ancient source texts and geographic locations. CC-BY 4.0.

**Gap alert**: This domain is structurally thin. Combining all three sources yields roughly 20,000+ entities, but many lack rich property coverage for diverse quiz questions. Supplement with OpenStax World History (CC-BY 4.0) and programmatic enrichment via Claude Haiku.

---

### Animals & Wildlife

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **ITIS** (Integrated Taxonomic Information System) | US Gov PD | DwC-A, REST API | **839,000+ names** | YES | ★★★★★ Tier 1 |
| **Wikidata Taxonomy** | CC0 | SPARQL→JSON | Millions of taxons | YES | ★★★★★ Tier 1 |
| **GBIF** (filtered CC0/CC-BY) | CC0/CC-BY (filter CC-BY-NC) | DwC-A, CSV, API | 2.5B+ occurrences | YES (conditional) | ★★★★ Tier 2 |
| **NHM London Data Portal** | CC0 (data) / CC-BY (media) | DwC-A, CSV, API | ~5M+ specimens | YES | ★★★★ Tier 2 |
| **Smithsonian Open Access** | CC0 | JSON, API | 5.1M+ items | YES | ★★★★ Tier 2 |

**Top 3 recommendations**: (1) **ITIS** (itis.gov) — authoritative US federal taxonomy with 839,000+ scientific names covering all seven kingdoms of life, common names, full taxonomic hierarchy, synonyms, and unique Taxonomic Serial Numbers. Public domain, REST API without registration. (2) **Wikidata taxonomy queries** — millions of taxon items with conservation status (P141), parent taxon (P171), common name (P1843), and habitat (P2974). Use LIMIT constraints. (3) **GBIF** — 2.5 billion+ occurrence records covering 1.6M+ species. **MUST filter for CC0/CC-BY datasets at download time** — approximately 18% carry CC-BY-NC and must be excluded.

**Critical exclusion**: IUCN Red List API explicitly forbids commercial use. Use Wikidata conservation status data instead.

---

### Human Body & Health

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **Wikidata Health** | CC0 | SPARQL→JSON | 7K+ diseases, 5K+ organs | YES | ★★★★★ Tier 1 |
| **USDA FoodData Central** | CC0 | REST API, CSV | 400K+ foods | YES | ★★★★★ Tier 1 |
| **OpenStax Anatomy & Physiology 2e** | CC-BY 4.0 | HTML, PDF, CNXML | 28 chapters | YES | ★★★★ Tier 2 |
| **MeSH** (Medical Subject Headings) | US Gov PD | XML, JSON | 30,000+ descriptors | YES | ★★★★ Tier 2 |
| **MedlinePlus** (NLM portions only) | US Gov PD (partial) | XML, JSON API | 1,000+ health topics | YES (partial) | ★★★★ Tier 2 |

**Top 3 recommendations**: (1) **Wikidata health queries** — 7,000+ diseases with symptoms (P780), treatments (P2176), and medical specialty (P1995), plus 5,000+ anatomical structures. CC0. (2) **USDA FoodData Central** — gold standard for nutrition with 400,000+ food items and up to 117 nutrients per item (calories, macronutrients, vitamins, minerals). CC0, free API at api.nal.usda.gov. (3) **OpenStax Anatomy & Physiology 2e** — peer-reviewed, complete human anatomy across 28 chapters covering every body system. CC-BY 4.0.

**Caution**: MedlinePlus contains mixed-copyright content. Only NLM-authored health topic summaries are public domain. A.D.A.M. Medical Encyclopedia articles and AHFS drug monographs are copyrighted — avoid.

---

### Food & World Cuisine

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **USDA FoodData Central** | CC0 | REST API, CSV | 400K+ foods | YES | ★★★★★ Tier 1 |
| **Wikidata Food** | CC0 | SPARQL→JSON | 10–30K food entities | YES | ★★★★★ Tier 1 |
| **FAOSTAT** | CC-BY 4.0 + restrictions | CSV | Millions of data points | CONDITIONAL | ★★★ Tier 3 |

**Top 3 recommendations**: (1) **Wikidata food queries** — 10,000–30,000+ food/cuisine items with country of origin (P495), ingredients (P527), cuisine type (P2012), and images. WikiProject Food actively curates this data. Best for cultural food trivia. CC0. (2) **USDA FoodData Central** — unmatched for nutrition questions with authoritative nutrient composition data. Perfect for comparison questions. (3) **FAOSTAT** for food production statistics — though its prohibition on use "in conjunction with the promotion of a commercial enterprise" creates ambiguity. **Legal review recommended**.

**Gap alert**: This domain is structurally thin. Open Food Facts (3M+ products) would be ideal but uses ODbL (share-alike). FlavorDB is CC-BY-NC. Strategy: lean heavily on Wikidata for cultural/culinary facts and USDA for nutritional data.

---

### Art & Architecture

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **Met Museum Open Access** | CC0 | CSV (GitHub), REST API | **470,000+ artworks** | YES | ★★★★★ Tier 1 |
| **Rijksmuseum** | CC0 | JSON, LOD APIs | **800,000+ objects** | YES | ★★★★★ Tier 1 |
| **Art Institute of Chicago** | CC0 / CC-BY 4.0 | REST API, JSONL bulk | 131,000+ artworks | YES | ★★★★★ Tier 1 |
| **Cleveland Museum of Art** | CC0 | REST API, CSV (GitHub) | 61,500+ works | YES | ★★★★★ Tier 1 |
| **Smithsonian Open Access** | CC0 | JSON, API | 5.1M+ items | YES | ★★★★ Tier 1 |
| **Getty Vocabularies** (AAT, ULAN, TGN) | ODC-By 1.0 | LOD, XML, SPARQL | **460K+ combined** | YES | ★★★★ Tier 2 |
| **Wikidata Art** | CC0 | SPARQL→JSON | 100K+ paintings, 200K+ artists | YES | ★★★★★ Tier 1 |

**Top 3 recommendations**: (1) **Metropolitan Museum of Art** — 470,000+ artworks spanning 5,000 years with rich metadata (title, artist, date, medium, culture, period, classification, geography). CC0, available via both GitHub CSV and REST API. Premier source for art quiz content. (2) **Getty Vocabularies** — 77,000 art/architecture concepts (AAT), 380,000+ artist records (ULAN), and 2.4 million place names (TGN). Professionally curated, authoritative definitions. ODC-By 1.0 (attribution only). (3) **Rijksmuseum** — 800,000+ objects with CC0 data and images, strongest for Dutch Golden Age and European art.

**This is the richest domain** — the four CC0 museum APIs alone provide 1.46 million artwork records, far exceeding the 10,000-fact target.

---

## 5. Language Vocabulary Sources

### Japanese (JLPT N5–N1)

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **JMdict** (via jmdict-simplified) | CC-BY-SA 4.0 | JSON | **214,000+ entries** | YES (verified) | ★★★★★ Tier 3 |
| **KANJIDIC2** | CC-BY-SA 4.0 | JSON | ~13,000 kanji | YES (verified) | ★★★★ Tier 3 |
| **Waller JLPT Lists** | CC-BY | Various | ~8,000 words | YES | ★★★★ Tier 2 |
| **yomitan-jlpt-vocab** | CC-BY | GitHub | ~8,000 words | YES | ★★★★ Tier 2 |
| **Tatoeba JA-EN** | CC-BY 2.0 FR | TSV | ~250,000 pairs | YES | ★★★★★ Tier 2 |
| **scriptin/kanji-frequency** | CC-BY 4.0 | JSON | Multi-corpus | YES | ★★★★ Tier 2 |

**Recommended pipeline**: Download jmdict-simplified JSON (github.com/scriptin/jmdict-simplified, auto-updated weekly) as the base dictionary. **JMdict/EDRDG license (CC-BY-SA 4.0) is verified commercially safe** — the EDRDG website explicitly states: *"There is NO restriction placed on commercial use of the files. The files can be bundled with software and sold for whatever the developer wants to charge."* Merge JLPT N5–N1 level tags using stephenmk/yomitan-jlpt-vocab, which maps the Waller CC-BY lists to JMdict entry IDs. Use JMdict's built-in priority fields (`ke_pri`/`re_pri` with `news1/2`, `ichi1/2`, `nfxx` frequency bands) for frequency ranking. Add kanji data from KANJIDIC2 and example sentences from JMdict_e_examp.xml.

**Key limitation**: JMdict does NOT contain JLPT level tags natively — merge from Waller lists. No official JLPT lists exist; all available are community-compiled. The BCCWJ frequency list (gold-standard corpus) is restricted to "research or educational purposes" and cannot be used commercially.

**Attribution requirement**: Create an About/Sources screen listing EDRDG JMdict/KANJIDIC (CC-BY-SA 4.0 with link), Tatoeba (CC-BY 2.0 FR), and Jonathan Waller JLPT lists (CC-BY).

---

### Spanish, French, German, Dutch, and Czech Vocabulary

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **Leipzig Corpora** | CC-BY 4.0 | Text | 10K–1M words/lang | YES | ★★★★★ Tier 2 |
| **Tatoeba** (per language) | CC-BY 2.0 FR | TSV | 30K–80K EN pairs | YES | ★★★★★ Tier 2 |
| **Leeds Corpus Freq Lists** | CC-BY 2.5 | Text | ~10K–50K words | YES | ★★★★ Tier 2 |
| **Panlex Swadesh Lists** | CC0 | Text | 110–207 words | YES | ★★ Tier 1 |

**CRITICAL GAP**: This is the most significant licensing gap in the dataset strategy. The strict exclusion of CC-BY-SA eliminates virtually all pre-built bilingual dictionaries for European languages — including Wiktionary extracts (kaikki.org), FreeDict, WikDict, hermitdave/FrequencyWords, and Lexique.org (French). CEFRLex (FLELex for French, ELELex for Spanish) provides CEFR-graded frequency data but has no explicit commercial license.

**Recommended workaround strategy**:

1. **Use Leipzig Corpora Collection** (CC-BY 4.0, 270+ languages) for monolingual frequency-ranked word lists.
2. **Use Tatoeba** for bilingual example sentences (~74K Spanish-EN, ~58K French-EN, ~80K German-EN, ~30-50K Dutch-EN, ~30-50K Czech-EN pairs).
3. **Generate English translations and CEFR level assignments via Claude Haiku API** — feed the top 10,000 frequency-ranked words from Leipzig into Haiku with prompts like:
   ```
   Provide the English translation, part of speech, and estimated CEFR level (A1–C2)
   for this [language] word: [word]. Return as JSON.
   ```
   This creates original CC0 data you own outright.
4. **Approximate CEFR levels** from frequency rank:
   - A1 ≈ top 500 words
   - A2 ≈ 1,000 words
   - B1 ≈ 2,000 words
   - B2 ≈ 3,500 words
   - C1 ≈ 5,000 words
   - C2 ≈ 8,000+ words

5. **Contact UCLouvain's CENTAL team** (cental@uclouvain.be) about commercial licensing for CEFRLex data.

**Per-language notes**: No open data from RAE (Spanish), Institut Cervantes, Goethe-Institut, or DELF/DALF institutions. Goethe-Zertifikat word lists are copyrighted exam materials. Frantext requires subscription. DWDS (German) is copyrighted.

---

### Mandarin Chinese (HSK 1–6)

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **complete-hsk-vocabulary** | MIT | JSON | **~11,000+ words** | YES | ★★★★★ Tier 1 |
| **ivankra/hsk30** | MIT | CSV | ~11,000+ (HSK 3.0) | YES | ★★★★★ Tier 1 |
| **Unicode Unihan Database** | Unicode License | TSV | 98,000+ characters | YES | ★★★★ Tier 2 |
| **Tatoeba CMN-EN** | CC-BY 2.0 FR | TSV | ~29K–59K pairs | YES | ★★★★ Tier 2 |

**Chinese is well-served under strict licensing**. The **complete-hsk-vocabulary** GitHub repo (MIT license, 117 stars) provides everything needed: both HSK 2.0 (levels 1–6, 5,000 words) and HSK 3.0 (levels 1–9, ~11,000 words) with simplified Chinese, traditional Chinese, pinyin, English definitions, part of speech, HSK level, and frequency rank in clean JSON. Supplement with the Unicode Unihan Database for character-level enrichment (98,000+ CJK ideographs with readings, definitions, radical/stroke data).

**HSK transition note**: HSK 2.0 exams remain valid until July 2026 when HSK 3.0 officially launches. The November 2025 revision significantly reduced vocabulary for levels 1–5. Both versions are covered in the recommended repo.

**Note**: CC-CEDICT (123,500 entries) would be ideal but is CC-BY-SA 4.0. The complete-hsk-vocabulary repo may derive some definitions from CC-CEDICT — verify whether this creates a derivative work concern before relying on it.

---

### Korean (TOPIK 1–6)

| Source | License | Format | Records | Commercial | Ingestion Tier |
|--------|---------|--------|---------|------------|-----------------|
| **Tatoeba KOR-EN** | CC-BY 2.0 FR | TSV | **6,394 pairs** | YES | ★★★★★ Tier 2 |
| **Official TOPIK Lists** | Unclear (gov't) | Excel/PDF | ~5,750 words | UNCERTAIN | ❓ Tier 3 (needs legal review) |
| **Unicode Unihan** | Unicode License | TSV | CJK chars | YES | ★★★★ Tier 2 |

**Korean presents the MOST CRITICAL DATA GAP**. Almost all structured Korean-English dictionary data uses incompatible licenses: KRDict/NIKL (CC-BY-SA 2.0 KR), KENGDIC (MPL/LGPL), NIKL frequency lists (CC-BY-SA). Korean government publications are NOT automatically public domain (unlike US federal works), so the official TOPIK vocabulary lists (~5,750 words labeled "공개"/public) have uncertain redistribution terms.

**Recommended approach**:

1. **Seek legal counsel** on using official TOPIK vocabulary lists — they're published by a government educational agency and labeled "public," but explicit open licensing is absent.
2. **Use Tatoeba's 6,394 Korean-English sentence pairs** (CC-BY 2.0 FR) as a starting point.
3. **Commission original Korean vocabulary data creation** — hire Korean linguists to create a MIT/CC0 word list covering TOPIK levels 1–6 with Korean, romanization, English meaning, POS, and level. This appears to be a genuine gap in the open data ecosystem.
4. **Use Claude Haiku API** to generate romanization, difficulty levels, and example sentences for Korean words extracted from Tatoeba sentences.

---

## 6. Ingestion Priority (3 Tiers)

Based on verified research, implement sources in this priority order:

### Tier 1 — Immediate, High-Volume, Zero-Friction

**CC0, JSON APIs, no attribution required**

- Wikidata SPARQL across all domains
- USDA FoodData Central
- Met Museum API
- Rijksmuseum API
- Cleveland Museum of Art API
- Smithsonian Open Access
- Nobel Prize API
- CIA World Factbook JSON
- NASA Exoplanet Archive
- JPL Solar System Dynamics
- PubChem
- NIST Constants & Atomic Data
- ITIS
- Frictionless Periodic Table
- complete-hsk-vocabulary (Mandarin)

**Estimated effort**: 4–6 weeks to implement all Tier 1 sources. These sources are:
- Immediately accessible (no legal review needed)
- High-volume (100K+ facts extractable)
- Well-documented APIs or downloadable data
- No attribution complexity

---

### Tier 2 — High-Volume, Requires Attribution

**CC-BY or US Government sources with attribution/conditional use**

- NASA Open APIs (with NASA non-endorsement disclaimer)
- World Bank Open Data
- GeoNames
- Art Institute of Chicago
- OpenStax Textbooks (verify per book)
- Getty Vocabularies
- Tatoeba (all languages)
- GBIF (filtered for CC0/CC-BY)
- NHM London Data Portal
- MeSH (Medical Subject Headings)
- MedlinePlus (NLM portions only)
- MANTO (Mythlab)
- FactGrid Roscher Project
- Astronaut Database (Mendeley)
- Waller JLPT Lists
- yomitan-jlpt-vocab
- Leipzig Corpora
- Leeds Corpus Frequency Lists
- Unicode Unihan Database

**Estimated effort**: 4–8 weeks. These sources require:
- Attribution infrastructure (About/Sources screen, metadata fields)
- API key registration or bulk data downloads
- Some data scraping or CSV parsing
- License verification (per book for OpenStax)

---

### Tier 3 — Specialized, Requires SA Compliance

**CC-BY-SA sources (commercially permitted with care)**

- JMdict/EDRDG (Japanese) — verified commercially safe with attribution
- KANJIDIC2 (Kanji)
- DBpedia (supplementary structured data)
- CC-CEDICT (Chinese) — use only if complete-hsk-vocabulary proves insufficient

**Estimated effort**: 2–3 weeks. These sources are:
- Well-understood SA terms
- Commercially viable (not NC)
- Well-integrated workflows already exist
- Require attribution infrastructure

**SA Compliance Note**: The ShareAlike obligation applies ONLY if you redistribute the raw data in structured form. Generating quiz questions from SA sources does NOT trigger redistribution. However, in-app credits must acknowledge these sources and link to their license terms.

---

## 7. Haiku Generation Pipeline

### Overview

Raw structured data from approved sources is transformed into game-ready Fact schema JSON using Claude Haiku API.

```
Source Data (CC0/CC-BY/CC-BY-SA Tier 3)
    ↓
API fetch scripts / bulk data downloads
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
| 10 knowledge domains × ~7.5K average | ~$84.38 |
| 6 languages × ~6K average vocabulary | ~$40.50 |
| **Total estimated generation cost** | **~$125** |
| Verification/re-generation overhead (20%) | ~$25 |
| Leipzig Corpora Haiku translation (EUR/French/GER) | ~$20 |
| **Grand total** | **~$170** |

Note: These are conservative estimates. Actual costs depend on prompt complexity, retry rates, and distractor rejection rates. The European language translation budget (+$20) reflects Haiku-based translation generation from Leipzig Corpora frequency lists.

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

## 8. Attribution Requirements

For sources requiring attribution, the game must display credits. Implementation:

### In-App Attribution Screen

Accessible from Settings → About → Content Sources. Lists all CC-BY and CC-BY-SA sources with proper attribution text.

### Per-Source Attribution

| Source | Attribution Format | Display Location |
|--------|-------------------|------------------|
| **JMdict/EDRDG** | "This application uses the JMdict/EDICT dictionary file. This file is the property of the Electronic Dictionary Research and Development Group, and is used in conformance with the Group's licence." + Link to EDRDG website | About → Sources |
| **KANJIDIC2** | Attribution to EDRDG + link | About → Sources |
| **Tatoeba (all languages)** | Per-sentence author attribution (stored in fact metadata) | Fact detail view (when applicable) |
| **GeoNames** | "GeoNames data provided under CC-BY 4.0 license" + link | About → Sources |
| **World Bank Open Data** | "World Bank Open Data provided under CC-BY 4.0 license" + link | About → Sources |
| **NASA Open APIs** | Include "NASA" in credits; include non-endorsement disclaimer in About → Sources | About → Sources + Fact view |
| **OpenStax Textbooks** | "Provided by OpenStax College under CC-BY 4.0 license" + link per book | About → Sources |
| **Getty Vocabularies** | "Getty Vocabularies provided under ODC-By 1.0 license" + link | About → Sources |
| **ITIS** | "Integrated Taxonomic Information System provided by USGS" | About → Sources |
| **Art Institute of Chicago** | "Art Institute of Chicago provided under CC-BY/CC0 license" + link | About → Sources |
| **Rijksmuseum** | "Rijksmuseum data provided under CC0 license" | About → Sources |
| **Met Museum** | "Metropolitan Museum of Art provided under CC0 license" | About → Sources |
| **All Wikidata sources** | "Wikidata provided under CC0 license" | About → Sources |

### NASA Non-Endorsement Disclaimer

When using NASA data, include this statement in About → Sources:

> "This application uses data from NASA. The use of NASA data does not imply endorsement by NASA."

---

## 9. Quality Assurance

### Source Quality Tiers

| Tier | Source Type | Trust Level | QA Action |
|------|-----------|-------------|-----------|
| Gold | Wikidata, NASA, NIH, USDA, NIST, US Gov, museum APIs, Nobel Prize | High | Accept if schema valid |
| Silver | OpenStax, World Bank, educational institutions, ITIS, Getty | Medium | Accept, flag for spot-check |
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

## 10. Licensing Compliance Checklist

Use this checklist before any content goes into production:

- [ ] Source has an approved license (CC0, CC-BY, US Gov, JMdict-EDRDG, MIT, Apache, Unicode)
- [ ] License does NOT include NonCommercial restrictions
- [ ] License does NOT include ShareAlike restrictions (OR it's a Tier 3 source and SA is documented)
- [ ] Attribution requirement documented in `facts.attribution_sources` (if applicable)
- [ ] `sourceName` and `sourceUrl` correctly identify the origin
- [ ] No copyrighted text is reproduced verbatim in quiz questions (questions are generated, not excerpted)
- [ ] Age rating is appropriate to content
- [ ] Fact has passed schema validation
- [ ] Duplicate detection passed (Levenshtein < 0.3)
- [ ] At least one human reviewer has approved (`verifiedAt` is not null)
- [ ] Attribution display is current (About → Sources screen reviewed)

---

## 11. Critical Gaps & Mitigations

### European Language Vocabulary (Spanish, French, German)

**Gap**: No clean bilingual dictionaries exist under CC-BY without ShareAlike.

**Mitigation**:
- Leipzig Corpora (CC-BY 4.0) frequency lists + Tatoeba (CC-BY 2.0 FR) sentences
- Claude Haiku-generated English translations and CEFR level assignments
- Create CC0 derivative data owned by you

### Korean Vocabulary

**Gap**: TOPIK official lists lack explicit open licensing. All other Korean-English sources use CC-BY-SA or incompatible licenses.

**Mitigation**:
- Tatoeba Korean-English pairs (CC-BY 2.0 FR) for seed data
- Commission original Korean vocabulary data (MIT/CC0 licensed)
- Use Haiku API to enrich with romanization, proficiency levels, and examples
- Seek legal counsel on official TOPIK redistribution

### Mythology & Folklore

**Gap**: Structurally thinner than other domains. Requires enrichment.

**Mitigation**:
- Combine Wikidata, MANTO, and FactGrid (yields ~20K entities)
- Supplement with OpenStax World History (CC-BY 4.0) programmatic enrichment
- Use Haiku to generate quiz variants and educational context

### Food & Cuisine

**Gap**: Limited commercially safe sources for cultural food data.

**Mitigation**:
- Wikidata for cultural and culinary facts
- USDA for nutritional data
- Programmatic quiz generation from these two sources

---

## 12. Future Expansion Opportunities

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

## 13. Maintenance & Monitoring

### Quarterly Review

1. **License updates** — check if any source licenses have changed
2. **Source status** — APIs down? Data quality degraded?
3. **Distractor effectiveness** — are players consistently guessing incorrectly on certain categories?
4. **Attribution compliance** — are in-app credits current and accurate?

### Annual Audit

1. **Content refresh** — retire oldest facts, generate new ones for novelty
2. **Accuracy spot-check** — sample 100 random approved facts, verify correctness
3. **Source diversification** — are we over-reliant on any single source?
4. **Player feedback** — incorporate player-reported errors and complaints

---

## 14. Contact & Escalation

### License Questions

- Consult legal team before using any source marked "UNCERTAIN" or "Verify"
- For JMdict/EDRDG: info@edrdg.org (clarification available)
- For Korean TOPIK: contact National Institute of Korean Language (NIKL) for licensing terms

### API Issues

- Wikidata SPARQL: post on MediaWiki mailing list
- NASA APIs: support@api.nasa.gov
- Museum APIs: check individual museum contact pages
- World Bank: datahelp@worldbank.org

### Attribution Corrections

- If player reports incorrect attribution, prioritize correction in next update
- Maintain error log for quarterly review
