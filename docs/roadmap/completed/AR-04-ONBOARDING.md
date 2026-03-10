# AR-04: Onboarding + Difficulty Modes
> Phase: Pre-Launch — New Player Experience
> Priority: HIGH
> Depends on: AR-01 (Combat Integrity), AR-02 (FSRS Migration)
> Estimated scope: L

New players learn the game in 60 seconds. Three difficulty modes serve all skill levels. Calibration Deep Scan places returning learners at appropriate tier. Hint system provides safety net.

## Design Reference

From GAME_DESIGN.md Section 14 (Onboarding — First 60 Seconds):

> ```
> 0-3s:   Dungeon entrance. "ENTER THE DEPTHS" button.
> 3-5s:   Brief: "Do you prefer more time to read?" [Yes / No] (Slow Reader toggle)
> 5-10s:  First encounter. Hand of 5. Tooltip: "Tap a card to examine it"
> 10-14s: Card rises, front only. Tooltip: "Tap Cast to commit"
> 14-20s: Question appears. Correct → juice stack. Wrong → gentle fizzle.
> 20-35s: Remaining AP. End Turn tooltip.
> 35-60s: Second encounter. Minimal tooltips.
> ~2-3m:  Run ends. "Create account to save progress?" (skippable).
> Run 2:  Domain selection unlocks.
> ```
>
> First encounter: 2 AP. Full 3 AP from encounter 3.

From GAME_DESIGN.md Section 10 (Difficulty — Player Modes):

> | Mode | Timer | Wrong Penalty | Enemy Dmg | Rewards |
> |------|-------|--------------|-----------|---------|
> | Explorer | None | 50% effect | -30% | 70% |
> | Standard | Dynamic (floor + question length) | Fizzle (costs 1 AP) | Normal | 100% |
> | Scholar | -2s per tier, Tier 2 = free recall | Fizzle + 3 self-dmg | +20% | 150% |

From GAME_DESIGN.md Section 10 (Slow Reader):

> Set during onboarding: "Do you prefer more time to read?" Adds +3 seconds flat. Timer bar amber instead of red.

From GAME_DESIGN.md Section 14 (Calibration Deep Scan):

> After first run, optional 20-question rapid placement test. Correct → facts start at Tier 2a.

From GAME_DESIGN.md Section 15 (Hint System):

> 1 Scholar's Insight per encounter. Options: remove 1 wrong answer, +5s timer, or reveal first letter.

## Implementation

### Sub-task 1: 60-Second Onboarding Flow

#### Data Model

```typescript
// In playerProfile or saveService
interface OnboardingState {
  hasCompletedOnboarding: boolean;  // True after first run ends
  hasSeenCardTapTooltip: boolean;
  hasSeenCastTooltip: boolean;
  hasSeenAnswerTooltip: boolean;
  hasSeenEndTurnTooltip: boolean;
  hasSeenAPTooltip: boolean;
  runsCompleted: number;  // Domain selection unlocks at runsCompleted >= 1
}
```

#### Logic

New `src/services/onboardingController.ts`:

```typescript
export function isOnboarding(state: OnboardingState): boolean {
  return !state.hasCompletedOnboarding;
}

export function shouldShowDomainSelection(state: OnboardingState): boolean {
  return state.runsCompleted >= 1;
}

export function getOnboardingAP(encounterNumber: number): number {
  // First 2 encounters: 2 AP. From encounter 3: normal 3 AP.
  return encounterNumber <= 2 ? 2 : 3;
}

export function getNextTooltip(state: OnboardingState, context: string): string | null {
  if (context === 'hand_drawn' && !state.hasSeenCardTapTooltip) {
    return 'Tap a card to examine it';
  }
  if (context === 'card_selected' && !state.hasSeenCastTooltip) {
    return 'Tap Cast to commit — you cannot cancel!';
  }
  if (context === 'card_committed' && !state.hasSeenAnswerTooltip) {
    return 'Answer the question to activate your card';
  }
  if (context === 'card_resolved' && !state.hasSeenEndTurnTooltip) {
    return 'Tap End Turn when you\'re done playing cards';
  }
  if (context === 'second_turn' && !state.hasSeenAPTooltip) {
    return 'You have 2 AP — each card costs 1 AP to play';
  }
  return null;
}
```

#### UI

