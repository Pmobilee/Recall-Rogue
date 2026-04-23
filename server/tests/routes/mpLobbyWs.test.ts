/**
 * Unit tests for mpLobbyWs.ts — specifically the mp:lobby:start payload allowlist
 * introduced by MP-SWEEP-2026-04-23-H-003.
 *
 * Strategy: test `buildLobbyStartPayload` (exported pure function) directly.
 * This avoids the need for a full WebSocket server in unit tests while still
 * covering the security-critical path. The WS handler integration is covered
 * by the existing Docker E2E playtest suite.
 *
 * Key invariants tested:
 *   1. Injection attempt with extra keys is silently dropped.
 *   2. Guest-broadcast payload contains ONLY allowlisted fields.
 *   3. mode/houseRules/contentSelection in output come from server state,
 *      NOT from the inbound msg.payload even when the host supplies different values.
 *   4. seed and deckId are accepted from host payload (type-coerced).
 *   5. Non-string deckId and non-number seed are coerced to safe defaults.
 */

import { describe, it, expect } from 'vitest'
import { buildLobbyStartPayload } from '../../src/routes/mpLobbyWs.js'
import type { MpLobby } from '../../src/services/mpLobbyRegistry.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a minimal MpLobby object for testing — only fields used by buildLobbyStartPayload. */
function makeLobby(overrides?: Partial<MpLobby>): MpLobby {
  return {
    lobbyId: 'test-lobby-id',
    lobbyCode: 'TSTCOD',
    hostId: 'host-player',
    hostName: 'Host',
    mode: 'race',
    visibility: 'public',
    maxPlayers: 4,
    currentPlayers: 2,
    connections: new Map(),
    houseRules: { timeLimit: 30, penaltyCards: false },
    contentSelection: { deckId: 'biology-101', filter: 'all' },
    createdAt: Date.now(),
    lastActivity: Date.now(),
    status: 'waiting',
    ...overrides,
  } as MpLobby
}

// ── buildLobbyStartPayload — allowlist enforcement ────────────────────────────

