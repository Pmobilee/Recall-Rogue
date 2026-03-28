# Quiz Quality Report — BATCH-2026-03-27-001

**Tester**: Quiz Quality | **Model**: claude-sonnet-4-6 | **Domain**: multi-domain | **Encounters**: 2 combat + 0 study (API offline) + direct FactsDB query

**Verdict**: ISSUES

---

## Summary

- Total quizzes captured: 60 (sampled directly from FactsDB — see note below)
- Quizzes from combat (via getQuiz): 0
- Quizzes from study mode (via getStudyCard): 0
- Quizzes from direct FactsDB query: 60
- Domains represented: language, animals_wildlife, art_architecture, food_cuisine, natural_sciences, geography, history, general_knowledge, human_body_health, mythology_folklore, space_astronomy, europe (as tag), americas (as tag)

### Critical Infrastructure Note

The backend API at `localhost:3001` was **offline** during this session. The game logged `ERR_CONNECTION_REFUSED` on all calls to `/api/facts/packs/all`. As a result:

1. **Combat cards never received facts** — all cards in hand showed type/tier only, no `factQuestion`. All 2 combat encounters used only starter Strike/Block cards, triggering no quiz modals. `getQuiz()` returned `null` every call.
2. **Study mode returned 0 cards** — `getStudyCard()` returned null; the study quiz UI showed "QUESTION 1 / 0".
3. **The card reward bridge errored** — `[RewardRoomBridge] Scene did not become active` appeared after both combats, so no fact-backed cards were ever added to the deck.

**Mitigation**: The local `FactsDB` was initialized with 46,824 facts (confirmed via console log). I queried `window[Symbol.for('terra:factsDB')].allFactsCache` directly to extract and evaluate real quiz content from the database. The 7,537 facts with full quiz data (quizQuestion + correctAnswer + distractors) were analyzed, with 60 sampled for detailed subjective review.

---

## Objective Findings

Analysis run across all 7,537 facts with `quizQuestion` + `correctAnswer` + `distractors`.

| Check | Result | Pass Count | Fail Count | Notes |
|-------|--------|------------|------------|-------|
| O-QZ1: Choice count ≥ 3 | PASS | 7,537 | 0 | All facts have correctAnswer + ≥2 distractors. Most have 7–8 choices total. |
| O-QZ2: No duplicate choices | ISSUES | 7,514 | 23 | 23 facts have exact duplicate distractors (e.g., "South America" appears twice, "Mudskippers" twice). |
| O-QZ3: No data artifacts | PASS* | 7,536 | 1 | One false hit: "Undefined" as a legitimate answer to "What is X÷0?" — not a real artifact. The 3 initial flagged cases ("null hypothesis", "undefined") are valid educational content. |
| O-QZ4: Question completeness | PASS | 7,537 | 0 | No empty questions. |
| O-QZ5: Question length 20–300 chars | PASS | 7,537 | 0 | All questions within bounds. |
| O-QZ6: Correct index in bounds | PASS* | 7,537 | 0 | DB stores correctAnswer separately; shuffle simulation confirmed correctIndex is always valid (0–2 range for 3-choice quiz). |
| O-QZ7: No near-duplicate choices | PASS* | 7,537 | 0 | Initial algorithm produced 367 false positives ("left hand"/"left", "every"/"very" — these are legitimately different). Strict substring+ratio check found 0 true near-duplicates. |
| O-QZ8: Domain coverage | PASS | — | — | 13 domains represented in quiz-capable facts across 14 categoryL1 values. |

*With corrected interpretation — see issue log below.

---

## Subjective Assessments

Based on the 60 sampled quiz entries spanning 12 domains.

