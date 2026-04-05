# Procedural Math System

> **Purpose:** Documents the runtime math problem generation system used by Study Temple. Covers skill nodes, generators, distractor strategies, FSRS integration, skill selection, and difficulty scaling.
> **Last verified:** 2026-04-05 (Pre-Calculus deck added)
> **Source files:**
> - `src/data/proceduralDeckTypes.ts` — core types (SkillNode, ProceduralDeck, PlayerSkillState, MathProblem)
> - `src/data/mathDecks/arithmetic.ts` — Arithmetic deck definition (5 skills)
> - `src/data/mathDecks/mentalMath.ts` — Mental Math deck definition (4 skills)
> - `src/data/mathDecks/algebra.ts` — Algebra deck definition (5 skills)
> - `src/data/mathDecks/geometry.ts` — Geometry deck definition (5 skills)
> - `src/data/mathDecks/statistics.ts` — Statistics & Probability deck definition (5 skills)
> - `src/services/math/mathProblemGenerator.ts` — dispatcher (41 generator cases)
> - `src/services/math/algebraGenerators.ts` — 5 algebra generator functions
> - `src/services/math/geometryGenerators.ts` — 5 geometry generator functions
> - `src/services/math/statisticsGenerators.ts` — 5 statistics/probability generator functions
> - `src/data/mathDecks/trigonometry.ts` — Trigonometry deck definition (5 skills)
> - `src/services/math/trigGenerators.ts` — 5 trig generator functions
> - `src/data/mathDecks/numberTheory.ts` — Number Theory deck definition (5 skills)
> - `src/services/math/numberTheoryGenerators.ts` — 5 number theory generator functions + helpers
> - `src/data/mathDecks/linearAlgebra.ts` — Linear Algebra deck definition (5 skills)
> - `src/services/math/linearAlgebraGenerators.ts` — 5 linear algebra generator functions + 2 format helpers (formatMatrix, formatVector)
> - `src/data/mathDecks/calculus.ts` — Calculus deck definition (5 skills)
> - `src/services/math/calculusGenerators.ts` — 5 calculus generator functions
> - `src/data/mathDecks/logicSets.ts` — Logic & Sets deck definition (5 skills)
> - `src/services/math/logicSetsGenerators.ts` — 5 logic/sets generator functions
> - `src/data/mathDecks/precalculus.ts` — Pre-Calculus deck definition (5 skills)
> - `src/services/math/preCalculusGenerators.ts` — 5 pre-calculus generator functions
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


### Number Theory generators (in `numberTheoryGenerators.ts`)

All five number theory generators use a "construct forward" strategy where applicable — prime factors are chosen first, then the composite number is built — guaranteeing non-trivial, non-prime targets. Modular arithmetic computes forward. Distractors use `dedupeDistractors` with rich domain-specific candidates (6+ per generator).

**Helpers exported from `numberTheoryGenerators.ts`:**
- `isPrime(n)` — trial division primality test, safe for n < 10,000
- `nextPrime(n)` — smallest prime strictly greater than n
- `nthPrime(n)` — the Nth prime, 1-indexed (nthPrime(1) = 2)
- `countPrimesInRange(lo, hi)` — count of primes in [lo, hi] inclusive
- `primeFactorize(n)` — returns Map<prime, exponent>
- `formatFactorization(map)` — canonical string, e.g. "2^3 x 3 x 5^2"
- `countDivisors(n)` — total divisor count via the formula d(n) = product(ei + 1)

