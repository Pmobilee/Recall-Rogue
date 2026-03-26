# AR-266: Mystery Room Quiz Overhaul (7 Events)

## Overview

**Goal:** Replace 7 generic mystery events with quiz-themed versions that make knowledge decisions matter outside combat. Players study, compete, gamble, and review — all through quiz mechanics.

**Why:** Current mystery events are generic RPG fare (heal fountain, coin pile, gambler's bet). In a knowledge game, these rooms should leverage the quiz system — making study decisions, reviewing mistakes, and testing under pressure.

**Dependencies:** AR-261 (Review Queue for Wrong Answer Museum and Meditation Chamber)
**Estimated complexity:** Medium (7 event rewrites + new quiz-in-event UI component)

**Reference:** `docs/RESEARCH/05 Overhaul relics cards.md` lines 453-478

---

## Key Challenge: Quiz Outside Combat

Current quiz infrastructure lives in the combat flow (turnManager → quiz popup → resolve). Mystery events need a **standalone quiz component** that can present questions and branch on results without combat context.

### New MysteryEffect Type

**File:** `src/services/floorManager.ts` (line ~44, MysteryEffect union)

Add a new variant to the union:

```typescript
| { type: 'quiz'; questionCount: number; difficulty: 'easy' | 'normal' | 'hard';
    perCorrect: MysteryEffect; perWrong: MysteryEffect;
    completionBonus?: MysteryEffect }
| { type: 'study'; factCount: number; bonusDuration: number; bonusEffect: MysteryEffect }
| { type: 'reviewMuseum' }  // Special: displays wrong-answer history
| { type: 'rivalDuel'; questionCount: number; rivalAccuracy: number;
    winEffect: MysteryEffect; tieEffect: MysteryEffect; loseEffect: MysteryEffect }
| { type: 'meditation' }    // Special: shows accuracy stats, choose theme for -1 distractor
```

### New UI Component

**New file:** `src/ui/components/EventQuiz.svelte`

A standalone quiz component for mystery events:
- Presents MCQ questions (same format as combat quiz)
- Shows correct/wrong feedback after each answer
- Tracks results (correct count, total count)
- Reports final result back to the event handler
- Simpler than combat quiz — no timer pressure, no damage resolution, no AP
- **Scaling:** All sizes use `calc(Npx * var(--layout-scale, 1))`, fonts use `calc(Npx * var(--text-scale, 1))`

---

## Sub-steps

### 1. Extend MysteryEffect Union Type

**File:** `src/services/floorManager.ts` (line ~44)

Add the new effect variants listed above. This is a TypeScript union extension — existing code handles existing variants unchanged.

**Acceptance criteria:** Union compiles. Existing event code unaffected.

### 2. Create EventQuiz.svelte Component

**New file:** `src/ui/components/EventQuiz.svelte`

Props:
- `questionCount: number` — how many questions to present
- `difficulty: 'easy' | 'normal' | 'hard'` — maps to mastery-0, current, mastery-5 difficulty
- `onComplete: (correct: number, total: number) => void` — callback with results

Behavior:
1. Draw `questionCount` questions from the current deck's fact pool
2. Present each as MCQ (same format as combat quiz)
3. Show correct answer after each response (educational feedback)
4. After all questions, call `onComplete` with results
5. No timer (events are low-pressure study moments)

**Acceptance criteria:**
- Component presents questions and collects answers
- Shows correct answer feedback
- Reports results via callback
- No hardcoded px values
- Accessible keyboard navigation

### 3. Handle New Effect Types in MysteryEventOverlay

**File:** `src/ui/components/MysteryEventOverlay.svelte`

Add handlers for the new `quiz`, `study`, `reviewMuseum`, `rivalDuel`, and `meditation` effect types:

- **quiz:** Mount `EventQuiz`, on complete apply `perCorrect` for each correct and `perWrong` for each wrong, then apply `completionBonus`
- **study:** Show fact preview cards (question + answer visible), flag factIds with bonus for future encounters
- **reviewMuseum:** Show all wrong-answer facts this run with correct answers. Each tap = "studied" (+1g, reduce wrongCount)
- **rivalDuel:** Mount `EventQuiz` with `questionCount`, compare score to `rivalAccuracy × questionCount` (rounded), apply win/tie/lose effect
- **meditation:** Show accuracy stats by chain theme, let player choose one theme for -1 distractor rest of run

**Acceptance criteria:** All 5 new effect types handled in the overlay. Transitions between quiz questions and results are smooth.

### 4. Replace Tier 1 Events

#### 4a. Healing Fountain → The Tutor's Office

**File:** `src/services/floorManager.ts` (replace `healing_fountain`, line ~130)

```typescript
{
  id: 'tutors_office',
  name: "The Tutor's Office",
  description: "An old scholar offers to review your weakest material. 'Let me show you what you need to know.'",
  effect: {
    type: 'compound',
    effects: [
      { type: 'study', factCount: 3, bonusDuration: 2, bonusEffect: {
        type: 'compound', effects: [
          // +30% charge damage on previewed facts for next 2 encounters
          // + 5 gold per correct charge on those facts
        ]
      }},
      { type: 'healPercent', percent: 10 },
    ]
  }
}
```

**Mechanic:** Preview 3 facts (question + answer shown openly). Flag these factIds as `tutorPreviewed: true`. In the next 2 encounters, correct Charge on a previewed fact: +30% damage + 5 gold.

**State needed:** `tutorPreviewedFacts: { factId: string, encountersRemaining: number }[]` on run state. Decremented at encounter start.

**Acceptance criteria:** 3 facts displayed openly. Bonus applies in subsequent encounters. Heal 10% HP.

#### 4b. Scattered Coins → Flashcard Merchant

**File:** `src/services/floorManager.ts` (replace `scattered_coins`, line ~124)

```typescript
{
  id: 'flashcard_merchant',
  name: 'The Flashcard Merchant',
  description: "A merchant sells knowledge bundles. 'Study now, profit later.'",
  effect: {
    type: 'choice',
    options: [
      { label: 'Buy study bundle (25g)', effect: {
        type: 'compound', effects: [
          { type: 'currency', amount: -25 },
          { type: 'study', factCount: 3, bonusDuration: 999, bonusEffect: {
            // +20% charge damage on studied facts for rest of run
          }},
        ]
      }},
      { label: 'Study for free (+10% bonus)', effect: {
        type: 'study', factCount: 3, bonusDuration: 999, bonusEffect: {
          // +10% charge damage on studied facts for rest of run
        }
      }},
      { label: 'Walk away', effect: { type: 'nothing', message: 'You move on.' }},
    ]
  }
}
```

**Acceptance criteria:** Pay 25g for +20% or free for +10%. Facts displayed with answers. Bonus persists.

### 5. Replace Tier 2 Events

#### 5a. Knowledge Tax → The Wrong Answer Museum

**File:** `src/services/floorManager.ts` (replace `knowledge_tax`, line ~181)

```typescript
{
  id: 'wrong_answer_museum',
  name: 'The Wrong Answer Museum',
  description: "Your mistakes are displayed on the walls. Time to study them.",
  effect: { type: 'reviewMuseum' }
}
```

**Mechanic:**
1. Display every fact the player got wrong this run (question, player's wrong answer in red, correct answer in green)
2. Each fact can be tapped to "study" (flip animation)
3. Per fact studied: +1 gold, reduce that fact's in-run `wrongCount` by 1
4. No cost, no risk — pure study opportunity
5. Uses the Review Queue's wrong-answer tracking + in-run FSRS `wrongCount`

**Acceptance criteria:** All wrong-answer facts displayed. Tap to study. Gold earned. wrongCount reduced.

#### 5b. Gambler's Tome → The Rival Student

**File:** `src/services/floorManager.ts` (replace `gamblers_tome`, line ~231)

```typescript
{
  id: 'rival_student',
  name: 'The Rival Student',
  description: "A fellow scholar challenges you. 'Think you know more than me?'",
  effect: {
    type: 'rivalDuel',
    questionCount: 5,
    rivalAccuracy: 0.65,  // 65% — predetermined by run seed
    winEffect: { type: 'compound', effects: [
      { type: 'cardReward' },  // Choice of rare card
      { type: 'healPercent', percent: 10 },
    ]},
    tieEffect: { type: 'currency', amount: 15 },
    loseEffect: { type: 'nothing', message: 'Better luck next time.' },
  }
}
```

**Mechanic:** 5 MCQ questions. After each, rival's answer revealed (predetermined 65% accuracy from run seed). Final comparison: beat = rare card + heal 10%, tie = 15g, lose = nothing.

**Acceptance criteria:** 5 questions presented. Rival answers shown. Win/tie/lose correctly determined. Rewards granted.

### 6. Replace Tier 3 Event

#### Burning Library (rethemed mechanic)

**File:** `src/services/floorManager.ts` (replace `burning_library`, line ~246)

```typescript
{
  id: 'burning_library',
  name: 'The Burning Library',
  description: "Books are falling from the shelves! Save what you can!",
  effect: {
    type: 'quiz',
    questionCount: 4,
    difficulty: 'easy',  // Mastery-0 difficulty (2 distractors)
    perCorrect: { type: 'nothing', message: '' },  // Rewards granted sequentially
    perWrong: { type: 'nothing', message: 'That book is lost to the flames.' },
    // Escalating rewards: 1st=15g, 2nd=upgradeCard, 3rd=heal 10%, 4th=+1 mastery
    // Implementation note: escalating rewards need special handling in the resolver
  }
}
```

**Mechanic:** 4 sequential easy questions. Each correct = escalating reward:
1. First correct: 15 gold
2. Second correct: card upgrade
3. Third correct: heal 10%
4. Fourth correct: +1 mastery to a random deck card

Each wrong = that reward is lost (but doesn't affect future questions).

**Implementation note:** The escalating reward pattern may need a custom effect type (`type: 'escalatingQuiz'`) rather than the generic `quiz` type, since rewards differ per question.

**Acceptance criteria:** 4 easy questions. Escalating rewards for each correct. Missed rewards clearly shown as "lost."

### 7. Replace Tier 4 Events

#### 7a. Final Wager → The Knowledge Gamble

**File:** `src/services/floorManager.ts` (replace `final_wager`, line ~311)

```typescript
{
  id: 'knowledge_gamble',
  name: 'The Knowledge Gamble',
  description: "One question. The hardest you'll face. Everything on the line.",
  effect: {
    type: 'quiz',
    questionCount: 1,
    difficulty: 'hard',  // Mastery-5 difficulty, 4 distractors, confusion-weighted
    perCorrect: { type: 'choice', options: [
      { label: 'Full heal', effect: { type: 'healPercent', percent: 100 }},
      { label: '+2 mastery to any card', effect: {
        // Player picks which card gets +2 mastery
        type: 'nothing', message: '+2 mastery granted'  // Needs custom handler
      }},
    ]},
    perWrong: { type: 'maxHpChange', amount: -8 },  // Lose 8% max HP permanently
  }
}
```

**Mechanic:** One hardest-possible question (mastery-5 difficulty, 4 distractors, all confusion-weighted from personal confusion matrix). Correct: choice of full heal OR +2 mastery to any card. Wrong: lose 8% max HP permanently.

**Acceptance criteria:** Single hard question presented. Correct = player chooses reward. Wrong = permanent max HP reduction. High-stakes feeling.

#### 7b. The Recursion → The Meditation Chamber

**File:** `src/services/floorManager.ts` (replace `the_recursion`, line ~329)

```typescript
{
  id: 'meditation_chamber',
  name: 'The Meditation Chamber',
  description: "Silence. Your mind reflects on what you know — and what you don't.",
  effect: { type: 'meditation' }
}
```

**Mechanic:**
1. Display accuracy stats by chain theme (e.g., "Civil War Era: 82%, Founding Fathers: 54%")
2. Player chooses one theme to "meditate on"
3. For the rest of the run, questions from that theme use 1 fewer distractor
4. No quiz — pure strategic difficulty management

**State needed:** `meditatedTheme: string | null` on run state. Check in quiz distractor generation.

**Acceptance criteria:** Accuracy stats displayed by theme. Theme selection persists. -1 distractor applies in future quizzes.

### 8. Unit Tests

Test cases:
- `calculateAccuracyGrade` correctly determines rivalry outcomes (65% rival accuracy)
- Escalating rewards grant correct reward per question index
- Meditation theme selection persists and reduces distractor count
- Review Museum correctly reads wrong-answer history

**Acceptance criteria:** All tests pass.

### 9. Update GDD

**File:** `docs/GAME_DESIGN.md`

Update mystery event documentation:
- Replace descriptions for all 7 events
- Document new MysteryEffect types
- Note which events interact with Review Queue / FSRS state

**Acceptance criteria:** All 7 events documented with mechanics and tier placement.

---

## Files Affected

| File | Change |
|------|--------|
| `src/services/floorManager.ts` | Extend MysteryEffect union (line 44). Replace 7 event definitions. |
| NEW: `src/ui/components/EventQuiz.svelte` | Standalone quiz component for events |
| `src/ui/components/MysteryEventOverlay.svelte` | Handle 5 new effect types |
| `docs/GAME_DESIGN.md` | Update mystery event documentation |
| Test files | Unit tests for new event mechanics |

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Playwright: Navigate to mystery room → verify Tutor's Office shows fact previews
- [ ] Playwright: Rival Student presents 5 questions with rival comparison
- [ ] Playwright: Burning Library escalating rewards work correctly
- [ ] Playwright: Knowledge Gamble presents single hard question with high stakes
- [ ] Playwright: Meditation Chamber shows accuracy stats and allows theme selection
- [ ] Playwright: Wrong Answer Museum displays wrong-answer history
- [ ] No hardcoded px values in EventQuiz.svelte
