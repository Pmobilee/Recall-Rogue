import express from 'express';
import Database from 'better-sqlite3';
import { resolve, dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync } from 'fs';

import { submitCardback, waitForCompletion, readComfyUIOutput } from './comfyui-queue.mjs';
import { submitStyledCardback, waitForStyledCompletion, readStyledOutput } from './stylelab-queue.mjs';
import { processCardback } from './image-pipeline.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const DB_PATH = resolve(__dirname, 'cardbacks.db');
const PORT = 5175;

const SEED_DIR = resolve(PROJECT_ROOT, 'src/data/seed');
const HIRES_DIR = resolve(PROJECT_ROOT, 'public/assets/cardbacks/hires');
const LOWRES_DIR = resolve(PROJECT_ROOT, 'public/assets/cardbacks/lowres');
const STYLELAB_OUTPUT_DIR = resolve(__dirname, 'stylelab-output');
const PROMPTLAB_OUTPUT_DIR = resolve(__dirname, 'promptlab-output');

// Ensure output directories exist
mkdirSync(HIRES_DIR, { recursive: true });
mkdirSync(LOWRES_DIR, { recursive: true });
mkdirSync(STYLELAB_OUTPUT_DIR, { recursive: true });
mkdirSync(PROMPTLAB_OUTPUT_DIR, { recursive: true });

const MANIFEST_PATH = resolve(PROJECT_ROOT, 'public/assets/cardbacks/manifest.json');

function writeManifest() {
  try {
    const lowresFiles = readdirSync(LOWRES_DIR)
      .filter(f => f.endsWith('.webp'))
      .map(f => f.replace('.webp', ''));
    writeFileSync(MANIFEST_PATH, JSON.stringify({ ids: lowresFiles, updatedAt: Date.now() }));
  } catch { /* non-critical */ }
}

// Write initial manifest on server start
writeManifest();

// --- Database Setup ---
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS cardbacks (
    fact_id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    category TEXT NOT NULL,
    fact_type TEXT NOT NULL,
    statement TEXT NOT NULL,
    visual_description TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT DEFAULT '',
    file_path_hires TEXT,
    file_path_lowres TEXT,
    comfyui_prompt_id TEXT,
    generated_at TEXT,
    reviewed_at TEXT,
    generation_count INTEGER DEFAULT 0,
    seed INTEGER
  );
`);

// Style Lab table
db.exec(`
  CREATE TABLE IF NOT EXISTS style_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fact_id TEXT NOT NULL,
    style_id TEXT NOT NULL,
    style_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    file_path TEXT,
    seed INTEGER,
    comfyui_prompt_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    UNIQUE(fact_id, style_id)
  );
`);

// Prompt Lab table
db.exec(`
  CREATE TABLE IF NOT EXISTS prompt_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fact_id TEXT NOT NULL,
    strategy_id TEXT NOT NULL,
    strategy_name TEXT NOT NULL,
    visual_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    file_path TEXT,
    seed INTEGER,
    comfyui_prompt_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    UNIQUE(fact_id, strategy_id)
  );
