# MVP Implementation Plan — Terra Miner (Recall-Rogue)

Complete, step-by-step implementation guide for the MVP. Designed to be executed by a non-creative coding model with zero ambiguity.

## MVP Goal

Test the core hypothesis: **"mining + finding artifacts + learning facts + growing a knowledge list is fun."**

## Existing Codebase

Working scaffold with:
- Vite 7 + Svelte 5 + TypeScript 5.9 + Phaser 3
- `GameManager` singleton (boots Phaser)
- `BootScene` (loading bar → starts MainScene)
- `MainScene` (basic grid mining prototype — will be replaced)
- Basic types in `src/data/types.ts` (will be replaced)
- CSS variables, mobile viewport setup, CSP headers
- No physics needed (gravity: 0,0 already set)

---

## Architecture Overview

```
src/
├── main.ts                    # Entry: mount Svelte, boot Phaser
├── App.svelte                 # Root: game container + UI overlay router
├── app.css                    # Global styles + CSS variables
│
├── game/
│   ├── GameManager.ts         # Phaser singleton (update existing)
│   ├── scenes/
│   │   ├── BootScene.ts       # Asset loading (update existing)
│   │   ├── MineScene.ts       # THE core scene: mining gameplay (NEW)
│   │   └── BaseScene.ts       # The dome/base hub (NEW, placeholder)
│   ├── systems/
│   │   ├── MineGenerator.ts   # Procedural mine grid generation (NEW)
│   │   ├── OxygenSystem.ts    # Per-action oxygen tracking (NEW)
│   │   └── MiningSystem.ts    # Block mining logic, hardness, drops (NEW)
│   ├── entities/
│   │   └── Player.ts          # Player position, state on the grid (NEW)
│   └── config/
│       └── balance.ts         # ALL tunable game numbers (NEW)
│
├── ui/
│   ├── components/
│   │   ├── HUD.svelte         # In-mine HUD (oxygen, depth, backpack) (NEW)
│   │   ├── BackpackOverlay.svelte  # Inventory management (NEW)
│   │   ├── QuizOverlay.svelte      # Quiz modal (NEW)
│   │   ├── FactReveal.svelte       # Artifact ingestion / fact reveal (NEW)
│   │   ├── BaseView.svelte         # Base/dome hub UI (NEW, placeholder)
│   │   └── DivePrepScreen.svelte   # Pre-dive oxygen allocation (NEW)
│   └── stores/
│       ├── gameState.ts       # Central reactive game state (NEW)
│       └── playerData.ts      # Persistent player data + save/load (NEW)
│
├── services/
│   ├── sm2.ts                 # SM-2 spaced repetition algorithm (NEW)
│   ├── quizService.ts         # Quiz question selection & grading (NEW)
│   └── saveService.ts         # LocalStorage save/load (NEW)
│
├── data/
│   ├── types.ts               # All TypeScript interfaces (REWRITE)
│   ├── balance.ts             # Game balance constants (NEW)
│   └── seed/
│       └── vocab-n3.json      # Japanese N3 seed content (NEW)
│
└── assets/                    # Existing sprite assets
```

---

## Phase 0: Data Models & Balance Numbers

**Must be done first. Every other phase depends on these.**

### TypeScript Interfaces (`src/data/types.ts`)

