# ap_microeconomics — Quiz Audit Findings

## Summary
The AP Microeconomics deck (81 quiz items, 27 facts × 3 mastery levels) is the second-best structured AP deck in this batch after AP Physics 1. No BLOCKERs. One BROKEN-GRAMMAR instance detected. The dominant concern is SYNONYM-LEAK in pools for closely-related economic terms: "Deadweight loss" and "Deadweight loss is zero" as co-options, "monopoly" and "natural monopoly" as co-options, and the elasticity pool mixing demand and supply elasticity types such that correct and near-antonym answers appear together. The `econ_concept_terms_mid` mega-pool (120 facts) produces mild cross-unit contamination. The human geography pool structure (42 pools) was expected to be worse; microeconomics is actually well-designed with only 25 pools. Total distinct issues: 0 BLOCKER, 4 MAJOR, 3 MINOR.

## Issues

### MAJOR
- **Fact**: `ap_micro_2b_025` @ mastery=0,2,4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "Although subsidies increase quantity traded beyond equilibrium and lower consumer prices, they also create what type of welfare loss?"
  A) Deadweight loss is zero
  B) Deadweight loss ✓
  C) Consumer surplus decreases
- **Issue**: Pool `surplus_welfare_terms_short`. Options A and B are near-opposites about the same concept ("Deadweight loss is zero" directly negates "Deadweight loss"). At mastery 0, a student who knows any deadweight loss exists can eliminate A immediately; at higher mastery the pattern repeats. The question itself says subsidies "create" a welfare loss, making "Deadweight loss is zero" obviously wrong from the question stem — this is borderline self-answering via contradiction with the question.

---

### MAJOR
- **Fact**: `ap_micro_5_022` @ mastery=2,4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "What market structure exists when there is only a single buyer of a resource or input?"
  A) monopsony ✓
  B) monopoly
  C) natural monopoly
  D) [more at mastery 4]
- **Issue**: Pool `market_structure_names_short`. "Monopoly" and "natural monopoly" are co-distractors — one is a specific type of the other. A student who knows monopsony (single buyer) can answer correctly, but the presence of both "monopoly" and "natural monopoly" as distractors is redundant and creates SYNONYM-LEAK since eliminating one helps eliminate the other. Natural monopoly is also a different concept from simple monopoly in AP Micro context.

---

### MAJOR
- **Fact**: `ap_micro_2_inelastic_demand` @ mastery=0,2,4
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "When the absolute value of price elasticity of demand is between 0 and 1, demand is classified as what?"
  A) Elastic demand
  B) Income elasticity of demand
  C) Inelastic demand ✓
- **Issue**: Pool `elasticity_type_terms`. "Elastic demand" and "Inelastic demand" are antonyms — a student who knows the answer is inelastic can confirm by seeing elastic demand as a distractor (it's the obvious wrong answer). At mastery 4, "Inelastic supply" and "Elastic supply" also appear — mixing demand and supply elasticity types in the same pool. The near-antonym pairing makes the quiz trivially easy: if you know any of the four elasticity types, you can eliminate 3 others by pattern.

---

### MAJOR
- **Fact**: `ap_micro_4a_040` @ mastery=0 (and possibly others)
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "Under fair-return regulation (P = ATC), what happens to deadweight loss compared to the unregulated monopoly — and why does it not fully eliminate it?"
  A) Pareto optimum
  B) allocative efficiency (P = MC)
  C) some deadweight loss remains (not fully eliminated)
- **Issue**: The question stem ends with "— and why does it not fully eliminate it?" — this is noted as having a "this" issue in the grammar scan, though on closer inspection the "this" is used correctly as a pronoun for "deadweight loss." The actual grammar concern is the question structure: it asks TWO things (what happens AND why), which is a compound question whose single answer can only partially address. "Some deadweight loss remains" answers the first part but not the "why." BROKEN-GRAMMAR assessment: this is closer to AMBIGUOUS-Q from compound structure than a "this" placeholder issue.

---

### MINOR
- **Fact**: `ap_micro_4a_029` @ mastery=0
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "On a monopoly graph, which curve determines the height of the profit rectangle's bottom boundary — and is the key cost benchmark for whether the firm earns profit or loss?"
  A) TC starts at the level of Fixed Cost
  B) the demand curve is the marginal revenue curve (P = MR)
  C) the average total cost (ATC) curve ✓
