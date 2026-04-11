import { writable } from 'svelte/store'

export type CampElement =
  | 'tent' | 'character' | 'pet' | 'campfire'
  | 'library' | 'questboard' | 'shop' | 'journal' | 'doorway'
export type CampOutfit = 'scout' | 'warden' | 'scholar' | 'vanguard'
export type CampPet = 'cat' | 'owl' | 'fox' | 'dragon_whelp'

export interface CampState {
  tiers: Record<CampElement, number>
  forms: Record<CampElement, number>
  outfit: CampOutfit
  activePet: CampPet
  unlockedPets: CampPet[]
}

const STORAGE_KEY = 'recall-rogue-camp-state'

/**
 * Per-element maximum upgrade tiers (tier 0 is base; these are the number of
 * upgrade levels). Declared first in desired iteration order — CAMP_ELEMENTS
 * is derived from Object.keys() which preserves insertion order for string keys.
 *
 * Tier numbers reflect the actual files on disk (all directories are contiguous
 * 0..maxTier after the 2026-04-11 sprite rename). journal and pet/campfire are
 * capped at 5 (6 sprites: tier-0..5). library is capped at 6 (7 sprites: tier-0..6).
 * Existing saves with tiers below any cap are automatically valid (no migration needed).
 */
export const CAMP_MAX_TIERS: Record<CampElement, number> = {
  tent: 6,
  campfire: 5,
  character: 6,
  pet: 5,
  library: 6,
  questboard: 6,
  shop: 6,
  journal: 5,
  doorway: 6,
}

/**
 * Canonical element list derived from CAMP_MAX_TIERS key insertion order.
 * Do NOT maintain a separate hand-written array — this is the single source.
 * Order: tent, campfire, character, pet, library, questboard, shop, journal, doorway.
 */
export const CAMP_ELEMENTS: readonly CampElement[] = Object.keys(CAMP_MAX_TIERS) as CampElement[]

const DEFAULT_CAMP_STATE: CampState = {
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
  forms: {
    tent: 0,
    campfire: 0,
    character: 0,
    pet: 0,
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

/**
 * Per-element upgrade costs. Index = tier being purchased (0 = first upgrade from base).
 * Length must equal CAMP_MAX_TIERS[element] for every entry.
 */
const UPGRADE_COSTS: Record<CampElement, readonly number[]> = {
  tent:       [60, 120, 200, 320, 500, 750],        // 6 entries, max 6
  campfire:   [60, 120, 200, 320, 500],              // 5 entries, max 5
  character:  [80, 160, 280, 450, 700, 1000],        // 6 entries, max 6
  pet:        [150, 300, 500, 800, 1200],            // 5 entries, max 5
  library:    [80, 150, 250, 400, 600, 900],         // 6 entries, max 6
  questboard: [40, 80, 150, 250, 400, 600],          // 6 entries, max 6
  shop:       [60, 120, 200, 320, 500, 750],         // 6 entries, max 6
  journal:    [40, 80, 150, 250, 400],               // 5 entries, max 5
  doorway:    [100, 200, 350, 550, 800, 1100],       // 6 entries, max 6
}

export const PET_UNLOCK_COSTS: Record<CampPet, number> = {
  cat: 0,
  owl: 180,
  fox: 260,
  dragon_whelp: 520,
}

function sanitizeState(raw: unknown): CampState {
  if (!raw || typeof raw !== 'object') return DEFAULT_CAMP_STATE
  const candidate = raw as Partial<CampState>
  // Cast loosely — old saves may have 'seating'/'decor' keys; those are ignored (default to 0).
  const tiers = (candidate.tiers ?? {}) as Record<string, unknown>
  const unlocked: CampPet[] = Array.isArray(candidate.unlockedPets)
    ? candidate.unlockedPets.filter((pet): pet is CampPet =>
      pet === 'cat' || pet === 'owl' || pet === 'fox' || pet === 'dragon_whelp')
    : ['cat']

  // clampTier uses CAMP_MAX_TIERS to clamp saved values above the current max tier.
  const clampTier = (el: CampElement, raw: unknown): number =>
    Math.max(0, Math.min(CAMP_MAX_TIERS[el], Number(raw ?? 0)))

  const sanitizedTiers: Record<CampElement, number> = {
    tent: clampTier('tent', tiers.tent),
    character: clampTier('character', tiers.character),
    pet: clampTier('pet', tiers.pet),
    campfire: clampTier('campfire', tiers.campfire),
    library: clampTier('library', tiers.library),
    questboard: clampTier('questboard', tiers.questboard),
    shop: clampTier('shop', tiers.shop),
    journal: clampTier('journal', tiers.journal),
    doorway: clampTier('doorway', tiers.doorway),
  }

  // Sanitize forms — default to current tier for missing/invalid values
  const rawForms = (candidate.forms ?? {}) as Record<string, unknown>
  const sanitizedForms = { ...DEFAULT_CAMP_STATE.forms } as Record<CampElement, number>
  for (const el of CAMP_ELEMENTS) {
    const formVal = rawForms[el]
    const tierVal = sanitizedTiers[el]
    sanitizedForms[el] = (typeof formVal === 'number' && formVal >= 0 && formVal <= tierVal)
      ? formVal
      : tierVal  // default to current tier for missing/invalid forms
  }

  const next: CampState = {
    tiers: sanitizedTiers,
    forms: sanitizedForms,
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

export function getCampUpgradeCost(element: CampElement, currentTier: number): number | null {
  if (currentTier >= CAMP_MAX_TIERS[element]) return null
  return UPGRADE_COSTS[element][currentTier] ?? null
}

export function setCampTier(element: CampElement, tier: number): void {
  campState.update((state) => {
    const newTier = Math.max(0, Math.min(CAMP_MAX_TIERS[element], tier))
    const oldTier = state.tiers[element]
    const currentForm = state.forms?.[element] ?? oldTier
    // Auto-advance form if user was tracking the latest tier
    const newForm = (currentForm >= oldTier) ? newTier : currentForm
    return {
      ...state,
      tiers: { ...state.tiers, [element]: newTier },
      forms: { ...state.forms, [element]: newForm },
    }
  })
}

/** Set the visual form (appearance tier) for a camp element. Clamps to [0, unlockedTier]. */
export function setCampForm(element: CampElement, form: number): void {
  campState.update((state) => {
    const maxForm = state.tiers[element]
    const clamped = Math.max(0, Math.min(maxForm, form))
    return {
      ...state,
      forms: {
        ...state.forms,
        [element]: clamped,
      },
    }
  })
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
