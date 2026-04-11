/**
 * Runtime store for loaded curated decks.
 * Separate from the trivia facts DB — curated decks are loaded from
 * /curated.db (SQLite via sql.js) at startup via initializeCuratedDecks().
 *
 * The sql.js WASM module is loaded lazily using the same pattern as factsDB.ts.
 * In production, the database binary is XOR-obfuscated and decoded at runtime
 * by decodeDbBuffer() from ../services/dbDecoder.
 *
 * Schema validation: every JSON.parse result is validated via Zod schemas from
 * curatedDeckSchema.ts before being used as a typed object. Malformed rows are
 * skipped (null-filtered) and counted — see the load summary log at the end of
 * initializeCuratedDecks(). This closes the class of silent-decode bugs including
 * the "fifa numeric distractors" incident.
 */

import type { CuratedDeck, DeckFact, AnswerTypePool, SynonymGroup } from './curatedDeckTypes';
import { parseDeckFact, parseAnswerTypePool, parseSynonymGroup } from './curatedDeckSchema';
import { registerDeck } from './deckRegistry';
import { registerDeckFacts, getSubDeckFactIds, getTagFactIds } from './deckFactIndex';
import type { DeckRegistryEntry } from './deckRegistry';
import type { CanonicalFactDomain } from './card-types';
import { getDomainMetadata } from './domainMetadata';
import { decodeDbBuffer } from '../services/dbDecoder';
import {
  loadDatabase as loadChessDatabase,
  getNextPuzzles,
  puzzleToDeckFact,
  isChessDbLoaded,
} from '../services/chessPuzzleService';
import type { ChessPuzzleQuery } from '../services/chessPuzzleService';

/** ID of the chess tactics curated deck — used for runtime puzzle injection. */
const CHESS_TACTICS_DECK_ID = 'chess_tactics';

// ---------------------------------------------------------------------------
// sql.js lazy loader (mirrors the pattern in factsDB.ts)
// ---------------------------------------------------------------------------

type SqlJsStatic = typeof import('sql.js')['default'];
let _initSqlJs: SqlJsStatic | null = null;

/**
 * Lazily loads sql.js on first call. Subsequent calls return the cached module.
 * Defers ~300 KB of WASM from the critical path.
 */
async function getSqlJs(): Promise<SqlJsStatic> {
  if (!_initSqlJs) {
    try {
      const mod = await import('sql.js');
      _initSqlJs = mod.default;
    } catch {
      // Stale Vite dep cache (504 Outdated Optimize Dep) — retry once after clearing
      const mod = await import(/* @vite-ignore */ 'sql.js');
      _initSqlJs = mod.default;
    }
  }
  return _initSqlJs;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

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

/**
 * Idempotent guard: waits until the specified curated deck is available in the store.
 *
 * All curated decks are loaded at app startup via initializeCuratedDecks(), so by the
 * time a player can trigger a mystery event mid-run the deck should already be present.
 * This guard handles the edge case where startup loading races with the first encounter.
 *
 * Polls every 100 ms for up to 5 s, then logs a warning and returns so the event
 * can still open (it will just show "no facts available" rather than crashing).
 */
export async function ensureCuratedDeckLoaded(deckId: string): Promise<void> {
  if (loadedDecks.has(deckId)) return; // fast path — already loaded
  const POLL_MS = 100;
  const TIMEOUT_MS = 5000;
  let waited = 0;
  while (!loadedDecks.has(deckId) && waited < TIMEOUT_MS) {
    await new Promise<void>(resolve => setTimeout(resolve, POLL_MS));
    waited += POLL_MS;
  }
  if (!loadedDecks.has(deckId)) {
    console.warn(`[CuratedDecks] ensureCuratedDeckLoaded: deck "${deckId}" not available after ${TIMEOUT_MS}ms`);
  }
}

// ---------------------------------------------------------------------------
// Art placeholder helpers
// ---------------------------------------------------------------------------

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
    const PREFIX_COLORS: Record<string, string> = {
      japanese: '#E11D48',   // rose red
      korean: '#7C3AED',    // violet
      mandarin: '#DC2626',  // red
      chinese: '#DC2626',   // red
      spanish: '#F59E0B',   // amber
      french: '#3B82F6',    // blue
      german: '#EAB308',    // yellow
      dutch: '#F97316',     // orange
      czech: '#14B8A6',     // teal
    };
    const underscoreIdx = deckId.indexOf('_');
    const prefix = underscoreIdx > 0 ? deckId.substring(0, underscoreIdx) : deckId;
    icon = PREFIX_FLAGS[prefix] ?? '\u{1F4DA}'; // stack of books fallback
    colorTint = PREFIX_COLORS[prefix] ?? colorTint;
  }

  return {
    gradientFrom: mixHexWithDark(colorTint, 0.35), // 35% color, 65% dark
    gradientTo: mixHexWithDark(colorTint, 0.15),   // 15% color, 85% dark
    icon,
  };
}

