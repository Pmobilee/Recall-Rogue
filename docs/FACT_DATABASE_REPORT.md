# Fact Database — Full Quality & Provenance Report

**Date**: 2026-03-14
**Total knowledge facts**: 10,546 (all vocabulary/language facts deleted)
**Verdict**: ~5,000 keepable, ~5,500 low-quality filler. Massive variant gap (34/10,546 have variants).

---

## Executive Summary

The knowledge fact database has two distinct quality tiers:

1. **Hand-crafted / LLM-generated facts** (~2,000-2,500): High quality, engaging questions, proper explanations. IDs like `*_gen_*`, `animal-*-123`, `food-*-name-123`, `hist-*-name-123`, `gk-*-name-123`, `nsci-*-name-123`, `space-*-name-123`.

2. **Wikidata batch imports** (~8,000): Low-quality filler with template questions ("What type of animal is X?"), cookie-cutter explanations, and inflated fun scores. IDs like `*-b01-*` through `*-b26-*`, `genknow-b*`.

**Critical gap**: Only 34 of 10,546 facts have question variants (the game design requires 4+ per fact). 8,562 facts have NULL source_name. The fun scores are unreliable (fun=5 is clearly a default, not a real rating).

---

## Database Schema — All Fields

The `facts` table in `public/facts.db` (SQLite) has 44 columns. Below is the full schema grouped into logical sections.

### 1. Core Content

| Col | Field | Type | Nullable |
|---|---|---|---|
| 0 | `id` | TEXT | PK NOT NULL |
| 1 | `type` | TEXT | NOT NULL |
| 2 | `statement` | TEXT | NOT NULL |
| 3 | `wow_factor` | TEXT | nullable |
| 4 | `explanation` | TEXT | NOT NULL |
| 5 | `gaia_comment` | TEXT | nullable |

The fact's identity and narrative content. `id` uses domain-prefixed kebab-case (e.g., `animal-pistol-shrimp-123`, `hist-b01-0042`, `space_astronomy_gen_0017`). `type` is almost always `"knowledge"` for trivia facts; vocabulary facts used `"vocab"` before deletion. `statement` is a standalone declarative sentence about the fact (used on the card face). `explanation` is the post-answer reveal text shown to the player. `wow_factor` is a short punchy hook (e.g., "This creature can boil water with a claw snap!") — populated on higher-quality facts. `gaia_comment` is a legacy single-string NPC line; superseded by `gaia_comments` (col 22).

### 2. Quiz Presentation

| Col | Field | Type | Nullable / Default |
|---|---|---|---|
| 6 | `quiz_question` | TEXT | NOT NULL |
| 7 | `correct_answer` | TEXT | NOT NULL |
| 8 | `distractors` | TEXT | NOT NULL (JSON array of strings) |
| 24 | `acceptable_answers` | TEXT | nullable (JSON array) |
| 25 | `distractor_count` | INTEGER | default 0 |
| 42 | `variants` | TEXT | nullable (JSON array of variant objects) |

What the player sees during gameplay. `distractors` is a JSON array of 3 wrong answers shown alongside `correct_answer` in the multiple-choice UI. `acceptable_answers` holds alternate phrasings that are also accepted (e.g., `["USA", "United States", "US"]` for "United States of America"). `distractor_count` caches the length of the distractors array (redundant but used for fast queries). `variants` holds alternate question formats (forward, reverse, fill-blank, true/false, context) — populated on only 34 of 10,546 facts, representing the single biggest content gap.

### 3. Classification & Metadata

| Col | Field | Type | Nullable / Default |
|---|---|---|---|
| 9 | `category` | TEXT | NOT NULL (JSON array like `["History","battles_military"]`) |
| 10 | `rarity` | TEXT | NOT NULL (common/uncommon/rare/epic/legendary) |
| 11 | `difficulty` | INTEGER | NOT NULL (1–5) |
| 12 | `fun_score` | INTEGER | NOT NULL (1–10) |
| 13 | `age_rating` | TEXT | NOT NULL (kid/teen/adult) |
| 26 | `category_l1` | TEXT | default `''` |
| 27 | `category_l2` | TEXT | default `''` |
| 28 | `category_l3` | TEXT | default `''` |
| 29 | `novelty_score` | INTEGER | default 5 (1–10) |
| 37 | `tags` | TEXT | nullable (JSON array of strings) |

`category` is a legacy JSON array `[domain, subcategory]` kept for backward compatibility. `category_l1` / `category_l2` / `category_l3` are the normalized flat-string equivalents used in queries (e.g., `category_l1 = "Animals & Wildlife"`, `category_l2 = "birds"`). `category_l3` is rarely populated. `rarity` drives card frame color in the game UI. `difficulty` (1–5) determines which player knowledge tier the fact targets. `fun_score` (1–10) is meant to rate engagement but is mostly unreliable — 76% of facts have fun=5 or fun=6, which are clearly default placeholder values. `novelty_score` (1–10) rates how surprising the fact is; defaults to 5 and is rarely overridden. `tags` is a free-form JSON array for additional labels (e.g., `["WW2", "naval"]`); sparsely populated.

### 4. Vocabulary-Specific

| Col | Field | Type | Nullable |
|---|---|---|---|
| 15 | `language` | TEXT | nullable |
| 16 | `pronunciation` | TEXT | nullable |
| 17 | `example_sentence` | TEXT | nullable |
| 19 | `mnemonic` | TEXT | nullable |