`);

// --- Style Presets (20 radically different pixel art philosophies) ---
const STYLE_PRESETS = [
  {
    id: 'dark-mood-baseline',
    name: '01 Dark Mood Baseline',
    styleSuffix: `centered in frame, pixel art trading card illustration, 32-bit era JRPG style, bold readable silhouette, rich saturated colors against a dark moody background, hand-pixeled, clean hard pixel edges, strong dark outlines, interesting microdetails, flat shading with minimal dithering, no gradients, no text, no UI elements, no border frame, no watermark, slight atmospheric glow around subject, game asset card art, vertical portrait composition, subject fills 80-90% of frame with breathing room at edges`,
    loraStrength: 0.3, numColors: 16, pixelationSize: 480, guidance: 4, steps: 20
  },
  {
    id: 'gameboy-dmg',
    name: '02 Game Boy DMG',
    styleSuffix: `rendered in original Game Boy 4-shade green monochrome palette only, darkest olive green to lightest yellow-green, extremely chunky blocky pixels where every single pixel is a deliberate placement, simplified to absolute essential shapes like a tiny overworld sprite blown up large, communicate form through silhouette and shape only with no fine detail, every pixel hand-placed with intentional precision, Link's Awakening and Pokemon Red sprite aesthetic, no anti-aliasing no smooth edges, hard blocky stepped pixel edges on all curves and diagonals, minimal detail maximum readability, centered vertical composition against dark green background, no text, no UI elements, no border frame`,
    loraStrength: 0.4, numColors: 4, pixelationSize: 240, guidance: 4, steps: 20
  },
  {
    id: 'nes-8bit',
    name: '03 NES 8-Bit',
    styleSuffix: `8-bit NES era pixel art with strict 8 color limit, punchy saturated primary colors chosen for maximum contrast and readability, heavy ordered dithering patterns used for all shading and tonal transitions, checkerboard and line dithering for midtones, blocky but expressive sprites like Final Fantasy 1 monster art or Mega Man boss sprites, every pixel carefully placed within tight constraints, subject fills entire frame with no wasted space, iconic and instantly readable even at tiny display sizes, strong black outlines with single-pixel width, centered composition, dark background, no text, no UI elements, no border frame, no anti-aliasing`,
    loraStrength: 0.4, numColors: 8, pixelationSize: 300, guidance: 4, steps: 20
  },
  {
    id: 'snes-battle',
    name: '04 SNES Battle Sprite',
    styleSuffix: `Super Nintendo RPG enemy battle sprite in the exact style of Final Fantasy 6 and Chrono Trigger monster art, 16 color palette with beautiful careful dithering for smooth tonal transitions, side-view perspective as if viewed in a JRPG battle encounter, dramatic battle-ready pose with sense of menace or power, rendered with the meticulous pixel-level craftsmanship of 16-bit era sprite artists, subject treated as a creature or boss you would fight, detailed within strict palette constraints, characteristic SNES-era color choices with deep shadows and bright highlights, flat dark background like a battle screen, centered composition, no text, no UI elements, no border frame`,
    loraStrength: 0.35, numColors: 16, pixelationSize: 400, guidance: 4.5, steps: 20
  },
  {
    id: 'gba-rich',
    name: '05 GBA Rich Sprite',
    styleSuffix: `Game Boy Advance era pixel art portrait with 24 color richness, vibrant hyper-saturated colors characteristic of Golden Sun and Fire Emblem GBA character portraits, expressive detailed faces with visible emotion, finely rendered equipment and clothing details, the sweet spot between retro charm and genuine detail, warm and vivid palette with smooth color ramps, each color carefully chosen to maximize the 24-color range, clean pixel art with anti-aliased edges on key curves, character-focused framing like a GBA dialogue portrait blown up, dark background, centered composition, no text, no UI elements, no border frame`,
    loraStrength: 0.3, numColors: 24, pixelationSize: 480, guidance: 4, steps: 20
  },
  {
    id: 'hd-pixel',
    name: '06 HD Pixel Art',
    styleSuffix: `modern indie HD pixel art in the style of Dead Cells Hyper Light Drifter and Octopath Traveler, smooth color gradients and atmospheric lighting effects blended with deliberate hard pixel edges on key outlines and silhouettes, volumetric light shafts and particle effects rendered at high resolution, rich detailed shading with no color quantization, subtle rim lighting and ambient occlusion, the pixel edges are an aesthetic choice not a technical limitation, cinematic composition with dramatic lighting against a moody atmospheric background, high detail count with layered depth, no text, no UI elements, no border frame, vertical portrait composition`,
    loraStrength: 0.2, numColors: 0, pixelationSize: 0, guidance: 4, steps: 25
  },
  {
    id: 'chibi-sd',
    name: '07 Chibi SD',
    styleSuffix: `super-deformed chibi proportions with oversized head taking up 40 percent of total body height, tiny stubby arms and legs, huge round expressive eyes with sparkle highlights, adorable and round with maximum cute personality, simplified body with exaggerated head features, RPG Maker and Stardew Valley character aesthetic, bright cheerful colors even against dark background, bouncy energetic pose suggesting movement and life, rounded soft shapes with clean pixel outlines, kawaii charm with game sprite readability, centered composition, dark background with subtle warmth, no text, no UI elements, no border frame, vertical portrait`,
    loraStrength: 0.3, numColors: 16, pixelationSize: 480, guidance: 4.5, steps: 20
  },
  {
    id: 'isometric-diorama',
    name: '08 Isometric Diorama',
    styleSuffix: `isometric 3/4 top-down perspective viewed from 45 degrees above, subject rendered standing on a small visible ground tile or platform like a tactics game unit, Final Fantasy Tactics and Disgaea sprite perspective with foreshortened proportions, the card becomes a tiny diorama scene viewed from above at an angle, subtle drop shadow on the ground plane, environment hints on the isometric tile beneath the subject, clean pixel art with isometric grid alignment on edges, 16-color palette with careful isometric shading where light comes from upper-left, dark void surrounding the illuminated diorama tile, no text, no UI elements, no border frame`,
    loraStrength: 0.3, numColors: 16, pixelationSize: 480, guidance: 5, steps: 20
  },
  {
    id: 'silhouette-dramatic',
    name: '09 Silhouette Dramatic',
    styleSuffix: `subject rendered as a bold dramatic pure black silhouette with only 2-3 key accent details picked out in a single vibrant color, nearly all form communicated through the outer contour shape alone, like Limbo or shadow puppet theater, maximum readability through silhouette, dramatic single-color rim light tracing one edge of the subject in hot orange or electric blue, the silhouette IS the entire artwork, vast dark negative space surrounding the crisp black shape, no internal detail except the few accent color highlights on eyes or weapon or key feature, stark and theatrical, vertical portrait composition, no text, no UI elements, no border frame`,
    loraStrength: 0.3, numColors: 8, pixelationSize: 480, guidance: 5, steps: 20
  },
  {
    id: 'dither-heavy',
    name: '10 Dither-Heavy Retro',
    styleSuffix: `ALL shading and tonal transitions rendered exclusively through heavy dithering patterns, checkerboard dither for midtones, ordered Bayer matrix dithering for gradients, crosshatch stipple patterns for shadows, the dithering texture IS the visual style like classic Macintosh or Atari ST graphics, near-monochrome palette with dithering providing all tonal range and depth, no solid fills larger than a few pixels, every surface textured with visible dither patterns, stark high-contrast with the dithering doing all the heavy lifting between light and dark, centered composition, dark background, no text, no UI elements, no border frame, vertical portrait`,
    loraStrength: 0.35, numColors: 8, pixelationSize: 360, guidance: 4, steps: 20
  },
  {
    id: 'painterly-mini',
    name: '11 Painterly Miniature',
    styleSuffix: `painted tabletop gaming miniature photographed against dark velvet, rich visible oil paint brushstrokes with impasto texture, dramatic chiaroscuro directional lighting from upper left casting deep shadows, Warhammer 40K painted figurine quality with edge highlighting and layered glazes, realistic proportions and anatomy, warm skin tones with cool shadow recesses, NOT pixel art at all but traditional painted miniature aesthetic, depth of field blur at edges suggesting macro photography of a real physical object, matte varnish finish, tabletop RPG miniature feel, dark background, centered composition, no text, no UI elements, no border frame`,
    loraStrength: 0.1, numColors: 0, pixelationSize: 0, guidance: 5, steps: 25
  },
  {
    id: 'chunky-icon',
    name: '12 Chunky 64px Icon',
    styleSuffix: `extremely chunky ultra-low-resolution pixel art as if designed for a 32x32 icon and blown up enormous, MAXIMUM pixel blockiness where individual pixels are huge and clearly visible, subject reduced to absolute bare essential geometric shapes, almost abstract in simplicity, every single pixel is a critical design decision, favicon and emoji design philosophy where you represent a complex concept in minimal pixel count, bold simple color blocks with no subtlety, stark readability at any size, centered composition, dark background, no text, no UI elements, no border frame, no dithering just solid pixel blocks`,
    loraStrength: 0.45, numColors: 8, pixelationSize: 120, guidance: 4, steps: 20
  },
  {
    id: 'detailed-scene',
    name: '13 Detailed Scene',
    styleSuffix: `full environmental scene where the subject exists within a richly detailed pixel art setting, background is as important as the foreground subject, visible ground terrain sky or ceiling and environmental objects surrounding the subject, like a tiny landscape painting in pixel art, subject occupies only 40-50 percent of the frame with the remaining space filled with contextual environment details, trees rocks buildings water weather effects or interior furnishings depending on subject, layered parallax depth with foreground middle and background elements, atmospheric perspective with distant elements lighter, 24-color palette, no text, no UI elements, no border frame, vertical portrait composition`,
    loraStrength: 0.25, numColors: 24, pixelationSize: 480, guidance: 4, steps: 25
  },
  {
    id: 'ink-wash',
    name: '14 Ink Wash Sumi-e',
    styleSuffix: `Japanese sumi-e ink wash painting aesthetic translated into pixels, limited strictly to black ink tones grey washes and one single accent color of vermillion red, flowing calligraphic brushstroke quality interpreted through pixel placement, abundant negative space with 60 percent or more of the image empty, subject rendered with minimal essential strokes implying form rather than explicitly defining every edge, zen minimalist philosophy where what is omitted matters more than what is shown, ink splatter and wash bleed effects at edges, contemplative and meditative atmosphere, vertical scroll painting composition, no text, no UI elements, no border frame`,
    loraStrength: 0.25, numColors: 8, pixelationSize: 480, guidance: 4.5, steps: 20
  },
  {
    id: 'sticker-flat',
    name: '15 Sticker / Flat Design',
    styleSuffix: `modern flat design sticker aesthetic with bold perfectly flat colors and absolutely zero shading zero gradients zero highlights, thick uniform-width dark outline around the entire subject like a die-cut vinyl sticker, geometric simplification of all forms into clean shapes, vector art precision meets pixel grid alignment, clean modern and instantly readable like a well-designed app icon or emoji, bright saturated flat color fills with no tonal variation within each color zone, white or very thick dark border surrounding the complete subject creating sticker cutout effect, centered composition, dark background, no text, no UI elements, no border frame`,
    loraStrength: 0.3, numColors: 12, pixelationSize: 480, guidance: 5, steps: 20
  },
  {
    id: 'ukiyo-e-woodblock',
    name: '16 Ukiyo-e Woodblock',
    styleSuffix: `authentic Japanese ukiyo-e woodblock print style with flat color planes separated by hard carved edges, characteristic ukiyo-e palette of indigo blue vermillion red ochre yellow and black, no gradients only flat color areas like carved woodblock layers, bold black outlines of varying thickness suggesting carved wood grain, dynamic composition with flowing fabric hair or natural elements, characteristic wave patterns cloud motifs and stylized water, Hokusai and Hiroshige aesthetic translated into pixel art, strong sense of graphic design and negative space, dramatic poses with theatrical kabuki energy, vertical composition, dark background, no text, no UI elements, no border frame`,
    loraStrength: 0.25, numColors: 12, pixelationSize: 480, guidance: 4.5, steps: 20
  },
  {
    id: 'tarot-arcana',
    name: '17 Tarot Arcana',
    styleSuffix: `mystical tarot card major arcana illustration with symmetrical sacred geometry framing, Art Nouveau organic border elements woven into the composition, esoteric occult symbolism with celestial motifs of stars moons and suns, rich jewel tone palette of deep purple amethyst burnished gold midnight blue and ruby, the subject rendered with mysterious gravitas as if depicting an archetypal cosmic force, ornamental and deeply symbolic composition, radiating lines and mandala patterns in the background, the subject framed as if revealing a universal truth, candlelit warmth mixed with cosmic mystery, vertical portrait composition perfectly centered, no text, no UI elements, no outer border frame`,
    loraStrength: 0.2, numColors: 16, pixelationSize: 480, guidance: 5, steps: 25
  },
  {
    id: 'ps1-prerender',
    name: '18 PS1 Pre-Rendered',
    styleSuffix: `PlayStation 1 era pre-rendered 3D sprite aesthetic, that specific chunky low-polygon 3D-rendered-to-2D-sprite look of Donkey Kong Country Final Fantasy 7 field sprites and Diablo 1, smooth Phong shading with visible polygon faceting artifacts, slightly uncanny 3D-to-2D conversion quality with baked lighting, rendered at a slight 3/4 angle suggesting fake 3D depth and volume, specular highlights on surfaces suggesting plastic or metallic CG materials, the characteristic early-CGI look that is neither pixel art nor photorealistic but its own distinct aesthetic, soft shadows baked into the sprite, dark background, centered composition, no text, no UI elements, no border frame`,
    loraStrength: 0.15, numColors: 32, pixelationSize: 360, guidance: 4, steps: 20
  },
  {
    id: 'maximalist-ornate',
    name: '19 Maximalist Ornate',
    styleSuffix: `every single pixel filled with intricate detail in baroque horror vacui style, dense ornamental complexity covering all surfaces with decorative filigree scrollwork and patterning, no empty space anywhere, like a medieval illuminated manuscript or densely detailed heavy metal album cover, intricate patterns on every surface of the subject including clothing skin architecture and background, decorative border elements growing organically from the subject itself, overwhelming beautiful excess of visual information, rich 24-color palette used to its fullest with detailed color transitions, the eye discovers new details on every viewing, centered composition, no text, no UI elements, no outer border frame, vertical portrait`,
    loraStrength: 0.25, numColors: 24, pixelationSize: 480, guidance: 5.5, steps: 30
  },
  {
    id: 'minimal-negative',
    name: '20 Minimal Negative Space',
    styleSuffix: `maximum emptiness and restraint, subject rendered with absolute minimum linework and detail floating in vast empty black negative space, only the essential contour outline and 1-2 key identifying details rendered, 70-80 percent of the image is pure empty dark void, the breathing room and emptiness IS the aesthetic, Japanese ma philosophy of meaningful negative space, what you leave out defines the art more than what you include, subject reduced to its most essential recognizable form with surgical precision, sparse and contemplative, a few perfect pixels in an ocean of nothing, centered composition, deep black background, no text, no UI elements, no border frame, vertical portrait`,
    loraStrength: 0.3, numColors: 8, pixelationSize: 480, guidance: 4.5, steps: 20
  },
];

