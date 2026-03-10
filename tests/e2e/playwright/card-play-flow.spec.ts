import { expect, test } from '@playwright/test'

test('three-stage card commit flow works', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('card:onboardingState', JSON.stringify({
      hasCompletedOnboarding: true,
      hasSeenCardTapTooltip: true,
      hasSeenCastTooltip: true,
      hasSeenAnswerTooltip: true,
      hasSeenEndTurnTooltip: true,
      hasSeenAPTooltip: true,
      runsCompleted: 5,
    }))
  })

  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1200)
  await page.getByTestId('btn-start-run').click()
  await page.getByTestId('domain-card-natural_sciences').click()
  await page.getByTestId('domain-card-history').click()
  await page.getByTestId('btn-start-run').click()
  await page.getByTestId('archetype-balanced').click()

  await expect(page.getByTestId('card-hand-0')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('card-hand-0').click()
  await page.getByTestId('card-hand-0').click()

  await expect(page.getByTestId('quiz-answer-0')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('quiz-answer-0').click()

  await expect(page.getByTestId('btn-end-turn')).toBeVisible()
})
