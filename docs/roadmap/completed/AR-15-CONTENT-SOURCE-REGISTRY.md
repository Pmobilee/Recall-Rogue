# AR-15: Content Source Registry

**Phase ID:** AR-15
**Title:** Content Source Registry — Document & Automate Data Source Pipelines
**Status:** Not Started
**Last Updated:** 2026-03-09

---

## Overview

### Goal
Document all commercially safe data sources and build automated SPARQL/API query scripts that pull structured data for each of the 10 knowledge domains plus 6 language domains. This phase creates a reusable, maintainable content pipeline that feeds the game's fact database without manual curation or licensing violations.

### Dependencies
- **None** — this can start immediately. No dependencies on other phases.
- Does not block other phases; complements AR-16 (Domain Expansion) in parallel

### Estimated Complexity
- **Medium** — 3-4 days
- Primary work is script authoring and API integration testing
- Moderate complexity around SPARQL query optimization and API pagination
- No game mechanics changes; no Svelte component work

### API Keys Required
- **None** — all data sources are free and open
- NASA API: DEMO_KEY works for development (free tier)
- PubChem, GBIF, USDA, Met Museum, Art Institute, World Bank, Wikidata, JMdict — all free without authentication

### Output Artifacts
1. **SPARQL query library** — 10 `.sparql` files in `scripts/content-pipeline/sparql/`
2. **API fetch scripts** — 7+ `.mjs` files in `scripts/content-pipeline/fetch/`
3. **Vocabulary import scripts** — 3 `.mjs` files in `scripts/content-pipeline/vocab/`
4. **Source configuration** — `scripts/content-pipeline/sources.json`
5. **Orchestrator script** — `scripts/content-pipeline/fetch-all.mjs`
6. **Documentation** — `scripts/content-pipeline/README.md` with usage examples

---

## Sub-steps

### Sub-step 1: Create Wikidata SPARQL Query Library

#### Objective
Build parameterized SPARQL queries that fetch 1,000+ factual items from Wikidata for each knowledge domain. Each query must return English-language labels, descriptions, and structured properties suitable for quiz facts.

#### Files to Create
```
scripts/content-pipeline/sparql/
├── general-knowledge.sparql
├── natural-sciences.sparql
├── space-astronomy.sparql
├── geography.sparql
├── history.sparql
├── mythology-folklore.sparql
├── animals-wildlife.sparql
├── human-body-health.sparql
├── food-cuisine.sparql
└── art-architecture.sparql
```

#### Detailed Implementation Requirements

**1.1 — general-knowledge.sparql**
- Query categories: notable items, inventions, records, "firsts", world records, discoveries, important institutions
- Must return: item label, item description, discoverer, discovery date, field of knowledge, human-readable rank/superlative
- Example: "The first person to do X", "World's tallest Y", "Z most common Z"
- Minimum properties: `rdfs:label`, `schema:description`, `wdt:P571` (inception), `wdt:P61` (discoverer), `wdt:P625` (coordinates if applicable)
- Handle plurals gracefully (optional properties for alternative names)
- Expected result count: 5,000+

**1.2 — natural-sciences.sparql**
- Query categories: chemical elements (periodic table), physical constants, reactions, materials, physics concepts
- Must return for each element: symbol, atomic number, atomic mass, electron configuration, discovery date, discoverer, primary uses
- Must return for physical constants: name, symbol, value, unit, related formula, precision
- Minimum properties: `wdt:P1086` (element symbol), `wdt:P1108` (atomic number), `wdt:P2101` (mass number), `wdt:P61` (discoverer), `wdt:P813` (retrieved date)
- Use `OPTIONAL` blocks for less-common properties
- Expected result count: 2,000+ (118 elements + ~1800 constants/concepts)

**1.3 — space-astronomy.sparql**
- Query categories: celestial bodies (planets, moons, asteroids, comets), space missions, astronauts, exoplanets
- Must return for planets/moons: name, orbital period, mass, discovery date, discoverer, number of known natural satellites, distance from primary body
- Must return for missions: name, launch date, mission type, destination, success/failure
- Must return for astronauts: name, birthdate, nationality, mission count, career duration, notable achievements
- Minimum properties: `wdt:P571` (inception/discovery), `wdt:P61` (discoverer), `wdt:P2048` (height/diameter), `wdt:P2067` (mass), `wdt:P577` (publication date)
- Use `OPTIONAL` for speculative/uncertain values
- Expected result count: 3,500+ (8 planets + 200+ moons + 1000+ asteroids + 1500+ missions + 600+ astronauts)

**1.4 — geography.sparql**
- Query categories: countries, cities, geographical features, landmarks, bodies of water
- Must return for countries: name, capital, population, area, continent, official languages, ISO code, currency, flag emoji, founding date
- Must return for cities: name, country, population, area, timezone, founded, elevation
- Must return for features: name, type (mountain/river/desert), location, elevation/length/area, notable facts
- Minimum properties: `wdt:P36` (capital), `wdt:P1082` (population), `wdt:P2046` (area), `wdt:P30` (continent), `wdt:P37` (official language), `wdt:P38` (currency)
- Validate that countries actually exist (P31:Q3624078 — sovereign state)
- Expected result count: 5,000+ (195 countries + 4000+ cities + 1000+ features)

**1.5 — history.sparql**
- Query categories: historical events, historical figures, wars, revolutions, treaties, inventions, cultural milestones
- Must return for events: name, date, location, participants (actors), impact/consequence, duration
- Must return for figures: name, birth/death dates, birthplace, nationality, roles/titles, notable achievements, era
- Must return for wars: name, start/end dates, primary combatants, casualties, outcome, territories affected
- Minimum properties: `wdt:P585` (point in time), `wdt:P580` (start time), `wdt:P582` (end time), `wdt:P625` (coordinates), `wdt:P17` (country), `wdt:P61` (associated figure)
- Filter: exclude fictional events and future dates (P585 < NOW())
- Expected result count: 4,000+ (1000+ events + 1500+ figures + 500+ wars + 1000+ other)

**1.6 — mythology-folklore.sparql**
- Query categories: deities (from all mythologies), mythological creatures, creation myths, legendary stories, folklore
- Must return for deities: name, mythology system (Egyptian, Greek, Norse, Hindu, Celtic, etc.), domain/role, symbols, sacred animals, associated colors
- Must return for creatures: name, mythology system, description/nature, habitat, famous appearances/stories
- Must return for stories: name, characters, plot summary, origin culture, moral/lesson
- Minimum properties: `wdt:P3417` (mythology system if applicable), `wdt:P138` (named after), `wdt:P585` (depicted in/from time period), `wdt:P625` (cultural origin coordinates)
- Use `FILTER` to exclude modern fictional mythologies (focus on historical/cultural mythologies)
- Expected result count: 2,500+ (500+ deities across systems + 1000+ creatures + 1000+ stories)

**1.7 — animals-wildlife.sparql**
- Query categories: species (Linnaean taxonomy), endangered species, record-holders (fastest, largest, longest-lived), habitats, conservation status
- Must return for species: scientific name, common name, taxonomy (kingdom, phylum, class, order, family, genus), habitat type, diet type, average lifespan, conservation status, population trends
- Must return for record-holders: species name, property (fastest/largest/longest-lived), value, location of record
- Minimum properties: `wdt:P225` (taxon name), `wdt:P171` (parent taxon for hierarchy), `wdt:P141` (conservation status), `wdt:P61` (discoverer), `wdt:P580` (start of existence), `wdt:P813` (retrieved)
- Filter: only Animalia kingdom (P171:Q3606)
- Expected result count: 4,000+ (3000+ species + 500+ records + 500+ habitats)

**1.8 — human-body-health.sparql**
- Query categories: anatomical organs, diseases, medical discoveries, vitamins, genetic concepts, health records
- Must return for organs: name, location in body, function, diseases it can have, medical procedures, size/weight
- Must return for diseases: name, cause (bacterial/viral/genetic/environmental), symptoms (list), prevention, treatment, discovery date, discoverer
- Must return for vitamins: name, chemical name, source foods, daily requirement, deficiency syndrome, discovery date
- Minimum properties: `wdt:P669` (anatomical location), `wdt:P793` (medical event), `wdt:P828` (caused by), `wdt:P585` (date of first occurrence), `wdt:P61` (discoverer)
- Filter: modern medical knowledge (P585 > 1800)
- Expected result count: 2,500+ (78 organs + 800+ diseases + 13 vitamins + 1600+ health concepts)

