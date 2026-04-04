import type { PlayerProfile, ProfilesStore } from '../data/profileTypes'
import { generateUUID } from '../utils/uuid'
import { getBackend } from './storageBackend'

const PROFILES_KEY = 'rr_profiles'
const SAVE_KEY_PREFIX = 'rr_save_'
const MAX_PROFILES = 4

const AVATAR_OPTIONS = ['⛏', '🪨', '💎', '🦕', '🌋', '🔭', '🧬', '🌿']

/**
 * Manages multiple player profiles stored in localStorage.
 * Each profile has its own namespaced save key (rr_save_<id>).
 */
export class ProfileService {
  private store: ProfilesStore

  constructor() {
    this.store = this.loadStore()
  }

  private loadStore(): ProfilesStore {
    try {
      const raw = getBackend().readSync(PROFILES_KEY)
      return raw ? (JSON.parse(raw) as ProfilesStore) : { profiles: [], activeProfileId: null }
    } catch {
      return { profiles: [], activeProfileId: null }
    }
  }

  private saveStore(): void {
    getBackend().write(PROFILES_KEY, JSON.stringify(this.store))
  }

  /**
   * Returns all profiles stored on this device.
   */
  getProfiles(): PlayerProfile[] {
    return this.store.profiles
  }

  /**
   * Returns the currently active profile, or null if none is selected.
   */
  getActiveProfile(): PlayerProfile | null {
    if (!this.store.activeProfileId) return null
    return this.store.profiles.find(p => p.id === this.store.activeProfileId) ?? null
  }

  /**
   * Returns the ID of the currently active profile.
   */
  getActiveId(): string | null {
    return this.store.activeProfileId
  }

  /**
   * Sets the active profile by ID.
   * @throws Error if the profile ID does not exist.
   */
  setActiveProfile(id: string): void {
    const profile = this.store.profiles.find(p => p.id === id)
    if (!profile) throw new Error('Profile not found')
    this.store.activeProfileId = id
    this.saveStore()
  }

  /**
   * Creates a new profile and sets it as active.
   * @throws Error if the max profile limit (4) is already reached, or name exceeds 20 chars.
   */
  createProfile(data: {
    name: string
    ageBracket: 'under_13' | 'teen' | 'adult'
    avatarKey: string
    interests?: string[]
  }): PlayerProfile {
    if (this.store.profiles.length >= MAX_PROFILES) {
      throw new Error('Maximum 4 profiles reached')
    }
    if (data.name.length > 20) {
      throw new Error('Name must be 20 characters or less')
    }
    const profile: PlayerProfile = {
      id: generateUUID(),
      name: data.name,
      ageBracket: data.ageBracket,
      interests: data.interests ?? [],
      avatarKey: data.avatarKey,
      createdAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
      level: 0,
      cloudSaveId: null,
    }
    this.store.profiles.push(profile)
    this.store.activeProfileId = profile.id
    this.saveStore()
    return profile
  }

  /**
   * Deletes a profile and its associated save data from localStorage.
   * If the deleted profile was active, the first remaining profile (if any) becomes active.
   */
  deleteProfile(id: string): void {
    this.store.profiles = this.store.profiles.filter(p => p.id !== id)
    // Clear namespaced save data
    getBackend().remove(SAVE_KEY_PREFIX + id)
    if (this.store.activeProfileId === id) {
      this.store.activeProfileId = this.store.profiles[0]?.id ?? null
    }
    this.saveStore()
  }

  /**
   * Updates mutable fields on an existing profile.
   */
  updateProfile(
    id: string,
    updates: Partial<Pick<PlayerProfile, 'name' | 'avatarKey' | 'lastPlayedAt' | 'level'>>,
  ): void {
    const profile = this.store.profiles.find(p => p.id === id)
    if (!profile) return
    Object.assign(profile, updates)
    this.saveStore()
  }

  /**
   * Returns true if at least one profile exists on this device.
   */
  hasProfiles(): boolean {
    return this.store.profiles.length > 0
  }

  /**
   * Returns the localStorage key to use for saving/loading the active profile's game data.
   * Falls back to the legacy 'rr_save' key when no profiles exist (backward compat).
   */
  getSaveKey(): string {
    return this.store.activeProfileId
      ? SAVE_KEY_PREFIX + this.store.activeProfileId
      : 'rr_save'
  }

  /**
   * Re-reads the profiles store from the backend.
   * Call this after initStorageBackend() completes on desktop, because
   * the constructor runs at module import time before the FileStorageBackend cache is populated.
   */
  reload(): void {
    this.store = this.loadStore()
  }

  /**
   * Returns the list of available avatar emoji options.
   */
  static getAvatarOptions(): string[] {
    return AVATAR_OPTIONS
  }
}

/** Singleton profile service instance. */
export const profileService = new ProfileService()
