# us_states — Expectations

## Intended Scope
75 facts covering 50 US states plus their capitals and notable facts. Facts are split into 4 regional sub-decks (Northeast, South, Midwest, West) with 18–22 facts each. Three question types: trivia about states, state capital questions, and numeric/year questions.

## Canonical Source
Wikipedia (per `sourceName`). State capitals are stable. Trivia facts (record-holders, firsts, geographic distinctions) should be verifiable against Wikipedia pages for each state.

## Sub-Deck / Chain Theme List
- `northeast` — 18 facts
- `south` — 22 facts
- `midwest` — 17 facts
- `west` — 18 facts

(No `chainThemes` defined — 0)

## Answer Pool Inventory
| Pool ID | Facts | Syn | Total | Answer type |
|---|---|---|---|---|
| `state_names_short` | 21 | 0 | 21 | Short state names (Iowa, Utah, Ohio, etc.) |
| `state_names_long` | 34 | 0 | 34 | Multi-word/long state names |
| `state_capitals` | 12 | 3 | 15 | State capital city names |
| `bracket_numbers` | 8 | 0 | 8 | Numeric answers using `{N}` bracket syntax |

## Expected Quality Bar
- 4 sub-decks with non-empty `factIds` — confirmed populated
- `bracket_numbers` pool: `{N}` syntax renders as bare number (confirmed: `{1777}` → `1777` in quiz)
- State names split by length avoids extreme LENGTH-TELL within each pool
- Capital facts must not have the capital name in the question stem (self-answering)
- Numeric facts need plausible numeric distractors in the same order of magnitude

## Risk Areas
1. **bracket_numbers pool below 15** — 8 facts + 0 synthetic distractors = 8 total (below recommended 15). Repetitive distractor set at higher mastery
2. **No chain themes** — 4 subDecks exist but no `chainThemes` array defined; chains can't theme-match within this deck
3. **LENGTH-TELL between pools** — state_names_short pool contains Iowa (4ch) vs Alaska (6ch); state_names_long contains Rhode Island (12ch) vs North Dakota (12ch) — ratio within limits, but mixing at render time unlikely since pools are separate
4. **Trivia accuracy** — "Which state has five national parks, more than any other state in the Mountain West?" — Utah has 5 national parks but Alaska has 8 (most in the US). Question qualifier "Mountain West" may save this but is subtle
5. **SELF-ANSWERING risk** — Indianapolis 500 question mentions "Motor Speedway" in which state — "Indianapolis" and "Indiana" share a root
