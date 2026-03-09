/**
 * Prestige level configuration.
 * DD-V2-050: voluntary SM-2 reset for permanent passive bonuses.
 * Max prestige: 10. Bonuses are additive per level.
 */

export interface PrestigeLevel {
  /** 1-10 */
  level: number
  /** Short display label, e.g. "Terra I" */
  label: string
  /** Hex color for badge background */
  badgeColor: string
  /** Icon character for badge */
  badgeIcon: string
  /**
   * Passive bonus applied from this level onwards (cumulative with lower levels).
   * All bonuses are cosmetic / convenience — none skip SM-2 intervals.
   */
  bonus: PrestigeBonus
}

export interface PrestigeBonus {
  /** Flat extra dust per mineral node mined (stacks across levels) */
  extraDustPerNode: number
  /** Extra inventory slots for every dive */
  extraInventorySlots: number
  /** Extra O2 on each layer transition (stacks with BALANCE.LAYER_OXYGEN_BONUS) */
  extraLayerO2: number
  /** Whether this level unlocks a unique cosmetic title */
  unlocksTitleId: string | null
  /** Whether this level unlocks a unique GAIA dialogue pool */
  unlocksDialoguePool: string | null
}

export const PRESTIGE_LEVELS: PrestigeLevel[] = [
  {
    level: 1,
    label: 'Terra I',
    badgeColor: '#c0a060',
    badgeIcon: 'I',
    bonus: {
      extraDustPerNode: 2,
      extraInventorySlots: 1,
      extraLayerO2: 3,
      unlocksTitleId: 'title_terra_i',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 2,
    label: 'Terra II',
    badgeColor: '#c0a060',
    badgeIcon: 'II',
    bonus: {
      extraDustPerNode: 2,
      extraInventorySlots: 0,
      extraLayerO2: 3,
      unlocksTitleId: 'title_terra_ii',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 3,
    label: 'Terra III',
    badgeColor: '#d4af37',
    badgeIcon: 'III',
    bonus: {
      extraDustPerNode: 3,
      extraInventorySlots: 1,
      extraLayerO2: 5,
      unlocksTitleId: 'title_terra_iii',
      unlocksDialoguePool: 'prestige_3_gaia',
    },
  },
  {
    level: 4,
    label: 'Terra IV',
    badgeColor: '#d4af37',
    badgeIcon: 'IV',
    bonus: {
      extraDustPerNode: 3,
      extraInventorySlots: 0,
      extraLayerO2: 5,
      unlocksTitleId: 'title_terra_iv',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 5,
    label: 'Terra V',
    badgeColor: '#ffd700',
    badgeIcon: 'V',
    bonus: {
      extraDustPerNode: 5,
      extraInventorySlots: 1,
      extraLayerO2: 8,
      unlocksTitleId: 'title_terra_v',
      unlocksDialoguePool: 'prestige_5_gaia',
    },
  },
  {
    level: 6,
    label: 'Terra VI',
    badgeColor: '#ffd700',
    badgeIcon: 'VI',
    bonus: {
      extraDustPerNode: 5,
      extraInventorySlots: 0,
      extraLayerO2: 8,
      unlocksTitleId: 'title_terra_vi',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 7,
    label: 'Terra VII',
    badgeColor: '#ffb800',
    badgeIcon: 'VII',
    bonus: {
      extraDustPerNode: 5,
      extraInventorySlots: 1,
      extraLayerO2: 8,
      unlocksTitleId: 'title_terra_vii',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 8,
    label: 'Terra VIII',
    badgeColor: '#ffb800',
    badgeIcon: 'VIII',
    bonus: {
      extraDustPerNode: 5,
      extraInventorySlots: 0,
      extraLayerO2: 8,
      unlocksTitleId: 'title_terra_viii',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 9,
    label: 'Terra IX',
    badgeColor: '#ff9c00',
    badgeIcon: 'IX',
    bonus: {
      extraDustPerNode: 8,
      extraInventorySlots: 1,
      extraLayerO2: 12,
      unlocksTitleId: 'title_terra_ix',
      unlocksDialoguePool: 'prestige_9_gaia',
    },
  },
  {
    level: 10,
    label: 'Terra X',
    badgeColor: '#ff8c00',
    badgeIcon: 'X',
    bonus: {
      extraDustPerNode: 8,
      extraInventorySlots: 1,
      extraLayerO2: 12,
      unlocksTitleId: 'title_terra_x',
      unlocksDialoguePool: 'prestige_10_gaia',
    },
  },
]

/**
 * Returns the cumulative prestige bonus for a given prestige level
 * by summing all bonuses from level 1 through the given level.
 *
 * @param level - Prestige level (0 = no prestige, returns all-zero bonus)
 */
export function getCumulativePrestigeBonus(level: number): PrestigeBonus {
  const relevant = PRESTIGE_LEVELS.filter(p => p.level <= level)
  return relevant.reduce<PrestigeBonus>(
    (acc, p) => ({
      extraDustPerNode: acc.extraDustPerNode + p.bonus.extraDustPerNode,
      extraInventorySlots: acc.extraInventorySlots + p.bonus.extraInventorySlots,
      extraLayerO2: acc.extraLayerO2 + p.bonus.extraLayerO2,
      unlocksTitleId: p.bonus.unlocksTitleId ?? acc.unlocksTitleId,
      unlocksDialoguePool: p.bonus.unlocksDialoguePool ?? acc.unlocksDialoguePool,
    }),
    {
      extraDustPerNode: 0,
      extraInventorySlots: 0,
      extraLayerO2: 0,
      unlocksTitleId: null,
      unlocksDialoguePool: null,
    },
  )
}
