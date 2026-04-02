# Curated Deck System

> **Purpose:** Explains what curated decks are, how they are structured, loaded, registered, and how player progression is tracked against them.
> **Last verified:** 2026-04-02
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
| `chainThemeId` | yes | numeric index (0–N) mapping to a named chain theme |
| `answerTypePoolId` | yes | Links to an `AnswerTypePool` for distractor selection |
| `grammarNote` | no | Rich grammar explanation for language/grammar facts |
| `targetLanguageWord` | no | The target-language word (vocabulary decks) |
| `pronunciation` | no | Reading (e.g. hiragana for Japanese kanji) |
| `partOfSpeech` | no | Used for POS-matched distractor selection; all vocab decks have this field as of 2026-04-02 |
| `examTags` | no | Filtering tags (e.g. `"USMLE_Step1"`, `"high_yield"`) |
| `quizResponseMode` | no | `'choice'` (default) or `'typing'` (text input) |
| `quizMode` | no | `'text'`, `'image_question'`, or `'image_answers'` |
| `volatile` | no | `true` if the answer may become outdated |

**partOfSpeech coverage:** As of 2026-04-02 all vocabulary decks (Japanese N1–5, Korean TOPIK 1–2, Chinese HSK 1–6, Spanish A1–B2, French A1–B2, German A1–B2, Dutch A1–B2, Czech A1–B2) have `partOfSpeech` on every fact. Values are lowercase: noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection, determiner, particle, number, phrase, expression.

Two backfill scripts produced full coverage:
- `scripts/backfill-pos-field.mjs` — Japanese/Korean source-data pass (2026-04-02). Maps JLPT `word` POS label to `phrase` on ingest.
- `scripts/backfill-pos-from-english.mjs` — English-heuristic pass (2026-04-02). Infers POS from the English `correctAnswer` field for the 26 non-Japanese/Korean language decks (18,650 facts newly tagged, 100% final coverage across 26,454 facts). Rules fire in priority order: grammar-metadata suffixes (“completion marker” → particle), `to `–prefix (verb), exact-match word lists (pronouns, prepositions, conjunctions, adverbs, interjections, determiners), article prefix (`a/an/the ` → noun), morphological noun suffixes (-tion/-ness/-ment/-ity/-ance/-ence/-er/-or etc.), adjective suffixes (-ous/-ful/-al/-ic/-ive/-able), -ing suffix (verb, with noun exceptions list), -ed suffix (verb), number words, default → noun.

**Non-standard fields that must NOT appear in final decks:** `statement`, `wowFactor`, `tags`, `ageGroup` — these are WIP-generation artifacts and must be stripped before a deck is live.

---

## Manifest

`data/decks/manifest.json` lists all active deck filenames. As of 2026-04-02 it contains **65 decks**:

- **Language**: Chinese HSK 1–6, Czech A1–B2, Dutch A1–B2, French A1–B2, German A1–B2, Japanese Hiragana/Katakana/N1–N5/N3 Grammar/N4 Grammar/N5 Grammar, Korean Hangul/TOPIK 1–2, Spanish A1–B2
- **Knowledge**: World Countries/Capitals/Flags, Solar System, US Presidents, Periodic Table, US States, NASA Missions, Greek/Norse/Egyptian Mythology, WWII, Human Anatomy, Ancient Rome/Greece, Famous Inventions, Mammals, Constellations, Famous Paintings, World Cuisines, Medieval World, World Wonders & Landmarks, Dinosaurs & Paleontology, Music History, **Computer Science & Technology**

### Deck Architecture Files

Architecture YAML files in `data/deck-architectures/` hold the verified source data used to generate `.json` fact files. They are the canonical pre-generation source of truth. Some large decks (e.g. `world_wonders`) split generation across multiple architecture files — one per batch — which are then merged by an assembly script.

| File | Deck ID | Status | Facts | Notes |
|---|---|---|---|---|
| `solar_system_arch.yaml` | `solar_system` | complete — live | 76 | Single file |
| `dinosaurs_arch.yaml` | `dinosaurs` | complete — live | 187 | Single file |
| `world_wonders_research_01.yaml` | `world_wonders` | complete — live | ~50 | Batch 1: ancient wonders |
| `world_wonders_research_02.yaml` | `world_wonders` | complete — live | ~50 | Batch 2: sacred monuments |
| `world_wonders_research_03.yaml` | `world_wonders` | complete — live | ~50 | Batch 3: towers + bridges |
| `world_wonders_research_04.yaml` | `world_wonders` | complete — live | ~50 | Batch 4: palaces + monuments + natural + modern |
| `cs_tech_algorithms_arch.yaml` | `computer_science_algorithms` | research complete — pending generation | ~30 | Sub-deck 3: Sorting, search, graph algos, data structures, theory |
| `cs_tech_systems_arch.yaml` | `computer_science_systems` | research complete — pending generation | ~35 | Sub-deck 4: OS, networking, security, acronyms |

