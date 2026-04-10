# ap_human_geography — Expectations

## 1. Intended Scope
Full coverage of all 7 units of the AP Human Geography CED (College Board), from geographic concepts and tools through industrial and economic development patterns.

## 2. Canonical Source
College Board AP Human Geography CED. Units:
- Unit 1: Thinking Geographically
- Unit 2: Population and Migration
- Unit 3: Cultural Patterns and Processes
- Unit 4: Political Patterns and Processes
- Unit 5: Agriculture and Rural Land-Use Patterns and Processes
- Unit 6: Cities and Urban Land-Use Patterns and Processes
- Unit 7: Industrial and Economic Development Patterns and Processes

## 3. Sub-Deck / Chain Theme List
7 sub-decks mapping 1:1 to CED units. No chain themes defined — `chainThemeId` values 0–13 present in facts but not named in the chainThemes array.

## 4. Answer Pool Inventory
42 pools total — the most fragmented pool structure of any AP deck. Many pools have only 2–5 real factIds. Notable:
- `unit3_cultural_concept_terms_short` (16 factIds, homogeneityExempt)
- `unit2_population_concept_terms_long` (12 factIds, homogeneityExempt)
- `unit4_political_concept_terms` (12 factIds, homogeneityExempt)
- Duplicate pool ID `unit5_agriculture_concept_terms_long` appears twice and `unit7_economic_concept_terms_long` appears twice — structural issue
- Many tiny pools: `survey_method_names` (3 factIds), `region_type_names` (3 factIds), `language_family_names` (3 factIds), `migration_short_types` (3 factIds), `unit1_acronym_terms` (2 factIds), `economic_indicator_acronyms` (2 factIds) — pools with 2 real factIds cannot provide meaningful distractor variety even with synthetics

## 5. Expected Quality Bar
AP Human Geography requires precise geographic vocabulary — distinguishing model names, geographer names, concept terms, and spatial relationships must all be unambiguous; placename-vs-concept contamination is a frequent failure mode.

## 6. Known Risk Areas
- **DUPLICATE POOL IDs**: `unit5_agriculture_concept_terms_long` and `unit7_economic_concept_terms_long` each appear twice in the pool array — the second definition may shadow the first or cause unpredictable behavior.
- **`model_and_theory_names` POOL-CONTAM**: Mixes named geographic models (Central Place Theory, Epidemiological Transition Model, environmental determinism) — all are proper-noun answers but from wildly different geographic sub-fields.
- **BROKEN-GRAMMAR**: `aphg_u2_guest_workers` question stem reads "What are temporary foreign recruited to fill labor shortages" — missing noun ("workers") makes the question grammatically incomplete.
- **Very small pools without enough real facts**: Multiple pools with 2–3 factIds even with synthetics may produce repetitive distractor sets.
- **No chain themes defined**: All 14 chainThemeId values are present in facts but no chainThemes array entry exists — the thematic grouping system will not function for this deck.
- **`geographer_names` POOL-CONTAM**: Mixing geographers from entirely different fields (Weber: location theory; Burgess: urban models; Malthus: population) creates valid distractors but may also accidentally contaminate across very different sub-decks.
