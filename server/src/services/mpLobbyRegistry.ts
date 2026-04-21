/**
 * MP Lobby Registry — in-memory authoritative store for card-game multiplayer lobbies.
 *
 * This module is COMPLETELY SEPARATE from coopRoomService.ts, which is the
 * Phase-43 Miner/Scholar dig-mine system. Do not import or mix them.
 *
 * Lifecycle:
 *   createLobby   → joinLobby → attachWebSocket → ... → leaveLobby
 *   pruneStale()  runs every 60 s, TTL = 10 minutes of no activity.
 *
 * Password convention (V1):
 *   The client hashes the raw password with SHA-256 before sending. The server
 *   stores and compares the already-hashed value. Direct raw-password handling
 *   is NOT performed server-side; verifyPassword() assumes both values are
 *   SHA-256 hex digests. This is a UX gate, not a cryptographic auth boundary
 *   (documented in docs/gotchas.md and the plan's "Explicitly deferred" section).
 *
 * WebSocket handle pattern (matches coopRoomService.ts):
 *   We store a lightweight WsHandle object with send/close/readyState instead of
 *   importing 'ws' directly (no @types/ws installed in server/). The WS route
 *   injects the handle via attachWebSocket() after the upgrade.
 */

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

// ── WebSocket handle (avoids @types/ws dependency) ───────────────────────────

/**
 * Lightweight proxy over a live WebSocket connection.
 * Injected by mpLobbyWs.ts at upgrade time — avoids importing 'ws' types here.
 */
export interface WsHandle {
  /** WebSocket ready states: 0=CONNECTING 1=OPEN 2=CLOSING 3=CLOSED */
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
}

// ── Public types ─────────────────────────────────────────────────────────────

export type LobbyVisibility = 'public' | 'password' | 'friends_only'
export type MultiplayerMode = 'race' | 'same_cards' | 'duel' | 'coop' | 'trivia_night'

/**
 * A single player connection within a lobby.
 * `ws` is null until the WebSocket upgrade completes.
 */
export interface MpLobbyConnection {
  playerId: string
  displayName: string
  ws: WsHandle | null
  joinToken: string
  lastActivity: number
}

/** Full authoritative lobby state (server-only). */
export interface MpLobby {
  lobbyId: string
  /** 6-char uppercase alphanumeric, no I/O/0/1 — matches client generator. */
  lobbyCode: string
  hostId: string
  hostName: string
  mode: MultiplayerMode
  visibility: LobbyVisibility
  /**
   * SHA-256 hex digest.  Undefined when visibility !== 'password'.
   * The client sends a pre-hashed value; the server stores it as-is.
   */
  passwordHash?: string
  maxPlayers: number
  currentPlayers: number
  connections: Map<string, MpLobbyConnection>
  houseRules?: Record<string, unknown>
  contentSelection?: Record<string, unknown>
  fairnessRating?: number
  /**
   * Optional host-supplied lobby title. Already sanitized via sanitizeLobbyTitle()
   * before insertion. Max 40 chars. Absent when the host left the field blank.
   */
  title?: string
  createdAt: number
  lastActivity: number
  status: 'waiting' | 'ready' | 'starting' | 'in_game'
}

/** Options for creating a new lobby. */
export interface CreateLobbyOpts {
  hostId: string
  hostName: string
  mode: MultiplayerMode
  visibility: LobbyVisibility
  passwordHash?: string
  maxPlayers: number
  houseRules?: Record<string, unknown>
  contentSelection?: Record<string, unknown>
  fairnessRating?: number
  /** Optional host-supplied title (sanitized by caller). Max 40 chars. */
  title?: string
}

/** Shape sent back to the lobby browser — no server-only secrets. */
export interface LobbyBrowserEntry {
  lobbyId: string
  hostName: string
  mode: MultiplayerMode
  currentPlayers: number
  maxPlayers: number
  visibility: LobbyVisibility
  fairnessRating?: number
  /** Optional lobby title from host, absent when blank. */
  title?: string
  createdAt: number
  source: 'web'
}

// ── Internal state ───────────────────────────────────────────────────────────

/** In-memory lobby registry. */
const lobbies = new Map<string, MpLobby>()

/** TTL for inactive lobbies: 10 minutes. */
const STALE_TTL_MS = 10 * 60 * 1000

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a 6-character lobby code using the same no-confusion alphabet as
 * the client's `generateLobbyCode()` in multiplayerLobbyService.ts:465.
 * Alphabet excludes I, O, 0, 1 to prevent visual ambiguity.
 */
function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Hash a plaintext string with SHA-256, returning a hex digest.
 * Only used as a fallback — V1 assumes clients send pre-hashed values.
 */
