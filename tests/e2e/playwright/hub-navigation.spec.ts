import { expect, test } from '@playwright/test'

test('hub nav reaches core destinations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1200)

  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

  await page.getByRole('button', { name: 'Library' }).click()
  await expect(page.getByRole('heading', { name: 'Knowledge Library' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.getByRole('button', { name: 'Profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.getByRole('button', { name: 'Journal' }).click()
  await expect(page.getByRole('heading', { name: /Adventurer.s Journal/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await expect(page.getByTestId('btn-start-run')).toBeVisible()
})
