/**
 * Anki .apkg import/export service.
 *
 * An .apkg file is a ZIP archive containing:
 *   - `collection.anki2` or `collection.anki21` — SQLite database
 *   - `media` — JSON object mapping numeric indices to original filenames
 *   - Actual media files stored under the numeric key names (e.g., `0`, `1`, ...)
 *
 * Dependencies:
 *   - fflate (ZIP handling) — already in project
 *   - sql.js (SQLite in WASM) — already in project, used for facts.db / curated.db
 *
 * All public functions are pure — no side effects outside their return values.
 */

import { unzipSync, zipSync, strToU8 } from 'fflate';
import type { DeckFact, AnswerTypePool, PersonalDeck } from '../data/curatedDeckTypes';
import type { ReviewState, PlayerSave } from '../data/types';
import { generateDistractorsForDeck, type DistractorStats } from './ankiDistractorGenerator';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** A single note from an Anki collection (one card face pair). */
export interface AnkiNote {
  id: number;
  /** 8-character base62 GUID. Always present in real Anki exports. */
  guid?: string;
  modelId: number;
  /** Fields split by the Anki field separator (char code 31 / '\x1f'). */
  fields: string[];
  tags: string[];
}

/** A single card from an Anki collection (scheduling + note reference). */
export interface AnkiCard {
  id: number;
  noteId: number;
  /** Deck ID (may be absent in loosely-typed component data). */
  deckId?: number;
  /** Template ordinal (0-based). May be absent in loosely-typed component data. */
  ord?: number;
  /** Card type: 0=new, 1=learning, 2=review, 3=relearning. */
  type?: number;
  /** Queue: -3=sched buried, -2=user buried, -1=suspended, 0=new, 1=learning, 2=review, 3=day-learn. */
  queue?: number;
  /** Due value — interpreted differently per type. */
  due?: number;
  /** Interval in days (positive) or seconds (negative, for learning cards). */
  ivl?: number;
  /** Ease factor in permille (2500 = 2.5 ease). */
  factor?: number;
  reps?: number;
  lapses?: number;
}

/** A note type (model) from an Anki collection. */
export interface AnkiModel {
  id: number;
  name: string;
  /** Ordered field names for this model. */
  fields: string[];
  isCloze: boolean;
}

/** Parsed data from an .apkg file. */
export interface AnkiImportData {
  deckName: string;
  notes: AnkiNote[];
  cards: AnkiCard[];
  models: AnkiModel[];
  totalCards: number;
  /** True if any card has reps > 0, indicating real scheduling data exists. */
  hasSchedulingData: boolean;
  /**
   * Media files extracted from the .apkg archive.
   * Keys are the original filenames (e.g., "image.jpg"), values are raw bytes.
   * Empty Map if the archive contained no media.
   */
  media: Map<string, Uint8Array>;
}

/** Options for converting AnkiImportData to a PersonalDeck. */
export interface AnkiConvertOptions {
  deckId: string;
  deckName: string;
  /** Whether to map Anki scheduling data to ReviewState objects. */
  importScheduling: boolean;
  /** Index of the note field to use as the quiz question (front). */
  frontFieldIndex: number;
  /** Index of the note field to use as the correct answer (back). */
  backFieldIndex: number;
  /**
   * When true, run the pool-based distractor generator so players can use
   * multiple-choice mode. Facts that cannot get ≥ 4 distractors remain in
   * typing mode. Defaults to false.
   */
  useMultipleChoice?: boolean;
}

/** Result of converting Anki import data to game format. */
export interface AnkiConvertResult {
  deck: PersonalDeck;
  /** Only populated when importScheduling is true. */
  reviewStates: ReviewState[];
  /**
   * Only populated when useMultipleChoice is true.
   * Reports how many facts received distractors vs. stayed in typing mode.
   */
  distractorStats?: DistractorStats;
}

// ---------------------------------------------------------------------------
// Lazy sql.js loader (mirrors the pattern in curatedDeckStore.ts)
// ---------------------------------------------------------------------------

type SqlJsStatic = typeof import('sql.js')['default'];
let _sqlJs: SqlJsStatic | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!_sqlJs) {
    try {
      const mod = await import('sql.js');
      _sqlJs = mod.default;
    } catch {
      // Retry once — handles stale Vite dep cache (504 Outdated Optimize Dep).
      const mod = await import(/* @vite-ignore */ 'sql.js');
      _sqlJs = mod.default;
    }
  }
  return _sqlJs;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags, decode common HTML entities, and remove Anki sound syntax
 * (`[sound:filename.mp3]`) from a string.
 *
 * Note: This strips ALL `<img>` tags as well. Callers that need to detect image
 * references should call extractImgFilenames() BEFORE calling stripHtml().
 */
