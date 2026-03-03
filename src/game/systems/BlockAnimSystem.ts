// src/game/systems/BlockAnimSystem.ts

import { BlockType } from '../../data/types'

interface BlockAnimConfig {
  /** Array of sprite keys to cycle through, in order */
  frames: string[]
  /** Total animation loop duration in milliseconds */
  periodMs: number
}

/**
 * Animation configurations per animated block type.
 * Keys are Phaser sprite keys. The first frame in each array
 * is the base sprite (already loaded). Additional frames are
 * optional — if they don't exist, the system gracefully falls
 * back to the base frame.
 */
const BLOCK_ANIM_CONFIGS: Partial<Record<BlockType, BlockAnimConfig>> = {
  [BlockType.LavaBlock]: {
    frames: ['block_lava', 'block_lava_01', 'block_lava_02', 'block_lava_03', 'block_lava_04', 'block_lava_05'],
    periodMs: 800,
  },
  [BlockType.GasPocket]: {
    frames: ['block_gas', 'block_gas_01', 'block_gas_02', 'block_gas_03'],
    periodMs: 1200,
  },
  [BlockType.DescentShaft]: {
    frames: ['block_descent_shaft', 'block_descent_shaft_01', 'block_descent_shaft_02',
             'block_descent_shaft_03', 'block_descent_shaft_04', 'block_descent_shaft_05'],
    periodMs: 2000,
  },
  [BlockType.QuizGate]: {
    frames: ['block_quiz_gate', 'block_quiz_gate_01', 'block_quiz_gate_02', 'block_quiz_gate_03'],
    periodMs: 1000,
  },
  [BlockType.MineralNode]: {
    frames: ['block_mineral_shimmer_00', 'block_mineral_shimmer_01', 'block_mineral_shimmer_02'],
    periodMs: 1500,
  },
  [BlockType.ArtifactNode]: {
    frames: ['block_artifact', 'block_artifact_01', 'block_artifact_02', 'block_artifact_03'],
    periodMs: 2000,
  },
  [BlockType.RelicShrine]: {
    frames: ['block_relic_shrine', 'block_relic_shrine_01', 'block_relic_shrine_02', 'block_relic_shrine_03'],
    periodMs: 2500,
  },
  [BlockType.OxygenCache]: {
    frames: ['block_oxygen_cache', 'block_oxygen_cache_01', 'block_oxygen_cache_02', 'block_oxygen_cache_03'],
    periodMs: 1800,
  },
  [BlockType.UpgradeCrate]: {
    frames: ['block_upgrade_crate', 'block_upgrade_crate_01', 'block_upgrade_crate_02'],
    periodMs: 3000,
  },
  [BlockType.FossilNode]: {
    frames: ['block_fossil', 'block_fossil_01', 'block_fossil_02'],
    periodMs: 3000,
  },
}

/**
 * Time-based frame cycling for animated block types.
 *
 * Usage in MineScene.drawBlockPattern():
 *   const animKey = BlockAnimSystem.getFrameKey(cell.type, this.time.now, this.textures)
 *   sprite.setTexture(animKey ?? defaultKey)
 */
export class BlockAnimSystem {
  /**
   * Returns the current sprite key for an animated block type,
   * based on the elapsed game time.
   *
   * @param blockType - The type of block to animate
   * @param nowMs     - Current time in milliseconds (from Phaser's this.time.now)
   * @param textures  - Phaser TextureManager to verify key existence
   * @returns Sprite key string, or null if this block type has no animation config
   */
  static getFrameKey(
    blockType: BlockType,
    nowMs: number,
    textures: Phaser.Textures.TextureManager
  ): string | null {
    const cfg = BLOCK_ANIM_CONFIGS[blockType]
    if (!cfg) return null

    const frameIdx = Math.floor((nowMs % cfg.periodMs) / cfg.periodMs * cfg.frames.length)
    const key = cfg.frames[frameIdx]

    // Graceful fallback: if frame sprite doesn't exist, use first frame
    if (!textures.exists(key)) {
      return textures.exists(cfg.frames[0]) ? cfg.frames[0] : null
    }
    return key
  }

  /**
   * Returns whether a given block type has an idle animation.
   */
  static isAnimated(blockType: BlockType): boolean {
    return BLOCK_ANIM_CONFIGS[blockType] !== undefined
  }
}
