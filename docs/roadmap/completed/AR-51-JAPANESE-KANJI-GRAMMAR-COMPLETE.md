# AR-51: Complete Japanese Kanji & Grammar Decks

**Status:** Pending
**Created:** 2026-03-16
**Depends on:** AR-49/50 (initial import done), AR-48 (empty subcats hidden)
**Estimated complexity:** High (data sourcing + Sonnet LLM generation for ~4,000+ facts)

---

## Part A: Kanji Deck Completion (~2,010 missing)

### Current State

| Level | Have | Expected | Gap |
|-------|------|----------|-----|
| N5 | 79 | ~100 | 21 |
| N4 | 164 | ~250 | 86 |
| N3 | 546 | ~620 | 74 |
| **N2** | **189** | **~1,000** | **811** |
| **N1** | **1,118** | **~2,136** | **1,018** |
| **Total** | **2,096** | **~4,106** | **~2,010** |

**UPDATE (2026-03-16)**: The "expected" counts (~4,100) from web sources are aspirational community estimates. The actual widely-used JLPT kanji mappings (KANJIDIC2 + davidluzgouveia/kanji-data) contain **2,230 kanji** with JLPT level assignments: N5=79, N4=167, N3=367, N2=373, N1=1,244. We now have **all 2,230** after programmatic expansion from the `davidluzgouveia/kanji-data` source (CC-licensed, KANJIDIC2-based). Kanji phase is COMPLETE.

### Data Sources

1. **kanji-info.json** (23,110 entries): Rich data with mnemonics, example words, readings
2. **JLPT level lists** (`data/references/full-japanese-study-deck/results/kanjiJLPT/kanji/`): Character lists per level
3. **KANJIDIC2** or `davidluzgouveia/kanji-data`: Comprehensive kanji dictionary with on/kun readings, meanings, stroke counts

### Strategy

1. Source a comprehensive JLPT kanji mapping (Joyo kanji → JLPT level) with ~4,100 kanji
2. Cross-reference with kanji-info.json for mnemonics and example words
3. Programmatically generate facts for kanji that have rich data in kanji-info.json
4. Sonnet workers fill in any remaining gaps (~500-1000 kanji without rich data)

### Kanji TODO

1. [ ] Download/source comprehensive JLPT kanji list with ~4,100 kanji mapped to levels
2. [ ] Write `scripts/content-pipeline/vocab/expand-japanese-kanji.mjs`:
   - Cross-reference JLPT list with kanji-info.json
   - Programmatically generate quiz facts for kanji with rich data
   - Output list of kanji WITHOUT rich data for Sonnet batch
3. [ ] Sonnet workers generate facts for remaining kanji (batches of 50)
4. [ ] QA spot-check 20 random kanji facts
5. [ ] Replace `src/data/seed/kanji-ja.json` with complete version
6. [ ] Rebuild DB, verify counts

---

## Part B: Grammar Deck — COMPLETE REBUILD

### Critical Quality Problem

**ALL 644 existing grammar facts are fundamentally broken.** Every single one uses the identical shallow format:

```
Q: What does the grammar pattern '～ている' mean?
A: ongoing action
```

This is **vocabulary memorization**, not grammar learning. It teaches players to recognize the English meaning of a pattern label — but doesn't teach them to actually USE the grammar. A player who "knows" all 644 facts would still not be able to form a single correct Japanese sentence.

### What Real Grammar Learning Requires

Each grammar point needs **multiple question types** that test different cognitive skills:

#### Type 1: Pattern Recognition (L2→L1)
```
Q: What does '～ています' express?
A: Ongoing action / current state
Distractors: Past tense, Desire to do, Ability to do
```
This is what we currently have — but it's only ONE piece.

#### Type 2: Pattern Recall (L1→L2)
```
Q: How do you express an ongoing action in Japanese?
A: ～ています
Distractors: ～ました, ～たい, ～られる
```
The reverse direction — can the player produce the pattern, not just recognize it?

