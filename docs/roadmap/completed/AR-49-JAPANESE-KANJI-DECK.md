# AR-49: Japanese Kanji Deck Content

**Status:** Pending
**Created:** 2026-03-16
**Depends on:** AR-48 (hide empty subcategories — so kanji appears only when content exists)
**Estimated complexity:** Medium (data pipeline + content generation)

---

## Overview

Add a kanji learning deck to the Japanese language pack. Each kanji card teaches one character with its readings (on'yomi/kun'yomi), meanings, stroke count, and example words. Organized by JLPT level (N5→N1).

## Content Scope

| JLPT Level | Kanji Count | Source |
|-----------|-------------|--------|
| N5 | ~80 | joyo-kanji-list / JLPT resources |
| N4 | ~170 | joyo-kanji-list / JLPT resources |
| N3 | ~370 | joyo-kanji-list / JLPT resources |
| N2 | ~380 | joyo-kanji-list / JLPT resources |
| N1 | ~1,200 | joyo-kanji-list / JLPT resources |
| **Total** | **~2,200** | |

## Fact Schema (per kanji)

```json
{
  "id": "ja-kanji-n5-001",
  "type": "vocabulary",
  "language": "ja",
  "categoryL1": "language",
  "categoryL2": "japanese_n5",
  "targetWord": "日",
  "quizQuestion": "What does the kanji \"日\" mean?",
  "correctAnswer": "day, sun",
  "explanation": "日 (にち/ひ) — day, sun. On'yomi: ニチ, ジツ. Kun'yomi: ひ, -び, -か. Stroke count: 4. Example: 日本 (にほん) = Japan.",
  "distractors": [],
  "pronunciation": "にち / ひ",
  "difficulty": 1,
  "tags": ["kanji", "ja", "n5"]
}
```

Quiz types for kanji:
- **Meaning**: "What does 日 mean?" → "day, sun"
- **Reading**: "What is the kun'yomi of 日?" → "ひ"
- **Recognition**: "Which kanji means 'day'?" → "日" (with kanji distractors)

## TODO

1. [ ] Source kanji data: find open-licensed JLPT kanji list with readings + meanings (e.g., `davidluzgouveia/kanji-data`, KANJIDIC2)
2. [ ] Write build script: `scripts/content-pipeline/vocab/build-japanese-kanji.mjs`
3. [ ] Generate kanji facts with `id: ja-kanji-n{level}-{number}` format
4. [ ] Ensure `categoryL2` is set to `japanese_n5` through `japanese_n1`
5. [ ] IDs must contain `-kanji-` so `inferLanguageSubdeck()` returns `"kanji"`
6. [ ] Build, verify in deckbuilder: "Kanji" checkbox appears per JLPT level
7. [ ] Spot-check 10 kanji facts for correctness

## Acceptance Criteria

- [ ] ~2,200 kanji facts across N5-N1 in `src/data/seed/kanji-ja.json`
- [ ] Deckbuilder shows "Kanji" checkbox per JLPT level with correct counts
- [ ] Selecting N5 Kanji shows ~80 facts, not vocabulary
- [ ] Runtime distractors work (other kanji meanings as wrong answers)

## Files Affected

- `scripts/content-pipeline/vocab/build-japanese-kanji.mjs` — NEW build script
- `src/data/seed/kanji-ja.json` — NEW seed file
- `data/curated/vocab/ja/` — kanji source data
- `public/facts.db` — rebuilt
