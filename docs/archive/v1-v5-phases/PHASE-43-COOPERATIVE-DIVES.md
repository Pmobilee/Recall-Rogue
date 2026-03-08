# PHASE 43: Cooperative Dives

**Status**: Not started
**Depends on**: Phase 22 (Social & Multiplayer), Phase 8 (Mine Gameplay Overhaul), Phase 19 (Auth & Cloud)
**Estimated complexity**: High — real-time networked state, authoritative server, client prediction
**Design decisions**: DD-V2-160 (co-op dives), DD-V2-161 (role system), DD-V2-162 (loot split)

---

## 1. Overview

Phase 43 adds two-player cooperative mining to Terra Gacha. Two players share a single mine
instance, each taking on a distinct role (Miner or Scholar), and must work together to reach
maximum depth and maximize loot. The server acts as the sole authority over mine state;
clients predict locally and reconcile against server snapshots. A co-op loot ledger
tracks individual contributions and applies a cooperation bonus at dive end. Disconnect
recovery allows a solo continuation window of up to 60 seconds before the AI scholar
takes over.

### Goals
- Real-time 2-player co-op mining with sub-200 ms perceived latency on a local network.
- Asymmetric roles: the Miner controls movement and block breaking; the Scholar answers
  quizzes to grant live buffs to the Miner.
- Fair loot split with a cooperation bonus when both players contribute actively.
- Graceful degradation: a disconnected partner is replaced by a lightweight AI Scholar
  for the remainder of the dive.
- Co-op UI that does not occlude the mine grid on small screens.

### What this phase does NOT include
- More than 2 players per dive (4-player is Phase 44).
- Competitive/race modes (Phase 45).
- Voice chat (deferred to Phase 46).

---

## 2. Architecture Summary

```
Client (Miner)                Server                   Client (Scholar)
─────────────────────         ──────────────────────   ──────────────────────
wsClient.send(move)  ──ws──►  CoopRoom.handleMove()
                              validates + mutates       ws broadcast ──► wsClient.on('dive:sync')
                              authoritative grid        reconcile local copy
                              emits dive:sync
```

The server holds `CoopRoom` objects in memory (one per active dive). Each room owns the
authoritative `MineGrid`, `OxygenState`, tick count, loot ledger, and role assignments.
Clients keep a local shadow grid for rendering and apply optimistic updates; they reconcile
on every `dive:sync` frame broadcast (10 Hz).

---

## 3. Sub-phases

---

### 43.1 — WebSocket Server (Fastify WebSocket Plugin, Room Management, Heartbeat)

**Goal**: Upgrade the existing REST lobby in `server/src/routes/coop.ts` to a full
WebSocket server with room lifecycle management and heartbeat keep-alive.

#### 3.1.1 Install `@fastify/websocket`

The server already uses Fastify. Add the official WebSocket plugin. Ask the user before
running `npm install` — document this step here so the implementer knows to request
permission.

```
# Worker must ask the orchestrator/user before running:
npm install @fastify/websocket@^9.0.0 --save
# (server package, not client)
```

#### 3.1.2 Create `server/src/services/coopRoomService.ts`

This module owns all in-memory room state. It does not touch HTTP or WebSocket directly;
it is a pure data/logic layer callable from any route handler.

```typescript
// server/src/services/coopRoomService.ts

import { randomUUID } from 'node:crypto'
import type { MineCell } from '../types/mineTypes.js'

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

export interface LedgerEntry {
  playerId: PlayerId
  displayName: string
  role: CoopRole
  mineralsRaw: Record<string, number>
  blocksContributed: number
  quizzesAnswered: number
  buffsGranted: number
}

/** Maximum players per room (2-player cap for Phase 43). */
const MAX_PLAYERS = 2

/** Reconnect window in ticks (60 ticks ≈ 60 s at 1 tick/s). */
export const RECONNECT_WINDOW_TICKS = 60

/** In-memory room registry. */
const rooms = new Map<string, CoopRoom>()

/** Generate a short 6-character alphanumeric invite code. */
function makeCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

/** Create a new room and return it. */
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
  rooms.set(room.id, room)
  return room
}

/** Join an existing room. Returns null if full or not in lobby state. */
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
```

#### 3.1.3 Create `server/src/routes/coopWs.ts`

The WebSocket upgrade endpoint. Separate from the existing REST `coop.ts` route which
remains for lobby creation and matchmaking polls.

```typescript
// server/src/routes/coopWs.ts
// Fastify WebSocket route — handles the live dive session.
// Registered under the '/ws' prefix in index.ts.

import type { FastifyInstance } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import {
  getRoom,
  broadcast,
  sendTo,
  RECONNECT_WINDOW_TICKS,
  type CoopRoom,
} from '../services/coopRoomService.js'
import { applyMoveOnServer } from '../services/coopMineService.js'
import { applyScholarBuff } from '../services/coopRoleService.js'

/** Heartbeat interval in ms — server expects a pong within 2× this window. */
const HEARTBEAT_INTERVAL_MS = 15_000

/** Sync broadcast interval in ms (10 Hz = 100 ms). */
const SYNC_INTERVAL_MS = 100

export async function coopWsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/coop/ws/:roomId', { websocket: true }, (socket: WebSocket, req) => {
    const { roomId } = req.params as { roomId: string }
    const playerId = (req.query as { playerId?: string }).playerId ?? ''

    const room = getRoom(roomId)
    if (!room) {
      socket.send(JSON.stringify({ type: 'error', payload: { code: 'ROOM_NOT_FOUND' } }))
      socket.close()
      return
    }

    // Locate the player slot and attach the live send function.
    const slot = room.slots.find(s => s?.playerId === playerId)
    if (!slot) {
      socket.send(JSON.stringify({ type: 'error', payload: { code: 'NOT_IN_ROOM' } }))
      socket.close()
      return
    }
    slot.send = (raw: string) => socket.send(raw)
    slot.connected = true
    slot.lastPing = Date.now()

    // Inform the partner of reconnection.
    broadcast(room, { type: 'player:connected', payload: { playerId, role: slot.role } })

    // If this was the scholar reconnecting within the recovery window, cancel AI mode.
    if (slot.role === 'scholar' && room.scholarDisconnectTick !== null) {
      if (room.tick - room.scholarDisconnectTick <= RECONNECT_WINDOW_TICKS) {
        room.scholarDisconnectTick = null
        broadcast(room, { type: 'scholar:reconnected', payload: {} })
      }
    }

    // Start sync loop (only once per room — idempotent via room.status check).
    startSyncLoop(room)

    // Heartbeat.
    const pingInterval = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.ping()
      }
    }, HEARTBEAT_INTERVAL_MS)

    socket.on('pong', () => { slot.lastPing = Date.now() })

    socket.on('message', (raw: Buffer) => {
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
            payload: { buffType: msg.payload.buffType, correct: msg.payload.correct },
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

    socket.on('close', () => {
      clearInterval(pingInterval)
      slot.connected = false

      if (slot.role === 'scholar') {
        room.scholarDisconnectTick = room.tick
        broadcast(room, {
          type: 'scholar:disconnected',
          payload: { reconnectWindowTicks: RECONNECT_WINDOW_TICKS },
        })
      } else {
        // Miner disconnects — end the dive and return partial loot.
        room.status = 'ended'
        broadcast(room, { type: 'dive:ended', payload: { reason: 'miner_disconnected' } })
      }
    })
  })
}

/** Room-level sync loop: broadcast authoritative state 10 times/sec. */
const activeSyncLoops = new Set<string>()

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
```

