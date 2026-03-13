---
name: manual-fact-ingest-dedup
description: Autonomous end-to-end content factory. Generates knowledge facts from Wikidata raw data and vocabulary from Anki decks, via Sonnet sub-agents for quality work and Haiku for mechanical transforms. Handles normalization, dedup, and DB rebuild.
---

# manual-fact-ingest-dedup

## Mission
Run the full content pipeline autonomously: raw data → Sonnet-processed facts → universal normalizer → deduplicated DB.

## Non-Negotiable Rules
- **ABSOLUTE: No Anthropic API** — We do NOT have an API key. NEVER write scripts that call `@anthropic-ai/sdk` or any external LLM API. ALL LLM work MUST be done by spawning sub-agents via the Claude Code Agent tool. The `LOCAL_PAID_GENERATION_DISABLED = true` flag in `haiku-client.mjs` must stay true.
- **Model selection**: Use **Sonnet** (`model: "sonnet"`) for all quality-critical work: fact generation, question writing, distractor generation, category verification, quality assessment. Use **Haiku** (`model: "haiku"`) ONLY for mechanical transforms: format normalization, counting, simple reclassification of clearly-labeled items. Sonnet produces significantly better distractor quality, preserves answer specificity, handles foreign-language diacritics correctly, and generates semantically coherent quiz content.
- Keep every new fact schema-valid.
- Every fact MUST have `_haikuProcessed: true` before DB insertion.
- **`categoryL2` is mandatory for all knowledge facts** (use valid IDs from `src/data/subcategoryTaxonomy.ts` — 74 subcategories across 10 domains). Never use "general", "other", or empty values. After fact generation, run the subcategorization pipeline (see "DB Rebuild" section below).

## Current Database State
- **46,657 facts** in `src/data/seed/facts-generated.json` (46,780 total in DB with seed files)
- **~10,546 knowledge facts** across 10 domains (all with valid `categoryL2` subcategories)
- **~36,234 vocabulary facts** across 8 languages
- **Knowledge domains**: animals_wildlife, general_knowledge, human_body_health, food_cuisine, geography, art_architecture, history, mythology_folklore, natural_sciences, space_astronomy
- **Languages**: ja (13,125), ko (7,686), es (5,575), de (4,778), it (1,924), fr (1,200), nl (1,131), cs (1,049)
- **All 6 Anki decks fully exhausted**: Spanish, Korean, German, Dutch, Czech, Japanese (Full-Japanese-Study-Deck + JMdict)

## Mandatory Sonnet Processing (All Facts)
Every single fact that enters the database MUST be processed by a **Sonnet** agent (`model: "sonnet"`).

### What Sonnet agents must do for each fact:
1. **Assess worth** — Is this fact interesting/educational enough for a quiz game? Reject boring/trivial/too-obscure facts.
2. **Write/rewrite quiz question** — Clear, concise, 10-20 words, ends with ?
3. **Write correct answer** — Short (1-5 words), definitive
4. **Generate 8 plausible distractors** — Same type as correct answer, domain-appropriate. BLOCKLIST (auto-stripped at build time): "Alternative option N", "Unknown option N", "Not applicable", "Invalid answer", "Unrelated concept", "Incorrect claim", "False statement", "Similar concept", "Related term", "Alternative word", "Different word", "Misleading choice", "Incorrect term", "Unrelated option", "Alternative theory", "Related concept", "Other meaning", "Alternative sense", "Another option", "Additional meaning", "Related idea", "Unknown", "Other", "None of the above", "All of the above", "N/A", "...", "", single-character answers, or any generic/placeholder text. The build script (`build-facts-db.mjs`) auto-strips these, but Sonnet agents should never generate them.
5. **Write explanation** — Engaging 1-2 sentences
6. **Generate 2+ variants** — Different question angles (forward, reverse, fill_blank)
7. **Mark as processed** — Set `_haikuProcessed: true`, `_haikuProcessedAt: <ISO date>`

## Knowledge Fact Generation Workflow

