#!/usr/bin/env python3
"""
Fix pool homogeneity issues in human_anatomy.json.

Strategy:
1. Split structure_names mega-pool (1182 facts) into 14 sub-pools by body system
2. Convert bare-number answers in number_stats to {N} bracket notation
3. Trim verbose answers in all pools to reduce length ratio below 10x
4. Move trimmed content to explanation field
5. Update pool factIds arrays to match

Run: python3 scripts/fix-anatomy-pool-homogeneity.py
"""

import json
import re
from collections import defaultdict

INPUT_PATH = "data/decks/human_anatomy.json"
OUTPUT_PATH = "data/decks/human_anatomy.json"

# ============================================================
# MAPPING TABLES
# ============================================================

# ID prefix → sub-pool assignment
PREFIX_TO_POOL = {
    'ha_cardio': 'structure_cardiac',
    'ha_resp': 'structure_respiratory',
    'ha_digest': 'structure_digestive',
    'ha_skel': 'structure_skeletal',
    'ha_musc': 'structure_muscular',
    'ha_nerv': 'structure_nervous',
    'ha_endo': 'structure_endocrine',
    'ha_repro': 'structure_reproductive',
    'ha_urin': 'structure_urinary',
    'ha_lymph': 'structure_lymphatic',
    'ha_histo': 'structure_histological',
    'ha_embryo': 'structure_embryological',
    'ha_integ': 'structure_integumentary',
    'ha_clinical': 'structure_general',
    'ha_regional': 'structure_general',
    'ha_multi': 'structure_general',
    'ha_sense': 'structure_general',
}

# Image asset path category → sub-pool
PATH_TO_POOL = {
    'cardiovascular': 'structure_cardiac',
    'skeletal_system': 'structure_skeletal',
    'digestive_system': 'structure_digestive',
    'nervous_system': 'structure_nervous',
    'muscular_system': 'structure_muscular',
    'respiratory_system': 'structure_respiratory',
    'lymphatic_immune': 'structure_lymphatic',
    'special_senses': 'structure_general',
    'integumentary': 'structure_integumentary',
    'urinary_system': 'structure_urinary',
    'reproductive_system': 'structure_reproductive',
    'endocrine_system': 'structure_endocrine',
}

# ============================================================
# SPECIFIC ANSWER FIXES
# These are explicit per-fact overrides for cases that cannot
# be trimmed algorithmically without domain knowledge risk.
# Format: fact_id → (new_answer, append_to_explanation)
# ============================================================

