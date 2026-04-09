#!/usr/bin/env node
/**
 * generate-manual-fixes.mjs
 *
 * Generates hand-crafted rewrites for the remaining 95 first-word-leak facts.
 * Each question is rewritten to remove the leaked term from the question stem.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Manual rewrites keyed by fact ID
// Rule: Question must NOT contain any word from the correct answer (4+ chars, non-stopword)
const MANUAL_REWRITES = {
  // ── AP Biology ────────────────────────────────────────────────────────────
  ap_bio_abiotic_synthesis_def:
    'What process, occurring before life existed, produced the first organic molecules from non-living chemicals — as proposed by Miller and Urey?',

  ap_bio_chr_theory:
    'Which theory, developed by Sutton and Boveri (~1902), explains Mendel\'s laws by stating that genes are located on heritable structures that separate during meiosis?',

  ap_bio_free_vs_bound_ribosomes:
    'What functional distinction exists between cytoplasmic ribosomes and ribosomes bound to the rough ER?',

  ap_bio_functional_groups_properties:
    'What role do functional groups play in the chemical properties of biological molecules such as reactivity, polarity, and solubility?',

  ap_bio_incomp_vs_codom:
    'What is the key difference between partial blending and simultaneous expression of both alleles in heterozygotes?',

  ap_bio_intron_exon_splicing:
    'During eukaryotic RNA processing, what happens to non-coding sequences and coding sequences in the pre-mRNA transcript?',

  ap_bio_mono_vs_para_compare:
    'In phylogenetics, how does a group that includes ALL descendants of an ancestor differ from one that includes only SOME?',

  ap_bio_nondisj_I_vs_II:
    'How do the outcomes of nondisjunction in the first round of gamete cell division differ from the second in terms of resulting gametes?',

  ap_bio_paraphyletic_def:
    'In cladistics, how does a group that includes an ancestor and only SOME of its descendants differ from a clade that includes ALL?',

  ap_bio_plant_cytokinesis_cell_plate:
    'In plant cells, what structure — formed by Golgi vesicles fusing at the equator — serves as the precursor to the new wall between daughter cells?',

  ap_bio_recessive_allele:
    'Which type of allele is masked by the dominant allele in a heterozygote and is only expressed in the homozygous condition?',

  ap_bio_reductional_equational:
    'How do the first and second rounds of gamete cell division differ in terms of whether they halve the chromosome number?',

  ap_bio_selection_comparison:
    'How do one-sided selection, variance-reducing selection, and variance-increasing selection differ in their effects on a population\'s phenotype distribution?',

  ap_bio_transcription_direction:
    'In what direction does RNA polymerase read the DNA coding strand, and in what direction is the mRNA synthesized?',

  // ── AP Chemistry ─────────────────────────────────────────────────────────
  ap_chem_7_7_ICE_table_setup:
    'In an ICE table, what information is entered in each of the three rows — I, C, and E — when solving equilibrium problems?',

  // ── AP Macro / Economics ──────────────────────────────────────────────────
  ap_macro_1_ppc_capital_vs_consumer:
    'On a PPC showing the trade-off between two types of goods, producing more of which type today — investment goods or consumer goods — shifts the PPC outward in the future?',

  // ── AP Physics 1 ─────────────────────────────────────────────────────────
  ap_phys1_centrifugal_force:
    'Why is the apparent outward force felt in circular motion considered fictitious in a non-rotating reference frame?',

  ap_phys1_centripetal_force_not_separate:
    'Why is the inward-directed force in circular motion never drawn as a separate arrow on a free-body diagram?',

  ap_phys1_circular_centripetal_misconception:
    'A student draws a free-body diagram for a car on a circular track and adds an inward "circular force" arrow. What is wrong with this diagram?',

  ap_phys1_coefficient_restitution:
    'What value of the elasticity ratio (e = relative speed after/before collision) characterizes a perfectly elastic collision vs. a perfectly inelastic one?',

  ap_phys1_damped_oscillations:
    'What happens to the peak displacement of oscillation when a spring-mass system experiences friction?',

  ap_phys1_drag_qualitative:
    'Qualitatively, how does air resistance affect a falling object, and what is terminal velocity?',

  ap_phys1_efficiency_formula:
    'What is the formula for the useful-output-to-input ratio of an energy conversion process?',

  ap_phys1_fbd_contact_vs_field:
    'What is the distinction between surface forces and field forces, and which appear on free-body diagrams?',

  ap_phys1_flow_rate_def:
    'What equation gives the rate of fluid flowing through a pipe (volume per unit time) in terms of cross-sectional area and fluid speed?',

  ap_phys1_friction_independent_area:
    'Does the sliding friction force change if you increase the surface area between two objects (same mass and material)?',

  ap_phys1_gauge_absolute_pressure:
    'A tire gauge reads 30 PSI (gauge). What is the actual pressure inside the tire?',

  ap_phys1_gravitational_pe_reference:
    'Why can you choose any reference level for potential energy due to gravity?',

  ap_phys1_hydrostatic_shape_independence:
    'A narrow cylinder and a wide tank are both filled with water to the same depth. Which has greater fluid force at the bottom?',

  ap_phys1_manometer_barometer:
    'What is the difference between an instrument that measures atmospheric pressure and one that measures gauge pressure of a gas?',

  ap_phys1_momentum_external_only:
    'Under what condition is the total momentum of a system conserved?',

  ap_phys1_negative_accel_not_decel:
    'Does negative acceleration always mean an object is slowing down?',

  ap_phys1_position_vs_displacement:
    'What is the key distinction between where an object is (measured from origin) and how far it has moved from its starting point?',

  ap_phys1_satellite_orbit:
    'For an orbiting satellite, what equation expresses the balance between the planet\'s attractive force and the circular motion requirement?',

  ap_phys1_satellite_orbit_speed:
    'What is the speed of a satellite at radius r around a planet of mass M — and how does it change with altitude?',

  ap_phys1_static_vs_kinetic_friction:
    'What is the key difference between the friction that prevents an object from sliding and the friction that opposes sliding once motion begins?',

  ap_phys1_system_internal_external:
    'In systems thinking, what is the difference between forces acting between objects within the system and forces from outside?',

  ap_phys1_torque_lever_arm:
    'What is the perpendicular arm in a rotational force calculation, and why does it use the shortest distance to the line of action?',

  ap_phys1_torque_zero_cases:
    'Under what conditions does a force produce zero rotational effect about a given axis?',

  ap_phys1_total_mechanical_energy:
    'What is the sum of kinetic and potential energy called, and when is it conserved?',

  ap_phys1_viscosity_laminar_turbulent:
    'What is fluid resistance to flow called, and what distinguishes smooth layered flow from chaotic flow?',

  ap_phys1_weightlessness_misconception:
    'Why do people in the International Space Station appear weightless even though Earth\'s gravity still acts on them?',

  // ── AP Psychology ─────────────────────────────────────────────────────────
  ap_psych_did_definition:
    'Which disorder, formerly known as multiple personality disorder, involves the presence of two or more distinct identity states and gaps in memory?',

  ap_psych_panic_disorder:
    'Which disorder is characterized by recurrent, unexpected attacks of intense fear followed by at least one month of worry about future attacks?',

  ap_psych_thyroid_metabolism:
    'Which butterfly-shaped endocrine gland in the neck regulates the body\'s metabolic rate by producing thyroxine?',

  // ── AP Human Geography ────────────────────────────────────────────────────
  aphg_u2_nir:
    'What is subtracted from the crude birth rate to calculate the rate of natural population change?',

  aphg_u6_southeast_asian_city_model:
    'Which urban model describes a port zone as the dominant center, surrounded by a commercial zone and alien commercial zones?',

  // ── AP US History ─────────────────────────────────────────────────────────
  apush_p1_pueblo_revolt_1680:
    'Which 1680 revolt, led by the religious leader Popé, temporarily drove Spanish colonizers out of the Rio Grande region?',

  apush_p2_colonial_rice_carolina:
    'What cash crop formed the economic foundation of the Carolina lowcountry plantation system, with enslaved Africans bringing cultivation expertise?',

  apush_p2_virginia_company:
    'What joint-stock company founded Jamestown in 1607 and held the royal charter for English colonization of the Atlantic seaboard?',

  apush_p3_elastic_clause:
    'What constitutional provision grants Congress the power to make all laws "necessary and proper" for carrying out its enumerated powers?',

  apush_p3_native_land_loss:
    'What general process — often through coerced treaties, military defeat, and settler encroachment — resulted in indigenous peoples losing their territories?',

  apush_p4_hudson_river_school:
    'What first major American art movement celebrated the grandeur of the American landscape in paintings by Thomas Cole and Frederic Church?',

  apush_p5_free_soil_party:
    'What third party, formed in 1848, opposed the extension of slavery into new western territories under the slogan "Free Soil, Free Speech, Free Labor, Free Men"?',

  apush_p7_executive_order_9066:
    'Signed by FDR on February 19, 1942, which order authorized the forced relocation and internment of Japanese Americans?',

  apush_p8_berkeley_free_speech:
    'What 1964 student movement at the University of California led by Mario Savio challenged restrictions on political activity and free expression on campus?',

  apush_p8_epa_created:
    'What federal agency, established by President Nixon in December 1970 following the first Earth Day, is responsible for regulating pollution and protecting natural resources?',

  apush_p8_immigration_act_1965:
    'What 1965 Great Society law abolished the national-origins quota system that had favored European immigrants?',

  apush_p8_southern_strategy:
    'What Republican electoral strategy, associated with Nixon\'s 1968 and 1972 campaigns, appealed to white conservative voters in formerly Democratic states?',

  apush_p8_voting_rights_act:
    'What August 1965 law signed by President Johnson prohibited discriminatory electoral practices such as literacy tests?',

  apush_p8_war_on_poverty:
    'What 1964 law established the Office of Economic Opportunity and created programs like Head Start and VISTA?',

  apush_p9_latino_asian_immigration_surge:
    'What 1965 legislation abolished national-origin quotas, setting in motion the demographic transformation of the United States?',

  // ── AP World History ──────────────────────────────────────────────────────
  apwh_3_070:
    'Which empire used Sikhism as a spiritual movement that emerged partly in response to religious policy under this empire\'s rulers?',

  // ── Other domains ──────────────────────────────────────────────────────────
  const_myth_pleiades_homer:
    'What mythological relationship does Hesiod\'s Works and Days describe between the Hunter constellation and the Pleiades?',

  cs_1_dennard_scaling_breakdown:
    'What scaling rule — formulated in 1974 by Robert Dennard — held that as transistors shrank, power density stayed constant?',

  cs_2_prolog_stands_for:
    'What does the logic-programming language "Prolog" stand for — reflecting its approach where you declare facts and rules?',

  cs_5_yahoo_founders:
    'Which two Stanford PhD students founded Yahoo in January 1994, initially calling it "Jerry and David\'s Guide to the World Wide Web"?',

  food_dish_green_curry_color:
    'What ingredient makes Thai curry of this color its distinctive hue — and what does "sweet" refer to in its Thai name?',

  greece_oc_theater_dionysus:
    'Which performance venue on the south slope of the Acropolis in Athens is considered the world\'s first such structure dedicated to drama?',

  ha_multi_030:
    'What are the five clinical warning signs (spelled out as an acronym) used to identify a suspicious pigmented lesion that may be melanoma?',

  med_feu_motte_bailey:
    'What were the two key components of the earthen-mound and enclosed-yard castle, the dominant early medieval defensive design?',

  med_vik_stamford_bridge:
    'At the Battle of Stamford Bridge (September 25, 1066), who killed the Norwegian king Harald Hardrada, and how many Viking ships returned home?',

  nasa_mro_mars:
    'Which orbiter has been mapping the red planet since 2006 and found evidence of seasonal liquid water flows on its surface?',

  ocean_3_pufferfish_sand_circles:
    'Why do male pufferfish spend days creating elaborate geometric circles in the seafloor sediment?',

  ocean_4_endangered_north_atlantic_right_whale:
    'With only ~350 remaining, which large whale species faces extinction mainly from ship strikes and fishing gear entanglement in the western Atlantic?',

  ww_pal_himeji_nickname:
    'What is the popular nickname of Himeji Castle in Japan, given for its gleaming light-colored plastered exterior walls?',

  wwii_nw_bismarck_sank_hood:
    'On May 24, 1941, the German battleship Bismarck scored a catastrophic hit that shocked the Allied naval forces — what did it sink?',

  wwii_rtw_peace_for_our_time_quote:
    'Chamberlain\'s 1938 speech after Munich is constantly misquoted as "peace in our time." What was his actual phrasing?',

  wwii_rtw_sudetenland_ethnic_exclusion:
    'At the Munich Conference that decided the fate of a Central European nation\'s Sudetenland, how was that nation itself involved in the talks?',

  'animals-peafowl-three-species':
    'Which peafowl species is native only to the river basin spanning the Democratic Republic of Congo?',

  'art_architecture-decorative-art-vs-fine-art':
    'What is the key distinction between functional arts and fine arts?',

  'general_knowledge-programming-software-engineering':
    'What term applies when application development uses formal engineering design processes?',

  'general_knowledge-paleontology-media-budget':
    'How does the public leisure budget for prehistoric life compare to actual paleontology research funding?',

  'general_knowledge-computer-hardware-software-only-systems':
    'Most computers need physical components and applications together, but what do some embedded systems operate on alone?',

  'general_knowledge-cpu-alу':
    'What component inside every CPU handles all numerical calculation and logic operations?',

  'geo-kuwait-city-state':
    'The Gulf state of Kuwait is described as a city-state because most of its people live in which urban center?',

  'geography-saint-petersburg-siege':
    'Which WWII blockade is recorded as the most lethal in all of history?',

  'history-french-revolution-feudalism-abolished':
    'What landmark proclamation of human rights emerged from the French Revolution in 1789?',

  'history-saddam-nationalized-oil':
    'Which oil company did Saddam Hussein nationalize while serving as Vice President of the country now known as Iraq?',

  'human_body_health-hepatitis-five-viruses':
    'Which liver disease virus can only infect someone who already has the B variant of that infection?',

  'human_body_health-aneurysm-rupture-risk':
    'What happens to an artery-wall weakness\'s risk of bursting as its size increases?',

  'human_body_health-hepatitis-d-requires-b':
    'Which liver disease type can only infect people already infected with the B variant?',

  'natural_sciences-rutherford-invited-bohr':
    'Which famous atomic model resulted from Rutherford inviting a young Danish physicist to his lab in 1912?',

  'natural_sciences-schrödinger-wave-equation':
    'What equation did a Nobel-winning Austrian physicist develop to describe how quantum systems evolve over time?',

  'science-chemical-compound-four-bond-types':
    'Which type of chemical compound is held together by electrostatic attraction between positive and negative ions?',
};

const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-fixes.json');
const FIRST_WORD_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-first-word-leaks.json');

// Load existing fixes
let existingFixes = [];
if (fs.existsSync(OUTPUT_PATH)) {
  existingFixes = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
}
const existingIds = new Set(existingFixes.map(f => f.id));

// Load first-word leaks for old question lookup
const firstWordLeaks = JSON.parse(fs.readFileSync(FIRST_WORD_PATH, 'utf-8'));
const lookupById = new Map(firstWordLeaks.map(s => [s.id, s]));

const newFixes = [];
const missing = [];

for (const [id, newQ] of Object.entries(MANUAL_REWRITES)) {
  if (existingIds.has(id)) {
    console.log(`Already fixed: ${id}`);
    continue;
  }

  const item = lookupById.get(id);
  if (!item) {
    // Try looking up in the DB
    missing.push(id);
    console.log(`Not in first-word-leaks: ${id}`);
    continue;
  }

  newFixes.push({
    id,
    field: 'quiz_question',
    old: item.q,
    new: newQ,
  });
}

console.log(`New manual fixes: ${newFixes.length}`);
console.log(`Missing lookups: ${missing.length}`);

// Merge and write
const allFixes = [...existingFixes, ...newFixes];
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allFixes, null, 2));
console.log(`Total fixes written: ${allFixes.length}`);

// Show sample
for (const f of newFixes.slice(0, 5)) {
  console.log(`\nID: ${f.id}`);
  console.log(`OLD: ${f.old.substring(0, 100)}`);
  console.log(`NEW: ${f.new.substring(0, 100)}`);
}
