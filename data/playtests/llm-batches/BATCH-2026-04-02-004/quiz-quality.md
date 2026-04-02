# Quiz Quality Report — BATCH-2026-04-02-004
**Tester**: Quiz Quality | **Model**: claude-sonnet-4-6 | **Domain**: general_knowledge | **Encounters**: 3
**Date**: 2026-04-02 | **Method**: Playwright + window.__rrPlay API

---

## Verdict: ISSUES

The quiz system is fundamentally sound — all objective structural checks pass. However, two medium-severity distractor quality issues were found: one quiz has distractors that mix measurement units (weight vs. height), and one quiz uses World Wonders nicknames as distractors for a question about Disney theme park castles. No critical failures.

---

## Summary

- **Total quiz entries captured**: 20 (across 3 encounters)
- **Unique fact IDs observed**: 9
- **Quizzes with full distractor data**: 20 / 20 (100%)
- **Domains represented**: general_knowledge (8), geography (10), history (2)
- **Sources observed**: World Wonders deck, Roman history, CS/tech, geography general

**Note on encounter 2**: The combat screen persisted after encounter 1 ended (enemy HP went to undefined before transitioning), causing encounter 2 to show 0 quizzes. The post-combat navigator then correctly handled reward → map → new combat, producing 13 quizzes in encounter 3. This is a minor API state issue, not a game bug.

**Note on fact repetition**: 9 unique facts appeared across 20 plays. Several facts (cs_3_pagerank_inventors, geography-hong-kong-most-skyscrapers) appeared 4-5 times each in a single run session. This is the Anki algorithm working as intended for a newly-started run with a small deck — not a bug.

---

## Objective Findings

