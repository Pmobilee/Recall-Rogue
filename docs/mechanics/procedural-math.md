# Procedural Math System

> **Purpose:** Documents the runtime math problem generation system used by Study Temple. Covers skill nodes, generators, distractor strategies, FSRS integration, skill selection, and difficulty scaling.
> **Last verified:** 2026-04-05
> **Source files:**
> - `src/data/proceduralDeckTypes.ts` — core types (SkillNode, ProceduralDeck, PlayerSkillState, MathProblem)
> - `src/data/mathDecks/arithmetic.ts` — Arithmetic deck definition (5 skills)
> - `src/data/mathDecks/mentalMath.ts` — Mental Math deck definition (4 skills)
> - `src/data/mathDecks/algebra.ts` — Algebra deck definition (5 skills)
> - `src/data/mathDecks/geometry.ts` — Geometry deck definition (5 skills)
> - `src/data/mathDecks/statistics.ts` — Statistics & Probability deck definition (5 skills)
> - `src/services/math/mathProblemGenerator.ts` — dispatcher (21 generator cases)
> - `src/services/math/algebraGenerators.ts` — 5 algebra generator functions
> - `src/services/math/geometryGenerators.ts` — 5 geometry generator functions
> - `src/services/math/statisticsGenerators.ts` — 5 statistics/probability generator functions
> - `src/data/mathDecks/trigonometry.ts` — Trigonometry deck definition (5 skills)
> - `src/services/math/trigGenerators.ts` — 5 trig generator functions
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
| `maxCoefficient` | `number` | Cap on coefficient magnitude for algebra generators |
| `allowNegativeCoefficients` | `boolean` | Allow negative leading coefficients (algebra) |
| `equationForm` | `string` | Form hint for expression simplify: `'distribute'` enables distribution steps |
| `dataSetSize` | `number` | Number of data points for statistics generators |
| `dataMax` | `number` | Maximum value in a generated data set |
| `probabilityContext` | `string[]` | Probability context pool: `['coin', 'dice', 'cards']` |

---

## Generators

All generators are dispatched through `src/services/math/mathProblemGenerator.ts` via `generateProblem(skill, tier, seed)`. The `seed` makes generation deterministic — the same `(skill, tier, seed)` triple always produces the same problem.

A mulberry32 seeded PRNG is used throughout; seeds are derived from `Date.now() ^ (questionCount * 7919)` in normal play, or passed explicitly in tests.

### Arithmetic & Mental Math generators (in `mathProblemGenerator.ts`)

| `generatorId` | Skill(s) | Question form | Notes |
|---------------|----------|---------------|-------|
| `arithmetic` | Addition, Subtraction, Multiplication, Division | `a OP b = ?` | Division always exact-integer — `a` is constructed as `b × quotient` to avoid remainders |
| `mixed_arithmetic` | Mixed Operations | `a OP1 b OP2 c = ?` | Evaluated strictly left-to-right (not PEMDAS) |
| `percentage` | Percentages | `What is X% of Y?` | Tries up to 20 candidates to find a clean divisor; falls back to rounding |
| `fraction_decimal` | Fractions & Decimals | Convert fraction↔decimal | Direction alternates by seed; fractions always reduced to simplest form via GCD |
| `estimation` | Estimation | `Estimate √N (to nearest whole number)` | `acceptableAlternatives` includes ±`tolerance` variants |
| `order_of_operations` | Order of Operations | `a + b × c = ?` or `(a + b) × c = ?` | Parenthesised form ~50% of the time; left-to-right "trap" answer always injected as a distractor |

### Algebra generators (in `algebraGenerators.ts`)

All five algebra generators use the **construct-backward** strategy: the correct answer is chosen first, then the problem is built around it — guaranteeing clean integer solutions with no remainder or approximation.

| `generatorId` | Skill | Question form | Notes |
|---------------|-------|---------------|-------|
| `linear_equation` | Linear Equations | `Solve: ax + b = c` | Pick x (answer), a, b → compute c. Respects `maxCoefficient` and `allowNegativeCoefficients`. |
| `quadratic_equation` | Quadratic Equations | `Solve: ax² + bx + c = 0` | Pick roots r1, r2, leading coefficient a → expand. Repeated root shown as `x = N`; distinct roots sorted ascending as `x = N, x = M`. |
| `expression_simplify` | Simplify Expressions | `Simplify: {expression}` | `steps=2`: combine x terms. `steps=3`: combine like terms or distribute (controlled by `equationForm: 'distribute'`). `steps=4`: full double-distribution. |
| `inequality` | Inequalities | `Solve: ax + b > c` | Same backward construction as linear equation. Operator flips when dividing by negative `a`. "Forgot to flip" distractor always included. |
| `linear_system` | Systems of Equations | `Solve the system:\n{eq1}\n{eq2}` | Pick solution (x, y), sample coefficients with nonzero determinant (up to 20 retries). Answer: `x = N, y = M`. |

### Geometry generators (in `geometryGenerators.ts`)

