# Fact Generation Pipeline

> **Purpose:** Covers the `Fact` data format, how `facts.db` is built from seed JSON files, how the runtime `factsDB` service provides access, and the high-level content pipeline from research to database.
> **Last verified:** 2026-03-31
> **Source files:** `src/services/factsDB.ts`, `scripts/build-facts-db.mjs`, `src/data/seed/` (~22 JSON files + `facts.db`), `src/data/types.ts`

---

## Fact Data Format

Facts live in the `facts` SQLite table. The TypeScript interface `Fact` (defined in `src/data/types.ts`) maps to these columns:

### Core Identity
| Column | Type | Description |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | Globally unique fact ID |
| `type` | `TEXT NOT NULL` | Content type (`ContentType`) |
| `statement` | `TEXT NOT NULL` | The declarative fact statement |
| `quiz_question` | `TEXT NOT NULL` | Question shown to the player |
| `correct_answer` | `TEXT NOT NULL` | The single canonical correct answer |
| `distractors` | `TEXT NOT NULL` | JSON array of wrong answer strings |

### Metadata
| Column | Type | Description |
|---|---|---|
| `category` | `TEXT NOT NULL` | JSON array of category strings, e.g. `["history","world_wars"]` |
| `category_l1` | `TEXT` | Top-level domain, e.g. `"history"` (authoritative for domain resolution) |
| `category_l2` | `TEXT` | Subcategory, e.g. `"world_wars"` |
| `rarity` | `TEXT NOT NULL` | `Rarity` enum value |
| `difficulty` | `INTEGER NOT NULL` | 1–5 scale |
| `fun_score` | `INTEGER NOT NULL` | 1–10 engagement score |
| `age_rating` | `TEXT NOT NULL` | `'kid'`, `'teen'`, or `'adult'` |

### Supplementary
| Column | Type | Description |
|---|---|---|
| `explanation` | `TEXT NOT NULL` | Post-answer explanation shown to player |
| `wow_factor` | `TEXT` | Engaging hook sentence |
| `mnemonic` | `TEXT` | Pre-generated memory aid |
| `source_name` | `TEXT` | Attribution name |
| `source_url` | `TEXT` | Source URL (must be an actually-verified page) |
| `language` | `TEXT` | Language code for vocabulary facts (e.g. `"ja"`, `"zh"`) |
| `pronunciation` | `TEXT` | Reading or phonetic transcription |
| `example_sentence` | `TEXT` | Contextual usage example |
| `variants` | `TEXT` | JSON array of `QuestionVariant` objects (alternate question formats) |

### Quality / Pipeline Fields
| Column | Type | Default | Description |
|---|---|---|---|
| `status` | `TEXT` | `'approved'` | Pipeline status |
| `source_verified` | `INTEGER` | `0` | Whether source was actually checked |
| `content_volatility` | `TEXT` | `'timeless'` | `'timeless'` or `'volatile'` |
| `sensitivity_level` | `INTEGER` | `0` | 0 = safe, higher = more sensitive |
| `novelty_score` | `INTEGER` | `5` | 1–10 interestingness |

Indexes: `type`, `rarity`, `difficulty`, `age_rating`, `status`, `category_l1`, `db_version`.

---

## Seed Data Files

Source JSON files live in `src/data/seed/`. Each file is an array of `Fact` objects. File naming convention:

| Pattern | Content |
|---|---|
| `knowledge-<domain>.json` | Trivia facts for a canonical domain |
| `vocab-<lang>.json` | Vocabulary facts for a language (e.g. `vocab-ja.json`) |
| `vocab-<lang>-<script>.json` | Script-specific facts (e.g. `vocab-ja-hiragana.json`) |
| `kanji-ja.json` | Japanese kanji facts |
| `tutorial.json` | Fixed tutorial-scenario facts |

Active seed files as of 2026-03-31:
- Knowledge: `geography`, `general_knowledge`, `history`, `natural_sciences`, `space_astronomy`, `mythology_folklore`, `animals_wildlife`, `art_architecture`, `food_cuisine`, `human_body_health`
- Language/vocab: `vocab-ja`, `vocab-ja-hiragana`, `vocab-ja-katakana`, `kanji-ja`, `vocab-ko`, `vocab-ko-hangul`, `vocab-zh`, `vocab-fr`, `vocab-es`, `vocab-nl`, `vocab-de`, `vocab-cs`
- Other: `tutorial`

---

## Database Build (`scripts/build-facts-db.mjs`)

Run: `node scripts/build-facts-db.mjs`

