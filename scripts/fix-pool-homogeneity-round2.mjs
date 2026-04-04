#!/usr/bin/env node
/**
 * fix-pool-homogeneity-round2.mjs
 *
 * Second round of fixes after analyzing results from round 1.
 * Addresses remaining pool FAIL issues in ancient_greece and ancient_rome.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Greece Round 2 Fixes
// ---------------------------------------------------------------------------

const GREECE_R2_FIXES = {
  // --- ruler_general_names: move compound names (>18c) to historical_phrases ---
  greece_pw_darius_marathon_generals: { newPool: 'historical_phrases' },  // 'Datis & Artaphernes' 19c
  greece_cs_parthenon_architects:     { newPool: 'historical_phrases' },  // 'Ictinus & Callicrates' 21c
  greece_ga_parthenon_architects:     { newPool: 'historical_phrases' },  // 'Iktinos & Callicrates' 21c

  // --- concept_terms: move 'If' to historical_phrases with extended answer ---
  greece_cs_laconic_philip: {
    newPool: 'historical_phrases',
    newAnswer: '"If" — the complete Spartan reply',
    newAlts: ['If', '"If"'],
  },

  // --- concept_terms: move all text facts >15c to historical_phrases ---
  greece_cs_spartan_women:        { newPool: 'historical_phrases' },
  greece_ga_pericles_death:       { newPool: 'historical_phrases' },
  greece_ph_aristotle_man_political: { newPool: 'historical_phrases' },
  greece_ga_pericles_populist_policies: { newPool: 'historical_phrases' },
  greece_ph_diogenes_plato_socrates: { newPool: 'historical_phrases' },
  greece_alex_league_corinth:     { newPool: 'historical_phrases' },
  greece_cs_spartan_training_barefoot: { newPool: 'historical_phrases' },
  greece_ga_thucydides_innovation: { newPool: 'historical_phrases' },
  greece_ga_hippocrates_medicine:  { newPool: 'historical_phrases' },
  greece_oc_olympic_nudity:        { newPool: 'historical_phrases' },
  greece_ph_pythagoras_theorem:    { newPool: 'historical_phrases' },
  greece_oc_greek_alphabet_ancestor: { newPool: 'historical_phrases' },
  greece_oc_olympic_hecatomb:      { newPool: 'historical_phrases' },
  greece_ph_plato_allegory_cave:   { newPool: 'historical_phrases' },
  greece_alex_partition_babylon:   { newPool: 'historical_phrases' },
  greece_oc_olympics_prize:        { newPool: 'historical_phrases' },
  greece_alex_macedonian_phalanx:  { newPool: 'historical_phrases' },
  greece_cs_ostracism_material:    { newPool: 'historical_phrases' },
  greece_ph_democritus_laughing:   { newPool: 'historical_phrases' },
  greece_oc_stadion_race:          { newPool: 'historical_phrases' },
  greece_alex_gordian_knot:        { newPool: 'historical_phrases' },
  greece_oc_olympics_truce:        { newPool: 'historical_phrases' },

  // --- work_text_names: move duplicate 'Father of History' to historical_phrases ---
  greece_pw_herodotus_title:       { newPool: 'historical_phrases' },
};

// ---------------------------------------------------------------------------
// Rome Round 2 Fixes
// ---------------------------------------------------------------------------

const ROME_R2_FIXES = {
  // --- general_politician_names: trim/move >18c names ---
  // Move compound/group names to historical_phrases
  rome_rep_first_triumvirate_members: { newPool: 'historical_phrases', newAnswer: 'Caesar, Pompey, and Crassus' },
  rome_aug_horace_virgil_ovid:      { newPool: 'historical_phrases', newAnswer: 'Virgil, Horace, and Ovid' },
  // Trim long individual names
  rome_rep_last_king:               { newAnswer: 'Tarquin the Proud' },       // 'Tarquinius Superbus' 19c -> 16c
  rome_rep_cloaca_maxima_builder:   { newAnswer: 'Tarquinius Priscus' },      // 'L. Tarquinius Priscus' 21c -> 17c
  rome_rep_fabius_strategy:         { newAnswer: 'Fabius Maximus' },          // 'Quintus Fabius Maximus' 22c -> 14c
  rome_cae_caesarion:               { newAnswer: 'Caesarion' },               // 'Caesarion (Ptolemy XV)' 22c -> 9c
  rome_eng_via_appia_builder:       { newAnswer: 'Appius Claudius' },         // 'Appius Claudius Caecus' 22c -> 14c
  rome_aug_pantheon_rebuilt:        { newAnswer: 'Hadrian' },                 // 'Hadrian (117-138 CE)' 20c -> 7c
  rome_emp_five_good_coined:        { newAnswer: 'Machiavelli' },             // 'Niccolò Machiavelli' 19c -> 12c
  rome_pun_hannibal_vs_scipio_ranking: { newAnswer: 'Alexander the Great' },  // stays 19c
  rome_fall_theodoric_great:        { newAnswer: 'Theodoric the Great' },     // stays 19c

  // --- structure_names: trim 'Baths of Diocletian' (19c) to 18c ---
  rome_eng_baths_caracalla:         { newAnswer: 'Baths of Caracalla' },  // NOTE: the QUESTION asks about Baths of Caracalla/Diocletian; trim to 18c

  // --- historical_phrases: move 'Juvenal' to general_politician_names ---
  rome_life_bread_circuses:         { newPool: 'general_politician_names', newAnswer: 'Juvenal' },

  // --- historical_phrases: trim very long answers (>39c) ---
  rome_rep_twelve_tables_purpose:   { newAnswer: 'Stop patrician interpretation monopoly' },
  rome_fall_western_collapse_factors: { newAnswer: 'Military, economic, political factors' },
};

// ---------------------------------------------------------------------------
// Apply fixes
// ---------------------------------------------------------------------------

function applyFixes(deck, fixes) {
  for (const [factId, fix] of Object.entries(fixes)) {
    const fact = deck.facts.find(f => f.id === factId);
    if (!fact) {
      console.warn(`  [WARN] Fact not found: ${factId}`);
      continue;
    }

    if (fix.newAnswer !== undefined) {
      fact.correctAnswer = fix.newAnswer;
    }

    if (fix.newAlts !== undefined) {
      fact.acceptableAlternatives = fix.newAlts;
    }

    if (fix.newPool !== undefined) {
      fact.answerTypePoolId = fix.newPool;
    }
  }

  // Rebuild all pool factIds arrays
  for (const pool of deck.answerTypePools) {
    const poolFacts = deck.facts.filter(f => f.answerTypePoolId === pool.id);
    pool.factIds = poolFacts.map(f => f.id);
  }

  return deck;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('\n=== Round 2: Fixing ancient_greece ===');
const greecePath = resolve(repoRoot, 'data/decks/ancient_greece.json');
let gDeck = JSON.parse(readFileSync(greecePath, 'utf8'));
let gCount = Object.keys(GREECE_R2_FIXES).filter(id => gDeck.facts.find(f => f.id === id)).length;
console.log(`  Applying ${Object.keys(GREECE_R2_FIXES).length} fixes to ${gCount} found facts`);
gDeck = applyFixes(gDeck, GREECE_R2_FIXES);
writeFileSync(greecePath, JSON.stringify(gDeck, null, 2) + '\n');
console.log('  Saved ancient_greece.json');

console.log('\n=== Round 2: Fixing ancient_rome ===');
const romePath = resolve(repoRoot, 'data/decks/ancient_rome.json');
let rDeck = JSON.parse(readFileSync(romePath, 'utf8'));
let rCount = Object.keys(ROME_R2_FIXES).filter(id => rDeck.facts.find(f => f.id === id)).length;
console.log(`  Applying ${Object.keys(ROME_R2_FIXES).length} fixes to ${rCount} found facts`);
rDeck = applyFixes(rDeck, ROME_R2_FIXES);
writeFileSync(romePath, JSON.stringify(rDeck, null, 2) + '\n');
console.log('  Saved ancient_rome.json');

console.log('\nDone. Run node scripts/pool-homogeneity-analysis.mjs to verify.');
