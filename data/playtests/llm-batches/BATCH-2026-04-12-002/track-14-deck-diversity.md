# Track 14 — Deck Diversity & Domain Coverage
**Date:** 2026-04-12 | **Agent-id:** track-14 | **Decks tested:** 6 | **Facts sampled:** 495+

## Verdict: ISSUES

Three distinct issue classes found: (1) unresolved `{N}` artifact tokens in quiz choices (known from Track 3, independently confirmed), (2) anatomy deck generates only `image_answers` quiz mode facts in the study session (unrenderable in text quiz), (3) `getStudyCard()` API returns null for all study decks due to `data-testid="study-card-question"` not being set on quiz overlay elements.

---

## Per-Deck Ratings

| Deck | Distinctiveness | Distractors | Diversity | Accuracy | Difficulty | Average |
|------|----------------|-------------|-----------|----------|------------|---------|
| ancient_rome (169 facts) | 5 | 2 (artifacts) | 5 | 5 | 4 | 4.2 |
| ancient_greece (145 facts) | 5 | 2 (artifacts) | 5 | 5 | 4 | 4.2 |
| famous_paintings (100 facts) | 5 | 5 (clean) | 5 | 5 | 4 | 4.8 |
| constellations (63 facts) | 5 | 2 (artifacts) | 5 | 5 | 4 | 4.2 |
| human_anatomy (18 in DB) | 4 | 5 (clean in DB) | 3 (small sample) | 5 | 3 | 4.0 |
| chess_tactics (runtime only) | 5 | N/A (chess_tactic mode) | 5 | N/A | N/A | N/A |

---

## Cross-Deck Analysis

- **Cross-contamination:** NO — zero cross-deck distractor exact-matches found across 350 fact sample
- **Domain fallback:** NO — each study preset (`rr:scenarioStudyQuestions`) generates deck-specific factIds (verified via Symbol.for('rr:scenarioStudyQuestions'))
- **Distractor leakage:** NO exact-match leakage found. However, `{N}` artifact tokens DO appear in distractor positions (see Issues)

---

## Sample Questions (confirmed from live factsDB + study session data)

### ancient_rome (study session Q1 — confirmed from DOM screenshot)
```
Q: Which Carthaginian general crossed the Alps with war elephants to invade Italy in 218 BCE?
Choices: Hannibal Barca | Hamilcar Barca | Cato the Elder | Scipio Africanus
Status: CLEAN — all plausible Roman historical figures
```

### ancient_rome (artifact example — confirmed from factsDB scan)
```
Q: Between Nero's persecution in 64 CE and Decius's in 250 CE, which Flavian emperor conducted
   a persecution of Christians in approximately 95 CE?
Choices: {7} | {1961} | c. 95 CE | {50}
Status: FAIL — 3/4 choices are unresolved {N} tokens
```

### ancient_greece (study session confirmed questions)
```
Q: In what year did the Battle of Marathon take place — the decisive Athenian victory?
Correct: 490 BCE
Status: NOT IN factsDB (found only in study session generator, not getQuizChoices)
```

### ancient_greece (artifact example)
```
Q: At what age were Spartan boys taken from their families to begin the agoge?
Choices: 7 | {10000} | {5} | {500}
Status: FAIL — 3/4 choices are unresolved {N} tokens
```

### famous_paintings (all clean — reference example)
```
Q: Who painted this 1632 group portrait of a public dissection in Amsterdam?
Choices: Rembrandt | Velázquez | The Catholic Church | Artemisia Gentileschi
Status: CLEAN — all painters (one anomaly: "The Catholic Church" is a non-painter distractor)

Q: In which Italian city is the Uffizi Gallery?
Correct: Florence
Status: CLEAN (confirmed in study session)
```

### constellations (artifact example)
```
Q: How many confirmed planets does the 55 Cancri system in Cancer have?
Choices: {1930} | 5 | {6} | {2022}
Status: FAIL — 3/4 choices are unresolved {N} tokens
```

### human_anatomy (study session — image mode issue)
```
Study session generates: ha_visual_333_img_ans, ha_visual_313_img_ans, ha_visual_351_img_ans
quizMode: "image_answers" for ALL 3 questions
Status: ISSUE — image_answers questions are unrenderable in text-based study quiz overlay
The 18 non-image ha_ facts in factsDB are all CLEAN (0 artifacts)
```

### chess_tactics (study session confirmed)
```
Q: White to move. (Puzzle #CM1eK)
Correct: Qxf7+
quizMode: chess_tactic
Q: Black to move. (Puzzle #AOyE0)
Correct: Re1+
Q: Black to move. (Puzzle #GhUEy)
Correct: g5+
Status: Chess puzzles serve correctly from chess-puzzles.db (separate from factsDB)
```

---

## Issues Found

