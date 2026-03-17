# AR-77: Rest Site — Study & Meditate Options

## Overview
Add the two missing rest site options from the V2 overhaul spec: **Study** (answer quiz questions to upgrade cards) and **Meditate** (remove 1 card from deck for thinning). Currently only Rest (heal) and Upgrade (pick 1 card to boost) exist. Replace Upgrade with Study (quiz-gated upgrading is more engaging and on-brand). Add Meditate as the third option.

**Dependencies**: Existing rest room overlay, quiz system, card upgrade service, deck management
**Complexity**: Medium-High (new quiz flow, deck thinning, UI changes)

---

## Design (from recall-rogue-overhaul-v2.md §10)

| Choice | Icon | Effect | Quiz Count |
|--------|------|--------|------------|
| **Rest** | ❤️ | Heal 30% max HP | 0 |
| **Study** | 📖 | Answer up to 3 questions. Each correct → upgrade a random eligible card | 3 |
| **Meditate** | 🧘 | Remove 1 card from deck (deck thinning) | 0 |

### Study Flow
1. Player selects "Study"
2. 3 facts presented one at a time (from the run's fact pool)
3. Each correct answer: a random eligible card in deck gains `isUpgraded: true`
4. Wrong answers: no penalty, correct answer shown (learning moment)
5. After all questions: show results summary, return to map

### Meditate Flow
1. Player selects "Meditate"
2. Show all cards in deck (draw + discard + hand piles)
3. Player picks 1 card to permanently remove
4. Card is removed, return to map
5. Cannot remove if deck has ≤ 5 cards (minimum deck size)

---

## Sub-steps

### 77.1 — Update RestRoomOverlay to 3 Options
**Files**: `src/ui/components/RestRoomOverlay.svelte`

Replace the current 2-option layout (Rest / Upgrade) with 3 options:
- **Rest** (❤️): Heal 30% HP — same as current
- **Study** (📖): "Answer 3 questions to upgrade cards" — new
- **Meditate** (🧘): "Remove 1 card from deck" — new, disabled if deck ≤ 5 cards

Remove the old Upgrade button entirely (Study replaces it with quiz-gated upgrading).

Update props interface:
```typescript
interface Props {
  playerHp: number
  playerMaxHp: number
  onheal: () => void
  onstudy: () => void
  onmeditate: () => void
  studyDisabled?: boolean
  studyDisabledReason?: string
  meditateDisabled?: boolean
  meditateDisabledReason?: string
}
```

Update caption: "Choose one: Rest, Study, or Meditate"

Styling: Study card gets purple/blue accent (#7C3AED), Meditate card gets teal accent (#14B8A6).

**Acceptance**: Rest site shows 3 options. Study and Meditate buttons are functional (callbacks fire). Layout is balanced and centered.

### 77.2 — Study Quiz Flow (New Component)
**Files**: `src/ui/components/StudyQuizOverlay.svelte` (new)

Create a new Svelte component for the Study quiz session:
- Shows 3 questions one at a time
- Each question uses the standard quiz format (question text + 3 answer choices)
- Facts are sourced from the run's fact pool (same as combat charges)
- Correct answer: green highlight, increment upgrade counter
- Wrong answer: red highlight, show correct answer, no penalty
- After all 3 questions: show summary ("Upgraded X/3 cards!"), button to continue
- On continue: callback fires with number of correct answers

Props:
```typescript
interface Props {
  facts: QuizFact[]  // 3 facts to quiz
  onComplete: (correctCount: number) => void
}
```

Use the existing quiz answer rendering pattern from the charge quiz (find in CardCombatOverlay or similar).

**Acceptance**: Study quiz shows 3 questions sequentially. Correct/wrong feedback works. Summary shows at end.

### 77.3 — Wire Study Flow in GameFlowController
**Files**: `src/services/gameFlowController.ts`, `src/CardApp.svelte`

Add a new game flow state `'restStudy'` and screen `'restStudy'`.

When Study is selected:
1. Pick 3 random facts from the run's fact pool (use existing `getRunPoolFacts()` or similar)
2. Generate quiz data (question + 3 distractors) for each fact
3. Set screen to `'restStudy'`
4. On quiz complete: for each correct answer, upgrade a random eligible card (use `prepareUpgradeCandidates()` + `upgradeCard()`)
5. Call `onRestResolved()` to return to map

Add `handleRestStudy()` in CardApp.svelte that:
- Gets 3 facts, transitions to study screen
- On completion, upgrades cards and resolves

**Acceptance**: Selecting Study at rest site → quiz appears → correct answers upgrade cards → returns to map.

### 77.4 — Wire Meditate Flow in GameFlowController
**Files**: `src/services/gameFlowController.ts`, `src/CardApp.svelte`, `src/ui/components/MeditateOverlay.svelte` (new)

Create a simple card picker overlay:
- Shows all cards in the current deck (draw + discard + hand)
- Player taps one card to select it for removal
- Confirm button: "Remove this card?"
- On confirm: remove card from deck via `sellCardFromActiveDeck()` (0 gold return), call `onRestResolved()`
- Cancel button to go back to rest site

Disable meditate if deck size ≤ 5 cards.

Add flow state `'restMeditate'` and screen `'restMeditate'`.

**Acceptance**: Selecting Meditate → card picker shows deck → player picks 1 card → card removed → returns to map. Cannot meditate with ≤ 5 cards.

### 77.5 — Update Game Design Docs
**Files**: `docs/GAME_DESIGN.md`

Update the Rest Site section to document all 3 options: Rest, Study, Meditate. Include:
- Study quiz flow and upgrade behavior
- Meditate deck thinning rules (min 5 cards)
- Remove references to the old "Upgrade" option

---

## Files Affected
- `src/ui/components/RestRoomOverlay.svelte` (77.1)
- `src/ui/components/StudyQuizOverlay.svelte` (77.2 — new)
- `src/ui/components/MeditateOverlay.svelte` (77.4 — new)
- `src/services/gameFlowController.ts` (77.3, 77.4)
- `src/CardApp.svelte` (77.3, 77.4)
- `docs/GAME_DESIGN.md` (77.5)

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — no new failures
- [ ] Rest site shows 3 options
- [ ] Study quiz works: 3 questions, upgrades on correct
- [ ] Meditate works: card picker, removal, min 5 deck guard
- [ ] Playwright screenshot: rest site 3-option layout
