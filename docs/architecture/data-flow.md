# Data Flow

> **Purpose:** End-to-end data flows for the 3 core gameplay loops: card play, quiz, and reward.
> **Last verified:** 2026-03-31
> **Source files:** `src/services/gameFlowController.ts`, `src/services/turnManager.ts`, `src/services/cardEffectResolver.ts`, `src/services/quizService.ts`, `src/services/rewardGenerator.ts`, `src/services/encounterBridge.ts`, `src/services/presetPoolBuilder.ts`

---

## Flow 1: Card Play

Player selects a card → quiz appears → answer evaluated → effect resolves → turn state updated.

### Step 1: Player selects a card (`CardHand.svelte` → `handlePlayCard`)

`CardApp.svelte` imports `handlePlayCard` from `encounterBridge.ts`. When the player taps a card:

1. `handlePlayCard(cardId)` is called.
2. `encounterBridge` looks up the card in `activeTurnState.deck.hand`.
3. If the card requires a quiz answer (`playMode = 'charge'`), the UI shows `ChallengeQuizOverlay` or `QuizOverlay`. The card play is suspended pending the answer.

### Step 2: Quiz answered → card play submitted

When the player submits an answer, the overlay calls back into `handlePlayCard` (or a dedicated answer handler) with:
- `cardId: string`
- `answeredCorrectly: boolean`
- `speedBonusEarned: boolean`
- `playMode: PlayMode` — one of `'charge'` (answer required), `'quick_play'` (no quiz), `'charge_wrong'`, `'charge_correct'`
- `distractorCount?: number`

### Step 3: `playCardAction` in `turnManager.ts`

```
playCardAction(turnState, cardId, answeredCorrectly, speedBonus, playMode, distractorCount)
  → resolveCardEffect(card, answeredCorrectly, speedBonus, turnState, playMode)
  → CardEffectResult { damageDealt, shieldApplied, healApplied, statusesApplied, ... }
```

`resolveCardEffect` in `cardEffectResolver.ts` computes the final effect value using:
- `BASE_EFFECT` × `TIER_MULTIPLIER` (from `balance.ts`)
- `CHARGE_CORRECT_MULTIPLIER` if `answeredCorrectly`
- Mastery bonus from `getMasteryBaseBonus(card.masteryLevel)`
- Relic modifiers via `resolveAttackModifiers()` / `resolveShieldModifiers()` (from `relicEffectResolver.ts`)
- Knowledge Aura level via `getAuraLevel()` / `adjustAura()`

`resolveCardEffect` does **not** mutate state — it returns a `CardEffectResult`.

### Step 4: State mutation in `turnManager.ts`

After `resolveCardEffect` returns, `playCardAction` applies the result:
- `applyDamageToEnemy(turnState, damageDealt)` — reduces enemy HP, checks defeat
- `applyShield(turnState.playerState, shieldApplied)` — adds block
- Status effects applied via `applyStatusEffect()`
- Mastery upgrade/downgrade checked via `canMasteryUpgrade()` / `canMasteryDowngrade()`
- Chain state updated via `extendOrResetChain()` if card has a chain type
- `turnState.apCurrent` decremented by `card.apCost`
- `turnState.cardsPlayedThisTurn++`, `cardsCorrectThisTurn++` if correct

Returns `PlayCardResult { effect, enemyDefeated, fizzled, blocked, turnState, masteryChange, ... }`.

### Step 5: `encounterBridge` publishes new state

Back in `encounterBridge.ts`, `handlePlayCard` calls:
```typescript
activeTurnState.set(freshTurnState(result.turnState))
```

`freshTurnState()` creates shallow copies of all arrays so Svelte's reactive system detects the change.

If `result.enemyDefeated`, a 550 ms timer fires `notifyEncounterComplete('victory')` → `gameFlowController.onEncounterComplete()`.

### Step 6: Svelte UI re-renders

`CardCombatOverlay.svelte` and `CardHand.svelte` subscribe to `activeTurnState`. On change:
- HP bars update
- Card hand re-renders (played card removed from hand)
- AP display updates
- Enemy intent updates if turn ended

---

## Flow 2: Quiz

Fact selection → question formatting → answer grading → FSRS schedule update.

### Step 1: Fact selection for combat (`encounterBridge.startEncounterForRoom`)

Run pool is built by one of three builders depending on `run.deckMode`:
- `buildGeneralRunPool(reviewStates, opts)` — general knowledge, weighted by FSRS due dates
- `buildPresetRunPool(domainSelections, reviewStates, opts)` — preset deck domains
- `buildLanguageRunPool(languageCode, reviewStates, opts)` — language-only facts

The run pool (`activeRunPool: Card[]`) is persisted in `encounterBridge` for the duration of the run.

Each card in the hand carries a `factId` linking it to a `Fact` record in `factsDB`.

### Step 2: Quiz fact retrieval

When a card is played in `'charge'` mode, `CardCombatOverlay` / `QuizOverlay` fetches the fact:
```typescript
factsDB.getById(card.factId) → Fact { question, correct_answer, distractors, ... }
```

Distractor selection is handled by:
- `getVocabDistractors()` (from `vocabDistractorService.ts`) for vocabulary cards
- `getNumericalDistractors()` (from `numericalDistractorService.ts`) for numerical answers
- Raw `fact.distractors[]` for general facts

