#!/usr/bin/env node
/**
 * Anime & Manga deck assembly script.
 * Reads 8 batch files, merges, validates, and writes anime_manga.json
 *
 * Key differences from AP World History pattern:
 *   - Batches with chainThemeId: null preserve facts' existing chainThemeId (mixed-theme batches)
 *   - Sub-decks use chainThemeIds[] (array) instead of a single chainThemeId
 *   - manifest.json updated if anime_manga.json is not already listed
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIP_DIR = path.join(__dirname, '../data/decks/_wip');
const OUT_FILE = path.join(__dirname, '../data/decks/anime_manga.json');
const MANIFEST_FILE = path.join(__dirname, '../public/data/narratives/manifest.json');

// ─── Batch file manifest ────────────────────────────────────────────────────
// chainThemeId: null means the facts already carry their own chainThemeId — do NOT override
const BATCHES = [
  { file: 'anime_manga_batch1_shonen.json',          chainThemeId: null },  // Mixed: all chain 0
  { file: 'anime_manga_batch2_shojo_seinen.json',    chainThemeId: null },  // Mixed: chains 1 and 2
  { file: 'anime_manga_batch3_film.json',            chainThemeId: 3 },
  { file: 'anime_manga_batch4_classic.json',         chainThemeId: 4 },
  { file: 'anime_manga_batch5_manga_craft.json',     chainThemeId: 5 },
  { file: 'anime_manga_batch6_animation_craft.json', chainThemeId: 6 },
  { file: 'anime_manga_batch7_culture.json',         chainThemeId: 7 },
  { file: 'anime_manga_batch8_supplemental.json',    chainThemeId: null },  // Mixed: chains 0 and 2
];

// ─── Pool ID typo corrections ────────────────────────────────────────────────
// Maps incorrect pool IDs found in batch files to their correct canonical IDs
const POOL_ID_CORRECTIONS = {};

// ─── Architecture: 10 answer type pools ─────────────────────────────────────
const POOL_DEFS = [
  { id: 'anime_series_titles',      label: 'Anime Series Titles',               answerFormat: 'name' },
  { id: 'manga_series_titles',      label: 'Manga Series Titles',               answerFormat: 'name' },
  { id: 'creator_names',            label: 'Mangaka, Directors & Creators',      answerFormat: 'name' },
  { id: 'character_names',          label: 'Iconic Characters',                  answerFormat: 'name' },
  { id: 'studio_names',             label: 'Animation Studios',                  answerFormat: 'name' },
  { id: 'bracket_years',            label: 'Key Years (Bracket Notation)',       answerFormat: '{N}' },
  { id: 'genre_demographic_terms',  label: 'Genres & Demographics',              answerFormat: 'term' },
  { id: 'technique_terms',          label: 'Animation & Manga Techniques',       answerFormat: 'term' },
  { id: 'publisher_magazine_names', label: 'Publishers & Magazines',             answerFormat: 'name' },
  { id: 'count_values',             label: 'Counts & Numbers (Bracket Notation)', answerFormat: '{N}' },
];

// ─── Architecture: chain themes ─────────────────────────────────────────────
const CHAIN_THEMES = [
  { id: 0, name: 'Shonen Legends' },
  { id: 1, name: 'Shojo & Josei' },
  { id: 2, name: 'Seinen & Mature' },
  { id: 3, name: 'Ghibli & Anime Film' },
  { id: 4, name: 'Classic & Pioneer Era' },
  { id: 5, name: 'Manga Craft & Publishing' },
  { id: 6, name: 'Animation Craft & Studios' },
  { id: 7, name: 'Culture & Global Impact' },
];

// ─── Architecture: sub-decks ─────────────────────────────────────────────────
// NOTE: chainThemeIds is an array — each sub-deck spans multiple chain themes.
// factIds are populated programmatically below by checking fact.chainThemeId.
const SUB_DECKS = [
  {
    id: 'sd_series_stories',
    name: 'Series & Stories',
    chainThemeIds: [0, 1, 2],
    description: 'Shonen, shojo, seinen, and josei anime and manga series.',
    factIds: [],
  },
  {
    id: 'sd_film_classics',
    name: 'Film & Classics',
    chainThemeIds: [3, 4],
    description: 'Anime feature films, Studio Ghibli, and pioneer era classics.',
    factIds: [],
  },
  {
    id: 'sd_craft_culture',
    name: 'Craft & Culture',
    chainThemeIds: [5, 6, 7],
    description: "Manga publishing, animation studios, and anime's global cultural impact.",
    factIds: [],
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

  // Apply pool ID corrections; only override chainThemeId when explicitly set
  for (const fact of facts) {
    if (POOL_ID_CORRECTIONS[fact.answerTypePoolId]) {
      const original = fact.answerTypePoolId;
      fact.answerTypePoolId = POOL_ID_CORRECTIONS[fact.answerTypePoolId];
      console.log(`  Corrected pool ID on ${fact.id}: ${original} -> ${fact.answerTypePoolId}`);
    }
    // Only enforce chainThemeId when the batch specifies one (not null)
    if (chainThemeId !== null) {
      fact.chainThemeId = chainThemeId;
    }
  }

  allFacts = allFacts.concat(facts);
  const label = chainThemeId !== null
    ? `chain ${chainThemeId}`
    : `mixed (${[...new Set(facts.map(f => f.chainThemeId))].sort().join(', ')})`;
  console.log(`  Loaded ${facts.length} facts from ${file} (${label})`);
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

// ─── Populate sub-deck factIds ─────────────────────────────────────────────
console.log('\nPopulating sub-deck factIds...');
for (const subDeck of SUB_DECKS) {
  const themeSet = new Set(subDeck.chainThemeIds);
  subDeck.factIds = allFacts
    .filter(f => themeSet.has(f.chainThemeId))
    .map(f => f.id);
  console.log(`  ${subDeck.id} (themes ${subDeck.chainThemeIds.join(',')}): ${subDeck.factIds.length} facts`);
}

// Validate all facts are covered by a sub-deck
const coveredIds = new Set(SUB_DECKS.flatMap(sd => sd.factIds));
const uncoveredFacts = allFacts.filter(f => !coveredIds.has(f.id));
if (uncoveredFacts.length > 0) {
  console.warn(`WARNING: ${uncoveredFacts.length} fact(s) not covered by any sub-deck:`);
  uncoveredFacts.forEach(f => console.warn(`  ${f.id} (chainThemeId=${f.chainThemeId})`));
}

// ─── Assemble final deck ───────────────────────────────────────────────────
console.log('\nAssembling final deck...');

const deck = {
  id: 'anime_manga',
  name: 'Anime & Manga',
  domain: 'art_architecture',
  subDomain: 'anime_manga',
  description: 'From Astro Boy to Demon Slayer — test your knowledge of anime, manga, their legendary creators, and the culture that conquered the world.',
  minimumFacts: 150,
  targetFacts: 210,
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

// ─── Update narratives manifest ────────────────────────────────────────────
console.log('\nChecking narratives manifest...');
if (fs.existsSync(MANIFEST_FILE)) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const MANIFEST_ENTRY = 'anime_manga.json';
  if (!manifest.files.includes(MANIFEST_ENTRY)) {
    manifest.files.push(MANIFEST_ENTRY);
    manifest.files.sort();
    manifest.generated = new Date().toISOString();
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    console.log(`  Added '${MANIFEST_ENTRY}' to manifest.`);
  } else {
    console.log(`  '${MANIFEST_ENTRY}' already in manifest — no change.`);
  }
} else {
  console.warn('  WARNING: manifest.json not found — skipping manifest update.');
}

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
  console.log(`  ${file}: ${count} facts (${theme?.name ?? 'mixed'})`);
}
console.log('\nPool breakdown:');
for (const pool of answerTypePools) {
  const bar = '█'.repeat(Math.round(pool.factIds.length / 3));
  console.log(`  ${pool.id.padEnd(30)} ${String(pool.factIds.length).padStart(3)} facts  ${bar}`);
}
console.log('\nSub-deck breakdown:');
for (const sd of SUB_DECKS) {
  console.log(`  ${sd.id.padEnd(22)} ${String(sd.factIds.length).padStart(3)} facts  (themes: ${sd.chainThemeIds.join(', ')})`);
}
console.log('\nDifficulty distribution:');
console.log(`  Easy (1-2):  ${easyIds.length} (${((easyIds.length/allFacts.length)*100).toFixed(1)}%)`);
console.log(`  Medium (3):  ${mediumIds.length} (${((mediumIds.length/allFacts.length)*100).toFixed(1)}%)`);
console.log(`  Hard (4-5):  ${hardIds.length} (${((hardIds.length/allFacts.length)*100).toFixed(1)}%)`);
