# Depth maps transform 2D sprites into living, breathing game art

**A single grayscale image paired with a flat sprite unlocks an entire dimension of visual effects** — from pseudo-3D parallax and dynamic lighting to atmospheric fog, depth-of-field blur, and cinematic dissolves. These techniques are well-documented, shader-implementable, and increasingly accessible through browser-based AI depth estimation. For a crystal golem boss in a Phaser.js game, a depth map enables at least ten distinct visual effects, all composable in a single fragment shader pipeline, all achievable without manual per-frame animation.

The core principle is simple: a depth map encodes per-pixel distance from the viewer as a grayscale value (white = close, black = far). Every effect below reads this value and uses it to modulate some visual property — UV offset, blur radius, fog density, lighting intensity, or particle spawn position. The shader pattern `displacedUV = originalUV + someOffset * depth` underpins nearly all of them.

---

## The parallax illusion: making flat sprites feel three-dimensional

The "3D photo" or "fake 3D" effect displaces UV coordinates based on depth, causing closer pixels to shift more than distant ones when the camera or cursor moves. The fragment shader logic is remarkably compact:

```glsl
float depth = texture2D(depthMap, uv).r;
vec2 offset = mouseDirection * depth * intensity;
gl_FragColor = texture2D(colorTexture, uv + offset);
```

This works because a shader can only change the color of its current pixel — it cannot move pixels elsewhere. So the logic is reversed: "which pixel *should* be drawn here?" Each fragment samples from a displaced location, and depth controls how much displacement occurs. The Codrops "Fake 3D Image Effect" tutorial by Yuri Artiukh (Akella) and Alan Zucconi's parallax shader tutorial both document this approach with full WebGL code. Remapping depth from `[0,1]` to `[-0.5, +0.5]` enables bidirectional parallax where foreground moves opposite to background: `displacement = scale * ((depth - 0.5) * 2.0)`.

For higher quality with self-occlusion, **Steep Parallax Mapping** ray-marches through the depth map in 10–16 steps, finding where a virtual ray intersects the height field. **Parallax Occlusion Mapping (POM)** adds binary search refinement between the last two steps for sub-step precision. The DOWNPOURDIGITAL `glsl-parallax-occlusion-mapping` npm module provides a drop-in GLSL function: `vec2 newUv = pom(depthTexture, uv, viewDirection.xy * 0.1)`. These techniques originate from LearnOpenGL's comprehensive treatment and translate directly to WebGL.

**Breathing and idle animation** extends the same displacement with time modulation. A sine wave multiplied by depth creates organic movement where closer elements sway more:

```glsl
float phaseOffset = depth * 3.14159;  // wave moves through body layers
vec2 dirFromCenter = uv - vec2(0.5, 0.6);
float breathAmount = sin(time * 2.0 + phaseOffset) * 0.005;
vec2 displacement = dirFromCenter * breathAmount * depth;
```

The `phaseOffset` based on depth means different layers breathe at different phases, creating a peristaltic wave effect through the golem's body. Combining multiple sine frequencies (`sin(t * 2.0)`, `sin(t * 2.0 + 2.094)`, `sin(t * 2.0 + 4.189)`) produces more natural, organic-feeling motion than a single oscillation.

---

## Dynamic lighting from a single grayscale texture

A depth map yields a normal map through a single mathematical operation: compute the gradient. The **4-tap central difference** method samples four neighbors and constructs a surface normal:

```glsl
float left  = texture2D(depthMap, uv - vec2(texelSize.x, 0.0)).r;
float right = texture2D(depthMap, uv + vec2(texelSize.x, 0.0)).r;
float up    = texture2D(depthMap, uv + vec2(0.0, texelSize.y)).r;
float down  = texture2D(depthMap, uv - vec2(0.0, texelSize.y)).r;
vec3 normal = normalize(vec3((left - right) * strength, (down - up) * strength, 1.0));
```

For noise-resistant results, the **Sobel filter** uses a weighted 3×3 kernel (9 texture samples) with Gaussian smoothing built in. The **Scharr variant** (coefficients 3/10/3 instead of 1/2/1) provides better rotational invariance. Both are well-documented across LearnOpenGL, GameDev.net, and the Material Maker node documentation.

Once normals exist, **Lambertian diffuse + Blinn-Phong specular** lighting produces convincing real-time illumination. The lwjgl-basics ShaderLesson6 by mattdesl provides the canonical WebGL implementation: the light direction vector is computed from the fragment's screen position to the light position, dot-producted with the decoded normal, and attenuated by distance using constant-linear-quadratic falloff. For a crystal golem, high shininess values (**64–128**) create sharp specular highlights on crystal facets.

