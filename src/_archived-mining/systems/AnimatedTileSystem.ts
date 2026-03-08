import { BlockType } from '../../data/types'

/**
 * Definition for a block type that cycles through animated frames.
 * Each biome defines 3-4 of these.
 */
export interface AnimatedTileDefinition {
  /** Which block type gets this animation */
  blockType: BlockType
  /** e.g. 'lava_flow' → sprite keys 'lava_flow_0' through 'lava_flow_N' */
  spriteKeyPrefix: string
  /** Number of frames (4-6) */
  frameCount: number
  /** Milliseconds per frame (150-250ms) */
  frameDuration: number
}

/** Default animated tile definitions used when biome doesn't specify custom ones */
export const DEFAULT_ANIMATED_TILES: AnimatedTileDefinition[] = [
  { blockType: BlockType.LavaBlock, spriteKeyPrefix: 'lava_flow', frameCount: 4, frameDuration: 200 },
  { blockType: BlockType.GasPocket, spriteKeyPrefix: 'gas_drift', frameCount: 4, frameDuration: 250 },
  { blockType: BlockType.MineralNode, spriteKeyPrefix: 'mineral_shimmer', frameCount: 4, frameDuration: 200 },
]

/**
 * Manages animated tile frame cycling with per-tile phase offsets.
 * Uses a global accumulator and deterministic phase offsets so adjacent
 * tiles are not synchronized (DD-V2-239).
 */
export class AnimatedTileSystem {
  private accumulatedMs: number = 0
  private definitions: AnimatedTileDefinition[]
  private blockTypeToDefIndex: Map<BlockType, number> = new Map()

  constructor(definitions?: AnimatedTileDefinition[]) {
    this.definitions = definitions ?? DEFAULT_ANIMATED_TILES
    this.definitions.forEach((def, i) => {
      this.blockTypeToDefIndex.set(def.blockType, i)
    })
  }

  /**
   * Advance the global animation clock.
   * @param deltaMs - milliseconds since last update
   */
  update(deltaMs: number): void {
    this.accumulatedMs += deltaMs
  }

  /**
   * Returns whether a block type has an animated tile definition.
   */
  isAnimated(blockType: BlockType): boolean {
    return this.blockTypeToDefIndex.has(blockType)
  }

  /**
   * Returns the current animation frame index (0-based) for a given cell.
   * Uses deterministic phase offset: (x*7 + y*13) % frameCount
   */
  getTileFrame(x: number, y: number, blockType: BlockType): number {
    const defIndex = this.blockTypeToDefIndex.get(blockType)
    if (defIndex === undefined) return 0
    const def = this.definitions[defIndex]
    const phaseOffset = (x * 7 + y * 13) % def.frameCount
    const globalFrame = Math.floor(this.accumulatedMs / def.frameDuration)
    return (globalFrame + phaseOffset) % def.frameCount
  }

  /**
   * Returns the sprite key for the current frame of an animated tile.
   * Returns null if the block type is not animated.
   */
  getSpriteKey(x: number, y: number, blockType: BlockType): string | null {
    const defIndex = this.blockTypeToDefIndex.get(blockType)
    if (defIndex === undefined) return null
    const def = this.definitions[defIndex]
    const frame = this.getTileFrame(x, y, blockType)
    return `${def.spriteKeyPrefix}_${frame}`
  }

  /** Reset the accumulator (e.g., on scene restart). */
  reset(): void {
    this.accumulatedMs = 0
  }

  /** Update the definitions (e.g., when biome changes). */
  setDefinitions(definitions: AnimatedTileDefinition[]): void {
    this.definitions = definitions
    this.blockTypeToDefIndex.clear()
    definitions.forEach((def, i) => {
      this.blockTypeToDefIndex.set(def.blockType, i)
    })
  }
}
