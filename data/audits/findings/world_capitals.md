# world_capitals — Quiz Audit Findings

## Summary
168 facts, all `quizResponseMode: "map_pin"`. The quiz dump shows `templateId: passthrough` with single-element option arrays for every row — text-based multi-choice quiz is never rendered. The 4 answer pools (capital_names_short/long, country_names_caps_short/long) are not exercised by any quiz template in the dump. Findings below are structural issues detectable from the JSON; no eliminability or distractor-quality issues can be assessed since no multi-option quiz renders.

**Issue counts:** 1 MAJOR, 2 MINOR, 1 NIT

---

## Issues

### MAJOR

- **Fact**: `capital_bo` @ mastery=all
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "What is the capital of Bolivia?"
  (map_pin mode — no text options rendered)
- **Issue**: Bolivia has two capitals: Sucre (constitutional, listed as `correctAnswer`) and La Paz (seat of government, listed in `acceptableAlternatives`). Neither is unambiguously "the" capital. The question wording "What is the capital?" implies a single answer. Most geography curricula cite La Paz as the de facto capital, making Sucre a surprising primary answer. Should either reword to "constitutional capital" / "seat of government" or pick the one most curricula cite.

---

### MINOR

- **Fact**: `capital_gb` @ mastery=all
- **Category**: `BROKEN-GRAMMAR`
- **Rendered**:
  Q: "What is the capital of United Kingdom?"
  (map_pin mode)
- **Issue**: Missing definite article — should be "of the United Kingdom". This is a grammatical error affecting every presentation of this fact.

---

- **Fact**: `capital_xk` @ mastery=all
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "What is the capital of Kosovo?"
  (map_pin mode — answer: Pristina)
- **Issue**: Kosovo's statehood is disputed (~100 countries do not recognize it, including Russia, China, Spain, Serbia). Treating it as a standard country without any qualifier may confuse players or generate controversy. A brief qualifier in the question ("What is the capital of Kosovo, which declared independence in 2008?") or a note in the explanation (already present and good) reduces but doesn't eliminate the issue.

---

### NIT

- **Fact**: all 168 facts @ mastery=all
- **Category**: `OTHER`
- **Rendered**: N/A (passthrough only)
- **Issue**: No `subDecks` or `chainThemes` defined. Zero themed progression in the deck. All 168 facts exist in one flat pool. For a knowledge deck of this scale, ≥8 chain themes (by region: Europe, Asia, Africa, Americas, etc.) would be expected per the deck quality bar. This limits in-game chain bonus variety.

---

## Expected vs Actual
- Expected: 168 facts with valid map coordinates — **actual: all 168 coordinates valid, no MAP-BROKEN**
- Expected: No duplicate questions — **actual: all unique (different country per fact)**
- Expected: Proper grammar in all questions — **actual: "of United Kingdom" grammar error in `capital_gb`**
- Expected: Bolivia dual-capital handled — **actual: handled via acceptableAlternatives, but question wording remains ambiguous**

## Notes
- `capital_names_short` / `capital_names_long` and `country_names_caps_short` / `country_names_caps_long` pools have no synthetic distractors. If a fallback text-quiz mode is ever enabled, LENGTH-TELL risk is present: answer length ratio is 2.0× (short pool) and 2.8× (long pool) — within limits but approaching the 3× threshold for the long pool.
- The deck has excellent factual accuracy overall. Distractors on individual facts (visible in JSON) are geographically coherent region-neighbours.
