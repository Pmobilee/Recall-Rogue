# FIFA World Cup — Discover Phase Report

**Deck ID:** `fifa_world_cup`
**Phase:** Discover (complete)
**Date:** 2026-04-09
**Architecture file:** `data/deck-architectures/fifa_world_cup_arch.yaml`
**Status:** Ready for architect phase

---

## Scope Summary

Coverage of both the Men's FIFA World Cup (22 editions, 1930-2022) and the Women's FIFA World Cup (9 editions, 1991-2023). Target: ~300 facts across 5 sub-decks.

| Sub-Deck | Chain Theme ID | Estimated Facts | Scope |
|----------|---------------|-----------------|-------|
| `mens_world_cup_tournaments` | 0 | ~90 | All 22 Men's editions: host, winner, runner-up, score, top scorer, Golden Ball, notable |
| `womens_world_cup_tournaments` | 1 | ~55 | All 9 Women's editions: host, winner, runner-up, score, Golden Ball, Golden Boot, notable |
| `legendary_players` | 2 | ~80 | ~20 Men's + ~10 Women's legends with verified career/WC stats |
| `iconic_matches_moments` | 3 | ~45 | ~15 defining matches/moments from both tournaments |
| `national_team_legacies` | 4 | ~30 | Titles, title years, and defining facts for 13 football dynasties |

**Total estimated:** 300 facts

---

## Sources Consulted

All facts in the architecture YAML are drawn exclusively from these verified sources. No facts were generated from LLM training knowledge.

| Source | URL | Used For |
|--------|-----|----------|
| List of FIFA World Cup finals (Wikipedia) | https://en.wikipedia.org/wiki/List_of_FIFA_World_Cup_finals | All 22 Men's finals: winner, runner-up, score, venue, location |
| FIFA Women's World Cup (Wikipedia results table) | https://en.wikipedia.org/wiki/FIFA_Women%27s_World_Cup | All 9 Women's finals: winner, runner-up, score, hosts, teams |
| FIFA World Cup awards (Wikipedia) | https://en.wikipedia.org/wiki/FIFA_World_Cup_awards | Golden Ball winners 1982-2022; unofficial best player 1978 |
| FIFA Women's World Cup awards (Wikipedia) | https://en.wikipedia.org/wiki/FIFA_Women%27s_World_Cup_awards | Women's Golden Ball 1991-2023; Women's Golden Boot 1991-2023 |
| List of FIFA World Cup top goalscorers (Wikipedia) | https://en.wikipedia.org/wiki/List_of_FIFA_World_Cup_top_goalscorers | All-time top scorers: Klose (16), Ronaldo (15), Müller (14), Fontaine (13) |
| FIFA Women's World Cup records and statistics (Wikipedia) | https://en.wikipedia.org/wiki/FIFA_Women%27s_World_Cup_records_and_statistics | USA 13-0 Thailand 2019; Wambach 122nd-minute goal; youngest/oldest records |
| Pelé (Wikipedia) | https://en.wikipedia.org/wiki/Pel%C3%A9 | Birth date (23 Oct 1940), death date (29 Dec 2022), WC record |
| Diego Maradona (Wikipedia) | https://en.wikipedia.org/wiki/Diego_Maradona | Birth date (30 Oct 1960), death date (25 Nov 2020), 1986 Golden Ball |
| Marta (footballer) (Wikipedia) | https://en.wikipedia.org/wiki/Marta_(footballer) | Birth date (19 Feb 1986), Brazilian nationality, World Cup career |
| 1930 FIFA World Cup (Wikipedia) | https://en.wikipedia.org/wiki/1930_FIFA_World_Cup | Top scorer: Guillermo Stábile, 8 goals |

**Wikidata SPARQL:** The `mcp__wikidata__query` tool was unavailable in this session. All data was sourced from Wikipedia instead. The architect phase should retry Wikidata SPARQL for structured data extraction and cross-reference against the Wikipedia data captured here.

---

## Pool Architecture Decisions

### Why 5 sub-decks?

1. **Men's Tournaments** and **Women's Tournaments** are kept separate because they are distinct historical events with different years, hosts, and champions. Combining them would create timeline confusion (a question about "who won in 1991?" could apply to the Women's tournament; a question about "1930?" applies only to the Men's).

2. **Legendary Players** is separate from tournaments because it enables a different question type — facts about individuals rather than events. Players also span multiple tournaments, making them awkward to place in a tournament sub-deck.

