# Japanese N4 Grammar Deck — Provenance Documentation

**Deck ID**: `japanese_n4_grammar`
**Facts**: 400 fill-in-the-blank grammar facts (originally 401; 1 mislabeled fact deleted during QA)
**Grammar Points**: 133 (128 with extractable example sentences)
**Sources**: FJSD (CC BY-SA 4.0), JLPT Sensei (132-point reference list), Tatoeba (CC BY 2.0)
**Created**: 2026-04-03

---

## 1. Deck Structure

### Grammar Point Coverage

| Stat | Value |
|------|-------|
| Total grammar points | 133 |
| Points with extractable sentences | 128 |
| Sentences sourced | 428 |
| Confusion groups | 18 |
| Confusion slots per group | 12 |

### Synonym Groups

| Group ID | Members / Reason |
|----------|-----------------|
| syn_must | Multiple "must / have to" constructions — treated as acceptable alternatives |
| syn_appearance | Appearance/hearsay forms (〜そう, 〜らしい, 〜ようだ, 〜みたいだ) — context-dependent overlaps |
| syn_difficulty | 〜にくい / 〜づらい — near-synonymous "difficult to do" |
| syn_but_formal | 〜が / 〜けれども / 〜ところが — formal contrast conjunctions |
| syn_wonder | 〜かな / 〜かしら — wondering/self-questioning patterns |
| syn_reason | 〜から / 〜ので / 〜ため — causal/reason expressions with register variation |
| syn_conditional_ba_tara | 〜ば / 〜たら — conditional overlap zone |
| syn_favor | 〜てあげる / 〜てやる — doing a favor (register/register variation) |

---

## 2. Build Pipeline

### Phase 1 — Architecture

Architecture file: `data/deck-architectures/japanese_n4_grammar_arch.yaml`

Grammar point list compiled from JLPT Sensei 132-point N4 reference, cross-referenced with FJSD (28 matched points with source sentences). Tatoeba used for additional natural example sentences.

### Phase 2 — Sentence Sourcing

428 example sentences sourced and verified from FJSD and Tatoeba before generation. Workers received pre-verified sentences; they do NOT invent new Japanese sentences.

### Phase 3 — Confusion Groups

18 confusion groups built (12 slots each) to drive distractor selection. Groups cluster grammar points that are superficially similar or commonly confused by learners.

### Phase 4 — Fill-Blank Extraction

Script: `scripts/content-pipeline/vocab/build-n4-grammar-fill-blanks.mjs`

Extracted fill-in-the-blank questions from sourced sentences. Target grammar point becomes the blank; distractors drawn from the confusion group.

### Phase 5 — Distractor Generation

All distractors LLM-generated reading each specific question for plausibility. No distractors pulled from the `correct_answer` values of other facts (see `content-pipeline.md` rule).

### Phase 6 — QA Review

Script: `data/decks/_wip/japanese_n4_grammar/fix-qa.mjs`

**18 fixes applied:**
- 1 mislabeled fact deleted (grammar point incorrectly categorized, no clean fix possible)
- Synonym group enforcement: overlapping forms removed from each other's distractor pools, added to `acceptableAlternatives`
- Ambiguous blanks clarified (sentences where multiple correct answers were possible)
- Distractor pool rebuild after deletions

---

## 3. Known Remaining Issues

- 5 grammar points had no extractable sentences from the sourced corpus; they are omitted from this deck. A future pass could add hand-authored example sentences for these points.
- The 8 synonym groups cover the most common overlap zones but do not exhaustively handle all register-variation pairs.

---

## 4. Attribution

> Grammar structure sourced from JLPT Sensei N4 reference list. Example sentences from the Full Japanese Study Deck (FJSD, CC BY-SA 4.0) and Tatoeba (CC BY 2.0). Workers formatted pre-verified source data into DeckFact JSON — no sentences or grammar rules were invented from model training knowledge.
