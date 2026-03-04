/**
 * Co-op Mine Service — authoritative server-side mine state processing.
 *
 * Applies player inputs to the authoritative CoopRoom grid, calculates O2 costs,
 * and queues loot ledger updates.
 */

import type { CoopRoom } from './coopRoomService.js'
import { broadcast } from './coopRoomService.js'

/** O2 cost per block type mined (mirrors client). */
const O2_COST: Record<string, number> = {
  dirt: 1, soft_rock: 2, stone: 3, hard_rock: 5, move: 1,
}

/**
 * Apply a Miner move or mine action to the authoritative room state.
 * Only processes inputs when the room is in 'active' status.
 */
export function applyMoveOnServer(
  room: CoopRoom,
  input: { dx: number; dy: number }
): void {
  if (room.status !== 'active') return

  const newX = room.minerPos.x + input.dx
  const newY = room.minerPos.y + input.dy
  const key = `${newX},${newY}`
  const blockType = room.grid.get(key) ?? 'empty'

  if (blockType === 'empty') {
    // Movement — deduct O2.
    room.minerPos = { x: newX, y: newY }
    room.o2 = Math.max(0, room.o2 - (O2_COST['move'] ?? 1))
    room.tick++

    broadcast(room, {
      type: 'miner:moved',
      payload: { pos: room.minerPos, o2: room.o2, tick: room.tick },
    })
  } else if (blockType !== 'unbreakable') {
    // Mining — break block, award loot.
    room.grid.set(key, 'empty')
    const loot = computeLoot(blockType, room.layer)
    const slot = room.slots.find(s => s?.role === 'miner')
    if (slot) {
      const entry = room.ledger.get(slot.playerId)
      if (entry) {
        entry.blocksContributed++
        for (const [mineral, amt] of Object.entries(loot)) {
          entry.mineralsRaw[mineral] = (entry.mineralsRaw[mineral] ?? 0) + amt
        }
      }
    }
    room.o2 = Math.max(0, room.o2 - (O2_COST[blockType] ?? 2))
    room.tick++

    broadcast(room, {
      type: 'block:mined',
      payload: { key, blockType, loot, o2: room.o2, tick: room.tick },
    })
  }

  if (room.o2 <= 0) {
    room.status = 'ended'
    broadcast(room, { type: 'dive:ended', payload: { reason: 'o2_depleted' } })
  }
}

/** Simple loot table: returns a map of mineral type → amount. */
function computeLoot(blockType: string, layer: number): Record<string, number> {
  if (blockType !== 'mineral_node') return {}
  const depthBonus = Math.floor(layer * 0.5)
  return { dust: 5 + depthBonus + Math.floor(Math.random() * 10) }
}
