# world_flags — Quiz Audit Findings

## Summary
197 facts, all `quizMode: "image_question"`. The quiz dump shows `templateId: passthrough` with single-element option arrays for all 90 rows — no multi-choice rendering. The rendered question is always "Which country does this flag belong to?" — identical across all facts by design, and not a quality issue. No distractor quality, eliminability, or pool contamination can be assessed from this dump. Findings are structural.

**Issue counts:** 0 BLOCKER, 1 MAJOR, 1 MINOR, 1 NIT

---

## Issues

### MAJOR

- **Fact**: All 197 facts @ mastery=all
- **Category**: `IMAGE-BROKEN` (risk)
- **Rendered**:
  Q: "Which country does this flag belong to?"
  A) [country name]
  (image_question mode — image not verifiable from dump)
- **Issue**: The quiz dump confirms all 197 facts have `imageAssetPath` set, but the actual image files on disk are not verified. Flag images are binary assets that can be missing, renamed, or moved independently of the JSON. If a flag asset is missing, the image quiz renders broken or blank. This is not confirmed broken but is an unverified risk for all 197 facts. An asset-existence check against `src/assets/` or `public/` is required.

---

### MINOR

- **Fact**: All 197 facts @ mastery=all
- **Category**: `OTHER`
- **Rendered**: N/A (passthrough)
- **Issue**: No `subDecks` or `chainThemes` defined. A 197-fact deck with no continental/regional groupings (Europe, Asia, Africa, Americas, Oceania, Caribbean, etc.) has no themed chain progression. For a knowledge deck of this scale, ≥8 chain themes are expected. This is an architectural gap that limits in-game engagement.

---

### NIT

- **Fact**: `flag_ivory_coast` @ mastery=all
- **Category**: `SYNONYM-LEAK`
- **Rendered**:
  Q: "Which country does this flag belong to?"
  A) [Ivory Coast]
- **Issue**: `correctAnswer: "Ivory Coast"` with `acceptableAlternatives: ["Cote d'Ivoire", "Côte d'Ivoire"]` — this is correctly handled. However, the official name recognized by the UN is "Côte d'Ivoire" and the country itself has requested the English name not be used. The NIT is that having "Ivory Coast" as the primary answer and the official name as an alternative inverts the conventional precedence. Low priority; current implementation is playable.

---

## Expected vs Actual
- Expected: All 197 have `imageAssetPath` — **actual: confirmed 197/197**
- Expected: Myanmar has acceptableAlternatives `["Burma"]` — **actual: confirmed**
- Expected: Ivory Coast has both name variants — **actual: confirmed**
- Expected: No text-mode rendering issues — **actual: passthrough only, not applicable**
- Expected: Duplicate question text is by design — **actual: confirmed, all 197 share same question**

## Notes
- The two pools (`country_names_short` at 156 facts, `country_names_long` at 41 facts) are very large and have high inherent distractor variety even without synthetic distractors.
- Visually similar flag distractors (Romania/Chad, Ireland/Ivory Coast, etc.) are not assessable from this dump — a live image rendering test would be required to evaluate whether the quiz engine serves visually similar or visually distinct distractors.
- Pool length ratios: `country_names_short` 2.5×, `country_names_long` 2.9× — both within the 3× limit but approaching threshold. If long-named countries are split further (e.g., "Papua New Guinea" vs "Chad"), ratio stays clean.
