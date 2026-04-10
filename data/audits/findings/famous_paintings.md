# famous_paintings — Quiz Audit Findings

## Summary
104 facts, 11 pools. This deck has a systemic BLOCKER-class issue: all `image_question` facts render with only 1 option (the correct answer, no distractors) across ALL mastery levels. The engine is not generating distractors for these facts — confirmed across at least 4 image facts in the dump (Wanderer above the Sea of Fog, Calling of Saint Matthew, Mona Lisa, Creation of Adam). This is a rendering failure that makes every image question trivially answered (single option = guaranteed correct). Secondary issues: `bracket_numbers` pool has only 3 facts and 0 synthetics (violates the 5-fact minimum), `museum_names_short` pool uses city names as distractors for museum-name questions, and "Louvre" vs "The Louvre" appear as distinct options in the same quiz rendering.

**Issue counts:** BLOCKER 1 / MAJOR 3 / MINOR 2 / NIT 1

---

## Issues

### BLOCKER

- **Fact**: `paint_ren_mona_lisa_artist` @ mastery=0, 2, 4 (and all image_question facts)
- **Category**: `IMAGE-BROKEN`
- **Rendered** (mastery=0):
  Q: "Who painted this iconic portrait, the most visited artwork in the world?" [image shown]
   A) Leonardo da Vinci  ✓   ← only option presented
- **Rendered** (mastery=2):
   A) Leonardo da Vinci  ✓   ← still only option (requestedDistractorCount=3, but 0 distractors rendered)
- **Rendered** (mastery=4):
   A) Leonardo da Vinci  ✓   ← still only option (requestedDistractorCount=4, but 0 distractors rendered)
- **Issue**: Every `image_question` fact in this deck — including `paint_rom_wanderer_fog_artist`, `paint_bar_calling_st_matthew_artist`, `paint_ren_mona_lisa_artist`, `paint_ren_creation_adam_location` — renders with exactly 1 option: the correct answer. `requestedDistractorCount` is 2–4 but `distractorSources` is empty `[]`. The image facts are using `templateId: "passthrough"` which appears to bypass pool distractor selection. This is a guaranteed-correct quiz at every difficulty level — it is unplayable as a knowledge test.

---

### MAJOR

- **Fact**: pool `bracket_numbers` — 3 facts, 0 synthetics
- **Category**: `OTHER` (pool below minimum floor)
- **Rendered**: Pool members: {37} (Raphael's age at death), {1929} (MoMA founding year), {4} (Scream versions). Total: 3 facts, 0 synthetics.
- **Issue**: Pool violates the 5-fact minimum. Age, year, and count are three incompatible semantic types in one pool — a player who knows the question asks for a count can immediately eliminate the 4-digit year and the 2-digit age. At mastery 0 with only 2 distractors, the player sometimes sees only 3 options across these 3 facts repeatedly, making the pool effectively memorizable after a single pass.

---

- **Fact**: `paint_mov_louvre_most_visited` @ mastery=2–4
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=2):
  Q: "The Winged Victory of Samothrace and the Venus de Milo are both housed in which museum?"
   A) Madrid  ← city name, not a museum
   B) Amsterdam  ← city name, not a museum
   C) The Louvre  ← "The Louvre"
   D) Louvre  ✓  ← "Louvre" (no article)
- **Issue**: Two distinct problems: (1) City names "Madrid", "Amsterdam", "Florence", "Giverny" appear as distractors in a question asking for a museum name — these are not museum names and are trivially eliminable. (2) Both "Louvre" and "The Louvre" appear as options in the same rendering — the correct answer is "Louvre" (without article) but "The Louvre" also appears as a synthetic distractor, creating a duplicate/synonym situation.

---

- **Fact**: `paint_ren_mona_lisa_location` @ mastery=3–4
- **Category**: `SYNONYM-LEAK`
- **Rendered** (mastery=4):
  Q: "In which museum is the Mona Lisa permanently displayed?"
   A) The Louvre  ← "The Louvre" (synthetic distractor)
   B) Prado
   C) Louvre  ✓  ← "Louvre" (correct)
   D) Florence
   E) Giverny
- **Issue**: "The Louvre" and "Louvre" are synonyms appearing as distinct options in the same quiz. A player who knows the answer is the Louvre may mark "The Louvre" as correct, only to be told it's wrong. This is a punishing false negative caused by pool contamination between the fact's correctAnswer ("The Louvre") and a synthetic distractor ("Louvre") that uses the same museum name without the article.

---

### MINOR

- **Fact**: pool `museum_names_short` general contamination
- **Category**: `POOL-CONTAM`
- **Rendered**: Observed distractors across museum questions include "Amsterdam", "Madrid", "Florence", "Giverny" — these are cities or neighborhoods, not museum names.
- **Issue**: The `museum_names_short` pool appears to have been constructed with location names rather than institution names. The correct answer "Louvre" is a museum; the distractor "Amsterdam" is a city. The semantic mismatch makes the correct answer pattern-identifiable as the only institutional noun in the set.

---

- **Fact**: `paint_mov_impasto_technique` @ mastery=4
- **Category**: `SYNTHETIC-WEAK`
- **Rendered** (mastery=4):
  Q: "Which painting technique involves applying paint so thickly that brush/knife strokes are clearly visible?"
   A) Smoke  ← not a painting technique
   B) Outdoors  ← not a painting technique
   C) Impasto  ✓
   D) Sfumato
   E) Pastel
- **Issue**: "Smoke" and "Outdoors" appear as distractors in the `technique_terms_short` pool at mastery 4. These are not painting techniques. They appear to be synthetic distractors that were not adequately domain-filtered. The question asks for a named technique and "Smoke" / "Outdoors" are trivially eliminable.

---

### NIT

- **Fact**: `paint_bar_calling_st_matthew_artist` — broken grammar retained in text context
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**: Q: "Which Baroque artist used a dramatic shaft of light through a dark tavern in this scene of Jesus calling a tax collector?" [image shown]
- **Issue**: "in this scene" — "this" reads as a broken word-replacement artifact (intended word was probably "the"). The question grammatically works without the broken word (readers parse "in this scene" as pointing to the image), but the phrasing is awkward. Since this is an image_question, "this" may have been intended to reference the displayed image — making it acceptable depending on implementation. Flagged as NIT only because the image makes "this scene" parseable.

---

## Expected vs Actual
Expected image distractor failure as the highest risk — confirmed as a BLOCKER. bracket_numbers minimum violation confirmed. museum_names_short contamination confirmed. Louvre/The Louvre synonym collision was a specific risk not anticipated at the pool-design level but confirmed in the dump. The "Smoke" and "Outdoors" synthetic distractors in technique_terms_short were not anticipated.

## Notes
- The BLOCKER (image facts showing 1 option) must be root-caused: either the "passthrough" templateId bypasses pool selection, or image_question facts require a different distractor sourcing mechanism. All 20+ image facts in this deck are affected.
- The museum_names_short pool needs to be rebuilt with actual museum names (Louvre, Uffizi, Rijksmuseum, Prado, Tate Modern, MoMA, etc.) rather than city/location names.
- The "Louvre" vs. "The Louvre" collision should be resolved by standardizing the correctAnswer across all museum facts to include or exclude the article consistently.
- bracket_numbers pool needs at minimum 2 more numeric facts plus synthetic distractors to meet the floor.
