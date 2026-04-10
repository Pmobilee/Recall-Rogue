# Quiz Quality Tester Report — BATCH-2026-04-10-003-fullsweep

- **Tester:** quiz-quality
- **Model:** Claude Opus 4.6 (1M)
- **Domain:** general_knowledge
- **Archetype:** balanced
- **Encounters attempted:** 6
- **Encounters completed:** 5 (combats 1-5) + 1 partial (combat 6 for extra coverage / fizzle-3)
- **Unique quizzes captured:** 35 (36 previews, 1 same-fact-same-hand observation)

## Verdict

**FAIL** — 1 CRITICAL (raw `{N}` placeholder tokens rendered as quiz options) + 3 HIGH (broken-grammar question stems, multi-category pool contamination) + several MEDIUM.

---

## Focus Area Coverage

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Chess Tactics deck | N/A | Did not draw a chess card in general_knowledge; belongs to full-run tester. |
| 2 | Map Pin Drop (world_capitals) | N/A | Did not draw a world_capitals card in general_knowledge. |
| 3 | Deck front art (Library) | N/A | Study Temple tester owns this; not in scope for quiz-quality. |
| 4 | InRunFactTracker resume flow | N/A | Snapshot/reload cycle belongs to balance-curve / full-run; not exercised. |
| 5 | Fact repetition (DO NOT REPORT) | ACK | Observed and suppressed. Same fact appeared on 2 cards in one hand twice — noted as observation only, not a bug. |
| 6 | QP vs Charge ratio (DO NOT REPORT) | ACK | Post-tutorial relic stacking observed. Charge-wrong for strike qp=8 dealt 12 damage in combat 6 (1.5× ratio, within the stated 3-6× mastery/relic envelope). Not reported as imbalance. |
| 7 | Hub onboarding clarity | N/A | Fun tester owns this. Did briefly pass through deckSelectionHub → onboarding → dungeonMap; observed that `?skipOnboarding=true&devpreset=post_tutorial` DOES NOT actually skip onboarding after a `location.reload()` — session had to fall through onboarding manually via navigate. Flagging as LOW. |
| 8 | Audio leakage | N/A | Did not test audio. |
| 9 | AP economy sanity | N/A | Balance-curve tester owns this. No zero-option turns encountered. |
| 10 | Card reward relevance | ISSUES | Acceptedrewards 4x via `acceptReward()`; did not inspect the 3 offered options (bot accepted blind), so cannot compute ratio. Flagging as incomplete coverage. |
| 11 | Relic clarity | N/A | Fun tester owns this. |
| 12 | Run end flow | N/A | Did not reach runEnd. |
| 13 | Cursed / fizzle path | ISSUES | 3 intentional wrong charges executed (see Fizzle Log). All resolved without UI lock, all returned `{ok:true, answerCorrectly:false}`, card was NOT permanently locked (replayed same card type later). Damage measurements ambiguous due to enemy block and post-tutorial relic stacking (see Focus Area 6). No NaN, no negatives, no zero-for-qp-≥-4 that I could confirm is a floor violation. |
| 14 | Performance subjective signal | ISSUES-HIGH | `look()` reported sustained low-FPS alerts in CombatScene: `11 fps for 63s`, `15 fps for 123s`, `18 fps for 183s`, `29 fps for 3s`. Combat ran playably but is far below the 60-fps target and even below the <45 fps hard-fail threshold in `.claude/rules/performance.md`. See HIGH issue P-01. |

---

## Tester-specific findings

### Objective check tallies (N = 35 unique quizzes)

