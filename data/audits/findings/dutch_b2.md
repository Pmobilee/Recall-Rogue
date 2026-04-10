# dutch_b2 — Quiz Audit Findings

## Summary
90 quiz entries (30 facts × 3 mastery levels from 71-fact deck — extremely high sample ratio). 15 SELF_ANSWERING instances in the dump (16.7% of entries!) — highest rate in the entire batch. Three cognate facts (conflict, festival, gamer) appear repeatedly in the sample. LENGTH_TELL in 6 cases. This deck is critically undersized at 71 facts; the 90-entry dump covers all 3 mastery levels of 30 distinct facts, meaning the remaining 41 facts were not sampled at all.

Counts: SELF_ANSWERING×15, LENGTH_TELL×6, POOL_EXHAUSTION (structural).

---

## Issues

### BLOCKER

- **Fact**: `nl-cefr-1195` @ mastery=0 and mastery=2
- **Category**: `SELF-ANSWERING`
- **Rendered** (forward template @ mastery=0):
  Q: "What does 'conflict' mean?"
   A) easy
   B) bandage, connection
   C) conflict  ✓
- **Issue**: Dutch "conflict" = English "conflict". Self-answering across all templates. With only 71 facts in the pool, this fact is recycled frequently as both question and distractor for other facts.

---

- **Fact**: `nl-cefr-1195` @ mastery=2
- **Category**: `SELF-ANSWERING` + `LENGTH_TELL`
- **Rendered** (reverse template):
  Q: "How do you say 'conflict' in Dutch?"
   A) preference (10)
   B) bandage, connection (19)
   C) easy (4)
   D) conflict (8)  ✓
- **Issue**: Dutch answer "conflict" is identical to the English word in the question. Length ratio = 4.8× ("bandage, connection" at 19 chars vs "easy" at 4 chars). Two issues compound.

---

- **Fact**: `nl-cefr-1203` (festival), `nl-cefr-1206` (gamer)
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does 'festival' mean?" → correct: "festival"
  Q: "What does 'gamer' mean?" → correct: "gamer"
- **Issue**: Both are English loanwords used unchanged in Dutch. "gamer" is modern English slang borrowed into Dutch; its presence in a B2 deck adds no language learning value.

---

- **Fact**: `nl-cefr-1205` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (forward template):
  Q: "What does 'game' mean?"
   A) conflict
   B) video game  ✓
   C) password
- **Issue**: Dutch "game" (= "video game" in Dutch informal usage) is an English loanword. The question word is English; the only way this is not self-answering is that the Dutch meaning is specifically "video game" rather than the full English sense of "game". However, a player unfamiliar with Dutch could still guess that "game" in Dutch means something game-related and select "video game" correctly.

---

- **Fact**: `nl-cefr-1205` @ mastery=2
- **Category**: `SELF-ANSWERING` + `LENGTH_TELL`
- **Rendered** (reverse template):
  Q: "How do you say 'video game' in Dutch?"
   A) conflict (8)
   B) after all, indeed (17)
   C) game (4)  ✓
   D) password (8)
- **Issue**: Length ratio = 4.25×. The correct answer "game" (4 chars) stands out against "after all, indeed" (17 chars). Also semi-self-answering: "game" is the obvious Dutch word for "video game".

---

### MAJOR

- **Fact**: `nl-cefr-1214` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "kenmerk — characteristic. Also: reference number"
   A) material
   B) local
   C) festival
   D) characteristic  ✓
   E) active
- **Issue**: "characteristic" in explanation. Also: "festival" appears as a distractor — drawn from this same tiny pool, it is a cognate that a player would never confuse with "characteristic", making it an unusually easy distractor.

---

- **Fact**: `nl-cefr-1242` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match template):
  Q: "voorbeeld — example. Also: role model, preview"
   A) after all, indeed
   B) aim, purpose
   C) painting
   D) example  ✓
   E) source
- **Issue**: "example" in explanation.

---

### MINOR

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: 71 facts for a B2 deck is a critical structural deficiency. The deck should have 800–1,500 facts. As it stands, a player studying Dutch B2 in Study Temple mode will cycle through the entire deck in minutes and see rapid repetition. The FSRS system will quickly schedule most items as "mastered" due to repeated exposure in short sessions.

---

- **Fact**: `nl-cefr-1232` @ mastery=0
- **Category**: `SELF-ANSWERING`
- **Rendered** (definition_match):
  Q: "televisie — television."
   Correct: "television"
- **Issue**: Minimal explanation. "televisie" is a direct Dutch cognate of "television".

---

### NIT

- **Fact**: deck-wide
- **Category**: `OTHER`
- **Issue**: difficulty=1 for B2. This is the fourth CEFR level with difficulty=1. A player advancing from Dutch A1 through B2 sees no change in challenge level metadata across any of the four Dutch decks.

---

## Expected vs Actual
- **Expected**: B2 deck challenges upper-intermediate Dutch learners with 1,000+ abstract and professional vocabulary items.
- **Actual**: 71 facts, 3 are perfect English cognates/loanwords, 15 of 90 dump entries are self-answering (16.7%).
- **Expected**: Pool size supports distractor diversity.
- **Actual**: Pool of 71 creates near-exhaustion at mastery=4; "festival" appears as a distractor in "kenmerk/characteristic" questions — semantically incoherent.

## Notes
- This deck appears to be an incomplete stub. The CEFRLex B2 Dutch list should contain significantly more vocabulary. Either the ingestion pipeline stopped early, or the NT2Lex source genuinely has very few B2 Dutch entries — but the latter seems implausible given that Dutch B2 learners encounter thousands of new words.
- The combination of 71 facts + no synthetic distractors + difficulty=1 + three cognate self-answering facts makes this the weakest deck in the entire 14-deck batch on every quality dimension.
