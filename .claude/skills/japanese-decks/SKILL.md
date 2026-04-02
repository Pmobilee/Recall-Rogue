---
name: japanese-decks
description: Manage Japanese language decks — vocabulary, kanji, and grammar across JLPT N5-N1. Build, audit, fix, and validate Japanese content. PROACTIVELY SUGGEST when any Japanese language content work is discussed.
model: sonnet
---

# Japanese Decks — Complete Reference

Single source of truth for all Japanese language content in Recall Rogue. Covers vocabulary, kanji, and grammar decks across JLPT N5-N1.

## When to Use This Skill

- Building new Japanese decks (any JLPT level, any content type)
- Auditing existing Japanese deck quality
- Fixing distractor issues, vocabulary level problems, or extraction bugs
- Adding features to the Japanese quiz experience (hover dict, typing mode, hints)
- Any work touching Japanese language files

## Current Deck Inventory

| Deck File | Type | Facts | Status |
|-----------|------|-------|--------|
| `japanese_hiragana.json` | Kana | - | Shipped |
| `japanese_katakana.json` | Kana | - | Shipped |
| `japanese_n5.json` | Vocabulary | - | Shipped |
| `japanese_n4.json` | Vocabulary | - | Shipped |
| `japanese_n3.json` | Vocabulary | - | Shipped |
| `japanese_n3_grammar.json` | Grammar | 670 | Shipped (audited 2026-03-29) |
| `japanese_n4_grammar.json` | Grammar | 401 | Shipped 2026-04-02 (fill-blank, 133 points) |
| `japanese_n5_grammar.json` | Grammar | 375 | Shipped (fill-blank, 90 points) |
| `japanese_n2.json` | Vocabulary | - | Shipped |
| `japanese_n1.json` | Vocabulary | - | Shipped |

## Source Data

### Authoritative Sources (CC BY-SA 4.0)
- **Full Japanese Study Deck (FJSD)**: github.com/Ronokof — grammar points, vocab, kanji
- **Tatoeba Corpus**: CC-BY 2.0 — example sentences with translations
- **Tanaka Corpus**: CC-BY-SA 3.0 — additional example sentences
- **JMdict/EDICT**: CC-BY-SA 4.0 — 214K+ Japanese-English dictionary entries
- **takoboto.jp**: Per-grammar-point reference URLs

### Reference Data Locations
| Data | Path |
|------|------|
| JLPT word lists | `data/references/jlpt/n{1-5}.csv` |
| FJSD grammar source | `data/references/full-japanese-study-deck/results/grammar/json/grammar_n{1-5}.json` |
| FJSD vocab IDs | `data/references/full-japanese-study-deck/results/vocabJLPT/ids/vocab_n{1-5}.json` |
| Confusion groups (N3) | `data/raw/japanese/grammar-n3-confusion-groups.json` |
| Confusion groups (N4) | `data/raw/japanese/grammar-n4-confusion-groups.json` |
| Sentences (N4) | `data/raw/japanese/grammar-n4-sentences.json` |
| Sentences (N5) | `data/raw/japanese/grammar-n5-sentences.json` |
| Confusion groups (N5) | `data/raw/japanese/grammar-n5-confusion-groups.json` |
| JMdict common | `data/references/jmdict/jmdict-eng-common-3.6.2.json` (22,576 entries) |
| JMdict compact | `public/assets/dict/jdict-compact.json` (37,956 entries, built for runtime hover) |
| Kuromoji dicts | `public/assets/kuromoji/*.dat.gz` (17MB, tokenizer dictionary files) |

## Grammar Deck Architecture (N3 — Reference Implementation)

The N3 grammar deck is the reference implementation. All future grammar decks (N4, N5, N2, N1) MUST follow this pattern.

### Fact Structure

Every grammar fact has these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | `ja-gram-{level}-{sourceId}-fill-{index}` |
| `correctAnswer` | Yes | The grammar pattern (or fragment for te-form) |
| `quizQuestion` | Yes | Japanese sentence with `{___}` blank + `\n(English with [hint])` |
| `explanation` | Yes | `"point (meaning) — full_sentence"` format |
| `grammarNote` | Yes | 1-2 sentence contextual explanation (Sonnet-generated, 80-150 chars) |
| `distractors` | Yes | 10 options, ALL from same syntactic slot |
| `answerTypePoolId` | Yes | Syntactic slot: particle_post_noun, sentence_ender, clause_connector, etc. |
| `displayAsFullForm` | If fragment | `true` for fragment answers — triggers tilde display |
| `fullFormDisplay` | If fragment | Canonical form (e.g., "てくれる") |
| `quizResponseMode` | Optional | `'choice'` (default) or `'typing'` |
| `language` | Yes | `"ja"` |
| `partOfSpeech` | Yes | `"grammar"` |
| `examTags` | Yes | `["JLPT_N3"]` etc. |