### ISSUE-01: {N} Artifact Tokens in Quiz Distractors [CRITICAL — already filed as Track 3 CRITICAL-01]
**Root cause confirmed independently:** `quizService.ts` line 229 does NOT apply `displayAnswer()` to distractor pool entries, so brace-marked numerical answers render as `{7}`, `{1961}`, `{50}` etc.
**Affected decks:** ancient_rome (8/169 = 4.7%), ancient_greece (11/145 = 7.6%), constellations (4/63 = 6.3%)
**Famous paintings:** CLEAN (0/100). Human anatomy (in-DB facts): CLEAN (0/18).
**Fix location:** `src/services/quizService.ts` line 229 — `.map(d => displayAnswer(d))`

### ISSUE-02: Human Anatomy Study Session Generates Unrenderable Image-Mode Facts [NEW]
**What happened:** `study-deck-anatomy` study session (via `generateStudyQuestions()` using the curated deck) selects `ha_visual_*` facts with `quizMode: "image_answers"`. The text-based quiz overlay cannot render these image questions.
**Evidence:** All 3 study session questions from anatomy had `quizMode: "image_answers"` (ha_visual_333_img_ans, ha_visual_313_img_ans, ha_visual_351_img_ans). None are in factsDB.
**Impact:** Anatomy study sessions silently fail to show questions. The quiz remains frozen on whatever question was previously rendered.
**Fix candidates:** Filter out `image_answers` / `image_question` quizMode facts in `generateStudyQuestions()`, OR handle image-mode facts in the study quiz UI.

### ISSUE-03: getStudyCard() Returns null for All Study Decks [EXISTING LIMITATION]
**Confirmed:** `window.__rrPlay.getStudyCard()` returns `null` for all study-deck-* scenarios at the 6-second mark.
**Root cause:** `getStudyCardText()` in `playtestDescriber.ts` reads from `data-testid="study-card-question"` which is not set on the `StudyQuizOverlay` component's quiz card elements. The actual question text is in `.question-text` or similar un-testid'd element.
**Impact:** AI agents cannot programmatically query study quiz content. The `rr:scenarioStudyQuestions` Symbol.for() workaround successfully returns question data.
**Fix:** Add `data-testid="study-card-question"` to the quiz question element in `StudyQuizOverlay`.

### ISSUE-04: Anatomy Study Session Deck: Only 18/2009 Facts Reach factsDB [INFORMATIONAL]
The human_anatomy deck has 2009 facts in JSON but only 18 appear in factsDB (the non-image text facts). The remaining ~1991 are either `ha_visual_*` image facts or not yet ingested by `npm run build:curated`. The 18 in-DB facts are all clean. This is consistent with Track 3 findings.

### METHODOLOGICAL NOTE: "SOMETHING WENT WRONG" in DOM Scrapes
DOM text scraping using `querySelectorAll('*')` and reading `textContent` picks up text inside `display:none` elements (the `#rr-crash-overlay` from `index.html`). This overlay is always present in the DOM but has `display:none` when there is no crash. Text walkers that only check direct parent `getComputedStyle` will falsely flag this as visible. A proper TreeWalker checking full ancestor chain will find this is hidden. The `getStudyCard()` returning null is NOT caused by this overlay — the study quiz is rendering correctly.

---

## Self-Verification

All data from live factsDB (53,269 facts) in Docker warm container track-14, port 3203.

```
Artifact scan results (live):
  ancient_rome:     169 facts in DB, 8 artifact (4.7%)
  ancient_greece:   145 facts in DB, 11 artifact (7.6%)
  famous_paintings: 100 facts in DB, 0 artifact (0%)
  constellations:    63 facts in DB, 4 artifact (6.3%)
  human_anatomy:     18 facts in DB, 0 artifact (0%)
  chess_tactics:      0 facts in factsDB (uses chess-puzzles.db, runtime-only)

Study session question sources (confirmed via Symbol.for('rr:scenarioStudyQuestions')):
  study-deck-rome:         rome_rep_she_wolf_legend, rome_cae_ides_of_march, rome_god_jupiter_king
  study-deck-paintings:    paint_mov_uffizi_gallery, paint_ren_renaissance_movement, paint_mov_prado_madrid
  study-deck-anatomy:      ha_visual_333_img_ans (image_answers!), ha_visual_313_img_ans (image_answers!), ha_visual_351_img_ans (image_answers!)
  study-deck-constellations: const_myth_gemini_dioscuri, const_dso_pleiades_name, const_mc_canis_major_brightest
  study-deck-chess:        chess_tac_CM1eK (chess_tactic), chess_tac_AOyE0 (chess_tactic), chess_tac_GhUEy (chess_tactic)
  study-deck-greece:       greece_pw_marathon_date (NOT in factsDB), greece_rel_aphrodite_roman, greece_ga_euripides_medea (NOT in factsDB)

Cross-contamination check: 0 exact-match distractor leaks across 350 facts (rome, greece, paintings, constellations, anatomy)
```
