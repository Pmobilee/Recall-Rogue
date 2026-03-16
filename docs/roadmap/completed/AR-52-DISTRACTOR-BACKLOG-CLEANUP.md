# AR-52 — Distractor Backlog Cleanup

## Overview
**Goal:** Fix all remaining distractor quality issues across the database: 76 knowledge facts with bad distractors + 8,992 legacy vocab facts with pre-generated distractors that have duplicates/matches/garbage.

**Current state (post AR-51):**
- 2,488 knowledge facts with distractors: 76 have issues (46 length spread, 26 duplicates, 4 answer-in-question)
- 8,992 legacy vocab facts with pre-generated distractors (many with duplicates, answer matches, garbage)
- 96,984 vocab facts with empty distractors (use runtime generation — these are fine)
- Build warnings: 3,912 answer-in-question, 2,748 distractor=answer, 2,918 duplicate distractors (mostly in legacy vocab)

**Strategy:**
- **Knowledge facts (76):** Sonnet workers regenerate distractors — small batch, high quality
- **Legacy vocab facts (8,992):** Strip all pre-generated distractors → force runtime generation for ALL vocab. This is faster, safer, and produces better results than fixing 9K sets of distractors.

**Dependencies:** AR-51 (quality gate in place).
**Estimated complexity:** Medium (Sonnet batch for 76 facts + one-time vocab distractor strip).

## Sub-steps

### 1. Strip legacy vocab distractors
- Update all 8,992 vocab facts that have pre-generated distractors: set `distractors = []`
- This forces them to use the runtime distractor generation system (same as the 96,984 vocab facts that already work correctly)
- Apply to both seed JSON files and rebuild facts.db
- This eliminates ALL vocab distractor issues in one sweep

**Script:** Write a Node.js script that reads each `src/data/seed/knowledge-*.json` and any vocab seed files, finds vocab facts with non-empty distractors, and sets `distractors: []`. Also do the same for the `public/seed-pack.json`.

**Files:** `src/data/seed/*.json`, `public/facts.db` (rebuilt)
**Acceptance:** Zero vocab facts with pre-generated distractors. Build warnings for duplicate/matching distractors drop to near zero.

### 2. Fix 76 knowledge fact distractors via Sonnet
- Export the 76 knowledge facts with issues (46 length spread + 26 duplicates + 4 answer-in-question)
- For each fact, send ONLY: `id`, `quizQuestion`, `correctAnswer`, `distractors` (current) to a Sonnet worker
- Worker generates 6-8 new distractors that:
  - Match the answer's format and length (±50%)
  - Are factually wrong but plausible
  - Have no duplicates
  - Don't match the correct answer
- Apply fixes back to seed files and rebuild DB
- Batch size: 25 facts per worker (lean — ~5KB per batch)

**Files:** `src/data/seed/knowledge-*.json`, `public/facts.db`
**Acceptance:** Zero knowledge facts with distractor length spread, duplicates, or answer matches.

### 3. Verify with full scan
- Rebuild facts.db
- Run `npm run content:qa:answer-check:db -- check --db public/facts.db --checker verify --limit 12000`
- Confirm flagged count is 0 for knowledge facts (vocab flags are expected since they have no distractors)
- Run all quality tests

**Files:** `public/facts.db`
**Acceptance:** Build warnings drop significantly. Quality tests pass. Scan shows 0 real issues.

## Token Budget Estimate
- 76 knowledge facts × ~180 chars each = ~14KB total input
- 3 Sonnet workers × 25 facts each = ~5KB per worker
- Output: 6-8 distractors per fact × ~20 chars each = ~2KB per worker
- Total: well under 50KB — minimal token usage

## Files Affected
| File | Changes |
|------|---------|
| `src/data/seed/*.json` | Strip vocab distractors, fix knowledge distractors |
| `public/facts.db` | Rebuilt |
| `public/seed-pack.json` | Rebuilt |

## Verification Gate
- [ ] Zero vocab facts with pre-generated distractors
- [ ] Zero knowledge facts with length spread issues
- [ ] Zero knowledge facts with duplicate distractors
- [ ] Zero knowledge facts with answer=distractor
- [ ] Build warnings for distractor issues drop to <100
- [ ] `npm run typecheck` — 0 errors
- [ ] `npx vitest run` — all tests pass
- [ ] Quality scan: 0 real flagged facts
