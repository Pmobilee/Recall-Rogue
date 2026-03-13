# Full Database Content Quality Sweep — Continuation Guide

> **Self-contained guide for continuing the quality sweep on a fresh Claude Code account.**
> Last updated: 2026-03-14

---

## What This Is

A full quality sweep of all 46,780 facts in `public/facts.db`. Every row is run through Sonnet agents to fix:

- Garbage/placeholder distractors
- Templated/vague/low-context vocab questions
- Truncated answers
- Severe distractor length spread
- Subcategory miscategorizations
- Duplicate distractors

---

## Current Progress (as of 2026-03-14, session 2)

- **314/582 batches complete** (54%), wave 1 of session 2 running (10 agents, 171 batches)
- **21,061 rows applied** to facts.db (45% of all 46,780)
- **Backup**: `public/facts.db.pre-sweep-backup` (original before any sweep changes)
- Heuristic flagged rows: started at 15,260, now ~14,499 (remaining flags mostly in unprocessed batches)
- **Bug fix applied**: `domainResolver.ts` now checks `categoryL1` first (was causing 17k facts to mis-resolve to general_knowledge)
- **Bug fix applied**: `factsDB.ts` `rowToFact()` now parses `category_l1`/`category_l2` from DB (was returning undefined)

### Per-group completion

| Group | Done | Total | Status |
|-------|------|-------|--------|
| knowledge-animals_wildlife | 34 | 34 | COMPLETE |
| knowledge-art_architecture | 28 | 28 | COMPLETE |
| knowledge-food_cuisine | 2 | 23 | WAVE 1 RUNNING (21 remaining) |
| knowledge-general_knowledge | 14 | 14 | COMPLETE |
| knowledge-geography | 23 | 23 | COMPLETE |
| knowledge-history | 6 | 28 | WAVE 1 RUNNING (22 remaining) |
| knowledge-human_body_health | 18 | 24 | WAVE 1 RUNNING (6 remaining) |
| knowledge-mythology_folklore | 3 | 15 | WAVE 1 RUNNING (12 remaining) |
| knowledge-natural_sciences | 16 | 18 | WAVE 1 RUNNING (2 remaining) |
| knowledge-space_astronomy | 9 | 9 | COMPLETE |
| vocab-cs | 11 | 11 | COMPLETE |
| vocab-de | 35 | 48 | WAVE 1 RUNNING (12 remaining, batches 36-47) |
| vocab-es | 23 | 56 | WAVE 1 RUNNING (33 remaining, batches 2-37) |
| vocab-fr | 10 | 10 | COMPLETE |
| vocab-it | 20 | 20 | COMPLETE |
| vocab-ja | 34 | 132 | WAVE 1 RUNNING (batches 22-51), WAVE 2 NEEDED (batches 52-131) |
| vocab-ko | 15 | 77 | WAVE 1 RUNNING (batches 2-31), WAVE 2 NEEDED (batches 32-76) |
| vocab-nl | 12 | 12 | COMPLETE |

**After wave 1 completes, remaining for wave 2:** vocab-ja batches 52-131 (80), vocab-ko batches 32-76 (45) = ~125 batches

---

## File Structure

```
data/generated/quality-sweep/
  manifest.json                      — tracks all 582 batches (status: pending/done/applied)
  batches/{group}/batch-NNN.jsonl    — input batch files (exported from DB)
  results/{group}/batch-NNN.jsonl    — output from Sonnet agents
  reports/apply-report.json          — last apply report
  reports/sweep-final.json           — last verify report
```

---

## Key Scripts

All scripts live in `scripts/content-pipeline/qa/`.

| Script | Purpose |
|--------|---------|
| `quality-sweep-db.mjs` | Main sweep orchestrator: status, apply, verify |
| `sync-sweep-manifest.mjs` | Syncs manifest with result files on disk; cleans French `e`-field contamination |
| `answer-check-live-db.mjs` | Original heuristic checker (the sweep extends this) |

### quality-sweep-db.mjs commands

```bash
# Show batch completion status by group
node scripts/content-pipeline/qa/quality-sweep-db.mjs status

# Apply all "done" batches to facts.db
node scripts/content-pipeline/qa/quality-sweep-db.mjs apply

# Validate without writing (dry run)
node scripts/content-pipeline/qa/quality-sweep-db.mjs apply --dry-run

# Re-run heuristics on all DB rows, count remaining issues
node scripts/content-pipeline/qa/quality-sweep-db.mjs verify
```

---

## How to Continue Processing Remaining Batches

### Step 1: Identify unfinished batches

```bash
node scripts/content-pipeline/qa/quality-sweep-db.mjs status
```

Or inspect the manifest directly:

```bash
python3 -c "
import json
m = json.load(open('data/generated/quality-sweep/manifest.json'))
pending = [b for b in m['batches'] if b['status'] == 'pending']
groups = {}
for b in pending:
    groups[b['group']] = groups.get(b['group'], 0) + 1
for g, c in sorted(groups.items()):
    print(f'{g}: {c} batches remaining')
print(f'Total: {len(pending)} batches')
"
```

### Step 2: Launch Sonnet agents for remaining batches

Spawn a Sonnet sub-agent via the Claude Code Agent tool for each unfinished group. The agent reads input batch files and writes result files.

**CRITICAL agent rules (apply to all prompts):**

