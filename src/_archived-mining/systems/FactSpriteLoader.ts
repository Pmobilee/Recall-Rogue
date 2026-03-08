/**
 * FactSpriteLoader — loads fact sprites into Phaser's texture cache on demand.
 * Called by MineScene before presenting the quiz overlay so the texture is ready.
 *
 * Uses dynamic import-style fetch (not Phaser's Loader queue) to avoid blocking
 * the game loop while waiting for textures.
 */

import Phaser from 'phaser'
import { getFactSpriteManifest } from '../../services/factSpriteManifest'
import { supportsWebP } from '../spriteManifest'

export class FactSpriteLoader {
  private scene: Phaser.Scene
  private loading = new Set<string>()
  private loaded  = new Set<string>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Preloads the sprite for a fact ID into Phaser's texture cache.
   * No-ops if already loaded or loading. Resolves when the texture is ready.
   */
  async preload(factId: string): Promise<void> {
    const manifest = await getFactSpriteManifest()
    if (!manifest.has(factId))      return
    if (this.loaded.has(factId))    return
    if (this.loading.has(factId))   return

    this.loading.add(factId)
    const key = `fact_sprite_${factId}`
    const ext = supportsWebP() ? '.webp' : '.png'
    const url = `/assets/sprites/facts/${factId}${ext}`

    return new Promise((resolve) => {
      if (this.scene.textures.exists(key)) {
        this.loaded.add(factId)
        this.loading.delete(factId)
        resolve()
        return
      }

      this.scene.load.image(key, url)
      this.scene.load.once('complete', () => {
        this.loaded.add(factId)
        this.loading.delete(factId)
        resolve()
      })
      this.scene.load.start()
    })
  }

  /** Returns the Phaser texture key for a given fact ID, or null if not loaded. */
  getKey(factId: string): string | null {
    const key = `fact_sprite_${factId}`
    return this.scene.textures.exists(key) ? key : null
  }
}
