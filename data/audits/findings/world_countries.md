# world_countries — Quiz Audit Findings

## Summary
168 facts, all `quizMode: "image_question"`. The quiz dump shows `templateId: passthrough` with single-element option arrays for all 90 rows — no multi-choice text rendering occurs. The rendered question is always "Which country is highlighted on this map?" — duplicate across all facts by design. No distractor quality issues can be assessed from the dump. Findings are structural, derived from deck JSON.

**Issue counts:** 0 BLOCKER, 1 MAJOR, 2 MINOR, 0 NIT

---

## Issues

### MAJOR

- **Fact**: `country_mm` @ mastery=all
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "Which country is highlighted on this map?"
  A: Myanmar
- **Issue**: Myanmar is the official name since 1989, but "Burma" is still widely used in English (especially in UK English and by political/humanitarian organizations). The fact has `acceptableAlternatives: ["Burma"]` — this is correct handling. However, in the image quiz, if players type "Burma" and the system doesn't check acceptableAlternatives for the image mode, they'll be wrongly penalized. Flag for runtime verification that acceptableAlternatives are applied in image_question mode.

---

### MINOR

- **Fact**: All 168 facts @ mastery=all
- **Category**: `OTHER`
- **Rendered**: N/A (passthrough)
- **Issue**: No `subDecks` or `chainThemes` defined. A 168-fact geography deck with no regional groupings (Europe, Asia, Africa, Americas, Oceania) lacks themed chain bonus progression. Expected ≥8 chain themes for a knowledge deck of this size.

---

- **Fact**: All 168 facts @ mastery=all
- **Category**: `SYNTHETIC-WEAK`
- **Rendered**: N/A (passthrough)
- **Issue**: Both pools (`country_names_short`, `country_names_long`) have 0 synthetic distractors. At low mastery, distractors are drawn only from the pool of real correct answers. While pool sizes (136 and 32) are large enough for variety, there is no domain-specific padding for unusual or obscure country groupings. If text fallback ever activates, length ratio 2.5–2.9× approaches the 3× warn threshold.

---

## Expected vs Actual
- Expected: all 168 `imageAssetPath` present — **actual: all 168/168 confirmed**
- Expected: Myanmar has acceptableAlternatives — **actual: confirmed `["Burma"]`**
- Expected: Côte d'Ivoire handled — **actual: `correctAnswer: "Ivory Coast"` with acceptableAlternatives including both variants** (verified in world_flags deck; world_countries has `country_cd: "Democratic Republic of the Congo"` — need to verify if "DRC" or "Congo" are alternatives)
- Expected: No MAP-BROKEN — **actual: no mapCoordinates field (image mode only) — correct**

## Notes
- This deck is structurally sound for image_question mode. The passthrough rendering means the dump cannot reveal distractor quality issues.
- The `country_names_long` pool has only 32 facts and 0 synthetic distractors; at mastery 0 (3 distractors), players will see the same small set repeatedly for obscure long-named countries.
- Czechia/Czech Republic: `country_cz` uses `correctAnswer: "Czechia"` — the UN officially endorsed this name in 2016 but many players will expect "Czech Republic". Verify `acceptableAlternatives` includes "Czech Republic".
