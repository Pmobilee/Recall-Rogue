// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TickSystem } from '../../src/game/systems/TickSystem'

/** Reset the singleton between tests so each test starts fresh. */
function freshTick(): TickSystem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(TickSystem as any).instance = undefined
  return TickSystem.getInstance()
}

describe('TickSystem', () => {
  beforeEach(() => {
    freshTick() // ensure clean state
  })

  it('singleton returns the same instance', () => {
    const a = freshTick()
    const b = TickSystem.getInstance()
    expect(a).toBe(b)
  })

  it('getTick starts at 0', () => {
    const ts = freshTick()
    expect(ts.getTick()).toBe(0)
  })

  it('getLayerTick starts at 0', () => {
    const ts = freshTick()
    expect(ts.getLayerTick()).toBe(0)
  })

  it('advance increments global tick', () => {
    const ts = freshTick()
    ts.advance()
    ts.advance()
    expect(ts.getTick()).toBe(2)
  })

  it('advance increments layer tick', () => {
    const ts = freshTick()
    ts.advance()
    ts.advance()
    ts.advance()
    expect(ts.getLayerTick()).toBe(3)
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
    expect(ts.getTick()).toBe(2) // global tick unchanged
    expect(ts.getLayerTick()).toBe(0) // layer tick reset
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

  it('multiple callbacks fire in registration order', () => {
    const ts = freshTick()
    const order: string[] = []
    ts.register('a', () => order.push('a'))
    ts.register('b', () => order.push('b'))
    ts.register('c', () => order.push('c'))
    ts.advance()
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('layer tick callback receives correct layer tick (reset between layers)', () => {
    const ts = freshTick()
    const layerTicks: number[] = []
    ts.register('tracker', (_tick, layerTick) => layerTicks.push(layerTick))
    ts.advance() // global=1, layer=1
    ts.advance() // global=2, layer=2
    ts.resetLayerTick()
    ts.advance() // global=3, layer=1
    expect(layerTicks).toEqual([1, 2, 1])
  })
})