### Pipeline
```
1. Read raw Wikidata entries from data/raw/mixed/<domain>.json (preferred) or data/raw/<domain>.json
2. Chunk entries into batches of 40-50 per Sonnet agent
3. Write input chunks to /tmp/<session>/<domain>-input-bNN-M.json
4. Spawn parallel Sonnet agents (5-7 at a time) via Claude Code Agent tool (`model: "sonnet"`)
5. Each agent transforms entries into quiz facts, writes output to /tmp/<session>/<domain>-bNN-output-M.json
6. Collect all output files, run universal normalizer to handle schema variants
7. Append normalized facts to src/data/seed/facts-generated.json
8. Rebuild DB: node scripts/build-facts-db.mjs
```

### Available Raw Data
| Directory | Contents |
|-----------|----------|
| `data/raw/<domain>.json` | Primary Wikidata exports (10 domain files) |
| `data/raw/mixed/<domain>.json` | Enriched/merged exports (preferred, larger) |
| `data/raw/artic-artworks.json` | Art Institute of Chicago API dump |
| `data/raw/gbif-species.json` | GBIF biodiversity species |
| `data/raw/nasa-apod.json` | NASA Astronomy Picture of the Day |
| `data/raw/met-objects.json` | Metropolitan Museum objects |
| `data/raw/world-bank-countries.json` | World Bank country data |
| `data/raw/pubchem-compounds.json` | PubChem chemical compounds |

## Vocabulary Generation Workflow

### Method A: From Anki Decks (preferred for accuracy)
```
1. Extract word lists from .apkg files in data/references/
   - Anki .apkg = ZIP containing SQLite DB (collection.anki2 or collection.anki21)
   - Fields \x1f-separated; typically: field[0]=foreign word, field[1]=English meaning
   - Pre-extracted files in data/extracted/anki-*.json
2. Chunk extracted words into batches of 40-50
3. Spawn Sonnet agents to transform word+meaning pairs into vocab quiz facts
4. Normalize and append to facts-generated.json
5. Rebuild DB
```

**Available Anki Decks**
| File | Language | Entries |
|------|----------|---------|
| `data/references/SPANISH.apkg` | es | 5,000 |
| `data/references/KOREAN.apkg` | ko | 7,627 |
| `data/references/GERMAN.apkg` | de | 4,207 |
| `data/references/DUTCH.apkg` | nl | 1,081 |
| `data/references/CZECH.apkg` | cs | 1,006 |
| `data/references/countries_cities_flags.apkg` | geo | 319 |

**Pre-extracted JSON (ready to use)**
| File | Entries |
|------|---------|
| `data/extracted/anki-spanish.json` | 5,000 |
| `data/extracted/anki-korean-full.json` | 7,627 |
| `data/extracted/anki-german.json` | 4,207 |
| `data/extracted/anki-dutch.json` | 1,081 |
| `data/extracted/anki-czech.json` | 1,006 |
| `data/extracted/anki-geography.json` | 319 |

### Method B: From Training Knowledge (for languages without Anki decks)
```
1. Spawn Sonnet agents with prompt: "Generate 50 [Language] vocabulary quiz facts"
2. Agent generates word+meaning pairs from training knowledge
3. Used for: French (fr), Italian (it), and any future language without Anki source
4. Same normalization and append process
```

## Universal Output Normalizer
Sub-agents independently choose different output schemas. MUST normalize before merging. Known schema variants:

| Variant | correctAnswer field | Distractors field |
|---------|-------------------|-------------------|
| Standard | `correctAnswer: "text"` | `distractors: ["a","b","c"]` |
| Answer field | `answer: "text"` | `distractors: ["a","b","c"]` |
| Options+correct index | `correct: 0, options: [...]` | derived from options |
| Options+correctAnswerIndex | `correctAnswerIndex: 0, options: [...]` | derived from options |
| MCQ options | `mcqOptions: [{text, isCorrect: true/false}]` | derived from mcqOptions |
| Answers array | `answers: [{text, correct: true/false}]` | derived from answers |