These fields are only populated for vocabulary/language-learning facts (Japanese, German, Spanish, Korean). `language` is an ISO code (`"ja"`, `"de"`, `"es"`, `"ko"`). `pronunciation` holds romanization or IPA. `example_sentence` gives the word in context. `mnemonic` holds a memory aid for the word. All vocabulary facts have been deleted from the current database; these columns are empty.

### 5. NPC Voice Lines

| Col | Field | Type | Nullable |
|---|---|---|---|
| 22 | `gaia_comments` | TEXT | nullable (JSON array) |
| 23 | `gaia_wrong_comments` | TEXT | nullable (JSON array) |

Gaia companion dialogue shown during gameplay. `gaia_comments` is a JSON array of voice lines played when the player answers correctly (e.g., `["Incredible! That shrimp makes plasma with its claw!", "Your knowledge is powerful."]`). `gaia_wrong_comments` plays on a wrong answer. These are populated on a minority of high-quality facts and are entirely absent from Wikidata batch facts.

### 6. Content Safety

| Col | Field | Type | Nullable / Default |
|---|---|---|---|
| 13 | `age_rating` | TEXT | NOT NULL (kid/teen/adult) |
| 30 | `sensitivity_level` | INTEGER | default 0 |
| 31 | `sensitivity_note` | TEXT | nullable |
| 32 | `content_volatility` | TEXT | default `'timeless'` |
| 35 | `in_game_reports` | INTEGER | default 0 |

`sensitivity_level` flags content by risk: 0 = safe for all audiences, 1 = mild (violence, mild language), 2 = sensitive (controversial topics, graphic content). `sensitivity_note` explains why (e.g., "describes battlefield death toll"). `content_volatility` classifies how likely a fact is to become outdated: `timeless` (historical, scientific constants), `stable` (established facts that rarely change), `volatile` (current records, population statistics, political leadership). `in_game_reports` counts player-submitted flags; facts with high report counts are candidates for review.

### 7. Provenance & Verification

| Col | Field | Type | Nullable / Default |
|---|---|---|---|
| 14 | `source_name` | TEXT | nullable |
| 20 | `status` | TEXT | default `'approved'` |
| 33 | `source_url` | TEXT | nullable |
| 34 | `verified_at` | TEXT | nullable (ISO date string) |

`source_name` should identify the original data source (e.g., `"Wikidata"`, `"NASA Open APIs"`, `"Smithsonian"`). Currently NULL on 81% of facts (8,562 of 10,546) — a major gap. `status` is the moderation state of the fact (`approved`, `pending`, `rejected`, `flagged`); almost all facts default to `approved` without manual review. `source_url` is a direct link to the source page; sparsely populated. `verified_at` records the ISO date of last human or automated verification; mostly NULL.

### 8. Visual / Cardback Art

| Col | Field | Type | Nullable / Default |
|---|---|---|---|
| 18 | `image_url` | TEXT | nullable |
| 38 | `image_prompt` | TEXT | nullable |
| 39 | `visual_description` | TEXT | nullable |
| 40 | `has_pixel_art` | INTEGER | default 0 |
| 41 | `pixel_art_status` | TEXT | default `'none'` |

`visual_description` is the primary field used for cardback generation — a human-readable scene description (e.g., `"A brilliant lightning bolt splitting a dark violet sky, its white-hot channel illuminating towering storm clouds"`). `image_prompt` is a legacy/alternate prompt field that predates `visual_description`. `has_pixel_art` is a boolean (0/1) cached from the filesystem. `pixel_art_status` tracks the generation lifecycle: `none → pending → generating → review → accepted / rejected`. `image_url` is unused — originally intended for remote CDN hosting, never implemented.

### 9. Relationships & Versioning

| Col | Field | Type | Nullable / Default |
|---|---|---|---|
| 36 | `related_facts` | TEXT | nullable (JSON array of fact IDs) |
| 43 | `db_version` | INTEGER | default 0 |
| 21 | `alternate_explanations` | TEXT | nullable |

`related_facts` is a JSON array of fact IDs that are thematically connected (e.g., two facts about the same battle). Sparsely populated; intended for in-game "discover related facts" mechanic. `db_version` is a schema migration counter — incremented when a fact is updated via the quality pipeline so you can tell which facts have been through recent rewrites. `alternate_explanations` holds additional explanation variants (JSON array); populated on very few facts.

---

## Cardback Art Generation Pipeline

Each fact can have a unique pixel-art card illustration — a "cardback" — displayed on the card face during gameplay. The pipeline converts a `visual_description` text field into a 300×400 PNG via ComfyUI running locally.

### How Cardback Art Works

The `visual_description` field in the `facts` table holds a vivid, human-readable scene description written for the image generator (e.g., `"A massive whale breaching ocean waves at sunset, water cascading in dramatic arcs"`). This is distinct from `explanation` (which is player-facing text) and `image_prompt` (a legacy field that predates `visual_description`). The generation state is tracked via `has_pixel_art` (0/1 boolean) and `pixel_art_status` (pipeline stage).

### The Cardback Tool (`sprite-gen/cardback-tool/`)

A standalone Express server running on port 5175 with its own SQLite database (`cardbacks.db`). It operates independently from `facts.db` and tracks generation state at the per-fact level.

**`cardbacks.db` schema:**

