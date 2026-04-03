/**
 * Assembly script for the AP Psychology curated deck.
 * Reads 18 WIP batch files, normalizes schema, deduplicates IDs,
 * builds pools/tiers/sub-decks/synonym-groups, and writes the final CuratedDeck envelope.
 *
 * Chain theme assignment:
 *   Facts TRUST their own chainThemeId if already set.
 *   Defaults are only applied when chainThemeId is missing/undefined.
 *   This handles batch 04 (mixed sleep→theme1 + sensation→theme2 content).
 *
 * Default by batch (used only if fact has no chainThemeId):
 *   batches 01-02 → 0  (The Neural Forge)
 *   batches 03, 07-08 → 1  (The Mind Palace)
 *   batches 04-05 → 2  (The Sensory Labyrinth)  ← sleep facts in 04 must self-declare theme 1
 *   batch 06 → 3  (The Reasoning Chamber)
 *   batches 09-11 → 4  (The Growth Spiral)
 *   batches 12-13 → 5  (The Conditioning Pit)
 *   batches 14, 16 → 6  (The Social Nexus)
 *   batch 15 → 7  (The Mask Gallery)
 *   batches 17-18 → 8  (The Shadow Ward)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIP_DIR = path.join(ROOT, 'data/decks/_wip');
const OUT_PATH = path.join(ROOT, 'data/decks/ap_psychology.json');
const MANIFEST_PATH = path.join(ROOT, 'data/decks/manifest.json');

// ── Fields to remove ────────────────────────────────────────────────────────
const REMOVE_FIELDS = new Set([
  '_haikuProcessed', 'noveltyScore', 'rarity', 'sourceVerified',
  'contentVolatility', 'sensitivityLevel', 'sensitivityNote',
  'type', 'domain', 'subdomain', '_batchNum',
]);

// ── Pool metadata: label + answerFormat per pool ID ──────────────────────────
const POOL_METADATA = {
  researcher_names:    { label: 'Researcher / Theorist',    answerFormat: 'name' },
  brain_structures:    { label: 'Brain Structure',          answerFormat: 'term' },
  neurotransmitter_names: { label: 'Neurotransmitter',      answerFormat: 'term' },
  psych_concept_terms: { label: 'Psychology Concept',       answerFormat: 'term' },
  disorder_names:      { label: 'Psychological Disorder',   answerFormat: 'term' },
  therapy_types:       { label: 'Therapy / Treatment Type', answerFormat: 'term' },
  dev_stage_names:     { label: 'Developmental Stage',      answerFormat: 'term' },
  sleep_stage_terms:   { label: 'Sleep Stage',              answerFormat: 'term' },
  sensation_terms:     { label: 'Sensation / Perception Term', answerFormat: 'term' },
  memory_terms:        { label: 'Memory Concept',           answerFormat: 'term' },
  intelligence_terms:  { label: 'Intelligence / Thinking Term', answerFormat: 'term' },
  social_psych_terms:  { label: 'Social Psychology Term',   answerFormat: 'term' },
  personality_terms:   { label: 'Personality Theory Term',  answerFormat: 'term' },
  bracket_numbers:     { label: 'Number / Statistic',       answerFormat: 'number' },
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
  out.answerTypePoolId = fact.answerTypePoolId ?? 'psych_concept_terms';
  out.difficulty = fact.difficulty ?? 3;
  out.funScore = fact.funScore ?? 5;
  out.ageGroup = normalizeAgeGroup(fact.ageGroup);
  out.distractors = fact.distractors ?? [];
  out.quizQuestion = fact.quizQuestion ?? '';
  out.explanation = fact.explanation ?? '';
  out.statement = fact.statement ?? '';
  out.wowFactor = fact.wowFactor ?? '';
  out.sourceName = fact.sourceName ?? 'Wikipedia';
  out.sourceUrl = fact.sourceUrl ?? 'https://en.wikipedia.org/wiki/AP_Psychology';
  out.volatile = fact.volatile ?? false;
  out.categoryL1 = fact.categoryL1 ?? 'social_sciences';
  out.categoryL2 = fact.categoryL2 ?? 'psychology';
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
  ['ap_psych_01_heredity_nervous.json',        0],
  ['ap_psych_02_neuron_firing.json',           0],
  ['ap_psych_03_brain.json',                   1],
  ['ap_psych_04_sleep_sensation.json',         2],  // sleep facts must self-declare chainThemeId:1
  ['ap_psych_05_perception.json',              2],
  ['ap_psych_06_thinking_intelligence.json',   3],
  ['ap_psych_07_memory_core.json',             1],
  ['ap_psych_08_forgetting.json',              1],
  ['ap_psych_09_dev_methods_physical_gender.json', 4],
  ['ap_psych_10_cognitive_language_dev.json',  4],
  ['ap_psych_11_social_emotional_dev.json',    4],
  ['ap_psych_12_conditioning.json',            5],
  ['ap_psych_13_social_learning.json',         5],
  ['ap_psych_14_social_psych.json',            6],
  ['ap_psych_15_personality.json',             7],
  ['ap_psych_16_motivation_emotion.json',      6],
  ['ap_psych_17_health_positive.json',         8],
  ['ap_psych_18_disorders_treatment.json',     8],
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
  'researcher_names',
  'brain_structures',
  'neurotransmitter_names',
  'psych_concept_terms',
  'disorder_names',
  'therapy_types',
  'dev_stage_names',
  'sleep_stage_terms',
  'sensation_terms',
  'memory_terms',
  'intelligence_terms',
  'social_psych_terms',
  'personality_terms',
  'bracket_numbers',
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
  { id: 0, name: 'The Neural Forge',       subDeckId: 'neural_forge' },
  { id: 1, name: 'The Mind Palace',        subDeckId: 'mind_palace' },
  { id: 2, name: 'The Sensory Labyrinth',  subDeckId: 'sensory_labyrinth' },
  { id: 3, name: 'The Reasoning Chamber',  subDeckId: 'reasoning_chamber' },
  { id: 4, name: 'The Growth Spiral',      subDeckId: 'growth_spiral' },
  { id: 5, name: 'The Conditioning Pit',   subDeckId: 'conditioning_pit' },
  { id: 6, name: 'The Social Nexus',       subDeckId: 'social_nexus' },
  { id: 7, name: 'The Mask Gallery',       subDeckId: 'mask_gallery' },
  { id: 8, name: 'The Shadow Ward',        subDeckId: 'shadow_ward' },
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
  id: 'ap_psychology',
  name: 'AP Psychology',
  domain: 'social_sciences',
  subDomain: 'psychology',
  description: 'Master every concept on the AP Psychology exam — neurons to disorders, Pavlov to Piaget.',
  minimumFacts: 280,
  targetFacts: 350,
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
if (!manifest.decks.includes('ap_psychology.json')) {
  manifest.decks.push('ap_psychology.json');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log('Manifest updated.');
} else {
  console.log('Manifest already contains ap_psychology.json');
}

console.log('\nDone!');
