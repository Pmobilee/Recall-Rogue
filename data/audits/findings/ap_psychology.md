# ap_psychology — Quiz Audit Findings

## Summary
The AP Psychology deck (90 quiz items, 30 facts × 3 mastery levels) is structurally sound with well-written question stems. No BLOCKERs. The primary concerns are: (1) the massive `psych_concept_terms` pool (149 facts) produces predictable cross-domain contamination across all 9 CED units; (2) the `brain_structures` pool mixes answers with and without parenthetical elaborations ("Amygdala (fear/emotion)" vs plain names), creating inconsistent answer formats; (3) the `dev_stage_names` pool conflates prenatal developmental stages with cognitive developmental stages (Piaget) — semantically distinct stage systems that contaminate each other. The `neurotransmitter_names` pool includes ghrelin (a gut hormone) raising a potential factual categorization concern. Total distinct issues: 0 BLOCKER, 3 MAJOR, 4 MINOR.

## Issues

### MAJOR
- **Fact**: `ap_psych_brain_amygdala` @ mastery=0,2,4
- **Category**: `POOL-CONTAM` + `LENGTH-TELL`
- **Rendered**:
  Q: "Which almond-shaped limbic structure processes fear responses and emotional memories, and triggers the fight-or-flight response?"
  A) Amygdala (fear/emotion) ✓ (22 chars)
  B) Wernicke's area (16 chars)
  C) Interneurons (CNS relay) (25 chars)
- **Issue**: Pool `brain_structures`. The correct answer "Amygdala (fear/emotion)" follows the pattern "Name (function)", while "Wernicke's area" is a plain name without parenthetical. The inconsistent format makes parenthetical-answer options slightly longer on average. More critically: "Interneurons (CNS relay)" is not a brain structure in the same anatomical sense as the amygdala or Wernicke's area — interneurons are a cell type, not a discrete brain region. This is POOL-CONTAM between brain structures and neural cell types.

---

### MAJOR
- **Fact**: `ap_psych_dev_prenatal_fetal` @ mastery=0,2,4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Which prenatal stage begins at week 9 and continues until birth, during which the fetus develops organs and grows?"
  A) Fetal stage (week 9+) ✓
  B) Puberty (adolescent growth)
  C) Formal operational
- **Issue**: Pool `dev_stage_names`. The correct answer is a prenatal stage, distractor B is a post-birth adolescent developmental milestone, and distractor C is a Piagetian cognitive stage. Three completely different developmental stage systems (prenatal biology, physical maturation, cognitive development) share one pool. At mastery 0 with only 3 options, a student can eliminate "Puberty" and "Formal operational" as non-prenatal stages without knowing anything about the fetal period specifically.

---

### MAJOR
- **Fact**: Multiple in `psych_concept_terms` pool @ mastery=0
- **Category**: `POOL-CONTAM`
- **Examples**:
  - `ap_psych_dev_object_permanence`: correct="Object permanence" with distractor "Teratogen (prenatal harm)" — cognitive development fact with prenatal distractor
  - `ap_psych_thinking_algorithm`: correct="Algorithm (step-by-step)" with distractor "Teratogen (prenatal harm)" and "Shaping (successive approx)" — cognition fact with prenatal and conditioning distractors
  - `ap_psych_reflex_arc`: correct="Reflex arc (spinal loop)" with distractor "Strange Situation" — neuroscience fact with social development concept as distractor
  - `ap_psych_oc_fixed_interval`: correct="Fixed-interval schedule" with distractor "CT scan (brain imaging)" — operant conditioning fact with brain imaging concept as distractor
- **Issue**: The `psych_concept_terms` pool (149 facts) spans all 9 CED units. At mastery 0, students receive 2 distractors that are frequently from different CED units than the correct answer. Any student who knows broad psychological subdomain categories (e.g., "operant conditioning concepts vs. brain imaging concepts") can eliminate cross-unit distractors without knowing the specific answer. This is the most pervasive structural issue in the deck.

---

### MINOR
- **Fact**: `ap_psych_motiv_ghrelin` @ mastery=0
- **Category**: `OTHER` (potential pool misassignment)
- **Rendered**:
  Q: "Which hormone, secreted primarily by the stomach when it is empty, rises before meals and signals the brain to increase appetite?"
  A) Serotonin
  B) GABA (inhibitory) ✓? No — correct is "Ghrelin"
  A) Serotonin
  B) GABA (inhibitory)
  C) Ghrelin ✓
