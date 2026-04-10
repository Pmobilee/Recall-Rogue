# mammals_world — Quiz Audit Findings

## Summary
30 unique facts sampled across 90 quiz dump entries (3 mastery levels each). Deck has 170 facts and 10 pools. The dominant issue is systemic POOL-CONTAM across all three stats pools (stats_short, stats_medium, stats_long): each mixes incompatible measurement units — kilograms, kilometers, centimeters, decibels, percentages, hours, km/h, and unitless counts appear as distractors for each other. A player quizzed on polar bear fat thickness (answer: "5-10 cm") sees options including "40,000" (electroreceptor count), "~20%" (grizzly diet %), and "96%" (rhinoceros population decline) — all instantly eliminatable by unit mismatch. The `term` pool similarly mixes one-sentence behavioral descriptions with proper nouns and factual definitions. Conservation_terms and bracket_numbers pools are below the 15-member target. No chain themes defined.

Severity breakdown: 2 BLOCKER, 3 MAJOR, 3 MINOR, 1 NIT.

---

## Issues

### BLOCKER

---

- **Fact**: `mamm_0_polarbear_fat` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How thick is a polar bear fat layer, which insulates it against Arctic cold?"
   A) 5-10 cm ✓
   B) 40,000
   C) ~45 cm
   D) ~20%
   E) 96%
- **Issue**: `stats_short` pool mixes measurement dimensions: thickness in cm (5-10 cm, ~45 cm), population count (40,000), diet percentage (~20%), population loss percentage (96%). A player cannot confuse "5-10 cm" with "40,000" or "96%" — these are not plausible wrong answers for a thickness question. The pool must be split by measurement type (length/thickness, mass, speed, count, percentage) to produce plausible distractors.

---

- **Fact**: `mamm_0_spermwhale_brain` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "The sperm whale has the largest brain of any animal on Earth. How much does it weigh on average?"
   A) 800 kg
   B) ~7.08 kg ✓
   C) 66 kg
   D) ~91 kg
   E) ~180 kg
- **Issue**: Within stats_short, mass values (800 kg, 66 kg, ~91 kg, ~180 kg) and the correct brain weight (~7.08 kg) appear together — this subset is actually mass-homogeneous and works. However the full pool also contains "~107,000" (sea otter count), "2 hours" (sleep), "1.23%" (DNA), "104 km/h" (speed), "~25 km" (wolf distance) which would appear at different mastery levels. This specific rendering accidentally draws only mass values (because brain weight question selects from weight-range synthetics), but another question in the pool could render "104 km/h" as a weight distractor. The BLOCKER is pool-level, not this specific render.

---

### MAJOR

---

- **Fact**: `mamm_4_cons_thylacine_cause` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What was the primary direct cause of thylacine extinction?"
   A) Survives only in captivity or outside its native range (52ch)
   B) Drowning in illegal gillnets targeting totoaba fish (51ch)
   C) They have shorter vocal folds that do not produce a roar (56ch)
   D) Extinct in the Wild (19ch)
   E) Bounty hunting (government-sponsored killing rewards) ✓ (53ch)
- **Issue**: "Extinct in the Wild" (19ch) is approximately 3× shorter than all other options (51–56ch). A player can eliminate it instantly by length alone, reducing the effective choice to 4. This is above the 3× threshold that triggers FAIL in homogeneity checks.

---

- **Fact**: `mamm_1_rec_heaviestseal` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "which animal species holds the record as the heaviest, with males weighing up to 4,000 kg?"
   A) Critically Endangered
   B) Elephants and rhinos
   C) Southern elephant seal ✓
   D) Howler monkey (Alouatta)
   E) Cuvier beaked whale
- **Issue**: Option A "Critically Endangered" is an IUCN status category, not a species name. It appears here because `name_long` pool shares the quiz with `conservation_terms` pool synthetics, or because conservation facts and name facts share the same pool. "Critically Endangered" is eliminatable in under one second — a POOL-CONTAM between species names and conservation status labels. Also: question starts lowercase "which" — minor grammar issue.

---

- **Fact**: `mamm_2_tax_primates_suborders` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Primates are divided into two suborders. What are they, and which group includes humans?"
   A) Devil Facial Tumour Disease (DFTD)
   B) Dirt does not fall into the pouch when digging
   C) Strepsirrhini and Haplorhini ✓
   D) Endangered, with fewer than 2,000 mature individuals
   E) Heart rate halves and breathing becomes barely detectable
