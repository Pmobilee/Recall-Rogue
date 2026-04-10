# french_b1_grammar — Expectations

## Scope
CEFR B1 French grammar. 348 facts (target: 450). Scoped from Référentiel B1 pour le français (Beacco et al., Didier). Covers: subjonctif présent (regular and irregular), conditionnel présent and passé, si-clauses (imparfait + conditionnel), plus-que-parfait, advanced relative pronouns (dont/où/lequel), double pronominalization, gérondif, participe présent, passif, discourse markers (causal, consecutive), discours rapporté.

## Canonical Source
Référentiel B1 pour le français (Beacco, Bouquet, Porquier, Didier, 2004). 8 sub-decks matching the Référentiel chapter structure.

## Sub-Decks
8 sub-decks:
- `sd_subjonctif_present` — 102 facts (largest)
- `sd_conditionnel_si_clauses` — 65 facts
- `sd_plus_que_parfait_temps_composes` — 30 facts
- `sd_pronoms_relatifs_avances` — 30 facts
- `sd_double_pronominalization` — 25 facts
- (3 more)

## Answer Pool Inventory
29 pools — comprehensive paradigm coverage. Selected pools:
- `subj_er_regular` (15f + 5 synthetic)
- `subj_irregulier` (24f + 5 synthetic)
- `subj_triggers_necessite` (9f + 7 synthetic)
- `conditionnel_present_forms` (49f — large pool)
- `si_imparfait_patterns` (6f)
- `connecteurs_causals` / `connecteurs_consecutifs` (8f + 7 synthetic each)
- `pronoms_relatifs_dont_ou` (11f + synthetics)

## Quality Bar
All entries use `_fallback` template. Key risks at B1: the `si_imparfait_patterns` pool has only 6 real facts and synthetic distractors that are full si-clause sentences instead of conjugated verb forms. The `pronoms_relatifs_dont_ou` pool contains multi-syllable relative pronouns of varying lengths (dont/où/lequel/lesquelles).

## Risk Areas
1. **LENGTH-TELL in `si_imparfait_patterns`**: Correct answer is a conjugated form (5–7 chars); synthetic distractors are full si-clause sentences (30–50 chars). Extreme ratio.
2. **LENGTH-TELL in `pronoms_relatifs_dont_ou`**: "dont" (4 chars) vs "lesquelles" (10 chars) — 2.5× ratio, borderline.
3. **LENGTH-TELL in `connecteurs_consecutifs`**: Short connectors ("donc", "or") vs multi-word connectors ("si bien que", "de sorte que") — up to 3.3× ratio.
4. **SYNTHETIC DISTRACTOR SENTENCE QUALITY**: `si_imparfait_patterns` synthetics appear to be full si-clause examples, not isolated verb forms — format mismatch.
5. **SUBJONCTIF TRIGGER POOLS**: Testing which triggers require subjonctif vs indicatif — risk of ambiguity if the pool contains both subjonctif-trigger verbs and non-trigger verbs that are semantically similar.
