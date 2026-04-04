#!/usr/bin/env node
/**
 * AP World History: Modern deck assembly script.
 * Reads 9 batch files, merges, validates, and writes ap_world_history.json
 *
 * NOTE: One typo fix applied during assembly:
 *   batch_event_names -> battle_event_names (1 fact: apwh_8_011)
 *   This was a generation artifact — the correct pool ID is battle_event_names.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIP_DIR = path.join(__dirname, '../data/decks/_wip');
const OUT_FILE = path.join(__dirname, '../data/decks/ap_world_history.json');

// ─── Batch file manifest ────────────────────────────────────────────────────
const BATCHES = [
  { file: 'ap_world_sd1_batch1.json', chainThemeId: 0 },  // Unit 1: The Global Tapestry (65 facts)
  { file: 'ap_world_sd2_batch1.json', chainThemeId: 1 },  // Unit 2: Webs of Exchange (65 facts)
  { file: 'ap_world_sd3_batch1.json', chainThemeId: 2 },  // Unit 3: Empires of the Land (80 facts)
  { file: 'ap_world_sd4_batch1.json', chainThemeId: 3 },  // Unit 4: Oceans Connected (80 facts)
  { file: 'ap_world_sd5_batch1.json', chainThemeId: 4 },  // Unit 5: Age of Revolution (80 facts)
  { file: 'ap_world_sd6_batch1.json', chainThemeId: 5 },  // Unit 6: The Imperial Age (80 facts)
  { file: 'ap_world_sd7_batch1.json', chainThemeId: 6 },  // Unit 7: Global Conflict (55 facts)
  { file: 'ap_world_sd8_batch1.json', chainThemeId: 7 },  // Unit 8: Cold War and Liberation (55 facts)
  { file: 'ap_world_sd9_batch1.json', chainThemeId: 8 },  // Unit 9: The Globalized World (60 facts)
];

// ─── Pool ID typo corrections ────────────────────────────────────────────────
// Maps incorrect pool IDs found in batch files to their correct canonical IDs
const POOL_ID_CORRECTIONS = {
  'batch_event_names': 'battle_event_names',
};

// ─── Architecture: 15 answer type pools ─────────────────────────────────────
const POOL_DEFS = [
  { id: 'ruler_names',              label: 'Rulers, Emperors, Sultans, and Khans',          answerFormat: 'name' },
  { id: 'empire_dynasty_names',     label: 'Empire and Dynasty Names',                       answerFormat: 'name' },
  { id: 'revolution_leaders',       label: 'Enlightenment Thinkers and Revolutionary Figures', answerFormat: 'name' },
  { id: 'battle_event_names',       label: 'Major Battles and Pivotal Events',               answerFormat: 'name' },
  { id: 'treaty_document_names',    label: 'Treaties, Declarations, and Foundational Documents', answerFormat: 'name' },
  { id: 'date_periods',             label: 'Key Dates and Years (Bracket Notation)',          answerFormat: '{N}' },
  { id: 'concept_terms',            label: 'Political, Economic, and Social Concepts',        answerFormat: 'term' },
  { id: 'trade_goods',              label: 'Trade Commodities and Columbian Exchange Items',  answerFormat: 'name' },
  { id: 'place_names',              label: 'Cities, Regions, and Trade Routes',               answerFormat: 'name' },
  { id: 'religion_belief_terms',    label: 'Religious Movements, Philosophies, and Sects',   answerFormat: 'term' },
  { id: 'technology_inventions',    label: 'Key Technologies and Inventions',                 answerFormat: 'name' },
  { id: 'organization_names',       label: 'International Organizations and Alliances',       answerFormat: 'name' },
  { id: 'ideological_doctrine_names', label: 'Policies, Doctrines, and Ideological Programs', answerFormat: 'name' },
  { id: 'mass_atrocity_names',      label: 'Genocides, Mass Atrocities, and Humanitarian Crises', answerFormat: 'name' },
  { id: 'labor_economic_terms',     label: 'Labor Systems and Economic Arrangements',         answerFormat: 'term' },
];

// ─── Architecture: chain themes ─────────────────────────────────────────────
const CHAIN_THEMES = [
  { id: 0, name: 'The Global Tapestry',     cedUnit: 1 },
  { id: 1, name: 'Webs of Exchange',        cedUnit: 2 },
  { id: 2, name: 'Empires of the Land',     cedUnit: 3 },
  { id: 3, name: 'Oceans Connected',        cedUnit: 4 },
  { id: 4, name: 'Age of Revolution',       cedUnit: 5 },
  { id: 5, name: 'The Imperial Age',        cedUnit: 6 },
  { id: 6, name: 'Global Conflict',         cedUnit: 7 },
  { id: 7, name: 'Cold War and Liberation', cedUnit: 8 },
  { id: 8, name: 'The Globalized World',    cedUnit: 9 },
];

// ─── Architecture: sub-decks ─────────────────────────────────────────────────
const SUB_DECKS = [
  {
    id: 'sd_global_tapestry',
    name: 'The Global Tapestry (c. 1200–1450)',
    chainThemeId: 0,
    cedUnit: 1,
    examWeightPct: '8-10%',
    description: 'Song Dynasty China, Islamic empires, Southeast Asia, Americas, Africa, and medieval Europe before European overseas expansion.',
  },
  {
    id: 'sd_webs_of_exchange',
    name: 'Webs of Exchange (c. 1200–1450)',
    chainThemeId: 1,
    cedUnit: 2,
    examWeightPct: '8-10%',
    description: 'Silk Roads, Mongol Empire, Indian Ocean trade, trans-Saharan routes, and the Black Death.',
  },
  {
    id: 'sd_empires_of_the_land',
    name: 'Empires of the Land (c. 1450–1750)',
    chainThemeId: 2,
    cedUnit: 3,
    examWeightPct: '12-15%',
    description: 'Ottoman, Safavid, Mughal, Qing, and Russian empires — gunpowder, administration, and religion as statecraft.',
  },
  {
    id: 'sd_oceans_connected',
    name: 'Oceans Connected (c. 1450–1750)',
    chainThemeId: 3,
    cedUnit: 4,
    examWeightPct: '12-15%',
    description: 'European maritime expansion, Columbian Exchange, Atlantic slave trade, and colonial labor systems.',
  },
  {
    id: 'sd_age_of_revolution',
    name: 'Age of Revolution (c. 1750–1900)',
    chainThemeId: 4,
    cedUnit: 5,
    examWeightPct: '12-15%',
    description: 'Enlightenment, American/French/Haitian/Latin American revolutions, Industrial Revolution, and socialist responses.',
  },
  {
    id: 'sd_imperial_age',
    name: 'The Imperial Age (c. 1750–1900)',
    chainThemeId: 5,
    cedUnit: 6,
    examWeightPct: '12-15%',
    description: 'New Imperialism, Scramble for Africa, economic imperialism, indigenous resistance, and global migration.',
  },
  {
    id: 'sd_global_conflict',
    name: 'Global Conflict (c. 1900–present)',
    chainThemeId: 6,
    cedUnit: 7,
    examWeightPct: '8-10%',
    description: 'WWI causes and conduct, interwar period, rise of fascism, WWII, Holocaust, and mass atrocities.',
  },
  {
    id: 'sd_cold_war_liberation',
    name: 'Cold War and Liberation (c. 1900–present)',
    chainThemeId: 7,
    cedUnit: 8,
    examWeightPct: '8-10%',
    description: 'US-Soviet Cold War, spread of communism, decolonization of Asia and Africa, non-alignment, and Soviet dissolution.',
  },
  {
    id: 'sd_globalized_world',
    name: 'The Globalized World (c. 1900–present)',
    chainThemeId: 8,
    cedUnit: 9,
    examWeightPct: '8-10%',
    description: 'Technological revolution, economic globalization, climate change, resistance movements, and international institutions.',
  },
];

// ─── Load and merge all batch files ─────────────────────────────────────────
console.log('Loading batch files...');
let allFacts = [];
const batchSizes = [];

for (const { file, chainThemeId } of BATCHES) {
  const filePath = path.join(WIP_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Missing batch file: ${filePath}`);
    process.exit(1);
  }
  const facts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  batchSizes.push({ file, count: facts.length, chainThemeId });

  // Apply pool ID corrections and enforce chainThemeId
  for (const fact of facts) {
    if (POOL_ID_CORRECTIONS[fact.answerTypePoolId]) {
      const original = fact.answerTypePoolId;
      fact.answerTypePoolId = POOL_ID_CORRECTIONS[fact.answerTypePoolId];
      console.log(`  Corrected pool ID on ${fact.id}: ${original} -> ${fact.answerTypePoolId}`);
    }
    // Enforce chainThemeId matches architecture
    fact.chainThemeId = chainThemeId;
  }

  allFacts = allFacts.concat(facts);
  console.log(`  Loaded ${facts.length} facts from ${file} (chain ${chainThemeId})`);
}

console.log(`\nTotal facts loaded: ${allFacts.length}`);

// ─── Check for duplicate fact IDs ────────────────────────────────────────────
console.log('\nChecking for duplicate fact IDs...');
const idSeen = new Map();
const dupIds = [];
for (const fact of allFacts) {
  if (idSeen.has(fact.id)) {
    dupIds.push(fact.id);
  }
  idSeen.set(fact.id, true);
}
if (dupIds.length > 0) {
  console.error(`ERROR: ${dupIds.length} duplicate fact IDs found:`);
  dupIds.forEach(id => console.error(`  ${id}`));
  process.exit(1);
}
console.log('  No duplicate IDs found.');

// ─── Build answer type pools ──────────────────────────────────────────────────
console.log('\nBuilding answer type pools...');

const validPoolIds = new Set(POOL_DEFS.map(p => p.id));

// Warn on any pool IDs in facts that don't match architecture
const unknownPools = new Set();
for (const fact of allFacts) {
  if (!validPoolIds.has(fact.answerTypePoolId)) {
    unknownPools.add(fact.answerTypePoolId);
  }
}
if (unknownPools.size > 0) {
  console.warn(`WARNING: ${unknownPools.size} unrecognized pool ID(s) in facts:`);
  unknownPools.forEach(id => console.warn(`  ${id}`));
}

const answerTypePools = POOL_DEFS.map(poolDef => {
  const poolFacts = allFacts.filter(f => f.answerTypePoolId === poolDef.id);

  // Check for duplicate correctAnswer within same pool (log warnings)
  const answerCounts = new Map();
  for (const fact of poolFacts) {
    const key = fact.correctAnswer.toLowerCase().trim();
    if (!answerCounts.has(key)) answerCounts.set(key, []);
    answerCounts.get(key).push(fact.id);
  }
  for (const [answer, ids] of answerCounts) {
    if (ids.length > 1) {
      console.warn(`  WARNING: Duplicate correctAnswer "${answer}" in pool ${poolDef.id}: ${ids.join(', ')}`);
    }
  }

  // Build deduplicated sorted members array
  const membersSet = new Set(poolFacts.map(f => f.correctAnswer));
  const members = [...membersSet].sort((a, b) => a.localeCompare(b));

  return {
    id: poolDef.id,
    label: poolDef.label,
    answerFormat: poolDef.answerFormat,
    factIds: poolFacts.map(f => f.id),
    members,
    minimumSize: 5,
  };
});

// Print pool summary
for (const pool of answerTypePools) {
  console.log(`  ${pool.id}: ${pool.factIds.length} facts, ${pool.members.length} unique answers`);
}

// ─── Build difficulty tiers ────────────────────────────────────────────────
console.log('\nBuilding difficulty tiers...');
const easyIds   = allFacts.filter(f => f.difficulty <= 2).map(f => f.id);
const mediumIds = allFacts.filter(f => f.difficulty === 3).map(f => f.id);
const hardIds   = allFacts.filter(f => f.difficulty >= 4).map(f => f.id);

const difficultyTiers = [
  { tier: 'easy',   factIds: easyIds },
  { tier: 'medium', factIds: mediumIds },
  { tier: 'hard',   factIds: hardIds },
];

console.log(`  Easy (1-2):   ${easyIds.length} facts`);
console.log(`  Medium (3):   ${mediumIds.length} facts`);
console.log(`  Hard (4-5):   ${hardIds.length} facts`);

// ─── Build synonym groups ──────────────────────────────────────────────────
console.log('\nBuilding synonym groups...');
// Group facts by (poolId, normalizedAnswer) — facts with identical correctAnswer in same pool
const synonymMap = new Map();
for (const fact of allFacts) {
  const key = `${fact.answerTypePoolId}::${fact.correctAnswer.toLowerCase().trim()}`;
  if (!synonymMap.has(key)) synonymMap.set(key, []);
  synonymMap.get(key).push(fact.id);
}

const synonymGroups = [];
for (const [key, ids] of synonymMap) {
  if (ids.length > 1) {
    const [poolId, answer] = key.split('::');
    synonymGroups.push({ poolId, answer, factIds: ids });
  }
}
console.log(`  ${synonymGroups.length} synonym group(s) found`);

// ─── Assemble final deck ───────────────────────────────────────────────────
console.log('\nAssembling final deck...');

const deck = {
  id: 'ap_world_history',
  name: 'AP World History: Modern',
  domain: 'history',
  subDomain: 'world_history',
  description: 'Master the complete AP World History: Modern curriculum — from the Global Tapestry of c. 1200 to contemporary Globalization. Covers all 9 CED units: The Global Tapestry, Networks of Exchange, Land-Based Empires, Transoceanic Interconnections, Revolutions, Consequences of Industrialization, Global Conflict, Cold War and Decolonization, and Globalization. Aligned to the College Board AP World History: Modern Course and Exam Description. Emphasizes causation, continuity and change over time, comparison, and contextualization across world regions and chronological periods.',
  minimumFacts: 550,
  targetFacts: 620,
  facts: allFacts,
  answerTypePools,
  synonymGroups,
  questionTemplates: [],
  difficultyTiers,
  chainThemes: CHAIN_THEMES,
  subDecks: SUB_DECKS,
};

// ─── Write output ──────────────────────────────────────────────────────────
fs.writeFileSync(OUT_FILE, JSON.stringify(deck, null, 2));
console.log(`\nWrote: ${OUT_FILE}`);

// ─── Final summary ─────────────────────────────────────────────────────────
console.log('\n=== ASSEMBLY SUMMARY ===');
console.log(`Total facts:      ${allFacts.length}`);
console.log(`Answer pools:     ${answerTypePools.length}`);
console.log(`Chain themes:     ${CHAIN_THEMES.length}`);
console.log(`Sub-decks:        ${SUB_DECKS.length}`);
console.log(`Synonym groups:   ${synonymGroups.length}`);
console.log(`\nFacts per batch:`);
for (const { file, count, chainThemeId } of batchSizes) {
  const theme = CHAIN_THEMES.find(t => t.id === chainThemeId);
  console.log(`  ${file}: ${count} facts (${theme?.name ?? `chain ${chainThemeId}`})`);
}
console.log('\nPool breakdown:');
for (const pool of answerTypePools) {
  const bar = '█'.repeat(Math.round(pool.factIds.length / 5));
  console.log(`  ${pool.id.padEnd(28)} ${String(pool.factIds.length).padStart(3)} facts  ${bar}`);
}
console.log('\nDifficulty distribution:');
console.log(`  Easy (1-2):  ${easyIds.length} (${((easyIds.length/allFacts.length)*100).toFixed(1)}%)`);
console.log(`  Medium (3):  ${mediumIds.length} (${((mediumIds.length/allFacts.length)*100).toFixed(1)}%)`);
console.log(`  Hard (4-5):  ${hardIds.length} (${((hardIds.length/allFacts.length)*100).toFixed(1)}%)`);