**Standard Output Schema**
```json
{
  "correctAnswer": "plain string",
  "distractors": ["plain string", "plain string", ...]
}
```

Always ensure:
- `correctAnswer` is a plain string (not an object)
- `distractors` are plain strings (not objects with `.text`)
- At least 8 distractors (if any facts have <8, spawn Sonnet agents to generate domain-appropriate replacements — see "Distractor Quality Rules")
- `difficulty` is integer 1-5
- `funScore` is integer 1-10
- `category` is an array
- `_haikuProcessed: true` and `_haikuProcessedAt` are set

## DB Rebuild

### Full Pipeline After Fact Generation

After appending new knowledge facts to `src/data/seed/facts-generated.json`:

1. **Backfill subcategories** (keyword-based classification):
   ```bash
   node scripts/content-pipeline/backfill-subcategories.mjs --write --force --min-score=1
   ```

2. **Extract remaining unclassified** (to identify scope):
   ```bash
   node scripts/content-pipeline/extract-unclassified.mjs
   ```

3. **Classify via Sonnet agents** (if unclassified facts remain — use the `/subcategorize` skill)

4. **Apply LLM classifications** (if step 3 was needed):
   ```bash
   node scripts/content-pipeline/apply-llm-classifications.mjs --write
   ```

5. **Rebuild the SQLite database**:
   ```bash
   node scripts/build-facts-db.mjs
   ```

6. **Strip placeholder distractors** (safety net — should be no-ops if Sonnet agents are well-behaved):
   ```bash
   node scripts/content-pipeline/strip-placeholder-distractors.mjs
   ```

7. **Generate missing distractors via Sonnet agents** (NEVER use mine-distractors.mjs — it produces cross-subcategory garbage):
   - If any facts have <8 distractors after step 1, spawn Sonnet agents to generate domain-appropriate distractors
   - See "Distractor Quality Rules — MANDATORY" section below for requirements

8. **Rebuild the SQLite database** (again, to include regenerated distractors):
   ```bash
   node scripts/build-facts-db.mjs
   ```

9. **Verify valid subcategories**:
   ```bash
   node scripts/content-pipeline/count-invalid-l2.mjs
   ```
   Should return **0 invalid facts**. If any remain, re-run the subcategorization pipeline.

### Database Rebuild Details
- `build-facts-db.mjs` reads all `src/data/seed/*.json` files
- Inserts into SQLite via sql.js
- Output: `public/facts.db` + `public/seed-pack.json`
- `normalizeFactShape()` auto-derives missing fields (type, explanation, rarity)

## Fact Schema (DB NOT NULL columns)
Required fields (or auto-derived):
- `id` string (unique)
- `type` string — `"fact"` or `"vocabulary"` (auto-derived from `contentType`)
- `statement` string
- `explanation` string (auto-derived from `wowFactor` or `statement`)
- `quizQuestion` string
- `correctAnswer` string
- `distractors` array (>= 8 recommended, minimum 3; serialized as JSON text in DB)
- `category` string or array (auto-wrapped in array)
- `rarity` string — `"common"|"uncommon"|"rare"|"epic"` (auto-derived from `difficulty`)
- `difficulty` integer 1-5
- `funScore` integer 1-10
- `ageRating` string — `"kid"|"teen"|"adult"`

Recommended:
- `variants` array (>= 2)
- `sourceUrl`, `sourceName` when available
- `tags` array
- `_haikuProcessed: true`, `_haikuProcessedAt: <ISO date>`

## Variant & Answer Quality Rules
1. **Variant coherence** — `correctAnswer` must directly answer the variant's `question`.
2. **No self-answering** — No significant word (5+ chars) from `correctAnswer` may appear in the question.
3. **Distractor format match** — Distractors must be the same type as the answer (numbers with numbers, proper nouns with proper nouns).
4. **Variant structure** — `{ question, type, correctAnswer, distractors }` (NEVER a plain string). Types: `forward`, `reverse`, `context`, `fill_blank`, `negative`.
5. **No parenthetical reveals** — Answers must be concise. Explanations go in the `explanation` field.
6. **Variant-specific distractors** — Each variant SHOULD have its own tailored `distractors` array (3 minimum).

