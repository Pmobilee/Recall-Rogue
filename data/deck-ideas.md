# Recall Rogue — Curated Deck Ideas (Living Document)

> **Last updated:** 2026-03-24
> **Purpose:** Brainstorm and prioritize all viable curated deck concepts. Fact counts are determined by pool-first design — no arbitrary targets. Each deck needs enough facts for its answer pools to have 5+ unique answers per pool, and enough total facts to sustain 8 simultaneous learning cards (~30+ minimum). Chain themes are NOT required for initial decks — generic chain slots are used.
>
> **Domain key:** Domains map to `CanonicalFactDomain` in `src/data/domainMetadata.ts`. "new_domain" means the deck would require a new domain entry.

---

## Summary

| Domain | Total Deck Ideas | Tier 1 (Launch) | Tier 2 (High Demand) | Tier 3 (Community) |
|--------|-----------------|-----------------|----------------------|--------------------|
| History | 22 | 6 | 10 | 6 |
| Geography | 14 | 4 | 6 | 4 |
| Natural Sciences | 18 | 5 | 8 | 5 |
| Space & Astronomy | 8 | 3 | 3 | 2 |
| General Knowledge | 14 | 4 | 6 | 4 |
| Mythology & Folklore | 10 | 3 | 4 | 3 |
| Animals & Wildlife | 10 | 3 | 4 | 3 |
| Human Body & Health | 10 | 3 | 4 | 3 |
| Art & Architecture | 10 | 2 | 5 | 3 |
| Food & Cuisine | 8 | 2 | 3 | 3 |
| Language (Vocab) | 22 | 8 | 8 | 6 |
| Academic / Exam Prep | 18 | 5 | 8 | 5 |
| Technology & Computing | 8 | 2 | 4 | 2 |
| Sports & Olympics | 8 | 1 | 4 | 3 |
| Music & Film | 8 | 1 | 4 | 3 |
| Niche / Enthusiast | 16 | 0 | 6 | 10 |
| **TOTAL** | **194** | **52** | **87** | **55** |

---

## Design Notes

Chain themes are NOT required for initial deck builds — facts use generic chain slots (0-5). Pool-first design determines deck structure:
- Each answer pool needs 5+ unique `correctAnswer` values for pool-based distractors
- Pools with <5 unique answers fall back to pre-generated distractors
- Fact count is driven by the content, not arbitrary targets
- See `.claude/skills/deck-master/SKILL.md` for full design philosophy

---

## 1. History

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| H-01 | US Presidents | history | president_names (46), party_names (8+), home_states (30+) | Students, trivia, Jeopardy fans | Easy — Wikipedia-rich | **SHIPPED** |
| H-02 | World War II | history | TBD — needs architecture | History buffs, students | Easy | **Tier 1** |
| H-03 | Ancient Rome | history | TBD — needs architecture | Classics students, hobbyists | Easy | **Tier 1** |
| H-04 | Ancient Greece | history | TBD — needs architecture | Students, philosophy fans | Easy | **Tier 1** |
| H-05 | Ancient Egypt | history | TBD — needs architecture | Casual learners, kids | Easy | **Tier 1** |
| H-06 | US Civil War | history | TBD — needs architecture | History students, Americans | Easy | **Tier 1** |
| H-07 | World War I | history | TBD — needs architecture | Students, history buffs | Easy | **Tier 2** |
| H-08 | Cold War | history | TBD — needs architecture | History students, Cold War enthusiasts | Easy | **Tier 2** |
| H-09 | Medieval Europe | history | TBD — needs architecture | Students, fantasy fans | Easy | **Tier 2** |
| H-10 | Age of Exploration | history | TBD — needs architecture | Students, geography crossover | Easy | **Tier 2** |
| H-11 | Ancient China | history | TBD — needs architecture | Students, East Asia enthusiasts | Medium — requires curated sources | **Tier 2** |
| H-12 | The Renaissance | history | TBD — needs architecture | Art & history students | Easy | **Tier 2** |
| H-13 | French Revolution & Napoleon | history | TBD — needs architecture | Students, European history fans | Easy | **Tier 2** |
| H-14 | British Empire | history | TBD — needs architecture | Commonwealth audiences, students | Easy | **Tier 2** |
| H-15 | Aztec & Maya Civilizations | history | TBD — needs architecture | Students, Mesoamerica enthusiasts | Medium | **Tier 2** |
| H-16 | The Vikings | history | TBD — needs architecture | Fantasy fans, Scandinavian interest | Easy | **Tier 2** |
| H-17 | Ancient India — Empires | history | TBD — needs architecture | Students, South Asian heritage | Medium | **Tier 3** |
| H-18 | Ottoman Empire | history | TBD — needs architecture | Students, Middle Eastern history | Medium | **Tier 3** |
| H-19 | The Holocaust | history | TBD — needs architecture | Students, memorial education | Easy — but requires sensitivity | **Tier 3** |
| H-20 | Cold War Proxy Wars | history | TBD — needs architecture | Students, political science | Medium | **Tier 3** |
| H-21 | African Kingdoms & Empires | history | TBD — needs architecture | Students, African heritage audiences | Hard — sparse English sources | **Tier 3** |
| H-22 | The Space Race (Historical) | history | TBD — needs architecture | Students, space crossover | Easy | **Tier 3** |

