# Svelte Stores & State

> **Purpose:** All Svelte stores, state ownership, reactivity patterns, and initialization order
> **Last verified:** 2026-03-31
> **Source files:** `src/ui/stores/authStore.ts`, `src/ui/stores/gameState.ts`, `src/ui/stores/playerData.ts`, `src/ui/stores/profileStore.ts`, `src/ui/stores/settings.ts`, `src/ui/stores/syncStore.ts`, `src/ui/stores/factSprites.ts`, `src/ui/stores/omniscient.ts`, `src/ui/stores/singletonStore.ts`, `src/ui/stores/reviewForecast.ts`, `src/ui/stores/welcomeBack.ts`

> See also: [stores-gameplay.md](stores-gameplay.md) for combatState, coopState, campState, classroomStore, and parentalStore

---

## singletonStore — Foundation

**File:** `src/ui/stores/singletonStore.ts`

All critical game stores use `singletonWritable` / `singletonDerived` instead of plain `writable`. These register stores on `globalThis` under `Symbol.for('rr:<key>')`, so the same store instance is returned on every import — even across HMR reloads and module isolation boundaries.

```ts
singletonWritable<T>(key, initial)  // writable singleton
singletonDerived<T, S>(key, deps, fn)  // derived singleton
```

Plain `writable` (from `svelte/store`) is used for stores that don't need singleton guarantees: `authStore`, `coopState`, `campState`, `profileStore`, `classroomStore`, `parentalStore`, `syncStore`, `omniscientStatus`, `reviewForecast`, `welcomeBack`.

---

## Store Catalog

### gameState — Screen Routing + Transitions

**File:** `src/ui/stores/gameState.ts`

Central routing store. All stores here use `singletonWritable`.

**`currentScreen: Writable<Screen>`** — the active top-level UI screen. Persisted to `localStorage('card:currentScreen')` for `PERSISTABLE_SCREENS` only (`hub`, `mainMenu`, `base`, `library`, `settings`, `profile`, `journal`, `leaderboards`, `social`, `relicSanctum`, `deckSelectionHub`). Non-persistable screens always resolve to `'hub'` on reload.

**All `Screen` values:** `'hub'`, `'mainMenu'`, `'base'`, `'combat'`, `'archetypeSelection'`, `'library'`, `'profile'`, `'journal'`, `'leaderboards'`, `'social'`, `'mysteryEvent'`, `'restRoom'`, `'runEnd'`, `'cardReward'`, `'rewardRoom'`, `'retreatOrDelve'`, `'shopRoom'`, `'specialEvent'`, `'campfire'`, `'masteryChallenge'`, `'relicSanctum'`, `'relicReward'` (deprecated), `'onboarding'`, `'settings'`, `'upgradeSelection'`, `'postMiniBossRest'`, `'dungeonMap'`, `'relicSwapOverlay'`, `'restStudy'`, `'restMeditate'`, `'deckSelectionHub'`, `'triviaDungeon'`, `'studyTemple'`.

**Transition stores:**

| Export | Type | Purpose |
|---|---|---|
| `screenTransitionDirection` | `Writable<TransitionDirection>` | `'down'`, `'up'`, `'left'`, `'right'`, `'fade'`, `'zoom'` |
| `screenTransitionActive` | `Writable<boolean>` | Dark overlay shown during changes |
| `screenTransitionLoading` | `Writable<boolean>` | Opaque cover during asset preload |
| `combatExitRequested` | `Writable<boolean>` | Triggers exit-forward parallax after victory |
| `combatExitEnemyId` | `Writable<string\|null>` | Enemy ID captured before `activeTurnState` is cleared |

**`holdScreenTransition()` / `releaseScreenTransition()`** — call before/after async asset loads. Hold has an 8s safety timeout with a console warning.

### playerData — Save & SM-2

**File:** `src/ui/stores/playerData.ts`

**`playerSave: Writable<PlayerSave | null>`** (singletonWritable) — the active player save. `null` until `initPlayer()` is called.

**`initPlayer(ageRating?)`** — loads from `saveService`, or creates a new save via `createNewPlayer()`. Age bracket read from `localStorage(AGE_BRACKET_KEY)`. Returns the `PlayerSave`.

Heavy module with many inline service imports: `sm2`, `fsrsScheduler`, `tierDerivation`, `reviewPromptService`, `runEarlyBoostController`, `characterLevel`, `balance`, `relics/index`, `archetypeDetector`, `engagementScorer`.

**Consumed by:** nearly every component that displays player progress, cards, relics, HP.

### authStore — Authentication

**File:** `src/ui/stores/authStore.ts`

Plain `writable` (not singleton). Wraps `apiClient` auth state.

**`authStore`** — custom store object with `subscribe`, `setUser(user)`, `clear()`. `clear()` also calls `apiClient.logout()` and removes `localStorage('rr_guest_mode')`.

**`isLoggedIn: Readable<boolean>`** — derived from `authStore`.

Written by login/register flows. Consumed by profile screen, social features, sync UI.

### profileStore — Multi-Profile

**File:** `src/ui/stores/profileStore.ts`

Thin wrapper over `profileService`.

**`profileStore`** — custom store with `subscribe`, `activeId.subscribe`, `refresh()`, `setActive(id)`.

**`activeProfile: Readable<PlayerProfile|null>`** — derived from profiles + activeId.

**`hasProfiles: Readable<boolean>`** — derived from profiles array length.

### settings — User Preferences

**File:** `src/ui/stores/settings.ts`

All settings use `singletonWritable`. Auto-persist to localStorage via batched microtask writes (`schedulePersist`).