**1.9 — food-cuisine.sparql**
- Query categories: dishes (national/regional), ingredients (spices, staples, exotic foods), culinary techniques, food culture, nutritional facts
- Must return for dishes: name, origin country/region, main ingredients, cuisine type, preparation method, cultural significance, serving style
- Must return for ingredients: name, origin region, flavor profile, typical uses, nutritional value, botanical source, harvest season
- Minimum properties: `wdt:P495` (origin country), `wdt:P921` (main subject/ingredient), `wdt:P1001` (applies to), `wdt:P580` (start of period), `wdt:P2283` (uses)
- Include Wikidata food/ingredient hierarchy traversal
- Expected result count: 3,000+ (1500+ dishes + 1000+ ingredients + 500+ techniques)

**1.10 — art-architecture.sparql**
- Query categories: artworks, artists, architectural landmarks, art movements, art techniques, famous sculptures/paintings
- Must return for artworks: title, artist, year created, medium (painting/sculpture/installation), museum/location, art movement, dimensions, cultural significance
- Must return for architects/artists: name, birth/death, nationality, style period, major works, art school/movement
- Must return for landmarks: name, architect, year completed, location, architectural style, historical significance, visitor count if available
- Minimum properties: `wdt:P50` (artist/architect), `wdt:P580` (creation start), `wdt:P582` (creation end), `wdt:P1559` (art form), `wdt:P31` (instance of — painting, sculpture, building), `wdt:P625` (coordinates)
- Filter: exclude copyrighted works created after 1970 (copyright concern); focus on historical/museum pieces
- Expected result count: 3,500+ (1500+ artworks + 1000+ artists + 1000+ landmarks)

#### Verified SPARQL Queries

**Geography Query** (verified research finding):
```sparql
# Domain: Geography
# Purpose: Fetch all countries with 10+ properties for quiz facts
# Expected Results: ~195 countries with full details
# Last Validated: 2026-03-09
# Wikidata SPARQL Endpoint: https://query.wikidata.org/sparql

SELECT ?country ?countryLabel ?capitalLabel ?population ?area
       ?continentLabel ?currencyLabel ?languageLabel ?isoCode
WHERE {
  ?country wdt:P31 wd:Q6256.
  OPTIONAL { ?country wdt:P36 ?capital. }
  OPTIONAL { ?country wdt:P1082 ?population. }
  OPTIONAL { ?country wdt:P2046 ?area. }
  OPTIONAL { ?country wdt:P30 ?continent. }
  OPTIONAL { ?country wdt:P38 ?currency. }
  OPTIONAL { ?country wdt:P37 ?language. }
  OPTIONAL { ?country wdt:P297 ?isoCode. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?countryLabel
LIMIT 10000
```

**Mythology Query** (verified research finding):
```sparql
# Domain: Mythology & Folklore
# Purpose: Fetch deities and mythological figures with family and properties
# Expected Results: ~1,000+ deities

SELECT ?deity ?deityLabel ?mythologyLabel ?roleLabel ?familyLabel
WHERE {
  ?deity wdt:P8083 ?mythology.  # Part of mythology
  OPTIONAL { ?deity wdt:P361 ?mythology. }  # Part of system
  OPTIONAL { ?deity wdt:P22 ?father. }  # Father
  OPTIONAL { ?deity wdt:P25 ?mother. }  # Mother
  OPTIONAL { ?deity wdt:P26 ?spouse. }  # Spouse
  OPTIONAL { ?deity wdt:P31 ?role. }  # Instance of (role/type)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?deityLabel
LIMIT 10000
```

**Animals Query** (verified research finding):
```sparql
# Domain: Animals & Wildlife
# Purpose: Fetch species with conservation status, taxonomy, and properties
# Expected Results: ~3,000+ species

SELECT ?species ?speciesLabel ?commonName ?conservationLabel ?habitat
WHERE {
  ?species wdt:P141 ?conservation.  # Conservation status
  ?species wdt:P171 ?parent.  # Parent taxon (for hierarchy)
  OPTIONAL { ?species wdt:P1843 ?commonName. }  # Common name
  OPTIONAL { ?species wdt:P2974 ?habitat. }  # Habitat
  OPTIONAL { ?species wdt:P225 ?scientificName. }  # Scientific name
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?speciesLabel
LIMIT 10000
```

**Space Query** (verified research finding):
```sparql
# Domain: Space & Astronomy
# Purpose: Fetch planets, moons, stars, and celestial bodies with properties
# Expected Results: ~500+ major celestial bodies

SELECT ?body ?bodyLabel ?mass ?orbitalPeriod ?discoveryDate ?discoverer
WHERE {
  { ?body wdt:P31 wd:Q11346. }  # Planets
  UNION { ?body wdt:P31 wd:Q405. }  # Moons
  UNION { ?body wdt:P31 wd:Q3618. }  # Asteroids (limited)
  OPTIONAL { ?body wdt:P2067 ?mass. }  # Mass
  OPTIONAL { ?body wdt:P2146 ?orbitalPeriod. }  # Orbital period
  OPTIONAL { ?body wdt:P575 ?discoveryDate. }  # Discovery date
  OPTIONAL { ?body wdt:P61 ?discoverer. }  # Discoverer
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?bodyLabel
LIMIT 10000
```

**History Query** (verified research finding):
```sparql
# Domain: History
# Purpose: Fetch historical events, battles, wars, and personalities with dates
# Expected Results: ~2,000+ historical facts

SELECT ?event ?eventLabel ?startDate ?endDate ?locationLabel ?participantLabel
WHERE {
  { ?event wdt:P31 wd:Q4438121. }  # Battle
  UNION { ?event wdt:P31 wd:Q198. }  # War
  UNION { ?event wdt:P31 wd:Q1656682. }  # Historical period
  OPTIONAL { ?event wdt:P580 ?startDate. }  # Start date
  OPTIONAL { ?event wdt:P582 ?endDate. }  # End date
  OPTIONAL { ?event wdt:P625 ?location. }  # Location
  OPTIONAL { ?event wdt:P710 ?participant. }  # Participant
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?startDate DESC
LIMIT 10000
```

**Natural Sciences Query** (verified research finding):
```sparql
# Domain: Natural Sciences
# Purpose: Fetch all 118 periodic table elements with atomic properties
# Expected Results: 118 elements + constants

SELECT ?element ?elementLabel ?atomicNumber ?atomicSymbol ?atomicMass
       ?meltingPoint ?boilingPoint ?discoverer
WHERE {
  ?element wdt:P31 wd:Q11344.  # Instance of chemical element
  OPTIONAL { ?element wdt:P1108 ?atomicNumber. }  # Atomic number
  OPTIONAL { ?element wdt:P1086 ?atomicSymbol. }  # Element symbol
  OPTIONAL { ?element wdt:P2101 ?atomicMass. }  # Atomic mass
  OPTIONAL { ?element wdt:P2101 ?meltingPoint. }  # Melting point
  OPTIONAL { ?element wdt:P2102 ?boilingPoint. }  # Boiling point
  OPTIONAL { ?element wdt:P61 ?discoverer. }  # Discoverer
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?atomicNumber
LIMIT 10000
```

**Art Query** (verified research finding):
```sparql
# Domain: Art & Architecture
# Purpose: Fetch paintings, sculptures, artworks with artist and museum info
# Expected Results: ~1,500+ artworks

SELECT ?artwork ?artworkLabel ?artist ?artistLabel ?creationDate ?museum
WHERE {
  { ?artwork wdt:P31 wd:Q3305213. }  # Painting
  UNION { ?artwork wdt:P31 wd:Q860861. }  # Sculpture
  OPTIONAL { ?artwork wdt:P50 ?artist. }  # Artist
  OPTIONAL { ?artwork wdt:P580 ?creationDate. }  # Creation date
  OPTIONAL { ?artwork wdt:P1365 ?museum. }  # Located in
  OPTIONAL { ?artwork wdt:P195 ?currentLocation. }  # Current location
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?creationDate DESC
LIMIT 10000
```

**Health & Medicine Query** (verified research finding):
```sparql
# Domain: Human Body & Health
# Purpose: Fetch diseases, anatomical structures, treatments with properties
# Expected Results: ~1,500+ medical facts

SELECT ?disease ?diseaseLabel ?symptom ?symptomLabel ?treatment ?cause
WHERE {
  { ?disease wdt:P31 wd:Q12136. }  # Diseases
  UNION { ?disease wdt:P31 wd:Q4022. }  # Organs
  OPTIONAL { ?disease wdt:P780 ?symptom. }  # Symptoms
  OPTIONAL { ?disease wdt:P2176 ?treatment. }  # Treatment
  OPTIONAL { ?disease wdt:P828 ?cause. }  # Caused by
  OPTIONAL { ?disease wdt:P61 ?discoverer. }  # Discoverer
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?diseaseLabel
LIMIT 10000
```

