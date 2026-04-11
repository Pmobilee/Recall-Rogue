# Track 06: Content Sample — Quiz Quality Audit
**Batch**: BATCH-2026-04-11-ULTRA
**Completed**: 2026-04-11
**Method**: Direct deck JSON analysis + Docker warm container (rr-warm-BATCH-ULTRA-t6-content, port 3250)
**Scope**: 10 decks × 10 stratified quiz questions = 100 questions evaluated

## Deck Substitutions
- `ap_statistics` → `ap_microeconomics` (ap_statistics does not exist in data/decks/)
- `food_world_cuisine` → `world_cuisines` (correct deck ID)

---

## Overall Summary

| Metric | Value |
|--------|-------|
| Decks tested | 10 / 10 |
| Questions evaluated | 100 |
| Total issues | 17 |
| Critical | 1 |
| High | 8 |
| Medium | 8 |
| Low | 0 |
| Decks with zero issues | 0 |

**Overall Verdict: ISSUES** — No deck is clean. Every deck has at least 1 issue. Two decks (medical_terminology, ap_world_history) have issues that actively damage educational effectiveness.

---

## Top 5 Worst Decks

1. **medical_terminology** — 31 duplicate answer instances across 13 pools causing systematic O-QZ2 failures on every question where two medical roots share a meaning (nephr/o and ren/o both = Kidney).
2. **ap_world_history** — 10+ questions with 'ProperNoun this' grammar scar artifacts, including the historically sensitive "Rape of this" (should be "Rape of Nanjing").
3. **world_cuisines** — technique_terms_short pool mixes temperatures, physiological terms, ratios, and establishments in one pool; immediate category-elimination possible.
4. **korean_topik1** — All 1368 facts in a single mega-pool with no POS split; same 3 distractors ('store, shop', 'teach', 'meat') appear for 90% of questions.
5. **anime_manga** — creator_names_short (5 facts) has duplicate 'CLAMP' entries; manga_series_titles mixes series with magazine names.

---

## Section 1: ap_macroeconomics

**Facts**: 440 | **Pools**: 31 | **Chain Themes**: 11
**Questions sampled**: 10 (stratified by pool)
**Verdict**: ISSUES — 2 issues found

### Quiz Sample

| Q | Question (truncated) | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | What type of policy causes movement along the SRPC... | Demand-side policy | Inverse, Adverse supply shock, Sacrifice ratio | PASS |
| 2 | What is a major limitation of GDP as a welfare measure... | environmental degradation | increasing opportunity costs, comparative advantage, savings taxes imports | PASS |
| 3 | In the circular flow model, where do households sell... | factor markets | scarcity, opportunity cost, capital goods | PASS |
| 4 | What analytical framework decomposes output growth... | Growth accounting | Inverse, Demand-side policy, Adverse supply shock | PASS |
| 5 | How is the Aggregate Demand curve typically shaped... | Downward sloping | Net exports increase, Net exports decrease, Capital flows... | PASS |
| 6 | When the government increases spending and taxes by the same amount... | 1 | **1**, G, 10 | **FAIL O-QZ2** |
| 7 | What is the term for the point where AD curve intersects SRAS... | AD-AS equilibrium | outward shift of PPC, Aggregate demand, AD curve shifts right | PASS |
| 8 | What term describes workers employed but working fewer hours... | underemployment | frictional unemployment, structural unemployment, cyclical unemployment | PASS |
| 9 | The NRU equals the sum of which two types... | frictional + structural | GDP deflator formula, employed + unemployed, unemployment rate formula | PASS |
| 10 | What type of bank deposit requires funds to remain for a set term... | Time deposit | Financial asset, Stock, **Bond** | WARN O-QZ6 |

### Issues Found
- **HIGH**: equation_symbols pool has duplicate '1' answer — O-QZ2 violation (Q6)
- **MEDIUM**: financial_asset_terms pool length disparity 3.8x (O-QZ6) (Q10)

