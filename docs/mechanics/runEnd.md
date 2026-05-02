# Run End Screen

> **Purpose:** Documents how run-end statistics are computed, what counters mean, and how the Practice Run banner fires.
> **Last verified:** 2026-05-02
> **Source files:** `src/services/runManager.ts`, `src/services/masteryScalingService.ts`, `src/services/encounterBridge.ts`, `src/services/gameFlowController.ts`, `src/ui/components/RunEndScreen.svelte`

---

## Stat Counters

### encountersTotal / encountersWon

Both counters live on `RunState` and are incremented in `gameFlowController.ts → onEncounterComplete()`.

| Counter | When it increments |
|---|---|
| `encountersTotal` | On every call to `onEncounterComplete('victory' \| 'defeat')` — once per combat, regardless of result |
| `encountersWon` | Only on `onEncounterComplete('victory')` |

The **Encounters** pill in `RunEndScreen` shows `encountersTotal` (encounters fought) with a sub-line `N won` for context. A player who fights one combat and loses sees `ENCOUNTERS: 1 / 0 won` — not `0`.

### chargesAttempted

Added 2026-05-02 to separate Charge Play (quiz) from Quick Play (no quiz). Incremented in `encounterBridge.handlePlayCard()` whenever `playMode !== 'quick' && playMode !== 'quick_play'`. Used by `isPracticeRun()` to avoid false positives.

---

## Grade Explanation Text

The `gradeExplanation` derived value in `RunEndScreen` shows a contextual hint under the grade badge (defeat only). It uses floor-based language rather than a win-rate percentage:

- Accuracy ≥ 80% and floor < 7: `"All correct — the dungeon stopped you on Floor N, not the questions."`
- Accuracy < 50% and most encounters completed: `"You braved every corridor but stumbled often."`
- Default: `"Grade = accuracy × floors × chain bonus"`

The formula was previously `encountersWon / encountersTotal × 100` labeled as "dungeon explored %". This was replaced (2026-05-02) because a player who loses their only combat would see "0% explored", which is factually wrong.

---

## Practice Run Detection

**Source:** `masteryScalingService.ts → isPracticeRun()`

A run is classified as a Practice Run when any of:
1. `practiceRunDetected = true` (set at encounter start when `deckMasteryPct > 0.75`) **AND** `chargesAttempted >= MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN (5)`
2. `chargesAttempted >= 5` AND `questionsAnswered >= 5` AND `questionsCorrect === questionsAnswered` (100% accuracy on charges)
3. `chargesAttempted >= 5` AND `questionsAnswered >= 5` AND `questionsCorrect / questionsAnswered > 0.85`
4. `chargesAttempted >= 5` AND `novelQuestionsAnswered >= 3` AND `novelQuestionsCorrect / novelQuestionsAnswered > 0.80`

**Key guard:** If `chargesAttempted < 5`, `isPracticeRun` returns `false` regardless of all other factors. This prevents the banner firing for:
- Pure Quick Play runs (no quizzes answered, but `questionsAnswered` and `questionsCorrect` get polluted with `correct=true` from Quick Play)
- Runs where the player died before answering 5 charge questions

**Why `questionsAnswered` is unreliable alone:** `recordCardPlay(run, correct, ...)` is called for both Quick Play and Charge Play. Quick Play always passes `correct=true`, so a 5-card Quick Play run shows `questionsAnswered=5, questionsCorrect=5` — 100% accuracy — which incorrectly matched the practice-run signal before the `chargesAttempted` guard was added.

### Effects of Practice Run classification
- `currencyEarned = 0` (Grey Matter suppressed)
- Bounty bonuses suppressed
- Run End screen shows "Practice Run — No camp rewards" notice

---

## RunEndData fields
`endRun(state, reason)` in `runManager.ts` builds a `RunEndData` object. Key fields that flow to `RunEndScreen`:

| Field | Source |
|---|---|
| `encountersWon` | `state.encountersWon` |
| `encountersTotal` | `state.encountersTotal` |
| `accuracy` | `factsCorrect / factsAnswered × 100` (0 if no answers) |
| `isPracticeRun` | `isPracticeRun(state)` |
| `defeatedEnemyIds` | `state.defeatedEnemyIds ?? []` |
| `factStateSummary` | computed from `playerSave.reviewStates` diff vs touched facts |
