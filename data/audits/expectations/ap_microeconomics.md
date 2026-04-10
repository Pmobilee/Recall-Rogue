# ap_microeconomics — Expectations

## 1. Intended Scope
Full coverage of all 6 units of the AP Microeconomics CED (College Board), from basic economic concepts through market failures and the role of government, aligned to the exam's graphical and analytical approach.

## 2. Canonical Source
College Board AP Microeconomics CED. Units:
- Unit 1: Basic Economic Concepts
- Unit 2: Supply and Demand
- Unit 3: Production, Cost, and the Perfect Competition Model
- Unit 4: Imperfect Competition
- Unit 5: Factor Markets
- Unit 6: Market Failure and the Role of Government

## 3. Sub-Deck / Chain Theme List
No sub-decks defined (empty array). 10 chain themes: The Invisible Hand, The Market Crossroads, Price Signals, The Cost Machine, The Profit Calculator, The Monopoly Engine, The Competition Spectrum, Factor Markets, Market Failures, The Policy Toolbox.

## 4. Answer Pool Inventory
25 pools. Notable:
- `econ_concept_terms_mid` (120 factIds, no synth) — dominant pool
- `econ_concept_terms_long` (64 factIds, no synth)
- `curve_and_graph_names_long` (20 factIds, no synth)
- `market_outcome_descriptions_long` (19 factIds, no synth)
- `shift_direction_terms_long` (22 factIds, no synth)
- `elasticity_type_terms` (14 factIds, homogeneityExempt) — elasticity taxonomy
- `equation_formulas_micro_long` (15 factIds, no synth)
- Several small pools (5–10 factIds) with synthetic distractors
- `surplus_welfare_terms_short` (14 factIds, 1 synth) — barely padded

## 5. Expected Quality Bar
AP Microeconomics requires precise graphical vocabulary (distinguishing MR, MC, ATC, AVC curves) and the ability to identify market structures unambiguously; distractors must not mix micro and macro terminology.

## 6. Known Risk Areas
- **`econ_concept_terms_mid` POOL-CONTAM**: 120 facts covering all micro topics — supply/demand, production costs, market structures, and factor markets all share one distractor pool.
- **`elasticity_type_terms` SYNONYM-LEAK**: "Elastic demand" and "Inelastic demand" as distractors when correct answer is one of these — near-antonym pairs trivially eliminable since they name themselves.
- **`surplus_welfare_terms_short` SYNONYM-LEAK**: "Deadweight loss" and "Deadweight loss is zero" appear as distinct options simultaneously — one is a subset/negation of the other.
- **`market_structure_names_short` SYNONYM-LEAK**: "monopoly" and "natural monopoly" both present as options — one is a specific type of the other.
- **`curve_and_graph_names_*` AMBIGUOUS-Q**: Questions referencing "on a monopoly graph" or "a line showing combinations" without the actual graph — visual-dependent concepts tested without visuals.
- **BROKEN-GRAMMAR**: One fact (`ap_micro_4a_040`) has "this" appearing as a placeholder in the question stem.
