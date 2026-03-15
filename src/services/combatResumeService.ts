export interface CombatResumeOptions {
  floor: number
  ensurePhaserBooted: () => Promise<void>
  startEncounter: () => Promise<boolean>
  hasTurnState: () => boolean
  onCombatResumed: () => void
  onFallbackMap: (floor: number) => void
  logger?: Pick<Console, 'warn' | 'error'>
}

export type CombatResumeTarget = 'combat' | 'dungeonMap'

/**
 * Rebuild encounter state when resuming into combat.
 * Falls back to dungeon map when encounter init fails.
 */
export async function resumeCombatWithFallback(options: CombatResumeOptions): Promise<CombatResumeTarget> {
  const logger = options.logger ?? console

  try {
    await options.ensurePhaserBooted()
  } catch (error) {
    logger.error('[resume] Failed to boot Phaser before combat resume', error)
    options.onFallbackMap(options.floor)
    return 'dungeonMap'
  }

  try {
    const started = await options.startEncounter()
    if (!started) {
      logger.warn('[resume] Combat resume encounter start returned false; falling back to dungeon map')
      options.onFallbackMap(options.floor)
      return 'dungeonMap'
    }

    if (!options.hasTurnState()) {
      logger.warn('[resume] Combat resume started but turn state is null; falling back to dungeon map')
      options.onFallbackMap(options.floor)
      return 'dungeonMap'
    }

    options.onCombatResumed()
    return 'combat'
  } catch (error) {
    logger.error('[resume] Combat resume threw while rebuilding encounter', error)
    options.onFallbackMap(options.floor)
    return 'dungeonMap'
  }
}
