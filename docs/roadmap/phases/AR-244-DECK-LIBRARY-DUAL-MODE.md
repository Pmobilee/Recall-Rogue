# AR-244: Dungeon Selection Screen + Dual-Mode Run System

**Status:** Implemented (2026-03-24) — pending visual verification and custom playlist feature
**Complexity:** Large (new screen, data layer, game mode split, vocabulary migration)
**Dependencies:** None (builds on existing FSRS infrastructure and DeckBuilder.svelte which will be replaced)

> **Implementation Notes (2026-03-24):**
> - Two modes implemented: Trivia Dungeon + Study Temple (Custom tab was added then removed — replaced with "Add to Custom" buttons on individual decks)
> - Vocabulary tree view with language grouping, per-language settings cogwheel (gold ⚙ Settings button), "Study All [Language]" option
> - Custom playlists as persistent bottom bar (named playlist popup still TODO — task #24)
> - Run pipeline wired: trivia uses buildPresetRunPool with domain/subdomain filtering, study uses curated deck or buildLanguageRunPool for all:lang
> - Encounter bug fixed: resetEncounterBridge() called in startNewRun()
> - StudyModeSelector removed from campsite, Topic Interests disabled
> - Old DeckBuilder.svelte still exists (not archived yet — task #26)
> - __terraScenario 'dungeon-selection' added for testing
> - All fact pools completely separate: trivia uses facts.db, curated decks use data/decks/*.json

---

## 1. Overview

Replace the current "Deck Builder" study preset system with a unified **Dungeon Selection Screen** — a single entry point where the player picks their run mode and configures what to study. Two modes:

1. **Trivia Dungeon** (casual) — pick domains/subdomains from the general trivia fact pool, mix and match freely
2. **Study Temple** (focused) — pick a curated deck with structured learning, FSRS-tracked progress, sub-decks with their own progress bars

The two modes use **completely separate fact pools** — no overlap. The screen remembers the player's last selected mode and configuration.

### Goals
- Single, unified entry point for all runs — ultra easy to understand and navigate
- Left-hand domain sidebar for both modes
- Trivia: multi-select domains and subdomains, or select everything
- Study Temple: browsable curated deck catalog with sub-decks, each with FSRS progress bars
- Migrate ALL vocabulary content (Japanese, Korean, Spanish, etc.) to curated decks — vocabulary IS curated study, not trivia
- Remember last selection for quick re-entry

---

## 2. Game Mode Split

### 2.1 Run Start Flow (Current)
```
Hub/Campsite -> "Start Run" / "Deck Builder" -> old preset system -> dungeon
```

### 2.2 Run Start Flow (New)
```
Hub/Campsite -> "Enter Dungeon" button -> DungeonSelectionScreen
  -> Mode tabs at top: [Trivia Dungeon] [Study Temple]
  -> Last-used mode and config pre-selected
  -> Configure domains/decks -> [Start Run]
```

### 2.3 Mode Differences

| Aspect | Trivia Dungeon | Study Temple |
|--------|---------------|--------------|
| Fact source | General trivia DB (`facts.db`, `knowledge-*.json`) | Curated deck files (`data/decks/*.json`) — completely separate facts |
| Selection | Multi-select domains + subdomains | Pick one curated deck (with optional sub-deck focus) |
| Chain themes | Generic chains (Obsidian/Crimson/etc.) | Generic chain slots (0-5), future: thematic chains |
| Confusion matrix | Inactive — random distractors | Active — adapts distractors |
| In-run FSRS | Inactive — random fact selection | Active — weights fact selection |
| Distractor source | Pre-generated per fact | Pool-based (same answer type pool) |
| Progress tracking | Per-fact FSRS (no deck progress view) | Per-deck and per-sub-deck progress bars |
| Strategic depth | Low — pure trivia fun | High — structured learning with mastery tracking |

### 2.4 Fact Pool Separation (CRITICAL)

**Trivia Dungeon and Study Temple use COMPLETELY SEPARATE fact pools.** Zero overlap.

| Pool | Source | Used By |
|------|--------|---------|
| General trivia facts | `src/data/seed/facts.db`, `knowledge-*.json` | Trivia Dungeon only |
| Curated deck facts | `data/decks/<deck_id>.json` | Study Temple only |

Both can cover the same topics (both might have WW2 content) but the actual entries are entirely different — different IDs, questions, distractors.

**Future:** Once enough curated decks exist, Trivia Dungeon could optionally pull from curated facts. Not for initial implementation.

---

## 3. Dungeon Selection Screen Layout

### 3.1 Overall Structure (Landscape 16:9 at 1920x1080)

```
+------------------------------------------------------------------+
| [Back]     DUNGEON SELECTION                         [Start Run]  |
+------------------------------------------------------------------+
| Mode: [Trivia Dungeon] [Study Temple]   <- tab toggle at top     |
+------------------------------------------------------------------+
|          |                                                        |
| DOMAINS  |  CONTENT AREA (changes based on mode + domain)        |
| (left    |                                                        |
|  sidebar)|  Trivia: shows subdomains as checkboxes               |
|          |  Study:  shows curated deck tiles with progress        |
|          |                                                        |
| [*] All  |                                                        |
| [ ] Hist |                                                        |
| [ ] Geo  |                                                        |
| [ ] Sci  |                                                        |
| [ ] Space|                                                        |
| [ ] Gen  |                                                        |
| [ ] Myth |                                                        |
| [ ] Anim |                                                        |
| [ ] Body |                                                        |
| [ ] Art  |                                                        |
| [ ] Food |                                                        |
| [  Vocab]|  <- Study Temple only (curated language decks)         |
|          |                                                        |
+------------------------------------------------------------------+
```

### 3.2 Persistence

The screen remembers and restores:
- Last selected mode (Trivia Dungeon or Study Temple)
- Last selected domains/subdomains (Trivia)
- Last selected deck + sub-deck (Study Temple)

Stored in `playerSave` alongside other preferences.

---

## 4. Trivia Dungeon Mode

### 4.1 Domain Sidebar (Left)

Vertical list of all trivia domains with checkboxes:
- **"All" option** at top — selects/deselects everything
- Each domain is a checkbox — player can select multiple domains simultaneously
- Selected domains are highlighted with domain color accent
- Domain list matches `CanonicalFactDomain` enum (excluding `language` — vocabulary lives in Study Temple only)

### 4.2 Content Area (Right) — Subdomain Picker

When one or more domains are selected, the content area shows their subdomains as a multi-select checklist:

```
+------------------------------------------+
|  HISTORY                                  |
|  [*] All History                         |
|  [*] World War II                        |
|  [*] Ancient Civilizations               |
|  [ ] Cold War                            |
|  [ ] Medieval Europe                     |
|  ...                                     |
|                                          |
|  GEOGRAPHY                               |
|  [*] All Geography                       |
|  [*] Capitals                            |
|  [ ] Rivers & Mountains                  |
|  [ ] Flags                               |
|  ...                                     |
|                                          |
|  Selected: 2 domains, 4 subdomains       |
|  ~320 facts available                    |
+------------------------------------------+
```

- Each domain section has an "All [Domain]" toggle
- Individual subdomains can be toggled independently
- Footer shows selection summary: domain count, subdomain count, approximate fact count
- Player can freely mix: e.g., "WW2 + Ancient Rome + all Geography + just Space Planets"

### 4.3 Subdomains Source

Subdomains come from the existing `categoryL2` values in the trivia fact database. The `getDomainSubcategories()` service already provides this data.

---

## 5. Study Temple Mode

### 5.1 Domain Sidebar (Left)

Same sidebar position as Trivia mode, but the domain list includes **Vocabulary** and domains are single-select (clicking a domain shows its curated decks):

- Clicking a domain filters the content area to show only that domain's curated decks
- "All" shows every curated deck across all domains
- **"Vocabulary"** domain shows all language decks (Japanese, Korean, Spanish, etc.)
- Active domain has highlight/accent — only one active at a time

### 5.2 Content Area (Right) — Deck Tiles

Shows curated deck tiles for the selected domain as a scrollable grid:

```
+----------------------------------------------------------+
|                                                          |
|  +-------------+  +-------------+  +-------------+      |
|  |             |  |             |  |             |      |
|  |  Deck Art   |  |  Deck Art   |  |  Deck Art   |      |
|  | Placeholder |  | Placeholder |  | Placeholder |      |
|  |             |  |             |  |             |      |
|  | US Presid.  |  | World War II|  | Ancient Rome|      |
|  | 46 facts    |  | 60 facts    |  | 55 facts    |      |
|  | [=====--] 72%| | [==----] 30%|  | [-------] 0%|      |
|  +-------------+  +-------------+  +-------------+      |
|                                                          |
|  +-------------+  +-------------+  +-------------+      |
|  |  ...        |  |  ...        |  |  ...        |      |
|  +-------------+  +-------------+  +-------------+      |
|                                                          |
+----------------------------------------------------------+
```

### 5.3 Deck Tile Component (`DeckTile.svelte`)

Card-like tile with rounded edges:

```
+------------------+
|                  |
|    Art Area      |  <- placeholder gradient/icon initially, later filled with generated art
|    (16:10)       |
|                  |
+------------------+
|  Deck Name       |  <- bold, truncated if long
|  46 facts        |  <- total fact count
|  [========--] 72%|  <- FSRS progress bar (right-aligned percentage)
+------------------+
```

**Visual specs:**
- Rounded corners: `calc(12px * var(--layout-scale, 1))`
- Border: subtle 1px border, domain-colored accent on left edge
- Background: dark card surface
- Art placeholder: gradient using domain colors, with domain icon centered
- Progress bar: thin horizontal bar, green fill for mastered percentage
- Hover state: slight scale up (1.02), glow effect
- Click: opens Deck Detail panel

**States:**
- **Available** — playable. Shows progress bar.
- **Coming Soon** — grayed out, "Coming Soon" badge. Exists in registry but no facts yet.
- **Completed** — all facts mastered. Gold border/badge.

### 5.4 Deck Detail Panel (`DeckDetail.svelte`)

Clicking a deck tile opens a detail panel (slide-in from right or modal overlay). This is where sub-decks and their progress are shown:

```
+------------------------------------------+
| [X Close]                                |
|                                          |
|  JAPANESE N3 VOCABULARY                  |
|  "800+ intermediate Japanese words"      |
|                                          |
|  Total: 800 facts  |  Mastered: 340 (43%)|
|  [===================-----------]        |
|                                          |
|  SUB-DECKS:                              |
|  [*] All (800 facts)            43% [==] |
|  [ ] Vocabulary (600 facts)     51% [==] |
|  [ ] Kanji (150 facts)          22% [==] |
|  [ ] Grammar (50 facts)         10% [==] |
|                                          |
|  Select a sub-deck to focus, or          |
|  study all for variety.                  |
|                                          |
|  [  START STUDY RUN  ]                   |
|                                          |
+------------------------------------------+
```

**Sub-deck selection:**
- "All" = study the entire deck (default)
- Selecting a specific sub-deck focuses the run on only those facts
- Each sub-deck shows its own FSRS progress bar
- Radio selection (one at a time) — you study one sub-deck or all, not arbitrary combos

**For non-vocabulary knowledge decks**, sub-decks might be optional. A "World Capitals" deck might just show the full deck without sub-deck breakdown, or it might split into regional sub-decks if they're large enough.

### 5.5 Vocabulary Migration (CRITICAL)

**ALL vocabulary content (Japanese N5-N1, Korean, Spanish, French, German, Dutch, Czech, etc.) MUST be migrated to curated decks.** Vocabulary is structured study, not casual trivia. It belongs in Study Temple.

This means:
- Existing vocabulary facts in `src/data/seed/` move to `data/decks/` as curated deck JSON files
- Each language level becomes its own deck (e.g., `japanese_n3.json`)
- Sub-decks within a language deck: Vocabulary, Kanji, Grammar (where applicable)
- Each sub-deck has its own progress bar
- Language decks appear under the "Vocabulary" domain in the Study Temple sidebar
- Language facts are REMOVED from the Trivia Dungeon fact pool — they only live in Study Temple

**The deck-master skill must be updated to explicitly handle vocabulary deck migration and make this clear to workers.**

---

## 6. FSRS Progress Aggregation

### 6.1 Per-Deck Progress

```typescript
interface DeckProgress {
  deckId: string;
  totalFacts: number;
  factsEncountered: number;    // facts seen at least once
  factsMastered: number;       // facts at stability >= 21 days
  averageStability: number;    // avg FSRS stability across encountered facts
  progressPercent: number;     // factsMastered / totalFacts * 100
}
```

**Mastery threshold:** stability >= 21 days (3 weeks).

### 6.2 Per-Sub-Deck Progress

```typescript
interface SubDeckProgress {
  subDeckId: string;
  parentDeckId: string;
  totalFacts: number;
  factsMastered: number;
  progressPercent: number;
}
```

Sub-deck progress is computed by filtering the deck's fact IDs to those belonging to the sub-deck, then running the same FSRS lookup.

### 6.3 Progress Service (`src/services/deckProgressService.ts`)

```typescript
function getDeckProgress(deckId: string): DeckProgress;
function getSubDeckProgress(deckId: string, subDeckId: string): SubDeckProgress;
function getAllDeckProgress(): Map<string, DeckProgress>;
```

---

## 7. Data Layer

### 7.1 Deck Registry (`src/data/deckRegistry.ts`)

Central registry of all available curated decks. Metadata only — no facts.

```typescript
interface DeckRegistryEntry {
  id: string;                    // e.g., "japanese_n3"
  name: string;                  // "Japanese N3 Vocabulary"
  description: string;           // Player-facing description
  domain: CanonicalFactDomain | 'vocabulary';
  subDomain?: string;
  factCount: number;
  subDecks?: {
    id: string;                  // e.g., "kanji"
    name: string;                // "Kanji"
    factCount: number;
  }[];
  tier: 1 | 2 | 3;
  status: 'available' | 'coming_soon';
  artPlaceholder: {
    gradientFrom: string;
    gradientTo: string;
    icon: string;
  };
}
```

### 7.2 Deck Fact Index (`src/data/deckFactIndex.ts`)

Maps deck IDs and sub-deck IDs to fact IDs for progress calculation.

```typescript
const DECK_FACT_INDEX: Record<string, {
  allFacts: string[];
  subDecks?: Record<string, string[]>;  // subDeckId -> factIds
}> = {
  'japanese_n3': {
    allFacts: ['ja_n3_001', 'ja_n3_002', ...],
    subDecks: {
      'vocabulary': ['ja_n3_001', 'ja_n3_002', ...],
      'kanji': ['ja_n3_k001', 'ja_n3_k002', ...],
      'grammar': ['ja_n3_g001', 'ja_n3_g002', ...],
    }
  },
  'us_presidents': {
    allFacts: ['usp_washington', 'usp_j_adams', ...],
    // no subDecks — single flat deck
  },
};
```

### 7.3 Run Configuration

```typescript
interface RunConfig {
  mode: 'trivia' | 'study';

  // Trivia mode
  triviaSelection?: {
    domains: CanonicalFactDomain[];      // selected domains (empty = all)
    subdomains?: Record<string, string[]>; // domain -> selected subcategories
  };

  // Study mode
  studySelection?: {
    deckId: string;
    subDeckId?: string;                  // optional sub-deck focus
  };
}
```

### 7.4 Persistence

```typescript
interface LastDungeonSelection {
  mode: 'trivia' | 'study';
  triviaConfig?: {
    domains: string[];
    subdomains: Record<string, string[]>;
  };
  studyConfig?: {
    deckId: string;
    subDeckId?: string;
  };
}
```

Stored in `playerSave.lastDungeonSelection`.

---

## 8. Component Hierarchy

```
Hub/Campsite
  └── [Enter Dungeon] button -> navigates to DungeonSelectionScreen
        ├── ModeToggle.svelte (Trivia Dungeon / Study Temple tabs)
        ├── DomainSidebar.svelte (left sidebar, shared by both modes)
        │
        ├── [Trivia Mode] -> TriviaContentArea.svelte
        │     └── SubdomainChecklist.svelte (multi-select subdomains per domain)
        │
        └── [Study Mode] -> StudyContentArea.svelte
              ├── DeckGrid.svelte (responsive grid of DeckTiles)
              │     └── DeckTile.svelte (individual deck card with progress)
              └── DeckDetail.svelte (slide-in panel with sub-decks + progress)
```

### New Files

| File | Purpose |
|------|---------|
| `src/ui/components/DungeonSelectionScreen.svelte` | Main unified selection screen |
| `src/ui/components/ModeToggle.svelte` | Trivia Dungeon / Study Temple tab toggle |
| `src/ui/components/DomainSidebar.svelte` | Left sidebar domain list (shared) |
| `src/ui/components/TriviaContentArea.svelte` | Trivia subdomain multi-select |
| `src/ui/components/SubdomainChecklist.svelte` | Checkbox list of subdomains |
| `src/ui/components/StudyContentArea.svelte` | Study deck grid container |
| `src/ui/components/DeckGrid.svelte` | Responsive grid layout for deck tiles |
| `src/ui/components/DeckTile.svelte` | Individual deck card with art + progress |
| `src/ui/components/DeckDetail.svelte` | Deck detail with sub-decks + progress bars |
| `src/data/deckRegistry.ts` | Deck metadata registry |
| `src/data/deckFactIndex.ts` | Deck/sub-deck -> fact ID mappings |
| `src/services/deckProgressService.ts` | FSRS progress aggregation |

### Modified Files

| File | Change |
|------|--------|
| `src/ui/components/DeckBuilder.svelte` | **REPLACED** — archived to `src/_archived/` |
| `src/CardApp.svelte` | Add DungeonSelectionScreen to screen router |
| Hub/Campsite component | Replace "Deck Builder" button with single "Enter Dungeon" button |
| Run initialization code | Accept `RunConfig` with mode, selections |
| `src/data/domainMetadata.ts` | Add 'vocabulary' domain if not present |

---

## 9. Sub-Steps

### Phase A: Data Layer (no UI)

- [ ] **A1.** Create `src/data/deckRegistry.ts` with `DeckRegistryEntry` interface, empty registry, `getDecksForDomain()`, `getDeck()`
- [ ] **A2.** Create `src/data/deckFactIndex.ts` with index structure including sub-deck support
- [ ] **A3.** Create `src/services/deckProgressService.ts` with `getDeckProgress()`, `getSubDeckProgress()`, `getAllDeckProgress()`
- [ ] **A4.** Define `RunConfig` type with trivia/study modes and selection structures
- [ ] **A5.** Define `LastDungeonSelection` persistence type and wire into `playerSave`
- [ ] **A6.** Add build script or static import to populate registry and index from `data/decks/*.json`

### Phase B: Vocabulary Migration

- [ ] **B1.** Convert existing vocabulary facts from `src/data/seed/` format to curated deck JSON format in `data/decks/`
- [ ] **B2.** Create deck registry entries for each language (Japanese N5, N4, N3, Korean TOPIK 1-2, etc.)
- [ ] **B3.** Define sub-decks per language deck (Vocabulary, Kanji, Grammar where applicable)
- [ ] **B4.** Update deck-master skill to document vocabulary migration rules
- [ ] **B5.** Remove language facts from the trivia fact pool (they only live in Study Temple)
- [ ] **B6.** Update `docs/GAME_DESIGN.md` to document vocabulary as curated-only content

### Phase C: Dungeon Selection Screen UI

- [ ] **C1.** Create `ModeToggle.svelte` — two-tab toggle: Trivia Dungeon / Study Temple
- [ ] **C2.** Create `DomainSidebar.svelte` — left sidebar with domain list. Checkboxes for Trivia, single-select for Study. Includes "Vocabulary" for Study mode.
- [ ] **C3.** Create `SubdomainChecklist.svelte` — multi-select checkbox list of subdomains per domain
- [ ] **C4.** Create `TriviaContentArea.svelte` — shows subdomain checklists for selected domains, with selection summary footer
- [ ] **C5.** Create `DeckTile.svelte` — rounded card frame, art placeholder, deck name, fact count, FSRS progress bar. All dimensions use `--layout-scale`/`--text-scale`.
- [ ] **C6.** Create `DeckGrid.svelte` — responsive CSS grid. 3 columns at 1920w, 2 at 1280w, 1 at 720w.
- [ ] **C7.** Create `DeckDetail.svelte` — slide-in panel with description, sub-decks with progress bars, sub-deck radio selection, "Start Study Run" button
- [ ] **C8.** Create `StudyContentArea.svelte` — DeckGrid + DeckDetail integration
- [ ] **C9.** Create `DungeonSelectionScreen.svelte` — full screen: back button, title, mode toggle, domain sidebar, content area. Handles mode switching and last-selection persistence.
- [ ] **C10.** Wire DungeonSelectionScreen into CardApp.svelte screen router

### Phase D: Hub Integration

- [ ] **D1.** Replace "Deck Builder" button on Hub/Campsite with single "Enter Dungeon" button
- [ ] **D2.** Archive old `DeckBuilder.svelte` to `src/_archived/`
- [ ] **D3.** Update run initialization to read `RunConfig` and configure fact selection, chain slots, and distractor mode
- [ ] **D4.** Wire "Start Run" button on selection screen to begin run with current config

### Phase E: Verification

- [ ] **E1.** `npm run typecheck` passes
- [ ] **E2.** `npm run build` succeeds
- [ ] **E3.** `npx vitest run` — all tests pass
- [ ] **E4.** Visual: DungeonSelectionScreen in Trivia mode at 1920x1080
- [ ] **E5.** Visual: DungeonSelectionScreen in Study mode at 1920x1080
- [ ] **E6.** Visual: DeckDetail panel with sub-deck progress bars
- [ ] **E7.** Functional: Start a trivia run with multi-domain selection
- [ ] **E8.** Functional: Start a study run from a curated deck
- [ ] **E9.** Functional: Start a study run from a specific sub-deck
- [ ] **E10.** Functional: Mode/selection persistence across screen visits
- [ ] **E11.** Update `docs/GAME_DESIGN.md` — dungeon selection, dual-mode, vocabulary migration, sub-decks
- [ ] **E12.** Update `docs/ARCHITECTURE.md` — new components, data layer, services
- [ ] **E13.** Update `data/inspection-registry.json` — add new screens and systems

---

## 10. Acceptance Criteria

1. Single "Enter Dungeon" button on Hub opens unified DungeonSelectionScreen
2. Mode toggle switches between Trivia Dungeon and Study Temple
3. Trivia: left sidebar shows domains as checkboxes (multi-select), content area shows subdomains
4. Trivia: player can select "All", individual domains, or mix of specific subdomains across domains
5. Study: left sidebar shows domains as single-select, content area shows curated deck tiles
6. Study: each deck tile shows name, fact count, FSRS progress bar
7. Study: clicking a deck opens detail panel with sub-decks and per-sub-deck progress bars
8. Study: player can focus on a specific sub-deck (e.g., Japanese N3 Kanji only)
9. Vocabulary decks appear only in Study Temple, NOT in Trivia Dungeon
10. Screen remembers last selected mode and configuration
11. Old DeckBuilder.svelte is archived
12. All dimensions scale properly (no hardcoded px)
13. Typecheck, build, and tests pass
14. GAME_DESIGN.md and ARCHITECTURE.md updated

---

## 11. Design Decisions & Rationale

**Why one "Enter Dungeon" button instead of two separate buttons?**
The user expects a single entry point that remembers their last configuration. Two buttons would force a mode decision before they even see the options. One button -> selection screen with mode toggle is more discoverable and lets them compare modes easily.

**Why left sidebar for domains instead of horizontal tabs?**
Horizontal tabs don't support the multi-select pattern needed for Trivia mode (checking multiple domains). A vertical sidebar with checkboxes handles both: checkboxes for Trivia multi-select, and highlight-on-click for Study single-select.

**Why migrate vocabulary to Study Temple?**
Vocabulary learning is inherently structured — it has levels (N5->N1), sub-skills (vocab, kanji, grammar), and requires spaced repetition to be effective. Random trivia-style vocabulary questions don't produce learning outcomes. Vocabulary belongs in the curated deck system where FSRS tracking, confusion matrices, and sub-deck progress can work properly.

**Why separate fact pools?**
Curated decks are cohesive educational units with structured answer pools and confusion matrices. Trivia facts are standalone entries optimized for variety. Mixing them would compromise both systems' strengths. Future: Trivia mode can optionally use curated facts once enough decks exist.

**Why sub-decks instead of chain theme pinning?**
Chain themes are now generic slots (0-5) without named subcategories. Sub-decks are a cleaner UX for "I want to study just Kanji" — it's a fact pool filter, not a chain mechanic. This keeps the run start simple and avoids explaining chain mechanics to the player before they've even started.

**Why replace DeckBuilder.svelte?**
The current DeckBuilder is a filter-based study preset system. The new system is architecturally different — curated decks with their own fact files, sub-decks, progress tracking. Clean replacement avoids Frankenstein code.
