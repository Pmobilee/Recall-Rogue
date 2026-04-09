#!/usr/bin/env node
/**
 * generate-manual-fixes-v2.mjs
 *
 * Second pass of manual fixes - handles 16 genuinely still-leaking facts
 * from the first manual pass where the new question still contained
 * a word from the answer.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Only overwrite these IDs - replacing them entirely with cleaner versions
const FIXED_REWRITES = {
  // 'disorder' leaked into answer 'Panic disorder'
  ap_psych_panic_disorder:
    'Which anxiety-related condition is characterized by recurrent, unexpected episodes of intense fear followed by at least one month of worry about future attacks?',

  // 'company' leaked into 'Virginia Company'
  apush_p2_virginia_company:
    'What joint-stock corporation founded Jamestown in 1607 and held the royal charter for English colonization of the Atlantic seaboard?',

  // 'revolt' leaked into 'Pueblo Revolt'
  apush_p1_pueblo_revolt_1680:
    'Which 1680 uprising, led by the religious leader Popé, temporarily drove Spanish colonizers out of the Rio Grande region?',

  // 'model' leaked into 'Southeast Asian City Model'
  aphg_u6_southeast_asian_city_model:
    'Which urban geography framework describes a port zone as the dominant center, surrounded by a commercial zone and alien commercial zones?',

  // 'empire' leaked into 'Mughal Empire'
  apwh_3_070:
    'Which South Asian dynasty ruled when Sikhism emerged partly in response to the rulers\' religious policies?',

  // 'dennard' leaked into 'Dennard scaling' (name appears twice - need to remove second occurrence)
  cs_1_dennard_scaling_breakdown:
    'What transistor-shrinkage rule formulated in 1974 predicted that power density stays constant as chips get smaller — until it broke down around 2005?',

  // 'jerry' leaked into 'Jerry Yang and David Filo'
  cs_5_yahoo_founders:
    'Which two Stanford PhD students founded Yahoo in January 1994, initially calling it a "Guide to the World Wide Web"?',

  // 'harold' in Q, 'Harald' in answer
  med_vik_stamford_bridge:
    'At the Battle of Stamford Bridge (September 25, 1066), who killed the Norwegian king, and how many Viking ships returned home?',

  // 'orbiter' → 'Mars Reconnaissance Orbiter'
  nasa_mro_mars:
    'Which satellite has been mapping the red planet since 2006 and found evidence of seasonal liquid water flows on its surface?',

  // 'castle' → 'White Heron Castle'
  ww_pal_himeji_nickname:
    'What is the popular nickname of the Himeji fortification in Japan, given for its gleaming light-colored plastered exterior walls?',

  // 'circles' → 'Sand circles to attract mates'
  ocean_3_pufferfish_sand_circles:
    'Why do male pufferfish spend days creating elaborate geometric patterns in the seafloor sediment?',

  // 'congo' → 'Congo peafowl'
  'animals-peafowl-three-species':
    'Which peafowl species is native only to the Central African river basin?',

  // 'kuwait' → 'Kuwait City'
  'geo-kuwait-city-state':
    'The small Gulf nation is described as a city-state because most of its people live in which urban center sharing the country\'s name?',

  // 'iraq' → 'Iraq Petroleum Company'
  'history-saddam-nationalized-oil':
    'Which oil consortium did Saddam Hussein nationalize while serving as Vice President, asserting control over the nation\'s petroleum reserves?',

  // 'peace' → 'Peace for our time'
  wwii_rtw_peace_for_our_time_quote:
    'Chamberlain\'s 1938 Munich speech is constantly misquoted — what was his actual phrase about the document he had signed?',

  // 'programming' → 'PROgramming in LOGic'
  cs_2_prolog_stands_for:
    'What does the acronym "Prolog" expand to — reflecting its logic-based declarative approach to software development?',
};

const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-fixes.json');

// Load existing fixes
let existingFixes = [];
if (fs.existsSync(OUTPUT_PATH)) {
  existingFixes = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
}

let updated = 0;
for (const fix of existingFixes) {
  if (FIXED_REWRITES[fix.id]) {
    fix.new = FIXED_REWRITES[fix.id];
    updated++;
  }
}

console.log(`Updated ${updated} fixes with v2 rewrites`);

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(existingFixes, null, 2));
console.log(`Total fixes written: ${existingFixes.length}`);

// Show samples
for (const [id, newQ] of Object.entries(FIXED_REWRITES)) {
  const fix = existingFixes.find(f => f.id === id);
  if (fix) {
    console.log(`\n${id}`);
    console.log(`  OLD: ${fix.old.substring(0, 80)}`);
    console.log(`  NEW: ${fix.new.substring(0, 80)}`);
  }
}
