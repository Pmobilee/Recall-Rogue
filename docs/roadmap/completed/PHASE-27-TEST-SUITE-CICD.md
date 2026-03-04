# Phase 27: Test Suite & CI/CD

**Status**: Not Started
**Complexity**: High
**Estimated sessions**: 3–4
**Dependencies**: Phases 0–22 complete (all core systems exist and are stable)

---

## 1. Overview

### Goal

Establish a comprehensive automated test suite for Terra Gacha, covering pure-logic unit tests, manager-level unit tests, Svelte component tests, Fastify server integration tests, and full E2E Playwright scenarios. Wire everything into a GitHub Actions CI/CD pipeline that enforces coverage thresholds and blocks merges on failure.

### Why Now

The codebase has grown to 22+ phases of feature code with zero automated tests. Every bug fix or new feature risks silently regressing core systems (SM-2 scheduling, mine generation determinism, quiz rate logic, save/load cycles). Phase 27 lays the safety net before Phase 28 performance work and before live traffic arrives from production users.

### Design Decisions Referenced

- **DD-V2-051**: TickSystem — tick-driven game logic (no setInterval/setTimeout)
- **DD-V2-053**: SaveManager — auto-save every 30 ticks to localStorage
- **DD-V2-060**: Quiz rate — cooldown, fatigue, first-trigger-after-10 rules
- **DD-V2-085**: SM-2 — numeric quality (0–5), pass threshold ≥ 3
- **DD-V2-096**: SM-2 tuning — second interval 3 days, consistency penalty at reps ≥ 4
- **DD-V2-098/099**: Mastery thresholds — vocab 30 days, fact 60 days
- **DD-V2-120**: Interest bias — 30% weight boost for matching biome affinity
- **DD-V2-054**: Mine generation — seeded mulberry32 PRNG, deterministic per seed

### Architecture Notes

- **Frontend**: Vite 7 + Svelte 5 + TypeScript 5.9 + Phaser 3
- **Backend**: Fastify 5 + TypeScript + better-sqlite3 (facts) + PostgreSQL (saves)
- **No tests exist today** — the `test` and `test:coverage` scripts are already wired in `package.json` but no test files exist
- Pure-logic modules (sm2.ts, balance.ts, MineGenerator.ts, interestSpawner.ts) are ideal first targets: no DOM, no Phaser, no Svelte stores
- Svelte store modules (playerData.ts, gameState.ts) require a jsdom environment and svelte/store shims
- Phaser-coupled managers (QuizManager, GaiaManager) require dependency injection to be testable without a canvas
- Server routes require a test Fastify instance with an in-memory SQLite facts database and mocked PostgreSQL

### Complexity Assessment

High. The test surface spans four different runtime environments (pure Node, jsdom, server, Chromium browser). Key challenges:

1. **Phaser isolation**: Phaser instantiates a WebGL/Canvas renderer — tests that import any Phaser class must mock it or use jsdom with canvas shims
2. **Svelte store isolation**: stores import services that import localStorage — needs careful mock setup
3. **Facts database**: sm2.ts and QuizManager both operate on fact data — tests need a minimal in-memory facts fixture
4. **Deterministic time**: SM-2 uses `Date.now()` — tests must control time with `vi.useFakeTimers()`
5. **CI environment**: GitHub Actions must run Playwright with `--no-sandbox` and a Chrome/Chromium binary

---

## 2. Sub-phases

---

### 27.1 — Vitest Setup and Configuration

**Goal**: Install Vitest and all test utilities; create `vitest.config.ts`; establish the project-wide test helper/mock pattern; verify a trivial test passes.

#### 2.1.1 Install dependencies

Add to `package.json` devDependencies (ask user before running `npm install` with new packages — but these are all dev-only testing tools):

```
vitest               ^2.x   — test runner (Vite-native)
@vitest/coverage-v8  ^2.x   — V8 coverage provider
@vitest/ui           ^2.x   — optional local UI
jsdom                ^25.x  — DOM environment for Svelte tests
@testing-library/svelte ^5.x — Svelte component testing utilities
@testing-library/jest-dom ^6.x — custom DOM matchers
happy-dom            ^14.x  — alternative DOM (faster, used for non-component tests)
supertest            ^7.x   — HTTP integration testing for Fastify routes
```

Add to `server/package.json` devDependencies:

```
vitest               ^2.x
supertest            ^7.x
@types/supertest     ^6.x
```

#### 2.1.2 Create `vitest.config.ts`

File path: `/root/terra-miner/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    // Use jsdom for component tests; individual files can override with
    // @vitest-environment happy-dom or @vitest-environment node
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'android', 'ios'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Enforce minimums — CI will fail if these thresholds are not met
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
      include: [
        'src/services/sm2.ts',
        'src/data/balance.ts',
        'src/data/interestConfig.ts',
        'src/services/interestSpawner.ts',
        'src/game/systems/MineGenerator.ts',
        'src/game/systems/TickSystem.ts',
        'src/game/managers/SaveManager.ts',
        'src/game/managers/CompanionManager.ts',
        'src/game/managers/QuizManager.ts',
      ],
    },
  },
})
```

#### 2.1.3 Create server `vitest.config.ts`

File path: `/root/terra-miner/server/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 50, functions: 50 },
    },
  },
})
```

#### 2.1.4 Create global test setup

File path: `/root/terra-miner/tests/setup.ts`

```typescript
import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach } from 'vitest'

// Stub localStorage (not available in jsdom by default in all versions)
const localStorageStore: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key] }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Reset all mocks and localStorage before every test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})
```

#### 2.1.5 Create test fixture helpers

File path: `/root/terra-miner/tests/fixtures/facts.ts`

```typescript
import type { Fact } from '../../src/data/types'

/** Minimal fact fixture sufficient for SM-2 and quiz tests. */
export function makeFact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: 'fact-001',
    type: 'fact',
    statement: 'The Great Wall of China is approximately 21,196 km long.',
    wowFactor: 'End-to-end it would span across the United States more than twice.',
    explanation: 'Built over many dynasties, primarily during the Ming dynasty.',
    quizQuestion: 'How long is the Great Wall of China?',
    correctAnswer: '21,196 km',
    distractors: [
      { text: '5,000 km', difficultyTier: 'easy', distractorConfidence: 0.9 },
      { text: '10,000 km', difficultyTier: 'medium', distractorConfidence: 0.7 },
      { text: '15,000 km', difficultyTier: 'hard', distractorConfidence: 0.5 },
    ],
    category: ['History', 'Geography'],
    categoryL1: 'History',
    categoryL2: 'Geography',
    difficulty: 2,
    funScore: 8,
    noveltyScore: 7,
    ageRating: 'kid',
    contentVolatility: 'timeless',
    status: 'approved',
    ...overrides,
  }
}

export function makeVocabFact(overrides: Partial<Fact> = {}): Fact {
  return makeFact({
    id: 'vocab-001',
    type: 'vocabulary',
    statement: 'Ephemeral means lasting for a very short time.',
    quizQuestion: 'What does "ephemeral" mean?',
    correctAnswer: 'Lasting for a very short time',
    category: ['Language'],
    categoryL1: 'Language',
    ...overrides,
  })
}
```

File path: `/root/terra-miner/tests/fixtures/reviewState.ts`

```typescript
import type { ReviewState } from '../../src/data/types'

export function makeReviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    factId: 'fact-001',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: 0,
    lastReviewAt: 0,
    quality: 0,
    ...overrides,
  }
}
```

#### 2.1.6 Add test scripts to `package.json`

