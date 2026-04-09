#!/usr/bin/env python3
"""
Pass 2: Fix the remaining 103 self-answering questions where the leaked word
appears multiple times in the question. Uses targeted manual rewrites.
"""

import json
import re
import sys
from pathlib import Path

DECKS_DIR = Path('/Users/damion/CODE/Recall_Rogue/data/decks')

# Manual rewrites: factId -> new quizQuestion
# Each rewrite removes the leaked word entirely from the question.
MANUAL_REWRITES = {
    # ancient_greece
    'greece_ga_herodotus_histories': (
        'In which ancient Greek writing style did Herodotus compose his Histories — the same style used in the Ionian city where he was born?',
        'dialect',
    ),
    'greece_oc_theater_dionysus': (
        'Which ancient performance venue on the south slope of the Acropolis in Athens is considered the world\'s first such structure — host to the premieres of works by Sophocles, Euripides, and Aristophanes?',
        'theater',
    ),

    # ap_biology
    'ap_bio_golgi_faces': (
        'In the Golgi apparatus, which side receives vesicles from the ER, and which side buds off vesicles to their final destinations?',
        'face',
    ),
    'ap_bio_ps_009': (
        'What series of protein complexes embedded in the photosynthetic membrane between PSII and PSI passes electrons and uses the released energy to pump protons, creating the gradient that drives ATP synthesis?',
        'thylakoid',
    ),
    'ap_bio_pyox_001': (
        'What process converts each 3-carbon molecule (from glycolysis) to acetyl-CoA (2C) + CO₂ in the mitochondrial matrix, also producing 1 NADH per molecule converted?',
        'pyruvate',
    ),
    'ap_bio_pyox_005': (
        'What large multi-enzyme complex in the mitochondrial matrix catalyzes the oxidative decarboxylation step between glycolysis and the citric acid cycle, converting a 3-carbon substrate to acetyl-CoA while consuming CoA, NAD⁺, and lipoate?',
        'pyruvate',
    ),
    'ap_bio_u4_054': (
        'What is the classic example of positive feedback in hemostasis — coagulation factors activating more coagulation factors until the wound is sealed?',
        'clotting',
    ),
    'ap_bio_u6_053': (
        'Which chromatin modification — catalyzed by HATs — neutralizes the positive charge of protein tails, loosening their grip on DNA and making genes more accessible for transcription?',
        'histone',
    ),
    'ap_bio_u8_075': (
        'What type of ecological community recovery follows a disturbance that removes the existing biotic community but leaves soil intact — such as abandoned farmland or a forest after fire?',
        'succession',
    ),
    'ap_bio_unsaturated_kink': (
        'A double bond in a lipid\'s carbon chain causes the chain to kink, preventing tight packing and resulting in a fat that is liquid at room temperature. What type of lipid is described?',
        'fatty',
    ),
    'ap_bio_base_pairing_dna': (
        'In a DNA double helix, what are the complementary nucleotide pairing rules — which nitrogen-containing compound pairs with adenine, and which pairs with guanine?',
        'base',
    ),

    # ap_chemistry
    'ap_chem_3_1_imf_strength_order': (
        'What is the correct order of intermolecular force strength from weakest to strongest: London dispersion forces, hydrogen bonding, and the force between partial charges?',
        'dipole',
    ),
    'ap_chem_3_5_kmt_elastic_collisions': (
        'According to Kinetic Molecular Theory, gas particle interactions involve no net loss of total kinetic energy — these are called what type of interactions?',
        'collisions',
    ),
    'ap_chem_4_5_limiting_reagent_identification': (
        'To identify the limiting reagent when given moles of each starting material, you divide each starting material\'s available moles by its stoichiometric coefficient. What does the smallest result indicate?',
        'reactant',
    ),
    'ap_chem_4_5_percent_yield_calculation': (
        'A reaction has a theoretical output of 25.0 g of product. The student collects 20.0 g in the lab. What is the percent efficiency of the reaction?',
        'yield',
    ),
    'ap_chem_5_8_pre_equilibrium_intermediate': (
        'In the pre-equilibrium approximation, the concentration of an intermediate formed in a fast reversible stage is expressed using the equilibrium constant expression. What is this expression called?',
        'step',
    ),
    'ap_chem_7_2_all_reactions_reversible': (
        'What fundamental principle about chemical transformations states that even processes that appear to go "to completion" still technically proceed in both directions?',
        'reactions',
    ),

    # ap_macroeconomics
    'ap_macro_1_ppc_capital_vs_consumer': (
        'On a PPC showing the trade-off between two output categories, producing more of which type today — investment items or consumption items — shifts the entire curve outward in the future?',
        'goods',
    ),
    'ap_macro_3a_tax_multiplier_term': (
        'Which fiscal amplifier is always negative and smaller in absolute value than the spending amplifier, because a tax cut\'s first round is partially saved rather than fully spent?',
        'multiplier',
    ),
    'ap_macro_3a_multiplier_spending_vs_tax': (
        'Comparing the spending amplifier (1/MPS) and the tax amplifier (-MPC/MPS), which is larger in absolute value and why?',
        'multiplier',
    ),
    'ap_macro_5b_loanable_funds_market': (
        'What financial market brings together savers who supply money for lending and borrowers (including the government) who demand capital for investment?',
        'funds',
    ),

    # ap_microeconomics
    'ap_micro_2_pes_determinant_spare_capacity': (
        'A factory operating at only 60% utilization will have more elastic supply than a factory running at full utilization because of which supply determinant?',
        'capacity',
    ),
    'ap_micro_2b_003': (
        'Consumer welfare gain plus producer welfare gain equals what combined efficiency measure used in welfare economics?',
        'surplus',
    ),
    'ap_micro_3b_037': (
        'What happens to total economic welfare (the sum of consumer benefit and producer benefit) in a perfectly competitive long-run equilibrium?',
        'surplus',
    ),
    'ap_micro_3a_tp_max_point': (
        'At the output level where Total Output reaches its maximum, what is true about the Marginal Output of the variable input?',
        'product',
    ),
    'ap_micro_3b_020': (
        'In a perfectly competitive industry suffering short-run economic losses, what long-run adjustment process eliminates those losses?',
        'losses',
    ),
    'ap_micro_3b_026': (
        'What type of market structure has a perfectly horizontal long-run supply curve because input prices do not change as the sector expands?',
        'industry',
    ),
    'ap_micro_4b_030': (
        'What type of strategic interaction has players move in turns — so later movers can observe earlier choices — often analyzed with a decision tree and backward induction?',
        'game',
    ),
    'ap_micro_6a_013': (
        'A cap-and-trade system achieves ___ because firms with low pollution-reduction costs cut emissions more and sell permits to firms with high reduction costs.',
        'abatement',
    ),

    # ap_physics_1
    'ap_phys1_accel_direction': (
        'If an object moves in the positive direction but its acceleration vector points negative, what is happening to its speed?',
        'direction',
    ),
    'ap_phys1_flow_rate_def': (
        'What equation gives the fluid flow rate Q (cubic measure per unit time) through a pipe in terms of cross-sectional area A and fluid speed v?',
        'volume',
    ),
    'ap_phys1_collapsing_star_angular_momentum': (
        'A dying stellar object collapses into a neutron body, reducing its radius by a factor of 100,000. What happens to its rotation rate?',
        'star',
    ),
    'ap_phys1_solid_vs_hollow_rolling': (
        'Ranking from fastest to slowest rolling down a ramp: solid ball, hollow ball, solid cylinder, hollow cylinder. What is the order and why?',
        'sphere',
    ),
    'ap_phys1_spring_period_mass_k': (
        'How does doubling the mass or doubling the stiffness constant each affect the period of a mass-on-elastic-device oscillator?',
        'spring',
    ),
    'ap_phys1_rotational_kinematics': (
        'How do the angular motion equations for constant angular acceleration relate to the translational motion equations?',
        'equations',
    ),
    'ap_phys1_rotational_kinematic_eqs': (
        'How are the angular motion equations related to the linear motion equations?',
        'equations',
    ),

    # ap_psychology
    'ap_psych_dev_moro_reflex': (
        'Which newborn automatic response — also called the startle response — causes an infant to suddenly throw its arms out to the sides, arch its back, and then pull the arms back in?',
        'reflex',
    ),
    'ap_psych_dev_gender_schema_bem': (
        'Which cognitive theory, proposed by Sandra Bem, holds that children actively organize their world around categories based on biological sex that they learn from their culture?',
        'gender',
    ),
    'ap_psych_motiv_maslow_hierarchy': (
        'What motivational framework, proposed by Abraham Maslow in 1943, arranges human requirements in a pyramid from basic physiological requirements at the base to self-actualization at the top?',
        'needs',
    ),

    # ap_us_history
    'apush_p5_free_soil_party': (
        'What third party, formed in 1848, opposed the extension of slavery into new western territories under the slogan combining freedom from slavery and freedom for land grants?',
        'free',
    ),
    'apush_p8_now_founded': (
        'What advocacy group, co-founded by Betty Friedan in 1966, became the leading force of second-wave feminism and advocated for equal rights and opportunities for women?',
        'organization',
    ),

    # ap_world_history
    'apwh_3_038': (
        'Why did devshirme recruits owe exclusive loyalty to the Ottoman sultan rather than to noble families?',
        'ottoman',
    ),
    'apwh_4_004': (
        'Which triangular canvas configuration, adopted from Arab dhows, was crucial to Portuguese caravel design because it allowed ships to navigate against the wind?',
        'sail',
    ),
    'apwh_4_010': (
        'Which circumnavigation expedition (1519–1522), begun by Ferdinand Magellan and completed by Juan Sebastián Elcano after Magellan\'s death, was the first to circle the globe?',
        'magellan',
    ),
    'apwh_5_075': (
        'The Industrial Revolution in textiles began in Britain\'s fiber industry rather than wool or silk. Which geographic factor gave British manufacturers access to cheap raw material from American plantations?',
        'cotton',
    ),
    'apwh_8_033': (
        'The Paris Peace Accords of 1973 ended direct US military involvement in Southeast Asia. What ultimately happened to South Vietnam two years later?',
        'vietnam',
    ),
    'apwh_8_034': (
        'The Soviet blockade of 1948–1949 attempted to cut off West Berlin from Western-controlled Germany. How did the Western Allies respond?',
        'berlin',
    ),

    # computer_science
    'cs_7_fsf_license': (
        'What copyleft software agreement, created and maintained by the Free Software Foundation, requires any software built on it to also be released under the same terms?',
        'license',
    ),

    # constellations
    'const_dso_andromeda_type': (
        'What type of stellar system is the Andromeda object in the night sky?',
        'galaxy',
    ),

    # famous_inventions
    'inv_2_jet_ohain': (
        'When did the world\'s first aircraft using a turbine engine take flight, and whose engine made it possible?',
        'powered',
    ),
    'inv_4_pat_nylon_carothers_fate': (
        'What happened to Wallace Carothers, the chemist who developed the synthetic polymer used in stockings, before that material\'s public announcement?',
        'nylon',
    ),

    # human_anatomy
    'ha_cardio_082': (
        'The azygos system collects venous blood from the posterior thorax and abdomen. Into which great vessel does the main azygos trunk drain, and at what vertebral level?',
        'azygos',
    ),
    'ha_clinical_031': (
        'Acute compartment syndrome most commonly affects which section of the lower leg?',
        'compartment',
    ),
    'ha_embryo_051': (
        'The most common type of tracheo-esophageal fistula (84% of cases) involves a blind upper pouch and a lower fistula connecting to the trachea. What is this malformation called?',
        'esophageal',
    ),
    'ha_endo_039': (
        'Insulin is produced by which pancreatic endocrine cell type, and approximately what percentage of the endocrine cells are of this type?',
        'islet',
    ),
    'ha_lymph_002': (
        'The right lymphatic duct drains lymph from the right arm and right side of the head and thorax into which subclavian vein?',
        'right',
    ),
    'ha_musc_065': (
        'Which is the largest hip adductor, with a dual nerve supply — obturator nerve for its medial part and the tibial division of the sciatic nerve for its posterior (hamstring) part?',
        'adductor',
    ),
    'ha_musc_105': (
        'Opponens pollicis, along with abductor pollicis brevis and the superficial head of flexor pollicis brevis, is innervated by a small terminal division of the median nerve at the wrist. What is this division called?',
        'branch',
    ),
    'ha_regional_003': (
        'The carotid triangle of the neck contains which major arterial landmark where the common vessel divides into its internal and external divisions?',
        'carotid',
    ),
    'ha_regional_048': (
        'The suboccipital triangle contains the vertebral artery plus one named nerve. This nerve innervates the four suboccipital muscles and does NOT exit through any foramen — what is it called?',
        'suboccipital',
    ),
    'ha_regional_057': (
        'The ulnar nerve does NOT pass through the carpal tunnel. It travels in a separate fibro-osseous passage at the ulnar wrist, between the pisiform and hamate bones. What is this passage called?',
        'canal',
    ),
    'ha_repro_021': (
        'What short passage is formed by the union of the vas deferens and the seminal vesicle, and opens into the prostatic urethra?',
        'duct',
    ),
    'ha_integ_041': (
        'Which structure at the base of the fingernail is responsible for producing the nail plate, and what is the visible pale crescent at the proximal end called?',
        'nail',
    ),
    'ha_skel_057': (
        'Which bony opening — formed between the pubis and ischium — is the largest such opening in the human body?',
        'foramen',
    ),
    'ha_urin_004': (
        'The renal artery, renal vein, and ureter all enter or exit the kidney through a medial indentation. What is this indentation called?',
        'renal',
    ),
    'ha_urin_014': (
        'In the loop of Henle, one section is thick-walled, impermeable to water, and actively pumps Na+, K+, and Cl- into the medullary interstitium. Which section is this?',
        'limb',
    ),
    'ha_clinical_076': (
        'In tracheostomy, the incision is typically made between which tracheal rings, and which structure must be avoided or ligated superiorly?',
        'tracheal',
    ),
    'ha_clinical_082': (
        'When inserting a hollow device into an intercostal space (for nerve block, thoracentesis, or chest tube), where should it pass relative to the rib margin?',
        'needle',
    ),
    'ha_embryo_080': (
        'Enteric nervous system cells begin migrating from the neural tube in what embryonic week, and by what week should they reach the hindgut?',
        'neural',
    ),
    'ha_embryo_081': (
        'Isolated palate malformation (without lip malformation) occurs during weeks 7–8 when which specific fusion event fails?',
        'cleft',
    ),
    'ha_musc_122': (
        'The intercostal neurovascular bundle (vein, artery, nerve from superior to inferior) runs between which two muscle layers in the chest wall?',
        'intercostal',
    ),
    'ha_musc_125': (
        'The pharyngeal nerve network innervates the superior, middle, and inferior pharyngeal constrictor muscles. Which cranial nerve is the dominant motor supply?',
        'plexus',
    ),
    'ha_musc_139': (
        'The superior oblique passes through a fibrocartilaginous pulley (the trochlea) before inserting on the globe. What are its three actions?',
        'superior',
    ),
    'ha_nerv_113': (
        'The most common incomplete spinal injury syndrome occurs after cervical hyperextension in elderly patients. What is it called, and what is its hallmark deficit pattern?',
        'cord',
    ),
    'ha_nerv_121': (
        'Which cerebellar peduncle is the primary OUTPUT pathway, carrying efferent fibres from the deep cerebellar nuclei to the thalamus?',
        'cerebellar',
    ),
    'ha_cardio_093': (
        'Which coronary artery supplies the inferior wall of the LV, the right ventricle, the SA node (in 60% of individuals), and the AV node (in 90%)?',
        'node',
    ),
    'ha_cardio_097': (
        'In cardiac physiology, end-diastolic stretch is the load on the ventricular walls just before contraction. Clinically, what is the best bedside measure of this parameter?',
        'preload',
    ),
    'ha_clinical_066': (
        'A femoral hernia protrudes through the femoral canal — what is the anatomical position of the femoral canal relative to the inguinal ligament and femoral vein?',
        'femoral',
    ),
    'ha_clinical_080': (
        'For anterior thigh surgery or analgesia, which peripheral nerve block targets the nerve lying lateral to the femoral artery in the femoral triangle?',
        'femoral',
    ),

    # mammals_world
    'mamm_2_tax_monotreme_eggs': (
        'Monotremes nurse their young but lack teats. How do their young receive nourishment?',
        'milk',
    ),
    'mamm_3_beh_humpback_shared': (
        'All male humpback whales in a given region produce the same acoustic display, and that display changes over time. What does this phenomenon represent?',
        'song',
    ),
    'mamm_3_beh_platypus_venom': (
        'Which sex of platypus has venomous hind-leg appendages, and where are these appendages located?',
        'spurs',
    ),

    # nasa_missions
    'nasa_mro_mars': (
        'Which orbiter around the red planet has been mapping its surface since 2006 and found evidence of seasonal liquid water flows?',
        'mars',
    ),

    # philosophy
    'philosophy_ec_junzi_meaning': (
        'What Confucian term describes the morally cultivated individual who embodies ren and li, contrasted with the xiaoren (petty individual)?',
        'person',
    ),
    'philosophy_em_locke_primary_secondary': (
        'What distinction did Locke draw between attributes that belong to objects regardless of perception (shape, size, motion, number) and those that exist only in the perceiving mind?',
        'qualities',
    ),
    'philosophy_nc_meinong_theory_of_objects': (
        'What did Meinong call his systematic ontological account that includes non-existent items — like the golden mountain or the round square?',
        'objects',
    ),
    'philosophy_at_tarski_truth_schema': (
        'Tarski\'s account used the T-schema — "\'Snow is white\' is true if and only if snow is white" — to define semantic correctness for formal languages. What is this account called?',
        'truth',
    ),
    'philosophy_at_goodman_grue_paradox': (
        'Nelson Goodman defined a predicate "grue" as green if observed before time T and blue if observed after. All observed emeralds equally confirm being green and being "grue." What problem does this illustrate?',
        'grue',
    ),

    # world_cuisines
    'food_dish_green_curry_color': (
        'What ingredient gives Thai green curry its distinctive color — and what does "sweet" refer to in its Thai name?',
        'green',
    ),

    # world_religions
    'world_religions_sik_banda_singh': (
        'Which Sikh military commander, commissioned by Guru Gobind Singh in 1708, led the Khalsa army to defeat the Mughal forces at Sirhind?',
        'singh',
    ),
    'world_religions_oth_fire_temple': (
        'What is the Zoroastrian place of worship, where a sacred flame is kept perpetually burning as a symbol of Ahura Mazda\'s light and purity?',
        'fire',
    ),

    # world_war_ii
    'wwii_al_churchill_nobel': (
        'Churchill won the Nobel Prize in 1953 — but not for Peace. In which category was a wartime leader awarded this honor?',
        'prize',
    ),
    'wwii_ef_berlin_fall': (
        'After crossing the Vistula in January and sweeping through Poland, Soviet forces captured Berlin in what month of that same year?',
        '1945',
    ),
    'wwii_rtw_putsch_conditions': (
        'While Hitler was incarcerated for treason after the Beer Hall Putsch, authorities allowed him civilian clothes, visitors, letters, and books. What was the name of the facility where he was held?',
        'prison',
    ),
    'wwii_rtw_army_oath': (
        'On 2 August 1934, the day Hitler became Führer, the entire German armed forces swore a new pledge — notable because it broke from tradition by binding soldiers personally to a named individual rather than to the nation. What was this pledge called?',
        'oath',
    ),
    'wwii_rtw_016': (
        'The 1925 Locarno Treaties guaranteed Germany\'s western borders with France and Belgium — but what critical geographic category was left unguaranteed?',
        'borders',
    ),
    'wwii_rtw_sudetenland_ethnic_exclusion': (
        'At the Munich Conference that decided Czechoslovakia\'s fate, how was Czechoslovakia itself involved in the negotiations?',
        'czechoslovakia',
    ),
    'wwii_tw_t34_production': (
        'What Soviet armored vehicle — with revolutionary sloped armor that deflected shells, a powerful diesel engine, and wide tracks for mud and snow — was the most produced in history?',
        'tank',
    ),
    'wwii_tw_me262_jet': (
        'What was the name of the world\'s first operational turbine-powered combat aircraft — capable of 540 mph, over 100 mph faster than any Allied piston aircraft?',
        'fighter',
    ),
    'wwii_hf_conscientious_objectors_cps': (
        'American conscientious objectors who refused military duty on moral or religious grounds were assigned to what alternative civilian program?',
        'service',
    ),

    # world_wonders
    'ww_bridge_tower_bridge_type': (
        'What type of moveable span is London\'s Tower Bridge?',
        'bridge',
    ),
    'ww_pal_neuschwanstein_disney': (
        'Which famous Disney theme park landmark was directly inspired by Neuschwanstein in Bavaria?',
        'castle',
    ),
}


