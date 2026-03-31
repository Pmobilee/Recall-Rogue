/**
 * Dev-mode screenshot helper — html2canvas compositing.
 * Captures the full game view (Phaser WebGL canvas + Svelte DOM overlay) as a composited image.
 * Called via window.__rrScreenshot() and window.__rrScreenshotFile() from Playwright tests.
 * Backward compat aliases: window.__terraScreenshot and window.__terraScreenshotFile (remove after 2026-06-01).
 *
 * Compositing strategy:
 * 1. Grab the Phaser canvas pixels directly via drawImage() (WebGL canvas, requires
 *    preserveDrawingBuffer: true in the Phaser game config)
 * 2. Use html2canvas to render the full DOM (all Svelte overlays: cards, HP bars, buttons, menus)
 *    with all canvas elements ignored — html2canvas handles CSS variables, images, fonts,
 *    pseudo-elements, and background images that the old SVG foreignObject approach missed
 * 3. Draw Phaser canvas first (background layer), then html2canvas result on top
 * 4. Optionally downscale and encode as JPEG for smaller output
 *
 * window.__rrScreenshot()     → small JPEG (scale 0.5, quality 0.7) for tool consumption
 * window.__rrScreenshotFile() → POSTs image to /__dev/screenshot, returns server file path.
 *                                   Falls back to the data URL if the endpoint is unavailable.
 */

import html2canvas from 'html2canvas';

/** Options for captureScreenshot */
export interface ScreenshotOptions {
  /** Scale factor applied to the output canvas (default: 0.5) */
  scale?: number;
  /** JPEG quality 0–1, only used when format is 'jpeg' (default: 0.7) */
  quality?: number;
  /** Output format (default: 'jpeg') */
  format?: 'png' | 'jpeg';
}

/**
 * Capture full page as a base64 data URL string.
 * Defaults to a downscaled JPEG (~50KB) suitable for tool consumption.
 * Pass `{ scale: 1, format: 'png' }` for full-resolution PNG.
 */
export async function captureScreenshot(options: ScreenshotOptions = {}): Promise<string> {
  const { scale = 0.5, quality = 0.7, format = 'jpeg' } = options;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Create full-size composite canvas
  const full = document.createElement('canvas');
  full.width = vw;
  full.height = vh;
  const ctx = full.getContext('2d')!;

  // Fill background
  ctx.fillStyle = '#0D1117';
  ctx.fillRect(0, 0, vw, vh);

  // 1. Draw Phaser canvas (WebGL — must be captured via drawImage before html2canvas runs,
  //    since html2canvas will skip it via ignoreElements anyway)
  const phaserCanvas = document.querySelector('#phaser-container canvas') as HTMLCanvasElement | null;
  if (phaserCanvas) {
    const container = document.getElementById('phaser-container');
    if (container) {
      const rect = container.getBoundingClientRect();
      ctx.drawImage(phaserCanvas, rect.left, rect.top, rect.width, rect.height);
    } else {
      ctx.drawImage(phaserCanvas, 0, 0, vw, vh);
    }
  }

  // 2. Use html2canvas to render the Svelte DOM overlay on top.
  //    - backgroundColor: null → transparent so the Phaser layer shows through
  //    - ignoreElements: skip all <canvas> elements (Phaser canvas drawn above)
  //    - useCORS: allow cross-origin images (card art, sprites)
  //    - scale: 1 — we handle downscaling ourselves below
  //
  //    IMPORTANT: Temporarily make DOM backgrounds transparent so html2canvas
  //    doesn't paint a solid dark layer over the Phaser canvas we drew above.
  //    We restore them after capture.
  try {
    // Temporarily clear ALL opaque backgrounds that would cover the Phaser layer.
    // html2canvas faithfully renders DOM backgrounds, which paint over our
    // manually-composited Phaser canvas. We clear them, capture, then restore.
    const bgOverrides: { el: HTMLElement; prop: string; orig: string }[] = [];
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.tagName === 'CANVAS') continue;
      const htmlEl = el as HTMLElement;
      const style = getComputedStyle(htmlEl);
      const bg = style.backgroundColor;
      // Clear any non-transparent background on elements covering the viewport
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width >= vw * 0.8 && rect.height >= vh * 0.5) {
          bgOverrides.push({ el: htmlEl, prop: 'backgroundColor', orig: htmlEl.style.backgroundColor });
          htmlEl.style.backgroundColor = 'transparent';
        }
      }
    }
    // Also clear html and body
    for (const el of [document.documentElement, document.body]) {
      bgOverrides.push({ el, prop: 'backgroundColor', orig: el.style.backgroundColor });
      el.style.backgroundColor = 'transparent';
    }

    const domCanvas = await html2canvas(document.body, {
      backgroundColor: null,
      ignoreElements: (el: Element) => el.tagName === 'CANVAS',
      useCORS: true,
      logging: false,
      scale: 1,
      width: vw,
      height: vh,
    });
    ctx.drawImage(domCanvas, 0, 0);

    // Restore backgrounds
    for (const { el, prop, orig } of bgOverrides) {
      (el.style as any)[prop] = orig;
    }
  } catch (err) {
    // html2canvas failed — log and continue with Phaser-only capture
    console.warn('[screenshotHelper] html2canvas failed (likely CSS color() function incompatibility). DOM overlay will be missing from screenshot:', err);
  }

  // 3. If scale != 1, draw the full canvas onto a smaller output canvas
  let output: HTMLCanvasElement;
  if (scale !== 1) {
    output = document.createElement('canvas');
    output.width = Math.round(vw * scale);
    output.height = Math.round(vh * scale);
    const outCtx = output.getContext('2d')!;
    outCtx.drawImage(full, 0, 0, output.width, output.height);
  } else {
    output = full;
  }

  // 4. Encode to requested format
  if (format === 'jpeg') {
    return output.toDataURL('image/jpeg', quality);
  }
  return output.toDataURL('image/png');
}

/**
 * Capture a screenshot and save it to disk via the Vite dev server endpoint.
 * POSTs the image as a base64 data URL to /__dev/screenshot, which writes it to
 * /tmp/terra-screenshot.jpg (or .png). Returns the server-side file path.
 *
 * If the endpoint is unavailable (e.g. production build or endpoint not running),
 * falls back to returning the data URL directly.
 *
 * Exposed as window.__rrScreenshotFile() in dev mode.
 */
export async function captureScreenshotToFile(): Promise<string> {
  const dataUrl = await captureScreenshot({ scale: 0.5, quality: 0.7, format: 'jpeg' });

  try {
    const response = await fetch('/__dev/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataUrl }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json() as { path: string };
    return json.path;
  } catch {
    // Not in dev mode or endpoint unavailable — return data URL as fallback
    return dataUrl;
  }
}

/** Initialize the screenshot helper on window */
export function initScreenshotHelper(): void {
  const win = window as unknown as Record<string, unknown>;
  /** Small JPEG (scale 0.5, quality 0.7) for tool consumption — default args unchanged */
  win.__rrScreenshot = captureScreenshot;
  /** POSTs to /__dev/screenshot, returns server-side file path */
  win.__rrScreenshotFile = captureScreenshotToFile;

  // Backward compat — remove after 2026-06-01
  (window as any).__terraScreenshot = (window as any).__rrScreenshot;
  (window as any).__terraScreenshotFile = (window as any).__rrScreenshotFile;
}