ANSWER_FIXES = {
    # ---- bone_names verbose fixes ----
    # "Hip (ball-and-socket), knee (modified hinge), ankle (hinge)" → too complex, change pool
    # will be handled by moving to location_terms or trimming

    'ha_skel_080': ('Ball-and-socket, hinge, hinge',
                    'Joints of the lower limb: hip (ball-and-socket), knee (modified hinge), ankle (hinge).'),
    'ha_skel_069': ('Lateral malleolus more distal',
                    'The lateral malleolus extends more distally than the medial malleolus, explaining the lateral ankle\'s greater vulnerability to inversion sprains.'),
    'ha_skel_075': ('Three cuneiforms', 'Named medial, intermediate, and lateral cuneiform bones.'),
    'ha_skel_079': ('30 bones', '30 bones per lower limb (60 total): femur, patella, tibia, fibula, 7 tarsals, 5 metatarsals, 14 phalanges.'),
    'ha_skel_055': ('Ilium, ischium, pubis', None),

    # ---- muscle_names verbose fixes ----
    'ha_musc_089': ('Digastric', 'The digastric has two bellies: anterior belly (CN V3) and posterior belly (CN VII) — unique dual innervation.'),
    'ha_musc_037': ('Radial tuberosity and bicipital aponeurosis', None),
    'ha_musc_052': ('Extensor carpi radialis longus and brevis', None),
    'ha_musc_007': ('Calcium ions (Ca²⁺)', 'Ca²⁺ binds troponin C, causing tropomyosin to shift and expose myosin-binding sites on actin, enabling cross-bridge formation.'),
    'ha_musc_027': ('Type IIa', 'Type IIa (Fast Oxidative-Glycolytic) fibers are intermediate between slow Type I and fast Type IIb fibers.'),
    'ha_musc_091': ('Stylohyoid', 'Stylohyoid is innervated by CN VII (facial nerve) and originates from the styloid process.'),

    # ---- nerve_names verbose fixes ----
    'ha_nerv_035': ('Dorsal, ventral, lateral horns', 'Spinal cord gray matter horns: dorsal (sensory), ventral (motor), lateral (autonomic).'),
    'ha_nerv_052': ('Femoral nerve', 'Femoral nerve (L2–L4): supplies quadriceps (motor) and anterior thigh/medial leg (sensory).'),
    'ha_nerv_036': ('Dorsal columns; spinothalamic tract', 'Dorsal columns: touch/vibration/proprioception; spinothalamic tract: pain/temperature.'),
    'ha_nerv_046': ('Median nerve', 'Median nerve (C6–T1): innervates thenar muscles and provides sensation to lateral 3.5 digits.'),
    'ha_nerv_048': ('Radial nerve', 'Radial nerve (C5–T1): innervates all extensors of the arm and forearm.'),
    'ha_nerv_031': ('Receptor → sensory neuron → CNS → motor neuron → effector', None),
    'ha_musc_107': ('Median (1st+2nd) and ulnar (3rd+4th)', '1st and 2nd lumbricals (unipennate): median nerve; 3rd and 4th (bipennate): ulnar nerve.'),
    'ha_nerv_034': ('L4 = medial leg; L5 = dorsum; S1 = lateral foot', None),
    'ha_nerv_047': ('Ulnar nerve', 'Ulnar nerve (C8–T1): innervates most intrinsic hand muscles and medial 1.5 digits.'),
    'ha_nerv_050': ('Vagus nerve (CN X)', 'Vagus nerve is the longest cranial nerve, supplying parasympathetic innervation to heart, lungs, and GI tract.'),
    'ha_nerv_044': ('Roots → Trunks → Divisions → Cords → Branches', 'Brachial plexus (C5–T1) organizational hierarchy from proximal to distal.'),
    'ha_clinical_058': ('L4–L5 disc; L5 nerve root', 'Most common lumbar herniation level is L4–L5, typically compressing the L5 nerve root.'),
    'ha_clinical_040': ('Common fibular (peroneal) nerve at fibular neck', None),
    'ha_nerv_033': ('C6 = thumb; C7 = middle finger; C8 = little finger', None),
    'ha_musc_047': ('Posterior interosseous nerve', 'Posterior interosseous nerve is the deep branch of the radial nerve (C7–C8).'),
    'ha_nerv_045': ('Musculocutaneous, median, ulnar, radial, axillary', None),
    'ha_nerv_049': ('Sciatic nerve', 'Sciatic nerve (L4–S3): the largest nerve in the body, supplying the posterior thigh and leg.'),
    'ha_musc_104': ('Dorsal rami of spinal nerves', None),
    'ha_nerv_051': ('Phrenic nerve', 'Phrenic nerve (C3–C5) provides motor innervation to the diaphragm. Mnemonic: C3, C4, C5 keeps the diaphragm alive.'),
    'ha_clinical_023': ('C5–C6 brachial plexus (upper trunk)', None),
    'ha_clinical_024': ('C8–T1 brachial plexus (lower trunk)', None),
    'ha_musc_085': ('Deep branch of ulnar nerve', 'Deep branch of the ulnar nerve (C8–T1) innervates adductor pollicis.'),
    'ha_musc_045': ('Anterior interosseous nerve', 'Anterior interosseous nerve is a branch of the median nerve innervating FPL.'),
    'ha_musc_105': ('Recurrent branch of median nerve', None),
    'ha_nerv_032': ('T4 = nipple; T10 = umbilicus', None),

    # ---- vessel_names verbose fixes ----
    'ha_multi_005': ('Superior mesenteric vein and splenic vein', None),

    # ---- organ_names verbose fixes (pool was OK at 3.7x but we'll fix the outlier) ----
    'ha_nerv_037': ('Dura mater, arachnoid mater, pia mater', 'The three meninges in order outer to inner: dura mater, arachnoid mater, pia mater.'),

    # ---- function_terms verbose fixes (>60 chars) ----
    'ha_digest_042': ('First-pass hepatic metabolism',
                      'Liver processes absorbed substances from the portal vein before they reach systemic circulation.'),
    'ha_multi_014': ('Gas exchange, nutrient/waste transfer, hormone production',
                     'Placenta functions: gas exchange, nutrient/waste transfer, and produces hCG, hPL, oestrogen, and progesterone.'),
    'ha_embryo_055': ('Muscular septum grows toward endocardial cushion',
                      'The ventral interventricular septum grows up from the floor of the ventricle toward the endocardial cushion to complete the interventricular septum.'),
    'ha_endo_048': ('Negative feedback suppresses TRH and TSH',
                    'High T3/T4 levels inhibit TRH release from the hypothalamus and TSH release from the anterior pituitary.'),
    'ha_endo_042': ('Inhibits insulin and glucagon secretion',
                    'Somatostatin from delta cells inhibits both insulin (from beta cells) and glucagon (from alpha cells) secretion.'),
    'ha_endo_037': ('Hypertension, headache, diaphoresis, tachycardia',
                    'Pheochromocytoma: excess catecholamine production causes hypertension, headache, sweating, and tachycardia.'),
    'ha_endo_001': ('Master endocrine regulator',
                    'Hypothalamus releases and inhibits hormones that control the anterior pituitary gland.'),
    'ha_endo_031': ('Glomerulosa, fasciculata, reticularis',
                    'Mnemonic GFR: zona glomerulosa (mineralocorticoids/aldosterone), fasciculata (glucocorticoids/cortisol), reticularis (androgens).'),
    'ha_endo_049': ('Positive feedback: oxytocin intensifies contractions',
                    'Uterine contractions stimulate more oxytocin release, which intensifies contractions — a classic positive feedback loop during labor.'),
    'ha_endo_019': ('Uterine contractions and milk ejection',
                    'Oxytocin from the posterior pituitary drives uterine contractions during labor and milk ejection (let-down reflex) during breastfeeding.'),
    'ha_digest_055': ('Terminal ileum (requires intrinsic factor)',
                      'Vitamin B12 is absorbed in the terminal ileum and requires intrinsic factor produced by gastric parietal cells.'),
    'ha_endo_028': ('Stimulates osteoclasts; increases renal Ca²⁺ reabsorption',
                    'PTH raises blood calcium by activating osteoclasts for bone resorption and increasing renal calcium reabsorption.'),
    'ha_endo_029': ('Antagonistic: PTH raises Ca²⁺, calcitonin lowers it', None),
    'ha_resp_049': ('Nasal cavity → pharynx → larynx → trachea → bronchi → alveoli',
                    'Full respiratory pathway: nasal cavity → pharynx → larynx → trachea → bronchi → bronchioles → alveoli.'),
    'ha_digest_045': ('Stercobilin (from bilirubin via urobilinogen)',
                      'Stool brown color: stercobilin, a pigment derived from bilirubin via urobilinogen in the gut.'),
    'ha_digest_051': ('Fatty acids and monoglycerides',
                      'Fats are absorbed across intestinal wall as fatty acids and monoglycerides (after micelle formation with bile salts).'),
    'ha_endo_033': ('Raises blood glucose, suppresses inflammation, stress response', None),
    'ha_digest_038': ('Protective mucus',
                      'Mucous cells in the stomach secrete a protective mucus layer that shields the gastric lining from HCl and pepsin.'),
    'ha_digest_057': ('Lymphoid tissue for gut immune function', None),
    'ha_digest_044': ('Conjugated and excreted into bile', None),
    'ha_digest_046': ('Urobilin (from urobilinogen absorbed from gut)', None),
    'ha_endo_017': ('Increases water reabsorption via aquaporins',
                    'ADH inserts aquaporin-2 channels into collecting duct cells, increasing water reabsorption.'),
    'ha_endo_023': ('Increase metabolic rate, heat production, support growth', None),
    'ha_endo_045': ('Light suppresses melatonin; darkness increases it', None),
    'ha_nerv_026': ('"S-M-B-M-B-M-B-B-B-M" mnemonic',
                    'Cranial nerve sensory/motor mnemonic: Some Say Marry Money But My Brother Says Big Brains Matter.'),
    'ha_nerv_053': ('Sympathetic dilates; parasympathetic constricts bronchi', None),
    'ha_embryo_075': ('Maxillary prominence fails to fuse with medial nasal process', None),
    'ha_musc_132': ('Subscapularis — internal rotation',
                    'Subscapularis: only anterior rotator cuff muscle; internal rotation; tested by lift-off and belly-press tests.'),
    'ha_musc_139': ('Superior oblique: intorsion, depression, abduction',
                    'Superior oblique passes through the trochlear pulley. Primary action: intorsion. Secondary: depression and abduction.'),

    # ---- location_terms verbose fixes (>50 chars) ----
    'ha_clinical_025': ('Supraspinous fossa to greater tubercle of humerus',
                        'Supraspinatus origin: supraspinous fossa of scapula. Insertion: superior facet of the greater tubercle of the humerus.'),
    'ha_clinical_070': ('4th–5th ICS, mid-axillary line (safe triangle)', None),
    'ha_clinical_076': ('2nd–3rd tracheal rings, below cricoid', 'Tracheostomy incision: 2nd–3rd tracheal rings, below cricoid, avoiding the thyroid isthmus.'),
    'ha_regional_020': ('Biceps femoris (superolat.); semimembranosus/semitendinosus (superomedial)',
                        'Popliteal fossa boundaries: biceps femoris superolaterally; semimembranosus and semitendinosus superomedially.'),
    'ha_histo_061': ('Zone 3 most susceptible; zone 1 most resistant', 'Liver acinus: zone 3 (centrilobular) is most vulnerable to ischemia; zone 1 (periportal) most resistant.'),
    'ha_clinical_075': ('Left hilum higher than right (97%)', None),
    'ha_regional_017': ('Inguinal ligament, sartorius, adductor longus', None),
    'ha_histo_084': ('Centrilobular = proximal acinus; panacinar = entire acinus', None),
    'ha_clinical_008': ('Between FCR tendon and radius', None),
    'ha_musc_102': ('Medial epicondyle of humerus (common flexor origin)', None),
    'ha_regional_011': ('Anterior: pectoralis major; posterior: latissimus dorsi and teres major', None),
    'ha_clinical_066': ('Below inguinal ligament, medial to femoral vein', None),
    'ha_clinical_071': ('Between two heads of sternocleidomastoid', None),
    'ha_regional_013': ('Brachioradialis (lateral) and pronator teres (medial)', None),
    'ha_musc_103': ('Posterior tibia above soleal line', 'Popliteus origin: lateral femoral condyle; inserts on posterior tibia above the soleal line.'),
    'ha_histo_064': ('Thymic cortex (positive selection)', 'T cell positive selection (MHC recognition) occurs in the thymic cortex.'),

    # ---- clinical_terms verbose fixes (>60 chars) ----
    'ha_clinical_059': ('Neurogenic claudication (relieved by lumbar flexion)',
                        'Lumbar spinal stenosis: bilateral leg pain/heaviness that is relieved by lumbar flexion (leaning forward/sitting).'),
    'ha_clinical_055': ('Brachial plexus and subclavian vessels compressed',
                        'Thoracic outlet syndrome: brachial plexus and subclavian vessels compressed between anterior and middle scalene muscles.'),
    'ha_clinical_042': ('Loss of ulnar intrinsics → claw hand (4th/5th digits)',
                        'Ulnar nerve injury: loss of lumbricals and interossei → MCP hyperextension, IP flexion of 4th and 5th digits.'),
    'ha_clinical_043': ('Loss of thenar muscles → ape hand',
                        'Median nerve injury: loss of thenar muscles (opponens pollicis, APB, FPB) → thumb lies flat in plane of palm.'),
    'ha_clinical_053': ('Supraspinatus tendon under coracoacromial arch',
                        'Rotator cuff impingement: supraspinatus tendon (and subacromial bursa) compressed under the coracoacromial arch.'),
    'ha_clinical_057': ('Phalen\'s, Tinel\'s, nocturnal paraesthesia, thenar wasting',
                        'Carpal tunnel syndrome features: positive Phalen\'s test, positive Tinel\'s sign, nocturnal paraesthesia, and thenar muscle wasting.'),
    'ha_multi_025': ('Open-angle glaucoma: chronic painless peripheral vision loss',
                     'Glaucoma: open-angle type is chronic, painless with progressive peripheral vision loss; angle-closure type is acute with pain.'),
    'ha_clinical_029': ('Upper motor neuron lesion (stroke/corticospinal damage)', None),

    # ---- tissue_types verbose fixes (>40 chars) ----
    'ha_histo_029': ('Pseudostratified epithelium',
                     'Pseudostratified: all cells contact the basement membrane, but nuclei at different heights create false appearance of layers.'),
    'ha_histo_081': ('Type II pneumocytes (cuboidal; produce surfactant)',
                     'Type II pneumocytes: cuboidal cells with lamellar bodies that produce pulmonary surfactant.'),
    'ha_histo_066': ('Multinucleated osteoclast with ruffled border',
                     'Osteoclasts: multinucleated (6–50 nuclei) bone-resorbing cells with a ruffled border adjacent to bone.'),
    'ha_histo_067': ('Osteocyte in lacunae via canaliculi',
                     'Osteocytes are the most abundant bone cells, living in lacunae and communicating via canaliculi. They are mechanosensory.'),
    'ha_histo_010': ('Stratified squamous (non-keratinized)', None),
    'ha_histo_008': ('Pseudostratified ciliated columnar epithelium', None),
    'ha_histo_009': ('Stratified squamous (keratinized)', None),
    'ha_histo_001': ('Epithelial, connective, muscle, nervous', None),

    # ---- immune_terms verbose fixes ----
    'ha_multi_023': ('Type II hypersensitivity (IgG/IgM → complement/ADCC)',
                     'Type II: IgG/IgM binds cell-surface antigens → complement activation or ADCC → cell destruction. Examples: Rh incompatibility, autoimmune haemolytic anaemia.'),
    'ha_multi_022': ('MHC class II on APCs; recognised by CD4+ T helper cells',
                     'MHC class II: found only on antigen-presenting cells (APCs); recognised by CD4+ T helper cells.'),
    'ha_multi_021': ('Type I: IgE-mediated immediate hypersensitivity',
                     'Type I hypersensitivity is IgE-mediated, causing immediate reactions (anaphylaxis, asthma, atopy).'),
    'ha_multi_024': ('Type IV: delayed-type (T-cell mediated, 48–72 hrs)',
                     'Type IV (delayed-type) hypersensitivity is T-cell mediated with reactions occurring 48–72 hours after exposure.'),

    # ---- number_stats: bare single-digit numbers convert to {N} ----
    # These are handled separately below in the bracket conversion pass
}