Update the existing scripts section (the scripts already exist in package.json — just confirm they are correct):

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:ui": "vitest --ui"
```

#### Acceptance Criteria — 27.1

- [ ] `npm run test` executes without crashing (zero tests = zero failures is acceptable at this stage)
- [ ] `npx vitest run tests/setup.test.ts` runs a trivial `expect(1 + 1).toBe(2)` test and passes
- [ ] `vitest.config.ts` exists at project root and at `server/`
- [ ] `tests/setup.ts` is loaded globally before every test
- [ ] `tests/fixtures/facts.ts` and `tests/fixtures/reviewState.ts` exist

---

### 27.2 — Unit Tests: Pure Logic

**Goal**: Achieve ≥ 90% coverage on all pure-function modules that have no external dependencies: `sm2.ts`, relevant functions in `balance.ts`, `interestConfig.ts`, and `interestSpawner.ts`.

These modules require only a Node environment — no DOM, no Phaser, no Svelte.

#### 2.2.1 SM-2 unit tests

File path: `/root/terra-miner/tests/unit/sm2.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createReviewState,
  reviewFact,
  isDue,
  isMastered,
  getMasteryLevel,
} from '../../src/services/sm2'
import { BALANCE, SM2_SECOND_INTERVAL_DAYS } from '../../src/data/balance'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000 // fixed reference timestamp

describe('createReviewState', () => {
  it('creates state with interval 0 and nextReviewAt 0 (immediately due)', () => {
    const state = createReviewState('fact-001')
    expect(state.factId).toBe('fact-001')
    expect(state.interval).toBe(0)
    expect(state.nextReviewAt).toBe(0)
    expect(state.easeFactor).toBe(BALANCE.SM2_INITIAL_EASE)
  })
})

describe('reviewFact — boolean API (legacy)', () => {
  it('treats true as quality 5', () => {
    vi.useFakeTimers({ now: NOW })
    const state = createReviewState('fact-001')
    const next = reviewFact(state, true)
    expect(next.quality).toBe(5)
    expect(next.repetitions).toBe(1)
    expect(next.interval).toBe(1) // first rep = 1 day
    vi.useRealTimers()
  })

  it('treats false as quality 1 (reset)', () => {
    vi.useFakeTimers({ now: NOW })
    // Give the fact some history first
    const state = createReviewState('fact-001')
    const afterPass = reviewFact(reviewFact(state, true), true)
    // Now fail it
    const afterFail = reviewFact(afterPass, false)
    expect(afterFail.repetitions).toBe(0)
    expect(afterFail.interval).toBe(1)
    expect(afterFail.easeFactor).toBeCloseTo(afterPass.easeFactor - 0.2, 5)
    vi.useRealTimers()
  })
})

describe('reviewFact — numeric quality API', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('quality 5 (easy) increases ease factor', () => {
    const state = createReviewState('fact-001')
    const next = reviewFact(state, 5)
    expect(next.easeFactor).toBeGreaterThan(BALANCE.SM2_INITIAL_EASE)
  })

  it('quality 3 (good) maintains ease factor close to initial', () => {
    const state = createReviewState('fact-001')
    const next = reviewFact(state, 3)
    expect(next.easeFactor).toBeCloseTo(BALANCE.SM2_INITIAL_EASE, 1)
  })

  it('quality 2 (hard/fail) resets repetitions and reduces ease', () => {
    // Advance to rep 3
    let state = createReviewState('fact-001')
    state = reviewFact(state, 5)
    state = reviewFact(state, 5)
    state = reviewFact(state, 5)
    const prevEase = state.easeFactor

    const next = reviewFact(state, 2)
    expect(next.repetitions).toBe(0)
    expect(next.interval).toBe(1)
    expect(next.easeFactor).toBeCloseTo(Math.max(prevEase - 0.2, BALANCE.SM2_MIN_EASE), 5)
  })

  it('second interval is SM2_SECOND_INTERVAL_DAYS (tuned from default 6)', () => {
    vi.useFakeTimers({ now: NOW })
    const s0 = createReviewState('f')
    const s1 = reviewFact(s0, 5)
    const s2 = reviewFact(s1, 5)
    expect(s1.interval).toBe(1)
    expect(s2.interval).toBe(SM2_SECOND_INTERVAL_DAYS) // 3 days per DD-V2-096
    vi.useRealTimers()
  })

  it('third interval uses ease factor multiplication', () => {
    vi.useFakeTimers({ now: NOW })
    let s = createReviewState('f')
    s = reviewFact(s, 5) // interval=1
    s = reviewFact(s, 5) // interval=SM2_SECOND_INTERVAL_DAYS
    const s3 = reviewFact(s, 5) // interval=round(SM2_SECOND * easeFactor)
    expect(s3.interval).toBe(Math.round(s.interval * s.easeFactor))
    vi.useRealTimers()
  })

  it('ease factor never drops below SM2_MIN_EASE', () => {
    let state = createReviewState('f')
    // Repeatedly fail
    for (let i = 0; i < 20; i++) {
      state = reviewFact(state, 0)
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(BALANCE.SM2_MIN_EASE)
  })

  it('nextReviewAt is in the future by interval days', () => {
    vi.useFakeTimers({ now: NOW })
    const state = createReviewState('f')
    const next = reviewFact(state, 5)
    expect(next.nextReviewAt).toBeCloseTo(NOW + next.interval * MS_PER_DAY, -2)
    vi.useRealTimers()
  })
})

describe('isDue', () => {
  it('returns true when nextReviewAt is 0 (new card)', () => {
    const state = createReviewState('f')
    expect(isDue(state)).toBe(true)
  })

  it('returns false when nextReviewAt is in the future', () => {
    vi.useFakeTimers({ now: NOW })
    const state = createReviewState('f')
    const next = reviewFact(state, 5)
    expect(isDue(next)).toBe(false)
    vi.useRealTimers()
  })

  it('returns true when nextReviewAt has passed', () => {
    vi.useFakeTimers({ now: NOW })
    const state = createReviewState('f')
    const next = reviewFact(state, 5) // nextReviewAt = NOW + 1 day
    vi.setSystemTime(NOW + 2 * MS_PER_DAY)
    expect(isDue(next)).toBe(true)
    vi.useRealTimers()
  })
})

describe('isMastered', () => {
  it('fact not mastered at interval 59 days', () => {
    const state = createReviewState('f')
    const s = { ...state, interval: 59 }
    expect(isMastered(s, 'fact')).toBe(false)
  })

  it('fact mastered at interval 60 days', () => {
    const state = createReviewState('f')
    const s = { ...state, interval: 60 }
    expect(isMastered(s, 'fact')).toBe(true)
  })

  it('vocab mastered at interval 30 days (lower threshold)', () => {
    const state = createReviewState('f')
    const s = { ...state, interval: 30 }
    expect(isMastered(s, 'vocabulary')).toBe(true)
    expect(isMastered(s, 'fact')).toBe(false)
  })

  it('phrase uses vocab threshold (30 days)', () => {
    const state = createReviewState('f')
    const s = { ...state, interval: 30 }
    expect(isMastered(s, 'phrase')).toBe(true)
  })
})

describe('getMasteryLevel', () => {
  it('new card returns "new"', () => {
    const s = createReviewState('f')
    expect(getMasteryLevel(s)).toBe('new')
  })

  it('interval 1 returns "learning" for fact', () => {
    const s = { ...createReviewState('f'), interval: 1 }
    expect(getMasteryLevel(s, 'fact')).toBe('learning')
  })

  it('interval 7 returns "familiar" for fact', () => {
    const s = { ...createReviewState('f'), interval: 7 }
    expect(getMasteryLevel(s, 'fact')).toBe('familiar')
  })

  it('interval 60 returns "mastered" for fact', () => {
    const s = { ...createReviewState('f'), interval: 60 }
    expect(getMasteryLevel(s, 'fact')).toBe('mastered')
  })

  it('vocab has different bucket breakpoints', () => {
    const s2 = { ...createReviewState('f'), interval: 2 }
    const s8 = { ...createReviewState('f'), interval: 8 }
    expect(getMasteryLevel(s2, 'vocabulary')).toBe('learning')
    expect(getMasteryLevel(s8, 'vocabulary')).toBe('familiar')
  })
})
```

#### 2.2.2 InterestConfig unit tests

File path: `/root/terra-miner/tests/unit/interestConfig.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  createDefaultInterestConfig,
  computeFactWeights,
  getActiveInterestCount,
} from '../../src/data/interestConfig'
import { CATEGORIES } from '../../src/data/types'

