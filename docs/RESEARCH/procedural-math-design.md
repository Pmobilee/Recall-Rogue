# Procedural Math System — Design Spec

> **Status:** Draft — pending user approval before implementation
> **Scope:** Study Temple only. No combat integration.
> **Phase 1:** Arithmetic + Mental Math

## 1. Concept

A new category of Study Temple content where questions are **generated at runtime** instead of pulled from static fact files. Each "deck" contains **skill nodes** — abstract representations of a math concept (e.g., "two-digit addition") that produce fresh problems every time they're practiced.

Players pick a math deck, hit Start Study, and get an infinite stream of FSRS-weighted problems until they choose to stop. The system tracks mastery per skill node and adapts problem difficulty as the player tiers up.

### Design Principles

- **No gating.** All skills available from the start. No prerequisites.
- **No session limits.** Normal Study Temple session flow — practice until you stop.
- **No special visuals.** Math decks use the same tile, modal, and session UI as knowledge decks.
- **Clean and simple.** No combo counters, streak bonuses, or speed rewards.

## 2. Skill Node Model

### What Replaces Facts

In a static deck, each `DeckFact` is a fixed question with a fixed answer. In a math deck, each **skill node** is a generator that produces questions on demand.

```
Static Deck:    DeckFact[] → fixed questions, FSRS per fact
Math Deck:      SkillNode[] → generated questions, FSRS per skill
```

### SkillNode Definition

```typescript
interface SkillNode {
  id: string;                    // e.g., 'add_2digit'
  name: string;                  // e.g., 'Two-Digit Addition'
  generatorId: string;           // Which generator function to call
  tierParams: {
    [tier: string]: GeneratorParams;  // Difficulty params per FSRS tier
  };
}

interface GeneratorParams {
  rangeA: [number, number];      // Operand A range (min, max)
  rangeB: [number, number];      // Operand B range (min, max)
  operations?: string[];         // For mixed: ['+', '-', '*', '/']
  steps?: number;                // Number of operations (1 = simple, 2+ = compound)
  allowDecimals?: boolean;
  allowNegatives?: boolean;
  tolerance?: number;            // Acceptable error margin (e.g., 0.01 for rounding)
}
```

### Example: Addition Skill Node

```typescript
{
  id: 'addition_basic',
  name: 'Addition',
  generatorId: 'arithmetic',
  tierParams: {
    '1':  { rangeA: [1, 20],     rangeB: [1, 20] },
    '2a': { rangeA: [10, 99],    rangeB: [10, 99] },
    '2b': { rangeA: [100, 999],  rangeB: [100, 999] },
    '3':  { rangeA: [1000, 9999], rangeB: [1000, 9999] }
  }
}
```

## 3. FSRS Tracking for Skills

### PlayerSkillState

Parallel to `PlayerFactState`, but keyed by skill node ID instead of fact ID.

```typescript
interface PlayerSkillState {
  skillId: string;              // e.g., 'addition_basic'
  deckId: string;               // e.g., 'arithmetic'

  // FSRS fields — identical semantics to PlayerFactState
  cardState: 'new' | 'learning' | 'review' | 'relearning';
  stability: number;
  difficulty: number;
  retrievability: number;
  interval: number;
  consecutiveCorrect: number;
  passedMasteryTrial: boolean;
  masteredAt: number | null;
  lastReviewedAt: number | null;
  nextReviewAt: number | null;

  // Stats
  totalCorrect: number;
  totalWrong: number;
  averageResponseTimeMs: number;
}
```

### Tier Derivation

Same thresholds as knowledge facts:

| Tier | Stability | Consecutive Correct | Mastery Trial |
|------|-----------|---------------------|---------------|
| 1    | < 2       | < 2                 | —             |
| 2a   | >= 2      | >= 2                | —             |
| 2b   | >= 5      | >= 3                | —             |
| 3    | >= 10     | >= 4                | Passed        |

### Session Fact Selection

Reuses the existing Anki three-priority model from `curatedFactSelector.ts`, but operating on `PlayerSkillState[]` instead of `PlayerFactState[]`:

1. Due learning skills (time-critical)
2. Intersperser: due reviews + new skills mixed
3. Ahead learning (rare)
4. Fallback: any skill except last-seen

When a skill is selected, the generator produces a fresh problem at the skill's current tier.

## 4. Problem Generators

Each generator is a pure function: `(params: GeneratorParams) => GeneratedProblem`.

