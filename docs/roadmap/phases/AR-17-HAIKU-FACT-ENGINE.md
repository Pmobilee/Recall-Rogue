# AR-17: Haiku Fact Engine

Build the pipeline that transforms structured source data (JSON from Wikidata SPARQL, NASA APIs, etc.) into game-ready Fact schema JSON using Claude Haiku API.

## Overview

### Goal
Establish an automated fact generation system using Claude Haiku to transform raw structured data from multiple sources (Wikidata, NASA, Wikipedia dumps, etc.) into complete game-playable Fact objects with quiz questions, variants, distractors, visual prompts, and metadata.

### Dependencies
- **AR-15** (Source Data & Registry) — Fetch scripts must exist and produce structured JSON output in `data/raw/` directory
- Can reference `scripts/content-pipeline/` outputs as input sources
- Does NOT depend on AR-16 (domain definitions) — this phase defines the generation logic independently

### Estimated Complexity
**Large** — involves API integration, batch processing, validation, and error handling. Estimated timeline: 2-3 weeks execution + testing.

### Requirements & Constraints
- **Anthropic API key**: Must have access to `claude-haiku-4-5-20251001` model with sufficient credits
- **Rate limiting**: Must respect API rate limits (compliance with Anthropic's free/paid tier constraints)
- **Cost tracking**: Log all token usage; estimated total cost for generating 100K+ facts across 10 domains: ~$180
- **Offline capability**: Support dry-run and resume modes to enable iterative development without repeated API calls
- **Schema validation**: All output must conform to the Fact schema defined in `src/data/types.ts`

---

## Sub-steps

### 1. Core Haiku API Integration Client

**File(s)**: `scripts/content-pipeline/generate/haiku-client.mjs`

**Objective**: Wrap the Anthropic JavaScript SDK (`@anthropic-ai/sdk`) to provide robust, production-ready fact generation via Claude Haiku.

**Implementation Details**:

Create an ES module that exports the following functions:

```javascript
/**
 * Initialize Haiku client with API key and configuration
 * @param {Object} config - Configuration object
 * @param {string} config.apiKey - Anthropic API key (reads from ANTHROPIC_API_KEY env var if not provided)
 * @param {number} config.rateLimit - Requests per minute (default: 50)
 * @param {number} config.retries - Max retry attempts on failure (default: 3)
 * @param {boolean} config.dryRun - Log requests without making API calls (default: false)
 * @returns {Object} Client instance with methods: generateFact(), trackCost(), getStats()
 */
export function createHaikuClient(config)

/**
 * Generate a single fact from structured input
 * @param {string} systemPrompt - Domain-specific system prompt
 * @param {Object} sourceData - Structured data from source (Wikidata/API JSON)
 * @param {string} domainTag - Domain identifier for categorization
 * @returns {Promise<Object>} Generated Fact object or error object with { error, retryable, code }
 */
async function generateFact(systemPrompt, sourceData, domainTag)

/**
 * Get current cost tracking statistics
 * @returns {Object} { totalInputTokens, totalOutputTokens, estimatedCost, callCount, errorCount }
 */
function getStats()

/**
 * Reset cost tracking for new batch
 */
function resetStats()
```

**Key Features to Implement**:

- **Rate Limiting**:
  - Queue-based request throttling at configurable rate (requests/minute)
  - Use a token bucket algorithm: allow burst up to 2x configured rate, refill at steady rate
  - Emit warnings if queue depth exceeds 100

- **Automatic Retry with Exponential Backoff**:
  - Retry on: rate limit (429), server error (5xx), timeout
  - Do NOT retry on: auth error (401), malformed request (400)
  - Backoff: wait 2^attempt seconds + random jitter (0-1s)
  - Max 3 attempts total

- **Error Categorization**:
  - `RateLimitError`: HTTP 429, message includes retry-after header
  - `AuthenticationError`: HTTP 401, malformed API key
  - `ValidationError`: HTTP 400, malformed request body
  - `ServerError`: HTTP 5xx, temporary server issue
  - `TimeoutError`: Request exceeded 30s timeout
  - `ResponseParseError`: Response body is not valid JSON
  - `SchemaValidationError`: Response JSON doesn't match expected Fact schema
  - Return error objects with `.retryable` flag so caller can decide whether to retry manually

- **Cost Tracking**:
  - Log each request: domain, input tokens, output tokens, estimated cost
  - Track running total: accumulated tokens, running cost estimate
  - Use Claude Haiku pricing: ~$0.80 per 1M input tokens, ~$4.00 per 1M output tokens (as of 2026-02-01)
  - Emit periodic summaries (every 100 calls): "Generated 100 facts, 2.5M tokens, est. cost: $2.50"

- **Dry-Run Mode**:
  - When `dryRun: true`, log the exact request payload but don't make API call
  - Return mock response: `{ success: true, dryRun: true, requestId: "dry-run-${timestamp}" }`
  - Allows testing batch processor logic without consuming API quota

- **Environment Configuration**:
  - Read `ANTHROPIC_API_KEY` from environment if not provided in config
  - Support `HAIKU_RATE_LIMIT`, `HAIKU_RETRIES` env vars for configuration
  - Throw error if API key is not found

**Dependencies to Add**:
- `@anthropic-ai/sdk` (version ^0.24.0 or latest) as devDependency in `package.json`

**Testing Requirements**:
- Unit test: mock API responses, verify retry logic with exponential backoff
- Integration test (optional): single real API call with dry-run mode to verify request format

---

### 2. Domain-Specific System Prompts

**File(s)**: `scripts/content-pipeline/generate/prompts/` (directory structure)

**Objective**: Create 10 reusable system prompts, one per knowledge domain, that guide Haiku to generate diverse, interesting facts with consistent schema compliance.

**Create the following files** in `scripts/content-pipeline/generate/prompts/`:

1. `general-knowledge.txt` — broad facts (astronomy, geography, animals, culture, history)
2. `natural-sciences.txt` — physics, chemistry, biology, geology, ecology
3. `space-astronomy.txt` — planets, stars, black holes, cosmology, spacecraft
4. `geography.txt` — countries, capitals, landmarks, climate zones, borders
5. `history.txt` — dates, events, civilizations, wars, personalities, movements
6. `mythology-folklore.txt` — gods, legends, folktales, cultural stories, symbolism
7. `animals-wildlife.txt` — species facts, behavior, habitats, endangered species, ecosystems
8. `human-body-health.txt` — anatomy, physiology, disease, medicine, nutrition, psychology
9. `food-cuisine.txt` — recipes, ingredients, nutrition, culinary history, food science
10. `art-architecture.txt` — artists, movements, techniques, famous works, architectural styles

**Prompt Template** (each prompt must include all sections below):

```
=== DOMAIN: [Domain Name] ===

# Role
You are an expert fact generator for an educational card game. Your task is to transform
structured data about [domain subject] into engaging, game-ready facts that teach and delight players.

# Input Format
You will receive structured data as JSON. The data contains factual information from
authoritative sources (Wikidata, APIs, etc.) with fields such as:
- name / label
- description
- properties / attributes
- classifications / categories
- links / references

# Output Format
You must generate valid JSON matching this exact structure. DO NOT include any markdown,
code blocks, or explanatory text — output ONLY the JSON object:

{
  "id": "unique-id-generated-from-input",
  "statement": "A single-sentence factual claim summarized from the input",
  "quizQuestion": "A natural, engaging question that tests understanding of the core fact",
  "correctAnswer": "The correct answer to the quiz question (1-3 words)",
  "variants": [
    "Alternate phrasing of the question (forward question variant)",
    "Reverse form: given the answer, ask for the fact (reverse variant)",
    "Fill-in-the-blank: '_____ is the capital of France' (cloze variant)",
    "True/false variant: 'Paris is the capital of France: true or false?'"
  ],
  "distractors": [
    {
      "text": "Paris is the capital of Italy",
      "difficultyTier": "easy"
    },
    {
      "text": "Paris is a city in Spain",
      "difficultyTier": "easy"
    },
    {
      "text": "Paris is the largest city in France by area (factually ambiguous)",
      "difficultyTier": "medium"
    },
    ... (8-25 total distractors)
  ],
  "difficulty": 2,
  "funScore": 7,
  "wowFactor": "Paris has been the capital for over 800 years and remains a global center of art, culture, and influence!",
  "visualDescription": "Medieval stone cathedral with flying buttresses and stained glass windows overlooking a river lined with historic buildings and bridges. Pixel art style, 64x48 resolution.",
  "ageRating": "kid",
  "sourceName": "[source name from input]",
  "sourceUrl": "[URL from input or constructed from source]",
  "category": "[Domain]",
  "contentType": "knowledge",
  "tags": ["tag1", "tag2"]
}

# Guidance for [Domain]

## Domain-Specific Tone & Content
[INSERT DOMAIN-SPECIFIC INSTRUCTIONS HERE - see below]

## Fact Quality Standards
1. **Accuracy**: Facts must be verifiable from authoritative sources. If you detect conflicting information
   in the input, use the most widely accepted version and note in sourceUrl.
2. **Clarity**: The quizQuestion must be unambiguous with a single correct answer. Players should immediately
   understand what is being asked.
3. **Engagement**: Choose facts that surprise, delight, or reveal something unexpected about [domain].
4. **Educational Value**: Facts should teach real knowledge, not trivia for trivia's sake.
5. **Age Appropriateness**: Ensure ageRating matches the fact content.

## Quiz Question Guidelines
- Avoid yes/no questions unless they're part of a true/false variant
- Use action-oriented language ("Which...", "What...", "When...", "How...")
- Make questions specific enough that the answer is unambiguous
- Example formats:
  - What is [thing]? → Answer: [property]
  - [Fact statement] is associated with which [category]? → Answer: [name]
  - In what year did [event] occur? → Answer: [year]

## Distractor Generation
- Generate 8-25 distractors across difficulty tiers:
  - Easy (1-4): obviously wrong, tests basic reading comprehension
  - Medium (5-8): plausible but incorrect, tests shallow knowledge
  - Hard (9+): very plausible, tests deep understanding; often other facts from same domain
- Ensure NO distractor exactly matches the correct answer
- Ensure distractors are relevant to the domain (not nonsensical)
- Example (Geography - capital cities):
  - Easy: "Madrid is the capital of Portugal" (wrong country, obvious)
  - Medium: "Paris is the capital of France" (confusion with similar major cities)
  - Hard: "Lyon is the second-largest city in France" (true but not the capital)

## Difficulty Rating (1-5 scale)
- **1 (Trivial)**: Common knowledge, taught in elementary school, known by >80% of educated population
- **2 (Easy)**: General education, taught in middle school, known by >50% of educated population
- **3 (Medium)**: Requires some specialized interest, known by 20-50% of educated population
- **4 (Hard)**: Significant study required, known by <20% of educated population
- **5 (Expert)**: Very specialized, requires domain expertise, known by <1% of educated population

## Fun Score (1-10 scale)
- **1-2 (Boring)**: Dry facts, already widely known, no surprise
- **3-4 (Okay)**: Correct and educational but not particularly surprising
- **5-6 (Interesting)**: Mildly surprising, "huh, didn't know that"
- **7-8 (Fun)**: Notably surprising or counterintuitive, makes player smile
- **9-10 (Wow!)**: Deeply surprising, mind-bending, "I will tell my friends about this"

Aim for an average funScore of 6-7 across the domain.

## Wow Factor
A brief, enthusiastic restatement of the fact that emphasizes why it's cool. Shown when player answers correctly.
- Length: 1-2 sentences
- Tone: Excited but not hyperbolic
- Include a "why this matters" angle when possible
- Examples:
  - Fact: Octopuses have 3 hearts. Wow: "Two hearts pump blood to the gills, and a third pumps it to the body—talk about redundancy!"
  - Fact: Honey never spoils. Wow: "Archaeologists found 3,000-year-old honey in Egyptian tombs still perfectly edible!"

## Visual Description
Pixel art scene prompt (15-50 words) that illustrates the fact. Will be sent to image generator (SDXL + pixel art LoRA).
- Include: setting, key objects, color palette hints, art style
- For [DOMAIN]: [include domain-specific visual themes]
- Examples:
  - Geography (Paris): "Eiffel Tower silhouette at sunset, lamp-lit cobblestone street below with café awning, watercolor palette, 64x48px"
  - Space (Black Holes): "Swirling accretion disk of orange-red light around a void, star field background, dramatic lighting, 64x48px"

## Age Rating
- **kid** (4-12): Safe, no violence, no complex medical/legal/mature themes
- **teen** (13-17): Can include historical violence, complex topics, mild language
- **adult** (18+): Can include explicit medical facts, historical atrocities, mature themes

Do NOT rate a fact "kid" if it contains medical terminology beyond basic health (e.g., "myocardial infarction" is adult; "heart attack" is teen).

---

## Few-Shot Examples

### Example 1: [Domain Topic]
**Input:**
```json
{
  "name": "Paris",
  "label": "city in France",
  "description": "Capital city of France, largest city in France by population",
  "founded": "3rd century BC",
  "population": 2161000,
  "country": "France"
}
```

**Expected Output:**
```json
{
  "id": "paris-capital-france",
  "statement": "Paris is the capital and largest city of France.",
  "quizQuestion": "What is the capital city of France?",
  "correctAnswer": "Paris",
  "variants": [
    "Which city is the capital of France?",
    "The capital of France is which city?",
    "The capital of France is ___.",
    "Paris is the capital of France: true or false?"
  ],
  "distractors": [
    { "text": "London", "difficultyTier": "easy" },
    { "text": "Berlin", "difficultyTier": "easy" },
    { "text": "Lyon", "difficultyTier": "medium" },
    { "text": "Marseille", "difficultyTier": "medium" },
    { "text": "Nice", "difficultyTier": "hard" }
  ],
  "difficulty": 1,
  "funScore": 4,
  "wowFactor": "Paris has been the capital for over 800 years and is home to over 2 million people!",
  "visualDescription": "Gothic cathedral (Notre-Dame) with flying buttresses overlooking the Seine River lined with historic buildings and bridges, lamp-lit cobblestone streets, impressionist painting style, 64x48px",
  "ageRating": "kid",
  "sourceName": "Wikidata",
  "sourceUrl": "https://www.wikidata.org/wiki/Q90",
  "category": "Geography",
  "contentType": "knowledge",
  "tags": ["geography", "capitals", "europe", "france"]
}
```

### Example 2: [Domain Topic]
[INSERT SECOND EXAMPLE]

---

## What to Do If Input Is Ambiguous or Malformed

- If the input is too vague to extract a clear fact, reject it by returning:
  ```json
  { "error": "insufficient data", "message": "Input does not contain enough detail to generate a fact" }
  ```
- If the input contains contradictory information (e.g., two different founding dates), use the more widely-accepted version and note in sourceUrl which source was prioritized.

# Instructions
1. Read the input data carefully.
2. Extract the core fact (a single, verifiable claim).
3. Generate all fields in the output JSON.
4. Validate: ensure correctAnswer is 1-3 words, difficulty is 1-5, all distractors are different from correctAnswer.
5. Output ONLY valid JSON (no markdown, no explanations).
```

---

**Domain-Specific Instructions** (insert into template above for each prompt):

#### General Knowledge
```
## Domain-Specific Tone & Content
Facts should be broad, covering history, science, culture, and nature. Aim for "cocktail party facts"—
interesting things educated people know. Avoid overlap with specialized domains (don't duplicate facts that
should be in space-astronomy or human-body-health).

Visual themes: libraries, museums, ancient scrolls, diverse cultures, globe maps, light bulbs (ideas)
```

#### Natural Sciences
```
## Domain-Specific Tone & Content
Facts should be precise, emphasizing processes and mechanisms. Acceptable to use technical terminology,
but always explain it simply. Favor counter-intuitive facts (e.g., "sound travels slower than light,"
"ice floats because...").

Visual themes: laboratory equipment, periodic table, atoms, molecules, beakers, test tubes, magnifying glass, microscope
```

#### Space & Astronomy
```
## Domain-Specific Tone & Content
Emphasize scale, wonder, and cosmic perspective. Use awe-inspiring language. Include facts about planets,
moons, stars, black holes, nebulae, and space exploration milestones. Difficulty 5 facts can include
astrophysical concepts (neutron stars, event horizons).

Visual themes: galaxies, nebulae, planets, stars, space telescopes, astronauts, rockets, black holes swirling
```

#### Geography
```
## Domain-Specific Tone & Content
Facts about countries, capitals, landmarks, climate zones, borders, rivers, mountains, and physical features.
Include both well-known and lesser-known geography. Easy difficulty should be major capitals; hard difficulty
can be obscure geopolitical facts.

Visual themes: maps, mountains, oceans, cities, landmarks, deserts, forests, coastlines
```

#### History
```
## Domain-Specific Tone & Content
Facts about historical events, dates, civilizations, wars, figures, and movements. Favor facts that reveal
surprising connections or challenge common misconceptions. Age-rate carefully: violent events should be
"teen" or "adult," not "kid."

Visual themes: ancient ruins, castles, crowns, scrolls, signatures, monuments, historical portraits
```

#### Mythology & Folklore
```
## Domain-Specific Tone & Content
Facts about gods, goddesses, legendary creatures, folktales, cultural stories, and mythological symbolism.
Treat mythological facts as cultural knowledge, not fantasy. Include myths from diverse cultures (not just
Greek/Roman). Wow Factor should emphasize "why this myth matters" or "how it shaped culture."

Visual themes: temples, divine beings, magical creatures, mystical symbols, ancient artwork, constellations
```

#### Animals & Wildlife
```
## Domain-Specific Tone & Content
Facts about species, behavior, habitats, endangered status, and ecological roles. Emphasize surprising behaviors
or adaptations. Include facts about both common and exotic animals. Fun facts should be things that make players
say "I had no idea animals could do that!"

Visual themes: animals in natural habitats, forests, savannas, oceans, jungles, wildlife photography style
```

#### Human Body & Health
```
## Domain-Specific Tone & Content
Facts about anatomy, physiology, medicine, nutrition, disease, psychology, and wellness. Use precise anatomical
terminology but explain it clearly. Avoid graphic depictions of injury. Differentiate difficulty by specialization:
easy = common health knowledge; hard = specialized medical facts.

Visual themes: human silhouettes, organs, healthy food, exercise, medical diagrams, DNA helixes
```

#### Food & Cuisine
```
## Domain-Specific Tone & Content
Facts about recipes, ingredients, nutritional content, culinary history, food science, and cultural cuisines.
Favor surprising facts about common foods or unusual food pairings. Wow Factor can emphasize history
("this ingredient was worth its weight in gold") or science ("this spice has antimicrobial properties").

Visual themes: fresh ingredients, finished dishes, kitchens, farmers markets, spice collections, gardens
```

#### Art & Architecture
```
## Domain-Specific Tone & Content
Facts about artists, art movements, techniques, famous artworks, architectural styles, and design principles.
Include facts from diverse cultures and time periods. Emphasize surprising techniques or hidden meanings
in famous works.

Visual themes: paintings, sculptures, buildings, architecture styles, artist studios, galleries, monuments
```

---

### 3. Batch Processor Script

**File(s)**: `scripts/content-pipeline/generate/batch-generate.mjs`

**Objective**: Read raw source data, invoke Haiku client for each record, validate outputs, write results to file, with support for progress tracking, resumable runs, and error recovery.

**CLI Interface**:

```bash
node scripts/content-pipeline/generate/batch-generate.mjs \
  --input data/raw/geography.json \
  --domain geography \
  --output data/generated/geography.jsonl \
  [--limit N] \
  [--dry-run] \
  [--resume] \
  [--concurrency N] \
  [--batch-size N]
```

**Command-Line Arguments**:
- `--input` (required): Path to raw source JSON file (absolute or relative to project root)
- `--domain` (required): Domain identifier, must match a prompt file in `scripts/content-pipeline/generate/prompts/`
- `--output` (required): Path to output JSONL file (will be created or appended to if `--resume` enabled)
- `--limit` (optional): Process only first N records from input (default: all)
- `--dry-run` (optional): Log requests without making API calls (boolean flag, no value)
- `--resume` (optional): Skip records already in output file (boolean flag, no value)
- `--concurrency` (optional): Number of parallel API calls (default: 5, range: 1-20)
- `--batch-size` (optional): Commit batch to disk every N records (default: 50)

**Implementation Requirements**:

```javascript
/**
 * Main batch generation function
 * @param {Object} options - Command-line parsed options
 * @param {string} options.input - Input file path
 * @param {string} options.domain - Domain identifier
 * @param {string} options.output - Output file path
 * @param {number} options.limit - Max records to process
 * @param {boolean} options.dryRun - Dry-run mode
 * @param {boolean} options.resume - Resume from existing output
 * @param {number} options.concurrency - Parallel request limit
 * @param {number} options.batchSize - Records between disk writes
 * @returns {Promise<Object>} Summary stats { processed, succeeded, failed, skipped, cost }
 */
async function batchGenerate(options)
```

**Processing Pipeline**:

1. **Initialization**:
   - Load domain prompt from `scripts/content-pipeline/generate/prompts/${domain}.txt`
   - Validate: prompt file exists, input file exists, API key is set
   - If `--resume`, read output file and extract already-processed record IDs (assume JSON objects have `id` field)

2. **Input Reading**:
   - Read input JSON file
   - Validate format: array of objects (or single object containing array property)
   - Skip records already in output (if `--resume`)
   - Apply `--limit` to remaining records
   - Log: "Found N records, Y already processed, starting with Z"

3. **Concurrent Processing**:
   - Use Promise.allSettled() or async queue (pq library or simple queue) to maintain `--concurrency` limit
   - For each record:
     a. Call `haikuClient.generateFact(prompt, record, domain)`
     b. Validate response against Fact schema (see step 4 below)
     c. On success: queue for writing, increment success counter
     d. On error: log error, increment error counter, check `.retryable` flag
     e. If retryable and retries < 3: re-queue; otherwise log as permanent error
   - Periodically emit progress:
     - Every 10 records: "Processed 10/100 (10%), 3 errors, ~$0.05 cost"
     - Include ETA based on average time per record

4. **Output Validation**:
   - For each generated fact, validate:
     - All required fields present (see schema in `src/data/types.ts`)
     - `quizQuestion` is non-empty string
     - `correctAnswer` is 1-3 words
     - `difficulty` is integer 1-5
     - `funScore` is integer 1-10
     - `distractors` array has 8-25 entries
     - No distractor text matches `correctAnswer`
     - `ageRating` is one of: "kid", "teen", "adult"
   - If validation fails, log detailed error and add to error report

5. **Batch Writing**:
   - Write to output file in JSONL format (one JSON object per line, no array wrapping)
   - Every `--batch-size` records: flush to disk (do not wait until end to write)
   - This allows resuming mid-batch if process crashes
   - Append mode: if file exists, continue writing (allows `--resume` mode)

6. **Error Handling**:
   - Non-retryable errors: log to `data/generated/errors-${domain}-${timestamp}.json` with:
     - Input record
     - Error message
     - Error code
   - Retryable errors (rate limit, timeout): retry up to 3 times with exponential backoff
   - If concurrency is high and rate limits hit, automatically reduce concurrency and continue
   - If API key is invalid, fail immediately with clear message

7. **Final Summary**:
   - Print summary table:
     ```
     Domain:          geography
     Input records:   12,543
     Already done:    2,100 (--resume mode)
     Processed:       10,443
     Successful:      10,421 (99.8%)
     Failed:          22 (0.2%)
     Cost estimate:   $5.20
     Time elapsed:    2h 15m
     Avg time/rec:    0.77s
     Output file:     data/generated/geography.jsonl (10,421 lines)
     Errors file:     data/generated/errors-geography-2026-03-09-14-23.json (22 records)
     ```

**Example Output File** (`data/generated/geography.jsonl`):
```
{"id":"paris-capital-france","statement":"Paris is the capital of France.","quizQuestion":"What is the capital of France?","correctAnswer":"Paris","difficulty":1,"funScore":6,...}
{"id":"tokyo-capital-japan","statement":"Tokyo is the capital of Japan.","quizQuestion":"What is the capital of Japan?","correctAnswer":"Tokyo","difficulty":1,"funScore":5,...}
{"id":"sahara-desert-africa","statement":"The Sahara is the world's largest hot desert.","quizQuestion":"Which desert is the largest in the world?","correctAnswer":"Sahara","difficulty":2,"funScore":7,...}
```

**Dependencies**:
- `@anthropic-ai/sdk` (already added in step 1)
- Command-line parsing: use Node's built-in `process.argv` or `minimist` package (simple, no extra deps)

---

### 4. Output Validation Script

**File(s)**: `scripts/content-pipeline/generate/validate-output.mjs`

**Objective**: Validate generated JSONL files against schema and quality standards, producing a detailed report and exit code suitable for CI integration.

**CLI Interface**:

```bash
node scripts/content-pipeline/generate/validate-output.mjs \
  --input data/generated/geography.jsonl \
  [--schema-only] \
  [--output report.json] \
  [--strict]
```

**Command-Line Arguments**:
- `--input` (required): JSONL file to validate
- `--schema-only` (optional): Only check schema, skip quality checks (boolean flag)
- `--output` (optional): Write report to JSON file instead of stdout
- `--strict` (optional): Fail on any warning, not just errors (boolean flag)

**Implementation Requirements**:

1. **Schema Validation** (required for all records):
   - Field presence: id, statement, quizQuestion, correctAnswer, difficulty, funScore, ageRating, sourceName, sourceUrl, distractors, category, contentType
   - Type checks:
     - id, statement, quizQuestion, correctAnswer, sourceName, sourceUrl, category: string
     - difficulty, funScore: number
     - distractors: array of objects with `text` (string) and `difficultyTier` (string)
     - ageRating: one of "kid", "teen", "adult"
     - contentType: "knowledge" or "vocabulary"
   - Length validations:
     - correctAnswer: 1-3 words (split on whitespace)
     - quizQuestion: 10-200 characters
     - statement: 10-300 characters
     - Distractor count: minimum 8, maximum 25
   - No duplicate distractors (case-insensitive exact match)
   - No distractor text matches correctAnswer (case-insensitive)

2. **Quality Checks** (warnings, only fail if `--strict`):
   - **Difficulty distribution**:
     - Calculate histogram of difficulty levels 1-5
     - Warn if any single level has >50% of facts
     - Ideal: all 5 levels well-represented
   - **Fun Score distribution**:
     - Calculate mean and std dev
     - Warn if mean < 5 (facts not fun enough)
     - Warn if std dev > 3 (inconsistent quality)
   - **Distractor quality**:
     - Warn if any distractor is exact match for correctAnswer (case-insensitive)
     - Warn if distractors look auto-generated gibberish (length < 5 chars or > 100 chars for any distractor)
   - **Age rating consistency**:
     - Flag facts rated "kid" containing these terms: medical anatomy (myocardial, necrosis, carcinoma), violence terms (war, battle, kill, bomb), mature language
     - Flag "adult" facts that seem trivial (should be at least difficulty 2)
   - **Visual description**:
     - Warn if missing or null
     - Warn if < 15 words or > 50 words
   - **Duplicate detection** (across all facts in file):
     - Fuzzy match quiz questions using Levenshtein distance
     - Warn if two facts have similarity > 0.85 (likely duplicate)
     - Output pairs of suspected duplicates for human review

3. **Error vs Warning Classification**:
   - **Errors** (fail validation): schema violations, malformed JSON, required field missing
   - **Warnings** (fail only if `--strict`): suspicious patterns, quality issues, unlikely but not impossible

4. **Report Output**:

```json
{
  "file": "data/generated/geography.jsonl",
  "timestamp": "2026-03-09T14:30:00Z",
  "summary": {
    "totalRecords": 10421,
    "validRecords": 10398,
    "recordsWithErrors": 23,
    "recordsWithWarnings": 156,
    "passStatus": "PASS" // or "FAIL (X errors, Y warnings)"
  },
  "schemaValidation": {
    "passCount": 10398,
    "failCount": 23,
    "details": [
      {
        "recordId": "sahara-desert",
        "lineNumber": 42,
        "error": "Missing required field: correctAnswer",
        "severity": "error"
      },
      ...
    ]
  },
  "qualityMetrics": {
    "difficultyDistribution": {
      "1": 2104,
      "2": 2089,
      "3": 2084,
      "4": 2072,
      "5": 2072,
      "warning": null
    },
    "funScoreDistribution": {
      "mean": 6.3,
      "stdDev": 1.8,
      "min": 1,
      "max": 10,
      "warning": null
    },
    "ageRatingDistribution": {
      "kid": 3000,
      "teen": 5200,
      "adult": 2221,
      "warnings": []
    },
    "distractorMetrics": {
      "avgCount": 12.4,
      "minCount": 8,
      "maxCount": 25,
      "warnings": [
        "Record 'paris-capital': distractor 'P' too short (1 char)"
      ]
    }
  },
  "duplicateDetection": {
    "suspectedDuplicates": [
      {
        "recordId1": "france-capital",
        "question1": "What is the capital of France?",
        "recordId2": "france-government-seat",
        "question2": "What is the government seat of France?",
        "similarity": 0.91
      }
    ]
  },
  "recommendations": [
    "Consider regenerating facts with difficulty < 2; current distribution favors lower difficulties",
    "Review 5 facts with funScore < 3 for potential regeneration"
  ]
}
```

5. **Exit Codes**:
   - `0`: All checks pass (no errors, no warnings, or only minor warnings)
   - `1`: Schema errors found OR `--strict` and warnings present
   - `2`: Invalid command-line arguments or file I/O errors

**Example Usage**:

```bash
# Validate with strict mode (fail on any warning)
node validate-output.mjs --input data/generated/geography.jsonl --strict --output report.json
if [ $? -ne 0 ]; then
  echo "Validation failed, review report.json"
  exit 1
fi

# Quick schema check before full batch
node validate-output.mjs --input data/generated/geography.jsonl --schema-only
```

---

### 5. Cost Estimation Tool

**File(s)**: `scripts/content-pipeline/generate/estimate-cost.mjs`

**Objective**: Analyze raw source JSON, estimate token usage, and predict API cost before committing to a full batch run.

**CLI Interface**:

```bash
node scripts/content-pipeline/generate/estimate-cost.mjs \
  --input data/raw/geography.json \
  [--domain geography] \
  [--concurrency 5]
```

**Command-Line Arguments**:
- `--input` (required): Raw source JSON file
- `--domain` (optional): Domain ID for prompt selection (inferred from --input filename if not provided)
- `--concurrency` (optional): Parallel request count for time estimate (default: 5)

**Implementation Requirements**:

1. **Token Estimation**:
   - Load domain prompt file (bytes)
   - Sample 10 records from input (or all records if input is small)
   - Estimate prompt tokens: prompt length / 4 (rough estimate: 1 token ≈ 4 characters for English)
   - Estimate typical response size: 2,500 tokens per fact (includes all fields in response)
   - Load input file, count total records
   - Calculate total: (prompt tokens + avg record tokens) × record count

2. **Cost Calculation**:
   - Use current Haiku pricing (as of Feb 2026):
     - Input: $0.80 per 1M tokens
     - Output: $4.00 per 1M tokens
   - Output: total estimated cost

3. **Time Estimate**:
   - Typical API latency: 2-5 seconds per request (assume 3.5s average)
   - Parallel throughput: concurrency × (1 / avg latency) requests/second
   - Total time: total records / throughput
   - Add overhead for batching and disk I/O (~10%)

4. **Report Output**:

```
=== Cost Estimation Report ===
Input file:        data/raw/geography.json
Domain:            geography
Total records:     12,543

Token Estimates:
  Prompt tokens:        2,100 (per request)
  Response tokens:      2,500 (per request avg)
  Total input tokens:   57.6M (12,543 × 2,100 + system)
  Total output tokens:  31.4M (12,543 × 2,500)

Cost Estimate (Haiku pricing):
  Input cost:     $46.08 (57.6M × $0.80/1M)
  Output cost:    $125.60 (31.4M × $4.00/1M)
  Total cost:     $171.68

Time Estimate (concurrency=5):
  API latency:    3.5s per request (avg)
  Throughput:     1.4 req/s (5 parallel)
  Processing time: ~2.5 hours
  (With retries/overhead, expect ~3 hours)

Example command to run:
  node batch-generate.mjs \
    --input data/raw/geography.json \
    --domain geography \
    --output data/generated/geography.jsonl \
    --concurrency 5

To proceed with batch generation, ensure:
  ✓ API key is set (ANTHROPIC_API_KEY)
  ✓ API account has sufficient credits (need at least $172)
  ✓ You have 3+ hours available (includes retries, validation)
```

5. **Implementation Notes**:
   - Sample 10 random records, not first 10 (to avoid bias if first records are unusual)
   - Handle edge cases: input file with <10 records, missing domain prompt file
   - Cache the estimate for 10 minutes (don't re-parse large input files repeatedly)

---

### 6. Sample Generation Tool

**File(s)**: `scripts/content-pipeline/generate/sample.mjs`

**Objective**: Generate a small, human-reviewable sample of facts (10 per domain) to validate prompt quality before committing to a full batch.

**CLI Interface**:

```bash
node scripts/content-pipeline/generate/sample.mjs \
  --domain geography \
  [--count 10] \
  [--output samples/geography-sample.json] \
  [--review]
```

**Command-Line Arguments**:
- `--domain` (required): Domain identifier
- `--count` (optional): Number of sample facts to generate (default: 10)
- `--output` (optional): Output file path (default: stdout)
- `--review` (optional): Open output file in `less` for interactive review (boolean flag)

**Implementation Requirements**:

1. **Source Selection**:
   - Look for `data/raw/${domain}.json`
   - If not found, exit with error message suggesting running fetch script first
   - Load all records from source file

2. **Sampling Strategy**:
   - If source has < 10 records, use all
   - If source has 10-100 records, use random 10
   - If source has 100+ records: select stratified sample:
     - Divide records into 10 percentile buckets by some relevance metric (e.g., record ID, or size if available)
     - Pick 1 record from each bucket (ensures diverse sample)

3. **Generation**:
   - Call `haikuClient.generateFact()` for each sampled record
   - Track cost and time as with batch processor
   - Display progress: "Generating samples... [█████░░░░] 5/10 ($0.12 so far)"

4. **Output Format** (JSON, pretty-printed for human reading):

```json
{
  "domain": "geography",
  "generated": "2026-03-09T14:30:00Z",
  "sampleSize": 10,
  "totalCost": "$0.42",
  "facts": [
    {
      "id": "paris-capital-france",
      "quizQuestion": "What is the capital of France?",
      "correctAnswer": "Paris",
      "difficulty": 1,
      "funScore": 6,
      "wowFactor": "Paris has been the capital for over 800 years and remains a global center of art, culture, and influence!",
      "ageRating": "kid",
      "distractorCount": 12
    },
    ...
  ],
  "reviewCheckList": [
    "[ ] Questions are clear and unambiguous",
    "[ ] Answers are correct (fact-check a few)",
    "[ ] Distractors are plausible but wrong",
    "[ ] Difficulty ratings make sense",
    "[ ] Fun scores feel appropriate",
    "[ ] Visual descriptions are vivid and specific",
    "[ ] Age ratings are appropriate",
    "[ ] No obvious duplicates between facts"
  ]
}
```

5. **Interactive Review** (if `--review` flag):
   - Write JSON to temp file
   - Open in `less` or default pager (`more`)
   - After closing, prompt user:
     ```
     Review complete. Enter your feedback:
     (p) Prompts look good, proceed with full batch
     (r) Regenerate these samples with adjusted prompts
     (q) Quit and adjust manually
     ```
   - Exit with appropriate code (0 = proceed, 1 = user quit)

6. **Example Workflow**:

```bash
# Generate and review samples
node sample.mjs --domain geography --review

# If happy, proceed with full batch
node batch-generate.mjs --input data/raw/geography.json --domain geography --output data/generated/geography.jsonl

# If not happy, edit prompt and retry
nano scripts/content-pipeline/generate/prompts/geography.txt
node sample.mjs --domain geography --review
```

---

## Acceptance Criteria

- Haiku client connects to Anthropic API and generates facts successfully without errors
- All 10 domain-specific prompts are created and produce valid Fact schema JSON
- Batch processor successfully handles 100+ records without crashing or losing data
- Validation catches malformed facts (test with intentionally broken data; manually introduce errors into sample output and verify detection)
- Cost estimator produces reasonable estimates (within ±20% of actual costs for small test batches)
- Dry-run mode functions correctly and does not consume API quota
- Resume mode correctly identifies and skips already-processed records
- Generated facts exhibit diverse difficulty distribution (all 5 levels represented; no level exceeds 40%)
- Error handling is robust: invalid API keys, rate limits, and network timeouts are handled gracefully
- Sample generation produces human-reviewable output suitable for QA gates

---

## Verification Gate

- [ ] `node sample.mjs --domain geography --count 5` generates 5 valid facts without API errors
- [ ] Run `validate-output.mjs` on sample output — reports 0 schema errors and reasonable quality metrics
- [ ] Run `estimate-cost.mjs --input data/raw/geography.json` outputs cost and time estimates matching expectations
- [ ] `npm run typecheck` passes (if any TypeScript files added)
- [ ] Dry-run test: `node batch-generate.mjs --input data/raw/geography.json --domain geography --output /tmp/test.jsonl --limit 5 --dry-run` completes without API calls
- [ ] Small batch test: `node batch-generate.mjs --input data/raw/geography.json --domain geography --output data/generated/test-geography.jsonl --limit 50` succeeds with <5% error rate
- [ ] Resume test: re-run same batch command above with `--resume` flag; verify it skips the 50 already-processed records
- [ ] Generated sample facts are reviewed by human team — questions make sense, answers are correct, distractors are plausible, visual descriptions are vivid

---

## Files Affected

**NEW**:
- `scripts/content-pipeline/generate/haiku-client.mjs`
- `scripts/content-pipeline/generate/batch-generate.mjs`
- `scripts/content-pipeline/generate/validate-output.mjs`
- `scripts/content-pipeline/generate/estimate-cost.mjs`
- `scripts/content-pipeline/generate/sample.mjs`
- `scripts/content-pipeline/generate/prompts/general-knowledge.txt`
- `scripts/content-pipeline/generate/prompts/natural-sciences.txt`
- `scripts/content-pipeline/generate/prompts/space-astronomy.txt`
- `scripts/content-pipeline/generate/prompts/geography.txt`
- `scripts/content-pipeline/generate/prompts/history.txt`
- `scripts/content-pipeline/generate/prompts/mythology-folklore.txt`
- `scripts/content-pipeline/generate/prompts/animals-wildlife.txt`
- `scripts/content-pipeline/generate/prompts/human-body-health.txt`
- `scripts/content-pipeline/generate/prompts/food-cuisine.txt`
- `scripts/content-pipeline/generate/prompts/art-architecture.txt`

**EDIT**:
- `package.json` — add `@anthropic-ai/sdk` as devDependency

**Generated (not in version control)**:
- `data/generated/*.jsonl` — fact data files (gitignore these)
- `data/generated/errors-*.json` — error reports from failed generations

---

## Dependencies & Environment

- **Node.js**: 18+ (uses top-level await, Promise.allSettled)
- **npm packages**:
  - `@anthropic-ai/sdk` (v0.24.0+) — Anthropic API client
  - Standard library only (fs, path, util) — no other external deps to keep pipeline simple
- **Environment variables**:
  - `ANTHROPIC_API_KEY` — required, must have access to `claude-haiku-4-5-20251001` model
  - `HAIKU_RATE_LIMIT` — optional (default: 50 req/min)
  - `HAIKU_RETRIES` — optional (default: 3)
- **Disk space**: Plan for ~1GB of generated JSONL files for 100K+ facts

---

## Notes for Implementers

1. **Prompt Quality is Critical**: The system prompts are the most important part. Invest time testing them with small samples before running full batches.

2. **Rate Limiting**: Haiku is available via Claude API with standard rate limits. Monitor costs carefully; a 10-domain batch generating 10K facts per domain (~100K facts total) will cost ~$180.

3. **Idempotency**: Always save record IDs in output. Use --resume to re-run on partial failures without wasting API quota.

4. **Testing Workflow**:
   - Test prompts with `sample.mjs` (10-20 facts, ~$0.10)
   - Validate with `validate-output.mjs`
   - Estimate cost with `estimate-cost.mjs`
   - Run full batch with `batch-generate.mjs`

5. **Common Issues**:
   - **"API key not found"**: Set `ANTHROPIC_API_KEY` env var
   - **Rate limit errors**: Reduce `--concurrency` or add delays
   - **Validation failures**: Review prompt, regenerate sample, adjust prompt, retry
   - **Duplicate facts**: Expected; cross-domain dedup happens in AR-19

---
