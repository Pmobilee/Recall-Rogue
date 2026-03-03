# Phase 11: Fact Content Engine

## Overview

Phase 11 builds the automated pipeline for ingesting, categorizing, illustrating, and serving thousands of facts at scale. The current system hard-codes ~522 facts in `src/data/seed/*.json` and ships them in a client-side `public/facts.db` compiled by `scripts/build-facts-db.mjs`. That approach cannot support live content updates, semantic duplicate detection, LLM-generated distractors, or pixel art automation.

Phase 11 transforms facts into a server-managed content system while preserving the offline-first guarantee: the client always has a local cache and never blocks on a network call to show a quiz.

Design decisions that govern all work in this phase:
- **DD-V2-085**: Fact extraction via Claude API from human-selected sources (Wikipedia, books); 50-100 per session.
- **DD-V2-086**: Second LLM distractor-validation pass; `distractor_confidence` score stored per distractor.
- **DD-V2-087**: Distractors tiered as easy/medium/hard; served by SM-2 mastery level.
- **DD-V2-088**: Fully automated LLM review pipeline; three states: draft/approved/archived; no human in approval loop.
- **DD-V2-089**: In-game "Report this fact" button; `sourceUrl` field; auto-flag at 3+ reports.
- **DD-V2-090**: Minimum 12 distractors per fact; `distractor_count` field.
- **DD-V2-091**: Minimum 200 facts per top-level category; gap analysis tool for subcategories < 20.
- **DD-V2-092**: `content_volatility` enum: timeless/slow_change/current_events.
- **DD-V2-093**: Server becomes source of truth; client uses sql.js as cache; offline-first non-negotiable.
- **DD-V2-104**: `acceptableAnswers: string[]` field added now for future fill-in-blank support.
- **DD-V2-105**: Three `gaiaWrongComments` per fact — one per GAIA mood (snarky/enthusiastic/calm).
- **DD-V2-106**: `mnemonic` pre-populated for ALL facts; surfaced when player answers wrong 3+ times.
- **DD-V2-112**: 2-3 `alternateExplanations` per fact for failure escalation (repeating same text 5x adds zero value).
- **DD-V2-114**: `gaiaComments: string[]` array (3-5 entries) instead of single `gaiaComment: string`.
- **DD-V2-121**: `related_facts` auto-populated via semantic similarity; within subcategory first, then cross-category.

## Prerequisites

- Fastify server running and reachable (port 3001 in dev); `server/src/index.ts` builds cleanly.
- `ANTHROPIC_API_KEY` in `server/.env` (never committed; gitignored).
- ComfyUI server running at `http://localhost:8188` with SDXL + pixel art LoRA loaded for Phase 11.6.
- `rembg` available at `/opt/comfyui-env/bin/rembg` for background removal.
- `better-sqlite3` + Drizzle ORM already set up in `server/src/db/`.
- `src/data/seed/*.json` files exist as starting dataset.

---

## Sub-Phase 11.7: Database Schema Updates

**Implement first** — all other sub-phases depend on the expanded schema.

### What

Add every new field mandated by DD-V2-085 through DD-V2-121 to the server-side facts database. The server uses `better-sqlite3` with raw DDL (not Drizzle ORM for the facts table, which lives in a separate database file from the user/saves database). Migrate the client-side TypeScript `Fact` interface in `src/data/types.ts` to match.

### Where

- `server/src/db/facts-schema.ts` — new file; Drizzle table definition for `facts` and `distractors`
- `server/src/db/facts-db.ts` — new file; singleton connection to `server/data/facts.db`
- `server/src/db/facts-migrate.ts` — new file; idempotent DDL runner for facts schema
- `src/data/types.ts` — expand `Fact` and `ReviewState` interfaces

### How

**Step 1 — Create `server/data/` directory** (gitignored except for `.gitkeep`):

```
server/data/.gitkeep
```

Add to `server/.gitignore`:
```
data/*.db
data/*.db-shm
data/*.db-wal
```

**Step 2 — Create `server/src/db/facts-db.ts`**:

```typescript
/**
 * Separate SQLite connection for the facts content database.
 * Kept separate from the user/saves database so facts can be
 * deployed, updated, and backed up independently.
 */
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FACTS_DB_PATH = path.resolve(__dirname, '../../data/facts.db');

fs.mkdirSync(path.dirname(FACTS_DB_PATH), { recursive: true });

export const factsDb = new Database(FACTS_DB_PATH);
factsDb.pragma('journal_mode = WAL');
factsDb.pragma('foreign_keys = ON');
```

**Step 3 — Create `server/src/db/facts-migrate.ts`** with full DDL:

```typescript
import { factsDb } from './facts-db.js';

/**
 * Idempotent schema migration for the facts content database.
 * Uses ALTER TABLE ADD COLUMN IF NOT EXISTS pattern where supported,
 * and catches "duplicate column" errors gracefully for older SQLite.
 * Safe to run on every server startup.
 */
export function initFactsSchema(): void {

  // ── Core facts table ──────────────────────────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS facts (
      -- Identity
      id                    TEXT    PRIMARY KEY,
      type                  TEXT    NOT NULL DEFAULT 'fact',
                                    -- 'fact' | 'vocabulary' | 'grammar' | 'phrase'

      -- Pipeline state (DD-V2-088)
      status                TEXT    NOT NULL DEFAULT 'draft',
                                    -- 'draft' | 'approved' | 'archived'
      in_game_reports       INTEGER NOT NULL DEFAULT 0,
                                    -- (DD-V2-089) auto-flag for re-review at 3+

      -- Core content
      statement             TEXT    NOT NULL,
      wow_factor            TEXT,
      explanation           TEXT    NOT NULL,
      alternate_explanations TEXT,  -- JSON array string[] (DD-V2-112)

      -- GAIA content
      gaia_comments         TEXT,   -- JSON array string[] 3-5 entries (DD-V2-114)
      gaia_wrong_comments   TEXT,   -- JSON object {snarky,enthusiastic,calm} (DD-V2-105)

      -- Quiz
      quiz_question         TEXT    NOT NULL,
      correct_answer        TEXT    NOT NULL,
      acceptable_answers    TEXT,   -- JSON array string[] for future fill-in-blank (DD-V2-104)
      distractor_count      INTEGER NOT NULL DEFAULT 0,
                                    -- (DD-V2-090) cached count of approved distractors

      -- Classification
      category_l1           TEXT    NOT NULL DEFAULT '',
                                    -- top-level e.g. 'Natural Sciences'
      category_l2           TEXT    NOT NULL DEFAULT '',
                                    -- e.g. 'Biology'
      category_l3           TEXT    NOT NULL DEFAULT '',
                                    -- e.g. 'Evolution'
      category_legacy       TEXT,   -- JSON string[] kept for backward-compat client cache
      rarity                TEXT    NOT NULL DEFAULT 'common',
      difficulty            INTEGER NOT NULL DEFAULT 3,
      fun_score             INTEGER NOT NULL DEFAULT 5,
      novelty_score         INTEGER NOT NULL DEFAULT 5,
      age_rating            TEXT    NOT NULL DEFAULT 'teen',
      sensitivity_level     INTEGER NOT NULL DEFAULT 0,
      sensitivity_note      TEXT,

      -- Content volatility (DD-V2-092)
      content_volatility    TEXT    NOT NULL DEFAULT 'timeless',
                                    -- 'timeless' | 'slow_change' | 'current_events'

      -- Sourcing (DD-V2-089)
      source_name           TEXT,
      source_url            TEXT,

      -- Connections (DD-V2-121)
      related_facts         TEXT,   -- JSON array of fact IDs
      tags                  TEXT,   -- JSON array of string tags

      -- Memory aid (DD-V2-106)
      mnemonic              TEXT,

      -- Pixel art (Phase 11.6)
      image_prompt          TEXT,
      visual_description    TEXT,
      image_url             TEXT,
      has_pixel_art         INTEGER NOT NULL DEFAULT 0,
      pixel_art_status      TEXT    NOT NULL DEFAULT 'none',
                                    -- 'none'|'generating'|'review'|'approved'|'rejected'

      -- Language-specific (optional)
      language              TEXT,
      pronunciation         TEXT,
      example_sentence      TEXT,

      -- Timestamps
      created_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_reviewed_at      INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_facts_status        ON facts(status);
    CREATE INDEX IF NOT EXISTS idx_facts_type          ON facts(type);
    CREATE INDEX IF NOT EXISTS idx_facts_rarity        ON facts(rarity);
    CREATE INDEX IF NOT EXISTS idx_facts_difficulty    ON facts(difficulty);
    CREATE INDEX IF NOT EXISTS idx_facts_age_rating    ON facts(age_rating);
    CREATE INDEX IF NOT EXISTS idx_facts_category_l1   ON facts(category_l1);
    CREATE INDEX IF NOT EXISTS idx_facts_category_l2   ON facts(category_l1, category_l2);
    CREATE INDEX IF NOT EXISTS idx_facts_pixel_status  ON facts(pixel_art_status);
    CREATE INDEX IF NOT EXISTS idx_facts_volatility    ON facts(content_volatility);
    CREATE INDEX IF NOT EXISTS idx_facts_reports       ON facts(in_game_reports);
  `);

  // ── Distractors table (normalized for per-distractor confidence) ──────────
  // Replaces JSON distractors array so each distractor has its own metadata.
  // (DD-V2-086 distractor_confidence, DD-V2-087 difficulty_tier)
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS distractors (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id               TEXT    NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      text                  TEXT    NOT NULL,
      difficulty_tier       TEXT    NOT NULL DEFAULT 'medium',
                                    -- 'easy' | 'medium' | 'hard'  (DD-V2-087)
      distractor_confidence REAL    NOT NULL DEFAULT 1.0,
                                    -- 0.0–1.0; only serve if >= 0.7 (DD-V2-086)
      is_approved           INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_distractors_fact_id   ON distractors(fact_id);
    CREATE INDEX IF NOT EXISTS idx_distractors_confidence ON distractors(distractor_confidence);
    CREATE INDEX IF NOT EXISTS idx_distractors_tier       ON distractors(fact_id, difficulty_tier);
  `);

  // ── Fact reports table (DD-V2-089) ────────────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS fact_reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id     TEXT    NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      player_id   TEXT,           -- null for anonymous
      report_text TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_reports_fact_id ON fact_reports(fact_id);
  `);

  // ── Fact pack export log (DD-V2-093 offline sync) ─────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS fact_pack_versions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_name   TEXT    NOT NULL,   -- e.g. 'base', 'natural-sciences'
      version     INTEGER NOT NULL,   -- monotonically increasing
      fact_count  INTEGER NOT NULL,
      built_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      file_path   TEXT    NOT NULL
    );
  `);

  console.log('[facts-db] Schema initialised.');
}
```

**Step 4 — Update `server/src/index.ts`** to call `initFactsSchema()` at startup alongside the existing `initSchema()`:

In `buildApp()` before registering routes, add:
```typescript
import { initFactsSchema } from './db/facts-migrate.js';
// inside start():
initFactsSchema();
```

**Step 5 — Update `src/data/types.ts`** — expand the `Fact` interface and `ReviewState`:

Replace the existing `Fact` interface with:

```typescript
/** Distractor with confidence score and difficulty tier (DD-V2-086, DD-V2-087) */
export interface Distractor {
  text: string
  difficultyTier: 'easy' | 'medium' | 'hard'
  distractorConfidence: number   // 0.0–1.0; only served if >= 0.7
}

/** Content volatility enum (DD-V2-092) */
export type ContentVolatility = 'timeless' | 'slow_change' | 'current_events'

/** Pixel art generation status */
export type PixelArtStatus = 'none' | 'generating' | 'review' | 'approved' | 'rejected'

/** Pipeline review state (DD-V2-088) */
export type FactStatus = 'draft' | 'approved' | 'archived'

/** GAIA wrong-answer comments per mood (DD-V2-105) */
export interface GaiaWrongComments {
  snarky: string
  enthusiastic: string
  calm: string
}

/** A single learnable fact/word in the database */
export interface Fact {
  id: string
  type: ContentType
  status: FactStatus           // DD-V2-088

  // Core content
  statement: string
  wowFactor?: string
  explanation: string
  alternateExplanations?: string[]  // DD-V2-112: 2-3 variants for failure escalation

  // GAIA content
  gaiaComments?: string[]           // DD-V2-114: 3-5 entries, replaces gaiaComment
  gaiaComment?: string              // Legacy — kept for backward compat with old seed data
  gaiaWrongComments?: GaiaWrongComments  // DD-V2-105

  // Quiz
  quizQuestion: string
  correctAnswer: string
  acceptableAnswers?: string[]   // DD-V2-104: future fill-in-blank variants
  distractors: string[]          // Legacy flat array (used by client cache)
  distractorObjects?: Distractor[] // Full structured distractors (from server)
  distractorCount?: number       // DD-V2-090: count of approved distractors

  // Classification
  category: string[]             // Hierarchical: ["Natural Sciences", "Biology", "Evolution"]
  categoryL1?: string            // DD-V2 hierarchical decomposition
  categoryL2?: string
  categoryL3?: string
  rarity: Rarity
  difficulty: number             // 1-5
  funScore: number               // 1-10
  noveltyScore?: number          // 1-10
  ageRating: AgeRating
  sensitivityLevel?: number      // 0-5
  sensitivityNote?: string

  // Content volatility (DD-V2-092)
  contentVolatility?: ContentVolatility

  // Sourcing (DD-V2-089)
  sourceName?: string
  sourceUrl?: string             // NEW: clickable link for player verification
  inGameReports?: number         // NEW: report counter

  // Connections (DD-V2-121)
  relatedFacts?: string[]        // Fact IDs of related facts
  tags?: string[]

  // Memory aid (DD-V2-106)
  mnemonic?: string

  // Pixel art
  imagePrompt?: string
  visualDescription?: string     // What the pixel art should show
  imageUrl?: string
  hasPixelArt?: boolean
  pixelArtStatus?: PixelArtStatus

  // Language-specific (optional)
  language?: string
  pronunciation?: string
  exampleSentence?: string
}
```

Add `lastReviewContext` to `ReviewState` (DD-V2-097):

```typescript
export interface ReviewState {
  factId: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewAt: number
  lastReviewAt: number
  quality: number
  lastReviewContext?: 'study' | 'mine' | 'ritual'  // DD-V2-097
}
```

**Step 6 — Update `scripts/build-facts-db.mjs`** to handle both old schema (flat distractors string array) and new fields when seeding the client-side `public/facts.db`. Add new columns to DDL and `factToRow()`. The new columns should default to empty/null so old seed files still work.

### Acceptance Criteria

- `npm run typecheck` passes with no errors on updated `types.ts`
- `server/src/db/facts-migrate.ts` can be run in isolation: `node --loader ts-node/esm server/src/db/facts-migrate.ts` creates `server/data/facts.db` with all tables
- All indexes exist: `sqlite3 server/data/facts.db ".indexes"` shows all 10+ indexes
- `distractors` table has `fact_id` foreign key with `ON DELETE CASCADE`
- Old seed data still loads via `npm run build` (build-facts-db.mjs does not break)

### API Test Commands

