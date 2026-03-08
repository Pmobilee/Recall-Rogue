// src/game/systems/CrackSystem.ts

import { BlockType } from '../../data/types'
import type { MineCell } from '../../data/types'

/** Material-based visual category for crack rendering */
export type CrackMaterialCategory = 'soil' | 'rock' | 'crystal' | 'lava' | 'gas' | 'softSpecial' | 'default'

/** Crack stage descriptor */
export interface CrackStage {
  /** Sprite key to use for this stage */
  spriteKey: string
  /** Health percentage threshold — show this stage when health is AT OR BELOW this value */
  healthThreshold: number
  /** Base alpha multiplier for this stage */
  baseAlpha: number
}

/**
 * Ordered from most severe to least severe (for threshold lookup).
 * Stage 4 (≤10%) is shown first; stage 1 (≤75%) is the earliest visible crack.
 */
export const CRACK_STAGES: CrackStage[] = [
  { spriteKey: 'crack_stage4', healthThreshold: 0.10, baseAlpha: 0.92 },
  { spriteKey: 'crack_stage3', healthThreshold: 0.25, baseAlpha: 0.78 },
  { spriteKey: 'crack_stage2', healthThreshold: 0.50, baseAlpha: 0.65 },
  { spriteKey: 'crack_stage1', healthThreshold: 0.75, baseAlpha: 0.55 },
]

/** Hex tint colors keyed by material category */
export const CRACK_MATERIAL_TINTS: Record<CrackMaterialCategory, number> = {
  soil:        0x8c6342,
  rock:        0x2e2e2e,
  crystal:     0x88ccff,
  lava:        0xdd3300,
  gas:         0x33ff44,
  softSpecial: 0xffd700,
  default:     0x303030,
}

/**
 * Returns the crack stage and material category for a given cell's current health.
 * Returns null if no crack should be shown (health > 75%).
 *
 * @param cell - The mine cell to evaluate
 * @returns Crack info object, or null if no crack should be rendered
 */
export function getCrackInfo(cell: MineCell): {
  stage: CrackStage
  category: CrackMaterialCategory
  tintColor: number
} | null {
  if (cell.maxHardness <= 0 || cell.hardness <= 0 || cell.hardness >= cell.maxHardness) {
    return null
  }
  const healthPct = cell.hardness / cell.maxHardness
  const stage = CRACK_STAGES.find(s => healthPct <= s.healthThreshold)
  if (!stage) return null

  const category = getCrackCategory(cell)
  return { stage, category, tintColor: CRACK_MATERIAL_TINTS[category] }
}

/**
 * Classifies a MineCell into a CrackMaterialCategory based on its block type
 * and optional mineral content.
 *
 * @param cell - The mine cell to classify
 * @returns The material category string
 */
export function getCrackCategory(cell: MineCell): CrackMaterialCategory {
  switch (cell.type) {
    case BlockType.Dirt:
    case BlockType.SoftRock:
      return 'soil'
    case BlockType.Stone:
    case BlockType.HardRock:
    case BlockType.Unbreakable:
      return 'rock'
    case BlockType.MineralNode: {
      const tier = cell.content?.mineralType
      return (tier === 'crystal' || tier === 'geode' || tier === 'essence') ? 'crystal' : 'default'
    }
    case BlockType.LavaBlock:
      return 'lava'
    case BlockType.GasPocket:
      return 'gas'
    case BlockType.OxygenCache:
    case BlockType.QuizGate:
    case BlockType.UpgradeCrate:
      return 'softSpecial'
    default:
      return 'default'
  }
}
