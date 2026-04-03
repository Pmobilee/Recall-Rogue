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

13 checks per fact/deck: braces in answer/question, answer-in-distractors, duplicate distractors, distractor count, pool size, missing fields, non-numeric bracket distractors, missing explanation, duplicate questions, orphaned pool refs, empty pools, template-pool placeholder compatibility. Target: **0 failures** across all decks.
