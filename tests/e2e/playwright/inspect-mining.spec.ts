import { expect, test } from '@playwright/test'

test('inspect core stores on hub and library navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1200)

  const initialSnapshot = await page.evaluate(() => {
    const screenStore = (globalThis as Record<symbol, unknown>)[Symbol.for('rr:currentScreen')]
    let screen: string | null = null
    if (screenStore && typeof screenStore === 'object' && 'subscribe' in screenStore) {
      ;(screenStore as { subscribe: (fn: (v: string) => void) => () => void }).subscribe((v) => {
        screen = v
      })()
    }
    const playerSaveStore = (globalThis as Record<symbol, unknown>)[Symbol.for('rr:playerSave')]
    return {
      screen,
      hasPlayerSaveStore: Boolean(playerSaveStore),
    }
  })

  expect(initialSnapshot.screen).toBe('hub')
  expect(initialSnapshot.hasPlayerSaveStore).toBe(true)

  await page.getByRole('button', { name: 'Knowledge Library' }).click()
  await expect(page.getByRole('heading', { name: 'Knowledge Library' })).toBeVisible({ timeout: 20_000 })

  const libraryScreen = await page.evaluate(() => {
    const screenStore = (globalThis as Record<symbol, unknown>)[Symbol.for('rr:currentScreen')]
    if (!screenStore || typeof screenStore !== 'object' || !('subscribe' in screenStore)) return null
    let screen: string | null = null
    ;(screenStore as { subscribe: (fn: (v: string) => void) => () => void }).subscribe((v) => {
      screen = v
    })()
    return screen
  })
  expect(libraryScreen).toBe('library')
})
