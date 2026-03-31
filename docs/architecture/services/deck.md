# Deck Management Services

> **Purpose:** Deck lifecycle (draw/discard/reshuffle), card factory, pool building, type allocation, upgrades, domain resolution, and library browsing.
> **Last verified:** 2026-03-31
> **Source files:** deckManager.ts, cardFactory.ts, cardTypeAllocator.ts, cardUpgradeService.ts, runPoolBuilder.ts, presetPoolBuilder.ts, domainResolver.ts, domainSubcategoryService.ts, tierDerivation.ts, cardDescriptionService.ts, libraryService.ts, studyPresetService.ts, deckOptionsService.ts, deckProgressService.ts, presetSelectionService.ts

## Overview

Deck management is split by run mode: `runPoolBuilder` handles standard domain runs; `presetPoolBuilder` handles multi-domain preset runs. Both produce a pool of `Card` objects by calling `cardFactory`, which maps `Fact + ReviewState → Card` using `tierDerivation` for tier and `cardTypeAllocator` for mechanic type. During combat `deckManager` owns the active hand/draw/discard state.

---

## deckManager

| | |
|---|---|
| **File** | src/services/deckManager.ts |
| **Purpose** | Active run deck state — draw pile, hand, discard pile, cooldowns, and per-encounter seen-fact deduplication |
| **Key exports** | `createDeck`, `drawHand`, `discardHand`, `playCard`, `insertCardWithDelay`, `addCardToDeck`, `addFactsToCooldown`, `tickFactCooldowns`, `getEncounterSeenFacts`, `resetEncounterSeenFacts`, `exhaustCard`, `reshuffleEvent` (store) |
| **Key dependencies** | factsDB, domainResolver, seededRng, randomUtils, activeRunState |

## cardFactory

| | |
|---|---|
| **File** | src/services/cardFactory.ts |
| **Purpose** | Creates `Card` objects from `Fact + ReviewState`; computes tier, type, and effect values |
| **Key exports** | `createCard`, `computeTier`, `resetCardIdCounter` |
| **Key dependencies** | tierDerivation, cardTypeAllocator, domainResolver, balance.ts |

## cardTypeAllocator

| | |
|---|---|
| **File** | src/services/cardTypeAllocator.ts |
| **Purpose** | Assigns mechanic types to cards via weighted distribution (attack 40%, shield 35%, buff/debuff/utility/wild remainder); deterministic when seeded RNG is active |
| **Key exports** | `assignTypesToCards`, `deriveCardTypeForFactId`, `pickWeightedType`, `CARD_TYPE_DISTRIBUTION` |
| **Key dependencies** | seededRng |

## cardUpgradeService

| | |
|---|---|
| **File** | src/services/cardUpgradeService.ts |
| **Purpose** | In-run mastery upgrade system (AR-113) and legacy rest-site upgrades; per-mechanic mastery level deltas |
| **Key exports** | `canMasteryUpgrade`, `canMasteryDowngrade`, `masteryUpgrade`, `masteryDowngrade`, `getMasteryBaseBonus`, `getMasterySecondaryBonus`, `resetEncounterMasteryFlags`, `upgradeCard`, `canUpgradeCard`, `MASTERY_UPGRADE_DEFS` |
| **Key dependencies** | mechanics.ts, balance.ts |

## runPoolBuilder

| | |
|---|---|
| **File** | src/services/runPoolBuilder.ts |
| **Purpose** | Builds the run card pool from a primary+secondary domain split (pool primary/secondary/subcategory percentages from balance.ts) |
| **Key exports** | `buildRunPool`, `recordRunFacts` |
| **Key dependencies** | factsDB, cardFactory, cardTypeAllocator, chainTypes, mechanics.ts, seededRng, funnessBoost, characterLevel |

## presetPoolBuilder

