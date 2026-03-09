# AR-11: Content Pipeline Infrastructure
> Phase: DevOps — Data Management
> Priority: MEDIUM
> Depends on: None (but should be done before 10K+ facts are generated)
> Estimated scope: M

The seed database contains only 122 facts. The owner plans to generate 10K+ facts per domain using Claude CLI. This phase builds the infrastructure to validate, deduplicate, and ingest bulk fact data. The pipeline ensures quality, coverage, and consistency across domains.

## Design Reference

From GAME_DESIGN.md Section 30 (Content Management):

> Facts ingested from bulk sources (CSV, JSON) must validate:
> - All required fields present (question, answers, cardType, domain, difficulty)
> - Distractor pool ≥ 2 (multiple wrong answers)
> - Variant answers exist for recall checks
> - Card type valid (attack, shield, heal, buff, debuff, utility)
> - Difficulty in 1-3 range
> - No obvious duplicates (fuzzy match on question text)
> - Age rating appropriate for domain
> - Question variants generated (4-6 per fact, types: forward/reverse/negative/context/fill_blank/true_false)

From docs/RESEARCH/terra-miner-spec.md:

> Content pipeline: validate, deduplicate, import, verify, publish. Facts start unverified. CLI command marks as verified after human review.

## Implementation

### Sub-task 1: Bulk Fact Ingestion Script

Create a Node.js/TypeScript CLI tool that reads facts from JSON or CSV:

```bash
npx ts-node scripts/ingestFacts.ts --source facts.json --domain biology --verify false
```

#### Script: `scripts/ingestFacts.ts`

```typescript
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { ArgumentParser } from 'argparse';

interface SourceFact {
  question: string;
  correct_answer?: string;  // May be 'answers[0]'
  answers?: string[];  // Array of 3-4 answers
  distractor_1?: string;  // Or may be separate fields
  distractor_2?: string;
  card_type?: string;  // 'attack' | 'shield' | 'heal' | 'buff' | 'debuff' | 'utility'
  difficulty?: string;  // '1' | '2' | '3'
  age_rating?: string;  // '4+' | '7+' | '10+' | '13+' | '16+' | '18+'
  source?: string;  // Where this fact came from
}

interface ImportReport {
  totalInput: number;
  validFacts: number;
  invalidFacts: number;
  duplicatesFound: number;
  details: {
    missingField: string[];
    invalidCardType: string[];
    invalidDifficulty: string[];
    tooFewAnswers: string[];
    fuzzyDuplicate: string[];
  };
}

async function ingestFacts(
  filePath: string,
  domain: string,
  verify: boolean = false
): Promise<ImportReport> {
  const facts: SourceFact[] = await loadFacts(filePath);
  const report: ImportReport = {
    totalInput: facts.length,
    validFacts: 0,
    invalidFacts: 0,
    duplicatesFound: 0,
    details: {
      missingField: [],
      invalidCardType: [],
      invalidDifficulty: [],
      tooFewAnswers: [],
      fuzzyDuplicate: [],
    },
  };

  for (const fact of facts) {
    const validation = validateFact(fact, domain);
    if (!validation.valid) {
      report.invalidFacts++;
      for (const error of validation.errors) {
        if (error.includes('missing')) report.details.missingField.push(fact.question);
        if (error.includes('cardType')) report.details.invalidCardType.push(fact.question);
        if (error.includes('difficulty')) report.details.invalidDifficulty.push(fact.question);
        if (error.includes('answers')) report.details.tooFewAnswers.push(fact.question);
      }
      continue;
    }

    // Check for duplicates
    const isDuplicate = await fuzzyMatchDatabase(fact.question, domain);
    if (isDuplicate) {
      report.duplicatesFound++;
      report.details.fuzzyDuplicate.push(fact.question);
      continue;
    }

    // Import to database
    const dbFact = convertToDatabaseFact(fact, domain, verify);
    await saveToDatabaseLocal(dbFact);  // or cloud backend
    report.validFacts++;
  }

  return report;
}

function validateFact(fact: SourceFact, domain: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!fact.question) errors.push('missing question');
  if (!fact.answers || fact.answers.length < 2) errors.push('too few answers (need ≥ 2)');
  if (!fact.card_type) errors.push('missing cardType');
  if (!fact.difficulty) errors.push('missing difficulty');

  // Validate values
  const validCardTypes = ['attack', 'shield', 'heal', 'buff', 'debuff', 'utility'];
  if (fact.card_type && !validCardTypes.includes(fact.card_type)) {
    errors.push(`invalid cardType: ${fact.card_type}`);
  }

  const validDifficulties = ['1', '2', '3'];
  if (fact.difficulty && !validDifficulties.includes(fact.difficulty)) {
    errors.push(`invalid difficulty: ${fact.difficulty}`);
  }

  // Distractor quality (warning, not error)
  if (fact.answers && fact.answers.length === 2) {
    console.warn(`⚠ ${fact.question}: only 1 distractor. Consider adding more.`);
  }

  return { valid: errors.length === 0, errors };
}

async function fuzzyMatchDatabase(
  question: string,
  domain: string
): Promise<boolean> {
  // Check if similar question already exists in database
  const existing = await queryDatabase(`SELECT * FROM facts WHERE domain = ?`, [domain]);

  for (const row of existing) {
    const similarity = levenshteinSimilarity(question, row.question);
    if (similarity > 0.85) {
      // 85%+ similarity = likely duplicate
      console.warn(`⚠ Potential duplicate: "${question}" ~ "${row.question}" (${similarity}%)`);
      return true;
    }
  }

  return false;
}

function levenshteinSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return ((longer.length - editDistance) / longer.length);
}

function levenshtein(s1: string, s2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

function convertToDatabaseFact(
  source: SourceFact,
  domain: string,
  verify: boolean
): Fact {
  return {
    id: generateId(),
    question: source.question,
    answers: source.answers || [],
    correctIndex: 0,  // Assume first answer is correct
    cardType: source.card_type as CardType,
    difficulty: source.difficulty as Difficulty,
    domain,
    ageRating: source.age_rating ?? '4+',
    verifiedAt: verify ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    sourceAttribution: source.source ?? 'bulk-import',
  };
}

async function saveToDatabaseLocal(fact: Fact): Promise<void> {
  // Save to sql.js or local file
  // Implementation depends on database choice (sql.js, better-sqlite3, etc.)
  const db = await openDatabase();
  db.exec(`
    INSERT INTO facts (id, question, answers, correctIndex, cardType, difficulty, domain, ageRating, verifiedAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    fact.id, fact.question, JSON.stringify(fact.answers), fact.correctIndex,
    fact.cardType, fact.difficulty, fact.domain, fact.ageRating, fact.verifiedAt, fact.createdAt
  ]);
}

