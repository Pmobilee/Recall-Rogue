# Screen Flow & State Machine

> **Purpose:** Complete list of all Screen values, routing logic, transition rules, and component mappings.
> **Last verified:** 2026-03-31
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
| `library` | Knowledge Library + Deck Builder (tabbed) |
| `profile` | Player profile: stats, badges, run history |
| `journal` | Learning journal and fact history |
| `leaderboards` | Global / friends / guild / season leaderboards |
| `social` | Social hub: friends, guilds, duels, trades |
| `settings` | In-game settings panel |
| `studyTemple` | Study Temple screen for dedicated flashcard study |

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
| `library` | `KnowledgeLibrary` | `libraryInitialTab` prop sets starting tab |
| `profile` | `ProfileScreen` | |
| `journal` | `JournalScreen` | |
| `leaderboards` | `LeaderboardsScreen` | |
| `social` | `SocialScreen` | |
| `settings` | `SettingsPanel` | |
| `studyTemple` | `StudyTempleScreen` | |
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
    → archetypeSelection → dungeonMap → [room nodes] → combat/shop/rest/mystery
```

If a saved run exists, `handleStartRun` shows a Run Guard popup (continue vs. abandon).

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

## Dev Bypass & Presets

- `?skipOnboarding=true` — skip boot animation and onboarding, start at hub
- `?devpreset=post_tutorial` — start at hub with a pre-configured save state
- `?forceBootAnim` — force boot animation even if previously seen
- `globalThis[Symbol.for('rr:currentScreen')].set('screenName')` — programmatic screen jump in dev
- `window.__rrScenario.load('combat-basic')` — instantly enter a pre-configured game state via scenario simulator
