---
name: answer-checking
description: Live DB-first answer checking and fixing via directly spawned subscription workers (no API scripts). Writes/checks flags in the database and supports tagged-fact fix loops that clear flags when fixed.
---

# answer-checking

## Mission
Run answer checks and fixes directly on the live facts database (not file-only artifacts), using directly spawned Codex/Claude subscription workers.

## Non-Negotiable Rule
- NEVER use any external model gateway or API script.
- NEVER use SDK-based direct model API calls.
- ALWAYS spawn workers directly from subscription models (Codex/Claude worker execution).
- If running under Anthropic/Claude subscriptions, ALWAYS use Haiku workers by default (cheap tier).

## Live DB Rule
- Default live DB path: `public/facts.db`
- Alternate server DB path (if needed): `server/data/facts.db`
- This skill writes flags directly into DB columns on `facts`:
  - `answer_check_issue`
  - `answer_check_needs_fix`
  - `answer_check_checked_at`
  - `answer_check_checked_by`
  - `answer_check_fixed_at`
  - `answer_check_fixed_by`

## End-to-End Worker Flow (DB-native)

### 1) Check 500 facts directly in live DB
```bash
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker gpt-5.1-mini \
  --status approved \
  --limit 500
```

### 2) Export currently flagged DB rows for fix workers
```bash
npm run content:qa:answer-check:db -- export-flagged \
  --db public/facts.db \
  --status approved \
  --limit 500 \
  --output data/generated/qa-reports/answer-check-live-db/flagged.jsonl
```

### 3) Spawn workers to fix flagged rows
- Workers read `flagged.jsonl`
- Workers produce `reviewed/flagged-fixed.jsonl`
- Each row should include corrected fields and `answerCheckIssue`:
  - keep non-empty if still broken
  - set empty string when fixed

### 4) Apply fixes back into live DB and clear flags when fixed
```bash
npm run content:qa:answer-check:db -- apply-fixes \
  --db public/facts.db \
  --input data/generated/qa-reports/answer-check-live-db/reviewed/flagged-fixed.jsonl \
  --fixer haiku-1
```

## Tagged Fact Variants
Use `--tags` and `--tag-mode` with `check` or `export-flagged`.

Example:
```bash
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker haiku-1 \
  --tags needs_fix,biology \
  --tag-mode any \
  --limit 500
```

## Notes
- `check` updates DB flags immediately.
- `export-flagged` reads DB flags and creates worker-fix payloads.
- `apply-fixes` writes corrections to DB and clears `answer_check_issue`/`answer_check_needs_fix` when fixed.
