# AR-76: Quiz Panel — Landscape Adaptation

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §9
> **Priority:** CORE EXPERIENCE
> **Complexity:** Medium
> **Dependencies:** AR-73 (Combat Layout), AR-74 (Input System)

## Context

The quiz panel currently slides in between enemy and card hand in portrait mode. In landscape, it occupies the "center stage" area (left 70% of viewport, above the card hand). The key improvement: **enemy panel remains fully visible during the quiz** (right 30%), unlike portrait where quiz covers the enemy.

## Current Implementation

- `src/ui/components/QuizOverlay.svelte` — full-screen overlay, `position: fixed; inset: 0; display: flex`
- Contains: question text, 3-5 multiple choice buttons, timer bar, GAIA sprite, memory tips
- Width: `min(100%, 36rem)`, centered
- Buttons: 48px min-height, answer options

## Directive

### Step 1: Quiz Panel Landscape Layout

**File:** `src/ui/components/QuizOverlay.svelte`

Add landscape branch:

```svelte
{#if $isLandscape}
  <div class="quiz-landscape">
    <!-- Positioned in center stage: left 70%, vertically centered, above card hand -->
    <!-- Width: ~50% of viewport (fits within 70% center stage with padding) -->
    <!-- Height: auto-sized to content -->
    <!-- Animation: slides up from bottom of center stage (200ms ease-out) -->
  </div>
{:else}
  <!-- EXISTING portrait quiz, UNCHANGED -->
{/if}
```

Landscape specifics:
- Position: centered within the left 70% area, vertically centered above card hand
- Max width: `min(50vw, 640px)`
- Background: semi-transparent dark panel (same style as portrait but sized for landscape)
- Does NOT cover the right 30% enemy panel
- Card hand dims slightly (opacity 0.7) during quiz but remains visible

### Step 2: Answer Button Layout

Landscape quiz answer layout:
- **Multiple choice (3-4 options):** 2×2 grid layout (more horizontal space available)
- **Multiple choice (5 options):** 3+2 grid (3 top row, 2 bottom)
- Each button shows keyboard shortcut label: `[1]`, `[2]`, `[3]`, `[4]` at left edge
- Buttons are wider in landscape (more text visible without truncation)

### Step 3: Keyboard Answer Selection

Wire quiz answers to keyboard input (from AR-74's inputService):
- Keys 1-4 select answer 1-4 (with brief highlight before submitting, 150ms delay)
- Visual: pressed key button gets a brief `active` state highlight
- Prevent double-submission (ignore additional keypresses after first answer)

### Step 4: Timer Bar

- Horizontal bar at TOP of quiz panel (same as portrait)
- Width fills quiz panel width
- Color transitions: green → yellow → red (same timing as portrait)

### Step 5: Transition Animation

- **Enter:** Panel slides up from bottom-center of center stage area (200ms ease-out)
- **Exit (correct):** Green flash, quiz slides down (150ms), card resolves with celebration
- **Exit (wrong):** Red pulse, correct answer shown for 1.5s, quiz slides down, card resolves muted
- Same animation timing as portrait, just different position

### Step 6: Verification

- [ ] Portrait quiz: pixel-identical to current
- [ ] Landscape quiz: centered in left 70% area
- [ ] Enemy panel visible during quiz in landscape
- [ ] Keyboard shortcuts (1-4) work for answer selection
- [ ] Timer bar displays correctly
- [ ] Enter/exit animations play correctly
- [ ] Quiz doesn't overlap card hand in landscape
- [ ] 5-option questions (Tier 2b/Mastery Trial) render in landscape grid

## Files Affected

| File | Action |
|------|--------|
| `src/ui/components/QuizOverlay.svelte` | MODIFY (landscape branch, keyboard labels) |
| `src/ui/components/ChallengeQuizOverlay.svelte` | MODIFY (same landscape treatment) |

## GDD Updates

Update `docs/GAME_DESIGN.md` §17 landscape subsection: Quiz panel occupies center stage area in landscape mode. Enemy remains visible during quiz. Keyboard shortcuts (1-4) for answer selection.
