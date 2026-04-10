# Recall Rogue — Curated Deck Quiz Audit

**Date:** 2026-04-10
**Scope:** 98 curated decks, ~10,212 rendered quiz instances
**Status:** DIAGNOSTIC — NO FIXES APPLIED
**Audit harness:** `scripts/audit-dump-samples.ts`

---

## No fixes were made during this audit

Every finding is a description of a problem, not a change. Decks, templates, pool definitions, and engine code are all untouched. The user decides what to fix and in what order. This file is a read-only snapshot.

---

## Headline numbers

- 98 decks audited (97 curated + 1 pilot: `test_world_capitals`)
- 30 facts sampled per deck (60 for decks with 500+ facts), stratified across answer pools
- 3 mastery levels per fact (0, 2, 4) — distractor counts 2/3/4 — option counts 3/4/5
- 10,212 rendered quiz instances
- **115 BLOCKER, 256 MAJOR, 210 MINOR, 67 NIT** = 648 flagged issues
- 50 of 98 decks have at least 1 BLOCKER
- 4 decks are completely clean (zero issues): `french_a1_grammar`, `greek_mythology`, `periodic_table`, `spanish_b2_grammar`

---

## Methodology

The audit harness (`scripts/audit-dump-samples.ts`) imports real engine primitives — `renderQuizItem()`, `selectDistractors()`, `applyTemplate()` — and exercises them at three mastery levels (0, 2, 4) to produce rendered quiz instances showing the question stem, correct answer, and all distractor options. This means the audit reflects the actual in-game player experience, not just the raw deck JSON.

For each deck, an **expectations file** was written before reading any findings, establishing what issue types were predicted given the deck's pool architecture. Findings were then compared against expectations to identify surprises. This ordering prevents confirmation bias — reviewers could not retroactively adjust expectations to match what they found.

Facts were sampled stratified across answer pools: each pool contributes a proportional share of the 30-or-60 fact sample, ensuring no pool is oversampled or missed. Image-quiz, chess-move, and map-pin facts render as passthrough (single-option arrays) and are excluded from eliminability analysis; their structural issues are flagged from JSON.

Issue severity was assigned per the taxonomy in Appendix B: BLOCKER for broken rendering or confirmed factual errors, MAJOR for trivially eliminable distractors or strong factual suspicion, MINOR for weak-but-functional distractors or mild tells, NIT for stylistic concerns only.

Each deck entry in this report links to two files: a per-deck findings file with full rendered examples and detailed issue descriptions, and a per-deck expectations file for comparison.

---

## Limitations

- No independent fact verification was performed. FACTUAL-SUSPECT flags indicate high-confidence errors (e.g., Reagan/USSR date is a confirmed error) but are not verified against primary sources for every case.
- The 30-fact sample covers 20–40% of facts per deck. Issues in unsampled facts may exist but are not reported here.
- Image-quiz, chess-move, and map-pin quiz modes render as passthrough in the dump (single-option arrays). Distractor quality cannot be assessed for these modes; only structural JSON issues are reported.
- Distractor shuffle is seeded deterministically in the audit dump for reproducibility. In-game shuffle is non-deterministic; some tell patterns may appear more or less often in actual play than the dump suggests.
- FSRS tier effects (retrievability weights on distractor selection) were not separately swept. All entries use the base distractor algorithm without retrieval weighting.
- Deck sizes reported as file sizes (bytes) from the scoreboard; per-deck findings files contain actual fact counts.

---

## The 20 worst decks (by severity score)

Score = BLOCKER×10 + MAJOR×3 + MINOR×1

| Rank | Deck | Score | BLOCKER | MAJOR | MINOR | NIT |
|------|------|------:|--------:|------:|------:|----:|
| 1 | [spanish_c1](../data/audits/findings/spanish_c1.md) | 61 | 5 | 3 | 2 | 0 |
| 2 | [chinese_hsk6](../data/audits/findings/chinese_hsk6.md) | 58 | 5 | 2 | 2 | 1 |
| 3 | [dutch_a2](../data/audits/findings/dutch_a2.md) | 58 | 5 | 2 | 2 | 1 |
| 4 | [dutch_b2](../data/audits/findings/dutch_b2.md) | 58 | 5 | 2 | 2 | 1 |
| 5 | [dutch_a1](../data/audits/findings/dutch_a1.md) | 57 | 5 | 2 | 1 | 1 |
| 6 | [ap_macroeconomics](../data/audits/findings/ap_macroeconomics.md) | 54 | 4 | 4 | 2 | 1 |
| 7 | [spanish_a1](../data/audits/findings/spanish_a1.md) | 51 | 4 | 3 | 2 | 1 |
| 8 | [spanish_b1](../data/audits/findings/spanish_b1.md) | 51 | 4 | 3 | 2 | 1 |
| 9 | [czech_b2](../data/audits/findings/czech_b2.md) | 48 | 4 | 2 | 2 | 1 |
| 10 | [dutch_b1](../data/audits/findings/dutch_b1.md) | 48 | 4 | 2 | 2 | 1 |
| 11 | [human_anatomy](../data/audits/findings/human_anatomy.md) | 48 | 2 | 8 | 4 | 2 |
| 12 | [chinese_hsk1](../data/audits/findings/chinese_hsk1.md) | 47 | 4 | 2 | 1 | 1 |
| 13 | [chinese_hsk4](../data/audits/findings/chinese_hsk4.md) | 44 | 4 | 1 | 1 | 1 |
| 14 | [egyptian_mythology](../data/audits/findings/egyptian_mythology.md) | 40 | 4 | 0 | 0 | 0 |
| 15 | [chinese_hsk5](../data/audits/findings/chinese_hsk5.md) | 38 | 3 | 2 | 2 | 1 |
| 16 | [spanish_c2](../data/audits/findings/spanish_c2.md) | 38 | 3 | 2 | 2 | 1 |
| 17 | [japanese_n1](../data/audits/findings/japanese_n1.md) | 37 | 3 | 2 | 1 | 0 |
| 18 | [czech_b1](../data/audits/findings/czech_b1.md) | 34 | 2 | 4 | 2 | 1 |
| 19 | [chess_tactics](../data/audits/findings/chess_tactics.md) | 33 | 3 | 1 | 0 | 0 |
| 20 | [ap_biology](../data/audits/findings/ap_biology.md) | 32 | 2 | 3 | 3 | 1 |

**Notes on the top 20:**

**spanish_c1 (rank 1):** Three confirmed factual errors from a pipeline row-alignment bug — `donde` mapped to "because", `habitual` mapped to "beans", `sino` POS mis-tagged. These are wrong answers that will teach players incorrect Spanish. LENGTH-TELL dominates the rest of the deck (58 of 74 flagged items).

**chinese_hsk6 (rank 2):** 371 facts (14% of deck) have explanation text describing a different sense than the `correctAnswer` — the CC-CEDICT source data was misaligned. Additionally the `reading_pinyin` template delivers English meanings instead of pinyin, making it functionally broken across all HSK decks.

**dutch_a1/a2/b1/b2 (ranks 3-5, 10):** All four Dutch decks share the same systemic SELF-ANSWERING defect: Dutch-English cognates (school=school, best=best, festival=festival) are tested as vocabulary items but are identical in both languages, making every quiz rendering of these facts a giveaway. Dutch B2 is critically undersized at 71 facts.

**ap_macroeconomics (rank 6):** Four "this" placeholder artifacts from a batch rewrite that left unresolved template substitutions — "Irving This", "bank this", "Federal this", "capital this" — rendering ungrammatical questions across all three mastery levels.

**human_anatomy (rank 11):** Despite only 2 BLOCKERs, the deck has 8 MAJORs and 4 MINORs. The dominant issue is 50+ question stems containing the literal placeholder string "anatomical structure" where a specific anatomical name was never substituted during generation.

**egyptian_mythology (rank 14):** Pure BLOCKER count — 4 facts with unresolved "this" pronoun placeholders, zero other issues. High severity score from blockers alone.

**chess_tactics (rank 19):** 3 BLOCKERs: 2 facts with corrupt `solutionMoves[0]` referencing empty squares, and 1 `tacticTheme` misclassification. The player-facing answers are valid; the setup-move record is not.

**ap_biology (rank 20):** The Darwin 1859 fact self-answers by quoting the year in the stem while asking for a year. The logistic growth equation fact quotes the equation verbatim in the stem. Both are trivially solvable without knowledge.

---

## The cleanest decks (zero score)

| Deck | BLOCKER | MAJOR | MINOR | NIT | Why it succeeded |
|------|--------:|------:|------:|----:|-----------------|
| [french_a1_grammar](../data/audits/findings/french_a1_grammar.md) | 0 | 0 | 0 | 2 | Verb-paradigm pools: all options are conjugated forms of the same verb, eliminating POS-tell entirely. Length homogeneity excellent (4–10 chars). Two NITs only. |
| [greek_mythology](../data/audits/findings/greek_mythology.md) | 0 | 0 | 0 | 3 | Small, curated deck with semantically coherent pools. Name pools are deity-names only; no pool mixes mythological categories. Three NITs only. |
| [periodic_table](../data/audits/findings/periodic_table.md) | 0 | 0 | 0 | 0 | Uniquely constrained domain: element names, symbols, and atomic numbers are unambiguous, non-overlapping, and length-homogeneous by nature. The only fully clean deck. |
| [spanish_b2_grammar](../data/audits/findings/spanish_b2_grammar.md) | 0 | 0 | 0 | 0 | 25 fine-grained pools (176 facts), 10 synthetic distractors per pool, consistent fill-in-blank template. The reference model for grammar deck design. |

---

## Cross-deck patterns

### Pattern 1 — "this" placeholder artifacts from a shared batch rewrite

A batch question-rewrite pass left unresolved "this" tokens in question stems, creating ungrammatical and unintelligible questions. The token appears where a specific noun (an economic concept, a god name, a technological term) should have been substituted. At BLOCKER severity when the "this" occupies a grammatical position that makes the question incoherent; questions like "What this measures" or "Federal this" cannot be answered by any player regardless of knowledge.

Affected decks: `music_history` (10+ facts), `movies_cinema` (3 facts), `famous_paintings` (1 fact), `famous_inventions` (1 fact), `medieval_world` (1 fact), `ap_macroeconomics` (5 facts — 4 BLOCKERs, 1 MAJOR), `egyptian_mythology` (4 facts), `pharmacology` (2 facts).

Total affected: approximately 27 facts corpus-wide, all from the same batch rewrite operation on 2026-03-xx.

### Pattern 2 — Mega-pool POOL-CONTAM (catch-all distractor pools)

Large single pools spanning whole subject domains allow distractors to cross topic boundaries. A student who knows their subject area can eliminate options from the wrong era, wrong category, or wrong scale without knowing the specific answer — a test of recognition rather than knowledge.

The worst offenders have pools with 80–297 facts all competing as distractors for each other:

- `ap_world_history`: `concept_terms` pool (297 facts, 48% of deck) — distractors span 800 years and every world region. "Final Solution (Nazi genocide plan)" appears as a distractor for a medieval India question.
- `ap_us_history`: `concept_terms` pool (142 facts) — "Strategic Defense Initiative" (Reagan era) alongside "Headright system" (colonial era).
- `ap_biology`: `term_definitions_long` (214 facts) — cross-unit distractor contamination across all 9 AP Bio units.
- `ancient_greece`: `historical_phrases_long` (87 facts, EXEMPT) — "Scientific history", "Died in prison from gangrene", "The Macedonian phalanx" as co-distractors for a Battle-of-Salamis fact.
- `ancient_rome`: `historical_phrases` (80 facts, EXEMPT).
- `world_war_ii`: `historical_events` (167 facts).
- `movies_cinema`: `film_trivia` (6 semantically incompatible answer types).
- `world_literature`: `publication_years` pool — line counts, structural counts, a calendar date, and years as co-distractors.

Also affected: `ap_chemistry`, `ap_physics_1`, `ap_psychology`, `ap_european_history`, `ap_macroeconomics`, `ap_microeconomics`, `ap_human_geography`, `world_cuisines` (`technique_terms_short`), `world_wonders`, `music_history` (`description_terms`).

### Pattern 3 — Reverse-template POOL-CONTAM drawing wrong-script distractors