| Check | Rating (1–5) | Representative Examples | Issues Found |
|-------|-------------|------------------------|-------------|
| S-QZ1: Distractor plausibility | 4/5 | Faraday benzene question: "Acetone, Ethanol, Methane, Toluene" — all plausible chemicals. Dürer patron question: "Charles V, Frederick III, Ferdinand I" — real HRE emperors. | Some distractors too obviously wrong: "Zero is always undefined" (zero facts) is an absurd claim. Burrito "boiled, not grilled" is odd phrasing. |
| S-QZ2: Question clarity | 4/5 | "Which SI unit of capacitance is named after Michael Faraday?" — precise and unambiguous. "What key component did James Watt add to dramatically improve steam engine efficiency?" — clear. | "Which three movements together marked the end of the Middle Ages?" paired with answer "Renaissance and Reformation" — question says "three" but answer names two. Inconsistency. |
| S-QZ3: Answer correctness | 4/5 | Most answers verified plausible. Kant published nebular hypothesis, C was created by Dennis Ritchie, Singapore was expelled from Malaysia. | "Who first published the nebular hypothesis?" → "Immanuel Kant" is debatable; Laplace independently formalized it and is often credited. Answer may be incomplete without date context. "Crusades continued into the 18th century" → debatable framing. |
| S-QZ4: Difficulty appropriateness | 3/5 | Difficulty metadata exists (1–5 scale). Easy: "Where did burrito originate?" (Mexico). Hard: "Which eye-to-brain pathway regulates your circadian clock?" (retinohypothalamic tract). | Difficulty metadata often assigned `3` or `4` even for fairly accessible facts. Mismatch between assigned difficulty and actual challenge. "Cephalization" labeled difficulty 4 but is a standard biology term. |
| S-QZ5: Cultural bias | 3/5 | Good global coverage: Japan, Singapore, Philippines, Bolivia, Dominica, Suriname, Guatemala, Tuscany. | Language category heavily skewed to Japanese (JLPT kanji: 2,620 of 7,537 quiz facts = 34.8%). Western European history dominates history category. Space/astronomy underrepresented (44 facts). |

---

## Issues Found

### CRITICAL

None.

### HIGH

**H-01: Backend API offline breaks all combat quizzes**
- `localhost:3001/api/facts/packs/all` returns `ERR_CONNECTION_REFUSED`
- All combat cards render without facts; `getQuiz()` always returns null
- `RewardRoomScene` errors on every combat victory, blocking card acquisition
- Players in this state cannot experience the core quiz mechanic at all
- Affects: combat quiz flow, card reward system, study session loading

**H-02: 21 facts with duplicate distractors (exact match)**
- Examples: "Endangered" appears twice in tiger shark status question; "South America" appears twice in guinea fowl question; "Congregation" appears twice in starling murmuration question
- When the game selects 3 choices from the pool, there is a chance the player sees the same wrong answer twice
- IDs confirmed: `animals_wildlife-tabanidae-*` group, `animals_wildlife-numididae-*`, `food_cuisine-charcuterie-*`
- Fix: deduplicate distractors at ingestion time or query time

### MEDIUM

**M-01: Question–answer count mismatch (S-QZ2)**
- `history-middle-ages-renaissance-transition`: Question asks "Which THREE movements...?" but answer is "Renaissance and Reformation" (two items, third implied but not named)
- This will confuse players who count the named items and expect a third
- Fix: rephrase question to "Which movements marked the end of the Middle Ages?" or add the third movement (Age of Exploration) to the answer

**M-02: Nebular hypothesis answer ambiguity (S-QZ3)**
- Question: "Who first published the nebular hypothesis explaining solar system formation?"
- Answer: "Immanuel Kant"
- Pierre Laplace is widely co-credited and often named first in popular sources; Laplace's 1796 formulation is more mathematically rigorous
- The distractor list includes "Pierre Laplace" which many players would select as correct
- Fix: Rephrase to "Who first proposed the nebular hypothesis in 1755?" or credit "Kant (1755)" as answer

**M-03: Category taxonomy inconsistency**
- `categoryL1` contains both `"history"` (lowercase, 658 facts) and `"History"` (capitalized, 1 fact)
- `categoryL1` contains both `"europe"` (1 fact, standalone) and geography facts tagged under `"geography"` with `categoryL2: "europe"`
- Same for `"americas"` (5 facts standalone vs geography subcategory)
- These orphan categories won't aggregate correctly in domain filters
- Fix: normalize all categoryL1 values to lowercase; reassign orphan `europe`/`americas` facts to `geography`

