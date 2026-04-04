#!/usr/bin/env python3
"""
Second-pass fix for human_anatomy.json pool homogeneity.

After pass1 (structure_names split + explicit fixes + number_stats {N} conversion),
these pools still fail:
  - muscle_names: 10.8x (some >25ch)
  - structure_cardiac: 23.5x
  - structure_skeletal: 11.6x (image_answers verbose parentheticals)
  - structure_muscular: 9.7x (image_answers verbose)
  - structure_nervous: 18.5x
  - structure_urinary: 17.3x
  - structure_histological: 8.3x (some verbose)
  - structure_embryological: 8.1x (near border)
  - structure_general: 14.0x
  - nerve_names: 28.5x (long nerve pathway descriptions)
  - function_terms: 10.3x
  - location_terms: 14.8x
  - number_stats: 60x (long compound stats vs {N})
  - clinical_terms: 16.0x
  - tissue_types: 10.0x (borderline)
  - immune_terms: 18.3x

Strategy:
1. Trim ALL image_answers verbose parentheticals (pattern: "Label (description)" → "Label")
2. Trim remaining verbose answers in all pools
3. Split number_stats: move compound stat facts (60ch) to function_terms
   since they're more descriptions than counts

Run: python3 scripts/fix-anatomy-pool-homogeneity-pass2.py
"""

import json
import re
from collections import defaultdict

INPUT_PATH = "data/decks/human_anatomy.json"
OUTPUT_PATH = "data/decks/human_anatomy.json"


def trim_parenthetical(answer: str) -> str:
    """
    Remove trailing parenthetical context from image_answers text.

    Examples:
    "Bone cells (osteoblast, osteocyte, osteoclast, osteogenic)" → "Bone cells"
    "Spongy (cancellous) bone (trabeculae and red bone marrow)" → "Cancellous bone"
    "Intrinsic hand muscles (thenar, hypothenar, lumbricals)" → "Intrinsic hand muscles"
    "Carpal tunnel (transverse carpal ligament and contents)" → "Carpal tunnel"

    If the parenthetical contains important qualifier (like "(cancellous)"):
    "Spongy (cancellous) bone" → keep "Cancellous bone" form

    Returns trimmed answer or original if pattern doesn't match.
    """
    # Case: "Word (synonym/qualifier) word" → "Word word" keeping parenthetical synonym
    # We only trim TRAILING parentheticals, not qualifying parentheticals mid-string

    # First: handle "X (synonym) Y" where parenthetical is in middle
    # "Spongy (cancellous) bone (trabeculae...)" → "Cancellous bone"
    # This is complex, handle as manual override

    # Simple: trim TRAILING parenthetical
    # "Label (description of label)" → "Label"
    stripped = re.sub(r'\s*\([^)]+\)\s*$', '', answer).strip()

    # If result ends in parenthetical context mid-way: e.g. "Spongy (cancellous) bone"
    # Strip that too if it leaves a short clean label
    stripped2 = re.sub(r'\s*\([^)]+\)', '', stripped).strip()

    # Only use aggressive strip if it makes sense
    if len(stripped2) >= 5 and stripped2 != stripped:
        # Check if the interior parenthetical was a synonym/qualifier
        return stripped2

    return stripped if stripped != answer else answer


