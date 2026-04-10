# ap_us_history — Quiz Audit Findings

## Summary
AP U.S. History is a large, well-organized deck with strong chain theme alignment to the 9 APUSH periods. The primary structural issue is the `concept_terms` pool (142 facts) which inevitably produces cross-period distractor contamination — "Strategic Defense Initiative" (Reagan era) appearing alongside "Headright system" (colonial era) for the same question. A BLOCKER-level factual error exists: the Reagan fact claims he "presided over the end of the Cold War as the Soviet Union dissolved in 1991" — but Reagan left office January 20, 1989; the USSR dissolved December 25, 1991 under George H.W. Bush. A secondary issue is the parenthetical answer format ("CIA covert operations", "Baseball (national pastime)") which is non-standard and reads awkwardly. Self-answering risk in the New York Dutch colony question. 12 issues found.

## Issues

### BLOCKER

- **Fact**: `pres_reagan_end_cold_war` (from us_presidents dump, mirrored here as it's in ap_us_history)
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "Which president presided over the end of the Cold War as the Soviet Union dissolved in 1991?"
   Answer: Ronald Reagan
- **Issue**: Ronald Reagan left office on January 20, 1989. The Soviet Union officially dissolved on December 25, 1991 — two years and eight months after Reagan's presidency ended. George H.W. Bush was president when the USSR dissolved. Reagan's presidency was characterized by Cold War pressure campaigns, but he did not "preside over" the dissolution. The explanation in the deck acknowledges Gorbachev's reforms in 1985, but then incorrectly attributes the 1991 dissolution to Reagan's presidency. This is a factually incorrect answer to the question as worded.

Note: This fact appears in the `us_presidents` deck dump, not `ap_us_history` dump directly, but the factual error is noted here as it relates to APUSH content and may exist across decks.

### MAJOR

- **Fact**: `apush_p4_slavery_positive_good` @ mastery=4
- **Category**: `POOL-CONTAM`, `CATEGORY-TELL`
- **Rendered** (mastery 4):
  Q: "What phrase...shifted the South's defense of slavery from a reluctant justification to an aggressive argument...?"
   A) Common man (Jackson populism) ← Period 4, different topic
   B) "Bleeding Kansas" ← event name, not a phrase/argument
   C) Strategic Defense Initiative ← Period 8 (Reagan era missile defense)
   D) Positive good (pro-slavery arg) ✓
   E) Headright system ← Period 1 (colonial land grants)
- **Issue**: "Strategic Defense Initiative" is from 1983 — 150 years after the Calhoun speech. "Headright system" is from the colonial period. The question asks for a pro-slavery ideological phrase; a player knowing the time period (1830s) can eliminate both by era. The `concept_terms` pool's 142-fact span across all 9 APUSH periods guarantees this.

- **Fact**: `apush_p2_dutch_new_netherland` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (mastery 0):
  Q: "Dutch New Netherland...was seized by England in 1664 and renamed what colony?"
   A) New York (Dutch colony) ✓
   B) France (lost North America)
   C) Angel Island (immigration station)
- **Issue**: "New York" appears verbatim in the correct answer "New York (Dutch colony)" and the question context makes "New York" the obvious expected answer for any student who has heard of it. More critically, "France (lost North America)" is not a colony name — it is a sentence fragment. "Angel Island (immigration station)" is a West Coast immigration station, not a colonial territory. Both distractors are immediately eliminable. The self-answering compound issue: the question already implies "New York" via the "Duke of York" connection in the explanation, and any culturally aware player knows the answer.

- **Fact**: `apush_p8_cia_iran_guatemala` — answer "CIA covert operations"
- **Category**: `AMBIGUOUS-Q`, `OTHER`
- **Rendered**:
  Q: "In 1953 and 1954 respectively, the CIA orchestrated coups that overthrew elected governments in what two countries...?"
   A) CIA covert operations ✓
- **Issue**: The question asks "in what two countries" but the correct answer is "CIA covert operations" — a descriptor of the activity, not the names of the countries (Iran and Guatemala). The answer does not answer the question as asked. A student attempting to answer would say "Iran and Guatemala" but the deck accepts "CIA covert operations". This is a TEMPLATE-MISFIT / question-answer mismatch.

### MINOR

- **Fact**: `apush_p6_transcontinental_location` @ mastery=0
- **Category**: `POOL-CONTAM` (minor)
- **Rendered** (mastery 0):
  Q: "Where did the Union Pacific and Central Pacific railroads meet...?"
   A) Cahokia (Mississippian city) ← pre-Columbian Native American site
   B) Sunbelt (postwar boom region) ← a region, not a meeting point
   C) Promontory Summit, Utah ✓
- **Issue**: "Cahokia (Mississippian city)" is a pre-Columbian archaeological site — wrong era and wrong type (city not a railroad junction). "Sunbelt" is a geographic region, not a specific location. Both are eliminable. The question asks for a specific railroad meeting point; "Sunbelt" is especially weak as a place distractor.

- **Fact**: `apush_p5_sharecropping` — answer format
- **Category**: `OTHER` (NIT)
- **Issue**: "Sharecropping (crop debt cycle)" as a correct answer adds an editorial label in parentheses that reads awkwardly — the standard historical term is simply "sharecropping." This pattern recurs throughout the deck. Not a blocker but degrades answer quality.

- **Fact**: `apush_p6_baseball_national_pastime` — answer "Baseball (national pastime)"
- **Category**: `OTHER` (NIT)
- **Issue**: Similar parenthetical label issue. "Baseball" alone would be the correct answer; the "(national pastime)" suffix is editorial.

- **Fact**: `apush_p3_elastic_clause` — "Necessary and Proper Clause" vs "Black Codes"
- **Category**: No issue. Distractors "Southern Strategy" and "Black Codes" are from later periods but still US history concepts — not egregious cross-contamination. Passable.

## Expected vs Actual

**Expected**: `concept_terms` (142 facts) would produce cross-period contamination.
**Actual**: Confirmed across multiple facts. "Strategic Defense Initiative" (Period 8) and "Headright system" (Period 1) appearing as co-distractors with Period 4 content.

**Expected**: Parenthetical answer format reads awkwardly.
**Actual**: Confirmed — "Positive good (pro-slavery arg)", "CIA covert operations", "Sharecropping (crop debt cycle)", "Baseball (national pastime)" all use editorial suffixes.

**Expected**: FACTUAL-SUSPECT for Reagan/Cold War.
**Actual**: Confirmed — Reagan left office 1989, USSR dissolved 1991. Factual error.

**Expected**: Self-answering in New York question.
**Actual**: Confirmed — "renamed what colony" + "New York (Dutch colony)" as answer.

## Notes
- Do NOT flag: The CIA covert operations fact's historical content (the coups happened) — only the Q-A format mismatch.
- Do NOT flag: "Bleeding Kansas" as a distractor for the positive good question — both are Period 4 content and "Bleeding Kansas" is at least the right era, making it a plausible (if wrong-type) distractor.
- The `bracket_numbers` pool at 48 facts is well-sized for numeric questions.