The 4 `world_wonders` architecture files total 195 facts in the live deck. They were merged by `data/decks/_wip/assemble-world-wonders.mjs`.

---

## Deck Front Images

All 63 curated decks have pixel art RPG dungeon cover art as of 2026-04-02. Images are served from `public/assets/sprites/deckfronts/` and rendered by `DeckTileV2.svelte` with a CSS parallax hover effect.

**33 unique images** cover all 63 decks. Language sub-decks (e.g. `japanese_n5_vocab`, `japanese_n4`) share their parent image (e.g. `japanese.webp`).

### Naming Convention

| Deck type | Image path | Example |
|---|---|---|
| Knowledge deck | `deckfronts/{deckId}.webp` | `deckfronts/ancient_greece.webp` |
| Language parent | `deckfronts/{language}.webp` | `deckfronts/japanese.webp` |
| Language sub-deck | resolves to parent | `japanese_n5_vocab` → `japanese.webp` |
| ALL-tab synthetic ID | strips `all:` prefix then resolves | `all:japanese` → `japanese.webp` |

**Parent prefix list:** `japanese`, `chinese`, `korean`, `spanish`, `french`, `german`, `dutch`, `czech`.

### Image Specs

- Format: WebP, 768×1024 (3:4 portrait)
- Style: 16-bit pixel art RPG dungeon scene, JRPG tileset aesthetic
- Generated via OpenRouter (`google/gemini-2.5-flash-image`) through the artstudio tool
- Depth maps (`{id}_depth.webp`) stored alongside each image but not currently used in the CSS

Tiles without a matching image fall back to the CSS gradient derived from domain color metadata.

See `.claude/skills/deck-art/SKILL.md` for full generation workflow, prompt templates, and deployment steps.

---

## dinosaurs Deck

`data/decks/dinosaurs.json` — assembled 2026-04-01 from 3 WIP partial files. Fixed 2026-04-01 by `data/decks/_wip/fix-dinosaurs.mjs`.

| Field | Value |
|---|---|
| `id` | `dinosaurs` |
| `domain` | `natural_sciences` |
| `subDomain` | `paleontology` |
| `facts` | 187 |
| `minimumFacts` | 100 |
| `targetFacts` | 140 |

**Chain Themes (7) — stored as numeric IDs:**

| chainThemeId | Name | Facts |
|---|---|---|
| 0 | Apex Predators | 55 |
| 1 | Gentle Giants (sauropods) | 14 |
| 2 | Armored & Horned | 20 |
| 3 | Duck-Bills & Herds | 16 |
| 4 | Ancient Oceans & Skies | 23 |
| 5 | Deep Time | 20 |
| 6 | Dino Spotter (image IDs) | 39 |

**Answer Type Pools (5):**

| Pool ID | Format | Facts |
|---|---|---|
| `dinosaur_names` | name | 104 |
| `geological_periods` | term | 34 |
| `bracket_numbers` | bracket_number | 36 |
| `clade_names` | term | 5 |
| `paleontologist_names` | name | 8 |

**Synonym Groups (5):** tyrannosaurus_names, apatosaurus_brontosaurus_names, ichthyosaurus_names, plesiosaurus_names, mosasaurus_names

**Image facts:** 39 (all in chainThemeId 6 / dino_spotter, `quizMode: image_question`, assets at `/assets/dinosaurs/*.webp`)

**Difficulty:** 1=17, 2=50, 3=83, 4=36, 5=1

**difficultyTiers:** easy=67 (difficulty 1–2), medium=83 (difficulty 3), hard=37 (difficulty 4–5)

**Source WIP files:** `data/decks/_wip/dino_apex_predators.json` (55), `data/decks/_wip/dino_herbivores.json` (50), `data/decks/_wip/dino_sky_sea_deep_images.json` (82)

**Fix script (2026-04-01):** `data/decks/_wip/fix-dinosaurs.mjs` — converted 187 chainThemeId strings to numbers, added distractors to 12 empty-distractor bracket_number facts, populated difficultyTiers[], stripped non-standard fields (statement, wowFactor, tags, ageGroup) from all 187 facts.

---

## world_wonders Deck

