/**
 * Shared mine type definitions for co-op dive state.
 */

/** A single cell in the mine grid. */
export interface MineCell {
  /** Block type identifier (e.g. 'dirt', 'stone', 'mineral_node', 'empty'). */
  type: string
  /** Optional mineral subtype for mineral_node blocks. */
  mineral?: string
  /** Whether the block has been revealed to the player. */
  revealed?: boolean
}
