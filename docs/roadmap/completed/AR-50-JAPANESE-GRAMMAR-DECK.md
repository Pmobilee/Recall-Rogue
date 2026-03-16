# AR-50: Japanese Grammar Deck Content

**Status:** Pending
**Created:** 2026-03-16
**Depends on:** AR-48 (hide empty subcategories), AR-49 (kanji deck — establishes pattern)
**Estimated complexity:** Medium-High (requires LLM-assisted content generation)

---

## Overview

Add a grammar learning deck to the Japanese language pack. Each grammar card teaches one grammar point with its pattern, meaning, example sentence, and JLPT level.

## Content Scope

| JLPT Level | Grammar Points | Source |
|-----------|----------------|--------|
| N5 | ~75 | JLPT grammar lists (various open sources) |
| N4 | ~130 | JLPT grammar lists |
| N3 | ~180 | JLPT grammar lists |
| N2 | ~200 | JLPT grammar lists |
| N1 | ~220 | JLPT grammar lists |
| **Total** | **~800** | |

## Fact Schema (per grammar point)

```json
{
  "id": "ja-grammar-n5-001",
  "type": "vocabulary",
  "language": "ja",
  "categoryL1": "language",
  "categoryL2": "japanese_n5",
  "targetWord": "〜は〜です",
  "quizQuestion": "What does the grammar pattern \"〜は〜です\" express?",
  "correctAnswer": "X is Y (polite)",
  "explanation": "〜は〜です is the most basic Japanese sentence pattern. は (wa) marks the topic, です (desu) is the polite copula. Example: 私は学生です (I am a student).",
  "distractors": [],
  "pronunciation": "~wa~desu",
  "difficulty": 1,
  "tags": ["grammar", "ja", "n5"]
}
```

Quiz types for grammar:
- **Meaning**: "What does 〜てから express?" → "after doing ~"
- **Usage**: "Complete: 食べ___寝ます (eat then sleep)" → "てから"
- **Recognition**: "Which pattern means 'must do'?" → "〜なければならない"

## TODO

1. [ ] Source grammar data: find open-licensed JLPT grammar lists (e.g., jlptsensei.com structure, Tae Kim's guide CC-BY)
2. [ ] Curate grammar points per level into `data/curated/vocab/ja/grammar-points.json`
3. [ ] Write build script OR use Sonnet agents to generate quiz-ready grammar facts
4. [ ] IDs must contain `-grammar-` so `inferLanguageSubdeck()` returns `"grammar"`
5. [ ] Set `categoryL2` to `japanese_n5` through `japanese_n1`
6. [ ] Build, verify in deckbuilder
7. [ ] Spot-check 10 grammar facts for correctness

## Acceptance Criteria

- [ ] ~800 grammar facts across N5-N1 in `src/data/seed/grammar-ja.json`
- [ ] Deckbuilder shows "Grammar" checkbox per JLPT level
- [ ] Grammar facts have clear, concise quiz questions
- [ ] Example sentences included in explanations

## Files Affected

- `scripts/content-pipeline/vocab/build-japanese-grammar.mjs` — NEW build script
- `src/data/seed/grammar-ja.json` — NEW seed file
- `data/curated/vocab/ja/` — grammar source data
- `public/facts.db` — rebuilt