# Manual overrides for cases where auto-trim isn't perfect
MANUAL_IMAGE_ANS_TRIMS = {
    # structure_skeletal
    'ha_visual_326_img_ans': 'Bone cells',
    'ha_visual_347_img_ans': 'Spongy bone',
    'ha_visual_356_img_ans': 'Osteocyte',
    'ha_visual_328_img_ans': 'Carpal tunnel',
    'ha_visual_339_img_ans': 'Lumbar vertebra',
    'ha_visual_348_img_ans': 'Synovial joint',
    'ha_visual_354_img_ans': 'Vertebral column',
    'ha_visual_324_img_ans': 'Appendicular skeleton',
    'ha_visual_350_img_ans': 'Thoracic vertebra',
    'ha_visual_329_img_ans': 'Cervical vertebrae',
    'ha_visual_331_img_ans': 'Femur and patella',
    'ha_visual_330_img_ans': 'Compact bone',
    'ha_visual_333_img_ans': 'Foot bones',
    'ha_visual_335_img_ans': 'Hip bone',
    'ha_visual_344_img_ans': 'Rib cage',
    'ha_visual_351_img_ans': 'Tibia and fibula',
    'ha_visual_355_img_ans': 'Osteoclast',
    'ha_visual_341_img_ans': 'Pectoral girdle',
    'ha_visual_343_img_ans': 'Periosteum and endosteum',
    'ha_visual_345_img_ans': 'Sacrum and coccyx',
    'ha_visual_346_img_ans': 'Scapula',
    'ha_visual_349_img_ans': 'Synovial joint types',
    'ha_visual_353_img_ans': 'Typical vertebra',
    'ha_visual_342_img_ans': 'Pelvis',
    'ha_visual_340_img_ans': 'Male vs female pelvis',
    'ha_visual_336_img_ans': 'Humerus and elbow joint',
    'ha_visual_334_img_ans': 'Hand and wrist bones',
    'ha_visual_352_img_ans': 'Ulna and radius',
    'ha_visual_337_img_ans': 'Intervertebral disc',
    'ha_visual_325_img_ans': 'Bone blood supply',
    'ha_visual_327_img_ans': 'Bone surface markings',
    'ha_visual_332_img_ans': 'Flat bone',
    'ha_visual_338_img_ans': 'Long bone',
    # structure_muscular
    'ha_visual_309_img_ans': 'Anterior neck muscles',
    'ha_visual_315_img_ans': 'Intrinsic hand muscles',
    'ha_visual_313_img_ans': 'Forearm muscles',
    'ha_visual_314_img_ans': 'Gluteal muscles',
    'ha_visual_319_img_ans': 'Muscle fiber structure',
    'ha_visual_310_img_ans': 'Extraocular muscles',
    'ha_visual_312_img_ans': 'Foot muscles',
    'ha_visual_311_img_ans': 'Facial muscles',
    'ha_visual_323_img_ans': 'Sarcomere',
    'ha_visual_318_img_ans': 'Motor end plate',
    'ha_visual_048_img_ans': 'Muscle contraction',
    'ha_visual_316_img_ans': 'Jaw muscles',
    'ha_visual_320_img_ans': 'Neck and back muscles',
    'ha_visual_321_img_ans': 'Pectoral girdle muscles',
    'ha_visual_322_img_ans': 'Posterior neck muscles',
    'ha_visual_317_img_ans': 'Leg compartments',
    # structure_nervous
    'ha_visual_408_img_ans': 'CSF circulation',
    'ha_visual_307_img_ans': 'Optic pathways',
    'ha_visual_389_img_ans': 'Basal nuclei',
    'ha_visual_400_img_ans': 'Peripheral nerve structure',
    # structure_general
    'ha_visual_216_img_ans': 'Cone spectral sensitivity',
    'ha_visual_308_img_ans': 'Retina layers',
    'ha_visual_307_img_ans': 'Optic pathways',
    'ha_visual_223_img_ans': 'Maculae',
    'ha_visual_221_img_ans': 'Cochlear frequency coding',
    'ha_visual_228_img_ans': 'Sound transmission',
    'ha_visual_222_img_ans': 'Hair cell',
    # structure_cardiac
    'ha_visual_270_img_ans': 'Chordae tendineae',
    'ha_visual_184_img_ans': 'Myocardial infarction (posterior)',
    'ha_visual_183_img_ans': 'Myocardial infarction (anterior)',
    'ha_visual_119_img_ans': 'Ventricular septal defect',
    'ha_visual_117_img_ans': 'Patent ductus arteriosus',
    'ha_visual_277_img_ans': 'Heart valves',
    'ha_visual_384_img_ans': 'Erythrocyte',
    'ha_visual_113_img_ans': 'Atrial septal defect',
    'ha_visual_179_img_ans': 'Blood pressure measurement',
    'ha_visual_385_img_ans': 'Head and neck veins',
    # structure_endocrine
    'ha_visual_306_img_ans': 'Thyroid gland',
    'ha_visual_305_img_ans': 'Adrenal glands',
    'ha_visual_212_img_ans': 'Hypothalamus-pituitary axis',
    # structure_lymphatic
    'ha_visual_288_img_ans': 'MALT',
    'ha_visual_293_img_ans': 'Lymphatic trunks',
    # structure_urinary
    'ha_visual_378_img_ans': 'Juxtaglomerular apparatus',
    'ha_visual_268_img_ans': 'Kidney position',
    # structure_respiratory
    'ha_visual_304_img_ans': 'Pleura',
    'ha_visual_205_img_ans': 'Laryngeal cartilages',
    # structure_digestive
    'ha_visual_370_img_ans': 'Teeth',
    'ha_visual_363_img_ans': 'Pancreas',
    'ha_visual_168_img_ans': 'Gallbladder',
    'ha_visual_357_img_ans': 'Accessory digestive organs',
    # structure_reproductive
    'ha_visual_251_img_ans': 'Breast anatomy',
    'ha_visual_252_img_ans': 'Female reproductive hormones',
    'ha_visual_257_img_ans': 'Ovarian follicle development',
    'ha_visual_253_img_ans': 'Female reproductive system',
    'ha_visual_263_img_ans': 'Uterus and fallopian tubes',
    'ha_visual_265_img_ans': 'Male reproductive hormones',
}

# ALSO need to update the corresponding image_question facts to match
# (image_question and image_answers must have same correctAnswer)
# Build this mapping from img_ans IDs
IMAGE_Q_TRIMS = {k.replace('_img_ans', ''): v for k, v in MANUAL_IMAGE_ANS_TRIMS.items()}

