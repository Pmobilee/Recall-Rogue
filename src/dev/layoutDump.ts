/**
 * Unified layout dump — merges Phaser scene graph + DOM elements into
 * a single text representation with pixel coordinates.
 * Gives LLM agents precise spatial understanding without relying on screenshots.
 * DEV MODE ONLY.
 *
 * Usage (from browser_evaluate):
 *   window.__rrLayoutDump()
 *
 * Output format: plain text with pixel coordinates, hierarchy via indentation,
 * plus spatial relationship analysis between layers. An agent can find any element
 * in under 2 seconds of reading.
 */


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutElement {
  /** Human-readable label: "[Type] name" */
  label: string;
  /** Pixel X of the element's centre (or top-left for DOM). */
  x: number;
  /** Pixel Y of the element's centre (or top-left for DOM). */
  y: number;
  /** Width in pixels (0 if unknown). */
  w: number;
  /** Height in pixels (0 if unknown). */
  h: number;
  /** Phaser depth or DOM z-index approximation. */
  depth: number;
  /** Extra descriptor (text content, sprite frame, visibility note, etc.) */
  detail: string;
  /** Layer source. */
  layer: 'phaser' | 'dom';
}

// ---------------------------------------------------------------------------
// Phaser layer
// ---------------------------------------------------------------------------

/** Extract a readable name from a Phaser GameObject, preferring .name then scene-property reflection. */
function getPhaserObjectName(
  obj: Record<string, unknown>,
  sceneProps: Map<unknown, string>,
): string {
  const fromMap = sceneProps.get(obj);
  if (fromMap) return fromMap;
  const name = obj['name'];
  if (typeof name === 'string' && name.trim()) return name;
  return '';
}

/** Return bounding-box centre + dimensions for a Phaser GameObject. */
function getPhaserBounds(obj: Record<string, unknown>): { x: number; y: number; w: number; h: number } {
  const x = typeof obj['x'] === 'number' ? obj['x'] : 0;
  const y = typeof obj['y'] === 'number' ? obj['y'] : 0;
  const dw = typeof obj['displayWidth'] === 'number' ? obj['displayWidth'] : 0;
  const dh = typeof obj['displayHeight'] === 'number' ? obj['displayHeight'] : 0;

  // If displayWidth is zero, check for stored drawn bounds (Graphics objects that track their draw rects)
  if (dw === 0 && dh === 0) {
    try {
      const drawnBounds = (obj as any).getData?.('drawnBounds') as { x?: number; y?: number; w?: number; h?: number } | undefined;
      if (drawnBounds && (drawnBounds.w ?? 0) > 0) {
        return {
          x: Math.round(drawnBounds.x ?? 0),
          y: Math.round(drawnBounds.y ?? 0),
          w: Math.round(drawnBounds.w ?? 0),
          h: Math.round(drawnBounds.h ?? 0),
        };
      }
    } catch {
      // getData() may not exist — ignore
    }
  }

  // If displayWidth is still zero, try getBounds() for Graphics objects
  if (dw === 0 && dh === 0) {
    try {
      const bounds = (obj as any).getBounds?.() as { x?: number; y?: number; width?: number; height?: number } | undefined;
      if (bounds && (bounds.width ?? 0) > 0) {
        const bx = bounds.x ?? x;
        const by = bounds.y ?? y;
        const bw = bounds.width ?? 0;
        const bh = bounds.height ?? 0;
        return { x: bx + bw / 2, y: by + bh / 2, w: Math.round(bw), h: Math.round(bh) };
      }
    } catch {
      // getBounds() may throw on certain objects — ignore
    }
  }

  return { x: Math.round(x), y: Math.round(y), w: Math.round(dw), h: Math.round(dh) };
}

