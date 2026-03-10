# Claude Worker Task: geography

## Goal
Generate up to 0 new fact rows for `geography` using your Claude subscription worker.

## Inputs/Outputs
- Input source file: `data/raw/mixed/geography.json`
- Output JSONL file: `data/generated/worker-output/geography.jsonl`
- Existing generated facts: 50
- Target facts for domain: 50
- Missing facts to fill: 0

## Hard Rules
- Do NOT call any paid API scripts from this repository.
- Use Claude worker reasoning and write JSONL output directly.
- One JSON object per line, UTF-8, no markdown fences.
- Keep all source attribution fields when available: sourceRecordId, sourceName, sourceUrl.
- Keep category aligned to domain key (array or string including the domain).

## Fact Schema Minimum
- id (string)
- statement (string)
- quizQuestion (string)
- correctAnswer (string)
- variants (array, at least 2)
- distractors (array, at least 4)

## Local Validation (optional before handoff)
node scripts/content-pipeline/manual-ingest/run.mjs validate --input data/generated/worker-output/geography.jsonl --domain geography

## Completion
When done, ensure `data/generated/worker-output/geography.jsonl` exists and contains only valid JSONL facts.