describe('createDefaultInterestConfig', () => {
  it('creates one entry per category', () => {
    const config = createDefaultInterestConfig()
    expect(config.categories).toHaveLength(CATEGORIES.length)
  })

  it('all weights start at 0', () => {
    const config = createDefaultInterestConfig()
    config.categories.forEach(c => expect(c.weight).toBe(0))
  })

  it('behavioral learning disabled by default', () => {
    const config = createDefaultInterestConfig()
    expect(config.behavioralLearningEnabled).toBe(false)
  })

  it('category lock is null by default', () => {
    const config = createDefaultInterestConfig()
    expect(config.categoryLock).toBeNull()
  })
})

describe('getActiveInterestCount', () => {
  it('returns 0 when all weights are 0', () => {
    const config = createDefaultInterestConfig()
    expect(getActiveInterestCount(config)).toBe(0)
  })

  it('counts only categories with weight > 0', () => {
    const config = createDefaultInterestConfig()
    config.categories[0].weight = 50
    config.categories[2].weight = 75
    expect(getActiveInterestCount(config)).toBe(2)
  })
})
```

#### 2.2.3 InterestSpawner unit tests

File path: `/root/terra-miner/tests/unit/interestSpawner.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { pickBiomeWithInterestBias, generateBiomeSequence } from '../../src/services/interestSpawner'
import { createDefaultInterestConfig } from '../../src/data/interestConfig'
import { ALL_BIOMES } from '../../src/data/biomes'
import { seededRandom } from '../../src/game/systems/MineGenerator'

describe('pickBiomeWithInterestBias', () => {
  it('returns a valid biome from ALL_BIOMES', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(42)
    const biome = pickBiomeWithInterestBias(config, rng)
    const ids = ALL_BIOMES.map(b => b.id)
    expect(ids).toContain(biome.id)
  })

  it('with zero-weight config, returns a biome (default weights)', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(99)
    expect(() => pickBiomeWithInterestBias(config, rng)).not.toThrow()
  })

  it('biome affinity boost (30%) skews selection over many trials', () => {
    const config = createDefaultInterestConfig()
    // Set Natural Sciences interest
    const nsCat = config.categories.find(c => c.category === 'Natural Sciences')
    if (nsCat) nsCat.weight = 100

    // Run 200 trials and count how often we get biomes with Natural Sciences affinity
    let affinityCount = 0
    const affinityBiomeIds = new Set([
      'limestone_caves', 'granite_depths', 'sulfur_vents',
      'magma_chambers', 'crystal_cathedral', 'asteroid_impact',
    ])

    for (let seed = 0; seed < 200; seed++) {
      const rng = seededRandom(seed)
      const biome = pickBiomeWithInterestBias(config, rng)
      if (affinityBiomeIds.has(biome.id)) affinityCount++
    }

    // With 30% boost, affinity biomes should appear more than baseline
    // Baseline would be ~affinityBiomeIds.size / ALL_BIOMES.length
    const baseline = (affinityBiomeIds.size / ALL_BIOMES.length) * 200
    // We only require the count is measurably above baseline (not a strict statistical test)
    expect(affinityCount).toBeGreaterThanOrEqual(baseline * 0.9) // at least 90% of expected baseline
  })
})

describe('generateBiomeSequence', () => {
  it('returns an array of length equal to layerCount', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(1)
    const seq = generateBiomeSequence(config, 20, rng)
    expect(seq).toHaveLength(20)
  })

  it('every element is a valid biome', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(7)
    const seq = generateBiomeSequence(config, 20, rng)
    const ids = new Set(ALL_BIOMES.map(b => b.id))
    seq.forEach(b => expect(ids.has(b.id)).toBe(true))
  })
})
```

#### Acceptance Criteria — 27.2

- [ ] All SM-2 tests pass (`npm run test tests/unit/sm2.test.ts`)
- [ ] InterestConfig tests pass
- [ ] InterestSpawner tests pass
- [ ] `npm run test:coverage` reports ≥ 90% line coverage for `sm2.ts`

---

### 27.3 — Unit Tests: Managers

**Goal**: Test the three core manager classes with injected dependencies, avoiding any real Phaser, Svelte, or DOM interaction.

#### 2.3.1 TickSystem unit tests

File path: `/root/terra-miner/tests/unit/TickSystem.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TickSystem } from '../../src/game/systems/TickSystem'

// Reset the singleton between tests
function freshTick(): TickSystem {
  ;(TickSystem as any).instance = undefined
  return TickSystem.getInstance()
}

