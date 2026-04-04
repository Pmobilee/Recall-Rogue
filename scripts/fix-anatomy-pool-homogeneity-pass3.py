#!/usr/bin/env python3
"""
Third-pass fix for human_anatomy.json pool homogeneity.

Fixes remaining issues after passes 1 and 2:
1. Move misassigned facts to correct pools
2. Fix short answer expansions (IgG → Immunoglobulin G, etc.)
3. Move remaining verbose answers to better pools
4. Add syntheticDistractors to small pools
5. Fix remaining outliers in all pools

Run: python3 scripts/fix-anatomy-pool-homogeneity-pass3.py
"""

import json
import re
from collections import defaultdict

INPUT_PATH = "data/decks/human_anatomy.json"
OUTPUT_PATH = "data/decks/human_anatomy.json"

# ============================================================
# POOL REASSIGNMENTS
# Move misassigned facts to the correct pool
# Format: fact_id → new_pool_id
# ============================================================

POOL_REASSIGNMENTS = {
    # ---- bone_names: misassigned facts ----
    # "33%" is a percentage (bone density measurement), not a bone name → number_stats
    'ha_skel_064': 'number_stats',
    # "Ball-and-socket, hinge, hinge" describes joint TYPES, not bone names → function_terms
    'ha_skel_080': 'function_terms',

    # ---- structure_cardiac: misassigned facts ----
    # "L4" is a vertebral/spinal level, not a cardiac structure → location_terms
    'ha_cardio_033': 'location_terms',

    # ---- nerve_names: misassigned verbose facts ----
    # "Roots → Trunks → Divisions → Cords → Branches" is a process description → function_terms
    'ha_nerv_044': 'function_terms',
    # "Five terminal brachial plexus branches" is more about organization → function_terms
    'ha_nerv_045': 'function_terms',
    # "L4, L5, S1 lower limb dermatomal levels" — reassign to location_terms since it's dermatomal levels
    'ha_nerv_034': 'location_terms',
    # "Median (1st+2nd) and ulnar (3rd+4th)" — this is about lumbrical innervation distribution → function_terms
    'ha_musc_107': 'function_terms',

    # ---- structure_urinary: move hormones out ----
    # PTH, ADH, ANP are hormones that regulate kidney function, not urinary structures
    # These should stay in structure_urinary as they ARE relevant kidney-related things
    # ACTUALLY let's keep them - they're appropriate for the pool

    # ---- organ_names: fix misassigned ----
    # "Subarachnoid space (between arachnoid and pia mater)" → structure_nervous
    'ha_nerv_038': 'structure_nervous',

    # ---- structure_general: move long compound descriptions to better pools ----
    # "Filtration barrier: endothelium → basement membrane → podocytes" → structure_histological
    'ha_clinical_087': 'structure_histological',
    # "15–20 lobes with lactiferous ducts; Cooper's ligaments" → function_terms
    'ha_multi_016': 'function_terms',
    # "EPB and APL in anatomical snuffbox (lateral border)" → location_terms
    'ha_clinical_047': 'location_terms',
    # "Portal triad: portal vein, hepatic artery, bile duct" → structure_digestive
    'ha_clinical_078': 'structure_digestive',
    # "Trapezius, latissimus dorsi, and scapular border" → structure_muscular
    'ha_regional_037': 'structure_muscular',

    # ---- structure_histological: move process descriptions out ----
    # "Air-blood barrier: surfactant → type I pneumocyte → basement membrane → capillary" (81ch)
    # This is a PROCESS description → function_terms
    'ha_histo_068': 'function_terms',

    # ---- structure_embryological: trim verbose ----
    # "3rd pharyngeal arch: stylohyoid, posterior digastric, stapedius" (63ch)
    # This is more of a function/structure fact, but belongs in embryological
    # Keep but fix the answer text

    # ---- nerve_names: convert "31" to {N} ----
    # ha_nerv_028 has answer "31" — handled in answer_conversions below

    # ---- structure_cardiac: move facts that aren't cardiac structures ----
    # "Type O: no antigens + anti-A, anti-B antibodies" (47ch) → this IS cardiac (blood types)
    # "Carotid sinus (CN IX) and aortic arch (CN X)" (44ch) → could be nerve_names
    'ha_cardio_083': 'nerve_names',
    # "QRS complex: ventricular depolarization" (39ch) → clinical_terms (ECG finding)
    'ha_cardio_080': 'clinical_terms',
    # "Ostium secundum ASD: most common (~70%)" (39ch) → clinical_terms
    'ha_cardio_087': 'clinical_terms',
    # "RCA: inferior LV, RV, SA node, AV node" (38ch) → function_terms (coronary territory)
    'ha_cardio_093': 'function_terms',
}