```typescript
interface GeneratedProblem {
  question: string;              // e.g., "347 + 589 = ?"
  correctAnswer: string;         // e.g., "936"
  acceptableAlternatives: string[]; // e.g., ["936.0", "936.00"]
  distractors: string[];         // e.g., ["926", "946", "836", "937"]
  explanation: string;           // e.g., "347 + 589 = 936"
  inputMode: 'choice' | 'typing'; // Determined by tier
}
```

### Phase 1 Generators

| Generator ID | Produces | Example |
|---|---|---|
| `arithmetic` | Single-operation: a OP b = ? | 347 + 589 = ? |
| `mixed_arithmetic` | Multi-step: a OP b OP c = ? | 12 + 8 - 3 = ? |
| `percentage` | X% of Y = ? | 15% of 80 = ? |
| `fraction_decimal` | Convert between forms | 3/4 = ? (decimal) |
| `estimation` | Approximate answer (range acceptance) | sqrt(150) ~= ? |
| `order_of_operations` | PEMDAS problems | 3 + 4 * 2 = ? |

### Distractor Generation (Algorithmic)

Math distractors are **not random numbers** — they're plausible wrong answers based on common mistakes:

| Strategy | Example | Mistake Modeled |
|---|---|---|
| Off-by-one | 347+589=936 → **935, 937** | Counting error |
| Wrong operation | 347+589 → **347-589=-242** or **347*589** | Operator confusion |
| Digit swap | 936 → **963, 639** | Place value error |
| Carry error | 347+589 → **826** (no carry) | Forgot to carry |
| Sign error | -5+3 → **-8** instead of **-2** | Sign rule confusion |
| Near magnitude | 936 → **93.6, 9360** | Decimal place error |

Each generator defines which distractor strategies apply. The system picks 3-5 distractors using a mix of strategies.

## 5. Difficulty Scaling Per Tier

### Quiz Presentation (reuses existing TIER_QUESTION_FORMAT)

| Tier | Input Mode | Options | Timer | Problem Complexity |
|------|-----------|---------|-------|-------------------|
| 1    | Multiple choice | 3 | Standard | Small numbers, single operation |
| 2a   | Multiple choice | 4 | Standard | Medium numbers, close distractors |
| 2b   | Typed answer | — | Standard | Large numbers, multi-step |
| 3    | Typed answer | — | Short (mastery trial speed) | Largest range, hardest variant |

### Mastery Trial for Math

Same structure as knowledge facts:
- Tier 2b skill with stability >= 10 and consecutiveCorrect >= 4
- Presented as a hard problem at top of tier range
- 4-second timer, typed answer only
- Must pass to unlock tier 3

## 6. Study Temple Integration

### New "math" Domain

Math decks use `domain: "math"` in the deck registry. Since Study Temple tabs are **dynamically generated from domain metadata**, this auto-creates a "Math" tab with no UI code changes beyond adding domain metadata.

```typescript
// In domain metadata registry (wherever getDomainMetadata lives)
{
  id: 'math',
  label: 'Math',
  icon: '...', // TBD
  colorTint: '...',
}
```

### Math Deck Registry Entry

Math decks appear in the deck registry alongside knowledge decks, but flagged as procedural:

```typescript
interface DeckRegistryEntry {
  // Existing fields...
  id: string;
  name: string;
  domain: string;        // 'math'
  factCount: number;     // For math: number of skill nodes
  // New field:
  procedural?: boolean;  // true for math decks
}
```

### Deck Structure

```
Math tab
├── Arithmetic          (deck: 'arithmetic')
│   ├── Addition        (sub-deck, skills: addition_basic)
│   ├── Subtraction     (sub-deck)
│   ├── Multiplication  (sub-deck)
│   ├── Division        (sub-deck)
│   └── Mixed Operations (sub-deck)
├── Mental Math         (deck: 'mental_math')
│   ├── Percentages     (sub-deck)
│   ├── Fractions & Decimals (sub-deck)
│   ├── Estimation      (sub-deck)
│   └── Order of Operations (sub-deck)
```

Selecting "Arithmetic" and hitting Start Study → FSRS picks across all 5 sub-deck skill nodes.
Drilling into "Addition" sub-deck → only addition skills.

### Progress Display

Instead of "X of Y facts learned," math decks show:
- Per-skill tier indicators (Learning / Proven / Mastered)
- Overall deck mastery % (weighted average of skill tiers)

## 7. Typed Numeric Input Component

New Svelte component: `MathTypingInput.svelte`

