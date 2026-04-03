#!/usr/bin/env node
/**
 * AP Chemistry deck assembly script.
 * Reads 16 batch files, normalizes, and writes ap_chemistry.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIP_DIR = path.join(__dirname, '../data/decks/_wip');
const OUT_FILE = path.join(__dirname, '../data/decks/ap_chemistry.json');

// ─── Batch file manifest ────────────────────────────────────────────────────
const BATCHES = [
  { file: 'ap_chem_sd1_batch1.json', chainThemeId: 0 },  // Unit 1 topics 1.1-1.4
  { file: 'ap_chem_sd1_batch2.json', chainThemeId: 0 },  // Unit 1 topics 1.5-1.8
  { file: 'ap_chem_sd1_batch3.json', chainThemeId: 0 },  // Unit 2 topics 2.1-2.7
  { file: 'ap_chem_sd2_batch1.json', chainThemeId: 1 },  // Unit 3 topics 3.1-3.6
  { file: 'ap_chem_sd2_batch2.json', chainThemeId: 1 },  // Unit 3 topics 3.7-3.13
  { file: 'ap_chem_sd2_batch3.json', chainThemeId: 2 },  // Unit 4 topics 4.1-4.5
  { file: 'ap_chem_sd2_batch4.json', chainThemeId: 2 },  // Unit 4 topics 4.6-4.9
  { file: 'ap_chem_sd3_batch1.json', chainThemeId: 3 },  // Unit 5 topics 5.1-5.6
  { file: 'ap_chem_sd3_batch2.json', chainThemeId: 3 },  // Unit 5 topics 5.7-5.11 + Unit 6 topics 6.1-6.3
  { file: 'ap_chem_sd3_batch3.json', chainThemeId: 3 },  // Unit 6 topics 6.4-6.9
  { file: 'ap_chem_sd4_batch1.json', chainThemeId: 4 },  // Unit 7 topics 7.1-7.7
  { file: 'ap_chem_sd4_batch2.json', chainThemeId: 4 },  // Unit 7 topics 7.8-7.14
  { file: 'ap_chem_sd4_batch3.json', chainThemeId: 4 },  // Unit 8 topics 8.1-8.5
  { file: 'ap_chem_sd4_batch4.json', chainThemeId: 4 },  // Unit 8 topics 8.6-8.10
  { file: 'ap_chem_sd5_batch1.json', chainThemeId: 5 },  // Unit 9 topics 9.1-9.6
  { file: 'ap_chem_sd5_batch2.json', chainThemeId: 5 },  // Unit 9 topics 9.7-9.11
];

// ─── Exam weight heuristic ───────────────────────────────────────────────────
function examWeight(unit) {
  // Based on AP Chemistry CED weighting (approximate)
  const weights = {
    1: 'medium', 2: 'medium',   // ~7-9% each
    3: 'high',   4: 'medium',   // ~7-9%
    5: 'high',   6: 'medium',   // ~7-9%
    7: 'high',   8: 'medium',   // ~7-9%
    9: 'medium'
  };
  return weights[unit] || 'medium';
}

// ─── Convert examTags array to object ───────────────────────────────────────
function normalizeExamTags(examTags) {
  // Already an object — return as-is
  if (examTags && !Array.isArray(examTags) && typeof examTags === 'object') {
    return examTags;
  }

  // Handle array like ["AP_Chemistry", "Unit_1", "Topic_1.1"]
  if (Array.isArray(examTags)) {
    let unit = null;
    let topic = null;
    for (const tag of examTags) {
      const unitMatch = tag.match(/Unit_(\d+)/i);
      if (unitMatch) unit = parseInt(unitMatch[1], 10);
      const topicMatch = tag.match(/Topic_([\d.]+)/i);
      if (topicMatch) topic = topicMatch[1];
    }
    return {
      unit: unit,
      topic: topic,
      exam_weight: examWeight(unit)
    };
  }

  return { unit: null, topic: null, exam_weight: 'medium' };
}

// ─── Pool label lookup ───────────────────────────────────────────────────────
const POOL_LABELS = {
  bracket_numbers: 'Numerical Values (bracket)',
  unit_and_constant_names: 'Unit and Constant Names',
  element_names: 'Element Names',
  element_symbols: 'Element Symbols',
  chemical_formulas: 'Chemical Formulas',
  compound_names: 'Compound Names',
  process_names: 'Process Names',
  property_names: 'Property Names',
  reaction_types: 'Reaction Types',
  bonding_terms: 'Bonding Terms',
  intermolecular_forces: 'Intermolecular Forces',
  periodic_trends: 'Periodic Trends',
  orbital_terms: 'Orbital and Electron Terms',
  stoichiometry_terms: 'Stoichiometry Terms',
  gas_law_terms: 'Gas Law Terms',
  solution_terms: 'Solution Terms',
  kinetics_terms: 'Kinetics Terms',
  thermodynamics_terms: 'Thermodynamics Terms',
  acid_base_equilibrium_terms: 'Acid-Base and Equilibrium Terms',
  electrochemistry_terms: 'Electrochemistry Terms',
  spectroscopy_terms: 'Spectroscopy Terms',
  nuclear_terms: 'Nuclear Chemistry Terms',
  lab_terms: 'Laboratory Terms',
  colligative_terms: 'Colligative Property Terms',
  organic_terms: 'Organic Chemistry Terms',
  redox_terms: 'Redox Terms',
};

function poolLabel(id) {
  return POOL_LABELS[id] || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function poolAnswerFormat(id) {
  if (id === 'bracket_numbers') return 'number';
  if (id.includes('formula') || id.includes('symbol')) return 'term';
  return 'name';
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const allFacts = [];
const seenIds = new Set();
let duplicateCount = 0;

for (const { file, chainThemeId } of BATCHES) {
  const filePath = path.join(WIP_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Missing file: ${filePath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const facts = Array.isArray(raw) ? raw : raw.facts || [];

  for (const fact of facts) {
    if (seenIds.has(fact.id)) {
      console.warn(`DUPLICATE ID: ${fact.id} (skipping)`);
      duplicateCount++;
      continue;
    }
    seenIds.add(fact.id);

    // Schema normalization
    fact.chainThemeId = chainThemeId;
    if (!Array.isArray(fact.acceptableAlternatives)) fact.acceptableAlternatives = [];
    if (!('synonymGroupId' in fact)) fact.synonymGroupId = null;
    if (!('volatile' in fact)) fact.volatile = false;
    fact.examTags = normalizeExamTags(fact.examTags);

    allFacts.push(fact);
  }
  console.log(`  Loaded ${facts.length} facts from ${file}`);
}

console.log(`\nTotal facts loaded: ${allFacts.length} (${duplicateCount} duplicates skipped)`);

// ─── Build answerTypePools ───────────────────────────────────────────────────
const poolMap = new Map(); // poolId -> Set of factIds, Set of correctAnswers

for (const fact of allFacts) {
  const pid = fact.answerTypePoolId;
  if (!pid) continue;
  if (!poolMap.has(pid)) {
    poolMap.set(pid, { factIds: [], answers: new Set() });
  }
  poolMap.get(pid).factIds.push(fact.id);
  poolMap.get(pid).answers.add(fact.correctAnswer);
}

const answerTypePools = [];
for (const [id, { factIds, answers }] of poolMap.entries()) {
  const members = [...answers];
  const pool = {
    id,
    label: poolLabel(id),
    answerFormat: poolAnswerFormat(id),
    factIds,
    members,
    minimumSize: 5,
  };
  answerTypePools.push(pool);
}

// Sort pools by factId count descending
answerTypePools.sort((a, b) => b.factIds.length - a.factIds.length);

// ─── Build difficultyTiers ───────────────────────────────────────────────────
const easyIds = allFacts.filter(f => f.difficulty <= 2).map(f => f.id);
const medIds  = allFacts.filter(f => f.difficulty === 3).map(f => f.id);
const hardIds = allFacts.filter(f => f.difficulty >= 4).map(f => f.id);

const difficultyTiers = [
  { tier: 'easy',   factIds: easyIds },
  { tier: 'medium', factIds: medIds  },
  { tier: 'hard',   factIds: hardIds },
];

// ─── Build subDecks ──────────────────────────────────────────────────────────
const themeGroups = {
  0: [], 1: [], 2: [], 3: [], 4: [], 5: []
};
for (const fact of allFacts) {
  themeGroups[fact.chainThemeId].push(fact.id);
}

const subDecks = [
  { id: 'sd_structure_bonding',      name: 'Structure & Bonding',       factIds: themeGroups[0] },
  { id: 'sd_intermolecular_forces',  name: 'Intermolecular Forces',     factIds: themeGroups[1] },
  { id: 'sd_reactions',              name: 'Chemical Reactions',        factIds: themeGroups[2] },
  { id: 'sd_kinetics_energy',        name: 'Kinetics & Energy',         factIds: themeGroups[3] },
  { id: 'sd_equilibrium_acids',      name: 'Equilibrium & Acids-Bases', factIds: themeGroups[4] },
  { id: 'sd_thermo_electrochemistry',name: 'Thermo & Electrochemistry', factIds: themeGroups[5] },
];

// ─── Assemble CuratedDeck ────────────────────────────────────────────────────
const deck = {
  id: 'ap_chemistry',
  name: 'AP Chemistry',
  domain: 'natural_sciences',
  subDomain: 'chemistry',
  description: 'Master the full AP Chemistry curriculum — from atomic structure to electrochemistry. Covers all 9 CED units aligned to the College Board AP Chemistry Course and Exam Description effective Fall 2024.',
  minimumFacts: 350,
  targetFacts: 400,
  facts: allFacts,
  answerTypePools,
  synonymGroups: [],
  questionTemplates: [],
  difficultyTiers,
  subDecks,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(deck, null, 2), 'utf-8');
console.log(`\nWrote: ${OUT_FILE}`);

// ─── Post-assembly validation ────────────────────────────────────────────────
console.log('\n=== POST-ASSEMBLY VALIDATION ===');

let failures = 0;
function check(label, pass, detail = '') {
  if (pass) {
    console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    failures++;
  }
}

check('answerTypePools is array', Array.isArray(deck.answerTypePools));
check('difficultyTiers is array', Array.isArray(deck.difficultyTiers));
check('Total facts', deck.facts.length >= 390, `${deck.facts.length} facts`);
check('domain is natural_sciences', deck.domain === 'natural_sciences');

// Every fact's answerTypePoolId exists in pools
const poolIds = new Set(deck.answerTypePools.map(p => p.id));
const orphanedFacts = deck.facts.filter(f => f.answerTypePoolId && !poolIds.has(f.answerTypePoolId));
check('No orphaned answerTypePoolId refs', orphanedFacts.length === 0,
  orphanedFacts.length > 0 ? `orphans: ${orphanedFacts.map(f => f.id + '/' + f.answerTypePoolId).join(', ')}` : '');

// Every pool has members
const emptyPools = deck.answerTypePools.filter(p => p.members.length === 0);
check('No empty pool members', emptyPools.length === 0,
  emptyPools.length > 0 ? `empty: ${emptyPools.map(p => p.id).join(', ')}` : '');

// No duplicate IDs
const idCount = new Map();
for (const f of deck.facts) idCount.set(f.id, (idCount.get(f.id) || 0) + 1);
const dupes = [...idCount.entries()].filter(([, n]) => n > 1);
check('No duplicate fact IDs', dupes.length === 0,
  dupes.length > 0 ? `dupes: ${dupes.map(([id]) => id).join(', ')}` : '');

// chainThemeId distribution
const themeCount = {};
for (const f of deck.facts) themeCount[f.chainThemeId] = (themeCount[f.chainThemeId] || 0) + 1;
console.log('\n  chainThemeId distribution:');
for (let i = 0; i <= 5; i++) {
  console.log(`    Theme ${i}: ${themeCount[i] || 0} facts`);
}

// Difficulty distribution
console.log('\n  Difficulty distribution:');
console.log(`    Easy (1-2):   ${easyIds.length}`);
console.log(`    Medium (3):   ${medIds.length}`);
console.log(`    Hard (4-5):   ${hardIds.length}`);

// Pool summary
console.log('\n  Pool summary (top 20):');
for (const pool of deck.answerTypePools.slice(0, 20)) {
  console.log(`    ${pool.id.padEnd(40)} members: ${String(pool.members.length).padStart(3)}  facts: ${String(pool.factIds.length).padStart(3)}`);
}

if (failures === 0) {
  console.log('\n  ALL CHECKS PASSED');
} else {
  console.error(`\n  ${failures} CHECK(S) FAILED`);
  process.exit(1);
}
