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

/**
 * Execute a single action step against the page.
 * Returns a log entry describing what happened.
 *
 * Supported action types:
 *   { type: 'click',       selector, button?, clickCount?, force?, waitAfter? }  — native mouse click (emits pointerdown/up)
 *   { type: 'dblclick',    selector, waitAfter? }
 *   { type: 'hover',       selector, waitAfter? }
 *   { type: 'mousedown',   selector, waitAfter? }  — press without release (long-press init)
 *   { type: 'mouseup',     selector, waitAfter? }  — release after mousedown
 *   { type: 'drag',        from, to, steps?, waitAfter? }  — drag with intermediate steps
 *   { type: 'type',        selector, text, waitAfter? }   — keystroke-level typing
 *   { type: 'fill',        selector, text, waitAfter? }   — instant fill
 *   { type: 'key',         key, waitAfter? }              — press a named key (Enter, Escape, etc.)
 *   { type: 'wait',        ms }                           — sleep
 *   { type: 'waitFor',     selector, state?, timeout? }   — wait for element (visible by default)
 *   { type: 'scenario',    preset }                       — load an __rrScenario preset
 *   { type: 'rrPlay',      method, args? }                — call window.__rrPlay[method](...args)
 *   { type: 'eval',        js }                           — evaluate arbitrary JS in page
 *   { type: 'screenshot',  name }                         — save intermediate screenshot.png + layout-dump.txt
 *   { type: 'rrScreenshot',name }                         — save intermediate __rrScreenshot composite
 *   { type: 'layoutDump',  name }                         — save intermediate layout dump only
 *   { type: 'assert',      selector, exists?, text? }     — fail the action on mismatch
 *   { type: 'url' }                                       — capture current page.url() into log
 */
async function executeAction(page, action, testDir) {
  const a = action || {};
  const log = { type: a.type, ok: true };
  try {
    switch (a.type) {
      case 'click':
        await page.click(a.selector, {
          button: a.button || 'left',
          clickCount: a.clickCount || 1,
          force: a.force || false,
          timeout: a.timeout || 15000,
        });
        log.selector = a.selector;
        break;
      case 'dblclick':
        await page.dblclick(a.selector, { timeout: a.timeout || 15000 });
        log.selector = a.selector;
        break;
      case 'hover':
        await page.hover(a.selector, { timeout: a.timeout || 15000 });
        log.selector = a.selector;
        break;
      case 'mousedown': {
        const el = await page.waitForSelector(a.selector, { timeout: a.timeout || 15000 });
        const box = await el.boundingBox();
        if (!box) throw new Error(`no bounding box for ${a.selector}`);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        log.selector = a.selector;
        break;
      }
      case 'mouseup':
        if (a.selector) {
          const el = await page.waitForSelector(a.selector, { timeout: a.timeout || 15000 });
          const box = await el.boundingBox();
          if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        }
        await page.mouse.up();
        break;
      case 'drag': {
        // from / to are either selectors or {x,y}
        const resolvePoint = async (p) => {
          if (typeof p === 'string') {
            const el = await page.waitForSelector(p, { timeout: 15000 });
            const box = await el.boundingBox();
            return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          }
          return p;
        };
        const from = await resolvePoint(a.from);
        const to = await resolvePoint(a.to);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        const steps = a.steps || 10;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        }
        await page.mouse.up();
        log.from = from; log.to = to;
        break;
      }
      case 'type':
        await page.type(a.selector, a.text || '', { timeout: a.timeout || 15000 });
        log.selector = a.selector;
        break;
      case 'fill':
        await page.fill(a.selector, a.text || '', { timeout: a.timeout || 15000 });
        log.selector = a.selector;
        break;
      case 'key':
        await page.keyboard.press(a.key);
        log.key = a.key;
        break;
      case 'wait':
        await page.waitForTimeout(a.ms || 500);
        log.ms = a.ms || 500;
        break;
      case 'waitFor':
        await page.waitForSelector(a.selector, {
          state: a.state || 'visible',
          timeout: a.timeout || 15000,
        });
        log.selector = a.selector;
        break;
      case 'scenario': {
        const r = await page.evaluate(async (preset) => {
          if (typeof window.__rrScenario?.load !== 'function') {
            return { success: false, error: 'no __rrScenario.load' };
          }
          try { await window.__rrScenario.load(preset); return { success: true }; }
          catch (e) { return { success: false, error: e.message }; }
        }, a.preset);
        if (!r.success) throw new Error(`scenario load failed: ${r.error}`);
        log.preset = a.preset;
        break;
      }
      case 'rrPlay': {
        const r = await page.evaluate(async ({ method, args }) => {
          if (!window.__rrPlay || typeof window.__rrPlay[method] !== 'function') {
            return { error: `__rrPlay.${method} not available` };
          }
          try {
            const out = await window.__rrPlay[method](...(args || []));
            return { ok: true, out };
          } catch (e) {
            return { error: e.message };
          }
        }, { method: a.method, args: a.args || [] });
        if (r.error) throw new Error(r.error);
        log.method = a.method; log.out = r.out;
        break;
      }
      case 'eval': {
        const out = await page.evaluate(a.js);
        log.out = out;
        break;
      }
      case 'screenshot': {
        const name = a.name || `step-${Date.now()}`;
        const p = `${testDir}/${name}.png`;
        await page.screenshot({ path: p, fullPage: false });
        // Also save a layout dump alongside intermediate screenshots (ground truth + structure)
        try {
          const dump = await page.evaluate(() => window.__rrLayoutDump?.());
          if (dump) fs.writeFileSync(`${testDir}/${name}.layout.txt`, dump);
        } catch { /* non-fatal */ }
        log.name = name; log.path = p;
        break;
      }
      case 'rrScreenshot': {
        const name = a.name || `step-${Date.now()}`;
        const data = await page.evaluate(async () => window.__rrScreenshot?.());
        if (data) {
          const b64 = String(data).replace(/^data:image\/\w+;base64,/, '');
          const p = `${testDir}/${name}.rr.jpg`;
          fs.writeFileSync(p, Buffer.from(b64, 'base64'));
          log.name = name; log.path = p;
        }
        break;
      }
      case 'layoutDump': {
        const name = a.name || `step-${Date.now()}`;
        const dump = await page.evaluate(() => window.__rrLayoutDump?.());
        if (dump) {
          const p = `${testDir}/${name}.layout.txt`;
          fs.writeFileSync(p, dump);
          log.name = name; log.path = p;
        }
        break;
      }
      case 'assert': {
        const r = await page.evaluate(({ selector, expectText }) => {
          const el = document.querySelector(selector);
          if (!el) return { exists: false };
          return { exists: true, text: (el.textContent || '').trim() };
        }, { selector: a.selector, expectText: a.text });
        if (a.exists === true && !r.exists) throw new Error(`assert: ${a.selector} not found`);
        if (a.exists === false && r.exists) throw new Error(`assert: ${a.selector} should not exist`);
        if (a.text && !(r.text || '').includes(a.text)) {
          throw new Error(`assert: ${a.selector} text missing "${a.text}" — got "${r.text}"`);
        }
        log.selector = a.selector; log.result = r;
        break;
      }
      case 'url':
        log.url = page.url();
        break;
      default:
        throw new Error(`unknown action type: ${a.type}`);
    }
    if (a.waitAfter) await page.waitForTimeout(a.waitAfter);
  } catch (err) {
    log.ok = false;
    log.error = err.message;
  }
  return log;
}