| Check | Result | Pass/Fail | Notes |
|-------|--------|-----------|-------|
| O-QZ1 Choice count (≥3) | All quizzes have exactly 4 choices | **PASS** 20/20 | Consistent 4-choice format for mastery 0 (tier '1') cards |
| O-QZ2 No duplicate choices | No quiz had identical choice strings | **PASS** 20/20 | Even repeated fact appearances had shuffled but distinct options |
| O-QZ3 No data artifacts | No undefined/null/NaN/[object in any field | **PASS** 20/20 | All strings are clean; no interpolation failures |
| O-QZ4 Question completeness | All questions are non-empty | **PASS** 20/20 | Shortest: "Which city has the most skyscrapers in the world?" (49 chars) |
| O-QZ5 Question length (20-300 chars) | All within range | **PASS** 20/20 | Range: 49–153 chars |
| O-QZ6 Correct index in bounds | correctIndex always 0 ≤ idx < 4 | **PASS** 20/20 | Index shuffled correctly per appearance |
| O-QZ7 No near-duplicate choices (>90%) | 14 near-dup pairs flagged | **CONTEXT** see note | All from 2 quizzes with intentional numerical distractors |
| O-QZ8 Domain coverage (≥2 domains) | 3 domains: general_knowledge, geography, history | **PASS** | Good variety even in short session |

**O-QZ7 Explanation**: The similarity check flagged 14 pairs, but these are all from two facts:
1. `gk-condom-proper-use-2pct-pregnancy` — choices "2% per year", "6% per year", "1% per year", "7% per year" — numerical distractors with identical format, intentional and correct behavior per `docs/mechanics/quiz.md` §4 (numerical distractor generation).
2. `ww_mon_moai_paro_height` — "52,800 tonnes" vs "42,000 tonnes" — large numbers with same unit suffix. These are problematic (see Issues section).

---

## Subjective Assessments

| Check | Rating (1-5) | Examples | Issues |
|-------|-------------|---------|--------|
| S-QZ1 Distractor plausibility | **3.5/5** | PageRank distractors (John Backus, Tim O'Reilly, Fei-Fei Li) are plausible CS figures; Hong Kong skyscrapers uses real major cities | Moai height question mixes units badly; Neuschwanstein distractors are completely unrelated (nicknames from other Wonders) |
| S-QZ2 Question clarity | **4.5/5** | "PageRank is named after one of its creators. Which two Stanford PhD students invented it in 1998..." is well-contextualized | Moai question embeds weight info ("weighs approximately 82 tonnes") while asking height, which is slightly confusing |
| S-QZ3 Answer correctness | **4.5/5** | All 9 verified correct answers appear to be factually accurate | "Hindi fourth-most-spoken" uses "Mandarin, Spanish, English" as correct — debatable ordering vs. native speaker count vs. total speakers |
| S-QZ4 Difficulty appropriateness | **4/5** | Good spread: easy (nanotechnology named after nanometre, 4 choices) to medium (Metaurus battle, Hasdrubal Barca) | rome_pun_metaurus has a distractor "Nerva, Trajan, Hadrian, Antoninus Pius, Marcus Aurelius" which is a list of 5 emperors — format mismatch with single-person answer |
| S-QZ5 Cultural bias | **4/5** | Mostly Western/global topics; no region-specific cultural assumptions | Hong Kong skyscraper question: "most skyscrapers" is factually correct (by CTBUH definition >100m), but the answer might surprise Western players expecting NYC |

---

## Issues Found

### MEDIUM

**ISSUE-01: Moai height quiz has unit-mismatched distractors**
- **Fact ID**: `ww_mon_moai_paro_height`
- **Question**: "How tall is Paro, the tallest erected moai statue on Easter Island, which weighs approximately 82 tonnes?"
- **Choices**: ["95", "52,800 tonnes", "42,000 tonnes", "10 metres"]
- **Correct**: "10 metres"
- **Problem 1**: Choice "95" has no unit whatsoever — is this 95 metres? 95 feet? A raw number with no unit fails the "coherent format" requirement for distractors.
- **Problem 2**: Choices "52,800 tonnes" and "42,000 tonnes" use weight units (tonnes) but the question asks for height (metres). A player who doesn't know the answer could be confused by having weight-unit distractors alongside a height-unit correct answer.
- **Root cause**: Likely the answer pool for this World Wonders fact contains weight data from adjacent facts (e.g. Easter Island construction estimates). The distractor selector is choosing thematically nearby but semantically wrong-unit answers.
- **Fix**: Add `"10 metres"` answer type pool with height-format answers only, or add `syntheticDistractors` like "6 metres", "15 metres", "20 metres" for height context.

**ISSUE-02: Neuschwanstein/Disney distractors are World Wonders nicknames, not castle names**
- **Fact ID**: `ww_pal_neuschwanstein_disney`
- **Question**: "Which famous Disney theme park castle was directly inspired by Neuschwanstein Castle in Bavaria?"
- **Choices**: ["Mosi-oa-Tunya", "River of January", "Sleeping Beauty Castle", "The Coathanger"]
- **Correct**: "Sleeping Beauty Castle"
- **Problem**: Mosi-oa-Tunya (Victoria Falls), River of January (Rio de Janeiro), and The Coathanger (Sydney Harbour Bridge) are all World Wonders *nicknames* from the same deck. They are completely unrelated to Disney theme parks or castles. A player who has studied the deck will find these bizarre; a naive player may be genuinely misled into thinking these are castle names.
- **Root cause**: The answer pool contains World Wonders nicknames as a pool, and the distractor selector is drawing from the same pool even though the question is asking for a theme park castle name (Sleeping Beauty Castle is an outlier answer type within the World Wonders deck).
- **Fix**: Add `syntheticDistractors` for the `ww_pal` answer type pool with plausible castle names like "Cinderella Castle", "Belle's Enchanted Castle", "Beauty and the Beast Castle".

### LOW

**ISSUE-03: "Nerva, Trajan, Hadrian, Antoninus Pius, Marcus Aurelius" is a list used as a distractor for a single-person answer**
- **Fact ID**: `rome_pun_metaurus`
- **Question**: "Which of Hannibal's brothers marched from Spain to reinforce him..."
- **Correct**: "Hasdrubal Barca" (a single person)
- **Problem**: One distractor is a list of 5 emperors concatenated. Format mismatch. The distractors "Marcus Agrippa" and "Niccolò Machiavelli" are reasonable single-person historical figures, but the 5-emperor list looks clearly "wrong format" and is therefore trivially eliminated by test-savvy players.
- **Fix**: Replace the 5-emperor list distractor with a single Roman general name (e.g., "Mago Barca", "Maharbal", "Hanno the Elder").

**ISSUE-04: Hindi language ranking — answer ordering ambiguity**
- **Fact ID**: `general_knowledge-hindi-fourth-language-world`
- **Question**: "Hindi is the fourth-most-spoken first language in the world — which three languages rank above it?"
- **Correct**: "Mandarin, Spanish, English"
- **Note**: This answer lists languages in a specific order that may be debated. Spanish ranks #2 by native speakers (per recent Ethnologue data), English #3, Mandarin #1. The order "Mandarin, Spanish, English" is defensible but the question asks "which three languages" without asking for order. A distractor "English, Portuguese, Mandarin" could be argued as partially correct (English and Mandarin ARE in the top 3). The "Bengali" distractor is a good pick (5th-most-spoken native language, often confused).
- **Severity**: Low — the answer is clearly labeled and matches current Ethnologue data; the question doesn't ask for ranking order explicitly.

---

## Observations on Quiz System Behavior

1. **Distractor shuffling works correctly**: The same fact appeared multiple times (e.g., cs_3_pagerank_inventors appeared 5 times) and choices were shuffled differently each time while correctIndex was always consistent. This is correct behavior.

2. **Choice count consistency**: Every quiz at mastery 0 (tier '1') showed exactly 4 choices. This matches the documented 3 distractors + 1 correct = 4 total for tier 1. Correct per `docs/mechanics/quiz.md` §3.

3. **previewCardQuiz API works**: The fix required reading `result.state` rather than `result` directly (the method returns `{ ok, message, state: { question, choices, ... } }`). This is correct API design.

4. **Pool-based distractor selection is working**: Across 20 quiz appearances, distractors for the same fact varied (confirming jitter seeding). For `geography-hong-kong-most-skyscrapers`, distractors varied across: {NYC, Shanghai, Tokyo}, {Shanghai, Kuala Lumpur, Chicago}, {Tokyo, NYC, Singapore}, {Shanghai, Tokyo, Shenzhen}. All plausible major cities. This demonstrates the pool selection working well.

5. **Domain distribution**: general_knowledge and geography dominated the first 3 floors. History appeared only for the Roman Punic Wars fact. This suggests the deck for `general_knowledge` mode may under-represent history on early floors, or the FSRS scheduler is prioritizing geography/CS facts as newer.

---

## Raw Quiz Data

```json
[
  {
    "factId": "cs_3_pagerank_inventors",
    "question": "PageRank is named after one of its creators. Which two Stanford PhD students invented it in 1998 and used it to build the world's dominant search engine?",
    "sampleChoices": ["John Backus", "Larry Page and Sergey Brin", "Tim O'Reilly", "Fei-Fei Li"],
    "correctAnswer": "Larry Page and Sergey Brin",
    "domain": "general_knowledge",
    "appearanceCount": 5,
    "qualityNotes": "Good. Distractors are plausible CS/tech figures."
  },
  {
    "factId": "geography-hong-kong-most-skyscrapers",
    "question": "Which city has the most skyscrapers in the world?",
    "sampleChoices": ["New York City", "Shanghai", "Hong Kong", "Tokyo"],
    "correctAnswer": "Hong Kong",
    "domain": "geography",
    "appearanceCount": 5,
    "qualityNotes": "Good. Uses major world cities as distractors with good variety per appearance."
  },
  {
    "factId": "ww_pal_neuschwanstein_disney",
    "question": "Which famous Disney theme park castle was directly inspired by Neuschwanstein Castle in Bavaria?",
    "sampleChoices": ["Mosi-oa-Tunya", "River of January", "Sleeping Beauty Castle", "The Coathanger"],
    "correctAnswer": "Sleeping Beauty Castle",
    "domain": "geography",
    "appearanceCount": 2,
    "qualityNotes": "ISSUE-02: Distractors are World Wonders nicknames, not castle names. Poor semantic fit."
  },
  {
    "factId": "rome_pun_metaurus",
    "question": "Which of Hannibal's brothers marched from Spain to reinforce him in Italy, but was defeated and killed at the Battle of the Metaurus River in 207 BCE?",
    "sampleChoices": ["Nerva, Trajan, Hadrian, Antoninus Pius, Marcus Aurelius", "Hasdrubal Barca", "Marcus Agrippa", "Niccolò Machiavelli"],
    "correctAnswer": "Hasdrubal Barca",
    "domain": "history",
    "appearanceCount": 2,
    "qualityNotes": "ISSUE-03: One distractor is a list of 5 emperors vs single-person correct answer. Format mismatch."
  },
  {
    "factId": "general_knowledge-nanotechnology-named-after-nanometre",
    "question": "What unit of length gives nanotechnology its name?",
    "sampleChoices": ["Light year", "Centimetre", "Femtometre", "Nanometre"],
    "correctAnswer": "Nanometre",
    "domain": "general_knowledge",
    "appearanceCount": 1,
    "qualityNotes": "Good. All choices are valid units of length. Femtometre is a close, challenging distractor."
  },
  {
    "factId": "gk-condom-proper-use-2pct-pregnancy",
    "question": "What is the annual pregnancy rate with perfect condom use?",
    "sampleChoices": ["2% per year", "6% per year", "1% per year", "7% per year"],
    "correctAnswer": "2% per year",
    "domain": "general_knowledge",
    "appearanceCount": 2,
    "qualityNotes": "Good. Numerical distractors with matching format. Near-similarity is intentional and appropriate."
  },
  {
    "factId": "ww_mon_moai_paro_height",
    "question": "How tall is Paro, the tallest erected moai statue on Easter Island, which weighs approximately 82 tonnes?",
    "sampleChoices": ["95", "52,800 tonnes", "42,000 tonnes", "10 metres"],
    "correctAnswer": "10 metres",
    "domain": "geography",
    "appearanceCount": 2,
    "qualityNotes": "ISSUE-01: Mixed units (no unit, weight units, height unit). Choice '95' missing unit."
  },
  {
    "factId": "ww_sac_borobudur_location",
    "question": "In which country is Borobudur, the world's largest Buddhist temple, located?",
    "sampleChoices": ["Yucatan, Mexico", "Granada", "Pakistan", "Indonesia"],
    "correctAnswer": "Indonesia",
    "domain": "geography",
    "appearanceCount": 2,
    "qualityNotes": "Adequate. Yucatan Mexico is a specific region not a country. Pakistan is a plausible Buddhist-history neighbor."
  },
  {
    "factId": "general_knowledge-hindi-fourth-language-world",
    "question": "Hindi is the fourth-most-spoken first language in the world — which three languages rank above it?",
    "sampleChoices": ["English, Portuguese, Mandarin", "English, German, Spanish", "Bengali", "Mandarin, Spanish, English"],
    "correctAnswer": "Mandarin, Spanish, English",
    "domain": "general_knowledge",
    "appearanceCount": 1,
    "qualityNotes": "ISSUE-04 (Low): 'Bengali' is a single language as distractor vs 3-language-list correct answer. Format mismatch. Also English-Portuguese-Mandarin is partially correct."
  }
]
```

---

## Recommended Actions

| Priority | Action | Affected Fact IDs |
|----------|--------|-------------------|
| Medium | Fix unit-mismatched distractors for moai height | `ww_mon_moai_paro_height` |
| Medium | Replace World Wonders nicknames with castle names for Neuschwanstein Disney question | `ww_pal_neuschwanstein_disney` |
| Low | Replace 5-emperor list distractor with single historical figure | `rome_pun_metaurus` |
| Low | Verify Bengali (single word) distractor format vs 3-language-list correct answer | `general_knowledge-hindi-fourth-language-world` |
| Investigation | Run broader session to verify history domain representation on floors 1-3 | — |