// CLI entry point
const parser = new ArgumentParser({
  description: 'Bulk ingest and validate facts from JSON or CSV',
});

parser.add_argument('--source', { required: true, help: 'Path to JSON or CSV file' });
parser.add_argument('--domain', { required: true, help: 'Domain name (biology, history, etc.)' });
parser.add_argument('--verify', { default: 'false', help: 'Mark facts as verified (true/false)' });

const args = parser.parse_args();

(async () => {
  const verify = args.verify === 'true';
  console.log(`Ingesting facts from ${args.source} (domain: ${args.domain}, verify: ${verify})...`);
  const report = await ingestFacts(args.source, args.domain, verify);
  console.log(`\nImport Report:`);
  console.log(`  Valid: ${report.validFacts}`);
  console.log(`  Invalid: ${report.invalidFacts}`);
  console.log(`  Duplicates: ${report.duplicatesFound}`);
  if (report.details.missingField.length > 0) {
    console.log(`  Missing fields: ${report.details.missingField.length}`);
  }
  if (report.details.fuzzyDuplicate.length > 0) {
    console.log(`  Fuzzy duplicates: ${report.details.fuzzyDuplicate.length}`);
  }
})();
```

### Sub-task 2: Fact Validation Schema

Define strict validation rules:

```typescript
// In src/data/factSchema.ts

export interface Fact {
  id: string;
  question: string;
  answers: string[];  // 2-4 options
  correctIndex: number;  // 0-3, index of correct answer
  cardType: CardType;
  difficulty: Difficulty;  // '1' | '2' | '3'
  domain: string;  // 'biology' | 'history' | etc.
  ageRating: string;  // '4+' | '7+' | '10+' | '13+' | '16+' | '18+'
  variantAnswers?: string[];  // Alternate valid answers for recall check
  verifiedAt?: string;  // ISO timestamp; null = unverified
  createdAt: string;
  sourceAttribution?: string;
}