async function runTest(opts) {
  const { scenario = 'combat-basic', wait = 2000, evalJs = '', actions = [], stopOnError = true } = opts;
  const testStart = Date.now();
  const testId = `${AGENT_ID}_${scenario}_${Date.now()}`;
  const testDir = `${OUTPUT_DIR}/${testId}`;
  fs.mkdirSync(testDir, { recursive: true });

  // Per-test console error collector (cleared at test start)
  const perTestErrors = [];
  const errorHandler = (msg) => {
    if (msg.type() === 'error') perTestErrors.push(msg.text());
  };
  page.on('console', errorHandler);

  const result = {
    testId,
    agentId: AGENT_ID,
    scenario,
    timestamp: new Date().toISOString(),
    success: false,
    screenshotPath: null,
    rrScreenshotPath: null,
    layoutDumpPath: null,
    actionLog: [],
    consoleErrors: [],
    durationMs: 0,
    error: null,
  };

  try {
    // Load scenario (unless caller passed scenario: null/'none' to skip)
    if (scenario && scenario !== 'none') {
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
    }

    // Wait for rendering
    await page.waitForTimeout(wait);

    // Custom eval (legacy single-string path — still supported)
    if (evalJs) {
      await page.evaluate(evalJs);
      await page.waitForTimeout(500);
    }

    // New: sequential actions
    for (const action of actions) {
      const entry = await executeAction(page, action, testDir);
      result.actionLog.push(entry);
      console.log(`[${AGENT_ID}]   action ${entry.type} ${entry.ok ? '✓' : '✗ ' + entry.error}`);
      if (!entry.ok && stopOnError) {
        throw new Error(`action ${entry.type} failed: ${entry.error}`);
      }
    }

    // Final screenshot (Playwright native)
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

  page.off('console', errorHandler);
  result.consoleErrors = perTestErrors;
  result.durationMs = Date.now() - testStart;
  fs.writeFileSync(`${testDir}/result.json`, JSON.stringify(result, null, 2));

  console.log(`[${AGENT_ID}] Test "${scenario}" done in ${result.durationMs}ms (${result.success ? '✓' : '✗'}) — ${actions.length} actions`);
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