| Field | Description |
|---|---|
| `fact_id` | PK — matches `facts.id` |
| `domain` | Top-level domain (e.g., `"Animals & Wildlife"`) |
| `category` | Subcategory string |
| `fact_type` | `"knowledge"` or `"vocab"` |
| `statement` | Cached fact statement for display |
| `visual_description` | The prompt text sent to ComfyUI |
| `status` | `pending / generating / review / accepted / rejected` |
| `notes` | Reviewer notes or rejection reason |
| `file_path_hires` | Path to 300×400 PNG output |
| `file_path_lowres` | Path to 150×200 WebP output |
| `comfyui_prompt_id` | Links to the ComfyUI generation job ID |
| `generated_at` | ISO timestamp of generation |
| `reviewed_at` | ISO timestamp of human review |
| `generation_count` | How many times this card has been regenerated |
| `seed` | ComfyUI random seed used (enables reproducible regeneration) |

**Current state**: 47,734 entries — 37,352 pending, 10,380 in review, 2 generating.

### Generation Flow

```
1. SCAN
   /api/scan reads all seed JSON files from src/data/seed/
   Extracts fact_id + visual_description → populates cardbacks.db

2. VISUAL DESCRIPTION
   Each fact needs a visual_description field
   Pre-written in seed data, or editable via the tool's review UI

3. COMFYUI SUBMISSION
   visual_description is injected into:
   sprite-gen/workflows/API versions/cardback_generator_api.json
   Submitted to ComfyUI at http://localhost:8188

4. HARDWARE
   SDXL + pixel art LoRA on local RTX 3060 12GB
   ~4–8 seconds per image at 30 steps

5. IMAGE PROCESSING (image-pipeline.mjs)
   Raw 300×400 PNG from ComfyUI → two outputs:
   • Hires:  300×400 PNG  (~30–50KB, palette-quantized to 32 colors)
   • Lowres: 150×200 WebP (~5–10KB, nearest-neighbor downscaled)

6. OUTPUT
   public/assets/cardbacks/hires/{fact_id}.png
   public/assets/cardbacks/lowres/{fact_id}.webp

7. MANIFEST
   public/assets/cardbacks/manifest.json
   Auto-generated index: { ids: [...], updatedAt: timestamp }
   Loaded by the game client to know which cardbacks are available
```

### ComfyUI Workflow Node Mapping

The cardback generator uses a JSON-based ComfyUI workflow (`sprite-gen/workflows/API versions/cardback_generator_api.json`). The server programmatically modifies specific nodes before submitting each job:

| Node ID | Node Type | Field Modified | Purpose |
|---------|-----------|----------------|---------|
| `49` | Value (String) | `value` | **Visual description** — the scene prompt text |
| `48` | StringConcatenate | `string_b` | **Style suffix** — appended after the visual description |
| `25` | RandomNoise | `noise_seed` | **Seed** — for reproducible generation |
| `46` | NunchakuFluxLoraLoader | `lora_strength` | **LoRA strength** — pixel art LoRA influence (0.1–0.45) |
| `26` | FluxGuidance | `guidance` | **CFG scale** — prompt adherence (4–5.5) |
| `17` | BasicScheduler | `steps` | **Inference steps** (20–30) |
| `62` | Image Pixelate | `num_colors`, `pixelation_size` | **Pixel quantization** — palette limit and block size |
| `58` | Image Resize | — | **Output resize** — final resolution target |
| `9` | SaveImage | `images` | **Output node** — wired to node 62 (pixelated) or 58 (raw) |

The prompt is composed as: `[visual_description] + [style_suffix]` via the StringConcatenate node (48). The visual description is the fact-specific scene ("A brilliant lightning bolt splitting a dark violet sky...") and the style suffix defines the art direction ("centered in frame, pixel art trading card illustration, 32-bit era JRPG style...").

When `numColors` is 0 (HD styles), the pixelation node (62) is bypassed entirely — the SaveImage node (9) is rewired to read directly from the resize node (58), and node 62 is deleted from the workflow.

---

### Production Style Routing (Language/Domain-Based)

The batch generator uses `getProductionStyle(factId)` to route each fact to the correct art style based on its ID prefix. Currently two production styles exist:

**Default Style** (all non-Japanese facts):
```
Style: "Dark Mood Baseline" — winner from Style Lab round 1
Suffix: "centered in frame, pixel art trading card illustration, 32-bit era JRPG style,
  bold readable silhouette, rich saturated colors against a dark moody background,
  hand-pixeled, clean hard pixel edges, strong dark outlines, interesting microdetails,
  flat shading with minimal dithering, no gradients, no text, no UI elements,
  no border frame, no watermark, slight atmospheric glow around subject,
  game asset card art, vertical portrait composition,
  subject fills 80-90% of frame with breathing room at edges"
LoRA: 0.3 | Colors: 16 | Pixelation: 480 | Guidance: 4 | Steps: 20
```

**Japanese Style** (facts with `ja-` prefix):
```
Style: Generic rendering with kanji/kana suppression
Suffix: "pixel art trading card illustration, 32-bit era JRPG style,
  bold readable silhouette, rich saturated colors against a dark moody background,
  hand-pixeled, clean hard pixel edges, strong dark outlines, interesting microdetails,
  flat shading with minimal dithering, somewhat dark atmospheric mood,
  absolutely no text no writing no kanji no kana no hiragana no katakana
  no letters no characters no words no numbers no symbols no script of any kind
  anywhere in the image, no gradients, no UI elements, no border frame,
  no watermark, game asset card art, vertical portrait composition,
  subject fills 80-90% of frame with breathing room at edges"
LoRA: 0.3 | Colors: 16 | Pixelation: 480 | Guidance: 4 | Steps: 20
```

