# human_anatomy — Quiz Audit Findings

## Summary
70 unique facts sampled across 210 quiz dump entries (3 mastery levels each). Deck has 2,009 facts and 70 pools. The dominant issue is a systemic TEMPLATE-MISFIT: 50+ question stems contain the literal string "anatomical structure" where a specific anatomical name should have been substituted during generation — these are broken at the source JSON level. A secondary POOL-CONTAM issue exists in `structure_cardiac_short` where blood cells appear alongside cardiac structures. Image quiz facts (image_answers mode) correctly separate into visual_* pools. 4 non-visual SELF-ANSWERING facts found. 2 AMBIGUOUS-Q facts where the question and answer do not correspond. No chain themes defined — structural gap for a knowledge deck.

Severity breakdown: 2 BLOCKER, 8 MAJOR, 4 MINOR, 2 NIT.

---

## Issues

### BLOCKER

---

- **Fact**: `ha_nerv_120` @ mastery=0
- **Category**: `TEMPLATE-MISFIT` + `AMBIGUOUS-Q`
- **Rendered**:
  Q: "the anatomical structure nucleus of the hypothalamus sends dopamine via the tuberoinfundibular pathway to inhibit prolactin release from the anterior pituitary. It also produces pulsatile GnRH. What happens to prolactin when a dopamine antagonist (e.g., antipsychotic) blocks this pathway?"
   A) Lateral hypothalamus
   B) absolute refractory period
   C) Arcuate nucleus (dopamine, GnRH) ✓
- **Issue**: Two distinct bugs on one fact: (1) "anatomical structure" placeholder was not substituted — the question reads as a sentence fragment; (2) The question asks "What happens to prolactin?" but the answer is "Arcuate nucleus (dopamine, GnRH)" — a structure name, not a prolactin effect.

---

- **Fact**: `ha_musc_119` @ mastery=0
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "The most inferior diaphragmatic opening, at T12, forms the aortic hiatus. Which three structures pass through it?"
   A) C5-C6
   B) L5
   C) T12 ✓
- **Issue**: Question asks "Which three structures pass through it?" but the correct answer is "T12" — a vertebral level, not a list of structures. The answer does not answer the question. This is a wrong-answer-stored-in-fact bug.

---

### MAJOR

---

- **Fact**: `ha_cardio_109` @ mastery=4
- **Category**: `TEMPLATE-MISFIT`
- **Rendered**:
  Q: "Which autosomal dominant connective tissue disorder, caused by a mutation in the anatomical structure gene encoding fibrillin-1 on chromosome 15, predisposes to ascending aortic aneurysm, aortic dissection, aortic regurgitation, and ectopia lentis?"
   A) Crescentic GN: crescents in Bowman's capsule
   B) Fetal alcohol syndrome
   C) Oligohydramnios → pulmonary hypoplasia + limb deformities
   D) Head tilts toward affected side; chin away
   E) Marfan syndrome: FBN1 mutation (chromosome 15) ✓
- **Issue**: "the anatomical structure gene" should read "the FBN1 gene" — the placeholder was not replaced. Confuses students with broken grammar in a high-yield USMLE fact.

---

- **Fact**: `ha_cardio_044` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "In the systemic circulation, arterioles lead to microscopic vessels where gas and nutrient exchange occurs between blood and tissues. What are these exchange vessels called?"
   A) Capillaries ✓
   B) Systole
   C) Left atrium
   D) Basophils
   E) Chordae tendineae
- **Issue**: "Basophils" is a white blood cell, not a cardiac/vascular structure. It appears because `structure_cardiac_short` pool incorrectly includes blood cell facts (Basophils, Neutrophils, Lymphocytes) alongside vascular structures (Capillaries, Systole, Chordae tendineae). Players can eliminate Basophils instantly.

---

- **Fact**: `ha_histo_066` @ mastery=4
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "Osteoclasts are the bone-resorbing cells. What are their key histological features and what signaling molecule activates them?"
   A) Loose connective tissue
   B) Dense irregular connective tissue
   C) Regulatory T cells (Tregs)
   D) Trisomy 18 (Edwards syndrome)
   E) Osteoclast (multinucleated) ✓
- **Issue**: Question asks for key histological features AND the activating signaling molecule. The answer "Osteoclast (multinucleated)" gives only the cell type with one feature — it does not name the signaling molecule (RANKL) the question explicitly requests. Partial answer stored as complete answer.

---

- **Fact**: `ha_clinical_049` @ mastery=4
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "What is the primary biomechanical function of the anterior cruciate ligament, which resists forward displacement of the tibia relative to the femur?"
   A) Carotid bifurcation
   B) Meissner's corpuscles
   C) Axillary lymph nodes (~75%)
   D) Anterior cruciate ligament (ACL)
   E) ACL (anterior tibial translation) ✓
- **Issue**: Question defines the answer within itself ("resists forward displacement of the tibia") and then asks for the function. The correct answer "ACL (anterior tibial translation)" is the structure name, not a description of its function. Self-referential and partially self-answering.

---

- **Fact**: `ha_clinical_075` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "On a normal chest X-ray, what is the expected relationship between the left and right hilar heights?"
   A) Left hilum higher than right (97%) ✓
   B) 1/3 of the way from the ASIS to the umbilicus
   C) Lateral to the inferior epigastric vessels
   D) Zone 3 most susceptible; zone 1 most resistant to ischaemia
   E) Thymic cortex (positive selection)
