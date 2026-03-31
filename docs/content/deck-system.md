# Curated Deck System

> **Purpose:** Explains what curated decks are, how they are structured, loaded, registered, and how player progression is tracked against them.
> **Last verified:** 2026-03-31
> **Source files:** `src/data/curatedDeckStore.ts`, `src/data/deckRegistry.ts`, `src/data/deckFactIndex.ts`, `src/data/curatedDeckTypes.ts`, `src/services/deckManager.ts`, `src/services/deckOptionsService.ts`, `src/services/deckProgressService.ts`, `data/decks/manifest.json`

---

## What Is a Curated Deck?

A curated deck is a themed, hand-authored collection of facts organized around a specific topic (e.g. `world_war_ii`, `japanese_n3`, `periodic_table`). Every fact in a curated deck is a `DeckFact` object with a verified correct answer, pre-generated distractors, difficulty and fun scores, and optional vocabulary-specific fields.

Curated decks are distinct from the trivia `facts.db` SQLite database. They live in `data/decks/*.json` and are fetched at runtime — never compiled into the JS bundle.

---

## Deck JSON Structure

Each deck file is a `CuratedDeck` object (`src/data/curatedDeckTypes.ts`):

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique deck ID, e.g. `"world_war_ii"`, `"japanese_n3"` |
| `name` | `string` | Player-facing display name |
| `domain` | `string` | Parent domain ID or `"vocabulary"` for language decks |
| `subDomain` | `string?` | Optional sub-domain, e.g. `"capitals"` |
| `minimumFacts` | `number` | Minimum required fact count for deck to be playable |
| `targetFacts` | `number` | Target fact count for a complete deck |
| `facts` | `DeckFact[]` | All facts in this deck |
| `answerTypePools` | `AnswerTypePool[]` | Facts grouped by answer format (name/year/term/place) |
| `synonymGroups` | `SynonymGroup[]` | Facts sharing acceptable-answer synonym groups |
| `difficultyTiers` | `DifficultyTier[]` | Fact IDs bucketed into `easy`, `medium`, `hard` |
| `subDecks` | `{id,name,factIds}[]?` | Optional sub-groupings (e.g. Vocabulary/Kanji/Grammar for Japanese) |

### DeckFact Fields

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Globally unique fact ID |
| `correctAnswer` | yes | Single canonical answer |
| `acceptableAlternatives` | yes | Other acceptable typed answers |
| `distractors` | yes | 8–12 pre-generated wrong answers |
| `quizQuestion` | yes | Question shown to player |
| `explanation` | yes | Post-answer explanation |
| `difficulty` | yes | 1–5 scale |
| `funScore` | yes | 1–10; facts with `funScore >= 7` get 2× weight in first draw |
| `chainThemeId` | yes | 0–5 chain type slot |
| `answerTypePoolId` | yes | Links to an `AnswerTypePool` for distractor selection |
| `grammarNote` | no | Rich grammar explanation for language/grammar facts |
| `targetLanguageWord` | no | The target-language word (vocabulary decks) |
| `pronunciation` | no | Reading (e.g. hiragana for Japanese kanji) |
| `partOfSpeech` | no | Used for POS-matched distractor selection |
| `examTags` | no | Filtering tags (e.g. `"USMLE_Step1"`, `"high_yield"`) |
| `quizResponseMode` | no | `'choice'` (default) or `'typing'` (text input) |
| `quizMode` | no | `'text'`, `'image_question'`, or `'image_answers'` |
| `volatile` | no | `true` if the answer may become outdated |

---

## Manifest

`data/decks/manifest.json` lists all active deck filenames. As of 2026-03-31 it contains **59 decks**:

- **Language**: Chinese HSK 1–6, Czech A1–B2, Dutch A1–B2, French A1–B2, German A1–B2, Japanese Hiragana/Katakana/N1–N5/N3 Grammar, Korean Hangul/TOPIK 1–2, Spanish A1–B2
- **Knowledge**: World Countries/Capitals/Flags, Solar System, US Presidents, Periodic Table, US States, NASA Missions, Greek/Norse/Egyptian Mythology, WWII, Human Anatomy, Ancient Rome/Greece, Famous Inventions, Mammals, Constellations, Famous Paintings, World Cuisines, Medieval World

