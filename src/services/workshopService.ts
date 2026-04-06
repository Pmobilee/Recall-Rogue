/**
 * Steam Workshop deck sharing service for Recall Rogue.
 *
 * Manages publishing, subscribing to, and browsing Steam Workshop items that
 * contain personal decks (imported Anki decks or manually created decks).
 *
 * Architecture:
 * - serialize/deserialize functions are fully implemented (pure, testable).
 * - Steam API functions check isWorkshopAvailable() and stub with TODO comments
 *   until Tauri commands for Steamworks UGC are wired.
 *
 * Workshop item layout on disk (managed by Steamworks UGC):
 *   <ugc-content-dir>/<workshopId>/deck.json   — WorkshopDeckPackage JSON
 *
 * See docs/content/anki-integration.md §Workshop for full spec.
 */

import type { PersonalDeck } from '../data/curatedDeckTypes';
import type { ReviewState } from '../data/types';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** A published Steam Workshop deck item (metadata only — no fact content). */
export interface WorkshopDeck {
  /** Steam Workshop item ID (UGC fileId as string). */
  workshopId: string;
  /** Local deck ID assigned on subscription. */
  deckId: string;
  /** Display title set by the author at publish time. */
  title: string;
  /** Free-text description shown in the Workshop browser. */
  description: string;
  /** Tags for filtering, e.g. ["japanese", "vocabulary", "anki-import"]. */
  tags: string[];
  /** Steam ID of the publishing player. */
  authorSteamId: string;
  /** Display name of the publishing player. */
  authorName: string;
  /** Total subscribers. */
  subscriberCount: number;
  /** Upvotes. */
  upvotes: number;
  /** Downvotes. */
  downvotes: number;
  /** Unix timestamp (seconds) when the item was first published. */
  createdAt: number;
  /** Unix timestamp (seconds) when the item was last updated. */
  updatedAt: number;
}

/**
 * Wire format used when publishing or subscribing to a Workshop deck.
 * Serialized to JSON and stored in the Workshop item content directory.
 *
 * version 1 — current schema.
 */
export interface WorkshopDeckPackage {
  version: 1;
  deck: {
    id: string;
    name: string;
    description: string;
    domain: 'personal';
    facts: Array<{
      id: string;
      quizQuestion: string;
      correctAnswer: string;
      explanation: string;
      distractors: string[];
      difficulty: number;
      funScore: number;
    }>;
  };
  /**
   * Optional FSRS review states — included when the author chooses
   * "Share progress" so subscribers can continue from the same scheduling.
   */
  reviewStates?: Array<{
    factId: string;
    state: string;
    reps: number;
    lapses: number;
    interval: number;
    stability: number;
    difficulty: number;
    due: number;
    lastReview: number;
  }>;
  metadata: {
    /** Unix timestamp (ms) when the package was serialized. */
    exportedAt: number;
    sourceApp: 'recall-rogue';
    factCount: number;
    /** Original Anki deck name, if the deck was created via Anki import. */
    ankiDeckName?: string;
  };
}

// ---------------------------------------------------------------------------
// Pure serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize a PersonalDeck into the WorkshopDeckPackage wire format.
 * Strips internal-only fields and normalizes to the minimal shared format.
 * Pure function — no side effects.
 *
 * @param deck - The PersonalDeck to export.
 * @param reviewStates - Optional FSRS states for this deck's facts.
 * @param includeScheduling - When true, review states are bundled into the package.
 */
