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
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(hasPinnedChrome ? { executablePath: chromePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'portrait',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'landscape-1080p',
      use: {
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'steam-deck',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
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
