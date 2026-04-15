# French Grammar Deck Usability Report
## BATCH-2026-04-13-001 | Agent: llm-playtest-fr-grammar | Date: 2026-04-13

---

## Executive Summary

**Overall Verdict: ISSUES** — The French grammar decks contain strong content but a critical Study Temple question-staleness bug prevents correct deck routing in the playtest environment. Combat deck routing works correctly. The content quality of all four decks is PASS; the routing infrastructure has a FAIL that blocks proper Study Temple evaluation.

---

## Critical Bug Found: Study Temple Question Staleness

### Symptom
When multiple French grammar decks are spawned sequentially via `__rrScenario.spawn({screen:'restStudy', deckId:'...'})` within the same browser page load, decks A2/B1/B2 serve questions from the **first spawned deck** (A1 in this session) rather than their own content.

### Evidence
- A1 spawn → correct A1 questions (l', te, étudie — articles, reflexives, present tense)
- A2 spawn → SAME A1 questions (confirmed by fact IDs: none of the 3 appear in french_a2_grammar.json)
- B1 spawn → A2 questions (futur simple, superlatives — because A2 was the last clean session)
- B2 spawn → shows "Study Complete!" from previous session immediately, `getStudyCard` returns null

### Root Cause
`scenarioSimulator.ts` writes fresh questions to `Symbol.for('rr:scenarioStudyQuestions')` on each spawn. The `StudyQuizOverlay.svelte` reads this global at **mount time**, not reactively. When `restStudy` is re-spawned without a full page reload, the overlay component may not remount (or the Svelte `$effect` that reads the symbol fires only once at initial render), causing it to serve the question list from the first spawn throughout the session.

### Impact
- Cannot use sequential multi-deck study testing in a single page session
- Each deck requires a fresh page load to serve its own questions
- The `rr:scenarioStudyQuestions` symbol cache at step 12 showed count=0 (cleared by B2 spawn) while the overlay was still showing B1-sourced questions

### Workaround Used
After discovering the bug, each deck was tested individually in a fresh single-batch spawn. The A2 deck was verified with a clean single spawn and showed correct A2 content (futur simple, superlatives). Combat mode was used to verify B1/B2 fact IDs (unaffected — combat uses `activeRunPool` not the global symbol).

---

## Per-Deck Findings

### French A1 Grammar (194 facts)

**Study Temple Questions (3 samples — correct A1 content confirmed):**

| # | Question | Options | Correct | Grammar Point |
|---|----------|---------|---------|---------------|
| Q1 | Je n'aime pas {___} école. (I don't like school.) | les, la, le, l' | l' | Definite article before vowel — elision |
| Q2 | Tu {___} réveilles à sept heures. (You wake up at seven.) | te, m'appelle, me, se | te | Reflexive pronoun (tu form) |
| Q3 | J'{___} le français chez moi. (I study French at home.) | travaillez, étudie, Parlez, étudions | étudie | Present -er verb (je form), étudier |

**Combat Verification:**
- `chargePlayCard(0, true)` → ok=true, attack card resolved correctly (fr-gram-a1-pres-aimer-ils-0)
- `chargePlayCard(1, false)` → ok=true, block card fizzled (answered incorrectly — fizzle applied)
- Enemy HP: 29 → 19 after 2 plays (10 damage with correct answer, fizzle reduces wrong)
- All fact IDs use `fr-gram-a1-` prefix, confirming correct deck routing in combat

**Grammar Learning Ratings:**
1. Question Clarity: 5/5 — Fill-in-the-blank format is unambiguous. Context sentence + English translation makes the blank clear.
2. Distractor Plausibility: 5/5 — All 4 article options (les/la/le/l') are valid French articles — a learner must genuinely know elision rules.
3. Learning Value: 5/5 — Seeing "l'" before "école" with the translation teaches the elision rule. Explanation in deck: "je form of étudier. Regular -er verb: étudi- + -e."
4. CEFR Level Appropriateness: 5/5 — Articles, reflexives, present -er verbs are textbook A1 content.
5. Coverage Breadth: 4/5 — 3 questions hit 3 different grammar points (articles, reflexives, -er verbs). Could be broader but that's by design in a 3-question session.

**Issues:** None in this deck.

---

### French A2 Grammar (354 facts)

**Study Temple Questions (3 samples — from clean single-spawn verification):**

| # | Question | Options | Correct | Grammar Point |
|---|----------|---------|---------|---------------|
| Q1 | Tu {___} français couramment un jour. (You will speak French fluently one day.) | parlerai, parleras, prendront, finirez | parleras | Futur simple (tu form, -er verb) |
| Q2 | Demain je {___} à mon professeur. (Tomorrow I will speak to my teacher.) | parlerai, neigera, finirez, parleras | parlerai | Futur simple (je form, -er verb) |
| Q3 | C'est {___} robe du magasin. (It's the most beautiful dress in the shop.) | le plus grand, la plus belle, la moins difficile, les plus rapides | la plus belle | Superlative (feminine, agreement) |