Reverse-direction quiz templates ("How do you say X in [target language]?") draw distractors from the English-meanings pool instead of the target-language pool. The correct answer is identifiable by script alone — a student need only find the option that looks different from the others to answer correctly with zero language knowledge.

This is a single engine-level bug in distractor pool selection for reverse templates. One fix would resolve BLOCKER status across approximately 20 decks simultaneously.

Affected: `chinese_hsk1`, `chinese_hsk2`, `chinese_hsk3`, `chinese_hsk4`, `chinese_hsk5`, `chinese_hsk6` (all via `reverse` template), `japanese_n5`, `japanese_n4`, `japanese_n3`, `japanese_n2`, `japanese_n1` (all via `reverse` template), `japanese_hiragana`, `japanese_katakana`, `korean_hangul` (pool mixing both scripts), `korean_topik1`, `korean_topik2` (reverse template, 100% contamination), `spanish_a1`, `spanish_a2`, `spanish_b1`, `spanish_b2`, `spanish_c1`, `spanish_c2`, `german_a1`, `german_a2`, `german_b1`.

### Pattern 4 — definition_match template SELF-ANSWERING via explanation field

At mastery=4, the `definition_match` template renders the fact's `explanation` field as the question stem. When explanation text is sourced from Wiktionary or similar references, it typically contains the target word in context — e.g., "school — a place for learning; in Dutch, school". The correct answer ("school") appears verbatim in the question stem, making the fact trivially self-answering.

The hit rate ranges from 13% to 37% of sampled facts depending on the deck and the proportion of cognates or loanwords.

Affected: `french_a1` (some mastery=4 entries), `french_a2` (9 of 30 sampled — ~30%), `french_b1` (17 of 180 sampled), `german_a1` (15 of 180 sampled), `german_a2` (8 of 90 sampled), `german_b1` (9 of 90 sampled), `german_b2` (5 of 90 sampled), `czech_a1` (7 of 90 sampled), `czech_a2` (11 of 90 sampled), `czech_b1` (11 of 90 sampled), `czech_b2` (14 of 180 sampled — highest raw count), `dutch_a1` (4 of 90 sampled), `dutch_a2` (7 of 90 sampled), `dutch_b1` (6 of 90 sampled), `dutch_b2` (15 of 90 sampled — 16.7% rate, highest in batch).

### Pattern 5 — LENGTH-TELL from mixed particles vs multi-morpheme answers

In grammar decks, single-character answers (particles, pronouns, prepositions) coexist in the same option set with multi-character structural answers. A player can identify the correct answer by visual length without reading the question. The worst observed ratios in grammar decks:

- `japanese_n5_grammar`: 54 of 90 rows (60%) affected — single-character particles (は, が, を) mixed with compound forms (なければなりません).
- `japanese_n4_grammar`: 32 of 90 rows (36%) — obligatory forms vs particles.
- `japanese_n3_grammar`: 35 of 87 rows (40%) — single-kanji expressions vs long compound forms (14× worst ratio).
- `french_a2_grammar`: `y_pronoun_uses` and `en_pronoun_uses` pools — single-character answer ("y" or "en") vs full French sentences as distractors. Ratio reaches 19× — worst length-tell ratio in the entire batch.
- `spanish_a1_grammar`: pronoun/article pools — 2-char forms (`su`, `mi`) vs 7–9-char forms (`nuestro`, `cualquier`).

Also affected at lower rates: `japanese_n1_grammar` (29 of 177 rows, 16%), `japanese_n2_grammar` (9 of 78 rows, 12%), `french_b1_grammar` (3 instances from `si_imparfait_patterns`).

### Pattern 6 — POS-TELL in vocabulary decks without POS-separated pools

Vocabulary decks using a single `english_meanings` pool mix verbs, nouns, and adjectives as distractors. At 3-option renders (mastery=0), cross-POS distractors are frequently eliminable — a player who knows the question word is a verb can discard two noun distractors.

This is structural to the single-pool architecture shared by all Spanish, French, German, and some Japanese vocabulary decks. Fine-grained pool splitting by POS (as done in `spanish_b2_grammar`) eliminates this pattern.

Worst rates: `spanish_a1` (13 POS-tell instances in 180 sampled items), `german_b1` (6 instances in 90 items — highest German rate at 7%), `french_b1` (7 instances in 180 items). Czech and Dutch vocabulary decks show this less often due to different pool architecture.

### Pattern 7 — Empty chainThemes on knowledge decks

The chain system cannot activate for facts in decks where `chainThemes` is empty or undefined at the deck level. Players in Study Temple mode will not see chain bonus opportunities for these decks. This is a structural metadata gap, not a quiz rendering issue, but it substantially reduces the game-mechanics depth for affected decks.

Approximately 8 of 10 mythology/philosophy/science knowledge decks have no chain themes. Also affected: all 8 geography decks (except where noted), `human_anatomy`, `medical_terminology`, `pharmacology`, `dinosaurs`, `mammals_world`. `ocean_life` (5 themes) is the exception and the reference model.

### Pattern 8 — Numeric/non-numeric pool misclassification

Numeric answers (counts, years, measurements) placed in name or object pools — or vice versa — create format-tells where the correct answer stands out by being the only numeral or the only non-numeral in the option set.

Affected cases: `norse_mythology` — Sleipnir's legs ("8") placed in `object_names` pool; `nasa_missions` — moonwalker count ("12") placed in `launch_years` pool; `famous_inventions` — dates mixed into a general pool; `dinosaurs` — geological dates in `misc_concepts_short` alongside boolean answers ("False") and geographic names; `mammals_world` — stats pools mixing kilograms, kilometers, centimeters, decibels, percentages, hours, km/h, and unitless counts; `medieval_world` — `date_named` pool mixing date-ranges, durations, and specific dates.

### Pattern 9 — Placeholder text in human_anatomy

50+ facts in `human_anatomy` have the literal string "anatomical structure" in the rendered question stem where a specific anatomical name was to be substituted during generation. These facts are broken at the source JSON level. Examples: "What is the function of the anatomical structure?" where "anatomical structure" should be "biceps femoris" or "left ventricle". Affects questions across multiple sub-decks (nervous system, cardiovascular, musculoskeletal).

### Pattern 10 — Spanish C1 confirmed factual errors

Three confirmed wrong translations in `spanish_c1` from a row-alignment error in the data pipeline. The pipeline misassigned adjacent rows, so some words received the meaning of the next word in the source file:
- `donde` → "because" (correct: "where")
- `habitual` → "beans" (correct: "habitual, usual")
- `sino` → POS mis-tagged as conjunction when used as noun in the context

Same error class also appears in `ap_us_history` and `us_presidents` with the Reagan/USSR date (see Pattern 13).

### Pattern 11 — HSK6 CC-CEDICT sense mismatch

371 of approximately 2,600 facts in `chinese_hsk6` (14%) have explanation text describing a different lexical sense than the `correctAnswer`. For 200 of these, the contradiction is strong — the explanation describes a fundamentally different concept than the answer. This is a data pipeline issue where CC-CEDICT entries with multiple senses were split incorrectly, assigning sense N's explanation to sense N-1's answer.

### Pattern 12 — Dutch B1/B2 content shortage

`dutch_b1` has 232 facts. `dutch_b2` has 71 facts. The Czech equivalents at the same CEFR level: `czech_b1` = 976 facts, `czech_b2` = 1,382 facts. Dutch B2 is 95% below the expected content volume for a B2-level vocabulary deck. The 90-item dump for Dutch B2 sampled 30 of the 71 total facts — a 42% sampling rate that is abnormally high and reflects content shortage rather than coverage.

### Pattern 13 — Reagan USSR-dissolution factual error

"Which president presided over the USSR dissolving in 1991" — answered "Ronald Reagan" — is factually wrong in two decks. Reagan left office January 20, 1989. The USSR dissolved December 25, 1991, under George H.W. Bush. This is a BLOCKER in both `us_presidents` and `ap_us_history` where it appears.

### Pattern 14 — Chess_tactics corrupt setup moves

Two facts (`chess_tac_AHPUU`, `chess_tac_KZU69`) have `solutionMoves[0]` referencing squares that are empty in the given FEN position. A piece cannot move from an empty square. The Lichess-format replay line breaks at move 0. However, `solutionMoves[1]` and `correctAnswer` are valid — the player-facing puzzle answer is correct and the tactical line is sound. The corruption is in the pre-position record only. Gameplay impact depends on whether the engine validates `solutionMoves[0]` to set up the board state before presenting the puzzle.

### Pattern 15 — Spanish grammar decks monotonically improve with CEFR level

`spanish_a1_grammar` → `spanish_a2_grammar` → `spanish_b1_grammar` → `spanish_b2_grammar` issue counts decrease monotonically. `spanish_b2_grammar` (0 flagged items) is the only grammar deck with zero issues. The B2 improvements — 25 pools for 176 facts, 10 synthetic distractors per pool, consistent fill-in-blank templates — appear to have solved every issue found in A1 grammar. B2 grammar is the explicit reference implementation for all future grammar deck construction.

---

## Top 20 most broken facts (corpus-wide)

Ranked by impact: factual errors first, then broken rendering, then systemic engine bugs manifest in a specific fact.

```
 1. es-cefr-4014 (spanish_c1) — "habitual" translated as "beans"; correct answer is "habitual, usual" — BLOCKER [FACTUAL-SUSPECT: row-alignment pipeline error]
 2. es-cefr-c1-donde (spanish_c1) — "donde" translated as "because"; correct answer is "where" — BLOCKER [FACTUAL-SUSPECT: row-alignment pipeline error]
 3. us_pres_reagan (us_presidents) — Reagan fact claims he "presided over USSR dissolving in 1991"; he left office Jan 1989 — BLOCKER [FACTUAL-SUSPECT: confirmed date error]
 4. ap_ush_reagan_1991 (ap_us_history) — Same Reagan/USSR factual error as above — BLOCKER [FACTUAL-SUSPECT]
 5. ha_nerv_120 (human_anatomy) — Question stem contains "anatomical structure" placeholder verbatim; 50+ facts in this deck share this defect — BLOCKER [TEMPLATE-MISFIT]
 6. ap_macro_2b_001 (ap_macroeconomics) — "What this measures..." rendered at all 3 mastery levels; "this" is an unresolved pronoun for CPI — BLOCKER [BROKEN-GRAMMAR]
 7. ap_macro_4b_three_fed_tools (ap_macroeconomics) — "Federal this" + SYNONYM-LEAK where options A/B are subsets of option C — BLOCKER [BROKEN-GRAMMAR + SYNONYM-LEAK]
 8. ap_macro_4a_time_deposit_cd (ap_macroeconomics) — "bank this" rendered at all 3 mastery levels; incomprehensible question — BLOCKER [BROKEN-GRAMMAR]
 9. egypt_death_osiris_myth_throne (egyptian_mythology) — "this" placeholder renders as pronoun in question stem across all 3 mastery levels — BLOCKER [BROKEN-GRAMMAR]
10. zh-hsk-6405 (chinese_hsk6) — reading_pinyin template delivers English meanings instead of pinyin; correct answer identifiable as only non-English option — BLOCKER [TEMPLATE_MISFIT]
11. chess_tac_AHPUU (chess_tactics) — solutionMoves[0] = "g6g5" where g6 is an empty square in the FEN; setup move is physically impossible — BLOCKER [CHESS-BROKEN]
12. chess_tac_KZU69 (chess_tactics) — solutionMoves[0] references empty square; same defect as above — BLOCKER [CHESS-BROKEN]
13. nl-cefr-111 (dutch_a1) — "school" (Dutch) = "school" (English); every quiz template renders this as trivially self-answering — BLOCKER [SELF-ANSWERING: perfect cognate]
14. nl-cefr-218 (dutch_a2) — "best" (Dutch) = "best" (English); identical self-answering defect across all 4 templates — BLOCKER [SELF-ANSWERING: perfect cognate]
15. ap_bio_darwin_1859 (ap_biology) — Question asks for "main contribution to biology"; correct answer is "1859" (a year stated verbatim in the question stem); type mismatch and self-answering — BLOCKER [TEMPLATE-MISFIT + SELF-ANSWERING]
16. ap_bio_u8_041 (ap_biology) — Logistic growth equation quoted verbatim in question stem; any student can match the string without population ecology knowledge — BLOCKER [SELF-ANSWERING]
17. famous_paintings_image_facts (famous_paintings) — All image_question facts render with 1 option (the correct answer, no distractors); image quiz is trivially answered corpus-wide — BLOCKER [IMAGE-BROKEN: distractor generation failure]
18. ja-jlpt-5232 (japanese_n1) — Katakana loanword SELF-ANSWERING: the romanized form appears in the question phrasing; answer identifiable without Japanese knowledge — BLOCKER [SELF-ANSWERING]
19. cs-freq-2259 (czech_b2) — Latin/Germanic loanword cognate; transparent to English speakers across all templates; unteachable as a Czech vocabulary item — BLOCKER [SELF-ANSWERING: cognate]
20. cs-freq-1354 / cs-freq-1873 (czech_b1) — "Washington" and "New York" as Czech vocabulary items; identical in Czech and English; self-answering across all templates — BLOCKER [SELF-ANSWERING: proper noun]
```

