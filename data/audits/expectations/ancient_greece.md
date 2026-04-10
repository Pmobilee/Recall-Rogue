# ancient_greece — Pre-Read Expectations

## 1. Intended Scope
Broad survey of Greek civilization 800–146 BCE, covering politics/democracy, Persian Wars, city-states (Athens vs Sparta), philosophy, art/architecture, and the Hellenistic period (Alexander).

## 2. Canonical Source / Exam Alignment
No AP exam alignment claimed. Wikipedia-sourced general knowledge deck; quality bar is "comprehensive overview" not curriculum-aligned.

## 3. Sub-Deck / Chain Theme List
7 sub-decks (no chainTheme ids — chainThemeId field appears to be 0 for all facts, meaning chain themes may not be populated):
- Persian Wars
- City-States: Athens vs Sparta
- Greek Philosophy
- (4 more sub-decks inferred from pool distribution)

## 4. Answer Pool Inventory
| Pool ID | Size | Answer Type |
|---|---|---|
| ruler_general_names | 27 factIds + 0 synth | Person names (rulers, generals) |
| concept_terms | 30 factIds + 0 synth | Abstract political/philosophical terms |
| bracket_numbers | 12 factIds + 0 synth [EXEMPT] | Numeric answers |
| date_events | 37 factIds + 0 synth | Date strings (e.g., "490 BCE") |
| structure_names | 11 factIds + 4 synth | Building/structure names |
| god_names | 12 factIds + 3 synth | Greek deity names |
| city_state_names | 11 factIds + 4 synth | Place/city names |
| work_text_names | 10 factIds + 5 synth | Titles of literary/historical works |
| historical_phrases_short | 9 factIds + 6 synth | Short phrases/quotes |
| historical_phrases_long | 87 factIds + 0 synth | Long descriptive answers (the dominant pool) |

Concern: `historical_phrases_long` contains 87 facts — 35% of the entire deck. This massive heterogeneous pool almost certainly mixes semantically incompatible answer types.

## 5. Expected Quality Bar
High-quality narrative facts with good explanations and wow-factors; distractor quality is the key risk given the heavy reliance on the heterogeneous `historical_phrases_long` pool.

## 6. Known Risk Areas
1. **POOL-CONTAM in `historical_phrases_long`** — 87 facts implies wildly different answer formats all competing as distractors. Expect absurd-sounding option sets.
2. **CATEGORY-TELL in `ruler_general_names`** — 27 person-name facts: if question asks "What prevented Sparta..." but pool pulls a person name distractor, it is instantly eliminable.
3. **DATE distractor quality** — 37 date facts; distractor generation for dates should be plausible nearby years; risk of trivially outlier distractors.
4. **Missing chain themes** — All facts have `chainThemeId: 0`, suggesting chain theme architecture is incomplete or collapsed.
5. **`historical_phrases_long` answer length variance** — Answers in this pool range from short phrases to multi-clause sentences; length-tells are likely.