### Step 3: Answer grading

The quiz UI compares the player's selected answer against `fact.correct_answer` (string equality, normalized). Grading produces `answeredCorrectly: boolean` and `speedBonusEarned: boolean` (speed timer bonus, never a hard deadline).

### Step 4: FSRS schedule update (`updateReviewStateByButton`)

After the card play completes in `encounterBridge`, `updateReviewStateByButton` is called on the `playerSave` store:
```typescript
updateReviewStateByButton(factId, rating)
// rating: 1 (wrong) | 3 (correct) | 4 (correct + speed bonus)
```

This applies the FSRS-5 algorithm to compute the next `nextReviewAt` timestamp, `interval`, and `easeFactor` for the fact. The updated `ReviewState[]` is persisted via `persistPlayer()`.

### Step 5: Non-combat quiz selection (`quizService.ts`)

For out-of-combat quizzes (Study Temple, rest-room study), `quizService.selectQuestion()` picks the review-due fact with the earliest `nextReviewAt` among facts in `cardState === 'review'`. New/learning cards are excluded — they stay in the StudySession flow.

`selectDifficultyWeightedQuestion()` selects review-due cards weighted by ease factor relative to depth ratio: shallow levels prefer high-ease (easy) cards, deep levels prefer low-ease (hard) cards.

---

## Flow 3: Reward

Combat ends → rewards generated → card / relic / gold offered → player chooses → run continues.

### Step 1: Encounter complete signal

When enemy HP reaches 0, `encounterBridge` fires (after 550 ms):
```typescript
notifyEncounterComplete('victory')
  → encounterCompleteHandler('victory')  // registered by gameFlowController
  → gameFlowController.onEncounterComplete('victory')
```

### Step 2: `onEncounterComplete` in `gameFlowController.ts`

1. Heals player: `POST_ENCOUNTER_HEAL_PCT` of max HP (from `balance.ts`), capped at `POST_ENCOUNTER_HEAL_CAP`.
2. Generates currency reward via `generateCurrencyReward(floor, isBoss)`.
3. Records encounter stats: `run.encountersWon++`, `run.factsCorrect`, `run.factsAnswered`.
4. Updates bounties via `updateBounties(run.bounties, ...)`.
5. Calls `combatExitEnemyId.set(enemyId)` and `combatExitRequested.set(true)` — triggers parallax exit transition in `CardApp.svelte`.
6. Sets `pendingPostCombatAction` to the function that will proceed to rewards after the transition.

### Step 3: Card reward generation (`rewardGenerator.ts`)

After the parallax transition, `generateCardRewardOptionsByType()` is called:
```typescript
generateCardRewardOptions(runPool, activeDeckFactIds, consumedRewardFactIds, count=3)
```

Eligible cards: from `runPool`, excluding facts already in the active deck, already consumed as rewards, and Tier 3 (mastered) cards.

When archetype weighting is active, `generateRewardTypeOptions()` picks 3 card types using `ARCHETYPE_WEIGHTS[archetype]` (defined in `rewardGenerator.ts`):
```typescript
ARCHETYPE_WEIGHTS = {
  aggressive: { attack: 2.4, buff: 1.6, shield: 0.6, ... },
  defensive:  { shield: 2.2, utility: 1.0, attack: 0.6, ... },
  control:    { debuff: 2.2, utility: 1.9, attack: 0.5, ... },
  // ...
}
```

Upgrade chance per floor uses `UPGRADED_REWARD_CHANCE_BY_FLOOR` from `balance.ts`.

### Step 4: Relic reward generation

For boss floors, `generateBossRelicChoices(pool)` from `relicAcquisitionService.ts` draws `RELIC_BOSS_CHOICES` options from the eligible relic pool. Pity system: after `RELIC_PITY_THRESHOLD` consecutive common relics, the next draw guarantees Uncommon+. Counter tracked in `run.relicPityCounter`.

Random relic drops (non-boss) use `shouldDropRandomRelic()` + `generateRandomRelicDrop(pool)`.

### Step 5: Player selection (`gameFlowController.ts`)

Player selection callbacks exported from `gameFlowController`:
- `onCardRewardSelected(card)` — calls `addRewardCardToActiveDeck(card)` in `encounterBridge`, adds `card.factId` to `consumedRewardFactIds`
- `onCardRewardSkipped()` — no deck change
- `onRelicRewardSelected(relicId)` — adds relic to `run.runRelics`, applies immediate HP bonuses if relic has `vitality_ring`-style effects
- `onCardRewardReroll()` — deducts gold, regenerates 3 new options

### Step 6: Return to dungeon map

After reward selection, `proceedAfterReward()` in `gameFlowController.ts`:
1. Calls `advanceEncounter()` / `advanceFloor()` from `floorManager.ts`.
2. Checks for `pendingSpecialEvent` or `pendingFloorCompleted`.
3. Sets `gameFlowState.set('dungeonMap')` and `currentScreen.set('dungeonMap')`.
4. Calls `autoSaveRun('dungeonMap')` to persist run state.
5. Clears `isProcessingEncounterResult` guard.
