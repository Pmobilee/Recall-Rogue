/**
 * Unit tests for playtestAPI.ts — HIGH-8 + Phase 5 methods
 *
 * Uses a test-mode approach: calls initPlaytestAPI() with the playtest
 * URL param set so the guard passes, then exercises each method via
 * window.__rrPlay.
 *
 * Environment: happy-dom (set in vitest.config.ts)
 */

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before any imports so Vitest hoists them
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/turboMode', () => ({
  turboDelay: (ms: number) => ms,
  isTurboMode: () => false,
}))

vi.mock('../../src/data/relics', () => ({
  RELIC_BY_ID: {
    lucky_coin:   { name: 'Lucky Coin',    description: '+1 gold on combat win',                rarity: 'common',   trigger: 'on_combat_win'   },
    iron_shield:  { name: 'Iron Shield',   description: 'Start each combat with 3 block',       rarity: 'uncommon', trigger: 'on_combat_start' },
    phantom_blade:{ name: 'Phantom Blade', description: 'First attack each turn deals double damage', rarity: 'rare', trigger: 'on_first_attack' },
  },
}))

// Dynamic import mocks (used inside async functions in playtestAPI.ts)
let mockHasRestUpgradeCandidates = vi.fn(() => true)
let mockGetActiveDeckCards = vi.fn(() => [] as unknown[])
let mockGetRunPoolCards = vi.fn(() => [] as unknown[])
let mockCanMasteryUpgrade = vi.fn(() => false)
let mockActiveCardRewardOptions = { subscribe: (cb: (v: unknown) => void) => { cb([]); return () => {} } }
let mockTurnState: any = null
let mockHandlePlayCard = vi.fn()
let mockFactsReady = false
let mockFactById: any = null
let mockQuizChoices: string[] = []

vi.mock('../../src/services/factsDB', () => ({
  factsDB: {
    isReady: () => mockFactsReady,
    getById: () => mockFactById,
  },
}))

vi.mock('../../src/services/quizService', () => ({
  getQuizChoices: () => mockQuizChoices,
}))

vi.mock('../../src/services/numericalDistractorService', () => ({
  displayAnswer: (answer: string) => answer,
}))

vi.mock('../../src/services/gameFlowController', () => ({
  get hasRestUpgradeCandidates() { return mockHasRestUpgradeCandidates },
  get activeCardRewardOptions() { return mockActiveCardRewardOptions },
}))

vi.mock('../../src/services/encounterBridge', () => ({
  get activeTurnState() {
    return { subscribe: (cb: (v: unknown) => void) => { cb(mockTurnState); return () => {} } }
  },
  get handlePlayCard() { return mockHandlePlayCard },
  get getActiveDeckCards() { return mockGetActiveDeckCards },
  get getRunPoolCards() { return mockGetRunPoolCards },
}))

vi.mock('../../src/services/cardUpgradeService', () => ({
  get canMasteryUpgrade() { return mockCanMasteryUpgrade },
  getMasteryStats: () => null,
  getEffectiveApCost: () => 1,
}))

// ---------------------------------------------------------------------------
// Store helpers — write singleton stores into globalThis so readStore() works
// ---------------------------------------------------------------------------

function setStore(key: string, value: unknown) {
  const sym = Symbol.for(key)
  let _val = value
  ;(globalThis as Record<symbol, unknown>)[sym] = {
    subscribe: (cb: (v: unknown) => void) => { cb(_val); return () => {} },
    set: (v: unknown) => { _val = v },
  }
}

function clearStore(key: string) {
  const sym = Symbol.for(key)
  delete (globalThis as Record<symbol, unknown>)[sym]
}

// ---------------------------------------------------------------------------
// initPlaytestAPI bootstrap
// ---------------------------------------------------------------------------

let _api: Record<string, (...args: unknown[]) => unknown> | null = null