```typescript
// ============================================================
// CONTENT TYPES
// ============================================================

/** Content type - extensible for language learning */
export type ContentType = 'fact' | 'vocabulary' | 'grammar' | 'phrase'

/** Age rating for content filtering */
export type AgeRating = 'kid' | 'teen' | 'adult'

/** Artifact rarity tier */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

/** A single learnable fact/word in the database */
export interface Fact {
  id: string
  type: ContentType

  // Core content
  statement: string           // Clear, concise (Anki-optimized)
  wowFactor?: string          // Mind-blowing framing (shown on reveal)
  explanation: string         // Why it's true / context
  gaiaComment?: string        // GAIA's snarky ingestion comment

  // Quiz
  quizQuestion: string
  correctAnswer: string
  distractors: string[]       // 8-25 plausible wrong answers

  // Classification
  category: string[]          // Hierarchical: ["Language", "Japanese", "N3"]
  rarity: Rarity
  difficulty: number          // 1-5
  funScore: number            // 1-10
  ageRating: AgeRating

  // Sourcing
  sourceName?: string

  // Language-specific (optional)
  language?: string           // e.g., "ja"
  pronunciation?: string      // Reading/IPA
  exampleSentence?: string

  // Media (future)
  imageUrl?: string
  mnemonic?: string
}

// ============================================================
// SM-2 SPACED REPETITION
// ============================================================

/** SM-2 review state for a single fact */
export interface ReviewState {
  factId: string
  easeFactor: number          // Starts 2.5, min 1.3
  interval: number            // Days until next review
  repetitions: number         // Consecutive correct answers
  nextReviewAt: number        // Unix timestamp (ms)
  lastReviewAt: number        // Unix timestamp (ms)
  quality: number             // Last response quality (0-5)
}

// ============================================================
// MINE / RUN TYPES
// ============================================================

/** Block types in the mine grid */
export enum BlockType {
  Empty = 0,
  Dirt = 1,
  SoftRock = 2,
  Stone = 3,
  HardRock = 4,
  MineralNode = 10,
  ArtifactNode = 11,
  OxygenCache = 12,
  UpgradeCrate = 13,
  QuizGate = 14,
  Unbreakable = 99,
}

/** A single cell in the mine grid */
export interface MineCell {
  type: BlockType
  hardness: number            // Taps remaining to break
  maxHardness: number         // Original hardness
  revealed: boolean           // Visible to player?
  content?: MineCellContent   // What's inside (if special block)
}

/** Content inside a special block */
export interface MineCellContent {
  mineralType?: MineralTier
  mineralAmount?: number
  artifactRarity?: Rarity
  factId?: string             // Which fact this artifact contains
  oxygenAmount?: number
}

/** Mineral currency tiers */
export type MineralTier = 'dust' | 'shard' | 'crystal' | 'coreFragment' | 'primordialEssence'

// ============================================================
// INVENTORY
// ============================================================

/** A single inventory slot (MVP: simple slots, not Tetris) */
export interface InventorySlot {
  type: 'mineral' | 'artifact' | 'fossil' | 'empty'
  mineralTier?: MineralTier
  mineralAmount?: number      // Stack count
  artifactRarity?: Rarity
  factId?: string
}

// ============================================================
// PLAYER / SAVE STATE
// ============================================================

/** Full player save data */
export interface PlayerSave {
  version: number             // Save format version (for migrations)
  playerId: string
  ageRating: AgeRating
  createdAt: number
  lastPlayedAt: number

  // Resources
  oxygen: number              // Current stored oxygen tanks
  minerals: Record<MineralTier, number>

  // Knowledge
  learnedFacts: string[]      // Fact IDs the player has ingested
  reviewStates: ReviewState[] // SM-2 state per fact
  soldFacts: string[]         // Fact IDs sold (never show again)

  // Stats
  stats: PlayerStats

  // Progression (future: pets, dome, etc.)
}

/** Player statistics */
export interface PlayerStats {
  totalBlocksMined: number
  totalDivesCompleted: number
  deepestLayerReached: number
  totalFactsLearned: number
  totalFactsSold: number
  totalQuizCorrect: number
  totalQuizWrong: number
  currentStreak: number       // Daily review streak
  bestStreak: number
}

// ============================================================
// RUN STATE (active dive, not persisted)
// ============================================================

/** State of the current active dive */
export interface RunState {
  seed: number                // RNG seed for reproducibility
  oxygen: number              // Current oxygen remaining
  maxOxygen: number           // Starting oxygen for this run
  depth: number               // Current y-position
  layer: number               // Current layer index (0-based)
  inventory: InventorySlot[]  // Current backpack contents
  inventorySlots: number      // Max inventory slots this run
  minerX: number              // Player grid position
  minerY: number
  grid: MineCell[][]          // The mine grid
  gridWidth: number
  gridHeight: number
  blocksMinedThisRun: number
  quizGatesPassed: number
  quizGatesFailed: number
  artifactsFound: string[]    // Fact IDs found this run
  isActive: boolean
}
```

### Balance Constants (`src/data/balance.ts`)

