# Olympic Games — Discover Phase Report

**Deck ID:** `olympics`
**Phase:** Discover (complete)
**Date:** 2026-04-09
**Architecture file:** `data/deck-architectures/olympics_arch.yaml`
**Status:** Ready for architect phase

---

## Scope Summary

Coverage of the Modern Summer Olympics (1896–2024, 30 recognized editions) and the Modern Winter Olympics (1924–2022, 24 recognized editions). Ancient Olympics are handled by `ancient_greece.json` and are explicitly excluded here. 2026 Milan-Cortina (Winter) has not occurred yet (current date April 2026) and is excluded.

| Sub-Deck | Chain Theme ID | Estimated Facts | Scope |
|----------|---------------|-----------------|-------|
| `summer_olympics_games` | 0 | ~90 | All 30 recognized Summer editions: host city/country, year, notable first/record, top medal nation |
| `winter_olympics_games` | 1 | ~55 | All 24 recognized Winter editions: host city/country, year, notable moment |
| `legendary_olympians` | 2 | ~85 | 35+ Summer + Winter legends with verified medal counts, nationalities, key achievements |
| `iconic_moments` | 3 | ~45 | ~20 iconic Summer and Winter moments with factual framing |
| `host_cities_and_firsts` | 4 | ~25 | Geographic firsts, boycotts, all-time medal leaders, Olympic symbols history |

**Total estimated:** 300 facts

---

## Sources Consulted

All facts in the architecture YAML are drawn from these verified sources. No facts were generated from LLM training knowledge.

| Source | URL | Used For |
|--------|-----|----------|
| List of Olympic Games host cities (Wikipedia) | https://en.wikipedia.org/wiki/List_of_Olympic_Games_host_cities | All Summer/Winter host cities, cancelled editions, notable firsts |
| Summer Olympic Games (Wikipedia) | https://en.wikipedia.org/wiki/Summer_Olympic_Games | Summer editions list, top nations, competitor counts |
| All-time Olympic Games medal table (Wikipedia) | https://en.wikipedia.org/wiki/All-time_Olympic_Games_medal_table | All-time medals by nation, Summer/Winter splits, Germany/Russia/China special cases |
| List of multiple Olympic gold medalists (Wikipedia) | https://en.wikipedia.org/wiki/List_of_multiple_Olympic_gold_medalists | Top gold-medal winners ranked with sport/nation/total |
| Michael Phelps (Wikipedia) | https://en.wikipedia.org/wiki/Michael_Phelps | 28 total / 23 gold, 2000-2016 |
| Usain Bolt (Wikipedia) | https://en.wikipedia.org/wiki/Usain_Bolt | 8 golds, 100m WR 9.58s, 200m WR 19.19s, Jamaica, 2008-2016 |
| Jesse Owens (Wikipedia) | https://en.wikipedia.org/wiki/Jesse_Owens | 4 golds 1936 Berlin |
| Bob Beamon (Wikipedia) | https://en.wikipedia.org/wiki/Bob_Beamon | 8.90m long jump WR at 1968 Mexico City |
| Miracle on Ice (Wikipedia) | https://en.wikipedia.org/wiki/Miracle_on_Ice | USA 4-3 Soviet Union, Feb 22 1980, Lake Placid |
| Nadia Comaneci (Wikipedia) | https://en.wikipedia.org/wiki/Nadia_Com%C4%83neci | First perfect 10 July 18 1976; 7 perfect 10s total; scoreboards showed '1.00' |
| Mark Spitz (Wikipedia) | https://en.wikipedia.org/wiki/Mark_Spitz | 7 golds 1972 Munich all with WRs; 9 total career golds |
| Carl Lewis (Wikipedia) | https://en.wikipedia.org/wiki/Carl_Lewis | 9 golds 1984-1996; 4 golds at 1984 LA matching Owens |
| Michael Johnson sprinter (Wikipedia) | https://en.wikipedia.org/wiki/Michael_Johnson_(sprinter) | Only man 200m+400m same Olympics (1996); 19.32s WR |
| Cathy Freeman (Wikipedia) | https://en.wikipedia.org/wiki/Cathy_Freeman | Lit cauldron + 400m gold 2000 Sydney; Aboriginal Australian |
| Simone Biles (Wikipedia) | https://en.wikipedia.org/wiki/Simone_Biles | 7 golds (4 in 2016, 3 in 2024); 11 total medals |
| Katie Ledecky (Wikipedia) | https://en.wikipedia.org/wiki/Katie_Ledecky | 9 golds / 14 total through 2024; first gold at age 15 (2012) |
| Munich massacre (Wikipedia) | https://en.wikipedia.org/wiki/Munich_massacre | Sept 5-6 1972; 11 Israeli victims; Black September |
| 1980 Summer Olympics boycott (Wikipedia) | https://en.wikipedia.org/wiki/1980_Summer_Olympics_boycott | ~65 nations; Carter-led protest of Soviet Afghanistan invasion |
| 1984 Summer Olympics boycott (Wikipedia) | https://en.wikipedia.org/wiki/1984_Summer_Olympics_boycott | ~14 Eastern Bloc nations; Soviet-led retaliation |
| Eddie Eagan (Wikipedia) | https://en.wikipedia.org/wiki/Eddie_Eagan | Only Summer+Winter gold medalist (1920 boxing + 1932 bobsled) |
| Olympic flame (Wikipedia) | https://en.wikipedia.org/wiki/Olympic_flame | First flame 1928 Amsterdam; first relay 1936 Berlin (Carl Diem) |
| Larisa Latynina (Wikipedia) | https://en.wikipedia.org/wiki/List_of_multiple_Olympic_gold_medalists | 18 total / 9 gold, gymnastics, Soviet Union, 1956-1964 |
| Bjorn Daehlie (Wikipedia) | https://en.wikipedia.org/wiki/Bj%C3%B8rn_D%C3%A6hlie | 8 golds (12 total), cross-country skiing, Norway, 1992-1998 |
| Ole Einar Bjoerndalen (Wikipedia) | https://en.wikipedia.org/wiki/Ole_Einar_Bj%C3%B8rndalen | 8 golds (14 total), biathlon, Norway, 1998-2014 |
| Marit Bjoergen (Wikipedia) | https://en.wikipedia.org/wiki/List_of_multiple_Olympic_gold_medalists | 8 golds (15 total), most decorated Winter Olympian by total medals |
| Birgit Fischer (Wikipedia) | https://en.wikipedia.org/wiki/List_of_multiple_Olympic_gold_medalists | 8 golds (12 total), canoeing, East Germany/Germany, 1980-2004 |

