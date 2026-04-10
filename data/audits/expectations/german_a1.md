# german_a1 — Expectations

## Scope
Beginner German vocabulary at CEFR A1 level. 1,420 facts — the largest single vocabulary deck in this batch. Sourced from the Goethe-Institut Profile Deutsch A1 word list and CEFR-aligned German frequency resources. Canonical authority: Goethe-Institut Zertifikat A1: Start Deutsch 1 word list and CEFR A1 descriptor. Covers core survival vocabulary: greetings, numbers, family, food, colours, body parts, household objects.

## Sub-Decks
None (0 sub-decks).

## Answer Pool Inventory
- `english_meanings` — 1,420 factIds, 0 syntheticDistractors
- `target_language_words` — 1,420 factIds, 0 syntheticDistractors

No POS-separated pools. 1,420 facts in a single pool.

## POS Distribution
noun: 959 | verb: 304 | adverb: 60 | adjective: 58 | preposition: 13 | number: 6 | conjunction: 7 | interjection: 5 | determiner: 5 | pronoun: 3

## Quality Bar
Same four templates as French vocab. German adds a layer of complexity: German nouns are capitalized (Kirche, Bank, Wochenende) — the reverse-mode question "How do you say X in German?" should have capitalized noun answers. Distractors should also be capitalized correctly. Also: German nouns have grammatical gender (der/die/das) which ideally would be signaled in the pool.

## Risk Areas
1. **NO GRAMMATICAL ARTICLE**: German nouns in reverse mode answers lack their article (e.g., correct answer is "Kirche" not "die Kirche"). Students do not learn gender from this deck.
2. **POS-TELL**: Single pool mixing nouns (959), verbs (304), adjectives (58), adverbs (60). Verb distractors with "to " prefix are immediately identifiable as non-nouns. 5 instances observed in 180-entry sample.
3. **SELF-ANSWERING at mastery=4**: Same definition_match template issue as French decks. German cognates (Biografie→biography, Bank→bench) where the explanation contains the English answer word.
4. **POOL-CONTAM**: 3 instances of English words appearing as distractors in reverse-mode questions (new, exam, exam). Suggests distractor-pool selection bug causing English meanings to bleed into the target-language answers pool.
5. **LENGTH-TELL**: German compound nouns ("Landeswissen" → "regional studies" = 16 chars) against short English answers ("church" = 6 chars) creates high length ratios in both forward and reverse templates.
