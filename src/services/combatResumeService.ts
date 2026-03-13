export interface CombatResumeOptions {
  floor: number
  ensurePhaserBooted: () => Promise<void>
  startEncounter: () => Promise<boolean>
  hasTurnState: () => boolean
  onCombatResumed: () => void
  onFallbackRoomSelection: (floor: number) => void
  logger?: Pick<Console, 'warn' | 'error'>
}

export type CombatResumeTarget = 'combat' | 'roomSelection'

/**
 * Rebuild encounter state when resuming into combat.
 * Falls back to room selection when encounter init fails.
 */
export async function resumeCombatWithFallback(options: CombatResumeOptions): Promise<CombatResumeTarget> {
  const logger = options.logger ?? console

  try {
    await options.ensurePhaserBooted()
  } catch (error) {
    logger.error('[resume] Failed to boot Phaser before combat resume', error)
    options.onFallbackRoomSelection(options.floor)
    return 'roomSelection'
  }

  try {
    const started = await options.startEncounter()
    if (!started) {
      logger.warn('[resume] Combat resume encounter start returned false; falling back to room selection')
      options.onFallbackRoomSelection(options.floor)
      return 'roomSelection'
    }

    if (!options.hasTurnState()) {
      logger.warn('[resume] Combat resume started but turn state is null; falling back to room selection')
      options.onFallbackRoomSelection(options.floor)
      return 'roomSelection'
    }

    options.onCombatResumed()
    return 'combat'
  } catch (error) {
    logger.error('[resume] Combat resume threw while rebuilding encounter', error)
    options.onFallbackRoomSelection(options.floor)
    return 'roomSelection'
  }
}