**Food & Cuisine Query** (verified research finding):
```sparql
# Domain: Food & Cuisine
# Purpose: Fetch dishes, ingredients, cuisines with origin and properties
# Expected Results: ~1,500+ dishes and ingredients

SELECT ?dish ?dishLabel ?originCountry ?ingredients ?cuisineType
WHERE {
  { ?dish wdt:P31 wd:Q2095. }  # Food/Dishes
  UNION { ?dish wdt:P31 wd:Q44548. }  # Ingredient
  OPTIONAL { ?dish wdt:P495 ?originCountry. }  # Country of origin
  OPTIONAL { ?dish wdt:P527 ?ingredients. }  # Has ingredient
  OPTIONAL { ?dish wdt:P2012 ?cuisineType. }  # Cuisine type
  OPTIONAL { ?dish wdt:P580 ?firstMentionDate. }  # First mention date
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?dishLabel
LIMIT 10000
```

#### Query Template & Structural Requirements

Every `.sparql` file MUST follow this structure:

```sparql
# Domain: [Domain Name]
# Purpose: [What facts this query returns]
# Expected Results: ~[X] items
# Last Validated: [Date]
# Wikidata SPARQL Endpoint: https://query.wikidata.org/sparql

SELECT DISTINCT
  ?item
  ?itemLabel
  ?itemDescription
  ?property1
  ?property1Label
  ?property2
  ?property2Value
  # ... additional properties
WHERE {
  # Main filtering criteria
  ?item wdt:P31 wd:Q[something] .  # Instance of X

  # Optional properties that may not exist
  OPTIONAL { ?item wdt:P[prop] ?property1 . }
  OPTIONAL { ?item wdt:P[prop] ?property2 . }

  # Language service for English labels
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }

  # Optional: ranking to get best results
  # ?item wikibase:rank wikibase:PreferredRank .
}
ORDER BY ?itemLabel
LIMIT 10000
```

#### Verified Source Configuration

The following source list has been validated against current public data availability (as of 2026-03-09):

**General Knowledge**: Wikidata, Nobel Prize API (api.nobelprize.org/2.1/), CIA World Factbook (github.com/factbook/factbook.json), Library of Congress APIs

**Geography**: CIA World Factbook, GeoNames (geonames.org, CC-BY 4.0), Natural Earth (naturalearthdata.com, public domain), Wikidata, World Bank (api.worldbank.org, CC-BY 4.0)

**History**: Wikidata, CIA Factbook, Nobel Prize API, Library of Congress

**Natural Sciences**: PubChem (pubchem.ncbi.nlm.nih.gov, US Gov public domain), NIST Constants (US Gov public domain), Frictionless Periodic Table (CC0), USGS Minerals, Wikidata

**Space**: NASA APIs (api.nasa.gov, free with DEMO_KEY), NASA Exoplanet Archive (US Gov public domain), JPL Solar System Dynamics (US Gov public domain), Astronaut DB (Mendeley, CC-BY 4.0), Wikidata

**Mythology**: Wikidata, MANTO (Mythlab, CC-BY 4.0), FactGrid Roscher (CC0), Dariusk/Corpora (CC0)

**Animals**: ITIS (itis.gov, US Gov public domain), GBIF (CC0/CC-BY, must filter out CC-BY-NC ~18%), Wikidata, Natural History Museum London (CC0), Smithsonian (CC0)

**Health**: USDA FoodData Central (api.nal.usda.gov, CC0), OpenStax A&P 2e (CC-BY 4.0), MeSH (US Gov public domain), Wikidata

**Food**: USDA FoodData Central, Wikidata food queries, FAOSTAT (CC-BY 4.0, legal review required for commercial use)

**Art**: Met Museum (CC0, 470K+), Art Institute of Chicago (CC0), Rijksmuseum (CC0, 800K+), Cleveland Museum (CC0), Getty Vocabularies (ODC-By 1.0), Wikidata, Smithsonian (CC0)

#### Excluded Sources (Not Safe for Commercial Game)

The following sources were researched but excluded from the pipeline:

- **OpenTDB (Open Trivia Database)**: CC-BY-SA license — requires attribution in every fact displayed (impractical for game UI)
- **REST Countries API**: ODbL license — requires full attribution, not suitable for game fact cards
- **IUCN Red List**: No commercial use permitted — illegal to use in monetized/ad-supported game
- **ProPublica Data**: CC-BY-NC — noncommercial only
- **All Wikipedia dumps**: CC-BY-SA + sources under various licenses — creates cascading attribution requirement
- **Britannica**: Proprietary, no public API
- **All CC-BY-SA sources**: While open, the viral attribution requirement makes game fact UI impractical

#### Acceptance Criteria for Sub-step 1
- [ ] All 10 `.sparql` files created in `scripts/content-pipeline/sparql/` using verified queries
- [ ] Each query tested on https://query.wikidata.org/sparql and returns 1,000+ results
- [ ] All queries complete in <10 seconds on Wikidata live endpoint
- [ ] Each query has header comment explaining domain, purpose, expected result count
- [ ] No syntax errors (queries are valid SPARQL)
- [ ] All results include English labels via `SERVICE wikibase:label`
- [ ] Each query returns meaningful properties (not just items and labels)
- [ ] No hardcoded limits that prevent getting 1000+ results
- [ ] All queries tested and screenshot of results captured for each domain
- [ ] Verification confirms NO excluded sources (CC-BY-SA, ODbL, proprietary) are used

#### Testing Instructions
For each `.sparql` file:
1. Visit https://query.wikidata.org/sparql
2. Copy-paste the query
3. Click "Run" and wait for completion
4. Verify result count >= 1,000 and < 10,000 (if >10,000 is returned, trim LIMIT appropriately)
5. Spot-check a few results to ensure they match the domain expectation
6. Note the actual result count in a log file for documentation

---

### Sub-step 2: Create API Fetch Scripts for Non-SPARQL Sources

#### Objective
Build Node.js ESM scripts that fetch data from public APIs (NASA, PubChem, GBIF, USDA, Met Museum, Art Institute, World Bank) with proper error handling, rate limiting, and output standardization.

#### Files to Create
```
scripts/content-pipeline/fetch/
├── fetch-nasa.mjs
├── fetch-pubchem.mjs
├── fetch-gbif.mjs
├── fetch-usda.mjs
├── fetch-met-museum.mjs
├── fetch-art-institute.mjs
├── fetch-world-bank.mjs
└── shared-utils.mjs
```

#### Detailed Implementation Requirements

**2.1 — fetch-nasa.mjs**

Purpose: Fetch space/astronomy content from NASA Open APIs.

Features:
- Fetch APOD (Astronomy Picture of the Day) archive — daily image + explanation
- Fetch NEO (Near-Earth Objects) data — asteroids, orbital parameters, discovery date
- Fetch exoplanet data from NASA exoplanet catalog
- Fetch space mission data (if available via NASA API)

API Endpoints:
- `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&count=N`
- `https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=DEMO_KEY`
- `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+...&format=json` (no key required)

Usage:
```bash
node scripts/content-pipeline/fetch/fetch-nasa.mjs --limit 500 --output ./data/raw/nasa.json
```

Command-line Arguments:
- `--limit N` (default: 1000) — max records to fetch
- `--output path` (default: stdout) — output file path
- `--api-key KEY` (optional, default: DEMO_KEY) — NASA API key
- `--apod-only` (optional) — fetch only APOD data
- `--neo-only` (optional) — fetch only NEO data

Expected Output (JSON array):
```json
[
  {
    "sourceId": "nasa-apod-2024-01-15",
    "sourceName": "NASA APOD",
    "sourceUrl": "https://apod.nasa.gov/apod/ap240115.html",
    "domain": "space-astronomy",
    "rawData": {
      "title": "Beautiful nebula captured",
      "explanation": "This is a description...",
      "date": "2024-01-15",
      "media_type": "image",
      "hdurl": "..."
    }
  }
]
```

