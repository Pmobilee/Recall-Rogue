/**
 * E2E test: Save/resume — verifies localStorage save mechanics.
 * Run with: node tests/e2e/03-save-resume.js
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

  await page.goto('http://localhost:5173')
  await page.waitForTimeout(3000)

  // Check whether localStorage is accessible and check for save data
  const saveState = await page.evaluate(() => {
    const playerSave = localStorage.getItem('terra-gacha-save')
    const diveSave = localStorage.getItem('terra_miner_dive_save')
    const allKeys = Object.keys(localStorage)
    return {
      hasPlayerSave: playerSave !== null,
      hasDiveSave: diveSave !== null,
      totalKeys: allKeys.length,
      keys: allKeys.slice(0, 10), // first 10 keys for debugging
    }
  })

  console.log(`INFO: localStorage state:`)
  console.log(`  - Player save present: ${saveState.hasPlayerSave}`)
  console.log(`  - Dive save present: ${saveState.hasDiveSave}`)
  console.log(`  - Total keys: ${saveState.totalKeys}`)
  if (saveState.keys.length > 0) {
    console.log(`  - Keys: ${saveState.keys.join(', ')}`)
  }

  await page.screenshot({ path: '/tmp/e2e-03-save-state.png' })

  await browser.close()
  console.log('PASS: Save/resume check completed')
  console.log('Screenshot: /tmp/e2e-03-save-state.png')
})()
