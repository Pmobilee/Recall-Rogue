/**
 * Distractor expansion service.
 * Identifies facts with thin distractor coverage and generates
 * additional distractors for the under-represented difficulty tiers.
 * Target: minimum 8 approved distractors (at least 2 per tier).
 */
import Anthropic from "@anthropic-ai/sdk";
import { factsDb } from "../db/facts-db.js";
import { config } from "../config.js";
import type { DistractorTier } from "../types/factTypes.js";

const TARGET_PER_TIER = 2; // minimum approved distractors per tier
const TARGET_TOTAL = 8;    // minimum approved distractors overall

interface DistributionRow {
  difficulty_tier: string;
  count: number;
}

interface FactSummaryRow {
  statement: string;
  quiz_question: string;
  correct_answer: string;
  category_l1: string;
}

/**
 * Compute Jaccard token similarity between two strings (0-1).
 * Used to score distractor proximity to the correct answer without an API call.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Similarity score between 0 and 1.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const tokB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...tokA].filter((t) => tokB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Expand distractors for a single fact up to TARGET_TOTAL approved distractors.
 *
 * @param factId - The fact to expand distractors for.
 * @returns Number of new distractors added.
 */
export async function expandDistractors(factId: string): Promise<number> {
  if (!config.anthropicApiKey) return 0;

  const fact = factsDb
    .prepare(
      `SELECT statement, quiz_question, correct_answer, category_l1
       FROM facts WHERE id = ?`
    )
    .get(factId) as FactSummaryRow | undefined;

  if (!fact) return 0;

  // Count approved distractors per tier
  const dist = factsDb
    .prepare(
      `SELECT difficulty_tier, COUNT(*) as count
       FROM distractors
       WHERE fact_id = ? AND is_approved = 1
       GROUP BY difficulty_tier`
    )
    .all(factId) as DistributionRow[];

  const counts: Record<DistractorTier, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  for (const row of dist) {
    counts[row.difficulty_tier as DistractorTier] = row.count;
  }

  const total = counts.easy + counts.medium + counts.hard;
  if (total >= TARGET_TOTAL) return 0; // Already sufficient

  // Determine what is needed per tier
  const needed: Partial<Record<DistractorTier, number>> = {};
  for (const tier of ["easy", "medium", "hard"] as DistractorTier[]) {
    const gap = Math.max(0, TARGET_PER_TIER - counts[tier]);
    if (gap > 0) needed[tier] = gap;
  }

  const neededEntries = Object.entries(needed);
  if (neededEntries.length === 0) return 0;

  const neededList = neededEntries
    .map(([tier, n]) => `  - ${n} more ${tier} distractors`)
    .join("\n");

  const prompt = `You are a quiz distractor writer for an educational game.

Fact: "${fact.statement}"
Quiz question: "${fact.quiz_question}"
Correct answer: "${fact.correct_answer}"
Category: ${fact.category_l1}

You need to generate additional wrong answers (distractors) for this fact.
Required additions:
${neededList}

Rules:
- easy: plausible on first glance but clearly wrong to someone who knows the topic
- medium: requires topic knowledge to rule out
- hard: very close to the correct answer; requires precise knowledge to distinguish
- NEVER use the correct answer or phrasings of it
- Each distractor must be the same type as the correct answer (number/name/place/etc.)

Return ONLY a JSON array of new distractors:
[{"text": "<distractor>", "difficultyTier": "<easy|medium|hard>"}]

Return ONLY the JSON array.`;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return 0;

  let newDistractors: Array<{ text: string; difficultyTier: string }>;
  try {
    newDistractors = JSON.parse(match[0]);
  } catch {
    return 0;
  }

  const insert = factsDb.prepare(
    `INSERT INTO distractors
      (fact_id, text, difficulty_tier, distractor_confidence, similarity_to_answer, is_approved)
     VALUES (?, ?, ?, 0.75, ?, 1)`
  );

  let added = 0;
  for (const d of newDistractors) {
    if (!d.text?.trim()) continue;
    const similarity = jaccardSimilarity(d.text, fact.correct_answer);
    // Reject if too similar to correct answer (overlap > 60%)
    if (similarity > 0.6) continue;
    insert.run(factId, d.text.trim(), d.difficultyTier ?? "medium", similarity);
    added++;
  }

  // Update distractor_count
  factsDb
    .prepare(
      `UPDATE facts
       SET distractor_count = (SELECT COUNT(*) FROM distractors WHERE fact_id = ? AND is_approved = 1),
           updated_at = ?
       WHERE id = ?`
    )
    .run(factId, Date.now(), factId);

  return added;
}

/**
 * Run distractor expansion on all approved facts below TARGET_TOTAL distractors.
 *
 * @param limit - Max facts to process.
 * @returns Total new distractors added.
 */
export async function expandDistractorsBatch(limit = 100): Promise<number> {
  const facts = factsDb
    .prepare(
      `SELECT id FROM facts
       WHERE status = 'approved' AND distractor_count < ?
       ORDER BY distractor_count ASC
       LIMIT ?`
    )
    .all(TARGET_TOTAL, limit) as Array<{ id: string }>;

  let total = 0;
  for (const { id } of facts) {
    total += await expandDistractors(id);
    await new Promise((r) => setTimeout(r, 150));
  }
  return total;
}
