# AR-19: Bulk Generation & QA

Execute the full content generation pipeline: generate 10K+ facts per knowledge domain and 5K+ per language, run QA, populate production database.

## Overview

### Goal
Execute a comprehensive, end-to-end content generation campaign to populate the game with 100K+ knowledge facts across 10 domains and 30K+ vocabulary facts across 6 languages. Includes QA gates, duplicate detection, cross-domain analysis, human review, visual description generation, and database migration to production.

### Dependencies
All of the following MUST be complete before starting this phase:
- **AR-15** (Source Data & Registry) — fetch scripts must produce validated source JSON files
- **AR-16** (Domain Code) — domain definitions must be finalized
- **AR-17** (Haiku Fact Engine) — batch generation, validation, and cost estimation scripts must work
- **AR-18** (Vocabulary Expansion) — all vocabulary imports and conversions must complete
- **AR-11 Part C** (Visual Description Pipeline) — if visual generation is included in final steps

### Estimated Complexity
**Large** — Primarily execution-heavy (running existing scripts), but with significant QA and analysis work. Estimated timeline: 3-4 weeks including API execution, validation, human review, and database migration.

### Requirements & Constraints
- **Anthropic API Access**: Claude Haiku (`claude-haiku-4-5-20251001`) with sufficient quota
- **Estimated API Cost**: ~$180-220 for generating 130K facts total
- **Time Budget**: ~50-60 hours of API execution (spread across multiple days or parallelized per domain)
- **Human Review**: Plan for 1-2 people to review 50 sample facts per domain (500 facts total), approximately 10-20 hours
- **Disk Space**: ~2GB for intermediate generated files, temporary storage of source data
- **Quality Standards**:
  - <5% validation error rate per domain
  - All 5 difficulty levels represented in each domain
  - No factual errors in human-reviewed samples
  - >90% of facts have visual descriptions
- **Database Performance**: Production database must load facts in <3 seconds (cold start)

---

## Sub-steps

### 1. Pre-Generation Audit

**Objective**: Verify all upstream dependencies are ready before committing to expensive API calls.

**Verification Checklist**:

1. **Fetch Scripts Validation** (AR-15 outputs):
   ```bash
   # Test each domain's fetch script with --limit 10
   for domain in general-knowledge natural-sciences space-astronomy geography history mythology-folklore animals-wildlife human-body-health food-cuisine art-architecture; do
     echo "Testing $domain..."
     node scripts/content-pipeline/fetch/${domain}.mjs --limit 10 --output /tmp/test-${domain}.json
     if [ -f /tmp/test-${domain}.json ]; then
       echo "✓ $domain output valid"
       wc -l /tmp/test-${domain}.json
     else
       echo "✗ $domain FAILED"
       exit 1
     fi
   done
   ```
   - Verify: Each domain produces valid JSON (not empty, parseable)
   - Verify: Output files > 1KB (non-trivial data)
   - Verify: No auth errors (API keys configured correctly)

2. **Haiku Engine Test** (AR-17 components):
   ```bash
   # Sample generation for each domain
   for domain in general-knowledge natural-sciences space-astronomy geography history mythology-folklore animals-wildlife human-body-health food-cuisine art-architecture; do
     echo "Sampling $domain..."
     node scripts/content-pipeline/generate/sample.mjs --domain $domain --count 5 --output /tmp/sample-${domain}.json
     node scripts/content-pipeline/generate/validate-output.mjs --input /tmp/sample-${domain}.json --schema-only
     if [ $? -eq 0 ]; then
       echo "✓ $domain samples valid"
     else
       echo "✗ $domain samples FAILED"
       exit 1
     fi
   done
   ```
   - Verify: Haiku client connects to API successfully
   - Verify: Samples generate valid JSON with correct schema
   - Verify: No rate-limit or authentication errors
   - Verify: API key has sufficient credits

3. **Vocabulary Import Status** (AR-18 outputs):
   ```bash
   # Check all vocabulary files exist and are non-empty
   for lang in ja es fr de ko zh; do
     if [ -f src/data/seed/vocab-${lang}.json ]; then
       count=$(cat src/data/seed/vocab-${lang}.json | jq 'length')
       echo "✓ vocab-${lang}: $count entries"
     else
       echo "✗ vocab-${lang} NOT FOUND"
       exit 1
     fi
   done
   ```
   - Verify: All 6 language vocabulary files exist
   - Verify: Each file contains 5K+ entries
   - Verify: Files are valid JSON

4. **Cost Estimation**:
   ```bash
   # Estimate total cost for all domains + vocabulary
   total_cost=0
   for domain in general-knowledge natural-sciences space-astronomy geography history mythology-folklore animals-wildlife human-body-health food-cuisine art-architecture; do
     cost=$(node scripts/content-pipeline/generate/estimate-cost.mjs --input data/raw/${domain}.json --domain ${domain} | grep "Total cost:" | awk '{print $NF}')
     echo "$domain: $cost"
     total_cost=$(echo "$total_cost + $cost" | bc)
   done

   # Add vocabulary generation cost (~$50 for 30K words)
   vocab_cost=50
   total_cost=$(echo "$total_cost + $vocab_cost" | bc)

   echo "TOTAL ESTIMATED COST: \$$total_cost"
   ```
   - Verify: Total cost is within budget (< $220)
   - Verify: API account has sufficient credits
   - Record estimate for accountability

5. **Directory & File Structure**:
   ```bash
   # Create required directories
   mkdir -p data/raw data/generated data/generated/qa-reports
   mkdir -p samples/human-review

   # Verify fetch output directories exist
   for domain in general-knowledge natural-sciences space-astronomy geography history mythology-folklore animals-wildlife human-body-health food-cuisine art-architecture; do
     [ -f data/raw/${domain}.json ] && echo "✓ data/raw/${domain}.json found" || echo "✗ MISSING"
   done
   ```
   - Verify: All source JSON files exist in `data/raw/`
   - Verify: Output directories are writable