`data/decks/world_wonders.json` — assembled 2026-04-01 from 4 WIP partial files.

| Field | Value |
|---|---|
| `id` | `world_wonders` |
| `domain` | `geography` |
| `subDomain` | `wonders_landmarks` |
| `facts` | 195 |
| `minimumFacts` | 120 |
| `targetFacts` | 200 |

**SubDecks (8):**

| SubDeck ID | Name | chainThemeId | Facts |
|---|---|---|---|
| `ancient_wonders` | Ancient Wonders | 0 | 21 |
| `sacred_monuments` | Sacred Monuments | 1 | 18 |
| `towers_skyscrapers` | Towers & Skyscrapers | 2 | 25 |
| `bridges_dams` | Bridges & Dams | 3 | 28 |
| `palaces_castles` | Palaces & Castles | 4 | 26 |
| `monuments_memorials` | Monuments & Memorials | 5 | 23 |
| `natural_wonders` | Natural Wonders | 6 | 26 |
| `modern_marvels` | Modern Marvels | 7 | 28 |

**Answer Type Pools (7):** landmark_names (8), location_country (7), architect_designer (22), year_date (28), measurement_number (92), material_feature (21), person_historical (17)

**Synonym Groups (6):** syn_big_ben, syn_statue_liberty, syn_northern_lights, syn_everest, syn_hagia_sophia, syn_forbidden_city

**Difficulty:** easy=55, medium=99, hard=41

**Assembly script:** `data/decks/_wip/assemble-world-wonders.mjs` — reads the 4 WIP partial fact files, merges them, strips WIP-only fields (subDeckId, statement, wowFactor, categoryL1/2, tags), builds all metadata, and writes the final JSON.

**QA fix script (2026-04-01):** `data/decks/_wip/fix-world-wonders.mjs` — fixed 97 unsafe distractors (pool collision), merged `location_city` pool (2 facts) into `location_country`, and added 1 distractor to each of `ww_anc_parthenon_architect` and `ww_sac_hagia_sophia_architects`. All 12 QA checks now pass.

---

## Answer Type Pools — Synthetic Pool Members

Some answer type pools have too few real facts to produce varied distractors at runtime. **Synthetic pool members** (`AnswerTypePool.syntheticDistractors`) are plausible wrong answers added directly to a pool object that pad the candidate list without having corresponding quiz facts.

**Current state (2026-04-02):** All 230 non-numeric pools across all 65 decks have been padded to ≥ 15 members. The script `scripts/content-pipeline/pad-small-pools.mjs` was run to pad 50 pools, adding 225 synthetic distractors in total. Numeric pools (`bracket_number`, `number`, `year`) are permanently excluded from synthetic padding — they use runtime bracket-notation generation instead.

**When to add synthetics:**
- Pool total (real + synthetic) **< 5** — runtime falls back to per-fact `distractors[]` entirely; synthetics are required to reach the floor
- Pool total **5–14** — pool-based selection works but variety is limited; players may memorize which 4 answers appear with a given question after several encounters
- Pool total **< 15** — add synthetics to reach **15+ total members** (recommended minimum for good variety)
- Never use synthetics for numeric pools — use bracket notation (`{N}`) instead

**Runtime behavior:** Synthetic members enter the candidate pool at score 0.5 (vs 1.0 for real facts). Real members are always preferred. The pool viability check counts real + synthetic combined — if total ≥ 5, pool-based selection proceeds.

**Pool size summary:**

| Total members (real + synthetic) | Behavior |
|----------------------------------|----------|
| < 5 | Falls back to `fact.distractors[]` — no pool variety |
| 5–14 | Pool-based selection active; limited variety |
| 15+ | Good variety; recommended minimum |

**Data format example:**
```json
{ "id": "place_names", "format": "place", "factIds": [...],
  "syntheticDistractors": ["Memphis", "Chicago", "Detroit", "Nashville", "Liverpool"] }
```

For full rules (overlap constraints, best practices, the music_history worked example), see `.claude/skills/deck-master/SKILL.md` — "Synthetic Pool Members" section.

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

---

## Trivia Bridge

Knowledge deck facts can be bridged into `facts.db` so they are available in Trivia Dungeon alongside regular trivia facts.

Key properties:
- **1 per entity**: The bridge selects the single best trivia question per named entity (e.g. one question about T-Rex, one about Lincoln)
- **Same IDs**: Bridged facts keep their original curated deck fact IDs — FSRS review states transfer automatically between Study Temple and Trivia Dungeon
- **Additive**: Existing trivia facts stay in the pool; bridged facts are added alongside them
- **Provenance**: Every bridged fact gets a `"bridge:{deckId}"` tag and lives in `src/data/seed/bridge-curated.json`