#### 3.1.4 Register routes in `server/src/index.ts`

Add after the existing social/ugc route registrations:

```typescript
// server/src/index.ts  (additions only)
import websocket from '@fastify/websocket'
import { coopWsRoutes } from './routes/coopWs.js'
import { coopRoutes } from './routes/coop.js'

// Inside buildApp(), after existing plugin registrations:
await fastify.register(websocket)
await fastify.register(coopRoutes, { prefix: '/api/coop' })
await fastify.register(coopWsRoutes)    // WebSocket routes registered at root level

// Prune stale rooms every 30 minutes.
import { pruneStaleRooms } from './services/coopRoomService.js'
setInterval(pruneStaleRooms, 30 * 60 * 1000)
```

#### 3.1.5 Acceptance Criteria for 43.1

- [ ] `GET /coop/ws/:roomId?playerId=X` upgrades to WebSocket and responds with
  `player:connected` to both sockets within 200 ms.
- [ ] `dive:sync` frames arrive at each client at approximately 10 Hz.
- [ ] Server sends `pong` in response to client `ping` messages.
- [ ] A socket that misses 2 consecutive heartbeat windows (30 s) triggers the
  `scholar:disconnected` or `dive:ended` flow.
- [ ] `pruneStaleRooms()` removes rooms older than 2 hours when called.
- [ ] TypeScript strict mode: `npm run typecheck` passes on the server package.

---

### 43.2 — Co-op Matchmaking (Friend Invite, Random Match, Room Codes)

**Goal**: Give players three ways to start a co-op session — invite a friend from their
social list, enter a room code shared out-of-band, or join the quickmatch queue.

#### 3.2.1 Extend `server/src/routes/coop.ts`

Add three new endpoints to the existing REST module:

```typescript
// Additions to coopRoutes() in server/src/routes/coop.ts

// Find a room by 6-character invite code (for sharing).
app.get('/lobby/code/:code', async (req, reply) => {
  const { code } = req.params as { code: string }
  const room = findRoomByCode(code)   // imported from coopRoomService
  if (!room) return reply.status(404).send({ error: 'Code not found or lobby no longer open' })
  return reply.send({ roomId: room.id, code: room.code, hostName: room.slots[0]?.displayName })
})

// Quickmatch queue: add self, return matched roomId or 'queued'.
const quickmatchQueue: { playerId: string; name: string; enqueuedAt: number }[] = []

app.post('/quickmatch/join', async (req, reply) => {
  const { playerId, playerName } = req.body as { playerId: string; playerName: string }
  if (!playerId || !playerName) return reply.status(400).send({ error: 'playerId and playerName required' })

  // Check if there is already someone waiting.
  const waiting = quickmatchQueue.find(e => e.playerId !== playerId)
  if (waiting) {
    // Match found: create a room, remove waiter from queue.
    quickmatchQueue.splice(quickmatchQueue.indexOf(waiting), 1)
    const room = createRoom(waiting.playerId, waiting.name)
    joinRoom(room.id, playerId, playerName)
    return reply.send({ matched: true, roomId: room.id })
  }

  // No match — add to queue (replace existing entry for this player).
  const existingIdx = quickmatchQueue.findIndex(e => e.playerId === playerId)
  if (existingIdx >= 0) quickmatchQueue.splice(existingIdx, 1)
  quickmatchQueue.push({ playerId, playerName, enqueuedAt: Date.now() })

  // Expire queue entries older than 60 s.
  const cutoff = Date.now() - 60_000
  quickmatchQueue.splice(0, quickmatchQueue.length, ...quickmatchQueue.filter(e => e.enqueuedAt > cutoff))

  return reply.send({ matched: false, queueLength: quickmatchQueue.length })
})

app.post('/quickmatch/leave', async (req, reply) => {
  const { playerId } = req.body as { playerId: string }
  const idx = quickmatchQueue.findIndex(e => e.playerId === playerId)
  if (idx >= 0) quickmatchQueue.splice(idx, 1)
  return reply.send({ ok: true })
})
```

#### 3.2.2 Create `src/services/coopService.ts`

Client-side service wrapping all coop REST calls and managing the client WebSocket
lifecycle for co-op dives.

```typescript
// src/services/coopService.ts
import { wsClient } from './wsClient'
import type { WSMessage } from './wsClient'

const BASE = () =>
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? (import.meta.env.VITE_API_URL as string)
    : 'http://localhost:3001/api'
  ).replace(/\/$/, '')

const AUTH = () => localStorage.getItem('terra_auth_token') ?? ''

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

/** Create a new lobby room as host. Returns roomId and 6-char invite code. */
export async function createLobby(hostId: string, hostName: string): Promise<{ roomId: string; code: string }> {
  const data = await post<{ lobby: { id: string; code: string } }>('/coop/lobby/create', { hostId, hostName })
  return { roomId: data.lobby.id, code: data.lobby.id.slice(-6).toUpperCase() }
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
```

#### 3.2.3 Create `src/ui/components/CoopMatchmaker.svelte`

A Svelte overlay that unifies the three entry flows: friend invite, code entry, quickmatch.

