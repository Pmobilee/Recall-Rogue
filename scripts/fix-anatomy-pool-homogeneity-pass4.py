#!/usr/bin/env python3
"""
Pass 4: Fix remaining pool homogeneity issues in human_anatomy.json.

Key changes:
1. Move ha_visual_303-356 from function_terms to appropriate structure sub-pools
2. Move vertebral landmark facts (T9, T2-T3, T4-T5) from nerve_names to location_terms
3. Trim longest function_terms entries (>50ch) to reduce 13.5x ratio
4. Trim longest location_terms entries (>50ch) to reduce 31.5x ratio
5. Move ha_musc_133, ha_musc_134 compound entries from structure_muscular to function_terms
   (they contain function descriptions, not pure muscle names)
6. Trim structure_muscular compound entries
"""

import json, copy, sys

INPUT = "data/decks/human_anatomy.json"
OUTPUT = "data/decks/human_anatomy.json"

with open(INPUT) as f:
    deck = json.load(f)

facts_by_id = {fact["id"]: fact for fact in deck["facts"]}
pool_by_id = {p["id"]: p for p in deck["answerTypePools"]}

changes = []

# ─────────────────────────────────────────────────────────────────────────────
# 1. MOVE ha_visual_303-356 from function_terms to correct structure sub-pools
# ─────────────────────────────────────────────────────────────────────────────
VISUAL_POOL_MOVES = {
    # Respiratory
    "ha_visual_303": "structure_respiratory",   # Lungs (gross anatomy)
    "ha_visual_304": "structure_respiratory",   # Pleura
    # Endocrine
    "ha_visual_305": "structure_endocrine",     # Adrenal glands
    "ha_visual_306": "structure_endocrine",     # Thyroid gland
    # Nervous
    "ha_visual_307": "structure_nervous",       # Optic pathways
    "ha_visual_308": "structure_nervous",       # Retina layers
    # Muscular
    "ha_visual_309": "structure_muscular",      # Anterior neck muscles
    "ha_visual_310": "structure_muscular",      # Extraocular muscles
    "ha_visual_311": "structure_muscular",      # Facial muscles
    "ha_visual_312": "structure_muscular",      # Foot muscles
    "ha_visual_313": "structure_muscular",      # Forearm muscles
    "ha_visual_314": "structure_muscular",      # Gluteal muscles
    "ha_visual_315": "structure_muscular",      # Intrinsic hand muscles
    "ha_visual_316": "structure_muscular",      # Jaw muscles
    "ha_visual_317": "structure_muscular",      # Leg compartments
    "ha_visual_318": "structure_muscular",      # Motor end plate
    "ha_visual_319": "structure_muscular",      # Muscle fiber structure
    "ha_visual_320": "structure_muscular",      # Neck and back muscles
    "ha_visual_321": "structure_muscular",      # Pectoral girdle muscles
    "ha_visual_322": "structure_muscular",      # Posterior neck muscles
    "ha_visual_323": "structure_muscular",      # Sarcomere
    # Skeletal
    "ha_visual_324": "structure_skeletal",      # Appendicular skeleton
    "ha_visual_325": "structure_skeletal",      # Bone blood supply
    "ha_visual_326": "structure_skeletal",      # Bone cells
    "ha_visual_327": "structure_skeletal",      # Bone surface markings
    "ha_visual_328": "structure_skeletal",      # Carpal tunnel
    "ha_visual_329": "structure_skeletal",      # Cervical vertebrae
    "ha_visual_330": "structure_skeletal",      # Compact bone
    "ha_visual_331": "structure_skeletal",      # Femur and patella
    "ha_visual_332": "structure_skeletal",      # Flat bone
    "ha_visual_333": "structure_skeletal",      # Foot bones
    "ha_visual_334": "structure_skeletal",      # Hand and wrist bones
    "ha_visual_335": "structure_skeletal",      # Hip bone
    "ha_visual_336": "structure_skeletal",      # Humerus and elbow joint
    "ha_visual_337": "structure_skeletal",      # Intervertebral disc
    "ha_visual_338": "structure_skeletal",      # Long bone
    "ha_visual_339": "structure_skeletal",      # Lumbar vertebra
    "ha_visual_340": "structure_skeletal",      # Male vs female pelvis
    "ha_visual_341": "structure_skeletal",      # Pectoral girdle
    "ha_visual_342": "structure_skeletal",      # Pelvis
    "ha_visual_343": "structure_skeletal",      # Periosteum and endosteum
    "ha_visual_344": "structure_skeletal",      # Rib cage
    "ha_visual_345": "structure_skeletal",      # Sacrum and coccyx
    "ha_visual_346": "structure_skeletal",      # Scapula
    "ha_visual_347": "structure_skeletal",      # Spongy bone
    "ha_visual_348": "structure_skeletal",      # Synovial joint
    "ha_visual_349": "structure_skeletal",      # Synovial joint types
    "ha_visual_350": "structure_skeletal",      # Thoracic vertebra
    "ha_visual_351": "structure_skeletal",      # Tibia and fibula
    "ha_visual_352": "structure_skeletal",      # Ulna and radius
    "ha_visual_353": "structure_skeletal",      # Typical vertebra
    "ha_visual_354": "structure_skeletal",      # Vertebral column
    "ha_visual_355": "structure_skeletal",      # Osteoclast
    "ha_visual_356": "structure_skeletal",      # Osteocyte
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. MOVE vertebral landmark facts from nerve_names to location_terms
#    T9, T2-T3, T4-T5 are spinal level landmarks, not nerve names
# ─────────────────────────────────────────────────────────────────────────────
NERVE_TO_LOCATION_MOVES = {
    "ha_clinical_003": "location_terms",   # T9 (xiphoid level)
    "ha_clinical_001": "location_terms",   # T2–T3 (jugular notch)
    "ha_clinical_002": "location_terms",   # T4–T5 (sternal angle)
}

# Combine all pool moves
ALL_POOL_MOVES = {**VISUAL_POOL_MOVES, **NERVE_TO_LOCATION_MOVES}

# ─────────────────────────────────────────────────────────────────────────────
# 3. ANSWER TRIMS - function_terms long entries (>50ch)
# ─────────────────────────────────────────────────────────────────────────────
FUNCTION_TERM_TRIMS = {
    # (new_answer, extra_explanation_prefix)
    "ha_histo_068": ("Air-blood barrier: 5 layers from alveolus to capillary",
                     "Full sequence: surfactant → type I pneumocyte → basement membrane → capillary endothelium. "),
    "ha_resp_044": ("Reduces surface tension, prevents alveolar collapse",
                    "Surfactant is mainly dipalmitoylphosphatidylcholine (DPPC). "),
    "ha_embryo_090": ("Turner syndrome: lymphedema, neck webbing, cardiac defects",
                      "Turner syndrome (45,X) features include lymphedema at birth, webbed neck, and cardiac anomalies. "),
    "ha_cardio_076": ("RV: ~25/0–5 mmHg; Pulmonary artery: ~25/10 mmHg",
                      "Normal right heart pressures: right ventricle ~25/0–5 mmHg, pulmonary artery ~25/10 mmHg. "),
    "ha_nerv_090": ("CSF: choroid plexus → ventricles → foramina → cisterns",
                    "Full path: choroid plexus → lateral ventricles → foramen of Monro → 3rd ventricle → cerebral aqueduct → 4th ventricle → foramina → subarachnoid space. "),
    "ha_endo_041": ("Stimulates glycogenolysis and gluconeogenesis in liver",
                    "Glucagon (from alpha cells) acts on the liver to break down glycogen and synthesize new glucose. "),
    "ha_nerv_042": ("Sympathetic: pupil dilation; parasympathetic: constriction",
                    "Sympathetic stimulation causes mydriasis via dilator pupillae; parasympathetic causes miosis via sphincter pupillae. "),
    "ha_embryo_074": ("Hirschsprung: absent ganglia from failed neural crest migration",
                      "Hirschsprung disease is caused by failure of neural crest cells to migrate to the distal hindgut. "),
    "ha_embryo_089": ("Oligohydramnios → pulmonary hypoplasia + limb contractures",
                      "Oligohydramnios reduces amniotic fluid, limiting fetal breathing movements and causing lung underdevelopment. "),
    "ha_digest_058": ("McBurney's point: 1/3 from right ASIS to umbilicus",
                      "McBurney's point lies approximately 1/3 of the distance from the right ASIS to the umbilicus. "),
    "ha_endo_028": ("PTH: stimulates osteoclasts, raises renal Ca²⁺ reabsorption",
                    "PTH raises blood Ca²⁺ via osteoclast activation, renal Ca²⁺ reabsorption, and calcitriol production. "),
    "ha_multi_014": ("Gas exchange, nutrient/waste transfer, hormone production",
                     None),  # Already 57ch but important terms - leave as is, just below 60ch
    "ha_musc_121": ("External intercostals elevate ribs during forced inspiration",
                    None),  # 57ch is acceptable
    "ha_endo_023": ("Increase metabolic rate, heat production, support growth",
                    None),  # 56ch is acceptable
    "ha_endo_033": ("Raises glucose, suppresses inflammation, stress response",
                    None),  # 56ch is acceptable
    "ha_nerv_053": ("Sympathetic dilates bronchi; parasympathetic constricts them",
                    None),  # Slightly over, already descriptive
    "ha_nerv_054": ("Sympathetic relaxes detrusor; parasympathetic contracts it",
                    "The detrusor muscle (bladder wall) is controlled by the autonomic system. "),
    "ha_endo_040": ("Promotes glucose uptake, glycogenesis, and lipogenesis",
                    None),  # 54ch acceptable
    "ha_endo_046": ("Promotes T lymphocyte maturation for adaptive immunity",
                    None),  # 54ch acceptable
    "ha_multi_016": ("15–20 lobes with lactiferous ducts and Cooper's ligaments",
                     "Each breast contains 15–20 glandular lobes with lactiferous ducts draining to the nipple. "),
    "ha_nerv_043": ("Sympathetic increases HR; parasympathetic decreases HR",
                    None),  # 54ch acceptable
    "ha_nerv_094": ("CSF drains: arachnoid granulations → dural sinuses → jugular veins",
                    "CSF reabsorbed through arachnoid granulations (villi) protruding into dural venous sinuses. "),
    "ha_resp_043": ("70% bicarbonate, 23% carbaminohemoglobin, 7% dissolved CO₂",
                    "Carbon dioxide is transported in three forms: primarily as bicarbonate (via carbonic anhydrase in RBCs). "),
    "ha_sense_014": ("Tonotopy: base = high frequency, apex = low frequency",
                     "Tonotopy is the spatial organization of sound frequency along the cochlea. "),
    "ha_embryo_080": ("Neural crest to gut: week 4 start, hindgut by week 7",
                      "Vagal neural crest cells begin migrating to colonize the gut from week 4 of development. "),
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. ANSWER TRIMS - location_terms longest entries (>45ch)
# ─────────────────────────────────────────────────────────────────────────────
LOCATION_TERM_TRIMS = {
    "ha_regional_020": ("Biceps femoris (lat.) and semimemb./semitendin. (med.)",
                        "The popliteal fossa: lateral border = biceps femoris, medial = semimembranosus and semitendinosus. "),
    "ha_regional_011": ("Pec major (ant.); lat. dorsi + teres major (post.)",
                        "The axilla walls: anterior = pectoralis major; posterior = latissimus dorsi and teres major. "),
    "ha_clinical_047": ("EPB and APL in anatomical snuffbox (lateral border)",
                        None),  # 51ch, trim to 48 is tight; leave at 51ch
    "ha_histo_084": ("Centrilobular emphysema (proximal); panacinar (full acinus)",
                     "Emphysema distribution: centrilobular affects the respiratory bronchioles, panacinar the entire acinus. "),
    "ha_clinical_025": ("Supraspinatus: from supraspinous fossa to greater tubercle",
                        "Supraspinatus (SITS) runs from the supraspinous fossa to insert on the greater tubercle of the humerus. "),
    "ha_regional_013": ("Brachioradialis (lat.) and pronator teres (med.)",
                        "The cubital fossa medial and lateral borders are defined by these muscles. "),
    "ha_clinical_066": ("Below inguinal ligament, medial to femoral vein",
                        "The femoral triangle: femoral canal is medial to the femoral vein, below the inguinal ligament. "),
    "ha_clinical_072": ("2–3 cm inferior to the midpoint of the clavicle",
                        "Subclavian vein access: insert needle 2–3 cm below the midclavicular point. "),
    "ha_regional_015": ("EPL (medial); EPB + APL (lateral snuffbox borders)",
                        "Anatomical snuffbox: medial = extensor pollicis longus; lateral = EPB + APL. "),
    "ha_clinical_070": ("4th–5th ICS, mid-axillary line (safe triangle)",
                        "Chest drain insertion is in the 'safe triangle': 4th–5th ICS, mid-axillary line. "),
    "ha_histo_061": ("Zone 3 most susceptible; zone 1 most resistant to ischaemia",
                     "Hepatic acinar zones: zone 3 (centrilobular) is most vulnerable to ischaemia; zone 1 (periportal) is most resistant. "),
    "ha_regional_017": ("Inguinal ligament (sup.), sartorius (lat.), adductor longus (med.)",
                        "The femoral triangle borders: superior = inguinal ligament, lateral = sartorius, medial = adductor longus. "),
    "ha_clinical_009": ("1/3 of the way from the ASIS to the umbilicus",
                        "McBurney's point: one-third of the way from the right ASIS to the umbilicus. "),
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. MOVE compound muscle entries from structure_muscular to function_terms
#    These have function descriptions baked in, making the pool too heterogeneous
# ─────────────────────────────────────────────────────────────────────────────
MUSCULAR_TO_FUNCTION_MOVES = {
    # Only move if the answer is a pure function description (not just a muscle name)
    # ha_musc_133: 'Hyoglossus (depresses and retracts tongue) — CN XII' — has CN annotation
    # ha_musc_134: 'Styloglossus — retracts and elevates tongue; CN XII' — has CN annotation
    # Better to TRIM these to just the muscle name
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. TRIM compound structure_muscular entries
# ─────────────────────────────────────────────────────────────────────────────
MUSCULAR_TRIMS = {
    "ha_musc_133": ("Hyoglossus",
                    "Hyoglossus: flat extrinsic tongue muscle that depresses and retracts the tongue; innervated by CN XII. "),
    "ha_musc_134": ("Styloglossus",
                    "Styloglossus: extrinsic tongue muscle that retracts and elevates the tongue; innervated by CN XII. "),
    "ha_musc_115": ("APL + EPB (lat.); EPL (med.) — anatomical snuffbox",
                    "Anatomical snuffbox lateral border = abductor pollicis longus + extensor pollicis brevis; medial = EPL. "),
    "ha_musc_126": ("Stylopharyngeus (CN IX — glossopharyngeal)",
                    "Stylopharyngeus is the sole pharyngeal muscle innervated by CN IX (glossopharyngeal nerve). "),
    "ha_musc_086": ("Pubococcygeus, puborectalis, and iliococcygeus",
                    None),  # 46ch but is a clean muscle name list — acceptable
    "ha_musc_114": ("Extensor pollicis longus (medial snuffbox border)",
                    "EPL forms the medial (ulnar) border of the anatomical snuffbox. "),
    "ha_musc_127": ("Cricothyroid (external laryngeal branch of CN X)",
                    "Cricothyroid is the only intrinsic laryngeal muscle innervated by the external laryngeal nerve (branch of CN X). "),
}

# ─────────────────────────────────────────────────────────────────────────────
# 7. TRIM longest structure_muscular visual label entries
# ─────────────────────────────────────────────────────────────────────────────
# ha_visual_309: 'Anterior neck muscles' (21ch) — already moved to structure_muscular
# These are the visual_303-356 moved facts; their labels are short enough (6-23ch)

# ─────────────────────────────────────────────────────────────────────────────
# 8. TRIM number_stats entries that push 24ch max
# ─────────────────────────────────────────────────────────────────────────────
NUMBER_STATS_TRIMS = {
    "ha_multi_015": ("{35} weeks gestation",
                     "Weeks 28–35 of gestation is the typical window for viability with intensive care. Surfactant production matures around 35 weeks. "),
}

# ─────────────────────────────────────────────────────────────────────────────
# APPLY CHANGES
# ─────────────────────────────────────────────────────────────────────────────

def move_fact_to_pool(fact_id, new_pool_id):
    """Move a fact from its current pool to new_pool_id."""
    fact = facts_by_id.get(fact_id)
    if not fact:
        print(f"  WARNING: fact {fact_id} not found", file=sys.stderr)
        return False

    old_pool_id = fact.get("answerTypePoolId")
    if old_pool_id == new_pool_id:
        return False  # Already there

    # Remove from old pool
    if old_pool_id and old_pool_id in pool_by_id:
        old_pool = pool_by_id[old_pool_id]
        if fact_id in old_pool["factIds"]:
            old_pool["factIds"].remove(fact_id)

    # Add to new pool
    if new_pool_id not in pool_by_id:
        print(f"  ERROR: pool {new_pool_id} not found", file=sys.stderr)
        return False

    new_pool = pool_by_id[new_pool_id]
    if fact_id not in new_pool["factIds"]:
        new_pool["factIds"].append(fact_id)

    # Update fact
    fact["answerTypePoolId"] = new_pool_id
    changes.append(f"MOVE {fact_id}: {old_pool_id} → {new_pool_id}")
    return True

def trim_answer(fact_id, new_answer, extra_explanation_prefix=None):
    """Trim an answer and optionally prefix extra context to explanation."""
    fact = facts_by_id.get(fact_id)
    if not fact:
        print(f"  WARNING: fact {fact_id} not found for trim", file=sys.stderr)
        return False

    if new_answer is None:
        return False  # Skip

    old_answer = fact["correctAnswer"]
    if old_answer == new_answer:
        return False  # Already trimmed

    fact["correctAnswer"] = new_answer

    if extra_explanation_prefix:
        old_expl = fact.get("explanation", "")
        fact["explanation"] = extra_explanation_prefix + old_expl

    changes.append(f"TRIM {fact_id}: '{old_answer[:40]}' → '{new_answer[:40]}'")
    return True

print("=== PASS 4: Pool Homogeneity Fixes ===\n")

# Apply pool moves for visual facts
print(f"Moving {len(VISUAL_POOL_MOVES)} visual facts from function_terms to structure pools...")
moved = 0
for fid, new_pool in VISUAL_POOL_MOVES.items():
    if move_fact_to_pool(fid, new_pool):
        moved += 1
print(f"  Moved: {moved} facts\n")

# Apply nerve_names → location_terms moves
print(f"Moving {len(NERVE_TO_LOCATION_MOVES)} vertebral landmark facts from nerve_names to location_terms...")
moved = 0
for fid, new_pool in NERVE_TO_LOCATION_MOVES.items():
    if move_fact_to_pool(fid, new_pool):
        moved += 1
print(f"  Moved: {moved} facts\n")

# Apply function_terms trims
print("Trimming function_terms long entries...")
trimmed = 0
for fid, (new_answer, extra_expl) in FUNCTION_TERM_TRIMS.items():
    if trim_answer(fid, new_answer, extra_expl):
        trimmed += 1
print(f"  Trimmed: {trimmed} entries\n")

# Apply location_terms trims
print("Trimming location_terms long entries...")
trimmed = 0
for fid, (new_answer, extra_expl) in LOCATION_TERM_TRIMS.items():
    if trim_answer(fid, new_answer, extra_expl):
        trimmed += 1
print(f"  Trimmed: {trimmed} entries\n")

# Apply muscular trims
print("Trimming structure_muscular compound entries...")
trimmed = 0
for fid, (new_answer, extra_expl) in MUSCULAR_TRIMS.items():
    if trim_answer(fid, new_answer, extra_expl):
        trimmed += 1
print(f"  Trimmed: {trimmed} entries\n")

# Apply number_stats trims
print("Trimming number_stats long entries...")
trimmed = 0
for fid, (new_answer, extra_expl) in NUMBER_STATS_TRIMS.items():
    if trim_answer(fid, new_answer, extra_expl):
        trimmed += 1
print(f"  Trimmed: {trimmed} entries\n")

# ─────────────────────────────────────────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────────────────────────────────────────
print(f"Total changes: {len(changes)}")
print("Saving...")
with open(OUTPUT, "w") as f:
    json.dump(deck, f, indent=2, ensure_ascii=False)
print("Done.")

print("\n=== CHANGE LOG ===")
for c in changes:
    print(f"  {c}")
