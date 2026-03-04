/**
 * Co-op AI Scholar — lightweight AI takeover on partner disconnect.
 *
 * Activated when the human Scholar disconnects and the reconnect window
 * expires. The AI Scholar has a configurable accuracy rate (default 60%)
 * so it never completely substitutes for a skilled human partner.
 */

import type { CoopRoom } from './coopRoomService.js'
import { applyScholarBuff, type BuffType } from './coopRoleService.js'
import { broadcast } from './coopRoomService.js'

/** AI Scholar accuracy: correct answer rate (0.0–1.0). */
const AI_ACCURACY = 0.6

/** Buff types the AI cycles through in order. */
const AI_BUFF_CYCLE: BuffType[] = ['o2_restore', 'loot_boost', 'o2_restore', 'hardness_cut']

/** Tracks per-room AI scholar state. */
const aiState = new Map<string, { active: boolean; buffCycleIdx: number; intervalId: ReturnType<typeof setInterval> }>()

/**
 * Activate the AI Scholar for a room whose human Scholar disconnected
 * after the reconnect window expired.
 * The AI fires a quiz answer every 15 ticks (approximately 15 s).
 */
export function activateAiScholar(room: CoopRoom): void {
  if (aiState.has(room.id)) return   // already active

  let cycleIdx = 0
  const intervalId = setInterval(() => {
    if (room.status !== 'active') {
      deactivateAiScholar(room.id)
      return
    }
    const correct = Math.random() < AI_ACCURACY
    const buffType = AI_BUFF_CYCLE[cycleIdx % AI_BUFF_CYCLE.length]
    cycleIdx++

    applyScholarBuff(room, { factId: 'ai_scholar', correct, buffType })
    broadcast(room, {
      type: 'ai_scholar:action',
      payload: { correct, buffType, message: correct ? 'GAIA Scholar activated.' : 'GAIA Scholar miscalculated.' },
    })
  }, 15_000)

  aiState.set(room.id, { active: true, buffCycleIdx: cycleIdx, intervalId })
}

/** Stop the AI Scholar for a room (called on Scholar reconnect or dive end). */
export function deactivateAiScholar(roomId: string): void {
  const state = aiState.get(roomId)
  if (state) {
    clearInterval(state.intervalId)
    aiState.delete(roomId)
  }
}

/** Check if AI Scholar is currently active for a room. */
export function isAiScholarActive(roomId: string): boolean {
  return aiState.has(roomId)
}