---

## Full scoreboard

All 98 decks sorted alphabetically. Each `deckId` links to its findings file.

| Deck | Sampled | BLOCKER | MAJOR | MINOR | NIT | Score |
|------|--------:|--------:|------:|------:|----:|------:|
| [ancient_greece](../data/audits/findings/ancient_greece.md) | 30 | 0 | 6 | 3 | 0 | 21 |
| [ancient_rome](../data/audits/findings/ancient_rome.md) | 30 | 0 | 3 | 6 | 0 | 15 |
| [anime_manga](../data/audits/findings/anime_manga.md) | 30 | 0 | 2 | 3 | 2 | 9 |
| [ap_biology](../data/audits/findings/ap_biology.md) | 30 | 2 | 3 | 3 | 1 | 32 |
| [ap_chemistry](../data/audits/findings/ap_chemistry.md) | 30 | 1 | 6 | 3 | 1 | 31 |
| [ap_european_history](../data/audits/findings/ap_european_history.md) | 30 | 0 | 4 | 4 | 1 | 16 |
| [ap_human_geography](../data/audits/findings/ap_human_geography.md) | 30 | 2 | 3 | 3 | 2 | 32 |
| [ap_macroeconomics](../data/audits/findings/ap_macroeconomics.md) | 30 | 4 | 4 | 2 | 1 | 54 |
| [ap_microeconomics](../data/audits/findings/ap_microeconomics.md) | 30 | 0 | 4 | 3 | 1 | 15 |
| [ap_physics_1](../data/audits/findings/ap_physics_1.md) | 30 | 0 | 3 | 4 | 1 | 13 |
| [ap_psychology](../data/audits/findings/ap_psychology.md) | 30 | 0 | 3 | 4 | 1 | 13 |
| [ap_us_history](../data/audits/findings/ap_us_history.md) | 30 | 1 | 3 | 4 | 0 | 23 |
| [ap_world_history](../data/audits/findings/ap_world_history.md) | 60 | 1 | 4 | 3 | 1 | 25 |
| [chess_tactics](../data/audits/findings/chess_tactics.md) | 30 | 3 | 1 | 0 | 0 | 33 |
| [chinese_hsk1](../data/audits/findings/chinese_hsk1.md) | 30 | 4 | 2 | 1 | 1 | 47 |
| [chinese_hsk2](../data/audits/findings/chinese_hsk2.md) | 30 | 2 | 2 | 1 | 1 | 27 |
| [chinese_hsk3](../data/audits/findings/chinese_hsk3.md) | 30 | 2 | 2 | 1 | 1 | 27 |
| [chinese_hsk4](../data/audits/findings/chinese_hsk4.md) | 30 | 4 | 1 | 1 | 1 | 44 |
| [chinese_hsk5](../data/audits/findings/chinese_hsk5.md) | 60 | 3 | 2 | 2 | 1 | 38 |
| [chinese_hsk6](../data/audits/findings/chinese_hsk6.md) | 60 | 5 | 2 | 2 | 1 | 58 |
| [computer_science](../data/audits/findings/computer_science.md) | 30 | 0 | 0 | 1 | 0 | 1 |
| [constellations](../data/audits/findings/constellations.md) | 30 | 0 | 2 | 0 | 0 | 6 |
| [czech_a1](../data/audits/findings/czech_a1.md) | 30 | 0 | 6 | 2 | 1 | 20 |
| [czech_a2](../data/audits/findings/czech_a2.md) | 30 | 0 | 3 | 3 | 1 | 12 |
| [czech_b1](../data/audits/findings/czech_b1.md) | 30 | 2 | 4 | 2 | 1 | 34 |
| [czech_b2](../data/audits/findings/czech_b2.md) | 60 | 4 | 2 | 2 | 1 | 48 |
| [dinosaurs](../data/audits/findings/dinosaurs.md) | 30 | 1 | 3 | 3 | 1 | 22 |
| [dutch_a1](../data/audits/findings/dutch_a1.md) | 30 | 5 | 2 | 1 | 1 | 57 |
| [dutch_a2](../data/audits/findings/dutch_a2.md) | 30 | 5 | 2 | 2 | 1 | 58 |
| [dutch_b1](../data/audits/findings/dutch_b1.md) | 30 | 4 | 2 | 2 | 1 | 48 |
| [dutch_b2](../data/audits/findings/dutch_b2.md) | 30 | 5 | 2 | 2 | 1 | 58 |
| [egyptian_mythology](../data/audits/findings/egyptian_mythology.md) | 30 | 4 | 0 | 0 | 0 | 40 |
| [famous_inventions](../data/audits/findings/famous_inventions.md) | 30 | 1 | 4 | 3 | 1 | 25 |
| [famous_paintings](../data/audits/findings/famous_paintings.md) | 30 | 1 | 3 | 2 | 1 | 21 |
| [fifa_world_cup](../data/audits/findings/fifa_world_cup.md) | 30 | 0 | 2 | 3 | 0 | 9 |
| [french_a1](../data/audits/findings/french_a1.md) | 30 | 1 | 4 | 2 | 0 | 24 |
| [french_a1_grammar](../data/audits/findings/french_a1_grammar.md) | 30 | 0 | 0 | 0 | 2 | 0 |
| [french_a2](../data/audits/findings/french_a2.md) | 30 | 0 | 6 | 0 | 0 | 18 |
| [french_a2_grammar](../data/audits/findings/french_a2_grammar.md) | 30 | 0 | 3 | 4 | 0 | 13 |
| [french_b1](../data/audits/findings/french_b1.md) | 60 | 0 | 6 | 2 | 0 | 20 |
| [french_b1_grammar](../data/audits/findings/french_b1_grammar.md) | 30 | 0 | 1 | 2 | 0 | 5 |
| [french_b2](../data/audits/findings/french_b2.md) | 60 | 0 | 5 | 3 | 0 | 18 |
| [french_b2_grammar](../data/audits/findings/french_b2_grammar.md) | 30 | 0 | 2 | 2 | 2 | 8 |
| [german_a1](../data/audits/findings/german_a1.md) | 60 | 0 | 6 | 3 | 0 | 21 |
| [german_a2](../data/audits/findings/german_a2.md) | 30 | 0 | 7 | 1 | 1 | 22 |
| [german_b1](../data/audits/findings/german_b1.md) | 30 | 0 | 6 | 4 | 0 | 22 |
| [german_b2](../data/audits/findings/german_b2.md) | 30 | 0 | 5 | 3 | 0 | 18 |
| [greek_mythology](../data/audits/findings/greek_mythology.md) | 30 | 0 | 0 | 0 | 3 | 0 |
| [human_anatomy](../data/audits/findings/human_anatomy.md) | 60 | 2 | 8 | 4 | 2 | 48 |
| [japanese_hiragana](../data/audits/findings/japanese_hiragana.md) | 30 | 1 | 1 | 1 | 0 | 14 |
| [japanese_katakana](../data/audits/findings/japanese_katakana.md) | 30 | 1 | 1 | 1 | 0 | 14 |
| [japanese_n1](../data/audits/findings/japanese_n1.md) | 60 | 3 | 2 | 1 | 0 | 37 |
| [japanese_n1_grammar](../data/audits/findings/japanese_n1_grammar.md) | 60 | 1 | 2 | 2 | 0 | 18 |
| [japanese_n2](../data/audits/findings/japanese_n2.md) | 60 | 1 | 2 | 1 | 0 | 17 |
| [japanese_n2_grammar](../data/audits/findings/japanese_n2_grammar.md) | 30 | 0 | 1 | 3 | 0 | 6 |
| [japanese_n3](../data/audits/findings/japanese_n3.md) | 60 | 2 | 1 | 2 | 0 | 25 |
| [japanese_n3_grammar](../data/audits/findings/japanese_n3_grammar.md) | 30 | 0 | 2 | 2 | 0 | 8 |
| [japanese_n4](../data/audits/findings/japanese_n4.md) | 60 | 2 | 2 | 1 | 0 | 27 |
| [japanese_n4_grammar](../data/audits/findings/japanese_n4_grammar.md) | 30 | 0 | 2 | 2 | 0 | 8 |
| [japanese_n5](../data/audits/findings/japanese_n5.md) | 60 | 2 | 2 | 1 | 0 | 27 |
| [japanese_n5_grammar](../data/audits/findings/japanese_n5_grammar.md) | 30 | 0 | 2 | 2 | 1 | 8 |
| [korean_hangul](../data/audits/findings/korean_hangul.md) | 30 | 1 | 1 | 2 | 0 | 15 |
| [korean_topik1](../data/audits/findings/korean_topik1.md) | 60 | 1 | 1 | 2 | 0 | 15 |
| [korean_topik2](../data/audits/findings/korean_topik2.md) | 60 | 1 | 1 | 1 | 1 | 14 |
| [mammals_world](../data/audits/findings/mammals_world.md) | 30 | 2 | 3 | 3 | 1 | 32 |
| [medical_terminology](../data/audits/findings/medical_terminology.md) | 30 | 1 | 3 | 4 | 2 | 23 |
| [medieval_world](../data/audits/findings/medieval_world.md) | 30 | 1 | 4 | 4 | 0 | 26 |
| [movies_cinema](../data/audits/findings/movies_cinema.md) | 30 | 0 | 4 | 3 | 2 | 15 |
| [music_history](../data/audits/findings/music_history.md) | 30 | 0 | 3 | 4 | 2 | 13 |
| [nasa_missions](../data/audits/findings/nasa_missions.md) | 30 | 0 | 0 | 1 | 0 | 1 |
| [norse_mythology](../data/audits/findings/norse_mythology.md) | 30 | 0 | 1 | 1 | 0 | 4 |
| [ocean_life](../data/audits/findings/ocean_life.md) | 30 | 2 | 3 | 3 | 1 | 32 |
| [periodic_table](../data/audits/findings/periodic_table.md) | 30 | 0 | 0 | 0 | 0 | 0 |
| [pharmacology](../data/audits/findings/pharmacology.md) | 30 | 1 | 2 | 2 | 1 | 18 |
| [philosophy](../data/audits/findings/philosophy.md) | 30 | 0 | 0 | 1 | 1 | 1 |
| [pop_culture](../data/audits/findings/pop_culture.md) | 30 | 0 | 2 | 3 | 1 | 9 |
| [solar_system](../data/audits/findings/solar_system.md) | 30 | 1 | 4 | 1 | 0 | 23 |
| [spanish_a1](../data/audits/findings/spanish_a1.md) | 60 | 4 | 3 | 2 | 1 | 51 |
| [spanish_a1_grammar](../data/audits/findings/spanish_a1_grammar.md) | 30 | 0 | 5 | 3 | 1 | 18 |
| [spanish_a2](../data/audits/findings/spanish_a2.md) | 30 | 2 | 3 | 1 | 1 | 30 |
| [spanish_a2_grammar](../data/audits/findings/spanish_a2_grammar.md) | 30 | 0 | 4 | 2 | 1 | 14 |
| [spanish_b1](../data/audits/findings/spanish_b1.md) | 30 | 4 | 3 | 2 | 1 | 51 |
| [spanish_b1_grammar](../data/audits/findings/spanish_b1_grammar.md) | 30 | 0 | 3 | 0 | 1 | 9 |
| [spanish_b2](../data/audits/findings/spanish_b2.md) | 30 | 2 | 3 | 2 | 0 | 31 |
| [spanish_b2_grammar](../data/audits/findings/spanish_b2_grammar.md) | 30 | 0 | 0 | 0 | 0 | 0 |
| [spanish_c1](../data/audits/findings/spanish_c1.md) | 60 | 5 | 3 | 2 | 0 | 61 |
| [spanish_c2](../data/audits/findings/spanish_c2.md) | 30 | 3 | 2 | 2 | 1 | 38 |
| [test_world_capitals](../data/audits/findings/test_world_capitals.md) | 30 | 0 | 1 | 2 | 1 | 5 |
| [us_presidents](../data/audits/findings/us_presidents.md) | 30 | 1 | 2 | 4 | 0 | 20 |
| [us_states](../data/audits/findings/us_states.md) | 30 | 0 | 2 | 3 | 1 | 9 |
| [world_capitals](../data/audits/findings/world_capitals.md) | 30 | 0 | 1 | 2 | 1 | 5 |
| [world_countries](../data/audits/findings/world_countries.md) | 30 | 0 | 1 | 2 | 0 | 5 |
| [world_cuisines](../data/audits/findings/world_cuisines.md) | 30 | 0 | 2 | 3 | 1 | 9 |
| [world_flags](../data/audits/findings/world_flags.md) | 30 | 0 | 1 | 1 | 1 | 4 |
| [world_literature](../data/audits/findings/world_literature.md) | 30 | 0 | 2 | 3 | 2 | 9 |
| [world_religions](../data/audits/findings/world_religions.md) | 30 | 0 | 1 | 0 | 0 | 3 |
| [world_war_ii](../data/audits/findings/world_war_ii.md) | 30 | 0 | 2 | 6 | 0 | 12 |
| [world_wonders](../data/audits/findings/world_wonders.md) | 30 | 1 | 4 | 3 | 1 | 25 |