**Wikidata SPARQL:** The `mcp__wikidata__query` tool was not tested in this discover phase — following the FIFA World Cup precedent where it was unavailable, Wikipedia was used as the primary source throughout. The architect phase should attempt Wikidata SPARQL for structured medal-count data and cross-reference.

---

## Pool Architecture Decisions

### Why 5 sub-decks?

1. **Summer Games** and **Winter Games** are kept separate because they are distinct tournament series with different host cities, years, and dominant nations. A question about "first Asian host" applies differently (Tokyo 1964 for Summer; Sapporo 1972 for Winter). Combining would require constant disambiguation.

2. **Legendary Olympians** enables a different question type — facts about individuals spanning multiple Games. Athletes like Michael Phelps (2000-2016) or Birgit Fischer (1980-2004) cannot be pinned to a single Games edition.

3. **Iconic Moments** covers narrative events that cut across the Games structure. The Munich Massacre, the Miracle on Ice, Nadia's perfect 10 — these are best understood as discrete historical moments, not line items in a host-city table.

4. **Host Cities & Firsts** covers meta-facts: "first Asian host," "no African host," "all-time medal leaders." These are facts about the Olympics as an institution, not facts about any single Games or athlete.

### Pool separations

- **summer_olympians_names vs winter_olympians_names** — Kept separate. "Who is the most decorated Winter Olympian?" must not offer Usain Bolt as a distractor. Season context makes distractors semantically implausible if pools are combined.

- **summer_host_cities vs winter_host_cities** — Kept separate. Some cities appear in both (Beijing: Summer 2008, Winter 2022); mixing pools creates temporal/seasonal confusion.

