# world_cuisines — Expectations

## Intended Scope
141 facts across 4 sub-decks: national dishes (41), spices & ingredients (29), cooking techniques (27), and food history (44). Covers global culinary traditions, ingredient origins, technique science, and food history.

## Canonical Source
Wikipedia and food history sources per `sourceName`. Historical dates (when olive oil cultivation began, when chocolate processing was patented) should be sourced from primary references.

## Sub-Deck / Chain Theme List
- `national_dishes` — 41 facts
- `spices_ingredients` — 29 facts
- `cooking_techniques` — 27 facts
- `food_history` — 44 facts

(No `chainThemes` defined — 0)

## Answer Pool Inventory
| Pool ID | Facts | Syn | Total | Notes |
|---|---|---|---|---|
| `bracket_numbers` | 13 | 0 | 13 | Year/numeric answers (below ≥15) |
| `country_region_names` | 28 | 0 | 28 | Country of origin |
| `compound_location_names` | 7 | 8 | 15 | City+country combos |
| `civilization_names` | 9 | 13 | 22 | Empire/civilization names |
| `date_facts_short` | 13 | 2 | 15 | Short date strings (centuries, years, decades) |
| `date_facts_long` | 18 | 0 | 18 | Longer date strings |
| `technique_terms_short` | 16 | 0 | 16 | Culinary terms and technique names |
| `technique_terms_long` | 7 | 8 | 15 | Longer technique descriptions |
| `ingredient_names_short` | 9 | 12 | 21 | Short ingredient names |
| `ingredient_names_long` | 5 | 12 | 17 | Longer ingredient names/descriptions |
| `person_names_food` | 13 | 9 | 22 | Food scientists, chefs, monarchs |
| `cultural_references` | 3 | 13 | 16 | Literary/historical references |

## Expected Quality Bar
- `bracket_numbers` pool: 13 facts + 0 synthetic = 13 total (FAIL — below ≥15)
- `civilization_names` pool ratio 3.0× (at boundary — check for length-tell)
- `technique_terms_short` should contain only culinary techniques; check for temperature values, quantities, ratios mixed in
- `date_facts_short` should have semantically consistent date formats; "October" (a month) mixed with year strings is a potential type mismatch
- `ingredient_names_short` ratio 3.0× (at boundary)

## Risk Areas
1. **POOL-CONTAM in technique_terms_short** — Contains "Tandoor" (equipment), "480°C" (temperature), "14–17 times" (ratio), "Pain receptors" (biology), "Amino acids" (chemistry), "El Bulli" (restaurant name), "SCOBY" (acronym), "Zymology" (science term), "4 denarii" (price) — wildly different answer types in one pool
2. **POOL-CONTAM in date_facts_short** — "October" (a month name) appears alongside year-strings ("8000 BC", "3000 BC", "1930s") — format mismatch
3. **bracket_numbers below minimum** — 13 facts + 0 synthetic = 13 total (recommend ≥15)
4. **culture_references pool has only 3 real facts** — "Boston Tea Party", "The Lion, the Witch and the Wardrobe", "One Thousand and One Nights" — relies heavily on 13 synthetic distractors; check for synthetic quality
5. **Factual nuance** — Mole sauce question ("despite popular belief, chili peppers are foundational, not chocolate") is factually contested; tacos al pastor/Lebanon origin is historical hypothesis not consensus
