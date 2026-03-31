# Combat Services

> **Purpose:** Turn management, card/relic effect resolution, encounter wiring, chain system, and player combat state.
> **Last verified:** 2026-03-31
> **Source files:** turnManager.ts, cardEffectResolver.ts, relicEffectResolver.ts, encounterBridge.ts, chainSystem.ts, chainVisuals.ts, playerCombatState.ts, surgeSystem.ts, knowledgeAuraSystem.ts, reviewQueueSystem.ts, enemyManager.ts, combatResumeService.ts, bossQuizPhase.ts, discoverySystem.ts, relicSynergyResolver.ts

## Overview

The combat layer is a pure-logic stack with no Phaser, Svelte, or DOM imports. `encounterBridge.ts` is the single wiring point connecting game-flow routing to combat internals. All state mutation flows through `turnManager`, which delegates to `cardEffectResolver` and `relicEffectResolver` for the actual math.

---

## turnManager

| | |
|---|---|
| **File** | src/services/turnManager.ts |
| **Purpose** | Core encounter loop — turn lifecycle, AP management, card play, enemy turns |
| **Key exports** | `startEncounter`, `playCardAction`, `skipCard`, `endPlayerTurn`, `resolveInscription`, `getActiveInscription`, `applyPendingChoice`, `revertTransmutedCards`, `resetFactLastSeenEncounter` |
| **Key dependencies** | cardEffectResolver, relicEffectResolver, deckManager, playerCombatState, enemyManager, chainSystem, knowledgeAuraSystem, reviewQueueSystem, surgeSystem, discoverySystem, cardUpgradeService |

## cardEffectResolver

| | |
|---|---|
| **File** | src/services/cardEffectResolver.ts |
| **Purpose** | Pure function: computes `CardEffectResult` from a card play. No state mutation. |
| **Key exports** | `resolveCardEffect`, `isCardBlocked`, `CardEffectResult` (interface) |
| **Key dependencies** | relicEffectResolver, cardUpgradeService, knowledgeAuraSystem, balance.ts, mechanics.ts |

## relicEffectResolver

| | |
|---|---|
| **File** | src/services/relicEffectResolver.ts |
| **Purpose** | Pure functions computing relic bonuses from a held-relic Set. No side effects, no store imports. |
| **Key exports** | `getMaxRelicSlots`, `resolveAttackModifiers`, `resolveShieldModifiers`, `resolvePoisonDurationBonus`, `resolvePoisonTickBonus`, plus ~20 per-trigger resolvers |
| **Key dependencies** | relicSynergyResolver, balance.ts |

## encounterBridge

| | |
|---|---|
| **File** | src/services/encounterBridge.ts |
| **Purpose** | Bridges game-flow screen routing to combat systems; handles encounter start/end, deck building, and reward generation |
| **Key exports** | `startEncounter`, `playCardAction`, `skipCard`, `endPlayerTurn`, `buildRunPool`, `recordRunFacts`, `addCardToDeck`, `getEncounterSeenFacts`, `serializeEncounterSnapshot`, `EncounterSnapshot` (interface) |
| **Key dependencies** | turnManager, deckManager, enemyManager, runManager, runPoolBuilder, floorManager, relicEffectResolver, analyticsService, bountyManager, juiceManager |

## chainSystem

| | |
|---|---|
| **File** | src/services/chainSystem.ts |
| **Purpose** | Tracks Knowledge Chain state per turn — consecutive same-chainType correct charges multiply damage |
| **Key exports** | `resetChain`, `extendOrResetChain`, `getChainState`, `getCurrentChainLength`, `ChainState` (interface) |
| **Key dependencies** | balance.ts (CHAIN_MULTIPLIERS, MAX_CHAIN_LENGTH) |

## chainVisuals

| | |
|---|---|
| **File** | src/services/chainVisuals.ts |
| **Purpose** | Maps chainType (0–5) to hex colors and glow colors; groups cards by chainType for CardHand UI |
| **Key exports** | `getChainColor`, `getChainGlowColor`, `getChainColorGroups` |
| **Key dependencies** | chainTypes.ts |

## playerCombatState

