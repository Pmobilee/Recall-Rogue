# Quiz Quality Report — BATCH-2026-03-27-002
**Tester**: Quiz Quality | **Model**: claude-sonnet-4-6 | **Domain**: general_knowledge (all domains) | **Encounters**: 2

**Verdict**: ISSUES

---

## Summary
- Total quizzes captured: 16 (11 unique facts — some facts repeated across turns/encounters due to small starting deck)
- Quizzes with full data (choices[]): 16 / 16
- Domains represented: art_architecture, history, human_body_health, geography, food_cuisine, general_knowledge (6 domains)
- Enemy 1: Index Weaver (18 HP) — defeated in 2 turns
- Enemy 2: Bookmark Vine (18 HP) — defeated in 2 turns

---

## Objective Findings

| Check | Result | Pass Count | Fail Count | Notes |
|-------|--------|------------|------------|-------|
| O-QZ1 | Choice count (≥3) | PASS | 16 | 0 | All quizzes had exactly 4 choices |
| O-QZ2 | No duplicate choices | PASS | 16 | 0 | No two choices identical within any quiz |
| O-QZ3 | No data artifacts | PASS | 16 | 0 | No `undefined`, `null`, `NaN`, `[object` found |
| O-QZ4 | Question completeness | PASS | 16 | 0 | All questions non-empty |
| O-QZ5 | Question length (20-300 chars) | PASS | 16 | 0 | Range: ~45–90 chars; all in bounds |
| O-QZ6 | Correct index in bounds | FAIL | 14 | 2 | 2 facts with `{N}` numeric answers have wrong correctIndex (always 0) — see Critical Issues |
| O-QZ7 | No near-duplicate choices | PASS | 16 | 0 | No choices with >90% character similarity |
| O-QZ8 | Domain coverage (≥2 domains) | PASS | — | — | 6 domains represented |

---

## Subjective Assessments

| Check | Rating (1-5) | Representative Examples | Issues Found |
|-------|-------------|------------------------|-------------|
| S-QZ1 | Distractor plausibility | 4/5 | "Harsh winter halted them" / "Pope excommunicated them" for Mongol retreat — very plausible. "Velvet Revolution" / "Orange Revolution" for Singing Revolution — excellent, all are real events. "Scafell Pike" / "Ben Macdui" for Ben Nevis — strong, all are real British peaks. | Minor: "Mount Kilimanjaro" as distractor for Saint Kitts highest peak is too obviously wrong (wrong continent). |
| S-QZ2 | Question clarity | 4/5 | Most questions are clear and specific. "Which even more ornate..." telegraphs the direction (ornate > Baroque). | "What was the peaceful independence movement in the Baltic states called?" — technically the Singing Revolution was primarily Estonian/Latvian/Lithuanian, the answer "Singing Revolution" is correct but framing as "Baltic states" is slightly over-broad. |
| S-QZ3 | Answer correctness | 5/5 | All correct answers verified: Rococo ✓, Aztec Empire ✓, Sensory homunculus ✓, Mount Liamuiga ✓, Salt ✓, Ögedei Khan ✓, Singing Revolution ✓, Ben Nevis ✓, 6 simple machines ✓, 2 posthumous volumes ✓. | None — all answers appear factually correct. |
| S-QZ4 | Difficulty appropriateness | 4/5 | Good spread from easy (Ben Nevis, Salt) to hard (Mount Liamuiga, sensory homunculus). Floor 1 difficulty feels appropriate. | "geo-saint-kitts-nevis-mount-liamuiga" is floor-1 but very obscure — appropriate for a knowledge game, though it may frustrate new players. |
| S-QZ5 | Cultural bias | 3/5 | History questions skew European/Western (Mongols invading Europe, Das Kapital, Cortés). | 3 of 5 history facts involve European perspectives; no Asian, African, or Indigenous-led historical events in sample. Not a blocking issue but worth noting for diversity. |

---

## Issues Found

### CRITICAL

**[C-01] correctIndex fallback bug for `{N}` numeric answers**

