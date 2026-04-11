# Deck Audit Delta: 2026-04-10 → 2026-04-11

Re-run of the 87-deck quiz-audit-engine sweep after Phases 1–5 of the audit
cleanup landed (`/Users/damion/.claude-muldamion/plans/sorted-spinning-wind.md`).
This delta compares the pre- and post-cleanup master reports.

## Headline Numbers

| Metric | 2026-04-10 | 2026-04-11 | Delta |
|---|---|---|---|
| Decks audited | 87 | 87 | — |
| Total facts scanned | 50,056 | 50,270 | +214 (kana/hangul pool-split adds) |
| **Total checks** | 13,646 | **23,923** | **+75%** (stratified sampler) |
| Total fails | 2 | **1** | -1 |
| Total warns | 3,727 | **3,574** | -153 |
| **Warn ratio (warns/checks)** | **27.3%** | **14.9%** | **-45%** |
| Crashes | 1 | **0** | -1 ✓ |

The headline metric is **warn ratio**: the Phase 3 capitalization-axis fix
and Phase 2 subDecks guard dropped the per-check noise rate by nearly half
even as the stratified sampler almost doubled coverage.

## Tool Invocation

- 2026-04-10: `quiz-audit-engine.ts --json --sample 5 --include-vocab`
- 2026-04-11: `quiz-audit-engine.ts --json --stratified 50 --include-vocab`

Every vocab deck now receives ~150 checks (50 facts × 3 mastery levels)
instead of the previous 15. Knowledge decks also benefit: strata-guaranteed
coverage across difficulty + chainThemeId + answerTypePoolId axes.

## Crashes — Closed

| Deck | 2026-04-10 | 2026-04-11 |
|---|---|---|
| fifa_world_cup | CRASH: `TypeError synAnswer.toLowerCase` | **0 fails, 28 warns, fully auditable** |

Phase 1 coerced 15 numeric `syntheticDistractors` to strings + added a
defensive type guard in `selectDistractors` + added `verify-all-decks`
Check #34. The latent Sev-2 runtime crash is fully closed.

## Top Issue Categories

### By raw count

| Rank | Category | 2026-04-10 warns | 2026-04-11 warns | Raw delta |
|---|---|---|---|---|
| 1 | `distractor_format_inconsistency` | 1857 | 1623 | -234 |
| 2 | `near_duplicate_options` | 762 | 615 | -147 |
| 3 | `length_mismatch` | 277 | 428 | +151 |
| 4 | `question_type_mismatch` | 247 | 323 | +76 |
| 5 | `fallback_distractors_used` | 156 | 126 | -30 |
| 6 | `pos_mismatch` | 102 | 111 | +9 |
| 7 | `all_pool_fill` | 114 | 110 | -4 |
| 8 | `chinese_sense_mismatch_runtime` | 15 | 87 | +72 |
| 9 | `answer_too_long` | — | 39 | new surface |
| 10 | `trivially_eliminatable` | 61 | 30 | -31 |
| 11 | `min_pool_facts` | 22 | 22 | — |
| 12 | `placeholder_leak_runtime` | 18 | 18 | — |
| 13 | `unit_contamination` | 24 | 16 | -8 |
| 14 | `question_too_long` | 0 fail | 1 fail | persistent (korean_topik1) |
| 15 | `numeric_distractor_out_of_domain` | — | 9 | new surface |
| ~ | `reverse_distractor_language_mismatch` | 29 | **0** | ✅ **ELIMINATED (Phase 4)** |
| ~ | `empty_chain_themes_runtime` | 24 | **2** | ✅ **Suppressed (Phase 2)**; 2 real cases (world_capitals, world_countries) |
| ~ | `audit_engine_crash` | 1 fail | **0** | ✅ **ELIMINATED (Phase 1)** |

### By normalized warn ratio (warns / 1000 checks)

Raw counts can rise even as quality improves (more checks = more chances for
a check to fire). The normalized rate is the real signal.

