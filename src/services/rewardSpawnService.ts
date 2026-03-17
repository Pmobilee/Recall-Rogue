/**
 * Reward room cloth spawn point service.
 * Loads pre-computed spawn zone data and provides layout positions
 * for reward items on the cloth surface.
 * Pure logic — no Phaser/Svelte/DOM imports.
 */

export interface SpawnBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
}

export interface ClothSpawnData {
  bounds: SpawnBounds;
  spawnGrid: SpawnPoint[];
  maskWidth: number;
  maskHeight: number;
}

let spawnData: ClothSpawnData | null = null;
let initPromise: Promise<void> | null = null;

/** Initialize the spawn service by fetching the cloth zone JSON. */
export function initRewardSpawnService(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const res = await fetch(`/assets/reward_room/cloth_spawn_zone.json?v=${Date.now()}`);
      if (!res.ok) throw new Error(`Failed to load cloth spawn zone: ${res.status}`);
      spawnData = await res.json();
    } catch (e) {
      console.error('[RewardSpawn] Failed to load cloth spawn zone:', e);
      // Fallback: center of screen
      spawnData = {
        bounds: { minX: 300, minY: 900, maxX: 1200, maxY: 1500 },
        spawnGrid: [],
        maskWidth: 1536,
        maskHeight: 2752,
      };
    }
  })();
  return initPromise;
}

/** Check if spawn data is loaded. */
export function isRewardSpawnReady(): boolean {
  return spawnData !== null;
}

/**
 * Get layout positions for N reward items on the cloth.
 * Coordinates are returned in scene-space (scaled from mask dimensions).
 *
 * @param count Number of items (1-6)
 * @param padding Minimum distance between items in scene pixels
 * @param scaleX Scene width / mask width
 * @param scaleY Scene height / mask height
 */
export function getLayoutPositions(
  count: number,
  padding: number,
  scaleX: number,
  scaleY: number,
): SpawnPoint[] {
  if (!spawnData || count <= 0) return [];

  const b = spawnData.bounds;
  const centerX = (b.minX + b.maxX) / 2;
  const centerY = (b.minY + b.maxY) / 2;
  const clothW = b.maxX - b.minX;
  const clothH = b.maxY - b.minY;

  // Compute ideal positions based on item count
  const idealPositions = computeIdealLayout(count, centerX, centerY, clothW, clothH, padding / scaleX);

  // Snap each to nearest spawn grid point (if grid available)
  const snapped = idealPositions.map(pos => snapToGrid(pos));

  // Add jitter (4-8px in mask space)
  const jittered = snapped.map(pos => ({
    x: pos.x + (Math.random() * 8 - 4),
    y: pos.y + (Math.random() * 8 - 4),
  }));

  // Scale to scene coordinates
  return jittered.map(pos => ({
    x: pos.x * scaleX,
    y: pos.y * scaleY,
  }));
}

function computeIdealLayout(
  count: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  spacing: number,
): SpawnPoint[] {
  // Use ~60% of cloth area for layout
  const useW = w * 0.6;
  const useH = h * 0.4;

  switch (count) {
    case 1:
      return [{ x: cx, y: cy }];
    case 2:
      return [
        { x: cx - spacing * 1.2, y: cy },
        { x: cx + spacing * 1.2, y: cy },
      ];
    case 3:
      return [
        { x: cx - useW / 3, y: cy },
        { x: cx, y: cy },
        { x: cx + useW / 3, y: cy },
      ];
    case 4:
      return [
        { x: cx - useW / 4, y: cy - useH / 4 },
        { x: cx + useW / 4, y: cy - useH / 4 },
        { x: cx - useW / 4, y: cy + useH / 4 },
        { x: cx + useW / 4, y: cy + useH / 4 },
      ];
    case 5:
      return [
        // 3 top + 2 bottom (pyramid)
        { x: cx - useW / 3, y: cy - useH / 4 },
        { x: cx, y: cy - useH / 4 },
        { x: cx + useW / 3, y: cy - useH / 4 },
        { x: cx - useW / 5, y: cy + useH / 4 },
        { x: cx + useW / 5, y: cy + useH / 4 },
      ];
    case 6:
    default:
      return [
        // 3×2 grid
        { x: cx - useW / 3, y: cy - useH / 4 },
        { x: cx, y: cy - useH / 4 },
        { x: cx + useW / 3, y: cy - useH / 4 },
        { x: cx - useW / 3, y: cy + useH / 4 },
        { x: cx, y: cy + useH / 4 },
        { x: cx + useW / 3, y: cy + useH / 4 },
      ];
  }
}

function snapToGrid(pos: SpawnPoint): SpawnPoint {
  if (!spawnData || spawnData.spawnGrid.length === 0) return pos;

  let best = spawnData.spawnGrid[0];
  let bestDist = Infinity;

  for (const pt of spawnData.spawnGrid) {
    const dx = pt.x - pos.x;
    const dy = pt.y - pos.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = pt;
    }
  }

  return { x: best.x, y: best.y };
}