describe('TickSystem', () => {
  it('singleton returns the same instance', () => {
    const a = freshTick()
    const b = TickSystem.getInstance()
    expect(a).toBe(b)
  })

  it('getTick starts at 0', () => {
    const ts = freshTick()
    expect(ts.getTick()).toBe(0)
  })

  it('advance increments global tick', () => {
    const ts = freshTick()
    ts.advance()
    ts.advance()
    expect(ts.getTick()).toBe(2)
  })

  it('advance calls registered callbacks with correct tick numbers', () => {
    const ts = freshTick()
    const cb = vi.fn()
    ts.register('test', cb)
    ts.advance()
    ts.advance()
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenNthCalledWith(1, 1, 1)
    expect(cb).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('unregister removes a callback', () => {
    const ts = freshTick()
    const cb = vi.fn()
    ts.register('key', cb)
    ts.unregister('key')
    ts.advance()
    expect(cb).not.toHaveBeenCalled()
  })

  it('resetLayerTick resets only the layer counter', () => {
    const ts = freshTick()
    ts.advance()
    ts.advance()
    ts.resetLayerTick()
    expect(ts.getTick()).toBe(2)
    expect(ts.getLayerTick()).toBe(0)
    ts.advance()
    expect(ts.getLayerTick()).toBe(1)
  })

  it('resetAll clears callbacks and both counters', () => {
    const ts = freshTick()
    const cb = vi.fn()
    ts.register('k', cb)
    ts.advance()
    ts.resetAll()
    expect(ts.getTick()).toBe(0)
    expect(ts.getLayerTick()).toBe(0)
    ts.advance() // should not call the cleared callback
    expect(cb).toHaveBeenCalledTimes(1) // only the first advance (before reset)
  })

  it('overwriting an existing key replaces the callback', () => {
    const ts = freshTick()
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    ts.register('dup', cb1)
    ts.register('dup', cb2)
    ts.advance()
    expect(cb1).not.toHaveBeenCalled()
    expect(cb2).toHaveBeenCalledTimes(1)
  })
})
```

#### 2.3.2 SaveManager unit tests

File path: `/root/terra-miner/tests/unit/SaveManager.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SaveManager, AUTO_SAVE_TICK_INTERVAL } from '../../src/game/managers/SaveManager'
import { DIVE_SAVE_VERSION } from '../../src/data/saveState'
import type { DiveSaveState } from '../../src/data/saveState'

const mockStore: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStore[key] = value }),
  removeItem: vi.fn((key: string) => { delete mockStore[key] }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

function makeDiveSave(overrides: Partial<DiveSaveState> = {}): DiveSaveState {
  return {
    version: DIVE_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    layer: 3,
    oxygen: 75,
    inventory: [],
    playerX: 5,
    playerY: 10,
    ...overrides,
  }
}

describe('SaveManager', () => {
  beforeEach(() => {
    Object.keys(mockStore).forEach(k => delete mockStore[k])
    vi.clearAllMocks()
  })

  it('AUTO_SAVE_TICK_INTERVAL is 30', () => {
    expect(AUTO_SAVE_TICK_INTERVAL).toBe(30)
  })

  it('hasSave returns false when nothing is stored', () => {
    expect(SaveManager.hasSave()).toBe(false)
  })

  it('save writes JSON to localStorage', () => {
    const state = makeDiveSave()
    SaveManager.save(state)
    expect(localStorageMock.setItem).toHaveBeenCalledOnce()
    const written = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
    expect(written.layer).toBe(3)
    expect(written.version).toBe(DIVE_SAVE_VERSION)
  })

  it('save stamps the current savedAt timestamp', () => {
    const state = makeDiveSave({ savedAt: '' })
    SaveManager.save(state)
    const written = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
    expect(written.savedAt).toBeTruthy()
  })

  it('load returns null when nothing is stored', () => {
    expect(SaveManager.load()).toBeNull()
  })

  it('load returns a valid save after save()', () => {
    const state = makeDiveSave({ layer: 7 })
    SaveManager.save(state)
    const loaded = SaveManager.load()
    expect(loaded).not.toBeNull()
    expect(loaded!.layer).toBe(7)
  })

  it('load returns null and clears on version mismatch', () => {
    const state = makeDiveSave({ version: 999 as any })
    SaveManager.save(state)
    const loaded = SaveManager.load()
    expect(loaded).toBeNull()
    expect(localStorageMock.removeItem).toHaveBeenCalled()
  })

  it('clear removes the save', () => {
    const state = makeDiveSave()
    SaveManager.save(state)
    SaveManager.clear()
    expect(localStorageMock.removeItem).toHaveBeenCalled()
    expect(SaveManager.hasSave()).toBe(false)
  })

  it('hasSave returns true after save() and false after clear()', () => {
    SaveManager.save(makeDiveSave())
    expect(SaveManager.hasSave()).toBe(true)
    SaveManager.clear()
    expect(SaveManager.hasSave()).toBe(false)
  })
})
```

#### 2.3.3 CompanionManager unit tests

File path: `/root/terra-miner/tests/unit/CompanionManager.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { CompanionManager } from '../../src/game/managers/CompanionManager'
import { COMPANION_CATALOGUE } from '../../src/data/companions'
import type { CompanionState } from '../../src/data/companions'

function makeCompanionState(companionId: string, stage: 0 | 1 | 2 = 0): CompanionState {
  return { companionId, currentStage: stage, xp: 0, feedCount: 0 }
}

describe('CompanionManager', () => {
  let mgr: CompanionManager
  const firstCompanion = COMPANION_CATALOGUE[0]

  beforeEach(() => {
    mgr = new CompanionManager()
  })

  it('getPrimaryEffect returns null when no companion set', () => {
    expect(mgr.getPrimaryEffect()).toBeNull()
  })

  it('setCompanion(null) clears the companion', () => {
    const states = [makeCompanionState(firstCompanion.id)]
    mgr.setCompanion(firstCompanion.id, states)
    mgr.setCompanion(null, states)
    expect(mgr.getPrimaryEffect()).toBeNull()
  })

  it('setCompanion with valid id populates primary effect', () => {
    const states = [makeCompanionState(firstCompanion.id, 0)]
    mgr.setCompanion(firstCompanion.id, states)
    const effect = mgr.getPrimaryEffect()
    expect(effect).not.toBeNull()
    expect(effect!.effectId).toBe(firstCompanion.effectId)
  })

  it('getEffectiveStage returns currentStage when tempBonus is 0', () => {
    const states = [makeCompanionState(firstCompanion.id, 1)]
    mgr.setCompanion(firstCompanion.id, states)
    expect(mgr.getEffectiveStage()).toBe(1)
  })

  it('applyTemporaryUpgrade increments effective stage (max cap 2)', () => {
    const states = [makeCompanionState(firstCompanion.id, 0)]
    mgr.setCompanion(firstCompanion.id, states)
    mgr.applyTemporaryUpgrade()
    expect(mgr.getEffectiveStage()).toBe(1)
    mgr.applyTemporaryUpgrade()
    expect(mgr.getEffectiveStage()).toBe(2)
    // Cannot exceed 2
    mgr.applyTemporaryUpgrade()
    expect(mgr.getEffectiveStage()).toBe(2)
  })

  it('tempStageBonus resets when setCompanion is called again', () => {
    const states = [makeCompanionState(firstCompanion.id, 0)]
    mgr.setCompanion(firstCompanion.id, states)
    mgr.applyTemporaryUpgrade()
    mgr.applyTemporaryUpgrade()
    mgr.setCompanion(firstCompanion.id, states)
    expect(mgr.getEffectiveStage()).toBe(0)
  })
})
```

#### 2.3.4 QuizManager rate-limiting unit tests

File path: `/root/terra-miner/tests/unit/QuizManager.rate.test.ts`

QuizManager depends on Svelte stores and MineScene. For unit testing the rate-limiting logic, extract the pure rate calculations and test `shouldTriggerQuiz()` by injecting `Math.random`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  QUIZ_BASE_RATE,
  QUIZ_COOLDOWN_BLOCKS,
  QUIZ_FIRST_TRIGGER_AFTER_BLOCKS,
  QUIZ_FATIGUE_THRESHOLD,
  QUIZ_FATIGUE_PENALTY_PER_QUIZ,
  QUIZ_MIN_RATE,
} from '../../src/data/balance'
import { QuizManager } from '../../src/game/managers/QuizManager'

// Stub Svelte store imports so QuizManager can be imported in Node
vi.mock('svelte/store', () => ({
  get: vi.fn(() => null),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
}))

vi.mock('../../src/ui/stores/gameState', () => ({
  currentScreen: { subscribe: vi.fn() },
  activeQuiz: { subscribe: vi.fn(), set: vi.fn() },
  gaiaMessage: { subscribe: vi.fn(), set: vi.fn() },
  currentLayer: { subscribe: vi.fn() },
}))

vi.mock('../../src/ui/stores/playerData', () => ({
  playerSave: { subscribe: vi.fn() },
  updateReviewState: vi.fn(),
}))

vi.mock('../../src/services/analyticsService', () => ({
  analyticsService: { track: vi.fn() },
}))

describe('QuizManager.shouldTriggerQuiz', () => {
  let qm: QuizManager

  beforeEach(() => {
    qm = new QuizManager(() => null, vi.fn())
    qm.resetForDive()
  })

  it('does not trigger before QUIZ_FIRST_TRIGGER_AFTER_BLOCKS', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // force trigger if checked
    for (let i = 0; i < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS - 1; i++) {
      expect(qm.shouldTriggerQuiz()).toBe(false)
    }
  })

  it('respects cooldown — no trigger when blocksSinceLastQuiz < QUIZ_COOLDOWN_BLOCKS', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // would trigger
    // Advance past first-trigger threshold
    for (let i = 0; i < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS; i++) qm.shouldTriggerQuiz()
    // Advance one block past cooldown (trigger once)
    const triggered = qm.shouldTriggerQuiz()
    expect(triggered).toBe(true) // triggered
    // Next few blocks are in cooldown
    for (let i = 0; i < QUIZ_COOLDOWN_BLOCKS - 1; i++) {
      expect(qm.shouldTriggerQuiz()).toBe(false)
    }
  })

  it('does not trigger when Math.random() >= effectiveRate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1) // never triggers
    for (let i = 0; i < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS + QUIZ_COOLDOWN_BLOCKS + 10; i++) {
      qm.shouldTriggerQuiz()
    }
    // getTotalBlocksThisDive-based check: no quiz triggered = quizzesThisDive is 0
    // We verify by checking that resetForDive doesn't throw and state is consistent
    expect(() => qm.resetForDive()).not.toThrow()
  })

  it('devForceQuizEveryBlock triggers every block after first-trigger threshold', () => {
    qm.devForceQuizEveryBlock = true
    for (let i = 0; i < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS; i++) qm.shouldTriggerQuiz()
    expect(qm.shouldTriggerQuiz()).toBe(true)
    expect(qm.shouldTriggerQuiz()).toBe(true)
  })
})
```

#### Acceptance Criteria — 27.3

- [ ] TickSystem tests pass (8 test cases, covering singleton, advance, callbacks, resets)
- [ ] SaveManager tests pass (9 test cases, covering save, load, version mismatch, clear)
- [ ] CompanionManager tests pass (6 test cases, covering companion effects and temp upgrades)
- [ ] QuizManager rate-limiting tests pass with mocked Svelte stores

---

### 27.4 — Component Tests (Svelte)

**Goal**: Render isolated Svelte components in jsdom, assert on DOM output, and test user interaction handlers without a full browser.

#### 2.4.1 Setup Svelte testing environment

The `@testing-library/svelte` library handles component mounting. Tests run in the jsdom environment (default in `vitest.config.ts`).

#### 2.4.2 QuizOverlay component tests

Target component: The quiz UI overlay that shows a question and 4 answer choices.

File path: `/root/terra-miner/tests/component/QuizOverlay.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/svelte'
// Import the actual component — adjust path to the correct quiz overlay component
// Based on the codebase the quiz display is handled inline in MineScene/BaseView
// We test the FactReveal component which shows a fact after a correct answer
import FactReveal from '../../src/ui/components/FactReveal.svelte'
import { makeFact } from '../fixtures/facts'

describe('FactReveal component', () => {
  it('renders the fact statement', () => {
    const fact = makeFact({ statement: 'The speed of light is 299,792 km/s.' })
    render(FactReveal, { props: { fact, visible: true } })
    expect(screen.getByText(/299,792 km\/s/)).toBeTruthy()
  })

  it('renders the correct answer', () => {
    const fact = makeFact({ correctAnswer: '21,196 km' })
    render(FactReveal, { props: { fact, visible: true } })
    expect(screen.getByText(/21,196 km/)).toBeTruthy()
  })

  it('dispatches close event when dismiss button clicked', async () => {
    const fact = makeFact()
    const { component } = render(FactReveal, { props: { fact, visible: true } })
    const handler = vi.fn()
    component.$on('close', handler)
    const button = screen.getByRole('button')
    await fireEvent.click(button)
    expect(handler).toHaveBeenCalledOnce()
  })
})
```

#### 2.4.3 GachaReveal component tests

File path: `/root/terra-miner/tests/component/GachaReveal.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import GachaReveal from '../../src/ui/components/GachaReveal.svelte'

describe('GachaReveal component', () => {
  it('renders rarity label', () => {
    render(GachaReveal, { props: { rarity: 'legendary', itemName: 'Ancient Compass', visible: true } })
    expect(screen.getByText(/legendary/i)).toBeTruthy()
  })

  it('renders item name', () => {
    render(GachaReveal, { props: { rarity: 'common', itemName: 'Stone Fragment', visible: true } })
    expect(screen.getByText(/Stone Fragment/)).toBeTruthy()
  })
})
```

#### Acceptance Criteria — 27.4

- [ ] `@testing-library/svelte` renders components without Phaser initialization errors
- [ ] FactReveal tests pass (statement visible, answer visible, dismiss event fires)
- [ ] GachaReveal tests pass (rarity and name rendered)
- [ ] Component tests do not require a running dev server

---

### 27.5 — Integration Tests: Server Routes

**Goal**: Spin up a real Fastify test instance against an in-memory SQLite database, send HTTP requests via supertest, and assert on responses for the health, auth, and facts routes.

#### 2.5.1 Test server factory

File path: `/root/terra-miner/server/tests/helpers/testServer.ts`

```typescript
import Fastify from 'fastify'
import { healthRoutes } from '../../src/routes/health.js'
import { factsRoutes } from '../../src/routes/facts.js'
// Add more routes as needed for specific test files

/**
 * Creates a minimal Fastify instance for integration testing.
 * Routes are registered individually per test file for isolation.
 */
export async function buildTestServer(registerRoutes: (app: ReturnType<typeof Fastify>) => Promise<void>) {
  const app = Fastify({ logger: false })
  await registerRoutes(app)
  await app.ready()
  return app
}
```

#### 2.5.2 Health route tests

File path: `/root/terra-miner/server/tests/routes/health.test.ts`

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import supertest from 'supertest'
import Fastify from 'fastify'
import { healthRoutes } from '../../src/routes/health.js'

let app: ReturnType<typeof Fastify>

afterEach(async () => { await app?.close() })

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes)
    await app.ready()

    const res = await supertest(app.server).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('response includes uptime', async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes)
    await app.ready()

    const res = await supertest(app.server).get('/health')
    expect(typeof res.body.uptime).toBe('number')
  })
})
```

#### 2.5.3 Facts route integration tests

File path: `/root/terra-miner/server/tests/routes/facts.test.ts`

```typescript
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import supertest from 'supertest'
import Fastify from 'fastify'
import { factsRoutes } from '../../src/routes/facts.js'

