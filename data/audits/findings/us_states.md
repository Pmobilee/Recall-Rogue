# us_states — Quiz Audit Findings

## Summary
75 facts across 4 regional sub-decks. Quiz dump covers 30 unique facts × 3 mastery levels = 90 rows. All multi-choice rendering works correctly. The `{N}` bracket syntax in correctAnswer renders as a bare number in quiz output. Several pool-level and question-level issues identified.

**Issue counts:** 0 BLOCKER, 2 MAJOR, 3 MINOR, 1 NIT

---

## Issues

### MAJOR

- **Fact**: `us_states_utah_five_parks` @ mastery=0,2,4
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "Which state has five national parks, more than any other state in the Mountain West?"
  A) Texas
  B) [Utah]
  C) Indiana
- **Issue**: Alaska has 8 national parks — the most of any US state. The qualifier "Mountain West" narrows the claim but is not standard geographic terminology, and the question phrasing "more than any other state in the Mountain West" is awkward and potentially misleading. Players who know Alaska's total will be confused. Should rephrase to "Which Mountain West state is home to five national parks — the most in that region?" or remove the qualifier and change to a different Utah fact.

---

- **Fact**: `us_states_indiana_indy500` @ mastery=0,2,4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "The Indianapolis 500 — considered the world's largest single-day sporting event — takes place at the Motor Speedway in which US state?"
  A) Alaska
  B) [Indiana]
  C) Ohio
- **Issue**: "Indianapolis" contains "Indiana" as a visible root. A player who doesn't know the answer can derive it from the question stem. This is a word-level self-answering issue (suffix match: "Indianapolis" → "Indiana"). Distractors Ohio and Alaska are immediately eliminable because no similar word appears in the question for them.

---

### MINOR

- **Fact**: `bracket_numbers` pool @ mastery=all
- **Category**: `SYNTHETIC-WEAK`
- **Rendered** (e.g., `us_states_minnesota_lakes` m=4):
  Q: "Minnesota's nickname says '10,000 Lakes,' but how many lakes does it actually have?"
  A) 2.5 | B) 1787 | C) 231 | D) 1639 | E) [11,842]
- **Issue**: The `bracket_numbers` pool has only 8 facts and 0 synthetic distractors (total = 8, below the recommended ≥15). At mastery 4 (5 options), the engine draws from all 8 pool members. The pool mixes incompatible numeric types: "11,842" (lake count), "1787" (year), "1777" (year), "2.5" (size multiplier), "1639" (year), "1845" (year) — these are semantically incoherent distractors. A year appearing as distractor for a lake-count question is trivially eliminable. Should split into `bracket_years` and `bracket_counts` sub-pools, each padded with synthetics.

---

- **Fact**: `us_states_minnesota_lakes` @ mastery=2,4 (bracket_numbers pool)
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "Minnesota's nickname says '10,000 Lakes,' but how many lakes does it actually have?"
  A) 2.5 | B) 1787 | C) 231 | D) 1639 | E) [11,842]
- **Issue**: "2.5" is Alaska's size multiplier relative to Texas — not a lake count. "1787", "1639", "1845", "1777" are all years — not lake counts. Only "231" (another numerical value) is plausibly a count. At mastery 4, 4 of 5 distractors are type-mismatched (years or ratios where a count is expected), making the correct answer the only plausible count-style answer.

---

- **Fact**: `us_states_delaware_first_state` / `us_states_vermont_slavery` / `us_states_texas_independent_republic` @ mastery=all (bracket_numbers pool)
- **Category**: `NUMERIC-WEAK`
- **Rendered** (e.g., `us_states_delaware_first_state` m=0):
  Q: "In what year did Delaware become the first state to ratify the US Constitution?"
  A) 1844 | B) [1787] | C) 1768
- **Issue**: Year-question distractors include year-type values — this is correct format-matching. However, lake-count "11,842" appears in the same pool and is drawn as a distractor at m=2 for year questions: `opts: ['1787', '1844', '1805', '1768']` — clean at this level. At m=4: `opts: ['1844', '1754', '1787', '1768', '1805']` — all years, which is actually correct behavior. The pool contamination manifests in the direction of years appearing for count questions, not the reverse. Still a pool design issue.

---

### NIT

- **Fact**: All state_capitals pool facts
- **Category**: `OTHER`
- **Rendered** (e.g., `us_states_pennsylvania_capital` m=0):
  Q: "What is the capital of Pennsylvania — not Philadelphia?"
  A) Tallahassee | B) [Harrisburg] | C) Sacramento
- **Issue**: The parenthetical "— not Philadelphia?" and "— not New York City?" in the capital questions are helpful hints (common misconception busters), but they arguably make the question easier by eliminating the most common wrong guess before it can appear as a distractor. This is a deliberate design choice but reduces challenge compared to a straight "What is the capital?" question.

---

## Expected vs Actual
- Expected: `{N}` bracket syntax renders correctly — **actual: confirmed, `{1777}` renders as `1777`**
- Expected: sub-deck factIds populated — **actual: all 4 sub-decks have correct factIds (18, 22, 17, 18)**
- Expected: No self-answering — **actual: `us_states_indiana_indy500` has Indianapolis → Indiana leak**
- Expected: bracket_numbers pool ≥15 — **actual: only 8 facts + 0 synthetics = 8 total (FAIL)**
- Expected: Factually accurate — **actual: `us_states_utah_five_parks` claim is misleading without precise qualifier**

## Notes
- The state_names_short and state_names_long pools are well-designed with semantically coherent distractors (neighbouring states, similarly obscure states).
- Capital city distractors (Harrisburg, Sacramento, Tallahassee, Austin, Raleigh, Springfield, Albany, Boston, Olympia, Lansing, Santa Fe) are well-chosen — all are real state capitals, not obviously wrong.
- The `us_states_maine_one_syllable` claim is correct — Maine is the only one-syllable US state name.
- The `us_states_kansas_geographic_center` claim is a well-known but slightly disputed geographic fact (depends on measurement method); the explanation acknowledges the nearby town of Lebanon.
