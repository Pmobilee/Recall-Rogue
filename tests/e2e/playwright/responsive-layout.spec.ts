import { expect, test } from '@playwright/test'

const VIEWPORTS = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]

for (const viewport of VIEWPORTS) {
  test(`hub layout fits viewport ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth > window.innerWidth + 2
    })
    expect(hasHorizontalOverflow).toBe(false)
  })
}