| | |
|---|---|
| **File** | src/services/presetPoolBuilder.ts |
| **Purpose** | Builds run pools from study presets — proportional distribution across any number of selected domains with optional subcategory filtering |
| **Key exports** | `buildPresetPool` |
| **Key dependencies** | factsDB, cardFactory, cardTypeAllocator, presetSelectionService, seededRng, funnessBoost |

## domainResolver

| | |
|---|---|
| **File** | src/services/domainResolver.ts |
| **Purpose** | Maps raw fact category strings (both snake_case and legacy Title Case) to canonical `FactDomain` values |
| **Key exports** | `resolveDomain`, `resolveCardType` |
| **Key dependencies** | cardTypeAllocator |

## domainSubcategoryService

| | |
|---|---|
| **File** | src/services/domainSubcategoryService.ts |
| **Purpose** | Returns sorted subcategory lists with fact counts for a domain; memoized at module level |
| **Key exports** | `getDomainSubcategories`, `DomainSubcategoryInfo` (interface) |
| **Key dependencies** | factsDB, domainResolver, subcategoryTaxonomy |

## tierDerivation

| | |
|---|---|
| **File** | src/services/tierDerivation.ts |
| **Purpose** | Pure functions deriving card tier (1/2a/2b/3) and display names from FSRS stability/streak/mastery trial state |
| **Key exports** | `getCardTier`, `getTierDisplayName`, `getDisplayTier`, `qualifiesForMasteryTrial` |
| **Key dependencies** | None (pure math on TierStateLike) |

## cardDescriptionService

| | |
|---|---|
| **File** | src/services/cardDescriptionService.ts |
| **Purpose** | Generates human-readable mechanic descriptions with actual damage/shield values for card reward/inspect screens |
| **Key exports** | `getDetailedCardDescription`, `getShortCardDescription` |
| **Key dependencies** | cardUpgradeService, mechanics.ts |

## libraryService

| | |
|---|---|
| **File** | src/services/libraryService.ts |
| **Purpose** | Computes domain summary stats and per-fact entries for the Library screen; supports tier/sort filtering |
| **Key exports** | `getDomainSummaries`, `getFactsForDomain`, `LibraryDomainSummary` (interface), `LibraryFactEntry` (interface) |
| **Key dependencies** | factsDB, domainResolver, tierDerivation, domainMetadata |

## studyPresetService

| | |
|---|---|
| **File** | src/services/studyPresetService.ts |
| **Purpose** | CRUD for study presets stored in player save; enforces MAX_PRESETS and MIN_FAIR_POOL_SIZE |
| **Key exports** | `getPresets`, `getPresetById`, `createPreset`, `updatePreset`, `deletePreset`, `validatePresetPoolSize` |
| **Key dependencies** | factsDB, presetSelectionService, playerData store |

## deckOptionsService

| | |
|---|---|
| **File** | src/services/deckOptionsService.ts |
| **Purpose** | Persisted Svelte store for per-language deck option toggles (e.g. kanji on/off) |
| **Key exports** | `languageDeckOptions` (store), `LanguageDeckOptionsMap` (type) |
| **Key dependencies** | Svelte stores, localStorage |

## deckProgressService

| | |
|---|---|
| **File** | src/services/deckProgressService.ts |
| **Purpose** | Computes per-deck and per-sub-deck progress from global FSRS state (mastery = stability >= 21 days) |
| **Key exports** | `getDeckProgress`, `getSubDeckProgress`, `DeckProgress` (interface), `SubDeckProgress` (interface) |
| **Key dependencies** | deckFactIndex, deckRegistry, playerData store |

## presetSelectionService

| | |
|---|---|
| **File** | src/services/presetSelectionService.ts |
| **Purpose** | Fact-matching predicates for domain selection and preset selection; includes Japanese JLPT level/subdeck key helpers |
| **Key exports** | `factMatchesDomainSelection`, `factMatchesPresetSelection`, `JAPANESE_DECK_GROUPS`, `getJapaneseSelectionKeys` |
| **Key dependencies** | domainResolver |