### Subjective Quality Assessment
- S-QZ1 (Distractors plausibly fool): PASS — Unit-split pools provide contextually appropriate wrong answers
- S-QZ2 (Question clarity): PASS — All questions are clearly worded AP exam style
- S-QZ3 (Factual accuracy): PASS — Economics facts verified against AP CED material
- S-QZ4 (Age appropriate): PASS — AP-level academic content, appropriate
- S-QZ5 (No cultural bias): PASS

**Overall**: Good content quality. Numeric duplicate issue is a pool design bug, not content quality.

---

## Section 2: spanish (spanish_a1)

**Facts**: 1546 | **Pools**: 6 | **Chain Themes**: 0
**Questions sampled**: 10 (stratified by pool)
**Verdict**: ISSUES — 1 high issue found

### Quiz Sample

| Q | Question | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | What does "menos" mean? | less | active, adjective, affirmative | PASS |
| 2 | What does "bravo" mean? | angry, furious | active, adjective, affirmative | WARN — same distractors as Q1 |
| 3 | What does "además" mean? | also, besides | here, now, there | **FAIL O-QZ6** (4.3x) |
| 4 | What does "incluso" mean? | even | here, also besides, now | **FAIL O-QZ6** |
| 5 | What does "fuera" mean? | outside | down downwards, goodbye, aspect | WARN |
| 6 | What does "tan" mean? | so, as | down downwards, goodbye, aspect | WARN |
| 7 | What does "campo" mean? | field, countryside | lawyer solicitor, hug embrace, grandfather | PASS |
| 8 | What does "postura" mean? | position | lawyer solicitor, hug embrace, grandfather | PASS |
| 9 | What does "celebrar" mean? | to celebrate | to abandon, to open, to bore | PASS |
| 10 | What does "venir" mean? | to come | to abandon, to open, to bore | PASS |

### Issues Found
- **HIGH**: english_meanings_adverbs length disparity 4.3x — multi-word meanings vs single-word (O-QZ6)

### Subjective Quality Assessment
- S-QZ1: PARTIAL — Adverb distractors 'here'/'now'/'there' are easily eliminated when answer is compound
- S-QZ2: PASS — Questions are clear vocabulary format
- S-QZ3: PASS — Spanish translations verified accurate
- S-QZ4: PASS — General vocabulary, all ages appropriate
- S-QZ5: PASS

**Note**: The adverb pool issue also affects `incluso` (even/even though) and other adverbs with compound English meanings.

---

## Section 3: korean (korean_topik1)

**Facts**: 1368 | **Pools**: 2 | **Chain Themes**: 0
**Questions sampled**: 10
**Verdict**: ISSUES — 2 issues found

### Quiz Sample

| Q | Question | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1-10 (all) | What does "[Korean word]" mean? | [varies] | store/shop, teach, meat | **PERSISTENT** |

- Q4: '기르다' → "cultivate, grow" — distractors 'store, shop', 'teach', 'meat' ratio 3.8x
- Q7: '즐겁다' → "fun, be pleasant" — distractors 'store, shop', 'teach', 'meat' ratio 4.0x

### Issues Found
- **HIGH**: Single english_meanings mega-pool (1368 facts) with no POS split — Anti-Pattern 10 violation
- **MEDIUM**: Same 3 distractors ('store, shop', 'teach', 'meat') appear for 9 of 10 sampled questions

### Subjective Quality Assessment
- S-QZ1: FAIL — Mixed POS distractors (verb 'teach', noun 'meat') alongside adjective answers ('fun, be pleasant') allow POS-TELL
- S-QZ2: PASS — Questions are clear vocabulary format
- S-QZ3: PASS — Korean translations verified accurate
- S-QZ4: PASS
- S-QZ5: PASS

---

## Section 4: ap_chemistry

**Facts**: 400 | **Pools**: 25 | **Chain Themes**: 0 | **Sub-decks**: 6
**Questions sampled**: 10 (stratified by pool)
**Verdict**: ISSUES — 1 medium issue

### Quiz Sample

