# french_a1_grammar — Expectations

## Scope
CEFR A1 French grammar. 194 facts (target: 200). Scoped from Référentiel A1 pour le français (Beacco et al., Didier). Fill-in-the-blank format: each fact presents a French sentence with a gap, and the student selects the correct conjugated form, article, or grammatical word.

## Canonical Source
Référentiel A1 pour le français (Beacco, Bouquet, Porquier, Didier, 2004). Grammar points covered: present tense -er/-ir/-re verbs, être/avoir/aller, definite/indefinite/partitive articles, subject/stressed pronouns, possessives, questions, negation, futur proche, passé récent, prepositions of place.

## Sub-Decks
8 sub-decks:
- `sd_present_er_verbs` — 24 facts
- `sd_etre_avoir` — 39 facts
- `sd_articles_genre` — 22 facts
- `sd_pronoms_possessifs` — 22 facts
- `sd_questions_negation` — 27 facts
- (3 more)

## Answer Pool Inventory
20 pools — well-structured POS/conjugation-class partitioning:
- `present_er_forms` (24f + 6 synthetic)
- `etre_forms` (15f + 12 synthetic)
- `avoir_forms` (17f + 12 synthetic)
- `aller_forms` (5f + 10 synthetic)
- `present_ir_forms` (12f + 5 synthetic)
- `present_re_forms` (12f + 5 synthetic)
- `reflexive_forms` (6f + 5 synthetic)
- `articles_definis` (5f + 10 synthetic)
- Plus 12 more pools for pronouns, negation, prepositions, etc.

## Quality Bar
All entries use `_fallback` template (fill-in-blank with French sentence). All distractors are conjugated verb forms or grammatical words from the same paradigm — correct by design. POS-tell is structurally prevented since each pool contains only one grammatical category.

## Risk Areas
1. **LENGTH-TELL**: Unlikely since conjugated forms are all short words within the same paradigm (parle/parles/parlons/parlez/parlent all 5–7 chars). Risk near zero.
2. **CONJUGATION AMBIGUITY**: Some forms overlap — `parle` is both je and il/elle form. If a question uses `il`, the distractor `parle` (je form) is technically correct too. Risk: structural ambiguity in pool design.
3. **SYNTHETIC DISTRACTOR QUALITY**: Pools with low real-fact count rely on synthetics. If synthetics are forms from different verbs rather than same-verb wrong-person endings, discrimination may be too easy.
4. **SELF-ANSWERING**: Low risk — fill-in-blank sentences don't expose the answer word in standard cases. Grammar decks don't have the definition_match template problem.
5. **SENTENCE NATURALNESS**: A1 sentences should be simple and clear. Complex sentences at this level would be inappropriate.
