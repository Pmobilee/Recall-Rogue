import { readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ARTSTUDIO_ITEMS = resolve(PROJECT_ROOT, 'sprite-gen/cardback-tool/artstudio-items.json');
const ARTSTUDIO_OUTPUT = resolve(PROJECT_ROOT, 'sprite-gen/cardback-tool/artstudio-output/backgrounds');
const PUBLIC_BG = resolve(PROJECT_ROOT, 'public/assets/backgrounds');
const ENEMY_BG_DIR = resolve(PUBLIC_BG, 'combat/enemies');

// ── Room/screen/menu type sets ────────────────────────────────────────────────
// Room types:   public/assets/backgrounds/rooms/{type}/{orientation}.webp
const ROOM_TYPES = new Set(['rest', 'shop', 'mystery', 'treasure', 'descent', 'hallway', 'crossroads']);
// Screen types: public/assets/backgrounds/screens/{type}/{orientation}.webp
const SCREEN_TYPES = new Set(['defeat', 'victory']);
// Menu types:   public/assets/backgrounds/menu/{orientation}.webp
const MENU_TYPES = new Set(['title']);

const NON_ENEMY_TYPES = new Set([...ROOM_TYPES, ...SCREEN_TYPES, ...MENU_TYPES]);

/**
 * Resolve the destination path for a room/screen/menu background.
 */
function getRoomDestPath(type, orientation) {
  if (ROOM_TYPES.has(type)) {
    return resolve(PUBLIC_BG, 'rooms', type, `${orientation}.webp`);
  }
  if (SCREEN_TYPES.has(type)) {
    return resolve(PUBLIC_BG, 'screens', type, `${orientation}.webp`);
  }
  if (MENU_TYPES.has(type)) {
    return resolve(PUBLIC_BG, 'menu', `${orientation}.webp`);
  }
  throw new Error(`Unknown non-enemy type: ${type}`);
}

async function main() {
  const data = JSON.parse(readFileSync(ARTSTUDIO_ITEMS, 'utf-8'));
  const backgrounds = data.backgrounds || [];

  // ── Phase 1: Combat enemy backgrounds ──────────────────────────────────────
  console.log('=== Phase 1: Combat enemy backgrounds ===');
  let enemyExported = 0;
  let enemyErrors = 0;

  for (const item of backgrounds) {
    // Find accepted variant
    const accepted = item.variants?.find(v => v.accepted);
    if (!accepted) continue;

    // Parse item ID: bg-{enemyId}-{orientation}
    const match = item.id.match(/^bg-(.+)-(portrait|landscape)$/);
    if (!match) {
      console.log(`[skip] Can't parse ID: ${item.id}`);
      continue;
    }

    const type = match[1];
    const orientation = match[2];

    // Skip non-enemy types — handled in phase 2
    if (NON_ENEMY_TYPES.has(type)) continue;

    // Source: artstudio output
    const srcPath = resolve(ARTSTUDIO_OUTPUT, item.id, `variant-${accepted.variant}.png`);
    if (!existsSync(srcPath)) {
      console.error(`[ERROR] Missing source: ${srcPath}`);
      enemyErrors++;
      continue;
    }

    // Destination: public/assets/backgrounds/combat/enemies/{enemyId}/{orientation}.webp
    const destDir = resolve(ENEMY_BG_DIR, type);
    mkdirSync(destDir, { recursive: true });
    const destPath = resolve(destDir, `${orientation}.webp`);

    try {
      await sharp(srcPath)
        .webp({ quality: 85 })
        .toFile(destPath);
      enemyExported++;
      if (enemyExported % 20 === 0) console.log(`[progress] ${enemyExported} enemy backgrounds exported...`);
    } catch (err) {
      console.error(`[ERROR] ${item.id}: ${err.message}`);
      enemyErrors++;
    }
  }

  console.log(`Enemy export done. Exported: ${enemyExported}, Errors: ${enemyErrors}`);

  // Verify enemy directory completeness
  if (existsSync(ENEMY_BG_DIR)) {
    const dirs = readdirSync(ENEMY_BG_DIR);
    console.log(`Enemy directories: ${dirs.length}`);
    let complete = 0;
    const incomplete = [];
    for (const dir of dirs) {
      const hasP = existsSync(resolve(ENEMY_BG_DIR, dir, 'portrait.webp'));
      const hasL = existsSync(resolve(ENEMY_BG_DIR, dir, 'landscape.webp'));
      if (hasP && hasL) complete++;
      else incomplete.push(dir);
    }
    console.log(`Complete (both orientations): ${complete}`);
    if (incomplete.length) console.log(`Incomplete:`, incomplete);
  }

  // ── Phase 2: Room/screen/menu backgrounds ──────────────────────────────────
  console.log('\n=== Phase 2: Room/screen/menu backgrounds ===');
  let roomExported = 0;
  let roomSkipped = 0;
  let roomErrors = 0;

  for (const item of backgrounds) {
    // Parse item ID: bg-{type}-{orientation}
    const match = item.id.match(/^bg-(.+)-(portrait|landscape)$/);
    if (!match) continue;

    const type = match[1];
    const orientation = match[2];

    // Only process non-enemy backgrounds
    if (!NON_ENEMY_TYPES.has(type)) continue;

    // Find accepted variant
    const accepted = item.variants?.find(v => v.accepted);
    if (!accepted) {
      console.log(`[skip] No accepted variant: ${item.id}`);
      roomSkipped++;
      continue;
    }

    // Source PNG
    const srcPath = resolve(ARTSTUDIO_OUTPUT, item.id, `variant-${accepted.variant}.png`);
    if (!existsSync(srcPath)) {
      console.error(`[ERROR] Missing source: ${srcPath}`);
      roomErrors++;
      continue;
    }

    // Destination WebP
    const destPath = getRoomDestPath(type, orientation);
    mkdirSync(dirname(destPath), { recursive: true });

    try {
      await sharp(srcPath)
        .webp({ quality: 85 })
        .toFile(destPath);
      console.log(`[ok] ${item.id} → ${destPath.replace(PROJECT_ROOT + '/', '')}`);
      roomExported++;
    } catch (err) {
      console.error(`[ERROR] ${item.id}: ${err.message}`);
      roomErrors++;
    }
  }

  console.log(`Room/screen/menu export done. Exported: ${roomExported}, Skipped: ${roomSkipped}, Errors: ${roomErrors}`);

  // ── Combined stats ──────────────────────────────────────────────────────────
  const totalExported = enemyExported + roomExported;
  const totalErrors = enemyErrors + roomErrors;
  console.log(`\n=== Combined stats ===`);
  console.log(`Total exported: ${totalExported} (enemy: ${enemyExported}, room/screen/menu: ${roomExported})`);
  console.log(`Total errors:   ${totalErrors} (enemy: ${enemyErrors}, room/screen/menu: ${roomErrors})`);
}

main().catch(console.error);
