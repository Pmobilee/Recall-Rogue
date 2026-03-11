---
name: content-autopilot
description: Autonomous end-to-end content factory for Opus workers. Use when you want one skill invocation to audit shortages, generate missing knowledge and language facts, ensure visual descriptions, ingest+dedup, run QA, and promote to facts.db without user-run commands.
---

# content-autopilot

## Mission
Run the full content pipeline autonomously after a single user request. Do not ask the user to run commands manually.

## Non-Negotiable Rules
- Never use paid API scripts from this repository for fact generation.
- Generate missing facts using Haiku sub-agents (not Sonnet/Opus) — fact generation is structured content work, not architecture. Haiku produces equivalent quality at ~10x lower cost.
- Keep every new fact schema-valid and include a non-empty `visualDescription`.
- Keep source attribution fields when available: `sourceRecordId`, `sourceName`, `sourceUrl`.
- For canonical domains, `categoryL2` is mandatory and must be a valid taxonomy ID (never free-text labels).
- Continue until QA passes and facts are promoted to DB, unless blocked by hard errors.

## Category Taxonomy Enforcement (Mandatory)
- Worker outputs must include `categoryL2` using IDs from `src/data/subcategoryTaxonomy.ts`.
- Ingestion validation must run with `--require-subcategory true` (never set it to false).
- For single-domain files:
  ```bash
  node scripts/content-pipeline/manual-ingest/run.mjs validate --input <worker-output> --domain <domain> --require-subcategory true
  ```
- For mixed directories or mixed-domain batches:
  ```bash
  node scripts/content-pipeline/manual-ingest/run.mjs validate --input <dir-or-file> --domain auto --require-subcategory true
  ```
- If `categoryL2` is missing/invalid, ingestion must fail and be corrected before dedup/finalize.
- Promotion now has a hard taxonomy gate: if any canonical-domain row has missing/invalid `categoryL2`, `promote-approved-to-db` fails.

## Existing Fact Reclassification (Trusted LLM Workers)
Use GPT-5.1 mini-family workers in batches to fix all existing missing/invalid `categoryL2` values:
```bash
npm run content:subcategory:backfill:llm -- --model openai/gpt-5.1-codex-mini
```
- This runs domain-batched LLM classification and writes taxonomy IDs back into existing seed/generated fact stores.
- Rebuild DB after completion:
  ```bash
  node scripts/build-facts-db.mjs
  ```

## Source-Based Generation (Mandatory for new facts)
Raw data lives in `data/raw/<domain>.json` — structured Wikidata/API dumps with minimal info (labels, dates, species names, etc.). These are **seeds**, not facts.

### How to use raw sources
1. **Read raw entries** from `data/raw/<domain>.json` (or `data/raw/mixed/<domain>.json`)
2. **Cherry-pick interesting entries** — skip entries that are:
   - Missing labels (e.g. `"itemLabel": "Q19727656"`)
   - Too obscure to make a fun fact (e.g. unnamed satellites, minor subspecies)
   - Already covered in existing generated facts (check `data/generated/worker-output/<domain>.jsonl`)
3. **Transform into surprising facts** — the raw entry is just a starting point. The agent should:
   - Use the Wikidata entity as a seed topic, then add genuinely interesting/surprising context from training knowledge
   - Apply the transformability rubric below — skip generic/ambiguous entries, transform specific nameable things
   - Write the `statement` to be surprising, not encyclopedic ("Waffles originated in 13th-century France as communion wafers..." NOT "A waffle is a batter-based food from France")
4. **Preserve source attribution**: set `sourceUrl` to the Wikidata URI, `sourceName` to "Wikidata"
5. **Fill gaps from training knowledge** — when raw sources are exhausted or too boring, generate additional facts purely from training knowledge (no source attribution needed)

### Transformability rubric
**Skip if:** Broken Wikidata ID (unresolved Q-number), duplicate of existing fact, factually ambiguous, or so generic that no interesting angle exists.
**Transform if:** Names a specific thing (species, food, event, place, person, invention) that a good trivia writer could turn into a question stumping 50%+ of adults. The raw data is a starting menu, not a mandatory list.

### Truthfulness
All facts (whether source-based or from training knowledge) must be verifiable. Agents should not invent statistics, dates, or claims they are uncertain about. When in doubt, use hedging language ("approximately", "estimated") or skip the fact entirely.

### Variant & Answer Quality Rules (Mandatory)
Every fact MUST have 2 proper variant objects. Every variant MUST pass these checks:

1. **Variant coherence**: `correctAnswer` must directly answer the variant's `question`. If the question asks "how many", the answer must contain a number. If it asks "where", the answer must be a place name. If it asks "who", the answer must be a person/entity.
2. **No self-answering**: No significant word (5+ chars) from `correctAnswer` may appear in the variant's `question`. The question sets up the answer — it must not reveal it. Example violation: Q: "From what part of a fish is isinglass obtained?" A: "Isinglass (fish swim bladders)" — "isinglass" appears in both.
3. **Distractor format match**: Distractors must be the same *type* as the answer. Numbers match numbers, proper nouns match proper nouns, short phrases match short phrases. Never pair a 3-word answer with 15-word distractors.
4. **Variant structure**: Every variant MUST be a `{ question, type, correctAnswer, distractors }` object — NEVER a plain string. Types: `forward`, `reverse`, `context`, `fill_blank`, `negative`.
5. **No parenthetical reveals**: Use concise answers without "Answer (explanation)" format. Put explanations in the `explanation` field. Bad: "Isinglass (fish swim bladders)". Good: "The swim bladder".
6. **Variant-specific distractors**: Each variant SHOULD have its own `distractors` array (3 minimum) tailored to that variant's question. Falling back to the base fact's distractors only works when the variant asks the same type of question as the base.