/** Extra detail string for a Phaser GameObject (text content, frame name, child count). */
function getPhaserDetail(obj: Record<string, unknown>): string {
  const type = String(obj['type'] ?? '');
  const parts: string[] = [];

  if (type === 'Text' || type === 'BitmapText') {
    const text = obj['text'];
    if (typeof text === 'string' && text.trim()) {
      const truncated = text.length > 40 ? text.substring(0, 40) + '…' : text;
      parts.push(`"${truncated}"`);
    }
  }

  if (type === 'Sprite' || type === 'Image') {
    const frameName = (obj as any).frame?.name;
    if (typeof frameName === 'string' && frameName && frameName !== '__DEFAULT') {
      parts.push(`frame:${frameName}`);
    }
    const texture = (obj as any).texture?.key;
    if (typeof texture === 'string' && texture && texture !== '__DEFAULT' && texture !== '__MISSING') {
      parts.push(`tex:${texture}`);
    }
  }

  if (type === 'Container') {
    const list = (obj as any).list;
    if (Array.isArray(list)) parts.push(`children:${list.length}`);
  }

  const alpha = obj['alpha'];
  if (typeof alpha === 'number' && alpha < 1) parts.push(`α:${alpha.toFixed(2)}`);

  const angle = obj['angle'];
  if (typeof angle === 'number' && Math.abs(angle) > 0.5) parts.push(`rot:${angle.toFixed(0)}°`);

  return parts.join('  ');
}

/**
 * Build a Map from scene instance → property name for all Phaser GameObject
 * properties discovered via reflection on the scene object.
 */
function buildScenePropertyMap(scene: unknown): Map<unknown, string> {
  const map = new Map<unknown, string>();
  if (!scene || typeof scene !== 'object') return map;

  try {
    const keys = Object.keys(scene as object);
    for (const key of keys) {
      const val = (scene as Record<string, unknown>)[key];
      // Identify Phaser GameObjects by duck-typing (they have .type, .scene, .active)
      if (
        val !== null &&
        typeof val === 'object' &&
        typeof (val as any).type === 'string' &&
        typeof (val as any).active !== 'undefined' &&
        typeof (val as any).visible !== 'undefined'
      ) {
        map.set(val, key);
      }
    }
  } catch {
    // Reflection can throw on sealed objects — ignore
  }

  return map;
}

/**
 * Recursively walk Phaser children, returning LayoutElement[] for all visible/active objects.
 * Containers are flattened (children indented in the text output via depth tracking).
 */
function walkPhaserChildren(
  children: unknown[],
  sceneProps: Map<unknown, string>,
  collected: LayoutElement[],
  indent: number = 0,
): void {
  for (const child of children) {
    if (!child || typeof child !== 'object') continue;
    const obj = child as Record<string, unknown>;

    const visible = obj['visible'];
    const active = obj['active'];
    if (visible === false || active === false) continue;

    const type = String(obj['type'] ?? 'Unknown');
    const objName = getPhaserObjectName(obj, sceneProps);
    const nameStr = objName ? ` ${objName}` : '';
    const label = `[${type}]${nameStr}`;

    const { x, y, w, h } = getPhaserBounds(obj);
    const depth = typeof obj['depth'] === 'number' ? Math.round(obj['depth']) : 0;
    const detail = getPhaserDetail(obj);

    collected.push({
      label: '  '.repeat(indent) + label,
      x, y, w, h, depth, detail, layer: 'phaser',
    });

    // Recurse into Containers
    if (type === 'Container') {
      const list = (obj as any).list;
      if (Array.isArray(list)) {
        walkPhaserChildren(list, sceneProps, collected, indent + 1);
      }
    }
  }
}

/** Render LayoutElement[] to a formatted block string for the Phaser layer. */
function formatPhaserElements(els: LayoutElement[]): string {
  if (els.length === 0) return '  (no visible objects)\n';

  const lines: string[] = [];
  for (const el of els) {
    const pos = el.w > 0 || el.h > 0
      ? `(${el.x}, ${el.y})  ${el.w}x${el.h}`
      : `(${el.x}, ${el.y})`;
    const detailStr = el.detail ? `  ${el.detail}` : '';
    const depthStr = `  depth:${el.depth}`;
    lines.push(`  ${el.label.padEnd(46)} ${pos.padEnd(22)}${depthStr}${detailStr}`);
  }
  return lines.join('\n') + '\n';
}

