# pharmacology — Quiz Audit Findings

## Summary
29 unique facts sampled across 87 quiz dump entries (3 mastery levels each). Deck has 405 facts and 12 pools. Overall the pharmacology deck shows the cleanest quiz rendering of the six decks — drug class, mechanism, side effect, antidote, and nursing intervention pools are well-separated and semantically homogeneous. Two BROKEN-GRAMMAR facts from template substitution failures ("this-release", "this-dependent"). One high-severity SYNONYM-LEAK/DUPLICATE-OPT where a distractor contains the correct answer verbatim. `drug_class_abbrev` pool has only 2 real facts. No chain themes defined.

Severity breakdown: 1 BLOCKER, 2 MAJOR, 2 MINOR, 1 NIT.

---

## Issues

### BLOCKER

---

- **Fact**: `pharm-inf-tmp-smx-sideeffect` @ mastery=4
- **Category**: `SYNONYM-LEAK` / `DUPLICATE-OPT`
- **Rendered**:
  Q: "What life-threatening skin reaction is associated with trimethoprim-sulfamethoxazole?"
   A) Tachycardia; tremor; hyperglycemia
   B) Orange discoloration of body fluids
   C) Rash (may progress to Stevens-Johnson syndrome)
   D) Hypertension, hypokalemia, edema
   E) Stevens-Johnson syndrome ✓
- **Issue**: Option C "Rash (may progress to Stevens-Johnson syndrome)" contains the correct answer "Stevens-Johnson syndrome" verbatim as a subset. A student with any pattern-recognition ability sees option C describes a rash that becomes the correct answer — trivially eliminatable. Additionally option C is itself partially correct (SJS is indeed a rash progression), making this factually problematic as a "wrong" answer.

---

### MAJOR

---

- **Fact**: `pharm-cns-oxycodone-nursing` @ mastery=any
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "What is the critical administration instruction for this-release oxycodone?"
   A) Do not crush extended-release tablets ✓
- **Issue**: "this-release oxycodone" is broken grammar from a template substitution failure — "this-release" should be "extended-release." The answer correctly says "extended-release" but the question says "this-release." A student reading the question cannot determine what formulation is being asked about.

---

- **Fact**: `pharm-cns-naloxone-sideeffect` (not in dump, confirmed in source JSON)
- **Category**: `BROKEN-GRAMMAR`
- **Rendered** (from JSON): Q: "What is the main adverse effect of naloxone in this-dependent patients?"
- **Issue**: "this-dependent patients" should be "opioid-dependent patients." Same template substitution failure pattern as oxycodone-nursing. Question is ambiguous without the drug class name.

---

### MINOR

---

- **Fact**: `pharm-cv-hydrochlorothiazide-indication` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What is the primary indication for hydrochlorothiazide?"
   A) Hypertension ✓ (12ch)
   B) Shock (5ch)
   C) Hyperlipidemia (14ch)
- **Issue**: At mastery=0, "Shock" (5ch) vs "Hypertension" (12ch) / "Hyperlipidemia" (14ch) — ratio 2.8×. "Shock" is an obvious outlier by brevity and by clinical plausibility (a diuretic would never be indicated for shock). Eliminatable on both length and clinical logic.

---

- **Fact**: `pharm-cns-fluoxetine-class` @ mastery=any
- **Category**: `POS-TELL`
- **Rendered**:
  Q: "What drug class does fluoxetine belong to?"
   A) LABA
   B) SERM
   C) SSRI ✓
   D) ARB
   E) PPI
- **Issue**: All options in `drug_class_abbrev` pool are 3–4 character acronyms (LABA, SERM, SSRI, ARB, PPI, SNRI, TCA, MAOI, CCB, BB, DMARD). A student who knows "fluo-" relates to serotonin can identify SSRI from the prefix alone. This is a CATEGORY-TELL more than POS-TELL — the category "serotonin reuptake" is leaked by the drug suffix "-oxetine." Not a quiz engine fault, but a content design issue.

---

### NIT

---

- **Fact**: `pharm-cv-diltiazem-side-effect` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What cardiac adverse effect must be monitored when a patient is on diltiazem?"
   A) Urinary retention (17ch)
   B) Pulmonary toxicity (18ch)
   C) Tremor (6ch)
   D) Bradycardia ✓ (11ch)
   E) Hepatotoxicity (14ch)
- **Issue**: "Tremor" (6ch) is notably shorter than all other options (11–18ch), ratio 3.0×. However, "Tremor" is clinically plausible for a calcium channel blocker question (CCBs can cause reflex tachycardia, not tremor — but a student may not know this distinction). The short length is a weak tell but not the primary elimination path.

---

## Expected vs Actual

Expected: Clean pharmacology quizzes with clinically plausible distractors across drug class, mechanism, side effect, antidote, and nursing pools.

Actual: The deck achieves the highest quality of the six audited decks. Drug class distractors (ACE inhibitors, ARBs, beta blockers, loop diuretics) are clinically appropriate and not eliminatable by length alone. Mechanisms are long-form sentences all of comparable length. Side effects are single-condition labels. The two template breakage facts (oxycodone-nursing, naloxone-sideeffect) are isolated failures in an otherwise well-constructed deck.

---

## Notes

- `drug_class_abbrev` pool: only 2 real facts (fluoxetine→SSRI, tamoxifen→SERM) but 11 synthetic distractors. Pool functions but any new facts using abbreviation-format answers should be assigned here, not to `drug_classes`.
- The `interactions` pool (8 real + 7 synth = 15) shows good distractor quality: "Alcohol causes disulfiram-like reaction", "Rifampin reduces OC effectiveness", "Iodinated contrast dye" are appropriately specific and domain-coherent.
- No chain themes defined — drug class chains (beta blockers, ACE inhibitors, opioids, antibiotics) would be natural thematic groupings and are a notable omission for a 405-fact knowledge deck.
- `antidotes_short` and `antidotes_long` are both well-formed with appropriate synth padding and clinically correct distractors (Flumazenil for benzos, Naloxone for opioids, Protamine for heparin all correctly appear as pool members and distractors).