6. **Environment Configuration**:
   ```bash
   # Verify required environment variables
   [ -z "$ANTHROPIC_API_KEY" ] && echo "ERROR: ANTHROPIC_API_KEY not set" && exit 1
   echo "✓ ANTHROPIC_API_KEY configured"

   # Optional: test API key is valid
   node -e "const sdk = require('@anthropic-ai/sdk'); new sdk.default({apiKey: process.env.ANTHROPIC_API_KEY}).messages.countTokens({messages: [{role: 'user', content: 'test'}], model: 'claude-haiku-4-5-20251001'}).then(() => console.log('✓ API key valid')).catch(e => { console.error('✗ API key error:', e.message); process.exit(1); })"
   ```
   - Verify: API key is set and valid
   - Verify: Haiku model is accessible

**Go/No-Go Decision**:
- If all checks pass: Proceed to step 2
- If any check fails: Fix upstream issues before continuing
- Document audit timestamp and results in `data/generated/qa-reports/pre-audit-${date}.json`

---

### 2. Batch Generation — Knowledge Domains

**Objective**: Execute the Haiku fact engine for all 10 knowledge domains, generating 10K+ facts per domain.

**Execution Strategy**:

**Sequential Batch Runs** (recommended to avoid overwhelming API quota):

```bash
#!/bin/bash
# scripts/generate-all-domains.sh

domains=(
  "general-knowledge"
  "natural-sciences"
  "space-astronomy"
  "geography"
  "history"
  "mythology-folklore"
  "animals-wildlife"
  "human-body-health"
  "food-cuisine"
  "art-architecture"
)

total_cost=0
for domain in "${domains[@]}"; do
  echo "=========================================="
  echo "Generating $domain..."
  echo "=========================================="

  # Estimate cost first
  cost_est=$(node scripts/content-pipeline/generate/estimate-cost.mjs \
    --input data/raw/${domain}.json \
    --domain ${domain} | grep "Total cost:" | awk '{print $NF}')
  echo "Estimated cost for $domain: $cost_est"

  # Run batch generation
  time node scripts/content-pipeline/generate/batch-generate.mjs \
    --input data/raw/${domain}.json \
    --domain ${domain} \
    --output data/generated/${domain}.jsonl \
    --concurrency 5 \
    --batch-size 100

  if [ $? -ne 0 ]; then
    echo "ERROR: Generation failed for $domain"
    exit 1
  fi

  echo "✓ Completed $domain"
  sleep 10  # Brief pause between domains to allow rate-limit recovery
done

echo "=========================================="
echo "All domains complete!"
echo "=========================================="
```

**For Each Domain**:

1. **Verify Input**:
   ```bash
   wc -l data/raw/${domain}.json
   jq 'length' data/raw/${domain}.json
   ```
   - Confirm: non-empty source file with expected record count

2. **Run Batch Generation**:
   ```bash
   node scripts/content-pipeline/generate/batch-generate.mjs \
     --input data/raw/${domain}.json \
     --domain ${domain} \
     --output data/generated/${domain}.jsonl \
     --concurrency 5 \
     --batch-size 100
   ```
   - Monitor: progress output, cost tracking, error logs
   - Expected time per domain: 2-4 hours (depends on record count and API latency)
   - Expected error rate: <5%

3. **Check Output**:
   ```bash
   wc -l data/generated/${domain}.jsonl
   head -1 data/generated/${domain}.jsonl | jq .  # Verify valid JSON
   tail -1 data/generated/${domain}.jsonl | jq .  # Verify valid JSON
   ```
   - Verify: JSONL file has expected line count (≈ number of input records × success rate)
   - Verify: First and last lines are valid JSON

4. **Check Error Report**:
   ```bash
   if [ -f data/generated/errors-${domain}-*.json ]; then
     cat data/generated/errors-${domain}-*.json | jq '.[] | .error' | sort | uniq -c
     echo "Review errors and note any patterns"
   fi
   ```
   - Analyze error patterns
   - Determine if re-run needed for specific records

**Parallel Execution** (if you have multiple API keys or high rate limits):

- Run 2-3 domains in parallel to speed up total execution time
- Use separate terminals or background processes
- Monitor total token usage to avoid exceeding rate limits
- Example: domain 1 & domain 2 & domain 3, wait for all to complete, then domain 4 & 5 & 6, etc.

**Cost Tracking**:
- Capture total tokens and cost from each batch run's summary output
- Log to spreadsheet: domain, input tokens, output tokens, cost, time elapsed
- Calculate running total
- Compare against pre-generation estimate

**Checkpoint Saves**:
- After each domain completes, commit progress to git
- Log: `data/generated/generation-log.json` with per-domain status
- If process is interrupted, use `--resume` flag to continue from last successful record

---

### 3. Batch Validation

**Objective**: Validate all generated knowledge domain files against schema and quality standards.

**Validation Script Execution**:

```bash
#!/bin/bash
# scripts/validate-all-domains.sh

domains=(
  "general-knowledge"
  "natural-sciences"
  "space-astronomy"
  "geography"
  "history"
  "mythology-folklore"
  "animals-wildlife"
  "human-body-health"
  "food-cuisine"
  "art-architecture"
)

echo "Starting validation across all domains..."
echo "" > data/generated/qa-reports/validation-summary.txt

for domain in "${domains[@]}"; do
  echo "Validating $domain..."

  node scripts/content-pipeline/generate/validate-output.mjs \
    --input data/generated/${domain}.jsonl \
    --output data/generated/qa-reports/validation-${domain}.json

  if [ $? -eq 0 ]; then
    echo "✓ $domain validation passed"
    # Extract summary
    cat data/generated/qa-reports/validation-${domain}.json | jq '.summary' >> data/generated/qa-reports/validation-summary.txt
  else
    echo "✗ $domain validation FAILED - review report"
    cat data/generated/qa-reports/validation-${domain}.json | jq '.summary'
    exit 1
  fi
done

echo ""
echo "Validation Summary:"
cat data/generated/qa-reports/validation-summary.txt
```

