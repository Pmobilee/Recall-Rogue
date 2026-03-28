# Japanese N3 Grammar Deck — Provenance Documentation

**Deck ID**: `japanese_n3_grammar`
**Created**: 2026-03-28
**Facts**: 670 fill-in-the-blank grammar facts
**Grammar Points**: 200 (142 core N3 + 58 additional mapped to N3)

---

## 1. Sources

### Primary: Full Japanese Study Deck (FJSD)
- **URL**: https://github.com/Ronokof/Full-Japanese-Study-Deck
- **License**: CC BY-SA 4.0
- **Commercial use**: Yes, with attribution and share-alike
- **What was taken**:
  - 200 JLPT N3 grammar point definitions (point, meaning, readings, usages)
  - 779 example sentences with Japanese text and English translations
  - Source URLs to takoboto.jp for each grammar point
- **Files**:
  - `data/references/full-japanese-study-deck/results/grammar/json/grammar_n3.json` (142 points)
  - `data/references/full-japanese-study-deck/results/grammar/json/grammar_additional.json` (58 points)

### Secondary: Tatoeba / Tanaka Corpus
- **URL**: https://tatoeba.org/
- **License**: CC-BY 2.0 (sentences), CC-BY-SA 3.0 (Tanaka Corpus base)
- **Commercial use**: Yes, with attribution
- **What was taken**: The FJSD example sentences are derived from Tatoeba/Tanaka Corpus (as confirmed by takoboto.jp's attribution)
- **Note**: No additional Tatoeba sentences were fetched in this build; all sentences come via FJSD

### Reference: JMdict/EDICT
- **URL**: https://www.edrdg.org/jmdict/j_jmdict.html
- **License**: CC BY-SA 4.0 (EDRDG)
- **Commercial use**: Yes, with attribution
- **What was taken**: Referenced for vocabulary level validation (not directly included in deck data)

---

## 2. Pipeline Steps

### Step 1: Grammar Point Inventory
- **Input**: `grammar_n3.json` (142 points), `grammar_additional.json` (58 points)
- **Process**: Merged into unified list of 200 grammar points with deduplication handling for points appearing in both files
- **Output**: 200 unique grammar points with metadata

### Step 2: Confusion Group Categorization
- **Input**: 200 grammar points (meanings, usages, readings)
- **Process**: Sonnet sub-agent categorized each grammar point into:
  - 1+ syntactic slots (9 slot types: particle_post_noun, clause_connector, te_form_auxiliary, verb_suffix, sentence_ender, adverbial, conditional, copula_form, particle_post_verb)
  - 1+ confusion groups (40 groups covering semantically confusable grammar patterns)
- **Output**: `data/raw/japanese/grammar-n3-confusion-groups.json`
  - 200 grammar point entries, all with slots and groups assigned
  - 40 confusion groups with pedagogical notes
  - 11 te-form conjugation table entries (past, polite, negative, past_negative)
  - 5 synonym groups

### Step 3: Fill-Blank Extraction
- **Input**: 200 grammar points × 779 sentences + confusion groups
- **Process**: Script `scripts/content-pipeline/vocab/build-grammar-fill-blanks.mjs`
  - For each sentence, located the grammar point in the `originalPhrase` (clean text)
  - Three-strategy matching: direct indexOf → te-form pattern matching → partial compound matching
  - Replaced grammar point with `{___}` to create blanked sentence
  - Recorded exact blank answer text
- **Output**: 670 fill-blank facts (109 sentences skipped — grammar point not locatable)
- **Skipped**: 20 grammar points had 0 extractable sentences

### Step 4: Distractor Generation
- **Input**: 670 fill-blank facts + confusion groups
- **Process**: Same script, Phase 2
  - Priority 1: 3-4 distractors from same confusion group (hard)
  - Priority 2: 3-4 from same syntactic slot, different group (medium)
  - Priority 3: 1-2 from broader pool (easy)
  - Deterministic shuffle seeded by fact index
- **Output**: 10 distractors per fact, 100% coverage
- **Validation**: 0 facts have a distractor matching the correct answer

### Step 5: CuratedDeck Assembly
- **Input**: 670 facts + confusion groups + synonym groups
- **Process**: Same script, Phase 3
  - Wrapped in CuratedDeck envelope with answerTypePools, synonymGroups, questionTemplates, difficultyTiers
  - 10 answer type pools (1 grammar_all + 9 per-slot)
  - Difficulty assignment based on phrase count and grammar complexity
- **Output**: `data/decks/japanese_n3_grammar.json`

### Step 6: Registration
- Added `"japanese_n3_grammar.json"` to `data/decks/manifest.json`
- Typecheck: passed (0 new errors)
- Build: passed
- Unit tests: 2312 passed (4 pre-existing failures unrelated to this deck)

---

## 3. Distractor Generation

### Method: Confusion-Group-Based Selection
Distractors are NOT randomly pulled from a database pool. Instead, each grammar point belongs to 1-2 **confusion groups** — sets of grammar patterns that students commonly confuse. Distractors are drawn from these groups, ensuring they are:
- **Semantically coherent**: All choices fill the same syntactic role
- **Pedagogically meaningful**: They test the exact distinctions students struggle with
- **Not accidentally correct**: Validated against synonym groups

### Confusion Groups Used (40 total)
Key groups include:
- **Degree particles**: さえ, しか, こそ, くらい, ばかり
- **Hearsay/conjecture**: そう, らしい, よう, みたい, だろう
- **Te-form auxiliaries**: ている, てしまう, ておく, てある, てみる, てくる
- **Purpose/intent**: ために, ように, ことにする, ようになる
- **Cause/reason**: おかげで, せいで, ものだから, なぜなら
- **Topic/reference**: について, に対して, にとって, として

### Conjugation Table
For te-form auxiliaries, a static conjugation table maps 11 auxiliary verbs × 4 forms (past, polite, negative, past_negative) = 44 conjugated distractor forms.

### Known Limitation
Te-form auxiliary blanks sometimes extract only the stem portion (e.g., "くれ" from くれる) while distractors use full dictionary forms. This affects ~38 facts (5.7% of deck). To be improved in a future pass.

---

## 4. Fact Verification

### Method
- All sentences are directly sourced from FJSD reference data (Tatoeba/Tanaka Corpus origin)
- No sentences were LLM-generated
- Grammar point definitions verified against takoboto.jp source URLs
- Fill-blank extraction validated: the removed text genuinely represents the grammar point

### Known Limitations
- 20 grammar points (10%) have 0 extractable sentences — their patterns couldn't be located programmatically in any of their example sentences
- 109 individual sentences (14% of 779) were skipped due to grammar point not being locatable
- Sentence vocabulary not yet validated for N3-appropriateness (some sentences may contain N2+ vocabulary)

---

## 5. Quality Assurance

### Automated Checks
- TypeScript typecheck: passed (0 new errors)
- Vite build: passed
- Unit tests: 2312/2316 passed (4 pre-existing failures)
- JSON validation: valid structure, all required DeckFact fields present
- 0 duplicate fact IDs
- 0 facts with empty/short questions
- 100% distractor coverage (all 670 facts have exactly 10 distractors)
- 0 distractor-equals-answer violations

### Distribution
| Pool | Facts |
|------|-------|
| particle_post_noun | 156 |
| sentence_ender | 212 |
| clause_connector | 127 |
| adverbial | 113 |
| te_form_auxiliary | 38 |
| verb_suffix | 37 |
| particle_post_verb | 30 |
| copula_form | 22 |
| conditional | 20 |

---

## 6. Attribution Requirements

For commercial use, the following attribution is required:

> Grammar data sourced from the Full Japanese Study Deck (CC BY-SA 4.0, github.com/Ronokof/Full-Japanese-Study-Deck). Example sentences derived from Tatoeba (CC-BY 2.0, tatoeba.org) and Tanaka Corpus (CC-BY-SA 3.0). Dictionary data from JMdict/EDICT (CC BY-SA 4.0, EDRDG).

This attribution should appear in:
- In-app credits/about page
- Any documentation referencing the deck's content

**Share-alike obligation**: Because CC BY-SA 4.0 is used, derivative works must be distributed under the same or compatible license.

---

## 7. Reproduction Steps

### Prerequisites
- Node.js 18+
- Repository cloned with FJSD reference data in `data/references/full-japanese-study-deck/`

### Commands
```bash
# Step 1: Verify source data exists
ls data/references/full-japanese-study-deck/results/grammar/json/grammar_n3.json
ls data/raw/japanese/grammar-n3-confusion-groups.json

# Step 2: Run the pipeline (generates deck from source data)
node scripts/content-pipeline/vocab/build-grammar-fill-blanks.mjs

# Step 3: Verify output
node -e "const d=JSON.parse(require('fs').readFileSync('data/decks/japanese_n3_grammar.json'));console.log('Facts:', d.facts.length, 'Pools:', d.answerTypePools.length)"

# Step 4: Run tests
npm run typecheck
npm run build
npx vitest run
```

### Environment
- Built on macOS Darwin 25.3.0
- Node.js (via nvm)
- No external API calls or npm dependencies beyond the existing project