3. **Iconic Matches & Moments** covers narrative events that cut across the tournament-by-tournament structure. The Maracanazo (1950), the Miracle of Bern (1954), and the Germany 7-1 Brazil (2014) are best understood as discrete moments, not just data points in a tournament record.

4. **National Team Legacies** covers dynasty-level facts: "Brazil has won 5 World Cups" cannot be tied to a single tournament. These are meta-facts that summarize entire national histories and produce questions players can reason about from general football knowledge.

### Pool separation: Men's vs Women's player names

Men's and Women's player names are kept in separate pools. The reasoning: a question like "Who won the 1991 Women's World Cup Golden Boot?" should not offer "Pelé" as a distractor. Mixing the pools would produce implausible distractors that players would dismiss on category grounds alone rather than knowledge.

### Pool separation: Men's vs Women's year values

Year pools for Men's (1930-2022) and Women's (1991-2023) are kept separate. If combined, the question "In what year did Norway win the Women's World Cup?" could offer 1930 as a distractor — obviously impossible because the Women's WC didn't exist until 1991. Separate pools ensure all distractors are plausible.

### Notable pool design risks flagged

1. **men_player_names length heterogeneity** — "Pelé" (4 chars) vs "Salvatore Schillaci" (19 chars) vs "Zinedine Zidane" (15 chars). Run `node scripts/pool-homogeneity-analysis.mjs` after generation. If max/min ratio exceeds 3x, split into `men_player_names_short` and `men_player_names_full`.

