# AR-271: Wire All Disconnected Mechanics + Status Effect Dots

## Overview
**Goal:** Fix 10 major disconnections where mechanic code exists but is never called from turnManager. Wire status effect dots so players can see active buffs/debuffs.
**Estimated complexity:** Medium (all code exists, just need to pass context and apply results)

## Disconnected Mechanics

### Card Resolver Context (3 cards)
| Card | Missing Field | Effect When Wired |
|------|--------------|-------------------|
| Recall | `wasReviewQueueFact` | Bonus damage + heal on review facts |
| Precision Strike | `distractorCount` | Damage scales with question difficulty |
| Knowledge Ward | `correctChargesThisEncounter` | Block scales with charge accuracy |

### Relic Resolver Context (4 relics)
| Relic | Missing Field | Effect When Wired |
|-------|--------------|-------------------|
| Scar Tissue | `scarTissueStacks` | +2 flat damage per wrong charge |
| Scholar's Crown | `wasReviewQueueFact` | +40% on review facts, +10% on others |
| Domain Mastery Sigil | `auraState` + apply `auraApModifier` | +1 AP in Flow, -1 AP in Brain Fog |
| Lucky Coin | `wrongChargesThisEncounter` + `luckyCoinArmed` | 1.5x after 3 wrongs |

### Status Effect Dots (3 items)
| Effect | Where | Trigger |
|--------|-------|---------|
| brain_fog / flow_state | Player | Push based on getAuraState() |
| stunned | Enemy | Push when enemy._stunNextTurn |
| hardcover | Enemy | Push when enemy._hardcover > 0 |

## Files Affected
- `src/services/turnManager.ts` — pass context to resolvers, apply results
- `src/ui/components/CardCombatOverlay.svelte` — push effects to arrays, fix aura badge