```svelte
<!-- src/ui/components/CoopMatchmaker.svelte -->
<script lang="ts">
  import { createLobby, joinLobby, findByCode, quickmatchJoin, quickmatchLeave } from '../../services/coopService'
  import { get } from 'svelte/store'
  import { playerSave } from '../stores/playerData'

  export let onRoomReady: (roomId: string, role: 'miner' | 'scholar') => void
  export let onClose: () => void

  type Tab = 'host' | 'code' | 'quickmatch'
  let tab: Tab = 'host'
  let code = ''
  let status = ''
  let loading = false
  let pollingInterval: ReturnType<typeof setInterval> | null = null

  $: save = get(playerSave)
  $: playerId = save?.id ?? 'guest'
  $: playerName = save?.displayName ?? 'Miner'

  async function handleHost(): Promise<void> {
    loading = true
    try {
      const { roomId } = await createLobby(playerId, playerName)
      onRoomReady(roomId, 'miner')
    } catch (e) {
      status = 'Could not create lobby.'
    } finally {
      loading = false
    }
  }

  async function handleCode(): Promise<void> {
    loading = true
    status = ''
    const result = await findByCode(code.trim())
    if (!result) { status = 'Code not found.'; loading = false; return }
    await joinLobby(result.roomId, playerId, playerName)
    onRoomReady(result.roomId, 'scholar')
    loading = false
  }

  async function handleQuickmatch(): Promise<void> {
    loading = true
    status = 'Searching for a partner...'
    const result = await quickmatchJoin(playerId, playerName)
    if (result.matched && result.roomId) {
      onRoomReady(result.roomId, 'scholar')
      loading = false
      return
    }
    // Poll every 3 s for up to 60 s.
    let elapsed = 0
    pollingInterval = setInterval(async () => {
      elapsed += 3000
      if (elapsed >= 60_000) { stopPolling(); status = 'No match found. Try again.'; return }
      const poll = await quickmatchJoin(playerId, playerName)
      if (poll.matched && poll.roomId) { stopPolling(); onRoomReady(poll.roomId, 'scholar') }
    }, 3000)
  }

  function stopPolling(): void {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
    loading = false
  }

  function handleClose(): void {
    stopPolling()
    quickmatchLeave(playerId).catch(() => {})
    onClose()
  }
</script>

<div class="matchmaker-overlay" role="dialog" aria-label="Co-op Matchmaker">
  <div class="matchmaker-panel">
    <div class="mm-header">
      <h2>Co-op Dive</h2>
      <button class="close-x" on:click={handleClose} aria-label="Close">&times;</button>
    </div>

    <div class="tab-row">
      {#each (['host', 'code', 'quickmatch'] as Tab[]) as t}
        <button class="tab-btn" class:active={tab === t} on:click={() => { tab = t; status = '' }}>
          {t === 'host' ? 'Host' : t === 'code' ? 'Enter Code' : 'Quickmatch'}
        </button>
      {/each}
    </div>

    {#if tab === 'host'}
      <p class="mm-desc">Create a lobby and share the code with a friend.</p>
      <button class="action-btn" on:click={handleHost} disabled={loading}>
        {loading ? 'Creating...' : 'Create Lobby'}
      </button>

    {:else if tab === 'code'}
      <p class="mm-desc">Enter the 6-character code your partner shared.</p>
      <input
        class="code-input"
        bind:value={code}
        maxlength={6}
        placeholder="XXXXXX"
        aria-label="Room code"
      />
      <button class="action-btn" on:click={handleCode} disabled={loading || code.length < 6}>
        {loading ? 'Joining...' : 'Join'}
      </button>

    {:else}
      <p class="mm-desc">Find a random partner to mine with.</p>
      <button class="action-btn" on:click={handleQuickmatch} disabled={loading}>
        {loading ? 'Searching...' : 'Find Partner'}
      </button>
      {#if loading}
        <button class="cancel-btn" on:click={stopPolling}>Cancel</button>
      {/if}
    {/if}

    {#if status}
      <p class="status-text">{status}</p>
    {/if}
  </div>
</div>

<style>
  .matchmaker-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.88);
    display: flex; align-items: center; justify-content: center;
    z-index: 200; pointer-events: auto;
  }
  .matchmaker-panel {
    background: #16213e; border: 1px solid #0f3460; border-radius: 10px;
    padding: 24px; width: 340px; display: flex; flex-direction: column; gap: 12px;
  }
  .mm-header { display: flex; justify-content: space-between; align-items: center; }
  .mm-header h2 { font-family: 'Press Start 2P', monospace; font-size: 12px; color: #e94560; margin: 0; }
  .close-x { background: none; border: none; color: #888; font-size: 22px; cursor: pointer; }
  .tab-row { display: flex; gap: 6px; }
  .tab-btn {
    flex: 1; padding: 8px 4px; font-size: 10px; font-family: 'Press Start 2P', monospace;
    background: #0f3460; border: 1px solid #1a4a8a; border-radius: 4px; color: #aaa; cursor: pointer;
  }
  .tab-btn.active { background: #1a4a8a; color: #fff; border-color: #4ecca3; }
  .mm-desc { color: #aaa; font-size: 12px; margin: 0; }
  .action-btn {
    padding: 12px; background: #e94560; color: #fff; border: none; border-radius: 6px;
    font-family: 'Press Start 2P', monospace; font-size: 11px; cursor: pointer;
  }
  .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .cancel-btn {
    padding: 8px; background: #333; color: #aaa; border: none; border-radius: 4px;
    font-size: 11px; cursor: pointer;
  }
  .code-input {
    padding: 10px; background: #0f3460; border: 1px solid #1a4a8a; border-radius: 4px;
    color: #fff; font-family: 'Press Start 2P', monospace; font-size: 16px;
    text-align: center; letter-spacing: 4px; text-transform: uppercase;
  }
  .status-text { color: #e94560; font-size: 11px; text-align: center; }
</style>
```

#### 3.2.4 Acceptance Criteria for 43.2

- [ ] Host creates a lobby; the returned code appears in `CoopLobby.svelte`.
- [ ] Scholar enters the 6-char code; `findByCode` returns the roomId within 500 ms.
- [ ] Two players calling `quickmatchJoin` within 60 s are paired in the same room.
- [ ] Stale quickmatch entries older than 60 s are removed on the next `quickmatchJoin` call.
- [ ] `quickmatchLeave` removes the player from the queue before the match fires.
- [ ] TypeScript strict mode passes for both `coopService.ts` and `CoopMatchmaker.svelte`.

---

### 43.3 — Shared Mine State Sync (Authoritative Server, Client Prediction, Reconciliation)

**Goal**: Keep both clients in sync with the authoritative mine state using optimistic
client-side prediction and server-authoritative reconciliation.

#### 3.3.1 Create `server/src/services/coopMineService.ts`

Applies player inputs to the authoritative `CoopRoom` grid, calculates O2 costs,
and queues loot ledger updates.

```typescript
// server/src/services/coopMineService.ts
import type { CoopRoom } from './coopRoomService.js'
import { broadcast } from './coopRoomService.js'

/** Block hardness table (mirrors client balance.ts — kept in sync manually). */
const HARDNESS: Record<string, number> = {
  dirt: 1, soft_rock: 2, stone: 3, hard_rock: 5, mineral_node: 3,
  artifact_node: 4, quiz_gate: 1, oxygen_cache: 1,
}

/** O2 cost per block type mined (mirrors client). */
const O2_COST: Record<string, number> = {
  dirt: 1, soft_rock: 2, stone: 3, hard_rock: 5, move: 1,
}

/** Apply a Miner move or mine action to the authoritative room state. */
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
```

#### 3.3.2 Client Reconciliation in `src/services/coopService.ts`

Add a reconcile function that the Svelte UI calls on each `dive:sync` message:

```typescript
// Addition to src/services/coopService.ts

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
```

#### 3.3.3 Acceptance Criteria for 43.3

- [ ] Mining a block on the Miner client: local prediction removes the block immediately;
  server confirms within the next sync frame (≤ 100 ms).
- [ ] If the server rejects a move (block is unbreakable), the reconcile() call restores
  the correct state within one sync cycle.