// --- Production Style Routing ---
// These are the finalized styles used by the batch generator.
// Domain is detected from fact ID prefix.
const PRODUCTION_STYLES = {
  // Default for all non-Japanese cards (Dark Mood Baseline winner from Style Lab round 1)
  default: {
    styleSuffix: `centered in frame, pixel art trading card illustration, 32-bit era JRPG style, bold readable silhouette, rich saturated colors against a dark moody background, hand-pixeled, clean hard pixel edges, strong dark outlines, interesting microdetails, flat shading with minimal dithering, no gradients, no text, no UI elements, no border frame, no watermark, slight atmospheric glow around subject, game asset card art, vertical portrait composition, subject fills 80-90% of frame with breathing room at edges`,
    loraStrength: 0.3, numColors: 16, pixelationSize: 480, guidance: 4, steps: 20
  },
  // Japanese vocabulary cards — Ukiyo-e Woodblock (Style Lab #16)
  // Extra-strong "no text" reinforcement because Flux loves inserting kanji
  japanese: {
    styleSuffix: `authentic Japanese ukiyo-e woodblock print style with flat color planes separated by hard carved edges, characteristic ukiyo-e palette of indigo blue vermillion red ochre yellow and black, no gradients only flat color areas like carved woodblock layers, bold black outlines of varying thickness suggesting carved wood grain, dynamic composition with flowing fabric hair or natural elements, characteristic wave patterns cloud motifs and stylized water, Hokusai and Hiroshige aesthetic translated into pixel art, strong sense of graphic design and negative space, dramatic poses with theatrical kabuki energy, absolutely no text no writing no kanji no kana no hiragana no katakana no letters no characters no words no numbers no symbols no script of any kind anywhere in the image, pixel art trading card illustration, bold readable silhouette, hand-pixeled, clean hard pixel edges, strong dark outlines, interesting microdetails, flat shading with minimal dithering, no UI elements, no border frame, no watermark, game asset card art, vertical portrait composition, subject fills 80-90% of frame with breathing room at edges`,
    loraStrength: 0.25, numColors: 12, pixelationSize: 480, guidance: 4.5, steps: 20
  }
};

/**
 * Get the production style config for a given fact ID.
 * Routes Japanese vocab cards to Ukiyo-e, everything else to Dark Mood.
 * @param {string} factId
 * @returns {{ styleSuffix: string, loraStrength: number, numColors: number, pixelationSize: number, guidance: number, steps: number }}
 */
function getProductionStyle(factId) {
  if (factId.startsWith('ja-')) return PRODUCTION_STYLES.japanese;
  return PRODUCTION_STYLES.default;
}

// Style Lab test card fact_ids (same 10 cards as Prompt Lab)
const STYLE_LAB_CARD_IDS = [
  'ja-n3-039', 'ja-n3-068', 'ja-n3-105', 'ja-n3-200', 'ja-n3-001',
  'cult-001', 'cult-004', 'cult-007', 'cult-008', 'cult-006'
];

// Style Lab prepared statements
const stmtStyleInsert = db.prepare(`
  INSERT OR REPLACE INTO style_tests (fact_id, style_id, style_name, status, seed)
  VALUES (@fact_id, @style_id, @style_name, 'pending', @seed)
`);

const stmtStyleUpdate = db.prepare(`
  UPDATE style_tests
  SET status = @status,
      file_path = @file_path,
      comfyui_prompt_id = @comfyui_prompt_id,
      completed_at = @completed_at
  WHERE fact_id = @fact_id AND style_id = @style_id
`);

const stmtStyleGet = db.prepare(`
  SELECT * FROM style_tests WHERE fact_id = ? AND style_id = ?
`);

const stmtStyleResults = db.prepare(`
  SELECT * FROM style_tests ORDER BY fact_id, style_id
`);

// --- Style Lab Controller ---
class StyleLabController {
  #running = false;
  #stopRequested = false;
  #queue = [];
  #completed = 0;
  #failed = 0;
  #total = 0;
  #currentFactId = null;
  #currentStyleId = null;
  #sseClients = new Set();

  start(jobs) {
    if (this.#running) return;
    this.#running = true;
    this.#stopRequested = false;
    this.#queue = [...jobs];
    this.#completed = 0;
    this.#failed = 0;
    this.#total = jobs.length;
    this.#currentFactId = null;
    this.#currentStyleId = null;
    this.#processQueue();
  }

  stop() {
    this.#stopRequested = true;
  }

  isRunning() { return this.#running; }

  addSSEClient(res) {
    this.#sseClients.add(res);
  }

  removeSSEClient(res) {
    this.#sseClients.delete(res);
  }

  #broadcast(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.#sseClients) {
      try {
        client.write(data);
      } catch {
        this.#sseClients.delete(client);
      }
    }
  }

