/**
 * Docker Visual Test Runner
 *
 * Generic visual testing script that runs inside the Docker container.
 * Loads a scenario, captures screenshots + layout dump, reports results.
 *
 * Environment variables:
 *   DEV_SERVER     — Host dev server URL (default: http://host.docker.internal:5173)
 *   SCENARIO       — Scenario preset to load (default: 'combat-basic')
 *   VIEWPORT_W     — Viewport width (default: 1920)
 *   VIEWPORT_H     — Viewport height (default: 1080)
 *   WAIT_MS        — Wait time after scenario load in ms (default: 5000)
 *   AGENT_ID       — Agent identifier for logging (default: 'docker-agent')
 *   CUSTOM_EVAL    — Optional JS to evaluate after scenario load
 *
 * Output (to /tmp/rr-test-output/):
 *   screenshot.png       — Playwright page screenshot
 *   rr-screenshot.jpg    — __rrScreenshot() composited capture
 *   layout-dump.txt      — __rrLayoutDump() text output
 *   webgl-info.json      — WebGL capabilities
 *   result.json          — Test result summary
 */

import { chromium } from 'playwright';
import * as fs from 'fs';

const DEV_SERVER = process.env.DEV_SERVER || 'http://host.docker.internal:5173';
const SCENARIO = process.env.SCENARIO || 'combat-basic';
const VIEWPORT_W = parseInt(process.env.VIEWPORT_W || '1920', 10);
const VIEWPORT_H = parseInt(process.env.VIEWPORT_H || '1080', 10);
const WAIT_MS = parseInt(process.env.WAIT_MS || '2000', 10);
const AGENT_ID = process.env.AGENT_ID || 'docker-agent';
const CUSTOM_EVAL = process.env.CUSTOM_EVAL || '';
const OUTPUT_DIR = '/tmp/rr-test-output';

const GAME_URL = `${DEV_SERVER}?skipOnboarding=true&devpreset=post_tutorial&turbo`;

