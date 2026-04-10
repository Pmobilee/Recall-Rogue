# pop_culture — Quiz Audit Findings

## Summary
202 facts, 11 pools. Overall quality is acceptable. The deck's large `bracket_numbers` pool (86 facts) renders correctly via numerical generation with well-calibrated distractors for viewer counts, years, and quantities. The main structural concern is that several small pools (tv_show_names: 3 real facts, meme_viral_names: 4 real, game_titles: 4 real) rely on 75–80% synthetic distractors, which function adequately at mastery 0 but at mastery 3–4 with 5 options, synthetics can feel semantically weak. No broken grammar found. Two factual suspect flags: "first Black superhero" claim for Black Panther, and volatile pricing/viewership figures.

**Issue counts:** BLOCKER 0 / MAJOR 2 / MINOR 3 / NIT 1

---

## Issues

### MAJOR

- **Fact**: `pc_3_charlie_bit_nft_price` @ mastery=0–4
- **Category**: `NUMERIC-WEAK`
- **Rendered** (mastery=0):
  Q: "For how many dollars was the 'Charlie Bit My Finger' video sold as an NFT in 2021?"
   A) 385,000
   B) 760999  ✓
   C) 1,127,000
- **Issue**: The correct answer "760999" is formatted without comma separators while distractors use "385,000" and "1,127,000" with comma formatting. This is a formatting inconsistency within a numeric question that creates a subtle but real tell — the unformatted number "760999" looks distinct from properly formatted distractors. Additionally, an NFT sale price is highly volatile and the fact itself may be outdated as the NFT market collapsed post-2022.

---

- **Fact**: `pc_2_black_panther_significance` @ mastery=0–4
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**:
  Q: "In what year did Black Panther debut as the first Black superhero in American mainstream comics?"
   A) 1966  ✓
- **Issue**: The claim "first Black superhero in American mainstream comics" is disputed. The character Waku, Prince of the Bantu (Dell Comics, 1954) and others arguably predated Black Panther. The question embeds a contested historical claim as a factual stem. The year 1966 for Black Panther's debut in Fantastic Four #52 is correct, but the framing overstates consensus.

---

### MINOR

- **Fact**: pools `tv_show_names`, `meme_viral_names`, `game_titles`, `network_channel_names`
- **Category**: `SYNTHETIC-WEAK`
- **Rendered** (mastery=4, tv_show_names, Fresh Prince/NBC):
  Q: "The Fresh Prince of Bel-Air...originally aired on which network starting in 1990?"
   A) HBO
   B) NBC  ✓
   C) AMC
   D) CBS
   E) Fox
- **Issue**: At mastery 4, pool exhaustion forces synthetic distractors. For network_channel_names this works because all options (HBO, AMC, CBS, Fox) are real and plausible networks. However, for meme_viral_names and game_titles, synthetics dominate so heavily that obscure synthetic entries at mastery 3–4 may be obviously artificial. The dump shows this functioning adequately for network questions; game and meme pools could not be confirmed from the sample.

---

- **Fact**: `pc_0_seinfeld_creator` @ mastery=0–4
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "Who co-created the NBC sitcom Seinfeld alongside Larry David?"
   A) Jerry Seinfeld  ✓
- **Issue**: This question is not ambiguous (Jerry Seinfeld is the correct co-creator), but the embedded context "alongside Larry David" gives away that the answer is NOT Larry David — meaning the pool distractor "Larry David" (if it appears) would be partially self-eliminated by the stem. In the observed dump at mastery 0, the distractors are all actors (Jason Alexander, etc.) rather than Larry David, which is correct. However, the question structure slightly narrows the answer space. This is a NIT elevated to MINOR because 8 similar "who created X alongside Y" questions follow the same pattern.

---

- **Fact**: `pc_0_thewire_creator` @ mastery=0–4
- **Category**: `AMBIGUOUS-Q`
- **Rendered**:
  Q: "Which former Baltimore Sun journalist created The Wire, the HBO drama now widely considered the greatest TV show ever made?"
   A) David Simon  ✓
- **Issue**: "Widely considered the greatest TV show ever made" is contestable (Breaking Bad, The Sopranos are also frequent claims to that title). The editorial is in the stem, not the answer — the creator question is factual. However, embedding the contested superlative in the stem is problematic for educational integrity.

---

### NIT

- **Fact**: `pc_0_ilovelucy_viewers` and similar viewership/ratings facts
- **Category**: `FACTUAL-SUSPECT`
- **Rendered**: Q: "Approximately how many million Americans watched 'Lucy Goes to the Hospital' in 1953?"
   A) {44} ✓
- **Issue**: Historical TV viewership figures from the 1950s have been revised and disputed. "44 million" is the commonly cited figure but the US population in 1953 was ~161 million, so 44 million viewers for a single episode was extraordinary and some sources dispute the methodology. The "approximately" qualifier in the question mitigates this risk. FACTUAL-SUSPECT at low confidence — the established consensus supports this figure.

---

## Expected vs Actual
Expected: synthetic pool weakness (confirmed for network, tv_show names), volatile facts (confirmed: NFT price, viewership), FACTUAL-SUSPECT for Black Panther claim (confirmed). bracket_numbers pool performs better than expected — numerical distractors are well-calibrated and no extreme length-tells observed. Numeric formatting inconsistency (760999 vs. "385,000") was not anticipated.

## Notes
- The NFT price question should either be removed (high volatility) or reformatted: the correct answer should use comma-formatted "$760,999" to match distractor formatting.
- The Black Panther "first Black superhero" claim should be softened to "first Black superhero to headline a major Marvel Comics series" or "first Black superhero in Marvel Comics."
- The bracket_numbers pool is the deck's strongest asset — 86 well-calibrated numeric facts with no apparent contamination.
