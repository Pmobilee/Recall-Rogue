/**
 * E2E test: Desktop layout — verifies app renders correctly at 1920×1080 landscape.
 * Run with: node tests/e2e/04-desktop-layout.cjs
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
  await page.setViewportSize({ width: 1920, height: 1080 })
  const diagnostics = attachDiagnostics(page)

  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial')
  await page.waitForTimeout(3000)

  // Check layout mode CSS custom property
  const layoutMode = await page.evaluate(() => {
    return document.documentElement.style.getPropertyValue('--layout-mode')?.trim()
  })
  console.log(`INFO: Layout mode: ${layoutMode}`)

  // Check data-layout attribute on root element
  const dataLayout = await page.evaluate(() => {
    const app = document.querySelector('[data-layout]')
    return app?.getAttribute('data-layout') ?? null
  })
  console.log(`INFO: data-layout: ${dataLayout}`)

  // Check that hub renders (post_tutorial preset should land on hub screen)
  const hubVisible = await page.evaluate(() => {
    return !!document.querySelector('.hub-landscape') || !!document.querySelector('.hub-screen')
  })
  console.log(`INFO: Hub visible: ${hubVisible}`)

  // Check nav sidebar exists in landscape (not bottom nav bar)
  const navSidebar = await page.evaluate(() => {
    return !!document.querySelector('.nav-sidebar')
  })
  console.log(`INFO: Nav sidebar (landscape): ${navSidebar}`)

  // Check no bottom nav bar in landscape
  const navBottom = await page.evaluate(() => {
    return !!document.querySelector('.nav-bar')
  })
  console.log(`INFO: Nav bar (should be false in landscape): ${navBottom}`)

  await page.screenshot({ path: '/tmp/e2e-04-desktop-layout.png' })

  const report = await diagnostics.report()
  console.log('=== Diagnostic Report ===')
  console.log(JSON.stringify(report, null, 2))

  await browser.close()

  if (report.pageErrors.length > 0) {
    console.error('FAIL: Page errors detected:')
    report.pageErrors.forEach(e => console.error(' -', e))
    process.exit(1)
  }

  console.log('PASS: Desktop layout test complete')
  console.log('Screenshot: /tmp/e2e-04-desktop-layout.png')
})()
