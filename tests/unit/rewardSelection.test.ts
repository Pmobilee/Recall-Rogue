import { describe, expect, it } from 'vitest'
import type { Card, CardType } from '../../src/data/card-types'
import { normalizeRewardSelection } from '../../src/ui/utils/rewardSelection'

function makeCard(cardType: CardType): Card {
  return { cardType } as Card
}

describe('normalizeRewardSelection', () => {
  it('keeps selection empty until the player picks one', () => {
    const options = [makeCard('attack'), makeCard('shield')]
    expect(normalizeRewardSelection(null, options)).toBeNull()
  })

  it('clears stale selections that no longer exist', () => {
    const options = [makeCard('attack'), makeCard('shield')]
    expect(normalizeRewardSelection('buff', options)).toBeNull()
  })

  it('keeps a valid player-picked option', () => {
    const options = [makeCard('attack'), makeCard('shield')]
    expect(normalizeRewardSelection('shield', options)).toBe('shield')
  })
})