async function getAPI() {
  if (_api) return _api
  // Set URL param so the guard passes
  Object.defineProperty(window, 'location', {
    value: { search: '?playtest=true' },
    writable: true,
  })
  const { initPlaytestAPI } = await import('../../src/dev/playtestAPI')
  initPlaytestAPI()
  _api = (window as unknown as Record<string, unknown>).__rrPlay as Record<string, (...args: unknown[]) => unknown>
  return _api
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = ''
  mockHasRestUpgradeCandidates = vi.fn(() => true)
  mockGetActiveDeckCards = vi.fn(() => [] as unknown[])
  mockGetRunPoolCards = vi.fn(() => [] as unknown[])
  mockCanMasteryUpgrade = vi.fn(() => false)
  mockTurnState = null
  mockHandlePlayCard = vi.fn()
  mockFactsReady = false
  mockFactById = null
  mockQuizChoices = []
  mockActiveCardRewardOptions = { subscribe: (cb: (v: unknown) => void) => { cb([]); return () => {} } }
  clearStore('rr:activeRunState')
  clearStore('rr:activeTurnState')
  clearStore('rr:currentScreen')
  setStore('rr:currentScreen', 'hub')
})

// ---------------------------------------------------------------------------
// Bridge helpers used by LLM playtests
// ---------------------------------------------------------------------------

