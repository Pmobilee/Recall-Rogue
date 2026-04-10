# Screen Flow & State Machine

> **Purpose:** Complete list of all Screen values, routing logic, transition rules, and component mappings.
> **Last verified:** 2026-04-07
> **Source files:** `src/ui/stores/gameState.ts`, `src/CardApp.svelte`, `src/services/screenController.ts`

---

## All Screen Values

Defined as a TypeScript union type in `src/ui/stores/gameState.ts`:

| Screen | Description |
|--------|-------------|
| `hub` | Main base-camp / home screen |
| `mainMenu` | Alias for hub (normalized to `hub` on load) |
| `base` | Alias for hub (normalized to `hub` on load) |
| `onboarding` | First-time dungeon entrance + tutorial |
| `archetypeSelection` | Run-start archetype picker (Balanced/Aggressive/Defensive/Scholar) |
| `deckSelectionHub` | Choose trivia mode vs. curated study deck before starting a run |
| `triviaDungeon` | Trivia domain selection screen |
| `dungeonMap` | Procedurally generated dungeon node map |
| `combat` | Active combat — Phaser canvas + CardCombatOverlay |
| `cardReward` | Post-combat 3-card reward pick |
| `rewardRoom` | Phaser-driven reward room scene (relic rewards) |
| `shopRoom` | Shop room: buy/sell cards and relics |
| `restRoom` | Rest room: heal / study / meditate choice |
| `restStudy` | Rest-room study flow: boss-quiz upgrade sequence |
| `restMeditate` | Rest-room meditate flow: card removal |
| `mysteryEvent` | Mystery event room with narrative choices |
| `specialEvent` | Scripted special event |
| `masteryChallenge` | Mastery challenge room: timed quiz for mastery rewards |
| `campfire` | In-run pause/campfire menu |
| `retreatOrDelve` | Post-boss decision: retreat vs. delve deeper |
| `upgradeSelection` | Card upgrade selection (via rest or relic reward) |
| `postMiniBossRest` | Post-mini-boss rest with auto-heal + upgrade pick |
| `relicSanctum` | Browse and manage owned relics (hub navigation) |
| `relicReward` | Deprecated — relic rewards now handled by `rewardRoom` Phaser scene |
| `relicSwapOverlay` | Swap offered relic with an equipped one |
| `runEnd` | Run summary screen: win/loss, XP, facts |
| `library` | Knowledge Library — domain knowledge browser (no Deck Builder tab) |
| `profile` | Player profile: stats, badges, run history |
| `journal` | Learning journal and fact history |
| `leaderboards` | Global / friends / guild / season leaderboards |
| `multiplayerMenu` | Multiplayer entry screen — two-tab UI (Create Lobby with 5 mode cards, Join Lobby with 6-char code); shown when hub "Multiplayer" button is pressed; entry point before lobby creation |
| `multiplayerLobby` | Multiplayer lobby — mode/deck/house-rules config and player readying; entered via `multiplayerMenu` |
| `settings` | In-game settings panel |
| `studyTemple` | Study Temple screen for dedicated flashcard study |
| `runPreview` | Pre-run chain distribution preview — shows topic assignments across 3 chains before expedition begins |
| `proceduralStudy` | Procedural math practice session — one question at a time with FSRS grading; bypasses combat run entirely |

---

## Persistent Screens (Saved to LocalStorage)

Only these screens survive a page refresh:

`hub`, `mainMenu`, `base`, `library`, `settings`, `profile`, `journal`, `leaderboards`, `relicSanctum`, `deckSelectionHub`

All in-run screens (`combat`, `dungeonMap`, `shopRoom`, etc.) default back to `hub` on reload. Run state is restored separately via `gameFlowController`.

---

## Screen Routing in CardApp.svelte

`CardApp.svelte` is the single routing entry point. Screens are switched with:

```ts
currentScreen.set(target)  // direct set
// or via:
navigateToScreen(target, fromScreen)  // validated, fires screenController hooks
```

The template uses `{#if $currentScreen === 'screenName'}` blocks — **no router library**. Each screen conditionally mounts its component. Most in-run screens use `in:fly={{ y: 8, duration: 350 }}` entry animation.

