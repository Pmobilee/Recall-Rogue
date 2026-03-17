/**
 * E2E test: Portrait regression — verifies portrait mode is unchanged after desktop port.
 * Run with: node tests/e2e/05-portrait-regression.cjs
 * Requires: dev server running at http://localhost:5173
 */
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
const attachDiagnostics = require('./lib/diagnostics.cjs')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })

  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  const diagnostics = attachDiagnostics(page)

  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial')
  await page.waitForTimeout(3000)

  // Check layout mode CSS custom property
  const layoutMode = await page.evaluate(() => {
    return document.documentElement.style.getPropertyValue('--layout-mode')?.trim()
  })
  console.log(`INFO: Layout mode: ${layoutMode}`)

  // Check data-layout attribute
  const dataLayout = await page.evaluate(() => {
    const app = document.querySelector('[data-layout]')
    return app?.getAttribute('data-layout') ?? null
  })
  console.log(`INFO: data-layout: ${dataLayout}`)

  // In portrait, hub-landscape class should NOT be present
  const hubLandscape = await page.evaluate(() => {
    return !!document.querySelector('.hub-landscape')
  })
  console.log(`INFO: Hub landscape class (should be false): ${hubLandscape}`)

  // In portrait, hub-screen should be present
  const hubScreen = await page.evaluate(() => {
    return !!document.querySelector('.hub-screen')
  })
  console.log(`INFO: Hub screen (should be true): ${hubScreen}`)

  // In portrait, bottom nav bar should exist, no sidebar
  const hasNavBar = await page.evaluate(() => {
    return !!document.querySelector('.nav-bar')
  })
  const hasNavSidebar = await page.evaluate(() => {
    return !!document.querySelector('.nav-sidebar')
  })
  console.log(`INFO: Nav bar at bottom (portrait): ${hasNavBar}`)
  console.log(`INFO: Nav sidebar (should be false): ${hasNavSidebar}`)

  await page.screenshot({ path: '/tmp/e2e-05-portrait-regression.png' })

  const report = await diagnostics.report()
  console.log('=== Diagnostic Report ===')
  console.log(JSON.stringify(report, null, 2))

  await browser.close()

  if (report.pageErrors.length > 0) {
    console.error('FAIL: Page errors detected:')
    report.pageErrors.forEach(e => console.error(' -', e))
    process.exit(1)
  }

  if (hubLandscape) {
    console.error('FAIL: hub-landscape class found in portrait mode — landscape styles leaking into portrait')
    process.exit(1)
  }

  if (hasNavSidebar) {
    console.error('FAIL: nav-sidebar found in portrait mode — should be bottom nav bar')
    process.exit(1)
  }

  console.log('PASS: Portrait regression test complete')
  console.log('Screenshot: /tmp/e2e-05-portrait-regression.png')
})()