/** Walk all active Phaser scenes and produce the Phaser layer text block + LayoutElement list. */
function dumpPhaserLayer(game: unknown): { text: string; elements: LayoutElement[] } {
  const allElements: LayoutElement[] = [];

  if (!game || typeof game !== 'object') {
    return { text: '  (no Phaser game running)\n', elements: [] };
  }

  let text = '';

  try {
    const scenePlugin = (game as any).scene as {
      getScenes?: (active: boolean) => unknown[];
    } | undefined;
    const scenes = scenePlugin?.getScenes?.(true) ?? [];

    if (scenes.length === 0) {
      return { text: '  (no active scenes)\n', elements: [] };
    }

    for (const scene of scenes) {
      if (!scene || typeof scene !== 'object') continue;
      const sceneAny = scene as any;
      const sceneKey: string = sceneAny.sys?.settings?.key ?? sceneAny.scene?.key ?? 'UnknownScene';

      text += `▸ PHASER LAYER (${sceneKey}) ──────────\n`;

      // Build property map for scene-level named objects
      const sceneProps = buildScenePropertyMap(scene);

      // Walk scene.children (the DisplayList)
      const displayList = sceneAny.children;
      const rawChildren: unknown[] = displayList?.getAll?.() ?? displayList?.list ?? [];

      const sceneElements: LayoutElement[] = [];
      walkPhaserChildren(rawChildren, sceneProps, sceneElements, 0);
      allElements.push(...sceneElements);

      text += formatPhaserElements(sceneElements);
      text += '\n';
    }
  } catch (err) {
    text += `  (error walking Phaser scene graph: ${err})\n`;
  }

  return { text, elements: allElements };
}

// ---------------------------------------------------------------------------
// DOM layer
// ---------------------------------------------------------------------------

/** Significant CSS class fragments to look for. */
const SIGNIFICANT_CLASS_FRAGMENTS = [
  'card', 'quiz', 'combat', 'overlay', 'hud', 'bar', 'hand', 'button',
  'screen', 'modal', 'reward', 'shop', 'rest', 'event', 'relic',
  'hp', 'shield', 'enemy', 'player', 'intent', 'floor', 'hub', 'menu',
  'entrance', 'top-bar', 'parallax', 'transition', 'expanded', 'detail',
];

/** Return true if the element has at least one significant class. */
function hasSignificantClass(el: Element): boolean {
  const cls = el.className;
  if (typeof cls !== 'string') return false;
  const lower = cls.toLowerCase();
  return SIGNIFICANT_CLASS_FRAGMENTS.some(f => lower.includes(f));
}

/** Return true if the element should appear in the DOM dump. */
function isDOMElementSignificant(el: Element): boolean {
  if (el.hasAttribute('data-testid')) return true;
  if (el.tagName === 'BUTTON') return true;
  if (el.getAttribute('role') === 'button' || el.getAttribute('role') === 'dialog') return true;
  if (hasSignificantClass(el)) return true;
  // Include span/strong/p with direct text content
  if (['SPAN', 'STRONG', 'P', 'H1', 'H2', 'H3', 'H4'].includes(el.tagName)) {
    const directText = getDirectTextContent(el);
    if (directText.length > 0 && directText.length <= 120) return true;
  }
  return false;
}

/** Get only the direct (non-child) text content of an element. */
function getDirectTextContent(el: Element): string {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    }
  }
  return text.trim().replace(/\s+/g, ' ');
}

/** Check if element is visually visible. */
function isVisible(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetParent !== null
  );
}

interface DOMElement extends LayoutElement {
  testId: string;
  tagName: string;
  hidden: boolean;
  indent: number;
}

/**
 * Walk the DOM tree starting at `root`, collecting significant elements.
 * Respects containment hierarchy for indentation.
 */
function walkDOM(
  root: Element,
  collected: DOMElement[],
  indent: number = 0,
): void {
  const children = Array.from(root.children);
  for (const child of children) {
    if (!(child instanceof HTMLElement)) {
      walkDOM(child, collected, indent);
      continue;
    }

    const significant = isDOMElementSignificant(child);

    if (significant) {
      const rect = child.getBoundingClientRect();
      const hidden = !isVisible(child);
      const testId = child.getAttribute('data-testid') ?? '';
      const directText = getDirectTextContent(child);

      // Build label
      const tagLower = child.tagName.toLowerCase();
      const cls = child.className;
      const classStr = typeof cls === 'string' && cls.trim()
        ? `.${cls.trim().replace(/\s+/g, '.')}`
        : '';
      const testIdStr = testId ? ` data-testid="${testId}"` : '';

      let labelBase = `[${tagLower}${classStr}]${testIdStr}`;
      if (labelBase.length > 60) labelBase = `[${tagLower}]${testIdStr}`;

      const detail = [
        directText ? `"${directText.substring(0, 50)}"` : '',
        hidden ? 'HIDDEN' : '',
      ].filter(Boolean).join('  ');

      collected.push({
        label: '  '.repeat(indent) + labelBase,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        depth: 0,
        detail,
        layer: 'dom',
        testId,
        tagName: child.tagName,
        hidden,
        indent,
      });

      // Recurse into children with increased indent
      walkDOM(child, collected, indent + 1);
    } else {
      // Not significant itself, but recurse at same indent level
      walkDOM(child, collected, indent);
    }
  }
}