- **Facts affected**: `history-karl-marx-das-kapital-posthumous`, `general_knowledge-lever-simple-machine`
- **Root cause**: `previewCardQuiz()` in `src/dev/playtestAPI.ts` line 311 computes `choices.indexOf(correctAnswer)` where `correctAnswer` still contains curly-brace notation (e.g. `"{2}"`), but `getQuizChoices()` builds choices using `displayAnswer()` which strips braces (producing `"2"`). So `indexOf` returns -1 and falls back to index 0.
- **Impact on gameplay**: The `chargePlayCard` API's "answer correctly" mode uses `correctIndex` to pick the right answer. For numeric facts, it will always submit `choices[0]` regardless of which choice is actually correct. In the live quiz UI this may also affect which button is highlighted as correct after answering.
- **Evidence**:
  - `{2}` fact: `choices: ["9","5","10","2"], correctAnswer: "{2}", correctIndex: 0` → index 0 is "9", not "2"
  - `{6} simple machines` fact: `choices: ["1 simple machines","15 simple machines","3 simple machines","6 simple machines"], correctAnswer: "{6} simple machines", correctIndex: 0` → index 0 is "1 simple machines", not "6 simple machines"
- **Fix**: In `src/dev/playtestAPI.ts` line 311, change:
  ```ts
  const correctIndex = choices.indexOf(correctAnswer);
  ```
  to:
  ```ts
  const correctIndex = choices.indexOf(displayAnswer(correctAnswer));
  ```
  (import `displayAnswer` from `../services/numericalDistractorService`)
- **Note**: This bug is in `playtestAPI.ts` (dev tool) only. The actual game quiz logic uses `gradeAnswer()` which correctly calls `displayAnswer()`. The live quiz UI itself is likely unaffected — this is a testing-tool accuracy bug, not a player-facing gameplay bug. However it means `chargePlayCard(i, true)` may submit wrong answers for numeric facts, invalidating bot playtest accuracy metrics.

---

### HIGH

**[H-01] `{N}` notation leaks into `correctAnswer` field returned by `previewCardQuiz`**

- The `correctAnswer` field in the `previewCardQuiz` response returns the raw database value (`"{2}"`, `"{6} simple machines"`) rather than the display-ready value (`"2"`, `"6 simple machines"`).
- This is confusing for any consumer of the API (bots, testers, LLMs) who compare `correctAnswer` against `choices[]` — the strings won't match.
- **Fix**: Line 310 of `playtestAPI.ts` should set `correctAnswer = displayAnswer(fact.correctAnswer ?? '')` before using it in the returned state.

---

### MEDIUM

**[M-01] Mount Kilimanjaro distractor for Saint Kitts question is geographically implausible**