Key difference: Japanese cards include aggressive text/script suppression (`absolutely no text no writing no kanji no kana no hiragana no katakana...`) because SDXL tends to render Japanese characters into pixel art when the visual description mentions Japanese concepts. The art direction for Japanese cards comes from each fact's `visual_description` field instead (e.g., sumi-e ink wash, ukiyo-e woodblock, gold leaf).

**Routing logic**: `factId.startsWith('ja-') → japanese style, everything else → default style`

Future languages (de-, es-, ko-, etc.) would need similar routing if their visual descriptions trigger unwanted text generation in the art.

---

### Visual Description Strategies (Prompt Lab)

The Prompt Lab tests 4 different visual description strategies per fact to find which approach produces the best cardback art:

| Strategy | Description | Example (fact: "apologize" 謝る) |
|----------|-------------|----------------------------------|
| **iconic** | Symbolic/metaphorical representation | "A single wilting flower drooping downward in shame, petals gently falling off, presented by two open hands reaching forward as an offering of remorse" |
| **action** | Dynamic scene showing the concept in action | "A person bowing very deeply with their forehead nearly touching the ground, hands flat on the floor, their entire body expressing deep sincere regret" |
| **fantasy** | RPG/fantasy-themed interpretation | "A knight kneeling before a glowing throne with helmet removed and head bowed in shame, their sword laid flat on the ground as a gesture of remorse" |
| **literal** | Direct, photorealistic depiction | "A person with closed eyes bowing their head low with both hands pressed together in front of their chest, clearly saying sorry, a broken vase in pieces beside them" |

Each strategy gets the same seed per card, isolating the description as the only variable. Results are compared visually in the Prompt Lab UI to determine which strategy best communicates each fact's concept through pixel art.

---

### 20 Art Style Presets

The tool ships with 20 pixel art style presets for A/B testing visual quality. Each preset defines a complete generation configuration:

| Parameter | Description | Range |
|---|---|---|
| `styleSuffix` | ComfyUI prompt suffix defining the art style | — |
| `loraStrength` | Pixel art LoRA influence | 0.1–0.45 |
| `numColors` | Palette constraint (0 = unlimited) | 0, 4–32 |
| `pixelationSize` | Pixel block size (0 = no pixelation pass) | 0, 120–480 |
| `guidance` | CFG scale | 4–5.5 |
| `steps` | Inference steps | 20–30 |

Notable presets: **Dark Mood Baseline** (default production style), **Game Boy DMG** (4-color green palette), **NES 8-Bit** (54-color NES palette), **SNES Battle Sprite** (RPG battle scene style), **HD Pixel Art** (high-detail, low pixelation), **Chibi SD** (super-deformed characters), **Tarot Arcana** (mystical illustration style), **Ukiyo-e Woodblock** (Japanese print aesthetic), **Minimal Negative Space** (sparse, high-contrast).

### Additional Labs

Three specialized sub-tools share the same ComfyUI infrastructure:

- **Style Lab** (`style_tests` table): Generates the same card across all 20 style presets in a single batch using a fixed seed. Used to pick the best style for a fact or domain.
- **Prompt Lab** (`prompt_tests` table): Tests different `visual_description` phrasings for the same card — useful for iterating on prompt quality before bulk generation.
- **Relic Sprites** (`relic_sprites` table): Separate pipeline for game item/relic sprites. Same ComfyUI workflow, different output dimensions and prompt templates.

### Current State (Post-Cleanup)

- All 31,140 previously generated cardback images (10,380 lowres WebP + 20,760 hires PNG) have been deleted from `public/assets/cardbacks/`
- `facts.db` is empty (0 facts) — database was wiped as part of the full rebuild
- The cardback tool (`sprite-gen/cardback-tool/`) and its database (`cardbacks.db` with 47,734 entries) are intact and ready
- `manifest.json` reflects the empty state
- Cardbacks will need to be regenerated once new facts are populated into `facts.db` and scanned into `cardbacks.db`

---

## Domain-by-Domain Breakdown

### 1. Animals & Wildlife (1,686 facts)

**Subcategories**: birds (635), marine_life (351), mammals (298), conservation (152), reptiles_amphibians (122), insects_arachnids (92), behavior_intelligence (18), adaptations (18)

**Provenance**:
- `animals-b*` (1,347): Wikidata batch imports — species classification, conservation status, scientific names
- `animal-*` (294): Hand-crafted/curated facts about specific animals
- `anim-*` (37): Smaller curated batch

**Quality assessment**: ~80% filler. Dominated by three repetitive patterns:
- "What type of animal is X?" → "bird/mammal/fish" (275 facts)
- "What is the conservation status of X?" → "Least Concern" with identical distractors (167 facts)
- "What is the scientific name of X?" → Latin binomial (592 facts across domains)

**Best example** (fun=10):
```
Q: What extreme phenomenon does a pistol shrimp's claw snap produce?
A: A cavitation bubble reaching nearly 4,700°C
E: Pistol shrimp snap their oversized claw shut so fast it creates a cavitation bubble...
```

**Worst example** (fun=5):
```
Q: Psaltria exilis belongs to which animal type?
A: bird
E: Psaltria exilis is scientifically classified as Psaltria exilis. It is categorized as species of bird.
```

**Ingestion method**: Wikidata SPARQL query for species → raw JSON → LLM-processed into quiz format. The LLM processing was minimal — many facts are near-verbatim Wikidata entity descriptions wrapped in a template question.

**Fun score**: avg=5.6, only 217/1,686 scored >=7

---

### 2. Art & Architecture (1,381 facts)