- **Issue**: `location_terms` pool mixes hilar height (radiology), ASIS distances (surface anatomy), vascular landmarks, zonation (liver/lung), and immunology sites — all incompatible semantic types. Distractors are eliminatable because they describe entirely different anatomical domains.

---

- **Fact**: `ha_digest_042` @ mastery=0 (non-visual)
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What is 'first-pass hepatic metabolism'?"
   [answer: first-pass hepatic metabolism]
- **Issue**: The term being defined appears verbatim and entirely in quotes within the question. No knowledge needed — the answer is literally stated in the question.

---

- **Fact**: `ha_integ_010` @ mastery=0 (non-visual)
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Which skin layer — lying between the epidermis above and the hypodermis below — ..."
   [answer: dermis]
- **Issue**: The question describes the dermis so specifically (position between epidermis and hypodermis) that any anatomy student can answer without any knowledge of the term "dermis" itself.

---

- **Fact**: `ha_histo_029` @ mastery=0 (non-visual)
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What key structural feature distinguishes pseudostratified epithelium from truly..."
   [answer: pseudostratified epithelium]
- **Issue**: Answer name appears verbatim in the question stem.

---

### MINOR

---

- **Fact**: `ha_visual_030` @ mastery=4
- **Category**: `QUIZMODE-WRONG`
- **Rendered**:
  Q: "Identify this endocrine gland."
   A) Thyroid gland ✓
- **Issue**: This is an `image_question` fact but the pool is `structure_endocrine_short` (a non-visual pool). At mastery=4 this produces only 1 option visible in quiz dump — no text distractors are available because the visual_endocrine pools have the other image facts and the text pool is not providing distractors. Only 1 option rendered.

---

- **Fact**: `ha_clinical_068` @ mastery=0 (non-visual)
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "Lumbar puncture is performed safely below the conus medullaris. In adults, the preferred interspace is..."
   [answer: L3–L4]
- **Issue**: The question describes the procedure and mentions safety constraints that uniquely identify L3–L4. Clinically obvious to any student who knows basic LP technique.

---

- **Fact**: `ha_digest_029` @ mastery=4
- **Category**: `TEMPLATE-MISFIT`
- **Rendered**:
  Q: "Which peritoneal structure hangs like a 'fatty apron' from the anatomical structure curvature of the stomach over the small intestine, and helps contain abdominal infections?"
   [answer: Greater omentum]
- **Issue**: "anatomical structure curvature" should be "greater curvature" — placeholder not replaced. Question is answerable but confusing.

---

- **Fact**: `spine_notation` pool
- **Category**: `NUMERIC-WEAK`
- **Rendered** (ha_musc_119): Only 2 real facts in the pool with 10 synthetics. All synthetics are spinal level codes (C5-C6, L4, L5, T2-T3, etc.). At mastery=0 only 3 options total appear, leaving no meaningful distractor variety. A student who knows spinal anatomy can eliminate instantly.

---

### NIT

---

- **Fact**: `ha_cardio_084` @ mastery=any
- **Category**: `TEMPLATE-MISFIT`
- **Rendered**:
  Q: "the anatomical structure venosus shunts oxygenated umbilical blood past the fetal liver into the IVC..."
- **Issue**: Question starts lowercase "the anatomical structure venosus" — two problems: placeholder not replaced AND sentence starts lowercase. Minor readability issue given the question is still answerable (answer is "Ductus venosus → ligamentum venosum").

---

- **Fact**: `ha_visual_105` @ mastery=4
- **Category**: `QUIZMODE-WRONG`
- **Rendered**:
  Q: "What bony structure protects the thoracic organs shown here?"
   A) Rib cage ✓
- **Issue**: image_question fact but only 1 option visible in dump at mastery=4. May indicate pool `visual_skeletal_short` does not have enough members to fill a 5-option quiz at this mastery level for image questions.

---

## Expected vs Actual

Expected: High-fidelity medical quiz with clinically plausible distractors, clean question stems, and zero self-answering.

Actual: 50+ template placeholder leaks ("anatomical structure") that render questions grammatically broken or factually incomplete. 4 non-visual self-answering facts. 2 answer-question mismatches (ha_musc_119, ha_nerv_120). POOL-CONTAM in structure_cardiac_short (blood cells among cardiac structures) and location_terms (mixed anatomical domains). No chain themes defined for a 2,009-fact deck.

---

## Notes

- The 50 "anatomical structure" placeholder leaks were not all sampled in the 70-fact quiz dump — most are in the full 2,009-fact corpus. The 3 that appeared in the dump (ha_nerv_120, ha_cardio_109, ha_digest_029) are sufficient to confirm this is a systemic batch-generation defect affecting an estimated 50+ facts.
- Visual quiz facts (image_answers mode) rendering with 1 option is expected behavior when the image is the differentiator — this is not a bug for `_img_ans` facts.
- Chain themes being absent is an architecture gap, not a quiz rendering bug, but it means the themed-chain system cannot function for this deck.
- `structure_lymphatic` pool has 9 members and 0 synthetics — just above the hard floor of 5 but below the 15-target. Not a blocker but worth padding.
