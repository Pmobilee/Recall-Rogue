# Run Competitive & Meta Services

> **Purpose:** Competitive modes (Daily Expedition, Endless Depths, Scholar Challenge), adaptive difficulty, player progression, lore unlocks, preference/boost systems, and reactive tutorial overlay.
> **Last verified:** 2026-04-12
> **Source files:** bountyManager.ts, canaryService.ts, masteryChallengeService.ts, dailyExpeditionService.ts, endlessDepthsService.ts, scholarChallengeService.ts, characterLevel.ts, ascension.ts, loreService.ts, cardPreferences.ts, funnessBoost.ts, tutorialService.ts, src/data/tutorialSteps.ts

> See also: [run.md](run.md) for core run lifecycle — runManager, floorManager, mapGenerator, gameFlowController, rewards, shop, and RNG utilities

---

## bountyManager

| | |
|---|---|
| **File** | src/services/bountyManager.ts |
| **Purpose** | Per-run bounty selection and progress tracking; fires on card_correct, encounter_won, floor_reached, perfect_turn events |
| **Key exports** | `selectRunBounties`, `updateBounties`, `ActiveBounty` (interface), `BountyEvent` (type) |
| **Key dependencies** | balance.ts |

## canaryService

| | |
|---|---|
| **File** | src/services/canaryService.ts |
| **Purpose** | Adaptive difficulty — invisible enemy damage multiplier adjusts based on wrong-answer streaks (assist) and correct-answer streaks (challenge) |
| **Key exports** | `createCanaryState`, `recordCanaryAnswer`, `CanaryState` (interface), `CanaryMode` (type) |
| **Key dependencies** | balance.ts (canary thresholds) |

## masteryChallengeService

| | |
|---|---|
| **File** | src/services/masteryChallengeService.ts |
| **Purpose** | Generates mastery challenge quiz questions with hard variants (negative/reverse/fill_blank) for room challenge events |
| **Key exports** | `shouldTriggerMasteryChallenge`, `generateMasteryChallengeQuestion`, `MasteryChallengeQuestion` (interface) |
| **Key dependencies** | factsDB, tierDerivation, numericalDistractorService, seededRng |

## characterLevel

| | |
|---|---|
| **File** | src/services/characterLevel.ts |
| **Purpose** | Mechanic unlock schedule — maps player character level to mechanic IDs unlocked at each level (0–13+) |
| **Key exports** | `getUnlockedMechanics`, `isLevelUnlocked`, `MECHANIC_UNLOCK_SCHEDULE` |
| **Key dependencies** | None |

## dailyExpeditionService

| | |
|---|---|
| **File** | src/services/dailyExpeditionService.ts |
| **Purpose** | Daily Expedition competitive mode — attempt reservation, score submission, leaderboard with bot baselines |
| **Key exports** | `getDailyExpeditionStatus`, `reserveAttempt`, `submitScore`, `getLeaderboard`, `DailyExpeditionStatus` (interface) |
| **Key dependencies** | apiClient, leaderboardFetch |

## endlessDepthsService

| | |
|---|---|
| **File** | src/services/endlessDepthsService.ts |
| **Purpose** | Endless Depths competitive mode — personal records, score submission, global leaderboard with bot baselines |
| **Key exports** | `submitEndlessRun`, `getPersonalBest`, `getGlobalLeaderboard`, `EndlessDepthsEntry` (interface) |
| **Key dependencies** | apiClient, leaderboardFetch |

## scholarChallengeService

| | |
|---|---|
| **File** | src/services/scholarChallengeService.ts |
| **Purpose** | Scholar Challenge weekly competitive mode — weekly attempt reservation, score submission, domain-specific leaderboard |
| **Key exports** | `getScholarChallengeStatus`, `reserveAttempt`, `submitScore`, `getLeaderboard`, `ScholarChallengeStatus` (interface) |
| **Key dependencies** | apiClient, leaderboardFetch |

## cardPreferences

| | |
|---|---|
| **File** | src/services/cardPreferences.ts |
| **Purpose** | Persistent Svelte stores for all player preference flags — difficulty, text size, font, onboarding state, ascension profile |
| **Key exports** | `difficultyMode`, `textSize`, `fontChoice`, `onboardingState`, `ascensionProfile` (stores); `markCombatTutorialSeen`, `markStudyTutorialSeen`, `markTutorialDismissedEarly`, `resetTutorialFlags` (tutorial helpers added 2026-04-12) |
| **Key dependencies** | Svelte stores, localStorage |

## loreService

| | |
|---|---|
| **File** | src/services/loreService.ts |
| **Purpose** | Unlocks lore fragments at mastery milestones (10, 25, 50, 100... facts mastered) |
| **Key exports** | `checkLoreUnlocks`, `getLoreState`, `LORE_FRAGMENTS`, `LoreState` (interface) |
| **Key dependencies** | tierDerivation, localStorage |

## funnessBoost

| | |
|---|---|
| **File** | src/services/funnessBoost.ts |
| **Purpose** | Biases early-run fact pools toward high-funScore facts (runs 0–9 full boost, linear decay to 0 at run 100) |
| **Key exports** | `calculateFunnessBoostFactor`, `funScoreWeight` |
| **Key dependencies** | None |

## tutorialService

| | |
|---|---|
| **File** | src/services/tutorialService.ts |
| **Purpose** | Reactive tutorial overlay orchestration — watches game state via `$effect`, shows contextual coach marks for first-time players |
| **Key exports** | `tutorialActive`, `tutorialMode`, `tutorialStepId`, `tutorialMessage`, `tutorialAnchor`, `tutorialSpotlight` (Svelte stores); `startTutorial(mode)`, `skipTutorial()`, `advanceStep()`, `evaluateTutorialStep(ctx)`, `isTutorialActive()` |
| **Key dependencies** | cardPreferences (for marking seen flags), tutorialSteps.ts (step definitions) |

Step definitions live in `src/data/tutorialSteps.ts`: 13 combat steps + 5 study steps, each with `showWhen`/`doneWhen` predicates against `TutorialContext`. Steps are encounter-agnostic and non-linear — the tutorial adapts if the player skips ahead.

Entry points:
1. `CardApp.svelte` auto-triggers on first combat (`runsCompleted === 0` and `!hasSeenCombatTutorial` and `!tutorialDismissedEarly`)
2. `NarrativeOverlay` "Tutorial" button (always visible in combat, via `showTutorialButton` prop)
3. `resetTutorialFlags()` in `cardPreferences.ts` for dev/replay
