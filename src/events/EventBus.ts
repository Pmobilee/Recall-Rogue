// src/events/EventBus.ts

import type { GameEventMap } from './types'

type Handler<T> = T extends void ? () => void : (data: T) => void
type EventName = keyof GameEventMap

/**
 * Typed singleton event bus for cross-boundary communication.
 *
 * Usage:
 *   eventBus.emit('block-mined', { x: 3, y: 5, blockType: BlockType.Stone, loot: [] })
 *   eventBus.on('block-mined', (data) => { console.log(data.blockType) })
 */
export class EventBus {
  private handlers = new Map<EventName, Set<Function>>()

  /**
   * Registers a handler for an event.
   * Returns an unsubscribe function.
   */
  public on<K extends EventName>(
    event: K,
    handler: Handler<GameEventMap[K]>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  /**
   * Removes a previously registered handler.
   */
  public off<K extends EventName>(
    event: K,
    handler: Handler<GameEventMap[K]>,
  ): void {
    this.handlers.get(event)?.delete(handler)
  }

  /**
   * Dispatches a synchronous event to all registered handlers.
   * Use for game-critical events (block mined, movement, oxygen).
   */
  public emit<K extends EventName>(
    event: K,
    ...args: GameEventMap[K] extends void ? [] : [GameEventMap[K]]
  ): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) {
      handler(args[0])
    }
  }

  /**
   * Dispatches an async event via queueMicrotask.
   * Use for UI update events (score display, toasts, overlay open/close).
   */
  public emitAsync<K extends EventName>(
    event: K,
    ...args: GameEventMap[K] extends void ? [] : [GameEventMap[K]]
  ): void {
    queueMicrotask(() => this.emit(event, ...(args as any)))
  }

  /** Removes all handlers — call on game teardown. */
  public clear(): void {
    this.handlers.clear()
  }
}

/** Singleton instance — import and use directly. */
export const eventBus = new EventBus()
