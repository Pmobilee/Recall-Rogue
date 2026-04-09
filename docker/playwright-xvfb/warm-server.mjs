/**
 * Warm Container Server
 *
 * Boots Chrome + Phaser ONCE, then serves scenario test requests via HTTP.
 * Eliminates the 40s cold-start for each test — subsequent tests take ~10-15s.
 *
 * Runs inside a Docker container with Xvfb.
 * Listens on port 3200 for JSON test requests.
 *
 * API:
 *   POST /test   { scenario, viewport, wait, eval }  → runs test, returns result JSON
 *   GET  /health                                      → { ready: true, uptime, testsRun }
 *   POST /stop                                        → graceful shutdown
 *
 * Environment:
 *   DEV_SERVER  — host dev server (default: http://host.docker.internal:5173)
 *   AGENT_ID    — agent identifier
 *   PORT        — listen port (default: 3200)
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as http from 'http';

const DEV_SERVER = process.env.DEV_SERVER || 'http://host.docker.internal:5173';
const AGENT_ID = process.env.AGENT_ID || 'warm-agent';
const PORT = parseInt(process.env.PORT || '3200', 10);
const OUTPUT_DIR = '/tmp/rr-test-output';
const GAME_URL = `${DEV_SERVER}?skipOnboarding=true&devpreset=post_tutorial&turbo`;

let browser = null;
let context = null;
let page = null;
let ready = false;
let testsRun = 0;
const startTime = Date.now();

// ─── Boot Phase ──────────────────────────────────────────────

async function boot() {
  console.log(`[${AGENT_ID}] Booting warm container...`);
  const t0 = Date.now();

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: false,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl',
      '--ignore-gpu-blocklist', '--disable-gpu-process-crash-limit',
      '--window-size=1920,1080',
    ],
  });
  console.log(`[${AGENT_ID}]   ⏱ browser launched: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  context.setDefaultTimeout(120000);
  context.setDefaultNavigationTimeout(120000);
  page = await context.newPage();

  // Pre-set reduce-motion
  await page.addInitScript(() => {
    localStorage.setItem('card:reduceMotionMode', 'true');
  });

  // Navigate and wait for full game boot
  console.log(`[${AGENT_ID}] Loading game...`);
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(`[${AGENT_ID}]   ⏱ page loaded: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await page.waitForFunction(
    () => { const c = document.querySelector('canvas'); return c && c.width > 0; },
    { timeout: 60000 }
  );
  console.log(`[${AGENT_ID}]   ⏱ phaser ready: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await page.waitForFunction(
    () => typeof window.__rrScenario !== 'undefined',
    { timeout: 60000 }
  );
  console.log(`[${AGENT_ID}]   ⏱ dev tools ready: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Kill ALL CSS transitions/animations so layout dumps return final values,
  // never mid-animation transforms (prevents "card at 12x17 px" false positives).
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
      }
    `,
  });

  ready = true;
  console.log(`[${AGENT_ID}] ✓ Warm container ready in ${((Date.now() - t0) / 1000).toFixed(1)}s — listening on port ${PORT}`);
}

// ─── Test Execution ──────────────────────────────────────────

async function runTest(opts) {
  const { scenario = 'combat-basic', wait = 2000, evalJs = '' } = opts;
  const testStart = Date.now();
  const testId = `${AGENT_ID}_${scenario}_${Date.now()}`;
  const testDir = `${OUTPUT_DIR}/${testId}`;
  fs.mkdirSync(testDir, { recursive: true });

  const result = {
    testId,
    agentId: AGENT_ID,
    scenario,
    timestamp: new Date().toISOString(),
    success: false,
    screenshotPath: null,
    rrScreenshotPath: null,
    layoutDumpPath: null,
    consoleErrors: [],
    durationMs: 0,
    error: null,
  };

  try {
    // Load scenario
    const scenarioResult = await page.evaluate(async (preset) => {
      try {
        if (typeof window.__rrScenario?.load === 'function') {
          await window.__rrScenario.load(preset);
          return { success: true };
        }
        return { success: false, error: 'no __rrScenario.load' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, scenario);

    if (!scenarioResult.success) {
      console.warn(`[${AGENT_ID}] Scenario issue: ${scenarioResult.error}`);
    }

    // Wait for rendering
    await page.waitForTimeout(wait);

    // Custom eval
    if (evalJs) {
      await page.evaluate(evalJs);
      await page.waitForTimeout(500);
    }

    // Screenshot (Playwright)
    const ssPath = `${testDir}/screenshot.png`;
    await page.screenshot({ path: ssPath, fullPage: false });
    result.screenshotPath = ssPath;

    // __rrScreenshot (composited)
    try {
      const rrData = await page.evaluate(async () => {
        if (typeof window.__rrScreenshot === 'function') return await window.__rrScreenshot();
        return null;
      });
      if (rrData) {
        const b64 = rrData.replace(/^data:image\/\w+;base64,/, '');
        const rrPath = `${testDir}/rr-screenshot.jpg`;
        fs.writeFileSync(rrPath, Buffer.from(b64, 'base64'));
        result.rrScreenshotPath = rrPath;
      }
    } catch { /* non-fatal */ }

    // Layout dump
    try {
      const dump = await page.evaluate(() => {
        if (typeof window.__rrLayoutDump === 'function') return window.__rrLayoutDump();
        return null;
      });
      if (dump) {
        const dumpPath = `${testDir}/layout-dump.txt`;
        fs.writeFileSync(dumpPath, dump);
        result.layoutDumpPath = dumpPath;
      }
    } catch { /* non-fatal */ }

    result.success = true;
    testsRun++;
  } catch (err) {
    result.error = err.message;
  }

  result.durationMs = Date.now() - testStart;
  fs.writeFileSync(`${testDir}/result.json`, JSON.stringify(result, null, 2));

  console.log(`[${AGENT_ID}] Test "${scenario}" done in ${result.durationMs}ms (${result.success ? '✓' : '✗'})`);
  return result;
}

// ─── HTTP Server ─────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' && req.method === 'GET') {
    res.end(JSON.stringify({
      ready,
      agentId: AGENT_ID,
      uptime: Math.round((Date.now() - startTime) / 1000),
      testsRun,
    }));
    return;
  }

  if (req.url === '/test' && req.method === 'POST') {
    if (!ready) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Container still booting' }));
      return;
    }
    const body = await parseBody(req);
    const result = await runTest(body);
    res.end(JSON.stringify(result));
    return;
  }

  if (req.url === '/stop' && req.method === 'POST') {
    res.end(JSON.stringify({ stopped: true }));
    setTimeout(async () => {
      if (browser) await browser.close();
      process.exit(0);
    }, 100);
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found. Use GET /health or POST /test' }));
});

// ─── Main ────────────────────────────────────────────────────

async function main() {
  await boot();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[${AGENT_ID}] HTTP server listening on :${PORT}`);
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