---

## Per-deck summaries (TOC with short notes)

### ancient_greece
**Severity:** B0 M6 m3 N0  |  **Findings:** [link](../data/audits/findings/ancient_greece.md)  |  **Expectations:** [link](../data/audits/expectations/ancient_greece.md)

Ancient Greece is a high-quality, well-researched deck with strong narrative facts and good explanations. The dominant issue is systemic POOL-CONTAM in the `historical_phrases_long` pool: 87 semantically disparate answers compete as distractors, producing option sets where distractors from completely different domains appear next to each other ("Scientific history", "Died in prison from gangrene", "The Macedonian phalanx" as distractors for a Battle-of-Salamis fact). This is visible in every quiz entry drawn from that pool.

---

### ancient_rome
**Severity:** B0 M3 m6 N0  |  **Findings:** [link](../data/audits/findings/ancient_rome.md)  |  **Expectations:** [link](../data/audits/expectations/ancient_rome.md)

Ancient Rome is a solid, well-sourced deck with high factual quality. The dominant issue mirrors ancient_greece: `historical_phrases` (80 facts, EXEMPT) produces POOL-CONTAM at higher mastery levels. A secondary issue is pool misassignment: "She-wolf" appears in `roman_god_names` (she-wolf is a creature, not a deity), causing a CATEGORY-TELL when it appears as a distractor in god-themed questions. Date pool distractors are generally plausible (nearby years within the Roman period).

---

### anime_manga
**Severity:** B0 M2 m3 N2  |  **Findings:** [link](../data/audits/findings/anime_manga.md)  |  **Expectations:** [link](../data/audits/expectations/anime_manga.md)

204 facts, 15 pools. Overall quality is high for a pop-culture knowledge deck. The creator_names_long pool (38 facts) produces excellent, plausible distractors. Year and count pools render correctly via numerical generation. Main concerns are: small pools at or below the recommended 15-member threshold with zero synthetics, a mild AMBIGUOUS-Q cluster around superlatives, and one pool-level concern where creator names mix directors with mangaka (different professional roles). No broken grammar detected.

---

### ap_biology
**Severity:** B2 M3 m3 N1  |  **Findings:** [link](../data/audits/findings/ap_biology.md)  |  **Expectations:** [link](../data/audits/expectations/ap_biology.md)

The AP Biology deck is largely well-constructed. The dominant issues are two BLOCKERs: a date fact whose question stem is incompatible with the correct answer (`ap_bio_darwin_1859`), and a logistic growth equation fact where the rendered question quotes the answer verbatim (`ap_bio_u8_041`). Beyond these, POOL-CONTAM is the primary systemic concern — the two mega-pools (`term_definitions_long` at 214 facts and `concept_statements` at 87 facts) draw distractors across all 9 AP Bio units.

---

### ap_chemistry
**Severity:** B1 M6 m3 N1  |  **Findings:** [link](../data/audits/findings/ap_chemistry.md)  |  **Expectations:** [link](../data/audits/expectations/ap_chemistry.md)

The AP Chemistry deck has several significant quality concerns. The `bracket_numbers` pool contains a non-numeric fact whose correct answer is a descriptor string ("pH > 7 (basic)") but whose distractors include an isotope abundance and a yield percentage — three completely different measurement types in one question. Multiple question stems suffer from "this" placeholder rendering failure, producing broken English. The `process_types` and `unique_atom_names` pools also show contamination.

---

### ap_european_history
**Severity:** B0 M4 m4 N1  |  **Findings:** [link](../data/audits/findings/ap_european_history.md)  |  **Expectations:** [link](../data/audits/expectations/ap_european_history.md)

AP European History is the best-structured deck in the AP batch. The short/long pool split is well-designed and largely eliminates the POOL-CONTAM pattern seen in the ancient history decks. However, several issues remain: concept_terms_short/long pools draw distractors from across nine centuries of European history, producing time-period-incongruous distractors that are CATEGORY-TELL; "72 years" (a count) appears in a date pool.

---

### ap_human_geography
**Severity:** B2 M3 m3 N2  |  **Findings:** [link](../data/audits/findings/ap_human_geography.md)  |  **Expectations:** [link](../data/audits/expectations/ap_human_geography.md)

The AP Human Geography deck has the most complex pool architecture of any AP deck (42 pools, with duplicate pool IDs) but is largely functional at the quiz level. One BLOCKER: the `bracket_numbers` pool has only 5 real factIds and no synthetic distractors — at mastery=0, the pool can produce only 2 distractors for a 3-option question. One BROKEN-GRAMMAR BLOCKER from a "this" artifact in a guest-worker question stem.

---

### ap_macroeconomics
**Severity:** B4 M4 m2 N1  |  **Findings:** [link](../data/audits/findings/ap_macroeconomics.md)  |  **Expectations:** [link](../data/audits/expectations/ap_macroeconomics.md)

The AP Macroeconomics deck has the most severe quality concerns of any deck in the AP batch. Four facts have BLOCKER-level BROKEN-GRAMMAR: "Irving This", "Federal this", "bank this", and "capital this" — template word-substitution failures that leave "this" as a visible noun replacing proper nouns in the question stem, producing ungrammatical and misleading questions at all three mastery levels. One of these also has SYNONYM-LEAK where correct sub-answers appear as distractors for a composite-answer question.

---

### ap_microeconomics
**Severity:** B0 M4 m3 N1  |  **Findings:** [link](../data/audits/findings/ap_microeconomics.md)  |  **Expectations:** [link](../data/audits/expectations/ap_microeconomics.md)

The AP Microeconomics deck is the second-best structured AP deck in this batch after AP Physics 1. No BLOCKERs. One BROKEN-GRAMMAR instance detected. The dominant concern is SYNONYM-LEAK in pools for closely-related economic terms: "Deadweight loss" and "Deadweight loss is zero" as co-options, "monopoly" and "natural monopoly" as co-options, and the elasticity pool mixing demand and supply elasticity types such that correct and near-antonym answers appear in the same option set.

---

### ap_physics_1
**Severity:** B0 M3 m4 N1  |  **Findings:** [link](../data/audits/findings/ap_physics_1.md)  |  **Expectations:** [link](../data/audits/expectations/ap_physics_1.md)

The AP Physics 1 deck is one of the better-structured AP decks in this batch. No BLOCKER-level issues. The dominant concern is POOL-CONTAM in the large `concept_statements` pool (123 facts, homogeneityExempt) and `equation_explanations` pool (44 facts, homogeneityExempt), both of which draw distractors across all 8 CED units. The `term_definitions` pool mixes pure definitional answers with condition-statement answers containing mathematical notation.

---

### ap_psychology
**Severity:** B0 M3 m4 N1  |  **Findings:** [link](../data/audits/findings/ap_psychology.md)  |  **Expectations:** [link](../data/audits/expectations/ap_psychology.md)

The AP Psychology deck is structurally sound with well-written question stems. No BLOCKERs. The primary concerns are: the massive `psych_concept_terms` pool (149 facts) produces predictable cross-domain contamination across all 9 CED units; the `brain_structures` pool mixes answers with and without parenthetical elaborations, creating inconsistent answer formats; the `dev_stage_names` pool conflates developmental stage names with theorist names.

---

### ap_us_history
**Severity:** B1 M3 m4 N0  |  **Findings:** [link](../data/audits/findings/ap_us_history.md)  |  **Expectations:** [link](../data/audits/expectations/ap_us_history.md)

AP U.S. History is a large, well-organized deck with strong chain theme alignment to the 9 APUSH periods. The primary structural issue is the `concept_terms` pool (142 facts) which inevitably produces cross-period distractor contamination. A BLOCKER-level factual error exists: the Reagan fact claims he "presided over the end of the Cold War as the Soviet Union dissolved in 1991" — Reagan left office January 1989; the USSR dissolved under George H.W. Bush.

---

### ap_world_history
**Severity:** B1 M4 m3 N1  |  **Findings:** [link](../data/audits/findings/ap_world_history.md)  |  **Expectations:** [link](../data/audits/expectations/ap_world_history.md)

AP World History is the largest deck in the batch (620 facts) and has good AP exam alignment. However, the `concept_terms` pool (297 facts — 48% of the deck) is the most problematic pool across all 9 decks audited. It inevitably pulls distractors spanning 800 years and every world region. The clearest manifestation: "Final Solution (Nazi genocide plan)" appearing as a distractor for a question about medieval India's Sepoy Mutiny context.

---

### chess_tactics
**Severity:** B3 M1 m0 N0  |  **Findings:** [link](../data/audits/findings/chess_tactics.md)  |  **Expectations:** [link](../data/audits/expectations/chess_tactics.md)

90 quiz dump entries (30 facts × 3 mastery levels). All 300 chess facts validated against FEN piece positions and UCI move notation. The `quizResponseMode="chess_move"` design means `options.length===1` for all entries — this is correct behavior (text input, not MCQ). Two facts have corrupt `solutionMoves[0]` data (invalid setup move for the given position), but their player-facing answer data (`correctAnswer`, `solutionMoves[1]`) is valid. Two facts have a `tacticTheme` vs pool mismatch.

---

### chinese_hsk1
**Severity:** B4 M2 m1 N1  |  **Findings:** [link](../data/audits/findings/chinese_hsk1.md)  |  **Expectations:** [link](../data/audits/expectations/chinese_hsk1.md)

90 quiz entries (30 facts × 3 mastery levels). Two systemic blockers affect every fact rendered via `reading_pinyin` and `reverse` templates. The `reading_pinyin` template asks for pinyin but delivers English meanings as both question and options, making it fundamentally misleading. The `reverse` template mixes Chinese characters with English meaning distractors in the same option list, undermining every "How do you say X in Chinese?" question. Length tells are pervasive wherever Chinese characters appear alongside English phrases.

---

### chinese_hsk2
**Severity:** B2 M2 m1 N1  |  **Findings:** [link](../data/audits/findings/chinese_hsk2.md)  |  **Expectations:** [link](../data/audits/expectations/chinese_hsk2.md)

90 quiz entries (30 facts × 3 mastery levels). Same systemic failures as HSK1: TEMPLATE_MISFIT on all `reading_pinyin` entries, POOL_CONTAM on all `reverse` entries. Additional unique issue: `zh-hsk-475` (啊) has `correctAnswer="interjection"` — a meta-linguistic label rather than a meaning — which is a POS_TELL pattern where the answer type description leaks its category.

---