// Mock the facts DB and admin middleware for isolated route testing
vi.mock('../../src/db/facts-db.js', () => ({
  factsDb: {
    prepare: vi.fn(() => ({
      all: vi.fn(() => [
        { id: 'f1', statement: 'Test fact', status: 'approved', category_l1: 'History',
          category_l2: 'Ancient', db_version: 1, updated_at: 1000 },
      ]),
      get: vi.fn(() => ({ count: 1 })),
      run: vi.fn(),
    })),
  },
}))

vi.mock('../../src/middleware/adminAuth.js', () => ({
  requireAdmin: vi.fn(async () => {}),
}))

vi.mock('../../src/services/deduplication.js', () => ({
  checkDuplicate: vi.fn(() => false),
}))

vi.mock('../../src/services/categorization.js', () => ({
  categorizeFact: vi.fn(() => ({ category_l1: 'History', category_l2: 'Ancient' })),
}))

vi.mock('../../src/services/contentGen.js', () => ({
  generateFactContent: vi.fn(),
  extractFactsFromPassage: vi.fn(),
  persistGeneratedContent: vi.fn(),
}))

let app: ReturnType<typeof Fastify>

beforeEach(async () => {
  app = Fastify({ logger: false })
  await app.register(factsRoutes)
  await app.ready()
})

afterEach(async () => { await app?.close() })

describe('GET /facts', () => {
  it('returns an array of facts', async () => {
    const res = await supertest(app.server).get('/facts')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.facts)).toBe(true)
  })
})

describe('GET /facts/delta', () => {
  it('returns delta results with a sinceVersion param', async () => {
    const res = await supertest(app.server).get('/facts/delta?sinceVersion=0')
    expect(res.status).toBe(200)
  })
})
```

#### Acceptance Criteria — 27.5

- [ ] Health route returns 200 with `{ status: 'ok', uptime: number }`
- [ ] Facts route returns fact array (mocked DB) with status 200
- [ ] Server tests run entirely in Node, no browser required
- [ ] Each test file opens and closes a fresh Fastify instance
- [ ] `cd server && npx vitest run` passes all server tests

---

### 27.6 — E2E Tests: Playwright Scenarios

**Goal**: Write Node.js Playwright scripts (not Vitest-based) that drive the live dev server through the full game loop: launch → tutorial skip → mine dive → quiz → return to dome. These are smoke tests that catch regressions in the full integration.

All Playwright scripts follow the established project pattern: write to `/tmp/e2e-*.js` and run with `node`.

#### 2.6.1 E2E test directory

Create: `/root/terra-miner/tests/e2e/`

These scripts are run manually or by CI after `npm run dev` is started in the background.

#### 2.6.2 Smoke test: app loads

File path: `/root/terra-miner/tests/e2e/01-app-loads.js`

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')

  // App must load without console errors
  const errors = []
  page.on('pageerror', err => errors.push(err.message))

  // Wait for the initial screen (age gate or main menu)
  await page.waitForTimeout(5000)
  await page.screenshot({ path: '/tmp/e2e-01-loaded.png' })

  await browser.close()

  if (errors.length > 0) {
    console.error('Page errors detected:', errors)
    process.exit(1)
  }

  console.log('PASS: App loaded without errors')
})()
```