```typescript
/** All tunable game balance numbers. Change here, affects everything. */
export const BALANCE = {
  // === OXYGEN ===
  STARTING_OXYGEN_TANKS: 3,           // Player starts with 3 tanks per day
  OXYGEN_PER_TANK: 100,               // Each tank = 100 oxygen points
  OXYGEN_COST_MINE_DIRT: 1,
  OXYGEN_COST_MINE_SOFT_ROCK: 2,
  OXYGEN_COST_MINE_STONE: 3,
  OXYGEN_COST_MINE_HARD_ROCK: 5,
  OXYGEN_COST_MOVE: 1,                // Moving through empty space
  OXYGEN_COST_QUIZ_ATTEMPT: 5,        // Each quiz gate attempt
  OXYGEN_CACHE_RESTORE: 25,           // Oxygen from mining an oxygen cache
  OXYGEN_LAYER_BONUS: 15,             // Oxygen recovered on layer descent

  // === MINE GRID ===
  MINE_WIDTH: 20,                     // Blocks wide per layer
  MINE_LAYER_HEIGHT: 40,              // Blocks tall per layer
  MINE_TOTAL_LAYERS: 1,              // MVP: single layer
  VIEWPORT_TILES_X: 11,              // Visible tiles horizontally (odd = centered)
  VIEWPORT_TILES_Y: 15,              // Visible tiles vertically
  TILE_SIZE: 32,                      // Pixels per tile

  // === BLOCK HARDNESS ===
  HARDNESS_DIRT: 1,
  HARDNESS_SOFT_ROCK: 2,
  HARDNESS_STONE: 3,
  HARDNESS_HARD_ROCK: 5,
  HARDNESS_MINERAL_NODE: 3,
  HARDNESS_ARTIFACT_NODE: 4,
  HARDNESS_QUIZ_GATE: 1,             // 1 tap to interact, quiz handles the rest

  // === NODE DENSITY (per layer, approximate) ===
  DENSITY_MINERAL_NODES: 18,
  DENSITY_ARTIFACT_NODES: 4,
  DENSITY_OXYGEN_CACHES: 2,
  DENSITY_QUIZ_GATES: 2,
  DENSITY_UPGRADE_CRATES: 1,
  DENSITY_EMPTY_POCKETS: 3,          // Small pre-cleared areas
  DENSITY_UNBREAKABLE_RATIO: 0.05,   // 5% of blocks are unbreakable walls

  // === INVENTORY ===
  STARTING_INVENTORY_SLOTS: 6,
  DUST_STACK_SIZE: 50,
  SHARD_STACK_SIZE: 20,
  CRYSTAL_STACK_SIZE: 5,

  // === ARTIFACT DROP RATES ===
  ARTIFACT_RARITY_WEIGHTS: {
    common: 60,
    uncommon: 25,
    rare: 10,
    epic: 4,
    legendary: 0.9,
    mythic: 0.1,
  },

  // === MINERAL DROP AMOUNTS ===
  MINERAL_DROP_MIN: 5,               // Min dust from a mineral node
  MINERAL_DROP_MAX: 15,              // Max dust from a mineral node

  // === QUIZ ===
  QUIZ_DISTRACTORS_SHOWN: 3,         // 3 wrong + 1 correct = 4 choices
  QUIZ_GATE_MAX_FAILURES: 2,
  QUIZ_GATE_FAILURE_OXYGEN_COST: 10, // Extra oxygen penalty per wrong answer

  // === SM-2 DEFAULTS ===
  SM2_INITIAL_EASE: 2.5,
  SM2_MIN_EASE: 1.3,

  // === VISIBILITY ===
  FOG_REVEAL_RADIUS: 3,              // Blocks visible around player
  SCANNER_BASE_RADIUS: 1,            // Scanner reveals special blocks at this range
} as const
```

---

## Phase 1: Core Data Layer (No UI Yet)

**Goal**: Types, save system, SM-2, quiz service — pure logic, fully testable.

### Step 1.1: Rewrite `src/data/types.ts`
Replace the existing file with the interfaces above.

### Step 1.2: Create `src/data/balance.ts`
The balance constants above.

### Step 1.3: Create `src/services/saveService.ts`
```
- save(data: PlayerSave): void — serialize to LocalStorage
- load(): PlayerSave | null — deserialize from LocalStorage
- createNewPlayer(ageRating: AgeRating): PlayerSave — default save
- SAVE_KEY = 'recall-rogue-save'
- SAVE_VERSION = 1
```