  async #processQueue() {
    while (this.#queue.length > 0 && !this.#stopRequested) {
      const job = this.#queue.shift();
      this.#currentFactId = job.factId;
      this.#currentStyleId = job.styleId;

      this.#broadcast({
        type: 'progress',
        completed: this.#completed,
        total: this.#total,
        currentFactId: job.factId,
        currentStyleId: job.styleId,
      });

      try {
        await generateStyleTest(job);
        this.#completed++;
        this.#broadcast({
          type: 'image_done',
          factId: job.factId,
          styleId: job.styleId,
          imageUrl: `/api/stylelab/image/${encodeURIComponent(job.factId)}/${encodeURIComponent(job.styleId)}`,
        });
      } catch (err) {
        this.#failed++;
        console.error(`Style test failed: ${job.factId}/${job.styleId}:`, err.message);
        this.#broadcast({
          type: 'image_error',
          factId: job.factId,
          styleId: job.styleId,
          message: err.message,
        });

        // Update DB status to error
        stmtStyleUpdate.run({
          fact_id: job.factId,
          style_id: job.styleId,
          status: 'error',
          file_path: null,
          comfyui_prompt_id: null,
          completed_at: new Date().toISOString(),
        });
      }
    }

    this.#currentFactId = null;
    this.#currentStyleId = null;
    this.#running = false;
    this.#broadcast({
      type: 'done',
      completed: this.#completed,
      failed: this.#failed,
    });
  }
}

const styleLabController = new StyleLabController();

// --- Style Lab Generation Helper ---
async function generateStyleTest(job) {
  const { factId, styleId, visualDescription, seed, styleConfig } = job;

  // Update DB to generating
  stmtStyleUpdate.run({
    fact_id: factId,
    style_id: styleId,
    status: 'generating',
    file_path: null,
    comfyui_prompt_id: null,
    completed_at: null,
  });

  // Submit to ComfyUI with style overrides
  const promptId = await submitStyledCardback(visualDescription, seed, styleConfig);
  const outputFiles = await waitForStyledCompletion(promptId);
  const rawPng = await readStyledOutput(outputFiles[0]);

  // Save output image
  const factDir = resolve(STYLELAB_OUTPUT_DIR, factId);
  mkdirSync(factDir, { recursive: true });
  const outputPath = resolve(factDir, `${styleId}.png`);
  writeFileSync(outputPath, rawPng);

  // Update DB
  stmtStyleUpdate.run({
    fact_id: factId,
    style_id: styleId,
    status: 'done',
    file_path: outputPath,
    comfyui_prompt_id: promptId,
    completed_at: new Date().toISOString(),
  });
}

// --- Prepared Statements ---
const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO cardbacks (fact_id, domain, category, fact_type, statement, visual_description)
  VALUES (@fact_id, @domain, @category, @fact_type, @statement, @visual_description)
`);

const stmtUpdateFilePaths = db.prepare(`
  UPDATE cardbacks
  SET file_path_hires = @file_path_hires,
      file_path_lowres = @file_path_lowres,
      status = CASE WHEN status = 'pending' THEN 'review' ELSE status END
  WHERE fact_id = @fact_id AND (file_path_hires IS NULL OR file_path_lowres IS NULL)
`);

const stmtGetById = db.prepare(`SELECT * FROM cardbacks WHERE fact_id = ?`);

const stmtUpdateReview = db.prepare(`
  UPDATE cardbacks SET status = @status, notes = @notes, reviewed_at = @reviewed_at WHERE fact_id = @fact_id
`);

const stmtUpdateDescription = db.prepare(`
  UPDATE cardbacks SET visual_description = @visual_description WHERE fact_id = @fact_id
`);

const stmtUpdateGenerating = db.prepare(`
  UPDATE cardbacks SET status = 'generating', generation_count = generation_count + 1 WHERE fact_id = ?
`);

const stmtUpdateGenerated = db.prepare(`
  UPDATE cardbacks
  SET status = 'review',
      file_path_hires = @file_path_hires,
      file_path_lowres = @file_path_lowres,
      comfyui_prompt_id = @comfyui_prompt_id,
      generated_at = @generated_at,
      seed = @seed
  WHERE fact_id = @fact_id
`);

const stmtRevertPending = db.prepare(`
  UPDATE cardbacks SET status = 'pending' WHERE fact_id = ?