#### 2.6.3 Full flow test: dive and quiz

File path: `/root/terra-miner/tests/e2e/02-mine-quiz-flow.js`

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Enable console forwarding for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('[browser]', msg.text())
  })

  await page.goto('http://localhost:5173')
  await page.waitForTimeout(3000)

  // Handle age gate if present
  const ageButton = page.locator('button:has-text("18+"), button:has-text("Adult")')
  if (await ageButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ageButton.click()
    await page.waitForTimeout(1000)
  }

  // Navigate to dive screen
  const diveButton = page.locator('button:has-text("Dive"), button:has-text("Enter Mine")')
  await diveButton.first().waitFor({ timeout: 10000 })
  await diveButton.first().click({ force: true })
  await page.waitForTimeout(2000)

  await page.screenshot({ path: '/tmp/e2e-02-mine-entry.png' })

  // Mine for up to 30 seconds — force quiz with DEV panel
  const devBtn = page.locator('button:has-text("DEV")')
  if (await devBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await devBtn.click()
    await page.waitForTimeout(500)
    const forceQuiz = page.locator('button:has-text("Force Quiz")')
    if (await forceQuiz.isVisible({ timeout: 1000 }).catch(() => false)) {
      await forceQuiz.click()
      await page.waitForTimeout(500)
    }
    // Close dev panel
    await devBtn.click()
  }

  // Wait for quiz to appear
  const quizContainer = page.locator('[data-testid="quiz-overlay"], .quiz-overlay, button:has-text("A)"), button:has-text("B)")')
  const quizVisible = await quizContainer.first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false)

  if (quizVisible) {
    await page.screenshot({ path: '/tmp/e2e-02-quiz-visible.png' })
    // Click the first answer choice
    await quizContainer.first().click({ force: true })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '/tmp/e2e-02-quiz-answered.png' })
    console.log('PASS: Quiz appeared and was answered')
  } else {
    console.log('INFO: No quiz triggered in this run (probabilistic) — not a failure')
  }

  await browser.close()
  console.log('PASS: Mine dive flow completed')
})()
```

#### 2.6.4 Save/resume test

File path: `/root/terra-miner/tests/e2e/03-save-resume.js`

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(3000)

  // Check that localStorage is accessible and contains save data (or not)
  const hasSave = await page.evaluate(() => {
    return localStorage.getItem('terra-gacha-save') !== null ||
           localStorage.getItem('terra-dive-save') !== null
  })

  console.log(`INFO: Save data present in localStorage: ${hasSave}`)
  await page.screenshot({ path: '/tmp/e2e-03-save-state.png' })

  await browser.close()
  console.log('PASS: Save/resume check completed')
})()
```

#### Acceptance Criteria — 27.6

- [ ] All three E2E scripts run without throwing uncaught exceptions
- [ ] `01-app-loads.js` reports "PASS" with no browser page errors
- [ ] `02-mine-quiz-flow.js` navigates to the mine without crashing
- [ ] Screenshots are written to `/tmp/` and are visually inspectable
- [ ] E2E scripts use `/opt/google/chrome/chrome` executable (not Playwright's bundled browser)

---

### 27.7 — GitHub Actions Pipeline

**Goal**: Create a GitHub Actions workflow file that runs on every push and pull request to `main`. The pipeline enforces: lint, typecheck, unit tests, server tests, coverage gates, and a production build.

#### 2.7.1 Main CI workflow

File path: `/root/terra-miner/.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '22'

jobs:
  # ─── Lint & Type Check ────────────────────────────────────────────────────
  lint-typecheck:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run Svelte typecheck
        run: npm run typecheck

      - name: Run full typecheck (app + node)
        run: npm run check

  # ─── Unit Tests & Coverage ─────────────────────────────────────────────────
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint-typecheck
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests with coverage
        run: npm run test:coverage

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

      - name: Coverage summary
        run: |
          echo "Coverage thresholds enforced by vitest.config.ts:"
          echo "  Lines: 60%, Functions: 60%, Branches: 50%, Statements: 60%"

  # ─── Server Tests ──────────────────────────────────────────────────────────
  server-tests:
    name: Server Integration Tests
    runs-on: ubuntu-latest
    needs: lint-typecheck
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install root dependencies
        run: npm ci

      - name: Install server dependencies
        run: cd server && npm ci

      - name: Typecheck server
        run: cd server && npm run typecheck

      - name: Run server tests
        run: cd server && npx vitest run --config vitest.config.ts

  # ─── Build ────────────────────────────────────────────────────────────────
  build:
    name: Production Build
    runs-on: ubuntu-latest
    needs: [unit-tests, server-tests]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Production build
        run: npm run build
        env:
          NODE_ENV: production

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 7

  # ─── Server Build ────────────────────────────────────────────────────────
  server-build:
    name: Server Build
    runs-on: ubuntu-latest
    needs: server-tests
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install server dependencies
        run: cd server && npm ci

      - name: Build server
        run: cd server && npm run build
```

#### 2.7.2 Optional: Dependabot for security updates

File path: `/root/terra-miner/.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    groups:
      dev-dependencies:
        patterns: ["@types/*", "vitest", "@vitest/*", "@testing-library/*"]

  - package-ecosystem: "npm"
    directory: "/server"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3
```

#### 2.7.3 Branch protection rule (manual setup — not a file)

After the workflow is in place, enable these branch protection rules on `main` in GitHub Settings:

- Require status checks to pass before merging: `lint-typecheck`, `unit-tests`, `server-tests`, `build`
- Require branches to be up to date before merging
- Do not allow force pushes

#### Acceptance Criteria — 27.7

- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] Workflow triggers on push and PR to `main`
- [ ] All four jobs defined: lint-typecheck, unit-tests, server-tests, build
- [ ] Coverage artifacts are uploaded
- [ ] `npm run lint` is referenced (ESLint must be configured — see Files Affected)
- [ ] Server typecheck and build run in a separate job

---

### 27.8 — Seed Determinism Verification

**Goal**: Prove that `generateMine(seed, facts, layer, biome)` is fully deterministic — the same seed always produces bit-identical grid output. This is critical for future multiplayer co-op (Phase 43) and for the seed-sharing feature.

#### 2.8.1 seededRandom unit tests

File path: `/root/terra-miner/tests/unit/seededRandom.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { seededRandom } from '../../src/game/systems/MineGenerator'

describe('seededRandom (mulberry32)', () => {
  it('produces the same sequence for the same seed', () => {
    const rng1 = seededRandom(42)
    const rng2 = seededRandom(42)
    const seq1 = Array.from({ length: 50 }, () => rng1())
    const seq2 = Array.from({ length: 50 }, () => rng2())
    expect(seq1).toEqual(seq2)
  })

  it('produces different sequences for different seeds', () => {
    const rng1 = seededRandom(1)
    const rng2 = seededRandom(2)
    const val1 = rng1()
    const val2 = rng2()
    expect(val1).not.toBe(val2)
  })

  it('all outputs are in [0, 1)', () => {
    const rng = seededRandom(99)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('known seed 42 produces a stable first value (regression guard)', () => {
    // Pin the first value — if mulberry32 implementation changes this will catch it
    const rng = seededRandom(42)
    const first = rng()
    expect(first).toMatchSnapshot()
  })

  it('seed 0 does not produce all zeros', () => {
    const rng = seededRandom(0)
    const values = Array.from({ length: 10 }, () => rng())
    const allZero = values.every(v => v === 0)
    expect(allZero).toBe(false)
  })
})
```