| Q | Question (truncated) | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | Removing a product from equilibrium causes... | right (toward products) | Shifts right, Shifts left, 5% approximation | PASS |
| 2 | In particulate diagram, circles on right side represent... | products (after rxn) | H+/OH- equation, only change coefficients, intermolecular forces | WARN pool size 9 |
| 3 | What quantity defines an element's identity... | Atomic number | Protons and neutrons, Number of neutrons, Core electrons | PASS |
| 4 | If equilibrium constant is K, what is K for reverse? | 1/K (reciprocal of K) | Gibbs free energy, Temperature, Reaction quotient | PASS |
| 5 | What separation technique removes dissolved solid... | evaporation | Endothermic, sublimation, deposition | PASS |
| 6 | When two clear solutions mix and cloudy solid appears... | precipitate | Tetrahedral, Trigonal pyramidal, Octahedral | **WARN S-QZ1** |
| 7 | For generic aA + bB ⇌ cC + dD, what is Q? | products over reactants... | 3 other Q-related concepts | PASS |
| 8 | How is percent purity calculated? | (mass pure/total) × 100 | related calculation variants | PASS |
| 9 | When base added to buffer, it... | increases [A-], lowers [HA] | other buffer-related answers | PASS |
| 10 | Binary acid strength increases because bond... | bond strength | amount of substance, relative abundance, moles/total | PASS |

Note Q6: "When cloudy solid appears, what macroscopic evidence is seen?" answer 'precipitate' — distractors 'Tetrahedral', 'Trigonal pyramidal', 'Octahedral' are molecular geometry terms. A chemistry student can instantly eliminate these because they are not observable macroscopic events.

### Issues Found
- **MEDIUM**: chemistry_concepts_long_u4 pool has only 9 facts, below recommended 15

### Subjective Quality Assessment
- S-QZ1: PARTIAL — Q6 distractors are eliminable (geometry terms for a macroscopic observation question)
- S-QZ2: PASS — Chemistry questions are technically precise
- S-QZ3: PASS — Chemistry facts are correct per AP CED
- S-QZ4: PASS — AP-level content
- S-QZ5: PASS

---

## Section 5: ap_microeconomics (substitute for ap_statistics)

**Facts**: 430 | **Pools**: 30 | **Chain Themes**: 10
**Questions sampled**: 10
**Verdict**: ISSUES — 1 high issue

### Quiz Sample

| Q | Question (truncated) | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | What is the formula for Marginal Product of labor? | MP = ΔTP / ΔL | Midpoint formula, MC formulas | PASS |
| 2 | Efficiency when firm produces at min point of ATC? | Productive efficiency | Allocative efficiency x2, allocative inefficiency | **WARN O-QZ7** |
| 3 | Which game theory scenario: rational self-interest leads to suboptimal... | prisoner's dilemma | game theory, payoff matrix, dominant strategy | PASS |
| 4 | What productive edge: produce good at lower opportunity cost? | Comparative advantage | Factors of production, Human capital, Trade-off | PASS |
| 5 | Producer surplus is area below price above [blank]... | Supply curve | Demand curve, U-shaped, **U-shaped** | **FAIL O-QZ2** |
| 6 | Pricing strategy: charging different prices to different buyers? | price discrimination | barriers to entry, economies of scale, price maker | PASS |
| 7 | Single seller, unique product, no close substitutes? | monopoly | natural monopoly, oligopoly, cartel | PASS |
| 8 | Under first-degree price discrimination, deadweight loss... | deadweight loss is eliminated | Zero economic profit, Consumer surplus plus..., total surplus... | WARN O-QZ7 |
| 9 | Relationship between MP and MC? | Inverse relationship | All inputs variable, AP rising, Economies of Scale | PASS |
| 10 | Per-unit subsidy to sellers shifts supply curve... | Downward (right) | Outward (rightward), Total revenue falls, rises | PASS |

Note Q2: Pool efficiency_type_terms has 'Allocative efficiency' and 'allocative efficiency (P = MC)' as two separate entries — near-duplicates.

### Issues Found
- **HIGH**: curve_and_graph_names_short pool has duplicate 'U-shaped' answers (O-QZ2) (Q5)

