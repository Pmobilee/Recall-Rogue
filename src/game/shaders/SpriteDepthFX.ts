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
  vec2 center = vec2(0.5, 0.55);
  vec2 dirFromCenter = uv - center;

  float phase = depth * 3.14159;
  float breath1 = sin(uTime * uBreathSpeed + phase) * uBreathIntensity;
  float breath2 = sin(uTime * uBreathSpeed * 1.73 + phase * 0.6) * uBreathIntensity * 0.4;
  float breath3 = cos(uTime * uBreathSpeed * 0.7 + phase * 1.3) * uBreathIntensity * 0.2;
  float totalBreath = breath1 + breath2 + breath3;

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

interface DepthFXConfig {
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
}

/**
 * PostFX pipeline that uses a depth map for parallax breathing,
 * per-pixel directional lighting, rim lighting, and ambient occlusion.
 *
 * Uniforms are stored as plain JS data and applied in onDraw() where
 * the GL program is guaranteed to be active.
 */
export class SpriteDepthFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** Phaser texture key for the depth map */
  depthTexKey: string = ''
  /** Stored config — applied as uniforms during onDraw */
  cfg: DepthFXConfig = {
    lightDir: [0, -0.5, 0.87],
    lightColor: [1, 0.9, 0.7],
    lightIntensity: 1.0,
    ambientColor: [0.6, 0.6, 0.65],
    breathIntensity: 0.015,
    breathSpeed: 2.0,
    rimColor: [1, 0.9, 0.8],
    rimIntensity: 0.4,
    rimPower: 2.5,
    normalStrength: 2.5,
  }

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'SpriteDepthFX',
      fragShader: SPRITE_DEPTH_FRAG,
    })
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    const c = this.cfg

    // Set ALL uniforms here where the GL program is active
    this.set1f('uTime', this.game.loop.time / 1000)
    this.set2f('uTexelSize', 1.0 / renderTarget.width, 1.0 / renderTarget.height)
    this.set1i('uDepthMap', 1)
    this.set3f('uLightDir', c.lightDir[0], c.lightDir[1], c.lightDir[2])
    this.set3f('uLightColor', c.lightColor[0], c.lightColor[1], c.lightColor[2])
    this.set1f('uLightIntensity', c.lightIntensity)
    this.set3f('uAmbientColor', c.ambientColor[0], c.ambientColor[1], c.ambientColor[2])
    this.set1f('uBreathIntensity', c.breathIntensity)
    this.set1f('uBreathSpeed', c.breathSpeed)
    this.set3f('uRimColor', c.rimColor[0], c.rimColor[1], c.rimColor[2])
    this.set1f('uRimIntensity', c.rimIntensity)
    this.set1f('uRimPower', c.rimPower)
    this.set1f('uNormalStrength', c.normalStrength)

    // Bind depth map texture to unit 1
    if (this.depthTexKey) {
      const phaserTex = this.game.textures.get(this.depthTexKey)
      if (phaserTex && phaserTex.key !== '__MISSING') {
        // Get the Phaser WebGLTextureWrapper, then its actual WebGLTexture
        const src = (phaserTex as any).source?.[0]
        const webglTex = src?.glTexture?.webGLTexture ?? src?.glTexture
        if (webglTex) {
          const gl = (this.renderer as any).gl as WebGLRenderingContext
          gl.activeTexture(gl.TEXTURE1)
          gl.bindTexture(gl.TEXTURE_2D, webglTex)
          gl.activeTexture(gl.TEXTURE0)
        }
      }
    }

    this.bindAndDraw(renderTarget)
  }
}
