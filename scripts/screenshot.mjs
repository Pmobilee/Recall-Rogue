#!/usr/bin/env node
/**
 * Fast screenshot tool for Recall Rogue visual inspection.
 * Uses Chrome's new headless mode (full WebGL support).
 *
 * Usage:
 *   node scripts/screenshot.mjs [filename] [--scenario=combat-basic] [--width=393] [--height=852]
 *
 * Examples:
 *   node scripts/screenshot.mjs                          # hub screen, mobile
 *   node scripts/screenshot.mjs combat.png --scenario=combat-basic
 *   node scripts/screenshot.mjs shop.png --scenario=shop
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=');
    return [k, v ?? 'true'];
  })
);
const filename = args.find(a => !a.startsWith('--')) || 'screenshot.png';
const width = parseInt(flags.width || '393');
const height = parseInt(flags.height || '852');
const scenario = flags.scenario || null;
const url = flags.url || 'http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial';
const wait = parseInt(flags.wait || '2000');

const outPath = resolve('.playwright-mcp', filename);

async function main() {
  // Use Chrome (not Chromium) in new headless mode — has full WebGL/GPU support
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--headless=new'],
  });
  const page = await browser.newPage({ viewport: { width, height } });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

  // Wait for hub to render
  try {
    await page.waitForSelector('[data-testid="btn-start-run"]', { timeout: 10000 });
  } catch {
    // Fallback: wait for __rrScenario
    await page.waitForFunction(() => window.__rrScenario, { timeout: 10000 });
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(300);

  if (scenario) {
    await page.evaluate((s) => window.__rrScenario.load(s), scenario);
    await page.waitForTimeout(wait);
  }

  // Direct Playwright screenshot — works in new headless since there's no RAF hang
  // with real Chrome (as opposed to Chromium)
  mkdirSync(resolve('.playwright-mcp'), { recursive: true });
  await page.screenshot({ path: outPath, timeout: 10000 });

  await browser.close();
  console.log(outPath);
}

main().catch(e => { console.error(e.message); process.exit(1); });
