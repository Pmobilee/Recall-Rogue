/**
 * lobbyDeckSelection.test.ts
 *
 * Tests for the multi-deck lobby picker helper functions (Issue 2, 2026-04-11).
 */

import { describe, it, expect } from 'vitest'
import {
  toggleWholeDeck,
  toggleSubDeck,
  deckCheckState,
  isSubDeckSelected,
  buildStudyMultiSelection,
  describeSelection,
  pickerSummary,
  type DeckSelectionMap,
} from './lobbyDeckSelection'
import type { DeckRegistryEntry } from '../../data/deckRegistry'
import type { LobbyContentSelection } from '../../data/multiplayerTypes'

// ── Fixture helpers ─────────────────────────────────────────────────────────

function makeDeck(id: string, name: string, subIds: string[]): DeckRegistryEntry {
  return {
    id,
    name,
    description: '',
    domain: 'geography',
    factCount: subIds.length * 10,
    subDecks: subIds.map(sid => ({ id: sid, name: sid, factCount: 10 })),
    tier: 1,
    status: 'available',
    artPlaceholder: { gradientFrom: '#000', gradientTo: '#fff', icon: '🌍' },
  }
}

// ── toggleWholeDeck ─────────────────────────────────────────────────────────

describe('toggleWholeDeck', () => {
  it('selects a deck as all when not previously selected', () => {
    const map: DeckSelectionMap = new Map()
    const result = toggleWholeDeck(map, 'geo')
    expect(result.get('geo')).toBe('all')
  })

  it('deselects a deck that is already all-selected', () => {
    const map: DeckSelectionMap = new Map([['geo', 'all']])
    const result = toggleWholeDeck(map, 'geo')
    expect(result.has('geo')).toBe(false)
  })

  it('replaces partial selection with all', () => {
    const map: DeckSelectionMap = new Map([['geo', new Set(['sub1'])]])
    const result = toggleWholeDeck(map, 'geo')
    expect(result.get('geo')).toBe('all')
  })

  it('returns a new Map (does not mutate original)', () => {
    const map: DeckSelectionMap = new Map()
    const result = toggleWholeDeck(map, 'geo')
    expect(result).not.toBe(map)
    expect(map.has('geo')).toBe(false)
  })
})

// ── toggleSubDeck ───────────────────────────────────────────────────────────

describe('toggleSubDeck', () => {
  const ALL_SUBS = ['sub1', 'sub2', 'sub3']

  it('adds a subdeck to an empty deck (creates partial set)', () => {
    const map: DeckSelectionMap = new Map()
    const result = toggleSubDeck(map, 'geo', 'sub1', ALL_SUBS)
    const val = result.get('geo')
    expect(val instanceof Set).toBe(true)
    expect((val as Set<string>).has('sub1')).toBe(true)
  })

  it('removes a subdeck from a partial set', () => {
    const map: DeckSelectionMap = new Map([['geo', new Set(['sub1', 'sub2'])]])
    const result = toggleSubDeck(map, 'geo', 'sub1', ALL_SUBS)
    const val = result.get('geo')
    expect(val instanceof Set).toBe(true)
    expect((val as Set<string>).has('sub1')).toBe(false)
    expect((val as Set<string>).has('sub2')).toBe(true)
  })

  it('removes deck entry when the last subdeck is deselected', () => {
    const map: DeckSelectionMap = new Map([['geo', new Set(['sub1'])]])
    const result = toggleSubDeck(map, 'geo', 'sub1', ALL_SUBS)
    expect(result.has('geo')).toBe(false)
  })

  it('converts all to partial when one subdeck is deselected', () => {
    const map: DeckSelectionMap = new Map([['geo', 'all']])
    const result = toggleSubDeck(map, 'geo', 'sub1', ALL_SUBS)
    const val = result.get('geo')
    expect(val instanceof Set).toBe(true)
    expect((val as Set<string>).has('sub1')).toBe(false)
    expect((val as Set<string>).has('sub2')).toBe(true)
    expect((val as Set<string>).has('sub3')).toBe(true)
  })

  it('removes deck when last subdeck deselected from all (single subdeck case)', () => {
    const map: DeckSelectionMap = new Map([['geo', 'all']])
    const result = toggleSubDeck(map, 'geo', 'sub1', ['sub1'])
    expect(result.has('geo')).toBe(false)
  })

  it('returns a new Map (does not mutate original)', () => {
    const map: DeckSelectionMap = new Map()
    const result = toggleSubDeck(map, 'geo', 'sub1', ALL_SUBS)
    expect(result).not.toBe(map)
  })
})

// ── deckCheckState ──────────────────────────────────────────────────────────

describe('deckCheckState', () => {
  it('returns none when deck not in map', () => {
    const map: DeckSelectionMap = new Map()
    expect(deckCheckState(map, 'geo')).toBe('none')
  })

  it('returns all when deck is all-selected', () => {
    const map: DeckSelectionMap = new Map([['geo', 'all']])
    expect(deckCheckState(map, 'geo')).toBe('all')
  })

  it('returns partial when deck has a partial set', () => {
    const map: DeckSelectionMap = new Map([['geo', new Set(['sub1'])]])
    expect(deckCheckState(map, 'geo')).toBe('partial')
  })
})

// ── isSubDeckSelected ───────────────────────────────────────────────────────

