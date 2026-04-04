/**
 * Assembly script for the AP Biology curated deck.
 * Merges 16 WIP batch files (788 facts) with the existing ap_biology.json (363 facts),
 * deduplicates by ID (WIP wins on conflict), normalizes schema, and rebuilds
 * pools, tiers, sub-decks, and chainThemes for the final CuratedDeck envelope.
 *
 * Usage: node scripts/assemble-apbio-deck.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIP_DIR = path.join(ROOT, 'data/decks/_wip');
const EXISTING_PATH = path.join(ROOT, 'data/decks/ap_biology.json');
const OUT_PATH = path.join(ROOT, 'data/decks/ap_biology.json');
const MANIFEST_PATH = path.join(ROOT, 'data/decks/manifest.json');

// ── Fields to strip from normalized output ────────────────────────────────────
const REMOVE_FIELDS = new Set([
  '_haikuProcessed', 'noveltyScore', 'rarity', 'sourceVerified',
  'contentVolatility', 'sensitivityLevel', 'sensitivityNote',
  'type', 'synonymRoots', '_batchNum', 'statement', 'wowFactor',
  'variants', 'tags', 'ageGroup',
]);

// ── Load a file — handles flat array or envelope with .facts ─────────────────
function loadFile(filename, dir) {
  const fullPath = path.join(dir, filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.facts)) return raw.facts;
  throw new Error(`Unexpected format in ${filename}`);
}

// ── Normalize a single fact to the canonical AP Bio schema ───────────────────
function normalizeFact(fact) {
  const out = {};

  out.id = fact.id;
  out.correctAnswer = fact.correctAnswer ?? '';
  out.acceptableAlternatives = fact.acceptableAlternatives ?? [];
  out.chainThemeId = typeof fact.chainThemeId === 'number' ? fact.chainThemeId : 0;
  out.answerTypePoolId = fact.answerTypePoolId ?? 'term_definitions';
  out.difficulty = Math.min(5, Math.max(1, fact.difficulty ?? 3));
  out.funScore = Math.min(10, Math.max(1, fact.funScore ?? 5));
  out.quizQuestion = fact.quizQuestion ?? '';
  out.explanation = fact.explanation ?? '';
  out.visualDescription = fact.visualDescription ?? '';
  out.sourceName = fact.sourceName ?? 'OpenStax Biology 2e';
  out.sourceUrl = fact.sourceUrl ?? 'https://openstax.org/books/biology-2e';
  out.distractors = fact.distractors ?? [];
  out.volatile = fact.volatile ?? false;
  out.categoryL1 = fact.categoryL1 ?? 'natural_sciences';
  out.categoryL2 = fact.categoryL2 ?? 'biology';

  // Normalize examTags — existing deck uses object form, WIP batches use array form
  if (Array.isArray(fact.examTags)) {
    // Convert array like ["AP_Biology", "AP_Bio_Unit1"] to a minimal object
    const unitMatch = fact.examTags.find(t => t.startsWith('AP_Bio_Unit'));
    const unitNum = unitMatch ? parseInt(unitMatch.replace('AP_Bio_Unit', ''), 10) : null;
    out.examTags = {
      unit: unitNum,
      topic: null,
      exam_weight: 'medium',
      big_idea: null,
      is_equation_fact: false,
      is_lab_fact: false,
    };
  } else if (fact.examTags && typeof fact.examTags === 'object') {
    out.examTags = fact.examTags;
  } else {
    out.examTags = {
      unit: null,
      topic: null,
      exam_weight: 'medium',
      big_idea: null,
      is_equation_fact: false,
      is_lab_fact: false,
    };
  }

  // Copy any remaining fields not in REMOVE_FIELDS and not already set
  for (const [k, v] of Object.entries(fact)) {
    if (!REMOVE_FIELDS.has(k) && !(k in out)) {
      out[k] = v;
    }
  }

  return out;
}

// ── chainThemeId → subDeckId / unit mapping ───────────────────────────────────
// WIP batches use themes 0-17; existing deck used 0-7 with different boundaries.
// We re-map everything to consistent unit sub-decks.
function chainThemeToSubDeckId(chainThemeId) {
  if (chainThemeId <= 2) return 'unit1_chemistry_of_life';
  if (chainThemeId <= 4) return 'unit2_cell_structure';
  if (chainThemeId <= 6) return 'unit3_cellular_energetics';
  if (chainThemeId <= 8) return 'unit4_cell_communication';
  if (chainThemeId <= 10) return 'unit5_heredity';
  if (chainThemeId <= 13) return 'unit6_gene_expression';
  if (chainThemeId <= 15) return 'unit7_evolution';
  return 'unit8_ecology';
}

// ── 18 chainThemes for WIP-aligned deck (themes 0-17) ────────────────────────
const CHAIN_THEMES = [
  { id: 0,  name: 'The Molecular Forge',       subDeckId: 'unit1_chemistry_of_life' },
  { id: 1,  name: 'Cellular Architecture',      subDeckId: 'unit1_chemistry_of_life' },
  { id: 2,  name: 'The Powerhouse',             subDeckId: 'unit1_chemistry_of_life' },
  { id: 3,  name: 'Signal & Cycle',             subDeckId: 'unit2_cell_structure' },
  { id: 4,  name: 'The Inheritance Chamber',    subDeckId: 'unit2_cell_structure' },
  { id: 5,  name: 'The Code Vault',             subDeckId: 'unit3_cellular_energetics' },
  { id: 6,  name: 'Evolution Engine',           subDeckId: 'unit3_cellular_energetics' },
  { id: 7,  name: 'The Living Web',             subDeckId: 'unit4_cell_communication' },
  { id: 8,  name: 'Cell Division Architects',   subDeckId: 'unit4_cell_communication' },
  { id: 9,  name: 'Gene Flow Navigators',       subDeckId: 'unit5_heredity' },
  { id: 10, name: 'Heredity Detectives',        subDeckId: 'unit5_heredity' },
  { id: 11, name: 'The Expression Matrix',      subDeckId: 'unit6_gene_expression' },
  { id: 12, name: 'Mutation Mechanics',         subDeckId: 'unit6_gene_expression' },
  { id: 13, name: 'Biotechnology Lab',          subDeckId: 'unit6_gene_expression' },
  { id: 14, name: 'Natural Selection Arena',    subDeckId: 'unit7_evolution' },
  { id: 15, name: 'Speciation Frontiers',       subDeckId: 'unit7_evolution' },
  { id: 16, name: 'Population Dynamics',        subDeckId: 'unit8_ecology' },
  { id: 17, name: 'Ecosystem Architects',       subDeckId: 'unit8_ecology' },
];

// ── WIP batch file list ───────────────────────────────────────────────────────
const WIP_FILES = [
  'apbio_unit1_batch1.json',
  'apbio_unit1_batch2.json',
  'apbio_unit2_batch1.json',
  'apbio_unit3_batch1.json',
  'apbio_unit3_batch2.json',
  'apbio_unit4_batch1.json',
  'apbio_unit4_t2.json',
  'apbio_unit4_batch2.json',
  'apbio_unit5_batch1.json',
  'apbio_unit6_batch1.json',
  'apbio_unit7_batch1.json',
  'apbio_unit7_batch2.json',
  'apbio_unit7_batch3.json',
  'apbio_unit8_batch1.json',
  'apbio_unit8_batch2.json',
  'apbio_unit8_batch3.json',
];

// ── Main assembly ─────────────────────────────────────────────────────────────

console.log('=== AP Biology Deck Assembly ===\n');

// Step 1: Load WIP files (these take priority on ID conflicts)
console.log('Loading WIP batch files...');
const wipFacts = [];
for (const filename of WIP_FILES) {
  const facts = loadFile(filename, WIP_DIR);
  console.log(`  ${filename}: ${facts.length} facts`);
  wipFacts.push(...facts);
}
console.log(`WIP total: ${wipFacts.length} facts\n`);

// Step 2: Load existing deck
console.log('Loading existing ap_biology.json...');
const existing = JSON.parse(fs.readFileSync(EXISTING_PATH, 'utf-8'));
const existingFacts = existing.facts ?? [];
const existingSynonymGroups = existing.synonymGroups ?? [];
console.log(`Existing deck: ${existingFacts.length} facts, ${existingSynonymGroups.length} synonym groups\n`);

// Step 3: Build ID priority map — WIP wins on conflicts
// Process WIP first, then fill in existing facts whose IDs aren't already covered
const wipIdSet = new Set(wipFacts.map(f => f.id));
const overlaps = existingFacts.filter(f => wipIdSet.has(f.id));
const existingOnlyFacts = existingFacts.filter(f => !wipIdSet.has(f.id));

console.log(`ID overlap (WIP wins): ${overlaps.length} facts replaced from existing deck`);
console.log(`Existing-only facts (kept): ${existingOnlyFacts.length} facts\n`);

// Combine: WIP first, then existing-only
const combinedRaw = [...wipFacts, ...existingOnlyFacts];

// Step 4: Normalize all facts
console.log('Normalizing facts...');
const normalizedFacts = combinedRaw.map(normalizeFact);

// Step 5: Deduplicate by ID — within WIP there is 1 known duplicate
// First occurrence wins (WIP files are loaded in unit order, so earlier unit wins)
console.log('Deduplicating...');
const seenIds = new Map(); // id → count
const dedupedFacts = [];
let dupeCount = 0;

for (const fact of normalizedFacts) {
  if (seenIds.has(fact.id)) {
    const count = seenIds.get(fact.id) + 1;
    seenIds.set(fact.id, count);
    const newId = `${fact.id}_dup${count}`;
    console.warn(`  DUPE ID: ${fact.id} → renamed to ${newId}`);
    dedupedFacts.push({ ...fact, id: newId });
    dupeCount++;
  } else {
    seenIds.set(fact.id, 1);
    dedupedFacts.push(fact);
  }
}

console.log(`Total facts after dedup: ${dedupedFacts.length} (${dupeCount} renamed duplicates)\n`);

// Step 6: Build answer type pools from facts
console.log('Building answer type pools...');
const poolMap = new Map(); // poolId → { members: Set<string>, factIds: string[] }

for (const fact of dedupedFacts) {
  const pid = fact.answerTypePoolId;
  if (!poolMap.has(pid)) {
    poolMap.set(pid, { members: new Set(), factIds: [] });
  }
  const pool = poolMap.get(pid);
  if (fact.correctAnswer) pool.members.add(fact.correctAnswer);
  pool.factIds.push(fact.id);
}

const answerTypePools = [];
for (const [pid, data] of poolMap.entries()) {
  answerTypePools.push({
    id: pid,
    members: [...data.members].sort(),
    factIds: data.factIds,
    minimumSize: 5,
  });
}

// Sort pools by id for stability
answerTypePools.sort((a, b) => a.id.localeCompare(b.id));

console.log(`Pools built: ${answerTypePools.length}`);
for (const p of answerTypePools) {
  const warn = p.factIds.length < 5 ? ' *** UNDER MINIMUM ***' : '';
  console.log(`  ${p.id}: ${p.factIds.length} facts, ${p.members.length} members${warn}`);
}

// Step 7: Build difficulty tiers
console.log('\nBuilding difficulty tiers...');
const difficultyTiers = [
  {
    tier: 'easy',
    factIds: dedupedFacts.filter(f => f.difficulty <= 2).map(f => f.id),
  },
  {
    tier: 'medium',
    factIds: dedupedFacts.filter(f => f.difficulty === 3).map(f => f.id),
  },
  {
    tier: 'hard',
    factIds: dedupedFacts.filter(f => f.difficulty >= 4).map(f => f.id),
  },
];
for (const t of difficultyTiers) {
  console.log(`  ${t.tier}: ${t.factIds.length} facts`);
}

// Step 8: Build sub-decks by chainThemeId ranges
console.log('\nBuilding sub-decks...');

const subDeckDefs = [
  { id: 'unit1_chemistry_of_life', name: 'Unit 1: Chemistry of Life',      themeRange: [0, 2] },
  { id: 'unit2_cell_structure',    name: 'Unit 2: Cell Structure',          themeRange: [3, 4] },
  { id: 'unit3_cellular_energetics', name: 'Unit 3: Cellular Energetics',  themeRange: [5, 6] },
  { id: 'unit4_cell_communication', name: 'Unit 4: Cell Communication',    themeRange: [7, 8] },
  { id: 'unit5_heredity',          name: 'Unit 5: Heredity',               themeRange: [9, 10] },
  { id: 'unit6_gene_expression',   name: 'Unit 6: Gene Expression',        themeRange: [11, 13] },
  { id: 'unit7_evolution',         name: 'Unit 7: Natural Selection & Evolution', themeRange: [14, 15] },
  { id: 'unit8_ecology',           name: 'Unit 8: Ecology',                themeRange: [16, 17] },
];

// Existing deck facts (ids 0-7) don't map directly — assign them via chainThemeToSubDeckId
const subDecks = subDeckDefs.map(def => {
  const [lo, hi] = def.themeRange;
  const factIds = dedupedFacts
    .filter(f => f.chainThemeId >= lo && f.chainThemeId <= hi)
    .map(f => f.id);
  return {
    id: def.id,
    name: def.name,
    factIds,
  };
});

// Account for existing deck facts that use old chainThemeId 0-7 mapping
// The existing deck's chainThemeIds (0-7) map differently than WIP's (0-17).
// Since we've already normalized, facts from the existing-only pool may have
// chainThemeId 0-7. We need to flag any that fall into gaps.
const coveredBySubDecks = new Set(subDecks.flatMap(s => s.factIds));
const uncovered = dedupedFacts.filter(f => !coveredBySubDecks.has(f.id));
if (uncovered.length > 0) {
  console.warn(`  WARNING: ${uncovered.length} facts not assigned to any sub-deck — assigning to unit1`);
  subDecks[0].factIds.push(...uncovered.map(f => f.id));
}

for (const s of subDecks) {
  console.log(`  ${s.id}: ${s.factIds.length} facts`);
}

// Step 9: Assemble the final deck envelope
console.log('\nAssembling final deck envelope...');

const deck = {
  id: 'ap_biology',
  name: 'AP Biology',
  domain: 'natural_sciences',
  subDomain: 'biology',
  description: 'Master every concept tested on the AP Biology exam — from molecular chemistry to ecosystem ecology. Aligned to the College Board Course and Exam Description.',
  minimumFacts: 600,
  targetFacts: 1100,
  facts: dedupedFacts,
  answerTypePools,
  synonymGroups: existingSynonymGroups,
  questionTemplates: [],
  difficultyTiers,
  subDecks,
  chainThemes: CHAIN_THEMES,
};

// Step 10: Write output
console.log(`\nWriting ${OUT_PATH}...`);
fs.writeFileSync(OUT_PATH, JSON.stringify(deck, null, 2) + '\n', 'utf-8');

// Step 11: Update manifest (ensure entry exists)
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
if (!manifest.decks.includes('ap_biology.json')) {
  manifest.decks.push('ap_biology.json');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log('Manifest updated.');
} else {
  console.log('ap_biology.json already in manifest.');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n=== Assembly Summary ===');
console.log(`Total facts: ${dedupedFacts.length}`);
console.log(`  WIP batch facts: ${wipFacts.length}`);
console.log(`  Existing-only facts kept: ${existingOnlyFacts.length}`);
console.log(`  Overlapping IDs replaced by WIP: ${overlaps.length}`);
console.log(`  Renamed duplicates: ${dupeCount}`);
console.log(`Answer type pools: ${answerTypePools.length}`);
console.log(`Chain themes: ${CHAIN_THEMES.length}`);
console.log(`Sub-decks: ${subDecks.length}`);
console.log(`Synonym groups carried over: ${existingSynonymGroups.length}`);
console.log('\nFacts per sub-deck:');
for (const s of subDecks) {
  console.log(`  ${s.name}: ${s.factIds.length}`);
}

const poolsUnderMin = answerTypePools.filter(p => p.factIds.length < 5);
if (poolsUnderMin.length > 0) {
  console.warn(`\n*** POOLS UNDER MINIMUM (${poolsUnderMin.length}): ***`);
  for (const p of poolsUnderMin) {
    console.warn(`  ${p.id}: ${p.factIds.length} facts`);
  }
}

const factsNoDistractors = dedupedFacts.filter(f => !f.distractors || f.distractors.length === 0);
if (factsNoDistractors.length > 0) {
  console.warn(`\n*** ${factsNoDistractors.length} facts have no distractors ***`);
}

console.log('\nDone!');
