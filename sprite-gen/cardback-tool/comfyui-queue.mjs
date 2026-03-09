/**
 * ComfyUI queue manager for cardback generation.
 * Adapted from the proven pattern in sprite-gen/scripts/regenerate-rejected.mjs.
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
 * Submit a cardback generation job to ComfyUI.
 * @param {string} visualDescription - The scene description prompt
 * @param {number} [seed] - Optional seed for reproducibility (random if omitted)
 * @returns {Promise<string>} prompt_id from ComfyUI
 */
export async function submitCardback(visualDescription, seed) {
  const workflowRaw = await readFile(WORKFLOW_PATH, 'utf-8');
  const workflow = JSON.parse(workflowRaw);

  // Set the prompt text (node 49 = PROMPT value node)
  workflow['49']['inputs']['value'] = visualDescription;

  // Set the noise seed (node 25 = KSampler or similar)
  workflow['25']['inputs']['noise_seed'] = seed ?? Math.floor(Math.random() * 2 ** 32);

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
export async function waitForCompletion(promptId, timeoutMs = 180000) {
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
export async function readComfyUIOutput(filename) {
  const filePath = join(COMFYUI_OUTPUT_DIR, filename);
  return readFile(filePath);
}