### Component Mounted Per Screen

| Screen | Primary Component | Notes |
|--------|-------------------|-------|
| `hub` / `mainMenu` / `base` | `HubScreen` | Always mounted when on hub alias screens |
| `onboarding` | `DungeonEntrance` | Uses `handleOnboardingBegin` callback |
| `archetypeSelection` | `ArchetypeSelection` | |
| `deckSelectionHub` | `DeckSelectionHub` | |
| `triviaDungeon` | `TriviaDungeonScreen` | |
| `dungeonMap` | `DungeonMap` | Only if `activeRunState.floor.actMap` exists |
| `combat` | `CardCombatOverlay` | Phaser container also shown; `ParallaxTransition` for enter/exit |
| `cardReward` | `CardRewardScreen` | |
| `rewardRoom` | *(Phaser scene)* | `RewardRoomScene` handles rendering; `RewardCardDetail` as DOM overlay |
| `shopRoom` | `ShopRoomOverlay` | |
| `restRoom` | `RestRoomOverlay` | |
| `restStudy` | `StudyQuizOverlay` | |
| `restMeditate` | `MeditateOverlay` | |
| `mysteryEvent` | `MysteryEventOverlay` | |
| `specialEvent` | `SpecialEventOverlay` | |
| `masteryChallenge` | `MasteryChallengeOverlay` | |
| `campfire` | `CampfirePause` | Only if `activeRunState` exists |
| `retreatOrDelve` | `RetreatOrDelve` | Only if `activeRunState` exists |
| `upgradeSelection` | `UpgradeSelectionOverlay` | |
| `postMiniBossRest` | `PostMiniBossRestOverlay` | |
| `relicSwapOverlay` | `RelicSwapOverlay` | |
| `runEnd` | `RunEndScreen` | Only if `activeRunEndData` exists |
| `library` | `KnowledgeLibrary` | No tab switcher — renders knowledge content directly. Props: `onback`. Empty domains (0 total facts) are filtered out of the domain grid. Domain grid shows icons, section heading, and left accent border via `--domain-accent` CSS var. |
| `profile` | `ProfileScreen` | |
| `journal` | `JournalScreen` | |
| `leaderboards` | `LeaderboardsScreen` | |
| `multiplayerMenu` | `MultiplayerMenu` | Two-tab entry screen. Create tab: 5 mode cards (race/same_cards/duel/coop/trivia_night) + "Create Lobby" button. Join tab: monospace 6-char code input + "Join Lobby" button. Props: `onBack`, `onCreateLobby(mode)`, `onJoinLobby(code)`. `onBack` returns to hub; creating transitions to `multiplayerLobby` with new lobby; joining transitions to `multiplayerLobby` (lobby syncs via onLobbyUpdate). |
| `multiplayerLobby` | `MultiplayerLobby` | Only mounts when `currentLobby !== null`; Props: `lobby`, `localPlayerId`, `onBack`. `MultiplayerHUD` also overlaid during `combat` when `isMultiplayerRun` is true. |
| `settings` | `SettingsPanel` | |
| `studyTemple` | `StudyTempleScreen` | |
| `proceduralStudy` | `ProceduralStudyScreen` | Props: `deckId`, `subDeckId?`, `onBack`; `onBack` returns to `studyTemple` |
| `runPreview` | `RunPreviewScreen` | Shows chain distribution; `onShuffle` calls `reshuffleChainDistribution()`; `onBeginExpedition` calls `confirmChainDistribution()` |
| `relicSanctum` | `RelicCollectionScreen` | |

---

## Transition Rules

Transition type is inferred automatically in `inferTransitionDirection()`:

| Destination | Transition Type |
|-------------|-----------------|
| `combat`, `shopRoom`, `restRoom`, `mysteryEvent`, `cardReward` | `zoom` (room entry) |
| `dungeonMap` (from any room) | `zoom` (zoom out) |
| `hub`, `runEnd` | `zoom` |
| `retreatOrDelve` | `zoom` |
| All others | `fade` |