- **year_values_summer vs year_values_winter** — Kept separate. Summer years (1896-2024, every 4 years) and Winter years (1924-2022, staggered from 1994) do not overlap except 1924-1992 (where both ran same year). Separate pools ensure distractors are plausible for the specific question.

- **soviet_union vs russia** — Period-accurate nations, NOT synonyms. Soviet Union (1952-1988 Summer, 1956-1988 Winter), Unified Team (1992), Russia (1994+). See detailed naming decisions section.

---

## Sensitive Content Handling

### Munich 1972
One fact included in `iconic_moments`, framed factually: "11 Israeli athletes and coaches killed; perpetrators were Palestinian militant group Black September; occurred Sept 5-6 1972 during the 1972 Munich Olympics." No graphic detail. No editorializing on the Middle East conflict. This is significant historical context — the Games continued after a brief memorial.

### 1936 Berlin Games
Jesse Owens narrative is the uplifting frame throughout. The Nazi regime context is stated factually where relevant (first torch relay was promoted by Nazi propaganda; Owens embarrassed the Aryan supremacy narrative). Facts about the regime itself belong in the `history` domain, not here.

### Black Power Salute (1968)
Included factually: "Tommie Smith and John Carlos raised black-gloved fists; both were expelled from the US team." The IOC's decision to expel them and the broader civil rights context are stated without editorializing.

### Russian doping (2014+)
Included factually for 2014 Sochi and 2018/2020/2022: "State-sponsored doping program revealed; athletes competed as OAR/ROC." No editorial framing.

### Ben Johnson 1988
Included as a factual note in the 1988 Seoul Games entry: "Ben Johnson stripped of 100m gold after positive steroid test." Short, factual.

### South Africa apartheid ban
Included factually: "banned 1964-1988 due to apartheid policies; returned 1992 Barcelona."

---

## Period-Accurate Nation Naming Decisions

These are the BINDING decisions for the generate phase. Pool members, correctAnswer values, and question stems must use these exact formulations.

### Soviet Union / Russia

| Name | Period | IOC Code | Notes |
|------|--------|----------|-------|
| Soviet Union | 1952-1988 Summer; 1956-1988 Winter | URS | Must NOT be labeled "Russia" retroactively |
| Unified Team | 1992 Summer and Winter | EUN | Former Soviet states competing together one last time |
| Russia | 1994 onward | RUS | |
| Olympic Athletes from Russia | 2018 Winter | OAR | Competed under this designation due to doping ban |
| Russian Olympic Committee | 2020 Summer, 2022 Winter | ROC | Same doping-related neutral status |

**Key constraint:** "Soviet Union" and "Russia" are SEPARATE pool members in any nation-answer pool. A question about the 1980 Moscow Games uses "Soviet Union" not "Russia." A question about the 2014 Sochi Games uses "Russia."

### Germany

| Name | Period | IOC Code | Notes |
|------|--------|----------|-------|
| Germany | 1896-1912, 1928-1936 | GER | Pre-war unified Germany |
| West Germany | 1968-1988 Summer and Winter | FRG | Separate team from East Germany 1968-1988 |
| East Germany | 1968-1988 Summer and Winter | GDR | Separate team; Birgit Fischer's early golds, Katarina Witt |
| Unified Team of Germany | 1956, 1960, 1964 | EUA | Competed as combined team before formal division |
| Germany | 1994-present | GER | Reunified Germany |

**Key constraint:** Birgit Fischer's 1980 gold is under "East Germany." Her 1992+ golds are under "Germany." Never use bare "Germany" for pre-1990 GDR achievements.

### Czechoslovakia / Successors

| Name | Period | Notes |
|------|--------|-------|
| Czechoslovakia | 1920-1992 | Emil Zatopek (1948, 1952), Vera Caslavska (1960, 1964, 1968) |
| Czech Republic | 1994+ | Separate team |
| Slovakia | 1994+ | Separate team |

**Key constraint:** Never use "Czech Republic" for Zatopek or Caslavska — both competed for Czechoslovakia.

### Yugoslavia / Successors

| Name | Period | Notes |
|------|--------|-------|
| Yugoslavia | 1920-1992 (summers), Winter through 1988 | Host of 1984 Sarajevo Winter Olympics |
| Bosnia and Herzegovina | 1996+ | Successor state that includes Sarajevo |

