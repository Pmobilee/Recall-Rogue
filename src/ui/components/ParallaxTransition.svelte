<script lang="ts">
  interface Props {
    imageUrl: string
    depthUrl: string
    type: 'enter' | 'exit-forward' | 'exit-backward'
    onComplete: () => void
    duration?: number
  }

  const { imageUrl, depthUrl, type, onComplete, duration = 2000 }: Props = $props()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let bobOffset = $state(0)

  const VERT_SRC = /* glsl */ `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      vUv.y = 1.0 - vUv.y;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `

  const FRAG_SRC = /* glsl */ `
    precision mediump float;

    uniform sampler2D uImage;
    uniform sampler2D uDepthMap;
    uniform float uDolly;
    uniform float uZoom;
    uniform float uVignette;
    uniform float uBrightness;
    uniform vec2 uCoverScale;  // aspect-ratio correction for object-fit: cover

    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);

      // Apply object-fit: cover — crop image to fill viewport while preserving aspect ratio
      vec2 coverUv = center + (vUv - center) * uCoverScale;

      // Zoom: crop into the image so edges extend beyond screen
      vec2 zoomed = center + (coverUv - center) / uZoom;

      // Parallax on the zoomed coords: near objects spread outward
      float depth2 = texture2D(uDepthMap, zoomed).r;
      vec2 displaced = zoomed + (zoomed - center) * depth2 * uDolly;

      // GL_CLAMP_TO_EDGE stretches edge pixels naturally when displaced goes OOB
      vec4 color = texture2D(uImage, displaced);

      // Vignette
      vec2 uv = vUv * (1.0 - vUv);
      float vig = uv.x * uv.y * 15.0;
      vig = clamp(pow(vig, uVignette * 0.5 + 0.01), 0.0, 1.0);
      color.rgb *= vig;

      // Brightness
      color.rgb *= uBrightness;

      gl_FragColor = color;
    }
  `

  function compileShader(gl: WebGLRenderingContext, shaderType: number, src: string): WebGLShader {
    const shader = gl.createShader(shaderType)
    if (!shader) throw new Error('Failed to create shader')
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader compile error: ${info}`)
    }
    return shader
  }

  function createProgram(gl: WebGLRenderingContext): WebGLProgram {
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
    const prog = gl.createProgram()
    if (!prog) throw new Error('Failed to create program')
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog)
      throw new Error(`Program link error: ${info}`)
    }
    gl.deleteShader(vert)
    gl.deleteShader(frag)
    return prog
  }

  interface TextureResult {
    tex: WebGLTexture
    width: number
    height: number
  }

  function loadTexture(gl: WebGLRenderingContext, url: string, unit: number): Promise<TextureResult> {
    return new Promise((resolve, reject) => {
      const tex = gl.createTexture()
      if (!tex) return reject(new Error('Failed to create texture'))
      const img = new Image()
      img.onload = () => {
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        resolve({ tex, width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
      img.src = url
    })
  }

  $effect(() => {
    const el = canvas
    if (!el) return

    let rafId = 0
    let gl: WebGLRenderingContext | null = null
    let prog: WebGLProgram | null = null
    let texImage: WebGLTexture | null = null
    let texDepth: WebGLTexture | null = null
    let quadBuf: WebGLBuffer | null = null
    let destroyed = false

    // Cache uniform locations to avoid lookups every frame
    let uLocs: Record<string, WebGLUniformLocation | null> = {}

    function resizeCanvas() {
      if (!el) return
      el.width = window.innerWidth
      el.height = window.innerHeight
      if (gl) gl.viewport(0, 0, el.width, el.height)
    }

    let coverScaleX = 1.0
    let coverScaleY = 1.0

    function render(
      dolly: number,
      zoom: number,
      vignette: number,
      brightness: number
    ) {
      if (!gl || !prog) return
      gl.useProgram(prog)

      gl.uniform1i(uLocs.uImage as WebGLUniformLocation, 0)
      gl.uniform1i(uLocs.uDepthMap as WebGLUniformLocation, 1)
      gl.uniform1f(uLocs.uDolly as WebGLUniformLocation, dolly)
      gl.uniform1f(uLocs.uZoom as WebGLUniformLocation, zoom)
      gl.uniform1f(uLocs.uVignette as WebGLUniformLocation, vignette)
      gl.uniform1f(uLocs.uBrightness as WebGLUniformLocation, brightness)
      gl.uniform2f(uLocs.uCoverScale as WebGLUniformLocation, coverScaleX, coverScaleY)

      const aPos = gl.getAttribLocation(prog, 'aPosition')
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    function animate(startTime: number) {
      return function frame() {
        if (destroyed) return
        const elapsed = performance.now() - startTime
        const t = Math.min(elapsed / duration, 1.0)

        let dolly: number
        let zoom: number
        let vignette: number
        let brightness: number
        let bob: number

        if (type === 'enter') {
          const eased = 1 - Math.pow(1 - t, 2.5)
          dolly = 0.25 * (1 - eased)              // 0.25 → 0
          zoom = 1.1 - eased * 0.1                 // 1.1 → 1.0
          vignette = 0.9 * (1 - eased)             // 0.9 → 0 (must end at exactly 0)
          brightness = t < 0.2 ? t / 0.2 : 1.0     // 0 → 1
          bob = Math.sin(t * Math.PI * 2 * 8) * 8 * (1 - eased)  // 8 half-cycles = 4 footsteps
        } else if (type === 'exit-forward') {
          // Combat exit: aggressive push through the room
          const eased = Math.pow(t, 2.0)
          dolly = eased * 0.5                      // 0 → 0.5
          zoom = 1.0 + eased * 1.0                 // 1.0 → 2.0
          vignette = 0.1 + eased * 0.9
          brightness = t > 0.7 ? 1 - Math.pow((t - 0.7) / 0.3, 2) : 1.0
          bob = Math.sin(t * Math.PI * 2 * 8) * 12 * eased
        } else {
          // exit-backward: walk forward through the room, gentler
          const eased = Math.pow(t, 2.0)
          dolly = eased * 0.4                      // 0 → 0.4
          zoom = 1.0 + eased * 0.8                 // 1.0 → 1.8
          vignette = 0.1 + eased * 0.9
          brightness = t > 0.7 ? 1 - Math.pow((t - 0.7) / 0.3, 2) : 1.0
          bob = Math.sin(t * Math.PI * 2 * 8) * 10 * Math.min(eased * 3, 1)
        }

        // Walking bob applied as CSS transform (no shader warping)
        bobOffset = bob
        render(dolly, zoom, vignette, brightness)

        if (t < 1.0) {
          rafId = requestAnimationFrame(frame)
        } else {
          if (!destroyed) onComplete()
        }
      }
    }

    function skip() {
      destroyed = true
      cancelAnimationFrame(rafId)
      onComplete()
    }

    el.addEventListener('click', skip)
    window.addEventListener('resize', resizeCanvas)

    ;(async () => {
      try {
        const ctx = el.getContext('webgl')
        if (!ctx) throw new Error('WebGL not available')
        gl = ctx

        el.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          if (!destroyed) {
            destroyed = true
            cancelAnimationFrame(rafId)
            onComplete()
          }
        })

        resizeCanvas()
        prog = createProgram(gl)

        // Cache uniform locations
        for (const name of ['uImage', 'uDepthMap', 'uDolly', 'uZoom', 'uVignette', 'uBrightness', 'uCoverScale']) {
          uLocs[name] = gl.getUniformLocation(prog, name)
        }

        const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
        quadBuf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW)

        const [imgResult, depthResult] = await Promise.all([
          loadTexture(gl, imageUrl, 0),
          loadTexture(gl, depthUrl, 1),
        ])
        texImage = imgResult.tex
        texDepth = depthResult.tex

        // Compute object-fit: cover scale to match how CSS renders the background
        const imgAspect = imgResult.width / imgResult.height
        const vpAspect = window.innerWidth / window.innerHeight
        if (vpAspect > imgAspect) {
          // Viewport is wider than image — image is cropped top/bottom
          coverScaleX = 1.0
          coverScaleY = vpAspect / imgAspect
        } else {
          // Viewport is taller than image — image is cropped left/right
          coverScaleX = imgAspect / vpAspect
          coverScaleY = 1.0
        }

        if (destroyed) return

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texImage)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, texDepth)

        const startTime = performance.now()
        rafId = requestAnimationFrame(animate(startTime))
      } catch (err) {
        console.error('[ParallaxTransition] WebGL init failed:', err)
        if (!destroyed) {
          destroyed = true
          onComplete()
        }
      }
    })()

    return () => {
      destroyed = true
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resizeCanvas)
      el.removeEventListener('click', skip)

      if (gl) {
        if (prog) gl.deleteProgram(prog)
        if (texImage) gl.deleteTexture(texImage)
        if (texDepth) gl.deleteTexture(texDepth)
        if (quadBuf) gl.deleteBuffer(quadBuf)
      }
    }
  })
</script>

<div class="parallax-transition-overlay">
  <canvas
    bind:this={canvas}
    class="parallax-canvas"
    style="transform: translateY({bobOffset}px)"
  ></canvas>
  <span class="parallax-label">Click to skip</span>
</div>

<style>
  .parallax-transition-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #000;
    cursor: pointer;
  }

  .parallax-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .parallax-label {
    position: absolute;
    bottom: calc(20px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    font-size: calc(12px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.4);
    pointer-events: none;
    user-select: none;
  }
</style>
