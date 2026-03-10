---
name: content-autopilot
description: Autonomous end-to-end content factory for Opus workers. Use when you want one skill invocation to audit shortages, generate missing knowledge and language facts, ensure visual descriptions, ingest+dedup, run QA, and promote to facts.db without user-run commands.
---

# content-autopilot

## Mission
Run the full content pipeline autonomously after a single user request. Do not ask the user to run commands manually.

## Non-Negotiable Rules
- Never use paid API scripts from this repository for fact generation.
- Generate missing facts directly with your own Opus reasoning and write JSONL outputs.
- Keep every new fact schema-valid and include a non-empty `visualDescription`.
- Keep source attribution fields when available: `sourceRecordId`, `sourceName`, `sourceUrl`.
- Continue until QA passes and facts are promoted to DB, unless blocked by hard errors.

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

## Fact Schema Minimum (must satisfy)
- `id` string
- `statement` string
- `quizQuestion` string
- `correctAnswer` string
- `variants` array (>= 2)
- `distractors` array (>= 4)
- `visualDescription` non-empty string

Recommended:
- `type`: `fact` or `vocabulary`
- `difficulty`: 1-5
- `funScore`: 1-10
- `ageRating`: `kid|teen|adult`
- `category` includes appropriate domain/language
- `sourceName` and `sourceUrl` when available

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
- strict QA chain
- promotion + DB rebuild

If QA fails, inspect generated reports under `data/generated/qa-reports/` and correct the underlying content before re-running.

## Optional Tightening
Higher coverage targets:
```bash
npm run content:autopilot -- --target-per-domain 3000 --target-per-language 2000 --coverage-knowledge-min 3000 --coverage-language-min 1000
```

Strict hard-fail mode:
```bash
npm run content:autopilot -- --strict true --knowledge-strict-ingest true
```
