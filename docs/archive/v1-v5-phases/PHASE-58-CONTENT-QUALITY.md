# Phase 58: Content & Data Quality

**Status**: Not Started
**Depends On**: Phase 11 (Fact Content Engine — ingestion API, LLM pipeline, build-facts-db.mjs), Phase 32 (Fact Content Scaling — 3,000+ fact pipeline, distractor expansion), Phase 46 (Learning Effectiveness Research — anonymization, data export)
**Estimated Complexity**: Medium — primarily content pipeline work, data auditing, and admin tooling; limited Phaser/Svelte changes
**Design Decisions**: DD-V2-088 (fact quality gates), DD-V2-089 (source attribution), DD-V2-090 (distractor count targets)

---

## 1. Overview

Phase 58 scales the facts database toward launch quality and builds the tooling to sustain content quality over time. The current database has 522 facts with uneven distractor coverage and incomplete source attribution. This phase:

1. Scales facts from 522 to 1,000 high-quality entries.
2. Audits and expands the distractor pool to 25 per fact.
3. Populates missing source attribution fields.
4. Builds a minimal admin dashboard for ongoing fact management.
5. Generates a one-time content quality audit report.

This is primarily a **content and tooling phase** — most work is scripts, pipeline runs, and a server-side admin UI, not Svelte/Phaser code.

### What Exists Already

| File | Status |
|---|---|
| `build-facts-db.mjs` | Fact DB build script — exists; used in Phase 11/32 |
| `server/src/` | Fastify server — admin routes must be added here |
| Facts SQLite database | 522 facts at current state |
| Phase 11 LLM pipeline | Distractor expansion pipeline — exists |
| Phase 32 content scaling pipeline | Batch fact generation — exists |

---

## 2. Sub-phases

---

### 58.1 — Scale Facts to 1,000

**Goal**: Run the existing fact content pipeline to grow the database from 522 to 1,000 high-quality facts, prioritizing underrepresented categories.

#### 58.1.1 — Category gap analysis

Before generating new facts, run a gap analysis query against the existing facts database:

```sql
SELECT category_l1, COUNT(*) as fact_count
FROM facts
WHERE status = 'approved'
GROUP BY category_l1
ORDER BY fact_count ASC;
```

Document the output. Target distribution for 1,000 facts:
- Natural Sciences: 180 facts
- Life Sciences: 160 facts
- History: 160 facts
- Geography: 130 facts
- Technology: 130 facts
- Language: 120 facts
- Culture: 120 facts

Generate new facts in the most underrepresented categories first until the database reaches 1,000 total approved facts.

#### 58.1.2 — Use Phase 32 pipeline with category targeting

The Phase 32 pipeline (`build-facts-db.mjs` or the associated content generation scripts) accepts category parameters. Run it with the category targets identified above. Each batch of generated facts must pass the existing three-gate LLM quality review before being marked `approved`.

Quality gates (verify these exist from Phase 32 — re-assert them here):
1. **Accuracy gate**: LLM review confirms the fact is verifiably true.
2. **Clarity gate**: The statement is comprehensible to an adult learner without prior knowledge.
3. **Distractor quality gate**: All distractors are plausible but clearly wrong when the fact is known.

#### 58.1.3 — Required fields for all new facts

Every new fact added in this phase MUST have:
- `statement` (required)
- `wowFactor` (required — if empty, LLM generates one)
- `explanation` (required)
- `gaiaComment` or `gaiaComments[]` (at least one GAIA reaction)
- `distractors` (minimum 10, target 25 — see 58.2)
- `sourceUrl` (required — see 58.3)
- `sourceName` (required)
- `ageRating` (required — `'kid'`, `'teen'`, or `'adult'`)
- `status: 'approved'`

Do NOT add facts with empty `sourceUrl` — they will fail the 58.3 audit.

**Acceptance Criteria**:
- Database contains exactly 1,000 facts with `status = 'approved'` after this sub-phase completes.
- Category distribution approximates the targets (within 10%).
- All new facts pass the three-gate quality review.
- All required fields are populated.
- `npm run build` still succeeds (fact DB build is part of the build pipeline).

---

### 58.2 — Distractor Pool Audit and Expansion

**Goal**: Audit all 522+ facts for distractor count. Any fact with fewer than 25 distractors should be topped up using the LLM expansion pipeline.

#### 58.2.1 — Audit script: `scripts/distractor-audit.ts`

Create `scripts/distractor-audit.ts`:

```typescript
import Database from 'better-sqlite3'
import { join } from 'path'

const DB_PATH = join(process.cwd(), 'public', 'facts.db')
const db = new Database(DB_PATH, { readonly: true })

interface DistractorAuditRow {
  id: string
  statement: string
  category_l1: string
  distractor_count: number
}

const rows = db.prepare(`
  SELECT
    f.id,
    f.statement,
    f.category_l1,
    COUNT(d.id) as distractor_count
  FROM facts f
  LEFT JOIN distractors d ON d.fact_id = f.id
  WHERE f.status = 'approved'
  GROUP BY f.id
  ORDER BY distractor_count ASC
`).all() as DistractorAuditRow[]

const below10  = rows.filter(r => r.distractor_count < 10)
const below25  = rows.filter(r => r.distractor_count >= 10 && r.distractor_count < 25)
const at25plus = rows.filter(r => r.distractor_count >= 25)

console.log(`Total facts: ${rows.length}`)
console.log(`Below 10 distractors (CRITICAL): ${below10.length}`)
console.log(`10–24 distractors (needs expansion): ${below25.length}`)
console.log(`25+ distractors (good): ${at25plus.length}`)

// Write IDs needing expansion to a file for the pipeline to process
const needsExpansion = rows.filter(r => r.distractor_count < 25).map(r => r.id)
require('fs').writeFileSync('scripts/distractor-expansion-queue.json', JSON.stringify(needsExpansion, null, 2))
console.log(`Wrote ${needsExpansion.length} fact IDs to distractor-expansion-queue.json`)
```

Run: `npx tsx scripts/distractor-audit.ts`

#### 58.2.2 — Distractor expansion pipeline run

Using the existing Phase 11/32 LLM distractor expansion pipeline, process `distractor-expansion-queue.json`:

- For each fact ID in the queue, call the LLM with a prompt that generates additional plausible distractors for that fact.
- Deduplicate against existing distractors.
- Add to the database until the fact has 25 distractors.
- Re-run the distractor audit script to confirm 0 facts with < 25 distractors.

The target: every fact in the database should have exactly 25 approved distractors. This is a batch operation — it may require multiple pipeline runs.

**Acceptance Criteria**:
- `scripts/distractor-audit.ts` reports 0 facts with < 10 distractors.
- All 1,000 facts have at least 25 distractors.
- The expansion queue JSON is empty after the pipeline completes.

---

### 58.3 — Source Field Population

**Goal**: Every fact in the database should have a verifiable `sourceUrl` and `sourceName`. Audit all 522+ existing facts; populate any with blank source fields.

#### 58.3.1 — Source audit query

```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN source_url IS NULL OR source_url = '' THEN 1 ELSE 0 END) as missing_source_url,
  SUM(CASE WHEN source_name IS NULL OR source_name = '' THEN 1 ELSE 0 END) as missing_source_name
FROM facts
WHERE status = 'approved';
```

Document the counts. These facts need source attribution added.

#### 58.3.2 — Source population approach

For facts missing sources, use the following priority order:
1. **Known authorititative sources**: For facts in specific categories, use category-appropriate sources (NASA.gov for astronomy, NCBI.gov for biology, Britannica.com for history, etc.).
2. **LLM-assisted source finding**: For ambiguous facts, prompt the LLM: "Find the most authoritative public web source for this fact: [statement]". Validate that the URL is real and accessible (HTTP 200) before storing it.
3. **Wikipedia as fallback**: If no better source exists, use a specific Wikipedia article URL. Format `sourceName` as `"Wikipedia: [Article Title]"`.

Do NOT store placeholder URLs (`example.com`, `source.com`) or invented URLs. Every `sourceUrl` must resolve to a real page.

#### 58.3.3 — Verification

After population:
```sql
SELECT COUNT(*) as missing_source FROM facts
WHERE status = 'approved'
AND (source_url IS NULL OR source_url = '');
-- Should return 0
```

**Acceptance Criteria**:
- All 1,000 facts have non-empty `source_url` and `source_name`.
- Every `source_url` resolves to a real web page (HTTP 200) — verify via a batch URL checker script.
- Wikipedia sources are used only when no more authoritative source exists.

---

### 58.4 — Fact Content Admin Dashboard

**Goal**: A minimal web admin dashboard at `/admin/facts` (protected by basic auth) for managing facts: list view with filters, edit form for individual facts, and bulk operations (approve, reject, flag).

#### 58.4.1 — Basic auth middleware

In `server/src/app.ts`, add a basic auth middleware for the `/admin` route prefix:

```typescript
app.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/admin')) return
  const authHeader = request.headers.authorization ?? ''
  const [scheme, credentials] = authHeader.split(' ')
  if (scheme !== 'Basic' || !credentials) {
    reply.header('WWW-Authenticate', 'Basic realm="Recall Rogue Admin"')
    reply.status(401).send('Unauthorized')
    return
  }
  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':')
  const validUser = process.env.ADMIN_USERNAME ?? 'admin'
  const validPass = process.env.ADMIN_PASSWORD ?? 'changeme'
  if (username !== validUser || password !== validPass) {
    reply.status(403).send('Forbidden')
  }
})
```

