# Subcategorize Unclassified Facts — Haiku LLM Skill

**Purpose**: Assign subcategories (`categoryL2`) to knowledge facts that the deterministic keyword classifier cannot handle.

**Status**: ✅ COMPLETE — All 10,546 knowledge facts have valid subcategories as of 2026-03-12.

**Invoked by**: Orchestrator (Opus) via `npm run subcategorize` or direct Agent spawning.

**Workers**: Haiku sub-agents (`model: "haiku"`) via Claude Code Agent tool.

---

## Current State

**0 unclassified facts** as of 2026-03-12. All 10,546 knowledge facts across 10 domains have valid taxonomy subcategories assigned via the workflow below. This skill successfully classified 606 remaining ambiguous facts in the final run.

---

## Workflow

### 1. Extract Unclassified Facts

**Orchestrator action**: Read seed JSON files and identify facts where `categoryL2` is invalid for their domain.

Files to scan:
- `src/data/seed/facts-general-a.json`
- `src/data/seed/facts-general-b.json`
- `src/data/seed/facts-general-c.json`
- `src/data/seed/facts-generated.json`

**Criteria for "unclassified"**:
- `categoryL1` is a valid domain (not "Language" or empty)
- `categoryL2` is empty, "general", "other", or NOT in the canonical taxonomy for that domain
- `type !== "Language"` (skip vocab/language facts)

**Output**: Map of domain → array of unclassified facts

```typescript
interface UnclassifiedFact {
  id: string;
  statement: string;
  quizQuestion: string;
  correctAnswer: string;
  explanation: string;
  categoryL1: string;  // domain key (e.g., "natural_sciences")
}
```

---

### 2. Group by Domain & Create Batches

**Orchestrator action**:
- Group unclassified facts by `categoryL1` domain
- Split each domain into batches of 40–50 facts (balance context window vs. throughput)
- Log summary: "Domain X: 42 unclassified facts, 1 batch"

---

### 3. Load Domain Taxonomies

**Orchestrator action**: Load `src/data/subcategoryTaxonomy.ts` and extract the canonical subcategory map:

```typescript
interface DomainTaxonomy {
  [domainKey: string]: {
    [subcategoryId: string]: string;  // { "capitals_countries": "National capitals, country facts" }
  };
}
```

Keep this in memory for validation (step 5).

---

### 4. Spawn Haiku Sub-Agents (Parallel)

**Orchestrator action**: For each batch, spawn a Haiku sub-agent with this prompt template:

```
You are a fact subcategorizer for educational trivia. Given a list of facts from the "{DOMAIN_LABEL}" domain, assign each fact to exactly ONE subcategory from the provided taxonomy.

## Domain: {DOMAIN_LABEL}
Description: {1-2 sentence domain description}

## Taxonomy
{For each subcategory:
- {subcategoryId}: {description}
}

## Rules
1. Every fact MUST receive a subcategory. No exemptions.
2. Never use "general", "other", "unknown", or "miscellaneous".
3. If a fact spans multiple subcategories, choose the PRIMARY one (the one most central to the fact's core content).
4. If a fact is genuinely ambiguous, pick the category that would be most useful educationally.
5. Return ONLY valid JSON, no markdown, no extra text.

## Facts to Classify
{For each fact in batch:
{
  "id": "{fact.id}",
  "statement": "{fact.statement.substring(0, 180)}",
  "question": "{fact.quizQuestion.substring(0, 100)}",
  "answer": "{fact.correctAnswer}"
}
}

## Output Format
Return a JSON array (and ONLY a JSON array) with this structure:
[
  {"id": "fact-id-1", "sub": "subcategory_id_1"},
  {"id": "fact-id-2", "sub": "subcategory_id_2"}
]

Do not include any other text, markdown, or explanation. Just the array.
```

**Sub-agent instructions**:
- Timeout: 60s per batch
- Model: Haiku (cost-optimized)
- Temperature: 0.3 (deterministic, reproducible)
- Validate each ID in the returned JSON against the domain taxonomy — reject invalid IDs

**Parallelization**: Spawn multiple Haiku agents in parallel (one per batch) to speed up processing.

---

### 5. Parse & Validate Haiku Responses

**Orchestrator action**: For each Haiku response:

1. **Extract JSON**: Parse the response as a JSON array. If parsing fails, log error and skip batch.
   ```javascript
   let classified;
   try {
     classified = JSON.parse(haikus_response_text);
     if (!Array.isArray(classified)) throw new Error("Not an array");
   } catch (e) {
     console.error(`Batch failed (JSON parse): ${e.message}`);
     return;  // Skip this batch, manual review needed
   }
   ```

2. **Validate each entry**:
   - `id` matches a fact in the batch
   - `sub` is a valid subcategory ID for the domain (check against taxonomy)
   - If invalid, log the error and skip that fact (do NOT write it back)

