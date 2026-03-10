import { expect, test } from '@playwright/test'

test('main menu boots', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('region', { name: 'Camp hub' })).toBeVisible()
})
