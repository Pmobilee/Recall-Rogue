---
name: manual-fact-ingest-dedup
description: Autonomous content pipeline for knowledge facts (10 domains via Sonnet sub-agents) and vocabulary (8 languages via programmatic source pipelines). Handles validation, dedup, and DB rebuild. Canonical spec is at docs/RESEARCH/SOURCES/content-pipeline-spec.md.
---

# ⛔⛔⛔ MANDATORY: AR PHASE DOC REQUIRED ⛔⛔⛔
#
# STOP. DO NOT WRITE CODE. DO NOT DELEGATE TO SUB-AGENTS. DO NOT EDIT FILES.
#
# Before doing ANY work that is not a trivial 2-minute single-line fix:
# 1. Check `docs/roadmap/phases/` and `docs/roadmap/completed/` for the next AR number
# 2. CREATE an AR phase doc: `docs/roadmap/phases/AR-NN-SHORT-NAME.md`
#    - Must contain: Overview, numbered TODO checklist, acceptance criteria, files affected
#    - ⚠️ AR docs MUST be written by the OPUS ORCHESTRATOR DIRECTLY — NEVER by sub-agents
# 3. Present the AR doc to the user for review
# 4. ONLY THEN begin implementation, checking off TODOs as you go
# 5. When done: move the doc to `docs/roadmap/completed/`
#
# NO EXCEPTIONS. "Let me just quickly..." is NOT an exception.
# "It's a small change" with more than 3 steps is NOT an exception.
# Content pipeline batches are NOT an exception.
# Multi-file refactors are NOT an exception.
#
# If you skip this step, the user WILL make you redo the work.
# ⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔

# manual-fact-ingest-dedup

## Mission

Run the full content pipeline autonomously: raw sources → curated entity lists → Sonnet-generated facts / programmatic vocab facts → universal normalizer → validated, deduplicated DB.

**Canonical spec:** `docs/RESEARCH/SOURCES/content-pipeline-spec.md` — this skill is an operational summary. If anything here conflicts with the spec, the spec wins.

**Active roadmap phase:** AR-34 in `docs/roadmap/PROGRESS.md` → [Phase doc](docs/roadmap/phases/AR-34-CONTENT-PIPELINE-SPEC-ALIGNMENT.md). Entity curation pipeline (Stage 2) must be built before any knowledge fact generation.

**Live progress tracking:** `docs/RESEARCH/SOURCES/content-pipeline-progress.md` (per-domain status: generated, target, lastEntityIndex)

**Work tracking:** All content pipeline work must follow the AR-based work tracking skill (`.claude/skills/work-tracking/SKILL.md`). After context compaction, always re-read the active phase doc and this spec.

---

## Non-Negotiable Rules

- **ABSOLUTE: No Anthropic API** — We do NOT have an API key. NEVER write scripts that import `@anthropic-ai/sdk`, call `fetch("https://api.anthropic.com/...")`, or use any external LLM API. ALL LLM work MUST be done by spawning sub-agents via the Claude Code Agent tool. The `LOCAL_PAID_GENERATION_DISABLED = true` flag in `haiku-client.mjs` must stay `true`.

- **Model selection — USER OVERRIDE — MANDATORY:**
  - **Sonnet (`model: "sonnet"`) is required for ALL quality work touching the database** — fact generation, distractor generation, question writing, explanation writing, semantic bin assignment for vocab, quality assessment, subcategorization, and any other work that determines what enters the DB.
  - **Haiku is NOT acceptable for any database content.** Past failures: 7,000+ broken facts, 58,359 garbage distractors, 8,987 severe distractor format mismatches, all traced to Haiku quality being insufficient.
  - **Haiku (`model: "haiku"`) is permitted ONLY for:** automated validation/classification checks, counting, flagging, and format normalization where no creative judgment is involved.
  - The `_haikuProcessed: true` marker is a legacy field name retained for backward compatibility. Sonnet does the actual work — the field just marks that processing occurred.

- **`categoryL2` is mandatory for all knowledge facts.** Use valid IDs from `src/data/subcategoryTaxonomy.ts` (74 subcategories across 10 domains). Never use "general", "other", or empty values. Subcategorization pipeline runs after fact generation.