## Distractor Quality Rules — MANDATORY

**CRITICAL: NEVER generate distractors from database pools**

Distractors (wrong answers for quiz questions) must NEVER be pulled from `correct_answer` values of other facts in the same domain/subcategory. This approach produces semantically nonsensical garbage — a bird species name as a distractor for a bird behavior question, a random capital for a flag question, etc. On March 12, 2026 we had to strip 58,359 garbage distractors produced this way.

**MANDATORY:** ALL distractors MUST be generated by an LLM (Sonnet agent) that reads the specific question, understands what's being asked, and produces plausible wrong answers that:
- Are semantically coherent with what the question asks
- Match the format and length of the correct answer
- Are factually WRONG but plausible to a student
- Come from the LLM's world knowledge, NOT from database queries

The ONLY permitted use of DB queries for distractors is POST-GENERATION VALIDATION — checking that a generated distractor doesn't accidentally match another fact's correct answer.

Scripts like `mine-distractors.mjs` or any `SELECT correct_answer FROM facts WHERE category = ...` approach for distractor generation are PERMANENTLY BANNED.

---

These rules exist because past Haiku workers generated thousands of garbage distractors that made the game trivially easy. Over 7,000 facts had to be fixed. Do NOT repeat these mistakes.

### What Makes a Good Distractor
- **Domain-appropriate**: For "What is the capital of France?", distractors should be OTHER capitals (Berlin, Madrid, Rome) — NOT generic words like "concept" or "method"
- **Same type as the answer**: If the answer is a noun, distractors must be nouns. If a number, other numbers. If a person's name, other people's names.
- **Plausible but wrong**: A player who doesn't know the answer should find all options equally plausible
- **Unique per fact**: NEVER reuse the same distractor set across multiple facts. Each fact must have individually crafted distractors.

### BANNED Distractor Patterns (auto-stripped + flagged)
These patterns were found in 7,000+ broken facts. Generating ANY of these is a critical failure:

1. **Generic concept words**: "concept", "method", "process", "approach", "practice", "system", "theory", "technique", "aspect", "element", "idea", "item", "action", "condition", "feeling", "object", "quality"
2. **Generic verb fillers**: "to change", "to find", "to know", "to make", "to move", "to be", "to do", "to give", "to go", "to have"
3. **Random English nouns**: "book", "chair", "door", "flower", "house", "tree", "table"
4. **Template German words**: "beispiel", "grund", "kraft", "muster", "raum"
5. **Meta-category phrases**: "a quality or characteristic", "a state or condition", "a type of object or tool", "a concept or idea", "a feeling or emotion", "a location or place"
6. **Template history phrases**: "A military campaign against the Roman Empire", "A religious movement that spread across Asia", etc.
7. **Category labels as distractors**: "vitamin", "hormone", "enzyme", "antibody" (unless the question IS about biochemistry)
8. **The word "alternate meaning 8"** or any numbered placeholder

### Rules for Vocabulary Facts
- Distractors MUST be other real translations from the SAME language
- For "What does [German word] mean?": distractors should be other English meanings of DIFFERENT German words
- NEVER use generic English words ("book", "chair") — use actual translations from the vocabulary pool
- Each vocab fact must have 8 UNIQUE distractors from the same language domain

### Vocabulary Distractor Format Matching — MANDATORY
**CRITICAL anti-pattern-matching rule.** On March 12, 2026 we found 12,527 vocab facts (34.5% of all vocab) where distractors had exploitable format mismatches — players could learn to "always pick the longest option" or "always pick the multi-word phrase."

