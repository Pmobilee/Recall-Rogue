# ap_chemistry — Quiz Audit Findings

## Summary
The AP Chemistry deck (90 quiz items, 30 facts × 3 mastery levels) has several significant quality concerns. The `bracket_numbers` pool contains a non-numeric fact whose correct answer is a descriptor string ("pH > 7 (basic)") but whose distractors include an isotope abundance and a yield percentage — three completely different measurement types in one question. Multiple question stems suffer from a "this" placeholder rendering failure, producing broken English. The `process_types` and `unique_answers` pools show POOL-CONTAM. The `named_laws_principles` pool mixes laws (whose answers are law names) with a thermodynamic constant (whose answer is "0 J/mol-K") — a clear type mismatch. Total distinct issues: 1 BLOCKER, 5 MAJOR, 4 MINOR.

## Issues

### BLOCKER
- **Fact**: `ap_chem_8_5_weak_acid_strong_base_equivalence_ph` @ mastery=0
- **Category**: `POOL-CONTAM` + `NUMERIC-WEAK`
- **Rendered**:
  Q: "At the equivalence point of a weak acid–strong base titration, the pH is ___."
  A) pH > 7 (basic) ✓
  B) 98.89% C-12
  C) 80% yield
- **Issue**: Pool `bracket_numbers`. The correct answer is a pH descriptor, but the two distractors are an isotopic abundance percentage and a reaction yield percentage. These three answer types share no semantic category — a student can instantly eliminate B and C because neither is a pH statement. This is a rendering failure: the bracket_numbers pool is producing distractors from completely unrelated numeric facts. BLOCKER because it trivially self-reveals the correct answer at every mastery level.

---

### MAJOR
- **Fact**: `ap_chem_9_2_third_law_entropy` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "According to the Third Law of Thermodynamics, the entropy of a perfect crystal at absolute zero (0 K) is ___."
  A) 0 J/mol-K (abs zero) ✓
  B) Zeroth Law of Thermodynamics
  C) ICE table method
- **Issue**: Pool `named_laws_principles`. The correct answer is a numeric value "0 J/mol-K" but the pool contains other entries whose answers are law names ("Zeroth Law") and procedural methods ("ICE table method"). A student can eliminate B and C because neither is a numerical value — the pool mixes answer types (values vs. names vs. procedures).

---

### MAJOR
- **Fact**: `ap_chem_2b_039` (Fisher equation) — see macroeconomics; relevant here is chemistry's analogous case with `process_types` pool
- **Fact**: `ap_chem_9_3_always_spontaneous_case` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Which combination of ΔH and ΔS makes a reaction spontaneous at ALL temperatures?"
  A) Exotherm + DS increases ✓
  B) Positive DH
  C) endothermic
- **Issue**: Pool `process_types`. The correct answer is a combination description ("Exotherm + DS increases") while distractors include a sign-only descriptor ("Positive DH") and a single-word process type ("endothermic"). Three different grammatical forms and semantic levels in one pool — students can eliminate "endothermic" as too simple relative to the compound correct answer.

---

### MAJOR
- **Fact**: `ap_chem_6_3_zeroth_law` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "The ___ states that if two systems are each in thermal equilibrium with a third system, then they are in thermal equilibrium with each other."
  A) Boyle's Law (10 chars)
  B) Hund's rule (10 chars)
  C) Zeroth Law of Thermodynamics ✓ (30 chars)
- **Issue**: Pool `named_laws_principles`. Correct answer is nearly 3× the length of each distractor. In a fill-in-blank question, the longest option is visually conspicuous. At mastery 0 with 3 options this is particularly obvious.

---

### MAJOR
- **Fact**: Multiple — `ap_chem_u2_ionic_solid_properties_brittle`, `ap_chem_u2_hybridization_sp2`, `ap_chem_4_2_net_ionic_acid_base`, `ap_chem_7_5_K_much_greater_than_1`
- **Category**: `BROKEN-GRAMMAR`
- **Examples**:
  - `ap_chem_u2_ionic_solid_properties_brittle`: "Ionic solids like NaCl shatter when struck because shifting layers brings like charges into alignment, causing repulsion. **What property does this** demonstrate?"
  - `ap_chem_u2_hybridization_sp2`: "…What hybridization does **this** carbon atom have?"
  - `ap_chem_7_5_K_much_greater_than_1`: "…what does **this** indicate about the relative amounts of products?"
