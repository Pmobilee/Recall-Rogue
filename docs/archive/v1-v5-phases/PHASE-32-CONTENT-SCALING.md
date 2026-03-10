# Phase 32: Fact Content Scaling

## Overview

**Goal**: Scale the Recall Rogue fact database from 522 approved facts to 3,000+ by hardening the automated LLM content pipeline, expanding the distractor system to 4–8 distractors per quiz (up from the current minimum floor), implementing a delta sync protocol that lets clients fetch only new and updated facts rather than the full pack, and adding content cadence tooling (versioned weekly bundles, a release scheduler, and a coverage dashboard).

**Why this phase matters**: DD-V2-057 establishes 3,000 approved facts as the hard gate before subscriptions open. Phase 11 built the pipeline skeleton; Phase 32 turns it into a reliable, observable factory that can produce 75–150 facts per week with minimal operator intervention. The delta sync protocol is required for the 3,000-fact milestone to be operationally viable — a full-pack download at that scale exceeds acceptable cold-start bandwidth on mobile.

**Dependencies (must be complete before starting)**:
- Phase 11: Fact Content Engine — `server/src/db/facts-db.ts`, `facts-migrate.ts`, `contentGen.ts`, `llmPrompts.ts`, `pipelineWorker.ts`, and `factsRoutes` all present and building cleanly.
- Phase 19: Auth & Cloud — Fastify server with admin auth middleware (`requireAdmin`) in place; `server/src/middleware/adminAuth.ts` present.
- Phase 20: Mobile Launch — Client-side `factPackService.ts` pattern for offline fact caching exists as a reference for delta sync integration.

**Estimated complexity**: Medium-high. Seven sub-phases span schema additions, a new 3-stage quality gate, a distractor expansion worker, a delta sync endpoint (server + client), a weekly bundle release system, a CLI scheduler, and a Svelte dashboard. The heaviest sub-phase is 32.3 (quality gate) because it introduces a third LLM pass and a structured scoring schema. The second heaviest is 32.5 (delta sync) because it requires coordinating the server's `db_version` counter, a client-side cursor in `localStorage`, and graceful fallback when the cursor is stale.

**Design decisions governing this phase**:
- **DD-V2-055**: 3-stage LLM review pipeline — generation, distractor validation, then a readability/accuracy check.
- **DD-V2-056**: Claude API pipeline with `claude-sonnet-4-5-20250514`; Haiku-tier model acceptable for the readability gate (lower latency, lower cost).
- **DD-V2-057**: 3,000 approved facts required before subscriptions unlock; this phase must make that target reachable within 8–10 weeks.
- **DD-V2-086**: `distractor_confidence` score stored per distractor; minimum confidence threshold 0.70 to be marked `is_approved = 1`.
- **DD-V2-087**: Distractors tiered as easy/medium/hard; game selects 3 from available tiers matching player's SM-2 mastery level.
- **DD-V2-090**: Minimum 12 distractors per fact (all tiers combined).
- **DD-V2-091**: Minimum 200 approved facts per top-level category; dashboard flags categories under threshold.
- **DD-V2-093**: Server is source of truth; client holds sql.js cache; offline-first is non-negotiable.

---

## Sub-Phases

---

### 32.1 — Fact Schema Expansion

**Goal**: Extend the `facts` table with fields for difficulty tiers, source attribution quality, a third-stage review status, and a per-fact quality composite score. Add a `distractor_similarity` field to the `distractors` table. All migrations are idempotent (safe to re-run on startup).

**Files affected**:
- `server/src/db/facts-migrate.ts` — ADD COLUMN statements (idempotent)
- `server/src/types/factTypes.ts` — new file; shared TypeScript interfaces for fact and distractor rows
- `server/src/routes/facts.ts` — extend `PATCHABLE_FIELDS` whitelist

#### 32.1.1 — New columns on `facts`

Add the following columns via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements appended to `initFactsSchema()`. Wrap each in a try/catch that ignores "duplicate column" errors for SQLite versions that lack `IF NOT EXISTS` on `ALTER TABLE`.

```typescript
// server/src/db/facts-migrate.ts — append inside initFactsSchema()

const newFactColumns: Array<[string, string]> = [
  // Difficulty tier enum — coarser than difficulty (1-5); used for biome gating
  // 'novice' | 'explorer' | 'scholar' | 'expert'
  ['difficulty_tier', "TEXT NOT NULL DEFAULT 'explorer'"],

  // Source quality enum — drives weighting in gap analysis
  // 'primary' | 'secondary' | 'generated' | 'community'
  ['source_quality', "TEXT NOT NULL DEFAULT 'generated'"],

  // Source attribution detail — URL may be long, store separately from source_url
  ['source_doi', 'TEXT'],

  // Third-stage review gate result (null = not yet run)
  // 'pass' | 'fail' | 'needs_edit'
  ['quality_gate_status', 'TEXT'],

  // Composite quality score (0-100) computed after all 3 gate passes
  ['quality_score', 'REAL'],

  // Gate run timestamp (epoch ms) — avoid re-running unnecessarily
  ['quality_gate_ran_at', 'INTEGER'],

  // Gate failure reason — short string for dashboard display
  ['quality_gate_failure_reason', 'TEXT'],

  // Weekly bundle tag — which release bundle this fact belongs to
  // e.g. '2026-W10', null = not yet bundled
  ['bundle_tag', 'TEXT'],

  // Whether this fact was sourced from a specific seed topic batch
  ['seed_topic', 'TEXT'],
];

for (const [column, definition] of newFactColumns) {
  try {
    factsDb.exec(`ALTER TABLE facts ADD COLUMN ${column} ${definition}`);
  } catch {
    // Column already exists — safe to ignore
  }
}
```

#### 32.1.2 — New columns on `distractors`

```typescript
// Append to initFactsSchema() after the existing distractors table creation

const newDistractorColumns: Array<[string, string]> = [
  // Cosine similarity to the correct answer (0-1); high similarity = bad distractor
  ['similarity_to_answer', 'REAL'],

  // Whether this distractor passed the 3rd-stage gate
  ['gate_approved', 'INTEGER NOT NULL DEFAULT 1'],
];

for (const [column, definition] of newDistractorColumns) {
  try {
    factsDb.exec(`ALTER TABLE distractors ADD COLUMN ${column} ${definition}`);
  } catch {
    // Column already exists — safe to ignore
  }
}
```

#### 32.1.3 — Add composite index for quality gate queries

```typescript
factsDb.exec(`
  CREATE INDEX IF NOT EXISTS idx_facts_quality_gate
    ON facts (quality_gate_status, status);

  CREATE INDEX IF NOT EXISTS idx_facts_bundle_tag
    ON facts (bundle_tag);

  CREATE INDEX IF NOT EXISTS idx_facts_difficulty_tier
    ON facts (difficulty_tier, status);
`);
```

#### 32.1.4 — Create `server/src/types/factTypes.ts`

