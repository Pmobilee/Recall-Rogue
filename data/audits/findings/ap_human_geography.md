# ap_human_geography — Quiz Audit Findings

## Summary
The AP Human Geography deck (120 quiz items, 40 facts × 3 mastery levels) has the most complex pool architecture of any AP deck (42 pools, with duplicate pool IDs) but is largely functional at the quiz level. One BLOCKER: the `bracket_numbers` pool has only 5 real factIds and no synthetic distractors — at mastery 0, the pool can produce only 2 distractors for a 3-option question, and the sampled item shows 3 plausible but unnuanced numeric options. One BROKEN-GRAMMAR BLOCKER: `aphg_u2_guest_workers` question stem is missing a noun ("temporary foreign [workers] recruited") producing a grammatically incomplete question. The deck's most pervasive structural issue is the no-chain-themes problem: 14 chainThemeId values appear in facts but the chainThemes array is empty, meaning the thematic grouping system is inoperative. Several tiny pools (2-3 factIds, even with synthetics) produce repetitive distractor sets. Total distinct issues: 2 BLOCKER, 3 MAJOR, 4 MINOR.

## Issues

### BLOCKER
- **Fact**: `aphg_u2_guest_workers` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "What are temporary foreign **recruited** to fill labor shortages in a receiving country called?"
- **Issue**: The noun "workers" is missing — the question should read "What are temporary foreign workers recruited to fill labor shortages…called?" As rendered, "temporary foreign recruited" is not a grammatical noun phrase. The question is incomprehensible without inferring the missing word. This renders at all three mastery levels.

---

### BLOCKER
- **Fact**: `aphg_u4_038` @ mastery=0
- **Category**: `NUMERIC-WEAK`
- **Rendered**:
  Q: "Under the UN Convention on the Law of the Sea (UNCLOS), how many nautical miles from a country's coast extends the Exclusive Economic Zone (EEZ)?"
  A) 100
  B) 300
  C) 200 ✓
- **Issue**: Pool `bracket_numbers` (5 factIds, 0 synth). All three options are round numbers (100, 200, 300) — sequential multiples that feel arbitrary rather than plausible wrong values. 12 nautical miles (territorial sea) and 24 nautical miles (contiguous zone) would be more pedagogically meaningful distractors since they are the actual alternative UNCLOS distance thresholds. The current distractors test whether students know "200" but not why 200 rather than alternative real treaty values. Additionally, the pool has no synthetic distractors defined despite needing padding — the quiz engine is generating distractors from the 4 other factIds in this tiny pool, and the options show it.

---

### MAJOR
- **Fact**: `aphg_u1_gis_definition` @ mastery=0
- **Category**: `POOL-CONTAM` + `NUMERIC-WEAK` (acronym context)
- **Rendered**:
  Q: "Which technology overlays multiple spatial data layers to create comprehensive analytical maps?"
  A) GFS
  B) GPS
  C) GIS ✓
- **Issue**: Pool `unit1_acronym_terms` (2 factIds, 0 synth). With only 2 real facts in the pool, the quiz engine generates the 3-letter acronym distractors ("GFS", "GPS") from synthetic sources or from the one other pool member. "GFS" is not a standard geographic acronym in AP Human Geography curricula. "GPS" (Global Positioning System) is a real technology, but it does not overlay spatial layers — it is a location service. The distractors are formally correct as wrong answers but "GPS" is specifically a geography technology that students should know is different from GIS for different reasons. If both appear as options and a student confuses GIS/GPS, the question is not testing GIS understanding but acronym recall. The tiny pool means distractor variety will be exhausted after 1-2 plays.

---

### MAJOR
- **Fact**: Multiple — duplicate pool ID `unit5_agriculture_concept_terms_long` and `unit7_economic_concept_terms_long`
- **Category**: `OTHER` (structural)
- **Issue**: The pool array contains two entries with ID `unit5_agriculture_concept_terms_long` (10 + 8 factIds) and two entries with ID `unit7_economic_concept_terms_long` (9 + 10 factIds). Duplicate pool IDs mean the quiz engine may use only one of the definitions or exhibit undefined behavior when selecting distractors. The second occurrence of each duplicated pool likely shadows the first, meaning some facts assigned to the duplicate are never actually served as distractors. This is a structural schema error that affects all facts whose `answerTypePoolId` maps to the shadowed pool.

---

### MAJOR
- **Fact**: `aphg_u2_push_pull_factors` @ mastery=0
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "In migration theory, what are conditions that drive people away from their origin country called?"
  A) push ✓
  B) pull
  C) draw
- **Issue**: Pool `unit2_short_stage_terms`. "Push" and "pull" are the canonical pair in migration theory — they are direct antonyms by definition. A student who knows the question is asking about "push" factors (driving people AWAY) can immediately eliminate "pull" (which drives people TOWARD). The distractor "draw" is a near-synonym of "pull" — also eliminable for the same reason. At mastery 0, the quiz presents the perfect conceptual pair as options, making the answer deducible from basic reasoning about the question stem ("drive people AWAY" = not "pull").