### chinese_hsk3
**Severity:** B2 M2 m1 N1  |  **Findings:** [link](../data/audits/findings/chinese_hsk3.md)  |  **Expectations:** [link](../data/audits/expectations/chinese_hsk3.md)

90 quiz entries (30 facts × 3 mastery levels). Same systemic TEMPLATE_MISFIT and POOL_CONTAM failures as HSK1/2. Length tells worsen at this level because multi-character compounds (2–4 Chinese chars) are even shorter than English translations, making the character-spotting heuristic more reliable. Worst observed ratio: 14× (1-char Chinese '已' vs 10-char English "simply; really").

---

### chinese_hsk4
**Severity:** B4 M1 m1 N1  |  **Findings:** [link](../data/audits/findings/chinese_hsk4.md)  |  **Expectations:** [link](../data/audits/expectations/chinese_hsk4.md)

90 quiz entries (30 facts × 3 mastery levels). Systemic TEMPLATE_MISFIT and POOL_CONTAM persist. LENGTH_TELL severity comparable to HSK3. Notable new issue: some facts with two-character answer pool entries (e.g., '辛苦') appearing as distractors against English verb phrases produce particularly confusing option sets.

---

### chinese_hsk5
**Severity:** B3 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/chinese_hsk5.md)  |  **Expectations:** [link](../data/audits/expectations/chinese_hsk5.md)

180 quiz entries (60 facts × 3 mastery levels). Highest absolute issue counts of any HSK deck due to larger dump size. TEMPLATE_MISFIT and POOL_CONTAM are systemic across all HSK decks. HSK5-specific concern: 69 facts have `partOfSpeech: "noun"` despite answers that are clearly modal verbs, particles, or adverbs — metadata inconsistency that could affect template selection logic.

---

### chinese_hsk6
**Severity:** B5 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/chinese_hsk6.md)  |  **Expectations:** [link](../data/audits/expectations/chinese_hsk6.md)

180 quiz entries (60 facts × 3 mastery levels). Systemic TEMPLATE_MISFIT and POOL_CONTAM continue. Most severe deck in the Chinese series for FACTUAL_SUSPECT: 200 strong contradictions where explanation and correctAnswer describe different meanings — not just alternate readings but fundamentally different concepts. Worst LENGTH_TELL ratio in the entire batch: 23× (哼 at 1 char vs 20+ char English phrases).

---

### computer_science
**Severity:** B0 M0 m1 N0  |  **Findings:** [link](../data/audits/findings/computer_science.md)  |  **Expectations:** [link](../data/audits/expectations/computer_science.md)

87 quiz dump entries (29 facts × 3 mastery levels). Two soft SELF-ANSWERING concerns identified — both are inherent to the acronym expansion question format and assessed as MINOR rather than MAJOR. No structural failures, no broken grammar, no factual errors found in the sample. Near-clean deck.

---

### constellations
**Severity:** B0 M2 m0 N0  |  **Findings:** [link](../data/audits/findings/constellations.md)  |  **Expectations:** [link](../data/audits/expectations/constellations.md)

90 quiz dump entries (30 facts × 3 mastery levels). Two MAJOR issues identified: one soft SELF-ANSWERING where the constellation name leaks the answer, and one question with a clearly wrong-category distractor. Both are individually addressable. Generally clean deck.

---

### czech_a1
**Severity:** B0 M6 m2 N1  |  **Findings:** [link](../data/audits/findings/czech_a1.md)  |  **Expectations:** [link](../data/audits/expectations/czech_a1.md)

90 quiz entries (30 facts × 3 mastery levels). Primary issues are SELF_ANSWERING in `definition_match` template (7 cases where explanation text contains the correct answer verbatim) and explanation quality failures (Latin placeholders). No TEMPLATE_MISFIT or POOL_CONTAM — Czech's two-pool structure avoids the language-mixing problems seen in HSK decks.

---

### czech_a2
**Severity:** B0 M3 m3 N1  |  **Findings:** [link](../data/audits/findings/czech_a2.md)  |  **Expectations:** [link](../data/audits/expectations/czech_a2.md)

90 quiz entries (30 facts × 3 mastery levels). Zero LENGTH_TELL flags in the dump. 11 SELF_ANSWERING instances in `definition_match` template. Same EXPLANATION_QUALITY pattern as A1. No TEMPLATE_MISFIT or POOL_CONTAM. The difficulty=1 assignment matching A1 means no leveling signal for players moving between the two decks.

---

### czech_b1
**Severity:** B2 M4 m2 N1  |  **Findings:** [link](../data/audits/findings/czech_b1.md)  |  **Expectations:** [link](../data/audits/expectations/czech_b1.md)

90 quiz entries (30 facts × 3 mastery levels). LENGTH_TELL highest among Czech decks (24 occurrences) driven by short 3-letter Czech words like "eso" (ace) appearing among multi-word English distractors. 11 SELF_ANSWERING instances in definition_match. Proper nouns (Washington, New York) as vocabulary items are functionally unteachable — they are identical in Czech and English.

---

### czech_b2
**Severity:** B4 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/czech_b2.md)  |  **Expectations:** [link](../data/audits/expectations/czech_b2.md)

180 quiz entries (60 facts × 3 mastery levels). Highest SELF_ANSWERING count of any Czech deck: 32 JSON-level cognate cases, 13 definition_match cases in dump, plus 14 total in the dump rendering. At B2, Czech vocabulary heavily includes Latin/Germanic loanwords that are transparent to English speakers, making them trivially guessable. Zero LENGTH_TELL (clean). Difficulty=2 unchanged from B1.

---

### dinosaurs
**Severity:** B1 M3 m3 N1  |  **Findings:** [link](../data/audits/findings/dinosaurs.md)  |  **Expectations:** [link](../data/audits/expectations/dinosaurs.md)

29 unique facts sampled across 87 quiz dump entries. Deck has 187 facts and 6 pools. The dominant issue is a catastrophic POOL-CONTAM in `misc_concepts_short`: this pool mixes boolean answers ("False"), geographic names ("China"), fossil proper names ("Sue"), and anatomical terms ("Teeth", "Fish") into a single distractor pool. The quiz renders distractors like "Fish" and "Sue" for questions about geological dates, and "Giraffe"/"Monitor lizard" appear as distractors for food-web questions.

---

### dutch_a1
**Severity:** B5 M2 m1 N1  |  **Findings:** [link](../data/audits/findings/dutch_a1.md)  |  **Expectations:** [link](../data/audits/expectations/dutch_a1.md)

90 quiz entries (30 facts × 3 mastery levels). Primary issue: 5 perfect Dutch-English cognates create inescapable SELF_ANSWERING across all templates, with `nl-cefr-111` (school=school) appearing 3 times in the 30-fact sample — an outsized share. Definition_match template leaks answers via Wiktionary explanations (4 cases). LENGTH_TELL driven by short cognate answers against longer non-cognate options.

---

### dutch_a2
**Severity:** B5 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/dutch_a2.md)  |  **Expectations:** [link](../data/audits/expectations/dutch_a2.md)

90 quiz entries (30 facts × 3 mastery levels). Ten SELF_ANSWERING cases in dump (highest raw count among Dutch decks) from Dutch-English cognates. Seven definition_match SELF_ANSWERING cases where explanation text contains the correct answer. LENGTH_TELL moderate (10 occurrences). Notably the `kerk — church` definition_match entry is a particularly informative example of how explanatory overreach causes self-answering.

---

### dutch_b1
**Severity:** B4 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/dutch_b1.md)  |  **Expectations:** [link](../data/audits/expectations/dutch_b1.md)

90 quiz entries (30 facts × 3 mastery levels). Six SELF_ANSWERING cases from definition_match, plus 5 cognate facts that are self-answering across all templates. LENGTH_TELL driven by multi-word comma answers ("refrigerator, fridge", "foreign countries, abroad") paired with short single-word distractors. The deck's 232-fact size is a structural concern — undersized for a B1 CEFR level.

---

### dutch_b2
**Severity:** B5 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/dutch_b2.md)  |  **Expectations:** [link](../data/audits/expectations/dutch_b2.md)

90 quiz entries (30 facts × 3 mastery levels from 71-fact deck — extremely high sample ratio). 15 SELF_ANSWERING instances in the dump (16.7% of entries) — highest rate in the entire batch. Three cognate facts (conflict, festival, gamer) appear repeatedly in the sample. LENGTH_TELL in 6 cases. This deck is critically undersized at 71 facts; the 90-entry dump covers all 3 mastery levels of 30 distinct facts, meaning the remaining 41 facts were not sampled at all.

---

### egyptian_mythology
**Severity:** B4 M0 m0 N0  |  **Findings:** [link](../data/audits/findings/egyptian_mythology.md)  |  **Expectations:** [link](../data/audits/expectations/egyptian_mythology.md)

87 quiz dump entries (29 facts × 3 mastery levels). Four BLOCKER-level broken grammar facts identified — all are unresolved pronoun placeholders ("this") in question stems that produce unintelligible text. These require remediation before the deck ships. Outside these four facts, the rest of the deck renders cleanly — zero MAJOR, zero MINOR, zero NIT findings.

---

### famous_inventions
**Severity:** B1 M4 m3 N1  |  **Findings:** [link](../data/audits/findings/famous_inventions.md)  |  **Expectations:** [link](../data/audits/expectations/famous_inventions.md)

Famous Inventions has good overall pool design with 11 semantic pools. Two distinct issues dominate: a BROKEN-GRAMMAR BLOCKER in `inv_0_steel_bessemer` — "Who introduced the device process for mass-producing cheap steel" contains "device" as an apparent word-replacement artifact for "Bessemer"; and `invention_names_long` pool mixes durations, device names, event names, and miscellaneous items causing POOL-CONTAM.

---

### famous_paintings
**Severity:** B1 M3 m2 N1  |  **Findings:** [link](../data/audits/findings/famous_paintings.md)  |  **Expectations:** [link](../data/audits/expectations/famous_paintings.md)

104 facts, 11 pools. This deck has a systemic BLOCKER-class issue: all `image_question` facts render with only 1 option (the correct answer, no distractors) across ALL mastery levels. The engine is not generating distractors for these facts — confirmed across at least 4 image facts in the dump. This makes every image question trivially answered. Non-image facts in this deck are otherwise clean.

---

### fifa_world_cup
**Severity:** B0 M2 m3 N0  |  **Findings:** [link](../data/audits/findings/fifa_world_cup.md)  |  **Expectations:** [link](../data/audits/expectations/fifa_world_cup.md)

214 facts across 5 sub-decks. The deck is generally well-constructed with rich factual content. Issues include: 'England' duplicated in synthetic distractors, the `world_cup_goal_tallies` pool containing an international career goal count (not a WC tally), and a potential `womens_host_country_names` length-tell from the composite "Australia / New Zealand" entry.

---

### french_a1
**Severity:** B1 M4 m2 N0  |  **Findings:** [link](../data/audits/findings/french_a1.md)  |  **Expectations:** [link](../data/audits/expectations/french_a1.md)

932 facts, 90 quiz dump entries. Two blockers identified: a placeholder "answer" distractor appears in two entries. POS-tell is the structural weakness — one shared pool for all parts of speech. Self-answering appears exclusively in the mastery=4 definition_match template, where the explanation directly contains the answer word. Length-tell is widespread due to compound answers.

---

### french_a1_grammar
**Severity:** B0 M0 m0 N2  |  **Findings:** [link](../data/audits/findings/french_a1_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/french_a1_grammar.md)

194 facts, 84 quiz dump entries. Cleanest deck in the batch. No blockers, no majors. All options are conjugated verb forms from the same paradigm, eliminating POS-tell entirely. One potential concern at higher mastery levels: some pools introduce distractors from a different person of the same verb as the correct form — good discrimination. Length homogeneity is excellent: all conjugated forms are 4–10 characters.

---

### french_a2
**Severity:** B0 M6 m0 N0  |  **Findings:** [link](../data/audits/findings/french_a2.md)  |  **Expectations:** [link](../data/audits/expectations/french_a2.md)

538 facts, 90 quiz dump entries. POS-tell is more prevalent than A1 (3 instances in 30 sampled facts, ~10% of sample). Self-answering is the dominant issue type — 9 instances, all at mastery=4 via definition_match. One content flag: an explanation containing explicit anatomical slang terms is exposed as a question stem.

---

