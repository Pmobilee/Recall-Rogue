#!/usr/bin/env node
/**
 * Assembly script for AP European History deck.
 * Merges 9 unit WIP files into a single CuratedDeck envelope.
 *
 * Usage: node data/decks/_wip/assemble_ap_euro.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const WIP_DIR = 'data/decks/_wip';
const OUTPUT = 'data/decks/ap_european_history.json';

const UNIT_FILES = [
  'ap_euro_u1.json',
  'ap_euro_u2.json',
  'ap_euro_u3.json',
  'ap_euro_u4.json',
  'ap_euro_u5.json',
  'ap_euro_u6.json',
  'ap_euro_u7.json',
  'ap_euro_u8.json',
  'ap_euro_u9.json',
];

const SUB_DECKS = [
  { id: 'unit1_renaissance', name: 'Unit 1: Renaissance & Exploration', prefix: 'ap_euro_u1_' },
  { id: 'unit2_reformation', name: 'Unit 2: Age of Reformation', prefix: 'ap_euro_u2_' },
  { id: 'unit3_absolutism', name: 'Unit 3: Absolutism & Constitutionalism', prefix: 'ap_euro_u3_' },
  { id: 'unit4_scientific_enlightenment', name: 'Unit 4: Scientific Revolution & Enlightenment', prefix: 'ap_euro_u4_' },
  { id: 'unit5_revolution_napoleon', name: 'Unit 5: French Revolution & Napoleon', prefix: 'ap_euro_u5_' },
  { id: 'unit6_industrialization', name: 'Unit 6: Industrialization & Its Effects', prefix: 'ap_euro_u6_' },
  { id: 'unit7_nationalism_imperialism', name: 'Unit 7: 19th-Century Nationalism & Imperialism', prefix: 'ap_euro_u7_' },
  { id: 'unit8_global_conflicts', name: 'Unit 8: 20th-Century Global Conflicts', prefix: 'ap_euro_u8_' },
  { id: 'unit9_cold_war_contemporary', name: 'Unit 9: Cold War & Contemporary Europe', prefix: 'ap_euro_u9_' },
];

// Merge all unit files
let allFacts = [];
let unitCounts = {};

for (const file of UNIT_FILES) {
  const path = join(WIP_DIR, file);
  if (!existsSync(path)) {
    console.error(`MISSING: ${path}`);
    continue;
  }
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const facts = Array.isArray(raw) ? raw : raw.facts || [];
  unitCounts[file] = facts.length;
  allFacts.push(...facts);
}

console.log('\n=== Unit Counts ===');
for (const [file, count] of Object.entries(unitCounts)) {
  console.log(`  ${file}: ${count} facts`);
}
console.log(`  TOTAL: ${allFacts.length} facts\n`);

// Normalize schema drift
let normalized = 0;
allFacts = allFacts.map(f => {
  // Ensure all required fields exist
  if (!f.acceptableAlternatives) { f.acceptableAlternatives = []; normalized++; }
  if (!f.variants) { f.variants = []; }
  if (!f.tags) { f.tags = []; }
  if (!f.visualDescription) { f.visualDescription = ''; }
  if (!f.statement) { f.statement = ''; }
  if (f.volatile === undefined) { f.volatile = false; }
  if (!f.categoryL1) { f.categoryL1 = 'history'; }
  if (!f.categoryL2) { f.categoryL2 = 'european_history'; }

  // Fix chainTheme -> chainThemeId
  if (f.chainTheme !== undefined && f.chainThemeId === undefined) {
    f.chainThemeId = f.chainTheme;
    delete f.chainTheme;
    normalized++;
  }

  // Ensure chainThemeId is 0-5
  if (typeof f.chainThemeId === 'number') {
    f.chainThemeId = f.chainThemeId % 6;
  }

  // Ensure year_dates pool facts have empty distractors
  if (f.answerTypePoolId === 'year_dates' && f.distractors && f.distractors.length > 0) {
    // Check if answer is bracket notation
    if (f.correctAnswer.match(/^\{.*\}$/)) {
      f.distractors = [];
    }
  }

  return f;
});

if (normalized > 0) console.log(`Normalized ${normalized} fields\n`);

// Dedup check
const idSet = new Set();
const dupes = [];
allFacts = allFacts.filter(f => {
  if (idSet.has(f.id)) {
    dupes.push(f.id);
    return false;
  }
  idSet.add(f.id);
  return true;
});
if (dupes.length > 0) {
  console.log(`DEDUPED ${dupes.length} duplicate IDs: ${dupes.join(', ')}\n`);
}

// Build answer type pools
const poolMap = {};
allFacts.forEach(f => {
  if (!poolMap[f.answerTypePoolId]) {
    poolMap[f.answerTypePoolId] = { factIds: [], members: new Set() };
  }
  poolMap[f.answerTypePoolId].factIds.push(f.id);
  poolMap[f.answerTypePoolId].members.add(f.correctAnswer);
});

const answerTypePools = Object.entries(poolMap).map(([id, data]) => ({
  id,
  label: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  answerFormat: id === 'year_dates' ? 'bracket_number' : 'name',
  factIds: data.factIds,
  members: [...data.members].sort(),
  minimumSize: 5,
}));

console.log('=== Pool Summary ===');
answerTypePools.forEach(p => {
  console.log(`  ${p.id}: ${p.factIds.length} facts, ${p.members.length} unique answers`);
});

// Build difficulty tiers
const easy = allFacts.filter(f => f.difficulty <= 2).map(f => f.id);
const medium = allFacts.filter(f => f.difficulty === 3).map(f => f.id);
const hard = allFacts.filter(f => f.difficulty >= 4).map(f => f.id);

console.log(`\n=== Difficulty Tiers ===`);
console.log(`  Easy (1-2): ${easy.length}`);
console.log(`  Medium (3): ${medium.length}`);
console.log(`  Hard (4-5): ${hard.length}`);

// Build sub-decks
const subDecks = SUB_DECKS.map(sd => ({
  id: sd.id,
  name: sd.name,
  factIds: allFacts.filter(f => f.id.startsWith(sd.prefix)).map(f => f.id),
}));

console.log(`\n=== Sub-Decks ===`);
subDecks.forEach(sd => {
  console.log(`  ${sd.name}: ${sd.factIds.length} facts`);
});

// Build final deck envelope
const deck = {
  id: 'ap_european_history',
  name: 'AP European History',
  domain: 'history',
  subDomain: 'european_history',
  description: 'Master the complete AP European History curriculum — from the Renaissance through contemporary Europe. Covers all 9 CED units tested on the AP Euro exam, spanning c. 1450 to the present.',
  minimumFacts: 450,
  targetFacts: 520,
  facts: allFacts,
  answerTypePools,
  synonymGroups: [],
  questionTemplates: [],
  difficultyTiers: [
    { tier: 'easy', factIds: easy },
    { tier: 'medium', factIds: medium },
    { tier: 'hard', factIds: hard },
  ],
  subDecks,
};

writeFileSync(OUTPUT, JSON.stringify(deck, null, 2));
console.log(`\n✓ Wrote ${OUTPUT} — ${allFacts.length} facts, ${answerTypePools.length} pools, ${subDecks.length} sub-decks`);