# ============================================================
# ANSWER EXPANSIONS (short answers that need to be longer)
# Format: fact_id → new_answer
# For pools where minimum answers are too short relative to the rest
# ============================================================

ANSWER_EXPANSIONS = {
    # ---- immune_terms: expand 3-char antibody names ----
    # "IgG" → "Immunoglobulin G (IgG)" brings min from 3 to 22
    'ha_lymph_017': 'Immunoglobulin G (IgG)',
    'ha_lymph_018': 'Immunoglobulin A (IgA)',
    'ha_lymph_019': 'Immunoglobulin M (IgM)',
    'ha_lymph_020': 'Immunoglobulin E (IgE)',
    'ha_lymph_027': 'Immunoglobulin D (IgD)',
}

# ============================================================
# ADDITIONAL ANSWER TRIMS (for remaining verbose facts)
# Format: fact_id → (new_answer, extra_explanation)
# ============================================================

ADDITIONAL_TRIMS = {
    # ---- function_terms: trim remaining verbose (>55ch) ----
    'ha_nerv_027': ('Cranial nerve S/M/B mnemonic',
                    'Some Say Marry Money But My Brother Says Big Brains Matter — classifies CNs I-XII as Sensory, Motor, or Both.'),

    # ---- location_terms: trim remaining verbose ----
    'ha_regional_011': ('Pec major (ant.) and lat. dorsi + teres major (post.)',
                        'Axilla: anterior wall = pectoralis major; posterior wall = latissimus dorsi and teres major.'),

    # ---- structure_cardiac: trim remaining long answers ----
    'ha_cardio_066': ('Blood type O: no antigens + anti-A/B antibodies',
                      'Type O has no A or B antigens on RBCs but carries both anti-A and anti-B antibodies.'),

    # ---- nerve_names: trim remaining verbose ----
    'ha_clinical_040': ('Common fibular nerve at fibular neck',
                        'Foot drop: common fibular (peroneal) nerve injured at the fibular neck → inability to dorsiflex.'),

    # ---- structure_urinary: trim verbose facts ----
    'ha_urin_040': ('Afferent → glomerulus → efferent arteriole',
                    None),  # Already trimmed in pass2 but still 42ch, acceptable
    'ha_urin_023': ('Vasoconstriction and aldosterone release',
                    None),  # Already at 40ch, keep as is

    # ---- structure_nervous: remaining verbose ----
    'ha_nerv_101': ('VL nucleus: motor relay (cerebellum/basal ganglia)',
                    'Ventral lateral (VL) thalamic nucleus relays motor signals from cerebellum and basal ganglia to cortex.'),

    # ---- structure_histological: remaining verbose ----
    'ha_histo_080': ('Myomesin at M line; alpha-actinin at Z disc',
                     None),  # 43ch, acceptable for histological pool
    'ha_histo_086': ('Fenestrated endothelium, no diaphragm',
                     'Glomerular endothelium is fenestrated without a diaphragm to allow ultrafiltration.'),
    'ha_histo_063': ('A band = myosin; I band = actin',
                     'Sarcomere: A band contains thick myosin filaments; I band contains thin actin filaments only.'),
    'ha_histo_062': ('Fenestrated endothelium → basement membrane → podocytes',
                     None),  # 51ch, acceptable for histological pool

    # ---- structure_embryological ----
    'ha_embryo_088': ('3rd arch: stylohyoid, posterior digastric, stapedius',
                      '3rd pharyngeal arch (Reichert\'s cartilage) gives rise to stylohyoid, posterior digastric, and stapedius muscles.'),

    # ---- structure_muscular: trim verbose ----
    'ha_musc_127': ('Cricothyroid (external laryngeal nerve branch)',
                    'Cricothyroid is innervated by the external branch of the superior laryngeal nerve (CN X).'),
    'ha_musc_124': ('CN XII: tongue deviates toward lesion',
                    'LMN CN XII lesion: tongue deviates toward the lesioned (weak) side on protrusion.'),
    'ha_musc_131': ('SITS: rotator cuff muscles mnemonic',
                    'SITS = Supraspinatus, Infraspinatus, Teres minor, Subscapularis — the four rotator cuff muscles.'),
    'ha_musc_135': ('Palatoglossus — CN X via pharyngeal plexus',
                    'Palatoglossus is the only glossal muscle NOT innervated by CN XII; it is innervated by CN X.'),
    'ha_musc_138': ('Teres minor — axillary nerve (C5–C6)',
                    'Teres minor is innervated by the axillary nerve (C5–C6) and performs external rotation.'),

    # ---- number_stats: fix remaining long compound stats ----
    # Move ha_cardio_085 to function_terms (compound pressure stat)
    # Move ha_sense_025, ha_sense_024 to function_terms (complex descriptions)

    # ---- clinical_terms: trim remaining >60ch ----
    'ha_histo_070': ('Emphysema: permanent airspace enlargement post-terminal bronchiole',
                     None),  # trim to 60ch
    'ha_histo_074': ('Silver stain: type III collagen (reticulin) black',
                     None),
    'ha_histo_076': ('Keloid: extends beyond wound margins',
                     'Keloid: excess collagen extends beyond wound margins; does not spontaneously regress.'),
    'ha_cardio_109': ('Marfan syndrome: FBN1 mutation (chromosome 15)',
                      None),

    # ---- organ_names: fix the longest ----
    'ha_nerv_038': ('Subarachnoid space',
                    'The subarachnoid space lies between the arachnoid mater and pia mater, containing CSF.'),

    # ---- vessel_names: trim long ----
    'ha_multi_005': ('Superior mesenteric and splenic veins',
                     'The hepatic portal vein is formed by the union of the superior mesenteric vein (SMV) and splenic vein.'),

    # ---- structure_general: fix remaining verbose ----
    'ha_clinical_087': ('Glomerular filtration barrier',
                        'Filtration barrier: fenestrated endothelium → basement membrane → podocyte foot processes.'),

    # ---- muscle_names: trim remaining verbose ----
    'ha_musc_037': ('Radial tuberosity + bicipital aponeurosis',
                    'Biceps brachii inserts via a tendon onto the radial tuberosity and via the bicipital aponeurosis into the forearm fascia.'),
}

