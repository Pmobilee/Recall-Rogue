/**
 * Web performance timing collector.
 *
 * Captures LCP, FID/INP, CLS, and FCP via PerformanceObserver and reports
 * them to the analytics service once per session.
 *
 * Call perfService.observe() once at app boot.
 */

import { analyticsService } from './analyticsService'

interface PerfSnapshot {
  lcp?: number
  fcp?: number
  cls?: number
  inp?: number
  ttfb?: number
  inputDelayP95?: number
  longTaskCount?: number
  longTaskMax?: number
}

class PerfService {
  private snapshot: PerfSnapshot = {}
  private reported = false
  private observing = false
  private inputDelaysMs: number[] = []

  private sampleInputDelay = (): void => {
    const startedAt = performance.now()
    requestAnimationFrame(() => {
      const delay = Math.max(0, performance.now() - startedAt)
      this.inputDelaysMs.push(delay)
      // Keep a bounded sample window to avoid unbounded memory growth.
      if (this.inputDelaysMs.length > 120) this.inputDelaysMs.shift()
    })
  }

  private percentile(values: number[], q: number): number {
    if (values.length === 0) return -1
    const sorted = [...values].sort((a, b) => a - b)
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))
    return Math.round(sorted[idx])
  }

  observe(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window) || this.observing) return
    this.observing = true

    // FCP
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.snapshot.fcp = Math.round(entry.startTime)
          }
        }
      }).observe({ type: 'paint', buffered: true })
    } catch { /* unsupported */ }

    // LCP
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries[entries.length - 1]
        if (last) this.snapshot.lcp = Math.round(last.startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch { /* unsupported */ }

    // CLS
    try {
      let clsValue = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
          if (!e.hadRecentInput) clsValue += e.value ?? 0
        }
        this.snapshot.cls = parseFloat(clsValue.toFixed(4))
      }).observe({ type: 'layout-shift', buffered: true })
    } catch { /* unsupported */ }

    // INP (Interaction to Next Paint — available in Chrome 96+)
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = entry.duration
          if (!this.snapshot.inp || duration > this.snapshot.inp) {
            this.snapshot.inp = Math.round(duration)
          }
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
    } catch { /* unsupported */ }

    // TTFB via navigation timing
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav) {
        this.snapshot.ttfb = Math.round(nav.responseStart - nav.requestStart)
      }
    } catch { /* unsupported */ }

    // Long tasks (main-thread blocks > 50ms)
    try {
      this.snapshot.longTaskCount = 0
      this.snapshot.longTaskMax = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = Math.round(entry.duration)
          this.snapshot.longTaskCount = (this.snapshot.longTaskCount ?? 0) + 1
          this.snapshot.longTaskMax = Math.max(this.snapshot.longTaskMax ?? 0, duration)
        }
      }).observe({ type: 'longtask', buffered: true } as PerformanceObserverInit)
    } catch { /* unsupported */ }

    // Input delay proxy: pointerdown -> next paint
    try {
      window.addEventListener('pointerdown', this.sampleInputDelay, { passive: true, capture: true })
    } catch { /* unsupported */ }

    // Report 10 seconds after boot to capture LCP
    setTimeout(() => this.report(), 10_000)
  }

  private report(): void {
    if (this.reported) return
    this.reported = true
    try {
      window.removeEventListener('pointerdown', this.sampleInputDelay, { capture: true } as EventListenerOptions)
    } catch {
      // ignore
    }
    this.snapshot.inputDelayP95 = this.percentile(this.inputDelaysMs, 0.95)

    analyticsService.track({
      name: 'web_vitals',
      properties: {
        lcp: this.snapshot.lcp ?? -1,
        fcp: this.snapshot.fcp ?? -1,
        cls: this.snapshot.cls ?? -1,
        inp: this.snapshot.inp ?? -1,
        ttfb: this.snapshot.ttfb ?? -1,
        input_delay_p95: this.snapshot.inputDelayP95 ?? -1,
        long_task_count: this.snapshot.longTaskCount ?? -1,
        long_task_max: this.snapshot.longTaskMax ?? -1,
      },
    })
  }
}

export const perfService = new PerfService()
