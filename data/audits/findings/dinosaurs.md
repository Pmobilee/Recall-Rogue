# dinosaurs — Quiz Audit Findings

## Summary
29 unique facts sampled across 87 quiz dump entries (3 mastery levels each). Deck has 187 facts and 6 pools. The dominant issue is a catastrophic POOL-CONTAM in `misc_concepts_short`: this pool mixes boolean answers ("False"), geographic names ("China"), fossil proper names ("Sue"), and anatomical terms ("Teeth", "Fish") into a single distractor pool. The quiz renders distractors like "Fish" and "Sue" for questions about geological dates, and "Giraffe"/"Monitor lizard" appear as distractors for Jurassic period date-range questions because `misc_concepts_long` has the same heterogeneity problem. Image quiz facts render correctly (single-option, image differentiates). No chain themes or sub-decks defined.

Severity breakdown: 1 BLOCKER, 3 MAJOR, 3 MINOR, 1 NIT.

---

## Issues

### BLOCKER

---

- **Fact**: `dino_plesiosaurus_neck_myth` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "True or false: Plesiosaurus could raise its long neck high above the water surface like a swan."
   A) False ✓
   B) China
   C) Teeth
   D) Sue
   E) Fish
- **Issue**: This is a true/false question. The only valid distractors are "True" (and possibly "Uncertain"). Instead `misc_concepts_short` provides geographic names (China), fossil names (Sue), and biological terms (Teeth, Fish) as distractors. These are not eliminatable by knowledge — they are eliminatable by common sense (a yes/no question cannot be answered with "China"). This is the clearest pool contamination failure in the batch.

---

### MAJOR

---

- **Fact**: `dino_jurassic_dates` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "The Jurassic period spanned approximately from how many million years ago to how many million years ago?"
   A) 252–201
   B) 201–145 ✓
   C) Giraffe
   D) Monitor lizard
   E) Live young
- **Issue**: `misc_concepts_long` pool contains both date-range answers ("252–201", "201–145") and animal names ("Giraffe", "Monitor lizard") and biological descriptions ("Live young"). These are from entirely different semantic categories. A date-range question cannot plausibly have "Giraffe" as a wrong answer — the distractor is eliminatable in under one second.

---

- **Fact**: `dino_feathered_liaoning` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Where were the feathered dinosaur fossils discovered in the 1990s that revolutionized our understanding of dinosaur evolution?"
   A) Sue
   B) Teeth
   C) 145–66
   D) China ✓
   E) False
- **Issue**: A geography question ("Where were they found?") has distractors including "Sue" (a fossil name), "Teeth" (an anatomical term), "145–66" (a date range), and "False" (a boolean). None are plausible geographic wrong answers. Only "China" fits the question type — all distractors are from incompatible semantic categories and eliminatable instantly.

---

- **Fact**: `dino_triassic_dates` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "The Triassic period lasted from approximately how many million years ago to how many million years ago?"
   A) Herbivore
   B) Giraffe
   C) Live young
   D) 252–201 ✓
   E) 201–145
- **Issue**: Date-range question with animal-trait distractors ("Herbivore", "Giraffe", "Live young"). Same root cause as dino_jurassic_dates — `misc_concepts_long` pool is internally incoherent.

---

### MINOR

---

- **Fact**: `dino_quetzalcoatlus_name_origin` @ mastery=any
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "The giant pterosaur Quetzalcoatlus was named after a feathered serpent deity of [Aztec mythology]. What was this deity called?"
   A: Quetzalcoatl
- **Issue**: "Quetzalcoatlus" and "Quetzalcoatl" differ only by the suffix "-us." A player reading "Quetzalcoatlus" has essentially already read the answer. No knowledge required beyond the ability to strip a Latin suffix.

---

- **Fact**: `dino_richard_owen_nhm` @ mastery=any
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Richard Owen, who coined the term 'Dinosauria', founded which famous natural history museum?"
   A: Natural History Museum
- **Issue**: The question context strongly implies a single institution — "the famous natural history museum in London" would be the only plausible answer. However with no distractors visible (not in the quiz dump sample), we note it from source JSON. The question framing makes this easy to answer by elimination.

---

- **Fact**: `dino_kpg_species_lost` @ mastery=4
- **Category**: `NUMERIC-WEAK`
- **Rendered**:
  Q: "The K-Pg extinction event 66 million years ago wiped out approximately what percentage of all species on Earth?"
   A) 75 ✓
   B) 55
   C) 95
   D) 96
   E) 56
- **Issue**: Options 95 and 96 are near-identical (1 unit apart). A student who knows it is "around 75%" correctly answers; but the 55/56 pair and the 95/96 pair are nearly-duplicate distractors. Additionally, "96%" appears to be a reference to the Permian extinction (96% species loss), not the K-Pg — if a student confuses the two events, 96% is a factually correct answer for a different extinction and therefore a FACTUAL-SUSPECT distractor choice.

---

### NIT

---

- **Fact**: `dino_spinosaurus_length` @ mastery=any
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "Approximately how many meters long was Spinosaurus?"
   A: 14
- **Issue**: The current scientific consensus (Ibrahim et al. 2020) estimates Spinosaurus at 14–15 m based on a more complete specimen. The answer "14" is at the low end of the current estimate range and could be contested. Not definitively wrong but worth flagging as a value that may need updating with new paleontological literature.

---

## Expected vs Actual

Expected: Clean dinosaur trivia with species names, geological periods, and numeric measurements as the main quiz types. Distractors should be wrong but plausible (e.g. wrong geological period, wrong measurement).

Actual: `misc_concepts_short` and `misc_concepts_long` pools are unusable in their current form — they mix boolean, geographic, temporal, taxonomic, and behavioral answer types into a single pool, creating absurd distractor combinations. The geological periods pool and dinosaur_names pool work well (period distractors are other geological periods; name distractors are other dinosaur names). The fundamental design error is forcing all "other" content into two catch-all pools.

---

## Notes

- Image quiz facts (dino_img_archaeopteryx, dino_img_diplodocus, etc.) correctly render with 1 option — image is the differentiator. Not an issue.
- `paleontologist_names` pool works well: 9 real names (Mary Anning, Roy Chapman Andrews, Othniel Charles Marsh, Paul Sereno, Natural History Museum) with 13 appropriate synthetic paleontologist/institution names as distractors. Semantically homogeneous.
- `geological_periods` pool is clean: all options are "Late/Early/Middle Jurassic/Cretaceous/Triassic/Permian" — homogeneous format, correct difficulty gradient.
- No sub-decks or chain themes defined — this is a structural issue meaning the chain/theme system cannot engage for this deck.
