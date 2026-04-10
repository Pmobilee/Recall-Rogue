# ap_world_history — Quiz Audit Findings

## Summary
AP World History is the largest deck in the batch (620 facts) and has good AP exam alignment. However, the `concept_terms` pool (297 facts — 48% of the deck) is the most problematic pool across all 9 decks audited. It inevitably pulls distractors spanning 800 years and every world region. The clearest manifestation: "Final Solution (Nazi genocide plan)" appearing as a distractor for a question about medieval India's Sepoy Mutiny context — an 86-year gap and completely different domain. Additionally, "1644-1912" (Qing dynasty dates) appears in `empire_dynasty_names` pool as a non-name entry — pool contamination at the data level. One broken-grammar/awkward question phrasing detected. 11 issues found.

## Issues

### BLOCKER

- **Fact**: `apwh_6_020` (Sepoy Mutiny) @ mastery=4
- **Category**: `POOL-CONTAM`, `CATEGORY-TELL`
- **Rendered** (mastery 4):
  Q: "What was the immediate trigger for the Sepoy Mutiny (1857)...?"
   A) Collect tolls on overland and sea trade
   B) Economic imperialism (informal control)
   C) Greased cartridges with cow and pig fat ✓
   D) Final Solution (Nazi genocide plan) ← Holocaust, 1941–1945
   E) Turned American public against the war ← Vietnam War era
- **Issue**: "Final Solution (Nazi genocide plan)" is from WWII (1941–1945) — 84 years after the Sepoy Mutiny. "Turned American public against the war" is from the Vietnam War era (1960s–70s). Both are drawn from `concept_terms` pool facts from unit 6 or 7. A student who knows even the rough century of the Sepoy Mutiny (1857) can eliminate these instantly. The `concept_terms` pool mixes content from all 9 AP World History units without any period filter.

### MAJOR

- **Fact**: `apwh_1_017` (Khmer Empire) @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 2):
  Q: "Which Southeast Asian empire, centered at Angkor, built massive temple complexes...?"
   A) Khmer Empire ✓
   B) 1644-1912 ← a date range, not an empire name
   C) Spanish Empire
   D) Mamluk Sultanate
- **Issue**: "1644-1912" is in the `empire_dynasty_names` pool but is a date range (the Qing dynasty dates), not an empire name. It appears as a distractor here — trivially eliminable because it's not the name of anything. This is a data error: the Qing dynasty dates were incorrectly placed in a pool for empire/dynasty names instead of a dates pool.

- **Fact**: `apwh_1_065` (Song Dynasty meritocracy) @ mastery=2
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 2):
  Q: "...Which state is MOST distinct in using an examination-based meritocracy...?"
   A) Song Dynasty China ✓
   B) Fatimid Caliphate
   C) Mamluk Sultanate
   D) Mughal Empire
- **Issue**: This is actually a well-constructed question with plausible distractors (all major pre-modern Muslim states). However, "Mughal Empire" existed c. 1526–1857, and the question asks about c. 1200–1450 — the Mughal Empire didn't exist yet in 1200–1450. FACTUAL-SUSPECT: Mughal Empire should not appear as a distractor for a c. 1200–1450 question. Fatimid Caliphate (909–1171) and Mamluk Sultanate (1250–1517) are period-appropriate. Mughal is not.

- **Fact**: `apwh_1_062` — Ethiopian/Indian Ocean trade
- **Category**: `BROKEN-GRAMMAR`, `AMBIGUOUS-Q`
- **Rendered**:
  Q: "The Ethiopian Christian kingdom's red sea coastal position gave it access to which major long-distance trade the interconnected system linking it to Egypt, Arabia, and India?"
- **Issue**: The question has garbled syntax: "...gave it access to which major long-distance trade the interconnected system..." — the phrase "long-distance trade the interconnected system" is broken phrasing. This reads as two sentence fragments merged. "red sea" should be capitalized ("Red Sea"). Constitutes BROKEN-GRAMMAR.