**Review Per Domain**:

1. **Check Report** (`data/generated/qa-reports/validation-${domain}.json`):
   ```bash
   cat data/generated/qa-reports/validation-${domain}.json | jq '{
     totalRecords: .summary.totalRecords,
     validRecords: .summary.validRecords,
     errors: .summary.recordsWithErrors,
     errorRate: (.summary.recordsWithErrors / .summary.totalRecords * 100)
   }'
   ```

2. **Error Analysis**:
   - If error rate > 5%:
     - Review 10 sample errors: `jq '.schemaValidation.details[0:10]' validation-${domain}.json`
     - Determine root cause: is it prompt issue, API issue, or validation issue?
     - Consider re-running domain with adjusted prompt or larger sample size for spot-checking

3. **Quality Metrics Review**:
   ```bash
   cat data/generated/qa-reports/validation-${domain}.json | jq '.qualityMetrics'
   ```
   - Check difficulty distribution: all 5 levels represented?
   - Check funScore mean: target 6+
   - Check distractor count: all entries have 8-25 distractors?
   - Flag warnings/recommendations

**Aggregate Report**:

```bash
# Generate cross-domain validation summary
node scripts/content-pipeline/qa/generate-validation-summary.mjs \
  --reports data/generated/qa-reports/validation-*.json \
  --output data/generated/qa-reports/validation-aggregate.json
```

**Go/No-Go Decision Per Domain**:
- Error rate < 5%: Proceed to QA step
- Error rate 5-10%: Acceptable if errors are non-critical (e.g., missing optional visual descriptions)
- Error rate > 10%: Flag for re-generation or manual fix-up

---

### 4. Duplicate Detection Across Domains

**File(s)**: `scripts/content-pipeline/qa/cross-domain-dedup.mjs`

**Objective**: Identify facts that appear in multiple domains (likely from overlapping sources), flag for human review, and deduplicate.

**Implementation Requirements**:

```javascript
/**
 * Detect duplicate facts across multiple JSONL files
 * @param {string[]} inputFiles - Array of JSONL file paths
 * @param {Object} options - Configuration
 * @param {string} options.outputFile - JSON report of duplicates
 * @param {number} options.similarityThreshold - Fuzzy match threshold (0.85-1.0)
 * @returns {Promise<Object>} { totalFacts, duplicateGroupsFound, outputFile }
 */
async function detectDuplicates(inputFiles, options)
```

**Algorithm**:

1. **Load All Facts**:
   - Read all JSONL files into memory (index by domain)
   - Total: 100K+ facts
   - Index by quiz question text for fast lookup

2. **Fuzzy Matching**:
   - For each fact, compute hash/signature of quiz question (lowercase, trim whitespace)
   - Find exact matches (same domain = expected, other domains = potential duplicate)
   - For potential cross-domain matches, compute Levenshtein distance (or similar string distance)
   - Flag pairs with similarity > 0.85 as suspected duplicates

3. **Output Report**:

```json
{
  "timestamp": "2026-03-09T14:30:00Z",
  "totalFacts": 103421,
  "suspectedDuplicates": [
    {
      "domain1": "geography",
      "id1": "paris-capital-france",
      "question1": "What is the capital of France?",
      "domain2": "general-knowledge",
      "id2": "gk-france-capital",
      "question2": "The capital of France is which city?",
      "similarity": 0.95,
      "recommendation": "Keep geography version (better distractors), archive general-knowledge version"
    },
    ...
  ],
  "duplicateGroupCount": 47,
  "totalFactsInGroups": 94,
  "archiveCount": 47
}
```

4. **Decision Rules**:
   - Keep version with:
     - Better distractor quality (more varied)
     - Higher funScore
     - Better visual description
     - From more authoritative source (prefer specific domain over general-knowledge)
   - Archive other versions by moving to separate "archived-duplicates.jsonl"

**Execution**:

```bash
node scripts/content-pipeline/qa/cross-domain-dedup.mjs \
  --input data/generated/*.jsonl \
  --output data/generated/qa-reports/dedup-report.json \
  --similarity-threshold 0.85
```

**Manual Review** (if needed):

- If > 100 duplicate pairs found, review high-similarity pairs (0.95+)
- Decide: keep or archive for each suspicious pair
- Update report with final decisions

---

### 5. Domain Coverage Analysis

**File(s)**: `scripts/content-pipeline/qa/coverage-report.mjs`

**Objective**: Analyze coverage and balance across all 10 knowledge domains.

**Implementation Requirements**:

```javascript
/**
 * Generate comprehensive coverage report for all domains
 * @param {string[]} inputFiles - Array of JSONL files
 * @param {Object} options - Configuration
 * @param {string} options.outputFile - JSON report
 * @param {string} options.textReport - Human-readable text report (optional)
 * @returns {Promise<Object>} Summary statistics and recommendations
 */
async function generateCoverageReport(inputFiles, options)
```

**Report Contents**:

For each domain:
1. **Fact Count**: Total valid facts
2. **Difficulty Distribution** (histogram):
   ```
   Difficulty 1:  2104 (20%)
   Difficulty 2:  2089 (20%)
   Difficulty 3:  2084 (20%)
   Difficulty 4:  2072 (20%)
   Difficulty 5:  2072 (20%)
   ```