- **Every fact must be schema-valid** before DB insertion.

- **Distractor pools from the database are PERMANENTLY BANNED.** See "Distractor Quality Rules" section.

- **Domain canonicalization is required.** All `categoryL1` values must use canonical IDs from `src/data/domainMetadata.ts` (e.g., `animals_wildlife`, NOT `"Animals & Wildlife"`). Use `normalizeFactDomain()` from `src/data/card-types.ts` as reference. AR-48 found 189 facts with non-canonical domain names. The universal normalizer must enforce this.

- **Vocab answer length normalization is required (AR-45).** All vocabulary answers must be in the 6-18 character range (p99 <50 chars). Answers >50 chars must be truncated to core meaning. This prevents length-mismatch exploits where players guess by answer length. Runtime distractor selection in `vocabDistractorService.ts` also enforces length-matching.

---

## Current Database State

Database is being rebuilt from scratch per `docs/RESEARCH/SOURCES/content-pipeline-spec.md`. Previous data archived to `data/archived/`.

The progress document at `docs/RESEARCH/SOURCES/content-pipeline-progress.md` tracks per-domain status: `{generated: N, target: 2000, lastEntityIndex: M}`. Consult it before starting any batch to know where to resume.

---

## Mandatory Sonnet Processing (All Knowledge Facts)

Every knowledge fact entering the database MUST be processed by a **Sonnet** agent (`model: "sonnet"`). Vocabulary facts are generated programmatically (see below) — Sonnet handles only their semantic bin assignment.

### What Sonnet agents must do for each knowledge fact:

1. **Assess worth** — Is this fact interesting/educational enough for a quiz game? Reject boring, trivial, or too-obscure facts.
2. **Write quiz question** — Clear, concise, max 15 words, ends with `?`. No self-answering questions.
3. **Write correct answer** — Short, max 5 words / 30 chars, definitive.
4. **Generate 8-12 plausible distractors** — Same type as correct answer, similar length, factually WRONG. See Distractor Quality Rules.
5. **Write explanation** — Engaging 1-3 sentences, adds context. Never circular.
6. **Write visual description** — 20-40 words, vivid mnemonic scene for pixel art cardback.
7. **Generate 4+ variants** — Different question angles: `forward`, `reverse`, `negative`, `truefalse`, `context`, `fill_blank`.
8. **Assign fun score** — Using calibration anchors (see Fun Score section).
9. **Assign age rating** — `kid`, `teen`, or `adult` per rubric (see Age Rating section).
10. **Set metadata** — `sourceName` REQUIRED. `sourceUrl` strongly recommended. Set `_haikuProcessed: true`, `_haikuProcessedAt: <ISO date>`.

---

## Knowledge Fact Generation Workflow

### Pipeline

```
1. Read curated entity list from data/curated/{domain}/entities.json
   (Check progress doc — skip entities marked processed: true)
2. Chunk unprocessed entities into sub-batches of 20-30 per Sonnet agent
3. Write input chunks to /tmp/<session>/<domain>-input-bNN.json
4. Spawn parallel Sonnet agents (5-7 at a time) via Claude Code Agent tool (model: "sonnet")
   Each agent receives: system prompt (quality rules) + entity batch + target subcategory + full output schema
5. Parse returned JSON, run 11 validation gates (see Validation Gates section)
6. On malformed output: retry once with simplified prompt, then flag for review
7. Collect validated output, run universal normalizer to handle schema variants
8. Write normalized facts to data/generated/{domain}/batch-NN.json
9. **PRE-INGESTION QUALITY GATE (AR-51)** — Before QA spot-check, run automated validation:
   - Schema completeness: all 28 fields present and non-null where required
   - Answer length: ≤30 chars (Gate 1)
   - Source attribution: `sourceName` not null (Gate 3)
   - Variant count: ≥4 variants (Gate 4)
   - Answer-in-question: no 5+ char overlap (Gate 5)
   - Distractor quality: no placeholders, no answer duplicates, same type (Gate 9)
   - Fun score: not all clustered at 5-6 (Gate 10)
   - Domain canonicalization: `categoryL1` matches canonical IDs
   Facts failing any hard-reject gate are excluded from the batch. Soft flags are logged for QA review.
10. **MANDATORY QA SPOT-CHECK** — Before merging, orchestrator reads 2-3 random facts per domain and verifies:
   - Schema completeness (all 28 fields present)
   - Question/answer quality (no answer-in-question, no circular explanations)
   - Distractor quality (same type as answer, plausible, not garbage/generic)
   - Correct subcategory assignment
   - Fun score calibration (not all clustered at 5-6)
   Only proceed to step 11 if quality passes. Flag and fix bad domains before merge.
11. Mark processed entities in data/curated/{domain}/entities.json (processed: true)
12. Update progress document (generated count, lastEntityIndex)
13. Promote to src/data/seed/knowledge-{domain}.json
14. Rebuild DB: node scripts/build-facts-db.mjs
```

