# Curated Deck System

> **Purpose:** Explains what curated decks are, how they are structured, loaded, registered, and how player progression is tracked against them.
> **Last verified:** 2026-04-05
> **Source files:** `src/data/curatedDeckStore.ts`, `src/data/deckRegistry.ts`, `src/data/deckFactIndex.ts`, `src/data/curatedDeckTypes.ts`, `src/services/deckManager.ts`, `src/services/deckOptionsService.ts`, `src/services/deckProgressService.ts`, `src/services/dbDecoder.ts`, `public/curated.db`

---

## What Is a Curated Deck?

A curated deck is a themed, hand-authored collection of facts organized around a specific topic (e.g. `world_war_ii`, `japanese_n3`, `periodic_table`). Every fact in a curated deck is a `DeckFact` object with a verified correct answer, pre-generated distractors, difficulty and fun scores, and optional vocabulary-specific fields.

Curated decks are distinct from the trivia `facts.db` SQLite database. They are packaged into `public/curated.db` (a single SQLite file) and fetched + decoded at runtime — never compiled into the JS bundle.

### Authoring Format vs. Distribution Format

**JSON is the authoring format. SQLite is the distribution format.** The content-agent edits JSON files in `data/decks/`. These are never served directly to users. At build time, `scripts/build-curated-db.mjs` compiles all active JSON decks into `public/curated.db` (a single SQLite file). The production build then XOR-obfuscates both `curated.db` and `facts.db` via `scripts/obfuscate-db.mjs`.

| Step | Command | Output |
|---|---|---|
| Compile decks to SQLite | `npm run build:curated` | `public/curated.db` |
| Obfuscate for production | `npm run build:obfuscate` | `public/curated.db` (XOR'd), `public/facts.db` (XOR'd) |
| Full production build | `npm run build` | includes both steps above |

`public/curated.db` is a build artifact — do not edit it directly. To add or modify deck content, edit the JSON files in `data/decks/` and re-run `npm run build:curated`.

---

## Deck Types

### Exam-Aligned Decks
Decks covering material from standardized exams (AP, JLPT, CEFR, TOPIK, HSK, USMLE, NCLEX, SAT, IB, GCSE/A-Level) are structured to match the exam's official scope document. Every testable concept is covered, content is weighted by exam importance, and facts include the `examTags` field for filtering by exam name and unit/section. See `.claude/rules/content-pipeline.md` — "Exam-Aligned Deck Standard" section — for the full standard. AP Biology is the first deck built under this standard.

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
| `subDecks` | `{id,name,factIds}[]?` | Optional sub-groupings (e.g. Vocabulary/Kanji/Grammar for Japanese). Names should be descriptive and player-facing — avoid generic prefixes like "Unit N:" or opaque abbreviations. |

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

**partOfSpeech coverage:** As of 2026-04-03 all vocabulary decks (Japanese N1–5, Korean TOPIK 1–2, Chinese HSK 1–6, Spanish A1–B2, French A1–B2, German A1–B2, Dutch A1–B2, Czech A1–B2) have `partOfSpeech` on every fact. Values are lowercase: noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection, determiner, particle, number, phrase, expression. Note: japanese_n4 had 49 facts missing the field (facts with POS "word" in explanation) — backfilled 2026-04-03 using the same regex as `backfill-pos-field.mjs`.

Two backfill scripts produced full coverage:
- `scripts/backfill-pos-field.mjs` — Japanese/Korean source-data pass (2026-04-02). Maps JLPT `word` POS label to `phrase` on ingest. NOTE: skips japanese_n4 (incorrectly believed complete); n4 was separately fixed 2026-04-03 (49 facts, inline patch).
- `scripts/backfill-pos-from-english.mjs` — English-heuristic pass (2026-04-02). Infers POS from the English `correctAnswer` field for the 26 non-Japanese/Korean language decks (18,650 facts newly tagged, 100% final coverage across 26,454 facts). Rules fire in priority order: grammar-metadata suffixes (“completion marker” → particle), `to `–prefix (verb), exact-match word lists (pronouns, prepositions, conjunctions, adverbs, interjections, determiners), article prefix (`a/an/the ` → noun), morphological noun suffixes (-tion/-ness/-ment/-ity/-ance/-ence/-er/-or etc.), adjective suffixes (-ous/-ful/-al/-ic/-ive/-able), -ing suffix (verb, with noun exceptions list), -ed suffix (verb), number words, default → noun.

**Non-standard fields that must NOT appear in final decks:** `statement`, `wowFactor`, `tags`, `ageGroup` — these are WIP-generation artifacts and must be stripped before a deck is live.

---

## Manifest

`data/decks/manifest.json` lists all active deck filenames. As of 2026-04-04 it contains **75 decks**:

- **Language**: Chinese HSK 1–6, Czech A1–B2, Dutch A1–B2, French A1–B2, German A1–B2, Japanese Hiragana/Katakana/N1–N5/N3 Grammar/N4 Grammar/N5 Grammar, Korean Hangul/TOPIK 1–2, Spanish A1–B2
- **Knowledge**: World Countries/Capitals/Flags, Solar System, US Presidents, Periodic Table, US States, NASA Missions, Greek/Norse/Egyptian Mythology, WWII, Human Anatomy, Ancient Rome/Greece, Famous Inventions, Mammals, Constellations, Famous Paintings, World Cuisines, Medieval World, World Wonders & Landmarks, Dinosaurs & Paleontology, Music History, **Computer Science & Technology**, **Movies & Cinema**, **Medical Terminology**, **AP Psychology**, **AP Biology**, **AP U.S. History**, **AP Chemistry**, **AP World History: Modern**, **AP Physics 1: Algebra-Based**

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
| `ap_biology_arch_meta.yaml` | `ap_biology` | generation reference — live deck exists | 363 | Chain-theme-organized generation reference (meta file) |
| `ap_biology_arch.yaml` | `ap_biology` | master architecture — pending full fact generation | 1100 target | Master arch: 11 pools, 11 templates, 18 chain themes, 8 sub-decks, 12 CED equations |
| `ap_chemistry_arch.yaml` | `ap_chemistry` | architecture complete — live deck exists | 620 target (assembled) | CED-aligned, 6 chain themes, 16 pools, 22 templates, 5 sub-decks; exam Fall 2024 |
| `ap_world_history_arch.yaml` | `ap_world_history` | complete — live | 620 | CED-aligned, 9 chain themes, 15 pools, 9 sub-decks; assembled 2026-04-04 |
| `ap_biology_unit2_arch.yaml` | `ap_biology_unit2` | architecture complete — pending fact generation | 130 target | Unit 2: Cell Structure and Function (Topics 2.1–2.11); 2 chain themes, 8 pools, ~130 verified facts in arch |
| `ap_biology_unit3_arch.yaml` | `ap_biology_unit3` | architecture complete — pending fact generation | 160 target | Unit 3: Cellular Energetics (Topics 3.1–3.7); 3 chain themes, 7 pools, 7 templates, ~110 verified facts in arch |
| `ap_biology_unit5_arch.yaml` | `ap_biology_unit5` | architecture complete — pending fact generation | 110 target | Unit 5: Heredity (Topics 5.1–5.6); 2 chain themes, 8 pools, 97 verified entities in arch |
| *(inline generation)* | `ap_physics_1` | complete — live | 326 | CED-aligned Fall 2024; 8 units, 10 chain themes, 11 answer pools, 8 sub-decks; expanded 2026-04-04; pool homogeneity remediation 2026-04-04 and 2026-04-05 (`fluid_properties`→`quantity_definitions`, `collision_types`→`term_definitions`; `force_type_names`/`rotational_quantities` synthetics added); sourced from OpenStax/HyperPhysics |
| *(inline generation)* | `world_cuisines` | complete — live, pool-redesigned | 141 | Pool redesign 2026-04-05 (5 pools → 9): split `technique_terms` into `person_names_food` + technique; split `country_region_names` into `civilization_names` + `compound_location_names`; added `cultural_references`; moved percentage/short-answer outliers. 0 quiz-audit fails. |
| *(inline generation)* | `famous_inventions` | complete — live, pool-redesigned | 200 | Pool redesign 2026-04-05 (5 pools → 10): split 104-fact `term` pool into `invention_specs` (short ≤20c), `invention_details` (long), `discovery_descriptions` (narratives), `invention_dates`; split `name` into `person_inventor_names` + `invention_names`; added `tech_codes` for acronyms ≤7c; split `number` into `percentage_values` + `count_values`. 0 quiz-audit fails. |

The 4 `world_wonders` architecture files total 195 facts in the live deck. They were merged by `data/decks/_wip/assemble-world-wonders.mjs`.

---

## Verification & Quality Gates

### Batch Verifier — `scripts/verify-all-decks.mjs`

Runs 20 checks across all decks. Must produce 0 failures before committing deck changes.

```bash
node scripts/verify-all-decks.mjs           # Summary table
node scripts/verify-all-decks.mjs --verbose  # Per-fact failure details
```

**20 checks — 13 structural + 6 content quality + 1 pool homogeneity:**

Structural (FAIL): braces in answer/question, answer-in-distractors, duplicate distractors, distractor count, pool size, missing fields, non-numeric bracket distractors, missing explanation, duplicate questions, orphaned pool refs, empty pools, template-pool placeholder compatibility.

Content quality: answer too long (FAIL >100 chars, WARN >60), question too long (FAIL >400 chars, WARN >300), difficulty out of range (FAIL), funScore out of range (FAIL), explanation too short (WARN <20 chars), explanation duplicates question (WARN).

