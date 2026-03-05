# Phase 52: Learning Depth

**Status**: Not Started
**Depends On**: Phase 8 (Mine Gameplay Overhaul — SM-2, quiz system, oxygen), Phase 6 (Advanced Learning — artifact quizzes, study sessions), Phase 15 (GAIA Personality 2.0 — mnemonic hints, struggle detection)
**Estimated Complexity**: Medium-High — touches QuizManager, GameManager, QuizOverlay, HubView, and PlayerSave schema; 5 distinct but interrelated sub-systems
**Design Decisions**: DD-V2-096 (SM-2 tuning), DD-V2-097 (consistency penalty), DD-V2-101 (quiz frequency and adaptation), morning/evening ritual design

---

## 1. Overview

Phase 52 fills in five learning-loop mechanics that are present in the design documentation but only partially or incorrectly implemented in the current codebase:

1. **Morning/Evening Quiz Bonus** — daily oxygen rewards for completing short review sessions at specific times of day.
2. **Layer Entrance Challenge (3 questions)** — expands the single-question gate to a 3-question sequence.
3. **Artifact Rarity Boost Quiz** — a mini-quiz before artifact pickup that can boost the artifact's rarity tier.
4. **GAIA Mnemonic Offer on Struggle** — GAIA proactively shows `mnemonic` field content when a player consistently fails the same fact.
5. **SM-2 In-Run Consistency Penalty (exact)** — a precise additional penalty when a player gets a fact right in study but wrong under dive pressure.

These five systems together tighten the relationship between learning performance and gameplay outcomes, making quiz competence matter more throughout every session.

### What Exists Already

| File | Status |
|---|---|
| `src/data/balance.ts` | `MORNING_REVIEW_HOUR: 7`, `EVENING_REVIEW_HOUR: 19`, `LAYER_ENTRANCE_QUESTIONS: 1`, `CONSISTENCY_PENALTY_O2`, `SM2_CONSISTENCY_PENALTY_O2` — constants exist but systems are partially wired |
| `src/data/types.ts` | `ReviewState.lastReviewContext?: 'study' \| 'mine' \| 'ritual'` — field exists |
| `src/data/types.ts` | `PlayerSave.lastMorningReview?: string`, `lastEveningReview?: string` — fields exist |
| `src/game/managers/QuizManager.ts` | Quiz delivery and SM-2 update logic; needs consistency-penalty extension |
| `src/ui/components/QuizOverlay.svelte` | Quiz UI; needs mnemonic bubble display |
| `src/ui/components/HubView.svelte` | Hub home screen; morning review prompt must be added |

### What This Phase Adds / Fixes

- Morning/Evening Quiz Bonus: fully wired prompt + oxygen grant in `HubView.svelte` and `GameManager.ts`
- Layer Entrance Challenge: expand from 1 question to 3 consecutive questions in `GameManager.ts`
- Artifact Rarity Boost: `GameManager.ts` + `QuizManager.ts` new quiz mode `'artifact_boost'`
- GAIA mnemonic: `QuizOverlay.svelte` + `QuizManager.ts` struggle tracking
- Consistency penalty: `QuizManager.ts` exact penalty spec wired into SM-2 update path

---

## 2. Sub-phases

---

### 52.1 — Morning/Evening Quiz Bonus

**Goal**: On first launch of the day, if the player has not yet done a morning review (before 11am local time), the Hub screen shows a prominent "Morning Review" prompt. Completing a 5-fact session grants +1 oxygen tank. An identical "Evening Review" prompt appears after 6pm if the evening bonus has not been claimed. Each bonus is available once per calendar day.

#### 52.1.1 — Balance constants in `src/data/balance.ts`

Verify these constants exist (add if missing):

```typescript
MORNING_REVIEW_HOUR: 7,           // 7 AM: morning window opens
MORNING_REVIEW_END: 11,           // 11 AM: morning window closes
EVENING_REVIEW_HOUR: 19,          // 7 PM: evening window opens
EVENING_REVIEW_END: 23,           // 11 PM: evening window closes
MORNING_REVIEW_FACT_COUNT: 5,     // Facts required to claim morning bonus
EVENING_REVIEW_FACT_COUNT: 5,     // Facts required to claim evening bonus
MORNING_REVIEW_O2_BONUS: 1,       // Oxygen tanks awarded
EVENING_REVIEW_O2_BONUS: 1,       // Oxygen tanks awarded
```