```typescript
/**
 * Shared TypeScript interfaces for fact database rows used across
 * server services (pipeline, quality gate, dashboard, delta sync).
 */

export type FactStatus = 'draft' | 'approved' | 'archived';
export type DistractorTier = 'easy' | 'medium' | 'hard';
export type QualityGateStatus = 'pass' | 'fail' | 'needs_edit';
export type DifficultyTier = 'novice' | 'explorer' | 'scholar' | 'expert';
export type ContentVolatility = 'timeless' | 'slow_change' | 'current_events';
export type SourceQuality = 'primary' | 'secondary' | 'generated' | 'community';

/** Full server-side fact row shape (snake_case, matches DB columns). */
export interface FactRow {
  id: string;
  type: string;
  status: FactStatus;
  in_game_reports: number;
  statement: string;
  wow_factor: string | null;
  explanation: string;
  alternate_explanations: string | null; // JSON string[]
  gaia_comments: string | null;          // JSON array
  gaia_wrong_comments: string | null;    // JSON object
  quiz_question: string;
  correct_answer: string;
  acceptable_answers: string | null;     // JSON string[]
  distractor_count: number;
  category_l1: string;
  category_l2: string;
  category_l3: string;
  rarity: string;
  difficulty: number;
  difficulty_tier: DifficultyTier;
  fun_score: number;
  novelty_score: number;
  age_rating: string;
  sensitivity_level: number;
  sensitivity_note: string | null;
  content_volatility: ContentVolatility;
  source_name: string | null;
  source_url: string | null;
  source_quality: SourceQuality;
  source_doi: string | null;
  related_facts: string | null;          // JSON string[]
  tags: string | null;                   // JSON string[]
  mnemonic: string | null;
  image_prompt: string | null;
  visual_description: string | null;
  image_url: string | null;
  has_pixel_art: number;
  pixel_art_status: string;
  language: string | null;
  pronunciation: string | null;
  example_sentence: string | null;
  quality_gate_status: QualityGateStatus | null;
  quality_score: number | null;
  quality_gate_ran_at: number | null;
  quality_gate_failure_reason: string | null;
  bundle_tag: string | null;
  seed_topic: string | null;
  db_version: number;
  created_at: number;
  updated_at: number;
  last_reviewed_at: number | null;
}

/** Server-side distractor row shape. */
export interface DistractorRow {
  id: number;
  fact_id: string;
  text: string;
  difficulty_tier: DistractorTier;
  distractor_confidence: number;
  is_approved: number;
  similarity_to_answer: number | null;
  gate_approved: number;
}
```

#### 32.1.5 — Extend `PATCHABLE_FIELDS` in `server/src/routes/facts.ts`

Add `"difficulty_tier"`, `"source_quality"`, `"source_doi"`, `"quality_gate_status"`, `"bundle_tag"`, and `"seed_topic"` to the existing `PATCHABLE_FIELDS` Set.

**Acceptance criteria for 32.1**:
- `npm run typecheck` in `server/` passes with zero errors.
- Running `initFactsSchema()` twice on a fresh database produces no errors on the second run.
- `server/src/types/factTypes.ts` imports cleanly in at least one other service file (add an import to `contentGen.ts` to verify).

---

### 32.2 — Claude API Batch Generation Pipeline

**Goal**: Replace the single-fact-at-a-time pipeline worker (`pipelineWorker.ts`) with a batch generation script that: (a) accepts a seed topic file or a `--category` flag, (b) calls Claude to generate 50 fact statements from the topic, (c) de-duplicates against the existing database, (d) enqueues surviving statements into `facts_processing_queue`, and (e) runs the existing `processBatch()` loop to generate full content. Add exponential-backoff retry and a configurable concurrency limit.

**Files affected**:
- `server/src/scripts/generate-batch.ts` — new file; CLI entrypoint
- `server/src/services/batchGenerator.ts` — new file; topic → statement generation
- `server/src/services/rateLimiter.ts` — new file; token-bucket rate limiter
- `server/src/workers/pipelineWorker.ts` — add concurrency and backoff to `processBatch()`

#### 32.2.1 — `server/src/services/rateLimiter.ts`

```typescript
/**
 * Simple token-bucket rate limiter for the Claude API.
 * Prevents exceeding Anthropic's rate limits during batch generation.
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(
    /** Max concurrent in-flight requests. */
    private readonly concurrency: number,
    /** Minimum ms between any two request starts. */
    private readonly minIntervalMs: number
  ) {}

  private lastStartTime = 0;

  /**
   * Acquire a slot, respecting concurrency and minimum interval.
   * Returns a release function that must be called when the request finishes.
   */
  async acquire(): Promise<() => void> {
    while (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    const now = Date.now();
    const wait = this.minIntervalMs - (now - this.lastStartTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastStartTime = Date.now();
    this.running++;
    return () => {
      this.running--;
      this.queue.shift()?.();
    };
  }
}
```

#### 32.2.2 — `server/src/services/batchGenerator.ts`

```typescript
/**
 * Batch fact statement generator.
 * Given a seed topic and category, asks Claude to produce a list of
 * distinct fact statements, then de-duplicates against the existing DB.
 */
import Anthropic from '@anthropic-ai/sdk';
import { factsDb } from '../db/facts-db.js';
import { config } from '../config.js';
import { checkDuplicate } from './deduplication.js';

export interface GeneratedStatement {
  statement: string;
  categoryHint: string;
  difficultyHint: 'novice' | 'explorer' | 'scholar' | 'expert';
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
  count = 50,
): Promise<GeneratedStatement[]> {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const prompt = `You are a fact researcher for Recall Rogue, an educational quiz game.
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
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
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
  seedTopic: string,
): number {
  const insertFact = factsDb.prepare(
    `INSERT INTO facts
      (id, type, status, statement, explanation, quiz_question, correct_answer,
       category_l1, source_name, difficulty_tier, seed_topic, created_at, updated_at)
     VALUES (?, 'fact', 'draft', ?, '', '', '', ?, ?, ?, ?, ?, ?)`,
  );

  const insertQueue = factsDb.prepare(
    `INSERT INTO facts_processing_queue (fact_id, status, enqueued_at)
     VALUES (?, 'pending', unixepoch())`,
  );

  const now = Date.now();
  let count = 0;

  const run = factsDb.transaction(() => {
    for (const s of statements) {
      const id = crypto.randomUUID();
      insertFact.run(
        id, s.statement, s.categoryL1 ?? s.categoryHint, sourceName,
        s.difficultyHint ?? 'explorer', seedTopic, now, now,
      );
      insertQueue.run(id);
      count++;
    }
  });

  run();
  return count;
}
```

#### 32.2.3 — `server/src/scripts/generate-batch.ts`

CLI entrypoint. Accepts `--topic`, `--category`, `--count`, `--source` flags.

```typescript
/**
 * CLI script: generate a batch of new facts from a seed topic.
 *
 * Usage:
 *   npx tsx server/src/scripts/generate-batch.ts \
 *     --topic "deep ocean geology" \
 *     --category "Natural Sciences" \
 *     --count 50 \
 *     --source "Wikipedia: Deep sea"
 *
 * The script:
 *   1. Calls Claude to generate `count` distinct statements on `topic`.
 *   2. De-duplicates against existing approved facts.
 *   3. Enqueues survivors into facts_processing_queue.
 *   4. Runs processBatch() to generate full content for each enqueued fact.
 */
import { parseArgs } from 'node:util';
import { initFactsSchema } from '../db/facts-migrate.js';
import { generateStatements, enqueueStatements } from '../services/batchGenerator.js';
import { processBatch } from '../workers/pipelineWorker.js';

