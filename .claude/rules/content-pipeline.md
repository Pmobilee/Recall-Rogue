# Content Pipeline Rules

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
- Answer pools ≥5 per question
- Chain themes ≥8 per knowledge deck, ≥3 themes selected per run
- Total facts ≥30-50 per deck
- Synonyms computed
- No duplicate questions
- funScore and difficulty assigned
- No ambiguous answers
