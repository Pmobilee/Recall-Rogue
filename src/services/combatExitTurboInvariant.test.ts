// @vitest-environment node

import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('combat exit turbo invariants', () => {
  const cardAppSource = fs.readFileSync(
    path.resolve(__dirname, '../CardApp.svelte'),
    'utf-8',
  )
  const tutorialSource = fs.readFileSync(
    path.resolve(__dirname, '../ui/components/TutorialCoachMark.svelte'),
    'utf-8',
  )

  it('turbo combat exit bypasses visual transition gating', () => {
    const turboIndex = cardAppSource.indexOf('if (isTurboMode())')
    expect(turboIndex).toBeGreaterThan(-1)

    const turboBlock = cardAppSource.slice(turboIndex, cardAppSource.indexOf('return', turboIndex) + 6)
    expect(turboBlock).toContain('onCombatExitComplete()')
    expect(turboBlock).not.toContain('combatTransitionActive = true')
  })

  it('tutorial coach mark tolerates a missing anchor object', () => {
    expect(tutorialSource).toContain("anchor ?? { target: 'screen-center', position: 'center' }")
    expect(tutorialSource).toContain('void anchor?.target')
    expect(tutorialSource).toContain('void anchor?.position')
  })
})