// ---------------------------------------------------------------------------
// loadDeck — registration logic (unchanged from JSON era)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SQL row → TypeScript type helpers
// ---------------------------------------------------------------------------

/** Map a raw deck row from the `decks` table to a partial CuratedDeck (without facts/pools/synonyms). */
function rowToDeckShell(row: Record<string, unknown>): Omit<CuratedDeck, 'facts' | 'answerTypePools' | 'synonymGroups'> {
  return {
    id: String(row['id']),
    name: String(row['name']),
    description: String(row['description']),
    domain: String(row['domain']),
    subDomain: row['sub_domain'] ? String(row['sub_domain']) : undefined,
    minimumFacts: Number(row['minimum_facts']),
    targetFacts: Number(row['target_facts']),
    questionTemplates: JSON.parse(String(row['question_templates'] ?? '[]')),
    difficultyTiers: JSON.parse(String(row['difficulty_tiers'] ?? '[]')),
  };
}

/**
 * Map a raw row from the `deck_facts` table to a validated DeckFact.
 * Returns null if Zod schema validation fails — callers must filter nulls.
 * The Zod validation runs AFTER the JSON.parse chain so that type coercions
 * (e.g. Number(), String()) happen before the shape check.
 */
function rowToDeckFact(row: Record<string, unknown>, deckId: string): DeckFact | null {
  const examTagsRaw = JSON.parse(String(row['exam_tags'] ?? '[]')) as string[];
  const assembled = {
    id: String(row['id']),
    correctAnswer: String(row['correct_answer']),
    acceptableAlternatives: JSON.parse(String(row['acceptable_alternatives'] ?? '[]')),
    synonymGroupId: row['synonym_group_id'] ? String(row['synonym_group_id']) : undefined,
    chainThemeId: Number(row['chain_theme_id']),
    answerTypePoolId: String(row['answer_type_pool_id']),
    difficulty: Number(row['difficulty']),
    funScore: Number(row['fun_score']),
    quizQuestion: String(row['quiz_question']),
    explanation: String(row['explanation']),
    grammarNote: row['grammar_note'] ? String(row['grammar_note']) : undefined,
    displayAsFullForm: row['display_as_full_form'] === 1 ? true : undefined,
    fullFormDisplay: row['full_form_display'] ? String(row['full_form_display']) : undefined,
    visualDescription: String(row['visual_description'] ?? ''),
    sourceName: String(row['source_name'] ?? ''),
    sourceUrl: row['source_url'] ? String(row['source_url']) : undefined,
    volatile: row['volatile'] === 1 ? true : undefined,
    // Intentionally NOT cast to string[] — Zod validates the element types.
    distractors: JSON.parse(String(row['distractors'] ?? '[]')),
    targetLanguageWord: row['target_language_word'] ? String(row['target_language_word']) : undefined,
    reading: row['reading'] ? String(row['reading']) : undefined,
    language: row['language'] ? String(row['language']) : undefined,
    pronunciation: row['pronunciation'] ? String(row['pronunciation']) : undefined,
    partOfSpeech: row['part_of_speech'] ? String(row['part_of_speech']) : undefined,
    examTags: examTagsRaw.length > 0 ? examTagsRaw : undefined,
    imageAssetPath: row['image_asset_path'] ? String(row['image_asset_path']) : undefined,
    quizMode: row['quiz_mode'] ? String(row['quiz_mode']) : undefined,
    quizResponseMode: row['quiz_response_mode'] ? String(row['quiz_response_mode']) : undefined,
    sentenceFurigana: row['sentence_furigana'] ? JSON.parse(String(row['sentence_furigana'])) : undefined,
    sentenceRomaji: row['sentence_romaji'] ? String(row['sentence_romaji']) : undefined,
    sentenceTranslation: row['sentence_translation'] ? String(row['sentence_translation']) : undefined,
    grammarPointLabel: row['grammar_point_label'] ? String(row['grammar_point_label']) : undefined,
    categoryL1: row['category_l1'] ? String(row['category_l1']) : undefined,
    categoryL2: row['category_l2'] ? String(row['category_l2']) : undefined,
    fenPosition: row['fen_position'] ? String(row['fen_position']) : undefined,
    solutionMoves: row['solution_moves'] ? JSON.parse(String(row['solution_moves'])) : undefined,
    tacticTheme: row['tactic_theme'] ? String(row['tactic_theme']) : undefined,
    lichessRating: row['lichess_rating'] ? Number(row['lichess_rating']) : undefined,
  };
  return parseDeckFact(assembled, deckId, assembled.id);
}

