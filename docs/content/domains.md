# Domains & Content Themes

> **Purpose:** Documents all knowledge domains, their metadata, subcategory taxonomy, domain resolution logic, and the distinction between language and knowledge domains.
> **Last verified:** 2026-04-09
> **Source files:** `src/data/domainMetadata.ts`, `src/data/subcategoryTaxonomy.ts`, `src/data/categories.ts`, `src/services/domainResolver.ts`, `src/services/domainSubcategoryService.ts`

---

## What Is a Domain?

A domain is the top-level content classification for a fact or skill. Every fact belongs to exactly one `CanonicalFactDomain`. Domains control:
- Card visual theming (color tint, icon)
- Which facts appear in which deck selection pool
- Subcategory filtering in Study Temple
- Domain resolution for card coloring during combat

---

## All Domains (`DOMAIN_METADATA`)

Defined in `src/data/domainMetadata.ts` as `Record<CanonicalFactDomain, DomainMetadata>`.

| ID | Display Name | Short Name | Color Tint | Icon | Age Default | Status | Notes |
|---|---|---|---|---|---|---|---|
| `general_knowledge` | General Knowledge | General | `#6B7280` | 🧠 | kid | active | |
| `natural_sciences` | Natural Sciences | Science | `#10B981` | 🧪 | teen | active | |
| `space_astronomy` | Space & Astronomy | Space | `#6366F1` | 🌌 | kid | coming soon | |
| `geography` | General Geography | General Geography | `#F59E0B` | 🗺️ | kid | active | |
| `geography_drill` | Capitals & Flags | Capitals & Flags | `#D97706` | 🏳️ | kid | active | |
| `history` | History | History | `#0EA5E9` | 🏺 | teen | active | |
| `mythology_folklore` | Mythology & Folklore | Myth | `#8B5CF6` | 🐉 | teen | coming soon | |
| `animals_wildlife` | Animals & Wildlife | Animals | `#22C55E` | 🦉 | kid | coming soon | |
| `human_body_health` | Human Body & Health | Health | `#14B8A6` | 🫀 | teen | coming soon | |
| `food_cuisine` | Food & World Cuisine | Cuisine | `#F97316` | 🍜 | kid | coming soon | |
| `art_architecture` | Art & Architecture | Art | `#EC4899` | 🎨 | kid | coming soon | |
| `social_sciences` | Social Sciences | Social Sci | `#7C3AED` | 📊 | teen | coming soon | |
| `sports_entertainment` | Sports & Entertainment | Sports | `#EF4444` | 🏆 | kid | active | First deck: FIFA World Cup (181 facts), launched 2026-04-09 |
| `language` | Language | Language | `#34D399` | 🗣️ | kid | active | Study Temple only |
| `mathematics` | Mathematics | Math | `#3B82F6` | 🔢 | kid | active | Procedural — no static facts |

`comingSoon: true` domains are defined but not yet populated with substantial fact content.

`mathematics` is a **procedural domain** — it generates problems algorithmically via `ProceduralDeck` skill nodes rather than drawing from `factsDB`. See `src/data/proceduralDeckTypes.ts`.

### DomainMetadata Interface

```typescript
interface DomainMetadata {
  id: CanonicalFactDomain
  displayName: string
  shortName: string
  colorTint: string       // hex color used for card tinting and gradient
  icon: string            // emoji shown in deck tiles and UI headers
  description: string     // player-facing description
  ageDefault: AgeRating   // default age gate for this domain
  comingSoon?: boolean    // hides from primary selection if true
}
```

---

## Sports & Entertainment Domain

Added 2026-04-09 as the library's first dedicated Sports & Entertainment domain, part of the internationalization strategic priority (see `data/deck-ideas.md` Section 3.11).

- **ID:** `sports_entertainment`
- **Display Name:** Sports & Entertainment
- **Short Name:** Sports
- **Description:** Global sports, iconic competitions, and legendary athletes — from the FIFA World Cup to the Olympics, Formula 1, and chess grandmasters.
- **Color:** `#EF4444` (crimson red — athletic energy, competition, victory)
- **Icon:** 🏆
- **Age Default:** kid
- **Status:** Active — FIFA World Cup deck complete (181 facts, 5 sub-decks, launched 2026-04-09). `comingSoon` flag removed.

