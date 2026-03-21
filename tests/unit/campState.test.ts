import { beforeEach, describe, expect, it } from 'vitest'
import {
  CAMP_MAX_TIERS,
  campState,
  getCampUpgradeCost,
  setActiveCampPet,
  setCampOutfit,
  setCampTier,
  unlockCampPet,
  type CampState,
} from '../../src/ui/stores/campState'

const STORAGE_KEY = 'recall-rogue-camp-state'

const DEFAULT_STATE: CampState = {
  tiers: {
    tent: 0,
    character: 0,
    pet: 0,
    campfire: 0,
    library: 0,
    questboard: 0,
    shop: 0,
    journal: 0,
    doorway: 0,
  },
  outfit: 'scout',
  activePet: 'cat',
  unlockedPets: ['cat'],
}

function readStore(): CampState {
  let current = DEFAULT_STATE
  const unsub = campState.subscribe((value) => {
    current = value
  })
  unsub()
  return current
}

describe('campState store', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    campState.set(DEFAULT_STATE)
  })

  it('returns expected upgrade costs and null after max tier', () => {
    expect(getCampUpgradeCost('tent', 0)).toBe(60)
    expect(getCampUpgradeCost('tent', 1)).toBe(120)
    expect(getCampUpgradeCost('tent', 2)).toBe(200)
    expect(getCampUpgradeCost('tent', CAMP_MAX_TIERS.tent)).toBeNull()
  })

  it('clamps tier writes to [0, CAMP_MAX_TIERS.tent]', () => {
    setCampTier('tent', 999)
    expect(readStore().tiers.tent).toBe(CAMP_MAX_TIERS.tent)

    setCampTier('tent', -2)
    expect(readStore().tiers.tent).toBe(0)
  })

  it('unlocks pets once and auto-selects newly unlocked pet', () => {
    unlockCampPet('owl')
    unlockCampPet('owl')

    const state = readStore()
    expect(state.unlockedPets).toEqual(['cat', 'owl'])
    expect(state.activePet).toBe('owl')
  })

  it('prevents selecting locked pets and allows unlocked pets', () => {
    setActiveCampPet('fox')
    expect(readStore().activePet).toBe('cat')

    unlockCampPet('fox')
    setActiveCampPet('fox')
    expect(readStore().activePet).toBe('fox')
  })

  it('updates outfit and persists state to localStorage', () => {
    setCampOutfit('vanguard')

    const saved = window.localStorage.getItem(STORAGE_KEY)
    expect(saved).not.toBeNull()
    expect(saved).toContain('"outfit":"vanguard"')
  })
})
