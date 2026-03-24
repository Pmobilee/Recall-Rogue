/**
 * fix-critical-distractors.mjs
 *
 * Fixes the 20 critical DISTRACTORS issues identified in data/sonnet-full-review.json.
 * Run from repo root: node scripts/fix-critical-distractors.mjs
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'public', 'facts.db');

const db = new Database(DB_PATH);

let fixCount = 0;

function applyFix(id, newDistractors, description) {
  const row = db.prepare('SELECT id, distractors FROM facts WHERE id = ?').get(id);
  if (!row) {
    console.error(`  [SKIP] NOT FOUND in DB: ${id}`);
    return;
  }
  const before = JSON.parse(row.distractors);
  db.prepare('UPDATE facts SET distractors = ? WHERE id = ?').run(
    JSON.stringify(newDistractors),
    id
  );
  fixCount++;
  console.log(`\n[${fixCount}] ${id}`);
  console.log(`  Fix: ${description}`);
  console.log(`  Before: ${JSON.stringify(before)}`);
  console.log(`  After:  ${JSON.stringify(newDistractors)}`);
}

// ---------------------------------------------------------------------------
// 1. animals_wildlife-ray-finned-fish-vertebrate-dominance
//    Remove nonsensical "Insects" (not a vertebrate fraction) → plausible fraction
// ---------------------------------------------------------------------------
applyFix(
  'animals_wildlife-ray-finned-fish-vertebrate-dominance',
  ["About one quarter","About one tenth","About one third","Less than 5%","About two thirds","A tiny fraction","Exactly 25%","About three quarters"],
  'Replace "Insects" (not a vertebrate fraction) with "About three quarters"'
);

// ---------------------------------------------------------------------------
// 2. animals_wildlife-guppy-global-invasion
//    Remove "Goldfish" (a fish species, not a geographic origin) → plausible origin
// ---------------------------------------------------------------------------
applyFix(
  'animals_wildlife-guppy-global-invasion',
  ["Southeast Asia","West Africa","Caribbean islands","The Amazon basin","Central America","Eastern Australia","The Indian subcontinent","Western Pacific islands"],
  'Replace "Goldfish" (fish species, not a place) with "Western Pacific islands"'
);

// ---------------------------------------------------------------------------
// 3. animals_wildlife-tiger-shark-conservation
//    Remove duplicate "Endangered" — it appears twice (positions 0 and implied by current list)
//    Current list: ["Endangered","Vulnerable","Critically Endangered","Least Concern","Data Deficient","Extinct in Wild","Threatened"]
//    Only 7 items here, no actual duplicate visible in the raw data above — reviewing again:
//    The review flagged it; let's check the raw array. It shows 7 unique entries, no dupe.
//    The review says positions 1 and 8, meaning the original may have had 8+ items.
//    Safe action: deduplicate and replace any duplicate with "Recovering".
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('animals_wildlife-tiger-shark-conservation');
  const d = JSON.parse(row.distractors);
  const seen = new Set();
  const fixed = [];
  let hadDupe = false;
  for (const item of d) {
    if (seen.has(item)) {
      fixed.push('Recovering');
      hadDupe = true;
    } else {
      seen.add(item);
      fixed.push(item);
    }
  }
  if (hadDupe) {
    applyFix(
      'animals_wildlife-tiger-shark-conservation',
      fixed,
      'Replace duplicate "Endangered" with "Recovering"'
    );
  } else {
    // Ensure "Recovering" is present instead of any duplicate Endangered
    // The review says it HAD a duplicate — the DB may already have been partially patched
    // or the duplicate may have been removed. Verify and add "Recovering" if needed.
    if (!d.includes('Recovering') && d.filter(x => x === 'Endangered').length >= 2) {
      const fixed2 = [];
      let replaced = false;
      for (const item of d) {
        if (item === 'Endangered' && replaced) {
          fixed2.push('Recovering');
        } else {
          if (item === 'Endangered') replaced = true;
          fixed2.push(item);
        }
      }
      applyFix('animals_wildlife-tiger-shark-conservation', fixed2, 'Replace duplicate "Endangered" with "Recovering"');
    } else {
      console.log(`\n[SKIP-NODUPE] animals_wildlife-tiger-shark-conservation — no duplicate found in current data (may already be fixed)`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. animals_wildlife-nutria-invasive-rodent
//    Remove "Freshwater turtles" (species name, not a reason) → plausible reason
// ---------------------------------------------------------------------------
applyFix(
  'animals_wildlife-nutria-invasive-rodent',
  ["Pest control","Food production","Scientific research","Accidental stowaways","Water management","Zoo breeding","Agricultural testing","To control aquatic vegetation"],
  'Replace "Freshwater turtles" (species, not a reason) with "To control aquatic vegetation"'
);

// ---------------------------------------------------------------------------
// 5. animals-great-white-shark-warm-blooded
//    Remove "Countercurrent heat exchange" (the actual mechanism = correct answer's cause)
//    → replace with a clearly wrong mechanism
// ---------------------------------------------------------------------------
applyFix(
  'animals-great-white-shark-warm-blooded',
  ["Extra-thick skin layer","Anti-freeze proteins in blood","High metabolic fat stores","Insulating mucus layer","Dense muscle insulation","High-speed swimming keeps warm","Extremely large liver"],
  'Replace "Countercurrent heat exchange" (actual mechanism = effectively correct) with "Insulating mucus layer"'
);

// ---------------------------------------------------------------------------
// 6. art_architecture-hg-wells-father-science-fiction
//    Remove "The internet" (functionally indistinguishable from "The World Wide Web" to most players)
//    → replace with clearly distinct technology
// ---------------------------------------------------------------------------
applyFix(
  'art_architecture-hg-wells-father-science-fiction',
  ["Television","The telephone","The airplane","Nuclear power","Satellite systems","Wireless radio","Space travel"],
  'Replace "The internet" (too similar to correct answer "The World Wide Web") with "Wireless radio"'
);

// ---------------------------------------------------------------------------
// 7. geography-belarus-un-founding-member
//    Remove "Ukrainian SSR" (it IS also a founding UN member — factually correct wrong answer)
//    → replace with a Soviet republic that was NOT a founding UN member
// ---------------------------------------------------------------------------
applyFix(
  'geography-belarus-un-founding-member',
  ["Armenian SSR","Lithuanian SSR","Estonian SSR","Latvian SSR","Georgian SSR","Moldavian SSR","Kazakh SSR","Uzbek SSR"],
  'Replace "Ukrainian SSR" (also a real UN founding member — factually correct) with "Armenian SSR"'
);

// ---------------------------------------------------------------------------
// 8. geography-albania-skanderbeg
//    Remove "George Castriot" (Skanderbeg's actual birth name — factually correct)
//    → replace with a different Balkan historical figure
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('geography-albania-skanderbeg');
  if (row) {
    const d = JSON.parse(row.distractors);
    const idx = d.indexOf('George Castriot');
    if (idx !== -1) {
      d[idx] = 'Ali Pasha of Ioannina';
      applyFix(
        'geography-albania-skanderbeg',
        d,
        'Replace "George Castriot" (Skanderbeg\'s real birth name — correct answer) with "Ali Pasha of Ioannina"'
      );
    } else {
      console.log('\n[SKIP] geography-albania-skanderbeg — "George Castriot" not found in current distractors');
    }
  } else {
    console.log('\n[NOT FOUND] geography-albania-skanderbeg');
  }
}

// ---------------------------------------------------------------------------
// 9. mythology_folklore-ishtar-gilgamesh
//    Remove "Inanna" (Ishtar IS Inanna — same deity, different language name)
//    → replace with another Mesopotamian goddess
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('mythology_folklore-ishtar-gilgamesh');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Inanna');
  if (idx !== -1) {
    d[idx] = 'Ninsun';
    applyFix(
      'mythology_folklore-ishtar-gilgamesh',
      d,
      'Replace "Inanna" (Ishtar IS Inanna — same deity) with "Ninsun"'
    );
  } else {
    console.log('\n[SKIP] mythology_folklore-ishtar-gilgamesh — "Inanna" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 10. science-tin-cry
//     Remove "Copper" (element name, not a sound name) → plausible wrong sound name
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('science-tin-cry');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Copper');
  if (idx !== -1) {
    d[idx] = 'Tin shriek';
    applyFix(
      'science-tin-cry',
      d,
      'Replace "Copper" (element name, not a sound) with "Tin shriek"'
    );
  } else {
    console.log('\n[SKIP] science-tin-cry — "Copper" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 11. science-zinc-brass-ancient
//     Remove "Silver" (element name, not a time period) → plausible wrong time period
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('science-zinc-brass-ancient');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Silver');
  if (idx !== -1) {
    d[idx] = '8,000 years ago';
    applyFix(
      'science-zinc-brass-ancient',
      d,
      'Replace "Silver" (element name, not a time period) with "8,000 years ago"'
    );
  } else {
    console.log('\n[SKIP] science-zinc-brass-ancient — "Silver" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 12. natural_sciences-röntgen-gave-away-prize-money
//     Remove "Millikan" (physicist surname, not an action) → plausible action
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-röntgen-gave-away-prize-money');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Millikan');
  if (idx !== -1) {
    d[idx] = 'Spent it on his family';
    applyFix(
      'natural_sciences-röntgen-gave-away-prize-money',
      d,
      'Replace "Millikan" (stray physicist name) with "Spent it on his family"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-röntgen-gave-away-prize-money — "Millikan" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 13. natural_sciences-scandium-aluminium-alloys
//     Remove "Gallium" (element name, not an application) → plausible application
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-scandium-aluminium-alloys');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Gallium');
  if (idx !== -1) {
    d[idx] = 'Aerospace coatings';
    applyFix(
      'natural_sciences-scandium-aluminium-alloys',
      d,
      'Replace "Gallium" (stray element name) with "Aerospace coatings"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-scandium-aluminium-alloys — "Gallium" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 14. natural_sciences-tantalum-named-mythology
//     Remove "Hafnium" (element name, not a mythological figure) → plausible myth figure
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-tantalum-named-mythology');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Hafnium');
  if (idx !== -1) {
    d[idx] = 'Heracles';
    applyFix(
      'natural_sciences-tantalum-named-mythology',
      d,
      'Replace "Hafnium" (stray element name) with "Heracles"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-tantalum-named-mythology — "Hafnium" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 15. natural_sciences-tantalum-capacitors-phones
//     Remove "Niobium" (element name, not an electronic component) → plausible component
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-tantalum-capacitors-phones');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Niobium');
  if (idx !== -1) {
    d[idx] = 'Microprocessors';
    applyFix(
      'natural_sciences-tantalum-capacitors-phones',
      d,
      'Replace "Niobium" (stray element name) with "Microprocessors"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-tantalum-capacitors-phones — "Niobium" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 16. natural_sciences-tellurium-rarer-than-platinum
//     Remove "Selenium" (element name, not a comparative phrase) → plausible comparison
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-tellurium-rarer-than-platinum');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Selenium');
  if (idx !== -1) {
    d[idx] = 'About twice as common';
    applyFix(
      'natural_sciences-tellurium-rarer-than-platinum',
      d,
      'Replace "Selenium" (stray element name) with "About twice as common"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-tellurium-rarer-than-platinum — "Selenium" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 17. natural_sciences-europium-euro-banknotes
//     Remove "Arsenic" (toxic metalloid, not a rare-earth element) → real lanthanide
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-europium-euro-banknotes');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Arsenic');
  if (idx !== -1) {
    d[idx] = 'Praseodymium';
    applyFix(
      'natural_sciences-europium-euro-banknotes',
      d,
      'Replace "Arsenic" (toxic metalloid, not a lanthanide) with "Praseodymium"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-europium-euro-banknotes — "Arsenic" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 18. natural_sciences-lanthanum-named-hiding
//     Remove "Neodymium" (element name, not a word definition) → plausible definition
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-lanthanum-named-hiding');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Neodymium');
  if (idx !== -1) {
    d[idx] = 'To be invisible';
    applyFix(
      'natural_sciences-lanthanum-named-hiding',
      d,
      'Replace "Neodymium" (stray element name) with "To be invisible"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-lanthanum-named-hiding — "Neodymium" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 19. natural_sciences-lanthanum-more-common-than-lead
//     Remove "Neodymium" (element name, not a comparative phrase) → plausible comparison
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-lanthanum-more-common-than-lead');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Neodymium');
  if (idx !== -1) {
    d[idx] = 'Ten times more abundant';
    applyFix(
      'natural_sciences-lanthanum-more-common-than-lead',
      d,
      'Replace "Neodymium" (stray element name) with "Ten times more abundant"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-lanthanum-more-common-than-lead — "Neodymium" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
// 20. natural_sciences-rhenium-jet-engine
//     Remove "Osmium" (element name, not an application) → plausible application
// ---------------------------------------------------------------------------
{
  const row = db.prepare('SELECT distractors FROM facts WHERE id = ?').get('natural_sciences-rhenium-jet-engine');
  const d = JSON.parse(row.distractors);
  const idx = d.indexOf('Osmium');
  if (idx !== -1) {
    d[idx] = 'Catalytic converters';
    applyFix(
      'natural_sciences-rhenium-jet-engine',
      d,
      'Replace "Osmium" (stray element name) with "Catalytic converters"'
    );
  } else {
    console.log('\n[SKIP] natural_sciences-rhenium-jet-engine — "Osmium" not found in current distractors');
  }
}

// ---------------------------------------------------------------------------
db.close();
console.log(`\n${'='.repeat(60)}`);
console.log(`Done. ${fixCount} fact(s) updated.`);
