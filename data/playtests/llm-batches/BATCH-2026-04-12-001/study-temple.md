# Study Temple Report — BATCH-2026-04-12-001

**Tester:** Study Temple | **Model:** sonnet | **Domain:** general_knowledge | **Date:** 2026-04-11

## Verdict: **ISSUES**

Two real study sessions completed end-to-end (6 unique questions across 2 sessions). Discovered three real code/content bugs:
1. **HIGH** — `StudyQuizOverlay.svelte` does not call `displayAnswer()` to strip `{N}` bracket-notation markers, leaking raw template literals into the rendered answer buttons (`{1984}` observed in-game).
2. **HIGH** — `__rrPlay.startStudy()` is broken: writes `rr:currentScreen='restStudy'` before DOM-click lookup, but `data-testid="rest-study"` only exists on `restRoom`. Navigating to `restStudy` unmounts the rest room. The correct sequence would be `restRoom → click → (handler navigates)`. Every future tester using this API will hit this.
3. **MEDIUM** — Test spec assumed an Anki-style SM-2 grading UI (again/hard/good/easy) and a 10-card session with spaced-repetition reappearance. The live Study Temple is a 3-question multiple-choice quiz with no FSRS scheduling, no grade buttons, no card-reappearance mechanic. The `gradeCard`/`fastForward`/SM-2 assumptions in the task brief are stale relative to the current UI. This is a spec/docs bug more than a game bug, but it blocks any tester that tries to follow the prompt literally.

None of the three are CRITICAL (study mode is playable, satisfying, and the 3-question flow works). All three are real finds.

---

## Session 1 Summary

- **Path used:** spawn `{screen:'combat',enemy:'page_flutter',domain:'general_knowledge'}` → `writeStore('rr:currentScreen','restRoom')` → click `[data-testid="rest-study"]`. (The `startStudy` API was broken; I used manual DOM wiring as fallback — see HIGH bug above.)
- **Cards studied:** 3 (game-enforced cap; `size` parameter non-functional per `playtestAPI.ts:910`)
- **Session length:** ~20 s from button click to completion screen, including the 1.2 s auto-advance delay per answer
- **Q1 graded wrong (baseline "again"):** Clicked "563 BCE" for "When did the historical Buddha die?" — correct answer was "483 BCE" per the question prompt's long chronology framing
- **Q2 graded correct ("good"):** Clicked "Iris Murdoch" for "Who wrote *The Sovereignty of Good* (1970)?"
- **Q3 graded correct ("good"):** Clicked "Larry Page and Sergey Brin" for "Which two Stanford PhD students incorporated Google on September 4, 1998?"
- **Final result:** `"2 of 3 cards mastered up!"` — book-emoji (`📖`) completion screen
- **Pre-session `getStudyPoolSize`:** 10
- **Post-session `getStudyPoolSize`:** 10 (unchanged — the pool is the count of *eligible-to-upgrade* cards, and the starter deck has multiple cards per mechanicId still below max mastery)
- **`getLeechInfo`:** `{suspended: [], nearLeech: [], totalLeeches: 0}` — clean; fresh run has no leech history
- **`getSessionSummary`:** returns diagnostic ring-buffer stats (`eventCount`, `typeCounts.state-change`, `typeCounts.fps`, `durationMs`), NOT quiz accuracy/answered/correct counts. The tester task's description ("aggregate stats including review accuracy") is inaccurate for this API.

## Time Advance

- `fastForward(2)` → `{ok: true, message: "Fast-forwarded 2 hours"}` — accepted and returned clean
- `getStudyPoolSize` after fast-forward: 10 (unchanged — pool is FSRS-agnostic, based on mastery-upgrade eligibility only)

## Session 2 Summary (after +2 hours)

