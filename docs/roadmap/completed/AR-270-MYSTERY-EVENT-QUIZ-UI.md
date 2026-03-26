# AR-270: Mystery Event Quiz UI + 7 Event Mechanics

## Overview
**Goal:** Create a standalone quiz component for mystery events and implement the full quiz-integrated mechanics for all 7 rethemed events.
**Dependencies:** AR-266 (event definitions already rethemed with simplified effects)
**Estimated complexity:** Large (new Svelte component + MysteryEffect union extension + 7 event implementations + overlay handlers)

---

## Sub-steps

### 1. Create EventQuiz.svelte Component

**New file:** `src/ui/components/EventQuiz.svelte`

Props:
- `questionCount: number`
- `difficulty: 'easy' | 'normal' | 'hard'` (maps to mastery 0/current/5 difficulty)
- `onComplete: (correct: number, total: number) => void`

Behavior:
- Draws questions from current deck's fact pool via quiz service
- Presents MCQ (same format as combat quiz)
- Shows correct answer after each response
- No timer (events are low-pressure)
- Tracks correct/total, calls onComplete when done
- All CSS uses `--layout-scale` / `--text-scale`

### 2. Extend MysteryEffect Union

In `src/services/floorManager.ts`, add new variants:
```typescript
| { type: 'quiz'; questionCount: number; difficulty: 'easy' | 'normal' | 'hard'; perCorrect: MysteryEffect; perWrong: MysteryEffect; completionBonus?: MysteryEffect }
| { type: 'study'; factCount: number; bonusDuration: number; bonusType: 'charge_damage'; bonusPercent: number }
| { type: 'reviewMuseum' }
| { type: 'rivalDuel'; questionCount: number; rivalAccuracy: number; winEffect: MysteryEffect; tieEffect: MysteryEffect; loseEffect: MysteryEffect }
| { type: 'meditation' }
```

### 3. Implement 7 Event Quiz Mechanics

Replace simplified effects in floorManager.ts:

**Tier 1:**
1. **Flashcard Merchant** — `study` effect: spend 25g → preview 3 facts, +20% charge damage for rest of run
2. **Tutor's Office** — `study` effect: preview 3 facts, +30% charge bonus for 2 encounters, heal 10%

**Tier 2:**
3. **Wrong Answer Museum** — `reviewMuseum`: display all wrong facts, +1g per studied, reduce wrongCount
4. **Rival Student** — `rivalDuel`: 5 MCQs vs 65% rival, win = rare card + heal, tie = 15g

**Tier 3:**
5. **Burning Library** — `quiz` with escalating rewards per correct answer

**Tier 4:**
6. **Knowledge Gamble** — `quiz` with 1 hardest question, high stakes
7. **Meditation Chamber** — `meditation`: show accuracy stats, choose theme for -1 distractor

### 4. Handle in MysteryEventOverlay.svelte

Add handlers for each new effect type:
- `quiz` / `rivalDuel` → mount EventQuiz component
- `study` → show fact preview cards with answers
- `reviewMuseum` → show wrong-answer history list
- `meditation` → show accuracy stats with theme selector

---

## Files Affected
| File | Change |
|------|--------|
| NEW: `src/ui/components/EventQuiz.svelte` | Standalone quiz component |
| `src/services/floorManager.ts` | MysteryEffect union + 7 event definitions |
| `src/ui/components/MysteryEventOverlay.svelte` | Handle 5 new effect types |
| `docs/GAME_DESIGN.md` | Update mystery event docs |

## Verification Gate
- [ ] `npm run typecheck && npm run build && npx vitest run`
- [ ] EventQuiz renders and accepts answers
- [ ] Rival Student comparison works correctly
- [ ] Visual: Playwright screenshot of EventQuiz in mystery room
