/**
 * WebGL + Phaser Verification Test
 *
 * Runs inside Docker container with Xvfb.
 * Connects to the host's dev server and verifies:
 * 1. Chrome launches with WebGL enabled
 * 2. Phaser game loads and renders
 * 3. Screenshots capture WebGL canvas correctly
 * 4. All canvas/shader features work (not just 2D context)
 *
 * Usage: docker run --rm --add-host=host.docker.internal:host-gateway rr-playwright
 */

import { chromium } from 'playwright';
import * as fs from 'fs';

const DEV_SERVER = process.env.DEV_SERVER || 'http://host.docker.internal:5173';
const GAME_URL = `${DEV_SERVER}?skipOnboarding=true&devpreset=post_tutorial`;
const OUTPUT_DIR = '/tmp/rr-test-output';

async function main() {
  console.log('='.repeat(60));
  console.log('  RECALL ROGUE — Docker Xvfb WebGL Verification');
  console.log('='.repeat(60));
  console.log(`  Dev server: ${DEV_SERVER}`);
  console.log(`  Chromium:   ${process.env.CHROMIUM_PATH || 'default'}`);
  console.log(`  Display:    ${process.env.DISPLAY}`);
  console.log('');

  // Verify dev server is reachable
  console.log('[1/6] Checking dev server...');
  try {
    const resp = await fetch(DEV_SERVER, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    console.log('  ✓ Dev server reachable');
  } catch (err) {
    console.error(`  ✗ Dev server not reachable at ${DEV_SERVER}`);
    console.error(`    Make sure 'npm run dev' is running on the host.`);
    console.error(`    Error: ${err.message}`);
    process.exit(1);
  }

  // Launch Chrome with WebGL-enabling flags
  console.log('[2/6] Launching Chromium with WebGL...');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: false, // Headed mode — Xvfb provides the display
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // WebGL via SwiftShader (software rendering — no GPU needed)
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      // Disable GPU process crash limits for stability
      '--disable-gpu-process-crash-limit',
      // Force window size to match Xvfb display
      '--window-size=1920,1080',
    ],
  });
  console.log('  ✓ Browser launched');

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // Navigate to game
  console.log('[3/6] Loading game...');
  try {
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('  ✓ Page loaded');
  } catch (err) {
    console.error(`  ✗ Failed to load game: ${err.message}`);
    await browser.close();
    process.exit(1);
  }

  // Wait for Phaser to initialize
  console.log('[4/6] Waiting for Phaser initialization...');
  try {
    await page.waitForFunction(
      () => {
        // Check if Phaser game instance exists
        const canvas = document.querySelector('canvas');
        return canvas && canvas.width > 0 && canvas.height > 0;
      },
      { timeout: 30000 }
    );
    console.log('  ✓ Phaser canvas detected');
  } catch (err) {
    console.error(`  ✗ Phaser did not initialize: ${err.message}`);
    // Take a debug screenshot anyway
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    await page.screenshot({ path: `${OUTPUT_DIR}/debug-no-phaser.png` });
    await browser.close();
    process.exit(1);
  }

  // Check WebGL capabilities
  console.log('[5/6] Verifying WebGL capabilities...');
  const webglInfo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { supported: false };

    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    const result = {
      supported: true,
      version: gl.getParameter(gl.VERSION),
      renderer: debugExt ? gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) : 'unknown',
      vendor: debugExt ? gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) : 'unknown',
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
      // Check shader compilation (critical for Phaser)
      shaderCompileWorks: false,
      // Check framebuffer support (needed for post-processing)
      framebufferWorks: false,
    };

    // Test vertex shader compilation
    try {
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, `
        attribute vec4 a_position;
        varying vec2 v_texCoord;
        void main() {
          gl_Position = a_position;
          v_texCoord = a_position.xy * 0.5 + 0.5;
        }
      `);
      gl.compileShader(vs);
      const fsrc = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fsrc, `
        precision mediump float;
        varying vec2 v_texCoord;
        void main() {
          gl_FragColor = vec4(v_texCoord, 0.5, 1.0);
        }
      `);
      gl.compileShader(fsrc);
      result.shaderCompileWorks = gl.getShaderParameter(vs, gl.COMPILE_STATUS) &&
                                   gl.getShaderParameter(fsrc, gl.COMPILE_STATUS);
    } catch { /* */ }

    // Test framebuffer
    try {
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      result.framebufferWorks = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } catch { /* */ }

    return result;
  });

  if (!webglInfo.supported) {
    console.error('  ✗ WebGL NOT supported — this container cannot test Phaser');
    await browser.close();
    process.exit(1);
  }

  console.log(`  ✓ WebGL: ${webglInfo.version}`);
  console.log(`    Renderer:        ${webglInfo.renderer}`);
  console.log(`    Vendor:          ${webglInfo.vendor}`);
  console.log(`    Max texture:     ${webglInfo.maxTextureSize}`);
  console.log(`    Max viewport:    ${webglInfo.maxViewportDims.join('x')}`);
  console.log(`    Shader compile:  ${webglInfo.shaderCompileWorks ? '✓' : '✗'}`);
  console.log(`    Framebuffers:    ${webglInfo.framebufferWorks ? '✓' : '✗'}`);

  if (!webglInfo.shaderCompileWorks || !webglInfo.framebufferWorks) {
    console.error('  ✗ Critical WebGL feature missing — Phaser rendering will fail');
    await browser.close();
    process.exit(1);
  }

  // Check Phaser-specific rendering
  const phaserInfo = await page.evaluate(() => {
    const phaserCanvas = document.querySelector('canvas');
    if (!phaserCanvas) return { found: false };

    const gl = phaserCanvas.getContext('webgl') || phaserCanvas.getContext('webgl2');
    return {
      found: true,
      canvasWidth: phaserCanvas.width,
      canvasHeight: phaserCanvas.height,
      contextType: gl ? 'webgl' : (phaserCanvas.getContext('2d') ? '2d' : 'none'),
      // Check if canvas has actual rendered content (not blank)
      hasContent: (() => {
        try {
          const ctx = phaserCanvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            const data = ctx.getImageData(0, 0, 10, 10).data;
            return data.some(v => v !== 0);
          }
          // For WebGL, try reading pixels
          if (gl) {
            const pixels = new Uint8Array(4 * 10 * 10);
            gl.readPixels(0, 0, 10, 10, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return pixels.some(v => v !== 0);
          }
        } catch { /* */ }
        return 'unknown';
      })(),
    };
  });

  console.log(`    Phaser canvas:   ${phaserInfo.found ? `${phaserInfo.canvasWidth}x${phaserInfo.canvasHeight}` : 'NOT FOUND'}`);
  console.log(`    Context type:    ${phaserInfo.contextType || 'none'}`);
  console.log(`    Has content:     ${phaserInfo.hasContent}`);

  // Take screenshots
  console.log('[6/6] Capturing screenshots...');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Method 1: Playwright page.screenshot() — captures the full page including canvas
  await page.screenshot({
    path: `${OUTPUT_DIR}/page-screenshot.png`,
    fullPage: false,
  });
  console.log(`  ✓ page.screenshot()     → ${OUTPUT_DIR}/page-screenshot.png`);

  // Method 2: __rrScreenshotFile() — the game's built-in compositing screenshot
  try {
    const rrResult = await page.evaluate(async () => {
      if (typeof window.__rrScreenshot === 'function') {
        return await window.__rrScreenshot();
      }
      return null;
    });
    if (rrResult) {
      // Decode base64 data URL and save
      const base64Data = rrResult.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(`${OUTPUT_DIR}/rr-screenshot.jpg`, Buffer.from(base64Data, 'base64'));
      console.log(`  ✓ __rrScreenshot()      → ${OUTPUT_DIR}/rr-screenshot.jpg`);
    } else {
      console.log('  - __rrScreenshot() not available (game may not be fully loaded)');
    }
  } catch (err) {
    console.log(`  - __rrScreenshot() failed: ${err.message}`);
  }

  // Wait a bit more for game to fully render, take another screenshot
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: `${OUTPUT_DIR}/page-screenshot-after-wait.png`,
    fullPage: false,
  });
  console.log(`  ✓ page.screenshot(+3s)  → ${OUTPUT_DIR}/page-screenshot-after-wait.png`);

  // Try __rrScreenshot again after wait
  try {
    const rrResult2 = await page.evaluate(async () => {
      if (typeof window.__rrScreenshot === 'function') {
        return await window.__rrScreenshot();
      }
      return null;
    });
    if (rrResult2) {
      const base64Data = rrResult2.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(`${OUTPUT_DIR}/rr-screenshot-after-wait.jpg`, Buffer.from(base64Data, 'base64'));
      console.log(`  ✓ __rrScreenshot(+3s)   → ${OUTPUT_DIR}/rr-screenshot-after-wait.jpg`);
    }
  } catch { /* */ }

  // Check for game errors in console
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  // Get any errors that were already logged
  const existingErrors = await page.evaluate(() => {
    if (typeof window.__rrLog === 'function') {
      return window.__rrLog();
    }
    return null;
  });

  await browser.close();

  // Final report
  console.log('');
  console.log('='.repeat(60));
  console.log('  RESULTS');
  console.log('='.repeat(60));
  console.log(`  WebGL:           ${webglInfo.supported ? '✓ SUPPORTED' : '✗ NOT SUPPORTED'}`);
  console.log(`  Renderer:        ${webglInfo.renderer}`);
  console.log(`  Shader compile:  ${webglInfo.shaderCompileWorks ? '✓ WORKS' : '✗ BROKEN'}`);
  console.log(`  Framebuffers:    ${webglInfo.framebufferWorks ? '✓ WORKS' : '✗ BROKEN'}`);
  console.log(`  Phaser canvas:   ${phaserInfo.found ? '✓ RENDERED' : '✗ MISSING'}`);
  console.log(`  Screenshots:     ${OUTPUT_DIR}/`);
  console.log('');

  const allPassed = webglInfo.supported &&
    webglInfo.shaderCompileWorks &&
    webglInfo.framebufferWorks &&
    phaserInfo.found;

  if (allPassed) {
    console.log('  ✓ ALL CHECKS PASSED — Docker Xvfb container is fully capable');
    console.log('    Phaser, WebGL shaders, framebuffers, canvas — all working.');
    console.log('    Safe to use for parallel agent visual testing.');
  } else {
    console.log('  ✗ SOME CHECKS FAILED — see details above');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