### Step 1.4: Create `src/services/sm2.ts`
```
- reviewFact(state: ReviewState, correct: boolean): ReviewState
  - Implements SM-2 algorithm exactly as described in KNOWLEDGE_SYSTEM.md
  - correct → increase interval by easeFactor, increment repetitions
  - wrong → reset interval to 1, reset repetitions to 0, decrease easeFactor
- createReviewState(factId: string): ReviewState
  - Returns initial state: easeFactor=2.5, interval=0, repetitions=0
- isDue(state: ReviewState): boolean
  - Returns true if nextReviewAt <= Date.now()
- getMasteryLevel(state: ReviewState): 'new' | 'learning' | 'familiar' | 'known' | 'mastered'
  - Based on interval thresholds
```

### Step 1.5: Create `src/services/quizService.ts`
```
- selectQuestion(facts: Fact[], reviewStates: ReviewState[]): Fact
  - Prioritize facts that are due for review
  - If none due, pick a random fact from learned set
- getQuizChoices(fact: Fact): string[]
  - Returns shuffled array of [correctAnswer, ...3 random distractors]
  - Distractors randomly selected from fact.distractors pool
- gradeAnswer(fact: Fact, answer: string): boolean
  - Returns true if answer === fact.correctAnswer
```

### Step 1.6: Create seed content `src/data/seed/vocab-n3.json`
~50 Japanese N3 vocabulary entries. See SEED CONTENT section below.

---

## Phase 2: Mine Generation System

**Goal**: Procedural mine grid that can be generated, queried, and mutated.

### Step 2.1: Create `src/game/systems/MineGenerator.ts`
```
- generateMine(seed: number, width: number, height: number): MineCell[][]
  - Uses seeded RNG (simple LCG or mulberry32)
  - Places blocks by distribution:
    - Top 2 rows: Empty (surface)
    - 55% Dirt, 20% SoftRock, 10% Stone, 5% HardRock, 5% Unbreakable
    - Then places special nodes at random positions (not on edges)
  - Places mineral nodes (DENSITY_MINERAL_NODES)
  - Places artifact nodes (DENSITY_ARTIFACT_NODES)
  - Places oxygen caches (DENSITY_OXYGEN_CACHES)
  - Places quiz gates (DENSITY_QUIZ_GATES)
  - Places small empty pockets (DENSITY_EMPTY_POCKETS) — 3x3 clearings
  - Assigns content to special blocks (mineral amounts, artifact rarities)
  - Runs pathfinding validation: ensure player at (width/2, 0) can reach
    at least 80% of special nodes
  - All cells start with revealed=false except those within FOG_REVEAL_RADIUS of start

- revealAround(grid: MineCell[][], x: number, y: number, radius: number): void
  - Sets revealed=true for all cells within radius

- seededRandom(seed: number): () => number
  - Returns a deterministic PRNG function
```

### Step 2.2: Create `src/game/systems/OxygenSystem.ts`
```
- createOxygenState(tanks: number): { current: number, max: number }
- consumeOxygen(state, amount: number): { state, depleted: boolean }
- addOxygen(state, amount: number): state
- getOxygenCostForBlock(blockType: BlockType): number
  - Returns cost from BALANCE constants
```

### Step 2.3: Create `src/game/systems/MiningSystem.ts`
```
- mineBlock(grid, x, y): { success: boolean, content?: MineCellContent, destroyed: boolean }
  - Decrements hardness by 1
  - If hardness reaches 0: type → Empty, return content
  - If block is Empty or Unbreakable: success = false
- canMine(grid, x, y, playerX, playerY): boolean
  - Returns true if (x,y) is adjacent to player AND not Empty/Unbreakable
- getAdjacentMineable(grid, x, y): {x, y}[]
  - Returns list of adjacent blocks that can be mined
```

---

## Phase 3: Phaser Mine Scene

**Goal**: Playable mining with camera, fog of war, and input handling.

### Step 3.1: Create `src/game/entities/Player.ts`
```
- Simple class holding gridX, gridY position
- moveToEmpty(x, y): void — set position to an empty cell
- getPosition(): { x: number, y: number }
```