**IMPORTANT**: `ADMIN_USERNAME` and `ADMIN_PASSWORD` must be set via environment variables — never hardcoded beyond the placeholder defaults. Document this requirement in `server/.env.example`.

#### 58.4.2 — Admin routes `server/src/routes/adminFacts.ts`

```typescript
/**
 * GET /admin/facts
 * Returns an HTML page (server-rendered, no framework) with:
 * - Fact count summary
 * - Filterable table: category, distractor count, has source, has image, status
 * - Pagination (50 per page)
 * - Links to individual fact edit pages
 */

/**
 * GET /admin/facts/:id/edit
 * Returns an HTML form for editing a single fact.
 * Fields: statement, correctAnswer, explanation, gaiaComment, sourceUrl, sourceName, ageRating, status
 * Note: distractors are NOT editable in this MVP admin — use the pipeline for distractor management.
 */

/**
 * POST /admin/facts/:id
 * Accepts form submission to update a fact.
 * Validates: statement (max 500 chars), status (enum), sourceUrl (URL format if present).
 * All inputs are sanitized before DB write.
 */

/**
 * POST /admin/facts/bulk
 * Accepts: { action: 'approve' | 'reject' | 'archive', factIds: string[] }
 * Max 100 fact IDs per bulk operation.
 * Validates action enum and fact ID format before executing.
 */
```

The admin UI is plain HTML + vanilla JS (no bundler). It should be simple, functional, and not require a frontend build step. Use minimal inline CSS (dark theme, monospace font).

#### 58.4.3 — Admin list view filters

The list view at `/admin/facts` must support URL query params for filtering:

- `?category=History` — filter by `category_l1`
- `?status=draft` — filter by status (`draft`, `approved`, `archived`)
- `?has_source=no` — filter to facts missing `source_url`
- `?min_distractors=0&max_distractors=9` — filter by distractor count range
- `?has_image=no` — filter to facts without `pixelArtPath`
- `?page=2` — pagination

**Acceptance Criteria**:
- `/admin/facts` is accessible with the correct basic auth credentials.
- The list view shows all facts with filters working via URL params.
- Individual fact edit form saves changes to the database.
- Bulk approve/reject actions work on up to 100 selected facts.
- All form inputs are sanitized before database writes.
- Admin credentials are read from `ADMIN_USERNAME` / `ADMIN_PASSWORD` environment variables.
- Without credentials, a 401 response with WWW-Authenticate header is returned.

---

### 58.5 — Content Quality Audit Report

**Goal**: Generate a one-time audit report establishing a quality baseline: total facts, per-category breakdown, distractor averages, source coverage, image coverage, GAIA comment coverage. Output as both JSON and Markdown.

#### 58.5.1 — `scripts/fact-audit.ts`

Create `scripts/fact-audit.ts`:

```typescript
import Database from 'better-sqlite3'
import { writeFileSync } from 'fs'
import { join } from 'path'

const DB_PATH = join(process.cwd(), 'public', 'facts.db')
const db = new Database(DB_PATH, { readonly: true })

interface CategoryStats {
  category: string
  total: number
  withSource: number
  withImage: number
  withGaiaComment: number
  avgDistractors: number
  minDistractors: number
  maxDistractors: number
}

// Query per-category stats
const categories = db.prepare(`
  SELECT category_l1 as category,
    COUNT(*) as total,
    SUM(CASE WHEN source_url IS NOT NULL AND source_url != '' THEN 1 ELSE 0 END) as with_source,
    SUM(CASE WHEN pixel_art_path IS NOT NULL THEN 1 ELSE 0 END) as with_image,
    SUM(CASE WHEN gaia_comment IS NOT NULL AND gaia_comment != '' THEN 1 ELSE 0 END) as with_gaia_comment
  FROM facts
  WHERE status = 'approved'
  GROUP BY category_l1
  ORDER BY total DESC
`).all() as any[]

// Query distractor stats (if distractors are in a separate table)
// Adjust query to match actual DB schema
const distractorStats = db.prepare(`
  SELECT
    f.category_l1,
    AVG(dc.cnt) as avg_distractors,
    MIN(dc.cnt) as min_distractors,
    MAX(dc.cnt) as max_distractors
  FROM facts f
  JOIN (
    SELECT fact_id, COUNT(*) as cnt FROM distractors GROUP BY fact_id
  ) dc ON dc.fact_id = f.id
  WHERE f.status = 'approved'
  GROUP BY f.category_l1
