# anime_manga — Quiz Audit Findings

## Summary
204 facts, 15 pools. Overall quality is high for a pop-culture knowledge deck. The creator_names_long pool (38 facts) produces excellent, plausible distractors. Year and count pools render correctly via numerical generation. Main concerns are: small pools at or below the recommended 15-member threshold with zero synthetics, a mild AMBIGUOUS-Q cluster around superlatives, and one pool-level concern where creator names mix directors with mangaka (different professional roles). No broken grammar detected. One POOL-CONTAM finding where a distractor "Best Animated Feature" appears in an anime_series_titles_long question — a non-title leaking from somewhere.

**Issue counts:** BLOCKER 0 / MAJOR 2 / MINOR 3 / NIT 2

---

## Issues

### MAJOR

- **Fact**: `am_cagliostro_miyazaki` @ mastery=0
- **Category**: `POOL-CONTAM`
- **Rendered**:
  Q: "Which 1979 Lupin III film was Hayao Miyazaki's feature film directorial debut?"
   A) Best Animated Feature  ← distractor from wrong semantic class
   B) The Castle of Cagliostro  ✓
   C) Cyberpunk: Edgerunners
- **Issue**: "Best Animated Feature" is an award category, not an anime series title. It appears as a distractor in the `anime_series_titles_long` pool at mastery 0–4. An award label is trivially eliminable when the question asks for a film title.

---

- **Fact**: `am_onepiece_bestselling` @ mastery=0 (and similar superlative facts)
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "Which manga holds the Guinness World Record as the best-selling manga series of all time, with over 500 million copies sold?"
   A) Dragon Ball
   B) Naruto
   C) One Piece  ✓
- **Issue**: While One Piece is factually correct, the question is at low risk of becoming outdated as sales figures update. More importantly, the question states "over 500 million" which is self-evidently a Guinness record claim — players who know this fact will recognize the embedded clue. Applies to 9 similar "best-selling / most popular" questions. Flagged as volatile.

---

### MINOR

- **Fact**: pool `manga_series_titles` — 5 facts, 0 synthetics
- **Category**: `SYNTHETIC-WEAK`
- **Rendered** (mastery=0, only 2 distractors available from pool): Pool has exactly 5 members — at minimum floor. At mastery 0, only 2 distractors drawn, so all 3 options are real manga titles. Acceptable but leaves no room for error if facts are removed.
- **Issue**: Pool is at the 5-fact minimum with zero synthetics. Any future fact removal drops it below the floor.

---

- **Fact**: pool `technique_terms_long` — 5 facts, 8 synthetics = 13 total
- **Category**: `SYNTHETIC-WEAK`
- **Rendered**: Pool is below the recommended 15-member threshold (only 13 total).
- **Issue**: Synthetics fill the gap adequately, but the pool is narrow. If 2 synthetic distractors happen to be weak or too obvious, correct-answer identification becomes easier.

---

- **Fact**: pool `creator_names_long` mixing directors and mangaka
- **Category**: `POOL-CONTAM`
- **Rendered** (mastery=4): "Who directed Grave of the Fireflies (1988)?" → distractors include "Yoko Kanno" (composer, not a director or mangaka). Yoko Kanno is a music composer who appears because she's in the creator_names_long pool.
- **Issue**: The creator_names_long pool mixes mangaka (Toriyama, Kishimoto, Oda) with anime directors (Miyazaki, Takahata, Hosoda) and at least one composer (Yoko Kanno). For director-specific questions, a composer distractor is trivially eliminable. MINOR because the pool is large enough that only 1–2 questions are affected.

---

### NIT

- **Fact**: Multiple facts in `bracket_years` pool
- **Category**: `NUMERIC-WEAK`
- **Rendered** (mastery=0): "In what year was the Shogakukan Manga Award first presented?" → options: 1955, 1927, 1961
- **Issue**: Year 1927 (28 years before correct answer of 1955) and 1961 (6 years after) are reasonable but the range is asymmetric. At mastery 0 with only 3 options, players with any cultural knowledge can often narrow to 2. Not severe given the pool size.

---

- **Fact**: `am_jjk_gojo` and similar "most popular character" facts
- **Category**: `AMBIGUOUS-Q`
- **Rendered**: Q contains "became one of the most popular anime characters" — phrasing is subjective.
- **Issue**: "Most popular" claims for characters are opinion-based. The question works because Gojo Satoru is unambiguously the most discussed character, but the phrasing could be contested.

---

## Expected vs Actual
Expected moderate pool contamination risk in creator_names. Found one confirmed POOL-CONTAM instance (Yoko Kanno in director questions) and one clear non-title distractor ("Best Animated Feature") appearing in a title pool. Superlative questions are present but generally anchored by verifiable records (Guinness, sales figures). No broken grammar. Overall quality exceeds the pop-culture average.

## Notes
- The creator_names_long pool should have Yoko Kanno separated into a separate `composer_names` pool, or distractors for director questions should be sourced from a director-specific subset.
- "Best Animated Feature" appearing as a distractor in `anime_series_titles_long` suggests one of the synthetic distractors is an award label that was mistakenly added to a title pool.
- Deck is otherwise well-constructed with strong factual sourcing.