- `geo-saint-kitts-nevis-mount-liamuiga`: choices include "Mount Kilimanjaro" (Africa's highest peak, ~5,895m), which is obviously not in the Caribbean. A knowledgeable player would instantly eliminate it.
- Better distractors: other Caribbean high points (La Grande Soufrière on Guadeloupe, Morne Diablotins on Dominica, Soufrière Hills on Montserrat).
- Severity: medium — reduces quiz quality and educational value of the distractor set.

**[M-02] Repeated fact exposure across encounters**

- Several facts appeared in both encounters (food_cuisine-salt-west-africa-gold, history-ogedei-khan-mongol-retreat, history-karl-marx-das-kapital-posthumous, art_architecture-baroque-rococo-1730-central-europe, geography-estonia-singing-revolution).
- On floor 1 with a small starter deck this is expected, but 5 out of 10 distinct facts in combat 2 were repeats from combat 1. Players will see the same questions every combat.
- This is a deck-size/pool-size design issue, not a bug.

---

### LOW

**[L-01] Cultural/geographic skew in sample**

- 3 of 5 unique history facts involve European conquest or European political philosophy.
- Factual accuracy is fine; the skew is worth monitoring as more content is evaluated.

**[L-02] `answer` field uses `{N}` curly-brace format inconsistently**

- Most facts store plain-text answers. Only numeric facts use `{N}` notation. This is by design (for numerical distractor generation), but the inconsistency is invisible to content authors and could cause confusion when reviewing raw fact data.

---

## Raw Quiz Data

All 16 quiz snapshots (11 unique facts; some repeated across turns):

| # | factId | domain | question | choices | correctAnswer | correctIndex | anomalies |
|---|--------|--------|----------|---------|---------------|--------------|-----------|
| 1 | art_architecture-baroque-rococo-1730-central-europe | art_architecture | Which even more ornate architectural style evolved from Baroque around 1730? | Brutalism / Neoclassicism / Modernism / **Rococo** | Rococo | 3 | none |
| 2 | history-hernán-cortés-conquered-aztec | history | Hernán Cortés conquered which mighty New World empire with only hundreds of soldiers? | The Zapotec Empire / The Olmec Empire / The Muisca Confederation / **The Aztec Empire** | The Aztec Empire | 3 | none |
| 3 | health-somatosensory-homunculus-map | human_body_health | What is the brain's body map in the somatosensory cortex called? | **Sensory homunculus** / Sensory homograph / Neural topograph / Somatic index | Sensory homunculus | 0 | none |
| 4 | geo-saint-kitts-nevis-mount-liamuiga | geography | What is the name of the dormant volcano that is the highest point of Saint Kitts? | Mount Scenery / Morne Diablotins / Mount Kilimanjaro / **Mount Liamuiga** | Mount Liamuiga | 3 | [M-01] Kilimanjaro distractor implausible |
| 5 | food_cuisine-salt-west-africa-gold | food_cuisine | In ancient West Africa, which commodity was traded equal in value to gold by weight? | **Salt** / Iron / Ivory / Silk | Salt | 0 | none |
| 6 | history-ogedei-khan-mongol-retreat | history | Why did victorious Mongol armies retreat from Poland and Hungary in 1241? | Harsh winter halted them / **Ögedei Khan died** / Pope excommunicated them / A truce was signed | Ögedei Khan died | 1 | none |
| 7 | geography-estonia-singing-revolution | geography | What was the peaceful independence movement in the Baltic states called? | Amber Revolution / **Singing Revolution** / Velvet Revolution / Orange Revolution | Singing Revolution | 1 | none |
| 8 | geography-scotland-ben-nevis-highest-british | geography | What is the name of the highest mountain in the British Isles? | Slieve Donard / Scafell Pike / **Ben Nevis** / Ben Macdui | Ben Nevis | 2 | none |
| 9 | general_knowledge-lever-simple-machine | general_knowledge | How many simple machines did Renaissance scientists identify, of which the lever is one? | 1 simple machines / 15 simple machines / 3 simple machines / **6 simple machines** | {6} simple machines | 0 (WRONG — should be 3) | [C-01] correctIndex fallback bug |
| 10 | history-karl-marx-das-kapital-posthumous | history | How many of Das Kapital's three volumes were published after Karl Marx's death? | **9** / 5 / 10 / 2 (correct display) | {2} | 0 (WRONG — should be 3) | [C-01] correctIndex fallback bug |
| 11 | art_architecture-baroque-rococo-1730-central-europe | art_architecture | Which even more ornate architectural style evolved from Baroque around 1730? | Gothic Revival / Art Nouveau / **Rococo** / Deconstructivism | Rococo | 2 | repeated fact, different distractor set (shuffle working correctly) |
| 12 | food_cuisine-salt-west-africa-gold (enc2) | food_cuisine | In ancient West Africa, which commodity was traded equal in value to gold by weight? | Copper / Pepper / **Salt** / Ivory | Salt | 2 | repeated fact |
| 13 | history-ogedei-khan-mongol-retreat (enc2) | history | Why did victorious Mongol armies retreat from Poland and Hungary in 1241? | They achieved their goals / **Ögedei Khan died** / They ran out of horses / Pope excommunicated them | Ögedei Khan died | 1 | repeated fact, different distractor set |
| 14 | history-karl-marx-das-kapital-posthumous (enc2) | history | How many of Das Kapital's three volumes were published after Karl Marx's death? | 9 / 5 / 10 / **2** | {2} | 0 (WRONG) | [C-01] repeated |
| 15 | art_architecture-baroque-rococo-1730-central-europe (enc2 utility) | art_architecture | Which even more ornate architectural style evolved from Baroque around 1730? | Gothic Revival / Art Nouveau / **Rococo** / Deconstructivism | Rococo | 2 | repeated fact |
| 16 | geography-estonia-singing-revolution (enc2) | geography | What was the peaceful independence movement in the Baltic states called? | Rose Revolution / Baltic Spring / **Singing Revolution** / Orange Revolution | Singing Revolution | 2 | repeated fact, different distractor set |

---

## Additional Observations

**Distractor shuffling confirmed working**: The same fact (e.g. Rococo question) appeared 4 times with different distractor sets and different correct answer positions each time, confirming that `shuffleArray` is functioning correctly.

**Distractor quality is generally high**: The history and geography distractors in particular (Velvet Revolution, Orange Revolution, Rose Revolution, Baltic Spring for the Singing Revolution fact; Scafell Pike, Ben Macdui, Slieve Donard for Ben Nevis) demonstrate excellent LLM-generated plausible wrong answers that require real knowledge to eliminate.

**RewardRoomScene error**: Both encounters threw `[RewardRoomBridge] RewardRoomScene not found` errors after victory, skipping the card reward screen. This is a pre-existing system bug unrelated to quiz quality but noted for completeness.
