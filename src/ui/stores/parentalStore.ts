/**
 * Parental control settings store.
 * PIN is stored as a SHA-256 hex digest. Plaintext never leaves the browser.
 * localStorage key: 'terra_parental_v1'
 */

import { writable, get } from 'svelte/store'

export interface ParentalSettings {
  /** SHA-256 hex digest of the PIN, or null if no PIN is set. */
  pinHash: string | null
  /** Raw PIN for in-memory comparison ONLY — never persisted. */
  pin: string | null
  /** Daily play limit in seconds. 0 = unlimited. */
  limitSeconds: number
  /** Whether social features (hub visits, duels, trading, guilds) are enabled for this kid profile. */
  socialEnabled: boolean
  /** Parent email for weekly reports. null if not configured. */
  parentEmail: string | null
  /** Whether weekly learning report emails are enabled. */
  weeklyReportEnabled: boolean
  /** Whether kid-mode theme (larger buttons, simplified nav) is forced. */
  kidThemeEnabled: boolean
  /** Which dome floors are unlocked beyond the first 3 (optional; defaults to first 3 only). */
  unlockedFloors?: string[]
}

const STORAGE_KEY = 'terra_parental_v1'

function loadFromStorage(): ParentalSettings {
  if (typeof localStorage === 'undefined') return defaultSettings()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw) as Partial<ParentalSettings>
    return { ...defaultSettings(), ...parsed, pin: null } // never load plaintext pin
  } catch {
    return defaultSettings()
  }
}

function defaultSettings(): ParentalSettings {
  return {
    pinHash: null,
    pin: null,
    limitSeconds: 3600, // 60 minutes default
    socialEnabled: false,
    parentEmail: null,
    weeklyReportEnabled: false,
    kidThemeEnabled: true,
    unlockedFloors: ['floor1', 'floor2', 'floor3'],
  }
}

/** SHA-256 hash of a string (Web Crypto API, async). */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode('recall-rogue:pin:' + pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const initial = loadFromStorage()
export const parentalStore = writable<ParentalSettings>(initial)

/** Persists current state to localStorage (excludes plaintext pin). */
function persist(settings: ParentalSettings): void {
  if (typeof localStorage === 'undefined') return
  const { pin: _pin, ...safe } = settings
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
}

parentalStore.subscribe(persist)

/**
 * Sets a new PIN. Hashes it and stores the digest.
 * Also sets `pin` in-memory for same-session comparisons.
 */
export async function setPin(rawPin: string): Promise<void> {
  const hash = await hashPin(rawPin)
  parentalStore.update(s => ({ ...s, pinHash: hash, pin: rawPin }))
}

/**
 * Verifies a candidate PIN against the stored hash.
 * Returns true if matching.
 */
export async function verifyPin(candidate: string): Promise<boolean> {
  const settings = get(parentalStore)
  if (!settings.pinHash) return false
  const candidateHash = await hashPin(candidate)
  return candidateHash === settings.pinHash
}

/**
 * Updates individual parental settings without touching the PIN.
 */
export function updateParentalSettings(patch: Partial<Omit<ParentalSettings, 'pin' | 'pinHash'>>): void {
  parentalStore.update(s => ({ ...s, ...patch }))
}

/**
 * Removes the PIN entirely (requires calling code to verify old PIN first).
 */
export function removePin(): void {
  parentalStore.update(s => ({ ...s, pinHash: null, pin: null }))
}