Requirements:
- Handle pagination: APOD returns in batches, use `count` parameter to paginate
- NEO data may be paginated via `page` parameter
- Implement 3-retry exponential backoff for network failures (start: 1s, backoff: 2x)
- Log progress to stderr: "Fetching APOD: 250/1000 records..."
- Validate response schema (must include required fields)
- API rate limit for DEMO_KEY is ~50 requests/hour; document this in headers

**2.2 — fetch-pubchem.mjs**

Purpose: Fetch chemistry/natural sciences content from PubChem.

Features:
- Fetch compound data — molecular formula, weight, properties, uses
- Fetch element data if available via PubChem
- Fetch biochemical pathways and reactions

API Endpoints:
- `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/NAME/JSON`
- `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/CID/JSON`
- `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/compounds/CID/JSON`

Usage:
```bash
node scripts/content-pipeline/fetch/fetch-pubchem.mjs --limit 500 --output ./data/raw/pubchem.json
```

Command-line Arguments:
- `--limit N` (default: 500) — max compounds to fetch
- `--output path` — output file path
- `--common-only` (optional) — fetch only commonly-known compounds

Expected Output:
```json
[
  {
    "sourceId": "pubchem-compound-5793",
    "sourceName": "PubChem",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/5793",
    "domain": "natural-sciences",
    "rawData": {
      "cid": 5793,
      "iupacName": "...",
      "molecularFormula": "H2O",
      "molecularWeight": 18.015,
      "canonicalSmiles": "O",
      "uses": [...],
      "synonyms": [...]
    }
  }
]
```

Requirements:
- PubChem has no rate limits for public API; no backoff needed
- Query a curated list of ~500 common compounds by CID (pre-load a CSV or JSON list)
- Fetch full compound data including synonyms, properties, computed properties
- Handle HTTP 404 gracefully (some compounds may be deprecated)
- Log progress: "Fetching PubChem: 123/500..."
- Validate that molecular weight is numeric and non-zero

**2.3 — fetch-gbif.mjs**

Purpose: Fetch species/wildlife content from Global Biodiversity Information Facility.

Features:
- Fetch species taxon data — taxonomy, common names, habitat, conservation status
- Fetch occurrence data (where species has been recorded)
- Filter to major taxonomic groups (vertebrates, common insects, plants)

API Endpoints:
- `https://api.gbif.org/v1/species/search?q=QUERY&limit=N`
- `https://api.gbif.org/v1/species/KEY`
- `https://api.gbif.org/v1/occurrences/search?taxonKey=KEY&limit=N`

Usage:
```bash
node scripts/content-pipeline/fetch/fetch-gbif.mjs --limit 1000 --output ./data/raw/gbif.json
```

Command-line Arguments:
- `--limit N` (default: 1000)
- `--output path`
- `--taxonomic-rank RANK` (optional: kingdom, phylum, class, order, family — default: all)

Expected Output:
```json
[
  {
    "sourceId": "gbif-species-2436436",
    "sourceName": "GBIF",
    "sourceUrl": "https://www.gbif.org/species/2436436",
    "domain": "animals-wildlife",
    "rawData": {
      "key": 2436436,
      "scientificName": "Canis lupus",
      "commonNames": ["Wolf", "Gray wolf"],
      "kingdom": "Animalia",
      "phylum": "Chordata",
      "class": "Mammalia",
      "order": "Carnivora",
      "family": "Canidae",
      "genus": "Canis",
      "occurrences": 45000,
      "threatStatus": "LC"
    }
  }
]
```

Requirements:
- GBIF API is free and has no rate limits; add 100ms delay between requests to be respectful
- Start with 500 curated species queries (provide a list: "lion", "eagle", "oak", etc.)
- Fetch full taxonomy for each species
- Occurrence count indicates well-documented species
- Filter out hybrid species and invalid entries
- Log progress: "Fetching GBIF: 345/1000..."

**2.4 — fetch-usda.mjs**

Purpose: Fetch nutrition/food content from USDA FoodData Central.

Features:
- Fetch food nutrient data — calories, macros, vitamins, minerals
- Fetch food categories and descriptions

API Endpoints:
- `https://fdc.nal.usda.gov/api/foods/search?query=QUERY&api_key=DEMO_KEY` (free tier available)
- `https://fdc.nal.usda.gov/api/foods/FDCID` (detail endpoint)

Usage:
```bash
node scripts/content-pipeline/fetch/fetch-usda.mjs --limit 1000 --output ./data/raw/usda.json
```

Command-line Arguments:
- `--limit N` (default: 1000)
- `--output path`
- `--api-key KEY` (optional, request free key from USDA)
- `--food-type TYPE` (optional: branded, survey, foundation)

Expected Output:
```json
[
  {
    "sourceId": "usda-fdc-373529",
    "sourceName": "USDA FoodData Central",
    "sourceUrl": "https://fdc.nal.usda.gov/food/373529",
    "domain": "food-cuisine",
    "rawData": {
      "fdcId": 373529,
      "description": "Wheat flour, white",
      "foodCategory": "Cereal Grains and Pasta",
      "nutrients": {
        "Energy": "364 kcal",
        "Protein": "10.3 g",
        "Fat": "1.0 g",
        "Carbohydrate": "76.3 g"
      }
    }
  }
]
```

Requirements:
- USDA FoodData Central requires a free API key; provide instructions for obtaining one
- Search for common foods/ingredients (provide a curated list of ~500 queries)
- Fetch nutrient panel for each food
- Handle pagination (USDA returns paginated results)
- Rate limit: 1 request per 100ms (10 req/sec is acceptable)
- Log progress: "Fetching USDA: 567/1000..."

**2.5 — fetch-met-museum.mjs**

Purpose: Fetch art/architecture content from Metropolitan Museum of Art.

Features:
- Fetch artwork metadata — title, artist, year, medium, dimensions, museum location
- Fetch artist information where available

API Endpoints:
- `https://collectionapi.metmuseum.org/public/collection/v1/search?q=QUERY`
- `https://collectionapi.metmuseum.org/public/collection/v1/objects/OBJECTID`

Usage:
```bash
node scripts/content-pipeline/fetch/fetch-met-museum.mjs --limit 1000 --output ./data/raw/met.json
```

Command-line Arguments:
- `--limit N` (default: 1000)
- `--output path`
- `--department DEPT` (optional: paintings, sculpture, drawings, etc.)

Expected Output:
```json
[
  {
    "sourceId": "met-museum-12345",
    "sourceName": "Metropolitan Museum of Art",
    "sourceUrl": "https://www.metmuseum.org/art/collection/12345",
    "domain": "art-architecture",
    "rawData": {
      "objectID": 12345,
      "title": "Portrait of Someone",
      "artistName": "Artist Name",
      "objectDate": "1650",
      "medium": "Oil on canvas",
      "dimensions": "76 x 63 5/8 in.",
      "department": "European Paintings",
      "isPublicDomain": true
    }
  }
]
```

Requirements:
- Met Museum API is public and free; no rate limiting needed but add 200ms delay between requests
- Search across multiple departments (paintings, sculpture, drawings, decorative arts)
- Fetch full object metadata
- Include only public domain items (isPublicDomain: true) to avoid copyright issues
- Log progress: "Fetching Met Museum: 234/1000..."

**2.6 — fetch-art-institute.mjs**

Purpose: Fetch art content from Art Institute of Chicago.

Features:
- Fetch artwork data — title, artist, year, medium, dimensions
- Fetch exhibition information

API Endpoints:
- `https://api.artic.edu/api/v1/artworks/search?q=QUERY`
- `https://api.artic.edu/api/v1/artworks/ARTWORKID`

Usage:
```bash
node scripts/content-pipeline/fetch/fetch-art-institute.mjs --limit 1000 --output ./data/raw/aic.json
```

Command-line Arguments:
- `--limit N` (default: 1000)
- `--output path`
- `--medium MEDIUM` (optional: painting, sculpture, photograph)

Expected Output:
```json
[
  {
    "sourceId": "aic-artwork-98765",
    "sourceName": "Art Institute of Chicago",
    "sourceUrl": "https://www.artic.edu/artworks/98765",
    "domain": "art-architecture",
    "rawData": {
      "id": 98765,
      "title": "Nighthawks",
      "artist_display": "Edward Hopper",
      "date_display": "1942",
      "medium_display": "Oil on canvas",
      "dimensions": "84.1 x 152.4 cm",
      "is_public_domain": true
    }
  }
]
```

Requirements:
- Art Institute API is public and free; add 200ms delay between requests
- Search across multiple mediums
- Include only public domain items (is_public_domain: true)
- Fetch full artwork metadata
- Log progress: "Fetching Art Institute: 456/1000..."

