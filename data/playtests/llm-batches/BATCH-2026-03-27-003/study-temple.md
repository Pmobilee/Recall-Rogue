# Study Temple Report — BATCH-2026-03-27-003
**Tester**: Study Temple | **Model**: claude-sonnet-4-6 | **Domain**: general_knowledge (multi-domain)
**Date**: 2026-03-27

## Verdict: ISSUES

The study quiz UI works correctly and renders well. However, the `__terraPlay` study API (`startStudy`, `getStudyCard`, `gradeCard`, `endStudy`) is broken — it navigates to a non-existent screen (`'study'`) that renders nothing. Additionally, the `restStudy` quiz does NOT update SM-2 `reviewStates` — it only upgrades cards via the mastery system. True SM-2 scheduling only happens during combat encounters. These are architectural findings, not bugs per se, but the test protocol's assumptions about SM-2 study mechanics do not match the actual implementation.

---

## Architecture Discovery (Critical Context)

The game has **two distinct study systems** — the test protocol assumes a unified SM-2 loop, but the reality is:

| System | Screen | Trigger | Mechanic |
|--------|--------|---------|----------|
| **StudyTempleScreen** | `studyTemple` | Hub "Library" nav | Deck browser → launches dungeon runs. No SM-2. |
| **restStudy Quiz** | `restStudy` | Rest room in dungeon | Multiple-choice, 3 questions. Correct answers → card mastery upgrades. No SM-2 intervals. |
| **Combat Quiz** | `combat` | Card activation in battle | `updateReviewStateByButton()` called → writes SM-2 `reviewStates`. This is the REAL SM-2 loop. |
| **`__terraPlay.startStudy()`** | `study` | API call | **Broken** — navigates to `'study'` which is not a rendered screen. Always returns 0 cards. |

---

## Session 1 — restStudy Quiz (10 questions, manually injected)

Since `startStudy(10)` is broken, questions were manually sourced from the factsDB (4,919 valid facts) and injected via `Symbol.for('terra:scenarioStudyQuestions')` bridge. 10 questions spanning all 10 domains were run through the `restStudy` overlay.

- Cards studied: 10
- Answered correctly: 4 (Suez Canal, Erlang Shen/Qin dynasty, James Watt condenser, Chancre)
- Answered incorrectly: 6 (Bactrian camel, Yuan dynasty, AT&T, Rigel/Betelgeuse, Maillard reaction, El Greco/Crete)
- Cards "mastered up": 4 (shown in completion screen: "4 of 10 cards mastered up!")
- Near-leech cards: 0
- Suspended cards: 0

**Completion screen rendered correctly** — "📖 Study Complete! 4 of 10 cards mastered up." with card list and Continue button.

### Session Summary
- `getSessionSummary()` returns event log stats (14 events, 12 errors from background Phaser issues), not study-specific stats. **Not useful for study session tracking.**
- `getLeechInfo()` returns `{ suspended: [], nearLeech: [], totalLeeches: 0 }` — reflects only the 5 seeded cult-001..005 facts, none of which were quizzed.
- `studySessionsCompleted` counter: 0 (not incremented by restStudy quiz)
- `newCardsStudiedToday` counter: 0 (not incremented)

---

## Session 2 — SM-2 Scheduling Verification

**SM-2 interval scheduling was not testable via the study quiz path.** The `reviewStates` store was not modified at any point during or after the `restStudy` session. Before and after the quiz, `reviewStates` contained only the 5 original seeded facts (cult-001 to cult-005), all with `state: "new"`, `reps: 0`, `interval: 0`, and `due: 1774543853991` (overdue by ~22 hours).

`fastForward(2)` was called earlier in the session but has no observable effect because the restStudy quiz path does not write to `reviewStates`.

**SM-2 scheduling IS wired up** — but only via `encounterBridge.ts` → `updateReviewStateByButton()` during combat quiz answers. The `restStudy` path bypasses the SM-2 scheduler entirely.

| SM-2 Check | Result |
|---|---|
| "Again" cards reappear after 2h | N/A — restStudy does not use SM-2 intervals |
| "Good" cards stay away | N/A — restStudy does not schedule cards |
| reviewStates updated after session | FAIL — no updates written |

---

## Content Quality Sample

All 10 questions drawn from live DB (4,919 facts with valid quiz data out of 6,594 trivia facts total).