- **Issue**: `term` pool mixes suborder names (Strepsirrhini and Haplorhini), a disease name (DFTD), a behavioral description about pouch orientation, a conservation status sentence, and a physiological state description — all as distractors for each other. None of these distractors is a plausible wrong answer for "what are the two primate suborders?"

---

### MINOR

---

- **Fact**: `mamm_0_kangaroo_diapause` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What is the term for the red kangaroo ability to pause the development of a new embryo until the current joey leaves the pouch?"
   A) ~20 hours
   B) Embryonic diapause ✓
   C) Up to 5.7 m
   D) At least 93%
   E) Under 3 seconds
- **Issue**: `stats_medium` pool appears here as the question pool, but the correct answer "Embryonic diapause" is a terminology answer, not a stat. At mastery=4, distractors include "~20 hours" (a time stat from a different question), "Up to 5.7 m" (a height stat), "At least 93%" (a percentage), and "Under 3 seconds" (a time stat). These are clearly incompatible with "Embryonic diapause" by format — a term vs. five numeric measurements.

---

- **Fact**: `mamm_3_beh_humpback_shared` @ mastery=4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "All male humpback whales in a given region produce the same acoustic display, and that display changes gradually over time. What does this phenomenon represent?"
   A) Males only; spurs on the hind legs
   B) Cultural transmission
   C) Swarm intelligence
   D) Trophic cascade (or ecology of fear)
   E) Cultural evolution in animal song ✓
- **Issue**: Options B "Cultural transmission" and E "Cultural evolution in animal song" share the word "Cultural." A student who knows the answer involves cultural transmission/evolution can narrow to two options containing "Cultural" — and may then choose incorrectly (B is technically correct for humpback songs as a mechanism, while E is the more specific answer). Both B and E are partially correct, making this a SYNONYM-LEAK and potentially an AMBIGUOUS-Q.

---

- **Fact**: `mamm_2_tax_neocortex` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Which brain region is found in mammals but not in reptiles or birds, associated with higher cognitive functions?"
   A) About one-third
   B) Neocortex ✓
   C) Bowhead whale
   D) Central Iran
   E) Pakicetus
- **Issue**: `name_short` pool mixes brain region names (Neocortex), fraction/proportion answers ("About one-third"), animal names (Bowhead whale, Pakicetus), and geographic names (Central Iran). "Central Iran" and "Bowhead whale" are trivially eliminatable as answers for a brain region question.

---

### NIT

---

- **Fact**: `mamm_0_elephant_mirror` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "An elephant named Happy became famous for passing which classic animal cognition test?"
   A) Liver enzymes detoxify eucalyptus phenolics and terpenes
   B) First wild animal to self-medicate with medicinal plants
   C) Highest jaw compression per bone volume among carnivores
   D) The mirror self-recognition test ✓
   E) Their low body temperature prevents rabies from reproducing
- **Issue**: `term` pool mixes the test name ("The mirror self-recognition test") with random behavioral/physiological facts about different animals. All four wrong options describe different animals (koala, orangutan, wolverine, Virginia opossum) with no relation to elephant cognition tests. Implausible as wrong answers — a student eliminates by domain match.

---

## Expected vs Actual

Expected: Engaging mammal facts with plausible distractors — wrong weights for weight questions, wrong speeds for speed questions, wrong species for species questions.

Actual: Stats pools are the deck's primary failure — all three (short/medium/long) are effectively "all numeric answers regardless of unit" which creates absurd distractor combinations. The `term` pool similarly conflates incompatible semantic types. The `name_short` pool mixes species names with geographic names and fractions. The fundamental architecture needs unit-based splits for stats pools (weight_kg, length_m, percentage, speed_kmh, etc.) and topic-based splits for term/name pools.

---

## Notes

- `behavior_descriptions_short` and `behavior_descriptions_long` pools are well-formed — behavioral descriptions within each pool are semantically compatible and produce plausible distractors.
- `conservation_terms` pool (7 facts + 5 synth = 12) is below the 15-target. The 7 facts (IUCN categories, extinction causes) are semantically homogeneous — just needs 3 more synthetics.
- The `bracket_numbers` pool (13 facts, no synth) is below 15-target but numbers within the pool span very different ranges (6,495 mammal species vs 2011 extinction year vs 4,900 cheetahs) — some LENGTH-TELL risk at mastery=4 but not severe since all are 4-5 digit numbers.
- No chain themes or formal sub-deck chain groupings defined.