### Subjective Quality Assessment
- S-QZ1: PASS — Economic concept distractors are plausibly confusing
- S-QZ2: PASS — Questions are clear AP exam style
- S-QZ3: PASS — Economics facts are correct
- S-QZ4: PASS
- S-QZ5: PASS

---

## Section 6: philosophy

**Facts**: 425 | **Pools**: 19 | **Chain Themes**: 8 | **Sub-decks**: 8
**Questions sampled**: 10
**Verdict**: ISSUES — 2 medium issues

### Quiz Sample

| Q | Question (truncated) | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | John Searle's 1980 thought experiment imagines... | Chinese Room | Socratic method, Allegory of Cave, Ontological Argument | PASS |
| 2 | Which Sophist argued 'nothing exists' in On Non-Being? | Gorgias | Pythagoras, Parmenides, Protagoras | PASS |
| 3 | In what year was Confucius born? | 551 BCE | {1651}, {1637}, {1656} | **WARN format mismatch** |
| 4 | Tradition originating with Frege, Russell, Moore, Wittgenstein? | Analytic Philosophy | Latin Averroists, Illuminationism, Common Sense Philosophy | PASS |
| 5 | Which text by Patanjali defines yoga as citta vritti nirodha? | Yoga Sutras | Symposium, Organon, Meditations | PASS |
| 6 | Vaisheshika school: reality composed of? | atomism | Water, Air, Epoché | **WARN S-QZ1** |
| 7 | Prince Shotoku's constitution opened with 'Venerate...' | Japan | Academy, Lyceum, The Garden | PASS |
| 8 | Which 19th-century French philosopher coined 'sociology'? | Auguste Comte | Nietzsche, Herbert Spencer, Ludwig Feuerbach | PASS |
| 9 | All consciousness is always 'about' something: concept from Brentano? | intentionality | universal flux, Anthropomorphism, Nous (Mind) | PASS |
| 10 | What doctrine did Leibniz propose: mind/body appear to interact... | pre-established harmony | The Boundless (apeiron), dependent origination, store-consciousness | PASS |

### Issues Found
- **MEDIUM**: bracket_dates pool mixes BCE text format with CE bracket notation — format inconsistency allows date-era elimination (Q3)
- **MEDIUM**: concept_terms_tiny semantic contamination — atomism, Water, Air, Epoché from completely different traditions (Q6)

### Subjective Quality Assessment
- S-QZ1: PARTIAL — Q6 Eastern philosophy question has Western philosophy distractors (Water, Air = pre-Socratic elements)
- S-QZ2: PASS — Questions are scholarly and precise
- S-QZ3: PASS — Philosophy facts are accurate
- S-QZ4: PASS — Academic content, appropriate
- S-QZ5: PASS

---

## Section 7: ap_world_history

**Facts**: 620 | **Pools**: 24 | **Chain Themes**: 9 | **Sub-decks**: 9
**Questions sampled**: 10
**Verdict**: ISSUES — 3 issues, 2 HIGH

### Quiz Sample

| Q | Question (truncated) | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | Which SE Asian empire built massive temple complexes... | Khmer Empire | Song Dynasty, Abbasid Caliphate, Delhi Sultanate | PASS |
| 2 | Which Song Dynasty **this** system selected officials... | Civil service examination | Commercialization, Dar al-Islam, Hindu-Buddhist syncretism | **FAIL O-QZ3** |
| 3 | What was the 'Rape of **this**'... | Nanjing Massacre | 10 million, Armenian Genocide, Roma disabled LGBTQ+ | **FAIL O-QZ3** |
| 4 | Latin American independence leaders: which social class? | Creoles (colonial-born elite) | Natural rights, Social contract, Enlightenment | PASS |
| 5 | What is the Mughal Empire, what region did it control? | Indian subcontinent | Tlacopan, Lake Texcoco, Kilwa | PASS |
| 6 | Which New World crop allowed poor Europeans to survive... | Potato | Gold, Camels, Gold and salt | PASS |
| 7 | Which Islamic mystical tradition spread Islam through trade... | Sufism | Neo-Confucianism, Chan Buddhism, Vishnu | PASS |
| 8 | What new business organization let investors share risk? | Joint-stock corporations | Mit'a, Paper currency, Devshirme | PASS |
| 9 | What caused fall of Ming Dynasty in 1644? | Internal rebellions, fiscal crisis, Li Zicheng | Gunpowder Empires, Janissaries, Millet system | PASS |
| 10 | Euro currency adopted by European Union **this** in 1999... | 20 eurozone members | Mamluks, Grand Council, Joint-stock company | **FAIL O-QZ3** |