export function serializeDeckForWorkshop(
  deck: PersonalDeck,
  reviewStates?: ReviewState[],
  includeScheduling?: boolean,
): WorkshopDeckPackage {
  const factIdSet = new Set(deck.facts.map(f => f.id));

  const serializedFacts = deck.facts.map(f => ({
    id: f.id,
    quizQuestion: f.quizQuestion,
    correctAnswer: f.correctAnswer,
    explanation: f.explanation ?? '',
    distractors: f.distractors ?? [],
    difficulty: f.difficulty,
    funScore: f.funScore,
  }));

  let serializedStates: WorkshopDeckPackage['reviewStates'];
  if (includeScheduling && reviewStates && reviewStates.length > 0) {
    serializedStates = reviewStates
      .filter(rs => factIdSet.has(rs.factId))
      .map(rs => ({
        factId: rs.factId,
        state: rs.state ?? rs.cardState ?? 'new',
        reps: rs.reps ?? rs.repetitions ?? 0,
        lapses: rs.lapses ?? rs.lapseCount ?? 0,
        interval: rs.interval ?? 0,
        stability: rs.stability ?? 0,
        difficulty: rs.difficulty ?? 5,
        due: rs.due ?? rs.nextReviewAt ?? Date.now(),
        lastReview: rs.lastReview ?? rs.lastReviewAt ?? Date.now(),
      }));
  }

  return {
    version: 1,
    deck: {
      id: deck.id,
      name: deck.name,
      description: deck.description ?? '',
      domain: 'personal',
      facts: serializedFacts,
    },
    reviewStates: serializedStates,
    metadata: {
      exportedAt: Date.now(),
      sourceApp: 'recall-rogue',
      factCount: deck.facts.length,
      ankiDeckName: deck.ankiDeckName,
    },
  };
}

/**
 * Deserialize a WorkshopDeckPackage back into a PersonalDeck and optional
 * ReviewState array.
 *
 * Fact IDs are prefixed with `ws_` to avoid collisions with local anki-imported
 * facts that share the same original ID. The deckId is set to `newDeckId`.
 *
 * Pure function — no side effects.
 *
 * @param pkg - The downloaded WorkshopDeckPackage.
 * @param newDeckId - Local deck ID to assign (caller generates this).
 */