| Category | Rate 2026-04-10 | Rate 2026-04-11 | Delta |
|---|---|---|---|
| `distractor_format_inconsistency` | 136/1000 | 68/1000 | **-50%** |
| `near_duplicate_options` | 56/1000 | 26/1000 | **-54%** |
| `length_mismatch` | 20/1000 | 18/1000 | -10% |
| `question_type_mismatch` | 18/1000 | 14/1000 | -22% |
| `fallback_distractors_used` | 11/1000 | 5/1000 | **-55%** |

Every category with a meaningful baseline dropped on a per-check basis.
The capitalization-axis collapse (Phase 3) delivered the predicted ~50%
reduction on the biggest category without masking real issues.

## Phase-by-Phase Attribution

| Phase | Target | Delta |
|---|---|---|
| **Phase 1** (fifa + Check #34) | audit_engine_crash | -1 crash, -1 fail |
| **Phase 2** (subDecks guard) | empty_chain_themes_runtime | -22 false-positive warns |
| **Phase 3** (cap axis collapse) | distractor_format_inconsistency | -234 raw warns, -50% rate |
| **Phase 4** (kana/hangul pool split) | reverse_distractor_language_mismatch | -29 warns (complete elimination) |
| **Phase 5** (stratified sampler) | coverage | +75% check count, vocab decks now at ~150 checks each |

## Surviving Failures

Only one hard fail remains:

| Deck | Check | Detail |
|---|---|---|
| `korean_topik1` | `question_too_long` | 1 fact has a question string over the 400-char fail threshold |

Carry forward as a targeted content-agent task (not in this plan's scope).

## Worst-Offender Decks (knowledge, by raw warns)

| Rank | Deck | 2026-04-10 warns | 2026-04-11 warns | Delta |
|---|---|---|---|---|
| 1 | human_anatomy | 284 | 581 | +297 (much deeper sample) |
| 2 | ap_microeconomics | 248 | 138 | -110 |
| 3 | ap_macroeconomics | 239 | 181 | -58 |
| 4 | ap_human_geography | 227 | 116 | -111 |
| 5 | ap_chemistry | 205 | 103 | -102 |
| 6 | ancient_rome | 109 | 147 | +38 (deeper sample) |
| 7 | ap_european_history | 94 | 123 | +29 (deeper sample) |
| 8 | ap_world_history | 60 | 110 | +50 (deeper sample) |
| 9 | philosophy | 127 | 105 | -22 |
| 10 | world_wonders | 61 | 119 | +58 (deeper sample) |

Note: increases on many decks reflect the stratified sampler finding more
real issues that the per-pool sampler missed. The three AP economics and
geography decks all dropped substantially — these were the decks where the
capitalization false positive dominated, so the Phase 3 fix had maximum
impact.

## Remaining Work — Not in This Plan's Scope

1. **Content cleanup for the ~1600 surviving `distractor_format_inconsistency`
   warns.** After Phase 3 the surviving warns name real pool-contamination
   cases — a senior content author should sweep the top 10 decks and split
   heterogeneous pools.
2. **`korean_topik1` `question_too_long` fix** — one-fact rewrite.
3. **`world_capitals` + `world_countries` chain structure** — add either
   `chainThemes` or per-fact `chainThemeId` values so Study Temple chain
   progression works on these decks.
4. **`chinese_sense_mismatch_runtime` +72 delta** — this category surfaced
   more real issues at higher sample depth. Worth a dedicated content pass
   on the six HSK decks that fire.
5. **`placeholder_leak_runtime` 18 warns** — unchanged from 2026-04-10,
   needs grammar-scar fix per the existing Anti-Pattern 6 playbook.

## Artifacts

- `data/reports/deck-audit-2026-04-11.json` — master summary
- `data/reports/deck-audit-2026-04-11/<deck>.json` — per-deck detail (87 files)
- `data/reports/deck-audit-2026-04-10.json` — pre-cleanup baseline (for diff)
- `data/reports/deck-audit-2026-04-10/` — pre-cleanup per-deck detail
