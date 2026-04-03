import Phaser from 'phaser'

const DEPTH_LIGHTING_FRAG = `
precision mediump float;

// Samplers
uniform sampler2D uMainSampler;  // Background color image (Phaser auto-bind, unit 0)
uniform sampler2D uDepthMap;     // Grayscale depth map (unit 1): white=near, black=far

// Resolution
uniform vec2 uResolution;
uniform vec2 uTexelSize;         // 1.0 / resolution

// Feature flags
uniform int uQualityLevel;       // 0=low, 1=mid, 2=flagship
uniform int uHasDepth;           // 0=no depth map, 1=has depth map

// Directional light
uniform vec3 uLightDir;          // Normalized direction
uniform vec3 uLightColor;        // RGB 0-1
uniform float uLightIntensity;
uniform vec3 uAmbientColor;      // Scene ambient RGB
uniform float uNormalStrength;   // Sobel derivation strength (1.0-3.0)

// Fog
uniform vec3 uFogColor;
uniform float uFogDensity;       // 0.0-1.0
uniform float uFogNear;          // Depth value where fog starts (e.g. 0.5)
uniform float uFogFar;           // Depth value where fog is max (e.g. 0.0 = far wall)

// SSAO
uniform float uSSAORadius;       // Sample radius in texels (3.0-8.0)
uniform float uSSAOStrength;     // Darkening intensity (0.0-0.5)

// Parallax breathing
uniform float uTime;             // Elapsed seconds
uniform float uBreathAmplitude;  // Max displacement in UV units (0.0 = disabled)
uniform float uBreathFreq;       // Oscillation speed (radians per second)

// Cover-crop remapping: converts FBO UVs to full-image UVs for depth map
// FBO covers the viewport; depth map covers the full (wider/taller) image
uniform vec2 uCropScale;         // viewport / displaySize (< 1.0 when image overflows)
uniform vec2 uCropOffset;        // offset to center of image

// Point lights
#define MAX_LIGHTS 8
uniform int uLightCount;                    // 0-8 active lights
uniform vec3 uPointLightPos[MAX_LIGHTS];    // x,y in UV space, z = depth (0=far,1=near)
uniform vec3 uPointLightColor[MAX_LIGHTS];  // RGB 0-1
uniform vec2 uPointLightParams[MAX_LIGHTS]; // x=radius(UV), y=intensity

// Micro-animation
uniform float uTorchFlickerIntensity;  // 0.0 = off, 0.08 = subtle default
uniform float uWaterRippleStrength;    // 0.0 = off, 0.002 = subtle default
uniform float uFogDriftOpacity;        // 0.0 = off, 0.06 = subtle default

varying vec2 outTexCoord;

// Convert FBO UV (viewport space) to image UV (full image space) for depth map
vec2 fboToImageUV(vec2 fboUV) {
  return fboUV * uCropScale + uCropOffset;
}

// Sample depth map in image space
// Flip Y: PostFX quad has UV y=0 at screen-bottom, but GL textures loaded
// without UNPACK_FLIP_Y have image-top at UV y=0. Flipping aligns depth data
// with the on-screen content rendered into the FBO.
float sampleDepth(vec2 imageUV) {
  return texture2D(uDepthMap, vec2(imageUV.x, 1.0 - imageUV.y)).r;
}

void main() {
  // If no depth map is bound, output color unchanged
  if (uHasDepth == 0) {
    gl_FragColor = texture2D(uMainSampler, outTexCoord);
    return;
  }

  // --------------------------------------------------------
  // 0. UV setup: FBO space (outTexCoord) for color reads,
  //    image space (imgUV) for depth map + light positions.
  //    These differ because cover-scaling crops the image.
  // --------------------------------------------------------
  vec2 fboUV = outTexCoord;
  vec2 imgUV = fboToImageUV(fboUV);

  // Parallax breathing (operates in image space)
  float preDepth = sampleDepth(imgUV);
  if (uQualityLevel >= 1 && uBreathAmplitude > 0.0) {
    float bx = sin(uTime * uBreathFreq) * uBreathAmplitude;
    float by = cos(uTime * uBreathFreq * 0.7) * uBreathAmplitude * 0.6;
    vec2 breathOffset = vec2(bx, by) * preDepth;
    // Wide, soft fade to zero near all edges — prevents gaps AND softens the
    // breathing ripple edge so there's no visible boundary where motion starts
    float edgeFade = smoothstep(0.0, 0.15, fboUV.x) * smoothstep(1.0, 0.85, fboUV.x)
                   * smoothstep(0.0, 0.15, fboUV.y) * smoothstep(1.0, 0.85, fboUV.y);
    breathOffset *= edgeFade;
    fboUV = clamp(fboUV + breathOffset, vec2(0.0), vec2(1.0));
    imgUV = fboToImageUV(fboUV);
  }

  // --------------------------------------------------------
  // Water ripple: UV distortion in dark/far depth regions.
  // Must go AFTER breathing UV modification and BEFORE color sample
  // so the distorted UV is used for the final texture read.
  // Flagship only (uQualityLevel >= 2).
  // --------------------------------------------------------
  if (uWaterRippleStrength > 0.0 && uQualityLevel >= 2) {
    // Sample depth at current (post-breathing) imgUV to compute mask
    float rawDepth = sampleDepth(imgUV);
    // farMask: full effect below depth 0.15, fades out above 0.35
    float farMask = smoothstep(0.35, 0.15, rawDepth);
    // Horizontal ripple wave scrolling upward in UV space
    float ripple = sin(fboUV.y * 20.0 + uTime * 1.5) * uWaterRippleStrength * farMask;
    fboUV += vec2(ripple, 0.0);
    fboUV = clamp(fboUV, vec2(0.0), vec2(1.0));
    imgUV = fboToImageUV(fboUV);
  }

  vec4 color = texture2D(uMainSampler, fboUV);
  float depth = sampleDepth(imgUV);

  // --------------------------------------------------------
  // Torch flicker: animated brightness in near/bright depth regions.
  // Applied after color sample so it multiplies the sampled color.
  // Mid and flagship (uQualityLevel >= 1).
  // --------------------------------------------------------
  if (uTorchFlickerIntensity > 0.0 && uQualityLevel >= 1) {
    // nearMask: full effect above depth 0.8, fades in from 0.6
    float nearMask = smoothstep(0.6, 0.8, depth);
    // Nested sin pattern: cheap spatial noise without texture reads
    float flicker = sin(uTime * 3.0 + sin(fboUV.x * 4.0) * sin(fboUV.y * 3.7)) * uTorchFlickerIntensity;
    color.rgb *= 1.0 + flicker * nearMask;
  }

  float tw = uTexelSize.x;
  float th = uTexelSize.y;

  // --------------------------------------------------------
  // 1. Derive surface normals via Sobel filter on depth map
  // --------------------------------------------------------
  float dL = sampleDepth(imgUV + vec2(-tw, 0.0));
  float dR = sampleDepth(imgUV + vec2( tw, 0.0));
  float dU = sampleDepth(imgUV + vec2(0.0, -th));
  float dD = sampleDepth(imgUV + vec2(0.0,  th));

  // Clamp the gradient to avoid extreme normals at sharp depth edges
  // (e.g. foreground object silhouette against background wall)
  float nx = clamp((dL - dR) * uNormalStrength, -0.8, 0.8);
  float ny = clamp((dU - dD) * uNormalStrength, -0.8, 0.8);
  vec3 normal = normalize(vec3(nx, ny, 1.0));

  // --------------------------------------------------------
  // 2. Directional lighting with 5-step quantization
  // --------------------------------------------------------
  float NdotL = max(dot(normal, uLightDir), 0.0);
  // Quantize to 5 steps for pixel-art aesthetic
  NdotL = floor(NdotL * 5.0 + 0.5) / 5.0;

  vec3 lit = uAmbientColor + uLightColor * uLightIntensity * NdotL;
  lit = min(lit, vec3(1.3));

  // --------------------------------------------------------
  // 2b. Point lights — ADDITIVE colored light
  //     Accumulated separately from base lighting so they can
  //     illuminate even when the base ambient is very dark.
  // --------------------------------------------------------
  vec3 pointLightAdd = vec3(0.0);
  if (uQualityLevel >= 1) {
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;

      vec2 lightUV = vec2(uPointLightPos[i].x, 1.0 - uPointLightPos[i].y);
      float lightDepth = uPointLightPos[i].z;
      float radius = uPointLightParams[i].x;
      float intensity = uPointLightParams[i].y;

      // Distance attenuation (smooth falloff at radius edge)
      // Light positions are in image space, so compare in image space
      float dist = length(imgUV - lightUV);
      float attenuation = 1.0 - smoothstep(0.0, radius, dist);

      // Depth-aware: gentle falloff
      float depthDiff = depth - lightDepth;
      float depthAtten = 1.0 - smoothstep(0.0, 0.5, depthDiff) * 0.4;

      // Depth-occluded shadow (flagship only): ray-march from light toward
      // this pixel. If any sample is nearer than expected, the light is blocked.
      float shadowAtten = 1.0;
      if (uQualityLevel >= 2 && attenuation > 0.05) {
        vec2 ray = imgUV - lightUV;
        float rayLen = length(ray);
        if (rayLen > 0.01) {
          vec2 rayDir = ray / rayLen;
          float occluded = 0.0;
          // 6 steps along the ray
          for (int s = 1; s <= 6; s++) {
            float t = float(s) / 7.0;
            vec2 samplePos = lightUV + rayDir * rayLen * t;
            float sampleD = sampleDepth(samplePos);
            float expectedD = lightDepth + (depth - lightDepth) * t;
            // If sample is nearer (higher depth) than expected, it blocks light
            occluded += smoothstep(0.0, 0.08, sampleD - expectedD - 0.02);
          }
          shadowAtten = 1.0 - min(occluded / 6.0, 1.0) * 0.6;
        }
      }

      pointLightAdd += uPointLightColor[i] * intensity * attenuation * depthAtten * shadowAtten;
    }
  }

  // --------------------------------------------------------
  // 3. SSAO — darken depth discontinuities
  //    Low:     0 taps (skip)
  //    Mid:     4 cardinal taps
  //    Flagship: 8 taps (cardinal + diagonal)
  // --------------------------------------------------------
  float ao = 1.0;

  if (uQualityLevel >= 1) {
    float radius = uSSAORadius;
    float totalOcclusion = 0.0;

    // Cardinal neighbors (4 taps)
    float nDepth0 = sampleDepth(imgUV + vec2(-tw *  radius,  0.0));
    float nDepth1 = sampleDepth(imgUV + vec2( tw *  radius,  0.0));
    float nDepth2 = sampleDepth(imgUV + vec2( 0.0, -th * radius));
    float nDepth3 = sampleDepth(imgUV + vec2( 0.0,  th * radius));

    // If neighbor depth > center depth, neighbor is nearer => occluding
    totalOcclusion += smoothstep(0.0, 0.15, nDepth0 - depth);
    totalOcclusion += smoothstep(0.0, 0.15, nDepth1 - depth);
    totalOcclusion += smoothstep(0.0, 0.15, nDepth2 - depth);
    totalOcclusion += smoothstep(0.0, 0.15, nDepth3 - depth);

    float numSamples = 4.0;

    if (uQualityLevel >= 2) {
      // Diagonal neighbors (4 more taps for flagship)
      float diagR = radius * 0.7071; // radius / sqrt(2)
      float nDepth4 = sampleDepth(imgUV + vec2(-tw * diagR, -th * diagR));
      float nDepth5 = sampleDepth(imgUV + vec2( tw * diagR, -th * diagR));
      float nDepth6 = sampleDepth(imgUV + vec2(-tw * diagR,  th * diagR));
      float nDepth7 = sampleDepth(imgUV + vec2( tw * diagR,  th * diagR));

      totalOcclusion += smoothstep(0.0, 0.15, nDepth4 - depth);
      totalOcclusion += smoothstep(0.0, 0.15, nDepth5 - depth);
      totalOcclusion += smoothstep(0.0, 0.15, nDepth6 - depth);
      totalOcclusion += smoothstep(0.0, 0.15, nDepth7 - depth);

      numSamples = 8.0;
    }

    ao = 1.0 - (totalOcclusion / numSamples) * uSSAOStrength;
  }

  // --------------------------------------------------------
  // 4. Depth-based atmospheric fog
  //    Far pixels (low depth) get more fog
  //    fogFactor: 0.0 = no fog, 1.0 = full fog
  // --------------------------------------------------------
  // smoothstep(near, far, 1.0 - depth):
  //   when depth=1 (near), 1-depth=0 => fogFactor=0 (no fog)
  //   when depth=0 (far),  1-depth=1 => fogFactor=1 (full fog)
  float fogFactor = smoothstep(uFogNear, uFogFar, 1.0 - depth) * uFogDensity;

  // --------------------------------------------------------
  // Fog drift: slow-scrolling noise overlay that adds density
  // variation to the existing fog, confined to far regions.
  // Mid and flagship (uQualityLevel >= 1).
  // --------------------------------------------------------
  if (uFogDriftOpacity > 0.0 && uQualityLevel >= 1) {
    // Scrolling UV: mostly horizontal drift, very slow (full cycle ~125s)
    vec2 driftUV = fboUV * 3.0 + vec2(uTime * 0.05, uTime * 0.01);
    // Product of two sines at different frequencies: cellular-like noise, no texture read
    float driftNoise = sin(driftUV.x) * sin(driftUV.y * 1.4) * 0.5 + 0.5;  // normalize to 0-1
    // Add to existing fog factor, stronger in far (low depth) regions
    fogFactor += driftNoise * uFogDriftOpacity * (1.0 - depth);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
  }

  // --------------------------------------------------------
  // 5. Combine: base lighting (multiplicative) + point lights (additive)
  //    Point lights are added AFTER base darkening so they can illuminate
  //    even in rooms with very low ambient. This creates vivid colored
  //    glow pools rather than just brightening dark areas.
  // --------------------------------------------------------

  // --------------------------------------------------------
  // 6. Combine everything
  // --------------------------------------------------------
  vec3 baseLit = color.rgb * lit * ao;

  // Additive colored glow from point lights
  vec3 pointContrib = pointLightAdd * 0.25;

  // Light color bleeding — surfaces near a point light get subtly tinted
  // by averaging point light color into the base (flagship only)
  if (uQualityLevel >= 2 && length(pointLightAdd) > 0.1) {
    vec3 bleedColor = normalize(pointLightAdd) * length(pointLightAdd) * 0.03;
    baseLit += bleedColor * color.rgb;
  }

  vec3 litColor = baseLit + pointContrib;
  litColor = min(litColor, vec3(1.3));
  vec3 finalColor = mix(litColor, uFogColor, fogFactor);

  gl_FragColor = vec4(finalColor, color.a);
}
`