async function main() {
  const { values } = parseArgs({
    options: {
      topic:    { type: 'string' },
      category: { type: 'string', default: 'Natural Sciences' },
      count:    { type: 'string', default: '50' },
      source:   { type: 'string', default: 'LLM generated' },
    },
    allowPositionals: false,
  });

  if (!values.topic) {
    console.error('Error: --topic is required');
    process.exit(1);
  }

  initFactsSchema();

  const count = Math.min(parseInt(values.count as string, 10), 100);
  console.log(`[batch] Generating ${count} statements for topic: "${values.topic}"`);

  const statements = await generateStatements(values.topic as string, values.category as string, count);
  console.log(`[batch] ${statements.length} unique statements after de-duplication`);

  const enqueued = enqueueStatements(statements, values.source as string, values.topic as string);
  console.log(`[batch] ${enqueued} facts enqueued for content generation`);

  const processed = await processBatch();
  console.log(`[batch] ${processed} facts fully generated`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Add to `server/package.json` scripts:
```json
"generate-batch": "tsx src/scripts/generate-batch.ts"
```

**Acceptance criteria for 32.2**:
- `npm run generate-batch -- --topic "Precambrian geology" --category "Natural Sciences" --count 10` runs without error, inserts at least 5 new draft facts, and generates full content for them.
- `checkDuplicate` rejects statements with similarity >= 0.85 to existing approved facts.
- `RateLimiter` correctly serializes concurrent requests: running two simultaneous `generateStatements` calls with `concurrency: 1` results in sequential API calls with no rate-limit errors.

---

### 32.3 — 3-Stage LLM Quality Gate

**Goal**: After Pass 1 (content generation) and Pass 2 (distractor confidence scoring) from Phase 11, add a **Pass 3** quality gate that independently evaluates each fact for: (a) factual accuracy plausibility, (b) distractor set adequacy, and (c) readability at the target age rating. Facts that pass all three checks are promoted to `quality_gate_status = 'pass'` and auto-approved. Facts that fail are marked `'fail'` or `'needs_edit'` with a reason, and remain as `draft`.

**Files affected**:
- `server/src/services/qualityGate.ts` — new file
- `server/src/services/llmPrompts.ts` — add `buildQualityGatePrompt()`
- `server/src/workers/pipelineWorker.ts` — call `runQualityGate()` after `persistGeneratedContent()`
- `server/src/routes/facts.ts` — add `POST /:id/quality-gate` admin endpoint

#### 32.3.1 — Add `buildQualityGatePrompt()` to `server/src/services/llmPrompts.ts`

```typescript
export interface QualityGateInput {
  statement: string;
  quizQuestion: string;
  correctAnswer: string;
  explanation: string;
  mnemonic: string;
  ageRating: string;
  distractors: Array<{ text: string; tier: string }>;
}

/**
 * Build the 3rd-stage quality gate prompt.
 * Uses a cheaper model (claude-haiku) for cost efficiency.
 */
export function buildQualityGatePrompt(input: QualityGateInput): string {
  const distractorList = input.distractors
    .map((d, i) => `  [${i}] (${d.tier}) ${d.text}`)
    .join('\n');

  return `You are a quality reviewer for an educational quiz game targeting ages 10+.

Evaluate the following fact entry:

STATEMENT: "${input.statement}"
QUIZ QUESTION: "${input.quizQuestion}"
CORRECT ANSWER: "${input.correctAnswer}"
EXPLANATION: "${input.explanation}"
MNEMONIC: "${input.mnemonic}"
AGE RATING: ${input.ageRating}

DISTRACTORS:
${distractorList}

Score each of the following checks as PASS or FAIL, with a brief reason on failure:

1. FACTUAL_PLAUSIBILITY: Is the statement plausible for a real-world fact? (You are not expected to verify — flag obvious inventions or impossible claims.)
2. DISTRACTOR_ADEQUACY: Are there at least 3 distractors with confidence > 0.7? Do distractors span all three tiers (easy/medium/hard)?
3. READABILITY: Is the quiz question grammatically correct and unambiguous for the stated age rating?
4. ANSWER_CLARITY: Is the correct answer a clean, unambiguous response to the quiz question?
5. NO_OVERLAP: Does the correct answer appear (verbatim or near-verbatim) in any distractor?

Return ONLY a JSON object:
{
  "checks": {
    "factual_plausibility": { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" },
    "distractor_adequacy":  { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" },
    "readability":          { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" },
    "answer_clarity":       { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" },
    "no_overlap":           { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" }
  },
  "overall": "pass" | "fail" | "needs_edit",
  "failure_summary": "<null if overall=pass, otherwise 1-2 sentence summary of what needs fixing>"
}

Return ONLY the JSON, no markdown fences.`;
}
```

#### 32.3.2 — `server/src/services/qualityGate.ts`

```typescript
/**
 * 3rd-stage quality gate for the Recall Rogue fact pipeline.
 * Independently validates factual plausibility, distractor coverage,
 * and readability using a lightweight LLM pass.
 */
import Anthropic from '@anthropic-ai/sdk';
import { factsDb } from '../db/facts-db.js';
import { config } from '../config.js';
import { buildQualityGatePrompt, QualityGateInput } from './llmPrompts.js';
import type { QualityGateStatus } from '../types/factTypes.js';

interface CheckResult {
  result: 'PASS' | 'FAIL';
  reason: string | null;
}

interface GateResponse {
  checks: {
    factual_plausibility: CheckResult;
    distractor_adequacy:  CheckResult;
    readability:          CheckResult;
    answer_clarity:       CheckResult;
    no_overlap:           CheckResult;
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
 * @returns The gate result.
 */
export async function runQualityGate(factId: string): Promise<GateResponse | null> {
  if (!config.anthropicApiKey) return null;

  const fact = factsDb
    .prepare(
      `SELECT id, statement, quiz_question, correct_answer, explanation,
              mnemonic, age_rating, distractor_count
       FROM facts WHERE id = ?`,
    )
    .get(factId) as FactGateRow | undefined;

  if (!fact) return null;

  const distractors = factsDb
    .prepare(
      `SELECT text, difficulty_tier, distractor_confidence, is_approved
       FROM distractors WHERE fact_id = ? AND is_approved = 1`,
    )
    .all(factId) as DistractorGateRow[];

  const input: QualityGateInput = {
    statement:     fact.statement,
    quizQuestion:  fact.quiz_question,
    correctAnswer: fact.correct_answer,
    explanation:   fact.explanation,
    mnemonic:      fact.mnemonic ?? '',
    ageRating:     fact.age_rating,
    distractors:   distractors.map((d) => ({
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
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gate response contained no JSON');
    gateResult = JSON.parse(match[0]) as GateResponse;
  } catch (err) {
    console.warn(`[qualityGate] Gate pass failed for ${factId}:`, err);
    return null;
  }

  // Compute numeric quality score: 20 points per PASS check
  const checks = Object.values(gateResult.checks);
  const passCount = checks.filter((c) => c.result === 'PASS').length;
  const qualityScore = (passCount / checks.length) * 100;

  const now = Date.now();

  factsDb
    .prepare(
      `UPDATE facts SET
        quality_gate_status        = ?,
        quality_score              = ?,
        quality_gate_ran_at        = ?,
        quality_gate_failure_reason = ?,
        updated_at                 = ?
       WHERE id = ?`,
    )
    .run(
      gateResult.overall,
      qualityScore,
      now,
      gateResult.failure_summary,
      now,
      factId,
    );

  // Auto-approve facts that pass all checks
  if (gateResult.overall === 'pass') {
    factsDb
      .prepare(`UPDATE facts SET status = 'approved', updated_at = ? WHERE id = ?`)
      .run(now, factId);
    console.log(`[qualityGate] Auto-approved fact ${factId} (score: ${qualityScore})`);
  } else {
    console.log(
      `[qualityGate] Fact ${factId} gated as '${gateResult.overall}': ${gateResult.failure_summary}`,
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
       LIMIT ?`,
    )
    .all(limit) as Array<{ id: string }>;

  let passCount = 0;
  for (const { id } of facts) {
    const result = await runQualityGate(id);
    if (result?.overall === 'pass') passCount++;
    // 200ms between gate calls (Haiku is faster but still rate-limited)
    await new Promise((r) => setTimeout(r, 200));
  }
  return passCount;
}
```

#### 32.3.3 — Integrate gate into `pipelineWorker.ts`

After the `persistGeneratedContent(fact.id, content)` call inside `processBatch()`, add:

```typescript
// Pass 3: quality gate (auto-approves on full pass)
try {
  await runQualityGate(fact.id);
} catch (err) {
  console.warn(`[pipeline] Quality gate skipped for ${fact.id}:`, err);
}
```

Import `runQualityGate` from `'../services/qualityGate.js'`.

#### 32.3.4 — Add `POST /api/facts/:id/quality-gate` admin endpoint

In `server/src/routes/facts.ts`, add:

```typescript
fastify.post(
  '/:id/quality-gate',
  { preHandler: requireAdmin },
  async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const fact = factsDb
      .prepare('SELECT id FROM facts WHERE id = ?')
      .get(id) as { id: string } | undefined;
    if (!fact) return reply.status(404).send({ error: 'Fact not found', statusCode: 404 });

    const result = await runQualityGate(id);
    return reply.send({ result });
  },
);
```

**Acceptance criteria for 32.3**:
- `runQualityGate(factId)` on a well-formed approved fact returns `overall: 'pass'` and sets `quality_gate_status = 'pass'` and `status = 'approved'` in the DB.
- A fact with no distractors returns `overall: 'fail'` and `distractor_adequacy.result = 'FAIL'`.
- `runQualityGateBatch(5)` completes within 5 seconds for 5 facts.
- `POST /api/facts/:id/quality-gate` returns 404 for unknown IDs and a gate result for known IDs.

---

### 32.4 — Distractor Expansion System

**Goal**: For facts that have fewer than 8 approved distractors, or where the distractor spread across tiers is uneven (e.g. all easy), run a targeted distractor expansion pass. The expansion prompt requests specific additional distractors for the gap tier. Adds a `similarity_to_answer` score via a simple token-overlap heuristic (no extra API call).

**Files affected**:
- `server/src/services/distractorExpander.ts` — new file
- `server/src/scripts/expand-distractors.ts` — new file; CLI entrypoint
- `server/src/routes/facts.ts` — add `POST /:id/expand-distractors` admin endpoint

#### 32.4.1 — `server/src/services/distractorExpander.ts`

```typescript
/**
 * Distractor expansion service.
 * Identifies facts with thin distractor coverage and generates
 * additional distractors for the under-represented difficulty tiers.
 * Target: minimum 8 approved distractors (at least 2 per tier).
 */
import Anthropic from '@anthropic-ai/sdk';
import { factsDb } from '../db/facts-db.js';
import { config } from '../config.js';
import type { DistractorTier } from '../types/factTypes.js';

const TARGET_PER_TIER = 2;   // minimum approved distractors per tier
const TARGET_TOTAL = 8;       // minimum approved distractors overall

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
 */
function jaccardSimilarity(a: string, b: string): number {
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
       FROM facts WHERE id = ?`,
    )
    .get(factId) as FactSummaryRow | undefined;

  if (!fact) return 0;

  // Count approved distractors per tier
  const dist = factsDb
    .prepare(
      `SELECT difficulty_tier, COUNT(*) as count
       FROM distractors
       WHERE fact_id = ? AND is_approved = 1
       GROUP BY difficulty_tier`,
    )
    .all(factId) as DistributionRow[];

  const counts: Record<DistractorTier, number> = {
    easy: 0, medium: 0, hard: 0,
  };
  for (const row of dist) {
    counts[row.difficulty_tier as DistractorTier] = row.count;
  }

  const total = counts.easy + counts.medium + counts.hard;
  if (total >= TARGET_TOTAL) return 0; // Already sufficient

  // Determine what is needed per tier
  const needed: Partial<Record<DistractorTier, number>> = {};
  for (const tier of ['easy', 'medium', 'hard'] as DistractorTier[]) {
    const gap = Math.max(0, TARGET_PER_TIER - counts[tier]);
    if (gap > 0) needed[tier] = gap;
  }

  const neededEntries = Object.entries(needed);
  if (neededEntries.length === 0) return 0;

  const neededList = neededEntries
    .map(([tier, n]) => `  - ${n} more ${tier} distractors`)
    .join('\n');

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
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
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
     VALUES (?, ?, ?, 0.75, ?, 1)`,
  );

  let added = 0;
  for (const d of newDistractors) {
    if (!d.text?.trim()) continue;
    const similarity = jaccardSimilarity(d.text, fact.correct_answer);
    // Reject if too similar to correct answer (overlap > 60%)
    if (similarity > 0.6) continue;
    insert.run(factId, d.text.trim(), d.difficultyTier ?? 'medium', similarity);
    added++;
  }

  // Update distractor_count
  factsDb
    .prepare(
      `UPDATE facts
       SET distractor_count = (SELECT COUNT(*) FROM distractors WHERE fact_id = ? AND is_approved = 1),
           updated_at = ?
       WHERE id = ?`,
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
       LIMIT ?`,
    )
    .all(TARGET_TOTAL, limit) as Array<{ id: string }>;

  let total = 0;
  for (const { id } of facts) {
    total += await expandDistractors(id);
    await new Promise((r) => setTimeout(r, 150));
  }
  return total;
}
```

#### 32.4.2 — `server/src/scripts/expand-distractors.ts`

```typescript
/**
 * CLI: expand distractors for approved facts with thin coverage.
 * Usage: npx tsx server/src/scripts/expand-distractors.ts --limit 50
 */
import { parseArgs } from 'node:util';
import { initFactsSchema } from '../db/facts-migrate.js';
import { expandDistractorsBatch } from '../services/distractorExpander.js';

const { values } = parseArgs({
  options: { limit: { type: 'string', default: '100' } },
  allowPositionals: false,
});

initFactsSchema();
const total = await expandDistractorsBatch(parseInt(values.limit as string, 10));
console.log(`[expand-distractors] Added ${total} new distractors.`);
```

Add to `server/package.json`:
```json
"expand-distractors": "tsx src/scripts/expand-distractors.ts"
```

**Acceptance criteria for 32.4**:
- Running `expandDistractors(factId)` on an approved fact with 4 existing distractors (all easy) adds at least 2 medium and 2 hard distractors.
- `jaccardSimilarity` rejects a proposed distractor identical to the correct answer (similarity 1.0 > 0.6 threshold).
- `distractor_count` on the fact row is updated accurately after expansion.

---

### 32.5 — Delta Sync Protocol

**Goal**: Replace the full-pack download (`GET /api/facts/packs/all`) with a cursor-based delta sync. The client stores a `lastSyncVersion` integer in `localStorage`. On sync, it requests only facts modified after that version. The server returns new/updated facts plus a `deletedIds` array. The client applies the delta to its sql.js cache. Full-pack fallback is preserved for first install.

**Files affected**:
- `server/src/routes/facts.ts` — the existing `GET /delta` endpoint is already present; extend it with compression and `ETag` caching
- `src/services/deltaSync.ts` — new client file
- `src/services/factCacheService.ts` — new client file (replaces `factPackService.ts` for delta operations)
- `src/services/saveService.ts` — add `lastSyncVersion` to save state

#### 32.5.1 — Harden the server `GET /delta` endpoint

The existing `/delta` route in `server/src/routes/facts.ts` already returns `{ facts, deletedIds, latestVersion, hasMore }`. Add:
1. An `ETag` header based on `latestVersion` so clients can skip unchanged responses.
2. A `category` query parameter to allow per-category delta pulls.
3. A `nextCursor` field in the response for clients that need to page through a large delta.

Update the delta route's query and response in `factsRoutes`:

```typescript
// GET /delta — extended version
fastify.get('/delta', async (request: FastifyRequest, reply: FastifyReply) => {
  const qs = request.query as Record<string, string>;
  const since = parseInt(qs['since'] ?? '0', 10);
  const limit = Math.min(parseInt(qs['limit'] ?? '500', 10), 1000);
  const category = qs['category']; // optional filter

  let query = `SELECT
      id, statement, quiz_question, correct_answer, acceptable_answers,
      gaia_comments, gaia_wrong_comments, category_l1, category_l2,
      rarity, difficulty, difficulty_tier, fun_score, novelty_score,
      age_rating, sensitivity_level, has_pixel_art, image_url,
      language, db_version, status, updated_at
    FROM facts
    WHERE db_version > ? AND status IN ('approved', 'archived')`;
  const params: (string | number)[] = [since];

  if (category) {
    query += ' AND category_l1 = ?';
    params.push(category);
  }

  query += ' ORDER BY db_version ASC LIMIT ?';
  params.push(limit);

  const facts = factsDb.prepare(query).all(...params) as FactRow[];

  const deletedIds = facts.filter((f) => f.status === 'archived').map((f) => f.id);
  const activeFacts = facts.filter((f) => f.status === 'approved');
  const maxVersion = facts.length > 0
    ? Math.max(...facts.map((f) => f.db_version as number))
    : since;

  const etag = `"delta-${maxVersion}"`;
  if (request.headers['if-none-match'] === etag) {
    return reply.status(304).send();
  }

  reply.header('ETag', etag);
  reply.header('Cache-Control', 'private, max-age=300');

  return reply.send({
    facts: activeFacts,
    deletedIds,
    latestVersion: maxVersion,
    hasMore: facts.length === limit,
    nextCursor: facts.length === limit ? maxVersion : null,
  });
});
```

#### 32.5.2 — `src/services/deltaSync.ts`

```typescript
/**
 * Delta sync service for the Recall Rogue fact cache.
 * Fetches only facts modified since the client's last sync cursor.
 * Falls back to full pack on first install or corrupted cursor.
 */

import type { Fact } from '../data/types.js';

const SYNC_VERSION_KEY = 'recall-rogue-fact-sync-version';
const SYNC_URL_BASE = '/api/facts';

export interface DeltaSyncResult {
  added: number;
  updated: number;
  deleted: number;
  newVersion: number;
}

/**
 * Retrieve the client's last-sync version cursor from localStorage.
 */
export function getSyncVersion(): number {
  const raw = localStorage.getItem(SYNC_VERSION_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Persist the sync version cursor.
 */
export function setSyncVersion(version: number): void {
  localStorage.setItem(SYNC_VERSION_KEY, String(version));
}

/**
 * Fetch one page of delta facts from the server.
 * Returns null if the server is unreachable (offline).
 */
async function fetchDeltaPage(
  since: number,
  limit = 500,
): Promise<{ facts: Fact[]; deletedIds: string[]; latestVersion: number; hasMore: boolean } | null> {
  try {
    const url = `${SYNC_URL_BASE}/delta?since=${since}&limit=${limit}`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (resp.status === 304) return { facts: [], deletedIds: [], latestVersion: since, hasMore: false };
    if (!resp.ok) return null;
    return await resp.json() as {
      facts: Fact[]; deletedIds: string[]; latestVersion: number; hasMore: boolean;
    };
  } catch {
    return null; // Offline
  }
}

/**
 * Apply a delta to the provided sql.js database instance.
 * Upserts new/updated facts and hard-deletes archived IDs.
 *
 * @param db        - The sql.js database instance (must have a facts table).
 * @param facts     - New or updated approved facts.
 * @param deletedIds - IDs of facts to remove from the local cache.
 * @returns Counts of rows added, updated, and deleted.
 */
export function applyDelta(
  db: { run: (sql: string, params?: unknown[]) => void; exec: (sql: string) => void },
  facts: Fact[],
  deletedIds: string[],
): { added: number; updated: number; deleted: number } {
  let added = 0;
  let updated = 0;

  for (const fact of facts) {
    const existing = (db as unknown as {
      exec: (sql: string) => Array<{ values: unknown[][] }>;
    }).exec(`SELECT id FROM facts WHERE id = '${fact.id}'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(
        `UPDATE facts SET
           question = ?, answer = ?, distractors = ?,
           category = ?, updated_at = ?
         WHERE id = ?`,
        [fact.question ?? '', fact.answer ?? '', JSON.stringify(fact.distractors ?? []),
         fact.category ?? '', Date.now(), fact.id],
      );
      updated++;
    } else {
      db.run(
        `INSERT OR IGNORE INTO facts
           (id, question, answer, distractors, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fact.id, fact.question ?? '', fact.answer ?? '',
         JSON.stringify(fact.distractors ?? []), fact.category ?? '', Date.now(), Date.now()],
      );
      added++;
    }
  }

  let deleted = 0;
  for (const id of deletedIds) {
    db.run(`DELETE FROM facts WHERE id = ?`, [id]);
    deleted++;
  }

  return { added, updated, deleted };
}

/**
 * Run a full delta sync cycle:
 *   1. Read local sync cursor.
 *   2. Fetch all delta pages until hasMore is false.
 *   3. Apply each page to the sql.js cache.
 *   4. Persist the new cursor.
 *
 * @param db - The sql.js database instance.
 * @returns Sync result counts, or null if offline.
 */
export async function runDeltaSync(
  db: Parameters<typeof applyDelta>[0],
): Promise<DeltaSyncResult | null> {
  const since = getSyncVersion();
  let cursor = since;
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;

  while (true) {
    const page = await fetchDeltaPage(cursor);
    if (!page) return null; // Offline

    const result = applyDelta(db, page.facts, page.deletedIds);
    totalAdded += result.added;
    totalUpdated += result.updated;
    totalDeleted += result.deleted;
    cursor = page.latestVersion;

    if (!page.hasMore) break;
  }

  setSyncVersion(cursor);

  return {
    added: totalAdded,
    updated: totalUpdated,
    deleted: totalDeleted,
    newVersion: cursor,
  };
}
```

#### 32.5.3 — Integrate delta sync into the game startup flow

In `src/services/saveService.ts`, add `lastSyncVersion: number` to the `PlayerSave` default (value `0`). In `src/main.ts`, after the game initializes and the facts DB is loaded, call `runDeltaSync(db)` with a brief loading toast for when new facts are available. The toast displays "X new facts synced" if `added > 0`.

**Acceptance criteria for 32.5**:
- `runDeltaSync()` with `since=0` fetches all approved facts, populates the local sql.js cache, and sets `lastSyncVersion` to the correct value.
- A second call to `runDeltaSync()` immediately after returns `added: 0`, `updated: 0`, `deleted: 0` (nothing changed).
- If the server is unreachable, `runDeltaSync()` returns `null` and the local cache is unchanged.
- `ETag` header causes a 304 response when `latestVersion` has not changed.

---

### 32.6 — Content Cadence Tooling

**Goal**: Implement weekly fact pack releases. Each release is a versioned bundle tagged `YYYY-WNN` (ISO year-week). The release process: (a) query all approved un-bundled facts, (b) assign them a bundle tag, (c) generate a signed JSON manifest, (d) upload the manifest to `public/fact-bundles/`. The client can optionally subscribe to a bundle feed endpoint to discover new releases. Add a cron-style release scheduler for automated weekly drops.

**Files affected**:
- `server/src/scripts/release-bundle.ts` — new file; CLI release script
- `server/src/routes/factBundles.ts` — new file; bundle discovery endpoint
- `server/src/jobs/bundleScheduler.ts` — new file; weekly cron trigger
- `server/src/index.ts` — register `factBundleRoutes` and start `bundleScheduler`

#### 32.6.1 — `server/src/scripts/release-bundle.ts`

```typescript
/**
 * CLI: create and publish a weekly fact bundle.
 *
 * Usage:
 *   npx tsx server/src/scripts/release-bundle.ts
 *   npx tsx server/src/scripts/release-bundle.ts --week 2026-W12
 *
 * The script:
 *   1. Determines current ISO year-week (or uses --week flag).
 *   2. Queries all approved, un-bundled facts (bundle_tag IS NULL).
 *   3. Tags them with the week label.
 *   4. Writes a JSON bundle manifest to public/fact-bundles/<week>.json.
 *   5. Updates the bundle index file (public/fact-bundles/index.json).
 */
import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { initFactsSchema } from '../db/facts-migrate.js';
import { factsDb } from '../db/facts-db.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const BUNDLES_DIR = path.resolve(__dirname, '../../../../public/fact-bundles');

/** Get the ISO year-week string for a given date. */
function isoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const { values } = parseArgs({
  options: { week: { type: 'string' } },
  allowPositionals: false,
});

initFactsSchema();
fs.mkdirSync(BUNDLES_DIR, { recursive: true });

const week = (values.week as string | undefined) ?? isoWeek();

// Tag un-bundled approved facts
factsDb.prepare(
  `UPDATE facts SET bundle_tag = ?, updated_at = ?
   WHERE status = 'approved' AND bundle_tag IS NULL`,
).run(week, Date.now());

// Fetch the bundle
interface BundleRow {
  id: string;
  quiz_question: string;
  correct_answer: string;
  gaia_comments: string | null;
  explanation: string;
  category_l1: string;
  difficulty: number;
  difficulty_tier: string;
  novelty_score: number;
  db_version: number;
}

const facts = factsDb.prepare(
  `SELECT id, quiz_question, correct_answer, gaia_comments, explanation,
          category_l1, difficulty, difficulty_tier, novelty_score, db_version
   FROM facts WHERE bundle_tag = ? AND status = 'approved'`,
).all(week) as BundleRow[];

interface FactBundle {
  bundleTag: string;
  releasedAt: string;
  factCount: number;
  facts: BundleRow[];
}

const bundle: FactBundle = {
  bundleTag: week,
  releasedAt: new Date().toISOString(),
  factCount: facts.length,
  facts,
};

const bundlePath = path.join(BUNDLES_DIR, `${week}.json`);
fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');
console.log(`[release-bundle] Wrote ${facts.length} facts to ${bundlePath}`);

// Update index
interface BundleIndexEntry { bundleTag: string; factCount: number; releasedAt: string }
const indexPath = path.join(BUNDLES_DIR, 'index.json');
let index: BundleIndexEntry[] = [];
try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as BundleIndexEntry[]; } catch { /* new */ }

const existing = index.findIndex((e) => e.bundleTag === week);
const entry: BundleIndexEntry = { bundleTag: week, factCount: facts.length, releasedAt: bundle.releasedAt };
if (existing >= 0) index[existing] = entry; else index.push(entry);
index.sort((a, b) => b.bundleTag.localeCompare(a.bundleTag));
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
console.log(`[release-bundle] Bundle index updated (${index.length} total bundles).`);
```

#### 32.6.2 — `server/src/routes/factBundles.ts`

```typescript
/**
 * Fact bundle discovery routes.
 * GET /api/fact-bundles         — list available weekly bundles
 * GET /api/fact-bundles/:week   — fetch a specific bundle
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const BUNDLES_DIR = path.resolve(__dirname, '../../../public/fact-bundles');

export async function factBundleRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    const indexPath = path.join(BUNDLES_DIR, 'index.json');
    if (!fs.existsSync(indexPath)) return reply.send({ bundles: [] });
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send({ bundles: index });
  });

  fastify.get('/:week', async (request: FastifyRequest, reply: FastifyReply) => {
    const { week } = request.params as { week: string };
    // Validate week format (YYYY-WNN)
    if (!/^\d{4}-W\d{2}$/.test(week)) {
      return reply.status(400).send({ error: 'Invalid week format. Expected YYYY-WNN.' });
    }
    const bundlePath = path.join(BUNDLES_DIR, `${week}.json`);
    if (!fs.existsSync(bundlePath)) {
      return reply.status(404).send({ error: `Bundle ${week} not found.` });
    }
    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(bundle);
  });
}
```

#### 32.6.3 — `server/src/jobs/bundleScheduler.ts`

```typescript
/**
 * Weekly bundle auto-release scheduler.
 * Runs the release script every Monday at 06:00 UTC by polling a
 * setInterval that checks if the current day/hour matches the schedule.
 * Designed for low-dependency environments (no node-cron needed).
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '../scripts/release-bundle.js');

/** Track last release week to avoid double-releasing. */
let lastReleasedWeek = '';

/**
 * Start the bundle scheduler. Checks every 10 minutes whether
 * a weekly release should be triggered.
 */
export function startBundleScheduler(): void {
  const check = () => {
    const now = new Date();
    // Monday = 1, 06:00 UTC
    if (now.getUTCDay() !== 1 || now.getUTCHours() !== 6) return;

    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((now.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const currentWeek = `${now.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

    if (currentWeek === lastReleasedWeek) return;
    lastReleasedWeek = currentWeek;

    console.log(`[bundleScheduler] Triggering weekly bundle release for ${currentWeek}`);
    try {
      execSync(`node ${SCRIPT} --week ${currentWeek}`, { stdio: 'inherit' });
    } catch (err) {
      console.error('[bundleScheduler] Bundle release failed:', err);
    }
  };

  // Run immediately in case server just started on a Monday morning
  check();
  setInterval(check, 10 * 60 * 1000); // every 10 minutes
  console.log('[bundleScheduler] Weekly bundle scheduler started.');
}
```

Register in `server/src/index.ts`:
```typescript
import { factBundleRoutes } from './routes/factBundles.js';
import { startBundleScheduler } from './jobs/bundleScheduler.js';
// ... in route registration:
fastify.register(factBundleRoutes, { prefix: '/api/fact-bundles' });
// ... after server starts:
startBundleScheduler();
```

Add npm script:
```json
"release-bundle": "tsx src/scripts/release-bundle.ts"
```

**Acceptance criteria for 32.6**:
- `npm run release-bundle` tags all un-bundled approved facts with the current ISO week, writes a `public/fact-bundles/YYYY-WNN.json` file, and updates `public/fact-bundles/index.json`.
- Running the same command twice in the same week does not create duplicate bundles; fact counts remain stable.
- `GET /api/fact-bundles` returns the index with at least the bundle just created.
- `GET /api/fact-bundles/YYYY-WNN` returns the correct bundle with a `factCount` matching the DB count.

---

### 32.7 — Fact Coverage Dashboard

**Goal**: Add a Svelte-based admin dashboard page at `/admin/coverage` (served by the existing Fastify dashboard on port 3002) showing: (a) total approved/draft/archived counts by category, (b) difficulty tier heat map, (c) quality score distribution chart, (d) category coverage vs. the 200-fact minimum threshold (DD-V2-091), (e) weekly velocity chart (approvals per calendar week), and (f) distractor depth table per category. The dashboard pulls data from a new `GET /api/admin/coverage` endpoint.

**Files affected**:
- `server/src/routes/admin.ts` — add `GET /coverage` sub-route
- `server/src/dashboard/index.ts` — add `/coverage` HTML page route
- `server/src/dashboard/public/coverage.html` — new file
- `server/src/dashboard/public/coverage.js` — new file (vanilla JS, no bundler)

#### 32.7.1 — Coverage data endpoint in `server/src/routes/admin.ts`

Add the following route inside the existing `adminRoutes` function:

```typescript
// GET /api/admin/coverage — fact coverage statistics
fastify.get('/coverage', { preHandler: requireAdmin }, async (_req, reply) => {
  // Category distribution
  interface CategoryRow {
    category_l1: string;
    status: string;
    count: number;
  }
  const byCategory = factsDb.prepare(
    `SELECT category_l1, status, COUNT(*) as count
     FROM facts
     GROUP BY category_l1, status
     ORDER BY category_l1, status`,
  ).all() as CategoryRow[];

  // Difficulty tier distribution (approved only)
  interface TierRow { difficulty_tier: string; count: number }
  const byTier = factsDb.prepare(
    `SELECT difficulty_tier, COUNT(*) as count
     FROM facts WHERE status = 'approved'
     GROUP BY difficulty_tier`,
  ).all() as TierRow[];

  // Quality score histogram (10 buckets: 0-9, 10-19, ..., 90-100)
  interface QualityBucket { bucket: number; count: number }
  const qualityBuckets = factsDb.prepare(
    `SELECT CAST(quality_score / 10 AS INTEGER) * 10 as bucket, COUNT(*) as count
     FROM facts
     WHERE quality_score IS NOT NULL
     GROUP BY bucket
     ORDER BY bucket`,
  ).all() as QualityBucket[];

  // Weekly approval velocity (last 12 weeks)
  interface VelocityRow { week: string; count: number }
  const velocity = factsDb.prepare(
    `SELECT strftime('%Y-W%W', datetime(updated_at / 1000, 'unixepoch')) as week,
            COUNT(*) as count
     FROM facts
     WHERE status = 'approved'
       AND updated_at > (unixepoch() - 84 * 86400) * 1000
     GROUP BY week
     ORDER BY week`,
  ).all() as VelocityRow[];

  // Distractor depth per category
  interface DistractorDepthRow {
    category_l1: string;
    avg_distractors: number;
    min_distractors: number;
    facts_below_threshold: number;
  }
  const distractorDepth = factsDb.prepare(
    `SELECT f.category_l1,
            AVG(f.distractor_count) as avg_distractors,
            MIN(f.distractor_count) as min_distractors,
            SUM(CASE WHEN f.distractor_count < 8 THEN 1 ELSE 0 END) as facts_below_threshold
     FROM facts f
     WHERE f.status = 'approved'
     GROUP BY f.category_l1
     ORDER BY facts_below_threshold DESC`,
  ).all() as DistractorDepthRow[];

  // Totals
  interface TotalRow { status: string; count: number }
  const totals = factsDb.prepare(
    `SELECT status, COUNT(*) as count FROM facts GROUP BY status`,
  ).all() as TotalRow[];

  return reply.send({
    byCategory,
    byTier,
    qualityBuckets,
    velocity,
    distractorDepth,
    totals,
    categoryThreshold: 200,
    totalTarget: 3000,
  });
});
```

#### 32.7.2 — Dashboard page route

In `server/src/dashboard/index.ts`, add:

```typescript
// GET /coverage — serve coverage dashboard HTML
app.get('/coverage', (_req, reply) => {
  reply.type('text/html').send(
    fs.readFileSync(path.join(PUBLIC_DIR, 'coverage.html'), 'utf8'),
  );
});
```

#### 32.7.3 — `server/src/dashboard/public/coverage.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Recall Rogue — Fact Coverage Dashboard</title>
  <style>
    body { font-family: monospace; background: #111; color: #ccc; padding: 20px; }
    h1 { color: #0cf; }
    h2 { color: #fc0; border-bottom: 1px solid #333; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
    th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
    th { background: #222; color: #0cf; }
    .pass  { color: #0f0; }
    .warn  { color: #fc0; }
    .fail  { color: #f44; }
    .bar   { display: inline-block; background: #0cf; height: 12px; }
    .bar-r { display: inline-block; background: #f44; height: 12px; }
    #progress { font-size: 1.4em; color: #0f0; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>Recall Rogue — Fact Coverage Dashboard</h1>
  <div id="progress">Loading…</div>
  <div id="content"></div>
  <script src="coverage.js"></script>
</body>
</html>
```

#### 32.7.4 — `server/src/dashboard/public/coverage.js`

```javascript
(async () => {
  const res  = await fetch('/api/admin/coverage');
  const data = await res.json();
  const el   = document.getElementById('content');
  const prog = document.getElementById('progress');

  // Progress bar toward 3,000
  const approved = data.totals.find(t => t.status === 'approved')?.count ?? 0;
  const pct = Math.min(100, Math.round((approved / data.totalTarget) * 100));
  prog.innerHTML =
    `<span class="bar" style="width:${pct * 2}px"></span> ` +
    `${approved} / ${data.totalTarget} approved (${pct}%)`;

  let html = '';

  // Category table
  html += '<h2>Category Coverage</h2><table><tr><th>Category</th>' +
    '<th>Approved</th><th>Draft</th><th>Archived</th><th>Status</th></tr>';
  const cats = {};
  for (const row of data.byCategory) {
    if (!cats[row.category_l1]) cats[row.category_l1] = {};
    cats[row.category_l1][row.status] = row.count;
  }
  for (const [cat, counts] of Object.entries(cats)) {
    const appr = counts['approved'] ?? 0;
    const cls  = appr >= data.categoryThreshold ? 'pass' : appr >= 100 ? 'warn' : 'fail';
    html += `<tr>
      <td>${cat}</td>
      <td class="${cls}">${appr}</td>
      <td>${counts['draft'] ?? 0}</td>
      <td>${counts['archived'] ?? 0}</td>
      <td class="${cls}">${appr >= data.categoryThreshold ? 'OK' : `NEEDS ${data.categoryThreshold - appr} MORE`}</td>
    </tr>`;
  }
  html += '</table>';

  // Difficulty tier table
  html += '<h2>Difficulty Tier Distribution (approved)</h2><table><tr><th>Tier</th><th>Count</th><th>Bar</th></tr>';
  for (const row of data.byTier) {
    const w = Math.min(200, row.count / 5);
    html += `<tr><td>${row.difficulty_tier}</td><td>${row.count}</td>
      <td><span class="bar" style="width:${w}px"></span></td></tr>`;
  }
  html += '</table>';

  // Quality score histogram
  html += '<h2>Quality Score Distribution</h2><table><tr><th>Score Bucket</th><th>Count</th></tr>';
  for (const row of data.qualityBuckets) {
    const label = row.bucket === null ? 'not scored' : `${row.bucket}–${row.bucket + 9}`;
    html += `<tr><td>${label}</td><td>${row.count}</td></tr>`;
  }
  html += '</table>';

  // Weekly velocity
  html += '<h2>Approval Velocity (last 12 weeks)</h2><table><tr><th>Week</th><th>Approved</th></tr>';
  for (const row of data.velocity) {
    html += `<tr><td>${row.week}</td><td>${row.count}</td></tr>`;
  }
  html += '</table>';

  // Distractor depth
  html += '<h2>Distractor Depth by Category</h2>' +
    '<table><tr><th>Category</th><th>Avg Distractors</th><th>Min</th><th>Below 8</th></tr>';
  for (const row of data.distractorDepth) {
    const cls = row.facts_below_threshold === 0 ? 'pass' : row.facts_below_threshold < 10 ? 'warn' : 'fail';
    html += `<tr>
      <td>${row.category_l1}</td>
      <td>${(row.avg_distractors ?? 0).toFixed(1)}</td>
      <td>${row.min_distractors ?? 0}</td>
      <td class="${cls}">${row.facts_below_threshold}</td>
    </tr>`;
  }
  html += '</table>';

  el.innerHTML = html;
})();
```

**Acceptance criteria for 32.7**:
- Navigating to `http://localhost:3002/coverage` renders a page with all five sections.
- The progress bar accurately reflects `approved / 3000`.
- Categories with fewer than 200 approved facts show in red/yellow.
- A new `GET /api/admin/coverage` call returns all required fields including `byCategory`, `byTier`, `qualityBuckets`, `velocity`, and `distractorDepth`.

---

## Playwright Test Scripts

### Test 32.A — Delta Sync Full Cycle

```javascript
// /tmp/test-32a-delta-sync.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('http://localhost:5173');
  await page.waitForSelector('button', { timeout: 15000 });

  // Verify sync version key is set after initialization
  const syncVersion = await page.evaluate(() =>
    localStorage.getItem('recall-rogue-fact-sync-version')
  );
  console.log('Sync version after init:', syncVersion);
  if (syncVersion === null) {
    console.error('FAIL: sync version not set in localStorage');
    process.exit(1);
  }
  if (parseInt(syncVersion, 10) < 0) {
    console.error('FAIL: sync version is negative');
    process.exit(1);
  }

  await page.screenshot({ path: '/tmp/ss-32a-delta-sync.png' });
  console.log('PASS: delta sync initialized with version', syncVersion);
  await browser.close();
})();
```

### Test 32.B — Coverage Dashboard

```javascript
// /tmp/test-32b-coverage.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:3002/coverage');
  await page.waitForFunction(
    () => !document.getElementById('progress')?.textContent?.includes('Loading'),
    { timeout: 10000 }
  );

  const progressText = await page.evaluate(() =>
    document.getElementById('progress')?.textContent ?? ''
  );
  console.log('Progress bar text:', progressText);

  const hasTable = await page.evaluate(() =>
    document.querySelectorAll('table').length >= 4
  );
  if (!hasTable) {
    console.error('FAIL: expected at least 4 tables in coverage dashboard');
    process.exit(1);
  }

  await page.screenshot({ path: '/tmp/ss-32b-coverage-dashboard.png', fullPage: true });
  console.log('PASS: coverage dashboard rendered with all sections');
  await browser.close();
})();
```

### Test 32.C — Quality Gate API

```javascript
// /tmp/test-32c-quality-gate.js
// Assumes a fact exists in draft status with full content generated.
// Run after: npm run pipeline (which generates content for queued facts).
const assert = require('node:assert');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? 'dev-admin-token';
const BASE = 'http://localhost:3001';

(async () => {
  // Get a draft fact with distractors
  const listRes = await fetch(`${BASE}/api/facts?status=draft&limit=1`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  const list = await listRes.json();

  if (!list.facts?.length) {
    console.log('SKIP: no draft facts available to test quality gate');
    process.exit(0);
  }

  const factId = list.facts[0].id;
  console.log(`Testing quality gate on fact ${factId}`);

  const gateRes = await fetch(`${BASE}/api/facts/${factId}/quality-gate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  assert.strictEqual(gateRes.status, 200, 'Quality gate endpoint should return 200');
  const body = await gateRes.json();
  assert.ok(body.result, 'Response should have a result');
  assert.ok(['pass', 'fail', 'needs_edit'].includes(body.result.overall),
    `overall should be a valid status, got: ${body.result.overall}`);

  console.log('PASS: quality gate returned overall:', body.result.overall);
})().catch((e) => { console.error(e); process.exit(1); });
```

---

## Verification Gate

All of the following checks MUST pass before Phase 32 is marked complete.

### TypeScript

```bash
cd /root/terra-miner
npm run typecheck
```

Expected: zero type errors in `server/src/**` and `src/**`.

### Build

```bash
npm run build
```

Expected: production build completes with no errors. Chunk sizes within budget (Phaser + sql-wasm chunks < 500 KB each as defined in `vite.config.ts`).

### Database Migration

```bash
node -e "
  import('./server/src/db/facts-db.js').then(({ factsDb }) => {
    import('./server/src/db/facts-migrate.js').then(({ initFactsSchema }) => {
      initFactsSchema();
      const cols = factsDb.prepare(\"PRAGMA table_info(facts)\").all();
      const names = cols.map(c => c.name);
      const required = ['difficulty_tier', 'source_quality', 'quality_gate_status', 'quality_score', 'bundle_tag'];
      for (const col of required) {
        if (!names.includes(col)) { console.error('MISSING:', col); process.exit(1); }
      }
      console.log('PASS: all new columns present');
    });
  });
"
```

Expected: prints `PASS: all new columns present`.

### Quality Gate Smoke Test

Start the server (`npm run dev:server`), then:

```bash
node /tmp/test-32c-quality-gate.js
```

Expected: `PASS` or `SKIP` (if no draft facts with content are in the DB).

### Delta Sync API

```bash
curl -s "http://localhost:3001/api/facts/delta?since=0&limit=10" | node -e "
  let d = ''; process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    const j = JSON.parse(d);
    if (!Array.isArray(j.facts)) { console.error('FAIL: no facts array'); process.exit(1); }
    if (!('latestVersion' in j)) { console.error('FAIL: no latestVersion'); process.exit(1); }
    console.log('PASS: delta response has', j.facts.length, 'facts, version', j.latestVersion);
  });
"
```

Expected: `PASS: delta response has N facts, version V` (N may be 0 if no approved facts yet).

### Bundle Release

```bash
cd /root/terra-miner
npm run --prefix server release-bundle
ls public/fact-bundles/
```

Expected: a `YYYY-WNN.json` file and `index.json` appear in `public/fact-bundles/`.

### Coverage Dashboard

```bash
node /tmp/test-32b-coverage.js
```

Expected: `PASS: coverage dashboard rendered with all sections`. Screenshot saved to `/tmp/ss-32b-coverage-dashboard.png`.

### Playwright Delta Sync

Start the dev server (`npm run dev`), then:

```bash
node /tmp/test-32a-delta-sync.js
```

Expected: `PASS: delta sync initialized with version N`.

### Distractor Expansion Smoke Test

```bash
node -e "
import('./server/src/services/distractorExpander.js').then(({ expandDistractorsBatch }) => {
  expandDistractorsBatch(5).then(added => {
    console.log('Distractor expansion added:', added, 'distractors');
  });
});
"
```

Expected: completes without error (added count may be 0 if all facts already have 8+ distractors).

### Gap Analysis Check

```bash
curl -s -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "http://localhost:3001/api/facts/gap-analysis" | \
  node -e "
    let d = ''; process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      const j = JSON.parse(d);
      console.log('Gap analysis:', j.gaps.length, 'categories below threshold');
      console.log('PASS');
    });
  "
```

Expected: prints the number of categories below threshold and `PASS`.

---

## Files Affected

### New Server Files

| File | Purpose |
|------|---------|
| `server/src/types/factTypes.ts` | Shared TypeScript interfaces for fact/distractor rows |
| `server/src/services/batchGenerator.ts` | Topic → statement generation via Claude |
| `server/src/services/rateLimiter.ts` | Token-bucket concurrency control for Claude API |
| `server/src/services/qualityGate.ts` | 3rd-stage LLM quality gate (accuracy, distractors, readability) |
| `server/src/services/distractorExpander.ts` | Targeted distractor expansion to 8+ per fact |
| `server/src/scripts/generate-batch.ts` | CLI: generate fact batch from seed topic |
| `server/src/scripts/expand-distractors.ts` | CLI: expand thin distractor sets |
| `server/src/scripts/release-bundle.ts` | CLI: create weekly versioned fact bundle |
| `server/src/routes/factBundles.ts` | Bundle discovery endpoints |
| `server/src/jobs/bundleScheduler.ts` | Weekly auto-release cron trigger |
| `server/src/dashboard/public/coverage.html` | Coverage dashboard HTML page |
| `server/src/dashboard/public/coverage.js` | Coverage dashboard vanilla JS |

### Modified Server Files

| File | Change |
|------|--------|
| `server/src/db/facts-migrate.ts` | Add `difficulty_tier`, `source_quality`, `quality_gate_*`, `bundle_tag`, `seed_topic` columns; add `similarity_to_answer`, `gate_approved` on `distractors`; new indexes |
| `server/src/services/llmPrompts.ts` | Add `buildQualityGatePrompt()` and `QualityGateInput` interface |
| `server/src/workers/pipelineWorker.ts` | Export `processBatch()`; integrate `runQualityGate()` after content generation; add `processBatch` concurrency control |
| `server/src/routes/facts.ts` | Extend `PATCHABLE_FIELDS`; add `POST /:id/quality-gate` and `POST /:id/expand-distractors` endpoints; harden `GET /delta` with `ETag`, `category` filter, `nextCursor` |
| `server/src/routes/admin.ts` | Add `GET /coverage` analytics endpoint |
| `server/src/dashboard/index.ts` | Register `/coverage` route |
| `server/src/index.ts` | Register `factBundleRoutes`; call `startBundleScheduler()` |
| `server/package.json` | Add `generate-batch`, `expand-distractors`, `release-bundle` scripts |

### New Client Files

| File | Purpose |
|------|---------|
| `src/services/deltaSync.ts` | Client delta sync: cursor management, fetch, apply delta to sql.js |

### Modified Client Files

| File | Change |
|------|--------|
| `src/services/saveService.ts` | Add `lastSyncVersion: number` to `PlayerSave` defaults |
| `src/main.ts` | Call `runDeltaSync()` after facts DB loads; show sync toast |

### New Public Assets

| File | Purpose |
|------|---------|
| `public/fact-bundles/index.json` | Bundle manifest index (created at first release) |
| `public/fact-bundles/YYYY-WNN.json` | Individual weekly bundles (created per release) |