export function deserializeWorkshopDeck(
  pkg: WorkshopDeckPackage,
  newDeckId: string,
): { deck: PersonalDeck; reviewStates: ReviewState[] } {
  // Map old fact IDs → new prefixed IDs to avoid collisions.
  const idMap = new Map<string, string>();
  for (const f of pkg.deck.facts) {
    idMap.set(f.id, `ws_${f.id}`);
  }

  const facts = pkg.deck.facts.map(f => ({
    id: idMap.get(f.id) ?? `ws_${f.id}`,
    quizQuestion: f.quizQuestion,
    correctAnswer: f.correctAnswer,
    explanation: f.explanation,
    distractors: f.distractors,
    difficulty: f.difficulty,
    funScore: f.funScore,
    // Required DeckFact fields — use sensible defaults for Workshop imports.
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'workshop_default',
    visualDescription: '',
    sourceName: 'Steam Workshop',
    quizResponseMode: 'typing' as const,
  }));

  const answerTypePools = [{
    id: 'workshop_default',
    label: 'All Cards',
    answerFormat: 'term',
    factIds: facts.map(f => f.id),
    minimumSize: 5,
  }];

  const deck: PersonalDeck = {
    id: newDeckId,
    name: pkg.deck.name,
    description: pkg.deck.description,
    domain: 'personal',
    facts,
    answerTypePools,
    synonymGroups: [],
    questionTemplates: [],
    difficultyTiers: [],
    minimumFacts: 1,
    targetFacts: facts.length,
    source: 'anki_import', // closest existing source type; workshop is treated like a manual import
    importedAt: Date.now(),
    ankiDeckName: pkg.metadata.ankiDeckName,
    cardCount: facts.length,
  };

  const reviewStates: ReviewState[] = (pkg.reviewStates ?? []).map(rs => {
    const newFactId = idMap.get(rs.factId) ?? `ws_${rs.factId}`;
    return {
      factId: newFactId,
      cardState: (rs.state as ReviewState['cardState']) ?? 'new',
      easeFactor: 2.5,
      interval: rs.interval ?? 0,
      repetitions: rs.reps ?? 0,
      nextReviewAt: rs.due ?? Date.now(),
      lastReviewAt: rs.lastReview ?? Date.now(),
      quality: 0,
      learningStep: 0,
      lapseCount: rs.lapses ?? 0,
      isLeech: (rs.lapses ?? 0) >= 8,
      stability: rs.stability,
      difficulty: rs.difficulty,
      reps: rs.reps,
      lapses: rs.lapses,
      state: (rs.state as ReviewState['state']) ?? 'new',
      due: rs.due,
      lastReview: rs.lastReview,
    };
  });

  return { deck, reviewStates };
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the Steam Workshop API is accessible.
 * Requires running inside Tauri (desktop build) with Steamworks active.
 *
 * In a plain browser or Capacitor build this always returns false.
 */
export function isWorkshopAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// ---------------------------------------------------------------------------
// Workshop API — Steam UGC calls
// ---------------------------------------------------------------------------
// These functions stub the Steamworks UGC API until Tauri commands are wired.
// Each function checks isWorkshopAvailable() first and returns an error object
// if Workshop is not available, keeping callers safe on all platforms.
//
// TODO: Wire Tauri commands for Steamworks UGC API
//   - steam_ugc_create_item        → create + upload a new Workshop item
//   - steam_ugc_update_item        → update title/description/content of existing item
//   - steam_ugc_subscribe          → subscribe + trigger download of a Workshop item
//   - steam_ugc_browse             → query Workshop items (search, tags, sorting)
//   - steam_ugc_get_my_items       → list the current user's published items
//   - steam_ugc_get_item_path      → get local content directory for downloaded item
//
// The Rust backend should use steamworks-sys or the steamworks crate's UGC API.
// Each command receives/returns plain JSON-serializable types.

/**
 * Publish a deck to the Steam Workshop.
 *
 * Creates a temporary package file, calls the Steamworks UGC create/update API
 * via Tauri IPC, and returns the Workshop item ID on success.
 *
 * @param deck - PersonalDeck to publish.
 * @param title - Workshop item title (visible in the Workshop browser).
 * @param description - Free-text description.
 * @param tags - Tag strings for filtering.
 * @param reviewStates - Optional FSRS states to bundle with the deck.
 * @returns `{ workshopId }` on success or `{ error }` on failure.
 */
export async function publishToWorkshop(
  deck: PersonalDeck,
  title: string,
  description: string,
  tags: string[],
  reviewStates?: ReviewState[],
): Promise<{ workshopId: string } | { error: string }> {
  if (!isWorkshopAvailable()) {
    return { error: 'Workshop not available — requires Steam desktop build' };
  }

  // TODO: Wire Tauri commands for Steamworks UGC API
  // Intended implementation:
  //   const pkg = serializeDeckForWorkshop(deck, reviewStates, true);
  //   const pkgJson = JSON.stringify(pkg);
  //   const { invoke } = await import('@tauri-apps/api/core');
  //   return await invoke<{ workshopId: string } | { error: string }>(
  //     'steam_ugc_create_item',
  //     { title, description, tags, contentJson: pkgJson },
  //   );
  console.warn('[workshopService] publishToWorkshop: Steamworks UGC Tauri commands not yet wired');
  return { error: 'Workshop publishing not yet implemented — Tauri commands pending' };
}

/**
 * Subscribe to a Workshop deck and import it as a personal deck.
 *
 * Triggers the Steamworks UGC download, reads the deck.json from the local
 * content directory, deserializes it, and returns identifying info for the
 * newly created personal deck.
 *
 * @param workshopId - Steam Workshop item ID (UGC fileId).
 * @returns `{ deckId, deckName }` on success or `{ error }` on failure.
 */
export async function subscribeToWorkshopDeck(
  workshopId: string,
): Promise<{ deckId: string; deckName: string } | { error: string }> {
  if (!isWorkshopAvailable()) {
    return { error: 'Workshop not available — requires Steam desktop build' };
  }

  // TODO: Wire Tauri commands for Steamworks UGC API
  // Intended implementation:
  //   const { invoke } = await import('@tauri-apps/api/core');
  //   // Trigger download/subscribe and get local content path
  //   const contentPath = await invoke<string | null>('steam_ugc_subscribe', { workshopId });
  //   if (!contentPath) return { error: 'Failed to download Workshop item' };
  //   // Read the deck package JSON from disk
  //   const pkgJson = await invoke<string | null>('fs_read_save', { filename: `${contentPath}/deck.json` });
  //   if (!pkgJson) return { error: 'Workshop item missing deck.json' };
  //   const pkg = JSON.parse(pkgJson) as WorkshopDeckPackage;
  //   const newDeckId = `ws_${workshopId}_${Date.now().toString(36)}`;
  //   const { deck, reviewStates } = deserializeWorkshopDeck(pkg, newDeckId);
  //   // Persist and register the deck (caller must call savePersonalDeck + mergeReviewStates)
  //   return { deckId: deck.id, deckName: deck.name };
  console.warn('[workshopService] subscribeToWorkshopDeck: Steamworks UGC Tauri commands not yet wired');
  return { error: 'Workshop subscribe not yet implemented — Tauri commands pending' };
}

/**
 * Browse Workshop decks by query and/or tags.
 * Returns metadata objects only — no fact content is downloaded.
 *
 * @param query - Optional text search query.
 * @param tags - Optional tag filter array.
 * @param page - Pagination page number (1-based, default 1).
 * @returns Array of WorkshopDeck metadata (empty on error or unavailable).
 */
export async function browseWorkshopDecks(
  query?: string,
  tags?: string[],
  page?: number,
): Promise<WorkshopDeck[]> {
  if (!isWorkshopAvailable()) return [];

  // TODO: Wire Tauri commands for Steamworks UGC API
  // Intended implementation:
  //   const { invoke } = await import('@tauri-apps/api/core');
  //   return await invoke<WorkshopDeck[]>('steam_ugc_browse', { query, tags, page: page ?? 1 }) ?? [];
  console.warn('[workshopService] browseWorkshopDecks: Steamworks UGC Tauri commands not yet wired');
  return [];
}

/**
 * Fetch the current player's published Workshop decks.
 * Returns an empty array on failure or unavailable.
 */
export async function getMyPublishedDecks(): Promise<WorkshopDeck[]> {
  if (!isWorkshopAvailable()) return [];

  // TODO: Wire Tauri commands for Steamworks UGC API
  // Intended implementation:
  //   const { invoke } = await import('@tauri-apps/api/core');
  //   return await invoke<WorkshopDeck[]>('steam_ugc_get_my_items') ?? [];
  console.warn('[workshopService] getMyPublishedDecks: Steamworks UGC Tauri commands not yet wired');
  return [];
}

/**
 * Update an existing Workshop item's title, description, tags, and deck content.
 *
 * @param workshopId - Steam Workshop item ID to update.
 * @param deck - Updated PersonalDeck.
 * @param title - New title.
 * @param description - New description.
 * @param tags - New tag array.
 * @returns `{ success: true }` on success or `{ error }` on failure.
 */
export async function updateWorkshopDeck(
  workshopId: string,
  deck: PersonalDeck,
  title: string,
  description: string,
  tags: string[],
): Promise<{ success: boolean } | { error: string }> {
  if (!isWorkshopAvailable()) {
    return { error: 'Workshop not available — requires Steam desktop build' };
  }

  // TODO: Wire Tauri commands for Steamworks UGC API
  // Intended implementation:
  //   const pkg = serializeDeckForWorkshop(deck);
  //   const pkgJson = JSON.stringify(pkg);
  //   const { invoke } = await import('@tauri-apps/api/core');
  //   return await invoke<{ success: boolean } | { error: string }>(
  //     'steam_ugc_update_item',
  //     { workshopId, title, description, tags, contentJson: pkgJson },
  //   ) ?? { error: 'No response from Tauri' };
  console.warn('[workshopService] updateWorkshopDeck: Steamworks UGC Tauri commands not yet wired');
  return { error: 'Workshop update not yet implemented — Tauri commands pending' };
}
