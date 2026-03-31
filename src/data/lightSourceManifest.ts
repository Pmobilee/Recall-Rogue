/**
 * Light source manifest for depth-based lighting.
 * Maps background IDs to their specific light source positions, colors, and types.
 * Used by DepthLightingSystem to configure per-background point lights.
 */

/** Visual type of a light source — governs default flicker behavior. */
export type LightSourceType =
  | 'torch'          // Wall-mounted flame — warm, moderate flicker
  | 'campfire'       // Ground-level large warm glow — slow flicker
  | 'lantern'        // Hanging/mounted lantern — warm, minimal flicker
  | 'crystal'        // Glowing crystal — colored, pulsing
  | 'bioluminescent' // Organic glow — slow pulse
  | 'magical'        // High-intensity magical — shimmer
  | 'lava'           // Ground-level embers/lava — warm underglow, heavy flicker
  | 'ambient'        // Diffuse overhead — no flicker
  | 'portal'         // Magical portal — intense, pulsing
  | 'candle'         // Small flame — fast flicker, small radius

/** A single point light source on a background image. */
export interface BackgroundLightSource {
  /** Horizontal position as fraction of image width (0.0 = left, 1.0 = right). */
  x: number
  /** Vertical position as fraction of image height (0.0 = top, 1.0 = bottom). */
  y: number
  /** Depth value at this light's position (0.0 = far wall, 1.0 = near camera). */
  z: number
  /** Light radius in normalized units (fraction of image diagonal). */
  radius: number
  /** Light color as hex number. */
  color: number
  /** Intensity multiplier (0.0-3.0). */
  intensity: number
  /** Visual type — drives default flicker params. */
  type: LightSourceType
  /** Optional flicker override. strength = amplitude (0-1), speed = oscillations/sec. */
  flickerOverride?: { strength: number; speed: number }
}

/** Light config for one orientation of a background. */
export interface BackgroundLightConfig {
  /** Point light sources visible in this background. */
  lights: BackgroundLightSource[]
  /** Override theme ambient when set (0.0-1.0). */
  ambientOverride?: number
}

/** Per-orientation light configs. */
export interface OrientedLightConfig {
  portrait: BackgroundLightConfig
  landscape: BackgroundLightConfig
}

/** Default flicker parameters by light type. */
export const DEFAULT_FLICKER: Record<LightSourceType, { strength: number; speed: number }> = {
  torch:          { strength: 0.15, speed: 3.0 },
  campfire:       { strength: 0.12, speed: 1.5 },
  lantern:        { strength: 0.05, speed: 2.0 },
  crystal:        { strength: 0.08, speed: 0.8 },
  bioluminescent: { strength: 0.06, speed: 0.4 },
  magical:        { strength: 0.10, speed: 1.2 },
  lava:           { strength: 0.20, speed: 2.5 },
  ambient:        { strength: 0.00, speed: 0.0 },
  portal:         { strength: 0.12, speed: 1.0 },
  candle:         { strength: 0.25, speed: 5.0 },
}

/** Top-level manifest keyed by category and ID. */
export interface LightSourceManifest {
  enemies: Record<string, OrientedLightConfig>
  rooms: Record<string, OrientedLightConfig>
  mystery: Record<string, OrientedLightConfig>
}

/**
 * Master light source manifest.
 * Start with key backgrounds; remaining entries will be added incrementally.
 */
