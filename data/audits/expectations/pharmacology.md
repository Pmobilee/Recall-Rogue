# pharmacology — Expectations

## 1. Intended Scope
101 essential medications for nursing practice: drug classes, mechanisms of action, side effects, nursing considerations, antidotes, and drug interactions. NCLEX-aligned. Covers cardiovascular, anti-infectives, CNS/psychiatric, endocrine/metabolic, GI/respiratory, and OB/women's health.

## 2. Canonical Source
DailyMed (NIH) and Nurseslabs cited in sourceUrl. Both are credible nursing pharmacology references. NCLEX-alignment is claimed but no official NCLEX Detailed Test Plan alignment is verified in the architecture.

## 3. Sub-Deck / Chain Theme List
6 sub-decks: cardiovascular, anti_infectives, cns_psychiatric, endocrine_metabolic, gi_respiratory, ob_womens_health.
Chain themes: NONE defined — chainThemes array empty; chainThemeId values are numeric 0–5.

## 4. Answer Pool Inventory
12 pools total:
- `drug_class_abbrev`: 2 real facts + 11 synthetics = 13 (UNDER 15, and only 2 real members — fluoxetine→SSRI, tamoxifen→SERM)
- `drug_classes`: 99 facts — large, semantically homogeneous
- `mechanisms`: 89 facts — large, may have LENGTH-TELL between short mechanisms and compound-sentence mechanisms
- `side_effects_short`: 30 facts — OK
- `side_effects_long`: 47 facts — OK, but SYNONYM-LEAK risk (see pharm-inf-tmp-smx-sideeffect)
- `indications_short`: 10 facts + 5 synth = 15 — OK
- `indications_long`: 36 facts — OK
- `nursing_interventions_short`: 9 facts + 6 synth = 15 — OK
- `nursing_interventions_long`: 51 facts — OK
- `antidotes_short`: 12 facts + 7 synth = 19 — OK
- `antidotes_long`: 12 facts + 7 synth = 19 — OK
- `interactions`: 8 facts + 7 synth = 15 — OK

## 5. Expected Quality Bar
High — nursing students depend on this for NCLEX. Drug class, mechanism, side effect, and antidote must be factually correct with no ambiguity. Distractors must be clinically plausible but unambiguously wrong for the specific drug.

## 6. Risk Areas
1. **BROKEN-GRAMMAR**: "pharm-cns-oxycodone-nursing" renders as "What is the critical administration instruction for this-release oxycodone?" — a template substitution failure leaving "this-release" instead of "extended-release". Also "pharm-cns-naloxone-sideeffect" has "this-dependent patients".
2. **SYNONYM-LEAK / DUPLICATE-OPT**: pharm-inf-tmp-smx-sideeffect correct answer is "Stevens-Johnson syndrome" but a distractor reads "Rash (may progress to Stevens-Johnson syndrome)" — players can deduce the correct answer by recognizing the distractor contains it.
3. **POOL-CONTAM between drug_classes and mechanisms**: Both pools use sentence-length answers in some cases; wrong-pool assignment risks producing quizzes where mechanism distractors appear for a class question or vice versa.
4. **drug_class_abbrev pool under-staffed**: Only 2 real facts with 11 synthetics. The ratio is inverted from what's desirable — the pool's distractor bank is almost entirely synthetic, meaning almost no real quiz facts drive pool membership.
5. **CHAIN THEMES MISSING**: No chain themes for a 405-fact knowledge deck. Drug-class chains (e.g. "beta blockers", "ACE inhibitors", "opioids") would be natural but are absent.
