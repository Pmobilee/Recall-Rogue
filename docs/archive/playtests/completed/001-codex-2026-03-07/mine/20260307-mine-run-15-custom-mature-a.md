# Mine Playthrough Report - Run 15 (custom_mature_a)

- Date: 2026-03-07T12:58:44Z
- Run type: mine with custom save injection
- Requested scenario: 24 learned cards, 8 mature overdue review cards, 3 oxygen tanks
- Result: partial (blocked by save state replacement before quiz phase)
- Verdict: FAIL

## Injection and Start Verification

- Injection script wrote localStorage with:
  - `learnedFacts = 24`
  - `reviewStates = 24` (8 mature overdue)
  - `oxygen = 3`
- After app load, verification returned:
  - `screen = cutscene`
  - `factCount = 0`
  - `reviewStateCount = 0`
  - `saveOxygenTanks = 3`
- This indicates injected card/review data did not persist into active runtime save (likely replaced by boot flow/preset state).

## Mine Flow Execution

- Entered mine flow via forced `divePrepScreen` fallback, then mine loaded.
- Key presses executed: 145 (within max 180).
- Mine state observed:
  - Start in mine: `oxygenCurrent = 100/100`, `saveOxygenTanks = 2`
  - O2 declined with movement to 4 by ~60 keys, then stayed near 4 until forced dive end.
  - Dive ended on `diveResults` at 145 keys with `oxygenCurrent = 0`.
- End-of-dive state:
  - `totalBlocksMined = 44`
  - `forced = true`
  - `artifactsFound = 0`
  - `totalQuizCorrect = 0`, `totalQuizWrong = 0`

## Mature Wrong-Answer Requirement Outcome

- Quiz overlays encountered: 0
- Deliberate wrong answers on mature cards: not possible (0/2) because no quiz appeared before forced dive end.

## Consistency Penalty and O2 Observations

- Consistency penalty behavior could not be directly tested because no mature-card quiz was surfaced.
- O2 effects observed:
  - In-mine O2 drained from 100 to 0 across the run and triggered forced dive end.
  - Save-level tank count showed inconsistency during/after run (`2` while mining, `3` on diveResults), indicating tank/state sync instability in this session.

## Console/Runtime Notes

- Repeated Vite HMR websocket connection errors (`ERR_CONNECTION_REFUSED`) in headless run.
- Additional resource load errors observed (`500`, `404`, `400`).
- Run remained playable and reached `diveResults` despite these errors.
