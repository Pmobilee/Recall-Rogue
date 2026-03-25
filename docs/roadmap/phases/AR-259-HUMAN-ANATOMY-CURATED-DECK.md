# AR-259: Human Anatomy Curated Deck

**Created 2026-03-25**: New `medical` domain with flagship anatomy deck. Full med school gross anatomy coverage (~800-1000 facts) with Servier Medical Art illustrations (CC-BY 4.0).

## Overview
- **Goal**: Build the definitive human anatomy deck — encyclopedic depth where med students can genuinely study gross anatomy
- **Domain**: `medical`, **subDomain**: `human_anatomy`
- **Scale**: ~800-1000 facts across 12 subdecks (one per body system)
- **Images**: Servier Medical Art (1,143 CC-BY 4.0 illustrations) + Gray's 1918 plates (public domain)
- **Dependencies**: None — curated deck system is fully implemented
- **Complexity**: Very large (image acquisition + content generation + assembly)

---

## Image Sources (CRITICAL — must resolve before generation)

### Primary: Servier Medical Art (SMART)
- **URL**: https://smart.servier.com/category/anatomy-and-the-human-body/
- **License**: CC-BY 4.0 (commercial use OK with attribution to Servier Medical Art)
- **Coverage**: 1,143 anatomy illustrations — cardiovascular (530), locomotor (249), nervous (120), digestive (86), respiratory (37), plus endocrine/reproductive/senses in specialty kits
- **Format**: PNG + PowerPoint vector bundles
- **Storage**: `public/assets/anatomy/{system}/servier/`

### Supplement: Gray's Anatomy 1918
- **URL**: https://commons.wikimedia.org/wiki/Category:Gray's_Anatomy_plates
- **License**: Public domain (copyright expired)
- **Coverage**: 1,247 detailed engravings
- **Storage**: `public/assets/anatomy/{system}/grays/`

### Attribution
- `public/assets/anatomy/ATTRIBUTION.md` must credit Servier Medical Art per CC-BY 4.0
- Gray's plates need no attribution (public domain) but credit is courteous

---

## SubDeck Structure