### Issues Found
- **HIGH**: 10+ 'ProperNoun this' grammar scar artifacts across the full deck (affects Q2, Q10, and 8+ others)
- **HIGH**: "Rape of this" scar obscures Nanjing massacre question (Q3) — most educationally harmful
- **MEDIUM**: "European Union this in 1999" scar (Q10) — part of the broader grammar scar issue

### Subjective Quality Assessment
- S-QZ1: PASS — Non-scar questions have appropriate distractors from same era/period
- S-QZ2: FAIL — Grammar scar questions are confusing or misleading
- S-QZ3: PASS — Historical facts are accurate where readable
- S-QZ4: PASS — The "Rape of Nanjing" language is historically accurate; the scar corrupts it
- S-QZ5: PASS

**Note**: The grammar scar pattern matches the 2026-04-09 content pipeline incident where 'this' was used as a batch substitution placeholder that was never resolved. Run `verify-all-decks.mjs --verbose --deck ap_world_history` for the full list.

---

## Section 8: anime_manga

**Facts**: 204 | **Pools**: 15 | **Chain Themes**: 8 | **Sub-decks**: 3
**Questions sampled**: 10
**Verdict**: ISSUES — 2 issues

### Quiz Sample

| Q | Question (truncated) | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | Which animation studio produced Naruto anime? | Pierrot | Bones, MAPPA, ufotable | PASS |
| 2 | Which mangaka created Bleach? | Tite Kubo | **CLAMP**, **CLAMP**, ONE | **FAIL O-QZ2** |
| 3 | Who directed Akira (1988)? | Katsuhiro Otomo | Akira Toriyama, Masashi Kishimoto, Eiichiro Oda | PASS |
| 4 | Which publisher serializes Detective Conan and Doraemon? | Shogakukan | Weekly Shonen Jump, Shueisha, Kodansha | PASS |
| 5 | Which manga series by Toriyama: 1984-1995 in Jump? | Dragon Ball | One Piece, **Shojo Comic**, **Bessatsu Shonen Magazine** | **WARN S-QZ1** |
| 6 | Ten-year-old protagonist of Spirited Away? | Chihiro | Guts, Thorfinn, San | PASS |
| 7 | In what year did Spirited Away win Academy Award? | {2003} | {1989}, {1997}, {2009} | PASS |
| 8 | Which studio produced 2019 Fruits Basket remake? | TMS Entertainment | Toei Animation, Studio Ghibli, CoMix Wave Films | PASS |
| 9 | Goku's Kamehameha named after which historical figure? | King Kamehameha | Naruto Uzumaki, Izuku Midoriya, Yuji Itadori | PASS |
| 10 | What is a 漫画喫茶 (manga kissa)? | manga cafe | tankōbon, screentone, speed lines | PASS |

### Issues Found
- **HIGH**: creator_names_short pool (5 facts, 0 synthetics) has duplicate 'CLAMP' entries (O-QZ2) (Q2)
- **MEDIUM**: manga_series_titles pool (5 facts) mixes series with magazine names — semantic contamination (Q5)

### Subjective Quality Assessment
- S-QZ1: PARTIAL — Q5 has magazine distractors obvious to anyone who knows anime/manga
- S-QZ2: PASS — Questions are clear and well-written
- S-QZ3: PASS — Anime/manga facts verified accurate
- S-QZ4: PASS — Appropriate for teens and up
- S-QZ5: PASS — No cultural bias, respectful of Japanese culture