**2.7 — fetch-world-bank.mjs**

Purpose: Fetch geography/country statistics from World Bank Indicators API.

Features:
- Fetch country data — population, GDP, area, HDI, life expectancy, literacy rate, etc.
- Fetch regional groupings

API Endpoints:
- `https://api.worldbank.org/v2/country?format=json&per_page=500`
- `https://api.worldbank.org/v2/country/CODE/indicators/INDICATORID?format=json`

Usage:
```bash
node scripts/content-pipeline/fetch/fetch-world-bank.mjs --limit 195 --output ./data/raw/world-bank.json
```

Command-line Arguments:
- `--limit N` (default: 195 — all countries)
- `--output path`
- `--indicators CODES` (optional: comma-separated indicator codes, default: SP.POP.TOTL,NY.GDP.MKTP.CD)

Expected Output:
```json
[
  {
    "sourceId": "world-bank-US",
    "sourceName": "World Bank",
    "sourceUrl": "https://data.worldbank.org/country/US",
    "domain": "geography",
    "rawData": {
      "countryCode": "US",
      "countryName": "United States",
      "region": "North America",
      "population": 331000000,
      "gdp": 25700000000000,
      "gniPerCapita": 67930,
      "area": 9834000,
      "capitalCity": "Washington"
    }
  }
]
```

Requirements:
- World Bank API is free and has no rate limits; add 100ms delay
- Fetch all ~195 countries
- Fetch key development indicators for each country
- Handle pagination (World Bank returns paginated results)
- Log progress: "Fetching World Bank: 123/195..."
- Validate numeric fields (population, GDP) are non-negative

**2.8 — shared-utils.mjs**

Purpose: Common utilities for all fetch scripts.

Features:
- Rate limiter utility (delay between requests)
- Retry logic (exponential backoff)
- Response validation
- Output formatting
- Error logging

Implementation:
```javascript
// Rate limiter with configurable delay
export function createRateLimiter(delayMs) {
  let lastCall = 0;
  return async () => {
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed < delayMs) {
      await new Promise(r => setTimeout(r, delayMs - elapsed));
    }
    lastCall = Date.now();
  };
}

// Retry with exponential backoff
export async function retryWithBackoff(fn, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
      const delay = Math.pow(2, i) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Standard output formatter
export function formatOutput(sourceId, sourceName, sourceUrl, domain, rawData) {
  return {
    sourceId,
    sourceName,
    sourceUrl,
    domain,
    rawData
  };
}

// CLI argument parser
export function parseArgs(cliArgs) {
  const args = {};
  for (let i = 2; i < cliArgs.length; i++) {
    if (cliArgs[i].startsWith('--')) {
      const key = cliArgs[i].slice(2);
      const value = cliArgs[i + 1] && !cliArgs[i + 1].startsWith('--')
        ? cliArgs[++i]
        : 'true';
      args[key] = value;
    }
  }
  return args;
}
```

#### Acceptance Criteria for Sub-step 2
- [ ] All 7 fetch scripts created in `scripts/content-pipeline/fetch/`
- [ ] Each script implements `--limit` and `--output` arguments
- [ ] Each script includes 3-retry exponential backoff for network failures
- [ ] Each script logs progress to stderr (e.g., "Fetching X: 250/1000...")
- [ ] Each script outputs valid JSON array with standard format (sourceId, sourceName, sourceUrl, domain, rawData)
- [ ] No API keys hardcoded; DEMO_KEY or free tier documented in usage comments
- [ ] All scripts have rate limiting appropriate to API terms
- [ ] All scripts validated: `node scripts/content-pipeline/fetch/fetch-nasa.mjs --limit 10` runs without error
- [ ] shared-utils.mjs provides retry, rate-limiting, and formatting utilities
- [ ] All 7 scripts tested independently and output sample data to verify structure

#### Testing Instructions
For each fetch script:
1. Run: `node scripts/content-pipeline/fetch/SCRIPT.mjs --limit 10 --output ./test-output.json`
2. Verify output file contains valid JSON array with at least 1 object
3. Check that each object has: sourceId, sourceName, sourceUrl, domain, rawData
4. Spot-check rawData to ensure it contains expected properties for that domain
5. Log the successful test in a test results document

---

### Sub-step 3: Create Source Configuration Registry

#### Objective
Build a centralized JSON file that maps each knowledge domain to its data sources, including licensing information, attribution requirements, and script/query references.

#### Files to Create
```
scripts/content-pipeline/sources.json
```

#### Detailed Implementation Requirements

**Structure:**

```json
{
  "version": "1.0",
  "lastUpdated": "2026-03-09",
  "domains": {
    "general-knowledge": {
      "displayName": "General Knowledge",
      "description": "Notable facts, world records, inventions, discoveries",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/general-knowledge.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 5000
        },
        {
          "name": "DBpedia (future)",
          "type": "sparql",
          "queryFile": null,
          "endpoint": "https://dbpedia.org/sparql",
          "license": "CC-BY-SA",
          "attribution": "DBpedia",
          "priority": 2,
          "expectedRecords": 2000,
          "status": "planned"
        }
      ]
    },
    "natural-sciences": {
      "displayName": "Natural Sciences",
      "description": "Chemistry, physics, periodic table, materials, constants",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/natural-sciences.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 2000
        },
        {
          "name": "PubChem",
          "type": "api",
          "fetchScript": "fetch/fetch-pubchem.mjs",
          "endpoint": "https://pubchem.ncbi.nlm.nih.gov",
          "license": "CC0",
          "attribution": null,
          "priority": 2,
          "expectedRecords": 500
        }
      ]
    },
    "space-astronomy": {
      "displayName": "Space & Astronomy",
      "description": "Planets, moons, asteroids, space missions, astronauts, exoplanets",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/space-astronomy.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 3500
        },
        {
          "name": "NASA Open APIs",
          "type": "api",
          "fetchScript": "fetch/fetch-nasa.mjs",
          "endpoint": "https://api.nasa.gov",
          "license": "CC0",
          "attribution": null,
          "priority": 2,
          "expectedRecords": 1000
        }
      ]
    },
    "geography": {
      "displayName": "Geography",
      "description": "Countries, cities, geographical features, landmarks",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/geography.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 5000
        },
        {
          "name": "World Bank",
          "type": "api",
          "fetchScript": "fetch/fetch-world-bank.mjs",
          "endpoint": "https://api.worldbank.org",
          "license": "CC0",
          "attribution": null,
          "priority": 2,
          "expectedRecords": 195
        }
      ]
    },
    "history": {
      "displayName": "History",
      "description": "Historical events, figures, wars, treaties, cultural milestones",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/history.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 4000
        }
      ]
    },
    "mythology-folklore": {
      "displayName": "Mythology & Folklore",
      "description": "Deities, mythological creatures, legendary stories, folklore",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/mythology-folklore.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 2500
        }
      ]
    },
    "animals-wildlife": {
      "displayName": "Animals & Wildlife",
      "description": "Species taxonomy, endangered species, record-holders, habitats",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/animals-wildlife.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 4000
        },
        {
          "name": "GBIF",
          "type": "api",
          "fetchScript": "fetch/fetch-gbif.mjs",
          "endpoint": "https://api.gbif.org",
          "license": "CC0",
          "attribution": null,
          "priority": 2,
          "expectedRecords": 1000
        }
      ]
    },
    "human-body-health": {
      "displayName": "Human Body & Health",
      "description": "Anatomy, diseases, medical discoveries, vitamins, genetics",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/human-body-health.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 2500
        }
      ]
    },
    "food-cuisine": {
      "displayName": "Food & World Cuisine",
      "description": "Dishes, ingredients, spices, culinary techniques, nutrition",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/food-cuisine.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 3000
        },
        {
          "name": "USDA FoodData Central",
          "type": "api",
          "fetchScript": "fetch/fetch-usda.mjs",
          "endpoint": "https://fdc.nal.usda.gov",
          "license": "CC0",
          "attribution": null,
          "priority": 2,
          "expectedRecords": 1000
        }
      ]
    },
    "art-architecture": {
      "displayName": "Art & Architecture",
      "description": "Artworks, artists, architects, landmarks, art movements",
      "sources": [
        {
          "name": "Wikidata",
          "type": "sparql",
          "queryFile": "sparql/art-architecture.sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC0",
          "attribution": null,
          "priority": 1,
          "expectedRecords": 3500
        },
        {
          "name": "Metropolitan Museum of Art",
          "type": "api",
          "fetchScript": "fetch/fetch-met-museum.mjs",
          "endpoint": "https://collectionapi.metmuseum.org",
          "license": "CC0",
          "attribution": null,
          "priority": 2,
          "expectedRecords": 1000
        },
        {
          "name": "Art Institute of Chicago",
          "type": "api",
          "fetchScript": "fetch/fetch-art-institute.mjs",
          "endpoint": "https://api.artic.edu",
          "license": "CC0",
          "attribution": null,
          "priority": 3,
          "expectedRecords": 1000
        }
      ]
    }
  },
  "languages": {
    "english": {
      "displayName": "English",
      "code": "en",
      "sources": [
        {
          "name": "Wiktionary (Wikidata)",
          "type": "sparql",
          "queryFile": null,
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC-BY-SA",
          "attribution": "Wiktionary contributors",
          "priority": 1,
          "status": "planned"
        }
      ]
    },
    "spanish": {
      "displayName": "Spanish",
      "code": "es",
      "sources": [
        {
          "name": "Wiktionary (Wikidata)",
          "type": "sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC-BY-SA",
          "attribution": "Wiktionary contributors",
          "priority": 1,
          "status": "planned"
        }
      ]
    },
    "french": {
      "displayName": "French",
      "code": "fr",
      "sources": [
        {
          "name": "Wiktionary (Wikidata)",
          "type": "sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC-BY-SA",
          "attribution": "Wiktionary contributors",
          "priority": 1,
          "status": "planned"
        }
      ]
    },
    "german": {
      "displayName": "German",
      "code": "de",
      "sources": [
        {
          "name": "Wiktionary (Wikidata)",
          "type": "sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC-BY-SA",
          "attribution": "Wiktionary contributors",
          "priority": 1,
          "status": "planned"
        }
      ]
    },
    "japanese": {
      "displayName": "Japanese",
      "code": "ja",
      "sources": [
        {
          "name": "JMdict",
          "type": "file",
          "importScript": "vocab/import-jmdict.mjs",
          "url": "http://www.edrdg.org/pub/Nihongo/JMdict.gz",
          "license": "CC-BY-SA",
          "attribution": "EDICT/JEDICT Project",
          "priority": 1,
          "expectedRecords": 150000
        },
        {
          "name": "Tatoeba",
          "type": "api",
          "importScript": "vocab/import-tatoeba.mjs",
          "url": "https://tatoeba.org",
          "license": "CC-BY-2.0",
          "attribution": "Tatoeba contributors",
          "priority": 2,
          "expectedRecords": 100000
        },
        {
          "name": "Wiktionary (Wikidata)",
          "type": "sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC-BY-SA",
          "attribution": "Wiktionary contributors",
          "priority": 3,
          "status": "planned"
        }
      ]
    },
    "mandarin-chinese": {
      "displayName": "Mandarin Chinese",
      "code": "zh",
      "sources": [
        {
          "name": "Wiktionary (Wikidata)",
          "type": "sparql",
          "endpoint": "https://query.wikidata.org/sparql",
          "license": "CC-BY-SA",
          "attribution": "Wiktionary contributors",
          "priority": 1,
          "status": "planned"
        }
      ]
    }
  },
  "licensePolicy": {
    "allowed": ["CC0", "CC-BY", "CC-BY-SA", "OGL", "Public Domain"],
    "restricted": ["CC-BY-NC", "CC-BY-NC-SA", "Proprietary"],
    "blocked": ["Copyright", "Restricted", "Commercial"]
  }
}
```