| # | SubDeck ID | Name | Target | Key Entities |
|---|-----------|------|--------|-------------|
| 1 | `skeletal_system` | Skeletal System | 80 | Skull bones (frontal, parietal, temporal, occipital, sphenoid, ethmoid), vertebral column (cervical/thoracic/lumbar/sacral), ribs, sternum, clavicle, scapula, humerus, radius, ulna, carpals, metacarpals, phalanges, pelvis (ilium, ischium, pubis), femur, patella, tibia, fibula, tarsals, metatarsals. Bone types (long, short, flat, irregular, sesamoid). Joint types (synovial, fibrous, cartilaginous). Bone landmarks (process, fossa, foramen, condyle, epicondyle). |
| 2 | `muscular_system` | Muscular System | 80 | Major muscles by region: head/neck (masseter, sternocleidomastoid, trapezius), shoulder (deltoid, rotator cuff), arm (biceps brachii, triceps brachii, brachialis), forearm (flexor/extensor groups), trunk (pectoralis major, latissimus dorsi, rectus abdominis, external oblique, erector spinae, diaphragm), hip (iliopsoas, gluteus maximus/medius/minimus), thigh (quadriceps, hamstrings, adductors), leg (gastrocnemius, soleus, tibialis anterior). Muscle types (skeletal, smooth, cardiac). Origin/insertion/action format. |
| 3 | `cardiovascular` | Cardiovascular System | 70 | Heart (4 chambers, 4 valves, coronary arteries, conduction system: SA node/AV node/Bundle of His/Purkinje fibers). Major arteries (aorta, carotid, subclavian, brachial, radial, ulnar, femoral, popliteal, tibial). Major veins (vena cava, jugular, subclavian, brachial, femoral, great saphenous). Cardiac cycle, blood pressure, pulmonary vs systemic circulation. Blood types, RBC/WBC/platelets. |
| 4 | `nervous_system` | Nervous System | 80 | Brain regions (cerebrum lobes, cerebellum, brainstem, diencephalon: thalamus/hypothalamus). 12 cranial nerves (I-XII with names, functions, mnemonics). Spinal cord (31 pairs of spinal nerves, dermatomes, reflex arcs). Autonomic NS (sympathetic vs parasympathetic). Brachial plexus (roots, trunks, divisions, cords, terminal branches). Key nerves (sciatic, median, ulnar, radial, femoral, vagus). Meninges (dura, arachnoid, pia). |
| 5 | `digestive_system` | Digestive System | 60 | GI tract (mouth, pharynx, esophagus, stomach, small intestine: duodenum/jejunum/ileum, large intestine: cecum/ascending/transverse/descending/sigmoid colon, rectum, anus). Accessory organs (liver, gallbladder, pancreas, salivary glands). Enzymes (amylase, pepsin, trypsin, lipase, lactase). Peritoneum (mesentery, omentum). Sphincters (cardiac, pyloric, ileocecal, anal). |
| 6 | `respiratory_system` | Respiratory System | 50 | Airways (nasal cavity, pharynx, larynx, trachea, bronchi, bronchioles, alveoli). Lungs (lobes: R=3, L=2, pleura, hilum). Diaphragm mechanics. Gas exchange (O2/CO2, partial pressures). Lung volumes (tidal, residual, vital capacity, total lung capacity). Muscles of respiration. |
| 7 | `urinary_system` | Urinary System | 40 | Kidneys (cortex, medulla, nephron: glomerulus/Bowman's capsule/PCT/loop of Henle/DCT/collecting duct). Ureters, bladder, urethra. Filtration, reabsorption, secretion. Electrolyte balance (Na+, K+, Ca2+). Renin-angiotensin-aldosterone system. |
| 8 | `reproductive_system` | Reproductive System | 50 | Male (testes, epididymis, vas deferens, seminal vesicles, prostate, penis). Female (ovaries, fallopian tubes, uterus, cervix, vagina, vulva). Hormones (testosterone, estrogen, progesterone, FSH, LH, hCG). Menstrual cycle phases. Spermatogenesis/oogenesis basics. Embryology (zygote, blastocyst, implantation, placenta). |
| 9 | `endocrine_system` | Endocrine System | 50 | Glands (hypothalamus, pituitary: anterior/posterior, thyroid, parathyroid, adrenal: cortex/medulla, pancreatic islets, pineal, thymus). Hormones and targets (insulin/glucagon, T3/T4/TSH, cortisol/aldosterone, epinephrine, GH, ADH, oxytocin). Feedback loops (negative/positive). |
| 10 | `lymphatic_immune` | Lymphatic & Immune | 40 | Lymph nodes, lymphatic vessels, spleen, thymus, tonsils. Immune cells (T cells, B cells, macrophages, neutrophils, NK cells, dendritic cells). Antibodies (IgG, IgA, IgM, IgE, IgD). Innate vs adaptive immunity. Inflammation response. |
| 11 | `special_senses` | Special Senses | 50 | Eye (cornea, iris, pupil, lens, retina: rods/cones, optic nerve, vitreous/aqueous humor). Ear (outer: pinna/canal, middle: ossicles, inner: cochlea/semicircular canals, vestibule). Taste (5 basic tastes, taste buds, papillae). Smell (olfactory epithelium, olfactory bulb). Touch (Meissner's, Pacinian, Merkel, Ruffini corpuscles). |
| 12 | `integumentary` | Integumentary System | 30 | Skin layers (epidermis: strata, dermis: papillary/reticular, hypodermis). Hair (follicle, shaft, arrector pili). Nails. Glands (sebaceous, eccrine sweat, apocrine sweat). Melanocytes, keratinocytes. Wound healing phases. Burns (1st/2nd/3rd degree). |

---

## Answer Type Pools

| Pool ID | Format | Est. Members | Example |
|---------|--------|-------------|---------|
| `structure_names` | name | 200+ | femur, biceps brachii, hippocampus |
| `location_terms` | term | 20+ | anterior, posterior, medial, lateral, proximal, distal, superficial, deep |
| `function_terms` | term | 50+ | flexion, extension, abduction, adduction, filtration, secretion |
| `system_names` | term | 12 | skeletal, muscular, cardiovascular, nervous... |
| `nerve_names` | name | 30+ | vagus, sciatic, median, facial, optic |
| `vessel_names` | name | 40+ | aorta, femoral artery, jugular vein, great saphenous |
| `hormone_names` | name | 25+ | insulin, cortisol, T4, estrogen, oxytocin |
| `bone_names` | name | 80+ | femur, humerus, scapula, temporal, C1 atlas |
| `muscle_names` | name | 80+ | biceps brachii, deltoid, diaphragm, gluteus maximus |
| `organ_names` | name | 30+ | liver, kidney, heart, lung, spleen, thymus |

---

## Sub-Steps

### 1. Image Acquisition
- [ ] Download Servier SMART anatomy image kits (PowerPoint bundles by system)
- [ ] Download relevant Gray's 1918 plates from Wikimedia Commons
- [ ] Organize into `public/assets/anatomy/{system}/`
- [ ] Build image manifest JSON mapping structure names to file paths
- [ ] Create `ATTRIBUTION.md` with CC-BY 4.0 credit for Servier

### 2. Architecture YAML
- [ ] Create `data/deck-architectures/human_anatomy_arch.yaml`
- [ ] Research entity lists per system from Wikipedia (bones, muscles, nerves, vessels, organs)
- [ ] Populate YAML with verified source data per entity

### 3. Fact Generation (12 subdecks)
- [ ] Skeletal System (80 facts)
- [ ] Muscular System (80 facts)
- [ ] Cardiovascular (70 facts)
- [ ] Nervous System (80 facts)
- [ ] Digestive System (60 facts)
- [ ] Respiratory System (50 facts)
- [ ] Urinary System (40 facts)
- [ ] Reproductive System (50 facts)
- [ ] Endocrine System (50 facts)
- [ ] Lymphatic & Immune (40 facts)
- [ ] Special Senses (50 facts)
- [ ] Integumentary (30 facts)

### 4. Assembly & Verification
- [ ] Merge into `data/decks/human_anatomy.json`
- [ ] Add to manifest
- [ ] Wikipedia verification pass (50+ fact sample)
- [ ] OpenStax cross-reference for medical accuracy
- [ ] Visual verify in Study Temple

---

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] 700+ facts assembled
- [ ] 12 subdecks all populated
- [ ] Image manifest covers 80%+ of structures
- [ ] Wikipedia verification: <5% error rate
- [ ] Study Temple loads deck and all subdecks