/**
 * Map a raw row from the `answer_type_pools` table to a validated AnswerTypePool.
 * Returns null if Zod schema validation fails.
 */
function rowToAnswerTypePool(row: Record<string, unknown>, deckId: string): AnswerTypePool | null {
  // Intentionally NOT cast to string[] — Zod validates the element types.
  const syntheticRaw = JSON.parse(String(row['synthetic_distractors'] ?? '[]'));
  const assembled = {
    id: String(row['id']),
    label: String(row['label']),
    answerFormat: String(row['answer_format']),
    factIds: JSON.parse(String(row['fact_ids'] ?? '[]')),
    minimumSize: Number(row['minimum_size']),
    syntheticDistractors: Array.isArray(syntheticRaw) && syntheticRaw.length > 0 ? syntheticRaw : undefined,
  };
  return parseAnswerTypePool(assembled, deckId, assembled.id);
}

/**
 * Map a raw row from the `synonym_groups` table to a validated SynonymGroup.
 * Returns null if Zod schema validation fails.
 */
function rowToSynonymGroup(row: Record<string, unknown>, deckId: string): SynonymGroup | null {
  const assembled = {
    id: String(row['id']),
    factIds: JSON.parse(String(row['fact_ids'] ?? '[]')),
    reason: String(row['reason']),
  };
  return parseSynonymGroup(assembled, deckId, assembled.id);
}

// ---------------------------------------------------------------------------
// Initialization — fetch curated.db, decode, query all data, register decks
// ---------------------------------------------------------------------------

/**
 * Initialize curated decks: fetch /curated.db, decode it, open with sql.js,
 * query all decks/facts/pools/synonyms, reconstruct CuratedDeck objects, and
 * register each via loadDeck().
 *
 * Call at app startup alongside factsDB.init().
 * Gracefully handles a missing or unreadable curated.db.
 *
 * Schema validation: malformed rows are skipped (null-filtered) rather than
 * crashing the whole deck load. The final log reports how many rows were skipped.
 */