**Notes:**
- H-01 (US Presidents) is the canonical example from DECKBUILDER.md — should be first shipped.
- H-02 (WWII) has the highest general trivia demand signal worldwide.
- H-19 (Holocaust) needs special editorial review — factual but culturally sensitive framing required.

---

## 2. Geography

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| G-01 | World Capitals | geography_drill | capital_names (195), continent_groups (5), country_names (195) | Trivia fans, geography students, "Sporcle" audience | Easy | **Tier 1** |
| G-02 | Flags of the World | geography_drill | country_names (195), continent_groups (5), flag_colors (8+) | Trivia fans, flag enthusiasts, visual learners | Easy (image-based Q format) | **Tier 1** |
| G-03 | Countries & Continents | geography | continent_names (7), country_names (195), region_names (20+) | Students, geography fans | Easy | **Tier 1** |
| G-04 | US States | geography | state_names (50), regions (5), capitals (50) | Americans, students, social studies | Easy | **Tier 1** |
| G-05 | World Rivers & Mountains | geography | TBD — needs architecture | Geography students | Easy | **Tier 2** |
| G-06 | World Deserts & Tundras | geography | TBD — needs architecture | Geography students | Medium | **Tier 2** |
| G-07 | Island Nations | geography | TBD — needs architecture | Trivia fans, travel enthusiasts | Easy | **Tier 2** |
| G-08 | UNESCO World Heritage Sites | geography | TBD — needs architecture | Travel enthusiasts, culture buffs | Easy | **Tier 2** |
| G-09 | National Parks of the World | geography | TBD — needs architecture | Outdoor enthusiasts, travelers | Easy | **Tier 2** |
| G-10 | European Countries Deep Dive | geography | TBD — needs architecture | European students, travelers | Easy | **Tier 2** |
| G-11 | Oceans, Seas & Straits | geography | TBD — needs architecture | Geography students, sailors | Medium | **Tier 3** |
| G-12 | Cities by Population | geography | TBD — needs architecture | Trivia fans | Easy | **Tier 3** |
| G-13 | Languages of the World | geography | TBD — needs architecture | Linguistics enthusiasts | Medium | **Tier 3** |
| G-14 | Borders & Landlocked Countries | geography | TBD — needs architecture | Geography nerds | Hard | **Tier 3** |

**Notes:**
- G-01 and G-02 are already partially implemented as `geography_drill` domain — these are launch priorities.
- G-04 (US States) is especially high demand from American students; can include capitals, nicknames, date admitted, and state birds/flowers for variety.
- G-08 (UNESCO) has strong "I want to visit all of these" motivation that drives engagement.

---

## 3. Natural Sciences

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| NS-01 | Periodic Table of Elements | natural_sciences | element_names (118), element_symbols (118), element_groups (9+), atomic_numbers (118) | Chemistry students, science enthusiasts, AP Chem | Easy — well-documented | **SHIPPED** |
| NS-02 | Human Anatomy | natural_sciences | TBD — needs architecture | Pre-med students, biology students, nurses | Easy | **Tier 1** |
| NS-03 | Famous Scientists & Discoveries | natural_sciences | TBD — needs architecture | Students, history of science fans | Easy | **Tier 1** |
| NS-04 | Physics Concepts & Laws | natural_sciences | TBD — needs architecture | AP Physics students, science enthusiasts | Medium | **Tier 1** |
| NS-05 | Biology — Cell & Genetics | natural_sciences | TBD — needs architecture | AP Biology students | Medium | **Tier 1** |
| NS-06 | Chemistry — Reactions & Compounds | natural_sciences | TBD — needs architecture | AP Chemistry, pre-med | Medium | **Tier 2** |
| NS-07 | Geology & Earth Science | natural_sciences | TBD — needs architecture | Earth science students, geology fans | Easy | **Tier 2** |
| NS-08 | Weather & Meteorology | natural_sciences | TBD — needs architecture | Casual learners, meteorology students | Easy | **Tier 2** |
| NS-09 | Dinosaurs & Paleontology | natural_sciences | dinosaur_names (55+), time_periods (5+), diet_types (3) | Kids, dinosaur fans, museum-goers | Easy | **Tier 2** |
| NS-10 | Ecosystems & Biomes | natural_sciences | TBD — needs architecture | Environmental science students | Easy | **Tier 2** |
| NS-11 | Medicines & Pharmacology | natural_sciences | TBD — needs architecture | Medical students, pharmacology fans | Hard — specialist knowledge | **Tier 2** |
| NS-12 | Viruses, Bacteria & Pandemics | natural_sciences | TBD — needs architecture | Post-COVID interest, biology students | Easy | **Tier 2** |
| NS-13 | Physics — Famous Experiments | natural_sciences | TBD — needs architecture | Physics students, science history fans | Medium | **Tier 3** |
| NS-14 | Mathematics — Theorems & Concepts | natural_sciences | TBD — needs architecture | Math students, AP Calc prep | Hard | **Tier 3** |
| NS-15 | Genetics & DNA — Deep Dive | natural_sciences | TBD — needs architecture | Biology students, biotech interest | Hard | **Tier 3** |
| NS-16 | Ecology & Endangered Species | natural_sciences | TBD — needs architecture | Environmental advocates, kids | Easy | **Tier 3** |
| NS-17 | Chemistry — Nobel Prizes | natural_sciences | TBD — needs architecture | Chemistry students, Nobel enthusiasts | Medium | **Tier 3** |
| NS-18 | Rocks, Gems & Minerals | natural_sciences | TBD — needs architecture | Geology hobbyists, gem collectors | Easy | **Tier 3** |

