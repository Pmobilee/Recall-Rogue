# AR-215: Japanese Content Quality Fix — Production-Ready Subdecks

## Overview

**Goal:** Fix all data quality issues across 7 Japanese subdecks (13,073 facts) so they are production-ready for Steam launch.

**Root causes identified:**
1. Kanji extraction script uses compound-word meanings instead of standalone kanji meanings (1,585/2,096 kanji affected)
2. Seed files were overwritten without preserving pre-stored distractors from raw source
3. Grammar `extractFirstMeaning()` splits on commas, mangling values like "10,000" → "10"
4. Grammar has only 644 single-type "meaning" facts — no recall or fill-blank variants exist
5. Kana ぢ/づ use non-standard romanization (di/du instead of Hepburn ji/zu)

**Dependencies:** None — pure data pipeline work, no game code changes needed.

**Complexity:** High — touches extraction scripts, raw data, seed files, and DB rebuild. But all changes are in the content pipeline, not game logic.

**Runtime distractor system note:** `vocabDistractorService.ts` already generates pool-based distractors at game time for ALL `type:"vocabulary"` + `language:"ja"` facts. Pre-stored distractors in seed files are a bonus (enable offline/faster startup) but NOT required for gameplay. The runtime system pulls from the full same-language pool with difficulty matching, length filtering, and FSRS-aware seen/unseen prioritization. This means we do NOT need LLM-generated distractors — the pool-based approach already works.

---

## Sub-steps

### Step 1: Fix kanji extraction — standalone meanings instead of compound words

**Problem:** `_ARCHIVED_extract-fjsd-japanese.mjs` line 321 takes `info.words[0]` which is often a compound word (e.g., 電話 for kanji 電). It uses the compound's meaning ("telephone call") and reading ("でんわ") instead of the standalone kanji meaning ("electricity") and reading ("でん").

Additionally, `extractFirstMeaning()` (line 42-44) does `translation.split(',')[0]` which mangles "10,000" → "10".

**Fix:** Write a new Python script `scripts/content-pipeline/vocab/rebuild-kanji-from-reference.py` that:

1. Reads `kanji-info.json` reference data for each JLPT-level kanji
2. For each kanji, finds the entry in `words[]` where `kanjiForms[0].kanjiForm` === the bare kanji character (standalone entry). Uses that entry's translation and reading.
3. If no standalone entry exists, falls back to `words[0]` but takes the FULL translation (no comma splitting for numbers — use regex to detect "N,NNN" number patterns and preserve them) and marks the fact with a `_compoundDerived: true` flag for later review.
4. Sets `pronunciation` to the standalone kanji reading (on'yomi or kun'yomi), NOT the compound reading.
5. Sets `exampleSentence` to the first compound word form + reading (for context), separate from the meaning.
6. Preserves existing distractors from raw files.
7. Preserves existing mnemonics/explanations from raw files.
8. Overwrites `data/raw/japanese/kanji-n{1-5}.json` with corrected data.

**Files:** `scripts/content-pipeline/vocab/rebuild-kanji-from-reference.py` (new), `data/raw/japanese/kanji-n{1-5}.json` (modified)

**Acceptance:** For known-bad kanji: 万="10,000" (not "10"), 電="electricity" (not "telephone call"), 間="interval/between" (not "human being"), 馬="horse" (not "idiot"), 鹿="deer" (not "idiot"), 本="book" (not "truth"). Pronunciation fields show standalone kanji readings.

---

### Step 2: Fix kana romanization — ぢ/づ and ヂ/ヅ

**Problem:** ぢ is romanized as "di" and づ as "du" (Nihon-shiki). Standard Hepburn (used by all modern learner resources, JLPT, textbooks) romanizes them as "ji" and "zu".

