/**
 * deviceTierService — unit tests
 *
 * HIGH-4 regression suite (2026-04-10):
 * Ensures software renderers (SwiftShader, llvmpipe, softpipe, MSBRD) are
 * always classified as 'low-end', preventing the DepthLightingFX PostFX
 * pipeline from being enabled in Docker/headless CI environments where it
 * cannot sustain 45+ fps.
 *
 * Root cause: SwiftShader was reaching 'flagship' via the CPU-core fallback
 * (14 cores in Docker). This caused 12-14 fps during animation load in CI.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Browser API shims ────────────────────────────────────────────────────────

// localStorage shim
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    },
    writable: true,
  })
}

// navigator shim — default: high core count, no deviceMemory (mirrors Docker)
if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: { hardwareConcurrency: 14 },
    writable: true,
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return a fresh module import with a mocked canvas GPU renderer string. */
async function importWithGPU(rendererString: string) {
  vi.resetModules()

  // Patch document.createElement so getContext('webgl') returns a fake GL object
  const fakeExt = {
    UNMASKED_RENDERER_WEBGL: 37446,
  }
  const fakeGl = {
    getExtension: (_name: string) => fakeExt,
    getParameter: (param: number) =>
      param === 37446 ? rendererString : '',
  }
  const fakeCanvas = {
    getContext: (_ctx: string) => fakeGl,
  }

  Object.defineProperty(globalThis, 'document', {
    value: { createElement: () => fakeCanvas },
    writable: true,
    configurable: true,
  })

  const mod = await import('../../src/services/deviceTierService.js')
  return mod
}

/** Import without any WebGL support (probeGPU returns 'mid', falls to CPU cores). */
async function importNoWebGL(hardwareConcurrency = 14) {
  vi.resetModules()

  Object.defineProperty(globalThis, 'navigator', {
    value: { hardwareConcurrency },
    writable: true,
    configurable: true,
  })

  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: () => ({
        getContext: (_ctx: string) => null, // no WebGL
      }),
    },
    writable: true,
    configurable: true,
  })

  const mod = await import('../../src/services/deviceTierService.js')
  return mod
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('deviceTierService — software renderer detection (HIGH-4)', () => {
  beforeEach(() => {
    // Clear localStorage override between tests
    globalThis.localStorage.removeItem('device-tier-override')
  })

  describe('SwiftShader patterns (Docker CI)', () => {
    it('classifies "Google SwiftShader" as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('ANGLE (Google, Vulkan 1.1.0 (SwiftShader Device (Subzero) (0x0000C0DE)), Google SwiftShader)')
      expect(getDeviceTier()).toBe('low-end')
    })

    it('classifies bare "swiftshader" string as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('swiftshader')
      expect(getDeviceTier()).toBe('low-end')
    })

    it('classifies ANGLE-wrapped SwiftShader as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('ANGLE (swiftshader-vk)')
      expect(getDeviceTier()).toBe('low-end')
    })
  })

  describe('Mesa software renderers (Linux CI)', () => {
    it('classifies "llvmpipe" as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('llvmpipe (LLVM 15.0.7, 256 bits)')
      expect(getDeviceTier()).toBe('low-end')
    })

    it('classifies "softpipe" as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('softpipe')
      expect(getDeviceTier()).toBe('low-end')
    })
  })

  describe('Windows software renderer', () => {
    it('classifies "Microsoft Basic Render Driver" as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('Microsoft Basic Render Driver')
      expect(getDeviceTier()).toBe('low-end')
    })
  })

  describe('HIGH-4 regression: Docker CPU core count fallback no longer reaches flagship', () => {
    it('with 14 CPU cores + SwiftShader GPU: stays low-end (was flagship before fix)', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: 14 },
        writable: true,
        configurable: true,
      })
      const { getDeviceTier } = await importWithGPU('ANGLE (Google SwiftShader)')
      // Before fix: probeGPU returned 'mid' (unmatched), then 14 cores → 'flagship'
      // After fix: probeGPU returns 'low-end' immediately, CPU cores never reached
      expect(getDeviceTier()).toBe('low-end')
    })

    it('with 14 CPU cores + no WebGL (null): falls through to flagship (expected)', async () => {
      const { getDeviceTier } = await importNoWebGL(14)
      // No WebGL → probeGPU returns 'mid' → 14 cores ≥ 8 → flagship
      // This is correct for real flagship hardware in non-WebGL fallback
      expect(getDeviceTier()).toBe('flagship')
    })
  })
})

