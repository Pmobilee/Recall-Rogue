# world_war_ii — Quiz Audit Findings

## Summary
World War II is a large, factually rich deck with good date distractor quality — WWII-era dates appearing as distractors for other WWII-era date questions is appropriate and challenging. The major structural issues are: (1) "Eight weeks" (a duration) sitting in `year_dates` pool alongside actual dates — FORMAT-TELL and POOL-CONTAM; (2) the raw number "338226" as a bracket answer renders without comma formatting ("338,226") which is awkward; (3) at mastery=0, date distractors sometimes include very implausible WWII dates from the right era but contextually wrong (e.g., "Dec 1948" for a 1942 question). The kamikaze ships-sunk statistic (34) is a FACTUAL-SUSPECT candidate. Overall quality is good — 7 issues found.

## Issues

### MAJOR

- **Fact**: `wwii_na_montgomery_el_alamein_prep` @ all mastery levels
- **Category**: `POOL-CONTAM`, `FORMAT-TELL`
- **Rendered** (mastery 0):
  Q: "...he refused Rommel's immediate challenge to attack and instead spent roughly how long preparing...?"
   A) Dec 1948 ← a date, not a duration
   B) Eight weeks ✓
   C) Jan 1, 1942 ← a date, not a duration
- **Issue**: The question asks "how long" — a duration answer. "Dec 1948" and "Jan 1, 1942" are date-formatted strings, not durations. They are instantly eliminable because the question type demands a duration. "Eight weeks" is the only duration-format option. This confirms that "Eight weeks" is incorrectly placed in `year_dates` — it should be in a separate `duration_answers` or `military_terms` pool. At mastery 4, additional date distractors "2+ years" and "Jan 6, 1941" appear — "2+ years" is at least duration-format, making it a semi-plausible distractor.

- **Fact**: `wwii_wf_dunkirk_troops` — answer "338226"
- **Category**: `OTHER` (rendering issue)
- **Rendered**:
  Q: "How many Allied troops were evacuated from the beaches of Dunkirk...?"
   A) 259,000
   B) 338226 ✓ ← no comma formatting
   C) 444,000
   D) 391,000
- **Issue**: The correct answer "338226" renders without comma separators while all three distractors use comma-formatted numbers ("259,000", "444,000", "391,000"). The inconsistent formatting makes the correct answer visually distinguishable by formatting alone — a LENGTH-TELL variant. The answer "338226" should be "338,226" for consistency. Additionally, at mastery 0-2, two distractors are formatted numbers while the correct answer is raw — this is a rendering inconsistency that makes the right answer identifiable.

### MINOR

- **Fact**: `wwii_ef_moscow_counter_date` — date distractors
- **Category**: No issue. Distractors "Jun 22, 1941" (Barbarossa launch), "May 19, 1941", "Aug 14, 1941", "Sep 8, 1941" are all within the 1941 Eastern Front context — appropriate, challenging date distractors. PASS. ✓

- **Fact**: `wwii_wf_cassino_bombing` — date distractors
- **Category**: No issue. Distractors "Oct 7, 1944", "Aug 25, 1944", "May 23, 1944", "Aug 1, 1944" are all 1944 dates — plausible and appropriately challenging for a Feb 15, 1944 question. Excellent. ✓

- **Fact**: `wwii_wf_bulge_date` — date distractors
- **Category**: No issue. Distractors include "June 6, 1944" (D-Day) — an extremely well-chosen distractor for a late-1944 battle. ✓

- **Fact**: `wwii_wf_ve_day` @ mastery=4
- **Category**: NIT
- **Rendered** (mastery 4): Distractor "Apr 15, 1945" (liberation of Bergen-Belsen) is a real significant WWII date close to V-E Day — excellent distractor quality. One distractor pulled from `pool_fill` noted.

- **Fact**: `wwii_pt_kamikaze_ships` — answer "34" ships sunk
- **Category**: `FACTUAL-SUSPECT`
- **Issue**: The claim "kamikazes sank only 34 ships" requires verification. Wikipedia's article on kamikazes gives varying figures. The explanation says "3,000+ sorties, sank only 34 ships — mostly small destroyers and escort carriers." This specific count (34) may be low-balling if counting only ships sunk vs. damaged. Not flagging as definitive error but noting as verification-needed. Do not fix without authoritative source.

- **Fact**: `wwii_na_montgomery_el_alamein_prep` @ mastery=2
- **Category**: MINOR FORMAT-TELL
- **Issue**: "2+ years" as duration distractor alongside "Eight weeks" creates meaningful distractor — good. But "Jan 1, 1942" and "Dec 1948" remain date-type distractors in a duration question context.

## Expected vs Actual

**Expected**: "Eight weeks" in `year_dates` pool = FORMAT-TELL.
**Actual**: Confirmed — "Eight weeks" surrounded by date-format distractors at every mastery level.

**Expected**: `bracket_counts` with large numbers formatted inconsistently.
**Actual**: Confirmed — "338226" vs "259,000" formatting mismatch.

**Expected**: Date distractors staying within WWII era.
**Actual**: Mostly confirmed as good practice. Date distractors are generally appropriate WWII-era dates. "Dec 1948" (post-war) does appear for a 1942 question — borderline but not egregious.

**Expected**: `historical_events` pool (167 facts) POOL-CONTAM.
**Actual**: Not directly sampled from this pool in the 20-fact dump. Cannot confirm in this sample but risk remains.

## Notes
- Date distractor quality in this deck is the best across the entire batch — WWII facts with WWII-era date distractors is appropriate and educational.
- "338226" number formatting issue is fixable with a simple string format transform.
- Do NOT flag: "Jun 22, 1941" (Barbarossa) as a distractor for a Dec 1941 question — this is an excellent choice as students might confuse Eastern Front dates.
- Do NOT flag the factual accuracy of the Dunkirk count (338,226 is the standard Wikipedia figure).
