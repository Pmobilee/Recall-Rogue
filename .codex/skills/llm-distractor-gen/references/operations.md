# LLM Distractor Gen Operations

## Banned Script Check
```bash
ls scripts/content-pipeline/_DEPRECATED_mine-distractors.mjs
test ! -f scripts/content-pipeline/regen-distractors.mjs
test ! -f scripts/content-pipeline/fix-bad-distractors.mjs
```

## Targeted Runs
```bash
# Distractors only
npm run content:qa:fix:llm:distractors -- \
  --db public/facts.db \
  --model gpt-5.2 \
  --limit 500 \
  --offset 0 \
  --concurrency 6 \
  --fixer gpt-5.2-distractor-gen

# Vague vocab only
node scripts/content-pipeline/qa/llm-fact-quality-fix.mjs vague-vocab \
  --db public/facts.db --model gpt-5.2 --limit 500 --offset 0 --concurrency 6

# Question rewrite only
node scripts/content-pipeline/qa/llm-fact-quality-fix.mjs rewrite-questions \
  --db public/facts.db --model gpt-5.2 --limit 500 --offset 0 --concurrency 6 --min-length 20

# Answer repair only
node scripts/content-pipeline/qa/llm-fact-quality-fix.mjs rewrite-answers \
  --db public/facts.db --model gpt-5.2 --limit 200 --offset 0 --concurrency 4
```

## Verification
```bash
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker gpt-5.2-verify \
  --limit 50000 \
  --report data/generated/qa-reports/answer-check-live-db/check-report-post-fix.json
```

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('public/facts.db');
const noD = db.prepare(\"SELECT COUNT(*) as c FROM facts WHERE distractors IS NULL OR distractors = '[]' OR distractors = ''\").get();
const aiq = db.prepare(\"SELECT COUNT(*) as c FROM facts WHERE LENGTH(correct_answer) >= 5 AND INSTR(LOWER(quiz_question), LOWER(correct_answer)) > 0\").get();
const vague = db.prepare(\"SELECT COUNT(*) as c FROM facts WHERE quiz_question = 'What does this mean?'\").get();
const short = db.prepare(\"SELECT COUNT(*) as c FROM facts WHERE type = 'fact' AND LENGTH(quiz_question) < 20\").get();
console.log('Missing distractors:', noD.c, noD.c === 0 ? 'PASS' : 'FAIL');
console.log('Answer in question:', aiq.c, aiq.c < 10 ? 'PASS' : 'FAIL');
console.log('Vague vocab questions:', vague.c, vague.c === 0 ? 'PASS' : 'FAIL');
console.log('Truncated questions:', short.c, short.c < 5 ? 'PASS' : 'FAIL');
db.close();
"
```