`);

// --- Batch Controller ---
class BatchController {
  #running = false;
  #stopRequested = false;
  #queue = [];
  #completed = [];
  #failed = [];
  #current = null;
  #sseClients = new Set();

  start(factIds) {
    if (this.#running) return;
    this.#running = true;
    this.#stopRequested = false;
    this.#queue = [...factIds];
    this.#completed = [];
    this.#failed = [];
    this.#current = null;
    this.#processQueue();
  }

  stop() {
    this.#stopRequested = true;
  }

  getStatus() {
    return {
      running: this.#running,
      total: this.#queue.length + this.#completed.length + this.#failed.length + (this.#current ? 1 : 0),
      completed: this.#completed.length,
      failed: this.#failed.length,
      remaining: this.#queue.length,
      current: this.#current,
    };
  }

  addSSEClient(res) {
    this.#sseClients.add(res);
  }

  removeSSEClient(res) {
    this.#sseClients.delete(res);
  }

  #broadcast(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.#sseClients) {
      try {
        client.write(data);
      } catch {
        this.#sseClients.delete(client);
      }
    }
  }

  #saveCheckpoint() {
    const state = {
      running: this.#running,
      current: this.#current,
      completed: this.#completed,
      failed: this.#failed,
      remaining: this.#queue,
      timestamp: new Date().toISOString(),
    };
    try {
      writeFileSync(resolve(__dirname, 'batch-state.json'), JSON.stringify(state, null, 2));
    } catch {
      // Non-critical — continue processing
    }
  }

  async #processQueue() {
    while (this.#queue.length > 0 && !this.#stopRequested) {
      const factId = this.#queue.shift();
      this.#current = factId;

      this.#broadcast({
        type: 'progress',
        completed: this.#completed.length,
        total: this.#completed.length + this.#failed.length + this.#queue.length + 1,
        failed: this.#failed.length,
        current: factId,
      });

      try {
        await generateSingleCard(factId);
        this.#completed.push(factId);
        this.#broadcast({
          type: 'image_done',
          factId,
          thumbUrl: `/api/cards/${encodeURIComponent(factId)}/thumb`,
        });
      } catch (err) {
        this.#failed.push(factId);
        this.#broadcast({
          type: 'error',
          factId,
          message: err.message,
        });
      }

      this.#saveCheckpoint();
    }

    this.#current = null;
    this.#running = false;
    this.#broadcast({
      type: 'done',
      completed: this.#completed.length,
      failed: this.#failed.length,
    });
    this.#saveCheckpoint();
  }
}

const batchController = new BatchController();

// --- Card Generation Helper ---
async function generateSingleCard(factId) {
  const row = stmtGetById.get(factId);
  if (!row) throw new Error(`Card not found: ${factId}`);

  stmtUpdateGenerating.run(factId);

  try {
    // Submit to ComfyUI with domain-specific style
    const seed = Math.floor(Math.random() * 2 ** 32);
    const style = getProductionStyle(factId);
    const promptId = await submitStyledCardback(row.visual_description, seed, style);
    const outputFiles = await waitForStyledCompletion(promptId);
    const rawPng = await readStyledOutput(outputFiles[0]);

    // Process through image pipeline (resize, format conversion, etc.)
    const outputRoot = resolve(PROJECT_ROOT, 'public/assets/cardbacks');
    const { hiresPath, lowresPath } = await processCardback(rawPng, factId, outputRoot);

    // Update DB
    stmtUpdateGenerated.run({
      fact_id: factId,
      file_path_hires: hiresPath,
      file_path_lowres: lowresPath,
      comfyui_prompt_id: promptId,
      generated_at: new Date().toISOString(),
      seed: seed ?? null,
    });

    writeManifest();
    broadcastToGame({ type: 'cardback_ready', factId, url: `/assets/cardbacks/lowres/${factId}.webp` });

    return { hiresPath, lowresPath };
  } catch (err) {
    stmtRevertPending.run(factId);
    throw err;
  }
}

// --- Seed File Scanner ---
function scanSeedFiles() {
  const facts = [];

  function readJsonFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  function walkDir(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') {
        const data = readJsonFile(fullPath);
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.id && item.statement) {
              facts.push(item);
            }
          }
        }
      }
    }
  }

  walkDir(SEED_DIR);
  return facts;
}

// --- Express App ---
const app = express();
app.use(express.json());

// CORS for dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// SSE endpoint for game live-reload of cardbacks
const gameSSEClients = new Set();

app.get('/api/game/cardback-updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  gameSSEClients.add(res);
  req.on('close', () => gameSSEClients.delete(res));
});

function broadcastToGame(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of gameSSEClients) {
    try { client.write(data); } catch { gameSSEClients.delete(client); }
  }
}

// Static files
app.use(express.static(resolve(__dirname, 'public')));

// --- API Endpoints ---

// List all cards (with filters and pagination)
app.get('/api/cards', (req, res) => {
  const { domain, status, search, type, page, limit: limitParam } = req.query;
  const limitRaw = parseInt(limitParam);
  const limit = limitRaw === 0 ? null : Math.min(limitRaw || 50, 2000);
  const offset = limit ? ((parseInt(page) || 1) - 1) * limit : 0;

  let where = [];
  let params = {};

  if (domain) {
    where.push('domain = @domain');
    params.domain = domain;
  }
  if (status) {
    where.push('status = @status');
    params.status = status;
  }
  if (type) {
    where.push('fact_type = @type');
    params.type = type;
  }
  if (search) {
    where.push('(statement LIKE @search OR fact_id LIKE @search OR visual_description LIKE @search)');
    params.search = `%${search}%`;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = limit
    ? `SELECT * FROM cardbacks ${whereClause} ORDER BY domain, fact_id LIMIT @limit OFFSET @offset`
    : `SELECT * FROM cardbacks ${whereClause} ORDER BY domain, fact_id`;
  if (limit) {
    params.limit = limit;
    params.offset = offset;
  }

  const rows = db.prepare(sql).all(params);
  res.json(rows);
});

// Get single card
app.get('/api/cards/:id', (req, res) => {
  const row = stmtGetById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

// Serve lowres thumbnail
app.get('/api/cards/:id/thumb', (req, res) => {
  const row = stmtGetById.get(req.params.id);
  if (!row || !row.file_path_lowres || !existsSync(row.file_path_lowres)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ error: 'thumbnail not found' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(row.file_path_lowres);
});

// Serve hires full image
app.get('/api/cards/:id/full', (req, res) => {
  const row = stmtGetById.get(req.params.id);
  if (!row || !row.file_path_hires || !existsSync(row.file_path_hires)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ error: 'full image not found' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(row.file_path_hires);
});

// Review a card
app.post('/api/cards/:id/review', (req, res) => {
  const { status, notes } = req.body;
  const row = stmtGetById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be accepted or rejected' });
  }

  stmtUpdateReview.run({
    fact_id: req.params.id,
    status,
    notes: notes !== undefined ? notes : row.notes,
    reviewed_at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// Generate single card
app.post('/api/cards/:id/generate', async (req, res) => {
  const row = stmtGetById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });

  try {
    const result = await generateSingleCard(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update visual description
app.post('/api/cards/:id/description', (req, res) => {
  const { visualDescription } = req.body;
  const row = stmtGetById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });

  stmtUpdateDescription.run({
    fact_id: req.params.id,
    visual_description: visualDescription,
  });
  res.json({ ok: true });
});

// Scan seed files and populate DB
app.post('/api/scan', (req, res) => {
  const facts = scanSeedFiles();
  let added = 0;
  let updated = 0;

  const insertMany = db.transaction((items) => {
    for (const fact of items) {
      // Extract domain from category array (first element) or use 'unknown'
      const categoryArr = Array.isArray(fact.category) ? fact.category : [];
      const domain = categoryArr[0] || 'unknown';
      const category = categoryArr.join(' > ');

      const result = stmtInsert.run({
        fact_id: fact.id,
        domain,
        category,
        fact_type: fact.type || 'fact',
        statement: fact.statement,
        visual_description: fact.visualDescription || null,
      });
      if (result.changes > 0) added++;

      // Check if hires/lowres files already exist on disk
      const hiresPath = resolve(HIRES_DIR, `${fact.id}.png`);
      const lowresPath = resolve(LOWRES_DIR, `${fact.id}.webp`);
      const hiresExists = existsSync(hiresPath);
      const lowresExists = existsSync(lowresPath);

      if (hiresExists || lowresExists) {
        const upResult = stmtUpdateFilePaths.run({
          fact_id: fact.id,
          file_path_hires: hiresExists ? hiresPath : null,
          file_path_lowres: lowresExists ? lowresPath : null,
        });
        if (upResult.changes > 0) updated++;
      }
    }
  });

  insertMany(facts);
  writeManifest();

  const total = db.prepare('SELECT COUNT(*) as count FROM cardbacks').get().count;
  res.json({ added, updated, total });
});

// Stats
app.get('/api/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='generating' THEN 1 ELSE 0 END) as generating,
      SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected
    FROM cardbacks
  `).get();
  res.json(stats);
});

// Domains
app.get('/api/domains', (req, res) => {
  const domains = db.prepare('SELECT DISTINCT domain FROM cardbacks ORDER BY domain').all();
  res.json(domains.map(d => d.domain));
});