| # | Question (truncated) | Correct Answer | Domain | Quality Notes |
|---|---|---|---|---|
| 1 | Which animal made the ancient Silk Road trade route possible across inner Asia? | Bactrian camel | animals_wildlife | Clear, factual, 4 plausible distractors (Yak, Dromedary camel, Mongolian horse). Excellent. |
| 2 | Which was the first non-Han dynasty to rule all of China? | Yuan dynasty | history | Good. Distractors (Liao, Jin, Qing) are all plausible Chinese dynasties. |
| 3 | Which canal connects the Red Sea to the Mediterranean Sea? | Suez Canal | geography | Straightforward. Distractors (Corinth, Panama, Kiel) are all real canals — good quality. |
| 4 | Which major company did Alexander Graham Bell co-found in 1885? | AT&T | natural_sciences | Factual and specific. Western Union, RCA, GE are plausible distractors. |
| 5 | From which dynasty's hydraulic engineer Li Bing does Erlang Shen most likely originate? | Qin dynasty | mythology_folklore | Niche but well-formed. Distractors are appropriate dynasty options. |
| 6 | What do Orion's two brightest stars, Rigel and Betelgeuse, have in common? | Both are supergiants | space_astronomy | Good astronomy fact. "Both will become black holes" is a plausible trap. |
| 7 | What key component did James Watt add to dramatically improve steam engine efficiency? | Separate condenser | general_knowledge | Clear engineering question. "Pressure valve", "Piston rod", "Flywheel governor" are all real but wrong. |
| 8 | What is the name of the painless ulcer that marks the primary stage of syphilis? | Chancre | human_body_health | Medical terminology question. Well-formed; distractors (Pustule, Gumma, Fistula) are anatomically coherent. |
| 9 | What two chemical processes give roasted food its characteristic browning? | Caramelization and Maillard reaction | food_cuisine | Multi-part answer — slightly complex phrasing. Distractors are scientifically plausible. |
| 10 | Where was Mannerist painter El Greco actually born? | Crete | art_architecture | Good "surprising fact" question. Portugal, Spain, Italy are all plausible traps. |

---

## Objective Findings

| Check | Result | Notes |
|---|---|---|
| O-ST1: `startStudy(10)` returns `{ok:true}` with cardCount > 0 | **FAIL** | Returns `{ok:true, message:"Study screen opened (size 10)"}` but cardCount absent. Navigates to non-existent `'study'` screen. DOM renders nothing. |
| O-ST2: Every `getStudyCard()` has non-null question AND answer | **FAIL** | Always returns `null` — screen has no `[data-testid="study-card-question"]` element. |
| O-ST3: Grade accepts all types | **FAIL** | `.rating-btn--again/hard/good/easy` elements do not exist in restStudy quiz. Different UI paradigm (multiple-choice, not rating buttons). |
| O-ST4: `endStudy()` returns `{ok:true}` | **PASS** | Returns `{ok:true, message:"Study ended. Screen: base"}`. Works via fallback to `writeStore('terra:currentScreen', 'base')`. |
| O-ST5: SM-2 "again" cards return after fastForward(2) | **FAIL** | `reviewStates` not updated by restStudy quiz. No cards scheduled to reappear. |
| O-ST6: SM-2 "good" cards don't return | **N/A** | Cannot test — no SM-2 scheduling occurs in restStudy path. |
| O-ST7: No data artifacts | **PASS** | All 10 questions had clean text, no `undefined`/`null`/`NaN`/`[object` strings. |

---

## Subjective Assessments

| Check | Rating | Notes |
|---|---|---|
| S-ST1: Question-answer pairing quality | 4/5 | 9 of 10 questions are clear and well-matched. Q9 (food/browning) has a multi-part answer that may feel verbose. |
| S-ST2: Study session pacing | 4/5 | 1200ms auto-advance after selecting an answer feels slightly slow but gives time to read feedback. No drag. |
| S-ST3: Grade button clarity | 3/5 | The "Study Complete" screen summarizes which cards were upgraded (shows question previews). Good feedback. However there's no per-question breakdown of right/wrong shown at the end — only the "mastered up" cards. |
| S-ST4: Learning value | 4/5 | Questions are genuinely educational and surprising. The "mastery upgrade" mechanic gives a clear gameplay reward for correct answers. The connection between studying and card power is intuitive. |

---

## Issues Found

### HIGH — `__terraPlay` Study API is Broken (startStudy / getStudyCard / gradeCard)

