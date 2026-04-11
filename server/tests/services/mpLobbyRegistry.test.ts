/**
 * Unit tests for mpLobbyRegistry.ts
 *
 * Tests cover: create, join, leave, list, prune, password verify,
 * code generation, token validation, and WebSocket attachment.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  createLobby,
  joinLobby,
  leaveLobby,
  findLobbyByCode,
  listLobbies,
  getLobby,
  validateJoinToken,
  attachWebSocket,
  pruneStale,
  verifyPassword,
  hashPassword,
  type CreateLobbyOpts,
  type MultiplayerMode,
  type LobbyVisibility,
} from '../../src/services/mpLobbyRegistry.js'
import type { WsHandle } from '../../src/services/mpLobbyRegistry.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOpts(overrides: Partial<CreateLobbyOpts> = {}): CreateLobbyOpts {
  return {
    hostId: 'host-1',
    hostName: 'Alice',
    mode: 'race',
    visibility: 'public',
    maxPlayers: 4,
    ...overrides,
  }
}

/** A minimal fake WebSocket that records send calls. */
function makeFakeWs(readyState = 1): WsHandle {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as WsHandle
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createLobby', () => {
  it('returns a lobby with the correct host and mode', () => {
    const lobby = createLobby(makeOpts())
    expect(lobby.hostId).toBe('host-1')
    expect(lobby.hostName).toBe('Alice')
    expect(lobby.mode).toBe('race')
    expect(lobby.currentPlayers).toBe(1)
    expect(lobby.status).toBe('waiting')
  })

  it('generates a unique lobbyId and a 6-char lobbyCode', () => {
    const a = createLobby(makeOpts())
    const b = createLobby(makeOpts())
    expect(a.lobbyId).not.toBe(b.lobbyId)
    expect(a.lobbyCode).toHaveLength(6)
  })

  it('stores host as a connection with a joinToken', () => {
    const lobby = createLobby(makeOpts())
    const conn = lobby.connections.get('host-1')
    expect(conn).toBeDefined()
    expect(conn!.joinToken).toBeTruthy()
    expect(conn!.playerId).toBe('host-1')
  })

  it('sets passwordHash only when visibility is "password"', () => {
    const pub = createLobby(makeOpts({ visibility: 'public', passwordHash: 'abc123' }))
    expect(pub.passwordHash).toBeUndefined()

    const pw = createLobby(makeOpts({ visibility: 'password', passwordHash: 'abc123' }))
    expect(pw.passwordHash).toBe('abc123')
  })
})

describe('getLobby roundtrip', () => {
  it('retrieves the lobby that was just created', () => {
    const lobby = createLobby(makeOpts())
    expect(getLobby(lobby.lobbyId)).toBe(lobby)
  })

  it('returns undefined for an unknown id', () => {
    expect(getLobby('not-a-real-id')).toBeUndefined()
  })
})

describe('joinLobby', () => {
  it('succeeds for a public lobby and issues a joinToken', () => {
    const lobby = createLobby(makeOpts())
    const result = joinLobby(lobby.lobbyId, 'player-2', 'Bob')
    expect('error' in result).toBe(false)
    if ('error' in result) throw new Error('unexpected error')
    expect(result.joinToken).toBeTruthy()
    expect(result.lobby.currentPlayers).toBe(2)
  })

  it('rejects a wrong password', () => {
    const stored = hashPassword('secret')
    const lobby = createLobby(makeOpts({ visibility: 'password', passwordHash: stored }))
    const result = joinLobby(lobby.lobbyId, 'player-2', 'Bob', hashPassword('wrong'))
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toBe('Wrong password')
  })

  it('accepts the correct password hash', () => {
    const stored = hashPassword('secret')
    const lobby = createLobby(makeOpts({ visibility: 'password', passwordHash: stored }))
    const result = joinLobby(lobby.lobbyId, 'player-2', 'Bob', hashPassword('secret'))
    expect('error' in result).toBe(false)
  })

  it('rejects when the lobby is full', () => {
    const lobby = createLobby(makeOpts({ maxPlayers: 2 }))
    joinLobby(lobby.lobbyId, 'player-2', 'Bob')
    const result = joinLobby(lobby.lobbyId, 'player-3', 'Carol')
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toBe('Lobby is full')
  })

  it('returns error for a non-existent lobby', () => {
    const result = joinLobby('fake-lobby', 'player-2', 'Bob')
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toBe('Lobby not found')
  })
})

describe('leaveLobby', () => {
  it('removes the connection from the lobby', () => {
    const lobby = createLobby(makeOpts())
    joinLobby(lobby.lobbyId, 'player-2', 'Bob')
    leaveLobby(lobby.lobbyId, 'player-2')
    expect(lobby.connections.has('player-2')).toBe(false)
    expect(lobby.currentPlayers).toBe(1)
  })

  it('deletes the lobby when the last player leaves', () => {
    const lobby = createLobby(makeOpts())
    const id = lobby.lobbyId
    leaveLobby(id, 'host-1')
    expect(getLobby(id)).toBeUndefined()
  })

  it('promotes a new host when the host leaves a multi-player lobby', () => {
    const lobby = createLobby(makeOpts())
    joinLobby(lobby.lobbyId, 'player-2', 'Bob')
    leaveLobby(lobby.lobbyId, 'host-1')
    const updated = getLobby(lobby.lobbyId)
    expect(updated?.hostId).toBe('player-2')
  })
})

