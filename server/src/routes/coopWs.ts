/**
 * Co-op WebSocket Route — Fastify WebSocket upgrade endpoint.
 * Handles the live dive session for cooperative mining.
 * Registered at root level (not under an API prefix) in index.ts.
 */

import type { FastifyInstance } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import {
  getRoom,
  broadcast,
  finalizeLedger,
  RECONNECT_WINDOW_TICKS,
  type CoopRoom,
} from '../services/coopRoomService.js'
import { applyMoveOnServer } from '../services/coopMineService.js'
import { applyScholarBuff, clearRoomBuff } from '../services/coopRoleService.js'
import { activateAiScholar, deactivateAiScholar } from '../services/coopAiScholar.js'

/** Heartbeat interval in ms — server expects a pong within 2× this window. */
const HEARTBEAT_INTERVAL_MS = 15_000

/** Sync broadcast interval in ms (10 Hz = 100 ms). */
const SYNC_INTERVAL_MS = 100

/** Room-level sync loop registry (prevents duplicate intervals per room). */
const activeSyncLoops = new Set<string>()

/**
 * Register the co-op WebSocket route.
 * GET /coop/ws/:roomId?playerId=X upgrades to a WebSocket connection.
 */
export async function coopWsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/coop/ws/:roomId', { websocket: true }, (connection: SocketStream, req) => {
    const ws = connection.socket   // underlying ws.WebSocket instance
    const { roomId } = req.params as { roomId: string }
    const playerId = (req.query as { playerId?: string }).playerId ?? ''

    const room = getRoom(roomId)
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', payload: { code: 'ROOM_NOT_FOUND' } }))
      ws.close()
      return
    }

    // Locate the player slot and attach the live send function.
    const slot = room.slots.find(s => s?.playerId === playerId)
    if (!slot) {
      ws.send(JSON.stringify({ type: 'error', payload: { code: 'NOT_IN_ROOM' } }))
      ws.close()
      return
    }
    slot.send = (raw: string) => ws.send(raw)
    slot.connected = true
    slot.lastPing = Date.now()

    // Activate room if both players are now connected.
    if (room.status === 'lobby' && room.slots[0]?.connected && room.slots[1]?.connected) {
      room.status = 'active'
    }

    // Inform the partner of reconnection.
    broadcast(room, { type: 'player:connected', payload: { playerId, role: slot.role } })

    // If this was the scholar reconnecting within the recovery window, cancel AI mode.
    if (slot.role === 'scholar' && room.scholarDisconnectTick !== null) {
      if (room.tick - room.scholarDisconnectTick <= RECONNECT_WINDOW_TICKS) {
        deactivateAiScholar(room.id)
        room.scholarDisconnectTick = null
        broadcast(room, { type: 'scholar:reconnected', payload: {} })
      }
    }

    // Start sync loop (only once per room — idempotent via activeSyncLoops).
    startSyncLoop(room)

    // Heartbeat.
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping()
      }
    }, HEARTBEAT_INTERVAL_MS)

    ws.on('pong', () => { slot.lastPing = Date.now() })

    ws.on('message', (raw: Buffer) => {
      let msg: { type: string; payload: Record<string, unknown> }
      try { msg = JSON.parse(raw.toString()) } catch { return }

      switch (msg.type) {
        case 'dive:move':
          if (slot.role !== 'miner') break
          applyMoveOnServer(room, msg.payload as { dx: number; dy: number })
          break
        case 'dive:mine':
          if (slot.role !== 'miner') break
          applyMoveOnServer(room, msg.payload as { dx: number; dy: number })
          break
        case 'dive:quiz_answer':
          if (slot.role !== 'scholar') break
          applyScholarBuff(room, msg.payload as { factId: string; correct: boolean; buffType: string })
          broadcast(room, {
            type: 'scholar:buff',
            payload: { buffType: msg.payload['buffType'], correct: msg.payload['correct'] },
          })
          break
        case 'ping':
          slot.lastPing = Date.now()
          slot.send(JSON.stringify({ type: 'pong', payload: {} }))
          break
        default:
          // Unknown message types are silently ignored.
          break
      }
    })

    ws.on('close', () => {
      clearInterval(pingInterval)
      slot.connected = false

      if (slot.role === 'scholar') {
        room.scholarDisconnectTick = room.tick
        broadcast(room, {
          type: 'scholar:disconnected',
          payload: { reconnectWindowTicks: RECONNECT_WINDOW_TICKS },
        })

        // After RECONNECT_WINDOW_TICKS real seconds (not game ticks), activate AI.
        setTimeout(() => {
          if (room.scholarDisconnectTick !== null) {
            // Still disconnected — activate AI Scholar.
            activateAiScholar(room)
            broadcast(room, { type: 'ai_scholar:activated', payload: {} })
          }
        }, RECONNECT_WINDOW_TICKS * 1000)   // 60 seconds

      } else {
        // Miner disconnects — finalize loot and end the dive.
        room.status = 'ended'
        finalizeLedger(room)
        broadcast(room, { type: 'dive:ended', payload: { reason: 'miner_disconnected' } })
        deactivateAiScholar(room.id)
        clearRoomBuff(room.id)
      }
    })
  })
}

/**
 * Room-level sync loop: broadcast authoritative state 10 times/sec.
 * Idempotent — only one interval per room runs at any time.
 */
function startSyncLoop(room: CoopRoom): void {
  if (activeSyncLoops.has(room.id)) return
  activeSyncLoops.add(room.id)

  const interval = setInterval(() => {
    if (room.status === 'ended') {
      clearInterval(interval)
      activeSyncLoops.delete(room.id)
      return
    }
    const payload = {
      tick: room.tick,
      layer: room.layer,
      minerPos: room.minerPos,
      o2: room.o2,
      // Send only a diff in production; full grid for V1 simplicity.
      gridDirty: Object.fromEntries(room.grid),
    }
    broadcast(room, { type: 'dive:sync', payload })
  }, SYNC_INTERVAL_MS)
}
