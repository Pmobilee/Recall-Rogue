#!/usr/bin/env node
/**
 * deploy-enemy-sprites.mjs
 *
 * Maps accepted enemy sprites (display-name filenames) from
 *   sprite-gen/cardback-tool/artstudio-output/enemies-accepted/
 * to their enemy IDs, then processes and deploys them to
 *   public/assets/sprites/enemies/
 *
 * Output per enemy:
 *   {id}_idle.png       — standard res (fit within longest edge)
 *   {id}_idle.webp      — same, lossless webp
 *   {id}_idle_1x.png    — low-end res (half standard)
 *   {id}_idle_1x.webp   — same, lossless webp
 *
 * Size targets by category:
 *   common:    standard=256, lowEnd=128
 *   elite:     standard=320, lowEnd=160
 *   mini_boss: standard=320, lowEnd=160
 *   boss:      standard=384, lowEnd=192
 */

import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');

const SOURCE_DIR = join(REPO_ROOT, 'sprite-gen/cardback-tool/artstudio-output/enemies-accepted');
const OUTPUT_DIR = join(REPO_ROOT, 'public/assets/sprites/enemies');

const RESOLUTION_MAP = {
  common:    { standard: 256, lowEnd: 128 },
  elite:     { standard: 320, lowEnd: 160 },
  mini_boss: { standard: 320, lowEnd: 160 },
  boss:      { standard: 384, lowEnd: 192 },
};