async function main() {
  const startTime = Date.now();
  const result = {
    agentId: AGENT_ID,
    scenario: SCENARIO,
    viewport: `${VIEWPORT_W}x${VIEWPORT_H}`,
    timestamp: new Date().toISOString(),
    success: false,
    screenshotPath: null,
    rrScreenshotPath: null,
    layoutDumpPath: null,
    webglInfo: null,
    phaserInfo: null,
    consoleErrors: [],
    durationMs: 0,
    error: null,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`[${AGENT_ID}] Starting visual test: scenario="${SCENARIO}" viewport=${VIEWPORT_W}x${VIEWPORT_H}`);
  const t = (label) => console.log(`[${AGENT_ID}]   ⏱ ${label}: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  let browser;
  try {
    // Launch browser
    t('container ready');
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-process-crash-limit',
        `--window-size=${VIEWPORT_W},${VIEWPORT_H}`,
      ],
    });

    t('browser launched');
    const context = await browser.newContext({
      viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
    });
    // Increase all Playwright timeouts for Docker SwiftShader (CPU-bound rendering)
    context.setDefaultTimeout(120000);
    context.setDefaultNavigationTimeout(120000);
    const page = await context.newPage();

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        result.consoleErrors.push(msg.text());
      }
    });

    // Pre-set reduce-motion to disable particles, lighting animations, mood system
    await page.addInitScript(() => {
      localStorage.setItem('card:reduceMotionMode', 'true');
    });

    // Navigate to game (turbo mode via URL skips animation delays)
    console.log(`[${AGENT_ID}] Loading game (turbo + reduce-motion)...`);
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    t('page loaded');

    // Wait for Phaser canvas (longer timeout for parallel Docker runs)
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas');
        return canvas && canvas.width > 0 && canvas.height > 0;
      },
      { timeout: 60000 }
    );
    t('phaser canvas ready');

    // Wait for dev tools to initialize (longer timeout for parallel runs — SwiftShader is CPU-heavy)
    await page.waitForFunction(
      () => typeof window.__rrScenario !== 'undefined',
      { timeout: 60000 }
    );
    t('dev tools ready');

    // Load scenario
    console.log(`[${AGENT_ID}] Loading scenario: ${SCENARIO}`);
    const scenarioResult = await page.evaluate(async (preset) => {
      try {
        // Check if it's a preset name or a custom config
        if (typeof window.__rrScenario?.load === 'function') {
          await window.__rrScenario.load(preset);
          return { success: true };
        }
        return { success: false, error: '__rrScenario.load not available' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, SCENARIO);

    if (!scenarioResult.success) {
      console.warn(`[${AGENT_ID}] Scenario load issue: ${scenarioResult.error}`);
      // Continue anyway — some scenarios may not exist, but we can still screenshot the current state
    }

    // Wait for rendering to settle
    console.log(`[${AGENT_ID}] Waiting ${WAIT_MS}ms for rendering...`);
    await page.waitForTimeout(WAIT_MS);

    // Run custom eval if provided
    if (CUSTOM_EVAL) {
      console.log(`[${AGENT_ID}] Running custom eval...`);
      await page.evaluate(CUSTOM_EVAL);
      await page.waitForTimeout(1000);
    }

    // Capture WebGL info
    result.webglInfo = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { supported: false };
      const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        supported: true,
        version: gl.getParameter(gl.VERSION),
        renderer: debugExt ? gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) : 'unknown',
      };
    });

    // Capture Phaser info
    result.phaserInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { found: false };
      return {
        found: true,
        width: canvas.width,
        height: canvas.height,
      };
    });

    // 1. Playwright screenshot
    const screenshotPath = `${OUTPUT_DIR}/screenshot.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshotPath = screenshotPath;
    console.log(`[${AGENT_ID}] ✓ page.screenshot() saved`);

    // 2. __rrScreenshot() composited capture
    try {
      const rrData = await page.evaluate(async () => {
        if (typeof window.__rrScreenshot === 'function') {
          return await window.__rrScreenshot();
        }
        return null;
      });
      if (rrData) {
        const base64 = rrData.replace(/^data:image\/\w+;base64,/, '');
        const rrPath = `${OUTPUT_DIR}/rr-screenshot.jpg`;
        fs.writeFileSync(rrPath, Buffer.from(base64, 'base64'));
        result.rrScreenshotPath = rrPath;
        console.log(`[${AGENT_ID}] ✓ __rrScreenshot() saved`);
      }
    } catch (err) {
      console.warn(`[${AGENT_ID}] __rrScreenshot() failed: ${err.message}`);
    }

    // 3. Layout dump
    try {
      const layoutDump = await page.evaluate(() => {
        if (typeof window.__rrLayoutDump === 'function') {
          return window.__rrLayoutDump();
        }
        return null;
      });
      if (layoutDump) {
        const dumpPath = `${OUTPUT_DIR}/layout-dump.txt`;
        fs.writeFileSync(dumpPath, layoutDump);
        result.layoutDumpPath = dumpPath;
        console.log(`[${AGENT_ID}] ✓ __rrLayoutDump() saved`);
      }
    } catch (err) {
      console.warn(`[${AGENT_ID}] __rrLayoutDump() failed: ${err.message}`);
    }

    result.success = true;
    console.log(`[${AGENT_ID}] ✓ All captures complete`);

  } catch (err) {
    result.error = err.message;
    console.error(`[${AGENT_ID}] ✗ Error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  result.durationMs = Date.now() - startTime;

  // Save result summary
  fs.writeFileSync(`${OUTPUT_DIR}/result.json`, JSON.stringify(result, null, 2));
  console.log(`[${AGENT_ID}] Done in ${result.durationMs}ms`);

  // Print summary
  console.log('');
  console.log(`${'─'.repeat(50)}`);
  console.log(`  Scenario:    ${result.scenario}`);
  console.log(`  Success:     ${result.success ? '✓' : '✗'}`);
  console.log(`  Screenshot:  ${result.screenshotPath ? '✓' : '✗'}`);
  console.log(`  RR Screenshot: ${result.rrScreenshotPath ? '✓' : '✗'}`);
  console.log(`  Layout Dump: ${result.layoutDumpPath ? '✓' : '✗'}`);
  console.log(`  WebGL:       ${result.webglInfo?.supported ? '✓' : '✗'}`);
  console.log(`  Errors:      ${result.consoleErrors.length}`);
  console.log(`  Duration:    ${result.durationMs}ms`);
  console.log(`${'─'.repeat(50)}`);

  if (!result.success) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
