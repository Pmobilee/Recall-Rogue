<script lang="ts">
  /**
   * Tiny moths orbiting the campfire, drawn to the light.
   * Each moth traces an elliptical CSS-animated path around 50%, 58% (just above the fire).
   * Scale variation in the keyframes simulates depth — the moth appears to pass behind
   * and in front of the fire glow. Opacity flutter mimics wings catching firelight.
   */

  interface MothConfig {
    id: number
    /** Campfire center X offset (%), randomized slightly per moth */
    centerX: number
    /** Campfire center Y offset (%), randomized slightly per moth */
    centerY: number
    /** Horizontal orbit radius as % of container width */
    radiusX: number
    /** Vertical orbit radius as % of container height */
    radiusY: number
    /** Orbit animation duration (seconds) */
    orbitDuration: number
    /** Orbit animation delay (seconds) — staggers moths */
    orbitDelay: number
    /** Flutter animation duration (seconds) */
    flutterDuration: number
    /** Flutter animation delay (seconds) */
    flutterDelay: number
    /** Base scale of the moth dot */
    scale: number
    /** Starting phase offset — achieved by rotating the orbit waypoint values */
    phase: number
  }

  /**
   * Pre-compute the four cardinal orbit waypoints for a moth, rotated by `phase` radians.
   * Returns [x0,y0, x1,y1, x2,y2, x3,y3] as CSS translate strings (using %).
   */
  function orbitPoints(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    phase: number
  ): [string, string, string, string, string, string, string, string] {
    const angles = [phase, phase + Math.PI / 2, phase + Math.PI, phase + (3 * Math.PI) / 2]
    return angles.flatMap((a) => [
      `calc(${centerX}% + ${(Math.cos(a) * radiusX).toFixed(2)}vw)`,
      `calc(${centerY}% + ${(Math.sin(a) * radiusY).toFixed(2)}vh)`,
    ]) as [string, string, string, string, string, string, string, string]
  }

  function generateMoths(): MothConfig[] {
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      // Slightly offset each moth's orbit center so they don't overlap perfectly
      centerX: 50 + (Math.random() - 0.5) * 3,
      centerY: 58 + (Math.random() - 0.5) * 3,
      // Orbit radius: 3-8% of container, elliptical (x wider than y)
      radiusX: 3 + Math.random() * 5,
      radiusY: 1.5 + Math.random() * 3,
      orbitDuration: 4 + Math.random() * 4,   // 4–8s
      orbitDelay: i * 0.8 + Math.random() * 0.5, // stagger by ~0.8s each
      flutterDuration: 1.2 + Math.random() * 1.5, // 1.2–2.7s (faster than orbit)
      flutterDelay: Math.random() * 2,
      scale: 0.9 + Math.random() * 0.2,
      phase: (i / 4) * Math.PI * 2,            // evenly distribute around orbit
    }))
  }

  const moths = generateMoths()

  /** Build the inline style block for a moth element. */
  function mothStyle(m: MothConfig): string {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = orbitPoints(
      m.centerX, m.centerY, m.radiusX, m.radiusY, m.phase
    )
    return [
      `--ox0: ${x0}; --oy0: ${y0};`,
      `--ox1: ${x1}; --oy1: ${y1};`,
      `--ox2: ${x2}; --oy2: ${y2};`,
      `--ox3: ${x3}; --oy3: ${y3};`,
      `--ms: ${m.scale};`,
      `animation:`,
      `  moth-orbit ${m.orbitDuration}s linear ${m.orbitDelay}s infinite,`,
      `  moth-flutter ${m.flutterDuration}s ease-in-out ${m.flutterDelay}s infinite;`,
    ].join(' ')
  }
</script>

{#each moths as m (m.id)}
  <div
    class="hub-moth"
    style={mothStyle(m)}
    aria-hidden="true"
  ></div>
{/each}

<style>
  .hub-moth {
    position: absolute;
    /* Tiny elongated dot — warm tan/brown, lit by campfire glow */
    width: calc(3px * var(--layout-scale, 1));
    height: calc(2px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(180, 160, 120, 0.7);
    box-shadow: 0 0 calc(2px * var(--layout-scale, 1)) rgba(255, 200, 100, 0.3);
    /* z-26 matches CampfireCanvas — moths circle among the embers */
    z-index: 26;
    pointer-events: none;
    will-change: transform, opacity;
    /* Start at first waypoint; orbit animation takes over immediately */
    transform: translate(var(--ox0), var(--oy0)) scale(var(--ms));
  }

  @keyframes moth-orbit {
    0%   { transform: translate(var(--ox0), var(--oy0)) scale(var(--ms)); }
    25%  { transform: translate(var(--ox1), var(--oy1)) scale(calc(var(--ms) * 0.8)); }
    50%  { transform: translate(var(--ox2), var(--oy2)) scale(var(--ms)); }
    75%  { transform: translate(var(--ox3), var(--oy3)) scale(calc(var(--ms) * 1.1)); }
    100% { transform: translate(var(--ox0), var(--oy0)) scale(var(--ms)); }
  }

  /* Irregular opacity flicker simulates wings catching and blocking firelight */
  @keyframes moth-flutter {
    0%, 100% { opacity: 0.6; }
    15%      { opacity: 0.8; }
    40%      { opacity: 0.5; }
    65%      { opacity: 0.9; }
    85%      { opacity: 0.55; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hub-moth {
      animation: none;
      opacity: 0.5;
    }
  }
</style>
