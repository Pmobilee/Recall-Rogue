#!/usr/bin/env node
/**
 * fix-pool-homogeneity-greece-rome.mjs
 *
 * Fixes pool homogeneity FAILs in ancient_greece and ancient_rome decks.
 * Strategy per the decision tree:
 *  1. Bare numbers -> {N} bracket notation
 *  2. Answers with text in question/explanation -> trim
 *  3. Long descriptions -> trim to key term/name
 *  4. Wrong pool format -> reassign to historical_phrases or appropriate pool
 *
 * Creates a new pool 'historical_phrases' in each deck for longer descriptive answers.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Fix definitions
// ---------------------------------------------------------------------------

/** Ancient Greece changes */
const GREECE_FIXES = {
  // --- concept_terms: bare numbers -> {N} ---
  greece_cs_agoge_entry_age:        { newAnswer: '{7}',       newAlts: ['7', 'seven'] },
  greece_cs_ecclesia_age:           { newAnswer: '{20}',      newAlts: ['20', 'twenty'] },
  greece_cs_gerousia_age:           { newAnswer: '{60}',      newAlts: ['60', 'sixty'] },
  greece_cs_laconic_philip:         { newAnswer: '"If"',      newAlts: ['If'] },  // 2c -> 5c with quotes
  greece_ga_euripides_surviving_plays: { newAnswer: '{19}',   newAlts: ['19', 'nineteen'] },
  greece_ga_aristophanes_surviving_plays: { newAnswer: '{11}', newAlts: ['11', 'eleven'] },
  greece_ga_sophocles_contests:     { newAnswer: '{24}',      newAlts: ['24', 'twenty-four'] },
  greece_cs_boule_members:          { newAnswer: '{500}',     newAlts: ['500', 'five hundred'] },
  greece_cs_trireme_rowers:         { newAnswer: '{170}',     newAlts: ['170', 'one hundred seventy'] },
  greece_cs_sparta_kings:           { newAnswer: '{2}',       newAlts: ['2', 'two', 'Two'] },
  greece_cs_ephors_count:           { newAnswer: '{5}',       newAlts: ['5', 'five', 'Five'] },
  greece_pw_immortals:              { newAnswer: '{10000}',   newAlts: ['10,000', 'ten thousand'] },
  greece_cs_laurion_slavery:        { newAnswer: '{150000}',  newAlts: ['150,000'] },
  greece_cs_parthenon_damage_1687:  { newAnswer: '{1687}',    newAlts: ['1687'] },

  // --- concept_terms: trim long answers to core term ---
  greece_oc_olympic_chariot:        { newAnswer: 'Tethrippon' },
  greece_alex_death_cause:          { newAnswer: 'Typhoid fever' },

  // --- concept_terms: move long descriptions to historical_phrases ---
  greece_ph_socrates_method:        { newPool: 'historical_phrases', newAnswer: 'Socratic method' },
  greece_rel_olympic_truce:         { newPool: 'historical_phrases' },
  greece_ph_empedocles_four_elements: { newPool: 'historical_phrases', newAnswer: 'Earth, water, fire, and air' },
  greece_cs_agora_function:         { newPool: 'historical_phrases' },
  greece_alex_companion_cavalry:    { newPool: 'historical_phrases', newAnswer: 'Companion Cavalry' },
  greece_ph_heraclitus_flux:        { newPool: 'historical_phrases' },
  greece_ph_aristotle_logic:        { newPool: 'historical_phrases', newAnswer: 'Syllogistic reasoning' },
  greece_alex_empire_size:          { newPool: 'historical_phrases', newAnswer: '~5.2 million km²' },
  greece_ph_protagoras_man_measure: { newPool: 'historical_phrases' },
  greece_rel_croesus_oracle:        { newPool: 'historical_phrases' },
  greece_cs_parthenon_statue_material: { newPool: 'historical_phrases', newAnswer: 'Chryselephantine (gold/ivory)' },
  greece_pw_sparta_carneia:         { newPool: 'historical_phrases', newAnswer: 'The Carneia festival' },
  greece_ph_diogenes_barrel:        { newPool: 'historical_phrases', newAnswer: 'A ceramic pithos jar' },
  greece_ph_plato_soul:             { newPool: 'historical_phrases', newAnswer: 'Reason, spirit, and appetite' },
  greece_ph_zeno_virtue:            { newPool: 'historical_phrases', newAnswer: 'Living by nature and reason' },
  greece_ph_anaximander_earth:      { newPool: 'historical_phrases', newAnswer: 'Floating free in infinite space' },
  greece_alex_army_mutiny:          { newPool: 'historical_phrases', newAnswer: 'The Hyphasis River' },
  greece_oc_theatrical_masks:       { newPool: 'historical_phrases', newAnswer: 'Linen, leather, or cork' },
  greece_rel_sacrifice_practices:   { newPool: 'historical_phrases', newAnswer: 'Outdoor altars in sanctuaries' },
  greece_rel_poseidon_domain:       { newPool: 'historical_phrases', newAnswer: 'Seas, storms, earthquakes, horses' },
  greece_alex_tyre_causeway:        { newPool: 'historical_phrases', newAnswer: 'About 1 km causeway' },
  greece_rel_homer_question:        { newPool: 'historical_phrases', newAnswer: 'Single author vs. multiple poets' },
  greece_rel_greek_religion_structure: { newPool: 'historical_phrases', newAnswer: 'No central priestly authority' },
  greece_rel_mystery_religions:     { newPool: 'historical_phrases', newAnswer: 'Initiation and personal salvation' },
  greece_oc_olympics_women:         { newPool: 'historical_phrases', newAnswer: 'Barred from attending or competing' },
  greece_rel_pythia_role:           { newPool: 'historical_phrases', newAnswer: "Apollo's high priestess at Delphi" },
  greece_ph_pythagoras_music:       { newPool: 'historical_phrases', newAnswer: 'Mathematical ratios' },

  // --- ruler_general_names: move non-name fact descriptions to historical_phrases ---
  greece_pw_miltiades_fate:         { newPool: 'historical_phrases', newAnswer: 'Died in prison from gangrene' },
  greece_pw_xerxes_hellespont:      { newPool: 'historical_phrases', newAnswer: 'Whipped the Hellespont {300} times' },
  greece_ph_socrates_sources:       { newPool: 'historical_phrases' },
  greece_pw_pausanias_fate:         { newPool: 'historical_phrases', newAnswer: 'Walled in a temple and starved' },
  greece_cs_themistocles_fate:      { newPool: 'historical_phrases', newAnswer: 'Ostracized; later served Persia' },
  greece_pw_artemisia:              { newPool: 'historical_phrases', newAnswer: 'Rammed a friendly ship to escape' },
  greece_pw_darius_remember_athenians: { newPool: 'historical_phrases' },
  greece_pw_marathon_pheidippides_sparta: { newPool: 'historical_phrases', newAnswer: '~240 km to Sparta' },
  // Trim long person names (keep in ruler_general_names)
  greece_oc_olympic_theodosius:     { newAnswer: 'Theodosius I' },
  greece_alex_philip_assassination: { newAnswer: 'Pausanias' },
  greece_pw_darius_marathon_generals: { newAnswer: 'Datis & Artaphernes' },
  greece_oc_pankration_arrhichion:  { newAnswer: 'Arrhichion' },
  greece_cs_parthenon_architects:   { newAnswer: 'Ictinus & Callicrates' },
  greece_ga_parthenon_architects:   { newAnswer: 'Iktinos & Callicrates' },

  // --- date_events ---
  greece_rel_delphi_political_influence: { newPool: 'historical_phrases', newAnswer: 'About 1,000 years' },
  greece_rel_eleusinian_duration:   { newPool: 'historical_phrases', newAnswer: 'About 2,000 years' },
  greece_cs_plague_athens_death_toll: { newPool: 'historical_phrases' },
  greece_pw_darius_death:           { newAnswer: '486 BCE' },
  greece_pw_themistocles_ostracism: { newAnswer: '471 BCE' },
  greece_rel_hesiod_dates:          { newAnswer: 'c. 750–650 BCE' },

  // --- structure_names ---
  greece_alex_pharos_lighthouse:    { newPool: 'historical_phrases', newAnswer: 'About 110 meters tall' },
  greece_cs_long_walls_purpose:     { newPool: 'historical_phrases' },
  greece_rel_temple_hephaestus:     { newAnswer: 'Hephaisteion' },
  greece_ph_zeno_stoicism:          { newAnswer: 'Stoa Poikile' },

  // --- god_names ---
  greece_rel_apollo_domains:        { newPool: 'historical_phrases', newAnswer: 'Sun, prophecy, archery, and music' },
  greece_rel_twelfth_olympian:      { newPool: 'historical_phrases', newAnswer: 'Hestia or Dionysus' },
  greece_rel_eleusinian_mysteries:  { newPool: 'historical_phrases' },
  greece_cs_athena_myth:            { newPool: 'concept_terms' },  // 'Olive tree' (10c) fits short concept_terms

  // --- city_state_names ---
  greece_ga_hippocrates_kos:        { newAnswer: 'island of Kos' },  // 3c -> 13c for pool homogeneity
  greece_rel_schliemann_troy:       { newAnswer: 'Hisarlik' },
  greece_pw_cyrus_empire:           { newPool: 'historical_phrases' },
  greece_oc_black_figure_pottery:   { newPool: 'historical_phrases', newAnswer: 'Corinth, c. 700 BCE' },

  // --- battle_names ---
  greece_pw_marathon_greek_forces:  { newPool: 'historical_phrases' },
  greece_pw_salamis_strategy:       { newPool: 'historical_phrases', newAnswer: 'Fight in narrow straits' },

  // --- work_text_names ---
  greece_oc_kritios_boy:            { newAnswer: 'Kritios Boy' },
  greece_ga_thucydides_peloponnesian_war: { newPool: 'historical_phrases' },
  greece_rel_hesiod_works:          { newPool: 'historical_phrases' },
  greece_ga_herodotus_title:        { newPool: 'historical_phrases' },
  greece_rel_homer_works:           { newPool: 'historical_phrases' },
  greece_ga_hippocratic_oath:       { newPool: 'historical_phrases' },
};

