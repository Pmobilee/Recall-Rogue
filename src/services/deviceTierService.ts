/**
 * Device tier detection and quality preset service.
 * Tier is determined at startup and cached for the session.
 * Manual override is persisted in localStorage key 'device-tier-override'.
 *
 * Detection priority:
 *   1. Manual override (localStorage)
 *   2. navigator.deviceMemory  (Chromium Android; not available on iOS/Firefox)
 *   3. WEBGL_debug_renderer_info GPU string  (most reliable cross-platform)
 *   4. navigator.hardwareConcurrency  (coarse CPU-core proxy)
 *
 * DD-V2-215: low-end ≈ 3 GB RAM, mid ≈ 6 GB RAM, flagship ≈ 12 GB RAM.
 */

export type DeviceTier = 'low-end' | 'mid' | 'flagship'

/** Quality preset values for a given device tier. */
export interface QualityPreset {
  particleBudget: number        // Total simultaneous particles across all emitters
  ambientParticleBudget: number // Sub-budget for biome ambient emitters
  tileResolution: 32 | 64      // Source texture pixel density (world size always 32px)
  animFrameInterval: number    // Animated tile update cadence (every N frames)
  maxAtlases: number           // Concurrent texture atlases in GPU (DD-V2-189)
  fogResolution: 0.5 | 1.0    // Fog RenderTexture scale factor
}

const PRESETS: Record<DeviceTier, QualityPreset> = {
  'low-end': {
    particleBudget: 40,
    ambientParticleBudget: 10,
    tileResolution: 32,
    animFrameInterval: 6,
    maxAtlases: 2,
    fogResolution: 0.5,
  },
  'mid': {
    particleBudget: 80,
    ambientParticleBudget: 20,
    tileResolution: 32,
    animFrameInterval: 4,
    maxAtlases: 3,
    fogResolution: 1.0,
  },
  'flagship': {
    particleBudget: 150,
    ambientParticleBudget: 50,
    tileResolution: 64,
    animFrameInterval: 2,
    maxAtlases: 3,
    fogResolution: 1.0,
  },
}

let _cached: DeviceTier | null = null

/** Returns the device tier. Cached after first call. */
export function getDeviceTier(): DeviceTier {
  if (_cached) return _cached
  const override = localStorage.getItem('device-tier-override') as DeviceTier | null
  if (override && override in PRESETS) { _cached = override; return _cached }
  _cached = detectTier()
  return _cached
}

/** Sets or clears a manual quality override. Invalidates the cache. */
export function setDeviceTierOverride(tier: DeviceTier | null): void {
  tier ? localStorage.setItem('device-tier-override', tier)
       : localStorage.removeItem('device-tier-override')
  _cached = null
}

/** Returns the quality preset for the current (or specified) tier. */
export function getQualityPreset(tier?: DeviceTier): QualityPreset {
  return PRESETS[tier ?? getDeviceTier()]
}

/** Human-readable label for the Settings UI dropdown. */
export function getTierLabel(tier: DeviceTier): string {
  const labels: Record<DeviceTier, string> = {
    'low-end': 'Low (Battery Saver)',
    'mid': 'Medium (Balanced)',
    'flagship': 'High (Max Quality)',
  }
  return labels[tier]
}

function detectTier(): DeviceTier {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
  if (mem !== undefined) {
    if (mem >= 8) return 'flagship'
    if (mem >= 4) return 'mid'
    return 'low-end'
  }
  const gpu = probeGPU()
  if (gpu !== 'mid') return gpu
  const cores = navigator.hardwareConcurrency ?? 4
  if (cores >= 8) return 'flagship'
  if (cores >= 6) return 'mid'
  return 'low-end'
}

/**
 * Probe the WebGL GPU renderer string and classify device tier.
 *
 * HIGH-4 (2026-04-10): Added software renderer detection (SwiftShader, llvmpipe,
 * softpipe). These are CPU-emulated renderers that cannot sustain 45+ fps even at
 * low-end shader quality. Classify them as 'low-end' to disable the DepthLightingFX
 * PostFX pipeline, which caused 12-13 fps in Docker/SwiftShader environments that
 * were incorrectly detected as 'flagship' via CPU core count fallback.
 *
 * Software renderer patterns:
 *   - "swiftshader" — Google's software Vulkan (used in Docker CI + headless Chrome)
 *   - "llvmpipe"    — Mesa LLVMpipe (Linux CI environments)
 *   - "softpipe"    — Mesa softpipe fallback
 *   - "angle (.*swiftshader" — ANGLE wrapping SwiftShader (Windows/macOS headless Chrome)
 *   - "microsoft basic render driver" — Windows software fallback
 */
function probeGPU(): DeviceTier {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
    if (!gl) return 'mid'
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
    if (!ext) return 'mid'
    const r = ((gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string ?? '').toLowerCase()

    // Software renderers: classify as low-end regardless of CPU core count.
    // These cannot sustain 45+ fps for the DepthLightingFX PostFX pipeline.
    if (/swiftshader|llvmpipe|softpipe|microsoft basic render driver/.test(r)) return 'low-end'

    // High-end GPU patterns
    if (/adreno 7[3-9]\d|adreno [89]\d\d|apple gpu|m[123]|rtx|rx [67]\d\d\d/.test(r)) return 'flagship'
    // Low-end GPU patterns
    if (/adreno [23]\d\d|mali-[gt][5-7]\d|powervr|intel hd [45]/.test(r)) return 'low-end'
    return 'mid'
  } catch (_) { return 'mid' }
}
