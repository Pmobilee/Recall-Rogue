# ap_biology — Quiz Audit Findings

## Summary
The AP Biology deck (165 quiz items, 55 unique facts × 3 mastery levels) is largely well-constructed. The majority of questions have grammatically sound stems and plausible distractors. The dominant issues are two BLOCKERs: a date fact whose question stem is incompatible with the correct answer, and a logistic growth equation fact where the rendered question quotes the answer verbatim. Beyond these, POOL-CONTAM is the primary systemic concern — the two mega-pools (`term_definitions_long` at 214 facts, `term_definitions_mid` at 169 facts) produce cross-domain distractors that undermine quiz integrity for learned players. A LENGTH-TELL was also confirmed in `signal_molecule_names` (cAMP at 4 chars vs distractors averaging 13 chars). Total distinct issues: 2 BLOCKER, 3 MAJOR, 4 MINOR.

## Issues

### BLOCKER
- **Fact**: `ap_bio_darwin_1859` @ mastery=0,2,4
- **Category**: `TEMPLATE-MISFIT` + `SELF-ANSWERING`
- **Rendered**:
  Q: "Charles Darwin published 'On the Origin of Species' in 1859. What was this book's main contribution to biology?"
  A) 1891
  B) 1859 ✓
  C) 1829
- **Issue**: The question asks for the book's "main contribution to biology" (a conceptual answer), but the correct answer is "1859" — the same year already stated in the question stem. The year is self-answering (it appears verbatim in the question), and the answer type (date) does not match the question type (contribution). This fact needs either a new question stem ("In what year did Darwin publish…?") or a new correct answer ("Natural selection as the mechanism of evolution").

---

### BLOCKER
- **Fact**: `ap_bio_u8_041` @ mastery=0,2,4
- **Category**: `SELF-ANSWERING`
- **Rendered**:
  Q: "What type of population growth produces an S-shaped curve that levels off at carrying capacity (K), described by dN/dt = r_max × N × ((K−N)/K)?"
  A) p² + 2pq + q² = 1
  B) dN/dt = r_max × N × ((K−N)/K) ✓
  C) P(A and B) = P(A) × P(B)
- **Issue**: The rendered question quotes the correct answer equation verbatim in the question stem. Any student can match the string without any knowledge of population ecology. The question should be rewritten to ask for the name or type of growth ("What is this called?" → "Logistic growth") rather than providing the equation and asking for the equation.

---

### MAJOR
- **Fact**: `ap_bio_second_messenger_camp` @ mastery=0
- **Category**: `LENGTH-TELL`
- **Rendered**:
  Q: "What small intracellular molecule, derived from ATP by adenylyl cyclase, acts as a second messenger…?"
  A) cAMP ✓ (4 chars)
  B) Calcium ions (12 chars)
  C) Growth factors (13 chars)
- **Issue**: The correct answer "cAMP" is 4 characters while the two distractors average 13 characters. At mastery 0 with only 3 options, the length disparity makes the correct answer immediately obvious. Even at mastery 4 (5 options), the pool `signal_molecule_names` must produce 4 distractors longer than cAMP — confirm whether synth distractors are all longer.

---

### MAJOR
- **Fact**: `ap_bio_u6_032` @ mastery=0,2,4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What large ribonucleoprotein complex composed of snRNPs catalyzes the removal of introns from eukaryotic pre-mRNA?"
  A) FAD / FADH₂
  B) Spliceosome ✓
  C) Cyanobacteria
- **Issue**: Pool `molecule_names_long`. Correct answer is "Spliceosome" (a gene expression complex), but distractor "FAD / FADH₂" is a cellular energetics cofactor and "Cyanobacteria" is an organism name — neither is a molecule in the gene expression domain. These cross-domain distractors are elimable on biological sub-field alone, defeating the quiz's learning purpose.

---