**Subcategories**: museums_institutions (591), historic_buildings (557), painting_visual (96), modern_contemporary (46), engineering_design (38), sculpture_decorative (28), architectural_styles (25)

**Provenance**:
- `art-b*` (898): Wikidata batch — museum establishment dates, building locations
- `art_architecture_gen_*` (245): LLM-generated quality facts
- `genknow-b*` (206): Misrouted General Knowledge facts (temples, churches)

**Quality assessment**: ~70% filler. Most facts are:
- "In what year was Museum X established?" → year (373 facts across domains)
- "Where is X located?" → "museum in Country" (496 facts across domains)
- Cookie-cutter explanations: "This structure is important to art and architecture" (389 facts)

**206 misrouted `genknow-b*` facts** that should be in General Knowledge are categorized here instead. These are mostly obscure temples and churches with questions like "Which historical structure is described as: 'temple'?"

**Best example** (fun=10):
```
Q: In what year was MoMA founded?
A: 1929
E: MoMA was the first museum dedicated exclusively to modern art, founded by Abby Aldrich Rockefeller...
```

**Worst example** (fun=5):
```
Q: In what year was Hohenloher Freilandmuseum Wackershofen established in?
A: 1983
E: Hohenloher Freilandmuseum Wackershofen was established in 1983. open air museum This structure represents important museums...
```

**Ingestion method**: Wikidata SPARQL for museums/buildings + Met Museum API + Art Institute Chicago API → raw JSON → LLM-processed. The API data produced slightly better results than raw Wikidata, but most are still date/location trivia.

**Fun score**: avg=5.9, only 356/1,381 scored >=7

---

### 3. Food & World Cuisine (1,125 facts)

**Subcategories**: food_history (542), ingredients_spices (138), asian_cuisine (110), european_cuisine (103), baking_desserts (76), world_cuisine (64), food_science (57), fermentation_beverages (35)

**Provenance**:
- `food-b*` (888): Wikidata batch — dish names, origins, descriptions
- `food_cuisine_gen_*` (225): LLM-generated quality facts

**Quality assessment**: BEST DOMAIN. ~50% genuinely engaging, ~30% decent, ~20% mediocre. Even the Wikidata batch facts are often interesting because food facts are inherently engaging. The LLM-generated facts are excellent.

**Issue**: Some answers are too long. One answer is 40+ words (Lacquemant waffles) when the limit is 5 words / 30 chars. 53 facts scored fun<=3.

**Best example** (fun=10):
```
Q: What is this American breakfast entrée of tortillas and scrambled eggs called?
A: breakfast burrito
E: breakfast burrito is a food item. breakfast entree It originates from United States.
```

**Worst example** (fun=5):
```
Q: What is Snail satay?
A: East Java food made from snail
E: Snail satay is a food item. East Java food made from snail
```

**Ingestion method**: Wikidata SPARQL for foods/dishes + USDA FoodData Central → source-mix → LLM-processed. The USDA data wasn't heavily used (only nutritional supplements). Most facts came from Wikidata food entities which happened to have decent descriptions.

**Fun score**: avg=6.8 (HIGHEST), 604/1,125 scored >=7

---

### 4. General Knowledge (665 facts)

**Subcategories**: landmarks_wonders (471), everyday_science (66), inventions_tech (53), pop_culture (33), oddities (19), words_language (14), records_firsts (9)

**Provenance**:
- `genknow-b*` (297): Wikidata batch — temples, churches, archaeological sites
- `gk-*` (259): Hand-crafted/curated trivia facts
- `Q*` (45): Raw Wikidata Q-IDs used as fact IDs (some leaked into question text!)
- `tech-*` (20): Technology/invention facts
- `temple-*` (11): Temple-specific facts

**Quality assessment**: MOST POLARIZED. The `gk-*` facts are excellent trivia (graphene, Monty Hall, Wright Brothers, Venus day). The `genknow-b*` facts are bottom-tier: "Where or what is this item?" → "temple in Alexandrov, Russia" with explanation "temple in Alexandrov, Russia" (circular).

**Specific data quality issues**:
- Wikidata Q-ID leaked into question: "Where is Q723125 located?" (at least 1 confirmed, likely more)
- Typos: "group of templs in Tripura" (answer)
- 471/665 (71%) are landmarks_wonders — massive subcategory imbalance

**Best example** (fun=9):
```
Q: How was graphene first isolated in laboratory?
A: Scotch tape peeling graphite
E: Graphene was first isolated in 2004 by Andre Geim and Konstantin Novoselov...
```

**Worst example** (fun=5):
```
Q: What is Temple of Bellona?
A: archaeological site in Rome, Italy
E: archaeological site in Rome, Italy
```

**Ingestion method**: Mixed. Hand-crafted `gk-*` facts were likely written directly. `genknow-b*` came from a broad Wikidata query for "notable things" that pulled too many obscure temples/churches. The `Q*` prefix facts appear to be raw Wikidata entities that were minimally processed.

**Fun score**: avg=5.4 (LOWEST), only 101/665 scored >=7

---

### 5. Geography (1,122 facts)

**Subcategories**: capitals_countries (587), americas (171), asia_oceania (127), landforms_water (76), africa (72), europe (52), extreme_records (24), climate_biomes (13)

**Provenance**:
- `geo-*` (1,096): Mixed — capitals, flags, country facts, hand-crafted geography
- `genknow-b*` (26): Misrouted General Knowledge facts

**Quality assessment**: SOLID FOR PURPOSE. Capitals (587 facts) are clean, well-formatted, with good distractors. Flag facts use emoji format. Country population facts are functional. Hand-crafted geography facts (Atacama desert, Pacific Ocean, spice trade) are excellent.