### Step 3.2: Create `src/game/scenes/MineScene.ts`
```
Key: 'MineScene'
Data received: { seed: number, oxygenTanks: number, inventory: InventorySlot[], facts: Fact[] }

create():
  - Generate mine grid via MineGenerator
  - Create OxygenSystem with allocated tanks
  - Place player at (width/2, 1) — top center, surface
  - Create tilemap graphics (colored rectangles for MVP, sprites later)
  - Set camera to follow player (centered)
  - Set up fog of war (dark overlay, reveal around player)
  - Reveal initial area around player
  - Emit 'mine-started' event to Svelte

update():
  - Render visible tiles only (viewport culling)
  - Update fog of war
  - Check oxygen → if depleted, emit 'oxygen-depleted' event

Input handling:
  - Tap on adjacent block → attempt mine
    - If block has hardness > 1: show crack animation, decrement
    - If block breaks: show particle effect, handle content
    - If mineral node: auto-add to inventory, emit 'mineral-collected'
    - If artifact node: emit 'artifact-found' → Svelte shows quiz
    - If quiz gate: emit 'quiz-gate' → Svelte shows quiz overlay
    - If oxygen cache: restore oxygen, emit 'oxygen-restored'
  - Tap on empty adjacent block → move player there, cost oxygen
  - Tap on non-adjacent block → ignore
  - Tap on player's block → open backpack

Rendering:
  - Each tile: colored rectangle (MVP) with 1px dark border
  - Block colors:
    Empty: #1a1a2e (background)
    Dirt: #5c4033
    SoftRock: #7a6652
    Stone: #6b6b6b
    HardRock: #4a4a4a
    MineralNode: #4ecca3 (green glow)
    ArtifactNode: #e94560 (red glow)
    OxygenCache: #5dade2 (blue)
    QuizGate: #ffd369 (yellow, with ? symbol)
    Unbreakable: #2c2c2c
  - Fog: black overlay with alpha, cleared around player
  - Player: bright colored square at their position (colored sprite later)
  - Cracked blocks: overlay crack texture/pattern at hardness < max

Events emitted to Svelte (via Phaser's EventEmitter):
  - 'mine-started' → HUD shows
  - 'oxygen-changed' { current, max }
  - 'depth-changed' { depth }
  - 'mineral-collected' { tier, amount }
  - 'artifact-found' { factId, rarity }
  - 'quiz-gate' { factId }
  - 'oxygen-depleted' → trigger sacrifice screen
  - 'inventory-changed' { slots }
  - 'run-complete' { inventory, stats } → player chose to surface
```

### Step 3.3: Update `src/game/GameManager.ts`
- Add MineScene to scene list
- Add method to start a dive: `startDive(config)`
- Add method to end dive: `endDive()`
- Add event bridge between Phaser and Svelte stores

---

## Phase 4: Svelte UI Layer

**Goal**: HUD, quiz overlay, backpack, fact reveal, dive prep.

### Step 4.1: Create `src/ui/stores/gameState.ts`
```
Svelte writable stores:
- currentScreen: 'mainMenu' | 'divePrepScreen' | 'mining' | 'base' | 'quiz' | 'factReveal'
- oxygenCurrent: number
- oxygenMax: number
- currentDepth: number
- inventory: InventorySlot[]
- activeQuiz: { fact: Fact, choices: string[] } | null
- activeFact: Fact | null (for reveal screen)
- playerSave: PlayerSave
```

### Step 4.2: Create `src/ui/stores/playerData.ts`
```
- loadPlayer(): PlayerSave
- savePlayer(data: PlayerSave): void
- addLearnedFact(factId: string): void
- sellFact(factId: string, mineralReward: number): void
- updateReviewState(factId: string, correct: boolean): void
- getDueReviews(): ReviewState[]
```

### Step 4.3: Create `src/ui/components/HUD.svelte`
```
Fixed overlay during mining. Shows:
- Oxygen bar (top, horizontal, color-coded green/yellow/red)
- Depth indicator (top right)
- Backpack button (bottom right, shows slot fill count)
- Surface button (bottom left, "↑ Surface")
Position: pointer-events on buttons only, rest is transparent
```

