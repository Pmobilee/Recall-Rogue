# Deck Known Issues — Audit Log

> **Purpose:** Extracted polish items from the 2026-04-10 deck audit sweep. Organized by anti-pattern so
> new auditors know what to look for first. Raw registry notes live in `data/inspection-registry.json`
> (under each deck's `notes` field). Anti-pattern definitions are in `.claude/rules/deck-quality.md`.
>
> **Source audit date:** 2026-04-10 (commit `6e1b86fc3` and earlier in the same sweep).
> **Decks audited:** 11 of 99 total decks.

---

## Open Anti-Patterns by Category

### 1. POS-Mixing in `english_meanings` Pools (JLPT N1–N5)

**Affects:** `japanese_n1`, `japanese_n2`, `japanese_n3`, `japanese_n4`, `japanese_n5`

All five JLPT vocab decks share the same root problem: the `english_meanings` answer pool mixes verbs,
nouns, and adjectives in a single pool. At quiz time this makes distractors trivially eliminatable by
part of speech — a player answering "What does 決める mean?" can eliminate `"happiness"` (noun) and
`"slowly"` (adverb) just from POS, leaving only verb options to guess from.

**Fix when auditing:** POS-split the `english_meanings` pool into `english_meanings_verbs`,
`english_meanings_nouns`, `english_meanings_adjectives` (and `english_meanings_adverbs` if
warranted). Pad each sub-pool to 15+ with domain-appropriate synthetic distractors. This is
anti-pattern #10 in `.claude/rules/deck-quality.md`.

**Residual warn counts from this pattern:**

| Deck | `distractor_format_inconsistency` | `pos_mismatch` |
|------|----------------------------------|----------------|
| N1   | 179                               | 26             |
| N2   | 263                               | 6              |
| N3   | 97                                | 10             |
| N4   | 94                                | 28             |
| N5   | 164                               | 14             |

---

### 2. Formula-vs-Prose Mixing in Concept Pools (AP Physics 1)

**Affects:** `ap_physics_1`

The `concept_statements` answer pools mix formula-style answers (e.g. `"F = ma"`) with prose
descriptions (e.g. `"Net force equals mass times acceleration"`). The `looksLikeFormula` engine
check only guards pure-formula vs. pure-prose pairs — mixed pools with one formula among mostly-prose
answers still generate 94 `distractor_format_inconsistency` warns.

**Fix when auditing:** Split `concept_statements` pools so formula answers (`"F = ma"` style) live
in a `concept_formulas` sub-pool and prose descriptions live in `concept_prose`. Facts whose
`correctAnswer` contains an equals-sign or exponent are formula-type.

**Residual warns:** 162 total — 94 `distractor_format_inconsistency`, 28 `near_duplicate_options`,
21 `question_type_mismatch`, 16 `length_mismatch`, 3 `unit_contamination`.

---

### 3. Capitalization Mixing in Medical Terminology

**Affects:** `medical_terminology`

Body-system root pools draw from anatomical Titlecase pools (e.g. `"Heart"`, `"Lung"`) while
synthetic distractors come from lowercase term pools (e.g. `"hair"`, `"bone"`). The engine flags
every such pair as `distractor_format_inconsistency` — 228 of the 308 residual warns.

**Fix when auditing:** Normalize capitalization across all `medterm` pools. Either lowercase all
answers and distractors uniformly, or Titlecase all of them. The first option is simpler because
most synthetic distractors are already lowercase. Also consider splitting `root_meanings_musculoskeletal`
by length — 52 `length_mismatch` warns come from genuine size variance in that pool.

---

### 4. Near-Duplicate Options

**Affects:** `ancient_greece` (44 warns), `ap_physics_1` (28 warns), `medical_terminology` (28 warns),
`world_war_ii` (49 warns, acceptable post-split), `japanese_n2` (14 warns)

Near-duplicate options are answer pool members that differ only in punctuation, article, or minor
wording — e.g. `"Battle of Thermopylae"` and `"Battle at Thermopylae"`. Players can guess from
the formatting difference rather than knowledge.

**Fix when auditing:** For `ancient_greece`, specifically review the `historical_phrases_greek_religion`
pool — the audit noted near-duplicates concentrated there. Condense question stems to match answer
types. For other decks, run the quiz-audit engine and inspect flagged pairs individually.

---

### 5. `question_text_leak` — Answer Appears in Question Stem

**Affects:** `japanese_n1` (3 facts), `japanese_n3` (2 facts), `japanese_n5` (6 facts)

These facts have `correctAnswer` text that appears verbatim (or near-verbatim) in the
`quizQuestion` string, making the question self-answering.

**Fix when auditing:** Review each flagged fact individually — there is no batch fix. For JLPT
decks the typical cause is a question template that includes the romanized reading when asking
for the meaning. Rewrite the template to omit the answer or ask a different question angle.

**Total flagged facts:** 11 across the three N-level decks. Individual fact IDs are not captured
in the registry note — run `scripts/quiz-audit.mjs --deck japanese_n5` (etc.) and filter for
`question_text_leak` to get the list.

---

### 6. Length-Ratio Residuals (Acceptable in Small Pools)

**Affects:** `greek_mythology`, `world_war_ii` (post-split), `ap_biology` (52 warns),
`ancient_greece` (17 `length_mismatch` warns)

After correctly splitting large heterogeneous mega-pools, the resulting sub-pools are sometimes
small (5–10 facts) and contain genuine answer-length variance. The engine's max/min ratio < 3×
check fires even though no fix is needed — the variance is real content, not contamination.

**Status:** These are **accepted warns** for small pools. Document them with a
`homogeneityExempt: true` flag and `homogeneityExemptNote` in the pool definition if the
auditor has manually verified the pool is semantically clean.

---

### 7. `question_type_mismatch` — Keyword vs. Answer Format Mismatch

**Affects:** `ancient_greece` (33 warns), `ap_physics_1` (21 warns), `japanese_n2` (2 warns),
`japanese_n3` (3 warns)

A question starting with "who" expects a name answer; "when" expects a date; "how many" expects
a number. When the `correctAnswer` format doesn't match the question stem keyword, the engine
flags it.

**Fix when auditing:** Either rewrite the question stem to match the answer type or change the
`correctAnswer` to match the question. For `ancient_greece` the note specifically says to
"condense question stems to match answer types."

---

## Per-Deck Residual State Table

| Deck | Residual Warns | Dominant Type | Status |
|------|---------------|---------------|--------|
| `ancient_greece` | 202 | `distractor_format_inconsistency` (106) | Future fix: near-dupes + stem rewrite |
| `ap_biology` | 52 | `length_mismatch` | Acceptable — length ratio, <3× hard-fail |
| `ap_physics_1` | 162 | `distractor_format_inconsistency` (94) | Future fix: formula/prose pool split |
| `greek_mythology` | ~0 failures | `length_mismatch` (small pools) | Acceptable — inherent to small pools |
| `japanese_n1` | 221 | `distractor_format_inconsistency` (179) | Future fix: POS-split `english_meanings` |
| `japanese_n2` | 299 | `distractor_format_inconsistency` (263) | Future fix: POS-split `english_meanings` |
| `japanese_n3` | 122 | `distractor_format_inconsistency` (97) | Future fix: POS-split + 1 overlong question |
| `japanese_n4` | 137 | `distractor_format_inconsistency` (94) | Future fix: POS-split + trivially_eliminatable review |
| `japanese_n5` | 198 | `distractor_format_inconsistency` (164) | Future fix: POS-split + 6 question_text_leak facts |
| `medical_terminology` | 308 | `distractor_format_inconsistency` (228) | Future fix: normalize capitalization |
| `world_war_ii` | 49 | small sub-pool size flags | Acceptable post-split |

---

## How to Use This Doc

When you audit a new deck, check for these patterns **first** — they account for the majority of
warns across all 11 audited decks:

1. **POS-mixing** — does `english_meanings` (or any vocabulary pool) mix verbs, nouns, and adjectives?
2. **Formula/prose mixing** — does any concept pool mix `"F = ma"` style answers with prose descriptions?
3. **Capitalization mixing** — are synthetic distractors a different case than real answers?
4. **Near-duplicate options** — run the engine and check flagged pairs; focus on named-entity pools.
5. **`question_text_leak`** — filter quiz-audit output for this warn type and fix individually.
6. **Length ratio** — small pools (≤10 facts) will fire this; verify manually and exempt if clean.
7. **`question_type_mismatch`** — check that who/when/how-many stems match answer format.

Structural verifier: `node scripts/verify-all-decks.mjs`
Quiz audit: `npx tsx scripts/quiz-audit.mjs --deck <id>` (or `--all`)

The 2026-04-10 sweep fixed all BLOCKER and most MAJOR issues. The items in this doc are residual
MINOR/NIT-level polish items that were deferred because they require per-fact review or pool
restructuring work that is non-trivial for 5 decks simultaneously.
