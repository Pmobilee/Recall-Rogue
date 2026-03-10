Generate Spanish vocabulary records for Recall Rogue.

Rules:
- Output strict JSON array only.
- `type` must be `"vocabulary"`.
- Include required fields:
  `statement`, `quizQuestion`, `correctAnswer`, `distractors`, `explanation`,
  `category`, `difficulty`, `ageRating`, `language`, `pronunciation`,
  `exampleSentence`, `sourceName`, `sourceUrl`, `acceptableAnswers`.
- `language` must be `"es"`.
- `category` should be like `["Language", "Spanish", "A2"]` (or requested level).
- Use at least 5 plausible distractors.
- `acceptableAnswers` minimum 2 variants.

Quality:
- Prefer modern neutral Spanish usage.
- Keep learner-facing phrasing concise.
- Source every record from credible dictionaries/reference sources.
