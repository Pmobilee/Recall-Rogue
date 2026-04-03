# Procedural Math System

> **Purpose:** Documents the runtime math problem generation system used by Study Temple. Covers skill nodes, generators, distractor strategies, FSRS integration, skill selection, and difficulty scaling.
> **Last verified:** 2026-04-03
> **Source files:**
> - `src/data/proceduralDeckTypes.ts` — core types (SkillNode, ProceduralDeck, PlayerSkillState, MathProblem)
> - `src/data/mathDecks/arithmetic.ts` — Arithmetic deck definition (5 skills)
> - `src/data/mathDecks/mentalMath.ts` — Mental Math deck definition (4 skills)
> - `src/services/math/mathProblemGenerator.ts` — 6 generator functions
> - `src/services/math/mathDistractorGenerator.ts` — algorithmic distractor strategies
> - `src/services/math/skillStateManager.ts` — FSRS wrapper for skill states
> - `src/services/math/proceduralSkillSelector.ts` — Anki-model skill selection
> - `src/services/math/proceduralDeckRegistry.ts` — startup registration
> - `src/services/math/proceduralQuizSession.ts` — session bridge to quiz overlay
> - `src/services/math/proceduralStatsService.ts` — stats aggregation
> - `src/ui/components/ProceduralStudyScreen.svelte` — math practice UI

---

## Overview

Procedural math decks generate questions at runtime instead of drawing from a static fact database. Every other domain in the game (history, science, languages, etc.) uses curated `DeckFact` records stored in `facts.db`. Math is different: problems are infinite in variety, and the "correct answer" changes each session.

The system slots into Study Temple's existing infrastructure without modification to the quiz overlay or FSRS scheduler. The quiz engine sees a `ProceduralQuizQuestion` that is structurally identical to a curated-fact question — the generation layer is entirely transparent to the UI.

**Key differences from curated decks:**

| Aspect | Curated Decks | Procedural Math Decks |
|--------|--------------|----------------------|
| Fact source | Static records in `facts.db` | Runtime-generated `MathProblem` objects |
| Tracked unit | `PlayerFactState` (per fact) | `PlayerSkillState` (per skill) |
| Distractor source | Pool-based + confusion matrix | Algorithmic error models |
| Deck content | 30-400+ facts | 4-5 skills (infinite problems per skill) |
| Registry flag | `procedural: false` (default) | `procedural: true` |

---

## Skill Nodes

A `SkillNode` is the atomic unit of a procedural deck — analogous to a fact in a curated deck. Each skill maps to one generator function and defines difficulty parameters per FSRS tier.

```typescript
interface SkillNode {
  id: string;           // unique within deck, e.g. 'arith_add'
  name: string;         // player-facing, e.g. 'Addition'
  description: string;  // tooltip text
  generatorId: string;  // which generator to call, e.g. 'arithmetic'
  tierParams: Record<CardTier, GeneratorParams>;
}
```

### GeneratorParams

Controls the difficulty envelope for a generated problem at a given tier:

| Field | Type | Effect |
|-------|------|--------|
| `rangeA` | `[min, max]` | Operand A range (or quotient range for division) |
| `rangeB` | `[min, max]` | Operand B range (or divisor/base/denominator range) |
| `operations` | `string[]` | Which operators to pick from (`+`, `-`, `*`, `/`) |
| `steps` | `number` | Number of chained operations (mixed arithmetic only) |
| `allowDecimals` | `boolean` | Permit decimal operands/answers |
| `allowNegatives` | `boolean` | Permit negative answers (subtraction defaults false) |
| `tolerance` | `number` | Acceptable error margin (estimation problems) |

---

## Generators

All generators live in `src/services/math/mathProblemGenerator.ts`. The entry point is `generateProblem(skill, tier, seed)`. The `seed` makes generation deterministic — the same `(skill, tier, seed)` triple always produces the same problem.

A mulberry32 seeded PRNG is used throughout; seeds are derived from `Date.now() ^ (questionCount * 7919)` in normal play, or passed explicitly in tests.

| `generatorId` | Skill(s) | Question form | Notes |
|---------------|----------|---------------|-------|
| `arithmetic` | Addition, Subtraction, Multiplication, Division | `a OP b = ?` | Division always exact-integer — `a` is constructed as `b × quotient` to avoid remainders |
| `mixed_arithmetic` | Mixed Operations | `a OP1 b OP2 c = ?` | Evaluated strictly left-to-right (not PEMDAS) |
| `percentage` | Percentages | `What is X% of Y?` | Tries up to 20 candidates to find a clean divisor; falls back to rounding |
| `fraction_decimal` | Fractions & Decimals | Convert fraction↔decimal | Direction alternates by seed; fractions always reduced to simplest form via GCD |
| `estimation` | Estimation | `Estimate √N (to nearest whole number)` | `acceptableAlternatives` includes ±`tolerance` variants |
| `order_of_operations` | Order of Operations | `a + b × c = ?` or `(a + b) × c = ?` | Parenthesised form ~50% of the time; left-to-right "trap" answer always injected as a distractor |

---

## Distractor Generation

`src/services/math/mathDistractorGenerator.ts` — `generateMathDistractors(correctAnswer, operation, operands, count)`

Distractors are computed from the operands and correct answer using operation-specific error models. They are always numerically wrong but plausible given common mistakes:

