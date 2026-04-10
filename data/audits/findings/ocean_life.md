# ocean_life — Quiz Audit Findings

## Summary
28 unique facts sampled across 84 quiz dump entries (3 mastery levels each). Deck has 182 facts and 15 pools. The deck has the only formally defined chain themes (5) among the six audited decks. Critical structural failures: `stats_compact` pool has 1 real fact (functional singleton — quiz engine cannot vary questions), `ocean_lists` has 1 real fact, `ocean_currents` has 2 real facts. Two NEAR-DUPLICATE option pairs emerge in quiz rendering: "300 teeth" vs "~300 teeth" (frilled shark) and "~300 species" vs "3" with an extreme length ratio. The `stats_compact_short` pool mixes depths, counts, percentages, and temperatures. Conservation status pool shows SYNONYM-LEAK between "Critically Endangered" and "From Endangered to Least Concern."

Severity breakdown: 2 BLOCKER, 3 MAJOR, 3 MINOR, 1 NIT.

---

## Issues

### BLOCKER

---

- **Fact**: `ocean_4_sea_turtle_annual_poaching` (sole member of `stats_compact` pool)
- **Category**: `NUMERIC-WEAK`
- **Rendered**:
  Q: "Approximately how many sea turtles were killed annually by poaching in Mexico and Nicaragua according to conservation studies?"
   A) 35,000 ✓
   B) 22,000
   C) 48,000
   D) 18,000
   E) 42,000
- **Issue**: `stats_compact` pool has exactly 1 real fact. All other options are synthetic. The quiz engine has no pool variety — this one fact will appear every time the pool is selected, and at higher mastery levels the distractors are entirely synthetic numbers with no connection to any other poaching fact in the deck. More critically, a singleton real-fact pool means the quiz engine cannot shuffle this fact around other real answers — it is permanently isolated.

---

- **Fact**: `ocean_1_frilled_shark_teeth` @ mastery=4
- **Category**: `DUPLICATE-OPT`
- **Rendered**:
  Q: "How many does the frilled shark have across its 25 rows, making it one of the most tooth-laden sharks?"
   A) 1986
   B) 3
   C) 200 teeth
   D) 300 teeth ✓
   E) ~300 teeth
- **Issue**: "300 teeth" (correct) and "~300 teeth" (distractor) are functionally identical — the only difference is the tilde prefix. A player cannot distinguish between these answers because they both state the same number. This is a duplicate-option failure where the distractor should have been "150 teeth" or "500 teeth" rather than approximately the same value. Additionally "3" (1ch) vs "300 teeth" (9ch) is a 9× LENGTH-TELL. Also note the question reads "How many does the frilled shark have" — missing the word "teeth" in the question stem (BROKEN-GRAMMAR).

---

### MAJOR

---

- **Fact**: `ocean_0_octopus_species_count` @ mastery=4
- **Category**: `LENGTH-TELL` + `POOL-CONTAM`
- **Rendered**:
  Q: "Approximately how many species of octopus are known?"
   A) ~300 species ✓ (12ch)
   B) 3 (1ch)
   C) 5 species (9ch)
   D) 7 species (9ch)
   E) 230,000+ (8ch)
- **Issue**: Option "3" (1ch) vs "~300 species" (12ch) is a 12× length ratio — the most extreme LENGTH-TELL in this batch. A single-digit number cannot plausibly be the answer to "how many species of octopus are known" — obvious by biological plausibility. "230,000+" appears to be from the ocean species count pool (total ocean species), not from a species-count-for-one-genus context — POOL-CONTAM between single-species counts and total biodiversity counts.

---

- **Fact**: `ocean_4_oceanic_whitetip_status` @ mastery=4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "What IUCN Red List status does the oceanic whitetip shark hold, a species once considered one of the most abundant large ocean animals?"
   A) Data Deficient (14ch)
   B) Critically Endangered ✓ (21ch)
   C) Endangered (10ch)
   D) Least Concern (13ch)
   E) From Endangered to Least Concern (32ch)
- **Issue**: Option E "From Endangered to Least Concern" contains both "Endangered" (wrong answer C) and partially suggests "Least Concern" (wrong answer D). More importantly, it describes a recovery trajectory rather than an IUCN category — it is not a valid IUCN status at all, making it an implausible option that students can eliminate by knowledge of IUCN categories. Additionally "Critically Endangered" (21ch) vs "Endangered" (10ch) is a 2.1× length ratio with a semantic overlap — students who don't know the exact status may guess "Endangered" over "Critically Endangered" without knowing the degree.

---

- **Fact**: `ocean_2_five_oceans` @ mastery=4
- **Category**: `DUPLICATE-OPT`
- **Rendered**:
  Q: "What are the five named oceans of the world?"
   A) Pacific, Atlantic, Antarctic, Indian, Southern
   B) Pacific, Atlantic, Indian, Red Sea, Arctic
   C) Pacific, Atlantic, Indian, Arctic, Antarctic
   D) Pacific, Atlantic, Indian, Southern, Arctic ✓
   E) Pacific, Atlantic, Indian, Mediterranean, Arctic