**Dungeon Entrance Screen** (new component `DungeonEntrance.svelte`):
- Full-screen dark background (dungeon art from AR-03, or solid dark purple fallback)
- Title: "RECALL ROGUE" in pixel font, centered, 24dp
- Subtitle: "Enter the Depths" in 14dp below title
- Large button: "ENTER THE DEPTHS" — 200×56dp, centered, gold border, amber text
- On tap: transition to Slow Reader question

**Slow Reader Question** (inline in onboarding flow, not a separate screen):
- Text: "Do you prefer more time to read?" — 16dp, centered
- Two buttons side by side: "Yes" (sets `isSlowReader = true`) / "No" (sets `isSlowReader = false`)
- Button size: 120×48dp each, 16dp spacing
- After selection: immediately transition to first combat encounter

**Contextual Tooltips:**
- Positioned near the relevant UI element (arrow pointing to element)
- Semi-transparent dark background (rgba(0,0,0,0.85))
- White text, 14dp, max 200dp width
- Auto-dismiss after 4 seconds OR on user interaction with the highlighted element
- Each tooltip shown ONCE (tracked in OnboardingState)
- Tooltip sequence:
  1. "Tap a card to examine it" → arrow points to center card in hand
  2. "Tap Cast to commit — you cannot cancel!" → arrow points to Cast button
  3. "Answer the question to activate your card" → arrow points to answer buttons
  4. "Tap End Turn when done" → arrow points to End Turn button
  5. "You have 2 AP — each card costs 1 AP" → arrow points to AP gems

**First Run Constraints:**
- No domain selection (auto-assign "general" domain for both primary and secondary)
- 2 AP for encounters 1-2, 3 AP from encounter 3+
- Only 3 encounters total (simplified run)
- No retreat-or-delve checkpoint (run ends after 3 encounters)
- Run end screen: "Create account to save progress?" with "Skip" and "Sign Up" buttons (Sign Up = future feature, for now both dismiss)

**Run 2+:**
- Domain selection screen appears (primary + secondary)
- Full 3 AP from encounter 1
- Normal run length and retreat-or-delve
- No tooltips (all marked as seen)

### Sub-task 2: Difficulty Modes

#### Data Model

```typescript
type DifficultyMode = 'explorer' | 'standard' | 'scholar';

// In playerProfile
interface PlayerProfile {
  difficultyMode: DifficultyMode;  // Default: 'standard'
  isSlowReader: boolean;
  // ... other fields
}
```

Add to `balance.ts`:

```typescript
const DIFFICULTY_MODIFIERS = {
  explorer: {
    timerEnabled: false,
    wrongPenaltyMultiplier: 0.5,   // 50% effect on wrong
    enemyDamageMultiplier: 0.7,     // -30% enemy damage
    rewardMultiplier: 0.7,          // 70% rewards
    wrongCostsAP: false,            // Wrong answer does NOT cost AP
  },
  standard: {
    timerEnabled: true,
    wrongPenaltyMultiplier: 1.0,    // Fizzle, no effect
    enemyDamageMultiplier: 1.0,
    rewardMultiplier: 1.0,
    wrongCostsAP: true,             // Wrong = fizzle, costs 1 AP
  },
  scholar: {
    timerEnabled: true,
    timerPenaltyPerTier: 2,         // -2s per card tier
    wrongPenaltyMultiplier: 1.0,    // Fizzle
    wrongSelfDamage: 3,             // +3 self-damage on wrong
    enemyDamageMultiplier: 1.2,     // +20% enemy damage
    rewardMultiplier: 1.5,          // 150% rewards
    wrongCostsAP: true,
    tier2FreeRecall: true,          // Tier 2 = no multiple choice
  },
};
```

#### Logic

In `turnManager.ts`:
- `playCardAction()`: If mode is 'explorer' and answer wrong: apply 50% of card effect (not 0%). Do NOT deduct AP.
- `playCardAction()`: If mode is 'scholar' and answer wrong: fizzle + deal 3 damage to player.
- `endPlayerTurn()`: Enemy damage *= `DIFFICULTY_MODIFIERS[mode].enemyDamageMultiplier`.

In `CardCombatOverlay.svelte`:
- Timer: If mode is 'explorer', no timer shown. Auto-answer never triggers.
- Timer: If mode is 'scholar', subtract `2 * cardTier` seconds from base timer. Minimum 2 seconds.
- Tier 2+ in Scholar: Replace MCQ with text input (free recall). Accept answer if Levenshtein distance ≤ 2 from correct answer (case-insensitive).

In encounter rewards:
- Currency earned *= `DIFFICULTY_MODIFIERS[mode].rewardMultiplier`.

#### UI