3. **Fun Score Distribution**:
   - Mean, std dev, min, max
   - Target: mean 6+, std dev 1-2 (reasonable spread)

4. **Age Rating Distribution**:
   ```
   kid:   3000 (28%)
   teen:  5200 (50%)
   adult: 2221 (22%)
   ```

5. **Distractor Metrics**:
   - Average distractor count per fact
   - Min/max range
   - Check: no distractors < 8 or > 25

6. **Visual Description Coverage**:
   - % of facts with non-null, non-empty visual descriptions
   - Target: > 90%

7. **Source Attribution**:
   - Which sources contributed to this domain
   - Total unique sources

**Aggregate Metrics**:

```
============================================
CONTENT COVERAGE REPORT - All Domains
============================================
Total Facts:        103,421
Valid Facts:        103,203 (99.8%)
Failed Facts:            218 (0.2%)

Difficulty Distribution:
  Level 1 (Trivial):       20,412 (19.8%)
  Level 2 (Easy):          20,814 (20.2%)
  Level 3 (Medium):        20,682 (20.1%)
  Level 4 (Hard):          21,064 (20.4%)
  Level 5 (Expert):        20,231 (19.6%)

Domain Balance:
  All domains within 5% of target 10,000 facts ✓
  All domains have representation across all 5 levels ✓
  Average funScore: 6.2 (target: 6+) ✓

Visual Description Coverage:
  Complete:       93,421 (90.4%)
  Missing:        9,782 (9.6%) — remediate in AR-11 Part C

Recommendations:
  [ ] Re-generate facts with difficulty 5 (currently below target)
  [ ] Increase average fun score in space-astronomy (currently 5.8)
  [ ] Priority: Generate missing visual descriptions for 9,782 facts
```

**Execution**:

```bash
node scripts/content-pipeline/qa/coverage-report.mjs \
  --input data/generated/*.jsonl \
  --output data/generated/qa-reports/coverage-report.json \
  --text-report data/generated/qa-reports/coverage-report.txt
```

**Gate Criteria**:
- Proceed to human review only if:
  - All domains have 8K+ facts (minimum viable)
  - All difficulty levels 1-5 represented in each domain
  - Average funScore > 5.5
  - Error rate < 5% per domain

---

### 6. Human Review Sampling

**File(s)**: `scripts/content-pipeline/qa/review-sample.mjs`

**Objective**: Select 50 representative facts from each domain for human expert review (fact-checking, quality assessment).

**Implementation Requirements**:

```javascript
/**
 * Generate human-readable review samples from generated facts
 * @param {string} inputFile - JSONL file to sample from
 * @param {Object} options - Configuration
 * @param {number} options.sampleSize - Facts per sample (default: 50)
 * @param {string} options.outputFile - Markdown file with formatted samples
 * @param {string} options.selectionStrategy - 'random' | 'stratified' (default: stratified)
 * @returns {Promise<Object>} { sampleSize, outputFile, reviewChecklistUrl }
 */
async function generateReviewSample(inputFile, options)
```

**Sampling Strategy**:

1. **Stratified Sampling**:
   - Divide facts into 5 buckets by difficulty
   - Divide each bucket into 10 sub-buckets by funScore
   - Select 1 fact from each bucket, rotated across all sub-buckets
   - Result: representative sample with diverse difficulty and fun scores

2. **Output Format** (Markdown for easy reading and sharing):

```markdown
# Domain: Geography
## Sample Review (50 facts)

Generated: 2026-03-09
Source: data/generated/geography.jsonl
Total facts in domain: 10,421
Sample size: 50 (stratified by difficulty/funScore)

---

### Fact 1 (Difficulty: 1, FunScore: 4)

**Statement:** Paris is the capital of France.

**Quiz Question:** What is the capital of France?

**Correct Answer:** Paris

**Variants:**
- Which city is the capital of France?
- The capital of France is _____.
- Paris is the capital of France: true or false?

**Distractors (sample):**
- London (easy)
- Berlin (easy)
- Lyon (medium)
- Nice (hard)
... [8+ total distractors listed]

**Difficulty Rating:** 1/5 (Trivial)

**Fun Score:** 4/10 (Okay)

**Wow Factor:** "Paris has been the capital for over 800 years!"

**Visual Description:** "Medieval cathedral with flying buttresses overlooking the Seine..."

**Age Rating:** kid

**Source:** Wikidata (Q90)

---

### Fact 2 (Difficulty: 3, FunScore: 8)
[... continue ...]

---

## Review Checklist

Please verify each sample fact and answer the checklist below:

- [ ] **Fact Accuracy**: The statement is factually correct (verify in authoritative source)
- [ ] **Answer Correctness**: The correct answer is unambiguous and provably correct
- [ ] **Question Clarity**: The quiz question is clear, unambiguous, single-answer
- [ ] **Distractor Quality**: Distractors are plausible but unambiguously wrong
- [ ] **Distractor Variety**: Distractors include easy/medium/hard tiers
- [ ] **Difficulty Rating**: The 1-5 difficulty rating is appropriate for the fact
- [ ] **Fun Score**: The fun score (1-10) reflects how surprising/interesting the fact is
- [ ] **Wow Factor**: The wow factor statement is accurate and exciting
- [ ] **Visual Description**: The 20-40 word description is vivid and pixel-art-appropriate
- [ ] **Age Rating**: The content is appropriate for the stated age group (kid/teen/adult)
- [ ] **No Factual Errors**: No misleading or controversial information

---

## Summary

Sample reviewed: [DATE]
Reviewer: [NAME]

**Issues Found:**
- [List any factual errors, ambiguous questions, poor distractors, etc.]
- [Include line number/fact ID for easy reference]

**Overall Quality:** ⭐⭐⭐⭐⭐ (1-5 stars)

**Recommendation:**
- [ ] PASS — Facts are high quality, proceed with full domain
- [ ] PASS WITH NOTES — Minor issues, acceptable, proceed
- [ ] NEEDS REVISION — [Specify issue] — recommend re-generating with adjusted prompts
```

