Generate French vocabulary records for Recall Rogue.

Rules:
- Output strict JSON array only.
- `type` must be `"vocabulary"`.
- Include:
  `statement`, `quizQuestion`, `correctAnswer`, `distractors`, `explanation`,
  `category`, `difficulty`, `ageRating`, `language`, `pronunciation`,
  `exampleSentence`, `sourceName`, `sourceUrl`, `acceptableAnswers`.
- `language` must be `"fr"`.
- `category` should be like `["Language", "French", "B1"]`.
- Include at least 5 plausible distractors.
- Include at least 2 acceptable answer variants.

Quality:
- Prefer standard contemporary French.
- Keep explanations concise and learner-friendly.
- Source every entry from trusted references.