| `generatorId` | Skill | Question form | Notes |
|---------------|-------|---------------|-------|
| `prime_factorization` | Prime Factorization | `Write the prime factorization of N` | Construct forward: pick primes from pool, multiply to build N. Answer: canonical factorization string. Distractors: exponent mutations, prime swaps, dropped/added factors. |
| `lcm_gcd` | LCM & GCD | `Find GCD(a, b)` or `Find LCM(a, b)` | `steps=1` -> GCD only. `steps=2` -> random GCD or LCM. Constructed so GCD(a,b) = g exactly. Wrong-operation answer always a distractor. |
| `modular_arithmetic` | Modular Arithmetic | `N mod M = ?`, `(A + B) mod M = ?`, etc. | `steps=1` basic mod; `steps=2` mod addition; `steps=3` mod multiplication; `steps=4` mod exponentiation (small bases). Answer always in [0, m-1]. |
| `divisibility` | Divisibility & Factors | `How many positive divisors does N have?` | Construct forward like factorization. Answer = product(ei+1). Distractors: nearby counts, count of distinct primes (common mistake). |
| `prime_identification` | Prime Identification | varies by sub-type | `steps=1` which is prime MC; `steps=2` next prime after N; `steps=3` count primes in range; `steps=4` Nth prime. |

---

### Calculus generators (in `calculusGenerators.ts`)

All five calculus generators use the **construct-backward** strategy to guarantee clean integer answers. Derivatives and integrals of polynomials pick antiderivative coefficients or exponents first. Limits use direct substitution or factored cancellation (construct-backward: pick the root, build the expression). Definite integrals pick integrand coefficients that are multiples of their powers so antiderivative coefficients are clean integers, then pick bounds accordingly.

| `generatorId` | Skill | Question form | Answer format | Notes |
|---------------|-------|---------------|---------------|-------|
| `derivative_power_rule` | Power Rule Derivatives | `Find d/dx[f(x)] where f(x) = {poly}` | Simplified polynomial string | 1–3 terms controlled by `steps`. Differentiates via d/dx(ax^n)=n·a·x^(n-1). Uses `buildExpressionDistractors`. |
| `derivative_chain_rule` | Chain Rule | `Find d/dx[(ax+b)^n]` | Symbolic string, e.g. `6(2x+3)^2` | Standard form at steps=1; includes sqrt variant at steps=2 (T3). sqrt answer format: `a/(2*sqrt(ax+b))`. Distractors model forgot-inner-derivative and wrong-power errors. |
| `basic_integral` | Basic Integrals | `∫ {integrand} dx = ?` | Antiderivative polynomial `+ C` | Construct-backward: choose antiderivative first, differentiate to get integrand. Guarantees integer antiderivative coefficients. "Forgot +C" and "used integrand as answer" always distractors. |
| `limit_evaluation` | Limit Evaluation | `lim_{x→c} f(x)` | Numeric string or special value | steps=1: direct substitution (linear or quadratic). steps=2: factored-cancel 50% / direct 50%. steps=3: special limits pool (sin(x)/x, 1/x at ∞, (1+1/x)^x, etc.). |
| `definite_integral` | Definite Integrals | `∫_{a}^{b} (f(x)) dx` | Integer string | Construct-backward using divisibility constraints. F(b)−F(a) always an integer. Bounds picked from [0, min(rangeB[1], 5)]. Explanation shows F(hi) - F(lo). |

---

### Logic & Sets generators (in `logicSetsGenerators.ts`)

Generators use seeded RNG throughout. Set results use `formatSet(arr)` which sorts numerically and wraps in braces (empty array -> "empty set"). `dedupeDistractors` ensures no distractor equals the correct answer and fills to exactly 4. Modes for multi-tier generators are signalled via `params.steps`.