**Notes:**
- NS-01 (Periodic Table) is a cultural touchstone — this has massive appeal to anyone who's been through a chemistry class.
- NS-09 (Dinosaurs) is the top kid-audience deck — fun facts, evocative names, strong visual potential.
- NS-14 (Math) is important for students but harder to design engaging questions for — needs careful fact framing.

---

## 4. Space & Astronomy

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| SA-01 | The Solar System | space_astronomy | planet_names (8), moon_names (20+), planet_types (4) | Kids, space enthusiasts, students | Easy | **Tier 1** |
| SA-02 | NASA Missions — All Time | space_astronomy | mission_names (55+), program_names (8+), mission_types (5+) | Space enthusiasts, history crossover | Easy | **SHIPPED** |
| SA-03 | Stars & Stellar Objects | space_astronomy | TBD — needs architecture | Astronomy hobbyists, physics students | Medium | **Tier 1** |
| SA-04 | Constellations | space_astronomy | constellation_names (88), sky_regions (5), mythology_origins (10+) | Stargazers, astrology-adjacent interest | Easy | **Tier 2** |
| SA-05 | Planets — Deep Dive | space_astronomy | TBD — needs architecture | Students, space fans | Easy | **Tier 2** |
| SA-06 | Space Exploration History | space_astronomy | TBD — needs architecture | History crossover, space fans | Easy | **Tier 2** |
| SA-07 | Galaxies & Cosmology | space_astronomy | TBD — needs architecture | Physics students, cosmology enthusiasts | Hard | **Tier 3** |
| SA-08 | Astronauts & Cosmonauts | space_astronomy | astronaut_names (50+), nationality_names (10+), mission_names (20+) | Space enthusiasts, biography fans | Easy | **Tier 3** |

---

## 5. General Knowledge

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| GK-01 | Famous Inventions & Inventors | general_knowledge | inventor_names (60+), invention_names (60+), invention_categories (5+) | Trivia fans, students | Easy | **Tier 1** |
| GK-02 | Nobel Prize Winners | general_knowledge | laureate_names (60+), prize_categories (6), nationalities (20+) | Trivia fans, academic enthusiasts | Medium | **Tier 1** |
| GK-03 | World Records — Guinness | general_knowledge | TBD — needs architecture | Kids, trivia fans | Easy | **Tier 1** |
| GK-04 | Flags & National Symbols | general_knowledge | TBD — needs architecture | Trivia fans, geography crossover | Easy | **Tier 1** |
| GK-05 | Famous Quotes & Who Said It | general_knowledge | TBD — needs architecture | Trivia fans, literature fans | Medium | **Tier 2** |
| GK-06 | World Leaders — Modern Era | general_knowledge | TBD — needs architecture | Current events, political science | Medium | **Tier 2** |
| GK-07 | Olympics Records & Firsts | general_knowledge | TBD — needs architecture | Sports & trivia fans | Easy | **Tier 2** |
| GK-08 | Famous Firsts in History | general_knowledge | TBD — needs architecture | Broad appeal, trivia fans | Easy | **Tier 2** |
| GK-09 | Superlatives — Biggest, Tallest, Deepest | general_knowledge | TBD — needs architecture | Kids, trivia | Easy | **Tier 2** |
| GK-10 | Currencies of the World | general_knowledge | currency_names (60+), country_names (60+), currency_symbols (20+) | Trivia fans, travel enthusiasts | Easy | **Tier 3** |
| GK-11 | Phobias & Psychology Terms | general_knowledge | TBD — needs architecture | Psychology students, curious learners | Medium | **Tier 3** |
| GK-12 | Business & Economics — Basics | general_knowledge | TBD — needs architecture | Business students, entrepreneurs | Medium | **Tier 3** |
| GK-13 | Literary Genres & Famous Books | general_knowledge | TBD — needs architecture | Book lovers, English students | Easy | **Tier 3** |
| GK-14 | Wonders of the World | general_knowledge | TBD — needs architecture | Travel fans, trivia | Easy | **Tier 3** |

---

