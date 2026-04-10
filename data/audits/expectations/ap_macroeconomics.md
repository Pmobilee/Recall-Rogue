# ap_macroeconomics — Expectations

## 1. Intended Scope
Full coverage of all 6 units of the AP Macroeconomics CED (College Board), from basic economic concepts through international economics, aligned to the exam's graphical and conceptual approach.

## 2. Canonical Source
College Board AP Macroeconomics CED. Units:
- Unit 1: Basic Economic Concepts
- Unit 2: Economic Indicators and the Business Cycle
- Unit 3: National Income and Price Determination
- Unit 4: Financial Sector
- Unit 5: Long-Run Consequences of Stabilization Policies
- Unit 6: Open Economy — International Trade and Finance

## 3. Sub-Deck / Chain Theme List
No sub-decks defined (empty array). 11 chain themes: The Economic Engine, Measuring the Machine, The Business Cycle, Aggregate Supply & Demand, Fiscal Firepower, The Banking Vault, The Money Machine, The Phillips Frontier, Growth & Debt, The Global Market, Trade & Policy.

## 4. Answer Pool Inventory
25 pools. Notable:
- `macro_concept_terms_mid` (130 factIds, no synth) — dominant pool, very large
- `shift_direction_terms_macro_long` (28 factIds, no synth) — shift descriptions
- `policy_type_terms_long` (21 factIds, no synth)
- `macro_concept_terms_long` (64 factIds, no synth)
- `shift_direction_terms_macro_short` (15 factIds, no synth)
- `curve_and_graph_names_macro_short` (19 factIds, no synth)
- Several small pools (3–6 factIds) in equation and formula categories — risk of too-few real members
- `equation_symbols` (4 factIds, 12 synth), `equation_short_terms` (3 factIds, 12 synth) — very small real fact sets

## 5. Expected Quality Bar
AP Macroeconomics requires graphical precision (knowing which curve shifts which direction under which conditions) and algebraic formula literacy; distractors must use real macroeconomic terms, not cross into microeconomics vocabulary.

## 6. Known Risk Areas
- **BROKEN-GRAMMAR "this" placeholder**: Multiple question stems contain "Irving This", "Federal this", "bank this", "capital this" — template word-substitution failure leaving "this" as a visible noun placeholder. BLOCKER-level rendering issues.
- **`macro_concept_terms_mid` POOL-CONTAM**: 130 facts spanning all macroeconomic topics — GDP concepts, monetary policy, fiscal policy, business cycle, and BOP all draw distractors from the same pool.
- **`fed_tool_names` POOL-CONTAM + SYNONYM-LEAK**: Correct answer is the composite "Open market operations, discount rate, reserve requirement" but the pool also contains the individual tool names as members — making distractors that are subsets of the correct answer.
- **`multiplier_type_terms` SYNONYM-LEAK**: "Spending multiplier" and "Spending multiplier is larger" appear as distinct options — trivially eliminable as near-duplicates.
- **`equation_formulas_macro_mid` TEMPLATE-MISFIT**: Fact `ap_macro_2b_039` has correct answer "Fisher equation" (a name) but is in the formula pool — distractors are formulas/equation-style answers, not names.
- **`curve_and_graph_names_macro_short/long`**: Questions about curve behavior without accompanying visuals — ambiguous for students who need to see the graph shape.
