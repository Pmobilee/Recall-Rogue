# ancient_rome — Pre-Read Expectations

## 1. Intended Scope
12-century arc of Roman civilization, 753 BCE–476 CE: Republic, Empire, conquest, engineering, Christianity's rise, and fall of the Western Empire. 8 thematic sub-decks.

## 2. Canonical Source / Exam Alignment
No AP exam alignment. Wikipedia-sourced general knowledge deck.

## 3. Sub-Deck / Chain Theme List
8 sub-decks (no chainThemes array — chainThemeId appears unused):
- Republic to Empire
- Julius Caesar
- Punic Wars
- Engineering & Infrastructure
- Rise of Christianity
- Fall of the Western Empire
- (2 more inferred)

## 4. Answer Pool Inventory
| Pool ID | Size | Answer Type |
|---|---|---|
| date_events | 71 factIds + 0 synth | Date strings |
| date_range_events | 3 factIds + 12 synth | Date ranges |
| city_place_names | 8 factIds + 7 synth | Place/city names |
| general_politician_names | 36 factIds + 0 synth | Person names |
| political_terms | 23 factIds + 0 synth | Political/legal terms |
| text_work_names | 2 factIds + 13 synth | Titles of texts |
| battle_names | 8 factIds + 7 synth | Battle names |
| structure_names | 10 factIds + 5 synth [EXEMPT] | Building names |
| bracket_numbers | 9 factIds + 6 synth | Numbers |
| numeric_measurements | 7 factIds + 8 synth | Numeric with units |
| emperor_names | 9 factIds + 6 synth | Emperor names |
| roman_god_names | 9 factIds + 8 synth | God names |
| historical_phrases | 80 factIds + 0 synth [EXEMPT] | Long descriptive phrases |

Key risk: `historical_phrases` has 80 facts, marked EXEMPT. Similar to ancient_greece's equivalent pool — POOL-CONTAM expected.

## 5. Expected Quality Bar
Similar quality to ancient_greece. Strong factual sourcing, rich explanations. POOL-CONTAM in `historical_phrases` is the dominant anticipated issue.

## 6. Known Risk Areas
1. **POOL-CONTAM in `historical_phrases`** — 80 semantically disparate answers in one pool will produce absurd distractor combinations.
2. **`roman_god_names` pool contamination** — "She-wolf" appears as answer for one fact and is in this pool; "Saturday" appears as a distractor in the Venus question (incorrect pool placement — "Saturday" is not a Roman god name).
3. **Date distractors for `date_events` pool** — 71 date facts; distractors at mastery 0 (only 2 shown) will be plausible but may include dates from wildly different eras (e.g., "476 CE" as a distractor for the 753 BCE question is a 1,229-year gap — not plausible).
4. **`text_work_names` pool** — Only 2 real facts + 13 synthetics; synth quality is uncertain.
5. **Self-answering risk** — Some questions naming the subject (e.g., "Which...Stilicho..." with Stilicho as correct answer) where name appears in question stem.