- **Issue**: "On a monopoly graph" without the actual graph. Students must reconstruct the monopoly diagram mentally — the profit rectangle's bottom boundary is ATC at the profit-maximizing quantity. Options A and B are both statements about the graph rather than curve names, while C is a curve name with identifier. Mixed answer format within options. AMBIGUOUS-Q because spatial reasoning without visual support is required.

---

### MINOR
- **Fact**: `ap_micro_5_046` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "How do favorable demographic trends — such as a growing working-age population — affect the labor supply curve?"
  A) non-wage benefits reduce labor supply by making a job more attractive
  B) education and training increase labor supply in high-skill occupations
  C) demographics and population growth increase labor supply ✓
- **Issue**: Pool `shift_direction_terms_long`. All three options describe labor supply shifts, which is good homogeneity. However, options A and B are FACTUALLY SUSPECT: "non-wage benefits reduce labor supply by making a job more attractive" contradicts standard economics — better non-wage benefits attract MORE workers (increase supply), not fewer. "Education increases labor supply in high-skill occupations" is more nuanced (it increases supply in skilled markets but not overall). At minimum, option A appears to describe the effect backwards. If factually wrong, this would be a FACTUAL-SUSPECT distractor.

---

### MINOR
- **Fact**: `ap_micro_6b_016` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "A line showing all combinations of two goods a consumer can afford given their income and the prices of those goods is called what?"
  A) kinked demand curve
  B) where MRP intersects MRC
  C) Budget constraint ✓
- **Issue**: Pool `curve_and_graph_names_mid`. "Budget constraint" is a correct answer. "Kinked demand curve" is a monopolistic competition/oligopoly concept (not a consumer theory concept). "Where MRP intersects MRC" is a factor market condition statement, not a curve name. Both distractors are from different units and different answer types than the correct answer (one is a curve name, one is a condition description). Eliminable by category.

---

### NIT
- **Fact**: `ap_micro_1_law_of_supply` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "What economic law states that, all else equal, when the price of a good rises, producers are willing to supply more?"
  A) Law of supply ✓
  B) Law of diminishing marginal utility
  C) diminishing marginal returns
- **Issue**: Pool `law_and_principle_names`. Option C ("diminishing marginal returns") is formatted as a bare phrase without "Law of" prefix, while A and B use proper capitalized form with "Law of." Format inconsistency. Additionally, "diminishing marginal returns" is a principle about production, not a law about supply relationships — mild POOL-CONTAM from mixing supply laws with production principles.

## Expected vs Actual

**Expected**: `econ_concept_terms_mid` POOL-CONTAM. **Confirmed but mild**: Cross-unit contamination visible in larger pool questions, but much less severe than macroeconomics' equivalent pool — micro has better topic-specific sub-pools.

**Expected**: `elasticity_type_terms` SYNONYM-LEAK from near-antonym pairs. **Confirmed**: Elastic vs Inelastic demand/supply co-appear as options at multiple mastery levels.

**Expected**: `surplus_welfare_terms_short` SYNONYM-LEAK. **Confirmed**: "Deadweight loss" and "Deadweight loss is zero" as co-options.

**Expected**: `market_structure_names_short` near-hyponym issue. **Confirmed**: "monopoly" and "natural monopoly" co-appear.

**Unexpected**: No additional BROKEN-GRAMMAR cases — macroeconomics' template issue did not affect microeconomics (same deck family, different template behavior?).

## Notes

Option A for `ap_micro_5_046` ("non-wage benefits reduce labor supply by making a job more attractive") deserves factual verification — standard economics says non-wage benefits increase the attractiveness of a job, increasing labor supply (rightward shift), not decreasing it. If the distractor is intended to be wrong, it should describe the OPPOSITE effect (decrease). If it accidentally states something plausible, it becomes a trick question rather than a knowledge question.

The microeconomics deck's pool architecture (25 pools with thoughtful short/mid/long splits) is considerably better than macroeconomics' (also 25 pools but with several near-empty ones). The structural foundation is sound; the issues are localized to specific pool-contamination cases.