## 6. Mythology & Folklore

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| MF-01 | Greek Mythology | mythology_folklore | deity_names (30+), creature_names (20+), myth_categories (5+) | Students, Percy Jackson fans, D&D players | Easy | **SHIPPED** |
| MF-02 | Norse Mythology | mythology_folklore | deity_names (20+), realm_names (9), creature_names (15+) | Fantasy fans, Viking interest, Marvel crossover | Easy | **Tier 1** |
| MF-03 | Egyptian Mythology | mythology_folklore | deity_names (30+), sacred_animals (10+), myth_categories (5+) | History crossover, Egypt enthusiasts | Easy | **Tier 1** |
| MF-04 | Roman Mythology | mythology_folklore | TBD — needs architecture | Students, classics fans | Easy | **Tier 2** |
| MF-05 | Hindu Mythology | mythology_folklore | TBD — needs architecture | South Asian heritage, religious studies | Medium | **Tier 2** |
| MF-06 | Japanese Mythology & Folklore | mythology_folklore | TBD — needs architecture | Anime fans, Japan enthusiasts | Medium | **Tier 2** |
| MF-07 | Celtic & Arthurian Legends | mythology_folklore | TBD — needs architecture | Fantasy fans, British history | Medium | **Tier 2** |
| MF-08 | Monsters & Creatures — World Mythology | mythology_folklore | TBD — needs architecture | D&D players, fantasy fans, kids | Easy | **Tier 3** |
| MF-09 | Aztec & Maya Mythology | mythology_folklore | TBD — needs architecture | History crossover, Mesoamerica fans | Medium | **Tier 3** |
| MF-10 | World Fairy Tales & Folk Stories | mythology_folklore | TBD — needs architecture | Kids, literature students | Easy | **Tier 3** |

---

## 7. Animals & Wildlife

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| AW-01 | Endangered & Extinct Animals | animals_wildlife | TBD — needs architecture | Kids, environmental advocates | Easy | **Tier 1** |
| AW-02 | Mammals of the World | animals_wildlife | animal_names (60+), habitat_regions (5+), animal_orders (10+) | Kids, nature fans | Easy | **Tier 1** |
| AW-03 | Ocean Life | animals_wildlife | animal_names (60+), ocean_zones (5), animal_families (10+) | Kids, ocean fans, marine biology students | Easy | **Tier 1** |
| AW-04 | Birds of the World | animals_wildlife | TBD — needs architecture | Birdwatchers, nature fans | Easy | **Tier 2** |
| AW-05 | Reptiles & Amphibians | animals_wildlife | TBD — needs architecture | Kids, reptile enthusiasts | Easy | **Tier 2** |
| AW-06 | Insects & Arachnids | animals_wildlife | TBD — needs architecture | Kids, entomology fans | Easy | **Tier 2** |
| AW-07 | Dog Breeds | animals_wildlife | breed_names (60+), breed_groups (7), origin_countries (20+) | Dog owners, pet enthusiasts | Easy | **Tier 2** |
| AW-08 | Cat Breeds | animals_wildlife | TBD — needs architecture | Cat owners, pet enthusiasts | Easy | **Tier 3** |
| AW-09 | Prehistoric Life (Pre-Dinosaur) | animals_wildlife | TBD — needs architecture | Paleontology fans, crossover with NS-09 | Hard | **Tier 3** |
| AW-10 | Animal Behavior & Adaptations | animals_wildlife | TBD — needs architecture | Nature documentary fans, biology students | Medium | **Tier 3** |

---

## 8. Human Body & Health

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| HB-01 | Human Body Systems | human_body_health | system_names (11+), organ_names (30+), system_functions (5+) | Biology students, pre-med, curious learners | Easy | **Tier 1** |
| HB-02 | Diseases & Medical History | human_body_health | TBD — needs architecture | Medical students, health-conscious adults | Easy | **Tier 1** |
| HB-03 | Nutrition & Vitamins | human_body_health | vitamin_names (13+), mineral_names (10+), deficiency_diseases (10+) | Health-conscious adults, nutrition students | Easy | **Tier 1** |
| HB-04 | Bones of the Human Body | human_body_health | bone_names (50+), body_regions (5), joint_types (6+) | Medical students, anatomy class | Easy | **Tier 2** |
| HB-05 | Muscles of the Human Body | human_body_health | TBD — needs architecture | Physical trainers, anatomy students | Medium | **Tier 2** |
| HB-06 | Brain & Neuroscience | human_body_health | TBD — needs architecture | Psychology students, neuroscience fans | Medium | **Tier 2** |
| HB-07 | Pharmacology Basics | human_body_health | TBD — needs architecture | Pre-med, pharmacy students | Hard | **Tier 2** |
| HB-08 | Mental Health & Psychology | human_body_health | TBD — needs architecture | Psychology students, mental health advocates | Medium | **Tier 3** |
| HB-09 | First Aid & Emergency Medicine | human_body_health | TBD — needs architecture | Everyone — broad practical appeal | Easy | **Tier 3** |
| HB-10 | Genetics & Heredity | human_body_health | TBD — needs architecture | Biology students, genetic testing interest | Medium | **Tier 3** |

---