# Additional verbal answer fixes for non-visual facts (second pass)
ADDITIONAL_FIXES = {
    # ---- nerve_names remaining verbose ----
    'ha_nerv_031': ('Five-component reflex arc',
                    'Reflex arc components in order: receptor → sensory neuron → CNS → motor neuron → effector.'),
    'ha_nerv_033': ('C6, C7, C8 finger dermatomal levels', 'C6 = thumb; C7 = middle finger; C8 = little finger.'),
    'ha_nerv_045': ('Five terminal brachial plexus branches',
                    'Terminal branches: musculocutaneous, median, ulnar, radial, and axillary nerves.'),
    'ha_nerv_034': ('L4, L5, S1 lower limb dermatomal levels', 'L4 = medial leg; L5 = dorsum of foot; S1 = lateral foot.'),
    'ha_nerv_044': ('Roots → Trunks → Divisions → Cords → Branches',
                    'Brachial plexus (C5–T1) hierarchy: Roots → Trunks → Divisions → Cords → Branches.'),

    # ---- function_terms remaining verbose (>55ch) ----
    'ha_endo_033': ('Raises glucose, suppresses inflammation, stress response',
                    'Cortisol effects: raises blood glucose, suppresses inflammation, and mediates the stress response.'),
    'ha_resp_049': ('Nose → pharynx → larynx → trachea → bronchi → alveoli',
                    'Complete respiratory pathway from nose to alveoli.'),
    'ha_embryo_075': ('Maxillary prominence fails to fuse with nasal process',
                      'Cleft lip: failure of maxillary prominence to fuse with the medial nasal process during weeks 4–7.'),
    'ha_nerv_027': ('CN mnemonic: "Some Say Marry Money But My Brother Says Big Brains Matter"',
                    'Cranial nerve sensory/motor classification mnemonic for CNs I–XII.'),
    'ha_resp_044': ('Surfactant reduces surface tension, prevents alveolar collapse',
                    'Pulmonary surfactant lowers alveolar surface tension, preventing collapse on expiration.'),
    'ha_sense_008': ('LR6SO4 mnemonic for CN VI and CN IV',
                     'CN VI (abducens) → lateral rectus; CN IV (trochlear) → superior oblique. All other EOMs: CN III.'),
    'ha_embryo_085': ('COMT haploinsufficiency → excess prefrontal dopamine',
                      'COMT haploinsufficiency leads to excess dopamine in the prefrontal cortex, contributing to schizophrenia risk.'),
    'ha_musc_136': ('Posterior cricoarytenoid — sole vocal cord abductor',
                    'The posterior cricoarytenoid is the only muscle that abducts the vocal cords (opens the glottis).'),
    'ha_cardio_097': ('Preload = ventricular end-diastolic volume',
                      'Preload is the ventricular end-diastolic volume or pressure (LVEDP) — the stretch on the ventricle before contraction.'),
    'ha_digest_060': ('Enteric nervous system (~100 million neurons)',
                      'The enteric nervous system has ~100 million gut-wall neurons and functions semi-autonomously.'),
    'ha_endo_025': ('TSH receptor antibodies overstimulate the thyroid',
                    'Graves disease: TSH receptor antibodies continuously stimulate the thyroid → hyperthyroidism.'),
    'ha_endo_039': ('Beta cells: ~65–80% of islet cells',
                    'Beta cells comprise approximately 65–80% of pancreatic islet cells and produce insulin.'),
    'ha_endo_041': ('Stimulates glycogenolysis and gluconeogenesis in the liver',
                    'Glucagon stimulates hepatic glycogenolysis and gluconeogenesis to raise blood glucose.'),
    'ha_endo_046': ('Promotes T lymphocyte maturation for adaptive immunity',
                    'The thymus promotes maturation of T lymphocytes needed for the adaptive immune response.'),
    'ha_musc_110': ('Flexes MCP, extends IP joints simultaneously',
                    'Lumbricals flex the metacarpophalangeal (MCP) joint and extend both interphalangeal (IP) joints simultaneously.'),
    'ha_nerv_042': ('Sympathetic: mydriasis (dilation); parasympathetic: miosis',
                    'Pupil control: sympathetic dilates (mydriasis); parasympathetic constricts (miosis).'),
    'ha_nerv_054': ('Sympathetic relaxes; parasympathetic contracts detrusor',
                    'Bladder control: sympathetic relaxes the detrusor muscle; parasympathetic contracts it for micturition.'),
    'ha_nerv_088': ('Ipsilateral motor + contralateral pain/temp loss',
                    'Brown-Séquard pattern: ipsilateral motor and proprioception loss; contralateral pain and temperature loss.'),
    'ha_endo_024': ('Parafollicular C cells produce calcitonin',
                    'Calcitonin-producing parafollicular (C) cells of the thyroid lower blood calcium.'),
    'ha_endo_027': ('Four glands on posterior thyroid surface',
                    'The four parathyroid glands sit on the posterior surface of the thyroid gland.'),
    'ha_musc_098': ('~14% of population lack palmaris longus',
                    'Approximately 14% of the population (with ethnic variation) lack the palmaris longus muscle.'),
    'ha_nerv_041': ('Both divisions use ACh as preganglionic transmitter',
                    'Both sympathetic and parasympathetic divisions use acetylcholine (ACh) as the preganglionic neurotransmitter.'),
    'ha_resp_045': ('Terminal → respiratory bronchioles → alveolar ducts',
                    'Transition zone: terminal bronchioles → respiratory bronchioles → alveolar ducts → alveoli.'),
    'ha_embryo_074': ('Hirschsprung: failure of neural crest migration to hindgut',
                      'Hirschsprung disease: neural crest cells fail to migrate into the distal hindgut → aganglionic segment.'),
    'ha_embryo_089': ('Oligohydramnios → pulmonary hypoplasia + limb contractures',
                      'Oligohydramnios (low amniotic fluid) causes pulmonary hypoplasia and limb contractures from restricted movement.'),
    'ha_embryo_090': ('Turner syndrome features: lymphedema, webbing, cardiac defects',
                      'Fetal lymphedema leads to webbing (pterygium colli), cardiovascular malformations, and renal defects in Turner syndrome.'),
    'ha_cardio_095': ('Phase 0 (Na⁺ influx) and Phase 2 plateau (Ca²⁺ influx)',
                      'Ventricular AP: Phase 0 (rapid Na⁺ influx → depolarization), Phase 2 plateau (Ca²⁺ influx balances K⁺ efflux).'),
    'ha_cardio_112': ('Purkinje fibres: intrinsic Phase 4 automaticity',
                      'Purkinje fibres have automaticity via Phase 4 slow depolarization; backup pacing rate 15–40 bpm.'),
    'ha_embryo_047': ('Fetal Hb: higher O₂ affinity (left-shifted curve)',
                      'Fetal hemoglobin (HbF) has higher oxygen affinity than adult HbA, with a left-shifted dissociation curve.'),
    'ha_endo_006': ('Dopamine (prolactin-inhibiting hormone)',
                    'The primary prolactin-inhibiting hormone (PIH) from the hypothalamus is dopamine.'),
    'ha_endo_009': ('Growth, protein synthesis, and lipolysis',
                    'GH effects: promotes growth, stimulates protein synthesis, and induces lipolysis (fat breakdown).'),
    'ha_embryo_081': ('Cleft palate: palatal shelves fail to fuse',
                      'Cleft palate: lateral palatal shelves fail to fuse with the primary palate (midline fusion failure).'),
    'ha_musc_121': ('External intercostals elevate ribs for forced inspiration',
                    'External intercostals elevate ribs during forced inspiration; internal intercostals depress ribs.'),
    'ha_nerv_053': ('Sympathetic dilates bronchi; parasympathetic constricts',
                    'Autonomic bronchial effects: sympathetic → bronchodilation; parasympathetic → bronchoconstriction.'),
    'ha_nerv_090': ('CSF: choroid plexus → Monro → 3rd ventricle → aqueduct → 4th',
                    'CSF circulation pathway through the ventricular system.'),

    # ---- location_terms remaining verbose (>45ch) ----
    'ha_regional_020': ('Biceps femoris (lat.) and semimembranosus/semitendinosus (med.)',
                        'Popliteal fossa superolateral boundary: biceps femoris; superomedial: semimembranosus and semitendinosus.'),
    'ha_regional_011': ('Pec major (anterior); latissimus dorsi + teres major (posterior)',
                        'Axilla walls: anterior = pectoralis major; posterior = latissimus dorsi and teres major.'),
    'ha_histo_084': ('Centrilobular (proximal); panacinar (entire acinus)',
                     'Emphysema subtypes: centrilobular (smokers, proximal acinus); panacinar (alpha-1 AT deficiency, entire acinus).'),
    'ha_regional_013': ('Brachioradialis (lat.) and pronator teres (med.)',
                        'Cubital fossa boundaries: lateral = brachioradialis; medial = pronator teres.'),
    'ha_musc_102': ('Medial epicondyle (common flexor origin)',
                    'The common flexor origin at the medial epicondyle is shared by palmaris longus and other wrist flexors.'),

    # ---- number_stats: move long compound stats to function_terms ----
    # These are better suited as function_terms since they're multi-part descriptions
    # APPROACH: change answerTypePoolId for these to function_terms
    # ha_cardio_076, ha_resp_043, ha_sense_031, ha_repro_025 are compound stats
    # ha_embryo_052 is a location + number → location_terms
    # ha_multi_012, ha_multi_013 are formula-type answers → function_terms

    # ---- clinical_terms remaining verbose (>55ch) ----
    # Many clinical_terms are legitimately long — trimming would lose precision
    # Focus on the most egregious ones
    'ha_clinical_054': ('Restricted active and passive ROM (especially external rotation)',
                        'Frozen shoulder (adhesive capsulitis): restricted active AND passive range of motion, especially external rotation.'),
    'ha_clinical_056': ('Piriformis syndrome (sciatic nerve compression)',
                        'Piriformis syndrome: sciatic nerve compressed by or through the piriformis muscle → sciatica-like symptoms.'),
    'ha_multi_025': ('Open-angle glaucoma vs angle-closure glaucoma',
                     'Open-angle: chronic, painless, progressive peripheral loss. Angle-closure: acute, painful, emergency.'),
    'ha_embryo_063': ('Conotruncal defects: tetralogy, truncus arteriosus',
                      'Neural crest migration failure → conotruncal defects including tetralogy of Fallot and truncus arteriosus.'),
    'ha_histo_074': ('Silver stain: type III collagen appears black',
                     'Silver stain highlights type III collagen (reticulin) black.'),
    'ha_histo_076': ('Keloid: extends beyond wound margins, no regression',
                     'Keloid: excess collagen extends beyond wound margins; does not regress spontaneously.'),
    'ha_cardio_109': ('Marfan syndrome: FBN1 mutation, chromosome 15',
                      'Marfan syndrome caused by FBN1 (fibrillin-1) mutation on chromosome 15.'),
    'ha_clinical_022': ('Radial nerve compressed in spiral groove (Saturday night palsy)',
                        'Radial nerve palsy from compression against the humerus in the spiral groove → wrist drop.'),
    'ha_multi_020': ('Type 1 DM: autoimmune beta-cell destruction',
                     'Type 1 diabetes: autoimmune destruction of pancreatic beta cells → absolute insulin deficiency.'),
    'ha_multi_027': ('Menière disease: endolymphatic hydrops',
                     'Menière disease: endolymphatic hydrops causing episodic vertigo, sensorineural hearing loss, tinnitus.'),
    'ha_clinical_082': ('Needle insertion superior to lower rib margin',
                        'Chest aspiration: insert needle just above the lower rib to avoid neurovascular bundle along the rib\'s inferior margin.'),
    'ha_embryo_078': ('Turner syndrome: 45X — lymphedema, short stature',
                      'Turner syndrome (45X): features include lymphedema, short stature, and ovarian dysgenesis.'),
    'ha_embryo_086': ('Bicuspid aortic valve in Turner syndrome (~30–50%)',
                      'Bicuspid aortic valve occurs in approximately 30–50% of Turner syndrome patients.'),
    'ha_histo_073': ('Masson trichrome: collagen = blue/green; muscle = red',
                     'Masson trichrome stain: collagen/fibrosis = blue/green; muscle = red; nuclei = dark.'),
    'ha_musc_137': ('Tibialis posterior failure → hindfoot valgus, arch collapse',
                    'Tibialis posterior tendon dysfunction leads to hindfoot valgus and progressive arch collapse.'),
    'ha_cardio_102': ('Virchow\'s triad: stasis, hypercoagulability, vessel injury',
                      'The three factors predisposing to venous thrombosis (Virchow\'s triad).'),
    'ha_cardio_111': ('Factor V Leiden: most common thrombophilia',
                      'Factor V Leiden mutation: most common inherited thrombophilia; causes APC resistance.'),
    'ha_clinical_044': ('Head tilts toward affected side; chin away',
                        'Head tilt with chin rotation to opposite side is the classic posture in CN IV (trochlear) palsy.'),
    'ha_clinical_048': ('Palmar fascia fibrosis: ring then little finger',
                        'Dupuytren contracture: fibrosis of palmar fascia typically affects ring finger first, then little finger.'),
    'ha_multi_026': ('Cataracts: lens opacity, painless vision loss',
                     'Cataracts: progressive lens opacity causing painless vision loss.'),
    'ha_multi_030': ('ABCDE melanoma criteria',
                     'Melanoma warning signs: Asymmetry, Border irregularity, Colour variation, Diameter >6mm, Evolution.'),
    'ha_embryo_067': ('Atrioventricular canal defect (endocardial cushion)',
                      'AV canal defect results from failure of endocardial cushion fusion.'),
    'ha_histo_071': ('Hematoxylin: nuclei blue/violet; eosin: cytoplasm pink',
                     'H&E staining: hematoxylin = blue/violet nuclei; eosin = pink/red cytoplasm and connective tissue.'),
    'ha_histo_078': ('IgA nephropathy: mesangial IgA, hematuria',
                     'IgA nephropathy (Berger disease): mesangial IgA deposition causing recurrent hematuria.'),
    'ha_histo_079': ('Crescentic GN: crescents in Bowman\'s capsule',
                     'Crescentic (rapidly progressive) GN: cellular crescents in Bowman\'s capsule, rapid renal failure.'),
    'ha_histo_090': ('Congo red: apple-green birefringence for amyloid',
                     'Congo red stain: apple-green birefringence under polarized light indicates amyloid deposition.'),
    'ha_cardio_090': ('Mitral regurgitation: holosystolic murmur at apex',
                      'Mitral regurgitation produces a holosystolic blowing murmur best heard at the cardiac apex.'),
    'ha_embryo_071': ('Oligohydramnios → pulmonary hypoplasia + limb deformities',
                      'Oligohydramnios leads to pulmonary hypoplasia (restricted breathing movements) and limb deformities.'),
    'ha_histo_070': ('Emphysema: permanent airspace enlargement past terminal bronchiole',
                     'Emphysema is defined as permanent enlargement of airspaces beyond the terminal bronchiole.'),
    'ha_histo_077': ('Membranous nephropathy: subepithelial IgG, spike-and-dome',
                     'Membranous nephropathy: subepithelial IgG deposits forming spike-and-dome pattern on EM.'),
    'ha_histo_083': ('MPGN type I: tram-track GBM splitting',
                     'Membranoproliferative GN Type I: tram-track splitting of the glomerular basement membrane.'),
    'ha_nerv_112': ('Anterior cord syndrome: bilateral motor + pain/temp loss',
                    'Anterior cord syndrome: bilateral loss of motor function and pain/temperature sensation below lesion.'),
    'ha_cardio_086': ('VSD: most common congenital heart defect',
                      'Ventricular septal defect is the most common congenital heart defect overall.'),
    'ha_cardio_107': ('Anaphylactic shock: IgE-mediated mast cell degranulation',
                      'Anaphylaxis: IgE-mediated mast cell degranulation → massive vasodilation and bronchoconstriction.'),
    'ha_embryo_051': ('Esophageal atresia with distal tracheoesophageal fistula',
                      'Most common type (85–90%): esophageal atresia with distal tracheoesophageal fistula.'),
    'ha_embryo_083': ('Smooth philtrum and thin upper lip: most specific FAS signs',
                      'Most specific features of fetal alcohol syndrome are smooth philtrum and thin upper lip.'),
    'ha_nerv_113': ('Central cord syndrome: upper > lower extremity weakness',
                    'Central cord syndrome produces greater weakness in upper than lower extremities.'),
    'ha_cardio_101': ('AAA: atherosclerosis, infrarenal aorta',
                      'Abdominal aortic aneurysm: most common cause is atherosclerosis; most common site is infrarenal aorta.'),
    'ha_nerv_117': ('Brown-Séquard: ipsilateral motor + proprioception loss',
                    'Ipsilateral motor and proprioception loss; contralateral pain and temperature loss below lesion.'),
    'ha_cardio_089': ('Aortic stenosis: crescendo-decrescendo systolic murmur',
                      'Aortic stenosis produces a crescendo-decrescendo (diamond-shaped) systolic murmur at the right second ICS.'),
    'ha_cardio_091': ('Mitral valve prolapse: mid-systolic click + late murmur',
                      'MVP produces a mid-systolic click with or without a late systolic murmur.'),
    'ha_cardio_113': ('PDA: continuous machinery murmur at left upper sternum',
                      'Patent ductus arteriosus: continuous "machinery" murmur heard at the left upper sternal border.'),
    'ha_nerv_108': ('Loss of dopaminergic neurons in substantia nigra',
                    'Parkinson disease: degeneration of dopaminergic neurons in the substantia nigra pars compacta (SNc).'),
    'ha_nerv_114': ('UMN CN VII lesion: contralateral lower face paralysis',
                    'Upper motor neuron CN VII lesion: paralysis of contralateral lower face only (forehead sparing).'),
    'ha_nerv_116': ('LMN CN XII lesion: tongue deviates toward lesion side',
                    'LMN hypoglossal lesion: tongue deviates toward the lesion side (weak side).'),
    'ha_cardio_100': ('Thoracic aortic aneurysm: Marfan or syphilis',
                      'Common causes of thoracic aortic aneurysm: Marfan syndrome (cystic medial necrosis) and syphilis.'),
    'ha_cardio_108': ('LAD → anterior MI; RCA → inferior; LCx → lateral',
                      'Coronary territory: LAD = anterior MI; RCA = inferior MI; LCx = lateral MI.'),
    'ha_nerv_124': ('Hemiballismus: contralateral proximal limb flinging',
                    'Hemiballismus: violent flinging movements of contralateral proximal limb from subthalamic nucleus lesion.'),
    'ha_nerv_125': ('Wernicke encephalopathy: thiamine (B1) deficiency',
                    'Wernicke encephalopathy triad (confusion, ataxia, ophthalmoplegia) from thiamine deficiency.'),
    'ha_cardio_088': ('Indomethacin closes PDA (blocks prostaglandins)',
                      'Indomethacin (NSAID) is used to close a patent ductus arteriosus by blocking prostaglandin synthesis.'),
    'ha_cardio_105': ('Sinus venosus ASD: near the SVC–RA junction',
                      'Sinus venosus ASD is located near the junction of the superior vena cava and right atrium.'),
    'ha_nerv_115': ('CN V lesion: jaw deviates toward weak side',
                    'Trigeminal motor lesion: jaw deviates toward the weak (lesioned) side on mouth opening.'),
    'ha_cardio_099': ('Hypovolemic shock: low PCWP, high SVR, tachycardia',
                      'Hemodynamic profile of hypovolemic shock.'),
    'ha_histo_088': ('Paget disease: woven bone replacing lamellar bone',
                     'Paget disease of bone: chaotic woven bone replaces normal lamellar bone.'),
    'ha_nerv_125': ('Wernicke encephalopathy: thiamine (B1) deficiency',
                    'Classic Wernicke triad: confusion, ataxia, ophthalmoplegia — from thiamine deficiency.'),
    'ha_embryo_053': ('Thyroglossal cyst moves with swallowing and tongue protrusion',
                      'A thyroglossal duct cyst moves upward with both swallowing and tongue protrusion.'),
    'ha_embryo_073': ('Omphalocele: midline, covered by peritoneum',
                      'Omphalocele is a midline defect covered by peritoneum/amnion (vs gastroschisis: right of umbilicus, uncovered).'),
    'ha_clinical_045': ('Plantar fasciitis: pain first step after rest',
                        'Classic presentation: sharp heel pain on the first step in the morning or after prolonged rest.'),
    'ha_nerv_115': ('CN V: jaw deviates toward weak side', None),

    # ---- tissue_types remaining verbose ----
    'ha_histo_081': ('Type II pneumocytes (surfactant-producing)',
                     'Type II pneumocytes: cuboidal cells with lamellar bodies that produce pulmonary surfactant.'),
    'ha_histo_066': ('Osteoclast: multinucleated + ruffled border',
                     'Osteoclasts: multinucleated (6–50 nuclei) bone-resorbing cells with a ruffled border near bone.'),
    'ha_histo_008': ('Pseudostratified ciliated columnar', None),
    'ha_histo_001': ('Epithelial, connective, muscle, nervous', None),

    # ---- immune_terms remaining verbose ----
    'ha_multi_022': ('MHC class II: on APCs, binds CD4+ T cells',
                     'MHC class II is found only on antigen-presenting cells (APCs) and recognised by CD4+ T helper cells.'),
    'ha_multi_023': ('Type II hypersensitivity (antibody-mediated)',
                     'Type II: IgG/IgM antibodies bind cell-surface antigens → complement activation or ADCC.'),
    'ha_multi_024': ('Type IV hypersensitivity (delayed-type, T-cell mediated)',
                     'Type IV (delayed-type) hypersensitivity is T-cell mediated with reactions at 48–72 hours.'),
    'ha_multi_021': ('Type I hypersensitivity: IgE-mediated immediate',
                     'Type I (anaphylaxis, asthma, atopy) is IgE-mediated immediate hypersensitivity.'),

    # ---- structure_nervous remaining verbose ----
    'ha_nerv_087': ('Circle of Willis (10 arteries)',
                    'Circle of Willis: 2 ACA + ACoA + 2 ICA + 2 PCoA + 2 PCA + basilar artery = 10 vessels.'),
    'ha_nerv_105': ('Ventromedial nucleus: satiety centre',
                    'VMH is the satiety centre; destruction leads to hyperphagia and obesity.'),
    'ha_nerv_119': ('Lateral hypothalamus: hunger centre',
                    'Lateral hypothalamus is the hunger centre; destruction leads to anorexia/starvation.'),
    'ha_nerv_099': ('VPL nucleus: somatosensory relay',
                    'Ventral posterolateral (VPL) thalamic nucleus relays body sensation to the somatosensory cortex.'),
    'ha_nerv_097': ('Broca\'s area (inferior frontal gyrus)',
                    'Broca\'s area (Brodmann areas 44+45) in the dominant inferior frontal gyrus: speech production.'),
    'ha_nerv_101': ('VL nucleus: motor relay from cerebellum and basal ganglia',
                    'Ventral lateral thalamic nucleus relays motor signals from cerebellum and basal ganglia to motor cortex.'),
    'ha_nerv_103': ('Supraoptic nucleus: ADH synthesis',
                    'Supraoptic nucleus of the hypothalamus primarily synthesises ADH (vasopressin).'),
    'ha_nerv_104': ('Paraventricular nucleus: oxytocin, ADH, CRH',
                    'Paraventricular nucleus produces oxytocin (primary), ADH, and CRH.'),
    'ha_nerv_096': ('Brodmann area 4: primary motor cortex',
                    'Brodmann area 4 = primary motor cortex (precentral gyrus).'),
    'ha_nerv_109': ('Lateral cerebellar hemisphere: motor planning (dentate)',
                    'The dentate nucleus (largest cerebellar nucleus) in the lateral hemisphere coordinates motor planning.'),
    'ha_nerv_110': ('Vermis and intermediate zone: truncal/limb coordination',
                    'Spinocerebellum (vermis + intermediate zone) coordinates truncal and limb movements.'),
    'ha_nerv_120': ('Arcuate nucleus: dopamine (inhibits prolactin) and GnRH',
                    'Arcuate nucleus secretes dopamine (inhibits prolactin) and GnRH (pulsatile, drives LH/FSH).'),
    'ha_nerv_106': ('Cortex → striatum → globus pallidus → thalamus → cortex',
                    'Direct basal ganglia circuit: cortex → striatum → GPi/SNr → thalamus → cortex.'),
    'ha_nerv_121': ('Superior cerebellar peduncle: primary efferent pathway',
                    'Superior cerebellar peduncle (brachium conjunctivum) carries efferent fibers from cerebellar nuclei.'),
    'ha_nerv_102': ('Suprachiasmatic nucleus: circadian clock',
                    'The suprachiasmatic nucleus (SCN) of the hypothalamus is the master circadian pacemaker.'),
    'ha_nerv_111': ('Middle cerebellar peduncle: afferent from pons',
                    'Middle cerebellar peduncle (brachium pontis) carries afferent input from contralateral pontine nuclei.'),
    'ha_nerv_089': ('Horner syndrome: miosis, ptosis, anhidrosis',
                    'Horner syndrome ipsilateral triad: miosis (small pupil), ptosis (drooping lid), anhidrosis (no sweating).'),
    'ha_nerv_093': ('Foramina of Magendie (median) and Luschka (lateral)',
                    'CSF exits the 4th ventricle via: Foramen of Magendie (single median) and foramina of Luschka (2 lateral).'),
    'ha_nerv_098': ('Brodmann areas 41 and 42: auditory cortex',
                    'Primary auditory cortex = Brodmann areas 41 and 42 in the superior temporal gyrus (Heschl\'s gyri).'),
    'ha_nerv_123': ('Anterior hypothalamus: heat dissipation',
                    'Anterior hypothalamus: thermoregulation for heat loss/cooling (via vasodilation, sweating).'),
    'ha_nerv_100': ('LGN: visual relay in thalamus',
                    'Lateral geniculate nucleus (LGN) of the thalamus relays visual information to the primary visual cortex.'),
    'ha_nerv_118': ('Brodmann area 17: primary visual cortex (V1)',
                    'Primary visual cortex = Brodmann area 17, in the calcarine sulcus of the occipital lobe.'),
    'ha_nerv_091': ('Foramen of Monro',
                    'Foramen of Monro (interventricular foramen) connects each lateral ventricle to the third ventricle.'),

    # ---- structure_cardiac verbose ----
    'ha_cardio_087': ('Ostium secundum ASD: most common (~70%)',
                      'Ostium secundum ASD is the most common type of atrial septal defect, accounting for ~70% of cases.'),
    'ha_cardio_083': ('Carotid sinus (CN IX) and aortic arch (CN X)',
                      'Baroreceptors: carotid sinus innervated by CN IX (glossopharyngeal); aortic arch by CN X (vagus).'),
    'ha_cardio_080': ('QRS complex: ventricular depolarization',
                      'The QRS complex on the ECG represents ventricular depolarization (and atrial repolarization).'),

    # ---- structure_urinary verbose ----
    'ha_urin_040': ('Afferent → glomerulus → efferent arteriole',
                    'Renal blood flow sequence: afferent arteriole → glomerular capillaries → efferent arteriole.'),

    # ---- structure_histological verbose ----
    'ha_histo_080': ('Myomesin at M line; alpha-actinin at Z disc',
                     'Sarcomere anchoring proteins: myomesin anchors myosin thick filaments at the M line; alpha-actinin anchors actin at the Z disc.'),
    'ha_histo_086': ('Glomerular endothelium: fenestrated, no diaphragm',
                     'Glomerular capillary endothelium is fenestrated without a diaphragm, allowing ultra-filtration.'),
    'ha_histo_063': ('A band: myosin (thick); I band: actin (thin)',
                     'Sarcomere band composition: A band contains thick myosin filaments; I band contains thin actin filaments only.'),
    'ha_histo_062': ('Filtration barrier: endothelium → basement membrane → podocytes',
                     'Glomerular filtration barrier: fenestrated endothelium → basement membrane → podocyte foot processes.'),
    'ha_histo_065': ('Germinal centre: dark zone (hypermutation) and light zone (selection)',
                     'Germinal centre zones: dark zone (somatic hypermutation of B cells); light zone (antigen selection and affinity maturation).'),
    'ha_histo_068': ('Air-blood barrier: surfactant → type I pneumocyte → basement membrane → capillary',
                     'Layers of the alveolar gas exchange barrier from lumen to blood.'),

    # ---- structure_embryological verbose ----
    'ha_embryo_038': ('Neural crest: melanocytes, Schwann cells, DRG, craniofacial',
                      'Neural crest cell derivatives include melanocytes, Schwann cells, dorsal root ganglia, and craniofacial skeleton.'),
    'ha_embryo_088': ('3rd pharyngeal arch: stylohyoid, posterior digastric, stapedius',
                      'CN VII derivatives of 3rd pharyngeal arch (2nd = Reichert\'s cartilage): stylohyoid, posterior digastric, stapedius muscles.'),

    # ---- structure_general verbose ----
    'ha_clinical_050': ('PCL prevents posterior tibial translation',
                        'The posterior cruciate ligament (PCL) prevents posterior translation of the tibia on the femur.'),
    'ha_clinical_049': ('ACL prevents anterior tibial translation',
                        'The anterior cruciate ligament (ACL) prevents anterior translation of the tibia on the femur.'),
    'ha_regional_037': ('Trapezius, latissimus dorsi, and scapular border',
                        'Posterior triangle of the neck posterior boundary: trapezius, latissimus dorsi, and medial scapular border.'),
    'ha_clinical_087': ('Filtration barrier: endothelium → basement membrane → podocytes',
                        'Glomerular filtration barrier layers.'),
    'ha_clinical_020': ('Median nerve under flexor retinaculum',
                        'Carpal tunnel: median nerve is compressed under the flexor retinaculum (transverse carpal ligament).'),
    'ha_clinical_078': ('Portal triad: portal vein, hepatic artery, bile duct',
                        'Each portal tract contains a branch of the portal vein, hepatic artery, and bile duct.'),
    'ha_sense_010': ('Primary visual cortex (V1) in calcarine sulcus',
                     'V1 (Brodmann area 17) is located in the calcarine sulcus of the medial occipital lobe.'),
    'ha_multi_010': ('Loop of Henle (thick ascending limb)',
                     'The thick ascending limb (TAL) of the loop of Henle is impermeable to water and dilutes urine.'),

    # ---- number_stats: move long compound stats to function_terms ----
    # Will be handled programmatically below
}