A fact answered correctly in Study Temple will already have FSRS progress in Trivia Dungeon, and vice versa. Players are not quizzed on the same knowledge twice from scratch.

Scripts:
- Bridge script: `scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs`
- Config (entity grouping, per-deck settings): `scripts/content-pipeline/bridge/deck-bridge-config.json`

Run the `/curated-trivia-bridge` skill after adding or updating any knowledge deck. Full details: `docs/content/trivia-bridge.md`.

---

## ancient_rome Deck

`data/decks/ancient_rome.json` — 275 facts covering the full arc of Roman civilization.

| Field | Value |
|---|---|
| `id` | `ancient_rome` |
| `domain` | `history` |
| `subDomain` | `ancient_rome` |
| `facts` | 275 |
| `minimumFacts` | 200 |
| `targetFacts` | 280 |

**Answer Type Pools (9):**

| Pool ID | Format | Facts (after 2026-04-01 fix) |
|---|---|---|
| `date_events` | date | dates/counts/numbers |
| `city_place_names` | name | cities, places |
| `general_politician_names` | name | 40 — person names only |
| `political_terms` | term | 65 — terms, phrases, epitaphs, oaths |
| `text_work_names` | name | 6 — text/work titles |
| `battle_names` | name | battle names |
| `structure_names` | name | 29 — building/structure names |
| `emperor_names` | name | emperor names |
| `roman_god_names` | name | Roman deity names |

**Pool fix (2026-04-01):** 10 facts were reassigned from `general_politician_names`, `text_work_names`, and `structure_names` to `political_terms` because their correct answers were non-name types (epithets, oaths, date ranges, phrases) that would appear as bad distractors in person-name questions. See gotchas.md for the lesson.

---

## ancient_greece Deck

`data/decks/ancient_greece.json` — 246 facts covering Classical Greece from the poleis to Alexander.

| Field | Value |
|---|---|
| `id` | `ancient_greece` |
| `domain` | `history` |
| `subDomain` | `ancient_greece` |
| `facts` | 246 |

**Answer Type Pools (8):**

| Pool ID | Format | Facts (after 2026-04-01 fix) |
|---|---|---|
| `ruler_general_names` | name | 38 — person names |
| `concept_terms` | term | 101 — terms, durations, descriptions |
| `date_events` | date | 40 — calendar dates |
| `structure_names` | name | 15 — building/place names |
| `god_names` | name | 16 — Greek deity names |
| `city_state_names` | place | 13 — polis/city names |
| `battle_names` | name | 8 — battle names |
| `work_text_names` | name | 15 — literary/artistic works |

**Pool fix (2026-04-01):** 5 facts were reassigned to correct pools: `greece_cs_ostracism_duration` ("Ten years") and `greece_rel_poseidon_domain` ("Seas, water, storms…") moved from name-format pools to `concept_terms`; `greece_cs_agora_function` (function description) moved to `concept_terms`; `greece_oc_kritios_boy` (artwork title) moved to `work_text_names`; `greece_alex_hellespont_crossing` ("334 BCE") moved from `battle_names` to `date_events`.

---

## music_history Deck

`data/decks/music_history.json` — assembled 2026-04-02 from 5 WIP partial files by `data/decks/_wip/assemble-music-history.mjs`. Pool assignments fixed 2026-04-02 by `data/decks/_wip/fix-music-history-pools.mjs`.

| Field | Value |
|---|---|
| `id` | `music_history` |
| `domain` | `art_architecture` |
| `subDomain` | `music_history` |
| `facts` | 230 |
| `minimumFacts` | 180 |
| `targetFacts` | 230 |

**SubDecks (5):**

| SubDeck ID | Name | chainThemeId | Facts |
|---|---|---|---|
| `classical_masters` | Classical Masters | 0 | 55 |
| `instruments_theory` | Instruments & Theory | 1 | 40 |
| `jazz_blues` | Jazz & Blues | 2 | 45 |
| `rock_pop` | Rock & Pop Revolution | 3 | 50 |
| `world_modern` | World Music & Modern Era | 4 | 40 |

**Answer Type Pools (12):**

