/**
 * lobbyStartGate.test.ts
 *
 * Unit tests for canStartLobby and startButtonLabel pure predicates.
 * These helpers gate the "Start Game" button in MultiplayerLobby.svelte.
 *
 * Issue 1 fix: Start Game must be blocked when lobby.contentSelection is null/undefined,
 * even when all players are ready and the player count threshold is met.
 */

import { describe, it, expect } from 'vitest'
import { canStartLobby, startButtonLabel } from './lobbyStartGate'
import type { LobbyPlayer, LobbyContentSelection } from '../../data/multiplayerTypes'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReadyPlayer(id: string, isHost = false): LobbyPlayer {
  return { id, displayName: id, isHost, isReady: true }
}

function makeUnreadyPlayer(id: string): LobbyPlayer {
  return { id, displayName: id, isHost: false, isReady: false }
}

const STUDY_SELECTION: LobbyContentSelection = {
  type: 'study',
  deckId: 'world_war_ii',
  deckName: 'World War II',
}

// ---------------------------------------------------------------------------
// canStartLobby
// ---------------------------------------------------------------------------

describe('canStartLobby — all gates must pass', () => {
  it('returns false when amHost is false', () => {
    const lobby = {
      players: [makeReadyPlayer('a'), makeReadyPlayer('b')],
      contentSelection: STUDY_SELECTION,
    }
    expect(canStartLobby(lobby, false)).toBe(false)
  })

  it('returns false when fewer than 2 players', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true)],
      contentSelection: STUDY_SELECTION,
    }
    expect(canStartLobby(lobby, true)).toBe(false)
  })

  it('returns false when exactly 2 players but one is not ready', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true), makeUnreadyPlayer('guest')],
      contentSelection: STUDY_SELECTION,
    }
    expect(canStartLobby(lobby, true)).toBe(false)
  })

  it('returns false when all players are ready but contentSelection is undefined (Issue 1)', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true), makeReadyPlayer('guest')],
      contentSelection: undefined,
    }
    expect(canStartLobby(lobby, true)).toBe(false)
  })

  it('returns false when all players are ready but contentSelection is null (Issue 1)', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true), makeReadyPlayer('guest')],
      contentSelection: null as unknown as undefined,
    }
    expect(canStartLobby(lobby, true)).toBe(false)
  })

  it('returns true when host, 2+ ready players, and contentSelection is set', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true), makeReadyPlayer('guest')],
      contentSelection: STUDY_SELECTION,
    }
    expect(canStartLobby(lobby, true)).toBe(true)
  })

  it('returns true with trivia contentSelection', () => {
    const lobby = {
      players: [makeReadyPlayer('a', true), makeReadyPlayer('b'), makeReadyPlayer('c')],
      contentSelection: { type: 'trivia' as const, domains: ['history', 'science'] },
    }
    expect(canStartLobby(lobby, true)).toBe(true)
  })

  it('returns true with custom_deck contentSelection', () => {
    const lobby = {
      players: [makeReadyPlayer('a', true), makeReadyPlayer('b')],
      contentSelection: { type: 'custom_deck' as const, customDeckId: 'my_deck', deckName: 'My Deck' },
    }
    expect(canStartLobby(lobby, true)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// startButtonLabel — three-state ternary
// ---------------------------------------------------------------------------

describe('startButtonLabel — three-state label', () => {
  it('returns "Choose Content First" when no contentSelection is set (Issue 1)', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true), makeReadyPlayer('guest')],
      contentSelection: undefined,
    }
    expect(startButtonLabel(lobby, true)).toBe('Choose Content First')
  })

  it('returns "Waiting for players..." when content is set but not all ready', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true), makeUnreadyPlayer('guest')],
      contentSelection: STUDY_SELECTION,
    }
    expect(startButtonLabel(lobby, true)).toBe('Waiting for players...')
  })

  it('returns "Start Game" when host, all ready, and content selected', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true), makeReadyPlayer('guest')],
      contentSelection: STUDY_SELECTION,
    }
    expect(startButtonLabel(lobby, true)).toBe('Start Game')
  })

  it('returns "Waiting for host..." when amHost is false', () => {
    const lobby = {
      players: [makeReadyPlayer('host', true), makeReadyPlayer('guest')],
      contentSelection: STUDY_SELECTION,
    }
    expect(startButtonLabel(lobby, false)).toBe('Waiting for host...')
  })
})

// ---------------------------------------------------------------------------
// #71 — workshopDecksReady gate
// ---------------------------------------------------------------------------

describe('#71: canStartLobby — workshopDecksReady gate', () => {
  const readyLobby = {
    players: [makeReadyPlayer('host', true), makeReadyPlayer('guest')],
    contentSelection: STUDY_SELECTION,
  }

  it('returns false when workshopDecksReady is false (Workshop deck not yet available)', () => {
    expect(canStartLobby(readyLobby, true, false)).toBe(false)
  })

  it('returns true when workshopDecksReady is true (explicit)', () => {
    expect(canStartLobby(readyLobby, true, true)).toBe(true)
  })

  it('defaults workshopDecksReady to true — existing callers without the param are unaffected', () => {
    // canStartLobby(lobby, amHost) — no third arg — should still return true
    expect(canStartLobby(readyLobby, true)).toBe(true)
  })
})

describe('#71: startButtonLabel — workshopDecksReady label', () => {
  const readyLobby = {
    players: [makeReadyPlayer('host', true), makeReadyPlayer('guest')],
    contentSelection: STUDY_SELECTION,
  }

  it('returns "Waiting for Workshop deck..." when workshopDecksReady is false', () => {
    expect(startButtonLabel(readyLobby, true, false)).toBe('Waiting for Workshop deck...')
  })

  it('returns "Start Game" when workshopDecksReady is true', () => {
    expect(startButtonLabel(readyLobby, true, true)).toBe('Start Game')
  })

  it('defaults to "Start Game" when third arg omitted (backward-compat)', () => {
    expect(startButtonLabel(readyLobby, true)).toBe('Start Game')
  })
})