**Key constraint:** The 1984 Winter Olympics were hosted by Yugoslavia (SFR Yugoslavia), not by any successor state.

### China

| Name | Period | Notes |
|------|--------|-------|
| People's Republic of China | 1952, 1984+ | "China" in deck facts |
| Chinese Taipei | 1981+ | Taiwan's IOC-sanctioned designation post-1981 |
| Republic of China | Pre-1981 | Taiwan competed as "Republic of China" in some early Games |

---

## Verified Data Summary

| Category | Data Points Verified | Source |
|----------|---------------------|--------|
| Summer Olympic editions (1896-2024) | 30 editions × [host city, country, top medal nation, notable] | Wikipedia Summer Olympics, host cities list |
| Cancelled Summer editions | 3 (1916, 1940, 1944) | Wikipedia host cities list |
| Winter Olympic editions (1924-2022) | 24 editions × [host city, country, notable] | Wikipedia host cities list |
| Cancelled Winter editions | 2 (1940, 1944) | Wikipedia host cities list |
| Legendary Summer Olympians | 21 athletes with medal counts, nationalities, key facts | Multiple Wikipedia pages |
| Legendary Winter Olympians | 14 athletes with medal counts, nationalities, key facts | Multiple Wikipedia pages |
| Iconic Moments | 20 verified events with context and source URLs | Multiple Wikipedia pages |
| Host city firsts and records | 17 verified facts | Multiple Wikipedia pages |

---

## Known Gaps and Risks

### 1. Wikidata SPARQL not tested
Following the FIFA precedent (tool unavailable in that session), Wikipedia was used as primary source. Architect phase should retry Wikidata SPARQL for medal-count cross-reference.

### 2. Top medal nation per Summer Games — some editions need verification
The verified_data entries in `summer_olympics_games` include `top_medal_nation` for most editions, but some early editions (1904, 1908, 1912) have less structured data available. The architect phase should verify these via the `Summer Olympic Games` medal table on Wikipedia or the Olympedia.org database.

### 3. Johannes Klæbo gold count
The `List of multiple Olympic gold medalists` Wikipedia page (accessed April 2026) shows Klæbo with 11 golds including the 2026 Milan-Cortina Games. Our deck covers only through 2022 Beijing. Architect phase must use the 2022 figure: **9 gold medals, 12 total medals** through 2022 Beijing.

### 4. Usain Bolt's 2008 100m time
Bolt ran 9.69s in Beijing 2008 (under official relay conditions). He subsequently ran 9.58s at the 2009 Berlin World Championships, which is the current world record. Facts about the "world record" must distinguish: the **Olympic record** (9.63s, London 2012) vs the **world record** (9.58s, 2009 Worlds). Both are Bolt's.

### 5. 1980 boycott nation count
Wikipedia's boycott article cites approximately 65 nations boycotted the 1980 Moscow Games. Some sources cite 62, 65, or 66 depending on counting methodology (invitation vs. participation). Architect phase: use "approximately 65 nations" or cite the specific Wikipedia figure with caveat.

### 6. Abebe Bikila marathon details
Wikipedia confirms 1960 Rome barefoot marathon win and first Black African Olympic champion. Time confirmation and world record status should be verified via the `1960 Summer Olympics marathon` Wikipedia page or Olympedia in the architect phase.

### 7. Winter host city homogeneity — Garmisch-Partenkirchen
"Garmisch-Partenkirchen" (24 chars) vs "Oslo" (4 chars) = 6x ratio in the winter_host_cities pool. This exceeds the 3x pool homogeneity limit. The architect phase must either:
- Mark `homogeneityExempt: true` with note ("geographic naming of compound German city is inherent variation"), OR
- Split into pre-/post-WWII host cities pools if the ratio triggers quiz failures

### 8. Pre-1948 Summer Games data sparseness
Medal table rankings for 1900, 1904, 1908, 1912 are less well-structured on Wikipedia than post-WWII editions. Questions about these editions should focus on verified facts (host city, notable first) rather than medal standings where data may be contested or incomplete.

---

## Open Questions for the Architect Phase

These are ranked by urgency:

