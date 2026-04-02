import { audioManager } from '../../services/audioService'
import { isTurboMode } from '../../utils/turboMode'

/**
 * Staggers pop-in animations for room UI elements after a transition settles.
 * Elements scale from 0 → 1.08 → 1.0 with opacity fade, played with a
 * slow-fast-slow timing curve and per-element pop sound.
 */
export interface PopInOptions {
  /** Ordered list of elements or CSS selectors to pop in sequentially */
  elements: (HTMLElement | string)[]
  /** Container element to query selectors against */
  container: HTMLElement
  /** Total stagger duration in ms (default 2500, max 3000) */
  totalDuration?: number
  /** Called when all animations complete */
  onComplete?: () => void
}

const PER_ELEMENT_MS = 200
const EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

/**
 * Staggers pop-in animations for room UI elements after a transition settles.
 * Uses a sine-based delay distribution for slow→fast→slow timing.
 * Respects prefers-reduced-motion, card:reduceMotionMode localStorage flag,
 * and turbo mode (bot/automated testing).
 */
export function staggerPopIn(options: PopInOptions): void {
  const { elements, container, totalDuration, onComplete } = options
  const T = Math.min(totalDuration ?? 2500, 3000)

  // Resolve elements: strings are CSS selectors, HTMLElements are used directly
  const resolved: HTMLElement[] = []
  for (const entry of elements) {
    if (typeof entry === 'string') {
      const found = container.querySelector<HTMLElement>(entry)
      if (found) resolved.push(found)
    } else if (entry instanceof HTMLElement) {
      resolved.push(entry)
    }
  }

  if (resolved.length === 0) {
    onComplete?.()
    return
  }

  // Pre-hide all resolved elements immediately
  for (const el of resolved) {
    el.style.opacity = '0'
    el.style.transform = 'scale(0)'
    el.style.pointerEvents = 'none'
  }

  // Reduce motion check — also skips in turbo mode so bots see interactive elements immediately
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const reduceMotionStorage = localStorage.getItem('card:reduceMotionMode') === 'true'
  if (prefersReducedMotion || reduceMotionStorage || isTurboMode()) {
    for (const el of resolved) {
      el.style.opacity = ''
      el.style.transform = ''
      el.style.pointerEvents = ''
    }
    onComplete?.()
    return
  }

  const N = resolved.length
  const delays: number[] = []

  // Sine-based delay distribution: slow at edges, fast in middle
  for (let i = 0; i < N; i++) {
    const t = N <= 1 ? 0 : i / (N - 1)
    const eased = (Math.sin((t - 0.5) * Math.PI) + 1) / 2
    let delay = eased * T * 0.85
    // Last element gets a dramatic pause
    if (i === N - 1 && N > 2) {
      delay = Math.max(delay, (delays[i - 1] ?? 0) + 250)
    }
    delays.push(delay)
  }

  // Schedule per-element animations
  for (let i = 0; i < N; i++) {
    const el = resolved[i]
    const delay = delays[i]

    setTimeout(() => {
      // Re-enable interaction immediately when element begins animating
      el.style.pointerEvents = ''
      el.animate(
        [
          { transform: 'scale(0)', opacity: 0 },
          { transform: 'scale(1.08)', opacity: 1, offset: 0.6 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        {
          duration: PER_ELEMENT_MS,
          easing: EASING,
          fill: 'forwards',
        }
      )

      // Clear inline styles after animation completes so CSS takes over
      setTimeout(() => {
        el.style.opacity = ''
        el.style.transform = ''
      }, PER_ELEMENT_MS)

      // Play pop sound with slight pitch variation via the audio manager
      audioManager.playSound('ui_pop_in')
    }, delay)
  }

  // Completion callback: fires after last element's animation finishes
  const lastDelay = delays[N - 1] ?? 0
  setTimeout(() => {
    // Safety-net: ensure all elements have their inline styles cleared
    for (const el of resolved) {
      el.style.opacity = ''
      el.style.transform = ''
      el.style.pointerEvents = ''
    }
    onComplete?.()
  }, lastDelay + PER_ELEMENT_MS)
}

/**
 * Svelte action that hides an element for pop-in animation.
 * Use with `use:popInHidden` on elements that will be animated by staggerPopIn.
 */
export function popInHidden(el: HTMLElement): void {
  el.style.opacity = '0'
  el.style.transform = 'scale(0)'
  el.style.pointerEvents = 'none'
}
