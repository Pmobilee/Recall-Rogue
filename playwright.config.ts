import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const chromePath = '/opt/google/chrome/chrome';
const hasPinnedChrome = fs.existsSync(chromePath);

export default defineConfig({
  testDir: 'tests/e2e/playwright',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'],
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(hasPinnedChrome ? { executablePath: chromePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
  ...(process.env.PLAYWRIGHT_WEBSERVER === '1'
    ? {
      webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
    }
    : {}),
  outputDir: '/tmp/pw-results/',
});