Outputs:
- `public/facts.db` — SQLite binary (sql.js WASM-compatible)
- `public/seed-pack.json` — offline fallback JSON pack

### Build Process
1. Reads all `*.json` files in `src/data/seed/`
2. Creates the `facts` table with the full DDL schema (see above)
3. Upserts each fact object — snake_case columns, JSON-serialized `distractors` and `category` arrays
4. Applies QA filters from `scripts/content-pipeline/qa/shared.mjs`:
   - `isPlaceholderDistractor` — rejects stub/unfilled distractor slots
   - `isGarbageDistractor` — rejects distractors pulled from unrelated DB entries
   - `hasAnswerInQuestion` — flags facts where the correct answer appears in the question text
5. Writes the binary database to `public/facts.db`

The same WASM binary (`node_modules/sql.js/dist/sql-wasm.wasm`) used at build time is served to the browser from `public/sql-wasm.wasm`.

---

## Runtime Access — `factsDB` Service

`src/services/factsDB.ts` exports a singleton `factsDB` (keyed via `Symbol.for('rr:factsDB')` to survive HMR reloads).

### Initialization

```typescript
await factsDB.init()  // call once at startup
```

`init()` does three things in parallel:
1. Lazy-loads the `sql.js` WASM module (deferred ~300 KB from critical path)
2. Fetches `/facts.db` as an `ArrayBuffer`
3. Fetches `/sql-wasm.wasm` URL

Then builds four in-memory indexes for zero-query performance:
- `allFactsCache: Fact[]` — all facts
- `factByIdCache: Map<string, Fact>` — O(1) by ID
- `topCategoryIndex: Map<string, Fact[]>` — by first category string
- `ageRatingIndex: { kid, teen, adult }` — pre-filtered by rating

### Key Query Methods

| Method | Description |
|---|---|
| `getAll()` | All facts |
| `getTriviaFacts()` | All facts excluding `categoryL1 === 'language'` and `type === 'vocabulary'` |
| `getById(id)` | Single fact by ID, O(1) |
| `getByIds(ids[])` | Batch lookup, O(n) |
| `getByType(type)` | Filter by `ContentType` |
| `getByCategory(cats[], limit)` | Shuffled selection from category buckets |
| `getRandom(count)` | Random facts filtered by stored age bracket |
| `getByAgeRating(rating)` | kid / teen / adult age-filtered pools |
| `getMnemonic(factId)` | Fetches mnemonic from DB (not in in-memory cache) |
| `count()` | Total row count via `SELECT COUNT(*)` |
| `getLocalizedFact(factId, locale)` | Joins with `fact_translations` table (Phase 40, gracefully degrades) |
| `getPacedFact(opts)` | SM-2 paced selection: due → struggling → new, with interest weights |

### Age Rating Filtering

Age bracket is stored in `localStorage` under `AGE_BRACKET_KEY` by the AgeGate screen:
- `'under_13'` → `'kid'` pool (only kid-rated facts)
- `'teen'` → `'teen'` pool (kid + teen facts)
- `'adult'` or missing → all facts (no filter)

---

## Content Pipeline Overview

```
Research phase          Architecture phase       Generation phase        QA / DB build
─────────────           ──────────────           ─────────────────       ─────────────
Wikipedia / Wikidata    data/deck-architectures/ Sonnet workers format   scripts/build-facts-db.mjs
lookup & verify    →    *.yaml (verified data) → facts from source   →   upserts into facts.db
source URLs stored      Q-IDs, dates, names      into DeckFact JSON      QA filters applied
```

**Critical rule**: Fact-generation workers MUST receive verified source data in their prompt. Workers format pre-verified data into JSON — they never generate factual claims from LLM training knowledge. See `CLAUDE.md` "Fact Generation Sourcing" for the full enforcement protocol.

### Distractor Generation Rule

Distractors MUST be generated by an LLM that reads the specific question and produces plausible wrong answers. Pulling `correct_answer` values from other DB rows (e.g. `SELECT correct_answer FROM facts WHERE category = ...`) is permanently banned — this produces semantically incoherent garbage. The only permitted DB use for distractors is post-generation validation (checking a generated distractor doesn't accidentally match another fact).

### Supporting Scripts

| Script | Purpose |
|---|---|
| `scripts/build-facts-db.mjs` | Build `public/facts.db` from seed JSON |
| `scripts/ingest-facts.mjs` | Ingest new facts into seed JSON |
| `scripts/lint-facts.mjs` | Run QA lint checks on seed files |
| `scripts/verify-facts.mjs` | Cross-verify facts against source data |
| `scripts/delete-bad-facts.mjs` | Remove flagged low-quality facts |