**Issues**: Some generic Wikidata: "What geographic location is this?" → "White Sea" (vague question format). Population facts are boring but functional.

**Best example** (fun=10):
```
Q: Which is the driest non-polar desert on Earth?
A: The Atacama Desert
E: Parts of the Atacama are so dry that NASA uses them to test Mars rover instruments...
```

**Typical example** (fun=6):
```
Q: What is the capital of Luxembourg?
A: Luxembourg City
E: Luxembourg City is the capital of the Grand Duchy of Luxembourg...
```

**Ingestion method**: Capitals came from a curated list (possibly CIA World Factbook). Flags from an Anki community deck (countries_cities_flags.apkg). Country data from World Bank API (50 facts). Landforms/records from Wikidata + hand-crafted.

**Fun score**: avg=6.2, 396/1,122 scored >=7

---

### 6. History (1,369 facts)

**Subcategories**: battles_military (839!), ancient_classical (188), modern_contemporary (110), early_modern (79), world_wars (78), medieval (45), social_cultural (30)

**Provenance**:
- `hist-b*` (1,250): Wikidata batch — battles, wars, conflicts
- `genknow-b*` (82): Misrouted General Knowledge facts
- `hist-*` hand-crafted (119): Captain Cook, Bushido, Spanish Armada, etc.
- `battle-*` / `siege-*` (29): Battle-specific facts

**Quality assessment**: MASSIVE SUBCATEGORY IMBALANCE. 839/1,369 (61%) are battles_military. Most are "In what year did Battle of X occur?" or "The Battle of X took place in which century?" The hand-crafted facts are excellent but only ~120 of them.

**Issues**:
- 82 misrouted `genknow-b*` facts (Academy Awards categorized as History)
- One explanation says "This date marks an important moment in architecture" for an Academy Award fact (wrong domain copypasta)
- Some terrible question formats: "What is this historical entity called?" → "Sino-Tibetan War"

**Best example** (fun=10):
```
Q: Cleopatra lived closer in time to which modern event than to the building of the Great Pyramid?
A: The Moon landing
E: The Great Pyramid was already over 2,500 years old when Cleopatra was born...
```

**Worst example** (fun=5):
```
Q: What history item or concept matches this description?
A: Battle of Trifanum
E: Battle of Trifanum was a significant historical event (Trifanum).
```

**Ingestion method**: Wikidata SPARQL for battles/wars → raw JSON → LLM-processed. The query was too focused on battles, producing a lopsided domain. Hand-crafted facts came from separate curation.

**Fun score**: avg=6.4, 533/1,369 scored >=7

---

### 7. Human Body & Health (1,175 facts)

**Subcategories**: anatomy_organs (743!), immunity_disease (204), brain_neuro (68), digestion_metabolism (46), cardiovascular (40), senses_perception (29), genetics_dna (29), medical_science (16)

**Provenance**:
- `health-b*` (921): Wikidata batch — genes, diseases, health conditions
- `human_body_health_gen_*` (221): LLM-generated quality facts
- `lsci-*` (21): Life science facts (some miscategorized — e.g., Wood Wide Web is biology)

**Quality assessment**: WORST DOMAIN. 565 facts are literally "X is a type of what in human cells?" → "Gene" with identical cookie-cutter explanations. Another 179 are "X is an example of what?" → "A health condition". Only the `human_body_health_gen_*` facts are good.

**Critical data error**: 7 facts ask "What role does RNA like **tension headache** play in cells?" — tension headache is not RNA. These are corrupted Wikidata entities that were misclassified during ingestion.

**Best example** (fun=10):
```
Q: Are humans bioluminescent?
A: Yes, but too faintly for eyes to see
E: Chemical reactions involving fluorescent molecules in the skin produce ultra-weak photon emissions...
```

**Worst example** (fun=5):
```
Q: childhood pineoblastoma is an example of what?
A: A health condition
E: childhood pineoblastoma is a medical condition that affects human health. Learning about health conditions helps people...
```

**Ingestion method**: Wikidata SPARQL for genes + diseases → raw JSON → LLM-processed. The gene query returned hundreds of gene symbols (ABCA3, FZD9, MUC1, etc.) that were all processed into the same "is a type of what in human cells?" template. The disease query similarly produced "is an example of what?" → "A health condition" for every entry.

**Fun score**: avg=5.6, only 252/1,175 scored >=7

---

### 8. Mythology & Folklore (722 facts)

**Subcategories**: greek_roman (268), creatures_monsters (157), folk_legends (156), creation_cosmology (45), eastern_myths (37), norse_celtic (33), gods_deities (26)

**Provenance**:
- `myth-b*` (430): Wikidata batch — mythological beings, classifications
- `mythology_folklore_gen_*` (280): LLM-generated quality facts

**Quality assessment**: MIXED BUT BETTER THAN MOST. The `mythology_folklore_gen_*` facts are genuinely interesting (Sun Wukong, Charon coins, kamikaze origin, Brigid syncretism). The Wikidata batch facts are repetitive: "In mythology, X was classified as: Y" with near-synonym distractors (spirit/entity/being/creature/phantom).

**Best example** (fun=10):
```
Q: Who trapped the Monkey King Sun Wukong under a mountain for 500 years?
A: Buddha
E: Sun Wukong is one of literature's most overpowered characters...
```

**Worst example** (fun=5):
```
Q: In mythology, Eleos was classified as:
A: Greek deity
D: Greek spirit | Greek goddess | Greek nymph | Greek titan
E: Eleos is classified as a Greek deity in mythology.
```

