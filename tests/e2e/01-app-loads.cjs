/**
 * E2E smoke test: App loads without JavaScript errors.
 * Run with: node tests/e2e/01-app-loads.cjs
 * Requires: dev server running at http://localhost:5173
 */
const { chromium } = require('playwright')
const attachDiagnostics = require('./lib/diagnostics.cjs')

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  })

  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  const diagnostics = attachDiagnostics(page)

  await page.goto('http://localhost:5173')

  // Wait for initial screen to settle (age gate or main menu)
  await page.waitForTimeout(5000)
  await page.screenshot({ path: '/tmp/e2e-01-loaded.png' })

  const report = await diagnostics.report()

  await browser.close()

  // Print diagnostic report
  console.log('=== Diagnostic Report ===')
  console.log(JSON.stringify(report, null, 2))

  if (report.pageErrors.length > 0) {
    console.error('FAIL: Page errors detected:')
    report.pageErrors.forEach(e => console.error(' -', e))
    process.exit(1)
  }

  console.log('PASS: App loaded without errors')
  console.log('Screenshot: /tmp/e2e-01-loaded.png')
})()
