# AR-18: Vocabulary Expansion

Import and process vocabulary data for all 6 target languages from approved sources (JMdict, Wikidata lexemes, CEFR lists, Tatoeba).

## Overview

### Goal
Build a complete multi-language vocabulary system supporting 6 languages (Japanese, Spanish, French, German, Korean, Mandarin Chinese) by importing from open data sources, applying proficiency level mappings (JLPT, CEFR, HSK, TOPIK), and converting vocabulary entries into the game's Fact schema with quiz variants and visual descriptions.

### Dependencies
- **AR-15** (Source Data & Registry) — Fetch scripts must be complete and producing JSON outputs
- **AR-17** (Haiku Fact Engine) — Required for `vocab-to-facts.mjs` to generate quiz variants
- **AR-11 Part C** (Visual Description Pipeline) — Required for final visual description generation step
- **Vocabulary sources**: All publicly available, no API keys required except for Haiku in final steps

### Estimated Complexity
**Large** — involves data integration from multiple sources, cross-referencing level lists, and format conversion. Estimated timeline: 3-4 weeks.

### Requirements & Constraints
- **Open Data Sources Only**: JMdict (EDRDG), Wikidata, Tatoeba, and public CEFR/HSK/TOPIK lists
- **Copyright Attribution**: All sources must be credited in `sourceName` and `sourceUrl` fields
- **Language Coverage**:
  - Japanese: Complete JLPT N1-N5 (estimated 20K+ words total)
  - Spanish: 5K+ words from Wikidata + frequency lists
  - French: 5K+ words from Wikidata + frequency lists
  - German: 5K+ words from Wikidata + frequency lists
  - Korean: 5K+ words from Wikidata + TOPIK mapping
  - Mandarin Chinese: 5K+ words from Wikidata + HSK mapping
- **License Compatibility**: All sources licensed under CC-BY or CC0; attribution required in-game

---

## Sub-steps

### 1. Complete JMdict Import for All JLPT Levels

**File(s)**: `scripts/content-pipeline/vocab/import-jmdict.mjs`

**Objective**: Download the full JMdict dictionary XML from EDRDG, parse it, extract JLPT level tags, and produce 5 separate JSON files (one per proficiency level).

**Implementation Details**:

**Data Source**:
- URL: `ftp://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz` (open license, CC0/public domain)
- File size: ~30MB compressed, ~200MB uncompressed
- Format: XML, well-structured dictionary entries
- Update frequency: Monthly updates available

**Input Processing**:

```javascript
/**
 * Download and parse JMdict XML
 * @param {Object} options - Configuration
 * @param {string} options.outputDir - Directory to write vocab JSON files
 * @param {boolean} options.resume - Skip download if file exists
 * @returns {Promise<Object>} Summary { recordsPerLevel, totalRecords, errors }
 */
async function importJMdict(options)
```

1. **Download**:
   - Check if `JMdict_e.gz` exists locally; if not, download from EDRDG FTP
   - Decompress to temp file using Node's `zlib`
   - Validate: file size > 100MB (sanity check)