**Ingestion method**: Wikidata SPARQL for mythological entities + FactGrid Roscher (15K+ mythology entities) → raw JSON → LLM-processed. The LLM-generated facts show the pipeline working well when given good prompts.

**Fun score**: avg=5.9, 141/722 scored >=7

---

### 9. Natural Sciences (870 facts)

**Subcategories**: botany_plants (311!), chemistry_elements (224), physics_mechanics (102), materials_engineering (95), biology_organisms (88), geology_earth (37), ecology_environment (13)

**Provenance**:
- `animals-b*` (287): MISROUTED — these are plant facts from the Animals & Wildlife Wikidata query that got reclassified as botany_plants
- `nsci-*` (253): Curated science facts
- `natsci-b*` (211): Wikidata batch — elements, compounds, physical constants
- `natural_sciences_gen_*` (100): LLM-generated quality facts

**Quality assessment**: SPLIT. The `nsci-*` and `natural_sciences_gen_*` facts are excellent (wombat poop, fulgurites, Saturn density, Venus flytrap counting). The `natsci-b*` facts are boring element data. The 287 `animals-b*` facts are plant scientific names with circular explanations.

**Issues**:
- 311 botany_plants facts — many are `animals-b*` IDs (plant facts misrouted from Animals pipeline)
- Plant explanations say: "Ariocarpus retusus has the scientific name Ariocarpus retusus. species of plant" (circular)
- Some answers are way too long (Planck mass answer is 20+ words)

**Best example** (fun=10):
```
Q: What unusual shape is wombat poop?
A: Cube-shaped
E: The cubes are formed by the varying elasticity of the wombat's intestinal walls...
```

**Worst example** (fun=5):
```
Q: What is the atomic number of ruthenium?
A: 44
E: ruthenium (RU) has atomic number 44, meaning each atom contains 44 protons.
```

**Ingestion method**: Wikidata SPARQL for elements/compounds + Frictionless Periodic Table + PubChem API → raw JSON → LLM-processed. The plant facts came from the Animals & Wildlife SPARQL query (which included plants) and were reclassified during a category cleanup.

**Fun score**: avg=5.6, 173/870 scored >=7

---

### 10. Space & Astronomy (431 facts)

**Subcategories**: missions_spacecraft (199), satellites_tech (67), planets_moons (59), stars_galaxies (52), cosmology_universe (38), exoplanets_astrobio (16)

**Provenance**:
- `space-b*` (225): Wikidata batch — missions, satellites, spacecraft designations
- `space_astronomy_gen_*` (194): LLM-generated quality facts

**Quality assessment**: ALMOST GOOD. The LLM-generated facts (194) are excellent — Titan methane lakes, LIGO detection, Andromeda collision, Oort Cloud. The Wikidata batch (225) includes obscure satellite designations with terrible questions: "What is this referring to?" → "1965-027E" and "Name one spacecraft: P21?"

**Best example** (fun=10):
```
Q: What was SSLV-D1 for India?
A: First small rocket launch
E: India built a mini rocket specifically designed to launch small satellites quickly and cheaply!
```

**Worst example** (fun=5):
```
Q: What is this referring to?
A: 1965-027E
E: 1965-027E contributes to satellite operations, scientific research, or cargo resupply missions in Earth orbit.
```

**Ingestion method**: Wikidata SPARQL for space missions/satellites + NASA Open APIs → raw JSON → LLM-processed. The NASA API data produced decent facts. The Wikidata mission designations were too granular (individual satellite catalog IDs rather than notable missions).

**Fun score**: avg=6.5, 184/431 scored >=7

---

## Cross-Domain Issues

### 1. Question Variants — CRITICAL GAP

| Metric | Count |
|---|---|
| Facts WITH variants | 34 |
| Facts WITHOUT variants | 10,512 |
| **Coverage** | **0.3%** |

The game design requires 4+ question variants per fact (forward, reverse, negative, fill-blank, true/false, context). Only 34 facts have any variants at all. This means the game currently shows the same question format every time a fact appears — no rotation, no difficulty escalation.

### 2. Source Attribution — MOSTLY MISSING

| Source | Count |
|---|---|
| NULL (no source) | 8,562 (81%) |
| Wikidata | 1,753 (17%) |
| World Bank | 50 |
| Smithsonian | 15 |
| Other (Nature, NASA, Britannica, etc.) | ~112 |

81% of facts have no source attribution. The game design requires `sourceName` on every fact.

### 3. Fun Score Reliability — LOW

| Fun Score | Count | Notes |
|---|---|---|
| fun=5 | 9,178 | Clearly a default/placeholder value |
| fun=6 | 26,483 | Most common (includes vocab) |
| fun<=3 | 671 | Actually rated as boring |
| fun>=7 | 8,328 | Mix of genuine ratings and inflated |

Fun=5 and fun=6 together account for 76% of all facts. These are almost certainly default values, not genuine engagement ratings.

### 4. Answer Length Violations

| Condition | Count |
|---|---|
| Answer > 30 chars (limit per GAME_DESIGN) | 3,199 |
| Answer > 60 chars | 587 |

30% of facts violate the answer length limit. Examples: "A chemical substance or mixture combining antimony with halogens, used in certain explosive applications" (100+ chars).

### 5. Misrouted Facts

- **206 `genknow-b*` facts in Art & Architecture** — should be General Knowledge
- **82 `genknow-b*` facts in History** — misrouted
- **287 `animals-b*` facts in Natural Sciences** — plant facts with animal IDs
- **26 `genknow-b*` facts in Geography** — misrouted

