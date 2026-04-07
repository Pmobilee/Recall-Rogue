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
