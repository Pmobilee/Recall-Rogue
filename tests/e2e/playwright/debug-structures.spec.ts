import { test } from '@playwright/test';

test('debug stores', async ({ page }) => {
  await page.goto('/?skipOnboarding=true');
  const debug = await page.evaluate(() => {
    const debugFunc = window.__terraDebug;
    if (typeof debugFunc !== 'function') return null;
    return debugFunc();
  });
  console.log('debug snapshot:', JSON.stringify(debug, null, 2));
});
