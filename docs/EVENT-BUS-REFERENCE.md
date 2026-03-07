# Event Bus Reference

This project currently has three event channels in code:

1. a typed global `EventBus` (`src/events/EventBus.ts`)
2. a typed hub-scene bus (`src/game/hubEvents.ts`)
3. Phaser `game.events` consumed in `src/game/GameEventBridge.ts`

In active runtime flow, Phaser `game.events` + `GameEventBridge` is the primary path.

## 1) Global typed EventBus

Files: `src/events/EventBus.ts`, `src/events/types.ts`

API surface:

| API | Purpose |
| --- | --- |
| `on(event, handler)` | Subscribe and receive typed payloads |
| `off(event, handler)` | Unsubscribe |
| `emit(event, payload?)` | Synchronous dispatch |
| `emitAsync(event, payload?)` | Microtask-delayed dispatch |
| `clear()` | Remove all handlers |

Event map (`GameEventMap`):

| Event | Payload |
| --- | --- |
| `block-mined` | `{ x, y, blockType, loot[] }` |
| `player-moved` | `{ gridX, gridY, direction }` |
| `oxygen-changed` | `{ current, max, delta, cause }` |
| `quiz-answer-submitted` | `{ factId, selectedDistractorIndex, isCorrect }` |
| `layer-transition` | `{ fromLayer, toLayer, biome }` |
| `score-updated` | `{ dust, shards, crystals, geodes, essence }` |
| `gaia-toast-requested` | `{ message, mood, duration? }` |
| `dive-start-requested` | `void` |
| `dive-end-requested` | `void` |
| `save-requested` | `void` |

Note: this typed bus is defined and ready, but no production call sites currently use `eventBus` outside its own module example comments.

## 2) Hub typed bus

File: `src/game/hubEvents.ts`

Used for DomeScene to Svelte communication without coupling Svelte stores directly into Phaser scene code.

| Event | Args |
| --- | --- |
| `objectTap` | `(objectId: string, action: string)` |
| `floorChanged` | `(index: number)` |
| `gaia-bubble-tap` | `(text: string)` |
| `gallery-painting-tap` | `(paintingId: string)` |
| `gallery-overview-tap` | `()` |
| `painting-reveal-complete` | `(paintingId: string)` |

Current producers/consumers:

- Producers: `src/game/scenes/DomeScene.ts`
- Consumer: `src/ui/components/HubView.svelte`

## 3) Phaser `game.events` channels in GameEventBridge

File: `src/game/GameEventBridge.ts`

`wireEventBridge(gm, events)` subscribes to these channels:

| Event name | Payload hint |
| --- | --- |
| `mine-started` | `{ seed, oxygen, inventorySlots, layer? }` |
| `oxygen-changed` | `OxygenState` |
| `depth-changed` | `number` |
| `mineral-collected` | `{ mineralType?, mineralAmount?, addedToInventory }` |
| `cave-in` | `{ affectedCount }` |
| `earthquake` | `{ collapsed, revealed }` |
| `artifact-found` | `{ factId?, rarity?, addedToInventory, rarityBoosted? }` |
| `oxygen-restored` | no payload used |
| `oxygen-tank-found` | no payload used |
| `upgrade-found` | `{ upgrade }` |
| `pickaxe-upgraded` | `{ tierIndex, tierName }` |
| `backpack-expanded` | `{ slotsAdded, totalSlots, expansionCount }` |
| `bomb-used` | `{ remaining }` |
| `scanner-upgraded` | `{ tierIndex, tierName }` |
| `relic-found` | `{ relic }` |
| `blocks-mined-update` | `number` |
| `quiz-gate` | `{ factId?, gateX?, gateY?, gateRemaining?, gateTotal? }` |
| `oxygen-quiz` | `{ factId?, oxygenAmount }` |
| `exit-reached` | no payload used |
| `artifact-quiz` | `{ factId?, artifactRarity?, questionsRemaining?, questionsTotal?, boostedSoFar? }` |
| `random-quiz` | no payload used |
| `oxygen-depleted` | no payload used |
| `open-backpack` | no payload used |
| `run-complete` | no payload used |
| `layer-entrance-quiz` | `{ layer }` |
| `descent-shaft-entered` | `{ layer, inventory, blocksMinedThisRun, artifactsFound, oxygenState }` |
| `quote-found` | `{ quote }` |
| `send-up-station` | `{ inventory }` |
| `data-disc-found` | no payload used |
| `fossil-found` | `{ x, y }` |
| `companion-triggered` | `{ effect }` |
| `hazard-lava-contact` | no payload used |
| `hazard-gas-contact` | no payload used |
| `gaia-toast` | `string` |
| `descent-animation-start` | `{ fromLayer, toLayer, biomeName }` |
| `chest-opened` | `{ layer }` |
| `altar-adjacent` | `{ x, y }` |
| `locked-block-denied` | `{ requiredTier }` |
| `fragment-collected` | `{ fragmentId }` |
| `mine-event` | `{ type }` |
| `boss-encounter` | `Boss` |
| `creature-encounter` | `Creature` |
| `the-deep-unlocked` | no payload used |

Related browser-side event:

- `window` listener in `GameEventBridge` handles `layer-challenge-answer` custom events (`detail: { correct: boolean }`).
