# AR-245: Curated Deck Data Loading & Registry

**Status:** Implemented
**Complexity:** Medium (new data layer, types, loader — no UI)
**Dependencies:** None (foundational — AR-246 through AR-251 all depend on this)
**Spec Reference:** `docs/RESEARCH/DECKBUILDER.md` sections 3.1-3.4, AR-244 section 7

---

## 1. Overview

Create the data infrastructure that makes curated decks available at runtime. This includes:
- A `RunConfig` type distinguishing trivia vs study mode
- A deck registry for metadata (what decks exist, their structure)
- A deck fact index mapping deck/sub-deck IDs to fact IDs
- A JSON loader that reads `data/decks/*.json` files at startup
- A curated fact store completely separate from the trivia `facts.db`

This AR creates NO gameplay changes — it's pure data layer. The existing trivia path continues working unchanged.

---

## 2. Sub-Steps

### 2.1 Create `RunConfig` type

**File:** `src/data/runConfig.ts` (NEW)

```typescript
import type { CanonicalFactDomain } from './card-types';

/** Run mode: trivia uses general fact pool, study uses curated deck pool */
export type RunMode = 'trivia' | 'study';

/** Configuration for a dungeon run, selected on the Dungeon Selection Screen */
export interface RunConfig {
  mode: RunMode;

  /** Trivia Dungeon — multi-select domains and subdomains from general trivia pool */
  triviaSelection?: {
    domains: CanonicalFactDomain[];          // selected domains (empty = all)
    subdomains?: Record<string, string[]>;   // domain -> selected subcategories
  };

  /** Study Temple — single curated deck with optional sub-deck focus */
  studySelection?: {
    deckId: string;
    subDeckId?: string;                      // optional sub-deck focus
  };
}

/** Persisted in playerSave — remembers last dungeon selection screen config */
export interface LastDungeonSelection {
  mode: RunMode;
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

**Acceptance:** Type exports compile. No runtime behavior yet.

### 2.2 Create Curated Deck Types

**File:** `src/data/curatedDeckTypes.ts` (NEW)

Define all curated deck interfaces per DECKBUILDER.md §3.1:

```typescript
export interface CuratedDeck {
  id: string;                          // e.g., "us_presidents", "japanese_n5_vocab"
  name: string;
  domain: string;
  subDomain?: string;
  description: string;
  minimumFacts: number;
  targetFacts: number;
  facts: DeckFact[];
  answerTypePools: AnswerTypePool[];
  synonymGroups: SynonymGroup[];
  questionTemplates: QuestionTemplate[];
  difficultyTiers: DifficultyTier[];
}

export interface DeckFact {
  id: string;
  correctAnswer: string;
  acceptableAlternatives: string[];
  synonymGroupId?: string;
  chainThemeId: number;                // Generic slot 0-5
  answerTypePoolId: string;
  difficulty: number;                  // 1-5
  funScore: number;                    // 1-10
  quizQuestion: string;
  explanation: string;
  visualDescription: string;
  sourceName: string;
  sourceUrl?: string;
  volatile?: boolean;
  distractors: string[];               // Pre-generated fallback (8-12)
  // Vocabulary-specific optional fields
  targetLanguageWord?: string;         // e.g., "食べる"
  reading?: string;                    // e.g., "たべる"
  language?: string;                   // e.g., "ja"
}

export interface AnswerTypePool {
  id: string;
  label: string;
  answerFormat: string;                // "name" | "year" | "number" | "term" | "place" | "word"
  factIds: string[];
  minimumSize: number;                 // Default 5
}

export interface SynonymGroup {
  id: string;
  factIds: string[];
  reason: string;
}

export interface QuestionTemplate {
  id: string;
  answerPoolId: string;
  questionFormat: string;              // Template with {placeholders}
  availableFromMastery: number;
  difficulty: number;
  reverseCapable: boolean;
}

export interface DifficultyTier {
  tier: 'easy' | 'medium' | 'hard';
  factIds: string[];
}
```

**Acceptance:** Type exports compile. Used by registry and loader.

### 2.3 Create Deck Registry

**File:** `src/data/deckRegistry.ts` (NEW)

Central registry of all available curated decks — metadata only, no facts loaded.

```typescript
import type { CanonicalFactDomain } from './card-types';