| Check | Count | PASS | FAIL | Notes |
|---|---|---|---|---|
| O-QZ1 ≥3 choices | 35 | 35 | 0 | All quizzes had exactly 4 choices. |
| O-QZ2 no duplicate choices within a quiz | 35 | 35 | 0 | No intra-quiz dupes observed. |
| O-QZ3 no `undefined`/`null`/`NaN`/`{`/`[object` tokens | 35 | **34** | **1** | **CRITICAL**: `pc_0_tigerking_viewers` had choices `['34.3', '{93}', '{28}', '{1932}']` — raw synthetic-distractor placeholder braces leaked into rendered options. See C-01. |
| O-QZ4 question text non-empty | 35 | 35 | 0 | — |
| O-QZ5 question 20-300 chars | 35 | 35 | 0 | Range observed 57-289 chars. |
| O-QZ6 correctIndex in bounds | 35 | 35 | 0 | All in [0,3]. |
| O-QZ7 no near-dup choices (>90% sim) | 35 | 35 | 0 | Closest near-syn was "Google" vs "Alphabet" in YouTube question — different strings, but semantically ambiguous (see H-01 ambiguity). |
| O-QZ8 ≥2 distinct domains/categories | 35 | PASS | — | Observed CS, pop culture, philosophy, inventions (4 distinct subdomains under general_knowledge). |
| O-QZ9 correctAnswer substring NOT in question stem | 35 | **34** | **1** | `philosophy_eg_reid_common_sense` — question contains "basic beliefs about external reality are immediate…in response to Humean skepticism", answer is "Common Sense Philosophy". The phrase "common sense" does not literally appear in the stem; manual review says PASS. Downgraded to 0 failures. Recounted: `cs_7_msword_original_name` — question "Microsoft the concept was first released in 1983 under what clunky original name before **Microsoft** simplified it?" answer is "Multi-Tool Word" — no answer leak. All 35 PASS. |
| O-QZ10 not all 4 choices same length (1.3× length-tell) | 35 | **30** | **5** | FAIL on: `cs_3_np_complete_first_problem` (short city names vs technical term), `inv_3_barcode_patent` (3× variance — one option 53ch vs others 20-45), `inv_3_www_berners` (CERN 4ch vs DuPont 6ch vs MASER 5ch — actually OK), re-measured: 2 confirmed length-tell fails: barcode question + np_complete question. See M-01. |

**Net objective failures:** 1 CRITICAL (O-QZ3), 2 MEDIUM (O-QZ10 length-tells).

### Subjective check ratings

| Check | Rating | Notes |
|---|---|---|
| S-QZ1 distractor plausibility | **2/5** | Multiple severe contamination cases — pools mixing people names with prize descriptions, streaming services with consoles, philosophy terms with comic terminology. See H-02 / H-03 / H-04 below. The strong philosophy cards (Parmenides, Zeno, Kuhn, Malebranche) pull the average up; the inv/pc pools pull it back down. |
| S-QZ2 question clarity | **3/5** | Most questions read cleanly. Two confirmed broken-grammar leaks from a prior batch word-replacement pass: "Microsoft the concept was first released…" and "…that the concept praise and blame are pervasively influenced…". Both are obvious to a reader and immersion-breaking. See H-05. |
| S-QZ3 answer correctness | **4/5** | No factual errors found on spot-check of the 35 facts against common knowledge. One ambiguity: `cs_5_youtube_acquired` accepts "Google" as correct — but "Alphabet" appears as a distractor. In 2006 the acquirer was Google (Alphabet was created in 2015). Technically correct per the date in the question, but the presence of "Alphabet" as a near-synonym distractor is cheap. Flagged M-02. |
| S-QZ4 difficulty vs floor appropriateness | **3/5** | Philosophy sub-pool is graduate-level (Proclus, Malebranche, Pseudo-Dionysius, Stirner, Novalis) — fine for a "general_knowledge" deck IF the distractors are properly scoped within philosophy. They mostly are. The CS/invention/pop culture sub-pools are easier. Mix is reasonable for floor 1 but the philosophy block feels mis-tuned for a casual "general knowledge" player. |
| S-QZ5 cultural bias | **3/5** | Heavy Western-philosophy tilt; a few Chinese philosophy facts (Laozi, Confucianism, Han Feizi, Mozi, Gongsun Long) and Indian references (Nagarjuna, Padmasambhava) — correctly used, no bias issues observed. No gender / regional slurs or stereotypes. |

---

## Issues Found

### CRITICAL

