# ap_chemistry — Expectations

## 1. Intended Scope
Full coverage of all 9 units of the AP Chemistry CED (College Board, effective Fall 2024), from atomic structure and stoichiometry through electrochemistry.

## 2. Canonical Source
College Board AP Chemistry CED Fall 2024. Units:
- Unit 1: Atomic Structure and Properties
- Unit 2: Molecular and Ionic Compound Structure and Properties
- Unit 3: Intermolecular Forces and Properties
- Unit 4: Chemical Reactions
- Unit 5: Kinetics
- Unit 6: Thermochemistry
- Unit 7: Equilibrium
- Unit 8: Acids and Bases
- Unit 9: Electrochemistry

## 3. Sub-Deck / Chain Theme List
6 sub-decks (grouped from 9 CED units): Structure & Bonding, Intermolecular Forces, Chemical Reactions, Kinetics & Energy, Equilibrium & Acid-Base Chemistry, Thermodynamics & Electrochemistry. No chain themes defined — `chainThemeId` values 0–5 present in facts but not named.

## 4. Answer Pool Inventory
13 pools:
- `chemistry_concepts_long` (89 factIds, no synth) — largest; heterogeneous
- `chemistry_concepts_short` (81 factIds, no synth) — broad short-answer pool
- `unique_answers` (46 factIds, no synth) — catch-all for one-off answer types
- `equation_formulas` (39 factIds, no synth) — formulas, equations
- `periodic_trend_terms` (20 factIds, no synth)
- `process_types` (15 factIds, no synth)
- `bond_and_imf_types` (15 factIds, no synth)
- `named_laws_principles` (18 factIds, no synth)
- `bracket_numbers` (30 factIds, no synth) — mixed numeric types
- Smaller pools: `reaction_types` (13), `equilibrium_concepts` (14), `compound_names` (11+4 synth), `electrochemistry_terms` (9+6 synth)

## 5. Expected Quality Bar
AP Chemistry questions must use correct chemical notation (subscripts, superscripts, arrow notation) and distractors must be chemically plausible wrong values or concepts — not arbitrary other-domain terms.

## 6. Known Risk Areas
- **`unique_answers` POOL-CONTAM**: 46 facts with heterogeneous answer types in one pool — distractors drawn across very different concepts.
- **NUMERIC-WEAK in `bracket_numbers`**: The pool mixes percentages, molar masses, pH values, and thermodynamic numbers — distractors may be unit-mismatched.
- **BROKEN-GRAMMAR in question stems**: Some facts use a template that renders "this" as a noun placeholder mid-sentence (e.g., "What does this indicate").
- **`process_types` POOL-CONTAM**: Mixes endothermic/exothermic descriptions with VSEPR geometries — different question types in same pool.
- **`named_laws_principles` POOL-CONTAM**: Mixing named laws (Zeroth Law) whose correct answers are short phrases with other entries whose answers are long multi-word descriptions — LENGTH-TELL possible.
- **Fill-in-blank `___` questions with non-numeric answers**: The `bracket_numbers` pool contains a fill-blank question for pH at equivalence point where correct answer is a descriptor ("pH > 7 (basic)") not a number — TEMPLATE-MISFIT.
