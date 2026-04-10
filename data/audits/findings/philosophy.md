# philosophy — Quiz Audit Findings

## Summary
90 quiz dump entries (30 facts × 3 mastery levels). No blocking issues. One MINOR LENGTH-TELL in the `school_names` pool (not captured in this sample but confirmed via structural pool analysis). One NIT regarding the `ancient_philosopher_names` pool.

## Issues

### MINOR

- **Fact**: `[school_names pool — any short-answer school fact]` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered** (hypothetical at mastery 4, e.g., "Atomism" is correct):
  Q: "What philosophical school held that reality consists of indivisible particles...?"
   A) Ordinary Language Philosophy
   B) Transcendental Idealism
   C) Common Sense Philosophy
   D) Atomism ✓
   E) Reformed Epistemology
- **Issue**: The `school_names` pool has a measured max/min ratio of 4.7x (6ch "Atomism" vs 28ch "Ordinary Language Philosophy"). Any question where a short school name is correct will be instantly identifiable by length at mastery 4 with 5 options shown. Not directly observed in the 30-fact sample (no short-school facts were rendered at mastery 4 in this dump), but the structural pool defect is confirmed.

---

### NIT

- **Fact**: `[ancient_philosopher_names pool — any short-name fact]` @ mastery=4
- **Category**: `LENGTH-TELL`
- **Rendered** (hypothetical — e.g., "Plato" is correct):
  Q: "Which ancient Greek philosopher founded the Academy in Athens...?"
   A) Diogenes of Sinope
   B) Zeno of Citium
   C) Zeno of Elea
   D) Plato ✓
   E) Protagoras
- **Issue**: Pool length range is 5ch ("Plato") to 18ch ("Diogenes of Sinope") — ratio 3.6x. At mastery 4, "Plato" as the correct answer is the shortest option by a large margin. Issue is NIT-level because "Plato" is also the most famous philosopher and the length tell may not change outcomes.

## Expected vs Actual
Expected LENGTH-TELL issues in `school_names` and `ancient_philosopher_names` pools. Structural analysis confirms both. The 30-fact sample happened to draw facts from `concept_terms_medium`, `argument_names`, and `famous_works` pools primarily — well-designed pools that showed no issues. The philosopher-name and school pools were not directly sampled in the quiz dump at mastery 4.

## Notes
- All 30 facts use `_fallback` template. Questions render as clear, natural English philosophy questions. No broken grammar detected.
- 8 chain themes are correctly defined — this is the only knowledge deck in this batch (besides chess) with chain themes set up. Study Temple mechanic will function correctly.
- No POOL-CONTAM between philosopher names and concept terms was observed in the sample.
- The `concept_terms_medium` pool (113 facts) is extremely large. While no issue was found in the sample, the variance within "medium" length terms should be monitored.
- **Recommended fix**: Split `school_names` into `school_names_short` (≤10ch) and `school_names_long` (>10ch). Apply the same split to `ancient_philosopher_names` and `early_modern_philosopher_names`.