describe('isSubDeckSelected', () => {
  it('returns false when deck not selected at all', () => {
    const map: DeckSelectionMap = new Map()
    expect(isSubDeckSelected(map, 'geo', 'sub1')).toBe(false)
  })

  it('returns true when deck is all-selected (implies all subdecks)', () => {
    const map: DeckSelectionMap = new Map([['geo', 'all']])
    expect(isSubDeckSelected(map, 'geo', 'sub1')).toBe(true)
  })

  it('returns true when specific subdeck is in the partial set', () => {
    const map: DeckSelectionMap = new Map([['geo', new Set(['sub1'])]])
    expect(isSubDeckSelected(map, 'geo', 'sub1')).toBe(true)
    expect(isSubDeckSelected(map, 'geo', 'sub2')).toBe(false)
  })
})

// ── buildStudyMultiSelection ────────────────────────────────────────────────

describe('buildStudyMultiSelection', () => {
  const decks = [
    makeDeck('geo', 'Geography', ['sub1', 'sub2']),
    makeDeck('hist', 'History', ['hsub1']),
  ]

  it('builds a valid study-multi selection from whole decks', () => {
    const map: DeckSelectionMap = new Map([
      ['geo', 'all'],
      ['hist', 'all'],
    ])
    const domains: Set<string> = new Set(['science'])
    const result = buildStudyMultiSelection(map, domains, decks)

    expect(result.type).toBe('study-multi')
    expect(result.decks).toHaveLength(2)
    expect(result.decks.find(d => d.deckId === 'geo')?.subDeckIds).toBe('all')
    expect(result.decks.find(d => d.deckId === 'hist')?.subDeckIds).toBe('all')
    expect(result.triviaDomains).toEqual(['science'])
  })

  it('includes partial subdeck selection', () => {
    const map: DeckSelectionMap = new Map([['geo', new Set(['sub1'])]])
    const result = buildStudyMultiSelection(map, new Set(), decks)

    expect(result.decks[0].subDeckIds).toEqual(['sub1'])
  })

  it('resolves deckName from registry', () => {
    const map: DeckSelectionMap = new Map([['geo', 'all']])
    const result = buildStudyMultiSelection(map, new Set(), decks)
    expect(result.decks[0].deckName).toBe('Geography')
  })

  it('falls back to deckId when deck not found in registry', () => {
    const map: DeckSelectionMap = new Map([['unknown_deck', 'all']])
    const result = buildStudyMultiSelection(map, new Set(), decks)
    expect(result.decks[0].deckName).toBe('unknown_deck')
  })

  it('preserves tab switch: selection built correctly regardless of active tab', () => {
    // Simulate: user picked geo on geography tab, switched to trivia tab,
    // picked 2 domains, then confirmed — geo selection must still be present
    const map: DeckSelectionMap = new Map([['geo', 'all']])
    const domains: Set<string> = new Set(['science', 'history'])
    const result = buildStudyMultiSelection(map, domains, decks)
    expect(result.decks).toHaveLength(1)
    expect(result.triviaDomains).toHaveLength(2)
  })
})

// ── describeSelection ───────────────────────────────────────────────────────

describe('describeSelection', () => {
  it('describes study-multi with decks and domains', () => {
    const cs: LobbyContentSelection = {
      type: 'study-multi',
      decks: [
        { deckId: 'geo', deckName: 'Geography', subDeckIds: 'all' },
        { deckId: 'hist', deckName: 'History', subDeckIds: ['hsub1'] },
      ],
      triviaDomains: ['science', 'math'],
    }
    expect(describeSelection(cs)).toBe('2 decks + 2 trivia domains')
  })

  it('describes study-multi with only decks', () => {
    const cs: LobbyContentSelection = {
      type: 'study-multi',
      decks: [{ deckId: 'geo', deckName: 'Geography', subDeckIds: 'all' }],
      triviaDomains: [],
    }
    expect(describeSelection(cs)).toBe('1 deck')
  })

  it('describes study-multi with only trivia domains', () => {
    const cs: LobbyContentSelection = {
      type: 'study-multi',
      decks: [],
      triviaDomains: ['science'],
    }
    expect(describeSelection(cs)).toBe('1 trivia domain')
  })

  it('describes legacy study variant', () => {
    const cs: LobbyContentSelection = {
      type: 'study',
      deckId: 'geo',
      deckName: 'Geography',
    }
    expect(describeSelection(cs)).toBe('Geography')
  })

  it('describes legacy trivia variant', () => {
    const cs: LobbyContentSelection = {
      type: 'trivia',
      domains: ['science', 'history'],
    }
    expect(describeSelection(cs)).toBe('2 trivia domains')
  })
})

// ── pickerSummary ───────────────────────────────────────────────────────────

describe('pickerSummary', () => {
  it('returns nothing selected when all empty', () => {
    expect(pickerSummary(new Map(), new Set(), new Set())).toBe('Nothing selected')
  })

  it('formats decks + domains together', () => {
    const decks: DeckSelectionMap = new Map([['geo', 'all'], ['hist', 'all']])
    const domains: Set<string> = new Set(['science'])
    expect(pickerSummary(decks, domains, new Set())).toBe('2 decks, 1 trivia domain')
  })

  it('formats custom decks', () => {
    expect(pickerSummary(new Map(), new Set(), new Set(['cd1', 'cd2']))).toBe('2 custom decks')
  })
})