| `generatorId` | Skill | Question form | Notes |
|---------------|-------|---------------|-------|
| `area` | Area | `Find the area of a {shape}...` | Shapes unlock by tier: square/rectangle (T1), +triangle (T2a), +circle (T2b), +trapezoid (T3) |
| `perimeter` | Perimeter & Circumference | `Find the perimeter/circumference of a {shape}...` | Circle circumference uses `*pi` format |
| `volume` | Volume | `Find the volume of a {shape}...` | cube/prism (T1), +cylinder (T2a), +sphere (T2b), +cone (T3) |
| `angle_relationship` | Angle Relationships | `Find the missing angle...` | complementary (T1), +supplementary (T2a), +triangle sum (T2b), +vertical angles (T3) |
| `pythagorean` | Pythagorean Theorem | `Find the missing side...` | Always uses scaled Pythagorean triples — exact integer results |

### Statistics generators (in `statisticsGenerators.ts`)

All five statistics generators compute answers forward and use `buildStatisticsDistractors` from `mathDistractorGenerator.ts`. Wrong-measure values (e.g., mean when median is asked) are always included as distractors.

| `generatorId` | Skill | Question form | Notes |
|---------------|-------|---------------|-------|
| `central_tendency` | Mean, Median, Mode | `Find the {measure} of: {values}` | Cycles among mean/median/mode by rng. Mean uses construct-backward (picks target, solves for last value). Median always odd-count for clean integer middle. Mode picks one repeated value. |
| `standard_deviation` | Standard Deviation | `Find the population standard deviation of: {values}` | Forward computation. Answer rounded to 1 decimal place. Variance (forgot sqrt) always a distractor. |
| `basic_probability` | Basic Probability | `{scenario question}` | Contexts: coin, dice, cards. Answer is always a simplified fraction `n/d`. Complement fraction always a distractor. |
| `combinations_permutations` | Combinations & Permutations | `How many ways can you {choose/arrange} {r} items from {n}?` | Randomly selects C(n,r) or P(n,r). The other type is always a distractor. r is clamped to ≤ n. |
| `expected_value` | Expected Value | `A game pays ${v} with probability {p}, ... What is the expected value?` | Uses equal probabilities for simplicity. Simple sum (forgot to weight) is always a distractor. |

---

### Trig generators (in `trigGenerators.ts`)

All five trig generators draw answers from `TRIG_TABLE` (exact symbolic values like `sqrt(3)/2`). The `angles` and `trigFunctions` params control difficulty. `tan` at 90°/270° (undefined) is always skipped — up to 30 retries find a valid (angle, function) pair before falling back to a safe default.

| `generatorId` | Skill | Question form | Answer format | Notes |
|---------------|-------|---------------|---------------|-------|
| `trig_standard_angle` | Standard Angle Values | `What is sin(45°)?` | Exact symbolic string (e.g. `sqrt(2)/2`) | Uses `buildTrigDistractors` (wrong function, wrong sign, complement angle, supplement angle) |
| `trig_inverse` | Inverse Trig | `If sin(θ) = 1/2 and 0° ≤ θ ≤ 90°, what is θ?` | Integer degree string (e.g. `"30"`) | Distractors: other angles that don't share the same value for that function |
| `trig_right_triangle` | Right Triangle Solving | `A right triangle has opposite N and adjacent M. Find θ (°).` | Integer degrees | Built from scaled Pythagorean triples; distractors include complement and ±5/±10/±15 offsets |
| `trig_unit_circle` | Unit Circle | `What is the point on the unit circle at 45°? Give as (cos θ, sin θ).` | Coordinate `(cos, sin)` OR exact trig value | Two modes ~50/50: coordinate pair or single function value |
| `trig_identity` | Trig Identities | `Evaluate: sin²(30°) + cos²(30°)` | Exact value string | Six identity templates; angles making tan undefined auto-skipped |


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

### Algebra-specific distractor builders

`buildAlgebraDistractors(roots, rng)` — for equation solution answers ("x = N" or "x = N, x = M"):
- Sign flip, off-by-one, off-by-two, double the root
- For two roots: sign flip on each individually, swap, both off-by-one

`buildExpressionDistractors(correctExpr, coeffs, rng)` — for simplification answers:
- Vary each coefficient by ±1, ±2
- Flip sign on individual terms (sign error)
- Drop a term entirely (forgot-to-combine error)
- Shuffled by RNG for variety across seeds

For inequality answers, distractors are constructed manually:
- "Forgot to flip" (same boundary, wrong direction when a < 0)
- Boundary ±1, boundary ±2
- Correct direction but wrong operator type

For system answers, distractors cover swapped x/y, negated values, and off-by-one on each variable.

### Statistics-specific distractor builder

`buildStatisticsDistractors(answer, measure, alternates, rng)` — shared by all 5 statistics generators:
- Wrong measure: pulls from `alternates` dict (e.g., mean value when median is asked)
- `stddev`: variance (forgot sqrt), mean and median from alternates
- `probability`: complement (1−p as fraction), percent form confusion
- `combination`: nPr value always included (C vs P confusion)
- `permutation`: nCr value always included (P vs C confusion)
- `expected_value`: sum of outcomes (forgot weighting), simple mean
- Falls back to numeric offsets via `dedupeDistractors` when alternates are exhausted

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