/** Ancient Rome changes */
const ROME_FIXES = {
  // --- date_events: bare numbers -> {N} ---
  rome_rep_marius_consulships:      { newAnswer: '{7}',       newAlts: ['7', 'seven'] },
  rome_cae_caesars_death_wounds:    { newAnswer: '{23}',      newAlts: ['23', 'twenty-three'] },
  rome_fall_crisis_third_century:   { newAnswer: '{50}',      newAlts: ['50', 'fifty'] },
  rome_emp_trajan_column_figures:   { newAnswer: '{2662}',    newAlts: ['2,662', 'two thousand six hundred sixty-two'] },
  rome_chr_pilate_caesarea_inscription: { newAnswer: '{1961}', newAlts: ['1961'] },

  // --- date_events: trim verbose date strings ---
  rome_chr_constantine_constantinople: { newAnswer: '330 CE' },
  rome_chr_constantine_death_date:  { newAnswer: '337 CE' },
  rome_cae_pharsalus_date:          { newAnswer: '48 BCE' },
  rome_emp_tiberius_death_ambiguity: { newAnswer: '37 CE' },
  rome_cae_ides_of_march:           { newAnswer: '44 BCE' },
  rome_aug_death_age:               { newAnswer: '14 CE' },
  rome_aug_title_meaning:           { newAnswer: '27 BCE' },
  rome_chr_milvian_bridge_date:     { newAnswer: '312 CE' },
  rome_aug_actium_date:             { newAnswer: '31 BCE' },
  rome_aug_constantine_edict_milan: { newAnswer: '313 CE' },
  rome_aug_476_ce:                  { newAnswer: '476 CE' },
  rome_chr_domitian_persecution:    { newAnswer: 'c. 95 CE' },

  // --- date_events: move non-date descriptions to historical_phrases ---
  rome_fall_antonine_plague:        { newPool: 'historical_phrases' },
  rome_rep_pompey_pirates:          { newPool: 'historical_phrases', newAnswer: '3 months (67 BCE)' },
  rome_cae_assassination_conspirators: { newPool: 'historical_phrases', newAnswer: 'About 60 senators' },
  rome_chr_nero_fire_date:          { newPool: 'historical_phrases', newAnswer: 'July 18–19, 64 CE' },
  rome_chr_constantine_death_baptism: { newPool: 'historical_phrases', newAnswer: 'Just before his death' },
  rome_chr_paul_missionary_dates:   { newPool: 'historical_phrases', newAnswer: 'Mid-40s to mid-50s CE' },
  rome_chr_persecution_duration:    { newPool: 'historical_phrases', newAnswer: 'Approximately 250 years' },
  rome_emp_pax_romana_length:       { newPool: 'historical_phrases', newAnswer: 'About 207 years' },
  rome_cae_britain_twice:           { newPool: 'historical_phrases', newAnswer: 'Twice (55 and 54 BCE)' },
  rome_cae_julian_calendar_error:   { newPool: 'historical_phrases', newAnswer: '11 minutes per year' },
  rome_cae_gallic_legions:          { newPool: 'historical_phrases', newAnswer: 'From 6 to 11 legions' },
  rome_rep_republic_duration:       { newPool: 'historical_phrases', newAnswer: 'About 482 years' },
  rome_aug_augustus_reign_length:   { newPool: 'historical_phrases', newAnswer: 'Over 40 years' },
  rome_aug_pax_romana_duration:     { newPool: 'historical_phrases', newAnswer: 'About 207 years (27 BCE–180 CE)' },
  rome_aug_hadrian_traveled:        { newPool: 'historical_phrases', newAnswer: 'Over half his reign' },
  rome_cae_gallic_casualties_sources: { newPool: 'historical_phrases', newAnswer: '1 million killed, 1 million enslaved' },

  // --- city_place_names: trim/reassign ---
  rome_cae_rubicon_meaning:         { newPool: 'historical_phrases', newAnswer: 'Border between Gaul and Roman Italy' },
  rome_aug_commodus_renamed:        { newPool: 'historical_phrases' },
  rome_cae_cleopatra_smuggled:      { newPool: 'historical_phrases' },
  rome_aug_antony_cleopatra_death:  { newAnswer: 'Alexandria' },  // trim 'Alexandria, Egypt' -> 'Alexandria'

  // --- general_politician_names: trim long names / reassign ---
  rome_rep_last_king:               { newAnswer: 'Tarquinius Superbus' },
  rome_rep_first_triumvirate_members: { newAnswer: 'Caesar, Pompey & Crassus' },
  rome_cae_assassins_brutus_cassius: { newPool: 'historical_phrases', newAnswer: 'Brutus and Cassius' },
  rome_cae_wills_heir:              { newPool: 'historical_phrases', newAnswer: 'Octavian, his great-nephew' },
  rome_aug_five_good_emperors_list: { newPool: 'historical_phrases', newAnswer: 'Nerva to Marcus Aurelius' },
  // Trim long names
  rome_aug_pantheon_rebuilt:        { newAnswer: 'Hadrian (117–138 CE)' },
  rome_rep_fabius_strategy:         { newAnswer: 'Quintus Fabius Maximus' },
  rome_cae_caesarion:               { newAnswer: 'Caesarion (Ptolemy XV)' },
  rome_eng_via_appia_builder:       { newAnswer: 'Appius Claudius Caecus' },
  rome_aug_horace_virgil_ovid:      { newAnswer: 'Virgil, Horace, and Ovid' },
  rome_rep_cloaca_maxima_builder:   { newAnswer: 'L. Tarquinius Priscus' },
  rome_emp_five_good_coined:        { newAnswer: 'Niccolò Machiavelli' },
  rome_pun_hannibal_vs_scipio_ranking: { newAnswer: 'Alexander the Great' },
  rome_fall_theodoric_great:        { newAnswer: 'Theodoric the Great' },

  // --- political_terms: bare numbers -> {N} ---
  rome_rep_kings_count:             { newAnswer: '{7}',      newAlts: ['7', 'seven'] },
  rome_mil_centurion_century:       { newAnswer: '{80}',     newAlts: ['80', 'eighty'] },
  rome_eng_roman_numerals_symbols:  { newAnswer: '{7}',      newAlts: ['7', 'seven'] },
  rome_mil_legion_size:             { newAnswer: '{5200}',   newAlts: ['5,200', '5200'] },
  rome_life_latin_romance_languages: { newAnswer: '{6}',     newAlts: ['6', 'six'] },

  // --- political_terms: move long descriptions to historical_phrases ---
  rome_emp_caligula_assassination:  { newPool: 'historical_phrases', newAnswer: 'Praetorian Guard' },
  rome_emp_claudius_curtain:        { newPool: 'historical_phrases', newAnswer: 'Behind a curtain' },
  rome_emp_trajan_title:            { newPool: 'historical_phrases', newAnswer: 'Optimus Princeps' },
  rome_aug_byzantine_self_name:     { newPool: 'historical_phrases', newAnswer: 'Romans (Rhomaioi)' },
  rome_rep_marius_army_reform:      { newPool: 'historical_phrases', newAnswer: 'The eagle (aquila)' },
  rome_chr_pilate_saint:            { newPool: 'historical_phrases', newAnswer: 'Ethiopian Orthodox' },
  rome_pun_cannae_tactic:           { newPool: 'historical_phrases', newAnswer: 'Double envelopment' },
  rome_rep_sulla_proscriptions:     { newPool: 'historical_phrases', newAnswer: 'Published death lists' },
  rome_aug_pater_patriae:           { newPool: 'historical_phrases', newAnswer: 'Father of the Country' },
  rome_emp_commodus_death:          { newPool: 'historical_phrases', newAnswer: 'Strangled in his bath' },
  rome_chr_decian_persecution:      { newPool: 'historical_phrases', newAnswer: 'Sacrifice certificates' },
  rome_aug_augustus_princeps:       { newPool: 'historical_phrases', newAnswer: 'Princeps (First Citizen)' },
  rome_pun_hannibal_death:          { newPool: 'historical_phrases', newAnswer: 'Suicide by self-poisoning' },
  rome_rep_spqr_meaning:            { newPool: 'historical_phrases' },
  rome_pun_hannibal_oath:           { newPool: 'historical_phrases', newAnswer: 'Never to be a friend of Rome' },
  rome_aug_claudius_hidden:         { newPool: 'historical_phrases', newAnswer: 'Found hiding behind a curtain' },
  rome_life_gladiators_status:      { newPool: 'historical_phrases', newAnswer: 'Slaves or condemned criminals' },
  rome_chr_constantine_praetorian:  { newPool: 'historical_phrases', newAnswer: 'Disbanded the Praetorian Guard' },
  rome_eng_vigiles_purpose:         { newPool: 'historical_phrases', newAnswer: 'Firefighting and night policing' },
  rome_aug_trajan_optimus:          { newPool: 'historical_phrases', newAnswer: 'Optimus Princeps (best ruler)' },
  rome_pun_hannibal_brothers_count: { newPool: 'historical_phrases', newAnswer: 'Two brothers: Hasdrubal and Mago' },
  rome_chr_christian_refusal_sacrifice: { newPool: 'historical_phrases', newAnswer: 'Refusal to sacrifice to the emperor' },
  rome_pun_zama_peace_terms:        { newPool: 'historical_phrases', newAnswer: '10,000 talents over 50 years' },
  rome_fall_romulus_augustulus_fate: { newPool: 'historical_phrases', newAnswer: 'Exiled with a pension' },
  rome_rep_social_war_result:       { newPool: 'historical_phrases', newAnswer: 'Citizenship for all free Italians' },
  rome_cae_civic_crown:             { newPool: 'historical_phrases', newAnswer: 'Saving a fellow citizen in battle' },
  rome_rep_tribunes_sacrosanct:     { newPool: 'historical_phrases', newAnswer: 'Sacrosanct (personally inviolable)' },
  rome_cae_bello_gallico_opening:   { newPool: 'historical_phrases', newAnswer: '"Gaul is divided into three parts"' },
  rome_cae_dictator_perpetuo:       { newPool: 'historical_phrases', newAnswer: 'Dictator in perpetuity' },
  rome_aug_colosseum_jerusalem:     { newPool: 'historical_phrases', newAnswer: 'Spoils from the Siege of Jerusalem' },
  rome_emp_claudius_disabilities:   { newPool: 'historical_phrases', newAnswer: 'Cerebral palsy or similar condition' },
  rome_pun_third_punic_cause:       { newPool: 'historical_phrases', newAnswer: 'Fighting Numidia without permission' },
  rome_aug_urine_tax:               { newPool: 'historical_phrases', newAnswer: 'Urine (used in tanning/cloth)' },
  rome_fall_western_collapse_factors: { newPool: 'historical_phrases', newAnswer: 'Military, economic, political, climate, disease' },
  rome_rep_twelve_tables_purpose:   { newPool: 'historical_phrases', newAnswer: 'Prevent patrician monopoly on unwritten law' },

  // --- text_work_names: bare number -> {N}, reassign non-work facts ---
  rome_chr_paul_new_testament:      { newAnswer: '{13}',     newAlts: ['13', 'thirteen'] },
  rome_life_bread_circuses:         { newPool: 'historical_phrases', newAnswer: 'Juvenal' },
  rome_chr_milvian_bridge_vision:   { newPool: 'historical_phrases' },
  rome_aug_marcus_stoicism:         { newPool: 'historical_phrases', newAnswer: 'Stoic philosophy' },

  // --- battle_names: trim long description ---
  rome_cae_pharsalus_pompey_cavalry: { newPool: 'historical_phrases', newAnswer: 'Deployed hidden infantry vs. cavalry' },
  rome_pun_aegates_islands:         { newAnswer: 'Battle of Aegates Islands' },

  // --- structure_names: bare numbers, trim, move ---
  rome_eng_roads_radiate:           { newAnswer: '{29}',     newAlts: ['29', 'twenty-nine'] },
  rome_eng_aqueducts_number:        { newAnswer: '{11}',     newAlts: ['11', 'eleven'] },
  rome_eng_circus_maximus_capacity: { newAnswer: '{150000}', newAlts: ['150,000'] },
  rome_aug_hadrian_wall_length:     { newPool: 'historical_phrases', newAnswer: '73 miles (117 km)' },
  rome_aug_trajans_column:          { newPool: 'historical_phrases', newAnswer: '2,662 figures in 155 scenes' },
  rome_aug_cursus_publicus:         { newPool: 'historical_phrases', newAnswer: 'Imperial postal relay system' },
  rome_cae_assassination_location:  { newPool: 'historical_phrases', newAnswer: 'Curia of Pompey' },
  rome_eng_forum_romanum_purpose:   { newPool: 'historical_phrases', newAnswer: 'Political, commercial, religious hub' },
  rome_eng_roman_arch_contribution: { newPool: 'historical_phrases', newAnswer: 'Span distances without stone lintels' },
  rome_eng_pantheon_dome_record:    { newPool: 'historical_phrases', newAnswer: 'Unreinforced concrete dome' },
  rome_eng_colosseum_name_origin:   { newPool: 'historical_phrases', newAnswer: 'A giant bronze statue of Nero' },
  rome_eng_road_construction_features: { newPool: 'historical_phrases', newAnswer: 'Cambered for drainage' },
  rome_emp_trajan_column_ashes:     { newPool: 'historical_phrases', newAnswer: 'At the base of the column' },
  rome_eng_via_appia_nickname:      { newPool: 'historical_phrases', newAnswer: 'Queen of the long roads' },

  // --- emperor_names: trim/reassign ---
  rome_emp_five_good_list:          { newPool: 'historical_phrases', newAnswer: 'Nerva to Marcus Aurelius' },
  rome_emp_four_emperors_order:     { newPool: 'historical_phrases', newAnswer: 'Galba, Otho, Vitellius, Vespasian' },
  rome_emp_vespasian_last_words:    { newPool: 'historical_phrases', newAnswer: '"I think I\'m becoming a god"' },
  rome_eng_aqua_claudia_builders:   { newPool: 'historical_phrases', newAnswer: 'Caligula and Claudius' },

  // --- roman_god_names: trim long compound answer ---
  rome_god_capitoline_triad:        { newPool: 'historical_phrases', newAnswer: 'Jupiter, Juno, and Minerva' },
};

