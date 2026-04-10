# world_cuisines — Quiz Audit Findings

## Summary
141 facts across 4 sub-decks. Quiz dump covers 30 unique facts × 3 mastery levels = 90 rows, all with multi-choice rendering. The primary issue is the `technique_terms_short` pool, which contains at least 8 semantically incompatible answer types, producing incoherent distractor sets. The `date_facts_short` pool mixes a month name with year strings. Several factual nuance issues are flagged.

**Issue counts:** 0 BLOCKER, 2 MAJOR, 3 MINOR, 1 NIT

---

## Issues

### MAJOR

- **Fact**: `food_tech_tandoor_temp` @ mastery=4 (technique_terms_short pool)
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "Which clay oven, reaching 480°C and mentioned in the Epic of Gilgamesh, is used to cook naan, roti, and meats?"
  A) 2,000 | B) [Tandoor] | C) SCOBY | D) Osmosis | E) Wok hei
- **Issue**: The `technique_terms_short` pool mixes: equipment names (Tandoor, SCOBY), scientific processes (Osmosis, Zymology), a restaurant name (El Bulli), a culinary flavor term (Wok hei), chemistry terms (Amino acids, Pain receptors), a ratio (14–17 times), a temperature (480°C), a price (4 denarii), and a count (2,000). These are 8+ semantically incompatible answer types. "2,000" (number of dim sum types) appearing alongside "SCOBY" and "Osmosis" for a "which clay oven?" question is not plausible distraction — it's noise. Players can immediately eliminate everything except Tandoor and Wok hei by knowing that clay ovens are equipment.

---

- **Fact**: `food_spice_saffron_harvest` @ mastery=4 (date_facts_short pool)
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "Saffron crocus flowers bloom only once per year for 1–2 weeks — in which month must they be harvested?"
  A) 2500 BC | B) 8000 BC | C) 2737 BC | D) 6000 BC | E) [October]
- **Issue**: "October" (a month name) is in the `date_facts_short` pool alongside year strings ("8000 BC", "3000 BC", "2737 BC", "2500 BC", "6000 BC"). The question asks for a month; distractors are all ancient year-strings. Players immediately eliminate all four distractors since they are clearly years/epochs, not months. The correct answer is trivially identifiable. "October" should be in a separate `month_names` pool, not `date_facts_short`.

---

### MINOR

- **Fact**: `food_tech_molecular_gastronomy` @ mastery=all (technique_terms_short pool)
- **Category**: `POOL-CONTAM`
- **Rendered** (technique_terms_short pool):
  Q: "Which Spanish restaurant, run by Ferran Adrià, became most associated with molecular gastronomy?"
  A: "El Bulli"
- **Issue**: "El Bulli" is a restaurant name, placed in `technique_terms_short` — a pool nominally for culinary techniques. Restaurant names are not techniques. When it appears as a distractor in technique questions (e.g., "Which molecular gastronomy technique creates caviar-like beads?"), players will not confuse a restaurant name with a technique name and will eliminate it. Should be in a dedicated `restaurant_names` pool or `cultural_references`.

---

- **Fact**: `bracket_numbers` pool @ mastery=all
- **Category**: `SYNTHETIC-WEAK`
- **Rendered** (e.g., `food_hist_chocolate_industrial` m=4):
  Q: "In which year did Coenraad van Houten patent Dutch cocoa processing...?"
  A) 1817 | B) 1846 | C) 1877 | D) [1828] | E) 1787
- **Issue**: The `bracket_numbers` pool has 13 facts + 0 synthetic distractors = 13 total (below the ≥15 recommendation). All 13 are year values in `{YYYY}` format, which is internally consistent. At mastery 4 (5 options), 4 distractors are drawn from 12 remaining — reasonable variety. The main issue is the below-minimum pool size, which will cause repeated distractor exposure across the 13 year-answer facts. Adding 3–5 synthetic plausible year values would fix this.

---

- **Fact**: `food_dish_mole_chocolate` @ mastery=all (ingredient_names_long pool)
- **Category**: `FACTUAL-SUSPECT`
- **Rendered** (m=4):
  Q: "Despite popular belief, which ingredient is foundational to mole sauce — NOT chocolate, which was only added much later?"
  A) Ceylon cinnamon | B) Kombu seaweed | C) [Chili peppers] | D) Green chilies | E) Citric acid
- **Issue**: The claim that "chocolate was only added much later" to mole sauce is a contested culinary history position. Pre-Columbian and early colonial mole preparations are debated — some food historians argue chocolate appeared early in mole traditions. The question presents a contested historical claim as established fact. Additionally, "Green chilies" as a distractor for "Chili peppers" is a near-SYNONYM-LEAK: green chilies ARE chili peppers, just a specific variety. Players who know chili peppers are foundational may hesitate between these two options.

---

### NIT

- **Fact**: `food_hist_coffee_brazil` @ mastery=all
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "In which year did Brazil become the world's largest coffee producer, a position it still holds today?"
  A: 1852
- **Issue**: Minor factual precision concern. Brazil became the world's dominant coffee producer in stages across the 19th century. The specific year 1852 as the inflection point should be verified against the sourced Wikipedia article. The phrase "a position it still holds today" is volatile — Brazilian coffee production dominance could change. Should add `volatile: true` to this fact.

---

## Expected vs Actual
- Expected: technique_terms_short contains only culinary techniques — **actual: mixes equipment, science terms, restaurant names, prices, temperatures, ratios**
- Expected: date_facts_short contains only date-format strings — **actual: "October" (month) mixed with year strings**
- Expected: bracket_numbers ≥15 — **actual: 13 facts + 0 synthetic = 13 (FAIL)**
- Expected: ingredient_names_long pool ratio < 3× — **actual: 3.0× (at boundary)**
- Expected: No near-synonym distractors — **actual: "Chili peppers" vs "Green chilies" in same distractor set**

## Notes
- The `country_region_names` pool (28 facts, 0 synthetic) is well-designed: all are country names with consistent format. The quiz rendering for `food_tech_tagine_design` (Morocco) and `food_dish_tacos_al_pastor_origin` (Lebanon) shows clean, plausible distractor sets.
- The `person_names_food` pool (13 facts + 9 synthetic = 22 total) renders cleanly — all person names with consistent surname formats.
- The `civilization_names` pool (9 facts + 13 synthetic = 22 total) is at the 3.0× length ratio boundary; "Sumer" (5 chars) vs "Aztecs and Maya" (15 chars) — just within the limit but worth monitoring.
- The `cultural_references` pool (3 facts + 13 synthetic = 16 total) renders acceptably; the 13 synthetic distractors (The Odyssey, Beowulf, Canterbury Tales, etc.) are plausible literary works that make "One Thousand and One Nights" vs "Thousand and One Days" a meaningful distinction.
