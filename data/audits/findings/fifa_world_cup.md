# fifa_world_cup — Quiz Audit Findings

## Summary
214 facts across 5 sub-decks. Quiz dump covers 26 unique facts × 3 mastery levels = 78 rows, all with multi-choice rendering. The deck is generally well-constructed with rich factual content. Issues include: 'England' duplicated in synthetic distractors, the `world_cup_goal_tallies` pool containing an international career goal count (not a WC tally), and a potential `womens_host_country_names` length-tell from the composite "Australia / New Zealand" entry.

**Issue counts:** 0 BLOCKER, 2 MAJOR, 3 MINOR, 0 NIT

---

## Issues

### MAJOR

- **Fact**: `legend_wambach_career_goals` @ mastery=all (world_cup_goal_tallies pool)
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "How many international goals did Abby Wambach score during her career — a world record at the time of her retirement?"
  A) 8 | B) 14 | C) 9 | D) 16 | E) [184]
- **Issue**: The pool is named `world_cup_goal_tallies`, but Abby Wambach's "184" is her total international career goals — not World Cup goals. This fact is misassigned: it's about career international goals, not tournament-specific scoring. The answer "184" also creates a NUMERIC-WEAK issue: all other values in the pool are 3–33 (small tournament tallies), while "184" is nearly 6× the next highest (33). Players unfamiliar with exact counts can identify "184" as the obvious outlier. Additionally, "184" appearing as a distractor in goal-tally questions for other facts (where correct answers are 6–19) makes it trivially eliminable.

---

- **Fact**: `womens_host_country_names` pool @ mastery=all
- **Category**: `LENGTH-TELL`
- **Rendered** (various womens WC host questions):
  Q: "Which co-hosting nations staged the 2023 FIFA Women's World Cup...?"
  A) France | B) China | C) United States | D) Sweden | E) [Australia / New Zealand]
- **Issue**: The pool contains "Australia / New Zealand" (22 chars) alongside single-country names: China (5), Sweden (6), United States (13), France (6). The length ratio across the pool is 4.6× (exceeding the 3× limit). When the question asks about the 2023 co-hosting tournament, the composite entry "Australia / New Zealand" is visually distinct in length from all distractors — a player who doesn't know the answer can identify it by format (two countries with slash = composite host). Additionally, "England" appears twice in the synthetic distractor list for this pool (a duplicate synthetic error).

---

### MINOR

- **Fact**: `womens_host_country_names` pool — synthetic distractors
- **Category**: `DUPLICATE-OPT`
- **Rendered**: (structural — not visible per-quiz unless both drawn simultaneously)
- **Issue**: The synthetic distractors for `womens_host_country_names` include "England" twice: `['Norway', 'England', 'Brazil', 'Japan', 'South Africa', 'Spain', 'Netherlands', 'Italy', 'South Korea', 'Mexico', 'England', 'Portugal']`. At mastery levels where 4–5 distractors are drawn, there is a risk both "England" instances are selected, producing a duplicate in the displayed option list. This is a data quality error in the synthetic list.

---

- **Fact**: `winner_country_names_mens` pool @ mastery=4 (West Germany + Germany facts)
- **Category**: `SYNONYM-LEAK`
- **Rendered** (e.g., `mens_wc_1990_winner` m=4):
  Q: "Which country won the 1990 World Cup...?"
  A: West Germany (correct)
  Potential opts include: Germany (as a pool member from post-1990 wins)
- **Issue**: The `winner_country_names_mens` pool contains both "West Germany" (6 facts: 1954, 1966 final, 1974, 1986 final, 1990 winner and runner-up) and "Germany" (3 facts: 2002 final, 2014 winner, etc.). For a question about a pre-1990 tournament where the correct answer is "West Germany", "Germany" may appear as a distractor — it is the same country under a different historical name, creating a SYNONYM-LEAK where neither option can be confidently eliminated without specific historical knowledge of when Germany reunified. The quiz dump sample for `legend_maradona_1990_final_opponent` (m=4) did not show Germany appearing alongside West Germany in that specific sample, but the pool structure makes this inevitable at some mastery levels.

---

- **Fact**: `womens_wc_2015_score` @ mastery=all (regulation_final_scores_mens pool)
- **Category**: `POOL-CONTAM`
- **Rendered** (m=4):
  Q: "What was the final score when the United States beat Japan in the 2015 Women's World Cup Final — the highest-scoring women's final ever?"
  A) 4-2 | B) [5-2] | C) 1-0 | D) 4-1 | E) 3-0
- **Issue**: This women's final score fact is placed in the `regulation_final_scores_mens` pool. The pool name says "mens" but contains at least one women's tournament score. This is a pool naming/assignment error. If men's and women's final scores are in the same pool, a question about a men's final may draw the 5-2 women's score as a distractor, creating a historically non-existent scoreline appearing plausibly. The issue is minor since final scores are just numbers and cross-gender distraction doesn't affect format, but the pool naming is misleading and the contamination is real.

---

## Expected vs Actual
- Expected: world_cup_goal_tallies contains only WC tournament totals — **actual: "184" is international career goals**
- Expected: womens_host_country_names length ratio < 3× — **actual: 4.6× (FAIL)**
- Expected: no duplicate synthetic distractors — **actual: 'England' appears twice in womens_host_country_names synthetics**
- Expected: West Germany / Germany handled as distinct historical entities — **actual: both in same pool, SYNONYM-LEAK structurally possible**
- Expected: 5 sub-decks populated — **actual: all 5 confirmed non-empty**

## Notes
- The 19 pools overall are well-structured. The `men_player_names`, `golden_ball_winners_mens`, `golden_boot_winners_mens`, and `venue_names` pools render cleanly with semantically coherent distractors.
- The `match_outcomes_notable` pool uses score-format strings ("Brazil 5-2 Sweden", "USA 13-0 Thailand") as answers — these render coherently and the distractors (other notable scores) are format-consistent.
- `national_title_counts` pool (single-digit counts: 1–5) is internally homogeneous and renders cleanly.
- Post-2022 facts (2023 Women's WC: Spain winner, Hinata Miyazawa Golden Boot, Australia/NZ hosts) are factually accurate as of the knowledge cutoff.
- The `winner_country_names_womens` pool correctly distinguishes the US (4 titles: 1991, 1999, 2015, 2019), Germany (2003, 2007), and Spain (2023) — no synonym issues.