**M-04: Domain imbalance — Japanese language dominates**
- Language category: 2,620 / 7,537 quiz facts = 34.8%, almost all JLPT kanji
- Space/astronomy: only 44 facts (0.6%)
- History: 658 facts but heavily European/medieval
- Mythology: 418 facts, well-represented
- A multi-domain run will surface Japanese kanji far more often than other content

### LOW

**L-01: "Undefined" as a legitimate quiz answer choice**
- `science-zero-dividing-undefined`: "What is X÷0?" → correct answer is "Undefined" (mathematically correct)
- The string check for artifact detection will flag this as a false positive
- The artifact detection logic in any automated QA pipeline must exclude this case
- Recommendation: whitelist this fact or add context ("mathematically undefined") to avoid confusion with JS artifacts

**L-02: Difficulty metadata loosely calibrated**
- "Cephalization" (brain concentration in head) rated difficulty 4 — standard undergraduate biology
- "What does the kanji 一 mean?" rated difficulty 1 — appropriate for JLPT N5 but may be too niche for general audiences
- Difficulty should be calibrated relative to target audience (general adult), not domain experts

**L-03: Distractor length inconsistency in some sets**
- Some distractor pools have very wide length variance
- Example: history fact with distractors ranging from single proper nouns ("Trygve Lie", 10 chars) to full phrases ("Javier Pérez de Cuéllar", 23 chars)
- Players can use length as a hint — matching the correct answer's length is a tell

---

## Raw Quiz Data

All 60 sampled entries from direct FactsDB query. Source: `window[Symbol.for('terra:factsDB')].allFactsCache`, facts with `quizQuestion + correctAnswer + distractors`. No live combat or study mode data captured (backend offline).

### Language / japanese_n5 (5 facts)

1. **Q**: What does the kanji '一' mean? | **A**: one, one radical (no.1) | **D**: inside, to go, to show, 100, (many) trees, fifty, to come down | diff:1
2. **Q**: What does the kanji '七' mean? | **A**: seven | **D**: to let (someone) hear, at that time, number one, interesting, truth, above, left | diff:1
3. **Q**: What does the kanji '万' mean? | **A**: 10,000 | **D**: four, north, inside, to be heard, growth, thousands | diff:1
4. **Q**: What does the kanji '三' mean? | **A**: three, 3 | **D**: telephone call, local specialty or souvenir bought, Monday, (if) by some chance, morning, eighty, previously | diff:1
5. **Q**: What does the kanji '上' mean? | **A**: above, up | **D**: telephone call, hundreds, water, English (language), spirit, perfection, to recall | diff:1

### Animals & Wildlife (5 facts)

6. **Q**: What covers the bony core of a bovid's horn to make it permanent? | **A**: Keratin | **D**: Calcium, Chitin, Enamel, Cartilage, Collagen, Ivory, Dentine, Melanin | diff:3
7. **Q**: How do female horse flies obtain blood — what do their mouthparts do first? | **A**: Cut skin with blades | **D**: Pierce with a needle, Dissolve skin with saliva, Absorb through pores, Suck through a tube, Inject anticoagulant first, Rasp with teeth, Puncture a vein, Scrape with mandibles | diff:3
8. **Q**: What popular belief about horse flies locating prey is actually false? | **A**: They detect heat/infrared | **D**: They only bite at dusk, They target dark clothing, They are attracted to water, They can smell fear, They track carbon dioxide, They navigate by stars, They hunt in packs, They sense vibrations | diff:4
9. **Q**: What specific gene mutation is responsible for apes having no tails? | **A**: TBXT gene mutation | **D**: FOXP2 mutation, HAR1 deletion, CHRM3 variant, MYH16 loss, ASPM deletion, SRGAP2 copy, NOTCH2NL variant, AMY1 expansion | diff:4
10. **Q**: How do gibbons move when they travel on the ground? | **A**: Bipedally (upright) | **D**: On all fours, By hopping, By knuckle-walking, Sideways shuffling, By rolling, By leaping, On their wrists, Dragging hindlimbs | diff:3