export const LIGHT_SOURCE_MANIFEST: LightSourceManifest = {
  enemies: {
    // ── Page Flutter — dark library corridor, bookshelves, scattered papers ──
    page_flutter: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Faint ambient glow from the archway
          { x: 0.50, y: 0.35, z: 0.1, radius: 0.20, color: 0x886655, intensity: 0.8, type: 'ambient' },
        ],
        ambientOverride: 0.15,
      },
    },

    // ── Final Lesson — grand hall with stained glass, candelabras ──
    final_lesson: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.50, y: 0.10, z: 0.2, radius: 0.25, color: 0xffddaa, intensity: 1.5, type: 'ambient' },
          { x: 0.20, y: 0.30, z: 0.3, radius: 0.10, color: 0xff9944, intensity: 1.2, type: 'candle' },
          { x: 0.80, y: 0.30, z: 0.3, radius: 0.10, color: 0xff9944, intensity: 1.2, type: 'candle' },
          { x: 0.35, y: 0.25, z: 0.3, radius: 0.08, color: 0xffaa55, intensity: 1.0, type: 'candle' },
          { x: 0.65, y: 0.25, z: 0.3, radius: 0.08, color: 0xffaa55, intensity: 1.0, type: 'candle' },
        ],
      },
    },

    // ── Algorithm — tech dungeon with glowing green screens ──
    algorithm: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.50, y: 0.20, z: 0.3, radius: 0.20, color: 0x44ff88, intensity: 1.3, type: 'magical' },
          { x: 0.85, y: 0.35, z: 0.5, radius: 0.12, color: 0xffaa33, intensity: 1.0, type: 'lantern' },
          { x: 0.15, y: 0.40, z: 0.5, radius: 0.10, color: 0x44ff88, intensity: 0.8, type: 'crystal' },
        ],
      },
    },

    // ── Peer Reviewer — warm study with arch, scales, hanging chains ──
    peer_reviewer: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.50, y: 0.15, z: 0.2, radius: 0.22, color: 0xffcc88, intensity: 1.4, type: 'ambient' },
          { x: 0.15, y: 0.30, z: 0.4, radius: 0.10, color: 0xff8833, intensity: 1.2, type: 'torch' },
          { x: 0.85, y: 0.30, z: 0.4, radius: 0.10, color: 0xff8833, intensity: 1.2, type: 'torch' },
        ],
      },
    },

    // ── Ember Skeleton — dark cavern with wall sconces and lava cracks ──
    ember_skeleton: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.10, y: 0.25, z: 0.3, radius: 0.12, color: 0xff8833, intensity: 1.8, type: 'torch' },
          { x: 0.90, y: 0.25, z: 0.3, radius: 0.12, color: 0xff8833, intensity: 1.8, type: 'torch' },
          { x: 0.50, y: 0.80, z: 0.7, radius: 0.15, color: 0xff4400, intensity: 1.2, type: 'lava' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Bright Idea — crystal/jellyfish bioluminescent lab ──
    // DENSE light sources: pink crystal cluster L, blue crystals L, desk orbs,
    // ceiling jellyfish (orange + cyan groups), hanging purple crystal,
    // right wall upper jellyfish (orange), right wall lower jellyfish (blue).
    bright_idea: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left: pink/magenta crystal cluster — wide, gentle glow
          { x: 0.07, y: 0.30, z: 0.7, radius: 0.28, color: 0xdd44ff, intensity: 1.4, type: 'crystal' },
          // Left: blue crystal cluster
          { x: 0.16, y: 0.42, z: 0.6, radius: 0.22, color: 0x44ccff, intensity: 1.2, type: 'crystal' },
          // Desk area: green/teal orbs
          { x: 0.23, y: 0.60, z: 0.7, radius: 0.18, color: 0x44ffaa, intensity: 1.0, type: 'bioluminescent' },
          // Ceiling: left jellyfish (orange/warm) — wide spread
          { x: 0.32, y: 0.06, z: 0.3, radius: 0.28, color: 0xff9944, intensity: 1.4, type: 'bioluminescent' },
          // Ceiling: center-right jellyfish (cyan)
          { x: 0.55, y: 0.06, z: 0.3, radius: 0.28, color: 0x44ddff, intensity: 1.3, type: 'bioluminescent' },
          // Hanging purple crystal
          { x: 0.36, y: 0.22, z: 0.4, radius: 0.16, color: 0xaa55ee, intensity: 1.0, type: 'crystal' },
          // Right wall: upper jellyfish (warm orange)
          { x: 0.82, y: 0.16, z: 0.5, radius: 0.26, color: 0xff8844, intensity: 1.4, type: 'bioluminescent' },
          // Right wall: lower jellyfish (blue/cyan)
          { x: 0.78, y: 0.48, z: 0.5, radius: 0.24, color: 0x44aacc, intensity: 1.3, type: 'bioluminescent' },
        ],
        ambientOverride: 0.45,
      },
    },

    // ── Burning Deadline — clock/hourglass room with lava cracks + torch ──
    burning_deadline: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Small wall torch — upper left near bulletin board
          { x: 0.14, y: 0.18, z: 0.4, radius: 0.18, color: 0xff8833, intensity: 1.2, type: 'torch' },
          // Burning calendar pages — small fires mid-left
          { x: 0.32, y: 0.18, z: 0.4, radius: 0.15, color: 0xff9944, intensity: 0.8, type: 'candle' },
          // Lava cracks — floor left
          { x: 0.30, y: 0.82, z: 0.7, radius: 0.25, color: 0xff3300, intensity: 1.3, type: 'lava' },
          // Lava cracks — floor center, wide wash
          { x: 0.50, y: 0.85, z: 0.7, radius: 0.30, color: 0xff4400, intensity: 1.2, type: 'lava' },
          // Lava cracks — floor right
          { x: 0.70, y: 0.82, z: 0.7, radius: 0.25, color: 0xff3300, intensity: 1.3, type: 'lava' },
          // Right wall lava veins — glowing cracks in stone
          { x: 0.92, y: 0.35, z: 0.5, radius: 0.20, color: 0xff2200, intensity: 1.2, type: 'lava' },
          // Thermometer red glow — faint center
          { x: 0.58, y: 0.32, z: 0.3, radius: 0.15, color: 0xff4444, intensity: 0.7, type: 'magical' },
        ],
      },
    },

    // ── Eureka — bath scene with bright central light ──
    eureka: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.55, y: 0.35, z: 0.3, radius: 0.20, color: 0xffffff, intensity: 2.0, type: 'magical' },
          { x: 0.50, y: 0.75, z: 0.6, radius: 0.12, color: 0xff6600, intensity: 1.0, type: 'lava' },
        ],
      },
    },

    // ── Librarian — dusty grey library, desk lamp on floor bottom-right ──
    librarian: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.72, y: 0.70, z: 0.7, radius: 0.14, color: 0xffdd88, intensity: 1.8, type: 'lantern' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Ivory Tower — grand library with golden vaulted ceiling ──
    ivory_tower: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.50, y: 0.10, z: 0.1, radius: 0.30, color: 0xffddaa, intensity: 1.8, type: 'ambient' },
          { x: 0.30, y: 0.20, z: 0.2, radius: 0.12, color: 0xffcc88, intensity: 1.0, type: 'lantern' },
          { x: 0.70, y: 0.20, z: 0.2, radius: 0.12, color: 0xffcc88, intensity: 1.0, type: 'lantern' },
        ],
      },
    },

    // ── Bookwyrm — very dark abandoned tunnel ──
    bookwyrm: {
      portrait: { lights: [], ambientOverride: 0.05 },
      landscape: { lights: [], ambientOverride: 0.05 },
    },

    // ── All Nighter — late-night frozen study chamber with icicle crystals and moonlit window ──
    all_nighter: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left-edge white crystal cluster glowing cold blue-white
          { x: 0.03, y: 0.45, z: 0.7, radius: 0.22, color: 0xaaddff, intensity: 1.4, type: 'crystal' },
          // Right wall moonlit window — cold blue ambient spill
          { x: 0.82, y: 0.30, z: 0.3, radius: 0.28, color: 0x99bbee, intensity: 1.2, type: 'ambient' },
          // Scattered small crystal fragments on floor left
          { x: 0.12, y: 0.72, z: 0.8, radius: 0.18, color: 0xbbddff, intensity: 1.0, type: 'crystal' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Ancient Tongue — rune-carved stone hall with glowing tuning-fork ceiling ornaments ──
    ancient_tongue: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left ceiling cluster of glowing blue tuning forks
          { x: 0.28, y: 0.08, z: 0.2, radius: 0.22, color: 0x88aacc, intensity: 1.2, type: 'magical' },
          // Right ceiling cluster of tuning forks
          { x: 0.68, y: 0.08, z: 0.2, radius: 0.22, color: 0x88aacc, intensity: 1.2, type: 'magical' },
          // Right side desk — small glowing blue crystal/pen objects
          { x: 0.62, y: 0.52, z: 0.5, radius: 0.18, color: 0x6699bb, intensity: 1.1, type: 'crystal' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Anxiety Tick — cobwebbed chamber with candles, lantern, and hanging egg-sac orbs ──
    anxiety_tick: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Right wall lantern — warm amber
          { x: 0.82, y: 0.28, z: 0.3, radius: 0.22, color: 0xffcc66, intensity: 1.4, type: 'lantern' },
          // Right shelf candles cluster
          { x: 0.76, y: 0.48, z: 0.4, radius: 0.20, color: 0xff9944, intensity: 1.3, type: 'candle' },
          // Hanging ceiling orbs — faint bioluminescent glow, center-left
          { x: 0.35, y: 0.18, z: 0.3, radius: 0.25, color: 0xddccaa, intensity: 0.9, type: 'bioluminescent' },
        ],
      },
    },

    // ── Blank Spot — almost entirely dark room, empty shelves, near-void ──
    blank_spot: {
      portrait: { lights: [] },
      landscape: {
        lights: [],
        ambientOverride: 0.05,
      },
    },

    // ── Bookmark Vine — overgrown forest tunnel, bioluminescent mushrooms and daylight above ──
    bookmark_vine: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Diffuse overhead daylight filtering through vines
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.40, color: 0xeeffcc, intensity: 1.1, type: 'ambient' },
          // Glowing mushrooms at floor left
          { x: 0.22, y: 0.78, z: 0.8, radius: 0.18, color: 0xaaee88, intensity: 1.2, type: 'bioluminescent' },
          // Small bioluminescent flowers on right vine wall
          { x: 0.78, y: 0.55, z: 0.5, radius: 0.20, color: 0x88ffaa, intensity: 1.0, type: 'bioluminescent' },
        ],
      },
    },

    // ── Brain Fog — misty grey dungeon with glowing white ghost wisps ──
    brain_fog: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Ghost wisp cluster right-center — cold white glow
          { x: 0.72, y: 0.42, z: 0.5, radius: 0.28, color: 0xddeeff, intensity: 1.4, type: 'magical' },
          // Smaller wisp lower right
          { x: 0.80, y: 0.60, z: 0.6, radius: 0.20, color: 0xccddff, intensity: 1.1, type: 'magical' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Burnout — scorched stone hall with chandeliers and warm amber wall sconces ──
    burnout: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left chandelier — warm amber overhead
          { x: 0.22, y: 0.10, z: 0.2, radius: 0.28, color: 0xffaa44, intensity: 1.4, type: 'lantern' },
          // Right wall sconce pair
          { x: 0.80, y: 0.22, z: 0.3, radius: 0.24, color: 0xff9933, intensity: 1.3, type: 'torch' },
          // Candle wax / desk candle left foreground
          { x: 0.25, y: 0.55, z: 0.7, radius: 0.20, color: 0xffbb55, intensity: 1.2, type: 'candle' },
        ],
        ambientOverride: 0.30,
      },
    },

    // ── Burnout Phantom — dark portrait gallery, candles on right desk and shelves ──
    burnout_phantom: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Right side shelf/desk candles — warm cluster
          { x: 0.72, y: 0.52, z: 0.5, radius: 0.22, color: 0xff9944, intensity: 1.4, type: 'candle' },
          // Small candle lower right floor
          { x: 0.82, y: 0.72, z: 0.7, radius: 0.16, color: 0xffaa55, intensity: 1.2, type: 'candle' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Card Catalogue — library of wooden drawers with creeping vines, dim even light ──
    card_catalogue: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Faint overhead ambient — the room has even dim natural light
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.45, color: 0xddccaa, intensity: 0.9, type: 'ambient' },
        ],
        ambientOverride: 0.15,
      },
    },

    // ── Citation Needed — dark dungeon with glowing cyan mushrooms and bioluminescent orbs on right desk ──
    citation_needed: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Cyan/teal bioluminescent mushroom cluster on right desk
          { x: 0.68, y: 0.48, z: 0.5, radius: 0.22, color: 0x44ddcc, intensity: 1.6, type: 'bioluminescent' },
          // Teal glowing orbs above the desk
          { x: 0.62, y: 0.32, z: 0.4, radius: 0.20, color: 0x44ffcc, intensity: 1.4, type: 'bioluminescent' },
          // Small floor mushroom glow, right foreground
          { x: 0.74, y: 0.72, z: 0.8, radius: 0.16, color: 0x55ddbb, intensity: 1.1, type: 'bioluminescent' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Comparison Trap — dark trophy/display room, faint lit frames on walls ──
    comparison_trap: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left wall illuminated display panels — cool overhead light
          { x: 0.18, y: 0.35, z: 0.3, radius: 0.26, color: 0xbbccdd, intensity: 1.1, type: 'ambient' },
          // Right wall display — faint warm glow from frames
          { x: 0.78, y: 0.40, z: 0.3, radius: 0.24, color: 0xddccbb, intensity: 1.0, type: 'ambient' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Crambot — dark room with glowing slot machine display on left ──
    crambot: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Slot machine screen glow — cold blue-white
          { x: 0.22, y: 0.42, z: 0.5, radius: 0.24, color: 0x88aaff, intensity: 1.6, type: 'magical' },
          // Secondary screen reflection spill on floor
          { x: 0.22, y: 0.68, z: 0.7, radius: 0.18, color: 0x6688ee, intensity: 1.0, type: 'magical' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Crib Sheet — very dark room, sparse furniture, almost no light ──
    crib_sheet: {
      portrait: { lights: [] },
      landscape: {
        lights: [],
        ambientOverride: 0.06,
      },
    },

    // ── Curriculum — blue crystal classroom with glowing stalactites and illuminated wall panels ──
    curriculum: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left ceiling crystal stalactite cluster
          { x: 0.22, y: 0.08, z: 0.2, radius: 0.32, color: 0x88ccff, intensity: 1.6, type: 'crystal' },
          // Central ceiling crystal cluster
          { x: 0.50, y: 0.06, z: 0.2, radius: 0.35, color: 0xaaddff, intensity: 1.8, type: 'crystal' },
          // Right ceiling crystal cluster
          { x: 0.78, y: 0.08, z: 0.2, radius: 0.30, color: 0x88ccff, intensity: 1.6, type: 'crystal' },
          // Left glowing wall panel — arcane text display
          { x: 0.08, y: 0.35, z: 0.3, radius: 0.24, color: 0x99ccff, intensity: 1.3, type: 'magical' },
          // Right glowing wall panel
          { x: 0.92, y: 0.35, z: 0.3, radius: 0.24, color: 0x99ccff, intensity: 1.3, type: 'magical' },
        ],
        ambientOverride: 0.45,
      },
    },

    // ── Deadline Serpent — dark hall with dramatic floor-to-ceiling lava rift on right wall ──
    deadline_serpent: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Main lava rift — intense orange-red vertical glow on right
          { x: 0.82, y: 0.45, z: 0.4, radius: 0.32, color: 0xff5500, intensity: 2.2, type: 'lava' },
          // Lava light spilling onto floor right
          { x: 0.75, y: 0.78, z: 0.8, radius: 0.28, color: 0xff6600, intensity: 1.6, type: 'lava' },
          // Warm chandelier above center — secondary light
          { x: 0.45, y: 0.12, z: 0.2, radius: 0.24, color: 0xffaa44, intensity: 1.2, type: 'lantern' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Dean — dark industrial/bureaucratic room, steam pipes, no strong light sources ──
    dean: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Faint overhead ambient — dim industrial light
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.40, color: 0xddccaa, intensity: 0.8, type: 'ambient' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Devils Advocate — stone hall with papers and scales, fairly bright diffuse light ──
    devils_advocate: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Overhead diffuse ambient light — bright stone hall
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.50, color: 0xeeddcc, intensity: 1.0, type: 'ambient' },
        ],
        ambientOverride: 0.30,
      },
    },

    // ── Dissertation — very dark archive with single desk lamp on right ──
    dissertation: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Single desk lamp right side — warm focused glow
          { x: 0.72, y: 0.52, z: 0.5, radius: 0.22, color: 0xffcc88, intensity: 1.6, type: 'lantern' },
        ],
        ambientOverride: 0.06,
      },
    },

    // ── Dropout — stone room with two wall torches flanking the arch doorway ──
    dropout: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left wall torch beside arch
          { x: 0.35, y: 0.38, z: 0.4, radius: 0.22, color: 0xff8833, intensity: 1.6, type: 'torch' },
          // Right wall torch beside arch
          { x: 0.65, y: 0.38, z: 0.4, radius: 0.22, color: 0xff8833, intensity: 1.6, type: 'torch' },
        ],
        ambientOverride: 0.15,
      },
    },

    // ── Dunning Kruger — split room: ornate gold trophy hall left, plain grey study right, candle on desk ──
    dunning_kruger: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left side — warm golden light from ornate trophies and gold decor
          { x: 0.15, y: 0.30, z: 0.3, radius: 0.35, color: 0xffcc44, intensity: 1.5, type: 'magical' },
          // Gold ornament ceiling light — warm overhead left
          { x: 0.18, y: 0.08, z: 0.2, radius: 0.28, color: 0xffdd66, intensity: 1.3, type: 'ambient' },
          // Right desk candle — small warm glow
          { x: 0.76, y: 0.58, z: 0.6, radius: 0.18, color: 0xff9944, intensity: 1.2, type: 'candle' },
        ],
        ambientOverride: 0.18,
      },
    },

    // ── Echo Chamber — crystal cavern with pale white/lavender stalactite crystals ──
    echo_chamber: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left ceiling crystal cluster — white-lavender glow
          { x: 0.20, y: 0.10, z: 0.2, radius: 0.28, color: 0xddccff, intensity: 1.3, type: 'crystal' },
          // Center ceiling crystal cluster
          { x: 0.50, y: 0.08, z: 0.2, radius: 0.30, color: 0xeeddff, intensity: 1.4, type: 'crystal' },
          // Right ceiling crystal cluster
          { x: 0.80, y: 0.10, z: 0.2, radius: 0.26, color: 0xddccff, intensity: 1.2, type: 'crystal' },
          // Floor crystal cluster center
          { x: 0.50, y: 0.72, z: 0.8, radius: 0.20, color: 0xccbbee, intensity: 1.1, type: 'crystal' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Emeritus — crystal shop/cave with large amethyst geode left, glowing crown on desk, scattered clear crystals ──
    emeritus: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Large amethyst geode — deep purple glow on left
          { x: 0.10, y: 0.52, z: 0.5, radius: 0.30, color: 0xcc44ff, intensity: 1.6, type: 'crystal' },
          // Glowing crown on desk center — warm golden magical light
          { x: 0.46, y: 0.45, z: 0.5, radius: 0.20, color: 0xffcc44, intensity: 1.5, type: 'magical' },
          // Right side crystal cluster scattered
          { x: 0.78, y: 0.60, z: 0.6, radius: 0.24, color: 0xaaddff, intensity: 1.2, type: 'crystal' },
          // Left crystal wall shelf glow
          { x: 0.12, y: 0.28, z: 0.3, radius: 0.22, color: 0xbb88ff, intensity: 1.1, type: 'crystal' },
        ],
        ambientOverride: 0.15,
      },
    },

    // ── Eraser Worm — archaeology room with bright overhead skylights, pink eraser dust ──
    eraser_worm: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Overhead skylight panel — bright diffuse cool light, left
          { x: 0.20, y: 0.04, z: 0.2, radius: 0.30, color: 0xddeeff, intensity: 1.3, type: 'ambient' },
          // Overhead skylight panel — right
          { x: 0.70, y: 0.04, z: 0.2, radius: 0.30, color: 0xddeeff, intensity: 1.3, type: 'ambient' },
        ],
        ambientOverride: 0.35,
      },
    },

    // ── Fake News — library with open books, diploma walls, fairly bright overhead lit room ──
    fake_news: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Bright overhead ambient — well-lit library
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.50, color: 0xeeddcc, intensity: 1.1, type: 'ambient' },
        ],
        ambientOverride: 0.35,
      },
    },

    // ── Final Exam — dark mine shaft with industrial machinery, railroad tracks, near-dark ──
    final_exam: {
      portrait: { lights: [] },
      landscape: {
        lights: [],
        ambientOverride: 0.07,
      },
    },

    // ── First Question — ancient rune cave with small glowing waterfall/pool on right, icicles ──
    first_question: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Glowing blue-white waterfall/pool on right wall
          { x: 0.82, y: 0.58, z: 0.5, radius: 0.24, color: 0x88ddff, intensity: 1.5, type: 'magical' },
          // Water pool glow on floor
          { x: 0.82, y: 0.75, z: 0.7, radius: 0.20, color: 0x66ccee, intensity: 1.2, type: 'magical' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Grade Curve — dark crystal cave with purple amethyst formations ──
    grade_curve: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Large crystal cluster left foreground
          { x: 0.08, y: 0.60, z: 0.7, radius: 0.28, color: 0xaa44ff, intensity: 2.2, type: 'crystal' },
          // Crystal cluster left mid-wall
          { x: 0.15, y: 0.45, z: 0.5, radius: 0.22, color: 0x9933ee, intensity: 1.8, type: 'crystal' },
          // Hanging crystal stalactites center-top
          { x: 0.50, y: 0.15, z: 0.3, radius: 0.25, color: 0xbb55ff, intensity: 1.6, type: 'crystal' },
          // Crystal cluster right mid-wall
          { x: 0.82, y: 0.40, z: 0.5, radius: 0.22, color: 0x9933ee, intensity: 1.8, type: 'crystal' },
          // Crystal cluster right foreground
          { x: 0.92, y: 0.58, z: 0.7, radius: 0.26, color: 0xaa44ff, intensity: 2.0, type: 'crystal' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Grade Dragon — torchlit dungeon office with fire embers scattered ──
    grade_dragon: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Wall torch left side
          { x: 0.22, y: 0.28, z: 0.3, radius: 0.22, color: 0xff8833, intensity: 2.2, type: 'torch' },
          // Wall torch right side
          { x: 0.72, y: 0.28, z: 0.3, radius: 0.22, color: 0xff8833, intensity: 2.2, type: 'torch' },
          // Ember fire on floor center-left
          { x: 0.38, y: 0.80, z: 0.8, radius: 0.18, color: 0xff6600, intensity: 1.6, type: 'campfire' },
          // Scattered embers floor right
          { x: 0.60, y: 0.82, z: 0.8, radius: 0.16, color: 0xff5500, intensity: 1.4, type: 'campfire' },
        ],
      },
    },

    // ── Group Project — cluttered workshop with colored crystals on tables ──
    group_project: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Blue crystal cluster center-left table
          { x: 0.35, y: 0.55, z: 0.6, radius: 0.20, color: 0x44aaff, intensity: 1.8, type: 'crystal' },
          // Red crystal on left table
          { x: 0.25, y: 0.58, z: 0.6, radius: 0.16, color: 0xff3344, intensity: 1.6, type: 'crystal' },
          // Blue crystal hanging top center
          { x: 0.48, y: 0.12, z: 0.2, radius: 0.18, color: 0x44ccff, intensity: 1.5, type: 'crystal' },
          // Red crystal top-right hanging
          { x: 0.65, y: 0.10, z: 0.2, radius: 0.16, color: 0xff4455, intensity: 1.4, type: 'crystal' },
          // Glowing lamp right table
          { x: 0.72, y: 0.52, z: 0.6, radius: 0.20, color: 0xffcc66, intensity: 1.6, type: 'lantern' },
          // Purple crystal left shelf
          { x: 0.10, y: 0.40, z: 0.4, radius: 0.16, color: 0xcc44ff, intensity: 1.5, type: 'crystal' },
        ],
      },
    },

    // ── Gut Feeling — rune-covered dungeon with bioluminescent blue vines on right wall ──
    gut_feeling: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Bioluminescent blue veins upper cluster
          { x: 0.82, y: 0.30, z: 0.3, radius: 0.24, color: 0x22ddcc, intensity: 2.0, type: 'bioluminescent' },
          // Bioluminescent veins lower cluster
          { x: 0.88, y: 0.60, z: 0.5, radius: 0.22, color: 0x22ddcc, intensity: 1.8, type: 'bioluminescent' },
          // Blue glow from hanging sacks
          { x: 0.78, y: 0.18, z: 0.3, radius: 0.18, color: 0x44eedd, intensity: 1.5, type: 'bioluminescent' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Harsh Grader — lab with yellow crystals and colored potion bottles ──
    harsh_grader: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Yellow crystal cluster center floor
          { x: 0.52, y: 0.72, z: 0.7, radius: 0.22, color: 0xffee22, intensity: 2.0, type: 'crystal' },
          // Large yellow crystal right foreground
          { x: 0.82, y: 0.55, z: 0.6, radius: 0.26, color: 0xffdd00, intensity: 2.2, type: 'crystal' },
          // Small yellow crystal bottom-left
          { x: 0.08, y: 0.88, z: 0.8, radius: 0.16, color: 0xffee22, intensity: 1.5, type: 'crystal' },
          // Colored potions green glow
          { x: 0.48, y: 0.38, z: 0.3, radius: 0.18, color: 0x88ff44, intensity: 1.4, type: 'magical' },
        ],
      },
    },

    // ── Headmistress — dim grey office with barred windows ──
    headmistress: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Barred window left cold grey light
          { x: 0.12, y: 0.28, z: 0.2, radius: 0.22, color: 0xccddff, intensity: 1.4, type: 'ambient' },
          // Barred window right cold light
          { x: 0.88, y: 0.28, z: 0.2, radius: 0.22, color: 0xccddff, intensity: 1.4, type: 'ambient' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Helicopter Parent — supply room with lava pit behind barricade ──
    helicopter_parent: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Lava pit right side warm underglow
          { x: 0.80, y: 0.72, z: 0.7, radius: 0.28, color: 0xff5500, intensity: 2.4, type: 'lava' },
          // Lava glow on right floor
          { x: 0.70, y: 0.85, z: 0.8, radius: 0.22, color: 0xff6600, intensity: 1.8, type: 'lava' },
          // Screen/monitor green glow left wall
          { x: 0.08, y: 0.35, z: 0.3, radius: 0.18, color: 0x44ff66, intensity: 1.4, type: 'magical' },
        ],
      },
    },

    // ── Hidden Gem — crystal-studded cave with treasure chest and geodes ──
    hidden_gem: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Purple geode left foreground
          { x: 0.22, y: 0.62, z: 0.7, radius: 0.26, color: 0xaa44ff, intensity: 2.2, type: 'crystal' },
          // Teal crystal top-left
          { x: 0.05, y: 0.22, z: 0.2, radius: 0.20, color: 0x33ddaa, intensity: 1.6, type: 'crystal' },
          // Teal crystals top-right
          { x: 0.90, y: 0.20, z: 0.2, radius: 0.20, color: 0x33ddaa, intensity: 1.6, type: 'crystal' },
          // Gold glow from treasure chest
          { x: 0.72, y: 0.65, z: 0.6, radius: 0.20, color: 0xffcc44, intensity: 1.8, type: 'magical' },
          // Mixed crystal right wall
          { x: 0.88, y: 0.42, z: 0.4, radius: 0.22, color: 0xcc44ff, intensity: 1.7, type: 'crystal' },
          // Teal floor crystals bottom center
          { x: 0.50, y: 0.90, z: 0.8, radius: 0.20, color: 0x22ccaa, intensity: 1.5, type: 'crystal' },
        ],
      },
    },

    // ── Hydra Problem — pale purple crystal cave with bare winter trees ──
    hydra_problem: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Pale lavender crystal left foreground
          { x: 0.10, y: 0.65, z: 0.7, radius: 0.24, color: 0xddaaff, intensity: 1.8, type: 'crystal' },
          // Crystal bottom-center
          { x: 0.50, y: 0.80, z: 0.7, radius: 0.20, color: 0xccaaff, intensity: 1.6, type: 'crystal' },
          // Crystal right side
          { x: 0.85, y: 0.62, z: 0.6, radius: 0.22, color: 0xddaaff, intensity: 1.7, type: 'crystal' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Hyperlink — dark chamber with glowing blue network cables ──
    hyperlink: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Central cable nexus top-center
          { x: 0.50, y: 0.08, z: 0.2, radius: 0.26, color: 0x2266ff, intensity: 2.2, type: 'magical' },
          // Blue cable glow left wall
          { x: 0.08, y: 0.40, z: 0.4, radius: 0.22, color: 0x3377ff, intensity: 1.8, type: 'magical' },
          // Blue cable glow right wall
          { x: 0.90, y: 0.45, z: 0.4, radius: 0.22, color: 0x3377ff, intensity: 1.8, type: 'magical' },
          // Floor cable light trails
          { x: 0.40, y: 0.78, z: 0.7, radius: 0.20, color: 0x2255ee, intensity: 1.5, type: 'magical' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Imposter Syndrome — warm office with overhead ceiling panel and window ──
    imposter_syndrome: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Warm overhead ceiling panel
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.40, color: 0xffeecc, intensity: 1.4, type: 'ambient' },
          // Window light left side
          { x: 0.18, y: 0.35, z: 0.3, radius: 0.22, color: 0xffeedd, intensity: 1.2, type: 'ambient' },
        ],
      },
    },

    // ── Index Weaver — dim stone catalogue room ──
    index_weaver: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Diffuse overhead ambient
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.45, color: 0xddc898, intensity: 1.2, type: 'ambient' },
        ],
        ambientOverride: 0.15,
      },
    },

    // ── Information Overload — data-drowned hall with lava drips and orange crystals ──
    information_overload: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Orange crystal cluster center floor
          { x: 0.42, y: 0.68, z: 0.7, radius: 0.22, color: 0xff8833, intensity: 2.0, type: 'crystal' },
          // Lava drip left wall
          { x: 0.08, y: 0.45, z: 0.4, radius: 0.24, color: 0xff5500, intensity: 2.2, type: 'lava' },
          // Lava drip right wall
          { x: 0.88, y: 0.48, z: 0.4, radius: 0.22, color: 0xff6600, intensity: 2.0, type: 'lava' },
          // Orange crystal bottom right
          { x: 0.92, y: 0.72, z: 0.7, radius: 0.18, color: 0xff9933, intensity: 1.7, type: 'crystal' },
          // Lava floor pool center
          { x: 0.50, y: 0.88, z: 0.8, radius: 0.25, color: 0xff4400, intensity: 1.8, type: 'lava' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Ink Slug — very dark dungeon hall, ink-stained, minimal light ──
    ink_slug: {
      portrait: { lights: [] },
      landscape: {
        lights: [],
        ambientOverride: 0.06,
      },
    },

    // ── Institution — sterile grey bureaucratic room with fluorescent overhead ──
    institution: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Fluorescent ceiling strip left
          { x: 0.35, y: 0.02, z: 0.1, radius: 0.35, color: 0xddeeff, intensity: 1.5, type: 'ambient' },
          // Fluorescent ceiling strip right
          { x: 0.70, y: 0.02, z: 0.1, radius: 0.35, color: 0xddeeff, intensity: 1.5, type: 'ambient' },
        ],
        ambientOverride: 0.30,
      },
    },

    // ── Lost Thesis — chaotic study with hanging blue lanterns and glowing magic book ──
    lost_thesis: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left hanging lantern
          { x: 0.28, y: 0.18, z: 0.2, radius: 0.24, color: 0x88ccff, intensity: 2.0, type: 'lantern' },
          // Right hanging lantern
          { x: 0.72, y: 0.18, z: 0.2, radius: 0.24, color: 0x88ccff, intensity: 2.0, type: 'lantern' },
          // Glowing magical open book right desk
          { x: 0.88, y: 0.60, z: 0.6, radius: 0.20, color: 0x66aaff, intensity: 2.2, type: 'magical' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Margin Gremlin — rune-scrawled dungeon room, daylight seeping in ──
    margin_gremlin: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Diffuse ambient daylight
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.45, color: 0xddcc99, intensity: 1.2, type: 'ambient' },
        ],
        ambientOverride: 0.20,
      },
    },

    // ── Mold Puff — fungal library with bioluminescent mushrooms ──
    mold_puff: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Bioluminescent mushroom caps overhead center
          { x: 0.48, y: 0.08, z: 0.2, radius: 0.28, color: 0xffcc00, intensity: 2.0, type: 'bioluminescent' },
          // Glowing mushrooms left bookshelf
          { x: 0.18, y: 0.42, z: 0.4, radius: 0.22, color: 0xff8822, intensity: 1.7, type: 'bioluminescent' },
          // Glowing mushrooms right bookshelf
          { x: 0.72, y: 0.38, z: 0.4, radius: 0.22, color: 0xffaa22, intensity: 1.7, type: 'bioluminescent' },
          // Pink mushroom glow left wall
          { x: 0.08, y: 0.52, z: 0.5, radius: 0.18, color: 0xff44cc, intensity: 1.5, type: 'bioluminescent' },
        ],
      },
    },

    // ── Moth of Enlightenment — warm library with crystal chandelier and desk lamp ──
    moth_of_enlightenment: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Crystal chandelier center warm glow
          { x: 0.38, y: 0.12, z: 0.2, radius: 0.30, color: 0xfff0cc, intensity: 2.2, type: 'lantern' },
          // Chandelier arm candles left
          { x: 0.28, y: 0.18, z: 0.2, radius: 0.18, color: 0xffaa44, intensity: 1.8, type: 'candle' },
          // Chandelier arm candles right
          { x: 0.48, y: 0.16, z: 0.2, radius: 0.18, color: 0xffaa44, intensity: 1.8, type: 'candle' },
          // Desk lamp right side
          { x: 0.82, y: 0.52, z: 0.5, radius: 0.22, color: 0xffcc77, intensity: 2.0, type: 'lantern' },
          // Candle glow left shelf
          { x: 0.22, y: 0.45, z: 0.4, radius: 0.18, color: 0xffbb55, intensity: 1.5, type: 'candle' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Outdated Fact — dusty natural history museum, flat diffuse lighting ──
    outdated_fact: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Diffuse overhead museum lighting
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.50, color: 0xeedd99, intensity: 1.3, type: 'ambient' },
        ],
        ambientOverride: 0.25,
      },
    },

    // ── Overdue Golem — overgrown library archive, dim ──
    overdue_golem: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Diffuse overhead ambient
          { x: 0.50, y: 0.05, z: 0.2, radius: 0.50, color: 0xccbb88, intensity: 1.2, type: 'ambient' },
        ],
        ambientOverride: 0.18,
      },
    },

    // ── Paradigm Shift — split room: warm library left / cold server right ──
    paradigm_shift: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Warm filament bulb left
          { x: 0.18, y: 0.22, z: 0.2, radius: 0.22, color: 0xffcc55, intensity: 1.8, type: 'lantern' },
          // Warm filament bulb left-center
          { x: 0.32, y: 0.22, z: 0.2, radius: 0.20, color: 0xffcc55, intensity: 1.6, type: 'lantern' },
          // Cold server monitor glow right
          { x: 0.82, y: 0.38, z: 0.3, radius: 0.26, color: 0x44ffcc, intensity: 2.0, type: 'magical' },
          // Terminal screen glow far right
          { x: 0.95, y: 0.42, z: 0.3, radius: 0.20, color: 0x22ee99, intensity: 1.7, type: 'magical' },
        ],
      },
    },

    // ── Perfectionist — very dark tiled room, no light sources ──
    perfectionist: {
      portrait: { lights: [] },
      landscape: {
        lights: [],
        ambientOverride: 0.05,
      },
    },

    // ── Plagiarist — decayed dungeon with green slime patches ──
    plagiarist: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Green slime glow floor left
          { x: 0.25, y: 0.78, z: 0.7, radius: 0.22, color: 0x88ff22, intensity: 1.8, type: 'bioluminescent' },
          // Green slime center floor
          { x: 0.52, y: 0.82, z: 0.8, radius: 0.24, color: 0x66ee11, intensity: 1.6, type: 'bioluminescent' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Pop Quiz — mushroom-lamp classroom with glowing exam panels ──
    pop_quiz: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Mushroom desk lamp center table
          { x: 0.50, y: 0.55, z: 0.6, radius: 0.22, color: 0xffdd88, intensity: 1.8, type: 'bioluminescent' },
          // Mushroom lamps left tables
          { x: 0.28, y: 0.57, z: 0.6, radius: 0.18, color: 0xffcc77, intensity: 1.6, type: 'bioluminescent' },
          // Mushroom lamp left-center
          { x: 0.38, y: 0.55, z: 0.6, radius: 0.18, color: 0xffcc77, intensity: 1.5, type: 'bioluminescent' },
          // Wall mushroom clusters left
          { x: 0.08, y: 0.40, z: 0.4, radius: 0.20, color: 0xffbb55, intensity: 1.5, type: 'bioluminescent' },
          // Exam panel glow right wall
          { x: 0.88, y: 0.45, z: 0.3, radius: 0.22, color: 0xff8833, intensity: 1.6, type: 'magical' },
        ],
      },
    },

    // ── Pressure Cooker — industrial boiler room with lava floor grate ──
    pressure_cooker: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Lava heat grate center floor
          { x: 0.52, y: 0.80, z: 0.8, radius: 0.28, color: 0xff5500, intensity: 2.6, type: 'lava' },
          // Hot pipe glow right
          { x: 0.88, y: 0.60, z: 0.5, radius: 0.24, color: 0xff6600, intensity: 2.0, type: 'lava' },
          // Ember heat left
          { x: 0.12, y: 0.72, z: 0.6, radius: 0.20, color: 0xff4400, intensity: 1.8, type: 'lava' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Prismatic Jelly — rainbow crystal alchemist lab, stained glass + hanging crystals ──
    prismatic_jelly: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left stained glass rainbow flood
          { x: 0.10, y: 0.35, z: 0.2, radius: 0.28, color: 0xff44cc, intensity: 1.4, type: 'magical' },
          // Right stained glass rainbow flood
          { x: 0.22, y: 0.40, z: 0.2, radius: 0.26, color: 0x44ccff, intensity: 1.3, type: 'magical' },
          // Hanging crystal upper-left ceiling
          { x: 0.18, y: 0.12, z: 0.3, radius: 0.28, color: 0xdd44ff, intensity: 1.5, type: 'crystal' },
          // Hanging crystal upper-center ceiling
          { x: 0.45, y: 0.10, z: 0.3, radius: 0.26, color: 0x44ffcc, intensity: 1.3, type: 'crystal' },
          // Rainbow puddles floor center-left
          { x: 0.32, y: 0.78, z: 0.7, radius: 0.22, color: 0xff8844, intensity: 1.2, type: 'magical' },
          // Rainbow puddles floor center-right
          { x: 0.55, y: 0.82, z: 0.7, radius: 0.20, color: 0x44ccff, intensity: 1.1, type: 'magical' },
          // Right-side crystal cluster on shelf
          { x: 0.88, y: 0.40, z: 0.4, radius: 0.24, color: 0xdd44ff, intensity: 1.4, type: 'crystal' },
          // Upper-right hanging crystals
          { x: 0.80, y: 0.14, z: 0.3, radius: 0.22, color: 0x44aaff, intensity: 1.3, type: 'crystal' },
        ],
        ambientOverride: 0.42,
      },
    },

    // ── Proctor — dim stone examination hall, almost no light ──
    proctor: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Faint natural light from archway right side
          { x: 0.88, y: 0.30, z: 0.3, radius: 0.22, color: 0xccddaa, intensity: 1.1, type: 'ambient' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Publish or Perish — stone chamber with blue lantern-vials, candles, crystals ──
    publish_or_perish: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Hanging blue lantern center
          { x: 0.50, y: 0.22, z: 0.3, radius: 0.22, color: 0x44bbff, intensity: 1.3, type: 'lantern' },
          // Hanging blue vial left-center
          { x: 0.30, y: 0.20, z: 0.3, radius: 0.20, color: 0x55aaff, intensity: 1.2, type: 'lantern' },
          // Candle upper-left corner
          { x: 0.08, y: 0.12, z: 0.2, radius: 0.18, color: 0xff9944, intensity: 1.1, type: 'candle' },
          // Candle upper-right corner
          { x: 0.88, y: 0.12, z: 0.2, radius: 0.18, color: 0xff9944, intensity: 1.1, type: 'candle' },
          // Crystal pedestal right-center
          { x: 0.72, y: 0.55, z: 0.5, radius: 0.20, color: 0xaaddff, intensity: 1.2, type: 'crystal' },
          // Crystal pedestal far right
          { x: 0.88, y: 0.52, z: 0.5, radius: 0.18, color: 0x88ccff, intensity: 1.1, type: 'crystal' },
        ],
        ambientOverride: 0.15,
      },
    },

    // ── Rabbit Hole — dark dungeon with electric blue lightning on walls ──
    rabbit_hole: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Blue lightning left wall
          { x: 0.08, y: 0.45, z: 0.2, radius: 0.30, color: 0x4488ff, intensity: 1.6, type: 'magical' },
          // Blue lightning right wall
          { x: 0.92, y: 0.45, z: 0.2, radius: 0.28, color: 0x4488ff, intensity: 1.5, type: 'magical' },
          // Floor lightning circle center
          { x: 0.50, y: 0.72, z: 0.7, radius: 0.30, color: 0x6699ff, intensity: 1.3, type: 'magical' },
          // Lightning lower-left wall
          { x: 0.15, y: 0.70, z: 0.4, radius: 0.22, color: 0x3366ff, intensity: 1.2, type: 'magical' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Red Herring — stone room with two wall torches + yellow crystal clusters ──
    red_herring: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left wall torch
          { x: 0.22, y: 0.48, z: 0.2, radius: 0.25, color: 0xff8833, intensity: 1.8, type: 'torch' },
          // Right wall torch
          { x: 0.65, y: 0.42, z: 0.2, radius: 0.25, color: 0xff8833, intensity: 1.8, type: 'torch' },
          // Yellow crystal floor center-right
          { x: 0.60, y: 0.70, z: 0.6, radius: 0.22, color: 0xffdd44, intensity: 1.5, type: 'crystal' },
          // Yellow crystal far right shelf
          { x: 0.88, y: 0.28, z: 0.3, radius: 0.20, color: 0xffcc33, intensity: 1.3, type: 'crystal' },
        ],
        ambientOverride: 0.18,
      },
    },

    // ── Rosetta Slab — stone temple with two wall torches, glowing rune floor ──
    rosetta_slab: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left wall torch
          { x: 0.08, y: 0.52, z: 0.2, radius: 0.26, color: 0xff8833, intensity: 2.0, type: 'torch' },
          // Right wall torch
          { x: 0.92, y: 0.52, z: 0.2, radius: 0.26, color: 0xff8833, intensity: 2.0, type: 'torch' },
          // Glowing rune symbols on floor
          { x: 0.45, y: 0.78, z: 0.7, radius: 0.28, color: 0xffdd88, intensity: 1.2, type: 'magical' },
          // Rune symbols right side
          { x: 0.65, y: 0.82, z: 0.7, radius: 0.22, color: 0xffdd88, intensity: 1.1, type: 'magical' },
        ],
        ambientOverride: 0.15,
      },
    },

    // ── Rote Memory — dim brick vault with pale crystal clusters ──
    rote_memory: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left crystal pair on wall
          { x: 0.10, y: 0.38, z: 0.2, radius: 0.24, color: 0xddeeff, intensity: 1.3, type: 'crystal' },
          // Right crystal pair on wall
          { x: 0.88, y: 0.38, z: 0.2, radius: 0.24, color: 0xddeeff, intensity: 1.3, type: 'crystal' },
          // Center-right small lantern
          { x: 0.62, y: 0.45, z: 0.3, radius: 0.18, color: 0xffcc88, intensity: 1.1, type: 'lantern' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Rushing Student — chaotic dorm with lava cracks across floor ──
    rushing_student: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Main lava crack center floor
          { x: 0.50, y: 0.68, z: 0.7, radius: 0.35, color: 0xff4400, intensity: 2.2, type: 'lava' },
          // Lava crack left
          { x: 0.18, y: 0.75, z: 0.7, radius: 0.28, color: 0xff5500, intensity: 1.8, type: 'lava' },
          // Lava crack right
          { x: 0.78, y: 0.72, z: 0.7, radius: 0.26, color: 0xff4400, intensity: 1.8, type: 'lava' },
          // Digital clock glow on nightstand
          { x: 0.72, y: 0.52, z: 0.5, radius: 0.14, color: 0x4488ff, intensity: 1.0, type: 'magical' },
        ],
        ambientOverride: 0.20,
      },
    },

    // ── Sacred Text — Egyptian library with two large chandeliers ──
    sacred_text: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left chandelier
          { x: 0.22, y: 0.18, z: 0.3, radius: 0.30, color: 0xffcc66, intensity: 1.8, type: 'lantern' },
          // Right chandelier
          { x: 0.68, y: 0.16, z: 0.3, radius: 0.30, color: 0xffcc66, intensity: 1.8, type: 'lantern' },
          // Warm glow on floor beneath left chandelier
          { x: 0.22, y: 0.65, z: 0.7, radius: 0.25, color: 0xffaa44, intensity: 1.2, type: 'ambient' },
          // Warm glow on floor beneath right chandelier
          { x: 0.68, y: 0.65, z: 0.7, radius: 0.25, color: 0xffaa44, intensity: 1.2, type: 'ambient' },
        ],
        ambientOverride: 0.22,
      },
    },

    // ── Singularity — swirling multi-color vortex walls, arcane floor circle ──
    singularity: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left vortex wall warm glow
          { x: 0.12, y: 0.45, z: 0.2, radius: 0.35, color: 0xff8844, intensity: 1.5, type: 'magical' },
          // Right vortex wall cool glow
          { x: 0.85, y: 0.45, z: 0.2, radius: 0.35, color: 0x44ccff, intensity: 1.5, type: 'magical' },
          // Ceiling swirl
          { x: 0.50, y: 0.08, z: 0.2, radius: 0.30, color: 0xaa44ff, intensity: 1.3, type: 'magical' },
          // Floor circle arcane glow
          { x: 0.50, y: 0.80, z: 0.7, radius: 0.28, color: 0xffdd88, intensity: 1.1, type: 'magical' },
        ],
        ambientOverride: 0.35,
      },
    },

    // ── Spark Note — dark chamber with two wall torches, burning wall niches ──
    spark_note: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left wall torch
          { x: 0.10, y: 0.42, z: 0.2, radius: 0.26, color: 0xff8833, intensity: 2.0, type: 'torch' },
          // Right wall torch
          { x: 0.65, y: 0.38, z: 0.2, radius: 0.26, color: 0xff8833, intensity: 2.0, type: 'torch' },
          // Burning niches left wall warm glow
          { x: 0.12, y: 0.58, z: 0.3, radius: 0.22, color: 0xff6622, intensity: 1.5, type: 'torch' },
          // Floor burning papers/embers
          { x: 0.35, y: 0.80, z: 0.7, radius: 0.20, color: 0xff8844, intensity: 1.2, type: 'campfire' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Standardized Test — oppressive exam hall with fluorescent strip lights ──
    standardized_test: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Fluorescent strip left row
          { x: 0.18, y: 0.06, z: 0.2, radius: 0.28, color: 0xddeeff, intensity: 1.6, type: 'ambient' },
          // Fluorescent strip center
          { x: 0.50, y: 0.06, z: 0.2, radius: 0.30, color: 0xddeeff, intensity: 1.6, type: 'ambient' },
          // Fluorescent strip right row
          { x: 0.82, y: 0.06, z: 0.2, radius: 0.28, color: 0xddeeff, intensity: 1.6, type: 'ambient' },
          // Floor reflection from overhead
          { x: 0.50, y: 0.75, z: 0.7, radius: 0.35, color: 0xccddff, intensity: 1.0, type: 'ambient' },
        ],
        ambientOverride: 0.38,
      },
    },

    // ── Staple Bug — very dim utility room ──
    staple_bug: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Faint ceiling fixture
          { x: 0.50, y: 0.15, z: 0.2, radius: 0.30, color: 0xbbccdd, intensity: 1.0, type: 'ambient' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Student Debt — dark flooded dungeon, no light sources ──
    student_debt: {
      portrait: { lights: [] },
      landscape: {
        lights: [],
        ambientOverride: 0.07,
      },
    },

    // ── Study Group — bioluminescent mushroom cave, glowing mycelium veins ──
    study_group: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Large teal mushroom right side
          { x: 0.78, y: 0.38, z: 0.4, radius: 0.28, color: 0x44ffcc, intensity: 1.6, type: 'bioluminescent' },
          // Mycelium vein network right wall
          { x: 0.88, y: 0.55, z: 0.3, radius: 0.26, color: 0x44ddaa, intensity: 1.4, type: 'bioluminescent' },
          // Red mushroom cluster left foreground
          { x: 0.12, y: 0.70, z: 0.7, radius: 0.22, color: 0xff4444, intensity: 1.2, type: 'bioluminescent' },
          // Purple mushroom mid-left
          { x: 0.22, y: 0.60, z: 0.6, radius: 0.20, color: 0xaa44ff, intensity: 1.2, type: 'bioluminescent' },
          // Orange mushroom far left
          { x: 0.06, y: 0.80, z: 0.8, radius: 0.20, color: 0xff6622, intensity: 1.1, type: 'bioluminescent' },
          // Teal glow right shelf area
          { x: 0.92, y: 0.38, z: 0.3, radius: 0.22, color: 0x22ffaa, intensity: 1.3, type: 'bioluminescent' },
        ],
        ambientOverride: 0.20,
      },
    },

    // ── Tenure Guardian — crystal study with purple desk, white/blue crystals throughout ──
    tenure_guardian: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Crystal cluster upper-left ceiling
          { x: 0.08, y: 0.12, z: 0.2, radius: 0.30, color: 0xddeeff, intensity: 1.5, type: 'crystal' },
          // Crystal cluster upper-right ceiling
          { x: 0.88, y: 0.12, z: 0.2, radius: 0.30, color: 0xddeeff, intensity: 1.5, type: 'crystal' },
          // Purple desk glow left-center
          { x: 0.28, y: 0.62, z: 0.6, radius: 0.26, color: 0xcc66ff, intensity: 1.6, type: 'crystal' },
          // Floor crystal reflection
          { x: 0.50, y: 0.75, z: 0.7, radius: 0.32, color: 0xeeeeff, intensity: 1.2, type: 'crystal' },
          // Right wall crystal mid-height
          { x: 0.92, y: 0.50, z: 0.3, radius: 0.26, color: 0xccddff, intensity: 1.4, type: 'crystal' },
        ],
        ambientOverride: 0.40,
      },
    },

    // ── Textbook — nearly pitch dark library corridor ──
    textbook: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Faint light from archway ahead
          { x: 0.50, y: 0.45, z: 0.1, radius: 0.25, color: 0xaabbcc, intensity: 0.8, type: 'ambient' },
        ],
        ambientOverride: 0.06,
      },
    },

    // ── Thesis Construct — crystal cave with amber/orange and blue crystal clusters ──
    thesis_construct: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Amber crystal mass left side
          { x: 0.10, y: 0.55, z: 0.5, radius: 0.30, color: 0xffaa33, intensity: 2.0, type: 'crystal' },
          // Amber crystal far left foreground
          { x: 0.05, y: 0.72, z: 0.7, radius: 0.24, color: 0xff8822, intensity: 1.6, type: 'crystal' },
          // Blue crystal upper right
          { x: 0.88, y: 0.25, z: 0.3, radius: 0.26, color: 0x44aaff, intensity: 1.7, type: 'crystal' },
          // Amber crystal mass right side
          { x: 0.90, y: 0.55, z: 0.5, radius: 0.28, color: 0xffaa33, intensity: 1.8, type: 'crystal' },
          // White stalactites upper-center
          { x: 0.48, y: 0.10, z: 0.2, radius: 0.24, color: 0xddeeff, intensity: 1.1, type: 'crystal' },
          // Small crystal near center table
          { x: 0.48, y: 0.52, z: 0.4, radius: 0.18, color: 0xaaccff, intensity: 1.0, type: 'crystal' },
        ],
        ambientOverride: 0.18,
      },
    },

    // ── Thesis Djinn — dark chamber with large ornate oil lamp ──
    thesis_djinn: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Large ornate oil lantern left foreground
          { x: 0.12, y: 0.58, z: 0.7, radius: 0.32, color: 0xff9933, intensity: 2.2, type: 'lantern' },
          // Flame glow on floor left
          { x: 0.20, y: 0.78, z: 0.7, radius: 0.26, color: 0xff8822, intensity: 1.4, type: 'campfire' },
          // Faint glow from potion bottles on shelf
          { x: 0.10, y: 0.35, z: 0.3, radius: 0.18, color: 0xffaa66, intensity: 1.0, type: 'candle' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Thesis Dragon — dark ruined cave, almost no light ──
    thesis_dragon: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Faint ambient from cave opening above
          { x: 0.50, y: 0.08, z: 0.1, radius: 0.28, color: 0x9988aa, intensity: 0.8, type: 'ambient' },
        ],
        ambientOverride: 0.06,
      },
    },

    // ── Trick Question — dim dungeon with glowing skull orb on chain ──
    trick_question: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Glowing skull orb hanging left
          { x: 0.18, y: 0.38, z: 0.4, radius: 0.24, color: 0xffdd88, intensity: 1.8, type: 'magical' },
          // Glow cast below skull on floor
          { x: 0.18, y: 0.60, z: 0.5, radius: 0.20, color: 0xffcc66, intensity: 1.2, type: 'magical' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Tutor — witch's study with green cauldron, ceiling lantern, shelf candle ──
    tutor: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Green glowing cauldron left foreground
          { x: 0.18, y: 0.68, z: 0.7, radius: 0.28, color: 0x44ff66, intensity: 2.0, type: 'magical' },
          // Ceiling lantern center hanging
          { x: 0.48, y: 0.28, z: 0.3, radius: 0.22, color: 0xffcc66, intensity: 1.5, type: 'lantern' },
          // Candle on shelf left side
          { x: 0.28, y: 0.42, z: 0.3, radius: 0.16, color: 0xff9944, intensity: 1.1, type: 'candle' },
          // Warm floor glow from cauldron spill
          { x: 0.15, y: 0.82, z: 0.8, radius: 0.22, color: 0x33ee55, intensity: 1.3, type: 'magical' },
        ],
        ambientOverride: 0.14,
      },
    },

    // ── Unknown Unknown — very dark room with single floor lantern, heavy vignette ──
    unknown_unknown: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Floor lantern center sole source
          { x: 0.50, y: 0.72, z: 0.7, radius: 0.30, color: 0xffcc88, intensity: 2.0, type: 'lantern' },
          // Faint glow cast upward
          { x: 0.50, y: 0.55, z: 0.5, radius: 0.22, color: 0xffaa66, intensity: 1.2, type: 'lantern' },
        ],
        ambientOverride: 0.05,
      },
    },

    // ── Watchdog — security room with glowing monitor screens ──
    watchdog: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Monitor screen cluster left wall
          { x: 0.18, y: 0.48, z: 0.2, radius: 0.28, color: 0x88aacc, intensity: 1.4, type: 'magical' },
          // Monitor spill onto floor
          { x: 0.22, y: 0.72, z: 0.6, radius: 0.22, color: 0x6699bb, intensity: 1.0, type: 'ambient' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Writer's Block — dark crystal cave with one glowing surface ──
    writers_block: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Glowing table/writing surface left foreground
          { x: 0.22, y: 0.58, z: 0.6, radius: 0.26, color: 0xeeeebb, intensity: 1.8, type: 'magical' },
          // Faint glow on floor from lit surface
          { x: 0.22, y: 0.75, z: 0.7, radius: 0.20, color: 0xddddaa, intensity: 1.2, type: 'ambient' },
        ],
        ambientOverride: 0.06,
      },
    },
  },

  rooms: {
    // ── Rest room — campfire center + 2 wall torches + ceiling bounce ──
    rest: {
      portrait: {
        lights: [
          { x: 0.50, y: 0.62, z: 0.6, radius: 0.30, color: 0xffaa44, intensity: 1.5, type: 'campfire' },
          { x: 0.50, y: 0.75, z: 0.7, radius: 0.35, color: 0xff8833, intensity: 1.0, type: 'campfire' },
          { x: 0.18, y: 0.22, z: 0.4, radius: 0.20, color: 0xff8833, intensity: 1.2, type: 'torch' },
          { x: 0.82, y: 0.22, z: 0.4, radius: 0.20, color: 0xff8833, intensity: 1.2, type: 'torch' },
          { x: 0.50, y: 0.38, z: 0.3, radius: 0.25, color: 0xffcc88, intensity: 0.8, type: 'ambient' },
        ],
      },
      landscape: {
        lights: [
          // Central campfire flame
          { x: 0.50, y: 0.62, z: 0.6, radius: 0.30, color: 0xffaa44, intensity: 1.5, type: 'campfire' },
          // Campfire floor glow — wide warm wash on the ground
          { x: 0.50, y: 0.75, z: 0.7, radius: 0.35, color: 0xff8833, intensity: 1.0, type: 'campfire' },
          // Left wall torch
          { x: 0.18, y: 0.22, z: 0.4, radius: 0.22, color: 0xff8833, intensity: 1.2, type: 'torch' },
          // Right wall torch
          { x: 0.82, y: 0.22, z: 0.4, radius: 0.22, color: 0xff8833, intensity: 1.2, type: 'torch' },
          // Ceiling bounce — campfire light hitting the rock above
          { x: 0.50, y: 0.38, z: 0.3, radius: 0.25, color: 0xffcc88, intensity: 0.8, type: 'ambient' },
        ],
      },
    },

    // ── Shop — multiple hanging lanterns + blue cauldron ──
    shop: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.20, y: 0.15, z: 0.3, radius: 0.10, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          { x: 0.40, y: 0.12, z: 0.3, radius: 0.10, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          { x: 0.60, y: 0.15, z: 0.3, radius: 0.10, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          { x: 0.80, y: 0.12, z: 0.3, radius: 0.10, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          { x: 0.08, y: 0.55, z: 0.6, radius: 0.12, color: 0x4488ff, intensity: 1.5, type: 'magical' },
          { x: 0.18, y: 0.35, z: 0.4, radius: 0.08, color: 0xffaa44, intensity: 0.8, type: 'candle' },
        ],
      },
    },

    // ── Treasure room — evenly lit display room ──
    treasure: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.50, y: 0.15, z: 0.2, radius: 0.25, color: 0xffddaa, intensity: 1.2, type: 'ambient' },
        ],
      },
    },

    // ── Descent — dark stairwell going deeper ──
    descent: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Left wall torch flanking stairway
          { x: 0.25, y: 0.30, z: 0.3, radius: 0.24, color: 0xff8833, intensity: 1.6, type: 'torch' },
          // Right wall torch flanking stairway
          { x: 0.75, y: 0.30, z: 0.3, radius: 0.24, color: 0xff8833, intensity: 1.6, type: 'torch' },
          // Faint ambient overhead
          { x: 0.50, y: 0.10, z: 0.2, radius: 0.30, color: 0xccbb88, intensity: 0.8, type: 'ambient' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Mystery — eerie mystical chamber with blue-green fog ──
    mystery: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Blue-green mystical fog glow left
          { x: 0.25, y: 0.50, z: 0.4, radius: 0.35, color: 0x44ddaa, intensity: 1.4, type: 'magical' },
          // Blue-green mystical fog glow right
          { x: 0.75, y: 0.50, z: 0.4, radius: 0.35, color: 0x4488dd, intensity: 1.4, type: 'magical' },
        ],
        ambientOverride: 0.15,
      },
    },
  },

  mystery: {
    // ── Burning Library — fires + blue portal glow ──
    burning_library: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          { x: 0.72, y: 0.45, z: 0.5, radius: 0.15, color: 0x4488ff, intensity: 2.0, type: 'portal' },
          { x: 0.15, y: 0.50, z: 0.5, radius: 0.15, color: 0xff6600, intensity: 1.5, type: 'lava' },
          { x: 0.40, y: 0.55, z: 0.5, radius: 0.12, color: 0xff6600, intensity: 1.3, type: 'lava' },
          { x: 0.85, y: 0.60, z: 0.5, radius: 0.12, color: 0xff6600, intensity: 1.3, type: 'lava' },
          { x: 0.30, y: 0.75, z: 0.6, radius: 0.08, color: 0xff4400, intensity: 1.0, type: 'lava' },
          { x: 0.60, y: 0.80, z: 0.6, radius: 0.08, color: 0xff4400, intensity: 1.0, type: 'lava' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Ambush — dungeon study with ceiling lantern, wall torch, desk candle, ominous red glow ──
    ambush: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Ceiling lantern center
          { x: 0.50, y: 0.12, z: 0.2, radius: 0.28, color: 0xffcc66, intensity: 1.4, type: 'lantern' },
          // Wall torch left
          { x: 0.10, y: 0.38, z: 0.4, radius: 0.20, color: 0xff8833, intensity: 1.3, type: 'torch' },
          // Small desk candle center
          { x: 0.53, y: 0.50, z: 0.6, radius: 0.15, color: 0xff9944, intensity: 1.1, type: 'candle' },
          // Ominous red glow far right
          { x: 0.95, y: 0.45, z: 0.5, radius: 0.18, color: 0xff2200, intensity: 1.2, type: 'torch' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Cache of Contraband — dark vault with single wall torch and glowing red runes ──
    cache_of_contraband: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Wall torch far left entrance
          { x: 0.06, y: 0.38, z: 0.5, radius: 0.22, color: 0xff8833, intensity: 1.8, type: 'torch' },
          // Red rune glow upper center
          { x: 0.50, y: 0.15, z: 0.2, radius: 0.30, color: 0xff2200, intensity: 1.0, type: 'magical' },
          // Red rune glow left wall mid
          { x: 0.25, y: 0.35, z: 0.3, radius: 0.20, color: 0xff3300, intensity: 0.9, type: 'magical' },
          // Red rune glow right wall mid
          { x: 0.75, y: 0.35, z: 0.3, radius: 0.20, color: 0xff3300, intensity: 0.9, type: 'magical' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Copyist's Workshop — bright scriptorium with wall torches and hanging lantern ──
    copyists_workshop: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Hanging lantern upper center
          { x: 0.50, y: 0.12, z: 0.2, radius: 0.25, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          // Wall torch left
          { x: 0.20, y: 0.30, z: 0.4, radius: 0.22, color: 0xff8833, intensity: 1.4, type: 'torch' },
          // Wall torch right
          { x: 0.80, y: 0.30, z: 0.4, radius: 0.22, color: 0xff8833, intensity: 1.4, type: 'torch' },
        ],
        ambientOverride: 0.22,
      },
    },

    // ── Desperate Bargain — dark chamber with glowing purple crystal on pedestal ──
    desperate_bargain: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Central purple crystal — dominant light source
          { x: 0.50, y: 0.50, z: 0.5, radius: 0.35, color: 0xcc44ff, intensity: 2.2, type: 'crystal' },
          // Magenta rim glow on pedestal
          { x: 0.50, y: 0.62, z: 0.6, radius: 0.20, color: 0xff00cc, intensity: 1.4, type: 'magical' },
        ],
        ambientOverride: 0.06,
      },
    },

    // ── Donation Box — chapel with hanging lantern, wall torches, and many candles ──
    donation_box: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Hanging lantern center ceiling
          { x: 0.50, y: 0.15, z: 0.2, radius: 0.25, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          // Wall torch left
          { x: 0.14, y: 0.45, z: 0.5, radius: 0.20, color: 0xff8833, intensity: 1.4, type: 'torch' },
          // Candelabra cluster center-floor
          { x: 0.45, y: 0.72, z: 0.7, radius: 0.25, color: 0xff9944, intensity: 1.5, type: 'candle' },
          // Tall candelabra left
          { x: 0.12, y: 0.60, z: 0.6, radius: 0.18, color: 0xff9944, intensity: 1.2, type: 'candle' },
          // Candles right table
          { x: 0.88, y: 0.62, z: 0.6, radius: 0.18, color: 0xff9944, intensity: 1.1, type: 'candle' },
        ],
        ambientOverride: 0.18,
      },
    },

    // ── Dust and Silence — abandoned study with crystal formations, dim overall ──
    dust_and_silence: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Crystal formations right side
          { x: 0.82, y: 0.55, z: 0.5, radius: 0.22, color: 0xaaddff, intensity: 1.1, type: 'crystal' },
          // Crystal cluster lower right
          { x: 0.90, y: 0.75, z: 0.6, radius: 0.15, color: 0xaaddff, intensity: 0.9, type: 'crystal' },
        ],
        ambientOverride: 0.14,
      },
    },

    // ── Elite Ambush — very dark dungeon hallway with faint corridor torches ──
    elite_ambush: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Faint torch glow left corridor
          { x: 0.05, y: 0.45, z: 0.6, radius: 0.18, color: 0xff6622, intensity: 1.5, type: 'torch' },
          // Faint red glow right wall
          { x: 0.90, y: 0.50, z: 0.5, radius: 0.15, color: 0xff2200, intensity: 1.0, type: 'torch' },
        ],
        ambientOverride: 0.07,
      },
    },

    // ── Eraser Storm — bright white stormy room, high ambient, no discrete sources ──
    eraser_storm: {
      portrait: { lights: [] },
      landscape: {
        lights: [],
        ambientOverride: 0.55,
      },
    },

    // ── Final Wager — dark gambling den with hanging lantern and wall sconce ──
    final_wager: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Hanging lantern center ceiling
          { x: 0.50, y: 0.15, z: 0.2, radius: 0.28, color: 0xffcc66, intensity: 1.8, type: 'lantern' },
          // Wall sconce right
          { x: 0.82, y: 0.45, z: 0.5, radius: 0.18, color: 0xff9944, intensity: 1.2, type: 'candle' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Gambler's Tome — tavern gambling hall with chandelier, wall torches, floor candle ──
    gamblers_tome: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Iron chandelier with candles center
          { x: 0.50, y: 0.22, z: 0.2, radius: 0.30, color: 0xffcc66, intensity: 1.4, type: 'candle' },
          // Wall torch left
          { x: 0.10, y: 0.38, z: 0.5, radius: 0.20, color: 0xff8833, intensity: 1.3, type: 'torch' },
          // Wall torch right
          { x: 0.87, y: 0.38, z: 0.5, radius: 0.20, color: 0xff8833, intensity: 1.3, type: 'torch' },
          // Floor candle center-left
          { x: 0.32, y: 0.82, z: 0.7, radius: 0.14, color: 0xff9944, intensity: 1.0, type: 'candle' },
        ],
        ambientOverride: 0.18,
      },
    },

    // ── Healing Fountain — cave with bioluminescent glow, glowing fountain, crystals, lantern ──
    healing_fountain: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Glowing magical fountain center-right
          { x: 0.62, y: 0.55, z: 0.5, radius: 0.28, color: 0x44ffcc, intensity: 1.8, type: 'bioluminescent' },
          // Crystal clusters left
          { x: 0.20, y: 0.60, z: 0.5, radius: 0.22, color: 0x33ddaa, intensity: 1.2, type: 'crystal' },
          // Small lantern lower-left
          { x: 0.17, y: 0.70, z: 0.7, radius: 0.15, color: 0xffcc66, intensity: 1.1, type: 'lantern' },
          // Bioluminescent cave ceiling ambient
          { x: 0.50, y: 0.20, z: 0.2, radius: 0.40, color: 0x22ccaa, intensity: 0.9, type: 'bioluminescent' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Knowledge Tax — gatehouse/tax office with wall lanterns and torch ──
    knowledge_tax: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Wall lantern left of gate
          { x: 0.28, y: 0.48, z: 0.4, radius: 0.22, color: 0xffcc66, intensity: 1.5, type: 'lantern' },
          // Wall lantern right of gate
          { x: 0.72, y: 0.48, z: 0.4, radius: 0.22, color: 0xffcc66, intensity: 1.5, type: 'lantern' },
          // Wall torch far right
          { x: 0.90, y: 0.38, z: 0.5, radius: 0.18, color: 0xff8833, intensity: 1.3, type: 'torch' },
        ],
        ambientOverride: 0.20,
      },
    },

    // ── Lost and Found — storage room with single hanging lantern right ──
    lost_and_found: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Hanging lantern right wall
          { x: 0.72, y: 0.42, z: 0.4, radius: 0.25, color: 0xffcc66, intensity: 1.6, type: 'lantern' },
        ],
        ambientOverride: 0.18,
      },
    },

    // ── Lost Notebook — archive with ceiling skylight beam and small candle ──
    lost_notebook: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Ceiling skylight beam center — bright shaft of light
          { x: 0.50, y: 0.08, z: 0.1, radius: 0.22, color: 0xffeedd, intensity: 2.0, type: 'ambient' },
          // Candle lower right
          { x: 0.85, y: 0.75, z: 0.7, radius: 0.12, color: 0xff9944, intensity: 1.0, type: 'candle' },
        ],
        ambientOverride: 0.10,
      },
    },

    // ── Merchant of Memories — exotic bazaar with hanging lanterns, glowing fish tank, incense lamp ──
    merchant_of_memories: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Hanging lantern center-left
          { x: 0.45, y: 0.22, z: 0.2, radius: 0.20, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          // Hanging lantern center-right
          { x: 0.58, y: 0.18, z: 0.2, radius: 0.18, color: 0xffaa55, intensity: 1.2, type: 'lantern' },
          // Wall sconce right
          { x: 0.88, y: 0.40, z: 0.5, radius: 0.18, color: 0xff9944, intensity: 1.2, type: 'torch' },
          // Glowing fish tank / magical display right
          { x: 0.83, y: 0.58, z: 0.5, radius: 0.18, color: 0x44aaff, intensity: 1.3, type: 'magical' },
          // Incense lamp center-bottom
          { x: 0.40, y: 0.80, z: 0.7, radius: 0.16, color: 0xffdd88, intensity: 1.0, type: 'candle' },
        ],
        ambientOverride: 0.22,
      },
    },

    // ── Mirror Scholar — blue-toned mirror chamber with chandelier, candelabras, wall torches ──
    mirror_scholar: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Ceiling chandelier with candles
          { x: 0.50, y: 0.15, z: 0.2, radius: 0.28, color: 0xddeeff, intensity: 1.3, type: 'candle' },
          // Candelabra left of mirror
          { x: 0.37, y: 0.55, z: 0.5, radius: 0.18, color: 0xffeedd, intensity: 1.2, type: 'candle' },
          // Candelabra right of mirror
          { x: 0.63, y: 0.55, z: 0.5, radius: 0.18, color: 0xffeedd, intensity: 1.2, type: 'candle' },
          // Wall torch far left
          { x: 0.07, y: 0.60, z: 0.6, radius: 0.18, color: 0xff8833, intensity: 1.3, type: 'torch' },
          // Wall torch far right
          { x: 0.93, y: 0.60, z: 0.6, radius: 0.18, color: 0xff8833, intensity: 1.3, type: 'torch' },
          // Mirror cold blue reflection
          { x: 0.50, y: 0.45, z: 0.4, radius: 0.22, color: 0x88bbff, intensity: 1.0, type: 'magical' },
        ],
        ambientOverride: 0.20,
      },
    },

    // ── Reading Nook — cozy study with chandelier, wall torch, wall lantern, desk candle ──
    reading_nook: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Ceiling chandelier center
          { x: 0.50, y: 0.18, z: 0.2, radius: 0.28, color: 0xffcc66, intensity: 1.3, type: 'candle' },
          // Wall torch/sconce left
          { x: 0.12, y: 0.42, z: 0.5, radius: 0.20, color: 0xff8833, intensity: 1.3, type: 'torch' },
          // Wall lantern right-center
          { x: 0.68, y: 0.42, z: 0.5, radius: 0.20, color: 0xffcc66, intensity: 1.2, type: 'lantern' },
          // Desk candle
          { x: 0.55, y: 0.65, z: 0.6, radius: 0.14, color: 0xff9944, intensity: 1.0, type: 'candle' },
        ],
        ambientOverride: 0.20,
      },
    },

    // ── Scattered Coins — loot room with hanging lantern, candelabra, wall candle ──
    scattered_coins: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Hanging lantern left-center
          { x: 0.28, y: 0.22, z: 0.2, radius: 0.22, color: 0xffcc66, intensity: 1.4, type: 'lantern' },
          // Candelabra center
          { x: 0.52, y: 0.22, z: 0.2, radius: 0.20, color: 0xffcc66, intensity: 1.3, type: 'candle' },
          // Wall candle right
          { x: 0.78, y: 0.38, z: 0.5, radius: 0.16, color: 0xff9944, intensity: 1.1, type: 'candle' },
        ],
        ambientOverride: 0.18,
      },
    },

    // ── Strange Mushrooms — bioluminescent cave with glowing multicolored mushrooms and crystals ──
    strange_mushrooms: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Large teal mushrooms center
          { x: 0.45, y: 0.35, z: 0.4, radius: 0.30, color: 0x00ffcc, intensity: 1.6, type: 'bioluminescent' },
          // Purple mushrooms right
          { x: 0.65, y: 0.45, z: 0.5, radius: 0.25, color: 0xcc44ff, intensity: 1.4, type: 'bioluminescent' },
          // Orange mushrooms upper-left
          { x: 0.20, y: 0.25, z: 0.3, radius: 0.20, color: 0xff8800, intensity: 1.2, type: 'bioluminescent' },
          // Blue crystals left wall
          { x: 0.15, y: 0.50, z: 0.5, radius: 0.22, color: 0x4488ff, intensity: 1.2, type: 'crystal' },
          // Scattered small mushroom glow lower center
          { x: 0.50, y: 0.75, z: 0.7, radius: 0.18, color: 0x44ffaa, intensity: 1.0, type: 'bioluminescent' },
        ],
        ambientOverride: 0.08,
      },
    },

    // ── Strict Librarian — library with cold fog/smoke and single oil lamp on desk ──
    strict_librarian: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Oil lamp on desk center
          { x: 0.45, y: 0.62, z: 0.6, radius: 0.22, color: 0xffcc66, intensity: 1.6, type: 'lantern' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── Study Group — classroom with chandelier, wall torches, table candles ──
    study_group: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Ceiling chandelier with candles
          { x: 0.50, y: 0.18, z: 0.2, radius: 0.30, color: 0xddeeff, intensity: 1.2, type: 'candle' },
          // Wall torch left
          { x: 0.22, y: 0.38, z: 0.5, radius: 0.20, color: 0xff8833, intensity: 1.3, type: 'torch' },
          // Wall torch right
          { x: 0.77, y: 0.38, z: 0.5, radius: 0.20, color: 0xff8833, intensity: 1.3, type: 'torch' },
          // Candle on table center-left
          { x: 0.35, y: 0.58, z: 0.6, radius: 0.14, color: 0xff9944, intensity: 1.0, type: 'candle' },
          // Candle on table center-right
          { x: 0.60, y: 0.55, z: 0.6, radius: 0.14, color: 0xff9944, intensity: 1.0, type: 'candle' },
        ],
        ambientOverride: 0.20,
      },
    },

    // ── The Breakthrough — bright crystal hall with giant glowing crystal formation ──
    the_breakthrough: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Giant central crystal formation — dominant
          { x: 0.50, y: 0.45, z: 0.4, radius: 0.40, color: 0xfff0dd, intensity: 2.5, type: 'crystal' },
          // Crystal panel left wall
          { x: 0.18, y: 0.55, z: 0.4, radius: 0.22, color: 0xffeedd, intensity: 1.4, type: 'crystal' },
          // Crystal panel right wall
          { x: 0.82, y: 0.55, z: 0.4, radius: 0.22, color: 0xffeedd, intensity: 1.4, type: 'crystal' },
        ],
        ambientOverride: 0.40,
      },
    },

    // ── The Purge — runic judgment chamber with cold blue magical flame on altar ──
    the_purge: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Blue magical flame on central altar
          { x: 0.50, y: 0.42, z: 0.4, radius: 0.28, color: 0x44aaff, intensity: 2.0, type: 'magical' },
          // Cold blue ambient from runic scales left
          { x: 0.15, y: 0.50, z: 0.5, radius: 0.18, color: 0x6699ff, intensity: 0.9, type: 'magical' },
          // Cold blue ambient from runic scales right
          { x: 0.85, y: 0.50, z: 0.5, radius: 0.18, color: 0x6699ff, intensity: 0.9, type: 'magical' },
        ],
        ambientOverride: 0.12,
      },
    },

    // ── The Recursion — maze room with wall torch, hanging lantern, candle, and blue moonlight glow ──
    the_recursion: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Wall torch left
          { x: 0.10, y: 0.32, z: 0.5, radius: 0.22, color: 0xff8833, intensity: 1.5, type: 'torch' },
          // Hanging lantern center
          { x: 0.50, y: 0.22, z: 0.2, radius: 0.22, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          // Candle on shelf left
          { x: 0.22, y: 0.68, z: 0.6, radius: 0.14, color: 0xff9944, intensity: 1.0, type: 'candle' },
          // Blue moonlight/arcane glow right wall
          { x: 0.88, y: 0.45, z: 0.4, radius: 0.22, color: 0x88aaff, intensity: 1.1, type: 'magical' },
        ],
        ambientOverride: 0.14,
      },
    },

    // ── Whispering Shelf — magical library with ceiling lantern, wall candles, blue aura from levitating book ──
    whispering_shelf: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Ceiling lantern center
          { x: 0.50, y: 0.15, z: 0.2, radius: 0.22, color: 0xffcc66, intensity: 1.3, type: 'lantern' },
          // Wall candle left
          { x: 0.12, y: 0.58, z: 0.6, radius: 0.16, color: 0xff9944, intensity: 1.1, type: 'candle' },
          // Wall candle right
          { x: 0.88, y: 0.55, z: 0.6, radius: 0.16, color: 0xff9944, intensity: 1.1, type: 'candle' },
          // Blue magical aura from levitating book center
          { x: 0.50, y: 0.42, z: 0.5, radius: 0.25, color: 0x44aaff, intensity: 1.8, type: 'magical' },
        ],
        ambientOverride: 0.11,
      },
    },

    // ── Wishing Well — cave well room with wall torch, magical teal well glow, blue skylight ──
    wishing_well: {
      portrait: { lights: [] },
      landscape: {
        lights: [
          // Wall torch left
          { x: 0.12, y: 0.52, z: 0.5, radius: 0.20, color: 0xff8833, intensity: 1.4, type: 'torch' },
          // Magical teal glow from well center
          { x: 0.52, y: 0.50, z: 0.5, radius: 0.30, color: 0x33ddcc, intensity: 1.8, type: 'magical' },
          // Blue skylight from above center
          { x: 0.50, y: 0.05, z: 0.1, radius: 0.20, color: 0x88aaff, intensity: 1.2, type: 'ambient' },
        ],
        ambientOverride: 0.12,
      },
    },
  },
}