describe('LLM room bridge helpers', () => {
  it('shopLeave confirms the two-step leave modal', async () => {
    setStore('rr:currentScreen', 'shopRoom')
    document.body.innerHTML = '<button data-testid="btn-leave-shop">Leave Shop</button>'

    document.querySelector<HTMLButtonElement>('[data-testid="btn-leave-shop"]')!.onclick = () => {
      const confirm = document.createElement('button')
      confirm.dataset.testid = 'btn-leave-confirm'
      confirm.textContent = 'Leave anyway'
      confirm.onclick = () => {
        const store = (globalThis as Record<symbol, unknown>)[Symbol.for('rr:currentScreen')] as { set: (v: unknown) => void }
        store.set('dungeonMap')
      }
      document.body.append(confirm)
    }

    const api = await getAPI()
    const result = await (api.shopLeave as () => Promise<{ ok: boolean; message: string }>)()

    expect(result.ok).toBe(true)
    expect(result.message).toContain('confirmation')
  })

  it('selectMysteryChoice can click EventQuiz answer buttons', async () => {
    setStore('rr:currentScreen', 'mysteryEvent')
    let clicked = false
    document.body.innerHTML = '<button class="choice-btn" data-testid="quiz-answer-0">Answer</button>'
    document.querySelector<HTMLButtonElement>('[data-testid="quiz-answer-0"]')!.onclick = () => {
      clicked = true
    }

    const api = await getAPI()
    const result = await (api.selectMysteryChoice as (i: number) => Promise<{ ok: boolean; message: string }>)(0)

    expect(result.ok).toBe(true)
    expect(result.message).toContain('mystery')
    expect(clicked).toBe(true)
  })

  it('mysteryContinue advances EventQuiz result next buttons', async () => {
    setStore('rr:currentScreen', 'mysteryEvent')
    let advanced = false
    document.body.innerHTML = '<button class="next-btn">Next Question</button>'
    document.querySelector<HTMLButtonElement>('.next-btn')!.onclick = () => {
      advanced = true
    }

    const api = await getAPI()
    const result = await (api.mysteryContinue as () => Promise<{ ok: boolean; message: string }>)()

    expect(result.ok).toBe(true)
    expect(advanced).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Stable card-id play helpers
// ---------------------------------------------------------------------------

describe('card-id play helpers', () => {
  function setCombatHand() {
    mockTurnState = {
      result: null,
      apCurrent: 3,
      apMax: 3,
      turnNumber: 1,
      chainLength: 0,
      chainMultiplier: 1,
      playerState: { hp: 40, maxHP: 40, shield: 0 },
      enemy: { currentHP: 20, maxHP: 20 },
      deck: {
        hand: [
          { id: 'card_1', cardType: 'block', mechanicId: 'block' },
          { id: 'card_42', cardType: 'strike', mechanicId: 'strike' },
        ],
      },
    }
  }

  it('quickPlayCardById resolves the current hand index and delegates to quick play', async () => {
    setStore('rr:currentScreen', 'combat')
    setCombatHand()
    mockHandlePlayCard = vi.fn((cardId: string) => {
      mockTurnState = {
        ...mockTurnState,
        apCurrent: 2,
        deck: { ...mockTurnState.deck, hand: mockTurnState.deck.hand.filter((c: any) => c.id !== cardId) },
      }
    })

    const api = await getAPI()
    const result = await (api.quickPlayCardById as (id: string) => Promise<{ ok: boolean; state: Record<string, unknown> }>)('card_42')

    expect(result.ok).toBe(true)
    expect(result.state.cardId).toBe('card_42')
    expect(mockHandlePlayCard).toHaveBeenCalledWith('card_42', true, false, undefined, undefined, 'quick')
  })

  it('chargePlayCardById resolves the current hand index and delegates to charge play', async () => {
    setStore('rr:currentScreen', 'combat')
    setCombatHand()
    mockHandlePlayCard = vi.fn((cardId: string) => {
      mockTurnState = {
        ...mockTurnState,
        apCurrent: 1,
        deck: { ...mockTurnState.deck, hand: mockTurnState.deck.hand.filter((c: any) => c.id !== cardId) },
      }
    })

    const api = await getAPI()
    const result = await (api.chargePlayCardById as (id: string, correct: boolean) => Promise<{ ok: boolean; state: Record<string, unknown> }>)('card_42', true)

    expect(result.ok).toBe(true)
    expect(result.state.cardId).toBe('card_42')
    expect(mockHandlePlayCard).toHaveBeenCalledWith('card_42', true, false, 1500, undefined, 'charge')
  })

  it('returns a clear error when the card id is not in hand', async () => {
    setCombatHand()

    const api = await getAPI()
    const result = await (api.quickPlayCardById as (id: string) => Promise<{ ok: boolean; message: string }>)('card_missing')

    expect(result).toEqual({ ok: false, message: 'Card card_missing not in hand' })
  })
})

// ---------------------------------------------------------------------------
// previewCardQuiz malformed-choice guard
// ---------------------------------------------------------------------------

describe('previewCardQuiz choice count guard', () => {
  it('returns ok=false when the generated quiz has fewer than 3 choices', async () => {
    mockFactsReady = true
    mockFactById = {
      id: 'stroke_fact',
      quizQuestion: 'What is the incidence of stroke cases per 100K?',
      correctAnswer: '213 cases',
    }
    mockQuizChoices = ['213 cases']
    mockTurnState = {
      deck: { hand: [{ id: 'card_1', cardType: 'strike', mechanicId: 'strike', factId: 'stroke_fact' }] },
    }

    const api = await getAPI()
    const result = await (api.previewCardQuiz as (index: number) => Promise<{ ok: boolean; message: string }>)(0)

    expect(result.ok).toBe(false)
    expect(result.message).toContain('returned 1 choices')
  })
})

// ---------------------------------------------------------------------------
// HIGH-8: startStudy() preconditions
// ---------------------------------------------------------------------------

describe('startStudy() precondition check (HIGH-8)', () => {
  it('returns ok=false with "no active run" when no runState is set', async () => {
    clearStore('rr:activeRunState')
    const api = await getAPI()
    const result = await (api.startStudy as () => Promise<{ ok: boolean; message: string }>)()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/no active run/i)
  })

  it('does NOT write restStudy to screen store when no active run', async () => {
    clearStore('rr:activeRunState')
    const sym = Symbol.for('rr:currentScreen')
    const store = (globalThis as Record<symbol, unknown>)[sym] as { set?: (v: unknown) => void }
    const setCalls: unknown[] = []
    const origSet = store?.set?.bind(store)
    if (store) {
      store.set = (v: unknown) => { setCalls.push(v); origSet?.(v) }
    }

    const api = await getAPI()
    await (api.startStudy as () => Promise<unknown>)()
    expect(setCalls).not.toContain('restStudy')
  })

  it('returns ok=false with "empty study pool" when run exists but no upgradeable cards', async () => {
    setStore('rr:activeRunState', { currentFloor: 1 })
    mockHasRestUpgradeCandidates = vi.fn(() => false)

    const api = await getAPI()
    const result = await (api.startStudy as () => Promise<{ ok: boolean; message: string }>)()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/empty study pool/i)
  })

  it('does NOT write restStudy to screen store when study pool is empty', async () => {
    setStore('rr:activeRunState', { currentFloor: 1 })
    mockHasRestUpgradeCandidates = vi.fn(() => false)

    const sym = Symbol.for('rr:currentScreen')
    const store = (globalThis as Record<symbol, unknown>)[sym] as { set?: (v: unknown) => void }
    const setCalls: unknown[] = []
    const origSet = store?.set?.bind(store)
    if (store) {
      store.set = (v: unknown) => { setCalls.push(v); origSet?.(v) }
    }

    const api = await getAPI()
    await (api.startStudy as () => Promise<unknown>)()
    expect(setCalls).not.toContain('restStudy')
  })
})

// ---------------------------------------------------------------------------
// playCard() -> answerQuiz* race
// ---------------------------------------------------------------------------

describe('playCard() -> answerQuizCorrectly() race', () => {
  it('waits for a delayed quiz overlay before answering correctly', async () => {
    vi.useFakeTimers()

    try {
      setStore('rr:currentScreen', 'combat')
      setStore('rr:activeQuiz', null)

      const activeQuizStore = (globalThis as Record<symbol, unknown>)[Symbol.for('rr:activeQuiz')] as {
        set: (v: unknown) => void
      }
      const cardClick = vi.fn()
      const answerClick = vi.fn()
      document.body.innerHTML = `
        <button data-testid="card-hand-0">Card</button>
        <button data-testid="quiz-answer-1">Correct</button>
      `
      document.querySelector<HTMLButtonElement>('[data-testid="card-hand-0"]')!.addEventListener('click', cardClick)
      document.querySelector<HTMLButtonElement>('[data-testid="quiz-answer-1"]')!.addEventListener('click', answerClick)

      const api = await getAPI()
      setTimeout(() => {
        activeQuizStore.set({
          question: 'Delayed quiz?',
          choices: ['No', 'Yes'],
          correctIndex: 1,
          mode: 'charge',
        })
      }, 1100)

      const playResultPromise = (api.playCard as (index: number) => Promise<{ ok: boolean; message: string }>)(0)
      await vi.advanceTimersByTimeAsync(800)
      const playResult = await playResultPromise
      expect(playResult.ok).toBe(true)
      expect(cardClick).toHaveBeenCalledTimes(1)

      const answerResultPromise = (api.answerQuizCorrectly as () => Promise<{ ok: boolean; message: string }>)()
      await vi.advanceTimersByTimeAsync(300)
      await vi.advanceTimersByTimeAsync(1200)
      const answerResult = await answerResultPromise

      expect(answerResult).toEqual({ ok: true, message: 'Answered choice 1' })
      expect(answerClick).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns No active quiz if the quiz overlay never appears', async () => {
    vi.useFakeTimers()

    try {
      setStore('rr:currentScreen', 'combat')
      setStore('rr:activeQuiz', null)

      const api = await getAPI()
      const answerResultPromise = (api.answerQuizCorrectly as () => Promise<{ ok: boolean; message: string }>)()
      await vi.advanceTimersByTimeAsync(2000)
      const answerResult = await answerResultPromise

      expect(answerResult).toEqual({ ok: false, message: 'No active quiz' })
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------
// Phase 5: getRelicDetails()
// ---------------------------------------------------------------------------

describe('getRelicDetails() — Phase 5', () => {
  it('returns [] when no active run', async () => {
    clearStore('rr:activeRunState')
    const api = await getAPI()
    const result = (api.getRelicDetails as () => Array<Record<string, unknown>>)()
    expect(result).toEqual([])
  })

  it('returns [] when runRelics is absent from runState', async () => {
    setStore('rr:activeRunState', { currentFloor: 1 })
    const api = await getAPI()
    const result = (api.getRelicDetails as () => Array<Record<string, unknown>>)()
    expect(result).toEqual([])
  })

  it('returns full relic details for 3 relics', async () => {
    setStore('rr:activeRunState', {
      currentFloor: 3,
      runRelics: [
        { definitionId: 'lucky_coin',    acquiredAtFloor: 1, triggerCount: 5 },
        { definitionId: 'iron_shield',   acquiredAtFloor: 2, triggerCount: 2 },
        { definitionId: 'phantom_blade', acquiredAtFloor: 3, triggerCount: 0 },
      ],
    })

    const api = await getAPI()
    const result = (api.getRelicDetails as () => Array<Record<string, unknown>>)()

    expect(result).toHaveLength(3)

    const coin = result[0]
    expect(coin.id).toBe('lucky_coin')
    expect(coin.name).toBe('Lucky Coin')
    expect(coin.description).toBe('+1 gold on combat win')
    expect(coin.rarity).toBe('common')
    expect(coin.trigger).toBe('on_combat_win')
    expect(coin.acquiredAtFloor).toBe(1)
    expect(coin.triggerCount).toBe(5)

    expect(result[1].id).toBe('iron_shield')
    expect(result[2].id).toBe('phantom_blade')
    expect(result[2].triggerCount).toBe(0)
  })

  it('falls back gracefully for unknown relic ID', async () => {
    setStore('rr:activeRunState', {
      runRelics: [{ definitionId: 'no_such_relic', acquiredAtFloor: 1, triggerCount: 0 }],
    })
    const api = await getAPI()
    const result = (api.getRelicDetails as () => Array<Record<string, unknown>>)()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('no_such_relic')
    expect(result[0].name).toBe('no_such_relic')  // fallback to id
    expect(result[0].description).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Phase 5: getRewardChoices()
// ---------------------------------------------------------------------------

describe('getRewardChoices() — Phase 5', () => {
  it('returns [] when no card reward is active', async () => {
    // default mock returns []
    const api = await getAPI()
    const result = await (api.getRewardChoices as () => Promise<Array<Record<string, unknown>>>)()
    expect(result).toEqual([])
  })

  it('returns mapped choices when card reward options are set', async () => {
    const mockCards = [
      { id: 'card-1', cardType: 'strike', mechanicId: 'strike', mechanicName: 'Strike',
        domain: 'combat', tier: 1, apCost: 1, baseEffectValue: 8, masteryLevel: 0,
        chainType: 'crimson', factId: null },
      { id: 'card-2', cardType: 'block', mechanicId: 'block', mechanicName: 'Block',
        domain: 'combat', tier: 1, apCost: 1, baseEffectValue: 5, masteryLevel: 0,
        chainType: 'obsidian', factId: null },
      { id: 'card-3', cardType: 'draw', mechanicId: 'draw', mechanicName: 'Draw',
        domain: 'knowledge', tier: 2, apCost: 2, baseEffectValue: 2, masteryLevel: 1,
        chainType: null, factId: null },
    ]
    mockActiveCardRewardOptions = {
      subscribe: (cb: (v: unknown) => void) => { cb(mockCards); return () => {} },
    }

    const api = await getAPI()
    const result = await (api.getRewardChoices as () => Promise<Array<Record<string, unknown>>>)()

    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('card-1')
    expect(result[0].cardType).toBe('strike')
    expect(result[0].index).toBe(0)
    expect(result[1].index).toBe(1)
    expect(result[2].mechanicName).toBe('Draw')
    expect(result[2].tier).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Phase 5: getStudyPoolSize()
// ---------------------------------------------------------------------------

describe('getStudyPoolSize() — Phase 5', () => {
  it('returns 0 when no active run', async () => {
    clearStore('rr:activeRunState')
    const api = await getAPI()
    const count = await (api.getStudyPoolSize as () => Promise<number>)()
    expect(count).toBe(0)
  })

  it('returns 0 when run exists but no upgradeable cards', async () => {
    setStore('rr:activeRunState', { currentFloor: 1 })
    mockGetActiveDeckCards = vi.fn(() => [{ id: 'c1' }, { id: 'c2' }])
    mockCanMasteryUpgrade = vi.fn(() => false)

    const api = await getAPI()
    const count = await (api.getStudyPoolSize as () => Promise<number>)()
    expect(count).toBe(0)
  })

  it('returns count of upgradeable cards from active deck', async () => {
    setStore('rr:activeRunState', { currentFloor: 2 })
    mockGetActiveDeckCards = vi.fn(() => [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }])
    mockCanMasteryUpgrade = vi.fn(() => true)  // all 3 upgradeable

    const api = await getAPI()
    const count = await (api.getStudyPoolSize as () => Promise<number>)()
    expect(count).toBe(3)
  })

  it('falls back to run pool when active deck is empty (between encounters)', async () => {
    setStore('rr:activeRunState', { currentFloor: 1 })
    mockGetActiveDeckCards = vi.fn(() => [])          // empty — between encounters
    mockGetRunPoolCards = vi.fn(() => [{ id: 'r1' }, { id: 'r2' }])
    mockCanMasteryUpgrade = vi.fn(() => true)

    const api = await getAPI()
    const count = await (api.getStudyPoolSize as () => Promise<number>)()
    expect(count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// LOW-19: getCombatState() enemyIntent.displayDamage
// ---------------------------------------------------------------------------

// Mock computeIntentDisplayDamage so the test is unit-isolated
vi.mock('../../src/services/intentDisplay', () => ({
  computeIntentDisplayDamage: vi.fn((_intent: unknown, _enemy: unknown) => 16),
}))

describe('getCombatState() enemyIntent.displayDamage — LOW-19', () => {
  const baseEnemy = {
    template: { name: 'Slime' },
    currentHP: 30,
    maxHP: 40,
    block: 0,
    statusEffects: [],
    nextIntent: {
      type: 'attack',
      value: 10,
      telegraph: 'attack',
      hitCount: 1,
      statusEffect: null,
    },
    floor: 1,
    difficultyVariance: 1,
  }

  const basePlayerState = {
    hp: 60,
    maxHP: 80,
    shield: 0,
    statusEffects: [],
  }

  function buildTurnState(overrides: Record<string, unknown> = {}) {
    return {
      playerState: basePlayerState,
      playerHP: 60,
      apCurrent: 3,
      apMax: 3,
      turn: 1,
      cardsPlayedThisTurn: 0,
      deck: { hand: [] },
      enemy: baseEnemy,
      ...overrides,
    }
  }

  it('includes displayDamage in enemyIntent when intent is an attack', async () => {
    setStore('rr:currentScreen', 'combat')
    setStore('rr:activeTurnState', buildTurnState())
    setStore('rr:activeRunState', { currentFloor: 1, currentSegment: 1, currency: 0 })

    const api = await getAPI()
    const state = (api.getCombatState as () => Record<string, unknown> | null)()

    expect(state).not.toBeNull()
    const intent = state!.enemyIntent as Record<string, unknown>
    expect(intent).not.toBeNull()
    // Raw value preserved for backward compatibility
    expect(intent.value).toBe(10)
    // displayDamage computed via computeIntentDisplayDamage (mocked to return 16)
    expect(intent.displayDamage).toBe(16)
  })

  it('displayDamage is 0 for non-attack intent (defend)', async () => {
    const { computeIntentDisplayDamage } = await import('../../src/services/intentDisplay')
    ;(computeIntentDisplayDamage as ReturnType<typeof vi.fn>).mockReturnValueOnce(0)

    const defendEnemy = {
      ...baseEnemy,
      nextIntent: { type: 'defend', value: 8, telegraph: 'defend', hitCount: 1, statusEffect: null },
    }
    setStore('rr:currentScreen', 'combat')
    setStore('rr:activeTurnState', buildTurnState({ enemy: defendEnemy }))
    setStore('rr:activeRunState', { currentFloor: 1 })

    const api = await getAPI()
    const state = (api.getCombatState as () => Record<string, unknown> | null)()
    const intent = state!.enemyIntent as Record<string, unknown>
    expect(intent.displayDamage).toBe(0)
  })

  it('returns null enemyIntent when enemy has no nextIntent', async () => {
    const noIntentEnemy = { ...baseEnemy, nextIntent: undefined }
    setStore('rr:currentScreen', 'combat')
    setStore('rr:activeTurnState', buildTurnState({ enemy: noIntentEnemy }))
    setStore('rr:activeRunState', { currentFloor: 1 })

    const api = await getAPI()
    const state = (api.getCombatState as () => Record<string, unknown> | null)()
    expect(state!.enemyIntent).toBeNull()
  })

  it('displayDamage differs from raw value for multiplied attacks', async () => {
    // Raw: 10, display: 16 (×1.60 multiplier, floor scaling etc.)
    const api = await getAPI()
    setStore('rr:currentScreen', 'combat')
    setStore('rr:activeTurnState', buildTurnState())
    setStore('rr:activeRunState', { currentFloor: 1 })
    const state = (api.getCombatState as () => Record<string, unknown> | null)()
    const intent = state!.enemyIntent as Record<string, unknown>
    // The mock returns 16 — confirm it differs from the raw 10
    expect(intent.displayDamage).not.toBe(intent.value)
    expect(typeof intent.displayDamage).toBe('number')
  })
})