### Incremental Generation Support

To continue where you left off (e.g., "generate another 1000 per domain"):
1. Read `docs/RESEARCH/SOURCES/content-pipeline-progress.md` — find `lastEntityIndex` per domain
2. Read `data/curated/{domain}/entities.json` — skip entities where `processed: true`
3. Generate next batch of unprocessed entities
4. Update `processed: true` on completed entities
5. Update progress document with new counts and `lastEntityIndex`

### Data Sources (Spec Part 2.3)

**Primary sources (use for entity lists and structured data enrichment):**
- **Wikidata SPARQL** — `https://query.wikidata.org` — filter by `?sitelinks > 20` for notability
- **Wikipedia Vital Articles L4** — 10,000 articles organized by category, extractable via MediaWiki API
- **Museum APIs** (Art domain) — Met Museum (CC0), Art Institute of Chicago (CC0), Rijksmuseum (CC0)
- **NASA APIs** (Space domain) — APOD, NEO, Exoplanets — `https://api.nasa.gov`
- **Nobel Prize API** (History/General) — `https://www.nobelprize.org/about/developer-zone-2/`
- **USDA FoodData Central** (Food domain) — `https://fdc.nal.usda.gov`

**Stage 1 raw data storage:** `data/raw/{source}/`
**Stage 2 curated input:** `data/curated/{domain}/`

### Subcategory Distributions (Mandatory — prevents clustering)

No single subcategory exceeds 18% of its domain's facts. Target distributions per spec section 2.6:
- **History 2,000:** Ancient 14%, Medieval 10%, Renaissance 10%, Colonial 10%, Industrial 8%, WWI 7%, WWII 10%, Cold War 8%, Social/Cultural 14%, Historical Figures 9%
- **Animals 2,000:** Mammals 16%, Birds 12%, Marine 14%, Reptiles 10%, Insects 10%, Behaviors 15%, Endangered 10%, Records 13%
- **Human Body 2,000:** Anatomy 14%, Neuro 14%, Immunity 12%, Cardiovascular 10%, Digestion 12%, Senses 10%, Genetics 12%, Medical Discoveries 8%, Human Records 8%
- **Natural Sciences 2,000:** Physics 18%, Chemistry 16%, Biology 14%, Geology 12%, Ecology 10%, Materials 10%, Discoveries 10%, Math 10%
- **General Knowledge 2,000:** Records 15%, Inventions 15%, Language 12%, Firsts 12%, Economics 10%, Symbols 10%, Calendar 8%, Transport 8%, Oddities 10%
- **Space 2,000:** Planets/Moons 18%, Stars 15%, Missions 15%, Cosmology 12%, Astronauts 12%, Exoplanets 8%, Technology 10%, Records 10%
- **Mythology 2,000:** Greek/Roman 20%, Norse/Celtic 15%, Eastern 15%, Creatures 15%, Creation 10%, Folk 15%, Gods 10%
- **Food 2,000:** History 15%, Asian 15%, European 12%, Americas 10%, Ingredients 12%, Science 10%, Fermentation 10%, Baking 8%, Records 8%
- **Art 2,000:** Painting 18%, Sculpture 12%, Styles 15%, Buildings 15%, Modern 12%, Museums 10%, Movements 10%, Engineering 8%

---

## Vocabulary Generation Workflow

### Design Principle