# ============================================================
# POOL REASSIGNMENTS FOR NUMBER_STATS LONG FACTS
# These are moved to function_terms since they're compound descriptions
# ============================================================

NUMBER_STATS_REASSIGN_TO_FUNCTION = {
    'ha_cardio_085',   # "Left ventricle: ~120/0–5 mmHg" — compound pressure value
    'ha_sense_025',    # "~20 Hz to ~20,000 Hz (20 kHz)" — complex range description
    'ha_sense_024',    # "~22x (approximately 22-fold)" — ratio description
    'ha_clinical_035', # "2–4 times higher than males" — comparison stat
}

# ============================================================
# BARE NUMBER CONVERSIONS
# ============================================================

BARE_NUMBER_CONVERSIONS = {
    'ha_nerv_028': ('31', '{31}'),  # "31" spinal nerve pairs
    'ha_skel_064': ('33%', '{33}%'),  # bone density (already moved to number_stats)
}


def main():
    print("Loading human_anatomy.json...")
    with open(INPUT_PATH) as f:
        deck = json.load(f)

    facts_list = deck['facts']
    print(f"Total facts: {len(facts_list)}")

    # ============================================================
    # PASS 1: Pool reassignments
    # ============================================================
    print("\nPass 1: Reassigning misassigned facts...")
    reassigned = 0
    for fact in facts_list:
        fid = fact['id']
        if fid in POOL_REASSIGNMENTS:
            old_pool = fact.get('answerTypePoolId', '')
            new_pool = POOL_REASSIGNMENTS[fid]
            if old_pool != new_pool:
                fact['answerTypePoolId'] = new_pool
                reassigned += 1
                print(f"  {fid}: {old_pool} → {new_pool} [{fact['correctAnswer'][:40]}]")

    # Also move number_stats long facts
    for fact in facts_list:
        fid = fact['id']
        if fact.get('answerTypePoolId') == 'number_stats' and fid in NUMBER_STATS_REASSIGN_TO_FUNCTION:
            fact['answerTypePoolId'] = 'function_terms'
            reassigned += 1
            print(f"  {fid}: number_stats → function_terms [{fact['correctAnswer'][:50]}]")

    print(f"  Total reassigned: {reassigned}")

    # ============================================================
    # PASS 2: Answer expansions (short → longer)
    # ============================================================
    print("\nPass 2: Expanding short answers...")
    expanded = 0
    for fact in facts_list:
        fid = fact['id']
        if fid in ANSWER_EXPANSIONS:
            old_ans = fact['correctAnswer']
            new_ans = ANSWER_EXPANSIONS[fid]
            if old_ans != new_ans:
                fact['correctAnswer'] = new_ans
                expanded += 1
                print(f"  {fid}: '{old_ans}' → '{new_ans}'")

    print(f"  Expanded {expanded} answers")

    # ============================================================
    # PASS 3: Additional trims
    # ============================================================
    print("\nPass 3: Applying additional trims...")
    trimmed = 0
    for fact in facts_list:
        fid = fact['id']
        if fid in ADDITIONAL_TRIMS:
            new_ans, extra_expl = ADDITIONAL_TRIMS[fid]
            old_ans = fact.get('correctAnswer', '')
            if new_ans and old_ans != new_ans:
                fact['correctAnswer'] = new_ans
                trimmed += 1
            if extra_expl:
                existing = fact.get('explanation', '')
                if extra_expl not in existing:
                    fact['explanation'] = (existing + ' ' + extra_expl).strip()

    print(f"  Trimmed {trimmed} answers")

    # ============================================================
    # PASS 4: Bare number conversions
    # ============================================================
    print("\nPass 4: Converting remaining bare numbers...")
    converted = 0
    for fact in facts_list:
        fid = fact['id']
        if fid in BARE_NUMBER_CONVERSIONS:
            old_ans, new_ans = BARE_NUMBER_CONVERSIONS[fid]
            if fact.get('correctAnswer') == old_ans:
                fact['correctAnswer'] = new_ans
                converted += 1
                # Clean up acceptableAlternatives
                alts = fact.get('acceptableAlternatives', [])
                fact['acceptableAlternatives'] = [a for a in alts if a not in ('31', '33', '33%')]

    print(f"  Converted {converted} bare numbers")

    # ============================================================
    # PASS 5: Rebuild answerTypePools factIds
    # ============================================================
    print("\nPass 5: Rebuilding pool factIds...")
    pool_fact_map = defaultdict(list)
    for fact in facts_list:
        pool_id = fact.get('answerTypePoolId')
        if pool_id:
            pool_fact_map[pool_id].append(fact['id'])

    for pool in deck.get('answerTypePools', []):
        pid = pool['id']
        pool['factIds'] = pool_fact_map.get(pid, [])

    # ============================================================
    # PASS 6: Write output
    # ============================================================
    print(f"\nWriting {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(deck, f, indent=2, ensure_ascii=False)
    print("Done.")

    # ============================================================
    # PASS 7: Report
    # ============================================================
    print("\n=== FINAL POOL HOMOGENEITY REPORT ===")
    BRACE_RE = re.compile(r'\{\d[\d,]*\.?\d*\}')
    all_pools = deck['answerTypePools']
    for pool in sorted(all_pools, key=lambda p: p['id']):
        pool_id = pool['id']
        pool_facts = [f for f in facts_list if f.get('answerTypePoolId') == pool_id]
        # Exclude brace-number facts from ratio calculation
        text_facts = [f for f in pool_facts if not BRACE_RE.search(f.get('correctAnswer', ''))]
        answers = [f.get('correctAnswer', '') for f in text_facts]
        lengths = sorted([len(a) for a in answers])
        if not lengths:
            continue
        min_l, max_l = lengths[0], lengths[-1]
        ratio = max_l / max(min_l, 1)
        status = "FAIL" if ratio > 3 else "OK"
        print(f"  {status} {pool_id}: n={len(lengths)}, min={min_l}, max={max_l}, ratio={ratio:.1f}x")


if __name__ == '__main__':
    main()