### french_a2_grammar
**Severity:** B0 M3 m4 N0  |  **Findings:** [link](../data/audits/findings/french_a2_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/french_a2_grammar.md)

354 facts, 75 quiz dump entries. The dominant issue is extreme length-tell in the `y_pronoun_uses` and `en_pronoun_uses` pools, where the correct answer is a single character ("y" or "en") but distractors are full French sentences. The ratio reaches 19× — the worst length-tell in the entire batch. Additional length-tell in `superlatif_forms`, `imperatif_tu_forms`, `comparatif_plus_moins_aussi`, and `time_expressions_passe`.

---

### french_b1
**Severity:** B0 M6 m2 N0  |  **Findings:** [link](../data/audits/findings/french_b1.md)  |  **Expectations:** [link](../data/audits/expectations/french_b1.md)

1,412 facts, 180 quiz dump entries (largest French vocab sample). POS-tell (7 instances) and self-answering (17 instances) are both elevated vs A1/A2 — consistent with larger verb share and more cognates. One pool-contamination instance (English word in French-word reverse slot). Length-tell is significant in reverse mode where short French words compete against English compound phrases.

---

### french_b1_grammar
**Severity:** B0 M1 m2 N0  |  **Findings:** [link](../data/audits/findings/french_b1_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/french_b1_grammar.md)

348 facts, 87 quiz dump entries. Three length-tell instances, all tied to the same root cause: the `si_imparfait_patterns` pool has synthetic distractors that are complete si-clause sentences rather than conjugated verb forms. The `connecteurs_consecutifs` pool also shows mild length variation. Otherwise, pool design is solid. No self-answering, no POS-tell, no pool contamination.

---

### french_b2
**Severity:** B0 M5 m3 N0  |  **Findings:** [link](../data/audits/findings/french_b2.md)  |  **Expectations:** [link](../data/audits/expectations/french_b2.md)

4,115 facts, 180 quiz dump entries. Length-tell (33 instances) and compound-answer format issues (29 instances) are the dominant problems. Synonym-leak appears as a structural issue in the habileté pool — three options all share the ", ability" suffix. Self-answering (14 instances) continues at mastery=4. POS-tell is low (1 instance) due to noun-dominated pool.

---

### french_b2_grammar
**Severity:** B0 M2 m2 N2  |  **Findings:** [link](../data/audits/findings/french_b2_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/french_b2_grammar.md)

397 facts, 93 quiz dump entries. Six length-tell instances across three pools. Two structural quality issues: a truncated/malformed distractor in the concordance pool, and an ambiguous quiz format in the opinion_negative pool where all options express semantically equivalent ideas. Mise en relief pools have an inherent ambiguity: the question specifies a target element but multiple syntactically valid cleft sentences could be constructed.

---

### german_a1
**Severity:** B0 M6 m3 N0  |  **Findings:** [link](../data/audits/findings/german_a1.md)  |  **Expectations:** [link](../data/audits/expectations/german_a1.md)

1,420 facts, 180 quiz dump entries. Pool-contamination (English words in German reverse-mode options) affects 3 entries — this is a distractor-selection bug shared with german_a2 and german_b1. Self-answering at mastery=4 is pervasive (15 instances), driven by the definition_match template and German cognate density. POS-tell (5 instances) and length-tell (28 instances) are structurally inherent to the single mixed pool.

---

### german_a2
**Severity:** B0 M7 m1 N1  |  **Findings:** [link](../data/audits/findings/german_a2.md)  |  **Expectations:** [link](../data/audits/expectations/german_a2.md)

795 facts, 90 quiz dump entries. Pool-contamination (English words in German reverse-mode options) confirmed — 2 instances affecting "bad" and "less" as distractors. POS-tell (2 instances) and self-answering (8 instances at mastery=4) follow the same pattern as other vocabulary decks. One CEFR-level concern: "Wortbildung" (word formation — a linguistics metalanguage term) is placed at A2.

---

### german_b1
**Severity:** B0 M6 m4 N0  |  **Findings:** [link](../data/audits/findings/german_b1.md)  |  **Expectations:** [link](../data/audits/expectations/german_b1.md)

867 facts, 90 quiz dump entries. POS-tell is elevated at B1 (6 instances in 90 entries — 7% of sample) — highest German vocab deck rate. Pool-contamination continues (1 instance with both "old" and "out" as English distractors in a German-word slot). Self-answering (9 instances) and length-tell (15 instances) follow established patterns.

---

### german_b2
**Severity:** B0 M5 m3 N0  |  **Findings:** [link](../data/audits/findings/german_b2.md)  |  **Expectations:** [link](../data/audits/expectations/german_b2.md)

843 facts, 90 quiz dump entries. No pool-contamination detected in this sample (improved vs A1–B1). POS-tell (5 instances) is the most prevalent MAJOR issue. Self-answering (5 instances at mastery=4) follows the cognate pattern. Length-tell present but less severe than other German decks. One AMBIGUOUS-Q: "entstehend" explanation contains "emerging" twice in different parts of the definition.

---

### greek_mythology
**Severity:** B0 M0 m0 N3  |  **Findings:** [link](../data/audits/findings/greek_mythology.md)  |  **Expectations:** [link](../data/audits/expectations/greek_mythology.md)

90 quiz dump entries (30 facts × 3 mastery levels). Zero structural failures. Zero rendering errors. The deck is in excellent shape — semantically coherent pools, no script mixing, no broken templates. Only stylistic (NIT-level) concerns found.

---

### human_anatomy
**Severity:** B2 M8 m4 N2  |  **Findings:** [link](../data/audits/findings/human_anatomy.md)  |  **Expectations:** [link](../data/audits/expectations/human_anatomy.md)

70 unique facts sampled across 210 quiz dump entries. Deck has 2,009 facts and 70 pools. The dominant issue is a systemic TEMPLATE-MISFIT: 50+ question stems contain the literal string "anatomical structure" where a specific anatomical name should have been substituted during generation — these are broken at the source JSON level. A secondary POOL-CONTAM issue exists in `structure_cardiac_short` where blood cells appear alongside cardiac structures.

---

### japanese_hiragana
**Severity:** B1 M1 m1 N0  |  **Findings:** [link](../data/audits/findings/japanese_hiragana.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_hiragana.md)

The hiragana deck has a systemic POOL-CONTAM defect: the single `english_meanings` pool is used for both forward (character→romaji) and reverse (romaji→character) facts. Forward questions correctly show English/romaji answers, but reverse questions need hiragana-character distractors. Because the pool mixes both types, 82 of 90 rows present option sets that mix hiragana characters and romaji strings.

---

### japanese_katakana
**Severity:** B1 M1 m1 N0  |  **Findings:** [link](../data/audits/findings/japanese_katakana.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_katakana.md)

The katakana deck exhibits the same structural defect as hiragana: a single pool containing both katakana-character facts and romaji-romanization facts, causing script mixing in option sets. 71 of 90 rows (79%) have mixed-script option sets. The rate is slightly lower than hiragana (82/90) due to sampling variation; the root cause is identical.

---

### japanese_n1
**Severity:** B3 M2 m1 N0  |  **Findings:** [link](../data/audits/findings/japanese_n1.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n1.md)

N1 has the most severe `_fallback` rate of all JLPT decks (111/180 = 62%) and 3 confirmed SELF-ANSWERING cases. The POOL-CONTAM pattern is present in reading and reverse templates. The very high `_fallback` rate suggests N1's large kanji pool (1,232 kanji) is almost entirely falling through to fallback, making onyomi/kunyomi question types non-functional.

---

### japanese_n1_grammar
**Severity:** B1 M2 m2 N0  |  **Findings:** [link](../data/audits/findings/japanese_n1_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n1_grammar.md)

N1 grammar uses `fill_blank_grammar` exclusively with 177 rows sampled. LENGTH-TELL affects 29/177 rows (16%). The defining quality risk is SYNONYM-LEAK between near-identical N1 patterns (なり/なりとも, をもちまして/をもってすれば) which appear as distractors for each other and may both be grammatically valid in context.

---

### japanese_n2
**Severity:** B1 M2 m1 N0  |  **Findings:** [link](../data/audits/findings/japanese_n2.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n2.md)

N2 has the lowest `_fallback` rate of the JLPT vocab decks (75/177 = 42%) but still shows POOL-CONTAM in reading and reverse templates. No SELF-ANSWERING confirmed in the 177-row sample — N2 vocabulary has fewer pure katakana loanwords. SYNONYM-LEAK is a known elevated risk at this level.

---

### japanese_n2_grammar
**Severity:** B0 M1 m3 N0  |  **Findings:** [link](../data/audits/findings/japanese_n2_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n2_grammar.md)

N2 grammar is the best-performing JLPT grammar deck: lowest LENGTH-TELL rate (9/78 rows, 12%), no `_fallback`, excellent 26-pool architecture. The fine-grained pool structure largely prevents cross-category distractor contamination. Main risks are small pool sizes causing potential exhaustion, and SYNONYM-LEAK between formally similar N2 patterns.

---

### japanese_n3
**Severity:** B2 M1 m2 N0  |  **Findings:** [link](../data/audits/findings/japanese_n3.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n3.md)

N3 shows the same systemic POOL-CONTAM defects as N5/N4, with the highest reading-template contamination count in the sample (27 entries). `_fallback` rate is 72/180 (40%). One SELF-ANSWERING confirmed for katakana word ジュース.

---

### japanese_n3_grammar
**Severity:** B0 M2 m2 N0  |  **Findings:** [link](../data/audits/findings/japanese_n3_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n3_grammar.md)

N3 grammar uses `fill_blank_grammar` exclusively. LENGTH-TELL affects 35/87 rows (40%) — driven by mixing single-kanji expressions (為, 旨) with long compound forms (下さいませんか, 比べものにならない). AMBIGUOUS-Q is elevated at N3 where clause connectors and conditionals have genuine overlap.

---

### japanese_n4
**Severity:** B2 M2 m1 N0  |  **Findings:** [link](../data/audits/findings/japanese_n4.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n4.md)

N4 exhibits identical systemic defects to N5: POOL-CONTAM in reading/reverse templates, and `_fallback` dominance. The `_fallback` rate is worse at 84/180 (47%), primarily driven by kanji facts. Two SELF-ANSWERING cases confirmed for katakana loanwords in the vocabulary pool.

---

### japanese_n4_grammar
**Severity:** B0 M2 m2 N0  |  **Findings:** [link](../data/audits/findings/japanese_n4_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n4_grammar.md)

N4 grammar uses `fill_blank_grammar` exclusively. LENGTH-TELL affects 32/90 rows (36%), primarily from mixing long obligatory forms (なければいけません) with short particles. SYNONYM-LEAK is the most significant content risk: N4 introduces multiple near-identical obligatory/conditional pairs that can validly fill each other's blanks.

---

### japanese_n5
**Severity:** B2 M2 m1 N0  |  **Findings:** [link](../data/audits/findings/japanese_n5.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n5.md)

The N5 vocab deck has two systemic structural defects that affect nearly every reading and reverse template quiz entry. The POOL-CONTAM issue in the `reading` template (English distractors appearing in "What is the reading of X?" questions) and the same defect in the `reverse` template make these question types trivially easy — the correct answer is always the only item in the expected script.

---

### japanese_n5_grammar
**Severity:** B0 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/japanese_n5_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/japanese_n5_grammar.md)

Grammar decks are structurally sound — exclusively using `fill_blank_grammar` template with no `_fallback` contamination. The main issues are LENGTH-TELL (dominant, 54/90 rows = 60%) from mixing single-character particles with multi-morpheme grammar structures in the same option set, and AMBIGUOUS-Q from particle questions where context doesn't uniquely determine the correct particle.

---

### korean_hangul
**Severity:** B1 M1 m2 N0  |  **Findings:** [link](../data/audits/findings/korean_hangul.md)  |  **Expectations:** [link](../data/audits/expectations/korean_hangul.md)

The hangul deck has the same systemic defect as the Japanese kana decks: a single pool mixing hangul-character facts and romanization facts, producing mixed-script option sets in 75 of 90 rows (83%). Additionally, 3 confirmed SELF-ANSWERING cases where the romanization answer is embedded in the question phrasing.

---