**The Rule:** Every distractor MUST match the correct answer's format:
1. **Word count match**: If the answer is 3 words, each distractor must be 2-4 words (±1 tolerance). A single-word distractor for a multi-word answer is ALWAYS wrong.
2. **Length match**: Each distractor's character length must be within 50% of the answer's length. "sour" (4 chars) vs "as a matter of course" (21 chars) is ALWAYS wrong.
3. **Style match**: If the answer contains commas/slashes (e.g., "fall, drop, plunge"), distractors must also be comma/slash-separated lists of similar length. If the answer is a single clean word, distractors must be single clean words.
4. **Semantic relatedness**: Distractors must be plausible wrong translations — words from the same semantic field, part of speech, and register. "library" → "judge | receive | establish | gather" is GARBAGE. "library" → "museum | theater | bookstore | archive" is GOOD.
5. **No nonsense templates**: NEVER generate "Xing process", "Act of X", "To X", "X action" style distractors. These are instantly recognizable as machine-generated garbage.

**Examples of BAD vs GOOD:**
| Answer | BAD Distractors | GOOD Distractors |
|--------|----------------|-----------------|
| "as a matter of course" (5 words) | "surprisingly \| regrettably \| accidentally" (1 word each) | "without a doubt \| in any event \| as a general rule" (4-5 words each) |
| "simple and honest" (3 words) | "elaborate \| deceptive \| complex" (1 word each) | "proud and stubborn \| quick and clever \| calm and patient" (3 words each) |
| "sour" (1 word) | "cause \| bad \| weak \| truth" (random words) | "bitter \| sweet \| spicy \| bland" (taste words) |
| "library" (1 word) | "To library \| library action \| Act of library" (nonsense) | "museum \| hospital \| university \| station" (places) |
| "get cold" (2 words) | "knowledge \| hospital room \| small scale" (random) | "get warm \| get lost \| get sick" (same "get X" pattern) |

**Verification after generation:** For every batch of vocab distractors, compute:
- `answerWordCount` = number of words in correctAnswer
- `distWordCount` = number of words in each distractor
- REJECT if any `|distWordCount - answerWordCount| > 1`
- REJECT if any distractor length ratio > 2.0x or < 0.5x vs answer length

### Rules for Knowledge Facts
- Distractors MUST be from the same domain/subcategory as the correct answer
- For animal questions: other animal names. For country questions: other countries. For year questions: other years.
- NEVER reuse the same 5 distractors across an entire batch — craft individual distractors for each fact
- Check: would a smart player be able to eliminate ALL distractors by noticing they're from the wrong category? If yes, they're garbage.

### Answer-in-Question Prevention
- NEVER write a question where the correct answer appears verbatim in the question text
- BAD: "What is Pasta gratin?" → "Pasta gratin" (circular — player just reads the answer from the question)
- BAD: "What was the Fifth Xhosa War?" → "Fifth Xhosa War" (echo question)
- GOOD: "What Italian dish features pasta baked with a crispy cheese topping?" → "Pasta gratin"
- GOOD: "Which 1818–1819 conflict involved Xhosa resistance against colonial expansion?" → "Fifth Xhosa War"
- Exception: Geography capitals where country name ≠ city name are acceptable ("What is the capital of France?" → "Paris")

### Distractor = Answer Prevention
- NEVER include the correct answer as one of the distractors
- After generating distractors, CHECK that none of them match the correct answer (case-insensitive)
- This was found in 583 facts and is a game-breaking bug

### Quality Verification
After generating facts, the build pipeline runs these checks automatically:
- `isPlaceholderDistractor()` — catches template phrases
- `isGarbageDistractor()` — catches reused generic words
- `hasAnswerInQuestion()` — catches answer embedded in question
- Distractor uniqueness check — catches reuse across facts
- Answer-distractor equality check — catches answer in distractor list

Run `node scripts/content-pipeline/fix-fact-quality.mjs --dry-run` to preview issues before committing.

## Known Issues & Fixes