## 9. Art & Architecture

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| AA-01 | Famous Paintings & Artists | art_architecture | artist_names (60+), art_movements (8+), nationalities (15+) | Art students, museum-goers, culture buffs | Easy | **Tier 1** |
| AA-02 | Architectural Wonders | art_architecture | TBD — needs architecture | Travel fans, architecture students | Easy | **Tier 1** |
| AA-03 | Art Movements — History | art_architecture | movement_names (20+), time_periods (5+), movement_origins (10+) | Art students, culture buffs | Medium | **Tier 2** |
| AA-04 | Classical Music Composers | art_architecture | composer_names (55+), musical_eras (5), nationalities (15+) | Classical music fans, music students | Easy | **Tier 2** |
| AA-05 | Famous Sculptures | art_architecture | TBD — needs architecture | Art students, museum-goers | Easy | **Tier 2** |
| AA-06 | Oscar Award Winners | art_architecture | TBD — needs architecture | Film buffs, pop culture fans | Easy | **Tier 2** |
| AA-07 | Shakespeare — Plays & Characters | art_architecture | play_names (37+), character_names (30+), play_genres (3) | English students, theater fans | Easy | **Tier 2** |
| AA-08 | World Religions — Basics | art_architecture | TBD — needs architecture | Religious studies, philosophy students | Medium | **Tier 3** |
| AA-09 | Philosophy — Key Thinkers | art_architecture | TBD — needs architecture | Philosophy students, humanities | Medium | **Tier 3** |
| AA-10 | Fashion & Design History | art_architecture | TBD — needs architecture | Fashion students, culture buffs | Easy | **Tier 3** |

**Notes:**
- AA-04 through AA-09 stretch the "Art & Architecture" domain — these may warrant a `culture_arts` domain split if many decks are added.
- AA-07 (Shakespeare) is especially strong for English-speaking students — standard curriculum content with high engagement potential.

---

## 10. Food & Cuisine

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| FC-01 | Cuisines of the World | food_cuisine | cuisine_names (30+), origin_countries (30+), cuisine_regions (5+) | Foodies, travelers, broad appeal | Easy | **Tier 1** |
| FC-02 | Spices & Herbs | food_cuisine | spice_names (50+), origin_regions (5+), spice_uses (5+) | Foodies, culinary students | Easy | **Tier 1** |
| FC-03 | Wine Regions & Varietals | food_cuisine | TBD — needs architecture | Wine enthusiasts, sommeliers, adults | Medium | **Tier 2** |
| FC-04 | Coffee & Tea Around the World | food_cuisine | TBD — needs architecture | Coffee & tea enthusiasts | Easy | **Tier 2** |
| FC-05 | National Dishes of the World | food_cuisine | dish_names (55+), origin_countries (55+), cuisine_regions (5+) | Travelers, foodies | Easy | **Tier 2** |
| FC-06 | Fruits & Vegetables | food_cuisine | TBD — needs architecture | Health-conscious, kids, broad appeal | Easy | **Tier 3** |
| FC-07 | Famous Chefs & Culinary History | food_cuisine | TBD — needs architecture | Foodies, culinary students | Medium | **Tier 3** |
| FC-08 | Cocktails & Spirits | food_cuisine | TBD — needs architecture | Adults, bartenders, drink enthusiasts | Easy | **Tier 3** |

---

## 11. Language (Vocabulary — Generic Chain Colors)

> Vocabulary decks use generic chain colors (no thematic sub-pool binding). Facts are drawn from the full deck pool weighted by in-run FSRS. Already partially implemented.

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| L-01 | Japanese N5 Vocabulary | language | vocab words (800+) — generic pool, no sub-pools needed | Japanese learners, anime fans | Easy | **Tier 1** |
| L-02 | Japanese N4 Vocabulary | language | vocab words (600+) — generic pool | Japanese learners | Easy | **Tier 1** |
| L-03 | Japanese N3 Vocabulary | language | vocab words (800+) — generic pool | Intermediate Japanese learners | Medium | **Tier 1** |
| L-04 | Korean TOPIK Level 1-2 | language | vocab words (500+) — generic pool | K-drama / K-pop fans, Korean learners | Easy | **Tier 1** |
| L-05 | Mandarin Chinese HSK 1-2 | language | vocab words (300+) — generic pool | Business learners, Mandarin beginners | Easy | **Tier 1** |
| L-06 | Spanish — Beginner (A1-A2) | language | vocab words (500+) — generic pool | Largest language-learning market (Americas + EU) | Easy | **Tier 1** |
| L-07 | French — Beginner (A1-A2) | language | vocab words (500+) — generic pool | School curriculum, travel motivation | Easy | **Tier 1** |
| L-08 | German — Beginner (A1-A2) | language | vocab words (500+) — generic pool | Business, travel, school curriculum | Easy | **Tier 1** |
| L-09 | Japanese N2 Vocabulary | language | vocab words (900+) — generic pool | Advanced Japanese learners | Hard | **Tier 2** |
| L-10 | Japanese N1 Vocabulary | language | vocab words (1000+) — generic pool | Near-fluent Japanese learners | Very Hard | **Tier 2** |
| L-11 | Korean TOPIK Level 3-4 | language | vocab words (700+) — generic pool | Intermediate Korean learners | Medium | **Tier 2** |
| L-12 | Mandarin Chinese HSK 3-4 | language | vocab words (600+) — generic pool | Intermediate Mandarin learners | Medium | **Tier 2** |
| L-13 | Spanish — Intermediate (B1-B2) | language | vocab words (700+) — generic pool | Students, Spanish language exams | Medium | **Tier 2** |
| L-14 | Portuguese — Beginner (A1-A2) | language | vocab words (500+) — generic pool | Brazil & Portugal markets, Spanish crossover | Easy | **Tier 2** |
| L-15 | Italian — Beginner (A1-A2) | language | vocab words (500+) — generic pool | Travel, culture, music motivation | Easy | **Tier 2** |
| L-16 | Dutch — Beginner (A1-A2) | language | vocab words (400+) — generic pool | Already partially implemented | Easy | **Tier 2** |
| L-17 | Czech — Beginner | language | vocab words (400+) — generic pool | Already partially implemented | Easy | **Tier 2** |
| L-18 | Russian — Beginner (A1-A2) | language | vocab words (500+) — generic pool, Cyrillic script | Eastern Europe, Slavic language interest | Medium | **Tier 3** |
| L-19 | Arabic — Beginner (MSA) | language | vocab words (400+) — generic pool, script learning | Middle East market, religious studies | Hard | **Tier 3** |
| L-20 | Hindi — Beginner | language | vocab words (400+) — generic pool, Devanagari script | India market (massive), diaspora | Medium | **Tier 3** |
| L-21 | Vietnamese — Beginner | language | vocab words (400+) — generic pool, tones/diacritics | SE Asia interest, diaspora | Medium | **Tier 3** |
| L-22 | Turkish — Beginner | language | vocab words (400+) — generic pool | Growing market, crossover with Middle East | Medium | **Tier 3** |