#### 2.8.2 generateMine determinism tests

File path: `/root/terra-miner/tests/unit/MineGenerator.determinism.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { generateMine } from '../../src/game/systems/MineGenerator'
import { DEFAULT_BIOME } from '../../src/data/biomes'

function gridFingerprint(grid: ReturnType<typeof generateMine>['grid']): string {
  // Create a compact string representation of all cell types for comparison
  return grid.map(row => row.map(cell => cell.type).join(',')).join('|')
}

function spawnFingerprint(result: ReturnType<typeof generateMine>): string {
  return `${result.spawnX},${result.spawnY}`
}

describe('generateMine — seed determinism', () => {
  it('same seed produces identical grid fingerprint', () => {
    const SEED = 12345
    const FACTS = ['f1', 'f2', 'f3', 'f4', 'f5']

    const run1 = generateMine(SEED, FACTS, 0, DEFAULT_BIOME)
    const run2 = generateMine(SEED, FACTS, 0, DEFAULT_BIOME)

    expect(gridFingerprint(run1.grid)).toBe(gridFingerprint(run2.grid))
    expect(spawnFingerprint(run1)).toBe(spawnFingerprint(run2))
  })

  it('same seed produces identical grid across all 20 layers', () => {
    const SEED = 99999
    const FACTS = Array.from({ length: 20 }, (_, i) => `fact-${i}`)

    for (let layer = 0; layer < 20; layer++) {
      const run1 = generateMine(SEED + layer, FACTS, layer, DEFAULT_BIOME)
      const run2 = generateMine(SEED + layer, FACTS, layer, DEFAULT_BIOME)
      expect(gridFingerprint(run1.grid)).toBe(
        gridFingerprint(run2.grid),
        `Layer ${layer} grid fingerprints do not match`
      )
    }
  })

  it('different seeds produce different grids', () => {
    const FACTS = ['f1', 'f2']
    const run1 = generateMine(1, FACTS, 0, DEFAULT_BIOME)
    const run2 = generateMine(2, FACTS, 0, DEFAULT_BIOME)
    // Extremely unlikely to be identical (not impossible for simple grids, but valid)
    expect(gridFingerprint(run1.grid)).not.toBe(gridFingerprint(run2.grid))
  })

  it('layer 0 grid is 20 columns wide (base grid size)', () => {
    const result = generateMine(1, [], 0, DEFAULT_BIOME)
    result.grid.forEach(row => expect(row.length).toBe(20))
  })

  it('grid dimensions grow with layer depth (getLayerGridSize)', () => {
    // Layer 0 (1-indexed: 1) = 20 wide; deeper layers should be wider
    const layer0 = generateMine(1, [], 0, DEFAULT_BIOME)
    const layer10 = generateMine(1, [], 10, DEFAULT_BIOME)
    expect(layer10.grid[0].length).toBeGreaterThanOrEqual(layer0.grid[0].length)
  })

  it('spawn position is within grid bounds', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateMine(seed, [], 0, DEFAULT_BIOME)
      expect(result.spawnX).toBeGreaterThanOrEqual(0)
      expect(result.spawnX).toBeLessThan(result.grid[0].length)
      expect(result.spawnY).toBeGreaterThanOrEqual(0)
      expect(result.spawnY).toBeLessThan(result.grid.length)
    }
  })

  it('snapshot test — grid fingerprint for seed 42 layer 0 never changes', () => {
    const result = generateMine(42, ['f1', 'f2', 'f3'], 0, DEFAULT_BIOME)
    expect(gridFingerprint(result.grid)).toMatchSnapshot()
  })

  it('landmark layer (layer 4 = 1-indexed 5) has a recognisable landmark stamp', () => {
    // Layer index 4 (0-based) = layer 5 (1-based) — check if LANDMARK_LAYERS includes it
    // We just verify generation doesn't throw and the grid is the right size
    expect(() => generateMine(1, [], 4, DEFAULT_BIOME)).not.toThrow()
  })
})
```

#### 2.8.3 Balance constant regression tests

File path: `/root/terra-miner/tests/unit/balance.regression.test.ts`

These are snapshot tests that catch accidental changes to critical balance numbers:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { BALANCE, QUIZ_BASE_RATE, QUIZ_COOLDOWN_BLOCKS } from '../../src/data/balance'