#### Type 3: Sentence Completion (Fill-in-the-blank)
```
Q: 今、雨が___います。(It is raining now.)
A: 降って (ふって)
Distractors: 降った, 降る, 降れ
```
This tests whether the player can conjugate and apply the pattern in context. This is the **most important** type — it's where real grammar learning happens.

#### Type 4: Correct/Incorrect Usage
```
Q: Which sentence correctly uses ～たい (want to)?
A: 日本に行きたいです。(I want to go to Japan.)
Distractors: 日本に行きたいました。, 日本を行きたい。, 日本に行きたいする。
```
Tests whether the player can distinguish correct from incorrect usage.

#### Type 5: Nuance/Comparison
```
Q: What is the difference between ～たら and ～ば?
A: ～たら is for specific one-time events, ～ば is for general conditions
Distractors: [other wrong comparisons]
```
Higher-level understanding of when to use which similar pattern.

### Grammar Fact Model

Each grammar point should generate **2-3 facts** (not 1):

```json
// Fact 1: Meaning (L2→L1)
{
  "id": "ja-grammar-n5-teiru-meaning",
  "quizQuestion": "What does '～ている' express in Japanese?",
  "correctAnswer": "Ongoing action",
  "distractors": ["Past tense", "Desire", "Ability", "Permission", "Obligation", "Potential", "Passive"],
  "explanation": "～ている expresses an ongoing action or resulting state. Example: 食べている (is eating), 知っている (knows/is knowing)."
}

// Fact 2: Recall (L1→L2)
{
  "id": "ja-grammar-n5-teiru-recall",
  "quizQuestion": "Which pattern expresses an ongoing action in Japanese?",
  "correctAnswer": "～ている",
  "distractors": ["～ました", "～たい", "～られる", "～なければ", "～てもいい", "～そうだ", "～ようだ"],
  "explanation": "～ている combines the て-form of a verb with いる. Example: 雨が降っている (It is raining)."
}

// Fact 3: Sentence completion (fill-blank)
{
  "id": "ja-grammar-n5-teiru-usage",
  "quizQuestion": "今、本を___います。(I am reading a book now.)",
  "correctAnswer": "読んで",
  "distractors": ["読む", "読んだ", "読める", "読まれ", "読みたく", "読もう", "読めば"],
  "explanation": "読んでいます uses the て-form of 読む (yomu, to read) + います to express the ongoing action of reading.",
  "pronunciation": "いま、ほんを___います",
  "statement": "今（いま）、本（ほん）を___います。(I am reading a book now.)"
}
// NOTE: pronunciation field stores the full hiragana reading of the sentence
// so FuriganaText can render kanji with furigana above them.
// The statement field uses inline furigana format: 漢字（かんじ）
```

### Display Settings: Furigana & Romaji for Grammar

The existing `FuriganaText` component and deck options system already handle furigana/romaji display for vocabulary. This MUST carry over to grammar facts:

**Critical UX requirement**: A student studying N5 grammar may not know any kanji yet. If grammar sentence completion shows `今、本を___います。` without furigana, it becomes a kanji reading test instead of a grammar test.

**What Sonnet workers must include in grammar facts:**
- `pronunciation` field with the full reading of any kanji in the question/answer
- Example sentences in the `explanation` field must include furigana annotations
- For sentence completion facts: the sentence stem should be renderable with `FuriganaText` — meaning the fact needs a `reading` field or inline furigana markers

**Settings already exist** (Japanese deck options in `vocabulary.ts`):
- `furigana`: Show Furigana (default: ON) — hiragana above kanji
- `romaji`: Show Romaji (default: OFF) — romanized readings below

**TODO for grammar display:**
- [ ] Ensure `QuizOverlay.svelte` uses `FuriganaText` for grammar sentence completion questions, not plain text
- [ ] Grammar facts must store readings so furigana can render
- [ ] Consider adding a "Kana only" mode for absolute beginners (all kanji replaced with hiragana) — future enhancement