- **Same path used** — writeStore `restRoom` → click `rest-study` (repeatable, played twice successfully in one warm-container session)
- **Cards studied:** 3
- **Questions drawn:** entirely different fact set from Session 1 (Transformers-1984, 2013 Netflix binge-pioneer, Colossus engineer). **Zero overlap with Session 1's Buddha/Murdoch/Google questions** → the Study Temple does NOT replay graded cards; it draws fresh questions from the full pool every session
- **Q1 answered correctly:** "{1984}" — **see HIGH bug below**
- **Q2 answered correctly:** "House of Cards" — correct per the 2013 Netflix binge-pioneer question
- **Q3 answered correctly:** "Tommy Flowers" (not Turing — the question's "designed Colossus" and "classified until 1970s" hints point to Flowers, the Post Office engineer who built it; an excellent distractor-trap question that rewards actual knowledge)
- **Final result:** `"3 of 3 cards mastered up! Perfect score!"` — graduation-cap emoji (`🎓`) on completion screen. Nice juice differentiation from partial-score session.

## SM-2 Scheduling Verdict: **BLOCKED — DESIGN MISMATCH**

**The Study Temple does not implement SM-2 / FSRS scheduling in its UI flow.** The expected test ("again" cards reappear after 1 min, "good" cards don't reappear within 2 hours, "easy" never reappears) cannot be run because:

1. The UI renders a 3-question **multiple-choice quiz** (`StudyQuizOverlay.svelte`), not an Anki-style "show answer → grade yourself" flow
2. No grade buttons exist — the component auto-advances 1200 ms after you click the correct/wrong answer
3. There is no "card reappearance" mechanic — each session draws fresh questions via `generateStudyQuestions()` → `selectNonCombatStudyQuestion()` from the full run fact pool, with no "due date" lookup
4. `fastForward(2)` had zero observable effect on pool size or question selection. The function exists and returns ok, but the study flow does not consult any FSRS `nextReviewAt` field

**Caveat:** FSRS data structures DO exist in the codebase (`src/services/fsrs*` and `getLeechInfo` reads from them). Combat gameplay DOES update FSRS review states via correct/wrong charges. But the **Study Temple rest-room flow does not gate questions on FSRS scheduling** — it just draws from the run pool with `canMasteryUpgrade` priority.

This might be intentional (the rest-room study is a mastery-upgrade prompt, not a spaced repetition drill) or might be a missing feature. Either way, the SM-2 verification in this tester's task spec does not map to the current UI. Recommend updating the `.claude/skills/llm-playtest/` profile for study temple to match reality or to actually test FSRS via the `getStudyCard.interval/reps` fields which are typed in `action-specs.md` line 207 but never populated in any of my captures.

## Content Quality Sample (all 6 questions observed)

| # | Question | Correct Answer | Distractors | Quality Notes |
|---|---|---|---|---|
| S1-Q1 | According to modern scholarly consensus (the 'long chronology'), approximately when did the historical Buddha die? | 483 BCE | 563 BCE, c. 405 BCE, 480 BCE | **Strong** — the 'long chronology' framing rewards reading comprehension. 563 BCE is a sharp distractor because it's the long-chronology *birth* year of the Buddha. 480 BCE is plausible (near-neighbor). Rating 5/5. |
| S1-Q2 | Who wrote *The Sovereignty of Good* (1970), arguing that 'Good' is a transcendent Platonic reality and that moral virtue consists in 'unselfing' — the removal of the self-centered ego that distorts our vision of others? | Iris Murdoch | Philippa Foot, G.E.M. Anscombe, Christine Korsgaard | **Excellent** — all four distractors are real 20th-century ethicists working in adjacent traditions (Foot/Anscombe from Oxford virtue ethics, Korsgaard from Kantian constructivism). Forces actual knowledge of Murdoch specifically. Rating 5/5. |
| S1-Q3 | Which two Stanford PhD students incorporated Google on September 4, 1998, introducing the PageRank algorithm? | Larry Page and Sergey Brin | Bill Gates and Paul Allen, Steve Jobs and Steve Wozniak, Jerry Yang and David Filo | **Good** — Jerry Yang/David Filo (Yahoo) is a sharp distractor because both pairs are Stanford-era tech founders. Gates/Allen and Jobs/Wozniak are weaker distractors; an 8-year-old could eliminate them. Rating 4/5. |
| S2-Q1 | In what year did the Transformers franchise debut with its toy line and animated series? | **{1984}** (raw template literal in UI!) | 1980, 1982, 1978 | **BROKEN RENDER** — the correct answer literally displays as `{1984}` with curly braces, because `StudyQuizOverlay.svelte` does not call `displayAnswer()` to strip the `{N}` bracket-notation marker. This also makes the correct answer visually identifiable before reading the question. Rating: **HIGH bug**, question itself is 3/5. |
| S2-Q2 | Which 2013 Netflix original series pioneered the binge-watching model by dropping an entire season at once? | House of Cards | Orange Is the New Black, The Crown, Stranger Things | **Good** — all four are real Netflix originals, forcing actual knowledge. OITNB is a particularly sharp distractor (it launched in 2013 too). Rating 5/5. |
| S2-Q3 | Which British engineer designed the Colossus — the world's first programmable electronic digital computer, built to break Nazi Germany's Lorenz cipher — that remained classified until the 1970s? | Tommy Flowers | John von Neumann, J. Presper Eckert, Alan Turing | **Excellent** — Alan Turing is the obvious trap answer (most players will default to him because of Bletchley Park fame). Flowers is the historically-correct but widely-unknown answer. This is exactly the kind of question that rewards real learning. Rating 5/5. |

**Overall content quality of the 6 sampled questions: 4.6/5.** The general_knowledge domain has excellent curated decks with sharp distractors. The one rendering bug on Q1-S2 is a wiring issue, not a content issue — the underlying fact data is correct.

## Objective Findings

| Check | Result | Notes |
|---|---|---|
| O-ST1 Session starts | PASS | startStudy path works when you manually navigate `restRoom` first + click the DOM button. The `__rrPlay.startStudy()` wrapper itself is broken (see HIGH bug). Game flow worked both sessions. |
| O-ST2 Card data complete | PASS | Every one of 6 questions had non-empty question + 4 answer choices + correct answer. No nulls, no undefined, no NaN. |
| O-ST3 Grade accepts all types | **N/A** | There are no rating buttons. The UI uses multiple-choice answer click, not Anki grading. The test spec's `again/hard/good/easy` buttons do not exist in the current Study Temple UI. |
| O-ST4 Session ends cleanly | PASS | Completion screen renders, Continue button works, routes to card upgrade picker (via `pendingStudyUpgrade` store) or back to `dungeonMap`. Empty-state softlock guard present (`study-empty-state` testid) when `questions=[]`. |
| O-ST5 SM-2 reschedule "again" | **BLOCKED** | See SM-2 Scheduling Verdict above. The feature as specified does not exist in the current UI. |
| O-ST6 SM-2 reschedule "good" | **BLOCKED** | Same as above. |
| O-ST7 No data artifacts | **FAIL** | `{1984}` leaked in Session 2 Q1 correct-answer display (HIGH bug). Questions and distractors otherwise clean. |

## Subjective Assessments (1–5)

| Check | Rating | Notes |
|---|---|---|
| S-ST1 Q-A pairing quality | **5/5** | Every one of the 6 questions had a correct, factual, unambiguous answer. Distractors were semantically coherent (same category) and required real knowledge to eliminate. Especially strong: Iris Murdoch philosophy distractors (Foot/Anscombe/Korsgaard are all plausible), Tommy Flowers (trap-the-Turing-guesser). |
| S-ST2 Study session pacing | **4/5** | 3 questions is fast (~20 s total including 1.2 s auto-advance). Feels like a quick knowledge check between encounters, which is probably right for a rest-room mini-activity — not a long drill session. Would rate higher but the 1.2 s auto-advance gives no time to read the explanation, which is arguably the most valuable moment of the quiz (you just learned something, and you want to linger on why you were right/wrong). No visible explanation text was shown between answer-click and auto-advance, which is a missed teaching moment. |
| S-ST3 Grade button clarity | **N/A** | No grade buttons. The auto-advance-on-answer-click is simple and clear, arguably clearer than an Anki-style "did I really know that?" self-grading interface for a casual roguelite. |
| S-ST4 Learning value | **4/5** | Playing through 6 questions, I actually absorbed facts I would not have guessed (Flowers > Turing for Colossus; Iris Murdoch + "unselfing"; Google's Sept 4 1998 incorporation date). This is the goal of the game. Would rate 5 if explanation text (the fact's `explanation` field) appeared on answer-click instead of auto-advancing silently — that's where the real learning moment lives. |

## Issues Found

### CRITICAL
*None.*

### HIGH

1. **`StudyQuizOverlay.svelte` does not call `displayAnswer()` — `{N}` template literals leak to UI.**
   - **File:** `src/ui/components/StudyQuizOverlay.svelte`
   - **Evidence:** Session 2 Q1 showed answer button `{1984}` for the correct Transformers debut year (visible in `/tmp/rr-docker-visual/llm-playtest-BATCH-2026-04-12-001_none_1775924022920/screenshot.png`). Grep of source deck `data/decks/anime_manga.json` line 4473 confirms `"correctAnswer": "{1984}"` is stored in bracket-notation format, and the `displayAnswer()` helper at `src/services/numericalDistractorService.ts:64-66` exists specifically to strip these braces:
     ```ts
     export function displayAnswer(answer: string): string {
       return answer.replace(/\{(\d[\d,]*\.?\d*)\}/, '$1')
     }
     ```
     but `StudyQuizOverlay.svelte` never imports or calls it. Grep confirms: `CardCombatOverlay.svelte`, `CardExpanded.svelte`, `ShopRoomOverlay.svelte`, and `ChallengeQuizOverlay.svelte` all use `displayAnswer`. Study is the only consumer missing.
   - **Player impact:** The correct answer is literally identifiable by its curly braces before reading the question. Player sees `[1980, 1982, {1984}, 1978]` and picks the weird one without any learning. This torpedoes the learning value of any bracket-notation fact in the study flow.
   - **Breadth of leak:** grep of `data/decks/*.json` found 12 files containing `{N}`-style correctAnswers. Every knowledge deck that uses numeric-answer facts (years, counts, percentages) is affected when those facts are drawn into a study session.
   - **Fix:** Import `displayAnswer` from `../../services/numericalDistractorService` in `StudyQuizOverlay.svelte` and wrap every rendered answer button label with it (same pattern as `CardCombatOverlay.svelte`).

2. **`__rrPlay.startStudy()` navigates to wrong screen before DOM click.**
   - **File:** `src/dev/playtestAPI.ts:909-946`
   - **Evidence:** Line 926 writes `rr:currentScreen = 'restStudy'` (comment on line 925 wrongly says "RestRoomOverlay will mount"). Then line 932 looks for `[data-testid="rest-study"]`, which is rendered ONLY by `RestRoomOverlay.svelte` (mounted on screen `restRoom`, not `restStudy`). By the time the DOM query runs, `RestRoomOverlay` has already unmounted and `StudyQuizOverlay` is rendering an empty-state "No Cards to Review" screen. My 7 distinct failed attempts to call `startStudy()` in this session all produced `{ok: false, message: "Study button [data-testid='rest-study'] not found"}` on the first call, even with a non-zero `getStudyPoolSize`.
   - **Workaround used:** `writeStore('rr:currentScreen','restRoom')` + direct `document.querySelector('[data-testid="rest-study"]').click()`. This works and triggered the real `handleRestStudy()` path in `CardApp.svelte`, which called `generateStudyQuestions()` and populated the overlay correctly.
   - **Root cause:** The screen-store write on line 926 should target `'restRoom'`, not `'restStudy'`. The RestRoomOverlay's onclick handler will navigate to `'restStudy'` after the click, via `handleRestStudy()` in `CardApp.svelte:914-918`, which is the correct flow that also populates `studyQuestions = generateStudyQuestions()`.
   - **Player impact:** None — this is a dev/playtest API bug, not player-facing. But it silently breaks every automated tester that uses `startStudy`. Every future LLM playtest that follows the documented action-specs.md line 204-208 hits this.
   - **Fix:** Change `playtestAPI.ts:926` from `writeStore('rr:currentScreen', 'restStudy')` to `writeStore('rr:currentScreen', 'restRoom')`. Then the existing button click at line 934 will trigger `handleRestStudy()` which does the real navigation + question-generation sequence.

3. **`__rrScenario.spawn({screen:'restStudy'})` with no deckId destroys the run's study pool and lands in a soft-lock empty state.**
   - **File:** `src/dev/scenarioSimulator.ts:1363-1396` + `playtestAPI.ts` `startStudy()`
   - **Evidence:** In my Session 0 probe, spawning into `restStudy` via `__rrScenario.spawn({screen:'restStudy'})` without a `deckId` arg caused `getStudyPoolSize` to drop from 12 (the warm container's pre-spawn state) to 0 within 2 seconds. The spawn calls `bootstrapRun(config)` which tears down the previous active run and creates a fresh L0 general_knowledge run BEFORE any encounter builds `activeRunPool` — so `getActiveDeckCards()` returns `[]` and `getRunPoolCards()` returns `[]`, producing pool size 0. The resulting UI shows "No Cards to Review — Start a run and visit a rest room to unlock study mode" with a Return-to-Hub button (the softlock guard fires correctly — `src/ui/components/StudyQuizOverlay.svelte:23-29` `handleBack()` + UI-layout rules' softlock-prevention).
   - **Player impact:** None (players don't call spawn). Tester impact: any test using the documented `__rrScenario.spawn({screen:'restStudy'})` entry will get an empty-pool state instead of a runnable study session. The workaround is to spawn `{screen:'combat'}` first (which does build `activeRunPool`) and then write-store to `restRoom`.
   - **Fix:** In `scenarioSimulator.ts:1363-1396` after `bootstrapRun`, CALL `startEncounterForRoom()` or an equivalent pool-building function BEFORE `generateStudyQuestions()`, so that the pool exists when the study generator runs. Alternatively document the limitation and add a scenario preset like `'study-from-fresh-run'` that does combat → rest in one spawn.

### MEDIUM

4. **Study Temple UI does not expose FSRS grading / spaced repetition.**
   - **File:** `src/ui/components/StudyQuizOverlay.svelte`
   - **Evidence:** The overlay renders a 3-question multiple-choice quiz with no `.rating-btn--again/hard/good/easy` classes, no interval display, no card-reappearance mechanic. `fastForward(2)` had zero effect on Session 2's question selection — questions were drawn fresh from the run pool. The `.claude/skills/llm-playtest/` tester prompt, `action-specs.md` line 204-208, and `gradeCard` / `getLeechInfo` API docs all imply an SM-2 grading UI that does not exist.
   - **Reasonable design:** The rest-room study might be INTENTIONALLY not SM-2-gated (it's a mastery-upgrade micro-quiz, not a spaced repetition drill). If so, that's fine — the docs/tester-prompt just need to reflect it.
   - **Fix (docs/spec):** Either (a) update `.claude/skills/llm-playtest/references/profiles.md` + `action-specs.md` to describe the current 3-question MCQ flow and remove SM-2 claims, or (b) actually implement Anki-style grading in `StudyQuizOverlay.svelte` and plumb to the FSRS service. Recommendation: (a) first, because (b) is a significant feature decision, not a bug fix.

5. **Study completion screen auto-advances without showing explanation text.**
   - **File:** `src/ui/components/StudyQuizOverlay.svelte:115-134`
   - **Evidence:** `selectAnswer()` applies a 1200 ms `setTimeout` and then advances to the next question. No explanation from the fact's `explanation` field is rendered in that window. The content pipeline produces rich explanations (e.g., Buddha's "long chronology" framing, Tommy Flowers' classification story) that never reach the player during the study session.
   - **Player impact:** The moment immediately after answering a quiz question — when curiosity is highest — is the best teaching moment in any knowledge game. Currently wasted.
   - **Fix:** Show the `fact.explanation` inline for 2-3 s between answer-click and auto-advance. Add a "tap to continue" button so veteran players can skip. This lines up with the Player-Experience Lens "Veteran skip path" rule.

6. **`getSessionSummary` return shape does not match `action-specs.md` docs.**
   - **File:** `src/dev/playtestAPI.ts` + `.claude/skills/llm-playtest/references/action-specs.md:139`
   - **Evidence:** `getSessionSummary()` returned `{eventCount: 67, typeCounts: {state-change: 3, fps: 64}, durationMs: 4116299, durationMin: 68.6, firstEvent: "state-change", lastEvent: "fps"}` — diagnostic ring-buffer stats only. `action-specs.md` line 139 documents it as "Aggregate session stats (accuracy, encounters, damage dealt)". No accuracy, no encounters, no damage in the actual return value.
   - **Fix:** Update `action-specs.md` to match reality, OR extend `getSessionSummary` to compute and return the documented fields from the session event log.

### LOW

7. **`getStudyCard()` returns null even during an active session.**
   - **File:** `src/dev/playtestAPI.ts:949-958` + `src/dev/playtestDescriber.ts` `getStudyCardText`
   - **Evidence:** After clicking the rest-study button and landing in a live `StudyQuizOverlay`, `getStudyCard()` returned null both times (Session 1 and Session 2). The underlying `getStudyCardText` expects certain DOM structure that doesn't match the current overlay's markup. The overlay renders via `.study-card`, `.question-text`, `.answer-btn`, but `playtestDescriber` evidently queries for different selectors.
   - **Player impact:** None. Tester impact: testers can't introspect the current question via the API; they must fall back to raw DOM eval. All of my Session 1 and Session 2 question captures came from `document.querySelector('.study-card')?.textContent`, not from `getStudyCard`.
   - **Fix:** Audit `getStudyCardText` selectors against the current `StudyQuizOverlay.svelte` DOM and add `data-testid` attributes to the key elements (question, answer buttons, completion screen) so tester APIs are stable.

## All Studied Cards (Raw)

```json
{
  "session1": {
    "completionState": "2 of 3 cards mastered up",
    "emoji": "📖",
    "questions": [
      {
        "qIndex": 1,
        "question": "According to modern scholarly consensus (the 'long chronology'), approximately when did the historical Buddha die?",
        "options": ["563 BCE", "c. 405 BCE", "483 BCE", "480 BCE"],
        "myAnswer": "563 BCE",
        "assumedCorrect": "483 BCE",
        "resultInferred": "wrong (session reports 2 of 3 mastered, Q2+Q3 correct => Q1 wrong)"
      },
      {
        "qIndex": 2,
        "question": "Who wrote The Sovereignty of Good (1970), arguing that 'Good' is a transcendent Platonic reality and that moral virtue consists in 'unselfing' — the removal of the self-centered ego that distorts our vision of others?",
        "options": ["Philippa Foot", "G.E.M. Anscombe", "Christine Korsgaard", "Iris Murdoch"],
        "myAnswer": "Iris Murdoch",
        "assumedCorrect": "Iris Murdoch",
        "resultInferred": "correct"
      },
      {
        "qIndex": 3,
        "question": "Which two Stanford PhD students incorporated Google on September 4, 1998, introducing the PageRank algorithm?",
        "options": ["Bill Gates and Paul Allen", "Steve Jobs and Steve Wozniak", "Larry Page and Sergey Brin", "Jerry Yang and David Filo"],
        "myAnswer": "Larry Page and Sergey Brin",
        "assumedCorrect": "Larry Page and Sergey Brin",
        "resultInferred": "correct"
      }
    ]
  },
  "timeAdvance": {
    "hours": 2,
    "fastForwardResult": {"ok": true, "message": "Fast-forwarded 2 hours"},
    "studyPoolSizeBefore": 10,
    "studyPoolSizeAfter": 10,
    "effectOnQuestionSelection": "none — session 2 drew 3 brand new questions unrelated to session 1"
  },
  "session2": {
    "completionState": "3 of 3 cards mastered up — Perfect score!",
    "emoji": "🎓",
    "questions": [
      {
        "qIndex": 1,
        "question": "In what year did the Transformers franchise debut with its toy line and animated series?",
        "options": ["1980", "1982", "{1984}", "1978"],
        "myAnswer": "{1984}",
        "assumedCorrect": "{1984}",
        "bug": "HIGH — correct answer rendered as literal '{1984}' template literal, not '1984'. StudyQuizOverlay.svelte does not call displayAnswer() to strip bracket-notation.",
        "resultInferred": "correct (session reports 3/3)"
      },
      {
        "qIndex": 2,
        "question": "Which 2013 Netflix original series pioneered the binge-watching model by dropping an entire season at once?",
        "options": ["House of Cards", "Orange Is the New Black", "The Crown", "Stranger Things"],
        "myAnswer": "House of Cards",
        "assumedCorrect": "House of Cards",
        "resultInferred": "correct"
      },
      {
        "qIndex": 3,
        "question": "Which British engineer designed the Colossus — the world's first programmable electronic digital computer, built to break Nazi Germany's Lorenz cipher — that remained classified until the 1970s?",
        "options": ["John von Neumann", "J. Presper Eckert", "Alan Turing", "Tommy Flowers"],
        "myAnswer": "Tommy Flowers",
        "assumedCorrect": "Tommy Flowers",
        "resultInferred": "correct"
      }
    ]
  },
  "diagnostics": {
    "getLeechInfo": {"suspended": [], "nearLeech": [], "totalLeeches": 0},
    "getSessionSummary": {
      "eventCount": 67,
      "typeCounts": {"state-change": 3, "fps": 64},
      "durationMs": 4116299,
      "durationMin": 68.6,
      "firstEvent": "state-change",
      "lastEvent": "fps"
    }
  },
  "methodology": {
    "containerBoot": "warm (pre-existing llm-playtest-BATCH-2026-04-12-001)",
    "spawnUsed": "combat with page_flutter + general_knowledge to seed run pool",
    "studyEntryPath": "writeStore('rr:currentScreen', 'restRoom') → document.querySelector('[data-testid=\"rest-study\"]').click() — the __rrPlay.startStudy() wrapper is broken, see HIGH bug #2",
    "answerClickPath": "document.querySelectorAll('.answer-btn')[index].click()",
    "autoAdvanceDelayMs": 1200
  }
}
```

## Evidence Artifacts

All screenshots and layout dumps live under `/tmp/rr-docker-visual/`:

- Session 1 Q1 live: `llm-playtest-BATCH-2026-04-12-001_none_1775923853041/screenshot.png` — Buddha question with clean "563 BCE" / "483 BCE" options (no brace leak)
- Session 1 completion: `llm-playtest-BATCH-2026-04-12-001_none_1775923933152/screenshot.png` — "Study Complete! 2 of 3 cards mastered up!" with book emoji
- Session 2 Q1 live: `llm-playtest-BATCH-2026-04-12-001_none_1775924022920/screenshot.png` — **shows the `{1984}` render bug visibly**, the HIGH evidence
- Session 2 completion: `llm-playtest-BATCH-2026-04-12-001_none_1775924093079/screenshot.png` — "Perfect score! 3 of 3" with graduation cap

## Bottom Line

**ISSUES verdict.** The Study Temple core flow (enter → 3 MCQs → completion → upgrade picker) works cleanly and produces high-quality learning content. Content quality is excellent (4.6/5 average across 6 questions). Three real bugs surfaced: the `{1984}` render leak (HIGH, directly player-visible), the broken `__rrPlay.startStudy()` API (HIGH, blocks automation), and the spec/UI mismatch on SM-2 grading (MEDIUM, docs + tester-prompt drift). None of the three are critical — the game is playable and the studying is satisfying — but all three should be fixed in short order.

The two real study sessions successfully completed end-to-end with the manual workaround path. SM-2 verification was blocked by the design-mismatch, not by a test failure — the UI doesn't support the test as specified.