#### 52.1.2 — `playerData.ts` helper functions

In `src/ui/stores/playerData.ts`, add:

```typescript
/** Returns true if the player is eligible for the morning review bonus right now. */
export function isMorningReviewAvailable(save: PlayerSave): boolean {
  const now = new Date()
  const hour = now.getHours()
  const todayIso = now.toISOString().slice(0, 10)
  if (hour < MORNING_REVIEW_HOUR || hour >= MORNING_REVIEW_END) return false
  return save.lastMorningReview !== todayIso
}

/** Returns true if the player is eligible for the evening review bonus right now. */
export function isEveningReviewAvailable(save: PlayerSave): boolean {
  const now = new Date()
  const hour = now.getHours()
  const todayIso = now.toISOString().slice(0, 10)
  if (hour < EVENING_REVIEW_HOUR || hour >= EVENING_REVIEW_END) return false
  return save.lastEveningReview !== todayIso
}

/** Awards the morning review bonus and updates the timestamp. Call after a morning 5-fact session completes. */
export function claimMorningReviewBonus(save: PlayerSave): PlayerSave {
  const todayIso = new Date().toISOString().slice(0, 10)
  return {
    ...save,
    lastMorningReview: todayIso,
    oxygen: save.oxygen + MORNING_REVIEW_O2_BONUS,
  }
}

/** Awards the evening review bonus and updates the timestamp. */
export function claimEveningReviewBonus(save: PlayerSave): PlayerSave {
  const todayIso = new Date().toISOString().slice(0, 10)
  return {
    ...save,
    lastEveningReview: todayIso,
    oxygen: save.oxygen + EVENING_REVIEW_O2_BONUS,
  }
}
```

#### 52.1.3 — `HubView.svelte` morning/evening prompt

In `src/ui/components/HubView.svelte`, add a conditional banner below the main navigation. Use `$derived` or `onMount` to compute `showMorningPrompt` and `showEveningPrompt`:

```svelte
{#if showMorningPrompt}
  <div class="review-bonus-banner morning">
    <span class="icon">🌅</span>
    <div class="text">
      <strong>Morning Review</strong>
      <small>Answer 5 facts — earn +1 Oxygen Tank</small>
    </div>
    <button onclick={startMorningReview}>Start</button>
  </div>
{/if}
{#if showEveningPrompt}
  <div class="review-bonus-banner evening">
    <span class="icon">🌙</span>
    <div class="text">
      <strong>Evening Review</strong>
      <small>Answer 5 facts — earn +1 Oxygen Tank</small>
    </div>
    <button onclick={startEveningReview}>Start</button>
  </div>
{/if}
```

`startMorningReview()` / `startEveningReview()` open a study session (`StudySession.svelte` or QuizOverlay) in a special `'morning_ritual'` / `'evening_ritual'` mode. When the session completes 5 facts, fire a `morning-review-complete` or `evening-review-complete` event that `GameManager.ts` listens to.

#### 52.1.4 — `GameManager.ts` event handler

```typescript
// In GameManager.ts, in the event setup block:
EventBus.on('morning-review-complete', () => {
  const updated = claimMorningReviewBonus(get(playerSave))
  playerSave.set(updated)
  saveService.save(updated)
  // Show GAIA toast: "Good morning, [name]! +1 Tank for your mental exercise."
  GaiaManager.toast('morning_review_complete')
})

EventBus.on('evening-review-complete', () => {
  const updated = claimEveningReviewBonus(get(playerSave))
  playerSave.set(updated)
  saveService.save(updated)
  GaiaManager.toast('evening_review_complete')
})
```

**Acceptance Criteria**:
- Between 7am and 11am, the morning review banner is visible in HubView if not yet claimed today.
- Completing a 5-fact study session during the morning window grants +1 oxygen tank.
- The banner disappears after claiming and does not reappear until the next day.
- Between 7pm and 11pm, the evening review banner is visible if not yet claimed today.
- `lastMorningReview` and `lastEveningReview` fields are persisted in `PlayerSave`.
- The bonus does not stack: claiming it twice in one day is impossible.

---