### MAJOR
- **Fact**: Multiple facts in `term_definitions_long` pool @ mastery=0
- **Category**: `POOL-CONTAM`
- **Examples**:
  - `ap_bio_ps_019`: correct="ATP synthase (chloroplast)" with distractor "Water potential (Ψ)" (a plant biology term, not a cellular energetics molecule)
  - `ap_bio_bottleneck_effect`: correct="Bottleneck effect" with distractor "Paracrine signaling" (cell signaling concept) and "Clotting factor cascade" (animal physiology)
  - `ap_bio_u4_074`: correct="Sister chromatids" with distractor "Water potential (Ψ)" and "Photosystem II (P680)"
- **Issue**: The `term_definitions_long` pool (214 facts, 8 CED units) produces distractors from entirely different biological sub-domains. Educated biology students can eliminate distractors by domain alone without knowing the specific answer. This affects all 55 sampled facts that draw from this pool.

---

### MINOR
- **Fact**: `ap_bio_cell_wall_function` @ mastery=0,2,4
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Which structure, found in bacteria, archaea, fungi, and plants (but not animal cells), provides a structural support layer outside the plasma membrane?"
  A) Amphipathic self-assembly
  B) Cell wall ✓
  C) Na+/K+ pump
- **Issue**: Pool `structure_function_terms`. "Na+/K+ pump" contains a "+" character making it superficially look like a formula while "Amphipathic self-assembly" is a process description, not a structure name. The distractors are not the same answer type as "Cell wall" (a structure name). POOL-CONTAM across answer-type categories.

---

### MINOR
- **Fact**: `ap_bio_darwin_1859` (secondary issue)
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**: "What was this book's main contribution to biology?"
- **Issue**: The phrasing "this book" uses "this" as a demonstrative adjective with implicit referent from the prior sentence. While grammatically acceptable in discourse, the question stem reads oddly as a standalone quiz item when the user might not be reading carefully. Secondary to the BLOCKER issue above.

---

### MINOR
- **Fact**: `ap_bio_endosymbiosis_evidence` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What are the five main lines of evidence supporting the endosymbiotic origin of mitochondria and chloroplasts?"
  A) Circular DNA, 70S ribosomes, double membrane ✓
  B) Peptide bond formation by rRNA
  C) Capillary action
- **Issue**: Pool `function_terms`. "Capillary action" is a water property concept (chemistry of life) appearing as a distractor in an evolution/endosymbiosis question. Trivially eliminable by domain. "Peptide bond formation by rRNA" is plausible but draws from the gene expression domain.

---

### NIT
- **Fact**: `ap_bio_small_rna_regulation` @ mastery=0
- **Category**: `DUPLICATE-OPT` (near-synonym)
- **Rendered**:
  Q: "What categories of small RNA molecules post-transcriptionally regulate gene expression by base-pairing with target mRNA?"
  A) siRNA and miRNA ✓
  B) Protein kinase C (PKC)
  C) microRNA (miRNA)
- **Issue**: Options A and C are near-synonyms ("siRNA and miRNA" and "microRNA (miRNA)" — miRNA appears in both). A student who knows miRNA is involved can eliminate option C as being a subset of option A, and will correctly guess A. Not a true duplicate but creates a partial-information tell.

## Expected vs Actual

**Expected**: `term_definitions_long` (214 facts) would produce cross-domain contamination. **Confirmed**: Every sampled fact from this pool shows distractors from different biological CED units (e.g., photosynthesis distractors for genetics questions).

**Expected**: `bracket_numbers` might have a date/contribution mismatch. **Confirmed**: `ap_bio_darwin_1859` is a BLOCKER — question asks for conceptual contribution, answer is the date, date is already in the question stem.

**Expected**: `signal_molecule_names` LENGTH-TELL for cAMP. **Confirmed**: 4-char answer vs 12–13 char distractors at mastery 0.

**Expected**: SELF-ANSWERING risk in equation pool. **Confirmed**: `ap_bio_u8_041` question stem quotes the equation that is the correct answer.

## Notes

The **mastery-scaled option count** (3 options at mastery 0, 4 at mastery 2, 5 at mastery 4) is intentional game design — do not flag as an issue.

The vast majority of sampled biology facts have well-written question stems and domain-appropriate distractors. The identified POOL-CONTAM is structural (pool design) not content quality. Individual fact quality (question clarity, explanation depth, factual accuracy) is consistently high across the deck.
