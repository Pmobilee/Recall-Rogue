import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ARTSTUDIO_ITEMS = resolve(PROJECT_ROOT, 'sprite-gen/cardback-tool/artstudio-items.json');
const ARTSTUDIO_OUTPUT = resolve(PROJECT_ROOT, 'sprite-gen/cardback-tool/artstudio-output/backgrounds');
const PUBLIC_BG = resolve(PROJECT_ROOT, 'public/assets/backgrounds');

// Types that map to rooms/
const ROOM_TYPES = new Set(['rest', 'shop', 'mystery', 'treasure', 'descent', 'hallway', 'crossroads']);
// Types that map to screens/
const SCREEN_TYPES = new Set(['defeat', 'victory']);
// Types that map to menu/
const MENU_TYPES = new Set(['title']);

const ALL_TYPES = new Set([...ROOM_TYPES, ...SCREEN_TYPES, ...MENU_TYPES]);

/**
 * Resolve the destination path for a given type and orientation.
 * - Room types:   public/assets/backgrounds/rooms/{type}/{orientation}.webp
 * - Screen types: public/assets/backgrounds/screens/{type}/{orientation}.webp
 * - Menu types:   public/assets/backgrounds/menu/{orientation}.webp
 */
function getDestPath(type, orientation) {
  if (ROOM_TYPES.has(type)) {
    return resolve(PUBLIC_BG, 'rooms', type, `${orientation}.webp`);
  }
  if (SCREEN_TYPES.has(type)) {
    return resolve(PUBLIC_BG, 'screens', type, `${orientation}.webp`);
  }
  if (MENU_TYPES.has(type)) {
    return resolve(PUBLIC_BG, 'menu', `${orientation}.webp`);
  }
  throw new Error(`Unknown type: ${type}`);
}

async function main() {
  const data = JSON.parse(readFileSync(ARTSTUDIO_ITEMS, 'utf-8'));
  const backgrounds = data.backgrounds || [];

  let exported = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of backgrounds) {
    // Parse item ID: bg-{type}-{orientation}
    const match = item.id.match(/^bg-(.+)-(portrait|landscape)$/);
    if (!match) continue;

    const type = match[1];
    const orientation = match[2];

    // Only process non-enemy backgrounds
    if (!ALL_TYPES.has(type)) continue;

    // Find accepted variant
    const accepted = item.variants?.find(v => v.accepted);
    if (!accepted) {
      console.log(`[skip] No accepted variant: ${item.id}`);
      skipped++;
      continue;
    }

    // Source PNG
    const srcPath = resolve(ARTSTUDIO_OUTPUT, item.id, `variant-${accepted.variant}.png`);
    if (!existsSync(srcPath)) {
      console.error(`[ERROR] Missing source: ${srcPath}`);
      errors++;
      continue;
    }

    // Destination WebP
    const destPath = getDestPath(type, orientation);
    mkdirSync(dirname(destPath), { recursive: true });

    try {
      await sharp(srcPath)
        .webp({ quality: 85 })
        .toFile(destPath);
      console.log(`[ok] ${item.id} → ${destPath.replace(PROJECT_ROOT + '/', '')}`);
      exported++;
    } catch (err) {
      console.error(`[ERROR] ${item.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Exported: ${exported}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch(console.error);
