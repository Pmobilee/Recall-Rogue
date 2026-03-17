# AR-74: Input System Overhaul (Keyboard + Mouse + Touch)

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §4
> **Priority:** CORE EXPERIENCE
> **Complexity:** Large
> **Dependencies:** AR-71 (Layout System)

## Context

The game is touch-only. Pointer events for card drag, Capacitor haptics, 48px touch targets, no keyboard support. Desktop users expect keyboard shortcuts and mouse hover states. This AR creates an input abstraction layer and adds keyboard/mouse input.

## Directive

### Step 1: Input Service — Game Action Types

**File:** NEW `src/services/inputService.ts`

```typescript
export type GameAction =
  | { type: 'SELECT_CARD'; index: number }      // 0-4
  | { type: 'QUICK_PLAY' }
  | { type: 'CHARGE' }
  | { type: 'DESELECT' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'QUIZ_ANSWER'; index: number }       // 0-3 for multiple choice
  | { type: 'NAVIGATE_BACK' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_DECK_VIEW' }
  | { type: 'SKIP_ANIMATION' }
  | { type: 'END_TURN' };

type ActionHandler = (action: GameAction) => void;

class InputService {
  private handlers: Map<string, Set<ActionHandler>> = new Map();

  /** Register a handler for a specific action type (or '*' for all) */
  on(actionType: string, handler: ActionHandler): () => void { ... }

  /** Dispatch an action to all registered handlers */
  dispatch(action: GameAction): void { ... }

  /** Remove all handlers (cleanup) */
  clear(): void { ... }
}

export const inputService = new InputService();
```

**Acceptance:** Action types defined. Pub/sub dispatch works. Handlers can register/unregister.

### Step 2: Keyboard Input Module

**File:** NEW `src/services/keyboardInput.ts`

Keyboard input is ONLY dispatched when in landscape mode.

| Key | Action | Context |
|-----|--------|---------|
| 1-5 | SELECT_CARD(0-4) | Card hand visible |
| Q | QUICK_PLAY | Card selected |
| E | CHARGE | Card selected |
| Escape | CANCEL / NAVIGATE_BACK / PAUSE | Context-dependent |
| Space | CONFIRM / SKIP_ANIMATION | Any |
| 1-4 | QUIZ_ANSWER(0-3) | Quiz visible (override card select) |
| Tab | TOGGLE_DECK_VIEW | Combat |
| Enter | END_TURN | Combat, card hand visible |

- Subscribe to `layoutMode` — only bind keyboard listeners in landscape
- Prevent default on bound keys (don't scroll on Space)
- Context-aware: same keys do different things depending on game state (use `currentScreen` store)
- When quiz overlay is visible, 1-4 = quiz answers, not card selection

**Acceptance:** All keyboard shortcuts work in landscape. No keyboard response in portrait. Context switching works (quiz vs card hand).

### Step 3: Mouse Input Enhancements

**File:** Modify relevant Svelte components for mouse hover behaviors (landscape only):

**Card hover** (`CardHand.svelte` landscape branch):
- Mouse enter on card: subtle 1.05× scale, show info preview tooltip (mechanic, AP cost, chain type, fact preview)
- NOT the same as selecting — no buttons appear on hover
- Mouse leave: return to normal scale

**Enemy hover** (`CardCombatOverlay.svelte` landscape branch):
- Mouse enter on enemy area: show expanded tooltip (next intent, all status effects with durations, damage breakdown)
- Tooltip positioned to not occlude enemy sprite

**Click behavior:**
- Click card = select (same as current tap)
- Click Quick Play / Charge buttons = play (same as current tap)
- Click quiz answer = select answer
- Click outside modal = dismiss (where appropriate)

**Right-click card** (landscape only):
- Shows detailed card info popup (fact text, chain type, FSRS tier, mechanic description)
- Dismiss on click-away or Escape

**Acceptance:** Hover previews show in landscape. Right-click context works. All actions clickable with mouse.

### Step 4: Mouse-Only Guarantee

**CRITICAL:** Every single action in the game must be performable with mouse clicks alone. Keyboard shortcuts are acceleration, not requirements. Verify:

- [ ] Select card: clickable
- [ ] Quick Play: clickable button
- [ ] Charge: clickable button
- [ ] Deselect: click away or click selected card again
- [ ] Quiz answer: clickable buttons
- [ ] End turn: clickable button
- [ ] Navigate back: clickable back button
- [ ] Pause: clickable pause button
- [ ] Deck view: clickable toggle

### Step 5: Keyboard Shortcut Help Screen

**File:** NEW `src/ui/components/KeyboardShortcutHelp.svelte`

- Toggle with `?` key (landscape only)
- Modal overlay showing all keyboard shortcuts organized by context
- Sections: Combat, Quiz, Navigation, General
- Dismiss with `?` again or Escape

**Acceptance:** `?` key opens/closes help overlay. All shortcuts documented.

### Step 6: Integrate with Existing Touch/Pointer Handlers

Existing pointer handlers in CardHand.svelte and other components should NOT be removed — they continue to work for touch and mouse click. The input service provides an ADDITIONAL pathway for keyboard shortcuts.

Components that currently handle pointer events can optionally also listen to `inputService` for keyboard-triggered actions, or the keyboard module can directly call the same functions that pointer handlers call.

### Step 7: Verification

- [ ] `npm run typecheck` passes
- [ ] Portrait mode: touch/pointer works identically to before
- [ ] Landscape mode: all keyboard shortcuts functional
- [ ] Landscape mode: card hover preview shows
- [ ] Landscape mode: enemy hover tooltip shows
- [ ] Landscape mode: right-click card shows detail
- [ ] Every action achievable with mouse clicks alone (no keyboard-only actions)
- [ ] `?` key opens keyboard help
- [ ] Keys don't fire when typing in text input (quiz typed input, settings, etc.)

## Files Affected

| File | Action |
|------|--------|
| `src/services/inputService.ts` | NEW |
| `src/services/keyboardInput.ts` | NEW |
| `src/ui/components/KeyboardShortcutHelp.svelte` | NEW |
| `src/ui/components/CardHand.svelte` | MODIFY (hover states for landscape) |
| `src/ui/components/CardCombatOverlay.svelte` | MODIFY (enemy hover, keyboard integration) |
| `src/ui/components/QuizOverlay.svelte` | MODIFY (keyboard answer selection) |

## GDD Updates

Add to `docs/GAME_DESIGN.md` a new section "§36. Input System" documenting keyboard shortcuts, mouse hover behaviors, and the mouse-only guarantee. Mark as `[IMPLEMENTED — Desktop Port]`.