**Notes:**
- L-01 through L-08 are either implemented or nearly ready based on existing seed data in `src/data/seed/`.
- Japanese N5-N1 progression is the strongest single language arc — completing all 5 levels would be a major retention driver.
- Arabic and Hindi represent enormous addressable markets but require specialized script handling.

---

## 12. Academic / Exam Prep

> These decks map to existing domains but are branded specifically for test prep. High demand signal from students.

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| EP-01 | AP US History — Key Events | history | TBD — needs architecture | AP students, US History teachers | Medium | **Tier 1** |
| EP-02 | AP Biology — Core Concepts | natural_sciences | TBD — needs architecture | AP Biology students | Medium | **Tier 1** |
| EP-03 | AP Chemistry — Core Concepts | natural_sciences | TBD — needs architecture | AP Chemistry students | Hard | **Tier 1** |
| EP-04 | AP Psychology — Key Terms | general_knowledge | TBD — needs architecture | AP Psychology students — fastest-growing AP exam | Easy | **Tier 1** |
| EP-05 | AP World History — Civilizations | history | TBD — needs architecture | AP World History students | Medium | **Tier 1** |
| EP-06 | AP Government & Politics (US) | history | TBD — needs architecture | AP Gov students | Medium | **Tier 2** |
| EP-07 | AP Environmental Science | natural_sciences | TBD — needs architecture | AP ES students | Medium | **Tier 2** |
| EP-08 | SAT Vocabulary | language | vocab words (500+) — generic pool | SAT prep students | Medium — use generic chains like vocab decks | **Tier 2** |
| EP-09 | GRE Vocabulary | language | vocab words (600+) — generic pool | Graduate school applicants | Hard | **Tier 2** |
| EP-10 | Medical School — Anatomy | human_body_health | TBD — needs architecture | Medical students (pre-clinical) | Hard | **Tier 2** |
| EP-11 | Medical School — Pathology | human_body_health | TBD — needs architecture | Medical students (pre-clinical) | Hard | **Tier 2** |
| EP-12 | LSAT Logical Reasoning Terms | general_knowledge | TBD — needs architecture | Law school applicants | Hard | **Tier 2** |
| EP-13 | Constitutional Amendments — US | history | amendment_names (27), era_groups (4) | Law students, civics students, AP Gov | Easy | **Tier 3** |
| EP-14 | Landmark Supreme Court Cases | history | TBD — needs architecture | Law students, AP Gov students | Medium | **Tier 3** |
| EP-15 | AP Macroeconomics | general_knowledge | TBD — needs architecture | AP Economics students | Medium | **Tier 3** |
| EP-16 | CFA Level 1 — Key Concepts | general_knowledge | TBD — needs architecture | Finance professionals, CFA candidates | Hard | **Tier 3** |
| EP-17 | USMLE Step 1 — High Yield | human_body_health | TBD — needs architecture | Medical students | Very Hard | **Tier 3** |
| EP-18 | Data Structures & Algorithms | new_domain | TBD — needs architecture | CS students, software engineering interview prep | Hard | **Tier 3** |

---

## 13. Technology & Computing

