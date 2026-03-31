# Learning Analytics Services

> **Purpose:** FSRS/SM-2 scheduling, fact performance tracking, behavioral learning, archetype detection, engagement scoring, mastery scaling, and study analytics.
> **Last verified:** 2026-03-31
> **Source files:** fsrsScheduler.ts, sm2.ts, inRunFactTracker.ts, confusionMatrix.ts, confusionMatrixStore.ts, archetypeDetector.ts, engagementScorer.ts, behavioralLearner.ts, masteryScalingService.ts, learningInsights.ts, reviewQueueSystem.ts (see also combat.md), studyScore.ts, wowScore.ts

## Overview

Learning analytics is the knowledge engine of Recall Rogue — it determines what the player sees next and how strong their cards are. The FSRS scheduler (via `ts-fsrs`) is the primary spaced-repetition algorithm, with SM-2 (`sm2.ts`) as the legacy path. `inRunFactTracker` maintains per-session state separate from global FSRS. The `confusionMatrix` tracks which facts players confuse together, feeding into `curatedDistractorSelector` for smarter distractor selection.

---

## fsrsScheduler

| | |
|---|---|
| **File** | src/services/fsrsScheduler.ts |
| **Purpose** | FSRS v5 spaced repetition scheduler wrapping `ts-fsrs`; maps game-side ease/state to FSRS card types and back |
| **Key exports** | `scheduleFSRS`, `mapEaseToFSRSDifficulty`, `mapFSRSStateToCardState`, `fsrsToReviewState` |
| **Key dependencies** | ts-fsrs, tierDerivation |

## sm2

| | |
|---|---|
| **File** | src/services/sm2.ts |
| **Purpose** | SM-2 / Anki-style scheduler — handles New/Learning/Review/Relearning states, learning steps, lapse detection |
| **Key exports** | `createReviewState`, `updateReviewState`, `AnkiButton` (type) |
| **Key dependencies** | fsrsScheduler (difficulty bridging), balance.ts (SM2_* constants) |

## inRunFactTracker

| | |
|---|---|
| **File** | src/services/inRunFactTracker.ts |
| **Purpose** | Per-run fact performance tracker — Anki three-state (NEW/LEARNING/GRADUATED) with 8-card learning cap; separate from global FSRS |
| **Key exports** | `InRunFactTracker` (class with `recordCharge`, `getState`, `isGraduated`, `getStreakBonus`), `InRunFactState` (interface) |
| **Key dependencies** | curatedDeckTypes |

## confusionMatrix

| | |
|---|---|
| **File** | src/services/confusionMatrix.ts |
| **Purpose** | Records and queries which facts a player confuses with each other; persists to PlayerSave |
| **Key exports** | `ConfusionMatrix` (class with `recordConfusion`, `getTopConfusions`, `toJSON`, `fromJSON`), `ConfusionEntry` (interface) |
| **Key dependencies** | None |

## confusionMatrixStore

| | |
|---|---|
| **File** | src/services/confusionMatrixStore.ts |
| **Purpose** | Global singleton wrapper for ConfusionMatrix — initializes from PlayerSave, exposes `getConfusionMatrix`, `saveConfusionMatrix` |
| **Key exports** | `initConfusionMatrix`, `getConfusionMatrix`, `saveConfusionMatrix` |
| **Key dependencies** | confusionMatrix, playerData store |

## archetypeDetector

| | |
|---|---|
| **File** | src/services/archetypeDetector.ts |
| **Purpose** | Detects player archetype (explorer/scholar/collector/sprinter) from run stats by Day 7; re-evaluates weekly |
| **Key exports** | `detectArchetype`, `evaluateArchetype`, `DEFAULT_ARCHETYPE_DATA`, `PlayerArchetype` (type), `ArchetypeData` (interface) |
| **Key dependencies** | None (pure scoring on SaveForArchetype) |

## engagementScorer

| | |
|---|---|
| **File** | src/services/engagementScorer.ts |
| **Purpose** | Rolling 7-day engagement score (0–100) driving nurture/normal/challenge mode; updates daily snapshots |
| **Key exports** | `computeEngagementScore`, `updateDailySnapshot`, `DEFAULT_ENGAGEMENT_DATA`, `EngagementData` (interface) |
| **Key dependencies** | None (pure math) |

## behavioralLearner

| | |
|---|---|
| **File** | src/services/behavioralLearner.ts |
| **Purpose** | Tracks positive behavioral signals per category (voluntary study sessions, artifacts kept, fast mastery) to infer interest |
| **Key exports** | `recordVoluntaryStudy`, `recordArtifactKept`, `recordFastMastery`, `inferInterestBoosts`, `BehavioralSignals` (interface) |
| **Key dependencies** | interestConfig, categories |

## masteryScalingService

| | |
|---|---|
| **File** | src/services/masteryScalingService.ts |
| **Purpose** | Computes deck mastery percentage and scales reward multipliers based on mastery level and pool size |
| **Key exports** | `calculateDeckMastery`, `getRewardMultiplier`, `isPracticeRun` |
| **Key dependencies** | tierDerivation, studyPresetService, balance.ts |

## learningInsights

| | |
|---|---|
| **File** | src/services/learningInsights.ts |
| **Purpose** | Client-side learning analytics from SM-2 review history — category strengths, retention predictions, weak spots |
| **Key exports** | `computeLearningInsights`, `LearningInsights` (interface), `CategoryStrength` (interface), `RetentionPrediction` (interface) |
| **Key dependencies** | engagementScorer (EngagementData injected) |

## studyScore

| | |
|---|---|
| **File** | src/services/studyScore.ts |
| **Purpose** | Computes a 0–1 study score from mastery ratio, review debt, and recent session frequency; used for reward quality |
| **Key exports** | `computeStudyScore` |
| **Key dependencies** | None (pure math on PlayerSave) |

## wowScore

| | |
|---|---|
| **File** | src/services/wowScore.ts |
| **Purpose** | Maps SM-2 review state to a 1–5 star Kid Mode display (wow level + encouraging label + CSS color class) |
| **Key exports** | `getWowScore`, `WowScore` (interface), `WowLevel` (type) |
| **Key dependencies** | None (pure math on ReviewState) |
