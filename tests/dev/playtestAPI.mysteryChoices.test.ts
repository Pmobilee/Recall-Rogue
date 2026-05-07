// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/utils/turboMode', () => ({
  turboDelay: (ms: number) => ms,
  isTurboMode: () => false,
}))

beforeEach(() => {
  document.body.innerHTML = ''
  Object.defineProperty(window, 'location', {
    value: { search: '?playtest=true' },
    writable: true,
  })
  delete (window as unknown as Record<string, unknown>).__rrPlay
})

describe('getMysteryEventChoices()', () => {
  it('includes flashcard merchant Pay and Leave buttons in DOM order', async () => {
    const clicked: string[] = []
    document.body.innerHTML = `
      <div class="mystery-overlay">
        <button class="continue-btn" data-testid="mystery-continue">Pay 25 Gold</button>
        <button class="choice-btn">Leave</button>
      </div>
    `
    document.querySelector<HTMLButtonElement>('[data-testid="mystery-continue"]')!.onclick = () => clicked.push('pay')
    document.querySelector<HTMLButtonElement>('.choice-btn')!.onclick = () => clicked.push('leave')

    const { initPlaytestAPI } = await import('../../src/dev/playtestAPI')
    initPlaytestAPI()
    const api = (window as unknown as { __rrPlay: Record<string, unknown> }).__rrPlay

    expect((api.getMysteryEventChoices as () => Array<{ text: string }>)().map(c => c.text)).toEqual([
      'Pay 25 Gold',
      'Leave',
    ])

    const result = await (api.selectMysteryChoice as (index: number) => Promise<{ ok: boolean }>)(0)
    expect(result.ok).toBe(true)
    expect(clicked).toEqual(['pay'])
  })
})