### normalizeFactShape() auto-derivation
Generated facts often lack fields the DB expects. These are auto-derived during promotion:
- **`type`** — defaults to `"fact"`, or `"vocabulary"` if `contentType === 'vocabulary'`
- **`explanation`** — falls back to `wowFactor`, then `statement`
- **`rarity`** — derived from `difficulty`: 1-2 = common, 3 = uncommon, 4 = rare, 5 = epic

### Distractor blocklist enforcement
Invalid distractors are auto-stripped by `build-facts-db.mjs` using the `isPlaceholderDistractor()` regex from `scripts/content-pipeline/qa/shared.mjs`. This catches all placeholder patterns (see full list in shared.mjs). After build, spawn Sonnet agents to generate domain-appropriate replacements for any facts left with <8 distractors.

### Quality gate enforcement
Every fact must have `_haikuProcessed: true` to pass promotion. QA validates:
- Schema validity
- Distractor blocklist
- Dedup check for duplicate `id` and similar `quizQuestion` text

## Post-Ingestion Quality Sweep

After any major DB changes (batch ingestion, migration, format changes), run the full quality sweep:

```bash
# Export all rows as domain-grouped batches
node scripts/content-pipeline/qa/quality-sweep-db.mjs export --db public/facts.db

# Process via Sonnet workers (orchestrator handles batching and parallelism)
# See manifest at data/generated/quality-sweep/manifest.json

# Apply validated results
node scripts/content-pipeline/qa/quality-sweep-db.mjs apply --db public/facts.db

# Verify convergence
node scripts/content-pipeline/qa/quality-sweep-db.mjs verify --db public/facts.db
```

### Known Issue Types to Avoid During Ingestion
These issues were discovered in the March 2026 quality audit of 46,780 facts:
- **Templated vocab prompts** (7,083 found): "What is the X word for Y?" — write natural questions instead
- **Severe distractor length spread** (8,987 found): distractors must match answer format/length
- **Low-context vocab prompts**: "What does X mean?" needs usage context, part of speech, or example
- **Vague questions**: never generate "What does this mean?" without the foreign word in the question
- **Miscategorized facts**: verify category_l1 and category_l2 against `subcategory-taxonomy.mjs`

## Key Files
| File | Role |
|------|------|
| `src/data/seed/facts-generated.json` | Main generated facts file (46,657 facts) |
| `src/data/seed/facts-general-a.json` | Seed facts subset A |
| `src/data/seed/facts-general-b.json` | Seed facts subset B |
| `src/data/seed/facts-general-c.json` | Seed facts subset C |
| `src/data/seed/facts.json` | Hand-curated seed facts |
| `scripts/build-facts-db.mjs` | Builds SQLite DB from seed files |
| `scripts/content-pipeline/backfill-subcategories.mjs` | Keyword-based L2 classification |
| `scripts/content-pipeline/extract-unclassified.mjs` | Extracts unclassified facts for LLM processing |
| `scripts/content-pipeline/apply-llm-classifications.mjs` | Applies LLM classifications back to seed files |
| `scripts/content-pipeline/count-invalid-l2.mjs` | Verifies 0 invalid subcategories |
| `public/facts.db` | Runtime SQLite database |
| `public/seed-pack.json` | Exported seed pack for distribution |
| `data/raw/<domain>.json` | Wikidata raw exports (10 domains) |
| `data/raw/mixed/<domain>.json` | Enriched Wikidata exports (preferred) |
| `data/extracted/anki-*.json` | Pre-extracted Anki word lists |
| `data/references/*.apkg` | Source Anki deck files |
| `src/data/subcategoryTaxonomy.ts` | Domain/subcategory taxonomy IDs (74 subcategories) |
| `scripts/content-pipeline/strip-placeholder-distractors.mjs` | Strips placeholder/garbage distractors from seed file |
| `scripts/content-pipeline/_DEPRECATED_mine-distractors.mjs` | DEPRECATED — use Sonnet agents instead to generate domain-appropriate distractors |
| `scripts/content-pipeline/qa/shared.mjs` | Shared utilities including `isPlaceholderDistractor()` regex |
