# Making pixel art sprites feel alive in their world

**A cave bat should look different in torchlight than in a cathedral.** That single insight unlocks the entire toolkit for giving 2D sprites environmental presence — and Phaser 3's WebGL renderer has enough built-in infrastructure (Light2D pipeline, PostFX system, particle emitters) to achieve most of these effects without leaving the framework. The highest-impact combination for Recall Rogue is **normal-map lighting + ground contact shadows + room color grading + atmospheric particles** — four techniques that together cost under 3ms per frame on integrated GPUs while transforming flat sprite-on-background scenes into cohesive environments. Dead Cells proved this exact approach commercially, and Phaser 3.60+ ships with the shader pipeline architecture to replicate it.

This report covers ten techniques in full technical depth: implementation in Phaser 3.90, GLSL shader code, performance budgets for Intel integrated GPUs at 1080p, and the pixel art pitfalls that make or break each approach.

---

## The Phaser 3 rendering toolkit you already have

Before diving into techniques, it's critical to understand what Phaser 3.90 provides natively. **Phaser's WebGL pipeline system is the backbone of every technique discussed here.** There are three extension points for custom rendering:

**PostFXPipeline** runs a custom fragment shader on a game object or camera *after* it renders. This is the workhorse for per-sprite effects (rim lighting, AO, color grading). It operates on a framebuffer the size of the target — for a 128px sprite, that's just 16,384 fragments per frame, not the full 2M pixels of a 1080p screen. Registration and usage:

```typescript
class MyEffect extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: 'MyEffect', fragShader: GLSL_STRING });
  }
  onPreRender() {
    this.set1f('uTime', this.game.loop.time / 1000);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
  }
}

// Register in game config: { pipeline: [MyEffect] }
// Or manually: scene.renderer.pipelines.addPostPipeline('MyEffect', MyEffect);
// Apply: sprite.setPostPipeline(MyEffect);
```

**Light2D pipeline** is Phaser's built-in forward-diffuse lighting system supporting up to **10 point lights** (configurable via `maxLights` in render config, but compiled into the shader — cannot change at runtime). It requires normal maps loaded alongside diffuse textures. No directional lights exist natively. Enabling it:

```typescript
// Load with normal map (array syntax)
this.load.image('enemy', ['sprites/enemy.png', 'sprites/enemy_n.png']);

// In create:
const enemy = this.add.sprite(400, 300, 'enemy').setPipeline('Light2D');
this.lights.enable().setAmbientColor(0x333344);
this.lights.addLight(200, 150, 300).setColor(0xff8833).setIntensity(2.0);
```

**Built-in FX (3.60+)** provides ready-made effects accessible via `sprite.preFX` or `sprite.postFX`: Bloom, Glow, Blur, Displacement, Shadow, Vignette, Gradient, ColorMatrix, Shine, and more. These are convenience wrappers around PostFX pipelines and cover many use cases without writing GLSL.

The **particle emitter** (v3.60+ API) creates emitters as direct game objects with depth, blend mode, and transform: `this.add.particles(x, y, 'texture', config)`. The `maxAliveParticles` property is your performance safety valve.

---

## Technique 1 — Dynamic lighting turns rooms into moods

Dynamic per-sprite lighting is the single most transformative technique. A warm orange point light on a sprite in a cave versus a cool blue ambient in an ice chamber instantly communicates environment. Phaser's **Light2D pipeline with normal maps** is the direct path.

The built-in system handles point lights well but lacks directional lights. For room-context lighting (top-down cathedral light, side-mounted torches), define presets per room:

```typescript
const ROOM_LIGHTING: Record<string, RoomLightConfig> = {
  cave_torch: {
    ambient: 0x1a0f05,
    lights: [{ x: 150, y: 200, radius: 300, color: 0xff8833, intensity: 2.0 }]
  },
  cathedral: {
    ambient: 0x222233,
    lights: [{ x: 480, y: 0, radius: 500, color: 0xaabbdd, intensity: 1.2 }]
  },
  ice_cavern: {
    ambient: 0x0a1525,
    lights: [{ x: 400, y: 100, radius: 400, color: 0x4488cc, intensity: 1.5 }]
  }
};
```

**The critical pixel art concern: quantized lighting.** Smooth light falloff clashes with pixel art's discrete color steps. The solution is **stepped/posterized lighting** in the fragment shader — quantize the diffuse calculation to 4–6 bands:

```glsl
float NdotL = max(dot(normal, lightDir), 0.0);
float steps = 5.0;
NdotL = floor(NdotL * steps) / steps; // Stepped falloff
```

This produces the "toon shading" look that Dead Cells uses to blend dynamic lighting with pixel art. Without quantization, sprites develop uncanny smooth gradients that destroy the retro aesthetic.

**Performance:** Light2D with 5–8 lights costs roughly **1ms GPU time** at 1080p. Normal map sampling adds ~10–15% overhead per fragment. For 64–128px sprites, fragment counts are tiny — this is comfortably cheap on integrated GPUs.

**Pros:** Most impactful single technique; makes every room feel distinct; Phaser has native support. **Cons:** Requires normal maps for every sprite; built-in system limited to point lights only; known rotation bug (#3870) where normal vectors don't rotate with sprites.

---

## Technique 2 — Normal maps are the prerequisite for everything

Normal maps encode surface direction per pixel (RGB = XYZ normal vector), enabling per-pixel lighting response on flat 2D sprites. A bat sprite's wing membrane catches light differently than its body mass. **This technique is the foundation — without it, dynamic lighting is just flat distance-based dimming.**

Three tools generate normal maps from pixel art:

- **SpriteIlluminator** (~$40, CodeAndWeb) — Best quality auto-generation with painting tools for manual refinement. Direct TexturePacker integration for spritesheet normal map packing. Official Phaser 3 tutorial exists. The recommended commercial option.
- **Laigter** (free/open-source, itch.io) — Generates normal, specular, parallax, and AO maps. Good for quick results. Lacks painting tools. No macOS support currently.
- **Sprite Lamp** ($20, Steam) — Unique approach: paint the same sprite lit from 2–5 directions, and it computes normals from the lighting differences. Highest potential quality, highest artist effort.

For Recall Rogue's 64–128px enemy sprites, the recommended workflow is **auto-generate base normals with Laigter or SpriteIlluminator, then hand-touch boss/hero sprites.** Auto-generated normals tend toward "pillow shading" (everything looks inflated) on complex sprites, but for simple enemy silhouettes they work well.

A full normal-map lighting shader combining diffuse calculation with pixel-art quantization:

```glsl
precision mediump float;
uniform sampler2D uMainSampler;
uniform sampler2D uNormalMap;
uniform vec3 uLightPos;        // x, y in screen space, z = height
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform vec3 uAmbientColor;
uniform vec2 uResolution;

varying vec2 outTexCoord;

void main() {
    vec4 diffuse = texture2D(uMainSampler, outTexCoord);
    vec3 normal = normalize(texture2D(uNormalMap, outTexCoord).rgb * 2.0 - 1.0);

    vec3 fragPos = vec3(outTexCoord * uResolution, 0.0);
    vec3 lightDir = normalize(uLightPos - fragPos);
    float dist = length(uLightPos - fragPos);
    float atten = 1.0 / (1.0 + 0.005 * dist + 0.00002 * dist * dist);

    float NdotL = max(dot(normal, lightDir), 0.0);
    NdotL = floor(NdotL * 5.0) / 5.0; // Pixel-art-safe stepped lighting

    vec3 lit = uAmbientColor + uLightColor * uLightIntensity * NdotL * atten;
    gl_FragColor = vec4(diffuse.rgb * lit, diffuse.a);
}
```

**Important filtering rule:** Sprite diffuse textures must use `GL_NEAREST` (nearest-neighbor) filtering to stay crisp. Normal maps, counterintuitively, should use **bilinear filtering** — the normal data needs smooth interpolation between texels for correct lighting math. In Phaser, set `pixelArt: true` in game config for sprites, then manually set linear filtering on normal map textures.

---

## Technique 3 — Ground shadows and contact grounding

A dark ellipse beneath a sprite is the single cheapest technique that delivers the most visual grounding. Without a shadow, sprites float in undefined space. With one, they sit on a surface. **This is the highest ratio of visual impact to implementation effort across all ten techniques.**

```typescript
// Generate shadow texture once
const gfx = this.add.graphics();
gfx.fillStyle(0x000000, 0.4);
gfx.fillEllipse(32, 8, 64, 16);
gfx.generateTexture('shadow', 64, 16);
gfx.destroy();

// Per enemy
const shadow = this.add.image(enemy.x, groundY, 'shadow');
shadow.setAlpha(0.35).setDepth(enemy.depth - 1);

// In update — shadow responds to idle bob
const bobOffset = enemy.baseY - enemy.y;
const scale = Phaser.Math.Clamp(1 - bobOffset / 150, 0.3, 1.0);
shadow.setScale(scale, scale * 0.5);
shadow.setAlpha(0.35 * scale);

// Light-direction offset
shadow.x = enemy.x + (enemy.x - lightSource.x) * 0.08;
```

For pixel art, use a **pre-rendered pixel-art ellipse** rather than a smooth Graphics-drawn one. Crisp, dithered shadow edges match the aesthetic better than anti-aliased gradients. A 2–3 color dithered shadow sprite often looks superior to smooth alpha blending.

Phaser 3.60+ also provides `sprite.preFX.addShadow()`, but this creates a CSS-style drop shadow (offset duplicate), not a ground-contact shadow. The manual ellipse approach is better for grounding.

**Performance:** Negligible — one additional sprite draw per enemy. **Pros:** Instant visual grounding, trivial to implement, responds to animation. **Cons:** Ellipse doesn't match sprite silhouette (acceptable for most games); doesn't interact with terrain geometry.

---

## Technique 4 — Ambient occlusion darkens the base

Ambient occlusion on sprites is the complement to ground shadows: where shadows sit *below* the sprite, AO darkens the *bottom portion of the sprite itself*, simulating how light reaches less of the surface near ground contact. Combined, they create convincing surface interaction.

Phaser 3.60+ provides this natively:

```typescript
// Built-in gradient FX — darken sprite base
enemy.preFX.addGradient(
  0x000000, 0x000000,  // dark colors
  0.25,                // alpha (keep subtle!)
  0, 0.6,             // gradient starts at 60% height
  0, 1.0              // gradient ends at bottom
);

// Built-in vignette — darken edges
enemy.preFX.addVignette(0.5, 0.3, 0.6, 0.2); // offset center upward
```

For more control, a custom PostFX shader darkens based on UV position:

```glsl
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uAOStrength;
varying vec2 outTexCoord;

void main() {
    vec4 color = texture2D(uMainSampler, outTexCoord);
    float ao = smoothstep(0.5, 1.0, outTexCoord.y) * uAOStrength;
    color.rgb *= (1.0 - ao);
    gl_FragColor = color;
}
```

**Keep AO strength at 0.15–0.3.** Anything stronger muddies pixel art. For 64–128px sprites, smooth gradients work acceptably — on smaller sprites (16–32px), use stepped or dithered darkening instead.

**Performance:** Very cheap — single-pass shader or built-in FX.

---

## Technique 5 — Rim lighting separates subject from background

Rim lighting (a bright edge on the sprite opposite the light source) is the film cinematography technique that gives 2D sprites dramatic separation from backgrounds. It communicates that the sprite exists in a lit space. The implementation detects sprite edges via alpha sampling of neighboring pixels:

```glsl
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uTexelSize;     // 1.0 / textureSize
uniform vec2 uLightDir;      // normalized light direction
uniform vec3 uRimColor;
uniform float uRimIntensity;

varying vec2 outTexCoord;

void main() {
    vec4 color = texture2D(uMainSampler, outTexCoord);
    if (color.a < 0.01) { gl_FragColor = color; return; }

    float aL = texture2D(uMainSampler, outTexCoord + vec2(-uTexelSize.x, 0.0)).a;
    float aR = texture2D(uMainSampler, outTexCoord + vec2( uTexelSize.x, 0.0)).a;
    float aU = texture2D(uMainSampler, outTexCoord + vec2(0.0,  uTexelSize.y)).a;
    float aD = texture2D(uMainSampler, outTexCoord + vec2(0.0, -uTexelSize.y)).a;

    if (aL + aR + aU + aD < 4.0) {
        vec2 edgeNormal = normalize(vec2(aL - aR, aD - aU));
        float rim = max(0.0, dot(edgeNormal, -uLightDir));
        color.rgb += uRimColor * rim * uRimIntensity;
    }
    gl_FragColor = color;
}
```

Sync rim color with the room's dominant light: orange for torch caves, blue for ice, pale white for moonlit cathedrals. Update the light direction uniform each frame based on the nearest light source position relative to the sprite.

**Alternative if you already have normal maps:** A Fresnel-style rim calculation requires only one extra texture read instead of four:

```glsl
vec3 normal = texture2D(uNormalMap, outTexCoord).rgb * 2.0 - 1.0;
vec3 viewDir = vec3(0.0, 0.0, 1.0);
float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
color.rgb += uRimColor * rim * uRimIntensity;
```

**Performance:** 4 extra texture samples per fragment (alpha-based) or 1 extra (normal-map-based). On a 128×128 sprite via PostFX pipeline: ~65K extra texture reads — comfortable on integrated GPUs. **The normal-map Fresnel approach is cheaper and looks more natural** but requires the normal map infrastructure.

---

## Technique 6 — Color grading unifies sprite and environment

Color grading is the lowest-effort technique that creates the most visual coherence. When a sprite shares the color temperature of its background, it stops looking "pasted on." Phaser provides three tiers:

**Tier 1 — setTint (free, immediate):** Multiplicative color applied per-vertex. Can only darken channels, never brighten. But for room coherence, this is often sufficient:

```typescript
const ROOM_TINTS: Record<string, number> = {
  cave:      0xFFCC88, // warm amber
  ice:       0xAADDFF, // cool blue
  forest:    0xBBDDAA, // green
  cathedral: 0xDDCCEE, // pale purple
  lava:      0xFFAA77, // hot orange
};

// Apply to all sprites on room enter
enemies.forEach(e => e.setTint(ROOM_TINTS[roomType]));
```

Per-vertex tinting with four corner colors creates a lighting gradient without any shader:

```typescript
enemy.setTint(0xFFEEDD, 0xFFEEDD, 0xCC8866, 0xCC8866); // lit top, dark bottom
```

**Tier 2 — ColorMatrix FX (3.60+, cheap):** Hue rotation, saturation, brightness control per-sprite or per-camera:

```typescript
const fx = this.cameras.main.postFX.addColorMatrix();
fx.saturate(-0.2);  // slightly desaturated dungeon
fx.brightness(0.85); // darker
```

**Tier 3 — LUT shader (cinematic, custom):** A lookup table texture maps input colors to output colors, enabling full cinematic color grading. Swap LUT textures per room for dramatically different palettes. This preserves pixel art palette relationships better than multiplicative tinting.

**Transitioning between rooms** — tween the tint values:

```typescript
this.tweens.addCounter({
  from: 0, to: 100, duration: 800, ease: 'Sine.easeInOut',
  onUpdate: (tween) => {
    const t = tween.getValue() / 100;
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(oldColor, newColor, 100, t * 100);
    enemies.forEach(e => e.setTint(Phaser.Display.Color.GetColor(color.r, color.g, color.b)));
  }
});
```

**Performance:** setTint = free (vertex color). ColorMatrix = cheap single-pass. LUT = cheap (one texture lookup per pixel).

---

## Technique 7 — Atmospheric particles sell the fantasy

Floating dust motes, drifting embers, and curling mist fill the space between sprite and background, creating layered depth. The key insight is **splitting particles across depth layers** — some behind the sprite, some in front — so the enemy exists *within* an atmosphere rather than on top of it.

```typescript
// Floating dust motes — behind sprites (depth 3)
const dust = this.add.particles(0, 0, 'dot4x4', {
  x: { min: 0, max: 1920 }, y: { min: 0, max: 1080 },
  scale: { min: 0.1, max: 0.4 },
  alpha: { start: 0, end: 0.3, ease: 'Sine.easeInOut' },
  lifespan: { min: 4000, max: 8000 },
  speedX: { min: -8, max: 8 }, speedY: { min: -5, max: 5 },
  frequency: 200, quantity: 1,
  maxAliveParticles: 30,
  blendMode: 'ADD', tint: 0xccccaa,
  advance: 3000 // Pre-fill so particles exist on scene load
}).setDepth(3);

// Embers — in front of sprites for fire rooms (depth 12)
const embers = this.add.particles(0, 0, 'dot4x4', {
  color: [0xfacc22, 0xf89800, 0xf83600, 0x9f0404],
  colorEase: 'Quad.out',
  lifespan: { min: 1500, max: 3000 },
  angle: { min: -110, max: -70 }, speed: { min: 30, max: 80 },
  scale: { start: 0.3, end: 0 },
  alpha: { start: 0.9, end: 0 },
  gravityY: -40, frequency: 80, quantity: 1,
  maxAliveParticles: 50,
  blendMode: 'ADD',
  advance: 2000
}).setDepth(12);
```

**Depth layer order for the scene:**

| Depth | Layer |
|-------|-------|
| 0 | Background image |
| 3 | Back-atmosphere (dust, spores) |
| 5 | Ground shadows |
| 7 | Light shaft sprites (ADD blend) |
| 10 | Enemy sprites |
| 12 | Front-atmosphere (embers, mist) |
| 20+ | UI elements |

**Volumetric light shafts** work best as **pre-rendered sprite art with ADD blend mode** in pixel art games. A hand-drawn tapered beam sprite, animated with a gentle alpha/scale tween, is cheaper and more aesthetically consistent than a shader-based approach:

```typescript
const shaft = this.add.image(300, 0, 'lightShaft')
  .setBlendMode('ADD').setAlpha(0.25).setDepth(7);
this.tweens.add({
  targets: shaft, alpha: { from: 0.15, to: 0.35 },
  scaleX: { from: 0.9, to: 1.1 },
  duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
});
```

**Performance budget:** Target **80–150 total alive particles** across all emitters. At this count with small (4×4 or 8×8) textures, particle rendering is well under 1ms on integrated GPUs. Use `maxAliveParticles` on every emitter as a hard safety cap. The `advance` property pre-simulates particles so they exist when the scene loads — no awkward empty-room moment.

---

## Technique 8 — Parallax transforms static scenes into spaces

For a card roguelite with static encounter screens, **idle camera sway combined with scroll-factor parallax** creates the illusion of depth even without player movement. Split the background into 2–3 layers and apply a gentle sine-wave camera oscillation:

```typescript
// Background layers with different scroll factors
this.add.image(960, 540, 'bg_far').setScrollFactor(0.0).setDepth(0);   // Fixed deep bg
this.add.image(960, 540, 'bg_mid').setScrollFactor(0.3).setDepth(1);   // Slow parallax
// Gameplay layer at default scrollFactor 1.0
this.add.image(100, 900, 'fg_pillar').setScrollFactor(1.2).setDepth(100); // Foreground

// Idle camera sway — creates parallax even in static scenes
this.tweens.add({
  targets: this.cameras.main,
  scrollX: { from: -3, to: 3 },
  scrollY: { from: -1.5, to: 1.5 },
  duration: 5000, ease: 'Sine.easeInOut',
  yoyo: true, repeat: -1
});
```

**Mouse-position parallax** adds interactivity — the camera shifts subtly toward the cursor, making the scene feel responsive:

```typescript
update() {
  const px = (this.input.activePointer.x - 960) / 960; // -1 to 1
  const py = (this.input.activePointer.y - 540) / 540;
  this.cameras.main.scrollX = Phaser.Math.Linear(
    this.cameras.main.scrollX, px * 12, 0.05
  );
  this.cameras.main.scrollY = Phaser.Math.Linear(
    this.cameras.main.scrollY, py * 8, 0.05
  );
}
```

**Foreground frame elements** — stalactites, pillars, or foliage overlapping the sprite from the edges of the screen — create powerful depth with minimal effort. Set them at `scrollFactor > 1.0` and high depth so they move faster than the camera and overlap the battle scene.

**Critical pixel art rule:** Camera sway amounts must snap to whole pixels. Set `roundPixels: true` in your game config and keep parallax shifts small (2–6px total) to prevent sub-pixel shimmer that blurs pixel art.

**Performance:** Negligible — 2–3 extra image draws plus one tween. VRAM consideration: each full-screen 1920×1080 layer is ~8MB RGBA, so three layers = ~24MB. Manageable but worth noting.

---

## Technique 9 — Heat haze for elemental rooms

UV displacement in a fragment shader creates convincing heat shimmer for lava/fire rooms. Phaser 3.60+ has a **built-in Displacement FX** that handles this with zero custom GLSL:

```typescript
this.load.image('noiseMap', 'assets/perlin_noise.png');
// ...
const haze = this.cameras.main.postFX.addDisplacement('noiseMap', 0.004, 0.004);
// Animate in update:
haze.x = 0.003 * Math.sin(this.time.now * 0.001);
haze.y = 0.003 * Math.cos(this.time.now * 0.0013);
```

For localized haze (only the bottom half of the screen near lava), a custom shader with a `smoothstep` mask is better:

```glsl
uniform float uTime;
uniform float uStrength;  // 0.003 - 0.008
uniform float uYStart;    // 0.4 = bottom 60% affected
varying vec2 outTexCoord;

void main() {
    vec2 uv = outTexCoord;
    float mask = smoothstep(uYStart, uYStart + 0.15, uv.y);
    float distX = sin(uv.y * 40.0 + uTime * 2.0) * uStrength * mask;
    float distY = cos(uv.x * 28.0 + uTime * 1.6) * uStrength * 0.5 * mask;
    gl_FragColor = texture2D(uMainSampler, uv + vec2(distX, distY));
}
```

**Pixel art constraint:** Keep `uStrength` between **0.002 and 0.008**. Pixel art has hard edges that shatter visually with large UV offsets. The shimmer should be barely perceptible — felt more than seen.

**Performance:** Very cheap — sin/cos math plus one texture lookup per pixel. A single-pass full-screen shader at 1080p is well under 1ms.

---

## Technique 10 — Micro-animation synced with environment

Idle breathing is standard, but **syncing micro-animations with the room** is what sells environmental presence. A fire enemy whose glow pulses in rhythm with the room's torch particles. An ice-room enemy that shivers. A cloth that drifts toward the room's wind direction.

```typescript
// Idle breathing (universal)
this.tweens.add({
  targets: enemy,
  y: enemy.y - 2, scaleX: enemy.scaleX * 1.02, scaleY: enemy.scaleY * 0.98,
  duration: 1500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
});

// Shared room oscillator — drives torch particles AND enemy glow in sync
class RoomOscillator {
  private time = 0;
  constructor(private freq = 0.003) {}
  update(delta: number): number {
    this.time += delta;
    return Math.sin(this.time * this.freq);
  }
}

// In update — fire enemy pulses with room torches
const flicker = this.roomOscillator.update(delta);
torchEmitter.setAlpha(0.8 + flicker * 0.2);
fireEnemy.setAlpha(0.9 + flicker * 0.1);

// Ice room — subtle shiver
this.tweens.add({
  targets: enemy,
  x: { from: enemy.x - 0.5, to: enemy.x + 0.5 },
  duration: 80, yoyo: true, repeat: -1
});
```

For 64–128px pixel art, **hand-drawn spritesheet idle frames look far better than tween-based scaling**, which causes pixel "swimming." Use 2–4 frame breathe cycles drawn by the artist, supplemented by tween-based environmental reactions (shiver, lean, flicker) that are too subtle to cause visible pixel distortion.

**Performance:** Tweens are negligible — Phaser handles thousands efficiently. Spritesheet animation is standard sprite rendering cost.

---

## Performance cost ranking for integrated GPUs

Every technique ranked from cheapest to most expensive at 1920×1080 on Intel UHD 620-class integrated GPUs:

| Rank | Technique | Est. GPU Cost | Notes |
|------|-----------|---------------|-------|
| 1 | setTint color grading | **Free** | Vertex color, zero overhead |
| 2 | Ground shadow ellipse | **~0.01ms** | One extra sprite draw |
| 3 | Idle tweens / micro-animation | **~0.01ms** | CPU tween math only |
| 4 | Parallax layers + camera sway | **~0.05ms** | 2–3 extra image draws |
| 5 | Light shaft sprites (ADD blend) | **~0.05ms** | 2–4 blended sprites |
| 6 | Atmospheric particles (80–150) | **~0.5ms** | CPU update + GPU quads |
| 7 | AO gradient (preFX) | **~0.1ms/sprite** | Single-pass built-in FX |
| 8 | Heat haze shader | **~0.5ms** | Full-screen single pass |
| 9 | ColorMatrix FX (camera) | **~0.5ms** | Full-screen single pass |
| 10 | Normal map lighting (Light2D, 5 lights) | **~1.0ms** | Multi-light fragment shader |
| 11 | Rim lighting (alpha-based) | **~0.3ms/sprite** | 4 neighbor samples per fragment |
| 12 | Rim lighting (normal-map Fresnel) | **~0.1ms/sprite** | 1 extra texture read |
| 13 | LUT color grading | **~0.5ms** | Full-screen, one texture lookup |
| 14 | God rays shader (32 samples) | **~2–4ms** | 32 texture reads per pixel — use sparingly |
| 15 | Gaussian blur AO | **~3–5ms** | Multi-pass — avoid per-sprite |

**Total budget for the recommended combination** (normal maps + shadows + particles + color grading + rim light + AO + parallax): approximately **2.5–3.5ms** — well within the **16.6ms frame budget** for 60fps, leaving ~13ms for game logic, UI rendering, and sprite animation.

---

## The recommended combination: maximum impact for minimum cost

For Recall Rogue specifically — a card roguelite with single enemy encounters on static backgrounds — these **four core techniques** deliver the best visual transformation:

**1. Normal-map lighting via Light2D pipeline** — Makes every room feel distinct. A torchlit cave casts warm side-light; an ice cavern bathes the enemy in cold blue. This is the Dead Cells approach and the single biggest upgrade. Cost: ~1ms. Requires generating normal maps for each enemy sprite.

**2. Ground contact shadow + sprite-base AO** — Grounds the enemy on the floor plane. The shadow ellipse below plus a gradient darkening at the sprite's base creates the illusion of physical contact with the environment. Cost: ~0.1ms combined.

**3. Room color grading via setTint + ColorMatrix** — The cheapest coherence win. Apply per-room tint to sprites and backgrounds so everything shares the same color temperature. Cost: effectively free.

**4. Atmospheric particles at two depth layers** — Dust motes or spores drifting behind the sprite, embers or mist drifting in front. Creates the sense that the enemy exists within a volumetric space. Cost: ~0.5ms.

**Layer these three polish additions on top:**

**5. Rim lighting** — Use the normal-map Fresnel approach since you already have normal maps. Adds dramatic edge separation for ~0.1ms per sprite. Color-match the rim to the room's dominant light.

**6. Parallax layers + idle camera sway** — Split backgrounds into 2–3 depth layers. Add a gentle 3–4 pixel camera oscillation. Transforms flat encounter screens into spatial environments. Cost: ~0.05ms.

**7. Idle micro-animation synced with room** — Enemy breathe cycle plus room-specific reactions (torch flicker sync, ice shiver). Cost: negligible.

This seven-technique stack totals roughly **2–3ms GPU overhead** — well within integrated GPU budgets — while transforming the game from "sprite pasted on image" to "creature inhabiting a space."

---

## What the best pixel art games actually do

**Dead Cells** is the closest reference to what Recall Rogue should aim for. Motion Twin uses 3D models rendered to 2D sprites with **hand-drawn normal maps on all backgrounds and decorations**, enabling their dynamic lighting system to recolor entire biomes without redrawing assets. Their developer stated: *"Thanks to the normal maps, a torch on the left of a statue will light up the statue from the correct direction while respecting its base colors."* This is directly replicable in Phaser's Light2D pipeline.

**Sea of Stars** (Sabotage Studio) represents the gold standard — they spent **six months building a custom render pipeline** specifically for dynamic lighting on pixel art. A torch creates real-time shadows from characters; charging a fire attack generates shadows from other on-screen characters. This level of integration is aspirational but likely excessive for Recall Rogue's scope.

**Celeste** achieves tremendous atmosphere through simplicity: single-pixel particles for snow, a scene-wide gradient shader that subtly shifts colors across the screen, and hand-painted backgrounds with deliberately less contrast than foreground tiles. Pedro Medeiros's approach proves that **systematic, reusable atmospheric systems** (build once, deploy everywhere) beat bespoke per-scene effects.

**Hyper Light Drifter** demonstrates that **color palette mastery alone** can create environmental presence — split-complementary color schemes per zone, broad gradient overlays atop strict pixel art, and strategic use of soft pastel washes that bend pixel art rules for atmospheric depth.

**Owlboy** is the parallax gold standard — nine years of hand-crafted multi-layer backgrounds with atmospheric perspective (less contrast and saturation at distance). Baked directional lighting painted directly into sprites remains "the most efficient way to light a 2D game."

---

## Pitfalls that destroy pixel art in practice

**Smooth lighting without quantization** is the most common failure. Applying continuous diffuse lighting to a 6-color pixel art sprite creates uncanny smooth gradients that clash violently with the art style. Always quantize lighting output to **4–6 discrete steps** using `floor(value * steps) / steps` in the fragment shader.

**Sub-pixel rendering causes pixel swimming.** When sprites or cameras move at non-integer positions, bilinear filtering interpolates between texels, causing the pixel grid to "creep" and shimmer. Set `pixelArt: true` and `roundPixels: true` in Phaser's game config. For camera sway, snap scroll positions to integers: `cam.scrollX = Math.round(cam.scrollX)`.

**Auto-generated normal maps default to pillow shading.** Tools like Laigter and SpriteIlluminator infer depth from the 2D image, which makes everything look inflated/rounded. Always test auto-generated normals under actual in-game lighting before committing. Hand-touch important sprites, or accept that some auto-generated normals will look worse than no normals at all.

**ADD blend mode on particles washes out near bright backgrounds.** Additive particles glow beautifully against dark backgrounds but become invisible or blow out against bright areas. Keep particle alpha low (**0.1–0.4**) and test against both your darkest and brightest room backgrounds.

**Multiple PostFX pipelines stack performance costs.** Each PostFX on a sprite or camera adds a render-target switch and a full-resolution shader pass. Stacking bloom + rim light + color grade + AO on one sprite means four passes. **Combine effects into a single custom shader** where possible rather than chaining built-in FX.

**Blend mode changes cause WebGL batch flushes.** Every time a new blend mode is encountered in the render order, Phaser flushes the current draw batch. Minimize blend mode variety — group all ADD-blended objects together in rendering order using Phaser's Layer system.

**The Light2D pipeline's sprite disappearance bug:** Sprites set to the Light2D pipeline **without** a normal map loaded will disappear entirely. If some enemies lack normal maps, they cannot use this pipeline. Provide a flat normal map (solid RGB 128, 128, 255) as a fallback for any sprite that hasn't had a proper normal map created yet.

---

## Phaser community plugins and resources

**Rex Rainbow plugins** (npm: `phaser3-rex-plugins`) provide the largest collection of Phaser 3 extensions. Shader-relevant plugins include: HSL Adjust (color correction), Toonify (posterized shading — directly useful for quantized pixel art lighting), Outline, Glow, Drop Shadow, CRT, Horri-fi (combined retro effects), and Kawase Blur.

**CodeAndWeb's Light2D tutorial** (`codeandweb.com/spriteilluminator/tutorials/how-to-create-light-effects-in-phaser3`) provides the complete workflow from SpriteIlluminator normal map generation through TexturePacker spritesheet packing to Phaser Light2D pipeline integration, with a working GitHub example repository.

**Phaser's built-in FX suite (3.60+)** covers many needs without plugins: `preFX.addGlow()`, `preFX.addShadow()`, `preFX.addVignette()`, `preFX.addGradient()`, `preFX.addColorMatrix()`, `postFX.addDisplacement()`, `postFX.addBloom()`. These are optimized, maintained, and well-documented.

For normal map generation, **Laigter** (free on itch.io) and **SpriteIlluminator** ($40) are the primary tools. The **Aseprite Normal Toolkit** (free extension) enables painting normals directly in Aseprite using a color-wheel reference. **Sprite Lamp** ($20 on Steam) takes a unique multi-directional-lighting approach that can produce the highest-quality normals but requires painting each sprite lit from 2–5 directions.

---

## Conclusion

The gap between "sprite pasted on background" and "creature inhabiting a space" closes with surprisingly few techniques applied well. **Normal-map lighting, contact shadows, room-specific color grading, and depth-layered particles** form the minimum viable stack — each individually cheap, collectively transformative. Phaser 3's Light2D pipeline and PostFX architecture provide the infrastructure natively; the main investment is generating normal maps for enemy sprites and building a config-driven room atmosphere system.

The deeper insight from studying Dead Cells, Sea of Stars, and Celeste is that **systemic approaches beat bespoke effects.** Build a room lighting config that drives ambient color, light positions, particle types, rim color, and tint values from a single data structure. When a new biome is added, it's a config entry — not new shader code. The techniques themselves are mature and well-understood; what separates professional results from hobbyist results is quantizing lighting to respect the pixel art aesthetic, snapping everything to the pixel grid, and knowing that a $0 `setTint` call often does 80% of the work of a custom lighting shader. Start with the free techniques. Layer complexity only where it pays off. A subtle cave bat with correct warm tint, a ground shadow, and a few floating dust motes will read as "alive in its world" to every player who sees it.