- **Fact**: `apwh_3_065` (millet system) @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 4):
  Q: "Why was the millet system considered 'structured tolerance' rather than full equality in the Ottoman Empire?"
   A) Excludes deaths during capture, coastal holding, and seasoning ← Atlantic slave trade terminology
   B) Community autonomy but paid jizya and had lower legal status ✓
   C) European overseas expansion since the 15th century
   D) Humanitarian mission to end the Arab slave trade
- **Issue**: "Excludes deaths during capture, coastal holding, and seasoning" is about Atlantic slave trade mortality accounting — from a completely different context (Unit 3-4 Atlantic trade) appearing as a distractor for an Ottoman Empire governance question. "Humanitarian mission to end the Arab slave trade" is imperialism-justification terminology from Unit 5. Both from `concept_terms` pool spanning all periods.

### MINOR

- **Fact**: `apwh_2_021` (Paper and printing technology) — all mastery levels
- **Category**: `POOL-CONTAM` (minor)
- **Issue**: Distractor "Antiretroviral therapy" (modern HIV treatment) appears in the `technology_inventions` pool as a distractor for a medieval paper/printing question. This is immediately eliminable for anyone who knows "antiretroviral" is a modern medical term. At mastery 4 it joins "Transatlantic cable" and "Steam-powered ships" — both post-medieval technologies slightly more plausible as wrong answers, but "Antiretroviral therapy" is a clear outlier.

- **Fact**: `apwh_2_024` (Dhow sailing vessel) — all mastery levels
- **Category**: `POOL-CONTAM` (minor)
- **Issue**: "Spinning jenny" (Industrial Revolution textile machine) appears as distractor for a question about medieval Indian Ocean sailing vessels. The `technology_inventions` pool mixes medieval and modern technologies. "Suez Canal connection" (1869) also appears as a distractor for c. 1200-1450 content. Both are anachronistic.

- **Fact**: `apwh_6_020` (Sepoy Mutiny) @ mastery=2
- **Category**: `POOL-CONTAM`
- **Issue**: "Turned American public against the war" as distractor for 1857 Indian content. Less egregious than the mastery=4 "Final Solution" but still cross-era contamination.

### NIT

- **Fact**: `apwh_1_017` (Khmer Empire) @ mastery=4
- **Category**: NIT
- **Issue**: "Portuguese Empire" and "Spanish Empire" as distractors for "which Southeast Asian empire" are eliminable by region for any student who knows Spain and Portugal were European colonial powers, not Southeast Asian empires. Borderline CATEGORY-TELL but reasonable for a globally scoped AP World History deck.

## Expected vs Actual

**Expected**: `concept_terms` (297 facts) would produce severe cross-period contamination.
**Actual**: Confirmed — worst seen across this entire batch. "Final Solution" for 1857 question. "Antiretroviral therapy" for medieval technology question.

**Expected**: "1644-1912" in `empire_dynasty_names` would appear as a non-name distractor.
**Actual**: Confirmed — appears at mastery=2 for the Khmer Empire question.

**Expected**: BROKEN-GRAMMAR in Ethiopian question.
**Actual**: Confirmed — garbled syntax in `apwh_1_062`.

**Expected**: Mughal Empire anachronism for c. 1200–1450 questions.
**Actual**: Confirmed — Mughal Empire used as distractor for a c. 1200–1450 period question.

## Notes
- The `concept_terms` pool needs urgent period-based splitting: at minimum `concept_terms_early` (Units 1–3, pre-1750) and `concept_terms_modern` (Units 4–9, post-1750).
- "1644-1912" in `empire_dynasty_names` should either be removed or replaced with "Qing Dynasty" (the name).
- Do NOT flag: "Fatimid Caliphate" and "Mamluk Sultanate" as distractors for Song Dynasty question — both are period-appropriate (c. 1200–1450) and legitimate plausible wrong answers.
- Do NOT flag as factual errors: The Sepoy Mutiny trigger (greased cartridges) — well-documented history.