// ---------------------------------------------------------------------------
// Apply fixes to a deck
// ---------------------------------------------------------------------------

function applyFixes(deck, fixes, newPoolLabel, newPoolName) {
  // Collect new pool members
  const newPoolFactIds = [];

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

    if (fix.newPool === 'historical_phrases') {
      fact.answerTypePoolId = 'historical_phrases';
      newPoolFactIds.push(factId);
    } else if (fix.newPool === 'concept_terms') {
      fact.answerTypePoolId = 'concept_terms';
    }
  }

  // Update existing pool factIds arrays
  // 1. Remove moved facts from their old pools
  for (const pool of deck.answerTypePools) {
    pool.factIds = pool.factIds.filter(id => {
      const fact = deck.facts.find(f => f.id === id);
      return fact && fact.answerTypePoolId === pool.id;
    });
  }

  // 2. Update concept_terms pool factIds (after moving athena_myth in)
  const conceptPool = deck.answerTypePools.find(p => p.id === 'concept_terms');
  if (conceptPool) {
    const conceptFacts = deck.facts.filter(f => f.answerTypePoolId === 'concept_terms');
    conceptPool.factIds = conceptFacts.map(f => f.id);
  }

  // 3. Create historical_phrases pool if new pool facts exist
  if (newPoolFactIds.length > 0) {
    // Check if pool already exists
    let histPool = deck.answerTypePools.find(p => p.id === 'historical_phrases');
    if (!histPool) {
      histPool = {
        id: 'historical_phrases',
        label: newPoolLabel,
        factIds: []
      };
      deck.answerTypePools.push(histPool);
    }
    // Rebuild factIds from deck.facts
    const histFacts = deck.facts.filter(f => f.answerTypePoolId === 'historical_phrases');
    histPool.factIds = histFacts.map(f => f.id);
    console.log(`  Created/updated '${newPoolName}' pool with ${histPool.factIds.length} facts`);
  }

  return deck;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('\n=== Fixing ancient_greece ===');
