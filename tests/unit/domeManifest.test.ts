import { describe, expect, it } from 'vitest'
import { getDefaultDomeLayout } from '../../src/data/domeLayout'
import { DOME_SPRITE_KEYS } from '../../src/game/domeManifest'

describe('domeManifest sprite coverage', () => {
  it('contains every spriteKey used by default dome objects', () => {
    const known = new Set<string>(DOME_SPRITE_KEYS as readonly string[])
    const layout = getDefaultDomeLayout()
    const missing = layout.objects
      .map((obj) => obj.spriteKey)
      .filter((key, index, arr) => arr.indexOf(key) === index)
      .filter((key) => !known.has(key))

    expect(missing).toEqual([])
  })
})
