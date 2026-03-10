import { describe, expect, it } from 'vitest'
import { getDefaultDomeLayout } from '../../src/data/domeLayout'
import { TREE_STAGES } from '../../src/data/knowledgeTreeStages'
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

  it('contains every knowledge-tree stage sprite key', () => {
    const known = new Set<string>(DOME_SPRITE_KEYS as readonly string[])
    const missing = TREE_STAGES
      .map((stage) => stage.spriteKey)
      .filter((key) => !known.has(key))

    expect(missing).toEqual([])
  })
})
