import { describe, expect, it, vi } from 'vitest'
import { resumeCombatWithFallback } from '../../src/services/combatResumeService'

describe('resumeCombatWithFallback', () => {
  it('resumes combat when encounter starts and turn state exists', async () => {
    const ensurePhaserBooted = vi.fn(async () => {})
    const startEncounter = vi.fn(async () => true)
    const hasTurnState = vi.fn(() => true)
    const onCombatResumed = vi.fn()
    const onFallbackMap = vi.fn()
    const logger = { warn: vi.fn(), error: vi.fn() }

    const target = await resumeCombatWithFallback({
      floor: 4,
      ensurePhaserBooted,
      startEncounter,
      hasTurnState,
      onCombatResumed,
      onFallbackMap,
      logger,
    })

    expect(target).toBe('combat')
    expect(ensurePhaserBooted).toHaveBeenCalledOnce()
    expect(startEncounter).toHaveBeenCalledOnce()
    expect(hasTurnState).toHaveBeenCalledOnce()
    expect(onCombatResumed).toHaveBeenCalledOnce()
    expect(onFallbackMap).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('falls back to dungeon map when encounter start fails', async () => {
    const ensurePhaserBooted = vi.fn(async () => {})
    const startEncounter = vi.fn(async () => false)
    const hasTurnState = vi.fn(() => false)
    const onCombatResumed = vi.fn()
    const onFallbackMap = vi.fn()
    const logger = { warn: vi.fn(), error: vi.fn() }

    const target = await resumeCombatWithFallback({
      floor: 7,
      ensurePhaserBooted,
      startEncounter,
      hasTurnState,
      onCombatResumed,
      onFallbackMap,
      logger,
    })

    expect(target).toBe('dungeonMap')
    expect(onFallbackMap).toHaveBeenCalledWith(7)
    expect(onCombatResumed).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledOnce()
  })

  it('falls back to dungeon map when start succeeds but turn state is missing', async () => {
    const ensurePhaserBooted = vi.fn(async () => {})
    const startEncounter = vi.fn(async () => true)
    const hasTurnState = vi.fn(() => false)
    const onCombatResumed = vi.fn()
    const onFallbackMap = vi.fn()
    const logger = { warn: vi.fn(), error: vi.fn() }

    const target = await resumeCombatWithFallback({
      floor: 9,
      ensurePhaserBooted,
      startEncounter,
      hasTurnState,
      onCombatResumed,
      onFallbackMap,
      logger,
    })

    expect(target).toBe('dungeonMap')
    expect(onFallbackMap).toHaveBeenCalledWith(9)
    expect(onCombatResumed).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledOnce()
  })
})
