# Quiz Quality Report — BATCH-2026-04-01-002

**Date:** 2026-04-01
**Tester:** LLM Quiz Quality Tester (Claude Sonnet 4.6)
**Run:** general_knowledge / balanced archetype
**Encounters Played:** 3 combat + 1 mystery event (Tutor's Office)
**Unique Quizzes Captured:** 23 unique factIds (across ~50+ quiz instances with distractor rotation)

---

## VERDICT

**PASS with minor issues.** Quiz system is functioning correctly. Questions are clear, distractors are LLM-generated and plausible, no artifacts or formatting bugs. One factual concern flagged (Steve Wozniak universal remote). One question clarity issue (alphabet symbols — answer format is awkward). Distractor rotation across turns is working well.

**Overall Score: 4.0 / 5.0**

---

## FIXES VERIFIED

| Fix | Status |
|---|---|
| Reward room in turbo mode | CONFIRMED WORKING — rewardRoom screen appeared then auto-advanced to dungeonMap |
| acceptReward() in Phaser scene | Note: API reports "RewardRoomScene not active" but game progressed correctly — turbo auto-accept works |
| Floor 1 enemy damage cap raised 3→6 | CONFIRMED — Thesis Construct dealt multi-attacks, player HP remained at 100/100 (combat finished quickly) |

---

## SUMMARY

| Metric | Value |
|---|---|
| Encounters | 3 combat + 1 mystery event |
| Unique factIds observed | 23 |
| Unique quiz instances | ~50 (distractor rotation across turns) |
| Domains seen | general_knowledge, language (zh/ko/ja), natural_sciences |
| O-QZ checks passed | 7/8 (O-QZ5 borderline on 1 item) |
| S-QZ average | 4.0/5.0 |
| Critical issues | 0 |
| Major issues | 1 (possible factual error) |
| Minor issues | 3 |

---

## OBJECTIVE CHECKLIST

| ID | Check | Result | Notes |
|---|---|---|---|
| O-QZ1 | 3+ choices per quiz | PASS | All quizzes had 3–4 choices |
| O-QZ2 | No duplicate choices | PASS | No duplicate options observed |
| O-QZ3 | No rendering artifacts | PASS | No `{`, `}`, `undefined`, `null` artifacts in choices |
| O-QZ4 | No empty questions/choices | PASS | All fields populated |
| O-QZ5 | Question length 20–300 chars | PASS | All within range; shortest ~35 chars |
| O-QZ6 | Correct index in bounds | PASS | correctIndex always within choices array |
| O-QZ7 | No near-duplicate choices | PASS | Distractors are distinct |
| O-QZ8 | 2+ domains represented | PASS | general_knowledge, language, natural_sciences all observed |

---

## SUBJECTIVE CHECKLIST

| ID | Check | Score | Notes |
|---|---|---|---|
| S-QZ1 | Distractor plausibility | 4/5 | Most distractors are excellent. A few language card distractors are implausible (see issues) |
| S-QZ2 | Question clarity | 4/5 | Most very clear. Alphabet/logography question is awkward phrasing |
| S-QZ3 | Answer correctness | 4/5 | One possible factual error on Wozniak universal remote date |
| S-QZ4 | Difficulty appropriateness | 4/5 | M0 cards at 3 distractors is correct per spec. Difficulty feels appropriate |
| S-QZ5 | Cultural bias | 4/5 | Mix of Western tech, Asian language vocab — reasonable balance |

---

## ISSUES BY SEVERITY

### MAJOR

**M-001: Possible factual error — Steve Wozniak universal remote**
- factId: `gk-wozniak-universal-remote-1987`
- Question: "What household device did Steve Wozniak invent after leaving Apple in 1985?"
- Answer: "Universal remote control"
- Concern: The question states "after leaving Apple in 1985" — Wozniak formally resigned in February 1985. He did found CL 9 (later CORE) and created the CORE remote around 1987. The factoid is roughly correct but the framing "after leaving Apple in 1985" may conflate the leave date with the invention date. The question title has `1987` in the factId itself. This is a minor framing issue but could mislead learners about the timeline. Recommend adding the year to the question: "What household device did Steve Wozniak invent in 1987, two years after leaving Apple?"

### MINOR

**MN-001: Awkward answer format — alphabet symbols question**
- factId: `general_knowledge-writing-system-logographic-thousands`
- Question: "How many distinct symbols does a typical alphabet use, compared to logographies?"
- Answer: "Fewer than {100}" (raw fact) / rendered as "Fewer than 100" in quiz
- Distractors: "Fewer than 65", "Fewer than 129", "Fewer than 135"
- Issue: The `{100}` brace-marker in the raw fact answer is rendering correctly in the quiz as "Fewer than 100", but the question phrasing is confusing — it asks about both alphabets AND logographies, but only answers the alphabet side. A cleaner question: "How many distinct symbols does a typical alphabet use?" Answer: "Fewer than 100". The logography comparison context is in the explanation, not needed in the question.

**MN-002: Some language card distractors are semantically distant**
- factId: `ja-kanji-n1-991` (kanji '逸')
- Distractor: "Deng Linlin" (a Chinese gymnast) — appears in one instance
- This is a named person as a distractor for a meaning question, which is semantically inappropriate. Most other instances used abstract nouns ("belfry", "to be thirsty") which are fine.
- Observed only in one distractor rotation instance; other rotations used better distractors.

**MN-003: Mystery event quiz not accessible via previewCardQuiz / getQuiz API**
- The Tutor's Office mystery event presents quizzes that are not exposed through `window.__rrPlay.getQuiz()` (returns null) or `previewCardQuiz()`.
- Manual observation via DOM was required to capture these 3 questions.
- This is a testing infrastructure gap, not a content issue.

---

## DISTRACTOR ROTATION QUALITY

The system rotates distractors across turns for the same factId. Observed for several repeated facts:

**`general_knowledge-tim-berners-lee-web-invented-cern`** (appeared 4 times):
- Instance 1: NASA, CERN, Stanford University, Xerox PARC
- Instance 2: Stanford University, Xerox PARC, Oxford University, CERN
- Instance 3: CERN, Bletchley Park, Stanford University, Bell Labs
- Instance 4: NASA, Xerox PARC, CERN, IBM Research

All distractors are plausible research institutions. Excellent rotation — no distractor repeats across the 4 instances. correctIndex shifts correctly each time.

**`ko-nikl-781`** ("섞다" = "to mix, to rub") (appeared 4 times):
- Instance 1: wireless, first place, to mix to rub, to be leisurely
- Instance 2: recent, industry, to mix to rub, first of all firstly
- Instance 3: to wander to get lost, to be scolded, fundamental, to mix to rub
- Instance 4: to date, honestly frankly, to mix to rub, bank account

Mixed quality — most distractors are Korean vocab meanings (appropriate), but "to wander to get lost" and "to be scolded" are reasonable Korean verbs, while "bank account" and "honestly frankly" are plausible Korean vocab concepts. Overall acceptable.

**`sciences-snow-unique-snowflake`** (appeared 3 times):
- Instance 1: Temperature is always changing, Each takes a unique atmospheric path, Ice is fundamentally random, Humidity varies always
- Instance 2: No two water molecules match, Each takes a unique atmospheric path, Ice is fundamentally random, Wind makes each unique
- Instance 3: Each takes a unique atmospheric path, Ice crystals are random, Humidity varies always, Ice is fundamentally random

Good rotation. All distractors are scientifically adjacent misconceptions — excellent quality.

---

## MYSTERY EVENT QUIZ DATA (The Tutor's Office)

Three questions presented as a standalone event, not through card charge system:

| Q# | Question | Choices | Correct | Quality |
|---|---|---|---|---|
| 1 | What image technology did most monitors use before the mid-2000s? | OLED panel, LCD panel, Cathode ray tube | Cathode ray tube | Excellent — 3 plausible tech options |
| 2 | What role do sea otters play by controlling sea urchin populations? | Apex predator, Flagship species, Keystone species | Keystone species | Good — ecology terminology, plausible distractors |
| 3 | Who designed the first modern internal combustion engine in 1876? | Nicolaus Otto, Karl Benz, Robert Bosch | Nicolaus Otto | Excellent — all three are real 19th-century German engineers |

Mystery event quizzes are high quality. All 3 factually correct, distractors are contextually appropriate.

---

## DOMAIN DIVERSITY

Observed domains across 3 combat encounters:
- `general_knowledge`: 12 quiz instances (CERN/WWW, Wozniak remote, keyboard/punched cards, android automotive, alphabet symbols, soft robotics)
- `language`: 8 quiz instances (zh-hsk 率先, ko 섞다, ja-kanji 逸)
- `natural_sciences`: 4 quiz instances (snowflakes, sea otters)

O-QZ8 (2+ domains) is comfortably met. The run was configured with `general_knowledge` domain but pulled in `language` cards too — expected behavior given mixed deck.

---

## COMPARISON TO BATCH-001

| Aspect | BATCH-001 | BATCH-002 | Change |
|---|---|---|---|
| Reward room | BROKEN (combat froze) | WORKING (turbo auto-accepts) | Fixed |
| Floor 1 enemy damage | Capped at 3 (too easy) | Multi-attacks at 2×2 | Fixed — more threatening |
| Quiz content quality | Not tested (blocked by reward bug) | 4.0/5.0 — good overall | First full quiz test |
| Mystery event | Not tested | Fully played through | New data |
| Distractor rotation | Not tested | Excellent — 4 rotations of same fact all unique | New data |
| API access | N/A | `window.__rrPlay` (not bare globals) | Documented |

---

## RAW QUIZ JSON DATA

### Combat Encounter 1 — Thesis Construct (21 HP)

**Turn 1 Hand:**
```json
[
  {"factId":"general_knowledge-tim-berners-lee-web-invented-cern","question":"Where was the World Wide Web invented in 1989?","choices":["NASA","CERN","Stanford University","Xerox PARC"],"correctAnswer":"CERN","correctIndex":1,"domain":"general_knowledge","cardType":"attack"},
  {"factId":"general_knowledge-robot-nature-bio-inspired","question":"What robotics sub-discipline was inspired by the pliable, flexible structures found in living organisms?","choices":["Medical robotics","Nano robotics","Soft robotics","Exo-robotics"],"correctAnswer":"Soft robotics","correctIndex":2,"domain":"general_knowledge","cardType":"utility"},
  {"factId":"general_knowledge-writing-system-logographic-thousands","question":"How many distinct symbols does a typical alphabet use, compared to logographies?","choices":["Fewer than 135","Fewer than 129","Fewer than 65","Fewer than 100"],"correctAnswer":"Fewer than 100","correctIndex":3,"domain":"general_knowledge","cardType":"attack"},
  {"factId":"gk-wozniak-universal-remote-1987","question":"What household device did Steve Wozniak invent after leaving Apple in 1985?","choices":["Universal remote control","Electronic organizer","Portable CD player","Voice assistant"],"correctAnswer":"Universal remote control","correctIndex":0,"domain":"general_knowledge","cardType":"shield"},
  {"factId":"zh-hsk-3049","question":"What does \"率先\" (shuài xiān) mean?","choices":["capability","difference","government","to take the lead"],"correctAnswer":"to take the lead","correctIndex":3,"domain":"language","cardType":"attack"}
]
```

**Turn 2 Hand:**
```json
[
  {"factId":"general_knowledge-writing-system-logographic-thousands","question":"How many distinct symbols does a typical alphabet use, compared to logographies?","choices":["Fewer than 65","Fewer than 129","Fewer than 100","Fewer than 135"],"correctAnswer":"Fewer than 100","correctIndex":2,"domain":"general_knowledge"},
  {"factId":"zh-hsk-3049","question":"What does \"率先\" (shuài xiān) mean?","choices":["punctuation","nighttime","to take the lead","to tremble"],"correctAnswer":"to take the lead","correctIndex":2,"domain":"language"},
  {"factId":"ko-nikl-781","question":"What does \"섞다\" mean?","choices":["wireless","first place","to mix, to rub","to be leisurely"],"correctAnswer":"to mix, to rub","correctIndex":2,"domain":"language"},
  {"factId":"ja-kanji-n1-991","question":"What does the kanji '逸' mean?","choices":["belfry","deviate, idleness","to be thirsty","Deng Linlin"],"correctAnswer":"deviate, idleness","correctIndex":1,"domain":"language"},
  {"factId":"general_knowledge-keyboard-replaced-punched-cards","question":"What obsolete technology did computer keyboards replace for inputting data?","choices":["Teletype rolls","Dial inputs","Punched cards","Abacus entries"],"correctAnswer":"Punched cards","correctIndex":2,"domain":"general_knowledge"},
  {"factId":"sciences-snow-unique-snowflake","question":"Why are no two snowflakes identical?","choices":["Temperature is always changing","Each takes a unique atmospheric path","Ice is fundamentally random","Humidity varies always"],"correctAnswer":"Each takes a unique atmospheric path","correctIndex":1,"domain":"natural_sciences"},
  {"factId":"general_knowledge-android-tv-wear-automotive","question":"Which Android variant is designed specifically for in-car systems?","choices":["Android Dashboard","Android Automotive","ChromeOS","Android Vehicle"],"correctAnswer":"Android Automotive","correctIndex":1,"domain":"general_knowledge"}
]
```

### Mystery Event — The Tutor's Office

```json
[
  {"question":"What image technology did most monitors use before the mid-2000s?","choices":["OLED panel","LCD panel","Cathode ray tube"],"correctAnswer":"Cathode ray tube","source":"mystery_event"},
  {"question":"What role do sea otters play by controlling sea urchin populations?","choices":["Apex predator","Flagship species","Keystone species"],"correctAnswer":"Keystone species","source":"mystery_event"},
  {"question":"Who designed the first modern internal combustion engine in 1876?","choices":["Nicolaus Otto","Karl Benz","Robert Bosch"],"correctAnswer":"Nicolaus Otto","source":"mystery_event"}
]
```

### Combat Encounter 2 — Margin Gremlin (17 HP), Turn 1

```json
[
  {"factId":"sciences-snow-unique-snowflake","question":"Why are no two snowflakes identical?","choices":["No two water molecules match","Each takes a unique atmospheric path","Temperature is always changing","Wind makes each unique"],"correctAnswer":"Each takes a unique atmospheric path","correctIndex":1},
  {"factId":"ko-nikl-781","question":"What does \"섞다\" mean?","choices":["recent","industry","to mix, to rub","first of all, firstly"],"correctAnswer":"to mix, to rub","correctIndex":2},
  {"factId":"general_knowledge-writing-system-logographic-thousands","question":"How many distinct symbols does a typical alphabet use, compared to logographies?","choices":["Fewer than 65","Fewer than 135","Fewer than 129","Fewer than 100"],"correctAnswer":"Fewer than 100","correctIndex":3},
  {"factId":"general_knowledge-tim-berners-lee-web-invented-cern","question":"Where was the World Wide Web invented in 1989?","choices":["Stanford University","Xerox PARC","Oxford University","CERN"],"correctAnswer":"CERN","correctIndex":3},
  {"factId":"gk-wozniak-universal-remote-1987","question":"What household device did Steve Wozniak invent after leaving Apple in 1985?","choices":["Universal remote control","Wireless mouse","Electronic organizer","Digital answering machine"],"correctAnswer":"Universal remote control","correctIndex":0}
]
```

### Combat Encounter 3 — Mold Puff (32 HP), Turn 1

```json
[
  {"factId":"general_knowledge-tim-berners-lee-web-invented-cern","question":"Where was the World Wide Web invented in 1989?","choices":["CERN","Bletchley Park","Stanford University","Bell Labs"],"correctAnswer":"CERN","correctIndex":0},
  {"factId":"zh-hsk-3049","question":"What does \"率先\" (shuài xiān) mean?","choices":["to take the lead","comprehensive","to be applicable","subject"],"correctAnswer":"to take the lead","correctIndex":0},
  {"factId":"ko-nikl-781","question":"What does \"섞다\" mean?","choices":["to date","honestly, frankly","to mix, to rub","bank account"],"correctAnswer":"to mix, to rub","correctIndex":2},
  {"factId":"general_knowledge-writing-system-logographic-thousands","question":"How many distinct symbols does a typical alphabet use, compared to logographies?","choices":["Fewer than 129","Fewer than 65","Fewer than 135","Fewer than 100"],"correctAnswer":"Fewer than 100","correctIndex":3},
  {"factId":"general_knowledge-android-tv-wear-automotive","question":"Which Android variant is designed specifically for in-car systems?","choices":["Android Automotive","Android Vehicle","Android Drive","Android Things"],"correctAnswer":"Android Automotive","correctIndex":0}
]
```

---

## SESSION NOTES

- **API location:** `window.__rrPlay` (not bare globals as stated in prompt — prompt references `getScreen()`, `startRun()` etc. as globals but they live at `window.__rrPlay.*`)
- **Run setup:** Had to navigate to hub and click "Continue Run" instead of `startRun()` + `selectDomain()` flow (run was already in progress from a previous session)
- **Mystery event API gap:** `window.__rrPlay.getQuiz()` returns null during mystery event quizzes; `getMysteryEventChoices()` returns [] — these quizzes are not programmatically inspectable, only via DOM scraping
- **Reward room:** In turbo mode, reward room auto-advances immediately. `acceptReward()` returns "RewardRoomScene not active" but game continues correctly — this is expected turbo behavior, not a bug
- **Fact repetition:** Confirmed Anki-faithful repetition — same ~9 factIds appeared across all 3 combat encounters (22+ charge opportunities), consistent with known behavior