### Step 4.4: Create `src/ui/components/QuizOverlay.svelte`
```
Modal overlay that appears during quiz gates and artifact quizzes.
- Shows question text
- 4 answer buttons (1 correct + 3 distractors, shuffled)
- Tap answer → correct (green flash, proceed) or wrong (red flash, oxygen cost)
- Shows remaining attempts (max 2 failures)
- No timer — take as long as you want
- On complete: emit result back to MineScene via event bus
```

### Step 4.5: Create `src/ui/components/BackpackOverlay.svelte`
```
Slide-up panel showing inventory grid.
- Grid of slots, each showing item icon + stack count
- Tap slot to select, tap again to drop (confirm dialog)
- Close button to dismiss
- Shows total Dust/Shard/Crystal counts
```

### Step 4.6: Create `src/ui/components/FactReveal.svelte`
```
Full-screen overlay for artifact ingestion (at base).
- Shows artifact cracking open animation (CSS)
- Reveals fact: statement, explanation, category
- Two buttons: "Learn" (add to study rotation) or "Sell" (convert to minerals)
- Shows mineral value if selling
```

### Step 4.7: Create `src/ui/components/DivePrepScreen.svelte`
```
Pre-dive screen:
- Shows available oxygen tanks (e.g., "3 tanks available")
- Slider or buttons to allocate tanks (1, 2, or 3)
- Shows estimated run length ("Short dive / Medium / Long")
- "Enter Mine" button
- Back button to return to base
```

### Step 4.8: Create `src/ui/components/BaseView.svelte`
```
MVP base is minimal:
- "Study" button → shows due reviews, runs QuizOverlay in study mode
- "Artifacts" button → shows unreviewed artifacts, triggers FactReveal
- "Dive" button → goes to DivePrepScreen
- Facts list (simple list of learned facts, grouped by category)
- Stats display (facts learned, streak, etc.)
```

### Step 4.9: Update `src/App.svelte`
```
Router based on currentScreen store:
- 'mainMenu' → simple start screen
- 'base' → BaseView
- 'divePrepScreen' → DivePrepScreen
- 'mining' → HUD (game canvas underneath, managed by Phaser)
- 'quiz' → QuizOverlay on top of mining
- 'factReveal' → FactReveal
```

---

## Phase 5: Integration & Game Loop

**Goal**: Wire everything together into a playable loop.

### Step 5.1: Event Bridge (`src/game/GameManager.ts`)
- Phaser emits events → GameManager catches them → updates Svelte stores
- Svelte button clicks → GameManager → tells Phaser scenes what to do
- Key events: quiz answers, surface button, backpack changes

### Step 5.2: Full Dive Loop
1. Player at base → taps "Dive" → DivePrepScreen
2. Allocates oxygen → taps "Enter Mine"
3. MineScene creates, player starts mining
4. Mining blocks costs oxygen, finds minerals/artifacts
5. Quiz gates: pause mining → QuizOverlay → resume
6. Artifacts: stored in inventory, revealed at base after surfacing
7. Player taps "Surface" → RunComplete → back to base with loot
8. OR oxygen depletes → forced surface (MVP: lose 30% of inventory randomly)
9. At base: ingest artifacts (FactReveal), study due reviews, dive again

### Step 5.3: Study Loop (At Base)
1. Player taps "Study" → get due reviews from SM-2
2. QuizOverlay in "study mode" (no oxygen cost, card-flip style)
3. Each answer updates ReviewState
4. Session ends after 5-10 facts or no more due

---

## Phase 6: Seed Content

### Japanese N3 Vocabulary (~50 entries)

Format matches the Fact interface with `type: 'vocabulary'`:
```json
{
  "id": "ja-n3-001",
  "type": "vocabulary",
  "statement": "急ぐ (いそぐ) means 'to hurry'",
  "explanation": "Used when you need to rush or do something quickly.",
  "quizQuestion": "What does 急ぐ (いそぐ) mean?",
  "correctAnswer": "to hurry",
  "distractors": ["to run", "to walk", "to wait", "to stop", "to rest", "to chase", "to escape", "to arrive"],
  "category": ["Language", "Japanese", "JLPT N3", "Verbs"],
  "rarity": "common",
  "difficulty": 2,
  "funScore": 5,
  "ageRating": "kid",
  "language": "ja",
  "pronunciation": "いそぐ"
}
```

