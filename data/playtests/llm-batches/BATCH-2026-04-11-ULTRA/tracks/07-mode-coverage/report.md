# Track 07 — Mode Coverage Report

**Track:** 07-mode-coverage
**Batch:** BATCH-2026-04-11-ULTRA
**Agent:** ui-agent (claude-sonnet-4-6)
**Completed:** 2026-04-11
**Containers used:** BATCH-ULTRA-t7b (chess), BATCH-ULTRA-t7map2 (map-pin), BATCH-ULTRA-t7proc (procedural), BATCH-ULTRA-t7study2 (study), BATCH-ULTRA-t7trivia (trivia)
**Method:** Docker warm containers, `__rrScenario.load()`, `--actions-file` gameplay sequences + post-session source code verification

---

## Overall Verdict: PARTIAL — 3/5 modes loadable, 2/5 broken, 1/5 missing

| Mode | Status | Verdict |
|---|---|---|
| Chess Tactics | Loads, but interactive board NOT rendered (data bug) | BROKEN (high) |
| Map Pin Drop | Loads, but map NOT rendered (missing UI code) | BROKEN (high) |
| Procedural Math | WORKING | PASS |
| Trivia Night | TriviaRoundScreen is orphan — unreachable | MISSING (critical) |
| Study Temple FSRS | WORKING (with curated deck scenarios) | PASS with caveats |

**Modes loadable:** 3/5 (Chess, Map-Pin, Procedural all load — but Chess and Map-Pin use fallback UI)
**Modes genuinely functional end-to-end:** 2/5 (Procedural Math, Study Temple FSRS)
**Modes critically broken/missing:** 2/5 (Trivia Night orphan, interactive boards missing)

---

## Mode 1: Chess Tactics

**Scenario:** `study-deck-chess` (restStudy, deckId: chess_tactics)
**Container:** BATCH-ULTRA-t7b
**Screenshots:** `evidence/screenshots/chess/`

### What works
- Deck loads and generates 3 quiz questions per session
- Question progression works (dot indicators: Q1→Q2→Q3)
- Answer selection works (buttons respond, dots turn green/red)
- Session completion returns to rest room

### What is broken
1. **No interactive chess board rendered.** All chess_tactics facts have `quizResponseMode: 'chess_move'`, `fenPosition`, and `solutionMoves`. `StudyQuizOverlay.svelte` DOES import `ChessBoard.svelte` (line 7) and HAS the chess branch (line 211). The board is not rendered because `getPlayerContext()` in `chessGrader.ts` throws when it tries to apply `solutionMoves[0]` as the setup move against the stored `fenPosition`.

   **Root cause confirmed by code inspection:** `chess_tactics.json` stores `fenPosition` as the puzzle position AFTER the opponent's setup move. `getPlayerContext()` expects the BASE FEN before the setup move and applies `solutionMoves[0]` to produce the puzzle FEN. Example: `chess_tac_4172G` has `fenPosition="1rb3k1/pp1pB1p1/3Pp2p/q1p2n2/2P3Q1/2bB1P2/P1R4P/5KNR b - - 3 20"` with `solutionMoves=["e4g4",...]`. There is no piece at e4 in this FEN. `chess.js` throws, the catch block at `StudyQuizOverlay.svelte` line 77-79 silently sets `chessContext=null`, and the board branch at line 211 (`quizResponseMode === 'chess_move' && chessContext`) is never entered. The quiz falls back to 4-choice text buttons.

   Contrast: `chessPuzzleService.ts` stores `puzzle.fen` as the BASE FEN correctly. The `chess_tactics.json` deck was authored with the wrong FEN convention.

2. **Raw puzzle ID tag leaked to player.** Question text shows `"White to move. [#Goifm]"` — the `[#Goifm]` is an internal puzzle reference ID visible to the player.
3. **No board validation.** Without the board, there's no way to verify the position or understand the context of the move. The chess deck is purely a symbol-memorization quiz in this state, not a tactical puzzle.

**Verdict: BROKEN (high severity) — data bug in chess_tactics.json fenPosition convention**

---

## Mode 2: Map Pin Drop

**Scenario:** Custom `loadCustom({screen: 'restStudy', deckId: 'world_capitals'})` (cold mode, loaded as primary scenario)
**Container:** BATCH-ULTRA-t7map2 (cold mode)
**Screenshots:** `evidence/screenshots/map-pin/`

### What works
- world_capitals deck loads and generates quiz questions
- Question text renders correctly ("What is the capital of Norway?")
- 4-choice text answers are provided and functional
- Session flow completes normally