---

## Load and Registration Pipeline

`initializeCuratedDecks()` in `curatedDeckStore.ts` runs once at startup (guarded by `_initCalled` flag):

1. Fetches `/data/decks/manifest.json`
2. For each filename, fetches `/data/decks/<filename>` — skips HTML responses (Vite 404 fallback)
3. Validates: deck must have `id` and a non-empty `facts` array
4. Calls `loadDeck(deck)` which:
   - Stores the full deck in `loadedDecks: Map<string, CuratedDeck>` (in-memory)
   - Registers metadata-only entry in `DECK_REGISTRY` via `registerDeck()`
   - Builds sub-deck and tag indexes, then registers via `registerDeckFacts()`
   - Derives `artPlaceholder` (gradient colors + icon) from domain metadata

### Art Placeholder Colors

Colors are derived by mixing the domain's `colorTint` with the dark base `#0d1117`. Vocabulary decks override with per-language brand colors and flag emojis:

| Language | Icon | Color |
|---|---|---|
| Japanese | 🇯🇵 | `#E11D48` (rose red) |
| Korean | 🇰🇷 | `#7C3AED` (violet) |
| Mandarin/Chinese | 🇨🇳 | `#DC2626` (red) |
| Spanish | 🇪🇸 | `#F59E0B` (amber) |
| French | 🇫🇷 | `#3B82F6` (blue) |
| German | 🇩🇪 | `#EAB308` (yellow) |
| Dutch | 🇳🇱 | `#F97316` (orange) |
| Czech | 🇨🇿 | `#14B8A6` (teal) |

---

## Deck Registry (`deckRegistry.ts`)

`DECK_REGISTRY: DeckRegistryEntry[]` — in-memory array of metadata-only entries. Each entry has:
- `tier: 1 | 2 | 3` — launch priority
- `status: 'available' | 'coming_soon'`
- `artPlaceholder: { gradientFrom, gradientTo, icon }`

Key API: `getAllDecks()`, `getDecksForDomain(domain)`, `getDeckById(id)`, `getDeckDomains()`.

---

## Fact Index (`deckFactIndex.ts`)

`DECK_FACT_INDEX: Map<string, DeckFactMapping>` — maps deck IDs to fact ID sets, sub-deck breakdowns, and exam-tag indexes.

Filtering in `getCuratedDeckFacts(deckId, subDeckId?, examTags?)`: sub-deck filter is applied first; exam-tag filter is applied to the already-filtered result (most restrictive wins).

---

## Deck Progression (`deckProgressService.ts`)

Progress is derived from the player's FSRS `ReviewState` records stored in `playerSave`. Mastery threshold: `stability >= 21 days`.

```typescript
interface DeckProgress {
  deckId: string
  totalFacts: number
  factsEncountered: number   // facts with any ReviewState
  factsMastered: number      // facts with stability >= 21 days
  averageStability: number   // days (encountered facts only)
  progressPercent: number    // Math.round((mastered / total) * 100)
}
```

---

## Language-Specific Deck Options (`deckOptionsService.ts`)

Persisted to `localStorage` key `card:deckOptions`. Defaults:

| Option | Language | Default |
|---|---|---|
| `furigana` | `ja` | `true` |
| `romaji` | `ja` | `false` |
| `kanaOnly` | `ja` | `false` |
| `pinyin` | `zh` | `true` |
| `pinyinOnly` | `zh` | `false` |
| `romanization` | `ko` | `false` |

---

## Run-Time Fact Assignment

During combat, `deckManager.ts` assigns facts per hand-draw from the run's `factPool` (no permanent binding). Key behaviors:
- **Cooldown**: answered facts are suppressed for `FACT_COOLDOWN_MIN`–`FACT_COOLDOWN_MAX` encounters
- **Cursed facts** bypass cooldown to resurface for cure opportunities
- **First-draw bias**: `funScore >= 7` facts get 2× selection weight for the opening hand
- **Draw smoothing**: guarantees at least one attack card and one chain-type pair per hand