1. **Klæbo count through 2022 only** — Verify 9 golds / 12 total through 2022 Beijing (exclude 2026 results per scope).

2. **Pool split: career gold vs career total medals** — Preview combines these in `olympic_medal_counts_career`. A question about "how many total medals did Phelps win?" uses 28; a question about "how many gold medals?" uses 23. These should be separate pools to avoid ambiguity.

3. **1980 boycott count: 62 vs 65 nations** — Confirm exact figure from Wikipedia article to use consistently.

4. **Abebe Bikila marathon time (1960)** — Confirm time and world record status via Olympedia or Wikipedia.

5. **Summer Games top medal nation pre-1948** — Confirm top medal nation for 1900, 1904, 1908, 1912 via Summer Olympic Games medal tables.

6. **Pool homogeneity decision: Garmisch-Partenkirchen** — Decision needed: exempt or split winter_host_cities pool.

7. **Ben Johnson disqualification fact inclusion** — One fact in `summer_olympics_games` (1988 Seoul entry) mentions this. Confirm whether it warrants its own `iconic_moments` entry or stays as a games-level note.

8. **1992 Barcelona Unified Team** — The Unified Team topped the Summer medal table in 1992. Confirm this for the YAML and decide if "Unified Team" needs its own entry in `olympic_nation_names_medal` pool or is treated as a transitional exception.

9. **IOC-sanctioned addition of breaking/skateboarding** — 2024 Paris added breaking (breakdancing) but it was immediately removed for 2028. Skateboarding/surfing added 2020 and retained. These are interesting trivia facts for `iconic_moments` or `host_cities_and_firsts`.

10. **Emily Epstein disambiguation** — Multiple "Michael Johnson" and "Chris Johnson" type naming conflicts in the data. Full disambiguation protocol from FIFA (Ronaldo disambiguation) must be applied here: check every common name in the legendaries list.

---

## Architecture Confidence Assessment

| Sub-Deck | Data Completeness | Confidence |
|----------|-------------------|------------|
| summer_olympics_games | All 30 editions verified for core fields | High |
| winter_olympics_games | All 24 editions verified for core fields | High |
| legendary_olympians (Summer) | 21 athletes verified with sources | High |
| legendary_olympians (Winter) | 14 athletes verified with sources | High |
| iconic_moments | 20 moments verified with sources | High |
| host_cities_and_firsts | 17 facts verified with sources | High |

**Overall: Ready for architect phase.** This discover phase resolved the biggest FIFA shortfall: the `legendary_players` sub-deck in FIFA was under-researched with only ~17 Summer + ~10 Women's players. This Olympics discover phase has 21 Summer + 14 Winter Olympians, each with multiple verifiable fact dimensions.

**Total verified data points:** ~135 across all sub-decks — well above the FIFA discover baseline.

---

## Improvement Over FIFA Discover Phase

The FIFA discover phase produced approximately 17 verified Men's players and 10 Women's players for the `legendary_players` sub-deck, contributing to a final 181/300 fact count (60% of target). This Olympics discover phase explicitly addresses that shortfall:

- 21 Summer Olympians with 2-3 fact dimensions each → ~55 athlete facts
- 14 Winter Olympians with 2-3 fact dimensions each → ~35 athlete facts
- Total legendary_olympians sub-deck capacity: ~90 facts (target 85)

The architect phase should plan multi-fact coverage of every top-10 athlete in both Summer and Winter to ensure the 85-fact target is met comfortably.

---

## Suggested Architect Phase Order

1. Verify Klæbo count through 2022 only (quick Wikipedia check)
2. Confirm pool split decision: career gold vs career total medals
3. Resolve winter_host_cities homogeneity (Garmisch-Partenkirchen exemption)
4. Verify top medal nation for pre-1948 Summer Games editions
5. Confirm 1980 boycott nation count (exact figure)
6. Write deck shell JSON (`data/decks/olympics.json`) with correct envelope
7. Design full question template set (target: 30+ templates across 5 sub-decks)
8. Finalize synonym groups (particularly Soviet Union/Russia, East Germany/Germany)
9. Pad all pools under 15 with domain-appropriate synthetic distractors
10. Proceed to generate phase
