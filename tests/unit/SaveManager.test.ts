// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SaveManager, AUTO_SAVE_TICK_INTERVAL } from '../../src/game/managers/SaveManager'
import { DIVE_SAVE_VERSION } from '../../src/data/saveState'
import type { DiveSaveState } from '../../src/data/saveState'

// localStorage is provided by tests/setup.ts global mock

function makeDiveSave(overrides: Partial<DiveSaveState> = {}): DiveSaveState {
  return {
    version: DIVE_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    mineGrid: [],
    playerPos: { x: 5, y: 10 },
    inventorySnapshot: [],
    ticks: 0,
    layer: 3,
    biomeId: 'crystalline_caves',
    o2: 75,
    diveSeed: 42,
    relicIds: [],
    consumables: [],
    bankedMinerals: {},
    sameLayerDeathCount: 0,
    lastDeathLayer: -1,
    ...overrides,
  }
}

describe('SaveManager constants', () => {
  it('AUTO_SAVE_TICK_INTERVAL is 30', () => {
    expect(AUTO_SAVE_TICK_INTERVAL).toBe(30)
  })
})

describe('SaveManager.hasSave', () => {
  it('returns false when nothing is stored', () => {
    expect(SaveManager.hasSave()).toBe(false)
  })

  it('returns true after save()', () => {
    SaveManager.save(makeDiveSave())
    expect(SaveManager.hasSave()).toBe(true)
  })

  it('returns false after clear()', () => {
    SaveManager.save(makeDiveSave())
    SaveManager.clear()
    expect(SaveManager.hasSave()).toBe(false)
  })
})

describe('SaveManager.save', () => {
  it('writes JSON to localStorage', () => {
    const state = makeDiveSave()
    SaveManager.save(state)
    expect(localStorage.setItem).toHaveBeenCalledOnce()
  })

  it('persists the layer field', () => {
    const state = makeDiveSave({ layer: 7 })
    SaveManager.save(state)
    const args = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0]
    const written = JSON.parse(args[1])
    expect(written.layer).toBe(7)
  })

  it('stamps a current savedAt timestamp', () => {
    const state = makeDiveSave({ savedAt: '' })
    SaveManager.save(state)
    const args = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0]
    const written = JSON.parse(args[1])
    expect(written.savedAt).toBeTruthy()
    expect(written.savedAt).not.toBe('')
  })

  it('always writes the current DIVE_SAVE_VERSION', () => {
    const state = makeDiveSave({ version: 999 as number })
    SaveManager.save(state)
    const args = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0]
    const written = JSON.parse(args[1])
    expect(written.version).toBe(DIVE_SAVE_VERSION)
  })
})

describe('SaveManager.load', () => {
  it('returns null when nothing is stored', () => {
    expect(SaveManager.load()).toBeNull()
  })

  it('returns a valid save after save()', () => {
    const state = makeDiveSave({ layer: 7 })
    SaveManager.save(state)
    const loaded = SaveManager.load()
    expect(loaded).not.toBeNull()
    expect(loaded!.layer).toBe(7)
  })

  it('returns null and calls clear on version mismatch', () => {
    // Manually write a save with a wrong version to localStorage
    const rawKey = 'terra_miner_dive_save'
    const badSave = JSON.stringify({ ...makeDiveSave(), version: 9999 })
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(badSave)

    const loaded = SaveManager.load()
    expect(loaded).toBeNull()
    expect(localStorage.removeItem).toHaveBeenCalled()
  })

  it('returns null on invalid JSON', () => {
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('not-valid-json{{{')
    const loaded = SaveManager.load()
    expect(loaded).toBeNull()
  })

  it('preserves all critical fields round-trip', () => {
    const state = makeDiveSave({ o2: 42, ticks: 150, biomeId: 'volcanic_depths' })
    SaveManager.save(state)
    const loaded = SaveManager.load()
    expect(loaded!.o2).toBe(42)
    expect(loaded!.ticks).toBe(150)
    expect(loaded!.biomeId).toBe('volcanic_depths')
  })
})

describe('SaveManager.clear', () => {
  it('removes the save key from localStorage', () => {
    SaveManager.save(makeDiveSave())
    SaveManager.clear()
    expect(localStorage.removeItem).toHaveBeenCalled()
  })
})
