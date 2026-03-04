/**
 * Co-op Room Service — in-memory room state management.
 *
 * This module owns all in-memory room state for cooperative dives.
 * It is a pure data/logic layer callable from any route handler.
 */

import { randomUUID } from 'node:crypto'

/** Each connected socket is identified by its player ID. */
export type PlayerId = string

/** The two roles a player may occupy in a co-op dive. */
export type CoopRole = 'miner' | 'scholar'

/** Connection health for a single player slot. */
export interface PlayerSlot {
  playerId: PlayerId
  displayName: string
  role: CoopRole
  /** Unix ms of last heartbeat pong received. */
  lastPing: number
  /** WebSocket send function injected at connection time. */
  send: (msg: string) => void
  connected: boolean
}

/** Per-player loot accumulation in the ledger. */
export interface LedgerEntry {
  playerId: PlayerId
  displayName: string
  role: CoopRole
  mineralsRaw: Record<string, number>
  blocksContributed: number
  quizzesAnswered: number
  buffsGranted: number
}

/** Full authoritative room state. */
export interface CoopRoom {
  id: string
  hostId: PlayerId
  /** Always exactly 2 slots (index 0 = miner, index 1 = scholar). */
  slots: [PlayerSlot | null, PlayerSlot | null]
  status: 'lobby' | 'starting' | 'active' | 'ended'
  /** Shared 6-character invite code for friend invites. */
  code: string
  /** Deterministic seed used to generate the shared mine. */
  diveSeed: number
  /** Current authoritative layer (0-indexed). */
  layer: number
  /** Current authoritative tick count. */
  tick: number
  /** Miner position on the grid. */
  minerPos: { x: number; y: number }
  /** Current O2 level. */
  o2: number
  /** Authoritative flat grid: blockType strings indexed by 'x,y'. */
  grid: Map<string, string>
  /** Per-player loot accumulation. */
  ledger: Map<PlayerId, LedgerEntry>
  /** Tick at which the scholar disconnected (for recovery window). */
  scholarDisconnectTick: number | null
  createdAt: number
}

/** Loot split entry for end-of-dive summary. */
export interface LootSplit {
  playerId: string
  displayName: string
  role: CoopRole
  base: Record<string, number>
  cooperationBonus: Record<string, number>
  total: Record<string, number>
}

/** Reconnect window in ticks (60 ticks ≈ 60 s at 1 tick/s). */
export const RECONNECT_WINDOW_TICKS = 60

/** In-memory room registry. */
const rooms = new Map<string, CoopRoom>()

/** Generate a short 6-character alphanumeric invite code. */
function makeCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

/**
 * Create a new room and return it.
 * Host always takes the Miner slot (index 0).
 */
export function createRoom(hostId: PlayerId, hostName: string): CoopRoom {
  const room: CoopRoom = {
    id: randomUUID(),
    hostId,
    slots: [null, null],
    status: 'lobby',
    code: makeCode(),
    diveSeed: Math.floor(Math.random() * 2 ** 31),
    layer: 0,
    tick: 0,
    minerPos: { x: 10, y: 0 },
    o2: 100,
    grid: new Map(),
    ledger: new Map(),
    scholarDisconnectTick: null,
    createdAt: Date.now(),
  }
  // Host always takes the Miner slot (index 0).
  room.slots[0] = {
    playerId: hostId,
    displayName: hostName,
    role: 'miner',
    lastPing: Date.now(),
    send: () => {},   // replaced at WebSocket connection
    connected: false,
  }
  // Initialize ledger entry for the host (miner).
  room.ledger.set(hostId, {
    playerId: hostId,
    displayName: hostName,
    role: 'miner',
    mineralsRaw: {},
    blocksContributed: 0,
    quizzesAnswered: 0,
    buffsGranted: 0,
  })
  rooms.set(room.id, room)
  return room
}

/**
 * Join an existing room.
 * Returns null if full or not in lobby state.
 */