- [ ] O2 values on both clients remain within ±3 of the server-authoritative value at
  any point during a dive.
- [ ] `block:mined` events arrive at the Scholar client and trigger the correct UI update.
- [ ] The sync loop does not flood the WebSocket: frame rate is ≤ 10 Hz per room.

---

### 43.4 — Miner / Scholar Role System

**Goal**: Implement the asymmetric role mechanics. The Miner moves and mines; the Scholar
answers quizzes presented by the server to grant real-time buffs to the Miner.

#### 3.4.1 Create `server/src/services/coopRoleService.ts`

```typescript
// server/src/services/coopRoleService.ts
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
    const type = (input.buffType as BuffType) ?? 'o2_restore'
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
```

#### 3.4.2 Create `src/ui/stores/coopState.ts`

Client-side Svelte stores for co-op runtime state.

```typescript
// src/ui/stores/coopState.ts
import { writable, derived } from 'svelte/store'

export type CoopRole = 'miner' | 'scholar'
export type BuffType = 'o2_restore' | 'loot_boost' | 'hardness_cut' | 'speed_surge'

export interface ActiveBuff {
  type: BuffType
  label: string
  expiresAtTick: number
}

export interface PartnerStatus {
  playerId: string
  displayName: string
  role: CoopRole
  connected: boolean
  o2?: number          // Miner: partner's o2 (echoed in Scholar HUD)
}

/** Current local player's role in the co-op dive. null = solo. */
export const coopRole = writable<CoopRole | null>(null)

/** The partner's live status. */
export const partnerStatus = writable<PartnerStatus | null>(null)

/** The currently active Scholar buff (if any). */
export const activeBuff = writable<ActiveBuff | null>(null)

/** Co-op quiz queue for the Scholar role: facts to answer. */
export interface CoopQuizItem {
  factId: string
  question: string
  choices: string[]
  buffType: BuffType
}
export const coopQuizQueue = writable<CoopQuizItem[]>([])

/** True when the Scholar's partner has disconnected and we're in recovery mode. */
export const inRecoveryMode = writable(false)

/** Ticks remaining in the reconnect window. */
export const recoveryTicksLeft = writable(0)

/** Derived: should the Scholar quiz panel be shown? */
export const showScholarPanel = derived(
  [coopRole, partnerStatus],
  ([$role, $partner]) => $role === 'scholar' && $partner !== null
)
```

#### 3.4.3 Scholar Quiz Feed — `src/ui/components/ScholarQuizPanel.svelte`

The Scholar's primary interaction surface: a compact quiz panel shown beneath the
mine view. The server pushes quiz questions via `scholar:quiz_prompt` WebSocket messages;
the Scholar answers and sends `dive:quiz_answer` back.

```svelte
<!-- src/ui/components/ScholarQuizPanel.svelte -->
<script lang="ts">
  import { get } from 'svelte/store'
  import { coopQuizQueue, activeBuff } from '../stores/coopState'
  import { wsClient } from '../../services/wsClient'

  $: queue = $coopQuizQueue
  $: current = queue[0] ?? null
  $: buff = $activeBuff

  function answer(choice: string, correct: boolean): void {
    if (!current) return
    wsClient.send('dive:quiz_answer', {
      factId: current.factId,
      correct,
      buffType: current.buffType,
    })
    coopQuizQueue.update(q => q.slice(1))
  }

  function isCorrect(choice: string): boolean {
    // Choices array: index 0 is always the correct answer (server sends pre-shuffled).
    // We compare by value to the first choice stored before shuffling.
    // The 'correct' field on CoopQuizItem is the correct answer string.
    return choice === (current as any).correctAnswer
  }
</script>

<div class="scholar-panel" aria-label="Scholar Quiz Panel" role="complementary">
  {#if buff}
    <div class="buff-active">
      Buff: <strong>{buff.label}</strong> — expires tick {buff.expiresAtTick}
    </div>
  {/if}

  {#if current}
    <p class="question">{current.question}</p>
    <div class="choices">
      {#each current.choices as choice}
        <button
          class="choice-btn"
          on:click={() => answer(choice, isCorrect(choice))}
          aria-label={choice}
        >{choice}</button>
      {/each}
    </div>
  {:else}
    <p class="waiting">Waiting for knowledge gate...</p>
  {/if}
</div>

<style>
  .scholar-panel {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: rgba(22, 33, 62, 0.95); border-top: 2px solid #4ecca3;
    padding: 12px 16px; z-index: 100; pointer-events: auto;
  }
  .buff-active { font-size: 11px; color: #4ecca3; margin-bottom: 8px; }
  .question { font-size: 12px; color: #e0e0e0; margin: 0 0 10px; }
  .choices { display: flex; flex-wrap: wrap; gap: 6px; }
  .choice-btn {
    flex: 1 1 40%; padding: 8px; background: #0f3460;
    border: 1px solid #1a4a8a; border-radius: 4px; color: #e0e0e0;
    font-size: 11px; cursor: pointer; text-align: left;
  }
  .choice-btn:hover { background: #1a4a8a; }
  .waiting { color: #666; font-size: 11px; margin: 0; }
</style>
```

#### 3.4.4 Acceptance Criteria for 43.4

- [ ] When the Scholar answers correctly, the Miner's O2 increases by 15 (o2_restore buff)
  within one sync cycle.
- [ ] Incorrect Scholar answers reduce Miner O2 by 5 within one sync cycle.
- [ ] Only one buff is active at a time; a new correct answer replaces the previous buff.
- [ ] `scholar:buff_applied` and `scholar:buff_failed` messages arrive at the Miner client.
- [ ] `ScholarQuizPanel` shows the question and 4 choices; submitting an answer sends the
  correct `dive:quiz_answer` WebSocket message.
- [ ] `coopRole` store is `'miner'` on the host client and `'scholar'` on the joining client.

---

### 43.5 — Co-op Loot Ledger (Fair Split, Cooperation Bonus, End-of-Dive Summary)

**Goal**: Track individual contributions during the dive and compute a fair loot split
with a cooperation bonus (DD-V2-162) at dive end. Display the split in a summary overlay.

#### 3.5.1 Extend `server/src/services/coopRoomService.ts` — Finalize Ledger

Add a `finalizeLedger()` function that computes the split and emits `dive:loot_summary`.

```typescript
// Addition to server/src/services/coopRoomService.ts

export interface LootSplit {
  playerId: string
  displayName: string
  role: CoopRole
  base: Record<string, number>       // raw loot attributed to this player
  cooperationBonus: Record<string, number>  // bonus from joint success
  total: Record<string, number>      // base + bonus
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
```

Call `finalizeLedger(room)` inside `coopWsRoutes.ts` whenever `dive:ended` fires:

```typescript
// In the socket.on('close') handler and the o2_depleted branch:
import { finalizeLedger } from '../services/coopRoomService.js'
// ...
room.status = 'ended'
finalizeLedger(room)
broadcast(room, { type: 'dive:ended', payload: { reason } })
```

