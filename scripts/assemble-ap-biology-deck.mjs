/**
 * Assembly script for the AP Biology curated deck.
 * Reads 19 WIP batch files, normalizes schema, deduplicates IDs,
 * builds pools/tiers/sub-decks/synonym-groups, and writes the final CuratedDeck envelope.
 *
 * Chain theme assignment:
 *   Facts TRUST their own chainThemeId if already set.
 *   Defaults are only applied when chainThemeId is missing/undefined.
 *
 * Default by batch (used only if fact has no chainThemeId):
 *   batches 01-02 → 0  (The Molecular Forge)
 *   batches 03-04 → 1  (Cellular Architecture)
 *   batches 05-07 → 2  (The Powerhouse)
 *   batches 08-09 → 3  (Signal & Cycle)
 *   batches 10-11 → 4  (The Inheritance Chamber)
 *   batches 12-14 → 5  (The Code Vault)
 *   batches 15-17 → 6  (Evolution Engine)
 *   batches 18-19 → 7  (The Living Web)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIP_DIR = path.join(ROOT, 'data/decks/_wip');
const OUT_PATH = path.join(ROOT, 'data/decks/ap_biology.json');
const MANIFEST_PATH = path.join(ROOT, 'data/decks/manifest.json');

// ── Fields to remove ────────────────────────────────────────────────────────
const REMOVE_FIELDS = new Set([
  '_haikuProcessed', 'noveltyScore', 'rarity', 'sourceVerified',
  'contentVolatility', 'sensitivityLevel', 'sensitivityNote',
  'type', 'domain', 'subdomain', '_batchNum',
]);

// ── Pool metadata: label + answerFormat per pool ID ──────────────────────────
const POOL_METADATA = {
  molecule_names:           { label: 'Molecule / Macromolecule',   answerFormat: 'term' },
  organelle_structures:     { label: 'Organelle / Cell Structure',  answerFormat: 'term' },
  process_names:            { label: 'Biological Process',          answerFormat: 'term' },
  enzyme_names:             { label: 'Enzyme',                      answerFormat: 'term' },
  bio_concept_terms:        { label: 'Biology Concept',             answerFormat: 'term' },
  organism_names:           { label: 'Organism',                    answerFormat: 'term' },
  evolution_terms:          { label: 'Evolution Term',              answerFormat: 'term' },
  ecology_terms:            { label: 'Ecology Term',                answerFormat: 'term' },
  genetics_terms:           { label: 'Genetics Term',               answerFormat: 'term' },
  cycle_phase_names:        { label: 'Cell Cycle Phase',            answerFormat: 'term' },
  equation_terms:           { label: 'Equation / Formula',          answerFormat: 'term' },
  bracket_numbers:          { label: 'Number / Value',              answerFormat: 'number' },
  researcher_names:         { label: 'Biologist / Researcher',      answerFormat: 'name' },
  signal_molecule_names:    { label: 'Signal Molecule',             answerFormat: 'term' },
  structure_function_terms: { label: 'Structure-Function Term',     answerFormat: 'term' },
};

// ── ageGroup mapping ─────────────────────────────────────────────────────────
function normalizeAgeGroup(val) {
  if (val === 'kid') return 'all';
  if (val === 'teen') return 'teen+';
  if (val === 'adult') return 'teen+';
  if (val === 'teen+') return 'teen+';
  return 'all';
}

// ── Load a file — handle both flat array and envelope with .facts ────────────
function loadFile(filename) {
  const fullPath = path.join(WIP_DIR, filename);
  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.facts)) return raw.facts;
  throw new Error(`Unexpected format in ${filename}`);
}

// ── Normalize a single fact, preserving chainThemeId if present ──────────────
function normalizeFact(fact, defaultChainThemeId) {
  const out = {};

  out.id = fact.id;
  out.correctAnswer = fact.correctAnswer ?? '';
  out.acceptableAlternatives = fact.acceptableAlternatives ?? [];
  // Trust the fact's own chainThemeId; fall back to batch default only if absent
  out.chainThemeId = (fact.chainThemeId !== undefined && fact.chainThemeId !== null)
    ? fact.chainThemeId
    : defaultChainThemeId;
  out.answerTypePoolId = fact.answerTypePoolId ?? 'bio_concept_terms';
  out.difficulty = fact.difficulty ?? 3;
  out.funScore = fact.funScore ?? 5;
  out.ageGroup = normalizeAgeGroup(fact.ageGroup);
  out.distractors = fact.distractors ?? [];
  out.quizQuestion = fact.quizQuestion ?? '';
  out.explanation = fact.explanation ?? '';
  out.statement = fact.statement ?? '';
  out.wowFactor = fact.wowFactor ?? '';
  out.sourceName = fact.sourceName ?? 'Wikipedia';
  out.sourceUrl = fact.sourceUrl ?? 'https://en.wikipedia.org/wiki/AP_Biology';
  out.volatile = fact.volatile ?? false;
  out.categoryL1 = fact.categoryL1 ?? 'natural_sciences';
  out.categoryL2 = fact.categoryL2 ?? 'biology';
  out.variants = fact.variants ?? [];
  out.tags = fact.tags ?? [];
  out.visualDescription = fact.visualDescription ?? '';

  // Copy any remaining fields not in REMOVE_FIELDS and not already set
  for (const [k, v] of Object.entries(fact)) {
    if (!REMOVE_FIELDS.has(k) && !(k in out)) {
      out[k] = v;
    }
  }

  return out;
}

// ── Main assembly ─────────────────────────────────────────────────────────────
console.log('Loading WIP files...');

// Each tuple: [filename, defaultChainThemeId]
const BATCH_CONFIG = [
  ['ap_bio_01_water_elements.json',            0],  // Unit 1: The Molecular Forge
  ['ap_bio_02_macromolecules.json',            0],
  ['ap_bio_03_cell_structure.json',            1],  // Unit 2: Cellular Architecture
  ['ap_bio_04_membrane_transport.json',        1],
  ['ap_bio_05_enzymes.json',                   2],  // Unit 3: The Powerhouse
  ['ap_bio_06_photosynthesis.json',            2],
  ['ap_bio_07_respiration.json',               2],
  ['ap_bio_08_cell_communication.json',        3],  // Unit 4: Signal & Cycle
  ['ap_bio_09_cell_cycle.json',                3],
  ['ap_bio_10_meiosis.json',                   4],  // Unit 5: The Inheritance Chamber
  ['ap_bio_11_mendelian_genetics.json',        4],
  ['ap_bio_12_dna_rna_structure.json',         5],  // Unit 6: The Code Vault
  ['ap_bio_13_replication_transcription.json', 5],
  ['ap_bio_14_translation_regulation.json',    5],
  ['ap_bio_15_natural_selection.json',         6],  // Unit 7: Evolution Engine
  ['ap_bio_16_population_genetics.json',       6],
  ['ap_bio_17_evidence_speciation.json',       6],
  ['ap_bio_18_ecology_populations.json',       7],  // Unit 8: The Living Web
  ['ap_bio_19_communities_biodiversity.json',  7],
];

const batchData = BATCH_CONFIG.map(([filename, defaultTheme]) => {
  const facts = loadFile(filename);
  console.log(`  ${filename}: ${facts.length} facts`);
  return { filename, defaultTheme, facts };
});

const totalRaw = batchData.reduce((sum, b) => sum + b.facts.length, 0);
console.log(`\nTotal raw facts: ${totalRaw}`);

// ── Normalize all facts ───────────────────────────────────────────────────────
console.log('\nNormalizing facts...');

const normalizedBatches = batchData.map(b => ({
  ...b,
  normalized: b.facts.map(f => normalizeFact(f, b.defaultTheme)),
}));

const allFacts = normalizedBatches.flatMap(b => b.normalized);
console.log(`Total facts before dedup: ${allFacts.length}`);

// ── Deduplicate IDs ───────────────────────────────────────────────────────────
const seenIds = new Map(); // id → count
const dedupedFacts = [];
for (const fact of allFacts) {
  if (seenIds.has(fact.id)) {
    const count = seenIds.get(fact.id) + 1;
    seenIds.set(fact.id, count);
    const newId = `${fact.id}_${count}`;
    console.warn(`  DUPE ID: ${fact.id} → renamed to ${newId}`);
    dedupedFacts.push({ ...fact, id: newId });
  } else {
    seenIds.set(fact.id, 1);
    dedupedFacts.push(fact);
  }
}

console.log(`Total facts after dedup: ${dedupedFacts.length}`);

// ── Build answer type pools ───────────────────────────────────────────────────
console.log('\nBuilding answer type pools...');

const poolMap = new Map(); // poolId → { correctAnswers: Set, factIds: [] }
for (const fact of dedupedFacts) {
  const pid = fact.answerTypePoolId;
  if (!poolMap.has(pid)) {
    poolMap.set(pid, { correctAnswers: new Set(), factIds: [] });
  }
  const pool = poolMap.get(pid);
  pool.correctAnswers.add(fact.correctAnswer);
  pool.factIds.push(fact.id);
}

// Build pool objects in defined order (known pools first, then any extras)
const KNOWN_POOL_ORDER = [
  'molecule_names',
  'organelle_structures',
  'process_names',
  'enzyme_names',
  'bio_concept_terms',
  'organism_names',
  'evolution_terms',
  'ecology_terms',
  'genetics_terms',
  'cycle_phase_names',
  'equation_terms',
  'bracket_numbers',
  'researcher_names',
  'signal_molecule_names',
  'structure_function_terms',
];

const answerTypePools = [];

// Add known pools in order (skip if not populated)
for (const pid of KNOWN_POOL_ORDER) {
  if (!poolMap.has(pid)) continue;
  const data = poolMap.get(pid);
  const meta = POOL_METADATA[pid] ?? { label: pid, answerFormat: 'term' };
  answerTypePools.push({
    id: pid,
    label: meta.label,
    answerFormat: meta.answerFormat,
    factIds: data.factIds,
    minimumSize: 5,
  });
  poolMap.delete(pid); // mark as consumed
}

// Add any unexpected/extra pools at the end
for (const [pid, data] of poolMap.entries()) {
  const meta = POOL_METADATA[pid] ?? { label: pid, answerFormat: 'term' };
  console.warn(`  UNKNOWN POOL: ${pid} (${data.factIds.length} facts) — added with defaults`);
  answerTypePools.push({
    id: pid,
    label: meta.label,
    answerFormat: meta.answerFormat,
    factIds: data.factIds,
    minimumSize: 5,
  });
}

console.log(`Pools built: ${answerTypePools.length}`);
answerTypePools.forEach(p =>
  console.log(`  ${p.id}: ${p.factIds.length} facts`)
);

// ── Build difficulty tiers ────────────────────────────────────────────────────
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

console.log('\nDifficulty tiers:');
difficultyTiers.forEach(t => console.log(`  ${t.tier}: ${t.factIds.length}`));

// ── Build sub-decks from chainThemeId groupings ───────────────────────────────
const CHAIN_THEMES = [
  { id: 0, name: 'The Molecular Forge',     subDeckId: 'molecular_forge' },
  { id: 1, name: 'Cellular Architecture',   subDeckId: 'cellular_architecture' },
  { id: 2, name: 'The Powerhouse',          subDeckId: 'the_powerhouse' },
  { id: 3, name: 'Signal & Cycle',          subDeckId: 'signal_cycle' },
  { id: 4, name: 'The Inheritance Chamber', subDeckId: 'inheritance_chamber' },
  { id: 5, name: 'The Code Vault',          subDeckId: 'code_vault' },
  { id: 6, name: 'Evolution Engine',        subDeckId: 'evolution_engine' },
  { id: 7, name: 'The Living Web',          subDeckId: 'living_web' },
];

const themeFactMap = new Map(); // chainThemeId → factId[]
for (const theme of CHAIN_THEMES) {
  themeFactMap.set(theme.id, []);
}

for (const fact of dedupedFacts) {
  const tid = fact.chainThemeId;
  if (!themeFactMap.has(tid)) {
    console.warn(`  UNKNOWN chainThemeId ${tid} on fact ${fact.id} — skipped from sub-decks`);
    continue;
  }
  themeFactMap.get(tid).push(fact.id);
}

const subDecks = CHAIN_THEMES.map(theme => ({
  id: theme.subDeckId,
  name: theme.name,
  factIds: themeFactMap.get(theme.id),
}));

console.log('\nSub-decks (by chain theme):');
subDecks.forEach(s => console.log(`  ${s.id}: ${s.factIds.length} facts`));

// ── Compute synonym groups ─────────────────────────────────────────────────────
// Two facts are synonyms if their acceptableAlternatives overlap with each other's
// correctAnswer or acceptableAlternatives.
console.log('\nComputing synonym groups...');

const synonymGroups = [];
// Build a map: answer string → fact IDs that accept it
const answerToFactIds = new Map();
for (const fact of dedupedFacts) {
  const allAnswers = [fact.correctAnswer, ...fact.acceptableAlternatives]
    .map(a => a.toLowerCase().trim())
    .filter(a => a.length > 0);
  for (const ans of allAnswers) {
    if (!answerToFactIds.has(ans)) answerToFactIds.set(ans, []);
    answerToFactIds.get(ans).push(fact.id);
  }
}

// Find clusters of facts that share an answer string
const visited = new Set();
let synonymGroupCounter = 0;
for (const [, factIds] of answerToFactIds.entries()) {
  if (factIds.length < 2) continue;
  const groupKey = [...factIds].sort().join('|');
  if (visited.has(groupKey)) continue;
  visited.add(groupKey);
  synonymGroupCounter++;
  synonymGroups.push({
    id: `syn_${String(synonymGroupCounter).padStart(3, '0')}`,
    factIds,
    reason: 'Shared acceptable answer string',
  });
}

console.log(`Synonym groups found: ${synonymGroups.length}`);

// ── Assemble final envelope ───────────────────────────────────────────────────
const deck = {
  id: 'ap_biology',
  name: 'AP Biology',
  domain: 'natural_sciences',
  subDomain: 'biology',
  description: 'Master every concept on the AP Biology exam — from macromolecules to ecology, aligned to the 2025-26 College Board CED.',
  minimumFacts: 320,
  targetFacts: 390,
  facts: dedupedFacts,
  answerTypePools,
  synonymGroups,
  questionTemplates: [],
  difficultyTiers,
  subDecks,
  chainThemes: CHAIN_THEMES,
};

// ── Write output ──────────────────────────────────────────────────────────────
console.log(`\nWriting ${OUT_PATH}...`);
fs.writeFileSync(OUT_PATH, JSON.stringify(deck, null, 2), 'utf-8');
console.log(`Written: ${dedupedFacts.length} facts, ${answerTypePools.length} pools, ${synonymGroups.length} synonym groups`);

// ── Update manifest ───────────────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
if (!manifest.decks.includes('ap_biology.json')) {
  manifest.decks.push('ap_biology.json');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log('Manifest updated.');
} else {
  console.log('Manifest already contains ap_biology.json');
}

console.log('\nDone!');
