# pop_culture — Expectations

## Intended Scope
Curated general knowledge covering modern entertainment culture: TV shows, video games, superheroes, viral internet moments, franchise empires, and pop culture icons from the 1950s through 2024.

## Canonical Source
Curated general knowledge. Wikipedia cited per fact.

## Sub-Deck / Chain Theme List
- binge_worthy (chainThemeId 0 — 35 facts): Classic and modern TV shows
- game_on (chainThemeId 1 — 36 facts): Video games and gaming history
- hero_complex (chainThemeId 2 — 30 facts): Superheroes, comics, franchises
- gone_viral (chainThemeId 3 — 31 facts): Internet culture, memes, viral moments
- franchise_empires (chainThemeId 4 — 35 facts): Major franchise IPs and toy brands
- pop_icons (chainThemeId 5 — 35 facts): Pop culture celebrities and milestones

## Answer Pool Inventory
| Pool ID | Facts | Synthetic | Total | Answer Type |
|---|---|---|---|---|
| tv_show_names | 3 | 10 | 13 | TV show names (only 3 real — very thin) |
| game_titles | 4 | 15 | 19 | Game titles (only 4 real) |
| character_names | 5 | 13 | 18 | Character names |
| person_names_creators | 45 | 12 | 57 | Creator/celebrity names |
| company_studio_names | 17 | 10 | 27 | Company/studio names |
| network_channel_names | 4 | 12 | 16 | Network names (only 4 real) |
| franchise_ip_names | 8 | 13 | 21 | Franchise IP names |
| platform_console_names | 12 | 9 | 21 | Console/platform names |
| meme_viral_names | 4 | 15 | 19 | Meme/viral names (only 4 real) |
| genre_format_names | 14 | 8 | 22 | Genre/format labels |
| bracket_numbers | 86 | 0 | 86 | Numeric values (dominant pool) |

## Expected Quality Bar
- 202 facts, heavily numeric (86/202 = 43% in bracket_numbers)
- Multiple small real-fact pools relying heavily on synthetics (tv_show_names: 3 real, meme_viral_names: 4 real)
- Volatile: NFT prices, streaming subscriber counts, box-office grosses, viewership figures

## Known Risk Areas
1. **VOLATILITY (high)**: Many facts concern current records — "best-selling console of all time" (PS2), "highest-grossing film" may have been superseded. NFT prices (Charlie Bit My Finger $760,999) are especially volatile.
2. **SYNTHETIC-WEAK**: tv_show_names (3 real facts), meme_viral_names (4 real), game_titles (4 real), network_channel_names (4 real) — all rely on 75–80% synthetic distractors, meaning correct answer may feel out of place among obviously different options.
3. **bracket_numbers heterogeneity**: Pool contains viewers (44–125 million), years (1966–2023), prices (760999), billions (6), percents, and streak counts — numerical distractors generated in proximity to the correct value may occasionally miss the semantic category (e.g., year distractors for a viewer-count question).
4. **AMBIGUOUS-Q with superlatives**: "Widely considered the greatest TV show ever" (The Wire) is subjective and contestable.
5. **FACTUAL-SUSPECT**: "First Black superhero in American mainstream comics" claim for Black Panther is sometimes disputed (the character Waku predates him).