#### 3.5.2 Create `src/ui/components/CoopLootSummary.svelte`

End-of-dive overlay shown to both players simultaneously.

```svelte
<!-- src/ui/components/CoopLootSummary.svelte -->
<script lang="ts">
  export let splits: Array<{
    playerId: string
    displayName: string
    role: 'miner' | 'scholar'
    base: Record<string, number>
    cooperationBonus: Record<string, number>
    total: Record<string, number>
  }> = []
  export let bothActive = false
  export let onDone: () => void

  function mineralKeys(obj: Record<string, number>): string[] {
    return Object.keys(obj).filter(k => (obj[k] ?? 0) > 0)
  }
</script>

<div class="summary-overlay" role="dialog" aria-label="Co-op Loot Summary">
  <div class="summary-panel">
    <h2 class="title">Dive Complete!</h2>
    {#if bothActive}
      <p class="coop-badge">Cooperation Bonus Earned!</p>
    {/if}

    <div class="split-columns">
      {#each splits as split}
        <div class="player-col">
          <p class="player-name">{split.displayName} <span class="role-tag">({split.role})</span></p>
          {#each mineralKeys(split.total) as m}
            <div class="loot-row">
              <span class="mineral-name">{m}</span>
              <span class="mineral-base">{split.base[m] ?? 0}</span>
              {#if (split.cooperationBonus[m] ?? 0) > 0}
                <span class="mineral-bonus">+{split.cooperationBonus[m]}</span>
              {/if}
              <span class="mineral-total">{split.total[m]}</span>
            </div>
          {/each}
          {#if mineralKeys(split.total).length === 0}
            <p class="no-loot">No loot</p>
          {/if}
        </div>
      {/each}
    </div>

    <button class="done-btn" on:click={onDone}>Return to Dome</button>
  </div>
</div>

<style>
  .summary-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.92);
    display: flex; align-items: center; justify-content: center;
    z-index: 300; pointer-events: auto;
  }
  .summary-panel {
    background: #16213e; border: 1px solid #4ecca3; border-radius: 10px;
    padding: 28px; min-width: 320px; max-width: 480px;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .title { font-family: 'Press Start 2P', monospace; font-size: 13px; color: #4ecca3; margin: 0; }
  .coop-badge { background: #4ecca3; color: #16213e; padding: 4px 12px; border-radius: 4px; font-size: 11px; }
  .split-columns { display: flex; gap: 24px; width: 100%; justify-content: center; }
  .player-col { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .player-name { font-size: 11px; color: #e0e0e0; margin: 0 0 8px; }
  .role-tag { color: #888; font-size: 10px; }
  .loot-row { display: flex; gap: 6px; font-size: 11px; align-items: center; }
  .mineral-name { flex: 1; color: #aaa; }
  .mineral-base { color: #ccc; }
  .mineral-bonus { color: #4ecca3; }
  .mineral-total { font-weight: bold; color: #fff; }
  .no-loot { color: #555; font-size: 11px; }
  .done-btn {
    padding: 12px 32px; background: #e94560; color: #fff; border: none;
    border-radius: 6px; font-family: 'Press Start 2P', monospace; font-size: 11px; cursor: pointer;
  }
</style>
```

#### 3.5.3 Acceptance Criteria for 43.5

- [ ] `finalizeLedger()` produces exactly 2 `LootSplit` entries (one per role).
- [ ] With both players active: each player's `cooperationBonus` is 10% of total pool
  (half of the 20% cooperation pool).
- [ ] With Scholar AFK (0 quizzes answered): `bothActive = false`, no cooperation bonus.
- [ ] `dive:loot_summary` arrives at both clients within 500 ms of `dive:ended`.
- [ ] `CoopLootSummary.svelte` renders correctly for a Miner who collected 0 loot
  (Scholar who only answered quizzes — shows "No loot" in the Miner column if minerals
  only credited to scholar side; handles zero mineral case cleanly).
- [ ] "Return to Dome" button triggers the `onDone` callback and clears co-op stores.

---

### 43.6 — Disconnect Recovery (Reconnect Window, AI Takeover, Graceful Degradation)

**Goal**: When the Scholar disconnects, give a 60-tick reconnect window. If they return,
the dive resumes normally. If the window expires, a lightweight AI Scholar takes over
for the remainder of the dive (DD-V2-160).

#### 3.6.1 Create `server/src/services/coopAiScholar.ts`

A minimal AI that answers quiz questions injected by the server-side quiz feed. The AI
Scholar has a configurable accuracy rate (default 60%) so it never completely substitutes
for a skilled human partner.

```typescript
// server/src/services/coopAiScholar.ts
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
```

#### 3.6.2 Integrate Reconnect Window into `server/src/routes/coopWs.ts`

In the `socket.on('close')` handler for Scholar disconnect, start a tick-based countdown.
After `RECONNECT_WINDOW_TICKS` ticks pass without reconnect, activate the AI.

```typescript
// Addition inside coopWsRoutes, scholar disconnect branch:
import { activateAiScholar, deactivateAiScholar } from '../services/coopAiScholar.js'

// Replace the existing scholar disconnect handler with:
if (slot.role === 'scholar') {
  room.scholarDisconnectTick = room.tick
  broadcast(room, {
    type: 'scholar:disconnected',
    payload: { reconnectWindowTicks: RECONNECT_WINDOW_TICKS },
  })

  // After RECONNECT_WINDOW_TICKS real seconds (not game ticks), activate AI.
  const aiActivationTimeout = setTimeout(() => {
    if (room.scholarDisconnectTick !== null) {
      // Still disconnected — activate AI Scholar.
      activateAiScholar(room)
      broadcast(room, { type: 'ai_scholar:activated', payload: {} })
    }
  }, RECONNECT_WINDOW_TICKS * 1000)   // 60 seconds

  // Cancel AI activation if scholar reconnects.
  // (The reconnect branch in the 'open' handler calls deactivateAiScholar.)
}

// In the Scholar reconnect branch (socket open, slot.role === 'scholar'):
deactivateAiScholar(room.id)
room.scholarDisconnectTick = null
broadcast(room, { type: 'scholar:reconnected', payload: {} })
```

#### 3.6.3 Client-side Recovery UI in `src/ui/components/CoopRecoveryBanner.svelte`

```svelte
<!-- src/ui/components/CoopRecoveryBanner.svelte -->
<script lang="ts">
  import { inRecoveryMode, recoveryTicksLeft } from '../stores/coopState'

  $: mode = $inRecoveryMode
  $: ticks = $recoveryTicksLeft
</script>

{#if mode}
  <div class="recovery-banner" role="alert" aria-live="polite">
    {#if ticks > 0}
      Partner disconnected — waiting {ticks}s for reconnect...
    {:else}
      GAIA Scholar has taken over. Reconnect your partner to restore full bonus!
    {/if}
  </div>
{/if}

<style>
  .recovery-banner {
    position: fixed; top: 0; left: 0; right: 0;
    background: #e94560; color: #fff; text-align: center;
    padding: 8px; font-size: 11px; font-family: 'Press Start 2P', monospace;
    z-index: 150; pointer-events: none;
  }
</style>
```

