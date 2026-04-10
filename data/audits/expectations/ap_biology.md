# ap_biology — Expectations

## 1. Intended Scope
Full coverage of all 8 units of the AP Biology Course and Exam Description (CED), from chemistry of life through ecology, supporting performance on the College Board AP Biology exam.

## 2. Canonical Source
College Board AP Biology CED (effective Fall 2019, updated 2020). Units:
- Unit 1: Chemistry of Life
- Unit 2: Cell Structure and Function
- Unit 3: Cellular Energetics
- Unit 4: Cell Communication and Cell Cycle
- Unit 5: Heredity
- Unit 6: Gene Expression and Regulation
- Unit 7: Natural Selection and Evolution
- Unit 8: Ecology

## 3. Sub-Deck / Chain Theme List
8 sub-decks mapping directly to CED units. 18 chain themes:
The Molecular Forge, Cellular Architecture, The Powerhouse, Signal & Cycle, The Inheritance Chamber, The Code Vault, Evolution Engine, The Living Web, Cell Division Architects, Gene Flow Navigators, Heredity Detectives, The Expression Matrix, Mutation Mechanics, Biotechnology Lab, Natural Selection Arena, Speciation Frontiers, Population Dynamics, Ecosystem Architects.

## 4. Answer Pool Inventory
32 pools total. Notable ones:
- `term_definitions_long` (214 factIds) — no synth; very large, heterogeneous risk
- `term_definitions_mid` (169 factIds) — no synth; very large
- `bio_concept_terms` (141 factIds) — no synth; broad bio concepts
- `molecule_names_long` (59 factIds) — no synth
- `process_names_long` (56 factIds) — no synth
- `bracket_numbers` (45 factIds, homogeneityExempt) — dates, ratios, measurements mixed
- `comparison_terms` (55 factIds, homogeneityExempt) — answer-format variation expected
- `ecology_terms_short/long` (41/35 factIds)
- Many smaller pools (6–15 factIds) with synthetic distractors

## 5. Expected Quality Bar
AP Biology demands precise, unambiguous terminology aligned to CED learning objectives; every answer must be the specific term a student would use on the AP exam.

## 6. Known Risk Areas
- **`term_definitions_long` POOL-CONTAM**: 214 facts span 8 biological domains — molecular, cellular, genetic, evolutionary, ecological. Distractors drawn from this pool will frequently cross sub-domain boundaries (e.g., molecular biology terms appearing alongside ecology terms).
- **`bracket_numbers` TEMPLATE-MISFIT**: The pool contains a date fact (Darwin 1859) whose question stem asks "What was this book's main contribution to biology?" — the correct answer is the year, but the question asks for a conceptual contribution. This is a question/answer type mismatch.
- **`comparison_terms` LENGTH-TELL**: Pool marked homogeneityExempt with 55 long-form comparison answers; if shorter answers appear alongside them, length reveals the correct answer.
- **`bio_concept_terms` POOL-CONTAM**: 141 facts span all CED units; distractors may mix evolutionary with cellular terms.
- **SELF-ANSWERING risk in equation pools**: Logistic growth equation fact `ap_bio_u8_041` — the rendered question may quote the equation that is also the correct answer.
- **`signal_molecule_names` LENGTH-TELL**: cAMP (4 chars) vs longer hormone names — extreme length disparity possible.