# ---- STRUCTURE_NAMES VERBOSE FIXES ----
# These are structure_names facts that are too long after the split.
# After splitting, some sub-pools still fail. Fix the outliers:

STRUCTURE_FIXES = {
    # structure_cardiac outliers
    'ha_cardio_103': ('DVT: femoral and popliteal veins', 'Femoral and popliteal veins are the most common deep vein thrombosis locations.'),
    'ha_cardio_066': ('Type O: no antigens + anti-A, anti-B antibodies', None),
    'ha_cardio_093': ('RCA: inferior LV, RV, SA node, AV node', 'Right coronary artery supplies: inferior left ventricular wall, right ventricle, SA node, and AV node.'),

    # structure_embryological outliers
    'ha_embryo_058': ('Hindgut: distal colon to anus', 'Hindgut: distal 1/3 transverse colon, descending colon, sigmoid, rectum, and upper anal canal.'),
    'ha_embryo_038': ('Neural crest cells: melanocytes, Schwann cells, DRG, craniofacial', 'Neural crest derivatives include melanocytes, Schwann cells, dorsal root ganglia, and craniofacial skeleton.'),
    'ha_embryo_059': ('Dental pulp and thyroid C cells', 'Dental pulp (odontoblasts) and parafollicular C cells of the thyroid are neural crest derivatives.'),

    # structure_general outliers (clinical/regional facts in structure pool)
    'ha_clinical_047': ('EPB and APL in anatomical snuffbox (lateral border)', 'Lateral border of the anatomical snuffbox: extensor pollicis brevis (EPB) and abductor pollicis longus (APL).'),
    'ha_multi_016': ('15–20 lobes with lactiferous ducts; Cooper\'s ligaments', 'Breast: 15–20 lobes draining via lactiferous ducts to the nipple, supported by Cooper\'s suspensory ligaments.'),
    'ha_clinical_038': ('Common flexor tendon (medial epicondyle)', 'Common flexor origin at the medial epicondyle of the humerus includes flexor carpi radialis and pronator teres.'),

    # structure_histological outliers
    'ha_histo_089': ('Non-caseating granulomas (sarcoidosis)',
                     'Non-caseating granulomas: compact collections of epithelioid macrophages and multinucleated giant cells. Hallmark of sarcoidosis.'),
    'ha_histo_082': ('Hassall\'s corpuscles in thymic medulla', 'Hassall\'s corpuscles are eosinophilic whorled structures found in the thymic medulla.'),
    'ha_histo_075': ('Fibroblasts + new capillaries + macrophages', 'Granulation tissue composition: fibroblasts, new capillaries (angiogenesis), and macrophages.'),

    # structure_muscular outliers
    'ha_musc_125': ('CN X (vagus) via pharyngeal plexus', 'Pharyngeal constrictors are innervated by CN X (vagus) via the pharyngeal plexus.'),
    'ha_musc_114': ('Extensor pollicis longus (ulnar/medial border)', 'Medial (ulnar) border of the anatomical snuffbox is formed by extensor pollicis longus.'),
    'ha_musc_115': ('APL + EPB (lateral); EPL (medial snuffbox borders)', 'Anatomical snuffbox: APL and EPB form the lateral border; EPL forms the medial border.'),

    # structure_nervous outliers
    'ha_nerv_087': ('Circle of Willis: 10 arteries (2 ACA, ACoA, 2 ICA, 2 PCoA, 2 PCA, basilar)', None),
    'ha_nerv_093': ('Foramina of Magendie (median) and Luschka (lateral)', None),
    'ha_nerv_097': ('Broca\'s area: inferior frontal gyrus (dominant hemisphere)', 'Broca\'s area (Brodmann 44+45): inferior frontal gyrus of the dominant hemisphere; speech production.'),

    # structure_skeletal outliers
    # ha_visual_325_img_ans etc. - these are image_answers, keep them but also note
    # The ratio will still be high due to img_ans being 60 chars
    # We'll trim the verbose image descriptions
    'ha_visual_325_img_ans': ('Bone blood supply', 'Shows nutrient artery, periosteal vessels, and metaphyseal vessels supplying bone.'),
    'ha_visual_332_img_ans': ('Flat bone structure', 'Shows inner and outer compact tables with diplöe (spongy bone) between them.'),
    'ha_visual_338_img_ans': ('Long bone anatomy', 'Shows diaphysis, epiphysis, metaphysis, medullary cavity, and related structures.'),
    'ha_visual_325': ('Bone blood supply', 'Shows nutrient artery, periosteal vessels, and metaphyseal vessels supplying bone.'),
    'ha_visual_332': ('Flat bone structure', 'Shows inner and outer compact tables with diplöe (spongy bone) between them.'),
    'ha_visual_338': ('Long bone anatomy', 'Shows diaphysis, epiphysis, metaphysis, medullary cavity, and related structures.'),
    'ha_visual_349_img_ans': ('Synovial joint types', 'Shows hinge, ball-and-socket, pivot, and condyloid synovial joint examples.'),
    'ha_visual_349': ('Synovial joint types', 'Shows hinge, ball-and-socket, pivot, and condyloid synovial joint examples.'),
    'ha_visual_353_img_ans': ('Typical vertebra', 'Shows body, vertebral arch, pedicles, laminae, and various processes.'),
    'ha_visual_353': ('Typical vertebra', 'Shows body, vertebral arch, pedicles, laminae, and various processes.'),
    'ha_visual_346_img_ans': ('Scapula', 'Shows spine, acromion, coracoid process, and glenoid cavity of the scapula.'),
    'ha_visual_346': ('Scapula', 'Shows spine, acromion, coracoid process, and glenoid cavity of the scapula.'),
    'ha_visual_343_img_ans': ('Periosteum and endosteum', 'Shows outer periosteum and inner endosteum as bone membrane layers.'),
    'ha_visual_343': ('Periosteum and endosteum', 'Shows outer periosteum and inner endosteum as bone membrane layers.'),
    'ha_visual_327_img_ans': ('Bone surface markings', 'Shows processes, fossae, foramina, and facets as key bone surface markings.'),
    'ha_visual_327': ('Bone surface markings', 'Shows processes, fossae, foramina, and facets as key bone surface markings.'),
    'ha_visual_337_img_ans': ('Intervertebral disc', 'Shows nucleus pulposus (gelatinous center) and annulus fibrosus (fibrous ring).'),
    'ha_visual_337': ('Intervertebral disc', 'Shows nucleus pulposus (gelatinous center) and annulus fibrosus (fibrous ring).'),
    'ha_visual_342_img_ans': ('Pelvis overview', 'Shows pelvic inlet, outlet, and key bony landmarks of the pelvis.'),
    'ha_visual_342': ('Pelvis overview', 'Shows pelvic inlet, outlet, and key bony landmarks of the pelvis.'),
    'ha_visual_340_img_ans': ('Male and female pelvis comparison', 'Shows anatomical differences between male (narrower) and female (wider) pelvis.'),
    'ha_visual_340': ('Male and female pelvis comparison', 'Shows anatomical differences between male (narrower) and female (wider) pelvis.'),
    'ha_visual_336_img_ans': ('Humerus and elbow joint', 'Shows epicondyles, condyles, and olecranon fossa of the humerus and elbow.'),
    'ha_visual_336': ('Humerus and elbow joint', 'Shows epicondyles, condyles, and olecranon fossa of the humerus and elbow.'),
    'ha_visual_334_img_ans': ('Hand and wrist bones', 'Shows carpals, metacarpals, and phalanges of the hand.'),
    'ha_visual_334': ('Hand and wrist bones', 'Shows carpals, metacarpals, and phalanges of the hand.'),
    'ha_visual_352_img_ans': ('Ulna and radius', 'Shows forearm bones with interosseous membrane between them.'),
    'ha_visual_352': ('Ulna and radius', 'Shows forearm bones with interosseous membrane between them.'),
    'ha_visual_345_img_ans': ('Sacrum and coccyx', 'Shows fused vertebral segments with sacral foramina and the coccyx.'),
    'ha_visual_345': ('Sacrum and coccyx', 'Shows fused vertebral segments with sacral foramina and the coccyx.'),
    'ha_visual_317_img_ans': ('Leg compartments', 'Shows anterior, posterior, and lateral muscle compartments of the leg.'),
    'ha_visual_317': ('Leg compartments', 'Shows anterior, posterior, and lateral muscle compartments of the leg.'),
    'ha_visual_320_img_ans': ('Neck and back muscles', 'Shows erector spinae and deep posterior muscle groups.'),
    'ha_visual_320': ('Neck and back muscles', 'Shows erector spinae and deep posterior muscle groups.'),
    'ha_visual_322_img_ans': ('Posterior neck muscles', 'Shows suboccipital triangle and semispinalis muscle group.'),
    'ha_visual_322': ('Posterior neck muscles', 'Shows suboccipital triangle and semispinalis muscle group.'),
    'ha_visual_321_img_ans': ('Pectoral girdle muscles', 'Shows pec major/minor, serratus anterior, and trapezius.'),
    'ha_visual_321': ('Pectoral girdle muscles', 'Shows pec major/minor, serratus anterior, and trapezius.'),
    'ha_visual_355_img_ans': ('Osteoclast (multinucleated, ruffled border)', None),
    'ha_visual_355': ('Osteoclast (multinucleated, ruffled border)', None),

    # structure_urinary outliers
    'ha_urin_040': ('Afferent arteriole → glomerulus → efferent arteriole', None),
    'ha_urin_023': ('Vasoconstriction and aldosterone release', None),
}

