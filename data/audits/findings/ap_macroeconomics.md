# ap_macroeconomics — Quiz Audit Findings

## Summary
The AP Macroeconomics deck (81 quiz items, 27 facts × 3 mastery levels) has the most severe quality concerns of any deck in this batch. Four facts have BLOCKER-level BROKEN-GRAMMAR: "Irving This", "Federal this", "bank this", and "capital this" — template word-substitution failures that leave "this" as a visible noun replacing proper nouns in the question stem, producing ungrammatical and misleading questions. One of these (ap_macro_4b_three_fed_tools) has compounding issues: the correct answer is the composite of all three tools while two individual tool names are distractors — a SYNONYM-LEAK that makes the correct answer trivially identifiable as the longest option. Additionally, `ap_macro_2b_039` (Fisher equation) has its correct answer (the name "Fisher equation") in the wrong pool (`equation_formulas_macro_mid` is for formulas, not equation names). The `macro_concept_terms_mid` mega-pool (130 facts) produces systemic POOL-CONTAM. Total distinct issues: 4 BLOCKER, 4 MAJOR, 3 MINOR.

## Issues

### BLOCKER
- **Fact**: `ap_macro_2b_001` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "What **this** measures the average change in prices paid by urban consumers for a market basket of goods and services?"
- **Issue**: The word "this" replaces what should be a noun (likely "index" or "measure" — the fact is about the CPI). The rendered question is ungrammatical: "What this measures..." is not valid English. The template produced "this" as a pronoun placeholder that was never substituted. All three mastery levels affected.

---

### BLOCKER
- **Fact**: `ap_macro_4a_time_deposit_cd` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "What type of bank **this** requires funds to remain for a set term and penalizes early withdrawal, earning a fixed interest rate?"
- **Issue**: "bank this" is grammatically broken — "this" replaces what should be "account" or "product." The question is incomprehensible as a standalone quiz item. Rendered at all mastery levels.

---

### BLOCKER
- **Fact**: `ap_macro_4b_three_fed_tools` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR` + `SYNONYM-LEAK`
- **Rendered**:
  Q: "What are the three traditional tools the Federal **this** uses to conduct monetary policy?"
  A) Open market operations
  B) Reserve requirement
  C) Open market operations, discount rate, reserve requirement ✓
- **Issue**: "Federal this" is broken grammar — "this" replaces "Reserve" (the Federal Reserve). Additionally, options A and B are proper subsets of the correct answer C — a student who recognizes that C contains both A and B will select C without knowing the full set. SYNONYM-LEAK from pool members appearing as subset-distractors for a composite-answer question.

---

### BLOCKER
- **Fact**: `ap_macro_2b_039` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR` + `POOL-CONTAM`
- **Rendered**:
  Q: "What equation, named after economist Irving **This**, states that the nominal interest rate approximately equals the real interest rate plus the expected inflation rate?"
  A) 1 divided by reserve ratio
  B) Fisher equation ✓
  C) -MPC / (1 - MPC)
- **Issue**: "Irving This" is broken grammar — "This" replaces "Fisher" (Irving Fisher). The rendered question reveals the answer: the fact asks for the equation named after "Irving This" while the correct answer is "Fisher equation" — if students recognize Fisher ≈ Irving Fisher, the placeholder break makes it self-answering. Beyond grammar: the correct answer "Fisher equation" is a NAME, but the pool `equation_formulas_macro_mid` is for formulas — distractors are formula expressions, not equation names. A student can eliminate A and C as formulas/ratios rather than names.

---

### MAJOR
- **Fact**: `ap_macro_6b_interest_rate_differential` @ mastery=0,2,4
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "When one country has higher real interest rates than another, what direction do capital **this** typically move?"
- **Issue**: "capital this" — "this" replaces "flows" or "funds." Grammatically broken; "capital this" is not a noun phrase. This is a fifth BROKEN-GRAMMAR case, functionally a BLOCKER but the correct answer and distractor set are otherwise sound.

---

### MAJOR
- **Fact**: `ap_macro_3a_tax_multiplier_term` @ mastery=2,4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "Which fiscal amplifier is always negative and smaller in absolute value than the spending multiplier?"
  A) Tax multiplier ✓
  B) Spending multiplier is larger
  C) Spending multiplier
- **Issue**: Pool `multiplier_type_terms`. Options B and C are near-duplicates: "Spending multiplier" and "Spending multiplier is larger." One is a subset/amplification of the other. A student can eliminate B as it contains a claim ("is larger") that sounds like an explanation rather than a name. Additionally, the question references the spending multiplier, and options B/C both contain those words — domain-echo from question to distractors.

---