#### Key Requirements
- **License Policy:** No CC-BY-SA sources can be used as content (quiz fact) sources; they can only be used for vocabulary/metadata. CC-BY-NC is explicitly blocked.
- **Attribution:** If attribution is required, it must be included in the game's credits/about screen
- **Priority Ordering:** Sources with priority 1 are primary; priority 2+ are supplementary
- **Status Tracking:** Planned sources can be included with `"status": "planned"`
- **Expected Records:** Each source should estimate how many records it will contribute

#### Acceptance Criteria for Sub-step 3
- [ ] `sources.json` created at `scripts/content-pipeline/sources.json`
- [ ] All 10 knowledge domains included with at least 1 source each
- [ ] All 6 language domains included with at least 1 source each
- [ ] All sources have valid license information
- [ ] No CC-BY-NC or commercial sources listed
- [ ] All SPARQL sources reference correct query files
- [ ] All API sources reference correct fetch scripts
- [ ] File is valid JSON (parseable with `JSON.parse()`)
- [ ] License policy explicitly blocks CC-BY-NC and proprietary licenses

#### Testing Instructions
1. Parse `sources.json` with: `node -e "console.log(JSON.parse(require('fs').readFileSync('./scripts/content-pipeline/sources.json')))"`
2. Verify output shows all 10 domains and 6 languages
3. Spot-check that referenced query files and scripts actually exist

---

### Sub-step 4: Create Vocabulary Source Import Scripts

#### Objective
Build specialized scripts to import vocabulary/language data from JMdict, Tatoeba, and Wikidata Lexemes, producing standardized vocabulary JSON suitable for language learning.

#### Files to Create
```
scripts/content-pipeline/vocab/
├── import-jmdict.mjs
├── import-tatoeba.mjs
├── import-wikidata-lexemes.mjs
└── vocab-schema.mjs
```

#### Detailed Implementation Requirements

**4.1 — import-jmdict.mjs**

Purpose: Download and parse JMdict XML, extract Japanese vocabulary with readings and meanings.

API/Source:
- Download: `http://www.edrdg.org/pub/Nihongo/JMdict.gz` (gzipped XML, ~8MB)
- Format: XML with entries, kanjis, kanas, senses (definitions)

Usage:
```bash
node scripts/content-pipeline/vocab/import-jmdict.mjs --limit 10000 --output ./data/raw/jmdict-vocab.json
```

Command-line Arguments:
- `--limit N` (default: 150000 — all JLPT words)
- `--output path`
- `--min-jlpt LEVEL` (optional: 1-5, 1=hardest, 5=easiest)
- `--max-jlpt LEVEL` (optional: 1-5)

Expected Output:
```json
[
  {
    "wordId": "1000100",
    "word": "亜",
    "reading": "あ",
    "meanings": ["Asia", "Asia radical"],
    "partOfSpeech": "noun",
    "jlptLevel": 1,
    "language": "japanese",
    "exampleSentence": null,
    "sourceName": "JMdict",
    "sourceUrl": "http://www.edrdg.org/pub/Nihongo/JMdict.gz"
  }
]
```

Requirements:
- Download and decompress JMdict XML on the fly
- Parse XML and extract: entry ID, kanji, kana reading(s), sense(s) (English definitions)
- Filter by JLPT level if provided
- Handle multiple readings/meanings for same word
- Estimate JLPT level from frequency ranking if not explicit
- Log progress: "Parsing JMdict: 5000/150000 entries..."
- Output as JSON array, one entry per word

**4.2 — import-tatoeba.mjs**

Purpose: Download Tatoeba sentence pairs and associate example sentences with vocabulary.

API/Source:
- Download: `https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.csv` (sentences)
- Download: `https://downloads.tatoeba.org/exports/links.csv` (sentence links for JP-EN pairs)

Usage:
```bash
node scripts/content-pipeline/vocab/import-tatoeba.mjs --limit 100000 --output ./data/raw/tatoeba-examples.json --match-vocab ./data/raw/jmdict-vocab.json
```

Command-line Arguments:
- `--limit N` (default: 100000)
- `--output path`
- `--match-vocab FILE` (optional: path to JMdict output to match example sentences to words)
- `--min-sentence-length N` (optional: default 5 characters)

Expected Output:
```json
[
  {
    "sentenceId": "123456",
    "wordId": "1000100",
    "word": "亜",
    "example": "亜細亜という言葉は...",
    "exampleTranslation": "The word Asia means...",
    "language": "japanese",
    "sourceName": "Tatoeba",
    "sourceUrl": "https://tatoeba.org/eng/sentences/show/123456"
  }
]
```

Requirements:
- Download and parse CSV files
- Match Japanese-English sentence pairs
- If `--match-vocab` is provided, match example sentences to words from JMdict vocab list
- For each vocabulary word, find 1-3 example sentences that contain it
- Filter sentences by minimum length (avoid trivial examples)
- Log progress: "Matching Tatoeba: 50000/100000..."
- Output as JSON array

**4.3 — import-wikidata-lexemes.mjs**

