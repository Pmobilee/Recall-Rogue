# AR-119: Remaining Relic Wiring — Complex System Integrations

## Overview
These relics from AR-117 audit need major new systems or UI flows to implement. Deferred from the initial audit sprint.

## Relics Needing New Systems

| Relic | Effect | Blocker |
|-------|--------|---------|
| double_down | Charge same card twice (5x/1.5x/0.3x outcomes) | Needs double-quiz UI flow |
| mirror_of_knowledge | After charge correct, replay card at 1.5x (no quiz, no AP) | Needs replay mechanic + encounter flag |
| chain_reactor | Chains 2+ deal 6 splash damage per link | Chain system doesn't support damage events |
| echo_chamber | 2+ chain replays first card at 60% power | Chain system needs card replay support |
| prismatic_shard | All chain multipliers +0.5x, 5-chains grant +1 AP | Chain multiplier system needs relic hooks |
| resonance_crystal | Each chain link beyond 2 draws +1 card at end of turn | Chain system needs draw bonus hooks |
| tag_magnet | +30% chance to draw same-chain-type cards | Draw pile needs weighted drawing |
| insight_prism | Wrong charge reveals answer; next same-fact auto-succeeds | Discovery system integration |
| plague_flask | Poison ticks +2 damage, lasts 1 extra turn | Status effect system needs relic scaling |
| time_warp | Surge turns: timer halved, 5.0x multiplier, +1 AP | Surge system needs relic hooks |

## Suggested Implementation Order
1. Chain-related relics (reactor, echo_chamber, prismatic, resonance) — batch together
2. mirror_of_knowledge — simpler replay mechanic
3. insight_prism — discovery system hook
4. tag_magnet — draw bias
5. double_down — complex UI
6. plague_flask — status effect scaling
7. time_warp — surge hooks

## Files Affected
- `src/services/relicEffectResolver.ts`
- `src/services/turnManager.ts`
- `src/services/deckManager.ts` (tag_magnet draw bias)
- `src/ui/components/CardCombatOverlay.svelte` (double_down UI)
- Chain system files (chain-related relics)
- Status effect system (plague_flask)
