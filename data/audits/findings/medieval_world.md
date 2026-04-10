# medieval_world — Quiz Audit Findings

## Summary
Medieval World has broader global scope than the ancient decks and generally solid content. The dominant issues are two: (1) `date_named` pool format heterogeneity — mixing date-ranges ("c. 1235–c. 1610"), durations ("Over 1,100 years"), and specific dates creates obvious LENGTH-TELL and FORMAT-TELL situations; (2) `ruler_leader_names` cross-domain contamination — leaders from Byzantine, African, and Japanese contexts share one pool, producing non-sequitur distractors like "Fujiwara clan" in a Crusades question. One BROKEN-GRAMMAR issue found. A factual nuance concern exists for the Reagan/Cold War attribution in the explanation. 9 issues across 30 sampled facts.

## Issues

### BLOCKER

- **Fact**: `med_6_afr_mansa_musa_catalan` @ all mastery levels
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "which European cartographic work described Mansa Musa as 'the richest man in the region'..."
- **Issue**: The question begins with lowercase "which" — this is a broken sentence start. Every rendering of this fact at every mastery level has a question that begins with a lowercase letter. Constitutes a presentation-level bug that appears on every rendering.

### MAJOR

- **Fact**: `med_byz_empire_overview` @ mastery=4
- **Category**: `POOL-CONTAM`, `FORMAT-TELL`
- **Rendered** (mastery 4):
  Q: "How long did the Byzantine Empire last, from Constantinople's founding to its fall?"
   A) 916 years
   B) 1324–1325
   C) 3rd century CE
   D) Over 1,100 years ✓
   E) 1096–1099
- **Issue**: The `date_named` pool mixes duration-format ("Over 1,100 years", "916 years"), specific-year-ranges ("1324–1325", "1096–1099"), and era-descriptions ("3rd century CE"). A player immediately knows the answer is a duration ("how long...") and can eliminate all non-duration options. "1324–1325" and "1096–1099" are eliminable by format alone.

- **Fact**: `med_6_afr_mali_duration` @ mastery=4
- **Category**: `FORMAT-TELL` (sub-type of POOL-CONTAM)
- **Rendered** (mastery 4):
  Q: "The Mali Empire lasted from approximately 1235 to what year...?"
   A) 3rd century CE
   B) June 1097
   C) c. 1235–c. 1610 ✓
   D) May 11, 868 CE
   E) c. 1312–c. 1337
- **Issue**: The question asks for an end-year but the correct answer is a full range "c. 1235–c. 1610". Distractors "June 1097" and "May 11, 868 CE" are specific event-dates from completely different eras (Crusades, Tang dynasty) — instantly eliminable by time period. "3rd century CE" is an era description. Only "c. 1312–c. 1337" (Mansa Musa's reign) is a plausible wrong range.

- **Fact**: `med_4_cru_godfrey_bouillon` @ mastery=0 and mastery=2
- **Category**: `CATEGORY-TELL`, `POOL-CONTAM`
- **Rendered** (mastery 2):
  Q: "Which leader of the First Crusade became the first ruler of Jerusalem after its capture in 1099...?"
   A) Fujiwara clan ← Japanese ruling clan, wrong continent
   B) Charlemagne ← died 814 CE, 285 years before the Crusade
   C) Godfrey of Bouillon ✓
   D) King Ezana ← Aksumite king, 4th century CE Africa
- **Issue**: "Fujiwara clan" is a Japanese ruling family, not a person and not from the Crusades context. "King Ezana" ruled Ethiopia in the 4th century. Both are CATEGORY-TELL distractors — wrong region and wrong century — instantly eliminable. "Charlemagne" is at least a medieval European ruler, making it the only plausible distractor.

- **Fact**: `med_6_afr_aksum_christianity` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 0):
  Q: "Under which Aksumite king...did the Kingdom of Aksum convert to Christianity in the 4th century?"
   A) Al-Mansur ← Abbasid caliph (8th century)
   B) Ayyubid ← a dynasty name, not a person
   C) King Ezana ✓
- **Issue**: "Ayyubid" is a dynasty/group name, not a ruler name, making it immediately identifiable as wrong for a "which king..." question. "Al-Mansur" is from a different religion and 4 centuries later. At mastery 0 this is trivially easy.

### MINOR

- **Fact**: `med_6_afr_sundiata_dates` @ mastery=0
- **Category**: `FORMAT-TELL`
- **Rendered** (mastery 0):
  Q: "What were the approximate birth and death years of Sundiata Keita...?"
   A) June 1097 ← a specific month-year event date
   B) c. 1217–c. 1255 ✓
   C) 3rd century CE ← an era description
- **Issue**: "June 1097" (a specific Crusades date) and "3rd century CE" are immediately eliminable by format — the question asks for birth/death years so the answer must be a "birth year–death year" range.

- **Fact**: `med_byz_justinian_reign` @ mastery=0
- **Category**: No issue. Distractors "Harald Bluetooth" and "Empress Wu Zetian" are at least period-appropriate rulers (roughly medieval), though from wrong cultures. "Bernard of Clairvaux" is a medieval European clergyman — somewhat plausible for a Crusades-related question but not a Byzantine emperor. Acceptable at mastery 0.

- **Fact**: `med_5_song_paper_money` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery 4):
  Q: "What was the name of the Song dynasty paper currency...?"
   A) Arabic for 'coast'
   B) Jiaozi (paper notes) ✓
   C) Clinker-built shallow draft
   D) Won Denmark and Norway; baptized Danes
   E) Deus vult (God wills it)
- **Issue**: "Arabic for 'coast'", "Clinker-built shallow draft", and "Deus vult (God wills it)" are descriptions of geographic terms, ship construction, and a Crusades battle cry respectively — none plausible as the name of a currency. From `description_phrases` pool mixing multiple domains.

- **Fact**: `med_5_heian_tale_of_genji` @ mastery=0
- **Category**: No issue. Distractors "Corpus Juris Civilis" (Byzantine legal code) and "Wujing Zongyao" (Chinese military text) are both actual medieval works — plausible for a "which early work..." question even across cultures.

## Expected vs Actual

**Expected**: `date_named` format heterogeneity producing FORMAT-TELL.
**Actual**: Confirmed across `med_byz_empire_overview` and `med_6_afr_mali_duration`. Duration-format vs year-range format vs specific-date format are all pooled together.

**Expected**: `ruler_leader_names` cross-domain contamination.
**Actual**: Confirmed — "Fujiwara clan", "King Ezana", "Al-Mansur", "Ayyubid" all appearing as distractors in contextually incompatible questions.

**Expected**: BROKEN-GRAMMAR in `med_6_afr_mansa_musa_catalan`.
**Actual**: Confirmed — lowercase "which" at sentence start.

## Notes
- "Ayyubid" in `ruler_leader_names` pool is a dynasty name (not a ruler name) — likely a data entry error; should be "Saladin" or another specific ruler.
- Do NOT flag: Factual claim about Mansa Musa's wealth being "unverifiable" — the deck appropriately hedges this claim per the Wikipedia source, which is correct scholarly practice.
- Do NOT flag: "Corpus Juris Civilis" as a distractor for the Tale of Genji fact — this is a legitimate medieval text from a different culture, making it a reasonable wrong answer for a "which work..." question.
