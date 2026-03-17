# ⛔⛔⛔ MANDATORY: AR PHASE DOC REQUIRED ⛔⛔⛔
#
# STOP. DO NOT WRITE CODE. DO NOT DELEGATE TO SUB-AGENTS. DO NOT EDIT FILES.
#
# Before doing ANY work that is not a trivial 2-minute single-line fix:
# 1. Check `docs/roadmap/phases/` and `docs/roadmap/completed/` for the next AR number
# 2. CREATE an AR phase doc: `docs/roadmap/phases/AR-NN-SHORT-NAME.md`
#    - Must contain: Overview, numbered TODO checklist, acceptance criteria, files affected
#    - ⚠️ AR docs MUST be written by the OPUS ORCHESTRATOR DIRECTLY — NEVER by sub-agents
# 3. Present the AR doc to the user for review
# 4. ONLY THEN begin implementation, checking off TODOs as you go
# 5. When done: move the doc to `docs/roadmap/completed/`
#
# NO EXCEPTIONS. "Let me just quickly..." is NOT an exception.
# "It's a small change" with more than 3 steps is NOT an exception.
# Content pipeline batches are NOT an exception.
# Multi-file refactors are NOT an exception.
#
# If you skip this step, the user WILL make you redo the work.
# ⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔

# Subcategorize Unclassified Facts — Sonnet LLM Skill

> See `docs/RESEARCH/SOURCES/content-pipeline-spec.md` for the canonical pipeline spec and `content-pipeline-progress.md` for current state.

**Purpose**: Assign subcategories (`categoryL2`) to knowledge facts that the deterministic keyword classifier cannot handle.

**Status**: Database being rebuilt from scratch. Run this skill after each batch of knowledge facts is generated.

**Invoked by**: Orchestrator (Opus) via `npm run subcategorize` or direct Agent spawning.

**Workers**: Sonnet sub-agents (`model: "sonnet"`) via Claude Code Agent tool.

---

## Current State

Database is being rebuilt. Check `docs/RESEARCH/SOURCES/content-pipeline-progress.md` for current fact counts per domain.

---

## Workflow

**Pipeline position:** This skill runs at Stage 2b of the 6-stage content pipeline — AFTER entity curation (Stage 2) and fact generation (Stage 3), but BEFORE production promotion (Stage 6). It must run after each batch of knowledge facts is generated, before facts enter the DB.

### 1. Extract Unclassified Facts

**Orchestrator action**: Read seed JSON files and identify facts where `categoryL2` is invalid for their domain.

Files to scan:
- `src/data/seed/tutorial.json`
- `src/data/seed/facts-general-a.json`
- `src/data/seed/facts-general-b.json`
- `src/data/seed/facts-general-c.json`
- `src/data/seed/knowledge-*.json` (per-domain seed files as they are created)

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

### 4. Spawn Sonnet Sub-Agents (Parallel)

**Orchestrator action**: For each batch, spawn a Sonnet sub-agent with this prompt template:

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
- Model: Sonnet (quality-critical)
- Temperature: 0.3 (deterministic, reproducible)
- Validate each ID in the returned JSON against the domain taxonomy — reject invalid IDs

**Parallelization**: Spawn multiple Sonnet agents in parallel (one per batch) to speed up processing.

---

### 5. Parse & Validate Sonnet Responses

**Orchestrator action**: For each Sonnet response:

1. **Extract JSON**: Parse the response as a JSON array. If parsing fails, log error and skip batch.
   ```javascript
   let classified;
   try {
     classified = JSON.parse(sonnet_response_text);
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
   - For each domain, no single subcategory exceeds 18% of facts (±5% tolerance from target distributions)
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
- **ALL LLM work** is done by spawning Sonnet sub-agents via the Claude Code Agent tool
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
- **One domain per Sonnet agent** (not multiple batches per agent)
- Truncate fact fields: statement (180 chars), question (100 chars), answer (as-is)
- Avoid token bloat: don't include `explanation` or `distractors` in Sonnet prompt
- Sonnet context: 200K tokens — can handle larger batches if needed, but keep at 40-50 facts per agent for quality

### Validation
- **Reject invalid responses**: If a Sonnet agent returns invalid JSON or invalid subcategory IDs, log and skip — do NOT write garbage to the seed files
- **No fallback assumptions**: If a subcategory ID fails validation, do NOT guess or assign a default. Require manual review.
- **Track failures**: Save failed facts to `data/generated/manual-review-{TIMESTAMP}.json` for human review

### Parallelization
- Spawn **up to 3–5 Sonnet agents in parallel** (adjust based on API rate limits)
- Wait for all agents to complete before proceeding to write-back
- Use `Promise.all()` or equivalent async control

---

## Subcategory Distribution Quotas — MANDATORY

**No single subcategory may exceed 18% of its domain's total facts.** After subcategorization, validate the distribution and flag violations.

Target distributions per domain (from AR-34, content-pipeline-spec):
- **History 2,000:** Ancient 14%, Medieval 10%, Renaissance 10%, Colonial 10%, Industrial 8%, WWI 7%, WWII 10%, Cold War 8%, Social/Cultural 14%, Historical Figures 9%
- **Animals 2,000:** Mammals 16%, Birds 12%, Marine 14%, Reptiles 10%, Insects 10%, Behaviors 15%, Endangered 10%, Records 13%
- **Human Body 2,000:** Anatomy 14%, Neuro 14%, Immunity 12%, Cardiovascular 10%, Digestion 12%, Senses 10%, Genetics 12%, Medical Discoveries 8%, Human Records 8%
- **Natural Sciences 2,000:** Physics 18%, Chemistry 16%, Biology 14%, Geology 12%, Ecology 10%, Materials 10%, Discoveries 10%, Math 10%
- **General Knowledge 2,000:** Records 15%, Inventions 15%, Language 12%, Firsts 12%, Economics 10%, Symbols 10%, Calendar 8%, Transport 8%, Oddities 10%
- **Space 2,000:** Planets/Moons 18%, Stars 15%, Missions 15%, Cosmology 12%, Astronauts 12%, Exoplanets 8%, Technology 10%, Records 10%
- **Mythology 2,000:** Greek/Roman 20%, Norse/Celtic 15%, Eastern 15%, Creatures 15%, Creation 10%, Folk 15%, Gods 10%
- **Food 2,000:** History 15%, Asian 15%, European 12%, Americas 10%, Ingredients 12%, Science 10%, Fermentation 10%, Baking 8%, Records 8%
- **Art 2,000:** Painting 18%, Sculpture 12%, Styles 15%, Buildings 15%, Modern 12%, Museums 10%, Movements 10%, Engineering 8%

**Tolerance:** ±5% from target. Flag any subcategory >18% of domain for manual review.

**Validation step (add to step 8 — Verify & Report):** After distribution query, check that no subcategory exceeds 18%. Currently the skill checks >60% which is far too lenient — change to 18%.

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

4. **Spawn Sonnet agents** to classify remaining facts (this skill — see "Invocation" below)

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
  model: "sonnet",
  prompt: `[Full skill workflow script as described above]`
});
```

### Manual invocation (Node.js):
```bash
node .claude/skills/subcategorize/index.mjs
```

---

## Success Criteria

1. ✅ All seed JSON files scanned for unclassified facts
2. ✅ Facts extracted and grouped by domain
3. ✅ Sonnet sub-agents process all domains in batches
4. ✅ <5% failure rate on Sonnet responses (invalid JSON or IDs)
5. ✅ All classified facts written back to seed files with valid `categoryL2` values
6. ✅ `npm run build-facts-db` succeeds with no errors
7. ✅ SQLite database shows 0 "general"/"other" in `categoryL2` for approved facts
8. ✅ Domain distribution is balanced (no single subcategory >18% of domain — see distribution quotas)
9. ✅ Detailed report generated and logged

---

## Common Issues & Troubleshooting

### Issue: Sonnet returns invalid JSON
**Solution**: Log the response, skip batch, add to manual-review queue. Do NOT attempt to parse or fix.

### Issue: Subcategory ID not in taxonomy
**Solution**: Log fact ID and returned ID, skip that fact, add to manual-review queue. DO NOT write it back.

### Issue: Sonnet assigns ambiguous facts poorly
**Solution**: This is acceptable — Sonnet is instructed to pick the PRIMARY fit. If edge cases exist, they will be caught in post-launch analytics. Document in report as "borderline cases".

### Issue: Rebuild fails after write-back
**Solution**: Check for JSON syntax errors in modified seed files. Re-run with `--verbose` to see which file is malformed.

---

## Output Files

### Generated During Run
- **Seed JSON files** (modified in-place):
  - `src/data/seed/tutorial.json`
  - `src/data/seed/facts-general-a.json`
  - `src/data/seed/facts-general-b.json`
  - `src/data/seed/facts-general-c.json`
  - `src/data/seed/knowledge-*.json` (per-domain seed files as they are created)

- **Reports** (new):
  - `data/generated/subcategorization-report-{TIMESTAMP}.json` — summary + stats
  - `data/generated/manual-review-{TIMESTAMP}.json` — facts with invalid responses (if any)

### Side Effects
- **SQLite database rebuilt**: `public/facts.db` (via `build-facts-db.mjs`)
- **Seed files persisted**: All changes written via Write tool

---

## Notes for Orchestrator

- This skill is **deterministic and repeatable** — running it twice on the same unclassified set should produce identical results (Sonnet temperature 0.3)
- **Time**: ~5–10 minutes wall-clock (with parallelization), depends on Sonnet queue
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

And manually check a sample of the database (rebuilt by `build-facts-db.mjs` from seed files):
```bash
sqlite3 public/facts.db "SELECT id, statement, category_l1, category_l2 FROM facts WHERE status='approved' AND category_l1='natural_sciences' LIMIT 10;"
```

Verify all `category_l2` values match the taxonomy.

---

## Canonical Reference

- **Pipeline spec:** `docs/RESEARCH/SOURCES/content-pipeline-spec.md` — authoritative source for all pipeline rules
- **Lessons learned:** AR-34 (spec alignment), AR-47 (vocab subcategories), AR-48 (domain normalization)
- **Distribution quotas:** AR-34 section 2.6 — prevents clustering that was found in March 2026 audit (61% of History was battles)