export const FACT_VALIDATION_RULES = {
  question: {
    required: true,
    minLength: 10,
    maxLength: 500,
  },
  answers: {
    required: true,
    minCount: 2,
    maxCount: 4,
    eachMinLength: 1,
    eachMaxLength: 100,
  },
  correctIndex: {
    required: true,
    type: 'number',
    min: 0,
    max: 3,
  },
  cardType: {
    required: true,
    enum: ['attack', 'shield', 'heal', 'buff', 'debuff', 'utility'],
  },
  difficulty: {
    required: true,
    enum: ['1', '2', '3'],
  },
  domain: {
    required: true,
    minLength: 1,
    maxLength: 50,
  },
  ageRating: {
    default: '4+',
    enum: ['4+', '7+', '10+', '13+', '16+', '18+'],
  },
};

export function validateFact(fact: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const f = fact as any;

  // Question validation
  if (!f.question) errors.push('question: required');
  else if (typeof f.question !== 'string') errors.push('question: must be string');
  else if (f.question.length < 10) errors.push('question: min 10 chars');
  else if (f.question.length > 500) errors.push('question: max 500 chars');

  // Answers validation
  if (!f.answers) errors.push('answers: required');
  else if (!Array.isArray(f.answers)) errors.push('answers: must be array');
  else if (f.answers.length < 2) errors.push('answers: min 2 options');
  else if (f.answers.length > 4) errors.push('answers: max 4 options');
  else {
    f.answers.forEach((ans, i) => {
      if (typeof ans !== 'string') errors.push(`answers[${i}]: must be string`);
      if (ans.length === 0) errors.push(`answers[${i}]: cannot be empty`);
      if (ans.length > 100) errors.push(`answers[${i}]: max 100 chars`);
    });
  }

  // CorrectIndex validation
  if (typeof f.correctIndex !== 'number') errors.push('correctIndex: must be number');
  else if (f.correctIndex < 0 || f.correctIndex > 3) errors.push('correctIndex: must be 0-3');
  else if (f.answers && f.correctIndex >= f.answers.length) errors.push('correctIndex: out of range');

  // CardType validation
  if (!f.cardType) errors.push('cardType: required');
  else if (!['attack', 'shield', 'heal', 'buff', 'debuff', 'utility'].includes(f.cardType)) {
    errors.push(`cardType: invalid value "${f.cardType}"`);
  }

  // Difficulty validation
  if (!f.difficulty) errors.push('difficulty: required');
  else if (!['1', '2', '3'].includes(f.difficulty)) {
    errors.push(`difficulty: must be 1-3, got "${f.difficulty}"`);
  }

  // Domain validation
  if (!f.domain) errors.push('domain: required');
  else if (typeof f.domain !== 'string') errors.push('domain: must be string');
  else if (f.domain.length === 0) errors.push('domain: cannot be empty');

  // AgeRating validation (if present)
  if (f.ageRating && !['4+', '7+', '10+', '13+', '16+', '18+'].includes(f.ageRating)) {
    errors.push(`ageRating: invalid value "${f.ageRating}"`);
  }

  return { valid: errors.length === 0, errors };
}
```

### Sub-task 3: Duplicate Detection

Implement fuzzy matching (already shown in Sub-task 1, but expand here):

```typescript
// In src/services/deduplicationService.ts

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchingFact?: Fact;
  similarity: number;  // 0-1, where 1 = exact match
}

const DUPLICATE_THRESHOLD = 0.85;  // 85%+ similarity = duplicate

export function findDuplicates(
  fact: Fact,
  existingFacts: Fact[]
): DuplicateCheckResult {
  let bestMatch: Fact | undefined;
  let highestSimilarity = 0;

  for (const existing of existingFacts) {
    if (existing.domain !== fact.domain) continue;  // Only check same domain

    const similarity = levenshteinSimilarity(
      fact.question.toLowerCase(),
      existing.question.toLowerCase()
    );

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = existing;
    }
  }

  return {
    isDuplicate: highestSimilarity >= DUPLICATE_THRESHOLD,
    matchingFact: bestMatch,
    similarity: highestSimilarity,
  };
}
```

### Sub-task 4: Domain Coverage Report

After import, generate a report on coverage:

```typescript
// In src/services/contentReportingService.ts