```bash
# Verify facts DB created with correct schema
node -e "
const D = require('better-sqlite3');
const db = new D('./server/data/facts.db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
console.log(tables.map(t => t.name));
// Expected: ['facts','distractors','fact_reports','fact_pack_versions']
"

# Verify new columns exist
node -e "
const D = require('better-sqlite3');
const db = new D('./server/data/facts.db');
const info = db.prepare('PRAGMA table_info(facts)').all();
const cols = info.map(c => c.name);
['status','content_volatility','source_url','distractor_count',
 'gaia_comments','gaia_wrong_comments','alternate_explanations',
 'acceptable_answers','category_l1','category_l2','category_l3',
 'visual_description','has_pixel_art','pixel_art_status','in_game_reports'
].forEach(c => console.assert(cols.includes(c), 'MISSING: ' + c));
console.log('All columns present');
"
```

---

## Sub-Phase 11.1: Fact Ingestion API Endpoint

### What

A POST endpoint at `/api/facts/ingest` that accepts raw fact text or structured fact JSON, runs semantic duplicate detection against existing approved facts, and returns a structured response. Supports both single-fact and batch (array) ingestion. This is the entry point for the extraction pipeline (DD-V2-085).

The endpoint is admin-only — protected by a static `ADMIN_API_KEY` header, not player JWTs.

### Where

- `server/src/routes/facts.ts` — new file; all fact-management routes
- `server/src/middleware/adminAuth.ts` — new file; admin key check preHandler
- `server/src/services/deduplication.ts` — new file; semantic similarity logic
- `server/src/index.ts` — register `factsRoutes` with prefix `/api/facts`
- `server/.env` — add `ADMIN_API_KEY` and `ANTHROPIC_API_KEY`
- `server/src/config.ts` — add `adminApiKey` and `anthropicApiKey` fields

### How

**Step 1 — Update `server/src/config.ts`** to add new env vars:

```typescript
export interface Config {
  // ...existing fields...
  adminApiKey: string;
  anthropicApiKey: string;
  comfyuiUrl: string;
  distractorConfidenceThreshold: number;  // Default 0.7
}

// In the config object:
adminApiKey: env('ADMIN_API_KEY', 'dev-admin-key-change-me'),
anthropicApiKey: env('ANTHROPIC_API_KEY', ''),
comfyuiUrl: env('COMFYUI_URL', 'http://localhost:8188'),
distractorConfidenceThreshold: parseFloat(env('DISTRACTOR_CONFIDENCE_THRESHOLD', '0.7')),
```

**Step 2 — Create `server/src/middleware/adminAuth.ts`**:

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

/**
 * Fastify preHandler that enforces admin API key authentication.
 * Reads the X-Admin-Key header. Returns 401 if missing or wrong.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const key = request.headers['x-admin-key'];
  if (!key || key !== config.adminApiKey) {
    reply.status(401).send({ error: 'Unauthorized', statusCode: 401 });
  }
}
```

**Step 3 — Create `server/src/services/deduplication.ts`**:

Semantic duplicate detection uses the Claude API to compare a candidate fact's statement against the 20 most similar existing facts (pre-filtered by category). This avoids a full table scan and is good enough for a facts database up to ~50,000 entries.

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { factsDb } from '../db/facts-db.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * Check whether a candidate fact statement is too similar to existing approved facts.
 * Returns: { isDuplicate: boolean, similarFactId?: string, similarity?: number }
 *
 * Strategy: Pull up to 50 approved facts from the same category_l1,
 * then ask Claude to rate similarity on a 0-1 scale. Reject if any
 * existing fact scores >= threshold (default 0.85).
 *
 * @param statement - The candidate fact statement to check.
 * @param categoryL1 - Top-level category for pre-filtering.
 * @param threshold  - Similarity threshold above which we reject (default 0.85).
 */
export async function checkDuplicate(
  statement: string,
  categoryL1: string,
  threshold = 0.85
): Promise<{ isDuplicate: boolean; similarFactId?: string; similarity?: number }> {
  if (!config.anthropicApiKey) {
    // In dev without API key, skip duplicate check
    return { isDuplicate: false };
  }

  const existingFacts = factsDb.prepare(
    `SELECT id, statement FROM facts
     WHERE status = 'approved' AND category_l1 = ?
     ORDER BY RANDOM() LIMIT 50`
  ).all(categoryL1) as Array<{ id: string; statement: string }>;

  if (existingFacts.length === 0) return { isDuplicate: false };

  const factsForPrompt = existingFacts
    .map((f, i) => `[${i}] ID:${f.id} — ${f.statement}`)
    .join('\n');

  const prompt = `You are a semantic duplicate detector for an educational fact database.

CANDIDATE FACT:
"${statement}"

EXISTING FACTS (up to 50):
${factsForPrompt}

Task: For each existing fact, output a JSON array where each element is:
{ "index": <number>, "id": "<fact_id>", "similarity": <0.0 to 1.0> }

Similarity scoring:
- 1.0 = identical meaning, same claim
- 0.9 = extremely similar, would confuse players
- 0.7 = related topic but different specific claim
- 0.5 = same broad domain
- 0.0 = completely different

Output ONLY the JSON array, nothing else.`;

  let parsed: Array<{ index: number; id: string; similarity: number }>;
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    parsed = JSON.parse(text);
  } catch {
    // If LLM call fails, allow ingestion (fail open)
    return { isDuplicate: false };
  }

  const topMatch = parsed.reduce(
    (best, cur) => (cur.similarity > best.similarity ? cur : best),
    { index: -1, id: '', similarity: 0 }
  );

  if (topMatch.similarity >= threshold) {
    return { isDuplicate: true, similarFactId: topMatch.id, similarity: topMatch.similarity };
  }
  return { isDuplicate: false };
}
```

**Step 4 — Create `server/src/routes/facts.ts`**:

Full route file with all endpoints needed for Phase 11. Only the ingestion endpoint is wired in this sub-phase; the others are stubs that will be filled out in later sub-phases.

```typescript
import type { FastifyInstance } from 'fastify';
import * as crypto from 'crypto';
import { factsDb } from '../db/facts-db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { checkDuplicate } from '../services/deduplication.js';

/** Shape of a single fact in the ingest request body */
interface IngestFactInput {
  statement: string;
  categoryL1: string;
  categoryL2?: string;
  categoryL3?: string;
  sourceName?: string;
  sourceUrl?: string;
  explanation?: string;
  wowFactor?: string;
  quizQuestion?: string;
  correctAnswer?: string;
  difficulty?: number;
  ageRating?: string;
  type?: string;
  contentVolatility?: string;
}

const withAdmin = { preHandler: requireAdmin };

export async function factsRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /api/facts/ingest ────────────────────────────────────────────────
  /**
   * Ingest one or more raw facts. Accepts a single fact object or an array.
   * For each fact:
   *  1. Validates required fields (statement, categoryL1)
   *  2. Runs semantic duplicate check via Claude API
   *  3. Inserts as status='draft' if accepted
   *  4. Returns per-fact result: accepted | rejected | needs_review
   *
   * Request body: IngestFactInput | IngestFactInput[]
   * Response: { results: Array<IngestResult> }
   */
  fastify.post('/ingest', withAdmin, async (request, reply) => {
    const body = request.body as IngestFactInput | IngestFactInput[];
    const inputs: IngestFactInput[] = Array.isArray(body) ? body : [body];

    if (inputs.length === 0) {
      return reply.status(400).send({ error: 'Empty input array', statusCode: 400 });
    }
    if (inputs.length > 100) {
      return reply.status(400).send({
        error: 'Batch limit is 100 facts per request (DD-V2-085)',
        statusCode: 400,
      });
    }

    const insertStmt = factsDb.prepare(`
      INSERT INTO facts (
        id, type, status, statement, explanation, wow_factor,
        quiz_question, correct_answer,
        category_l1, category_l2, category_l3, category_legacy,
        difficulty, age_rating, content_volatility,
        source_name, source_url,
        created_at, updated_at
      ) VALUES (
        ?, ?, 'draft', ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?
      )
    `);

    const results: Array<{
      statement: string;
      result: 'accepted' | 'rejected' | 'needs_review';
      id?: string;
      reason?: string;
      similarFactId?: string;
    }> = [];

    const now = Date.now();

    for (const input of inputs) {
      if (!input.statement || !input.categoryL1) {
        results.push({
          statement: input.statement ?? '',
          result: 'rejected',
          reason: 'Missing required fields: statement, categoryL1',
        });
        continue;
      }

      const dedupResult = await checkDuplicate(input.statement, input.categoryL1);

      if (dedupResult.isDuplicate) {
        results.push({
          statement: input.statement,
          result: 'rejected',
          reason: `Too similar to existing fact (similarity=${dedupResult.similarity?.toFixed(2)})`,
          similarFactId: dedupResult.similarFactId,
        });
        continue;
      }

      // similarity 0.7-0.85 range => needs_review flag but still insert
      const needsReview = (dedupResult.similarity ?? 0) >= 0.7;

      const id = crypto.randomUUID();
      const categoryLegacy = JSON.stringify(
        [input.categoryL1, input.categoryL2, input.categoryL3].filter(Boolean)
      );

      insertStmt.run(
        id,
        input.type ?? 'fact',
        input.statement,
        input.explanation ?? '',
        input.wowFactor ?? null,
        input.quizQuestion ?? '',
        input.correctAnswer ?? '',
        input.categoryL1,
        input.categoryL2 ?? '',
        input.categoryL3 ?? '',
        categoryLegacy,
        input.difficulty ?? 3,
        input.ageRating ?? 'teen',
        input.contentVolatility ?? 'timeless',
        input.sourceName ?? null,
        input.sourceUrl ?? null,
        now,
        now
      );

      results.push({
        statement: input.statement,
        result: needsReview ? 'needs_review' : 'accepted',
        id,
      });
    }

    return reply.send({ results });
  });

  // ── GET /api/facts ────────────────────────────────────────────────────────
  /**
   * Browse facts with filtering (dashboard use). Query params:
   *   status, categoryL1, categoryL2, ageRating, hasPixelArt,
   *   pixelArtStatus, contentVolatility, minReports,
   *   page (default 1), pageSize (default 50, max 200)
   */
  fastify.get('/', withAdmin, async (request, reply) => {
    const q = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(q.pageSize ?? '50', 10)));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q.status) { conditions.push('status = ?'); params.push(q.status); }
    if (q.categoryL1) { conditions.push('category_l1 = ?'); params.push(q.categoryL1); }
    if (q.categoryL2) { conditions.push('category_l2 = ?'); params.push(q.categoryL2); }
    if (q.ageRating) { conditions.push('age_rating = ?'); params.push(q.ageRating); }
    if (q.hasPixelArt !== undefined) { conditions.push('has_pixel_art = ?'); params.push(q.hasPixelArt === 'true' ? 1 : 0); }
    if (q.pixelArtStatus) { conditions.push('pixel_art_status = ?'); params.push(q.pixelArtStatus); }
    if (q.contentVolatility) { conditions.push('content_volatility = ?'); params.push(q.contentVolatility); }
    if (q.minReports) { conditions.push('in_game_reports >= ?'); params.push(parseInt(q.minReports, 10)); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalRow = factsDb.prepare(`SELECT COUNT(*) as n FROM facts ${where}`).get(...params) as { n: number };
    const rows = factsDb.prepare(
      `SELECT * FROM facts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as unknown[];

    return reply.send({ facts: rows, total: totalRow.n, page, pageSize });
  });

  // ── GET /api/facts/:id ────────────────────────────────────────────────────
  fastify.get('/:id', withAdmin, async (request, reply) => {
    const { id } = request.params as { id: string };
    const fact = factsDb.prepare('SELECT * FROM facts WHERE id = ?').get(id);
    if (!fact) return reply.status(404).send({ error: 'Fact not found', statusCode: 404 });
    const distractors = factsDb.prepare(
      'SELECT * FROM distractors WHERE fact_id = ? ORDER BY difficulty_tier, distractor_confidence DESC'
    ).all(id);
    return reply.send({ fact, distractors });
  });

  // ── PATCH /api/facts/:id ──────────────────────────────────────────────────
  /**
   * Update any fact field. Body is a partial fact object.
   * Automatically updates updated_at timestamp.
   */
  fastify.patch('/:id', withAdmin, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Record<string, unknown>;

    // Whitelist of patchable columns (security: never allow id to be changed)
    const allowed = new Set([
      'status','statement','wow_factor','explanation','alternate_explanations',
      'gaia_comments','gaia_wrong_comments','quiz_question','correct_answer',
      'acceptable_answers','category_l1','category_l2','category_l3',
      'rarity','difficulty','fun_score','novelty_score','age_rating',
      'sensitivity_level','sensitivity_note','content_volatility',
      'source_name','source_url','related_facts','tags','mnemonic',
      'image_prompt','visual_description','image_url','has_pixel_art','pixel_art_status',
    ]);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.has(key)) {
        setClauses.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
    if (setClauses.length === 0) {
      return reply.status(400).send({ error: 'No valid fields to update', statusCode: 400 });
    }
    setClauses.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    factsDb.prepare(`UPDATE facts SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return reply.send({ ok: true });
  });

  // ── DELETE /api/facts/:id (archive) ──────────────────────────────────────
  fastify.delete('/:id', withAdmin, async (request, reply) => {
    const { id } = request.params as { id: string };
    factsDb.prepare(`UPDATE facts SET status = 'archived', updated_at = ? WHERE id = ?`)
      .run(Date.now(), id);
    return reply.send({ ok: true });
  });

  // ── POST /api/facts/:id/report ────────────────────────────────────────────
  // Player-facing — no admin auth required. See Phase 11.8.
  fastify.post('/:id/report', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { playerId, reportText } = request.body as { playerId?: string; reportText: string };

    if (!reportText || reportText.length > 200) {
      return reply.status(400).send({ error: 'reportText must be 1-200 characters', statusCode: 400 });
    }

    const fact = factsDb.prepare('SELECT id, in_game_reports FROM facts WHERE id = ?').get(id) as
      { id: string; in_game_reports: number } | undefined;
    if (!fact) return reply.status(404).send({ error: 'Fact not found', statusCode: 404 });

    factsDb.prepare(
      'INSERT INTO fact_reports (fact_id, player_id, report_text, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, playerId ?? null, reportText, Date.now());

    const newCount = fact.in_game_reports + 1;
    factsDb.prepare('UPDATE facts SET in_game_reports = ?, updated_at = ? WHERE id = ?')
      .run(newCount, Date.now(), id);

    // Auto-flag for re-review at 3+ reports (DD-V2-089)
    if (newCount >= 3) {
      factsDb.prepare(`UPDATE facts SET status = 'draft', updated_at = ? WHERE id = ? AND status = 'approved'`)
        .run(Date.now(), id);
    }

    return reply.send({ ok: true, totalReports: newCount });
  });

  // Placeholder stubs — implemented in later sub-phases:
  // POST /api/facts/extract        — 11.3 LLM extraction pipeline
  // POST /api/facts/categorize     — 11.2 LLM categorization
  // POST /api/facts/:id/generate-distractors  — 11.3
  // GET  /api/facts/gap-analysis   — 11.4 dashboard
  // GET  /api/facts/packs/:name    — 11.7 offline sync packs
}
```

**Step 5 — Register route in `server/src/index.ts`**:

```typescript
import { factsRoutes } from './routes/facts.js';
// Inside buildApp(), after existing route registrations:
await fastify.register(factsRoutes, { prefix: '/api/facts' });
```

### Acceptance Criteria

- `POST /api/facts/ingest` with header `X-Admin-Key: dev-admin-key-change-me` and body `{"statement":"Test","categoryL1":"Natural Sciences"}` returns `{"results":[{"result":"accepted","id":"<uuid>"}]}`
- Batch of 101 facts returns 400 with batch limit message
- Missing `statement` returns `result: "rejected"` for that entry
- `GET /api/facts?status=draft` returns paginated results
- `PATCH /api/facts/:id` with `{"status":"approved"}` updates the row
- `POST /api/facts/:id/report` with 3+ reports changes status back to `draft`
- `POST /api/facts/ingest` with no `X-Admin-Key` returns 401

### API Test Commands

```bash
# Start server
cd /root/terra-miner/server && npm run dev &