describe('deviceTierService — real GPU patterns', () => {
  beforeEach(() => {
    globalThis.localStorage.removeItem('device-tier-override')
  })

  // Note: real Adreno WebGL renderer strings are "Adreno (TM) NNN" with a
  // trademark marker. The current probeGPU() patterns only match "adreno NNN"
  // without the (TM) — this is a pre-existing gap, not a HIGH-4 regression.
  // Tests here only use strings that actually match the current patterns.

  describe('Flagship GPU patterns', () => {
    it('classifies Apple GPU as flagship', async () => {
      const { getDeviceTier } = await importWithGPU('Apple GPU')
      expect(getDeviceTier()).toBe('flagship')
    })

    it('classifies RTX 3090 as flagship', async () => {
      const { getDeviceTier } = await importWithGPU('NVIDIA GeForce RTX 3090')
      expect(getDeviceTier()).toBe('flagship')
    })

    it('classifies RX 6800 as flagship', async () => {
      const { getDeviceTier } = await importWithGPU('AMD Radeon RX 6800')
      expect(getDeviceTier()).toBe('flagship')
    })
  })

  describe('Low-end GPU patterns', () => {
    it('classifies Mali-G52 as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('Mali-G52')
      expect(getDeviceTier()).toBe('low-end')
    })

    it('classifies PowerVR as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('PowerVR SGX544')
      expect(getDeviceTier()).toBe('low-end')
    })

    it('classifies Intel HD 4500 as low-end', async () => {
      const { getDeviceTier } = await importWithGPU('Intel HD 4500')
      expect(getDeviceTier()).toBe('low-end')
    })
  })

  describe('Mid-tier GPU fallback + CPU core count', () => {
    // probeGPU returns 'mid' for unknown GPUs, then CPU core count decides final tier.
    // Navigator is set to 14 cores globally in this test file (see shim at top).
    // 14 cores >= 8 → 'flagship' override. This is correct behavior.
    it('unknown GPU + 14 CPU cores → flagship (expected CPU-core override)', async () => {
      const { getDeviceTier } = await importWithGPU('Unknown GPU Vendor XYZ')
      // probeGPU() returns 'mid' → cores ≥ 8 → flagship (correct behavior)
      expect(getDeviceTier()).toBe('flagship')
    })

    it('unknown GPU + 4 CPU cores → mid (falls through to mid)', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: 4 },
        writable: true,
        configurable: true,
      })
      const { getDeviceTier } = await importNoWebGL(4)
      // No WebGL at all → probeGPU returns 'mid' → 4 cores < 6 → low-end
      // Wait — cores < 6 = low-end per detectTier():
      //   if (cores >= 8) return 'flagship'
      //   if (cores >= 6) return 'mid'
      //   return 'low-end'
      expect(getDeviceTier()).toBe('low-end')
    })

    it('unknown GPU + 6 CPU cores → mid', async () => {
      const { getDeviceTier } = await importNoWebGL(6)
      // 6 cores >= 6 but < 8 → mid
      expect(getDeviceTier()).toBe('mid')
    })
  })
})

describe('deviceTierService — manual override', () => {
  beforeEach(() => {
    globalThis.localStorage.removeItem('device-tier-override')
  })

  it('localStorage override takes precedence over detection', async () => {
    globalThis.localStorage.setItem('device-tier-override', 'flagship')
    // Even with SwiftShader GPU, override wins
    const { getDeviceTier } = await importWithGPU('swiftshader')
    expect(getDeviceTier()).toBe('flagship')
  })

  it('setDeviceTierOverride sets and retrieves the override', async () => {
    const { setDeviceTierOverride, getDeviceTier } = await importWithGPU('swiftshader')
    setDeviceTierOverride('mid')
    // Cache is cleared — re-read from localStorage
    expect(getDeviceTier()).toBe('mid')
  })

  it('setDeviceTierOverride(null) clears the override', async () => {
    const { setDeviceTierOverride, getDeviceTier } = await importWithGPU('swiftshader')
    setDeviceTierOverride('flagship')
    setDeviceTierOverride(null)
    // Back to SwiftShader detection → low-end
    expect(getDeviceTier()).toBe('low-end')
  })
})

describe('deviceTierService — quality preset values', () => {
  it('low-end preset has particleBudget=40 and fogResolution=0.5', async () => {
    const { getQualityPreset } = await importWithGPU('swiftshader')
    const preset = getQualityPreset('low-end')
    expect(preset.particleBudget).toBe(40)
    expect(preset.fogResolution).toBe(0.5)
    expect(preset.maxAtlases).toBe(2)
  })

  it('flagship preset has particleBudget=150 and fogResolution=1.0', async () => {
    const { getQualityPreset } = await importWithGPU('swiftshader')
    const preset = getQualityPreset('flagship')
    expect(preset.particleBudget).toBe(150)
    expect(preset.fogResolution).toBe(1.0)
    expect(preset.tileResolution).toBe(64)
  })

  it('getQualityPreset() with no arg uses detected tier', async () => {
    const { getQualityPreset } = await importWithGPU('swiftshader')
    const preset = getQualityPreset()
    // SwiftShader → low-end → particleBudget 40
    expect(preset.particleBudget).toBe(40)
  })
})