### Grammar Content Plan

**Step 1: Scrap existing grammar facts entirely.** They're all shallow meaning-only format. We'll regenerate from scratch.

**Step 2: Source comprehensive grammar point lists:**
- N5: ~80 points (particles, basic conjugations, desu/masu, te-form, past tense, basic adjective forms)
- N4: ~131 points (conditional forms, passive, causative, potential, giving/receiving, relative clauses)
- N3: ~182 points (formal/informal speech, compound sentences, advanced conditionals, hearsay, appearance)
- N2: ~200 points (literary forms, formal written expressions, nuanced conjunctions, advanced keigo)
- N1: ~224 points (classical grammar residue, academic/business expressions, rare conjunctions)

**Step 3: For each grammar point, use Sonnet workers to generate 2-3 facts:**
- Type 1 (meaning): always generated
- Type 2 (recall): always generated
- Type 3 (sentence completion): generated for N5-N3 (most value for learners), optional for N2-N1

**Expected output: ~817 grammar points × 2.5 facts each = ~2,040 grammar facts**

**Step 4: Sonnet worker prompt must include:**
- The grammar pattern (e.g., ～ている)
- Its meaning and usage rules
- Its formation/conjugation rules
- 2-3 example sentences with furigana
- JLPT level for difficulty calibration
- Instructions to generate 2-3 facts of different types
- Distractor requirements: other grammar patterns at the same JLPT level

### Grammar Distractor Strategy

