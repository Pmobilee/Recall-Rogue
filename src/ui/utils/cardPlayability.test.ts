/**
 * cardPlayability.test.ts — Unit tests for Issues 6+10 regression.
 *
 * Issue 6: Obsidian Strike at apCurrent=1, baseCost=1, isActiveChainMatch=true
 *   → canChargeCard must return true (charge cost = 1 + 0 = 1 ≤ 1)
 *   Before the fix: card showed as playable BUT charge button was disabled.
 *
 * Issue 10: obsidian card at apCurrent=0, baseCost=1, isActiveChainMatch=true
 *   → canChargeCard must return false (charge cost = 1 + 0 = 1 > 0)
 *   Before the fix: card appeared playable even though clicking did nothing.
 */

import { describe, it, expect } from 'vitest'
import { canChargeCard, canQuickPlayCard, isCardPlayable, getChargeApCost } from './cardPlayability'
import type { Card } from '../../data/card-types'
import type { ChargeContext } from './cardPlayability'

/** Minimal Card stub — only fields consumed by getEffectiveApCost are needed. */
function makeCard(apCost: number): Card {
  return {
    id: 'test-card',
    factId: 'test-fact',
    cardType: 'attack',
    mechanicId: 'strike',
    mechanicName: 'Strike',
    chainType: 1, // obsidian = 1
    apCost,
    baseEffectValue: 5,
    effectMultiplier: 1,
    masteryLevel: 0,
    tier: '1',
    isCursed: false,
    isLocked: false,
    isMasteryTrial: false,
    domain: 'history',
  } as unknown as Card
}

/** Default context: no waivers, focusDiscount=0 */
function makeCtx(overrides: Partial<ChargeContext> = {}): ChargeContext {
  return {
    apCurrent: 1,
    focusDiscount: 0,
    isSurgeActive: false,
    isMomentumMatch: false,
    isActiveChainMatch: false,
    ...overrides,
  }
}

describe('canChargeCard — Issue 6 regression', () => {
  it('apCurrent=1, baseCost=1, isActiveChainMatch=true → can charge (cost=1, 1≤1)', () => {
    const card = makeCard(1)
    const ctx = makeCtx({ apCurrent: 1, isActiveChainMatch: true })
    expect(canChargeCard(card, ctx)).toBe(true)
  })

  it('apCurrent=1, baseCost=1, NO waivers → cannot charge (cost=2, 2>1)', () => {
    const card = makeCard(1)
    const ctx = makeCtx({ apCurrent: 1 })
    expect(canChargeCard(card, ctx)).toBe(false)
  })
})

describe('canChargeCard — Issue 10 regression', () => {
  it('apCurrent=0, baseCost=1, isActiveChainMatch=true → cannot charge (cost=1, 1>0)', () => {
    const card = makeCard(1)
    const ctx = makeCtx({ apCurrent: 0, isActiveChainMatch: true })
    expect(canChargeCard(card, ctx)).toBe(false)
  })

  it('apCurrent=0, baseCost=0, isActiveChainMatch=true → can charge (cost=0, 0≤0)', () => {
    // Edge: 0 base cost + 0 surcharge (waived) = 0, which equals apCurrent=0 → affordable
    const card = makeCard(0)
    const ctx = makeCtx({ apCurrent: 0, isActiveChainMatch: true })
    expect(canChargeCard(card, ctx)).toBe(true)
  })
})

describe('canChargeCard — table-driven cases', () => {
  const cases: Array<{
    apCurrent: number
    baseCost: number
    isActiveChainMatch: boolean
    isSurgeActive: boolean
    isMomentumMatch: boolean
    expected: boolean
    label: string
  }> = [
    { apCurrent: 1, baseCost: 1, isActiveChainMatch: true,  isSurgeActive: false, isMomentumMatch: false, expected: true,  label: 'Issue 6: chain match, exact AP' },
    { apCurrent: 1, baseCost: 1, isActiveChainMatch: false, isSurgeActive: false, isMomentumMatch: false, expected: false, label: 'Issue 6: no waiver, 1AP not enough for cost=2' },
    { apCurrent: 0, baseCost: 1, isActiveChainMatch: true,  isSurgeActive: false, isMomentumMatch: false, expected: false, label: 'Issue 10: chain match, 0 AP < cost=1' },
    { apCurrent: 0, baseCost: 0, isActiveChainMatch: true,  isSurgeActive: false, isMomentumMatch: false, expected: true,  label: '0 cost + 0 surcharge = 0 ≤ 0 AP' },
    { apCurrent: 2, baseCost: 1, isActiveChainMatch: false, isSurgeActive: false, isMomentumMatch: false, expected: true,  label: '2 AP ≥ cost=1+1=2, no waiver' },
    { apCurrent: 1, baseCost: 0, isActiveChainMatch: false, isSurgeActive: true,  isMomentumMatch: false, expected: true,  label: 'surge waives surcharge, cost=0+0=0 ≤ 1' },
    { apCurrent: 1, baseCost: 0, isActiveChainMatch: false, isSurgeActive: false, isMomentumMatch: true,  expected: true,  label: 'momentum waives surcharge, cost=0 ≤ 1' },
  ]

  for (const c of cases) {
    it(c.label, () => {
      const card = makeCard(c.baseCost)
      const ctx = makeCtx({
        apCurrent: c.apCurrent,
        isActiveChainMatch: c.isActiveChainMatch,
        isSurgeActive: c.isSurgeActive,
        isMomentumMatch: c.isMomentumMatch,
      })
      expect(canChargeCard(card, ctx)).toBe(c.expected)
    })
  }
})