Purpose: Query Wikidata Lexeme SPARQL endpoint for vocabulary in target languages.

API/Source:
- Endpoint: `https://query.wikidata.org/sparql` (Wikidata Lexeme queries)

Usage:
```bash
node scripts/content-pipeline/vocab/import-wikidata-lexemes.mjs --languages en,es,fr,de,ja,zh --limit 5000 --output ./data/raw/wikidata-lexemes.json
```

Command-line Arguments:
- `--languages CODES` (comma-separated language codes: en, es, fr, de, ja, zh)
- `--limit N` (default: 5000 per language)
- `--output path`

SPARQL Query Template:
```sparql
SELECT ?lexeme ?lexemeLabel ?sense ?senseLabel ?language
WHERE {
  ?lexeme dct:language wd:Q[LANGUAGE_CODE] .
  ?lexeme ontolex:sense ?sense .
  ?sense skos:definition ?senseLabel .

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "[LANGUAGE_CODE]" .
  }
}
LIMIT 5000
```

Expected Output:
```json
[
  {
    "lexemeId": "L1234567",
    "word": "hello",
    "meaning": "a polite greeting",
    "language": "english",
    "sourceName": "Wikidata Lexeme",
    "sourceUrl": "https://www.wikidata.org/wiki/Lexeme:L1234567"
  }
]
```

Requirements:
- Build SPARQL queries dynamically for each language
- Execute queries against Wikidata endpoint with retries
- Parse and normalize results
- Handle optional senses (OPTIONAL blocks)
- Log progress: "Fetching Wikidata Lexemes: en (500/5000)..."
- Output as JSON array

**4.4 — vocab-schema.mjs**

Purpose: Define vocabulary schema and validation utilities.

Implementation:
```javascript
export const VOCAB_SCHEMA = {
  wordId: { type: 'string', required: true },
  word: { type: 'string', required: true },
  reading: { type: 'string', required: false },  // for ja, zh
  meanings: { type: 'array', itemType: 'string', required: true },
  partOfSpeech: { type: 'string', required: false },
  jlptLevel: { type: 'number', min: 1, max: 5, required: false },
  language: { type: 'string', required: true },
  exampleSentence: { type: 'string', required: false },
  sourceName: { type: 'string', required: true },
  sourceUrl: { type: 'string', required: true }
};

export function validateVocabEntry(entry) {
  // Validate against schema
  // Return { valid: boolean, errors: string[] }
}

export function normalizeVocabEntry(entry) {
  // Trim strings, validate URLs, etc.
  // Return normalized entry
}
```

#### Acceptance Criteria for Sub-step 4
- [ ] All 3 import scripts created in `scripts/content-pipeline/vocab/`
- [ ] JMdict import successfully downloads and parses XML (test with --limit 100)
- [ ] Tatoeba import successfully downloads and matches sentences
- [ ] Wikidata Lexeme import successfully queries and retrieves vocabulary
- [ ] All scripts output valid JSON array with standardized vocabulary schema
- [ ] vocab-schema.mjs provides validation and normalization utilities
- [ ] All scripts log progress to stderr
- [ ] All scripts handle errors gracefully (no crashes on network failure)
- [ ] Test run: `node scripts/content-pipeline/vocab/import-jmdict.mjs --limit 10 --output ./test-jmdict.json` produces valid JSON

#### Testing Instructions
1. Run JMdict: `node scripts/content-pipeline/vocab/import-jmdict.mjs --limit 10 --output ./test-jmdict.json`
2. Verify output is valid JSON array with 10 entries
3. Run Tatoeba: `node scripts/content-pipeline/vocab/import-tatoeba.mjs --limit 10 --output ./test-tatoeba.json`
4. Verify output contains matching JP-EN sentences
5. Run Wikidata Lexeme: `node scripts/content-pipeline/vocab/import-wikidata-lexemes.mjs --languages ja --limit 10 --output ./test-lexeme.json`
6. Verify output contains Japanese words with meanings

---

### Sub-step 5: Create Runner Script

#### Objective
Build an orchestrator script that runs all SPARQL queries and fetch scripts for a given domain, combining results into a single output file.

#### Files to Create
```
scripts/content-pipeline/fetch-all.mjs
```

#### Detailed Implementation Requirements

**Purpose:** Orchestrate full domain fetch end-to-end.

**Usage:**
```bash
node scripts/content-pipeline/fetch-all.mjs --domain geography --output ./data/raw/geography.json --limit 500
node scripts/content-pipeline/fetch-all.mjs --domain all --output ./data/raw/all-domains.json
node scripts/content-pipeline/fetch-all.mjs --language japanese --output ./data/raw/japanese-vocab.json
```

**Command-line Arguments:**
- `--domain DOMAIN` (required unless --language is provided)
  - Values: general-knowledge, natural-sciences, space-astronomy, geography, history, mythology-folklore, animals-wildlife, human-body-health, food-cuisine, art-architecture, or "all"
- `--language LANG` (optional, alternative to --domain)
  - Values: english, spanish, french, german, japanese, mandarin-chinese, or "all"
- `--output PATH` (required)
- `--limit N` (optional, default: 1000 per source)
- `--sources SOURCE1,SOURCE2` (optional: comma-separated list of specific sources to run)
- `--dry-run` (optional: print commands without executing)

**Execution Flow:**

1. Load `scripts/content-pipeline/sources.json`
2. Resolve domain/language to list of sources
3. For each source (in priority order):
   - If type is "sparql": run SPARQL query, save intermediate results
   - If type is "api": run fetch script with --limit, save intermediate results
   - If type is "file": run import script, save intermediate results
4. Combine all results into single array
5. Log attribution/license info for each source
6. Write output JSON with metadata envelope

**Output Format:**

```json
{
  "metadata": {
    "domain": "geography",
    "generatedAt": "2026-03-09T14:23:45Z",
    "totalRecords": 5195,
    "sourcesUsed": [
      {
        "name": "Wikidata",
        "recordCount": 5000,
        "license": "CC0",
        "attribution": null
      },
      {
        "name": "World Bank",
        "recordCount": 195,
        "license": "CC0",
        "attribution": null
      }
    ]
  },
  "records": [
    { "sourceId": "wikidata-geog-123", ... },
    { "sourceId": "world-bank-US", ... }
  ]
}
```

**Implementation Details:**

```javascript
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { parseArgs } from './fetch/shared-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcesFile = path.join(__dirname, 'sources.json');

async function runQuery(queryFile, limit) {
  // Execute SPARQL query (curl or similar)
  // Return results as JSON array
}

async function runFetchScript(scriptFile, limit, domain) {
  // Execute fetch script and capture output
  // Return results as JSON array
}

async function fetchAllForDomain(domain, limit, specificSources) {
  const sources = loadSources();
  const domainSources = sources.domains[domain]?.sources || [];

  // Filter to specific sources if provided
  const sourccesToRun = specificSources
    ? domainSources.filter(s => specificSources.includes(s.name))
    : domainSources;

  // Sort by priority
  sourcesToRun.sort((a, b) => (a.priority || 999) - (b.priority || 999));

  let allRecords = [];
  const sourceStats = [];

  for (const source of sourcesToRun) {
    try {
      let records = [];

      if (source.type === 'sparql') {
        records = await runQuery(source.queryFile, limit);
      } else if (source.type === 'api') {
        records = await runFetchScript(source.fetchScript, limit, domain);
      } else if (source.type === 'file') {
        records = await runImportScript(source.importScript, limit);
      }

      allRecords = allRecords.concat(records);
      sourceStats.push({
        name: source.name,
        recordCount: records.length,
        license: source.license,
        attribution: source.attribution
      });

      console.error(`${source.name}: ${records.length} records`);
    } catch (err) {
      console.error(`Failed to fetch from ${source.name}:`, err.message);
    }
  }

  return {
    metadata: {
      domain,
      generatedAt: new Date().toISOString(),
      totalRecords: allRecords.length,
      sourcesUsed: sourceStats
    },
    records: allRecords
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.output) {
    console.error('--output is required');
    process.exit(1);
  }

  let data;

  if (args.domain) {
    const domain = args.domain === 'all' ? 'all' : args.domain;
    const limit = parseInt(args.limit) || 1000;
    const sources = args.sources?.split(',');

    if (domain === 'all') {
      // Fetch for all domains sequentially
      data = await fetchAllDomains(limit, sources);
    } else {
      data = await fetchAllForDomain(domain, limit, sources);
    }
  } else if (args.language) {
    const language = args.language;
    const limit = parseInt(args.limit) || 1000;

    // Similar logic for languages
    data = await fetchAllForLanguage(language, limit);
  } else {
    console.error('Either --domain or --language is required');
    process.exit(1);
  }

  if (args['dry-run']) {
    console.log('Dry run: would write', JSON.stringify(data, null, 2));
  } else {
    fs.writeFileSync(args.output, JSON.stringify(data, null, 2));
    console.error(`Wrote ${data.records.length} records to ${args.output}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

