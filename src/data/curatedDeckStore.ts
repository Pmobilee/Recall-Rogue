/**
 * Runtime store for loaded curated decks.
 * Separate from the trivia facts DB — curated decks are loaded from
 * /data/decks/*.json at startup via initializeCuratedDecks().
 */

import type { CuratedDeck, DeckFact, AnswerTypePool, SynonymGroup } from './curatedDeckTypes';
import { registerDeck } from './deckRegistry';
import { registerDeckFacts, getSubDeckFactIds, getTagFactIds } from './deckFactIndex';
import type { DeckRegistryEntry } from './deckRegistry';
import type { CanonicalFactDomain } from './card-types';
import { getDomainMetadata } from './domainMetadata';

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
 * If examTags is provided (non-empty), further filters to facts carrying at least one matching tag.
 * Tag filtering is applied AFTER subdeck filtering (most restrictive wins).
 */
export function getCuratedDeckFacts(deckId: string, subDeckId?: string, examTags?: string[]): DeckFact[] {
  const deck = loadedDecks.get(deckId);
  if (!deck) return [];

  // Start with subdeck-filtered pool (or all facts).
  let facts: DeckFact[];
  if (subDeckId) {
    const subDeckFactIds = new Set(getSubDeckFactIds(deckId, subDeckId));
    facts = deck.facts.filter(f => subDeckFactIds.has(f.id));
  } else {
    facts = deck.facts;
  }

  // Apply exam tag filter if tags were selected.
  if (examTags && examTags.length > 0) {
    const tagFactIds = new Set(getTagFactIds(deckId, examTags));
    facts = facts.filter(f => tagFactIds.has(f.id));
  }

  return facts;
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

/** Mix a hex color with a dark base (#0d1117) at the given ratio (0–1, where 1 = full color). */
function mixHexWithDark(hex: string, ratio: number): string {
  const darkR = 13, darkG = 17, darkB = 23; // #0d1117
  const normalized = hex.replace(/^#/, '').toLowerCase();
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mr = Math.round(r * ratio + darkR * (1 - ratio));
  const mg = Math.round(g * ratio + darkG * (1 - ratio));
  const mb = Math.round(b * ratio + darkB * (1 - ratio));
  return `#${mr.toString(16).padStart(2, '0')}${mg.toString(16).padStart(2, '0')}${mb.toString(16).padStart(2, '0')}`;
}

/** Derive gradient colors and icon from the deck's domain for art placeholders. */
function deriveArtPlaceholder(
  domain: string,
  deckId: string,
): { gradientFrom: string; gradientTo: string; icon: string } {
  const meta = getDomainMetadata(domain as CanonicalFactDomain);
  let colorTint = meta.colorTint;
  let icon = meta.icon;

  // For vocabulary decks, override icon with a language flag derived from the deck ID prefix.
  if (domain === 'vocabulary') {
    const PREFIX_FLAGS: Record<string, string> = {
      japanese: '\u{1F1EF}\u{1F1F5}',
      korean: '\u{1F1F0}\u{1F1F7}',
      mandarin: '\u{1F1E8}\u{1F1F3}',
      chinese: '\u{1F1E8}\u{1F1F3}',
      spanish: '\u{1F1EA}\u{1F1F8}',
      french: '\u{1F1EB}\u{1F1F7}',
      german: '\u{1F1E9}\u{1F1EA}',
      dutch: '\u{1F1F3}\u{1F1F1}',
      czech: '\u{1F1E8}\u{1F1FF}',
    };
    const underscoreIdx = deckId.indexOf('_');
    const prefix = underscoreIdx > 0 ? deckId.substring(0, underscoreIdx) : deckId;
    icon = PREFIX_FLAGS[prefix] ?? '\u{1F4DA}'; // stack of books fallback
  }

  return {
    gradientFrom: mixHexWithDark(colorTint, 0.35), // 35% color, 65% dark
    gradientTo: mixHexWithDark(colorTint, 0.15),   // 15% color, 85% dark
    icon,
  };
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
    artPlaceholder: deriveArtPlaceholder(deck.domain, deck.id),
  };
  registerDeck(registryEntry);

  // Build tag index from facts that carry examTags.
  const tagIndex: Record<string, string[]> = {};
  for (const fact of deck.facts) {
    if (fact.examTags && fact.examTags.length > 0) {
      for (const tag of fact.examTags) {
        if (!tagIndex[tag]) tagIndex[tag] = [];
        tagIndex[tag].push(fact.id);
      }
    }
  }
  const allTags = Object.keys(tagIndex).sort();

  // Register fact IDs in the fact index.
  registerDeckFacts(deck.id, {
    allFacts: deck.facts.map(f => f.id),
    subDecks: Object.keys(subDecksRecord).length > 0 ? subDecksRecord : undefined,
    tagIndex: allTags.length > 0 ? tagIndex : undefined,
    allTags: allTags.length > 0 ? allTags : undefined,
  });
}

/**
 * Initialize curated decks: fetch the manifest and load all deck JSON files.
 * Call at app startup alongside factsDB.init().
 * Gracefully handles a missing manifest or individual missing/malformed files.
 */
let _initCalled = false;
export async function initializeCuratedDecks(): Promise<void> {
  if (_initCalled) return; // Prevent duplicate initialization from re-running effects
  _initCalled = true;
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
        const contentType = resp.headers.get('content-type') ?? '';
        if (!contentType.includes('json')) {
          // Vite dev server returns HTML for missing files — skip silently
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
