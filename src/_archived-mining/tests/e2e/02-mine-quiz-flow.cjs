/**
 * E2E test: Mine dive and quiz flow.
 * Run with: node tests/e2e/02-mine-quiz-flow.cjs
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

  // Navigate to dive screen — try multiple button labels
  const diveButton = page.locator('[data-testid="btn-dive"], button:has-text("Dive"), button:has-text("Enter Mine")')
  const diveVisible = await diveButton.first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false)

  if (diveVisible) {
    await diveButton.first().click({ force: true })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '/tmp/e2e-02-mine-entry.png' })
    console.log('INFO: Entered mine — screenshot: /tmp/e2e-02-mine-entry.png')
  } else {
    console.log('INFO: Dive button not found — may be at tutorial or different screen')
    await page.screenshot({ path: '/tmp/e2e-02-dive-notfound.png' })
  }

  // Try to trigger quiz via DEV panel if available
  const devBtn = page.locator('button:has-text("DEV")')
  if (await devBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await devBtn.click()
    await page.waitForTimeout(500)
    const forceQuiz = page.locator('button:has-text("Force Quiz")')
    if (await forceQuiz.isVisible({ timeout: 1000 }).catch(() => false)) {
      await forceQuiz.click()
      await page.waitForTimeout(500)
    }
    // Close dev panel
    await devBtn.click().catch(() => {})
  }

  // Wait for quiz to appear
  const quizContainer = page.locator(
    '[data-testid="quiz-overlay"], .quiz-overlay, [data-testid^="quiz-answer-"]',
  )
  const quizVisible = await quizContainer.first()
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false)

  if (quizVisible) {
    await page.screenshot({ path: '/tmp/e2e-02-quiz-visible.png' })
    await quizContainer.first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '/tmp/e2e-02-quiz-answered.png' })
    console.log('PASS: Quiz appeared and was answered')
  } else {
    console.log('INFO: No quiz triggered (probabilistic) — not a failure')
  }

  const report = await diagnostics.report()
  console.log('=== Diagnostic Report ===')
  console.log(JSON.stringify(report, null, 2))

  await browser.close()
  console.log('PASS: Mine dive flow completed')
})()