// Batch start
app.post('/api/batch/start', (req, res) => {
  const status = batchController.getStatus();
  if (status.running) {
    return res.status(409).json({ error: 'Batch already running', ...status });
  }

  const { filter } = req.body || {};
  let where = [];
  let params = {};

  // Only generate cards that need it (pending or rejected)
  where.push("status IN ('pending', 'rejected')");

  if (filter?.domain) {
    where.push('domain = @domain');
    params.domain = filter.domain;
  }
  if (filter?.status) {
    where.push('status = @filterStatus');
    params.filterStatus = filter.status;
  }
  if (filter?.type) {
    where.push('fact_type = @type');
    params.type = filter.type;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT fact_id FROM cardbacks ${whereClause} ORDER BY domain, fact_id`).all(params);
  const factIds = rows.map(r => r.fact_id);

  if (factIds.length === 0) {
    return res.json({ message: 'No cards to generate', total: 0 });
  }

  batchController.start(factIds);
  res.json({ message: 'Batch started', total: factIds.length });
});

// Batch stop
app.post('/api/batch/stop', (req, res) => {
  batchController.stop();
  res.json({ ok: true, ...batchController.getStatus() });
});

// Force quit: interrupt ComfyUI + clear queue + stop batch + revert generating cards
app.post('/api/force-quit', async (req, res) => {
  // 1. Stop batch controller
  batchController.stop();

  let comfyStatus = { interrupted: false, cleared: false, deleted: [] };

  try {
    // 2. Get current ComfyUI queue state to find running/pending prompt IDs
    const queueRes = await fetch('http://localhost:8188/queue');
    if (queueRes.ok) {
      const queue = await queueRes.json();
      const runningIds = (queue.queue_running || []).map(item => item[1]);
      const pendingIds = (queue.queue_pending || []).map(item => item[1]);
      const allIds = [...runningIds, ...pendingIds];

      // 3. Send interrupt (works between node executions)
      await fetch('http://localhost:8188/interrupt', { method: 'POST' }).catch(() => {});
      comfyStatus.interrupted = true;

      // 4. Delete all queued items explicitly by prompt_id
      if (allIds.length > 0) {
        await fetch('http://localhost:8188/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delete: allIds }),
        }).catch(() => {});
        comfyStatus.deleted = allIds;
      }

      // 5. Also clear pending queue as belt-and-suspenders
      await fetch('http://localhost:8188/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      }).catch(() => {});
      comfyStatus.cleared = true;

      // 6. Send interrupt again after delete (catches edge case where
      //    new node started between our queue read and delete)
      await fetch('http://localhost:8188/interrupt', { method: 'POST' }).catch(() => {});
    }
  } catch (e) {
    console.warn('Could not communicate with ComfyUI:', e.message);
  }

  // 7. Revert all 'generating' cards back to 'pending'
  const generating = db.prepare("SELECT fact_id FROM cardbacks WHERE status = 'generating'").all();
  for (const row of generating) {
    stmtRevertPending.run(row.fact_id);
  }

  res.json({ ok: true, reverted: generating.length, comfy: comfyStatus, ...batchController.getStatus() });
});

// Batch status (SSE stream)
app.get('/api/batch/status', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send current status immediately
  const status = batchController.getStatus();
  res.write(`data: ${JSON.stringify({ type: 'progress', ...status })}\n\n`);

  batchController.addSSEClient(res);

  req.on('close', () => {
    batchController.removeSSEClient(res);
  });
});

// --- Style Lab API Endpoints ---

// Get all style presets
app.get('/api/stylelab/presets', (req, res) => {
  res.json(STYLE_PRESETS);
});

// Get test cards (same 10 cards as Prompt Lab)
app.get('/api/stylelab/test-cards', (req, res) => {
  const cards = [];
  for (const id of STYLE_LAB_CARD_IDS) {
    const row = stmtGetById.get(id);
    if (row) cards.push(row);
  }

  res.json(cards);
});

// Start style lab generation
app.post('/api/stylelab/start', (req, res) => {
  if (styleLabController.isRunning()) {
    return res.status(409).json({ error: 'Style Lab generation already running' });
  }

  const { cardIds, styleIds } = req.body || {};
  if (!cardIds || !cardIds.length || !styleIds || !styleIds.length) {
    return res.status(400).json({ error: 'cardIds and styleIds are required' });
  }

  // Clear old style_tests rows for the selected cards/styles to force regeneration
  const stmtDeleteStyle = db.prepare('DELETE FROM style_tests WHERE fact_id = ? AND style_id = ?');
  for (const cardId of cardIds) {
    for (const styleId of styleIds) {
      stmtDeleteStyle.run(cardId, styleId);
    }
  }

  // Build job queue
  const jobs = [];
  const presetMap = new Map(STYLE_PRESETS.map(p => [p.id, p]));

  // Generate one fixed seed per card
  const cardSeeds = new Map();
  for (const cardId of cardIds) {
    cardSeeds.set(cardId, Math.floor(Math.random() * 2 ** 32));
  }

  for (const cardId of cardIds) {
    // Prefer hyper-literal description from PROMPT_DESCRIPTIONS, fall back to DB visual_description
    const literalDesc = PROMPT_DESCRIPTIONS[cardId]?.literal;
    const card = stmtGetById.get(cardId);
    const visualDescription = literalDesc || card?.visual_description;
    if (!visualDescription) continue;

    const seed = cardSeeds.get(cardId);

    for (const styleId of styleIds) {
      const preset = presetMap.get(styleId);
      if (!preset) continue;

      // Insert DB row
      stmtStyleInsert.run({
        fact_id: cardId,
        style_id: styleId,
        style_name: preset.name,
        seed,
      });

      jobs.push({
        factId: cardId,
        styleId,
        visualDescription,
        seed,
        styleConfig: {
          styleSuffix: preset.styleSuffix,
          loraStrength: preset.loraStrength,
          numColors: preset.numColors,
          pixelationSize: preset.pixelationSize,
          guidance: preset.guidance,
          steps: preset.steps,
        },
      });
    }
  }

  if (jobs.length === 0) {
    return res.json({ message: 'No valid cards found', total: 0 });
  }

  styleLabController.start(jobs);
  res.json({ message: 'Style Lab generation started', total: jobs.length });
});

// Style Lab SSE status stream
app.get('/api/stylelab/status', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial keepalive
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  styleLabController.addSSEClient(res);

  req.on('close', () => {
    styleLabController.removeSSEClient(res);
  });
});

// Stop style lab generation
app.post('/api/stylelab/stop', (req, res) => {
  styleLabController.stop();
  res.json({ ok: true });
});

// Serve a style test image
app.get('/api/stylelab/image/:factId/:styleId', (req, res) => {
  const imgPath = resolve(STYLELAB_OUTPUT_DIR, req.params.factId, `${req.params.styleId}.png`);
  if (!existsSync(imgPath)) {
    return res.status(404).json({ error: 'image not found' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(imgPath);
});

// Get all style test results
app.get('/api/stylelab/results', (req, res) => {
  const rows = stmtStyleResults.all();
  res.json(rows);
});

// --- Prompt Lab Constants ---
const PROMPT_LAB_CARDS = [
  'ja-n3-039', 'ja-n3-068', 'ja-n3-105', 'ja-n3-200', 'ja-n3-001',
  'cult-001', 'cult-004', 'cult-007', 'cult-008', 'cult-006'
];

const PROMPT_STRATEGIES = [
  { id: 'current', name: 'S1: Current (Literary)' },
  { id: 'iconic', name: 'S2: Iconic Object' },
  { id: 'action', name: 'S3: Action Freeze' },
  { id: 'fantasy', name: 'S4: Fantasy Mnemonic' },
  { id: 'literal', name: 'S5: Hyper-Literal' },
];

const PROMPT_LAB_CARD_INFO = {
  'ja-n3-039': { label: '割る (わる) = to break / to divide', type: 'vocab' },
  'ja-n3-068': { label: '謝る (あやまる) = to apologize', type: 'vocab' },
  'ja-n3-105': { label: '景色 (けしき) = scenery / view', type: 'vocab' },
  'ja-n3-200': { label: 'むしろ = rather / on the contrary', type: 'vocab' },
  'ja-n3-001': { label: '届ける (とどける) = to deliver', type: 'vocab' },
  'cult-001': { label: 'The Mona Lisa has no eyebrows', type: 'fact' },
  'cult-004': { label: 'Odin sacrificed his eye for wisdom', type: 'fact' },
  'cult-007': { label: 'Mary Shelley wrote Frankenstein at 18 during a storm', type: 'fact' },
  'cult-008': { label: 'Chocolate was originally a bitter spicy drink', type: 'fact' },
  'cult-006': { label: 'Eiffel Tower saved from demolition by being a radio antenna', type: 'fact' },
};

const PROMPT_DESCRIPTIONS = {
  'ja-n3-039': {
    current: null,
    iconic: "A large glowing crystal sphere cracked perfectly in half, the two halves drifting apart with magical energy leaking from the bright fracture line, shards of light escaping the break",
    action: "A clay pot shattering on a stone floor at the exact moment of impact, ceramic pieces flying outward in all directions, cracks radiating from the point of breakage",
    fantasy: "A massive magical barrier shattering from a powerful spell impact, cracks spreading across a translucent shield wall like breaking glass, glowing fragments dissolving into sparkles",
    literal: "A wooden log being split cleanly down the middle by an axe blade, the two halves falling apart in opposite directions, fresh wood grain exposed at the clean split",
  },
  'ja-n3-068': {
    current: null,
    iconic: "A single wilting flower drooping downward in shame, petals gently falling off, presented by two open hands reaching forward as an offering of remorse",
    action: "A person bowing very deeply with their forehead nearly touching the ground, hands flat on the floor, their entire body expressing deep sincere regret and apology",
    fantasy: "A knight kneeling before a glowing throne with helmet removed and head bowed in shame, their sword laid flat on the ground as a gesture of remorse and apology",
    literal: "A person with closed eyes bowing their head low with both hands pressed together in front of their chest, clearly saying sorry, a broken vase lying in pieces on the floor beside them",
  },
  'ja-n3-105': {
    current: null,
    iconic: "A large ornate stone window frame looking out onto a breathtaking mountain landscape with waterfalls, layered clouds, and a dramatic sunset, the window perfectly framing the stunning view",
    action: "A tiny silhouette of a person standing at the edge of a vast cliff, arms spread wide in awe, a massive panoramic landscape of mountains valleys and rivers stretching endlessly before them",
    fantasy: "A magical portal opening to reveal an impossibly beautiful landscape beyond, floating islands, crystal waterfalls, aurora in the sky, the most awe-inspiring scenery imaginable",
    literal: "A stunning panoramic mountain vista seen through a natural stone archway, rolling green hills, a winding river below, dramatic colorful sunset sky, the most beautiful scenic view",
  },
  'ja-n3-200': {
    current: null,
    iconic: "Two arrows side by side, one pointing right crossed out with a bold red X, the other arrow pointing left glowing brightly with golden light, choosing the unexpected opposite direction",
    action: "A figure at a fork in the road firmly turning away from a bright golden path and walking confidently toward a dark mysterious forest path instead, making the unexpected choice",
    fantasy: "A wizard pushing away an offered golden chalice with one hand while reaching for a simple wooden cup on the other side of the table, magical sparks highlighting the surprising opposite choice",
    literal: "A hand firmly pushing away a plate of fancy cake while eagerly reaching for a simple bowl of fruit instead, clearly choosing the opposite of what was expected",
  },
  'ja-n3-001': {
    current: null,
    iconic: "A sealed letter with a bright red wax seal being passed between two pairs of hands, one giving and one receiving, the exact moment of delivery captured mid-exchange",
    action: "A messenger bird with spread wings landing on an outstretched hand, a small scroll tied to its leg with a ribbon, the package arriving at its destination",
    fantasy: "A glowing magical package floating through a stone dungeon corridor trailing sparkles behind it, approaching a pair of waiting outstretched hands at the end of the hall",
    literal: "A delivery person in uniform handing a wrapped brown package to someone standing in a doorway, the box being passed clearly from one person to another, an obvious delivery",
  },
  'cult-001': {
    current: null,
    iconic: "A close-up of a woman's face in Renaissance oil painting style, showing smooth bare skin above her eyes where eyebrows should be, her famous mysterious slight smile visible below",
    action: "A Renaissance noblewoman sitting at a vanity mirror carefully plucking the last hair from her eyebrow with tweezers, her reflection showing one bare brow and one still with hair",
    fantasy: "The Mona Lisa portrait hanging on an ancient dungeon wall, a magical magnifying glass floating in front of her face, enlarging the area above her eyes to reveal the complete absence of eyebrows",
    literal: "A Renaissance woman's face painted in classic oil portrait style, zoomed in to clearly show her forehead and eyes, with completely smooth bare skin where eyebrows would normally be, no hair above the eyes at all",
  },
  'cult-004': {
    current: null,
    iconic: "A single glowing eye floating inside a deep stone well filled with shimmering water, Norse runes carved around the well's edge, two ravens perched on opposite sides watching",
    action: "A powerful bearded Norse god reaching toward his own face to remove his eye, the eye glowing brilliantly as it separates, a deep well of glowing knowledge water below him",
    fantasy: "A one-eyed Norse god hanging from a massive cosmic tree branch, his removed eye descending in a trail of light into a runic well of wisdom below, ravens circling overhead",
    literal: "A muscular bearded man with one empty dark eye socket holding a glowing eyeball in his outstretched hand over a deep stone well, dropping his own eye into the water to gain wisdom",
  },
  'cult-007': {
    current: null,
    iconic: "A young woman's hands writing by candlelight, a violent lightning bolt outside the window casting the shadow of a massive stitched-together monster on the wall behind her",
    action: "A teenage girl writing frantically at a desk during a violent thunderstorm, her quill scratching paper, a flash of lightning outside forming the unmistakable silhouette of Frankenstein's monster",
    fantasy: "A young woman at a candlelit writing desk, magical sparks flying from her quill pen, the sparks forming and animating a towering creature made of stitched body parts rising from the pages",
    literal: "A very young woman barely eighteen writing in a leather journal by candlelight while a massive lightning storm rages outside, the silhouette of a tall stitched-together monster visible in the window",
  },
  'cult-008': {
    current: null,
    iconic: "An ornate Aztec ceramic ceremonial cup overflowing with dark brown foamy liquid, whole red chili peppers floating in the drink, raw cacao pods scattered around the base, steam rising",
    action: "An Aztec warrior grimacing and wincing as they drink a dark bitter frothy brown liquid from a ceremonial clay cup, chili peppers and cacao beans visible on the stone table",
    fantasy: "A bubbling cauldron of thick dark chocolate liquid with bright red chili peppers and exotic spices swirling around inside it, bitter steam rising in skull shapes, Aztec mask decorations on the wall",
    literal: "A rough clay cup filled to the brim with dark brown bitter liquid with red chili peppers and spices floating in it, no sugar anywhere in sight, raw cacao pods beside the cup, clearly not sweet",
  },
  'cult-006': {
    current: null,
    iconic: "The Eiffel Tower with a massive radio antenna mounted on its very top, bold visible radio waves emanating outward in concentric circles, the tower glowing with transmitted electrical signals",
    action: "Workers on scaffolding installing a large radio antenna on the peak of the Eiffel Tower, electrical sparks and radio waves pulsing outward while a demolished wrecking ball crane sits idle below",
    fantasy: "The Eiffel Tower shooting powerful magical radio beams from its peak into the sky, a ghostly demolition crew below fading away in defeat, the tower saved from destruction by its new purpose",
    literal: "The Eiffel Tower with radio waves clearly emanating from its top, a wrecking ball crane stopped and abandoned right next to it, the tower saved from being torn down because it became a useful radio antenna",
  },
};

// --- Prompt Lab Prepared Statements ---
const stmtPromptInsert = db.prepare(`
  INSERT OR REPLACE INTO prompt_tests (fact_id, strategy_id, strategy_name, visual_description, status, seed)
  VALUES (@fact_id, @strategy_id, @strategy_name, @visual_description, 'pending', @seed)
`);

const stmtPromptUpdate = db.prepare(`
  UPDATE prompt_tests
  SET status = @status,
      file_path = @file_path,
      comfyui_prompt_id = @comfyui_prompt_id,
      completed_at = @completed_at
  WHERE fact_id = @fact_id AND strategy_id = @strategy_id
`);

const stmtPromptGet = db.prepare(`
  SELECT * FROM prompt_tests WHERE fact_id = ? AND strategy_id = ?
`);

const stmtPromptResults = db.prepare(`
  SELECT * FROM prompt_tests ORDER BY fact_id, strategy_id
`);

// --- Prompt Lab Controller ---
class PromptLabController {
  #running = false;
  #stopRequested = false;
  #queue = [];
  #completed = 0;
  #failed = 0;
  #total = 0;
  #currentFactId = null;
  #currentStrategyId = null;
  #sseClients = new Set();

  start(jobs) {
    if (this.#running) return;
    this.#running = true;
    this.#stopRequested = false;
    this.#queue = [...jobs];
    this.#completed = 0;
    this.#failed = 0;
    this.#total = jobs.length;
    this.#currentFactId = null;
    this.#currentStrategyId = null;
    this.#processQueue();
  }

  stop() {
    this.#stopRequested = true;
  }

  isRunning() { return this.#running; }

  addSSEClient(res) {
    this.#sseClients.add(res);
  }

  removeSSEClient(res) {
    this.#sseClients.delete(res);
  }

  #broadcast(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.#sseClients) {
      try {
        client.write(data);
      } catch {
        this.#sseClients.delete(client);
      }
    }
  }

  async #processQueue() {
    while (this.#queue.length > 0 && !this.#stopRequested) {
      const job = this.#queue.shift();
      this.#currentFactId = job.factId;
      this.#currentStrategyId = job.strategyId;

      this.#broadcast({
        type: 'progress',
        completed: this.#completed,
        total: this.#total,
        currentFactId: job.factId,
        currentStrategyId: job.strategyId,
      });

      try {
        await generatePromptTest(job);
        this.#completed++;
        this.#broadcast({
          type: 'image_done',
          factId: job.factId,
          strategyId: job.strategyId,
          imageUrl: `/api/promptlab/image/${encodeURIComponent(job.factId)}/${encodeURIComponent(job.strategyId)}`,
        });
      } catch (err) {
        this.#failed++;
        console.error(`Prompt test failed: ${job.factId}/${job.strategyId}:`, err.message);
        this.#broadcast({
          type: 'image_error',
          factId: job.factId,
          strategyId: job.strategyId,
          message: err.message,
        });

        stmtPromptUpdate.run({
          fact_id: job.factId,
          strategy_id: job.strategyId,
          status: 'error',
          file_path: null,
          comfyui_prompt_id: null,
          completed_at: new Date().toISOString(),
        });
      }
    }

    this.#currentFactId = null;
    this.#currentStrategyId = null;
    this.#running = false;
    this.#broadcast({
      type: 'done',
      completed: this.#completed,
      failed: this.#failed,
    });
  }
}

const promptLabController = new PromptLabController();

// --- Prompt Lab Generation Helper ---
async function generatePromptTest(job) {
  const { factId, strategyId, visualDescription, seed, styleConfig } = job;

  stmtPromptUpdate.run({
    fact_id: factId,
    strategy_id: strategyId,
    status: 'generating',
    file_path: null,
    comfyui_prompt_id: null,
    completed_at: null,
  });

  const promptId = await submitStyledCardback(visualDescription, seed, styleConfig);
  const outputFiles = await waitForStyledCompletion(promptId);
  const rawPng = await readStyledOutput(outputFiles[0]);

  const factDir = resolve(PROMPTLAB_OUTPUT_DIR, factId);
  mkdirSync(factDir, { recursive: true });
  const outputPath = resolve(factDir, `${strategyId}.png`);
  writeFileSync(outputPath, rawPng);

  stmtPromptUpdate.run({
    fact_id: factId,
    strategy_id: strategyId,
    status: 'done',
    file_path: outputPath,
    comfyui_prompt_id: promptId,
    completed_at: new Date().toISOString(),
  });
}

// --- Prompt Lab API Endpoints ---

app.get('/api/promptlab/strategies', (req, res) => {
  res.json(PROMPT_STRATEGIES);
});

app.get('/api/promptlab/cards', (req, res) => {
  const cards = PROMPT_LAB_CARDS.map(factId => {
    const info = PROMPT_LAB_CARD_INFO[factId] || {};
    const dbRow = stmtGetById.get(factId);
    const descriptions = {};
    for (const s of PROMPT_STRATEGIES) {
      if (s.id === 'current') {
        descriptions[s.id] = dbRow?.visual_description || '(no description in DB)';
      } else {
        descriptions[s.id] = PROMPT_DESCRIPTIONS[factId]?.[s.id] || '';
      }
    }
    return {
      factId,
      label: info.label || factId,
      type: info.type || 'unknown',
      statement: dbRow?.statement || info.label || factId,
      descriptions,
    };
  });
  res.json(cards);
});

app.post('/api/promptlab/start', (req, res) => {
  if (promptLabController.isRunning()) {
    return res.status(409).json({ error: 'Prompt Lab generation already running' });
  }

  const { cardIds, strategyIds } = req.body || {};
  if (!cardIds || !cardIds.length || !strategyIds || !strategyIds.length) {
    return res.status(400).json({ error: 'cardIds and strategyIds are required' });
  }

  const dungeonTorchStyle = STYLE_PRESETS.find(p => p.id === 'dungeon-torch') || STYLE_PRESETS[1];
  const styleConfig = {
    styleSuffix: dungeonTorchStyle.styleSuffix,
    loraStrength: dungeonTorchStyle.loraStrength,
    numColors: dungeonTorchStyle.numColors,
    pixelationSize: dungeonTorchStyle.pixelationSize,
    guidance: dungeonTorchStyle.guidance,
    steps: dungeonTorchStyle.steps,
  };

  // Generate one fixed seed per card
  const cardSeeds = new Map();
  for (const cardId of cardIds) {
    cardSeeds.set(cardId, Math.floor(Math.random() * 2 ** 32));
  }

  const jobs = [];
  for (const cardId of cardIds) {
    if (!PROMPT_DESCRIPTIONS[cardId]) continue;
    const seed = cardSeeds.get(cardId);
    const dbRow = stmtGetById.get(cardId);

    for (const strategyId of strategyIds) {
      const strategy = PROMPT_STRATEGIES.find(s => s.id === strategyId);
      if (!strategy) continue;

      // Get description
      let description;
      if (strategyId === 'current') {
        description = dbRow?.visual_description;
        if (!description) continue; // Skip if no DB description for current
      } else {
        description = PROMPT_DESCRIPTIONS[cardId][strategyId];
        if (!description) continue;
      }

      // Check if already done
      const existing = stmtPromptGet.get(cardId, strategyId);
      if (existing && existing.status === 'done' && existing.file_path && existsSync(existing.file_path)) {
        continue;
      }

      stmtPromptInsert.run({
        fact_id: cardId,
        strategy_id: strategyId,
        strategy_name: strategy.name,
        visual_description: description,
        seed,
      });

      jobs.push({
        factId: cardId,
        strategyId,
        visualDescription: description,
        seed,
        styleConfig,
      });
    }
  }

  if (jobs.length === 0) {
    return res.json({ message: 'All combinations already generated', total: 0 });
  }

  promptLabController.start(jobs);
  res.json({ message: 'Prompt Lab generation started', total: jobs.length });
});

app.get('/api/promptlab/status', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  promptLabController.addSSEClient(res);
  req.on('close', () => {
    promptLabController.removeSSEClient(res);
  });
});

app.post('/api/promptlab/stop', (req, res) => {
  promptLabController.stop();
  res.json({ ok: true });
});

app.get('/api/promptlab/image/:factId/:strategyId', (req, res) => {
  const imgPath = resolve(PROMPTLAB_OUTPUT_DIR, req.params.factId, `${req.params.strategyId}.png`);
  if (!existsSync(imgPath)) {
    return res.status(404).json({ error: 'image not found' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(imgPath);
});

app.get('/api/promptlab/results', (req, res) => {
  const rows = stmtPromptResults.all();
  res.json(rows);
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Cardback Dashboard running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`Seed dir: ${SEED_DIR}`);
  console.log(`Output: ${HIRES_DIR} / ${LOWRES_DIR}`);
});
