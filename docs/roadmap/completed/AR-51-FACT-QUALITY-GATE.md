# AR-51 — Fact Quality Gate & Backlog Fix

## Overview
**Goal:** Ensure every fact in the database meets minimum quality standards before reaching players, fix the existing backlog of ~8,900 estimated issues, and add mandatory pre-ingestion validation so bad facts can never enter the DB again.

**Current state:**
- 108,465 total facts (105,976 vocab + 2,489 knowledge)
- 11,481 facts have pre-generated distractors that need quality validation
- 8.2% failure rate found in a 500-fact sample (41 flagged)
- Estimated ~900 issues in the 11,481 distractor-bearing facts
- 27 variant objects using wrong field name (`quizQuestion` instead of `question`)
- 354 facts with string[] variants (just question text, no answer/distractors)
- Key issue types: distractor length spread (18), empty distractors (5), numeric/type mismatch (8), low-context vocab (7)

**Dependencies:** AR-50 (domain misclassification) — completed.
**Estimated complexity:** High (full DB scan + Sonnet worker fixes + pipeline validation gate).

## Sub-steps

### 1. Full database quality scan
- Run the existing `answer-check-live-db.mjs check` command on ALL 11,481 distractor-bearing facts (not just 500)
- Record all flagged facts in the DB's `answer_check_issue` column
- Generate a complete report with issue counts by type

**Command:** `npm run content:qa:answer-check:db -- check --db public/facts.db --checker full-scan --limit 12000`
**Files:** `public/facts.db` (flags written), `data/generated/qa-reports/`
**Acceptance:** Full scan complete. All issues flagged in DB. Report generated.

### 2. Fix variant field name inconsistencies
- 27 facts have variant objects using `quizQuestion` instead of `question`
- Write a script to normalize: rename `quizQuestion` → `question` in all variant JSON
- 354 facts have string[] variants — convert to proper objects: `{ question: "the string", answer: fact.correctAnswer, distractors: fact.distractors }`
- Apply fixes directly to the seed files AND rebuild facts.db

**Files:** `src/data/seed/knowledge-*.json`, `public/facts.db`
**Acceptance:** Zero facts with `quizQuestion` in variants. Zero string[] variants. All variants are `{ question, answer/correctAnswer, distractors }` objects.

### 3. Fix backlog via Sonnet workers
- Export all flagged facts: `npm run content:qa:answer-check:db -- export-flagged --db public/facts.db --limit 2000`
- Spawn Sonnet sub-agents (via Claude Code Agent tool, model: "sonnet") to fix each batch:
  - **Distractor length spread**: Generate new distractors matching correct answer length/format
  - **Empty/missing distractors**: Generate 6-8 plausible wrong answers via Sonnet
  - **Numeric/type mismatch**: Replace mismatched distractors with same-type alternatives
  - **Low-context vocab prompts**: Rewrite questions to include part of speech and context
  - **Answer-in-question**: Rewrite question to avoid verbatim answer leakage
- Apply fixes: `npm run content:qa:answer-check:db -- apply-fixes --db public/facts.db --input .../flagged-fixed.jsonl --fixer sonnet-1`
- Re-scan to verify issues are resolved

**Files:** `public/facts.db`, `data/generated/qa-reports/`
**Acceptance:** Flagged count drops below 1% (from 8.2%). Re-scan confirms.

### 4. Add pre-ingestion quality gate to content pipeline
- In `scripts/contentPipelineUtils.mjs`, add a `validateFactQuality()` function that runs BEFORE facts are written to seed files
- Checks (MUST ALL PASS or fact is rejected):
  1. `quizQuestion` is non-empty and >10 characters
  2. `correctAnswer` is non-empty
  3. At least 3 distractors (for knowledge facts)
  4. No distractor matches correct answer
  5. No duplicate distractors
  6. Distractor length spread: max/min char ratio < 3.5x
  7. Distractor type matches answer type (numeric answers need numeric distractors)
  8. Variants (if present) use `question` field name (not `quizQuestion`)
  9. Variants have non-empty question text
  10. Category is a valid domain from the taxonomy
- Rejected facts are logged to `data/generated/qa-reports/rejected-at-ingestion.jsonl` with reason
- Gate is called in `normalizeFactInput()` — bad facts never reach seed files

**Files:** `scripts/contentPipelineUtils.mjs`
**Acceptance:** Attempting to ingest a fact with mismatched distractors produces a rejection log. Good facts pass through unchanged.

### 5. Add pre-ingestion quality gate test
- Vitest that validates the gate catches known bad patterns:
  - Empty question → rejected
  - Mismatched distractor types → rejected
  - Length spread > 3.5x → rejected
  - Duplicate distractors → rejected
  - Good fact → passes
- Also validates that ALL current seed facts pass the gate (regression test)

**Files:** `tests/unit/fact-ingestion-quality-gate.test.ts` (new)
**Acceptance:** Test passes. All current seed facts pass the gate.

### 6. Add runtime distractor type validation
- In `CardCombatOverlay.svelte`'s `getQuizForCard()`, after picking distractors, add a runtime check:
  - If correct answer is numeric (number, year, percentage) but distractors are text → swap from fact's distractor pool or generate fallback
  - If correct answer is a name/text but distractors are numbers → same
- This is a LAST LINE OF DEFENSE — should rarely trigger if pipeline gate works

**Files:** `src/ui/components/CardCombatOverlay.svelte`
**Acceptance:** A fact with mismatched distractor types shows type-appropriate distractors at runtime.

### 7. Rebuild facts.db and verify
- Rebuild: `npm run build:facts`
- Run full quality scan again to verify backlog is fixed
- Run vitest to verify gate tests pass

**Files:** `public/facts.db`
**Acceptance:** Quality scan shows <1% flagged. All tests pass.

## Files Affected
| File | Changes |
|------|---------|
| `public/facts.db` | Full scan, flagging, fixes applied, rebuild |
| `src/data/seed/knowledge-*.json` | Variant field normalization |
| `scripts/contentPipelineUtils.mjs` | Pre-ingestion quality gate |
| `src/ui/components/CardCombatOverlay.svelte` | Runtime distractor type check |
| `tests/unit/fact-ingestion-quality-gate.test.ts` (new) | Gate validation tests |
| `data/generated/qa-reports/` | Scan reports, fix payloads |
| `docs/GAME_DESIGN.md` | Document quality gate system |

## Verification Gate
- [ ] Full DB scan complete — all issues flagged
- [ ] Variant field names normalized (0 `quizQuestion` variants, 0 string[] variants)
- [ ] Backlog fixed — flagged rate <1% on re-scan
- [ ] Pre-ingestion gate rejects known bad patterns
- [ ] Gate test passes
- [ ] Runtime distractor type check works
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Playtest: 20 random questions show correct distractor types