# Ingest a single fact
curl -s -X POST http://localhost:3001/api/facts/ingest \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: dev-admin-key-change-me" \
  -d '{"statement":"Octopuses have three hearts","categoryL1":"Natural Sciences","categoryL2":"Biology","difficulty":2,"ageRating":"kid","contentVolatility":"timeless","sourceName":"Wikipedia","sourceUrl":"https://en.wikipedia.org/wiki/Octopus"}' \
  | jq .

# Batch ingest
curl -s -X POST http://localhost:3001/api/facts/ingest \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: dev-admin-key-change-me" \
  -d '[{"statement":"Fact one","categoryL1":"History"},{"statement":"Fact two","categoryL1":"Geography"}]' \
  | jq .

# Browse facts
curl -s "http://localhost:3001/api/facts?status=draft&pageSize=5" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq '.total, .facts[0].id'

# Test 401
curl -s -X POST http://localhost:3001/api/facts/ingest \
  -H "Content-Type: application/json" \
  -d '{"statement":"test","categoryL1":"History"}' | jq .statusCode
# Expected: 401
```

---

## Sub-Phase 11.2: LLM Categorization System

### What

An LLM-powered endpoint that takes a fact's `statement` and `sourceName` and returns a hierarchical `categoryL1/L2/L3` assignment plus semantic tags and `related_facts` IDs (DD-V2-121). Auto-populates the `tags` field. Low-confidence categorizations are flagged with `needs_review` status.

### Where

- `server/src/services/categorization.ts` — new file
- `server/src/routes/facts.ts` — add `POST /api/facts/categorize` and `POST /api/facts/:id/categorize` endpoints

### How

**Create `server/src/services/categorization.ts`**:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { factsDb } from '../db/facts-db.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * Valid top-level categories (must match KNOWLEDGE_SYSTEM.md).
 * Expanding this list requires a design decision.
 */
const VALID_L1 = [
  'Natural Sciences',
  'Life Sciences',
  'History',
  'Geography',
  'Technology',
  'Culture',
  'Language',
] as const;

export interface CategorizationResult {
  categoryL1: string;
  categoryL2: string;
  categoryL3: string;
  tags: string[];
  relatedFactIds: string[];
  confidence: number;   // 0.0–1.0
  needsReview: boolean; // true if confidence < 0.75
}

/**
 * Categorize a fact statement using Claude.
 * Also identifies related existing facts in the database.
 * (DD-V2-091, DD-V2-121)
 *
 * @param factId    - ID of the fact being categorized (to exclude from related_facts).
 * @param statement - The fact statement text.
 * @param explanation - Optional explanation for additional context.
 */
export async function categorizeFact(
  factId: string,
  statement: string,
  explanation?: string
): Promise<CategorizationResult> {
  const validL1List = VALID_L1.join(', ');

  // Pull 30 approved facts for related-fact matching (from any category)
  const sampleFacts = factsDb.prepare(
    `SELECT id, statement, category_l1, category_l2 FROM facts
     WHERE status = 'approved' AND id != ?
     ORDER BY RANDOM() LIMIT 30`
  ).all(factId) as Array<{ id: string; statement: string; category_l1: string; category_l2: string }>;

  const relatedContext = sampleFacts
    .map((f, i) => `[${i}] ID:${f.id} CAT:${f.category_l1}/${f.category_l2} — ${f.statement}`)
    .join('\n');

  const prompt = `You are an educational content categorizer for a knowledge game.

VALID TOP-LEVEL CATEGORIES: ${validL1List}

FACT TO CATEGORIZE:
Statement: "${statement}"
${explanation ? `Explanation: "${explanation}"` : ''}

EXISTING FACTS (for related_facts detection):
${relatedContext || 'None yet.'}

Output a single JSON object with exactly these fields:
{
  "categoryL1": "<one of the valid top-level categories>",
  "categoryL2": "<specific subcategory, e.g. 'Biology', 'Ancient History'>",
  "categoryL3": "<narrow sub-subcategory, e.g. 'Cephalopods', 'Roman Empire'>",
  "tags": ["<tag1>", "<tag2>", ...],
  "relatedFactIds": ["<id1>", ...],
  "confidence": <0.0 to 1.0>
}

Rules:
- tags: 3–8 lowercase keyword tags (e.g. ["octopus","marine biology","hearts","anatomy"])
- relatedFactIds: IDs from the EXISTING FACTS list above that are semantically related (same topic area, complementary knowledge). Max 5. Empty array if none.
- confidence: your confidence in the L1/L2/L3 assignment (not the fact's accuracy)
- Output ONLY the JSON object, nothing else.`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text) as CategorizationResult & { confidence: number };

    // Validate L1 is in allowed list
    if (!VALID_L1.includes(parsed.categoryL1 as typeof VALID_L1[number])) {
      parsed.categoryL1 = 'Natural Sciences'; // Safe default
      parsed.confidence = Math.min(parsed.confidence, 0.5);
    }

    return {
      categoryL1: parsed.categoryL1,
      categoryL2: parsed.categoryL2 ?? '',
      categoryL3: parsed.categoryL3 ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
      relatedFactIds: Array.isArray(parsed.relatedFactIds) ? parsed.relatedFactIds.slice(0, 5) : [],
      confidence: parsed.confidence ?? 0.5,
      needsReview: (parsed.confidence ?? 0.5) < 0.75,
    };
  } catch {
    return {
      categoryL1: 'Natural Sciences',
      categoryL2: '',
      categoryL3: '',
      tags: [],
      relatedFactIds: [],
      confidence: 0,
      needsReview: true,
    };
  }
}
```

**Add endpoints to `server/src/routes/facts.ts`**:

```typescript
import { categorizeFact } from '../services/categorization.js';

// POST /api/facts/:id/categorize — categorize a single existing fact
fastify.post('/:id/categorize', withAdmin, async (request, reply) => {
  const { id } = request.params as { id: string };
  const fact = factsDb.prepare('SELECT id, statement, explanation FROM facts WHERE id = ?')
    .get(id) as { id: string; statement: string; explanation: string } | undefined;
  if (!fact) return reply.status(404).send({ error: 'Fact not found', statusCode: 404 });

  const result = await categorizeFact(fact.id, fact.statement, fact.explanation);

  factsDb.prepare(`
    UPDATE facts SET
      category_l1 = ?, category_l2 = ?, category_l3 = ?,
      category_legacy = ?,
      tags = ?,
      related_facts = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    result.categoryL1, result.categoryL2, result.categoryL3,
    JSON.stringify([result.categoryL1, result.categoryL2, result.categoryL3].filter(Boolean)),
    JSON.stringify(result.tags),
    JSON.stringify(result.relatedFactIds),
    Date.now(),
    id
  );

  return reply.send({ result });
});

// GET /api/facts/gap-analysis — categories with fewer than 20 facts (DD-V2-091)
fastify.get('/gap-analysis', withAdmin, async (_request, reply) => {
  const rows = factsDb.prepare(`
    SELECT
      category_l1,
      category_l2,
      COUNT(*) as fact_count,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count
    FROM facts
    WHERE status != 'archived'
    GROUP BY category_l1, category_l2
    ORDER BY approved_count ASC
  `).all() as Array<{ category_l1: string; category_l2: string; fact_count: number; approved_count: number }>;

  const gaps = rows.filter(r => r.approved_count < 20);
  const summary = VALID_L1.map(l1 => ({
    category: l1,
    total: rows.filter(r => r.category_l1 === l1).reduce((s, r) => s + r.approved_count, 0),
    minRequired: 200,
  }));

  return reply.send({ gaps, categorySummary: summary });
});
```

### Acceptance Criteria

- `POST /api/facts/:id/categorize` updates `category_l1/l2/l3`, `tags`, `related_facts` in the database
- `GET /api/facts/gap-analysis` returns categories under 20 approved facts
- `category_l1` is always one of the 7 valid top-level values
- `needsReview: true` when confidence < 0.75

### API Test Commands

```bash
# Get a fact ID from the previous step, then:
FACT_ID="<uuid-from-ingest>"

curl -s -X POST "http://localhost:3001/api/facts/${FACT_ID}/categorize" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq .result

curl -s "http://localhost:3001/api/facts/gap-analysis" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq '.gaps[:3]'
```

---

## Sub-Phase 11.3: LLM Content Generation Pipeline

### What

Adds the full content generation pass to each ingested fact: distractors (min 12, tiered easy/medium/hard), distractor validation pass, GAIA comments array, gaiaWrongComments, alternateExplanations, mnemonic, wowFactor, quizQuestion/correctAnswer, fun_score, novelty_score, difficulty, age_rating, image_prompt. This is the core of DD-V2-085 through DD-V2-090, DD-V2-105, DD-V2-106, DD-V2-112, DD-V2-114.

### Where

- `server/src/services/contentGen.ts` — new file; all LLM generation functions
- `server/src/routes/facts.ts` — add `POST /api/facts/:id/generate` and `POST /api/facts/extract`
- `server/src/services/deduplication.ts` — already exists

### How

**Create `server/src/services/contentGen.ts`**:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { factsDb } from '../db/facts-db.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/** Complete generated content for a single fact */
export interface GeneratedFactContent {
  wowFactor: string;
  explanation: string;
  alternateExplanations: string[];    // DD-V2-112: 2-3 variants
  quizQuestion: string;
  correctAnswer: string;
  acceptableAnswers: string[];        // DD-V2-104
  gaiaComments: string[];            // DD-V2-114: 3-5 entries
  gaiaWrongComments: {               // DD-V2-105
    snarky: string;
    enthusiastic: string;
    calm: string;
  };
  mnemonic: string;                   // DD-V2-106
  imagePrompt: string;
  visualDescription: string;
  funScore: number;
  noveltyScore: number;
  difficulty: number;
  ageRating: 'kid' | 'teen' | 'adult';
  sensitivityLevel: number;
  sensitivityNote: string;
  distractors: Array<{               // DD-V2-086, DD-V2-087
    text: string;
    difficultyTier: 'easy' | 'medium' | 'hard';
  }>;
}

/**
 * GENERATION PROMPT TEMPLATE (DD-V2-085)
 * Takes a statement and context, outputs all generated fields.
 */
function buildGenerationPrompt(statement: string, categoryL1: string, categoryL2: string): string {
  return `You are a content writer for Terra Gacha, an educational game where players mine underground and discover fascinating facts about Earth.

FACT TO ENRICH:
"${statement}"
Category: ${categoryL1} > ${categoryL2}

GAME CONTEXT:
- Players are a far-future miner who crash-landed on Earth and is rediscovering lost human knowledge
- GAIA is the ship's AI — snarky, enthusiastic, occasionally self-deprecating, always brief
- Facts must feel like genuine discoveries ("wait, REALLY?!")
- Pixel art is 32-256px; images must NOT reveal the answer, only hint at the topic

Generate a JSON object with EXACTLY these fields:

{
  "wowFactor": "<1-2 sentences of mind-blowing framing, shown during the gacha reveal>",
  "explanation": "<2-3 sentences of deeper context, shown after quiz. Factually accurate.>",
  "alternateExplanations": [
    "<different angle on the same fact, 2-3 sentences>",
    "<yet another angle, equally informative>"
  ],
  "quizQuestion": "<clear, unambiguous question that tests the specific claim in the statement>",
  "correctAnswer": "<concise correct answer, ≤8 words>",
  "acceptableAnswers": ["<variant spelling or phrasing that is also correct>"],
  "gaiaComments": [
    "<dramatic 1-sentence GAIA reaction for first ingestion — enthusiastic, personality-driven>",
    "<shorter review variant 1>",
    "<shorter review variant 2>",
    "<shortest variant, almost a quip>"
  ],
  "gaiaWrongComments": {
    "snarky": "<1 sentence: dryly sarcastic response when player answers wrong>",
    "enthusiastic": "<1 sentence: energetically encouraging response when player answers wrong>",
    "calm": "<1 sentence: measured, supportive response when player answers wrong>"
  },
  "mnemonic": "<vivid visual memory aid that encodes the correct answer; 1-2 sentences>",
  "imagePrompt": "<ComfyUI prompt for pixel art that illustrates the topic WITHOUT showing the answer>",
  "visualDescription": "<plain English: what should the pixel art show? e.g. 'an octopus swimming, no visible hearts'>",
  "funScore": <integer 1-10>,
  "noveltyScore": <integer 1-10>,
  "difficulty": <integer 1-5>,
  "ageRating": "<kid|teen|adult>",
  "sensitivityLevel": <integer 0-5>,
  "sensitivityNote": "<why it's flagged, empty string if 0>",
  "distractors": [
    {"text": "<obviously wrong answer from same domain>", "difficultyTier": "easy"},
    {"text": "<obviously wrong answer>", "difficultyTier": "easy"},
    {"text": "<somewhat plausible answer>", "difficultyTier": "medium"},
    {"text": "<somewhat plausible answer>", "difficultyTier": "medium"},
    {"text": "<quite plausible, requires domain knowledge to reject>", "difficultyTier": "hard"},
    {"text": "<highly plausible, only an expert can reject>", "difficultyTier": "hard"}
  ]
}

DISTRACTOR RULES:
- ALL distractors must be from the same domain as the correct answer (e.g. if answer is a number of hearts, all distractors are numbers of hearts — not names of animals)
- Minimum 12 distractors total (DD-V2-090): aim for 4 easy, 5 medium, 4+ hard
- Hard distractors: require specific domain knowledge to reject
- Medium distractors: plausible to a casual reader
- Easy distractors: clearly wrong to anyone who knows the domain
- NEVER make a distractor that could be argued as partially correct

GAIA COMMENT RULES (DD-V2-105, DD-V2-114):
- First gaiaComment = dramatic ingestion moment (longest, most theatrical)
- Remaining = shorter review variants player sees on repeated encounters
- gaiaWrongComments = what GAIA says immediately after player gets it wrong, by GAIA's mood setting
- GAIA is NEVER wrong about facts (DD-V2-111)