2. **XML Parsing**:
   - Use simple streaming XML parser (Node's built-in XML parser or lightweight library like `fast-xml-parser`)
   - Extract `<entry>` elements
   - For each entry, extract:
     - `<ent_seq>` — unique entry ID
     - `<keb>` — kanji spelling (may not exist for kana-only words)
     - `<reb>` — kana reading (hiragana)
     - `<gloss>` array — English meanings
     - `<pos>` — part of speech tag (e.g., "v1", "n", "adj-i")
     - `<ke_inf>` / `<re_inf>` — inflection information (e.g., "oK", "jy")
     - JLPT level: Extract from `<misc>` tags like `<jlpt>3</jlpt>` if present

3. **JLPT Level Assignment**:
   - If `<jlpt>N</jlpt>` tag exists: use that level (values: 1=N1, 2=N2, 3=N3, 4=N4, 5=N5)
   - If tag missing: attempt to infer from word frequency or complexity
     - Look for presence of kanji: kanji-less words are typically N4-N5
     - Common words (in top 1000 of corpus) → N5
     - Otherwise: default to N3
   - Output difficulty mapping: N5→1, N4→2, N3→3, N2→4, N1→5

4. **Output Format**:
   - Create separate file for each level: `vocab-n5.json`, `vocab-n4.json`, `vocab-n3.json`, `vocab-n2.json`, `vocab-n1.json`
   - Each file contains JSON array of vocabulary entries
   - Entry structure:

   ```json
   {
     "id": "jmdict-entry-12345",
     "word": "漢字",
     "reading": "かんじ",
     "meanings": ["kanji", "Chinese character"],
     "partOfSpeech": "noun",
     "jlptLevel": "N3",
     "difficulty": 3,
     "language": "ja",
     "sourceName": "JMdict/EDRDG",
     "sourceUrl": "https://www.edrdg.org/jmdict/j_jmdict.html"
   }
   ```

5. **Quality Checks**:
   - Warn if entry has no kanji/kana (malformed)
   - Warn if entry has no meanings (incomplete)
   - Warn if JLPT level is missing (will use default)
   - Count entries per level; display distribution

6. **Expected Output**:
   - `vocab-n5.json`: ~800 entries
   - `vocab-n4.json`: ~1,500 entries
   - `vocab-n3.json`: ~3,500 entries
   - `vocab-n2.json`: ~5,000 entries
   - `vocab-n1.json`: ~10,000 entries
   - Total: ~20,800 Japanese vocabulary entries

**CLI Interface**:

```bash
node import-jmdict.mjs \
  --output-dir src/data/seed/ \
  [--resume] \
  [--verbose]
```

---

### 2. Wikidata Lexeme Queries for 5 European/Asian Languages

**File(s)**: `scripts/content-pipeline/vocab/import-wikidata-lexemes.mjs`

**Objective**: Query Wikidata Lexeme endpoint (via SPARQL) for vocabulary in Spanish, French, German, Korean, and Mandarin Chinese. Extract lemma, gloss, and part of speech.

**Implementation Details**:

**Data Source**:
- Endpoint: `https://query.wikidata.org/sparql` (free, public)
- License: CC0
- Data: Wikidata Lexemes contain lemmas, glosses, parts of speech

**SPARQL Queries**:

Create separate queries for each language. Example for Spanish:

```sparql
SELECT ?lexeme ?lemma ?gloss ?pos
WHERE {
  ?lexeme wikibase:language "es" .
  ?lexeme wikibase:lexicalCategory ?posItem .
  ?lexeme rdfs:label ?lemma .
  ?lexeme skos:definition ?gloss .
  ?posItem rdfs:label ?pos . FILTER (lang(?pos) = "en")
  FILTER (lang(?lemma) = "es")
}
LIMIT 10000
```

Repeat for language codes: `es` (Spanish), `fr` (French), `de` (German), `ko` (Korean), `zh` (Mandarin).

**Implementation**:

```javascript
/**
 * Query Wikidata Lexemes for a single language
 * @param {string} languageCode - ISO 639-1 code (es, fr, de, ko, zh)
 * @param {Object} options - Configuration
 * @param {string} options.outputDir - Output directory
 * @param {number} options.limit - Max records to fetch (default: 5000)
 * @returns {Promise<Object>} { recordsImported, language, outputFile }
 */
async function queryWikidataLexemes(languageCode, options)
```

1. **SPARQL Query Construction**:
   - Build query dynamically based on language code
   - SPARQL endpoint URL: `https://query.wikidata.org/sparql`
   - Set LIMIT to fetch up to N records (e.g., 5000)
   - Add rate limiting: Wikidata allows ~300 queries/minute; space requests 1 second apart

2. **Response Parsing**:
   - SPARQL returns JSON with bindings array
   - Extract: lemma (word), gloss (English definition), part of speech
   - Handle missing glosses gracefully (some lexemes may lack English translations)

3. **Difficulty Assignment**:
   - No JLPT/CEFR levels directly available from Wikidata
   - Heuristic: Assign difficulty based on word frequency lists (external, if available)
   - If no frequency data: default to difficulty 3 (medium)
   - Note: CEFR mapping happens in step 3

4. **Output Format**:
   - One JSON file per language: `vocab-es.json`, `vocab-fr.json`, `vocab-de.json`, `vocab-ko.json`, `vocab-zh.json`
   - Entry structure:

   ```json
   {
     "id": "wikidata-lexeme-l12345",
     "word": "hola",
     "meanings": ["hello", "hi"],
     "partOfSpeech": "interjection",
     "language": "es",
     "difficulty": 1,
     "sourceName": "Wikidata",
     "sourceUrl": "https://www.wikidata.org/entity/L12345"
   }
   ```

5. **Romanization** (for Korean and Mandarin):
   - Korean: Convert Hangul to Revised Romanization (McCune-Reischauer not necessary; use simpler system)
   - Mandarin: Convert Hanzi to Pinyin (tone marks included)
   - Keep original script in `word` field; add `romanization` field for learners
   - Note: Full romanization conversion requires external library or data; acceptable to use basic mapping or skip if too complex

6. **Expected Output**:
   - Spanish: 3K-5K entries
   - French: 3K-5K entries
   - German: 3K-5K entries
   - Korean: 3K-5K entries
   - Mandarin: 3K-5K entries

**CLI Interface**:

```bash
node import-wikidata-lexemes.mjs \
  --languages es,fr,de,ko,zh \
  --output-dir src/data/seed/ \
  [--limit 5000] \
  [--verbose]
```

---

### 3. CEFR/HSK/TOPIK Level Mapping

**File(s)**: `scripts/content-pipeline/vocab/level-mapper.mjs`

**Objective**: Cross-reference imported vocabulary with known proficiency level lists (CEFR for European languages, HSK for Mandarin, TOPIK for Korean). Add level metadata to vocabulary entries.

**Implementation Details**:

**Open Data Sources**:
- CEFR lists: Available on GitHub (e.g., `5000-most-common-words-CEFR-lists`)
- HSK list: Official HSK vocabulary list (freely available from Chinese government sites or GitHub mirrors)
- TOPIK list: Official TOPIK vocabulary list (freely available from Korean language sites or GitHub mirrors)
- Frequency lists: As fallback if official lists unavailable

**Processing Pipeline**:

```javascript
/**
 * Map vocabulary to proficiency levels
 * @param {string} language - Language code (es, fr, de, ko, zh, ja)
 * @param {Object} options - Configuration
 * @param {string} options.inputFile - Vocab JSON file to enhance
 * @param {string} options.outputFile - Enhanced output file with level fields
 * @param {string} options.levelListDir - Directory containing level list data
 * @returns {Promise<Object>} { entriesProcessed, entriesWithLevel, mappingSource }
 */
async function mapLevels(language, options)
```

1. **CEFR Mapping** (Spanish, French, German):
   - Load CEFR vocabulary list (should have A1-C2 levels)
   - For each vocabulary entry, look up word in list
   - If found: add `cefrLevel` field (values: A1, A2, B1, B2, C1, C2)
   - If not found: assign based on frequency heuristic
     - Top 500 words → A1
     - 500-1500 → A2
     - 1500-3000 → B1
     - 3000-5000 → B2
     - 5000-8000 → C1
     - 8000+ → C2
   - Output adds: `cefrLevel`, `cefrRank` (position in list if found)

2. **HSK Mapping** (Mandarin):
   - Load official HSK vocabulary list (HSK 1-6, ~2500 words total)
   - Levels: HSK 1 (~150 words), HSK 2 (~300), HSK 3 (~600), HSK 4 (~1200), HSK 5 (~2000), HSK 6 (~2500)
   - For each entry: look up word (by Hanzi)
   - If found: add `hskLevel` (1-6)
   - If not found: assign based on frequency or default to level 3
   - Output adds: `hskLevel`, `hskRank`

3. **TOPIK Mapping** (Korean):
   - Load official TOPIK vocabulary list (TOPIK 1-6, ~6000 words total)
   - Levels: TOPIK 1 (~1000 words), TOPIK 2 (~1000), TOPIK 3 (~1500), TOPIK 4 (~1500), TOPIK 5 (~1500), TOPIK 6 (~1500)
   - For each entry: look up word (by Hangul)
   - If found: add `topikLevel` (1-6)
   - If not found: assign based on frequency or default to level 3
   - Output adds: `topikLevel`, `topikRank`

4. **Frequency-Based Fallback**:
   - If official lists unavailable: use word frequency corpus (e.g., from Tatoeba or Leipzig Corpus)
   - Frequency rank → level mapping (as above)
   - Log warning if using fallback

5. **Enhanced Output Format**:

   ```json
   {
     "id": "wikidata-lexeme-es-12345",
     "word": "hola",
     "meanings": ["hello"],
     "language": "es",
     "difficulty": 1,
     "cefrLevel": "A1",
     "cefrRank": 12,
     "sourceName": "Wikidata + CEFR",
     "sourceUrl": "..."
   }
   ```

6. **Quality Checks**:
   - Warn if >10% of entries have no level assignment
   - Display distribution of entries per level

**CLI Interface**:

```bash
node level-mapper.mjs \
  --language es \
  --input src/data/seed/vocab-es.json \
  --output src/data/seed/vocab-es-leveled.json \
  [--level-list-dir data/level-lists/]
```

---

### 4. Tatoeba Example Sentence Matching

**File(s)**: `scripts/content-pipeline/vocab/match-tatoeba.mjs`

**Objective**: Find example sentences containing each vocabulary word from the Tatoeba corpus, with English translations.

**Implementation Details**:

**Data Source**:
- Tatoeba: `https://tatoeba.org/` (CC-BY)
- Available as downloadable database: `sentences.tar.bz2` and `links.tar.bz2`
- Contains millions of sentences in 500+ languages with translations
- License: CC-BY (requires attribution)

**Processing Pipeline**:

```javascript
/**
 * Match vocabulary words to example sentences from Tatoeba
 * @param {string} language - Language code (es, fr, de, ko, zh, ja)
 * @param {Object} options - Configuration
 * @param {string} options.inputFile - Vocab JSON file
 * @param {string} options.outputFile - Enhanced output with examples
 * @param {string} options.tataoebaDir - Directory with extracted Tatoeba data
 * @returns {Promise<Object>} { wordsMatched, sentencesLinked, outputFile }
 */
async function matchTatoeba(language, options)
```

1. **Data Preparation**:
   - Download Tatoeba sentence and link files (one-time setup)
   - Extract: `sentences_${lang}.csv`, `links.csv`
   - Load into memory or create indexed database for fast lookup
   - Tatoeba format: tab-separated (sentence_id, language, text, author)
   - Links: source_sentence_id, target_sentence_id (English translation)

2. **Word Matching**:
   - For each vocabulary entry:
     - Search for sentences containing the word (substring match or word boundary match)
     - Collect up to 3 matching sentences
     - For each sentence, find English translation via `links` file
     - Verify English translation is available (not all sentences have pairs)

3. **Quality Filtering**:
   - Skip sentences with >50 words (too long for learner example)
   - Skip sentences with rare characters or encoding issues
   - Prioritize sentences from professional contributors (if available in metadata)
   - Ensure matched word is not split across multiple parts (word boundary check)

4. **Output Format**:

   ```json
   {
     "id": "wikidata-lexeme-es-hola",
     "word": "hola",
     "exampleSentences": [
       {
         "sentence": "Hola, ¿cómo estás?",
         "translation": "Hello, how are you?",
         "tataoebaId": 12345,
         "author": "User123"
       }
     ],
     "exampleCount": 1,
     "sourceName": "Tatoeba (CC-BY)",
     ...
   }
   ```

5. **Attribution**:
   - Store Tatoeba sentence ID in output
   - Game UI must display: "Example from Tatoeba"
   - Can link to https://tatoeba.org/en/sentences/show/${id}

6. **Expected Coverage**:
   - Target: 50%+ of vocabulary entries have at least 1 example sentence
   - Some obscure words may not have examples; that's okay

**CLI Interface**:

```bash
node match-tatoeba.mjs \
  --language es \
  --input src/data/seed/vocab-es-leveled.json \
  --output src/data/seed/vocab-es-examples.json \
  [--tatoeba-dir data/tatoeba/]
```

---

### 5. Convert Vocabulary to Fact Schema

**File(s)**: `scripts/content-pipeline/vocab/vocab-to-facts.mjs`

**Objective**: Transform vocabulary JSON entries into full Fact schema objects with quiz variants, distractors, and metadata ready for the game.

**Implementation Details**:

**Objective**: Convert vocabulary entries into the game's Fact schema with multiple quiz question variants.

**Processing Pipeline**:

```javascript
/**
 * Convert vocabulary entries to Fact schema
 * @param {string} language - Language code
 * @param {Object} options - Configuration
 * @param {string} options.inputFile - Enhanced vocab JSON file
 * @param {string} options.outputFile - Fact schema JSONL output
 * @returns {Promise<Object>} { factsGenerated, language, outputFile }
 */
async function vocabToFacts(language, options)
```

1. **Quiz Variant Generation**:
   - Generate 4 quiz question variants per vocabulary entry:
     - **Forward**: Show target word (in native script) → select English meaning
       - Example: Q: "What does 'hola' mean?" A: "hello"
     - **Reverse**: Show English meaning → select target word (in native script)
       - Example: Q: "Select the Spanish word for 'hello'" A: "hola"
     - **Fill-Blank**: Show sentence with word blanked → select correct word
       - Example: Q: "'_____ , ¿cómo estás?' means 'Hello, how are you?'" A: "Hola"
       - Only if example sentence available
     - **True/False**: Statement about word or usage → true/false
       - Example: Q: "'Hola' is a Spanish greeting: true or false?" A: "true"

2. **Distractor Generation**:
   - For each question variant, generate 8-10 distractor answers
   - Distractors should be other words from the same language and similar difficulty level
   - Mark difficulty tiers: easy (obvious wrong), medium (plausible wrong), hard (subtle wrong)
   - Examples:
     - Forward variant (word → meaning):
       - Easy: completely unrelated Spanish words ("gato", "perro") translated
       - Medium: related concepts ("goodbye", "thanks")
       - Hard: similar-looking words or false cognates ("bola" meaning "ball")
     - Reverse variant (meaning → word):
       - Easy: words with very different meanings
       - Medium: other common Spanish greetings or polite words
       - Hard: related Spanish words that are less common

3. **Fact Schema Conversion**:

   ```json
   {
     "id": "vocab-es-hola-forward",
     "statement": "The Spanish word 'hola' means hello or hi.",
     "quizQuestion": "What does the Spanish word 'hola' mean?",
     "correctAnswer": "hello",
     "variants": [
       "The Spanish word 'hola' translates to which English word?",
       "Select the English translation of 'hola'",
       "'Hola, ¿cómo estás?' — what is 'hola'?"
     ],
     "distractors": [
       { "text": "goodbye", "difficultyTier": "easy" },
       { "text": "thank you", "difficultyTier": "medium" },
       { "text": "good morning", "difficultyTier": "medium" }
     ],
     "difficulty": 1,
     "funScore": 3,
     "wowFactor": "'Hola' is used for informal greetings in Spanish-speaking countries and is one of the first words Spanish learners master!",
     "visualDescription": null,
     "ageRating": "kid",
     "sourceName": "Wikidata + Tatoeba",
     "sourceUrl": "...",
     "category": ["Language", "Spanish", "Beginner"],
     "contentType": "vocabulary",
     "language": "es",
     "cefrLevel": "A1",
     "tags": ["spanish", "greeting", "beginner", "spoken"]
   }
   ```

4. **Metadata Assignment**:
   - `contentType: "vocabulary"`
   - `language: [language code]`
   - `category: ["Language", "[Language Name]", "[Level Name]"]`
   - Include CEFR/HSK/TOPIK level if available
   - `tags: [language, pos, level, ...]`
   - `funScore`: 3-5 for vocabulary (not as fun as knowledge facts, but educational)
   - `difficulty`: map from CEFR/HSK/TOPIK to 1-5 scale

5. **Output Format**:
   - JSONL (one Fact per line)
   - Filename: `facts-vocab-${language}.jsonl`
   - Total facts per language: ~3 variants per word × 5K words = 15K facts per language

**CLI Interface**:

```bash
node vocab-to-facts.mjs \
  --language es \
  --input src/data/seed/vocab-es-examples.json \
  --output data/generated/facts-vocab-es.jsonl \
  [--variants forward,reverse,blank,truefalse]
```

---

### 6. Language-Themed Visual Descriptions

**File(s)**: Depends on AR-11 Part C completion

**Objective**: Generate or assign visual descriptions for all vocabulary facts using language-specific cultural themes.

**Implementation Details**:

**Processing Pipeline**:

```javascript
/**
 * Generate visual descriptions for vocabulary facts
 * @param {string} language - Language code
 * @param {Object} options - Configuration
 * @param {string} options.inputFile - Facts JSONL file
 * @param {string} options.outputFile - Enhanced facts with visual descriptions
 * @returns {Promise<Object>} { factsEnhanced, outputFile }
 */
async function generateVisualDescriptionsForVocab(language, options)
```

1. **Language-Specific Theming** (from GAME_DESIGN.md §22):
   - **Japanese**: Feudal Japan, torii gates, zen gardens, bamboo groves, cherry blossoms, samurai, Mount Fuji
   - **Spanish**: Mediterranean coast, terracotta plazas, flamenco dancers, paella, bullfighting arenas, Spanish architecture
   - **French**: Belle Époque, cobblestone cafés with small tables, lavender fields, wine bottles, Eiffel Tower silhouettes
   - **German**: Central European villages, Gothic architecture, Black Forest, beer steins, cuckoo clocks, Christmas markets
   - **Korean**: Joseon Dynasty hanok houses, Korean temples, traditional dress (hanbok), Korean food (kimchi, bibimbap), K-pop aesthetics
   - **Mandarin**: Imperial China, wuxia martial arts, misty mountains, dragon motifs, red lanterns, silk, pagodas, tea houses

2. **Visual Description Format**:
   - 20-40 words
   - Include: setting, key cultural objects, colors, art style
   - Example (Spanish word "fiesta"):
     - "Spanish plaza at sunset with lanterns strung overhead, people dancing flamenco, colorful decorative flags, warm orange and red tones, pixel art style, 64x48px"

3. **Template per Language**:
   - Create prompt template for each language (similar to knowledge domain prompts in AR-17)
   - Use Haiku API to generate visual descriptions (brief, since it's just description not full fact generation)
   - Or: Pre-create a set of 20 stock visual descriptions per language and randomly assign to vocabulary facts (simpler, no API cost)

4. **Integration with Visual Gen Pipeline**:
   - Add `--language` flag to visual description generation script
   - Apply cultural theming per language when generating images

---

### 7. Language Selection UI Updates

**File(s)**: Multiple UI components (Svelte/TypeScript)

**Objective**: Update onboarding and settings UI to allow players to select languages and manage vocabulary packs.

**Implementation Details**:

**Files to Create/Edit**:
- `src/ui/LandingScreen.svelte` — onboarding language selection
- `src/ui/SettingsLanguages.svelte` — new language pack management UI
- `src/data/language-config.ts` — language metadata (flags, names, word counts, etc.)

**Onboarding Changes**:

1. **Language Selection Screen** (new screen after age/proficiency onboarding):
   - Title: "Choose a Language to Learn"
   - Display 6 language cards:
     - Card layout: flag icon, language name (English + native name), word count, available levels
     - Example card (Spanish):
       ```
       🇪🇸 Spanish (Español)
       5,420 words
       CEFR A1–C2
       ```
   - Selection: click card to select language (can select multiple for future expansion)
   - UI state: highlight selected language
   - Button: "Start Learning" (moves to first lesson with selected language)

2. **Language Status**:
   - Languages with 0 vocabulary entries show: "Coming Soon" instead of word count
   - Show which languages are fully imported (all 6 target languages should be ready at phase end)

3. **Settings UI** (new tab in Settings page):

   - **Language Packs Management**:
     - Table showing all 6 languages
     - Columns: Flag, Language, Status (✓ Installed, ◯ Available, ✗ Not available), Word Count, Proficiency Levels, Download/Remove Buttons
     - Allow players to download/remove language packs for offline play
   - **Current Language Setting**:
     - Dropdown: select active language for learning
     - Option to learn multiple languages (UI shows which facts/cards are from which language)
   - **Proficiency Level Filter**:
     - Checkboxes per language: A1, A2, B1, B2, C1, C2 (for European languages)
     - Or: N5, N4, N3, N2, N1 (for Japanese)
     - Allow players to filter by level

**Data Structure Changes**:

```typescript
// src/data/language-config.ts
interface Language {
  code: string;          // 'es', 'fr', 'de', 'ko', 'zh', 'ja'
  name: string;          // 'Spanish', 'French', etc.
  nativeName: string;    // 'Español', 'Français', etc.
  flag: string;          // emoji flag '🇪🇸'
  wordCount: number;     // 5420
  levels: Array<{
    code: string;        // 'A1', 'CEFR', 'JLPT', 'HSK', 'TOPIK'
    label: string;       // 'Beginner', 'N5', etc.
    wordCount: number;
  }>;
  sourceUrl: string;     // Link to language Wikipedia or official site
}

export const LANGUAGES: Record<string, Language> = {
  es: { code: 'es', name: 'Spanish', ... },
  fr: { code: 'fr', name: 'French', ... },
  ...
}
```

**Integration with Game State**:
- Store selected language in player profile/settings
- When loading facts, filter by selected language
- Display language tag on fact cards (visual indicator which language is being studied)
- Update quiz UI to show language context (e.g., "Spanish Card" header)

---

## Acceptance Criteria

- Complete JMdict import produces separate JSON files for N5-N1 with correct structure and metadata
- Wikidata queries retrieve 5K+ words per non-Japanese language
- Level mapping produces CEFR/HSK/TOPIK assignments for >90% of imported vocabulary
- Tatoeba matching finds example sentences for >50% of vocabulary entries
- Vocabulary to Fact conversion produces valid JSON with all required fields
- Generated facts have diverse quiz variants (forward, reverse, fill-blank, true/false)
- Distractors are plausible, relevant, and vary in difficulty tier
- All vocabulary sources properly attributed (sourceName and sourceUrl present)
- Language selection UI renders all 6 languages in onboarding
- Settings UI allows managing language packs
- `npm run typecheck` passes
- `npx vitest run` passes

---

## Verification Gate

- [ ] `node import-jmdict.mjs --output-dir src/data/seed/` produces 5 vocab files totaling 20K+ entries
- [ ] `node import-wikidata-lexemes.mjs --languages es,fr,de,ko,zh --output-dir src/data/seed/` produces 5 files with 3K+ entries each
- [ ] `node level-mapper.mjs --language es --input src/data/seed/vocab-es.json --output src/data/seed/vocab-es-leveled.json` adds level fields to 90%+ of entries
- [ ] `node match-tatoeba.mjs --language es` finds example sentences for 50%+ of vocabulary
- [ ] `node vocab-to-facts.mjs --language es --input src/data/seed/vocab-es-examples.json --output data/generated/facts-vocab-es.jsonl` produces valid Fact JSON with 15K+ facts
- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` passes
- [ ] Onboarding includes language selection screen with all 6 languages displayed
- [ ] Settings UI shows language pack management with all languages listed
- [ ] Playwright test: select Spanish in onboarding → facts display Spanish content

---

## Files Affected

**NEW**:
- `scripts/content-pipeline/vocab/import-jmdict.mjs`
- `scripts/content-pipeline/vocab/import-wikidata-lexemes.mjs`
- `scripts/content-pipeline/vocab/level-mapper.mjs`
- `scripts/content-pipeline/vocab/match-tatoeba.mjs`
- `scripts/content-pipeline/vocab/vocab-to-facts.mjs`
- `src/data/seed/vocab-n5.json` (replace existing N3)
- `src/data/seed/vocab-n4.json` (new)
- `src/data/seed/vocab-n2.json` (new)
- `src/data/seed/vocab-n1.json` (new)
- `src/data/seed/vocab-es.json` (new)
- `src/data/seed/vocab-fr.json` (new)
- `src/data/seed/vocab-de.json` (new)
- `src/data/seed/vocab-ko.json` (new)
- `src/data/seed/vocab-zh.json` (new)
- `src/ui/SettingsLanguages.svelte` (new)
- `src/data/language-config.ts` (new)

**EDIT**:
- `src/ui/LandingScreen.svelte` — add language selection screen
- `src/ui/SettingsPage.svelte` — add language management tab
- `src/data/types.ts` — extend Fact schema if needed for language tagging
- `src/data/seed/vocab-n3.json` — replace with fresh import

**Generated (not in version control)**:
- `data/generated/facts-vocab-*.jsonl` — vocabulary fact files

---

## Dependencies & Environment

- **Node.js**: 18+
- **npm packages**: All from AR-17 (batch generation already handles JSON operations)
- **External data sources** (one-time downloads):
  - JMdict XML from EDRDG
  - Tatoeba sentence data
  - CEFR/HSK/TOPIK word lists (publicly available)
- **SPARQL endpoint**: Wikidata (free, rate-limited to ~300 queries/minute)
- **API keys**: None required (all sources are open)

---

## Notes for Implementers

1. **Data Source Reliability**: All sources are community-maintained open data. Quality varies; validate samples before committing to full imports.

2. **Romanization**: Korean and Mandarin romanization is complex. Consider using existing libraries or pre-computed mappings if available.

3. **Frequency-Based Difficulty**: If official level lists are unavailable, use word frequency as proxy. Frequency data is available from multiple sources (Leipzig Corpus, most-common-words lists on GitHub).

4. **Performance**: Loading 30K+ vocabulary entries may impact game performance. Consider lazy-loading or paginating vocabulary facts by language/level.

5. **Licensing Compliance**: All sources are openly licensed, but ensure compliance in game's credits/about section. Display attribution: "Vocabulary data from Wikidata, JMdict, and Tatoeba (CC-BY/CC0)".

6. **Test Workflow**:
   - Test with small imports first (e.g., --limit 100)
   - Validate with 10 sample facts before full run
   - Check output schema before integrating into game

---
