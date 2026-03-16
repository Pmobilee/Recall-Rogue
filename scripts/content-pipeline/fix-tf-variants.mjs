#!/usr/bin/env node
/**
 * fix-tf-variants.mjs
 *
 * Fixes true/false variants with missing distractors and normalizes
 * variant answer fields for consistency.
 *
 * Usage:
 *   node scripts/content-pipeline/fix-tf-variants.mjs [--write]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const WRITE = process.argv.includes('--write');
const ROOT = process.cwd();
const seedDir = join(ROOT, 'src', 'data', 'seed');

const files = [];
for (const f of readdirSync(seedDir)) {
  if (f.endsWith('.json')) {
    files.push(join(seedDir, f));
  }
}

console.log(`[fix-tf-variants] mode=${WRITE ? 'write' : 'dry-run'}`);
console.log(`Found ${files.length} seed files\n`);

let totalTfFixes = 0;
let totalAnswerFieldFixes = 0;
let totalEmptyDistractorFixes = 0;

for (const filePath of files) {
  const fileName = filePath.split('/').pop();
  const facts = JSON.parse(readFileSync(filePath, 'utf8'));
  let tfFixes = 0;
  let answerFixes = 0;
  let emptyDistFixes = 0;
  let modified = false;

  for (const fact of facts) {
    if (!Array.isArray(fact.variants)) continue;

    for (const variant of fact.variants) {
      // Skip malformed variants (plain strings instead of objects)
      if (typeof variant !== 'object' || variant === null) continue;

      // Fix 1: Normalize answer field — ensure `answer` exists
      if (!variant.answer && variant.correctAnswer) {
        if (WRITE) variant.answer = variant.correctAnswer;
        answerFixes++;
        modified = true;
      }

      // Fix 2: true/false variants must have the opposite as distractor
      const vType = (variant.type || '').toLowerCase();
      if (vType === 'true_false' || vType === 'truefalse' || vType === 'true-false') {
        const answer = (variant.answer || variant.correctAnswer || '').trim();

        // Normalize type to consistent format
        if (WRITE && variant.type !== 'true_false') {
          variant.type = 'true_false';
          modified = true;
        }

        if (answer === 'True' || answer === 'true') {
          if (!Array.isArray(variant.distractors) || variant.distractors.length === 0 || !variant.distractors.includes('False')) {
            if (WRITE) variant.distractors = ['False'];
            tfFixes++;
            modified = true;
          }
          // Normalize answer capitalization
          if (WRITE && variant.answer !== 'True') {
            variant.answer = 'True';
            modified = true;
          }
        } else if (answer === 'False' || answer === 'false') {
          if (!Array.isArray(variant.distractors) || variant.distractors.length === 0 || !variant.distractors.includes('True')) {
            if (WRITE) variant.distractors = ['True'];
            tfFixes++;
            modified = true;
          }
          if (WRITE && variant.answer !== 'False') {
            variant.answer = 'False';
            modified = true;
          }
        }
      }

      // Fix 3: Non-true/false variants with empty distractors
      if (vType !== 'true_false' && vType !== 'truefalse' && vType !== 'true-false') {
        if (!Array.isArray(variant.distractors) || variant.distractors.length === 0) {
          // Fall back to parent fact's distractors (take first 3)
          if (Array.isArray(fact.distractors) && fact.distractors.length > 0) {
            const answer = variant.answer || variant.correctAnswer || '';
            const available = fact.distractors.filter(d => d !== answer);
            if (available.length > 0) {
              if (WRITE) variant.distractors = available.slice(0, 3);
              emptyDistFixes++;
              modified = true;
            }
          }
        }
      }
    }
  }

  const totalFileFixes = tfFixes + answerFixes + emptyDistFixes;
  if (totalFileFixes > 0) {
    console.log(`${fileName}: ${tfFixes} tf fixes, ${answerFixes} answer field fixes, ${emptyDistFixes} empty distractor fixes`);
    if (WRITE && modified) {
      writeFileSync(filePath, JSON.stringify(facts, null, 2) + '\n');
    }
  } else {
    console.log(`${fileName}: clean`);
  }

  totalTfFixes += tfFixes;
  totalAnswerFieldFixes += answerFixes;
  totalEmptyDistractorFixes += emptyDistFixes;
}

console.log(`\nSummary:`);
console.log(`  True/false distractor fixes: ${totalTfFixes}`);
console.log(`  Answer field normalizations: ${totalAnswerFieldFixes}`);
console.log(`  Empty distractor backfills: ${totalEmptyDistractorFixes}`);
console.log(`  Total fixes: ${totalTfFixes + totalAnswerFieldFixes + totalEmptyDistractorFixes}`);

if (!WRITE && (totalTfFixes + totalAnswerFieldFixes + totalEmptyDistractorFixes) > 0) {
  console.log('\nThis was a dry run. Use --write to apply fixes.');
}