`).all() as any[]

// Build report
const report = {
  generatedAt: new Date().toISOString(),
  totalFacts: categories.reduce((s, c) => s + c.total, 0),
  categories: categories.map(c => {
    const ds = distractorStats.find(d => d.category_l1 === c.category) ?? {}
    return {
      category:          c.category,
      total:             c.total,
      sourcePercent:     ((c.with_source / c.total) * 100).toFixed(1) + '%',
      imagePercent:      ((c.with_image / c.total) * 100).toFixed(1) + '%',
      gaiaPercent:       ((c.with_gaia_comment / c.total) * 100).toFixed(1) + '%',
      avgDistractors:    Number(ds.avg_distractors ?? 0).toFixed(1),
      minDistractors:    ds.min_distractors ?? 0,
      maxDistractors:    ds.max_distractors ?? 0,
    } satisfies CategoryStats
  }),
}

// Write JSON
writeFileSync('scripts/fact-audit-report.json', JSON.stringify(report, null, 2))

// Write Markdown
const md = [
  `# Recall Rogue — Fact Content Quality Report`,
  `Generated: ${report.generatedAt}`,
  `Total approved facts: **${report.totalFacts}**`,
  '',
  `| Category | Total | Source% | Image% | GAIA% | Avg Distractors | Min | Max |`,
  `|---|---|---|---|---|---|---|---|`,
  ...report.categories.map(c =>
    `| ${c.category} | ${c.total} | ${c.sourcePercent} | ${c.imagePercent} | ${c.gaiaPercent} | ${c.avgDistractors} | ${c.minDistractors} | ${c.maxDistractors} |`
  ),
].join('\n')

writeFileSync('scripts/fact-audit-report.md', md)
console.log('Audit report written to scripts/fact-audit-report.json and scripts/fact-audit-report.md')
console.log(`Total facts: ${report.totalFacts}`)
```

Run: `npx tsx scripts/fact-audit.ts`

#### 58.5.2 — Integrate audit into CI

Add an optional audit step to `.github/workflows/ci.yml` that runs `npx tsx scripts/fact-audit.ts` on PRs that touch the facts database. The step should not fail the CI pipeline — it runs as `continue-on-error: true` and uploads the report as a CI artifact.

**Acceptance Criteria**:
- Running `npx tsx scripts/fact-audit.ts` produces `fact-audit-report.json` and `fact-audit-report.md`.
- The JSON report contains total fact count, per-category breakdowns, and distractor statistics.
- The Markdown report is human-readable and formatted as a table.
- The script does not throw errors on the current production DB.
- CI artifact upload works for the audit step.

---

## 3. Verification Gate

- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run build` completes successfully (fact DB build step included).
- [ ] `SELECT COUNT(*) FROM facts WHERE status = 'approved'` returns ≥ 1,000.
- [ ] `SELECT category_l1, COUNT(*) FROM facts WHERE status = 'approved' GROUP BY category_l1` shows all 7 categories with ≥ 100 facts each.
- [ ] `npx tsx scripts/distractor-audit.ts` reports 0 facts with < 25 distractors.
- [ ] `SELECT COUNT(*) FROM facts WHERE status = 'approved' AND (source_url IS NULL OR source_url = '')` returns 0.
- [ ] `/admin/facts` returns 401 without credentials.
- [ ] `/admin/facts` with correct basic auth credentials shows the fact list.
- [ ] `/admin/facts?category=History` filters to History facts only.
- [ ] Editing a fact via `/admin/facts/:id/edit` and saving updates the database.
- [ ] `npx tsx scripts/fact-audit.ts` runs without error and produces both output files.
- [ ] Markdown report shows ≥ 90% source coverage across all categories.

---

## 4. Files Affected

### Modified
- `build-facts-db.mjs` — verify it processes new facts correctly; add any missing schema fields
- `.github/workflows/ci.yml` — add optional audit step
- `server/src/app.ts` — register admin routes; add basic auth middleware for `/admin` prefix

### New
- `scripts/distractor-audit.ts`
- `scripts/fact-audit.ts`
- `scripts/fact-audit-report.json` (generated output — gitignore)
- `scripts/fact-audit-report.md` (generated output — gitignore)
- `scripts/distractor-expansion-queue.json` (generated — gitignore)
- `server/src/routes/adminFacts.ts`
- `server/.env.example` (updated to include `ADMIN_USERNAME`, `ADMIN_PASSWORD`)

### Content (not code)
- Facts database: grown from 522 to 1,000 approved facts
- All facts: distractor pools at 25 per fact
- All facts: `source_url` and `source_name` populated