**Combat parallax transitions** use `ParallaxTransition` with WebGL depth maps:
- **Enter combat**: `type="enter"` — player walks into the room
- **Exit combat (victory)**: `type="exit-forward"` — player walks forward out of the room
- Triggered by `combatExitRequested` store; enemy ID captured in `combatExitEnemyId`

**Transition implementation:**
- `screenTransitionLoading` → opaque black cover during asset preload
- `screenTransitionActive` → reveal animation clears after 500ms
- `holdScreenTransition()` / `releaseScreenTransition()` for screens that need to preload assets

---

## In-Run Screen Set

Screens where `InRunTopBar` (landscape HUD) is shown, and where run state must be active:

```
combat, cardReward, shopRoom, restRoom, mysteryEvent,
dungeonMap, retreatOrDelve, campfire, specialEvent,
upgradeSelection, postMiniBossRest, restStudy, restMeditate,
rewardRoom, masteryChallenge, relicSwapOverlay
```

`InRunTopBar` only renders in landscape mode (`$layoutMode === 'landscape'`) AND when `activeRunState !== null`.

---

## Key Navigation Flows

### Start a Run
```
hub → (handleStartRun) → deckSelectionHub → triviaDungeon or studyTemple
    → archetypeSelection → runPreview → (confirm) → dungeonMap → [room nodes] → combat/shop/rest/mystery
```

If a saved run exists, `handleStartRun` shows a Run Guard popup (continue vs. abandon).

### Custom Deck Run Flow

A custom deck run combines multiple curated decks into a single run. The `studyTemple` screen supports
building a `CustomDeck` of `CustomDeckItem`s. When "Start Custom Run" is clicked:

- **Single study deck**: emits `onStartRun({ mode: 'study', deckId, subDeckId? })` — identical to a normal study run
- **Multiple study decks**: emits `onStartRun({ mode: 'custom_deck', items: CustomDeckRunItem[] })` — merged fact pool

`CardApp.handleDungeonRunStart` accepts `{ mode: 'custom_deck'; items: CustomDeckRunItem[] }` and persists it to `playerSave.activeDeckMode`. `runManager` then merges all facts from playlist items into a single `InRunFactTracker` and populates `RunState.factSourceDeckMap` (factId → source deckId) for per-fact deck resolution.

During combat, `CardCombatOverlay.getStudyModeQuiz` handles both `type: 'study'` and `type: 'custom_deck'` deckModes:
- **Custom Deck (2026-04-07)**: uses `interleaveFacts()` from `src/utils/interleaveFacts.ts` to round-robin facts across all deck items (instead of flat concat), ensuring proportional representation from all sources from the very first encounter. Uses `factSourceDeckMap` for per-fact deck resolution.
- **Study**: unchanged behavior — single deck, no source map needed.

The guard in `getQuizForCard` activates the study-mode quiz path for both modes:
```typescript
if ((runState?.deckMode?.type === 'study' || runState?.deckMode?.type === 'playlist') && runState.inRunFactTracker)
```

Non-combat quiz (shop, rest, boss) uses `selectNonCombatCustomDeckQuestion` from `nonCombatQuizSelector.ts`
(separate function from the single-deck `selectNonCombatStudyQuestion`). Callers in `gameFlowController.ts`
and `bossQuizPhase.ts` need updating to invoke the custom deck variant when `deckMode.type === 'playlist'`.

### Custom Deck View / Edit Flow

**Added 2026-04-07.** When a playlist exists on the `studyTemple` screen, the `PlaylistBar` shows a **View** button. Clicking it opens `PlaylistViewModal` as an overlay (z-index 350, backdrop click to close).

- **Rename**: click the playlist name in the modal header to enter inline edit mode; commit with Enter or blur.
- **Remove item**: each item row has an X button; removing the last item auto-deletes the playlist and advances to the next.
- **Delete playlist**: footer "Delete Playlist" button shows an inline confirm/cancel row before executing.
- **Duplicate feedback**: when adding a deck already present in the active playlist, a fixed-position toast appears for 2s (bottom: 80px scaled, z-index 400).
- **Meta display**: the `PlaylistBar` shows deck names (not item count) — up to 3 names joined with commas; 3+ collapses to first two + "+N more".

