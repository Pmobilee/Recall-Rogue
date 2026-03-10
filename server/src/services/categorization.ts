/**
 * LLM-powered fact categorization service for the Recall Rogue content engine.
 * Assigns L1/L2/L3 categories, tags, and related fact links using Claude.
 * Falls back to safe defaults on LLM errors.
 */

import Anthropic from "@anthropic-ai/sdk";
import { factsDb } from "../db/facts-db.js";
import { config } from "../config.js";

/** Valid top-level (L1) content categories. */
export const VALID_L1_CATEGORIES = [
  "Natural Sciences",
  "Life Sciences",
  "History",
  "Geography",
  "Technology",
  "Culture",
  "Language",
] as const;

export type CategoryL1 = (typeof VALID_L1_CATEGORIES)[number];

/** Result of a categorization operation. */
export interface CategorizationResult {
  /** Top-level category. */
  categoryL1: string;
  /** Sub-category within L1. */
  categoryL2: string;
  /** Tertiary category within L2. */
  categoryL3: string;
  /** Descriptive tags for the fact. */
  tags: string[];
  /** IDs of related facts found in the database. */
  relatedFactIds: string[];
  /** Confidence in the categorization (0-1). */
  confidence: number;
  /** True if human review is recommended. */
  needsReview: boolean;
}

/** Row returned from the facts sample query. */
interface FactSampleRow {
  id: string;
  statement: string;
  category_l1: string;
  category_l2: string;
}

/** Raw LLM output shape for categorization. */
interface LLMCategorizationOutput {
  categoryL1: string;
  categoryL2: string;
  categoryL3: string;
  tags: string[];
  relatedFactIds: string[];
  confidence: number;
  reasoning?: string;
}

/** Safe defaults returned when categorization fails. */
const SAFE_DEFAULTS: CategorizationResult = {
  categoryL1: "",
  categoryL2: "",
  categoryL3: "",
  tags: [],
  relatedFactIds: [],
  confidence: 0,
  needsReview: true,
};

/**
 * Categorize a fact using Claude LLM.
 * Assigns L1/L2/L3 taxonomy, tags, and related fact references.
 * Returns safe defaults with needsReview=true on any error.
 *
 * @param factId      - The ID of the fact being categorized (used for logging).
 * @param statement   - The main fact statement text.
 * @param explanation - Optional explanation for richer context.
 * @returns A CategorizationResult with taxonomy and metadata.
 */
export async function categorizeFact(
  factId: string,
  statement: string,
  explanation?: string
): Promise<CategorizationResult> {
  if (!config.anthropicApiKey) {
    return SAFE_DEFAULTS;
  }

  // Pull 30 random approved facts for related-fact matching context
  const sampleFacts = factsDb
    .prepare(
      `SELECT id, statement, category_l1, category_l2
       FROM facts
       WHERE status = 'approved'
         AND id != ?
       ORDER BY RANDOM()
       LIMIT 30`
    )
    .all(factId) as FactSampleRow[];

  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const sampleText =
    sampleFacts.length > 0
      ? sampleFacts
          .map(
            (f) =>
              `ID=${f.id} [${f.category_l1} > ${f.category_l2}]: ${f.statement}`
          )
          .join("\n")
      : "(No existing facts available for comparison)";

  const factText = explanation
    ? `Statement: ${statement}\nExplanation: ${explanation}`
    : `Statement: ${statement}`;

  const prompt = `You are a taxonomy expert for an educational fact database.

Categorize the following fact into the taxonomy system:

${factText}

## Valid L1 Categories (choose exactly one):
${VALID_L1_CATEGORIES.join(", ")}

## Taxonomy examples:
- Natural Sciences > Physics > Quantum Mechanics
- Life Sciences > Marine Biology > Deep Sea Creatures
- History > Ancient Civilizations > Egyptian Empire
- Geography > Geomorphology > Volcanic Features
- Technology > Computing > Artificial Intelligence
- Culture > Music > Classical Composition
- Language > Etymology > Latin Roots

## Sample existing facts (for related-fact matching):
${sampleText}

Return ONLY a JSON object with this exact shape:
{
  "categoryL1": "<one of the valid L1 categories>",
  "categoryL2": "<sub-category>",
  "categoryL3": "<tertiary category>",
  "tags": ["tag1", "tag2", "tag3"],
  "relatedFactIds": ["<id of related fact from sample if similarity >= 0.6>"],
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation of categorization>"
}

Rules:
- categoryL1 MUST be one of the 7 valid options listed above
- categoryL2 and categoryL3 should be specific but not overly narrow (2-4 words each)
- tags: 3-7 descriptive tags, lowercase, no spaces (use hyphens)
- relatedFactIds: only include IDs from the sample that are genuinely related (>= 0.6 similarity). May be empty.
- confidence: your confidence in the L1 categorization (0.0-1.0)`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON object from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[categorization] No JSON in LLM response for fact ${factId}`);
      return SAFE_DEFAULTS;
    }

    const result = JSON.parse(jsonMatch[0]) as LLMCategorizationOutput;

    // Validate L1 category
    const validL1 = VALID_L1_CATEGORIES.includes(result.categoryL1 as CategoryL1);
    if (!validL1) {
      console.warn(
        `[categorization] Invalid L1 category "${result.categoryL1}" for fact ${factId}, using safe defaults`
      );
      return SAFE_DEFAULTS;
    }

    return {
      categoryL1: result.categoryL1,
      categoryL2: result.categoryL2 ?? "",
      categoryL3: result.categoryL3 ?? "",
      tags: Array.isArray(result.tags) ? result.tags : [],
      relatedFactIds: Array.isArray(result.relatedFactIds)
        ? result.relatedFactIds
        : [],
      confidence: typeof result.confidence === "number" ? result.confidence : 0,
      needsReview: (result.confidence ?? 0) < 0.75,
    };
  } catch (err) {
    console.error(`[categorization] LLM error for fact ${factId}:`, err);
    return { ...SAFE_DEFAULTS, needsReview: true };
  }
}
