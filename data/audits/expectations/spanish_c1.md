# spanish_c1 — Expectations

## 1. Intended Scope
CEFR C1 (Effective Operational Proficiency) — advanced Spanish vocabulary. Learner understands demanding texts, expresses spontaneously and fluently, uses language flexibly for social/academic/professional purposes.

## 2. Canonical Source
- CEFRLex ELELex frequency lists (`sourceName` / `sourceUrl` confirmed)
- Instituto Cervantes PCIC C1 lexical inventory as cross-reference
- Note: C1 includes function words and grammatical items alongside lexical vocabulary; POS tagging system is inconsistent (mixes `pronoun`/`pron`, `adjective`/`adj`, `det` etc.).

## 3. Sub-deck / Chain Theme List
No sub-decks or chain themes. 1,500 facts. Fact IDs in es-cefr-4xxx–5xxx range.

## 4. Answer Pool Inventory
- `english_meanings` (1,500 factIds, 0 syntheticDistractors)
- `target_language_words` (300 factIds, 0 syntheticDistractors) — only 20% of facts have Spanish-word reverse entries; may indicate incomplete pool construction

## 5. Expected Quality Bar
C1 vocabulary is often academic/literary. Many words are partial cognates with English. Self-answering is a major risk when the Spanish and English words are identical or near-identical. Distractors must be semantically sophisticated — not just random pool draws.

## 6. Risk Areas
1. **SELF-ANSWERING / cognate leak (HIGH)**: C1 includes many Spanish-English cognates (`sentimental`, `debate`, `primordial`, `civil`, `rumor`, `info`). Question "What does 'X' mean?" with answer "X" is trivially self-answered.
2. **LENGTH-TELL (HIGHEST of all decks)**: 58 length-tell quiz items (out of 180 in sample). C1 words have extremely variable answer lengths — single-word English cognates vs. multi-phrase explanations in same pool.
3. **FACTUAL-SUSPECT (CRITICAL)**: At least 3 facts have wrong translations: `donde`→`because` (should be `where`), `habitual`→`beans` (should be `habitual, usual`), `sino`→`destiny, fate, lot` tagged as conjunction (noun sense is valid but tagging is inconsistent).
4. **POS tagging inconsistency**: Deck uses both `pronoun`/`pron`, `adjective`/`adj`, `det`/`determiner` — suggests data from two different sources merged without normalization. This affects distractor selection if engine groups by POS.
5. **Incomplete `target_language_words` pool**: Only 300 of 1,500 facts have entries in the reverse pool. Reverse-mode questions will only trigger for 20% of facts.