| `generatorId` | Skill | Question form | Answer format | Notes |
|---------------|-------|---------------|---------------|-------|
| `truth_table` | Truth Tables | "In the truth table for p AND q, what is the result when p = True and q = False?" | "True" or "False" | Distractors always include "Cannot be determined" and "Both True and False". Tier controls expression complexity via rangeA[0]: 1 = simple 4 templates, 2 = all 9 templates (+ negated compounds). |
| `set_operations` | Set Operations | "Let A = {1, 2, 3} and B = {2, 3, 4}. What is A UNION B?" | formatSet string e.g. "{1, 2, 3, 4}" or empty-set | Forces >=1 shared element between A and B. Distractors: results of wrong operations, A alone, B alone. Operations pool controlled by `params.operations`. |
| `venn_diagram` | Venn Diagrams | "If |A| = 10, |B| = 8, |A intersect B| = 3, find |A union B|." | Integer string | steps=1: 2-set union formula. steps=2: reverse-solve for |B|. steps=3: 3-set inclusion-exclusion formula. steps=4: find specific region (A only). |
| `logical_equivalence` | Logical Equivalence | "Which expression is logically equivalent to p IMPLIES q?" | Equivalent expression string | Uses curated EQUIVALENCE_POOL by tier (rangeA[0]=1->tier1, 2->tier2, 3->tier3). NonEquivalents are distractors; padded from other tiers if needed. |
| `set_cardinality` | Set Cardinality | "How many multiples of 3 are in {1, 2, ..., 30}?" | Integer string | steps=1: floor(n/k). steps=2: 2-set inclusion-exclusion (divisible by a or b). steps=3: power set 2^n. steps=4: 3-set inclusion-exclusion. LCM computed locally via gcd import. |


---

### Pre-Calculus generators (in `preCalculusGenerators.ts`)

All five pre-calculus generators use the **construct-backward** strategy to guarantee clean integer answers. Logarithm and exponent generators pick the answer first, then build the expression. Sequence generators construct the first term, common difference/ratio, and n to produce an integer term or sum. Limit generators are constructed to ensure the substituted or cancelled result is an integer. Polynomial division constructs the quotient and root first, then multiplies back.

| `generatorId` | Skill | Question form | Answer format | Notes |
|---------------|-------|---------------|---------------|-------|
| `logarithm` | Logarithms | `Evaluate: log_{b}(x)` | Integer exponent n | Construct-backward: pick base b from {2,3,5,10}, pick n from rangeB, compute x=b^n. Distractors: n±1, n±2, base b, argument x. |
| `exponent_rules` | Exponent Rules | `Simplify: b^m x b^n = b^?` | Integer exponent string | steps=1: multiply rule (m+n). steps=2: +divide (m-n). steps=3: +power ((b^m)^n = b^(m×n)). steps=4: +mixed (b^m × b^n / b^p = b^(m+n-p)). |
| `sequence` | Sequences & Series | Varies by sub-type | Integer string | steps=1: arithmetic nth term a₁+(n-1)d. steps=2: geometric nth term a₁×r^(n-1). steps=3: arithmetic sum (n/2)(2a₁+(n-1)d), n always even. steps=4: geometric sum a₁(r^n-1)/(r-1) with a₁=1, r=2. |
| `limit_intro` | Introductory Limits | `lim_{x->a} ...` | Integer string | steps=1: linear direct substitution. steps=2: quadratic direct substitution. steps=3: difference-of-squares cancel, answer = 2a. steps=4: cubic factoring cancel, answer = 3a². |
| `polynomial_division` | Polynomial Division | `Divide: (P(x)) / (x-r)` | Polynomial quotient string | Construct-backward: pick Q(x) and root r, compute P = Q*(x-r)+R. steps=1: linear quotient no remainder. steps=2: +remainder. steps=3: quadratic quotient no remainder. steps=4: quadratic +remainder. Uses `formatPolynomial`. |

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