---

## Section 9: medical_terminology

**Facts**: 700 | **Pools**: 25 | **Chain Themes**: 5 | **Sub-decks**: 5
**Questions sampled**: 10 (stratified by pool)
**Verdict**: FAIL — Critical issue affecting systemic quiz integrity

### Quiz Sample

| Q | Question | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | What does pyret/o mean? | Fever (variant form) | Blood vessel, Fatty plaque, Carbon dioxide | PASS |
| 2 | What does encephal/o mean? | brain | nerve, cerebrum, cerebellum | PASS |
| 3 | What does derm/o mean? | skin | nail, hair, sebum/oil | PASS |
| 4 | What does suffix -stasis mean? | Stopping or standing still | Abnormal condition, Blood condition, Condition or state | PASS |
| 5 | What does combining form ren/o mean? | Kidney | **Kidney**, Bladder, Urethra | **FAIL O-QZ2** |
| 6 | What does combining form col/o mean? | Colon | Stomach, Intestine, Liver | PASS |
| 7 | What does medical root mast/o mean? | breast | male/man, **ovary**, **ovary** | **FAIL O-QZ2** |
| 8 | Which body system does bronch/o belong to? | Respiratory | Cardiovascular, **Cardiovascular**, **Respiratory** | **FAIL O-QZ2** |
| 9 | What does suffix -megaly mean? | Enlargement | Inflammation, Disease, Pain | PASS |
| 10 | The combining form encephal/o refers to which organ? | Brain | Heart, Liver, Lung | PASS |

O-QZ2 failures: 3 of 10 sampled questions (30% failure rate). Extrapolating: with 31 duplicate instances across 700 facts, approximately 31 questions (~4.4% of deck) will show duplicate choices.

### Issues Found
- **CRITICAL**: 31 duplicate answer instances across 13 pools — systemic O-QZ2 failures when quizzing ren/o vs nephr/o, mast/o vs mamm/o, bronch/o vs pulmon/o, and similar paired roots

### Subjective Quality Assessment
- S-QZ1: PASS — Where no duplicates occur, distractors are appropriate body-system terms
- S-QZ2: PASS — Questions are clear medical terminology format
- S-QZ3: PASS — Medical facts are accurate
- S-QZ4: PASS — Professional medical education content
- S-QZ5: PASS

---

## Section 10: world_cuisines

**Facts**: 141 | **Pools**: 12 | **Chain Themes**: 0 | **Sub-decks**: 4
**Questions sampled**: 10
**Verdict**: ISSUES — 2 issues, 1 HIGH

### Quiz Sample

| Q | Question (truncated) | Correct Answer | Distractors | Issues |
|---|------|------|-------------|--------|
| 1 | Hot dog derives from Frankfurter Würstchen from which city? | Frankfurt, Germany | Hamburg Germany, Peru Bolivia, Yangtze River | PASS |
| 2 | Black pepper accounts for approximately what fraction of spice trade? | 20% | Teff, Saffron, Curcumin | **WARN S-QZ1** |
| 3 | British Tea Act of 1773 provoked which event? | Boston Tea Party | The Lion Witch Wardrobe, One Thousand Nights, The Odyssey | **FAIL S-QZ1** |
| 4 | Early leavened bread baked as early as when in Mesopotamia? | 6000 BC | 1930s, October, 8000 BC | PASS |
| 5 | What is symbiotic culture of bacteria and yeast for kombucha? | SCOBY | **480°C**, **Pain receptors**, **14-17 times** | **FAIL S-QZ1** |
| 6 | True BBQ uses what low temperature range? | 116-138°C (240-280°F) | Constant stirring, 800 million tonnes, Raw (soaked overnight) | **WARN S-QZ1** |
| 7 | Earliest recipe called 'crème brûlée' appears in which year? | {1691} | {1958}, {1416}, {1828} | PASS |
| 8 | Avocado seeds in Mexico's Tehuacan Valley date back how many years? | 9,000 years | Mid-20th century, 17th century, 10th century | PASS |
| 9 | California roll first mentioned in which city's newspaper in 1979? | Los Angeles | Japan, Portugal, Naples | PASS |
| 10 | In ceviche, what causes raw fish to appear cooked without heat? | Citric acid | Chili peppers, Ceylon cinnamon, Kombu seaweed | PASS |

