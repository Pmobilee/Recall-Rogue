# spanish_b2 — Expectations

## 1. Intended Scope
CEFR B2 (Vantage) — upper-intermediate Spanish vocabulary. Learner understands main ideas of complex texts, interacts fluently with native speakers. Vocabulary covers academic, professional, and nuanced descriptive domains.

## 2. Canonical Source
- CEFRLex ELELex frequency lists (`sourceName` / `sourceUrl` confirmed)
- Instituto Cervantes PCIC B2 lexical inventory as cross-reference

## 3. Sub-deck / Chain Theme List
No sub-decks or chain themes. Flat list (964 facts). Fact IDs in es-cefr-3xxx range.

## 4. Answer Pool Inventory
- `english_meanings` (964 factIds, 0 syntheticDistractors)
- `target_language_words` (964 factIds, 0 syntheticDistractors)

POS: noun (596), verb (269), adjective (93), adverb (5), interjection (1).

## 5. Expected Quality Bar
B2 vocabulary should have richer distractors — plausible near-synonyms or semantically adjacent words. Quiz templates at higher mastery levels include `synonym_pick` and `definition_match` in addition to forward/reverse. All options in synonym/definition templates must be same language as the answer.

## 6. Risk Areas
1. **POOL-CONTAM in reverse mode (HIGH)**: Structural issue — English meanings leaking into Spanish-answer distractor sets.
2. **LENGTH-TELL (MEDIUM)**: B2 introduces more multi-word phrases and compound meanings; ratio violations common.
3. **synonym_pick template contamination**: At higher mastery, `synonym_pick` template used — all options should be English meanings, but pool contamination may bring in Spanish words as distractors.
4. **POS-TELL (LOW-MEDIUM)**: Two clear POS-TELL cases observed; noun-heavy pool reduces frequency but doesn't eliminate.
5. **Repeated distractor "banking"**: Multiple unrelated facts show "banking" as a distractor — suggests a single finance-domain fact's answer is overused as a distractor, creating an implausible option for non-finance questions.
