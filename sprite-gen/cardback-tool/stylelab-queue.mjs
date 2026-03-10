/**
 * ComfyUI queue manager for Style Lab cardback generation.
 * Accepts style configuration parameters to override workflow defaults.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMFYUI_URL = 'http://localhost:8188';
const COMFYUI_OUTPUT_DIR = '/opt/ComfyUI/output';
const POLL_INTERVAL_MS = 2000;

const WORKFLOW_PATH = join(__dirname, '..', 'workflows', 'API versions', 'cardback_generator_api.json');

/** @param {number} ms */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Submit a styled cardback generation job to ComfyUI.
 * @param {string} visualDescription - The scene description prompt
 * @param {number} seed - Seed for reproducibility
 * @param {{ styleSuffix: string, loraStrength: number, numColors: number, pixelationSize: number, guidance: number, steps: number }} styleConfig
 * @returns {Promise<string>} prompt_id from ComfyUI
 */
export async function submitStyledCardback(visualDescription, seed, styleConfig) {
  const workflowRaw = await readFile(WORKFLOW_PATH, 'utf-8');
  const workflow = JSON.parse(workflowRaw);

  // Set the prompt text (node 49 = PROMPT value node)
  workflow['49']['inputs']['value'] = visualDescription;

  // Set the noise seed (node 25 = RandomNoise)
  workflow['25']['inputs']['noise_seed'] = seed;

  // Set the style suffix (node 48 = StringConcatenate, string_b)
  workflow['48']['inputs']['string_b'] = styleConfig.styleSuffix;

  // Set LoRA strength (node 46 = NunchakuFluxLoraLoader)
  workflow['46']['inputs']['lora_strength'] = styleConfig.loraStrength;

  // Set guidance (node 26 = FluxGuidance)
  workflow['26']['inputs']['guidance'] = styleConfig.guidance;

  // Set steps (node 17 = BasicScheduler)
  workflow['17']['inputs']['steps'] = styleConfig.steps;

  // Handle pixelation / color quantization (node 62 = Image Pixelate)
  if (styleConfig.numColors > 0) {
    // Normal flow: pixelate
    workflow['62']['inputs']['num_colors'] = styleConfig.numColors;
    workflow['62']['inputs']['pixelation_size'] = styleConfig.pixelationSize;
    // Ensure SaveImage (node 9) reads from pixelate node (62)
    workflow['9']['inputs']['images'] = ['62', 0];
  } else {
    // No pixelation: connect SaveImage (node 9) directly to Image Resize (node 58)
    workflow['9']['inputs']['images'] = ['58', 0];
    // Remove node 62 entirely so ComfyUI doesn't process it
    delete workflow['62'];
  }

  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`ComfyUI /prompt returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.prompt_id;
}

/**
 * Poll ComfyUI history until job completes.
 * @param {string} promptId
 * @param {number} [timeoutMs=180000] - Timeout in ms
 * @returns {Promise<string[]>} Array of output filenames
 */
export async function waitForStyledCompletion(promptId, timeoutMs = 180000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!res.ok) continue;

    const data = await res.json();
    const entry = data[promptId];

    if (!entry) continue;

    // Check for error status
    if (entry.status?.status_str === 'error') {
      const errorMessages = entry.status?.messages
        ?.filter(m => m[0] === 'execution_error')
        ?.map(m => m[1]?.exception_message || JSON.stringify(m[1]))
        ?.join('; ');
      throw new Error(`ComfyUI execution error: ${errorMessages || 'unknown error'}`);
    }

    // Check if outputs exist (generation complete)
    if (entry.outputs && Object.keys(entry.outputs).length > 0) {
      // SaveImage node is node "9" in the cardback workflow
      const saveOutput = entry.outputs['9'];
      if (saveOutput && saveOutput.images) {
        return saveOutput.images.map(img => img.filename);
      }
      // Fallback: try any node with images
      for (const nodeOutput of Object.values(entry.outputs)) {
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          return nodeOutput.images.map(img => img.filename);
        }
      }
      throw new Error('Generation completed but no image output found');
    }
  }

  throw new Error(`Timed out waiting for ComfyUI after ${timeoutMs / 1000}s`);
}

/**
 * Read generated image from ComfyUI output directory.
 * @param {string} filename
 * @returns {Promise<Buffer>}
 */
export async function readStyledOutput(filename) {
  const filePath = join(COMFYUI_OUTPUT_DIR, filename);
  return readFile(filePath);
}