| Export | Type | localStorage key | Default |
|---|---|---|---|
| `spriteResolution` | `Writable<'low'\|'high'>` | `'recall-rogue-sprite-resolution'` | `'low'` |
| `gaiaMood` | `Writable<GaiaMood>` | `'gaia-mood'` | `'enthusiastic'` |
| `gaiaChattiness` | `Writable<number>` | `'gaia-chattiness'` | `5` |
| `showExplanations` | `Writable<boolean>` | `'show-explanations'` | `true` |
| `musicVolume` | `Writable<number>` | `'setting_musicVolume'` | `0.6` |
| `sfxVolume` | `Writable<number>` | `'setting_sfxVolume'` | `0.8` |
| `musicEnabled` | `Writable<boolean>` | `'setting_musicEnabled'` | `true` |
| `sfxEnabled` | `Writable<boolean>` | `'setting_sfxEnabled'` | `true` |

`GaiaMood` values: `'snarky'`, `'enthusiastic'`, `'calm'`, `'omniscient'`.

**`getSpriteResolution()`** — plain (non-reactive) function for use in Phaser BootScene before Svelte hydrates. **`setSpriteResolution(res)`** writes to localStorage then `window.location.reload()`.

### syncStore — Cloud Sync Status

**File:** `src/ui/stores/syncStore.ts`

**`syncStatus: Writable<SyncState>`** — `'idle'` | `'syncing'` | `'error'`. Plain `writable`. Written by `syncService` before/after network operations.

### factSprites — Mastery Visual Stage

**File:** `src/ui/stores/factSprites.ts`

Not a store — exports pure functions that read synchronously from `playerSave`.

**`getMasteryStage(factId): MasteryStage`** — maps SM-2 `repetitions` to stage 0–4: 0=unseen, 1=2 reps, 2=3 reps, 3=4–5 reps, 4=6+ reps.

**`masteryFilter(stage): string`** — CSS filter string: stage 0 = `grayscale(1)`, stage 4 = `grayscale(0) saturate(1.5) brightness(1.1)`.

**`masteryLabel(stage): string`** — `'Unseen'`, `'Glimpsed'`, `'Familiar'`, `'Learned'`, `'Mastered'`.

Consumed by `FactArtwork.svelte` and any card display showing art mastery coloring.

### omniscient — Omniscient Status

**File:** `src/ui/stores/omniscient.ts`

**`omniscientStatus: Writable<OmniscientStatus>`** — plain writable.

**`goldenDomeActive: Readable<boolean>`** — derived; true when `isOmniscient`.

**`checkOmniscientStatus(totalFacts, masteredFacts)`** — computes status, writes to store, returns result. Threshold: 95% mastered = `'The Omniscient'`; 75% = `'Grand Scholar'`; 50% = `'Knowledge Seeker'`.

### reviewForecast — Due Card Counts

**File:** `src/ui/stores/reviewForecast.ts`

**`reviewForecast: Writable<ReviewForecast>`** — `{ today, tomorrow, thisWeek }` counts.

**`refreshReviewForecast(reviewStates)`** — recalculates from `nextReviewAt` timestamps. Call on app startup or dome entry.

### welcomeBack — Return Player Flow

**File:** `src/ui/stores/welcomeBack.ts`

**`showWelcomeBack: Writable<boolean>`**, **`welcomeBackData: Writable<WelcomeBackData|null>`** — plain writables.

**`checkWelcomeBack(lastPlayedAt, factsLearned, bestStreak)`** — triggers for 3+ day absences. Returns rewards array (oxygen refill always; minerals at 7+ days; seasonal chest at 30+ days). Returns `null` if < 3 days since last play.

---

## State Ownership

| Store | Written by | Consumed by |
|---|---|---|
| `currentScreen` | Screen transition logic, game flow controllers | `CardApp.svelte` (routing), all screen components |
| `playerSave` | `initPlayer()`, save service, combat resolution | Most gameplay components |
| `combatState` | Turn manager / encounter bridge | `CardCombatOverlay`, `InRunTopBar`, quiz overlays |
| `authStore` | Login/register/logout handlers | Profile screen, sync UI |
| `campState` | Hub upgrade actions | `CampHudOverlay.svelte` |
| `syncStatus` | `syncService` | Sync status indicator in HUD |
| `settings.*` | Settings screen | Audio system, sprite loader, GAIA dialogue |
| `parentalStore` | Parental settings screen | Age gate, session timer, floor unlock checks |
| `profileStore` | Profile service mutations | Profile selection screen |
| `classroomStore` | `classroomService` (30min poll) | Homework badge, assignment overlay |
| `reviewForecast` | `refreshReviewForecast()` | Hub review count badge |
| `omniscientStatus` | `checkOmniscientStatus()` | Hub visual overlays |

---

## Reactivity Patterns

**Singleton guards:** `currentScreen`, `playerSave`, `combatState`, and all settings stores use `singletonWritable` to prevent duplicate instances during HMR. Stores register themselves on `globalThis[Symbol.for('rr:<key>')]`.

**Persistence:** Most stores self-persist in their subscribe callback. `settings.ts` batches writes via `queueMicrotask` to avoid thrashing localStorage on rapid slider changes.

**Derived stores:** `isLoggedIn` (from authStore), `activeProfile`/`hasProfiles` (from profileStore), `goldenDomeActive` (from omniscientStatus), `showScholarPanel` (from coopState) are all `derived()` and recompute automatically.

**Initialization order:** `playerSave` must be populated by `initPlayer()` before any component that calls `getMasteryStage()`, `checkOmniscientStatus()`, or `refreshReviewForecast()`. `CardApp.svelte` calls `initPlayer()` during mount.