**Self-shadowing** via height-map ray marching adds dramatic depth. Matt Greer's WebGL shadow technique marches from each pixel toward the light source through the depth map; if any intervening pixel's height blocks the light path, the pixel is shadowed. The key shader loop checks `if (traceHeight <= otherHeight) return true` for each step. Soft shadows accumulate a fractional shadow factor instead of using binary occlusion, creating gentler transitions.

**Ambient occlusion** from a depth map darkens crevices by sampling a small neighborhood around each pixel. A simple 5×5 kernel checks how many neighbors sit at a higher depth than the center pixel. Where surrounding pixels are closer to the viewer (higher depth values), the current pixel gets darkened — effectively detecting concavities between the golem's crystal formations.

---

## Atmospheric effects that sell perceived depth

**Fog** is the simplest depth-driven effect: `mix(spriteColor, fogColor, fogFactor)` where `fogFactor = 1.0 - exp(-depth * depth * density)`. Exponential-squared falloff produces the most natural-looking atmospheric haze. Using a 1D gradient texture instead of a flat color allows colored fog layers — cooler blues in the background, warm haze in the midground. The developers of *Degrees of Separation* documented this approach, noting that fog parameters should be computed on the CPU and passed as a Vector3 encoding fog boundaries.

**Depth-of-field** blur uses the circle of confusion (CoC): `coc = abs(depth - focalDepth) * cocScale`. Pixels at the focal plane stay sharp; others get progressively blurred with radius proportional to their CoC. A **Poisson disk sampling** pattern with 16 points provides good quality at reasonable cost. A critical optimization is the **pre-blurred texture approach** from the Codrops tutorial: ship a pre-blurred copy of the sprite and blend between sharp and blurred based on depth divergence — this avoids real-time convolution entirely, costing just one extra texture lookup. *Octopath Traveler*'s signature HD-2D aesthetic relies heavily on this effect, applying cinematic DoF to pixel art sprites placed in 3D environments.

**Depth-based dissolve** uses the depth map as a dissolve threshold, creating layer-by-layer disintegration that follows the sprite's 3D structure. Front-to-back dissolution (`if (depth < threshold) discard`) peels away surface layers first, while back-to-front dissolution reveals the sprite's interior. An emissive edge glow at the dissolve boundary (`edgeFactor = 1.0 - smoothstep(0.0, edgeWidth, depth - threshold)`) creates dramatic burn-line effects. Mixing depth with a noise texture breaks up the perfect layer boundaries for more organic results.

---

## Crystal-worthy material effects using normals and depth

**Refraction** makes the crystal golem appear to bend light passing through it. The normal map's XY components offset the UV lookup into a scene texture rendered behind the sprite. **Chromatic aberration** sells the crystal illusion by offsetting R, G, and B channels separately:

```glsl
float r = texture2D(sceneTex, screenUV + normal.xy * strength * 1.00).r;
float g = texture2D(sceneTex, screenUV + normal.xy * strength * 1.02).g;
float b = texture2D(sceneTex, screenUV + normal.xy * strength * 1.04).b;
```

A pre-calculated refraction map (documented by John Bower) bakes ray-traced refraction into a UV-offset texture, eliminating all runtime computation — each pixel's RG channels directly encode where to sample the background.

**Rim lighting** highlights the golem's silhouette edges using a Fresnel-inspired calculation: `rimFactor = pow(1.0 - dot(normal, viewDir), rimPower)`. For 2D sprites, the view direction is always `(0, 0, 1)`, so normals facing perpendicular to the screen produce the strongest rim glow. This creates a glowing edge effect that responds to the normal map's contours.

**Subsurface scattering** approximation makes thin parts of the sprite glow when backlit. The depth map serves as an inverted thickness map — shallow areas allow more light through. The algorithm distorts the light direction by the surface normal, then computes `sss = pow(dot(viewDir, -distortedLight), concentration) * (1.0 - thickness)`. For a crystal golem, this creates an ethereal inner glow where crystals are thinnest.

**Caustic patterns** overlay animated light patterns modulated by depth: two offset caustic texture samples are intersected (`min(caustic1, caustic2)`) to produce realistic water-like light patterns, with deeper parts receiving stronger caustic intensity.

---

## Phaser.js and PixiJS bring these effects to the browser

Phaser 3's **PostFXPipeline** (v3.50+) is the primary mechanism for custom depth map shaders. A pipeline class extends `Phaser.Renderer.WebGL.Pipelines.PostFXPipeline`, declares a fragment shader, and binds the depth map to texture unit 1 via `this.bindTexture(glTexture, 1)`. The pipeline receives the sprite's rendered texture automatically as `uMainSampler` and supports uniforms for mouse position, time, and light coordinates through `set1f`, `set2f`, and `set3f` methods.

Phaser also has **native normal map lighting** through the `Light2D` pipeline. Loading a sprite as an array — `this.load.image('golem', ['golem.png', 'golem_n.png'])` — automatically associates a normal map, and `sprite.setPipeline('Light2D')` activates per-pixel lighting with `this.lights.addLight()`.