---

### MINOR
- **Fact**: `aphg_u2_forced_migration` @ mastery=0
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "What type of migration occurs when people have little or no choice but to leave due to conflict, persecution, or disaster?"
  A) refugee
  B) step
  C) forced ✓
- **Issue**: Pool `migration_short_types`. "Refugee" is a specific category of forced migrant — it is a hyponym of "forced migration," not an independent alternative. A student who knows "refugee" status is a subset of forced migration can reason that "forced" is the broader category answer the question seeks. At mastery 0 with only 3 options, this near-hyponym relationship makes the quiz trivial.

---

### MINOR
- **Fact**: `aphg_u2_nir` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What is subtracted from the crude birth rate to calculate natural increase rate (NIR)?"
  A) GNI per capita
  B) crude death rate ✓
  C) dependency ratio
- **Issue**: Pool `economic_indicator_names` (homogeneityExempt). The question is a demographic calculation (birth rate minus X), but "GNI per capita" and "dependency ratio" are economic development indicators, not demographic rate calculations. They are in the pool because it is exempt from homogeneity, but the semantic cross-domain contamination is severe — GNI per capita cannot be subtracted from a rate to get another rate. Trivially eliminable by unit analysis.

---

### MINOR
- **Fact**: `aphg_u3_mcdonaldization` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "The CED describes 'McDonaldization' as an example of what broader outcome of globalization on world cultures?"
  A) material culture
  B) cultural nationalism
  C) cultural homogenization ✓
- **Issue**: Pool `unit3_cultural_concept_terms_long`. "Material culture" and "cultural nationalism" are relevant cultural geography terms, making this a good distractor set — these are real alternatives a student might confuse. The question is appropriately scoped and the distractors are domain-appropriate. However, "cultural nationalism" is somewhat eliminable because "McDonaldization" is the opposite of nationalism (it spreads one culture globally rather than protecting local culture). MINOR — better than most distractor sets in this deck.

---

### NIT
- **Fact**: `aphg_u2_guest_workers` (secondary issue)
- **Category**: `POOL-CONTAM`
- **Rendered** (options):
  A) guest workers ✓
  B) chain migration
  C) internally displaced person
- **Issue**: Beyond the BROKEN-GRAMMAR issue in the question stem, the distractors are reasonable — both "chain migration" and "internally displaced person" are migration-related terms, though "internally displaced person" (IDP) is a protection status, not a labor recruitment category. Mild POOL-CONTAM between labor migration and displacement/refugee concepts.

---

### NIT
- **Fact**: `aphg_u1_five_themes` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Location, place, human-environment interaction, movement, and region are the five organizing principles of what geographic framework?"
  A) relative location
  B) Five Themes of Geography ✓
  C) spatial analysis
- **Issue**: Pool `unit1_spatial_concept_terms_long` (homogeneityExempt). "Relative location" is a type of location (one of the five themes' sub-concepts), and "spatial analysis" is a GIS method. Both are geographic terms but neither is a framework/model name, while the correct answer is. Students can eliminate A and C because neither is a "framework name" format — the question asks for a proper noun framework name.

## Expected vs Actual

**Expected**: Duplicate pool IDs causing structural issues. **Confirmed**: `unit5_agriculture_concept_terms_long` and `unit7_economic_concept_terms_long` each appear twice.

**Expected**: Very small pools (2-3 factIds) producing repetitive distractors. **Confirmed**: `unit1_acronym_terms` (2 factIds) produces only 2 real distractors; bracket_numbers (5 factIds) lacks synthetics.

**Expected**: `geographer_names` POOL-CONTAM from different geographic sub-fields. **Confirmed but acceptable**: Burgess, Weber, Malthus are all genuine geographers/relevant theorists — the contamination is across geographic sub-fields but all are plausible wrong answers for any geographer question.

**Expected**: BROKEN-GRAMMAR in question stems. **Confirmed**: One severe case (aphg_u2_guest_workers missing "workers").

**Expected**: No chain themes defined would cause system failure. **Confirmed**: chainThemes array is empty despite 14 chain theme IDs in use.

## Notes

The chain themes absence (empty `chainThemes` array) is a significant structural issue that affects the game's knowledge chain system — chain-based gameplay rewards cannot function for this deck since no chain theme names or sub-deck mappings are defined. This should be flagged to the content team as a missing configuration, not a quiz quality issue.

The 42-pool architecture — while fragmented — actually serves the deck better than the two-mega-pool approach of macroeconomics. The unit-specific pools (unit2_population_concept_terms_short/long, etc.) produce better within-unit distractor homogeneity than a single catch-all pool would. The main fix needed is the duplicate pool IDs.
