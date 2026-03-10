/**
 * Co-op Service — client-side REST + WebSocket facade for cooperative dives.
 *
 * Wraps all co-op REST calls and manages the client WebSocket lifecycle.
 * Also provides optimistic prediction and server reconciliation helpers.
 */

import { wsClient } from './wsClient'
import type { WSMessage } from './wsClient'
import { readAccessToken } from './authTokens'

/** Resolve the API base URL from Vite environment or fall back to localhost. */
const BASE = () =>
  (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL
    ? ((import.meta as { env?: { VITE_API_URL?: string } }).env!.VITE_API_URL as string)
    : `${window.location.protocol}//${window.location.hostname}:3001/api`
  ).replace(/\/$/, '')

const AUTH = () => readAccessToken() ?? ''

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH()}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    headers: { Authorization: `Bearer ${AUTH()}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

/**
 * Create a new lobby room as host.
 * Returns roomId and 6-char invite code.
 */
export async function createLobby(hostId: string, hostName: string): Promise<{ roomId: string; code: string }> {
  const data = await post<{ lobby: { id: string; code: string } }>('/coop/lobby/create', { hostId, hostName })
  return { roomId: data.lobby.id, code: data.lobby.code }
}

/** Join a lobby by roomId. */
export async function joinLobby(roomId: string, playerId: string, playerName: string): Promise<void> {
  await post(`/coop/lobby/${encodeURIComponent(roomId)}/join`, { playerId, playerName })
}

/** Lookup a room by 6-char code (for friend sharing). */
export async function findByCode(code: string): Promise<{ roomId: string; hostName: string } | null> {
  try {
    return await get<{ roomId: string; hostName: string }>(`/coop/lobby/code/${encodeURIComponent(code)}`)
  } catch {
    return null
  }
}

/** Enter the quickmatch queue. Returns roomId if matched immediately. */
export async function quickmatchJoin(
  playerId: string,
  playerName: string
): Promise<{ matched: boolean; roomId?: string; queueLength?: number }> {
  return post('/coop/quickmatch/join', { playerId, playerName })
}

/** Leave the quickmatch queue. */
export async function quickmatchLeave(playerId: string): Promise<void> {
  await post('/coop/quickmatch/leave', { playerId })
}

/** Connect the shared wsClient to the co-op WebSocket for a room. */
export function connectToRoom(roomId: string, playerId: string): void {
  const wsBase = BASE().replace(/^http/, 'ws').replace('/api', '')
  wsClient.connect(`${wsBase}/coop/ws/${encodeURIComponent(roomId)}`, playerId)
}

/** Subscribe to a specific WS message type. Returns an unsubscribe function. */
export function onCoopMessage(type: string, cb: (msg: WSMessage) => void): () => void {
  return wsClient.on(type, cb)
}

// ── Client-side prediction and reconciliation ────────────────────────────────

/** Payload shape for authoritative sync frames from the server. */
export interface CoopSyncPayload {
  tick: number
  layer: number
  minerPos: { x: number; y: number }
  o2: number
  gridDirty: Record<string, string>
}

/** Local shadow of the authoritative grid used for client prediction. */
export let localGrid: Map<string, string> = new Map()
export let localMinerPos = { x: 10, y: 0 }
export let localO2 = 100

/**
 * Apply an optimistic move locally before the server confirms.
 * If the server's next sync contradicts this, reconcile() overwrites.
 */
export function predictMove(dx: number, dy: number): void {
  const newX = localMinerPos.x + dx
  const newY = localMinerPos.y + dy
  const key = `${newX},${newY}`
  if (!localGrid.has(key) || localGrid.get(key) === 'empty') {
    localMinerPos = { x: newX, y: newY }
    localO2 = Math.max(0, localO2 - 1)
  }
}

/**
 * Reconcile local shadow state against an authoritative server snapshot.
 * Overwrites any locally-predicted state that differs from the server.
 */
export function reconcile(payload: CoopSyncPayload): void {
  localMinerPos = payload.minerPos
  localO2 = payload.o2
  for (const [key, type] of Object.entries(payload.gridDirty)) {
    localGrid.set(key, type)
  }
}

/** Reset local prediction state (call on dive start or after a room change). */
export function resetLocalState(): void {
  localGrid = new Map()
  localMinerPos = { x: 10, y: 0 }
  localO2 = 100
}
