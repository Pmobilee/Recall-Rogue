Generate Japanese vocabulary records for Recall Rogue.

Rules:
- Output strict JSON array only.
- `type` must be `"vocabulary"`.
- Include: `statement`, `quizQuestion`, `correctAnswer`, `distractors`, `explanation`, `category`, `difficulty`, `ageRating`, `language`, `pronunciation`, `exampleSentence`, `sourceName`, `sourceUrl`, `acceptableAnswers`.
- `language` must be `"ja"`.
- `category` should be like `["Language", "Japanese", "N3"]`.
- `distractors` minimum 5, semantically plausible.
- `acceptableAnswers` minimum 2 (spelling/translation variants).

Quality:
- Focus on practical JLPT-aligned meaning.
- Keep definitions short and clear.
- No slang unless explicitly requested.
- Source every record (dictionary or encyclopedic reference).
