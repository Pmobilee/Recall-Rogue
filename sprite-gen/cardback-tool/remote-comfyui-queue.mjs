/**
 * Remote ComfyUI HTTP client module.
 * Generalizes the localhost pattern from comfyui-queue.mjs to work with any
 * ComfyUI instance reachable over HTTP (e.g. a LAN machine via Tailscale).
 *
 * No external dependencies — uses Node 18+ built-in fetch.
 */

const POLL_INTERVAL_MS = 2000;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Submit a workflow to a remote ComfyUI instance.
 * @param {string} baseUrl - e.g. "http://100.74.153.81:8188"
 * @param {object} workflow - The API-format workflow object (node dict)
 * @returns {Promise<string>} prompt_id
 */
export async function submitRemoteWorkflow(baseUrl, workflow) {
  const res = await fetch(`${baseUrl}/prompt`, {
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
 * @param {string} baseUrl
 * @param {string} promptId
 * @param {number} [timeoutMs=300000] - 5 min default (GGUF models take time to load first run)
 * @returns {Promise<Array<{filename: string, subfolder: string, type: string}>>} Output image info
 */
export async function waitForRemoteCompletion(baseUrl, promptId, timeoutMs = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await sleep(POLL_INTERVAL_MS);

    let data;
    try {
      const res = await fetch(`${baseUrl}/history/${promptId}`);
      if (!res.ok) continue;
      data = await res.json();
    } catch {
      // Network blip — keep polling
      continue;
    }

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
      /** @type {Array<{filename: string, subfolder: string, type: string}>} */
      const images = [];

      for (const nodeOutput of Object.values(entry.outputs)) {
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          for (const img of nodeOutput.images) {
            images.push({
              filename: img.filename,
              subfolder: img.subfolder || '',
              type: img.type || 'output',
            });
          }
        }
      }

      if (images.length > 0) {
        return images;
      }

      throw new Error('Generation completed but no image output found');
    }
  }

  throw new Error(`Timed out waiting for ComfyUI after ${timeoutMs / 1000}s`);
}

/**
 * Download an output image from ComfyUI via HTTP.
 * @param {string} baseUrl
 * @param {string} filename
 * @param {string} [subfolder='']
 * @param {string} [type='output']
 * @returns {Promise<Buffer>} Raw image bytes
 */
export async function downloadRemoteImage(baseUrl, filename, subfolder = '', type = 'output') {
  const url =
    `${baseUrl}/view` +
    `?filename=${encodeURIComponent(filename)}` +
    `&subfolder=${encodeURIComponent(subfolder)}` +
    `&type=${type}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image ${filename}: HTTP ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Check if the remote ComfyUI is alive and get system stats.
 * @param {string} baseUrl
 * @returns {Promise<{online: boolean, gpuName?: string, vramFreeMB?: number, queueSize?: number}>}
 */
export async function checkRemoteHealth(baseUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let statsData;
    try {
      const statsRes = await fetch(`${baseUrl}/system_stats`, { signal: controller.signal });
      if (!statsRes.ok) return { online: false };
      statsData = await statsRes.json();
    } finally {
      clearTimeout(timeoutId);
    }

    const device = statsData?.devices?.[0];
    const gpuName = device?.name;
    const vramFreeMB = device?.vram_free != null
      ? Math.round(device.vram_free / 1048576)
      : undefined;

    let queueSize;
    try {
      const queueRes = await fetch(`${baseUrl}/queue`);
      if (queueRes.ok) {
        const queueData = await queueRes.json();
        queueSize =
          (queueData?.queue_running?.length ?? 0) +
          (queueData?.queue_pending?.length ?? 0);
      }
    } catch {
      // Queue endpoint failure is non-fatal
    }

    return { online: true, gpuName, vramFreeMB, queueSize };
  } catch {
    return { online: false };
  }
}
