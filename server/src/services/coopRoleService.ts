/**
 * Co-op Role Service — Scholar buff application and buff state tracking.
 *
 * Implements the asymmetric Scholar role mechanics. Scholar buff answers
 * grant real-time buffs to the Miner; incorrect answers impose O2 penalties.
 */

import type { CoopRoom } from './coopRoomService.js'
import { broadcast } from './coopRoomService.js'

/** Available scholar buffs and their O2/loot multiplier effects. */
export const SCHOLAR_BUFFS = {
  o2_restore:     { o2Delta: +15, lootMult: 1.0, label: 'O2 Boost' },
  loot_boost:     { o2Delta: 0,   lootMult: 1.5, label: 'Loot +50%' },
  hardness_cut:   { o2Delta: 0,   lootMult: 1.0, label: 'Soft Touch', hardnessMult: 0.5 },
  speed_surge:    { o2Delta: 0,   lootMult: 1.0, label: 'Speed +1',   ticksPerMove: -1 },
} as const

export type BuffType = keyof typeof SCHOLAR_BUFFS

/** Active buff state on a room (only one buff active at a time). */
const activeBuff = new Map<string, { type: BuffType; expiresAtTick: number }>()

/**
 * Called when the scholar sends a dive:quiz_answer message.
 * Correct answer applies a buff to the Miner; incorrect answer triggers
 * a minor O2 penalty for the Miner (DD-V2-161).
 */
export function applyScholarBuff(
  room: CoopRoom,
  input: { factId: string; correct: boolean; buffType: string }
): void {
  const slot = room.slots.find(s => s?.role === 'scholar')
  if (!slot) return

  const ledger = room.ledger.get(slot.playerId)
  if (ledger) ledger.quizzesAnswered++

  if (input.correct) {
    const type = (input.buffType as BuffType) in SCHOLAR_BUFFS
      ? (input.buffType as BuffType)
      : 'o2_restore'
    const buff = SCHOLAR_BUFFS[type]
    if (!buff) return

    // Apply immediate O2 delta.
    if (buff.o2Delta !== 0) {
      room.o2 = Math.min(100, Math.max(0, room.o2 + buff.o2Delta))
    }

    // Register buff for next 20 ticks.
    activeBuff.set(room.id, { type, expiresAtTick: room.tick + 20 })

    if (ledger) ledger.buffsGranted++

    broadcast(room, {
      type: 'scholar:buff_applied',
      payload: { buffType: type, label: buff.label, expiresAtTick: room.tick + 20, o2: room.o2 },
    })
  } else {
    // Incorrect answer: small O2 penalty for Miner (DD-V2-161).
    room.o2 = Math.max(0, room.o2 - 5)
    broadcast(room, {
      type: 'scholar:buff_failed',
      payload: { o2: room.o2 },
    })
  }
}

/** Check if a loot multiplier buff is active for this room tick. */
export function getActiveLootMult(roomId: string, tick: number): number {
  const buff = activeBuff.get(roomId)
  if (!buff || tick > buff.expiresAtTick) return 1.0
  return SCHOLAR_BUFFS[buff.type].lootMult
}

/** Check if a hardness reduction buff is active. */
export function getActiveHardnessMult(roomId: string, tick: number): number {
  const buff = activeBuff.get(roomId)
  if (!buff || tick > buff.expiresAtTick) return 1.0
  return (SCHOLAR_BUFFS[buff.type] as { hardnessMult?: number }).hardnessMult ?? 1.0
}

/** Clear buff state for a room (call on room cleanup). */
export function clearRoomBuff(roomId: string): void {
  activeBuff.delete(roomId)
}