### MAJOR
- **Fact**: `ap_macro_6a_exchange_rate_definition` @ mastery=4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "What economic variable represents the price at which one country's currency can be exchanged for another's?"
  A) Exchange rate ✓
  B) Fixed exchange rate
  C) [additional options at mastery 4]
- **Issue**: Pool `exchange_rate_terms`. "Exchange rate" and "Fixed exchange rate" are in the same pool — one is a specific type of the other. At mastery 4, both appear as options. A student who knows that a "fixed" exchange rate is a type of exchange rate can eliminate it as too-specific, or conversely might select "Fixed exchange rate" if the question's definition sounds fixed. The near-hyponym relationship makes these poor co-distractors.

---

### MAJOR
- **Fact**: Multiple facts in `macro_concept_terms_mid` pool
- **Category**: `POOL-CONTAM`
- **Examples**:
  - `ap_macro_3b_deficit_spending_keynesian`: correct="Deficit spending" with distractors "Institutions" and "Adverse supply shock" — fiscal policy with institutional economics term and supply-side term
  - `ap_macro_5a_srpc_vertical_long_run`: correct="Price and wage adjustment" with distractor "Government spending and taxation" — long-run adjustment mechanism with fiscal policy tool
  - `ap_macro_2a_gdp_limitation_environment`: correct="environmental degradation" with distractor "Self-correction is slow and painful" — two different types of answers (a noun phrase vs a full evaluative statement) in the same pool
- **Issue**: The `macro_concept_terms_mid` pool (130 facts) spans all CED macroeconomics topics. Cross-unit distractors are consistently generated. Students who recognize that "Institutions" is a development economics term rather than a GDP/inflation concept can eliminate it — defeating the purpose.

---

### MINOR
- **Fact**: `ap_macro_3a_sras_curve` @ mastery=0
- **Category**: `AMBIGUOUS-Q` (borderline)
- **Rendered**:
  Q: "What is the name of the upward-sloping curve in the AD-AS model that shows total output firms will produce at each price level in the short run?"
  A) Long-Run Aggregate Supply curve
  B) Short-Run Aggregate Supply curve ✓
  C) production possibilities curve
- **Issue**: This question describes a curve's shape and role without showing the graph. The LRAS is vertical, so "upward-sloping" correctly distinguishes SRAS — but students who confuse the direction of AD vs SRAS slopes may struggle. The question is self-contained enough with the "upward-sloping" clue, but "in the AD-AS model" without a visual forces students to reconstruct the model mentally. MINOR — acceptable but borderline.

---

### MINOR
- **Fact**: `ap_macro_2a_potential_gdp` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What term describes the level of real GDP the economy would produce if all resources were fully employed?"
  A) Okun's law
  B) potential GDP ✓
  C) nominal GDP
- **Issue**: Pool `indicator_names_short`. "Okun's law" is a named relationship (not an indicator name), while "potential GDP" and "nominal GDP" are indicators. Mixing named laws with indicator names in one pool. Okun's law is eliminable because it is a law/relationship name, not a GDP variant name — the question asks "what term" suggesting a noun, not a law.

---

### NIT
- **Fact**: `ap_macro_2b_016` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What term describes the high point of the business cycle, where real GDP is at its maximum before a contraction?"
  A) Peak ✓
  B) taxes
  C) M1
- **Issue**: Pool `macro_concept_terms_short`. "Taxes" is a policy instrument (not a business cycle phase) and "M1" is a money supply measure. Both are trivially eliminable by category — neither is a business cycle phase term. Mild POOL-CONTAM but at only 3 options makes it very obvious.

## Expected vs Actual

**Expected**: BROKEN-GRAMMAR "this" placeholder in multiple facts. **Confirmed and worse than expected**: 5 facts affected (not 4) — "Irving This", "Federal this", "bank this", "capital this", and a fifth confirmed. All are BLOCKER-level rendering failures.

**Expected**: `fed_tool_names` SYNONYM-LEAK from individual tools appearing with composite answer. **Confirmed**: Individual tool names are distractors for the "list all three tools" question.

**Expected**: `macro_concept_terms_mid` POOL-CONTAM. **Confirmed**: GDP, monetary, fiscal, and BOP concepts freely cross-contaminate in distractor selection.

**Expected**: `multiplier_type_terms` near-duplicate distractors. **Confirmed**: "Spending multiplier" and "Spending multiplier is larger" co-appear.

## Notes

The BROKEN-GRAMMAR issues are the most urgent fixes across the entire AP batch. They are rendering failures not content errors — the source facts likely have proper nouns in answer positions that a template is incorrectly converting to "this." This pattern is specific to macroeconomics (5 confirmed cases) and absent in all other AP decks audited.

The Fisher equation pool assignment (`equation_formulas_macro_mid`) is a secondary issue worth correcting — the fact tests whether students know the equation's name, but the pool and distractors are for formula expressions.