| Pool ID | Format | Facts | Synthetics | Notes |
|---|---|---|---|---|
| `artist_names` | name | 72 | — | Real person names only |
| `work_names` | title | 32 | — | Compositions, pieces |
| `album_names` | title | 26 | — | Albums, recordings |
| `genre_names` | term | 22 | — | Genre/style terms |
| `music_terms` | term | 19 | — | Single-word music terminology |
| `instrument_names` | name | 14 | — | Instrument names |
| `bracket_numbers` | bracket_number | 17 | — | Runtime numeric generation |
| `era_names` | term | 8 | — | Era/period labels |
| `place_names` | place | 7 | 10 | Cities, countries, venues |
| `nickname_terms` | term | 5 | 10 | Personal nicknames and epithets |
| `description_terms` | term | 5 | 7 | Multi-word mechanism/technique phrases |
| `company_names` | name | 3 | 8 | Record labels, tech services; minimumSize=3 |

**Pool fix (2026-04-02):** `data/decks/_wip/fix-music-history-pools.mjs` — 17 pure-number answers (years, counts) converted to bracket notation (`{1685}`, `{88}`, etc.) with `bracket_numbers` pool. 20 facts reassigned to correct semantic pools: 7 to `place_names` (England, Salzburg, Bonn, Bayreuth, Cotton Club, Mississippi Delta, New Orleans), 5 to `nickname_terms` (The Red Priest, Papa Haydn, Satchmo, Lady Day, King of Pop), 3 to `company_names` (Sun Records, Napster, Spotify), 5 to `description_terms` (Plucks the strings, Single reed, Double reed, Slide, Short and detached). Four new pools added with syntheticDistractors arrays for sufficient runtime distractor selection.

**Difficulty:**
- easy (1-2): 155 facts
- medium (3): 66 facts
- hard (4-5): 9 facts

**Validation:** 230/230 PASS, 0 FAIL (via `scripts/verify-curated-deck.mjs`)

**Source WIP files:**
- `data/decks/_wip/music_history_classical.json` (55 facts, chainThemeId 0)
- `data/decks/_wip/music_history_theory.json` (40 facts, chainThemeId 1)
- `data/decks/_wip/music_history_jazz.json` (45 facts, chainThemeId 2)
- `data/decks/_wip/music_history_rock.json` (50 facts, chainThemeId 3)
- `data/decks/_wip/music_history_world.json` (40 facts, chainThemeId 4)

**Assembly script:** `data/decks/_wip/assemble-music-history.mjs` — reads all 5 WIP files, checks for duplicate IDs, validates required fields, normalizes missing `acceptableAlternatives`/`volatile` fields, builds `answerTypePools` by scanning facts, builds `difficultyTiers` by difficulty range, builds `subDecks` by chainThemeId, wraps in CuratedDeck envelope, writes output, updates manifest, runs structural validation.

---

## Synthetic Distractor Pools (2026-04-02)

`scripts/add-synthetic-pool-members.mjs` added `syntheticDistractors` arrays to 14 small answer-type pools across 12 knowledge decks. These entries pad pools that had fewer than 8 fact members so the runtime distractor selector always has enough candidates to build a 4-choice question without reaching for facts from other pools.

**Rules enforced by the script:**
- Every synthetic is checked against ALL `correctAnswer` values in the deck (case-insensitive)
- Any synthetic matching an existing correct answer is dropped (20 dropped on this run)
- Synthetics are deduplicated within each pool
- `bracket_number` and `launch_years` pools are excluded — the runtime bracket notation handles those pools automatically

**Pools updated (76 synthetics added total):**

| Deck | Pool ID | Facts | Synthetics Added |
|---|---|---|---|
| `solar_system` | `system_facts` | 3 | 8 |
| `constellations` | `deep_sky_names` | 3 | 5 (3 dropped — already correct answers) |
| `egyptian_mythology` | `god_names` | 3 | 8 |
| `egyptian_mythology` | `symbols_objects` | 5 | 7 |
| `us_presidents` | `party_names` | 7 | 6 (1 dropped — Federalist) |
| `us_presidents` | `home_states` | 7 | 4 (3 dropped — MA, NY, IL) |
| `periodic_table` | `element_categories` | 5 | 5 |
| `nasa_missions` | `spacecraft_names` | 5 | 3 (4 dropped — Gemini, Mercury, Challenger, Discovery) |
| `human_anatomy` | `organ_names` | 7 | 2 (5 dropped — matched existing correct answers) |
| `ancient_rome` | `text_work_names` | 6 | 6 |
| `famous_paintings` | `country_names` | 5 | 5 (2 dropped — Netherlands, Germany) |
| `medieval_world` | `structure_names` | 7 | 5 (1 dropped — Krak des Chevaliers) |
| `world_wonders` | `location_country` | 7 | 6 (1 dropped — Indonesia) |
| `dinosaurs` | `clade_names` | 5 | 6 |