### What is broken
1. **No map rendered.** world_capitals facts have `quizResponseMode: 'map_pin'` and `mapCoordinates: [lat, lon]`. The data pipeline correctly forwards both fields through `nonCombatQuizSelector` and `generateStudyQuestions`. However, `StudyQuizOverlay.svelte` has NO import of `MapPinDrop.svelte` and NO conditional branch for `'map_pin'` in its template (confirmed by source code inspection). The quiz falls back to standard multiple-choice text answers.

   **Root cause confirmed by code inspection:** `StudyQuizOverlay.svelte` template (lines 210-252) has three branches: chess_move (with chessContext), image_answers, and default text MCQ. There is no `map_pin` case. This is a missing UI code path, not a data forwarding issue. `MapPinDrop.svelte` exists and is functional — wired in `CardExpanded.svelte` and `CardCombatOverlay.svelte` — but never imported into `StudyQuizOverlay.svelte`.

2. **Distance-based partial credit absent.** The map pin mode's core mechanic (drop pin → measure distance → partial damage based on accuracy) is completely bypassed. Every question is binary correct/incorrect.
3. **Geographic learning impaired.** The whole point of world_capitals in a pin-drop format is spatial learning. Text-choice "What is the capital of Norway? → Oslo" is trivially guessable without any geographic knowledge.

**Verdict: BROKEN (high severity) — MapPinDrop not wired into StudyQuizOverlay**

---

## Mode 3: Procedural Math

**Scenario:** Navigation via Study Temple → Math filter → Arithmetic → START PRACTICE
**Container:** BATCH-ULTRA-t7proc
**Screenshots:** `evidence/screenshots/procedural/`

### What works
- Study Temple loads with all 16 math decks visible (Algebra, Arithmetic, Calculus, etc.)
- Clicking a deck shows detail modal with subdeck list and progress bars
- ">> START PRACTICE" button transitions to `ProceduralStudyScreen.svelte`
- Arithmetic questions generate correctly ("5 + 7 = ?", "14 - 3 = ?", "15 + 2 = ?")
- 5 answer choices provided, one correct + 4 plausible distractors
- Score counter tracks correct/total and accuracy % in real time
- Session advances between questions correctly
- All questions tested were valid arithmetic problems

### Minor UX issues
- Accuracy shows "0%" immediately after first wrong answer — could be discouraging (logged as cosmetic issue)
- Score shows `1 | 0% | Stop` which reads as a failure indicator even at start

### What was not tested
- Difficulty tier progression (Tier 1 → 2 → 3 across repeated sessions)
- FSRS scheduling integration for skill state persistence
- 10 questions across 3 difficulty tiers (session resets after ~3-5 questions in rest-site context)

**Verdict: PASS (functional, minor UX concern)**

---

## Mode 4: Trivia Night

**Scenario:** No loadable scenario exists
**Container:** BATCH-ULTRA-t7trivia (attempted via hub navigation)
**Screenshots:** `evidence/screenshots/trivia/`

### Critical finding
`TriviaRoundScreen.svelte` is an **orphan component**:
- File exists at `src/ui/components/TriviaRoundScreen.svelte`
- Never imported into `CardApp.svelte` or any other component
- No scenario preset in `scenarioSimulator.ts`
- No `currentScreen === 'triviaRound'` routing in `CardApp.svelte`

The `trivia_night` multiplayer mode type is defined in `multiplayerTypes.ts` and referenced in `MultiplayerMenu.svelte`/`MultiplayerLobby.svelte`, but:
- These screens require an active P2P multiplayer session
- There is no solo/offline trivia round mode
- The speed-timer trivia experience described in the task brief does not exist as a playable feature

### Code evidence
```
grep -rn "TriviaRoundScreen" src/ → only self-reference in the component file itself
grep -rn "import TriviaRoundScreen" src/ → ZERO results
grep -n "'triviaRound'" src/CardApp.svelte → ZERO results
```

**Verdict: FEATURE MISSING (critical — component exists but is dead code)**

---

## Mode 5: Study Temple Full FSRS Session

**Scenario:** `study-deck-chess` (restStudy with deckId: chess_tactics)
**Container:** BATCH-ULTRA-t7study2
**Screenshots:** `evidence/screenshots/study/`

### What works
- Fresh container successfully generates 3 study questions from chess_tactics deck
- FSRS question selection works: new cards introduced via Anki selector
- Session shows "Question X / 3" progress indicators
- Correct/incorrect tracking: dot turns green (correct) or shows wrong answer highlight
- Session completion screen renders: "Study Complete! 0 of 3 cards mastered up!"
- "Continue" button visible and correctly placed
- FSRS grading states: questions advance after selection (the restStudy flow uses auto-FSRS not manual grading)
- Pool size: 3 questions per rest-site session (hard-coded by `generateStudyQuestions` call)

