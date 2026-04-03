/**
 * fix-deck-quality.mjs
 * One-shot script to fix all known data quality failures in curated decks.
 *
 * Fixes applied:
 * 1. human_anatomy: set difficulty=3, funScore=7 on facts missing them
 * 2. movies_cinema: cinema_singinrain_codirector difficulty 6 → 5
 * 3. Long correctAnswers (>100 chars) shortened across 8 decks
 *    - Non-anatomy decks: use curated manual replacements
 *    - human_anatomy: use curated replacements where provided, else smart-truncate
 * 4. Distractor collisions removed from 9 specific facts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = path.join(__dirname, '../data/decks');

function readDeck(filename) {
  return JSON.parse(fs.readFileSync(path.join(DECKS_DIR, filename), 'utf8'));
}

function writeDeck(filename, deck) {
  fs.writeFileSync(path.join(DECKS_DIR, filename), JSON.stringify(deck, null, 2) + '\n');
}

/**
 * Smart-truncate an answer to ≤100 chars.
 * Tries to cut at a natural boundary (semicolon, period, comma, dash, space).
 * Never truncates mid-word or leaves trailing punctuation.
 */
function smartTruncate(s, maxLen = 100) {
  if (s.length <= maxLen) return s;
  // Try boundaries in order of preference: '; ' then '. ' then '. ' then ', ' then ' — ' then ' '
  const boundaries = ['; ', '. ', ' — ', ', ', ' '];
  for (const sep of boundaries) {
    const idx = s.lastIndexOf(sep, maxLen);
    if (idx > 30) {
      // Cut before the separator (omit trailing separator too)
      return s.slice(0, idx).trimEnd();
    }
  }
  // Last resort: cut at maxLen, find last space
  const spaceIdx = s.lastIndexOf(' ', maxLen);
  return spaceIdx > 30 ? s.slice(0, spaceIdx) : s.slice(0, maxLen);
}

// ─── FIX 1: human_anatomy — missing funScore and difficulty ──────────────────
{
  const deck = readDeck('human_anatomy.json');
  let fixed = 0;
  for (const fact of deck.facts) {
    let changed = false;
    if (fact.difficulty === undefined || fact.difficulty === null) {
      fact.difficulty = 3;
      changed = true;
    }
    if (fact.funScore === undefined || fact.funScore === null) {
      fact.funScore = 7;
      changed = true;
    }
    if (changed) fixed++;
  }
  writeDeck('human_anatomy.json', deck);
  console.log(`human_anatomy: fixed ${fixed} facts with missing difficulty/funScore`);
}

// ─── FIX 2: movies_cinema — difficulty 6 → 5 ─────────────────────────────────
{
  const deck = readDeck('movies_cinema.json');
  const fact = deck.facts.find(f => f.id === 'cinema_singinrain_codirector');
  if (fact && fact.difficulty === 6) {
    fact.difficulty = 5;
    console.log('movies_cinema: cinema_singinrain_codirector difficulty 6 → 5');
  } else {
    console.log('movies_cinema: no difficulty=6 fact found (already fixed?)');
  }
  writeDeck('movies_cinema.json', deck);
}

// ─── FIX 3: Long correctAnswers (>100 chars) ─────────────────────────────────
// Curated replacements for non-anatomy decks (all verified ≤100 chars)
const curatedFixes = {
  'ancient_greece.json': {
    'greece_rel_greek_religion_structure':
      'No unified priestly authority — religious practice organized at the civic level, varying by locality',
  },
  'ancient_rome.json': {
    'rome_rep_twelve_tables_purpose':
      'Plebeians demanded written laws so patricians could not arbitrarily interpret unwritten customs',
  },
  'ap_chemistry.json': {
    'ap_chem_7_7_equilibrium_concentrations_from_K':
      'Substitute ICE table expressions into K, solve for x, then back-calculate each concentration',
  },
  'egyptian_mythology.json': {
    'egypt_death_mummy_brain':
      'A hook inserted through the nostril broke into the brain cavity; contents were liquefied and drained',
    'egypt_sym_djed_byblos':
      "Isis found Osiris's body hidden in a tree there and consecrated the pillar by anointing it in linen",
    'egypt_sym_apis_bull_marks':
      'White forehead triangle, vulture on back, scarab under tongue, crescent on right flank, double tail',
  },
  'famous_inventions.json': {
    'inv_3_fiberoptic_kao':
      'Impurities, not physics, caused signal loss — silica glass would reduce attenuation below 20 dB/km',
    'inv_4_pat_bell_gray':
      "Bell's lawyer requested immediate processing; Gray's caveat sat in the in-basket until afternoon",
    'inv_4_pat_bell_controversy':
      "Whether Bell's patent unfairly included variable resistance technology shown in Gray's caveat",
    'inv_4_pat_penicillin_accident':
      'A mold contaminated a Petri dish and Fleming recognized it was killing surrounding bacteria',
    'inv_4_pat_xray_accident':
      'A fluorescent screen ~1 meter away glowed despite the tube being wrapped in black cardboard',
    'inv_4_pat_postit_launch':
      'Free samples given to Boise, Idaho offices in 1978; over 90% of recipients said they would purchase',
    'inv_4_pat_kevlar_discovery':
      'It appeared cloudy, opalescent, and of low viscosity — normally indicating a failed polymer',
    'inv_3_laser_operation':
      'Stimulated emission — photons trigger atoms to emit identical photons in phase, amplified by mirrors',
  },
};