export interface DomainCoverageReport {
  domain: string;
  totalFacts: number;
  byDifficulty: Record<string, number>;
  byCardType: Record<CardType, number>;
  ageRatingDistribution: Record<string, number>;
  verifiedCount: number;
  unverifiedCount: number;
}

export function generateCoverageReport(facts: Fact[]): DomainCoverageReport[] {
  const byDomain = new Map<string, Fact[]>();

  for (const fact of facts) {
    if (!byDomain.has(fact.domain)) byDomain.set(fact.domain, []);
    byDomain.get(fact.domain)!.push(fact);
  }

  const reports: DomainCoverageReport[] = [];

  for (const [domain, domainFacts] of byDomain) {
    const byDifficulty: Record<string, number> = {};
    const byCardType: Record<CardType, number> = {};
    const ageRatingDist: Record<string, number> = {};
    let verifiedCount = 0;

    for (const fact of domainFacts) {
      byDifficulty[fact.difficulty] = (byDifficulty[fact.difficulty] ?? 0) + 1;
      byCardType[fact.cardType] = (byCardType[fact.cardType] ?? 0) + 1;
      ageRatingDist[fact.ageRating] = (ageRatingDist[fact.ageRating] ?? 0) + 1;
      if (fact.verifiedAt) verifiedCount++;
    }

    reports.push({
      domain,
      totalFacts: domainFacts.length,
      byDifficulty,
      byCardType,
      ageRatingDistribution: ageRatingDist,
      verifiedCount,
      unverifiedCount: domainFacts.length - verifiedCount,
    });
  }

  return reports;
}
```

CLI to generate report:

```bash
npx ts-node scripts/reportCoverage.ts > coverage.json
```

### Sub-task 5: Distractor Quality Check (Optional)

Flag distractors that are too similar to correct answer:

```typescript
// In src/services/distractorQualityService.ts

export interface DistractorQualityIssue {
  factId: string;
  question: string;
  distractorIndex: number;
  issue: 'too_similar' | 'too_obvious' | 'duplicate_answer';
  details: string;
}

export function checkDistractorQuality(fact: Fact): DistractorQualityIssue[] {
  const issues: DistractorQualityIssue[] = [];
  const correctAnswer = fact.answers[fact.correctIndex];

  // Check for duplicate answers
  const uniqueAnswers = new Set(fact.answers.map(a => a.toLowerCase()));
  if (uniqueAnswers.size !== fact.answers.length) {
    issues.push({
      factId: fact.id,
      question: fact.question,
      distractorIndex: -1,
      issue: 'duplicate_answer',
      details: 'Two or more answers are identical (case-insensitive)',
    });
  }

  for (let i = 0; i < fact.answers.length; i++) {
    if (i === fact.correctIndex) continue;

    const distractor = fact.answers[i];

    // Too similar to correct answer
    const similarity = levenshteinSimilarity(
      distractor.toLowerCase(),
      correctAnswer.toLowerCase()
    );
    if (similarity > 0.7) {
      issues.push({
        factId: fact.id,
        question: fact.question,
        distractorIndex: i,
        issue: 'too_similar',
        details: `Distractor "${distractor}" is ${Math.round(similarity * 100)}% similar to correct answer "${correctAnswer}"`,
      });
    }

    // Too obvious (e.g., correct answer is "France", distractor is "Franc")
    if (correctAnswer.includes(distractor) || distractor.includes(correctAnswer)) {
      issues.push({
        factId: fact.id,
        question: fact.question,
        distractorIndex: i,
        issue: 'too_obvious',
        details: `Distractor contains or is contained in correct answer (obvious wrong choice)`,
      });
    }
  }

  return issues;
}

export function reportDisstractorQualityIssues(facts: Fact[]): DistractorQualityIssue[] {
  const allIssues: DistractorQualityIssue[] = [];
  for (const fact of facts) {
    allIssues.push(...checkDistractorQuality(fact));
  }
  return allIssues;
}
```

### Sub-task 6: Migration Path (sql.js database)

Save facts to the bundled sql.js database:

```typescript
// In src/services/databaseMigration.ts