**Validation:** All 12 modified decks pass 0 FAIL after the change. Run `node scripts/verify-curated-deck.mjs <deck_id>` to verify.

---

## human_anatomy Deck

`data/decks/human_anatomy.json` — 2009 facts covering human anatomy across 17 sub-decks, including 818 visual image-answer facts.

| Field | Value |
|---|---|
| `id` | `human_anatomy` |
| `domain` | `natural_sciences` |
| `subDomain` | `human_anatomy` |
| `facts` | 2009 |

**Sub-Decks (17):**

| SubDeck ID | Name | Facts |
|---|---|---|
| `skeletal_system` | Skeletal System | 80 |
| `muscular_system` | Muscular System | 140 |
| `cardiovascular` | Cardiovascular System | 115 |
| `nervous_system` | Nervous System | 125 |
| `digestive_system` | Digestive System | 65 |
| `respiratory_system` | Respiratory System | 54 |
| `urinary_system` | Urinary System | 44 |
| `reproductive_system` | Reproductive System | 54 |
| `endocrine_system` | Endocrine System | 53 |
| `lymphatic_immune` | Lymphatic & Immune System | 44 |
| `special_senses` | Special Senses | 39 |
| `integumentary` | Integumentary System | 48 |
| `visual_anatomy` | Visual Anatomy | 818 |
| `clinical_anatomy` | Clinical Anatomy | 90 |
| `embryology` | Embryology | 90 |
| `regional_anatomy` | Regional Anatomy | 60 |
| `histology` | Histology | 90 |

**Answer Type Pools (12):**

| Pool ID | Format | Facts | Notes |
|---|---|---|---|
| `bone_names` | — | 44 | |
| `muscle_names` | — | 68 | |
| `structure_names` | — | 1182 | Largest pool; image-answer facts use this |
| `nerve_names` | — | 65 | |
| `vessel_names` | — | 15 | |
| `organ_names` | — | 7 | +2 synthetics (5 dropped — matched correct answers) |
| `function_terms` | — | 260 | |
| `location_terms` | — | 58 | |
| `number_stats` | — | 104 | |
| `clinical_terms` | — | 130 | |
| `tissue_types` | — | 57 | |
| `immune_terms` | — | 19 | |

**Quiz Modes:**
- 1191 text facts (no `quizMode`)
- 409 image question facts (`quizMode: "image_question"`)
- 409 image answer facts (`quizMode: "image_answers"`) — player sees question text, picks from image options

**Difficulty:** 1=289, 2=875, 3=765, 4=26 (54 unset)

**Fix (2026-04-02):** 19 `image_answers` facts had duplicate `quizQuestion` text across 9 groups (same structure shown from multiple angles). Fixed by `data/decks/_wip/fix-anatomy-duplicate-questions.mjs` (cleaned up after run). Each question now incorporates a parenthetical view label derived from the explanation: e.g. "Which image shows the Skull (lateral view)?", "Which image shows the Skull (inferior/base view)?". Validation: 2009/2009 PASS.

---

## computer_science Deck

`data/decks/computer_science.json` — 296 facts spanning the full arc of computing history and technology.

| Field | Value |
|---|---|
| `id` | `computer_science` |
| `domain` | `general_knowledge` |
| `facts` | 296 |
| `answerTypePools` | 10 |
| `status` | `available` |

**SubDecks (8):**

| SubDeck ID | Name | chainThemeId | Notes |
|---|---|---|---|
| `pioneers` | Pioneers & Visionaries | 0 | Key figures in computing history |
| `hardware` | Hardware & Architecture | 1 | CPUs, memory, physical components |
| `languages` | Programming Languages | 2 | Language history, paradigms, syntax trivia |
| `algorithms` | Algorithms & Theory | 3 | Sorting, search, graph algos, complexity, data structures |
| `systems_networks` | Systems, Networks & Security | 4 | OS concepts, networking, cybersecurity |
| `internet_web` | The Internet & World Wide Web | 5 | Protocols, web history, standards |
| `ai_ml` | Artificial Intelligence & ML | 6 | AI history, machine learning concepts, milestones |
| `software_companies` | Software & Tech Companies | 7 | Major companies, products, corporate history |

**QA fix script (2026-04-02):** `data/decks/_wip/computer_science/fix-qa.mjs` — applied 23 patches to the deck:

*Deletions (5 facts removed, 301 → 296):*
- `cs_1_analytical_engine_punch_cards` — near-duplicate of `cs_0_charles_babbage_analytical_engine`
- `cs_4_arpanet_first_message` — cross-batch duplicate of `cs_5_arpanet_first_message` (kept batch 5 version)
- `cs_4_arpanet_year` — cross-batch duplicate of `cs_5_arpanet_first_message_date` (kept batch 5 version)
- `cs_7_linux_creator` — cross-batch duplicate of `cs_4_linux_creator` (kept batch 4 version)
- `cs_7_linux_year` — cross-batch duplicate of `cs_4_linux_year` (kept batch 4 version)

*Distractor fixes (10 facts):*
- `cs_0_brendan_eich_javascript_original_name` — removed "Mocha" from distractors (real earlier name), added to `acceptableAlternatives`; updated question wording to target the final pre-rename name; added "JScript" as replacement distractor
- `cs_4_enigma_breakers` — removed "Gordon Welchman" from distractors (legitimate co-contributor), added to `acceptableAlternatives`; replaced with "Charles Babbage"
- `cs_5_mosaic_creator` — removed "Eric Bina" from distractors (real co-creator), replaced with "Tim O'Reilly"
- `cs_6_turing_test_paper` — removed "Can Machines Think?" from distractors (paper's own opening question — ambiguous), replaced with "Artificial Neural Computations"
- `cs_3_mergesort_complexity` — added "Θ(n log n)" to `acceptableAlternatives` (equivalent notation), replaced in distractors with "O(n + log n)"
- `cs_3_np_complete_first_problem` — removed "3-SAT" from `acceptableAlternatives` (3-SAT is a separate NP-complete problem, not the Cook-Levin first proof)
- `cs_1_von_neumann_vs_harvard` — removed "stored-program computer" from distractors (describes the same concept), replaced with "dataflow architecture"
- `cs_1_harvard_architecture_origin` — removed "stored-program computer" from distractors, replaced with "systolic array architecture"
- `cs_1_four_generations_summary` — removed "integrated circuit" from distractors (3rd gen, closely related to correct answer "microprocessor"), replaced with "quantum processor"
- `cs_1_transistor_replaced` — removed "relay" from distractors (partially correct — relays were also replaced by transistors), replaced with "punched card"

*Question/answer fixes (7 facts):*
- `cs_5_netflix_founders` — fixed question that reversed who charged late fees; new wording correctly positions Netflix as subscription-based vs Blockbuster's brick-and-mortar model
- `cs_7_github_founders` — removed "(not Stack Overflow's Joel Spolsky)" hint from question text
- `cs_0_larry_page_pagerank` — removed "named after him" hint from question text
- `cs_0_vint_cerf_tcp_ip` — changed "father of the Internet" to "one of the 'fathers of the Internet'" (shared credit with Kahn)
- `cs_6_alphago_creator` — removed "Google" as standalone `acceptableAlternatives` entry (imprecise; kept "DeepMind" and "Google DeepMind")
- `cs_0_james_gosling_java_name` — added "Green" to `acceptableAlternatives` (Java went Oak → Green → Java)
- `cs_1_floppy_disk_first_size` — changed `answerTypePoolId` from `bracket_numbers` to `technology_terms` (answer "8" is not in bracket notation); added explicit distractors `["3.5", "5.25", "12", "14", "6", "10", "4", "16"]`

**Validation:** 296/296 PASS, 0 FAIL (via `scripts/verify-curated-deck.mjs`)

---

## japanese_n5_grammar Deck

`data/decks/japanese_n5_grammar.json` — generated 2026-04-02 by `scripts/content-pipeline/vocab/build-n5-grammar-fill-blanks.mjs`.

**Fill-in-the-blank format.** Each fact presents a Japanese sentence with the target grammar point replaced by `{___}`. The player chooses the correct grammar point to complete the sentence.

| Field | Value |
|---|---|
| `id` | `japanese_n5_grammar` |
| `domain` | `vocabulary` |
| `subDomain` | `japanese_grammar` |
| `facts` | 375 |
| `minimumFacts` | 200 |
| `targetFacts` | 375 |

**Source files:**
- `data/raw/japanese/grammar-n5-sentences.json` — 90 grammar points × 3–5 example sentences each
- `data/raw/japanese/grammar-n5-confusion-groups.json` — confusion groups, syntactic slots, synonym groups

**Build script pipeline (3 phases):**
1. **Phase 1 — extraction:** For each sentence, locates the grammar point and replaces it with `{___}`. Single-char particles (は, が, を, に, で, へ, も, の, か, と, や) are found by first occurrence. Multi-char patterns use a `pointId`-keyed surface-form lookup table.
2. **Phase 2 — distractors:** 3-tier priority: same confusion group (3–4), same syntactic slot (3–4), broad pool (1–2). Target 8–10 distractors per fact.
3. **Phase 3 — assembly:** Builds `answerTypePools` (one per syntactic slot ≥5 facts + `grammar_misc` + `grammar_all` master pool), `synonymGroups`, `difficultyTiers`, and the full `CuratedDeck` JSON.

**Answer Type Pools (10):**

| Pool ID | Facts |
|---|---|
| `grammar_all` (master) | 375 |
| `particle_case` | 148 |
| `verb_form` | 133 |
| `sentence_ender` | 38 |
| `request_permission` | 30 |
| `question_word` | 22 |
| `particle_topic_focus` | 15 |
| `demonstrative` | 15 |
| `existence_pattern` | 9 |
| `adjective_form` | 6 |

**Difficulty distribution:**
- Easy (1–2): 195 facts — basic particles (は, が, を, に, で), common copula, question particles
- Medium (3): 180 facts — te-form patterns, reason/cause connectors, compound patterns
- Hard (4–5): 0 facts (all N5 content falls in easy/medium)

**Distractor coverage:** 375/375 facts have ≥5 distractors (100%).

**Validator note:** The `verify-curated-deck.mjs` script flags every fact with "Question contains literal braces" — this is a known false-positive for fill-blank grammar decks (identical behaviour in `japanese_n3_grammar`). The `{___}` marker is the intended question blank format, not a template literal.

**chainThemeId:** Rotates 0–5 sequentially across all facts (grammar decks use generic chain slots, not named themes).

---

## japanese_n4_grammar Deck

`data/decks/japanese_n4_grammar.json` — 400 facts covering intermediate JLPT N4 grammar patterns.

**Fill-in-the-blank format.** Each fact presents a Japanese sentence with the target grammar point replaced by `{___}`. The player chooses the correct grammar point to complete the sentence.

| Field | Value |
|---|---|
| `id` | `japanese_n4_grammar` |
| `domain` | `vocabulary` |
| `subDomain` | `japanese_grammar` |
| `facts` | 400 (was 401 before QA — deleted mislabeled kara-tsukuru-fill-2) |
| `minimumFacts` | 300 |
| `targetFacts` | 401 |

**Answer Type Pools (14):**

| Pool ID | Facts |
|---|---|
| `grammar_all` (master) | 400 |
| `grammar_misc` | 144 |
| `temporal` | 33 |
| `appearance_hearsay` | 33 |
| `conditional` | 26 |
| `te_form_giving` | 24 |
| `te_form_aspect` | 23 |
| `obligation` | 17 |
| `negation_degree` | 17 |
| `honorific` | 16 |
| `causative_passive` | 13 |
| `difficulty_ease` | 13 |
| `quotation` | 12 |
| `purpose_intent` | 29 |

**Difficulty distribution:**
- Easy (2): 96 facts
- Medium (3): 263 facts
- Hard (4): 41 facts

**Synonym groups (8):** `syn_must`, `syn_appearance` (ようだ/みたいだ), `syn_difficulty` (にくい/づらい), `syn_but_formal` (しかし/でも/けれども), `syn_wonder` (かな/かしら), `syn_reason` (ので/なので), `syn_conditional_ba_tara` (ば/たら), `syn_favor` (てあげる/てやる)

**QA fixes applied 2026-04-02:**
- Removed interchangeable synonyms from each other's distractor arrays and added to `acceptableAlternatives` for: ようだ/みたいだ, にくい/づらい, なので/ので, しかし/でも/けれども, ば/たら, てあげる/てやる, 場合は/たら
- Fixed `kudasai-fill-0` through `-fill-3`: blank repositioned to test full `ください` (was testing fragment `さい`)
- Deleted `kara-tsukuru-fill-2`: mislabeled — correctAnswer was `ています`, not a から作る pattern
- Fixed `ni-ki-ga-tsuku-fill-0/1/2`: `targetLanguageWord` truncation に気がつ → に気がつく
- Added 3 new synonym groups: `syn_reason`, `syn_conditional_ba_tara`, `syn_favor`
- Rebuilt `grammar_all` master pool to 400 facts; `grammar_misc` pool synced to 144

**Validator note:** The `verify-curated-deck.mjs` script flags every fact with "Question contains literal braces" — this is a known false-positive for fill-blank grammar decks. The `{___}` marker is the intended question blank format, not a template literal.

**chainThemeId:** Rotates 0–5 sequentially across all facts (grammar decks use generic chain slots, not named themes).