Vocabulary facts are generated **programmatically** from open-licensed data sources. Questions are templated by code. Distractors are selected at **runtime** by the game client — NOT pre-generated. The `distractors` field ships as `[]`.

Sonnet is NOT involved in question or distractor generation for vocabulary. Sonnet does ONE pass per language: semantic bin assignment (grouping words into ~50 broad bins for runtime distractor selection).

### Vocabulary Sources

| Language | Primary Source | Level Source | Expected Words |
|----------|---------------|-------------|----------------|
| Chinese | `drkameleon/complete-hsk-vocabulary` (MIT) | Built-in HSK levels | 11,092 |
| Japanese | `scriptin/jmdict-simplified` (CC-BY-SA 4.0) | `jamsinclair/open-anki-jlpt-decks` | ~10,000 |
| Spanish | Kaikki.org JSONL | CEFRLex ELELex TSV | ~12,000 |
| French | Kaikki.org JSONL | CEFRLex FLELex TSV | ~10,000 |
| German | Kaikki.org JSONL | CEFRLex DAFlex TSV | ~10,000 |
| Dutch | Kaikki.org JSONL | CEFRLex NT2Lex TSV | ~8,000 |
| Korean | NIKL Dictionary (HuggingFace) | TOPIK PDFs (learning-korean.com) | ~5,500 |
| Czech | Kaikki.org JSONL | `wordfreq` (frequency-inferred) | ~5,000 |

**Stage 1 raw data:** `data/raw/{source}/`
**Stage 2 curated vocab:** `data/curated/vocab/{language}/`
**Stage 3 generated vocab:** `data/generated/vocab/{language}/`

### Runtime Distractor Generation (Game Client)

Vocab facts ship with `distractors: []`. The game client selects distractors at runtime using:
- **Same POS** — nouns distract with nouns, verbs with verbs
- **Similar level** — within ±1 JLPT/HSK/CEFR level
- **Semantic bin proximity** — easy: different bins; medium: same broad bin, different sub-bin; hard: same sub-bin

**Build-time semantic bin assignment** (the ONLY LLM step for vocab): Spawn Sonnet sub-agent workers per language batch — prompt: "Assign each of these words to one of these ~50 semantic categories: [animals, colors, food, body, weather, emotions, ...]". Parse assignments. Store `bin_id` and `sub_bin_id` per word. Target: ~50 broad bins, ~200 sub-bins. Metadata per word is under 300 KB total per language.

### Programmatic Question Types

Generated by code (not LLM):

| Format | Tier | Template | Options |
|--------|------|----------|---------|
| L2→L1 meaning | 1 | "What does '{targetWord}' mean?" | 3 |
| L1→L2 reverse | 2a | "How do you say '{english}' in {language}?" | 4 |
| Reading (CJK) | 1 | "What is the reading of '{kanji}'?" | 3 |
| Fill-blank | 2b | "'{___}' means '{english}' in {language}" | 5 |

Tier 1 = 3 options. Tier 2a = 4 options. Tier 2b = 5 options with close sub-bin distractors.

### European 4-Pack (Spanish/French/German/Dutch)

All four use an identical parameterized script (`build-european-vocab.mjs`):
1. Parse CEFRLex TSV → `Map<lemma+pos, cefrLevel>`
2. Parse Kaikki.org JSONL → `Array<{word, pos, english, ipa}>`
3. Join on lemma + POS → `{targetWord, englishTranslation, pos, cefrLevel, ipa, language}`
4. Write to `data/curated/vocab/{language}/words.json`

**Implementation order:** Chinese (trivial) → European 4-pack (half day, single parameterized script) → Japanese → Korean → Czech.

---

## Output Schema (Knowledge Facts)

