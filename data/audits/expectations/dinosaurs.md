# dinosaurs — Expectations

## 1. Intended Scope
40 species of dinosaurs and prehistoric life across 230 million years. Species identity from illustrations (image quiz), geological periods, body size measurements, discoverers/paleontologists, and miscellaneous concepts (extinction, fossil sites, true/false myths).

## 2. Canonical Source
Wikipedia cited for all species facts. Paleontology is relatively stable scientifically, but "first/largest/heaviest" superlative claims are regularly revised as new specimens are discovered (FACTUAL-SUSPECT risk). The feathered dinosaur revolution and Spinosaurus length revisions are noted examples.

## 3. Sub-Deck / Chain Theme List
Sub-decks: NONE defined (subDecks array empty).
Chain themes: NONE defined (chainThemes array empty; chainThemeId values are numeric 0–6).

## 4. Answer Pool Inventory
6 pools total:
- `dinosaur_names`: 97 facts — large, OK; image quiz facts and text quiz facts share this pool (POOL-CONTAM risk between visual and text)
- `geological_periods`: 34 facts — OK; all similar format ("Late Cretaceous" etc.)
- `bracket_numbers`: 33 facts — OK; all numeric measurements
- `paleontologist_names`: 9 facts + 13 synth = 22 — OK
- `misc_concepts_short`: 6 facts + 17 synth = 23 — CRITICAL POOL-CONTAM: this pool mixes "False" (boolean), "China" (geography), "Teeth" (anatomy), and "Sue" (fossil name) — these appear as distractors for each other, which is incoherent
- `misc_concepts_long`: 8 facts + 17 synth = 25 — similar heterogeneity risk with date ranges and factual sentences

## 5. Expected Quality Bar
Casual knowledge deck targeting general audiences. Less demanding than medical decks, but image quiz facts must be in visually-separate pools, and boolean questions must not share a pool with geographic or anatomical answers.

## 6. Risk Areas
1. **POOL-CONTAM in misc_concepts_short**: The pool mixes incompatible answer types: boolean ("False"), geographic ("China"), fossil names ("Sue"), and anatomical terms ("Teeth", "Fish"). These appear as distractors for each other creating absurd quiz states.
2. **POOL-CONTAM in misc_concepts_long**: Date ranges (e.g. "252–201", "201–145") appear in the same pool as animal names ("Giraffe", "Monitor lizard") and behavioral descriptions ("Live young"). The quiz renders distractors like "Giraffe" for "When did the Jurassic period occur?" questions.
3. **IMAGE-QUIZ / POOL-CONTAM**: Image quiz facts (dino_img_*) share the `dinosaur_names` pool with text facts. This may cause image_answers facts to compete against text-only name facts where the image context is required to distinguish.
4. **FACTUAL-SUSPECT**: Spinosaurus length is given as 14 m but current estimates (Ibrahim et al. 2020) suggest 14–15 m; the T. rex bite force in the explanation (12,000 pounds) is the Meers 2002 estimate, since revised to ~8,000 lbs by Bates & Falkingham 2012. These are "may be outdated" not "certainly wrong."
5. **SELF-ANSWERING**: 3 facts where the answer appears in the question (dino_quetzalcoatlus_name_origin, dino_plesiosaurus_neck_myth "False", dino_richard_owen_nhm "Natural History Museum").