### Art & Architecture (5 facts)

11. **Q**: In which decade did Dürer establish his European reputation through woodcut prints? | **A**: His twenties | **D**: His thirties, His forties, His fifties, As a teenager, In old age, After his death, In his sixties, In middle age | diff:3
12. **Q**: Which Holy Roman Emperor became Dürer's patron from 1512? | **A**: Maximilian I | **D**: Charles V, Frederick III, Ferdinand I, Rudolf II, Henry IV, Philip II, Leopold I, Sigismund | diff:3
13. **Q**: What two elements did Dürer introduce into Northern European art from Italian influence? | **A**: Classical motifs and the nude | **D**: Fresco and mosaic, Tempera and oil, Landscape and still life, Altarpiece and icon, Tapestry and gilt work, Copper and bronze, Pointillism and perspective, Watercolor and pastel | diff:4
14. **Q**: What tool did Dürer master to expand the tonal range of engraving? | **A**: The burin | **D**: The etching needle, The dry-point stylus, The roulette wheel, The aquatint screen, The mezzotint rocker, The burnisher, The acid bath, The lithograph stone | diff:4
15. **Q**: What visual device did Hitchcock use in most of his films to become as famous as his actors? | **A**: Cameo appearances | **D**: Director's commentary, On-screen dedications, Opening monologues, Signature title cards, Visible film crew shots, Breaking the fourth wall, End-credits sequences, Making-of documentaries | diff:2

### Food & Cuisine (5 facts)

16. **Q**: Botanically speaking, what type of fruit is a bell pepper classified as? | **A**: A berry | **D**: A drupe, A legume pod, A vegetable technically, A capsule, A nut, An accessory fruit, A pome, A caryopsis | diff:3
17. **Q**: In which Mexican city did the modern cylindrical burrito take form? | **A**: Ciudad Juárez | **D**: Mexico City, Tijuana, Monterrey, Guadalajara, Oaxaca, Puebla, Veracruz | diff:3
18. **Q**: In which country did the word 'burrito' originate as a regional name for a type of taco? | **A**: Mexico | **D**: United States, Spain, Guatemala, Cuba, Puerto Rico, Colombia, Argentina, Chile | diff:3
19. **Q**: What distinguishes a 'wet burrito' from a standard burrito? | **A**: It's smothered in sauce | **D**: It's boiled, not grilled, It uses wet corn tortillas, It contains soup inside, It's wrapped in a banana leaf, It's filled with stew, It's deep-fried and sauced, It uses soggy rice filling, It's steamed before serving | diff:2
20. **Q**: What chemical gives caramel its distinctive butter-like flavor? | **A**: Diacetyl | **D**: Caramelin, Sucrose, Fructose, Maillard compound, Glucose, Caramelans, Dextrose, Acrolein | diff:4

### Natural Sciences (5 facts)

21. **Q**: Where was the synthetic element roentgenium first created in 1994? | **A**: GSI Helmholtz Centre | **D**: CERN in Switzerland, Lawrence Berkeley Lab, Brookhaven National Lab, Oak Ridge National Lab, Los Alamos Laboratory, Fermi National Lab, RIKEN in Japan, Dubna in Russia | diff:4
22. **Q**: Which famous discovery earned Wilhelm Röntgen the naming honour of element 111? | **A**: X-rays | **D**: Radioactivity, Cathode rays, The photoelectric effect, Gamma radiation, Alpha particles, Nuclear fission, Electron spin, The neutron | diff:3
23. **Q**: Which SI unit of capacitance is named after Michael Faraday? | **A**: Farad | **D**: Ohm, Coulomb, Tesla, Joule, Watt, Henry, Maxwell, Ampere | diff:3
24. **Q**: Besides electromagnetism, what key organic compound did Faraday discover? | **A**: Benzene | **D**: Acetone, Ethanol, Methane, Toluene, Chloroform, Propane, Acetylene, Ammonia | diff:4
25. **Q**: Which Faraday invention laid the groundwork for all modern electric motors? | **A**: Electromagnetic rotary devices | **D**: The Leyden jar, The galvanometer, The arc lamp, The dynamo motor, The telegraph relay, The static generator, The voltaic pile, The cathode tube | diff:3

