# human_anatomy — Expectations

## 1. Intended Scope
Encyclopedic gross anatomy deck for medical students: all major body systems, clinical anatomy, embryology, regional anatomy, histology, and 129 image-based visual quizzes. Targets USMLE Step 1/2, MCAT, COMLEX, AMC, PLAB.

## 2. Canonical Source
Wikipedia (all sourceUrls point to `en.wikipedia.org`). No Gray's Anatomy, Moore's Clinical Anatomy, or primary textbook cited. This is a risk — medical students expect USMLE-grade accuracy, and Wikipedia alone may introduce edge-case errors in clinical and embryological facts.

## 3. Sub-Deck / Chain Theme List
17 sub-decks: skeletal_system, muscular_system, cardiovascular, nervous_system, digestive_system, respiratory_system, urinary_system, reproductive_system, endocrine_system, lymphatic_immune, special_senses, integumentary, visual_anatomy, clinical_anatomy, embryology, regional_anatomy, histology.
Chain themes: NONE defined (chainThemes array is empty; chainThemeId values are numeric integers, unused).

## 4. Answer Pool Inventory
70 pools total. All pools ≥15 members (with synthetics). Two under-staffed pools:
- `structure_lymphatic`: 9 real facts, 0 synthetics (total=9, below 15-minimum but above hard floor of 5)
- `spine_notation`: 2 real facts, 10 synthetics (total=12; real fact count is dangerously low — only 2 distinct quiz questions possible)

Image pools (visual_*) are correctly separated. All image_answers facts map to visual_* pools; a handful of image_question facts land in non-visual pools (e.g. `structure_endocrine_short`) which is a minor inconsistency.

## 5. Expected Quality Bar
High — this is a medical education deck with exam alignment. Distractors must be clinically plausible, not just lexically similar. Explanations must fully explain the "why" for clinical application. No self-answering is tolerable in a test-prep context.

## 6. Risk Areas
1. **TEMPLATE-MISFIT (placeholder leaks)**: 50+ facts contain "anatomical structure" literally in the question stem — a template placeholder that was not substituted during generation. These produce grammatically broken or nonsensical questions.
2. **SELF-ANSWERING**: 4 non-visual facts have the correct answer verbatim in the question stem (e.g. "What is 'first-pass hepatic metabolism'?").
3. **AMBIGUOUS-Q / ANSWER-MISMATCH**: Several facts have a question asking one thing but an answer giving something different (e.g. ha_musc_119 asks "Which three structures pass through it?" but the answer is "T12"; ha_nerv_120 asks "What happens to prolactin?" but the answer is "Arcuate nucleus").
4. **POOL-CONTAM in structure_cardiac_short**: Pool mixes cardiac structures (Left atrium, Systole, Capillaries) with blood cells (Basophils, Neutrophils, Lymphocytes) — these appear as distractors for each other.
5. **CHAIN THEMES MISSING**: No chain themes are defined for a 2,009-fact knowledge deck, which means the chain/theme system cannot function. This is a structural gap against the deck-quality spec of ≥8 chain themes.