describe('buildLobbyStartPayload — allowlist enforcement', () => {
  it('drops arbitrary injected keys from the host payload', () => {
    const lobby = makeLobby()
    const injectedPayload: Record<string, unknown> = {
      seed: 12345,
      deckId: 'legit-deck',
      // injection attempts:
      evilKey: 'pwned',
      __proto__: { polluted: true },
      adminOverride: true,
      extraMode: 'duel',
    }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, injectedPayload)

    expect(result).not.toHaveProperty('evilKey')
    expect(result).not.toHaveProperty('__proto__')
    expect(result).not.toHaveProperty('adminOverride')
    expect(result).not.toHaveProperty('extraMode')
  })

  it('output contains ONLY the allowlisted fields', () => {
    const lobby = makeLobby()
    const rawPayload: Record<string, unknown> = {
      seed: 99999,
      deckId: 'my-deck',
      injected: 'should-not-appear',
    }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    const allowedKeys = new Set(['lobbyId', 'seed', 'mode', 'houseRules', 'contentSelection', 'deckId'])
    for (const key of Object.keys(result)) {
      expect(allowedKeys.has(key)).toBe(true)
    }
  })

  it('mode comes from server lobby state, not from msg.payload', () => {
    // Server lobby says 'race'. Host tries to inject 'duel'.
    const lobby = makeLobby({ mode: 'race' })
    const rawPayload: Record<string, unknown> = {
      seed: 1,
      mode: 'duel',  // injection attempt
    }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    expect(result['mode']).toBe('race')
    // The injected 'mode' from msg.payload must NOT appear as-is.
    // (It's overwritten by server state, so the value should be 'race', not 'duel')
    expect(result['mode']).not.toBe('duel')
  })

  it('houseRules comes from server lobby state, not from msg.payload', () => {
    const serverHouseRules = { timeLimit: 30, penaltyCards: false }
    const lobby = makeLobby({ houseRules: serverHouseRules })
    const rawPayload: Record<string, unknown> = {
      seed: 1,
      houseRules: { timeLimit: 999, godMode: true },  // injection attempt
    }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    expect(result['houseRules']).toEqual(serverHouseRules)
    expect((result['houseRules'] as Record<string, unknown>)['godMode']).toBeUndefined()
  })

  it('contentSelection comes from server lobby state, not from msg.payload', () => {
    const serverContentSelection = { deckId: 'server-deck', filter: 'approved' }
    const lobby = makeLobby({ contentSelection: serverContentSelection })
    const rawPayload: Record<string, unknown> = {
      seed: 1,
      contentSelection: { deckId: 'hacked-deck', unlockAll: true },  // injection attempt
    }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    expect(result['contentSelection']).toEqual(serverContentSelection)
    expect((result['contentSelection'] as Record<string, unknown>)['unlockAll']).toBeUndefined()
  })

  it('seed is accepted from host payload as a number', () => {
    const lobby = makeLobby()
    const rawPayload: Record<string, unknown> = { seed: 987654321, deckId: 'test' }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    expect(result['seed']).toBe(987654321)
  })

  it('seed defaults to null when host omits it', () => {
    const lobby = makeLobby()
    const result = buildLobbyStartPayload('test-lobby-id', lobby, {})

    expect(result['seed']).toBeNull()
  })

  it('seed is coerced to null when host sends a non-number type', () => {
    const lobby = makeLobby()
    const rawPayload: Record<string, unknown> = { seed: 'not-a-number' }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    expect(result['seed']).toBeNull()
  })

  it('deckId is accepted from host payload as a string', () => {
    const lobby = makeLobby()
    const rawPayload: Record<string, unknown> = { seed: 1, deckId: 'biology-101' }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    expect(result['deckId']).toBe('biology-101')
  })

  it('deckId is absent from output when host omits it', () => {
    const lobby = makeLobby()
    const rawPayload: Record<string, unknown> = { seed: 1 }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    // Should not have an explicit 'deckId' key (not even undefined)
    expect(Object.prototype.hasOwnProperty.call(result, 'deckId')).toBe(false)
  })

  it('deckId is coerced to absent when host sends a non-string type', () => {
    const lobby = makeLobby()
    const rawPayload: Record<string, unknown> = { seed: 1, deckId: { evil: 'object' } }
    const result = buildLobbyStartPayload('test-lobby-id', lobby, rawPayload)

    expect(Object.prototype.hasOwnProperty.call(result, 'deckId')).toBe(false)
  })

  it('lobbyId in output is from the handler scope, not from host payload', () => {
    const lobby = makeLobby({ lobbyId: 'server-lobby-id' })
    const rawPayload: Record<string, unknown> = {
      seed: 1,
      lobbyId: 'injected-lobby-id',  // injection attempt
    }
    // The lobbyId argument is from handler scope (the validated WS query param)
    const result = buildLobbyStartPayload('handler-scope-lobby-id', lobby, rawPayload)

    expect(result['lobbyId']).toBe('handler-scope-lobby-id')
    expect(result['lobbyId']).not.toBe('injected-lobby-id')
  })

  it('handles undefined lobby gracefully (null fields)', () => {
    const result = buildLobbyStartPayload('test-lobby-id', undefined, { seed: 1 })

    expect(result['mode']).toBeNull()
    expect(result['houseRules']).toBeNull()
    expect(result['contentSelection']).toBeNull()
    expect(result['seed']).toBe(1)
  })

  it('handles undefined rawPayload gracefully', () => {
    const lobby = makeLobby()
    const result = buildLobbyStartPayload('test-lobby-id', lobby, undefined)

    expect(result['seed']).toBeNull()
    expect(result['mode']).toBe('race')
    expect(Object.prototype.hasOwnProperty.call(result, 'deckId')).toBe(false)
  })

  it('lobby with no houseRules produces null in output (not undefined)', () => {
    const lobby = makeLobby({ houseRules: undefined })
    const result = buildLobbyStartPayload('test-lobby-id', lobby, { seed: 1 })

    // null is explicit; undefined would be stripped by JSON.stringify
    expect(result['houseRules']).toBeNull()
  })

  it('lobby with no contentSelection produces null in output (not undefined)', () => {
    const lobby = makeLobby({ contentSelection: undefined })
    const result = buildLobbyStartPayload('test-lobby-id', lobby, { seed: 1 })

    expect(result['contentSelection']).toBeNull()
  })
})