### Confusion Groups System

File: `data/raw/japanese/grammar-n3-confusion-groups.json`

Structure:
- **syntacticSlots** (9): particle_post_noun, sentence_ender, clause_connector, adverbial, te_form_auxiliary, verb_suffix, particle_post_verb, copula_form, conditional
- **confusionGroups** (40): Pedagogically meaningful clusters (e.g., degree_particles: さえ/しか/こそ)
- **grammarPoints** (200): Each with sourceId, syntacticSlots, confusionGroupIds, conjugationFamily
- **conjugationTable**: Te-form auxiliaries × 4 forms (past, polite, negative, past_negative)

### Distractor Quality Rules — CRITICAL

**Lesson learned (N3 audit, 2026-03-29):** 40-50% of initial distractors were obviously wrong by grammatical form. Students answered by elimination, breaking spaced repetition.

**Rule A: Syntactic Slot Filtering** — NEVER draw distractors from incompatible slots. Te-form question → te-form distractors only.

**Rule B: Conjugation Matching** — When answer is conjugated (てしまった), ALL distractors must match that conjugation form (ていた, てあった, てみた).

**Rule C: Confusion Group Priority** — (1) Same confusion group, (2) Same slot different group, (3) Broad pool within slot. Never cross-slot.

**Rule D: No Stem Giveaways** — Distractors must fit the preceding verb form. Don't include grammar that can't grammatically follow the stem.

### Fragment Answers — Tilde Display

For te-form facts where extraction produces fragments ("くれ" from "てくれる"):
- Set `displayAsFullForm: true` + `fullFormDisplay: "てくれる"`
- ALL quiz options shown as `~てくれる`, `~てあげる`, etc.
- NEVER mix tilde and non-tilde options

### English Meaning Hints

Every translation includes `[bracketed]` grammar function cue:
```
食べ過ぎて、イチゴ{___}食べられない。
(I am so full I could not [even] eat a strawberry.)
```

### Grammar Notes

Bold header (from explanation field) + contextual note (grammarNote field):
- **さえ (even; only; just)**
- Emphasizes an extreme case — even a strawberry, the easiest food, is impossible to eat here.

## Runtime Features

### Dictionary Hover (kuromoji.js + JMdict)

- **Service**: `src/services/japaneseTokenizer.ts` — lazy-loads kuromoji + compact JMdict
- **Component**: `src/ui/components/WordHover.svelte` — teal dotted underlines, tooltip on hover/tap
- **Preload**: Called when Japanese card is committed in CardCombatOverlay
- **Exclusion**: Correct answer word is NOT hoverable (prevents giveaway)
- Dict files: `public/assets/kuromoji/` (17MB .dat.gz) + `public/assets/dict/jdict-compact.json` (2MB)

### Typing Mode (wanakana)

- **Component**: `src/ui/components/GrammarTypingInput.svelte`
- **Library**: wanakana for romaji→hiragana live conversion
- **Validation**: Exact match + acceptable alternatives + politeness tolerance
- **Activation**: Per-fact via `quizResponseMode: 'typing'`, planned for mastery level 3+
- **Politeness tolerance**: Casual/formal differences not penalized (てしまう = てしまいます)

### Grammar Note Display

- **Component**: Grammar note panel in `CardExpanded.svelte`
- **Shows**: On ALL wrong answers when `grammarNote` is present
- **Format**: Bold header (from explanation field) + contextual 1-2 sentence note
- **Auto-resume**: +3000ms extra reading time when grammar note shown

## Build Pipeline

### Grammar Deck Build

Script: `scripts/content-pipeline/vocab/build-grammar-fill-blanks.mjs`

1. **Extract**: Fill-in-the-blank from FJSD example sentences (direct match → te-form pattern → partial compound)
2. **Distractors**: From confusion groups with syntactic slot filtering + conjugation matching
3. **Enrichment**: Sonnet workers generate `grammarNote` + English `[hint]` brackets
4. **Validation**: N3 vocab level check via `scripts/validate-n3-vocab.mjs`

### Vocabulary Deck Build