Grammar distractors are harder than vocabulary distractors. They must be:
- **Same JLPT level** (don't mix N1 patterns as distractors for N5 questions)
- **Same grammatical category** when possible (conditional with conditional, particle with particle)
- **Plausible wrong conjugations** for sentence completion (e.g., wrong verb form, wrong particle)
- **NEVER English words** as distractors for a Japanese grammar question

For sentence completion distractors specifically:
- Use wrong conjugation forms of the SAME verb (e.g., 読む, 読んだ, 読める for a ～ている question about 読む)
- This tests whether the player knows the specific form needed

### Grammar TODO

1. [ ] **Audit and remove** existing 644 grammar facts from `grammar-ja.json` (or archive to `data/archived/`)
2. [ ] **Source comprehensive grammar lists**: Curate from reference data + open community lists
   - Compile master list: `data/curated/vocab/ja/grammar-points-master.json`
   - Each entry: `{ pattern, meaning, formation, examples[], jlptLevel }`
   - Target: ~817 grammar points across N5-N1
3. [ ] **Write Sonnet worker prompt template**: `scripts/content-pipeline/knowledge/grammar-worker-prompt.md`
   - Must produce 2-3 facts per grammar point
   - Must include sentence completion facts with correct Japanese conjugations
   - Must use level-appropriate distractors
4. [ ] **Batch grammar points** into groups of 20-30 per Sonnet worker
5. [ ] **Run Sonnet workers** (~30 workers for ~817 grammar points)
6. [ ] **Validate**: Check Japanese characters are correct, conjugations make sense, sentences are natural
7. [ ] **QA spot-check**: Test 30 random grammar facts in simulated quiz format
8. [ ] **Write to** `src/data/seed/grammar-ja.json` (new, complete)
9. [ ] **Rebuild DB**, verify deckbuilder shows Grammar per JLPT level

---

## Execution Log

### Completed
1. [x] **Kana Only display option** — added to Japanese deck settings (toggle in ⚙️). Replaces all kanji with hiragana for absolute beginners.
2. [x] **Kanji expansion** — sourced `davidluzgouveia/kanji-data` (CC-licensed, KANJIDIC2-based). 134 missing kanji generated PROGRAMMATICALLY with meanings, on/kun readings, strokes. Total: **2,230 kanji facts** covering every JLPT-assigned kanji.
3. [x] **Grammar complete rebuild** — built `build-japanese-grammar-v2.mjs`. Generated **1,687 multi-type facts** from 644 reference grammar points:
   - 644 meaning facts (L2→L1: "What does ～ている mean?")
   - 644 recall facts (L1→L2: "Which pattern means ongoing action?" → "～ている")
   - 399 sentence completion facts (fill-blank with real Japanese sentences + furigana readings)
4. [x] **QA spot-check** — 1,687 facts checked: 1 false positive only. Fill-blank quality excellent.
5. [x] **DB rebuilt** — 104,291 total facts

### Remaining (future)
6. [ ] **Grammar gap: N5 has only 16 points (need ~80), N4 only 32 (need ~131)** — requires sourcing additional grammar lists + Sonnet workers to generate the missing ~173 grammar points and their multi-type facts (~430 new facts). This is a separate AR.
7. [ ] **Grammar sentence completion coverage** — 399/644 grammar points have fill-blank facts. The other 245 were skipped because the grammar pattern uses a ～ prefix that doesn't appear literally in example phrases. Sonnet workers could generate custom fill-blank sentences for these.

---

## Acceptance Criteria

### Kanji
- [ ] ~4,100 kanji facts across N5-N1
- [ ] N2 has ~1,000 kanji (up from 189)
- [ ] All facts have readings (on'yomi/kun'yomi), meanings, mnemonics where available
- [ ] IDs contain `-kanji-`, categoryL2 set correctly

### Grammar
- [ ] ~2,040 grammar facts across N5-N1 (2-3 per grammar point)
- [ ] Mix of question types: meaning, recall, sentence completion
- [ ] Sentence completion facts use correct Japanese conjugations
- [ ] Distractors are level-appropriate grammar patterns or conjugation forms
- [ ] N5 has ~200 facts (80 points × 2.5), N4 has ~330 facts
- [ ] Old shallow grammar facts archived/removed
- [ ] DB rebuilt, deckbuilder verified

### Overall
- [ ] Japanese deck total: ~7,726 vocab + ~4,100 kanji + ~2,040 grammar = ~13,866 facts
- [ ] Deckbuilder shows Vocabulary/Kanji/Grammar per JLPT level with correct counts

---

## Files Affected

| File | Change |
|------|--------|
| `scripts/content-pipeline/vocab/expand-japanese-kanji.mjs` | NEW |
| `scripts/content-pipeline/knowledge/grammar-worker-prompt.md` | NEW — Sonnet prompt template |
| `src/data/seed/kanji-ja.json` | REPLACED — expanded to ~4,100 |
| `src/data/seed/grammar-ja.json` | REPLACED — complete rebuild with multi-type facts |
| `data/curated/vocab/ja/grammar-points-master.json` | NEW — curated grammar source |
| `data/archived/grammar-ja-v1.json` | NEW — archived old shallow grammar |
| `public/facts.db` | Rebuilt |

---

## Risk Assessment

- **Kanji**: LOW risk — programmatic cross-reference with rich kanji-info.json data
- **Grammar sentence completion**: HIGH risk — Sonnet must produce correct Japanese conjugations. Requires careful prompt engineering and validation. Bad conjugations are worse than no grammar at all.
- **Grammar distractor quality**: MEDIUM risk — need level-appropriate patterns, not random options
- **Scope**: ~4,000+ new facts is large. May need to split into sub-phases (kanji first, then grammar)

## Sources

- [JLPT Kanji Count Breakdown (Kanjidon)](https://kanjidon.com/blog/how-many-kanji-jlpt/)
- [JLPT Grammar Points Guide (Migaku)](https://migaku.com/blog/japanese/jlpt-grammar-points)
- [JLPTsensei Complete Grammar List](https://jlptsensei.com/complete-jlpt-grammar-list/)
- [JLPT Hub Kanji Requirements](https://www.jlpthub.com/kanji-for-jlpt-n5-n4-n3-n2-n1/)
- [Bunpro Grammar Database](https://bunpro.jp/grammar_points)
