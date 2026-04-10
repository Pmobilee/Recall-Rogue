# spanish_a1 — Expectations

## 1. Intended Scope
CEFR A1 (Breakthrough) — highest-frequency beginner Spanish vocabulary. Target: words a learner needs for survival communication, basic greetings, numbers, family, common nouns and verbs.

## 2. Canonical Source
- CEFRLex ELELex frequency lists (confirmed in `sourceName` / `sourceUrl`)
- Instituto Cervantes PCIC A1 lexical inventory as cross-reference

## 3. Sub-deck / Chain Theme List
No sub-decks or chain themes defined. Flat vocabulary list (1,546 facts).

## 4. Answer Pool Inventory
- `english_meanings` (1,546 factIds, 0 syntheticDistractors) — forward template pool
- `target_language_words` (1,546 factIds, 0 syntheticDistractors) — reverse template pool

Both pools cover all POS types: noun (1,009), verb (356), adjective (123), adverb (36), preposition (7), and others.

## 5. Expected Quality Bar
- All facts should be unambiguous A1-level words
- Forward questions: "What does 'X' mean?" → English meaning (single POS expected in distractor set)
- Reverse questions: "How do you say 'Y' in Spanish?" → Spanish word (Spanish-only distractors expected)
- No chain themes required for vocabulary decks
- POS consistency is the primary quality signal

## 6. Risk Areas
1. **POS-TELL (HIGH)**: Single pool covers all POS types. Verb answers (starting "to ") mixed with noun/adjective answers in same pool; distractors will cross POS boundaries.
2. **POOL-CONTAM in reverse mode (HIGH)**: `target_language_words` pool is used for reverse questions, but distractors are drawn from the same pool — which contains English meanings, not Spanish words. English meanings will appear as distractors on reverse questions.
3. **LENGTH-TELL (HIGH)**: Pool mixes compound answers ("to leave, to go away") with short answers ("cow", "round"). Max/min ratio will often exceed 3x.
4. **Zero synthetic distractors**: Both pools have 0 synthetic distractors. All distraction comes from same-pool facts, amplifying all above risks.
5. **CEFR level bleed**: `abandonar` (to abandon) is tagged A1 — borderline for true A1 learners but consistent with ELELex frequency ranking.
