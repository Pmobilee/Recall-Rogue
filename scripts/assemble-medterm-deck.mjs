/**
 * Assembly script for the Medical Terminology curated deck.
 * Reads 17 WIP batch files, normalizes schema, deduplicates IDs,
 * builds pools/tiers/sub-decks, and writes the final CuratedDeck envelope.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIP_DIR = path.join(ROOT, 'data/decks/_wip');
const OUT_PATH = path.join(ROOT, 'data/decks/medical_terminology.json');
const MANIFEST_PATH = path.join(ROOT, 'data/decks/manifest.json');

// ── Fields to remove ────────────────────────────────────────────────────────
const REMOVE_FIELDS = new Set([
  '_haikuProcessed', 'noveltyScore', 'rarity', 'sourceVerified',
  'contentVolatility', 'sensitivityLevel', 'sensitivityNote',
  'type', 'domain', 'subdomain', 'synonymRoots', '_batchNum',
]);

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

// ── Normalize a single fact ───────────────────────────────────────────────────
function normalizeFact(fact) {
  const out = {};

  // Required fields with defaults
  out.id = fact.id;
  out.correctAnswer = fact.correctAnswer ?? '';
  out.acceptableAlternatives = fact.acceptableAlternatives ?? [];
  out.chainThemeId = fact.chainThemeId ?? 0;
  out.answerTypePoolId = fact.answerTypePoolId ?? 'misc';
  out.difficulty = fact.difficulty ?? 3;
  out.funScore = fact.funScore ?? 5;
  out.ageGroup = normalizeAgeGroup(fact.ageGroup);
  out.distractors = fact.distractors ?? [];
  out.quizQuestion = fact.quizQuestion ?? '';
  out.explanation = fact.explanation ?? '';
  out.statement = fact.statement ?? '';
  out.wowFactor = fact.wowFactor ?? '';
  out.sourceName = fact.sourceName ?? 'Wikipedia';
  out.sourceUrl = fact.sourceUrl ?? 'https://en.wikipedia.org/wiki/List_of_medical_roots,_suffixes_and_prefixes';
  out.volatile = fact.volatile ?? false;
  out.categoryL1 = fact.categoryL1 ?? 'human_body_health';
  out.categoryL2 = fact.categoryL2 ?? 'medical_science';
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

// Load each file group and track source for sub-deck building
console.log('Loading WIP files...');

const prefixFacts = loadFile('medterm_prefixes.json');
const suffixFacts = loadFile('medterm_suffixes.json');
const rootsCardioResp = loadFile('medterm_roots_cardio_resp.json');
const rootsDigestUrin = loadFile('medterm_roots_digest_urin.json');
const rootsNervMusc = loadFile('medterm_roots_nerv_musc.json');
const rootsRemaining = loadFile('medterm_roots_remaining.json');
const rootsGeneral = loadFile('medterm_roots_general.json');  // envelope — extracted above
const rootsExtra = loadFile('medterm_roots_extra.json');
const conditions1 = loadFile('medterm_conditions1.json');
const conditions2 = loadFile('medterm_conditions2.json');
const conditions3 = loadFile('medterm_conditions3.json');
const conditions4 = loadFile('medterm_conditions4.json');
const procedures = loadFile('medterm_procedures.json');
const diagnostics = loadFile('medterm_diagnostics.json');
const organNames = loadFile('medterm_organ_names.json');
const combiningForms = loadFile('medterm_combining_forms.json');
const bodySystems = loadFile('medterm_body_systems.json');

// Log raw counts
console.log(`Prefixes: ${prefixFacts.length}`);
console.log(`Suffixes: ${suffixFacts.length}`);
console.log(`Roots (cardio_resp): ${rootsCardioResp.length}`);
console.log(`Roots (digest_urin): ${rootsDigestUrin.length}`);
console.log(`Roots (nerv_musc): ${rootsNervMusc.length}`);
console.log(`Roots (remaining): ${rootsRemaining.length}`);
console.log(`Roots (general): ${rootsGeneral.length}`);
console.log(`Roots (extra): ${rootsExtra.length}`);
console.log(`Conditions 1-4: ${conditions1.length + conditions2.length + conditions3.length + conditions4.length}`);
console.log(`Procedures: ${procedures.length}`);
console.log(`Diagnostics: ${diagnostics.length}`);
console.log(`Organ names: ${organNames.length}`);
console.log(`Combining forms: ${combiningForms.length}`);
console.log(`Body systems: ${bodySystems.length}`);

// Normalize all facts
console.log('\nNormalizing facts...');

const normalizedPrefixes = prefixFacts.map(normalizeFact);
const normalizedSuffixes = suffixFacts.map(normalizeFact);
const normalizedRootsAll = [
  ...rootsCardioResp, ...rootsDigestUrin, ...rootsNervMusc,
  ...rootsRemaining, ...rootsGeneral, ...rootsExtra,
  ...organNames, ...combiningForms, ...bodySystems,
].map(normalizeFact);
const normalizedConditions = [
  ...conditions1, ...conditions2, ...conditions3, ...conditions4,
].map(normalizeFact);
const normalizedProcedures = [...procedures, ...diagnostics].map(normalizeFact);

// Concatenate all facts
const allFacts = [
  ...normalizedPrefixes,
  ...normalizedSuffixes,
  ...normalizedRootsAll,
  ...normalizedConditions,
  ...normalizedProcedures,
];

console.log(`Total facts before dedup: ${allFacts.length}`);

// ── Deduplicate IDs ──────────────────────────────────────────────────────────
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

const poolMap = new Map(); // poolId → { members: Set, factIds: [] }
for (const fact of dedupedFacts) {
  const pid = fact.answerTypePoolId;
  if (!poolMap.has(pid)) {
    poolMap.set(pid, { members: new Set(), factIds: [] });
  }
  const pool = poolMap.get(pid);
  pool.members.add(fact.correctAnswer);
  pool.factIds.push(fact.id);
}

// Build pool objects
const answerTypePools = [];
for (const [pid, data] of poolMap.entries()) {
  const pool = {
    id: pid,
    members: [...data.members].sort(),
    factIds: data.factIds,
    minimumSize: 5,
  };
  // Add syntheticDistractors to body_systems pool
  if (pid === 'body_systems') {
    pool.syntheticDistractors = ['Lymphatic', 'Immune'];
  }
  answerTypePools.push(pool);
}

console.log(`Pools built: ${answerTypePools.length}`);
answerTypePools.forEach(p => console.log(`  ${p.id}: ${p.factIds.length} facts, ${p.members.length} members`));

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

console.log(`\nDifficulty tiers:`);
difficultyTiers.forEach(t => console.log(`  ${t.tier}: ${t.factIds.length}`));

// ── Build sub-decks ───────────────────────────────────────────────────────────
// Track IDs per source group (using deduped IDs)
const normalizedPrefixIds = new Set(normalizedPrefixes.map(f => f.id));
const normalizedSuffixIds = new Set(normalizedSuffixes.map(f => f.id));

// For body_roots: we need to match against the IDs that went through dedup
// The deduped facts that came from the roots group
const rootsSourceIds = new Set([
  ...rootsCardioResp, ...rootsDigestUrin, ...rootsNervMusc,
  ...rootsRemaining, ...rootsGeneral, ...rootsExtra,
  ...organNames, ...combiningForms, ...bodySystems,
].map(f => f.id));

const conditionsSourceIds = new Set([
  ...conditions1, ...conditions2, ...conditions3, ...conditions4,
].map(f => f.id));

const proceduresSourceIds = new Set([
  ...procedures, ...diagnostics,
].map(f => f.id));

// Map original IDs → deduped IDs (for renamed dupes)
// We need to look at dedupedFacts by order since we renamed dupes
// Actually, it's cleaner to track per-group using the deduped array slices
const prefixSlice = dedupedFacts.slice(0, normalizedPrefixes.length);
const suffixSlice = dedupedFacts.slice(
  normalizedPrefixes.length,
  normalizedPrefixes.length + normalizedSuffixes.length
);
const bodyRootsStart = normalizedPrefixes.length + normalizedSuffixes.length;
const bodyRootsEnd = bodyRootsStart + normalizedRootsAll.length;
const bodyRootsSlice = dedupedFacts.slice(bodyRootsStart, bodyRootsEnd);
const conditionsStart = bodyRootsEnd;
const conditionsEnd = conditionsStart + normalizedConditions.length;
const conditionsSlice = dedupedFacts.slice(conditionsStart, conditionsEnd);
const proceduresSlice = dedupedFacts.slice(conditionsEnd);

const subDecks = [
  {
    id: 'prefixes',
    name: 'Medical Prefixes',
    factIds: prefixSlice.map(f => f.id),
  },
  {
    id: 'suffixes',
    name: 'Medical Suffixes',
    factIds: suffixSlice.map(f => f.id),
  },
  {
    id: 'body_roots',
    name: 'Body Roots, Organs & Systems',
    factIds: bodyRootsSlice.map(f => f.id),
  },
  {
    id: 'conditions',
    name: 'Medical Conditions',
    factIds: conditionsSlice.map(f => f.id),
  },
  {
    id: 'procedures',
    name: 'Procedures & Diagnostics',
    factIds: proceduresSlice.map(f => f.id),
  },
];

console.log(`\nSub-decks:`);
subDecks.forEach(s => console.log(`  ${s.id}: ${s.factIds.length} facts`));

// ── Assemble final envelope ───────────────────────────────────────────────────
const deck = {
  id: 'medical_terminology',
  name: 'Medical Terminology',
  domain: 'human_body_health',
  subDomain: 'medical_terminology',
  description: 'Master the language of medicine — every prefix, suffix, root word, and combining form used in healthcare. Decode any medical term on sight.',
  minimumFacts: 500,
  targetFacts: 635,
  facts: dedupedFacts,
  answerTypePools,
  synonymGroups: [],
  questionTemplates: [],
  difficultyTiers,
  subDecks,
};

// ── Write output ──────────────────────────────────────────────────────────────
console.log(`\nWriting ${OUT_PATH}...`);
fs.writeFileSync(OUT_PATH, JSON.stringify(deck, null, 2), 'utf-8');
console.log(`Written: ${dedupedFacts.length} facts, ${answerTypePools.length} pools`);

// ── Update manifest ───────────────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
if (!manifest.decks.includes('medical_terminology.json')) {
  manifest.decks.push('medical_terminology.json');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log('Manifest updated.');
} else {
  console.log('Manifest already contains medical_terminology.json');
}

console.log('\nDone!');