All changes persist immediately to `playerSave.lastDungeonSelection.customDecks` via `persistStudySelection()`.

### Combat Loop
```
dungeonMap → (node select) → combat
    → (victory) → rewardRoom [Phaser] → cardReward → dungeonMap
    → (defeat) → runEnd → hub
```

### Rest Room
```
dungeonMap → restRoom
    → heal → dungeonMap
    → study → restStudy → dungeonMap
    → meditate → restMeditate → dungeonMap
```

### End of Segment
```
combat (boss) → retreatOrDelve
    → retreat → runEnd → hub
    → delve → dungeonMap (next segment)
```

### Campfire / Pause
```
[any in-run screen] → (pause button) → campfire
    → resume → previous screen
    → return to hub → hub (run saved, resumable)
```

### Multiplayer Flow
```
hub → multiplayerMenu → (select mode) → multiplayerLobby → (game start) → [mode-specific game]
```

`multiplayerMenu` is a hub screen (in `HUB_SCREENS` set in `screenController.ts`). It navigates to `multiplayerLobby` after the player picks a mode and the host creates or joins a lobby.

---

## Run Preview Screen

**Source file:** `src/ui/components/RunPreviewScreen.svelte`
**Added:** 2026-04-02

### Purpose

Shows the player how their selected deck's topic groups are distributed across the three run chain colors before the expedition begins. Allows reshuffling the distribution for variety.

### Navigation

