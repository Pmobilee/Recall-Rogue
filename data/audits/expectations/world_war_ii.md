# world_war_ii — Pre-Read Expectations

## 1. Intended Scope
Comprehensive WWII coverage: all major theaters (Eastern Front, Western Front, Pacific, North Africa, Holocaust), key leaders, operations, dates, battles, technology, and statistics. 735 facts — the second-largest deck.

## 2. Canonical Source / Exam Alignment
No AP exam alignment. Wikipedia-sourced general knowledge deck. The largest non-AP deck in this batch.

## 3. Sub-Deck / Chain Theme List
16 sub-decks (no chainThemes array):
- Eastern Front
- Western Front
- Pacific Theater
- North Africa & Mediterranean
- (12 more covering Holocaust, Home Front, Leaders, Technology, Air War, Naval War, etc.)

## 4. Answer Pool Inventory
| Pool ID | Size | Answer Type |
|---|---|---|
| battle_names | 7 factIds + 8 synth | Battle names |
| place_names | 58 factIds + 0 synth | Place names |
| year_dates | 159 factIds + 0 synth | Date strings (dominant pool) |
| number_stats | 108 factIds + 6 synth | Statistics/numbers with context |
| military_terms | 75 factIds + 0 synth | Military terminology |
| famous_quotes | 30 factIds + 0 synth | Famous quotes/phrases |
| historical_events | 167 factIds + 0 synth | Event descriptions (dominant) |
| person_names | 67 factIds + 0 synth | Person names |
| organization_names | 13 factIds + 2 synth | Organization names |
| bracket_counts | 51 factIds + 0 synth | Count numbers |

CRITICAL: `year_dates` (159) and `historical_events` (167) are enormous pools. `historical_events` is likely another heterogeneous catch-all similar to ancient_greece's `historical_phrases_long`. `number_stats` at 108 is large.

## 5. Expected Quality Bar
Factually dense deck. Date distractors should be within WWII era (1939–1945). Risk of heterogeneous catch-all pools similar to ancient history decks.

## 6. Known Risk Areas
1. **`year_dates` pool with 159 facts** — Dates span all of WWII and pre/post-war periods; distractors should stay within the 1939–1945 window but may mix specific dates with year-only dates.
2. **`number_stats` pool** — 108 numeric facts likely covering everything from troop counts to distances to casualty numbers; length-tells between "34" (ships sunk) and "338,226" (Dunkirk evacuees) are severe.
3. **`historical_events` with 167 facts** — Likely heterogeneous; expect POOL-CONTAM.
4. **Date format consistency** — "Dec 5, 1941", "May 8, 1945", "Eight weeks" (a duration) all in `year_dates` pool — "Eight weeks" is a duration answer, not a date.
5. **`bracket_counts` with raw numbers** — "338226" (no comma formatting) renders awkwardly in UI.