Output ONLY the JSON object, nothing else.`;
}

/**
 * DISTRACTOR VALIDATION PROMPT (DD-V2-086)
 * Second LLM pass that scores each distractor's confidence.
 */
function buildValidationPrompt(
  statement: string,
  correctAnswer: string,
  distractors: Array<{ text: string; difficultyTier: string }>
): string {
  const distList = distractors.map((d, i) => `[${i}] "${d.text}" (tier: ${d.difficultyTier})`).join('\n');
  return `You are a quiz quality reviewer for an educational game.

FACT: "${statement}"
CORRECT ANSWER: "${correctAnswer}"

DISTRACTORS TO VALIDATE:
${distList}

For each distractor, assign a confidence score:
- 1.0 = definitely wrong, unambiguously incorrect, great distractor
- 0.8 = clearly wrong to most players
- 0.7 = might trip up some players but not ambiguous
- 0.5 = somewhat ambiguous or could be argued as partially true
- 0.3 = arguably correct or too similar to correct answer
- 0.0 = actually correct or would confuse players unfairly

Output a JSON array:
[{"index": 0, "confidence": 0.9}, {"index": 1, "confidence": 0.7}, ...]

Output ONLY the JSON array.`;
}

/**
 * Generate full content for a single fact statement.
 * Runs generation pass + validation pass in sequence.
 * (DD-V2-085, DD-V2-086, DD-V2-087, DD-V2-090, DD-V2-104, DD-V2-105, DD-V2-106, DD-V2-112, DD-V2-114)
 */
export async function generateFactContent(
  statement: string,
  categoryL1: string,
  categoryL2: string
): Promise<GeneratedFactContent & { distractorsWithConfidence: Array<{ text: string; difficultyTier: string; confidence: number }> }> {

  // ── Pass 1: Generate all content ──────────────────────────────────────────
  const genResponse = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: buildGenerationPrompt(statement, categoryL1, categoryL2) }],
  });

  const genText = genResponse.content[0].type === 'text' ? genResponse.content[0].text : '{}';
  const generated = JSON.parse(genText) as GeneratedFactContent;

  // Ensure minimum 12 distractors (DD-V2-090)
  if (!generated.distractors || generated.distractors.length < 12) {
    throw new Error(`LLM only generated ${generated.distractors?.length ?? 0} distractors (minimum 12 required)`);
  }

  // ── Pass 2: Validate distractors (DD-V2-086) ─────────────────────────────
  const valResponse = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: buildValidationPrompt(statement, generated.correctAnswer, generated.distractors)
    }],
  });

  const valText = valResponse.content[0].type === 'text' ? valResponse.content[0].text : '[]';
  const validationScores = JSON.parse(valText) as Array<{ index: number; confidence: number }>;

  const scoreMap = new Map(validationScores.map(v => [v.index, v.confidence]));

  const distractorsWithConfidence = generated.distractors.map((d, i) => ({
    text: d.text,
    difficultyTier: d.difficultyTier,
    confidence: scoreMap.get(i) ?? 0.7,
  }));

  return { ...generated, distractorsWithConfidence };
}

/**
 * FACT EXTRACTION PROMPT (DD-V2-085)
 * Takes a raw source passage and extracts fact objects.
 */
export async function extractFactsFromPassage(
  passage: string,
  sourceName: string,
  sourceUrl?: string
): Promise<Array<{ statement: string; categoryL1: string; categoryL2: string; sourceNote: string }>> {
  const prompt = `You are a fact extraction system for an educational game. Extract fascinating, learnable facts from the following passage.

SOURCE: ${sourceName}${sourceUrl ? ` (${sourceUrl})` : ''}

PASSAGE:
"""
${passage}
"""

QUALITY BAR (extract ONLY facts that meet this):
- "Octopuses have three hearts" → YES (surprising, specific, learnable)
- "The Battle of Hastings was in 1066" → NO (dry date without wonder)
- "Cleopatra lived closer in time to the Moon landing than to the Great Pyramid" → YES (reframes known facts, mind-blowing)
- "Water is H2O" → NO (too basic, no wonder)

For each extracted fact, output a JSON object. Output a JSON array of these objects:
[
  {
    "statement": "<clear, concise, 1-2 sentences. Anki-optimized.>",
    "categoryL1": "<one of: Natural Sciences, Life Sciences, History, Geography, Technology, Culture, Language>",
    "categoryL2": "<specific subcategory>",
    "sourceNote": "<brief note on where in the passage this came from>"
  }
]

Extract 1–10 facts. If the passage contains no qualifying facts, return an empty array [].
Output ONLY the JSON array.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
  return JSON.parse(text);
}

/**
 * Persist generated content into the facts + distractors tables.
 */