- Reached from: `archetypeSelection` (via game-logic's `onArchetypeSelected`) or directly from `triviaDungeon`/`studyTemple` confirmation
- Leaves to: `dungeonMap` (via "Begin Expedition") or reshuffles in-place (via "Shuffle Chains")

### Props

| Prop | Type | Description |
|------|------|-------------|
| `onShuffle` | `() => void` | Called when "Shuffle Chains" is clicked. Calls `reshuffleChainDistribution(++shuffleSeedOffset)`. |
| `onBeginExpedition` | `() => void` | Called when "Begin Expedition" is clicked. Calls `confirmChainDistribution()`. |

### Data Source

Reads `$activeRunState?.chainDistribution` reactively via the `activeRunState` store (`src/services/runStateStore.ts`).

`ChainDistribution.assignments` is a tuple `[TopicGroup[], TopicGroup[], TopicGroup[]]` — index 0/1/2 map to `runChainTypes[0/1/2]` from `ChainDistribution.runChainTypes`.

### FSRS Legend

Topic group cards show a compact breakdown: `5N 8L 10R 3M` where:
- **N** = New (never seen)
- **L** = Learning (in progress)
- **R** = Review (due for review)
- **M** = Mastered (stability > 30 days)

### CardApp Handlers

`CardApp.svelte` wires the real service functions directly:

- `handleRunPreviewShuffle()` — calls `reshuffleChainDistribution(++shuffleSeedOffset)` (imported from `gameFlowController`); `shuffleSeedOffset` increments each shuffle so each press produces a different seed
- `handleRunPreviewBeginExpedition()` — calls `confirmChainDistribution()` (imported from `gameFlowController`)
- `handleOpenRunPreview()` — removed (was unused; navigation to `runPreview` handled by game-logic directly)

---

## Dev Bypass & Presets

- `?skipOnboarding=true` — skip boot animation and onboarding, start at hub
- `?devpreset=post_tutorial` — start at hub with a pre-configured save state
- `?forceBootAnim` — force boot animation even if previously seen
- `globalThis[Symbol.for('rr:currentScreen')].set('screenName')` — programmatic screen jump in dev
- `window.__rrScenario.load('combat-basic')` — instantly enter a pre-configured game state via scenario simulator

---

## Dungeon Map — Fog of War System

**Source file:** `src/ui/components/DungeonMap.svelte`
**Last updated:** 2026-04-01

### Overview

The dungeon map uses an atmospheric fog-of-war system combining **progressive node blur** (based on distance) and **scattered fog wisps**. The fog is purely visual — no opaque masks or overlays hide the layout. Nearby nodes appear clear, distant nodes progressively blur, creating an atmospheric sense of limited visibility without blocking information flow.

### Node Visibility & Icon Blur

Nodes blur progressively based on distance from the current row:

| Distance | Rows | Blur | Opacity | Effect |
|----------|------|------|---------|--------|
| Current + Next | 0–1 | 0px | 1.0 | Crisp, fully visible |
| Approaching | 2 | 8px | 0.4 | Slightly soft, dimmer |
| Far ahead | 3 | 16px | 0.2 | Very soft, hard to read |
| Very distant | 4+ | 24px | 0.08 | Nearly imperceptible |

**Same opacity rules apply to the edge connection lines** — visually fades from 1.0 (current/next rows) to 0.4, then 0.15, then 0.05 as rows recede.

Node blur is applied via CSS `filter: blur(...)` on `.node-position` elements; opacity as `opacity: ...` on the same. Blur eases smoothly over 0.6s as the player advances.

### Fog Wisps — Atmospheric Overlay

**17 scattered fog wisps** create a billowy mist effect across the full map width:

| Tier | Count | Size (px) | Animation Speed |
|------|-------|-----------|-----------------|
| Medium clouds | 8 | 300–500 | Medium (6–8s) |
| Large clouds | 6 | 550–800 | Slow (8–10s) |
| Backdrop clouds | 3 | 900–1200 | Very slow (10–15s) |

Each wisp:
- Uses a **soft diffuse radial-gradient** that fades to transparent at 100% radius
- Follows a **6-keyframe meandering path** with 200–450px horizontal/vertical drift
- Applies Web Animations API (CSS `@keyframes` with `var()` in animations don't work in Chrome)
- Respects `prefers-reduced-motion` — skips animation on user preference

### Fog Overlay DOM Structure

```html
<!-- Direct child of .dungeon-map-overlay -->
<div class="fog-overlay" style="height: {canvasHeight}px;">
  <!-- 17 scattered fog wisps, positioned absolutely -->
  <div class="fog-wisp fog-wisp-1"><!-- ... --></div>
  <div class="fog-wisp fog-wisp-2"><!-- ... --></div>
  <!-- ... -->
  <div class="fog-wisp fog-wisp-17"><!-- ... --></div>
</div>
```

Fog extends full screen width via `left: -50vw; right: -50vw` inside `.dungeon-map-overlay`, ensuring no gaps at screen edges. Height matches `canvasHeight` for proper alignment with map rows.

### Layer Stack

| z-index | Element | Role |
|---------|---------|------|
| 0 | `.row-marker` (in `.map-canvas`) | Floor depth labels |
| 1 | `.edge-layer` SVG (in `.map-canvas`) | Connection lines between nodes |
| 2 | `.node-position` (in `.map-canvas`) | Map nodes |
| 3 | `.fog-overlay` (sibling of `.map-scroll-container`) | Fog wisps — atmospheric overlay only |
| 4 | `.vignette-overlay` | Edge darkening (position: fixed) |

### Implementation Details

- **No opaque base or mask** — fog is purely decorative wisps overlaid on transparent background
- **Icon blur for distance** — blur/opacity applied directly to node elements, not masks
- **Web Animations API** — each wisp uses JS-driven animation (CSS `@keyframes` with `var()` doesn't work in Chrome)
- **Landscape support** — fog overlay respects `top: var(--topbar-height)` offset so top bar remains visible
- **Reduced motion** — all wisp animations and edge opacity transitions disabled under `prefers-reduced-motion: reduce`

---

## Segment Fog Colors

Not used for masks (no masks exist), but fog wisps can be tinted per-segment. Segment colors are defined in `SEGMENT_FOG`:

| Segment | Value | Theme |
|---------|-------|-------|
| 1 | `#1a150e` | Warm brown — Shallow Depths |
| 2 | `#0a0e14` | Cool blue-grey — Deep Caverns |
| 3 | `#0a0c16` | Icy blue-purple — The Abyss |
| 4 | `#0c0812` | Arcane purple — The Archive |

---

## Journal Screen — "Expedition Log"

**Source file:** `src/ui/components/JournalScreen.svelte`
**Last updated:** 2026-04-08

### Purpose

Displays a full run history with detailed stats for any selected expedition.

### Layout (landscape primary)

Two-column layout:
- **Left (3fr)**: Scrollable detail view of the selected run
- **Right (2fr)**: Run history list with filter pills

### Props

| Prop | Type | Description |
|------|------|-------------|
| `summary` | `RunSummary \| null` | Legacy single-run fallback (used if `runHistory` is empty) |
| `onBack` | `() => void` | Returns to previous screen |

### Data Sources

- Reads `$playerSave.runHistory` directly from the `playerSave` store (no prop for history).
- Falls back to the `summary` prop (legacy `lastRunSummary`) if `runHistory` is empty.
- `$lastRunSummary` imported from `hubState` (persistent store).

### Left Column Cards

1. **Run header card**: Result icon (🏆/💀/🚪) + result label, deck label (from `deckLabel`, fallback to domain), date, duration, Share button.
2. **Combat card**: Floor, encounters (won/total), elites, bosses, best chain, accuracy %, gold, cards — 4-column tile grid.
3. **Knowledge Gained card**: New facts seen, reviewed, mastered this run, tier advances + FSRS state bar (seen/reviewing/mastered segments).
4. **Enemies Felled card**: Normal/elite/mini-boss/boss counts + scrollable enemy chip list from `enemiesDefeatedList`.
5. **Domain Accuracy card**: Horizontal bar per domain from `domainAccuracy`, showing correct/answered %.
6. **Bounties card**: Chips for each completed bounty (amber styling). Only shown if bounties > 0.

### Right Column

- **Filter pills**: All / 🏆 / 💀 / 🚪 — filters `runHistory` by result. Resets selected index on change.
- **History list**: Scrollable rows, each with result icon, deck label, floor, duration, relative date ("2h ago", "yesterday").
- Clicking a row sets `selectedIndex` → swaps the left column detail view to that run.
- Empty state: "No expeditions logged yet. Dive into a run to begin your log."

### Relative Date Helper

`formatRelativeDate(iso)` shows: just now / Nm ago / Nh ago / yesterday / Nd ago / absolute date fallback.

---

## Profile Screen — "Scholar's Profile"

**Source file:** `src/ui/components/ProfileScreen.svelte`
**Last updated:** 2026-04-08

### Purpose

Comprehensive meta-progression dashboard covering run record, knowledge mastery, streaks, domain stats, deck progress, bestiary, and achievements.

### Layout (landscape primary)

- Portrait: single column, all sections stacked, `overflow-y: auto`.
- Landscape: CSS grid `1fr 1fr`, hero card spans full width (`grid-column: 1 / -1`), remaining sections fill two columns.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `onBack` | `() => void` | Returns to previous screen |

### Data Sources

- `$playerSave` store — `stats`, `reviewStates`, `runHistory`, `lifetimeEnemyKillCounts`, `domainRunCounts`, `claimedMilestones`.
- `$activeProfile` store — profile name.
- `getCardTier()` from `tierDerivation.ts` — mastery classification.
- `getAllDeckProgress()` from `deckProgressService.ts` — per-deck progress (filtered to `factsEncountered > 0`).
- Per-domain accuracy averaged from `runHistory[].domainAccuracy`.

### Sections

| # | Section | Key Data |
|---|---------|----------|
| 1 | Hero Banner | Avatar (👤), profile name, character level + XP bar, prestige badge, "Scholar since" date |
| 2 | Expedition Record | Total/victories/defeats/retreats tiles, win %, best floor, best chain, cumulative playtime |
| 3 | Knowledge Mastery | Facts learned, in review, mastered, lifetime mastered; mastery progress bar |
| 4 | Streak & Rhythm | Current/best streak, milestones count, sessions, daily avg playtime |
| 5 | Domain Breakdown | Per domain: run count + accuracy bar (averaged from run history). Scrollable if long. |
| 6 | Deck Progress | Per encountered deck: progress bar, seen/total, mastered count. Only shown if any deck has `factsEncountered > 0`. |
| 7 | Bestiary Preview | Unique enemies defeated, total kills, top 5 enemies by kill count. |
| 8 | Achievements | Streak milestone chips, completed biome chips, earned badge chips. Only shown if any data. |

### Tile Color Coding

- Victory tile: green (`#86efac`)
- Defeat tile: red (`#fca5a5`)
- Review tile: blue (`#93c5fd`)
- Mastered tile: green (`#86efac`)
- Lifetime mastered tile: purple (`#c4b5fd`)
- Current streak tile: orange (`#fdba74`)

---

## Hub Screen — Dev-Mode Contract (HIGH-7, 2026-04-10)

**Source file:** `src/ui/components/HubScreen.svelte`

### Dev Button Visibility
Dev buttons (Intro, BrightIdea, InkSlug, RunEnd, Enter, Exit, Lighting) are ONLY visible when the `devMode` store is true. This requires `?dev=true` URL param or `VITE_DEV_TOOLS=1` env var.

**NEVER gate dev buttons on `devpreset`** — devpreset is a playtest entry point accessible to LLM testers and is not a dev-tools flag.

### Dev Mode Store
- Store: `src/ui/stores/devMode.ts`
- Activation: `?dev=true` URL param OR `VITE_DEV_TOOLS=1` env var
- All dev-only DOM elements carry `data-dev-only="true"` for test detection

### Testing
- `?skipOnboarding=true&devpreset=post_tutorial` → NO dev buttons visible
- `?skipOnboarding=true&devpreset=post_tutorial&dev=true` → dev buttons ARE visible

---

## restStudy Screen — Empty State Contract (HIGH-8, 2026-04-10)

**Source file:** `src/ui/components/StudyQuizOverlay.svelte`

### Empty State
When `questions.length === 0` (e.g., navigated to restStudy from hub without an active run), `StudyQuizOverlay` renders an empty state:
- Message: "No Cards to Review — Start a run and visit a rest room to unlock study mode."
- Back button: "Return to Hub" → navigates to hub screen
- Test ID: `data-testid="study-empty-state"`

### Back Button Contract
A `data-testid="study-back-btn"` button is always rendered:
- In the empty state (navigates to hub)
- During active quiz (top-left "← Back" button)

### Softlock Prevention
The `onback?: () => void` prop allows callers to override the back navigation. If not supplied, `handleBack()` navigates to `hub`. This ensures no dead-end state regardless of how the screen is entered.

### Props
| Prop | Type | Description |
|------|------|-------------|
| `questions` | `QuizQuestion[]` | Quiz questions to display. Empty array triggers empty state. |
| `oncomplete` | `(correctFactIds: string[]) => void` | Called when quiz completes (with correct IDs) or back is clicked. |
| `onback` | `() => void` (optional) | Override back navigation. Defaults to navigating to hub. |

---

## NarrativeOverlay — Auto-Dismiss & Skip Preference (MEDIUM-11, 2026-04-10)

**Source file:** `src/ui/components/NarrativeOverlay.svelte`

### Auto-Dismiss Timer
Every narrative cutscene auto-dismisses after **10 seconds** (`AUTO_DISMISS_MS = 10_000`). A live countdown appears in the hint pill: `"click to dismiss  (Ns)"`. The timer resets whenever dialogue advances (next line, jump to end). Dismissing manually cancels the timer.

### Hint Contrast
The hint pill is a frosted glass pill with:
- `background: rgba(255,255,255,0.12)` + `backdrop-filter: blur(8px)`
- `border: 1px solid rgba(255,255,255,0.30)`
- Font size: `calc(15px * var(--text-scale,1))` (was 12px)
- Color: warm white `#fff8f0`

### Persistent Skip Preference
- `localStorage` key `setting_skipNarrativeOverlays`: if `"true"`, overlay immediately calls `beginDissolve()` on mount.
- After **3 consecutive manual dismissals** (tracked via `setting_narrativeConsecutiveDismisses`), an "always skip?" toast appears.
- Toast offers "Yes, always skip" (sets preference) or "No" (dismisses toast, resets counter).
- `CONSECUTIVE_THRESHOLD = 3` — the threshold constant is at top of script.

---

## CardCombatOverlay — Low-HP Danger Signals (MEDIUM-12, 2026-04-10)

**Source file:** `src/ui/components/CardCombatOverlay.svelte`

### Low-HP Vignette
When `playerHpRatio <= 0.40`, a `.low-hp-vignette` div appears over the combat canvas:
- `radial-gradient` from transparent center to `rgba(180,0,0,0.25)` at edges
- Pulses via `lowHpPulse` keyframes (3s ease-in-out infinite)
- At `playerHpRatio <= 0.25` (critical): `.critical-hp` class activates stronger gradient + 1.5s pulse

### HP Bar Breathing
`.player-hp-fill.hp-critical` adds `brightness` keyframe breathing animation at ≤25% HP.

### Damage Screen Shake
When the player takes damage while `isLowHp`, `triggerDamageShake()` is called:
- Applies `damage-shaking` class → `@keyframes damageShake` (50ms translate-X/Y, 150ms total)
- Fires only when `!$reducedMotion` (respects `prefers-reduced-motion` via `reducedMotion` store)

### Derived Variable Ordering
`isLowHp` and `isCriticalHp` must be declared **after** `playerHpRatio` in the script block. Svelte 5 `$derived` cannot forward-reference other `$derived` variables.

---

## HubScreen + CampSpriteButton — Sprite Tooltips (MEDIUM-14, 2026-04-10)

**Source files:** `src/ui/components/HubScreen.svelte`, `src/ui/components/CampSpriteButton.svelte`

### CampSpriteButton `tooltip` Prop
New optional prop `tooltip?: string`. When provided:
- Added to `title` attribute on the hitbox button (browser native tooltip fallback)
- After a 300ms hover delay, a custom `.sprite-tooltip` div appears above the sprite
- CSS: dark RPG-styled panel with `border: 1px solid rgba(255,215,140,0.4)`, `font-size: calc(11px * var(--text-scale,1))`
- Tooltip disappears on `mouseleave`

### Hub Sprite Tooltips
All 10 interactive hub sprites now pass a `tooltip` prop with descriptive text explaining the button's purpose (e.g., "Enter the dungeon and begin a new expedition", "Browse your collected facts and knowledge").

---

## CardRewardScreen — Reward Altar Tooltips (MEDIUM-15, 2026-04-10)

**Source file:** `src/ui/components/CardRewardScreen.svelte`

### Hover Tooltip on Altar Items
Each altar card option shows an `.altar-card-tooltip` on hover (before clicking to select):
- Positioned absolutely above the card with `bottom: calc(105% ...)` 
- Shows: card name, detailed description (`getDetailedCardDescription()`), "Click to select" hint
- Disappears once a card is selected (`!isSelected(option)` guard)
- `@keyframes rewardTooltipIn` for subtle scale-up entry

---

## KnowledgeLibrary — Virtualized Fact Browser (MEDIUM-16, 2026-04-10)

**Source file:** `src/ui/components/KnowledgeLibrary.svelte`

### Virtual Scroll (No External Deps)
The `.fact-scroll` container renders only the visible window of `filteredDomainEntries` at any time. Implementation uses native `ResizeObserver` + scroll events.

Key constants:
- `ITEM_HEIGHT = 90` — fact-row height: 56px min-height + 24px padding + 10px gap
- `VIRTUAL_BUFFER = 8` — extra items above/below visible area for smooth scroll

State:
- `virtualScrollTop = $state(0)` — current scroll position
- `virtualContainerHeight = $state(600)` — measured by ResizeObserver

Derived:
- `virtualVisible = $derived.by(...)` — returns `{ startIdx, endIdx, paddingTop, paddingBottom }`

Template:
- Top spacer div (`virtual-spacer-top`) sets `height` = `paddingTop` px
- `{#each filteredDomainEntries.slice(startIdx, endIdx)}` — renders only visible slice
- Bottom spacer div (`virtual-spacer-bottom`) sets `height` = `paddingBottom` px

Scroll resets to top whenever `filteredDomainEntries` changes (filter/search). No npm dependencies added.