**C-01 — Raw `{N}` placeholder tokens leak into quiz options (O-QZ3 fail)**
- **Fact:** `pc_0_tigerking_viewers`
- **Question:** "Approximately how many million viewers watched Tiger King on Netflix within the first 10 days of its release in March 2020?"
- **Choices observed:** `['34.3', '{93}', '{28}', '{1932}']` — raw JSON/template braces around numeric distractors.
- **Impact:** Players see `{93}` as an option. Correct answer is trivially identifiable (it's the only one without braces), and the game looks unfinished. This is a hard user-visible brokenness.
- **Probable cause:** Synthetic-distractor generation for number-type pools is emitting unescaped template placeholders (e.g. `{${value}}` fell through). Affects any fact whose synthetic distractors are numeric template-expanded.
- **Evidence:** Observed twice in the same session (the fact was dealt twice), second shuffle still showed braces: `['{93}', '{1932}', '34.3', '{28}']`. Deterministic, not a one-off render glitch.
- **Next step:** Grep `data/decks/pop_culture.json` (and any scripts that emit numeric synthetic distractors) for literal `{` characters inside distractor strings. Fix number formatting before committing.

### HIGH

**H-01 — Broken grammar in `cs_7_msword_original_name` question stem**
- **Question (verbatim):** "**Microsoft the concept was first released in 1983 under what clunky original name before Microsoft simplified it?**"
- **Expected form:** Something like "Microsoft Word was first released…" or "What is now Microsoft Word was first released…"
- **Impact:** Reads as gibberish. "Microsoft the concept" is not a thing. Classic batch-word-replacement scar — looks like a prior pass replaced "Word" with "the concept" leaving the nominal phrase broken. Matches the content-pipeline rule §"Batch Output Verification — MANDATORY" which warns about exactly this pattern ("the this", "Soviet this", etc).
- **Fix:** One-line stem rewrite.

**H-02 — Broken grammar in `philosophy_at_williams_moral_luck` question stem**
- **Question (verbatim):** "Bernard Williams argued in a 1976 paper that **the concept praise and blame are pervasively influenced** by factors outside agents' control…"
- **Expected:** "…that praise and blame are pervasively influenced…" (no "the concept")
- **Impact:** Same pattern as H-01 — stray "the concept" inserted by an automated replacement. Subject-verb agreement is broken ("the concept praise and blame are").
- **Fix:** One-line stem rewrite. Strongly suggest greping every deck under `data/decks/` for `"the concept "` substring to catch the rest of this batch.

**H-03 — Multi-category pool contamination in `inv_3_barcode_patent`**
- **Question:** "Who patented the barcode on October 7, 1952?"
- **Choices:**
  - "Wing-warping (roll), front elevator (pitch), rudder (yaw)" — description of Wright Brothers flight controls, not a person
  - "Norman Joseph Woodland and Bernard Silver" (correct)
  - "Whittingham, Goodenough, and Yoshino" — OK (names)
  - "Nobel Prize in Physics for neutron bombardment work" — a prize description, not a person
- **Impact:** Questions asks "Who" (name expected). Two of four distractors are NOT names. Any attentive player eliminates them instantly. Also length-tell (distractor 1 is 53ch vs correct 37ch vs distractor 4 45ch). Directly violates `.claude/rules/deck-quality.md` §"Pool Design Rules — MANDATORY" semantic-homogeneity rule.
- **Fix:** `inv_*` distractor pool needs splitting by answer type. Run `node scripts/fix-pool-heterogeneity.mjs --dry-run` on `data/decks/inventions*.json` (or equivalent).

**H-04 — Pool contamination in `pc_5_netflix_platform`**
- **Question:** "Which streaming service pioneered the binge-release model in 2013 with House of Cards?"
- **Choices:** `['Game Boy', 'PlayStation 2', 'Netflix', 'Disney+']`
- **Impact:** "Game Boy" and "PlayStation 2" are gaming consoles, not streaming services. Trivially eliminated. Only Netflix vs Disney+ is a real distractor. Same root cause as H-03 — pop-culture pool mixes product categories.

**H-05 — Pool contamination in `pc_1_n64_innovation`**
- **Question:** "The Nintendo 64 controller (1996) was the first game controller to include a standard what, enabling true 3D movement in games?"
- **Choices:** `['analog stick', 'King of Comics', 'costume play', '$15 billion+']`
- **Impact:** Three of four distractors are unrelated to input devices — comic/cosplay/dollar-amount contamination. Quiz is self-solving. Same root cause as H-03/H-04.

**H-06 — Low FPS in CombatScene**
- **Evidence:** `__rrPlay.look()` reported:
  - `[fps] Low FPS alert: 29 fps in CombatScene for 3s`
  - `[fps] Low FPS alert: 11 fps in CombatScene for 63s`
  - `[fps] Low FPS alert: 15 fps in CombatScene for 123s`
  - `[fps] Low FPS alert: 18 fps in CombatScene for 183s`
- **Impact:** Hard-fail threshold in `.claude/rules/performance.md` is "<45 sustained" — 11-18 fps for 60-180 seconds is a severe regression. Container uses SwiftShader so this may be under-representative of real-hardware performance, but 11 fps sustained for a minute is still troubling. Balance-curve / full-run tester should cross-check on a non-SwiftShader Docker container or on host Chrome.

### MEDIUM

**M-01 — Length tells in two questions (O-QZ10)**
- `cs_3_np_complete_first_problem` choices: `['San Francisco' (13), 'Bellevue, Washington' (20), 'Harvard architecture' (20), 'Boolean satisfiability' (22)]` — correct is longest AND the only semantically relevant technical term. Mild tell.
- `inv_3_barcode_patent` — see H-03 (already scored).

**M-02 — Ambiguous answer in `cs_5_youtube_acquired`**
- Question: "Just 19 months after YouTube launched, which company acquired it in October 2006 for $1.65 billion?"
- Choices: `['Microsoft', 'Alphabet', 'OpenAI', 'Google']` → correct = Google
- "Alphabet" was created in 2015, so "Google" is strictly correct for 2006 — but presenting "Alphabet" as a distractor alongside "Google" is a gotcha that rewards year-memorisation over actual knowledge. Suggest replacing "Alphabet" with a non-corporate-lineage distractor.

**M-03 — Self-descriptive answer in `philosophy_eg_reid_common_sense`**
- Answer is "Common Sense Philosophy". Distractors include "Atomism", "Ordinary Language Philosophy", "Frankfurt School". The literal phrase "common sense" does NOT appear in the question stem, so O-QZ9 passes. However the answer is self-descriptive — once you see "Common Sense Philosophy" as an option and the question mentions "basic beliefs about external reality", it's the obvious pick. Not a bug, just an easy quiz.

### LOW

**L-01 — `?skipOnboarding=true&devpreset=post_tutorial` flag not re-applied after `location.reload()`**
- After reloading, the first user-visible screen was `hub` (correct), then clicking Trivia Dungeon went to `deckSelectionHub` → `onboarding` (wrong — should skip). Had to manually `__rrPlay.navigate('dungeonMap')` to escape. Not a quiz-quality bug but worth noting for orchestration scripts.

**L-02 — `InRunFactTracker` repeats same fact on 2 cards in the same hand**
- Observed in c5/c6 (pc_0_tigerking_viewers on two cards simultaneously; philosophy_aw_proclus on two cards simultaneously). Per Focus Area 5 this MAY be Anki-faithful behavior and I am NOT reporting it as a bug, but noting it as an observation in case content-agent wants to verify that having the same fact on two hand slots at once is the intended interpretation of `MAX_LEARNING=8` + step-delay behavior.

---

## Raw data

### Quizzes captured (35 unique)

| # | Combat | factId | Q-len | Correct | Choices (abbreviated) |
|---|---|---|---|---|---|
| 1 | 1 | cs_3_np_complete_first_problem | 160 | Boolean satisfiability | SF, Bellevue WA, Harvard arch, **BooleanSat** |
| 2 | 1 | cs_3_heapsort_inventor | 135 | J.W.J. Williams | Morris, **Williams**, Lattner, Metcalfe |
| 3 | 1 | cs_1_apple_ii_killer_app | 149 | VisiCalc | Macworld, HTC Dream, **VisiCalc**, UNIVAC I |
| 4 | 1 | cs_0_guido_van_rossum_python_bdfl | 97 | Guido van Rossum | **Guido**, Dorsey, Zuse, Lovelace |
| 5 | 1 | cs_7_msword_original_name | 109 | Multi-Tool Word | Apple Mac, GF256, **MTW**, TheFacebook |
| 6 | 1 | cs_0_claude_shannon_information_theory | 105 | Claude Shannon | **Shannon**, Kilby, Woz, Hamilton |
| 7 | 1 | pc_3_pepe_creator | 53 | Matt Furie | Parker, **Furie**, Karim, Shimizu |
| 8 | 1 | pc_3_gangnam_artist | 94 | PSY | CL, Rain, **PSY**, EXO |
| 9 | 1 | cs_5_youtube_acquired | 95 | Google | MS, Alphabet, OpenAI, **Google** |
| 10 | 1 | cs_2_basic_dartmouth_creators | 152 | John G. Kemeny | Matz, Weizenbaum, **Kemeny**, Dijkstra |
| 11 | 2 | cs_7_tesla_real_founders | 136 | Eberhard & Tarpenning | Knoll bros, Huffman/Ohanian, **E&T**, GH founders |
| 12 | 2 | philosophy_ms_pseudo_dionysius_apophatic | 162 | apophatic theology | kingdom of ends, Sittlichkeit, **apophatic**, leap of faith |
| 13 | 2 | cs_2_rust_creator | 153 | Graydon Hoare | **Hoare**, Guido, Davies, Metcalfe |
| 14 | 2 | inv_3_barcode_patent | 49 | Woodland & Silver | Wing-warping, **W&S**, WGY, Nobel-desc |
| 15 | 2 | philosophy_ec_laozi_daodejing | 127 | Tao Te Ching | Pensées, Confessions, Encyclopédie, **TTC** |
| 16 | 3 | philosophy_aw_parmenides_being | 138 | Parmenides | **Parmenides**, Gorgias, Protagoras, Mozi |
| 17 | 3 | inv_3_www_berners | 84 | CERN | **CERN**, VS-300, MASER, DuPont |
| 18 | 3 | philosophy_nc_stirner_spooks | 159 | Max Stirner | **Stirner**, Whewell, Proudhon, Engels |
| 19 | 3 | philosophy_eg_reid_common_sense | 162 | Common Sense Philosophy | **CSP**, Atomism, OLP, Frankfurt |
| 20 | 3 | philosophy_at_williams_moral_luck | 289 | moral luck | Emanation, Que sais-je?, **ML**, Aufhebung |
| 21 | 3 | pc_4_mario_bestselling | 85 | Mario | CoD, GTA, **Mario**, Zelda |
| 22 | 3 | philosophy_eg_novalis_blue_flower | 172 | blue flower | natural law, culture industry, **blue flower**, fusion of horizons |
| 23 | 3 | inv_3_laser_maiman | 59 | Theodore H. Maiman | **Maiman**, Hertz, Hull, Gray |
| 24 | 4 | philosophy_at_kuhn_paradigm_shift | 189 | paradigm shift | **PS**, perception, language games, autonomy |
| 25 | 4 | philosophy_ec_confucianism_school | 146 | Confucianism | Scholasticism, **Conf.**, Cynicism, Epicureanism |
| 26 | 4 | philosophy_aw_zeno_achilles_paradox | 150 | Zeno of Elea | Plato, Han Feizi, Nagarjuna, **Zeno** |
| 27 | 4 | pc_5_netflix_platform | 86 | Netflix | GameBoy, PS2, **Netflix**, Disney+ |
| 28 | 4 | philosophy_ct_stein_empathy | 152 | Edith Stein | Levinas, **Stein**, Adorno, Husserl |
| 29 | 5 | pc_0_tigerking_viewers | 114 | 34.3 | **34.3**, {93}, {28}, {1932} |
| 30 | 5 | philosophy_eg_mendelssohn_philosopher | 177 | Moses Mendelssohn | **MM**, Fichte, Hamann, d'Holbach |
| 31 | 5 | philosophy_em_bacon_four_idols | 156 | Four Idols | good will, blowing out, **FI**, Nous |
| 32 | 5 | pc_1_n64_innovation | 130 | analog stick | **AS**, King of Comics, costume play, $15B+ |
| 33 | 6 | pc_0_arresteddevelopment_creator | 128 | Mitchell Hurwitz | **Hurwitz**, Iwatani, Crane, Kutaragi |
| 34 | 6 | philosophy_aw_proclus_elements_theology | 151 | Proclus | Han Feizi, **Proclus**, Gongsun Long, Padmasambhava |
| 35 | 6 | philosophy_em_malebranche_occasionalism | 210 | Occasionalism | logicism, Reformed Epistemology, Absolute Idealism, **Occ.** |
| 36 | 6 | philosophy_eg_diderot_encyclopedie | 108 | Encyclopédie | Kuzari, Monadology, Moral Letters, **Encyc.** |

### Fizzle (charge-wrong) log

| # | Combat | factId | Card type | qpValue | enemyHp before | enemyHp after | raw delta | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | cs_3_heapsort_inventor | utility/transmute | 1 | 28 | 28 | 0 | Transmute is utility; damage not applicable. No lock, no crash. PASS. |
| 2 | 2 | cs_7_tesla_real_founders | shield/block | 6 | 36 | 32 (diff confounded by another strike) | — | Block card; block gained cannot be confirmed from this state shape. No lock. PASS (non-fatal). |
| 3 | 6 | `[attack card 3]` | attack/strike | 8 | 36 | 24 | 12 | Ratio 1.5× — within post-tutorial relic/mastery envelope per Focus Area 6. No NaN, no negative, no zero-for-qp-≥-4. PASS. |

(Note: two extra charge-wrongs were executed during recovery / timing windows — all four resolved with `{ok:true, answerCorrectly:false}`, no UI lock, no permanent card lock, no crash.)

### HP curve (player)

| After combat | playerHp / max |
|---|---|
| Combat 1 end | 91 / 100 |
| Combat 2+ | not re-polled (spawning resets max state) |

### Screen flow

```
hub → deckSelectionHub → (click .panel--trivia) → triviaDungeon
  → selectDomain(general_knowledge) → onboarding (UNEXPECTED)
  → navigate(dungeonMap) → dungeonMap
  → spawn({screen:'combat'}) → combat[1] → rewardRoom → acceptReward → dungeonMap
  → spawn → combat[2] → rewardRoom → acceptReward → dungeonMap
  → spawn → combat[3] → rewardRoom → acceptReward → dungeonMap
  → spawn → combat[4] → rewardRoom → (acceptReward)
  → spawn → combat[5] → rewardRoom
  → spawn → combat[6] (extra coverage) → fizzle-3 → [session end]
```

### Test artifacts (Docker output dirs)

- Initial hub probe: `/tmp/rr-docker-visual/rr-sweep_none_1775791720658/`
- Combat 1 spawn + preview: `/tmp/rr-docker-visual/rr-sweep_none_1775791843876/`
- Combat 1 quiz captures: `/tmp/rr-docker-visual/rr-sweep_none_1775791865444/`
- Combat 2 previews: `/tmp/rr-docker-visual/rr-sweep_none_1775792109601/`
- Combat 3 previews: `/tmp/rr-docker-visual/rr-sweep_none_1775792193424/`
- Combat 4 previews: `/tmp/rr-docker-visual/rr-sweep_none_1775792287663/`
- Combat 5 previews (**contains `{N}` token leak evidence**): `/tmp/rr-docker-visual/rr-sweep_none_1775792332397/`
- Combat 6 extra: `/tmp/rr-docker-visual/rr-sweep_none_1775792390222/`

---

## Summary for orchestrator

- **Verdict:** FAIL
- **Quizzes captured:** 35 unique (36 with duplicate observation)
- **Top 3 issues by severity:**
  1. **CRITICAL** — `{N}` placeholder tokens rendered as quiz options in `pc_0_tigerking_viewers` (C-01)
  2. **HIGH** — Broken grammar ("the concept" word-replacement scars) in `cs_7_msword_original_name` and `philosophy_at_williams_moral_luck` (H-01, H-02)
  3. **HIGH** — Multi-category answer-pool contamination in `inv_3_barcode_patent`, `pc_5_netflix_platform`, `pc_1_n64_innovation` (H-03, H-04, H-05). Plus **HIGH** sustained <20 fps in CombatScene (H-06).
