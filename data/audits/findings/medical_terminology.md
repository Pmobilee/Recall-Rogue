# medical_terminology — Quiz Audit Findings

## Summary
30 unique facts sampled across 90 quiz dump entries (3 mastery levels each). Deck has 700 facts and 16 pools. Overall quiz rendering is clean — question stems are grammatically correct, explanations are complete (average 150+ chars including etymology breakdowns), and the prefix/suffix/root structure holds up well under the quiz engine. Key structural issues: the `bracket_numbers` pool has only 2 real facts and no synthetics (fatal), 5 self-answering facts where the combining form being tested appears in both question and answer, and confirmed missing clinical dosing abbreviations (PRN, BID, NPO, TID, QID, SQ). No chain themes defined.

Severity breakdown: 1 BLOCKER, 3 MAJOR, 4 MINOR, 2 NIT.

---

## Issues

### BLOCKER

---

- **Fact**: `medterm_pre_tri` (and `medterm_pre_quadri`) @ mastery=0
- **Category**: `NUMERIC-WEAK`
- **Rendered**:
  Q: "What does the prefix tri- mean in medical terminology?"
   A) 13
   B) 1
   C) 5
   D) 4
   E) 3 ✓
- **Issue**: The `bracket_numbers` pool has exactly 2 real facts (tri- = 3, quadri- = 4) and ZERO synthetics. The quiz engine has no pool diversity — at mastery=4 it can only show: [13, 1, 5, 4, 3] as options, but these 5 numerics are the complete universe of the pool (mostly synthetics). More critically, with only 2 real facts, the only possible distractor for the "tri-" question at the pool level is "4" (from quadri-) — the quiz is trivially easy. BLOCKER because the pool is functionally broken with no ability to add variety at runtime.

---

### MAJOR

---

- **Fact**: `medterm_abbr_pt_inr` @ mastery=any
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does the medical abbreviation PT/INR stand for?"
   A: "PT/INR"
- **Issue**: The correct answer is literally the same text as the abbreviation in the question ("PT/INR"). The answer should be the expansion "Prothrombin Time / International Normalized Ratio" but instead stores just the abbreviation — the question tests nothing.

---

- **Fact**: `medterm_root_uretero` @ mastery=any
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What does the combining form ureter/o mean?"
   A: "ureter"
- **Issue**: The combining form "ureter/o" and its meaning "ureter" are the same word. No knowledge is tested — a student who reads the question has already read the answer. Same pattern applies to `medterm_root_ligamento` (ligament/o → ligament), `medterm_root_insulino` (insulin/o → insulin), and `medterm_organ_ureter` (ureter/o → ureter — duplicate question with different pool).

---

- **Fact**: Missing coverage — PRN, BID, NPO, TID, QID, SQ
- **Category**: `OTHER` (scope gap)
- **Rendered**: N/A — these facts do not exist in the deck
- **Issue**: Six high-frequency clinical dosing abbreviations are absent from the deck. PRN (as needed), BID (twice daily), NPO (nothing by mouth), TID (three times daily), QID (four times daily), and SQ (subcutaneous) appear on every medication administration record in nursing. The 2026-04-03 audit flagged this gap; it remains unaddressed. The 20 existing abbreviation facts all cover lab/vital sign abbreviations (CBC, BMP, SpO2, BP), not administration route/frequency terms.

---

### MINOR

---

- **Fact**: `medterm_cond_aneurysm_2` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What medical condition, whose name derives from the Greek for 'widening or dilation,' describes an abnormal ballooning of a blood vessel wall that can rupture if untreated?"
   A) Nullipara
   B) Acromegaly
   C) Prone
   D) PT/INR
   E) Aneurysm ✓
- **Issue**: "PT/INR" is an abbreviation (diagnostic test), not a condition name. It appears here as a distractor because `condition_names_short` pool likely contains the PT/INR fact despite it being an abbreviation, not a condition. POOL-CONTAM between condition names and abbreviations is trivially eliminatable.

---