**Execution**:

```bash
#!/bin/bash
# Generate samples for all domains

domains=(
  "general-knowledge"
  "natural-sciences"
  "space-astronomy"
  "geography"
  "history"
  "mythology-folklore"
  "animals-wildlife"
  "human-body-health"
  "food-cuisine"
  "art-architecture"
)

for domain in "${domains[@]}"; do
  echo "Generating review sample for $domain..."
  node scripts/content-pipeline/qa/review-sample.mjs \
    --input data/generated/${domain}.jsonl \
    --output samples/human-review/${domain}-sample.md \
    --sample-size 50 \
    --selection-strategy stratified
done

echo "Review samples generated in samples/human-review/"
echo "Distribute to domain experts for fact-checking"
```

**Human Review Process**:

1. **Distribution**: Send markdown files to domain experts (biologist reviews animals-wildlife, historian reviews history, etc.)
2. **Timeline**: 2-3 days per expert to review 50 facts + fill checklist
3. **Feedback**: Collect marked-up files with issues noted
4. **Aggregation**: Compile feedback, categorize by issue type (factual error, ambiguous question, poor difficulty rating, etc.)
5. **Decision**:
   - If < 5% issues: proceed to production migration
   - If 5-10% issues: identify pattern, adjust prompts, re-run affected domain(s)
   - If > 10% issues: halt, redesign prompts, re-run from batch generation step

---

### 7. Vocabulary QA

**Objective**: Run similar validation on all 6 language vocabulary files.

**Validation Checks**:

```bash
#!/bin/bash
# scripts/validate-vocabulary.sh

languages=(ja es fr de ko zh)

for lang in "${languages[@]}"; do
  echo "Validating vocabulary-$lang..."

  # Check input file exists and has structure
  if [ ! -f src/data/seed/vocab-${lang}.json ]; then
    echo "✗ vocab-${lang}.json NOT FOUND"
    exit 1
  fi

  # Validate each entry has required fields
  jq -r '.[] | select(.id == null or .word == null or .meanings == null) | .id' \
    src/data/seed/vocab-${lang}.json | wc -l > /tmp/missing-fields.txt

  if [ $(cat /tmp/missing-fields.txt) -gt 0 ]; then
    echo "✗ vocab-${lang}: $(cat /tmp/missing-fields.txt) entries missing required fields"
    exit 1
  fi

  # Check distractor word count
  if [ -f data/generated/facts-vocab-${lang}.jsonl ]; then
    # Sample 10 facts, verify all have 8+ distractors
    head -10 data/generated/facts-vocab-${lang}.jsonl | \
      jq 'select(.distractors | length < 8) | .id' | wc -l > /tmp/bad-distractors.txt

    if [ $(cat /tmp/bad-distractors.txt) -gt 0 ]; then
      echo "⚠ vocab-${lang}: $(cat /tmp/bad-distractors.txt) facts have < 8 distractors"
    fi
  fi

  # Check Tatoeba coverage
  coverage=$(jq '[.[] | select(.exampleSentences | length > 0)] | length' src/data/seed/vocab-${lang}.json)
  total=$(jq 'length' src/data/seed/vocab-${lang}.json)
  percent=$(echo "scale=1; $coverage * 100 / $total" | bc)
  echo "  Tatoeba sentence coverage: $coverage / $total ($percent%)"

  # Check level distribution
  echo "  Level distribution:"
  jq '[.[] | .cefrLevel // .hskLevel // .topikLevel] | group_by(.) | map({level: .[0], count: length})' \
    src/data/seed/vocab-${lang}.json

  echo "✓ vocab-${lang} validation complete"
done

echo ""
echo "All vocabulary files validated"
```

**Quality Metrics**:

- All required fields present: id, word, meanings, sourceName, sourceUrl
- No duplicate words in same language/level
- Distractor coverage: all facts have 8+ distractors
- Tatoeba coverage: > 50% of vocab entries have example sentences
- Level distribution: all CEFR/HSK/TOPIK levels represented
- Visual description coverage: 0% (to be generated in next step)

---

### 8. Visual Description Generation

**Objective**: Generate visual descriptions for all knowledge domain facts and vocabulary facts using language/domain-themed templates.

**Prerequisites**: AR-11 Part C (Visual Description Pipeline) must be complete.

**Execution**:

```bash
#!/bin/bash
# scripts/generate-visual-descriptions.sh

# Knowledge domain facts
domains=(
  "general-knowledge"
  "natural-sciences"
  "space-astronomy"
  "geography"
  "history"
  "mythology-folklore"
  "animals-wildlife"
  "human-body-health"
  "food-cuisine"
  "art-architecture"
)

for domain in "${domains[@]}"; do
  echo "Generating visual descriptions for $domain..."
  node scripts/visual-gen/generate-visual-descriptions.mjs \
    --input data/generated/${domain}.jsonl \
    --output data/generated/${domain}-with-visuals.jsonl \
    --domain ${domain} \
    --batch-size 50

  if [ $? -eq 0 ]; then
    mv data/generated/${domain}-with-visuals.jsonl data/generated/${domain}.jsonl
    echo "✓ $domain visual descriptions complete"
  else
    echo "✗ $domain visual generation FAILED"
    exit 1
  fi
done

# Vocabulary facts per language
languages=(ja es fr de ko zh)

for lang in "${languages[@]}"; do
  echo "Generating visual descriptions for vocabulary-$lang..."
  node scripts/visual-gen/generate-visual-descriptions.mjs \
    --input data/generated/facts-vocab-${lang}.jsonl \
    --output data/generated/facts-vocab-${lang}-with-visuals.jsonl \
    --language ${lang} \
    --batch-size 50

  if [ $? -eq 0 ]; then
    mv data/generated/facts-vocab-${lang}-with-visuals.jsonl data/generated/facts-vocab-${lang}.jsonl
    echo "✓ vocab-$lang visual descriptions complete"
  else
    echo "✗ vocab-$lang visual generation FAILED"
    exit 1
  fi
done

echo ""
echo "All visual descriptions generated"
```

