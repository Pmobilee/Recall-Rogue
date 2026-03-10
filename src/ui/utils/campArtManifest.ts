type CampElement = 'tent' | 'seating' | 'campfire' | 'decor'
type CampOutfit = 'scout' | 'warden' | 'scholar' | 'vanguard'
type CampPet = 'cat' | 'owl' | 'fox' | 'dragon_whelp'

interface CampArtManifestData {
  elements: Record<CampElement, Record<string, string>>
  outfits: Record<CampOutfit, string>
  pets: Record<CampPet, string>
}

const emptyManifest: CampArtManifestData = {
  elements: {
    tent: {},
    seating: {},
    campfire: {},
    decor: {},
  },
  outfits: {
    scout: '',
    warden: '',
    scholar: '',
    vanguard: '',
  },
  pets: {
    cat: '',
    owl: '',
    fox: '',
    dragon_whelp: '',
  },
}

let cache: CampArtManifestData = structuredClone(emptyManifest)
let initialized = false
let initPromise: Promise<void> | null = null

const elementModules = import.meta.glob('/public/assets/camp/elements/*.webp')
const outfitModules = import.meta.glob('/public/assets/camp/outfits/*.webp')
const petModules = import.meta.glob('/public/assets/camp/pets/*.webp')

function staticManifest(): CampArtManifestData {
  const manifest: CampArtManifestData = structuredClone(emptyManifest)

  for (const filePath of Object.keys(elementModules)) {
    const name = filePath.split('/').pop() ?? ''
    const match = name.match(/^(tent|seating|campfire|decor)-tier-(\d+)\.webp$/)
    if (!match) continue
    const element = match[1] as CampElement
    const tier = match[2]
    manifest.elements[element][tier] = `/assets/camp/elements/${name}`
  }

  for (const filePath of Object.keys(outfitModules)) {
    const name = filePath.split('/').pop() ?? ''
    const match = name.match(/^outfit-(scout|warden|scholar|vanguard)\.webp$/)
    if (!match) continue
    const outfit = match[1] as CampOutfit
    manifest.outfits[outfit] = `/assets/camp/outfits/${name}`
  }

  for (const filePath of Object.keys(petModules)) {
    const name = filePath.split('/').pop() ?? ''
    const match = name.match(/^pet-(cat|owl|fox|dragon_whelp)\.webp$/)
    if (!match) continue
    const pet = match[1] as CampPet
    manifest.pets[pet] = `/assets/camp/pets/${name}`
  }

  return manifest
}

function mergeManifests(base: CampArtManifestData, incoming: Partial<CampArtManifestData>): CampArtManifestData {
  return {
    elements: {
      tent: { ...base.elements.tent, ...(incoming.elements?.tent ?? {}) },
      seating: { ...base.elements.seating, ...(incoming.elements?.seating ?? {}) },
      campfire: { ...base.elements.campfire, ...(incoming.elements?.campfire ?? {}) },
      decor: { ...base.elements.decor, ...(incoming.elements?.decor ?? {}) },
    },
    outfits: {
      scout: incoming.outfits?.scout || base.outfits.scout,
      warden: incoming.outfits?.warden || base.outfits.warden,
      scholar: incoming.outfits?.scholar || base.outfits.scholar,
      vanguard: incoming.outfits?.vanguard || base.outfits.vanguard,
    },
    pets: {
      cat: incoming.pets?.cat || base.pets.cat,
      owl: incoming.pets?.owl || base.pets.owl,
      fox: incoming.pets?.fox || base.pets.fox,
      dragon_whelp: incoming.pets?.dragon_whelp || base.pets.dragon_whelp,
    },
  }
}

async function fetchManifest(): Promise<Partial<CampArtManifestData> | null> {
  try {
    const response = await fetch('/assets/camp/manifest.json', { cache: 'no-store' })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export function initCampArtManifest(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const base = staticManifest()
    const remote = await fetchManifest()
    cache = remote ? mergeManifests(base, remote) : base
    initialized = true
  })()
  return initPromise
}

function ensureReady(): void {
  if (initialized) return
  cache = staticManifest()
  initialized = true
}

export function getCampElementArtUrl(element: CampElement, tier: number): string | null {
  ensureReady()
  const key = String(Math.max(1, tier))
  return cache.elements[element][key] || null
}

export function getCampOutfitArtUrl(outfit: CampOutfit): string | null {
  ensureReady()
  return cache.outfits[outfit] || null
}

export function getCampPetArtUrl(pet: CampPet): string | null {
  ensureReady()
  return cache.pets[pet] || null
}

export type CampSpriteId =
  | 'dungeon-gate' | 'bookshelf' | 'signpost' | 'anvil'
  | 'campfire' | 'tent' | 'character' | 'cat'
  | 'journal' | 'quest-board' | 'treasure-chest'

/** Returns the URL for a camp scene sprite by its ID. */
export function getCampSpriteUrl(id: CampSpriteId): string {
  return `/assets/camp/sprites/${id}/${id}-base.png`
}

/** Returns the URL for the camp background image. */
export function getCampBackgroundUrl(): string {
  return '/assets/camp/sprites/background/camp-background.jpg'
}

