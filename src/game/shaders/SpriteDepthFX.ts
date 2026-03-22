import Phaser from 'phaser'

const SPRITE_DEPTH_FRAG = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform sampler2D uDepthMap;
uniform vec2 uTexelSize;
uniform float uTime;

// Lighting
uniform vec3 uLightDir;        // Normalized light direction
uniform vec3 uLightColor;      // Light color (0-1)
uniform float uLightIntensity; // 0.5-2.0
uniform vec3 uAmbientColor;    // Ambient fill (0-1)

// Breathing
uniform float uBreathIntensity; // 0.0-0.01 (subtle!)
uniform float uBreathSpeed;     // 1.0-3.0

// Rim
uniform vec3 uRimColor;
uniform float uRimIntensity;    // 0.0-1.0
uniform float uRimPower;        // 2.0-5.0

// Normal derivation
uniform float uNormalStrength;  // 1.0-4.0

varying vec2 outTexCoord;

void main() {
  vec2 uv = outTexCoord;

  // ── Sample depth map ──────────────────────────────
  float depth = texture2D(uDepthMap, uv).r;

  // ── Parallax breathing ────────────────────────────
  // Closer parts (high depth) sway more than distant parts
  // Direction radiates from sprite center, phase offset by depth
  vec2 dirFromCenter = uv - vec2(0.5, 0.55); // slightly below center
  float phaseOffset = depth * 3.14159;
  float breathAmount = sin(uTime * uBreathSpeed + phaseOffset) * uBreathIntensity;
  // Add secondary frequency for organic feel
  breathAmount += sin(uTime * uBreathSpeed * 1.7 + phaseOffset * 0.7) * uBreathIntensity * 0.3;
  vec2 displacement = dirFromCenter * breathAmount * depth;
  uv += displacement;

  // ── Sample color with displaced UV ────────────────
  vec4 color = texture2D(uMainSampler, uv);
  if (color.a < 0.01) {
    gl_FragColor = color;
    return;
  }

  // ── Re-sample depth at displaced position ─────────
  float depthHere = texture2D(uDepthMap, uv).r;

  // ── Derive normals from depth gradient (Sobel) ────
  float dL = texture2D(uDepthMap, uv + vec2(-uTexelSize.x, 0.0)).r;
  float dR = texture2D(uDepthMap, uv + vec2( uTexelSize.x, 0.0)).r;
  float dU = texture2D(uDepthMap, uv + vec2(0.0, -uTexelSize.y)).r;
  float dD = texture2D(uDepthMap, uv + vec2(0.0,  uTexelSize.y)).r;

  vec3 normal = normalize(vec3(
    (dL - dR) * uNormalStrength,
    (dU - dD) * uNormalStrength,
    1.0
  ));

  // ── Diffuse lighting ──────────────────────────────
  float NdotL = max(dot(normal, uLightDir), 0.0);
  // Quantize to 5 steps for pixel-art aesthetic
  NdotL = floor(NdotL * 5.0 + 0.5) / 5.0;

  vec3 lit = uAmbientColor + uLightColor * uLightIntensity * NdotL;

  // ── Rim lighting (Fresnel from depth normals) ─────
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), uRimPower);
  // Quantize rim to 3 steps
  rim = floor(rim * 3.0 + 0.5) / 3.0;
  lit += uRimColor * rim * uRimIntensity;

  // ── Depth-based ambient occlusion ─────────────────
  // Pixels with low depth (edges/thin parts) get slightly darker
  float ao = 0.85 + depthHere * 0.15; // range 0.85-1.0
  lit *= ao;

  // Clamp to prevent over-brightening
  lit = min(lit, vec3(1.4));

  gl_FragColor = vec4(color.rgb * lit, color.a);
}
`;

/**
 * PostFX pipeline that uses a depth map to add parallax breathing,
 * per-pixel directional lighting, rim lighting, and ambient occlusion
 * to 2D pixel art sprites. Reads the depth map from a second texture unit.
 */
export class SpriteDepthFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _depthTexture: WebGLTexture | null = null

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'SpriteDepthFX',
      fragShader: SPRITE_DEPTH_FRAG,
    })
  }

  onPreRender(): void {
    this.set2f('uTexelSize',
      1.0 / this.renderer.width,
      1.0 / this.renderer.height
    )
    this.set1f('uTime', this.game.loop.time / 1000)

    // Bind depth map to texture unit 1
    if (this._depthTexture) {
      this.set1i('uDepthMap', 1)
      const gl = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this._depthTexture)
      gl.activeTexture(gl.TEXTURE0)
    }
  }

  /**
   * Set the depth map GL texture to bind on each render.
   * @param glTexture The WebGL texture handle for the depth map
   */
  setDepthTexture(glTexture: WebGLTexture): void {
    this._depthTexture = glTexture
  }

  /**
   * Configure all shader uniforms.
   */
  setConfig(config: {
    lightDir: [number, number, number]
    lightColor: [number, number, number]
    lightIntensity: number
    ambientColor: [number, number, number]
    breathIntensity: number
    breathSpeed: number
    rimColor: [number, number, number]
    rimIntensity: number
    rimPower: number
    normalStrength: number
  }): void {
    this.set3f('uLightDir', config.lightDir[0], config.lightDir[1], config.lightDir[2])
    this.set3f('uLightColor', config.lightColor[0], config.lightColor[1], config.lightColor[2])
    this.set1f('uLightIntensity', config.lightIntensity)
    this.set3f('uAmbientColor', config.ambientColor[0], config.ambientColor[1], config.ambientColor[2])
    this.set1f('uBreathIntensity', config.breathIntensity)
    this.set1f('uBreathSpeed', config.breathSpeed)
    this.set3f('uRimColor', config.rimColor[0], config.rimColor[1], config.rimColor[2])
    this.set1f('uRimIntensity', config.rimIntensity)
    this.set1f('uRimPower', config.rimPower)
    this.set1f('uNormalStrength', config.normalStrength)
  }
}