### FSRS grading detail
The restStudy path auto-grades based on correct/incorrect selection:
- Correct answer → positive FSRS progression
- Wrong answer → difficulty increases, shorter interval

Manual FSRS grading (Again/Hard/Good/Easy buttons like in Anki) appears to be a **mastery-challenge** mode, not restStudy. The restStudy flow uses binary correct/incorrect.

### Issues found
1. `study-quiz` scenario (no deckId) returns empty state in fresh container — requires pre-existing PlayerFactState records (logged as issue #6)
2. The chess deck's `quizResponseMode: 'chess_move'` is ignored here too (same as Mode 1 finding — fenPosition data bug)

### What was not tested
- Leech detection (a card failing >X times in a session)
- Session resumability (leaving mid-session and returning)
- Card quality preview (deck detail modal stats showing progress per card)

**Verdict: PASS (FSRS mechanics work; chess board issue is Mode 1's finding)**

---

## Top 3 Findings

### Finding 1: Chess board doesn't render due to fenPosition data format mismatch (not missing UI code)

`StudyQuizOverlay.svelte` DOES have the chess board wired in (imported at line 7, rendered at line 211). The board fails silently because `chess_tactics.json` stores `fenPosition` as the post-setup-move puzzle position, while `chessGrader.getPlayerContext()` expects the pre-setup-move base FEN. When `chess.js` throws on the invalid move application, the catch block at line 77-79 silently nullifies `chessContext`, preventing the board from rendering. The fix is in the deck data, not the UI code. This affects all 298 chess_tactics facts.

### Finding 2: Map pin is missing from StudyQuizOverlay (unlike chess, the UI code genuinely isn't there)

`StudyQuizOverlay.svelte` has no `map_pin` branch and does not import `MapPinDrop.svelte`. The data pipeline correctly forwards `mapCoordinates` and `quizResponseMode` — the gap is in the component template. `MapPinDrop.svelte` exists and works in the combat quiz flow. Adding a `{:else if quizResponseMode === 'map_pin'}` branch would be the complete fix. This affects all 168 world_capitals facts.

### Finding 3: TriviaRoundScreen.svelte is unreachable dead code

A fully-built Trivia Night component exists but has no integration point anywhere in the routing. It's not imported, not routed, not in any scenario preset. If this mode was intentionally deferred, there should be a TODO or docs note. If it was accidentally orphaned during a refactor, it needs reconnection.

---

## Issues Summary

| ID | Mode | Severity | Category | Title |
|---|---|---|---|---|
| 07-001 | chess | HIGH | feature_broken | ChessBoard not rendered — fenPosition data format mismatch causes silent exception |
| 07-002 | chess | MEDIUM | content_quality | Raw puzzle ID '[#Goifm]' leaked into question text |
| 07-003 | map-pin | HIGH | feature_broken | MapPinDrop not in StudyQuizOverlay — no map_pin branch in study quiz template |
| 07-004 | trivia | CRITICAL | feature_missing | TriviaRoundScreen.svelte orphaned — no screen routing |
| 07-005 | procedural | LOW | visual_glitch | 0% accuracy shown immediately discourages early learners |
| 07-006 | study | HIGH | feature_broken | study-quiz scenario empty in fresh container — needs seeded player data |

---

## Containers Used
- BATCH-ULTRA-t7b — Chess mode (warm)
- BATCH-ULTRA-t7map2 — Map pin mode (cold)
- BATCH-ULTRA-t7proc — Procedural math mode (warm, navigated via dungeon-selection)
- BATCH-ULTRA-t7study2 — Study FSRS session (warm)
- BATCH-ULTRA-t7trivia — Trivia Night investigation (warm, hub navigation)

All containers stopped before report completion.

---

## Post-Session Code Verification Note

The initial report (and issues 07-001 and 07-003) contained an incorrect root-cause diagnosis: "StudyQuizOverlay.svelte has zero references to ChessBoard." This was wrong. After the Docker test session, source code inspection revealed:

- `StudyQuizOverlay.svelte` line 7 imports `ChessBoard.svelte`
- `StudyQuizOverlay.svelte` line 211 has `{#if quizResponseMode === 'chess_move' && chessContext}`
- All chess fields (`fenPosition`, `solutionMoves`, `quizResponseMode`) are forwarded through the full data pipeline

The corrected root cause for chess (07-001): `fenPosition` in `chess_tactics.json` is stored as the post-setup-move position, but `getPlayerContext()` expects the pre-setup-move base FEN. The resulting `chess.js` exception is caught silently, setting `chessContext=null` and bypassing the board branch.

The map-pin finding (07-003) remains accurate: `MapPinDrop` genuinely is not in `StudyQuizOverlay`. Issues.json has been updated with the corrected root-cause analysis.