> Would benefit from a `technology` domain, but can initially live under `natural_sciences` or `general_knowledge`.

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| TC-01 | Computer Science History | general_knowledge | TBD — needs architecture | CS students, tech enthusiasts | Easy | **Tier 1** |
| TC-02 | Famous Tech Companies & Founders | general_knowledge | company_names (50+), founder_names (50+), industry_categories (5+) | Business + tech audience | Easy | **Tier 1** |
| TC-03 | Programming Languages | new_domain | TBD — needs architecture | CS students, developers | Medium | **Tier 2** |
| TC-04 | Cybersecurity Basics | new_domain | TBD — needs architecture | IT professionals, security students | Medium | **Tier 2** |
| TC-05 | AI & Machine Learning Concepts | new_domain | TBD — needs architecture | Tech enthusiasts, AI students | Medium | **Tier 2** |
| TC-06 | Networking & Internet | new_domain | TBD — needs architecture | Networking students, IT professionals | Hard | **Tier 3** |
| TC-07 | Cryptocurrency & Blockchain | new_domain | TBD — needs architecture | Crypto enthusiasts | Medium | **Tier 3** |
| TC-08 | Video Games History | new_domain | TBD — needs architecture | Gamers — the game's core audience | Easy | **Tier 3** |

---

## 14. Sports & Olympics

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| SP-01 | Olympic Games History | general_knowledge | TBD — needs architecture | Sports fans, trivia buffs | Easy | **Tier 1** |
| SP-02 | FIFA World Cup | general_knowledge | TBD — needs architecture | Global soccer fans — highest demand sport worldwide | Easy | **Tier 2** |
| SP-03 | US Sports Legends | general_knowledge | TBD — needs architecture | American sports fans | Easy | **Tier 2** |
| SP-04 | Tour de France & Cycling | general_knowledge | TBD — needs architecture | Cycling fans | Medium | **Tier 2** |
| SP-05 | Tennis Grand Slams | general_knowledge | TBD — needs architecture | Tennis fans | Easy | **Tier 2** |
| SP-06 | Cricket — World Cup & Records | general_knowledge | TBD — needs architecture | Commonwealth countries — UK, India, Australia, Pakistan | Medium | **Tier 3** |
| SP-07 | Formula 1 History | general_knowledge | TBD — needs architecture | F1 fans — massive post-Netflix Drive to Survive | Easy | **Tier 3** |
| SP-08 | Martial Arts & Combat Sports | general_knowledge | TBD — needs architecture | MMA fans, martial arts practitioners | Medium | **Tier 3** |

---

## 15. Music & Film

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| MV-01 | Film History — Director Masterworks | art_architecture | TBD — needs architecture | Film students, cinephiles | Medium | **Tier 1** |
| MV-02 | Music Genres & History | art_architecture | TBD — needs architecture | Music fans — broad appeal | Easy | **Tier 2** |
| MV-03 | Grammy & Rock Hall of Fame | art_architecture | TBD — needs architecture | Music fans, trivia buffs | Easy | **Tier 2** |
| MV-04 | Broadway & Musical Theatre | art_architecture | TBD — needs architecture | Theatre fans, musical enthusiasts | Easy | **Tier 2** |
| MV-05 | Disney — Films & Characters | art_architecture | TBD — needs architecture | Kids, families, Disney fans — huge market | Easy | **Tier 3** |
| MV-06 | Classic TV Shows | art_architecture | TBD — needs architecture | TV fans, pop culture | Easy | **Tier 3** |
| MV-07 | Video Game Soundtracks & Composers | art_architecture | TBD — needs architecture | Gamers — crossover with TC-08 | Medium | **Tier 3** |
| MV-08 | Classical Music — Symphonies & Concertos | art_architecture | TBD — needs architecture | Classical music fans, music students | Hard | **Tier 3** |

---

## 16. Niche / Enthusiast Decks

> These decks target passionate communities where a dedicated learner would download the game *specifically* for this content. Lower total audience but extremely high engagement per player.

