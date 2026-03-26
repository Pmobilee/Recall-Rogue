# AR-249: Vocabulary Migration to Curated Decks

**Status:** Pending
**Complexity:** Large (data migration across 8+ languages, format conversion, synonym computation)
**Dependencies:** AR-245 (CuratedDeck types, deck store, manifest)
**Spec Reference:** `docs/RESEARCH/DECKBUILDER.md` sections 3.4, 4.6, 5.2; AR-244 section 5.5

---

## 1. Overview

Convert all existing vocabulary facts from `src/data/seed/vocab-*.json` into curated deck JSON files in `data/decks/`. Each language level becomes its own deck. Sub-decks are defined where applicable (Vocabulary, Kanji, Grammar). Language facts are removed from the Trivia Dungeon pool.

This is primarily a data transformation task. The runtime systems (AR-246/247/248) consume the output format.

---

## 2. Sub-Steps

### 2.1 Create Migration Script

**File:** `scripts/migrate-vocab-to-decks.ts` (NEW)

Script that reads existing vocab JSON files and outputs curated deck JSON files.

**Input files:**
- `src/data/seed/vocab-ja.json` (~25K facts, JLPT N5-N1)
- `src/data/seed/vocab-ko.json` (Korean)
- `src/data/seed/vocab-es.json` (Spanish)
- `src/data/seed/vocab-fr.json` (French)
- `src/data/seed/vocab-de.json` (German)
- `src/data/seed/vocab-nl.json` (Dutch)
- `src/data/seed/vocab-cs.json` (Czech)
- `src/data/seed/vocab-zh.json` (Chinese)
- `src/data/seed/vocab-ja-hiragana.json`, `vocab-ja-katakana.json` (Japanese script)
- `src/data/seed/vocab-ko-hangul.json` (Korean script)
- `src/data/seed/kanji-ja.json` (Japanese kanji)

**Output structure:** One deck JSON per language level:
```
data/decks/
  japanese_n5.json
  japanese_n4.json
  japanese_n3.json
  japanese_n2.json
  japanese_n1.json
  japanese_hiragana.json
  japanese_katakana.json
  korean_topik1.json
  korean_topik2.json
  korean_hangul.json
  spanish_a1.json
  spanish_a2.json
  french_a1.json
  french_a2.json
  german_a1.json
  german_a2.json
  dutch_a1.json
  dutch_a2.json
  czech_a1.json
  czech_a2.json
  chinese_hsk1.json
  chinese_hsk2.json
  manifest.json  (updated with all deck entries)
```

**Transformation per fact:**

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `id` | `id` | Preserve exactly — maintains FSRS data |
| `correctAnswer` | `correctAnswer` | Preserve |
| `distractors` | `distractors` | Carry over as fallback (may be empty) |
| `quizQuestion` | `quizQuestion` | Preserve as default template |
| `explanation` | `explanation` | Preserve |
| `difficulty` | `difficulty` | Preserve |
| `funScore` | `funScore` | Preserve |
| `pronunciation` | `reading` | Map pronunciation to reading field |
| n/a | `targetLanguageWord` | Extract from statement/question |
| n/a | `chainThemeId` | Assign generic 0-5, evenly distributed |
| n/a | `answerTypePoolId` | Assign based on fact type |
| n/a | `acceptableAlternatives` | Populate from existing data or empty |
| n/a | `synonymGroupId` | Computed in step 2.3 |
| `category[1]` (e.g. "japanese_n5") | Deck membership | Determines which deck file |

**Acceptance:** Script runs, produces valid deck JSONs, preserves fact IDs.

### 2.2 Define Answer Type Pools Per Language

Each vocabulary deck needs these answer type pools:

| Pool ID | Language Applicability | Contents |
|---------|----------------------|----------|
| `english_meanings` | All languages | English translations |
| `target_language_words` | All languages | Words in the target language |
| `reading_hiragana` | Japanese only | Hiragana readings |
| `reading_pinyin` | Chinese only | Pinyin readings |

The migration script builds these pools by scanning all facts in each deck and grouping by answer format.

**Acceptance:** Every deck has at least `english_meanings` and `target_language_words` pools with 5+ entries.

### 2.3 Compute Synonym Groups

Run the `acceptableAlternatives` intersection algorithm (DECKBUILDER.md §4.6) on each deck:

```typescript
// For each pair of facts in the deck:
// If correctAnswer + acceptableAlternatives of fact A
// overlaps with correctAnswer + acceptableAlternatives of fact B
// → they're in the same synonym group
```

This is O(n^2) per deck but vocabulary facts are segmented by level (N5 = ~800, not 25K), so it's manageable.

**Output:** `synonymGroups[]` array in each deck JSON.

**Flag large groups:** Any synonym group with > 4 facts should be logged as a warning (may starve distractor pool).