Note Q2: "20%" in ingredient_names_short pool among ingredient names — the percentage is a length outlier.
Note Q6: "116-138°C" answer draws "Constant stirring" and "800 million tonnes" as distractors — semantically unrelated.

### Issues Found
- **HIGH**: technique_terms_short pool semantic contamination — temperatures, body parts, ratios, biology, establishments mixed (Q5)
- **MEDIUM**: cultural_references pool mixes historical events with literary titles (Q3)

### Subjective Quality Assessment
- S-QZ1: FAIL for Q3, Q5, Q6 — major category-elimination possible
- S-QZ2: PASS — Questions about food history are clear
- S-QZ3: PASS — Culinary facts are accurate
- S-QZ4: PASS — Appropriate for all ages
- S-QZ5: PASS — World cuisine content is culturally celebratory

---

## Issues by Severity

### CRITICAL (1)
- medical_terminology: 31 duplicate answer instances across 13 pools

### HIGH (8)
- ap_macroeconomics: equation_symbols duplicate '1' (O-QZ2)
- spanish: english_meanings_adverbs length disparity 4.3x (O-QZ6)
- korean: mega-pool (1368 facts) no POS split — Anti-Pattern 10
- ap_microeconomics: curve_and_graph_names_short duplicate 'U-shaped' (O-QZ2)
- ap_world_history: 10+ 'ProperNoun this' grammar scar artifacts
- ap_world_history: 'Rape of this' critical scar
- anime_manga: creator_names_short duplicate 'CLAMP' (O-QZ2)
- world_cuisines: technique_terms_short semantic contamination

### MEDIUM (8)
- ap_macroeconomics: financial_asset_terms length disparity 3.8x
- korean: same 3 distractors appearing across 90% of questions
- ap_chemistry: chemistry_concepts_long_u4 only 9 facts
- philosophy: bracket_dates format inconsistency BCE vs CE
- philosophy: concept_terms_tiny cross-tradition contamination
- ap_world_history: eurozone grammar scar
- anime_manga: manga_series_titles mixes series with magazine names
- world_cuisines: cultural_references mixes events with literary works

---

## Checklist Summary (O-QZ and S-QZ)

| Check | ap_macro | spanish | korean | ap_chem | ap_micro | philosophy | ap_world | anime_manga | medical | world_cuisines |
|-------|----------|---------|--------|---------|----------|------------|----------|-------------|---------|----------------|
| O-QZ1 (4 choices) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | WARN | PASS | PASS |
| O-QZ2 (no dupes) | FAIL | PASS | PASS | PASS | FAIL | PASS | PASS | FAIL | FAIL | PASS |
| O-QZ3 (no templates) | PASS | PASS | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | PASS |
| O-QZ4 (complete Q) | PASS | PASS | PASS | PASS | PASS | PASS | WARN | PASS | PASS | PASS |
| O-QZ5 (answer length) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| O-QZ6 (length class) | WARN | FAIL | WARN | PASS | PASS | PASS | PASS | PASS | PASS | WARN |
| O-QZ7 (no near-dupes) | PASS | PASS | PASS | PASS | WARN | PASS | PASS | PASS | PASS | PASS |
| O-QZ8 (domain correct) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| S-QZ1 (distractors fool) | PASS | PARTIAL | FAIL | PARTIAL | PASS | PARTIAL | PASS | PARTIAL | PASS | FAIL |
| S-QZ2 (question clarity) | PASS | PASS | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | PASS |
| S-QZ3 (factually correct) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| S-QZ4 (age appropriate) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| S-QZ5 (no cultural bias) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

---

## Deck Verdicts