**Expected Output**:
- All JSONL files updated with `visualDescription` field populated
- Coverage: > 90% of facts should have visual descriptions
- No more `null` visual descriptions

**Validation**:

```bash
# Verify visual description coverage
for jsonl in data/generated/*.jsonl; do
  total=$(wc -l < $jsonl)
  with_visual=$(jq 'select(.visualDescription != null and .visualDescription != "")' $jsonl | wc -l)
  percent=$(echo "scale=1; $with_visual * 100 / $total" | bc)
  echo "$(basename $jsonl): $with_visual / $total ($percent%)"
done
```

---

### 9. Production Database Migration

**File(s)**: `scripts/content-pipeline/qa/migrate-to-production.mjs`

**Objective**: Merge all validated JSONL files into a single production database (sql.js SQLite format) with proper schema, indexing, and versioning.

**Implementation Requirements**:

```javascript
/**
 * Migrate generated facts to production database
 * @param {Object} options - Configuration
 * @param {string} options.factFiles - Glob pattern for fact JSONL files (e.g., "data/generated/*.jsonl")
 * @param {string} options.outputDb - Output sqlite database path (e.g., "public/facts.db")
 * @param {string} options.seedPack - Output seed pack JSON (e.g., "public/seed-pack.json")
 * @param {boolean} options.preserveExisting - Keep existing fact IDs (true), or regenerate (false)
 * @returns {Promise<Object>} { factsLoaded, newFacts, duration, dbSize }
 */
async function migrateToDB(options)
```

**Processing Steps**:

1. **Input Validation**:
   - Load all JSONL files matching glob pattern
   - Total expected: ~130K facts (100K knowledge + 30K vocabulary)
   - Verify: all facts have required fields

2. **Database Schema** (sql.js):

```sql
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  quizQuestion TEXT NOT NULL,
  correctAnswer TEXT NOT NULL,
  variants JSON,
  distractors JSON,
  difficulty INTEGER,
  funScore INTEGER,
  wowFactor TEXT,
  visualDescription TEXT,
  ageRating TEXT,
  sourceName TEXT,
  sourceUrl TEXT,
  category JSON,
  contentType TEXT,
  language TEXT,
  cefrLevel TEXT,
  hskLevel TEXT,
  topikLevel TEXT,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_difficulty ON facts(difficulty);
CREATE INDEX idx_language ON facts(language);
CREATE INDEX idx_category ON facts(category);
CREATE INDEX idx_content_type ON facts(contentType);
CREATE INDEX idx_fun_score ON facts(funScore DESC);
```

3. **ID Preservation**:
   - If `--preserve-existing`: Keep existing fact IDs from seed files
   - If not: Generate new UUID for each fact
   - Track: map old IDs to new IDs (needed for FSRS state migration)

4. **Merge with Seed Data**:
   - Load existing seed facts from `src/data/seed/*.json`
   - Merge with generated facts (generated facts override seed facts with same ID)
   - Example: if `vocab-n3.json` existed before, new JLPT N3 facts replace old facts

5. **Data Integrity Checks**:
   - No NULL required fields
   - All IDs are unique
   - Foreign keys resolve (if any)
   - Total record count matches expected

6. **SQLite Database Creation**:
   - Use `better-sqlite3` or `sql.js` library (JavaScript SQLite)
   - Insert all facts in batches (1000 records at a time)
   - Create indexes for fast querying
   - Verify: database loads successfully, queries are fast

7. **Seed Pack Generation** (for offline play):
   - Extract facts by category/language/difficulty
   - Create JSON bundles: `seed-pack.json`
   - Format: `{ languages: { es: {...}, fr: {...}, ... }, domains: { geography: {...}, ... } }`
   - Each bundle includes a subset of facts suitable for offline caching

8. **Output Files**:
   - `public/facts.db` — SQLite database (binary, ~50MB estimated)
   - `public/seed-pack.json` — JSON bundle for offline caching (compressed, ~30MB)
   - `data/generated/migration-report.json` — detailed migration summary

**Execution**:

```bash
node scripts/content-pipeline/qa/migrate-to-production.mjs \
  --fact-files "data/generated/*.jsonl" \
  --output-db public/facts.db \
  --seed-pack public/seed-pack.json \
  --preserve-existing true
```

**Verification**:

```bash
# Verify database loads
node -e "
const Database = require('better-sqlite3');
const db = new Database('public/facts.db');
const count = db.prepare('SELECT COUNT(*) as cnt FROM facts').get().cnt;
console.log('Database loaded, total facts:', count);
db.close();
"

# Check database size
du -h public/facts.db
du -h public/seed-pack.json
```

---

### 10. Final Audit & Production Readiness

**Objective**: Comprehensive final verification that all generated content is game-ready.

**Audit Checklist**:

1. **Fact Count Verification**:
   ```bash
   # Total fact count in production database
   node -e "
   const Database = require('better-sqlite3');
   const db = new Database('public/facts.db');
   const counts = db.prepare(\`
     SELECT contentType, COUNT(*) as cnt FROM facts GROUP BY contentType
   \`).all();
   console.log('Fact counts by type:');
   counts.forEach(c => console.log('  ' + c.contentType + ':', c.cnt));
   db.close();
   "
   ```
   - Target: 100K+ knowledge facts, 30K+ vocabulary facts
   - Verify: no facts lost during migration

2. **Database Performance**:
   ```bash
   # Test cold start load time
   time node -e "
   const Database = require('better-sqlite3');
   const db = new Database('public/facts.db');
   const facts = db.prepare('SELECT id, quizQuestion FROM facts LIMIT 100').all();
   console.log('Loaded', facts.length, 'facts');
   db.close();
   "
   ```
   - Target: load complete database in < 3 seconds
   - Target: query 100 facts in < 100ms

3. **Game Integration Test**:
   ```bash
   npm run dev &
   # Open browser, test:
   # - App loads without JS errors
   # - Start a run, see facts from all 10 domains
   # - Facts render correctly (no schema mismatches)
   # - Quiz variants display properly
   # - Distractors show correctly
   # - Visual descriptions are present (text field, not null)
   # - No infinite loops or performance drops
   pkill -f "npm run dev"
   ```

4. **E2E Test Suite**:
   ```bash
   npm run dev &
   sleep 3

   # Run existing E2E tests
   node tests/e2e/01-app-loads.cjs
   node tests/e2e/02-mine-quiz-flow.cjs
   node tests/e2e/03-save-resume.cjs

   pkill -f "npm run dev"

   # All tests must pass with new content
   ```

5. **Data Validation**:
   ```bash
   # Random sample of 20 facts from production DB, verify structure
   node scripts/qa/final-validation.mjs \
     --database public/facts.db \
     --sample-size 20 \
     --output data/generated/final-validation.json
   ```
   - Check: all facts have required fields
   - Check: no broken references or corrupt data
   - Check: visual descriptions are non-empty and sensible

6. **Performance Profiling**:
   ```bash
   # Cold start time (no cache)
   time npm run dev & sleep 5 && curl http://localhost:5173 > /dev/null && pkill -f "npm run dev"

   # Memory usage with full database
   node --max-old-space-size=512 -e "
   const Database = require('better-sqlite3');
   const db = new Database('public/facts.db');
   console.log('Memory:', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');
   db.close();
   "
   ```
   - Target: cold start < 5 seconds
   - Target: memory footprint < 200MB

7. **Content Quality Spot-Check**:
   ```bash
   # Random sample: are facts sensible?
   node -e "
   const Database = require('better-sqlite3');
   const db = new Database('public/facts.db');
   const samples = db.prepare('SELECT id, quizQuestion, correctAnswer FROM facts ORDER BY RANDOM() LIMIT 10').all();
   console.table(samples);
   db.close();
   "
   ```
   - Manually verify: 10 random facts make sense
   - No gibberish or malformed data

8. **Documentation Update**:
   - Update `docs/GAME_DESIGN.md` with content statistics (fact counts, domain coverage, language support)
   - Update `docs/ARCHITECTURE.md` with database schema and data flow
   - Document API endpoints for content access (if applicable)

**Final Report**:

```
========================================
PRODUCTION READINESS AUDIT REPORT
2026-03-09
========================================

CONTENT STATISTICS:
  Total facts: 130,421
  Knowledge facts: 103,203
  Vocabulary facts: 27,218

DOMAIN COVERAGE:
  General Knowledge:     10,421 facts
  Natural Sciences:      10,098 facts
  Space Astronomy:        9,934 facts
  Geography:             10,356 facts
  History:               10,234 facts
  Mythology/Folklore:     9,876 facts
  Animals/Wildlife:      10,421 facts
  Human Body/Health:      9,987 facts
  Food/Cuisine:          10,123 facts
  Art/Architecture:      10,553 facts

LANGUAGE COVERAGE:
  Japanese (JLPT):        20,800 vocab entries
  Spanish (CEFR):          5,312 vocab entries
  French (CEFR):           5,098 vocab entries
  German (CEFR):           5,189 vocab entries
  Korean (TOPIK):          5,421 vocab entries
  Mandarin (HSK):          5,398 vocab entries

QUALITY METRICS:
  Validation Error Rate:     < 0.5%
  Difficulty Distribution:   Balanced (19-20% per level)
  Fun Score Average:          6.2/10
  Visual Coverage:            92%
  Example Sentence Coverage:  68% (vocabulary)

PERFORMANCE BENCHMARKS:
  Cold Start Load Time:       2.8 seconds
  Database Query Time:        0.05 seconds (100 facts)
  Memory Footprint:           156 MB

✓ PRODUCTION READY
All systems pass audit criteria.
Ready for beta testing and public release.

NEXT STEPS:
1. Deploy to production server
2. Enable content caching (CDN)
3. Monitor performance metrics in production
4. Collect user feedback on fact quality
5. Plan for periodic content updates (monthly)
```

---

## Acceptance Criteria

- 10K+ facts per knowledge domain (10 domains × 10K = 100K+ total)
- 5K+ vocabulary entries per language (6 languages × 5K = 30K+)
- <5% validation error rate per domain
- <50 duplicate fact pairs across domains (deduplicated)
- All 5 difficulty levels represented in each domain
- All difficulty levels represented in each language
- Difficulty distribution balanced (19-20% per level)
- Average funScore ≥ 6.0 across all facts
- Visual description coverage ≥ 90%
- Tatoeba sentence coverage ≥ 50% for vocabulary
- Human review: <5% issues found in sample facts
- Production database loads in <3 seconds (cold start)
- All E2E tests pass with new content
- No factual errors identified in human review
- Game performs at 60fps with full database loaded
- `npm run build` succeeds without errors
- `npm run typecheck` passes