/** Render DOM elements to a formatted text block. */
function formatDOMElements(els: DOMElement[]): string {
  if (els.length === 0) return '  (no significant DOM elements found)\n';

  const lines: string[] = [];
  for (const el of els) {
    const pos = el.w > 0 || el.h > 0
      ? `(${el.x}, ${el.y})  ${el.w}x${el.h}`
      : `(${el.x}, ${el.y})`;
    const detailStr = el.detail ? `  ${el.detail}` : '';
    lines.push(`  ${el.label.padEnd(64)} ${pos.padEnd(22)}${detailStr}`);
  }
  return lines.join('\n') + '\n';
}

/** Walk the DOM and produce text + element list for the DOM layer. */
function dumpDOMLayer(): { text: string; elements: DOMElement[] } {
  const collected: DOMElement[] = [];

  const root = document.getElementById('app') ?? document.body;
  walkDOM(root, collected, 0);

  const text = '▸ DOM LAYER ────────────────────────────\n' +
    formatDOMElements(collected) + '\n';

  return { text, elements: collected };
}

// ---------------------------------------------------------------------------
// Spatial relationships
// ---------------------------------------------------------------------------

type AnyElement = LayoutElement | DOMElement;

/**
 * Assign a viewport region label to an element's position.
 * Viewport is split into a 3×3 grid.
 */
function viewportRegion(el: AnyElement, vw: number, vh: number): string {
  const cx = el.x + (el.w > 0 ? el.w / 2 : 0);
  const cy = el.y + (el.h > 0 ? el.h / 2 : 0);

  const col = cx < vw / 3 ? 'LEFT' : cx < (2 * vw) / 3 ? 'CENTER' : 'RIGHT';
  const row = cy < vh / 3 ? 'TOP' : cy < (2 * vh) / 3 ? 'MIDDLE' : 'BOTTOM';

  if (row === 'MIDDLE' && col === 'CENTER') return 'CENTER';
  return `${row}-${col}`;
}

/** Rough percentage of viewport height covered by an element. */
function viewportHeightPct(el: AnyElement, vh: number): number {
  return Math.round((el.h / vh) * 100);
}

/**
 * Compute spatial relationships: positioning notes, viewport regions, coverage.
 * Returns a formatted text block.
 */
