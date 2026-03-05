import { CREATURE_TEMPLATES } from '../../data/creatures'
import { createCreature } from '../entities/Creature'
import type { Creature } from '../entities/Creature'
import type { BiomeId } from '../../data/biomes'
import { BALANCE } from '../../data/balance'

/**
 * CreatureSpawner selects and instantiates creatures appropriate to the
 * current biome and layer depth, respecting spawn rate and cooldown. (DD-V2-026)
 */
export class CreatureSpawner {
  private blocksSinceSpawn = 0
  private totalBlocksThisLayer = 0

  /** Reset counters when entering a new layer. */
  resetForLayer(): void {
    this.blocksSinceSpawn = 0
    this.totalBlocksThisLayer = 0
  }

  /** Reset counters at the start of a new dive. */
  resetForDive(): void {
    this.resetForLayer()
  }

  /**
   * Call after every block is mined.
   * Returns a Creature instance if a spawn should trigger, otherwise null.
   *
   * @param currentLayerIndex  0-based index of the current mine layer
   * @param currentBiomeId     Active biome ID for affinity-based selection
   */
  checkSpawn(currentLayerIndex: number, currentBiomeId: BiomeId | null): Creature | null {
    this.totalBlocksThisLayer++
    this.blocksSinceSpawn++

    // Never spawn on boss layers — boss combat is handled exclusively by EncounterManager
    const bossLayers = BALANCE.BOSS_LAYER_INDICES as readonly number[]
    if (bossLayers.includes(currentLayerIndex)) return null

    // Layer 0 is tutorial-adjacent; no creature spawns there
    if (currentLayerIndex < 1) return null

    // Minimum block threshold before first spawn
    if (this.totalBlocksThisLayer < BALANCE.CREATURE_SPAWN_MIN_BLOCKS) return null

    // Cooldown between spawns
    if (this.blocksSinceSpawn < BALANCE.CREATURE_SPAWN_COOLDOWN) return null

    // Probability check
    if (Math.random() >= BALANCE.CREATURE_SPAWN_CHANCE_PER_BLOCK) return null

    const template = this._selectTemplate(currentLayerIndex, currentBiomeId)
    if (!template) return null

    this.blocksSinceSpawn = 0
    return createCreature(template, currentLayerIndex + 1)
  }

  /**
   * Select a creature template appropriate for the given layer and biome.
   * Prefers biome-affine creatures; falls back to any depth-eligible creature.
   *
   * @param layerIndex  0-based layer index
   * @param biomeId     Active biome ID, or null
   */
  private _selectTemplate(
    layerIndex: number,
    biomeId: BiomeId | null,
  ): typeof CREATURE_TEMPLATES[number] | null {
    const layer = layerIndex + 1  // 1-based for depthRange comparisons

    const eligible = CREATURE_TEMPLATES.filter(
      c => layer >= c.depthRange[0] && layer <= c.depthRange[1]
    )
    if (eligible.length === 0) return null

    const biomeAffine = biomeId
      ? eligible.filter(c => c.biomeAffinity.includes(biomeId))
      : []

    const pool = biomeAffine.length > 0 ? biomeAffine : eligible
    return pool[Math.floor(Math.random() * pool.length)]
  }
}