**File**: `src/dev/playtestAPI.ts`, lines 694–755

`startStudy()` navigates to `'study'` (line 696: `writeStore('terra:currentScreen', 'study')`), but no Svelte component in `CardApp.svelte` renders at `$currentScreen === 'study'`. The valid screen name is `'restStudy'` (for in-dungeon quiz) or `'studyTemple'` (for the deck library). Result: blank screen, no buttons, `getStudyCard()` always returns null.

**Impact**: The entire `startStudy` / `getStudyCard` / `gradeCard` API is non-functional for LLM playtesting. Study sessions cannot be automated via `__terraPlay`.

**Fix**: Change line 696 from `writeStore('terra:currentScreen', 'study')` to `writeStore('terra:currentScreen', 'restStudy')` and ensure study questions are pre-generated and injected before navigation.

### HIGH — SM-2 Scheduler Not Connected to restStudy Quiz

**Files**: `src/ui/components/StudyQuizOverlay.svelte`, `src/services/gameFlowController.ts` (onStudyComplete)

`onStudyComplete()` calls `masteryUpgrade(card)` for correct answers but never calls `updateReviewStateByButton()` or any SM-2 scheduling function. The `reviewStates` store is not updated. This means:
- Cards answered correctly in rest-room study are NOT removed from future review queues
- Cards answered incorrectly are NOT rescheduled for sooner review
- `fastForward()` has no effect on study quiz reappearance
- `studySessionsCompleted` and `newCardsStudiedToday` counters are not incremented

**Note**: SM-2 IS connected in `encounterBridge.ts` for combat — only restStudy is missing the hook.

### MEDIUM — `getSessionSummary()` Returns Irrelevant Data for Study Context

`getSessionSummary()` returns the `__terraLog` event ring buffer stats (event types, duration), not study-specific metrics like correct/incorrect counts, domains studied, or intervals scheduled. For study playtest automation, this is unhelpful.

### LOW — `startStudy(size)` Size Buttons Don't Exist in restStudy

`startStudy(10)` looks for `[data-testid="study-size-10"]` and `[data-testid="btn-start-study"]` DOM elements that do not exist in the restStudy overlay. The session size is determined by how many questions are injected, not by a UI selector.

### LOW — Screenshot Helper Fails on restStudy (oklab Color)

`__terraScreenshotFile()` captures the Phaser canvas correctly but the html2canvas DOM overlay fails with: `"Attempting to parse an unsupported color function 'oklab'"`. This causes screenshots to show only the Phaser starfield background, not the Svelte overlay containing the quiz card. The quiz UI is only visible in Playwright snapshots, not screenshots.

---

## SM-2 Scheduling Verdict

**The SM-2 scheduler exists but is only active during combat.** The `reviewStates` data structure is correctly designed (FSRS-style fields: `state`, `interval`, `reps`, `due`, `easeFactor`, `lapseCount`, `isLeech`, etc.) and is written during combat via `updateReviewStateByButton()`. However, the `restStudy` rest-room quiz path does NOT feed into SM-2 — it only upgrades card mastery tiers.

The test protocol's assumption that study sessions schedule cards for future review (SM-2 "again" → short interval, "good" → longer interval) does not apply to the current restStudy implementation. If SM-2 were wired to restStudy, the scheduling would need to be tested differently — by checking `reviewStates[factId].due` values before and after the session and verifying they changed appropriately.

---

## All Studied Cards (Raw)