# Facts in number_stats whose answers are compound stats that belong in function_terms
# These are >30 chars and describe proportions/distributions rather than single quantities
NUMBER_STATS_TO_FUNCTION_TERMS = {
    'ha_cardio_076',  # "Right ventricle: ~25/0–5 mmHg; Pulmonary artery: ~25/10 mmHg"
    'ha_resp_043',    # "70% bicarbonate, 23% carbaminohemoglobin, 7% dissolved"
    'ha_sense_031',   # "~400 receptor types / ~10 million olfactory neurons"
    'ha_repro_025',   # "60% seminal vesicles, 30% prostate, <5% sperm"
    'ha_embryo_052',  # "2 feet proximal to the ileocecal valve" → location_terms
    'ha_multi_012',   # "Low pH, low bicarbonate (HCO3-)" → function_terms
    'ha_multi_013',   # "pH = pKa + log([HCO3-] / [CO2])" → function_terms
}

NUMBER_STATS_TO_LOCATION = {
    'ha_embryo_052',  # location of Meckel's diverticulum
}


def main():
    print("Loading human_anatomy.json...")
    with open(INPUT_PATH) as f:
        deck = json.load(f)

    facts_list = deck['facts']
    print(f"Total facts: {len(facts_list)}")

    facts_by_id = {f['id']: f for f in facts_list}

    # ============================================================
    # PASS 1: Trim image_answers verbose parentheticals
    # ============================================================
    print("\nPass 1: Trimming image_answers verbose answers...")
    img_ans_fixed = 0
    img_q_fixed = 0

    for fact in facts_list:
        fid = fact['id']

        # Apply manual override for image_answers
        if fid in MANUAL_IMAGE_ANS_TRIMS:
            old_ans = fact.get('correctAnswer', '')
            new_ans = MANUAL_IMAGE_ANS_TRIMS[fid]
            if old_ans != new_ans:
                fact['correctAnswer'] = new_ans
                img_ans_fixed += 1

        # Apply to corresponding image_question fact (must stay in sync)
        if fid in IMAGE_Q_TRIMS:
            old_ans = fact.get('correctAnswer', '')
            new_ans = IMAGE_Q_TRIMS[fid]
            if old_ans != new_ans:
                # Preserve original as explanation context
                existing_expl = fact.get('explanation', '')
                if old_ans not in existing_expl:
                    fact['explanation'] = (old_ans + '. ' + existing_expl).strip()
                fact['correctAnswer'] = new_ans
                img_q_fixed += 1

    print(f"  Trimmed {img_ans_fixed} image_answers facts")
    print(f"  Updated {img_q_fixed} corresponding image_question facts")

    # ============================================================
    # PASS 2: Apply additional verbal answer fixes
    # ============================================================
    print("\nPass 2: Applying additional verbal answer fixes...")
    verbal_fixed = 0

    for fact in facts_list:
        fid = fact['id']
        if fid in ADDITIONAL_FIXES:
            new_ans, extra_expl = ADDITIONAL_FIXES[fid]
            old_ans = fact.get('correctAnswer', '')
            if old_ans != new_ans:
                fact['correctAnswer'] = new_ans
                verbal_fixed += 1
            if extra_expl:
                existing = fact.get('explanation', '')
                if extra_expl not in existing:
                    fact['explanation'] = (existing + ' ' + extra_expl).strip()

    print(f"  Fixed {verbal_fixed} verbal answers")

    # ============================================================
    # PASS 3: Move compound number_stats to function_terms/location_terms
    # ============================================================
    print("\nPass 3: Reassigning compound stats from number_stats...")
    reassigned = 0

    for fact in facts_list:
        fid = fact['id']
        if fact.get('answerTypePoolId') == 'number_stats' and fid in NUMBER_STATS_TO_FUNCTION_TERMS:
            if fid in NUMBER_STATS_TO_LOCATION:
                fact['answerTypePoolId'] = 'location_terms'
            else:
                fact['answerTypePoolId'] = 'function_terms'
            reassigned += 1
            print(f"  Moved {fid} → {fact['answerTypePoolId']}: {fact['correctAnswer'][:50]}")

    print(f"  Moved {reassigned} compound facts out of number_stats")

    # ============================================================
    # PASS 4: Rebuild answerTypePools factIds from current facts
    # ============================================================
    print("\nPass 4: Rebuilding pool factIds...")

    pool_fact_map = defaultdict(list)
    for fact in facts_list:
        pool_id = fact.get('answerTypePoolId')
        if pool_id:
            pool_fact_map[pool_id].append(fact['id'])

    for pool in deck.get('answerTypePools', []):
        pid = pool['id']
        pool['factIds'] = pool_fact_map.get(pid, [])

    # ============================================================
    # PASS 5: Write output
    # ============================================================
    print(f"\nWriting {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(deck, f, indent=2, ensure_ascii=False)
    print("Done.")

    # ============================================================
    # PASS 6: Report final homogeneity stats
    # ============================================================
    print("\n=== FINAL POOL HOMOGENEITY REPORT ===")
    import re as _re
    all_pools = deck['answerTypePools']
    for pool in sorted(all_pools, key=lambda p: p['id']):
        pool_id = pool['id']
        pool_facts = [f for f in facts_list if f.get('answerTypePoolId') == pool_id]
        answers = [f.get('correctAnswer', '') for f in pool_facts]
        # Strip {N} markers for length check
        clean_answers = [_re.sub(r'\{[^}]+\}', 'N', a) for a in answers]
        lengths = sorted([len(a) for a in clean_answers])
        if not lengths:
            continue
        min_l, max_l = lengths[0], lengths[-1]
        ratio = max_l / max(min_l, 1)
        status = "FAIL" if ratio > 10 or (max_l - min_l) > 40 else "OK"
        print(f"  {status} {pool_id}: n={len(lengths)}, min={min_l}, max={max_l}, ratio={ratio:.1f}x")


if __name__ == '__main__':
    main()