export function stripHtml(html: string): string {
  // Remove Anki sound tags [sound:filename] — not supported for playback, strip cleanly.
  let text = html.replace(/\[sound:[^\]]*\]/g, '');
  // Remove HTML tags (including <img> tags).
  text = text.replace(/<[^>]*>/g, '');
  // Decode common named entities.
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Decode numeric entities (e.g. &#123; or &#x7B;).
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );
  text = text.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCodePoint(parseInt(dec, 10)),
  );
  return text.trim();
}

/**
 * Extract all image filenames referenced by `<img src="...">` tags in an HTML string.
 * Returns an array of src attribute values (e.g., ["image.jpg", "diagram.png"]).
 * Call this BEFORE stripHtml() to detect media references.
 */
export function extractImgFilenames(html: string): string[] {
  const filenames: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    if (match[1]) filenames.push(match[1]);
  }
  return filenames;
}

/** Generate an 8-character base62 GUID for Anki note IDs. */
export function generateGuid(): string {
  const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    result += CHARSET[b % 62];
  }
  return result;
}

/**
 * Compute an Anki-compatible sort-field checksum (sfld csum).
 * Anki uses the first 8 hex characters of the SHA-1 of sfld as an unsigned 32-bit integer.
 * We use the Web Crypto API (async).
 */
async function ankiCsum(sfld: string): Promise<number> {
  const encoder = new TextEncoder();
  const data = encoder.encode(sfld);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  // First 4 bytes → big-endian uint32 (matches Anki's Python int() of 8 hex chars).
  const view = new DataView(hashBuffer);
  return view.getUint32(0, false); // big-endian
}

// ---------------------------------------------------------------------------
// Cloze deletion helpers
// ---------------------------------------------------------------------------

/**
 * Regex for Anki cloze syntax: `{{cN::answer}}` or `{{cN::answer::hint}}`.
 *
 * Groups:
 *   1 — cloze index (1, 2, 3, ...)
 *   2 — answer text
 *   3 — optional hint text
 */
const CLOZE_REGEX = /\{\{c(\d+)::([^:}]*?)(?:::([^}]*?))?\}\}/g;

/**
 * Parse a cloze-type note into individual facts — one fact per unique cloze index.
 *
 * For each cloze index N in the combined field text:
 *   - quizQuestion: all `{{cN::...}}` markers replaced with `[___]` (or `[hint]`);
 *     all OTHER cloze markers replaced with just their answer text (revealed).
 *   - correctAnswer: the answer text inside `{{cN::answer}}`.
 *   - quizResponseMode: 'typing' (cloze deletions are always typed answers).
 *
 * @param noteGuid - The note's GUID (used to build stable fact IDs).
 * @param fields - The note's field values (raw HTML, not yet stripped).
 * @param frontFieldIndex - Which field index contains the cloze text.
 * @param factIndex - The note's position in the import list (for chainThemeId).
 * @returns One entry per unique cloze index found.
 */
