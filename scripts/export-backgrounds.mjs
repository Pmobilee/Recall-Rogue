import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ARTSTUDIO_ITEMS = resolve(PROJECT_ROOT, 'sprite-gen/cardback-tool/artstudio-items.json');
const ARTSTUDIO_OUTPUT = resolve(PROJECT_ROOT, 'sprite-gen/cardback-tool/artstudio-output/backgrounds');
const GAME_BG_DIR = resolve(PROJECT_ROOT, 'public/assets/backgrounds/combat/enemies');

async function main() {
  const data = JSON.parse(readFileSync(ARTSTUDIO_ITEMS, 'utf-8'));
  const backgrounds = data.backgrounds || [];

  let exported = 0;
  let errors = 0;

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

    const enemyId = match[1];
    const orientation = match[2];

    // Source: artstudio output
    const srcPath = resolve(ARTSTUDIO_OUTPUT, item.id, `variant-${accepted.variant}.png`);
    if (!existsSync(srcPath)) {
      console.error(`[ERROR] Missing source: ${srcPath}`);
      errors++;
      continue;
    }

    // Destination: game assets
    const destDir = resolve(GAME_BG_DIR, enemyId);
    mkdirSync(destDir, { recursive: true });
    const destPath = resolve(destDir, `${orientation}.webp`);

    try {
      await sharp(srcPath)
        .webp({ quality: 85 })
        .toFile(destPath);
      exported++;
      if (exported % 20 === 0) console.log(`[progress] ${exported} exported...`);
    } catch (err) {
      console.error(`[ERROR] ${item.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Exported: ${exported}, Errors: ${errors}`);

  // Verify directory count
  const { readdirSync } = await import('fs');
  const dirs = readdirSync(GAME_BG_DIR);
  console.log(`Enemy directories: ${dirs.length}`);

  // Check each dir has both portrait.webp and landscape.webp
  let complete = 0;
  let incomplete = [];
  for (const dir of dirs) {
    const hasP = existsSync(resolve(GAME_BG_DIR, dir, 'portrait.webp'));
    const hasL = existsSync(resolve(GAME_BG_DIR, dir, 'landscape.webp'));
    if (hasP && hasL) complete++;
    else incomplete.push(dir);
  }
  console.log(`Complete (both orientations): ${complete}`);
  if (incomplete.length) console.log(`Incomplete:`, incomplete);
}

main().catch(console.error);