PixiJS (which Phaser uses internally) provides a built-in **DisplacementFilter** that accepts a depth map sprite and applies UV displacement — essentially the parallax effect with zero custom shader code. The `@pixi/lights` plugin implements full deferred 2D lighting with normal maps through separate diffuse and normal render layers combined in a lighting pass, supporting unlimited point and directional lights.

For **Canvas 2D fallback**, per-pixel displacement through `getImageData`/`putImageData` is technically possible but prohibitively slow at 60fps for anything beyond tiny sprites. A practical alternative splits the sprite into 3–5 pre-cut depth layers and translates each at different speeds — achieving layered parallax without per-pixel processing.

**Performance priorities** for production use: pack color and depth maps into matching texture atlases to avoid batch breaks; apply PostFX to containers rather than individual sprites to minimize render target switches; depth maps can be lower resolution than color textures since depth data is spatially smooth; use `precision mediump float` for mobile compatibility; and consider rendering depth effects at half resolution with upscaling for significant GPU savings.

---

## AI depth estimation now runs in the browser at interactive speeds

**Depth Anything V2 Small** is the current best choice for browser-based depth map generation from 2D sprites. The Small model (~25M parameters) runs under Apache 2.0 license, ships as an 18–97MB ONNX model, and executes via Transformers.js with WebGPU acceleration in **six lines of code**:

```javascript
import { pipeline } from "@huggingface/transformers";
const estimator = await pipeline("depth-estimation",
  "onnx-community/depth-anything-v2-small", { device: "webgpu" });
const result = await estimator(spriteImage);
```

The akbartus `DepthAnything-on-Browser` GitHub repository provides a complete implementation with 4-bit quantized models (~18MB) and interactive Three.js 3D visualization. Hugging Face hosts a real-time WebGPU demo running Depth Anything V2 on webcam video.

**Marigold** (ETH Zürich, CVPR 2024) produces the finest-detail depth maps by leveraging a fine-tuned Stable Diffusion backbone, making it excellent for stylized art — but it requires full diffusion inference and is impractical for browser use. It's ideal for **offline pre-processing** of sprite depth maps where quality matters most.

All AI models were trained on photographs and interpret visual cues like shading, perspective, and occlusion. On flat-shaded pixel art lacking photographic depth cues, results tend toward blobby approximations. **For pixel art specifically, non-AI silhouette-inflation approaches** — computing a distance transform from the sprite's alpha mask, then Gaussian-blurring the result — produce more controllable depth maps. This is what tools like **Laigter** (free, open-source) and **SpriteIlluminator** use internally. **Sprite Lamp** takes a different approach, generating normal/depth/AO maps from hand-painted lighting profiles of the sprite lit from multiple angles.

---

## Games that prove the technique works

**Octopath Traveler** defined the "HD-2D" style: 2D pixel art sprites in 3D polygon environments with aggressive depth-of-field blur, bloom, and volumetric lighting. The effect was so impactful that Square Enix trademarked "HD-2D" and applied it to *Triangle Strategy*, *Live A Live* remake, and *Dragon Quest III HD-2D Remake*. The *Moo Lander* developers documented their approach to per-sprite DoF using custom render pipelines that write sprite depth to a Z-buffer before applying post-process Gaussian blur. *Hollow Knight* achieves sophisticated depth perception through multi-layer parallax without explicit depth maps. *Limbo* and *Inside* use extreme parallax layers with atmospheric fog increasing by distance — a masterclass in 2D depth through simple layering. **Sprite stacking** — layering horizontal cross-section slices of voxel models — is an emerging technique seen in indie games like *Detective Fantasia*, creating convincing 3D objects from purely 2D sprites.

## Conclusion

The entire depth map effects stack composes naturally in a single rendering pipeline. For a crystal golem boss, the recommended implementation order is: generate a depth map (AI or silhouette-inflation), derive normal maps via Sobel filter at load time, then apply a combined fragment shader that sums parallax displacement, breathing animation, and impact reaction offsets before the final texture sample, followed by Lambertian + specular lighting, self-shadow ray marching, rim lighting, fog mixing, and optional refraction with chromatic aberration. Every effect described here reduces to a fragment shader consuming two textures (color + depth) plus a few uniforms — making the entire system automatable by an AI coding agent that generates GLSL code and Phaser.js pipeline boilerplate from algorithmic descriptions. The deepest creative insight: these effects interact multiplicatively. Fog darkens the golem's recesses while rim lighting brightens its edges. Self-shadows shift as the light moves. Breathing animation displaces the normals, making specular highlights swim across crystal facets. The depth map isn't just one effect — it's the foundation for an entire material system on a flat sprite.