### 52.2 — Layer Entrance Challenge (3 Questions)

**Goal**: Expand the single-question layer descent gate to a sequence of 3 consecutive questions. All 3 must be answered before descent is permitted. Each wrong answer costs oxygen (existing `LAYER_ENTRANCE_WRONG_O2_COST`). All 3 wrong = larger cumulative penalty, but descent still proceeds.

#### 52.2.1 — Balance constant update in `src/data/balance.ts`

```typescript
// Change from:
LAYER_ENTRANCE_QUESTIONS: 1,
// To:
LAYER_ENTRANCE_QUESTIONS: 3,
```

No other constant changes needed — the existing per-question cost applies three times.

#### 52.2.2 — `GameManager.ts` layer entrance quiz flow

Locate the `layer-entrance-quiz` event handler (or wherever `LAYER_ENTRANCE_QUESTIONS` is consumed). Replace the single-question flow with a sequential 3-question loop:

```typescript
async function runLayerEntranceChallenge(layer: number): Promise<void> {
  let questionsRemaining = LAYER_ENTRANCE_QUESTIONS // 3
  let allCorrect = true

  while (questionsRemaining > 0) {
    const fact = QuizManager.selectForLayerEntrance()
    const result = await QuizManager.presentQuestion(fact, 'layer_entrance')
    if (!result.correct) {
      allCorrect = false
      // Apply O2 penalty (existing logic)
      applyLayerEntranceWrongPenalty()
    }
    questionsRemaining--
    // Show progress: "Question 2 of 3" in QuizOverlay header
    QuizManager.setLayerChallengeProgress(LAYER_ENTRANCE_QUESTIONS - questionsRemaining, LAYER_ENTRANCE_QUESTIONS)
  }

  // Descent proceeds regardless; allCorrect bonus (optional future extension)
  EventBus.emit('layer-entrance-challenge-complete', { layer, allCorrect })
}
```

#### 52.2.3 — `QuizOverlay.svelte` progress indicator

When `quizMode === 'layer_entrance'`, show a progress indicator at the top of the overlay: "Layer Challenge — Question [N] of 3". Use a simple pill progress bar (3 segments, filled as each question is answered).

**Acceptance Criteria**:
- When the player approaches a descent shaft, 3 consecutive quiz questions appear before the descent animation begins.
- Each wrong answer costs oxygen (same as the existing single-question penalty).
- A progress indicator shows "Question 1/2/3 of 3" during the sequence.
- After all 3 questions, descent proceeds normally.
- A player who answers all 3 correctly receives a GAIA congratulatory toast.

---

### 52.3 — Artifact Rarity Boost Quiz

**Goal**: When a player mines an artifact node, trigger a 2-question mini-quiz BEFORE the artifact is added to inventory. Each correct answer applies a +15% rarity upgrade chance roll. All three rolls stacking gives up to a 45% cumulative chance of upgrading the artifact's rarity by one tier.

#### 52.3.1 — `QuizManager.ts` new mode: `'artifact_boost'`

Add a new quiz source mode `'artifact_boost'` to the `QuizMode` type union (wherever that is defined). This mode:
- Presents exactly 2 questions (configurable via `ARTIFACT_BOOST_QUESTION_COUNT: 2` in `balance.ts`).
- Returns `correctCount: number` (0, 1, or 2) to the caller.

```typescript
// In balance.ts:
ARTIFACT_BOOST_QUESTION_COUNT: 2,
ARTIFACT_BOOST_RARITY_CHANCE_PER_CORRECT: 0.15, // 15% per correct answer
```

#### 52.3.2 — `GameManager.ts` artifact-node resolution

Locate the path in `GameManager.ts` (or `MineScene.ts`) where an artifact node's content is resolved and added to inventory. Before adding to inventory:

1. Emit `artifact-boost-quiz-start` with the current artifact rarity.
2. `QuizManager` presents 2 questions in `'artifact_boost'` mode; waits for both.
3. Receive `correctCount` (0–2).
4. Roll rarity upgrade: for each correct answer, roll `Math.random() < 0.15`. If the roll succeeds, upgrade the artifact one rarity tier (e.g., `'common'` → `'uncommon'`). Maximum: upgrade to `'mythic'`.
5. The (potentially upgraded) artifact enters the inventory and the GachaReveal animation plays.

