# medieval_world — Pre-Read Expectations

## 1. Intended Scope
Global survey from fall of Rome to the eve of the Renaissance — Byzantine Empire, Islamic Golden Age, Viking Age, Crusades, Feudal Europe, Tang/Song China, Japanese Heian period, and African kingdoms (Mali, Aksum, Songhai).

## 2. Canonical Source / Exam Alignment
No AP exam alignment. Wikipedia-sourced general knowledge deck covering multiple world regions, 500–1500 CE.

## 3. Sub-Deck / Chain Theme List
7 sub-decks (no chainThemes array):
- Byzantine Empire
- The Crusades
- African Kingdoms & Trade
- Tang & Song China
- (3 more inferred — likely Viking/Norse, Feudal Europe, Islamic World)

## 4. Answer Pool Inventory
| Pool ID | Size | Answer Type |
|---|---|---|
| date_events | 23 factIds + 0 synth | Specific event dates |
| ruler_leader_names | 22 factIds + 0 synth | Person names (rulers/leaders) |
| work_text_names | 6 factIds + 9 synth | Titles of works |
| battle_event_names | 12 factIds + 3 synth | Battle/event names |
| concept_terms | 26 factIds + 0 synth | Abstract terms |
| place_names | 14 factIds + 1 synth | Place names |
| structure_names | 5 factIds + 10 synth | Structure/building names |
| scholar_names | 11 factIds + 4 synth | Scholar/intellectual names |
| person_group_names | 6 factIds + 12 synth | Group names or person names |
| description_phrases | 12 factIds + 10 synth | Descriptive phrases |
| date_named | 27 factIds + 0 synth | Named date-ranges (e.g., "c. 1235–c. 1610") |
| bracket_numbers | 5 factIds + 15 synth | Numbers |
| quantities_measures | 9 factIds + 8 synth | Numeric with context |

Risk: `date_named` (27 facts) contains range-format answers ("c. 1217–c. 1255") and duration-format answers ("Over 1,100 years") mixed together — potential format-mixing LENGTH-TELL.

## 5. Expected Quality Bar
Broader global scope than ancient_greece/rome; risk of shallower coverage per topic. Pool sizes are smaller but more numerous. `date_named` mixing ranges with durations is a concern.

## 6. Known Risk Areas
1. **`date_named` format heterogeneity** — "Over 1,100 years" (duration), "c. 1235–c. 1610" (range), "330 CE" (point) all in same pool; distractors drawn cross-format will be instantly identifiable.
2. **`ruler_leader_names` cross-domain contamination** — Leaders from Byzantine, African, Chinese, and Japanese contexts all share one pool; "Fujiwara clan" (a Japanese clan) appearing as a distractor for a Crusades question is a CATEGORY-TELL.
3. **`work_text_names` with 6 real + 9 synth** — Synthetic quality uncertain; pool is small enough to exhaust quickly.
4. **BROKEN-GRAMMAR risk** — Question stem for `med_6_afr_mansa_musa_catalan` begins with lowercase "which" — minor grammar issue.
5. **`description_phrases` pool** — Mixing modern and medieval descriptions ("Arabic for 'coast'", "Clinker-built shallow draft") as distractors for currency questions risks being too obscure.