| # | Deck Name | Domain | Pool Potential | Demand Signal | Difficulty | Priority |
|---|-----------|--------|----------------|---------------|------------|----------|
| NE-01 | Aviation History & Aircraft | general_knowledge | TBD — needs architecture | Aviation enthusiasts, pilots, Flight Sim players | Medium | **Tier 2** |
| NE-02 | Classic Cars — Icons & Eras | general_knowledge | TBD — needs architecture | Car enthusiasts, gearheads | Easy | **Tier 2** |
| NE-03 | Board Games & Card Games History | general_knowledge | TBD — needs architecture | Board gamers — strong crossover with roguelite audience | Easy | **Tier 2** |
| NE-04 | Tarot & Symbolism | mythology_folklore | TBD — needs architecture | Spiritual community, tarot readers, artists | Medium | **Tier 2** |
| NE-05 | Ancient Wonders & Lost Civilizations | history | TBD — needs architecture | History buffs, mystery fans | Easy | **Tier 2** |
| NE-06 | Flags — Vexillology Deep Dive | geography_drill | TBD — needs architecture | Flag enthusiasts, geography nerds | Medium | **Tier 2** |
| NE-07 | Gemstones & Precious Stones | natural_sciences | TBD — needs architecture | Jewelers, gem collectors, gift buyers | Easy | **Tier 3** |
| NE-08 | Chess — History & Famous Games | general_knowledge | TBD — needs architecture | Chess players — surging post-Queen's Gambit | Easy | **Tier 3** |
| NE-09 | Whiskey & Spirits Connoisseur | food_cuisine | TBD — needs architecture | Adult beverages enthusiasts | Medium | **Tier 3** |
| NE-10 | Astrology — Signs & Planets | mythology_folklore | TBD — needs architecture | Astrology audience — enormous on social media | Easy | **Tier 3** |
| NE-11 | Dungeons & Dragons — Monsters | mythology_folklore | TBD — needs architecture | D&D players, TTRPG fans — natural roguelite audience | Easy | **Tier 3** |
| NE-12 | Pokémon — Original 151 | new_domain | pokemon_names (151), type_names (15+), evolution_stages (3) | Pokémon fans — could drive viral downloads | Easy | **Tier 3** |
| NE-13 | Magic: The Gathering — Mechanics | new_domain | TBD — needs architecture | MTG players — crossover with card game fans | Hard | **Tier 3** |
| NE-14 | Ancient Languages & Scripts | history | TBD — needs architecture | Language enthusiasts, classics students | Hard | **Tier 3** |
| NE-15 | Heraldry & Coats of Arms | history | TBD — needs architecture | History buffs, genealogy enthusiasts | Hard | **Tier 3** |
| NE-16 | Cryptids & Paranormal | mythology_folklore | TBD — needs architecture | YouTube fan audience, paranormal enthusiasts | Easy | **Tier 3** |

---

## Implementation Notes & Decision Criteria

### Minimum Viable Deck (MVD) Requirements

Per DECKBUILDER.md spec:
- **Minimum 30 facts**, target 50+
- **Minimum 5 facts per answer type pool** (for distractor sourcing)
- Vocabulary decks: no chain theme requirement (use generic chain colors)

### Prioritization Logic

**Tier 1 — Launch decks** should satisfy ALL of the following:
1. High-demand audience (students OR trivia fans OR language learners with proven app-store demand)
2. Easy to source facts (Wikipedia-rich, well-documented in English)
3. Clear chain theme structure (sub-groupings are obvious and meaningful)
4. 50+ facts achievable without specialist knowledge
5. Works as a "hook" — someone would download the game *specifically* for this deck

**Tier 2 — High demand** satisfies most Tier 1 criteria but has some friction (niche audience, harder sourcing, smaller entity count).

**Tier 3 — Community interest** targets passionate niche audiences. High per-player value, lower total audience.

### Domain Expansion Needed

Some decks suggest a `technology` or `culture_arts` domain would be valuable:

| Suggested New Domain | Would Cover |
|----------------------|-------------|
| `technology` | CS, programming, AI, networking, cybersecurity, video games |
| `culture_arts` | Music, film, theatre, pop culture (overflow from `art_architecture`) |
| `sports` | All sports decks (currently shoehorned into `general_knowledge`) |
| `exam_prep` | AP, USMLE, LSAT — could be a filter/tag rather than a true domain |

**Recommendation:** Add `technology` and `sports` as domains before shipping Tier 2. `exam_prep` should be a tag/filter on top of existing domains rather than a separate domain — a US Presidents deck IS a history deck; an AP US History deck is the same facts with an exam-prep label.

### Deck Pairing Opportunities

Some decks pair naturally and could share content or cross-pollinate:
- H-03 (Ancient Rome) + MF-04 (Roman Mythology) — same historical period
- NS-09 (Dinosaurs) + AW-09 (Prehistoric Life) — chronological sequence
- SA-02 (NASA Missions) + H-22 (Space Race Historical) — overlapping facts
- AA-01 (Famous Paintings) + AA-03 (Art Movements) — same domain, different angle
- L-01 (Japanese N5) through L-10 (Japanese N1) — clear level progression arc

### Highest ROI Decks for Launch (Top 10 Recommendation)

| Rank | Deck | Reason |
|------|------|--------|
| 1 | H-01 US Presidents | Canonical example from spec; high trivia demand; clean structure |
| 2 | NS-01 Periodic Table | Cultural touchstone; clean answer pools; 118 elements = perfect fact count |
| 3 | G-01 World Capitals | Already partially implemented; massive Sporcle/trivia audience |
| 4 | MF-01 Greek Mythology | Percy Jackson generation; D&D crossover; rich storytelling |
| 5 | SA-01 Solar System | Kid-friendly gateway; clean fact structure; broad appeal |
| 6 | L-06 Spanish — Beginner | Largest language learning market; proven Duolingo demand |
| 7 | EP-04 AP Psychology | Fastest-growing AP exam; terminology is quiz-friendly |
| 8 | NS-09 Dinosaurs | Best kid-audience hook; names are fun; visual potential |
| 9 | H-02 World War II | Highest global trivia demand; rich chain themes |
| 10 | AA-07 Shakespeare | Required reading for English students; quotes are highly quotable |

---

*This document is a living brainstorm — add decks freely. Mark decks as `[IN PROGRESS]`, `[SHIPPED]`, or `[CANCELLED]` as work proceeds. Do not delete cancelled entries — archive them with a reason.*
