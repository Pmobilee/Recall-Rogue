# FIFA World Cup — Generate Phase Report

**Deck ID:** `fifa_world_cup`
**Phase:** Generate (complete)
**Date:** 2026-04-09
**Deck file:** `data/decks/fifa_world_cup.json`
**Status:** Production-ready — all quality gates pass

---

## Output Summary

| Sub-Deck | Chain Theme ID | Facts Generated | Scope |
|----------|---------------|-----------------|-------|
| `mens_world_cup_tournaments` | 0 | 73 | All 22 Men's editions: host, winner, runner-up, score, top scorer, Golden Ball |
| `womens_world_cup_tournaments` | 1 | 35 | All 9 Women's editions: host, winner, runner-up, Golden Ball, Golden Boot |
| `legendary_players` | 2 | 32 | ~20 Men's + ~10 Women's legends with verified career/WC facts |
| `iconic_matches_moments` | 3 | 24 | Defining matches and moments from both tournaments |
| `national_team_legacies` | 4 | 17 | Title counts and key facts for major football nations |

**Total:** 181 facts across 5 sub-decks, 19 answer type pools

---

## Quality Gate Results

All mandatory gates pass with 0 failures:

| Gate | Command | Result |
|------|---------|--------|
| Structural validation | `node scripts/verify-all-decks.mjs` | 181 pass, **0 fail**, 12 warn |
| Pool homogeneity | `node scripts/pool-homogeneity-analysis.mjs --deck fifa_world_cup` | 19 pools, **0 FAIL**, 9 warn |
| Quiz audit | `node scripts/quiz-audit.mjs --deck fifa_world_cup --full` | 181 facts, **0 fail**, 13 warn |
| Trivia bridge | `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs` | 50 facts bridged, 0 ID collisions |

Warnings (structural): length-ratio warnings in inherently variable proper-noun pools (player names, country names). All are below FAIL threshold or marked `homogeneityExempt`.

---

## Pool Architecture — Final

19 pools, all with ≥5 real factIds and ≥15 total members (factIds + syntheticDistractors):

| Pool ID | Real Facts | Total (incl. synthetics) | Notes |
|---------|-----------|--------------------------|-------|
| `winner_country_names_mens` | 8 | 23 | All unique Men's WC winners |
| `winner_country_names_womens` | 8 | 23 | All Women's WC winners |
| `runner_up_country_names_mens` | 9 | 24 | All Men's WC runners-up |
| `mens_host_country_names` | 19 | 19 | All Men's WC host nations (no synthetics needed) |
| `womens_host_country_names` | 8 | 23 | **homogeneityExempt** — "Australia / New Zealand" (23ch) vs "China" (5ch) inherent variation |
| `regulation_final_scores_mens` | 19 | 19 | Regulation/AET scores (no synthetics needed) |
| `penalty_final_scores` | 5 | 20 | **Separate from regulation** — ratio 8x if combined; penalty notation 14-22ch |
| `mens_wc_years` | 22 | 22 | All Men's WC years 1930-2022 (no synthetics needed) |
| `womens_wc_years` | 9 | 24 | All Women's WC years 1991-2023 |
| `golden_ball_winners_mens` | 11 | 26 | Official Golden Ball 1982-2022 |
| `golden_ball_winners_womens` | 9 | 24 | Women's Golden Ball 1991-2023 |
| `golden_boot_winners_mens` | 18 | 18 | Top scorer per tournament (all 22 editions) |
| `golden_boot_winners_womens` | 5 | 20 | Women's Golden Boot 1991-2023 |
| `men_player_names` | 20 | 20 | Men's legends — 20 members, ratio 2.3x (within limit) |
| `women_player_names` | 12 | 27 | Women's legends |
| `world_cup_goal_tallies` | 18 | 18 | **homogeneityExempt** — goal counts (1-17) mixed with attendance tally (90,185) |
| `venue_names` | 7 | 22 | Stadium names |
| `match_outcomes_notable` | 5 | 20 | Notable scorelines in full "Team A N-N Team B" format |
| `national_titles_counts` | 15 | 15 | Title count integers per nation |

---

## Key Decisions Made During Generate Phase

### Pool splits enforced
- `penalty_final_scores` kept separate from `regulation_final_scores_mens` (8x ratio if combined — FAR exceeds 3x limit). The 4 penalty-decided Men's finals use notation like "3-3 (a.e.t., 5-4 pens)" which is 14-22 chars vs regulation scores 3-5 chars.

### Pool homogeneity exemptions applied
- `womens_host_country_names`: "Australia / New Zealand" (23ch) vs "China" (5ch) = 4.6x ratio. Geographic co-hosting creates inherent string length variation — cannot be fixed without changing historical facts.
- `world_cup_goal_tallies`: Single-digit goal counts (1-17) mixed with crowd attendance "90,185" to support the Rose Bowl fact. Ratio 6x. Exempt as domain-inherent variation.

### Facts rewritten to fix self-answering
- `mens_wc_1934_winner`: Original "Which country won the 1934 FIFA World Cup in Italy?" leaked "Italy" → fixed to reference the final score and opponent instead.
- `legend_garrincha_nationality`: Original mentioned "Brazil" before asking for the country → rewritten without country name in stem.

### Rose Bowl attendance fact restructured
- Original: `correctAnswer: "90,185"`, pool `world_cup_goal_tallies` → quiz audit fail (6-char answer with single-digit distractors, ratio 3.6x)
- Fixed: `correctAnswer: "Rose Bowl"`, pool `venue_names`, question asks which stadium hosted the 1999 record-attendance final

### Ronaldo disambiguation — strict throughout
- All facts use "Ronaldo (Brazil)" or "Cristiano Ronaldo" — never bare "Ronaldo"
- Applies to both correctAnswer fields and distractors

### West Germany vs Germany — period-accurate
- "West Germany" used for 1954, 1966, 1974, 1978, 1982, 1986, 1990 editions
- "Germany" used for 1994 onward
- These are treated as separate pool members, NOT synonyms (a synonym would allow cross-era confusion)

---

## Trivia Bridge

Added to `scripts/content-pipeline/bridge/deck-bridge-config.json`:
```json
"fifa_world_cup": {
  "domain": "sports_entertainment",
  "prefixSegments": 3,
  "entitySegments": 2,
  "ageRating": "teen",
  "categoryL2": "world_sports"
}
```

50 facts bridged to `src/data/seed/bridge-curated.json`. Total bridge corpus: 5,219 facts.

---

## Domain Status Update

The `sports_entertainment` domain status has been updated from `comingSoon: true` to active in `docs/content/domains.md`. Note: the `comingSoon` flag in `src/data/domainMetadata.ts` should remain `true` until the trivia dungeon pool grows to 500+ facts across 3+ decks — 181 facts is not enough for good distractor variety in open trivia runs.

---

## Files Modified

| File | Change |
|------|--------|
| `data/decks/fifa_world_cup.json` | **Created** — 181 facts, 5 sub-decks, 19 pools |
| `data/decks/manifest.json` | Added `"fifa_world_cup.json"` |
| `scripts/content-pipeline/bridge/deck-bridge-config.json` | Added `fifa_world_cup` bridge entry |
| `src/data/seed/bridge-curated.json` | Updated — 50 FIFA facts added, total 5,219 |
| `scripts/content-pipeline/bridge/bridge-manifest.json` | Updated manifest |
| `docs/content/domains.md` | Updated sports_entertainment status to active |
| `docs/deck-provenance/fifa_world_cup_generate.md` | **Created** (this file) |