Listen to `scholar:disconnected` and `scholar:reconnected` WS events in the co-op session
controller (see 43.7) and update `inRecoveryMode` / `recoveryTicksLeft` accordingly.

#### 3.6.4 Acceptance Criteria for 43.6

- [ ] Scholar disconnect triggers `scholar:disconnected` on the Miner client within 500 ms.
- [ ] `CoopRecoveryBanner` displays a countdown correctly.
- [ ] Scholar reconnecting within 60 s cancels the AI activation; `scholar:reconnected`
  fires on the Miner client.
- [ ] After 60 s without reconnect, `ai_scholar:activated` fires; the AI Scholar applies
  a buff every ~15 s at 60% accuracy.
- [ ] `deactivateAiScholar()` is called on dive end; no interval leaks after room cleanup.
- [ ] Cooperation bonus is NOT awarded if the Scholar was replaced by the AI for more than
  50% of the dive duration (determined by `scholarDisconnectTick` ratio to total ticks).

---

### 43.7 — Co-op UI (Indicators, Partner Status, Chat / Emotes)

**Goal**: Surface partner status, active buffs, and a quick-emote bar in the existing
MineScene HUD without occluding the mine grid on 375 px screens.

#### 3.7.1 Create `src/ui/components/CoopHUD.svelte`

A compact overlay strip pinned to the top of the viewport showing both players' status.

```svelte
<!-- src/ui/components/CoopHUD.svelte -->
<script lang="ts">
  import { coopRole, partnerStatus, activeBuff } from '../stores/coopState'

  $: role = $coopRole
  $: partner = $partnerStatus
  $: buff = $activeBuff

  const EMOTES = ['👍', '⚡', '💎', '🆘'] as const
  type Emote = typeof EMOTES[number]

  import { wsClient } from '../../services/wsClient'
  function sendEmote(e: Emote): void {
    wsClient.send('chat:message', { text: e, emote: true })
  }
</script>

{#if role !== null && partner !== null}
  <div class="coop-hud" aria-label="Co-op Status">
    <div class="player-strip self">
      <span class="role-dot" class:miner={role === 'miner'} class:scholar={role === 'scholar'}></span>
      <span class="name">You ({role})</span>
    </div>

    <div class="player-strip partner" class:disconnected={!partner.connected}>
      <span class="role-dot" class:miner={partner.role === 'miner'} class:scholar={partner.role === 'scholar'}></span>
      <span class="name">{partner.displayName} ({partner.role})</span>
      {#if !partner.connected}
        <span class="dc-badge">DC</span>
      {/if}
    </div>

    {#if buff}
      <div class="buff-chip" title="Active buff expires tick {buff.expiresAtTick}">
        {buff.label}
      </div>
    {/if}

    <div class="emote-bar" aria-label="Quick emotes">
      {#each EMOTES as e}
        <button class="emote-btn" on:click={() => sendEmote(e)} aria-label={`Send emote ${e}`}>{e}</button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .coop-hud {
    position: fixed; top: 48px; left: 0; right: 0;
    display: flex; align-items: center; gap: 8px; padding: 4px 8px;
    background: rgba(22, 33, 62, 0.85); border-bottom: 1px solid #0f3460;
    z-index: 90; pointer-events: none; flex-wrap: wrap;
  }
  .player-strip { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #ccc; }
  .player-strip.disconnected { opacity: 0.4; }
  .role-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .role-dot.miner { background: #e94560; }
  .role-dot.scholar { background: #4ecca3; }
  .dc-badge { font-size: 9px; background: #e94560; color: #fff; padding: 1px 4px; border-radius: 3px; }
  .buff-chip {
    font-size: 9px; background: #4ecca3; color: #16213e;
    padding: 2px 8px; border-radius: 8px; font-weight: bold;
  }
  .emote-bar { margin-left: auto; display: flex; gap: 4px; pointer-events: auto; }
  .emote-btn {
    background: none; border: 1px solid #333; border-radius: 4px;
    font-size: 14px; cursor: pointer; padding: 2px 4px; line-height: 1;
  }
  .emote-btn:hover { background: rgba(255,255,255,0.1); }
</style>
```

#### 3.7.2 Emote Toast in `src/ui/components/CoopEmoteToast.svelte`

When a chat:message emote arrives via WebSocket, show a transient toast over the mine.

```svelte
<!-- src/ui/components/CoopEmoteToast.svelte -->
<script lang="ts">
  let toasts: { id: number; text: string; from: string }[] = []
  let nextId = 0

  import { onMount } from 'svelte'
  import { wsClient } from '../../services/wsClient'

  onMount(() => {
    const unsub = wsClient.on('chat:message', (msg) => {
      if (!msg.payload.emote) return
      const id = nextId++
      toasts = [...toasts, { id, text: String(msg.payload.text), from: String(msg.payload.from ?? 'Partner') }]
      setTimeout(() => { toasts = toasts.filter(t => t.id !== id) }, 3000)
    })
    return unsub
  })
</script>

<div class="toast-container" aria-live="polite" aria-atomic="false">
  {#each toasts as toast (toast.id)}
    <div class="emote-toast">{toast.from}: {toast.text}</div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 4px; z-index: 120; pointer-events: none;
  }
  .emote-toast {
    background: rgba(22,33,62,0.9); color: #4ecca3; padding: 6px 14px;
    border-radius: 16px; font-size: 14px; text-align: center;
    animation: fadeInOut 3s ease forwards;
  }
  @keyframes fadeInOut {
    0%   { opacity: 0; transform: translateY(8px); }
    15%  { opacity: 1; transform: translateY(0); }
    80%  { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
```

#### 3.7.3 Register CoopHUD and CoopEmoteToast in `src/ui/components/HUD.svelte`

Add the two components alongside the existing HUD, conditionally rendered when
`$coopRole !== null`.

```svelte
<!-- Addition inside HUD.svelte, after existing HUD content: -->
<script lang="ts">
  // ... existing imports
  import CoopHUD from './CoopHUD.svelte'
  import CoopEmoteToast from './CoopEmoteToast.svelte'
  import CoopRecoveryBanner from './CoopRecoveryBanner.svelte'
  import { coopRole } from '../stores/coopState'
</script>

<!-- Inside the HUD template, before the closing tag: -->
{#if $coopRole !== null}
  <CoopHUD />
  <CoopEmoteToast />
  <CoopRecoveryBanner />
{/if}
```

#### 3.7.4 Analytics Events

Add co-op analytics events to `src/data/analyticsEvents.ts`:

```typescript
// Additions to analyticsEvents.ts:
| 'coop_dive_started'       // { role, matchType: 'friend' | 'code' | 'quickmatch' }
| 'coop_dive_completed'     // { bothActive, cooperationBonusEarned, totalLoot }
| 'coop_scholar_disconnect' // { tick, reconnected: boolean }
| 'coop_emote_sent'         // { emote }
```

