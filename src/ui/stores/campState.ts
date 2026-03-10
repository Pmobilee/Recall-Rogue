import { writable } from 'svelte/store'

export type CampElement = 'tent' | 'seating' | 'campfire' | 'decor'
export type CampOutfit = 'scout' | 'warden' | 'scholar' | 'vanguard'
export type CampPet = 'cat' | 'owl' | 'fox' | 'dragon_whelp'

export interface CampState {
  tiers: Record<CampElement, number>
  outfit: CampOutfit
  activePet: CampPet
  unlockedPets: CampPet[]
}

const STORAGE_KEY = 'recall-rogue-camp-state'
export const CAMP_MAX_TIER = 3

const DEFAULT_CAMP_STATE: CampState = {
  tiers: {
    tent: 0,
    seating: 0,
    campfire: 0,
    decor: 0,
  },
  outfit: 'scout',
  activePet: 'cat',
  unlockedPets: ['cat'],
}

const UPGRADE_COSTS_BY_TIER = [120, 240, 420] as const

export const PET_UNLOCK_COSTS: Record<CampPet, number> = {
  cat: 0,
  owl: 180,
  fox: 260,
  dragon_whelp: 520,
}

function sanitizeState(raw: unknown): CampState {
  if (!raw || typeof raw !== 'object') return DEFAULT_CAMP_STATE
  const candidate = raw as Partial<CampState>
  const tiers = (candidate.tiers ?? {}) as Partial<Record<CampElement, number>>
  const unlocked: CampPet[] = Array.isArray(candidate.unlockedPets)
    ? candidate.unlockedPets.filter((pet): pet is CampPet =>
      pet === 'cat' || pet === 'owl' || pet === 'fox' || pet === 'dragon_whelp')
    : ['cat']

  const next: CampState = {
    tiers: {
      tent: Math.max(0, Math.min(CAMP_MAX_TIER, Number(tiers.tent ?? 0))),
      seating: Math.max(0, Math.min(CAMP_MAX_TIER, Number(tiers.seating ?? 0))),
      campfire: Math.max(0, Math.min(CAMP_MAX_TIER, Number(tiers.campfire ?? 0))),
      decor: Math.max(0, Math.min(CAMP_MAX_TIER, Number(tiers.decor ?? 0))),
    },
    outfit: candidate.outfit === 'warden' || candidate.outfit === 'scholar' || candidate.outfit === 'vanguard'
      ? candidate.outfit
      : 'scout',
    activePet: candidate.activePet === 'owl' || candidate.activePet === 'fox' || candidate.activePet === 'dragon_whelp'
      ? candidate.activePet
      : 'cat',
    unlockedPets: unlocked.length > 0 ? [...new Set(unlocked)] : ['cat'],
  }

  if (!next.unlockedPets.includes(next.activePet)) {
    next.activePet = next.unlockedPets[0] ?? 'cat'
  }

  return next
}

function loadCampState(): CampState {
  if (typeof window === 'undefined') return DEFAULT_CAMP_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CAMP_STATE
    return sanitizeState(JSON.parse(raw))
  } catch {
    return DEFAULT_CAMP_STATE
  }
}

export const campState = writable<CampState>(loadCampState())

if (typeof window !== 'undefined') {
  campState.subscribe((value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore quota/storage issues.
    }
  })
}

export function getCampUpgradeCost(currentTier: number): number | null {
  return UPGRADE_COSTS_BY_TIER[currentTier] ?? null
}

export function setCampTier(element: CampElement, tier: number): void {
  campState.update((state) => ({
    ...state,
    tiers: {
      ...state.tiers,
      [element]: Math.max(0, Math.min(CAMP_MAX_TIER, tier)),
    },
  }))
}

export function setCampOutfit(outfit: CampOutfit): void {
  campState.update((state) => ({ ...state, outfit }))
}

export function unlockCampPet(pet: CampPet): void {
  campState.update((state) => {
    if (state.unlockedPets.includes(pet)) return state
    return {
      ...state,
      unlockedPets: [...state.unlockedPets, pet],
      activePet: pet,
    }
  })
}

export function setActiveCampPet(pet: CampPet): void {
  campState.update((state) => {
    if (!state.unlockedPets.includes(pet)) return state
    return { ...state, activePet: pet }
  })
}
