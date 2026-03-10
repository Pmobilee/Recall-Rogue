# AR-05: Sound + Engagement Loops
> Phase: Pre-Launch — Retention
> Priority: MEDIUM
> Depends on: AR-04 (Onboarding + Difficulty Modes)
> Estimated scope: L

Add core sound effects for all combat interactions, implement the Adventurer's Journal post-run summary with share functionality, add bounty quest system for per-run objectives, implement daily login streak tracking, and build the invisible canary adaptive difficulty system.

## Design Reference

From GAME_DESIGN.md Section 17 (Game Juice — Correct Answer):

> | # | Element | Detail |
> |---|---------|--------|
> | 6 | Sound | Crisp impact (Wordle ding x fighting game punch) |

From GAME_DESIGN.md Section 17 (Wrong Answer):

> | 4 | Sound | Soft low tone (not a buzzer) |

From GAME_DESIGN.md Section 18 (Sound Design P1):

> P1 sounds: Correct impact, wrong tone, draw swoosh, enemy hit/death, turn chime

From GAME_DESIGN.md Section 25 (Adventurer's Journal):

> Post-run summary: Depth reached, facts answered, accuracy, best combo, new facts learned, facts mastered. Share button generates Wordle-style card image.

From GAME_DESIGN.md Section 13b (Bounty Quests):

> 1-2 randomly selected per run. Examples:
> - "Answer 5 Science facts correctly" → +1 card reward
> - "Complete 3 encounters without wrong answers" → Rare relic
> - "Reach Floor 6" → 50% extra currency
> - "Answer 10 facts in under 3 seconds each" → Card upgrade token
> - "Perfect turn (3/3 correct) at least once" → Cosmetic card frame

From GAME_DESIGN.md Section 13 (Streaks):

> Daily completion; 7d→card frame, 30d→rare relic, 100d→exclusive cosmetic, 365d→legendary. 1 freeze/week.

From GAME_DESIGN.md Section 21 (Canary System):

> 3+ wrong/floor: -2s timer, easier facts, -15% enemy dmg, hint more prominent
> 5+ correct streak: tighter speed bonus, harder facts, elite variants
> Invisible. Never announced. Never reduces educational rigor.

## Implementation

### Sub-task 1: Core Sound Effects

#### Assets Required

Create/source 8 sound effects as `.mp3` or `.ogg` files (prefer `.ogg` for smaller size, `.mp3` fallback):

| Sound | File | Duration | Character |
|-------|------|----------|-----------|
| Correct answer | `correct-impact.ogg` | 300-500ms | Bright, satisfying ding + subtle punch. Think Wordle correct × fighting game light hit. Rising tone. |
| Wrong answer | `wrong-tone.ogg` | 400-600ms | Soft, low, gentle. NOT a buzzer. Descending minor tone. Muted. |
| Card draw | `card-draw.ogg` | 200-300ms | Quick swoosh/slide sound. Paper on felt. |
| Enemy hit | `enemy-hit.ogg` | 200-300ms | Impact thud. Meatier than correct ding. |
| Enemy death | `enemy-death.ogg` | 500-800ms | Crumble/dissolve sound. Satisfying but not violent. |
| Turn start chime | `turn-chime.ogg` | 300-400ms | Subtle bell or crystal tone. Signals "your turn." |
| Combo milestone | `combo-hit.ogg` | 400-600ms | Escalating sparkle/power-up. Layered with pitch shift at higher combos. |
| Card cast commit | `card-cast.ogg` | 200-300ms | Lock/seal sound. Conveys irrevocability. |

#### Audio Manager Refactor

Current `AudioManager.ts` is mining-era biome audio. Adapt for card roguelite:

```typescript
// In src/services/audioManager.ts (new file, or refactor existing)

export class CardAudioManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private sfxVolume: number = 1.0;  // 0-1
  private musicVolume: number = 0.5;  // 0-1
  private sfxEnabled: boolean = true;
  private musicEnabled: boolean = true;

  async init(): Promise<void> {
    this.audioContext = new AudioContext();
    await this.preloadSounds([
      'correct-impact', 'wrong-tone', 'card-draw', 'enemy-hit',
      'enemy-death', 'turn-chime', 'combo-hit', 'card-cast'
    ]);
  }

  play(soundId: string, options?: { volume?: number; pitch?: number }): void {
    if (!this.sfxEnabled || !this.audioContext) return;
    const buffer = this.sounds.get(soundId);
    if (!buffer) return;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.sfxVolume * (options?.volume ?? 1.0);
    if (options?.pitch) source.playbackRate.value = options.pitch;
    source.connect(gainNode).connect(this.audioContext.destination);
    source.start();
  }

  playCombo(comboLevel: number): void {
    // Pitch increases with combo: 1.0, 1.1, 1.2, 1.3, 1.5
    const pitch = [1.0, 1.1, 1.2, 1.3, 1.5][Math.min(comboLevel, 4)];
    this.play('combo-hit', { pitch });
  }

  setSFXVolume(v: number): void { this.sfxVolume = Math.max(0, Math.min(1, v)); }
  setMusicVolume(v: number): void { this.musicVolume = Math.max(0, Math.min(1, v)); }
  toggleSFX(enabled: boolean): void { this.sfxEnabled = enabled; }
  toggleMusic(enabled: boolean): void { this.musicEnabled = enabled; }
}
```

#### Integration Points

Wire sound triggers in `CardCombatOverlay.svelte` and `encounterBridge.ts`:

- Card drawn (hand dealt): `play('card-draw')` — called 5 times with 100ms stagger
- Card committed (Cast button tap): `play('card-cast')`
- Correct answer: `play('correct-impact')`
- Wrong answer: `play('wrong-tone')`
- Combo milestone (3+): `playCombo(comboLevel)`
- Turn start (after enemy turn resolves): `play('turn-chime')`
- Enemy hit (damage dealt): `play('enemy-hit')`
- Enemy death: `play('enemy-death')`

#### Settings UI

Add to settings/options menu:
- SFX Volume slider: 0-100%, default 100%
- Music Volume slider: 0-100%, default 50%
- SFX toggle: on/off
- Music toggle: on/off
- Note: Haptics are independent of sound (controlled separately via Capacitor)

### Sub-task 2: Adventurer's Journal (Post-Run Summary)

#### Data Model

```typescript
interface RunSummary {
  depthReached: number;         // Highest floor
  totalFactsAnswered: number;
  correctAnswers: number;
  accuracy: number;             // 0-100 percentage
  bestCombo: number;            // Highest combo multiplier tier reached
  newFactsLearned: number;      // Facts that went from 'new' to 'learning'
  factsMastered: number;        // Facts that reached Tier 3 this run
  totalCurrency: number;        // Dust earned
  bountyCompleted: string[];    // IDs of completed bounties
  runDurationMs: number;        // Total run time
  encountersWon: number;
  encountersTotal: number;
}
```

Collect during run in `encounterBridge.ts` — increment counters on each card play/encounter result.

#### UI — `RunSummary.svelte`

```
┌──────────────────────────┐
│   EXPEDITION COMPLETE    │
│                          │
│  Depth Reached: 6/9      │
│  Facts Answered: 42      │
│  Accuracy: 81%           │
│  Best Combo: 4x (1.5x)  │
│  New Facts Learned: 7    │
│  Facts Mastered: 2 ↑     │
│  Dust Earned: 340        │
│                          │
│  ★ Bounty: Arcane Surge ✓│
│                          │
│  [Share]    [Play Again]  │
│         [Home]            │
└──────────────────────────┘
```

- Full screen, pixel font, dark background with subtle particle effect
- Stats animate in one by one (200ms stagger)
- Accuracy ≥90%: gold text. 70-89%: white. <70%: dim gray.
- Mastered facts count: green with ↑ arrow
- Bounty completed: gold star, bounty name, check mark

#### Share Image Generation

On "Share" tap:
- Generate a canvas-based image (400×600px):
  ```
  ┌─────────────────────────┐
  │    RECALL ROGUE         │
  │                          │
  │    Depth: ██████░░░ 6/9  │
  │    Accuracy: ████████ 81%│
  │    Combo: ★★★★☆  4x     │
  │    Mastered: 2 facts     │
  │                          │
  │    How deep can you go?  │
  └─────────────────────────┘
  ```
- Use `HTMLCanvasElement.toDataURL('image/png')` to generate image
- On mobile (Capacitor): use `@capacitor/share` to trigger native share sheet
- On web: use Web Share API if available, else download as PNG
- No personal data in share image (no username, no specific facts)

### Sub-task 3: Bounty Quest System

#### Data Model

```typescript
interface BountyTemplate {
  id: string;
  name: string;
  description: string;        // "Answer 5 Science facts correctly"
  condition: BountyCondition;
  reward: BountyReward;
}

type BountyCondition =
  | { type: 'domain_correct'; domain: FactDomain; count: number }
  | { type: 'flawless_encounters'; count: number }
  | { type: 'reach_floor'; floor: number }
  | { type: 'speed_answers'; count: number; maxTimeMs: number }
  | { type: 'perfect_turn'; count: number }
  | { type: 'different_domains'; count: number }
  | { type: 'total_correct'; count: number }
  | { type: 'combo_reach'; level: number };

type BountyReward =
  | { type: 'extra_card_reward' }
  | { type: 'currency_multiplier'; multiplier: number }
  | { type: 'card_upgrade' }
  | { type: 'cosmetic'; cosmeticId: string };

interface ActiveBounty {
  template: BountyTemplate;
  progress: number;       // Current count toward condition
  target: number;         // Total needed
  completed: boolean;
}
```

#### Bounty Template Pool (12 templates)

```typescript
const BOUNTY_TEMPLATES: BountyTemplate[] = [
  { id: 'arcane_surge', name: 'Arcane Surge', description: 'Answer 5 Science facts correctly', condition: { type: 'domain_correct', domain: 'science', count: 5 }, reward: { type: 'extra_card_reward' } },
  { id: 'history_buff', name: 'History Buff', description: 'Answer 5 History facts correctly', condition: { type: 'domain_correct', domain: 'history', count: 5 }, reward: { type: 'extra_card_reward' } },
  { id: 'flawless_descent', name: 'Flawless Descent', description: 'Win 3 encounters without wrong answers', condition: { type: 'flawless_encounters', count: 3 }, reward: { type: 'currency_multiplier', multiplier: 1.5 } },
  { id: 'deep_delve', name: 'Deep Delve', description: 'Reach Floor 6', condition: { type: 'reach_floor', floor: 6 }, reward: { type: 'currency_multiplier', multiplier: 1.5 } },
  { id: 'speed_caster', name: 'Speed Caster', description: 'Answer 10 facts in under 3 seconds', condition: { type: 'speed_answers', count: 10, maxTimeMs: 3000 }, reward: { type: 'card_upgrade' } },
  { id: 'perfect_form', name: 'Perfect Form', description: 'Get a perfect turn (3/3 correct)', condition: { type: 'perfect_turn', count: 1 }, reward: { type: 'cosmetic', cosmeticId: 'frame_perfect' } },
  { id: 'polymath', name: 'Polymath', description: 'Play cards from 4 different domains', condition: { type: 'different_domains', count: 4 }, reward: { type: 'extra_card_reward' } },
  { id: 'knowledge_seeker', name: 'Knowledge Seeker', description: 'Answer 20 facts correctly', condition: { type: 'total_correct', count: 20 }, reward: { type: 'currency_multiplier', multiplier: 1.3 } },
  { id: 'combo_master', name: 'Combo Master', description: 'Reach a 4x combo', condition: { type: 'combo_reach', level: 4 }, reward: { type: 'card_upgrade' } },
  { id: 'deep_explorer', name: 'Deep Explorer', description: 'Reach Floor 9', condition: { type: 'reach_floor', floor: 9 }, reward: { type: 'currency_multiplier', multiplier: 2.0 } },
  { id: 'geography_ace', name: 'Geography Ace', description: 'Answer 5 Geography facts correctly', condition: { type: 'domain_correct', domain: 'geography', count: 5 }, reward: { type: 'extra_card_reward' } },
  { id: 'quick_thinker', name: 'Quick Thinker', description: 'Answer 5 facts in under 2 seconds', condition: { type: 'speed_answers', count: 5, maxTimeMs: 2000 }, reward: { type: 'card_upgrade' } },
];
```

#### Logic

In `src/services/bountyManager.ts`:

```typescript
export function selectBounties(templates: BountyTemplate[], count: number): ActiveBounty[] {
  // Randomly select 'count' (1-2) bounties from pool
  // Exclude bounties that require domains not in the player's run pool
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(t => ({
    template: t,
    progress: 0,
    target: getTarget(t.condition),
    completed: false,
  }));
}

export function updateBountyProgress(bounties: ActiveBounty[], event: BountyEvent): ActiveBounty[] {
  // Check each bounty condition against the event
  // Increment progress if condition matches
  // Mark completed if progress >= target
  return bounties.map(b => {
    if (b.completed) return b;
    const newProgress = checkCondition(b.template.condition, event, b.progress);
    return { ...b, progress: newProgress, completed: newProgress >= b.target };
  });
}
```

Bounty events fired from `encounterBridge.ts`:
- `{ type: 'card_correct', domain, responseTimeMs }` — after correct answer
- `{ type: 'encounter_won', flawless: boolean }` — after victory (flawless = 0 wrong)
- `{ type: 'floor_reached', floor }` — on floor start
- `{ type: 'perfect_turn' }` — when 3/3 correct
- `{ type: 'combo_reached', level }` — when combo hits new tier

#### UI

Bounty display during run:
- Small bounty tracker in top-right of combat overlay: "⚔ 3/5 Science" (abbreviated)
- Tap to expand and see full bounty details
- On completion: brief gold flash + "Bounty Complete!" text (2s)
- On run summary: completed bounties shown with gold star

Bounty selection at run start:
- Shown briefly after domain selection: "Today's Bounties:" + 1-2 bounty cards
- Auto-dismiss after 3s or on tap
- Bounties cannot be rerolled

### Sub-task 4: Daily Login Streak

#### Data Model

```typescript
interface StreakState {
  currentStreak: number;          // Consecutive days
  longestStreak: number;
  lastCompletionDate: string;     // YYYY-MM-DD
  freezesUsedThisWeek: number;    // Max 1/week
  lastFreezeDate: string | null;
  milestonesReached: number[];    // [7, 30, 100, 365]
}
```

#### Logic

In `src/services/streakManager.ts`:

```typescript
export function updateStreak(state: StreakState, today: string): StreakState {
  if (state.lastCompletionDate === today) return state;  // Already counted today

  const yesterday = getYesterday(today);
  if (state.lastCompletionDate === yesterday) {
    // Consecutive day
    return { ...state, currentStreak: state.currentStreak + 1, lastCompletionDate: today, longestStreak: Math.max(state.longestStreak, state.currentStreak + 1) };
  }

  const dayBefore = getYesterday(yesterday);
  if (state.lastCompletionDate === dayBefore && state.freezesUsedThisWeek < 1) {
    // Missed yesterday, use freeze
    return { ...state, currentStreak: state.currentStreak + 1, lastCompletionDate: today, freezesUsedThisWeek: state.freezesUsedThisWeek + 1, lastFreezeDate: yesterday, longestStreak: Math.max(state.longestStreak, state.currentStreak + 1) };
  }

  // Streak broken
  return { ...state, currentStreak: 1, lastCompletionDate: today };
}

export function getStreakReward(streak: number): string | null {
  if (streak === 7) return 'Card frame: 7-day streak';
  if (streak === 30) return 'Rare relic unlock';
  if (streak === 100) return 'Exclusive cosmetic';
  if (streak === 365) return 'Legendary frame';
  return null;
}
```

"Completion" = finishing at least 1 run (any length, even retreat after 1 encounter).

#### UI

- Main menu: streak counter badge "🔥 12" (flame + number)
- On milestone: full-screen celebration overlay, reward description, "Claim" button
- Streak freeze: auto-applied, subtle notification "Streak saved! (1 freeze used this week)"
- Weekly freeze reset: every Monday at midnight local time

### Sub-task 5: Canary System (Invisible Adaptive Difficulty)

#### Data Model

```typescript
interface CanaryState {
  wrongThisFloor: number;
  correctStreak: number;
  adjustmentLevel: number;  // -2 to +2. Negative = easier. Positive = harder.
}
```

#### Logic

In `src/services/canarySystem.ts`:

```typescript
export function updateCanary(state: CanaryState, correct: boolean): CanaryState {
  const newState = { ...state };

  if (correct) {
    newState.correctStreak++;
    newState.wrongThisFloor = Math.max(0, newState.wrongThisFloor);
    if (newState.correctStreak >= 5) {
      newState.adjustmentLevel = Math.min(2, newState.adjustmentLevel + 1);
      newState.correctStreak = 0;  // Reset after adjustment
    }
  } else {
    newState.correctStreak = 0;
    newState.wrongThisFloor++;
    if (newState.wrongThisFloor >= 3) {
      newState.adjustmentLevel = Math.max(-2, newState.adjustmentLevel - 1);
    }
  }

  return newState;
}

export function resetFloor(state: CanaryState): CanaryState {
  return { ...state, wrongThisFloor: 0 };
}

export function getCanaryModifiers(level: number) {
  return {
    timerBonus: level < 0 ? Math.abs(level) * 1 : 0,  // +1s per negative level
    enemyDamageMultiplier: level < 0 ? 1 - (Math.abs(level) * 0.075) : 1 + (level * 0.05),
    // level -2: enemy dmg 0.85x, level -1: 0.925x, level 0: 1.0x, level +1: 1.05x, level +2: 1.1x
    factDifficultyBias: level,  // Negative = prefer easier facts, positive = prefer harder
    // Never changes: answer count, question format, educational rigor
  };
}
```

#### Integration

- Timer: `effectiveTimer += canaryModifiers.timerBonus`
- Enemy damage in `turnManager.ts`: `damage *= canaryModifiers.enemyDamageMultiplier`
- Fact selection in `runPoolBuilder.ts` (for encounter-level selection): bias toward easier/harder facts based on `factDifficultyBias`
- NEVER modify: answer count, question format, timer removal, tier requirements
- NEVER announce to player. No UI. No notifications. Purely invisible.
- Reset `wrongThisFloor` at each new floor in `floorManager.ts`

### System Interactions

- **Combo system:** Combo sounds layer with correct/wrong sounds. Combo hit plays AFTER correct impact (100ms delay).
- **Difficulty modes:** Canary modifiers stack with difficulty mode modifiers. Explorer -30% enemy dmg + canary -15% = -45% total at adjustment level -2.
- **FSRS:** Bounty progress uses domain from fact, not card type.
- **Onboarding:** Bounties not shown during Run 1 (onboarding). Streak starts counting from Run 1.
- **Timer (AR-01):** Canary timer bonus adds to effective timer after word bonus + slow reader bonus.
- **Echo mechanic:** Echo cards count toward bounty progress (domain_correct, speed_answers, etc.).
- **Passive relics:** No interaction with sound or bounties.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| AudioContext blocked by browser autoplay | Defer init to first user tap. Queue sounds until context ready. |
| Share on web without Web Share API | Download PNG instead. No error. |
| Player completes bounty on final encounter before defeat | Bounty still counts as completed. Reward in summary. |
| All 12 bounty templates require unavailable domains | Skip bounty selection. Show "No bounties available" in summary. |
| Streak freeze: missed 2 days | Streak resets. Only 1 freeze covers 1 missed day. |
| Canary: player goes 3 wrong on floor, then 5 correct | Level goes to -1, then back to 0. Net neutral. |
| Canary level at -2, player still struggling | Stays at -2 (capped). Does not go below. |
| Sound plays during background tab | AudioContext suspends automatically. No action needed. |
| Bounty "4 different domains" but pool only has 2 domains | Bounty impossible to complete this run. OK — not all bounties are achievable every run. |
| Run summary for retreat (0 encounters) | All stats show 0. Still counts as daily completion for streak. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/services/cardAudioManager.ts` | Sound effect system for card roguelite |
| Create | `src/assets/audio/` | 8 sound effect files (.ogg) |
| Create | `src/ui/components/RunSummary.svelte` | Post-run Adventurer's Journal with share |
| Create | `src/services/bountyManager.ts` | Bounty template pool, selection, progress tracking |
| Create | `src/services/streakManager.ts` | Daily streak tracking, freeze, milestones |
| Create | `src/services/canarySystem.ts` | Invisible adaptive difficulty |
| Create | `src/ui/components/BountyTracker.svelte` | In-combat bounty progress display |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Sound triggers on card play, bounty tracker |
| Modify | `src/services/encounterBridge.ts` | Fire bounty events, canary updates, run summary collection |
| Modify | `src/services/turnManager.ts` | Canary enemy damage modifier |
| Modify | `src/services/gameFlowController.ts` | Run summary screen, bounty selection at run start, streak update on run end |
| Modify | `src/data/balance.ts` | BOUNTY_TEMPLATES, STREAK_MILESTONES, CANARY thresholds |
| Modify | `src/services/saveService.ts` | Persist StreakState, audio settings |
| Modify | `src/data/types.ts` | RunSummary, BountyTemplate, ActiveBounty, StreakState, CanaryState interfaces |

## Done When

- [ ] 8 sound effects play at correct moments (correct, wrong, draw, enemy hit, death, turn chime, combo, cast)
- [ ] SFX and music volume sliders in settings (0-100%), with toggle on/off
- [ ] Combo sound pitch increases with combo level (1.0→1.1→1.2→1.3→1.5)
- [ ] Post-run summary shows: depth, facts answered, accuracy, best combo, new facts, mastered, dust, bounties
- [ ] Stats animate in with 200ms stagger
- [ ] Share button generates Wordle-style PNG image (400×600) with no personal data
- [ ] Share uses native share sheet on Capacitor, Web Share API or PNG download on web
- [ ] 1-2 bounties randomly selected at run start (not during onboarding Run 1)
- [ ] Bounty progress tracked live during run (visible as small tracker)
- [ ] Bounty completion triggers gold flash notification
- [ ] Daily streak increments on run completion, resets after 2+ missed days
- [ ] 1 streak freeze per week (auto-applied for 1 missed day)
- [ ] Streak milestones at 7/30/100/365 days with celebration overlay
- [ ] Canary: 3+ wrong/floor reduces enemy damage by 7.5% per level (max -15%)
- [ ] Canary: 5+ correct streak increases enemy damage by 5% per level (max +10%)
- [ ] Canary is invisible — no UI, no notifications, no educational rigor changes
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