let _initCalled = false;
export async function initializeCuratedDecks(): Promise<void> {
  if (_initCalled) return; // Prevent duplicate initialization from re-running effects
  _initCalled = true;

  try {
    const [initFn, bufferResp] = await Promise.all([
      getSqlJs(),
      fetch('/curated.db'),
    ]);

    if (!bufferResp.ok) {
      console.log(`[CuratedDecks] /curated.db not found (${bufferResp.status}) — 0 curated decks loaded`);
      return;
    }

    const rawBuffer = await bufferResp.arrayBuffer();
    const decodedBytes = decodeDbBuffer(rawBuffer);

    const SQL = await initFn({ locateFile: () => '/sql-wasm.wasm' });
    const db = new SQL.Database(decodedBytes);

    // Helper: run a SELECT and return all rows as plain objects.
    function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
      const stmt = db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      }
      const rows: Record<string, unknown>[] = [];
      try {
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as Record<string, unknown>);
        }
      } finally {
        stmt.free();
      }
      return rows;
    }

    // 1. Load all deck shells.
    const deckRows = queryAll('SELECT * FROM decks');
    if (deckRows.length === 0) {
      console.log('[CuratedDecks] curated.db has no decks — 0 curated decks loaded');
      db.close();
      return;
    }

    // 2. Load facts, pools, synonyms grouped by deck_id for efficient lookup.
    const factRows = queryAll('SELECT * FROM deck_facts');
    const poolRows = queryAll('SELECT * FROM answer_type_pools');
    const synonymRows = queryAll('SELECT * FROM synonym_groups');

    // Track skipped rows for the final summary log.
    let skippedFacts = 0;
    let skippedPools = 0;
    let skippedSynonyms = 0;

    // Group by deck_id, filtering out null (schema-invalid) rows.
    const factsByDeck = new Map<string, DeckFact[]>();
    for (const row of factRows) {
      const deckId = String(row['deck_id']);
      const fact = rowToDeckFact(row, deckId);
      if (fact === null) {
        skippedFacts++;
        continue;
      }
      if (!factsByDeck.has(deckId)) factsByDeck.set(deckId, []);
      factsByDeck.get(deckId)!.push(fact);
    }

    const poolsByDeck = new Map<string, AnswerTypePool[]>();
    for (const row of poolRows) {
      const deckId = String(row['deck_id']);
      const pool = rowToAnswerTypePool(row, deckId);
      if (pool === null) {
        skippedPools++;
        continue;
      }
      if (!poolsByDeck.has(deckId)) poolsByDeck.set(deckId, []);
      poolsByDeck.get(deckId)!.push(pool);
    }

    const synonymsByDeck = new Map<string, SynonymGroup[]>();
    for (const row of synonymRows) {
      const deckId = String(row['deck_id']);
      const group = rowToSynonymGroup(row, deckId);
      if (group === null) {
        skippedSynonyms++;
        continue;
      }
      if (!synonymsByDeck.has(deckId)) synonymsByDeck.set(deckId, []);
      synonymsByDeck.get(deckId)!.push(group);
    }

    // 3. Assemble and register each deck.
    let loaded = 0;
    let totalFacts = 0;

    for (const deckRow of deckRows) {
      const deckId = String(deckRow['id']);
      try {
        const shell = rowToDeckShell(deckRow);
        const deck: CuratedDeck = {
          ...shell,
          facts: factsByDeck.get(deckId) ?? [],
          answerTypePools: poolsByDeck.get(deckId) ?? [],
          synonymGroups: synonymsByDeck.get(deckId) ?? [],
        };

        // Basic validation — deck must have an id and at least a facts array.
        if (!deck.id || !Array.isArray(deck.facts)) {
          console.warn(`[CuratedDecks] Invalid deck row for id="${deckId}" — skipping`);
          continue;
        }

        loadDeck(deck);
        loaded++;
        totalFacts += deck.facts.length;
      } catch (err) {
        console.warn(`[CuratedDecks] Error assembling deck id="${deckId}":`, err);
      }
    }

    db.close();

    // Report skipped malformed rows — zero is expected for healthy data.
    const skippedTotal = skippedFacts + skippedPools + skippedSynonyms;
    if (skippedTotal > 0) {
      console.warn(
        `[CuratedDecks] Loaded ${loaded} deck(s) with ${totalFacts} facts. ` +
        `Skipped ${skippedTotal} malformed row(s): ${skippedFacts} fact(s), ${skippedPools} pool(s), ${skippedSynonyms} synonym group(s). ` +
        `See schema warnings above for details.`
      );
    } else {
      console.log(`[CuratedDecks] Loaded ${loaded} curated deck(s) with ${totalFacts} total facts`);
    }

    // Start background load of chess puzzle DB if chess deck is present
    if (loadedDecks.has(CHESS_TACTICS_DECK_ID)) {
      loadChessDatabase().catch((err) =>
        console.warn('[CuratedDecks] Chess puzzle DB prefetch failed:', err)
      );
    }
  } catch (err) {
    console.warn('[CuratedDecks] Failed to initialize:', err);
  }
}

/**
 * Register a personal deck in the in-memory store so the quiz engine can access its facts.
 * Called by personalDeckStore.registerPersonalDecks() at startup.
 */
export function registerPersonalDeckInStore(deck: CuratedDeck): void {
  loadedDecks.set(deck.id, deck);
}

/**
 * Replace the chess_tactics deck's baked facts with live Elo-targeted puzzles
 * from chess-puzzles.db. Returns the number of facts injected (0 if DB unavailable).
 */
export async function refreshChessTacticsFacts(
  query: ChessPuzzleQuery
): Promise<number> {
  if (!loadedDecks.has(CHESS_TACTICS_DECK_ID)) return 0;
  if (!isChessDbLoaded()) return 0;

  const puzzles = await getNextPuzzles(query);
  if (puzzles.length === 0) return 0;

  const deck = loadedDecks.get(CHESS_TACTICS_DECK_ID)!;

  // Use chainThemeId 0 as default — runtime puzzles don't need chain grouping
  const newFacts = puzzles.map((p) => puzzleToDeckFact(p, 0));

  const updatedDeck: CuratedDeck = { ...deck, facts: newFacts };
  loadedDecks.set(CHESS_TACTICS_DECK_ID, updatedDeck);
  registerDeckFacts(CHESS_TACTICS_DECK_ID, {
    allFacts: newFacts.map((f) => f.id),
  });

  return newFacts.length;
}

/** Check whether the runtime chess puzzle DB is loaded and ready. */
export function isChessPuzzleDbReady(): boolean {
  return isChessDbLoaded();
}