def contains_leaked_word(question: str, leaked_word: str) -> bool:
    """Check if leaked word appears in question (case-insensitive, word boundary)."""
    escaped = re.escape(leaked_word.lower())
    pattern = r'\b' + escaped + r'\b'
    return bool(re.search(pattern, question.lower()))


def load_deck(deck_id: str) -> dict:
    deck_path = DECKS_DIR / f'{deck_id}.json'
    with open(deck_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_deck(deck_id: str, deck: dict) -> None:
    deck_path = DECKS_DIR / f'{deck_id}.json'
    with open(deck_path, 'w', encoding='utf-8') as f:
        json.dump(deck, f, ensure_ascii=False, indent=2)
    print(f'  Saved {deck_id}.json')


def main():
    # Group manual rewrites by deck
    deck_rewrites: dict[str, list[tuple[str, str, str]]] = {}

    # We need to know which deck each factId belongs to
    # Load batches to get deckId mapping
    from pathlib import Path
    BATCHES_FILE = Path('/Users/damion/CODE/Recall_Rogue/data/self-answering-batches.json')
    with open(BATCHES_FILE) as f:
        batches = json.load(f)
    fact_deck_map: dict[str, str] = {}
    for batch in batches:
        for fact in batch:
            fact_deck_map[fact['factId']] = fact['deckId']

    # Group rewrites by deck
    for fact_id, (new_q, leaked_word) in MANUAL_REWRITES.items():
        deck_id = fact_deck_map.get(fact_id)
        if not deck_id:
            print(f'WARNING: No deck found for factId {fact_id}', file=sys.stderr)
            continue
        if deck_id not in deck_rewrites:
            deck_rewrites[deck_id] = []
        deck_rewrites[deck_id].append((fact_id, new_q, leaked_word))

    print(f'Applying {len(MANUAL_REWRITES)} manual rewrites across {len(deck_rewrites)} decks...')

    total_applied = 0
    total_verified = 0
    failed = []

    for deck_id in sorted(deck_rewrites.keys()):
        rewrites = deck_rewrites[deck_id]
        print(f'\n{deck_id} ({len(rewrites)} facts)')

        deck = load_deck(deck_id)
        fact_index = {f['id']: f for f in deck.get('facts', [])}

        for fact_id, new_q, leaked_word in rewrites:
            if fact_id not in fact_index:
                print(f'  NOT FOUND: {fact_id}')
                failed.append({'factId': fact_id, 'reason': 'not found in deck'})
                continue

            # Verify the rewrite actually removes the leaked word
            if contains_leaked_word(new_q, leaked_word):
                print(f'  FAIL (still leaks "{leaked_word}"): {fact_id}')
                print(f'    Q: {new_q[:100]}')
                failed.append({'factId': fact_id, 'reason': f'still leaks "{leaked_word}"', 'q': new_q})
                continue

            # Apply the rewrite
            fact_index[fact_id]['quizQuestion'] = new_q
            total_applied += 1
            total_verified += 1
            print(f'  OK: {fact_id}')

        save_deck(deck_id, deck)

    print(f'\n=== PASS 2 SUMMARY ===')
    print(f'Applied: {total_applied}')
    print(f'Failed: {len(failed)}')
    if failed:
        for f in failed:
            print(f'  {f}')

    return len(failed)


if __name__ == '__main__':
    result = main()
    sys.exit(0 if result == 0 else 1)
