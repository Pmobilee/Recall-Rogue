/**
 * Zod runtime schemas for curated deck data decoded from curated.db.
 *
 * These schemas guard the decode boundary in curatedDeckStore.ts — every JSON.parse
 * result is validated before being used as a typed object. This closes the class of
 * silent-decode bugs where SQLite stores data with wrong types (e.g. numeric arrays
 * when string arrays are expected).
 *
 * The "fifa numeric distractors" incident: JSON.parse(row['distractors']) returned
 * number[] while the type system assumed string[]. Zod catches this at the boundary
 * and the affected fact is skipped with a structured warning rather than silently
 * corrupting the distractor pool.
 *
 * Design contract:
 * - parseDeckFact / parseAnswerTypePool / parseSynonymGroup return null on failure.
 * - null means "skip this row" — callers must filter nulls from the result array.
 * - Failures are logged with deck/fact context so they are discoverable.
 * - The store counts and reports total skipped rows at the end of initialization.
 */

import { z } from 'zod';
import type { DeckFact, AnswerTypePool, SynonymGroup } from './curatedDeckTypes';

// ---------------------------------------------------------------------------
// DeckFact schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for DeckFact.
 * Uses passthrough() to tolerate unknown fields — forward compatibility
 * with new fields added to the JSON before the schema is updated.
 * The load-bearing check is distractors: z.array(z.string()) which rejects
 * numeric arrays (the fifa regression).
 */
export const DeckFactSchema = z.object({
  id: z.string(),
  correctAnswer: z.string(),
  acceptableAlternatives: z.array(z.string()).default([]),
  synonymGroupId: z.string().optional(),
  chainThemeId: z.number(),
  answerTypePoolId: z.string(),
  difficulty: z.number(),
  funScore: z.number(),
  quizQuestion: z.string(),
  explanation: z.string(),
  grammarNote: z.string().optional(),
  displayAsFullForm: z.boolean().optional(),
  fullFormDisplay: z.string().optional(),
  sentenceFurigana: z.array(
    z.object({
      t: z.string(),
      r: z.string().optional(),
      g: z.string().optional(),
    })
  ).optional(),
  sentenceRomaji: z.string().optional(),
  sentenceTranslation: z.string().optional(),
  grammarPointLabel: z.string().optional(),
  visualDescription: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string().optional(),
  volatile: z.boolean().optional(),
  /** THE load-bearing check: rejects numeric distractors (fifa regression). */
  distractors: z.array(z.string()),
  targetLanguageWord: z.string().optional(),
  reading: z.string().optional(),
  language: z.string().optional(),
  pronunciation: z.string().optional(),
  partOfSpeech: z.string().optional(),
  examTags: z.array(z.string()).optional(),
  categoryL1: z.string().optional(),
  categoryL2: z.string().optional(),
  imageAssetPath: z.string().optional(),
  quizMode: z.enum(['text', 'image_question', 'image_answers', 'chess_tactic']).optional(),
  quizResponseMode: z.enum(['choice', 'typing', 'chess_move', 'map_pin']).optional(),
  fenPosition: z.string().optional(),
  solutionMoves: z.array(z.string()).optional(),
  tacticTheme: z.string().optional(),
  lichessRating: z.number().optional(),
  mapCoordinates: z.tuple([z.number(), z.number()]).optional(),
  mapRegion: z.string().optional(),
  mapDifficultyTier: z.number().optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// AnswerTypePool schema
// ---------------------------------------------------------------------------

export const AnswerTypePoolSchema = z.object({
  id: z.string(),
  label: z.string(),
  answerFormat: z.string(),
  factIds: z.array(z.string()),
  minimumSize: z.number(),
  syntheticDistractors: z.array(z.string()).optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// SynonymGroup schema
// ---------------------------------------------------------------------------

export const SynonymGroupSchema = z.object({
  id: z.string(),
  factIds: z.array(z.string()),
  reason: z.string(),
}).passthrough();

// ---------------------------------------------------------------------------
// Parse helpers — return null on failure, log with context
// ---------------------------------------------------------------------------

/**
 * Parse a raw (unknown) object as a DeckFact.
 * Returns null if validation fails, logging the first 3 issues with deck/fact context.
 *
 * @param raw       - The assembled object from rowToDeckFact before schema validation.
 * @param deckId    - The deck ID for context in log messages.
 * @param factId    - The fact ID for context in log messages (may be empty if id field itself is bad).
 */
export function parseDeckFact(raw: unknown, deckId: string, factId: string): DeckFact | null {
  const result = DeckFactSchema.safeParse(raw);
  if (result.success) {
    return result.data as DeckFact;
  }
  const issues = result.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  console.warn(`[CuratedDecks] Schema validation failed for fact "${factId}" in deck "${deckId}": ${issues}`);
  return null;
}

/**
 * Parse a raw (unknown) object as an AnswerTypePool.
 * Returns null if validation fails, logging with deck/pool context.
 */
export function parseAnswerTypePool(raw: unknown, deckId: string, poolId: string): AnswerTypePool | null {
  const result = AnswerTypePoolSchema.safeParse(raw);
  if (result.success) {
    return result.data as AnswerTypePool;
  }
  const issues = result.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  console.warn(`[CuratedDecks] Schema validation failed for pool "${poolId}" in deck "${deckId}": ${issues}`);
  return null;
}

/**
 * Parse a raw (unknown) object as a SynonymGroup.
 * Returns null if validation fails, logging with deck/group context.
 */
export function parseSynonymGroup(raw: unknown, deckId: string, groupId: string): SynonymGroup | null {
  const result = SynonymGroupSchema.safeParse(raw);
  if (result.success) {
    return result.data as SynonymGroup;
  }
  const issues = result.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  console.warn(`[CuratedDecks] Schema validation failed for synonym group "${groupId}" in deck "${deckId}": ${issues}`);
  return null;
}