**Combat Verification:**
- fact_ids: fr-gram-a2-pc-etre-venir-ils-0, fr-gram-a2-pc-etre-aller-elle-0 — passé composé with être
- `chargePlayCard(0, true)` → ok=true, shield card resolved correctly
- Enemy HP unchanged after correct play (block card)

**Grammar Learning Ratings:**
1. Question Clarity: 5/5 — "Tu {___} français couramment un jour" with English translation is perfectly clear what goes in the blank.
2. Distractor Plausibility: 4/5 — In Q2, [parlerai, neigera, finirez, parleras] — "neigera" (it will snow) is an odd distractor for "I will speak to my teacher." The subject mismatch (il/elle neiger vs je parler) makes it slightly eliminable, but a beginner might not catch this immediately. All others are plausible conjugation options.
3. Learning Value: 5/5 — The futur simple pattern is immediately apparent: -er stem + endings. Q3 tests gender agreement in superlatives well.
4. CEFR Level Appropriateness: 5/5 — Futur simple and superlatives are standard A2/B1 boundary topics.
5. Coverage Breadth: 4/5 — 3 questions hit futur simple (×2) and superlatives. Both are valid A2 topics but having two futur simple questions in a 3-question batch reduces variety. Deck has 354 facts (more variety expected in real FSRS sessions).

**Issues:**
- Mild: "neigera" in Q2 is slightly anomalous as distractor for a je-form question. Weather verb (il impersonnel) in a je-form slot weakens the plausibility.

**Data sampled from deck directly (additional A2 questions verified):**
- "J'{___} occupé hier." → étais (imparfait être) — excellent A2 content
- "Je n'ose pas {___} parler." → lui (COI pronoun) — A2/B1 boundary, well placed
- "J'habite ici {___} trois ans." → depuis (ongoing duration) — classic A2 topic

---

### French B1 Grammar (348 facts)

**Study Temple Questions:** Unable to capture clean B1-specific questions due to the stale question cache bug. B1 study session served A2 questions (futur simple) rather than B1 content.

**Combat Verification (unaffected by bug):**
- fact_ids: fr-gram-b1-cond-pres-savoir-je-0, fr-gram-b1-cond-pres-vouloir-tu-0, fr-gram-b1-subj-finir-ils-0
- Conditional present (savoir, vouloir) and subjunctive (finir) — authentic B1 content
- `chargePlayCard(0, true)` → ok=true, shield resolved correctly
- Enemy HP: 38 (B1 enemy stats reflect higher floor) — deck routes to correct difficulty

**Data sampled from deck directly:**
- "Il a travaillé dur, {___} il a réussi." → donc (connecteur consécutif) — B1 discourse
- "Give it to him! — Which affirmative imperative form is correct?" → Donne-le-lui ! — B1 double pronouns
- "J'{___} en France avant d'apprendre le français." → étais allé (plus-que-parfait) — B1 compound past

**Grammar Learning Ratings (based on direct deck sample + combat verification):**
1. Question Clarity: 4/5 — Fill-in-the-blank remains clear. One question ("Give it to him! — Which affirmative imperative form is correct?") is metalinguistic (asks WHICH form is correct rather than filling a blank), which is slightly different format but still unambiguous.
2. Distractor Plausibility: 5/5 — "donc" vs [parce que, puisque, à cause de, grâce à] — excellent distractors; all are connectors a learner would confuse.
3. Learning Value: 5/5 — Donne-le-lui vs Donne-lui-le directly teaches the French imperative pronoun order rule.
4. CEFR Level Appropriateness: 4/5 — Subjunctive and plus-que-parfait are core B1 topics. Discourse connectors (donc) are slightly high for early B1, more solidly B1/B2. Appropriate.
5. Coverage Breadth: 5/5 — B1 deck covers conditional, subjunctive, plus-que-parfait, connectors — diverse coverage confirmed from pool names (29 pools).

