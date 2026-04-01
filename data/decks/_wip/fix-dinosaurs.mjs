/**
 * fix-dinosaurs.mjs
 *
 * Applies 5 fixes to data/decks/dinosaurs.json:
 *  1. Convert chainThemeId from strings to numbers
 *  2. Generate distractors for 12 facts that have empty distractor arrays
 *  3. (Skipped) dino_plesiosaurus_neck_myth is true/false — already correct with ["True"]
 *  4. Populate difficultyTiers[] by bucketing facts by difficulty (1-2=easy, 3=medium, 4-5=hard)
 *  5. Strip non-standard fields: statement, wowFactor, tags, ageGroup
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const deckPath = join(__dirname, '../dinosaurs.json');
const deck = JSON.parse(readFileSync(deckPath, 'utf8'));

// ─── Fix 1: chainThemeId string → number mapping ───────────────────────────

const THEME_MAP = {
  apex_predators: 0,
  gentle_giants: 1,
  armored_and_horned: 2,
  duck_bills_and_herds: 3,
  ancient_oceans_and_skies: 4,
  deep_time: 5,
  dino_spotter: 6,
};

let chainThemeFixed = 0;
for (const fact of deck.facts) {
  if (typeof fact.chainThemeId === 'string') {
    const num = THEME_MAP[fact.chainThemeId];
    if (num === undefined) {
      console.error(`Unknown chainThemeId string: "${fact.chainThemeId}" on fact ${fact.id}`);
      process.exit(1);
    }
    fact.chainThemeId = num;
    chainThemeFixed++;
  }
}
console.log(`Fix 1: Converted ${chainThemeFixed} chainThemeId strings → numbers`);

// ─── Fix 2: Add distractors to 12 facts with empty arrays ──────────────────

const DISTRACTOR_MAP = {
  dino_pteranodon_wingspan: ['{3.2}', '{4.8}', '{8.1}', '{10.5}', '{2.5}', '{12.0}', '{7.9}', '{5.1}'],
  dino_plesiosaurus_mary_anning_1823: ['{1812}', '{1830}', '{1799}', '{1845}', '{1818}', '{1836}', '{1851}', '{1808}'],
  dino_archaeopteryx_darwin_timing: ['{1855}', '{1868}', '{1842}', '{1873}', '{1849}', '{1877}', '{1859}', '{1865}'],
  dino_triassic_dates: ['299\u2013252', '201\u2013145', '145\u201366', '320\u2013252', '230\u2013180', '260\u2013210', '280\u2013230', '240\u2013195'],
  dino_triassic_first_dinosaurs: ['{210}', '{245}', '{198}', '{260}', '{220}', '{185}', '{250}', '{215}'],
  dino_jurassic_dates: ['252\u2013201', '145\u201366', '180\u2013120', '220\u2013160', '195\u2013130', '210\u2013150', '230\u2013170', '190\u2013125'],
  dino_cretaceous_dates: ['201\u2013145', '160\u201380', '130\u201355', '155\u201372', '170\u201390', '120\u201350', '180\u2013100', '140\u201360'],
  dino_kpg_asteroid_diameter: ['{5}', '{15}', '{25}', '{3}', '{20}', '{50}', '{8}', '{35}'],
  dino_kpg_species_lost: ['{50}', '{60}', '{85}', '{90}', '{40}', '{95}', '{65}', '{80}'],
  dino_bone_wars_species_count: ['{86}', '{105}', '{178}', '{210}', '{63}', '{250}', '{120}', '{95}'],
  dino_feathered_sinosauropteryx: ['{1988}', '{2001}', '{1992}', '{2004}', '{1985}', '{1999}', '{2008}', '{1994}'],
  dino_velociraptor_feather_proof: ['{2001}', '{2010}', '{1998}', '{2013}', '{2004}', '{1995}', '{2015}', '{2009}'],
};

let distractorFixed = 0;
for (const fact of deck.facts) {
  if (DISTRACTOR_MAP[fact.id]) {
    if (!Array.isArray(fact.distractors) || fact.distractors.length === 0) {
      fact.distractors = DISTRACTOR_MAP[fact.id];
      distractorFixed++;
    } else {
      console.log(`  Skipping ${fact.id} — already has ${fact.distractors.length} distractors`);
    }
  }
}
console.log(`Fix 2: Added distractors to ${distractorFixed} facts`);

// ─── Fix 4: Populate difficultyTiers ───────────────────────────────────────

const easy = [];
const medium = [];
const hard = [];

for (const fact of deck.facts) {
  const d = fact.difficulty;
  if (d <= 2) easy.push(fact.id);
  else if (d === 3) medium.push(fact.id);
  else hard.push(fact.id);
}

deck.difficultyTiers = [
  { tier: 'easy', factIds: easy },
  { tier: 'medium', factIds: medium },
  { tier: 'hard', factIds: hard },
];

console.log(`Fix 4: difficultyTiers populated — easy=${easy.length}, medium=${medium.length}, hard=${hard.length} (total=${easy.length + medium.length + hard.length})`);

// ─── Fix 5: Strip non-standard fields ──────────────────────────────────────

const NON_STANDARD = ['statement', 'wowFactor', 'tags', 'ageGroup'];
let fieldsStripped = 0;
let factsWithStrippedFields = 0;

for (const fact of deck.facts) {
  let stripped = 0;
  for (const field of NON_STANDARD) {
    if (field in fact) {
      delete fact[field];
      stripped++;
      fieldsStripped++;
    }
  }
  if (stripped > 0) factsWithStrippedFields++;
}

console.log(`Fix 5: Stripped ${fieldsStripped} non-standard field instances across ${factsWithStrippedFields} facts`);

// ─── Write result ───────────────────────────────────────────────────────────

writeFileSync(deckPath, JSON.stringify(deck, null, 2), 'utf8');
console.log(`\nWrote ${deckPath}`);
console.log(`Total facts: ${deck.facts.length}`);

// ─── Verification summary ───────────────────────────────────────────────────

console.log('\n--- Verification ---');
const chainThemeTypes = new Set(deck.facts.map(f => typeof f.chainThemeId));
console.log(`chainThemeId types: ${[...chainThemeTypes].join(', ')} (should be only "number")`);

const emptyDistractors = deck.facts.filter(f => !f.distractors || f.distractors.length === 0);
console.log(`Facts with empty distractors: ${emptyDistractors.length} (should be 0 or 1 for true/false)`);
if (emptyDistractors.length > 0) {
  for (const f of emptyDistractors) {
    console.log(`  ${f.id} — correctAnswer: ${f.correctAnswer}, distractors: ${JSON.stringify(f.distractors)}`);
  }
}

const remainingNonStandard = deck.facts.filter(f => NON_STANDARD.some(k => k in f));
console.log(`Facts with non-standard fields remaining: ${remainingNonStandard.length} (should be 0)`);

console.log(`difficultyTiers count: ${deck.difficultyTiers.length} (should be 3)`);
const tierTotal = deck.difficultyTiers.reduce((s, t) => s + t.factIds.length, 0);
console.log(`difficultyTiers total factIds: ${tierTotal} (should equal ${deck.facts.length})`);
