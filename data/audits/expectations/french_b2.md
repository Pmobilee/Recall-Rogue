# french_b2 — Expectations

## Scope
Upper-intermediate French vocabulary at CEFR B2 level. 4,115 facts — the largest French vocab deck. Sourced from CEFRLex FLELex + Kaikki.org. Canonical authority: CEFR B2 descriptor + Référentiel B2 pour le français (Beacco et al., Didier). Covers nuanced register-specific vocabulary: academic, professional, literary, and socio-political domains.

## Sub-Decks
None (0 sub-decks).

## Answer Pool Inventory
- `english_meanings` — 4,115 factIds, 0 syntheticDistractors
- `target_language_words` — 4,115 factIds, 0 syntheticDistractors

Largest pool in any French deck. The pool depth (4,115 members) ensures diverse distractors — but does not fix POS mixing.

## POS Distribution
noun: 2,284 | verb: 1,157 | adjective: 469 | adverb: 192 | preposition: 4 | determiner: 3 | particle: 2 | number: 1 | interjection: 2 | conjunction: 1

## Quality Bar
All four templates. synonym_pick is most prevalent at B2 (26 of 180 entries ≈ 14%), appropriate for testing precise meaning discrimination at this level.

## Risk Areas
1. **LENGTH-TELL**: Most severe in this deck (33 of 180 entries ≈ 18%) — B2 vocabulary includes longer compound phrases as correct answers ("remuneration, reward", "to capture, pick up", "to renovate, renew") which create high length ratios against short distractors.
2. **COMPOUND ANSWERS**: 29 of 180 entries have comma-separated correct answers — highest in any French deck. Multiple answers like "skill, ability", "capacity, ability", "competence, ability" in the same pool are near-synonyms.
3. **SYNONYM-LEAK**: `fr-cefr-4673` (habileté) — all 3 options at mastery=0 end with ", ability": "skill, ability" ✓, "capacity, ability", "competence, ability". The shared ", ability" suffix is a strong discriminator that still doesn't resolve which is correct — but reveals the compound-answer format.
4. **SELF-ANSWERING**: 14 instances, concentrated at mastery=4. B2 cognates (répercussion, sentinelle, gérer) are high risk.
5. **POS-TELL**: 1 instance observed — lower rate than B1, consistent with proportionally larger noun share (55%) dominating distractors.
