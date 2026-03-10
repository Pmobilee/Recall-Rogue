# Claude Worker Task: general_knowledge

## Goal
Generate up to 0 new fact rows for `general_knowledge` using your Claude subscription worker.

## Inputs/Outputs
- Input source file: `data/raw/mixed/general_knowledge.json`
- Output JSONL file: `data/generated/worker-output/general_knowledge.jsonl`
- Existing generated facts: 140
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
node scripts/content-pipeline/manual-ingest/run.mjs validate --input data/generated/worker-output/general_knowledge.jsonl --domain general_knowledge

## Completion
When done, ensure `data/generated/worker-output/general_knowledge.jsonl` exists and contains only valid JSONL facts.

