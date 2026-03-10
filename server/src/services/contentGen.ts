/**
 * Full content generation pipeline for the Recall Rogue fact content engine.
 * Orchestrates 2-pass LLM generation (content + distractor validation),
 * fact extraction from raw passages, and DB persistence.
 */

import Anthropic from "@anthropic-ai/sdk";
import { factsDb } from "../db/facts-db.js";
import { config } from "../config.js";
import {
  buildFactGenerationPrompt,
  buildDistractorValidationPrompt,
} from "./llmPrompts.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single distractor entry from LLM output. */
interface DistractorInput {
  text: string;
  difficultyTier: "easy" | "medium" | "hard";
}

/** Full generated content for a fact, as returned by LLM. */
export interface GeneratedFactContent {
  wowFactor: string;
  explanation: string;
  alternateExplanations: string[];
  quizQuestion: string;
  correctAnswer: string;
  acceptableAnswers: string[];
  gaiaComments: Array<{ variant: string; text: string }>;
  gaiaWrongComments: { snarky: string; enthusiastic: string; calm: string };
  mnemonic: string;
  imagePrompt: string;
  visualDescription: string;
  funScore: number;
  noveltyScore: number;
  difficulty: number;
  ageRating: string;
  sensitivityLevel: number;
  sensitivityNote: string | null;
  /** Distractors enriched with confidence scores from validation pass. */
  distractors: Array<{
    text: string;
    difficultyTier: string;
    confidence: number;
  }>;
}

/** A fact extracted from a raw passage. */
export interface ExtractedFact {
  statement: string;
  quizQuestion: string;
  correctAnswer: string;
  categoryHint?: string;
}


// ── Main generation function ──────────────────────────────────────────────────

/**
 * Generate full quiz content for a fact using a 2-pass LLM pipeline.
 * Pass 1: Generate all content fields + raw distractors.
 * Pass 2: Score each distractor for quality confidence.
 *
 * @param statement   - The core fact statement.
 * @param categoryL1  - Top-level category (e.g. "Natural Sciences").
 * @param categoryL2  - Sub-category (e.g. "Physics").
 * @returns Generated content ready for persistence.
 * @throws If the Anthropic API key is not configured.
 */
export async function generateFactContent(
  statement: string,
  categoryL1 = "",
  categoryL2 = ""
): Promise<GeneratedFactContent> {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured — cannot generate content"
    );
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  // ── Pass 1: Content generation ───────────────────────────────────────────────
  const generationPrompt = buildFactGenerationPrompt({
    statement,
    categoryL1: categoryL1 || undefined,
    categoryL2: categoryL2 || undefined,
  });

  const pass1Response = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: generationPrompt }],
  });

  const pass1Text =
    pass1Response.content[0].type === "text"
      ? pass1Response.content[0].text
      : "";

  // Extract JSON from response (may be wrapped in markdown fences)
  const jsonMatch = pass1Text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM generation response contained no JSON object");
  }

  const generated = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  const rawDistractors = (
    Array.isArray(generated.distractors) ? generated.distractors : []
  ) as DistractorInput[];

  // ── Pass 2: Distractor validation ────────────────────────────────────────────
  const correctAnswer =
    typeof generated.correctAnswer === "string" ? generated.correctAnswer : "";

  const distractorTexts = rawDistractors.map((d) => d.text);

  const validationPrompt = buildDistractorValidationPrompt(
    correctAnswer,
    distractorTexts
  );

  let confidenceScores: number[] = rawDistractors.map(() => 1.0);

  try {
    const pass2Response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: validationPrompt }],
    });

    const pass2Text =
      pass2Response.content[0].type === "text"
        ? pass2Response.content[0].text
        : "";

    const scoresMatch = pass2Text.match(/\[[\s\S]*\]/);
    if (scoresMatch) {
      const parsed = JSON.parse(scoresMatch[0]) as number[];
      if (Array.isArray(parsed) && parsed.length === rawDistractors.length) {
        confidenceScores = parsed;
      }
    }
  } catch (err) {
    // Non-fatal: use default confidence scores if validation fails
    console.warn("[contentGen] Distractor validation failed, using defaults:", err);
  }

  // Merge distractor data with confidence scores
  const distractors = rawDistractors.map((d, i) => ({
    text: d.text,
    difficultyTier: d.difficultyTier ?? "medium",
    confidence: confidenceScores[i] ?? 1.0,
  }));

  return {
    wowFactor: (generated.wowFactor as string) ?? "",
    explanation: (generated.explanation as string) ?? "",
    alternateExplanations: Array.isArray(generated.alternateExplanations)
      ? (generated.alternateExplanations as string[])
      : [],
    quizQuestion: (generated.quizQuestion as string) ?? "",
    correctAnswer,
    acceptableAnswers: Array.isArray(generated.acceptableAnswers)
      ? (generated.acceptableAnswers as string[])
      : [],
    gaiaComments: Array.isArray(generated.gaiaComments)
      ? (generated.gaiaComments as Array<{ variant: string; text: string }>)
      : [],
    gaiaWrongComments:
      typeof generated.gaiaWrongComments === "object" &&
      generated.gaiaWrongComments !== null
        ? (generated.gaiaWrongComments as {
            snarky: string;
            enthusiastic: string;
            calm: string;
          })
        : { snarky: "", enthusiastic: "", calm: "" },
    mnemonic: (generated.mnemonic as string) ?? "",
    imagePrompt: (generated.imagePrompt as string) ?? "",
    visualDescription: (generated.visualDescription as string) ?? "",
    funScore: typeof generated.funScore === "number" ? generated.funScore : 5,
    noveltyScore:
      typeof generated.noveltyScore === "number" ? generated.noveltyScore : 5,
    difficulty:
      typeof generated.difficulty === "number" ? generated.difficulty : 3,
    ageRating:
      typeof generated.ageRating === "string" ? generated.ageRating : "teen",
    sensitivityLevel:
      typeof generated.sensitivityLevel === "number"
        ? generated.sensitivityLevel
        : 0,
    sensitivityNote:
      typeof generated.sensitivityNote === "string"
        ? generated.sensitivityNote
        : null,
    distractors,
  };
}

