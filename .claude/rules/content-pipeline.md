# Content Pipeline Rules

## Curriculum-Sourced Scope — For Educational Decks

**For ANY deck where students depend on completeness (medical, language, certifications, exam prep), the SCOPE must come from an authoritative curriculum source — NEVER from LLM compilation.**

Before generating a single fact, you MUST:
1. **Find the canonical curriculum** — a real textbook ToC, official word list, or exam blueprint
2. **Extract the COMPLETE scope from that source** — every chapter, term, learning objective
3. **Cross-reference 2+ sources** to catch gaps
4. **Map deck architecture to the curriculum** — not the other way around

**Why:** On 2026-04-03, Medical Terminology shipped 635 facts scoped from LLM-compiled web search results. It completely missed medical abbreviations (STAT, PRN, BID, NPO) — terms every nursing student uses daily — because no actual curriculum was consulted.

**Examples of correct curriculum sources:**
- Medical terminology → Chabner "Language of Medicine" ToC, NCBI open textbook chapters
- Language vocabulary → Official JLPT/HSK/CEFR/TOPIK word lists (already done correctly)
- Language grammar → Official grammar point lists by level
- Anatomy → Gray's Anatomy chapter structure, A&P course syllabi

**This applies to:** Medical, language, anatomy, certifications, exam prep — any deck where a student would ask "does this cover everything I need to know?"

**This does NOT apply to:** Casual knowledge decks (movies, mythology, history) where completeness means "comprehensive" not "curriculum-aligned."

## Exam-Aligned Deck Standard

**Any deck covering material tested by an official standardized exam MUST align to that exam's official scope document.**

This means:
1. **Find the exam's official Course Description / Syllabus / Scope Document** — the published document that defines what is tested
2. **Use its structure as the deck's architecture** — units, topics, learning objectives map directly to sub-decks and chain themes
3. **Cover every testable concept** — if it's in the exam scope, it must be in the deck
4. **Tag facts with exam metadata** — `examTags` field with exam name and unit/section identifiers
5. **Weight content by exam weighting** — units worth more on the exam get proportionally more facts

**Applicable exam frameworks:**
- **AP exams** (College Board) — use the Course and Exam Description (CED) for each subject
- **JLPT** (Japanese) — already aligned to official N5-N1 word/grammar lists
- **CEFR** (European languages) — already aligned to A1-B2 level descriptors
- **TOPIK** (Korean) — already aligned to official level lists
- **HSK** (Chinese) — already aligned to official HSK 1-6 word lists
- **IB** (International Baccalaureate) — use subject guide and syllabus
- **SAT Subject Tests / SAT** — use College Board published content specifications
- **GCSE / A-Level** (UK) — use exam board specification documents
- **USMLE / NCLEX** (medical) — use published content outlines

**Why:** Official exam scope documents are the ONLY reliable way to ensure completeness. Students using our decks for exam prep need to trust that every testable concept is covered. If we miss topics that appear on the exam, that's a critical failure of our educational product.

**This does NOT apply to:** Casual knowledge decks (movies, mythology, dinosaurs) where no standardized exam exists.

## Distractor Generation — NEVER From Database

**ALL distractors MUST be LLM-generated**, reading the specific question to produce plausible wrong answers.

NEVER pull from `correct_answer` values of other facts. On 2026-03-12, 58,359 garbage distractors had to be stripped. Scripts like `mine-distractors.mjs` are PERMANENTLY BANNED.

Distractors must:
- Be semantically coherent with what the question asks
- Match format and length of correct answer
- Be factually WRONG but plausible
- Come from LLM world knowledge, NOT database queries

DB queries permitted ONLY for post-generation validation.

## Fact Sourcing — ABSOLUTE RULE

### NEVER GENERATE FACTS FROM LLM KNOWLEDGE

Every fact-generation worker MUST receive verified source data IN ITS PROMPT.

**Correct workflow:**
1. Research: Look up facts from Wikipedia/Wikidata, verify dates/numbers/names
2. Architecture: Write verified data into `data/deck-architectures/*.yaml` with source URLs
3. Generation: Workers FORMAT pre-verified data into DeckFact JSON — they do NOT invent content
4. QA: Review every fact against original sources

**Workers MUST NEVER:**
- Generate dates/numbers from training knowledge
- Generate explanations with unverified claims
- Put Wikipedia URLs in sourceUrl without actually consulting that page
- Generate distractors that might accidentally be correct

