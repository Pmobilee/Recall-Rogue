/**
 * 3rd-stage quality gate for the Recall Rogue fact pipeline.
 * Independently validates factual plausibility, distractor coverage,
 * and readability using a lightweight LLM pass.
 */
import Anthropic from "@anthropic-ai/sdk";
import { factsDb } from "../db/facts-db.js";
import { config } from "../config.js";
import { buildQualityGatePrompt } from "./llmPrompts.js";
import type { QualityGateInput } from "./llmPrompts.js";
import type { QualityGateStatus } from "../types/factTypes.js";

interface CheckResult {
  result: "PASS" | "FAIL";
  reason: string | null;
}

interface GateResponse {
  checks: {
    factual_plausibility: CheckResult;
    distractor_adequacy: CheckResult;
    readability: CheckResult;
    answer_clarity: CheckResult;
    no_overlap: CheckResult;
  };
  overall: QualityGateStatus;
  failure_summary: string | null;
}

/** Row shapes for quality gate queries */
interface FactGateRow {
  id: string;
  statement: string;
  quiz_question: string;
  correct_answer: string;
  explanation: string;
  mnemonic: string | null;
  age_rating: string;
  distractor_count: number;
}

interface DistractorGateRow {
  text: string;
  difficulty_tier: string;
  distractor_confidence: number;
  is_approved: number;
}

/**
 * Run the 3-stage quality gate on a single fact.
 * Updates quality_gate_status, quality_score, and optionally promotes to 'approved'.
 *
 * @param factId - The fact to evaluate.
 * @returns The gate result, or null if the API key is not configured or the fact is not found.
 */
export async function runQualityGate(factId: string): Promise<GateResponse | null> {
  if (!config.anthropicApiKey) return null;

  const fact = factsDb
    .prepare(
      `SELECT id, statement, quiz_question, correct_answer, explanation,
              mnemonic, age_rating, distractor_count
       FROM facts WHERE id = ?`
    )
    .get(factId) as FactGateRow | undefined;

  if (!fact) return null;

  const distractors = factsDb
    .prepare(
      `SELECT text, difficulty_tier, distractor_confidence, is_approved
       FROM distractors WHERE fact_id = ? AND is_approved = 1`
    )
    .all(factId) as DistractorGateRow[];

  const input: QualityGateInput = {
    statement: fact.statement,
    quizQuestion: fact.quiz_question,
    correctAnswer: fact.correct_answer,
    explanation: fact.explanation,
    mnemonic: fact.mnemonic ?? "",
    ageRating: fact.age_rating,
    distractors: distractors.map((d) => ({
      text: d.text,
      tier: d.difficulty_tier,
    })),
  };

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const prompt = buildQualityGatePrompt(input);

  let gateResult: GateResponse;
  try {
    const response = await client.messages.create({
      // Use Haiku for cost efficiency on the gate pass
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gate response contained no JSON");
    gateResult = JSON.parse(match[0]) as GateResponse;
  } catch (err) {
    console.warn(`[qualityGate] Gate pass failed for ${factId}:`, err);
    return null;
  }

  // Compute numeric quality score: 20 points per PASS check
  const checks = Object.values(gateResult.checks);
  const passCount = checks.filter((c) => c.result === "PASS").length;
  const qualityScore = (passCount / checks.length) * 100;

  const now = Date.now();

  factsDb
    .prepare(
      `UPDATE facts SET
        quality_gate_status         = ?,
        quality_score               = ?,
        quality_gate_ran_at         = ?,
        quality_gate_failure_reason = ?,
        updated_at                  = ?
       WHERE id = ?`
    )
    .run(
      gateResult.overall,
      qualityScore,
      now,
      gateResult.failure_summary,
      now,
      factId
    );

  // Auto-approve facts that pass all checks
  if (gateResult.overall === "pass") {
    factsDb
      .prepare(`UPDATE facts SET status = 'approved', updated_at = ? WHERE id = ?`)
      .run(now, factId);
    console.log(
      `[qualityGate] Auto-approved fact ${factId} (score: ${qualityScore})`
    );
  } else {
    console.log(
      `[qualityGate] Fact ${factId} gated as '${gateResult.overall}': ${gateResult.failure_summary}`
    );
  }

  return gateResult;
}

/**
 * Run the quality gate on all facts in 'draft' status that have not yet
 * been gated (quality_gate_status IS NULL) and have distractor_count > 0.
 *
 * @param limit - Max facts to process in one run.
 * @returns Count of facts that passed the gate.
 */
export async function runQualityGateBatch(limit = 50): Promise<number> {
  const facts = factsDb
    .prepare(
      `SELECT id FROM facts
       WHERE status = 'draft'
         AND quality_gate_status IS NULL
         AND distractor_count > 0
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(limit) as Array<{ id: string }>;

  let passCount = 0;
  for (const { id } of facts) {
    const result = await runQualityGate(id);
    if (result?.overall === "pass") passCount++;
    // 200ms between gate calls (Haiku is faster but still rate-limited)
    await new Promise((r) => setTimeout(r, 200));
  }
  return passCount;
}