- **Issue**: Pool `neurotransmitter_names`. Ghrelin is a peptide hormone secreted by the stomach, not a classical neurotransmitter. Placing it in `neurotransmitter_names` alongside serotonin and GABA is a categorical misassignment. A student who knows ghrelin is a hormone (not a neurotransmitter) would correctly identify it is misplaced in this pool — but might doubt their answer. Pedantically, ghrelin does act on hypothalamic neurons and has neurotransmitter-like effects, but it is not classified as a neurotransmitter in AP Psychology curricula. MINOR factual concern.

---

### MINOR
- **Fact**: `ap_psych_brain_split_brain_sperry` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "Which neuroscientist won the 1981 Nobel Prize in Physiology or Medicine for split-brain research showing lateralized functions of the two hemispheres?"
  A) Francis Galton (14 chars)
  B) Roger Sperry (hemispheres) ✓ (26 chars)
  C) Henry Molaison (15 chars)
- **Issue**: Pool `researcher_names`. The correct answer includes a parenthetical descriptor "(hemispheres)" while the two distractors are plain names. At mastery 0 with only 3 options, the length disparity (26 vs 14-15 chars) makes the parenthetical option visually distinct. The inconsistent format is the source. Not severe since "(hemispheres)" is thematically consistent with the question about hemispheres, but the extra information creates a tell.

---

### MINOR
- **Fact**: `ap_psych_soc_cannon_bard_theory` @ mastery=2,4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Which theory of emotion proposes that a stimulus simultaneously triggers BOTH physiological arousal AND the conscious emotion?"
  A) Private speech (self-talk)
  B) Cannon-Bard theory ✓
  C) Self-actualization
  D) Adoption studies (nature/nurture)  [at mastery 2+]
- **Issue**: Pool `psych_concept_terms`. "Adoption studies" is a methodology term, not an emotion theory. "Private speech" is a Vygotsky cognitive development concept. "Self-actualization" is Maslow's motivation concept. Three different sub-domains appearing as distractors in an emotion theory question. Students who know broad sub-domain boundaries can eliminate all three without knowing Cannon-Bard.

---

### MINOR
- **Fact**: `ap_psych_perception_bottom_up_processing` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What type of perceptual processing builds perception from raw sensory data upward — starting with basic features?"
  A) Health psychology
  B) fMRI (brain imaging)
  C) Bottom-up processing ✓
- **Issue**: "Health psychology" is a clinical sub-field (not a perception type) and "fMRI" is a brain imaging technique (not a processing type). Both are trivially eliminable as non-perceptual-processing concepts. This is the `psych_concept_terms` catch-all pool producing cross-unit distractors that don't even attempt semantic relevance to the question.

---

### NIT
- **Fact**: `ap_psych_motiv_lateral_hypothalamus` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Which region of the hypothalamus acts as the brain's 'hunger center' — stimulation of which triggers eating?"
  A) Lateral hypothalamus ✓
  B) Motor cortex (movement)
  C) Thyroid gland
- **Issue**: "Thyroid gland" is an endocrine structure, not a brain region. Pool `brain_structures` mixing brain regions with peripheral endocrine glands. Trivially eliminable for any student who knows the thyroid gland is not in the brain.

## Expected vs Actual

**Expected**: `psych_concept_terms` POOL-CONTAM across 9 CED units. **Confirmed and severe**: Every sampled fact from this pool shows distractors from 2-3 different CED units (conditioning + prenatal + imaging in one question).

**Expected**: `dev_stage_names` mixing prenatal and cognitive stages. **Confirmed**: Piagetian stages (Formal operational) appear as distractors in prenatal biology questions.

**Expected**: `researcher_names` LENGTH-TELL from parenthetical format inconsistency. **Confirmed**: Roger Sperry's answer includes "(hemispheres)" parenthetical making it visibly longer than plain-name distractors.

**Expected**: `neurotransmitter_names` possible ghrelin categorization issue. **Confirmed as minor**: Ghrelin is classified as a hormone, not a neurotransmitter, per standard AP Psychology scope.

## Notes

The question stem quality is consistently high — questions are clearly worded, technically accurate, and appropriately detailed for AP exam preparation. The issues are structural pool design problems, not content errors.

The `researcher_names` pool is an interesting case: even though there's mild LENGTH-TELL from parenthetical answers, the parentheticals ("(hemispheres)", "(GAS)") actually serve as pedagogically useful memory cues, so they may be intentional. Do not remove them — instead standardize format across all researcher answers.
