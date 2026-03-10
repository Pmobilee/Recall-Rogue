/**
 * patch-generated-facts.mjs
 *
 * Patches facts-generated.json to ensure all required DB fields are present.
 * - type: set to "fact" if missing (generated facts use contentType instead)
 * - explanation: set to statement value if missing
 * - rarity: set to "common" if missing
 * - distractorCount: set to distractors array length if missing
 *
 * Usage: node scripts/content-pipeline/patch-generated-facts.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const FACTS_PATH = path.join(ROOT, 'src', 'data', 'seed', 'facts-generated.json');

const raw = fs.readFileSync(FACTS_PATH, 'utf-8');
const facts = JSON.parse(raw);

if (!Array.isArray(facts)) {
  console.error('[ERROR] Expected top-level JSON array');
  process.exit(1);
}

let patchedCount = 0;

for (const fact of facts) {
  let patched = false;

  // type: set to "fact" if missing
  if (!fact.type) {
    fact.type = 'fact';
    patched = true;
  }

  // explanation: fall back to statement
  if (!fact.explanation) {
    fact.explanation = fact.statement ?? '';
    patched = true;
  }

  // rarity: default to "common"
  if (!fact.rarity) {
    fact.rarity = 'common';
    patched = true;
  }

  // distractorCount: derive from distractors array length
  if (fact.distractorCount == null) {
    fact.distractorCount = Array.isArray(fact.distractors) ? fact.distractors.length : 0;
    patched = true;
  }

  if (patched) patchedCount++;
}

fs.writeFileSync(FACTS_PATH, JSON.stringify(facts, null, 2) + '\n');

console.log(`Patched ${patchedCount} of ${facts.length} facts in facts-generated.json`);
