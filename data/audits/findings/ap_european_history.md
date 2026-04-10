# ap_european_history — Quiz Audit Findings

## Summary
AP European History is the best-structured deck in the batch. The short/long pool split is well-designed and largely eliminates the POOL-CONTAM pattern seen in the ancient history decks. However, several issues remain: (1) concept_terms_short/long pools draw distractors from across nine centuries of European history, producing time-period-incongruous distractors that are CATEGORY-TELL (e.g., "War Communism" and "Ostpolitik" as distractors for Reformation-era questions); (2) "72 years" (a count) sits in `concept_terms_short` — a pool misassignment; (3) `date_answers_short` mixes year-range and month-year formats. The `document_names` pools are clean and well-chosen. Factual accuracy is excellent throughout. 8 issues found.

## Issues

### MAJOR

- **Fact**: `ap_euro_u3_louis_xiv_reign_length` @ all mastery levels
- **Category**: `POOL-CONTAM`, `CATEGORY-TELL`
- **Rendered** (mastery 4):
  Q: "How long did Louis XIV reign as King of France...?"
   A) oil painting ← an art medium
   B) Sweden ← a country name
   C) War Communism ← a Soviet economic policy
   D) Sola fide ← Lutheran theological doctrine
   E) 72 years ✓
- **Issue**: "72 years" is a numeric duration answer in `concept_terms_short` — a pool for conceptual historical terms. Distractors drawn from the same pool produce "oil painting", "Sweden", "War Communism", and "Sola fide" — none of which are plausible answers to a "how long did X reign" question. A player immediately knows the answer is a duration and eliminates everything but "72 years". The root cause is the numeric duration being placed in the wrong pool.

- **Fact**: `ap_euro_u2_luther_bible_translation` @ mastery=2 and mastery=4
- **Category**: `POOL-CONTAM`, `CATEGORY-TELL`
- **Rendered** (mastery 4):
  Q: "Into what vernacular language did Luther translate the Bible to make it accessible to common people?"
   A) openness ← Soviet glasnost concept
   B) Ostpolitik ← West German Cold War foreign policy
   C) Social realism ← Soviet art style
   D) sans-culottes ← French Revolutionary term
   E) German ✓
- **Issue**: The question asks for a language name. Distractors "openness", "Ostpolitik", "Social realism", and "sans-culottes" are all non-language concepts from completely different eras (Cold War, French Revolution). A player identifying the question as asking for a language immediately eliminates all four distractors. The `concept_terms_short` pool spans 500+ years of European history, making cross-era contamination near-universal.

- **Fact**: `ap_euro_u9_cuban_missile_crisis_month` @ mastery=0 and mastery=2
- **Category**: `POOL-CONTAM`, `FORMAT-TELL`
- **Rendered** (mastery 2):
  Q: "In what month and year did the Cuban Missile Crisis occur...?"
   A) 1884–1885 ← Berlin Conference dates (year range)
   B) June 23, 2016 ← Brexit vote (specific date, future era)
   C) 1814–1815 ← Congress of Vienna (year range)
   D) October 1962 ✓
- **Issue**: The correct answer is "October 1962" (month + year). Distractors are year-ranges ("1884–1885", "1814–1815") and a specific day-date ("June 23, 2016"). A player knows the answer must be "month year" format, eliminating all three distractors by format. "June 23, 2016" is in the future relative to the Cold War context and is instantly eliminable as a Brexit-era date. The `date_answers_short` pool mixes multiple date formats.

- **Fact**: `ap_euro_u6_042` — answer "Coal, rivers, and capital"
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "What specific advantage did Britain's geography provide that gave it rivers suitable for powering early mills and transporting goods?"
   A) to protect natural rights
   B) Coal, rivers, and capital ✓
   C) Mission civilisatrice
- **Issue**: The question specifically asks about rivers ("rivers suitable for powering early mills") but the correct answer is "Coal, rivers, and capital" — a three-part answer encompassing more than just rivers. The question stem partially describes the answer (naming rivers as one of the advantages), weakening the question. Minor self-answering leak: the word "rivers" in the question hints at the answer. AMBIGUOUS-Q because the question and answer scope don't align cleanly.

### MINOR

- **Fact**: `ap_euro_u6_055` — "Inventor-entrepreneur model"
- **Category**: No issue. Distractors "Christian humanism", "New Economic Policy (NEP)", "Freeing them from the land", "equality before the law" are from different eras but plausible as wrong concepts. A reasonably challenging question. PASS.

- **Fact**: `ap_euro_u6_028` — "Utopian socialism"
- **Category**: No issue. Distractors "Priesthood of all believers", "Justify imperialism", "Universal male suffrage" are from European history and plausible wrong answers for an ideology question. Good.

- **Fact**: `ap_euro_u5_congress_of_vienna_dates` — "1814–1815"
- **Category**: No issue at mastery 0-2. At mastery 4, "1618 to 1648" (Thirty Years' War) is an excellent plausible wrong date range. PASS.

- **Fact**: `ap_euro_u1_machiavelli_the_prince` @ mastery=0
- **Category**: NIT. Distractor "David" is a sculpture, not a text — could be CATEGORY-TELL for a "which political treatise..." question, as a sculpture is not a treatise. At mastery 0 with only 2 distractors ("Edict of Nantes", "David"), the "Edict of Nantes" is a plausible text distractor but "David" is not a treatise. Minor.

### NIT

- **Fact**: `ap_euro_u5_concordat_1801` — correct answer "Concordat of 1801"
- **Category**: NIT. "Liberty Leading the People" (a painting) appears as distractor for a "which accord..." question. A painting is not an accord — slight CATEGORY-TELL but very minor as students might associate it with the Napoleon era.

## Expected vs Actual

**Expected**: Short/long pool split would reduce POOL-CONTAM.
**Actual**: Partially confirmed — document_names, event_names, person_names pools work well. But `concept_terms_short/long` pools still span all nine AP Euro units, producing cross-era time-period contamination that is effectively POOL-CONTAM within a single large pool.

**Expected**: `date_answers_short` format mixing.
**Actual**: Confirmed — "October 1962" (month-year) and "1814–1815" (year-range) and "June 23, 2016" (day-month-year) all in same pool.

**Expected**: "72 years" pool misassignment.
**Actual**: Confirmed — numeric duration in concept_terms_short pool produces non-duration distractors.

## Notes
- AP exam unit/topic tagging is present and appears accurate for sampled facts.
- Factual accuracy throughout the sample is excellent.
- Do NOT flag: "Freeing them from the land" as a concept_terms_long distractor — this is a legitimate historical phrase (serfdom abolition) even if imprecisely phrased.
- The inconsistent examTags schema (array vs object format) is a structural concern but does not affect quiz quality.