export async function importFactsToDatabase(
  facts: Fact[],
  dbInstance: any  // sql.js Database instance
): Promise<void> {
  const stmt = dbInstance.prepare(`
    INSERT INTO facts (
      id, question, answers, correctIndex, cardType, difficulty,
      domain, ageRating, variantAnswers, verifiedAt, createdAt, sourceAttribution
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const fact of facts) {
    stmt.bind([
      fact.id,
      fact.question,
      JSON.stringify(fact.answers),
      fact.correctIndex,
      fact.cardType,
      fact.difficulty,
      fact.domain,
      fact.ageRating,
      JSON.stringify(fact.variantAnswers ?? []),
      fact.verifiedAt ?? null,
      fact.createdAt,
      fact.sourceAttribution ?? 'manual',
    ]);
    stmt.step();
  }

  stmt.free();
  dbInstance.run('COMMIT');
}

export async function migrateDatabase(
  inputFile: string,
  outputFile: string
): Promise<void> {
  const source = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const db = new sql.Database();

  // Create tables if not exist
  db.run(`
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      answers TEXT NOT NULL,  -- JSON array
      correctIndex INTEGER NOT NULL,
      cardType TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      domain TEXT NOT NULL,
      ageRating TEXT DEFAULT '4+',
      variantAnswers TEXT DEFAULT '[]',
      verifiedAt TEXT,
      createdAt TEXT NOT NULL,
      sourceAttribution TEXT
    )
  `);

  await importFactsToDatabase(source, db);

  // Write binary database to file
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(outputFile, buffer);

  console.log(`Database migrated to ${outputFile}`);
}
```

### Sub-task 7: Verification Workflow

Add field `verifiedAt` to facts. Unverified facts can be used in game but flagged in admin view:

```typescript
// In CLI: mark facts as verified after human review

export async function markFactsAsVerified(
  factIds: string[],
  domain: string,
  dbInstance: any
): Promise<void> {
  const now = new Date().toISOString();
  const stmt = dbInstance.prepare(`UPDATE facts SET verifiedAt = ? WHERE id = ? AND domain = ?`);

  for (const id of factIds) {
    stmt.bind([now, id, domain]);
    stmt.step();
  }

  stmt.free();
  console.log(`Marked ${factIds.length} facts as verified`);
}
```

### Sub-task 8: Documentation

Create `docs/CONTENT_PIPELINE.md`:

```markdown
# Content Pipeline Guide

## Bulk Import Workflow

1. **Prepare source data** (JSON or CSV)
   ```json
   [
     {
       "question": "What is the capital of France?",
       "answers": ["Paris", "Lyon", "Marseille"],
       "correct_answer": "Paris",
       "card_type": "attack",
       "difficulty": "1",
       "domain": "geography"
     }
   ]
   ```

2. **Run validation and import**
   ```bash
   npx ts-node scripts/ingestFacts.ts --source facts.json --domain geography --verify false
   ```

3. **Review import report**
   - Identifies invalid facts, duplicates, quality issues
   - Suggests fixes

4. **Generate coverage report**
   ```bash
   npx ts-node scripts/reportCoverage.ts > coverage.json
   ```

5. **Mark verified facts** (after human review)
   ```bash
   npx ts-node scripts/verifyFacts.ts --domain geography --ids fact1,fact2,fact3
   ```

6. **Rebuild database**
   ```bash
   npm run build:db
   ```

## Validation Rules

- Question: 10-500 characters
- Answers: 2-4 options, each 1-100 characters
- Card type: attack, shield, heal, buff, debuff, utility
- Difficulty: 1-3
- Domain: non-empty string
- Age rating: 4+, 7+, 10+, 13+, 16+, 18+ (default 4+)

## Duplicate Detection

Facts with >85% question similarity are flagged. Manual review recommended.

## Distractor Quality Checks

- Distractors should be 30-70% similar to correct answer (not too obvious, not too similar)
- No duplicate answer options
- Answers should not be substrings of each other

## Unverified Facts

Facts marked with `verifiedAt: null` can be played but flagged in admin view. Bulk-imported facts start unverified.
```

## System Interactions

- **No game systems affected directly.** Pipeline is infrastructure.
- **Game load:** Facts loaded from `public/facts.db` (sql.js). No change to load logic.
- **Admin/reporting (future):** Can query `verifiedAt` to show coverage of unverified content.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Source file is 100K facts, import takes time | Progress logged. Script may take 1-5 minutes. Expected. |
| Distractor text is exactly same as correct answer (case-sensitive) | Flagged as duplicate_answer. Rejected. |
| Question contains newlines | Stored as-is (multiline questions valid). |
| Domain name not in recognized list | Accepted (pipeline is domain-agnostic). |
| CorrectIndex out of range (e.g., 5 for 3 answers) | Rejected. Error logged. |
| CSV has BOM (Byte Order Mark) | Handled by CSV parser. No issue. |
| Fact with 0 duplicates, high quality, new domain | Imported and marked unverified. All looks good. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `scripts/ingestFacts.ts` | Main bulk import CLI |
| Create | `src/services/deduplicationService.ts` | Fuzzy matching and duplicate detection |
| Create | `src/services/distractorQualityService.ts` | Distractor quality checks |
| Create | `src/services/contentReportingService.ts` | Coverage report generation |
| Create | `src/services/databaseMigration.ts` | Migration to sql.js database |
| Create | `src/data/factSchema.ts` | Fact validation rules |
| Create | `docs/CONTENT_PIPELINE.md` | User guide for content team |
| Modify | `package.json` | Add dev dependencies: csv-parse, argparse |
| Create | `scripts/reportCoverage.ts` | Coverage report CLI |
| Create | `scripts/verifyFacts.ts` | Mark facts as verified CLI |
| Create | `scripts/buildDatabase.ts` | Compile facts.json → facts.db (sql.js) |

---

## Sub-task 7: Source Citation Requirement (MANDATORY)

Every fact MUST have a `sourceName` field. This is non-negotiable — incorrect facts destroy trust in an educational product.

### Source Field Rules

```typescript
interface Fact {
  // ... existing fields ...
  sourceName: string;        // REQUIRED. e.g., "Wikipedia", "NASA", "Oxford Dictionary"
  sourceUrl?: string;        // Recommended. Direct link to verification source
  verifiedAt?: Date;         // Null until human-reviewed
}
```

### Validation

- Ingestion script REJECTS any fact with empty/missing `sourceName`
- Wikipedia is the preferred source for general knowledge facts
- Language vocabulary sources: Jisho.org (Japanese), RAE (Spanish), Larousse (French), etc.
- AI-generated facts MUST be cross-referenced against their cited source before `verifiedAt` is set
- `sourceUrl` should be a permanent link (Wikipedia permalink preferred over live article)

### Quality Tiers

| Tier | Source Type | Trust Level | Action |
|------|-----------|-------------|--------|
| Gold | Wikipedia permalink, NASA, NIH, Oxford | High | Auto-accept if schema valid |
| Silver | Educational sites, textbooks, encyclopedias | Medium | Accept, flag for spot-check |
| Bronze | AI-generated, no URL | Low | Reject unless manually verified |

---

## Sub-task 8: Language-Themed Visual Description Generation

### Problem

Current vocab card visual descriptions are generic fantasy scenes with no cultural identity. Example of BAD: "A hand reaching into a display of three glowing orbs—red, blue, and green—fingers closing around the brilliant blue one" (for 選ぶ — to choose). This is lazy, could belong to any language, and doesn't evoke Japan at all.

### Solution

Delete ALL existing vocab visual descriptions. Regenerate with language-specific system prompts that enforce cultural theming.

### Step 1: Delete existing vocab visual descriptions

```bash
# Use jq to null out all visualDescription fields in vocab files
# See agent prompt below for full implementation
```

### Step 2: Language-specific system prompts for visual description generation

Update `sprite-gen/scripts/generate-visual-descriptions.mjs` to accept a `--language` flag and use per-language system prompts.

**Japanese system prompt addition:**
```
CULTURAL THEMING (Japanese vocabulary):
Every scene MUST be set in Japan — feudal, Edo-period, or traditional settings preferred.
Use: torii gates, bamboo forests, tatami rooms, castle towns, onsen, shrine paths,
paper lanterns, zen gardens, cherry blossoms, moonlit temple roofs, tea ceremonies,
samurai, monks, geisha (tasteful), fishing villages, rice paddies, mountain paths.
Color palette: ukiyo-e influence — deep indigos, warm ambers, cherry pink, moss green.
The scene must ILLUSTRATE THE MEANING of the word, not just be a random Japan backdrop.
A scene for "to calculate" should show someone CALCULATING in a Japanese setting,
not just a pretty shrine.
```

**Spanish system prompt addition:**
```
CULTURAL THEMING (Spanish vocabulary):
Every scene MUST be set in Spain or Latin America.
Use: terracotta plazas, flamenco stages, agave fields, Aztec temples, jungle cenotes,
haciendas, Mediterranean ports, bull arenas, olive groves, guitar-lit cantinas.
Color palette: warm sunset tones, vibrant reds/oranges/golds, turquoise accents.
```

**French system prompt addition:**
```
CULTURAL THEMING (French vocabulary):
Every scene MUST be set in France or French-speaking regions.
Use: cobblestone cafés, lavender fields, cathedral stained glass, misty bridges,
vineyard hillsides, Parisian rooftops, patisserie windows, château gardens.
Color palette: soft pastels, romantic lighting, art nouveau touches.
```

### Step 3: Anti-pattern detection

Add a validation step that REJECTS visual descriptions containing:
- Generic fantasy elements with no cultural markers (glowing orbs, magic portals, generic wizards)
- Descriptions shorter than 15 words
- Descriptions that don't relate to the word's meaning
- Offensive stereotypes

### Step 4: Regenerate all 400 Japanese N3 vocab descriptions

Run the updated generator with `--language ja --reset` to regenerate all Japanese vocab visual descriptions with the new Japan-themed system prompt.

### Step 5: Integration with cardback-tool

Ensure the cardback generation server (`sprite-gen/cardback-tool/server.mjs`) picks up the new visual descriptions when regenerating card back art.

---

## Sub-task 9: Claude CLI Fact Generation Setup

### Purpose

Document and configure the Claude CLI workflow for generating new facts at scale. The owner will run this independently — the pipeline must be self-documenting.

### System Prompt Templates

Create system prompt files in `scripts/prompts/` for each content type:

```
scripts/prompts/
├── general-knowledge.md      # Science, History, Geography, etc.
├── vocabulary-japanese.md    # JLPT N5-N1
├── vocabulary-spanish.md     # CEFR A1-C2
├── vocabulary-french.md      # CEFR A1-C2
├── distractor-generation.md  # For generating plausible wrong answers
└── visual-description.md     # Per-language visual description prompts
```

Each prompt template must instruct Claude to:
1. Output valid JSON matching the seed data schema
2. Include `sourceName` and `sourceUrl` for every fact
3. Generate 3-4 question variants per fact
4. Generate 5+ diverse distractors per variant
5. Set appropriate `difficulty`, `ageRating`, `category` fields
6. For vocab: include `pronunciation`, `exampleSentence`, `partOfSpeech`

### Example Claude CLI Command

```bash
# Generate 50 Japanese N3 verbs with full schema
claude --model claude-sonnet-4-5-20250514 \
  --system-prompt scripts/prompts/vocabulary-japanese.md \
  --output vocab-n3-batch-002.json \
  "Generate 50 JLPT N3 Japanese verbs. Output as JSON array matching the schema."

# Validate the output
npx ts-node scripts/ingestFacts.ts --source vocab-n3-batch-002.json --domain language --verify false --dry-run

# If valid, ingest
npx ts-node scripts/ingestFacts.ts --source vocab-n3-batch-002.json --domain language --verify false

# Generate visual descriptions for the new facts
node sprite-gen/scripts/generate-visual-descriptions.mjs --language ja --file vocab-n3
```

### Documentation

Create `docs/CONTENT_PIPELINE.md` with:
- Full workflow diagram (generate → validate → ingest → visual descriptions → card art)
- Command reference for each step
- Schema reference with all required and optional fields
- Quality checklist for reviewing generated content
- Troubleshooting common validation errors

---

## Done When

- [ ] `ingestFacts.ts` script validates all required fields INCLUDING `sourceName`
- [ ] Schema validation rejects facts with missing/invalid fields or missing source
- [ ] Fuzzy matching detects >85% duplicate questions
- [ ] Distractor quality checks flag too-similar options
- [ ] Import report shows valid/invalid/duplicate counts
- [ ] Coverage report shows facts per domain, difficulty, type, age rating
- [ ] `verifiedAt` field present on facts; null for unverified
- [ ] Database migration script exports facts to sql.js format
- [ ] ALL existing vocab visual descriptions deleted and regenerated with language theming
- [ ] Per-language system prompts created for Japanese, Spanish, French (minimum)
- [ ] Anti-pattern detection rejects generic/non-themed visual descriptions
- [ ] Claude CLI system prompt templates created for fact generation
- [ ] `docs/CONTENT_PIPELINE.md` documents the full workflow end-to-end
- [ ] `npx vitest run` passes (new tests for validation logic)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