# Bare number facts to convert to {N} notation
# These are in number_stats pool and their answers are bare single numbers/words
# that should use {N} for algorithmic distractor generation
BARE_NUMBER_FACTS = {
    'ha_cardio_001': ('Four', '{4}'),
    'ha_digest_004': ('4', '{4}'),
    'ha_digest_008': ('3', '{3}'),
    'ha_integ_002': ('three', '{3}'),
    'ha_integ_004': ('five', '{5}'),
    'ha_regional_033': ('9', '{9}'),
    'ha_resp_002': ('Three', '{3}'),
    'ha_resp_010': ('Three', '{3}'),
    'ha_resp_011': ('Two', '{2}'),
    'ha_sense_026': ('5', '{5}'),
    'ha_skel_001': ('8', '{8}'),
    'ha_skel_002': ('14', '{14}'),
    'ha_skel_009': ('7', '{7}'),
    'ha_skel_013': ('12', '{12}'),
    'ha_skel_014': ('5', '{5}'),
    'ha_skel_016': ('4', '{4}'),
    'ha_skel_018': ('24', '{24}'),
    'ha_skel_038': ('8', '{8}'),
    'ha_skel_044': ('5', '{5}'),
    'ha_skel_045': ('14', '{14}'),
    'ha_skel_053': ('30', '{30}'),
    'ha_urin_027': ('3', '{3}'),
    # Also acceptableAlternatives should be updated
    # ha_cardio_001 has acceptableAlternatives: ["4"] → update to "{4}"
    'ha_repro_017': ('Four spermatids', '{4} spermatids'),
}


