# ap_physics_1 — Expectations

## 1. Intended Scope
Full coverage of all 8 units of the AP Physics 1 CED (College Board, effective Fall 2021), from kinematics through fluid dynamics, aligned to the exam's algebra-based approach.

## 2. Canonical Source
College Board AP Physics 1: Algebra-Based CED (effective 2021). Units:
- Unit 1: Kinematics
- Unit 2: Force and Translational Dynamics
- Unit 3: Work, Energy, and Power
- Unit 4: Linear Momentum
- Unit 5: Torque and Rotational Dynamics
- Unit 6: Energy and Momentum of Rotating Systems
- Unit 7: Oscillations
- Unit 8: Fluids

## 3. Sub-Deck / Chain Theme List
8 sub-decks mapping 1:1 to CED units. 10 chain themes:
The Vector Forge, Freefall Frontier, Force Fields, The Friction Workshop, Energy Transformers, The Momentum Arena, The Torque Engine, Spinning Systems, Oscillation Chamber, The Fluid Depths.

## 4. Answer Pool Inventory
12 pools:
- `concept_statements` (123 factIds, homogeneityExempt) — largest; conceptual explanations
- `equation_explanations` (44 factIds, homogeneityExempt) — mixed formula+explanation answers
- `equation_identifiers` (31 factIds, no synth) — formula recognition
- `term_definitions` (37 factIds, no synth) — term-to-definition
- `physics_short_formulas` (19 factIds, 8 synth) — short symbolic formulas
- `law_principle_names` (17 factIds, no synth) — named laws
- `quantity_definitions` (15 factIds, no synth) — physics quantity definitions
- `unit_conversions` (12 factIds, 3 synth) — SI unit expressions
- `graph_interpretations` (10 factIds, 5 synth) — graph reading
- `rotational_quantities` (7 factIds, 8 synth)
- `bracket_numbers` (6 factIds, no synth)
- `force_type_names` (5 factIds, 10 synth)

## 5. Expected Quality Bar
AP Physics 1 demands algebra-level precision; formula distractors must be real formulas (not nonsense), and conceptual questions must have exactly one defensibly correct answer among plausible-but-wrong alternatives.

## 6. Known Risk Areas
- **`term_definitions` POOL-CONTAM**: Mixes pure definitional terms ("scalar") with condition-statements ("rotational equilibrium: Στ = 0") — correct answer format inconsistency within pool.
- **`equation_explanations` homogeneityExempt**: 44 facts with variable-length equation-plus-explanation answers; some are very long multi-clause descriptions while others are short symbolic equations. LENGTH-TELL risk is high.
- **`graph_interpretations` POOL-CONTAM**: Facts about graph-reading appear alongside conceptual statements in distractors, making it trivially easy to eliminate non-graph-related options.
- **`unit_conversions` NUMERIC-WEAK**: The pool contains SI unit expressions where the correct answer includes compound units (kg⋅m²/s²) while distractors may name different physical quantities entirely.
- **`concept_statements` heterogeneity**: 123 facts covering all 8 CED units — distractors will cross topic boundaries (kinematics facts appearing as distractors in rotational dynamics questions).
