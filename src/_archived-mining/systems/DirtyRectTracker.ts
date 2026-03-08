/**
 * Tracks which mine tiles have changed since the last render pass.
 * Consumers call markDirty() when a tile changes, then consumeDirty() each frame
 * to get the minimal set of tiles to redraw.
 *
 * When tile (x, y) is marked dirty, all 8 neighbors are also marked dirty because
 * autotile bitmask computation reads neighbor types. (DD-V2-194)
 *
 * Key contract: consumeDirty() is called exactly once per frame by MineScene.update().
 * All markDirty() calls between frames accumulate in the set.
 */
export interface DirtyTile { x: number; y: number }

/** Tracks changed mine tiles for selective per-frame re-rendering. */
export class DirtyRectTracker {
  private dirty = new Set<number>()
  private width: number
  private height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  /** Marks tile (x, y) and its 8 neighbors dirty. Out-of-bounds coordinates are ignored. */
  markDirty(x: number, y: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx; const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < this.width && ny < this.height) {
          this.dirty.add(ny * this.width + nx)
        }
      }
    }
  }

  /** Marks a rectangular region dirty (e.g. after BFS flood-fill reveals a large area). */
  markRegionDirty(x: number, y: number, w: number, h: number): void {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (tx >= 0 && ty >= 0 && tx < this.width && ty < this.height) {
          this.dirty.add(ty * this.width + tx)
        }
      }
    }
  }

  /** Marks every tile dirty. Call on layer load or after a tileset change. */
  markAllDirty(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.dirty.add(y * this.width + x)
      }
    }
  }

  /**
   * Returns the current dirty set and clears it.
   * Called once per frame by MineScene.update().
   */
  consumeDirty(): DirtyTile[] {
    const result: DirtyTile[] = []
    for (const key of this.dirty) {
      result.push({ x: key % this.width, y: Math.floor(key / this.width) })
    }
    this.dirty.clear()
    return result
  }

  /** Number of pending dirty tiles — for DevPanel diagnostics. */
  get pendingCount(): number { return this.dirty.size }

  /** Resets tracker for new grid dimensions (called on layer transition). */
  reset(width: number, height: number): void {
    this.width = width; this.height = height; this.dirty.clear()
  }
}
