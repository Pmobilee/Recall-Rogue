# world_wonders — Quiz Audit Findings

## Summary
195 facts across 8 sub-decks. Quiz dump covers 30 unique facts × 3 mastery levels = 90 rows, all with multi-choice rendering. Multiple pool contamination issues cause semantically incoherent distractor sets at higher mastery levels. The most severe issue is "West" (a cardinal direction) appearing as a distractor in a material-type question.

**Issue counts:** 1 BLOCKER, 4 MAJOR, 3 MINOR, 1 NIT

---

## Issues

### BLOCKER

- **Fact**: `ww_sac_wat_phra_kaew_buddha` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "Despite being called the 'Emerald Buddha,' what material is the famous statue at Wat Phra Kaew actually carved from?"
  A) Art Deco | B) Coral polyps | C) [Green jasper] | D) Solar wind | E) West
- **Issue**: "West" appears as a distractor option. This is the `correctAnswer` from `ww_sac_angkor_wat_orientation` (a cardinal direction: "Angkor Wat is unusual among Khmer temples in facing which cardinal direction?"). "West" has been placed in the `material_feature_short` pool alongside actual materials. A direction is not a material. "West" is trivially eliminable in any material question, and its presence breaks the quiz rendering semantically. BLOCKER because the distractor is absurd and the quiz is broken at m=4 for this fact.

---

### MAJOR

- **Fact**: `ww_pal_tower_london_founder` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "Who founded the Tower of London in 1066 and began construction of the White Tower around 1078?"
  A) [German reunification] | B) David Livingstone | C) Mehmed the Conqueror | D) William the Conqueror | E) Washington, Jefferson, Roosevelt, Lincoln
- **Issue**: The `person_historical_long` pool contains "German reunification" (an event, not a person) and "Washington, Jefferson, Roosevelt, Lincoln" (a list of four people, not one). Both appear as distractors in a who-question. "German reunification" is trivially eliminable in any "who" question. "Washington, Jefferson, Roosevelt, Lincoln" is a grammatically incoherent answer to "Who founded the Tower of London?" Correct person pool should contain only single historical person names.

---

- **Fact**: `ww_anc_colosseum_date` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "In what period was the Colosseum in Rome constructed?"
  A) 29 May 1953 | B) 1163–1260 | C) [1995 Kobe earthquake] | D) November 2000 | E) 72–80 AD
- **Issue**: "1995 Kobe earthquake" is the `correctAnswer` for `ww_bridge_akashi_earthquake` — it is an event name, not a date. It appears in the `year_date` pool as a distractor for date questions. Players asking "In what period was the Colosseum constructed?" are offered an earthquake as a date option. This is semantically broken — a player can eliminate it immediately by noticing it's not a date format.

---

- **Fact**: `ww_anc_pyramid_giza_pharaoh` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "For which Egyptian pharaoh was the Great Pyramid of Giza built?"
  A) [Khufu] | B) Ming Dynasty | C) Shah Jahan | D) 5th Dalai Lama | E) Nasrid dynasty
- **Issue**: The `person_historical_short` pool contains "Ming Dynasty" (a dynasty), "Nasrid dynasty" (a dynasty), and "5th Dalai Lama" (a title, not a proper name). For the question "For which pharaoh?" dynasties and titles are not plausible pharaoh-name distractors. Players can eliminate B and E immediately because dynasties are not pharaohs, weakening the question significantly.

---

- **Fact**: `ww_tower_space_needle_earthquake` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "The Space Needle in Seattle is engineered to withstand an earthquake of what magnitude?"
  A) 18 centimetres | B) 13.5 tonnes | C) 49.54 metres | D) 1,280 metres | E) [Magnitude 9.0]
- **Issue**: The `measurement_number_long` pool mixes seismic magnitudes, linear distances (metres, kilometres), weight (tonnes), and population capacity (50,000–80,000) — all different physical units. When the question asks for a magnitude, "18 centimetres," "13.5 tonnes," and "1,280 metres" are trivially eliminable because they are physically impossible answers to a "what magnitude?" question. Distractors should be other magnitudes (e.g., "Magnitude 7.5", "Magnitude 8.5") not lengths or weights.

---

### MINOR