const MAX_LIGHTS = 8

/**
 * PostFX pipeline for combat backgrounds that uses a separate grayscale depth map
 * to produce depth-derived normals, directional lighting, atmospheric fog, and SSAO.
 *
 * Applied to the combat background Image (not the camera). Reads:
 * - `uMainSampler` (unit 0) — the background color image (auto-bound by Phaser)
 * - `uDepthMap` (unit 1) — grayscale depth map (white=near, black=far)
 *
 * Features:
 * - Depth-derived normals via Sobel filter
 * - Directional lighting with 5-step quantization (pixel-art aesthetic)
 * - Depth-based atmospheric fog (far = more fog)
 * - SSAO: 4-tap on mid quality, 8-tap on flagship quality
 * - Micro-animations: torch flicker (near regions), water ripple (far UV distortion),
 *   fog drift (slow-scrolling density variation) — all depth-masked and tier-gated
 */
export class DepthLightingFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _depthGlTexture: WebGLTexture | null = null
  private _hasDepth = false
  private _qualityLevel: 0 | 1 | 2 = 1
  private _startTime = 0

  // Stored uniform values (pushed to GPU in onPreRender)
  private _lightDir: [number, number, number] = [0, -0.5, 1]
  private _lightColor: [number, number, number] = [1, 1, 1]
  private _lightIntensity = 0.5
  private _ambientColor: [number, number, number] = [0.5, 0.5, 0.5]
  private _normalStrength = 1.5
  private _fogColor: [number, number, number] = [0, 0, 0]
  private _fogDensity = 0
  private _fogNear = 0.2
  private _fogFar = 0.9
  private _ssaoRadius = 5.0
  private _ssaoStrength = 0.3
  private _breathAmplitude = 0
  private _breathFreq = 1.0

  // Micro-animation uniforms (Spec 08)
  private _torchFlickerIntensity = 0
  private _waterRippleStrength = 0
  private _fogDriftOpacity = 0

  // Cover-crop remapping (viewport UV → image UV)
  private _cropScale: [number, number] = [1, 1]
  private _cropOffset: [number, number] = [0, 0]

  // Point lights (pushed to GPU in onPreRender)
  private _lightCount = 0
  private _pointLightPos: number[] = new Array(MAX_LIGHTS * 3).fill(0)
  private _pointLightColor: number[] = new Array(MAX_LIGHTS * 3).fill(0)
  private _pointLightParams: number[] = new Array(MAX_LIGHTS * 2).fill(0)

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'DepthLightingFX',
      fragShader: DEPTH_LIGHTING_FRAG,
    })
    this._startTime = performance.now()
  }

  /**
   * Bind a depth map from a Phaser texture key.
   * The texture should be a grayscale image where white=near and black=far.
   * @param scene The Phaser scene that owns the texture cache.
   * @param textureKey The key used to load the depth map texture.
   */
  setDepthMap(scene: Phaser.Scene, textureKey: string): void {
    const tex = scene.textures.get(textureKey)
    if (!tex || tex.key === '__MISSING') {
      console.warn(`[DepthLightingFX] Depth map texture not found: "${textureKey}"`)
      this._hasDepth = false
      this._depthGlTexture = null
      return
    }
    // In Phaser 3.90, source[0].glTexture is a WebGLTextureWrapper2 object.
    // The actual native WebGLTexture is at .webGLTexture inside the wrapper.
    const wrapper = (tex as any).source?.[0]?.glTexture
    const glTexture: WebGLTexture | null = wrapper?.webGLTexture ?? null
    this._depthGlTexture = glTexture
    this._hasDepth = glTexture !== null
    if (!this._hasDepth) {
      console.warn(`[DepthLightingFX] Texture "${textureKey}" has no glTexture (not yet uploaded to GPU?)`)
    }
  }

  /**
   * Clear the depth map reference. The shader will output color unchanged until
   * a new depth map is bound via setDepthMap().
   */
  clearDepthMap(): void {
    this._depthGlTexture = null
    this._hasDepth = false
  }

  /**
   * Set the quality level, which controls SSAO sample count.
   * - 0 (low): no SSAO
   * - 1 (mid): 4-tap cardinal SSAO
   * - 2 (flagship): 8-tap cardinal + diagonal SSAO
   */
  setQualityLevel(level: 0 | 1 | 2): void {
    this._qualityLevel = level
  }

  /**
   * Configure the directional light and normal derivation.
   * @param dir Normalized [x, y, z] light direction. e.g. [0.5, -0.5, 0.7] = upper-right.
   * @param color [r, g, b] light color in 0-1 range.
   * @param intensity Light intensity multiplier (0.5-2.0 typical).
   * @param ambient [r, g, b] ambient/fill light in 0-1 range.
   * @param normalStrength How strongly depth gradients affect normals (1.0-3.0).
   */
  setDirectionalLight(
    dir: [number, number, number],
    color: [number, number, number],
    intensity: number,
    ambient: [number, number, number],
    normalStrength: number
  ): void {
    this._lightDir = dir
    this._lightColor = color
    this._lightIntensity = intensity
    this._ambientColor = ambient
    this._normalStrength = normalStrength
  }

  /**
   * Configure atmospheric depth fog.
   * @param color [r, g, b] fog color (typically a dark desaturated version of the bg palette).
   * @param density Overall fog strength multiplier (0.0=no fog, 1.0=full density).
   * @param near Depth value at which fog begins (0.0-1.0). Pixels with depth above this are unfogged.
   * @param far Depth value at which fog reaches maximum (0.0-1.0, must be < near). Typically 0.0 (far wall).
   */
  setFog(
    color: [number, number, number],
    density: number,
    near: number,
    far: number
  ): void {
    this._fogColor = color
    this._fogDensity = density
    this._fogNear = near
    this._fogFar = far
  }

  /**
   * Configure screen-space ambient occlusion.
   * @param radius Sample radius in texels (3.0-8.0). Larger = detects larger depth discontinuities.
   * @param strength Darkening intensity (0.0=disabled, 0.5=strong). Typical: 0.2-0.35.
   */
  setSSAO(radius: number, strength: number): void {
    this._ssaoRadius = radius
    this._ssaoStrength = strength
  }

  /**
   * Configure parallax breathing animation.
   * @param amplitude Max UV displacement (0.003 = ~3px at 1000px). 0 = disabled.
   * @param freq Oscillation speed in radians per second. ~1.5 = gentle, ~3.0 = noticeable.
   */
  setBreathing(amplitude: number, freq: number): void {
    this._breathAmplitude = amplitude
    this._breathFreq = freq
  }

  /**
   * Set the cover-crop remapping from viewport UV to full-image UV.
   * Needed because the background is cover-scaled (may be wider than viewport).
   * @param scale viewport / displaySize per axis
   * @param offset centering offset per axis
   */
  setCropTransform(scale: [number, number], offset: [number, number]): void {
    this._cropScale = scale
    this._cropOffset = offset
  }

  /**
   * Configure all three depth-map-driven micro-animations (Spec 08).
   *
   * - Torch flicker: multiplies color brightness in near/bright depth regions (depth > 0.6)
   *   using a spatial sin-noise pattern. Mid + flagship.
   * - Water ripple: distorts UV horizontally in far/dark depth regions (depth < 0.35)
   *   before texture sampling. Flagship only.
   * - Fog drift: adds slow-scrolling noise variation to the fog density factor,
   *   stronger in far regions. Mid + flagship.
   *
   * Set all to 0 to disable (used for reduce-motion and low-end devices).
   *
   * @param torch Torch flicker intensity. 0.0 = off. 0.08 = subtle default.
   * @param ripple Water ripple UV strength. 0.0 = off. 0.002 = subliminal default.
   * @param fogDrift Fog drift opacity. 0.0 = off. 0.06 = subtle default.
   */
  setMicroAnimation(torch: number, ripple: number, fogDrift: number): void {
    this._torchFlickerIntensity = torch
    this._waterRippleStrength = ripple
    this._fogDriftOpacity = fogDrift
  }

  /**
   * Set point light positions, colors, and parameters.
   * @param lights Array of light data objects. Max 8 lights.
   */
  setPointLights(lights: Array<{
    x: number; y: number; z: number;
    r: number; g: number; b: number;
    radius: number; intensity: number;
  }>): void {
    this._lightCount = Math.min(lights.length, MAX_LIGHTS)
    for (let i = 0; i < MAX_LIGHTS; i++) {
      if (i < lights.length) {
        const l = lights[i]
        this._pointLightPos[i * 3] = l.x
        this._pointLightPos[i * 3 + 1] = l.y
        this._pointLightPos[i * 3 + 2] = l.z
        this._pointLightColor[i * 3] = l.r
        this._pointLightColor[i * 3 + 1] = l.g
        this._pointLightColor[i * 3 + 2] = l.b
        this._pointLightParams[i * 2] = l.radius
        this._pointLightParams[i * 2 + 1] = l.intensity
      } else {
        // Zero out unused slots
        this._pointLightPos[i * 3] = 0
        this._pointLightPos[i * 3 + 1] = 0
        this._pointLightPos[i * 3 + 2] = 0
        this._pointLightColor[i * 3] = 0
        this._pointLightColor[i * 3 + 1] = 0
        this._pointLightColor[i * 3 + 2] = 0
        this._pointLightParams[i * 2] = 0
        this._pointLightParams[i * 2 + 1] = 0
      }
    }
  }

  onPreRender(): void {
    const elapsed = (performance.now() - this._startTime) / 1000
    this.set1f('uTime', elapsed)
    this.set2f('uTexelSize', 1.0 / this.renderer.width, 1.0 / this.renderer.height)
    this.set2f('uResolution', this.renderer.width, this.renderer.height)
    this.set1i('uQualityLevel', this._qualityLevel)
    this.set1i('uHasDepth', this._hasDepth ? 1 : 0)

    // Directional light
    this.set3f('uLightDir', this._lightDir[0], this._lightDir[1], this._lightDir[2])
    this.set3f('uLightColor', this._lightColor[0], this._lightColor[1], this._lightColor[2])
    this.set1f('uLightIntensity', this._lightIntensity)
    this.set3f('uAmbientColor', this._ambientColor[0], this._ambientColor[1], this._ambientColor[2])
    this.set1f('uNormalStrength', this._normalStrength)

    // Fog
    this.set3f('uFogColor', this._fogColor[0], this._fogColor[1], this._fogColor[2])
    this.set1f('uFogDensity', this._fogDensity)
    this.set1f('uFogNear', this._fogNear)
    this.set1f('uFogFar', this._fogFar)

    // SSAO
    this.set1f('uSSAORadius', this._ssaoRadius)
    this.set1f('uSSAOStrength', this._ssaoStrength)

    // Breathing
    this.set1f('uBreathAmplitude', this._breathAmplitude)
    this.set1f('uBreathFreq', this._breathFreq)

    // Cover-crop remapping
    this.set2f('uCropScale', this._cropScale[0], this._cropScale[1])
    this.set2f('uCropOffset', this._cropOffset[0], this._cropOffset[1])

    // Point lights — set count here, arrays set in onDraw via raw GL
    this.set1i('uLightCount', this._lightCount)

    // Micro-animation (Spec 08)
    this.set1f('uTorchFlickerIntensity', this._torchFlickerIntensity)
    this.set1f('uWaterRippleStrength', this._waterRippleStrength)
    this.set1f('uFogDriftOpacity', this._fogDriftOpacity)
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    const gl = this.gl
    if (this._hasDepth && this._depthGlTexture) {
      this.set1i('uDepthMap', 1)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this._depthGlTexture)
      gl.activeTexture(gl.TEXTURE0)
    }

    // Set point light array uniforms via raw GL — Phaser's set3f fails for array[i>0].
    // The pipeline's program is active at this point (bound by Phaser before onDraw).
    const activeProgram = gl.getParameter(gl.CURRENT_PROGRAM)
    if (activeProgram && this._lightCount > 0) {
      const posLoc = gl.getUniformLocation(activeProgram, 'uPointLightPos[0]')
      const colLoc = gl.getUniformLocation(activeProgram, 'uPointLightColor[0]')
      const parLoc = gl.getUniformLocation(activeProgram, 'uPointLightParams[0]')
      if (posLoc) gl.uniform3fv(posLoc, new Float32Array(this._pointLightPos))
      if (colLoc) gl.uniform3fv(colLoc, new Float32Array(this._pointLightColor))
      if (parLoc) gl.uniform2fv(parLoc, new Float32Array(this._pointLightParams))
    }

    this.bindAndDraw(renderTarget)
  }
}
