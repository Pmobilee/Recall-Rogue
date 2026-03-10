/**
 * Semantic duplicate detection service for the Recall Rogue fact content engine.
 * Uses Claude API to detect near-duplicate facts before ingestion.
 * Fails open on LLM errors to avoid blocking content pipeline.
 */

import Anthropic from "@anthropic-ai/sdk";
import { factsDb } from "../db/facts-db.js";
import { config } from "../config.js";

/** Result of a duplicate check operation. */
export interface DuplicateCheckResult {
  /** Whether a semantically similar fact already exists. */
  isDuplicate: boolean;
  /** ID of the similar fact, if found. */
  similarFactId?: string;
  /** Similarity score 0-1, if a duplicate was found. */
  similarity?: number;
}

/** Row shape returned from facts query. */
interface FactRow {
  id: string;
  statement: string;
}

/** Shape of LLM comparison result per fact. */
interface ComparisonResult {
  factId: string;
  similarity: number;
}

/**
 * Check whether a fact statement is semantically similar to existing approved facts.
 * Uses Claude to compare against facts in the same L1 category.
 * Fails open (returns isDuplicate=false) on any LLM error.
 *
 * @param statement   - The new fact statement to check.
 * @param categoryL1  - The L1 category to search within.
 * @param threshold   - Similarity score threshold (0-1) to flag as duplicate. Default 0.85.
 * @returns A DuplicateCheckResult indicating whether a duplicate was found.
 */
export async function checkDuplicate(
  statement: string,
  categoryL1: string,
  threshold = 0.85
): Promise<DuplicateCheckResult> {
  // Skip in dev when no API key is configured
  if (!config.anthropicApiKey) {
    return { isDuplicate: false };
  }

  // Pull up to 50 approved facts from the same category
  const existingFacts = factsDb
    .prepare(
      `SELECT id, statement
       FROM facts
       WHERE status = 'approved'
         AND category_l1 = ?
       ORDER BY RANDOM()
       LIMIT 50`
    )
    .all(categoryL1) as FactRow[];

  if (existingFacts.length === 0) {
    return { isDuplicate: false };
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const factsListText = existingFacts
    .map((f, i) => `[${i}] ID=${f.id}: ${f.statement}`)
    .join("\n");

  const prompt = `You are a semantic duplicate detector for an educational fact database.

New fact to check:
"${statement}"

Existing approved facts in the same category:
${factsListText}

For each existing fact, rate the semantic similarity to the new fact on a scale of 0.0 to 1.0, where:
- 1.0 = identical meaning, just rephrased
- 0.85+ = substantially the same fact / same core claim
- 0.5 = partially overlapping but distinct facts
- 0.0 = completely different facts

Return ONLY a JSON array of objects with this exact shape:
[{"factId": "<id>", "similarity": <number>}, ...]

Only include facts with similarity >= 0.5 to keep the response short.
If no facts have similarity >= 0.5, return an empty array: []`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from the response (may have markdown fences)
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { isDuplicate: false };
    }

    const results = JSON.parse(jsonMatch[0]) as ComparisonResult[];

    // Find highest similarity result
    let maxSimilarity = 0;
    let mostSimilarFactId: string | undefined;

    for (const result of results) {
      if (result.similarity > maxSimilarity) {
        maxSimilarity = result.similarity;
        mostSimilarFactId = result.factId;
      }
    }

    if (maxSimilarity >= threshold && mostSimilarFactId) {
      return {
        isDuplicate: true,
        similarFactId: mostSimilarFactId,
        similarity: maxSimilarity,
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    // Fail open — don't block ingestion on LLM errors
    console.error("[deduplication] LLM error, failing open:", err);
    return { isDuplicate: false };
  }
}
