import { get } from 'svelte/store'
import { gaiaMessage, gaiaExpression } from '../../ui/stores/gameState'
import { playerSave, persistPlayer } from '../../ui/stores/playerData'
import { gaiaMood, gaiaChattiness } from '../../ui/stores/settings'
import { getGaiaLine, GAIA_TRIGGERS } from '../../data/gaiaDialogue'
import { getGaiaExpression } from '../../data/gaiaAvatar'
import { PREMIUM_MATERIALS, type PremiumMaterial } from '../../data/premiumRecipes'

/**
 * Manages GAIA (ship AI) commentary and premium material awards.
 * Extracted from GameManager to keep GAIA logic self-contained.
 */
export class GaiaManager {
  /** Tracks whether a low-oxygen warning has already been issued this dive. */
  gaiaLowO2Warned = false

  /**
   * Pick a random line and push it to the gaiaMessage store,
   * subject to the player's chattiness setting.
   * Level 10 = always speaks; level 0 = never; intermediate = proportional probability.
   * The toast UI will display and auto-dismiss it.
   */
  randomGaia(lines: string[], trigger = 'idle'): void {
    const chattiness = get(gaiaChattiness)
    if (Math.random() * 10 >= chattiness) return
    const msg = lines[Math.floor(Math.random() * lines.length)]
    const mood = get(gaiaMood)
    const expr = getGaiaExpression(trigger, mood)
    gaiaExpression.set(expr.id)
    gaiaMessage.set(msg)
  }

  /**
   * Emit a mood-aware GAIA line for the given named trigger, respecting chattiness.
   * Also updates the gaiaExpression store so the toast and avatar reflect context.
   */
  triggerGaia(trigger: keyof typeof GAIA_TRIGGERS): void {
    const chattiness = get(gaiaChattiness)
    if (Math.random() * 10 >= chattiness) return
    const mood = get(gaiaMood)
    const text = getGaiaLine(trigger, mood)
    const expr = getGaiaExpression(trigger, mood)
    gaiaExpression.set(expr.id)
    gaiaMessage.set(text)
  }

  /**
   * Awards one unit of the given premium material to the player's save and shows a
   * GAIA toast. Premium materials are rare in-game drops — never sold for real money.
   *
   * @param materialId - The premium material to award.
   */
  awardPremiumMaterial(materialId: PremiumMaterial): void {
    const meta = PREMIUM_MATERIALS.find(m => m.id === materialId)
    if (!meta) return

    playerSave.update(s => {
      if (!s) return s
      const current = (s.premiumMaterials ?? {})[materialId] ?? 0
      return {
        ...s,
        premiumMaterials: {
          ...(s.premiumMaterials ?? {}),
          [materialId]: current + 1,
        },
      }
    })
    persistPlayer()

    // Always show a GAIA toast for premium drops — they are rare enough to be noteworthy.
    gaiaMessage.set(`${meta.icon} Rare find! ${meta.name}!`)
    setTimeout(() => gaiaMessage.set(null), 4000)
  }
}