### Planned Decks

| Deck | Status | Sub-deck themes |
|---|---|---|
| FIFA World Cup | **Complete** — 181 facts, 5 sub-decks, launched 2026-04-09 | Championship, Legendary, Iconic Moments |
| Olympics | Planned | Summer Games, Winter Games, Legendary Athletes |
| Formula 1 | Planned | Championship, Circuits, Constructors |
| Chess | Planned | World Champions, Famous Matches, Openings |
| Cricket | Planned | Test Cricket, World Cup, Legendary Players |
| Tennis | Planned | Grand Slams, Rivalries, Records |

### Default Chain Themes

Sports decks default to these chain themes (matching `fifa_world_cup_arch.yaml`):
- **Championship** — tournament/competition knowledge chain
- **Legendary** — iconic players and athletes chain
- **Iconic Moments** — match and performance highlights chain

### Domain Resolution

Facts in this domain should have `categoryL1: 'sports_entertainment'` or `category[0]: 'Sports & Entertainment'` or `category[0]: 'Sports'`. The `DOMAIN_TO_CATEGORY` mapping in `presetPoolBuilder.ts` includes both `'Sports & Entertainment'` and `'Sports'` as legacy category strings.

---

## Knowledge Domains vs Special Domains

`getKnowledgeDomains()` returns all canonical domains except `'language'`, `'geography_drill'`, and `'mathematics'`. These three are excluded because:
- `language` facts belong to Study Temple curated decks only — they must not appear in trivia runs (enforced by `factsDB.getTriviaFacts()`)
- `geography_drill` (Capitals & Flags) is a specialized drill domain, not general trivia
- `mathematics` is procedural — no static facts exist in `factsDB`; it has its own Study Temple tab

`geography_drill` facts are geography facts with subcategories in the capitals/flags set (`capitals_countries`, `world_capitals`, `flags`, `national_flags`, etc.) — routed to the dedicated drill domain by `domainResolver.ts`.

`GENERAL_MODE_DOMAINS` in `presetPoolBuilder.ts` also excludes `mathematics` (along with `language`, `geography`, `geography_drill`) so trivia runs never attempt to query math facts.

`sports_entertainment` is included by `getKnowledgeDomains()` — it is a standard knowledge domain for trivia dungeon use. The FIFA World Cup deck provides the first 181 facts. The `comingSoon` flag should be removed from `domainMetadata.ts` once the trivia dungeon pool is large enough for good variety (recommend: 500+ facts across 3+ decks).

---

## Domain Resolution (`domainResolver.ts`)

Facts are mapped to domains via `resolveDomain(fact: Fact): FactDomain`. The resolver uses a `CATEGORY_TO_DOMAIN` lookup that handles both the current snake_case DB format and legacy Title Case category strings.

### Resolution Priority

1. `fact.categoryL1` — the authoritative domain field (checked first)
2. `fact.category[0]` — primary top-level category string
3. Walk `fact.category[]` until a match is found
4. Default: `'general_knowledge'`

After resolving to `'geography'`, a second check routes facts to `'geography_drill'` if their `categoryL2` or `category[1]` matches the capitals/flags subcategory set.

Results are memoized in `FACT_DOMAIN_CACHE: Map<string, FactDomain>` per fact ID.

### Legacy Category Aliases

| Legacy String | Resolves To |
|---|---|
| `'Life Sciences'` | `human_body_health` |
| `'Technology'` | `general_knowledge` |
| `'Culture'` | `art_architecture` |
| `'Mathematics'` / `'Math'` | `mathematics` (was `general_knowledge` before 2026-04-03) |
| `'Science'` | `natural_sciences` |
| `'Arts'` | `art_architecture` |
| `'Medicine'` / `'Health'` | `human_body_health` |

The legacy `'math'` domain (in `LEGACY_DOMAIN_NORMALIZATION`) now normalizes to `'mathematics'` instead of `'general_knowledge'`. Any saved player data with `domain: 'math'` cards will resolve correctly.

