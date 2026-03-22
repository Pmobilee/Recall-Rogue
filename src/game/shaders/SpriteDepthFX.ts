import Phaser from 'phaser'

const SPRITE_DEPTH_FRAG = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform sampler2D uDepthMap;
uniform vec2 uTexelSize;
uniform float uTime;

// Lighting
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform vec3 uAmbientColor;

// Breathing / parallax
uniform float uBreathIntensity;
uniform float uBreathSpeed;

// Rim
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform float uRimPower;

// Normal derivation
uniform float uNormalStrength;

varying vec2 outTexCoord;

void main() {
  vec2 uv = outTexCoord;

  // ── Sample depth at original position ─────────────
  float depth = texture2D(uDepthMap, uv).r;

  // ── Parallax breathing ────────────────────────────
  // Close parts (high depth) sway more than edges (low depth).
  // Direction radiates outward from sprite center.
  vec2 center = vec2(0.5, 0.55);
  vec2 dirFromCenter = uv - center;

  // Multi-frequency breathing for organic feel
  float phase = depth * 3.14159;
  float breath1 = sin(uTime * uBreathSpeed + phase) * uBreathIntensity;
  float breath2 = sin(uTime * uBreathSpeed * 1.73 + phase * 0.6) * uBreathIntensity * 0.4;
  float breath3 = cos(uTime * uBreathSpeed * 0.7 + phase * 1.3) * uBreathIntensity * 0.2;
  float totalBreath = breath1 + breath2 + breath3;

  // Depth-weighted displacement — center mass moves most
  vec2 displacement = dirFromCenter * totalBreath * depth;
  uv += displacement;

  // ── Sample color at displaced UV ──────────────────
  vec4 color = texture2D(uMainSampler, uv);
  if (color.a < 0.01) {
    gl_FragColor = color;
    return;
  }

  // ── Re-sample depth at displaced position ─────────
  float depthHere = texture2D(uDepthMap, uv).r;

  // ── Derive normals from depth gradient ────────────
  float dL = texture2D(uDepthMap, uv + vec2(-uTexelSize.x, 0.0)).r;
  float dR = texture2D(uDepthMap, uv + vec2( uTexelSize.x, 0.0)).r;
  float dU = texture2D(uDepthMap, uv + vec2(0.0, -uTexelSize.y)).r;
  float dD = texture2D(uDepthMap, uv + vec2(0.0,  uTexelSize.y)).r;

  vec3 normal = normalize(vec3(
    (dL - dR) * uNormalStrength,
    (dU - dD) * uNormalStrength,
    1.0
  ));

  // ── Diffuse lighting (quantized for pixel art) ────
  float NdotL = max(dot(normal, uLightDir), 0.0);
  NdotL = floor(NdotL * 5.0 + 0.5) / 5.0;
  vec3 lit = uAmbientColor + uLightColor * uLightIntensity * NdotL;

  // ── Rim lighting ──────────────────────────────────
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), uRimPower);
  rim = floor(rim * 3.0 + 0.5) / 3.0;
  lit += uRimColor * rim * uRimIntensity;

  // ── Depth-based AO ────────────────────────────────
  float ao = 0.8 + depthHere * 0.2;
  lit *= ao;

  lit = min(lit, vec3(1.5));

  gl_FragColor = vec4(color.rgb * lit, color.a);
}
`;

/**
 * PostFX pipeline that uses a depth map for parallax breathing,
 * per-pixel directional lighting, rim lighting, and ambient occlusion.
 */
export class SpriteDepthFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _depthTexKey: string = ''
  private _configSet = false

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'SpriteDepthFX',
      fragShader: SPRITE_DEPTH_FRAG,
    })
  }

  onBoot(): void {
    // Register the depth map sampler
    this.set1i('uDepthMap', 1)
  }

  onPreRender(): void {
    // Time uniform for breathing animation
    this.set1f('uTime', this.game.loop.time / 1000)
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    // Set texel size based on the render target (sprite's framebuffer dimensions)
    this.set2f('uTexelSize',
      1.0 / renderTarget.width,
      1.0 / renderTarget.height
    )

    // Bind depth map texture to unit 1
    if (this._depthTexKey) {
      const texManager = this.game.textures
      const tex = texManager.get(this._depthTexKey)
      if (tex) {
        const glTex = (tex as any).source?.[0]?.glTexture
        if (glTex) {
          const gl = (this.renderer as any).gl as WebGLRenderingContext
          gl.activeTexture(gl.TEXTURE1)
          gl.bindTexture(gl.TEXTURE_2D, glTex)
          gl.activeTexture(gl.TEXTURE0)
        }
      }
    }

    // Draw using the PostFX pipeline's shader — applies fragment shader and copies to game
    this.bindAndDraw(renderTarget)
  }

  /**
   * Set the depth map texture key (Phaser texture key, not GL texture).
   */
  setDepthTextureKey(key: string): void {
    this._depthTexKey = key
  }

  /**
   * Configure all shader uniforms at once.
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
    this._configSet = true
  }
}
