# AR-216: Korean Vocab — LLM Translation via Sonnet Workers

## Problem

5,665 Korean vocabulary entries from the NIKL dictionary were removed because their `correctAnswer` fields contain verbose English definitions (from a definition dictionary) instead of clean translations. Examples:

- 가수: "person whose job it is to sing" → should be "singer"
- 세계: "All the countries on the earth" → should be "the world"
- 휩쓸리다: "concept" → should be "to be swept away"

These entries are archived in `data/curated/vocab/ko/vocab-ko-all.json` and can be restored once translations are verified.

## Approach: Sonnet Sub-Agent Translation Pipeline

Use Claude Code's Agent tool (`model: "sonnet"`) to translate batches of Korean words. Each agent receives ~100 Korean words with their NIKL definitions and produces clean 1-3 word English translations.

### Why This Works

- Sonnet knows Korean fluently — it can translate 한국어 → English without any dictionary
- The NIKL definition provides CONTEXT so Sonnet picks the right sense (e.g., 배 = boat vs pear vs belly)
- Structured output (JSON) is easy to validate programmatically
- Batches of 100 words fit comfortably in Sonnet's context

### Pipeline Steps

#### Step 1: Prepare Batches

Extract the 5,665 entries from `data/curated/vocab/ko/vocab-ko-all.json` that aren't in TOPIK. For each, prepare:

```json
{
  "id": "ko-nikl-5499",
  "korean": "경유",
  "nikl_definition": "An act of passing through a place to get to a destination",
  "pos": "noun",
  "current_answer": "act visiting"
}
```

Split into batches of 100. That's ~57 batches.

#### Step 2: Sonnet Translation Workers

Each worker gets a prompt like:

```
You are a Korean-English translator. For each Korean word below, provide a clean
1-3 word English translation suitable for a quiz flashcard button on a mobile app.

Rules:
- Maximum 25 characters
- Use the most common/primary meaning
- For verbs: use "to X" format
- For adjectives: use the adjective form (not "state of being X")
- The NIKL definition is provided as CONTEXT — do NOT copy it, translate the Korean word
- If the word has multiple distinct meanings, pick the MOST COMMON one
- Output valid JSON: {"translations": {"ko-nikl-XXXX": "english translation", ...}}

Words to translate:
1. ko-nikl-5499: 경유 (noun) — "An act of passing through a place to get to a destination"
2. ko-nikl-9719: 휩쓸리다 (verb) — "To be completely driven and swept away by water, fire, wind, etc"
3. ko-nikl-7211: 산소 (noun) — "A chemical element that is a colorless, odorless gas"
...
```

#### Step 3: Validate Translations

After each worker returns, validate programmatically:
- Length ≤ 25 chars
- Contains only ASCII/English
- Not empty
- Not a copy of the NIKL definition (length check: must be shorter)
- Not a generic placeholder ("concept", "object", "action")

Any failures get re-queued for a second pass.

#### Step 4: Quality Audit

Take a random 50-card sample from the translated batch and send to a separate Sonnet worker for verification:

```
You are a Korean language expert. For each card, verify the translation is correct.
Rate PASS or FAIL. For FAILs, provide the correct translation.
```

Target: 90%+ pass rate on the audit sample.

#### Step 5: Merge Back

- Apply validated translations to the entries
- Re-run `vocab-to-facts-v2.mjs` to generate seed format
- Merge into `src/data/seed/vocab-ko.json`
- Rebuild DB

### Parallelism Strategy

- **Batch size**: 100 words per agent
- **Total batches**: ~57
- **Parallel workers**: 5-10 at a time (background agents)
- **Estimated time**: ~30 minutes for translation + ~10 minutes for validation
- **Estimated cost**: ~57 Sonnet calls × ~2K tokens each = ~114K tokens

### Risk Mitigation

1. **Hallucination**: Sonnet might invent meanings. Mitigated by providing NIKL definition as context AND post-validation audit.
2. **Ambiguity**: Korean words with multiple meanings (배 = boat/pear/belly). Mitigated by NIKL definition context pointing to the right sense.
3. **Formatting**: Sonnet might not follow JSON format. Mitigated by explicit format instructions + JSON parsing with fallback.
4. **Quality drift**: Later batches might get sloppier. Mitigated by random audit sampling across all batches.

### Implementation

The orchestrator script:

```python
# Pseudocode for the orchestrator
batches = split_into_batches(removed_entries, batch_size=100)

for batch in batches:
    # Launch Sonnet agent with translation prompt
    agent = Agent(model="sonnet", prompt=build_translation_prompt(batch))
    translations = parse_json_response(agent.result)

    # Validate
    valid, invalid = validate_translations(translations)

    # Store valid ones
    store_translations(valid)

    # Re-queue invalid for retry
    retry_queue.extend(invalid)
```

In practice, this would be done via the Claude Code Agent tool in the CLI, launching multiple background agents in parallel.

### Files

| File | Action |
|------|--------|
| `data/curated/vocab/ko/vocab-ko-removed.json` | NEW — the 5,665 removed entries for processing |
| `scripts/content-pipeline/vocab/korean-llm-translate.py` | NEW — orchestrator that prepares batches |
| `src/data/seed/vocab-ko.json` | MODIFIED — merged with translated entries |

### Success Criteria

- 5,665 entries translated with clean 1-3 word English answers
- 90%+ pass rate on random 50-card Sonnet audit
- All answers ≤ 25 characters
- No placeholder/fragment answers
- Korean vocab total restored to ~9,275 (3,610 TOPIK + 5,665 LLM-translated)
