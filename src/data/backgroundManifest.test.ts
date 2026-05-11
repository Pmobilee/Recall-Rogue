/**
 * Tests for backgroundManifest.ts — specifically the mystery_combat / mystery_elite_combat
 * fallback fix (2026-05-11). These synthetic IDs have no per-event artwork and previously
 * caused ParallaxTransition to log a 404 error, which blocked the post-combat screen
 * transition.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'

// getMysteryEventBg and getMysteryEventDepthMap read window.innerWidth/Height.
// Stub the browser globals before importing so getOrientation() works in Node.
Object.defineProperty(global, 'window', {
  value: { innerWidth: 1920, innerHeight: 1080 },
  writable: true,
})

import { getMysteryEventBg, getMysteryEventDepthMap, getRandomRoomBg, getRoomDepthMap } from './backgroundManifest'

describe('backgroundManifest — mystery_combat fallback', () => {
  it('getMysteryEventBg returns the generic mystery room bg for mystery_combat', () => {
    const url = getMysteryEventBg('mystery_combat')
    const genericUrl = getRandomRoomBg('mystery')
    expect(url).toBe(genericUrl)
  })

  it('getMysteryEventBg returns the generic mystery room bg for mystery_elite_combat', () => {
    const url = getMysteryEventBg('mystery_elite_combat')
    const genericUrl = getRandomRoomBg('mystery')
    expect(url).toBe(genericUrl)
  })

  it('getMysteryEventDepthMap returns the generic mystery room depth for mystery_combat', () => {
    const url = getMysteryEventDepthMap('mystery_combat')
    const genericUrl = getRoomDepthMap('mystery')
    expect(url).toBe(genericUrl)
  })

  it('getMysteryEventDepthMap returns the generic mystery room depth for mystery_elite_combat', () => {
    const url = getMysteryEventDepthMap('mystery_elite_combat')
    const genericUrl = getRoomDepthMap('mystery')
    expect(url).toBe(genericUrl)
  })

  it('real named events still get per-event paths', () => {
    const bg = getMysteryEventBg('burning_library')
    expect(bg).toContain('/assets/backgrounds/mystery/burning_library/')
    expect(bg).not.toContain('/rooms/mystery/')

    const depth = getMysteryEventDepthMap('burning_library')
    expect(depth).toContain('/assets/backgrounds/mystery/burning_library/')
    expect(depth).not.toContain('/rooms/mystery/')
  })

  it('resolved mystery_combat background path exists on disk', () => {
    const url = getMysteryEventBg('mystery_combat')
    // url starts with '/' — strip it for path.join('public', ...)
    const diskPath = join(process.cwd(), 'public', url.replace(/^\//, ''))
    expect(existsSync(diskPath)).toBe(true)
  })

  it('resolved mystery_combat depth path exists on disk', () => {
    const url = getMysteryEventDepthMap('mystery_combat')
    const diskPath = join(process.cwd(), 'public', url.replace(/^\//, ''))
    expect(existsSync(diskPath)).toBe(true)
  })
})
