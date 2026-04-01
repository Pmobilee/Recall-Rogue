/**
 * Fix Script: world_wonders.json — 3 QA issues
 *
 * Issue 1: 97 unsafe distractors that match a correct answer in the same pool
 * Issue 2: location_city pool too small (2 facts) — merge into location_country
 * Issue 3: 2 facts with only 6 distractors — need 7+
 *
 * Run: node data/decks/_wip/fix-world-wonders.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deckPath = join(__dirname, '../world_wonders.json');

const deck = JSON.parse(readFileSync(deckPath, 'utf-8'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(s) { return (s || '').trim().toLowerCase(); }

// ─── Replacement distractor banks per pool type ──────────────────────────────
// These are plausible values that must NOT overlap with any correct answer
// in the pool. The fix logic will check and skip any that happen to match.

const REPLACEMENT_BANKS = {
  measurement_number: [
    '94 metres', '112 metres', '267 metres', '412 metres', '55 metres',
    '73 metres', '48 metres', '320 metres', '450 metres', '620 metres',
    '38 metres', '210 metres', '760 metres', '895 metres', '1,050 metres',
    '1,400 metres', '1,650 metres', '2,800 metres', '380 metres', '940 metres',
    '65 floors', '75 floors', '95 floors', '110 floors', '115 floors',
    '120 floors', '140 floors', '150 floors', '170 floors', '180 floors',
    '14 floors', '22 floors', '45 floors', '55 floors',
    '67 years', '28 years', '15 years', '52 years', '19 years', '44 years',
    '73 years', '87 years', '11 years', '63 years',
    '18,000', '25,000', '35,000', '45,000', '60,000', '70,000', '90,000',
    '120,000', '250,000', '300,000', '400,000', '600,000', '750,000',
    '1.2 million', '2 million', '4 million', '6 million', '7 million',
    '8,000 km', '9,500 km', '12,000 km', '18,000 km', '25,000 km',
    '6,500 km', '4,200 km', '7,800 km', '11,000 km',
    '400 metres', '600 metres', '650 metres', '700 metres', '750 metres',
    '800 metres', '850 metres', '900 metres', '950 metres', '1,000 metres',
    '1,100 metres', '1,300 metres', '1,500 metres', '1,600 metres', '1,700 metres',
    '1,800 metres', '1,900 metres', '2,000 metres', '2,100 metres', '2,200 metres',
    '56 metres', '62 metres', '68 metres', '78 metres', '82 metres',
    '88 metres', '93 metres', '97 metres', '103 metres', '107 metres',
    '113 metres', '119 metres', '123 metres', '127 metres', '133 metres',
    '137 metres', '141 metres', '147 metres', '152 metres', '157 metres',
    '162 metres', '167 metres', '172 metres', '177 metres', '183 metres',
    '188 metres', '194 metres', '199 metres', '204 metres',
    '720 square metres', '2,500 m²', '4,200 m²', '6,800 m²', '9,500 m²',
    '12,000 m²', '18,000 m²', '25,000 m²', '30,000 m²', '40,000 m²',
    '22,500 MW', '10,000 MW', '8,000 MW', '5,000 MW', '3,000 MW', '1,500 MW',
    '200 MW', '500 MW', '750 MW',
    '24', '26', '32', '34', '36', '37', '38', '39', '40', '42',
    '44', '45', '46', '48', '49', '51', '52', '53', '54', '55',
    '57', '58', '59', '61', '62', '63', '64', '65', '67', '68',
    '69', '71', '72', '74', '75', '76', '77', '78', '79', '81',
    '28 years', '35 years', '46 years', '53 years', '58 years', '62 years',
    '68 years', '75 years', '82 years', '91 years',
    '40 years', '45 years', '47 years', '50 years', '55 years', '57 years',
    '60 years', '65 years', '70 years', '77 years', '80 years', '85 years', '90 years',
    '0.5 million', '0.8 million', '3.5 million', '4.5 million', '5.5 million',
    '6.5 million', '7.5 million', '8.5 million', '9 million', '10 million',
    '11 million', '12 million', '15 million',
    '10,500', '12,000', '14,000', '16,000', '18,000', '22,000', '24,000',
    '26,000', '28,000', '32,000', '36,000', '38,000', '40,000', '42,000',
    '46,000', '48,000', '52,000', '54,000', '55,000', '56,000', '58,000',
    '62,000', '64,000', '66,000', '68,000', '72,000', '74,000', '76,000',
    '78,000', '82,000', '84,000', '86,000', '92,000',
    'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    '2 tunnels', '4 tunnels', '5 tunnels', '6 tunnels',
    '50 kilometres', '60 kilometres', '65 kilometres', '70 kilometres',
    '75 kilometres', '80 kilometres', '85 kilometres', '90 kilometres',
    '95 kilometres', '100 kilometres', '110 kilometres', '115 kilometres',
    '120 kilometres', '125 kilometres', '130 kilometres',
    '43 kilometres', '53 kilometres', '57 kilometres', '62 kilometres',
    '67 kilometres', '72 kilometres', '77 kilometres', '87 kilometres',
    '92 kilometres', '97 kilometres', '102 kilometres', '107 kilometres',
    '112 kilometres', '117 kilometres',
    '250 metres', '260 metres', '270 metres', '280 metres', '295 metres',
    '305 metres', '315 metres', '325 metres', '335 metres', '345 metres',
    '355 metres', '365 metres', '375 metres', '385 metres', '395 metres',
    '405 metres', '415 metres', '425 metres', '435 metres', '445 metres',
    '455 metres', '465 metres', '475 metres',
  ],

  architect_designer: [
    'Le Corbusier', 'I.M. Pei', 'Zaha Hadid', 'Tadao Ando', 'Oscar Niemeyer',
    'Louis Sullivan', 'Philip Johnson', 'Alvar Aalto', 'Rem Koolhaas',
    'Eero Saarinen', 'Louis Kahn', 'Mies van der Rohe', 'Walter Gropius',
    'Frank Lloyd Wright', 'Richard Rogers', 'Peter Zumthor',
    'Kengo Kuma', 'Bjarke Ingels', 'Shigeru Ban', 'Jean Nouvel',
    'Toyo Ito', 'Daniel Libeskind', 'Moshe Safdie', 'Arata Isozaki',
    'Fumihiko Maki', 'Rafael Moneo', 'Christian de Portzamparc',
    'Thom Mayne', 'Steven Holl', 'David Chipperfield',
    'Álvaro Siza', 'Glenn Murcutt', 'Wang Shu', 'Balkrishna Doshi',
    'Diébédo Francis Kéré', 'Anne Lacaton', 'Lacaton & Vassal',
    'Snøhetta', 'BIG (Bjarke Ingels Group)', 'OMA',
    'HOK Architects', 'SOM (Skidmore Owings & Merrill)',
    'Arup Associates', 'Wilkinson Eyre', 'Grimshaw Architects',
    'Terry Farrell', 'Michael Hopkins', 'Nicholas Grimshaw',
    'Denys Lasdun', 'Basil Spence', 'Edwin Lutyens',
    'Charles Rennie Mackintosh', 'John Vanbrugh', 'Christopher Wren',
    'Inigo Jones', 'John Nash', 'George Gilbert Scott',
    'Gilbert Scott', 'James Wyatt', 'Robert Adam',
    'Michelozzo di Bartolomeo', 'Filippo Brunelleschi', 'Leon Battista Alberti',
    'Donato Bramante', 'Giacomo della Porta', 'Carlo Maderno',
    'Gian Lorenzo Bernini', 'Francesco Borromini', 'Guarino Guarini',
    'Jules Hardouin-Mansart', 'Louis Le Vau', 'Ange-Jacques Gabriel',
    'Johann Fischer von Erlach', 'Lukas von Hildebrandt', 'Balthasar Neumann',
    'Matthäus Daniel Pöppelmann', 'Karl Friedrich Schinkel',
    'Mimar Sinan', 'Koca Kasim Agha', 'Sedefkâr Mehmed Agha',
    'Isidore of Miletus', 'Anthemius of Tralles',
  ],

  year_date: [
    '1200', '1250', '1275', '1300', '1325', '1350', '1375', '1400',
    '1425', '1450', '1475', '1500', '1510', '1520', '1530', '1540',
    '1550', '1560', '1570', '1580', '1590', '1600', '1610', '1620',
    '1630', '1640', '1650', '1660', '1670', '1680', '1690', '1700',
    '1710', '1720', '1730', '1740', '1750', '1760', '1770', '1780',
    '1790', '1800', '1810', '1820', '1830', '1840', '1845', '1850',
    '1855', '1860', '1865', '1870', '1875', '1880', '1882', '1884',
    '1886', '1888', '1890', '1892', '1895', '1897', '1899', '1901',
    '1903', '1905', '1907', '1908', '1909', '1910', '1911', '1912',
    '1913', '1915', '1916', '1917', '1918', '1919', '1920', '1921',
    '1922', '1923', '1924', '1925', '1926', '1927', '1928', '1929',
    '1930', '1931', '1932', '1933', '1934', '1935', '1936', '1937',
    '1938', '1939', '1940', '1941', '1942', '1943', '1944', '1945',
    '1946', '1947', '1949', '1950', '1951', '1952', '1953', '1954',
    '1955', '1956', '1957', '1959', '1960', '1961', '1963', '1964',
    '1965', '1966', '1967', '1968', '1969', '1970', '1971', '1972',
    '1973', '1974', '1975', '1976', '1977', '1978', '1979', '1980',
    '1981', '1982', '1983', '1984', '1985', '1986', '1987', '1988',
    '1989', '1990', '1991', '1992', '1993', '1994', '1995', '1996',
    '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004',
    '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012',
  ],

  material_feature: [
    'obsidian', 'slate', 'adobe', 'cast iron', 'bronze', 'terracotta',
    'fired brick', 'mud brick', 'sandstone', 'basalt', 'dolomite',
    'siltstone', 'travertine limestone', 'reinforced concrete', 'steel and glass',
    'timber frame', 'rammed earth', 'tuff stone', 'pumice', 'andesite',
    'quartzite', 'flint', 'porphyry', 'alabaster', 'lapis lazuli',
    'gilded copper', 'lead-covered timber', 'stucco on brick', 'fired clay',
    'polished diorite', 'black granite', 'pink limestone', 'red sandstone',
    'yellow sandstone', 'blue limestone', 'grey granite', 'white travertine',
    'teak wood', 'cedar wood', 'bamboo', 'lacquered wood',
    'hand-painted tiles', 'mosaic glass', 'fused glass', 'leaded glass',
    'polished steel', 'titanium panels', 'aluminium cladding', 'copper sheeting',
    'corrugated iron', 'wrought iron and brick',
  ],
};

// ─── Issue 2: Identify location_city facts to merge into location_country ─────

const locationCityPool = deck.answerTypePools.find(p => p.id === 'location_city');
const locationCountryPool = deck.answerTypePools.find(p => p.id === 'location_country');

const cityFactIds = locationCityPool ? [...locationCityPool.factIds] : [];
console.log(`location_city facts to merge: ${cityFactIds.join(', ')}`);

// Remap those facts' answerTypePoolId
let mergedCount = 0;
for (const fact of deck.facts) {
  if (cityFactIds.includes(fact.id)) {
    fact.answerTypePoolId = 'location_country';
    mergedCount++;
  }
}
console.log(`Merged ${mergedCount} facts from location_city → location_country`);

// Update pools in answerTypePools array
if (locationCityPool && locationCountryPool) {
  // Add cityFactIds to locationCountryPool
  locationCountryPool.factIds.push(...cityFactIds);
  // Remove the location_city pool entirely
  deck.answerTypePools = deck.answerTypePools.filter(p => p.id !== 'location_city');
  console.log(`Deleted location_city pool. location_country now has ${locationCountryPool.factIds.length} facts.`);
}

// ─── Build correct answer sets per pool AFTER the merge ──────────────────────

const poolCorrectAnswers = new Map(); // poolId -> Set<normalized>

for (const pool of deck.answerTypePools) {
  const answers = new Set();
  for (const fid of pool.factIds) {
    const fact = deck.facts.find(f => f.id === fid);
    if (!fact) continue;
    answers.add(normalize(fact.correctAnswer));
    for (const alt of (fact.acceptableAlternatives || [])) {
      answers.add(normalize(alt));
    }
  }
  poolCorrectAnswers.set(pool.id, answers);
}

// ─── Issue 3: Add missing distractors for 2 facts ────────────────────────────

// ww_anc_parthenon_architect needs 1 more architect distractor (safe)
// ww_sac_hagia_sophia_architects needs 1 more architect distractor (safe)

const shortDistractorFacts = [
  { id: 'ww_anc_parthenon_architect', pool: 'architect_designer' },
  { id: 'ww_sac_hagia_sophia_architects', pool: 'architect_designer' },
];

for (const { id, pool } of shortDistractorFacts) {
  const fact = deck.facts.find(f => f.id === id);
  if (!fact) { console.warn(`WARNING: Fact ${id} not found`); continue; }

  const poolAnswers = poolCorrectAnswers.get(pool) || new Set();
  const existingDistractors = new Set((fact.distractors || []).map(d => normalize(d)));
  const bank = REPLACEMENT_BANKS[pool] || [];

  let added = 0;
  for (const candidate of bank) {
    if (fact.distractors.length >= 7) break;
    const normCand = normalize(candidate);
    if (poolAnswers.has(normCand)) continue;       // would be a correct answer
    if (existingDistractors.has(normCand)) continue; // already exists
    fact.distractors.push(candidate);
    existingDistractors.add(normCand);
    added++;
  }
  console.log(`${id}: added ${added} distractor(s), now has ${fact.distractors.length}`);
}

// Rebuild poolCorrectAnswers again to include any new distractors added to
// the short-distractor facts (not needed, distractors don't go in correct answers).
// But DO rebuild after merge to have final state.

// ─── Issue 1: Replace unsafe distractors ─────────────────────────────────────

// We need per-pool replacement iterators that skip already-used values
// (correct answers AND distractors we've already emitted for this run).

// Build a pool-level "used distractors" set to avoid repeating replacements
// across different facts in the same pool.
const poolUsedReplacements = new Map(); // poolId -> Set<normalized>
for (const pool of deck.answerTypePools) {
  poolUsedReplacements.set(pool.id, new Set());
}

// Also pre-populate used replacements with all EXISTING distractors
// across all facts in each pool, so replacements are globally unique per pool.
for (const fact of deck.facts) {
  const poolId = fact.answerTypePoolId;
  const usedSet = poolUsedReplacements.get(poolId);
  if (!usedSet) continue;
  for (const d of (fact.distractors || [])) {
    usedSet.add(normalize(d));
  }
}

// Determine which pool type key to use for the bank
function getBankKey(poolId) {
  if (poolId === 'measurement_number') return 'measurement_number';
  if (poolId === 'architect_designer') return 'architect_designer';
  if (poolId === 'year_date') return 'year_date';
  if (poolId === 'material_feature') return 'material_feature';
  return null;
}

// Track per-pool iterator position so we don't always pick from index 0
const poolBankIndex = new Map();

function findReplacement(poolId, existingDistractorsOnFact) {
  const bankKey = getBankKey(poolId);
  if (!bankKey) return null;

  const bank = REPLACEMENT_BANKS[bankKey];
  const poolAnswers = poolCorrectAnswers.get(poolId) || new Set();
  const usedReplacements = poolUsedReplacements.get(poolId) || new Set();
  const existingOnFact = new Set((existingDistractorsOnFact || []).map(d => normalize(d)));

  let startIdx = poolBankIndex.get(poolId) || 0;

  for (let i = 0; i < bank.length; i++) {
    const idx = (startIdx + i) % bank.length;
    const candidate = bank[idx];
    const normCand = normalize(candidate);
    if (poolAnswers.has(normCand)) continue;
    if (usedReplacements.has(normCand)) continue;
    if (existingOnFact.has(normCand)) continue;

    // Found a good replacement
    poolBankIndex.set(poolId, (idx + 1) % bank.length);
    usedReplacements.add(normCand);
    return candidate;
  }

  // Bank exhausted — this would be a genuine problem but our bank is large enough
  return null;
}

let totalReplaced = 0;
let totalUnsafe = 0;

for (const fact of deck.facts) {
  const poolId = fact.answerTypePoolId;
  const poolAnswers = poolCorrectAnswers.get(poolId);
  if (!poolAnswers) continue;

  const newDistractors = [];
  for (const d of (fact.distractors || [])) {
    if (poolAnswers.has(normalize(d))) {
      totalUnsafe++;
      // Replace this unsafe distractor
      const replacement = findReplacement(poolId, newDistractors);
      if (replacement) {
        newDistractors.push(replacement);
        totalReplaced++;
      } else {
        // Keep the unsafe one if we truly can't find a replacement (shouldn't happen)
        console.warn(`WARNING: Could not find replacement for distractor "${d}" in pool "${poolId}" for fact ${fact.id}`);
        newDistractors.push(d);
      }
    } else {
      newDistractors.push(d);
    }
  }
  fact.distractors = newDistractors;
}

console.log(`\nDistractor safety: found ${totalUnsafe} unsafe, replaced ${totalReplaced}`);

// ─── Rebuild metadata structures ──────────────────────────────────────────────

// Rebuild difficultyTiers
const easy = deck.facts.filter(f => f.difficulty <= 2).map(f => f.id);
const medium = deck.facts.filter(f => f.difficulty === 3).map(f => f.id);
const hard = deck.facts.filter(f => f.difficulty >= 4).map(f => f.id);

deck.difficultyTiers = [
  { tier: 'easy', factIds: easy },
  { tier: 'medium', factIds: medium },
  { tier: 'hard', factIds: hard },
];
console.log(`Difficulty tiers rebuilt: easy=${easy.length} medium=${medium.length} hard=${hard.length}`);

// Rebuild subDecks factIds from facts (each fact has chainThemeId matching a subDeck)
// The subDecks array is kept but factIds need to be consistent with facts
// Since we didn't change chainThemeIds or IDs, we just need to rebuild subDeck factIds
// from the facts array, grouping by chainThemeId.

const chainThemeToSubDeck = new Map();
for (const sd of (deck.subDecks || [])) {
  chainThemeToSubDeck.set(sd.chainThemeId, sd);
  sd.factIds = []; // reset
}
for (const fact of deck.facts) {
  const sd = chainThemeToSubDeck.get(fact.chainThemeId);
  if (sd) sd.factIds.push(fact.id);
}

// Verify subDeck counts
for (const sd of deck.subDecks) {
  console.log(`SubDeck ${sd.id}: ${sd.factIds.length} facts`);
}

// Rebuild pool factIds from facts
for (const pool of deck.answerTypePools) {
  pool.factIds = deck.facts.filter(f => f.answerTypePoolId === pool.id).map(f => f.id);
  console.log(`Pool ${pool.id}: ${pool.factIds.length} facts`);
}

// ─── Write the fixed deck ────────────────────────────────────────────────────

writeFileSync(deckPath, JSON.stringify(deck, null, 2) + '\n', 'utf-8');
console.log(`\nWrote fixed deck to ${deckPath}`);
console.log(`Total facts: ${deck.facts.length}`);
console.log(`Pools: ${deck.answerTypePools.map(p => p.id).join(', ')}`);
