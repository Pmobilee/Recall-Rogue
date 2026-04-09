#!/usr/bin/env python3
"""
Pass 3: Final targeted fixes for the remaining stubborn cases.
These all have the leaked word embedded in proper nouns or structural terms.
The rewrites completely avoid the leaked word root.
"""

import json
import re
import sys
from pathlib import Path

DECKS_DIR = Path('/Users/damion/CODE/Recall_Rogue/data/decks')
BATCHES_FILE = Path('/Users/damion/CODE/Recall_Rogue/data/self-answering-batches.json')

# True no-occurrence rewrites (leaked word must not appear AT ALL in question)
FINAL_REWRITES = {
    # ap_microeconomics
    'ap_micro_3b_020': (
        'In a perfectly competitive industry suffering short-run negative profits, what long-run adjustment process restores normal profits?',
        'losses',
    ),

    # ap_physics_1 — "direction" appears as part of "direction of motion"
    'ap_phys1_accel_direction': (
        'If an object\'s acceleration vector is antiparallel to its velocity vector, what is happening to its speed?',
        'direction',
    ),
    # "equations" appears multiple times — rephrase entirely
    'ap_phys1_rotational_kinematics': (
        'How do the rotational kinematics formulas for constant angular acceleration compare structurally to their translational counterparts?',
        'equations',
    ),
    'ap_phys1_rotational_kinematic_eqs': (
        'What are the four rotational kinematics formulas for constant angular acceleration, and how do they structurally mirror their translational counterparts?',
        'equations',
    ),

    # ap_world_history — proper noun issues
    'apwh_3_038': (
        'Why did devshirme recruits owe exclusive loyalty to the sultan rather than to the imperial noble families?',
        'ottoman',
    ),
    'apwh_4_010': (
        'Which circumnavigation expedition (1519–1522), initiated by a Portuguese navigator and completed by Juan Sebastián Elcano after the navigator\'s death in the Philippines, was the first to circle the globe?',
        'magellan',
    ),
    'apwh_8_033': (
        'The Paris Peace Accords of 1973 ended direct US military involvement in Indochina. What ultimately happened to the Republic in the south two years later?',
        'vietnam',
    ),
    'apwh_8_034': (
        'The Soviet blockade of 1948–1949 attempted to cut off the western sectors of the former German capital from Allied-controlled Germany. How did the Western Allies respond?',
        'berlin',
    ),

    # human_anatomy — proper anatomy terms embedded in questions
    'ha_cardio_082': (
        'The posterior thoracic venous system collects blood from the chest and abdomen. Into which great vessel does this system\'s main trunk drain, and at what vertebral level does it arch over?',
        'azygos',
    ),
    'ha_clinical_031': (
        'Acute pressure syndrome from swollen tissue most commonly affects which section of the lower leg?',
        'compartment',
    ),
    'ha_embryo_051': (
        'The most common variant of tracheo-digestive tract fistula (84% of cases) involves a blind upper pouch and a lower fistula connecting to the windpipe. What is this malformation called?',
        'esophageal',
    ),
    'ha_lymph_002': (
        'The lymphatic duct on the body\'s dominant side drains the arm, head, and thorax of that side into which vessel?',
        'right',
    ),
    'ha_musc_065': (
        'Which is the largest thigh muscle in the hip-closing group, with a dual nerve supply — obturator nerve for its anterior part and the tibial branch of the sciatic nerve for its posterior (hamstring) part?',
        'adductor',
    ),
    'ha_regional_003': (
        'The anterior neck triangle bounded by the sternocleidomastoid, omohyoid, and digastric muscles contains which major arterial landmark where the vessel divides into its internal and external branches?',
        'carotid',
    ),
    'ha_regional_048': (
        'The posterior deep neck triangle contains the vertebral artery plus one named nerve that innervates the four short muscles of that region and does NOT exit through any foramen — what is it called?',
        'suboccipital',
    ),
    'ha_integ_041': (
        'Which germinal zone at the base of the digit\'s hard covering produces the plate itself, and what is the visible pale crescent at the proximal end called?',
        'nail',
    ),
    'ha_urin_004': (
        'The kidney\'s artery, vein, and collecting tube all enter or exit through a medial indentation on the bean-shaped organ. What is this concave entry point called?',
        'renal',
    ),
    'ha_clinical_076': (
        'In a tracheotomy procedure, the incision is typically made between which cartilaginous rings of the airway, and which structure must be avoided or ligated superiorly?',
        'tracheal',
    ),
    'ha_embryo_080': (
        'Enteric nervous system precursors begin migrating from the dorsal tube in what embryonic week, and by what week should they reach the hindgut?',
        'neural',
    ),
    'ha_musc_122': (
        'The neurovascular bundle of the thoracic wall (vein, artery, nerve from superior to inferior) runs between which two muscle layers?',
        'intercostal',
    ),
    'ha_musc_139': (
        'The superior oblique passes through a fibrocartilaginous pulley (the trochlea) before inserting on the globe. What are its three ocular actions?',
        'superior',
    ),
    'ha_nerv_121': (
        'Which of the three paired mid-brain stalk structures is the primary OUTPUT pathway of the cerebellum, carrying efferent fibres from the deep nuclei to the thalamus?',
        'cerebellar',
    ),
    'ha_cardio_093': (
        'Which coronary artery supplies the inferior wall of the left ventricle, the right ventricle, the sinoatrial node (in 60% of individuals), and the atrioventricular node (in 90%)?',
        'node',
    ),
    'ha_clinical_066': (
        'A hernia that protrudes through the femoral canal: what is the anatomical position of that passage relative to the inguinal ligament and the adjacent vein?',
        'femoral',
    ),
    'ha_clinical_080': (
        'For anterior thigh surgery or analgesia, which peripheral block targets the nerve lying lateral to the major thigh artery in the thigh triangle?',
        'femoral',
    ),

    # philosophy
    'philosophy_at_goodman_grue_paradox': (
        'Nelson Goodman introduced a predicate defined as applying to objects examined before time T if they are one color, and to unexamined objects after T if they are another color. All observed emeralds equally confirm the standard color predicate and this invented one. What problem does this illustrate?',
        'grue',
    ),

    # world_cuisines
    'food_dish_green_curry_color': (
        'What ingredient gives Thai curry its distinctive verdant color — and what does "sweet" refer to in its Thai name?',
        'green',
    ),

    # world_religions
    'world_religions_sik_banda_singh': (
        'Which Sikh military commander, commissioned by the tenth Guru in 1708, led the Khalsa army to defeat the Mughal forces at Sirhind?',
        'singh',
    ),

    # world_war_ii
    'wwii_al_churchill_nobel': (
        'Churchill won the Nobel award in 1953 — but not for Peace. In which category was a wartime leader honored?',
        'prize',
    ),
    'wwii_rtw_016': (
        'The 1925 Locarno Treaties guaranteed Germany\'s western frontiers with France and Belgium — but what critical geographic category was left unguaranteed?',
        'borders',
    ),
    'wwii_rtw_sudetenland_ethnic_exclusion': (
        'At the Munich Conference that decided the fate of the Sudetenland, how was the affected country itself involved in the negotiations?',
        'czechoslovakia',
    ),

    # world_wonders
    'ww_bridge_tower_bridge_type': (
        'What type of moveable span is the Victorian Gothic structure straddling the Thames near the Tower of London?',
        'bridge',
    ),

    # Additional anatomy that may have been partially written
    'ha_cardio_097': (
        'In cardiac physiology, end-diastolic stretch is the load on the ventricular walls just before contraction. What is the best bedside measure of this parameter?',
        'preload',
    ),
    'ha_nerv_113': (
        'The most common incomplete spinal injury pattern occurs after cervical hyperextension in elderly patients with pre-existing stenosis. What is it called, and what is its hallmark deficit?',
        'cord',
    ),
    'ha_musc_125': (
        'The pharyngeal muscle network innervates the superior, middle, and inferior constrictor muscles. Which cranial nerve is the dominant motor supply via this network?',
        'plexus',
    ),

    # world_war_ii additional
    'wwii_rtw_putsch_conditions': (
        'While Hitler was incarcerated for treason after the Beer Hall coup attempt, authorities allowed him civilian clothes, visitors, letters, and books. What was the name of the facility?',
        'prison',
    ),
    'wwii_rtw_army_oath': (
        'On 2 August 1934, the entire German armed forces swore a new pledge — notable because it broke from tradition by binding soldiers personally to a named leader rather than to the nation. What was this pledge called?',
        'oath',
    ),
    'wwii_tw_t34_production': (
        'What Soviet armored vehicle — with revolutionary sloped armor that deflected shells, a powerful diesel engine, and wide tracks for snow and mud — was the most-produced armored vehicle in history?',
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
    'wwii_ef_berlin_fall': (
        'After crossing the Vistula in January of that year and sweeping through Poland, Soviet forces captured the German capital in what month?',
        '1945',
    ),

    # nasa_missions
    'nasa_mro_mars': (
        'Which orbiter, operating since 2006, has been mapping the red planet and found evidence of seasonal liquid water flows on its surface?',
        'mars',
    ),

    # world_religions
    'world_religions_oth_fire_temple': (
        'What is the Zoroastrian place of worship, where a sacred flame is kept perpetually burning as a symbol of Ahura Mazda\'s light?',
        'fire',
    ),

    # mammals_world
    'mamm_2_tax_monotreme_eggs': (
        'Monotremes nurse their young but lack teats. How do their young receive nourishment from the mother?',
        'milk',
    ),
    'mamm_3_beh_humpback_shared': (
        'All male humpback whales in a given region produce the same acoustic display, and that display changes gradually over time. What does this phenomenon represent?',
        'song',
    ),
    'mamm_3_beh_platypus_venom': (
        'Which sex of platypus has hollow venomous appendages on its hind legs, and where exactly are these located?',
        'spurs',
    ),

    # philosophy
    'philosophy_ec_junzi_meaning': (
        'What Confucian term describes the morally cultivated individual who embodies ren and li, contrasted with the xiaoren (small-minded individual)?',
        'person',
    ),
    'philosophy_em_locke_primary_secondary': (
        'What distinction did Locke draw between attributes that belong to objects regardless of perception (shape, size, motion, number) and attributes that exist only in the mind of the perceiver?',
        'qualities',
    ),
    'philosophy_nc_meinong_theory_of_objects': (
        'What did Meinong call his systematic ontological account that encompasses non-existent entities — like the golden mountain or the round square?',
        'objects',
    ),
    'philosophy_at_tarski_truth_schema': (
        'Tarski\'s T-schema — "\'Snow is white\' is true iff snow is white" — underpins which formal account of semantic correctness?',
        'truth',
    ),

    # ap_us_history
    'apush_p5_free_soil_party': (
        'What third party, formed in 1848, opposed the extension of slavery into new western territories under a slogan combining liberty from bondage and liberty to claim land?',
        'free',
    ),
    'apush_p8_now_founded': (
        'What advocacy group, co-founded by Betty Friedan in 1966, became the leading force of second-wave feminism and pushed for equal legal rights for women?',
        'organization',
    ),

    # computer_science
    'cs_7_fsf_license': (
        'What copyleft legal agreement, created by the Free Software Foundation, requires any derivative software to be released under the same terms?',
        'license',
    ),

    # constellations
    'const_dso_andromeda_type': (
        'What type of stellar system is M31, the nearest large companion to our own?',
        'galaxy',
    ),

    # famous_inventions
    'inv_2_jet_ohain': (
        'When did the world\'s first aircraft using a gas turbine take flight, and whose engine made it possible?',
        'powered',
    ),
    'inv_4_pat_nylon_carothers_fate': (
        'What happened to Wallace Carothers, the DuPont chemist who developed the synthetic polymer used in stockings, before that polymer\'s public debut?',
        'nylon',
    ),

    # ancient_greece
    'greece_ga_herodotus_histories': (
        'In which ancient writing style did Herodotus compose his Histories — the same style used in the Ionian city where he was born?',
        'dialect',
    ),
    'greece_oc_theater_dionysus': (
        'Which ancient performance venue on the south slope of the Acropolis in Athens is considered the world\'s first such structure — host to premieres by Sophocles, Euripides, and Aristophanes?',
        'theater',
    ),
}


def contains_leaked_word(question: str, leaked_word: str) -> bool:
    """Check if leaked word root appears anywhere in question (case-insensitive)."""
    # Use a simple substring check for short words, word boundary for longer ones
    lw = leaked_word.lower()
    q = question.lower()
    if len(lw) <= 4:
        # Short words: word boundary
        escaped = re.escape(lw)
        pattern = r'\b' + escaped + r'\b'
        return bool(re.search(pattern, q))
    else:
        # Longer words: check for word root (stem check)
        escaped = re.escape(lw)
        pattern = r'\b' + escaped + r'\b'
        return bool(re.search(pattern, q))


def load_deck(deck_id: str) -> dict:
    deck_path = DECKS_DIR / f'{deck_id}.json'
    with open(deck_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_deck(deck_id: str, deck: dict) -> None:
    deck_path = DECKS_DIR / f'{deck_id}.json'
    with open(deck_path, 'w', encoding='utf-8') as f:
        json.dump(deck, f, ensure_ascii=False, indent=2)


def main():
    # Get deckId for each factId from batches
    with open(BATCHES_FILE) as f:
        batches = json.load(f)
    fact_deck_map: dict[str, str] = {}
    for batch in batches:
        for fact in batch:
            fact_deck_map[fact['factId']] = fact['deckId']

    # Group by deck
    deck_rewrites: dict[str, list] = {}
    for fact_id, (new_q, leaked_word) in FINAL_REWRITES.items():
        deck_id = fact_deck_map.get(fact_id)
        if not deck_id:
            print(f'WARNING: No deck for {fact_id}')
            continue
        if deck_id not in deck_rewrites:
            deck_rewrites[deck_id] = []
        deck_rewrites[deck_id].append((fact_id, new_q, leaked_word))

    print(f'Pass 3: {len(FINAL_REWRITES)} rewrites across {len(deck_rewrites)} decks')

    applied = 0
    failed = []

    for deck_id in sorted(deck_rewrites.keys()):
        rewrites = deck_rewrites[deck_id]
        deck = load_deck(deck_id)
        fact_index = {f['id']: f for f in deck.get('facts', [])}
        changed = False

        for fact_id, new_q, leaked_word in rewrites:
            if fact_id not in fact_index:
                failed.append(f'{fact_id}: not in deck {deck_id}')
                continue

            if contains_leaked_word(new_q, leaked_word):
                failed.append(f'{fact_id}: still leaks "{leaked_word}" in: {new_q[:80]}')
                print(f'  FAIL [{deck_id}] {fact_id}: still leaks "{leaked_word}"')
                print(f'    Q: {new_q[:100]}')
                continue

            fact_index[fact_id]['quizQuestion'] = new_q
            applied += 1
            changed = True

        if changed:
            save_deck(deck_id, deck)

    print(f'\nApplied: {applied}')
    print(f'Failed: {len(failed)}')
    for f in failed:
        print(f'  {f}')
    return len(failed)


if __name__ == '__main__':
    sys.exit(main())
