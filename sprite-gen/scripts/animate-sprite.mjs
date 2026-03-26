/**
 * animate-sprite.mjs — LTX-2.3 sprite animation pipeline via ComfyUI
 *
 * Takes a static sprite PNG, uploads it to ComfyUI, runs the LTX-2.3 video
 * generation workflow, downloads the output frames, removes backgrounds with
 * rembg, and encodes transparent WebM + spritesheet PNG + preview MP4.
 *
 * Usage:
 *   node sprite-gen/scripts/animate-sprite.mjs --sprite src/assets/sprites/goblin.png
 *   node sprite-gen/scripts/animate-sprite.mjs --sprite goblin.png --prompt "..."
 *   node sprite-gen/scripts/animate-sprite.mjs --sprite goblin.png --duration 3 --seed 42
 *   node sprite-gen/scripts/animate-sprite.mjs --sprite goblin.png --skip-generate
 *   node sprite-gen/scripts/animate-sprite.mjs --sprite goblin.png --skip-postprocess
 *
 * Dependencies:
 *   npm install sharp
 *   ComfyUI with LTX-2.3 model + rembg python package in ComfyUI venv
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { basename, extname, join, resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

const COMFYUI_URL = 'http://localhost:8188';
const COMFYUI_DIR = '/Users/damion/CODE/Terry-pron/runtime/comfyui';
const COMFYUI_PYTHON = `${COMFYUI_DIR}/.venv/bin/python`;
const WORKFLOW_PATH = join(PROJECT_ROOT, 'sprite-gen/workflows/ltx-sprite-animate-api.json');
const DEFAULT_OUTPUT_DIR = join(PROJECT_ROOT, 'sprite-gen/output/animations');

/** Padding ratio added by the workflow around the sprite before generation */
const PADDING_RATIO = 100 / 1224;

const DEFAULT_NEGATIVE =
  'Negative prompt:\nCamera movement, zoom, pan, tilt, background scenery, realistic, 3D render, smooth animation, environment, floor texture, shadows on background, swaying up and down, morphing shape, extra limbs, deformation, melting';

