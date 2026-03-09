import { expect, test } from '@playwright/test'

test('hub nav reaches core destinations', async ({ page }) => {
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Primary navigation' })
  await expect(nav).toBeVisible()

  await nav.getByRole('button', { name: 'Library' }).click()
  await expect(page.getByRole('heading', { name: 'Knowledge Library' })).toBeVisible({ timeout: 15_000 })

  await nav.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  await nav.getByRole('button', { name: 'Profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()

  await nav.getByRole('button', { name: 'Journal' }).click()
  await expect(page.getByRole('heading', { name: "Adventurer's Journal" })).toBeVisible()

  await nav.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByTestId('btn-start-run')).toBeVisible()
})