---

## Verification Gate

**Pre-Execution Checklist**:
- [ ] `node scripts/generate-all-domains.sh --dry-run` completes without errors
- [ ] All 10 domain source files present in `data/raw/`
- [ ] All 6 vocabulary source files present in `src/data/seed/`
- [ ] ANTHROPIC_API_KEY is set and valid
- [ ] Pre-generation audit passes (step 1)
- [ ] Estimated budget approved ($180-220)

**Post-Execution Checklist**:
- [ ] Total fact count ≥ 130,000 (knowledge + vocabulary)
- [ ] `validate-output.mjs` reports <5% error rate per domain
- [ ] `coverage-report.mjs` shows balanced difficulty distribution
- [ ] `cross-domain-dedup.mjs` identifies duplicate pairs
- [ ] Human review samples generated and distributed (500 facts total)
- [ ] Human reviews returned with <5% issues flagged
- [ ] `generate-visual-descriptions.sh` completes for all domains/languages
- [ ] `migrate-to-production.mjs` creates production database without errors
- [ ] `public/facts.db` is readable and queryable
- [ ] `npm run dev` starts and loads all facts without JS errors
- [ ] E2E tests pass: `01-app-loads.cjs`, `02-mine-quiz-flow.cjs`, `03-save-resume.cjs`
- [ ] Playwright: complete full game run with facts from all 10 domains
- [ ] `npm run build` produces valid production bundle
- [ ] Database performance: cold load < 3 seconds, query 100 facts < 100ms
- [ ] Final audit report shows all criteria met
- [ ] Documentation updated (`GAME_DESIGN.md`, `ARCHITECTURE.md`)

---

## Files Affected

**NEW** (Scripts):
- `scripts/content-pipeline/qa/cross-domain-dedup.mjs`
- `scripts/content-pipeline/qa/coverage-report.mjs`
- `scripts/content-pipeline/qa/review-sample.mjs`
- `scripts/content-pipeline/qa/migrate-to-production.mjs`
- `scripts/content-pipeline/qa/final-validation.mjs`
- `scripts/generate-all-domains.sh` (wrapper script)
- `scripts/validate-all-domains.sh` (wrapper script)
- `scripts/generate-visual-descriptions.sh` (wrapper script)
- `scripts/validate-vocabulary.sh` (wrapper script)

**EDIT** (Database):
- `public/facts.db` — rebuilt with all content
- `public/seed-pack.json` — new seed pack for offline

**CREATED** (Seed Data):
- `src/data/seed/vocab-n5.json` (replaced)
- `src/data/seed/vocab-n4.json` (new)
- `src/data/seed/vocab-n2.json` (new)
- `src/data/seed/vocab-n1.json` (new)
- `src/data/seed/vocab-es.json` (new)
- `src/data/seed/vocab-fr.json` (new)
- `src/data/seed/vocab-de.json` (new)
- `src/data/seed/vocab-ko.json` (new)
- `src/data/seed/vocab-zh.json` (new)

**GENERATED** (Intermediate, not in version control):
- `data/generated/*.jsonl` — intermediate fact JSONL files
- `data/generated/qa-reports/*.json` — validation and analysis reports
- `samples/human-review/*.md` — review samples for human inspection

**DOCUMENTATION** (Updated):
- `docs/GAME_DESIGN.md` — add content statistics section
- `docs/ARCHITECTURE.md` — add database schema and migration details
- `docs/PROGRESS.md` — mark AR-19 as complete, move phase doc to `completed/`

---

## Timeline & Resource Planning

**Estimated Duration**: 3-4 weeks
- Week 1: Pre-audit + batch generation (parallel: generate 2-3 domains per day)
- Week 2: Validation + duplicate detection + coverage analysis
- Week 3: Human review sampling + feedback incorporation + visual description generation
- Week 4: Database migration + final audit + documentation + deployment

**Resource Requirements**:
- **Developer**: 1 person (80 hours) — execution, monitoring, troubleshooting
- **Domain Experts**: 5-6 people (10-20 hours each) — human review of sample facts
- **API Cost**: $180-220 (Anthropic Haiku)
- **Compute**: Standard development machine (SSD for temp files, 8GB+ RAM for DB operations)
- **Storage**: 2-3GB temporary disk space for intermediate files

**Critical Milestones**:
1. All domains generate < error rate > 5% (end of week 1)
2. Duplicate detection and coverage analysis complete (end of week 2)
3. Human review feedback collected and decisions made (mid-week 3)
4. Visual descriptions generated and validated (end of week 3)
5. Production database migrated and tested (early week 4)
6. Final audit passes (end of week 4)

---

## Rollback Plan

If critical issues found during final audit:

1. **Database Corruption**: Restore from previous backup or re-run `migrate-to-production.mjs` with error logging
2. **High Error Rate**: Re-run `batch-generate.mjs` with adjusted prompts (see AR-17 for prompt tuning)
3. **Performance Issues**: Profile with Playwright, check for N+1 queries or missing database indexes
4. **Content Quality**: Return to human review step, collect more comprehensive feedback, regenerate affected domains

**Version Control**:
- Commit production database to git as artifact (or store separately)
- Tag release: `v0.1.0-content-launch-2026-03-09`
- Keep previous version available for quick rollback: `v0.0.1-seed-facts`

---

## Success Criteria

Content launch is successful when:
- Game loads with 130K+ facts in < 3 seconds
- All 10 knowledge domains and 6 languages playable
- <1 bug report per 1000 facts played (quality threshold)
- Average player session duration increases by 20% (engagement improvement)
- Zero major content errors (factual inaccuracies) in first month
- Player satisfaction with content: 4.0+/5.0 (app store rating)

---
