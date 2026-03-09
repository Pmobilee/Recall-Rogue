// ConsumableSlot inlined from archived gameState — mining dive save only
type ConsumableSlot = { id: string; remainingUses: number } | null

/**
 * Full mid-dive save state. Written to localStorage every 30 ticks.
 * Key: 'terra_miner_dive_save'
 * (DD-V2-053)
 */
export interface DiveSaveState {
  /** Schema version for forward-compatibility checks. */
  version: number
  /** ISO timestamp of last save. */
  savedAt: string
  /** Serialized mine grid (block types as 2D array of strings). */
  mineGrid: string[][]
  /** Player position in grid coordinates. */
  playerPos: { x: number; y: number }
  /** Current inventory snapshot. */
  inventorySnapshot: Array<{ type: string; count: number }>
  /** Cumulative tick count this dive. */
  ticks: number
  /** Current layer (0-indexed). */
  layer: number
  /** Active biome id. */
  biomeId: string
  /** Current O2 level. */
  o2: number
  /** Dive seed used for this run. */
  diveSeed: number
  /** Equipped relic ids. */
  relicIds: string[]
  /** Active consumable slots. */
  consumables: ConsumableSlot[]
  /** Minerals already banked via send-up this run. Exempt from loot loss. */
  bankedMinerals: Record<string, number>
  /** Auto-balance state: consecutive deaths on same layer. */
  sameLayerDeathCount: number
  /** Auto-balance state: last layer where death occurred. */
  lastDeathLayer: number
  /**
   * Per-layer grid checksums recorded at generation time (Phase 49.5, DD-V2-235).
   * Index i corresponds to layer i. Used for seed determinism verification.
   */
  layerChecksums?: number[]
}

export const DIVE_SAVE_KEY = 'terra_miner_dive_save'
export const DIVE_SAVE_VERSION = 1

// Legacy aliases — kept for backwards-compat with existing SaveManager references
export const SAVE_STATE_KEY = DIVE_SAVE_KEY
export const SAVE_STATE_VERSION = DIVE_SAVE_VERSION