const greecePath = resolve(repoRoot, 'data/decks/ancient_greece.json');
let gDeck = JSON.parse(readFileSync(greecePath, 'utf8'));
let changed = 0;
for (const [factId, fix] of Object.entries(GREECE_FIXES)) {
  const fact = gDeck.facts.find(f => f.id === factId);
  if (fact) changed++;
}
console.log(`  Applying ${Object.keys(GREECE_FIXES).length} fixes to ${changed} facts`);
gDeck = applyFixes(gDeck, GREECE_FIXES, 'Historical Phrases & Descriptions', 'historical_phrases');
writeFileSync(greecePath, JSON.stringify(gDeck, null, 2) + '\n');
console.log('  Saved ancient_greece.json');

console.log('\n=== Fixing ancient_rome ===');
const romePath = resolve(repoRoot, 'data/decks/ancient_rome.json');
let rDeck = JSON.parse(readFileSync(romePath, 'utf8'));
let rChanged = 0;
for (const [factId, fix] of Object.entries(ROME_FIXES)) {
  const fact = rDeck.facts.find(f => f.id === factId);
  if (fact) rChanged++;
}
console.log(`  Applying ${Object.keys(ROME_FIXES).length} fixes to ${rChanged} facts`);
rDeck = applyFixes(rDeck, ROME_FIXES, 'Historical Phrases & Descriptions', 'historical_phrases');
writeFileSync(romePath, JSON.stringify(rDeck, null, 2) + '\n');
console.log('  Saved ancient_rome.json');

console.log('\nDone. Run node scripts/pool-homogeneity-analysis.mjs to verify.');