// Apply curated fixes for non-anatomy decks
for (const [filename, fixes] of Object.entries(curatedFixes)) {
  const deck = readDeck(filename);
  let count = 0;
  for (const fact of deck.facts) {
    if (fixes[fact.id] !== undefined) {
      const replacement = fixes[fact.id];
      if (replacement.length > 100) {
        console.error(`VALIDATION ERROR: ${filename} ${fact.id} replacement is ${replacement.length} chars`);
        process.exit(1);
      }
      fact.correctAnswer = replacement;
      count++;
    }
  }
  writeDeck(filename, deck);
  console.log(`${filename}: shortened ${count} long answers`);
}

// Auto-shorten all remaining long answers in human_anatomy using smart truncation
{
  const deck = readDeck('human_anatomy.json');
  let count = 0;
  for (const fact of deck.facts) {
    if (fact.correctAnswer && fact.correctAnswer.length > 100) {
      const original = fact.correctAnswer;
      fact.correctAnswer = smartTruncate(original, 100);
      if (fact.correctAnswer.length > 100) {
        console.error(`SMART TRUNCATE FAILED for ${fact.id}: ${fact.correctAnswer.length} chars`);
      } else {
        count++;
      }
    }
  }
  writeDeck('human_anatomy.json', deck);
  console.log(`human_anatomy.json: auto-shortened ${count} long answers`);
}

// Verify no remaining long answers in the fixed decks
const allFixedFiles = [...Object.keys(curatedFixes), 'human_anatomy.json'];
let totalRemaining = 0;
for (const filename of allFixedFiles) {
  const deck = readDeck(filename);
  const remaining = deck.facts.filter(f => f.correctAnswer && f.correctAnswer.length > 100);
  if (remaining.length > 0) {
    for (const f of remaining) {
      console.error(`STILL OVER 100: ${filename} ${f.id} (${f.correctAnswer.length}): "${f.correctAnswer}"`);
    }
    totalRemaining += remaining.length;
  }
}
if (totalRemaining > 0) {
  console.error(`${totalRemaining} answers still over 100 chars — fix required`);
  process.exit(1);
}

// ─── FIX 4: Distractor collisions ────────────────────────────────────────────
const distractorCollisions = [
  { file: 'world_flags.json', id: 'flag_germany', answer: 'Germany' },
  { file: 'us_presidents.json', id: 'pres_truman_atomic_bomb', answer: 'Harry S. Truman' },
  { file: 'nasa_missions.json', id: 'nasa_voyager_golden_record', answer: 'Voyager program' },
  { file: 'greek_mythology.json', id: 'myth_harpies_phineus', answer: 'Harpies' },
  { file: 'world_war_ii.json', id: 'wwii_ax_donitz_fuhrer', answer: '23 days' },
  { file: 'medieval_world.json', id: 'med_4_cru_acre_fall_1291', answer: '1291' },
  { file: 'medieval_world.json', id: 'med_5_goryeo_founded', answer: '918' },
  { file: 'medieval_world.json', id: 'med_6_afr_songhai_fall', answer: 'Battle of Tondibi' },
  { file: 'movies_cinema.json', id: 'cinema_supp_film_braveheart', answer: 'Braveheart' },
];

// Group by file
const byFile = {};
for (const item of distractorCollisions) {
  (byFile[item.file] ??= []).push(item);
}

for (const [filename, items] of Object.entries(byFile)) {
  const deck = readDeck(filename);
  let count = 0;
  for (const { id, answer } of items) {
    const fact = deck.facts.find(f => f.id === id);
    if (!fact) { console.error(`NOT FOUND: ${filename} ${id}`); continue; }

    const before = fact.distractors.length;
    fact.distractors = fact.distractors.filter(
      d => d.toLowerCase() !== answer.toLowerCase()
    );
    const removed = before - fact.distractors.length;
    console.log(`${filename} ${id}: removed ${removed} distractor(s) matching correct answer`);
    count += removed;
  }
  writeDeck(filename, deck);
}

console.log('\nAll fixes applied. Run verify-all-decks.mjs to confirm.');