### Algebra — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Linear Equations | coeff 1–5, answer ±10 | coeff 1–10, answer ±20 | coeff 1–15 (neg ok), answer ±30 | coeff 1–25 (neg ok), answer ±50 |
| Quadratic Equations | a=1, roots ±6 | a=1–3, roots ±8 | a=1–5, roots ±10 | a=1–5, roots ±12 |
| Simplify Expressions | steps=2 (combine x terms), coeff 1–5 | steps=3 (combine like terms) | steps=3 (distribute), coeff 1–10 | steps=4 (double distribute), coeff 2–15 |
| Inequalities | coeff 1–5, boundary ±10 | coeff 1–10, boundary ±20 | coeff 1–15 (neg ok), boundary ±30 | coeff 1–25 (neg ok), boundary ±50 |
| Systems of Equations | coeff 1–3, solution ±5 | coeff 1–5, solution ±10 | coeff 1–8, solution ±15 | coeff 1–10 (neg ok), solution ±20 |

### Geometry — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Area | rectangle/square, dims 2–10 | rectangle/triangle, dims 3–15 | + circle, dims 2–12 | + trapezoid, dims 3–20 |
| Perimeter | rectangle/square, dims 2–15 | + triangle (scaled triple), dims 3–20 | + circle, dims 2–15 | dims 5–30 |
| Volume | cube/prism, dims 2–8 | + cylinder, dims 2–10 | + sphere, dims 2–8 | + cone, dims 2–12 |
| Angle Relationships | complementary only, 10°–80° | + supplementary, 10°–170° | + triangle sum, 20°–120° | + vertical angles, 15°–150° |
| Pythagorean Theorem | scale k = 1–2 | k = 1–3 | k = 2–5 | k = 3–8 |

### Statistics & Probability — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Mean, Median, Mode | 5 values from 1–10 | 7 values from 1–20 | 7 values from 1–50 | 9 values from 1–100 |
| Standard Deviation | 4 values from 1–10 | 5 values from 1–20 | 6 values from 1–30 | 8 values from 1–50 |
| Basic Probability | coin + dice | coin + dice | coin + dice + cards | dice + cards |
| Combinations & Permutations | n=3–6, r=1–3 | n=5–8, r=2–4 | n=6–10, r=2–5 | n=8–12, r=3–6 |
| Expected Value | 3 outcomes, values 1–10 | 4 outcomes, values 1–20 | 5 outcomes, values 1–50 | 6 outcomes, values 1–100 |

### Trigonometry — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Standard Angle Values | sin/cos only, Q1 (0°–90°) | + tan, Q1 | Q1+Q2 (0°–180°), all functions | Full circle (0°–360°), all functions |
| Inverse Trig | sin/cos, Q1 (0°–90°) | + tan, Q1 | Q1+Q2 (0°–180°) | Full circle (0°–330°) |
| Right Triangle Solving | Pythagorean triples, scale 1–2 | scale 1–3 | scale 2–5 | scale 3–8 |
| Unit Circle | Quadrantal angles only (0°,90°,180°,270°,360°) | + 30°/45°/60° multiples, Q1+Q2 | Full circle, sin/cos | Full circle, all functions |
| Trig Identities | sin²+cos²; sin/cos quotient at 30°/45°/60° | + Q2 angles | + double-angle, Q3/Q4 | Full circle, all 6 templates |

**All multiple-choice** (`inputMode: 'choice'`, always 5 options: 1 correct + 4 distractors).

---

## Deck Inventory

| Deck | ID | Skills | Sub-decks |
|------|----|--------|-----------|
| Arithmetic | `arithmetic` | 5 (Addition, Subtraction, Multiplication, Division, Mixed Operations) | 5 (one per skill) |
| Mental Math | `mental_math` | 4 (Percentages, Fractions & Decimals, Estimation, Order of Operations) | 4 (one per skill) |
| Algebra | `algebra` | 5 (Linear Equations, Quadratic Equations, Simplify Expressions, Inequalities, Systems of Equations) | 5 (one per skill) |
| Geometry | `geometry` | 5 (Area, Perimeter & Circumference, Volume, Angle Relationships, Pythagorean Theorem) | 5 (one per skill) |
| Statistics & Probability | `statistics` | 5 (Mean/Median/Mode, Standard Deviation, Basic Probability, Combinations & Permutations, Expected Value) | 5 (one per skill) |
| Trigonometry | `trigonometry` | 5 (Standard Angle Values, Inverse Trig, Right Triangle Solving, Unit Circle, Trig Identities) | 5 (one per skill) |

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
| 2 | CS / Logic (binary, hex, boolean algebra, truth tables) |
| 3 | CS / Logic (binary, hex, boolean algebra, truth tables) |
