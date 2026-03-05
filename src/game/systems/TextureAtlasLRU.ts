/**
 * LRU cache for Phaser texture atlases.
 * Enforces max-atlas count (DD-V2-189) and calls scene.textures.remove() on eviction
 * so the GPU VRAM is freed immediately (not deferred to GC).
 *
 * Usage:
 *   const lru = new TextureAtlasLRU(scene, 3)
 *   await lru.ensureLoaded('mine_atlas_volcanic', '/assets/atlases/volcanic.json', '/assets/atlases/volcanic.webp')
 *   // ... use textures ...
 *   lru.evictAll()  // Call in MineScene.shutdown()
 */
import Phaser from 'phaser'

interface AtlasEntry { key: string; lastUsed: number }

/** LRU-evicting cache for Phaser texture atlases, enforcing a max atlas count in GPU memory. */
export class TextureAtlasLRU {
  private entries: Map<string, AtlasEntry> = new Map()
  constructor(private scene: Phaser.Scene, private maxAtlases = 3) {}

  /**
   * Ensures the atlas is loaded into the Phaser texture manager.
   * If the atlas is already loaded, updates its lastUsed timestamp.
   * If the cache is full, evicts the least-recently-used atlas first.
   *
   * @param key      - Unique texture key for the atlas
   * @param jsonUrl  - URL to the atlas JSON descriptor
   * @param imageUrl - URL to the atlas image (WebP or PNG)
   */
  async ensureLoaded(key: string, jsonUrl: string, imageUrl: string): Promise<void> {
    if (this.entries.has(key)) {
      this.entries.get(key)!.lastUsed = Date.now()
      return
    }
    while (this.entries.size >= this.maxAtlases) this.evictLRU()

    await new Promise<void>((resolve, reject) => {
      if (this.scene.textures.exists(key)) { resolve(); return }
      this.scene.load.atlas(key, imageUrl, jsonUrl)
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, resolve)
      this.scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, reject)
      this.scene.load.start()
    })
    this.entries.set(key, { key, lastUsed: Date.now() })
  }

  /** Evicts the least-recently-used atlas from GPU memory. */
  private evictLRU(): void {
    let oldest: string | null = null; let oldestTime = Infinity
    for (const [k, e] of this.entries) {
      if (e.lastUsed < oldestTime) { oldestTime = e.lastUsed; oldest = k }
    }
    if (oldest) {
      if (this.scene.textures.exists(oldest)) this.scene.textures.remove(oldest)
      this.entries.delete(oldest)
    }
  }

  /** Evicts all cached atlases from GPU memory. Call in MineScene.shutdown(). */
  evictAll(): void {
    for (const key of this.entries.keys()) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    }
    this.entries.clear()
  }

  /** Number of atlases currently cached. */
  get count(): number { return this.entries.size }
}