---

## Subcategory Taxonomy (`subcategoryTaxonomy.ts`)

`SUBCATEGORY_TAXONOMY: Partial<Record<CanonicalFactDomain, SubcategoryDef[]>>` defines display-ready subcategory labels for each domain. Each `SubcategoryDef` has `id`, `label`, and `description`.

### Subcategories by Domain

**general_knowledge** (7): Records & Firsts, Inventions & Technology, Landmarks & Wonders, Pop Culture & Media, Words & Language, Everyday Science, Oddities & Curiosities

**natural_sciences** (7): Chemistry & Elements, Materials & Engineering, Biology & Organisms, Physics & Mechanics, Geology & Earth, Plants & Botany, Ecology & Environment

**space_astronomy** (6): Missions & Spacecraft, Planets & Moons, Stars & Galaxies, Cosmology & Universe, Satellites & Space Tech, Exoplanets & Astrobiology

**geography** (7): Africa, Asia & Oceania, Europe, Americas, Landforms & Water, Records & Extremes, Climate & Biomes

**geography_drill** (6): Capital Cities, Countries by Capital, Major World Capitals, South American Capitals, Central American Capitals, African Capitals

**history** (8): Ancient & Classical, Medieval, Early Modern, Modern & Contemporary, World Wars, Battles & Military, People & Leaders, Social & Cultural

**mythology_folklore** (7): Greek & Roman, Norse & Celtic, Eastern Mythology, Creatures & Monsters, Creation & Cosmology, Folk Tales & Legends, Gods & Deities

**animals_wildlife** (8): Mammals, Birds, Marine Life, Insects & Arachnids, Reptiles & Amphibians, Behavior & Intelligence, Conservation, Adaptations & Records

**human_body_health** (8): Anatomy & Organs, Brain & Neuroscience, Genetics & DNA, Heart & Blood, Digestion & Metabolism, Senses & Perception, Immunity & Disease, Medical Science

**food_cuisine** (8): European Cuisine, Asian Cuisine, World Cuisine, Baking & Desserts, Fermentation & Beverages, Food History & Origins, Food Science & Techniques, Ingredients & Spices

**art_architecture** (7): Museums & Institutions, Historic Buildings, Painting & Visual Arts, Sculpture & Decorative Arts, Modern & Contemporary Art, Architectural Styles, Engineering & Design

**sports_entertainment** (8): Football (Soccer), Olympics, Formula 1, Tennis, Chess, Cricket, Athletics, Records & Firsts — added 2026-04-09

**language** (40+): Chinese HSK 1–7, Japanese N5–N1/Hiragana/Katakana, Spanish A1–C1, French A1–C2, German A1–C2, Dutch A1–C1, Czech A1–C1, Korean Beginner/Intermediate/Advanced

**mathematics**: No subcategory taxonomy — uses `ProceduralSubDeck` groupings (Addition, Subtraction, Multiplication, etc.) defined in `ProceduralDeck.subDecks`.

---

## Runtime Subcategory Service (`domainSubcategoryService.ts`)

`getDomainSubcategories(domain)` scans the loaded `factsDB` and returns `DomainSubcategoryInfo[]` sorted by fact count (descending), with `"General"` always first.

```typescript
interface DomainSubcategoryInfo {
  id: string    // subcategory ID (from category[1] or categoryL2)
  name: string  // display label from SUBCATEGORY_TAXONOMY
  count: number // number of facts in this domain+subcategory
}
```

Results are memoized at module level per domain — the full scan only runs once per session.

Subcategory is extracted from `fact.category[1]` trimmed, then `fact.categoryL2` trimmed, falling back to `'General'`.

Note: calling `getDomainSubcategories('mathematics')` will always return an empty array — procedural math has no facts in `factsDB`.

---

## CSS Domain Classes

`getDomainCSSClass(domain)` returns a CSS class string in the form `domain-<canonicalId>` (e.g. `domain-history`, `domain-language`, `domain-mathematics`, `domain-sports_entertainment`). Used for domain-tinted styling in card frames and UI elements.
