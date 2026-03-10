import { expect, test } from '@playwright/test'

test('hub nav reaches core destinations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1200)

  await expect(page.getByRole('region', { name: 'Camp hub' })).toBeVisible()

  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Knowledge Library' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.getByRole('button', { name: 'Journal', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Adventurer.s Journal/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await expect(page.getByTestId('btn-start-run')).toBeVisible()
})