Display in QuizOverlay when mode is `'artifact_boost'`:
- Header: "Analyze This Discovery!" (instead of standard "Quiz Time")
- Sub-header: "Correct answers boost the artifact's rarity before you claim it"
- After each answer: brief feedback showing "Boost chance: +15%" or "No boost (wrong answer)"

**Acceptance Criteria**:
- Mining an artifact node triggers 2 quiz questions before the artifact is added to inventory.
- Each correct answer gives a 15% independent rarity upgrade roll.
- If both are answered correctly, the player has up to a 30% chance of a rarity upgrade (two independent 15% rolls).
- The artifact's final rarity (which may have upgraded) is shown in the GachaReveal sequence.
- Wrong answers do not downgrade the artifact.
- The artifact is always collected regardless of quiz performance.

---

### 52.4 — GAIA Mnemonic Offer on Struggle

**Goal**: When a player has gotten the same fact wrong 3 or more times in any quiz context, GAIA proactively surfaces the `mnemonic` field during the next presentation of that fact. The mnemonic appears as a GAIA speech bubble during the question phase (before the player selects an answer).

#### 52.4.1 — Struggle tracking in `ReviewState`

Add a `wrongCount` field to `ReviewState` in `src/data/types.ts`:

```typescript
export interface ReviewState {
  factId: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewAt: number
  lastReviewAt: number
  quality: number
  lastReviewContext?: 'study' | 'mine' | 'ritual'
  /** Cumulative number of times this fact has been answered incorrectly (never resets). */
  wrongCount?: number
}
```

#### 52.4.2 — `QuizManager.ts` — increment wrongCount on wrong answer

In the SM-2 update path (wherever quality < 3 is processed), increment `reviewState.wrongCount`:

```typescript
if (quality < 3) {
  reviewState.wrongCount = (reviewState.wrongCount ?? 0) + 1
}
```

#### 52.4.3 — `QuizManager.ts` — mnemonic flag on question selection

When selecting a question for presentation, after looking up its `ReviewState`, check:

```typescript
const shouldShowMnemonic = (reviewState.wrongCount ?? 0) >= STRUGGLE_THRESHOLD
// In balance.ts: STRUGGLE_WRONG_THRESHOLD: 3
```

Pass `shouldShowMnemonic` and the fact's `mnemonic` field to the quiz presentation payload.

#### 52.4.4 — `QuizOverlay.svelte` — GAIA mnemonic bubble

When the quiz question payload includes `showMnemonic: true` and a non-empty `mnemonic` string, render a GAIA speech bubble above the question:

```svelte
{#if showMnemonic && mnemonic}
  <div class="gaia-mnemonic-bubble">
    <img src="/assets/gaia-avatar-small.png" alt="GAIA" />
    <div class="bubble-text">
      <strong>GAIA:</strong> "Having trouble with this one? Here's a trick:
      <em>{mnemonic}</em>"
    </div>
  </div>
{/if}
```

If the fact has no `mnemonic` field (null or empty string), GAIA instead shows a generic encouragement:

```
"You've struggled with this one. Take a moment — you've got this."
```

**Acceptance Criteria**:
- A fact that has been answered incorrectly 3+ times (sum of `wrongCount` across all quiz contexts) shows a GAIA mnemonic bubble on the next presentation.
- The mnemonic bubble appears above the question text, before the player selects an answer.
- If no `mnemonic` field exists on the fact, a generic encouragement is shown instead.
- `wrongCount` persists in `PlayerSave.reviewStates` across sessions.
- Facts answered correctly do not trigger the mnemonic bubble (only struggle facts).

---

### 52.5 — SM-2 In-Run Consistency Penalty (Exact Implementation)

**Goal**: When a player correctly answers a fact in a study session (sets quality ≥ 3 with `lastReviewContext = 'study'`), then subsequently answers that same fact incorrectly during a dive quiz (quality < 3 with context `= 'mine'`), apply an additional SM-2 penalty on top of the standard wrong-answer penalty:

- Reset interval to 1 day (standard wrong-answer already does this in most SM-2 implementations).
- Additionally reduce `easeFactor` by 0.15 (extra, beyond the standard 0.20 decrease on wrong answers).

