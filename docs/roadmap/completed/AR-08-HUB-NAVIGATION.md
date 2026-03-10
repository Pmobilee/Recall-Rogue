# AR-08: Hub Navigation & Feature Discovery
> Phase: Post-Launch — Player Experience
> Priority: HIGH
> Depends on: AR-01 (Combat Integrity), AR-02 (FSRS), AR-03 (Domains + Lore), AR-04 (Onboarding)
> Estimated scope: M

Players currently start the game and see only a "Start Run" button. Many rich features already built (Knowledge Library, Settings, Profile, Parental Controls, Leaderboards) are hidden and unreachable. This phase creates a main hub/home screen with navigation to all features, making the game feel complete and discoverable.

## Design Reference

From GAME_DESIGN.md Section 5 (Main Menu Structure):

> Home Hub: Daily streak display, last run summary, navigation to all features (Start Run, Knowledge Library, Settings, Profile). Accessible at any time. Persistent navigation bar at bottom.

From GAME_DESIGN.md Section 6 (Streak System):

> Daily streak counter increments when player completes at least 1 encounter on a calendar day. Shown prominently on home screen. Frozen at midnight UTC.

From GAME_DESIGN.md Section 8 (Knowledge Library):

> Browsable list of all facts by domain. Sort by mastery tier, difficulty, or recent. Search by keyword. Tap a fact to see question, answers, and player's current mastery level.