- **Fact**: `medterm_pos_dorsal_recumbent` @ mastery=4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Which anatomical position places the patient lying on their back with knees bent and feet flat on the table?"
   A) Cardiomegaly
   B) Inflammation of the ovary
   C) Thrombocytopenia
   D) Dorsal recumbent ✓
   E) Glycated hemoglobin
- **Issue**: Pool `condition_names_long` appears to mix body positions (Dorsal recumbent) with disease conditions (Cardiomegaly, Thrombocytopenia) and lab values (Glycated hemoglobin = HbA1c). A position answer is easy to distinguish from a disease name by format.

---

- **Fact**: `medterm_root_sigmoido` @ mastery=4
- **Category**: `TEMPLATE-MISFIT`
- **Rendered**:
  Q: "Which S-shaped section of the large intestine, located just before the rectum, has a combining form ending in /o?"
   A) Carbon dioxide
   B) Cut / Section / Slice
   C) Sigmoid colon ✓
   D) Net, network
   E) Pituitary gland
- **Issue**: The question "which [organ] has a combining form ending in /o?" is a strange framing — every organ in this pool has a combining form ending in /o. The question is answerable from the "S-shaped" description alone, making the combining-form framing redundant and misleading. Also "Carbon dioxide" (CO₂, a gas) is an implausible distractor for an organ name question — POOL-CONTAM between organ names and gas definitions.

---

- **Fact**: `medterm_pre_gastr` @ mastery=4
- **Category**: `CATEGORY-TELL`
- **Rendered**:
  Q: "What does the prefix gastr/o- mean in medical terminology?"
   A) Color
   B) Slow
   C) Muscle
   D) Stomach ✓
   E) White
- **Issue**: At mastery=4, "Stomach" (7ch) vs all distractors are 1-word single concepts (Color 5ch, Slow 4ch, Muscle 6ch, White 5ch). No LENGTH-TELL, but a student who knows "gastr-" already recognizes this as a stomach root — the prefix itself is self-explaining. CATEGORY-TELL: the /o combining form pattern signals organ reference vs. Color/Slow/White signals descriptive prefixes, making Stomach distinguishable by category.

---

### NIT

---

- **Fact**: `medroot_gen_013` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What does the medical root gen/o mean?"
   A) Producing / Origin / Formation ✓ (30ch)
   B) shoulder blade (13ch)
   C) immune system (13ch)
   D) Physician / Treatment (21ch)
   E) Blood vessel (12ch)
- **Issue**: The correct answer is notably longer than most distractors (30ch vs 12–21ch average). Ratio approaches 2.5×. A student can narrow by length alone. Not severe because distractors span a range, but notable at mastery=4.

---

- **Fact**: `medterm_pre_tri` @ mastery=4 (duplicate question risk)
- **Category**: `DUPLICATE-OPT`
- **Rendered**: Both options "4" and "5" appear as numeric distractors; given the pool has only tri- and quadri-, a student who confuses "3 or 4" faces a 50/50 guess at mastery=0 with essentially no other distractors.
- **Issue**: Stylistic/structural more than quiz rendering — the real issue is the pool only has 2 real members.

---

## Expected vs Actual

Expected: Clean Greek/Latin root terminology with plausible same-domain distractors, clear question stems, and comprehensive clinical abbreviation coverage.

Actual: Quiz rendering is generally clean and grammatically correct. Explanations are excellent — all include etymological breakdowns. The critical failures are structural: (1) `bracket_numbers` pool with 2 members and no synthetics is functionally broken; (2) 5 self-answering facts where combining form = meaning; (3) confirmed absence of PRN, BID, NPO, TID, QID, SQ — nursing-critical abbreviations that were flagged in a prior audit and remain unaddressed.

---

## Notes

- The `prefix_meanings_short` pool at mastery=4 shows clean distractor quality: "Color", "Slow", "Muscle", "White", "Stomach" are all single-word concept labels — semantically homogeneous.
- The abbreviation pool (`condition_names_short`) conflates diagnostic abbreviations (PT/INR) with condition names — these should be in a dedicated `abbreviations` pool.
- No BROKEN-GRAMMAR patterns found beyond the self-answering issues.
- Chain themes missing is structural — the numeric chainThemeId values (0–15) are not mapped to any defined theme objects.