// ── Enemy roster extracted from src/data/enemies.ts ────────────────────────
// Each entry: { id, name, category }
const ENEMY_ROSTER = [
  { id: 'cave_bat',           name: 'Page Flutter',             category: 'common'    },
  { id: 'crystal_golem',      name: 'Thesis Construct',         category: 'common'    },
  { id: 'toxic_spore',        name: 'Mold Puff',                category: 'common'    },
  { id: 'shadow_mimic',       name: 'The Crib Sheet',           category: 'common'    },
  { id: 'ore_wyrm',           name: 'The Bookwyrm',             category: 'elite'     },
  { id: 'fossil_guardian',    name: 'The Peer Reviewer',        category: 'elite'     },
  { id: 'the_excavator',      name: 'The Final Exam',           category: 'boss'      },
  { id: 'magma_core',         name: 'The Burning Deadline',     category: 'boss'      },
  { id: 'the_archivist',      name: 'The Algorithm',            category: 'boss'      },
  { id: 'crystal_warden',     name: 'The Curriculum',           category: 'boss'      },
  { id: 'shadow_hydra',       name: 'The Group Project',        category: 'boss'      },
  { id: 'void_weaver',        name: 'The Rabbit Hole',          category: 'boss'      },
  { id: 'knowledge_golem',    name: 'The Omnibus',              category: 'boss'      },
  { id: 'the_curator',        name: 'The Final Lesson',         category: 'boss'      },
  { id: 'crystal_guardian',   name: 'The Tenure Guardian',      category: 'mini_boss' },
  { id: 'venomfang',          name: 'The Plagiarist',           category: 'mini_boss' },
  { id: 'stone_sentinel',     name: 'The Proctor',              category: 'mini_boss' },
  { id: 'ember_drake',        name: 'The Grade Dragon',         category: 'mini_boss' },
  { id: 'shade_stalker',      name: 'The Comparison Trap',      category: 'mini_boss' },
  { id: 'bone_collector',     name: 'The Citation Needed',      category: 'common'    },
  { id: 'mud_crawler',        name: 'Ink Slug',                 category: 'common'    },
  { id: 'root_strangler',     name: 'Bookmark Vine',            category: 'common'    },
  { id: 'iron_beetle',        name: 'Staple Bug',               category: 'common'    },
  { id: 'limestone_imp',      name: 'Margin Gremlin',           category: 'common'    },
  { id: 'cave_spider',        name: 'Index Weaver',             category: 'common'    },
  { id: 'peat_shambler',      name: 'Overdue Golem',            category: 'common'    },
  { id: 'fungal_sprout',      name: 'Pop Quiz',                 category: 'common'    },
  { id: 'blind_grub',         name: 'Eraser Worm',              category: 'common'    },
  { id: 'root_mother',        name: 'The Card Catalogue',       category: 'mini_boss' },
  { id: 'iron_matriarch',     name: 'The Headmistress',         category: 'mini_boss' },
  { id: 'bog_witch',          name: 'The Tutor',                category: 'mini_boss' },
  { id: 'mushroom_sovereign', name: 'The Study Group',          category: 'mini_boss' },
  { id: 'cave_troll',         name: 'The Librarian',            category: 'elite'     },
  { id: 'basalt_crawler',     name: 'The Crambot',              category: 'common'    },
  { id: 'salt_wraith',        name: 'The All-Nighter',          category: 'common'    },
  { id: 'coal_imp',           name: 'The Spark Note',           category: 'common'    },
  { id: 'granite_hound',      name: 'The Watchdog',             category: 'common'    },
  { id: 'sulfur_sprite',      name: 'The Red Herring',          category: 'common'    },
  { id: 'magma_tick',         name: 'The Anxiety Tick',         category: 'common'    },
  { id: 'deep_angler',        name: 'The Trick Question',       category: 'common'    },
  { id: 'rock_hermit',        name: 'The Dropout',              category: 'common'    },
  { id: 'gas_phantom',        name: 'The Brain Fog',            category: 'common'    },
  { id: 'stalactite_drake',   name: 'The Thesis Dragon',        category: 'common'    },
  { id: 'ember_moth',         name: 'The Burnout',              category: 'common'    },
  { id: 'sulfur_queen',       name: 'The Harsh Grader',         category: 'mini_boss' },
  { id: 'granite_colossus',   name: 'The Textbook',             category: 'mini_boss' },
  { id: 'deep_lurker',        name: 'The Imposter Syndrome',    category: 'mini_boss' },
  { id: 'lava_salamander',    name: 'The Pressure Cooker',      category: 'mini_boss' },
  { id: 'magma_serpent',      name: 'The Deadline Serpent',     category: 'elite'     },
  { id: 'basalt_titan',       name: 'The Standardized Test',    category: 'elite'     },
  { id: 'obsidian_shard',     name: "The Writer's Block",       category: 'common'    },
  { id: 'magma_slime',        name: 'The Information Overload', category: 'common'    },
  { id: 'quartz_elemental',   name: 'The Rote Memory',          category: 'common'    },
  { id: 'fossil_raptor',      name: 'The Outdated Fact',        category: 'common'    },
  { id: 'geode_beetle',       name: 'The Hidden Gem',           category: 'common'    },
  { id: 'lava_crawler',       name: 'The Rushing Student',      category: 'common'    },
  { id: 'crystal_bat',        name: 'The Echo Chamber',         category: 'common'    },
  { id: 'void_mite',          name: 'The Blank Spot',           category: 'common'    },
  { id: 'ash_wraith',         name: 'The Burnout Phantom',      category: 'common'    },
  { id: 'prismatic_jelly',    name: 'Prismatic Jelly',          category: 'common'    },
  { id: 'ember_skeleton',     name: 'Ember Skeleton',           category: 'common'    },
  { id: 'obsidian_knight',    name: 'The Perfectionist',        category: 'mini_boss' },
  { id: 'quartz_hydra',       name: 'The Hydra Problem',        category: 'mini_boss' },
  { id: 'fossil_wyvern',      name: 'The Ivory Tower',          category: 'mini_boss' },
  { id: 'magma_broodmother',  name: 'The Helicopter Parent',    category: 'mini_boss' },
  { id: 'geode_king',         name: 'The Emeritus',             category: 'elite'     },
  { id: 'abyssal_leviathan',  name: 'The Student Debt',         category: 'elite'     },
  { id: 'crystal_lich',       name: 'The Publish-or-Perish',    category: 'elite'     },
  { id: 'pressure_djinn',     name: 'The Thesis Djinn',         category: 'common'    },
  { id: 'core_worm',          name: 'The Gut Feeling',          category: 'common'    },
  { id: 'biolume_jellyfish',  name: 'The Bright Idea',          category: 'common'    },
  { id: 'tectonic_scarab',    name: 'The Sacred Text',          category: 'common'    },
  { id: 'mantle_fiend',       name: "The Devil's Advocate",     category: 'common'    },
  { id: 'iron_core_golem',    name: 'The Institution',          category: 'common'    },
  { id: 'glyph_sentinel',     name: 'The Rosetta Slab',         category: 'common'    },
  { id: 'archive_moth',       name: 'The Moth of Enlightenment',category: 'common'    },
  { id: 'rune_spider',        name: 'The Hyperlink',            category: 'common'    },
  { id: 'void_tendril',       name: 'The Unknown Unknown',      category: 'common'    },
  { id: 'tome_mimic',         name: 'The Fake News',            category: 'common'    },
  { id: 'primordial_wyrm',    name: 'The First Question',       category: 'mini_boss' },
  { id: 'iron_archon',        name: 'The Dean',                 category: 'mini_boss' },
  { id: 'pressure_colossus',  name: 'The Dissertation',         category: 'mini_boss' },
  { id: 'biolume_monarch',    name: 'The Eureka',               category: 'mini_boss' },
  { id: 'tectonic_titan',     name: 'The Paradigm Shift',       category: 'mini_boss' },
  { id: 'glyph_warden',       name: 'The Ancient Tongue',       category: 'mini_boss' },
  { id: 'archive_specter',    name: 'The Lost Thesis',          category: 'mini_boss' },
  { id: 'mantle_dragon',      name: 'The Dunning-Kruger',       category: 'elite'     },
  { id: 'core_harbinger',     name: 'The Singularity',          category: 'elite'     },
];

/**
 * Convert a display name to snake_case filename stem.
 * Rules observed from actual filenames:
 *   - lowercase
 *   - spaces → underscores
 *   - apostrophes removed (e.g. "Devil's" → "devils")
 *   - hyphens removed (e.g. "All-Nighter" → "all_nighter" via space handling,
 *     but "Publish-or-Perish" → "publish_or_perish")
 *   - "The " prefix → "the_"
 */