From GAME_DESIGN.md Section 9 (Adventurer's Journal):

> Post-run summary screen with stats: floor reached, enemies defeated, facts learned, gold earned, cards collected. Share button (Wordle-style image).

## Implementation

### Sub-task 1: Hub Navigation Architecture

#### Data Model

```typescript
// In playerProfile
interface PlayerProfile {
  // ... existing fields
  currentScreen: 'hub' | 'run' | 'library' | 'settings' | 'profile' | 'journal';
  lastRunSummary?: RunSummary;  // Populated after run ends
  dailyStreak: number;
  streakFrozenAt?: number;  // ISO timestamp of midnight UTC when streak was last counted
}

interface RunSummary {
  floorReached: number;
  enemiesDefeated: number;
  factsLearned: number;
  goldEarned: number;
  cardsCollected: number;
  runDate: string;  // ISO date
  primaryDomain: string;
  secondaryDomain: string;
  timedOutCombats: number;
}
```

#### Navigation Logic

New `src/services/screenController.ts`:

```typescript
export type ScreenName = 'hub' | 'run' | 'library' | 'settings' | 'profile' | 'journal';

interface ScreenState {
  currentScreen: ScreenName;
  previousScreen?: ScreenName;
}

export function navigateToScreen(target: ScreenName, profile: PlayerProfile): PlayerProfile {
  // Can always navigate from any screen to hub
  // From hub, can navigate to any feature
  // From run, cannot navigate away (run is modal)
  if (profile.currentScreen === 'run' && target !== 'run') {
    return profile;  // No-op
  }
  return { ...profile, currentScreen: target };
}

export function isScreenAccessible(screen: ScreenName, profile: PlayerProfile): boolean {
  // All screens accessible from hub
  // Run is special: can only exit via completion or forfeit
  if (profile.currentScreen === 'hub') return true;
  if (profile.currentScreen === 'run') return screen === 'run';
  return true;  // From other screens, can go to hub
}
```

### Sub-task 2: Hub Screen UI

#### Layout

New component `src/ui/screens/HubScreen.svelte`:

- Full-screen portrait layout
- Top: Title "RECALL ROGUE" (24dp, pixel font)
- Top section (40% height): Daily streak widget + last run summary card
  - Streak: "🔥 {dailyStreak} DAY STREAK" (18dp, gold text, centered)
  - Last run card: "{floorReached}F | {enemiesDefeated} Foes | {goldEarned} Gold" (14dp, semi-transparent dark bg, 8dp padding)
  - "View Summary" button (small, right-aligned)
- Middle section (20% height): Primary action (Start Run button, large, gold border)
- Bottom section (40% height): Navigation buttons (5 equal grid: Library, Settings, Profile, Leaderboards*, Journal*)
  - Each button: 72×96dp, icon + label, tap to navigate
  - Icons: 🏃 Start, 📖 Library, ⚙️ Settings, 👤 Profile, 🏆 Leaderboards, 📜 Journal

#### Streak Logic

```typescript
export function calculateDailyStreak(
  runHistory: RunRecord[],
  currentDate: string  // ISO date
): number {
  // Sort by date descending
  const sorted = [...runHistory].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let streak = 0;
  let checkDate = new Date(currentDate);

  for (const run of sorted) {
    const runDate = new Date(run.date);

    // Check if run is from expected day
    if (isSameDay(runDate, checkDate)) {
      streak++;
      // Move back one day
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    } else if (runDate < checkDate) {
      // Gap in streak
      break;
    }
  }

  return streak;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getUTCFullYear() === d2.getUTCFullYear() &&
         d1.getUTCMonth() === d2.getUTCMonth() &&
         d1.getUTCDate() === d2.getUTCDate();
}
```

Freeze streak at midnight UTC each day:
- On app launch, check if current UTC date > `streakFrozenAt`
- If so, call `calculateDailyStreak()` and store result
- Set `streakFrozenAt = currentUTCDate`
- Streak locked for that 24h period; can only increment again after next midnight

### Sub-task 3: Navigation Bar / Tab System

Bottom persistent nav bar with 5 tabs:

```svelte
<!-- src/ui/components/HubNavBar.svelte -->
<div class="nav-bar">
  <button on:click={() => navigateTo('run')} class:active={current === 'run'}>
    <icon>🏃</icon>
    <label>Start</label>
  </button>
  <button on:click={() => navigateTo('library')} class:active={current === 'library'}>
    <icon>📖</icon>
    <label>Library</label>
  </button>
  <button on:click={() => navigateTo('settings')} class:active={current === 'settings'}>
    <icon>⚙️</icon>
    <label>Settings</label>
  </button>
  <button on:click={() => navigateTo('profile')} class:active={current === 'profile'}>
    <icon>👤</icon>
    <label>Profile</label>
  </button>
  <button on:click={() => navigateTo('journal')} class:active={current === 'journal'}>
    <icon>📜</icon>
    <label>Journal</label>
  </button>
</div>

<style>
  .nav-bar {
    position: fixed;
    bottom: env(safe-area-inset-bottom);
    left: 0;
    right: 0;
    height: 64dp;
    display: flex;
    justify-content: space-around;
    background: rgba(0, 0, 0, 0.8);
    border-top: 1px solid #888;
  }

  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4dp;
    min-width: 48dp;
    touch-action: manipulation;
  }

  button.active {
    background: rgba(200, 160, 0, 0.2);
    border-top: 3px solid gold;
  }

  icon {
    font-size: 20dp;
  }

  label {
    font-size: 12dp;
    color: #ccc;
  }

  button.active label {
    color: gold;
  }
</style>
```

### Sub-task 4: Wire Up Existing Components

These components already exist in codebase but are not navigable. Ensure they render correctly from hub:

1. **KnowledgeLibrary** (`src/ui/screens/KnowledgeLibrary.svelte`)
   - Modify to add back button to hub
   - Verify domain list displays
   - Verify fact list loads and filters work
   - Ensure nav bar is visible alongside component

2. **Settings** (`src/ui/components/SettingsMenu.svelte`)
   - If modal, convert to full screen
   - Add back button to hub
   - Ensure nav bar visible

3. **ParentalControls** (`src/ui/components/ParentalControls.svelte`)
   - Accessible from Settings
   - Add back button

4. **Profile** (create new or use existing `src/ui/screens/Profile.svelte`)
   - Show player name (placeholder until auth)
   - Show total facts learned
   - Show total runs completed
   - Show all-time best floor
   - Show achievements/milestones unlocked
   - Add back button to hub

5. **Leaderboards** (create new stub `src/ui/screens/Leaderboards.svelte`)
   - Will be populated in AR-12 (cloud save)
   - For now: static list of top 10 players (mocked)
   - Show player rank, streak, gold, floor record
   - Add back button to hub

6. **Journal** (create or use existing `src/ui/screens/AdventurersJournal.svelte`)
   - Post-run summary screen
   - Stats: floor, foes, gold, cards, facts
   - Share button (image generation)

### Sub-task 5: Last Run Summary Widget

After run completes:

1. Capture stats into `RunSummary`:
   ```typescript
   function captureRunSummary(runState: CardRunState, floorReached: number): RunSummary {
     return {
       floorReached,
       enemiesDefeated: runState.encountersCompleted,
       factsLearned: runState.correctAnswersThisRun,
       goldEarned: runState.currencyGained,
       cardsCollected: runState.cardsCollected.length,
       runDate: new Date().toISOString(),
       primaryDomain: runState.primaryDomain,
       secondaryDomain: runState.secondaryDomain,
       timedOutCombats: runState.timedOutCombats || 0,
     };
   }
   ```

2. Store in `playerProfile.lastRunSummary`

3. Display on hub in a card widget:
   ```
   ┌────────────────────────┐
   │ Last Run: Mar 09       │
   │ 🗻 Floor 5 • ⚔️ 8 Foes │
   │ 💰 420 Gold • 📚 12 Facts
   │ [View Summary →]       │
   └────────────────────────┘
   ```

4. "View Summary" button navigates to Journal screen with detailed post-run stats

### Sub-task 6: Run Start Flow from Hub

Current: "Start Run" button directly launches combat.

New: "Start Run" button from hub navigates to DomainSelection screen (if run 2+) or starts combat (if run 1, onboarding).

```typescript
export function handleStartRunClick(profile: PlayerProfile): ScreenName {
  const runsCompleted = profile.runsCompleted || 0;

  if (runsCompleted === 0) {
    // First run: skip domain selection, auto-assign domains
    return 'run';
  } else {
    // Subsequent runs: show domain selection first
    return 'domain-selection';  // New intermediate screen
  }
}
```

#### Domain Selection Screen

New component `src/ui/screens/DomainSelection.svelte`:

- Header: "Choose Your Path"
- Two sections: Primary Domain, Secondary Domain
- Each section: 4 buttons showing domain name + icon + description (2 rows × 2 cols)
- Tap to select
- "Begin Descent" button at bottom (disabled until both selected)
- Transitions to run start on click

### Sub-task 7: App Entry Point

Modify `src/App.svelte` or top-level layout:

```svelte
<script>
  import HubScreen from './ui/screens/HubScreen.svelte';
  import CombatScene from './ui/components/CombatScene.svelte';
  import KnowledgeLibrary from './ui/screens/KnowledgeLibrary.svelte';
  import SettingsMenu from './ui/components/SettingsMenu.svelte';
  import ProfileScreen from './ui/screens/Profile.svelte';
  import LeaderboardsScreen from './ui/screens/Leaderboards.svelte';
  import JournalScreen from './ui/screens/AdventurersJournal.svelte';
  import DomainSelection from './ui/screens/DomainSelection.svelte';

  let profile = getPlayerProfile();

  $: currentScreen = profile.currentScreen ?? 'hub';
</script>

{#if currentScreen === 'hub'}
  <HubScreen {profile} />
{:else if currentScreen === 'run'}
  <CombatScene />
{:else if currentScreen === 'library'}
  <KnowledgeLibrary />
{:else if currentScreen === 'settings'}
  <SettingsMenu />
{:else if currentScreen === 'profile'}
  <ProfileScreen />
{:else if currentScreen === 'leaderboards'}
  <LeaderboardsScreen />
{:else if currentScreen === 'journal'}
  <JournalScreen />
{/if}

<!-- Persistent nav bar visible on all screens except run -->
{#if currentScreen !== 'run'}
  <HubNavBar current={currentScreen} />
{/if}
```

## System Interactions

- **Onboarding (AR-04):** First run auto-starts (no hub). After first run ends, hub becomes home.
- **Streak System:** Daily streak calculated on hub load. Used in analytics and UI.
- **Run Completion:** Triggers `lastRunSummary` capture and navigation to hub.
- **Screen State Persistence:** Save `currentScreen` in profile so player resumes on correct tab.
- **Navigation:** From run, no navigation possible (run is modal). From any feature, nav bar allows jump to any other feature via hub first (or direct in future).
- **Knowledge Library:** Re-uses existing component, just makes it navigable.
- **Settings/Profile:** Accessible from hub; not modal overlays.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| First app launch | Hub shows, no last run card, streak = 0 |
| Player completes run at 11:58 PM UTC, then app used again at 12:02 AM UTC | Streak increments (current day counted) and freezes. New streak counter starts for next day. |
| Player views hub, then immediately starts run without selecting domains (run 2+) | Domain selection screen shown first. Cannot skip. |
| Player navigates: hub → library → settings → profile → back buttons | Back button returns to previous screen in stack (or hub). Eventually can reach hub. |
| Navigation bar visible in run (Phaser scene) | Nav bar hidden during active combat. Visible only on non-run screens. |
| Screen name in profile is corrupted/invalid | Fallback to 'hub' on app start. |
| Player taps Start Run while a run is already in progress | Current run continues (no-op). |
| Window resize during hub display (desktop testing) | Layout responsive, nav bar adapts to screen size. |
| Tap nav bar while screen is transitioning | Queued navigation handled gracefully. No double-tap issues. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/services/screenController.ts` | Navigation logic, screen access control |
| Create | `src/ui/screens/HubScreen.svelte` | Main home screen with widgets and nav |
| Create | `src/ui/components/HubNavBar.svelte` | Bottom persistent navigation bar (5 tabs) |
| Create | `src/ui/screens/DomainSelection.svelte` | Domain picker for run 2+ |
| Create | `src/ui/screens/Profile.svelte` | Player profile screen (stats, milestones) |
| Create | `src/ui/screens/Leaderboards.svelte` | Leaderboards (mocked data for now) |
| Modify | `src/ui/screens/KnowledgeLibrary.svelte` | Add back button, ensure nav bar visible |
| Modify | `src/ui/screens/AdventurersJournal.svelte` | Wire up post-run summary, share button |
| Modify | `src/ui/components/SettingsMenu.svelte` | Convert to full-screen if modal, add back button |
| Modify | `src/ui/components/ParentalControls.svelte` | Add back button |
| Modify | `src/App.svelte` or top-level layout | Screen routing, nav bar conditional rendering |
| Modify | `src/services/turnManager.ts` or `src/services/gameFlowController.ts` | Capture RunSummary on run completion |
| Modify | `src/data/types.ts` | Add RunSummary, ScreenName types |
| Modify | `src/services/saveService.ts` | Persist currentScreen, lastRunSummary, dailyStreak |

## Done When

- [ ] Hub screen loads with title, streak widget, last run summary card, Start button
- [ ] Streak counter displays correctly and updates after each day
- [ ] Daily streak freezes at midnight UTC; new day increments it again
- [ ] Start Run button navigates to domain selection (run 2+) or direct combat (run 1)
- [ ] Bottom nav bar displays 5 tabs: Start, Library, Settings, Profile, Journal
- [ ] Tapping nav tabs switches between screens smoothly
- [ ] Nav bar hidden during active run (Phaser scene)
- [ ] Knowledge Library accessible via nav, shows fact list, domain list, search
- [ ] Settings accessible via nav, shows difficulty mode, text size, accessibility options
- [ ] Profile screen shows: player stats, total facts learned, all-time best floor, milestones
- [ ] Leaderboards screen shows (mocked top 10 players for now)
- [ ] Journal screen shows post-run summary stats: floor, foes, gold, cards, facts
- [ ] Last run summary captures all stats and displays as card on hub
- [ ] Back buttons work from all feature screens, return to hub
- [ ] Domain selection requires both primary and secondary before "Begin Descent"
- [ ] Run completion auto-navigates to hub and updates lastRunSummary
- [ ] Screen state persists across app close/reopen
- [ ] Navigation edge cases handled: invalid screen name → hub, run modal blocks nav
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