export interface DeckRegistryEntry {
  id: string;
  name: string;
  description: string;
  domain: CanonicalFactDomain | 'vocabulary';
  subDomain?: string;
  factCount: number;
  subDecks?: {
    id: string;
    name: string;
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

Functions to implement:
- `getDeckRegistry(): DeckRegistryEntry[]` — all registered decks
- `getDeck(deckId: string): DeckRegistryEntry | undefined` — single deck lookup
- `getDecksForDomain(domain: string): DeckRegistryEntry[]` — filter by domain
- `registerDeck(entry: DeckRegistryEntry): void` — add a deck (called by loader)

Initial registry is empty — populated by the loader in 2.5.

**Acceptance:** Functions exported and callable. Empty registry returns empty arrays.

### 2.4 Create Deck Fact Index

**File:** `src/data/deckFactIndex.ts` (NEW)

Maps deck IDs and sub-deck IDs to fact IDs for quick lookups and progress calculation.

```typescript
interface DeckFactEntry {
  allFacts: string[];
  subDecks?: Record<string, string[]>;  // subDeckId -> factIds
}

const DECK_FACT_INDEX: Map<string, DeckFactEntry> = new Map();
```

Functions:
- `getFactIdsForDeck(deckId: string): string[]` — all fact IDs in a deck
- `getFactIdsForSubDeck(deckId: string, subDeckId: string): string[]` — sub-deck fact IDs
- `setDeckFactIndex(deckId: string, entry: DeckFactEntry): void` — set by loader
- `isDeckFactIndexReady(): boolean` — check if any decks loaded

**Acceptance:** Functions exported and callable.

### 2.5 Create Curated Deck Store & Loader

**File:** `src/data/curatedDeckStore.ts` (NEW)

A runtime store holding loaded curated deck facts, completely separate from the trivia `facts.db`.

```typescript
import type { CuratedDeck, DeckFact } from './curatedDeckTypes';

/** In-memory store of loaded curated decks — separate from trivia DB */
const loadedDecks: Map<string, CuratedDeck> = new Map();

/** Load a single deck from its JSON data */
function loadDeck(deckJson: CuratedDeck): void;

/** Get a loaded deck by ID */
function getDeck(deckId: string): CuratedDeck | undefined;

/** Get a specific fact from a loaded deck */
function getDeckFact(deckId: string, factId: string): DeckFact | undefined;

/** Get all facts for a deck (or sub-deck) */
function getDeckFacts(deckId: string, subDeckId?: string): DeckFact[];

/** Get the answer type pool for a fact within its deck */
function getAnswerTypePool(deckId: string, poolId: string): AnswerTypePool | undefined;

/** Get synonym groups for a deck */
function getSynonymGroups(deckId: string): SynonymGroup[];

/** Check if a deck is loaded */
function isDeckLoaded(deckId: string): boolean;

/** Initialize: load all deck JSON files from data/decks/ */
async function initializeCuratedDecks(): Promise<void>;
```

The `initializeCuratedDecks()` function:
1. Fetches the deck manifest (list of available deck JSON files)
2. For each deck JSON: parses, validates required fields, stores in `loadedDecks`
3. Populates the deck registry (2.3) with metadata entries
4. Populates the deck fact index (2.4) with fact ID mappings
5. Logs summary: "Loaded N curated decks with M total facts"

For the initial implementation (no decks exist yet), the loader should gracefully handle an empty `data/decks/` directory.

**Loading strategy:** Decks are loaded via `fetch()` from a manifest file `data/decks/manifest.json` that lists available deck files. This keeps the loader simple and avoids directory listing in the browser.

**File:** `data/decks/manifest.json` (NEW)
```json
{
  "decks": []
}
```

**Acceptance:**
- `initializeCuratedDecks()` runs without error on empty manifest
- When a deck JSON exists, it loads correctly into the store, registry, and index
- Trivia DB is completely untouched

### 2.6 Wire into Game Initialization

**File:** `src/CardApp.svelte` (MODIFY — minimal change)

Add `initializeCuratedDecks()` call during app startup, alongside the existing trivia DB initialization. This should be non-blocking (decks load in parallel with other init).

**File:** `src/services/runManager.ts` (MODIFY — add RunConfig support)

- Add `runConfig?: RunConfig` field to `RunState`
- When a run starts, store the RunConfig for reference by charge/quiz systems
- Existing run start path (no RunConfig or `mode === 'trivia'`) continues working exactly as before
- `mode === 'study'` path stores the `deckId` and `subDeckId` for the charge system (AR-246) to use

**Acceptance:**
- App starts normally with zero curated decks
- Existing trivia runs are completely unaffected
- `RunState.runConfig` is accessible during a run
- `npm run typecheck` passes
- `npm run build` succeeds

---

## 3. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/data/runConfig.ts` | CREATE | RunConfig, RunMode, LastDungeonSelection types |
| `src/data/curatedDeckTypes.ts` | CREATE | CuratedDeck, DeckFact, AnswerTypePool, SynonymGroup, QuestionTemplate types |
| `src/data/deckRegistry.ts` | CREATE | Deck metadata registry with lookup functions |
| `src/data/deckFactIndex.ts` | CREATE | Deck/sub-deck to fact ID mappings |
| `src/data/curatedDeckStore.ts` | CREATE | Runtime curated deck store + JSON loader |
| `data/decks/manifest.json` | CREATE | Manifest listing available deck JSON files |
| `src/CardApp.svelte` | MODIFY | Call initializeCuratedDecks() at startup |
| `src/services/runManager.ts` | MODIFY | Add runConfig to RunState |

---

## 4. Acceptance Criteria

1. All new types compile (`npm run typecheck`)
2. `npm run build` succeeds
3. App starts normally with empty deck manifest — no errors
4. `getDeckRegistry()` returns empty array initially
5. `isDeckLoaded('nonexistent')` returns false
6. `RunState.runConfig` is typed and accessible
7. Existing trivia run path is completely unchanged — no behavioral differences
8. If a test deck JSON is placed in `data/decks/` and added to manifest, it loads correctly
9. Curated deck facts are stored in a completely separate Map from trivia facts

---

## 5. Verification Gate

- [ ] `npm run typecheck` — passes
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all existing tests pass (no regressions)
- [ ] Manual: App loads without errors in console
- [ ] Manual: Start a trivia run — works exactly as before
- [ ] Update `docs/GAME_DESIGN.md` with RunConfig type and curated deck data layer
- [ ] Update `docs/ARCHITECTURE.md` with new files and data flow
- [ ] Update `data/inspection-registry.json` — add deckRegistry, curatedDeckStore systems

---

## 6. Notes

- This AR creates the skeleton only. No facts, no gameplay changes.
- The store is intentionally simple (Map-based). If performance becomes a concern with very large decks, it can be optimized later.
- The manifest approach (`data/decks/manifest.json`) is chosen over dynamic import or directory listing because it works in both dev and production builds without Vite config changes.
- The `DeckFact` interface includes `distractors[]` as a pre-generated fallback. AR-247 (pool-based adaptive distractors) will add runtime distractor selection that supersedes these when confusion data exists.
