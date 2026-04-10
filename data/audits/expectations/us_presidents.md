# us_presidents — Pre-Read Expectations

## 1. Intended Scope
Survey of all US presidents: landmark achievements, key facts, historical firsts, ordinal positions, and unusual trivia. 126 facts — the smallest deck in this batch.

## 2. Canonical Source / Exam Alignment
No AP exam alignment. Wikipedia-sourced general knowledge deck. Accessible to broad audiences.

## 3. Sub-Deck / Chain Theme List
2 sub-decks (no chainThemes array):
- Landmark Presidents (high-interest, notable figures)
- The Complete Oval Office (comprehensive, all presidents)

## 4. Answer Pool Inventory
| Pool ID | Size | Answer Type |
|---|---|---|
| president_names | 104 factIds + 0 synth | President names |
| party_names | 7 factIds + 8 synth [EXEMPT] | Party names |
| home_states | 7 factIds + 8 synth [EXEMPT] | US state names |
| inauguration_years | 8 factIds + 20 synth | Years |

The `president_names` pool at 104 facts (83% of the deck) is enormous — nearly every fact returns a president name as the answer. This is actually appropriate for a "US Presidents" deck but creates a monotonous quiz experience.

## 5. Expected Quality Bar
Clean, factually accurate deck. Very homogeneous pool structure — almost entirely president-name answers. Primary risks are:
1. FACTUAL-SUSPECT in the Reagan/Cold War fact (already flagged in ap_us_history).
2. Over-simplification of nuanced historical events.
3. Very limited pool variety producing repetitive quiz experience.

## 6. Known Risk Areas
1. **`president_names` pool (104 facts)** — At high mastery, 4 wrong president names may all be plausible — but historically inappropriate pairings may occur (e.g., very recent presidents as distractors for 19th century questions).
2. **FACTUAL-SUSPECT: Reagan Cold War fact** — The deck claims Reagan "presided over" the USSR dissolution in 1991, but he left office in January 1989. George H.W. Bush was president during the dissolution.
3. **SELF-ANSWERING risk** — "Which president never attended school for even a single day" — Lincoln's lack of formal education is famous enough that this is common knowledge.
4. **Distractor quality at mastery 0** — With only 2 president-name distractors, implausible anachronistic pairs may appear.
5. **Shallow pool variety** — Only 4 pools; `party_names` and `home_states` each have only 7 real facts.