- **Fact**: `ww_nat_dead_sea_salinity` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "The Dead Sea is famous for extreme saltiness — what is its approximate salinity?"
  A) 321 meters | B) [Three] | C) 330 metres | D) 120 years | E) 34.2%
- **Issue**: "Three" (from `ww_mod_channel_tunnel_tunnels` — number of tunnels) appears as a distractor for a salinity question. "34.2%" is a percentage, but distractors include lengths in metres and "Three" (a count). The pool (`measurement_number_short`) mixes percentages, linear lengths, counts, years, MW values, and cardinal numbers. While the correct answer is findable, "Three" and "120 years" are trivially eliminable in a salinity context.

---

- **Fact**: `ww_anc_mohenjo_daro_location` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "In which modern country is the ancient Indus Valley city of Mohenjo-daro located?"
  A) Wales | B) Amritsar, India | C) Granada | D) Indonesia | E) [Pakistan]
- **Issue**: The `location_country` pool mixes:
  - "Wales" — a country/region within the UK, not a sovereign country
  - "Amritsar, India" — a city+country combo, not just a country
  - "Yucatan, Mexico" — a state+country combo
  - "Granada" — a Spanish city
  alongside proper country names (Pakistan, Indonesia, Qatar). "Wales" and "Granada" are immediately recognizable as not matching the "which country?" format for most international landmarks. The pool has inconsistent granularity of geographic answers.

---

- **Fact**: `year_date` pool @ mastery=all
- **Category**: `SYNTHETIC-WEAK`
- **Rendered** (various facts):
  Year_date pool has only 10 facts and 0 synthetic distractors (total = 10, below recommended ≥15). At mastery 4 (5 options), the engine uses all 10 members. Dates like "50–60 million years ago" and "15 April 2019" and "1995 Kobe earthquake" (an event, not a date) create semantically incoherent sets. Adding 5+ synthetic date distractors in era-appropriate formats and removing the earthquake event would improve this pool significantly.

---

### NIT

- **Fact**: `ww_bridge_akashi_earthquake` @ mastery=all
- **Category**: `TEMPLATE-MISFIT`
- **Rendered**:
  Q: "Which major earthquake struck during construction of Japan's Akashi Kaikyo Bridge, shifting one tower by approximately 1 metre?"
  A: "1995 Kobe earthquake"
  pool: `year_date`
- **Issue**: The `correctAnswer` "1995 Kobe earthquake" is an event name, not a date. The pool `year_date` is for temporal values. The question asks "which earthquake" (event name), so the answer is correctly an event name — but the pool assignment is wrong. This fact belongs in a named-event pool or should be rewritten so the answer is a date (e.g., "In which year did the earthquake that affected the Akashi Kaikyo Bridge occur?" → answer "1995"). The current mismatch pollutes the year_date pool with an event name.

---

## Expected vs Actual
- Expected: person pools contain only people's names — **actual: dynasties, events, and name-lists present**
- Expected: year_date pool contains only temporal values — **actual: "1995 Kobe earthquake" (event name) present**
- Expected: material_feature_short contains only materials — **actual: "West" (cardinal direction) present**
- Expected: measurement_number pools homogeneous by unit — **actual: mixed units across all measurement pools**
- Expected: location_country contains only country names — **actual: mixed with regions, cities, city+country combos**
- Expected: year_date pool ≥15 — **actual: only 10 facts, 0 synthetics**
- Expected: 8 sub-decks with factIds — **actual: all 8 confirmed populated**

## Notes
- The `architect_designer_short` and `architect_designer_long` pools are well-designed: both contain only architect/designer names with plausible cross-pool distractors (Renzo Piano, Norman Foster, Gustave Eiffel, Jørn Utzon — all plausible architects).
- The `bracket_numbers` pool (29 facts) has good semantic homogeneity — all are counts/years/quantities of the same magnitude class.
- The `landmark_names` pool (8 facts + 7 synthetic) works well: Sagarmatha, River of January, The Coathanger, Rose City, Lake Mead, White Heron Castle are all distinctive landmark nicknames.
- Most MAJOR/BLOCKER issues stem from placing semantically-misfit `correctAnswer` values into pools during deck assembly, then those values appearing as distractors in unrelated facts.