function nameToSnake(name) {
  return name
    .toLowerCase()
    .replace(/'/g, '')         // remove apostrophes
    .replace(/-/g, '_')        // hyphens → underscores
    .replace(/\s+/g, '_')      // spaces → underscores
    .replace(/_+/g, '_');      // collapse doubled underscores
}

/**
 * Calculate resize dimensions to fit within target longest edge,
 * preserving aspect ratio.
 */
function calcDims(origWidth, origHeight, targetEdge) {
  const longestEdge = Math.max(origWidth, origHeight);
  const scale = targetEdge / longestEdge;
  return {
    width: Math.round(origWidth * scale),
    height: Math.round(origHeight * scale),
  };
}

/**
 * Process one sprite: produce 4 output files in OUTPUT_DIR.
 */
async function processSprite(sourcePath, enemyId, category) {
  const res = RESOLUTION_MAP[category];
  if (!res) {
    throw new Error(`Unknown category: ${category}`);
  }

  const meta = await sharp(sourcePath).metadata();
  const { width: ow, height: oh } = meta;

  const stdDims = calcDims(ow, oh, res.standard);
  const lowDims = {
    width:  Math.round(stdDims.width  / 2),
    height: Math.round(stdDims.height / 2),
  };

  const [pngStd, webpStd, pngLow, webpLow] = await Promise.all([
    sharp(sourcePath)
      .resize(stdDims.width, stdDims.height, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    sharp(sourcePath)
      .resize(stdDims.width, stdDims.height, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .webp({ lossless: true })
      .toBuffer(),
    sharp(sourcePath)
      .resize(lowDims.width, lowDims.height, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    sharp(sourcePath)
      .resize(lowDims.width, lowDims.height, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .webp({ lossless: true })
      .toBuffer(),
  ]);

  await Promise.all([
    writeFile(join(OUTPUT_DIR, `${enemyId}_idle.png`),     pngStd),
    writeFile(join(OUTPUT_DIR, `${enemyId}_idle.webp`),    webpStd),
    writeFile(join(OUTPUT_DIR, `${enemyId}_idle_1x.png`),  pngLow),
    writeFile(join(OUTPUT_DIR, `${enemyId}_idle_1x.webp`), webpLow),
  ]);

  const totalBytes = pngStd.length + webpStd.length + pngLow.length + webpLow.length;
  return { stdDims, lowDims, totalBytes };
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  // Build lookup: snake_case_name → { id, category }
  // Deduplicate: if two enemies share the same display name, last one wins
  // (we'll warn about that separately)
  const nameMap = new Map();
  for (const e of ENEMY_ROSTER) {
    const key = nameToSnake(e.name);
    if (nameMap.has(key) && nameMap.get(key).id !== e.id) {
      console.warn(`  [warn] Duplicate snake name "${key}": ${nameMap.get(key).id} and ${e.id} — skipping duplicate`);
      continue;
    }
    nameMap.set(key, { id: e.id, category: e.category, name: e.name });
  }

  // Collect source files
  const sourceFiles = readdirSync(SOURCE_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${sourceFiles.length} source sprites in ${SOURCE_DIR}\n`);

  let matched = 0;
  let skipped = 0;
  let failed  = 0;
  let totalBytes = 0;

  const unmatchedFiles = [];

  for (const filename of sourceFiles.sort()) {
    const stem = filename.replace(/\.png$/, '');
    const entry = nameMap.get(stem);

    if (!entry) {
      unmatchedFiles.push(filename);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${filename} → ${entry.id} (${entry.category}) ... `);

    try {
      const result = await processSprite(
        join(SOURCE_DIR, filename),
        entry.id,
        entry.category,
      );
      console.log(`ok  ${result.stdDims.width}x${result.stdDims.height} / ${result.lowDims.width}x${result.lowDims.height}  (${(result.totalBytes / 1024).toFixed(0)} KB)`);
      matched++;
      totalBytes += result.totalBytes;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }

  // Report enemies in roster that had no source sprite
  const deployedIds = new Set();
  for (const filename of sourceFiles) {
    const stem = filename.replace(/\.png$/, '');
    const entry = nameMap.get(stem);
    if (entry) deployedIds.add(entry.id);
  }
  const missingSprites = ENEMY_ROSTER.filter(e => !deployedIds.has(e.id));

  console.log('\n' + '='.repeat(64));
  console.log('SUMMARY');
  console.log('='.repeat(64));
  console.log(`Deployed:  ${matched} enemies`);
  console.log(`Failed:    ${failed}`);
  console.log(`Unmatched source files (no roster entry): ${skipped}`);
  console.log(`Total output size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  if (unmatchedFiles.length > 0) {
    console.log('\nUnmatched source files:');
    for (const f of unmatchedFiles) console.log(`  ${f}`);
  }

  if (missingSprites.length > 0) {
    console.log(`\nRoster enemies with no accepted sprite (${missingSprites.length}):`);
    for (const e of missingSprites) {
      console.log(`  ${e.id}  (${nameToSnake(e.name)}.png)`);
    }
  }

  console.log('='.repeat(64));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