3. **Log validation results**:
   ```
   Domain: natural_sciences, Batch 1 of 3
   ✓ 48 facts classified
   ✗ 2 facts had invalid subcategory IDs (see manual-review.json)
   ```

---

### 6. Write Back to Seed Files

**Orchestrator action**: For each successfully classified fact:

1. **Locate the source file**: Determine which seed JSON file contains the fact ID (search all 4 files if needed)
2. **Update the fact object**:
   ```javascript
   fact.categoryL2 = subcategoryId;
   fact.category = fact.category || [];
   fact.category[1] = subcategoryId;
   // Keep everything else unchanged
   ```
3. **Write the file back** using the Write tool
4. **Track changes**: Log which file was modified and how many facts

---

### 7. Rebuild Facts Database

**Orchestrator action**: After all seed files are updated:

```bash
node scripts/build-facts-db.mjs
```

This normalizes and validates all facts, deriving `type`, `explanation`, and `rarity` as needed.

---

### 8. Verify & Report

**Orchestrator action**: After rebuild:

1. **Query the SQLite database** to verify classification:
   ```sql
   SELECT categoryL1, categoryL2, COUNT(*) as cnt
   FROM facts
   WHERE status = 'approved'
     AND categoryL1 != ''
     AND categoryL1 != 'Language'
   GROUP BY categoryL1, categoryL2
   ORDER BY categoryL1, cnt DESC;
   ```

2. **Checks**:
   - Every `categoryL2` value is a valid taxonomy ID (not "general", "other", empty)
   - For each domain, the distribution is reasonable (no single category has >60% of facts)
   - Total unclassified → 0 (or very small, for genuine ambiguous cases)

3. **Print summary**:
   ```
   Subcategorization Complete
   ===========================
   Domains processed: 10
   Facts classified: {totalCount}
   Facts skipped (invalid response): {skippedCount}

   Distribution by domain:
   - natural_sciences: 1,234 facts across 7 subcategories
   - geography: 856 facts across 5 subcategories
   ...

   Unclassified remaining: {remainingCount} (manual review needed)
   ```

4. **Save detailed report** to `data/generated/subcategorization-report-{TIMESTAMP}.json`:
   ```json
   {
     "timestamp": "2026-03-12T14:30:00Z",
     "totalProcessed": 1200,
     "totalClassified": 1180,
     "totalSkipped": 20,
     "domainBreakdown": {
       "natural_sciences": {"classified": 250, "skipped": 2, "distribution": {...}},
       "geography": {"classified": 180, "skipped": 0, "distribution": {...}}
     },
     "failedBatches": [
       {"domain": "history", "batch": 3, "reason": "Invalid subcategory IDs returned: [xyz, abc]"}
     ]
   }
   ```

---

## Implementation Rules

### CRITICAL: No Anthropic SDK
- **NEVER** `import('@anthropic-ai/sdk')` or call the Anthropic Messages API directly
- **ALL LLM work** is done by spawning Haiku sub-agents via the Claude Code Agent tool
- Sub-agents receive fully self-contained prompts (no external data fetches within the agent)

### Domain Key Mapping
Map `categoryL1` values from seed files to canonical domain keys in `subcategoryTaxonomy.ts`:

| Seed Value | Canonical Key |
|---|---|
| `general_knowledge` | `general_knowledge` |
| `natural_sciences` | `natural_sciences` |
| `space_astronomy` | `space_astronomy` |
| `geography` | `geography` |
| `history` | `history` |
| `mythology_folklore` | `mythology_folklore` |
| `animals_wildlife` | `animals_wildlife` |
| `human_body_health` | `human_body_health` |
| `food_cuisine` | `food_cuisine` |
| `art_architecture` | `art_architecture` |

### Batch Size & Context Window
- **One domain per Haiku agent** (not multiple batches per agent)
- Truncate fact fields: statement (180 chars), question (100 chars), answer (as-is)
- Avoid token bloat: don't include `explanation` or `distractors` in Haiku prompt
- Haiku context: 8K tokens, ~200 tokens per fact, ~40-50 facts per agent maximum

### Validation
- **Reject invalid responses**: If a Haiku agent returns invalid JSON or invalid subcategory IDs, log and skip — do NOT write garbage to the seed files
- **No fallback assumptions**: If a subcategory ID fails validation, do NOT guess or assign a default. Require manual review.
- **Track failures**: Save failed facts to `data/generated/manual-review-{TIMESTAMP}.json` for human review

### Parallelization
- Spawn **up to 3–5 Haiku agents in parallel** (adjust based on API rate limits)
- Wait for all agents to complete before proceeding to write-back
- Use `Promise.all()` or equivalent async control

---

