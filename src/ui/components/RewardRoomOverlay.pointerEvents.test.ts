// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

describe('RewardRoomOverlay pointer events', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('keeps Continue clickable above the visible Phaser canvas', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'RewardRoomOverlay.svelte'), 'utf-8')
    const style = source.match(/<style>([\s\S]+)<\/style>/)?.[1]
    expect(style).toBeTruthy()

    const styleEl = document.createElement('style')
    styleEl.textContent = style!
    document.head.append(styleEl)

    const onContinue = vi.fn()
    document.body.innerHTML = `
      <div id="phaser-container" class="visible" style="position: fixed; inset: 0; z-index: 1; pointer-events: auto;">
        <canvas width="1920" height="1080" style="width: 100vw; height: 100vh;"></canvas>
      </div>
      <button
        type="button"
        class="overlay-btn continue-overlay"
        aria-label="Continue to next room"
        data-testid="btn-reward-room-continue"
      >Continue</button>
    `

    const button = document.querySelector<HTMLButtonElement>('[data-testid="btn-reward-room-continue"]')
    const canvas = document.querySelector<HTMLCanvasElement>('#phaser-container canvas')
    const phaserContainer = document.querySelector<HTMLElement>('#phaser-container')

    expect(button).not.toBeNull()
    expect(canvas).not.toBeNull()
    expect(phaserContainer).not.toBeNull()
    button!.addEventListener('click', onContinue)

    const buttonRect = rect(870, 925, 180, 52)
    const canvasRect = rect(0, 0, 1920, 1080)
    vi.spyOn(button!, 'getBoundingClientRect').mockReturnValue(buttonRect)
    vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue(canvasRect)
    vi.spyOn(document, 'elementFromPoint').mockImplementation((x, y) => {
      const candidates: Array<{ element: Element; zIndex: number }> = []
      const pointInButton =
        x >= buttonRect.left && x <= buttonRect.right && y >= buttonRect.top && y <= buttonRect.bottom
      const pointInCanvas =
        x >= canvasRect.left && x <= canvasRect.right && y >= canvasRect.top && y <= canvasRect.bottom

      if (pointInCanvas && getComputedStyle(phaserContainer!).pointerEvents !== 'none') {
        candidates.push({
          element: canvas!,
          zIndex: Number.parseInt(getComputedStyle(phaserContainer!).zIndex || '0', 10),
        })
      }

      if (pointInButton && getComputedStyle(button!).pointerEvents !== 'none') {
        candidates.push({
          element: button!,
          zIndex: Number.parseInt(getComputedStyle(button!).zIndex || '0', 10),
        })
      }

      return candidates.sort((a, b) => b.zIndex - a.zIndex)[0]?.element ?? null
    })

    const centerX = buttonRect.left + buttonRect.width / 2
    const centerY = buttonRect.top + buttonRect.height / 2

    expect(getComputedStyle(button!).pointerEvents).toBe('auto')
    expect(document.elementFromPoint(centerX, centerY)).toBe(button)

    button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