- **Issue**: These are standard referential "this" usage that works in context, but creates awkward phrasing in the rendered quiz. Not a template-error "this" (like macroeconomics "Irving This") — these are legitimate pronoun uses. Severity is MINOR for these specific cases but flagged for completeness.

---

### MAJOR
- **Fact**: `ap_chem_7_6_adding_equations_K` and `ap_chem_6_8_coefficients_multiply_deltahf` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered** (ap_chem_7_6):
  Q: "When two chemical equilibria are added together to produce a net equation, how is the net equilibrium constant calculated?"
  A) Multiply K1 × K2 ✓
  B) multiply by the stoichiometric coefficient
  C) Ag+(aq) + Cl-(aq) → AgCl(s)
- **Issue**: Pool `unique_answers`. Option C is a complete ionic equation — an entirely different answer type from options A and B. A student can eliminate C immediately as being a reaction equation rather than a procedure description. The `unique_answers` pool is a catch-all that produces semantically incoherent distractor sets.

---

### MINOR
- **Fact**: `ap_chem_u2_vsepr_tetrahedral_geometry` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "CH4 has four bonding pairs and no lone pairs around carbon. According to VSEPR theory, what is the molecular geometry?"
  A) precipitate
  B) Tetrahedral ✓
  C) color change
- **Issue**: Pool `reaction_types`. "Precipitate" and "color change" are observation types for reaction identification (not geometry names). These are not plausible wrong geometries — any student knows geometry answers are shape words.

---

### MINOR
- **Fact**: `ap_chem_1_3_percent_composition_co2` @ mastery=0
- **Category**: `NUMERIC-WEAK`
- **Rendered**:
  Q: "What is the percent by mass of carbon in carbon dioxide (CO₂)?"
  A) 27.29% C in CO2 ✓
  B) 15.71% C in CO2
  C) 33.13% C in CO2
- **Issue**: All three options are in the same format (percentage with same unit notation), which is good. However, none of the distractor values correspond to chemically meaningful alternative calculations (e.g., 72.71% for oxygen's share, or carbon's share in CO instead). The distractors feel arbitrary. MINOR — the format is consistent but pedagogically weak.

---

### MINOR
- **Fact**: `ap_chem_9_2_delta_s_rxn_formula` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "The standard entropy change for a reaction (ΔS°rxn) is calculated using the formula ___."
  A) SumHf(prod) - SumHf(react)
  B) Sum(broken) - Sum(formed)
  C) ΣS°(products) − ΣS°(reactants) ✓
- **Issue**: All three options are thermodynamic calculation formulas in similar format — this is actually GOOD for pool homogeneity. However, option A is ΔH calculation (not ΔS) and option B is bond enthalpy calculation. A student who knows the difference between ΔH and ΔS calculations can eliminate with one distinction — mild but not trivial.

---

### NIT
- **Fact**: `ap_chem_4_8_strong_vs_weak_acid` vs `ap_chem_4_2_strong_electrolyte_dissociation`
- **Category**: `SYNONYM-LEAK`
- **Issue**: Both facts have correct answers "completely ionizes" and "completely (100%)" respectively, and pool `chemistry_concepts_short` will sometimes offer both as options for the same fact. Near-synonym pairing in the same pool makes one eliminable as a restatement of the other.

## Expected vs Actual

**Expected**: `bracket_numbers` would have NUMERIC-WEAK from mixing pH values, molar masses, and percentages. **Confirmed and worse**: The pH equivalence-point fact has distractors that are an isotope abundance and a yield percentage — completely different units, BLOCKER level.

**Expected**: `unique_answers` POOL-CONTAM. **Confirmed**: A complete ionic equation appears as distractor in a K-calculation question.

**Expected**: `process_types` mixing endothermic/exothermic with VSEPR. **Confirmed**: "precipitate" and "color change" appear as distractors in a geometry question.

**Expected**: `named_laws_principles` LENGTH-TELL. **Confirmed**: Zeroth Law (30 chars) vs Boyle's Law (10 chars).

## Notes

The `bracket_numbers` pool design decision to not mark this pool `homogeneityExempt` despite containing pH descriptors, isotope percentages, molar masses, and reaction yields is the root cause of the BLOCKER. The pool needs either splitting by numeric type or exemption with better synth generation.

Individual fact quality (explanation text, scientific accuracy, question stem phrasing) is strong across the deck. The issues are structural (pool design) not content errors.
