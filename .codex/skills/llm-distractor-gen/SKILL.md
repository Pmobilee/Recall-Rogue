---
name: llm-distractor-gen
description: Generate and apply GPT-5.2 distractors and question rewrites for Recall Rogue facts in `public/facts.db`. Use when facts are flagged for missing/bad distractors, answer leakage in questions, vague vocabulary prompts, or malformed/truncated quiz text, and distractors must come from per-fact LLM reasoning (never DB answer pools).
---

# LLM Distractor Gen

## Workflow
1. Delete banned pool-based scripts if they still exist.
2. Run a full pre-check to mark `answer_check_*` fields.
3. Run GPT-5.2 fixes in this order:
   1. `vague-vocab`
   2. `distractors`
   3. `rewrite-questions`
   4. `rewrite-answers`
4. Re-run full check.
5. Run preview sampling.
6. Rebuild DB.

## Commands
Use `scripts/content-pipeline/qa/llm-fact-quality-fix.mjs`.

```bash
# Pre-check
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker gpt-5.2-quality-audit \
  --limit 50000

# Full iterative fix
npm run content:qa:fix:llm -- \
  --db public/facts.db \
  --model gpt-5.2 \
  --concurrency 6 \
  --limit 50000 \
  --max-passes 4 \
  --fixer gpt-5.2-fix-1

# Post-check
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker gpt-5.2-verify \
  --limit 50000
```

## Guardrails
- Generate distractors only from per-fact GPT-5.2 prompts.
- Never query DB answer pools to synthesize distractors.
- Validate distractors with `scripts/content-pipeline/qa/shared.mjs` blocklists.
- Keep structural fields unchanged: `id`, `type`, `language`, `category_l1`, `category_l2`.
- Only change `correct_answer` when empty/truncated and repair is required.

## Reference
Use [operations.md](references/operations.md) for command-level runbook and verification SQL.