## Prerequisites

Run these in order to set up and execute the full subcategorization pipeline:

1. **Fix domain misclassification and normalize L1**:
   ```bash
   node scripts/content-pipeline/fix-domains-and-normalize.mjs --write
   ```

2. **Backfill keyword-matchable subcategories**:
   ```bash
   node scripts/content-pipeline/backfill-subcategories.mjs --write --force --min-score=1
   ```

3. **Extract remaining unclassified facts** (to identify scope):
   ```bash
   node scripts/content-pipeline/extract-unclassified.mjs
   ```

4. **Spawn Haiku agents** to classify remaining facts (this skill — see "Invocation" below)

5. **Apply LLM classifications back to seed files**:
   ```bash
   node scripts/content-pipeline/apply-llm-classifications.mjs --write
   ```

6. **Rebuild the facts database**:
   ```bash
   node scripts/build-facts-db.mjs
   ```

7. **Verify distribution**:
   ```bash
   node scripts/content-pipeline/query-distribution.cjs
   ```

8. **Verify no invalid L2 values remain**:
   ```bash
   node scripts/content-pipeline/count-invalid-l2.mjs
   ```

---

## Invocation

### Via npm script (if set up):
```bash
npm run subcategorize
```

### Via direct Agent spawning (orchestrator):
```javascript
const result = await agent({
  subagent_type: "general-purpose",
  model: "haiku",
  prompt: `[Full skill workflow script as described above]`
});
```

### Manual invocation (Node.js):
```bash
node .claude/skills/subcategorize/index.mjs
```

---

## Success Criteria

1. ✅ All 4 seed JSON files scanned for unclassified facts
2. ✅ ~1,200 facts extracted and grouped by domain
3. ✅ Haiku sub-agents process all domains in batches
4. ✅ <5% failure rate on Haiku responses (invalid JSON or IDs)
5. ✅ All classified facts written back to seed files with valid `categoryL2` values
6. ✅ `npm run build-facts-db` succeeds with no errors
7. ✅ SQLite database shows 0 "general"/"other" in `categoryL2` for approved facts
8. ✅ Domain distribution is balanced (no category >65% of facts in a domain)
9. ✅ Detailed report generated and logged

---

## Common Issues & Troubleshooting

### Issue: Haiku returns invalid JSON
**Solution**: Log the response, skip batch, add to manual-review queue. Do NOT attempt to parse or fix.

### Issue: Subcategory ID not in taxonomy
**Solution**: Log fact ID and returned ID, skip that fact, add to manual-review queue. DO NOT write it back.

### Issue: Haiku assigns ambiguous facts poorly
**Solution**: This is acceptable — Haiku is instructed to pick the PRIMARY fit. If edge cases exist, they will be caught in post-launch analytics. Document in report as "borderline cases".

### Issue: Rebuild fails after write-back
**Solution**: Check for JSON syntax errors in modified seed files. Re-run with `--verbose` to see which file is malformed.

---

## Output Files

### Generated During Run
- **Seed JSON files** (modified in-place):
  - `src/data/seed/facts-general-a.json`
  - `src/data/seed/facts-general-b.json`
  - `src/data/seed/facts-general-c.json`
  - `src/data/seed/facts-generated.json`

- **Reports** (new):
  - `data/generated/subcategorization-report-{TIMESTAMP}.json` — summary + stats
  - `data/generated/manual-review-{TIMESTAMP}.json` — facts with invalid responses (if any)

### Side Effects
- **SQLite database rebuilt**: `src/db/facts.db` (via `build-facts-db.mjs`)
- **Seed files persisted**: All changes written via Write tool

---

## Notes for Orchestrator

- This skill is **deterministic and repeatable** — running it twice on the same unclassified set should produce identical results (Haiku temperature 0.3)
- **Cost**: ~1,200 facts ÷ 50 facts/batch = 24 batches × ~3K Haiku tokens ≈ 72K tokens ($0.54 at Haiku pricing)
- **Time**: ~5–10 minutes wall-clock (with parallelization), depends on Haiku queue
- **Maintenance**: If new domains are added, update the taxonomy map and re-run for those domains only
- **Post-launch**: Use in-game analytics to validate assignments. If a fact is often marked "unhelpful", it may need reclassification.

---

## Testing

After running this skill, verify with the Playwright test suite:

```bash
# E2E smoke test
node tests/e2e/01-app-loads.cjs

# Unit tests (if you add tests for subcategorization logic)
npx vitest run -- subcategorize.test.ts
```

And manually check a sample of the database:
```bash
sqlite3 src/db/facts.db "SELECT id, statement, category_l1, category_l2 FROM facts WHERE status='approved' AND category_l1='natural_sciences' LIMIT 10;"
```

Verify all `category_l2` values match the taxonomy.