export function hashPassword(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Timing-safe password comparison.
 * Both arguments are expected to be SHA-256 hex digests (64 hex chars = 32 bytes).
 * Returns true when storedHash is undefined (no password required).
 * Returns false when one is defined and the other is not.
 */
export function verifyPassword(
  storedHash: string | undefined,
  suppliedHash: string | undefined
): boolean {
  if (storedHash === undefined) return true
  if (suppliedHash === undefined) return false
  // Guard against length-mismatch attacks before timingSafeEqual.
  if (storedHash.length !== suppliedHash.length) return false
  try {
    return timingSafeEqual(
      Buffer.from(storedHash, 'hex'),
      Buffer.from(suppliedHash, 'hex')
    )
  } catch {
    // Buffer.from throws on invalid hex — treat as mismatch.
    return false
  }
}

/**
 * Generate a join token for a player.
 * UUID v4 is sufficient for V1 — prevents drive-by WS upgrades without prior REST join.
 */
function generateJoinToken(): string {
  return randomUUID()
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new lobby.
 * The host is automatically added as the first connection with a fresh joinToken.
 */
export function createLobby(opts: CreateLobbyOpts): MpLobby {
  const lobbyId = randomUUID()
  const joinToken = generateJoinToken()
  const now = Date.now()

  const hostConn: MpLobbyConnection = {
    playerId: opts.hostId,
    displayName: opts.hostName,
    ws: null,
    joinToken,
    lastActivity: now,
  }

  const lobby: MpLobby = {
    lobbyId,
    lobbyCode: generateLobbyCode(),
    hostId: opts.hostId,
    hostName: opts.hostName,
    mode: opts.mode,
    visibility: opts.visibility,
    passwordHash: opts.visibility === 'password' ? opts.passwordHash : undefined,
    maxPlayers: opts.maxPlayers,
    currentPlayers: 1,
    connections: new Map([[opts.hostId, hostConn]]),
    houseRules: opts.houseRules,
    contentSelection: opts.contentSelection,
    fairnessRating: opts.fairnessRating,
    title: opts.title,
    createdAt: now,
    lastActivity: now,
    status: 'waiting',
  }

  lobbies.set(lobbyId, lobby)
  console.info(`[mpLobbyRegistry] created lobby ${lobbyId} code=${lobby.lobbyCode} mode=${opts.mode} host=${opts.hostId}`)
  return lobby
}

/**
 * Join an existing lobby.
 * Validates capacity and password hash.
 * Returns `{ lobby, joinToken }` on success or `{ error }` on failure.
 */
export function joinLobby(
  lobbyId: string,
  playerId: string,
  displayName: string,
  passwordHash?: string
): { lobby: MpLobby; joinToken: string } | { error: string } {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return { error: 'Lobby not found' }
  if (lobby.status === 'in_game') return { error: 'Game already in progress' }
  if (lobby.currentPlayers >= lobby.maxPlayers) return { error: 'Lobby is full' }
  if (!verifyPassword(lobby.passwordHash, passwordHash)) return { error: 'Wrong password' }

  const joinToken = generateJoinToken()
  const now = Date.now()

  const conn: MpLobbyConnection = {
    playerId,
    displayName,
    ws: null,
    joinToken,
    lastActivity: now,
  }

  lobby.connections.set(playerId, conn)
  lobby.currentPlayers = lobby.connections.size
  lobby.lastActivity = now

  console.info(`[mpLobbyRegistry] player ${playerId} joined lobby ${lobbyId}`)
  return { lobby, joinToken }
}

/**
 * Case-insensitive lobby code lookup.
 * Returns null if not found; does not filter by status (caller decides).
 */
export function findLobbyByCode(code: string): MpLobby | null {
  const upper = code.toUpperCase()
  for (const lobby of lobbies.values()) {
    if (lobby.lobbyCode === upper) return lobby
  }
  return null
}

/**
 * Remove a player from a lobby.
 * Deletes the lobby entirely when the last connection leaves.
 * If the host leaves, the next connection is promoted to host.
 * Broadcasts `mp:lobby:leave` to remaining players.
 */
export function leaveLobby(lobbyId: string, playerId: string): void {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return

  const conn = lobby.connections.get(playerId)
  if (conn?.ws) {
    try { conn.ws.close() } catch { /* already closed */ }
  }
  lobby.connections.delete(playerId)
  lobby.currentPlayers = lobby.connections.size

  if (lobby.connections.size === 0) {
    lobbies.delete(lobbyId)
    console.info(`[mpLobbyRegistry] lobby ${lobbyId} disbanded (0 players)`)
    return
  }

  // Promote first remaining connection to host if the host left.
  if (lobby.hostId === playerId) {
    const [newHostConn] = lobby.connections.values()
    lobby.hostId = newHostConn.playerId
    lobby.hostName = newHostConn.displayName
    console.info(`[mpLobbyRegistry] host transferred to ${lobby.hostId} in lobby ${lobbyId}`)
  }

  lobby.lastActivity = Date.now()
  broadcast(lobbyId, { type: 'mp:lobby:leave', payload: { playerId } })
}

/** Keys that a host may patch via updateLobbySettings(). */
const ALLOWED_PATCH_KEYS: ReadonlySet<string> = new Set([
  'mode',
  'visibility',
  'passwordHash',
  'maxPlayers',
  'houseRules',
  'contentSelection',
  'status',
])

/**
 * Update lobby settings (host-only).
 * Only whitelisted keys are applied; unknown keys are silently dropped.
 * Returns true on success, false if the lobby/host are not found.
 */
export function updateLobbySettings(
  lobbyId: string,
  hostId: string,
  patch: Partial<MpLobby>
): boolean {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return false
  if (lobby.hostId !== hostId) return false

  for (const key of ALLOWED_PATCH_KEYS) {
    if (key in patch) {
      // We've whitelisted these keys — cast is intentional and contained.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lobby as any)[key] = (patch as any)[key]
    }
  }
  lobby.lastActivity = Date.now()
  return true
}

/**
 * List lobbies suitable for the public browser.
 * Excludes `friends_only` lobbies (no web-side friends graph).
 * Excludes lobbies with status `in_game`.
 */
export function listLobbies(filter?: {
  mode?: MultiplayerMode
  fullness?: 'any' | 'open'
}): MpLobby[] {
  let result: MpLobby[] = []
  for (const lobby of lobbies.values()) {
    if (lobby.visibility === 'friends_only') continue
    if (lobby.status === 'in_game') continue
    result.push(lobby)
  }

  if (filter?.mode) {
    const mode = filter.mode
    result = result.filter(l => l.mode === mode)
  }

  if (filter?.fullness === 'open') {
    result = result.filter(l => l.currentPlayers < l.maxPlayers)
  }

  return result
}

/**
 * Broadcast a JSON payload to every player with a live WebSocket in the lobby.
 * @param excludePlayerId — skip this player's socket (used for "forward from sender").
 */
export function broadcast(
  lobbyId: string,
  payload: object,
  excludePlayerId?: string
): void {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return
  const raw = JSON.stringify(payload)
  for (const conn of lobby.connections.values()) {
    if (conn.playerId === excludePlayerId) continue
    if (conn.ws?.readyState === 1) {
      try { conn.ws.send(raw) } catch (err) {
        console.warn(`[mpLobbyRegistry] broadcast send failed for ${conn.playerId}:`, err)
      }
    }
  }
}

/**
 * Send a JSON payload to a specific player in the lobby.
 */
export function sendTo(lobbyId: string, playerId: string, payload: object): void {
  const lobby = lobbies.get(lobbyId)
  if (!lobby) return
  const conn = lobby.connections.get(playerId)
  if (conn?.ws?.readyState === 1) {
    try { conn.ws.send(JSON.stringify(payload)) } catch (err) {
      console.warn(`[mpLobbyRegistry] sendTo failed for ${playerId}:`, err)
    }
  }
}

/** Get a lobby by ID. Returns undefined if not found. */
export function getLobby(lobbyId: string): MpLobby | undefined {
  return lobbies.get(lobbyId)
}

/**
 * Validate a join token for the WebSocket upgrade handshake.
 * Returns true when the token matches the stored connection record.
 */
export function validateJoinToken(
  lobbyId: string,
  playerId: string,
  token: string
): boolean {
  const conn = lobbies.get(lobbyId)?.connections.get(playerId)
  if (!conn) return false
  return conn.joinToken === token
}

/**
 * Attach a live WebSocket handle to an existing connection record.
 * Called after the WS upgrade is accepted and the token is validated.
 * Returns false if the lobby or connection no longer exists.
 */
export function attachWebSocket(
  lobbyId: string,
  playerId: string,
  ws: WsHandle
): boolean {
  const conn = lobbies.get(lobbyId)?.connections.get(playerId)
  if (!conn) return false
  conn.ws = ws
  conn.lastActivity = Date.now()
  return true
}

/**
 * Drop lobbies with no activity in the past 10 minutes.
 * Called every 60 s via the module-level setInterval below.
 */
export function pruneStale(): void {
  const cutoff = Date.now() - STALE_TTL_MS
  for (const [id, lobby] of lobbies) {
    if (lobby.lastActivity < cutoff) {
      // Close any remaining sockets before deleting.
      for (const conn of lobby.connections.values()) {
        try { conn.ws?.close() } catch { /* already closed */ }
      }
      lobbies.delete(id)
      console.info(`[mpLobbyRegistry] pruned stale lobby ${id}`)
    }
  }
}

// Run stale-lobby pruner every 60 seconds. unref() so it doesn't keep the
// process alive during tests when the registry is imported as a side-effect.
const pruneInterval = setInterval(pruneStale, 60_000)
pruneInterval.unref?.()