**Fix:** In the kana seed generation script (`scripts/content-pipeline/build-kana-facts.mjs`), update the kana mapping tables so:
- ぢ → "ji" (with explanation noting it's historically distinct from じ but pronounced identically in modern Japanese)
- づ → "zu" (with explanation noting it's historically distinct from ず)
- ヂ → "ji" (same)
- ヅ → "zu" (same)

Also update the reverse-quiz questions for these characters to avoid ambiguity with じ/ず and ジ/ズ:
- Instead of "Which hiragana represents 'ji'?" (ambiguous — could be じ or ぢ), use "Which is the LESS COMMON hiragana for 'ji'?" for ぢ, or add a disambiguation note.
- Alternatively: keep both じ and ぢ as valid answers for "ji" reverse questions by adding `acceptableAnswers` field.

Rebuild kana seeds with corrected mappings + regenerated distractors (8 per fact).

**Files:** `scripts/content-pipeline/build-kana-facts.mjs` (edit), `data/raw/japanese/kana-hiragana.json` + `kana-katakana.json` (if source mapping lives there), seed files (regenerated)

**Acceptance:** ぢ.correctAnswer = "ji", づ.correctAnswer = "zu". Reverse questions for ji/zu handle the ambiguity. All 416 kana facts have 8 distractors each.

---

### Step 3: Expand grammar with recall + fill-blank variants

**Problem:** All 644 Japanese grammar facts are single-type "What does pattern X mean?" questions. No recall ("Which pattern means X?") or fill-blank ("Complete: 食べ___") variants exist. Korean and Chinese grammars already have these. The hanabira expansion script exists but was never run/merged for the existing FJSD grammar.

**Fix:** Write `scripts/content-pipeline/vocab/expand-grammar-variants.py` that reads the existing 644 FJSD grammar facts from the seed and generates 2 additional variants per fact where possible:

1. **Recall variant** (L1→L2): "Which Japanese grammar pattern means '[meaning]'?" → answer is the pattern. Distractors: other grammar patterns from the same JLPT level (pool-based, 7 per fact).
2. **Fill-blank variant** (contextual): If the fact has an `exampleSentence` containing the pattern, replace the pattern with `___` and ask the player to fill it. Answer is the pattern. If no example sentence or pattern not found in sentence, skip this variant for that fact.

ID scheme: append `-recall` and `-fill` suffixes to the base ID (e.g., `ja-grammar-n5-001-recall`, `ja-grammar-n5-001-fill`). Rename original to have `-meaning` suffix.

**Files:** `scripts/content-pipeline/vocab/expand-grammar-variants.py` (new), `src/data/seed/grammar-ja.json` (modified — grows from ~644 to ~1,500-1,900 facts)

**Acceptance:** Grammar facts have meaning + recall + fill variants. Fill-blank only where example sentence supports it. All new facts have 7 pool-based distractors. IDs follow `-meaning`/`-recall`/`-fill` convention. `categoryL2` preserved correctly per level.

---

### Step 4: Fix grammar answer quality issues

**Problem:** Multiple quality issues in existing grammar facts:
- Answers with `〜` wave-dash prefix artifacts (e.g., "〜ね" should be "ね" for fill answers)
- Answers containing internal notation ("Vm", "(subject marker)" with parens)
- Truncated explanations/example sentences with newline corruption
- Grammar meanings that are too vague (e.g., し = "and" when it means "and what's more")

**Fix:** Write a cleanup pass in the grammar variants script (Step 3) that:
1. Strips `〜` prefix from `correctAnswer` fields (it's a pattern notation, not part of the answer)
2. Strips parenthesized prefixes like "(subject marker)" → "subject marker"
3. Removes "Vm、N" and other internal notation from answer strings
4. Truncates `explanation` cleanly at sentence boundaries (not mid-word) — find last `.` or `;` before limit
5. Flags answers shorter than 3 characters or longer than 80 characters for manual review

**Files:** Same script as Step 3 (combined pass), `src/data/seed/grammar-ja.json`

**Acceptance:** No `〜` prefixes in correctAnswer. No "Vm" or "Noun" notation in player-facing text. No mid-word truncations in explanations.

---

### Step 5: Fix vocabulary answer quality issues

**Problem:** Several vocab facts have inaccurate or misleading English translations:
- 大して = "very" (should be "(not) very" — used only in negative constructions)
- ~きる = "nevertheless" (should be "completely / to the end")
- 周辺 = "circumference" (should be "surroundings / vicinity")
- 差別 = "distinction" (should be "discrimination")
- Various obscure English words ("confections" for お菓子, "to ill-treat" for 苛める)

**Fix:** Write `scripts/content-pipeline/vocab/fix-japanese-vocab-answers.py` that:
1. Loads vocab seed + a corrections map (hardcoded dict of `{id: {correctAnswer: "...", explanation: "..."}}`)
2. Applies corrections from the audit findings
3. Flags any `correctAnswer` longer than 40 characters for review (button display limit)

The corrections map will be populated from the audit results. Known fixes from the 7 audits:
- All critical/high severity answer errors identified in the N1-N5 audits (~30 specific facts)

**Files:** `scripts/content-pipeline/vocab/fix-japanese-vocab-answers.py` (new), `src/data/seed/vocab-ja.json` (modified)

**Acceptance:** All critical/high severity vocab answer errors fixed. No `correctAnswer` exceeds 40 characters.

---

### Step 6: Re-run import + rebuild seed files + rebuild DB

**Problem:** Seed files lost pre-stored distractors when overwritten.

**Fix:**
1. Run `python3 scripts/content-pipeline/vocab/rebuild-kanji-from-reference.py` (Step 1) to fix raw kanji files
2. Run `python3 scripts/import-japanese-kanji-grammar.py` to regenerate kanji + grammar seeds from corrected raw files (restores distractors)
3. Run `node scripts/content-pipeline/build-kana-facts.mjs` to regenerate kana seeds with corrected romanization + distractors
4. Run Step 3 grammar expansion script to add recall/fill variants
5. Run Step 4 grammar cleanup (combined with Step 3)
6. Run Step 5 vocab fixes
7. Run `node scripts/build-facts-db.mjs` to rebuild `public/facts.db`
8. Verify DB counts match expectations

**Files:** `public/facts.db` (rebuilt), all seed files

**Acceptance:**
| Subdeck | Expected count (approx) | Distractors |
|---------|------------------------|-------------|
| Kanji | 2,096 | 7 per fact (from raw) |
| Grammar | ~1,500-1,900 | 7 per fact (pool-based) |
| Vocab | 7,726 | 0 stored (runtime generation) |
| Kana | 416 | 8 per fact (programmatic) |

---

### Step 7: Full audit of all 7 subdecks — verify fixes

**Problem:** Must verify all fixes landed correctly and no regressions.

**Fix:** Re-run the same 7 parallel Sonnet audit agents from the initial audit, each checking a 200-fact sample against the same checklist. Compare issue counts to baseline.

**Acceptance criteria per subdeck:**
- **Hiragana/Katakana:** 0 critical issues, ぢ/づ use Hepburn ji/zu, all 208 facts have distractors
- **N5:** 0 critical kanji meaning errors (万=10000, 電=electricity, 本=book, 間=between), 0 truncated answers
- **N4:** 0 compound-meaning errors (味=taste, 室=room, 心=heart, 真=true), 0 pattern-label fill answers
- **N3:** 0 critical errors (仏=Buddha, 馬=horse, 刊=publication), grammar has recall+fill variants
- **N2:** 0 critical errors (跡=trace, 大して=(not)very, きる=completely), 0 internal notation in answers
- **N1:** 0 critical errors (鹿=deer, 稲=rice plant, 案=plan), 0 readings-as-meanings

**If any subdeck fails:** Fix the specific issues, rebuild DB, re-audit that subdeck only. Iterate until all pass.

---

## Files Affected

| File | Action |
|------|--------|
| `scripts/content-pipeline/vocab/rebuild-kanji-from-reference.py` | NEW — kanji meaning fix |
| `scripts/content-pipeline/vocab/expand-grammar-variants.py` | NEW — grammar recall/fill expansion |
| `scripts/content-pipeline/vocab/fix-japanese-vocab-answers.py` | NEW — vocab answer corrections |
| `scripts/content-pipeline/build-kana-facts.mjs` | EDIT — fix ぢ/づ romanization |
| `data/raw/japanese/kanji-n{1-5}.json` | MODIFIED — corrected kanji meanings |
| `src/data/seed/kanji-ja.json` | REBUILT — from corrected raw + restored distractors |
| `src/data/seed/grammar-ja.json` | REBUILT — with recall/fill variants + cleanup |
| `src/data/seed/vocab-ja.json` | MODIFIED — answer corrections |
| `src/data/seed/vocab-ja-hiragana.json` | REBUILT — corrected romanization + distractors |
| `src/data/seed/vocab-ja-katakana.json` | REBUILT — corrected romanization + distractors |
| `public/facts.db` | REBUILT |
| `docs/GAME_DESIGN.md` | UPDATE — section 22 counts after grammar expansion |

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npx vitest run` — all tests pass
- [ ] DB fact counts: kanji ~2,096, grammar ~1,500+, vocab 7,726, kana 416
- [ ] All 7 subdeck audits pass with 0 critical issues
- [ ] Known-bad facts verified correct: 万, 電, 本, 間, 馬, 鹿, 稲, ぢ, づ, 大して, ~きる
- [ ] Runtime distractor generation confirmed working for all Japanese facts (Playwright: load combat with Japanese deck, verify quiz shows 3 answer options)
- [ ] No `correctAnswer` contains "Vm", "Noun ", or `〜` prefix
- [ ] No kanji `pronunciation` field contains a compound-word reading longer than the kanji + 2 chars
