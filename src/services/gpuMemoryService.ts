/**
 * GPU texture memory query via the GMAN_webgl_memory WebGL extension.
 * Available in Chrome 91+ (and Chromium-based browsers on Android).
 * Falls back gracefully when the extension is unavailable.
 *
 * DD-V2-192: 80 MB GPU texture memory budget.
 */

/** Information about current GPU texture memory usage. */
export interface GpuMemoryInfo {
  textureBytes: number      // Current GPU texture memory in bytes (0 if unavailable)
  atlasCount: number        // Number of texture objects loaded
  extensionAvailable: boolean
}

let _gl: WebGLRenderingContext | WebGL2RenderingContext | null = null
let _ext: unknown = null

/** Initialize with the Phaser WebGL renderer's gl context. Call after game.renderer is ready. */
export function initGpuMemoryTracking(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  _gl = gl; _ext = (gl as WebGLRenderingContext).getExtension('GMAN_webgl_memory') ?? null
}

/** Query current GPU texture memory usage. */
export function queryGpuMemory(): GpuMemoryInfo {
  if (!_ext) return { textureBytes: 0, atlasCount: 0, extensionAvailable: false }
  try {
    const ext = _ext as { getMemoryInfo: () => { resources?: { texture?: number; textureCount?: number } } }
    const info = ext.getMemoryInfo()
    return {
      textureBytes: info.resources?.texture ?? 0,
      atlasCount: info.resources?.textureCount ?? 0,
      extensionAvailable: true,
    }
  } catch (_) { return { textureBytes: 0, atlasCount: 0, extensionAvailable: false } }
}

/** Soft warning threshold: 60 MB GPU texture memory. */
export const GPU_WARN_BYTES = 60 * 1024 * 1024   // 60 MB soft warning
/** Hard limit threshold: 80 MB GPU texture memory (DD-V2-192). */
export const GPU_HARD_BYTES = 80 * 1024 * 1024   // 80 MB hard limit (DD-V2-192)

/** Returns true if GPU texture memory exceeds the hard limit. */
export function isGpuOverBudget(): boolean { return queryGpuMemory().textureBytes > GPU_HARD_BYTES }
