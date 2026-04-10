# french_a2_grammar — Expectations

## Scope
CEFR A2 French grammar. 354 facts (target: 400). Scoped from Référentiel A2 pour le français (Beacco et al., Didier). Covers passé composé (avoir/être auxiliaries), imparfait, futur simple, COD/COI pronouns, y/en pronouns, imperative, comparative/superlative, relative clauses (qui/que), conditionnel de politesse, time expressions, logical connectors.

## Canonical Source
Référentiel A2 pour le français (Beacco, Bouquet, Porquier, Didier, 2004). 8 sub-decks map to A2 grammar points.

## Sub-Decks
8 sub-decks:
- `sd_passe_compose` — 74 facts
- `sd_imparfait` — 41 facts
- `sd_futur_simple` — 30 facts
- `sd_pronoms_cod_coi` — 36 facts
- `sd_pronoms_y_en` — 25 facts
- (3 more: imperative, comparative, si-clauses)

## Answer Pool Inventory
25 pools — well-partitioned by tense and auxiliary type. Selected pools:
- `passe_compose_avoir_forms` (26f + 5 synthetic)
- `passe_compose_etre_forms` (32f + 3 synthetic)
- `imparfait_regular` (29f + 5 synthetic)
- `futur_simple_irregular_stems` (21f + 7 synthetic)
- `y_pronoun_uses` (measured: only a few real facts)
- `superlatif_forms` (measured: few real facts)
- `imperatif_tu_forms` (15f + synthetics)
- `time_expressions_passe` (5f + synthetics)

## Quality Bar
All entries use `_fallback` template. Risk area unique to A2: the `y_pronoun_uses` and `en_pronoun_uses` pools contain only a handful of real facts (single-letter answers "y" and "en"). Synthetic distractors for these pools are full sentences rather than short-form alternatives, creating extreme length-tell ratios.

## Risk Areas
1. **LENGTH-TELL**: Severe in `y_pronoun_uses` and `en_pronoun_uses` pools — correct answer is "y" (1 char) or "en" (2 chars) while distractors are full French sentences like "J'en vais." (10+ chars). Ratio up to 19×.
2. **SYNTHETIC DISTRACTOR MISMATCH**: In `y_pronoun_uses`, synthetics appear to be full incorrect sentences instead of short-form pronoun alternatives. The format of options is incoherent: one item is 1 char, others are 10–19 chars.
3. **SUPERLATIF FORMS**: Pool mixes agreement-modified forms ("le moins cher", "la moins difficile", "les moins chères") — answer length and gender marking vary, potentially creating gender-tell.
4. **COMPARATIF_IRREGULAR pool**: 12 facts in `comparatif_irregular` pool — risk of ambiguity since meilleur/mieux/pire/moins bien can all appear together.
5. **TIME EXPRESSIONS**: `time_expressions_passe` pool with only 5 real facts tests among "hier", "avant-hier", "l'année dernière" — reasonable discrimination but the "hier" vs "avant-hier" pair may create guessing.