Pool homogeneity (check #20, non-vocab only): Per pool, if the max/min display-length ratio of non-bracket answers exceeds 3x → FAIL (displayed); exceeds 2x → WARN. Catches pools that mix very short answers with long ones, making the correct answer visually obvious. Bracket-number answers are excluded (numerical distractors are algorithmic). NOTE: Pool-homogeneity FAIL does NOT block commits — it is informational only, since educational content inherently has name-length variation (e.g. 'Pons' vs 'Visceral and parietal pleura' in the same anatomy pool). The 3x threshold is a quality guide, not a hard gate. Use `pool-homogeneity-analysis.mjs` for detailed per-pool analysis.

### Unit Tests — `tests/unit/deck-content-quality.test.ts`

10 Vitest tests run as part of `npx vitest run`. Hard-fail thresholds only (one test currently `.skip` pending pool remediation):
- Answer length ≤100 chars (knowledge decks)
- Question length ≤400 chars
- Difficulty 1-5 (all facts)
- funScore 1-10 (all facts)
- Non-empty explanation (all facts)
- No correctAnswer in own distractors
- All pool/fact cross-references valid
- No empty pools in knowledge decks
- Pool answer-length homogeneity: max/min ratio ≤4x per pool (currently `it.skip` — unskip after remediation)

### Pre-Commit Checklist

After ANY deck modification:
1. `node scripts/verify-all-decks.mjs` → 0 failures
2. `npx vitest run tests/unit/deck-content-quality.test.ts` → 9/9 pass (10th test skipped pending pool remediation)
3. `npm run typecheck && npm run build` → clean
4. **Trivia Bridge (knowledge decks only):** Add deck to `deck-bridge-config.json`, run `node scripts/content-pipeline/bridge/extract-trivia-from-decks.mjs`, verify 0 collisions. Commit `bridge-curated.json` + `bridge-manifest.json` alongside the deck. Language/vocab decks are exempt. See `docs/content/trivia-bridge.md`.

---

## Deck Front Images

All 65 curated decks have pixel art RPG dungeon cover art as of 2026-04-02. Images are served from `public/assets/sprites/deckfronts/` and rendered by `DeckTileV2.svelte` with a CSS parallax hover effect.

**33 unique images** cover all 65 prior decks.  falls back to the CSS gradient (no deckfront image yet). Language sub-decks (e.g. `japanese_n5_vocab`, `japanese_n4`) share their parent image (e.g. `japanese.webp`).

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
| `sacred_monuments` | Temples & Sacred Sites | 1 | 18 |
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


## movies_cinema Deck

`data/decks/movies_cinema.json` — assembled 2026-04-03 from 7 WIP batch files, then expanded 2026-04-03 by merging 3 supplement batches (supp1/2/3) totalling 70 additional facts.

| Field | Value |
|---|---|
| `id` | `movies_cinema` |
| `domain` | `art_architecture` |
| `subDomain` | `film` |
| `facts` | 277 |
| `minimumFacts` | 150 |
| `targetFacts` | 277 |

**SubDecks (3):**

| SubDeck ID | Name | Facts |
|---|---|---|
| `iconic_films` | Classic & Legendary Films | 138 |
| `directors_and_stars` | Directors, Actors & Legends | 67 |
| `cinema_craft` | Film History & Technique | 72 |

**Answer Type Pools (10):**

| Pool ID | Format | Facts | Members | Notes |
|---|---|---|---|---|
| `director_names` | name | 59 | 39 | |
| `film_titles` | name | 69 | 55 | +11 from supp3 |
| `actor_names` | name | 44 | 35 | +5 from supp3 |
| `bracket_years` | bracket_year | 32 | 31 | +12 from supp2 |
| `cinema_terms` | term | 20 | 20 | +7 from supp3 |
| `character_names` | name | 23 | 22 | +15 from supp1 |
| `film_quotes` | quote | 10 | 10 | new pool — supp1 |
| `country_names` | name | 10 | 10 | new pool — supp2; +10 syntheticDistractors |
| `film_trivia` | mixed | 6 | 6 | |
| `bracket_counts` | bracket_number | 4 | 4 | |

**Architecture targets vs actual (post-merge):**
film_titles 55/55 OK, director_names 39/28 OK, actor_names 35/35 OK, character_names 22/22 OK, cinema_terms 20/18 OK, bracket_years 31/30 OK. film_quotes 10/18 SHORT (only 10 facts exist), country_names 10/12 SHORT (10 facts + 10 syntheticDistractors = 20 runtime pool members). Both short pools pass structural validation (minimumSize 5).

**Difficulty:** easy=147 (difficulty 1–2), medium=91 (difficulty 3), hard=39 (difficulty 4–5)

**Supplement sources:**
- `_wip/movies_cinema_supp1.json` — 25 facts: 15 character_names + 10 film_quotes → iconic_films sub-deck
- `_wip/movies_cinema_supp2.json` — 22 facts: 12 bracket_years → iconic_films, 10 country_names → cinema_craft
- `_wip/movies_cinema_supp3.json` — 23 facts: 7 cinema_terms → cinema_craft, 11 film_titles → iconic_films, 5 actor_names → directors_and_stars

**Original source WIP files:** `data/decks/_wip/movies_cinema_batch1.json` (30 facts, classic pre-1970), `batch2.json` (30, 1970–1995), `batch3.json` (30, modern + quotes), `batch4.json` (32, directors), `batch5.json` (30, actors/characters), `batch6.json` (28, cinema history), `batch7.json` (27, techniques/craft/records)

---

## medterm_roots_cardio_resp WIP File

`data/decks/_wip/medterm_roots_cardio_resp.json` — generated 2026-04-03. 30 medical terminology root word facts covering cardiovascular and respiratory combining forms.

| Field | Value |
|---|---|
| Status | WIP — not yet assembled into a live deck |
| Facts | 30 |
| Domain | `human_body_health` / `medical_science` |
| answerTypePoolId | All 30 facts share a single pool: `root_meanings` |

**Cardiovascular roots (15):** cardi/o, angi/o, arteri/o, phleb/o, ven/o, hem/o, hemat/o, thromb/o, ather/o, aort/o, valvul/o, sphygm/o, vas/o, coron/o, sept/o

**Respiratory roots (15):** pulmon/o, pneumon/o, bronch/o, pneum/o, laryng/o, trache/o, pharyng/o, nas/o, rhin/o, pleur/o, thorac/o, ox/i, capn/o, spir/o, sinus/o

**chainThemeId distribution:** 5 facts per ID (0–5, evenly distributed)

**Synonym pairs noted in explanations:** phleb/o and ven/o (both = vein), hem/o and hemat/o (both = blood), pulmon/o and pneumon/o (both = lung), nas/o and rhin/o (both = nose)

**Non-standard WIP fields present:** `statement`, `wowFactor`, `tags`, `ageGroup`, `visualDescription` — must be stripped by the assembly script before the deck goes live.

**Source:** Wikipedia — [List of medical roots, suffixes and prefixes](https://en.wikipedia.org/wiki/List_of_medical_roots,_suffixes_and_prefixes)

---


## medical_terminology Deck

`data/decks/medical_terminology.json` — assembled 2026-04-03 from 17 Sonnet worker batches (2 waves + 2 supplement batches for rate-limit recovery). Gap-fill pass 2026-04-03 added 65 facts covering obstetrics, anatomical positions, and lab abbreviations (NCBI 17-chapter curriculum comparison).

| Field | Value |
|---|---|
| `id` | `medical_terminology` |
| `domain` | `human_body_health` |
| `facts` | 700 |
| `minimumFacts` | 400 |
| `targetFacts` | 700 |

**SubDecks (5):**

| SubDeck ID | Name | Facts |
|---|---|---|
| `prefixes` | Prefixes | 83 |
| `suffixes` | Suffixes | 62 |
| `body_roots` | Anatomical Roots & Body Systems | 335 |
| `conditions` | Conditions | 159 |
| `procedures` | Procedures | 61 |

**Coverage note (2026-04-03):** Gap-fill added obstetrics terms (25 facts), anatomical position/directional terms (15 facts), lab abbreviation meanings (15 facts), and 10 missing word parts identified via NCBI 17-chapter curriculum comparison. Deck is now aligned with NCBI Bookshelf Medical Terminology curriculum scope.

**Answer Type Pools (8):** prefix_meanings (83), suffix_meanings (62), root_meanings (335), organ_names, combining_forms, body_systems, condition_names (159), procedure_names (61)

**Synonym groups:** phleb/o–ven/o (vein), hem/o–hemat/o (blood), pulmon/o–pneumon/o (lung), nas/o–rhin/o (nose) — plus additional pairs across Anatomical Roots & Body Systems sub-deck

**Sources:** Wikipedia (CC-BY-SA-4.0), Wikidoc (CC-BY-SA-3.0), NCBI Bookshelf (public domain), UWF Medical Terminology (CC-BY-4.0), GlobalRPH (reference)

**Provenance doc:** `docs/deck-provenance/medical_terminology.md`

---

## ap_psychology Deck

`data/decks/ap_psychology.json` — assembled 2026-04-03. Exam-aligned to the College Board AP Psychology Course and Exam Description (CED) 2024–25, covering 5 units and 35 topics.

| Field | Value |
|---|---|
| `id` | `ap_psychology` |
| `domain` | `social_sciences` |
| `subDomain` | `psychology` |
| `facts` | 393 |
| `minimumFacts` | 300 |
| `targetFacts` | 393 |

**Chain Themes (9):**

| chainThemeId | Name |
|---|---|
| 0 | The Neural Forge |
| 1 | The Mind Palace |
| 2 | The Sensory Labyrinth |
| 3 | The Reasoning Chamber |
| 4 | The Growth Spiral |
| 5 | The Conditioning Pit |
| 6 | The Social Nexus |
| 7 | The Mask Gallery |
| 8 | The Shadow Ward |

**Answer Type Pools (14):** 14 pools covering terms, theorists, brain regions, research methods, disorders, treatments, and behavioral concepts.

**Synonym Groups (20):** 20 synonym groups covering alternate names for theories, theorists, and psychological terminology.

**Exam alignment:** College Board AP Psychology CED (2024–25). Covers 5 units across 35 topics — all major content areas testable on the AP exam are represented.

**Pool homogeneity remediation (2026-04-04):** 11 pools were failing (>3x ratio). Fixed by expanding 124 short answers with context parentheticals. Strategy per pool:
- `researcher_names`: expanded 18 short entries ("Sandra Bem" → "Sandra Bem (gender schema)"); trimmed 2 long pair-name entries ("Daniel Simons and Christopher Chabris" → "Simons and Chabris").
- `brain_structures`: expanded 12 short entries ("Amygdala" → "Amygdala (fear/emotion)"); trimmed "Somatic and autonomic nervous systems" → "Somatic and autonomic NS".
- `neurotransmitter_names`: expanded "GABA" → "GABA (inhibitory)".
- `psych_concept_terms`: expanded 58 short entries (3–16c) with context parentheticals; trimmed 3 long entries >30c.
- `disorder_names`: expanded "ADHD" → "ADHD (attention disorder)".
- `therapy_types`: expanded "Flooding" → "Flooding (exposure therapy)".
- `dev_stage_names`: expanded 8 short entries (7–15c); trimmed "Avoidant, anxious-ambivalent, and disorganized" → "Avoidant/anxious/disorganized".
- `sensation_terms`: expanded "rods" → "Rods (dim-light receptors)", "Closure" → "Closure (Gestalt complete)".
- `memory_terms`: expanded 4 short entries ("Recall" → "Recall (active retrieval)", etc.).
- `social_psych_terms`: expanded "Attitude" → "Attitude (evaluative belief)".
- `personality_terms`: expanded 6 short entries ("Id" → "Id (pleasure principle)", "Ego" → "Ego (reality principle)", etc.).
- **Result:** 0 FAIL, 8 WARN (all at 2.3–2.9x — inherent to name pools with varied formats).

---

## ap_biology Deck

`data/decks/ap_biology.json` — assembled 2026-04-03, expanded to 1123 facts. Exam-aligned to the College Board AP Biology CED (2025-26, effective Fall 2025), covering all 8 units and Topics 1.1 through 8.7.

Architecture (generation reference): `data/deck-architectures/ap_biology_arch_meta.yaml`
Master architecture (1100-fact target): `data/deck-architectures/ap_biology_arch.yaml`
Research: `data/deck-architectures/_research/ap_biology_ced_extraction.md`
Assembly script: `scripts/assemble-ap-biology-deck.mjs`

| Field | Value |
|---|---|
| `id` | `ap_biology` |
| `domain` | `natural_sciences` |
| `subDomain` | `biology` |
| `minimumFacts` | 320 |
| `targetFacts` | 1100 |
| **Actual facts** | **1123** |
| Pools | 22 |
| Synonym groups | 22 |
| Duplicate IDs resolved | 2 (`ap_bio_cholesterol_membrane`, `ap_bio_dna_antiparallel`) |

**Chain Themes (8):**

| chainThemeId | Name | CED Unit | Facts |
|---|---|---|---|
| 0 | The Molecular Forge | Unit 1: Chemistry of Life | 34 |
| 1 | Cellular Architecture | Unit 2: Cell Structure and Function | 47 |
| 2 | The Powerhouse | Unit 3: Cellular Energetics | 50 |
| 3 | Signal & Cycle | Unit 4: Cell Communication and Cell Cycle | 46 |
| 4 | The Inheritance Chamber | Unit 5: Heredity | 37 |
| 5 | The Code Vault | Unit 6: Gene Expression and Regulation | 50 |
| 6 | Evolution Engine | Unit 7: Natural Selection | 54 |
| 7 | The Living Web | Unit 8: Ecology | 45 |

**Answer Type Pools (22 populated):**

| Pool ID | Facts | Label |
|---|---|---|
| `term_definitions` | 317 | Term / Definition |
| `bio_concept_terms` | 157 | Biology Concept |
| `process_names` | 118 | Biological Process |
| `molecule_names` | 91 | Molecule / Macromolecule |
| `ecology_terms` | 89 | Ecology Term |
| `bracket_numbers` | 75 | Number / Value |
| `comparison_terms` | 62 | Comparison Term |
| `organism_names` | 32 | Organism Name |
| `function_terms` | 39 | Function Term |
| `experiment_terms` | 18 | Experiment / Study |
| `evolution_terms` | 16 | Evolution Term |
| `organelle_names` | 15 | Organelle |
| `genetics_terms` | 15 | Genetics Term |
| `equation_terms` | 13 | Equation / Formula |
| `signal_molecule_names` | 12 | Signal Molecule |
| `cycle_phase_names` | 12 | Cell Cycle Phase |
| `location_terms` | 11 | Location |
| `disease_syndrome_names` | 8 | Disease / Syndrome |
| `structure_function_terms` | 7 | Structure-Function Term |
| `enzyme_names` | 7 | Enzyme |
| `organelle_structures` | 6 | Organelle Structure |
| `person_names` | 3 | Scientist Name (minimumSize: 3 with explicit distractors) |

**Equations covered:** Hardy-Weinberg equilibrium (allele + genotype frequency), water potential (Ψ = Ψs + Ψp), solute potential (Ψs = –iCRT), free energy (ΔG = ΔH – TΔS), surface area to volume formulas, Q10 temperature coefficient, allometric scaling, dilution formula (M1V1 = M2V2), chi-square statistic, primary productivity estimates. CED appendix equations fully covered.

**CED alignment:** College Board AP Biology CED (2025-26, effective Fall 2025). All 8 units covered, Topics 1.1–8.7. Facts include `examTags` with `unit`, `topic`, `exam_weight`, `big_idea`, `is_equation_fact`, and `is_lab_fact` fields for filtering by exam section.

**QA fixes applied 2026-04-04:** 83 facts had answers >100 chars (verifier check #14 failure). Fixed by:
- Restructuring ~70 definition-style answers into concise terms/phrases, moving detail to `explanation` field
- `ap_bio_cr_002` and `ap_bio_etc_010`: range answers `{30-32}` and `{26-28}` (non-numeric brace format) converted to plain text `30–32 ATP` / `26–28 ATP` with explicit distractors; moved from `bracket_numbers` to `term_definitions` pool
- `ap_bio_pure_water_psi`: answer `{0}` (zero base causes no numeric distractors) converted to `0 MPa` with explicit distractors; moved to `term_definitions` pool
- `person_names` pool (3 facts): `minimumSize` lowered to 3 (only 3 scientist facts exist), explicit `distractors` arrays added to each fact for runtime selection


**Pool homogeneity passes (2026-04-04):** 5 passes of answer trimming and pool reassignment reduced failing pools from 21/22 → 3/22 (all borderline 3.0–3.3x). Approach:
- Trimmed 150+ long descriptive answers to their core biological term (e.g. "The process by which..." → "Differential gene expression")
- Converted bare numbers to `{N}` bracket notation (e.g. `9` → `{9}`) for algorithmic distractor generation
- Reassigned ~50 facts to better-matched pools based on answer format (cycle_phase_names, signal_molecule_names, term_definitions, bio_concept_terms)
- Scripts: `scripts/fix-ap-bio-homogeneity.mjs` through `scripts/fix-ap-bio-homogeneity-4.mjs` (passes 1–4)
- Remaining 3 FAIL pools are borderline (3.0–3.3x): bracket_numbers (3.3x, min=`{1}` 3c vs max `{2.4} bya` 10c), comparison_terms (3.0x, inherently verbose comparison sentences), ecology_terms (3.1x, min 12c vs max 37c)

**Distractor quality pass (2026-04-04):** In-game quiz audit found 51 facts where distractors were trivially eliminatable by length. Fixed by `scripts/fix-ap-bio-distractors.mjs`:
- Replaced sentence-form distractors (50–107c) with matching-length term names for water property facts (Cohesion/Adhesion/Surface tension), functional group facts, and molecule name facts (ATP, CDK, cAMP, IP₃, G3P)
- Stripped explanatory parentheticals from distractors (e.g. "Cyclin (regulatory partner — not the enzyme)" → "Cyclin") across abbreviation-type molecule facts
- Expanded ultra-short distractors (<25% of answer length) to match answer format (e.g. bare `K` → `K (carrying capacity)` to match `r (growth rate)`)
- Fixed bracket-number distractors to use clean `{N}` format without explanatory suffixes
- Result: 0 critical length mismatches across all 1123 facts

---


## ap_us_history Deck

`data/decks/ap_us_history.json` — assembled 2026-04-03. Exam-aligned to the College Board AP U.S. History (APUSH) Course and Exam Description (CED), covering all 9 periods from 1491 through the early 21st century.

Architecture: `data/deck-architectures/ap_us_history_arch_meta.yaml`

| Field | Value |
|---|---|
| `id` | `ap_us_history` |
| `name` | AP U.S. History |
| `domain` | history |
| `subDomain` | us_history |
| `minimumFacts` | 400 |
| `targetFacts` | 475 |
| `facts` | 504 |
| `chainThemes` | 9 (one per CED period) |
| `answerTypePools` | 10 active pools |

**Chain themes (9 CED periods):**
- 0: The New World Rift (Period 1: 1491–1607)
- 1: The Colonial Crucible (Period 2: 1607–1754)
- 2: The Liberty Forge (Period 3: 1754–1800)
- 3: The Young Republic (Period 4: 1800–1848)
- 4: The Divided Nation (Period 5: 1844–1877)
- 5: The Iron Colossus (Period 6: 1865–1898)
- 6: The Arsenal of Democracy (Period 7: 1890–1945)
- 7: The Atomic Age (Period 8: 1945–1980)
- 8: The Digital Frontier (Period 9: 1980–Present)

**Answer type pools (10 active):** `person_names` (91), `year_dates` (71), `concept_terms` (142), `legislation_names` (57), `event_names` (59), `movement_names` (36), `bracket_numbers` (7), `document_names` (18), `place_names` (18), `supreme_court_cases` (5).

**Pool normalization:** WIP files used 64 different pool IDs. All were normalized to the 12 canonical pool IDs during assembly. `treaty_names` and `economic_terms` pools were empty after normalization — the single Treaty of Tordesillas fact and TARP fact moved to `legislation_names`. Additional court case facts scattered in `concept_terms` and `event_names` were moved to `supreme_court_cases` to meet the 5-fact minimum, bringing that pool to 5 (Worcester v. Georgia, Wabash v. Illinois, Schenck v. US, Korematsu v. US, Brown v. Board).

**CED alignment:** College Board AP U.S. History CED. All 9 periods covered (25–78 facts per period, weighted by exam percentage). Facts include `examTags` with period and topic identifiers.

**Distractor repair:** All 9 WIP period files had exactly 8 distractors per fact for P1, P2, P4–P6, P8–P9. P3 (78 facts) and P7 (65 facts) had 7 distractors each — all 143 were patched to 8 during assembly.

**Pool homogeneity remediation (2026-04-04):** 9 pools were failing (>3x ratio). Fixed by:
- Converting ALL bare 4-digit years to `{YYYY}` bracket notation and reassigning to `bracket_numbers` pool.
- Expanding 50+ short entries in `concept_terms` (4–13c) with context (e.g. "Mita" → "Mita (forced labor tribute)", "Gullah" → "Gullah (African-Am. culture)").
- Expanding short entries in `person_names`, `event_names`, `place_names`, `legislation_names`, `movement_names`, `document_names` with identifying context.
- Trimming long multi-name entries ("Alexander Hamilton, James Madison, and John Jay" → "Hamilton, Madison, and Jay").
- **Result:** 0 FAIL, 7 WARN (all at 2.5–2.9x).

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

1. Lazily loads the sql.js WASM module (shared lazy-load pattern with `factsDB.ts`)
2. Fetches `/curated.db` as an `ArrayBuffer`
3. Decodes the buffer via `decodeDbBuffer()` from `dbDecoder.ts` (XOR no-op in dev; decoded in prod)
4. Opens the SQLite database with `new SQL.Database(decodedBytes)`
5. Queries all rows from `decks`, `deck_facts`, `answer_type_pools`, and `synonym_groups` tables
6. Groups facts/pools/synonyms by `deck_id` and assembles full `CuratedDeck` objects
7. Validates: deck must have `id` and a `facts` array
8. Calls `loadDeck(deck)` for each deck which:
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

The `procedural?: boolean` field on `DeckRegistryEntry` marks decks that generate problems algorithmically. Only `domain: 'mathematics'` decks use this flag. Procedural decks do not have a `facts` array in a `.json` file.

---

## Procedural Decks (`proceduralDeckTypes.ts`)

Procedural decks generate quiz problems on-the-fly instead of drawing from static `DeckFact` records. Only the `mathematics` domain uses procedural decks.

**Key types** (all in `src/data/proceduralDeckTypes.ts`):

| Type | Purpose |
|---|---|
| `ProceduralDeck` | Top-level container — `id`, `name`, `domain: 'mathematics'`, `skills[]`, `subDecks[]` |
| `ProceduralSubDeck` | Groups of skill IDs (e.g., "Addition" containing `add_1digit`, `add_2digit`) |
| `SkillNode` | One math skill — maps to a generator function and has `tierParams` per FSRS tier |
| `GeneratorParams` | Controls number ranges, operations, step count, decimal/negative flags, tolerance |
| `PlayerSkillState` | FSRS scheduling state tracked per skill, parallel to `ReviewState` for facts |
| `MathProblem` | Output of a generator — question, answer, distractors, explanation, input mode |

**FSRS state for math skills** is stored in `PlayerSave.skillStates?: PlayerSkillState[]` — added to `src/data/types.ts`. Each `PlayerSkillState` is keyed by `skillId + deckId` and tracks the same FSRS fields as `ReviewState`.

**DeckMode** — the `'procedural'` variant in `DeckMode` (in `studyPreset.ts`) selects a procedural math run:
```typescript
{ type: 'procedural'; deckId: string; subDeckId?: string }
```
The `encounterBridge.ts` if-else chain falls through to the general fallback for `type: 'procedural'` until Phase 2 wires the math pool builder. `masteryScalingService.getLeaderboardEligibility()` returns `null` for procedural mode (not leaderboard-eligible).

**No fact DB entries:** `DOMAIN_TO_CATEGORY['mathematics']` is an empty array in `runPoolBuilder.ts` — querying `factsDB` for math facts always returns nothing. `getKnowledgeDomains()` excludes `'mathematics'` so it never appears in trivia domain loops.

**Math Service Layer** — four services in `src/services/math/` implement the procedural math system:

| Service | Purpose |
|---|---|
| `mathDistractorGenerator.ts` | Generates plausible-but-wrong distractors using operation-specific error models (carry errors, sign errors, digit swaps, wrong-op) |
| `mathProblemGenerator.ts` | Dispatches to one of 6 generator functions keyed by `SkillNode.generatorId`; all generation is deterministic given `(skill, tier, seed)` |
| `skillStateManager.ts` | FSRS state for math skills — `createSkillState`, `reviewSkill` (pure transform, no persistence), `getSkillTier` (delegates to `tierDerivation.getCardTier`) |
| `proceduralSkillSelector.ts` | Picks next skill to practice using Anki 4-priority model: relearning → due → new (capped at MAX_LEARNING=8) → ahead-learning → fallback |
| `proceduralDeckRegistry.ts` | Registers all procedural decks into the shared `DECK_REGISTRY`; provides `getProceduralDeck(id)` lookup; exports `PROCEDURAL_DECKS[]` array. Called once at app startup via `registerProceduralDecks()`. |
| `proceduralQuizSession.ts` | Bridge between skill selection and the quiz overlay. `startProceduralSession(deckId, subDeckId?)` creates a session; `getNextQuestion(session)` selects a skill, generates a problem, and returns a `ProceduralQuizQuestion` with shuffled answers; `gradeProceduralAnswer(...)` runs FSRS and persists the updated state. |

**Deck definitions** (added 2026-04-03) — two concrete ProceduralDeck objects in `src/data/mathDecks/`:

| File | Deck ID | Skills | Sub-decks |
|---|---|---|---|
| `arithmetic.ts` | `arithmetic` | `arith_add`, `arith_sub`, `arith_mul`, `arith_div`, `arith_mixed` | addition, subtraction, multiplication, division, mixed |
| `mentalMath.ts` | `mental_math` | `mental_pct`, `mental_frac`, `mental_est`, `mental_pemdas` | percentages, fractions_decimals, estimation, order_of_operations |

Each skill's `tierParams` maps FSRS tiers `1 → 2a → 2b → 3` to progressively harder number ranges. Both decks have `artPlaceholder` with gradient `#3B82F6 → #1D4ED8` and icon `🔢`.

**App startup wiring:** `CardApp.svelte` calls `registerProceduralDecks()` synchronously before `initializeCuratedDecks()` so math decks are visible in the registry immediately at mount.

**Unit tests** (added 2026-04-03) — 117 tests in 4 files:
- `src/services/math/mathDistractorGenerator.test.ts` — count, exclusion, uniqueness, validity, carry-error, sign-error, negatives, zero, small-answer fallback
- `src/services/math/mathProblemGenerator.test.ts` — determinism, all 6 generators, question format, mathematical correctness, PEMDAS, unknown generatorId error
- `src/services/math/skillStateManager.test.ts` — `createSkillState` defaults, `reviewSkill` correct/incorrect, `getSkillTier` all tier boundary conditions, stats accumulation
- `src/services/math/proceduralSkillSelector.test.ts` — priority order, subDeckId filtering, anti-repeat, MAX_LEARNING cap, reason field accuracy

**Strategy-test note:** `generateMathDistractors` slices to exactly `count` items. Strategy-verification tests (carry error, sign error) request count=15 to expose all generated candidates before the slice — this is intentional and correct.


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

**Answer Type Pools (10):**

| Pool ID | Format | Facts |
|---|---|---|
| `date_events` | date | 74 — dates, BCE/CE strings |
| `city_place_names` | name | 11 — cities and regions |
| `general_politician_names` | name | 35 — person names 7–19 chars |
| `political_terms` | term | 30 — terms, phrases, Latin titles |
| `text_work_names` | name | 3 — text/work titles |
| `battle_names` | name | 8 — battle names |
| `structure_names` | name | 18 — building/structure names |
| `emperor_names` | name | 9 — emperor names |
| `roman_god_names` | name | 8 — Roman deity names |
| `historical_phrases` | phrase | 79 — descriptions and longer answers 13–38 chars |

**Pool fix (2026-04-01):** 10 facts were reassigned from `general_politician_names`, `text_work_names`, and `structure_names` to `political_terms` because their correct answers were non-name types (epithets, oaths, date ranges, phrases) that would appear as bad distractors in person-name questions. See gotchas.md for the lesson.

**Pool homogeneity fix (2026-04-04):** 3-round fix applied via scripts `fix-pool-homogeneity-greece-rome.mjs`, `fix-pool-homogeneity-round2.mjs`, `fix-pool-homogeneity-round3.mjs`. New `historical_phrases` pool created to hold long descriptive answers (13–38 chars) moved out of `political_terms`, `general_politician_names`, and other pools. 10+ bare number answers converted to `{N}` bracket notation. Result: 0 FAIL, 7 WARN (all pools within 3× length ratio threshold).

---

## ancient_greece Deck

`data/decks/ancient_greece.json` — 246 facts covering Classical Greece from the poleis to Alexander.

| Field | Value |
|---|---|
| `id` | `ancient_greece` |
| `domain` | `history` |
| `subDomain` | `ancient_greece` |
| `facts` | 246 |

**Answer Type Pools (11):**

| Pool ID | Format | Facts | Synthetics | Notes |
|---|---|---|---|---|
| `ruler_general_names` | name | 27 | — | Person names |
| `concept_terms` | term | 37 | — | Short Greek terms 5–15 chars |
| `bracket_numbers` | bracket_number | 12 | — | Pure {N} numeric facts only |
| `date_events` | date | 37 | — | Calendar dates |
| `structure_names` | name | 11 | — | Building/place names |
| `god_names` | name | 12 | — | Greek/Roman deity names |
| `city_state_names` | place | 11 | 2 | Polis/city names |
| `battle_names` | name | 1 | 10 | Named battles; minimumSize=1; 10 Ancient Greek synthetic battle names |
| `work_text_names` | name | 10 | — | Literary/artistic works |
| `historical_phrases` | phrase | 87 | — | Descriptions 9–37 chars; homogeneityExempt |
| `short_replies` | word | 1 | 6 | One-word answers (Laconic reply "If"); minimumSize=1 |

**Pool fix (2026-04-01):** 5 facts reassigned to correct pools.

**Pool homogeneity fix (2026-04-04):** Created `historical_phrases` pool; split `concept_terms` (formerly 101 facts) into short terms and descriptions.

**Pool redesign (2026-04-05):** LLM review found 4 critical issues. Fixes: (1) `battle_names` had counts ("About 7,000", "371–378 triremes") and disease/event names mixed with actual battles — moved counts to new `bracket_numbers` pool, events to `historical_phrases`, replaced WWII synthetic distractors with Ancient Greek battles; (2) `concept_terms` had 12 bracket-numeric facts mixed with named terms — moved all `{N}` facts to new `bracket_numbers` pool; (3) `structure_names` had "Criminal court" and "Silver mines at Laurion" — moved both to `historical_phrases`; (4) `historical_phrases` had `greece_cs_laconic_philip` ("If", 4 chars) causing quiz-audit length-mismatch FAILs — moved to new `short_replies` pool with own single-word distractors. Result: 0 FAIL quiz-audit, 0 FAIL homogeneity, 4 WARN only.

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
| `classical_masters` | Classical Composers & Eras | 0 | 55 |
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

**periodic_table subDeck fix (2026-04-03):** The `common_elements` subDeck originally contained only 49 of 90 facts. The remaining 41 facts (rare/exotic element trivia) were not listed in any subDeck, making them unreachable by topic-group extraction. All 41 missing factIds were appended to `subDecks[0].factIds`. The deck now has 1 subDeck covering all 90 facts. Verified: 0 failures in `node scripts/verify-all-decks.mjs`.

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
| `special_senses` | Vision, Hearing & Senses | 39 |
| `integumentary` | Integumentary System | 48 |
| `visual_anatomy` | Anatomy Image Recognition | 818 |
| `clinical_anatomy` | Surface Landmarks & Clinical Signs | 90 |
| `embryology` | Embryology | 90 |
| `regional_anatomy` | Regional Anatomy | 60 |
| `histology` | Histology | 90 |

**Answer Type Pools (26 — redesigned 2026-04-04 for pool homogeneity):**

The original `structure_names` mega-pool (1182 facts, 49x ratio) was split into 14 sub-pools by body system, plus a new `spinal_levels` pool was created for short vertebral level codes (L4, T9, C3-C6, etc.) so they distract each other rather than competing against 60-char descriptions.

| Pool ID | Facts | Notes |
|---|---|---|
| `bone_names` | 42 | |
| `muscle_names` | 68 | |
| `structure_cardiac` | 168 | Cardiovascular structures + image-answer facts |
| `structure_respiratory` | 57 | Respiratory structures + image-answer facts |
| `structure_digestive` | 99 | Digestive structures + image-answer facts |
| `structure_skeletal` | 220 | Skeletal structures + image-answer facts |
| `structure_muscular` | 83 | Muscular structures + image-answer facts |
| `structure_nervous` | 151 | Nervous system structures + image-answer facts |
| `structure_endocrine` | 24 | Endocrine structures + image-answer facts |
| `structure_reproductive` | 51 | Reproductive structures + image-answer facts |
| `structure_urinary` | 60 | Urinary structures + image-answer facts |
| `structure_lymphatic` | 59 | Lymphatic/immune structures + image-answer facts |
| `structure_histological` | 39 | Histological cell types and structures |
| `structure_embryological` | 42 | Embryological structures and germ layers |
| `structure_integumentary` | 53 | Skin and integumentary structures |
| `structure_general` | 121 | Multi-system and miscellaneous structures |
| `nerve_names` | 59 | Named nerves (11–44ch range; T9/T2-T3 moved to spinal_levels) |
| `vessel_names` | 15 | |
| `organ_names` | 6 | +syntheticDistractors (5 dropped — matched correct answers) |
| `function_terms` | 219 | Biological processes, mechanisms, hormones |
| `location_terms` | 57 | Anatomical locations (long-form; short spinal codes separated) |
| `number_stats` | 98 | Numeric measurements (many use {N} bracket notation for algorithmic distractors) |
| `clinical_terms` | 132 | Clinical conditions and findings |
| `tissue_types` | 57 | |
| `immune_terms` | 19 | |
| `spinal_levels` | 10 | Short spinal level codes only: L4, T9, C3-C6, T1-T4, etc. |

**Quiz Modes:**
- 1191 text facts (no `quizMode`)
- 409 image question facts (`quizMode: "image_question"`)
- 409 image answer facts (`quizMode: "image_answers"`) — player sees question text, picks from image options

**Difficulty:** 1=289, 2=875, 3=765, 4=26 (54 unset)

**Fix (2026-04-02):** 19 `image_answers` facts had duplicate `quizQuestion` text across 9 groups (same structure shown from multiple angles). Fixed by `data/decks/_wip/fix-anatomy-duplicate-questions.mjs` (cleaned up after run). Each question now incorporates a parenthetical view label derived from the explanation: e.g. "Which image shows the Skull (lateral view)?", "Which image shows the Skull (inferior/base view)?". Validation: 2009/2009 PASS.

**Pool Homogeneity Passes (2026-04-04):** First pass: 4 Python fix scripts (`fix-anatomy-pool-homogeneity-pass1.py` through `pass4.py`) reduced pool length ratios. Key improvements: structure_names (49x→5.8x) via 14-way system split; nerve_names (22x→4x) by moving vertebral landmark codes to spinal_levels; function_terms (13.5x→9x) by moving 54 visual facts to structure sub-pools and trimming long entries; location_terms (31.5x→9.4x) by extracting short spinal codes. This left 24 remaining FAIL flags.

**Pool Homogeneity Pass 5 (2026-04-04):** Second round fixed all 24 remaining FAILs → **0 FAIL, 5 WARN** status. Approach: (1) targeted answer trimming — 182 answers shortened (e.g. "Left anterior descending artery (LAD)" → "Left anterior descending (LAD)"; "Brodmann area 4: primary motor cortex" → "Brodmann area 4"); (2) short-answer expansion — 42 bare abbreviations expanded (PTH → "PTH (parathyroid hormone)", ADH → "ADH (antidiuretic hormone)", MALT → kept with note); (3) distractor format alignment — 13 facts had distractors updated to match the new answer format; (4) 19 pools marked `homogeneityExempt: true` where variation is inherent to the content type: image-dominated pools (structure_skeletal, structure_endocrine, etc.) where image labels range from short names ("Femur") to descriptive view titles ("Anterior skull frontal view"); and semantically heterogeneous pools (function_terms, location_terms, number_stats, clinical_terms) where mixing enzyme names (Lactase) with process descriptions (Hirschsprung: absent ganglia...) is intentional.

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
| `internet_web` | Internet & World Wide Web | 5 | Protocols, web history, standards |
| `ai_ml` | Artificial Intelligence & Machine Learning | 6 | AI history, machine learning concepts, milestones |
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

---

## japanese_n2_grammar Deck

`data/decks/japanese_n2_grammar.json` — 708 facts covering upper-intermediate JLPT N2 grammar patterns. Assembled 2026-04-04 from batch files via `scripts/assemble-n2-grammar.py`.

**Fill-in-the-blank format.** Each fact presents a Japanese sentence with the target grammar point replaced by `{___}`. The player chooses the correct grammar point to complete the sentence.

| Field | Value |
|---|---|
| `id` | `japanese_n2_grammar` |
| `domain` | `vocabulary` |
| `subDomain` | `japanese_grammar` |
| `facts` | 708 |
| `minimumFacts` | 400 |
| `targetFacts` | 708 |

**Answer Type Pools (21 — 20 category pools + grammar_all master):**

| Pool ID | Facts |
|---|---|
| `grammar_all` (master) | 708 |
| `temporal` | 84 |
| `concession_contrast` | 68 |
| `conjunction` | 56 |
| `degree_extent` | 56 |
| `basis_standard` | 40 |
| `conditional` | 40 |
| `emphasis` | 44 |
| `supposition` | 44 |
| `limitation` | 48 |
| `obligation` | 52 |
| `addition` | 20 |
| `appearance_state` | 20 |
| `impossibility` | 20 |
| `tendency` | 28 |
| `viewpoint` | 28 |
| `scope_range` | 16 |
| `surprise` | 16 |
| `purpose` | 12 |
| `ability` | 8 |
| `result_consequence` | 8 |

**Difficulty distribution:**
- Easy (1–2): 125 facts (17.7%)
- Medium (3): 275 facts (38.8%)
- Hard (4–5): 308 facts (43.5%)

**Synonym groups (6):**
- `syn_n2_cannot_help` — ないではいられない / ずにはいられない (cannot help but do)
- `syn_n2_no_choice` — しかない / ほかない / より仕方がない / より他ない (no choice but to)
- `syn_n2_merely` — に過ぎない / でしかない (merely / nothing more than)
- `syn_n2_regardless` — にもかかわらず / にかかわらず (despite / regardless of)
- `syn_n2_through` — を通じて / を通して (through / via)
- `syn_n2_based_on` — に基づいて / を元に (based on)

**Assembly source files:** 11 batch files in `data/decks/_wip/n2_gram_*.json` (0 duplicates across 708 facts).

**Assembler script:** `scripts/assemble-n2-grammar.py` — reads all batch files, deduplicates by ID, builds pools/synonymGroups/difficultyTiers, and writes the final deck.

**Validator note:** The `verify-all-decks.mjs` script reports 0 failures and 0 warnings for this deck. The `{___}` marker is the intended question blank format (same pattern as N3/N4/N5 grammar decks).

**chainThemeId:** Rotates 0–5 sequentially across all facts (grammar decks use generic chain slots, not named themes).

---

## japanese_n1_grammar Deck

`data/decks/japanese_n1_grammar.json` — 951 facts covering advanced JLPT N1 grammar patterns. Assembled 2026-04-04 from 14 batch files via `scripts/assemble-n1-grammar.py`.

**Fill-in-the-blank format.** Each fact presents a Japanese sentence with the target grammar point replaced by `{___}`. The player chooses the correct grammar point to complete the sentence.

| Field | Value |
|---|---|
| `id` | `japanese_n1_grammar` |
| `domain` | `vocabulary` |
| `subDomain` | `japanese_grammar` |
| `facts` | 951 |
| `minimumFacts` | 400 |
| `targetFacts` | 951 |

**Answer Type Pools (20 — 19 category pools + grammar_all master):**

| Pool ID | Facts |
|---|---|
| `grammar_all` (master) | 951 |
| `concession_contrast` | 111 |
| `emphasis` | 108 |
| `conditional` | 76 |
| `temporal` | 68 |
| `formal_written` | 64 |
| `judgment` | 56 |
| `method_means` | 56 |
| `scope_selection` | 56 |
| `degree_extent` | 56 |
| `cause_reason` | 44 |
| `opinions_stance` | 44 |
| `appearance` | 40 |
| `negative_forms` | 36 |
| `probability` | 36 |
| `result_outcome` | 28 |
| `simultaneous` | 24 |
| `unexpected` | 20 |
| `obligation_emotion` | 16 |
| `purpose` | 12 |

**Difficulty distribution:**
- Easy (1–2): 7 facts (0.7%)
- Medium (3–4): 703 facts (73.9%)
- Hard (5): 241 facts (25.3%)

**Synonym groups (10):**
- `syn_n1_cannot_help` — ずにはいられない / ないではいられない (cannot help but do)
- `syn_n1_as_soon_as` — が早いか / や否や / なり (as soon as / no sooner than)
- `syn_n1_regardless` — いかんにかかわらず / いかんによらず / いかんをとわず (regardless of)
- `syn_n1_forced` — を余儀なくされる / を余儀なくさせる / を余儀なくされた (forced/compelled)
- `syn_n1_must` — ないではすまない / ずにはすまない (cannot get away without doing)
- `syn_n1_will_definitely` — ないではおかない / ずにはおかない (will definitely/inevitably)
- `syn_n1_like_literary` — ごとき / ごとく / ごとし / かのごとく (literary "like/as if")
- `syn_n1_while` — がてら / かたがた / かたわら (while doing / on the occasion of)
- `syn_n1_whether` — (よ)うが～まいが and variants (whether or not)
- `syn_n1_fail` — そびれる / 損なう / 損ねる (fail to do / miss the opportunity)

**Assembly source files:** 14 batch files in `data/decks/_wip/n1_gram_*.json`.
- Deduplication: 240 id-duplicates removed, 1 content-duplicate removed (same question/answer regenerated with different id).

**Assembler script:** `scripts/assemble-n1-grammar.py` — reads all batch files, deduplicates by ID then by (quizQuestion, correctAnswer) fingerprint, builds pools/synonymGroups/difficultyTiers, and writes the final deck.

**Validator note:** The `verify-all-decks.mjs` script reports 0 failures and 0 warnings for this deck. The `{___}` marker is the intended question blank format (same pattern as N2/N3/N4/N5 grammar decks).

**chainThemeId:** Rotates 0–5 sequentially across all facts (grammar decks use generic chain slots, not named themes).

---

## movies_cinema_batch3 (WIP)

`data/decks/_wip/movies_cinema_batch3.json` — generated 2026-04-03 from Wikidata-verified source data. Sub-deck: "Iconic Films" — Batch 3: Modern era (1995–2020) + Famous Quotes.

| Field | Value |
|---|---|
| `id` | `movies_cinema` (batch 3 of a multi-batch deck) |
| `facts` | 30 |
| `status` | WIP — awaiting assembly into full deck + registration |

**Films covered:** Titanic (1997), The Matrix (1999), Gladiator (2000), The Lord of the Rings: Return of the King (2003), The Dark Knight (2008), No Country for Old Men (2007), Inception (2010), 12 Years a Slave (2013), Parasite (2019), Everything Everywhere All at Once (2022), Oppenheimer (2023), Fight Club (1999), The Departed (2006), Slumdog Millionaire (2008), Moonlight (2016), Get Out (2017), The Hurt Locker (2008)

**Famous Quotes covered (answer = film title):** "Here's looking at you, kid" (Casablanca), "I'm gonna make him an offer he can't refuse" (The Godfather), "May the Force be with you" (Star Wars), "Frankly, my dear, I don't give a damn" (Gone with the Wind), "I'll be back" (The Terminator), "There's no place like home" (The Wizard of Oz), "You talking to me?" (Taxi Driver), "Houston, we have a problem" (Apollo 13), "Life is like a box of chocolates" (Forrest Gump), "I see dead people" (The Sixth Sense)

**Answer Type Pools (4):**

| Pool ID | Facts |
|---|---|
| `director_names` | 17 |
| `film_titles` | 10 |
| `bracket_years` | 2 |
| `character_names` | 1 |

**Chain Theme Distribution:** 0→6, 1→5, 2→5, 3→5, 4→5, 5→4

**Structural validation:** 0 errors — all 30 facts passed ID uniqueness, required fields, 8-distractor rule, bracket_year format, quizQuestion terminal `?`, and ≥2 variants checks.

**Distractor rule compliance:** All distractors are LLM-generated from question context — no database pool mining.

**Source data:** Directors and release years verified via Wikidata SPARQL (confirmed in prompt). Famous quotes and attributed films verified against Wikipedia articles linked in each fact's `sourceUrl`.

**Next steps:** Assemble into full `movies_cinema.json` with `answerTypePools`, `synonymGroups`, `difficultyTiers`, and deck metadata; strip WIP fields (`statement`, `wowFactor`, `tags`, `ageGroup`); register in `data/decks/manifest.json`.


## ap_chemistry Deck

`data/decks/ap_chemistry.json` — assembled 2026-04-03 from 16 WIP batch files. Exam-aligned to the College Board AP Chemistry Course and Exam Description (CED) effective Fall 2024, covering all 9 units.

Assembly script: `scripts/assemble-ap-chemistry.mjs`

| Field | Value |
|---|---|
| `id` | `ap_chemistry` |
| `domain` | `natural_sciences` |
| `subDomain` | `chemistry` |
| `minimumFacts` | 350 |
| `targetFacts` | 400 |
| `facts` | 400 |
| `answerTypePools` | 14 |

**Chain Themes / SubDecks (6):**

| chainThemeId | SubDeck ID | Name | CED Units | Facts |
|---|---|---|---|---|
| 0 | `sd_structure_bonding` | Structure & Bonding | Units 1–2 | 85 |
| 1 | `sd_intermolecular_forces` | Intermolecular Forces | Unit 3 | 60 |
| 2 | `sd_reactions` | Chemical Reactions | Unit 4 | 50 |
| 3 | `sd_kinetics_energy` | Kinetics & Energy | Units 5–6 | 75 |
| 4 | `sd_equilibrium_acids` | Equilibrium & Acid-Base Chemistry | Units 7–8 | 90 |
| 5 | `sd_thermo_electrochemistry` | Thermodynamics & Electrochemistry | Unit 9 | 40 |

**Answer Type Pools (14 — redesigned 2026-04-03 for semantic homogeneity):**

Each pool contains only answers that a student could plausibly confuse with each other. The old junk-drawer pools (`law_and_equation_names`, `acid_base_equilibrium_terms`, etc.) were abolished and replaced with tighter semantic pools. Pool rebuild script: `scripts/rebuild-apchem-pools.mjs`.

| Pool ID | Facts | Members | Notes |
|---|---|---|---|
| `bracket_numbers` | 32 | 31 | Numeric answers with {N} notation |
| `equation_formulas` | 39 | 36 | Math expressions: PV=nRT, E=hν, ΔG=ΔH−TΔS |
| `named_laws_principles` | 18 | 18 | Named laws/rules: Boyle's Law, Hess's Law, Aufbau principle |
| `chemistry_concepts` | 168 | 159 | Short terms ≤5 words; the general catch-all for non-poolable short answers |
| `bond_and_imf_types` | 15 | 14 | Bond types and IMF types |
| `molecular_geometries` | 3 | 3+8 synth | VSEPR names; 8 syntheticDistractors added; minimumSize=3 |
| `element_names` | 2 | 2+8 synth | Element names; 8 syntheticDistractors added; minimumSize=2 |
| `compound_names` | 11 | 11 | Compound names/formulas |
| `reaction_types` | 10 | 9 | Reaction types and evidence of reaction |
| `equilibrium_concepts` | 12 | 10 | Shift directions, Q vs K, K interpretation |
| `process_types` | 15 | 11 | Endothermic/exothermic, sublimation, physical/chemical change |
| `electrochemistry_terms` | 9 | 9 | Anode, cathode, galvanic cell, etc. |
| `periodic_trend_terms` | 20 | 16 | Atomic number, orbital names, trend directions |
| `unique_answers` | 46 | 46 | Answers >40 chars or too unique to pool; all have ≥8 pre-generated distractors |

**Difficulty distribution:** easy=332 (difficulty 1–2), medium=62 (difficulty 3), hard=6 (difficulty 4–5)

**CED alignment:** College Board AP Chemistry CED (Fall 2024). All 9 units covered. Facts include `examTags` object with `unit`, `topic`, and `exam_weight` fields.

**Source WIP batch files (16):**
- `ap_chem_sd1_batch1.json` (25 facts, Unit 1 topics 1.1–1.4)
- `ap_chem_sd1_batch2.json` (30 facts, Unit 1 topics 1.5–1.8)
- `ap_chem_sd1_batch3.json` (30 facts, Unit 2 topics 2.1–2.7)
- `ap_chem_sd2_batch1.json` (30 facts, Unit 3 topics 3.1–3.6)
- `ap_chem_sd2_batch2.json` (30 facts, Unit 3 topics 3.7–3.13)
- `ap_chem_sd2_batch3.json` (25 facts, Unit 4 topics 4.1–4.5)
- `ap_chem_sd2_batch4.json` (25 facts, Unit 4 topics 4.6–4.9)
- `ap_chem_sd3_batch1.json` (25 facts, Unit 5 topics 5.1–5.6)
- `ap_chem_sd3_batch2.json` (25 facts, Units 5 topics 5.7–5.11 + Unit 6 topics 6.1–6.3)
- `ap_chem_sd3_batch3.json` (25 facts, Unit 6 topics 6.4–6.9)
- `ap_chem_sd4_batch1.json` (25 facts, Unit 7 topics 7.1–7.7)
- `ap_chem_sd4_batch2.json` (20 facts, Unit 7 topics 7.8–7.14)
- `ap_chem_sd4_batch3.json` (25 facts, Unit 8 topics 8.1–8.5)
- `ap_chem_sd4_batch4.json` (20 facts, Unit 8 topics 8.6–8.10)
- `ap_chem_sd5_batch1.json` (20 facts, Unit 9 topics 9.1–9.6)
- `ap_chem_sd5_batch2.json` (20 facts, Unit 9 topics 9.7–9.11)

**Post-assembly fixes applied:**
- 4 small pools received `syntheticDistractors` or `minimumSize` adjustments: `molecular_geometries` (minimumSize=3), `element_names` (minimumSize=2), `electrode_half_reactions` (minimumSize=1), `ion_charges` (removed — fact moved to `unit_and_constant_names`).
- `ap_chem_118_calcium_ion_charge`: correctAnswer changed from `{2+}` to `2+` (braces are for numeric values only), moved from `bracket_numbers` to `unit_and_constant_names`, distractors added.
- `examTags` normalized from array format `["AP_Chemistry","Unit_1","Topic_1.1"]` to object format `{unit, topic, exam_weight}` during assembly.
- **2026-04-03 pool redesign**: All 14 original junk-drawer pools abolished and replaced with 14 semantically tight pools. Old pools (`law_and_equation_names` had 81 members including "Electron sea model", "Crystal lattice") caused trivially eliminatable distractors. New pools ensure every member of a pool could plausibly be confused with every other member. Rebuild script: `scripts/rebuild-apchem-pools.mjs`. 46 long-answer facts assigned to `unique_answers` pool.

**Pool homogeneity remediation (2026-04-04):** 9 pools were failing (>3x ratio). Fixed by:
- `chemistry_concepts` (168 facts, was 20x ratio): expanded ~20 single-word answers (2–7c) with context parentheticals; trimmed ~17 long entries >30c.
- `bracket_numbers`: expanded 2 bare percentage entries (`{98.89}%` → `{98.89}% C-12`); converted 3 `{0}` facts to plain text (zero base produces no numerical distractors).
- `bond_and_imf_types`, `compound_names`, `equilibrium_concepts`, `process_types`, `periodic_trend_terms`, `named_laws_principles`: expanded short entries with descriptive context.
- 2 misassigned facts reassigned from `bracket_numbers` → `equilibrium_concepts`.
- **Result:** 0 FAIL, 12 WARN (all at 2.3–3.0x).

---

## Cross-Deck Quality Fixes (2026-04-03)

`scripts/fix-deck-quality.mjs` — one-shot script fixing all outstanding data quality failures across 10 decks:

**human_anatomy (134 missing funScore, 54 missing difficulty):**
- All `ha_visual_*` and other facts missing `difficulty` set to 3 (standard visual identification).
- All facts missing `funScore` set to 7 (consistent with other visual facts in the deck).

**movies_cinema (1 fact with difficulty=6):**
- `cinema_singinrain_codirector`: difficulty 6 → 5 (max allowed value).

**Long correctAnswers >100 chars shortened (across 8 decks):**
- `ancient_greece`, `ancient_rome`, `ap_chemistry`, `egyptian_mythology`, `famous_inventions`: curated manual replacements.
- `human_anatomy`: 92 facts auto-shortened via smart boundary-aware truncation (semicolon → period → em-dash → comma → space).
- `medieval_world`, `world_war_ii`: 13 facts shortened with curated replacements preserving key facts.

**Distractor collisions removed (9 facts across 7 decks):**
- `world_flags/flag_germany`, `us_presidents/pres_truman_atomic_bomb`, `nasa_missions/nasa_voyager_golden_record`, `greek_mythology/myth_harpies_phineus`, `world_war_ii/wwii_ax_donitz_fuhrer`, `medieval_world/med_4_cru_acre_fall_1291`, `medieval_world/med_5_goryeo_founded`, `medieval_world/med_6_afr_songhai_fall`, `movies_cinema/cinema_supp_film_braveheart`.

**Result:** 0 failures across all 70 decks at time of writing. 9/9 unit tests pass (`tests/unit/deck-content-quality.test.ts`).

---

## ap_world_history Deck

`data/decks/ap_world_history.json` — assembled 2026-04-04 from 9 WIP batch files. Exam-aligned to the College Board AP World History: Modern Course and Exam Description (CED), covering all 9 units (c. 1200–present).

**Facts:** 620 | **Pools:** 15 | **Chain themes:** 9 | **Sub-decks:** 9

**CED alignment:** College Board AP World History: Modern CED. All 9 units covered. Facts include `examTags` object with `unit`, `topic`, `exam_weight`, `time_period`, and `region` fields.

**Difficulty distribution:** easy=275 (difficulty 1–2), medium=268 (difficulty 3), hard=77 (difficulty 4–5)

**Source WIP batch files (9):**
- `ap_world_sd1_batch1.json` (65 facts, Unit 1: The Global Tapestry, c. 1200–1450)
- `ap_world_sd2_batch1.json` (65 facts, Unit 2: Webs of Exchange, c. 1200–1450)
- `ap_world_sd3_batch1.json` (80 facts, Unit 3: Empires of the Land, c. 1450–1750)
- `ap_world_sd4_batch1.json` (80 facts, Unit 4: Oceans Connected, c. 1450–1750)
- `ap_world_sd5_batch1.json` (80 facts, Unit 5: Age of Revolution, c. 1750–1900)
- `ap_world_sd6_batch1.json` (80 facts, Unit 6: The Imperial Age, c. 1750–1900)
- `ap_world_sd7_batch1.json` (55 facts, Unit 7: Global Conflict, c. 1900–present)
- `ap_world_sd8_batch1.json` (55 facts, Unit 8: Cold War and Liberation, c. 1900–present)
- `ap_world_sd9_batch1.json` (60 facts, Unit 9: The Globalized World, c. 1900–present)

**Post-assembly fixes applied:**
- Pool ID typo corrected: `batch_event_names` -> `battle_event_names` on fact `apwh_8_011` (1 fact, generation artifact).
- Pool homogeneity pass (2026-04-04): 14 of 15 pools were failing (>3x ratio). Fixed by: (1) expanding ~82 short `concept_terms` answers with context parentheticals (e.g., "Manorialism" → "Manorialism (feudal land system)"), (2) reassigning analytical sentence answers from named-entity pools to `concept_terms`, (3) expanding short proper nouns in ruler/place/tech pools with context identifiers, (4) fixing `{N}1519` notation to `{1519}` bracket notation for numerical distractors. Result: 0 pool FAIL, 15 pool WARN (all at 2.6–3.0x).
- Distractor quality fixes (2026-04-04): Updated `Gold (commodity)` distractors to match parenthetical format, updated `Tlacopan (Triple Alliance)` distractors to use parenthetical format, rewrote Queue Order question/answer/distractors for format consistency.
- Date fix: `apwh_4_063` (Magellan voyage) changed from `{1519}–{1522}` to `Departed 1519, returned 1522` to match distractor format and fix double-brace stripping bug.

**Validation:** 0 failures. 35 warnings (all pool-homogeneity WARN at 2.6–3.0x ratio — inherent to pools with varied answer formats). Previous 42 duplicate-answer warnings resolved; remaining warnings are structural length ratios only.

**Assembly script:** `scripts/assemble-ap-world-history.mjs`

---

## medieval_world Deck — Pool Redesign (2026-04-05)

`data/decks/medieval_world.json` — 178 facts covering the medieval period (c. 400–1500 CE) across Byzantine, Islamic, European feudal, Viking, Crusades, East Asian, and African civilizations.

| Field | Value |
|---|---|
| `id` | `medieval_world` |
| `domain` | `history` |
| `subDomain` | `medieval` |
| `facts` | 178 |
| `minimumFacts` | 100 |
| `targetFacts` | 178 |

### Pool Redesign (2026-04-05)

The original 8-pool structure had a `concept_terms` mega-pool (45 facts) mixing person names, measurements, place descriptions, currencies, bracket-number counts, and descriptive phrases — producing cross-type distractors that were obviously wrong. Four new pools were created to achieve semantic homogeneity.

**Original 8 pools → 12 pools:**

| Pool ID | Type | Real facts | Synth | Notes |
|---|---|---|---|---|
| `date_events` | bracket_year / short CE date | 25 | 0 | 3–8 char answers: bracket years ({624}, {1144}) + short CE strings ("904 CE") |
| `date_named` | date phrase | 27 | 0 | NEW (split from date_events): 9–18 char named dates ("July 16, 1054", "5 years, 10 months") |
| `bracket_numbers` | bracket_number | 5 | 15 | NEW: pure count answers only ({3}, {4}, {9}, {11}, {54}). Separated from bracket years to prevent count vs. year mixing. |
| `ruler_leader_names` | name | 22 | 0 | Removed 2 description-phrase misfits |
| `work_text_names` | name | 6 | 9 | Removed Jelling stones description + Magna Carta count |
| `battle_event_names` | name | 12 | 3 | Removed Nika Riots + Lindisfarne descriptions |
| `concept_terms` | term/definition/measurement | 42 | 0 | Removed person-group names and small counts; added "~850 columns" from structure_names |
| `place_names` | name | 12 | 0 | Unchanged |
| `structure_names` | name | 6 | 9 | Removed "~850 columns" (moved to concept_terms) |
| `scholar_names` | name | 11 | 4 | Unchanged |
| `person_group_names` | name | 5 | 12 | NEW: collective or obscure individual names ("The Varangian Guard", "Kallinikos of Heliopolis") |
| `description_phrases` | description | 5 | 10 | NEW: sentence-fragment answers ("Bear keeper; actress", "Constantinople revolt; 30,000 killed") |

### Key fact reassignments

| Fact ID | Old pool | New pool | Reason |
|---|---|---|---|
| `med_byz_theodora_origins` | ruler_leader_names | description_phrases | Answer is a description, not a name |
| `med_vik_erik_red` | ruler_leader_names | description_phrases | Answer is a description, not a name |
| `med_byz_nika_riots` | battle_event_names | description_phrases | Answer is a description, not a name |
| `med_vik_lindisfarne` | battle_event_names | description_phrases | Answer is a description, not a name |
| `med_vik_runes_jelling` | work_text_names | description_phrases | Answer is a description, not a name |
| `med_byz_greek_fire_origin` | concept_terms | person_group_names | Answer is a person name |
| `med_byz_varangian_guard` | concept_terms | person_group_names | Answer is a group name |
| `med_4_cru_bernard_jews` | concept_terms | person_group_names | Answer is a person name |
| `med_6_afr_great_zimbabwe_builders` | concept_terms | person_group_names | Answer is a group name |
| `med_feu_thing_democracy` | concept_terms | person_group_names | Answer is a group/assembly name |
| `med_isl_cordoba_mosque` | structure_names | concept_terms | Answer "~850 columns" is a measurement |
| `med_feu_magna_carta_provisions` | work_text_names | bracket_numbers | Answer is a pure count {3} |
| `med_4_cru_crusader_states_count` | date_events | bracket_numbers | Answer is a pure count {4} |
| `med_4_cru_crusades_number` | date_events | bracket_numbers | Answer is a pure count {9} |
| `med_5_heian_genji_chapters` | date_events | bracket_numbers | Answer is a pure count {54} |
| `med_6_afr_lalibela_churches` | date_events | bracket_numbers | Answer is a pure count {11} |
| 27 long-date facts | date_events | date_named | Display length ≥9 chars |

### bracket_numbers pool pattern

This pool is a reusable pattern for any deck that has small count answers like {3}, {4}, {9}. The rule:

- **bracket_numbers**: pure small counts (value < ~200). Display as 1–3 char numerals. Use numerical synthetic distractors.
- **date_events**: bracket years (value ≥ 600) and short CE strings. Display as 4–8 chars. These must never share a pool with pure counts, since "How many crusades? A) 9 B) 1099 C) 1244 D) 1453" makes the year answers obviously wrong.
- **date_named**: full date phrases 9–18 chars ("November 27, 1095", "5 years, 10 months").

### Validation results

- `node scripts/verify-all-decks.mjs` → 0 failures, 5 warnings
- `node scripts/pool-homogeneity-analysis.mjs --deck medieval_world` → 0 FAIL, 5 WARN
- `node scripts/quiz-audit.mjs --deck medieval_world --full` → 0 FAIL, 10 WARN
- Trivia bridge: 54 entities extracted, 0 ID collisions

---

---

## Pool Remediation History

### 2026-04-05 — Batch hollow/thin pool fixes (13 decks)

Hollow pools (< 5 real facts) and thin pools (< 15 total including synthetics) were fixed across 13 decks:

| Deck | Action | Detail |
|---|---|---|
| `ap_biology` | Merge + synthetics | `person_names` (3 facts) → merged into `experiment_terms`; 6 thin pools got 7–9 synthetics each |
| `ap_chemistry` | Merge + synthetics + exempt | `element_names` (2 facts) → `chemistry_concepts` (+ `homogeneityExempt`); `molecular_geometries` (3 facts) → `reaction_types`; `electrochemistry_terms` got 6 synthetics |
| `ap_physics_1` | Merge + synthetics | `fluid_properties` (3 facts) → `quantity_definitions`; `collision_types` (4 facts) → `term_definitions`; `force_type_names` got 10 synthetics; `rotational_quantities` got 8 synthetics |
| `ap_psychology` | Merge | `intelligence_terms` (2 facts) → `psych_concept_terms` |
| `ap_us_history` | Synthetics | `supreme_court_cases` (5 facts) got 10 synthetics (landmark case names) |
| `ap_european_history` | Synthetics | `movement_names` (9 facts) got 6 synthetics |
| `ap_world_history` | Synthetics | `mass_atrocity_names` (6 facts) got 9 synthetics (historically accurate event names) |
| `constellations` | Merge | `deep_sky_names` (3 facts) → `concept_terms` |
| `dinosaurs` | Merge + exempt | `clade_names` (3 facts) → `misc_concepts` (+ `homogeneityExempt` for broad pool) |
| `nasa_missions` | Synthetics | `launch_years` (6 bracket facts) got 20 year synthetics |
| `us_presidents` | Synthetics | `inauguration_years` (8 bracket facts) got 20 year synthetics |
| `world_wonders` | Exempt | `measurement_number` marked `homogeneityExempt` (mixed units: metres/km/years/tonnes inherently vary) |
| `medical_terminology` | Standardize | `condition_names`: 23 definition-format answers converted to bare clinical term names (e.g. "underactive thyroid producing insufficient thyroid hormone" → "Hypothyroidism") |

Result: 0 FAIL across all 75 decks after remediation.
