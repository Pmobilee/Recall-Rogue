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
| `player-moved` | `{ gridX, gridY, direction }` |
| `quiz-answer-submitted` | `{ factId, selectedDistractorIndex, isCorrect }` |
| `score-updated` | `{ dust, shards, crystals, geodes, essence }` |
| `gaia-toast-requested` | `{ message, mood, duration? }` |
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
| `relic-found` | `{ relic }` |
| `run-complete` | no payload used |
| `boss-encounter` | `Boss` |
| `gaia-toast` | `string` |
| `artifact-found` | `{ factId?, rarity?, addedToInventory, rarityBoosted? }` |

Note: `GameEventBridge.ts` may retain legacy mining event subscriptions as dead code. These are safe to ignore — no producers emit them in the current card roguelite codebase.
