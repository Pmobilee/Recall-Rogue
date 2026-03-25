import { chromium } from '@playwright/test'

const BASE_URL = process.env.PERF_BASE_URL || 'http://localhost:5173'
const COLD_START_LIMIT_MS = 3000
const MAX_HEAP_BYTES = 150 * 1024 * 1024

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  const start = Date.now()
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('btn-start-run').waitFor({ state: 'visible', timeout: 15_000 })
  const coldStartMs = Date.now() - start

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const navTiming = nav
      ? {
          domContentLoadedMs: nav.domContentLoadedEventEnd - nav.startTime,
          loadEventMs: nav.loadEventEnd - nav.startTime,
        }
      : null
    const memory = (performance && 'memory' in performance)
      ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
        }
      : null
    return { navTiming, memory }
  })

  await browser.close()

  const output = {
    baseUrl: BASE_URL,
    coldStartMs,
    coldStartLimitMs: COLD_START_LIMIT_MS,
    heapLimitBytes: MAX_HEAP_BYTES,
    ...metrics,
  }

  console.log(JSON.stringify(output, null, 2))

  if (coldStartMs > COLD_START_LIMIT_MS) {
    throw new Error(`Cold start ${coldStartMs}ms exceeded ${COLD_START_LIMIT_MS}ms`)
  }

  if (metrics.memory?.usedJSHeapSize && metrics.memory.usedJSHeapSize > MAX_HEAP_BYTES) {
    throw new Error(
      `Heap usage ${metrics.memory.usedJSHeapSize} exceeded ${MAX_HEAP_BYTES} bytes`
    )
  }
}

run().catch((err) => {
  console.error('[performance-audit] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