- Use `model: "sonnet"` — NOT haiku. Sonnet produces significantly better rewrites.
- Include the subcategory taxonomy for knowledge batches (from `scripts/content-pipeline/subcategory-taxonomy.mjs`)
- Geography protection: NEVER change `l1` from `geography`, NEVER move rows to/from `capitals_countries`
- NEVER simplify or shorten `correctAnswer`
- Match distractor format to answer format
- No duplicate distractors
- Preserve diacritics exactly
- `null` in output means no change; `"d"` is always a full array (never null)

**Compact I/O format:**

Input row:
```json
{"id":"...","s":"statement","q":"question","a":"answer","d":["distractors"],"e":"explanation","l1":"category_l1","l2":"category_l2"}
```

Output row:
```json
{"id":"...","q":null,"a":null,"d":["always full array"],"e":null,"l1":null,"l2":null,"i":"description of changes"}
```

(`null` = unchanged; `"i"` = human-readable description of what was fixed)

---

### Agent prompt template — knowledge domains

```
You are a fact quality reviewer for the Recall Rogue quiz game.

Process ALL batch files in data/generated/quality-sweep/batches/knowledge-{DOMAIN}/
that do NOT have a corresponding result file in data/generated/quality-sweep/results/knowledge-{DOMAIN}/.

For each batch, read the JSONL input, review every row, and write the corrected JSONL
to the results directory at the same relative path.

Domain: {DOMAIN_LABEL}
Subcategory taxonomy:
{paste output of toTaxonomyPromptBlock(domain)}

Rules:
1. Fix garbage/placeholder distractors — replace with plausible wrong answers matching answer format
2. Fix vague/templated questions — make them specific and contextual
3. Fix truncated answers (ending in "...")
4. Verify l1/l2 categories against the taxonomy — correct if wrong
5. NEVER simplify the correctAnswer
6. Distractors must be 6-8 items, match answer format/length
7. Geography protection: never change l1 from geography, never touch capitals_countries
8. Output format: {"id","q","a","d","e","l1","l2","i"} — null means unchanged, d is always full array
```

---

### Agent prompt template — vocab languages

```
You are a vocabulary fact quality reviewer for the Recall Rogue quiz game.

Process ALL batch files in data/generated/quality-sweep/batches/vocab-{LANG}/
that do NOT have a corresponding result file in data/generated/quality-sweep/results/vocab-{LANG}/.

Language: {LANGUAGE_NAME} ({LANG_CODE})

Rules:
1. Fix "What does X mean?" bare questions → add POS hint ("The {lang} {pos} 'X' means what in English?")
2. Fix "What is the X word for Y?" templated questions → natural form
3. Fix vague questions where the word itself is missing from the question text
4. Replace garbage distractors with semantically coherent alternatives from the same semantic field
5. Distractors: 6-8 items, same format as answer (word count ±1, length ratio 0.5–2.0x)
6. Preserve ALL diacritics exactly
7. Output format: {"id","q","a","d","e","l1","l2","i"} — null means unchanged, d is always full array
```

---

### Step 3: After agents finish

```bash
# Sync manifest with new result files (MUST run before apply)
node scripts/content-pipeline/qa/sync-sweep-manifest.mjs

# Apply to database
node scripts/content-pipeline/qa/quality-sweep-db.mjs apply

# Verify convergence
node scripts/content-pipeline/qa/quality-sweep-db.mjs verify
```

**Target**: fewer than 500 flagged rows after all 582 batches are processed.

---

### Step 4: Handle rejections

The apply command validates every row before writing. Common rejection reasons and their meaning:

| Rejection type | Count (first pass) | Notes |
|---------------|-------------------|-------|
| Duplicate distractors | 219 | Rows not updated; originals stay in DB |
| Distractors not an array | 63 | Malformed agent output |
| Geography protection trigger | — | Working correctly; blocks invalid l1 changes |
| Answer too short | — | Catches Sonnet oversimplification |

Rejected rows can be re-processed in a targeted follow-up pass if needed.

---

## Known Issues

### 1. French vocab `e`-field contamination

The French Sonnet agent wrote strings like `"Fixed: distractors now match 'X'..."` into the explanation field. The `sync-sweep-manifest.mjs` script auto-cleans this by setting those values to `null`. Already fixed for all existing French results — the sync script will handle any new French batches as well.

### 2. Vocab garbage detector false positives

Common English words like `"house"`, `"to go"`, `"method"` appear in the garbage distractor set but are legitimate vocab distractors. The apply command already skips the garbage word list for `vocab-*` groups — it only checks for placeholder strings in those groups.

### 3. Korean batch row count mismatches

Several Korean batches contain 50 or 100 rows instead of the expected 100 (agents timed out mid-batch). Partial results are still applied — the missing rows simply are not updated. This is acceptable behavior.

---

## Validation (after all batches complete)

```bash
# Full heuristic re-check against facts.db
node scripts/content-pipeline/qa/quality-sweep-db.mjs verify

# Run unit tests
npx vitest run

# TypeScript type check
npm run typecheck
```

---

## Rollback

If something goes wrong and facts.db needs to be restored to its pre-sweep state:

```bash
cp public/facts.db.pre-sweep-backup public/facts.db
```

The backup at `public/facts.db.pre-sweep-backup` is the original database before any sweep changes were applied. It has not been modified.