function computeRelationships(
  phaserEls: LayoutElement[],
  domEls: DOMElement[],
): string {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const lines: string[] = [];
  lines.push('▸ SPATIAL RELATIONSHIPS ────────────────');

  // Viewport region notes for all named/testid elements
  const notable = [
    ...phaserEls.filter(e => e.label.match(/\w/) && e.w > 0),
    ...domEls.filter(e => e.testId || e.w > 100),
  ].slice(0, 40); // cap to keep output manageable

  const regionGroups: Map<string, string[]> = new Map();
  for (const el of notable) {
    const region = viewportRegion(el, vw, vh);
    const name = el.label.trim().replace(/^(\s*)?/, '');
    if (!regionGroups.has(region)) regionGroups.set(region, []);
    regionGroups.get(region)!.push(name);
  }

  for (const [region, names] of regionGroups) {
    lines.push(`  ${region.padEnd(18)} → ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` (+${names.length - 5} more)` : ''}`);
  }

  lines.push('');

  // Height coverage for large DOM containers
  const bigDom = domEls.filter(e => e.h > vh * 0.1 && e.w > vw * 0.2);
  for (const el of bigDom.slice(0, 8)) {
    const pct = viewportHeightPct(el, vh);
    const region = viewportRegion(el, vw, vh);
    const name = el.label.trim().replace(/^(\s*)?/, '');
    lines.push(`  ${name.substring(0, 48).padEnd(50)} covers ${pct}% height  ${region}`);
  }

  lines.push('');

  // Cross-layer proximity: notable Phaser objects vs DOM elements with testId
  const phaserNamed = phaserEls.filter(e => e.label.includes(']') && e.w > 0).slice(0, 20);
  const domTestId = domEls.filter(e => e.testId).slice(0, 20);

  if (phaserNamed.length > 0 && domTestId.length > 0) {
    lines.push('  Cross-layer proximity (nearest DOM testid to each Phaser object):');
    for (const ph of phaserNamed.slice(0, 10)) {
      let nearest: DOMElement | null = null;
      let minDist = Infinity;
      for (const dom of domTestId) {
        const dx = ph.x - (dom.x + dom.w / 2);
        const dy = ph.y - (dom.y + dom.h / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) { minDist = dist; nearest = dom; }
      }
      if (nearest && minDist < 600) {
        const phName = ph.label.trim();
        const dir = ph.y < nearest.y + nearest.h / 2 ? 'ABOVE' : 'BELOW';
        lines.push(`  ${phName.substring(0, 36).padEnd(38)} is ${Math.round(minDist)}px ${dir} ${nearest.testId}`);
      }
    }
    lines.push('');
  }

  // Overlap warnings: Phaser objects whose screen rect overlaps a DOM element
  lines.push('  Layer overlap check:');
  let overlapCount = 0;
  for (const ph of phaserNamed) {
    for (const dom of domTestId) {
      const phLeft = ph.x - ph.w / 2, phRight = ph.x + ph.w / 2;
      const phTop = ph.y - ph.h / 2, phBottom = ph.y + ph.h / 2;
      const domLeft = dom.x, domRight = dom.x + dom.w;
      const domTop = dom.y, domBottom = dom.y + dom.h;
      const overlaps = phLeft < domRight && phRight > domLeft && phTop < domBottom && phBottom > domTop;
      if (overlaps) {
        lines.push(`  ⚠ ${ph.label.trim().substring(0, 28)} OVERLAPS ${dom.testId}`);
        overlapCount++;
        if (overlapCount >= 6) break;
      }
    }
    if (overlapCount >= 6) break;
  }
  if (overlapCount === 0) lines.push('  (no significant cross-layer overlaps detected)');

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Produce a unified layout dump of the current game screen.
 * Merges the Phaser scene graph and all significant DOM elements into
 * a single plain-text document with pixel coordinates.
 *
 * Designed to give LLM agents exact spatial understanding without screenshots.
 * Call via `window.__rrLayoutDump()` in browser_evaluate.
 */
export function layoutDump(): string {
  if (!import.meta.env.DEV) {
    return 'layoutDump() is only available in dev mode.';
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const orientation = vw >= vh ? 'landscape' : 'portrait';
  const timestamp = new Date().toISOString();

  const lines: string[] = [];
  lines.push(`LAYOUT DUMP  ${timestamp}`);
  lines.push(`Viewport: ${vw} x ${vh}  (${orientation})`);
  lines.push('═'.repeat(60));
  lines.push('');

  // Resolve Phaser game instance
  let game: unknown = undefined;
  try {
    const gm = (globalThis as Record<symbol, unknown>)[Symbol.for('rr:cardGameManager')] as Record<string, unknown> | undefined;
    game = (gm as any)?.game;
  } catch {
    // Game manager may not be initialized — ignore
  }

  // Phaser layer
  const { text: phaserText, elements: phaserEls } = dumpPhaserLayer(game);
  lines.push(phaserText);

  // DOM layer
  const { text: domText, elements: domEls } = dumpDOMLayer();
  lines.push(domText);

  // Spatial relationships
  lines.push(computeRelationships(phaserEls, domEls));

  lines.push('');
  lines.push(`— END LAYOUT DUMP (${phaserEls.length} Phaser objects, ${domEls.length} DOM elements) —`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Window attachment
// ---------------------------------------------------------------------------

/** Attach window.__rrLayoutDump for browser_evaluate access. DEV mode only. */
export function initLayoutDump(): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as Record<string, unknown>).__rrLayoutDump = layoutDump;
}