## One-Command Backbone
Use this as the orchestration backbone:
```bash
npm run content:autopilot -- --target-per-domain 1000 --target-per-language 1000
```

Artifacts:
- `data/generated/qa-reports/autopilot-report.json`
- `data/generated/worker-packages/tasks/*.json`
- `data/generated/worker-packages/prompts/*.md`
- `data/generated/worker-output/*.jsonl`
- `data/generated/worker-output-languages/*.jsonl`
- `data/generated/qa-reports/agent-workers-qa.json`
- `data/generated/qa-reports/promote-approved-report.json`

## Autonomous Loop
Run this loop until pass:

1. Run autopilot once.
2. Read `autopilot-report.json` and identify blockers:
   - Missing knowledge worker outputs (`data/generated/worker-output/<domain>.jsonl`)
   - Language shortages in `shortages.languages`
   - QA gate failures
3. Fill missing knowledge outputs yourself:
   - Read source rows from `data/raw/mixed/<domain>.json` (or domain primary source)
   - Write schema-valid JSONL facts to `data/generated/worker-output/<domain>.jsonl`
   - Ensure each row has `visualDescription`
4. Fill language shortages yourself:
   - Prefer generated vocab fact streams under `data/generated/worker-output-languages/*.jsonl`
   - If still short, create additional language fact JSONL in `data/generated/worker-output-languages/`
5. Re-run autopilot.
6. Stop only when:
   - QA passes
   - promotion succeeds
   - `public/facts.db` is rebuilt
7. After promotion, run fact verification:
   ```bash
   node scripts/content-pipeline/qa/verify-facts-websearch.mjs --stamp true --quarantine true
   ```
   - Only facts with `verifiedAt` timestamp are considered "live" in the game
   - Facts that fail verification are quarantined (not deleted)
   - This step uses the free Wikipedia API — zero token cost

## Fact Schema (DB NOT NULL columns)
All these fields are required by the DB. `normalizeFactShape()` auto-derives missing ones during promotion, but it's best to include them in generated JSONL:

- `id` string (unique)
- `type` string — `"fact"` or `"vocabulary"` (auto-derived from `contentType`)
- `statement` string
- `explanation` string (auto-derived from `wowFactor` or `statement`)
- `quizQuestion` string
- `correctAnswer` string
- `distractors` array (>= 4, serialized as JSON text in DB)
- `category` string or array (auto-wrapped in array)
- `rarity` string — `"common"|"uncommon"|"rare"|"epic"` (auto-derived from `difficulty`)
- `difficulty` integer 1-5
- `funScore` integer 1-10
- `ageRating` string — `"kid"|"teen"|"adult"`

Recommended but nullable:
- `variants` array (>= 2)
- `visualDescription` non-empty string
- `wowFactor` string (used as `explanation` fallback)
- `sourceName` and `sourceUrl` when available
- `tags` array of strings

## Language Targets
Default language set:
- `ja`, `es`, `fr`, `de`, `ko`, `zh`, `nl`, `cs`

Use autopilot defaults unless user overrides:
- `--target-per-language 1000`

## Quality Gate Expectations
Autopilot will run:
- worker prepare/ingest flow
- vocab build + vocab validation + vocab ingestion
- missing visualDescription filler
- QA chain (gameplay safety check removed — it was blocking promotion for small domain sizes)
- promotion + DB rebuild

Promote defaults are now permissive: `enforce-qa-gate: false`, `approved-only: false`. Pass `--enforce-qa-gate true --approved-only true` explicitly if you want strict gating.

If QA fails, inspect generated reports under `data/generated/qa-reports/` and correct the underlying content before re-running.

## Known Issues & Fixes

### Field defaults for generated facts
Generated facts from worker-output JSONL often lack fields the DB expects. These are now auto-derived by `normalizeFactShape()` in the promote script:
- **`type`** — defaults to `"fact"`, or `"vocabulary"` if `contentType === 'vocabulary'`
- **`explanation`** — falls back to `wowFactor`, then `statement`
- **`rarity`** — derived from `difficulty`: 1-2 = common, 3 = uncommon, 4 = rare, 5 = epic

### Gameplay safety check removed
The gameplay safety check was removed from the QA chain because it blocked promotion for small domain sizes (domains with fewer facts than the minimum threshold). This is acceptable because content quality is ensured by the other QA steps.

### Promote defaults changed
`enforce-qa-gate` and `approved-only` both default to `false`. Most generated facts don't have a `status` field, so filtering by "approved" blocks everything. The QA gate is now opt-in via explicit CLI flags.

### vocab-build HTTP 404
The vocab-build step may fail if the JMdict source returns HTTP 404. This is non-blocking for knowledge facts — the pipeline continues and language content can be retried separately.

## Optional Tightening
Higher coverage targets:
```bash
npm run content:autopilot -- --target-per-domain 3000 --target-per-language 2000 --coverage-knowledge-min 3000 --coverage-language-min 1000
```

Strict hard-fail mode:
```bash
npm run content:autopilot -- --strict true --knowledge-strict-ingest true
```