---

## Build Order (For Codex)

Execute in this exact order. Each step should be a single commit.

| Step | Description | Files | Depends On |
|---|---|---|---|
| 1 | Rewrite types.ts with all interfaces | `src/data/types.ts` | — |
| 2 | Create balance constants | `src/data/balance.ts` | Step 1 |
| 3 | Create save service | `src/services/saveService.ts` | Step 1 |
| 4 | Create SM-2 service | `src/services/sm2.ts` | Step 1 |
| 5 | Create quiz service | `src/services/quizService.ts` | Step 1, 4 |
| 6 | Create seed content (N3 vocab JSON) | `src/data/seed/vocab-n3.json` | Step 1 |
| 7 | Create seeded RNG + MineGenerator | `src/game/systems/MineGenerator.ts` | Step 1, 2 |
| 8 | Create OxygenSystem | `src/game/systems/OxygenSystem.ts` | Step 1, 2 |
| 9 | Create MiningSystem | `src/game/systems/MiningSystem.ts` | Step 1, 2 |
| 10 | Create Player entity | `src/game/entities/Player.ts` | Step 1 |
| 11 | Create MineScene | `src/game/scenes/MineScene.ts` | Steps 7-10 |
| 12 | Update GameManager | `src/game/GameManager.ts` | Step 11 |
| 13 | Create Svelte stores | `src/ui/stores/gameState.ts`, `playerData.ts` | Steps 1-5 |
| 14 | Create HUD component | `src/ui/components/HUD.svelte` | Step 13 |
| 15 | Create QuizOverlay | `src/ui/components/QuizOverlay.svelte` | Step 13 |
| 16 | Create BackpackOverlay | `src/ui/components/BackpackOverlay.svelte` | Step 13 |
| 17 | Create FactReveal | `src/ui/components/FactReveal.svelte` | Step 13 |
| 18 | Create DivePrepScreen | `src/ui/components/DivePrepScreen.svelte` | Step 13 |
| 19 | Create BaseView | `src/ui/components/BaseView.svelte` | Steps 13-17 |
| 20 | Update App.svelte (router) | `src/App.svelte` | Steps 14-19 |
| 21 | Wire event bridge | `src/game/GameManager.ts` | Steps 11-20 |
| 22 | Integration: full dive loop | All | Steps 1-21 |
| 23 | Integration: study loop at base | All | Steps 1-21 |
| 24 | Update BootScene to load seed data | `src/game/scenes/BootScene.ts` | Step 6 |
| 25 | Final: typecheck, build, test | — | All |

---

## Screen Flow Diagram

```
[App Launch]
    │
    ▼
[Boot / Loading]
    │
    ▼
[Base View] ◄──────────────────────────────┐
    │                                       │
    ├── [Study] → [Quiz Overlay (study mode)] → back to Base
    │
    ├── [Artifacts] → [Fact Reveal] → back to Base
    │
    └── [Dive] → [Dive Prep Screen]
                      │
                      ▼
                 [Mine Scene + HUD]
                      │
                      ├── Tap block → mine (oxygen cost)
                      │     ├── Mineral → auto-collect
                      │     ├── Artifact → inventory
                      │     ├── Oxygen cache → restore
                      │     └── Quiz gate → [Quiz Overlay] → resume
                      │
                      ├── Tap backpack → [Backpack Overlay]
                      │
                      ├── Tap surface → [Run Complete] → Base ──┘
                      │
                      └── Oxygen depleted → [Sacrifice Screen] → Base ──┘
```

---

## What's NOT in MVP

- Multiple biomes / biome shuffling
- Darkest Dungeon stacking (using simple slots)
- Send-up slots
- Layer transitions / descent shafts
- GAIA personality / comments
- Gacha animations
- Knowledge Tree visualization (list view instead)
- Pets / farm / zoo
- Materializer crafting
- Premium anything
- Social / multiplayer
- Notifications / streaks
- Sound / music
- Pixel art per fact
- Multiple mineral tiers (Dust only)
- Ambient storytelling
- Rescue beacon
- Scanner upgrades
- In-run passive relics / synergies

All of these are v1.1+ features documented in the design docs.