The rationale: getting it right at home but wrong under pressure means the knowledge is not yet reliable.

#### 52.5.1 — `QuizManager.ts` SM-2 update path

Locate the `updateSM2()` function (or equivalent) in `QuizManager.ts`. After the standard SM-2 calculation, add:

```typescript
function applyConsistencyPenalty(state: ReviewState, newQuality: number, context: 'study' | 'mine' | 'ritual'): ReviewState {
  if (context !== 'mine') return state
  if (newQuality >= 3) return state // Only apply on wrong answers in mine
  if (state.lastReviewContext !== 'study') return state // Only apply if last correct was in study
  if (state.repetitions < CONSISTENCY_MIN_REPS) return state // Only apply on mature facts

  return {
    ...state,
    // Standard wrong-answer already sets interval to 1; reinforce here
    interval: 1,
    // Extra ease penalty beyond standard
    easeFactor: Math.max(1.3, state.easeFactor - 0.15),
  }
}
```

Call `applyConsistencyPenalty` after the standard SM-2 update, then set `lastReviewContext = context`.

#### 52.5.2 — `lastReviewContext` always updated

Ensure that after every quiz answer (correct or wrong, mine or study), `lastReviewContext` is set to the current quiz context. This field must be persisted in `PlayerSave.reviewStates`.

**Acceptance Criteria**:
- A fact answered correctly in a study session, then answered incorrectly during a dive, receives an extra `easeFactor -= 0.15` on top of the standard wrong-answer SM-2 adjustment.
- The extra penalty only applies when: context is `'mine'`, quality < 3, `lastReviewContext === 'study'`, and `repetitions >= CONSISTENCY_MIN_REPS`.
- `lastReviewContext` is updated after every quiz answer and persisted in the save.
- The penalty does not apply to new facts (repetitions < `CONSISTENCY_MIN_REPS`).

---

## 3. Verification Gate

- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run build` completes successfully.
- [ ] At 7am–11am local time: Hub shows morning review banner. Completing 5 facts grants +1 oxygen tank.
- [ ] Banner absent after claiming; returns next calendar day.
- [ ] At a descent shaft: 3 quiz questions appear sequentially. Progress indicator shows "Q 1/2/3 of 3". Wrong answers cost oxygen.
- [ ] Mining an artifact: 2 quiz questions appear before GachaReveal. Two correct answers give two independent 15% rarity boost rolls.
- [ ] Fact with `wrongCount >= 3`: GAIA mnemonic bubble appears during quiz question display.
- [ ] `ReviewState.wrongCount` increments on wrong answers and persists across sessions.
- [ ] Mature fact answered correctly in study, then incorrectly in mine: `easeFactor` drops by 0.35 total (0.20 standard + 0.15 consistency penalty).
- [ ] `lastReviewContext` field correctly set to `'study'` / `'mine'` / `'ritual'` after each quiz.

---

## 4. Files Affected

### Modified
- `src/data/balance.ts` — add `MORNING_REVIEW_FACT_COUNT`, `EVENING_REVIEW_FACT_COUNT`, `MORNING_REVIEW_O2_BONUS`, `EVENING_REVIEW_O2_BONUS`, `LAYER_ENTRANCE_QUESTIONS` (1→3), `ARTIFACT_BOOST_QUESTION_COUNT`, `ARTIFACT_BOOST_RARITY_CHANCE_PER_CORRECT`, `STRUGGLE_WRONG_THRESHOLD`
- `src/data/types.ts` — add `ReviewState.wrongCount?: number`
- `src/game/GameManager.ts` — morning/evening event handlers; layer entrance 3-question loop; artifact boost quiz integration; consistency penalty wiring
- `src/game/managers/QuizManager.ts` — `'artifact_boost'` mode; `wrongCount` increment; mnemonic flag; `applyConsistencyPenalty()`; `lastReviewContext` always updated
- `src/ui/components/QuizOverlay.svelte` — layer challenge progress bar; artifact boost header; GAIA mnemonic bubble
- `src/ui/components/HubView.svelte` — morning/evening review banner
- `src/ui/stores/playerData.ts` — `isMorningReviewAvailable()`, `isEveningReviewAvailable()`, `claimMorningReviewBonus()`, `claimEveningReviewBonus()`

### New
None — all work extends existing files.
