# Worker Task: spark

Model target: gpt-5-spark (subscription worker)
Execution mode: direct subscription worker only (NO API calls).

## Hard Rules
- Do NOT use any external model gateway or paid API from scripts.
- Do NOT use SDK-based direct model API calls.
- Use only direct Codex/Claude subscription worker execution.
- For every row, keep all existing fields unchanged except the issue column.
- Write issues into `answerCheckIssue` and leave it as empty string when valid.

## Input
- Assignment JSONL: `data/generated/qa-reports/answer-check/assignments/spark.jsonl`

## Validation Target
- Check whether `correctAnswer` directly and sensibly answers `quizQuestion`.
- If invalid, write a short issue reason (<= 14 words).
- If valid, write empty string.

## Output
- Reviewed JSONL: `data/generated/qa-reports/answer-check/reviewed/spark.jsonl`
- Must contain the same number of rows as input.
- Must preserve row order and IDs.

