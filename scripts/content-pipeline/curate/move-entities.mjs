#!/usr/bin/env node
/**
 * move-entities.mjs
 *
 * Moves flagged misclassified entities between domain entity files.
 * Run reclassify-entities.mjs --write first to flag entities.
 *
 * Usage:
 *   node scripts/content-pipeline/curate/move-entities.mjs [--write]
 *
 *   --write    Apply moves (default: dry-run)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const WRITE = process.argv.includes('--write');
const ROOT = process.cwd();

const DOMAINS = [
  'animals_wildlife',
  'art_architecture',
  'food_cuisine',
  'general_knowledge',
  'geography',
  'history',
  'human_body_health',
  'mythology_folklore',
  'natural_sciences',
  'space_astronomy'
];

console.log(`[move-entities] mode=${WRITE ? 'write' : 'dry-run'}`);
console.log('');

// Load all entity files
const domainData = {};
for (const domain of DOMAINS) {
  const filePath = join(ROOT, 'data', 'curated', domain, 'entities.json');
  if (existsSync(filePath)) {
    domainData[domain] = {
      path: filePath,
      entities: JSON.parse(readFileSync(filePath, 'utf8')),
      modified: false
    };
  }
}

let moveCount = 0;
let skipCount = 0;
const moves = [];

// Find and process flagged entities
for (const [sourceDomain, data] of Object.entries(domainData)) {
  const toRemove = [];

  for (let i = 0; i < data.entities.length; i++) {
    const entity = data.entities[i];

    // Handle skip-flagged entities (leave in place, just count)
    if (entity.skip) {
      skipCount++;
      continue;
    }

    // Handle domain mismatch entities
    if (!entity.domainMismatch || !entity.suggestedDomain) continue;

    const targetDomain = entity.suggestedDomain;

    // Validate target domain exists
    if (!domainData[targetDomain]) {
      console.log(`  [ERROR] Target domain "${targetDomain}" not found for ${entity.label}`);
      continue;
    }

    // Check for duplicate qid in target
    const targetEntities = domainData[targetDomain].entities;
    const duplicate = targetEntities.find(e => e.qid === entity.qid);
    if (duplicate) {
      console.log(`  [SKIP-DUP] ${entity.label} (${entity.qid}) already exists in ${targetDomain}`);
      continue;
    }

    // Prepare the moved entity
    const movedEntity = { ...entity };
    delete movedEntity.domainMismatch;
    delete movedEntity.suggestedDomain;
    movedEntity.processed = false; // Reset — needs generation in new domain
    movedEntity.movedFrom = sourceDomain;
    movedEntity.movedAt = new Date().toISOString();
    // Reset subcategory — will need reassignment for new domain
    movedEntity.subcategory = '';

    moves.push({
      label: entity.label,
      qid: entity.qid,
      from: sourceDomain,
      to: targetDomain
    });

    // Add to target domain
    targetEntities.push(movedEntity);
    domainData[targetDomain].modified = true;

    // Mark for removal from source
    toRemove.push(i);
    moveCount++;

    console.log(`  [MOVE] ${entity.label}: ${sourceDomain} → ${targetDomain}`);
  }

  // Remove moved entities from source (reverse order to preserve indices)
  if (toRemove.length > 0) {
    for (const idx of toRemove.reverse()) {
      data.entities.splice(idx, 1);
    }
    data.modified = true;
  }
}

// Write modified files
if (WRITE) {
  for (const [domain, data] of Object.entries(domainData)) {
    if (data.modified) {
      writeFileSync(data.path, JSON.stringify(data.entities, null, 2) + '\n');
      console.log(`  [WRITTEN] ${data.path} (${data.entities.length} entities)`);
    }
  }
}

// Summary
console.log('');
console.log('='.repeat(60));
console.log('MOVE SUMMARY');
console.log('='.repeat(60));
console.log(`Entities moved: ${moveCount}`);
console.log(`Entities flagged to skip: ${skipCount}`);
console.log('');

if (moves.length > 0) {
  console.log('Moves:');
  for (const m of moves) {
    console.log(`  ${m.label} (${m.qid}): ${m.from} → ${m.to}`);
  }
}

// Show new entity counts per domain
console.log('');
console.log('Entity counts after moves:');
for (const [domain, data] of Object.entries(domainData)) {
  const total = data.entities.length;
  const unprocessed = data.entities.filter(e => !e.processed && !e.skip).length;
  console.log(`  ${domain}: ${total} total, ${unprocessed} unprocessed`);
}

if (!WRITE) {
  console.log('');
  console.log('This was a dry run. Use --write to apply moves.');
}
