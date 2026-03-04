/**
 * E2E smoke test: App loads without JavaScript errors.
 * Run with: node tests/e2e/01-app-loads.js
 * Requires: dev server running at http://localhost:5173
 */
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })

  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('http://localhost:5173')

  // Wait for initial screen to settle (age gate or main menu)
  await page.waitForTimeout(5000)
  await page.screenshot({ path: '/tmp/e2e-01-loaded.png' })

  await browser.close()

  if (errors.length > 0) {
    console.error('FAIL: Page errors detected:')
    errors.forEach(e => console.error(' -', e))
    process.exit(1)
  }

  console.log('PASS: App loaded without errors')
  console.log('Screenshot: /tmp/e2e-01-loaded.png')
})()