**Difficulty Selection** (in settings menu, accessible from main menu):
- Three options presented as cards:
  - Explorer: "No timer. Gentle penalties. -30% enemy damage." Icon: compass
  - Standard: "Dynamic timer. Normal challenge." Icon: sword (selected by default)
  - Scholar: "Harder timer. Self-damage on wrong. +50% rewards." Icon: book with star
- Tap to select, confirmation button below
- Can be changed between runs (not during a run)

### Sub-task 3: Calibration Deep Scan

#### Logic

New `src/services/calibrationScan.ts`:

```typescript
export interface CalibrationResult {
  factId: string;
  correct: boolean;
  responseTimeMs: number;
}

export function runCalibrationScan(
  facts: Fact[],         // 20 random facts from selected domains
  results: CalibrationResult[],
  factStates: Map<string, PlayerFactState>
): Map<string, PlayerFactState> {
  // For each correct answer: bump fact to Tier 2a
  // Set stability = 5, consecutiveCorrect = 3
  // For wrong answers: keep at Tier 1 (no penalty)
  for (const result of results) {
    if (result.correct) {
      const state = factStates.get(result.factId)!;
      state.stability = 5;
      state.consecutiveCorrect = 3;
      // Tier derivation will return '2a' for stability >= 5 + 3 correct
    }
  }
  return factStates;
}
```

#### UI

**Deep Scan Screen** (shown after first run ends, before main menu):
- Header: "Calibration Scan" — 18dp
- Subtext: "Answer 20 quick questions to set your starting level" — 14dp
- "Start Scan" button / "Skip" link
- During scan: one question at a time, no timer, no card frame, just question + answers
- Progress bar: "5/20"
- After scan: "You placed X facts at Recall level!" summary
- "Continue" button → main menu

### Sub-task 4: Hint System

#### Data Model

In `CardRunState` or `TurnState`:
```typescript
hintsRemaining: number;  // Reset to 1 at encounter start (HINTS_PER_ENCOUNTER = 1)
```

Already exists as `hintsRemaining` in `CardRunState`. Verify it resets each encounter.

#### Logic

Three hint types (player chooses one when tapping Hint button):

```typescript
type HintType = 'eliminate' | 'time_boost' | 'first_letter';

function applyHint(type: HintType, quizState: QuizState): QuizState {
  switch (type) {
    case 'eliminate':
      // Remove 1 random wrong answer from displayed options
      // If only 2 options remain (1 correct + 1 wrong after elimination), still show both
      const wrongIndices = quizState.answers
        .map((a, i) => ({ a, i }))
        .filter(x => x.i !== quizState.correctIndex);
      const removeIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)].i;
      quizState.answers[removeIndex].eliminated = true;
      break;
    case 'time_boost':
      // Add 5 seconds to current timer
      quizState.timerRemainingMs += 5000;
      break;
    case 'first_letter':
      // Show first letter of correct answer
      quizState.firstLetterHint = quizState.answers[quizState.correctIndex].text[0];
      break;
  }
  quizState.hintUsed = true;
  return quizState;
}
```

#### UI

Hint button in committed card state (Stage 3):
- Position: below timer bar, left side
- Label: "Hint" with small icon (lightbulb or sparkle)
- Badge: "1" showing remaining hints
- On tap: show hint type picker (3 options in a small popup):
  - "Remove wrong answer" — crossed-out option icon
  - "+5 seconds" — clock icon
  - "First letter" — "A_" icon
- After hint used: button grayed out, badge shows "0"
- Hint picker: 3 buttons in a horizontal row, 48×48dp each, above the Hint button
- Dismiss picker: tap outside or select an option

Hint effects visible:
- Eliminate: wrong answer button fades out (opacity 0.3, strikethrough text)
- Time boost: timer bar jumps +5s, brief green flash on timer
- First letter: small text appears above answers: "Starts with: G"

### System Interactions

