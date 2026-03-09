import { expect, test } from '@playwright/test'

test('journal exposes share action when a run summary exists', async ({ page }) => {
  await page.addInitScript(() => {
    const summary = {
      result: 'victory',
      floorReached: 6,
      enemiesDefeated: 12,
      encountersTotal: 14,
      factsLearned: 18,
      goldEarned: 120,
      cardsCollected: 7,
      runDate: new Date().toISOString(),
      primaryDomain: 'science',
      secondaryDomain: 'history',
      timedOutCombats: 0,
      accuracy: 82,
      bestCombo: 4,
      runDurationMs: 420000,
      completedBounties: ['4+ combo', 'No deaths'],
    }
    window.localStorage.setItem('card:lastRunSummary', JSON.stringify(summary))
  })

  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Journal' }).click()

  await expect(page.getByRole('heading', { name: "Adventurer's Journal" })).toBeVisible()
  await expect(page.getByTestId('btn-share-run-journal')).toBeVisible()
})
