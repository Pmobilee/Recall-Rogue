# ap_psychology — Expectations

## 1. Intended Scope
Full coverage of all 9 units of the AP Psychology CED (College Board, effective Fall 2020), from biological bases of behavior through social psychology, aligned to the exam's science-of-psychology approach.

## 2. Canonical Source
College Board AP Psychology CED (effective Fall 2020). Units:
- Unit 1: Scientific Foundations of Psychology
- Unit 2: Biological Bases of Behavior
- Unit 3: Sensation and Perception
- Unit 4: Learning
- Unit 5: Cognitive Psychology
- Unit 6: Developmental Psychology
- Unit 7: Motivation, Emotion, and Personality
- Unit 8: Clinical Psychology
- Unit 9: Social Psychology

## 3. Sub-Deck / Chain Theme List
9 sub-decks with thematic names mapping to CED units: The Neural Forge (bio bases), The Mind Palace (cognition/memory), The Sensory Labyrinth (sensation/perception), The Reasoning Chamber (thinking/language), The Growth Spiral (developmental), The Conditioning Pit (learning), The Social Nexus (social psych), The Mask Gallery (personality), The Shadow Ward (clinical/disorders). 9 chain themes match sub-decks.

## 4. Answer Pool Inventory
13 pools:
- `psych_concept_terms` (149 factIds, no synth) — largest; broad conceptual terms
- `researcher_names` (48 factIds, no synth) — named theorists/researchers
- `brain_structures` (37 factIds, no synth) — anatomical names
- `memory_terms` (36 factIds, no synth)
- `sensation_terms` (21 factIds, no synth)
- `social_psych_terms` (21 factIds, no synth)
- `personality_terms` (20 factIds, no synth)
- `dev_stage_names` (17 factIds, no synth)
- `disorder_names` (15 factIds, no synth)
- `neurotransmitter_names` (10 factIds, 9 synth)
- `bracket_numbers` (7 factIds, 12 synth)
- `sleep_stage_terms` (6 factIds, 10 synth)
- `therapy_types` (6 factIds, 11 synth)

## 5. Expected Quality Bar
AP Psychology facts must distinguish named theories and researchers unambiguously; "who proposed X" questions require distractors that are real psychologists (not arbitrary names) to avoid trivial elimination.

## 6. Known Risk Areas
- **`psych_concept_terms` POOL-CONTAM**: 149 facts spanning all 9 CED units — cognitive terms, social terms, conditioning terms, developmental terms are all in one pool. Distractors will freely cross sub-domain boundaries.
- **`researcher_names` POS-TELL**: All options are researcher names (proper nouns, usually two words) — format consistent, but some answers include parenthetical descriptions ("Roger Sperry (hemispheres)") while others do not, creating LENGTH-TELL.
- **`brain_structures` FORMAT inconsistency**: Some correct answers include parenthetical elaborations ("Amygdala (fear/emotion)", "Frontal lobe (planning)") while distractors may not, creating LENGTH-TELL within the pool.
- **`dev_stage_names` POOL-CONTAM**: Prenatal stages (fetal, embryonic) are in the same pool as cognitive stages (sensorimotor, formal operational) — these are semantically distinct stage systems that will contaminate each other as distractors.
- **`neurotransmitter_names` POS-TELL**: ghrelin (a hormone, not strictly a neurotransmitter) is in this pool — potential factual categorization issue.