Scripts in `scripts/content-pipeline/vocab/`:
- `build-japanese-grammar-v2.mjs` — grammar deck generation
- `build-grammar-fill-blanks.mjs` — N3 fill-in-the-blank extraction (reference)
- `build-n4-grammar-fill-blanks.mjs` — N4 fill-in-the-blank extraction (401 facts)
- `build-n5-grammar-fill-blanks.mjs` — N5 fill-in-the-blank extraction (375 facts)
- `build-jdict-compact.mjs` — compact dictionary for runtime hover

### Quality Validation Scripts

| Script | Purpose |
|--------|---------|
| `scripts/validate-n3-vocab.mjs` | Cross-reference sentence vocab against JLPT word lists |
| `scripts/fix-te-form-distractors.py` | Fix te-form fragment answers + slot contamination |
| `scripts/build-jdict-compact.mjs` | Build compact dictionary for hover feature |

## Enforcement Checklist (Grammar Decks)

Before marking ANY grammar deck complete:

- [ ] Every fact has non-empty `grammarNote` (Sonnet-generated)
- [ ] Every `explanation` follows `"point (meaning) — sentence"` format
- [ ] Fragment answers use tilde display (`displayAsFullForm: true`)
- [ ] ALL distractors from same syntactic slot (zero cross-slot contamination)
- [ ] Conjugated answers have conjugation-matched distractors
- [ ] English translations include `[hint word]` for grammar function
- [ ] Vocabulary validated against target JLPT level
- [ ] `npm run typecheck` + `npm run build` + `npx vitest run` all pass
- [ ] Manual playtest: 10+ questions, distractors feel genuinely confusable
- [ ] Grammar notes are simple, sentence-specific, no distractor references

## N3 Audit Results (2026-03-29)

Reference data at `data/raw/japanese/n3-vocab-validation.json`:
- 670 total facts, 200 grammar points
- 350 clean (all vocab N3-and-below), 282 flagged (many false positives from loanwords)
- 38 te-form auxiliary facts: 21 with tilde display, all with canonical-form distractors
- 620 cross-slot contamination fixes applied to non-te-form facts
- 670 Sonnet-quality grammar notes, 670 English hint brackets

## Future Work

- N4 grammar deck shipped (2026-04-02); N5 grammar deck shipped
- Enable typing mode at mastery level 3+ (currently opt-in per fact)
- Curate vocab validation results — replace genuinely difficult sentences
- Extend dictionary hover to vocabulary decks (not just grammar)
- Add conjugation table coverage beyond te-form (conditional, volitional, imperative)

## Grammar Deck Build Lessons (2026-03-28)

Critical lessons from the N3 Grammar fill-blank deck build:

### Quiz Rendering: THREE Components, Not One
Grammar fill-blank questions (`{___}` pattern) must be handled in ALL quiz rendering components:
1. **`CardExpanded.svelte`** — combat charge quiz (line ~529, has `{___}` detection via `isJapaneseFact && question.includes('{___}')`)
2. **`QuizOverlay.svelte`** — gate quiz / non-combat (has `isGrammarFillBlank` derived)
3. **`CardCombatOverlay.svelte`** — study mode quiz selection (uses `getStudyModeQuiz()`)

**If you add a new question format, you MUST verify it renders correctly in ALL THREE components.** Do not assume fixing one component fixes all rendering.

### Question Template Must Use Placeholders
The `questionFormat` field in `questionTemplates[]` must be `"{quizQuestion}"` — NOT a literal instruction string. The `renderTemplate()` function in `questionTemplateSelector.ts` only substitutes `{placeholder}` patterns. A literal string like `"Complete the sentence"` passes through unchanged and replaces the actual question.

### Multi-Line Quiz Questions
If `quizQuestion` contains `\n` (e.g., sentence + translation), the rendering component must split on `\n` and render separately. HTML does not render `\n` as line breaks. The grammar fill-blank handler splits with `question.split('\n')` and renders the translation as a separate `<p class="grammar-translation">`.

### Run Pool vs Quiz Pool Distinction
In study mode, `encounterBridge.ts` builds the **run pool** (what cards get dealt), while `CardCombatOverlay.svelte:getStudyModeQuiz()` selects **quiz questions** from `getCuratedDeckFacts(deckId, subDeckId)`. These are DIFFERENT pools. The run pool currently loads all facts for a language, not just the selected sub-deck. Quiz questions are correctly filtered. This means card `factId` values may not match the quiz shown — this is a pre-existing architectural issue, not a grammar deck bug.