| Strategy | Applied when | Example |
|----------|-------------|---------|
| Off-by-one / off-by-ten | Always | `answer ± 1`, `answer ± 10` |
| Wrong operation | Always | Apply `+`, `-`, `*`, `/` other than the actual op to same operands |
| Digit swap | Always (integer answers) | Swap adjacent digits of the answer |
| Carry error | Addition only | Sum each column mod 10 with no carry |
| Sign error | Subtraction only | Negate the answer; also try `b - a` (reversed operand order) |
| Near magnitude | Non-zero answers | `answer × 10`; `answer / 10` when that's an integer |
| Random offsets | Fallback when < 4 candidates | Incrementing offsets around the answer |

For fraction answers, a separate `buildFractionDistractors` function varies numerator/denominator by ±1 and includes the unsimplified form when possible.

---

## FSRS Integration

Skill states use the **same FSRS scheduler** as curated fact states. `skillStateManager.ts` wraps `fsrsScheduler.reviewFact` by temporarily casting `PlayerSkillState` → `PlayerFactState` (only `skillId → factId` differs structurally), running the scheduler, then casting back.

Tier derivation reuses `tierDerivation.getCardTier` directly with the same thresholds:

| Tier | Condition |
|------|-----------|
| `3` | `stability >= 10` AND `consecutiveCorrect >= 4` AND `passedMasteryTrial` |
| `2b` | `stability >= 5` AND `consecutiveCorrect >= 3` |
| `2a` | `stability >= 2` AND `consecutiveCorrect >= 2` |
| `1` | Everything else (default for new skills) |

Skill states are stored in `PlayerSave.skillStates: PlayerSkillState[]` (added by `saveService.ts` migration). They persist across runs just like fact states.

See `docs/mechanics/quiz.md` for full FSRS mechanics on the fact side.

---

## Skill Selection

`src/services/math/proceduralSkillSelector.ts` — `selectSkillForPractice(deck, skillStates, subDeckId?, lastSkillId?)`

Adapted from the Anki three-priority model used by `curatedFactSelector.ts`, simplified for the math context (no encounter cooldowns, no confusion matrix, typically 4-5 skills per deck).

Priority order:

1. **Relearning** — always served first (player answered wrong at review tier)
2. **Due review** — sorted by `retrievability` ascending (most-forgotten first)
3. **New** — only introduced when `learningCount < MAX_LEARNING` (8); introduced in deck definition order
4. **Ahead learning** — in learning state but not yet due; served when nothing higher-priority is available
5. **Fallback** — any candidate except `lastSkillId` (prevents immediate repeats)

`subDeckId` optionally restricts the eligible skill pool (e.g., practicing Addition only).

---

## Difficulty Scaling

Difficulty scales by FSRS tier across four levels. The tier is derived from the player's `PlayerSkillState` for that skill, so difficulty adapts to demonstrated mastery — not session number or time.

### Arithmetic — Number Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Addition | 1–20 + 1–20 | 10–99 + 10–99 | 100–999 + 100–999 | 1000–9999 + 1000–9999 |
| Subtraction | Same ranges, non-negative result | | | |
| Multiplication | 2–9 × 2–9 (times tables) | 2–12 × 10–99 | 10–99 × 10–99 | 10–99 × 100–999 |
| Division | quotient 1–10, divisor 2–9 | quotient 2–20, divisor 2–12 | quotient 5–50, divisor 2–25 | quotient 10–100, divisor 2–50 |
| Mixed Ops | 2 ops, +/- only | 2 ops, +/-/× | 3 ops, +/-/× | 3 ops, +/-/×/÷ |

### Mental Math — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Percentages | 10–50% of 20–100 | 5–75% of 20–200 | 1–99% of 50–500 | 1–99% of 100–1000 |
| Fractions & Decimals | numerator 1–4, denom 2–4 | 1–8 / 2–8 | 1–12 / 2–12 | 1–20 / 2–20 |
| Estimation | √4–25 | √25–100 | √100–500 | √500–2000, tolerance 0 |
| Order of Operations | a,b,c from 1–5 | 1–10 | 2–15 | 5–25 |

**Phase 1 is all multiple-choice** (`inputMode: 'choice'`, always 5 options: 1 correct + 4 distractors).

---

## Phase 1 Deck Inventory

| Deck | ID | Skills | Sub-decks |
|------|----|--------|-----------|
| Arithmetic | `arithmetic` | 5 (Addition, Subtraction, Multiplication, Division, Mixed Operations) | 5 (one per skill) |
| Mental Math | `mental_math` | 4 (Percentages, Fractions & Decimals, Estimation, Order of Operations) | 4 (one per skill) |

Registered at startup via `registerProceduralDecks()` called from `CardApp.svelte`. Appears in Study Temple under a Math tab. The `DeckTileV2` component shows skill count (not fact count) and uses a blue gradient placeholder (`#3B82F6` → `#1D4ED8`) until custom art ships.

---

## Session Flow

```
startProceduralSession(deckId, subDeckId?)
  → getNextQuestion(session)          // selects skill, generates problem, shuffles answers
  → [quiz overlay renders question]
  → gradeProceduralAnswer(deckId, skillId, correct, ms, session)
  →   reviewSkill() → saveSkillState()    // FSRS update + persist
  → repeat
```

Stats are aggregated on demand via `getMathStats(deckId?)` in `proceduralStatsService.ts`.

---

## Future Phases

| Phase | Scope |
|-------|-------|
| 1.5 | Typed input (`inputMode: 'typing'`) for free-text numeric answers |
| 2 | Algebra deck (linear equations, inequalities, systems) |
| 3 | CS / Logic (binary, hex, boolean algebra, truth tables) |
| 4 | Geometry (area, perimeter, Pythagorean theorem) |
| 5 | Statistics (mean, median, mode, probability) |