export function joinRoom(
  roomId: string,
  playerId: PlayerId,
  displayName: string
): CoopRoom | null {
  const room = rooms.get(roomId)
  if (!room || room.status !== 'lobby') return null
  if (room.slots[1] !== null) return null            // already full
  room.slots[1] = {
    playerId,
    displayName,
    role: 'scholar',
    lastPing: Date.now(),
    send: () => {},
    connected: false,
  }
  // Initialize ledger entry for the scholar.
  room.ledger.set(playerId, {
    playerId,
    displayName,
    role: 'scholar',
    mineralsRaw: {},
    blocksContributed: 0,
    quizzesAnswered: 0,
    buffsGranted: 0,
  })
  return room
}

/** Find a room by its 6-character invite code. */
export function findRoomByCode(code: string): CoopRoom | undefined {
  return [...rooms.values()].find(r => r.code === code.toUpperCase() && r.status === 'lobby')
}

/** Get a room by ID. */
export function getRoom(roomId: string): CoopRoom | undefined {
  return rooms.get(roomId)
}

/** Remove rooms that have been ended or idle for > 2 hours. */
export function pruneStaleRooms(): void {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000
  for (const [id, room] of rooms) {
    if (room.status === 'ended' || room.createdAt < cutoff) {
      rooms.delete(id)
    }
  }
}

/** Broadcast a JSON-stringified message to all connected slots in a room. */
export function broadcast(room: CoopRoom, msg: object): void {
  const raw = JSON.stringify(msg)
  for (const slot of room.slots) {
    if (slot?.connected) {
      try { slot.send(raw) } catch { /* slot likely closed */ }
    }
  }
}

/** Send to a single player slot. */
export function sendTo(room: CoopRoom, playerId: PlayerId, msg: object): void {
  const slot = room.slots.find(s => s?.playerId === playerId)
  if (slot?.connected) {
    try { slot.send(JSON.stringify(msg)) } catch { /* ignore */ }
  }
}

/**
 * Compute and emit the loot split at dive end. (DD-V2-162)
 *
 * Algorithm:
 *   1. Each player's base share = their own mineralsRaw contribution.
 *   2. A cooperation pool = 20% of the total loot is formed IF both players
 *      were active (each contributed > 0 blocks or quizzes answered > 0).
 *   3. Cooperation pool is split 50/50 regardless of contribution ratio.
 *   4. Non-cooperative run (one player AFK): no cooperation bonus; loot is
 *      kept as-is for the Miner and 0 for the Scholar.
 */
export function finalizeLedger(room: CoopRoom): LootSplit[] {
  const entries = [...room.ledger.values()]
  const miner = entries.find(e => e.role === 'miner')
  const scholar = entries.find(e => e.role === 'scholar')

  const allMinerals = new Set([
    ...Object.keys(miner?.mineralsRaw ?? {}),
    ...Object.keys(scholar?.mineralsRaw ?? {}),
  ])

  const totalPool: Record<string, number> = {}
  for (const m of allMinerals) {
    totalPool[m] = (miner?.mineralsRaw[m] ?? 0) + (scholar?.mineralsRaw[m] ?? 0)
  }

  const bothActive = (miner?.blocksContributed ?? 0) > 0 && (scholar?.quizzesAnswered ?? 0) > 0

  const cooperationPool: Record<string, number> = {}
  if (bothActive) {
    for (const [m, total] of Object.entries(totalPool)) {
      cooperationPool[m] = Math.floor(total * 0.2)
    }
  }

  function buildSplit(entry: LedgerEntry | undefined): LootSplit {
    if (!entry) return { playerId: '', displayName: '', role: 'scholar', base: {}, cooperationBonus: {}, total: {} }
    const base = { ...entry.mineralsRaw }
    const bonus: Record<string, number> = {}
    const total: Record<string, number> = { ...base }
    if (bothActive) {
      for (const [m, pool] of Object.entries(cooperationPool)) {
        const half = Math.floor(pool / 2)
        bonus[m] = half
        total[m] = (total[m] ?? 0) + half
      }
    }
    return {
      playerId: entry.playerId,
      displayName: entry.displayName,
      role: entry.role,
      base,
      cooperationBonus: bonus,
      total,
    }
  }

  const splits = [buildSplit(miner), buildSplit(scholar)]
  broadcast(room, { type: 'dive:loot_summary', payload: { splits, bothActive } })
  return splits
}
