/** Lightweight descriptor for a player profile. */
export interface PlayerProfile {
  /** UUID v4. Generated on creation. */
  id: string
  /** User-entered name/nickname. Max 20 chars. */
  name: string
  /** Age bracket selected during profile creation. */
  ageBracket: 'under_13' | 'teen' | 'adult'
  /** Primary interest categories selected during onboarding. */
  interests: string[]
  /** Avatar emoji chosen during creation. */
  avatarKey: string
  /** ISO date string of profile creation. */
  createdAt: string
  /** ISO date string of last play session for this profile. */
  lastPlayedAt: string
  /** Display level (highest mine layer reached, for UI). */
  level: number
  /** Cloud sync: this profile's cloud save ID (if logged in). */
  cloudSaveId: string | null
  /** ELO rating for ranked multiplayer matches. Default 1500. Added schema v2. */
  multiplayerRating: number
}

/** Container stored in localStorage under PROFILES_STORAGE_KEY. */
export interface ProfilesStore {
  /** All profiles on this device. Max 4. */
  profiles: PlayerProfile[]
  /** ID of the currently active profile. */
  activeProfileId: string | null
}
