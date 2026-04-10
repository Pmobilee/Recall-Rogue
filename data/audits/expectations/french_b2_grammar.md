# french_b2_grammar — Expectations

## Scope
CEFR B2 French grammar. 397 facts (target: 550). Scoped from Référentiel B2 pour le français (Beacco et al., Didier). Covers: subjonctif passé, concordance des temps (subjonctif), conditionnel passé and si type-3 (plus-que-parfait → conditionnel passé), mixed conditionals, discours rapporté au passé (tense backshifting + temporal marker changes), passif avancé, causatif (faire/laisser), accord du participe passé (avoir + COD posé, pronominal), advanced connectors, nominalisation, mise en relief (c'est…qui/que, ce qui c'est), futur antérieur.

## Canonical Source
Référentiel B2 pour le français (Beacco, Bouquet, Porquier, Didier, 2004). 8 sub-decks.

## Sub-Decks
8 sub-decks:
- `sd_subjonctif_passe_concordance` — 67 facts
- `sd_conditionnel_passe_si_type_3` — 76 facts (largest)
- `sd_discours_rapporte_au_passe` — 40 facts
- `sd_passif_avance_causatif` — 32 facts
- `sd_accord_du_participe_passe` — 40 facts
- (3 more)

## Answer Pool Inventory
31 pools — all 0 syntheticDistractors. Full reliance on real facts for distractors. Pools range from 10–20 real facts, sufficient for basic variety but borderline for distractor diversity at mastery=4 (5 options).

## Quality Bar
All entries use `_fallback` template. At B2 the grammar distinctions are subtle: subjonctif passé vs conditionnel passé vs plus-que-parfait all produce compound verb forms with auxiliary verbs. Pool design must ensure that across-pool sampling doesn't blur grammatical category boundaries.

## Risk Areas
1. **LENGTH-TELL in `discours_rapporte_temps_markers`**: Temporal markers "là" (2 chars) vs "le mois suivant" (15 chars) — ratio 7.5×. "là" is a single-word adverb; multi-word temporal expressions are visually different format.
2. **LENGTH-TELL in `connecteurs_addition`**: "voire" (5 chars) vs "non seulement…mais aussi" (24 chars) — ratio 4.8×. Multi-word discourse markers vs single-word connectors.
3. **PARENTHETICAL IN OPTION**: `concordance_subj_present_passe` pool contains a distractor formatted as "qu'il vienne demain (présent" — truncated parenthetical in the option string, malformed.
4. **AMBIGUOUS-Q in `opinion_negative_subj`**: Correct answer "je ne suis pas sûr(e) que ce soit la meilleure solution" — all options are semantically near-equivalent negative-opinion subjonctif constructions. A native speaker could argue multiple are correct.
5. **MISE EN RELIEF AMBIGUITY**: `mise_en_relief_cest_qui_que` questions ask to cleft a specific subject — but if the question says "highlight 'elle'", any syntactically valid cleft with "elle" as subject would be correct, not just the specific sentence chosen as the answer.
