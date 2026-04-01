<script lang="ts">
  /**
   * HubCursorLight
   *
   * Renders a warm glowing custom cursor and spawns firefly trail particles
   * that scatter away from the direction of mouse movement.
   *
   * Cursor element: warm orange radial-gradient dot, position: fixed, no pointer-events.
   * Trail particles: yellow firefly sparks that drift away from the movement vector,
   *   animated with CSS @keyframes and CSS custom properties for drift direction.
   *
   * All pixel sizes use calc(Npx * var(--layout-scale, 1)) per project rules.
   * Trail particle viewport coords come from PointerEvent.clientX/Y — no layout-scale
   * needed for their positions (already viewport-absolute), but their SIZE is scaled.
   *
   * Trail behavior:
   *   - Only spawns when cursor moves >= 3px (ignores micro-movements)
   *   - Max 6 particles, 120ms spawn interval (tight cluster feel)
   *   - Distance-based pruning: particles >10% viewport width from current cursor are removed
   *   - Stop cleanup: all particles cleared 500ms after cursor stops moving
   *
   * @module HubCursorLight
   */

  interface TrailParticle {
    id: number
    spawnX: number
    spawnY: number
    driftX: number
    driftY: number
    size: number         // base px before layout-scale
    lifetime: number     // ms
    spawnTime: number    // performance.now() at spawn
  }

  interface Props {
    /** Mouse viewport X position (clientX) */
    x: number
    /** Mouse viewport Y position (clientY) */
    y: number
    /** False when mouse is outside the hub area — hides cursor and stops spawning */
    visible: boolean
  }

  let { x, y, visible }: Props = $props()

  let particles = $state<TrailParticle[]>([])
  let particleIdCounter = 0
  let lastSpawnTime = 0
  const SPAWN_INTERVAL_MS = 120
  const MAX_PARTICLES = 6

  // Plain variables (not $state) — only mutated inside the $effect, never drive template directly
  let prevX = 0
  let prevY = 0
  // Seed with first known position on first run
  let prevInitialized = false

  // Stop-cleanup timer: clears all particles 500ms after cursor stops
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null

  /** Spawn 1–2 firefly trail particles at the current mouse position. */
  function spawnParticles(mx: number, my: number, px: number, py: number): void {
    const count = Math.random() < 0.5 ? 1 : 2
    const newParticles: TrailParticle[] = []

    for (let i = 0; i < count; i++) {
      const vx = mx - px
      const vy = my - py

      // Drift away from movement direction + random ±90° spread
      const angle = Math.atan2(-vy, -vx) + (Math.random() - 0.5) * Math.PI
      // Tight drift: 10–25px max so particles stay close to cursor
      const speed = 10 + Math.random() * 15
      const driftX = Math.cos(angle) * speed
      const driftY = Math.sin(angle) * speed

      newParticles.push({
        id: ++particleIdCounter,
        spawnX: mx,
        spawnY: my,
        driftX,
        driftY,
        size: 2 + Math.random() * 2,       // 2–4 px base
        lifetime: 400 + Math.random() * 400, // 400–800 ms (short-lived for tight cluster feel)
        spawnTime: performance.now(),
      })
    }

    // Merge and trim to max
    particles = [...particles, ...newParticles].slice(-MAX_PARTICLES)
  }

  /**
   * Remove particles that have exceeded their lifetime OR are too far from the current cursor.
   * Distance threshold: 10% of viewport width — keeps trail tight around cursor.
   */
  function pruneExpired(): void {
    const now = performance.now()
    const maxDist = window.innerWidth * 0.10  // 10% of viewport width
    particles = particles.filter(p => {
      if (now - p.spawnTime >= p.lifetime) return false
      // Remove if too far from current cursor position
      const dx = p.spawnX - x
      const dy = p.spawnY - y
      if (Math.sqrt(dx * dx + dy * dy) > maxDist) return false
      return true
    })
  }

  // React to position changes — throttle spawning, track velocity
  $effect(() => {
    const mx = x
    const my = y

    // Initialize prev position on first run so we don't spawn with velocity (0,0) → (mx,my)
    if (!prevInitialized) {
      prevX = mx
      prevY = my
      prevInitialized = true
    }

    if (!visible) {
      prevX = mx
      prevY = my
      return
    }

    // Ignore micro-movements (< 3px) to avoid spawning while cursor is "still"
    const dx = mx - prevX
    const dy = my - prevY
    const moved = Math.sqrt(dx * dx + dy * dy)
    if (moved < 3) return

    const now = performance.now()
    if (now - lastSpawnTime >= SPAWN_INTERVAL_MS) {
      lastSpawnTime = now
      pruneExpired()
      spawnParticles(mx, my, prevX, prevY)
    }

    // Reset the stop-cleanup timer — if cursor stops for 500ms, clear all particles
    if (cleanupTimer) clearTimeout(cleanupTimer)
    cleanupTimer = setTimeout(() => {
      particles = []
    }, 500)

    prevX = mx
    prevY = my
  })
</script>

<!-- Custom warm cursor glow (replaces system cursor in hub) -->
{#if visible}
  <div
    class="hub-cursor-glow"
    style="left: {x}px; top: {y}px;"
    aria-hidden="true"
  ></div>
{/if}

<!-- Firefly trail particles — rendered in viewport space (position: fixed) -->
{#each particles as p (p.id)}
  <div
    class="trail-firefly"
    style="
      left: {p.spawnX}px;
      top: {p.spawnY}px;
      --drift-x: {p.driftX}px;
      --drift-y: {p.driftY}px;
      width: calc({p.size}px * var(--layout-scale, 1));
      height: calc({p.size}px * var(--layout-scale, 1));
      animation: trail-fly {p.lifetime}ms ease-out forwards;
    "
    aria-hidden="true"
  ></div>
{/each}

<style>
  .hub-cursor-glow {
    position: fixed;
    pointer-events: none;
    z-index: 100;
    transform: translate(-50%, -50%);
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(255, 200, 120, 0.9) 0%,
      rgba(255, 160, 60, 0.4) 30%,
      transparent 65%
    );
    box-shadow:
      0 0 calc(20px * var(--layout-scale, 1)) rgba(255, 160, 60, 0.4),
      0 0 calc(40px * var(--layout-scale, 1)) rgba(255, 140, 40, 0.15);
  }

  .trail-firefly {
    position: fixed;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(255, 240, 120, 0.8),
      rgba(255, 200, 50, 0)
    );
    box-shadow: 0 0 calc(4px * var(--layout-scale, 1)) rgba(255, 220, 80, 0.5);
    pointer-events: none;
    z-index: 99;
  }

  @keyframes trail-fly {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.8;
    }
    100% {
      transform: translate(
        calc(-50% + var(--drift-x)),
        calc(-50% + var(--drift-y))
      ) scale(0);
      opacity: 0;
    }
  }

  /* Respect reduced-motion: hide trail, show static cursor only */
  @media (prefers-reduced-motion: reduce) {
    .trail-firefly {
      display: none;
    }
  }
</style>
