/**
 * Dev-mode screenshot helper — manual canvas compositing.
 * Captures the full game view (Phaser WebGL canvas + Svelte DOM overlay) as a composited image.
 * Called via window.__terraScreenshot() from Playwright tests.
 *
 * html2canvas can't handle WebGL canvases, so we:
 * 1. Grab the Phaser canvas pixels via toDataURL() (requires preserveDrawingBuffer: true)
 * 2. Create an offscreen canvas at viewport size
 * 3. Draw the Phaser canvas scaled to viewport
 * 4. Render DOM overlay elements on top (text, buttons, cards, HP bars)
 * 5. Optionally downscale and/or encode as JPEG for smaller output
 *
 * window.__terraScreenshot()          → small JPEG (scale 0.5, quality 0.7) for tool consumption
 * window.__terraScreenshotFile()      → POSTs image to /__dev/screenshot, returns server file path
 *                                       Falls back to the data URL if the endpoint is unavailable.
 */

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

  // 1. Draw Phaser canvas (the game background + sprites)
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

  // 2. Render DOM overlay on top using SVG foreignObject trick
  // This renders actual styled HTML into a canvas without html2canvas
  const overlay = await renderDomOverlay(vw, vh);
  if (overlay) {
    ctx.drawImage(overlay, 0, 0);
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
 * Exposed as window.__terraScreenshotFile() in dev mode.
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

/** Render the DOM (excluding canvas) as an image via SVG foreignObject */
async function renderDomOverlay(width: number, height: number): Promise<HTMLImageElement | null> {
  // Clone the body, remove canvas elements, serialize to SVG foreignObject
  const clone = document.body.cloneNode(true) as HTMLElement;

  // Remove all canvas elements from clone (we drew Phaser separately)
  clone.querySelectorAll('canvas').forEach(c => c.remove());

  // Remove script tags
  clone.querySelectorAll('script').forEach(s => s.remove());

  // Inline all computed styles on every element so the SVG renders correctly
  inlineStyles(document.body, clone);

  const svgNs = 'http://www.w3.org/2000/svg';
  const xhtmlNs = 'http://www.w3.org/1999/xhtml';

  const svgMarkup = `
    <svg xmlns="${svgNs}" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <body xmlns="${xhtmlNs}" style="margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;">
          ${clone.innerHTML}
        </body>
      </foreignObject>
    </svg>`;

  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Recursively inline computed styles from source to clone */
function inlineStyles(source: Element, clone: Element): void {
  const sourceStyle = window.getComputedStyle(source);
  const cloneEl = clone as HTMLElement;
  if (cloneEl.style) {
    // Copy key visual properties
    const props = [
      'position', 'top', 'left', 'right', 'bottom', 'width', 'height',
      'margin', 'padding', 'display', 'flexDirection', 'justifyContent', 'alignItems',
      'color', 'backgroundColor', 'fontSize', 'fontFamily', 'fontWeight',
      'lineHeight', 'textAlign', 'opacity', 'zIndex', 'overflow',
      'borderRadius', 'border', 'boxShadow', 'textShadow',
      'transform', 'gap', 'gridTemplateColumns', 'gridTemplateRows',
      'backgroundImage', 'backgroundSize', 'backgroundPosition',
      'visibility', 'pointerEvents', 'whiteSpace', 'letterSpacing',
      'maxWidth', 'maxHeight', 'minWidth', 'minHeight',
      'boxSizing', 'flexGrow', 'flexShrink', 'flexBasis', 'flexWrap',
    ];
    for (const prop of props) {
      const val = sourceStyle.getPropertyValue(prop);
      if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px') {
        cloneEl.style.setProperty(prop, val);
      }
    }
  }

  const sourceChildren = source.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < sourceChildren.length && i < cloneChildren.length; i++) {
    inlineStyles(sourceChildren[i], cloneChildren[i]);
  }
}

/** Initialize the screenshot helper on window */
export function initScreenshotHelper(): void {
  const win = window as unknown as Record<string, unknown>;
  /** Small JPEG (scale 0.5, quality 0.7) for tool consumption — default args unchanged */
  win.__terraScreenshot = captureScreenshot;
  /** Full-resolution PNG saved to the downloads folder */
  win.__terraScreenshotFile = captureScreenshotToFile;
}
