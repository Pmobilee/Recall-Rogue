#!/usr/bin/env node
/**
 * fix-domain-names.mjs
 *
 * Normalizes non-canonical domain names in seed files to their canonical forms.
 * Also fixes subdomain/categoryL2 values that use display names instead of snake_case.
 *
 * Usage:
 *   node scripts/content-pipeline/fix-domain-names.mjs [--write]
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'fs';
import { join } from 'path';

const WRITE = process.argv.includes('--write');
const ROOT = process.cwd();

// Canonical domain names (display names used in DB)
const DOMAIN_MAP = {
  // Natural Sciences
  'Physics': 'Natural Sciences',
  'physics': 'Natural Sciences',
  'Science': 'Natural Sciences',
  'Science & Technology': 'Natural Sciences',
  'Biology': 'Natural Sciences',
  'biology': 'Natural Sciences',
  'Mathematics': 'Natural Sciences',
  'Math': 'Natural Sciences',
  'math': 'Natural Sciences',
  'Chemistry': 'Natural Sciences',
  'natural_sciences': 'Natural Sciences',

  // Space & Astronomy
  'Planets & Moons': 'Space & Astronomy',
  'Astronomy': 'Space & Astronomy',
  'astronomy': 'Space & Astronomy',
  'space_astronomy': 'Space & Astronomy',

  // Mythology & Folklore
  'Gods & Deities': 'Mythology & Folklore',
  'Creatures & Monsters': 'Mythology & Folklore',
  'Creation & Cosmology': 'Mythology & Folklore',
  'Folk Legends': 'Mythology & Folklore',
  'Religion & Mythology': 'Mythology & Folklore',
  'mythology_folklore': 'Mythology & Folklore',

  // Art & Architecture
  'Literary Art': 'Art & Architecture',
  'Film Art': 'Art & Architecture',
  'Architecture': 'Art & Architecture',
  'Art & Culture': 'Art & Architecture',
  'art_architecture': 'Art & Architecture',

  // Food & World Cuisine
  'Beverages': 'Food & World Cuisine',
  'Food & Cuisine': 'Food & World Cuisine',
  'food_cuisine': 'Food & World Cuisine',

  // History
  'History & Civilization': 'History',

  // General Knowledge
  'Culture': 'General Knowledge',
  'Education': 'General Knowledge',
  'Linguistics': 'General Knowledge',
  'Philosophy': 'General Knowledge',
  'Politics & Society': 'General Knowledge',
  'Religion': 'General Knowledge',
  'general_knowledge': 'General Knowledge',

  // Animals & Wildlife
  'animals_wildlife': 'Animals & Wildlife',

  // Geography
  'geography': 'Geography',

  // History
  'history': 'History',

  // Human Body & Health
  'human_body_health': 'Human Body & Health',
};

// Already-canonical names (skip these)
const CANONICAL = new Set([
  'Animals & Wildlife',
  'Art & Architecture',
  'Food & World Cuisine',
  'General Knowledge',
  'Geography',
  'History',
  'Human Body & Health',
  'Mythology & Folklore',
  'Natural Sciences',
  'Space & Astronomy',
]);

function fixDomainName(value) {
  if (!value || CANONICAL.has(value)) return null;
  const mapped = DOMAIN_MAP[value];
  if (mapped) return mapped;
  // Try case-insensitive
  const lower = value.toLowerCase();
  for (const [key, val] of Object.entries(DOMAIN_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }
  return null; // Unknown — leave as-is but report
}

// Process all seed files
const seedDir = join(ROOT, 'src', 'data', 'seed');
const files = [];
try {
  const { readdirSync } = await import('fs');
  for (const f of readdirSync(seedDir)) {
    if (f.startsWith('knowledge-') && f.endsWith('.json')) {
      files.push(join(seedDir, f));
    }
  }
  // Also check legacy seed files
  for (const f of readdirSync(seedDir)) {
    if ((f.startsWith('facts-') || f === 'tutorial.json') && f.endsWith('.json')) {
      files.push(join(seedDir, f));
    }
  }
} catch (e) {
  console.error('Error reading seed directory:', e.message);
  process.exit(1);
}

console.log(`[fix-domain-names] mode=${WRITE ? 'write' : 'dry-run'}`);
console.log(`Found ${files.length} seed files\n`);

let totalFixes = 0;
const unknownDomains = new Map();

for (const filePath of files) {
  const fileName = filePath.split('/').pop();
  const facts = JSON.parse(readFileSync(filePath, 'utf8'));
  let fixes = 0;

  for (const fact of facts) {
    // Fix domain field
    const domainFix = fixDomainName(fact.domain);
    if (domainFix) {
      if (WRITE) fact.domain = domainFix;
      fixes++;
    } else if (fact.domain && !CANONICAL.has(fact.domain)) {
      unknownDomains.set(fact.domain, (unknownDomains.get(fact.domain) || 0) + 1);
    }

    // Fix categoryL1 field
    const l1Fix = fixDomainName(fact.categoryL1);
    if (l1Fix) {
      if (WRITE) fact.categoryL1 = l1Fix;
    }

    // Ensure domain and categoryL1 match
    if (WRITE && fact.domain && fact.categoryL1 && fact.domain !== fact.categoryL1) {
      // Trust domain field, sync categoryL1
      fact.categoryL1 = fact.domain;
    }

    // Ensure subdomain matches categoryL2
    if (WRITE && fact.categoryL2 && fact.subdomain !== fact.categoryL2) {
      fact.subdomain = fact.categoryL2;
    }
  }

  if (fixes > 0) {
    console.log(`${fileName}: ${fixes} domain names fixed`);
    if (WRITE) {
      writeFileSync(filePath, JSON.stringify(facts, null, 2) + '\n');
    }
    totalFixes += fixes;
  } else {
    console.log(`${fileName}: clean`);
  }
}

console.log(`\nTotal fixes: ${totalFixes}`);

if (unknownDomains.size > 0) {
  console.log('\nUnknown domain names (not in mapping):');
  for (const [name, count] of unknownDomains) {
    console.log(`  "${name}": ${count} facts`);
  }
}

if (!WRITE && totalFixes > 0) {
  console.log('\nThis was a dry run. Use --write to apply fixes.');
}
