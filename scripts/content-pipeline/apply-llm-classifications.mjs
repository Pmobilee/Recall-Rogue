import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const DRY_RUN = !process.argv.includes('--write');

// Read classified files
const CLASSIFIED_DIR = resolve(ROOT, 'data/generated');
const domains = ['animals_wildlife', 'general_knowledge', 'geography', 'art_architecture', 'food_cuisine'];

const classificationMap = new Map();

for (const domain of domains) {
  const filePath = resolve(CLASSIFIED_DIR, `classified-${domain}.json`);
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  for (const item of data) {
    classificationMap.set(item.id, { categoryL2: item.categoryL2, sourceDomain: domain });
  }
}

// WRONG_DOMAIN overrides
const WRONG_DOMAIN_FIXES = {
  'genknow-b05-004': { categoryL1: 'General Knowledge', categoryL2: 'pop_culture' },
  'genknow-b05-005': { categoryL1: 'General Knowledge', categoryL2: 'pop_culture' },
  'genknow-b02-011': { categoryL1: 'General Knowledge', categoryL2: 'oddities' },
};

// Read and update seed files
const SEED_FILES = [
  'src/data/seed/facts-generated.json',
  'src/data/seed/facts-general-a.json',
  'src/data/seed/facts-general-b.json',
  'src/data/seed/facts-general-c.json',
];

let totalUpdated = 0;
let plantMoves = 0;
let wrongDomainFixes = 0;

for (const relPath of SEED_FILES) {
  const filePath = resolve(ROOT, relPath);
  const facts = JSON.parse(readFileSync(filePath, 'utf-8'));
  let fileUpdated = 0;

  for (const fact of facts) {
    const classification = classificationMap.get(fact.id);
    if (!classification) continue;

    const { categoryL2, sourceDomain } = classification;

    // Handle WRONG_DOMAIN
    if (categoryL2 === 'WRONG_DOMAIN') {
      const fix = WRONG_DOMAIN_FIXES[fact.id];
      if (fix) {
        fact.categoryL1 = fix.categoryL1;
        fact.categoryL2 = fix.categoryL2;
        if (Array.isArray(fact.category)) {
          fact.category[0] = fix.categoryL1;
          fact.category[1] = fix.categoryL2;
        }
        wrongDomainFixes++;
        fileUpdated++;
      }
      continue;
    }

    // Handle PLANT reclassification
    if (categoryL2 === 'PLANT') {
      fact.categoryL1 = 'Natural Sciences';
      fact.categoryL2 = 'botany_plants';
      if (Array.isArray(fact.category)) {
        fact.category[0] = 'Natural Sciences';
        fact.category[1] = 'botany_plants';
      }
      plantMoves++;
      fileUpdated++;
      continue;
    }

    // Normal subcategory update
    fact.categoryL2 = categoryL2;
    if (Array.isArray(fact.category)) {
      fact.category[1] = categoryL2;
    }
    fileUpdated++;
  }

  totalUpdated += fileUpdated;
  console.log(`${relPath}: ${fileUpdated} facts updated`);

  if (!DRY_RUN && fileUpdated > 0) {
    writeFileSync(filePath, JSON.stringify(facts, null, 2) + '\n');
    console.log(`  → Written`);
  }
}

console.log(`\nTotal: ${totalUpdated} facts updated`);
console.log(`  PLANT → Natural Sciences: ${plantMoves}`);
console.log(`  WRONG_DOMAIN fixes: ${wrongDomainFixes}`);
if (DRY_RUN) console.log('\n(Dry run — pass --write to apply changes)');