### Geography (5 facts)

26. **Q**: Which Italian region is called the birthplace of both the Renaissance and standard Italian? | **A**: Tuscany | **D**: Lombardy, Veneto, Lazio, Emilia-Romagna, Piedmont, Sicily, Campania, Umbria | diff:3
27. **Q**: Which peak is the highest point of the Lepontine Alps? | **A**: Monte Leone | **D**: Matterhorn, Monte Rosa, Piz Bernina, Grossglockner, Jungfrau, Eiger, Gran Paradiso, Monte Viso | diff:4
28. **Q**: The Simplon rail tunnel connects Brig to which Italian town? | **A**: Domodossola | **D**: Airolo, Bodio, Bellinzona, Lugano, Milan, Locarno, Biasca, Verbania | diff:4
29. **Q**: Which Spanish explorer gave the Philippines its name in 1543? | **A**: Ruy López de Villalobos | **D**: Ferdinand Magellan, Vasco da Gama, Hernán Cortés, Juan de la Cosa, Francisco Pizarro, Álvaro de Mendaña, Diego Velázquez, Sebastián de Benalcázar | diff:4
30. **Q**: How did Singapore become an independent country in 1965? | **A**: Expelled from Malaysia | **D**: Won a referendum, Declared independence, Was granted freedom by Britain, Revolted against colonial rule, Broke off from Indonesia, Was partitioned by the UN, Negotiated with Japan, Separated from China | diff:4

### History (5 facts)

31. **Q**: Who served as the first acting Secretary-General of the United Nations? | **A**: Gladwyn Jebb | **D**: Trygve Lie, Dag Hammarskjöld, U Thant, Kurt Waldheim, Javier Pérez de Cuéllar, Boutros Boutros-Ghali, Kofi Annan, Ban Ki-moon | diff:5
32. **Q**: Which three movements together marked the end of the Middle Ages? | **A**: Renaissance and Reformation | **D**: Enlightenment and Revolution, Crusades and Feudalism, Humanism and Colonialism, Trade and Banking, Printing Press and Compass, Magna Carta and Parliament, Feudalism and Chivalry, Exploration and Science | diff:3 ⚠️ MISMATCH
33. **Q**: Which Islamic empire conquered former Byzantine lands in North Africa in the 7th century? | **A**: Umayyad Caliphate | **D**: Abbasid Caliphate, Ottoman Empire, Fatimid Caliphate, Seljuk Empire, Rashidun Caliphate, Safavid Empire, Ayyubid Sultanate, Almohad Caliphate | diff:4
34. **Q**: Where did Pope Urban II proclaim the First Crusade in 1095? | **A**: Council of Clermont | **D**: Council of Nicaea, Lateran Council, Council of Constance, Diet of Worms, Council of Trent, Synod of Whitby, Council of Chalcedon, Council of Florence | diff:3
35. **Q**: How late did papally-sanctioned Crusades continue, according to Wikipedia? | **A**: 18th century | **D**: 14th century, 15th century, 16th century, 12th century, 13th century, 17th century, 19th century, 20th century | diff:4

### General Knowledge (5 facts)

36. **Q**: What industry drives the advancement of modern electronics? | **A**: Semiconductor industry | **D**: Telecommunications industry, Software industry, Chemical industry, Automotive industry, Aerospace industry, Energy sector, Pharmaceutical industry, Financial sector | diff:3
37. **Q**: What does the abbreviation SaaS stand for in cloud computing? | **A**: Software as a Service | **D**: Storage as a System, Servers as a Service, Software and a Server, Systems as a Solution, Scalable as a Service, Sharing as a Standard, Sync as a Service, Source as a Standard | diff:2
38. **Q**: Who created the C programming language at Bell Labs in the 1970s? | **A**: Dennis Ritchie | **D**: Ken Thompson, Brian Kernighan, Linus Torvalds, Donald Knuth, Bjarne Stroustrup, Alan Turing, Grace Hopper, John McCarthy | diff:3
39. **Q**: C runs on what scale of computing devices, from largest to smallest? | **A**: Supercomputers to tiny chips | **D**: Phones to servers, PCs to tablets, Mainframes to laptops, Workstations to watches, Servers to game consoles, Clusters to routers, Data centers to Raspberry Pi, Cloud to IoT devices | diff:3
40. **Q**: What key component did James Watt add to dramatically improve steam engine efficiency? | **A**: Separate condenser | **D**: Pressure valve, Flywheel governor, Piston rod, Boiler insulation, Double cylinder, Gear system, Water pump, Exhaust pipe | diff:3