// ---------------------------------------------------------------------------
// Dependency check
// ---------------------------------------------------------------------------

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error(
    '\n[ERROR] "sharp" is not installed.\n' +
      '  Run:  npm install sharp\n' +
      '  Then re-run this script.\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1: Upload sprite to ComfyUI
// ---------------------------------------------------------------------------

/**
 * Uploads a sprite PNG to ComfyUI's input directory via multipart form.
 * @param {string} spritePath - Absolute path to the sprite PNG
 * @param {string} comfyuiUrl - Base URL of the ComfyUI server
 * @returns {Promise<string>} The filename as stored by ComfyUI
 */
async function uploadSprite(spritePath, comfyuiUrl) {
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const filename = basename(spritePath);
  const fileData = await readFile(spritePath);

  const parts = [];
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
  );
  parts.push(fileData);
  parts.push(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\n`
  );
  parts.push(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\ninput`
  );
  parts.push(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat(
    parts.map(p => (typeof p === 'string' ? Buffer.from(p) : p))
  );

  const resp = await fetch(`${comfyuiUrl}/upload/image`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });

  if (!resp.ok) {
    throw new Error(`Upload failed: HTTP ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  return data.name;
}

// ---------------------------------------------------------------------------
// Step 2: Build workflow from template
// ---------------------------------------------------------------------------

/**
 * Loads the workflow JSON template and injects all runtime parameters.
 * @param {string} templatePath - Path to the workflow JSON file
 * @param {object} params
 * @returns {object} Parameterized workflow ready for submission
 */
function buildWorkflow(templatePath, { imageName, prompt, duration, width, height, seed, name }) {
  const wf = JSON.parse(readFileSync(templatePath, 'utf-8'));

  // Input image nodes
  wf['217'].inputs.image = imageName;
  wf['45'].inputs.image = imageName;
  wf['47'].inputs.image = imageName;

  // Positive prompt
  wf['16'].inputs.text = prompt;

  // Generation parameters
  wf['15'].inputs.noise_seed = seed;
  wf['166'].inputs.value = width;
  wf['167'].inputs.value = height;
  wf['169'].inputs.value = duration;

  // Output naming
  wf['43'].inputs.filename_prefix = `sprite-anim/${name}`;
  wf['224'].inputs.filename_prefix = `sprite-anim-frames/${name}`;

  // Resize targets (2x for pre-padding by workflow)
  wf['219'].inputs.target_width = width * 2;
  wf['219'].inputs.target_height = height * 2;

  return wf;
}

// ---------------------------------------------------------------------------
// Step 3: Submit workflow and poll for completion
// ---------------------------------------------------------------------------

/**
 * Submits a workflow to ComfyUI and returns the prompt ID.
 * @param {object} workflow - Parameterized workflow object
 * @param {string} comfyuiUrl - Base URL of the ComfyUI server
 * @returns {Promise<string>} The prompt ID assigned by ComfyUI
 */
async function submitWorkflow(workflow, comfyuiUrl) {
  const resp = await fetch(`${comfyuiUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: 'sprite-animate' }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Workflow submission failed: HTTP ${resp.status} — ${text}`);
  }

  const data = await resp.json();
  if (data.node_errors && Object.keys(data.node_errors).length > 0) {
    throw new Error(`Workflow node errors: ${JSON.stringify(data.node_errors, null, 2)}`);
  }

  return data.prompt_id;
}

/**
 * Polls ComfyUI history until the prompt completes (success or error).
 * @param {string} promptId - The prompt ID returned by submitWorkflow
 * @param {string} comfyuiUrl - Base URL of the ComfyUI server
 * @param {number} [timeoutMs=600000] - Max wait time in milliseconds (10 minutes)
 * @returns {Promise<object>} The completed history entry
 */
async function pollUntilDone(promptId, comfyuiUrl, timeoutMs = 600_000) {
  const start = Date.now();
  let lastStatus = '';

  while (Date.now() - start < timeoutMs) {
    const resp = await fetch(`${comfyuiUrl}/history/${promptId}`);
    const data = await resp.json();

    if (data[promptId]) {
      const status = data[promptId].status;
      const statusStr = status.status_str;

      if (statusStr !== lastStatus) {
        console.log(`  Status: ${statusStr}`);
        lastStatus = statusStr;
      }

      if (statusStr === 'success') return data[promptId];

      if (statusStr === 'error') {
        const errMsg = status.messages?.find(m => m[0] === 'execution_error');
        throw new Error(
          `ComfyUI execution error: ${errMsg?.[1]?.exception_message || JSON.stringify(status.messages)}`
        );
      }
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  throw new Error(`Timeout: ComfyUI did not complete within ${timeoutMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Step 4: Download frames from ComfyUI output
// ---------------------------------------------------------------------------

/**
 * Downloads all output frames from the SaveImage node (node 224) to disk.
 * @param {object} historyData - Completed history entry from pollUntilDone
 * @param {string} name - Sprite name (used for directory naming)
 * @param {string} comfyuiUrl - Base URL of the ComfyUI server
 * @param {string} outputDir - Root output directory
 * @returns {Promise<string>} Path to the raw frames directory
 */
async function downloadFrames(historyData, name, comfyuiUrl, outputDir) {
  const framesDir = join(outputDir, name, 'raw-frames');
  await mkdir(framesDir, { recursive: true });

  const outputs = historyData.outputs || {};
  const saveImageOutput = outputs['224'];
  if (!saveImageOutput?.images) {
    throw new Error('No frame output found from node 224 — check workflow node IDs');
  }

  for (const img of saveImageOutput.images) {
    const url =
      `${comfyuiUrl}/view` +
      `?filename=${encodeURIComponent(img.filename)}` +
      `&subfolder=${encodeURIComponent(img.subfolder || '')}` +
      `&type=${img.type || 'output'}`;

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to download frame ${img.filename}: HTTP ${resp.status}`);
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    await writeFile(join(framesDir, img.filename), buffer);
  }

  console.log(`  Downloaded ${saveImageOutput.images.length} frames to ${framesDir}`);
  return framesDir;
}

// ---------------------------------------------------------------------------
// Step 5: Background removal + crop (via rembg in ComfyUI Python venv)
// ---------------------------------------------------------------------------

/**
 * Runs rembg background removal on all raw frames, crops padding added by the
 * workflow, and writes sequentially numbered RGBA PNGs for ffmpeg.
 * @param {string} framesDir - Directory containing raw frames
 * @param {string} outputDir - Root output directory
 * @param {string} name - Sprite name
 * @param {number} paddingRatio - Fraction of width that is padding on each side
 * @param {number} width - Target output width (used to compute pad pixels)
 * @returns {Promise<string>} Path to the RGBA frames directory
 */
async function removeBackgrounds(framesDir, outputDir, name, paddingRatio, width) {
  const rgbaDir = join(outputDir, name, 'rgba-frames');
  await mkdir(rgbaDir, { recursive: true });

  const padPx = Math.round(width * paddingRatio);

  const script = `
import os, sys
from rembg import remove
from PIL import Image

frames_dir = sys.argv[1]
rgba_dir = sys.argv[2]
pad = int(sys.argv[3])

frames = sorted([f for f in os.listdir(frames_dir) if f.endswith('.png')])
total = len(frames)

if total == 0:
    print('ERROR: No PNG frames found in ' + frames_dir, flush=True)
    sys.exit(1)

print(f'Processing {total} frames with pad={pad}px...', flush=True)

for i, fname in enumerate(frames):
    img = Image.open(os.path.join(frames_dir, fname)).convert('RGBA')
    # Remove background
    result = remove(img)
    # Crop padding on all four sides
    w, h = result.size
    left = pad
    top = pad
    right = w - pad
    bottom = h - pad
    if right > left and bottom > top:
        cropped = result.crop((left, top, right, bottom))
    else:
        cropped = result
    # Save with sequential naming for ffmpeg
    out_name = f'{i:05d}.png'
    cropped.save(os.path.join(rgba_dir, out_name))
    print(f'  [{i+1}/{total}] {fname} -> {out_name}', flush=True)

print(f'Done: {total} frames processed', flush=True)
`;

  const tmpScript = join(outputDir, name, '_rembg_script.py');
  await writeFile(tmpScript, script);

  try {
    execSync(
      `"${COMFYUI_PYTHON}" "${tmpScript}" "${framesDir}" "${rgbaDir}" ${padPx}`,
      { stdio: 'inherit', timeout: 300_000 }
    );
  } finally {
    await unlink(tmpScript).catch(() => {});
  }

  return rgbaDir;
}

// ---------------------------------------------------------------------------
// Step 6: Encode WebM + spritesheet + preview MP4
// ---------------------------------------------------------------------------

/**
 * Encodes RGBA frames into three output formats:
 * - Transparent WebM (VP9 with alpha) for use in-game
 * - Horizontal spritesheet PNG for Phaser animation
 * - Preview MP4 (no alpha) for quick visual review
 * @param {string} rgbaDir - Directory containing sequentially numbered RGBA PNGs
 * @param {string} outputDir - Root output directory
 * @param {string} name - Sprite name (used in output filenames)
 * @param {number} [fps=24] - Frames per second for encoding
 * @returns {Promise<{webmPath: string, spritesheetPath: string, previewPath: string}>}
 */
async function encodeOutputs(rgbaDir, outputDir, name, fps = 24) {
  const webmPath = join(outputDir, name, `${name}_idle.webm`);
  const spritesheetPath = join(outputDir, name, `${name}_idle_sheet.png`);
  const previewPath = join(outputDir, name, `${name}_idle_preview.mp4`);

  // Transparent WebM (VP9 with alpha channel)
  console.log('  Encoding transparent WebM...');
  execSync(
    `ffmpeg -y -framerate ${fps} -i "${rgbaDir}/%05d.png"` +
      ` -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 -auto-alt-ref 0 -an` +
      ` "${webmPath}"`,
    { stdio: 'inherit' }
  );
  console.log(`  WebM: ${webmPath}`);

  // Preview MP4 (H.264, no alpha, for quick review)
  console.log('  Encoding preview MP4...');
  execSync(
    `ffmpeg -y -framerate ${fps} -i "${rgbaDir}/%05d.png"` +
      ` -c:v libx264 -pix_fmt yuv420p -crf 23` +
      ` "${previewPath}"`,
    { stdio: 'inherit' }
  );
  console.log(`  Preview: ${previewPath}`);

  // Horizontal spritesheet (all frames composited side-by-side)
  console.log('  Building spritesheet...');
  const frames = (await readdir(rgbaDir)).filter(f => f.endsWith('.png')).sort();

  if (frames.length > 0) {
    const firstMeta = await sharp(join(rgbaDir, frames[0])).metadata();
    const fw = firstMeta.width;
    const fh = firstMeta.height;
    const sheetWidth = fw * frames.length;

    const composites = frames.map((f, i) => ({
      input: join(rgbaDir, f),
      left: i * fw,
      top: 0,
    }));

    await sharp({
      create: {
        width: sheetWidth,
        height: fh,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toFile(spritesheetPath);

    console.log(
      `  Spritesheet: ${spritesheetPath} (${frames.length} frames, ${sheetWidth}x${fh})`
    );
  } else {
    console.warn('  Warning: No frames found for spritesheet — skipping');
  }

  return { webmPath, spritesheetPath, previewPath };
}

// ---------------------------------------------------------------------------
// Default prompt generator
// ---------------------------------------------------------------------------

/**
 * Generates a default animation prompt from the sprite's filename.
 * @param {string} name - Sprite name (filename without extension)
 * @returns {string} A suitable LTX-2.3 animation prompt
 */
function generateDefaultPrompt(name) {
  const readable = name.replace(/[_-]/g, ' ');
  return (
    `A ${readable} creature facing forward on a solid black background. Idle breathing animation loop.\n\n` +
    `0-1 seconds: Gentle rhythmic breathing, the body rises and falls subtly. Small details shimmer or pulse with inner energy.\n\n` +
    `1-2 seconds: Secondary idle motion - appendages twitch, eyes scan, weight shifts. A brief moment of heightened activity then settles.\n\n` +
    `2-3 seconds: Returns smoothly to starting pose for seamless loop. Breathing rhythm matches frame 0.\n\n` +
    `Style: Pixel art sprite animation, limited frame-rate 8-12 fps choppy movement, no environment, no ground texture, sprite centered and stationary, no camera movement, locked tripod, no zoom, no pan, solid black background.`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { values: args } = parseArgs({
    options: {
      sprite:           { type: 'string' },
      prompt:           { type: 'string' },
      duration:         { type: 'string',  default: '3' },
      width:            { type: 'string',  default: '512' },
      height:           { type: 'string',  default: '512' },
      seed:             { type: 'string' },
      name:             { type: 'string' },
      'output-dir':     { type: 'string',  default: DEFAULT_OUTPUT_DIR },
      'comfyui-url':    { type: 'string',  default: COMFYUI_URL },
      'skip-generate':  { type: 'boolean', default: false },
      'skip-postprocess': { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (!args.sprite) {
    console.error(
      'Usage: node animate-sprite.mjs --sprite <path> [options]\n\n' +
        'Options:\n' +
        '  --sprite <path>        (required) Path to sprite PNG\n' +
        '  --prompt <text>        Custom animation prompt\n' +
        '  --duration <n>         Seconds (default: 3)\n' +
        '  --width <n>            Output width in px (default: 512)\n' +
        '  --height <n>           Output height in px (default: 512)\n' +
        '  --seed <n>             RNG seed (random if omitted)\n' +
        '  --name <str>           Output name (derived from filename if omitted)\n' +
        '  --output-dir <path>    Output directory (default: sprite-gen/output/animations)\n' +
        '  --comfyui-url <url>    ComfyUI server URL (default: http://localhost:8188)\n' +
        '  --skip-generate        Skip ComfyUI generation, post-process existing frames\n' +
        '  --skip-postprocess     Skip bg removal + encoding, only generate frames\n'
    );
    process.exit(1);
  }

  const spritePath  = resolve(args.sprite);
  const name        = args.name || basename(spritePath, extname(spritePath));
  const seed        = args.seed ? parseInt(args.seed, 10) : Math.floor(Math.random() * 999_999);
  const duration    = parseInt(args.duration, 10);
  const width       = parseInt(args.width, 10);
  const height      = parseInt(args.height, 10);
  const outputDir   = resolve(args['output-dir']);
  const comfyuiUrl  = args['comfyui-url'];
  const prompt      = args.prompt || generateDefaultPrompt(name);

  console.log(`\n=== Sprite Animate: ${name} ===`);
  console.log(`  Sprite:     ${spritePath}`);
  console.log(`  Resolution: ${width}x${height}  Duration: ${duration}s  Seed: ${seed}`);
  console.log(`  Output:     ${outputDir}/${name}/`);
  if (args['skip-generate'])    console.log('  [FLAG] --skip-generate: using existing raw-frames');
  if (args['skip-postprocess']) console.log('  [FLAG] --skip-postprocess: skipping bg removal + encoding');
  console.log();

  await mkdir(join(outputDir, name), { recursive: true });

  let framesDir;

  if (!args['skip-generate']) {
    // -----------------------------------------------------------------------
    // Step 1: Upload sprite
    // -----------------------------------------------------------------------
    console.log('[1/4] Uploading sprite to ComfyUI...');
    const imageName = await uploadSprite(spritePath, comfyuiUrl);
    console.log(`  Uploaded as: ${imageName}`);

    // -----------------------------------------------------------------------
    // Step 2: Build workflow
    // -----------------------------------------------------------------------
    console.log('[2/4] Building workflow...');
    let wf;
    try {
      wf = buildWorkflow(WORKFLOW_PATH, { imageName, prompt, duration, width, height, seed, name });
    } catch (err) {
      console.error(`  Failed to load workflow from ${WORKFLOW_PATH}`);
      console.error(`  ${err.message}`);
      process.exit(1);
    }
    console.log(`  Workflow loaded: ${Object.keys(wf).length} nodes`);

    // -----------------------------------------------------------------------
    // Step 3: Submit and poll
    // -----------------------------------------------------------------------
    console.log('[3/4] Submitting to ComfyUI...');
    const promptId = await submitWorkflow(wf, comfyuiUrl);
    console.log(`  Prompt ID: ${promptId}`);

    console.log('[4/4] Generating animation (may take several minutes)...');
    const result = await pollUntilDone(promptId, comfyuiUrl);
    console.log('  Generation complete!');

    // -----------------------------------------------------------------------
    // Step 4: Download frames
    // -----------------------------------------------------------------------
    console.log('[+] Downloading frames...');
    framesDir = await downloadFrames(result, name, comfyuiUrl, outputDir);
  } else {
    framesDir = join(outputDir, name, 'raw-frames');
    console.log(`Skipping generation — using existing frames: ${framesDir}`);
  }

  if (!args['skip-postprocess']) {
    // -----------------------------------------------------------------------
    // Step 5: Background removal
    // -----------------------------------------------------------------------
    console.log('\n[Post 1/2] Removing backgrounds via rembg...');
    const rgbaDir = await removeBackgrounds(
      framesDir,
      outputDir,
      name,
      PADDING_RATIO,
      width
    );

    // -----------------------------------------------------------------------
    // Step 6: Encode outputs
    // -----------------------------------------------------------------------
    console.log('\n[Post 2/2] Encoding outputs...');
    const outputs = await encodeOutputs(rgbaDir, outputDir, name, 24);

    console.log('\n=== Done! ===');
    console.log(`  WebM (transparent): ${outputs.webmPath}`);
    console.log(`  Spritesheet (PNG):  ${outputs.spritesheetPath}`);
    console.log(`  Preview (MP4):      ${outputs.previewPath}`);
  } else {
    console.log('\nSkipping post-processing — raw frames are in:');
    console.log(`  ${framesDir}`);
  }
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
