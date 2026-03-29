# Store Reference

This reference enumerates active Svelte stores and their purpose.

## Primary gameplay stores

File: `src/ui/stores/gameState.ts`

| Store | Purpose |
| --- | --- |
| `currentScreen` | Top-level screen routing state |
| `currentFloorIndex` | Active dome floor index |
| `diveResults` | Post-dive summary payload |
| `oxygenCurrent`, `oxygenMax`, `currentDepth`, `currentLayer` | Live dive telemetry |
| `currentBiome`, `currentBiomeId` | Active biome label/id |
| `inventory` | Active run inventory slots |
| `activeQuiz` | Quiz overlay payload and source mode |
| `activeFact`, `pendingArtifacts` | Artifact review state |
| `activeUpgrades`, `pickaxeTier`, `scannerTier` | In-run upgrade state |
| `blocksMinedLive`, `tickCount`, `layerTickCount` | Run progression counters |
| `gaiaMessage`, `gaiaExpression`, `gaiaThoughtBubble` | GAIA messaging and expression state |
| `studyFacts`, `studyReviewStates` | Study-session card state |
| `showSendUp`, `sacrificeState`, `decisionScreenState` | Overlay/decision states |
| `activeRelics`, `activeSynergies`, `equippedRelicsV2`, `pendingRelicPickup` | Relic systems state |
| `activeCompanion`, `companionBadgeFlash`, `activeDustCatSynergy` | Companion HUD and synergy states |
| `instabilityLevel`, `instabilityCollapsing`, `instabilityCountdown` | Mine instability HUD state |
| `activeAltar`, `activeMineEvent`, `combatEncounterActive` | Special encounter state |
| `biomeCompletionStore` | Biome mastery completion trigger |
| `quoteStoneModalEntry`, `cavernTextModalEntry` | Ambient text modal payloads |
| `selectedLoadout`, `loadoutReady`, `relicVault`, `activeConsumables`, `pendingConsumables`, `shieldActive` | Dive prep/loadout + consumable state |
| `layerTierLabel`, `o2DepthMultiplier`, `quizStreak`, `descentOverlayState`, `pastPointOfNoReturn`, `tempBackpackSlots` | Derived and compatibility state |

## Player/save stores

File: `src/ui/stores/playerData.ts`

| Store | Purpose |
| --- | --- |
| `playerSave` | Full persisted `PlayerSave` in-memory source of truth |
| `playerCompanionStates` | Companion progression state snapshots |

Helper constants/functions in same module manage mutations and persistence (`persistPlayer`, `recordDiveComplete`, etc.).

## Settings and preferences

File: `src/ui/stores/settings.ts`

| Store | Purpose |
| --- | --- |
| `spriteResolution` | Runtime sprite set selection (`low`/`high`) |
| `gaiaMood`, `gaiaChattiness`, `showExplanations` | GAIA behavior controls |
| `musicVolume`, `sfxVolume`, `musicEnabled`, `sfxEnabled` | Audio settings |
| `highContrastQuiz`, `reducedMotion`, `screenShakeIntensity` | Accessibility and motion settings |
| `analyticsEnabled` | Analytics consent gate |
| `deviceTierOverride` | Manual performance tier override |
| `interestConfig` | Player interest weighting/preferences |

## Combat, social, and auxiliary stores

| File | Store(s) | Purpose |
| --- | --- | --- |
| `src/ui/stores/combatState.ts` | `combatState` | Combat UI snapshot |
| `src/ui/stores/coopState.ts` | `coopRole`, `partnerStatus`, `activeBuff`, `coopQuizQueue`, `inRecoveryMode`, `recoveryTicksLeft`, `coopRoomId`, `showScholarPanel` | Co-op runtime and HUD state |
| `src/ui/stores/classroomStore.ts` | `classroomStore` | Classroom membership/assignment cache |
| `src/ui/stores/parentalStore.ts` | `parentalStore` | Parental settings including PIN hash/limits |
| `src/ui/stores/parentalControls.ts` | `kidModeEnabled`, `remainingMinutes`, `showTimeLimitWarning`, `timeLimitReached` | Kid session-time tracking |
| `src/ui/stores/achievements.ts` | `allPaintings`, `pendingReveal`, `completionStats`, `isRevealing` | Achievement gallery state |
| `src/ui/stores/factSprites.ts` | (functions only) | Mastery stage/filter helpers for fact art |
| `src/ui/stores/omniscient.ts` | `omniscientStatus`, `goldenDomeActive` | Omniscient progression flags |
| `src/ui/stores/welcomeBack.ts` | `showWelcomeBack`, `welcomeBackData` | Return-player UX payload |
| `src/ui/stores/profileStore.ts` | `profileStore`, `activeProfile`, `hasProfiles` | Multi-profile selection state |
| `src/ui/stores/authStore.ts` | `authStore`, `isLoggedIn` | Auth state and user identity |
| `src/ui/stores/syncStore.ts` | `syncStatus` | Cloud sync status indicator |
| `src/ui/stores/reviewForecast.ts` | `reviewForecast` | Due-card forecast counters |
| `src/ui/stores/miniMap.ts` | `miniMapData` | Minimap render payload |

## Non-UI store modules

| File | Store | Purpose |
| --- | --- | --- |
| `src/game/gameManagerRef.ts` | `gameManagerStore` | Reactive reference to `GameManager` singleton |
| `src/i18n/index.ts` | `locale`, `translations`, `t` | I18n locale and translation stores |

## Notes on singleton behavior

- Most gameplay/settings stores use `Symbol.for('rr:<key>')` wrappers to survive code-split module re-evaluation.
- This reduces duplicate store instances when Vite/Rollup chunk boundaries re-import modules.
