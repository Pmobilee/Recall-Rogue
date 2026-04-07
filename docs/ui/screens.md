# Screen Flow & State Machine

> **Purpose:** Complete list of all Screen values, routing logic, transition rules, and component mappings.
> **Last verified:** 2026-04-06
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
| `social` | Social hub: friends, guilds, duels, trades |
| `multiplayerLobby` | Multiplayer lobby — mode/deck/house-rules config and player readying; entered via "Multiplayer" hub button |
| `settings` | In-game settings panel |
| `studyTemple` | Study Temple screen for dedicated flashcard study |
| `runPreview` | Pre-run chain distribution preview — shows topic assignments across 3 chains before expedition begins |
| `proceduralStudy` | Procedural math practice session — one question at a time with FSRS grading; bypasses combat run entirely |

---

## Persistent Screens (Saved to LocalStorage)

Only these screens survive a page refresh:

`hub`, `mainMenu`, `base`, `library`, `settings`, `profile`, `journal`, `leaderboards`, `social`, `relicSanctum`, `deckSelectionHub`

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
| `social` | `SocialScreen` | |
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

### Playlist Run Flow

A playlist run combines multiple curated decks into a single run. The `studyTemple` screen supports
building a `CustomPlaylist` of `CustomPlaylistItem`s. When "Start Custom Run" is clicked:

- **Single study deck**: emits `onStartRun({ mode: 'study', deckId, subDeckId? })` — identical to a normal study run
- **Multiple study decks**: emits `onStartRun({ mode: 'playlist', items: PlaylistDeckItem[] })` — merged fact pool

`CardApp.handleDungeonRunStart` accepts `{ mode: 'playlist'; items: PlaylistDeckItem[] }` and persists it to `playerSave.activeDeckMode`. `runManager` then merges all facts from playlist items into a single `InRunFactTracker` and populates `RunState.factSourceDeckMap` (factId → source deckId) for per-fact deck resolution.

During combat, `CardCombatOverlay.getStudyModeQuiz` handles both `type: 'study'` and `type: 'playlist'` deckModes:
- **Playlist**: merges all items' fact pools and uses `factSourceDeckMap` to look up the correct deck for template selection and distractor generation.
- **Study**: unchanged behavior — single deck, no source map needed.

The guard in `getQuizForCard` activates the study-mode quiz path for both modes:
```typescript
if ((runState?.deckMode?.type === 'study' || runState?.deckMode?.type === 'playlist') && runState.inRunFactTracker)
```

Non-combat quiz (shop, rest, boss) uses `selectNonCombatPlaylistQuestion` from `nonCombatQuizSelector.ts`
(separate function from the single-deck `selectNonCombatStudyQuestion`). Callers in `gameFlowController.ts`
and `bossQuizPhase.ts` need updating to invoke the playlist variant when `deckMode.type === 'playlist'`.

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
