import type { MineEventType } from '../../data/mineEvents'
import { BALANCE } from '../../data/balance'

/**
 * Random mine event dispatcher. (Phase 35.7)
 * Registered with TickSystem — fires one event per N ticks on average.
 */
export class MineEventSystem {
  private lastEventTick = 0
  private readonly onEvent: (type: MineEventType) => void

  /**
   * @param onEvent - Callback invoked when a mine event fires.
   */
  constructor(onEvent: (type: MineEventType) => void) {
    this.onEvent = onEvent
  }

  /**
   * Called by TickSystem each tick. May fire a random mine event.
   * @param tick - Global tick counter.
   * @param _layerTick - Layer-scoped tick counter (unused).
   */
  onTick(tick: number, _layerTick: number): void {
    const elapsed = tick - this.lastEventTick
    if (elapsed < BALANCE.MINE_EVENT_MIN_TICKS) return
    if (Math.random() < BALANCE.MINE_EVENT_CHANCE_PER_TICK) {
      this.lastEventTick = tick
      const types: MineEventType[] = ['tremor', 'gas_leak', 'relic_signal', 'crystal_vein', 'pressure_surge']
      const picked = types[Math.floor(Math.random() * types.length)]
      this.onEvent(picked)
    }
  }

  /** Reset the last-event-tick counter. Call on new dive or layer change. */
  reset(): void { this.lastEventTick = 0 }
}