| | |
|---|---|
| **File** | src/services/playerCombatState.ts |
| **Purpose** | Manages player HP/shield/status within a single encounter. Pure logic, no Phaser/Svelte. |
| **Key exports** | `createPlayerCombatState`, `applyShield`, `takeDamage`, `healPlayer`, `tickPlayerStatusEffects`, `resetTurnState`, `PlayerCombatState` (interface) |
| **Key dependencies** | statusEffects.ts, balance.ts |

## surgeSystem

| | |
|---|---|
| **File** | src/services/surgeSystem.ts |
| **Purpose** | Knowledge Surge — every Nth global turn, Charge costs 0 AP instead of +1 |
| **Key exports** | `isSurgeTurn`, `getSurgeChargeSurcharge` |
| **Key dependencies** | balance.ts (SURGE_FIRST_TURN, SURGE_INTERVAL) |

## knowledgeAuraSystem

| | |
|---|---|
| **File** | src/services/knowledgeAuraSystem.ts |
| **Purpose** | Brain Fog gauge (0–10): wrong answers raise fog, correct answers lower it. High fog = enemies +20% dmg; low fog = Flow State (+1 card draw) |
| **Key exports** | `resetAura`, `adjustAura`, `getAuraLevel`, `getAuraState`, `AuraSnapshot` (interface) |
| **Key dependencies** | None (module-level state) |

## reviewQueueSystem

| | |
|---|---|
| **File** | src/services/reviewQueueSystem.ts |
| **Purpose** | Per-encounter list of fact IDs from wrong Charge answers, used by Recall card and Scholar's Crown relic |
| **Key exports** | `resetReviewQueue`, `addToReviewQueue`, `clearReviewQueueFact`, `isReviewQueueFact`, `getReviewQueue` |
| **Key dependencies** | None (module-level array) |

## enemyManager

| | |
|---|---|
| **File** | src/services/enemyManager.ts |
| **Purpose** | Creates enemy instances, selects intents, applies damage, handles enemy turn execution and status ticks |
| **Key exports** | `createEnemy`, `applyDamageToEnemy`, `executeEnemyIntent`, `rollNextIntent`, `tickEnemyStatusEffects`, `dispatchEnemyTurnStart`, `getFloorScaling`, `getFloorDamageScaling` |
| **Key dependencies** | relicEffectResolver, knowledgeAuraSystem, statusEffects.ts, balance.ts, enemies.ts |

## combatResumeService

| | |
|---|---|
| **File** | src/services/combatResumeService.ts |
| **Purpose** | Handles app-resume into mid-combat state; falls back to dungeon map if encounter re-init fails |
| **Key exports** | `resumeCombatWithFallback`, `CombatResumeOptions` (interface), `CombatResumeTarget` (type) |
| **Key dependencies** | None (pure logic accepting injected callbacks) |

## bossQuizPhase

| | |
|---|---|
| **File** | src/services/bossQuizPhase.ts |
| **Purpose** | Boss quiz phase threshold detection, question generation, and result resolution for boss health-gate quiz interrupts |
| **Key exports** | `detectBossQuizPhase`, `generateBossQuizQuestion`, `resolveBossQuizResult`, `QuizQuestion` (interface) |
| **Key dependencies** | factsDB, nonCombatQuizSelector, confusionMatrixStore, balance.ts |

## discoverySystem

| | |
|---|---|
| **File** | src/services/discoverySystem.ts |
| **Purpose** | "Free First Charge" system — first Charge of each fact per run is free (no AP surcharge, no wrong penalty) |
| **Key exports** | `isFirstChargeFree`, `markFirstChargeUsed`, `getFirstChargeWrongMultiplier` |
| **Key dependencies** | None (uses injected Set from RunState) |

## relicSynergyResolver

| | |
|---|---|
| **File** | src/services/relicSynergyResolver.ts |
| **Purpose** | Hidden relic synergy combos — defines emergent bonuses from holding specific relic pairs/trios |
| **Key exports** | `hasSynergy`, `getActiveSynergies`, `getMasteryAscensionBonus`, `SynergyDefinition` (interface) |
| **Key dependencies** | None (pure data + held-relic Set) |