**Why:** LLMs confidently produce wrong dates/numbers. QA by another LLM has the SAME blind spots. One wrong fact undermines educational trust in the entire product.

## Deck Quality Checklist
- Answer pools ≥5 per question (runtime floor), ≥15 recommended for distractor variety
- Pools with 5-14 members: add syntheticDistractors to reach 15+
- Chain themes ≥8 per knowledge deck, ≥3 themes selected per run
- Total facts ≥30-50 per deck
- Synonyms computed
- No duplicate questions (image_question facts excluded — image differentiates them)
- funScore and difficulty assigned
- No ambiguous answers
- `answerTypePools` uses `factIds` array — NEVER `members`, `facts`, or `items`
- Every fact's `answerTypePoolId` references an existing pool in the deck
- Pool `id` fields match what facts reference — no naming mismatches
- Image-based facts (`imageAssetPath`) must have `quizMode: "image_question"` or `"image_answers"`
- Fill-in-blank `{___}` in quizQuestion is valid grammar syntax, not a braces error
- Pool `factIds` populated by scanning facts, never hand-crafted
- Pool answer length homogeneity: max/min ratio < 3× within each pool (check #20). Run `node scripts/pool-homogeneity-analysis.mjs --deck <id>` — 0 FAIL required
- Run `node scripts/quiz-audit.mjs --deck <id> --full` after every deck build — 0 FAIL required

## Answer Pool Homogeneity — CRITICAL

**Pools shared by questionTemplates MUST only contain facts that make sense for ALL templates using that pool.**

On 2026-04-02, a `person_names` pool contained both programming language creators AND tech company founders (SpaceX/Elon Musk). The template "Who created the {language} programming language?" was applied to the SpaceX fact, producing "Who created the  programming language?" with answer "Elon Musk".

The code now catches empty-placeholder replacements and falls back to `fact.quizQuestion`, but **pool design must still be correct**:

- If a pool is used by a `questionTemplate`, every fact in that pool must have the fields the template's placeholders reference (e.g., `{language}` requires all facts to have a non-empty language-related field)
- Split broad pools into domain-specific sub-pools when templates reference domain-specific placeholders: `person_names_language_creators`, `person_names_company_founders`, etc.
- Facts about different domains (languages vs companies vs hardware) should NOT share pools used by domain-specific templates
- `correctAnswer` format must be consistent within a pool (no mixing "Elon Musk" single names with "Nerva, Trajan, Hadrian..." lists)

## Batch Deck Verification — MANDATORY

After modifying ANY curated deck, run the batch verifier:

```bash
node scripts/verify-all-decks.mjs           # Summary table (all decks)
node scripts/verify-all-decks.mjs --verbose  # Per-fact details on failures
```

20 checks per fact/deck — 13 structural + 6 content quality + 1 pool homogeneity:

**Structural checks (FAIL):** braces in answer/question, answer-in-distractors, duplicate distractors, distractor count, pool size, missing fields, non-numeric bracket distractors, missing explanation, duplicate questions, orphaned pool refs, empty pools, template-pool placeholder compatibility.

**Content quality checks:** answer too long (FAIL >100 chars, WARN >60), question too long (FAIL >400 chars, WARN >300), difficulty out of range (FAIL, must be 1-5), funScore out of range (FAIL, must be 1-10), explanation too short (WARN <20 chars), explanation duplicates question (WARN).

Check #20 (pool homogeneity): per pool, if the max/min display-length ratio of non-bracket answers > 3x → FAIL; > 2x → WARN. Skips vocab decks and pools with fewer than 2 non-bracket members.

Target: **0 failures** across all decks. Warnings are informational — aim to minimize.

## Trivia Bridge — MANDATORY (Knowledge Decks)

**Every knowledge deck MUST be bridged to the trivia database before committing.** Language/vocabulary decks are exempt.

After batch verification passes:
1. Add the deck to `scripts/content-pipeline/bridge/deck-bridge-config.json` with correct `domain`, `prefixSegments`, `entitySegments`, `ageRating`, `categoryL2`
2. Run `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs` — verify 0 ID collisions
3. Confirm the deck appears in the output summary with expected entity count
4. Commit the updated `bridge-curated.json` and `bridge-manifest.json` alongside the deck

**Why:** Trivia Dungeon and Study Temple share FSRS state. If a knowledge deck isn't bridged, players get zero knowledge transfer between modes. This was the default state before 2026-04-01 and caused confusion.

**Exempt:** All vocabulary/language decks (Chinese HSK, Japanese JLPT, Spanish/French/German/Dutch/Czech CEFR, Korean TOPIK) and image-only decks (world_flags).

## Content Quality Limits

| Field | Warn | Fail | Notes |
|-------|------|------|-------|
| `correctAnswer` length | >60 chars | >100 chars | Strip `{N}` markers first. Skip vocab decks |
| `quizQuestion` length | >300 chars | >400 chars | Skip vocab decks |
| `difficulty` | — | <1 or >5, or missing | Required for all facts |
| `funScore` | — | <1 or >10, or missing | Required for all facts |
| `explanation` length | <20 chars | empty/missing | Skip vocab for short warning |
| `explanation` content | duplicates question | — | Normalized comparison |

These limits are enforced by both `verify-all-decks.mjs` (batch check) and `tests/unit/deck-content-quality.test.ts` (CI test suite).

## In-Game Quiz Audit — MANDATORY

After EVERY deck creation or major modification, a random sample of 20+ facts MUST be reviewed **as they would appear in-game** — showing the quiz question with 4 answer options (1 correct + 3 distractors).

This catches issues that the 19-check structural verifier CANNOT:
- **Trivially eliminatable distractors** — answer is 50 chars but distractors are 3-4 chars ("DNA", "RNA")
- **Length mismatch** — correct answer dramatically longer/shorter than distractors (obvious tell)
- **Em-dash explanations baked into answers** — "Term — plus a whole explanation" as the answer text
- **Ambiguous questions** — where 2+ options could reasonably be correct
- **Nonsensical distractors** — plausible-looking but grammatically/semantically incoherent
- **Pool contamination** — distractors from wrong domain (organelle names mixed with process names)

### How to audit:
1. Sample 20+ facts across ALL units/sub-decks and ALL answer pools (not just term_definitions)
2. For each fact, display: question, 4 shuffled options (mark correct), explanation preview
3. Flag any fact where a student could eliminate 2+ distractors without knowing the subject
4. Flag any answer >60 chars appearing alongside <20 char distractors
5. Fix flagged facts before committing

### When:
- After initial deck assembly (before first commit of assembled deck)
- After any bulk answer/distractor modification
- After pool redesign or reassignment

**This is NON-NEGOTIABLE. The structural verifier passing does NOT mean the deck plays well.**

### Real-Engine Quiz Audit

After the structural `quiz-audit.mjs` passes, run the engine-level audit for comprehensive validation:

```bash
npm run audit:quiz-engine                            # All knowledge decks
npm run audit:quiz-engine -- --include-vocab          # Include vocab decks
npm run audit:quiz-engine -- --deck <id> --verbose    # Single deck, full detail
npm run audit:quiz-engine -- --confusion-test         # Verify confusion matrix path
```

This exercises the REAL `selectDistractors()` and `selectQuestionTemplate()` code paths, catching issues the simplified `quiz-audit.mjs` cannot: synonym group violations, unit contamination, POS mismatches, template rendering failures, mastery-dependent distractor count errors, and confusion matrix responsiveness. 24 checks total (10 structural + 14 engine-enabled).

## Build Artifacts — JSON to SQLite Compilation

**JSON files in `data/decks/` are the authoring format. Never edit `public/curated.db` directly.**

The content-agent works exclusively with JSON. At build time, a separate script compiles them:

```bash
npm run build:curated    # Compile data/decks/ → public/curated.db
npm run build:obfuscate  # XOR-obfuscate public/facts.db + public/curated.db
npm run build            # Production build (includes both steps above)
```

**Key scripts:**
- `scripts/build-curated-db.mjs` — reads `data/decks/manifest.json`, writes all active JSON decks into a single SQLite DB at `public/curated.db`
- `scripts/obfuscate-db.mjs` — XOR-obfuscates both DB files so they cannot be opened with the sqlite3 CLI; runtime-decoded by `src/services/dbDecoder.ts`

**What is NOT shipped to users:**
- `data/decks/*.json` — JSON source files stay in the repo, never copied to `dist/`
- `data/seed-pack.json` — moved to `data/` (was previously `public/seed-pack.json`); not shipped

**Why SQLite instead of JSON:** The 77 individual JSON files in `data/decks/` are only accessible via Vite's dev server (which serves the project root). They were never copied to `dist/`, so curated decks silently failed to load in production/Steam builds. A single `public/curated.db` is included in the Vite build output correctly.
