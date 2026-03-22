import Phaser from 'phaser'

const SPRITE_LIGHTING_FRAG = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uTexelSize;
uniform vec3 uLightDir;       // Normalized light direction (x, y, z)
uniform vec3 uLightColor;     // Light color (r, g, b) — 0.0-1.0
uniform float uLightIntensity;
uniform vec3 uAmbientColor;   // Ambient light color (r, g, b) — 0.0-1.0
uniform float uNormalStrength; // How strongly gradients affect normals (1.0-3.0)

varying vec2 outTexCoord;

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);

  // Skip transparent pixels
  if (color.a < 0.01) {
    gl_FragColor = color;
    return;
  }

  // Sample 4 cardinal neighbors for luminance gradient
  float texW = uTexelSize.x;
  float texH = uTexelSize.y;

  vec4 sL = texture2D(uMainSampler, outTexCoord + vec2(-texW, 0.0));
  vec4 sR = texture2D(uMainSampler, outTexCoord + vec2( texW, 0.0));
  vec4 sU = texture2D(uMainSampler, outTexCoord + vec2(0.0, -texH));
  vec4 sD = texture2D(uMainSampler, outTexCoord + vec2(0.0,  texH));

  // Use alpha-weighted luminance — transparent neighbors = edge of sprite
  float lL = sL.a > 0.1 ? luminance(sL.rgb) : luminance(color.rgb);
  float lR = sR.a > 0.1 ? luminance(sR.rgb) : luminance(color.rgb);
  float lU = sU.a > 0.1 ? luminance(sU.rgb) : luminance(color.rgb);
  float lD = sD.a > 0.1 ? luminance(sD.rgb) : luminance(color.rgb);

  // Derive normal from luminance gradient (Sobel-like)
  // Brighter pixels are "raised," darker pixels are "recessed"
  float dx = (lL - lR) * uNormalStrength;
  float dy = (lU - lD) * uNormalStrength;
  vec3 normal = normalize(vec3(dx, dy, 1.0));

  // Diffuse lighting
  float NdotL = max(dot(normal, uLightDir), 0.0);

  // Quantize to 5 steps for pixel-art aesthetic
  NdotL = floor(NdotL * 5.0 + 0.5) / 5.0;

  // Combine ambient + directional
  vec3 lit = uAmbientColor + uLightColor * uLightIntensity * NdotL;

  // Clamp to prevent over-brightening
  lit = min(lit, vec3(1.3));

  gl_FragColor = vec4(color.rgb * lit, color.a);
}
`

/**
 * PostFX pipeline that derives surface normals from sprite luminance
 * and applies per-pixel directional lighting. No normal map files needed.
 *
 * This creates a convincing 3D-lit appearance on 2D pixel art by interpreting
 * brightness gradients as surface contours — brighter areas appear "raised"
 * and catch more light from the configured direction.
 */
export class SpriteLightingFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'SpriteLightingFX',
      fragShader: SPRITE_LIGHTING_FRAG,
    })
  }

  onPreRender(): void {
    // Set texel size for neighbor sampling
    this.set2f('uTexelSize',
      1.0 / this.renderer.width,
      1.0 / this.renderer.height
    )
  }

  /**
   * Configure the lighting parameters.
   * @param lightDir Normalized [x, y, z] light direction. [0, -0.5, 1] = from above-center.
   * @param lightColor [r, g, b] light color in 0-1 range
   * @param intensity Light intensity multiplier (0.5-2.0)
   * @param ambientColor [r, g, b] ambient/fill light color in 0-1 range
   * @param normalStrength How aggressively to derive normals from luminance (1.0-3.0)
   */
  setLightConfig(
    lightDir: [number, number, number],
    lightColor: [number, number, number],
    intensity: number,
    ambientColor: [number, number, number],
    normalStrength: number
  ): void {
    this.set3f('uLightDir', lightDir[0], lightDir[1], lightDir[2])
    this.set3f('uLightColor', lightColor[0], lightColor[1], lightColor[2])
    this.set1f('uLightIntensity', intensity)
    this.set3f('uAmbientColor', ambientColor[0], ambientColor[1], ambientColor[2])
    this.set1f('uNormalStrength', normalStrength)
  }
}
