import { expect, test } from '@playwright/test'

test('main menu boots', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
})