### Calculus — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Power Rule Derivatives | 1 term, coeff 1–4, exponent 1–3 | 2 terms, coeff 1–6, exponent 1–4 | 2 terms, coeff 1–8, exponent 1–5 | 3 terms, coeff 1–10, exponent 1–6 |
| Chain Rule | (ax+b)^n, a∈1–4, n∈2–3 (no sqrt) | a∈1–5, n∈2–4 | a∈1–6, n∈2–5 | a∈1–8, n∈2–6, sqrt variant 40% |
| Basic Integrals | 1 term, antiCoeff 1–3, antiPower 2–3 | 2 terms, antiCoeff 1–4, antiPower 2–4 | 2 terms, antiCoeff 1–5, antiPower 2–5 | 3 terms, antiCoeff 1–6, antiPower 2–6 |
| Limit Evaluation | Direct substitution only (linear/quadratic) | Direct or factored-cancel (50/50) | Direct or factored-cancel | Special limits pool (8 named limits) |
| Definite Integrals | Linear integrand, bounds [0,3] | Quadratic integrand, bounds [0,4] | Quadratic, bounds [0,4] | Cubic integrand, bounds [0,5] |

---

### Number Theory -- Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Prime Factorization | Primes 2-7, 2 factors | Primes 2-11, 3 factors | Primes 2-13, 4 factors | Primes 2-17, 4 factors |
| LCM & GCD | GCD only, shared factor 1-5, mult 2-6 | GCD or LCM, factor 2-10, mult 2-8 | factor 2-15, mult 3-12 | factor 3-20, mult 3-20 |
| Modular Arithmetic | basic mod, dividend 5-30, mod 2-9 | mod addition, 5-50, mod 2-12 | mod multiplication, 5-50, mod 2-15 | mod exponentiation, base 2-10, mod 5-20 |
| Divisibility & Factors | Primes 2-7, 2 factors | Primes 2-11, 3 factors | Primes 2-13, 4 factors | Primes 2-17, 4 factors |
| Prime Identification | which is prime (2-30) | next prime after N (N in 2-50) | count primes in range (up to 50) | Nth prime (N up to 20) |

### Linear Algebra generators (in `linearAlgebraGenerators.ts`)

Answers for matrix operations use the compact string format `[[row1], [row2]]`. Vector answers use `[a, b, c]`.
The `steps` field in `GeneratorParams` controls dimension: 2 = 2D/2×2, 3 = 3D/3×3, 4 = 4D vectors.

Two formatting helpers exported for reuse: `formatMatrix(rows: number[][])` → string, `formatVector(v: number[])` → string.

| `generatorId` | Skill | Question form | Answer format | Notes |
|----------------|-------|---------------|---------------|-------|
| `matrix_addition` | Matrix Addition | `Add the matrices: A = ... B = ... Find A + B.` | Matrix string e.g. `[[3, 5], [7, 9]]` | Element-wise A+B. Distractors: A−B, Hadamard product, off-by-1 on all elements. |
| `scalar_multiplication` | Scalar Multiplication | `Multiply matrix A by scalar k: A = ... Find kA.` | Matrix string | Every element × k. Distractors: add instead of multiply, wrong scalar k±1, diagonal-only, element squared. |
| `determinant` | Determinant | `Find the determinant of: [[a, b], [c, d]]` | Signed integer | 2×2: construct-backward (pick det, a, b, c → d=(det+bc)/a). 3×3: Sarrus rule with small elements −3..3. |
| `dot_product` | Dot Product | `Compute u · v` | Signed integer | 2D/3D/4D vectors. Distractors: 2D cross product, sum-of-components confusion, off-by-1, sign flip on first term. |
| `matrix_vector_multiply` | Matrix-Vector Multiply | `Find Ax` given A matrix and x vector | Vector string e.g. `[5, 7]` | result[i] = row_i · x. Distractors: transpose confusion (A^T x), add instead of dot product, swap rows 0 and 1, Hadamard diagonal. |

---

### Linear Algebra — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Matrix Addition | 2×2, elements 1–5 | 2×2, elements 1–9 | 2×2, elements −5..5 | 3×3, elements −9..9 |
| Scalar Multiplication | 2×2, elements 1–5, scalar 2–4 | 2×2, elements 1–9, scalar 2–6 | 2×2, elements −5..5, scalar 2–8 | 3×3, elements −9..9, scalar 2–10 |
| Determinant | 2×2, elements 1–5 | 2×2, elements 1–9 | 2×2, elements −5..5 | 3×3, elements −3..3 (Sarrus rule) |
| Dot Product | 2D, elements 1–5 | 3D, elements 1–9 | 3D, elements −5..5 | 4D, elements −9..9 |
| Matrix-Vector Multiply | 2×2, elements 1–4 | 2×2, elements 1–6 | 2×2, elements −4..4 | 3×3, elements −5..5 |