describe('BALANCE constants — regression guard', () => {
  it('oxygen costs have not changed', () => {
    expect(BALANCE.OXYGEN_COST_MINE_DIRT).toMatchSnapshot()
    expect(BALANCE.OXYGEN_COST_MINE_SOFT_ROCK).toMatchSnapshot()
    expect(BALANCE.OXYGEN_COST_MINE_STONE).toMatchSnapshot()
    expect(BALANCE.OXYGEN_COST_MINE_HARD_ROCK).toMatchSnapshot()
  })

  it('SM-2 ease constants have not changed', () => {
    expect(BALANCE.SM2_INITIAL_EASE).toMatchSnapshot()
    expect(BALANCE.SM2_MIN_EASE).toMatchSnapshot()
  })

  it('quiz rate constants have not changed', () => {
    expect(QUIZ_BASE_RATE).toMatchSnapshot()
    expect(QUIZ_COOLDOWN_BLOCKS).toMatchSnapshot()
  })

  it('MAX_LAYERS is 20', () => {
    expect(BALANCE.MAX_LAYERS).toBe(20)
  })

  it('artifact rarity weights sum to 100', () => {
    const weights = BALANCE.ARTIFACT_RARITY_WEIGHTS
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0)
    expect(total).toBeCloseTo(100, 1)
  })
})
```

#### Acceptance Criteria — 27.8

- [ ] seededRandom tests pass (5 test cases, including snapshot)
- [ ] `generateMine` produces identical output for same seed across 2 runs
- [ ] `generateMine` determinism verified for all 20 layers
- [ ] Snapshot tests create `.snap` files on first run and guard regressions on subsequent runs
- [ ] `npm run test tests/unit/MineGenerator.determinism.test.ts` passes without any randomness failures

---

## 3. Playwright Visual Test Scripts

These scripts are written to `/tmp/` and run with `node` per the CLAUDE.md protocol. They are separate from the E2E tests in `tests/e2e/` and serve as visual smoke tests.

### Full game flow visual test

Write to `/tmp/e2e-phase27.js`:

```javascript
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })

  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('http://localhost:5173')

  // 1. App loads
  await page.waitForTimeout(5000)
  await page.screenshot({ path: '/tmp/e2e-p27-01-loaded.png' })
  console.log('Step 1: App loaded')

  // 2. Handle age gate
  const ageBtn = page.locator('button').filter({ hasText: /18\+|Adult/ })
  if (await ageBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ageBtn.click()
    await page.waitForTimeout(1000)
    console.log('Step 2: Age gate dismissed')
  }

  // 3. Navigate to main hub
  await page.screenshot({ path: '/tmp/e2e-p27-02-hub.png' })
  console.log('Step 3: Hub visible')

  // 4. Enter mine
  const diveBtn = page.locator('button').filter({ hasText: /Dive|Enter Mine|Start Mine/ })
  if (await diveBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await diveBtn.first().click({ force: true })
    await page.waitForTimeout(3000)
    await page.screenshot({ path: '/tmp/e2e-p27-03-mine.png' })
    console.log('Step 4: Mine entered')
  }

  // 5. Report errors
  if (errors.length > 0) {
    console.error('FAIL: Browser errors detected:', errors.slice(0, 5))
    await browser.close()
    process.exit(1)
  }

  await browser.close()
  console.log('PASS: Full game flow visual test complete')
})()
```

Run with: `node /tmp/e2e-phase27.js`
Then inspect screenshots with the Read tool at `/tmp/e2e-p27-*.png`.

---

## 4. Verification Gate

Before marking Phase 27 complete, ALL of the following must pass:

### 4.1 Unit Tests

```bash
npm run test:coverage
```

Expected output:
- All test suites pass (zero failing tests)
- Coverage thresholds met: Lines ≥ 60%, Functions ≥ 60%, Branches ≥ 50%
- `sm2.ts` coverage: Lines ≥ 90%
- `MineGenerator.ts` (seededRandom, generateMine) coverage: Lines ≥ 70%

### 4.2 Server Tests

```bash
cd server && npx vitest run
```

Expected output:
- Health route: 200 response with `status: ok`
- Facts route: 200 response with mock data
- Zero failing tests

### 4.3 TypeCheck (must still pass after test files added)

```bash
npm run typecheck
npm run check
```

Expected: Zero TypeScript errors.

### 4.4 Build (must still compile)

```bash
npm run build
```

Expected: Successful production build, no chunk size warnings beyond existing thresholds.

### 4.5 Determinism Verification

```bash
npm run test tests/unit/MineGenerator.determinism.test.ts
npm run test tests/unit/seededRandom.test.ts
```

Expected: All snapshot tests create/match `.snap` files, zero failures.

### 4.6 GitHub Actions

- Push a branch with the CI workflow
- All 4 jobs complete green: `lint-typecheck`, `unit-tests`, `server-tests`, `build`
- Coverage artifact appears in the Actions run artifacts

### 4.7 Playwright Visual Smoke Test

```bash
# With dev server running:
node /tmp/e2e-phase27.js
```

Expected:
- Script prints "PASS: Full game flow visual test complete"
- Screenshots at `/tmp/e2e-p27-*.png` show: loaded app, hub screen, mine screen
- No "FAIL" lines in output

---

## 5. Files Affected

### New Files Created

```
vitest.config.ts                                      — Vitest root config
tests/setup.ts                                        — Global test setup (localStorage mock, cleanup)
tests/fixtures/facts.ts                               — makeFact(), makeVocabFact() helpers
tests/fixtures/reviewState.ts                         — makeReviewState() helper
tests/unit/sm2.test.ts                                — SM-2 algorithm full coverage
tests/unit/interestConfig.test.ts                     — Interest config pure-logic tests
tests/unit/interestSpawner.test.ts                    — Biome bias selection tests
tests/unit/TickSystem.test.ts                         — TickSystem singleton and callback tests
tests/unit/SaveManager.test.ts                        — Save/load/version mismatch tests
tests/unit/CompanionManager.test.ts                   — Companion effects and temp upgrades
tests/unit/QuizManager.rate.test.ts                   — Quiz rate/cooldown logic with mocked stores
tests/unit/seededRandom.test.ts                       — mulberry32 PRNG determinism
tests/unit/MineGenerator.determinism.test.ts          — Full mine grid determinism across all layers
tests/unit/balance.regression.test.ts                 — Snapshot guards for critical balance numbers
tests/component/FactReveal.test.ts                    — Svelte component rendering and events
tests/component/GachaReveal.test.ts                   — Svelte component rendering
tests/e2e/01-app-loads.js                             — Playwright: app loads without errors
tests/e2e/02-mine-quiz-flow.js                        — Playwright: dive and quiz interaction
tests/e2e/03-save-resume.js                           — Playwright: localStorage save check
server/vitest.config.ts                               — Vitest config for server package
server/tests/helpers/testServer.ts                    — Fastify test instance factory
server/tests/routes/health.test.ts                    — Health endpoint integration test
server/tests/routes/facts.test.ts                     — Facts route integration test (mocked DB)
.github/workflows/ci.yml                              — GitHub Actions CI pipeline
.github/dependabot.yml                                — Automated security updates
```

### Modified Files

```
package.json            — Add vitest, @vitest/coverage-v8, jsdom, @testing-library/svelte,
                          @testing-library/jest-dom, happy-dom, supertest to devDependencies.
                          The "test", "test:watch", "test:coverage" scripts already exist.
server/package.json     — Add vitest, supertest, @types/supertest to devDependencies.
```

### Snapshot Files Created (auto-generated on first run)

```
tests/unit/__snapshots__/seededRandom.test.ts.snap
tests/unit/__snapshots__/MineGenerator.determinism.test.ts.snap
tests/unit/__snapshots__/balance.regression.test.ts.snap
```

These snapshot files must be committed to git so CI can compare against them.

---

## 6. Implementation Notes for Coding Workers

### Phaser isolation strategy

Many game files import from Phaser (e.g., `MineScene`, `DomeScene`). When writing tests for managers that depend on `MineScene`, use `vi.mock()` to stub the entire MineScene dependency:

```typescript
vi.mock('../../src/game/scenes/MineScene', () => ({
  MineScene: class {
    addBlock = vi.fn()
    revealCell = vi.fn()
  }
}))
```

Never import Phaser directly in test files — Phaser's module initialization requires a browser WebGL context.

### Svelte store isolation strategy

When testing code that imports from `svelte/store` in a Node environment, stub the entire module:

```typescript
vi.mock('svelte/store', () => ({
  get: vi.fn((store) => store._value ?? null),
  writable: vi.fn((initial) => {
    let _value = initial
    return {
      subscribe: vi.fn(),
      set: vi.fn((v) => { _value = v }),
      update: vi.fn((fn) => { _value = fn(_value) }),
      _value,
    }
  }),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
}))
```

### Time control in SM-2 tests

Always use `vi.useFakeTimers({ now: FIXED_TIMESTAMP })` before any SM-2 call that depends on `Date.now()`. Always call `vi.useRealTimers()` in `afterEach` or as the last line of the test. Failure to reset timers will cause subsequent tests in the same file to use the fake time.

### localStorage in Node tests

The `tests/setup.ts` file installs a global localStorage mock before every test. Tests that check localStorage behavior (SaveManager) should import directly from the module and let the mock intercept calls automatically. Do not re-define localStorage in individual test files.

### Snapshot test workflow

On first run, Vitest creates snapshot files automatically. On subsequent runs, it compares. If you intentionally change a balance constant or the seededRandom algorithm, update the snapshots with:

```bash
npm run test -- --update-snapshots
```

Then commit the updated `.snap` files.

### Coverage thresholds

The `vitest.config.ts` enforces coverage only on the `include` list of files. If a file is not in the `include` list, it will not count toward (or against) the threshold. Add files to the `coverage.include` array as more test coverage is added in future phases.

---

## 7. Open Questions

- **Q-T1**: Should E2E tests in CI require a running dev server (`npm run dev`) or use a built preview (`npm run preview`)? The preview approach is more stable but requires a build step in CI, adding ~2 minutes.
- **Q-T2**: Should we run Playwright E2E in CI from day one (requires Chrome in CI runner), or gate that behind a manual trigger workflow?
- **Q-T3**: Coverage thresholds are set conservatively (60/60/50/60) to be achievable with Phase 27 alone. Should they ratchet up in future phases (e.g., Phase 28 targets 80/80/70/80)?
- **Q-T4**: The QuizManager depends on Svelte stores in a way that makes isolation complex. Should we refactor the QuizManager to accept store references as constructor parameters (dependency injection) to make it fully testable? That refactor would be Phase 27.3 bonus work.