describe('findLobbyByCode', () => {
  it('finds a lobby by its code (case-insensitive)', () => {
    const lobby = createLobby(makeOpts())
    const found = findLobbyByCode(lobby.lobbyCode.toLowerCase())
    expect(found?.lobbyId).toBe(lobby.lobbyId)
  })

  it('returns null for an unknown code', () => {
    expect(findLobbyByCode('ZZZZZZ')).toBeNull()
  })
})

describe('listLobbies', () => {
  it('excludes friends_only lobbies', () => {
    createLobby(makeOpts({ visibility: 'friends_only' }))
    const list = listLobbies()
    expect(list.every(l => l.visibility !== 'friends_only')).toBe(true)
  })

  it('filters by mode', () => {
    createLobby(makeOpts({ mode: 'race' }))
    createLobby(makeOpts({ mode: 'duel', maxPlayers: 2 }))
    const list = listLobbies({ mode: 'race' })
    expect(list.every(l => l.mode === 'race')).toBe(true)
  })

  it('filters open lobbies when fullness is "open"', () => {
    const full = createLobby(makeOpts({ maxPlayers: 2 }))
    joinLobby(full.lobbyId, 'player-2', 'Bob')   // now full
    const open = createLobby(makeOpts({ maxPlayers: 4 }))

    const list = listLobbies({ fullness: 'open' })
    expect(list.some(l => l.lobbyId === full.lobbyId)).toBe(false)
    expect(list.some(l => l.lobbyId === open.lobbyId)).toBe(true)
  })
})

describe('validateJoinToken', () => {
  it('returns true for a valid token', () => {
    const lobby = createLobby(makeOpts())
    const conn = lobby.connections.get('host-1')!
    expect(validateJoinToken(lobby.lobbyId, 'host-1', conn.joinToken)).toBe(true)
  })

  it('returns false for a wrong token', () => {
    const lobby = createLobby(makeOpts())
    expect(validateJoinToken(lobby.lobbyId, 'host-1', 'bad-token')).toBe(false)
  })

  it('returns false for an unknown lobby', () => {
    expect(validateJoinToken('fake', 'host-1', 'any')).toBe(false)
  })
})

describe('attachWebSocket', () => {
  it('attaches the ws to an existing connection', () => {
    const lobby = createLobby(makeOpts())
    const fakeWs = makeFakeWs()
    const ok = attachWebSocket(lobby.lobbyId, 'host-1', fakeWs)
    expect(ok).toBe(true)
    expect(lobby.connections.get('host-1')!.ws).toBe(fakeWs)
  })

  it('returns false for an unknown lobby', () => {
    const fakeWs = makeFakeWs()
    expect(attachWebSocket('fake-lobby', 'host-1', fakeWs)).toBe(false)
  })
})

describe('pruneStale', () => {
  it('drops lobbies whose lastActivity is beyond the TTL', () => {
    const lobby = createLobby(makeOpts())
    const id = lobby.lobbyId
    // Force lastActivity into the past (11 minutes ago).
    lobby.lastActivity = Date.now() - 11 * 60 * 1000
    pruneStale()
    expect(getLobby(id)).toBeUndefined()
  })

  it('keeps lobbies with recent activity', () => {
    const lobby = createLobby(makeOpts())
    const id = lobby.lobbyId
    pruneStale()
    expect(getLobby(id)).toBeDefined()
  })
})

describe('verifyPassword', () => {
  it('returns true when storedHash is undefined (no password required)', () => {
    expect(verifyPassword(undefined, undefined)).toBe(true)
    expect(verifyPassword(undefined, 'anything')).toBe(true)
  })

  it('returns false when stored exists but supplied is undefined', () => {
    const h = hashPassword('test')
    expect(verifyPassword(h, undefined)).toBe(false)
  })

  it('returns true for matching hashes', () => {
    const h = hashPassword('hello')
    expect(verifyPassword(h, h)).toBe(true)
  })

  it('returns false for non-matching hashes (timing-safe)', () => {
    const a = hashPassword('hello')
    const b = hashPassword('world')
    expect(verifyPassword(a, b)).toBe(false)
  })

  it('returns false on length mismatch (no exception)', () => {
    // Hex digests always 64 chars, but guard against invalid input.
    expect(verifyPassword('abc', 'abcdef')).toBe(false)
  })
})

describe('generateLobbyCode (via createLobby)', () => {
  const ALLOWED = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))
  const FORBIDDEN = new Set('IO01'.split(''))

  it('produces only allowed characters', () => {
    for (let i = 0; i < 20; i++) {
      const lobby = createLobby(makeOpts())
      for (const ch of lobby.lobbyCode) {
        expect(ALLOWED.has(ch)).toBe(true)
      }
    }
  })

  it('never includes I, O, 0, or 1', () => {
    for (let i = 0; i < 20; i++) {
      const lobby = createLobby(makeOpts())
      for (const ch of lobby.lobbyCode) {
        expect(FORBIDDEN.has(ch)).toBe(false)
      }
    }
  })

  it('produces 6-character codes', () => {
    for (let i = 0; i < 10; i++) {
      const lobby = createLobby(makeOpts())
      expect(lobby.lobbyCode).toHaveLength(6)
    }
  })
})

// Suppress unused-variable linter complaints on type-only imports.
const _modes: MultiplayerMode[] = ['race', 'same_cards', 'duel', 'coop', 'trivia_night']
const _vis: LobbyVisibility[] = ['public', 'password', 'friends_only']
void _modes
void _vis