def get_structure_sub_pool(fact):
    """Determine which sub-pool a structure_names fact belongs to."""
    fid = fact['id']
    if fid.startswith('ha_visual'):
        path = fact.get('imageAssetPath', '')
        parts = path.split('/')
        cat = parts[3] if len(parts) > 3 else 'unknown'
        return PATH_TO_POOL.get(cat, 'structure_general')
    else:
        prefix = '_'.join(fid.split('_')[:2])
        return PREFIX_TO_POOL.get(prefix, 'structure_general')


def fix_answer(fact, fact_id, all_fixes):
    """Apply answer fix if available for this fact."""
    fix = all_fixes.get(fact_id)
    if fix:
        new_answer, extra_explanation = fix
        if new_answer != fact.get('correctAnswer'):
            old_answer = fact['correctAnswer']
            fact['correctAnswer'] = new_answer
            # Append extra explanation content if provided
            if extra_explanation:
                existing_expl = fact.get('explanation', '')
                if existing_expl and extra_explanation not in existing_expl:
                    fact['explanation'] = existing_expl + ' ' + extra_explanation
                elif not existing_expl:
                    fact['explanation'] = extra_explanation
    return fact


def main():
    print("Loading human_anatomy.json...")
    with open(INPUT_PATH) as f:
        deck = json.load(f)

    facts_list = deck['facts']
    print(f"Total facts: {len(facts_list)}")

    # Build fact lookup
    facts_by_id = {f['id']: f for f in facts_list}

    # ============================================================
    # PASS 1: Apply all explicit answer fixes
    # ============================================================
    print("\nPass 1: Applying answer fixes...")
    combined_fixes = {**ANSWER_FIXES, **STRUCTURE_FIXES}

    fixed_count = 0
    for fact in facts_list:
        fid = fact['id']
        if fid in combined_fixes:
            new_ans, extra_expl = combined_fixes[fid]
            old_ans = fact.get('correctAnswer', '')
            if new_ans != old_ans:
                fact['correctAnswer'] = new_ans
                fixed_count += 1
            if extra_expl:
                existing = fact.get('explanation', '')
                if extra_expl not in existing:
                    fact['explanation'] = (existing + ' ' + extra_expl).strip()

    print(f"  Fixed {fixed_count} answers")

    # ============================================================
    # PASS 2: Convert bare number answers to {N} notation
    # ============================================================
    print("\nPass 2: Converting bare numbers to {N} notation...")
    bare_fixed = 0
    for fact in facts_list:
        fid = fact['id']
        if fid in BARE_NUMBER_FACTS:
            old_ans, new_ans = BARE_NUMBER_FACTS[fid]
            if fact.get('correctAnswer') == old_ans:
                fact['correctAnswer'] = new_ans
                bare_fixed += 1
                # Update acceptableAlternatives too
                alts = fact.get('acceptableAlternatives', [])
                new_alts = []
                for alt in alts:
                    # Remove alternatives that are just the un-bracketed number form
                    # (the {N} system handles numeric variations)
                    if alt not in ('4', '2', '3', '5', '7', '8', '9', '12', '14', '24', '30',
                                   'Four', 'Two', 'Three', 'five', 'three'):
                        new_alts.append(alt)
                fact['acceptableAlternatives'] = new_alts

    print(f"  Converted {bare_fixed} bare-number answers")

    # ============================================================
    # PASS 3: Split structure_names into sub-pools
    # ============================================================
    print("\nPass 3: Splitting structure_names pool into sub-pools...")

    # Define the new sub-pool IDs
    sub_pool_ids = [
        'structure_cardiac',
        'structure_respiratory',
        'structure_digestive',
        'structure_skeletal',
        'structure_muscular',
        'structure_nervous',
        'structure_endocrine',
        'structure_reproductive',
        'structure_urinary',
        'structure_lymphatic',
        'structure_histological',
        'structure_embryological',
        'structure_integumentary',
        'structure_general',
    ]

    # Build sub-pool fact ID lists
    sub_pool_facts = defaultdict(list)
    reassigned = 0
    for fact in facts_list:
        if fact.get('answerTypePoolId') == 'structure_names':
            new_pool = get_structure_sub_pool(fact)
            fact['answerTypePoolId'] = new_pool
            sub_pool_facts[new_pool].append(fact['id'])
            reassigned += 1

    print(f"  Reassigned {reassigned} facts from structure_names to sub-pools")
    for pool_id in sorted(sub_pool_ids):
        print(f"    {pool_id}: {len(sub_pool_facts[pool_id])} facts")

    # ============================================================
    # PASS 4: Rebuild answerTypePools array
    # ============================================================
    print("\nPass 4: Rebuilding answerTypePools...")

    # Keep existing pools except structure_names
    old_pools = deck.get('answerTypePools', [])
    new_pools = []

    for pool in old_pools:
        if pool['id'] == 'structure_names':
            # Replace with sub-pools
            for sub_id in sub_pool_ids:
                if sub_pool_facts[sub_id]:  # only add non-empty pools
                    new_pool = {
                        'id': sub_id,
                        'label': sub_id.replace('_', ' ').title(),
                        'factIds': sub_pool_facts[sub_id]
                    }
                    new_pools.append(new_pool)
        else:
            # Rebuild factIds from facts (to ensure consistency)
            pool_id = pool['id']
            fact_ids_for_pool = [f['id'] for f in facts_list if f.get('answerTypePoolId') == pool_id]
            pool['factIds'] = fact_ids_for_pool
            new_pools.append(pool)

    deck['answerTypePools'] = new_pools
    print(f"  Total pools after split: {len(new_pools)}")

    # ============================================================
    # PASS 5: Verify no structure_names references remain
    # ============================================================
    print("\nPass 5: Verifying no orphaned structure_names references...")
    orphaned = [f['id'] for f in facts_list if f.get('answerTypePoolId') == 'structure_names']
    if orphaned:
        print(f"  ERROR: {len(orphaned)} facts still reference structure_names!")
        for fid in orphaned[:10]:
            print(f"    {fid}")
    else:
        print("  OK: No orphaned structure_names references")

    # ============================================================
    # PASS 6: Write output
    # ============================================================
    print(f"\nWriting {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(deck, f, indent=2, ensure_ascii=False)
    print("Done.")

    # ============================================================
    # PASS 7: Report final homogeneity stats
    # ============================================================
    print("\n=== FINAL POOL HOMOGENEITY REPORT ===")
    all_pools = deck['answerTypePools']
    for pool in all_pools:
        pool_id = pool['id']
        pool_facts = [f for f in facts_list if f.get('answerTypePoolId') == pool_id]
        answers = [f.get('correctAnswer', '') for f in pool_facts]
        # Strip {N} markers for length check
        clean_answers = [re.sub(r'\{[^}]+\}', 'N', a) for a in answers]
        lengths = sorted([len(a) for a in clean_answers])
        if not lengths:
            continue
        min_l, max_l = lengths[0], lengths[-1]
        ratio = max_l / max(min_l, 1)
        status = "FAIL" if ratio > 10 or (max_l - min_l) > 40 else "OK"
        print(f"  {status} {pool_id}: n={len(lengths)}, min={min_l}, max={max_l}, ratio={ratio:.1f}x")


if __name__ == '__main__':
    main()
