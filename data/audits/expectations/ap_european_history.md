# ap_european_history — Pre-Read Expectations

## 1. Intended Scope
AP European History curriculum, c. 1450–present: Renaissance, Reformation, Absolutism, Scientific Revolution, Enlightenment, French Revolution, Napoleon, Industrialization, Imperialism, WWI, WWII, Cold War, contemporary Europe.

## 2. Canonical Source / Exam Alignment
AP European History (College Board). Facts carry `examTags` with unit/topic references. Should align to the 9 AP Euro units with content distribution matching exam weighting.

## 3. Sub-Deck / Chain Theme List
9 sub-decks:
- Renaissance & Exploration
- Age of Reformation
- Absolutism & Constitutionalism
- Scientific Revolution & Enlightenment
- French Revolution & Napoleon
- Industrialization & Its Effects
- Age of Imperialism
- World Wars
- Cold War & Contemporary Europe

## 4. Answer Pool Inventory
| Pool ID | Size | Answer Type |
|---|---|---|
| concept_terms_short | 93 factIds + 0 synth | Short concept names (≤~15 chars) |
| concept_terms_long | 92 factIds + 0 synth | Long concept descriptions |
| date_answers_short | 26 factIds + 0 synth | Short dates ("1814–1815") |
| date_answers_long | 11 factIds + 4 synth | Longer date phrases |
| document_names_short | 20 factIds + 0 synth | Short document/work titles |
| document_names_long | 35 factIds + 0 synth | Longer document/treaty titles |
| event_names_short | 31 factIds + 0 synth | Short event names |
| event_names_long | 32 factIds + 0 synth | Longer event descriptions |
| institution_names | 21 factIds + 0 synth | Institution/organization names |
| movement_names | 9 factIds + 6 synth | Movement/ideology names |
| person_names_short | 51 factIds + 0 synth | Short person names |
| person_names_long | 51 factIds + 0 synth | Longer person names/titles |
| place_names_short | 16 factIds + 0 synth | Short place names |
| place_names_long | 14 factIds + 1 synth | Longer place names |
| year_dates | 65 factIds + 0 synth | Year-only dates |
| bracket_numbers | 5 factIds + 0 synth | Numbers |

This pool architecture is well-designed with systematic short/long splits. Pools have ≥5 members. No single dominant heterogeneous catch-all pool (unlike ancient_greece). This is the best pool design in the batch.

## 5. Expected Quality Bar
Highest expected quality — explicit AP exam alignment with unit/topic/weight tags. Pools are properly split by length. Should have few POOL-CONTAM issues. Primary risks are semantic mismatch within pools and distractor quality for `concept_terms_long`.

## 6. Known Risk Areas
1. **`concept_terms_short` and `concept_terms_long` cross-contamination** — Both pools are large (93/92 facts). If a question from `concept_terms_short` draws distractors from the same pool, time-period mixing is possible ("War Communism" as distractor for a Renaissance question).
2. **`date_answers_short` format mixing** — Pool contains "1814–1815" (year range) and "October 1962" (month-year) — format heterogeneity could produce FORMAT-TELL.
3. **AP alignment completeness** — Some facts use array-format `examTags` ("AP_European_History", "Unit_5") while others use object format (`{exam:..., unit:..., topic:...}`). Inconsistent tagging schema may indicate inconsistent coverage.
4. **TEMPLATE-MISFIT** — "72 years" (Louis XIV reign length) in `concept_terms_short` is a numeric answer in a concept-terms pool — likely a pool misassignment.
5. **AMBIGUOUS-Q** — Some `concept_terms_long` questions may have answers that are descriptive clauses rather than established historical terms.
