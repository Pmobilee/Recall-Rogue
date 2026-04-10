# fifa_world_cup — Expectations

## Intended Scope
214 facts covering both Men's and Women's World Cups: tournament winners, hosts, scores, legendary players, goal tallies, awards (Golden Ball, Golden Boot), and iconic match moments. Coverage through 2023 Women's World Cup and 2022 Men's World Cup.

## Canonical Source
FIFA official records, Wikipedia. Tournament results, goal counts, and award winners are stable historical facts. Post-2022 data (2023 Women's WC) is included and should be accurate.

## Sub-Deck / Chain Theme List
- `mens_world_cup_tournaments` — 73 facts
- `womens_world_cup_tournaments` — 35 facts
- `legendary_players` — 65 facts
- `iconic_matches_moments` — 26 facts
- `national_team_legacies` — 15 facts

(No `chainThemes` defined — 0)

## Answer Pool Inventory
| Pool ID | Facts | Syn | Total | Notes |
|---|---|---|---|---|
| `mens_host_country_names` | 5 | 12 | 17 | — |
| `womens_host_country_names` | 5 | 12 | 17 | 'Australia / New Zealand' mixed with single countries |
| `winner_country_names_mens` | 40 | 5 | 45 | Contains both 'West Germany' and 'Germany' |
| `winner_country_names_womens` | 16 | 10 | 26 | — |
| `runner_up_country_names_mens` | 5 | 14 | 19 | — |
| `regulation_final_scores_mens` | 11 | 8 | 19 | Used for both men's and women's final scores |
| `penalty_final_scores` | 5 | 10 | 15 | — |
| `men_player_names` | 11 | 18 | 29 | — |
| `women_player_names` | 6 | 12 | 18 | Length ratio 3.0× |
| `mens_wc_years` | 18 | 2 | 20 | — |
| `womens_wc_years` | 8 | 13 | 21 | — |
| `venue_names` | 6 | 13 | 19 | — |
| `national_title_counts` | 10 | 9 | 19 | — |
| `world_cup_goal_tallies` | 20 | 3 | 23 | Contains '184' (international, not WC goals) |
| `golden_ball_winners_mens` | 11 | 4 | 15 | — |
| `golden_ball_winners_womens` | 9 | 6 | 15 | — |
| `golden_boot_winners_mens` | 18 | 5 | 23 | Length ratio 2.8× |
| `golden_boot_winners_womens` | 5 | 13 | 18 | Length ratio 3.0× |
| `match_outcomes_notable` | 5 | 13 | 18 | Contains score-format strings |

## Expected Quality Bar
- 5 sub-decks populated — all confirmed non-empty
- `winner_country_names_mens` mixing 'West Germany' (6 facts) and 'Germany' (3 facts) requires careful distractor assignment to avoid SYNONYM-LEAK
- `womens_host_country_names` contains 'Australia / New Zealand' (composite) alongside single country names
- `world_cup_goal_tallies` pool should contain only World Cup-specific goal counts; Abby Wambach's "184" is international goals, not World Cup goals
- No duplicate synthetic distractors within any single pool

## Risk Areas
1. **SYNONYM-LEAK** — 'Germany' and 'West Germany' both appear in winner_country_names_mens; if Germany appears as distractor when West Germany is correct (or vice versa), eliminating one doesn't help
2. **womens_host_country_names duplicate** — 'England' appears twice in synthetic distractors
3. **'Australia / New Zealand' format inconsistency** — composite host in single-country pool
4. **'184' in world_cup_goal_tallies** — Wambach's 184 are international career goals, not World Cup tournament goals; factual mismatch with pool name
5. **winner_country_names_mens contains 40 facts** — many repeat winners (Brazil 9×, Germany 9×); at low mastery, repeated correct answers from same country
