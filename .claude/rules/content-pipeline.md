# Content Pipeline Rules

## Batch Output Verification — MANDATORY (added 2026-04-09)

**After ANY batch content operation (mass question rewrite, distractor generation, fact assembly), SAMPLE 10+ items and READ them back.** Naive word replacement produces broken grammar ~20% of the time ("the this", "Soviet this", "in a who"). Three cleanup passes were needed after 1,561 question rewrites shipped with broken grammar.

**Rules:**
- Never trust batch output without sampling — sub-agents produce broken content ~15-20% of the time
- Grep for known broken patterns: "the this", "a this", "which this", "[Adjective] this", standalone "this" as noun
- Verify grammar reads naturally as proper English
- If >5% of samples are broken, reject the batch and rephrase individually

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
1. **Find the exam's official Course Description / Syllabus / Scope Document**
2. **Use its structure as the deck's architecture** — units, topics, learning objectives map to sub-decks and chain themes
3. **Cover every testable concept** — if it's in the exam scope, it must be in the deck
4. **Tag facts with exam metadata** — `examTags` field with exam name and unit/section identifiers
5. **Weight content by exam weighting** — units worth more on the exam get proportionally more facts

**Applicable exam frameworks:** AP (College Board CED), JLPT, CEFR, TOPIK, HSK, IB, SAT, GCSE/A-Level, USMLE/NCLEX.

**This does NOT apply to:** Casual knowledge decks where no standardized exam exists.

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

## Build Artifacts — JSON to SQLite Compilation

**JSON files in `data/decks/` are the authoring format. Never edit `public/curated.db` directly.**

```bash
npm run build:curated    # Compile data/decks/ → public/curated.db
npm run build:obfuscate  # XOR-obfuscate public/facts.db + public/curated.db
npm run build            # Production build (includes both steps above)
```

Key scripts: `scripts/build-curated-db.mjs` (JSON→SQLite), `scripts/obfuscate-db.mjs` (XOR obfuscation). Runtime decode: `src/services/dbDecoder.ts`.

**What is NOT shipped:** `data/decks/*.json` (repo only), `data/seed-pack.json` (repo only).