### Human Body & Health (5 facts)

41. **Q**: What are the simplest type of eyes in the animal kingdom called? | **A**: Pit eyes | **D**: Pinhole eyes, Lens eyes, Compound eyes, Flat eyes, Cup eyes, Spot eyes, Shadow eyes, Facet eyes | diff:4
42. **Q**: Which eye-to-brain pathway regulates your body's daily internal clock? | **A**: Retinohypothalamic tract | **D**: Optic chiasm pathway, Visual cortex loop, Thalamic relay tract, Circadian nerve loop, Limbic light circuit, Melatonin feedback arc, Hypothalamic light ring, Pineal feedback tract | diff:5
43. **Q**: What is the biological term for the evolutionary concentration of the brain in the head? | **A**: Cephalization | **D**: Encephalization, Neurocranium, Corticalization, Cerebralization, Cranialization, Craniation, Rostralization, Brainstem shift | diff:4
44. **Q**: Which branch of the nervous system controls the gastrointestinal tract? | **A**: Enteric nervous system | **D**: Sympathetic system, Somatic nervous system, Parasympathetic system, Central nervous system, Peripheral nervous system, Endocrine system, Vagal network, Gut-brain axis | diff:4
45. **Q**: What are nerves that carry signals FROM the brain to the body called? | **A**: Motor nerves | **D**: Sensory nerves, Afferent nerves, Cranial receptors, Reflex nerves, Input nerves, Ascending nerves, Receptor fibers, Somatic nerves | diff:3

### Mythology & Folklore (5 facts)

46. **Q**: Which Shinto goddess is the mythical ancestress of Japan's Imperial House? | **A**: Amaterasu | **D**: Izanami, Benzaiten, Ōkuninushi, Tsukuyomi, Susanoo, Inari, Hachiman, Konohanasakuya | diff:3
47. **Q**: Which Shinto creator god fathered the Three Precious Children, including Amaterasu? | **A**: Izanagi | **D**: Izanami, Susanoo, Ōkuninushi, Raijin, Fujin, Inari, Takemikazuchi, Tsukuyomi | diff:3
48. **Q**: In which Japanese prefecture is Amaterasu's holiest shrine located? | **A**: Mie Prefecture | **D**: Kyoto Prefecture, Nara Prefecture, Shimane Prefecture, Tokyo Prefecture, Osaka Prefecture, Aichi Prefecture, Hyogo Prefecture, Fukuoka Prefecture | diff:4
49. **Q**: Which eight-headed serpent did the Japanese storm god Susanoo slay? | **A**: Yamata no Orochi | **D**: Ryujin the Sea God, Naga Vasuki, Leviathan the Serpent, Tiamat the Dragon, Jormungandr, Typhon the Giant, Apophis the Chaos, Fafnir the Dwarf | diff:3
50. **Q**: Which Japanese god is depicted as both villain and hero in different myths? | **A**: Susanoo | **D**: Raijin, Izanagi, Ōkuninushi, Inari, Fujin, Benzaiten, Tsukuyomi, Kagu-tsuchi | diff:4

### Space & Astronomy (5 facts)