export function parseClozeNote(
  noteGuid: string,
  fields: string[],
  frontFieldIndex: number,
  factIndex: number,
): Array<{ question: string; answer: string; clozeIndex: number; factId: string; chainThemeId: number }> {
  // Use the front field (or the first non-empty field) as the source text.
  const rawText = fields[frontFieldIndex] ?? fields[0] ?? '';

  // Collect all unique cloze indices present in the text.
  const clozeEntries = new Map<number, { answer: string; hint?: string }>();
  let m: RegExpExecArray | null;
  const regex = new RegExp(CLOZE_REGEX.source, 'g');
  while ((m = regex.exec(rawText)) !== null) {
    const idx = parseInt(m[1], 10);
    if (!clozeEntries.has(idx)) {
      // Only record the first occurrence of each cloze index (Anki convention).
      clozeEntries.set(idx, { answer: m[2], hint: m[3] });
    }
  }

  if (clozeEntries.size === 0) return [];

  const results: Array<{ question: string; answer: string; clozeIndex: number; factId: string; chainThemeId: number }> = [];

  for (const [clozeIndex, { answer, hint }] of clozeEntries) {
    // Build the question: replace the target cloze with a blank, reveal others.
    const questionRaw = rawText.replace(
      new RegExp(CLOZE_REGEX.source, 'g'),
      (_full: string, idxStr: string, ans: string, _hintStr: string | undefined) => {
        const idx = parseInt(idxStr, 10);
        if (idx === clozeIndex) {
          // Replace this cloze with a blank (or hint if provided).
          return hint ? `[${hint}]` : '[___]';
        }
        // Reveal other cloze answers.
        return ans;
      },
    );

    const question = stripHtml(questionRaw).trim();
    const cleanAnswer = stripHtml(answer).trim();

    // Skip empty results.
    if (!question || !cleanAnswer) continue;

    results.push({
      question,
      answer: cleanAnswer,
      clozeIndex,
      factId: `anki_${noteGuid}_c${clozeIndex}`,
      chainThemeId: (factIndex + clozeIndex) % 6,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Import: parseApkg
// ---------------------------------------------------------------------------

/**
 * Parse an Anki .apkg file (as raw bytes) into structured import data.
 *
 * Also extracts any media files present in the archive and returns them
 * in `AnkiImportData.media` as a Map from original filename to raw bytes.
 *
 * @param apkgBytes - The raw .apkg file contents as a Uint8Array.
 * @returns Parsed notes, cards, models, deck metadata, and media files.
 * @throws If the ZIP or SQLite database cannot be parsed.
 */
export async function parseApkg(apkgBytes: Uint8Array): Promise<AnkiImportData> {
  // Step 1: Unzip the .apkg archive.
  const unzipped = unzipSync(apkgBytes);

  // Step 2: Find the SQLite collection file (prefer .anki21 over .anki2).
  const collectionKey =
    Object.keys(unzipped).find(k => k === 'collection.anki21') ??
    Object.keys(unzipped).find(k => k === 'collection.anki2');

  if (!collectionKey) {
    throw new Error('[ankiService] No collection.anki2 or collection.anki21 found in .apkg');
  }

  const dbBytes = unzipped[collectionKey];

  // Step 3: Open the SQLite database.
  const initFn = await getSqlJs();
  const SQL = await initFn({ locateFile: () => '/sql-wasm.wasm' });
  const db = new SQL.Database(dbBytes);

  /** Run a SELECT and return rows as plain objects. */
  function queryAll(sql: string): Record<string, unknown>[] {
    const stmt = db.prepare(sql);
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

  // Step 4: Read the col table (one row) for deck/model metadata.
  const colRows = queryAll('SELECT decks, models FROM col');
  const colRow = colRows[0] ?? {};

  const rawDecks = JSON.parse(String(colRow['decks'] ?? '{}')) as Record<
    string,
    { name: string; id: number | string }
  >;
  const rawModels = JSON.parse(String(colRow['models'] ?? '{}')) as Record<
    string,
    { id: number | string; name: string; type?: number; flds: Array<{ name: string }> }
  >;

  // Derive deck name: use the first non-"Default" deck, or fallback.
  const deckEntries = Object.values(rawDecks);
  const mainDeck =
    deckEntries.find(d => d.name !== 'Default') ??
    deckEntries[0] ??
    { name: 'Imported Deck', id: 1 };
  const deckName = mainDeck.name;

  // Parse models into AnkiModel[].
  const models: AnkiModel[] = Object.values(rawModels).map(m => ({
    id: Number(m.id),
    name: m.name,
    fields: (m.flds ?? []).map((f: { name: string }) => f.name),
    // type=1 means cloze in Anki
    isCloze: m.type === 1,
  }));

  // Step 5: Read notes.
  const FIELD_SEP = String.fromCharCode(31); // \x1f
  const noteRows = queryAll('SELECT id, guid, mid, flds, tags FROM notes');
  const notes: AnkiNote[] = noteRows.map(row => ({
    id: Number(row['id']),
    guid: String(row['guid']),
    modelId: Number(row['mid']),
    fields: String(row['flds']).split(FIELD_SEP),
    tags: String(row['tags'] ?? '')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0),
  }));

  // Step 6: Read cards.
  const cardRows = queryAll(
    'SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses FROM cards',
  );
  const cards: AnkiCard[] = cardRows.map(row => ({
    id: Number(row['id']),
    noteId: Number(row['nid']),
    deckId: Number(row['did']),
    ord: Number(row['ord']),
    type: Number(row['type']),
    queue: Number(row['queue']),
    due: Number(row['due']),
    ivl: Number(row['ivl']),
    factor: Number(row['factor']),
    reps: Number(row['reps']),
    lapses: Number(row['lapses']),
  }));

  db.close();

  // Step 7: Extract media files from the ZIP.
  // The `media` file in the ZIP is a JSON object: { "0": "image.jpg", "1": "audio.mp3", ... }
  // The actual files are stored as `0`, `1`, etc. (integer keys as filenames).
  const mediaMap = new Map<string, Uint8Array>();
  const mediaFileBytes = unzipped['media'];
  if (mediaFileBytes) {
    try {
      const mediaJson = JSON.parse(new TextDecoder().decode(mediaFileBytes)) as Record<string, string>;
      for (const [intKey, originalFilename] of Object.entries(mediaJson)) {
        const fileBytes = unzipped[intKey];
        if (fileBytes && originalFilename) {
          mediaMap.set(originalFilename, fileBytes);
        }
      }
    } catch {
      // Non-critical: if media manifest is malformed, skip media extraction.
    }
  }

  const hasSchedulingData = cards.some(c => (c.reps ?? 0) > 0);

  return {
    deckName,
    notes,
    cards,
    models,
    totalCards: cards.length,
    hasSchedulingData,
    media: mediaMap,
  };
}

// ---------------------------------------------------------------------------
// Convert: ankiToPersonalDeck
// ---------------------------------------------------------------------------

/**
 * Convert parsed Anki import data to a PersonalDeck and optional ReviewState array.
 *
 * Handles both regular Basic notes and cloze deletion notes:
 * - Basic notes: one fact per note.
 * - Cloze notes: one fact per unique cloze index within the note.
 *
 * HTML and Anki sound syntax are stripped from all field values. Image references
 * (`<img src="...">`) are detected before stripping — facts with image questions get
 * `imageAssetPath: 'anki-media://${deckId}/${filename}'` and `quizMode: 'image_question'`.
 *
 * Pass the `media` map from `AnkiImportData` to `ankiToPersonalDeck` and then call
 * `storeMedia()` from `ankiMediaStore.ts` to persist the files to IndexedDB.
 *
 * @param data - Parsed import data from parseApkg().
 * @param options - Conversion options (deck ID, field mapping, scheduling flag).
 * @param media - Optional media map from parseApkg() (used to build imageAssetPath refs).
 * @returns The PersonalDeck and any mapped ReviewState objects.
 */
export function ankiToPersonalDeck(
  data: AnkiImportData,
  options: AnkiConvertOptions,
  media?: Map<string, Uint8Array>,
): AnkiConvertResult {
  const { deckId, deckName, importScheduling, frontFieldIndex, backFieldIndex, useMultipleChoice = false } = options;

  // Build a model-id → model map for cloze detection.
  const modelById = new Map<number, AnkiModel>();
  for (const model of data.models) {
    modelById.set(model.id, model);
  }

  // Build a note-id → card map for scheduling lookup.
  const cardByNoteId = new Map<number, AnkiCard>();
  for (const card of data.cards) {
    // Only keep the first card per note (ord=0 is the "Basic" front card).
    if (!cardByNoteId.has(card.noteId) || (card.ord ?? 0) < (cardByNoteId.get(card.noteId)?.ord ?? 99)) {
      cardByNoteId.set(card.noteId, card);
    }
  }

  // Whether any media was passed in.
  const hasMedia = (media?.size ?? 0) > 0;

  const facts: DeckFact[] = [];
  const reviewStates: ReviewState[] = [];
  const allFactIds: string[] = [];

  for (let i = 0; i < data.notes.length; i++) {
    const note = data.notes[i];
    const model = modelById.get(note.modelId);

    if (model?.isCloze) {
      // --- Cloze note: generate one fact per cloze index ---
      const clozeResults = parseClozeNote(
        note.guid ?? String(note.id),
        note.fields,
        frontFieldIndex,
        i,
      );

      for (const clozeEntry of clozeResults) {
        const fact: DeckFact = {
          id: clozeEntry.factId,
          quizQuestion: clozeEntry.question,
          correctAnswer: clozeEntry.answer,
          explanation: '',
          distractors: [],
          difficulty: 3,
          funScore: 5,
          chainThemeId: clozeEntry.chainThemeId,
          answerTypePoolId: 'anki_default',
          acceptableAlternatives: [],
          visualDescription: '',
          sourceName: 'Anki Import',
          // Cloze facts are always typed.
          quizResponseMode: 'typing' as const,
        };

        facts.push(fact);
        allFactIds.push(clozeEntry.factId);

        // Scheduling for cloze: use the note's first card.
        if (importScheduling) {
          const card = cardByNoteId.get(note.id);
          if (card) {
            reviewStates.push(mapAnkiCardToReviewState(clozeEntry.factId, card));
          }
        }
      }
    } else {
      // --- Regular (Basic) note: one fact per note ---
      const rawFront = note.fields[frontFieldIndex] ?? '';
      const rawBack = note.fields[backFieldIndex] ?? '';

      // Extract image filenames before stripping HTML.
      const frontImages = hasMedia ? extractImgFilenames(rawFront) : [];

      const front = stripHtml(rawFront);
      const back = stripHtml(rawBack);

      // Skip notes with empty front or back fields.
      if (!front || !back) continue;

      // Use guid when present (real Anki exports always have it); fall back to id for type-loose callers.
      const factId = `anki_${note.guid ?? note.id}`;

      // Determine if the question has an associated image.
      // Use the first referenced image that exists in the media map.
      const referencedImage =
        frontImages.find(fname => media?.has(fname)) ?? null;

      const fact: DeckFact = {
        id: factId,
        quizQuestion: front,
        correctAnswer: back,
        explanation: '',
        distractors: [],
        difficulty: 3,
        funScore: 5,
        // Distribute across 6 chain theme slots in round-robin fashion.
        chainThemeId: i % 6,
        answerTypePoolId: 'anki_default',
        acceptableAlternatives: [],
        visualDescription: '',
        sourceName: 'Anki Import',
        // Personal decks use typing mode by default — no distractors available.
        quizResponseMode: 'typing' as const,
        ...(referencedImage
          ? {
              imageAssetPath: `anki-media://${deckId}/${referencedImage}`,
              quizMode: 'image_question' as const,
            }
          : {}),
      };

      facts.push(fact);
      allFactIds.push(factId);

      if (importScheduling) {
        const card = cardByNoteId.get(note.id);
        if (card) {
          reviewStates.push(mapAnkiCardToReviewState(factId, card));
        }
      }
    }
  }

  const defaultPool: AnswerTypePool = {
    id: 'anki_default',
    label: 'Imported',
    answerFormat: 'term',
    factIds: [...allFactIds],
    minimumSize: 5,
  };

  const deck: PersonalDeck = {
    id: deckId,
    name: deckName,
    domain: 'personal',
    description: `Imported from Anki: "${data.deckName}"`,
    facts,
    answerTypePools: [defaultPool],
    synonymGroups: [],
    questionTemplates: [],
    difficultyTiers: [],
    minimumFacts: 1,
    targetFacts: facts.length,
    source: 'anki_import',
    importedAt: Date.now(),
    ankiDeckName: data.deckName,
    cardCount: data.totalCards,
  };

  // Optionally generate pool-based distractors for multiple-choice mode.
  let distractorStats: DistractorStats | undefined;
  if (useMultipleChoice && facts.length > 0) {
    const result = generateDistractorsForDeck(facts);
    // Replace the facts array on the deck with the enriched version.
    deck.facts = result.facts;
    // Re-sync the pool factIds to match the (unchanged) allFactIds.
    // The pool was built before distractor generation so factIds are already correct.
    distractorStats = result.stats;
  }

  return { deck, reviewStates, distractorStats };
}

// ---------------------------------------------------------------------------
// Internal: map Anki card scheduling → ReviewState
// ---------------------------------------------------------------------------

/**
 * Map a single AnkiCard's scheduling data to a ReviewState for the FSRS engine.
 * This is an approximation — Anki uses SM-2, the game uses FSRS, so values are
 * mapped on a best-effort basis.
 */
function mapAnkiCardToReviewState(factId: string, card: AnkiCard): ReviewState {
  // Map Anki card type to FSRS state label.
  const stateMap: Record<number, 'new' | 'learning' | 'review' | 'relearning'> = {
    0: 'new',
    1: 'learning',
    2: 'review',
    3: 'relearning',
  };
  // All fields are optional — use safe defaults throughout.
  const cardType = card.type ?? 0;
  const cardFactor = card.factor ?? 0;
  const cardIvl = card.ivl ?? 0;
  const cardDue = card.due ?? 0;
  const cardReps = card.reps ?? 0;
  const cardLapses = card.lapses ?? 0;

  const cardState = stateMap[cardType] ?? 'new';

  // Ease factor: Anki stores in permille (2500 = 2.5). Default to 2.5 if zero.
  const easeFactor = cardFactor > 0 ? cardFactor / 1000 : 2.5;

  // Interval in days (positive ivl). Negative ivl means learning cards (seconds-based).
  const interval = Math.max(0, cardIvl);

  // FSRS stability approximation: for review cards, ivl ≈ stability in days.
  const stability = Math.max(0.1, interval);

  // Map ease factor to FSRS difficulty (1–10). Lower ease = higher difficulty.
  // Anki ease range ~1.3–2.5 → FSRS difficulty 1–10 (inverted).
  const difficulty = Math.round(
    Math.max(1, Math.min(10, 10 - ((easeFactor - 1.3) / 1.2) * 9)),
  );

  // Compute due timestamp.
  let due: number;
  if (cardType === 0) {
    // New card: due now.
    due = Date.now();
  } else if (cardType === 1 || cardType === 3) {
    // Learning / relearning: Anki stores due as epoch seconds.
    due = cardDue * 1000;
  } else {
    // Review (type=2): Anki stores due as a day offset from collection creation.
    // We cannot reliably reconstruct the collection creation date here, so treat as due now.
    due = Date.now();
  }

  const lastReviewAt = interval > 0 ? Date.now() - interval * 86_400_000 : Date.now();

  return {
    factId,
    cardState,
    state: cardState,
    easeFactor,
    interval,
    stability,
    difficulty,
    reps: cardReps,
    lapses: cardLapses,
    lapseCount: cardLapses,
    repetitions: cardReps,
    due,
    nextReviewAt: due,
    lastReviewAt,
    lastReview: lastReviewAt,
    quality: 0,
    learningStep: 0,
    isLeech: cardLapses >= 8,
    consecutiveCorrect: 0,
    passedMasteryTrial: false,
    retrievability: cardType === 2 ? 0.9 : 0,
    masteredAt: 0,
    graduatedRelicId: null,
    lastVariantIndex: -1,
    totalAttempts: cardReps,
    totalCorrect: Math.max(0, cardReps - cardLapses),
    averageResponseTimeMs: 0,
    tierHistory: [],
  };
}

// ---------------------------------------------------------------------------
// Export: createApkg
// ---------------------------------------------------------------------------

/** Options for createApkg export. */
export interface CreateApkgOptions {
  deckName: string;
  /** Facts to export. Accepts DeckFact[] or any array with quizQuestion/correctAnswer/id. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  facts: any[];
  /** Optional review states array (factId → state). Accepts ReviewState[] or a Map. */
  reviewStates?: ReviewState[] | Map<string, ReviewState> | unknown[] | undefined;
  /** When true, only export facts that have a due review state. (Not yet implemented — included for API compat.) */
  onlyDue?: boolean;
  /**
   * Optional media files to bundle into the .apkg archive.
   * Keys are original filenames (e.g., "image.jpg"), values are raw bytes.
   * The service creates the numeric-key mapping required by the Anki format automatically.
   */
  media?: Map<string, Uint8Array>;
}

/**
 * Create an Anki .apkg file from a set of facts and optional review states.
 *
 * The export uses the "Basic" note type (Front + Back fields) regardless of the
 * source deck type. Only the first card template (ord=0) is created per note.
 *
 * If a `media` map is provided, those files are bundled into the archive using
 * the Anki numeric-key naming convention and included in the `media` manifest.
 *
 * Supports two call signatures:
 *   - `createApkg(options: CreateApkgOptions)` — object form
 *   - `createApkg(deckName, facts, reviewStates?)` — positional form (legacy)
 *
 * @returns The raw .apkg file bytes as a Uint8Array.
 */
export async function createApkg(
  optionsOrDeckName: CreateApkgOptions | string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factsArg?: any[],
  reviewStatesArg?: Map<string, ReviewState> | ReviewState[],
): Promise<Uint8Array> {
  // Normalise call signatures.
  let deckName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let facts: any[];
  let rawReviewStates: ReviewState[] | Map<string, ReviewState> | unknown[] | undefined;
  let exportMedia: Map<string, Uint8Array> | undefined;

  if (typeof optionsOrDeckName === 'string') {
    // Positional form: createApkg(deckName, facts, reviewStates?)
    deckName = optionsOrDeckName;
    facts = factsArg ?? [];
    rawReviewStates = reviewStatesArg;
  } else {
    // Options object form.
    deckName = optionsOrDeckName.deckName;
    facts = optionsOrDeckName.facts;
    rawReviewStates = optionsOrDeckName.reviewStates;
    exportMedia = optionsOrDeckName.media;
  }

  // Normalise reviewStates to a Map<factId, ReviewState> for internal use.
  let reviewStatesMap: Map<string, ReviewState> | undefined;
  if (rawReviewStates instanceof Map) {
    reviewStatesMap = rawReviewStates as Map<string, ReviewState>;
  } else if (Array.isArray(rawReviewStates) && rawReviewStates.length > 0) {
    reviewStatesMap = new Map(
      (rawReviewStates as ReviewState[]).map(rs => [rs.factId, rs]),
    );
  }
  const initFn = await getSqlJs();
  const SQL = await initFn({ locateFile: () => '/sql-wasm.wasm' });
  const db = new SQL.Database();

  // ---------------------------------------------------------------------------
  // Create Anki schema tables
  // ---------------------------------------------------------------------------

  db.run(`
    CREATE TABLE IF NOT EXISTS col (
      id INTEGER PRIMARY KEY,
      crt INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      scm INTEGER NOT NULL,
      ver INTEGER NOT NULL,
      dty INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      ls INTEGER NOT NULL,
      conf TEXT NOT NULL,
      models TEXT NOT NULL,
      decks TEXT NOT NULL,
      dconf TEXT NOT NULL,
      tags TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      guid TEXT NOT NULL,
      mid INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      tags TEXT NOT NULL,
      flds TEXT NOT NULL,
      sfld TEXT NOT NULL,
      csum INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY,
      nid INTEGER NOT NULL,
      did INTEGER NOT NULL,
      ord INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      type INTEGER NOT NULL,
      queue INTEGER NOT NULL,
      due INTEGER NOT NULL,
      ivl INTEGER NOT NULL,
      factor INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      left INTEGER NOT NULL,
      odue INTEGER NOT NULL,
      odid INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS revlog (
      id INTEGER PRIMARY KEY,
      cid INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      ease INTEGER NOT NULL,
      ivl INTEGER NOT NULL,
      lastIvl INTEGER NOT NULL,
      factor INTEGER NOT NULL,
      time INTEGER NOT NULL,
      type INTEGER NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS graves (
      usn INTEGER NOT NULL,
      oid INTEGER NOT NULL,
      type INTEGER NOT NULL
    );
  `);

  // Indexes (Anki standard).
  db.run('CREATE INDEX IF NOT EXISTS ix_notes_usn ON notes (usn);');
  db.run('CREATE INDEX IF NOT EXISTS ix_cards_usn ON cards (usn);');
  db.run('CREATE INDEX IF NOT EXISTS ix_revlog_usn ON revlog (usn);');
  db.run('CREATE INDEX IF NOT EXISTS ix_cards_nid ON cards (nid);');
  db.run('CREATE INDEX IF NOT EXISTS ix_cards_sched ON cards (did, queue, due);');
  db.run('CREATE INDEX IF NOT EXISTS ix_revlog_cid ON revlog (cid);');
  db.run('CREATE INDEX IF NOT EXISTS ix_notes_csum ON notes (csum);');

  // ---------------------------------------------------------------------------
  // Build col metadata
  // ---------------------------------------------------------------------------

  const nowSec = Math.floor(Date.now() / 1000);
  const modelId = Date.now();
  const deckId = Date.now() + 1;

  const model = {
    [modelId]: {
      id: modelId,
      name: 'Basic',
      type: 0,
      mod: nowSec,
      usn: -1,
      sortf: 0,
      did: deckId,
      tmpls: [
        {
          name: 'Card 1',
          ord: 0,
          qfmt: '{{Front}}',
          afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
          bqfmt: '',
          bafmt: '',
          did: null,
          bfont: '',
          bsize: 0,
        },
      ],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20 },
        { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20 },
      ],
      css: '.card { font-family: arial; font-size: 20px; text-align: center; }',
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      latexsvg: false,
      req: [[0, 'any', [0]]],
      tags: [],
      vers: [],
    },
  };

  const decks = {
    1: {
      id: 1,
      name: 'Default',
      extendRev: 50,
      usn: 0,
      collapsed: false,
      newToday: [0, 0],
      timeToday: [0, 0],
      dyn: 0,
      extendNew: 10,
      conf: 1,
      revToday: [0, 0],
      lrnToday: [0, 0],
      mod: nowSec,
      desc: '',
    },
    [deckId]: {
      id: deckId,
      name: deckName,
      extendRev: 50,
      usn: -1,
      collapsed: false,
      newToday: [0, 0],
      timeToday: [0, 0],
      dyn: 0,
      extendNew: 10,
      conf: 1,
      revToday: [0, 0],
      lrnToday: [0, 0],
      mod: nowSec,
      desc: '',
    },
  };

  const dconf = {
    1: {
      id: 1,
      name: 'Default',
      replayq: true,
      lapse: { leechFails: 8, delays: [10], minInt: 1, leechAction: 0, mult: 0 },
      rev: { perDay: 200, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: false, minSpace: 1 },
      timer: 0,
      maxTaken: 60,
      usn: 0,
      new: {
        perDay: 20,
        delays: [1, 10],
        separate: true,
        ints: [1, 4, 7],
        initialFactor: 2500,
        bury: false,
        order: 1,
      },
      mod: nowSec,
      autoplay: true,
      schedVer: 2,
    },
  };

  db.run(
    `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      nowSec,
      nowSec,
      nowSec * 1000,
      11, // Anki collection version
      0,
      -1,
      0,
      JSON.stringify({ activeDecks: [deckId], curDeck: deckId, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true, curModel: String(modelId), nextPos: 1, sortType: 'noteFld', sortBackwards: false, addToCur: true, dayLearnFirst: false, schedVer: 2 }),
      JSON.stringify(model),
      JSON.stringify(decks),
      JSON.stringify(dconf),
      '{}',
    ],
  );

  // ---------------------------------------------------------------------------
  // Insert notes and cards
  // ---------------------------------------------------------------------------

  const baseNoteId = Date.now();
  const baseCardId = Date.now() + 1_000_000;

  const noteStmt = db.prepare(
    `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const cardStmt = db.prepare(
    `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (let i = 0; i < facts.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fact = facts[i] as any;
    const noteId = baseNoteId + i * 1000;
    const cardId = baseCardId + i * 1000;
    const guid = generateGuid();
    const sfld = fact.quizQuestion;
    const flds = `${fact.quizQuestion}\x1f${fact.correctAnswer}`;

    // Compute SHA-1 checksum for sfld.
    const csum = await ankiCsum(sfld);

    noteStmt.run([noteId, guid, modelId, nowSec, -1, '', flds, sfld, csum, 0, '']);

    // Map ReviewState back to Anki card scheduling if provided.
    let cardType = 0;
    let cardQueue = 0;
    let cardDue = i + 1; // New cards use a sequential due position.
    let cardIvl = 0;
    let cardFactor = 0;
    let cardReps = 0;
    let cardLapses = 0;

    if (reviewStatesMap) {
      const rs = reviewStatesMap.get(fact.id);
      if (rs) {
        const stateToType: Record<string, number> = {
          new: 0,
          learning: 1,
          review: 2,
          relearning: 3,
        };
        cardType = stateToType[rs.cardState] ?? 0;
        cardQueue = cardType;
        cardIvl = Math.round(rs.interval ?? 0);
        cardFactor = Math.round((rs.easeFactor ?? 2.5) * 1000);
        cardReps = rs.reps ?? rs.repetitions ?? 0;
        cardLapses = rs.lapses ?? rs.lapseCount ?? 0;
        // Use epoch seconds for due on learning cards; day offset is unresolvable so use 0 for review.
        cardDue = cardType === 2 ? 0 : Math.floor((rs.nextReviewAt ?? Date.now()) / 1000);
      }
    }

    cardStmt.run([
      cardId, noteId, deckId, 0, nowSec, -1,
      cardType, cardQueue, cardDue, cardIvl, cardFactor,
      cardReps, cardLapses,
      0, // left (learning steps remaining)
      0, // odue (original due for filtered decks)
      0, // odid (original deck id for filtered decks)
      0, // flags
      '', // data
    ]);
  }

  noteStmt.free();
  cardStmt.free();

  // ---------------------------------------------------------------------------
  // Export SQLite → ZIP
  // ---------------------------------------------------------------------------

  const sqliteBytes = db.export();
  db.close();

  // Build media manifest and add media files to ZIP if provided.
  const zipContents: Record<string, Uint8Array> = {
    'collection.anki2': sqliteBytes,
  };

  if (exportMedia && exportMedia.size > 0) {
    const mediaManifest: Record<string, string> = {};
    let intKey = 0;
    for (const [filename, fileBytes] of exportMedia) {
      mediaManifest[String(intKey)] = filename;
      zipContents[String(intKey)] = fileBytes;
      intKey++;
    }
    zipContents['media'] = strToU8(JSON.stringify(mediaManifest));
  } else {
    zipContents['media'] = strToU8('{}');
  }

  // Wrap in a fresh Uint8Array<ArrayBuffer> (not SharedArrayBuffer) so callers can pass it to new Blob([...]).
  return new Uint8Array(zipSync(zipContents));
}

// ---------------------------------------------------------------------------
// Convenience re-exports / helpers used by AnkiExportWizard.svelte
// ---------------------------------------------------------------------------

/**
 * Get all facts for a deck — synchronous wrapper around curatedDeckStore.getCuratedDeckFacts().
 * Exported here so the export wizard can import from a single service module.
 * Returns an empty array if the deck is not loaded (must be pre-loaded at startup).
 * Sync on purpose — the component does not await this call.
 */
export function getCuratedDeckFacts(deckId: string): DeckFact[] {
  // Dynamic import is not used here — curatedDeckStore is a pure module with no circular dep.
  // We call the store directly via a static import reference captured at module load.
  return _curatedDeckFacts(deckId);
}

/** Cached reference populated via lazy static import to avoid circular deps at module load. */
let _curatedDeckFacts: (deckId: string, subDeckId?: string) => DeckFact[] = () => [];
// Lazy init: populate the reference on first call.
(async () => {
  try {
    const m = await import('../data/curatedDeckStore');
    _curatedDeckFacts = m.getCuratedDeckFacts;
  } catch {
    // Not critical — export wizard will fall back to personalDeckStore.
  }
})();

/**
 * Look up review states for a set of facts from the current player save.
 * Returns a Map keyed by factId for facts that have scheduling data.
 * Sync on purpose — the component does not await this call.
 */
export function getReviewStatesForDeck(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  facts: any[],
): ReviewState[] {
  // Access the playerSave store synchronously.
  const save = _playerSaveGetter?.();
  if (!save) return [];

  const factIds = new Set((facts as Array<{ id: string }>).map(f => f.id));
  return save.reviewStates.filter(rs => factIds.has(rs.factId));
}

/** Lazily-cached accessor for the playerSave store value. */
let _playerSaveGetter: (() => PlayerSave | null) | null = null;
(async () => {
  try {
    const { get } = await import('svelte/store');
    const { playerSave } = await import('../ui/stores/playerData');
    _playerSaveGetter = () => get(playerSave);
  } catch {
    // Not critical.
  }
})();