- **Issue**: Options A and C both contain "Antarctic" (wrong — the correct term is "Southern Ocean"). A student who knows the Southern Ocean was formerly called the Antarctic Ocean cannot clearly distinguish between A and C — both are plausible-sounding wrong answers that rely on the same piece of knowledge. More critically, options A ("Pacific, Atlantic, Antarctic, Indian, Southern") and D (correct: "...Indian, Southern, Arctic") differ by only word order — A contains "Southern" but in the wrong position and with "Antarctic" as an extra. With 5-element list answers, order-sensitivity creates near-duplicate options that require careful reading. This is a SINGLETON pool issue in disguise — only 1 real fact for "list of 5 oceans" means all distractors are synthetic and may be carelessly crafted.

---

### MINOR

---

- **Fact**: `ocean_4_humpback_whale_recovery` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "After recovering from a low of ~5,000 following the 1986 whaling moratorium, approximately how many humpback whales exist today?"
   A) 190 tonnes (10ch)
   B) ~80,000 ✓ (7ch)
   C) ~1°C (4ch)
   D) 37 meters (9ch)
   E) 3,688 m (7ch)
- **Issue**: `stats_compact_short` pool mixes population counts (~80,000), mass values (190 tonnes), temperature changes (~1°C), length measurements (37 meters), and depths (3,688 m). A population count question cannot plausibly have "~1°C" or "190 tonnes" as wrong answers — units make them instantly eliminatable. This is the ocean_life equivalent of the mammals_world stats pool contamination.

---

- **Fact**: `ocean_0_humpback_songs` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "which creature species is famous for producing complex, evolving songs that can last up to 20 minutes?"
   A) Blue-ringed octopus (19ch)
   B) Vaquita (7ch)
   C) North Atlantic right whale (26ch)
   D) Humpback whale ✓ (14ch)
   E) Orca (killer whale) (19ch)
- **Issue**: "Vaquita" (7ch) vs "North Atlantic right whale" (26ch) — ratio 3.7×. Vaquita is critically endangered with fewer than 20 individuals, an unlikely candidate for complex song production. It is eliminatable both by length and by biological knowledge. Also the question starts lowercase "which" — minor grammar issue.

---

- **Fact**: `ocean_3_dolphin_sponge_tool` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "which creature species is known to teach its young to use sea sponges as foraging tools to protect their beaks?"
   A) Orca (4ch)
   B) Sargasso Sea (12ch)
   C) Indo-Pacific bottlenose dolphin ✓ (31ch)
- **Issue**: "Sargasso Sea" is a geographic location, not a species name. It appears as a distractor for a species-name question — a geographic name cannot be a species answer. POOL-CONTAM between species names and geographic location names in the species_names pool synthetics. Ratio "Orca" (4ch) vs "Indo-Pacific bottlenose dolphin" (31ch) is 7.8× — severe LENGTH-TELL at low mastery.

---

### NIT

---

- **Fact**: `ocean_4_eutrophication_definition` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What ecological process describes excessive nutrient enrichment of water bodies, leading to algae blooms and oxygen depletion?"
   A) Eutrophication ✓ (14ch)
   B) Bottom trawling (15ch)
   C) CITES (5ch)
   D) Deep-sea mining (15ch)
   E) Mutualism (9ch)
- **Issue**: "CITES" (5ch) vs all others (9–15ch) — ratio 3.0×. "CITES" is also a treaty acronym, not an ecological process name, making it eliminatable by category (it's an institution/treaty, not a process). Both LENGTH-TELL and CATEGORY-TELL apply.

---

## Expected vs Actual

Expected: Marine biology quiz with plausible species, ecosystem, and conservation distractors. Numeric stats paired with other numerics of the same unit type.

Actual: Multiple singleton pools (stats_compact, ocean_lists) create quiz engine functional failures. The `stats_compact_short` pool is unit-incoherent (depths vs masses vs temperatures vs population counts). Two near-duplicate distractor pairs ("300 teeth"/"~300 teeth"; "~300 species"/"3") undermine question integrity. The five-oceans question has distractor near-duplicates that require careful reading to distinguish. The IUCN conservation pool has a non-IUCN category ("From Endangered to Least Concern") masquerading as a status option.

---

## Notes

- Ocean_life is the only deck in this batch with formally defined chain themes (5 themes). This is a significant advantage over the other 5 decks.
- `behavior_descriptions_long` pool (19 facts, 0 synth) is semantically homogeneous and produces clean distractor sets — behavioral sentences are distinct enough to not be easily confused with each other.
- The `sci_terms_short` and `sci_terms_compound` pools are well-designed: short scientific terms (Chemosynthesis, Eutrophication) and compound terms (Sequential hermaphroditism, Temperature-dependent sex determination) each stay within their pool type.
- `ocean_currents` with 2 real facts (Gulf Stream, Antarctic Circumpolar Current) + 14 synthetics functions better than expected because ocean currents are a narrow domain — the 14 synthetics (Labrador Current, Benguela Current, Canary Current, etc.) are all real named currents, making them plausible wrong answers.