**Acceptance:** Synonym groups computed correctly. Japanese きれい/うつくしい grouped. Spanish bonito/hermoso grouped.

### 2.4 Define Sub-Decks Per Language

**Japanese decks:** Sub-decks: Vocabulary, Kanji, Grammar (where applicable)
- Hiragana/Katakana decks: no sub-decks (single-purpose)
- N5-N1 decks: sub-decks based on fact type (vocab word, kanji reading, grammar point)

**Korean decks:** Sub-decks: Vocabulary, Hangul (for hangul deck)

**European language decks:** Typically no sub-decks (flat vocabulary lists per level)

**Chinese decks:** Sub-decks: Vocabulary, Hanzi

Sub-deck assignment is based on the fact's existing tags or category metadata.

**Acceptance:** Sub-deck definitions in each deck JSON. Fact counts per sub-deck are correct.

### 2.5 Create Deck Registry Entries

**File:** Part of migration script output

For each generated deck, produce a registry entry:

```typescript
{
  id: "japanese_n5",
  name: "Japanese N5 Vocabulary",
  description: "Beginner Japanese — ~800 words for JLPT N5",
  domain: "vocabulary",
  factCount: 822,
  subDecks: [
    { id: "vocabulary", name: "Vocabulary", factCount: 600 },
    { id: "kanji", name: "Kanji", factCount: 150 },
    { id: "grammar", name: "Grammar", factCount: 72 },
  ],
  tier: 1,
  status: "available",
  artPlaceholder: {
    gradientFrom: "#E53935",
    gradientTo: "#FF8A80",
    icon: "flag-jp",
  },
}
```

These entries will be loaded by the deck store (AR-245) at startup.

**Acceptance:** Registry entries for all migrated decks. Art placeholder gradients use appropriate national colors.

### 2.6 Remove Language Facts from Trivia Pool

**File:** `src/services/factService.ts` or equivalent (MODIFY)

After migration, language/vocabulary facts should NOT appear in Trivia Dungeon runs:
- Filter out facts where `categoryL1 === 'language'` from the trivia pool
- OR remove them from `facts.db` and `knowledge-*.json` files entirely

**Recommended approach:** Filter at query time rather than delete from DB (reversible, simpler).

Add a check: `if (runConfig.mode === 'trivia') { exclude language facts }`.

**Acceptance:** Starting a trivia run shows zero language/vocabulary facts. Study Temple decks contain all vocabulary.

### 2.7 Update Deck Manifest

**File:** `data/decks/manifest.json` (MODIFY)

Add all generated deck files to the manifest:

```json
{
  "decks": [
    "japanese_n5.json",
    "japanese_n4.json",
    ...
  ]
}
```

**Acceptance:** Manifest lists all generated decks. Deck store loads them at startup.

---

## 3. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `scripts/migrate-vocab-to-decks.ts` | CREATE | Migration script |
| `data/decks/*.json` | CREATE | ~20 curated deck files |
| `data/decks/manifest.json` | MODIFY | Updated deck list |
| `src/services/factService.ts` | MODIFY | Filter language facts from trivia pool |

---

## 4. Acceptance Criteria

1. All vocabulary facts migrated to curated deck JSON files
2. Fact IDs preserved exactly (no FSRS data loss)
3. Every deck has answer type pools with 5+ entries each
4. Synonym groups computed correctly per deck
5. Sub-decks defined where applicable
6. Registry entries generated for all decks
7. Language facts excluded from trivia pool
8. Manifest updated
9. `npm run typecheck` passes (if script is TypeScript)
10. Deck validation commands (from deck-master skill) pass on all generated decks

---

## 5. Verification Gate

- [ ] Run deck-master validation commands on each generated deck (required fields, distractor count, pool size, chain distribution, synonym groups)
- [ ] Verify fact ID preservation: cross-reference old vocab JSON IDs with new deck JSON IDs
- [ ] Verify trivia pool no longer contains language facts
- [ ] Verify deck store loads all migrated decks at startup
- [ ] Update `docs/GAME_DESIGN.md` — document vocabulary as curated-only content
- [ ] Update `docs/ARCHITECTURE.md` — data migration, new file locations
- [ ] Update deck-master skill with vocabulary migration rules

---

## 6. Notes

- The migration script should be idempotent — running it again produces the same output.
- Existing `vocab-*.json` files in `src/data/seed/` are NOT deleted (they serve as the source of truth for the migration). They just stop being loaded for trivia runs.
- Some vocabulary facts may have empty `distractors[]` arrays. This is fine — AR-247 (pool-based distractors) generates distractors at runtime from the answer type pools.
- The `acceptableAlternatives` field is critical for synonym group computation. If existing vocab facts don't have this field populated, it must be filled during migration (even if just `[]`).
- Large decks (Japanese N1 with potentially 2000+ facts) are fine — they don't need splitting since they're already segmented by JLPT level.
