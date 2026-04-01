/**
 * Assembles the final world_wonders.json deck from 4 partial fact files.
 * Usage: node data/decks/_wip/assemble-world-wonders.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

// --- Load and merge all 4 fact files ---

const factFiles = [
  resolve(__dirname, 'world_wonders_facts_01.json'),
  resolve(__dirname, 'world_wonders_facts_02.json'),
  resolve(__dirname, 'world_wonders_facts_03.json'),
  resolve(__dirname, 'world_wonders_facts_04.json'),
];

let allFacts = [];
for (const f of factFiles) {
  const raw = JSON.parse(readFileSync(f, 'utf8'));
  const facts = raw.facts ?? raw;
  allFacts = allFacts.concat(facts);
  console.log(`Loaded ${facts.length} facts from ${f.split('/').pop()}`);
}

console.log(`Total facts merged: ${allFacts.length}`);

// Check for duplicate IDs
const idSet = new Set();
const dupeIds = [];
for (const f of allFacts) {
  if (idSet.has(f.id)) dupeIds.push(f.id);
  idSet.add(f.id);
}
if (dupeIds.length > 0) {
  console.warn(`WARNING: Duplicate IDs found: ${dupeIds.join(', ')}`);
}

// --- Build answerTypePools ---
// Pool definitions: id -> { label, answerFormat }
const poolDefs = {
  landmark_names:    { label: 'Landmark Names',        answerFormat: 'name'   },
  location_country:  { label: 'Countries & Regions',   answerFormat: 'place'  },
  location_city:     { label: 'Cities & Locations',    answerFormat: 'place'  },
  architect_designer:{ label: 'Architects & Designers', answerFormat: 'name'  },
  year_date:         { label: 'Years & Dates',          answerFormat: 'year'  },
  measurement_number:{ label: 'Measurements & Numbers', answerFormat: 'number'},
  material_feature:  { label: 'Materials & Features',   answerFormat: 'term'  },
  person_historical: { label: 'Historical Figures',     answerFormat: 'name'  },
};

const poolFactIds = {};
for (const poolId of Object.keys(poolDefs)) {
  poolFactIds[poolId] = [];
}

// Track unknown pools
const unknownPools = new Set();

for (const fact of allFacts) {
  const pid = fact.answerTypePoolId;
  if (poolFactIds[pid] !== undefined) {
    poolFactIds[pid].push(fact.id);
  } else {
    unknownPools.add(pid);
  }
}

if (unknownPools.size > 0) {
  console.warn(`WARNING: Unknown answerTypePoolIds encountered: ${[...unknownPools].join(', ')}`);
}

const answerTypePools = Object.entries(poolDefs)
  .filter(([id]) => poolFactIds[id] && poolFactIds[id].length > 0)
  .map(([id, def]) => ({
    id,
    label: def.label,
    answerFormat: def.answerFormat,
    factIds: poolFactIds[id],
    minimumSize: 5,
  }));

console.log('\nAnswer Type Pools:');
for (const p of answerTypePools) {
  console.log(`  ${p.id}: ${p.factIds.length} facts`);
}

// --- Build synonymGroups ---
// Match only on quizQuestion + correctAnswer + fact.id (NOT explanation — explanations often
// cross-mention related landmarks and produce false positives).
const synonymCandidates = {
  syn_big_ben: {
    reason: "Big Ben is the bell inside the tower; Elizabeth Tower is the structure's official name since 2012.",
    keywords: ['big ben', 'elizabeth tower'],
  },
  syn_statue_liberty: {
    reason: 'The Statue of Liberty\'s full official name is "Liberty Enlightening the World".',
    keywords: ['statue of liberty', 'liberty enlightening'],
  },
  syn_northern_lights: {
    reason: 'Northern Lights and Aurora Borealis are two names for the same phenomenon.',
    keywords: ['northern lights', 'aurora borealis'],
  },
  syn_everest: {
    reason: 'Mount Everest, Sagarmatha (Nepali), and Chomolungma (Tibetan) are all names for the same peak.',
    keywords: ['everest', 'sagarmatha', 'chomolungma'],
  },
  syn_hagia_sophia: {
    reason: 'Hagia Sophia (Greek) and Ayasofya (Turkish) are the same structure in Istanbul.',
    keywords: ['hagia sophia', 'ayasofya'],
  },
  syn_forbidden_city: {
    reason: 'Forbidden City, Gugong, and Palace Museum are all names for the same complex in Beijing.',
    keywords: ['forbidden city', 'gugong', 'palace museum'],
  },
};

const synonymGroups = [];
for (const [synId, synDef] of Object.entries(synonymCandidates)) {
  // Only match quizQuestion + correctAnswer + id — NOT explanation to avoid cross-mention false positives
  const matchingFacts = allFacts.filter(fact => {
    const text = (
      fact.quizQuestion + ' ' +
      fact.correctAnswer + ' ' +
      fact.id
    ).toLowerCase();
    return synDef.keywords.some(kw => text.includes(kw));
  });

  if (matchingFacts.length >= 2) {
    synonymGroups.push({
      id: synId,
      factIds: matchingFacts.map(f => f.id),
      reason: synDef.reason,
    });
    console.log(`\nSynonymGroup ${synId}: ${matchingFacts.length} facts (${matchingFacts.map(f => f.id).join(', ')})`);
  } else if (matchingFacts.length === 1) {
    console.log(`\nNote: ${synId} only matched 1 fact (${matchingFacts[0].id}) — skipping (need >= 2 to form synonym group)`);
  } else {
    console.log(`\nNote: ${synId} matched 0 facts — skipping`);
  }
}

// --- Build difficultyTiers ---
const easyIds   = allFacts.filter(f => f.difficulty <= 2).map(f => f.id);
const mediumIds = allFacts.filter(f => f.difficulty === 3).map(f => f.id);
const hardIds   = allFacts.filter(f => f.difficulty >= 4).map(f => f.id);

console.log(`\nDifficulty tiers: easy=${easyIds.length}, medium=${mediumIds.length}, hard=${hardIds.length}`);

const difficultyTiers = [
  { tier: 'easy',   factIds: easyIds   },
  { tier: 'medium', factIds: mediumIds },
  { tier: 'hard',   factIds: hardIds   },
];

// --- Build subDecks ---
const subDeckDefs = [
  { id: 'ancient_wonders',     name: 'Ancient Wonders',       chainThemeId: 0 },
  { id: 'sacred_monuments',    name: 'Sacred Monuments',      chainThemeId: 1 },
  { id: 'towers_skyscrapers',  name: 'Towers & Skyscrapers',  chainThemeId: 2 },
  { id: 'bridges_dams',        name: 'Bridges & Dams',        chainThemeId: 3 },
  { id: 'palaces_castles',     name: 'Palaces & Castles',     chainThemeId: 4 },
  { id: 'monuments_memorials', name: 'Monuments & Memorials', chainThemeId: 5 },
  { id: 'natural_wonders',     name: 'Natural Wonders',       chainThemeId: 6 },
  { id: 'modern_marvels',      name: 'Modern Marvels',        chainThemeId: 7 },
];

// Warn about any unrecognized subDeckIds
const knownSubDeckIds = new Set(subDeckDefs.map(s => s.id));
const unknownSubDecks = new Set(
  allFacts.map(f => f.subDeckId).filter(id => id && !knownSubDeckIds.has(id))
);
if (unknownSubDecks.size > 0) {
  console.warn(`\nWARNING: Unknown subDeckIds: ${[...unknownSubDecks].join(', ')}`);
}

const subDecks = subDeckDefs.map(def => ({
  id: def.id,
  name: def.name,
  chainThemeId: def.chainThemeId,
  factIds: allFacts.filter(f => f.subDeckId === def.id).map(f => f.id),
}));

console.log('\nSubDecks:');
for (const sd of subDecks) {
  console.log(`  ${sd.id}: ${sd.factIds.length} facts`);
}

// --- Clean facts: remove fields not in DeckFact interface ---
// Keep only fields defined in CuratedDeckTypes DeckFact
const DECK_FACT_FIELDS = new Set([
  'id', 'correctAnswer', 'acceptableAlternatives', 'synonymGroupId',
  'chainThemeId', 'answerTypePoolId', 'difficulty', 'funScore',
  'quizQuestion', 'explanation', 'grammarNote', 'displayAsFullForm',
  'fullFormDisplay', 'visualDescription', 'sourceName', 'sourceUrl',
  'volatile', 'distractors', 'targetLanguageWord', 'reading', 'language',
  'pronunciation', 'partOfSpeech', 'examTags', 'imageAssetPath',
  'quizMode', 'quizResponseMode',
]);

const cleanedFacts = allFacts.map(fact => {
  const cleaned = {};
  for (const key of Object.keys(fact)) {
    if (DECK_FACT_FIELDS.has(key)) {
      cleaned[key] = fact[key];
    }
    // subDeckId, statement, wowFactor, categoryL1, categoryL2, tags are WIP-only fields — drop them
  }
  // Assign synonymGroupId where applicable
  for (const sg of synonymGroups) {
    if (sg.factIds.includes(fact.id)) {
      cleaned.synonymGroupId = sg.id;
      break;
    }
  }
  return cleaned;
});

// --- Assemble the final deck ---
const deck = {
  id: 'world_wonders',
  name: 'World Wonders & Landmarks',
  domain: 'geography',
  subDomain: 'wonders_landmarks',
  description: "From the Great Pyramid to the Burj Khalifa — humanity's greatest structures and Earth's most spectacular natural formations. Learn what makes each wonder remarkable, where to find them, and the stories behind their creation.",
  minimumFacts: 120,
  targetFacts: 200,
  facts: cleanedFacts,
  answerTypePools,
  synonymGroups,
  questionTemplates: [],
  difficultyTiers,
  subDecks,
};

// --- Write output ---
const outputPath = resolve(ROOT, 'data/decks/world_wonders.json');
writeFileSync(outputPath, JSON.stringify(deck, null, 2), 'utf8');
console.log(`\nWrote ${outputPath}`);
console.log(`  Total facts: ${deck.facts.length}`);
console.log(`  answerTypePools: ${deck.answerTypePools.length}`);
console.log(`  synonymGroups: ${deck.synonymGroups.length}`);
console.log(`  subDecks: ${deck.subDecks.length}`);

// --- Update manifest.json ---
const manifestPath = resolve(ROOT, 'data/decks/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!manifest.decks.includes('world_wonders.json')) {
  manifest.decks.push('world_wonders.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('\nAdded world_wonders.json to manifest.json');
} else {
  console.log('\nworld_wonders.json already in manifest.json — no change needed');
}

console.log('\nDone.');
