# ap_physics_1 — Quiz Audit Findings

## Summary
The AP Physics 1 deck (90 quiz items, 30 facts × 3 mastery levels) is one of the better-structured AP decks in this batch. No BLOCKER-level issues. The dominant concern is POOL-CONTAM in the large `concept_statements` pool (123 facts, homogeneityExempt) and `equation_explanations` pool (44 facts, homogeneityExempt), both of which draw distractors across all 8 CED units. The `term_definitions` pool mixes pure definitional answers with condition-statement answers (containing mathematical notation), producing POOL-CONTAM at the format level. The `unit_conversions` pool contains an interesting ambiguity: torque and work share the unit N⋅m, making "Newton-meter (N-m) torque" a partially-correct distractor for the Joule definition question. Zero BROKEN-GRAMMAR issues detected. Total distinct issues: 0 BLOCKER, 3 MAJOR, 4 MINOR.

## Issues

### MAJOR
- **Fact**: `ap_phys1_rotational_equilibrium` @ mastery=0,2,4
- **Category**: `POOL-CONTAM` (format mismatch within pool)
- **Rendered**:
  Q: "What condition must be satisfied for an object to be in rotational equilibrium (no angular acceleration)?"
  A) Rotational equilibrium: Στ = 0 ✓
  B) At the equilibrium position (x = 0)
  C) System (defined objects)
- **Issue**: Pool `term_definitions`. The correct answer is a condition-statement with mathematical notation ("Rotational equilibrium: Στ = 0"), while distractor C is a two-word conceptual label ("System (defined objects)"). These are different answer types: one is a mathematical condition, the other is a vocabulary definition. Students can eliminate C by format — it does not look like a condition statement.

---

### MAJOR
- **Fact**: `ap_phys1_joule_unit` @ mastery=0,2,4
- **Category**: `POOL-CONTAM` (near-correct distractor)
- **Rendered**:
  Q: "What is the SI unit of energy and work, expressed in base SI units?"
  A) kg⋅m/s (same as N⋅s)
  B) Newton-meter (N-m) torque ✓? — Wait: correct is "Joule (J) = kg⋅m²/s² = N⋅m" ✓
  C) Newton-meter (N-m) torque
- **Rendered (actual)**:
  A) kg⋅m/s (same as N⋅s)
  B) Newton-meter (N-m) torque
  C) Joule (J) = kg⋅m²/s² = N⋅m ✓
- **Issue**: Pool `unit_conversions`. Distractor "Newton-meter (N-m) torque" is partially correct — 1 Joule IS 1 N⋅m. The label "torque" distinguishes it (torque uses N⋅m but is not energy in the same sense), but this distinction is subtle enough to confuse students who know J = N⋅m. This is a FACTUALLY-SUSPECT distractor that a careful student might flag as debatable. The parenthetical "(N-m) torque" does signal incorrectness, but the N-m equivalence is real.

---

### MAJOR
- **Fact**: `ap_phys1_parabolic_xt` vs `ap_phys1_impulse_area_Ft` @ mastery=0,4
- **Category**: `POOL-CONTAM`
- **Rendered** (`ap_phys1_parabolic_xt` @ mastery=4):
  Q: "What shape does the position-time (x-t) graph have for an object under constant acceleration?"
  A) Instantaneous velocity (v)
  B) Parabola (constant acceleration) ✓
  C) Straight line (constant velocity)
  D) Impulse = area under F-t graph
  E) Area under F-x graph = work done
- **Issue**: Pool `graph_interpretations`. Options D and E are "area under graph" interpretation facts — completely different question type (area interpretation) appearing as distractors for a graph-shape question. Students can eliminate D and E immediately because they are area statements, not shape descriptions. The pool conflates two distinct graph-reading skills (shape identification and area interpretation).

---

### MINOR
- **Fact**: `ap_phys1_satellite_orbit` and `ap_phys1_buoyant_force_formula` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered** (`ap_phys1_satellite_orbit`):
  Q: "For an orbiting satellite, what equation expresses the balance between gravitational force and the centripetal acceleration requirement?"
  A) Solid disk: I = ½MR²; hollow ring: I = MR²; solid sphere: I = (2/5)MR²…
  B) Solid disk: I = ½MR²; Thin ring: I = MR²
  C) Gravitational force provides centripetal force: Gm₁m₂/r² = mv²/r ✓