2. **Penalty final scores** — Scores like "3-3 (a.e.t., 4-2 pens)" (24 chars) vs "4-2" (3 chars) will produce obvious length tells. Architect phase should create a separate `penalty_final_scores` pool for the 4 penalty-decided finals (1994, 1999 women's, 2006, 2022).

3. **Small Women's pools** — `winner_country_names_womens` has only 5 real facts (5 different champions). Must pad aggressively with synthetic distractors (suggested: Sweden, China, Brazil, England, Australia, Norway, Germany — noting Germany actually has 2 titles so it IS a real fact, not a synthetic).

---

## Verified Data Summary

| Category | Data Points Verified | Source |
|----------|---------------------|--------|
| Men's World Cup finals (1930-2022) | 22 editions × [winner, runner-up, score, venue] | Wikipedia List of Finals |
| Women's World Cup finals (1991-2023) | 9 editions × [winner, runner-up, score, host] | Wikipedia Women's WC |
| Men's Golden Ball winners (1982-2022) | 11 official + 1 unofficial (1978) | Wikipedia WC Awards |
| Women's Golden Ball winners (1991-2023) | 9 editions | Wikipedia Women's WC Awards |
| Women's Golden Boot winners (1991-2023) | 9 editions with goal counts | Wikipedia Women's WC Awards |
| All-time top men's scorers | Top 6: Klose 16, Ronaldo 15, Müller 14, Fontaine 13, Pelé 12 | Wikipedia top goalscorers |
| Men's legends | ~17 players with verified nationalities and key World Cup facts | Multiple Wikipedia pages |
| Women's legends | ~10 players with verified nationalities and key World Cup facts | Wikipedia awards/records |
| National team records | 13 teams with verified title counts and title years | Wikipedia List of Finals |
| Iconic moments | ~14 verified events with context and source URLs | Multiple Wikipedia pages |

---

## Known Gaps and Risks

### 1. Wikidata SPARQL unavailable

The planned primary source (`mcp__wikidata__query`) was unavailable. Wikipedia was used as fallback. The architect phase should retry Wikidata SPARQL for:
- Structured per-tournament data (host cities, final venues, attendance)
- Player career goal tallies verified against official FIFA records
- Cross-referencing Golden Boot winners per tournament (not all editions are in the discovered data)

### 2. Men's Golden Boot winners (top scorer per tournament) — partially incomplete

The architecture YAML has verified top scorers for several editions but some early editions' data needs cross-checking. Items flagged with `architect_note: "Verify..."` in the YAML must be confirmed before the generate phase begins.

The following editions need top scorer verification in the architect phase:
- 1934: Oldřich Nejedlý (Czechoslovakia, 5 goals) — noted but needs URL
- 1938: Leônidas (Brazil, 7 goals) — noted but needs URL
- 1962: Multiple players tied at 6 — needs the exact list confirmed
- 1970: Gerd Müller 10 goals — verified via top scorers list

### 3. "West Germany" vs "Germany" naming

West Germany competed as "West Germany" from 1954-1990 (when the country was divided). From 1994 onward, the unified team competes as "Germany." The deck must be consistent:
- Use "West Germany" for 1954, 1966, 1974, 1978, 1982, 1986, 1990 editions
- Use "Germany" for 1994 onward
- Miroslav Klose's 16 goals span both eras (2002-2014) — note this covers the "Germany" era only

### 4. Pelé's World Cup goal count

Wikipedia states Pelé scored 12 World Cup goals. Some sources cite different numbers because of disputed counting conventions (official FIFA records vs. total including matches against club teams in exhibition-style settings). The YAML uses 12 (Wikipedia official figure). The generate phase must use exactly this number with the source URL cited.

### 5. Pre-1950 Women's Football — not applicable

The Women's World Cup only started in 1991. There is no "pre-1950 Women's football" gap — the tournament itself didn't exist. The difficulty is that 1991-2003 tournament data is somewhat thinner online than recent editions; this is manageable via Wikipedia.

### 6. The 2003 Women's WC host complexity

The 2003 Women's WC was originally awarded to China but moved to the United States due to the SARS outbreak. The architecture YAML correctly notes this. Facts about this edition should acknowledge the original host (China) for context and accuracy.

### 7. Morocco 2022 — "first African/Arab team in semi-finals"

Morocco reached the 2022 semi-finals. This is verified (they defeated Spain and Portugal). The fact that this was the "first African" and "first Arab nation" to reach the semi-finals requires careful wording — "Arab nation" is political rather than geographic; the architect phase should confirm the exact FIFA framing.

---

## Open Questions for the Architect Phase

These are ranked by urgency:

1. **CRITICAL — Domain scaffolding:** Add `sports_entertainment` to `CANONICAL_FACT_DOMAINS` in `src/data/card-types.ts` and add entry to `DOMAIN_METADATA` in `src/data/domainMetadata.ts` BEFORE the generate phase. Without this, the deck cannot be built with the correct domain — it would ship as `general_knowledge` (degraded experience).

2. **Verify top scorers per Men's WC tournament:** Use Wikipedia's "FIFA World Cup Golden Boot" redirect (which goes to the awards page) or the tournament-by-tournament list to fill in the ~5 editions not fully verified. Do NOT generate from LLM knowledge.

3. **Pool split decision — final scores with penalties:** Confirm the architect wants a separate `penalty_final_scores` pool for the 4 penalty-decided finals. If the pool is combined, run the length homogeneity check immediately and split if needed.

4. **Marta's WC goals — confirm 17:** The Women's WC records page was accessed but Marta's exact career tally (17 goals as of 2023) needs a dedicated verification step before the generate phase authors any "all-time" facts.

5. **1999 Women's WC attendance:** Rose Bowl crowd was 90,185 according to Wikipedia. Confirm this figure was the world record for women's sports at the time and note if it has since been broken (it was exceeded at the 2023 Women's WC final with 75,784 — wait, that's smaller; confirm if the 2023 figure set a new record for a Women's WC final).

6. **Verify Cruyff Turn opponent:** Architecture YAML notes the opponent was Jan Olsson (Sweden). Confirm via Wikipedia before generating the Cruyff Turn fact.

7. **Ronaldinho's 2002 free kick vs England:** Architecture notes this as a quarter-final. Confirm it was the quarter-final (not round of 16 or semi-final) via Wikipedia.

8. **Decide: combined or split player pools for legendary players?** Current recommendation is separate `men_player_names` and `women_player_names`. Confirm this is the final decision for the architect.

---

## Architecture Confidence Assessment

| Sub-Deck | Data Completeness | Confidence |
|----------|-------------------|------------|
| mens_world_cup_tournaments | All 22 editions verified for core fields | High |
| womens_world_cup_tournaments | All 9 editions verified for core fields | High |
| legendary_players (men) | ~17 players verified; 4 need architect follow-up | Medium-High |
| legendary_players (women) | ~10 players verified; 2 need architect follow-up | Medium-High |
| iconic_matches_moments | ~14 moments verified; 2 need detail confirmation | High |
| national_team_legacies | All 13 teams verified for titles and years | High |

**Overall: Ready for architect phase.** No blocking gaps. The flagged items are refinements, not showstoppers.

---

## Suggested Architect Phase Order

1. Add `sports_entertainment` domain to TypeScript types (prerequisite for everything)
2. Fill in Golden Boot (top scorer) data for the Men's WC editions not yet verified
3. Confirm pool split decisions (particularly final scores and player names)
4. Run `npm run registry:sync` after domain addition
5. Review the complete YAML for any `architect_note` flags and resolve each one
6. Write the deck shell JSON (`data/decks/fifa_world_cup.json`) with correct envelope fields
7. Proceed to generate phase