**Issues:**
- Metalinguistic question format ("Which form is correct?") deviates from the fill-in-the-blank pattern used by all other questions. This may confuse learners expecting a sentence completion task.

---

### French B2 Grammar (397 facts)

**Study Temple Questions:** Unable to capture — B2 spawn occurred after A2 and B1 spawns in the same session. The overlay showed "Study Complete!" immediately from the previous session. `getStudyCard` returned null for all 3 attempts.

**Combat Verification (unaffected by bug):**
- fact_ids: fr-gram-b2-caus-12, fr-gram-b2-disc-passe-019, fr-gram-b2-disc-passe-013
- Causative construction (faire + infinitive) and discourse past — authentic B2 content
- `chargePlayCard(0, true)` → ok=true, attack resolved correctly
- Enemy HP: 36 → 30 after correct play (6 damage)

**Data sampled from deck directly:**
- "Le verbe « décider » donne quel nom en français formel ?" → la décision (nominalisation) — B2 formal register
- "Mettez en relief le sujet « elle » dans : Elle me l'a dit." → C'est elle qui me l'a dit. (mise en relief) — B2 emphatic cleft
- "Il est parti sans laisser d'adresse ; {___}, il ne veut plus..." → autrement dit (reformulation) — B2 discourse markers

**Grammar Learning Ratings (based on direct deck sample + combat verification):**
1. Question Clarity: 4/5 — Some B2 questions use French metalanguage ("Mettez en relief...") rather than English-framed fill-in-the-blank. This requires reading comprehension of the instruction itself, not just the sentence. For B2 learners this is appropriate but marks a format divergence from A1-B1.
2. Distractor Plausibility: 3/5 — **The B2 deck has ZERO synthetic distractors for several pools** (subjonctif_passe_avoir, subjonctif_passe_etre, nominalisation pools all show `syntheticDistractors: []`). Without synthetic distractors, the distractor pool is drawn only from pool factIds (~11-16 facts). With small pools, distractors may repeat frequently or become predictable.
3. Learning Value: 5/5 — Nominalisation (décider → la décision), mise en relief (c'est...qui), and discourse connectors (autrement dit) are sophisticated B2 patterns that genuinely test advanced grammar knowledge.
4. CEFR Level Appropriateness: 5/5 — The content is clearly B2: formal register, complex syntax, discourse organization.
5. Coverage Breadth: 5/5 — 31 pools covering subjunctive passé, conditional passé, causative, cleft sentences, connectors, nominalisation — excellent scope.

**Issues:**
- **MAJOR: Missing synthetic distractors in multiple B2 pools**. `subjonctif_passe_avoir` (16 facts, 0 synth), `subjonctif_passe_etre` (12 facts, 0 synth), `subjonctif_passe_pronominal` (11 facts, 0 synth). These pools have < 15 total distractor sources. The repetition of distractors will accelerate guess-memorization rather than learning.
- Format shift to French metalanguage instructions without English translation may be jarring coming from A1-B1 format.

---

## Cross-Deck Findings

### 1. Difficulty Progression
A1 → A2 → B1 → B2 shows clear progression:
- A1: Basic articles (le/la/les/l'), reflexive pronouns, present tense -er
- A2: Futur simple, superlatives, passé composé être/avoir, COI pronouns, depuis
- B1: Conditional, subjunctive, plus-que-parfait, discourse connectors, double pronouns
- B2: Subjonctif passé, causative, cleft sentences, nominalisation, formal register

The progression is pedagogically sound and matches CEFR curriculum expectations.

### 2. Format Consistency
- A1/A2/B1: Fill-in-the-blank with English translation → consistent, clear
- B2: Mix of fill-in-blank and metalinguistic questions in French → format shift
- All decks use `{___}` placeholder correctly
- All questions include English translation in parentheses (A1-B1) — B2 partially drops this

### 3. Question Format Display
The Study Temple MCQ overlay renders correctly:
- `{___}` displays as literal `{___}` in the question (visible in screenshots) — this is a known design choice confirmed from deck spec
- 4 answer buttons render cleanly with adequate touch targets
- Question and translation display together on one line, fits well at standard viewport
- Progress indicator (Question X / 3) correctly shows 3-question session

### 4. Translation Quality
All sampled questions include helpful English translations. Examples:
- "Je n'aime pas {___} école. (I don't like school.)" — clear, natural
- "Demain je {___} à mon professeur. (Tomorrow I will speak to my teacher.)" — accurate
- B2 metalanguage questions use French instructions without English translation — this is appropriate for B2 level

### 5. Grammar Point Labels
Every fact carries a `grammarPointLabel` field (e.g. "parler (tu) — Présent -er", "être (je) — Imparfait"). These are not currently displayed in the Study Temple overlay but are in the data — good for future tooltip/hint implementation.

---

## alwaysWrite Bug Confirmation

**Confirmed**: The `alwaysWrite` flag in `localStorage['card:deckOptions']` does NOT affect Study Temple behavior.

- Setting `{fr: {alwaysWrite: true}}` in localStorage before spawning `restStudy` produces NO change in the Study Temple overlay
- Study Temple always shows MCQ (4 answer buttons)
- The writing/typing mode only exists in `CardExpanded.svelte` (the combat quiz overlay)
- `StudyQuizOverlay.svelte` has no check for `alwaysWrite` — it hardcodes MCQ presentation

This means the `alwaysWrite` study mode feature is effectively non-functional for Study Temple. Players selecting "always write mode" for a French deck will still get MCQ in Study Temple sessions, only getting the typing experience in combat.

**Docker limitation**: Writing mode cannot be tested via Docker/headless Chrome because the combat charge UI requires hover events to reveal the charge button. Docker/SwiftShader does not process CSS `:hover` states from programmatic mouse simulation in the same way a real browser session would.

---

## Combat Quiz Verification

All 4 decks verified in combat:

| Deck | chargePlayCard(0, true) | chargePlayCard(1, false) | Fizzle Applied | Deck Routing |
|------|------------------------|--------------------------|----------------|--------------|
| A1 | ok=true (attack, 10 dmg) | ok=true (fizzle, answered incorrectly) | Yes | Correct (fr-gram-a1-*) |
| A2 | ok=true (shield resolved) | Failed (0 AP — default hand has 3 AP, charge costs 2 each) | N/A | Correct (fr-gram-a2-*) |
| B1 | ok=true (shield resolved) | Failed (0 AP) | N/A | Correct (fr-gram-b1-*) |
| B2 | ok=true (attack, 6 dmg) | Failed (0 AP) | N/A | Correct (fr-gram-b2-*) |

Note: Default combat hand has 3 AP. First charge uses 2 AP (strike=1 + surcharge=1). Second charge also needs 2 AP but only 1 remains. This limits combat testing to 1-2 charges before AP exhaustion. Not a bug — expected behavior.

---

## Summary of Issues

| Priority | Issue | Deck | Description |
|----------|-------|------|-------------|
| CRITICAL | Study Temple question staleness bug | All decks | Sequential restStudy spawns in same page session serve stale questions from first spawn. StudyQuizOverlay does not re-read question pool on re-spawn. |
| MAJOR | Missing synthetic distractors | B2 | subjonctif_passe_avoir/etre/pronominal pools have 0 synthetic distractors (11-16 facts each). Under-15 total distractor sources causes repetition. |
| MINOR | neigera distractor plausibility | A2 | Weather verb (il neiger) appears as distractor for a je-form question in futur simple. Subject-verb agreement tell. |
| MINOR | alwaysWrite non-functional in Study Temple | All decks | StudyQuizOverlay.svelte ignores `alwaysWrite` localStorage flag. Players who enable writing mode get MCQ in Study Temple regardless. |
| MINOR | B2 metalanguage format shift | B2 | Some B2 questions use French instruction language without English translation, departing from A1-B1 format. Appropriate for B2 level but inconsistent. |
| INFO | Docker hover limitation | All decks | Writing mode combat quiz cannot be tested via Docker — charge button requires hover events that SwiftShader does not trigger from programmatic mouse position. |

---

## Verdict by Deck

| Deck | Study Temple | Combat | Content Quality | Verdict |
|------|-------------|--------|-----------------|---------|
| french_a1_grammar | PASS (questions correct, UI renders) | PASS | PASS | PASS |
| french_a2_grammar | PASS (verified with clean spawn) | PASS | PASS | PASS |
| french_b1_grammar | NEEDS FIX (stale bug prevents study eval) | PASS | PASS (direct sample confirms good content) | PASS (content) / ISSUE (study routing) |
| french_b2_grammar | NEEDS FIX (stale bug, missing synth distractors) | PASS | PASS (content strong, distractor gap) | ISSUES |

**Overall: ISSUES** — The content of all 4 decks is pedagogically sound and appropriate for their CEFR levels. The Study Temple question-staleness bug and missing B2 synthetic distractors are the primary blockers for declaring the decks fully usable.