### Requirements
- Large, centered equation display above input
- Numeric input field (text input with numeric keyboard on mobile)
- Enter to submit
- Supports integers, decimals, negative numbers
- Tolerance-based comparison (configurable per generator, default exact)
- Green/red border feedback on submit (reuse GrammarTypingInput pattern)
- Shows correct answer + brief explanation on wrong answer

### Validation Logic
```typescript
function validateMathAnswer(
  userInput: string,
  correctAnswer: string,
  tolerance: number = 0
): boolean {
  const parsed = parseFloat(userInput.trim());
  const expected = parseFloat(correctAnswer);
  if (isNaN(parsed)) return false;
  return Math.abs(parsed - expected) <= tolerance;
}
```

### Multiple Choice Mode (Tiers 1-2a)
Uses existing choice UI. Distractors come from the generator's algorithmic distractor system instead of answer type pools.

## 8. Data Storage

### Skill Definitions (Static)

Math deck definitions stored as JSON, same location as curated decks:

```
data/decks/arithmetic.json      — skill nodes + sub-deck structure
data/decks/mental_math.json     — skill nodes + sub-deck structure
```

But instead of `facts[]`, they contain `skills[]`.

### Player Progress (Runtime)

`PlayerSkillState` records stored in the same persistence layer as `PlayerFactState` (IndexedDB via the existing save system). Keyed by `skillId`.

## 9. What Changes vs. What's Reused

### Reused As-Is
- Study Temple tab system (auto-generates "Math" tab from domain)
- Deck tile grid, search, sort, filter UI
- DeckDetailModal (shows sub-decks)
- Session start/end flow
- FSRS scheduling algorithm (ts-fsrs)
- Tier derivation thresholds
- TIER_QUESTION_FORMAT (options count, timer)
- Mastery trial system

### New Code Required
- `SkillNode` type definition
- `PlayerSkillState` type + persistence
- Problem generator functions (arithmetic, percentage, etc.)
- Algorithmic distractor generators
- `MathTypingInput.svelte` component
- Adapter layer: skill node selection → problem generation → quiz presentation
- Math deck JSON files (skill definitions, not facts)
- Domain metadata entry for "math"

### Modified (Minimal)
- `curatedFactSelector.ts` — add branch for procedural decks (select skill → generate problem)
- Study Temple progress display — show tier indicators for math decks
- `StudySession.svelte` — handle procedural problems alongside static facts

## 10. Phase Plan

### Phase 1: Foundation + Arithmetic
- SkillNode type system
- PlayerSkillState + FSRS integration
- Arithmetic generator (4 operations)
- Algorithmic distractor generation
- MathTypingInput component
- Math domain in Study Temple
- Arithmetic deck with 5 sub-decks

### Phase 2: Mental Math
- Percentage generator
- Fraction/decimal converter
- Estimation (range tolerance)
- Order of operations (PEMDAS)
- Mental Math deck with 4 sub-decks

### Phase 3: Algebra (future)
- Solve-for-X (linear equations)
- Quadratic equations
- Expression simplification
- Systems of equations

### Phase 4: CS & Logic (future)
- Big-O notation (multiple choice)
- Boolean logic
- Algorithm identification
- Data structure operations
- **Standard curated decks** with `domain: 'math'` — NOT procedural. Fixed questions, normal DeckFact format.

### Phase 5: Geometry, Statistics (future)
- Area/perimeter/volume calculations
- Angle problems
- Mean/median/mode
- Probability
- Standard deviation

## 11. Design Decisions (Resolved)

1. **Deck format: Separate `ProceduralDeck` type.** Math decks do NOT extend `CuratedDeck`. Clean separation — `ProceduralDeck` has `skills[]`, `CuratedDeck` has `facts[]`. No muddying the existing type.

2. **CS/Logic decks: Standard curated decks under Math tab.** "What's Big-O of binary search?" is trivia with a fixed answer. These use normal `CuratedDeck` format with `domain: 'math'`. The Math tab shows both procedural and curated decks.

3. **Stats: Yes — problems solved + accuracy %.** Simple per-skill and per-deck stats: `totalSolved`, `totalCorrect`, `accuracy%`. Displayed in deck detail modal alongside tier progress. No leaderboards or daily counters in Phase 1.

4. **Mixed deck sessions: Not in Phase 1.** Playlists mixing math + knowledge decks deferred to future work.

## 12. Non-Goals (Phase 1)

- No combat integration (Study Temple only)
- No prerequisite gating between skills
- No session time/count limits
- No special visual treatment for math tiles
- No combo/streak/speed bonuses
- No equation rendering (LaTeX/MathML) — plain text sufficient for arithmetic
- No mixed playlists (math + knowledge)
