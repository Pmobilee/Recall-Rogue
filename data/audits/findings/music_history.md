# music_history — Quiz Audit Findings

## Summary
230 facts, 11 pools. This deck has the most systemic content damage in the batch. Two major structural problems exist: (1) 10 facts with broken "this" word-replacement artifacts, spread across multiple sub-decks and question types; (2) the `description_terms` pool is severely contaminated, mixing answer concepts from 5 incompatible semantic domains. The `place_names` pool also mixes German cities, American music venues, and countries as distractors for each other. The `bracket_numbers` pool — 17 facts — has zero inline distractors and relies entirely on numerical generation, producing reasonable results but with heterogeneous magnitudes (ages, years, counts) in the same pool. Core name pools (work_names, artist_names_*) are clean and well-populated.

**Issue counts:** BLOCKER 0 / MAJOR 3 / MINOR 4 / NIT 2

---

## Issues

### MAJOR

- **Fact**: `mh_0_bach_employer_leipzig` @ mastery=0–4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "Which Leipzig this employed Bach as Cantor from 1723 until his death?"
   A) St. Thomas Church  ✓
- **Issue**: "Which Leipzig this" — "this" is a broken word-replacement artifact. Intended word was "church" or "institution". The question is grammatically unintelligible. Occurs at every mastery level.

---

- **Fact**: `mh_0_haydn_papa_nickname` @ mastery=0–4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "What affectionate nickname did musicians give to Joseph This?"
   A) (nickname answer)
- **Issue**: "Joseph This" — "This" should be "Haydn". Grammatically broken and factually obscured. Additional broken facts in this category: `mh_0_beethoven_moonlight_sonata` ("Piano this No. 14"), `mh_0_brahms_lullaby` ("most famous this in history"), `mh_0_tchaikovsky_1812_overture` ("Tchaikovsky this commemorates"), `mh_1_trombone_slide` ("What this does a trombone use"), `mh_1_octave_interval` ("What this spans exactly 8 notes"), `mh_2_mingus_ah_um` ("Charles this album"). Total: at least 8 additional broken-grammar facts beyond the Leipzig and Haydn cases, affecting multiple sub-decks.

---

- **Fact**: pool `description_terms` — all 12 real facts
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=2, oboe fact):
  Q: "What type of reed does an oboe use?"
   A) Became deaf  ← (Beethoven biography)
   B) Slide mechanism  ← (trombone mechanism)
   C) Polish  ← (Chopin nationality)
   D) Double reed  ✓
- **Issue**: The `description_terms` pool mixes answers from 5 incompatible semantic domains: instrument mechanics ("Double reed", "Single reed", "Slide mechanism", "Plucks the strings"), composer biography ("Became deaf", "Polish"), streaming services ("Spotify", "Napster"), cantata counts ("over 200"), and place descriptions. At mastery 2+, players see "Became deaf" as a distractor for an instrument question — trivially eliminable.
- **Rendered** (mastery=4, Spotify fact):
  Q: "Which streaming service launched in 2008 and led the shift from music ownership to access?"
   A) Single reed
   B) Spotify  ✓
   C) Became deaf
   D) Plucks the strings
   E) Napster
- **Issue**: "Single reed", "Became deaf", "Plucks the strings" are trivially eliminable for a streaming service question.

---

### MINOR

- **Fact**: pool `place_names` — cross-domain contamination
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=4, Wagner/Bayreuth):
  Q: "Wagner built a dedicated opera house in which German city?"
   A) Mississippi Delta
   B) Cotton Club
   C) Bayreuth  ✓
   D) Bonn, Germany
   E) England
- **Issue**: American music venue names ("Mississippi Delta", "Cotton Club") and country names ("England") appear as distractors for a question about a specific German city. These are from jazz/blues sub-deck facts (which belong in the same `place_names` pool). The correct answer is eliminable by knowing it is a city and all non-city options are eliminable.

---

- **Fact**: pool `bracket_numbers` — semantic heterogeneity
- **Category**: `NUMERIC-WEAK`
- **Rendered** (mastery=2, Mozart death age): "At what age did Mozart die?" → options: 45, 46, 35 ✓, 27
- **Rendered** (mastery=2, Haydn symphony count): "How many symphonies did Haydn compose?" → options: 104 ✓, 120, 130, 70
- **Issue**: The pool mixes ages (35, 37), birth years (1685), symphony counts (41, 104), sonata numbers (14), circle counts (4, 9), and cantata counts (200+) — all in one numeric pool. Numerical distractors generated around the correct value are appropriate for same-magnitude questions, but a player who knows the answer is a year vs. an age can dramatically narrow options. At low mastery, the 3-option display mitigates this.

---

- **Fact**: `mh_0_bach_birth_year` and 16 other bracket_numbers facts
- **Category**: `OTHER`
- **Rendered**: 17 facts in `bracket_numbers` have `distractors: []` in the JSON — relying entirely on numerical engine generation.
- **Issue**: While numerical generation produces correct-range distractors, zero inline distractors means there is no editorial control over plausibility. For obscure dates (Bach 1685, Liszt 1811) the generated options may cluster too close or produce anachronistic years. This is a structural note rather than a confirmed failure.

---

- **Fact**: `mh_0_liszt_hungarian_rhapsodies` and 17 other superlative-phrased facts
- **Category**: `AMBIGUOUS-Q`
- **Rendered**: Q: "What set of folk-inspired piano pieces is Liszt most famous for composing?"
- **Issue**: "most famous for" is subjective — Liszt's Transcendental Études or Piano Sonata in B minor are arguably equally famous among classical musicians. Question is answerable by common knowledge but the framing is contestable. Affects approximately 18 facts.

---

### NIT

- **Fact**: `mh_0_bach_employer_leipzig` — question structure post-fix
- **Category**: `OTHER`
- **Issue**: Even if "this" is repaired, the question "Which Leipzig [church/institution] employed Bach as Cantor from 1723 until his death?" has the answer "St. Thomas Church" while the question asks for a Leipzig entity — minor SELF-ANSWERING risk since "Leipzig" narrows it strongly (Thomaskirche is the answer, and any distractor not in Leipzig is trivially eliminable). After grammar repair, this should be reviewed for self-answering.

---

- **Fact**: `mh_1_oboe_double_reed` distractor quality at mastery 4
- **Category**: `SYNTHETIC-WEAK`
- **Rendered**: Q: "What type of reed does an oboe use?" → options: Napster, Slide mechanism, Polish, Became deaf, Double reed ✓
- **Issue**: This is a symptom of the description_terms contamination (documented as MAJOR above), but worth noting that even at mastery 4 with 5 options, none of the 4 distractors are remotely plausible answers for a reed-type question. All 4 are trivially eliminable.

---

## Expected vs Actual
Expected: 10 broken-grammar facts (confirmed, actually found at least 10 distinct affected questions), description_terms contamination (confirmed and severe), place_names contamination (confirmed). Actual findings closely match expectations. The description_terms pool contamination is worse than anticipated — it actively produces nonsensical distractor combinations visible in the JSONL at every mastery level.

## Notes
- The 10+ broken-grammar facts all share the same root cause: a batch rewrite that replaced specific nouns (church, sonata, overture, album, interval) with "this" without resolving the placeholder. All must be individually corrected.
- The `description_terms` pool should be dissolved and refactored into at least 4 domain-specific pools: `instrument_mechanics_terms`, `composer_bio_descriptors`, `streaming_platform_names`, and one for counts.
- `place_names` pool should be split into `classical_venues_cities` (German/European cities) and `jazz_blues_places` (Delta, New Orleans, Cotton Club).
