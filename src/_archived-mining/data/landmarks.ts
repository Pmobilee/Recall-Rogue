// ============================================================
// LANDMARK LAYERS — Pre-designed template layers (DD-V2-055)
// Replaces procedural generation at layers 5, 10, 15, 20.
// ============================================================

/** Identifies one of the four landmark layers in the mine. */
export type LandmarkId = 'gauntlet' | 'treasure_vault' | 'ancient_archive' | 'completion_event'

/** A pre-designed landmark template that replaces procedural generation for a given layer. */
export interface LandmarkTemplate {
  id: LandmarkId
  /** 1-indexed layer number where this landmark appears. */
  layer: number
  /** Same as layer — used for clarity when stamping into the grid. */
  targetLayer: number
  /** Visual theme name for the tile-set used in this landmark. */
  tileTheme: string
  /** O2 bonus awarded on first clear of this landmark. */
  firstClearO2Bonus: number
  /**
   * ASCII grid defining the landmark layout.
   * Characters:
   *   ' ' = Empty
   *   '#' = HardRock (wall)
   *   'L' = LavaBlock
   *   'G' = GasPocket
   *   'C' = Chest
   *   'T' = Tablet
   *   'M' = MineralNode
   *   'E' = Empty event space
   *   'S' = Spawn point (resolved to Empty after stamp)
   *   'D' = DescentShaft
   */
  grid: string[]
}

/** A narrative event triggered at the completion event layer (L20). */
export interface CompletionEvent {
  id: string
  title: string
  gaiaMonologue: string
  reward: {
    type: 'cosmetic' | 'relic' | 'fact_mastery_bonus' | 'o2_cache'
    value: string | number
  }
}

// ============================================================
// LANDMARK TEMPLATES
// ============================================================

export const LANDMARK_TEMPLATES: Record<LandmarkId, LandmarkTemplate> = {
  gauntlet: {
    id: 'gauntlet',
    layer: 5,
    targetLayer: 5,
    tileTheme: 'gauntlet',
    firstClearO2Bonus: 30,
    grid: [
      '###################',
      '#  L  #  G  #  L  #',
      '#     #     #     #',
      '# L   S   G #   L #',
      '#     #     #     #',
      '#  G  # LGL #  G  #',
      '#     #     #     #',
      '# L   #     #   L #',
      '#     # G G #     #',
      '#  L  #     #  L  #',
      '#     #  D  #     #',
      '###################',
    ],
  },
  treasure_vault: {
    id: 'treasure_vault',
    layer: 10,
    targetLayer: 10,
    tileTheme: 'vault',
    firstClearO2Bonus: 50,
    grid: [
      '#######################',
      '#   M   M   M   M   M #',
      '#  M  M   M   M  M   #',
      '# M     M  C  M     M #',
      '#  M  M   M   M  M   #',
      '#   M   M S M   M    #',
      '#  M  M   M   M  M   #',
      '# M     M       M  M #',
      '#   M       D       M #',
      '#######################',
    ],
  },
  ancient_archive: {
    id: 'ancient_archive',
    layer: 15,
    targetLayer: 15,
    tileTheme: 'archive',
    firstClearO2Bonus: 40,
    grid: [
      '##############################',
      '#  T     T     T     T     T #',
      '#                            #',
      '#  T  #######  T  #######  T #',
      '#     #     #     #     #    #',
      '#  T  # S   #  T  #   D #  T #',
      '#     #     #     #     #    #',
      '#  T  #######  T  #######  T #',
      '#                            #',
      '#  T     T     T     T     T #',
      '##############################',
    ],
  },
  completion_event: {
    id: 'completion_event',
    layer: 20,
    targetLayer: 20,
    tileTheme: 'cosmic',
    firstClearO2Bonus: 100,
    grid: [
      '########################################',
      '#   E   E   E   E   E   E   E   E   E  #',
      '#  E  E   E   E   E   E   E   E  E    #',
      '# E     E   E   E  S  E   E   E     E #',
      '#  E  E   E   E   E   E   E   E  E    #',
      '#   E   E   E   E   E   E   E   E   E  #',
      '########################################',
    ],
  },
}

// ============================================================
// COMPLETION EVENTS
// ============================================================

export const COMPLETION_EVENTS: CompletionEvent[] = [
  {
    id: 'ancient_signal',
    title: 'Ancient Signal Detected',
    gaiaMonologue: 'The deep resonance frequencies match no known geological pattern. Something was built here, long before recorded history.',
    reward: { type: 'cosmetic', value: 'suit_archaic_glow' },
  },
  {
    id: 'crystalline_bloom',
    title: 'Crystalline Bloom',
    gaiaMonologue: 'The mineral matrix here has self-organized into geometric perfection. It took millions of years — and you found it in an afternoon.',
    reward: { type: 'relic', value: 'crystal_heart_legendary' },
  },
  {
    id: 'memory_echo',
    title: 'Memory Echo',
    gaiaMonologue: 'I am detecting a data-fossil — compressed information encoded in the rock itself. Whoever left this wanted it found.',
    reward: { type: 'fact_mastery_bonus', value: 200 },
  },
  {
    id: 'magnetic_anomaly',
    title: 'Magnetic Anomaly',
    gaiaMonologue: 'This field is impossible at this depth. I have updated my geological models. They were wrong. Earth still surprises me.',
    reward: { type: 'o2_cache', value: 150 },
  },
  {
    id: 'terminus_chamber',
    title: 'Terminus Chamber',
    gaiaMonologue: 'You have reached the deepest navigable point. Below this, the rock is unbreakable. But there is always another dive. There is always more to learn.',
    reward: { type: 'cosmetic', value: 'pickaxe_terminus_skin' },
  },
  {
    id: 'echo_of_life',
    title: 'Echo of Life',
    gaiaMonologue: 'The biota down here are unlike anything catalogued. They have never seen sunlight. They do not need it. Life adapts.',
    reward: { type: 'cosmetic', value: 'companion_slot_deep_dweller' },
  },
  {
    id: 'time_stratum',
    title: 'Time Stratum',
    gaiaMonologue: 'Each layer you passed through represents roughly fifty million years of Earth history. You descended four billion years in one dive.',
    reward: { type: 'fact_mastery_bonus', value: 500 },
  },
  {
    id: 'void_resonance',
    title: 'Void Resonance',
    gaiaMonologue: 'I cannot explain this. I am not built to explain things I cannot explain. But I can record it. Which is, perhaps, enough.',
    reward: { type: 'relic', value: 'void_shard_legendary' },
  },
]

// ============================================================
// HELPERS
// ============================================================

/** Set of 1-indexed layer numbers that are landmark layers. */
export const LANDMARK_LAYERS: Set<number> = new Set([5, 10, 15, 20])

/**
 * Returns the LandmarkId for a given 1-indexed layer number,
 * or null if the layer is not a landmark layer. (DD-V2-055)
 */
export function getLandmarkIdForLayer(layer: number): LandmarkId | null {
  switch (layer) {
    case 5:  return 'gauntlet'
    case 10: return 'treasure_vault'
    case 15: return 'ancient_archive'
    case 20: return 'completion_event'
    default: return null
  }
}