Call `analyticsService.track()` at: dive start (in coopService.connectToRoom), dive end
(in CoopLootSummary onDone), scholar disconnect (in coopWs socket.on('close')),
emote send (in CoopHUD sendEmote).

#### 3.7.5 Acceptance Criteria for 43.7

- [ ] `CoopHUD` renders with correct role colors (Miner = red `#e94560`, Scholar = teal
  `#4ecca3`) for both player strips.
- [ ] Sending an emote dispatches a `chat:message` WS message with `emote: true`.
- [ ] `CoopEmoteToast` shows the received emote and disappears after 3 s.
- [ ] `CoopRecoveryBanner` mounts/unmounts correctly based on `inRecoveryMode` store.
- [ ] The CoopHUD strip does not overlap the mine grid tile rows on a 375 × 667 px viewport
  (the strip height must be ≤ 40 px).
- [ ] All four analytics events are tracked at the correct moments.

---

## 4. Playwright Test Scripts

All tests are Node.js scripts runnable with `node /tmp/<script>.js` using the project's
installed Playwright Chrome executable.

### 4.1 Test: Lobby Creation and Code Join

```js
// /tmp/test-coop-lobby.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })

  // Player 1 (host) creates lobby.
  const page1 = await browser.newPage()
  await page1.setViewportSize({ width: 390, height: 844 })
  await page1.goto('http://localhost:5173')
  await page1.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate to co-op (assumes a Co-op button exists in the Hub or Dive Prep).
  await page1.click('button:has-text("Co-op")')
  await page1.waitForSelector('[aria-label="Co-op Matchmaker"]', { timeout: 5000 })
  await page1.click('button:has-text("Host")')
  await page1.waitForSelector('[aria-label="Co-op Lobby"]', { timeout: 5000 })
  const codeText = await page1.textContent('.lobby-code strong')
  console.log('Room code:', codeText)

  // Player 2 (scholar) joins by code.
  const page2 = await browser.newPage()
  await page2.setViewportSize({ width: 390, height: 844 })
  await page2.goto('http://localhost:5173')
  await page2.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page2.click('button:has-text("Co-op")')
  await page2.waitForSelector('[aria-label="Co-op Matchmaker"]', { timeout: 5000 })
  await page2.click('button:has-text("Enter Code")')
  await page2.fill('.code-input', codeText ?? 'XXXXXX')
  await page2.click('button:has-text("Join")')
  await page2.waitForSelector('[aria-label="Co-op Lobby"]', { timeout: 5000 })

  // Both players ready up.
  await page1.click('.ready-btn')
  await page2.click('.ready-btn')
  await page1.waitForSelector('.start-btn:not([disabled])', { timeout: 5000 })
  await page1.screenshot({ path: '/tmp/ss-coop-lobby.png' })
  console.log('PASS: Lobby created and joined successfully.')
  await browser.close()
})()
```

### 4.2 Test: Scholar Buff Applied

```js
// /tmp/test-coop-scholar-buff.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Mock a co-op session as Scholar by injecting store state.
  await page.evaluate(async () => {
    const { coopRole, partnerStatus, coopQuizQueue } = await import('/src/ui/stores/coopState.ts')
    coopRole.set('scholar')
    partnerStatus.set({ playerId: 'miner-1', displayName: 'Partner', role: 'miner', connected: true })
    coopQuizQueue.set([{
      factId: 'fact-001',
      question: 'What element has atomic number 6?',
      choices: ['Carbon', 'Nitrogen', 'Oxygen', 'Helium'],
      buffType: 'o2_restore',
      correctAnswer: 'Carbon',
    }])
  })

  await page.waitForSelector('[aria-label="Scholar Quiz Panel"]', { timeout: 5000 })
  await page.screenshot({ path: '/tmp/ss-scholar-panel.png' })

  // Answer correctly.
  await page.click('.choice-btn:has-text("Carbon")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-scholar-answered.png' })
  console.log('PASS: Scholar quiz panel rendered and answer submitted.')
  await browser.close()
})()
```

### 4.3 Test: Disconnect Recovery Banner

```js
// /tmp/test-coop-disconnect.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Simulate disconnect by setting inRecoveryMode.
  await page.evaluate(async () => {
    const { coopRole, partnerStatus, inRecoveryMode, recoveryTicksLeft } = await import('/src/ui/stores/coopState.ts')
    coopRole.set('miner')
    partnerStatus.set({ playerId: 'scholar-1', displayName: 'Scholar', role: 'scholar', connected: false })
    inRecoveryMode.set(true)
    recoveryTicksLeft.set(45)
  })

  await page.waitForSelector('[role="alert"]', { timeout: 5000 })
  const bannerText = await page.textContent('[role="alert"]')
  console.log('Banner text:', bannerText)
  if (!bannerText?.includes('45')) throw new Error('Recovery countdown not shown')
  await page.screenshot({ path: '/tmp/ss-coop-recovery.png' })
  console.log('PASS: Recovery banner shows correct countdown.')
  await browser.close()
})()
```

### 4.4 Test: Loot Summary Split Display

```js
// /tmp/test-coop-loot-summary.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Inject CoopLootSummary directly.
  await page.evaluate(async () => {
    // Dynamically mount CoopLootSummary via the Svelte app's global mounting point.
    // This tests the component in isolation within the live app environment.
    const event = new CustomEvent('coop:test:show-summary', {
      detail: {
        splits: [
          { playerId: 'p1', displayName: 'AlphaMinr', role: 'miner', base: { dust: 80 }, cooperationBonus: { dust: 16 }, total: { dust: 96 } },
          { playerId: 'p2', displayName: 'ScholarBot', role: 'scholar', base: { dust: 20 }, cooperationBonus: { dust: 16 }, total: { dust: 36 } },
        ],
        bothActive: true,
      }
    })
    window.dispatchEvent(event)
  })

  await page.waitForSelector('[aria-label="Co-op Loot Summary"]', { timeout: 5000 })
  const cooperationText = await page.textContent('.coop-badge')
  if (!cooperationText?.includes('Cooperation Bonus')) throw new Error('Cooperation badge missing')
  await page.screenshot({ path: '/tmp/ss-coop-loot.png' })
  console.log('PASS: Loot summary with cooperation bonus rendered correctly.')
  await browser.close()
})()
```

---

## 5. Verification Gate

All items below MUST pass before Phase 43 is marked complete in `docs/roadmap/PROGRESS.md`.

### 5.1 TypeScript

```bash
npm run typecheck       # src/ package — zero errors
cd server && npm run typecheck   # server/ package — zero errors
```

- No `any` casts added except where existing codebase patterns require them.
- All new interfaces exported with JSDoc comments.
- `coopRoomService.ts`, `coopMineService.ts`, `coopRoleService.ts`, `coopAiScholar.ts`
  all type-check clean.

