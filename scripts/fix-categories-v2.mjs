/**
 * fix-categories-v2.mjs
 *
 * Fixes clear-cut miscategorizations identified in data/sonnet-full-review.json.
 * Only applies unambiguous fixes — borderline cases are skipped.
 *
 * Rules applied:
 * 1. Plants in animals_wildlife → natural_sciences/biology_organisms
 * 2. Freshwater species in marine_life → animals_wildlife/freshwater_fish
 * 3. Music/composers in art_architecture → art_architecture/music_performance
 * 4. Literature/poets in art_architecture painting_visual or wrong l2 → art_architecture/literature
 * 5. Theater/performing arts in painting_visual or sculpture_decorative → art_architecture/performing_arts
 * 6. Palestinian geography in europe → geography/asia_oceania
 * 7. History medieval misclassified as ancient_classical → history/medieval
 * 8. Civil war in world_wars → history/battles_military
 * 9. Qing dynasty last emperor in ancient_classical → history/modern_contemporary
 * 10. Animals/mammals misclassified in human_body_health → animals_wildlife/mammals
 * 11. Mesoamerican myth in eastern_myths → mythology_folklore/gods_deities
 * 12. Americas geography with wrong category_l1 → geography/americas
 * 13. Europe geography with wrong category_l1 → geography/europe
 * 14. Math facts in physics_mechanics → natural_sciences/mathematics
 *
 * Run: node scripts/fix-categories-v2.mjs
 * Working directory: /Users/damion/CODE/Recall_Rogue
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DB_PATH = resolve('public/facts.db');
const db = new Database(DB_PATH);

let changesApplied = 0;
let skipped = 0;

/**
 * Apply a category change with logging.
 * @param {string} id - Fact ID
 * @param {string|null} newL1 - New category_l1 (null = no change)
 * @param {string|null} newL2 - New category_l2 (null = no change)
 * @param {string} reason - Human-readable reason for the change
 * @param {object} currentRow - Current DB row (for display)
 */
function applyFix(id, newL1, newL2, reason, currentRow) {
  const oldL1 = currentRow.category_l1;
  const oldL2 = currentRow.category_l2;

  // Skip if already correct
  if (
    (newL1 === null || newL1 === oldL1) &&
    (newL2 === null || newL2 === oldL2)
  ) {
    console.log(`[SKIP already correct] ${id}: ${oldL1}/${oldL2}`);
    skipped++;
    return;
  }

  const finalL1 = newL1 ?? oldL1;
  const finalL2 = newL2 ?? oldL2;

  const stmt = db.prepare('UPDATE facts SET category_l1 = ?, category_l2 = ? WHERE id = ?');
  stmt.run(finalL1, finalL2, id);

  console.log(`[FIXED] ${id}`);
  console.log(`        ${oldL1}/${oldL2} → ${finalL1}/${finalL2}`);
  console.log(`        Reason: ${reason}`);
  changesApplied++;
}

/**
 * Look up a fact by ID. Returns null if not found.
 */
function getRow(id) {
  return db.prepare('SELECT id, category_l1, category_l2 FROM facts WHERE id = ?').get(id) ?? null;
}