---

### Logic & Sets — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Truth Tables | Simple 2-var connectives (AND, OR, IMPLIES, IFF); rangeA[0]=1 | + negated compounds; rangeA[0]=2 | Same pool, wider shuffle | Same pool as T2 |
| Set Operations | Union, intersection; elements 1-8 | + difference; 1-10 | + symmetric difference; 1-12 | All ops; 1-15 |
| Venn Diagrams | 2-set union formula, set sizes 5-15, inter 1-5 | Reverse-solve for |B|, sizes 8-20, inter 2-7 | 3-set inclusion-exclusion, sizes 5-12, inter 1-4 | Specific region (A only), sizes 5-12 |
| Logical Equivalence | Commutativity, De Morgan's (tier1 pool) | Contrapositive, biconditional (tier2 pool) | Distributive laws (tier2 pool) | Absorption, XOR (tier3 pool) |
| Set Cardinality | floor(n/k); n: 10-50, k: 2-7 | 2-set inclusion-exclusion; n: 20-100, k: 2-9 | Power set 2^n; n: 2-5 | 3-set inclusion-exclusion; n: 30-150, k: 2-7 |


### Pre-Calculus — Ranges by Tier

| Skill | Tier 1 | Tier 2a | Tier 2b | Tier 3 |
|-------|--------|---------|---------|--------|
| Logarithms | bases {2,3,5,10}, exponent n∈[1,3] | n∈[1,4] | n∈[1,5] | n∈[1,6] |
| Exponent Rules | multiply only, exp 1–4 | multiply/divide, exp 1–5 | +power rule, exp 1–6 | +mixed rule, exp 1–8 |
| Sequences & Series | Arithmetic nth term, a₁∈[1,5], n∈[2,8] | Geometric nth term, a₁∈[1,4], r∈{2,3}, n∈[2,6] | Arithmetic sum, a₁∈[1,6], n even in [4,10] | Geometric sum a₁=1 r=2, n∈[3,6] |
| Introductory Limits | Linear substitution, coeff 1–5, point [−3,4] | Quadratic substitution, coeff 1–4, point [−3,3] | Difference-of-squares cancel | Cubic factoring cancel |
| Polynomial Division | Linear quotient no remainder, root [−3,3] | Linear quotient with remainder | Quadratic quotient no remainder | Quadratic quotient with remainder |

---

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
| Number Theory | `number_theory` | 5 (Prime Factorization, LCM & GCD, Modular Arithmetic, Divisibility & Factors, Prime Identification) | 5 (one per skill) |
| Linear Algebra | `linear_algebra` | 5 (Matrix Addition, Scalar Multiplication, Determinant, Dot Product, Matrix-Vector Multiply) | 5 (one per skill) |
| Calculus | `calculus` | 5 (Power Rule Derivatives, Chain Rule, Basic Integrals, Limit Evaluation, Definite Integrals) | 5 (one per skill) |
| Logic & Sets | `logic_sets` | 5 (Truth Tables, Set Operations, Venn Diagrams, Logical Equivalence, Set Cardinality) | 5 (one per skill) |

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
| 2 | DELIVERED — Logic & Sets (truth tables, set operations, Venn diagrams, logical equivalence, set cardinality) |
| 2.5 | DELIVERED — Pre-Calculus (logarithms, exponent rules, sequences, introductory limits, polynomial division) |
| 3 | CS / Discrete Math (binary, hex, combinatorics extensions, graph theory basics) |