51. **Q**: Who first published the nebular hypothesis explaining solar system formation? | **A**: Immanuel Kant | **D**: Pierre Laplace, Isaac Newton, Johannes Kepler, Galileo Galilei, Nicolaus Copernicus, Edmund Halley, William Herschel, Tycho Brahe | diff:3 ⚠️ AMBIGUOUS
52. **Q**: What does the nebular hypothesis explain about planetary orbital planes? | **A**: They are nearly coplanar | **D**: They orbit at random angles, They follow elliptical paths only, They mirror the Moon's orbit, They formed after the Sun cooled, They were captured from space, They orbit in opposite directions, They tilt toward the ecliptic, They align with magnetic poles | diff:3
53. **Q**: On what date was Ceres discovered, making it a celestial New Year's gift? | **A**: January 1, 1801 | **D**: March 13, 1781, February 18, 1930, December 25, 1758, July 4, 1848, August 25, 1989, November 10, 1572, June 21, 1682, April 15, 1912 | diff:3
54. **Q**: What type of volcano on Ceres erupts with briny water instead of lava? | **A**: Cryovolcano | **D**: Mud volcano, Ice geyser, Salt dome, Brine fountain, Hydrothermal vent, Frost plume, Silica fumarole, Ammonia geyser | diff:3
55. **Q**: Of the nine recognized dwarf planets, how many have been visited by spacecraft? | **A**: Two | **D**: None, One, Three, Four, Five, All nine, Six, Seven | diff:3

### Americas / Geography (5 facts)

56. **Q**: Bolivia is the largest landlocked country in which hemisphere? | **A**: Southern Hemisphere | **D**: Northern Hemisphere, Eastern Hemisphere, Western Hemisphere, Both Northern and Southern equally, South America only counts its own, It is not landlocked, Western South America, It is partly landlocked | diff:3
57. **Q**: What remarkable geological feature makes Dominica home to the world's second-largest hot spring? | **A**: Boiling Lake | **D**: Fumarole Crater, Morne Diablotins Geyser, Caribbean Caldera Pool, Thermal Grand Basin, Windward Sulphur Springs, Roseau Hot Spring, Wotten Waven Vent, Soufrière Crater Pool | diff:4
58. **Q**: Suriname is the only independent state outside Europe where which language is the official and prevailing language? | **A**: Dutch | **D**: French, Portuguese, English, Spanish, Sranan Tongo, Javanese, Arawak, German | diff:3
59. **Q**: Pico Duarte in the Dominican Republic holds which distinction in the Caribbean? | **A**: It is the Caribbean's tallest mountain | **D**: It is the Caribbean's longest ridge, It is the Caribbean's oldest volcanic peak, It is the Caribbean's most climbed peak, It is the Caribbean's second-highest mountain, It is the only Caribbean peak with permanent snow, It is the Caribbean's most biodiverse mountain, It is the Caribbean's lowest elevated capital, It is the island's most active volcano | diff:3
60. **Q**: Guatemala is the most populous country in Central America. Which ancient civilization had its core territory here? | **A**: Maya civilization | **D**: Aztec civilization, Olmec civilization, Inca civilization, Zapotec civilization, Toltec civilization, Mixtec civilization, Teotihuacan civilization, Teotihuacan civilization | diff:2 ⚠️ DUP DISTRACTOR

---

## Additional Observations

### Combat Quiz System — Not Reachable

The combat quiz pipeline requires the backend API to assign facts to cards. When the API is offline, **zero quiz content appears in combat** — the game falls back to starter-only play with no educational value. This is a significant single point of failure. The local FactsDB (46,824 facts) exists and is initialized, but it is not used as a fallback for card assignment.

Recommendation: Implement offline fallback — when `/api/facts/packs/all` fails, assign facts from the local FactsDB using the selected domains. The data is already loaded.

### Domain Taxonomy Hygiene

- `categoryL1: "History"` (capitalized) exists alongside `"history"` (lowercase) — 1 orphan fact
- `categoryL1: "europe"` (6 facts total) and `"americas"` (5 facts) should be subcategories under `"geography"`, not top-level categories
- Deduplication of distractor arrays should be enforced at write time

### Quiz Presentation Quality (Inferred from DB)

With 7–8 distractors per fact and a 3-choice game presentation, the game selects 2 distractors randomly per quiz. This means the same fact will present different wrong answers each time — good for replayability. However, the 21 facts with duplicate distractors in their pool could surface the same choice twice in a 3-option quiz, which would be confusing.