Every knowledge fact MUST include all of these fields:

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
  "tags": ["marine", "extreme_animals", "physics_in_nature"],
  "_haikuProcessed": true,
  "_haikuProcessedAt": "2026-03-14T00:00:00.000Z"
}
```

### Fun Score Calibration (must be in Sonnet worker system prompt)

`funScore = round((surprise × 0.4) + (relatability × 0.35) + (narrative × 0.25))`

Anchor examples:
- **1-2:** "Water boils at 100°C", "The atomic number of hydrogen is 1"
- **3-4:** "Tokyo is Japan's capital", "Gold is element 79"
- **5-6:** "The Great Wall is visible from low orbit", "Octopuses have three hearts"
- **7-8:** "Honey never spoils — 3,000-year-old Egyptian honey was still edible", "Wombat poop is cube-shaped"
- **9-10:** "Cleopatra lived closer to the Moon landing than to the Great Pyramid's construction"

Post-hoc check: reject batches where fun score std_dev < 1.5 or >30% cluster on a single integer.

### Age Rating Rubric

| Rating | Label | Criteria |
|--------|-------|----------|
| `kid` | Ages 8+ | No violence, death counts, substances, mature themes. Understandable by a 10-year-old. |
| `teen` | Ages 13+ | Historical violence OK, mild medical content, basic chemistry. No graphic detail. |
| `adult` | Ages 18+ | Detailed medical/pharmacological content, graphic historical events, controversial topics. |

---

## Validation Gates (11 Automated Checks)

| # | Gate | Rule | Action |
|---|------|------|--------|
| 1 | Answer length | `len(answer) ≤ 30 chars` | Hard reject |
| 2 | Schema validation | JSON validates against full schema | Hard reject |
| 3 | Source attribution | `sourceName` is not null/empty | Hard reject |
| 4 | Variant count | `variants.length ≥ 4` | Hard reject, regenerate |
| 5 | Circular detection | Jaccard(question, answer) > 0.5 | Reject |
| 6 | Duplicate detection | Embedding cosine sim > 0.92 vs existing facts | Reject |
| 7 | Classification filter | Regex: `"What (type\|kind\|category) of.*is"` | Reject |
| 8 | Entity validation | Entity name vs Wikidata label fuzzy match ≥ 0.85 | Reject |
| 9 | Distractor quality | All distractors ≠ answer, same entity type, similar length | Reject variant |
| 10 | Fun score distribution | Per-batch std_dev < 1.5 OR >30% in single bucket | Flag batch |
| 11 | Age rating consistency | Content keyword scan matches declared rating | Flag for review |

### Previous Failures Prevented by These Gates

| Previous Failure | Root Cause | Gate |
|------------------|-----------|------|
| "What type of animal is X?" → "bird" | Unconstrained prompt | #7 regex |
| 81% missing source attribution | Optional field | #3 hard reject |
| 76% fun scores at 5-6 | Uncalibrated scoring | Anchor examples + #10 |
| 61% of History was battles | No subcategory quotas | Pre-allocated quotas |
| "X is X" circular explanations | No detection | #5 Jaccard + embedding |
| 0.3% variant coverage | Variants optional | #4 minimum 4 required |
| 3,199 answers > 30 chars | No enforcement | #1 hard reject |

---

## Universal Output Normalizer

Sub-agents independently choose different output schemas. Normalize before merging. Known variants:

| Variant | correctAnswer field | Distractors field |
|---------|-------------------|-------------------|
| Standard | `correctAnswer: "text"` | `distractors: ["a","b","c"]` |
| Answer field | `answer: "text"` | `distractors: ["a","b","c"]` |
| Options+correct index | `correct: 0, options: [...]` | derived from options |
| Options+correctAnswerIndex | `correctAnswerIndex: 0, options: [...]` | derived from options |
| MCQ options | `mcqOptions: [{text, isCorrect: true/false}]` | derived from mcqOptions |
| Answers array | `answers: [{text, correct: true/false}]` | derived from answers |

**Standard output (always normalize to this):**
```json
{
  "correctAnswer": "plain string",
  "distractors": ["plain string", "plain string"]
}
```

Always ensure:
- `correctAnswer` is a plain string (not an object)
- `distractors` are plain strings (not objects with `.text`)
- At least 8 distractors for knowledge facts (if <8 after normalization, spawn Sonnet to generate replacements)
- `difficulty` is integer 1-5
- `funScore` is integer 1-10
- `category` is an array
- `_haikuProcessed: true` and `_haikuProcessedAt` are set

---

## DB Rebuild

### Full Pipeline After Fact Generation

After generating a domain batch and appending to `src/data/seed/knowledge-{domain}.json`:

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

6. **Strip placeholder distractors** (safety net):
   ```bash
   node scripts/content-pipeline/strip-placeholder-distractors.mjs
   ```

7. **Generate missing distractors via Sonnet agents** if any facts have <8 distractors. See Distractor Quality Rules. NEVER use `mine-distractors.mjs`.

8. **Rebuild the SQLite database** (again, to include regenerated distractors):
   ```bash
   node scripts/build-facts-db.mjs
   ```

9. **Verify valid subcategories**:
   ```bash
   node scripts/content-pipeline/count-invalid-l2.mjs
   ```
   Must return **0 invalid facts**. If any remain, re-run subcategorization.

### Database Rebuild Details

- `build-facts-db.mjs` reads all `src/data/seed/*.json` files
- Inserts into SQLite via sql.js
- Output: `public/facts.db` + `public/seed-pack.json`
- `normalizeFactShape()` auto-derives missing fields (type, explanation, rarity)

---

## Distractor Quality Rules — MANDATORY

**CRITICAL: NEVER generate distractors from database pools.**

Distractors must NEVER be pulled from `correct_answer` values of other facts in the same domain/subcategory. On March 12, 2026, 58,359 garbage distractors produced this way were stripped from the database.

**ALL knowledge fact distractors MUST be generated by Sonnet** reading the specific question, understanding what is being asked, and producing plausible wrong answers that:
- Are semantically coherent with what the question asks
- Match the format and length of the correct answer
- Are factually WRONG but plausible to a student
- Come from the LLM's world knowledge, NOT from database queries

The ONLY permitted DB usage for distractors is POST-GENERATION VALIDATION — checking that a generated distractor doesn't accidentally match another fact's correct answer.

Scripts like `mine-distractors.mjs` or any `SELECT correct_answer FROM facts WHERE category = ...` approach are PERMANENTLY BANNED.

### Auto-Stripped Distractor Blocklist

`build-facts-db.mjs` auto-strips these via `isPlaceholderDistractor()` in `scripts/content-pipeline/qa/shared.mjs`. Sonnet agents must NEVER generate them:
"Alternative option N", "Unknown option N", "Not applicable", "Invalid answer", "Unrelated concept", "Incorrect claim", "False statement", "Similar concept", "Related term", "Alternative word", "Different word", "Misleading choice", "Incorrect term", "Unrelated option", "Alternative theory", "Related concept", "Other meaning", "Alternative sense", "Another option", "Additional meaning", "Related idea", "Unknown", "Other", "None of the above", "All of the above", "N/A", "...", single-character answers, empty strings.

### What Makes a Good Distractor

- **Domain-appropriate:** For "What is the capital of France?", distractors should be OTHER capitals (Berlin, Madrid, Rome) — NOT generic words.
- **Same entity type:** If the answer is a noun, distractors must be nouns. If a number, other numbers. If a name, other names.
- **Plausible but wrong:** A player who doesn't know the answer should find all options equally plausible.
- **Unique per fact:** NEVER reuse the same distractor set across multiple facts.

### BANNED Distractor Patterns (Critical Failure if Generated)

1. **Generic concept words:** "concept", "method", "process", "approach", "practice", "system", "theory", "technique", "aspect", "element", "idea", "item", "action", "condition", "feeling", "object", "quality"
2. **Generic verb fillers:** "to change", "to find", "to know", "to make", "to move", "to be", "to do", "to give", "to go", "to have"
3. **Random English nouns:** "book", "chair", "door", "flower", "house", "tree", "table"
4. **Template German words:** "beispiel", "grund", "kraft", "muster", "raum"
5. **Meta-category phrases:** "a quality or characteristic", "a state or condition", "a type of object or tool", "a concept or idea", "a feeling or emotion", "a location or place"
6. **Template history phrases:** "A military campaign against the Roman Empire", "A religious movement that spread across Asia"
7. **Category labels as distractors:** "vitamin", "hormone", "enzyme", "antibody" (unless the question IS about biochemistry)
8. **Numbered placeholders:** "alternate meaning 8" or any numbered placeholder

### Rules for Knowledge Facts

- Distractors MUST be from the same domain/subcategory as the correct answer
- For animal questions: other animal names. For country questions: other countries. For year questions: other years.
- NEVER reuse the same 5 distractors across an entire batch — craft individual distractors for each fact.
- Check: would a smart player eliminate ALL distractors by noticing they're the wrong category? If yes, they're garbage.

---

## Variant & Answer Quality Rules

1. **Variant coherence** — `correctAnswer` must directly answer the variant's `question`.
2. **No self-answering** — No significant word (5+ chars) from `correctAnswer` may appear verbatim in the question.
3. **Distractor format match** — Distractors must be the same type as the answer (numbers with numbers, proper nouns with proper nouns, same approximate length).
4. **Variant structure** — `{ question, type, answer, distractors }` (NEVER a plain string). Types: `forward`, `reverse`, `context`, `fill_blank`, `negative`, `truefalse`.
5. **No parenthetical reveals** — Concise answers only. Explanations go in `explanation`.
6. **Variant-specific distractors** — Each variant SHOULD have its own tailored `distractors` array (3 minimum).

### Answer-in-Question Prevention

- NEVER write a question where the correct answer appears verbatim in the question text.
- BAD: "What is Pasta gratin?" → "Pasta gratin"
- BAD: "What was the Fifth Xhosa War?" → "Fifth Xhosa War"
- GOOD: "What Italian dish features pasta baked with a crispy cheese topping?" → "Pasta gratin"
- GOOD: "Which 1818–1819 conflict involved Xhosa resistance against colonial expansion?" → "Fifth Xhosa War"
- Exception: Geography capitals where country name ≠ city name ("What is the capital of France?" → "Paris" is fine)

### Distractor = Answer Prevention

- NEVER include the correct answer as one of the distractors.
- After generating distractors, CHECK that none match the correct answer (case-insensitive).
- This was found in 583 facts and is a game-breaking bug.

---

## Quality Verification

After generating facts, the build pipeline runs these checks automatically:
- `isPlaceholderDistractor()` — catches template phrases
- `isGarbageDistractor()` — catches reused generic words
- `hasAnswerInQuestion()` — catches answer embedded in question
- Distractor uniqueness check — catches reuse across facts
- Answer-distractor equality check — catches answer in distractor list

Run `node scripts/content-pipeline/fix-fact-quality.mjs --dry-run` to preview issues before committing.

---

## Known Issues & Fixes

### normalizeFactShape() Auto-Derivation

Generated facts often lack fields the DB expects. These are auto-derived during promotion:
- **`type`** — defaults to `"fact"`, or `"vocabulary"` if `contentType === 'vocabulary'`
- **`explanation`** — falls back to `wowFactor`, then `statement`
- **`rarity`** — derived from `difficulty`: 1-2 = common, 3 = uncommon, 4 = rare, 5 = epic

### Distractor Blocklist Enforcement

Invalid distractors are auto-stripped by `build-facts-db.mjs` using `isPlaceholderDistractor()` from `scripts/content-pipeline/qa/shared.mjs`. After build, spawn Sonnet agents to generate domain-appropriate replacements for any facts left with <8 distractors.

### Quality Gate Enforcement

Every fact must have `_haikuProcessed: true` to pass promotion. QA validates schema, distractor blocklist, and dedup check for duplicate `id` and similar `quizQuestion` text.

### Known Ingestion Issues to Avoid

These were found in the March 2026 quality audit:
- **Templated vocab prompts** (7,083 found): "What is the X word for Y?" — write natural questions instead
- **Severe distractor length spread** (8,987 found): distractors must match answer format/length
- **Low-context vocab prompts**: "What does X mean?" needs usage context, POS, or example
- **Vague questions**: never generate "What does this mean?" without the foreign word in the question
- **Miscategorized facts**: verify `category_l1` and `category_l2` against `subcategory-taxonomy.mjs`

---

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

---

## Directory Structure (Six-Stage Pipeline)

```
STAGE 1 — RAW DATA
  data/raw/{source}/              — Wikidata dumps, dictionary files, museum APIs, CEFRLex TSVs, Kaikki.org JSONLs, HSK JSONs

STAGE 2 — CURATED INPUT
  data/curated/{domain}/          — Curated entity lists (entities.json with processed: true/false per entity)
  data/curated/vocab/{language}/  — Parsed + joined vocab (words.json per language)

STAGE 3 — GENERATED FACTS
  data/generated/{domain}/        — Sonnet-generated knowledge facts (batch-NN.json)
  data/generated/vocab/{language}/— Programmatically generated vocab facts
  data/generated/qa-reports/      — Validation gate logs

STAGE 4 — VALIDATION
  (automated — 11 gates)

STAGE 5 — QA REVIEW
  (human review of 5-10% of generated facts)

STAGE 6 — PRODUCTION
  src/data/seed/knowledge-{domain}.json   — Per-domain seed files
  src/data/seed/vocab-{language}.json     — Per-language vocab seed files
  public/facts.db                          — Runtime SQLite database
  public/seed-pack.json                    — Exported seed pack
```

---

## Key Files

| File | Role |
|------|------|
| `docs/RESEARCH/SOURCES/content-pipeline-spec.md` | Canonical spec — authority over this skill |
| `docs/RESEARCH/SOURCES/content-pipeline-progress.md` | Live per-domain progress tracking |
| `src/data/seed/knowledge-{domain}.json` | Per-domain generated knowledge facts |
| `src/data/seed/vocab-{language}.json` | Per-language vocabulary facts |
| `src/data/seed/facts.json` | Hand-curated seed facts |
| `src/data/subcategoryTaxonomy.ts` | Domain/subcategory taxonomy IDs (74 subcategories) |
| `scripts/build-facts-db.mjs` | Builds SQLite DB from all seed files |
| `scripts/content-pipeline/backfill-subcategories.mjs` | Keyword-based L2 classification |
| `scripts/content-pipeline/extract-unclassified.mjs` | Extracts unclassified facts for LLM processing |
| `scripts/content-pipeline/apply-llm-classifications.mjs` | Applies LLM classifications back to seed files |
| `scripts/content-pipeline/count-invalid-l2.mjs` | Verifies 0 invalid subcategories |
| `scripts/content-pipeline/strip-placeholder-distractors.mjs` | Strips placeholder/garbage distractors |
| `scripts/content-pipeline/_DEPRECATED_mine-distractors.mjs` | DEPRECATED — BANNED — never use |
| `scripts/content-pipeline/qa/shared.mjs` | Shared utilities including `isPlaceholderDistractor()` |
| `scripts/content-pipeline/fix-fact-quality.mjs` | Preview quality issues before committing |
| `public/facts.db` | Runtime SQLite database |
| `public/seed-pack.json` | Exported seed pack for distribution |
| `data/raw/{source}/` | Stage 1: raw data downloads |
| `data/curated/{domain}/` | Stage 2: curated entity lists |
| `data/curated/vocab/{language}/` | Stage 2: parsed vocab per language |
| `data/generated/{domain}/` | Stage 3: Sonnet-generated fact batches |
| `data/generated/vocab/{language}/` | Stage 3: programmatic vocab batches |
| `data/archived/` | Previous database content (archived) |

---

## Canonical References & Lessons Learned

- **Pipeline spec:** `docs/RESEARCH/SOURCES/content-pipeline-spec.md` — authority over this skill
- **AR-34:** Content pipeline spec alignment — established 6-stage pipeline and 11 validation gates
- **AR-45:** Vocab answer length normalization — prevents length-matching exploits (4→127 char range → 6-18 range)
- **AR-48:** Domain canonicalization — 189 facts with non-canonical domain names, variant field normalization
- **AR-51:** Pre-ingestion quality gate — 8.2% failure rate on full DB scan, added automated gate before promotion
- **AR-52:** Distractor backlog cleanup — 76 knowledge facts + 8,992 legacy vocab distractors stripped
- **AR-53:** Fact repetition & FSRS audit — pool size 120→200, cooldown min 3→5, floor-based cooldown
- **March 12, 2026:** 58,359 garbage distractors stripped from DB (generated via banned pool method)
- **March 15-16, 2026:** Quality gate implementation and backlog cleanup completed
