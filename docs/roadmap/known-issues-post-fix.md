# Known Issues — Post Fix/Deck-Quality-2026-04-10

> Deferred issues from the 2026-04-10 deck quality sweep that need follow-up work.
> Each entry includes what's needed, acceptance criteria, and which scripts/resources to use.

---

## Dutch B1/B2 — NT2Lex Re-Ingest

**Status:** Deferred — decks delisted from shipping (hidden: true set in deck JSON)

**Current state:**
- `dutch_b1.json`: 232 facts (target ~2,500 for CEFR B1)
- `dutch_b2.json`: 71 facts (target ~3,600 for CEFR B2)
- Both decks are hidden in the deck catalog (`hidden: true` top-level field) and removed from `src/types/vocabulary.ts` `subdecks` array

**Root cause:** The initial NT2Lex pipeline ingested only a fraction of the available wordlist at B1/B2 levels. The source data exists at `cental.uclouvain.be/cefrlex/` (NT2Lex Dutch CEFR frequency lists).

**What is needed:**
1. Download or locate the full NT2Lex B1 and B2 wordlists from CEFRLex
2. Run the Dutch vocab ingest pipeline (`scripts/content-pipeline/vocab/`) against the complete B1/B2 segments
3. Merge into `data/decks/dutch_b1.json` and `dutch_b2.json`
4. Remove `"hidden": true` from both deck JSON files
5. Re-add `dutch_b1` and `dutch_b2` to the `subdecks` array in `src/types/vocabulary.ts`
6. Run `node scripts/verify-all-decks.mjs` — 0 failures required

**Acceptance criteria:**
- `dutch_b1`: ≥800 facts minimum, target ≥2,000
- `dutch_b2`: ≥600 facts minimum, target ≥1,500
- All facts pass structural validation (verify-all-decks 0 failures)
- Answer pool homogeneity passes (max/min ratio <3x)

**Reference scripts:**
- `scripts/content-pipeline/vocab/` — Dutch vocab ingest pipeline
- Source: CEFRLex NT2Lex — `https://cental.uclouvain.be/cefrlex/`
- Compare with `czech_b1.json` and `spanish_b1.json` as scope reference

---

## HSK6 CC-CEDICT Sense Alignment — Pipeline Fix

**Status:** Workaround applied (356 facts have generic explanations). Root cause not fixed in pipeline.

**Current state:**
- 356 facts in `chinese_hsk6.json` have `explanation` set to `"Multiple meanings exist; see dictionary entry for \"<char>\"."` — honest but less educational than a real explanation.
- Root cause is in `rebuild-chinese-from-hsk.py`: when CC-CEDICT has multiple headwords for a simplified character (different tones/readings), `get_usable_meaning()` and `build_explanation()` can pick from different headword clusters.

**What is needed:**
1. Fix `build_explanation()` in `scripts/content-pipeline/vocab/rebuild-chinese-from-hsk.py` to group CC-CEDICT entries by `(simplified, pinyin)` and always pull explanation meanings from the same group that `get_usable_meaning()` selected from.
2. Re-run the script to regenerate `src/data/seed/vocab-zh.json`
3. Re-run the deck assembly pipeline to regenerate `data/decks/chinese_hsk6.json`
4. Re-run the sense mismatch heuristic — target <20 suspects (some ambiguity is unavoidable for true polysemes)
5. Run `node scripts/verify-all-decks.mjs` — 0 new failures

**Detection heuristic** (use to validate the fix):
```python
import json, re
d = json.load(open('data/decks/chinese_hsk6.json'))
suspects = []
for f in d['facts']:
    ans = f.get('correctAnswer', '').lower()
    exp = f.get('explanation', '').lower()
    if not ans or not exp: continue
    tokens = [t.strip() for t in re.split(r'[;,/]', ans) if len(t.strip()) >= 4]
    if not tokens: continue
    if not any(t in exp for t in tokens):
        suspects.append((f['id'], f['correctAnswer'], f['explanation'][:80]))
print(f'{len(suspects)} suspects')
```

**Acceptance criteria:**
- Sense mismatch heuristic returns <20 suspects after pipeline fix
- No facts have generic "Multiple meanings exist" explanation (all should have real explanations)
- `verify-all-decks.mjs` — 0 failures

**Reference scripts:**
- `scripts/content-pipeline/vocab/rebuild-chinese-from-hsk.py` — pipeline to fix
- `data/references/hsk/complete.json` — source HSK data (already in repo)

---