console.log('=== fix-categories-v2.mjs ===');
console.log(`Database: ${DB_PATH}`);
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1: Plants in animals_wildlife → natural_sciences/biology_organisms
// These are clearly plants with nothing to do with animals/wildlife
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 1: Plants in animals_wildlife ──');
const plantIds = [
  'animals_wildlife-ginkgo-hiroshima-survivor',
  'animals_wildlife-ginkgo-290-million-years',
  'animals_wildlife-coconut-austronesian',
  'animals_wildlife-coconut-production',
  'animals_wildlife-orchid-germination',
  'animals_wildlife-orchid-pollination-deception',
  'animals_wildlife-watermelon-origin-africa',
  'animals_wildlife-watermelon-botanically-berry',
  'animals_wildlife-oak-caterpillars',
  'animals_wildlife-oak-species-threatened',
];
for (const id of plantIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  applyFix(id, 'natural_sciences', 'biology_organisms', 'Plant fact miscategorized under animals_wildlife', row);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2: Freshwater species in marine_life → animals_wildlife/freshwater_fish
// Only facts that are explicitly about freshwater species filed under marine_life
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 2: Freshwater species in marine_life ──');
const freshwaterMarineIds = [
  // Pike
  'animals_wildlife-pike-size-record',
  'animals_wildlife-pike-world-record',
  'animals_wildlife-pike-holarctic',
  'animals-pike-world-record-catch',
  'animals-pike-eurasia-larger',
  // Goldfish
  'animals-goldfish-bred-china',
  // Guppies
  'animals-guppy-livebearer-distribution',
  'animals-guppy-model-organism',
  'animals-guppy-sex-size-difference',
  'animals_wildlife-guppy-global-invasion',
  'animals_wildlife-guppy-worldwide-distribution',
  // Lungfish (freshwater)
  'animals-lungfish-tetrapod-relatives',
];
for (const id of freshwaterMarineIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  if (row.category_l2 !== 'marine_life') {
    console.log(`[SKIP not marine_life] ${id}: ${row.category_l1}/${row.category_l2}`);
    skipped++;
    continue;
  }
  applyFix(id, 'animals_wildlife', 'freshwater_fish', 'Freshwater species incorrectly filed under marine_life', row);
}

// Baikal seal — freshwater mammal; move to mammals (not freshwater_fish)
const baikalseal = getRow('animals_wildlife-phocidae-baikal-freshwater');
if (baikalseal) {
  applyFix('animals_wildlife-phocidae-baikal-freshwater', 'animals_wildlife', 'mammals',
    'Baikal seal is an exclusively freshwater mammal, not a marine species', baikalseal);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 3: Music/composers in art_architecture → art_architecture/music_performance
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 3: Music/composers in art_architecture ──');
const musicInArtIds = [
  // Vivaldi
  'art_architecture-vivaldi-four-seasons-orphanage',
  'art_architecture-vivaldi-red-priest-ordained',
  'art_architecture-vivaldi-died-poverty-vienna',
  'art-vivaldi-il-prete-rosso-red-priest',
  // Schubert
  'art_architecture-schubert-600-lieder-age-31',
  // Bob Marley
  'art_architecture-bob-marley-reggae-pioneer',
  'art_architecture-bob-marley-rastafarian-symbol',
  // Opera/conductors
  'art_architecture-opera-conductor-19th-century',
  // Baroque music
  'art_architecture-baroque-music-opera-invented',
];
for (const id of musicInArtIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  applyFix(id, 'art_architecture', 'music_performance', 'Music/composer fact miscategorized in non-music art subcategory', row);
}

// Debussy: specifically critical, suggested recategorize to music domain
// Keeping in art_architecture but moving to music_performance is the clean-cut fix
const debussy = getRow('art_architecture-debussy-impressionist-rejected');
if (debussy) {
  applyFix('art_architecture-debussy-impressionist-rejected', 'art_architecture', 'music_performance',
    'Debussy is a composer — music fact not visual art', debussy);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 4: Literature/poets in art_architecture painting_visual → art_architecture/literature
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 4: Literature/poets in art_architecture ──');
const literatureInArtIds = [
  // Iliad
  'art_architecture-iliad-15693-lines',
  // Baudelaire (poet) — rhapsodes performance is border, but the main Baudelaire poet facts are literature
  'art_architecture-charles-baudelaire-coined-modernity',
  'art_architecture-charles-baudelaire-flowers-of-evil',
  // Baudelaire art critic fact → modern_contemporary is more appropriate than painting_visual
  // suggested_fix says "Change category_l2 to 'modern_contemporary'" — use literature as it's about a poet
  'art_architecture-baudelaire-art-critic',
  // Cervantes
  'art_architecture-novel-cervantes-first',
  // Dumas
  'art_architecture-dumas-200-film-adaptations',
  // Journey to the West (novel)
  'art_architecture-journey-to-the-west-most-popular',
  // Neruda
  'art_architecture-neruda-pen-name-secret',
];
for (const id of literatureInArtIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  applyFix(id, 'art_architecture', 'literature', 'Literature/poetry fact miscategorized in non-literature art subcategory', row);
}

// Iliad rhapsodes — performing aspect, but still literature; move to literature
const iliadRhapsodes = getRow('art_architecture-iliad-rhapsodes');
if (iliadRhapsodes) {
  applyFix('art_architecture-iliad-rhapsodes', 'art_architecture', 'literature',
    'Iliad oral performance tradition is literature, not painting_visual', iliadRhapsodes);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 5: Theater/performing arts in painting_visual or sculpture_decorative
//         → art_architecture/performing_arts
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 5: Theater/performing arts ──');
const theaterIds = [
  'art_architecture-kabuki-female-founder-male-performers',
  'art_architecture-kabuki-founded-by-woman',
  'art_architecture-noh-oldest-japanese-theatre',
  'art_architecture-noh-theater-age',
  'art_architecture-oedipus-rex-second-place',
];
for (const id of theaterIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  applyFix(id, 'art_architecture', 'performing_arts', 'Theater/performing arts fact miscategorized in visual art subcategory', row);
}

// Textile/industrial revolution fact — in sculpture_decorative, clearly belongs in history
const textileIndustrial = getRow('art-textile-industrial-revolution');
if (textileIndustrial) {
  // suggested_fix: Recategorize to history
  applyFix('art-textile-industrial-revolution', 'history', 'modern_contemporary',
    'Industrial Revolution/Luddite fact has no connection to sculpture_decorative', textileIndustrial);
}

// Textile/silk road — in sculpture_decorative, belongs in history or world cultures
const textileSilkRoad = getRow('art-textile-silk-road');
if (textileSilkRoad) {
  // suggested_fix: Recategorize to history/trade or world cultures — skip (borderline between history/geography)
  // The suggested fix says art_architecture "applied_arts would be less wrong" — this is borderline, skip
  console.log('[SKIP borderline] art-textile-silk-road: trade route fact, borderline history/art, no clear-cut single target');
  skipped++;
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 6: Palestine in europe → geography/asia_oceania
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 6: Palestine in europe ──');
const palestineRow = getRow('geography-palestine-capital-ramallah');
if (palestineRow) {
  applyFix('geography-palestine-capital-ramallah', 'geography', 'asia_oceania',
    'Palestine is in Asia (Middle East), not Europe', palestineRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 7: Medieval empires miscategorized as ancient_classical
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 7: Medieval facts in ancient_classical ──');
const medievalIds = [
  'history-first-bulgarian-empire-cyrillic',     // 681–1018 CE = medieval
  'history-first-bulgarian-empire-duration',     // same
  'history-liao-dynasty-first-manchuria',        // 907–1125 CE = medieval
  'history-liao-dynasty-chanyuan-treaty-120-years', // 1004 CE = medieval
  'history-liao-dynasty-western-liao-central-asia', // 1125 CE = medieval
];
for (const id of medievalIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  if (row.category_l2 !== 'ancient_classical') {
    console.log(`[SKIP not ancient_classical] ${id}: ${row.category_l1}/${row.category_l2}`);
    skipped++;
    continue;
  }
  applyFix(id, 'history', 'medieval', 'Medieval-era fact miscategorized as ancient_classical', row);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 8: American Civil War in world_wars → history/battles_military
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 8: Civil War in world_wars ──');
const civilWarRow = getRow('history-american-civil-war-slavery-abolished-nationally');
if (civilWarRow) {
  if (civilWarRow.category_l2 === 'world_wars') {
    applyFix('history-american-civil-war-slavery-abolished-nationally', 'history', 'battles_military',
      'American Civil War is a domestic conflict, not a world war', civilWarRow);
  } else {
    console.log(`[SKIP already fixed] history-american-civil-war-slavery-abolished-nationally: ${civilWarRow.category_l1}/${civilWarRow.category_l2}`);
    skipped++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 9: Qing dynasty last emperor in ancient_classical → history/modern_contemporary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 9: Qing dynasty in ancient_classical ──');
const qingRow = getRow('history-qing-dynasty-last-emperor');
if (qingRow) {
  if (qingRow.category_l2 === 'ancient_classical') {
    applyFix('history-qing-dynasty-last-emperor', 'history', 'modern_contemporary',
      'Qing Dynasty last emperor (1912) is modern, not ancient', qingRow);
  } else {
    console.log(`[SKIP already correct] history-qing-dynasty-last-emperor: ${qingRow.category_l1}/${qingRow.category_l2}`);
    skipped++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 10: Animals/mammals miscategorized in human_body_health
//          → animals_wildlife/appropriate subcategory
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 10: Animals in human_body_health ──');
const animalInHealthIds = [
  { id: 'human_body_health-kangaroo-pouch-joey', newL2: 'mammals' },
  { id: 'human_body_health-kangaroo-teeth-replacement', newL2: 'mammals' },
  { id: 'human_body_health-mammoth-survival-4000bce', newL2: 'mammals' },
  { id: 'human_body_health-mammoth-woolly-evolution', newL2: 'mammals' },
];
for (const { id, newL2 } of animalInHealthIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  applyFix(id, 'animals_wildlife', newL2, 'Animal/paleontology fact miscategorized under human_body_health', row);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 11: Mesoamerican myth in eastern_myths → mythology_folklore/gods_deities
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 11: Mesoamerican myth in eastern_myths ──');
const quetzalcoatlRow = getRow('mythology_folklore-quetzalcoatl-feathered-serpent');
if (quetzalcoatlRow) {
  if (quetzalcoatlRow.category_l2 === 'eastern_myths') {
    applyFix('mythology_folklore-quetzalcoatl-feathered-serpent', 'mythology_folklore', 'gods_deities',
      'Aztec/Mesoamerican deity is not "eastern_myths"; companion fact uses gods_deities', quetzalcoatlRow);
  } else {
    console.log(`[SKIP already fixed] mythology_folklore-quetzalcoatl-feathered-serpent: ${quetzalcoatlRow.category_l1}/${quetzalcoatlRow.category_l2}`);
    skipped++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 12: Americas/europe geography with wrong category_l1
//          geography facts that have category_l1='americas' or 'europe' instead of 'geography'
//          Per the review: these should be category_l1='geography'
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 12 & 13: Americas/Europe geography with wrong category_l1 ──');

// Americas geography facts that should be category_l1='geography'
const americasGeoIds = [
  'geography-ecuador-galapagos-endemic',
  'geography-bolivia-landlocked-largest-southern',
  'geography-paraguay-guarani-language',
  'geography-haiti-slave-revolution',
  'geography-dominica-boiling-lake',
  'geography-suriname-dutch-speaking',
  'geography-dominican-republic-tallest-caribbean',
  'geography-guatemala-maya-most-populous-central-america',
];
for (const id of americasGeoIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  if (row.category_l1 !== 'americas') {
    console.log(`[SKIP not americas] ${id}: ${row.category_l1}/${row.category_l2}`);
    skipped++;
    continue;
  }
  applyFix(id, 'geography', null, 'Geography fact has wrong category_l1 (americas → geography)', row);
}

// Kharkiv fact has category_l1='europe' but should be 'geography'
const kharkivRow = getRow('geography-kharkiv-former-ussr-capital');
if (kharkivRow) {
  if (kharkivRow.category_l1 === 'europe') {
    applyFix('geography-kharkiv-former-ussr-capital', 'geography', 'europe',
      'Geography fact has wrong category_l1 (europe → geography), keeping category_l2=europe', kharkivRow);
  } else {
    console.log(`[SKIP] geography-kharkiv-former-ussr-capital: ${kharkivRow.category_l1}/${kharkivRow.category_l2}`);
    skipped++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 14: Math facts in physics_mechanics → natural_sciences/mathematics
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RULE 14: Math facts in physics_mechanics ──');
const mathInPhysicsIds = [
  'science-trigonometry-india-sine',
  'science-algorithm-al-khwarizmi-name',
  'science-algorithm-heuristic-distinction',
  'science-zero-indian-origin-fibonacci',
  'science-zero-dividing-undefined',
  'science-zero-additive-identity',
];
for (const id of mathInPhysicsIds) {
  const row = getRow(id);
  if (!row) { console.log(`[NOT FOUND] ${id}`); continue; }
  if (row.category_l2 !== 'physics_mechanics') {
    console.log(`[SKIP not physics_mechanics] ${id}: ${row.category_l1}/${row.category_l2}`);
    skipped++;
    continue;
  }
  applyFix(id, 'natural_sciences', 'mathematics', 'Mathematics fact miscategorized under physics_mechanics', row);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log(`Changes applied : ${changesApplied}`);
console.log(`Skipped         : ${skipped}`);
console.log('═══════════════════════════════════════════════');

db.close();
