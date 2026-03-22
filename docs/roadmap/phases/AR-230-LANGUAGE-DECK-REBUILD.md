# AR-230: Language Deck Rebuild — Authoritative Sources, Perfect Data

## Goal

Rebuild ALL 8 language decks from authoritative, levelled sources. Replace everything we have. Target: 99% audit pass rate, proper CEFR/HSK/JLPT/TOPIK level sorting, 3,000-5,000 words per language.

## Strategy

### Tier 1: CJK Languages — Direct from authoritative exam sources

| Language | Source | Translations | Levels | Target |
|----------|--------|-------------|--------|--------|
| **Chinese** | `data/references/hsk/complete.json` (11,470 entries) | Clean English in `meanings[]` | HSK new-1 through new-6 (skip 7) | ~5,300 |
| **Japanese** | Already production-ready | JMdict + JLPT + KANJIDIC | N5-N1 | 10,238 (keep) |
| **Korean** | Already production-ready (TOPIK) | TOPIK PDFs | TOPIK I + II | 3,718 (keep) |

### Tier 2: European Languages — CEFRLex levels × Wiktionary translations

Cross-reference two sources:
1. **CEFRLex** (academic CEFR frequency data) → gives us the CORRECT level for each word
2. **Our existing Wiktionary translations** → gives us the English meaning

Keep only words that appear in BOTH sources. Filter to A1-B2 (learner-relevant levels).

| Language | CEFRLex Source | Wiktionary Data | Target |
|----------|---------------|-----------------|--------|
| **German** | DAFlex.tsv (41,647 words) | vocab-de.json (18,529) | ~3,000-5,000 |
| **French** | FLELex.tsv (14,236 words) | vocab-fr.json (12,702) | ~3,000-5,000 |
| **Spanish** | ELELex.tsv (14,291 words) | vocab-es.json (11,399) | ~3,000-5,000 |
| **Dutch** | NT2Lex.tsv (15,228 words) | vocab-nl.json (9,858) | ~3,000-5,000 |

### Tier 3: Czech — Sonnet worker translation (no CEFRLex available)

Czech has no CEFRLex data. Options:
- Use frequency-based level assignment from our existing data
- Run Sonnet workers to verify translations on a curated ~3,000 word subset
- Or find a Czech CEFR wordlist online

## Sub-steps

### Step 1: Rebuild Chinese from HSK reference

Script: `scripts/content-pipeline/vocab/rebuild-chinese-from-hsk.py`

1. Read `data/references/hsk/complete.json`
2. For each entry with level new-1 through new-6:
   - `correctAnswer` = first meaning from `meanings[]` (clean, short)
   - `pronunciation` = pinyin from `transcriptions.pinyin`
   - `categoryL2` = `chinese_hsk1` through `chinese_hsk6`
   - `difficulty` = HSK level (1-5 scale)
3. Skip entries where first meaning starts with "variant of", "surname", "see "
4. Skip HSK new-7 (5,606 near-native words — too advanced, lower quality)
5. Truncate answers >25 chars at comma/semicolon boundary
6. Write to `src/data/seed/vocab-zh.json`

### Step 2: Rebuild European languages from CEFRLex × Wiktionary

Script: `scripts/content-pipeline/vocab/rebuild-european-from-cefrlex.py`

For each European language (DE, FR, ES, NL):
1. Load CEFRLex TSV → build map of `word → CEFR level` (pick level where word has highest frequency)
2. Load our current Wiktionary seed → build map of `word → English translation`
3. Intersect: keep only words in BOTH sources
4. Filter to A1-B2 only (skip C1/C2)
5. Assign proper `categoryL2` = `{language}_{level}` (e.g., `german_a1`)
6. Clean translations: strip "variant of", truncate >25 chars
7. Write new seed files

### Step 3: Handle Czech

Either:
- Find a Czech frequency/CEFR wordlist
- Or take our existing Czech data, filter to most common ~3,000 words by frequency, and run Sonnet verification

### Step 4: Rebuild DB + audit all languages

- Rebuild `public/facts.db`
- Run 8 parallel Sonnet auditors (50 cards each)
- Fix any remaining issues
- Final 50-card production gate per language

## Acceptance Criteria

- [ ] Each language has proper CEFR/HSK/JLPT/TOPIK level sorting
- [ ] Each language has 3,000-5,000 facts (except Japanese which keeps 10K+)
- [ ] All answers ≤25 chars
- [ ] No "variant of", "surname", "see", "abbr" dictionary metadata
- [ ] No "Part of speech:" in explanations
- [ ] 95%+ pass rate on 50-card Sonnet audit per language
- [ ] Runtime question variants (Forward, Reverse, Synonym, Definition) work for all
- [ ] Distractor pools segmented by subdeck type
- [ ] `npm run typecheck` + `npm run build` pass
