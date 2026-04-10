# french_a1 — Expectations

## Scope
Beginner French vocabulary at CEFR A1 level. 932 facts sourced from CEFRLex FLELex + Kaikki.org (https://cental.uclouvain.be/cefrlex/). Canonical authority: CEFR A1 descriptor + Référentiel A1 pour le français (Beacco et al., Didier). Covers core survival vocabulary needed for everyday greetings, numbers, family, food, directions.

## Sub-Decks
None defined (0 sub-decks). Facts distinguished by chainThemeId cycling 0–5.

## Answer Pool Inventory
- `english_meanings` — 932 factIds, 0 syntheticDistractors
- `target_language_words` — 932 factIds, 0 syntheticDistractors

All 932 facts map to `english_meanings`. No POS-separated pools.

## POS Distribution
noun: 583 | verb: 244 | adverb: 52 | adjective: 36 | preposition: 5 | determiner: 5 | conjunction: 4 | interjection: 1 | pronoun: 1 | number: 1

## Quality Bar
- Vocabulary: forward (FR→EN), reverse (EN→FR), definition_match, synonym_pick templates
- Distractors drawn from same `english_meanings` pool — all 932 facts compete regardless of POS
- 0 syntheticDistractors: relies entirely on pool diversity for distractor variety

## Risk Areas
1. **POS-TELL**: Single `english_meanings` pool contains verbs ("to accept"), nouns ("reception"), adverbs ("well, yeah"), adjectives ("former, ancient"). Distractors from mixed POS are an obvious tell — e.g., one verb + one noun in a 3-option set.
2. **SELF-ANSWERING at mastery=4**: `definition_match` template renders the full explanation line as the question. Several explanations contain the English answer word verbatim (e.g., "explication — explanation." → answer: "explanation").
3. **COMPOUND CORRECT ANSWERS**: Several answers use comma-separated multi-word forms ("well, yeah", "former, ancient") that reduce format consistency against single-word distractors.
4. **PLACEHOLDER DISTRACTOR**: Fact `fr-cefr-772` (semaine/week) has literal "answer" as a distractor option — a blank-distractor placeholder that was never replaced.
5. **LENGTH-TELL**: Pool mixes short answers (3–5 chars like "city", "dear") with multi-word answers ("room in a house", "former, ancient") — ratio up to 3.8× in observed quizzes.