- **Issue**: Pool `equation_explanations`. The two distractor options are moment-of-inertia formulas (rotational dynamics topic) appearing as distractors in a gravity/orbital mechanics question. Students familiar with rotational dynamics will recognize these as off-topic and eliminate both simultaneously — effectively a 1-in-1 choice. The `equation_explanations` pool spans all 8 units, producing severe cross-topic contamination.

---

### MINOR
- **Fact**: `ap_phys1_distance_vs_displacement` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What is the key difference between distance and the vector position change?"
  A) Speed (distance/time)
  B) Zero (no horiz acceleration)
  C) Distance (scalar path) vs displacement (vector) ✓
- **Issue**: Pool `quantity_definitions`. "Zero (no horiz acceleration)" is a projectile-motion numerical answer — a completely different question type appearing in a conceptual definition question. Trivially eliminable as a numerical statement when the question asks for a conceptual distinction.

---

### MINOR
- **Fact**: `ap_phys1_watt_unit` and `ap_phys1_joule_unit` in `unit_conversions`
- **Category**: `NUMERIC-WEAK`
- **Rendered** (`ap_phys1_watt_unit`):
  Q: "What is the SI unit of power, and how is it defined in base units?"
  A) Hertz (Hz) = cycles per second = s⁻¹ ✓? No — correct is "Watt (W) = 1 joule per second (J/s)"
  A) Hertz (Hz) = cycles per second = s⁻¹
  B) Watt (W) = 1 joule per second (J/s) ✓
  C) Pascal (Pa) = N/m² = kg/(m⋅s²)
- **Issue**: All three options are SI unit definitions — this is actually good pool homogeneity. However, Hertz, Watt, and Pascal measure completely different physical quantities (frequency, power, pressure). A student who simply knows "power unit is Watt" can select without knowing the base-unit expression. The question tests recall of unit names more than base-unit derivation. MINOR — not wrong, but pedagogically thin.

---

### MINOR
- **Fact**: `ap_phys1_scalar_def` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What type of physical quantity has magnitude only and no direction?"
  A) Work requires displacement
  B) Constant (uniform) acceleration
  C) Scalar (magnitude only) ✓
- **Issue**: Pool `term_definitions`. Option A ("Work requires displacement") is a conceptual statement about work (not a quantity type), and option B ("Constant (uniform) acceleration") is a quantity with units — neither is a type of physical quantity in the answer-type sense the question expects. The distractors don't answer the question's implied format (the answer should be a type name, not a statement about a different quantity).

---

### NIT
- **Fact**: `ap_phys1_freefall_def` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What term describes motion under gravity alone, with no air resistance, where all objects accelerate at g?"
  A) Nonconservative force (e.g., friction)
  B) Free fall (gravity only) ✓
  C) Work (energy transfer)
- **Issue**: All options are "term (brief description)" format — good consistency. But "Nonconservative force" and "Work" are concepts from different units (dynamics and energy) appearing as distractors in a kinematics question. Moderate cross-unit contamination, eliminable by topic domain.

## Expected vs Actual

**Expected**: `concept_statements` (123 facts, homogeneityExempt) would produce cross-unit contamination. **Confirmed**: Moment-of-inertia formulas appear as distractors in orbital mechanics questions.

**Expected**: `term_definitions` POOL-CONTAM from mixed answer formats. **Confirmed**: Condition-statements with math notation (Στ = 0) mixed with vocabulary labels.

**Expected**: `unit_conversions` NUMERIC-WEAK. **Confirmed but nuanced**: The N⋅m ambiguity (J = N⋅m, torque also in N⋅m) creates a genuinely tricky near-correct distractor.

**Expected**: `graph_interpretations` would mix shape and area facts. **Confirmed**: Area statements appear as distractors in shape-identification questions.

## Notes

The 3-option limit at mastery=0 amplifies all pool contamination issues — with only 2 distractors, any cross-domain contamination is immediately visible. At mastery=4 with 5 options, the contamination is diluted.

No factual accuracy concerns were found in the sampled facts. The physics content itself appears correct and well-sourced. All issues are structural (pool design).

The "Newton-meter torque" distractor for the Joule question is the most interesting pedagogical concern — it tests whether students understand that J = N⋅m is coincidental to torque's units, a genuine AP Physics 1 distinction. Could be intentional or could be a near-correct distractor that should be removed.