describe('getChargeApCost', () => {
  it('baseCost=1, no waiver → cost=2', () => {
    expect(getChargeApCost(makeCard(1), makeCtx())).toBe(2)
  })
  it('baseCost=1, surge waiver → cost=1', () => {
    expect(getChargeApCost(makeCard(1), makeCtx({ isSurgeActive: true }))).toBe(1)
  })
  it('baseCost=1, chain match → cost=1', () => {
    expect(getChargeApCost(makeCard(1), makeCtx({ isActiveChainMatch: true }))).toBe(1)
  })
  it('baseCost=0, no waiver → cost=1', () => {
    expect(getChargeApCost(makeCard(0), makeCtx())).toBe(1)
  })
  it('baseCost=0, momentum waiver → cost=0', () => {
    expect(getChargeApCost(makeCard(0), makeCtx({ isMomentumMatch: true }))).toBe(0)
  })
  it('focusDiscount=1 on cost=2 → base=1, no waiver → charge cost=2', () => {
    expect(getChargeApCost(makeCard(2), makeCtx({ focusDiscount: 1 }))).toBe(2)
  })
  it('focusDiscount=1 on cost=1 → base=0, no waiver → charge cost=1', () => {
    expect(getChargeApCost(makeCard(1), makeCtx({ focusDiscount: 1 }))).toBe(1)
  })
})

describe('canQuickPlayCard', () => {
  it('apCurrent=1, baseCost=1, no discount → affordable', () => {
    const card = makeCard(1)
    expect(canQuickPlayCard(card, { apCurrent: 1, focusDiscount: 0 })).toBe(true)
  })
  it('apCurrent=0, baseCost=1 → not affordable', () => {
    const card = makeCard(1)
    expect(canQuickPlayCard(card, { apCurrent: 0, focusDiscount: 0 })).toBe(false)
  })
  it('apCurrent=0, baseCost=1, focusDiscount=1 → affordable (cost=0)', () => {
    const card = makeCard(1)
    expect(canQuickPlayCard(card, { apCurrent: 0, focusDiscount: 1 })).toBe(true)
  })
})

describe('isCardPlayable', () => {
  it('playable via QP only (charge not affordable): baseCost=0, apCurrent=0, no waiver', () => {
    // QP cost=0 ≤ 0, charge cost=0+1=1 > 0 → QP-path makes it playable
    const card = makeCard(0)
    const ctx = makeCtx({ apCurrent: 0 })
    expect(isCardPlayable(card, ctx)).toBe(true)
  })

  it('playable via charge only (QP not affordable): baseCost=2, apCurrent=1, focusDiscount=0, chain match', () => {
    // QP cost=2 > 1 → not QP-playable; charge cost=2+0=2 > 1 → also not charge-playable
    // This case confirms that with 1 AP and a 2-cost card and chain match, it's still not playable
    const card = makeCard(2)
    const ctx = makeCtx({ apCurrent: 1, isActiveChainMatch: true })
    // QP: 2 > 1 → false; charge: 2+0=2 > 1 → false
    expect(isCardPlayable(card, ctx)).toBe(false)
  })

  it('not playable: baseCost=2, apCurrent=1, no waivers', () => {
    const card = makeCard(2)
    const ctx = makeCtx({ apCurrent: 1 })
    expect(isCardPlayable(card, ctx)).toBe(false)
  })

  it('playable: baseCost=1, apCurrent=2, no waivers (QP: 1≤2 → true)', () => {
    const card = makeCard(1)
    const ctx = makeCtx({ apCurrent: 2 })
    expect(isCardPlayable(card, ctx)).toBe(true)
  })

  it('Issue 10 fix: apCurrent=0, baseCost=1, chain match → NOT playable', () => {
    // QP: 1 > 0 → false; charge: 1+0=1 > 0 → false → not playable (greyed out correctly)
    const card = makeCard(1)
    const ctx = makeCtx({ apCurrent: 0, isActiveChainMatch: true })
    expect(isCardPlayable(card, ctx)).toBe(false)
  })
})
