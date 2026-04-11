/**
 * Unit tests for curatedDeckStore.ts — focused on rowToDeckShell().
 *
 * These tests verify that the sub_decks SQL column is correctly parsed and
 * propagated to CuratedDeck.subDecks. This closes the bug where sub_decks was
 * present in curated.db but never read, causing every deck's subDecks to be
 * undefined at runtime. See docs/gotchas.md 2026-04-11 entry.
 */

import { describe, it, expect } from 'vitest';
import { rowToDeckShell } from './curatedDeckStore';

// ---------------------------------------------------------------------------
// Helpers — minimal valid deck row
// ---------------------------------------------------------------------------

/** Returns a minimal row shaped like what queryAll('SELECT * FROM decks') returns. */
function validDeckRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test_deck',
    name: 'Test Deck',
    description: 'A test deck',
    domain: 'history',
    sub_domain: null,
    minimum_facts: 10,
    target_facts: 100,
    chain_themes: '[]',
    sub_decks: null,
    question_templates: '[]',
    difficulty_tiers: '[]',
    metadata: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// rowToDeckShell — sub_decks parsing
// ---------------------------------------------------------------------------

describe('rowToDeckShell', () => {
  describe('sub_decks parsing', () => {
    it('parses a valid sub_decks JSON array into subDecks', () => {
      const row = validDeckRow({
        sub_decks: '[{"id":"a","name":"A","factIds":["f1","f2"]}]',
      });
      const shell = rowToDeckShell(row);
      expect(shell.subDecks).toBeDefined();
      expect(shell.subDecks).toHaveLength(1);
      expect(shell.subDecks![0].name).toBe('A');
      expect(shell.subDecks![0].id).toBe('a');
      expect(shell.subDecks![0].factIds).toEqual(['f1', 'f2']);
    });

    it('returns subDecks === undefined when sub_decks column is null', () => {
      const row = validDeckRow({ sub_decks: null });
      const shell = rowToDeckShell(row);
      // Must be undefined (not []) so downstream !!deck.subDecks detection works.
      expect(shell.subDecks).toBeUndefined();
    });

    it('returns subDecks === undefined when sub_decks column is absent from row', () => {
      const row = validDeckRow();
      // sub_decks: null is in validDeckRow by default — explicitly delete it
      delete row['sub_decks'];
      const shell = rowToDeckShell(row);
      expect(shell.subDecks).toBeUndefined();
    });

    it('parses multiple sub-decks with optional chainThemeId (chainThemeId-only variant)', () => {
      const row = validDeckRow({
        sub_decks: JSON.stringify([
          { id: 'theme_0', name: 'Athenian Period', chainThemeId: 0 },
          { id: 'theme_1', name: 'Spartan Period', chainThemeId: 1 },
        ]),
      });
      const shell = rowToDeckShell(row);
      expect(shell.subDecks).toHaveLength(2);
      expect(shell.subDecks![0].chainThemeId).toBe(0);
      expect(shell.subDecks![1].name).toBe('Spartan Period');
      // chainThemeId-only variant has no factIds
      expect(shell.subDecks![0].factIds).toBeUndefined();
    });

    it('throws on malformed (non-parseable) sub_decks JSON', () => {
      const row = validDeckRow({ sub_decks: 'NOT_VALID_JSON[{' });
      // Malformed JSON means a content pipeline bug; throw and let the caller's
      // try/catch in initializeCuratedDecks skip the deck.
      expect(() => rowToDeckShell(row)).toThrow();
    });
  });

  describe('core fields are still mapped correctly', () => {
    it('maps all scalar deck fields', () => {
      const row = validDeckRow({
        id: 'ap_biology',
        name: 'AP Biology',
        description: 'College Board AP Biology',
        domain: 'science',
        sub_domain: 'biology',
        minimum_facts: 50,
        target_facts: 500,
      });
      const shell = rowToDeckShell(row);
      expect(shell.id).toBe('ap_biology');
      expect(shell.name).toBe('AP Biology');
      expect(shell.domain).toBe('science');
      expect(shell.subDomain).toBe('biology');
      expect(shell.minimumFacts).toBe(50);
      expect(shell.targetFacts).toBe(500);
    });

    it('maps optional sub_domain to undefined when null', () => {
      const row = validDeckRow({ sub_domain: null });
      const shell = rowToDeckShell(row);
      expect(shell.subDomain).toBeUndefined();
    });
  });
});
