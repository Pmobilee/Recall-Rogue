# world_wonders — Expectations

## Intended Scope
195 facts spanning ancient wonders, sacred monuments, towers/skyscrapers, bridges/dams, palaces/castles, monuments/memorials, natural wonders, and modern marvels. A rich mixed-type knowledge deck covering construction history, architects, measurements, locations, and materials.

## Canonical Source
Wikipedia per `sourceName: "Wikipedia"`. Measurements (heights, lengths, weights, dates) should be verifiable against Wikipedia articles for each landmark.

## Sub-Deck / Chain Theme List
- `ancient_wonders` — 21 factIds
- `sacred_monuments` — 18 factIds
- `towers_skyscrapers` — 25 factIds
- `bridges_dams` — 28 factIds
- `palaces_castles` — 26 factIds
- `monuments_memorials` — 23 factIds
- `natural_wonders` — 26 factIds
- `modern_marvels` — 28 factIds

(All 8 sub-decks have non-empty factIds. No `chainThemes` defined — 0)

## Answer Pool Inventory
| Pool ID | Facts | Syn | Total | Notes |
|---|---|---|---|---|
| `landmark_names` | 8 | 7 | 15 | Place/landmark names |
| `location_country` | 7 | 8 | 15 | Country/region of landmark |
| `architect_designer_short` | 14 | 1 | 15 | Short architect names |
| `architect_designer_long` | 8 | 7 | 15 | Long architect names / pairs |
| `year_date` | 10 | 0 | 10 | Dates / date ranges |
| `measurement_number_short` | 47 | 0 | 47 | Short numeric measurements |
| `measurement_number_long` | 34 | 0 | 34 | Long numeric measurements |
| `material_feature_short` | 11 | 4 | 15 | Materials and features |
| `material_feature_long` | 10 | 5 | 15 | Longer material/feature descriptions |
| `person_historical_short` | 6 | 9 | 15 | Historical persons |
| `person_historical_long` | 11 | 4 | 15 | Historical persons (longer names) |
| `bracket_numbers` | 29 | 0 | 29 | Round numbers / counts |

## Expected Quality Bar
- Sub-deck factIds populated correctly — confirmed all 8 non-empty
- Measurement pools should contain only measurements (lengths, weights, areas) of the same unit class
- Person pools should contain only people's names (not events or group descriptions)
- Year/date pool should contain only temporal values
- location_country pool should contain only countries (not regions, cities, or city+country combos)
- ≥15 total per pool — `year_date` has only 10 (FAIL)

## Risk Areas
1. **POOL-CONTAM in year_date** — "1995 Kobe earthquake" is an event name, not a date/year
2. **POOL-CONTAM in person_historical_long** — "German reunification" (event) and "Washington, Jefferson, Roosevelt, Lincoln" (list of 4 people) are not single historical persons
3. **POOL-CONTAM in person_historical_short** — "Ming Dynasty" and "Nasrid dynasty" are dynasties, not people; "5th Dalai Lama" is a title not a name
4. **POOL-CONTAM in material_feature_short** — "West" (a cardinal direction from Angkor Wat) is in same pool as actual materials (Green jasper, Wrought iron, Art Deco)
5. **POOL-CONTAM in measurement_number_long** — "Magnitude 9.0" (seismic scale), "50,000–80,000" (capacity count), "$102 million" (currency), "2 billion years" (geological time), "14,500 tonnes" (weight) mixed with lengths/areas
6. **location_country pool inconsistency** — "Wales" (region not country), "Amritsar, India" (city+country), "Yucatan, Mexico" (state+country), "Granada" (city) mixed with countries like Pakistan/Indonesia/Qatar