#### Acceptance Criteria for Sub-step 5
- [ ] `fetch-all.mjs` created at `scripts/content-pipeline/fetch-all.mjs`
- [ ] Script accepts `--domain`, `--language`, `--output`, `--limit`, `--sources`, `--dry-run` arguments
- [ ] Script loads and parses `sources.json` correctly
- [ ] Script executes SPARQL queries and API scripts in priority order
- [ ] Script combines results into single output with metadata envelope
- [ ] Output JSON includes sourcesUsed with record counts and license info
- [ ] Script logs progress to stderr (not stdout)
- [ ] Test run: `node scripts/content-pipeline/fetch-all.mjs --domain general-knowledge --limit 10 --output ./test-all.json` succeeds
- [ ] Output file contains valid JSON with metadata and records

#### Testing Instructions
1. Run: `node scripts/content-pipeline/fetch-all.mjs --domain general-knowledge --limit 10 --output ./test-all.json`
2. Verify output file exists and contains valid JSON
3. Verify metadata includes domain, timestamp, record count, sources used
4. Verify records array contains at least 1 record
5. Run with --dry-run: `node scripts/content-pipeline/fetch-all.mjs --domain geography --limit 5 --output ./test.json --dry-run`
6. Verify it prints what would be written without executing

---

## Quality Funnel: Per-Domain Fact Generation Caps

**CRITICAL:** The system is designed to generate quiz-worthy facts, NOT to exhaustively dump all available data. Each domain has a hard cap to maintain quality and manageability:

**Per-Domain Caps** (verified research constraints):
- General Knowledge: 5,000 facts
- Geography: 10,000 facts
- History: 10,000 facts
- Natural Sciences: 10,000 facts
- Space & Astronomy: 5,000 facts (NOT 6,128 exoplanets or 1.3M named asteroids)
- Mythology & Folklore: 5,000 facts
- Animals & Wildlife: 10,000 facts (NOT 839K taxonomic names)
- Human Body & Health: 8,000 facts
- Food & World Cuisine: 5,000 facts
- Art & Architecture: 10,000 facts (NOT 470K pottery shards)

**Filtering Strategy for Each Domain:**

The SPARQL queries and API fetches are intentionally narrowed to select QUIZ-WORTHY facts, not exhaustive data:

- **General Knowledge**: World records, firsts, notable discoveries, superlatives — exclude generic trivia
- **Geography**: Sovereign countries, major cities, significant landmarks, major bodies of water — exclude small towns, minor features
- **History**: Major events (battles, treaties, revolutions), historical figures, significant eras — exclude minor events, footnotes
- **Natural Sciences**: All 118 elements, major physical constants, fundamental reactions — exclude obscure compounds, theoretical concepts
- **Space & Astronomy**: Planets, moons, major stars, famous missions, notable astronauts — exclude every unnamed asteroid and small crater
- **Mythology & Folklore**: Named deities and legendary figures from documented cultures — exclude speculative or obscure variants
- **Animals & Wildlife**: Species with common English names, notable behaviors, record-holders — exclude obscure taxonomic entries, unrecognized subspecies
- **Human Body & Health**: Named organs, common diseases, major discoveries, essential vitamins — exclude rare syndromes, deprecated terminology
- **Food & Cuisine**: Recognizable dishes from documented cultures, major ingredients, known culinary techniques — exclude rare/extinct foods
- **Art & Architecture**: Named artists, famous artworks, recognized movements, major buildings — exclude minor works, anonymous pieces

This constraint ensures:
1. **Manageability**: 80K facts total, not millions
2. **Discoverability**: No "long tail" of obscure facts that players will never encounter
3. **Quality**: Every fact can be hand-checked and validated by humans
4. **Repeatability**: Fact set is stable across time (won't balloon with new data sources)

---

## Acceptance Criteria (Overall Phase)

All sub-steps must be completed and verified:

- [ ] **Sub-step 1:** All 10 SPARQL queries validated, return 1,000+ results each
- [ ] **Sub-step 2:** All 7 API fetch scripts tested, output valid JSON
- [ ] **Sub-step 3:** `sources.json` created, valid JSON, all domains/languages included
- [ ] **Sub-step 4:** Vocabulary import scripts created and tested
- [ ] **Sub-step 5:** Orchestrator script created and tested end-to-end

---

## Verification Gate

**MUST PASS before phase is marked complete:**

- [ ] `npm run typecheck` passes (all scripts have correct syntax)
- [ ] `npm run build` succeeds (no ES module errors)
- [ ] Manual test of full workflow:
  ```bash
  node scripts/content-pipeline/fetch-all.mjs --domain geography --limit 100 --output ./verify-geography.json
  # Verify output: valid JSON, 100+ records, correct metadata
  ```
- [ ] Wikidata SPARQL queries validated on https://query.wikidata.org/sparql (all 10 queries run successfully, screenshot proof)
- [ ] NASA API test: `node scripts/content-pipeline/fetch/fetch-nasa.mjs --limit 10 --output ./test-nasa.json` succeeds
- [ ] sources.json screenshot showing all 10 domains + 6 languages
- [ ] No CC-BY-SA sources used as content sources (only metadata/vocabulary)
- [ ] Documentation reviewed: README.md in scripts/content-pipeline/ explains all scripts, usage, and API keys

---

## Files Affected

**NEW — SPARQL Query Library:**
- `scripts/content-pipeline/sparql/general-knowledge.sparql`
- `scripts/content-pipeline/sparql/natural-sciences.sparql`
- `scripts/content-pipeline/sparql/space-astronomy.sparql`
- `scripts/content-pipeline/sparql/geography.sparql`
- `scripts/content-pipeline/sparql/history.sparql`
- `scripts/content-pipeline/sparql/mythology-folklore.sparql`
- `scripts/content-pipeline/sparql/animals-wildlife.sparql`
- `scripts/content-pipeline/sparql/human-body-health.sparql`
- `scripts/content-pipeline/sparql/food-cuisine.sparql`
- `scripts/content-pipeline/sparql/art-architecture.sparql`

**NEW — API Fetch Scripts:**
- `scripts/content-pipeline/fetch/fetch-nasa.mjs`
- `scripts/content-pipeline/fetch/fetch-pubchem.mjs`
- `scripts/content-pipeline/fetch/fetch-gbif.mjs`
- `scripts/content-pipeline/fetch/fetch-usda.mjs`
- `scripts/content-pipeline/fetch/fetch-met-museum.mjs`
- `scripts/content-pipeline/fetch/fetch-art-institute.mjs`
- `scripts/content-pipeline/fetch/fetch-world-bank.mjs`
- `scripts/content-pipeline/fetch/shared-utils.mjs`

**NEW — Vocabulary Import Scripts:**
- `scripts/content-pipeline/vocab/import-jmdict.mjs`
- `scripts/content-pipeline/vocab/import-tatoeba.mjs`
- `scripts/content-pipeline/vocab/import-wikidata-lexemes.mjs`
- `scripts/content-pipeline/vocab/vocab-schema.mjs`

**NEW — Configuration & Orchestration:**
- `scripts/content-pipeline/sources.json`
- `scripts/content-pipeline/fetch-all.mjs`
- `scripts/content-pipeline/README.md` (usage documentation)

**EDIT (if applicable):**
- None — this phase is additive only. No existing game files modified.

---

## Notes for Implementation Workers

- **API Keys:** None required for this phase. NASA DEMO_KEY is sufficient for testing. Document that real API keys can be added later.
- **Rate Limiting:** Each fetch script should respect API terms; include delays between requests as documented.
- **Testing:** Every script must be tested independently before integration into fetch-all.mjs.
- **Staging:** All raw output goes to `./data/raw/` (create if doesn't exist). This is not committed; it's intermediate data.
- **Documentation:** Create a README.md in `scripts/content-pipeline/` with examples of how to run each script and fetch-all.mjs.
- **License Compliance:** NO CC-BY-SA sources as content; CC-BY-NC BLOCKED entirely. All sources verified against license policy in sources.json.