export function persistGeneratedContent(
  factId: string,
  content: GeneratedFactContent & { distractorsWithConfidence: Array<{ text: string; difficultyTier: string; confidence: number }> }
): void {
  const now = Date.now();
  factsDb.prepare(`
    UPDATE facts SET
      wow_factor = ?,
      explanation = ?,
      alternate_explanations = ?,
      quiz_question = ?,
      correct_answer = ?,
      acceptable_answers = ?,
      gaia_comments = ?,
      gaia_wrong_comments = ?,
      mnemonic = ?,
      image_prompt = ?,
      visual_description = ?,
      fun_score = ?,
      novelty_score = ?,
      difficulty = ?,
      age_rating = ?,
      sensitivity_level = ?,
      sensitivity_note = ?,
      status = 'approved',
      updated_at = ?
    WHERE id = ?
  `).run(
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

  // Insert distractors (normalized table)
  const insertDistractor = factsDb.prepare(`
    INSERT INTO distractors (fact_id, text, difficulty_tier, distractor_confidence, is_approved)
    VALUES (?, ?, ?, ?, 1)
  `);

  const insertMany = factsDb.transaction((distractors: typeof content.distractorsWithConfidence) => {
    for (const d of distractors) {
      insertDistractor.run(factId, d.text, d.difficultyTier, d.confidence);
    }
  });
  insertMany(content.distractorsWithConfidence);

  // Update distractor_count (DD-V2-090)
  const countRow = factsDb.prepare(
    `SELECT COUNT(*) as n FROM distractors WHERE fact_id = ? AND distractor_confidence >= ?`
  ).get(factId, config.distractorConfidenceThreshold) as { n: number };
  factsDb.prepare('UPDATE facts SET distractor_count = ? WHERE id = ?').run(countRow.n, factId);
}
```

**Add endpoints to `server/src/routes/facts.ts`**:

```typescript
import { generateFactContent, extractFactsFromPassage, persistGeneratedContent } from '../services/contentGen.js';
import { categorizeFact } from '../services/categorization.js';
import { checkDuplicate } from '../services/deduplication.js';

// POST /api/facts/:id/generate — run full LLM content generation for a single fact
fastify.post('/:id/generate', withAdmin, async (request, reply) => {
  const { id } = request.params as { id: string };
  const fact = factsDb.prepare('SELECT * FROM facts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!fact) return reply.status(404).send({ error: 'Fact not found', statusCode: 404 });

  try {
    const content = await generateFactContent(
      String(fact.statement),
      String(fact.category_l1 || 'Natural Sciences'),
      String(fact.category_l2 || '')
    );
    persistGeneratedContent(id, content);
    return reply.send({ ok: true, distractorCount: content.distractorsWithConfidence.length });
  } catch (err) {
    return reply.status(500).send({ error: String(err), statusCode: 500 });
  }
});

// POST /api/facts/extract — extract facts from a raw source passage (DD-V2-085)
fastify.post('/extract', withAdmin, async (request, reply) => {
  const { passage, sourceName, sourceUrl } = request.body as {
    passage: string;
    sourceName: string;
    sourceUrl?: string;
  };
  if (!passage || !sourceName) {
    return reply.status(400).send({ error: 'passage and sourceName are required', statusCode: 400 });
  }
  if (passage.length > 10000) {
    return reply.status(400).send({ error: 'passage max length is 10000 characters', statusCode: 400 });
  }

  const extracted = await extractFactsFromPassage(passage, sourceName, sourceUrl);

  // For each extracted fact: dedup check + ingest + categorize + generate
  const results = [];
  const now = Date.now();
  const insertStmt = factsDb.prepare(`
    INSERT INTO facts (id, type, status, statement, explanation, quiz_question, correct_answer,
      category_l1, category_l2, category_l3, category_legacy,
      difficulty, age_rating, content_volatility,
      source_name, source_url, created_at, updated_at)
    VALUES (?, 'fact', 'draft', ?, '', '', ?, ?, '', '', ?, 3, 'teen', 'timeless', ?, ?, ?, ?)
  `);

  for (const candidate of extracted) {
    const dedup = await checkDuplicate(candidate.statement, candidate.categoryL1);
    if (dedup.isDuplicate) {
      results.push({ statement: candidate.statement, result: 'rejected', reason: 'duplicate' });
      continue;
    }

    const id = crypto.randomUUID();
    insertStmt.run(
      id, candidate.statement, candidate.categoryL1,
      candidate.categoryL1,
      JSON.stringify([candidate.categoryL1, candidate.categoryL2].filter(Boolean)),
      sourceName, sourceUrl ?? null, now, now
    );

    // Categorize
    const catResult = await categorizeFact(id, candidate.statement);
    factsDb.prepare(`UPDATE facts SET category_l1=?,category_l2=?,category_l3=?,tags=?,related_facts=? WHERE id=?`)
      .run(catResult.categoryL1, catResult.categoryL2, catResult.categoryL3,
           JSON.stringify(catResult.tags), JSON.stringify(catResult.relatedFactIds), id);

    // Generate full content
    try {
      const content = await generateFactContent(candidate.statement, catResult.categoryL1, catResult.categoryL2);
      persistGeneratedContent(id, content);
      results.push({ statement: candidate.statement, result: 'accepted', id });
    } catch (err) {
      results.push({ statement: candidate.statement, result: 'needs_review', id, reason: String(err) });
    }
  }

  return reply.send({ extracted: extracted.length, results });
});
```

### Acceptance Criteria

- `POST /api/facts/:id/generate` populates all content fields, sets `status='approved'`, inserts ≥12 distractors in the `distractors` table
- `POST /api/facts/extract` with a Wikipedia passage (≤10000 chars) returns ≥1 accepted fact with full content
- All distractors in `distractors` table have `distractor_confidence` between 0 and 1
- `distractor_count` on the fact row reflects only distractors above the confidence threshold (0.7)
- `gaiaWrongComments` JSON parsed correctly has `snarky`, `enthusiastic`, `calm` keys
- `gaiaComments` is a JSON array with 3-5 entries
- `alternateExplanations` is a JSON array with 2-3 entries
- `mnemonic` is non-empty for every generated fact

### API Test Commands

```bash
# Extract from a Wikipedia-style passage
curl -s -X POST http://localhost:3001/api/facts/extract \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: dev-admin-key-change-me" \
  -d '{
    "passage": "The blue whale heart is so large that a small child could crawl through its aorta. It beats only 8-10 times per minute when diving, slowing to conserve oxygen. A blue whale can hear the calls of other whales hundreds of miles away.",
    "sourceName": "National Geographic",
    "sourceUrl": "https://www.nationalgeographic.com/animals/mammals/facts/blue-whale"
  }' | jq '.results'

# Check distractors for a generated fact
FACT_ID="<id-from-above>"
curl -s "http://localhost:3001/api/facts/${FACT_ID}" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq '.distractors | length'
# Expected: >= 12

# Check distractor confidence scores
curl -s "http://localhost:3001/api/facts/${FACT_ID}" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq '.distractors | map(.distractor_confidence) | min'
# Expected: value between 0 and 1
```

---

## Sub-Phase 11.4: Fact Management Web Dashboard

### What

A standalone web dashboard running on a separate port (3002) that allows browsing, editing, approving, and bulk-operating on facts in the pipeline. It is a plain HTML/JS app (no build step required) served by a second Fastify instance. Implements the gap analysis view (DD-V2-091) and the distractor confidence viewer (DD-V2-086).

### Where

- `server/src/dashboard/index.ts` — new Fastify app serving the dashboard
- `server/src/dashboard/public/index.html` — main dashboard HTML
- `server/src/dashboard/public/app.js` — vanilla JS dashboard logic
- `server/src/dashboard/public/style.css` — minimal styling
- `server/src/config.ts` — add `dashboardPort: 3002`
- `server/package.json` — add `"dashboard": "tsx src/dashboard/index.ts"` script

### How

**Create `server/src/dashboard/index.ts`**:

```typescript
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import * as path from 'path';
import * as url from 'url';
import { config } from '../config.js';
import { factsDb } from '../db/facts-db.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT ?? '3002', 10);

async function startDashboard() {
  const fastify = Fastify({ logger: false });

  // Serve static files from public/
  await fastify.register(staticPlugin, {
    root: path.join(__dirname, 'public'),
    prefix: '/',
  });

  // ── Dashboard API routes (proxies to main server) ──────────────────────
  // All fact data reads go through the same factsDb connection.

  fastify.get('/dashboard/api/facts', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const pageSize = Math.min(100, parseInt(q.pageSize ?? '50', 10));
    const offset = (parseInt(q.page ?? '1', 10) - 1) * pageSize;
    const where = q.status ? `WHERE status = '${q.status.replace(/'/g, "''")}'` : '';
    const rows = factsDb.prepare(`SELECT id, statement, status, category_l1, category_l2, fun_score, difficulty, distractor_count, in_game_reports, has_pixel_art FROM facts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(pageSize, offset);
    const total = (factsDb.prepare(`SELECT COUNT(*) as n FROM facts ${where}`).get() as { n: number }).n;
    return reply.send({ facts: rows, total, pageSize, offset });
  });

  fastify.get('/dashboard/api/facts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const fact = factsDb.prepare('SELECT * FROM facts WHERE id = ?').get(id);
    const distractors = factsDb.prepare('SELECT * FROM distractors WHERE fact_id = ? ORDER BY difficulty_tier, distractor_confidence DESC').all(id);
    const reports = factsDb.prepare('SELECT * FROM fact_reports WHERE fact_id = ? ORDER BY created_at DESC').all(id);
    return reply.send({ fact, distractors, reports });
  });

  fastify.post('/dashboard/api/facts/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    factsDb.prepare(`UPDATE facts SET status='approved', updated_at=? WHERE id=?`).run(Date.now(), id);
    return reply.send({ ok: true });
  });

  fastify.post('/dashboard/api/facts/:id/archive', async (request, reply) => {
    const { id } = request.params as { id: string };
    factsDb.prepare(`UPDATE facts SET status='archived', updated_at=? WHERE id=?`).run(Date.now(), id);
    return reply.send({ ok: true });
  });

  fastify.get('/dashboard/api/gap-analysis', async (_request, reply) => {
    const rows = factsDb.prepare(`
      SELECT category_l1, category_l2, COUNT(*) as total,
             SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved
      FROM facts WHERE status != 'archived'
      GROUP BY category_l1, category_l2 ORDER BY approved ASC
    `).all();
    return reply.send({ gaps: rows });
  });

  fastify.get('/dashboard/api/distractor-review', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const threshold = parseFloat(q.threshold ?? '0.7');
    const rows = factsDb.prepare(`
      SELECT d.*, f.statement, f.correct_answer
      FROM distractors d JOIN facts f ON d.fact_id = f.id
      WHERE d.distractor_confidence < ?
      ORDER BY d.distractor_confidence ASC LIMIT 100
    `).all(threshold);
    return reply.send({ distractors: rows });
  });

  fastify.get('/dashboard/api/quality-metrics', async (_request, reply) => {
    const byCategory = factsDb.prepare(`
      SELECT category_l1,
             AVG(fun_score) as avg_fun,
             AVG(difficulty) as avg_difficulty,
             COUNT(*) as total,
             SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved
      FROM facts GROUP BY category_l1
    `).all();
    const totalReported = (factsDb.prepare(`SELECT COUNT(*) as n FROM facts WHERE in_game_reports > 0`).get() as { n: number }).n;
    return reply.send({ byCategory, totalReported });
  });

  await fastify.listen({ port: DASHBOARD_PORT, host: '0.0.0.0' });
  console.log(`[dashboard] Running at http://localhost:${DASHBOARD_PORT}`);
}

startDashboard();
```

**Create `server/src/dashboard/public/index.html`** — a functional single-page dashboard with tabs: Facts List, Gap Analysis, Distractor Review, Quality Metrics. Each tab fetches from the `/dashboard/api/*` endpoints and renders results. Facts list supports filtering by status (draft/approved/archived). Clicking a fact ID opens a detail panel showing full content, distractors (color-coded by confidence), reports, and Approve/Archive buttons.

The full HTML/JS is intentionally plain (no React/Vue) so it runs with zero build steps. Key sections:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Terra Gacha — Fact Dashboard</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav>
    <h1>Terra Gacha Fact Dashboard</h1>
    <div id="tabs">
      <button onclick="showTab('facts')" class="active">Facts</button>
      <button onclick="showTab('gap')">Gap Analysis</button>
      <button onclick="showTab('distractors')">Distractor Review</button>
      <button onclick="showTab('metrics')">Quality Metrics</button>
    </div>
  </nav>
  <main id="content"></main>
  <script src="app.js"></script>
</body>
</html>
```

The `app.js` file implements `showTab()`, `loadFacts()`, `loadGapAnalysis()`, `loadDistractorReview()`, `loadMetrics()`, `approveFact(id)`, `archiveFact(id)`. Each function makes `fetch()` calls to `/dashboard/api/*` and renders HTML into `#content`.

### Acceptance Criteria

- Dashboard loads at `http://localhost:3002` in browser
- Facts tab shows a table of facts with status filter (draft/approved/archived)
- Gap Analysis tab shows subcategories with fewer than 20 approved facts
- Distractor Review tab shows distractors below confidence threshold, color-coded
- Approve button sets fact status to approved; Archive button sets to archived
- Quality Metrics tab shows average fun_score per category
- Playwright screenshot confirms dashboard renders correctly

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:3002')
  await page.waitForSelector('#tabs', { timeout: 10000 })
  await page.screenshot({ path: '/tmp/ss-dashboard-facts.png' })

  // Test Gap Analysis tab
  await page.click('button:has-text("Gap Analysis")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-dashboard-gap.png' })

  // Test Distractor Review tab
  await page.click('button:has-text("Distractor Review")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-dashboard-distractors.png' })

  await browser.close()
  console.log('Dashboard screenshots saved to /tmp/')
})()
```

Run: `node /tmp/ss-dashboard.js` then `Read /tmp/ss-dashboard-facts.png` to inspect.

---

## Sub-Phase 11.5: Sprite Selection Dashboard

### What

Extends the dashboard with a "Sprites" tab that shows facts needing pixel art. For each fact, it displays the `visualDescription` and `imagePrompt` fields, and allows triggering ComfyUI generation (3-5 variants). The generated options appear side-by-side for one-click approval. Approved sprites are linked to the fact via `imageUrl`.

### Where

- `server/src/services/comfyui.ts` — new file; ComfyUI API client
- `server/src/dashboard/index.ts` — add sprite endpoints
- `server/src/dashboard/public/index.html` — add Sprites tab
- `server/src/dashboard/public/app.js` — add sprite tab logic
- `public/fact-sprites/` — where approved sprites land (served by Vite dev server)

### How

**Create `server/src/services/comfyui.ts`**:

```typescript
import { config } from '../config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ComfyUIQueuePromptResponse {
  prompt_id: string;
}

interface ComfyUIHistoryResponse {
  [promptId: string]: {
    outputs: {
      [nodeId: string]: {
        images?: Array<{ filename: string; subfolder: string; type: string }>;
      };
    };
    status: { completed: boolean };
  };
}

/**
 * Standard ComfyUI workflow for pixel art fact illustrations.
 * Uses SDXL + pixel art LoRA.
 * Adapted from sprite-gen/ workflows in the project.
 *
 * @param imagePrompt - The ComfyUI-ready prompt string.
 * @param negativePrompt - Negative prompt (defaults to standard pixel art negatives).
 */
function buildPixelArtWorkflow(imagePrompt: string, negativePrompt?: string): object {
  const NEG = negativePrompt ??
    'text, words, letters, watermark, blurry, photorealistic, 3d render, human faces, nsfw, multiple views, sprite sheet, grid layout, collage, photo, extra limbs';

  return {
    "3": {
      "inputs": {
        "seed": Math.floor(Math.random() * 2147483647),
        "steps": 30,
        "cfg": 7.5,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "4": { "inputs": { "ckpt_name": "sd_xl_base_1.0.safetensors" }, "class_type": "CheckpointLoaderSimple" },
    "5": { "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }, "class_type": "EmptyLatentImage" },
    "6": {
      "inputs": {
        "text": `pixel art, single centered object, white background, game asset, 16-bit style, ${imagePrompt}`,
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "7": { "inputs": { "text": NEG, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
    "8": { "inputs": { "samples": ["3", 0], "vae": ["4", 2] }, "class_type": "VAEDecode" },
    "9": {
      "inputs": {
        "filename_prefix": "fact_sprite",
        "images": ["8", 0]
      },
      "class_type": "SaveImage"
    }
  };
}

/**
 * Submit a ComfyUI generation job and wait for completion.
 * Returns the path to the generated image file on the ComfyUI output directory.
 *
 * @param imagePrompt - Prompt describing what to generate.
 * @param timeoutMs   - How long to wait for generation (default 120s).
 */
export async function generatePixelArt(
  imagePrompt: string,
  timeoutMs = 120_000
): Promise<string> {
  const workflow = buildPixelArtWorkflow(imagePrompt);

  // Submit
  const queueRes = await fetch(`${config.comfyuiUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!queueRes.ok) throw new Error(`ComfyUI queue failed: ${queueRes.status}`);
  const { prompt_id } = await queueRes.json() as ComfyUIQueuePromptResponse;

  // Poll until done
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const histRes = await fetch(`${config.comfyuiUrl}/history/${prompt_id}`);
    if (!histRes.ok) continue;
    const hist = await histRes.json() as ComfyUIHistoryResponse;
    const entry = hist[prompt_id];
    if (!entry?.status?.completed) continue;

    // Find the output image
    for (const nodeOutput of Object.values(entry.outputs)) {
      if (nodeOutput.images && nodeOutput.images.length > 0) {
        const img = nodeOutput.images[0];
        // Download from ComfyUI's /view endpoint
        const imgUrl = `${config.comfyuiUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
        const imgRes = await fetch(imgUrl);
        if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`);
        const buffer = Buffer.from(await imgRes.arrayBuffer());

        // Apply rembg for transparency
        const rawPath = `/tmp/comfy_raw_${crypto.randomUUID()}.png`;
        const outPath = `/tmp/comfy_out_${crypto.randomUUID()}.png`;
        fs.writeFileSync(rawPath, buffer);

        const { execSync } = await import('child_process');
        execSync(`/opt/comfyui-env/bin/rembg i "${rawPath}" "${outPath}"`, { stdio: 'pipe' });
        fs.unlinkSync(rawPath);
        return outPath;
      }
    }
    throw new Error('ComfyUI job completed but no images found in output');
  }
  throw new Error(`ComfyUI generation timed out after ${timeoutMs}ms`);
}

/**
 * Generate N sprite variants for a fact, return array of temp file paths.
 */
export async function generateSpriteVariants(imagePrompt: string, count = 3): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const p = await generatePixelArt(imagePrompt);
    paths.push(p);
  }
  return paths;
}
```

**Add sprite endpoints to `server/src/dashboard/index.ts`**:

```typescript
import { generateSpriteVariants } from '../services/comfyui.js';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp'; // npm install sharp in server

const SPRITE_OUT_DIR = path.resolve('/root/terra-miner/public/fact-sprites');
fs.mkdirSync(SPRITE_OUT_DIR, { recursive: true });

// GET /dashboard/api/sprites/pending — facts needing pixel art
fastify.get('/dashboard/api/sprites/pending', async (_request, reply) => {
  const rows = factsDb.prepare(`
    SELECT id, statement, visual_description, image_prompt, pixel_art_status
    FROM facts WHERE has_pixel_art = 0 AND status = 'approved'
    AND pixel_art_status IN ('none', 'rejected')
    ORDER BY fun_score DESC LIMIT 50
  `).all();
  return reply.send({ facts: rows });
});

// POST /dashboard/api/sprites/:factId/generate — generate 3 variants
fastify.post('/dashboard/api/sprites/:factId/generate', async (request, reply) => {
  const { factId } = request.params as { factId: string };
  const fact = factsDb.prepare('SELECT id, image_prompt FROM facts WHERE id = ?').get(factId) as
    { id: string; image_prompt: string } | undefined;
  if (!fact || !fact.image_prompt) {
    return reply.status(400).send({ error: 'Fact has no image_prompt', statusCode: 400 });
  }

  factsDb.prepare(`UPDATE facts SET pixel_art_status='generating', updated_at=? WHERE id=?`)
    .run(Date.now(), factId);

  try {
    const paths = await generateSpriteVariants(fact.image_prompt, 3);

    // Downscale: 256px hi-res + 32px lo-res, save to public/fact-sprites/<factId>/
    const factDir = path.join(SPRITE_OUT_DIR, factId);
    fs.mkdirSync(factDir, { recursive: true });

    const variants = [];
    for (let i = 0; i < paths.length; i++) {
      const hiResPath = path.join(factDir, `variant_${i}_256.png`);
      const loResPath = path.join(factDir, `variant_${i}_32.png`);
      await sharp(paths[i]).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(hiResPath);
      await sharp(paths[i]).resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(loResPath);
      fs.unlinkSync(paths[i]);
      variants.push({ index: i, url256: `/fact-sprites/${factId}/variant_${i}_256.png`, url32: `/fact-sprites/${factId}/variant_${i}_32.png` });
    }

    factsDb.prepare(`UPDATE facts SET pixel_art_status='review', updated_at=? WHERE id=?`)
      .run(Date.now(), factId);

    return reply.send({ ok: true, variants });
  } catch (err) {
    factsDb.prepare(`UPDATE facts SET pixel_art_status='none', updated_at=? WHERE id=?`)
      .run(Date.now(), factId);
    return reply.status(500).send({ error: String(err), statusCode: 500 });
  }
});

// POST /dashboard/api/sprites/:factId/approve/:variantIndex — link variant as canonical
fastify.post('/dashboard/api/sprites/:factId/approve/:variantIndex', async (request, reply) => {
  const { factId, variantIndex } = request.params as { factId: string; variantIndex: string };
  const imageUrl = `/fact-sprites/${factId}/variant_${variantIndex}_256.png`;
  factsDb.prepare(`
    UPDATE facts SET has_pixel_art=1, pixel_art_status='approved', image_url=?, updated_at=? WHERE id=?
  `).run(imageUrl, Date.now(), factId);
  return reply.send({ ok: true, imageUrl });
});
```

### Acceptance Criteria

- `GET /dashboard/api/sprites/pending` returns approved facts without pixel art
- `POST /dashboard/api/sprites/:id/generate` triggers ComfyUI, creates files in `public/fact-sprites/<id>/`, sets `pixel_art_status='review'`
- Generated images are 256x256 (hi-res) and 32x32 (lo-res) PNG with transparent backgrounds
- `POST /dashboard/api/sprites/:id/approve/:variantIndex` sets `has_pixel_art=1`, `image_url`
- Sprites tab in dashboard shows pending facts with Generate button and side-by-side variant preview

---

## Sub-Phase 11.6: Pixel Art Auto-Generation Pipeline

### What

A background script that runs continuously (or as a cron job) scanning for approved facts with `pixel_art_status='none'` and automatically generating + auto-approving pixel art without manual review. Vocabulary/language facts are skipped (DD-V2-093). This is the "24/7 pipeline" described in the roadmap.

### Where

- `server/src/scripts/sprite-gen-daemon.ts` — new file; background generation loop
- `server/package.json` — add `"sprite-daemon": "tsx src/scripts/sprite-gen-daemon.ts"` script

### How

**Create `server/src/scripts/sprite-gen-daemon.ts`**:

```typescript
/**
 * Pixel Art Auto-Generation Daemon (DD-V2-093, Phase 11.6)
 *
 * Scans approved facts with pixel_art_status='none' that are NOT vocabulary/language type.
 * Generates one sprite per fact via ComfyUI, applies rembg transparency, saves to
 * public/fact-sprites/<factId>/, and auto-approves it.
 *
 * Run: npm run sprite-daemon
 * Stops on SIGINT/SIGTERM. Safe to restart — already-generated facts are skipped.
 *
 * Greyscale-to-color mastery progression support: images stored as full-color;
 * the client applies CSS filter: grayscale() based on SM-2 interval (see factsDB.ts).
 */

import { factsDb } from '../db/facts-db.js';
import { generatePixelArt } from '../services/comfyui.js';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

const SPRITE_OUT_DIR = path.resolve('/root/terra-miner/public/fact-sprites');
const POLL_INTERVAL_MS = 5000;

fs.mkdirSync(SPRITE_OUT_DIR, { recursive: true });

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function processOneFact(): Promise<boolean> {
  // Skip vocabulary/language facts (DD-V2-093 — no pixel art needed)
  const fact = factsDb.prepare(`
    SELECT id, image_prompt, statement FROM facts
    WHERE status = 'approved'
      AND has_pixel_art = 0
      AND pixel_art_status = 'none'
      AND type NOT IN ('vocabulary', 'grammar', 'phrase')
      AND image_prompt IS NOT NULL AND image_prompt != ''
    ORDER BY fun_score DESC
    LIMIT 1
  `).get() as { id: string; image_prompt: string; statement: string } | undefined;

  if (!fact) return false; // Nothing to process

  console.log(`[sprite-daemon] Generating for fact: "${fact.statement.slice(0, 60)}..."`);

  factsDb.prepare(`UPDATE facts SET pixel_art_status='generating', updated_at=? WHERE id=?`)
    .run(Date.now(), fact.id);

  try {
    const rawPath = await generatePixelArt(fact.image_prompt);

    const factDir = path.join(SPRITE_OUT_DIR, fact.id);
    fs.mkdirSync(factDir, { recursive: true });

    const hiResPath = path.join(factDir, 'sprite_256.png');
    const loResPath = path.join(factDir, 'sprite_32.png');

    await sharp(rawPath)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(hiResPath);

    await sharp(rawPath)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(loResPath);

    fs.unlinkSync(rawPath);

    const imageUrl = `/fact-sprites/${fact.id}/sprite_256.png`;
    factsDb.prepare(`
      UPDATE facts
      SET has_pixel_art=1, pixel_art_status='approved', image_url=?, updated_at=?
      WHERE id=?
    `).run(imageUrl, Date.now(), fact.id);

    console.log(`[sprite-daemon] Done: ${fact.id} → ${imageUrl}`);
    return true;
  } catch (err) {
    console.error(`[sprite-daemon] Failed for ${fact.id}:`, err);
    factsDb.prepare(`UPDATE facts SET pixel_art_status='none', updated_at=? WHERE id=?`)
      .run(Date.now(), fact.id);
    return false;
  }
}

async function main() {
  console.log('[sprite-daemon] Starting. CTRL+C to stop.');
  while (running) {
    const didWork = await processOneFact();
    if (!didWork) {
      // Nothing pending — wait before polling again
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  console.log('[sprite-daemon] Stopped.');
}

main().catch(err => { console.error('[sprite-daemon] Fatal:', err); process.exit(1); });
```

### Acceptance Criteria

- Running `npm run sprite-daemon` processes facts in priority order (highest `fun_score` first)
- Language/vocabulary facts are skipped (checked by querying `type NOT IN ('vocabulary', 'grammar', 'phrase')`)
- Generated sprites appear at `public/fact-sprites/<factId>/sprite_256.png` (256px) and `sprite_32.png` (32px)
- Transparent backgrounds confirmed: `sharp(path).metadata()` returns `hasAlpha: true`
- `pixel_art_status` transitions: `none` → `generating` → `approved` (or back to `none` on failure)
- SIGINT stops the daemon cleanly without leaving facts in `generating` state (fact ID can be manually reset)

### API Test Commands

```bash
# Start daemon for one iteration
STOP_AFTER=1 node -e "
const { execSync } = require('child_process');
const proc = require('child_process').spawn('npx', ['tsx', 'server/src/scripts/sprite-gen-daemon.ts'], { stdio: 'inherit' });
setTimeout(() => proc.kill('SIGINT'), 30000); // Kill after 30s max
"

# Verify output exists
ls /root/terra-miner/public/fact-sprites/

# Check has_pixel_art updated
node -e "
const D = require('better-sqlite3');
const db = new D('./server/data/facts.db');
console.log(db.prepare('SELECT COUNT(*) as n FROM facts WHERE has_pixel_art=1').get());
"
```

---

## Sub-Phase 11.8: In-Game Fact Reporting

### What

Adds a "Report this fact" button to two in-game locations: the fact detail card and the post-quiz wrong-answer screen (DD-V2-089). The button opens a text input (max 200 chars). On submit, calls `POST /api/facts/:id/report`. The `sourceUrl` field is displayed as a clickable link on fact cards.

### Where

- `src/ui/components/FactCard.svelte` — add report button + sourceUrl link
- `src/ui/components/QuizOverlay.svelte` — add report button on wrong-answer state
- `src/ui/components/ReportModal.svelte` — new file; modal with text area
- `src/services/apiClient.ts` — add `reportFact(factId, text, playerId?)` method

### How

**Create `src/ui/components/ReportModal.svelte`**:

```svelte
<script lang="ts">
  import { apiClient } from '../../services/apiClient'

  export let factId: string
  export let onClose: () => void

  let reportText = ''
  let submitted = false
  let error = ''
  let submitting = false

  const MAX_CHARS = 200

  async function submit() {
    if (!reportText.trim()) return
    submitting = true
    error = ''
    try {
      await apiClient.reportFact(factId, reportText.trim())
      submitted = true
    } catch (e) {
      error = 'Could not submit report. Please try again.'
    } finally {
      submitting = false
    }
  }
</script>

<div class="modal-backdrop" on:click={onClose}>
  <div class="modal-box" on:click|stopPropagation>
    {#if submitted}
      <p class="success">Report submitted. Thank you!</p>
      <button on:click={onClose}>Close</button>
    {:else}
      <h3>Report This Fact</h3>
      <p>What's wrong with this fact? (max 200 chars)</p>
      <textarea
        bind:value={reportText}
        maxlength={MAX_CHARS}
        rows="4"
        placeholder="e.g. The number is incorrect — it should be 4, not 3."
      ></textarea>
      <small>{reportText.length}/{MAX_CHARS}</small>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="buttons">
        <button on:click={onClose} disabled={submitting}>Cancel</button>
        <button on:click={submit} disabled={submitting || !reportText.trim()} class="primary">
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000; }
  .modal-box { background:#1a1a2e;border:2px solid #444;border-radius:8px;padding:1.5rem;max-width:360px;width:90%; }
  textarea { width:100%;background:#111;color:#fff;border:1px solid #555;border-radius:4px;padding:0.5rem;resize:vertical;font-family:inherit; }
  .buttons { display:flex;gap:0.5rem;margin-top:1rem;justify-content:flex-end; }
  button { padding:0.5rem 1rem;border-radius:4px;cursor:pointer;min-height:44px; }
  button.primary { background:#4a9eff;color:#fff;border:none; }
  button:disabled { opacity:0.5;cursor:not-allowed; }
  .success { color:#4caf50; }
  .error { color:#f44336; }
</style>
```

**Add `reportFact()` to `src/services/apiClient.ts`**:

```typescript
/**
 * Submit a player report for a fact (DD-V2-089).
 * @param factId - The fact being reported.
 * @param reportText - Player's description of the issue (max 200 chars).
 * @param playerId - Optional player ID for tracking.
 */
async reportFact(factId: string, reportText: string, playerId?: string): Promise<void> {
  const res = await fetch(`${this.baseUrl}/api/facts/${factId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, reportText }),
  })
  if (!res.ok) throw new Error(`Report failed: ${res.status}`)
}
```

**In `FactCard.svelte`** — add below the explanation section:

```svelte
<script lang="ts">
  // ...existing imports...
  import ReportModal from './ReportModal.svelte'
  let showReportModal = false
</script>

<!-- Inside the fact card, after explanation: -->
{#if fact.sourceUrl}
  <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" class="source-link">
    Source: {fact.sourceName ?? fact.sourceUrl}
  </a>
{/if}

<button class="report-btn" on:click={() => showReportModal = true}>
  Report this fact
</button>

{#if showReportModal}
  <ReportModal factId={fact.id} onClose={() => showReportModal = false} />
{/if}
```

**In `QuizOverlay.svelte`** — in the wrong-answer state section, add the same report button pattern (import `ReportModal`, add `showReportModal` state, render the button and modal below the wrong-answer explanation).

### Acceptance Criteria

- Report button visible on fact detail cards and post-quiz wrong-answer state
- Button opens `ReportModal` overlay
- Submitting text calls `POST /api/facts/:id/report` (verified via browser network tab or test)
- `sourceUrl` renders as a clickable `<a>` link when present
- Text limited to 200 characters (enforced both by `maxlength` and server validation)
- After 3 reports via API, fact `status` reverts to `'draft'` (verified by checking server DB)
- All touch targets are ≥44×44px

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Navigate to a state that shows a fact card
  // (Exact navigation depends on current game flow — adjust as needed)
  await page.screenshot({ path: '/tmp/ss-report-button.png', fullPage: false })
  await browser.close()
})()
```

---

## Verification Gate

Before considering Phase 11 complete, all of the following must pass.

### Automated Checks

```bash
# 1. TypeScript clean
cd /root/terra-miner && npm run typecheck
# Expected: 0 errors

# 2. Production build
cd /root/terra-miner && npm run build
# Expected: successful Vite build, no TS errors

# 3. Server typecheck
cd /root/terra-miner/server && npx tsc --noEmit
# Expected: 0 errors

# 4. Facts schema correct
node -e "
const D = require('better-sqlite3');
const db = new D('./server/data/facts.db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(t=>t.name);
const required = ['facts','distractors','fact_reports','fact_pack_versions'];
required.forEach(t => { if(!tables.includes(t)) throw new Error('Missing table: '+t); });
console.log('Schema OK:', tables);
"

# 5. Ingest endpoint works
curl -sf -X POST http://localhost:3001/api/facts/ingest \
  -H "Content-Type: application/json" -H "X-Admin-Key: dev-admin-key-change-me" \
  -d '{"statement":"Test fact for verification","categoryL1":"Natural Sciences"}' \
  | jq -e '.results[0].result == "accepted"'
# Expected: true

# 6. Minimum 12 distractors after generate
# (requires ANTHROPIC_API_KEY set in server/.env)
FACT_ID=$(curl -sf -X POST http://localhost:3001/api/facts/ingest \
  -H "Content-Type: application/json" -H "X-Admin-Key: dev-admin-key-change-me" \
  -d '{"statement":"Blue whales can grow to 30 meters long","categoryL1":"Life Sciences","categoryL2":"Marine Biology"}' \
  | jq -r '.results[0].id')
curl -sf -X POST "http://localhost:3001/api/facts/${FACT_ID}/categorize" \
  -H "X-Admin-Key: dev-admin-key-change-me"
curl -sf -X POST "http://localhost:3001/api/facts/${FACT_ID}/generate" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq -e '.distractorCount >= 12'
# Expected: true

# 7. In-game report auto-flags at 3 reports
FACT_ID=$(curl -sf "http://localhost:3001/api/facts?status=approved&pageSize=1" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq -r '.facts[0].id')
for i in 1 2 3; do
  curl -sf -X POST "http://localhost:3001/api/facts/${FACT_ID}/report" \
    -H "Content-Type: application/json" \
    -d '{"reportText":"Test report '$i'"}'
done
curl -sf "http://localhost:3001/api/facts/${FACT_ID}" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq -e '.fact.status == "draft"'
# Expected: true

# 8. Gap analysis returns data
curl -sf "http://localhost:3001/api/facts/gap-analysis" \
  -H "X-Admin-Key: dev-admin-key-change-me" | jq '.gaps | length'
# Expected: > 0 (some subcategories will be under 20)

# 9. Dashboard accessible
curl -sf http://localhost:3002/ | grep -q 'Terra Gacha'
# Expected: exit code 0

# 10. Distractor confidence threshold enforced
node -e "
const D = require('better-sqlite3');
const db = new D('./server/data/facts.db');
const bad = db.prepare('SELECT COUNT(*) as n FROM distractors WHERE distractor_confidence IS NULL').get();
console.assert(bad.n === 0, 'All distractors must have confidence scores');
console.log('All distractors have confidence scores:', bad.n === 0);
"
```

### Manual Checklist

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] `server/data/facts.db` created with all 4 tables
- [ ] Fact ingestion endpoint accepts single fact and batch (up to 100)
- [ ] Fact ingestion rejects batch > 100 with 400 error
- [ ] Ingestion without `X-Admin-Key` returns 401
- [ ] Duplicate fact detection rejects semantically identical statement
- [ ] LLM generation produces ≥12 distractors per fact (requires `ANTHROPIC_API_KEY`)
- [ ] Each distractor has `difficulty_tier` (easy/medium/hard) and `distractor_confidence` (0-1)
- [ ] `gaiaComments` is array with 3-5 entries
- [ ] `gaiaWrongComments` has snarky/enthusiastic/calm keys
- [ ] `alternateExplanations` has 2-3 entries
- [ ] `mnemonic` is non-empty
- [ ] `sourceUrl` renders as clickable link in FactCard.svelte
- [ ] Report button opens modal; modal submits; server increments `in_game_reports`
- [ ] 3 reports cause fact to revert to `draft` status
- [ ] Dashboard loads at http://localhost:3002
- [ ] Dashboard Gap Analysis tab shows subcategories under 20 facts
- [ ] Dashboard Distractor Review shows distractors below confidence threshold
- [ ] Old `npm run build` (build-facts-db.mjs) still works with existing seed data
- [ ] `npm run typecheck` still passes after `types.ts` changes
- [ ] Sprite generation daemon creates 256px + 32px PNG files in `public/fact-sprites/`
- [ ] Generated sprites have transparent backgrounds (RGBA PNG)

---

## Files Affected

### New Files

| File | Sub-Phase | Purpose |
|---|---|---|
| `server/src/db/facts-db.ts` | 11.7 | SQLite connection for facts.db |
| `server/src/db/facts-migrate.ts` | 11.7 | Idempotent DDL runner for facts schema |
| `server/src/middleware/adminAuth.ts` | 11.1 | X-Admin-Key enforcement |
| `server/src/routes/facts.ts` | 11.1–11.3 | All fact API routes |
| `server/src/services/deduplication.ts` | 11.1 | Semantic duplicate detection |
| `server/src/services/categorization.ts` | 11.2 | LLM categorization + related facts |
| `server/src/services/contentGen.ts` | 11.3 | Full content + distractor generation |
| `server/src/services/comfyui.ts` | 11.5 | ComfyUI API client + rembg |
| `server/src/dashboard/index.ts` | 11.4 | Dashboard Fastify server on port 3002 |
| `server/src/dashboard/public/index.html` | 11.4 | Dashboard HTML |
| `server/src/dashboard/public/app.js` | 11.4 | Dashboard vanilla JS |
| `server/src/dashboard/public/style.css` | 11.4 | Dashboard CSS |
| `server/src/scripts/sprite-gen-daemon.ts` | 11.6 | Background sprite generation loop |
| `server/data/.gitkeep` | 11.7 | Keeps data/ directory in git |
| `src/ui/components/ReportModal.svelte` | 11.8 | In-game fact report modal |
| `public/fact-sprites/` | 11.5–11.6 | Generated sprite files (gitignored) |

### Modified Files

| File | Sub-Phase | Changes |
|---|---|---|
| `server/src/index.ts` | 11.7, 11.1 | Register `initFactsSchema()`, register `factsRoutes` |
| `server/src/config.ts` | 11.1 | Add `adminApiKey`, `anthropicApiKey`, `comfyuiUrl`, `distractorConfidenceThreshold` |
| `server/.env` | 11.1 | Add `ADMIN_API_KEY`, `ANTHROPIC_API_KEY`, `COMFYUI_URL` (never committed) |
| `server/.gitignore` | 11.7 | Add `data/*.db*` |
| `server/package.json` | 11.4, 11.6 | Add `dashboard` and `sprite-daemon` npm scripts; add `sharp` dependency |
| `src/data/types.ts` | 11.7 | Expand `Fact`, add `Distractor`, `GaiaWrongComments`, `ContentVolatility`, `PixelArtStatus`, `FactStatus`; add `lastReviewContext` to `ReviewState` |
| `scripts/build-facts-db.mjs` | 11.7 | Add new columns to client-side DDL; gracefully handle missing new fields |
| `src/ui/components/FactCard.svelte` | 11.8 | Report button + sourceUrl link |
| `src/ui/components/QuizOverlay.svelte` | 11.8 | Report button on wrong-answer state |
| `src/services/apiClient.ts` | 11.8 | Add `reportFact()` method |

### Gitignored Paths

```
server/data/*.db
server/data/*.db-shm
server/data/*.db-wal
server/.env
public/fact-sprites/
```

---

## Sub-Phase 11.9: Facts DB Sizing & Lazy Loading (DD-V2-197)

### What

Plan and implement the database size budget and lazy-loading strategy so that the app remains installable (< 150MB APK) and boots quickly (< 3s cold start on 4G) as the facts corpus grows to 5,000+ entries. The core insight: most metadata (distractors, explanations, GAIA comments, mnemonics) is only needed at quiz time, not at boot.

### Projected Size

| Corpus Size | Uncompressed | Gzipped | Strategy |
|-------------|-------------|---------|----------|
| 1,000 facts | ~2–3 MB | ~0.8 MB | Bundle everything |
| 3,000 facts | ~6–9 MB | ~2.5 MB | Bundle core, lazy meta |
| 5,000 facts | ~10–15 MB | ~3–5 MB | Bundle core, lazy meta |

**Core DB** (`facts-core.db`): `id`, `statement`, `correct_answer`, `category`, `subcategory`, `content_volatility`, `distractor_count` — sufficient to run a quiz with pre-fetched full data. Target ≤ 2MB gzipped.

**Full metadata** (`facts-meta.db` or per-category): all distractor rows, `explanation`, `alternateExplanations`, `gaiaComments`, `gaiaWrongComments`, `mnemonic`, `acceptableAnswers`, `sourceUrl`, `image_sprite_url`. Lazy-fetched when a quiz is triggered or a category is opened in the Knowledge Tree.

### Where

- `scripts/build-facts-db.mjs` — add `--core-only` flag that generates `public/facts-core.db` with only essential columns
- `src/services/factsDB.ts` — update `init()` to load `facts-core.db` at boot; add `fetchFullFact(id: string)` that lazy-fetches metadata from `/api/facts/{id}` and caches in IndexedDB
- `src/services/apiClient.ts` — add `getFact(id: string): Promise<Fact>` method
- `src/data/types.ts` — add `CoreFact` type (subset of `Fact` with only core columns); `Fact` remains the full type

### How

#### Step 1 — Measure actual database sizes

After building `public/facts.db` from seed data (522 facts), measure baseline:

```bash
ls -lh public/facts.db
# Then gzip to measure compressed size:
gzip -c public/facts.db | wc -c
```

Repeat at 1K, 3K, and 5K fact counts (using generated test data) to confirm projections.

#### Step 2 — Add `--core-only` build mode to `scripts/build-facts-db.mjs`

```js
// Add to build-facts-db.mjs:
const CORE_ONLY = process.argv.includes('--core-only')

const CORE_COLUMNS = `
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  content_volatility TEXT DEFAULT 'timeless',
  distractor_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'approved'
`

// Use CORE_COLUMNS when CORE_ONLY flag set; full schema otherwise
```

Add to `package.json` scripts:
```json
"build:facts-core": "node scripts/build-facts-db.mjs --core-only --output public/facts-core.db"
```

#### Step 3 — Update `src/services/factsDB.ts` for lazy metadata

```typescript
/** Cached full fact metadata, keyed by fact ID. Survives page reload via IndexedDB. */
private metaCache = new Map<string, Fact>()

/**
 * Returns the full Fact (with distractors, explanations, etc.).
 * Hits IndexedDB first, then server API if not cached.
 */
async fetchFullFact(id: string): Promise<Fact> {
  if (this.metaCache.has(id)) return this.metaCache.get(id)!

  // Check IndexedDB
  const cached = await idbGet<Fact>(`fact-meta:${id}`)
  if (cached) {
    this.metaCache.set(id, cached)
    return cached
  }

  // Fetch from server
  const fact = await apiClient.getFact(id)
  await idbSet(`fact-meta:${id}`, fact)
  this.metaCache.set(id, fact)
  return fact
}
```

The existing `getFacts()` method continues to use the local sql.js core DB for fast queries. Only `fetchFullFact()` hits the network.

#### Step 4 — Update quiz trigger in `QuizManager.ts`

When a quiz is triggered, call `factsDB.fetchFullFact(id)` before displaying the overlay. Since metadata is usually < 2KB per fact, this round-trip adds < 100ms on a fast connection and is hidden behind the quiz intro animation.

### Verification

```bash
# 1. Build core DB
npm run build:facts-core
ls -lh public/facts-core.db   # Should be significantly smaller than facts.db

# 2. Measure gzipped size
gzip -c public/facts-core.db | wc -c
# Target: < 2MB (2,097,152 bytes) at 5,000 facts

# 3. Confirm boot does not block on full metadata
# In browser: measure time from page load to "Dive" button appearing
# Target: < 3s on simulated 4G (Chrome DevTools throttling)

# 4. Confirm lazy fetch works
# Open Knowledge Tree → tap a fact card → verify full explanation appears
# Check Network tab: /api/facts/{id} request fires and returns 200
```

- [ ] `npm run typecheck` passes with `CoreFact` and updated `factsDB.ts`
- [ ] `public/facts-core.db` generated and measurably smaller than `facts.db`
- [ ] App boots using `facts-core.db` without errors
- [ ] Quiz overlay shows full distractors and explanation (confirms lazy fetch works)
- [ ] Fact metadata cached after first fetch (second quiz on same fact = 0 network requests)
- [ ] Load time < 3s on simulated 4G

---

## Sub-Phase 11.10: Fact Delta Sync Protocol (DD-V2-198)

### What

Implement incremental fact updates so new and corrected facts reach players without requiring an app store release. The server exposes a `GET /api/facts/delta?since={version}` endpoint; the client checks for deltas on app resume and after each dive, merges them into the local sql.js database, and persists the updated database to IndexedDB. The APK-bundled `facts.db` is the offline fallback for first launch; subsequent syncs bring it current.

### Why This Architecture

- Decouples content delivery from mobile release cadence (Play Store/App Store reviews take 1–3 days)
- Small deltas (typically < 50 facts per week) keep sync fast even on slow connections
- `INSERT OR REPLACE` semantics handle both new facts and corrected existing facts
- Fact corrections (fixing errors reported via the in-game Report button) reach players within one session

### Where

**Server (new/modified)**:
- `server/src/routes/facts.ts` — add `GET /api/facts/delta` route
- `server/src/db/facts-db.ts` — add `getFactsSince(version: number)` query

**Client (modified)**:
- `src/services/factsDB.ts` — add `syncDelta()` method
- `src/services/apiClient.ts` — add `getFactsDelta(since: number): Promise<DeltaResponse>` method
- `src/data/types.ts` — add `factDbVersion: number` field to `PlayerSave`
- `src/services/saveService.ts` — migration adds `factDbVersion: 0` default

### How

#### Step 1 — Server: `GET /api/facts/delta` route

```typescript
// In server/src/routes/facts.ts

interface DeltaResponse {
  version: number           // Current server fact DB version (auto-incrementing integer)
  facts: Fact[]             // Facts added or modified since `since`
  deletedIds: string[]      // Fact IDs that have been archived since `since`
}

fastify.get('/api/facts/delta', async (req, reply) => {
  const since = Number(req.query.since ?? 0)
  if (isNaN(since) || since < 0) return reply.code(400).send({ error: 'Invalid since parameter' })

  const facts = db.prepare(`
    SELECT * FROM facts
    WHERE db_version > ? AND status = 'approved'
    ORDER BY db_version ASC
    LIMIT 500
  `).all(since)

  const deleted = db.prepare(`
    SELECT id FROM facts
    WHERE db_version > ? AND status = 'archived'
    ORDER BY db_version ASC
  `).all(since).map((r: { id: string }) => r.id)

  const currentVersion = db.prepare('SELECT MAX(db_version) as v FROM facts').get() as { v: number }

  return reply.send({
    version: currentVersion.v ?? 0,
    facts,
    deletedIds: deleted
  } satisfies DeltaResponse)
})
```

Add `db_version INTEGER DEFAULT 0` column to the facts schema (auto-incremented by a trigger on `INSERT` or `UPDATE`).

#### Step 2 — Client: `syncDelta()` in `factsDB.ts`

```typescript
/**
 * Fetches fact deltas from the server and merges into the local sql.js database.
 * Persists the updated database to IndexedDB for offline resilience.
 * Safe to call frequently; no-ops if already at latest version.
 */
async syncDelta(): Promise<void> {
  const save = get(playerSave)
  const since = save.factDbVersion ?? 0

  try {
    const delta = await apiClient.getFactsDelta(since)
    if (delta.facts.length === 0 && delta.deletedIds.length === 0) return

    // Apply new/updated facts
    const insert = this.db!.prepare(`
      INSERT OR REPLACE INTO facts VALUES (
        :id, :statement, :correct_answer, :category, :subcategory,
        :content_volatility, :distractor_count, :status, :db_version
      )
    `)
    for (const fact of delta.facts) {
      insert.run(fact)
    }

    // Archive deleted facts (hide from quiz selection; preserve for history)
    const archive = this.db!.prepare(`UPDATE facts SET status = 'archived' WHERE id = ?`)
    for (const id of delta.deletedIds) {
      archive.run(id)
    }

    // Persist updated database to IndexedDB
    const data = this.db!.export()
    await idbSet('facts-db', data)

    // Update version in save
    playerSave.update(s => ({ ...s, factDbVersion: delta.version }))
    persistPlayer()
  } catch (err) {
    // Delta sync is best-effort; silently fail, will retry next session
    console.warn('[FactsDB] Delta sync failed (offline?)', err)
  }
}
```

#### Step 3 — Trigger sync at the right moments

In `src/game/GameManager.ts`, call `factsDB.syncDelta()` in these two places:

1. After `onDiveComplete()` — player has just finished a dive and is likely on Wi-Fi
2. In the app visibility change handler (when app comes to foreground)

```typescript
// In App.svelte or main.ts:
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    factsDB.syncDelta()  // Fire-and-forget; non-blocking
  }
})
```

### Verification

```bash
# 1. Confirm delta endpoint returns correct structure
curl -sf "http://localhost:3001/api/facts/delta?since=0" | jq '{
  version: .version,
  fact_count: (.facts | length),
  deleted_count: (.deletedIds | length)
}'
# Expected: version > 0, facts array non-empty

# 2. Add a new fact server-side and confirm delta picks it up
# After inserting a fact:
curl -sf "http://localhost:3001/api/facts/delta?since=<old_version>" | jq '.facts | length'
# Expected: 1

# 3. Confirm idempotency
# Run syncDelta() twice with same version — confirm no duplicates in client DB

# 4. Offline resilience test
# Load app, disconnect network, restart app — confirm existing facts still work
```

- [ ] `npm run typecheck` passes with `factDbVersion` in `PlayerSave`
- [ ] `GET /api/facts/delta?since=0` returns all approved facts with current version
- [ ] Adding a fact server-side → client picks it up within one session
- [ ] Correcting a fact server-side → client replaces the old row via `INSERT OR REPLACE`
- [ ] Archiving a fact server-side → client marks it archived, it no longer appears in quizzes
- [ ] App works fully offline after one sync (IndexedDB persistence confirmed)
- [ ] `syncDelta()` failing silently does not crash the app

---

## Sub-Phase 11.11: LLM Pipeline Architecture (DD-V2-207)

### What

Design and implement the server-side pipeline that automatically generates all computed fields for a fact: `distractors`, `gaiaComments`, `gaiaWrongComments`, `explanation`, `alternateExplanations`, `mnemonic`, `wowFactor`, `quiz_question`, `correct_answer` (normalized), `fun_score`, `age_rating`, `image_prompt`, and `acceptableAnswers`. The pipeline processes facts from a queue table in PostgreSQL (used for the server, separate from the client-side sql.js), using a cloud LLM API with structured output.

**Key decisions**:
- Use Claude Sonnet or GPT-4o-mini; local models lack nuance for plausible distractor generation (DD-V2-207)
- Cost estimate: ~1,500 tokens/fact × $0.003/1K tokens ≈ $0.005/fact; 5K facts ≈ $25 total
- Worker processes 10 requests/second; 5K facts complete in ~8 minutes
- Store raw LLM responses alongside parsed fields for debugging and regeneration

### Where

**New files**:
- `server/src/services/llmPipeline.ts` — main pipeline orchestrator
- `server/src/services/llmPrompts.ts` — all structured prompt templates
- `server/src/db/queue.sql` — facts processing queue DDL
- `server/src/workers/pipelineWorker.ts` — CLI-invokable queue worker

**Modified files**:
- `server/src/db/facts-db.ts` — add `queueForProcessing()`, `markProcessed()` helpers
- `server/src/routes/facts.ts` — trigger pipeline on fact ingestion (11.1 route)
- `server/package.json` — add `pipeline` script

### How

#### Step 1 — Queue table DDL (`server/src/db/queue.sql`)

```sql
CREATE TABLE IF NOT EXISTS facts_processing_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_id TEXT NOT NULL REFERENCES facts(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | done | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  enqueued_at INTEGER NOT NULL DEFAULT (unixepoch()),
  processed_at INTEGER,
  raw_llm_response TEXT  -- Full JSON response stored for debugging
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON facts_processing_queue(status, enqueued_at);
```

#### Step 2 — Prompt template for full fact generation (`server/src/services/llmPrompts.ts`)

```typescript
export function buildFactGenerationPrompt(fact: CoreFact): string {
  return `You are an educational content expert specializing in engaging quiz design.

Generate comprehensive quiz content for this fact:
FACT: "${fact.statement}"
CATEGORY: ${fact.category} > ${fact.subcategory ?? 'general'}

Return a JSON object with EXACTLY these fields:
{
  "quiz_question": "Clear, engaging question testing knowledge of this fact",
  "correct_answer": "Concise correct answer (1-2 sentences max)",
  "acceptable_answers": ["alt phrasing 1", "alt phrasing 2"],
  "distractors": [
    {
      "text": "Plausible but wrong answer",
      "difficulty_tier": "easy|medium|hard",
      "why_wrong": "Brief explanation of why this is incorrect"
    }
    // Provide EXACTLY 12 distractors: 4 easy, 4 medium, 4 hard
  ],
  "explanation": "Clear explanation of the correct answer (2-3 sentences)",
  "alternate_explanations": [
    "Alternate explanation using an analogy",
    "Alternate explanation with a real-world example"
  ],
  "mnemonic": "A memorable hook or memory technique for this fact",
  "gaia_comments": [
    "Enthusiastic GAIA comment on this fact (excited scientist tone)",
    "Snarky GAIA comment (dry wit, slightly sardonic)",
    "Calm GAIA comment (thoughtful, measured)",
    "Curious GAIA comment (asking a follow-up question)",
    "Awed GAIA comment (genuinely amazed)"
  ],
  "gaia_wrong_comments": {
    "enthusiastic": "Encouraging comment when player gets this wrong",
    "snarky": "Witty comment when player gets this wrong",
    "calm": "Patient comment when player gets this wrong"
  },
  "wow_factor": "One sentence about why this fact is genuinely surprising",
  "fun_score": 0.0,
  "age_rating": "all|13+|16+",
  "image_prompt": "ComfyUI pixel art prompt for an icon representing this fact"
}

DISTRACTOR QUALITY RULES:
- Easy distractors: obviously wrong to anyone who read the fact once
- Medium distractors: plausible to someone who vaguely knows the topic
- Hard distractors: require expert knowledge to distinguish from correct answer
- Never use "all of the above", "none of the above", or "I don't know"
- Distractors must be the same grammatical form as the correct answer
- fun_score is 0.0–1.0 where 1.0 = "I need to tell someone this immediately"

Return ONLY valid JSON. No markdown code blocks.`
}
```

#### Step 3 — Pipeline worker (`server/src/workers/pipelineWorker.ts`)

```typescript
/**
 * pipelineWorker.ts
 *
 * CLI worker that processes facts from the queue.
 * Run with: npm run pipeline
 * Processes up to BATCH_SIZE facts per invocation; safe to run repeatedly.
 */
import Anthropic from '@anthropic-ai/sdk'
import { factsDb } from '../db/facts-db'
import { buildFactGenerationPrompt } from '../services/llmPrompts'
import type { CoreFact } from '../../../src/data/types'

const BATCH_SIZE = 50
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function processQueue(): Promise<void> {
  const pending = factsDb.prepare(`
    SELECT fq.id as queue_id, f.*
    FROM facts_processing_queue fq
    JOIN facts f ON f.id = fq.fact_id
    WHERE fq.status = 'pending' AND fq.attempts < 3
    ORDER BY fq.enqueued_at ASC
    LIMIT ?
  `).all(BATCH_SIZE) as (CoreFact & { queue_id: number })[]

  console.log(`[Pipeline] Processing ${pending.length} facts...`)

  for (const fact of pending) {
    // Mark as processing
    factsDb.prepare(`UPDATE facts_processing_queue SET status = 'processing', attempts = attempts + 1 WHERE id = ?`)
      .run(fact.queue_id)

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildFactGenerationPrompt(fact) }]
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      const parsed = JSON.parse(raw)

      // Apply to facts table
      factsDb.prepare(`
        UPDATE facts SET
          quiz_question = ?,
          correct_answer = ?,
          explanation = ?,
          mnemonic = ?,
          wow_factor = ?,
          fun_score = ?,
          age_rating = ?,
          image_prompt = ?,
          status = 'approved'
        WHERE id = ?
      `).run(
        parsed.quiz_question, parsed.correct_answer, parsed.explanation,
        parsed.mnemonic, parsed.wow_factor, parsed.fun_score, parsed.age_rating,
        parsed.image_prompt, fact.id
      )

      // Insert distractors
      const insertDistractor = factsDb.prepare(`
        INSERT OR REPLACE INTO distractors
          (fact_id, text, difficulty_tier, distractor_confidence, why_wrong)
        VALUES (?, ?, ?, 0.85, ?)
      `)
      for (const d of parsed.distractors) {
        insertDistractor.run(fact.id, d.text, d.difficulty_tier, d.why_wrong)
      }

      // Store raw response
      factsDb.prepare(`
        UPDATE facts_processing_queue
        SET status = 'done', processed_at = unixepoch(), raw_llm_response = ?
        WHERE id = ?
      `).run(raw, fact.queue_id)

      console.log(`[Pipeline] ✓ ${fact.id} — ${fact.statement.slice(0, 50)}...`)
    } catch (err) {
      factsDb.prepare(`
        UPDATE facts_processing_queue
        SET status = 'failed', last_error = ?
        WHERE id = ?
      `).run(String(err), fact.queue_id)
      console.error(`[Pipeline] ✗ ${fact.id}:`, err)
    }

    // Rate limiting: 10 req/sec = 100ms between requests
    await new Promise(r => setTimeout(r, 100))
  }

  const remaining = factsDb.prepare(`SELECT COUNT(*) as n FROM facts_processing_queue WHERE status = 'pending'`).get() as { n: number }
  console.log(`[Pipeline] Done. ${remaining.n} facts still pending.`)
}

processQueue().catch(console.error)
```

Add to `server/package.json`:
```json
"scripts": {
  "pipeline": "tsx src/workers/pipelineWorker.ts"
}
```

### Verification

```bash
# 1. Queue 10 test facts and run pipeline
npm run pipeline
# Expected: all 10 processed within 30 seconds

# 2. Verify generated content quality
node -e "
const D = require('better-sqlite3')
const db = new D('./server/data/facts.db')
const fact = db.prepare('SELECT * FROM facts WHERE status = \\'approved\\' LIMIT 1').get()
const distractors = db.prepare('SELECT * FROM distractors WHERE fact_id = ?').all(fact.id)
console.log('Distractors:', distractors.length)
console.assert(distractors.length >= 12, 'Must have at least 12 distractors')
const tiers = distractors.map(d => d.difficulty_tier)
console.assert(tiers.includes('easy'), 'Must have easy distractors')
console.assert(tiers.includes('medium'), 'Must have medium distractors')
console.assert(tiers.includes('hard'), 'Must have hard distractors')
console.log('PASS: Distractor tiers correct')
"

# 3. Verify raw_llm_response stored (enables debugging and regeneration)
node -e "
const D = require('better-sqlite3')
const db = new D('./server/data/facts.db')
const q = db.prepare('SELECT raw_llm_response FROM facts_processing_queue WHERE status = \\'done\\' LIMIT 1').get()
console.assert(q && q.raw_llm_response, 'Raw LLM response must be stored')
console.log('PASS: Raw response stored')
"
```

- [ ] `npm run typecheck` passes with new pipeline types
- [ ] Queue 100 test facts → all processed within 30 seconds
- [ ] Each processed fact has ≥ 12 distractors (4 easy / 4 medium / 4 hard)
- [ ] `gaia_comments` array has exactly 5 entries per fact
- [ ] `gaia_wrong_comments` has snarky/enthusiastic/calm keys
- [ ] `mnemonic` is non-empty on all processed facts
- [ ] Raw LLM responses stored in queue table for all processed facts
- [ ] Worker handles API errors gracefully (retries up to 3×, marks failed after that)
- [ ] Cost estimate matches projection (check token usage in Anthropic dashboard)

---

## Sub-Phase 11.12: Semantic Duplicate Detection (DD-V2-208)

### What

Prevent the same fact from being added twice in different phrasings by comparing incoming facts against the existing corpus using vector embeddings. A new fact is flagged as a potential duplicate if any existing fact has a cosine similarity above 0.85. Embeddings are generated via OpenAI's `text-embedding-3-small` model and stored in PostgreSQL with the `pgvector` extension. An HNSW index ensures sub-millisecond nearest-neighbor queries even at 100K+ facts.

**Why embeddings over exact string matching**: "The Eiffel Tower is 330 meters tall" and "The Eiffel Tower stands 330 metres in height" are semantically identical but textually different. Embeddings catch paraphrases, alternate phrasings, and synonym substitutions.

**Cost**: `text-embedding-3-small` is $0.02 per 1M tokens. A 5,000-fact corpus with ~50 tokens per fact = 250K tokens = **$0.005 total** — effectively free.

### Where

**New files**:
- `server/src/services/embeddings.ts` — OpenAI embeddings client, batch embedding generation
- `server/src/services/duplicateDetector.ts` — similarity computation, flagging logic

**Modified files**:
- `server/src/db/facts-db.ts` — add `embedding REAL[]` column to facts table (pgvector format); or store as serialized Float32Array in SQLite if pgvector unavailable
- `server/src/routes/facts.ts` — call `checkDuplicate()` before inserting new fact
- `server/src/db/facts-schema.ts` — add embedding column and HNSW index DDL

**Schema note**: The server uses PostgreSQL for production (Railway/Fly.io); SQLite is client-only. The duplicate detection system targets the PostgreSQL facts table, not the client-side sql.js cache.

### How

#### Step 1 — Add pgvector to PostgreSQL schema

```sql
-- Enable pgvector extension (run once per database):
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to facts table:
ALTER TABLE facts ADD COLUMN embedding vector(1536);  -- 1536 dims for text-embedding-3-small

-- Create HNSW index (scales to 100K+ facts with sub-millisecond queries):
CREATE INDEX IF NOT EXISTS idx_facts_embedding_hnsw
  ON facts
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

#### Step 2 — Embeddings service (`server/src/services/embeddings.ts`)

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Generate an embedding vector for a fact statement.
 * Uses text-embedding-3-small (1536 dimensions, $0.02/1M tokens).
 */
export async function embedFact(statement: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: statement.trim(),
    encoding_format: 'float'
  })
  return response.data[0].embedding
}

/**
 * Generate embeddings for multiple facts in a single API call (batch mode).
 * OpenAI supports up to 2048 inputs per request.
 */
export async function embedFacts(statements: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: statements.map(s => s.trim()),
    encoding_format: 'float'
  })
  return response.data.map(d => d.embedding)
}
```

#### Step 3 — Duplicate detector (`server/src/services/duplicateDetector.ts`)

```typescript
import { pgPool } from '../db/postgres'
import { embedFact } from './embeddings'

export interface DuplicateCandidate {
  id: string
  statement: string
  similarity: number
}

const SIMILARITY_THRESHOLD = 0.85

/**
 * Check if an incoming fact statement is semantically similar to any existing fact.
 * Returns up to 5 nearest neighbors above the similarity threshold.
 *
 * @returns Empty array if no duplicates found; populated array if potential duplicates exist.
 */
export async function checkDuplicate(statement: string): Promise<DuplicateCandidate[]> {
  const embedding = await embedFact(statement)

  const result = await pgPool.query<{ id: string; statement: string; similarity: number }>(`
    SELECT
      id,
      statement,
      1 - (embedding <=> $1::vector) AS similarity
    FROM facts
    WHERE status != 'archived'
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 5
  `, [`[${embedding.join(',')}]`])

  return result.rows.filter(row => row.similarity >= SIMILARITY_THRESHOLD)
}

/**
 * Backfill embeddings for all facts that don't yet have one.
 * Run this script after enabling the column; processes in batches of 100.
 */
export async function backfillEmbeddings(): Promise<void> {
  const { rows } = await pgPool.query<{ id: string; statement: string }>(
    `SELECT id, statement FROM facts WHERE embedding IS NULL LIMIT 100`
  )
  if (rows.length === 0) {
    console.log('[Embeddings] All facts have embeddings.')
    return
  }

  const embeddings = await embedFacts(rows.map(r => r.statement))

  for (let i = 0; i < rows.length; i++) {
    await pgPool.query(
      `UPDATE facts SET embedding = $1::vector WHERE id = $2`,
      [`[${embeddings[i].join(',')}]`, rows[i].id]
    )
  }

  console.log(`[Embeddings] Backfilled ${rows.length} facts. Running again for remaining...`)
  await backfillEmbeddings()  // Recurse until all done
}
```

#### Step 4 — Wire into fact ingestion route (modification to 11.1 route)

```typescript
// In server/src/routes/facts.ts, inside the POST /api/facts handler:

const duplicates = await checkDuplicate(body.statement)
if (duplicates.length > 0) {
  // Don't block ingestion; flag for review instead
  return reply.code(409).send({
    error: 'Potential duplicate detected',
    duplicates: duplicates.map(d => ({
      id: d.id,
      statement: d.statement,
      similarity: Math.round(d.similarity * 100) / 100
    })),
    hint: 'Set force: true to ingest anyway (if you have reviewed the duplicates)'
  })
}

// If force: true is set in body, skip duplicate check
if (body.force === true) {
  // Log the override for audit trail
  console.warn(`[Facts] Force-ingesting fact despite potential duplicates: ${body.statement.slice(0, 60)}`)
}
```

#### Step 5 — Expose duplicate check in the management dashboard (11.4 extension)

Add a "Duplicates" tab to the dashboard showing pairs of facts with similarity > 0.80, with a "Keep Both" / "Archive One" action for each pair.

### Verification

```bash
# 1. Submit known duplicate → server returns 409 with similarity info
FACT="The speed of light in a vacuum is approximately 299,792 kilometers per second."
# Assuming this fact exists in DB:
curl -sf -X POST "http://localhost:3001/api/facts" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: dev-admin-key-change-me" \
  -d "{\"statement\": \"Light travels at roughly 300,000 km/s in a vacuum.\"}" | jq .
# Expected: 409 with duplicates array containing the similar fact with similarity ~0.93

# 2. Submit genuinely new fact → server returns 201
curl -sf -X POST "http://localhost:3001/api/facts" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: dev-admin-key-change-me" \
  -d "{\"statement\": \"The platypus is one of only five species of monotremes still alive today.\"}" | jq .
# Expected: 201 (no duplicate flagged)

# 3. Verify HNSW index exists
psql "$DATABASE_URL" -c "\d facts"
# Expected: embedding column with vector type visible

# 4. Query performance (must be sub-millisecond on 5K facts)
psql "$DATABASE_URL" -c "EXPLAIN ANALYZE SELECT id FROM facts ORDER BY embedding <=> '[$(python3 -c 'import random; print(",".join(str(random.random()) for _ in range(1536)))')']'::vector LIMIT 5;"
# Expected: Index Scan using idx_facts_embedding_hnsw
```

- [ ] `npm run typecheck` passes with new embedding types and OpenAI client
- [ ] pgvector extension enabled on PostgreSQL; `embedding vector(1536)` column added
- [ ] HNSW index created and visible in `\d facts`
- [ ] Submit known duplicate → 409 with similarity score ≥ 0.85
- [ ] Submit genuinely new fact → 201 (not flagged)
- [ ] `force: true` override allows ingestion despite duplicate flag
- [ ] Backfill script processes all existing facts without error
- [ ] Nearest-neighbor query executes in < 10ms on 5K fact corpus
- [ ] Dashboard Duplicates tab shows flagged pairs

- [ ] Design the fact generation queue: input text → Claude Sonnet or GPT-4o-mini extraction → distractor generation → validation → approval state. (DD-V2-207)
- [ ] Target cost ≤$0.005 per fact including distractors; store queue state in the `fact_pipeline` table with status column.

## Sub-Phase 11.12: Semantic Duplicate Detection

- [ ] Integrate `pgvector` embeddings in the facts table; compute cosine similarity on ingest. (DD-V2-208)
- [ ] Reject or flag-for-merge any new fact with cosine similarity ≥ 0.85 to an existing approved fact.

---

## Implementation Order

Implement sub-phases in this exact order due to dependencies:

1. **11.7** — Schema must exist before anything else can run
2. **11.1** — Ingest endpoint enables all subsequent data entry
3. **11.2** — Categorization uses ingested facts; populates `related_facts`
4. **11.3** — Content generation fills in all empty fields; marks facts `approved`
5. **11.4** — Dashboard needs approved facts with distractors to display meaningfully
6. **11.5** — Sprite selection dashboard extends 11.4; needs ComfyUI running
7. **11.6** — Daemon extends 11.5 services; runs independently after 11.3 generates `image_prompt`
8. **11.9** — DB sizing refactor before delta sync; do not implement 11.10 until core/metadata split is stable
9. **11.10** — Delta sync requires 11.9 split and 11.11 pipeline to be generating new facts
10. **11.11** — LLM pipeline before duplicate detection; need facts flowing to detect dupes
11. **11.12** — Semantic dedup last; requires pgvector extension on PostgreSQL (Phase 19 prerequisite)
8. **11.8** — In-game components need `sourceUrl` field (added in 11.7) and API endpoint (11.1)
