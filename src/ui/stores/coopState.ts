/**
 * Co-op State Stores — Svelte stores for co-op runtime state.
 *
 * Tracks local player role, partner status, active Scholar buffs,
 * quiz queue, and disconnect recovery state.
 */

import { writable, derived } from 'svelte/store'

/** The two co-op roles available in a dive. */
export type CoopRole = 'miner' | 'scholar'

/** Scholar buff types, matching the server's SCHOLAR_BUFFS. */
export type BuffType = 'o2_restore' | 'loot_boost' | 'hardness_cut' | 'speed_surge'

/** An active Scholar buff that is currently applying to the Miner. */
export interface ActiveBuff {
  type: BuffType
  label: string
  expiresAtTick: number
}

/** Live status of the partner player in a co-op dive. */
export interface PartnerStatus {
  playerId: string
  displayName: string
  role: CoopRole
  connected: boolean
  /** Miner's current O2 (echoed in Scholar HUD). */
  o2?: number
}

/** A quiz item in the Scholar's active quiz queue. */
export interface CoopQuizItem {
  factId: string
  question: string
  choices: string[]
  buffType: BuffType
  correctAnswer?: string
}

/** Current local player's role in the co-op dive. null = solo (not in co-op). */
export const coopRole = writable<CoopRole | null>(null)

/** The partner's live status. */
export const partnerStatus = writable<PartnerStatus | null>(null)

/** The currently active Scholar buff (if any). */
export const activeBuff = writable<ActiveBuff | null>(null)

/** Co-op quiz queue for the Scholar role: facts to answer. */
export const coopQuizQueue = writable<CoopQuizItem[]>([])

/** True when the Scholar's partner has disconnected and we're in recovery mode. */
export const inRecoveryMode = writable(false)

/** Ticks remaining in the reconnect window. */
export const recoveryTicksLeft = writable(0)

/** The current co-op room ID (null when not in a room). */
export const coopRoomId = writable<string | null>(null)

/** Derived: should the Scholar quiz panel be shown? */
export const showScholarPanel = derived(
  [coopRole, partnerStatus],
  ([$role, $partner]) => $role === 'scholar' && $partner !== null
)

/** Reset all co-op stores to their initial state (call on dive end or disconnect). */
export function resetCoopState(): void {
  coopRole.set(null)
  partnerStatus.set(null)
  activeBuff.set(null)
  coopQuizQueue.set([])
  inRecoveryMode.set(false)
  recoveryTicksLeft.set(0)
  coopRoomId.set(null)
}
