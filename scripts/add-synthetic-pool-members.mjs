/**
 * add-synthetic-pool-members.mjs
 *
 * Adds syntheticDistractors to small answer-type pools across 12 curated decks.
 * These are semantically coherent wrong answers that pad the pool so the runtime
 * distractor selector always has enough candidates to build a 4-choice question.
 *
 * Rules enforced:
 * - Every synthetic is checked against ALL correctAnswer values in the deck (case-insensitive)
 * - Any synthetic that matches an existing correct answer is silently dropped
 * - Synthetics are deduplicated within each pool
 * - launch_years and bracket_number pools are intentionally excluded — the runtime
 *   bracket notation system handles those pools automatically
 *
 * Usage: node scripts/add-synthetic-pool-members.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = path.resolve(__dirname, '../data/decks');

// Pools to pad with synthetic distractors.
// Values here are semantically coherent plausible-but-wrong alternatives for
// the answer type in each pool.  They were chosen to match the format/length of
// real correct answers in that pool without being actual correct answers.
const SYNTHETIC_ADDITIONS = {
  solar_system: {
    // system_facts pool currently has 3 facts — needs ≥5 pool members for runtime
    system_facts: [
      'planetary rings',
      'retrograde rotation',
      'tidal locking',
      'solar wind',
      'magnetic field',
      'orbital resonance',
      'escape velocity',
      'albedo',
    ],
  },

  constellations: {
    // deep_sky_names pool currently has 3 facts
    deep_sky_names: [
      'Pleiades',
      'Betelgeuse',
      'Sirius',
      'Vega',
      'Polaris',
      'Proxima Centauri',
      'Rigel',
      'Aldebaran',
    ],
  },

  egyptian_mythology: {
    // god_names pool currently has 3 facts
    god_names: [
      'Sekhmet',
      'Sobek',
      'Hathor',
      'Ptah',
      'Khnum',
      'Nut',
      'Nephthys',
      'Khonsu',
    ],
    // symbols_objects pool currently has 5 facts (borderline — add synthetics for buffer)
    symbols_objects: [
      'sistrum',
      'Was scepter',
      'Djed pillar',
      'Uraeus',
      'Cartouche',
      'Canopic jar',
      'Shen ring',
    ],
  },

  us_presidents: {
    // party_names pool currently has 7 facts
    party_names: [
      'Federalist',
      'Know-Nothing',
      'Bull Moose',
      'Free Soil',
      'Anti-Masonic',
      'Populist',
      'Progressive',
    ],
    // home_states pool currently has 7 facts
    home_states: [
      'Massachusetts',
      'New York',
      'Pennsylvania',
      'Georgia',
      'Illinois',
      'California',
      'Connecticut',
    ],
  },

  periodic_table: {
    // element_categories pool currently has 5 facts
    element_categories: [
      'lanthanide',
      'actinide',
      'post-transition metal',
      'semimetal',
      'superactinide',
    ],
  },

  nasa_missions: {
    // spacecraft_names pool currently has 5 facts
    spacecraft_names: [
      'Voyager',
      'Pioneer',
      'Gemini',
      'Mercury',
      'Soyuz',
      'Challenger',
      'Discovery',
    ],
  },

  human_anatomy: {
    // organ_names pool currently has 7 facts
    organ_names: [
      'spleen',
      'thymus',
      'appendix',
      'gallbladder',
      'adrenal gland',
      'pituitary gland',
      'trachea',
    ],
  },

  ancient_rome: {
    // text_work_names pool currently has 6 facts
    text_work_names: [
      'De Rerum Natura',
      'Metamorphoses',
      'Histories',
      'Germania',
      'Natural History',
      'Satyricon',
    ],
  },

  famous_paintings: {
    // country_names pool currently has 5 facts
    country_names: [
      'Netherlands',
      'Germany',
      'England',
      'Belgium',
      'Austria',
      'Russia',
      'Japan',
    ],
  },

  medieval_world: {
    // structure_names pool currently has 7 facts
    structure_names: [
      'Alhambra',
      'Carcassonne',
      'Mont-Saint-Michel',
      'Krak des Chevaliers',
      'Tower of London',
      'Cologne Cathedral',
    ],
  },

  world_wonders: {
    // location_country pool currently has 7 facts
    location_country: [
      'Mexico',
      'Greece',
      'Cambodia',
      'Turkey',
      'Indonesia',
      'Morocco',
      'Australia',
    ],
  },

  dinosaurs: {
    // clade_names pool currently has 5 facts
    clade_names: [
      'Ornithischia',
      'Saurischia',
      'Pterosauria',
      'Ankylosauria',
      'Ceratopsia',
      'Hadrosauridae',
    ],
  },
};

let totalModifiedDecks = 0;
let totalPoolsUpdated = 0;
let totalSyntheticsAdded = 0;

for (const [deckId, pools] of Object.entries(SYNTHETIC_ADDITIONS)) {
  const deckPath = path.join(DECKS_DIR, `${deckId}.json`);

  let deck;
  try {
    deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
  } catch (err) {
    console.error(`ERROR: Could not read ${deckPath}: ${err.message}`);
    continue;
  }

  // Collect ALL correct answers in the deck for collision checking
  const allCorrectAnswers = new Set(
    deck.facts.map((f) => f.correctAnswer.toLowerCase().trim())
  );

  console.log(`\n=== ${deckId} (${deck.facts.length} facts) ===`);

  let deckModified = false;

  for (const [poolId, synthetics] of Object.entries(pools)) {
    const pool = deck.answerTypePools.find((p) => p.id === poolId);
    if (!pool) {
      console.log(`  WARNING: Pool "${poolId}" not found in ${deckId} — skipping`);
      continue;
    }

    // Filter out any synthetic that collides with an existing correct answer
    const safe = synthetics.filter((s) => !allCorrectAnswers.has(s.toLowerCase().trim()));
    const filtered = synthetics.length - safe.length;
    if (filtered > 0) {
      const dropped = synthetics.filter((s) =>
        allCorrectAnswers.has(s.toLowerCase().trim())
      );
      console.log(
        `  ${poolId}: filtered ${filtered} synthetic(s) matching existing answers: [${dropped.join(', ')}]`
      );
    }

    const before = pool.syntheticDistractors?.length ?? 0;

    // Merge with any existing synthetics, then deduplicate (case-sensitive dedup)
    pool.syntheticDistractors = [
      ...new Set([...(pool.syntheticDistractors || []), ...safe]),
    ];

    const added = pool.syntheticDistractors.length - before;
    totalSyntheticsAdded += added;
    totalPoolsUpdated++;
    deckModified = true;

    console.log(
      `  ${poolId}: ${pool.factIds.length} facts + ${pool.syntheticDistractors.length} synthetics` +
        (added > 0 ? ` (+${added} new)` : ' (no change)')
    );
  }

  if (deckModified) {
    fs.writeFileSync(deckPath, JSON.stringify(deck, null, 2) + '\n');
    console.log(`  Written: ${deckPath}`);
    totalModifiedDecks++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Decks modified:      ${totalModifiedDecks}`);
console.log(`Pools updated:       ${totalPoolsUpdated}`);
console.log(`Synthetics added:    ${totalSyntheticsAdded}`);