```json
[
  {
    "index": 1,
    "factId": "animals-bactrian-camel-silk-road",
    "question": "Which animal made the ancient Silk Road trade route possible across inner Asia?",
    "answers": ["Yak", "Dromedary camel", "Mongolian horse", "Bactrian camel"],
    "clickedAnswer": "Yak",
    "correctAnswer": "Bactrian camel",
    "wasCorrect": false,
    "domain": "animals_wildlife"
  },
  {
    "index": 2,
    "factId": "history-yuan-dynasty-first-non-han",
    "question": "Which was the first non-Han dynasty to rule all of China?",
    "answers": ["Liao dynasty", "Jin dynasty", "Qing dynasty", "Yuan dynasty"],
    "clickedAnswer": "Liao dynasty",
    "correctAnswer": "Yuan dynasty",
    "wasCorrect": false,
    "domain": "history"
  },
  {
    "index": 3,
    "factId": "geography-red-sea-suez-canal",
    "question": "Which canal connects the Red Sea to the Mediterranean Sea?",
    "answers": ["Suez Canal", "Corinth Canal", "Panama Canal", "Kiel Canal"],
    "clickedAnswer": "Suez Canal",
    "correctAnswer": "Suez Canal",
    "wasCorrect": true,
    "domain": "geography"
  },
  {
    "index": 4,
    "factId": "natural_sciences-bell-co-founded-att",
    "question": "Which major company did Alexander Graham Bell co-found in 1885?",
    "answers": ["Western Union", "AT&T", "RCA", "General Electric"],
    "clickedAnswer": "Western Union",
    "correctAnswer": "AT&T",
    "wasCorrect": false,
    "domain": "natural_sciences"
  },
  {
    "index": 5,
    "factId": "mythology_folklore-erlang-shen-li-bing-origin",
    "question": "From which dynasty's hydraulic engineer Li Bing does Erlang Shen most likely originate?",
    "answers": ["Qin dynasty", "Han dynasty", "Ming dynasty", "Tang dynasty"],
    "clickedAnswer": "Qin dynasty",
    "correctAnswer": "Qin dynasty",
    "wasCorrect": true,
    "domain": "mythology_folklore"
  },
  {
    "index": 6,
    "factId": "space_astronomy-orion-supergiants-rigel-betelgeuse",
    "question": "What do Orion's two brightest stars, Rigel and Betelgeuse, have in common?",
    "answers": ["Both are supergiants", "Both are binary stars", "Both will become black holes", "Both are red dwarfs"],
    "clickedAnswer": "Both are binary stars",
    "correctAnswer": "Both are supergiants",
    "wasCorrect": false,
    "domain": "space_astronomy"
  },
  {
    "index": 7,
    "factId": "general_knowledge-james-watt-steam-engine-condenser",
    "question": "What key component did James Watt add to dramatically improve steam engine efficiency?",
    "answers": ["Pressure valve", "Separate condenser", "Piston rod", "Flywheel governor"],
    "clickedAnswer": "Separate condenser",
    "correctAnswer": "Separate condenser",
    "wasCorrect": true,
    "domain": "general_knowledge"
  },
  {
    "index": 8,
    "factId": "human_body_health-syphilis-chancre-painless",
    "question": "What is the name of the painless ulcer that marks the primary stage of syphilis?",
    "answers": ["Pustule", "Chancre", "Gumma", "Fistula"],
    "clickedAnswer": "Chancre",
    "correctAnswer": "Chancre",
    "wasCorrect": true,
    "domain": "human_body_health"
  },
  {
    "index": 9,
    "factId": "food_cuisine-roasting-maillard",
    "question": "What two chemical processes give roasted food its characteristic browning?",
    "answers": ["Oxidation and fermentation", "Osmosis and diffusion", "Caramelization and Maillard reaction", "Hydrolysis and emulsification"],
    "clickedAnswer": "Osmosis and diffusion",
    "correctAnswer": "Caramelization and Maillard reaction",
    "wasCorrect": false,
    "domain": "food_cuisine"
  },
  {
    "index": 10,
    "factId": "art_architecture-mannerism-el-greco-birth",
    "question": "Where was Mannerist painter El Greco actually born?",
    "answers": ["Portugal", "Spain", "Crete", "Italy"],
    "clickedAnswer": "Spain",
    "correctAnswer": "Crete",
    "wasCorrect": false,
    "domain": "art_architecture"
  }
]
```

---

## Additional Notes

- **factsDB state**: 46,824 total facts loaded; 6,594 trivia facts; 4,919 with valid quiz data (question + answer + 2+ distractors). DB is healthy.
- **reviewStates**: Only 5 seeded facts (cult-001 to cult-005) exist at start of a fresh session. All new — never reviewed. This is expected for a new player save.
- **Phaser errors**: Multiple `TypeError: Cannot read properties of undefined (reading 'trigger')` and `null (reading 'blendModes')` from CombatScene in bot/headless mode. These are pre-existing, unrelated to study mechanics.
- **Analytics errors**: `http://localhost:3001/api/analytics/events` returns ERR_CONNECTION_REFUSED (analytics server not running in dev). Expected, not a bug.
- **Screenshot limitation**: html2canvas cannot parse `oklab()` CSS color function, so Svelte overlays are missing from screenshots. Phaser canvas renders correctly. This affects visual verification of study UI only.