### 6. Junk Pattern Totals

| Pattern | Count |
|---|---|
| "X is a type of what in human cells?" → Gene | 565 |
| Scientific name/classification questions | 592 |
| "Where is X located?" / "Where or what is this item?" | 496 |
| "In what year was X established/constructed?" | 373 |
| Animal type classification | 275 |
| "X is an example of what?" → "A health condition" | 179 |
| Conservation status (identical pattern) | 167 |
| Genus classification | 95 |
| "Matches this description" | 50 |
| "What role does RNA like X" (data errors) | 7 |
| **TOTAL identifiable by pattern** | **~2,800** |

---

## Ingestion Pipeline Summary

### How facts get into the database

```
Step 1: RAW DATA FETCH
  Wikidata SPARQL queries (10 domains) → data/raw/{domain}.json
  + External APIs (NASA, USDA, Met Museum, etc.) → data/raw/{api}.json

Step 2: SOURCE MIXING
  source-mix.mjs blends primary + supplementary sources → data/raw/mixed/{domain}.json

Step 3: FACT GENERATION (this is where quality is determined)
  agent-workers.mjs prepares task bundles → sends to Claude subscription workers
  Workers generate: question, answer, distractors, explanation, fun_score, difficulty
  Output: data/generated/worker-output/{domain}.jsonl

Step 4: INGEST & VALIDATE
  ingest-facts.mjs normalizes schema, validates required fields
  manual-ingest/run.mjs does two-stage dedup (exact + semantic)

Step 5: QA GATES
  post-ingestion-gate.mjs runs: validation, dedup, coverage, gameplay safety
  Thresholds: invalid rate <= 3%, semantic dup rate <= 20%

Step 6: PROMOTE & BUILD
  promote-approved-to-db.mjs → src/data/seed/*.json
  build-facts-db.mjs → public/facts.db + public/seed-pack.json
```

### Where quality failed

The pipeline infrastructure is solid. The quality failures are in **Step 3** — the worker prompts and raw data quality:

1. **Wikidata queries were too broad**: Retrieved every species, every gene, every museum — including thousands of obscure entities nobody cares about
2. **LLM processing was too shallow**: Many facts were generated with template questions rather than creative reformulations
3. **Fun scoring was defaulted**: Workers assigned fun=5 or fun=6 to most facts instead of genuinely rating engagement
4. **Variant generation was skipped**: The pipeline supports variants but workers didn't generate them
5. **Answer length wasn't enforced**: The 30-char limit exists in the game design but wasn't enforced during generation
6. **Source attribution wasn't required**: 81% of facts have no source_name despite it being "REQUIRED" in the game design

---

## Per-Domain Data Sources

| Domain | Primary Source | Supplementary | Hand-Crafted |
|---|---|---|---|
| Animals & Wildlife | Wikidata species (GBIF taxonomy) | None significant | ~294 curated |
| Art & Architecture | Wikidata museums/buildings | Met Museum API, Art Institute Chicago API | ~245 gen |
| Food & World Cuisine | Wikidata food entities | USDA FoodData Central | ~225 gen |
| General Knowledge | Wikidata "notable things" | Smithsonian | ~259 curated |
| Geography | Curated capitals list, Wikidata | World Bank API, CIA Factbook | ~50 hand |
| History | Wikidata battles/wars | None significant | ~119 curated |
| Human Body & Health | Wikidata genes/diseases | None significant | ~221 gen |
| Mythology & Folklore | Wikidata mythological entities, FactGrid Roscher | None significant | ~280 gen |
| Natural Sciences | Wikidata elements/compounds, Frictionless Periodic Table | PubChem API | ~100 gen |
| Space & Astronomy | Wikidata missions/satellites | NASA Open APIs | ~194 gen |

---

## Seed Files (what builds facts.db)

| File | Contents |
|---|---|
| `src/data/seed/facts-general-a.json` | Knowledge domain batch A |
| `src/data/seed/facts-general-b.json` | Knowledge domain batch B |
| `src/data/seed/facts-general-c.json` | Knowledge domain batch C |
| `src/data/seed/facts-generated.json` | LLM-generated facts (all domains) |
| `src/data/seed/tutorial.json` | Tutorial-specific facts |
| `src/data/seed/vocab-*.json` | Vocabulary facts (now deleted from DB) |

`build-facts-db.mjs` reads all `*.json` from `src/data/seed/`, normalizes, and writes to `public/facts.db`.

---

## Recommendations for Deep Research

Questions to consider:

1. **Delete and regenerate all ~8,000 Wikidata batch facts?** The infrastructure exists. Better prompts + stricter quality gates + variant generation would produce dramatically better results.

2. **Keep the ~2,500 hand-crafted/gen facts as a quality baseline?** These demonstrate what the pipeline CAN produce when given good prompts.

3. **Target count per domain?** Current distribution is uneven (Animals 1,686 vs Space 431). Should all domains have equal depth or weight by engagement?

4. **Variant generation**: This is the single biggest gap. Zero-to-hero effort needed. Could be done as a separate pass over existing good facts.

5. **Subcategory rebalancing**: History is 61% battles. Health is 63% anatomy_organs (mostly genes). These need intentional query design, not broad Wikidata sweeps.

6. **Quality-over-volume trade**: 500 excellent facts per domain (5,000 total) would provide better gameplay than 10,000 mediocre ones. The run pool only uses ~120 facts per run.
