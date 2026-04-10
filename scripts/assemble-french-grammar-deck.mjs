#!/usr/bin/env node
// Parameterized assembly script for French grammar decks.
// Reads the per-level architecture YAML for metadata + chain themes + pool
// definitions, then concatenates all matching _wip batch files and writes
// the final deck JSON.
//
// Usage:
//   node scripts/assemble-french-grammar-deck.mjs --level a1
//   node scripts/assemble-french-grammar-deck.mjs --level a2
//   node scripts/assemble-french-grammar-deck.mjs --level b1
//   node scripts/assemble-french-grammar-deck.mjs --level b2

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
}
const LEVEL = arg('level', null);
if (!['a1', 'a2', 'b1', 'b2'].includes(LEVEL)) {
  console.error('provide --level a1|a2|b1|b2');
  process.exit(1);
}

const ARCH_PATH = join(ROOT, `data/deck-architectures/french_${LEVEL}_grammar_arch.yaml`);
const WIP_DIR = join(ROOT, 'data/decks/_wip');
const BATCH_PREFIX = `fr_${LEVEL}_batch`;
const OUTPUT = join(ROOT, `data/decks/french_${LEVEL}_grammar.json`);

// ---- load architecture ----
const arch = yaml.load(readFileSync(ARCH_PATH, 'utf8'));
if (!arch || !arch.chain_themes || !arch.answer_type_pools) {
  console.error(`architecture YAML at ${ARCH_PATH} is missing required sections`);
  process.exit(1);
}

// ---- load all batch files ----
const batchFiles = readdirSync(WIP_DIR)
  .filter((f) => f.startsWith(BATCH_PREFIX) && f.endsWith('.json'))
  .sort();
if (batchFiles.length === 0) {
  console.error(`no batch files found in ${WIP_DIR} matching ${BATCH_PREFIX}*.json`);
  process.exit(1);
}

let allFacts = [];
for (const f of batchFiles) {
  const raw = JSON.parse(readFileSync(join(WIP_DIR, f), 'utf8'));
  // Support both top-level array and { facts: [...] } wrappers.
  const batch = Array.isArray(raw) ? raw : Array.isArray(raw.facts) ? raw.facts : [];
  allFacts = allFacts.concat(batch);
  console.log(`Loaded ${batch.length} facts from ${f}`);
}
console.log(`Total facts: ${allFacts.length}`);

// ---- chain themes from arch ----
const chainThemes = arch.chain_themes.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  color: t.color,
  icon: t.icon,
}));

// ---- answer type pools from arch, populated with factIds from facts ----
const poolMap = {};
for (const fact of allFacts) {
  const pid = fact.answerTypePoolId;
  if (!pid) continue;
  if (!poolMap[pid]) poolMap[pid] = [];
  poolMap[pid].push(fact.id);
}

// Support both array-of-objects and id-keyed object formats for answer_type_pools.
const poolList = Array.isArray(arch.answer_type_pools)
  ? arch.answer_type_pools
  : Object.entries(arch.answer_type_pools).map(([id, p]) => ({ id, ...p }));

const answerTypePools = poolList
  .map((p) => {
    const factIds = poolMap[p.id] || [];
    const synth = p.synthetic_distractors || [];
    console.log(
      `Pool ${p.id}: ${factIds.length} facts + ${synth.length} synthetic = ${factIds.length + synth.length} total`
    );
    return {
      id: p.id,
      description: p.description,
      factIds,
      syntheticDistractors: synth,
    };
  })
  .filter((p) => p.factIds.length > 0);

// ---- subDecks grouped by chainThemeId ----
const subDeckMap = {};
for (const t of chainThemes) {
  subDeckMap[t.id] = {
    id: `sd_${slugify(t.name)}`,
    name: t.name,
    factIds: [],
  };
}
for (const fact of allFacts) {
  const tid = fact.chainThemeId;
  if (subDeckMap[tid]) subDeckMap[tid].factIds.push(fact.id);
}
const subDecks = Object.values(subDeckMap);

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ---- difficulty tiers ----
const easy = allFacts.filter((f) => f.difficulty === 1).map((f) => f.id);
const medium = allFacts.filter((f) => f.difficulty === 2).map((f) => f.id);
const hard = allFacts.filter((f) => f.difficulty >= 3).map((f) => f.id);
const difficultyTiers = [
  { tier: 'easy', factIds: easy },
  { tier: 'medium', factIds: medium },
  { tier: 'hard', factIds: hard },
];
console.log(`Difficulty: easy=${easy.length}, medium=${medium.length}, hard=${hard.length}`);

// ---- synonym groups — facts sharing the same correctAnswer within same pool ----
const answerGroups = {};
for (const fact of allFacts) {
  const key = `${fact.answerTypePoolId}::${fact.correctAnswer}`;
  if (!answerGroups[key]) answerGroups[key] = [];
  answerGroups[key].push(fact.id);
}
const synonymGroups = [];
let synIdx = 0;
for (const [key, ids] of Object.entries(answerGroups)) {
  if (ids.length > 1) {
    const [poolId, answer] = key.split('::');
    synonymGroups.push({
      id: `syn_${synIdx++}`,
      factIds: ids,
      reason: `All facts have the same correct answer: '${answer}' (${poolId})`,
    });
  }
}
console.log(`Synonym groups: ${synonymGroups.length}`);

// ---- assemble deck ----
const deck = {
  id: arch.deck_id,
  name: arch.name,
  domain: arch.domain,
  subDomain: arch.sub_domain,
  description:
    arch.description ||
    `Master CEFR ${LEVEL.toUpperCase()} French grammar — scoped from the Référentiel ${LEVEL.toUpperCase()} pour le français (Beacco et al., Didier). Fill in the blank to prove you know which form fits.`,
  minimumFacts: arch.minimum_facts || Math.floor(allFacts.length * 0.6),
  targetFacts: arch.target_facts || allFacts.length,
  language: arch.language || 'fr',
  facts: allFacts,
  chainThemes,
  answerTypePools,
  synonymGroups,
  difficultyTiers,
  subDecks,
  questionTemplates: [
    {
      id: 'fill_blank_grammar',
      answerPoolId: 'grammar_all',
      questionFormat: '{quizQuestion}',
      availableFromMastery: 0,
      difficulty: 2,
      reverseCapable: false,
    },
  ],
};

writeFileSync(OUTPUT, JSON.stringify(deck, null, 2), 'utf8');
console.log(`\nWrote: ${OUTPUT}`);
console.log(`Total facts: ${allFacts.length}`);

// ---- sourceRef breakdown ----
const tatCount = allFacts.filter((f) => (f.sourceRef || '').startsWith('tatoeba:')).length;
const llmCount = allFacts.filter((f) => f.sourceRef === 'llm_authored').length;
const otherCount = allFacts.length - tatCount - llmCount;
console.log(
  `sourceRef: tatoeba=${tatCount} (${((tatCount / allFacts.length) * 100).toFixed(
    1
  )}%) | llm_authored=${llmCount} | other=${otherCount}`
);
