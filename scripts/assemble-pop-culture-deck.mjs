/**
 * Assembly script for pop_culture.json deck.
 * Merges 6 batch files, fixes bracket_numbers format, populates pools and subDecks.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// ── Load all 6 batches ────────────────────────────────────────────────────────
const batchFiles = [
  '_wip/pop_culture_batch1_binge_worthy.json',
  '_wip/pop_culture_batch2_game_on.json',
  '_wip/pop_culture_batch3_hero_complex.json',
  '_wip/pop_culture_batch4_gone_viral.json',
  '_wip/pop_culture_batch5_franchise_empires.json',
  '_wip/pop_culture_batch6_pop_icons.json',
];

let allFacts = [];
for (const f of batchFiles) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/decks', f), 'utf8'));
  allFacts.push(...raw);
}

console.log(`Loaded ${allFacts.length} facts from 6 batches`);

// ── Check for duplicate IDs ───────────────────────────────────────────────────
const idCounts = {};
for (const f of allFacts) {
  idCounts[f.id] = (idCounts[f.id] || 0) + 1;
}
const dupes = Object.entries(idCounts).filter(([, c]) => c > 1);
if (dupes.length > 0) {
  console.warn('DUPLICATE IDs found:', dupes.map(([id]) => id).join(', '));
  // Rename duplicates by appending _b
  const seen = new Set();
  for (const f of allFacts) {
    if (seen.has(f.id)) {
      const origId = f.id;
      f.id = f.id + '_b';
      console.warn(`  Renamed duplicate: ${origId} → ${f.id}`);
    }
    seen.add(f.id);
  }
}

// ── Fix bracket_numbers: collapse overly-specific large numbers ───────────────
// Rules:
//  - Numbers >= 1_000_000_000 → divide by 1B, update question to include "billion"
//  - Numbers >= 1_000_000 (but < 1B) → divide by 1M, update question to include "million"
//  - Numbers < 1_000_000 → leave as-is (counts, years, small figures)
//  - Years (4-digit 19xx/20xx) → always leave as-is
//  - Also fix distractors in bracket_numbers pool facts

const BRACKET_RE = /^\{(-?\d+(?:\.\d+)?)\}$/;

function isYear(n) {
  return n >= 1900 && n <= 2030;
}

function fixBracketValue(val, questionRef) {
  const m = val.match(BRACKET_RE);
  if (!m) return val;
  const n = parseFloat(m[1]);
  if (isYear(n)) return val;
  if (n >= 1_000_000_000) {
    // Convert to billions
    const b = n / 1_000_000_000;
    return `{${b % 1 === 0 ? b : b.toFixed(1)}}`;
  }
  if (n >= 1_000_000) {
    // Convert to millions
    const mn = n / 1_000_000;
    return `{${mn % 1 === 0 ? mn : mn.toFixed(1)}}`;
  }
  return val;
}

function questionNeedsMillionUnit(q, n) {
  const lower = q.toLowerCase();
  // If question already has "million" or "billion", skip
  if (lower.includes('million') || lower.includes('billion')) return false;
  return n >= 1_000_000;
}

function addUnitToQuestion(q, n) {
  if (n >= 1_000_000_000) {
    // Add "billion" after number references like "viewers", "copies", "hours", "revenue"
    // Simple heuristic: if question doesn't already say billion, append note
    return q; // questions already updated manually in each batch
  }
  return q;
}

let fixCount = 0;
for (const fact of allFacts) {
  if (fact.answerTypePoolId !== 'bracket_numbers') continue;

  const m = (fact.correctAnswer || '').match(BRACKET_RE);
  if (!m) continue;
  const n = parseFloat(m[1]);
  if (isYear(n) || n < 1_000_000) continue;

  const newVal = fixBracketValue(fact.correctAnswer, fact.quizQuestion);
  if (newVal !== fact.correctAnswer) {
    // Update acceptableAlternatives too - they're string descriptions, leave them
    console.log(`  Fix bracket: ${fact.id}: ${fact.correctAnswer} → ${newVal}`);
    fact.correctAnswer = newVal;
    fixCount++;

    // Fix distractors too
    if (Array.isArray(fact.distractors)) {
      fact.distractors = fact.distractors.map(d => fixBracketValue(d, ''));
    }
  }

  // Make sure question mentions the unit if it's a large number
  const newN = parseFloat((fact.correctAnswer.match(BRACKET_RE) || ['', '0'])[1]);
  if (questionNeedsMillionUnit(fact.quizQuestion, n)) {
    // Best effort: mark for manual review (the batch questions already have units in most cases)
    console.warn(`  REVIEW UNIT: ${fact.id} - question may be missing "million" unit`);
  }
}
console.log(`Fixed ${fixCount} bracket_number values`);

// ── Check "The Dress" pool assignment ─────────────────────────────────────────
// fact pc_3_the_dress_actual_color has correctAnswer "blue and black" in meme_viral_names
// That's fine - the question asks for the actual color, and the pool has other meme-named
// answers. However "blue and black" doesn't semantically fit meme_viral_names.
// The instruction says to move it to a more appropriate pool or keep it.
// Let's move it to genre_format_names since it's a description format answer.
for (const fact of allFacts) {
  if (fact.id === 'pc_3_the_dress_actual_color' ||
      (fact.correctAnswer === 'blue and black' && fact.answerTypePoolId === 'meme_viral_names')) {
    console.log(`  Moving "${fact.id}" from meme_viral_names to genre_format_names`);
    fact.answerTypePoolId = 'genre_format_names';
  }
}

// ── Define the 10 pools ───────────────────────────────────────────────────────
const poolDefs = [
  { id: 'tv_show_names', label: 'TV Show Names', answerFormat: 'name' },
  { id: 'game_titles', label: 'Video Game Titles', answerFormat: 'name' },
  { id: 'character_names', label: 'Fictional Character Names', answerFormat: 'name' },
  { id: 'person_names_creators', label: 'Creators & Real People', answerFormat: 'name' },
  { id: 'company_studio_names', label: 'Companies, Studios & Networks', answerFormat: 'name' },
  { id: 'franchise_ip_names', label: 'Franchise & IP Names', answerFormat: 'name' },
  { id: 'platform_console_names', label: 'Consoles, Platforms & Services', answerFormat: 'name' },
  { id: 'meme_viral_names', label: 'Meme & Viral Content Names', answerFormat: 'name' },
  { id: 'genre_format_names', label: 'Genres & Formats', answerFormat: 'term' },
  { id: 'bracket_numbers', label: 'Numbers (Years, Counts, Revenue)', answerFormat: 'bracket',
    homogeneityExempt: true,
    homogeneityExemptNote: 'Bracket pool contains years (4-digit), viewer counts (millions), sales figures (millions/billions), and award counts. Each question surfaces contextually appropriate distractors from the same numeric register.' },
];

// Populate factIds for each pool
const pools = poolDefs.map(def => {
  const factIds = allFacts
    .filter(f => f.answerTypePoolId === def.id)
    .map(f => f.id);
  return {
    id: def.id,
    label: def.label,
    answerFormat: def.answerFormat,
    ...(def.homogeneityExempt ? { homogeneityExempt: true, homogeneityExemptNote: def.homogeneityExemptNote } : {}),
    factIds,
    syntheticDistractors: [],
  };
});

// Report pool sizes
for (const p of pools) {
  const total = p.factIds.length + (p.syntheticDistractors?.length || 0);
  const flag = total < 15 ? ' ⚠ NEEDS SYNTHETIC DISTRACTORS' : '';
  console.log(`  Pool ${p.id}: ${p.factIds.length} facts${flag}`);
}

// ── Define subDecks ───────────────────────────────────────────────────────────
const subDeckDefs = [
  { id: 'binge_worthy', name: 'Binge-Worthy', chainThemeId: 0 },
  { id: 'game_on', name: 'Game On', chainThemeId: 1 },
  { id: 'hero_complex', name: 'Hero Complex', chainThemeId: 2 },
  { id: 'gone_viral', name: 'Gone Viral', chainThemeId: 3 },
  { id: 'franchise_empires', name: 'Franchise Empires', chainThemeId: 4 },
  { id: 'pop_icons', name: 'Pop Icons', chainThemeId: 5 },
];

const subDecks = subDeckDefs.map(def => {
  const factIds = allFacts
    .filter(f => f.chainThemeId === def.chainThemeId)
    .map(f => f.id);
  return {
    id: def.id,
    name: def.name,
    chainThemeId: def.chainThemeId,
    factIds,
  };
});

// Report subDeck sizes
for (const sd of subDecks) {
  console.log(`  SubDeck ${sd.id} (chainTheme ${sd.chainThemeId}): ${sd.factIds.length} facts`);
}

// ── Assemble deck ────────────────────────────────────────────────────────────
const deck = {
  id: 'pop_culture',
  name: 'Pop Culture',
  domain: 'general_knowledge',
  subDomain: 'pop_culture',
  description: 'From binge-worthy TV to viral memes — master the shows, games, heroes, and moments that define modern entertainment culture.',
  minimumFacts: 150,
  targetFacts: 200,
  facts: allFacts,
  answerTypePools: pools,
  subDecks,
};

// ── Validate ─────────────────────────────────────────────────────────────────
console.log(`\nTotal facts: ${deck.facts.length}`);
const chainIds = [...new Set(allFacts.map(f => f.chainThemeId))].sort();
console.log(`Chain theme IDs present: ${chainIds.join(', ')}`);

// Check every fact has a valid pool
const poolIds = new Set(pools.map(p => p.id));
let unknownPool = 0;
for (const f of allFacts) {
  if (!poolIds.has(f.answerTypePoolId)) {
    console.warn(`  Unknown pool: ${f.id} → ${f.answerTypePoolId}`);
    unknownPool++;
  }
}
if (unknownPool === 0) console.log('All facts reference valid pools ✓');

// ── Write output ──────────────────────────────────────────────────────────────
const outPath = path.join(root, 'data/decks/pop_culture.json');
fs.writeFileSync(outPath, JSON.stringify(deck, null, 2), 'utf8');
console.log(`\nWrote ${outPath}`);

// ── Identify pools that need synthetic distractors ───────────────────────────
console.log('\n--- Pools needing synthetic distractors (< 15 factIds) ---');
for (const p of pools) {
  if (p.factIds.length < 15) {
    console.log(`  ${p.id}: ${p.factIds.length} (need ${15 - p.factIds.length} more)`);
    // Show example answers from the pool
    const examples = allFacts
      .filter(f => f.answerTypePoolId === p.id)
      .slice(0, 5)
      .map(f => `"${f.correctAnswer}"`);
    console.log(`    Examples: ${examples.join(', ')}`);
  }
}