### 5.2 Build

```bash
npm run build
```

- Build succeeds with no new chunk size warnings beyond the existing 500 KB threshold
  (co-op client code must not exceed 80 KB minified gzipped).
- No circular imports introduced.

### 5.3 Server Startup

```bash
cd server && npm run dev
```

- Server starts without errors.
- `GET /health` returns 200.
- `POST /api/coop/lobby/create` returns a lobby with a `code` field.
- `GET /api/coop/lobby/code/:code` returns the room within 200 ms.

### 5.4 WebSocket Integration

```bash
# Run manually in two separate terminal sessions:
wscat -c 'ws://localhost:3001/coop/ws/<roomId>?playerId=p1'
wscat -c 'ws://localhost:3001/coop/ws/<roomId>?playerId=p2'
```

- Both sockets receive `player:connected` within 500 ms of the second connecting.
- `dive:sync` frames arrive at approximately 10 Hz on both sockets.
- Closing one socket triggers `scholar:disconnected` or `dive:ended` on the other.

### 5.5 Playwright Visual Tests

All four test scripts from Section 4 must run without throwing errors:

```bash
node /tmp/test-coop-lobby.js
node /tmp/test-coop-scholar-buff.js
node /tmp/test-coop-disconnect.js
node /tmp/test-coop-loot-summary.js
```

Screenshots reviewed:
- `ss-coop-lobby.png`: Two player cards visible, Start button enabled.
- `ss-scholar-panel.png`: Quiz question and 4 choice buttons visible.
- `ss-coop-recovery.png`: Red banner with countdown at top of screen.
- `ss-coop-loot.png`: Two columns, cooperation bonus badge present.

### 5.6 Role Mechanics

Manual verification steps:
1. Host (Miner) mines a block → Scholar receives `block:mined` WS event.
2. Scholar answers a quiz correctly → Miner's displayed O2 increases within 100 ms.
3. Scholar disconnects → Miner sees the recovery banner; after 60 s, `ai_scholar:activated`
   fires and periodic buff messages arrive.
4. Scholar reconnects within the window → Recovery banner clears; AI deactivates.

### 5.7 Loot Split Correctness

Unit-level verification (manual or Jest if available):

```
Total loot: 100 dust (Miner mined 80, Scholar's buffs credited 20)
Both active → cooperation pool = 20 dust (20%)
Each player's bonus = 10 dust
Miner total = 80 + 10 = 90
Scholar total = 20 + 10 = 30
```

Verify the above numbers by inspecting `finalizeLedger()` output in server logs with
`LOG_LEVEL=debug` set.

### 5.8 Security

- WebSocket upgrade endpoint validates `playerId` is in the room's slot list before
  accepting the connection (no unauthenticated access to room state).
- `applyMoveOnServer` ignores inputs from the Scholar slot (role guard on line 2).
- `applyScholarBuff` ignores inputs from the Miner slot (role guard).
- No user-provided strings rendered as HTML anywhere in the new components.
- Emote messages are emoji-only; the server validates `emote: true` payloads contain
  only strings from the approved emote set before broadcasting.

---

## 6. Files Affected

### New Files — Server

| File | Purpose |
|------|---------|
| `server/src/services/coopRoomService.ts` | In-memory room state, player slots, broadcast helpers, loot finalization |
| `server/src/services/coopMineService.ts` | Authoritative move/mine input processing |
| `server/src/services/coopRoleService.ts` | Scholar buff application, buff state tracking |
| `server/src/services/coopAiScholar.ts` | AI Scholar takeover on disconnect |
| `server/src/routes/coopWs.ts` | Fastify WebSocket upgrade endpoint and message dispatch |

### Modified Files — Server

| File | Change |
|------|--------|
| `server/src/routes/coop.ts` | Add code-lookup, quickmatch join/leave endpoints; import coopRoomService |
| `server/src/index.ts` | Register `@fastify/websocket` plugin, `coopWsRoutes`, stale-room pruner |

### New Files — Client

| File | Purpose |
|------|---------|
| `src/services/coopService.ts` | REST + WebSocket client facade for co-op; prediction/reconcile helpers |
| `src/ui/stores/coopState.ts` | Svelte stores: coopRole, partnerStatus, activeBuff, coopQuizQueue, inRecoveryMode |
| `src/ui/components/CoopMatchmaker.svelte` | Three-tab matchmaking UI (Host / Code / Quickmatch) |
| `src/ui/components/ScholarQuizPanel.svelte` | Scholar's quiz answer panel (pinned bottom) |
| `src/ui/components/CoopHUD.svelte` | Partner status strip + emote bar (pinned below main HUD) |
| `src/ui/components/CoopEmoteToast.svelte` | Transient emote toast over the mine |
| `src/ui/components/CoopRecoveryBanner.svelte` | Disconnect recovery countdown banner |
| `src/ui/components/CoopLootSummary.svelte` | End-of-dive loot split overlay |

### Modified Files — Client

| File | Change |
|------|--------|
| `src/ui/components/HUD.svelte` | Conditionally render CoopHUD, CoopEmoteToast, CoopRecoveryBanner when coopRole !== null |
| `src/data/analyticsEvents.ts` | Add four new co-op event types |
| `src/services/wsClient.ts` | No structural changes; co-op messages use existing WSMessageType union (extend union with co-op types) |

### New Files — Tests

| File | Purpose |
|------|---------|
| `/tmp/test-coop-lobby.js` | Playwright: lobby creation and code-join flow |
| `/tmp/test-coop-scholar-buff.js` | Playwright: Scholar quiz panel render and answer submission |
| `/tmp/test-coop-disconnect.js` | Playwright: Recovery banner countdown display |
| `/tmp/test-coop-loot-summary.js` | Playwright: Loot summary cooperation bonus rendering |

---

## 7. Design Decision References

| ID | Decision |
|----|---------|
| DD-V2-160 | Co-op dives are 2-player only (Phase 43); 4-player deferred to Phase 44. Authoritative server model chosen over peer-to-peer to prevent desync and cheating. |
| DD-V2-161 | Asymmetric roles (Miner/Scholar): Miner controls movement, Scholar answers quizzes to grant buffs. Roles are fixed at lobby creation and cannot be swapped mid-dive. Scholar incorrect answers impose a small Miner O2 penalty to maintain tension. |
| DD-V2-162 | Loot split: Miner and Scholar each keep their raw contribution. A 20% cooperation pool is formed only when both players are active (Miner mined ≥ 1 block AND Scholar answered ≥ 1 quiz). The pool is split 50/50. AI Scholar takeover disqualifies the cooperation bonus if active for > 50% of the dive. |

---

*Phase 43 estimated implementation time: 5–7 coding sessions. Prioritize 43.1 (WebSocket
server) and 43.3 (state sync) before building UI. Phases 43.2, 43.4, 43.5, 43.6, 43.7
can be parallelized across multiple Sonnet workers once the server foundation is in place.*
