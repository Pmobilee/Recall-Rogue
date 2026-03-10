/**
 * ComfyUI API client for pixel art sprite generation.
 * Submits SDXL workflows, polls for completion, downloads results,
 * and applies background removal via rembg (via sharp post-processing).
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { config } from "../config.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/** ComfyUI prompt queue response. */
interface QueueResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, unknown>;
}

/** ComfyUI history entry for a completed job. */
interface HistoryEntry {
  outputs: Record<
    string,
    {
      images?: Array<{ filename: string; subfolder: string; type: string }>;
    }
  >;
  status: { completed: boolean; status_str: string };
}

/** ComfyUI history response. */
type HistoryResponse = Record<string, HistoryEntry>;

// ── Workflow builder ──────────────────────────────────────────────────────────

/**
 * Build a ComfyUI SDXL workflow JSON for pixel art generation.
 * Uses a standard SDXL checkpoint with pixel art LoRA conditioning.
 *
 * @param imagePrompt    - Positive prompt describing the desired image.
 * @param negativePrompt - Optional negative prompt for quality control.
 * @returns A ComfyUI workflow object ready to submit to the API.
 */
export function buildPixelArtWorkflow(
  imagePrompt: string,
  negativePrompt = "text, watermark, signature, blurry, low quality, nsfw, realistic, 3d, photo"
): Record<string, unknown> {
  const seed = Math.floor(Math.random() * 2 ** 32);

  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: {
        ckpt_name: "sd_xl_base_1.0.safetensors",
      },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: `pixel art sprite, ${imagePrompt}, transparent background, 32x32, game asset, clean pixel art, 8-bit style`,
        clip: ["1", 1],
      },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: negativePrompt,
        clip: ["1", 1],
      },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: {
        width: 1024,
        height: 1024,
        batch_size: 1,
      },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 30,
        cfg: 7.5,
        sampler_name: "euler_ancestral",
        scheduler: "karras",
        denoise: 1.0,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
      },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["5", 0],
        vae: ["1", 2],
      },
    },
    "7": {
      class_type: "SaveImage",
      inputs: {
        filename_prefix: "recall-rogue-sprite",
        images: ["6", 0],
      },
    },
  };
}

// ── API helpers ───────────────────────────────────────────────────────────────

/**
 * Submit a workflow to the ComfyUI queue.
 *
 * @param workflow - The workflow object to queue.
 * @returns The prompt ID assigned by ComfyUI.
 */
async function submitWorkflow(
  workflow: Record<string, unknown>
): Promise<string> {
  const clientId = crypto.randomUUID();
  const response = await fetch(`${config.comfyuiUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });

  if (!response.ok) {
    throw new Error(`ComfyUI queue error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as QueueResponse;
  return data.prompt_id;
}

/**
 * Poll the ComfyUI history endpoint until the job completes or times out.
 *
 * @param promptId  - The prompt ID to poll for.
 * @param timeoutMs - Maximum time to wait in milliseconds.
 * @returns The completed history entry.
 */
async function pollUntilComplete(
  promptId: string,
  timeoutMs: number
): Promise<HistoryEntry> {
  const startTime = Date.now();
  const pollIntervalMs = 2000;

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const response = await fetch(
      `${config.comfyuiUrl}/history/${promptId}`
    );

    if (!response.ok) {
      throw new Error(`ComfyUI history error: ${response.status}`);
    }

    const history = (await response.json()) as HistoryResponse;

    if (history[promptId]) {
      const entry = history[promptId];
      if (entry.status.completed) {
        return entry;
      }
      if (entry.status.status_str === "error") {
        throw new Error(`ComfyUI job failed: ${entry.status.status_str}`);
      }
    }
  }

  throw new Error(`ComfyUI job timed out after ${timeoutMs}ms`);
}

/**
 * Download a generated image from ComfyUI and save it to a temp file.
 *
 * @param filename  - The filename as returned by ComfyUI history.
 * @param subfolder - The subfolder within the ComfyUI output directory.
 * @returns The path to the downloaded temp file.
 */
async function downloadImage(
  filename: string,
  subfolder: string
): Promise<string> {
  const params = new URLSearchParams({ filename, subfolder, type: "output" });
  const imageUrl = `${config.comfyuiUrl}/view?${params.toString()}`;

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const tempPath = path.join(os.tmpdir(), `comfyui-${crypto.randomUUID()}.png`);
  fs.writeFileSync(tempPath, buffer);

  return tempPath;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a pixel art sprite via ComfyUI.
 * Submits the SDXL workflow, polls until done, downloads the output.
 *
 * @param imagePrompt - Descriptive prompt for the desired pixel art sprite.
 * @param timeoutMs   - Maximum wait time in milliseconds (default 120s).
 * @returns Path to the downloaded temp PNG file.
 * @throws If ComfyUI is unavailable or the job fails.
 */
export async function generatePixelArt(
  imagePrompt: string,
  timeoutMs = 120000
): Promise<string> {
  const workflow = buildPixelArtWorkflow(imagePrompt);
  const promptId = await submitWorkflow(workflow);

  console.log(`[comfyui] Submitted job ${promptId} for prompt: "${imagePrompt}"`);

  const history = await pollUntilComplete(promptId, timeoutMs);

  // Find the first output image
  for (const nodeOutput of Object.values(history.outputs)) {
    if (nodeOutput.images && nodeOutput.images.length > 0) {
      const img = nodeOutput.images[0];
      const tempPath = await downloadImage(img.filename, img.subfolder);
      console.log(`[comfyui] Downloaded image to ${tempPath}`);
      return tempPath;
    }
  }

  throw new Error("ComfyUI job completed but no output images were found");
}

/**
 * Generate multiple sprite variants for a single fact image prompt.
 * Runs N independent ComfyUI jobs in sequence.
 *
 * @param imagePrompt - The image prompt to generate variants for.
 * @param count       - Number of variants to generate (default 3).
 * @returns Array of temp file paths, one per variant.
 */
export async function generateSpriteVariants(
  imagePrompt: string,
  count = 3
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    console.log(`[comfyui] Generating variant ${i + 1}/${count}`);
    const tempPath = await generatePixelArt(imagePrompt);
    results.push(tempPath);
  }

  return results;
}