// ── Passage extraction ────────────────────────────────────────────────────────

/**
 * Extract individual facts from a raw text passage using Claude.
 * Useful for processing articles, Wikipedia excerpts, or study materials.
 *
 * @param passage    - The raw text to extract facts from.
 * @param sourceName - Attribution name for the extracted facts.
 * @param sourceUrl  - Optional source URL for attribution.
 * @returns An array of extracted facts ready for ingestion.
 */
export async function extractFactsFromPassage(
  passage: string,
  sourceName: string,
  sourceUrl?: string
): Promise<ExtractedFact[]> {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured — cannot extract facts"
    );
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const sourceInfo = sourceUrl
    ? `Source: ${sourceName} (${sourceUrl})`
    : `Source: ${sourceName}`;

  const prompt = `You are a fact extraction specialist for an educational quiz game.

${sourceInfo}

Extract up to 10 interesting, stand-alone facts from the following passage.
Each fact should be:
- Self-contained (understandable without the passage context)
- Factually verifiable
- Interesting enough to be worth learning
- Suitable for a quiz question

Passage:
"""
${passage}
"""

Return ONLY a JSON array of fact objects:
[
  {
    "statement": "<the fact as a clear, concise statement>",
    "quizQuestion": "<a question whose answer is embedded in the statement>",
    "correctAnswer": "<the specific answer, 1-10 words>",
    "categoryHint": "<suggested category: Natural Sciences|Life Sciences|History|Geography|Technology|Culture|Language>"
  }
]

If the passage contains fewer than 10 extractable facts, return fewer.
Return [] if no suitable facts are found.
Return ONLY the JSON array, no preamble.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  try {
    const facts = JSON.parse(jsonMatch[0]) as ExtractedFact[];
    return Array.isArray(facts) ? facts : [];
  } catch {
    return [];
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Persist generated fact content to the database.
 * Updates the fact row with all generated fields and inserts distractors.
 * Also updates distractor_count on the parent fact row.
 *
 * @param factId  - The ID of the fact to update.
 * @param content - The generated content from generateFactContent().
 */
export function persistGeneratedContent(
  factId: string,
  content: GeneratedFactContent
): void {
  const now = Date.now();

  // Update the fact row with all generated fields
  factsDb
    .prepare(
      `UPDATE facts SET
        wow_factor           = ?,
        explanation          = ?,
        alternate_explanations = ?,
        quiz_question        = ?,
        correct_answer       = ?,
        acceptable_answers   = ?,
        gaia_comments        = ?,
        gaia_wrong_comments  = ?,
        mnemonic             = ?,
        image_prompt         = ?,
        visual_description   = ?,
        fun_score            = ?,
        novelty_score        = ?,
        difficulty           = ?,
        age_rating           = ?,
        sensitivity_level    = ?,
        sensitivity_note     = ?,
        updated_at           = ?
      WHERE id = ?`
    )
    .run(
      content.wowFactor,
      content.explanation,
      JSON.stringify(content.alternateExplanations),
      content.quizQuestion,
      content.correctAnswer,
      JSON.stringify(content.acceptableAnswers),
      JSON.stringify(content.gaiaComments),
      JSON.stringify(content.gaiaWrongComments),
      content.mnemonic,
      content.imagePrompt,
      content.visualDescription,
      content.funScore,
      content.noveltyScore,
      content.difficulty,
      content.ageRating,
      content.sensitivityLevel,
      content.sensitivityNote,
      now,
      factId
    );

  // Insert distractors
  const insertDistractor = factsDb.prepare(
    `INSERT INTO distractors (fact_id, text, difficulty_tier, distractor_confidence, is_approved)
     VALUES (?, ?, ?, ?, 1)`
  );

  for (const d of content.distractors) {
    insertDistractor.run(factId, d.text, d.difficultyTier, d.confidence);
  }

  // Update distractor count on the fact
  factsDb
    .prepare(
      `UPDATE facts
       SET distractor_count = (SELECT COUNT(*) FROM distractors WHERE fact_id = ?),
           updated_at = ?
       WHERE id = ?`
    )
    .run(factId, now, factId);

  console.log(
    `[contentGen] Persisted generated content for fact ${factId} (${content.distractors.length} distractors)`
  );
}