- **Commit-before-reveal (AR-01):** Hint button only appears in Stage 3 (committed). Not visible in Stage 1 or 2.
- **Dynamic timer (AR-01):** Time boost adds 5s to the effective timer. Speed bonus recalculates based on original effective timer (time boost does not extend speed bonus window).
- **FSRS (AR-02):** Calibration scan results write directly to PlayerFactState. Correct answers set stability=5, consecutiveCorrect=3.
- **Echo mechanic:** Hints available for echo cards too. Same 1/encounter limit applies.
- **Combo system:** Using a hint does NOT break combo. Combo tracks correct/wrong, not hint usage.
- **Passive relics:** No interaction.
- **Difficulty modes:** Explorer mode has no timer, so "time boost" hint option is hidden. "Eliminate" and "first letter" still available.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| First run, player taps card before tooltip appears | Tooltip still shows (triggered by card draw event). Card tap proceeds normally. |
| Onboarding run, 2 AP, player tries to play 3 cards | 3rd card Cast button disabled. "Not enough AP" shown. |
| Player kills Skip on onboarding | Tooltip sequence continues on next interaction. |
| Deep Scan: player answers all 20 wrong | All facts stay Tier 1. "You'll learn as you play!" message. |
| Deep Scan: player answers all 20 correct | All 20 facts bumped to Tier 2a. "Expert start!" message. |
| Scholar mode, Tier 2 card, free recall | Text input appears instead of MCQ. Accept answer with Levenshtein ≤ 2. |
| Scholar mode, timer -2s per tier, Tier 2b card, Floor 7 | Timer = 7 - (2*2) = 3 seconds. Minimum 2 seconds. |
| Explorer mode, wrong answer | 50% effect applied (e.g., Strike 8 → deals 4 damage). Does NOT cost AP. |
| Hint: eliminate with only 2 answers left (Tier 1, 3 options, 1 eliminated) | Shows 2 remaining: 1 correct + 1 wrong. Valid. |
| Hint: first letter for numeric answer "79" | Shows "Starts with: 7". |
| Hint already used this encounter | Button grayed, badge "0", tap does nothing. |
| Run 2, returning player | No tooltips, full AP, domain selection available. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/services/onboardingController.ts` | Onboarding state machine, tooltip logic, AP override |
| Create | `src/ui/components/DungeonEntrance.svelte` | Title screen with "ENTER THE DEPTHS" button |
| Create | `src/ui/components/ContextualTooltip.svelte` | Positioned tooltip with arrow, auto-dismiss |
| Create | `src/ui/components/DifficultySelector.svelte` | 3 difficulty mode cards |
| Create | `src/ui/components/CalibrationScan.svelte` | 20-question rapid placement test |
| Create | `src/ui/components/HintPicker.svelte` | 3-option hint type popup |
| Create | `src/services/calibrationScan.ts` | Scan logic, fact state updates |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Hint button in Stage 3, difficulty mode timer/penalty, onboarding tooltips |
| Modify | `src/services/turnManager.ts` | Difficulty mode modifiers (explorer 50% effect, scholar self-damage) |
| Modify | `src/services/encounterBridge.ts` | Onboarding AP override, hint state per encounter |
| Modify | `src/services/gameFlowController.ts` | Onboarding flow: entrance → slow reader → combat (no domain select Run 1) |
| Modify | `src/data/balance.ts` | DIFFICULTY_MODIFIERS, HINTS_PER_ENCOUNTER (verify), CALIBRATION_SCAN_COUNT = 20 |
| Modify | `src/services/saveService.ts` | Persist OnboardingState, DifficultyMode, isSlowReader |
| Modify | `src/data/types.ts` | OnboardingState, DifficultyMode, HintType interfaces |

## Done When

- [ ] First-time player sees dungeon entrance → slow reader question → first combat (no domain selection)
- [ ] First 2 encounters have 2 AP; encounter 3+ has 3 AP during onboarding
- [ ] 5 contextual tooltips appear in sequence, each shown once, auto-dismiss after 4s
- [ ] Run 2+ shows domain selection before combat
- [ ] Explorer mode: no timer, wrong = 50% effect (not fizzle), enemies -30% damage
- [ ] Standard mode: dynamic timer, wrong = fizzle (costs 1 AP), normal enemies
- [ ] Scholar mode: timer -2s/tier (min 2s), wrong = fizzle + 3 self-damage, enemies +20%
- [ ] Difficulty can be changed from settings between runs (not during)
- [ ] Calibration Deep Scan: 20 questions after first run, correct → Tier 2a placement
- [ ] Hint button visible in committed stage (Stage 3 only), shows "1" badge
- [ ] Hint picker offers 3 options: eliminate, +5s timer, first letter
- [ ] Hint eliminate: 1 wrong answer fades out (strikethrough, opacity 0.3)
- [ ] Hint timer boost: +5s added, timer bar jumps
- [ ] Hint first letter: "Starts with: X" text appears
- [ ] Hint counter resets to 1 at each encounter start
- [ ] Explorer mode hides "time boost" hint option (no timer to boost)
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
