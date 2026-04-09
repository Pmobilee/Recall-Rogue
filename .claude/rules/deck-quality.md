# Deck Quality & Verification Rules

## Deck Quality Checklist
- Answer pools ≥5 per question (runtime floor), ≥15 recommended for distractor variety
- Pools with 5-14 members: add syntheticDistractors to reach 15+
- Chain themes ≥8 per knowledge deck, ≥3 themes selected per run
- Total facts ≥30-50 per deck
- Synonyms computed
- No duplicate questions (image_question facts excluded — image differentiates them)
- funScore and difficulty assigned
- No ambiguous answers
- `answerTypePools` uses `factIds` array — NEVER `members`, `facts`, or `items`
- Every fact's `answerTypePoolId` references an existing pool in the deck
- Pool `id` fields match what facts reference — no naming mismatches
- Image-based facts (`imageAssetPath`) must have `quizMode: "image_question"` or `"image_answers"`
- Fill-in-blank `{___}` in quizQuestion is valid grammar syntax, not a braces error
- Pool `factIds` populated by scanning facts, never hand-crafted
- Pool answer length homogeneity: max/min ratio < 3× within each pool (check #20)
- NEVER use em-dashes (—) in `correctAnswer` — explanation text goes in `explanation` field
- Answers must be concise: core answer only, no parenthetical elaborations
- No compound questions asking two things with one answer — split into two facts
- Answer must not appear verbatim in question stem (self-answering)
- Question type keywords must match answer format (who→name, when→date, how many→number)
- No duplicate or near-duplicate facts within the same pool
- Image-quiz facts MUST be in separate `visual_*` pools — never mixed with text facts

## Answer Pool Homogeneity — CRITICAL

**Pools shared by questionTemplates MUST only contain facts that make sense for ALL templates using that pool.**

- If a pool is used by a `questionTemplate`, every fact must have the fields the template's placeholders reference
- Split broad pools into domain-specific sub-pools when templates reference domain-specific placeholders
- `correctAnswer` format must be consistent within a pool (no mixing single names with comma-separated lists)

## Pool Design Rules — MANDATORY

**Every answer pool must contain facts of ONE semantic answer type.**

- **Semantic homogeneity test:** "Can every pool member serve as a plausible distractor for every other member's question?" If not, split.
- **Never mix:** dates with counts, names with descriptions, measurements with events
- **Format consistency:** All answers in a pool must be the same grammatical/syntactic form
- **Minimum 5 real facts** per non-bracket pool. If splitting would produce <5, merge into parent pool.
- **Pad to 15+** with domain-appropriate `syntheticDistractors` after splitting
- **`homogeneityExempt: true`** only for inherently variable pools. Always add `homogeneityExemptNote`.

**Common split patterns:**
- `person_names` → `person_inventor_names` + `person_politician_names` + `person_scientist_names`
- `term_definitions` → `short_terms` (≤20c) + `long_definitions` (>20c)
- `number` → `count_values` + `percentage_values` + `year_values`

## Batch Deck Verification — MANDATORY

After modifying ANY curated deck:

```bash
node scripts/verify-all-decks.mjs           # Summary table (all decks)
node scripts/verify-all-decks.mjs --verbose  # Per-fact details on failures
```

22 checks per fact/deck. Target: **0 failures**. Warnings are informational.

## Trivia Bridge — MANDATORY (Knowledge Decks)

**Every knowledge deck MUST be bridged to the trivia database before committing.** Language/vocabulary decks are exempt.

After batch verification passes:
1. Add deck to `scripts/content-pipeline/bridge/deck-bridge-config.json`
2. Run `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs` — verify 0 ID collisions
3. Commit updated `bridge-curated.json` and `bridge-manifest.json` alongside the deck

## Content Quality Limits

| Field | Warn | Fail | Notes |
|-------|------|------|-------|
| `correctAnswer` length | >60 chars | >100 chars | Strip `{N}` markers. Skip vocab |
| `quizQuestion` length | >300 chars | >400 chars | Skip vocab |
| `difficulty` | — | <1 or >5, or missing | Required |
| `funScore` | — | <1 or >10, or missing | Required |
| `explanation` length | <20 chars | empty/missing | Skip vocab for short warn |
| `explanation` content | duplicates question | — | Normalized comparison |

## In-Game Quiz Audit — MANDATORY

After EVERY deck creation or major modification, 20+ facts MUST be reviewed as they appear in-game (Q + 4 options). This catches: eliminatable distractors, length mismatch, ambiguous questions, pool contamination.

```bash
npm run audit:quiz-engine                          # All knowledge decks
npm run audit:quiz-engine -- --deck <id> --verbose  # Single deck, detail
npm run audit:quiz-engine -- --render --deck <id>   # Render for LLM review
```

24 checks (10 structural + 14 engine-enabled). Run `node scripts/quiz-audit.mjs --deck <id> --full` for structural-only.

## LLM Content Review — MANDATORY

**After structural checks AND engine audit pass, run LLM content review.** Programmatic checks catch FORMAT issues. LLM review catches SEMANTIC issues. Both required.

Generate rendered samples, then have LLM evaluate: question clarity, answer correctness, distractor plausibility, eliminatability, length tells, domain coherence, ambiguity.

Required: after initial assembly, after bulk modifications (10+ facts), after pool redesign, before production-ready status.

## Post-Assembly Quality Gate — MANDATORY (added 2026-04-08)

**After assembling ANY new deck, run this COMPLETE quality pipeline before committing:**

```bash
# Step 1: Structural validation (22 checks, 0 failures required)
node scripts/verify-all-decks.mjs

# Step 2: Quiz engine audit (simulates actual quiz play, 0 failures required)
node scripts/quiz-audit.mjs --full --deck <id>

# Step 3: Pool heterogeneity check (auto-fix length mismatches)
node scripts/fix-pool-heterogeneity.mjs --dry-run

# Step 4: Synthetic distractor padding (pad pools to 15+)
node scripts/add-synthetic-distractors.mjs --dry-run

# Step 5: Self-answering detection
node scripts/fix-self-answering.mjs --dry-run

# Step 6: Sub-deck population (verify all sub-decks have factIds)
node scripts/fix-empty-subdecks.mjs --dry-run

# Step 7: Rebuild curated DB
npm run build:curated
```

**If ANY step finds issues, fix them BEFORE committing. Never ship a deck with known quality issues.**

## 4 Deck Quality Anti-Patterns — Lessons from 2026-04-08 Audit

### Anti-Pattern 1: Empty Sub-Deck factIds
**What:** Sub-decks defined in deck JSON with `factIds: []` even though facts have valid `chainThemeId` values.
**Why it happens:** Sub-deck arrays are hand-crafted instead of programmatically populated from facts.
**Impact:** Chain/themed grouping system doesn't work — facts aren't associated with their sub-deck.
**Prevention:** ALWAYS populate factIds by scanning facts: `subDeck.factIds = facts.filter(f => f.chainThemeId === subDeck.chainThemeId).map(f => f.id)`. Run `node scripts/fix-empty-subdecks.mjs --dry-run` to catch any misses.
**Fix script:** `node scripts/fix-empty-subdecks.mjs`

### Anti-Pattern 2: Pool Length Heterogeneity (Length Tells)
**What:** Answer pools mix short answers (e.g., "ATP" 3ch) with long answers (e.g., "Aminoacyl-tRNA synthetase" 25ch). Quiz shows 1 short + 3 long options = correct answer is obvious from length alone.
**Why it happens:** Pools are designed by semantic category ("molecule_names") without considering answer length distribution.
**Impact:** 354 quiz audit failures. Players can guess correctly without reading the question.
**Prevention:** After defining pools, check answer length distribution. If max/min ratio > 3x, split into `{pool}_short` and `{pool}_long`. Common splits:
  - `molecule_names` → `molecule_abbreviations` (≤5ch: ATP, CDK, p53) + `molecule_full_names` (>5ch)
  - `term_definitions` → `term_short` (single words) + `term_descriptions` (phrases/sentences)
**Fix script:** `node scripts/fix-pool-heterogeneity.mjs`

### Anti-Pattern 3: Pools Without Synthetic Distractors
**What:** Pools with 5-14 real facts and no syntheticDistractors. Players see the same 4-5 wrong answers every time.
**Why it happens:** syntheticDistractors forgotten during assembly or considered optional.
**Impact:** Repetitive quiz experience, easy to memorize distractors instead of learning.
**Prevention:** EVERY pool must have `factIds.length + syntheticDistractors.length >= 15`. After assembly, run `node scripts/add-synthetic-distractors.mjs --dry-run` to find gaps.
**Fix script:** `node scripts/add-synthetic-distractors.mjs`

### Anti-Pattern 4: Self-Answering Questions
**What:** The correctAnswer appears verbatim in the quizQuestion stem (>5 chars). Example: "What is the **deltoid** muscle that..." with answer "deltoid".
**Why it happens:** Questions are written in a form that names the answer. Common in anatomy and terminology decks.
**Impact:** Questions are trivially easy — no knowledge required, just match the bolded/obvious term.
**Prevention:** After writing questions, check: `quizQuestion.toLowerCase().includes(correctAnswer.toLowerCase())`. If true, rewrite using generic placeholders ("this muscle", "this term", "which structure").
**Fix script:** `node scripts/fix-self-answering.mjs`