### korean_topik1
**Severity:** B1 M1 m2 N0  |  **Findings:** [link](../data/audits/findings/korean_topik1.md)  |  **Expectations:** [link](../data/audits/expectations/korean_topik1.md)

TOPIK I is structurally strong: no `_fallback`, good template variety (forward/reverse/definition_match/synonym_pick), NIKL-sourced vocabulary. The main defects are reverse template pool contamination — English distractors in "How do you say X in Korean?" questions — and multi-meaning answers creating ambiguity. No SELF-ANSWERING or BROKEN-GRAMMAR found in the 180-row sample.

---

### korean_topik2
**Severity:** B1 M1 m1 N1  |  **Findings:** [link](../data/audits/findings/korean_topik2.md)  |  **Expectations:** [link](../data/audits/expectations/korean_topik2.md)

TOPIK II has identical structural characteristics to TOPIK I: no `_fallback`, strong template variety, NIKL-sourced vocabulary. The same systemic POOL-CONTAM defect is present in the reverse template (49/49 = 100% contamination). Multi-meaning answers affect 26 facts (14%). Overall this is the cleanest Korean vocabulary deck in content quality, with fewer synonym-leak risks found than TOPIK I.

---

### mammals_world
**Severity:** B2 M3 m3 N1  |  **Findings:** [link](../data/audits/findings/mammals_world.md)  |  **Expectations:** [link](../data/audits/expectations/mammals_world.md)

30 unique facts sampled across 90 quiz dump entries. Deck has 170 facts and 10 pools. The dominant issue is systemic POOL-CONTAM across all three stats pools (stats_short, stats_medium, stats_long): each mixes incompatible measurement units — kilograms, kilometers, centimeters, decibels, percentages, hours, km/h, and unitless counts appear as distractors for each other. A player quizzed on polar bear fat thickness sees options including "40,000" (elephant weight).

---

### medical_terminology
**Severity:** B1 M3 m4 N2  |  **Findings:** [link](../data/audits/findings/medical_terminology.md)  |  **Expectations:** [link](../data/audits/expectations/medical_terminology.md)

30 unique facts sampled across 90 quiz dump entries. Deck has 700 facts and 16 pools. Overall quiz rendering is clean — question stems are grammatically correct, explanations are complete. Key structural issues: the `bracket_numbers` pool has only 2 real facts and no synthetics (fatal), 5 self-answering facts where the combining form being tested appears verbatim in the question stem.

---

### medieval_world
**Severity:** B1 M4 m4 N0  |  **Findings:** [link](../data/audits/findings/medieval_world.md)  |  **Expectations:** [link](../data/audits/expectations/medieval_world.md)

Medieval World has broader global scope than the ancient decks and generally solid content. The dominant issues are: `date_named` pool format heterogeneity — mixing date-ranges ("c. 1235–c. 1610"), durations ("Over 1,100 years"), and specific dates creates obvious LENGTH-TELL and FORMAT-TELL situations; `ruler_leader_names` cross-domain contamination — leaders from Byzantine, African, and Japanese contexts share one pool, producing non-sequitur distractors.

---

### movies_cinema
**Severity:** B0 M4 m3 N2  |  **Findings:** [link](../data/audits/findings/movies_cinema.md)  |  **Expectations:** [link](../data/audits/expectations/movies_cinema.md)

277 facts, 10 pools. Core pools (director_names, film_titles, actor_names) are large and generate excellent distractors. Major issues are three confirmed BROKEN-GRAMMAR facts (word-replacement artifacts), serious POOL-CONTAM in film_trivia (6 semantically incompatible answer types in one pool), and inconsistent film title formatting in the film_titles pool creating SYNONYM-LEAK.

---

### music_history
**Severity:** B0 M3 m4 N2  |  **Findings:** [link](../data/audits/findings/music_history.md)  |  **Expectations:** [link](../data/audits/expectations/music_history.md)

230 facts, 11 pools. This deck has the most systemic content damage from the "this" batch rewrite: 10 facts with broken word-replacement artifacts, spread across multiple sub-decks and question types. The `description_terms` pool is severely contaminated, mixing answer concepts from 5 incompatible semantic domains. The `place_names` pool mixes German cities, American music venues, and countries as distractors for each other.

---

### nasa_missions
**Severity:** B0 M0 m1 N0  |  **Findings:** [link](../data/audits/findings/nasa_missions.md)  |  **Expectations:** [link](../data/audits/expectations/nasa_missions.md)

90 quiz dump entries (30 facts × 3 mastery levels). One MINOR pool contamination issue (count fact in year pool). A potential SELF-ANSWERING concern for `nasa_hubble_deep_field` was investigated and cleared. Factual spot-checks on verifiable dates came back correct. Near-clean deck.

---

### norse_mythology
**Severity:** B0 M1 m1 N0  |  **Findings:** [link](../data/audits/findings/norse_mythology.md)  |  **Expectations:** [link](../data/audits/expectations/norse_mythology.md)

87 quiz dump entries (29 facts × 3 mastery levels). One confirmed MAJOR and one MINOR issue both stem from the same root cause: the `object_names` pool contains a numeric answer ("8" for Sleipnir's legs) that contaminates object-name quizzes at mastery=4. Generally clean deck.

---

### ocean_life
**Severity:** B2 M3 m3 N1  |  **Findings:** [link](../data/audits/findings/ocean_life.md)  |  **Expectations:** [link](../data/audits/expectations/ocean_life.md)

28 unique facts sampled across 84 quiz dump entries. Deck has 182 facts and 15 pools. The deck has the only formally defined chain themes (5) among the six audited natural history decks. Critical structural failures: `stats_compact` pool has 1 real fact (functional singleton), `ocean_lists` has 1 real fact, `ocean_currents` has 2 real facts. Two NEAR-DUPLICATE option pairs emerge in quiz rendering.

---

### periodic_table
**Severity:** B0 M0 m0 N0  |  **Findings:** [link](../data/audits/findings/periodic_table.md)  |  **Expectations:** [link](../data/audits/expectations/periodic_table.md)

90 quiz dump entries (30 facts × 3 mastery levels). Zero blocking or major issues. One NIT regarding the small `element_symbols` pool. The deck is clean and factually reliable in all sampled entries. The only fully clean deck in the audit (score = 0, no NITs either).

---

### pharmacology
**Severity:** B1 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/pharmacology.md)  |  **Expectations:** [link](../data/audits/expectations/pharmacology.md)

29 unique facts sampled across 87 quiz dump entries. Deck has 405 facts and 12 pools. Overall the pharmacology deck shows the cleanest quiz rendering of the six audited clinical decks — drug class, mechanism, side effect, antidote, and nursing intervention pools are well-separated and semantically homogeneous. Two BROKEN-GRAMMAR facts from template substitution failures ("this-release", "this-dependent"). One high-severity SYNONYM-LEAK/DUPLICATE-OPT.

---

### philosophy
**Severity:** B0 M0 m1 N1  |  **Findings:** [link](../data/audits/findings/philosophy.md)  |  **Expectations:** [link](../data/audits/expectations/philosophy.md)

90 quiz dump entries (30 facts × 3 mastery levels). No blocking issues. One MINOR LENGTH-TELL in the `school_names` pool confirmed via structural pool analysis. One NIT regarding the `ancient_philosopher_names` pool. Near-clean deck.

---

### pop_culture
**Severity:** B0 M2 m3 N1  |  **Findings:** [link](../data/audits/findings/pop_culture.md)  |  **Expectations:** [link](../data/audits/expectations/pop_culture.md)

202 facts, 11 pools. Overall quality is acceptable. The deck's large `bracket_numbers` pool (86 facts) renders correctly via numerical generation with well-calibrated distractors. The main structural concern is that several small pools (tv_show_names: 3 real facts, meme_viral_names: 4 real, game_titles: 4 real) rely on 75–80% synthetic distractors, which can feel semantically weak at higher mastery levels.

---

### solar_system
**Severity:** B1 M4 m1 N0  |  **Findings:** [link](../data/audits/findings/solar_system.md)  |  **Expectations:** [link](../data/audits/expectations/solar_system.md)

The `planet_names` pool renders cleanly across all mastery levels — distractors are thematically coherent, length-homogeneous, and appropriately challenging. The `moon_names` and `moon_names_outer` pools also render well. The deck has one confirmed factual error, one structural mismatch between question stem and answer type, and one pool with three badly misclassified facts that corrupt every question they touch.

---

### spanish_a1
**Severity:** B4 M3 m2 N1  |  **Findings:** [link](../data/audits/findings/spanish_a1.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_a1.md)

180 quiz items sampled (60 facts × 3 mastery levels). Highest issue count of all vocab decks: 98 flagged items. Three systemic defects dominate: LENGTH-TELL (50 items) from answer length variance across the shared pool; POOL-CONTAM (29 items) from English meanings appearing as distractors on Spanish-answer reverse questions; and POS-TELL (13 items) from verb answers mixed with noun/adjective distractors. All three share a single root cause: a single flat `english_meanings` pool.

---

### spanish_a1_grammar
**Severity:** B0 M5 m3 N1  |  **Findings:** [link](../data/audits/findings/spanish_a1_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_a1_grammar.md)

90 quiz items sampled (30 facts × 3 mastery levels). 24 flagged items. All items use the `_fallback` fill-in-blank template. The primary issues are LENGTH-TELL (18 items) from pronoun/article pools mixing 2-char forms (`su`, `mi`, `no`) with 7–9-char forms (`nuestro`, `cualquier`, `ninguna`); and SELF-ANSWERING via translation (6 items) where the English translation in parentheses contains the correct Spanish form.

---

### spanish_a2
**Severity:** B2 M3 m1 N1  |  **Findings:** [link](../data/audits/findings/spanish_a2.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_a2.md)

90 quiz items sampled (30 facts × 3 mastery levels). 32 flagged items. POS-TELL is absent, suggesting the A2 pool is more noun-dominated. POOL-CONTAM (13 items) and LENGTH-TELL (19 items) persist as structural issues from the same root cause as A1. One notable content-quality flag: `estercolero` ("dunghill, dung heap") appears questionable as A2 vocabulary.

---

### spanish_a2_grammar
**Severity:** B0 M4 m2 N1  |  **Findings:** [link](../data/audits/findings/spanish_a2_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_a2_grammar.md)

75 quiz items sampled (25 facts × 3 mastery levels). 13 flagged items. All items use `_fallback` fill-in-blank template. Two distinct issue types: SELF-ANSWERING via translation (6 items, all from object-pronoun facts where the English translation contains the target pronoun); and LENGTH-TELL (7 items, from por/para pool and time-expression pools mixing prepositions with full phrases).

---

### spanish_b1
**Severity:** B4 M3 m2 N1  |  **Findings:** [link](../data/audits/findings/spanish_b1.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_b1.md)

90 quiz items sampled (30 facts × 3 mastery levels). 55 flagged items. All three major defects present: POOL-CONTAM (19 items), POS-TELL (10 items), LENGTH-TELL (23 items). Same structural root cause as A1/A2. A notable case is `pendiente` — a homograph with both noun and adjective senses — appearing with verb distractors, making it a dual POS-TELL issue.

---

### spanish_b1_grammar
**Severity:** B0 M3 m0 N1  |  **Findings:** [link](../data/audits/findings/spanish_b1_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_b1_grammar.md)

69 quiz items sampled (23 facts × 3 mastery levels). 6 flagged items — the second-cleanest grammar deck (only B2 has fewer). All 69 items use `_fallback` fill-in-blank template. Issues are localized to a single pool (`si_clause_patterns`) and consist of SYNTHETIC-WEAK (3 items) and LENGTH-TELL (3 items) from the same root cause: synthetic distractors are meta-linguistic grammar labels rather than valid fill-in-blank forms.

---

### spanish_b2
**Severity:** B2 M3 m2 N0  |  **Findings:** [link](../data/audits/findings/spanish_b2.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_b2.md)

90 quiz items sampled (30 facts × 3 mastery levels). 39 flagged items. POOL-CONTAM (13 items) and LENGTH-TELL (22 items) persist. POS-TELL reduced to 2 items — the lowest among A-B vocab decks — likely because B2's noun-heavy pool (596/964 = 62%) draws noun distractors more consistently. One recurring anomalous distractor ("banking") appears across multiple unrelated question contexts.

---