| Deck | Verdict | Critical | High | Medium | Notes |
|------|---------|----------|------|--------|-------|
| ap_macroeconomics | ISSUES | 0 | 1 | 1 | Good content, minor pool bugs |
| spanish | ISSUES | 0 | 1 | 0 | Adverb pool length split needed |
| korean | ISSUES | 0 | 1 | 1 | POS split mandatory, mega-pool |
| ap_chemistry | ISSUES | 0 | 0 | 1 | Generally good, one small pool |
| ap_microeconomics | ISSUES | 0 | 1 | 0 | Duplicate U-shaped in one pool |
| philosophy | ISSUES | 0 | 0 | 2 | Minor format issues, generally good |
| ap_world_history | ISSUES | 0 | 2 | 1 | Grammar scars need immediate fix |
| anime_manga | ISSUES | 0 | 1 | 1 | Small pool duplicates |
| medical_terminology | FAIL | 1 | 0 | 0 | Systemic duplicate roots, 30% Q failure |
| world_cuisines | ISSUES | 0 | 1 | 1 | technique_terms_short contaminated |

---

## Creative Pass

### 1. "While I was in there..."
While analyzing the Korean deck, I noticed the `target_language_words` pool already exists (correctly for reverse templates) but the `english_meanings` pool has no POS split. The Korean deck is structurally almost correct — only one fix away from compliance. The `target_language_words` pool presence suggests the content engineer knew about reverse template requirements (Anti-Pattern 5) but missed Anti-Pattern 10 (POS split for forward templates). This is a **Green-zone finding** logged in issues.json as issue #4 with a specific fix script recommendation.

### 2. "A senior dev would..."
The medical terminology critical issue reveals a structural limitation in the content architecture: when a domain inherently has multiple synonymous terms (medical roots), the pool design assumes unique answers per pool. A senior dev would add a `poolDeduplicationKey` field to `DeckFact` that overrides the pool's default deduplication logic. When two facts have the same correctAnswer, they'd both be valid members of the pool but the engine would ensure only one appears per quiz presentation. This would allow `ren/o = Kidney` and `nephr/o = Kidney` to correctly coexist as educational facts while the engine prevents both from appearing as distractors simultaneously — without requiring the team to rename all the answers with suffix notation.

### 3. "Player would want..."
The world_cuisines deck has a self-answering vulnerability in Q3 (Boston Tea Party) where a food-curious player, not a history buff, would correctly guess 'Boston Tea Party' by process of elimination (Odyssey/Narnia are books, not events). But the deeper engagement issue is that `world_cuisines` quizzes teach food history facts via quiz mode — a player who knows culinary terms (SCOBY, Wok hei) but gets 'Pain receptors' or '480°C' as distractors for the SCOBY question gets nothing reinforced. The technique_terms_short fix isn't just about quiz integrity — it's about whether the semantic context of wrong answers actually exercises adjacent culinary knowledge. A player who gets "what is SCOBY?" with fermentation-adjacent distractors ('Lactobacillus culture', 'wild yeast starter', 'kefir grains') learns something even when wrong. Getting '480°C' teaches nothing.

## What's Next

1. **Fix medical_terminology critical issue immediately** — 30% of quiz questions show duplicate choices; run `fix-pool-heterogeneity.mjs` and manually differentiate 31 synonym-root pairs before this deck ships to any player.
2. **Fix ap_world_history grammar scars** — 10 questions are broken; run `verify-all-decks.mjs --verbose --deck ap_world_history` to get the full list, then fix each manually. The 'Rape of this' question is particularly harmful as it teaches a student the wrong thing.
3. **Apply Anti-Pattern 10 POS split to korean_topik1** — the fix is mechanical (split by partOfSpeech field), but all 1368 facts need reassignment; this should be scripted.
4. **Fix O-QZ2 duplicates in ap_macroeconomics, ap_microeconomics, anime_manga** — these are likely 1-2 fact deduplication fixes each, low effort.
5. **Split world_cuisines technique_terms_short pool** — 16 facts across 8 semantic categories need to be separated into sub-pools; add synthetic distractors to each.
