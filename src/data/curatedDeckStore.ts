/**
 * Runtime store for loaded curated decks.
 * Separate from the trivia facts DB — curated decks are loaded from
 * /data/decks/*.json at startup via initializeCuratedDecks().
 */

import type { CuratedDeck, DeckFact, AnswerTypePool, SynonymGroup } from './curatedDeckTypes';
import { registerDeck } from './deckRegistry';
import { registerDeckFacts, getSubDeckFactIds } from './deckFactIndex';
import type { DeckRegistryEntry } from './deckRegistry';
import type { CanonicalFactDomain } from './card-types';

/** In-memory store of fully loaded curated decks. */
const loadedDecks: Map<string, CuratedDeck> = new Map();

/** Get a loaded deck by ID. Returns undefined if not yet loaded. */
export function getCuratedDeck(deckId: string): CuratedDeck | undefined {
  return loadedDecks.get(deckId);
}

/** Get a specific fact from a loaded deck by fact ID. */
export function getCuratedDeckFact(deckId: string, factId: string): DeckFact | undefined {
  return loadedDecks.get(deckId)?.facts.find(f => f.id === factId);
}

/**
 * Get all facts for a deck.
 * If subDeckId is provided, filters to only facts belonging to that sub-deck.
 */
export function getCuratedDeckFacts(deckId: string, subDeckId?: string): DeckFact[] {
  const deck = loadedDecks.get(deckId);
  if (!deck) return [];
  if (!subDeckId) return deck.facts;
  const subDeckFactIds = new Set(getSubDeckFactIds(deckId, subDeckId));
  return deck.facts.filter(f => subDeckFactIds.has(f.id));
}

/** Get the answer type pool for a pool ID within a deck. */
export function getAnswerTypePool(deckId: string, poolId: string): AnswerTypePool | undefined {
  return loadedDecks.get(deckId)?.answerTypePools.find(p => p.id === poolId);
}

/** Get all synonym groups for a deck. */
export function getSynonymGroups(deckId: string): SynonymGroup[] {
  return loadedDecks.get(deckId)?.synonymGroups ?? [];
}

/** Check if a deck has been loaded into the store. */
export function isCuratedDeckLoaded(deckId: string): boolean {
  return loadedDecks.has(deckId);
}

/** Get all loaded decks as an array. */
export function getAllLoadedDecks(): CuratedDeck[] {
  return Array.from(loadedDecks.values());
}

/**
 * Load a CuratedDeck into the store, register it in the deck registry,
 * and register its fact IDs in the fact index.
 */
function loadDeck(deck: CuratedDeck): void {
  loadedDecks.set(deck.id, deck);

  // Build sub-deck fact mappings if the deck JSON contains sub-deck info.
  // Sub-decks are detected by examining the registry entry's subDecks array
  // when present in the deck JSON itself (non-standard extension).
  const deckWithSubDecks = deck as CuratedDeck & {
    subDecks?: Array<{ id: string; name: string; factIds: string[] }>;
  };

  const subDecksRecord: Record<string, string[]> = {};
  if (deckWithSubDecks.subDecks && Array.isArray(deckWithSubDecks.subDecks)) {
    for (const sd of deckWithSubDecks.subDecks) {
      if (sd.id && Array.isArray(sd.factIds)) {
        subDecksRecord[sd.id] = sd.factIds;
      }
    }
  }

  // Register in deck registry (metadata only).
  const registrySubDecks = deckWithSubDecks.subDecks?.map(sd => ({
    id: sd.id,
    name: sd.name,
    factCount: sd.factIds?.length ?? 0,
  }));

  const registryEntry: DeckRegistryEntry = {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    domain: deck.domain as CanonicalFactDomain | 'vocabulary',
    subDomain: deck.subDomain,
    factCount: deck.facts.length,
    subDecks: registrySubDecks,
    tier: 1,
    status: 'available',
    artPlaceholder: {
      gradientFrom: '#555',
      gradientTo: '#333',
      icon: 'book',
    },
  };
  registerDeck(registryEntry);

  // Register fact IDs in the fact index.
  registerDeckFacts(deck.id, {
    allFacts: deck.facts.map(f => f.id),
    subDecks: Object.keys(subDecksRecord).length > 0 ? subDecksRecord : undefined,
  });
}

/**
 * Initialize curated decks: fetch the manifest and load all deck JSON files.
 * Call at app startup alongside factsDB.init().
 * Gracefully handles a missing manifest or individual missing/malformed files.
 */
export async function initializeCuratedDecks(): Promise<void> {
  try {
    const manifestResp = await fetch('/data/decks/manifest.json');
    if (!manifestResp.ok) {
      console.log('[CuratedDecks] No manifest found — 0 curated decks loaded');
      return;
    }

    const manifest: { decks: string[] } = await manifestResp.json();

    if (!manifest.decks || manifest.decks.length === 0) {
      console.log('[CuratedDecks] Manifest empty — 0 curated decks loaded');
      return;
    }

    let loaded = 0;
    let totalFacts = 0;

    for (const filename of manifest.decks) {
      try {
        const resp = await fetch(`/data/decks/${filename}`);
        if (!resp.ok) {
          console.warn(`[CuratedDecks] Failed to fetch ${filename}: ${resp.status}`);
          continue;
        }
        const deck: CuratedDeck = await resp.json();
        // Basic validation
        if (!deck.id || !deck.facts || !Array.isArray(deck.facts)) {
          console.warn(`[CuratedDecks] Invalid deck format in ${filename} — missing id or facts array`);
          continue;
        }
        loadDeck(deck);
        loaded++;
        totalFacts += deck.facts.length;
      } catch (err) {
        console.warn(`[CuratedDecks] Error loading ${filename}:`, err);
      }
    }

    console.log(`[CuratedDecks] Loaded ${loaded} curated deck(s) with ${totalFacts} total facts`);
  } catch (err) {
    console.warn('[CuratedDecks] Failed to initialize:', err);
  }
}
