# spanish_a1_grammar — Expectations

## 1. Intended Scope
CEFR A1 grammar structures — the core productive grammar a beginner needs: present tense regular/irregular conjugations, ser/estar, articles (definite/indefinite), demonstratives, possessives, subject pronouns, interrogatives, basic negation, and common verb phrase patterns.

## 2. Canonical Source
- Instituto Cervantes PCIC A1 grammatical inventory
- Standard A1 grammar scope from major course syllabi (e.g., Aula, Gente, Español en Marcha)

## 3. Sub-deck / Chain Theme List
8 sub-decks / 8 chain themes:
- Present Tense (AR/ER/IR verbs)
- Ser vs. Estar
- Irregular Verbs
- Articles & Determiners (definite + indefinite, demonstratives, possessives)
- Subject Pronouns
- Question Words
- Negation
- Verb Phrases

## 4. Answer Pool Inventory
14 grammar-point pools, all properly padded with synthetic distractors (5–19 factIds + 5–14 synthetics each). Pool IDs are named by grammar category. All 134 facts tagged `partOfSpeech: grammar`.

Template: `_fallback` only (no forward/reverse; fill-in-blank `{___}` throughout).

## 5. Expected Quality Bar
- Each fill-in-blank should be unambiguous given the sentence context and English translation
- Distractors should all be grammatically plausible (same grammatical category: article vs article, pronoun vs pronoun)
- English translation in parentheses is a comprehension aid, NOT intended to reveal the answer
- All options should be Spanish forms, never English words

## 6. Risk Areas
1. **SELF-ANSWERING via translation (HIGH)**: English translations in parentheses may lexically contain the correct Spanish form (e.g., "I'm not Spanish" contains "not" → hints at `no`).
2. **LENGTH-TELL in article/pronoun pools (HIGH)**: Pool mixes `su` (2 chars), `nuestro` (7 chars), `cualquier` (9 chars) — ratio >3x is systematic when short pronouns/articles compete with longer forms.
3. **Homogeneity concern — verb phrase pool**: `verb_phrase_patterns` pool (19 facts) mixes present-tense single-verb forms with multi-word periphrastic patterns (e.g., `está comiendo`) — may not be semantically homogeneous.
4. **Article distractors**: `articles_definite` pool uses `el/la/los/las/al` — `al` is a contraction, not a plain article; mixing it with plain articles could confuse learners.
5. **Limited synthetic distractor vocabulary**: Grammar pools need distractors that are valid Spanish forms but wrong for the context; if synthetics are not grammatically plausible, they become eliminatable.
