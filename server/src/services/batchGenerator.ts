/**
 * Batch fact statement generator.
 * Given a seed topic and category, asks Claude to produce a list of
 * distinct fact statements, then de-duplicates against the existing DB.
 */
import * as crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { factsDb } from "../db/facts-db.js";
import { config } from "../config.js";
import { checkDuplicate } from "./deduplication.js";

export interface GeneratedStatement {
  statement: string;
  categoryHint: string;
  difficultyHint: "novice" | "explorer" | "scholar" | "expert";
}

/**
 * Generate up to `count` fact statements on `topic` via Claude.
 * Applies in-memory de-duplication against recently inserted statements
 * and semantic de-duplication via `checkDuplicate`.
 *
 * @param topic       - Short topic description (e.g. "deep ocean geology").
 * @param categoryL1  - Top-level category label.
 * @param count       - Target number of statements (max 100).
 * @returns Statements that passed de-duplication, ready to ingest.
 */
export async function generateStatements(
  topic: string,
  categoryL1: string,
  count = 50
): Promise<GeneratedStatement[]> {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const prompt = `You are a fact researcher for Terra Gacha, an educational quiz game.
Topic: "${topic}"
Category: ${categoryL1}

Generate exactly ${count} distinct, verifiable fact statements about this topic.
Requirements:
- Each statement must be a single sentence, self-contained, and factually accurate.
- Vary difficulty: include novice (well-known), explorer (interesting), scholar (detailed), and expert (specialist-level) facts.
- No overlap or redundancy between statements.
- Prefer surprising, counterintuitive, or visually imaginable facts.

Return ONLY a JSON array:
[
  {
    "statement": "<fact as a single declarative sentence>",
    "categoryHint": "${categoryL1}",
    "difficultyHint": "<novice|explorer|scholar|expert>"
  }
]

Return ONLY the JSON array, no preamble, no markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  let raw: GeneratedStatement[];
  try {
    raw = JSON.parse(match[0]) as GeneratedStatement[];
  } catch {
    return [];
  }

  // Semantic de-duplication
  const deduped: GeneratedStatement[] = [];
  for (const item of raw) {
    if (!item.statement?.trim()) continue;
    const result = await checkDuplicate(item.statement, categoryL1);
    if (!result.isDuplicate) {
      deduped.push(item);
    }
  }
  return deduped;
}

/**
 * Enqueue a list of statements into `facts_processing_queue` for full
 * content generation by the pipeline worker.
 *
 * @param statements - Pre-de-duplicated statements from generateStatements().
 * @param sourceName - Attribution label for this batch.
 * @param seedTopic  - Topic tag stored on each fact row.
 * @returns Number of statements enqueued.
 */
export function enqueueStatements(
  statements: GeneratedStatement[],
  sourceName: string,
  seedTopic: string
): number {
  const insertFact = factsDb.prepare(
    `INSERT INTO facts
      (id, type, status, statement, explanation, quiz_question, correct_answer,
       category_l1, source_name, difficulty_tier, seed_topic, created_at, updated_at)
     VALUES (?, 'fact', 'draft', ?, '', '', '', ?, ?, ?, ?, ?, ?)`
  );

  const insertQueue = factsDb.prepare(
    `INSERT INTO facts_processing_queue (fact_id, status, enqueued_at)
     VALUES (?, 'pending', unixepoch())`
  );

  const now = Date.now();
  let count = 0;

  const run = factsDb.transaction(() => {
    for (const s of statements) {
      const id = crypto.randomUUID();
      insertFact.run(
        id,
        s.statement,
        s.categoryHint,
        sourceName,
        s.difficultyHint ?? "explorer",
        seedTopic,
        now,
        now
      );
      insertQueue.run(id);
      count++;
    }
  });

  run();
  return count;
}
