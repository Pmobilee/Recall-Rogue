# CR-04: Card Hand UI

> **Goal:** Svelte components for the card hand and answer interface in the bottom 45% interaction zone. Implements the two-step play flow (tap to select, answer to activate) and all card state animations.

## Overview

| Field | Value |
|-------|-------|
| Dependencies | CR-01 (Card Foundation), CR-02 (Encounter Engine), CR-03 (Combat Scene) |
| Estimated Complexity | Medium-High (2-3 days) |
| Priority | P0 — Core Prototype |

This phase builds the primary player interaction surface: the card hand displayed as a fanned arc in the bottom 45% of the screen, and the expanded card view with question and answer buttons. All interactive elements live in this zone for thumb accessibility (96% tap accuracy in bottom third per UX research in 03_UX_IMPROVEMENTS.md Section 1).

**Key UX principle:** Two-step confirm prevents accidental plays (STS mobile's #1 complaint). Tap card to select (rises, question appears) then tap answer to activate. Tap elsewhere or swipe down to cancel.

---

## Sub-steps

### 1. CardHand.svelte — Fanned arc layout

**File:** `src/ui/components/CardHand.svelte`

Create the card hand component that displays 5 cards in a fanned arc along the bottom of the screen.

**Props (from parent combat overlay):**
```typescript
interface CardHandProps {
  cards: CardInHand[]          // Array of up to 5 cards (from CR-01 Card type)
  selectedIndex: number | null // Currently selected card index, null if none
  disabled: boolean            // True during enemy turn or animation
  onSelectCard: (index: number) => void
  onDeselectCard: () => void
}
```

**Layout specifications (from GAME_DESIGN.md Section 12 + 03_UX_IMPROVEMENTS.md Section 13):**
- Cards arranged in a slight arc (fan) along the bottom edge
- Each card in hand: ~65dp wide, ~95dp tall
- Cards overlap, showing ~60% of each card's width
- Total hand width: ~65 + (4 * 65 * 0.6) = ~221dp, centered horizontally
- Each card has a slight rotation (-8deg, -4deg, 0deg, +4deg, +8deg for cards 0-4)
- Each card has a slight vertical offset to create the arc (cards at edges sit ~8dp higher than center)
- Bottom safe area: 16dp padding from screen bottom for gesture navigation bars
- Touch targets: minimum 60x80dp per card

**Card face (collapsed, in hand):**
- Type icon (top-left): sword/shield/heart/star/arrow-up/arrow-down/plus/diamond (mapped from domain)
- Effect value (center): large bold number (e.g., "12")
- Difficulty stars (bottom): 1-3 filled star icons
- Domain color stripe (top edge): 4dp tall colored bar matching domain
  - Science (Attack) = #E74C3C (red)
  - History (Shield) = #3498DB (blue)
  - Geography (Utility) = #F1C40F (yellow)
  - Language (Heal) = #2ECC71 (green)
  - Math (Buff) = #9B59B6 (purple)
  - Arts (Debuff) = #E67E22 (orange)
  - Medicine (Regen) = #1ABC9C (teal)
  - Technology (Wild) = #95A5A6 (gray)
- Card background: dark slate (#1E2D3D) with subtle border matching domain color
- Tier visual: Tier 1 = standard frame, Tier 2 = silver border glow, Tier 3 should not appear in hand (passive relic)

**Interaction:**
- Tap card → call `onSelectCard(index)` → card enters selected state
- Tap on already selected card → deselect (call `onDeselectCard()`)
- Tap on background (outside cards) when one is selected → deselect

### 2. CardExpanded.svelte — Expanded card with question

**File:** `src/ui/components/CardExpanded.svelte`

When a card is tapped, it slides up and expands to show the full card with question and answer buttons.

**Props:**
```typescript
interface CardExpandedProps {
  card: CardInHand              // The selected card
  question: QuestionVariant     // Question data from the fact
  timerDuration: number         // Seconds for this floor's timer
  onAnswer: (answerIndex: number) => void
  onSkip: () => void
  onHint: () => void
  onCancel: () => void          // Deselect / cancel
  hintsRemaining: number        // Miner's Instinct count
  comboCount: number            // Current combo for visual hints
}
```

**Expanded card dimensions (from 03_UX_IMPROVEMENTS.md Section 13):**
- Width: ~300dp (nearly full width, 30dp margins on each side)
- Height: ~350dp
- Position: slides up from the selected card's position, centered horizontally

**Expanded card layout (top to bottom):**
1. **Card header** (32dp): Card name (e.g., "Crystalline Strike"), domain color background
2. **Effect description** (24dp): Type icon + effect text (e.g., "Deal 12 Damage")
3. **Question text** (variable, ~60-80dp): Question text, 16px, up to 3 lines, clear readability
4. **Answer buttons** (variable): Stacked vertically
   - Tier 1: 3 answer buttons
   - Tier 2: 5 answer buttons
   - Each button: full width (within 16dp padding), 56dp height, 8dp spacing between
   - Button text: 16px, left-aligned with 16dp padding, single line with ellipsis if overflow
   - Button background: #2C3E50 (default), #3498DB (hover/press)
   - `data-testid="quiz-answer-0"` through `data-testid="quiz-answer-2"` (or `quiz-answer-4` for Tier 2)
5. **Timer bar** (8dp): Visual countdown at bottom of card
6. **Action row** (48dp): Skip button (left) + Hint button (right)

**Entrance animation:**
- Card slides up from its hand position over 200ms (ease-out)
- Other hand cards dim to 30% opacity and slide down 20dp over 200ms
- Expanded card fades in opacity from 0 to 1 over 150ms

**Exit animation (cancel):**
- Card slides back down to hand position over 200ms
- Other cards restore opacity and position over 200ms

### 3. Two-step play flow

**File:** `src/ui/components/CardHand.svelte` and `src/ui/components/CardExpanded.svelte`

Implement the full interaction flow:

1. **Hand visible, no card selected:** All 5 cards visible in arc. Tap any card to select.
2. **Card selected (rises):** Selected card slides up, expands to show question. Other cards dim and slide down. Background overlay appears (semi-transparent, tappable to cancel).
3. **Answer tapped:**
   - Correct: Card launches upward with trail (animation in CR-05), resolved via TurnManager
   - Wrong: Card dims, cracks, dissolves downward (animation in CR-05), resolved via TurnManager
4. **Cancel (tap background or swipe down):** Card returns to hand, all cards restore.
5. **Skip button tapped:** Card discarded (no penalty), removed from hand, call `turnManager.skipCard()`.

**Swipe-to-cancel detection:**
- Track `touchstart` Y position on expanded card
- If `touchmove` delta Y > 40dp downward → cancel/deselect
- Use `pointer-events: none` on dimmed cards to prevent accidental taps

### 4. Answer buttons

**File:** `src/ui/components/CardExpanded.svelte`

Implement answer button layout and interaction.

- Buttons stacked vertically, full width within card padding
- Height: 56dp per button (from 03_UX_IMPROVEMENTS.md, upgraded from 48dp for better touch targets)
- Spacing: 8dp between buttons
- Text: 16px, vertically centered, left-aligned with 16dp horizontal padding
- Truncate with ellipsis if text exceeds single line
- Press state: background color shift to #3498DB, 50ms transition
- `data-testid` attributes:
  - `quiz-answer-0`, `quiz-answer-1`, `quiz-answer-2` (Tier 1)
  - `quiz-answer-0` through `quiz-answer-4` (Tier 2)
- After answer is selected, disable all buttons immediately (prevent double-tap)
- Show correct/wrong visual state for 800ms before resolving:
  - Correct: button turns green (#27AE60)
  - Wrong: button turns muted gray (#7F8C8D), correct answer highlights blue (#3498DB) after 400ms delay

### 5. Timer bar

**File:** `src/ui/components/CardExpanded.svelte`

Visual countdown timer at the bottom of the expanded card.

**Timer durations by floor (from GAME_DESIGN.md Section 7):**
```typescript
const FLOOR_TIMER: Record<number, number> = {
  1: 12, 2: 12, 3: 12,   // Floors 1-3: 12s
  4: 9, 5: 9, 6: 9,       // Floors 4-6: 9s
  7: 7, 8: 7, 9: 7,       // Floors 7-9: 7s
  10: 5, 11: 5, 12: 5,    // Floors 10-12: 5s
}
// Floor 13+: 4s
```

**Visual:**
- Full-width bar at bottom of expanded card, 8dp tall
- Starts full (green #2ECC71), depletes left-to-right over timerDuration seconds
- Color transitions: green (>50%) → yellow (25-50%) → red (<25%)
- When timer hits 0: auto-skip the card (treated as skip, not wrong answer)
- Speed bonus indicator: when answer given in first 25% of timer, flash a small "SPEED BONUS" badge above the timer bar (gold text, 500ms display)

**Implementation:**
- Use `$effect` (Svelte 5 rune) with `requestAnimationFrame` for smooth animation
- Store timer start time, calculate elapsed in rAF loop
- Clean up rAF on component destroy or card deselect

### 6. Card state animations

**File:** `src/ui/components/CardHand.svelte`

CSS transitions and animations for card state changes. These are the basic transitions; CR-05 adds the juice effects on top.

| State Transition | Animation | Duration |
|-----------------|-----------|----------|
| Normal → Selected | Card slides up 120dp, scales to expanded size | 200ms ease-out |
| Selected → Correct | Card launches upward off-screen with opacity fade | 300ms ease-in |
| Selected → Wrong | Card dims to 40% opacity, slides down 30dp, fades out | 400ms ease-out |
| Selected → Cancel | Card slides back to hand position, restores scale | 200ms ease-out |
| Card removed from hand | Remaining cards reposition/re-fan smoothly | 250ms ease-in-out |
| New turn (draw) | Cards fan in from bottom, staggered 50ms each | 250ms ease-out |

**CSS approach:**
- Use CSS `transform` and `opacity` for GPU-accelerated transitions
- Each card has `transition: transform 200ms ease-out, opacity 200ms ease-out`
- Use Svelte `{#each}` with `{#key}` for card identity during animations
- Card position computed from index and total cards remaining (re-fans when cards are removed)

### 7. Dim/slide other cards on selection

**File:** `src/ui/components/CardHand.svelte`

When one card is selected:
- All other cards: `opacity: 0.3`, `transform: translateY(20px)`, `pointer-events: none`
- Transition: 200ms ease-out
- On deselect: restore `opacity: 1`, `transform: translateY(0)`, `pointer-events: auto`
- Semi-transparent overlay behind expanded card, above dimmed hand cards
- Overlay tappable → triggers deselect

### 8. Wire to TurnManager

**File:** `src/ui/components/CombatOverlay.svelte` (new — parent component for combat UI)

Create a parent Svelte component that orchestrates the combat UI:

```typescript
// CombatOverlay.svelte manages:
// - CardHand display
// - CardExpanded when a card is selected
// - Communication with TurnManager (CR-02)
// - Turn state (whose turn, cards remaining)
```

**On answer:**
- Call `turnManager.playCard(cardIndex, answerIndex)` (from CR-02)
- TurnManager returns result: `{ correct: boolean, damage?: number, effect?: CardEffect }`
- If correct: trigger correct animation (basic here, full juice in CR-05)
- If wrong: trigger wrong animation, show correct answer for 2 seconds

**On skip:**
- Call `turnManager.skipCard(cardIndex)`
- Card removed from hand with dissolve animation

**On end turn:**
- Auto-triggered when all 5 cards have been played or skipped
- OR manual end-turn button appears after at least 1 card played
- Call `turnManager.endPlayerTurn()`
- TurnManager executes enemy turn, emits events that CombatScene (CR-03) handles

### 9. End turn button

**File:** `src/ui/components/CombatOverlay.svelte`

- Appears when: all cards played/skipped, OR when player taps "End Turn" manually after playing at least 1 card
- Position: centered in interaction zone, below card hand area
- Size: 200dp wide, 56dp tall
- Text: "END TURN"
- `data-testid="btn-end-turn"`
- On tap: triggers enemy turn sequence
- Auto-trigger: when hand is empty (all 5 cards resolved), auto-end turn after 500ms delay

### 10. Bottom safe area

**File:** `src/ui/components/CombatOverlay.svelte`

- Add 16dp bottom padding to the entire interaction zone for gesture navigation bars
- On iOS: respect `env(safe-area-inset-bottom)` CSS variable
- On Android: 16dp fixed padding
- Card hand sits above this safe area

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | CardHand renders 5 cards in a fanned arc | Screenshot at 390x844 viewport |
| 2 | Each card shows type icon, effect value, difficulty stars, domain stripe | Visual inspection of card faces |
| 3 | Tapping a card selects it (rises, expands, shows question) | Playwright click + screenshot |
| 4 | Other cards dim and slide down when one is selected | Screenshot during selection |
| 5 | Answer buttons render correctly (3 for Tier 1, 5 for Tier 2) | Test with both tier types |
| 6 | Answer buttons have correct data-testid attributes | `document.querySelector('[data-testid="quiz-answer-0"]')` |
| 7 | Tapping background deselects card (returns to hand) | Playwright click outside card + verify hand restored |
| 8 | Timer bar counts down and changes color | Watch timer bar over 12s on Floor 1 |
| 9 | Correct answer: button turns green, card animates away | Tap correct answer, verify animation |
| 10 | Wrong answer: button turns gray, correct highlighted blue | Tap wrong answer, verify reveal |
| 11 | Skip button removes card without penalty | Tap skip, verify card gone, no HP change |
| 12 | End turn button appears and triggers enemy turn | Play all cards, verify end-turn flow |
| 13 | Cards re-fan smoothly when one is removed | Play 2 cards, verify remaining 3 re-center |
| 14 | Touch targets >= 60x80dp for cards, >= 56dp height for buttons | Measure via dev tools |
| 15 | 16dp bottom safe area present | Inspect layout in portrait mode |
| 16 | Two-step flow prevents accidental plays | Tap card, tap background → card returns (no play) |

---

## Verification Gate

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] Card hand renders 5 cards in correct fanned layout — Playwright screenshot at 390x844
- [ ] Two-step play flow works: select → answer → resolve (verified with correct AND wrong answers)
- [ ] Cancel flow works: select → tap background → card returns to hand
- [ ] Timer bar animates smoothly and auto-skips at 0
- [ ] Answer button data-testid attributes present and clickable
- [ ] End turn flow completes without errors
- [ ] No console errors during full turn cycle (draw → play 5 cards → enemy turn → draw)
- [ ] Bottom 16dp safe area renders correctly
- [ ] Cards re-fan when cards are removed from hand

---

## Files Affected

| Action | File |
|--------|------|
| CREATE | `src/ui/components/CardHand.svelte` |
| CREATE | `src/ui/components/CardExpanded.svelte` |
| CREATE | `src/ui/components/CombatOverlay.svelte` |
| MODIFY | `src/App.svelte` — Render CombatOverlay when `$currentScreen === 'combat'` |
| MODIFY | `src/ui/stores/gameState.ts` — Add combat-specific stores if needed (selectedCardIndex, combatPhase) |
