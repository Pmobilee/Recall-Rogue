# Mystery Events

> **Purpose:** Mystery-room event pool, choice shape, and placeholder-risk tracking.
> **Last verified:** 2026-05-13 (single-choice count for alpha-readiness handoff)
> **Source files:** `src/services/floorManager.ts`, `src/ui/components/MysteryEventOverlay.svelte`

## Event Pool

`floorManager.generateMysteryEvent()` rolls one of three mystery sub-types:
combat ambush, card reward cache, or narrative event. Narrative events are
drawn from tiered pools in `floorManager.ts`; Act 1 uses Tier 1, Act 2 adds
Tier 2 and Tier 3, and Act 3 adds Tier 4.

Study-mode-only events are filtered out in Trivia Dungeon so the player does
not hit empty review or meditation rooms.

## Single-Action Events

The current narrative pool has 34 events. Eleven resolve through a single
Continue-style action rather than an explicit choice:

| Event | Effect |
|---|---|
| `reading_nook` | `upgradeRandomCard` |
| `whispering_shelf` | `freeCard` |
| `lost_and_found` | `currency` |
| `wrong_answer_museum` | `reviewMuseum` |
| `copyists_workshop` | `transformCard` |
| `ambush` | `combat` |
| `the_purge` | `compound` |
| `meditation_chamber` | `meditation` |
| `eraser_storm` | `compound` |
| `elite_ambush` | `combat` |
| `the_breakthrough` | `compound` |

These events are mechanically valid, but they carry placeholder risk when
shown as `?` mystery nodes because the room promises a decision and then offers
only a single action. Prefer converting future direct-reward events into either
explicit choices or non-mystery reward tiles.

## Recommended Rule

Mystery nodes should usually contain a decision, quiz, duel, timed challenge,
or gamble. Single-action events are acceptable only when they are clearly an
ambush or free-cache beat, and should eventually be surfaced as combat or
treasure-like nodes before the player enters them.