### spanish_b2_grammar
**Severity:** B0 M0 m0 N0  |  **Findings:** [link](../data/audits/findings/spanish_b2_grammar.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_b2_grammar.md)

75 quiz items sampled (25 facts × 3 mastery levels). Zero flagged items. B2 grammar is the cleanest deck in the entire Spanish collection. All 75 items use `_fallback` fill-in-blank template. No LENGTH-TELL, no SELF-ANSWERING, no SYNTHETIC-WEAK, no POOL-CONTAM detected. The structural improvements — consistent 10-synthetic-distractor padding per pool, fine-grained pool splitting (25 pools for 176 facts), and careful pool naming — appear to have eliminated the systemic issues found at A1–B1 levels.

---

### spanish_c1
**Severity:** B5 M3 m2 N0  |  **Findings:** [link](../data/audits/findings/spanish_c1.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_c1.md)

180 quiz items sampled (60 facts × 3 mastery levels). 74 flagged items. LENGTH-TELL dominates (58 items) — the highest absolute count of any deck, driven by C1's extreme answer-length variance (single-word cognates like "civil" vs multi-word definitions). Three confirmed FACTUAL-SUSPECT BLOCKER cases: `donde`→"because", `habitual`→"beans", and `sino` POS mis-tagging. These suggest a row-alignment error in the data pipeline.

---

### spanish_c2
**Severity:** B3 M2 m2 N1  |  **Findings:** [link](../data/audits/findings/spanish_c2.md)  |  **Expectations:** [link](../data/audits/expectations/spanish_c2.md)

90 quiz items sampled (30 facts × 3 mastery levels). 17 flagged items — lowest total among vocab decks. C2 is the most structurally sophisticated vocab deck: it has chain themes, a `spanish_words` pool for reverse mode, and 10 synthetic distractors in `english_meanings`. The primary issues are POOL-CONTAM in reverse mode (9 items) and LENGTH-TELL (7 items). No POS-TELL detected. No factual accuracy issues found.

---

### test_world_capitals
**Severity:** B0 M1 m2 N1  |  **Findings:** [link](../data/audits/findings/test_world_capitals.md)  |  **Expectations:** [link](../data/audits/expectations/test_world_capitals.md)

30 facts in a single `capital_names` pool — a test fixture deck. Quiz dump covers 30 unique facts × 3 mastery levels = 90 rows. The single-pool architecture creates a severe LENGTH-TELL problem: pool ratio 6.2× (Bern at 4 chars vs Sri Jayawardenepura Kotte at 25 chars). Questions about unusual capitals are identifiable by answer length alone. Factually accurate throughout.

---

### us_presidents
**Severity:** B1 M2 m4 N0  |  **Findings:** [link](../data/audits/findings/us_presidents.md)  |  **Expectations:** [link](../data/audits/expectations/us_presidents.md)

US Presidents is a clean, accessible deck with the simplest pool structure in the batch (104 of 126 facts answer with a president name). Distractor quality in the `president_names` pool is good — drawing plausible wrong presidents as co-distractors. However, a BLOCKER-level factual error exists: the Reagan fact incorrectly claims he "presided over the end of the Cold War as the Soviet Union dissolved in 1991" — Reagan left office January 1989 and the USSR dissolved December 1991 under George H.W. Bush.

---

### us_states
**Severity:** B0 M2 m3 N1  |  **Findings:** [link](../data/audits/findings/us_states.md)  |  **Expectations:** [link](../data/audits/expectations/us_states.md)

75 facts across 4 regional sub-decks. Quiz dump covers 30 unique facts × 3 mastery levels = 90 rows. All multi-choice rendering works correctly. The `{N}` bracket syntax in correctAnswer renders as a bare number in quiz output. Several pool-level and question-level issues identified.

---

### world_capitals
**Severity:** B0 M1 m2 N1  |  **Findings:** [link](../data/audits/findings/world_capitals.md)  |  **Expectations:** [link](../data/audits/expectations/world_capitals.md)

168 facts, all `quizResponseMode: "map_pin"`. The quiz dump shows `templateId: passthrough` with single-element option arrays for every row — text-based multi-choice quiz is never rendered. The 4 answer pools are not exercised by any quiz template in the dump. Findings are structural issues detectable from the JSON; no eliminability or distractor-quality issues can be assessed since no multi-option quiz renders.

---

### world_countries
**Severity:** B0 M1 m2 N0  |  **Findings:** [link](../data/audits/findings/world_countries.md)  |  **Expectations:** [link](../data/audits/expectations/world_countries.md)

168 facts, all `quizMode: "image_question"`. The quiz dump shows `templateId: passthrough` with single-element option arrays for all 90 rows — no multi-choice text rendering occurs. The rendered question is always "Which country is highlighted on this map?" — duplicate across all facts by design. No distractor quality issues can be assessed from the dump. Findings are structural, derived from deck JSON.

---

### world_cuisines
**Severity:** B0 M2 m3 N1  |  **Findings:** [link](../data/audits/findings/world_cuisines.md)  |  **Expectations:** [link](../data/audits/expectations/world_cuisines.md)

141 facts across 4 sub-decks. Quiz dump covers 30 unique facts × 3 mastery levels = 90 rows. The primary issue is the `technique_terms_short` pool, which contains at least 8 semantically incompatible answer types, producing incoherent distractor sets. The `date_facts_short` pool mixes a month name with year strings. Several factual nuance issues are flagged.

---

### world_flags
**Severity:** B0 M1 m1 N1  |  **Findings:** [link](../data/audits/findings/world_flags.md)  |  **Expectations:** [link](../data/audits/expectations/world_flags.md)

197 facts, all `quizMode: "image_question"`. The quiz dump shows `templateId: passthrough` with single-element option arrays for all 90 rows — no multi-choice rendering. No distractor quality, eliminability, or pool contamination can be assessed from this dump. Findings are structural.

---

### world_literature
**Severity:** B0 M2 m3 N2  |  **Findings:** [link](../data/audits/findings/world_literature.md)  |  **Expectations:** [link](../data/audits/expectations/world_literature.md)

200 facts, 14 pools. Two structural pool problems dominate this deck. First, the `publication_years` pool is misnamed and contaminated: it contains line counts, structural counts (books, circles, tales), a calendar date, and years — seven incompatible numeric value types. Second, the `genre_form_names_short` pool is severely contaminated with semantically incompatible entries: "himself", "jealousy", "Old English", "Newspeak", "blank verse" as co-distractors.

---

### world_religions
**Severity:** B0 M1 m0 N0  |  **Findings:** [link](../data/audits/findings/world_religions.md)  |  **Expectations:** [link](../data/audits/expectations/world_religions.md)

75 quiz dump entries (25 facts × 3 mastery levels). One MAJOR LENGTH-TELL issue and one NIT (duplicate pool ID). Cross-religion contamination was investigated and found to be functional at the distractor level — distractors from different religions appear but remain plausible wrong answers in context.

---

### world_war_ii
**Severity:** B0 M2 m6 N0  |  **Findings:** [link](../data/audits/findings/world_war_ii.md)  |  **Expectations:** [link](../data/audits/expectations/world_war_ii.md)

World War II is a large, factually rich deck with good date distractor quality — WWII-era dates appearing as distractors for other WWII-era date questions is appropriate and challenging. The major structural issues are: "Eight weeks" (a duration) sitting in `year_dates` pool alongside actual dates — FORMAT-TELL and POOL-CONTAM; the raw number "338226" rendering without comma formatting; and date distractors at mastery=0 sometimes including very-early-20th-century dates outside the WWII period.

---

### world_wonders
**Severity:** B1 M4 m3 N1  |  **Findings:** [link](../data/audits/findings/world_wonders.md)  |  **Expectations:** [link](../data/audits/expectations/world_wonders.md)

195 facts across 8 sub-decks. Quiz dump covers 30 unique facts × 3 mastery levels = 90 rows, all with multi-choice rendering. Multiple pool contamination issues cause semantically incoherent distractor sets at higher mastery levels. The most severe issue is "West" (a cardinal direction) appearing as a distractor in a material-type question.

---

## Appendix A — Issue taxonomy reference

| Code | One-line description |
|------|---------------------|
| LENGTH-TELL | Correct answer identifiable by visual character length relative to distractors |
| POS-TELL | Correct answer identifiable by part of speech (verb answer among noun distractors) |
| CATEGORY-TELL | Correct answer identifiable by thematic/era/domain category (wrong century distractors) |
| SELF-ANSWERING | Correct answer appears verbatim or near-verbatim in the question stem |
| AMBIGUOUS-Q | Multiple distractors could be plausibly correct; question does not uniquely determine one answer |
| FACTUAL-SUSPECT | Correct answer is likely or confirmed factually wrong based on external reference |
| BROKEN-GRAMMAR | Question stem is grammatically malformed and cannot be parsed normally (e.g., "this" artifacts) |
| DUPLICATE-OPT | Two options in the same question are identical or near-identical |
| SYNONYM-LEAK | A distractor is a close synonym, partial match, or subset of the correct answer |
| POOL-CONTAM | Distractors from semantically incompatible sub-domains appear in the same option set |
| TEMPLATE-MISFIT | Template's question type does not match the answer type stored in the fact |
| SYNTHETIC-WEAK | Synthetic distractors are generic labels, meta-linguistic terms, or obviously wrong |
| NUMERIC-WEAK | Numeric distractors are implausible (wrong scale, wrong unit, wrong era) |
| IMAGE-BROKEN | Image-quiz facts fail to generate distractors; render as trivially correct single-option |
| CHESS-BROKEN | Chess fact has corrupt FEN, invalid move notation, or impossible board position |
| MAP-BROKEN | Map-pin fact has incorrect coordinates, missing region, or broken passthrough render |
| QUIZMODE-WRONG | Fact's quizMode setting does not match the intended question presentation |
| EXPLANATION-MISSING | Explanation field is absent, too short, or is a placeholder that does not teach the fact |
| OTHER | Miscellaneous issue not captured by the above codes |

---

## Appendix B — Severity scale

- **BLOCKER** — Would confuse or mislead a player on most renderings, or makes a question unanswerably broken. Includes: unresolved template placeholders ("this" artifacts, "anatomical structure"), confirmed factual errors, broken rendering (image producing 0 distractors, chess corrupt FEN), and SELF-ANSWERING cases where the answer appears verbatim in the question stem. Fix before shipping.
- **MAJOR** — Trivially eliminable distractors that a player with domain knowledge can dismiss without knowing the specific answer. Includes: strong POS-TELL, cross-era/domain POOL-CONTAM, confirmed SELF-ANSWERING via explanation text, strong SYNONYM-LEAK, factual suspicion without full confirmation. Degrades learning value.
- **MINOR** — Distractors that still provide some challenge but are weakened. Includes: mild length disparity (ratio < 3×), missing explanations where not critical, small pool sizes relying heavily on synthetics, numeric distractors with moderate implausibility. Does not break the quiz; reduces effectiveness.
- **NIT** — Stylistic concerns only. Includes: capitalization inconsistencies, duplicate pool IDs with no functional impact, redundant pool definitions. No player impact.

---

## Appendix C — Harness reference

The audit harness is `scripts/audit-dump-samples.ts`. It imports real engine primitives — `renderQuizItem()`, `selectDistractors()`, `applyTemplate()` — from `src/services/` and runs them at mastery levels 0, 2, and 4 against stratified fact samples. Raw output is written to `data/audits/quiz-dumps/<deckId>.jsonl`, one line per rendered quiz instance. Each line contains: `factId`, `masteryLevel`, `templateId`, `questionStem`, `correctAnswer`, `options[]`, and `issueFlags[]`.

To re-run the audit for a single deck:
```bash
npx tsx scripts/audit-dump-samples.ts --deck <deckId> --mastery 0,2,4 --sample 30
```

To re-run the full audit:
```bash
npx tsx scripts/audit-dump-samples.ts --all --mastery 0,2,4
```

Per-deck findings files live under `data/audits/findings/`. Per-deck expectations files live under `data/audits/expectations/`. Raw JSONL dumps live under `data/audits/quiz-dumps/`. See `docs/testing/strategy.md` for the full harness documentation and integration with the deck quality pipeline.

---

*End of report. All per-deck detail is in `data/audits/findings/`. This file is a read-only diagnostic snapshot — no fixes were applied.*
